# AI Actionable Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the AI system from read-only analysis into actionable suggestions that users can apply with one click, across all 5 AI functions.

**Architecture:** New `AIAction` type replaces passive `AIResponse`. Frontend applier registry executes typed actions against Supabase. Reusable `AISidebar` component replaces all current result panels. Edge Function prompts updated to return structured actions.

**Tech Stack:** React 19, TypeScript, TanStack Query v5, Supabase Edge Functions (Deno), OpenRouter API, Tailwind CSS, shadcn/ui, Vitest

**Spec:** `docs/superpowers/specs/2026-03-15-ai-actionable-redesign-design.md`

---

## Chunk 1: Types & Applier Foundation

### Task 1: New AI Types

**Files:**
- Modify: `src/domains/ai/types/ai.types.ts`

- [ ] **Step 1: Write test for new types**

Create: `src/domains/ai/types/__tests__/ai.types.test.ts`

```typescript
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
      'revalidar_orcamento', 'mover_pedido', 'notificar_responsavel',
    ];
    expect(allTypes).toHaveLength(18);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/ai/types/__tests__/ai.types.test.ts`
Expected: FAIL — types not exported yet

- [ ] **Step 3: Add new types to ai.types.ts**

Append to `src/domains/ai/types/ai.types.ts` (keep all existing types):

```typescript
// ═══════════════════════════════════════════════════════════
// AI Actionable System — v2
// ═══════════════════════════════════════════════════════════

export type AIActionType =
  // Orçamento
  | 'preco'
  | 'adicionar_item'
  | 'trocar_material'
  | 'adicionar_acabamento'
  | 'ajustar_quantidade'
  | 'corrigir_erro'
  // Composição
  | 'definir_modelo'
  | 'adicionar_material'
  | 'adicionar_servico'
  // Cliente
  | 'criar_tarefa'
  | 'agendar_contato'
  | 'aplicar_desconto'
  // Produção
  | 'criar_checklist'
  | 'marcar_pendencia'
  | 'atribuir_responsavel'
  // Problemas
  | 'revalidar_orcamento'
  | 'mover_pedido'
  | 'notificar_responsavel';

export type AIActionSeveridade = 'critica' | 'importante' | 'dica';

export interface AIAction {
  id: string;
  tipo: AIActionType;
  severidade: AIActionSeveridade;
  titulo: string;
  descricao: string;
  campo_alvo: string;
  valor_atual: unknown;
  valor_sugerido: unknown;
  impacto: string;
  aplicavel: boolean;
}

export interface AIActionableResponse {
  summary: string;
  kpis: Record<string, number | string>;
  actions: AIAction[];
  model_used: string;
  tokens_used: number;
}

export type AIActionStatus = 'idle' | 'applying' | 'applied' | 'error';

export interface ApplierContext {
  supabase: import('@supabase/supabase-js').SupabaseClient;
  userId: string;
  entityId: string;
  entityType: string;
}

export interface ApplierResult {
  success: boolean;
  message: string;
  rollback?: () => Promise<void>;
}

export type ApplierFn = (action: AIAction, context: ApplierContext) => Promise<ApplierResult>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/ai/types/__tests__/ai.types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/ai/types/ai.types.ts src/domains/ai/types/__tests__/ai.types.test.ts
git commit -m "feat(ai): add AIAction, AIActionableResponse, and Applier types"
```

---

### Task 2: Applier Registry

**Files:**
- Create: `src/domains/ai/appliers/registry.ts`

- [ ] **Step 1: Write test**

Create: `src/domains/ai/appliers/__tests__/registry.test.ts`

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/ai/appliers/__tests__/registry.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement registry**

Create: `src/domains/ai/appliers/registry.ts`

```typescript
import type { AIActionType, AIAction, ApplierContext, ApplierResult, ApplierFn } from '../types/ai.types';

const applierRegistry = new Map<AIActionType, ApplierFn>();

export function registerApplier(type: AIActionType, fn: ApplierFn): void {
  applierRegistry.set(type, fn);
}

export async function executeAction(
  action: AIAction,
  context: ApplierContext
): Promise<ApplierResult> {
  const applier = applierRegistry.get(action.tipo);
  if (!applier) {
    return {
      success: false,
      message: `Tipo de ação desconhecido: ${action.tipo}`,
    };
  }

  try {
    return await applier(action, context);
  } catch (error) {
    return {
      success: false,
      message: `Erro ao aplicar ${action.tipo}: ${(error as Error).message}`,
    };
  }
}

export async function executeActions(
  actions: AIAction[],
  context: ApplierContext
): Promise<Map<string, ApplierResult>> {
  const results = new Map<string, ApplierResult>();
  for (const action of actions) {
    const result = await executeAction(action, context);
    results.set(action.id, result);
  }
  return results;
}

export function getRegisteredTypes(): AIActionType[] {
  return [...applierRegistry.keys()];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/ai/appliers/__tests__/registry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/ai/appliers/registry.ts src/domains/ai/appliers/__tests__/registry.test.ts
git commit -m "feat(ai): add applier registry with executeAction and executeActions"
```

---

### Task 3: Orçamento Appliers (6 appliers)

**Files:**
- Create: `src/domains/ai/appliers/orcamento/precoApplier.ts`
- Create: `src/domains/ai/appliers/orcamento/adicionarItemApplier.ts`
- Create: `src/domains/ai/appliers/orcamento/materialApplier.ts`
- Create: `src/domains/ai/appliers/orcamento/acabamentoApplier.ts`
- Create: `src/domains/ai/appliers/orcamento/quantidadeApplier.ts`
- Create: `src/domains/ai/appliers/orcamento/erroApplier.ts`
- Create: `src/domains/ai/appliers/orcamento/index.ts`

- [ ] **Step 1: Write tests for all 6 orçamento appliers**

