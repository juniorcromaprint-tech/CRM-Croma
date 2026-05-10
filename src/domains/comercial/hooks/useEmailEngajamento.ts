// src/domains/comercial/hooks/useEmailEngajamento.ts
// Consulta a view vw_email_engajamento_leads (migration 154) para mostrar
// tracking de email (sent/delivered/opened/clicked/bounced) por lead.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EmailEngajamentoRow {
  lead_id: string;
  empresa: string | null;
  contato_nome: string | null;
  contato_email: string | null;
  message_id: string;
  assunto: string | null;
  data_envio: string | null;
  enviado_em: string | null;
  delivery_status: string | null;
  resend_id: string | null;
  entregue_em: string | null;
  abriu_em: string | null;
  clicou_em: string | null;
  bounced_em: string | null;
  reclamado_em: string | null;
  qtd_opens: number;
  qtd_clicks: number;
  ultimo_evento_em: string | null;
  ultimo_evento_tipo: string | null;
  campanha: string | null;
  template_id: string | null;
}

/**
 * Resumo de engajamento (último/mais relevante evento) por lead.
 * Útil pra mostrar 1 badge por lead na lista.
 */
export interface EmailEngajamentoResumo {
  lead_id: string;
  ultimo_status: 'clicked' | 'opened' | 'delivered' | 'bounced' | 'complained' | 'enviada' | 'erro' | null;
  ultimo_em: string | null;
  qtd_opens: number;
  qtd_clicks: number;
  total_msgs: number;
}

function pickStatus(row: EmailEngajamentoRow): EmailEngajamentoResumo['ultimo_status'] {
  // Prioridade: clicked > opened > bounced > delivered > sent
  if (row.clicou_em) return 'clicked';
  if (row.abriu_em) return 'opened';
  if (row.bounced_em) return 'bounced';
  if (row.reclamado_em) return 'complained';
  if (row.entregue_em) return 'delivered';
  if (row.enviado_em) return 'enviada';
  if (row.delivery_status === 'erro') return 'erro';
  return null;
}

/**
 * Hook detalhado: TODAS as mensagens de email de UM lead (timeline).
 */
export function useEmailEngajamentoLead(leadId: string | undefined) {
  return useQuery({
    queryKey: ['email-engajamento', 'lead', leadId],
    enabled: !!leadId,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<EmailEngajamentoRow[]> => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('vw_email_engajamento_leads')
        .select('*')
        .eq('lead_id', leadId)
        .order('data_envio', { ascending: false });
      if (error) throw error;
      return (data ?? []) as EmailEngajamentoRow[];
    },
  });
}

/**
 * Hook agregado: resumo (1 linha por lead) pra LISTA de leads.
 * Pega só a mensagem mais recente de cada lead.
 */
export function useEmailEngajamentoLeads(leadIds: string[]) {
  return useQuery({
    queryKey: ['email-engajamento', 'leads-resumo', leadIds.slice().sort()],
    enabled: leadIds.length > 0,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Map<string, EmailEngajamentoResumo>> => {
      if (leadIds.length === 0) return new Map();
      const { data, error } = await supabase
        .from('vw_email_engajamento_leads')
        .select('*')
        .in('lead_id', leadIds)
        .order('data_envio', { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as EmailEngajamentoRow[];
      // Agrega por lead — pega a mensagem mais recente + soma opens/clicks
      const map = new Map<string, EmailEngajamentoResumo>();
      for (const row of rows) {
        const existing = map.get(row.lead_id);
        if (!existing) {
          map.set(row.lead_id, {
            lead_id: row.lead_id,
            ultimo_status: pickStatus(row),
            ultimo_em: row.ultimo_evento_em ?? row.data_envio,
            qtd_opens: row.qtd_opens ?? 0,
            qtd_clicks: row.qtd_clicks ?? 0,
            total_msgs: 1,
          });
        } else {
          existing.total_msgs += 1;
          existing.qtd_opens += (row.qtd_opens ?? 0);
          existing.qtd_clicks += (row.qtd_clicks ?? 0);
        }
      }
      return map;
    },
  });
}

/**
 * Hook agregado por campanha (métricas pro CampanhaBanner).
 */
export function useEmailCampanhaStats() {
  return useQuery({
    queryKey: ['email-campanha-stats'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_email_engajamento_leads')
        .select('enviado_em, entregue_em, abriu_em, clicou_em, bounced_em, reclamado_em, qtd_opens, qtd_clicks')
        .gte('data_envio', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        enviado_em: string | null; entregue_em: string | null;
        abriu_em: string | null; clicou_em: string | null;
        bounced_em: string | null; reclamado_em: string | null;
        qtd_opens: number; qtd_clicks: number;
      }>;
      return {
        enviados:   rows.filter(r => r.enviado_em).length,
        entregues:  rows.filter(r => r.entregue_em).length,
        abertos:    rows.filter(r => r.abriu_em).length,
        clicaram:   rows.filter(r => r.clicou_em).length,
        bounces:    rows.filter(r => r.bounced_em).length,
        reclamacoes:rows.filter(r => r.reclamado_em).length,
        total_opens:  rows.reduce((s, r) => s + (r.qtd_opens ?? 0), 0),
        total_clicks: rows.reduce((s, r) => s + (r.qtd_clicks ?? 0), 0),
      };
    },
  });
}
