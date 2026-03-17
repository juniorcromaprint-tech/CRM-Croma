# Edição de Itens no Orçamento — Plano de Implementação

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir editar itens já adicionados ao orçamento — reabrir o wizard preenchido, alterar preço/markup, editar preço/m², e edição rápida inline na tabela.

**Architecture:** O wizard de 3 etapas já existe para criação. Adicionamos um modo "edit" que carrega os dados do item existente no `useItemEditor`, salva via `atualizarItemDetalhado` (replace) no service, e um campo inline na tabela para edição rápida de preço unitário.

**Tech Stack:** React 19, TypeScript, Supabase, TanStack Query v5, shadcn/ui, useItemEditor hook existente

---

### Task 1: Service — `atualizarItemDetalhado` no orcamento.service.ts

**Files:**
- Modify: `src/domains/comercial/services/orcamento.service.ts` (linha ~530)

**Step 1: Adicionar método `atualizarItemDetalhado` no service**

O service já tem `atualizarItem` (linha 532) que faz UPDATE simples no `proposta_itens`. Precisamos de um método que também substitui materiais, acabamentos e processos (delete+insert = replace strategy).

```typescript
// Adicionar após atualizarItem (linha ~542):

// ─── Atualizar item COM materiais e acabamentos (replace all) ────────────
async atualizarItemDetalhado(
  itemId: string,
  propostaId: string,
  item: OrcamentoItemCreateDetalhado,
): Promise<OrcamentoItem> {
  const { materiais, acabamentos, processos, ...itemBase } = item;

  // 1. Update item principal
  const { data: updatedItem, error } = await supabase
    .from("proposta_itens")
    .update({ ...itemBase })
    .eq("id", itemId)
    .select()
    .single();

  if (error) throw error;
  const itemResult = updatedItem as OrcamentoItem;

  // 2. Replace materiais (delete old + insert new)
  try {
    await supabase.from("proposta_item_materiais").delete().eq("proposta_item_id", itemId);
    if (materiais && materiais.length > 0) {
      await supabase.from("proposta_item_materiais").insert(
        materiais.map((m) => ({
          proposta_item_id: itemId,
          material_id: m.material_id ?? null,
          descricao: m.descricao,
          quantidade: m.quantidade,
          unidade: m.unidade,
          custo_unitario: m.custo_unitario,
          custo_total: m.custo_total,
        })),
      );
    }
  } catch {
    console.warn("[orcamento.service] proposta_item_materiais não disponível");
  }

  // 3. Replace acabamentos
  try {
    await supabase.from("proposta_item_acabamentos").delete().eq("proposta_item_id", itemId);
    if (acabamentos && acabamentos.length > 0) {
      await supabase.from("proposta_item_acabamentos").insert(
        acabamentos.map((a) => ({
          proposta_item_id: itemId,
          acabamento_id: a.acabamento_id ?? null,
          descricao: a.descricao,
          quantidade: a.quantidade,
          custo_unitario: a.custo_unitario,
          custo_total: a.custo_total,
        })),
      );
    }
  } catch {
    console.warn("[orcamento.service] proposta_item_acabamentos não disponível");
  }

  // 4. Replace processos
  try {
    await supabase.from("proposta_item_processos").delete().eq("proposta_item_id", itemId);
    if (processos && processos.length > 0) {
      await supabase.from("proposta_item_processos").insert(
        processos.map((p, idx) => ({
          proposta_item_id: itemId,
          etapa: p.etapa,
          tempo_minutos: p.tempo_minutos,
          ordem: p.ordem ?? idx,
        })),
      );
    }
  } catch {
    console.warn("[orcamento.service] proposta_item_processos não disponível");
  }

  return itemResult;
},
```

**Step 2: Commit**

```bash
git add src/domains/comercial/services/orcamento.service.ts
git commit -m "feat(orcamento): add atualizarItemDetalhado service method"
```

---

### Task 2: Hook — `useAtualizarItemDetalhado` no useOrcamentos.ts

**Files:**
- Modify: `src/domains/comercial/hooks/useOrcamentos.ts`

**Step 1: Adicionar hook TanStack Query para atualizar item detalhado**

