/**
 * Testes do Motor de Precificação Mubisys — Custeio Direto
 * Rodar: `npx vitest run src/shared/services/__tests__/pricing-engine.test.ts`
 */
import { describe, it, expect } from "vitest";
import {
  calcPercentualFixo,
  calcCustoPorMinuto,
  calcPercentualVendas,
  calcPricing,
  calcPrecoRapido,
  calcMargemReal,
  calcBreakEven,
  simularDesconto,
  DEFAULT_PRICING_CONFIG,
  type PricingConfig,
  type PricingInput,
} from "../pricing-engine";
import { validarDesconto } from "../orcamento-pricing.service";

// ─── Helpers ────────────────────────────────────────────────────────────────

const CROMA_CONFIG = DEFAULT_PRICING_CONFIG;

function makeInput(overrides?: Partial<PricingInput>): PricingInput {
  return {
    materiais: [
      { nome: "Lona 440g", quantidade: 5, precoUnitario: 12.5 },
      { nome: "Tinta UV", quantidade: 2, precoUnitario: 8.0 },
    ],
    processos: [
      { etapa: "Impressão", tempoMinutos: 30 },
      { etapa: "Acabamento", tempoMinutos: 15 },
    ],
    markupPercentual: 40,
    ...overrides,
  };
}

// ─── Passo 3: Percentual de Custos Fixos ─────────────────────────────────

describe("calcPercentualFixo", () => {
  it("retorna valor correto com config Croma padrão", () => {
    const p = calcPercentualFixo(CROMA_CONFIG);
    expect(p).toBeCloseTo(11.869, 2);
  });

  it("retorna 0 quando faturamento é zero", () => {
    expect(calcPercentualFixo({ ...CROMA_CONFIG, faturamentoMedio: 0 })).toBe(0);
  });

  it("retorna 0 quando custos operacional = produtivo", () => {
    expect(
      calcPercentualFixo({ ...CROMA_CONFIG, custoOperacional: 23744, custoProdutivo: 23744 }),
    ).toBe(0);
  });
});

// ─── Passo 4: Custo por Minuto ───────────────────────────────────────────

describe("calcCustoPorMinuto", () => {
  it("retorna valor correto com config Croma padrão", () => {
    const cm = calcCustoPorMinuto(CROMA_CONFIG);
    expect(cm).toBeCloseTo(0.3747, 3);
  });

  it("retorna 0 quando qtdFuncionarios é zero", () => {
    expect(calcCustoPorMinuto({ ...CROMA_CONFIG, qtdFuncionarios: 0 })).toBe(0);
  });

  it("retorna 0 quando horasMes é zero", () => {
    expect(calcCustoPorMinuto({ ...CROMA_CONFIG, horasMes: 0 })).toBe(0);
  });
});

// ─── Passo 5: Percentual de Vendas ───────────────────────────────────────

describe("calcPercentualVendas", () => {
  it("retorna 0.19 com config Croma padrão (5+12+2=19%)", () => {
    expect(calcPercentualVendas(CROMA_CONFIG)).toBeCloseTo(0.19, 4);
  });
});

// ─── Motor Completo (9 passos) ───────────────────────────────────────────

