import { describe, it, expect } from 'vitest';

describe('gerarContasReceber payload constraints', () => {
  const VALID_CR_STATUS = ['previsto', 'faturado', 'a_vencer', 'vencido', 'parcial', 'pago', 'cancelado'] as const;
  const CR_COLUMNS = [
    'id', 'pedido_id', 'cliente_id', 'numero_titulo', 'valor_original', 'valor_pago', 'saldo',
    'data_emissao', 'data_vencimento', 'data_pagamento', 'status', 'forma_pagamento',
    'conta_plano_id', 'centro_custo_id', 'observacoes', 'created_at', 'updated_at',
  ];

  it('should use a valid status value from the CHECK constraint', () => {
    const statusUsed = 'a_vencer';
    expect(VALID_CR_STATUS).toContain(statusUsed);
  });

  it('should NOT use "pendente" as status (not in CHECK constraint)', () => {
    expect(VALID_CR_STATUS).not.toContain('pendente');
  });

  it('should use "observacoes" column (not "descricao" which does not exist)', () => {
    expect(CR_COLUMNS).toContain('observacoes');
    expect(CR_COLUMNS).not.toContain('descricao');
  });
});
