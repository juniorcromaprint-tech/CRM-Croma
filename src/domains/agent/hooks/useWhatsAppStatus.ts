import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

export interface WhatsAppStatus {
  configured: boolean;
  hasToken: boolean;
  hasPhoneId: boolean;
  hasVerifyToken: boolean;
  hasAppSecret: boolean;
  channelActive: boolean;
  lastMessageAt: string | null;
  /** Mensagens efetivamente enviadas hoje (status IN enviada/entregue/lida/respondida).
   *  Bate exatamente com o que o backend whatsapp-enviar usa pra checar limite.
   *  Fonte: RPC fn_contar_enviadas_hoje('whatsapp'). */
  todaySent: number;
  /** Tentativas de envio hoje (efetivas + erros). Métrica de saúde do canal.
   *  Útil pra diagnosticar campanhas com muito erro Meta (número inválido etc). */
  todayAttempts: number;
  todayReceived: number;
  /** Limite diário EFETIVO = LEAST(rampa_aquecimento, max_contatos_dia).
   *  Fonte: RPC fn_limite_diario_efetivo. Mesmo que backend usa. */
  dailyLimit: number;
}

export function useWhatsAppStatus() {
  return useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: async (): Promise<WhatsAppStatus> => {
      // Check admin_config for WhatsApp credentials
      const { data: config } = await supabase
        .from('admin_config')
        .select('chave, valor')
        .in('chave', [
          'WHATSAPP_ACCESS_TOKEN',
          'WHATSAPP_PHONE_NUMBER_ID',
          'WHATSAPP_VERIFY_TOKEN',
          'WHATSAPP_APP_SECRET',
          'agent_config',
        ]);

      const configMap = new Map((config ?? []).map(c => [c.chave, c.valor]));
      const hasToken = !!configMap.get('WHATSAPP_ACCESS_TOKEN');
      const hasPhoneId = !!configMap.get('WHATSAPP_PHONE_NUMBER_ID');
      const hasVerifyToken = !!configMap.get('WHATSAPP_VERIFY_TOKEN');
      const hasAppSecret = !!configMap.get('WHATSAPP_APP_SECRET');

      // Check if whatsapp channel is active in agent_config
      let channelActive = false;
      const agentConfig = configMap.get('agent_config');
      if (agentConfig) {
        try {
          const parsed = typeof agentConfig === 'string' ? JSON.parse(agentConfig) : agentConfig;
          channelActive = (parsed.canais_ativos ?? []).includes('whatsapp');
        } catch { /* ignore parse errors */ }
      }

      // Limite diário EFETIVO via RPC (LEAST de rampa e max_contatos_dia).
      // Mesma fonte que o backend whatsapp-enviar usa - sem divergência UI/backend.
      let dailyLimit = 15;
      try {
        const { data: limiteRpc } = await supabase.rpc('fn_limite_diario_efetivo');
        if (typeof limiteRpc === 'number' && limiteRpc > 0) {
          dailyLimit = limiteRpc;
        }
      } catch { /* mantém fallback */ }

      // Get today's message counts
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // (1) Mensagens efetivamente ENVIADAS hoje via RPC — bate com backend.
      //     Filtra status IN (enviada,entregue,lida,respondida).
      //     Fix do bug 2026-05-11 onde webhook avançava status e sumia do contador.
      let sentCount = 0;
      try {
        const { data: countRpc } = await supabase.rpc('fn_contar_enviadas_hoje', {
          p_canal: 'whatsapp',
        });
        if (typeof countRpc === 'number') sentCount = countRpc;
      } catch { /* zero */ }

      // (2) TENTATIVAS de envio hoje (qualquer direcao=enviada, inclui erros).
      //     Métrica de saúde - útil pra ver erros Meta em campanhas.
      const { count: attemptsCount } = await supabase
        .from('agent_messages')
        .select('*', { count: 'exact', head: true })
        .eq('canal', 'whatsapp')
        .eq('direcao', 'enviada')
        .gte('created_at', todayStart.toISOString());

      const { count: receivedCount } = await supabase
        .from('agent_messages')
        .select('*', { count: 'exact', head: true })
        .eq('canal', 'whatsapp')
        .eq('direcao', 'recebida')
        .gte('created_at', todayStart.toISOString());

      // Get last WhatsApp message time
      const { data: lastMsg } = await supabase
        .from('agent_messages')
        .select('created_at')
        .eq('canal', 'whatsapp')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const configured = hasToken && hasPhoneId;

      return {
        configured,
        hasToken,
        hasPhoneId,
        hasVerifyToken,
        hasAppSecret,
        channelActive,
        lastMessageAt: lastMsg?.created_at ?? null,
        todaySent: sentCount,
        todayAttempts: attemptsCount ?? 0,
        todayReceived: receivedCount ?? 0,
        dailyLimit,
      };
    },
    staleTime: 60_000, // 1 min
  });
}

export function useToggleWhatsAppChannel() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (activate: boolean) => {
      const { data: existing } = await supabase
        .from('admin_config')
        .select('valor')
        .eq('chave', 'agent_config')
        .single();

      let config: Record<string, unknown> = {};
      if (existing?.valor) {
        try {
          config = typeof existing.valor === 'string' ? JSON.parse(existing.valor) : existing.valor;
        } catch { /* ignore */ }
      }

      const canais = new Set<string>((config.canais_ativos as string[]) ?? ['email']);
      if (activate) canais.add('whatsapp');
      else canais.delete('whatsapp');

      config.canais_ativos = Array.from(canais);

      const { error } = await supabase
        .from('admin_config')
        .upsert({ chave: 'agent_config', valor: config }, { onConflict: 'chave' });

      if (error) throw error;
    },
    onSuccess: (_, activate) => {
      qc.invalidateQueries({ queryKey: ['whatsapp-status'] });
      showSuccess(activate ? 'WhatsApp ativado no agente' : 'WhatsApp desativado');
    },
    onError: () => showError('Erro ao alterar canal WhatsApp'),
  });
}

export function useRecentWhatsAppMessages() {
  return useQuery({
    queryKey: ['whatsapp-recent-messages'],
    queryFn: async () => {
      const { data } = await supabase
        .from('agent_messages')
        .select(`
          id, direcao, conteudo, canal, status, created_at,
          media_url, media_type, media_mime, media_filename,
          agent_conversations!inner(
            id,
            leads!inner(empresa, contato_nome)
          )
        `)
        .eq('canal', 'whatsapp')
        .order('created_at', { ascending: false })
        .limit(5);

      return data ?? [];
    },
    staleTime: 30_000,
  });
}