describe("calcPricing (motor completo)", () => {
  it("calcula preço de venda positivo com materiais e processos", () => {
    const result = calcPricing(makeInput(), CROMA_CONFIG);
    expect(result.precoVenda).toBeGreaterThan(0);
    expect(result.custoMP).toBeCloseTo(78.5, 2);
  });

  it("calcula custoMP como soma de (qtd × preço) dos materiais", () => {
    const result = calcPricing(makeInput(), CROMA_CONFIG);
    expect(result.custoMP).toBeCloseTo(78.5, 2);
  });

  it("calcula tempoTotal como soma dos minutos dos processos", () => {
    const result = calcPricing(makeInput(), CROMA_CONFIG);
    expect(result.tempoTotal).toBe(45);
  });

  it("calcula custoMO = tempoTotal × custoPorMinuto", () => {
    const result = calcPricing(makeInput(), CROMA_CONFIG);
    const cm = calcCustoPorMinuto(CROMA_CONFIG);
    expect(result.custoMO).toBeCloseTo(45 * cm, 4);
  });

  it("aplica custos fixos no custoBase: Vb = (Vmp + MO) × (1 + P%/100)", () => {
    const result = calcPricing(makeInput(), CROMA_CONFIG);
    const P = calcPercentualFixo(CROMA_CONFIG);
    const expectedVb = (result.custoMP + result.custoMO) * (1 + P / 100);
    expect(result.custoBase).toBeCloseTo(expectedVb, 4);
  });

  it("aplica Pv no Vam: Vam = Vb / (1 - Pv)", () => {
    const result = calcPricing(makeInput(), CROMA_CONFIG);
    const Pv = calcPercentualVendas(CROMA_CONFIG);
    const expectedVam = result.custoBase / (1 - Pv);
    expect(result.valorAntesMarkup).toBeCloseTo(expectedVam, 4);
  });

  it("aplica markup: Vm = Vam × (markup/100)", () => {
    const result = calcPricing(makeInput(), CROMA_CONFIG);
    const expectedVm = result.valorAntesMarkup * (40 / 100);
    expect(result.valorMarkup).toBeCloseTo(expectedVm, 4);
  });

  it("precoVenda = Vam + Vm (Passo 9)", () => {
    const result = calcPricing(makeInput(), CROMA_CONFIG);
    expect(result.precoVenda).toBeCloseTo(
      result.valorAntesMarkup + result.valorMarkup,
      4,
    );
  });

  it("retorna 0 para todos os campos quando sem materiais e processos", () => {
    const result = calcPricing(
      { materiais: [], processos: [], markupPercentual: 40 },
      CROMA_CONFIG,
    );
    expect(result.custoMP).toBe(0);
    expect(result.tempoTotal).toBe(0);
    expect(result.custoMO).toBe(0);
    expect(result.custoBase).toBe(0);
    expect(result.precoVenda).toBe(0);
  });

  it("com markup 0% → precoVenda = Vam (sem lucro sobre markup)", () => {
    const result = calcPricing(makeInput({ markupPercentual: 0 }), CROMA_CONFIG);
    expect(result.precoVenda).toBeCloseTo(result.valorAntesMarkup, 4);
    expect(result.valorMarkup).toBeCloseTo(0, 4);
  });

  it("margem bruta > 0 com markup > 0", () => {
    const result = calcPricing(makeInput({ markupPercentual: 40 }), CROMA_CONFIG);
    expect(result.margemBruta).toBeGreaterThan(0);
  });

  it("breakdown percentuais somam ~100%", () => {
    const result = calcPricing(makeInput(), CROMA_CONFIG);
    const soma =
      result.percMP +
      result.percMO +
      result.percFixo +
      result.percImpostos +
      result.percComissao +
      CROMA_CONFIG.percentualJuros +
      result.percMargem;
    expect(soma).toBeCloseTo(100, 0);
  });
});

// ─── Invariantes de negócio ──────────────────────────────────────────────

describe("invariantes de negócio", () => {
  it("Vam é sempre >= custoBase (step 7 nunca reduz)", () => {
    const result = calcPricing(makeInput(), CROMA_CONFIG);
    expect(result.valorAntesMarkup).toBeGreaterThanOrEqual(result.custoBase);
  });

  it("precoVenda >= Vam (step 9 = Vam + markup, markup >= 0)", () => {
    const result = calcPricing(makeInput({ markupPercentual: 0 }), CROMA_CONFIG);
    expect(result.precoVenda).toBeGreaterThanOrEqual(result.valorAntesMarkup - 0.001);
  });

  it("custoBase >= custoMP + custoMO (fixos adicionam, nunca subtraem)", () => {
    const result = calcPricing(makeInput(), CROMA_CONFIG);
    expect(result.custoBase).toBeGreaterThanOrEqual(result.custoMP + result.custoMO);
  });

  it("markup mais alto = preço mais alto (linearidade)", () => {
    const r30 = calcPricing(makeInput({ markupPercentual: 30 }), CROMA_CONFIG);
    const r50 = calcPricing(makeInput({ markupPercentual: 50 }), CROMA_CONFIG);
    const r80 = calcPricing(makeInput({ markupPercentual: 80 }), CROMA_CONFIG);
    expect(r30.precoVenda).toBeLessThan(r50.precoVenda);
    expect(r50.precoVenda).toBeLessThan(r80.precoVenda);
  });
});

// ─── Orcamento Pricing Service ───────────────────────────────────────────

describe("validarDesconto", () => {
  it("aceita desconto dentro do limite", () => {
    const regras = [
      { categoria: "geral", markup_minimo: 25, markup_sugerido: 40, desconto_maximo: 10, ativo: true },
    ];
    const result = validarDesconto(5, null, regras, 10000);
    expect(result.valido).toBe(true);
    expect(result.requer_aprovacao).toBe(false);
  });

  it("rejeita desconto acima do máximo", () => {
    const regras = [
      { categoria: "geral", markup_minimo: 25, markup_sugerido: 40, desconto_maximo: 10, ativo: true },
    ];
    const result = validarDesconto(15, null, regras, 10000);
    expect(result.valido).toBe(false);
    expect(result.requer_aprovacao).toBe(true);
  });

  it("alerta quando desconto > 70% do máximo", () => {
    const regras = [
      { categoria: "geral", markup_minimo: 25, markup_sugerido: 40, desconto_maximo: 10, ativo: true },
    ];
    const result = validarDesconto(8, null, regras, 10000);
    expect(result.valido).toBe(true);
    expect(result.aviso).not.toBeNull();
  });
});
