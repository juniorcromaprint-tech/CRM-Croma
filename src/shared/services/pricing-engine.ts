// ============================================================================
// MOTOR DE PRECIFICAÇÃO — Custeio Direto (Mubisys)
// Croma Print ERP/CRM
//
// 9 passos de cálculo:
// 1. Levantamento de Matéria Prima (Vmp)
// 2. Levantamento de Tempo Produtivo (T)
// 3. Percentual de Custos Fixos (P%)
// 4. Custo por Minuto (Cm)
// 5. Percentual de Vendas (Pv)
// 6. Custo Base (Vb)
// 7. Valor Antes do Markup (Vam)
// 8. Aplicar Markup (Vm)
// 9. Valor Final de Venda (Vv)
// ============================================================================

// ---------------------------------------------------------------------------
// TIPOS
// ---------------------------------------------------------------------------

export interface PricingConfig {
  /** Faturamento médio mensal (média 12 meses) */
  faturamentoMedio: number;
  /** Custo operacional total (custos fixos + variáveis) */
  custoOperacional: number;
  /** Custo produtivo (folha de pagamento da produção) */
  custoProdutivo: number;
  /** Quantidade de funcionários na produção */
  qtdFuncionarios: number;
  /** Horas trabalhadas por mês (padrão 176h = 22 dias × 8h) */
  horasMes: number;
  /** Percentual de comissão de vendas */
  percentualComissao: number;
  /** Percentual de impostos sobre venda */
  percentualImpostos: number;
  /** Percentual de juros / custo financeiro */
  percentualJuros: number;
  /** Percentual de encargos trabalhistas (0% se sem CLT, ~70% com registro) */
  percentualEncargos: number;
}

export interface MaterialItem {
  nome: string;
  quantidade: number;
  precoUnitario: number;
}

export interface ProcessoItem {
  etapa: string;
  tempoMinutos: number;
}

export interface PricingInput {
  materiais: MaterialItem[];
  processos: ProcessoItem[];
  markupPercentual: number;
  /** Custo total de máquinas para este item (já calculado externamente) */
  custoMaquinas?: number;
}

export interface PricingResult {
  // Passo 1 — Matéria Prima
  custoMP: number;

  // Passo 2 — Tempo Produtivo
  tempoTotal: number;

  // Passo 3 — Percentual de Custos Fixos
  percentualFixo: number;

  // Passo 4 — Custo por Minuto
  custoPorMinuto: number;
  /** Custo de Mão de Obra: MO = T × Cm */
  custoMO: number;

  // Passo 5 — Percentual de Vendas
  percentualVendas: number;

  // Passo 6 — Custo Base
  custoBase: number;

  // Passo 7 — Valor Antes do Markup
  valorAntesMarkup: number;

  // Passo 8 — Valor do Markup
  valorMarkup: number;

  // Passo 9 — Preço Final de Venda
  precoVenda: number;

  // Métricas derivadas
  margemBruta: number;
  custoTotal: number;
  lucroEstimado: number;

  // Custo de máquinas
  custoMaquinas: number;

  // Breakdown percentual (sobre o preço de venda)
  percMP: number;
  percMO: number;
  percMaquinas: number;
  percFixo: number;
  percImpostos: number;
  percComissao: number;
  percMargem: number;
}

// ---------------------------------------------------------------------------
// CONFIG PADRÃO — Croma Print
// ---------------------------------------------------------------------------

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  faturamentoMedio: 30_000,
  custoOperacional: 24_850,
  custoProdutivo: 16_400,
  qtdFuncionarios: 3,
  horasMes: 176,
  percentualComissao: 5,
  percentualImpostos: 12,
  percentualJuros: 2,
  percentualEncargos: 0,
};

// ---------------------------------------------------------------------------
// PASSO 3: Percentual de Custos Fixos
// P = ((C - CP) × 100) / F
//
// Onde:
//   C  = Custo operacional total
//   CP = Custo produtivo (folha produção)
//   F  = Faturamento médio
// ---------------------------------------------------------------------------

export function calcPercentualFixo(config: PricingConfig): number {
  const { custoOperacional, custoProdutivo, faturamentoMedio } = config;

  if (faturamentoMedio === 0) return 0;

  // Custos fixos = custos operacionais totais - custo produtivo (que é variável)
  const custosFixos = custoOperacional - custoProdutivo;
  return (custosFixos * 100) / faturamentoMedio;
}

// ---------------------------------------------------------------------------
// PASSO 4: Custo por Minuto
// Cm = ((Fp / Qf) / horasMes) / 60
//
// Onde:
//   Fp = Folha de pagamento produtiva (custoProdutivo)
//   Qf = Quantidade de funcionários produtivos
//   horasMes = Horas trabalhadas por mês (176h padrão)
// ---------------------------------------------------------------------------

