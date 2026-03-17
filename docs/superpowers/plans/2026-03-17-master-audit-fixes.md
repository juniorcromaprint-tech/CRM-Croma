# Master Audit Fixes — 15 Critical Issues

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 15 critical/high issues identified in the 2026-03-17 Master Audit across code bugs, Kanban logic, data integrity, UX consistency, and input validation.

**Architecture:** Frontend fixes in React/TypeScript (domains/), Supabase SQL migrations for triggers/schema, toast consolidation in App.tsx, Tailwind class standardization across 7 files.

**Tech Stack:** React 19 + TypeScript + Supabase + shadcn/ui + TanStack Query v5 + Tailwind CSS

---

## Chunk 1: Code Bugs (Tasks 1–3)

### Task 1: Fix Missing Supabase Import + Soft Delete in LeadDetailPage

**Files:**
- Modify: `src/domains/comercial/pages/LeadDetailPage.tsx:1-54`

- [ ] **Step 1: Add supabase import**

After line 27 (the last existing import `import { LEAD_STATUS_CONFIG, getStatusConfig }...`), add:

```typescript
import { supabase } from "@/integrations/supabase/client";
```

- [ ] **Step 2: Change hard delete to soft delete**

Replace lines 43-54:

```typescript
// OLD (hard delete — crashes because supabase not imported):
const deleteLead = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      showSuccess("Lead excluído permanentemente");
      navigate("/leads");
    },
    onError: (err: any) => showError(err.message || "Erro ao excluir lead"),
  });
```

With:

```typescript
// NEW (soft delete — sets excluido_em/excluido_por):
const deleteLead = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase
        .from("leads")
        .update({
          excluido_em: new Date().toISOString(),
          excluido_por: profile?.id ?? null,
        })
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      showSuccess("Lead excluído com sucesso");
      navigate("/leads");
    },
    onError: (err: any) => showError(err.message || "Erro ao excluir lead"),
  });
```

- [ ] **Step 3: Verify the fix compiles**

Run: `cd /c/Users/Caldera/Claude/CRM-Croma && npx tsc --noEmit --skipLibCheck 2>&1 | head -20`
Expected: No errors related to LeadDetailPage.tsx

- [ ] **Step 4: Commit**

