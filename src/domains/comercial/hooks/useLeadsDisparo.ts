// src/domains/comercial/hooks/useLeadsDisparo.ts
// Hooks de query para vw_leads_disparo: lista paginada, counts por sub-segmento
// e status da campanha em andamento.
// Fonte: PLANO-DISPAROS-PROSPECCAO.md seções 6.2 e redesign UX 2026-05-04L

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LeadsFilterState {
  segmentos?: string[];
  subSegmentos?: string[];
  origens?: string[];
  status?: string[];
  temperaturas?: string[];
  estados?: string[];
  regioes?: string[];
  cidades?: string[];
  temTelefone?: boolean | null;       // true | false | null (qualquer)
  temEmail?: boolean | null;
  emConversaAtiva?: boolean | null;
  scoreMin?: number;
  scoreMax?: number;
  vendedorId?: string | null;
  cadastroDe?: string;                // ISO date string
  cadastroAte?: string;
  excluirBloqueados?: boolean;        // default true
  busca?: string;
}

export type LeadDisparo = {
  id: string;
  empresa: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
  email: string | null;
  telefone: string | null;
  segmento: string | null;
  status: string | null;
  temperatura: string | null;
  score: number | null;
  valor_estimado: number | null;
  observacoes: string | null;
  cargo: string | null;
  vendedor_id: string | null;
  created_at: string;
  updated_at: string;
  origem_id: string | null;
  origem_nome: string | null;
  sub_segmento: string | null;
  cidade: string | null;
  estado: string | null;
  regiao: string | null;
  tem_telefone_valido: boolean;
  tem_email_valido: boolean;
  bloqueado_disparo: boolean;
  em_conversa_ativa: boolean;
  ultima_conversa_em: string | null;
};

export interface LeadsDisparoPage {
  data: LeadDisparo[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// ─── Helper: aplica todos os filtros menos os listados em `excluir` ──────────

function applyFilters(
  q: ReturnType<typeof supabase['from']> extends (...a: any) => infer R ? R : never,
  filters: LeadsFilterState,
  excluir: Array<keyof LeadsFilterState> = [],
) {
  const skip = new Set(excluir);

  if (!skip.has('segmentos')    && filters.segmentos?.length)    q = q.in('segmento',     filters.segmentos);
  if (!skip.has('subSegmentos') && filters.subSegmentos?.length) q = q.in('sub_segmento', filters.subSegmentos);
  if (!skip.has('origens')      && filters.origens?.length)      q = q.in('origem_nome',  filters.origens);
  if (!skip.has('status')       && filters.status?.length)       q = q.in('status',       filters.status);
  if (!skip.has('temperaturas') && filters.temperaturas?.length) q = q.in('temperatura',  filters.temperaturas);
  if (!skip.has('estados')      && filters.estados?.length)      q = q.in('estado',       filters.estados);
  if (!skip.has('regioes')      && filters.regioes?.length)      q = q.in('regiao',       filters.regioes);
  if (!skip.has('cidades')      && filters.cidades?.length)      q = q.in('cidade',       filters.cidades);

  if (!skip.has('temTelefone')) {
    if (filters.temTelefone === true)  q = q.eq('tem_telefone_valido', true);
    if (filters.temTelefone === false) q = q.eq('tem_telefone_valido', false);
  }
  if (!skip.has('temEmail')) {
    if (filters.temEmail === true)  q = q.eq('tem_email_valido', true);
    if (filters.temEmail === false) q = q.eq('tem_email_valido', false);
  }
  if (!skip.has('emConversaAtiva')) {
    if (filters.emConversaAtiva === true)  q = q.eq('em_conversa_ativa', true);
    if (filters.emConversaAtiva === false) q = q.eq('em_conversa_ativa', false);
  }

  if (!skip.has('scoreMin')   && filters.scoreMin   != null) q = q.gte('score', filters.scoreMin);
  if (!skip.has('scoreMax')   && filters.scoreMax   != null) q = q.lte('score', filters.scoreMax);
  if (!skip.has('vendedorId') && filters.vendedorId)         q = q.eq('vendedor_id', filters.vendedorId);
  if (!skip.has('cadastroDe') && filters.cadastroDe)         q = q.gte('created_at', filters.cadastroDe);
  if (!skip.has('cadastroAte')&& filters.cadastroAte)        q = q.lte('created_at', filters.cadastroAte);

  if (!skip.has('excluirBloqueados') && filters.excluirBloqueados !== false) {
    q = q.eq('bloqueado_disparo', false);
  }

  if (!skip.has('busca') && filters.busca) {
    const b = filters.busca.trim().replace(/[%_]/g, ''); // sanitização leve
    if (b) {
      q = q.or(
        `empresa.ilike.%${b}%,contato_nome.ilike.%${b}%,contato_telefone.ilike.%${b}%`
      );
    }
  }

  return q;
}

// ─── Hook principal: lista paginada ────────────────────────────────────────