export function calcCustoPorMinuto(config: PricingConfig): number {
  const { custoProdutivo, qtdFuncionarios, horasMes, percentualEncargos } = config;

  if (qtdFuncionarios === 0 || horasMes === 0) return 0;

  // Aplica encargos trabalhistas sobre o custo produtivo
  const custoComEncargos = custoProdutivo * (1 + (percentualEncargos ?? 0) / 100);

  const custoPorFuncionario = custoComEncargos / qtdFuncionarios;
  const custoPorHora = custoPorFuncionario / horasMes;
  const custoPorMinuto = custoPorHora / 60;

  return custoPorMinuto;
}

// ---------------------------------------------------------------------------
// PASSO 5: Percentual de Vendas
// Pv = (comissao + impostos + juros) / 100
//
// Retorna como fração (0.19 = 19%)
// ---------------------------------------------------------------------------

export function calcPercentualVendas(config: PricingConfig): number {
  const { percentualComissao, percentualImpostos, percentualJuros } = config;

  return (percentualComissao + percentualImpostos + percentualJuros) / 100;
}

// ---------------------------------------------------------------------------
// CÁLCULO COMPLETO (9 PASSOS)
// ---------------------------------------------------------------------------

export function calcPricing(
  input: PricingInput,
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
): PricingResult {

  // =========================================================================
  // PASSO 1: Levantamento de Matéria Prima (Vmp)
  // Somatório de (quantidade × preço unitário) de cada material
  // =========================================================================
  const custoMP = input.materiais.reduce(
    (total, mat) => total + mat.quantidade * mat.precoUnitario,
    0,
  );

  // =========================================================================
  // PASSO 2: Levantamento de Tempo Produtivo (T)
  // Somatório do tempo em minutos de cada etapa de produção
  // =========================================================================
  const tempoTotal = input.processos.reduce(
    (total, proc) => total + proc.tempoMinutos,
    0,
  );

  // =========================================================================
  // PASSO 3: Percentual de Custos Fixos (P%)
  // P = ((C - CP) × 100) / F
  // =========================================================================
  const percentualFixo = calcPercentualFixo(config);

  // =========================================================================
  // PASSO 4: Custo por Minuto (Cm)
  // Cm = ((Fp / Qf) / horasMes) / 60
  //
  // Mão de obra: MO = T × Cm
  // =========================================================================
  const custoPorMinuto = calcCustoPorMinuto(config);
  const custoMO = tempoTotal * custoPorMinuto;

  // =========================================================================
  // PASSO 5: Percentual de Vendas (Pv)
  // Pv = (comissao + impostos + juros) / 100
  // =========================================================================
  const percentualVendas = calcPercentualVendas(config);

  // =========================================================================
  // PASSO 5.5: Custo de Máquinas
  // Passado externamente (calculado por orcamento-pricing.service)
  // =========================================================================
  const custoMaquinas = input.custoMaquinas ?? 0;

  // =========================================================================
  // PASSO 6: Custo Base (Vb)
  // Vb = (Vmp + MO + Máquinas) × (1 + P/100)
  //
  // Aplica o percentual de custos fixos sobre os custos diretos
  // =========================================================================
  const custoBase = (custoMP + custoMO + custoMaquinas) * (1 + percentualFixo / 100);

  // =========================================================================
  // PASSO 7: Valor Antes do Markup (Vam)
  // Vam = Vb / (1 - Pv)
  //
  // Incorpora os custos de venda (impostos, comissão, juros)
  // =========================================================================
  const denominadorVendas = 1 - percentualVendas;
  const valorAntesMarkup = denominadorVendas > 0 ? custoBase / denominadorVendas : custoBase;

  // =========================================================================
  // PASSO 8: Aplicar Markup (Vm)
  // Vm = Vam × (Pm/100)
  //
  // Onde Pm = percentual de markup desejado
  // Nota: Vam já incorporou Pv no Passo 7 — não dividir por (1 - Pv) novamente
  // =========================================================================
  const valorMarkup = valorAntesMarkup * (input.markupPercentual / 100);

  // =========================================================================
  // PASSO 9: Valor Final de Venda (Vv)
  // Vv = Vam + Vm
  //
  // O motor retorna SEMPRE o preço UNITÁRIO.
  // A multiplicação por quantidade é responsabilidade de quem chama (orcamento-pricing.service).
  // =========================================================================
  const precoVenda = valorAntesMarkup + valorMarkup;

  // =========================================================================
  // MÉTRICAS DERIVADAS
  // =========================================================================

  // Custo total real (MP + MO + fixos rateados) — unitário
  const custoTotal = custoBase;

  // Lucro estimado — unitário
  const lucroEstimado = precoVenda - custoTotal - (precoVenda * percentualVendas);

  // Margem bruta: (preço - custo) / preço × 100
  const margemBruta = precoVenda > 0
    ? ((precoVenda - custoTotal) / precoVenda) * 100
    : 0;

  // Breakdown percentual (sobre preço de venda unitário)
  const pv = precoVenda > 0 ? precoVenda : 1;
  const percMP = (custoMP / pv) * 100;
  const percMO = (custoMO / pv) * 100;
  const percMaquinas = (custoMaquinas / pv) * 100;

  // Custo fixo rateado no produto
  const custoFixoNoProduto = (custoMP + custoMO + custoMaquinas) * (percentualFixo / 100);
  const percFixo = (custoFixoNoProduto / pv) * 100;

  const percImpostos = config.percentualImpostos;
  const percComissao = config.percentualComissao;

  // Margem líquida efetiva
  const percMargem = 100 - percMP - percMO - percMaquinas - percFixo - percImpostos - percComissao - config.percentualJuros;

  return {
    custoMP,
    tempoTotal,
    percentualFixo,
    custoPorMinuto,
    custoMO,
    percentualVendas,
    custoBase,
    valorAntesMarkup,
    valorMarkup,
    precoVenda,
    margemBruta,
    custoTotal,
    lucroEstimado,
    custoMaquinas,
    percMP,
    percMO,
    percMaquinas,
    percFixo,
    percImpostos,
    percComissao,
    percMargem,
  };
}

