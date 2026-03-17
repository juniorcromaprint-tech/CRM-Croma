/**
 * precificacao.types.ts
 * Tipos TypeScript para o motor de precificação — refletem o schema real do banco.
 * Gerado em 2026-03-17 a partir de information_schema.columns.
 */

// ---------------------------------------------------------------------------
// Componentes de custo
// ---------------------------------------------------------------------------

/** 10 componentes de custo usados no PricingBreakdown visual */
export type ComponenteCusto =
  | 'MP'   // Matéria Prima
  | 'CF'   // Custos Fixos
  | 'MO'   // Mão de Obra
  | 'TF'   // Taxa Financeira
  | 'CI'   // Custo de Impressão
  | 'CE'   // Custo de Equipamento
  | 'TB'   // Taxa de Benefício
  | 'TR'   // Taxa de Retrabalho
  | 'DT'   // Desconto Tardio
  | 'ML';  // Margem Líquida

export const COMPONENTE_CORES: Record<ComponenteCusto, string> = {
  MP: 'bg-blue-500',
  CF: 'bg-slate-500',
  MO: 'bg-amber-500',
  TF: 'bg-purple-500',
  CI: 'bg-cyan-500',
  CE: 'bg-orange-500',
  TB: 'bg-teal-500',
  TR: 'bg-rose-500',
  DT: 'bg-indigo-500',
  ML: 'bg-emerald-500',
};

export const COMPONENTE_LABELS: Record<ComponenteCusto, string> = {
  MP: 'Matéria Prima',
  CF: 'Custos Fixos',
  MO: 'Mão de Obra',
  TF: 'Taxa Financeira',
  CI: 'Custo de Impressão',
  CE: 'Custo de Equipamento',
  TB: 'Taxa de Benefício',
  TR: 'Taxa de Retrabalho',
  DT: 'Desconto Tardio',
  ML: 'Margem Líquida',
};

export interface ComponenteBreakdown {
  componente: ComponenteCusto;
  valor: number;
  percentual: number;
}

export interface PrecificacaoBreakdown {
  precoVenda: number;
  custoTotal: number;
  margemBruta: number;
  componentes: ComponenteBreakdown[];
}

// ---------------------------------------------------------------------------
// regras_precificacao
// Campos reais no banco (verificado em 2026-03-17):
//   id, categoria, markup_minimo, markup_sugerido, markup_maximo, descricao,
//   ativo, criado_por, created_at, updated_at, desconto_maximo, preco_m2_minimo,
//   taxa_urgencia, aproveitamento_padrao, pct_cf_override, pct_mo_override,
//   pct_tf_override, custo_ci_m2, custo_ce_hora, pct_tb, pct_tr, pct_dt,
//   margem_minima_pct
// NOTA: "markup_maximo" existe no banco (a spec original não previa este campo).
//       "descricao" e "criado_por" também existem.
// ---------------------------------------------------------------------------
export interface RegrasPrecificacao {
  id: string;
  categoria: string;
  markup_minimo: number;
  markup_sugerido: number;
  /** Campo extra presente no banco — não estava na spec original */
  markup_maximo: number | null;
  /** Descrição textual da regra */
  descricao: string | null;
  ativo: boolean;
  /** UUID do usuário que criou a regra */
  criado_por: string | null;
  created_at: string;
  updated_at: string;
  // Campos de controle de preço
  desconto_maximo: number | null;
  preco_m2_minimo: number | null;
  taxa_urgencia: number | null;
  aproveitamento_padrao: number | null;
  // 10 componentes override (null = usa valor global de config_precificacao)
  pct_cf_override: number | null;
  pct_mo_override: number | null;
  pct_tf_override: number | null;
  custo_ci_m2: number | null;
  custo_ce_hora: number | null;
  pct_tb: number | null;
  pct_tr: number | null;
  pct_dt: number | null;
  margem_minima_pct: number | null;
}

// ---------------------------------------------------------------------------
// config_precificacao
// Campos reais no banco (verificado em 2026-03-17):
//   id, faturamento_medio, custo_operacional, custo_produtivo, qtd_funcionarios,
//   horas_mes, percentual_comissao, percentual_impostos, percentual_juros,
//   updated_at, atualizado_por, vigencia_inicio, ativo, created_at,
//   percentual_encargos
// NOTA: "atualizado_por", "vigencia_inicio", "ativo" e "created_at" existem no
//       banco mas não estavam na spec original.
// ---------------------------------------------------------------------------
export interface ConfigPrecificacao {
  id: string;
  faturamento_medio: number;
  custo_operacional: number;
  custo_produtivo: number;
  qtd_funcionarios: number;
  horas_mes: number;
  percentual_comissao: number;
  percentual_impostos: number;
  percentual_juros: number;
  percentual_encargos: number;
  /** UUID do usuário que atualizou o registro */
  atualizado_por: string | null;
  /** Data de início da vigência desta configuração */
  vigencia_inicio: string | null;
  ativo: boolean | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Entradas e saídas do motor de precificação
// ---------------------------------------------------------------------------

export interface PrecificacaoItemInput {
  modelo_id: string;
  quantidade: number;
  largura_cm?: number;
  altura_cm?: number;
  markup_percentual?: number;
}

export interface PrecificacaoItemResult {
  precoUnitario: number;
  precoTotal: number;
  margemBruta: number;
  breakdown: PrecificacaoBreakdown;
  markup_usado: number;
  regra_categoria: string | null;
}
