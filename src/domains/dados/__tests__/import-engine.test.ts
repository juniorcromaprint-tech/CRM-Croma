// src/domains/dados/__tests__/import-engine.test.ts
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validateRows, classifyRows, detectDuplicates } from '../engine/import-engine';
import type { ValidationError } from '../engine/validators/common';

const simpleSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  codigo: z.string().min(1, 'Código é obrigatório'),
  preco: z.string().optional().transform(v => v ? parseFloat(v) : null).pipe(z.number().nullable()),
});

describe('import-engine', () => {
  describe('validateRows', () => {
    it('should return valid rows and no errors for valid input', () => {
      const rows = [
        { nome: 'Lona', codigo: 'LONA-01', preco: '25.50' },
        { nome: 'Vinil', codigo: 'VINIL-01', preco: '18.00' },
      ];
      const { valid, errors } = validateRows(rows, simpleSchema);
      expect(valid).toHaveLength(2);
      expect(errors).toHaveLength(0);
      expect(valid[0].preco).toBe(25.5);
    });

    it('should return errors for invalid rows', () => {
      const rows = [
        { nome: '', codigo: 'LONA-01', preco: '25.50' },
        { nome: 'Vinil', codigo: '', preco: '18.00' },
      ];
      const { valid, errors } = validateRows(rows, simpleSchema);
      expect(valid).toHaveLength(0);
      expect(errors).toHaveLength(2);
      expect(errors[0].row).toBe(0);
      expect(errors[1].row).toBe(1);
    });

    it('should include row index and field name in errors', () => {
      const rows = [{ nome: '', codigo: 'X', preco: '' }];
      const { errors } = validateRows(rows, simpleSchema);
      expect(errors[0].row).toBe(0);
      expect(errors[0].column).toBeTruthy();
    });
  });

  describe('classifyRows', () => {
    it('should classify new rows as inserts', () => {
      const validRows = [
        { nome: 'Lona', codigo: 'LONA-NEW', preco: 25 },
      ];
      const existingData = [
        { id: '1', codigo: 'LONA-OLD', nome: 'Lona Antiga', preco: 20 },
      ];
      const { inserts, updates, skips } = classifyRows(validRows, existingData, ['codigo']);
      expect(inserts).toHaveLength(1);
      expect(updates).toHaveLength(0);
      expect(skips).toHaveLength(0);
    });

    it('should classify matching rows as updates', () => {
      const validRows = [
        { nome: 'Lona Atualizada', codigo: 'LONA-01', preco: 30 },
      ];
      const existingData = [
        { id: '1', codigo: 'LONA-01', nome: 'Lona', preco: 25 },
      ];
      const { inserts, updates, skips } = classifyRows(validRows, existingData, ['codigo']);
      expect(inserts).toHaveLength(0);
      expect(updates).toHaveLength(1);
      expect(updates[0]._existingId).toBe('1');
    });
  });

  describe('detectDuplicates', () => {
    it('should detect duplicate rows by key', () => {
      const rows = [
        { codigo: 'LONA-01', nome: 'Lona 1' },
        { codigo: 'LONA-02', nome: 'Lona 2' },
        { codigo: 'LONA-01', nome: 'Lona Duplicada' },
      ];
      const dupes = detectDuplicates(rows, ['codigo']);
      expect(dupes).toHaveLength(1);
      expect(dupes[0].key).toBe('codigo:LONA-01');
      expect(dupes[0].rows).toEqual([0, 2]);
    });

    it('should return empty array when no duplicates', () => {
      const rows = [
        { codigo: 'LONA-01' },
        { codigo: 'LONA-02' },
      ];
      expect(detectDuplicates(rows, ['codigo'])).toHaveLength(0);
    });
  });
});
