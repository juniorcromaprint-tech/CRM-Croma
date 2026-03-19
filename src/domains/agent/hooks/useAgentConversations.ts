import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AgentConversation, AgentConversationStatus, AgentCanal } from '../types/agent.types';

// ─── Query Keys ─────────────────────────────────────────────────────────────

const AGENT_KEY = ['agent'] as const;
const CONVERSATIONS_KEY = [...AGENT_KEY, 'conversations'] as const;

function conversationsQueryKey(filters?: { status?: AgentConversationStatus; canal?: AgentCanal }) {
  return filters ? [...CONVERSATIONS_KEY, 'list', filters] : [...CONVERSATIONS_KEY, 'list'];
}

const AGENT_STATS_KEY = [...AGENT_KEY, 'conversations', 'stats'] as const;

// ─── Select columns ──────────────────────────────────────────────────────────

const CONVERSATION_SELECT = `
  id, lead_id, canal, status, etapa, mensagens_enviadas, mensagens_recebidas,
  ultima_mensagem_em, proximo_followup, tentativas, max_tentativas,
  score_engajamento, created_at, updated_at,
  leads(empresa, contato_nome, contato_email, segmento, temperatura, score)
`.trim();

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgentStats {
  total: number;
  ativas: number;
  aguardando: number;
  convertidas: number;
  encerradas: number;
  totalEnviadas: number;
  totalRecebidas: number;
  taxaResposta: number;
  engajamentoMedio: number;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Lista conversas do agente com filtros opcionais por status e canal.
 * Ordenado por updated_at desc.
 */
export function useAgentConversations(filters?: {
  status?: AgentConversationStatus;
  canal?: AgentCanal;
}) {
  return useQuery({
    queryKey: conversationsQueryKey(filters),
    staleTime: 60 * 1000,
    queryFn: async (): Promise<AgentConversation[]> => {
      let query = supabase
        .from('agent_conversations')
        .select(CONVERSATION_SELECT)
        .order('updated_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.canal) {
        query = query.eq('canal', filters.canal);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar conversas do agente: ${error.message}`);
      }

      return (data ?? []) as AgentConversation[];
    },
  });
}

/**
 * Atalho: lista conversas aguardando aprovação humana.
 */
export function useAgentPendingApproval() {
  return useAgentConversations({ status: 'aguardando_aprovacao' });
}

/**
 * Estatísticas agregadas das conversas do agente.
 */
export function useAgentStats() {
  return useQuery({
    queryKey: AGENT_STATS_KEY,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<AgentStats> => {
      const { data, error } = await supabase
        .from('agent_conversations')
        .select(
          'status, mensagens_enviadas, mensagens_recebidas, score_engajamento'
        );

      if (error) {
        throw new Error(`Erro ao buscar estatísticas do agente: ${error.message}`);
      }

      const rows = (data ?? []) as Pick<
        AgentConversation,
        'status' | 'mensagens_enviadas' | 'mensagens_recebidas' | 'score_engajamento'
      >[];

      const total = rows.length;
      const ativas = rows.filter((r) => r.status === 'ativa').length;
      const aguardando = rows.filter((r) => r.status === 'aguardando_aprovacao').length;
      const convertidas = rows.filter((r) => r.status === 'convertida').length;
      const encerradas = rows.filter((r) => r.status === 'encerrada').length;

      const totalEnviadas = rows.reduce((sum, r) => sum + (r.mensagens_enviadas ?? 0), 0);
      const totalRecebidas = rows.reduce((sum, r) => sum + (r.mensagens_recebidas ?? 0), 0);

      const taxaResposta =
        totalEnviadas > 0 ? Math.round((totalRecebidas / totalEnviadas) * 100) : 0;

      const engajamentoMedio =
        total > 0
          ? Math.round(
              rows.reduce((sum, r) => sum + (r.score_engajamento ?? 0), 0) / total
            )
          : 0;

      return {
        total,
        ativas,
        aguardando,
        convertidas,
        encerradas,
        totalEnviadas,
        totalRecebidas,
        taxaResposta,
        engajamentoMedio,
      };
    },
  });
}
