import { describe, it, expect } from 'vitest';
import { getRegisteredTypes } from '../registry';

// Import registerAll AFTER registry to avoid circular deps
// Using dynamic import to reset module state
describe('registerAll', () => {
  it('should register all action types', async () => {
    await import('../registerAll');
    const types = getRegisteredTypes();
    expect(types.length).toBeGreaterThanOrEqual(18);
    expect(types).toContain('preco');
    expect(types).toContain('adicionar_item');
    expect(types).toContain('trocar_material');
    expect(types).toContain('criar_tarefa');
    expect(types).toContain('mover_pedido');
    expect(types).toContain('notificar_responsavel');
    expect(types).toContain('definir_modelo');
    expect(types).toContain('adicionar_servico');
    expect(types).toContain('criar_alerta');
  });
});
