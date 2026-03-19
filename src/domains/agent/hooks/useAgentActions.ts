import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import type { AgentQualification, AgentAction, AgentCanal, AgentEtapa } from '../types/agent.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getAuthHeader() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token}` };
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Qualifica um lead via IA (Edge Function `ai-qualificar-lead`).
 * Invalida queries de leads. Exibe score no toast.
 */
export function useQualifyLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leadId: string): Promise<AgentQualification> => {
      const headers = await getAuthHeader();

      const res = await supabase.functions.invoke('ai-qualificar-lead', {
        body: { lead_id: leadId },
        headers,
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
      const headers = await getAuthHeader();

      const res = await supabase.functions.invoke('ai-compor-mensagem', {
        body: params,
        headers,
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
      const headers = await getAuthHeader();

      const res = await supabase.functions.invoke('ai-decidir-acao', {
        body: { modo: 'batch' },
        headers,
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