Create: `src/domains/ai/appliers/orcamento/__tests__/orcamentoAppliers.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { precoApplier } from '../precoApplier';
import { adicionarItemApplier } from '../adicionarItemApplier';
import { materialApplier } from '../materialApplier';
import { acabamentoApplier } from '../acabamentoApplier';
import { quantidadeApplier } from '../quantidadeApplier';
import { erroApplier } from '../erroApplier';
import type { AIAction, ApplierContext } from '../../../types/ai.types';

// Mock supabase chain
function createMockSupabase(responseData: any = {}, error: any = null) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
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
    expect(supabase.update).toHaveBeenCalledWith(expect.objectContaining({ preco_unitario: 680 }));
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domains/ai/appliers/orcamento/__tests__/orcamentoAppliers.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement precoApplier.ts**

```typescript
import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function precoApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const suggested = action.valor_sugerido as { item_id: string; preco: number };
  const previous = action.valor_atual as { item_id: string; preco: number };

  if (!suggested?.item_id || !suggested?.preco) {
    return { success: false, message: 'Dados insuficientes: item_id e preco obrigatórios' };
  }

  const { error } = await ctx.supabase
    .from('proposta_itens')
    .update({ preco_unitario: suggested.preco })
    .eq('id', suggested.item_id)
    .eq('proposta_id', ctx.entityId)
    .select()
    .single();

  if (error) return { success: false, message: `Erro ao atualizar preço: ${error.message}` };

  return {
    success: true,
    message: `Preço atualizado de R$ ${previous?.preco?.toFixed(2) ?? '?'} para R$ ${suggested.preco.toFixed(2)}`,
    rollback: async () => {
      if (previous?.preco) {
        await ctx.supabase
          .from('proposta_itens')
          .update({ preco_unitario: previous.preco })
          .eq('id', suggested.item_id);
      }
    },
  };
}
```

- [ ] **Step 4: Implement adicionarItemApplier.ts**

```typescript
import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function adicionarItemApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const suggested = action.valor_sugerido as Record<string, unknown>;

  if (action.campo_alvo === 'servicos') {
    const { data, error } = await ctx.supabase
      .from('proposta_servicos')
      .insert({
        proposta_id: ctx.entityId,
        servico_id: suggested.servico_id ?? null,
        nome_servico: suggested.nome as string,
        preco: suggested.valor as number,
      })
      .select()
      .single();

    if (error) return { success: false, message: `Erro ao adicionar serviço: ${error.message}` };

    return {
      success: true,
      message: `Serviço "${suggested.nome}" adicionado (R$ ${(suggested.valor as number).toFixed(2)})`,
      rollback: async () => {
        if (data?.id) await ctx.supabase.from('proposta_servicos').delete().eq('id', data.id);
      },
    };
  }

  // Default: add as proposta_itens
  const { data, error } = await ctx.supabase
    .from('proposta_itens')
    .insert({
      proposta_id: ctx.entityId,
      descricao: suggested.descricao as string,
      quantidade: (suggested.quantidade as number) ?? 1,
      preco_unitario: suggested.preco as number,
      preco_total: suggested.preco as number,
    })
    .select()
    .single();

  if (error) return { success: false, message: `Erro ao adicionar item: ${error.message}` };

  return {
    success: true,
    message: `Item "${suggested.descricao}" adicionado`,
    rollback: async () => {
      if (data?.id) await ctx.supabase.from('proposta_itens').delete().eq('id', data.id);
    },
  };
}
```

- [ ] **Step 5: Implement materialApplier.ts**

```typescript
import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function materialApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const previous = action.valor_atual as { material_id: string; item_id: string } | null;
  const suggested = action.valor_sugerido as { material_id: string; nome: string; preco: number };

  if (!suggested?.material_id) {
    return { success: false, message: 'Material sugerido não tem ID válido' };
  }

  if (previous?.material_id && previous?.item_id) {
    // Update existing
    const { error } = await ctx.supabase
      .from('proposta_item_materiais')
      .update({
        material_id: suggested.material_id,
        nome_material: suggested.nome,
        preco_unitario: suggested.preco,
      })
      .eq('material_id', previous.material_id)
      .eq('proposta_item_id', previous.item_id)
      .select()
      .single();

    if (error) return { success: false, message: `Erro ao trocar material: ${error.message}` };

    return {
      success: true,
      message: `Material trocado para "${suggested.nome}"`,
      rollback: async () => {
        await ctx.supabase
          .from('proposta_item_materiais')
          .update({ material_id: previous.material_id })
          .eq('material_id', suggested.material_id)
          .eq('proposta_item_id', previous.item_id);
      },
    };
  }

  // Insert new material
  const { data, error } = await ctx.supabase
    .from('proposta_item_materiais')
    .insert({
      proposta_item_id: (suggested as any).item_id,
      material_id: suggested.material_id,
      nome_material: suggested.nome,
      preco_unitario: suggested.preco,
      quantidade: 1,
      preco_total: suggested.preco,
    })
    .select()
    .single();

  if (error) return { success: false, message: `Erro ao adicionar material: ${error.message}` };

  return {
    success: true,
    message: `Material "${suggested.nome}" adicionado`,
    rollback: async () => {
      if (data?.id) await ctx.supabase.from('proposta_item_materiais').delete().eq('id', data.id);
    },
  };
}
```

- [ ] **Step 6: Implement acabamentoApplier.ts**

```typescript
import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function acabamentoApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const suggested = action.valor_sugerido as {
    acabamento_id: string; item_id: string; nome: string; preco: number;
  };

  const { data, error } = await ctx.supabase
    .from('proposta_item_acabamentos')
    .insert({
      proposta_item_id: suggested.item_id,
      acabamento_id: suggested.acabamento_id,
      nome_acabamento: suggested.nome,
      preco: suggested.preco,
    })
    .select()
    .single();

  if (error) return { success: false, message: `Erro ao adicionar acabamento: ${error.message}` };

  return {
    success: true,
    message: `Acabamento "${suggested.nome}" adicionado (R$ ${suggested.preco.toFixed(2)})`,
    rollback: async () => {
      if (data?.id) await ctx.supabase.from('proposta_item_acabamentos').delete().eq('id', data.id);
    },
  };
}
```

- [ ] **Step 7: Implement quantidadeApplier.ts**

```typescript
import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function quantidadeApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const previous = action.valor_atual as { item_id: string; quantidade: number };
  const suggested = action.valor_sugerido as { item_id: string; quantidade: number };

  const { error } = await ctx.supabase
    .from('proposta_itens')
    .update({ quantidade: suggested.quantidade })
    .eq('id', suggested.item_id)
    .eq('proposta_id', ctx.entityId)
    .select()
    .single();

  if (error) return { success: false, message: `Erro ao ajustar quantidade: ${error.message}` };

  return {
    success: true,
    message: `Quantidade ajustada de ${previous?.quantidade ?? '?'} para ${suggested.quantidade}`,
    rollback: async () => {
      if (previous?.quantidade != null) {
        await ctx.supabase
          .from('proposta_itens')
          .update({ quantidade: previous.quantidade })
          .eq('id', suggested.item_id);
      }
    },
  };
}
```

- [ ] **Step 8: Implement erroApplier.ts**

```typescript
import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function erroApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const previous = action.valor_atual as { item_id: string; campo: string; valor: unknown };
  const suggested = action.valor_sugerido as { item_id: string; campo: string; valor: unknown };

  // Determine table from campo_alvo (e.g., "proposta_itens.largura")
  const [table, field] = action.campo_alvo.includes('.')
    ? action.campo_alvo.split('.')
    : ['proposta_itens', action.campo_alvo];

  const updateData = { [field ?? suggested.campo]: suggested.valor };

  const { error } = await ctx.supabase
    .from(table)
    .update(updateData)
    .eq('id', suggested.item_id)
    .select()
    .single();

  if (error) return { success: false, message: `Erro ao corrigir: ${error.message}` };

  return {
    success: true,
    message: `Campo "${field ?? suggested.campo}" corrigido: ${String(previous?.valor)} → ${String(suggested.valor)}`,
    rollback: async () => {
      if (previous?.valor != null) {
        await ctx.supabase
          .from(table)
          .update({ [field ?? previous.campo]: previous.valor })
          .eq('id', suggested.item_id);
      }
    },
  };
}
```

- [ ] **Step 9: Create index barrel for orcamento appliers**

Create: `src/domains/ai/appliers/orcamento/index.ts`

```typescript
export { precoApplier } from './precoApplier';
export { adicionarItemApplier } from './adicionarItemApplier';
export { materialApplier } from './materialApplier';
export { acabamentoApplier } from './acabamentoApplier';
export { quantidadeApplier } from './quantidadeApplier';
export { erroApplier } from './erroApplier';
```

- [ ] **Step 10: Run tests**

Run: `npx vitest run src/domains/ai/appliers/orcamento/__tests__/orcamentoAppliers.test.ts`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add src/domains/ai/appliers/orcamento/
git commit -m "feat(ai): add 6 orçamento appliers (preco, item, material, acabamento, quantidade, erro)"
```

