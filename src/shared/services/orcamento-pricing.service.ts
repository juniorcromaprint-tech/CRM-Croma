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
  aproveitamento?: number; // 0-100, default 100
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

// ─── Tipos de Precificação ───────────────────────────────────────────────────

// Interface correta para a tabela regras_precificacao (migration 007)
export interface RegraPrecificacao {
  id?: string
  categoria: string
  markup_minimo: number
  markup_sugerido: number
  desconto_maximo?: number | null
  preco_m2_minimo?: number | null
  taxa_urgencia?: number | null
  ativo?: boolean
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

  // Apenas materiais entram no motor Mubisys (acabamentos são calculados separado)
  const materiaisParaMotor = item.materiais.map((m) => {
    const aproveitamento = (m.aproveitamento ?? 100) / 100;
    const quantidadeReal = aproveitamento > 0 ? m.quantidade / aproveitamento : m.quantidade;
    return {
      nome: m.descricao,
      quantidade: quantidadeReal,
      precoUnitario: m.custo_unitario,
    };
  });

  const processos = item.processos.map((p) => ({
    etapa: p.etapa,
    tempoMinutos: p.tempo_minutos,
  }));

  // Motor Mubisys processa APENAS materiais + processos — retorna preço UNITÁRIO
  const pricingResult = calcPricing(
    { materiais: materiaisParaMotor, processos, markupPercentual: item.markup_percentual },
    config,
  );

  // Acabamentos calculados SEPARADO do motor, sem overhead Mubisys adicional
  const custoAcabamentos = item.acabamentos.reduce(
    (sum, a) => sum + a.quantidade * a.custo_unitario,
    0,
  );

  // Preço unitário = resultado unitário do motor + acabamentos
  const precoUnitario = pricingResult.precoVenda + custoAcabamentos;

  // Preço total = preço unitário × quantidade (ÚNICA multiplicação por quantidade)
  const precoTotal = precoUnitario * quantidade;

  const precoM2 = areaM2 && areaM2 > 0 ? precoUnitario / areaM2 : null;

  const custoTotalUnitario = (pricingResult.custoTotal ?? 0) + custoAcabamentos;

  return {
    custoMP: pricingResult.custoMP,
    custosAcabamentos: custoAcabamentos,
    custoMO: pricingResult.custoMO,
    custoTotal: custoTotalUnitario,
    precoUnitario,
    precoTotal,
    margemBruta: precoUnitario > 0
      ? ((precoUnitario - custoTotalUnitario) / precoUnitario) * 100
      : 0,
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
  regras: RegraPrecificacao[],
): number {
  const ativas = regras.filter(r => r.ativo !== false)
  // Busca regra específica para a categoria
  const especifica = ativas.find(r => r.categoria === categoria)
  if (especifica) return especifica.markup_sugerido

  // Fallback: regra geral
  const geral = ativas.find(r => r.categoria === 'geral')
  if (geral) return geral.markup_sugerido

  return 40; // Default
}

/**
 * Valida se o markup é suficiente segundo as regras
 */
export function validarMarkup(
  markup: number,
  categoria: string | null | undefined,
  regras: RegraPrecificacao[],
): { valido: boolean; markup_minimo: number; aviso: string | null } {
  const ativas = regras.filter(r => r.ativo !== false)
  const regra = ativas.find(r => r.categoria === categoria) ?? ativas.find(r => r.categoria === 'geral')
  const markup_minimo = regra?.markup_minimo ?? 25
  const valido = markup >= markup_minimo
  const aviso = valido ? null : `Markup abaixo do mínimo (${markup_minimo}%). Verifique com seu gestor.`

  return { valido, markup_minimo, aviso };
}

/**
 * Valida desconto contra a regra da categoria.
 * Retorna se é válido + info para workflow de aprovação.
 */
export function validarDesconto(
  desconto_percentual: number,
  categoria: string | null | undefined,
  regras: RegraPrecificacao[],
  subtotal: number,
): {
  valido: boolean;
  desconto_maximo: number;
  requer_aprovacao: boolean;
  aviso: string | null;
} {
  const ativas = regras.filter(r => r.ativo !== false);
  const regra = ativas.find(r => r.categoria === categoria) ?? ativas.find(r => r.categoria === 'geral');
  const desconto_maximo = regra?.desconto_maximo ?? 10;

  if (desconto_percentual <= 0) {
    return { valido: true, desconto_maximo, requer_aprovacao: false, aviso: null };
  }

  if (desconto_percentual > desconto_maximo) {
    return {
      valido: false,
      desconto_maximo,
      requer_aprovacao: true,
      aviso: `Desconto de ${desconto_percentual}% excede o máximo permitido (${desconto_maximo}%). Requer aprovação do gestor.`,
    };
  }

  // Desconto alto mas dentro do limite — alerta informativo
  if (desconto_percentual > desconto_maximo * 0.7) {
    return {
      valido: true,
      desconto_maximo,
      requer_aprovacao: false,
      aviso: `Desconto próximo do máximo (${desconto_maximo}%). Valor economizado: R$ ${(subtotal * desconto_percentual / 100).toFixed(2)}`,
    };
  }

  return { valido: true, desconto_maximo, requer_aprovacao: false, aviso: null };
}