```bash
git add src/domains/comercial/pages/LeadDetailPage.tsx
git commit -m "fix: add supabase import and use soft delete in LeadDetailPage

Fixes crash when deleting leads (missing import) and switches from
hard delete to soft delete using excluido_em/excluido_por columns.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Fix Pedido Status in orcamento.service.ts

**Files:**
- Modify: `src/domains/comercial/services/orcamento.service.ts:788`

- [ ] **Step 1: Change status from "aguardando_aprovacao" to "aprovado"**

At line 788, replace:

```typescript
status: "aguardando_aprovacao",
```

With:

```typescript
status: "aprovado",
```

**Why:** When a quote is converted to a pedido, the pedido is already approved (the quote approval IS the approval). Using "aguardando_aprovacao" means production never sees it because they filter for "aprovado" or "em_producao".

- [ ] **Step 2: Verify the fix compiles**

Run: `cd /c/Users/Caldera/Claude/CRM-Croma && npx tsc --noEmit --skipLibCheck 2>&1 | grep orcamento`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/domains/comercial/services/orcamento.service.ts
git commit -m "fix: set pedido status to 'aprovado' on quote conversion

The previous 'aguardando_aprovacao' status broke the Venda→Produção flow
because production filters only see 'aprovado'/'em_producao' orders.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Fix Kanban — 100% Completed OPs Stuck in "Em Produção"

**Files:**
- Modify: `src/domains/producao/pages/ProducaoPage.tsx:668-679`

- [ ] **Step 1: Add filter to exclude 100% OPs from all non-terminal columns**

At line 671-676, the current filter only excludes 100% items from "fila". Replace:

```typescript
result[col.key] = filtered.filter((op) => {
  if (!col.statuses.includes(op.status)) return false;
  // A3: Don't show 100% completed OPs in Fila column
  if (col.key === 'fila' && getProgressPercent(op.producao_etapas) >= 100) return false;
  return true;
});
```

With:

```typescript
result[col.key] = filtered.filter((op) => {
  if (!col.statuses.includes(op.status)) return false;
  // Don't show 100% completed OPs in non-terminal columns (fila, producao, acabamento, conferencia)
  const progress = getProgressPercent(op.producao_etapas);
  if (progress >= 100 && col.key !== 'liberado' && col.key !== 'retrabalho') return false;
  return true;
});
```

- [ ] **Step 2: Add overdue visual highlight**

Find the Kanban card rendering section. In the card div that renders each OP, add an overdue indicator. Search for the card's main className that includes `bg-white rounded-2xl` in the Kanban view. Add a conditional border:

```typescript
className={cn(
  "bg-white rounded-2xl p-4 shadow-sm border cursor-grab active:cursor-grabbing transition-all",
  isOverdue(op) && op.status !== "finalizado" && op.status !== "liberado"
    ? "border-red-300 ring-1 ring-red-200"
    : "border-slate-100 hover:shadow-md"
)}
```

- [ ] **Step 3: Verify the fix compiles**

Run: `cd /c/Users/Caldera/Claude/CRM-Croma && npx tsc --noEmit --skipLibCheck 2>&1 | grep ProducaoPage`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/domains/producao/pages/ProducaoPage.tsx
git commit -m "fix: filter 100% completed OPs from Kanban non-terminal columns

OPs with all etapas concluded were stuck in 'Em Produção' column.
Now they are filtered out of fila/producao/acabamento/conferencia.
Also adds red border highlight for overdue OPs.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 2: Input Validation (Tasks 4–5)

### Task 4: Prevent Negative Values in Lead Forms

**Files:**
- Modify: `src/domains/comercial/pages/LeadDetailPage.tsx:383-388`
- Modify: `src/domains/comercial/pages/LeadsPage.tsx:462-468`

- [ ] **Step 1: Add min="0" to valor_estimado input in LeadDetailPage**

At line 385 in `LeadDetailPage.tsx`, the Input for valor_estimado:

```tsx
<Input
  id="valor_estimado"
  type="number"
  min="0"
  value={form.valor_estimado}
  onChange={e => setForm({ ...form, valor_estimado: e.target.value })}
/>
```

Add `min="0"` attribute (add after `type="number"`).

- [ ] **Step 2: Skip LeadsPage.tsx — already has min={0}**

LeadsPage.tsx line 466 already has `min={0}`. No change needed.

- [ ] **Step 3: Add Math.max(0) clamp in LeadDetailPage update logic**

At line 115 in `LeadDetailPage.tsx`, the update mutation sets:
```typescript
// Before:
valor_estimado: form.valor_estimado ? Number(form.valor_estimado) : null,
// After:
valor_estimado: form.valor_estimado ? Math.max(0, Number(form.valor_estimado)) : null,
```

This clamp is missing in LeadDetailPage (LeadsPage already has it at line 153).

- [ ] **Step 4: Commit**

```bash
git add src/domains/comercial/pages/LeadDetailPage.tsx src/domains/comercial/pages/LeadsPage.tsx
git commit -m "fix: prevent negative valor_estimado in lead forms

Adds min=0 to number inputs and Math.max(0) clamp on submission.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Fix Corrupted Date Prevention in Financial Module

**Files:**
- Modify: `src/domains/financeiro/pages/FinanceiroPage.tsx` (find date input handling)

- [ ] **Step 1: Find and read date input handling in FinanceiroPage**

Run: `grep -n "type=\"date\"\|vencimento\|data_" src/domains/financeiro/pages/FinanceiroPage.tsx | head -20`

Identify where dates are set.

- [ ] **Step 2: Add date validation helper**

If dates are parsed from string input, add validation before saving:

```typescript
function isValidDate(dateStr: string): boolean {
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100;
}
```

