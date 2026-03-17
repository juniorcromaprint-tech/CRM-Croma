import { describe, it, expect } from 'vitest';
import { calcularAcumulado } from '../fluxo-caixa.service';
import type { FluxoCaixaDia } from '../../types/motor-financeiro.types';

describe('calcularAcumulado', () => {
  it('returns empty array for empty input', () => {
    expect(calcularAcumulado([])).toEqual([]);
  });

  it('calculates running saldo_acumulado correctly', () => {
    const items: FluxoCaixaDia[] = [
      { data: '2026-03-01', valor: 1000, tipo: 'entrada' },
      { data: '2026-03-02', valor: 300, tipo: 'saida' },
      { data: '2026-03-03', valor: 500, tipo: 'entrada' },
      { data: '2026-03-03', valor: 200, tipo: 'saida' },
    ];

    const result = calcularAcumulado(items);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      data: '2026-03-01',
      entradas: 1000,
      saidas: 0,
      saldo_dia: 1000,
      saldo_acumulado: 1000,
    });
    expect(result[1]).toEqual({
      data: '2026-03-02',
      entradas: 0,
      saidas: 300,
      saldo_dia: -300,
      saldo_acumulado: 700,
    });
    expect(result[2]).toEqual({
      data: '2026-03-03',
      entradas: 500,
      saidas: 200,
      saldo_dia: 300,
      saldo_acumulado: 1000,
    });
  });

  it('groups multiple items on same day', () => {
    const items: FluxoCaixaDia[] = [
      { data: '2026-04-10', valor: 100, tipo: 'entrada' },
      { data: '2026-04-10', valor: 250, tipo: 'entrada' },
      { data: '2026-04-10', valor: 50, tipo: 'saida' },
    ];

    const result = calcularAcumulado(items);

    expect(result).toHaveLength(1);
    expect(result[0].entradas).toBe(350);
    expect(result[0].saidas).toBe(50);
    expect(result[0].saldo_dia).toBe(300);
    expect(result[0].saldo_acumulado).toBe(300);
  });

  it('sorts by date', () => {
    const items: FluxoCaixaDia[] = [
      { data: '2026-06-15', valor: 200, tipo: 'entrada' },
      { data: '2026-06-01', valor: 100, tipo: 'entrada' },
      { data: '2026-06-10', valor: 50, tipo: 'saida' },
    ];

    const result = calcularAcumulado(items);

    expect(result.map((r) => r.data)).toEqual([
      '2026-06-01',
      '2026-06-10',
      '2026-06-15',
    ]);
    expect(result[0].saldo_acumulado).toBe(100);
    expect(result[1].saldo_acumulado).toBe(50);
    expect(result[2].saldo_acumulado).toBe(250);
  });

  it('handles single day', () => {
    const items: FluxoCaixaDia[] = [
      { data: '2026-01-01', valor: 500, tipo: 'entrada' },
    ];

    const result = calcularAcumulado(items);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      data: '2026-01-01',
      entradas: 500,
      saidas: 0,
      saldo_dia: 500,
      saldo_acumulado: 500,
    });
  });
});
