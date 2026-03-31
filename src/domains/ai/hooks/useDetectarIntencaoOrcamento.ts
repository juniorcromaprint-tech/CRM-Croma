// src/domains/ai/hooks/useDetectarIntencaoOrcamento.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

export interface IntentResult {
  intencao: 'orcamento' | 'informacao' | 'reclamacao' | 'suporte' | 'outros';
  confianca: number;
  itens_detectados: string[];
  sinais: string[];
  urgencia: 'alta' | 'media' | 'baixa';
  recomendacao: 'gerar_orcamento' | 'pedir_mais_info' | 'responder_duvida' | 'encaminhar_humano';
  orcamento_auto?: boolean;
  orcamento_resultado?: {
    status: string;
    proposta_id?: string;
    proposta_numero?: string;
    portal_url?: string;
    total?: number;
    itens_count?: number;
  };
}

/**
 * Detecta intenção de orçamento em uma conversa do agente.
 * Se auto_gerar=true, gera orçamento automaticamente quando confiança >= 0.7
 */
export function useDetectarIntencaoOrcamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      conversation_id: string;
      auto_gerar?: boolean;
    }): Promise<IntentResult> => {
      const res = await supabase.functions.invoke('ai-detectar-intencao-orcamento', {
        body: params,
      });

      if (res.error) throw new Error(res.error.message);
      return res.data as IntentResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agent'] });
      queryClient.invalidateQueries({ queryKey: ['comercial'] });

      if (data.orcamento_auto && data.orcamento_resultado?.status === 'proposta_criada') {
        showSuccess(
          `Orçamento ${data.orcamento_resultado.proposta_numero} gerado automaticamente!`
        );
      } else if (data.intencao === 'orcamento' && data.confianca >= 0.5) {
        showSuccess(
          `Intenção de orçamento detectada (${(data.confianca * 100).toFixed(0)}% confiança)`
        );
      }
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}

/**
 * Gera orçamento diretamente a partir de uma conversa.
 * Não faz detecção de intenção — assume que a intenção já foi confirmada.
 */
export function useGerarOrcamentoIA() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      conversation_id: string;
      lead_id: string;
      canal: string;
    }) => {
      // Buscar mensagens da conversa
      const { data: mensagens, error: msgError } = await (supabase as any)
        .from('agent_messages')
        .select('direcao, conteudo')
        .eq('conversation_id', params.conversation_id)
        .order('created_at', { ascending: true })
        .limit(30);

      if (msgError) throw msgError;

      const res = await supabase.functions.invoke('ai-gerar-orcamento', {
        body: {
          conversation_id: params.conversation_id,
          lead_id: params.lead_id,
          mensagens: mensagens ?? [],
          canal: params.canal,
        },
      });

      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['agent'] });
      queryClient.invalidateQueries({ queryKey: ['comercial'] });
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });

      if (data?.status === 'proposta_criada') {
        showSuccess(`Orçamento ${data.proposta_numero} gerado! Total: R$ ${data.total?.toFixed(2)}`);
      } else if (data?.status === 'info_faltante') {
        showSuccess('Pedido de clarificação enviado ao lead');
      }
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}