Apply this check before any `.insert()` or `.update()` call that includes date fields. If the date is invalid, call `showError("Data inválida")` and return early.

- [ ] **Step 3: Commit**

```bash
git add src/domains/financeiro/pages/FinanceiroPage.tsx
git commit -m "fix: add date validation to prevent corrupted dates in financeiro

Validates year range (2000-2100) before saving to prevent dates like '60320'.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 3: UX Consistency (Tasks 6–9)

### Task 6: Remove Dual Toast — Keep Only Sonner

**Files:**
- Modify: `src/App.tsx:1-2, 59`

- [ ] **Step 1: Remove Toaster import and component**

In `src/App.tsx`:

Remove line 1:
```typescript
import { Toaster } from "@/components/ui/toaster";
```

Remove the `<Toaster />` component from line 59 (keep only `<Sonner />`).

The file should have:
```typescript
import { Toaster as Sonner } from "@/components/ui/sonner";
```

And only:
```tsx
<Sonner />
```

- [ ] **Step 2: Verify no other file imports from "@/components/ui/toaster"**

Run: `grep -r "from.*components/ui/toaster" src/ --include="*.tsx" --include="*.ts"`

If any file imports from `toaster`, update it to use `showSuccess`/`showError` from `@/utils/toast` (which uses Sonner).

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "fix: remove dual toast system, keep only Sonner

Toaster (from shadcn/ui) was rendering alongside Sonner, causing
duplicate/inconsistent notifications. Standardized on Sonner.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Standardize gray-* to slate-* in 7 Files

**Files:**
- Modify: `src/domains/producao/pages/AlmoxarifePage.tsx` (~20 occurrences)
- Modify: `src/domains/financeiro/pages/FinanceiroPage.tsx` (2 occurrences at lines 160, 186)
- Modify: `src/domains/fiscal/components/StatusFiscalBadge.tsx` (1 occurrence at line 11)
- Modify: `src/domains/fiscal/pages/FiscalFilaPage.tsx` (1 occurrence at line 18)
- Modify: `src/shared/constants/status.ts` (6 occurrences at lines 73, 245, 265, 283, 309, 431)
- Modify: `src/domains/comercial/pages/OrcamentoViewPage.tsx` (1 occurrence at line 337, print-only — leave as is)

- [ ] **Step 1: Replace gray-* with slate-* in AlmoxarifePage.tsx**

Use find-and-replace across the file:
- `gray-50` → `slate-50`
- `gray-100` → `slate-100`
- `gray-200` → `slate-200`
- `gray-500` → `slate-500`
- `gray-600` → `slate-600`
- `gray-900` → `slate-900`

- [ ] **Step 2: Replace gray-* with slate-* in FinanceiroPage.tsx**

Lines 160 and 186:
```typescript
// Before:
className: "bg-gray-50 text-gray-500 border-gray-200",
// After:
className: "bg-slate-50 text-slate-500 border-slate-200",
```

- [ ] **Step 3: Replace gray-* with slate-* in StatusFiscalBadge.tsx**

Line 11:
```typescript
// Before:
cancelado: { label: '🚫 Cancelado', className: 'bg-gray-100 text-gray-500 border-gray-300 line-through' },
// After:
cancelado: { label: '🚫 Cancelado', className: 'bg-slate-100 text-slate-500 border-slate-300 line-through' },
```

- [ ] **Step 4: Replace gray-* with slate-* in FiscalFilaPage.tsx**

Line 18:
```typescript
// Before:
cancelado: { label: '🚫 Cancelado', className: 'bg-gray-100 text-gray-500' },
// After:
cancelado: { label: '🚫 Cancelado', className: 'bg-slate-100 text-slate-500' },
```

- [ ] **Step 5: Replace gray-* with slate-* in status.ts**

Lines 73, 245, 265, 283, 309, 431 — all follow this pattern:
```typescript
// Before:
color: 'bg-gray-50 text-gray-500 border-gray-100',
// After:
color: 'bg-slate-50 text-slate-500 border-slate-100',
```

- [ ] **Step 6: Skip OrcamentoViewPage.tsx**

Line 337 has `print:bg-gray-50` — this is a print-specific override. Leave as-is (print styles are separate from screen palette).

- [ ] **Step 7: Verify no gray-* remains (except print styles)**

Run: `grep -rn "gray-" src/ --include="*.tsx" --include="*.ts" | grep -v "print:" | grep -v node_modules`

Expected: No matches (or only in files we intentionally skipped).

- [ ] **Step 8: Commit**

```bash
git add src/domains/producao/pages/AlmoxarifePage.tsx \
  src/domains/financeiro/pages/FinanceiroPage.tsx \
  src/domains/fiscal/components/StatusFiscalBadge.tsx \
  src/domains/fiscal/pages/FiscalFilaPage.tsx \
  src/shared/constants/status.ts
