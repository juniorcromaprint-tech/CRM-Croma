// ============================================================================
// MOTOR DE PRECIFICAÇÃO — Custeio Direto (Mubisys)
// Portado de src/shared/services/pricing-engine.ts para Deno (Edge Functions)
//
// 9 passos de cálculo:
// 1. Levantamento de Matéria Prima (Vmp) — dividido pelo aproveitamento
// 2. Levantamento de Tempo Produtivo (T)
// 3. Percentual de Custos Fixos (P%)
// 4. Custo por Minuto (Cm)
// 5. Percentual de Vendas (Pv)
// 6. Custo Base (Vb)
// 7. Valor Antes do Markup (Vam)
// 8. Aplicar Markup (Vm)
// 9. Valor Final de Venda (Vv)
// ============================================================================

export interface PricingConfig {
  faturamentoMedio: number;
  custoOperacional: number;
  custoProdutivo: number;
  folhaProdutiva?: number; // alias de custoProdutivo (compatibilidade)
  qtdFuncionarios: number;
  horasMes: number;
  percentualComissao: number;
  percentualImpostos: number;
  percentualJuros: number;
  percentualEncargos: number;
}

export interface MaterialInput {
  nome: string;
  precoUnitario: number;
  quantidade: number;
  unidade: string;
}

export interface ProcessoInput {
  etapa: string;
  tempoMinutos: number;
}

export interface MaquinaInput {
  nome: string;
  custoHora: number;
  tempoMinutos: number;
}

export interface PricingInput {
  materiais: MaterialInput[];
  processos: ProcessoInput[];
  maquinas: MaquinaInput[];
  markupPercentual: number;
  /** Aproveitamento do material (0.75 a 0.95) — perdas de corte/impressão */
  aproveitamento: number;
}

export interface PricingResult {
  custoMP: number;
  tempoTotal: number;
  percentualFixo: number;
  custoPorMinuto: number;
  custoMO: number;
  custoMaquinas: number;
  percentualVendas: number;
  custoBase: number;
  valorAntesMarkup: number;
  valorMarkup: number;
  precoVenda: number;
  margemBruta: number;
  custoTotal: number;
  lucroEstimado: number;
}

// ---------------------------------------------------------------------------
// PASSO 3: Percentual de Custos Fixos
// P = ((C - CP) × 100) / F
// ---------------------------------------------------------------------------
export function calcPercentualFixo(config: PricingConfig): number {
  const { custoOperacional, custoProdutivo, faturamentoMedio } = config;
  if (faturamentoMedio === 0) return 0;
  const custosFixos = custoOperacional - custoProdutivo;
  return (custosFixos * 100) / faturamentoMedio;
}

// ---------------------------------------------------------------------------
// PASSO 4: Custo por Minuto
// Cm = ((Fp / Qf) / horasMes) / 60
// ---------------------------------------------------------------------------
export function calcCustoPorMinuto(config: PricingConfig): number {
  const { custoProdutivo, qtdFuncionarios, horasMes, percentualEncargos } = config;
  if (qtdFuncionarios === 0 || horasMes === 0) return 0;
  const custoComEncargos = custoProdutivo * (1 + (percentualEncargos ?? 0) / 100);
  const custoPorFuncionario = custoComEncargos / qtdFuncionarios;
  const custoPorHora = custoPorFuncionario / horasMes;
  return custoPorHora / 60;
}

// ---------------------------------------------------------------------------
// PASSO 5: Percentual de Vendas
// Pv = (comissao + impostos + juros) / 100
// ---------------------------------------------------------------------------
export function calcPercentualVendas(config: PricingConfig): number {
  const { percentualComissao, percentualImpostos, percentualJuros } = config;
  return (percentualComissao + percentualImpostos + percentualJuros) / 100;
}

// ---------------------------------------------------------------------------
// CÁLCULO COMPLETO (9 PASSOS)
// ---------------------------------------------------------------------------
export function calcPricing(input: PricingInput, config: PricingConfig): PricingResult {

  // PASSO 1: Matéria Prima — dividida pelo aproveitamento
  const aproveitamento = input.aproveitamento > 0 ? input.aproveitamento : 1;
  const custoMP = input.materiais.reduce(
    (total, mat) => total + mat.quantidade * mat.precoUnitario,
    0,
  ) / aproveitamento;

  // PASSO 2: Tempo Produtivo
  const tempoTotal = input.processos.reduce(
    (total, proc) => total + proc.tempoMinutos,
    0,
  );

  // PASSO 3: Percentual de Custos Fixos
  const percentualFixo = calcPercentualFixo(config);

  // PASSO 4: Custo por Minuto + Mão de Obra
  const custoPorMinuto = calcCustoPorMinuto(config);
  const custoMO = tempoTotal * custoPorMinuto;

  // PASSO 5: Percentual de Vendas
  const percentualVendas = calcPercentualVendas(config);

  // PASSO 5.5: Custo de Máquinas
  const custoMaquinas = input.maquinas.reduce(
    (total, maq) => total + (maq.custoHora * maq.tempoMinutos) / 60,
    0,
  );

  // PASSO 6: Custo Base
  // Vb = (Vmp + MO + Máquinas) × (1 + P/100)
  const custoBase = (custoMP + custoMO + custoMaquinas) * (1 + percentualFixo / 100);

  // PASSO 7: Valor Antes do Markup
  // Vam = Vb / (1 - Pv)
  const denominadorVendas = 1 - percentualVendas;
  const valorAntesMarkup = denominadorVendas > 0 ? custoBase / denominadorVendas : custoBase;

  // PASSO 8: Markup
  const valorMarkup = valorAntesMarkup * (input.markupPercentual / 100);

  // PASSO 9: Preço Final
  const precoVenda = valorAntesMarkup + valorMarkup;

  // Métricas derivadas
  const custoTotal = custoBase;
  const lucroEstimado = precoVenda - custoTotal - (precoVenda * percentualVendas);
  const margemBruta = precoVenda > 0
    ? ((precoVenda - custoTotal) / precoVenda) * 100
    : 0;

  return {
    custoMP,
    tempoTotal,
    percentualFixo,
    custoPorMinuto,
    custoMO,
    custoMaquinas,
    percentualVendas,
    custoBase,
    valorAntesMarkup,
    valorMarkup,
    precoVenda,
    margemBruta,
    custoTotal,
    lucroEstimado,
  };
}