Adicionar após `useAdicionarItemDetalhado` (linha ~185):

```typescript
// ─── Atualizar item detalhado (com materiais + acabamentos) ──────────────

export function useAtualizarItemDetalhado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, propostaId, item }: {
      itemId: string;
      propostaId: string;
      item: OrcamentoItemCreateDetalhado;
    }) => {
      const result = await orcamentoService.atualizarItemDetalhado(itemId, propostaId, item);
      await orcamentoService.recalcularTotais(propostaId);
      return result;
    },
    onSuccess: (_data, { propostaId }) => {
      qc.invalidateQueries({ queryKey: [ORCAMENTOS_QUERY_KEY, propostaId] });
      qc.invalidateQueries({ queryKey: [ORCAMENTOS_QUERY_KEY] });
      showSuccess("Item atualizado com sucesso!");
    },
    onError: (err: Error) => showError(err.message || "Erro ao atualizar item"),
  });
}
```

**Step 2: Commit**

```bash
git add src/domains/comercial/hooks/useOrcamentos.ts
git commit -m "feat(orcamento): add useAtualizarItemDetalhado mutation hook"
```

---

### Task 3: Hook — `loadItem` no useItemEditor.ts para modo edição

**Files:**
- Modify: `src/domains/comercial/hooks/useItemEditor.ts`

**Step 1: Adicionar `editingItemId` state + `loadItem` callback**

O hook `useItemEditor` precisa saber se está em modo edição (tem um `editingItemId`) e ter uma função `loadItem` que popula o estado a partir de um item existente do DB.

Adicionar no topo do hook (após `const [volumeApplied, setVolumeApplied]`):

```typescript
const [editingItemId, setEditingItemId] = useState<string | null>(null);
```

Adicionar antes do `reset`:

```typescript
// Load existing item data for edit mode
const loadItem = useCallback((item: {
  id: string;
  produto_id: string | null;
  modelo_id?: string | null;
  descricao: string;
  especificacao?: string | null;
  quantidade: number;
  largura_cm: number | null;
  altura_cm: number | null;
  markup_percentual: number;
  categoria?: string | null;
  materiais?: Array<{
    material_id: string | null;
    descricao: string;
    quantidade: number;
    unidade: string;
    custo_unitario: number;
    aproveitamento?: number;
  }>;
  acabamentos?: Array<{
    acabamento_id: string | null;
    descricao: string;
    quantidade: number;
    custo_unitario: number;
  }>;
  processos?: Array<{
    etapa: string;
    tempo_minutos: number;
    tempo_setup_min?: number;
  }>;
}) => {
  setEditingItemId(item.id);
  setNewItem({
    produto_id: item.produto_id,
    modelo_id: item.modelo_id ?? null,
    descricao: item.descricao,
    especificacao: item.especificacao ?? "",
    quantidade: item.quantidade,
    largura_cm: item.largura_cm,
    altura_cm: item.altura_cm,
    materiais: (item.materiais ?? []).map((m) => ({
      material_id: m.material_id,
      descricao: m.descricao,
      quantidade: m.quantidade,
      unidade: m.unidade,
      custo_unitario: m.custo_unitario,
      aproveitamento: m.aproveitamento ?? 100,
    })),
    acabamentos: (item.acabamentos ?? []).map((a) => ({
      acabamento_id: a.acabamento_id,
      descricao: a.descricao,
      quantidade: a.quantidade,
      custo_unitario: a.custo_unitario,
    })),
    processos: (item.processos ?? []).map((p) => ({
      etapa: p.etapa,
      tempo_minutos: p.tempo_minutos,
      tempo_setup_min: p.tempo_setup_min ?? 0,
    })),
    markup_percentual: item.markup_percentual,
    categoria: item.categoria ?? null,
  });
  setCurrentStep(1);
  setOverrideSource('markup');
  setPrecoOverrideValue(null);
  setPrecoM2OverrideValue(null);
  setVolumeApplied(false);
}, []);
```

Atualizar o `reset` para também limpar `editingItemId`:

