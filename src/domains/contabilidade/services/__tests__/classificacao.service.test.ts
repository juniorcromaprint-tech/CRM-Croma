import { describe, it, expect } from 'vitest';
import type { RegraClassificacao, ExtratoItem } from '../../types/contabilidade.types';

// Extract pure matching logic for testing (without Supabase)
function matchByRule(
  descricao: string,
  regras: Pick<RegraClassificacao, 'id' | 'padrao' | 'tipo_match' | 'conta_plano_id' | 'centro_custo_id' | 'vezes_usado' | 'ativo'>[]
): (typeof regras)[0] | null {
  const desc = descricao.toUpperCase();
  for (const regra of regras) {
    const padrao = regra.padrao.toUpperCase();
    switch (regra.tipo_match) {
      case 'exact':
        if (desc === padrao) return regra;
        break;
      case 'starts_with':
        if (desc.startsWith(padrao)) return regra;
        break;
      case 'contains':
      default:
        if (desc.includes(padrao)) return regra;
        break;
    }
  }
  return null;
}

function extractKeyword(descricao: string): string {
  return descricao
    .replace(/\d{2}\/\d{2}\/?\d{0,4}/g, '')
    .replace(/\d{10,}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 50);
}

const mockRegras = [
  { id: '1', padrao: 'ENERGIA', tipo_match: 'contains' as const, conta_plano_id: 'conta-energia', centro_custo_id: null, vezes_usado: 5, ativo: true },
  { id: '2', padrao: 'PIX RECEBIDO', tipo_match: 'starts_with' as const, conta_plano_id: 'conta-receita', centro_custo_id: null, vezes_usado: 10, ativo: true },
  { id: '3', padrao: 'ALUGUEL MARÇO 2026', tipo_match: 'exact' as const, conta_plano_id: 'conta-aluguel', centro_custo_id: null, vezes_usado: 1, ativo: true },
  { id: '4', padrao: 'INATIVA', tipo_match: 'contains' as const, conta_plano_id: 'conta-x', centro_custo_id: null, vezes_usado: 0, ativo: false },
];

describe('Classificação automática por regras', () => {
  describe('tipo_match: contains', () => {
    it('match por "contains" — descrição contém o padrão', () => {
      const result = matchByRule('ENERGIA ELETRICA 03/2026', mockRegras);
      expect(result?.id).toBe('1');
      expect(result?.conta_plano_id).toBe('conta-energia');
    });

    it('match por "contains" é case-insensitive', () => {
      const result = matchByRule('energia eletrica', mockRegras);
      expect(result?.id).toBe('1');
    });

    it('não faz match quando padrão não está na descrição', () => {
      const result = matchByRule('PAGTO FORNECEDOR', [mockRegras[0]]);
      expect(result).toBeNull();
    });
  });

  describe('tipo_match: starts_with', () => {
    it('match por "starts_with" quando descrição começa com o padrão', () => {
      const result = matchByRule('PIX RECEBIDO - CLIENTE ABC LTDA', mockRegras);
      expect(result?.id).toBe('2');
      expect(result?.conta_plano_id).toBe('conta-receita');
    });

    it('não faz match por "starts_with" quando padrão está no meio', () => {
      const result = matchByRule('TRANSFERENCIA PIX RECEBIDO', [mockRegras[1]]);
      expect(result).toBeNull();
    });
  });

  describe('tipo_match: exact', () => {
    it('match por "exact" quando descrição é exatamente igual ao padrão (case-insensitive)', () => {
      const result = matchByRule('ALUGUEL MARÇO 2026', mockRegras);
      expect(result?.id).toBe('3');
    });

    it('não faz match por "exact" quando há diferença no texto', () => {
      const result = matchByRule('ALUGUEL MARÇO 2026 EXTRA', [mockRegras[2]]);
      expect(result).toBeNull();
    });
  });

  describe('ordem de prioridade', () => {
    it('retorna a primeira regra que faz match', () => {
      const regrasOrdenadas = [
        { id: 'A', padrao: 'PIX', tipo_match: 'contains' as const, conta_plano_id: 'conta-A', centro_custo_id: null, vezes_usado: 1, ativo: true },
        { id: 'B', padrao: 'PIX RECEBIDO', tipo_match: 'starts_with' as const, conta_plano_id: 'conta-B', centro_custo_id: null, vezes_usado: 10, ativo: true },
      ];
      const result = matchByRule('PIX RECEBIDO TESTE', regrasOrdenadas);
      expect(result?.id).toBe('A'); // primeira que faz match
    });
  });

  describe('sem match', () => {
    it('retorna null quando nenhuma regra faz match', () => {
      const result = matchByRule('TARIFA BANCARIA', mockRegras);
      expect(result).toBeNull();
    });

    it('retorna null para lista de regras vazia', () => {
      const result = matchByRule('QUALQUER COISA', []);
      expect(result).toBeNull();
    });
  });
});

describe('extractKeyword', () => {
  it('remove datas no formato DD/MM', () => {
    const result = extractKeyword('ENERGIA ELETRICA 10/03');
    expect(result).not.toContain('10/03');
  });

  it('remove datas no formato DD/MM/YYYY', () => {
    const result = extractKeyword('PAGTO 10/03/2026 FORNECEDOR');
    expect(result).not.toContain('10/03/2026');
  });

  it('remove números longos (IDs de transação)', () => {
    const result = extractKeyword('PIX 12345678901234 CLIENTE ABC');
    expect(result).not.toContain('12345678901234');
  });

  it('limita a 50 caracteres', () => {
    const long = 'A'.repeat(100);
    const result = extractKeyword(long);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it('normaliza espaços duplos', () => {
    const result = extractKeyword('TEXTO   COM   ESPACOS');
    expect(result).toBe('TEXTO COM ESPACOS');
  });
});
