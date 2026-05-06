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

// ─── Helper: busca TODOS os rows em chunks de 1000 (bypass max_rows) ────────

const PAGE_CHUNK = 1000;

async function fetchAllRows<T = Record<string, unknown>>(
  buildQuery: () => ReturnType<ReturnType<typeof supabase['from']>['select']>,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await buildQuery().range(offset, offset + PAGE_CHUNK - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < PAGE_CHUNK) break;   // última página
    offset += PAGE_CHUNK;
  }
  return all;
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

// ─── Hook principal: lista paginada ──────────────────────────────────────────

export interface UseLeadsDisparoOptions {
  page?: number;     // 1-based
  pageSize?: number; // default 50
  enabled?: boolean;
}

export function useLeadsDisparo(
  filters: LeadsFilterState,
  options: UseLeadsDisparoOptions = {},
) {
  const page     = options.page     ?? 1;
  const pageSize = options.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to   = from + pageSize - 1;

  return useQuery({
    queryKey: ['leads-disparo', filters, page, pageSize],
    queryFn: async (): Promise<LeadsDisparoPage> => {
      let q: any = supabase
        .from('vw_leads_disparo')
        .select('*', { count: 'exact' });

      q = applyFilters(q, filters);
      q = q.order('created_at', { ascending: false }).range(from, to);

      const { data, error, count } = await q;
      if (error) throw error;
      return {
        data: (data ?? []) as LeadDisparo[],
        totalCount: count ?? 0,
        page,
        pageSize,
      };
    },
    staleTime: 30_000,
    enabled: options.enabled ?? true,
  });
}

// ─── Counts por sub-segmento (para SegmentoPills) ────────────────────────────
// Aplica todos os filtros EXCETO subSegmentos — assim cada pill mostra
// quantos leads cairiam ali se Junior trocasse o sub-segmento.

export function useLeadsDisparoCountsBySub(filters: LeadsFilterState) {
  return useQuery({
    queryKey: ['leads-disparo-counts-by-sub', { ...filters, subSegmentos: undefined }],
    queryFn: async () => {
      const rows = await fetchAllRows<{ sub_segmento: string | null }>(() => {
        let q: any = supabase
          .from('vw_leads_disparo')
          .select('sub_segmento');
        q = applyFilters(q, filters, ['subSegmentos']);
        return q;
      });

      const counts: Record<string, number> = {};
      let semSub = 0;
      let total = 0;
      for (const row of rows) {
        total++;
        if (row.sub_segmento) {
          counts[row.sub_segmento] = (counts[row.sub_segmento] ?? 0) + 1;
        } else {
          semSub++;
        }
      }
      return { counts, semSub, total };
    },
    staleTime: 60_000,
  });
}

// ─── Counts por segmento (para barra superior de segmentos) ──────────────────

export function useLeadsDisparoCountsBySegmento(filters: LeadsFilterState) {
  return useQuery({
    queryKey: ['leads-disparo-counts-by-segmento', { ...filters, segmentos: undefined, subSegmentos: undefined }],
    queryFn: async () => {
      const rows = await fetchAllRows<{ segmento: string | null }>(() => {
        let q: any = supabase
          .from('vw_leads_disparo')
          .select('segmento');
        q = applyFilters(q, filters, ['segmentos', 'subSegmentos']);
        return q;
      });

      const counts: Record<string, number> = {};
      let total = 0;
      for (const row of rows) {
        total++;
        if (row.segmento) {
          counts[row.segmento] = (counts[row.segmento] ?? 0) + 1;
        }
      }
      return { counts, total };
    },
    staleTime: 60_000,
  });
}

// ─── Status da campanha em andamento (para CampanhaBanner) ───────────────────
// Resolve métricas de mensagens enviadas hoje (qualquer canal whatsapp),
// total de leads do segmento informado, e infere "dia da rampa" pela
// primeira mensagem aprovada do segmento.

export interface CampanhaStatus {
  totalLeads: number;
  totalDisparados: number;        // leads que JÁ entraram numa conversa
  enviadasHoje: number;           // agent_messages enviadas hoje (canal whatsapp)
  diaDaRampa: number | null;      // 1, 2, 3...; null se ainda não houve disparo
  limiteDiarioAtual: number;      // calculado pelo backend via fn_calcular_limite_diario()
  totalEnfileiradas: number;      // mensagens 'aprovada' aguardando envio
  janelas: [string, string][];    // janelas BRT do agent_config (fonte real do backend)
}

