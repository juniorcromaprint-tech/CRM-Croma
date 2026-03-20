import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { calcPricing, PricingInput, PricingConfig } from "./pricing-engine.ts";

const DEFAULT_CONFIG: PricingConfig = {
  faturamentoMedio: 30000,
  custoOperacional: 24850,
  custoProdutivo: 16400,
  qtdFuncionarios: 3,
  horasMes: 176,
  percentualComissao: 5,
  percentualImpostos: 12,
  percentualJuros: 2,
  percentualEncargos: 0,
};

Deno.test("calcPricing - banner 3x1m com materiais reais", () => {
  const input: PricingInput = {
    materiais: [
      { nome: "Lona 440g", precoUnitario: 25.0, quantidade: 3.0, unidade: "m²" },
    ],
    processos: [
      { etapa: "Impressão", tempoMinutos: 30 },
      { etapa: "Acabamento", tempoMinutos: 15 },
    ],
    maquinas: [
      { nome: "HP Latex 365", custoHora: 45.0, tempoMinutos: 30 },
    ],
    markupPercentual: 40,
    aproveitamento: 0.9,
  };

  const result = calcPricing(input, DEFAULT_CONFIG);

  // Preço deve ser positivo e razoável para banner 3m²
  assertEquals(result.precoVenda > 0, true);
  assertEquals(result.custoMP > 0, true);
  assertEquals(result.custoMO > 0, true);
  assertEquals(result.margemBruta > 0, true);
  // Custo MP deve refletir lona 440g: 3m² * R$25 / 0.9 aproveitamento ≈ R$83.33
  assertEquals(Math.abs(result.custoMP - (3 * 25 / 0.9)) < 1, true);
});

Deno.test("calcPricing - sem materiais retorna zero", () => {
  const input: PricingInput = {
    materiais: [],
    processos: [],
    maquinas: [],
    markupPercentual: 40,
    aproveitamento: 0.85,
  };

  const result = calcPricing(input, DEFAULT_CONFIG);
  assertEquals(result.precoVenda, 0);
});

Deno.test("calcPricing - custo maquinas calculado corretamente", () => {
  const input: PricingInput = {
    materiais: [],
    processos: [],
    maquinas: [
      { nome: "Maquina A", custoHora: 60.0, tempoMinutos: 30 }, // 60 * 30/60 = R$30
    ],
    markupPercentual: 0,
    aproveitamento: 1.0,
  };

  const result = calcPricing(input, DEFAULT_CONFIG);
  assertEquals(Math.abs(result.custoMaquinas - 30) < 0.01, true);
});

Deno.test("calcPricing - aproveitamento divide custo MP", () => {
  const input: PricingInput = {
    materiais: [
      { nome: "Material", precoUnitario: 100.0, quantidade: 1.0, unidade: "m²" },
    ],
    processos: [],
    maquinas: [],
    markupPercentual: 0,
    aproveitamento: 0.8, // 20% de perda
  };

  const result = calcPricing(input, DEFAULT_CONFIG);
  // custoMP = 100 / 0.8 = 125
  assertEquals(Math.abs(result.custoMP - 125) < 0.01, true);
});
