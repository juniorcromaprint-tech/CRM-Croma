// ============================================================================
// PRICING EXPLAINER — Mubisys
// Gera explicações legíveis (em português) de como o preço foi calculado.
// ============================================================================

import type { OrcamentoItemInput, OrcamentoItemPricingResult } from "./orcamento-pricing.service";
import type { PricingConfig } from "./pricing-engine";

export interface PassoExplicado {
  passo: number;
  nome: string;
  formula: string;
  resultado: number;
  explicacao: string;
}

export interface ExplicacaoCalculo {
  resumo: string;
  custoTotal: number;
  precoUnitario: number;
  precoTotal: number;
  margemPercent: number;
  passos: PassoExplicado[];
  alertas: string[];
}

/**
 * Gera uma explicação passo-a-passo do cálculo de preço de um item de orçamento.
 *
 * @param item    - Dados do item de orçamento (insumos, dimensões, markup)
 * @param resultado - Resultado do cálculo retornado por calcOrcamentoItem()
 * @param config  - Configuração de precificação (parâmetros Mubisys)
 */
export function explicarCalculo(
  item: OrcamentoItemInput,
  resultado: OrcamentoItemPricingResult,
  config: PricingConfig,
): ExplicacaoCalculo {
  const alertas: string[] = [];

  // Margem percentual vem de resultado.margemBruta (campo real da interface)
  const margemPercent = resultado.margemBruta ?? 0;

  if (margemPercent < 20) {
    alertas.push(
      `Margem de ${margemPercent.toFixed(1)}% está abaixo do mínimo recomendado de 20%`,
    );
  }

  if (item.markup_percentual < 30) {
    alertas.push(
      `Markup de ${item.markup_percentual}% pode ser insuficiente para cobrir custos indiretos`,
    );
  }

  const areaM2 = resultado.areaM2;
  const temDimensoes = item.largura_cm && item.altura_cm;

  const materiaisDesc =
    item.materiais.length > 0
      ? item.materiais
          .map(
            (m) =>
              `${m.descricao} (${m.quantidade}×R$${m.custo_unitario.toFixed(2)})`,
          )
          .join(" + ")
      : "sem materiais definidos";

  const acabamentosDesc =
    item.acabamentos.length > 0
      ? item.acabamentos
          .map(
            (a) =>
              `${a.descricao} (${a.quantidade}×R$${a.custo_unitario.toFixed(2)})`,
          )
          .join(" + ")
      : "nenhum";

  // Custo por minuto derivado da config
  const custoPorMinuto =
    config.qtdFuncionarios > 0 && config.horasMes > 0
      ? config.custoProdutivo / (config.qtdFuncionarios * config.horasMes * 60)
      : 0;

  // Percentual de custos fixos rateado = ((custoOperacional - custoProdutivo) / faturamentoMedio) * 100
  const percentualFixo =
    config.faturamentoMedio > 0
      ? ((config.custoOperacional - config.custoProdutivo) /
          config.faturamentoMedio) *
        100
      : 0;

  // custoMO e custoFixo de resultado.detalhes (PricingResult completo do motor)
  const custoMO = resultado.custoMO ?? 0;
  const custoFixoRateado =
    resultado.detalhes?.custoBase != null
      ? resultado.detalhes.custoBase -
        resultado.custoMP -
        custoMO
      : 0;

  const passos: PassoExplicado[] = [
    {
      passo: 1,
      nome: "Custo de Matéria-Prima (Vmp)",
      formula: materiaisDesc,
      resultado: resultado.custoMP,
      explicacao: temDimensoes
        ? `Insumos calculados para ${areaM2?.toFixed(3)}m² (${item.largura_cm}cm × ${item.altura_cm}cm)`
        : "Custo dos insumos por unidade",
    },
    {
      passo: 2,
      nome: "Custo de Acabamentos",
      formula: acabamentosDesc,
      resultado: resultado.custosAcabamentos,
      explicacao:
        "Acabamentos inclusos no custo de material (recebem overhead do motor Mubisys)",
    },
    {
      passo: 3,
      nome: "Custo de Mão de Obra (MO)",
      formula: `R$${custoPorMinuto.toFixed(4)}/min × tempo de produção`,
      resultado: custoMO,
      explicacao: `Baseado em ${config.qtdFuncionarios} funcionários, ${config.horasMes}h/mês, R$${config.custoProdutivo.toLocaleString("pt-BR")}/mês custo produtivo`,
    },
    {
      passo: 4,
      nome: "Custo Fixo Rateado (P%)",
      formula: `${percentualFixo.toFixed(1)}% sobre (MP + MO)`,
      resultado: custoFixoRateado > 0 ? custoFixoRateado : 0,
      explicacao: `Rateio de R$${(config.custoOperacional - config.custoProdutivo).toLocaleString("pt-BR")} de custos fixos sobre faturamento de R$${config.faturamentoMedio.toLocaleString("pt-BR")}`,
    },
    {
      passo: 5,
      nome: "Markup",
      formula: `${item.markup_percentual}% sobre valor base`,
      resultado: resultado.precoUnitario - (resultado.custoTotal ?? 0),
      explicacao:
        "Margem de contribuição para lucro e cobertura de despesas variáveis",
    },
  ];

  const resumo = temDimensoes
    ? `${item.descricao} ${item.largura_cm}cm × ${item.altura_cm}cm = ${areaM2?.toFixed(2)}m²${item.quantidade > 1 ? ` × ${item.quantidade} un` : ""}`
    : `${item.descricao}${item.quantidade > 1 ? ` × ${item.quantidade} un` : ""}`;

  return {
    resumo,
    custoTotal: resultado.custoTotal ?? 0,
    precoUnitario: resultado.precoUnitario,
    precoTotal: resultado.precoTotal,
    margemPercent,
    passos,
    alertas,
  };
}

/**
 * Formata o preço por m² de forma legível.
 */
export function formatarPrecoM2(precoM2: number | undefined): string {
  if (!precoM2) return "–";
  return (
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(precoM2) + "/m²"
  );
}

/**
 * Formata um valor em BRL.
 */
export function formatarBRL(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

/**
 * Retorna uma cor CSS baseada na margem percentual.
 * Verde > 30%, Amarelo 20-30%, Vermelho < 20%.
 */
export function corMargem(margemPercent: number): string {
  if (margemPercent >= 30) return "text-green-600";
  if (margemPercent >= 20) return "text-amber-600";
  return "text-red-600";
}
