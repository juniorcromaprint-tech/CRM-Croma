// src/domains/dados/__tests__/file-parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseCSV, parseXLSX, detectHeaderRow, parseFile } from '../engine/file-parser';

describe('file-parser', () => {
  describe('parseCSV', () => {
    it('should parse semicolon-delimited CSV with BOM', () => {
      const csv = '\uFEFFnome;codigo;preco\nLona 380g;LONA-380;25.50\nVinil;VINIL-01;18.00';
      const result = parseCSV(csv);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ nome: 'Lona 380g', codigo: 'LONA-380', preco: '25.50' });
      expect(result[1]).toEqual({ nome: 'Vinil', codigo: 'VINIL-01', preco: '18.00' });
    });

    it('should handle quoted fields with semicolons', () => {
      const csv = 'nome;descricao\n"Lona; especial";teste';
      const result = parseCSV(csv);
      expect(result[0].nome).toBe('Lona; especial');
    });

    it('should handle empty values', () => {
      const csv = 'nome;codigo;preco\nLona;;25.50';
      const result = parseCSV(csv);
      expect(result[0].codigo).toBe('');
    });
  });

  describe('detectHeaderRow', () => {
    it('should detect header row when first row is instruction', () => {
      const rows = [
        { 'A': 'Preencha a partir da linha 4', 'B': '', 'C': '' },
        { 'A': 'nome*', 'B': 'codigo*', 'C': 'preco_medio' },
        { 'A': 'Exemplo Lona', 'B': 'LONA-001', 'C': '25.00' },
      ];
      const knownColumns = ['nome', 'codigo', 'preco_medio'];
      const headerIndex = detectHeaderRow(rows, knownColumns);
      expect(headerIndex).toBe(1);
    });

    it('should detect header row at index 0 when no instructions', () => {
      const rows = [
        { 'A': 'nome', 'B': 'codigo', 'C': 'preco_medio' },
        { 'A': 'Lona 380g', 'B': 'LONA-380', 'C': '25.50' },
      ];
      const knownColumns = ['nome', 'codigo', 'preco_medio'];
      const headerIndex = detectHeaderRow(rows, knownColumns);
      expect(headerIndex).toBe(0);
    });

    it('should strip asterisks from required column markers', () => {
      const rows = [
        { 'A': 'nome*', 'B': 'codigo*', 'C': 'preco_medio' },
        { 'A': 'Lona', 'B': 'LONA', 'C': '25' },
      ];
      const knownColumns = ['nome', 'codigo', 'preco_medio'];
      const headerIndex = detectHeaderRow(rows, knownColumns);
      expect(headerIndex).toBe(0);
    });
  });
});
