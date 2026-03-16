import { describe, it, expect, vi, beforeEach } from 'vitest';
import { precoApplier } from '../precoApplier';
import { adicionarItemApplier } from '../adicionarItemApplier';
import { materialApplier } from '../materialApplier';
import { acabamentoApplier } from '../acabamentoApplier';
import { quantidadeApplier } from '../quantidadeApplier';
import { erroApplier } from '../erroApplier';
import type { AIAction, ApplierContext } from '../../../types/ai.types';

function createMockSupabase(responseData: any = {}, error: any = null) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: responseData, error }),
  };
  return chain as any;
}

const baseAction: AIAction = {
  id: 'act_1',
  tipo: 'preco',
  severidade: 'critica',
  titulo: 'Test',
  descricao: 'Test',
  campo_alvo: 'itens',
  valor_atual: null,
  valor_sugerido: null,
  impacto: 'test',
  aplicavel: true,
};

describe('precoApplier', () => {
  it('should update preco_unitario on proposta_itens', async () => {
    const supabase = createMockSupabase({ id: 'item-1' });
    const action: AIAction = {
      ...baseAction,
      tipo: 'preco',
      valor_atual: { item_id: 'item-1', preco: 500 },
      valor_sugerido: { item_id: 'item-1', preco: 680 },
    };
    const ctx: ApplierContext = { supabase, userId: 'u1', entityId: 'prop-1', entityType: 'proposta' };
    const result = await precoApplier(action, ctx);
    expect(result.success).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('proposta_itens');
    expect(supabase.update).toHaveBeenCalledWith(expect.objectContaining({ valor_unitario: 680 }), expect.any(Object));
  });
});

describe('adicionarItemApplier', () => {
  it('should insert into proposta_servicos for service items', async () => {
    const supabase = createMockSupabase({ id: 'serv-1' });
    const action: AIAction = {
      ...baseAction,
      tipo: 'adicionar_item',
      campo_alvo: 'servicos',
      valor_sugerido: { servico_id: 'serv-1', nome: 'Instalação', valor: 350 },
    };
    const ctx: ApplierContext = { supabase, userId: 'u1', entityId: 'prop-1', entityType: 'proposta' };
    const result = await adicionarItemApplier(action, ctx);
    expect(result.success).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('proposta_servicos');
  });
});

describe('materialApplier', () => {
  it('should update material on proposta_item_materiais', async () => {
    const supabase = createMockSupabase({ id: 'mat-1' });
    const action: AIAction = {
      ...baseAction,
      tipo: 'trocar_material',
      valor_atual: { material_id: 'mat-old', item_id: 'item-1' },
      valor_sugerido: { material_id: 'mat-new', nome: 'Lona 280g', preco: 28.5 },
    };
    const ctx: ApplierContext = { supabase, userId: 'u1', entityId: 'prop-1', entityType: 'proposta' };
    const result = await materialApplier(action, ctx);
    expect(result.success).toBe(true);
  });
});

describe('acabamentoApplier', () => {
  it('should insert acabamento into proposta_item_acabamentos', async () => {
    const supabase = createMockSupabase({ id: 'acab-1' });
    const action: AIAction = {
      ...baseAction,
      tipo: 'adicionar_acabamento',
      valor_sugerido: { acabamento_id: 'acab-1', item_id: 'item-1', nome: 'Ilhós', preco: 15 },
    };
    const ctx: ApplierContext = { supabase, userId: 'u1', entityId: 'prop-1', entityType: 'proposta' };
    const result = await acabamentoApplier(action, ctx);
    expect(result.success).toBe(true);
  });
});

describe('quantidadeApplier', () => {
  it('should update quantidade on proposta_itens', async () => {
    const supabase = createMockSupabase({ id: 'item-1' });
    const action: AIAction = {
      ...baseAction,
      tipo: 'ajustar_quantidade',
      valor_atual: { item_id: 'item-1', quantidade: 10 },
      valor_sugerido: { item_id: 'item-1', quantidade: 50 },
    };
    const ctx: ApplierContext = { supabase, userId: 'u1', entityId: 'prop-1', entityType: 'proposta' };
    const result = await quantidadeApplier(action, ctx);
    expect(result.success).toBe(true);
    expect(supabase.update).toHaveBeenCalledWith(expect.objectContaining({ quantidade: 50 }));
  });
});

describe('erroApplier', () => {
  it('should update the specified field', async () => {
    const supabase = createMockSupabase({ id: 'item-1' });
    const action: AIAction = {
      ...baseAction,
      tipo: 'corrigir_erro',
      campo_alvo: 'proposta_itens.largura',
      valor_atual: { item_id: 'item-1', campo: 'largura', valor: 0.5 },
      valor_sugerido: { item_id: 'item-1', campo: 'largura', valor: 5.0 },
    };
    const ctx: ApplierContext = { supabase, userId: 'u1', entityId: 'prop-1', entityType: 'proposta' };
    const result = await erroApplier(action, ctx);
    expect(result.success).toBe(true);
  });
});
