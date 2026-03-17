// ============================================================================
// ORÇAMENTO PRICING SERVICE
// Ponte entre o Motor de Precificação Mubisys e o módulo de Orçamentos
// ============================================================================

import {
  calcPricing,
  calcMarkupReverso,
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
  tempo_setup_min?: number; // Setup time, diluted by quantity
}

export interface OrcamentoMaquina {
  maquina_id: string;
  nome: string;
  tipo: string;
  custo_hora: number;
  custo_m2: number;
  tempo_minutos?: number;
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
  maquinas?: OrcamentoMaquina[];
}

export interface OrcamentoItemPricingResult {
  custoMP: number;
  custosAcabamentos: number;
  custoMO: number;
  custoMaquinas: number;
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
 * Incorpora materiais + acabamentos + processos + máquinas
 *
 * @param aproveitamentoPadrao - Aproveitamento padrão da categoria (0-100), usado quando material não tem aproveitamento próprio
 */
export function calcOrcamentoItem(
  item: OrcamentoItemInput,
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
  aproveitamentoPadrao: number = 85,
): OrcamentoItemPricingResult {
  const quantidade = item.quantidade || 1;
  const areaM2 = calcAreaM2(item.largura_cm, item.altura_cm);

  // Calculate acabamentos cost (informational — for UI breakdown)
  const custoAcabamentosInfo = item.acabamentos.reduce(
    (sum, a) => sum + a.quantidade * a.custo_unitario,
    0,
  );

  // Materiais + acabamentos go into motor TOGETHER (both get overhead)
  const materiaisParaMotor = [
    ...item.materiais.map((m) => {
      // Usa aproveitamento do material se disponível, senão usa o padrão da categoria
      const aproveitamento = (m.aproveitamento ?? aproveitamentoPadrao) / 100;
      const quantidadeReal = aproveitamento > 0 ? m.quantidade / aproveitamento : m.quantidade;
      return {
        nome: m.descricao,
        quantidade: quantidadeReal,
        precoUnitario: m.custo_unitario,
      };
    }),
    ...item.acabamentos.map((a) => ({
      nome: a.descricao,
      quantidade: a.quantidade,
      precoUnitario: a.custo_unitario,
    })),
  ];

  // Processos with setup time diluted by quantity
  const qtdSafe = Math.max(1, quantidade);
  const processos = item.processos.map((p) => ({
    etapa: p.etapa,
    tempoMinutos: p.tempo_minutos + ((p.tempo_setup_min ?? 0) / qtdSafe),
  }));

  // Calcular custo de máquinas
  let custoMaquinasTotal = 0;
  if (item.maquinas && item.maquinas.length > 0) {
    for (const maq of item.maquinas) {
      // Custo por tempo (custo_hora * tempo em horas)
      const custoTempo = maq.custo_hora * ((maq.tempo_minutos ?? 0) / 60);
      // Custo por área (custo_m2 * área do item)
      const custoArea = maq.custo_m2 * (areaM2 ?? 0);
      // Usa o maior dos dois (ou a soma se ambos são relevantes)
      custoMaquinasTotal += custoTempo + custoArea;
    }
  }

  // Motor Mubisys — returns UNIT price
  const pricingResult = calcPricing(
    {
      materiais: materiaisParaMotor,
      processos,
      markupPercentual: item.markup_percentual,
      custoMaquinas: custoMaquinasTotal,
    },
    config,
  );

  const precoUnitario = pricingResult.precoVenda;
  const precoTotal = precoUnitario * quantidade;
  const precoM2 = areaM2 && areaM2 > 0 ? precoUnitario / areaM2 : null;
  const custoTotalUnitario = pricingResult.custoTotal ?? 0;

  return {
    custoMP: pricingResult.custoMP,
    custosAcabamentos: custoAcabamentosInfo,
    custoMO: pricingResult.custoMO,
    custoMaquinas: pricingResult.custoMaquinas,
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
 * Given a target price (unit or m2), returns the required markup.
 */
export function calcMarkupParaPreco(
  precoAlvo: number,
  tipo: 'unitario' | 'm2',
  item: Omit<OrcamentoItemInput, 'markup_percentual'>,
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
  aproveitamentoPadrao: number = 85,
): { markup_percentual: number; margem_bruta: number; valido: boolean } {
  let precoUnitarioAlvo = precoAlvo;

  if (tipo === 'm2') {
    const areaM2 = calcAreaM2(item.largura_cm, item.altura_cm);
    if (!areaM2 || areaM2 <= 0) {
      return { markup_percentual: 0, margem_bruta: 0, valido: false };
    }
    precoUnitarioAlvo = precoAlvo * areaM2;
  }

  const quantidade = item.quantidade || 1;
  const qtdSafe = Math.max(1, quantidade);

  const materiaisParaMotor = [
    ...item.materiais.map((m) => {
      const aproveitamento = (m.aproveitamento ?? aproveitamentoPadrao) / 100;
      const quantidadeReal = aproveitamento > 0 ? m.quantidade / aproveitamento : m.quantidade;
      return { nome: m.descricao, quantidade: quantidadeReal, precoUnitario: m.custo_unitario };
    }),
    ...item.acabamentos.map((a) => ({
      nome: a.descricao, quantidade: a.quantidade, precoUnitario: a.custo_unitario,
    })),
  ];

  const processos = item.processos.map((p) => ({
    etapa: p.etapa,
    tempoMinutos: p.tempo_minutos + ((p.tempo_setup_min ?? 0) / qtdSafe),
  }));

  const result = calcMarkupReverso(precoUnitarioAlvo, { materiais: materiaisParaMotor, processos }, config);

  return {
    markup_percentual: result.markupPercentual,
    margem_bruta: result.margemBruta,
    valido: result.valido,
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