// ---------------------------------------------------------------------------
// MARKUP REVERSO — Calcula markup necessario para atingir preco-alvo
// ---------------------------------------------------------------------------

/**
 * Dado um preco-alvo, calcula qual markup % seria necessario.
 * Faz o calculo reverso: preco → markup (inverso do passo 9).
 *
 * @param precoAlvo - Preco de venda desejado (unitario)
 * @param input - Materiais e processos (sem markup)
 * @param config - Configuracao de precificacao
 */
export function calcMarkupReverso(
  precoAlvo: number,
  input: Omit<PricingInput, 'markupPercentual'>,
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
): { markupPercentual: number; margemBruta: number; valido: boolean } {
  if (!precoAlvo || precoAlvo <= 0) {
    return { markupPercentual: 0, margemBruta: 0, valido: false };
  }

  const base = calcPricing({ ...input, markupPercentual: 0 }, config);

  if (base.valorAntesMarkup <= 0) {
    return { markupPercentual: 0, margemBruta: 0, valido: false };
  }

  const markupPercentual = ((precoAlvo / base.valorAntesMarkup) - 1) * 100;
  const margemBruta = ((precoAlvo - base.custoBase) / precoAlvo) * 100;

  return {
    markupPercentual: Math.round(markupPercentual * 100) / 100,
    margemBruta: Math.round(margemBruta * 100) / 100,
    valido: markupPercentual >= 0,
  };
}

// ---------------------------------------------------------------------------
// ATALHOS
// ---------------------------------------------------------------------------

/**
 * Calcula a margem real considerando custos efetivos.
 *
 * @param precoVenda - Preço de venda praticado
 * @param custoMPReal - Custo real de matéria prima
 * @param custoMOReal - Custo real de mão de obra
 * @param config - Configuração de precificação (para custos de venda)
 * @returns Margem real em percentual
 */
export function calcMargemReal(
  precoVenda: number,
  custoMPReal: number,
  custoMOReal: number,
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
): number {
  if (precoVenda === 0) return 0;

  const percentualVendas = calcPercentualVendas(config);
  const percentualFixo = calcPercentualFixo(config);

  // Custo base real
  const custoBaseReal = (custoMPReal + custoMOReal) * (1 + percentualFixo / 100);

  // Custos de venda reais
  const custosVenda = precoVenda * percentualVendas;

  // Lucro real
  const lucroReal = precoVenda - custoBaseReal - custosVenda;

  // Margem real como percentual do preço de venda
  return (lucroReal / precoVenda) * 100;
}

// ---------------------------------------------------------------------------
// UTILITÁRIOS DE ANÁLISE
// ---------------------------------------------------------------------------

/**
 * Calcula o ponto de equilíbrio (break-even) em unidades.
 *
 * @param custoFixoMensal - Custo fixo mensal total
 * @param precoVendaUnit - Preço de venda unitário
 * @param custoVariavelUnit - Custo variável unitário (MP + MO)
 * @returns Quantidade mínima para cobrir custos fixos
 */
export function calcBreakEven(
  custoFixoMensal: number,
  precoVendaUnit: number,
  custoVariavelUnit: number,
): number {
  const margemContribuicao = precoVendaUnit - custoVariavelUnit;
  if (margemContribuicao <= 0) return Infinity;
  return Math.ceil(custoFixoMensal / margemContribuicao);
}

/**
 * Simula desconto: retorna nova margem se aplicar desconto.
 *
 * @param precoOriginal - Preço original de venda
 * @param percentualDesconto - Desconto a ser aplicado (ex: 10 = 10%)
 * @param custoBase - Custo base do produto
 * @param config - Configuração de precificação
 * @returns Nova margem em percentual
 */
export function simularDesconto(
  precoOriginal: number,
  percentualDesconto: number,
  custoBase: number,
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
): { precoComDesconto: number; novaMargem: number; lucroPorUnidade: number } {
  const precoComDesconto = precoOriginal * (1 - percentualDesconto / 100);
  const percentualVendas = calcPercentualVendas(config);

  const custosVenda = precoComDesconto * percentualVendas;
  const lucro = precoComDesconto - custoBase - custosVenda;

  return {
    precoComDesconto,
    novaMargem: precoComDesconto > 0 ? (lucro / precoComDesconto) * 100 : 0,
    lucroPorUnidade: lucro,
  };
}
