import { describe, it, expect } from 'vitest';
import { ANEXO_III, ANEXO_V, FATOR_R_THRESHOLD } from '../../types/contabilidade.types';

// Pure calculation helpers (extracted from das-simples.service.ts for testing)
function findFaixa(rbt12: number, tabela: typeof ANEXO_III) {
  for (const f of tabela) {
    if (rbt12 <= f.limiteSuperior) return f;
  }
  return tabela[tabela.length - 1];
}

function calcAliquotaEfetiva(rbt12: number, aliquotaNominal: number, deducao: number): number {
  if (rbt12 === 0) return 0;
  return (rbt12 * aliquotaNominal - deducao) / rbt12;
}

describe('DAS Simples Nacional — Cálculo de alíquotas', () => {
  describe('Faixa 1 — Anexo V', () => {
    it('rbt12 = 150.000 → faixa 1, alíquota 15.5% sem dedução', () => {
      const rbt12 = 150_000;
      const faixa = findFaixa(rbt12, ANEXO_V);
      expect(faixa.faixa).toBe(1);
      expect(faixa.aliquota).toBe(0.155);
      expect(faixa.deducao).toBe(0);
    });

    it('alíquota efetiva faixa 1 = 15.5%', () => {
      const rbt12 = 150_000;
      const faixa = findFaixa(rbt12, ANEXO_V);
      const aliqEf = calcAliquotaEfetiva(rbt12, faixa.aliquota, faixa.deducao);
      expect(aliqEf).toBe(0.155);
    });

    it('DAS para receita de R$12.500 na faixa 1 Anexo V = R$1.937,50', () => {
      const rbt12 = 150_000;
      const faixa = findFaixa(rbt12, ANEXO_V);
      const aliqEf = calcAliquotaEfetiva(rbt12, faixa.aliquota, faixa.deducao);
      const das = 12_500 * aliqEf;
      expect(das).toBe(1_937.5);
    });
  });

  describe('Faixa 1 — Anexo III', () => {
    it('rbt12 = 150.000 → alíquota 6% sem dedução', () => {
      const rbt12 = 150_000;
      const faixa = findFaixa(rbt12, ANEXO_III);
      expect(faixa.faixa).toBe(1);
      expect(faixa.aliquota).toBe(0.06);
      expect(faixa.deducao).toBe(0);
    });

    it('DAS para receita de R$12.500 na faixa 1 Anexo III = R$750', () => {
      const rbt12 = 150_000;
      const faixa = findFaixa(rbt12, ANEXO_III);
      const aliqEf = calcAliquotaEfetiva(rbt12, faixa.aliquota, faixa.deducao);
      const das = 12_500 * aliqEf;
      expect(das).toBe(750);
    });
  });

  describe('Faixa 2 — Anexo V com dedução', () => {
    it('rbt12 = 250.000 → faixa 2, alíquota 18%, dedução 4.500', () => {
      const rbt12 = 250_000;
      const faixa = findFaixa(rbt12, ANEXO_V);
      expect(faixa.faixa).toBe(2);
      expect(faixa.aliquota).toBe(0.18);
      expect(faixa.deducao).toBe(4_500);
    });

    it('alíquota efetiva faixa 2 com dedução ≈ 16.2%', () => {
      const rbt12 = 250_000;
      const faixa = findFaixa(rbt12, ANEXO_V);
      const aliqEf = calcAliquotaEfetiva(rbt12, faixa.aliquota, faixa.deducao);
      expect(aliqEf).toBeCloseTo(0.162, 3);
    });
  });

  describe('Faixa 3 — Anexo III com dedução', () => {
    it('rbt12 = 500.000 → faixa 3 Anexo III, alíquota 13.5%, dedução 17.640', () => {
      const rbt12 = 500_000;
      const faixa = findFaixa(rbt12, ANEXO_III);
      expect(faixa.faixa).toBe(3);
      expect(faixa.aliquota).toBe(0.135);
      expect(faixa.deducao).toBe(17_640);
    });
  });

  describe('Fator R e determinação de Anexo', () => {
    it('Fator R >= 0.28 → deve usar Anexo III', () => {
      const folha12m = 50_000;
      const rbt12 = 170_000;
      const fatorR = folha12m / rbt12;
      expect(fatorR).toBeGreaterThanOrEqual(FATOR_R_THRESHOLD);
    });

    it('Fator R < 0.28 → deve usar Anexo V', () => {
      const folha12m = 30_000;
      const rbt12 = 170_000;
      const fatorR = folha12m / rbt12;
      expect(fatorR).toBeLessThan(FATOR_R_THRESHOLD);
    });

    it('Fator R exatamente 0.28 → enquadra no Anexo III', () => {
      const rbt12 = 100_000;
      const folha12m = rbt12 * 0.28;
      const fatorR = folha12m / rbt12;
      expect(fatorR).toBe(FATOR_R_THRESHOLD);
      expect(fatorR >= FATOR_R_THRESHOLD).toBe(true);
    });

    it('Fator R = 0 quando rbt12 = 0', () => {
      const folha12m = 5_000;
      const rbt12 = 0;
      const fatorR = rbt12 > 0 ? folha12m / rbt12 : 0;
      expect(fatorR).toBe(0);
    });
  });

  describe('Limites de faixa', () => {
    it('rbt12 = 180.000 → exatamente no limite da faixa 1', () => {
      const rbt12 = 180_000;
      const faixaV = findFaixa(rbt12, ANEXO_V);
      expect(faixaV.faixa).toBe(1);
    });

    it('rbt12 = 180.001 → entra na faixa 2', () => {
      const rbt12 = 180_001;
      const faixaV = findFaixa(rbt12, ANEXO_V);
      expect(faixaV.faixa).toBe(2);
    });

    it('rbt12 = 4.800.000 (limite do Simples) → faixa 6', () => {
      const rbt12 = 4_800_000;
      const faixaV = findFaixa(rbt12, ANEXO_V);
      expect(faixaV.faixa).toBe(6);
    });

    it('rbt12 acima do limite → retorna faixa 6', () => {
      const rbt12 = 5_000_000;
      const faixaV = findFaixa(rbt12, ANEXO_V);
      expect(faixaV.faixa).toBe(6);
    });
  });

  describe('Cálculo com rbt12 = 0', () => {
    it('alíquota efetiva = 0 quando rbt12 = 0', () => {
      const aliqEf = calcAliquotaEfetiva(0, 0.155, 0);
      expect(aliqEf).toBe(0);
    });
  });
});
