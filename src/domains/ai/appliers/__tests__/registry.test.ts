import { describe, it, expect, vi } from 'vitest';
import { executeAction, registerApplier } from '../registry';
import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

const mockAction: AIAction = {
  id: 'act_1',
  tipo: 'preco',
  severidade: 'critica',
  titulo: 'Test',
  descricao: 'Test action',
  campo_alvo: 'itens',
  valor_atual: { preco: 100 },
  valor_sugerido: { preco: 200 },
  impacto: '+R$ 100',
  aplicavel: true,
};

const mockContext: ApplierContext = {
  supabase: {} as any,
  userId: 'user-1',
  entityId: 'entity-1',
  entityType: 'proposta',
};

describe('Applier Registry', () => {
  it('should return error for unknown action type', async () => {
    const result = await executeAction(
      { ...mockAction, tipo: 'tipo_inexistente' as any },
      mockContext
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain('desconhecido');
  });

  it('should call registered applier', async () => {
    const mockApplier = vi.fn().mockResolvedValue({
      success: true,
      message: 'Preço atualizado',
    } satisfies ApplierResult);

    registerApplier('preco', mockApplier);

    const result = await executeAction(mockAction, mockContext);
    expect(mockApplier).toHaveBeenCalledWith(mockAction, mockContext);
    expect(result.success).toBe(true);
    expect(result.message).toBe('Preço atualizado');
  });

  it('should catch applier errors and return failure', async () => {
    registerApplier('preco', async () => {
      throw new Error('DB connection failed');
    });

    const result = await executeAction(mockAction, mockContext);
    expect(result.success).toBe(false);
    expect(result.message).toContain('DB connection failed');
  });
});
