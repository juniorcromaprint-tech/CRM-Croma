// src/domains/comercial/hooks/useDispararAbertura.ts
// Mutation que chama RPC fn_disparar_abertura_em_massa.
// Suporta canal whatsapp e email.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

export type CanalDisparo = 'whatsapp' | 'email';

export interface DispararParams {
  leadIds: string[];
  templateId: string;
  modo: 'imediato' | 'agendado';
  autoAprovar?: boolean;
  incluirImagem?: boolean;
  /**
   * UUID de uma campanha em `agent_campanhas` para vincular este disparo.
   * Quando ausente/null/undefined, a chamada cai no overload de 6 args da RPC
   * (wrapper de compatibilidade da migration 140) e a mensagem é gravada com
   * `campanha_id IS NULL` — comportamento idêntico ao da migration 138.
   * Quando presente, a RPC grava o vínculo em agent_messages, agent_conversations
   * e incrementa total_leads em agent_campanhas (via trigger).
   */
  campanhaId?: string | null;
}

export interface DisparoResultRow {
  lead_id: string;
  conversation_id: string | null;
  message_id: string | null;
  status: 'criado' | 'bloqueado' | 'pulado' | 'duplicado';
  motivo: string | null;
}

export function useDispararAbertura() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: DispararParams): Promise<DisparoResultRow[]> => {
      const { data: userData } = await supabase.auth.getUser();

      // Construção do payload com SPREAD CONDICIONAL no campanha_id.
      // Se campanhaId é falsy, a chave `p_campanha_id` NÃO entra no objeto:
      //   → PostgREST resolve para o overload de 6 args (wrapper de compat)
      //   → comportamento bit-a-bit idêntico ao da migration 138 (validado em prod 2026-05-06).
      // Se campanhaId é UUID, a chave entra:
      //   → resolve para o overload de 7 args
      //   → grava vínculo em agent_messages/agent_conversations e dispara trigger de total_leads.
      const args: Record<string, unknown> = {
        p_lead_ids:        params.leadIds,
        p_template_id:     params.templateId,
        p_user_id:         userData.user?.id ?? null,
        p_auto_aprovar:    params.autoAprovar ?? true,
        p_modo:            params.modo,
        p_incluir_imagem:  params.incluirImagem ?? true,
      };
      if (params.campanhaId) {
        args.p_campanha_id = params.campanhaId;
      }

      const { data, error } = await supabase.rpc('fn_disparar_abertura_em_massa', args);

      if (error) throw error;
      return (data ?? []) as DisparoResultRow[];
    },

    onSuccess: (data, variables) => {
      const criados   = data.filter(d => d.status === 'criado').length;
      const bloqueados = data.filter(d => d.status === 'bloqueado').length;
      const pulados   = data.filter(d => d.status === 'pulado').length;
      const dups      = data.filter(d => d.status === 'duplicado').length;

      const labelContato = pulados
        ? `${pulados} sem contato.`
        : '';

      const msg = [
        `${criados} disparo${criados !== 1 ? 's' : ''} enfileirado${criados !== 1 ? 's' : ''}.`,
        bloqueados ? `${bloqueados} bloqueado${bloqueados !== 1 ? 's' : ''}.` : '',
        labelContato,
        dups       ? `${dups} ja em conversa.` : '',
      ].filter(Boolean).join(' ');

      showSuccess(msg);
      queryClient.invalidateQueries({ queryKey: ['leads-disparo'] });
    },

    onError: (e: any) => showError('Falha no disparo: ' + (e.message || 'Erro desconhecido')),
  });
}

// Templates de abertura ativos por canal.
// IMPORTANTE: traz TODOS do canal (independente do segmento). O modal marca como
// "recomendado" o que casa com o segmento dos leads selecionados.
export function useTemplatesAbertura(canal: CanalDisparo = 'whatsapp') {
  return useQuery({
    queryKey: ['templates-abertura', canal],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_templates')
        .select('id, nome, etapa, segmento, sub_segmento, meta_template_name, conteudo, assunto, variaveis, vezes_usado, taxa_resposta, template_language, imagem_url')
        .eq('canal', canal)
        .eq('etapa', 'abertura')
        .eq('ativo', true)
        .order('segmento', { nullsFirst: false })
        .order('nome');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60_000,
  });
}
