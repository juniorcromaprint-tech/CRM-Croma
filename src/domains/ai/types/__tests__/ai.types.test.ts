import { describe, it, expect } from 'vitest';
import type { AIAction, AIActionType, AIActionableResponse, ApplierResult } from '../ai.types';

describe('AI Action types', () => {
  it('should accept a valid AIAction', () => {
    const action: AIAction = {
      id: 'act_1',
      tipo: 'preco',
      severidade: 'critica',
      titulo: 'Margem baixa',
      descricao: 'Margem de 18%',
      campo_alvo: 'itens',
      valor_atual: { item_id: '123', preco: 500 },
      valor_sugerido: { item_id: '123', preco: 680 },
      impacto: '+R$ 180',
      aplicavel: true,
    };
    expect(action.tipo).toBe('preco');
    expect(action.severidade).toBe('critica');
    expect(action.aplicavel).toBe(true);
  });

  it('should accept a valid AIActionableResponse', () => {
    const response: AIActionableResponse = {
      summary: 'Teste',
      kpis: { margem_atual: 18, margem_sugerida: 35 },
      actions: [],
      model_used: 'openai/gpt-4.1-mini',
      tokens_used: 100,
    };
    expect(response.actions).toEqual([]);
    expect(response.kpis.margem_atual).toBe(18);
  });

  it('should cover all action types', () => {
    const allTypes: AIActionType[] = [
      'preco', 'adicionar_item', 'trocar_material', 'adicionar_acabamento',
      'ajustar_quantidade', 'corrigir_erro', 'definir_modelo', 'adicionar_material',
      'adicionar_servico', 'criar_tarefa', 'agendar_contato', 'aplicar_desconto',
      'criar_checklist', 'marcar_pendencia', 'atribuir_responsavel',
      'revalidar_orcamento', 'mover_pedido', 'criar_alerta', 'notificar_responsavel',
    ];
    expect(allTypes).toHaveLength(19);
  });
});