---

### Task 4: Other Domain Appliers (composição, cliente, produção, problemas)

**Files:**
- Create: `src/domains/ai/appliers/composicao/modeloApplier.ts`
- Create: `src/domains/ai/appliers/composicao/servicoApplier.ts`
- Create: `src/domains/ai/appliers/composicao/index.ts`
- Create: `src/domains/ai/appliers/cliente/tarefaApplier.ts`
- Create: `src/domains/ai/appliers/cliente/contatoApplier.ts`
- Create: `src/domains/ai/appliers/cliente/descontoApplier.ts`
- Create: `src/domains/ai/appliers/cliente/index.ts`
- Create: `src/domains/ai/appliers/producao/checklistApplier.ts`
- Create: `src/domains/ai/appliers/producao/pendenciaApplier.ts`
- Create: `src/domains/ai/appliers/producao/responsavelApplier.ts`
- Create: `src/domains/ai/appliers/producao/index.ts`
- Create: `src/domains/ai/appliers/problemas/revalidarApplier.ts`
- Create: `src/domains/ai/appliers/problemas/moverPedidoApplier.ts`
- Create: `src/domains/ai/appliers/problemas/notificarApplier.ts`
- Create: `src/domains/ai/appliers/problemas/index.ts`

- [ ] **Step 1: Write tests for all 4 domain appliers**

Create: `src/domains/ai/appliers/__tests__/domainAppliers.test.ts`

Follow same pattern as Task 3 tests. Each applier:
- Test happy path (supabase returns success)
- Verify correct table is called via `supabase.from()`
- Verify result has `success: true` and descriptive message

- [ ] **Step 2: Implement composição appliers**

`modeloApplier.ts` — updates `proposta_itens.modelo_id` via `supabase.from('proposta_itens').update({ modelo_id })`.
`servicoApplier.ts` — reuses same pattern as `adicionarItemApplier` for services.

- [ ] **Step 3: Implement cliente appliers**

`tarefaApplier.ts` — inserts into `leads` or relevant activity table with follow-up data.
`contatoApplier.ts` — inserts scheduled contact/follow-up.
`descontoApplier.ts` — updates `propostas.desconto` field.

- [ ] **Step 4: Implement produção appliers**

`checklistApplier.ts` — inserts checklist items linked to pedido.
`pendenciaApplier.ts` — updates status of blocking item.
`responsavelApplier.ts` — updates `pedido_itens.responsavel_id`.

- [ ] **Step 5: Implement problemas appliers**

`revalidarApplier.ts` — updates `propostas.validade` and `propostas.status`.
`moverPedidoApplier.ts` — updates `pedidos.status` (respecting transition map from Sprint 1).
`notificarApplier.ts` — calls Supabase edge function or inserts notification record.

- [ ] **Step 6: Create index barrel for each domain**

- [ ] **Step 7: Run all tests**

Run: `npx vitest run src/domains/ai/appliers/`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add src/domains/ai/appliers/composicao/ src/domains/ai/appliers/cliente/ src/domains/ai/appliers/producao/ src/domains/ai/appliers/problemas/
git commit -m "feat(ai): add composição, cliente, produção, and problemas appliers"
```

---

### Task 5: Register All Appliers

**Files:**
- Create: `src/domains/ai/appliers/registerAll.ts`

- [ ] **Step 1: Write test**

Create: `src/domains/ai/appliers/__tests__/registerAll.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { getRegisteredTypes } from '../registry';
import '../registerAll'; // side-effect: registers all appliers

describe('registerAll', () => {
  it('should register all 18 action types', () => {
    const types = getRegisteredTypes();
    expect(types.length).toBeGreaterThanOrEqual(18);
    expect(types).toContain('preco');
    expect(types).toContain('adicionar_item');
    expect(types).toContain('trocar_material');
    expect(types).toContain('criar_tarefa');
    expect(types).toContain('mover_pedido');
    expect(types).toContain('notificar_responsavel');
  });
});
```

- [ ] **Step 2: Implement registerAll.ts**

```typescript
import { registerApplier } from './registry';
import { precoApplier, adicionarItemApplier, materialApplier, acabamentoApplier, quantidadeApplier, erroApplier } from './orcamento';
import { modeloApplier, servicoApplier } from './composicao';
import { tarefaApplier, contatoApplier, descontoApplier } from './cliente';
import { checklistApplier, pendenciaApplier, responsavelApplier } from './producao';
import { revalidarApplier, moverPedidoApplier, notificarApplier } from './problemas';

// Orçamento
registerApplier('preco', precoApplier);
registerApplier('adicionar_item', adicionarItemApplier);
registerApplier('trocar_material', materialApplier);
registerApplier('adicionar_acabamento', acabamentoApplier);
registerApplier('ajustar_quantidade', quantidadeApplier);
registerApplier('corrigir_erro', erroApplier);

// Composição
registerApplier('definir_modelo', modeloApplier);
registerApplier('adicionar_material', materialApplier); // reuses
registerApplier('adicionar_servico', servicoApplier);

// Cliente
registerApplier('criar_tarefa', tarefaApplier);
registerApplier('agendar_contato', contatoApplier);
registerApplier('aplicar_desconto', descontoApplier);

// Produção
registerApplier('criar_checklist', checklistApplier);
registerApplier('marcar_pendencia', pendenciaApplier);
registerApplier('atribuir_responsavel', responsavelApplier);

