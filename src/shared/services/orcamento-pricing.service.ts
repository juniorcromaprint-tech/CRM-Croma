// ============================================================================
// ORÇAMENTO PRICING SERVICE
// Ponte entre o Motor de Precificação Mubisys e o módulo de Orçamentos
// ============================================================================

import {
  calcPricing,
  DEFAULT_PRICING_CONFIG,
  type PricingConfig,
  type PricingResult,
} from "./pricing-engine";

// ─── Tipos do Orçamento ──────────────────────────────────────────────────────

export interface OrcamentoMaterial {
  material_id?: string | null;
  descricao: string;
  quantidade: number;
  unidade: string;
  custo_unitario: number;
}

export interface OrcamentoAcabamento {
  acabamento_id?: string | null;
  descricao: string;
  quantidade: number;
  custo_unitario: number;
}

export interface OrcamentoProcesso {
  etapa: string;
  tempo_minutos: number;
}

export interface OrcamentoItemInput {
  descricao: string;
  quantidade: number;
  largura_cm?: number | null;
  altura_cm?: number | null;
  materiais: OrcamentoMaterial[];
  acabamentos: OrcamentoAcabamento[];
  processos: OrcamentoProcesso[];
  markup_percentual: number;
}

export interface OrcamentoItemPricingResult {
  custoMP: number;
  custosAcabamentos: number;
  custoMO: number;
  custoTotal: number;
  precoUnitario: number;
  precoTotal: number;
  margemBruta: number;
  areaM2: number | null;
  precoM2: number | null;
  detalhes: PricingResult;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Calcula a área em m² a partir de cm
 */
export function calcAreaM2(largura_cm?: number | null, altura_cm?: number | null): number | null {
  if (!largura_cm || !altura_cm) return null;
  return (largura_cm / 100) * (altura_cm / 100);
}

/**
 * Precifica um item de orçamento usando o motor Mubisys
 * Incorpora materiais + acabamentos + processos
 */
export function calcOrcamentoItem(
  item: OrcamentoItemInput,
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
): OrcamentoItemPricingResult {
  const quantidade = item.quantidade || 1;
  const areaM2 = calcAreaM2(item.largura_cm, item.altura_cm);

  // Combina materiais da DB com acabamentos (são custos de MP)
  const materiais = [
    ...item.materiais.map((m) => ({
      nome: m.descricao,
      quantidade: m.quantidade,
      precoUnitario: m.custo_unitario,
    })),
    ...item.acabamentos.map((a) => ({
      nome: a.descricao,
      quantidade: a.quantidade,
      precoUnitario: a.custo_unitario,
    })),
  ];

  const processos = item.processos.map((p) => ({
    etapa: p.etapa,
    tempoMinutos: p.tempo_minutos,
  }));

  const pricingResult = calcPricing(
    { materiais, processos, markupPercentual: item.markup_percentual, quantidade },
    config,
  );

  const custosAcabamentos = item.acabamentos.reduce(
    (sum, a) => sum + a.quantidade * a.custo_unitario,
    0,
  );

  const precoTotal = pricingResult.precoVenda * quantidade;
  const precoM2 = areaM2 && areaM2 > 0 ? pricingResult.precoVenda / areaM2 : null;

  return {
    custoMP: pricingResult.custoMP - custosAcabamentos,
    custosAcabamentos,
    custoMO: pricingResult.custoMO,
    custoTotal: pricingResult.custoTotal,
    precoUnitario: pricingResult.precoVenda,
    precoTotal,
    margemBruta: pricingResult.margemBruta,
    areaM2,
    precoM2,
    detalhes: pricingResult,
  };
}

/**
 * Calcula o total de uma proposta a partir de seus itens
 */
export function calcOrcamentoTotal(
  itens: Array<{ preco_total: number; valor_total?: number }>,
  desconto_percentual: number = 0,
): { subtotal: number; desconto_valor: number; total: number } {
  const subtotal = itens.reduce(
    (sum, item) => sum + (item.preco_total ?? item.valor_total ?? 0),
    0,
  );
  const desconto_valor = subtotal * (desconto_percentual / 100);
  const total = subtotal - desconto_valor;
  return { subtotal, desconto_valor, total };
}

/**
 * Sugere markup com base na categoria do produto e regras cadastradas
 */
export function sugerirMarkup(
  categoria: string | null | undefined,
  regras: Array<{ tipo: string; categoria: string | null; valor: number }>,
): number {
  // Busca regra específica para a categoria
  const regraCat = regras.find(
    (r) => r.tipo === "markup_padrao" && r.categoria === categoria,
  );
  if (regraCat) return regraCat.valor;

  // Fallback: regra geral (categoria null)
  const regraGeral = regras.find(
    (r) => r.tipo === "markup_padrao" && !r.categoria,
  );
  if (regraGeral) return regraGeral.valor;

  return 40; // Default
}

/**
 * Valida se o markup é suficiente segundo as regras
 */
export function validarMarkup(
  markup: number,
  categoria: string | null | undefined,
  regras: Array<{ tipo: string; categoria: string | null; valor: number }>,
): { valido: boolean; markup_minimo: number; aviso: string | null } {
  const regraCat = regras.find(
    (r) => r.tipo === "markup_minimo" && r.categoria === categoria,
  );
  const regraGeral = regras.find(
    (r) => r.tipo === "markup_minimo" && !r.categoria,
  );

  const markup_minimo = regraCat?.valor ?? regraGeral?.valor ?? 25;
  const valido = markup >= markup_minimo;
  const aviso = valido ? null : `Markup abaixo do mínimo (${markup_minimo}%). Verifique com seu gestor.`;

  return { valido, markup_minimo, aviso };
}
