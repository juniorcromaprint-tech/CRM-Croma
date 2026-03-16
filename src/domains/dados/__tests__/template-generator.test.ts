// src/domains/dados/__tests__/template-generator.test.ts
import { describe, it, expect } from 'vitest';
import { generateTemplateData } from '../engine/template-generator';

describe('template-generator', () => {
  it('should generate template with instruction row, headers, and examples', () => {
    const columns = [
      { key: 'nome', label: 'Nome', type: 'text' as const, required: true },
      { key: 'codigo', label: 'Código', type: 'text' as const, required: true },
      { key: 'preco', label: 'Preço', type: 'number' as const, required: false },
    ];
    const examples = [{ nome: 'Lona', codigo: 'LONA-01', preco: '25.00' }];
    const result = generateTemplateData(columns, examples, 'Matéria-Prima');

    // Row 0: instruction
    expect(result[0][0]).toContain('Preencha');
    // Row 1: headers with * on required
    expect(result[1]).toContain('nome*');
    expect(result[1]).toContain('codigo*');
    expect(result[1]).toContain('preco');
    // Row 2: example
    expect(result[2]).toContain('Lona');
  });
});
