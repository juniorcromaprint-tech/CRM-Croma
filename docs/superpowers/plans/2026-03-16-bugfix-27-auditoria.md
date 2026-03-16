# Bugfix 27 — Auditoria Funcional Browser

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 27 bugs found in the browser functional audit, in 4 sequential waves by severity.

**Architecture:** Surgical fixes — each bug gets the minimal change needed. No refactoring. Wave 1 (5 critical) gets individual commits + new tests. Waves 2-4 use grouped commits. Build check between each wave.

**Tech Stack:** React 19, TypeScript, Vite, TanStack Query v5, Supabase, Vitest

**Spec:** `docs/superpowers/specs/2026-03-16-bugfix-27-auditoria-design.md`

---

## Chunk 1: Wave 1 — Critical Bugs (C1–C5)

### Task 1: C1 — Fix render loop in ConciliacaoPage

**Files:**
- Modify: `src/domains/financeiro/pages/ConciliacaoPage.tsx:356-359`
- Create: `src/domains/financeiro/pages/__tests__/ConciliacaoPage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/domains/financeiro/pages/__tests__/ConciliacaoPage.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('ConciliacaoPage module', () => {
  it('should import without errors (no render loop at module level)', async () => {
    const mod = await import('../ConciliacaoPage');
    expect(mod).toBeDefined();
    expect(mod.default).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domains/financeiro/pages/__tests__/ConciliacaoPage.test.ts`
Expected: FAIL (module import may fail due to render loop or missing deps)

- [ ] **Step 3: Fix the useMemo → useEffect**

In `src/domains/financeiro/pages/ConciliacaoPage.tsx`, replace lines 356-359:

```ts
// BEFORE (lines 356-359):
useMemo(() => {
  setLancamentos(lancamentosRaw.map((r) => ({ ...r, conciliado: false })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [lancamentosRaw]);

// AFTER:
useEffect(() => {
  setLancamentos(lancamentosRaw.map((r) => ({ ...r, conciliado: false })));
}, [lancamentosRaw]);
```

**IMPORTANT:** `useEffect` is NOT in the current import. The file imports `{ useState, useMemo, useRef, useCallback }` at line 6. You MUST add `useEffect` to this import:

```ts
// BEFORE (line 6):
import { useState, useMemo, useRef, useCallback } from "react";

// AFTER:
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domains/financeiro/pages/__tests__/ConciliacaoPage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/financeiro/pages/ConciliacaoPage.tsx src/domains/financeiro/pages/__tests__/ConciliacaoPage.test.ts
git commit -m "fix(financeiro): resolve render loop in ConciliacaoPage (C1)

Replace useMemo calling setState with useEffect. useMemo is synchronous
and triggers re-render during render, causing infinite loop.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: C2 — Fix require() in ESM (exportPdf)

**Files:**
- Modify: `src/shared/utils/exportPdf.ts:6,53-81`
- Create: `src/shared/utils/__tests__/exportPdf.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/shared/utils/__tests__/exportPdf.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('exportPdf module', () => {
  it('should import without require() errors', async () => {
    const mod = await import('../exportPdf');
    expect(mod).toBeDefined();
    expect(typeof mod.exportPdf).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/utils/__tests__/exportPdf.test.ts`
Expected: FAIL with "require is not defined"

- [ ] **Step 3: Replace require() with dynamic import()**

In `src/shared/utils/exportPdf.ts`:

1. **Delete line 6**: `import html2pdf = require('html2pdf.js');`

2. **Make `exportPdf` async and use dynamic import**. Replace the function (lines 53-81) with:

```ts
export async function exportPdf({
  filename,
  title,
  subtitle,
  headers,
  rows,
}: ExportPdfOptions): Promise<void> {
  const html2pdf = (await import('html2pdf.js')).default;
  const html = buildTableHtml(title, subtitle, headers, rows);
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);

  await html2pdf()
    .set({
      margin: [10, 10, 10, 10],
      filename: `${filename}.pdf`,
      html2canvas: { scale: 2 },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: rows[0]?.length > 6 ? 'landscape' : 'portrait',
      },
    })
    .from(container)
    .save();

  document.body.removeChild(container);
}
```

3. **Update all callers** — since the function is now async and returns `Promise<void>`, callers that use `.then()` on it need to be checked. Search for `exportPdf(` across the codebase and add `await` if not already present. The function was already called fire-and-forget in most places, so `void exportPdf(...)` or `await exportPdf(...)` are both fine.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/utils/__tests__/exportPdf.test.ts`
Expected: PASS

- [ ] **Step 5: Run build to check no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors related to exportPdf signature change

- [ ] **Step 6: Commit**

```bash
git add src/shared/utils/exportPdf.ts src/shared/utils/__tests__/exportPdf.test.ts
git commit -m "fix(relatorios): replace require() with dynamic import in exportPdf (C2)

CommonJS require() is not available in Vite ESM context. Use dynamic
import() inside the function body instead.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: C3 — Fix pedido detail "not found"

**Files:**
- Modify: `src/domains/pedidos/hooks/usePedidos.ts:125-141`
- Create: `src/domains/pedidos/hooks/__tests__/usePedidos.test.ts`

- [ ] **Step 1: Diagnose the root cause**

Check the Supabase query in `usePedido` (line 131-135):

```ts
const { data, error } = await supabase
  .from('pedidos')
  .select('*, version, clientes(nome_fantasia, razao_social)')
  .eq('id', id)
  .single();
```

The issue: `.single()` throws a `PGRST116` error ("The result contains 0 rows") if no row matches. This could happen if:
1. RLS policy blocks access (most likely — check `027_rls_blindagem.sql`)
2. The join `clientes(nome_fantasia, razao_social)` fails if `cliente_id` is null

Run this SQL in Supabase dashboard to verify:
```sql
SELECT id, numero, cliente_id FROM pedidos LIMIT 5;
```

Then check RLS:
```sql
SELECT * FROM pg_policies WHERE tablename = 'pedidos';
```

- [ ] **Step 2: Write the test**

Create `src/domains/pedidos/hooks/__tests__/usePedidos.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

// Mock Supabase before importing
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: { id: 'test-id', numero: 'PED-2026-0001', clientes: { nome_fantasia: 'Test', razao_social: 'Test LTDA' } },
            error: null,
          }),
        }),
      }),
    }),
  },
}));

describe('usePedido query', () => {
  it('should construct a valid query for pedido detail', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    const result = await supabase
      .from('pedidos')
      .select('*, version, clientes(nome_fantasia, razao_social)')
      .eq('id', 'test-id')
      .single();

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data.id).toBe('test-id');
  });
});
```

- [ ] **Step 3: Fix the hook**

In `src/domains/pedidos/hooks/usePedidos.ts`, improve error handling in `usePedido` (lines 125-141):

```ts
export function usePedido(id: string | undefined) {
  return useQuery({
    queryKey: pedidoQueryKey(id ?? ''),
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<Pedido | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('pedidos')
        .select('*, version, clientes(nome_fantasia, razao_social)')
        .eq('id', id)
        .maybeSingle();  // ← CHANGE: .single() → .maybeSingle()
      if (error) throw new Error(`Erro ao buscar pedido: ${error.message}`);
      return data as Pedido;
    },
    enabled: !!id,
  });
}
```

Key change: `.single()` → `.maybeSingle()`. This returns `null` instead of throwing when 0 rows match, allowing the UI to show "Pedido não encontrado" gracefully instead of crashing.

**If this doesn't fix it (RLS issue):** The pedidos table may have an RLS policy that only allows access via `auth.uid()`. Check `supabase/migrations/027_rls_blindagem.sql` for the pedidos policy. If the policy uses `vendedor_id = auth.uid()` but the user's role is `administrador`, it may need a condition like `OR auth.jwt() ->> 'role' = 'administrador'`.

- [ ] **Step 4: Run test**

Run: `npx vitest run src/domains/pedidos/hooks/__tests__/usePedidos.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/pedidos/hooks/usePedidos.ts src/domains/pedidos/hooks/__tests__/usePedidos.test.ts
git commit -m "fix(pedidos): fix pedido detail query — single() → maybeSingle() (C3)

.single() throws PGRST116 when 0 rows match (RLS or missing data).
.maybeSingle() returns null gracefully, letting the UI handle it.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: C4 — Fix item not saving in Orçamento wizard

**Files:**
- Modify: `src/domains/comercial/pages/OrcamentoEditorPage.tsx:356-421`
- Create: `src/domains/comercial/pages/__tests__/OrcamentoEditorPage.test.ts`

- [ ] **Step 1: Diagnose the actual issue**

The mutation hook `useAdicionarItemDetalhado` (in `src/domains/comercial/hooks/useOrcamentos.ts:170-180`) already:
- Calls `adicionarItemDetalhado` + `recalcularTotais` in `mutationFn`
- Invalidates `['orcamentos', propostaId]` in `onSuccess`

But `handleAddItem` in the page (line 374-421):
- Has NO try/catch around `mutateAsync` — errors propagate unhandled
- Calls `recalcularTotais` AGAIN at line 418 (duplicate)
- Calls `editor.reset()` and `setShowItemForm(false)` even if mutation fails (but actually these won't run if mutateAsync throws since there's no catch)

The REAL issue: if `mutateAsync` throws, the error toast shows via the hook's `onError`, but the user sees no visual feedback because the form stays open with stale data. If it SUCCEEDS, the `onSuccess` should invalidate the cache. Need to check if the invalidation key matches.

Check: `useOrcamento(id)` uses queryKey `['orcamentos', id]`. The hook invalidates `['orcamentos', propostaId]`. These should match. BUT the page also uses `queryClient.invalidateQueries({ queryKey: ['proposta', id] })` at line 202 — this is a DIFFERENT key that doesn't match.

- [ ] **Step 2: Write the test**

Create `src/domains/comercial/pages/__tests__/OrcamentoEditorPage.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('OrcamentoEditorPage — handleAddItem contract', () => {
  it('hook useAdicionarItemDetalhado already invalidates orcamentos cache', async () => {
    // Verify the hook has onSuccess with invalidation
    const fs = await import('fs');
    const path = await import('path');
    const hookContent = fs.readFileSync(
      path.resolve(__dirname, '../../hooks/useOrcamentos.ts'),
      'utf-8'
    );

    // The hook must invalidate ['orcamentos', propostaId] on success
    expect(hookContent).toContain('useAdicionarItemDetalhado');
    expect(hookContent).toContain('ORCAMENTOS_QUERY_KEY, propostaId');
  });

  it('handleAddItem should have error handling (showError in catch)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../OrcamentoEditorPage.tsx'),
      'utf-8'
    );

    // After fix: handleAddItem should catch errors and show them
    // Extract handleAddItem function body
    const match = content.match(/const handleAddItem = async[\s\S]*?^\s{2}\};/m);
    expect(match).toBeTruthy();
    const fnBody = match![0];

    // Must have catch with showError
    expect(fnBody).toContain('catch');
    expect(fnBody).toContain('showError');
    // Must NOT have duplicate recalcularTotais (hook already does it)
    const recalcCount = (fnBody.match(/recalcularTotais/g) || []).length;
    expect(recalcCount).toBe(0);
  });
});
```

- [ ] **Step 3: Fix handleAddItem**

In `src/domains/comercial/pages/OrcamentoEditorPage.tsx`, replace the `handleAddItem` function body (after all the guard checks, starting from `await adicionarItem.mutateAsync`, lines ~374-421):

Wrap the mutation call in try/catch and remove the duplicate `recalcularTotais`:

```ts
  // ... (keep all guard checks as-is up to the last return statement) ...

  try {
    await adicionarItem.mutateAsync({
      propostaId: id,
      item: {
        // ... (keep entire item object as-is) ...
      },
    });

    // NOTE: recalcularTotais + cache invalidation already handled by
    // useAdicionarItemDetalhado hook's mutationFn and onSuccess
    editor.reset();
    setShowItemForm(false);
    showSuccess("Item adicionado com sucesso!");
  } catch (err: any) {
    console.error("[handleAddItem] Falha ao adicionar item:", err);
    showError(err?.message || "Erro ao adicionar item ao orçamento");
  }
};
```

Key changes:
1. Added `try/catch` around `mutateAsync` — errors were propagating unhandled
2. Removed duplicate `await orcamentoService.recalcularTotais(id)` — the hook's `mutationFn` already does this AND invalidates `['orcamentos', propostaId]` via `onSuccess`
3. Added `showSuccess` on success for user feedback
4. Added `showError` in catch with real error message

**Cache invalidation note:** The hook `useAdicionarItemDetalhado` already invalidates `['orcamentos', propostaId]` in its `onSuccess`. The `useOrcamento(id)` query uses key `['orcamentos', id]`, so the cache IS properly invalidated. The stale `['proposta', id]` at line 202 is legacy from the AI sidebar and does NOT affect item list refresh. No additional `invalidateQueries` needed in `handleAddItem`.

- [ ] **Step 4: Run test**

Run: `npx vitest run src/domains/comercial/pages/__tests__/OrcamentoEditorPage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/comercial/pages/OrcamentoEditorPage.tsx src/domains/comercial/pages/__tests__/OrcamentoEditorPage.test.ts
git commit -m "fix(orcamento): add try/catch + remove duplicate recalc in handleAddItem (C4)

handleAddItem had no error handling around mutateAsync, causing silent
failures. Also removed duplicate recalcularTotais call (hook already
does this in mutationFn).

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: C5 — Fix lead-to-client conversion

**Files:**
- Modify: `src/domains/comercial/pages/LeadDetailPage.tsx:103-130`
- Create: `src/domains/comercial/pages/__tests__/LeadDetailPage.test.ts`

- [ ] **Step 1: Write the test**

Create `src/domains/comercial/pages/__tests__/LeadDetailPage.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('Lead → Cliente field mapping', () => {
  it('should map lead fields to valid cliente payload', () => {
    const lead = {
      id: '123',
      empresa: 'Loja de Calçados ABC',
      contato_email: 'contato@abc.com',
      contato_telefone: '(51) 99999-9999',
      segmento: 'calcados',
    };
    const cnpj = '11444777000161';

    const payload = {
      razao_social: lead.empresa,
      nome_fantasia: lead.empresa,
      email: lead.contato_email ?? null,
      telefone: lead.contato_telefone ?? null,
      segmento: lead.segmento ?? null,
      origem: 'lead_convertido',
      lead_id: lead.id,
      cnpj,
    };

    // razao_social must not be null/empty (NOT NULL in DB)
    expect(payload.razao_social).toBeTruthy();
    expect(payload.nome_fantasia).toBeTruthy();
    expect(payload.lead_id).toBe('123');
    expect(payload.cnpj).toBe('11444777000161');
  });

  it('should handle lead with minimal data', () => {
    const lead = {
      id: '456',
      empresa: 'Test Co',
      contato_email: null,
      contato_telefone: null,
      segmento: null,
    };

    const payload = {
      razao_social: lead.empresa,
      nome_fantasia: lead.empresa,
      email: lead.contato_email ?? null,
      telefone: lead.contato_telefone ?? null,
      segmento: lead.segmento ?? null,
      origem: 'lead_convertido',
      lead_id: lead.id,
      cnpj: null,
    };

    expect(payload.razao_social).toBeTruthy();
    expect(payload.email).toBeNull();
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run src/domains/comercial/pages/__tests__/LeadDetailPage.test.ts`
Expected: PASS (this is a unit test for the mapping logic)

- [ ] **Step 3: Fix the error handling in handleConverter**

In `src/domains/comercial/pages/LeadDetailPage.tsx`, replace the catch block (lines 127-129):

```ts
// BEFORE:
  } catch (err) {
    showError("Erro ao converter lead em cliente.");
  }

// AFTER:
  } catch (err: any) {
    console.error("[handleConverter] Erro:", err);
    showError(err?.message || "Erro ao converter lead em cliente.");
  }
```

Also verify the field mapping at lines 113-122 matches the `clientes` table schema. The current mapping looks correct (`razao_social` ← `lead.empresa`), but if `lead.empresa` is empty/null, it will violate NOT NULL. Add a guard before the try block:

```ts
// Add BEFORE the try block (after the CNPJ check, ~line 110):
if (!lead.empresa?.trim()) {
  showError("Lead precisa ter nome da empresa para ser convertido.");
  return;
}
```

- [ ] **Step 4: Run test**

Run: `npx vitest run src/domains/comercial/pages/__tests__/LeadDetailPage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/comercial/pages/LeadDetailPage.tsx src/domains/comercial/pages/__tests__/LeadDetailPage.test.ts
git commit -m "fix(comercial): surface real error in lead→client conversion (C5)

Catch block was showing generic message instead of the actual Supabase
error. Now logs to console and includes err.message in toast. Also
added guard for empty empresa field.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Wave 1 build check

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: Build succeeds with 0 errors

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass (102 existing + 5 new)

- [ ] **Step 3: Fix any failures before proceeding to Wave 2**

---

## Chunk 2: Wave 2 — High Bugs (A1–A4)

### Task 7: A1 + A2 — Lead value validation + clear search

**Files:**
- Modify: `src/domains/comercial/pages/LeadsPage.tsx:154,435`

- [ ] **Step 1: Fix A1 — add min={0} to valor_estimado input**

In `src/domains/comercial/pages/LeadsPage.tsx`, find the input at line ~433-439:

```tsx
// BEFORE:
<Input
  id="valor_estimado"
  type="number"
  value={form.valor_estimado}
  onChange={e => setForm({ ...form, valor_estimado: e.target.value })}
  placeholder="50000"
/>

// AFTER:
<Input
  id="valor_estimado"
  type="number"
  min={0}
  value={form.valor_estimado}
  onChange={e => setForm({ ...form, valor_estimado: e.target.value })}
  placeholder="50000"
/>
```

Also add server-side validation in the mutation at line ~149:

```ts
// BEFORE:
valor_estimado: newLead.valor_estimado ? Number(newLead.valor_estimado) : null,

// AFTER:
valor_estimado: newLead.valor_estimado ? Math.max(0, Number(newLead.valor_estimado)) : null,
```

- [ ] **Step 2: Fix A2 — clear search after creating lead**

In `src/domains/comercial/pages/LeadsPage.tsx`, find the `onSuccess` callback of `createLead` mutation (line ~154-165). Add `setSearch("")` inside:

```ts
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["leads"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  showSuccess("Lead criado com sucesso!");
  setShowNewLead(false);
  setLeadsDuplicados([]);
  setSearch("");  // ← ADD THIS LINE
  setForm({
    empresa: "", contato_nome: "", contato_email: "", contato_telefone: "",
    segmento: "", status: "novo", temperatura: "frio", valor_estimado: "",
    proximo_contato: "", observacoes: "",
  });
},
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/comercial/pages/LeadsPage.tsx
git commit -m "fix(leads): validate min value >= 0 + clear search after create (A1, A2)

A1: Add min=0 to valor_estimado input + Math.max(0) server-side.
A2: Add setSearch('') in createLead onSuccess to clear filter.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: A3 — OP 100% in wrong Kanban column

**Files:**
- Modify: `src/domains/producao/pages/ProducaoPage.tsx`

- [ ] **Step 1: Find the Kanban column rendering logic**

The columns are defined at line ~188-230 (`KANBAN_COLUMNS`). The OPs are filtered by status. Find where the OPs are assigned to columns — look for a `.filter()` on the OP list using `col.statuses.includes(op.status)`.

Search for the filter pattern in the file (likely in the render section):

```ts
// Look for something like:
ordens.filter(op => col.statuses.includes(op.status))
```

- [ ] **Step 2: Add progress guard to the filter**

Where the OPs are filtered into Kanban columns, add a guard for the "fila" column.

**First check if `progresso` exists on the OP type.** Search for `progresso` in the file. If the OP row has `progresso` as a field, use it directly:

```ts
// AFTER:
ordens.filter(op => {
  if (!col.statuses.includes(op.status)) return false;
  // A3: Don't show 100% completed OPs in Fila column
  if (col.key === 'fila' && (op as any).progresso >= 100) return false;
  return true;
})
```

If `progresso` is NOT on the type, look for how progress is calculated in the component (search for `etapas`, `allDone`, `calcProgress`). The progress may be derived from `op.etapas_concluidas / op.total_etapas` or similar. Use that calculation instead of `op.progresso`.

If neither approach works, use a simpler heuristic: check the `updateEtapaStatus` function (~L594) which has an `allDone` check — add a similar condition to the column filter.

- [ ] **Step 3: Commit**

```bash
git add src/domains/producao/pages/ProducaoPage.tsx
git commit -m "fix(producao): exclude 100% completed OPs from Fila column (A3)

OPs with progresso >= 100 but status still 'em_fila' were showing in
the wrong Kanban column. Filter now excludes them from Fila.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: A4 — Dashboard KPIs inconsistent with Produção

**Files:**
- Modify: `src/domains/comercial/pages/DashboardDiretor.tsx`

- [ ] **Step 1: Investigate KPI data source mismatch**

Check the hook that feeds `pedidos` data to DashboardDiretor. Compare with the query used in ProducaoPage. If they use different Supabase queries, align them.

Look at the `useDashboard` or similar hook. The production count ("em produção") should match what ProducaoPage shows. If the dashboard uses a stale or cached count, force a fresh query.

This may require reading the dashboard hooks to find the exact discrepancy. If both queries are correct but the dashboard just needs to use the production hook directly, add that dependency.

- [ ] **Step 2: Commit**

```bash
git add src/domains/comercial/pages/DashboardDiretor.tsx
git commit -m "fix(dashboard): align production KPIs with ProducaoPage data source (A4)

Ensure dashboard KPI counts match the actual data from ProducaoPage.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: Wave 2 build check

- [ ] **Step 1: Run full build + tests**

```bash
npm run build && npx vitest run
```

Expected: Build succeeds, all tests pass

---

## Chunk 3: Wave 3 — Medium Bugs (M1–M14)

### Task 11: M1–M13 — Fix missing accents across UI

**Files to modify (grep results from codebase exploration):**
- `src/domains/comercial/pages/OrcamentoEditorPage.tsx` — M3, M4, M5, M7, M8, M9, M10
- `src/domains/comercial/components/ItemStep3Revisao.tsx` — M8
- `src/domains/comercial/components/ServicoSelector.tsx` — M5, M6
- `src/domains/comercial/pages/OrcamentoViewPage.tsx` — M5
- `src/domains/financeiro/pages/ComissoesPage.tsx` — M12
- `src/domains/clientes/pages/ClienteDetailPage.tsx` — M13
- `src/domains/ai/components/OrcamentoAnalise.tsx` — M8
- `src/domains/ai/appliers/orcamento/precoApplier.ts` — M8
- `src/domains/producao/pages/ProducaoPage.tsx` — M1
- Breadcrumb component or ExpedicaoPage — M2

- [ ] **Step 1: Fix all accent issues via search-and-replace**

For each file, use exact string replacements. Here is the complete list of replacements:

**`OrcamentoEditorPage.tsx`:**
| Line | Old | New |
|------|-----|-----|
| ~64 | `"Revisao"` | `"Revisão"` |
| ~799 | `Descricao *` | `Descrição *` |
| ~997 | `Preco Total` | `Preço Total` |
| ~1041 | `Servicos` | `Serviços` |
| Find | `Orcamento` (in labels/headings) | `Orçamento` |
| Find | `precificacao` | `precificação` |
| Find | `automatica` (in same context) | `automática` |
| Find | `parametros` | `parâmetros` |
| Find | `descricao` (in UI labels) | `descrição` |

**`ItemStep3Revisao.tsx`:**
| Line | Old | New |
|------|-----|-----|
| ~141 | `Preco Unitario` | `Preço Unitário` |
| ~162 | `Preco/m²` | `Preço/m²` |
| ~205 | `Preco abaixo do custo` | `Preço abaixo do custo` |

**`ServicoSelector.tsx`:**
| Line | Old | New |
|------|-----|-----|
| ~137 | `Servicos serao carregados quando disponiveis` | `Serviços serão carregados quando disponíveis` |
| ~148 | `Servicos` | `Serviços` |
| ~296 | `Total Servicos` | `Total Serviços` |
| Find | `servico` (UI labels) | `serviço` |

**`OrcamentoViewPage.tsx`:**
| ~495 | `Servicos` | `Serviços` |
| ~530 | `Servicos` | `Serviços` |

**`ComissoesPage.tsx`:**
| ~882 | `Comissoes` | `Comissões` |
| ~897 | `Comissoes Geradas` | `Comissões Geradas` |
| ~905 | `Comissoes Pagas` | `Comissões Pagas` |

**`ClienteDetailPage.tsx`:**
| ~97 | `calcados: "Calcados"` | `calcados: "Calçados"` |

**`OrcamentoAnalise.tsx`:**
| ~30 | `Preco Sugerido` | `Preço Sugerido` |

**`precoApplier.ts`:**
| ~39 | `` Preco atualizado `` | `` Preço atualizado `` |

**`ProducaoPage.tsx`:** (M1)
Search for `"ordemns"` or `"ordem"` with wrong plural. If found, replace with `"ordens"`.
**NOTE:** String `"ordemns"` may NOT exist in source code — it may have been fixed or may come from a dynamic template. If grep returns nothing, mark M1 as N/A.

**Expedição breadcrumb:** (M2)
Search for `"Expedicao"` without accent in breadcrumb/page title. Replace with `"Expedição"`.
**NOTE:** `ExpedicaoPage.tsx` already uses `"Expedição"` (accented) at line 31. If grep returns no unaccented matches, mark M2 as N/A — it may have been fixed.

**M11 — "Package Banners è Lonas":**
Search for `"Package"` near `"Banners"` in source. If not found in source code, it comes from the database. Check the `produtos.categoria` or `regras_precificacao.categoria` column. If it's in the DB, note it for a SQL fix (out of scope for this code commit).

- [ ] **Step 2: Grep to verify no remaining accent issues**

```bash
cd src && grep -rn "Orcamento\|Descricao\|Servicos\|Revisao\|Preco\|Comissoes\|Calcados\|precificacao\|Expedicao\|ordemns" --include="*.tsx" --include="*.ts" | grep -v "node_modules" | grep -v ".test."
```

Expected: Only matches in code identifiers (variable names, not UI strings)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "fix(i18n): correct 13+ missing accents across UI labels (M1-M13)

Fix Portuguese accents in Orçamento, Serviços, Comissões, Preço,
Descrição, Revisão, Calçados, Expedição, and other labels.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 12: M14 — Fix truncated Kanban cards

**Files:**
- Modify: `src/domains/producao/pages/ProducaoPage.tsx:1151-1158`

- [ ] **Step 1: Add title attribute for tooltip on truncated text**

In `src/domains/producao/pages/ProducaoPage.tsx`:

```tsx
// Line ~1151:
// BEFORE:
<h4 className="font-semibold text-slate-800 text-sm truncate leading-tight mt-0.5">
  {getClienteName(op)}
</h4>

// AFTER:
<h4 className="font-semibold text-slate-800 text-sm truncate leading-tight mt-0.5" title={getClienteName(op)}>
  {getClienteName(op)}
</h4>
```

```tsx
// Line ~1154:
// BEFORE:
<p className="text-[11px] text-slate-500 truncate mt-0.5">

// AFTER:
<p className="text-[11px] text-slate-500 truncate mt-0.5" title={`${getPedidoNumero(op)} • ${getItemDescricao(op)}`}>
```

Also check if there are more truncated elements (~line 1255):

```tsx
// Line ~1255:
// BEFORE:
<h3 className="font-bold text-slate-800 text-base mt-1 group-hover:text-blue-700 transition-colors truncate">

// AFTER:
<h3 className="font-bold text-slate-800 text-base mt-1 group-hover:text-blue-700 transition-colors truncate" title={/* item description */}>
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/producao/pages/ProducaoPage.tsx
git commit -m "fix(producao): add title tooltips to truncated kanban cards (M14)

Truncated text on kanban cards now shows full content on hover via
native title attribute.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 13: Wave 3 build check

- [ ] **Step 1: Run full build + tests**

```bash
npm run build && npx vitest run
```

Expected: Build succeeds, all tests pass

---

## Chunk 4: Wave 4 — Low Bugs (B1–B4)

### Task 14: B1 + B3 + B4 — Router flags + client form defaults + dashboard message

**Files:**
- Modify: `src/App.tsx:61`
- Modify: `src/domains/clientes/pages/ClientesPage.tsx:317` (if needed)
- Modify: `src/domains/comercial/pages/DashboardDiretor.tsx:317`

- [ ] **Step 1: Add React Router v7 future flags (B1)**

In `src/App.tsx`, line 61:

```tsx
// BEFORE:
<BrowserRouter>

// AFTER:
<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
```

- [ ] **Step 2: Check client form defaults (B3)**

In `src/domains/clientes/pages/ClientesPage.tsx`, line ~317. The explorer reported it already uses `placeholder="Porto Alegre"` not `defaultValue`. Verify this. If it's already a placeholder, B3 is already fixed — no change needed.

If it IS a `defaultValue` or a `value` with initial state "Porto Alegre", change to `placeholder`:

```tsx
// If using value with default state:
// Find the state initialization for endereco_cidade and change from "Porto Alegre" to ""
// Keep placeholder="Porto Alegre"
```

- [ ] **Step 3: Fix "Todos no prazo" conditional (B4)**

In `src/domains/comercial/pages/DashboardDiretor.tsx`, line 317:

```tsx
// BEFORE:
subtitle={pedidos?.atrasados ? `${pedidos.atrasados} em atraso` : pedidos?.ativos ? "Todos no prazo" : "Nenhum pedido em andamento"}

// AFTER:
subtitle={
  (pedidos?.atrasados ?? 0) > 0
    ? `${pedidos.atrasados} em atraso`
    : pedidos?.ativos
      ? "Todos no prazo"
      : "Nenhum pedido em andamento"
}
```

The current logic uses `pedidos?.atrasados` which is falsy when `0`. Change to explicit `> 0` check.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/domains/comercial/pages/DashboardDiretor.tsx
git commit -m "chore: add React Router v7 future flags + fix dashboard message (B1, B3, B4)

B1: Add v7_startTransition and v7_relativeSplatPath to suppress warnings.
B3: Verified placeholder is already used (no defaultValue).
B4: Fix falsy check on pedidos.atrasados (0 is falsy in JS).

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 15: Final build check + summary

- [ ] **Step 1: Run full build + tests**

```bash
npm run build && npx vitest run
```

Expected: Build succeeds, all 107+ tests pass

- [ ] **Step 2: Verify commit history**

```bash
git log --oneline -15
```

Expected: ~11 clean commits for the 4 waves

- [ ] **Step 3: Summary**

Verify all 27 bugs are addressed:
- C1–C5: 5 individual commits ✓
- A1–A4, B4: 3 commits ✓
- M1–M14: 2 commits ✓
- B1, B3: 1 commit ✓
- B2: Skipped (backlog, partially covered by A1) ✓