// Problemas
registerApplier('revalidar_orcamento', revalidarApplier);
registerApplier('mover_pedido', moverPedidoApplier);
registerApplier('notificar_responsavel', notificarApplier);
```

- [ ] **Step 3: Run test and commit**

Run: `npx vitest run src/domains/ai/appliers/__tests__/registerAll.test.ts`

```bash
git add src/domains/ai/appliers/registerAll.ts src/domains/ai/appliers/__tests__/registerAll.test.ts
git commit -m "feat(ai): register all 18 appliers in registerAll"
```

---

## Chunk 2: UI Components (AISidebar)

### Task 6: AIStatusBadge Component

**Files:**
- Create: `src/domains/ai/components/AIStatusBadge.tsx`

- [ ] **Step 1: Write test**

Create: `src/domains/ai/components/__tests__/AIStatusBadge.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AIStatusBadge from '../AIStatusBadge';

describe('AIStatusBadge', () => {
  it('renders idle state with no visible badge', () => {
    const { container } = render(<AIStatusBadge status="idle" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders applying state with spinner', () => {
    render(<AIStatusBadge status="applying" />);
    expect(screen.getByText('Aplicando...')).toBeTruthy();
  });

  it('renders applied state with check', () => {
    render(<AIStatusBadge status="applied" />);
    expect(screen.getByText('Aplicado')).toBeTruthy();
  });

  it('renders error state with message', () => {
    render(<AIStatusBadge status="error" message="Falha no banco" />);
    expect(screen.getByText('Falha no banco')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Implement AIStatusBadge**

```typescript
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import type { AIActionStatus } from '../types/ai.types';

interface AIStatusBadgeProps {
  status: AIActionStatus;
  message?: string;
}

export default function AIStatusBadge({ status, message }: AIStatusBadgeProps) {
  if (status === 'idle') return null;

  const config = {
    applying: { icon: <Loader2 size={12} className="animate-spin" />, text: 'Aplicando...', className: 'text-blue-600 bg-blue-50' },
    applied: { icon: <CheckCircle size={12} />, text: 'Aplicado', className: 'text-green-600 bg-green-50' },
    error: { icon: <XCircle size={12} />, text: message ?? 'Erro', className: 'text-red-600 bg-red-50' },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.className}`}>
      {config.icon}
      {config.text}
    </span>
  );
}
```

- [ ] **Step 3: Run test and commit**

```bash
npx vitest run src/domains/ai/components/__tests__/AIStatusBadge.test.tsx
git add src/domains/ai/components/AIStatusBadge.tsx src/domains/ai/components/__tests__/AIStatusBadge.test.tsx
git commit -m "feat(ai): add AIStatusBadge component"
```

---

### Task 7: AIActionPreview Component

**Files:**
- Create: `src/domains/ai/components/AIActionPreview.tsx`

- [ ] **Step 1: Implement AIActionPreview**

```typescript
import { brl } from '@/shared/utils/format';

interface AIActionPreviewProps {
  valorAtual: unknown;
  valorSugerido: unknown;
  tipo: string;
}

export default function AIActionPreview({ valorAtual, valorSugerido, tipo }: AIActionPreviewProps) {
  const rows = buildDiffRows(valorAtual, valorSugerido, tipo);

  if (rows.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg overflow-hidden border border-slate-200 text-xs">
      <div className="grid grid-cols-2 bg-slate-100 text-slate-500 font-medium">
        <div className="px-3 py-1.5 border-r border-slate-200">ANTES</div>
        <div className="px-3 py-1.5">DEPOIS</div>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-2 border-t border-slate-100">
          <div className="px-3 py-1.5 border-r border-slate-100 text-slate-400 line-through">
            {row.before}
          </div>
          <div className="px-3 py-1.5 text-slate-800 font-medium">
            {row.after}
          </div>
        </div>
      ))}
    </div>
  );
}

function buildDiffRows(atual: unknown, sugerido: unknown, tipo: string) {
  const rows: { before: string; after: string }[] = [];
  const a = atual as Record<string, unknown> | null;
  const s = sugerido as Record<string, unknown>;

  if (!s) return rows;

  if (tipo === 'preco' || tipo === 'ajustar_quantidade') {
    const field = tipo === 'preco' ? 'preco' : 'quantidade';
    const formatFn = tipo === 'preco' ? (v: number) => brl(v) : (v: number) => String(v);
    rows.push({
      before: a?.[field] != null ? formatFn(a[field] as number) : '—',
      after: formatFn(s[field] as number),
    });
  } else if (tipo === 'trocar_material' || tipo === 'adicionar_material') {
    rows.push({
      before: (a?.nome as string) ?? '—',
      after: s.nome as string,
    });
    if (s.preco != null) {
      rows.push({
        before: a?.preco != null ? brl(a.preco as number) : '—',
        after: brl(s.preco as number),
      });
    }
  } else if (tipo === 'aplicar_desconto') {
    rows.push({
      before: a?.desconto != null ? `${a.desconto}%` : '0%',
      after: `${s.desconto}%`,
    });
  } else {
    // Generic: show nome/valor
    if (s.nome) rows.push({ before: '—', after: s.nome as string });
    if (s.valor != null) rows.push({ before: '—', after: brl(s.valor as number) });
  }

  return rows;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/ai/components/AIActionPreview.tsx
git commit -m "feat(ai): add AIActionPreview diff component"
```

---

### Task 8: AIActionCard Component

**Files:**
- Create: `src/domains/ai/components/AIActionCard.tsx`

- [ ] **Step 1: Write test**

Create: `src/domains/ai/components/__tests__/AIActionCard.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AIActionCard from '../AIActionCard';
import type { AIAction, AIActionStatus } from '../../types/ai.types';

const mockAction: AIAction = {
  id: 'act_1',
  tipo: 'preco',
  severidade: 'critica',
  titulo: 'Margem baixa',
  descricao: 'Margem de 18% está abaixo do mínimo',
  campo_alvo: 'itens',
  valor_atual: { item_id: '1', preco: 500 },
  valor_sugerido: { item_id: '1', preco: 680 },
  impacto: '+R$ 180',
  aplicavel: true,
};

describe('AIActionCard', () => {
  it('renders action title and description', () => {
    render(<AIActionCard action={mockAction} selected={false} status="idle" onToggle={() => {}} />);
    expect(screen.getByText('Margem baixa')).toBeTruthy();
    expect(screen.getByText('Margem de 18% está abaixo do mínimo')).toBeTruthy();
  });

  it('shows impact badge', () => {
    render(<AIActionCard action={mockAction} selected={false} status="idle" onToggle={() => {}} />);
    expect(screen.getByText('+R$ 180')).toBeTruthy();
  });

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(<AIActionCard action={mockAction} selected={false} status="idle" onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith('act_1');
  });

  it('disables checkbox when status is applied', () => {
    render(<AIActionCard action={mockAction} selected={true} status="applied" onToggle={() => {}} />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });
});
```

- [ ] **Step 2: Implement AIActionCard**

```typescript
import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, AlertTriangle, Lightbulb } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import AIActionPreview from './AIActionPreview';
import AIStatusBadge from './AIStatusBadge';
import type { AIAction, AIActionStatus, AIActionSeveridade } from '../types/ai.types';

