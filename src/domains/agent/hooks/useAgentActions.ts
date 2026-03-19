import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import type { AgentQualification, AgentAction, AgentCanal, AgentEtapa } from '../types/agent.types';

// ─── Hooks ───────────────────────────────────────────────────────────────────
// Note: supabase.functions.invoke automatically attaches the current session's
// Authorization header and handles token auto-refresh. No manual headers needed.

/**
 * Qualifica um lead via IA (Edge Function `ai-qualificar-lead`).
 * Invalida queries de leads. Exibe score no toast.
 */
export function useQualifyLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leadId: string): Promise<AgentQualification> => {
      const res = await supabase.functions.invoke('ai-qualificar-lead', {
        body: { lead_id: leadId },
      });

      if (res.error) throw new Error(res.error.message);

      return res.data as AgentQualification;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'leads'] });
      showSuccess(`Lead qualificado — score ${data.score}/100`);
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}

/**
 * Compõe uma mensagem via IA (Edge Function `ai-compor-mensagem`).
 * Invalida queries do agente.
 */
export function useComposeMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      lead_id: string;
      canal: AgentCanal;
      etapa?: AgentEtapa;
      contexto_extra?: string;
    }) => {
      const res = await supabase.functions.invoke('ai-compor-mensagem', {
        body: params,
      });

      if (res.error) throw new Error(res.error.message);

      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent'] });
      showSuccess('Mensagem composta pelo agente');
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}

/**
 * Executa o orquestrador do agente em modo batch (Edge Function `ai-decidir-acao`).
 * Invalida todas as queries do agente. Exibe contagem de ações no toast.
 */
export function useRunOrchestrator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<{ actions: AgentAction[]; processed: number }> => {
      const res = await supabase.functions.invoke('ai-decidir-acao', {
        body: { modo: 'batch' },
      });

      if (res.error) throw new Error(res.error.message);

      return res.data as { actions: AgentAction[]; processed: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agent'] });
      const count = data.processed ?? data.actions?.length ?? 0;
      showSuccess(`Orquestrador concluído — ${count} ação${count !== 1 ? 'ões' : ''} processada${count !== 1 ? 's' : ''}`);
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}