git commit -m "fix: standardize color palette from gray-* to slate-*

Replaces all gray-* Tailwind classes with slate-* across 5 files
to maintain consistent design system. Print-only styles left as-is.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Fix Pipeline Conversion Rate (0.0%)

**Files:**
- Modify: `src/domains/comercial/hooks/usePipeline.ts` (find conversion rate calculation)

- [ ] **Step 1: Read usePipeline.ts to find the conversion rate logic**

Run: `grep -n "conversao\|conversion\|taxa" src/domains/comercial/hooks/usePipeline.ts`

- [ ] **Step 2: Fix the conversion rate calculation**

The conversion rate should be: `(convertidos / total_leads) * 100`. If it's dividing by 0 or using wrong denominator, fix it. Common issue: filtering out "convertido" leads before counting total, making denominator = 0.

- [ ] **Step 3: Commit**

```bash
git add src/domains/comercial/hooks/usePipeline.ts
git commit -m "fix: correct pipeline conversion rate calculation

Was showing 0.0% due to incorrect denominator in the formula.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: Add Calendar pt-BR Locale

**Files:**
- Modify: Calendar-related component (find where `Calendar` from shadcn is used)

- [ ] **Step 1: Find Calendar usage**

Run: `grep -rn "from.*components/ui/calendar\|<Calendar" src/ --include="*.tsx" | head -10`

- [ ] **Step 2: Add pt-BR locale to Calendar component**

In the Calendar component or where it's configured:

```typescript
import { ptBR } from "date-fns/locale";

// In Calendar props:
<Calendar locale={ptBR} ... />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/calendar.tsx src/domains/comercial/pages/CalendarioPage.tsx
git commit -m "fix: set Calendar locale to pt-BR

Days and months now display in Portuguese.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 4: Data Integrity via SQL Migrations (Tasks 10–13)

### Task 10: Add Soft Delete Columns to Critical Tables

**Files:**
- Create: `supabase/migrations/037_soft_delete_critical_tables.sql`

**Note:** Last migration is `036_pricing_realista.sql`. Next number is `037`.

- [ ] **Step 1: Create migration adding excluido_em + excluido_por to 10 critical transactional tables**

```sql
-- 037_soft_delete_critical_tables.sql
-- Add soft delete columns to the 10 most critical transactional tables

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'leads', 'pedidos', 'pedido_itens', 'ordens_producao',
    'contas_pagar', 'contas_receber', 'pedidos_compra', 'pedido_compra_itens',
    'estoque_movimentacoes', 'fiscal_documentos'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS excluido_em TIMESTAMPTZ DEFAULT NULL', tbl
    );
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS excluido_por UUID DEFAULT NULL REFERENCES profiles(id)', tbl
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%s_excluido ON %I (excluido_em) WHERE excluido_em IS NULL', tbl, tbl
    );
  END LOOP;
END $$;
```

- [ ] **Step 2: Execute migration via Supabase SQL Editor**

Go to Supabase dashboard → SQL Editor → paste and run the migration.

- [ ] **Step 3: Commit the migration file**

```bash
git add supabase/migrations/037_soft_delete_critical_tables.sql
git commit -m "feat: add soft delete columns to 10 critical tables

Adds excluido_em + excluido_por with partial index to leads, pedidos,
pedido_itens, ordens_producao, contas_pagar, contas_receber, pedidos_compra,
pedido_compra_itens, estoque_movimentacoes, fiscal_documentos.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 11: Create area_m2 Auto-Calculation Trigger

**Files:**
- Create: `supabase/migrations/038_trigger_area_m2.sql`

- [ ] **Step 1: Create trigger function**

```sql
-- 038_trigger_area_m2.sql
-- Auto-calculate area_m2 from largura_cm and altura_cm

CREATE OR REPLACE FUNCTION fn_calc_area_m2()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.largura_cm IS NOT NULL AND NEW.altura_cm IS NOT NULL THEN
    NEW.area_m2 := (NEW.largura_cm * NEW.altura_cm) / 10000.0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to proposta_itens (quote items — has largura_cm, altura_cm, area_m2)
DROP TRIGGER IF EXISTS trg_calc_area_m2_proposta_itens ON proposta_itens;
CREATE TRIGGER trg_calc_area_m2_proposta_itens
  BEFORE INSERT OR UPDATE OF largura_cm, altura_cm ON proposta_itens
  FOR EACH ROW EXECUTE FUNCTION fn_calc_area_m2();

-- Apply to pedido_itens (order items — has largura_cm, altura_cm, area_m2 via migration 007b)
DROP TRIGGER IF EXISTS trg_calc_area_m2_pedido_itens ON pedido_itens;
CREATE TRIGGER trg_calc_area_m2_pedido_itens
  BEFORE INSERT OR UPDATE OF largura_cm, altura_cm ON pedido_itens
  FOR EACH ROW EXECUTE FUNCTION fn_calc_area_m2();

-- Apply to modelo_composicoes if it has these columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modelo_composicoes' AND column_name = 'largura_cm'
  ) THEN
    DROP TRIGGER IF EXISTS trg_calc_area_m2_modelo_composicoes ON modelo_composicoes;
    CREATE TRIGGER trg_calc_area_m2_modelo_composicoes
      BEFORE INSERT OR UPDATE OF largura_cm, altura_cm ON modelo_composicoes
      FOR EACH ROW EXECUTE FUNCTION fn_calc_area_m2();
  END IF;
END $$;
```

- [ ] **Step 2: Execute via Supabase SQL Editor**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/038_trigger_area_m2.sql
git commit -m "feat: add trigger to auto-calculate area_m2 from dimensions

area_m2 = largura_cm * altura_cm / 10000. Applied to proposta_itens,
pedido_itens, and modelo_composicoes.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 12: Fix 3 Inoperative Triggers

**Files:**
- Create: `supabase/migrations/039_fix_inoperative_triggers.sql`

**Schema reference (correct table/column names):**
- Purchase orders: `pedidos_compra` (NOT "compras")
- Purchase items: `pedido_compra_itens` (NOT "compra_itens")
- Stock movements: `estoque_movimentacoes` (NOT "movimentacoes_estoque")
- Accounts payable columns: `numero_titulo`, `valor_original`, `pedido_compra_id`, `fornecedor_id`, status values: `'a_pagar'`
- Purchase status values: `'recebido'` (NOT "recebida")

- [ ] **Step 1: Read the current broken trigger migration to understand the schema**

Run: Read `supabase/migrations/032_fix_triggers_schema.sql` to see current state.

- [ ] **Step 2: Create corrected trigger functions**

```sql
-- 039_fix_inoperative_triggers.sql
-- Fix the 3 inoperative triggers: producao→estoque, compras→conta_pagar, compras→estoque

-- 1. When an OP is completed (status → 'finalizado'), debit materials from estoque
CREATE OR REPLACE FUNCTION fn_producao_debita_estoque()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'finalizado' AND (OLD.status IS DISTINCT FROM 'finalizado') THEN
    INSERT INTO estoque_movimentacoes (
      material_id, tipo, quantidade, referencia_tipo, referencia_id, observacao
    )
    SELECT
      mc.material_id,
      'saida',
      mc.quantidade * COALESCE(pi.quantidade, 1),
      'ordem_producao',
      NEW.id,
      'Baixa automática - OP ' || NEW.numero
    FROM pedido_itens pi
    JOIN modelo_composicoes mc ON mc.modelo_id = pi.modelo_id
    WHERE pi.id = NEW.pedido_item_id
      AND mc.material_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_producao_debita_estoque ON ordens_producao;
CREATE TRIGGER trg_producao_debita_estoque
  AFTER UPDATE OF status ON ordens_producao
  FOR EACH ROW EXECUTE FUNCTION fn_producao_debita_estoque();

-- 2. When a pedido_compra is received, create conta_pagar
CREATE OR REPLACE FUNCTION fn_compra_gera_conta_pagar()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'recebido' AND (OLD.status IS DISTINCT FROM 'recebido') THEN
    INSERT INTO contas_pagar (
      numero_titulo, valor_original, data_vencimento, fornecedor_id, status, pedido_compra_id
    )
    VALUES (
      'PC-' || NEW.numero,
      NEW.valor_total,
      COALESCE(NEW.data_vencimento, NOW() + INTERVAL '30 days'),
      NEW.fornecedor_id,
      'a_pagar',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compra_gera_conta_pagar ON pedidos_compra;
CREATE TRIGGER trg_compra_gera_conta_pagar
  AFTER UPDATE OF status ON pedidos_compra
  FOR EACH ROW EXECUTE FUNCTION fn_compra_gera_conta_pagar();

-- 3. When a pedido_compra is received, credit estoque with received items
CREATE OR REPLACE FUNCTION fn_compra_recebimento_estoque()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'recebido' AND (OLD.status IS DISTINCT FROM 'recebido') THEN
    INSERT INTO estoque_movimentacoes (
      material_id, tipo, quantidade, referencia_tipo, referencia_id, observacao
    )
    SELECT
      pci.material_id,
      'entrada',
      pci.quantidade,
      'pedido_compra',
      NEW.id,
      'Recebimento compra #' || NEW.numero
    FROM pedido_compra_itens pci
    WHERE pci.pedido_compra_id = NEW.id
      AND pci.material_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compra_recebimento_estoque ON pedidos_compra;
CREATE TRIGGER trg_compra_recebimento_estoque
  AFTER UPDATE OF status ON pedidos_compra
  FOR EACH ROW EXECUTE FUNCTION fn_compra_recebimento_estoque();
```

- [ ] **Step 3: Execute via Supabase SQL Editor**

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/039_fix_inoperative_triggers.sql
git commit -m "fix: repair 3 inoperative triggers (producao→estoque, compra→CP, compra→estoque)

Uses correct table names: pedidos_compra, pedido_compra_itens,
estoque_movimentacoes, contas_pagar (numero_titulo, valor_original).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 13: Create Auto-Integration Pedido → Conta a Receber

**Files:**
- Create: `supabase/migrations/040_trigger_pedido_conta_receber.sql`

**Schema reference (contas_receber correct columns):**
- `numero_titulo` (NOT "descricao")
- `valor_original` (NOT "valor")
- `pedido_id` (direct FK, NOT "referencia_id")
- `cliente_id` (FK)
- Status values: `'previsto'` (NOT "pendente")

- [ ] **Step 1: Create trigger function**

```sql
-- 040_trigger_pedido_conta_receber.sql
-- When a pedido is approved, auto-create a conta_receber entry

CREATE OR REPLACE FUNCTION fn_pedido_gera_conta_receber()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'aprovado' AND (OLD.status IS DISTINCT FROM 'aprovado') THEN
    INSERT INTO contas_receber (
      numero_titulo, valor_original, saldo, data_vencimento, cliente_id, pedido_id, status
    )
    VALUES (
      'PED-' || NEW.numero,
      NEW.valor_total,
      NEW.valor_total,
      NOW() + INTERVAL '30 days',
      NEW.cliente_id,
      NEW.id,
      'previsto'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pedido_gera_conta_receber ON pedidos;
CREATE TRIGGER trg_pedido_gera_conta_receber
  AFTER UPDATE OF status ON pedidos
  FOR EACH ROW EXECUTE FUNCTION fn_pedido_gera_conta_receber();

-- Also trigger on INSERT when status is already 'aprovado'
DROP TRIGGER IF EXISTS trg_pedido_insert_conta_receber ON pedidos;
CREATE TRIGGER trg_pedido_insert_conta_receber
  AFTER INSERT ON pedidos
  FOR EACH ROW
  WHEN (NEW.status = 'aprovado')
  EXECUTE FUNCTION fn_pedido_gera_conta_receber();
```

- [ ] **Step 2: Execute via Supabase SQL Editor**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/040_trigger_pedido_conta_receber.sql
git commit -m "feat: auto-create conta_receber when pedido is approved

Trigger creates an AR entry (status 'previsto', saldo = valor_total,
30-day due date) when pedido transitions to 'aprovado'.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 5: Remaining Fixes (Tasks 14–15)

### Task 14: Fix TypeScript/Schema Alignment

**Files:**
- Modify: `src/domains/compras/types/compras.types.ts`
- Modify: `src/domains/qualidade/types/qualidade.types.ts`
- Modify: `src/domains/estoque/types/estoque.types.ts`

- [ ] **Step 1: Read current types and compare against actual Supabase schema**

For each domain, run a query against Supabase to get actual column names:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'pedidos_compra'
ORDER BY ordinal_position;
```

**Note:** The correct table name is `pedidos_compra` (NOT "compras").

Compare against the TypeScript interface.

- [ ] **Step 2: Update compras.types.ts to match schema**

Add any missing fields, remove any phantom fields, fix types (e.g., `number | null` for nullable numeric columns).

- [ ] **Step 3: Update qualidade.types.ts to match schema**

Same process — add missing `prioridade` field if absent, etc.

- [ ] **Step 4: Update estoque.types.ts to match schema**

Same process — ensure `quantidade_disponivel` and any other drifted fields are correct.

- [ ] **Step 5: Verify compilation**

Run: `cd /c/Users/Caldera/Claude/CRM-Croma && npx tsc --noEmit --skipLibCheck 2>&1 | head -30`

- [ ] **Step 6: Commit**

```bash
git add src/domains/compras/types/compras.types.ts \
  src/domains/qualidade/types/qualidade.types.ts \
  src/domains/estoque/types/estoque.types.ts
git commit -m "fix: align TypeScript types with Supabase schema

Updates compras, qualidade, and estoque type definitions to match
actual database columns, fixing runtime type mismatches.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 15: Add Padding Consistency Fix (Remove Duplicate p-6)

**Files:**
- Multiple pages with nested `p-6` padding

- [ ] **Step 1: Find pages with duplicate padding**

Run: `grep -rn "p-6" src/domains/ --include="*.tsx" -l`

- [ ] **Step 2: For each file with double p-6 nesting, remove the inner one**

Check if any page has both a Layout-level `p-6` AND a content-level `p-6`. If so, remove the inner one to prevent 48px double padding.

- [ ] **Step 3: Commit**

```bash
git add src/domains/
git commit -m "fix: remove duplicate p-6 padding in page containers

Prevents double 24px+24px padding where Layout already provides spacing.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Execution Order

| Priority | Tasks | Time Est. | Dependencies |
|----------|-------|-----------|-------------|
| 🔴 CRITICAL | 1, 2, 3 | 30min | None — do first |
| 🔴 CRITICAL | 10, 11, 12, 13 | 45min | None — SQL migrations 037-040 |
| 🟡 HIGH | 4, 5, 8 | 20min | None |
| 🟡 HIGH | 6, 7 | 30min | None |
| 🟢 MEDIUM | 9, 14, 15 | 30min | None |

**Total estimated: ~2.5 hours**

Tasks 1-3 and Tasks 10-13 can be executed in parallel (different file domains).
Tasks 4-9 and 14-15 can all be parallelized.