interface AIActionCardProps {
  action: AIAction;
  selected: boolean;
  status: AIActionStatus;
  statusMessage?: string;
  onToggle: (id: string) => void;
}

const SEVERITY_CONFIG: Record<AIActionSeveridade, {
  bg: string; border: string; Icon: typeof AlertCircle; iconClass: string;
}> = {
  critica: { bg: 'bg-red-500/10', border: 'border-red-500/30', Icon: AlertCircle, iconClass: 'text-red-500' },
  importante: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', Icon: AlertTriangle, iconClass: 'text-amber-500' },
  dica: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', Icon: Lightbulb, iconClass: 'text-blue-500' },
};

export default function AIActionCard({ action, selected, status, statusMessage, onToggle }: AIActionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = SEVERITY_CONFIG[action.severidade];
  const isDisabled = status === 'applied' || status === 'applying';
  const appliedBg = status === 'applied' ? 'bg-green-500/10 border-green-500/30' : '';

  return (
    <div className={`rounded-xl border p-3 transition-all ${appliedBg || `${config.bg} ${config.border}`}`}>
      <div className="flex items-start gap-2">
        <Checkbox
          role="checkbox"
          checked={selected || status === 'applied'}
          disabled={isDisabled}
          onCheckedChange={() => onToggle(action.id)}
          className="mt-0.5"
        />
        <config.Icon size={14} className={`${config.iconClass} mt-0.5 shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-800 truncate">{action.titulo}</h4>
            <div className="flex items-center gap-1.5 shrink-0">
              {status !== 'idle' && <AIStatusBadge status={status} message={statusMessage} />}
              <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                {action.impacto}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{action.descricao}</p>

          {/* Expand/collapse preview */}
          {action.aplicavel && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 mt-1.5"
            >
              {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              {expanded ? 'Ocultar preview' : 'Ver antes/depois'}
            </button>
          )}

          {expanded && (
            <AIActionPreview
              valorAtual={action.valor_atual}
              valorSugerido={action.valor_sugerido}
              tipo={action.tipo}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run test and commit**

```bash
npx vitest run src/domains/ai/components/__tests__/AIActionCard.test.tsx
git add src/domains/ai/components/AIActionCard.tsx src/domains/ai/components/__tests__/AIActionCard.test.tsx
git commit -m "feat(ai): add AIActionCard with checkbox, preview, and status"
```

---

### Task 9: AIKPIBar Component

**Files:**
- Create: `src/domains/ai/components/AIKPIBar.tsx`

- [ ] **Step 1: Implement AIKPIBar**

```typescript
import { brl } from '@/shared/utils/format';

interface AIKPIBarProps {
  kpis: Record<string, number | string>;
}

const KPI_DISPLAY: Record<string, { label: string; format: (v: number | string) => string; color?: string }> = {
  margem_atual: { label: 'Margem Atual', format: (v) => `${v}%`, color: 'text-red-500' },
  margem_sugerida: { label: 'Margem Sugerida', format: (v) => `${v}%`, color: 'text-green-500' },
  total_atual: { label: 'Total Atual', format: (v) => brl(Number(v)) },
  total_sugerido: { label: 'Total Sugerido', format: (v) => brl(Number(v)), color: 'text-green-500' },
  economia_possivel: { label: 'Economia', format: (v) => brl(Number(v)), color: 'text-blue-500' },
  ticket_medio: { label: 'Ticket Médio', format: (v) => brl(Number(v)) },
  total_pedidos: { label: 'Pedidos', format: (v) => String(v) },
  risco: { label: 'Risco', format: (v) => String(v) },
  custo_estimado: { label: 'Custo Estimado', format: (v) => brl(Number(v)) },
  prazo_producao: { label: 'Prazo', format: (v) => String(v) },
  total_pendencias: { label: 'Pendências', format: (v) => String(v) },
  total_alertas: { label: 'Alertas', format: (v) => String(v) },
  alertas_alta: { label: 'Alta', format: (v) => String(v), color: 'text-red-500' },
};

export default function AIKPIBar({ kpis }: AIKPIBarProps) {
  const entries = Object.entries(kpis).filter(([key]) => KPI_DISPLAY[key]);

  if (entries.length === 0) return null;

  // Show max 4 KPIs
  const displayEntries = entries.slice(0, 4);

  return (
    <div className={`grid grid-cols-${Math.min(displayEntries.length, 4)} gap-2`}>
      {displayEntries.map(([key, value]) => {
        const config = KPI_DISPLAY[key]!;
        return (
          <div key={key} className="bg-slate-800/50 rounded-lg px-3 py-2 text-center">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider">{config.label}</div>
            <div className={`text-sm font-bold mt-0.5 ${config.color ?? 'text-white'}`}>
              {config.format(value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/ai/components/AIKPIBar.tsx
git commit -m "feat(ai): add AIKPIBar component for sidebar header metrics"
```

---

### Task 10: AIApplyBar Component

**Files:**
- Create: `src/domains/ai/components/AIApplyBar.tsx`

- [ ] **Step 1: Implement AIApplyBar**

```typescript
import { Loader2, RefreshCw, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AIApplyBarProps {
  selectedCount: number;
  totalCount: number;
  isApplying: boolean;
  onApply: () => void;
  onSelectAll: () => void;
  onReanalyze: () => void;
  isReanalyzing: boolean;
}

export default function AIApplyBar({
  selectedCount,
  totalCount,
  isApplying,
  onApply,
  onSelectAll,
  onReanalyze,
  isReanalyzing,
}: AIApplyBarProps) {
  return (
    <div className="border-t border-slate-700 bg-slate-900 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{selectedCount} de {totalCount} selecionadas</span>
        <button
          onClick={onSelectAll}
          className="flex items-center gap-1 hover:text-white transition-colors"
          disabled={isApplying}
        >
          <CheckSquare size={12} />
          {selectedCount === totalCount ? 'Desmarcar Todas' : 'Selecionar Todas'}
        </button>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onReanalyze}
          disabled={isReanalyzing || isApplying}
          className="flex-1 rounded-xl gap-1.5 border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800"
        >
          {isReanalyzing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Re-analisar
        </Button>
        <Button
          size="sm"
          onClick={onApply}
          disabled={selectedCount === 0 || isApplying}
          className="flex-1 rounded-xl gap-1.5 bg-amber-500 hover:bg-amber-600 text-black font-bold"
        >
          {isApplying ? (
            <><Loader2 size={12} className="animate-spin" /> Aplicando...</>
          ) : (
            `Aplicar ${selectedCount} Selecionada${selectedCount !== 1 ? 's' : ''}`
          )}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/ai/components/AIApplyBar.tsx
git commit -m "feat(ai): add AIApplyBar footer component"
```

---

### Task 11: AISidebar Main Component

**Files:**
- Create: `src/domains/ai/components/AISidebar.tsx`

- [ ] **Step 1: Write test**

Create: `src/domains/ai/components/__tests__/AISidebar.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AISidebar from '../AISidebar';
import type { AIActionableResponse } from '../../types/ai.types';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

const mockResponse: AIActionableResponse = {
  summary: '3 sugestões encontradas',
  kpis: { margem_atual: 18, margem_sugerida: 35 },
  actions: [
    {
      id: 'act_1', tipo: 'preco', severidade: 'critica',
      titulo: 'Margem baixa', descricao: 'Margem de 18%',
      campo_alvo: 'itens', valor_atual: { preco: 500 }, valor_sugerido: { preco: 680 },
      impacto: '+R$ 180', aplicavel: true,
    },
  ],
  model_used: 'openai/gpt-4.1-mini',
  tokens_used: 1200,
};

describe('AISidebar', () => {
  it('renders title and summary', () => {
    render(
      <AISidebar
        isOpen={true}
        response={mockResponse}
        isLoading={false}
        onClose={() => {}}
        onApply={async () => new Map()}
        onReanalyze={() => {}}
        isReanalyzing={false}
      />,
      { wrapper }
    );
    expect(screen.getByText('Croma AI')).toBeTruthy();
    expect(screen.getByText('3 sugestões encontradas')).toBeTruthy();
  });

  it('renders action cards', () => {
    render(
      <AISidebar
        isOpen={true}
        response={mockResponse}
        isLoading={false}
        onClose={() => {}}
        onApply={async () => new Map()}
        onReanalyze={() => {}}
        isReanalyzing={false}
      />,
      { wrapper }
    );
    expect(screen.getByText('Margem baixa')).toBeTruthy();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <AISidebar
        isOpen={false}
        response={null}
        isLoading={false}
        onClose={() => {}}
        onApply={async () => new Map()}
        onReanalyze={() => {}}
        isReanalyzing={false}
      />,
      { wrapper }
    );
    expect(container.querySelector('[data-testid="ai-sidebar"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Implement AISidebar**

```typescript
import { useState, useCallback } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import AIActionCard from './AIActionCard';
import AIKPIBar from './AIKPIBar';
import AIApplyBar from './AIApplyBar';
import type { AIActionableResponse, AIActionStatus, ApplierResult } from '../types/ai.types';

interface AISidebarProps {
  isOpen: boolean;
  response: AIActionableResponse | null;
  isLoading: boolean;
  onClose: () => void;
  onApply: (actionIds: string[]) => Promise<Map<string, ApplierResult>>;
  onReanalyze: () => void;
  isReanalyzing: boolean;
  title?: string;
}

export default function AISidebar({
  isOpen,
  response,
  isLoading,
  onClose,
  onApply,
  onReanalyze,
  isReanalyzing,
  title = 'Análise',
}: AISidebarProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionStatuses, setActionStatuses] = useState<Map<string, AIActionStatus>>(new Map());
  const [statusMessages, setStatusMessages] = useState<Map<string, string>>(new Map());
  const [isApplying, setIsApplying] = useState(false);

  const applicableActions = response?.actions.filter((a) => a.aplicavel) ?? [];
  const totalApplicable = applicableActions.length;

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === totalApplicable) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(applicableActions.map((a) => a.id)));
    }
  }, [selectedIds.size, totalApplicable, applicableActions]);

  const handleApply = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    setIsApplying(true);

    // Set all selected to "applying"
    const newStatuses = new Map(actionStatuses);
    ids.forEach((id) => newStatuses.set(id, 'applying'));
    setActionStatuses(new Map(newStatuses));

    try {
      const results = await onApply(ids);

      const finalStatuses = new Map(actionStatuses);
      const finalMessages = new Map(statusMessages);

      results.forEach((result, id) => {
        finalStatuses.set(id, result.success ? 'applied' : 'error');
        finalMessages.set(id, result.message);
      });

      setActionStatuses(finalStatuses);
      setStatusMessages(finalMessages);
      setSelectedIds(new Set()); // Clear selection after apply
    } finally {
      setIsApplying(false);
    }
  }, [selectedIds, actionStatuses, statusMessages, onApply]);

  // Reset state when new response comes in
  const handleReanalyze = useCallback(() => {
    setSelectedIds(new Set());
    setActionStatuses(new Map());
    setStatusMessages(new Map());
    onReanalyze();
  }, [onReanalyze]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="ai-sidebar"
      className="fixed right-0 top-0 h-full w-[380px] bg-slate-900 text-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-amber-500" />
          <span className="font-bold text-sm">Croma AI</span>
          <span className="text-slate-500">|</span>
          <span className="text-sm text-slate-300">{title}</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-slate-800 rounded-xl h-20" />
            ))}
          </div>
        ) : response ? (
          <div className="p-4 space-y-4">
            {/* Summary */}
            <p className="text-xs text-slate-400">{response.summary}</p>

            {/* KPIs */}
            <AIKPIBar kpis={response.kpis} />

            {/* Action Cards */}
            <div className="space-y-2">
              {response.actions.map((action) => (
                <AIActionCard
                  key={action.id}
                  action={action}
                  selected={selectedIds.has(action.id)}
                  status={actionStatuses.get(action.id) ?? 'idle'}
                  statusMessage={statusMessages.get(action.id)}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer */}
      {response && totalApplicable > 0 && (
        <AIApplyBar
          selectedCount={selectedIds.size}
          totalCount={totalApplicable}
          isApplying={isApplying}
          onApply={handleApply}
          onSelectAll={handleSelectAll}
          onReanalyze={handleReanalyze}
          isReanalyzing={isReanalyzing}
        />
      )}

      {/* Model footer */}
      {response && (
        <div className="px-4 py-1.5 border-t border-slate-800 flex justify-between text-[9px] text-slate-500">
          <span>{response.model_used}</span>
          <span>{response.tokens_used} tokens</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run tests and commit**

```bash
npx vitest run src/domains/ai/components/__tests__/AISidebar.test.tsx
git add src/domains/ai/components/AISidebar.tsx src/domains/ai/components/__tests__/AISidebar.test.tsx
git commit -m "feat(ai): add AISidebar main component with selection, apply, and re-analyze"
```

---

## Chunk 3: Hooks & Integration

### Task 12: useAISidebar Hook

**Files:**
- Create: `src/domains/ai/hooks/useAISidebar.ts`

- [ ] **Step 1: Implement useAISidebar**

```typescript
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { executeActions } from '../appliers/registry';
import '../appliers/registerAll'; // side-effect: register all appliers
import type { AIActionableResponse, ApplierResult } from '../types/ai.types';
import { showSuccess, showError } from '@/utils/toast';

interface UseAISidebarOptions {
  entityType: string;
  entityId: string;
  onActionsApplied?: () => void; // callback to invalidate queries after apply
}

export function useAISidebar({ entityType, entityId, onActionsApplied }: UseAISidebarOptions) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [response, setResponse] = useState<AIActionableResponse | null>(null);

  const open = useCallback((data: AIActionableResponse) => {
    setResponse(data);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const applyActions = useCallback(
    async (actionIds: string[]): Promise<Map<string, ApplierResult>> => {
      if (!response || !user) return new Map();

      const actionsToApply = response.actions.filter((a) => actionIds.includes(a.id));

      const results = await executeActions(actionsToApply, {
        supabase,
        userId: user.id,
        entityId,
        entityType,
      });

      // Count successes
      const successes = [...results.values()].filter((r) => r.success).length;
      const failures = [...results.values()].filter((r) => !r.success).length;

      if (successes > 0) {
        showSuccess(`${successes} ação(ões) aplicada(s) com sucesso`);
        onActionsApplied?.();
      }
      if (failures > 0) {
        showError(`${failures} ação(ões) falharam`);
      }

      return results;
    },
    [response, user, entityId, entityType, onActionsApplied]
  );

  return {
    isOpen,
    response,
    open,
    close,
    applyActions,
    setResponse,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/ai/hooks/useAISidebar.ts
git commit -m "feat(ai): add useAISidebar hook with apply logic"
```

---

### Task 13: Update Existing Hooks to Return AIActionableResponse

**Files:**
- Modify: `src/domains/ai/hooks/useAnalisarOrcamento.ts`
- Modify: `src/domains/ai/hooks/useResumoCliente.ts`
- Modify: `src/domains/ai/hooks/useBriefingProducao.ts`
- Modify: `src/domains/ai/hooks/useDetectarProblemas.ts`
- Modify: `src/domains/ai/hooks/useComposicaoProduto.ts`

- [ ] **Step 1: Update useAnalisarOrcamento.ts**

Change `AIResponse` import to `AIActionableResponse`. Update return type:

```typescript
import type { AIActionableResponse } from '../types/ai.types';

export function useAnalisarOrcamento() {
  return useMutation({
    mutationFn: async (propostaId: string): Promise<AIActionableResponse> => {
      const { data, error } = await supabase.functions.invoke('ai-analisar-orcamento', {
        body: { proposta_id: propostaId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as AIActionableResponse;
    },
    onError: (err: Error) => showError(err.message || 'Erro ao analisar orcamento'),
  });
}
```

- [ ] **Step 2: Update remaining 4 hooks with same pattern**

Each hook: change `AIResponse` → `AIActionableResponse` in import and return type.

- [ ] **Step 3: Commit**

```bash
git add src/domains/ai/hooks/
git commit -m "refactor(ai): update all 5 hooks to return AIActionableResponse"
```

---

### Task 14: Integrate AISidebar into OrcamentoEditorPage

**Files:**
- Modify: `src/domains/comercial/pages/OrcamentoEditorPage.tsx`

- [ ] **Step 1: Add imports**

Add at top of file:

```typescript
import AISidebar from '@/domains/ai/components/AISidebar';
import { useAISidebar } from '@/domains/ai/hooks/useAISidebar';
```

- [ ] **Step 2: Replace analiseResult state with useAISidebar**

Remove: `const [analiseResult, setAnaliseResult] = useState<AIResponse | null>(null);`

Add:

```typescript
const aiSidebar = useAISidebar({
  entityType: 'proposta',
  entityId: id ?? '',
  onActionsApplied: () => {
    // Invalidate proposta queries to reflect changes
    queryClient.invalidateQueries({ queryKey: ['proposta', id] });
  },
});
```

- [ ] **Step 3: Update AIButton onClick**

Replace the `onSuccess` callback to open sidebar:

```typescript
<AIButton
  label="Analisar Orcamento"
  onClick={() => {
    analisarOrcamento.mutate(id!, {
      onSuccess: (data) => aiSidebar.open(data),
    });
  }}
  isLoading={analisarOrcamento.isPending}
/>
```

- [ ] **Step 4: Replace OrcamentoAnalise with AISidebar**

Remove the `<OrcamentoAnalise>` render block. Add at the end of the component's return JSX:

```tsx
<AISidebar
  isOpen={aiSidebar.isOpen}
  response={aiSidebar.response}
  isLoading={analisarOrcamento.isPending}
  onClose={aiSidebar.close}
  onApply={aiSidebar.applyActions}
  onReanalyze={() => analisarOrcamento.mutate(id!, {
    onSuccess: (data) => aiSidebar.setResponse(data),
  })}
  isReanalyzing={analisarOrcamento.isPending}
  title="Análise do Orçamento"
/>
```

- [ ] **Step 5: Remove unused imports**

Remove imports for `OrcamentoAnalise`, `AIResultPanel`, old `AIResponse` type.

- [ ] **Step 6: Build check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/domains/comercial/pages/OrcamentoEditorPage.tsx
git commit -m "feat(ai): integrate AISidebar into OrcamentoEditorPage"
```

---

### Task 15: Integrate AISidebar into ClienteDetailPage

**Files:**
- Modify: `src/domains/clientes/pages/ClienteDetailPage.tsx`

- [ ] **Step 1: Add useAISidebar + imports, replace ClienteResumo with AISidebar**

Same pattern as Task 14:
- `useAISidebar({ entityType: 'cliente', entityId: id })`
- AIButton opens sidebar on success
- AISidebar renders at bottom of JSX
- Remove `ClienteResumo` usage

- [ ] **Step 2: Build check and commit**

```bash
npx tsc --noEmit
git add src/domains/clientes/pages/ClienteDetailPage.tsx
git commit -m "feat(ai): integrate AISidebar into ClienteDetailPage"
```

---

### Task 16: Integrate AISidebar into DashboardDiretor

**Files:**
- Modify: `src/domains/comercial/pages/DashboardDiretor.tsx`

- [ ] **Step 1: Replace ProblemasPanel with AISidebar integration**

- `useAISidebar({ entityType: 'geral', entityId: 'dashboard' })`
- Detectar problemas button opens sidebar
- Each problem action card has entity-level actions

- [ ] **Step 2: Build check and commit**

```bash
npx tsc --noEmit
git add src/domains/comercial/pages/DashboardDiretor.tsx
git commit -m "feat(ai): integrate AISidebar into DashboardDiretor"
```

---

## Chunk 4: Backend — Edge Function Prompts

### Task 17: Update ai-shared Types

**Files:**
- Modify: `supabase/functions/ai-shared/ai-types.ts`

- [ ] **Step 1: Add AIActionableResponse type**

Append to the existing file (keep all existing types for backward compat):

```typescript
// ═══════ AI Actionable Response v2 ═══════

export interface AIActionV2 {
  id: string;
  tipo: string;
  severidade: 'critica' | 'importante' | 'dica';
  titulo: string;
  descricao: string;
  campo_alvo: string;
  valor_atual: unknown;
  valor_sugerido: unknown;
  impacto: string;
  aplicavel: boolean;
}

export interface AIActionableResponse {
  summary: string;
  kpis: Record<string, number | string>;
  actions: AIActionV2[];
  model_used: string;
  tokens_used: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/ai-shared/ai-types.ts
git commit -m "feat(ai): add AIActionableResponse type to Edge Functions"
```

---

### Task 18: Update prompt-builder.ts

**Files:**
- Modify: `supabase/functions/ai-shared/prompt-builder.ts`

- [ ] **Step 1: Add universal action instruction**

Add a new constant `ACTION_INSTRUCTION` and update all 5 prompts to use the new JSON format with `kpis` and `actions` arrays instead of the old `risks`/`suggestions`/`structured_data` format.

The key change for each prompt:
- Replace `"risks": [...]` + `"suggestions": [...]` + `"structured_data": {...}` with `"kpis": {...}` + `"actions": [...]`
- Add the universal instruction about returning actions with `tipo`, `campo_alvo`, `valor_atual`, `valor_sugerido`, `impacto`, `aplicavel`
- Include list of allowed `tipo` values per function

Example for `analisarOrcamento`:

```typescript
analisarOrcamento: `TAREFA: Analisar este orcamento e retornar sugestoes ACIONAVEIS.

${ACTION_INSTRUCTION}

Tipos permitidos para esta funcao: preco, adicionar_item, trocar_material, adicionar_acabamento, ajustar_quantidade, corrigir_erro

Retorne JSON com esta estrutura EXATA:
{
  "summary": "resumo em 1-2 frases",
  "kpis": {
    "margem_atual": 0.0,
    "margem_sugerida": 0.0,
    "total_atual": 0.0,
    "total_sugerido": 0.0,
    "economia_possivel": 0.0
  },
  "actions": [
    {
      "id": "act_1",
      "tipo": "preco",
      "severidade": "critica|importante|dica",
      "titulo": "titulo curto",
      "descricao": "explicacao em 1-2 frases",
      "campo_alvo": "itens|servicos|materiais",
      "valor_atual": {"item_id": "uuid", "preco": 0.0},
      "valor_sugerido": {"item_id": "uuid", "preco": 0.0},
      "impacto": "+R$ 0,00",
      "aplicavel": true
    }
  ]
}

CHECKLIST de analise:
1. Margem estimada — alerta se < 30% → acao tipo "preco"
2. Itens faltantes — instalacao, frete, acabamento, arte → acao tipo "adicionar_item"
3. Material mais barato disponivel → acao tipo "trocar_material"
4. Acabamento obrigatorio ausente → acao tipo "adicionar_acabamento"
5. Quantidade vs historico do cliente → acao tipo "ajustar_quantidade"
6. Erros (medidas, dados inconsistentes) → acao tipo "corrigir_erro"

IMPORTANTE: Use IDs reais dos itens/materiais/servicos do contexto fornecido.
Sempre preencha valor_atual com dados reais e valor_sugerido com a correcao.`,
```

- [ ] **Step 2: Update remaining 4 prompts**

Apply same pattern to `resumoCliente`, `briefingProducao`, `detectarProblemas`, `composicaoProduto` — each with their allowed types and specific KPIs.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/ai-shared/prompt-builder.ts
git commit -m "feat(ai): update all 5 prompts for actionable response format"
```

---

### Task 19: Update Edge Function Handlers

**Files:**
- Modify: `supabase/functions/ai-analisar-orcamento/index.ts`
- Modify: `supabase/functions/ai-resumo-cliente/index.ts`
- Modify: `supabase/functions/ai-briefing-producao/index.ts`
- Modify: `supabase/functions/ai-detectar-problemas/index.ts`
- Modify: `supabase/functions/ai-composicao-produto/index.ts`

- [ ] **Step 1: Update ai-analisar-orcamento**

Main changes:
1. Enrich context with available `materiais` and `servicos` IDs (so AI can suggest real IDs)
2. Parse response as `AIActionableResponse` format
3. Add `max_tokens: 3000` (actions need more tokens than old format)

Add before the AI call:

```typescript
// Load available materials and services for suggestions
const { data: materiais } = await supabase
  .from('materiais')
  .select('id, nome, preco_medio, categoria')
  .gt('preco_medio', 0)
  .limit(50);

const { data: servicos } = await supabase
  .from('servicos')
  .select('id, nome, preco_base');

const { data: acabamentos } = await supabase
  .from('acabamentos')
  .select('id, nome, preco_padrao');

// Add to context
const context = {
  proposta,
  regras_precificacao: regras ?? [],
  historico_cliente: historico ?? [],
  materiais_disponiveis: materiais ?? [],
  servicos_disponiveis: servicos ?? [],
  acabamentos_disponiveis: acabamentos ?? [],
  data_atual: new Date().toISOString().split('T')[0],
};
```

Update `callOpenRouter` config:

```typescript
const result = await callOpenRouter(systemPrompt, userPrompt, { max_tokens: 3000 });
```

- [ ] **Step 2: Update remaining 4 edge functions**

Same pattern: enrich context with available entities, increase max_tokens to 3000.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/
git commit -m "feat(ai): update all 5 Edge Functions for actionable response format"
```

---

## Chunk 5: Final Verification

### Task 20: Full Test Suite

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All existing tests pass + new tests pass

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Build check**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 4: Commit if any fixes needed**

### Task 21: Cleanup Deprecated Components

- [ ] **Step 1: Add deprecation comments to old components**

Add `/** @deprecated Use AISidebar instead */` to:
- `src/domains/ai/components/AIResultPanel.tsx`
- `src/domains/ai/components/OrcamentoAnalise.tsx`

Do NOT delete them yet — other pages may still reference them.

- [ ] **Step 2: Commit**

```bash
git add src/domains/ai/components/AIResultPanel.tsx src/domains/ai/components/OrcamentoAnalise.tsx
git commit -m "chore(ai): mark AIResultPanel and OrcamentoAnalise as deprecated"
```

### Task 22: Final Commit & Summary

- [ ] **Step 1: Verify git status is clean**

Run: `git status`

- [ ] **Step 2: Push branch**

Run: `git push -u origin HEAD`
