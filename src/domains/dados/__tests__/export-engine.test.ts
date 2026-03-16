// src/domains/dados/__tests__/export-engine.test.ts
import { describe, it, expect } from 'vitest';
import { transformToExportFormat } from '../engine/export-engine';

describe('export-engine', () => {
  it('should transform query results to headers + rows format', () => {
    const columns = [
      { key: 'nome', label: 'Nome', type: 'text' as const, required: true },
      { key: 'preco_medio', label: 'Preço Médio', type: 'number' as const, required: false },
    ];
    const data = [
      { nome: 'Lona 380g', preco_medio: 25.5 },
      { nome: 'Vinil', preco_medio: 18.0 },
    ];
    const result = transformToExportFormat(data, columns);
    expect(result.headers).toEqual(['Nome', 'Preço Médio']);
    expect(result.rows).toEqual([
      ['Lona 380g', 25.5],
      ['Vinil', 18.0],
    ]);
  });

  it('should handle null values', () => {
    const columns = [
      { key: 'nome', label: 'Nome', type: 'text' as const, required: true },
      { key: 'preco', label: 'Preço', type: 'number' as const, required: false },
    ];
    const data = [{ nome: 'Test', preco: null }];
    const result = transformToExportFormat(data, columns);
    expect(result.rows[0]).toEqual(['Test', null]);
  });

  it('should filter columns when selectedColumns provided', () => {
    const columns = [
      { key: 'nome', label: 'Nome', type: 'text' as const, required: true },
      { key: 'codigo', label: 'Código', type: 'text' as const, required: true },
      { key: 'preco', label: 'Preço', type: 'number' as const, required: false },
    ];
    const data = [{ nome: 'Lona', codigo: 'LONA-01', preco: 25 }];
    const result = transformToExportFormat(data, columns, ['nome', 'preco']);
    expect(result.headers).toEqual(['Nome', 'Preço']);
    expect(result.rows[0]).toEqual(['Lona', 25]);
  });
});