```typescript
const reset = useCallback(() => {
  setNewItem(DEFAULT_ITEM);
  setCurrentStep(1);
  setOverrideSource('markup');
  setPrecoOverrideValue(null);
  setPrecoM2OverrideValue(null);
  setVolumeApplied(false);
  setEditingItemId(null);  // ← adicionar
}, []);
```

Atualizar o `return` para incluir `editingItemId` e `loadItem`:

```typescript
return {
  // State
  newItem,
  setNewItem,
  currentStep,
  overrideSource,
  isPrecoOverride,
  precoOverrideValue,
  precoM2OverrideValue,
  editingItemId,    // ← adicionar

  // ...existing...

  // Navigation
  nextStep,
  prevStep,
  reset,
  loadItem,         // ← adicionar
};
```

**Step 2: Commit**

```bash
git add src/domains/comercial/hooks/useItemEditor.ts
git commit -m "feat(orcamento): add loadItem + editingItemId to useItemEditor for edit mode"
```

---

### Task 4: Page — Botão Editar na tabela + wizard em modo edit

**Files:**
- Modify: `src/domains/comercial/pages/OrcamentoEditorPage.tsx`

**Step 1: Importar hook e ícone**

No import do lucide-react (linha 10), adicionar `Pencil`:

```typescript
import {
  ArrowLeft, Plus, Trash2, Save, Loader2, FileText,
  ChevronDown, ChevronUp, AlertTriangle, Package, Layers, CheckCircle,
  Pencil,  // ← adicionar
} from "lucide-react";
```

No import dos hooks (linha 22), adicionar `useAtualizarItemDetalhado`:

```typescript
import {
  useOrcamento,
  useCriarOrcamento,
  useAtualizarOrcamento,
  useAdicionarItemDetalhado,
  useAtualizarItemDetalhado,  // ← adicionar
  useRemoverItemOrcamento,
  useSalvarServicos,
} from "../hooks/useOrcamentos";
```

**Step 2: Instanciar o hook na page**

Após `const adicionarItem = useAdicionarItemDetalhado();` (linha 168), adicionar:

```typescript
const atualizarItemDet = useAtualizarItemDetalhado();
```

**Step 3: Adicionar `handleEditItem`**

Após `handleRemoveItem` (linha ~434), adicionar:

```typescript
const handleEditItem = (item: any) => {
  editor.loadItem({
    id: item.id,
    produto_id: item.produto_id,
    modelo_id: item.modelo_id,
    descricao: item.descricao,
    especificacao: item.especificacao,
    quantidade: item.quantidade,
    largura_cm: item.largura_cm,
    altura_cm: item.altura_cm,
    markup_percentual: item.markup_percentual,
    categoria: item.categoria,
    materiais: item.materiais?.map((m: any) => ({
      material_id: m.material_id,
      descricao: m.descricao,
      quantidade: m.quantidade,
      unidade: m.unidade,
      custo_unitario: m.custo_unitario,
      aproveitamento: m.aproveitamento ?? 100,
    })),
    acabamentos: item.acabamentos?.map((a: any) => ({
      acabamento_id: a.acabamento_id,
      descricao: a.descricao,
      quantidade: a.quantidade,
      custo_unitario: a.custo_unitario,
    })),
    processos: item.processos?.map((p: any) => ({
      etapa: p.etapa,
      tempo_minutos: p.tempo_minutos,
      tempo_setup_min: p.tempo_setup_min ?? 0,
    })),
  });
  setShowItemForm(true);
  setItemFormExpanded(true);
};
```

**Step 4: Modificar `handleAddItem` → `handleSaveItem` (add ou update)**

Renomear `handleAddItem` para `handleSaveItem` e adicionar branch para edição:

```typescript
const handleSaveItem = async () => {
  // ...mesmas validações existentes...

  try {
    if (editor.editingItemId) {
      // ── EDIT MODE ──
      await atualizarItemDet.mutateAsync({
        itemId: editor.editingItemId,
        propostaId: id,
        item: {
          produto_id: newItem.produto_id,
          modelo_id: newItem.modelo_id ?? undefined,
          descricao: newItem.descricao,
          especificacao: newItem.especificacao || null,
          quantidade: newItem.quantidade,
          unidade: "un",
          largura_cm: newItem.largura_cm,
          altura_cm: newItem.altura_cm,
          area_m2: pricingResult.areaM2,
          custo_mp: pricingResult.custoMP,
          custo_mo: pricingResult.custoMO,
          custo_fixo: Math.max(0, pricingResult.custoTotal - pricingResult.custoMP - pricingResult.custoMO),
          markup_percentual: newItem.markup_percentual,
          preco_override: editor.isPrecoOverride,
          valor_unitario: pricingResult.precoUnitario,
          valor_total: pricingResult.precoTotal,
          materiais: newItem.materiais.map((m) => ({
            material_id: m.material_id ?? null,
            descricao: m.descricao,
            quantidade: m.quantidade,
            unidade: m.unidade,
            custo_unitario: m.custo_unitario,
            custo_total: m.quantidade * m.custo_unitario,
          })),
          acabamentos: newItem.acabamentos.map((a) => ({
            acabamento_id: a.acabamento_id ?? null,
            descricao: a.descricao,
            quantidade: a.quantidade,
            custo_unitario: a.custo_unitario,
            custo_total: a.quantidade * a.custo_unitario,
          })),
          processos: newItem.processos.map((p, idx) => ({
            etapa: p.etapa,
            tempo_minutos: p.tempo_minutos,
            ordem: idx,
          })),
        },
      });
      showSuccess("Item atualizado com sucesso!");
    } else {
      // ── ADD MODE (código existente) ──
      await adicionarItem.mutateAsync({ ... }); // código existente
      showSuccess("Item adicionado com sucesso!");
    }

    editor.reset();
    setShowItemForm(false);
  } catch (err: any) {
    console.error("[handleSaveItem] Falha:", err);
    showError(err?.message || "Erro ao salvar item");
  }
};
```

**Step 5: Botão Editar (lápis) na tabela de itens**

Na tabela de itens existente (linha ~744), adicionar botão Editar antes do Trash2:

```tsx
<td className="py-3 px-3">
  <div className="flex items-center gap-1">
    <Button
      variant="ghost" size="icon"
      className="h-7 w-7 rounded-lg text-slate-300 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={() => handleEditItem(item)}
    >
      <Pencil size={14} />
    </Button>
    <Button
      variant="ghost" size="icon"
      className="h-7 w-7 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={() => handleRemoveItem(item.id)}
    >
      <Trash2 size={14} />
    </Button>
  </div>
</td>
```

**Step 6: Header do wizard muda texto quando editando**

Na linha ~772 onde diz "Novo Item — Etapa {currentStep} de 3", mudar para:

```tsx
<p className="text-sm font-semibold text-blue-800">
  {editor.editingItemId ? "Editar Item" : "Novo Item"} — Etapa {currentStep} de 3
</p>
```

**Step 7: Botão do Step 3 muda texto**

Na linha ~962, mudar o onClick de `handleAddItem` para `handleSaveItem` e texto dinâmico:

```tsx
<Button
  onClick={handleSaveItem}
  disabled={editor.isDefaultConfig || adicionarItem.isPending || atualizarItemDet.isPending || !pricingResult}
  className="rounded-xl bg-blue-600 text-white hover:bg-blue-700 px-6"
>
  {(adicionarItem.isPending || atualizarItemDet.isPending)
    ? <Loader2 className="animate-spin mr-2" size={14} />
    : editor.editingItemId
      ? <Pencil size={14} className="mr-2" />
      : <Plus size={14} className="mr-2" />
  }
  {editor.editingItemId ? "Salvar Alterações" : "Adicionar Item"}
</Button>
```

**Step 8: Commit**

```bash
git add src/domains/comercial/pages/OrcamentoEditorPage.tsx
git commit -m "feat(orcamento): edit button on items table + wizard edit mode"
```

---

### Task 5: Edição rápida inline de preço na tabela

**Files:**
- Modify: `src/domains/comercial/pages/OrcamentoEditorPage.tsx`

**Step 1: Adicionar state para inline editing**

Após as declarações de state existentes (~linha 184):

