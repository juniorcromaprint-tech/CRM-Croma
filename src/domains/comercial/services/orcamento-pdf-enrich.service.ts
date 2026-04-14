// ============================================================================
// orcamento-pdf-enrich.service.ts
// ============================================================================
// Enriquece um Orcamento com dados reais para renderizacao em PDF multi-modo
// (cliente / producao / tecnico). Busca:
//  - vendedor (nome completo via profiles)
//  - percentual e valor de comissao do vendedor
//  - comissao externa (pct e valor) + se eh absorvida
//  - processos por item (etapa + tempo em minutos) para o modo 'producao'
// ============================================================================

import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_PRICING_CONFIG } from '@/shared/services/pricing-engine';

async function fetchPercentualComissaoAtivo(): Promise<number> {
  try {
    const { data } = await supabase
      .from('config_precificacao')
      .select('percentual_comissao')
      .eq('ativo', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const pct = (data as { percentual_comissao?: number } | null)?.percentual_comissao;
    if (typeof pct === 'number' && pct > 0) return pct;
  } catch {
    // silencioso: cai no default
  }
  return DEFAULT_PRICING_CONFIG.percentualComissao;
}

export interface ProcessoItemPDF {
  etapa: string;
  tempo_minutos: number;
  ordem: number;
}

export interface OrcamentoEnriquecidoPDF {
  vendedor_nome: string | null;
  vendedor_comissao_pct: number | null;
  vendedor_comissao_valor: number | null;
  comissao_externa_pct: number | null;
  comissao_externa_valor: number | null;
  comissao_externa_nome: string | null;
  absorver_comissao: boolean;
  /** Processos agrupados por proposta_item_id */
  processos_por_item: Record<string, ProcessoItemPDF[]>;
  /** Tempo total em minutos somando todos os itens */
  tempo_producao_total_min: number;
  /** Tempo total agregado por etapa */
  tempo_por_etapa: Record<string, number>;
}

export async function enriquecerOrcamentoParaPDF(orc: {
  id: string;
  vendedor_id: string | null;
  total: number;
  itens: { id: string }[];
}): Promise<OrcamentoEnriquecidoPDF> {
  const result: OrcamentoEnriquecidoPDF = {
    vendedor_nome: null,
    vendedor_comissao_pct: null,
    vendedor_comissao_valor: null,
    comissao_externa_pct: null,
    comissao_externa_valor: null,
    comissao_externa_nome: null,
    absorver_comissao: false,
    processos_por_item: {},
    tempo_producao_total_min: 0,
    tempo_por_etapa: {},
  };

  // 1) Buscar propostas com dados de comissao + vendedor profile
  const { data: proposta } = await supabase
    .from('propostas')
    .select('vendedor_id, comissao_externa_pct, comissionado_externo_id, absorver_comissao, total')
    .eq('id', orc.id)
    .maybeSingle();

  if (proposta) {
    result.absorver_comissao = !!proposta.absorver_comissao;
    result.comissao_externa_pct = proposta.comissao_externa_pct ?? null;
  }

  // 2) Nome do vendedor (via profiles)
  if (orc.vendedor_id) {
    const { data: vendedor } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', orc.vendedor_id)
      .maybeSingle();
    if (vendedor) {
      const nome = [vendedor.first_name, vendedor.last_name].filter(Boolean).join(' ').trim();
      result.vendedor_nome = nome || null;
    }
  }

  // 3) Nome do comissionado externo
  if (proposta?.comissionado_externo_id) {
    const { data: ext } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', proposta.comissionado_externo_id)
      .maybeSingle();
    if (ext) {
      const nome = [ext.first_name, ext.last_name].filter(Boolean).join(' ').trim();
      result.comissao_externa_nome = nome || null;
    }
  }

  // 4) Percentual de comissao do vendedor: config_precificacao ativa ou default
  result.vendedor_comissao_pct = await fetchPercentualComissaoAtivo();

  // 5) Calcula valores em R$
  const valorBase = orc.total ?? 0;
  if (result.vendedor_comissao_pct != null && valorBase > 0) {
    result.vendedor_comissao_valor = +((valorBase * result.vendedor_comissao_pct) / 100).toFixed(2);
  }
  if (result.comissao_externa_pct != null && valorBase > 0) {
    result.comissao_externa_valor = +((valorBase * result.comissao_externa_pct) / 100).toFixed(2);
  }

  // 6) Processos por item
  const itemIds = orc.itens.map((i) => i.id);
  if (itemIds.length > 0) {
    const { data: processos } = await supabase
      .from('proposta_item_processos')
      .select('proposta_item_id, etapa, tempo_minutos, ordem')
      .in('proposta_item_id', itemIds)
      .order('ordem', { ascending: true });

    if (processos) {
      for (const p of processos) {
        const id = p.proposta_item_id as string;
        if (!result.processos_por_item[id]) result.processos_por_item[id] = [];
        const tempo = Number(p.tempo_minutos) || 0;
        result.processos_por_item[id].push({
          etapa: p.etapa ?? 'Outro',
          tempo_minutos: tempo,
          ordem: p.ordem ?? 0,
        });
        result.tempo_producao_total_min += tempo;
        result.tempo_por_etapa[p.etapa ?? 'Outro'] =
          (result.tempo_por_etapa[p.etapa ?? 'Outro'] || 0) + tempo;
      }
    }
  }

  return result;
}

/** Formata minutos como "X h Ymin" */
export function formatMinutos(min: number): string {
  if (!min || min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}