export function useCampanhaStatus(segmento = 'seguranca') {
  return useQuery<CampanhaStatus>({
    queryKey: ['campanha-status', segmento],
    queryFn: async () => {
      // 1. Total de leads do segmento (não bloqueados)
      const { count: totalLeads } = await supabase
        .from('vw_leads_disparo')
        .select('id', { count: 'exact', head: true })
        .eq('segmento', segmento)
        .eq('bloqueado_disparo', false);

      // 2. Total disparados — leads do segmento que já têm conversa
      const { count: totalDisparados } = await supabase
        .from('vw_leads_disparo')
        .select('id', { count: 'exact', head: true })
        .eq('segmento', segmento)
        .or('em_conversa_ativa.eq.true,ultima_conversa_em.not.is.null');

      // 3. Mensagens enviadas hoje (canal whatsapp)
      const inicioHoje = new Date();
      inicioHoje.setHours(0, 0, 0, 0);

      const { count: enviadasHoje } = await supabase
        .from('agent_messages')
        .select('id', { count: 'exact', head: true })
        .eq('canal', 'whatsapp')
        .eq('status', 'enviada')
        .gte('enviado_em', inicioHoje.toISOString());

      // 4. Mensagens enfileiradas (aprovada, aguardando)
      const { count: totalEnfileiradas } = await supabase
        .from('agent_messages')
        .select('id', { count: 'exact', head: true })
        .eq('canal', 'whatsapp')
        .eq('status', 'aprovada');

      // 5. Dia da rampa — dias corridos desde 1ª mensagem WA enviada
      const { data: primeiraMsg } = await supabase
        .from('agent_messages')
        .select('enviado_em')
        .eq('canal', 'whatsapp')
        .eq('status', 'enviada')
        .order('enviado_em', { ascending: true })
        .limit(1)
        .maybeSingle();

      let diaDaRampa: number | null = null;
      if (primeiraMsg?.enviado_em) {
        const inicio = new Date(primeiraMsg.enviado_em);
        inicio.setHours(0, 0, 0, 0);
        const diff = Math.floor(
          (inicioHoje.getTime() - inicio.getTime()) / 86_400_000
        );
        diaDaRampa = diff + 1;
      }

      // 6. Limite diário — FONTE ÚNICA: backend RPC fn_calcular_limite_diario()
      //    O backend usa esse mesmo cálculo no dispatch-approved-messages.
      //    Frontend apenas reflete a regra real, não recalcula.
      let limiteDiarioAtual = 15; // fallback
      try {
        const { data: limiteRpc } = await supabase.rpc('fn_calcular_limite_diario');
        if (typeof limiteRpc === 'number' && limiteRpc > 0) {
          limiteDiarioAtual = limiteRpc;
        }
      } catch {
        // Fallback heurístico se RPC indisponível (mantém compatibilidade)
        limiteDiarioAtual = diaDaRampa == null || diaDaRampa <= 2 ? 15 : diaDaRampa <= 5 ? 30 : 60;
      }

      // 7. Janelas BRT — lê do agent_config (fonte real do backend)
      let janelas: [string, string][] = [['09:00', '12:00'], ['14:00', '17:00']]; // fallback
      try {
        const { data: cfgRow } = await supabase
          .from('admin_config')
          .select('valor')
          .eq('chave', 'agent_config')
          .single();
        const cfg = (cfgRow?.valor && typeof cfgRow.valor === 'object'
          ? cfgRow.valor
          : typeof cfgRow?.valor === 'string'
            ? JSON.parse(cfgRow.valor)
            : {}) as Record<string, unknown>;
        if (Array.isArray(cfg.horarios) && cfg.horarios.length > 0) {
          janelas = cfg.horarios as [string, string][];
        }
      } catch { /* usa fallback */ }

      return {
        totalLeads:          totalLeads          ?? 0,
        totalDisparados:     totalDisparados     ?? 0,
        enviadasHoje:        enviadasHoje        ?? 0,
        totalEnfileiradas:   totalEnfileiradas   ?? 0,
        diaDaRampa,
        limiteDiarioAtual,
        janelas,
      };
    },
    staleTime: 60_000,
  });
}

// ─── Helper antigo: valores únicos para dropdowns (mantido p/ compat) ────────

export function useLeadsDisparoMeta() {
  return useQuery({
    queryKey: ['leads-disparo-meta'],
    queryFn: async () => {
      type MetaRow = {
        segmento: string | null;
        sub_segmento: string | null;
        origem_nome: string | null;
        status: string | null;
        temperatura: string | null;
        estado: string | null;
        regiao: string | null;
        cidade: string | null;
      };

      const rows = await fetchAllRows<MetaRow>(() =>
        supabase
          .from('vw_leads_disparo')
          .select('segmento, sub_segmento, origem_nome, status, temperatura, estado, regiao, cidade') as any,
      );

      const uniq = <T,>(arr: (T | null)[]): T[] =>
        [...new Set(arr.filter((x): x is T => x !== null && (x as any) !== ''))] as T[];
      return {
        segmentos:    uniq(rows.map(r => r.segmento)),
        subSegmentos: uniq(rows.map(r => r.sub_segmento)),
        origens:      uniq(rows.map(r => r.origem_nome)),
        status:       uniq(rows.map(r => r.status)),
        temperaturas: uniq(rows.map(r => r.temperatura)),
        estados:      uniq(rows.map(r => r.estado)),
        regioes:      uniq(rows.map(r => r.regiao)),
        cidades:      uniq(rows.map(r => r.cidade)),
      };
    },
    staleTime: 5 * 60_000,
  });
}