```typescript
const [inlineEditId, setInlineEditId] = useState<string | null>(null);
const [inlinePrice, setInlinePrice] = useState("");
```

**Step 2: Adicionar handler para salvar preço inline**

Após `handleEditItem`:

```typescript
const handleInlinePriceSave = async (itemId: string) => {
  if (!id) return;
  const valor = parseFloat(inlinePrice.replace(",", "."));
  if (isNaN(valor) || valor <= 0) {
    showError("Valor inválido");
    return;
  }
  // Buscar o item atual para calcular o total
  const item = orcamentoItens.find((i) => i.id === itemId);
  if (!item) return;
  const novoTotal = valor * item.quantidade;

  try {
    await orcamentoService.atualizarItem(itemId, {
      valor_unitario: valor,
      valor_total: novoTotal,
    });
    await orcamentoService.recalcularTotais(id);
    queryClient.invalidateQueries({ queryKey: [ORCAMENTOS_QUERY_KEY, id] });
    queryClient.invalidateQueries({ queryKey: [ORCAMENTOS_QUERY_KEY] });
    showSuccess("Preço atualizado!");
  } catch (err: any) {
    showError(err?.message || "Erro ao atualizar preço");
  }
  setInlineEditId(null);
  setInlinePrice("");
};
```

**Step 3: Mudar a célula de preço unitário na tabela para ser clicável/editável**

Substituir a célula `valor_unitario` (linha ~742):

```tsx
<td className="py-3 px-3 text-right text-slate-600 tabular-nums hidden md:table-cell">
  {inlineEditId === item.id ? (
    <div className="flex items-center justify-end gap-1">
      <Input
        type="text"
        value={inlinePrice}
        onChange={(e) => setInlinePrice(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleInlinePriceSave(item.id);
          if (e.key === "Escape") { setInlineEditId(null); setInlinePrice(""); }
        }}
        onBlur={() => handleInlinePriceSave(item.id)}
        className="w-24 h-7 text-right text-xs rounded-lg"
        autoFocus
      />
    </div>
  ) : (
    <span
      className="cursor-pointer hover:text-blue-600 hover:underline"
      onClick={() => {
        setInlineEditId(item.id);
        setInlinePrice(String(item.valor_unitario));
      }}
      title="Clique para editar o preço"
    >
      {brl(item.valor_unitario)}
    </span>
  )}
</td>
```

**Step 4: Importar ORCAMENTOS_QUERY_KEY se ainda não importado**

Verificar se `ORCAMENTOS_QUERY_KEY` é importado do `useOrcamentos`. Se não, adicionar ao import:

```typescript
import {
  useOrcamento,
  useCriarOrcamento,
  useAtualizarOrcamento,
  useAdicionarItemDetalhado,
  useAtualizarItemDetalhado,
  useRemoverItemOrcamento,
  useSalvarServicos,
  ORCAMENTOS_QUERY_KEY,  // ← adicionar
} from "../hooks/useOrcamentos";
```

**Step 5: Commit**

```bash
git add src/domains/comercial/pages/OrcamentoEditorPage.tsx
git commit -m "feat(orcamento): inline price editing on items table"
```

---

### Task 6: Verificação & build

**Step 1: Rodar o build para verificar que não há erros de TypeScript**

```bash
cd C:\Users\Caldera\Claude\CRM-Croma\.claude\worktrees\reverent-jennings
npx tsc --noEmit 2>&1 | head -30
```

**Step 2: Rodar o dev server e testar no preview**

```bash
npm run dev
```

Testar:
1. Abrir um orçamento existente com itens
2. Hover sobre um item → aparece ícone de lápis (editar) e lixeira (excluir)
3. Clicar no lápis → wizard reabre com dados preenchidos, título "Editar Item"
4. Mudar quantidade ou markup → pricing atualiza em tempo real
5. Clicar "Salvar Alterações" → item atualizado, wizard fecha
6. Clicar no preço unitário na tabela → input inline aparece
7. Digitar novo valor + Enter → preço e total atualizam

**Step 3: Commit final se necessário**

```bash
git add -A
git commit -m "fix(orcamento): adjust types and edge cases for item editing"
```
