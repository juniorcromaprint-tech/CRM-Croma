// ============================================================================
// USE LEAD CONVERSATIONS — Croma Print ERP/CRM
// Hook para visão unificada de todas as conversas de um lead (email + WhatsApp)
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AgentConversation, AgentMessage, AgentCanal } from '../types/agent.types';

// ─── Query Keys ──────────────────────────────────────────────────────────────

const LEAD_AGENT_KEY = ['agent', 'lead'] as const;

function leadConversationsKey(leadId: string) {
  return [...LEAD_AGENT_KEY, leadId, 'conversations'] as const;
}

function leadTimelineKey(leadId: string) {
  return [...LEAD_AGENT_KEY, leadId, 'timeline'] as const;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LeadConversationGroup {
  canal: AgentCanal;
  conversations: AgentConversation[];
  totalEnviadas: number;
  totalRecebidas: number;
  ultimaAtividade: string | null;
}

export interface TimelineMessage extends AgentMessage {
  /** Canal da conversa de origem (pode diferir de message.canal em canais mistos) */
  conversa_canal: AgentCanal;
  conversa_etapa: string;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Busca TODAS as conversas do agente para um lead específico,
 * agrupadas por canal (email, whatsapp, interno).
 * Habilitado apenas quando leadId está presente.
 */
export function useLeadConversations(leadId: string | undefined) {
  return useQuery({
    queryKey: leadId ? leadConversationsKey(leadId) : ['agent', 'lead', 'disabled'],
    enabled: !!leadId,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<LeadConversationGroup[]> => {
      const { data, error } = await supabase
        .from('agent_conversations')
        .select(
          'id, lead_id, canal, status, etapa, mensagens_enviadas, mensagens_recebidas, ' +
          'ultima_mensagem_em, proximo_followup, tentativas, max_tentativas, ' +
          'score_engajamento, metadata, created_at, updated_at, ' +
          'leads(empresa, contato_nome, contato_email, segmento, temperatura, score)'
        )
        .eq('lead_id', leadId!)
        .order('updated_at', { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar conversas do lead: ${error.message}`);
      }

      const rows = (data ?? []) as AgentConversation[];

      // Agrupar por canal
      const groups = new Map<AgentCanal, AgentConversation[]>();
      for (const row of rows) {
        const canal = row.canal;
        if (!groups.has(canal)) {
          groups.set(canal, []);
        }
        groups.get(canal)!.push(row);
      }

      // Converter para array de grupos com stats agregados
      return Array.from(groups.entries()).map(([canal, conversations]) => {
        const totalEnviadas = conversations.reduce((sum, c) => sum + (c.mensagens_enviadas ?? 0), 0);
        const totalRecebidas = conversations.reduce((sum, c) => sum + (c.mensagens_recebidas ?? 0), 0);

        // Última atividade: a mais recente entre todas as conversas do canal
        const ultimaAtividade = conversations.reduce<string | null>((latest, c) => {
          if (!c.ultima_mensagem_em) return latest;
          if (!latest) return c.ultima_mensagem_em;
          return c.ultima_mensagem_em > latest ? c.ultima_mensagem_em : latest;
        }, null);

        return { canal, conversations, totalEnviadas, totalRecebidas, ultimaAtividade };
      });
    },
  });
}

/**
 * Busca TODAS as mensagens de TODAS as conversas de um lead,
 * em ordem cronológica — timeline unificada email + WhatsApp intercalados.
 * Habilitado apenas quando leadId está presente.
 */
export function useLeadTimeline(leadId: string | undefined) {
  return useQuery({
    queryKey: leadId ? leadTimelineKey(leadId) : ['agent', 'lead', 'timeline', 'disabled'],
    enabled: !!leadId,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<TimelineMessage[]> => {
      // 1. Buscar IDs de conversas do lead
      const { data: convData, error: convError } = await supabase
        .from('agent_conversations')
        .select('id, canal, etapa')
        .eq('lead_id', leadId!);

      if (convError) {
        throw new Error(`Erro ao buscar conversas: ${convError.message}`);
      }

      const conversations = convData ?? [];
      if (conversations.length === 0) return [];

      const conversationIds = conversations.map((c) => c.id);

      // Mapa: conversation_id → { canal, etapa }
      const convMeta = new Map<string, { canal: AgentCanal; etapa: string }>(
        conversations.map((c) => [c.id, { canal: c.canal as AgentCanal, etapa: c.etapa }])
      );

      // 2. Buscar mensagens de todas as conversas
      const { data: msgData, error: msgError } = await supabase
        .from('agent_messages')
        .select(
          'id, conversation_id, direcao, canal, conteudo, assunto, metadata, status, ' +
          'aprovado_por, aprovado_em, enviado_em, lido_em, respondido_em, erro_mensagem, ' +
          'custo_ia, modelo_ia, created_at'
        )
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: true });

      if (msgError) {
        throw new Error(`Erro ao buscar timeline: ${msgError.message}`);
      }

      // 3. Enriquecer com metadados da conversa de origem
      return (msgData ?? []).map((msg) => {
        const meta = convMeta.get(msg.conversation_id) ?? { canal: 'interno' as AgentCanal, etapa: 'abertura' };
        return {
          ...(msg as AgentMessage),
          conversa_canal: meta.canal,
          conversa_etapa: meta.etapa,
        };
      });
    },
  });
}
