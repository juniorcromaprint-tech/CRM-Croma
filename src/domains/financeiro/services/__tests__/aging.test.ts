import { describe, it, expect } from 'vitest';
import { calcularResumoAging } from '../aging.service';
import type { AgingComCliente } from '../../types/motor-financeiro.types';

describe('calcularResumoAging', () => {
  it('returns zeros for empty array', () => {
    const result = calcularResumoAging([]);

    expect(result).toEqual({
      a_vencer: 0,
      d1_30: 0,
      d31_60: 0,
      d61_90: 0,
      d90_mais: 0,
      total: 0,
    });
  });

  it('sums all buckets correctly', () => {
    const items: AgingComCliente[] = [
      {
        cliente_id: 'c1',
        a_vencer: 1000,
        d1_30: 200,
        d31_60: 0,
        d61_90: 100,
        d90_mais: 50,
        total_aberto: 1350,
        maior_atraso: 75,
        nome_fantasia: 'Cliente A',
        razao_social: 'Cliente A Ltda',
      },
      {
        cliente_id: 'c2',
        a_vencer: 500,
        d1_30: 0,
        d31_60: 300,
        d61_90: 0,
        d90_mais: 400,
        total_aberto: 1200,
        maior_atraso: 120,
        nome_fantasia: 'Cliente B',
        razao_social: null,
      },
    ];

    const result = calcularResumoAging(items);

    expect(result.a_vencer).toBe(1500);
    expect(result.d1_30).toBe(200);
    expect(result.d31_60).toBe(300);
    expect(result.d61_90).toBe(100);
    expect(result.d90_mais).toBe(450);
    expect(result.total).toBe(2550);
  });

  it('total equals sum of all buckets', () => {
    const items: AgingComCliente[] = [
      {
        cliente_id: 'c1',
        a_vencer: 100,
        d1_30: 200,
        d31_60: 300,
        d61_90: 400,
        d90_mais: 500,
        total_aberto: 1500,
        maior_atraso: 95,
        nome_fantasia: 'Teste',
        razao_social: null,
      },
    ];

    const result = calcularResumoAging(items);

    const sumBuckets =
      result.a_vencer +
      result.d1_30 +
      result.d31_60 +
      result.d61_90 +
      result.d90_mais;

    expect(result.total).toBe(sumBuckets);
  });

  it('handles single client', () => {
    const items: AgingComCliente[] = [
      {
        cliente_id: 'solo',
        a_vencer: 750,
        d1_30: 0,
        d31_60: 0,
        d61_90: 0,
        d90_mais: 0,
        total_aberto: 750,
        maior_atraso: 0,
        nome_fantasia: 'Solo Client',
        razao_social: 'Solo SA',
      },
    ];

    const result = calcularResumoAging(items);

    expect(result.a_vencer).toBe(750);
    expect(result.d1_30).toBe(0);
    expect(result.d31_60).toBe(0);
    expect(result.d61_90).toBe(0);
    expect(result.d90_mais).toBe(0);
    expect(result.total).toBe(750);
  });
});
