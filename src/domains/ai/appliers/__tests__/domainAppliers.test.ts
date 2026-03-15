import { describe, it, expect, vi } from 'vitest';
import { modeloApplier } from '../composicao/modeloApplier';
import { servicoApplier } from '../composicao/servicoApplier';
import { tarefaApplier } from '../cliente/tarefaApplier';
import { contatoApplier } from '../cliente/contatoApplier';
import { descontoApplier } from '../cliente/descontoApplier';
import { checklistApplier } from '../producao/checklistApplier';
import { pendenciaApplier } from '../producao/pendenciaApplier';
import { responsavelApplier } from '../producao/responsavelApplier';
import { revalidarApplier } from '../problemas/revalidarApplier';
import { moverPedidoApplier } from '../problemas/moverPedidoApplier';
import { alertaApplier } from '../problemas/alertaApplier';
import { notificarApplier } from '../problemas/notificarApplier';
import type { AIAction, ApplierContext } from '../../types/ai.types';

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
  id: 'act_1', tipo: 'definir_modelo', severidade: 'importante',
  titulo: 'Test', descricao: 'Test', campo_alvo: 'modelo',
  valor_atual: null, valor_sugerido: null, impacto: 'test', aplicavel: true,
};

const ctx = (supabase: any): ApplierContext => ({
  supabase, userId: 'u1', entityId: 'entity-1', entityType: 'proposta',
});

describe('modeloApplier', () => {
  it('should update modelo_id on proposta_itens', async () => {
    const supabase = createMockSupabase({ id: 'item-1' });
    const result = await modeloApplier(
      { ...baseAction, tipo: 'definir_modelo', valor_sugerido: { item_id: 'item-1', modelo_id: 'mod-1', nome: 'Banner' } },
      ctx(supabase)
    );
    expect(result.success).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('proposta_itens');
  });
});

describe('servicoApplier', () => {
  it('should insert into proposta_servicos', async () => {
    const supabase = createMockSupabase({ id: 'serv-1' });
    const result = await servicoApplier(
      { ...baseAction, tipo: 'adicionar_servico', valor_sugerido: { servico_id: 's1', nome: 'Arte', valor: 200 } },
      ctx(supabase)
    );
    expect(result.success).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('proposta_servicos');
  });
});

describe('tarefaApplier', () => {
  it('should insert into tarefas_comerciais', async () => {
    const supabase = createMockSupabase({ id: 'task-1' });
    const result = await tarefaApplier(
      { ...baseAction, tipo: 'criar_tarefa', valor_sugerido: { titulo: 'Ligar para cliente', descricao: 'desc', data_limite: '2026-03-20' } },
      ctx(supabase)
    );
    expect(result.success).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('tarefas_comerciais');
  });
});

describe('contatoApplier', () => {
  it('should insert follow-up into tarefas_comerciais', async () => {
    const supabase = createMockSupabase({ id: 'task-2' });
    const result = await contatoApplier(
      { ...baseAction, tipo: 'agendar_contato', valor_sugerido: { motivo: 'Follow-up', data_sugerida: '2026-03-22' } },
      ctx(supabase)
    );
    expect(result.success).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('tarefas_comerciais');
  });
});

describe('descontoApplier', () => {
  it('should update desconto on propostas', async () => {
    const supabase = createMockSupabase({ id: 'prop-1' });
    const result = await descontoApplier(
      { ...baseAction, tipo: 'aplicar_desconto', valor_sugerido: { desconto: 10 } },
      ctx(supabase)
    );
    expect(result.success).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('propostas');
  });
});

describe('checklistApplier', () => {
  it('should insert checklist item', async () => {
    const supabase = createMockSupabase({ id: 'check-1' });
    const result = await checklistApplier(
      { ...baseAction, tipo: 'criar_checklist', valor_sugerido: { item: 'Verificar medidas', pedido_id: 'ped-1' } },
      { supabase, userId: 'u1', entityId: 'ped-1', entityType: 'pedido' }
    );
    expect(result.success).toBe(true);
  });
});

describe('pendenciaApplier', () => {
  it('should mark pendencia as resolved', async () => {
    const supabase = createMockSupabase({ id: 'pend-1' });
    const result = await pendenciaApplier(
      { ...baseAction, tipo: 'marcar_pendencia', valor_sugerido: { pedido_item_id: 'item-1', status: 'resolvido' } },
      { supabase, userId: 'u1', entityId: 'ped-1', entityType: 'pedido' }
    );
    expect(result.success).toBe(true);
  });
});

describe('responsavelApplier', () => {
  it('should update responsavel_id on ordens_producao', async () => {
    const supabase = createMockSupabase({ id: 'ord-1' });
    const result = await responsavelApplier(
      { ...baseAction, tipo: 'atribuir_responsavel', valor_sugerido: { ordem_id: 'ord-1', responsavel_id: 'user-2' } },
      { supabase, userId: 'u1', entityId: 'ped-1', entityType: 'pedido' }
    );
    expect(result.success).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('ordens_producao');
  });
});

describe('revalidarApplier', () => {
  it('should update proposta validade', async () => {
    const supabase = createMockSupabase({ id: 'prop-1' });
    const result = await revalidarApplier(
      { ...baseAction, tipo: 'revalidar_orcamento', valor_sugerido: { proposta_id: 'prop-1', nova_validade: '2026-04-01' } },
      ctx(supabase)
    );
    expect(result.success).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('propostas');
  });
});

describe('moverPedidoApplier', () => {
  it('should update pedido status', async () => {
    const supabase = createMockSupabase({ id: 'ped-1' });
    const result = await moverPedidoApplier(
      { ...baseAction, tipo: 'mover_pedido', valor_sugerido: { pedido_id: 'ped-1', novo_status: 'em_producao' } },
      { supabase, userId: 'u1', entityId: 'ped-1', entityType: 'pedido' }
    );
    expect(result.success).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('pedidos');
  });
});

describe('alertaApplier', () => {
  it('should insert into ai_alertas', async () => {
    const supabase = createMockSupabase({ id: 'alerta-1' });
    const result = await alertaApplier(
      { ...baseAction, tipo: 'criar_alerta', valor_sugerido: { titulo: 'Atenção', mensagem: 'Prazo próximo', nivel: 'alta' } },
      ctx(supabase)
    );
    expect(result.success).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('ai_alertas');
  });
});

describe('notificarApplier', () => {
  it('should insert notification record', async () => {
    const supabase = createMockSupabase({ id: 'notif-1' });
    const result = await notificarApplier(
      { ...baseAction, tipo: 'notificar_responsavel', valor_sugerido: { mensagem: 'Prazo crítico', responsavel_id: 'user-2' } },
      ctx(supabase)
    );
    expect(result.success).toBe(true);
  });
});
