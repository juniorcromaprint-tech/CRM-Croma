# Sprint 1 — Blindagem: Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the ERP secure and reliable for real-world usage with multiple users — every person sees only what their role permits, no destructive action happens without validation, no corrupted data enters the database.

**Architecture:** Three parallel fronts: (A) Database hardening via Supabase SQL migrations — RLS, indexes, constraints; (B) Permission fixes in frontend code — AuthContext null-role bypass, /tv auth; (C) Business logic guards — pedido status transitions, gerarContasReceber transactional ordering.

**Tech Stack:** Supabase SQL (migrations via MCP), React 19 + TypeScript, Zod schemas

**Spec:** `docs/superpowers/specs/2026-03-14-plano-acao-erp-design.md`

---

## Pre-research Summary: What's Already Done

These items from the original audit are **already fixed** and should NOT be re-implemented:

| ID | Item | Status |
|----|------|--------|
| SEC-02 | JWT validation in Edge Functions | Already implemented in all 3 functions (`enviar-email-proposta`, `onedrive-criar-pasta`, `onedrive-upload-proposta`) |
| SEC-03 | PermissionGuard on admin routes | Already wrapping all `/admin/*` routes in `adminRoutes.tsx` |
| SEC-05 | Remove tender-archimedes URL from email | Already using `crm-croma.vercel.app` in code |
| NEG-01 | Block editing approved orçamento | C-08 guard exists in `orcamento.service.ts:352-370` |
| NEG-02 | Block converting refused orçamento | Guard exists in `converterParaPedido()` |
| NEG-06 | Quantity ≤ 0 validation | Already blocked in `OrcamentoEditorPage.tsx` |
| FIN-01 | Future date validation for boleto | Already in `bankSlipCreateSchema` |
| FIN-02 | Duplicate boleto check | Already in `boleto.service.ts:3-14` |

---

## Chunk 1: Database Hardening

### Task 1: RLS on 8 Critical Tables

**Context:** 80+ tables exist without RLS. Priority: the 8 tables holding sensitive business data. Policies should be based on `auth.uid()` matching the user's profile. All authenticated users within the org can read/write (single-tenant for now; multi-tenant comes in Sprint 4).

**Execution:** Run via Supabase MCP tool `execute_sql` or apply as migration `023_rls_critical_tables.sql`.

**Files:**
- Create: `supabase/migrations/023_rls_blindagem.sql`

- [ ] **Step 1: Write the RLS migration SQL**

```sql
-- 023_rls_blindagem.sql
-- Enable RLS on 8 critical tables + create permissive policies for authenticated users

-- 1. clientes
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage clientes"
  ON clientes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. propostas
ALTER TABLE propostas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage propostas"
  ON propostas FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. proposta_itens
ALTER TABLE proposta_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage proposta_itens"
  ON proposta_itens FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. pedidos
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage pedidos"
  ON pedidos FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. pedido_itens
ALTER TABLE pedido_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage pedido_itens"
  ON pedido_itens FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 6. leads
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage leads"
  ON leads FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 7. contas_receber
ALTER TABLE contas_receber ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage contas_receber"
  ON contas_receber FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 8. contas_pagar
ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage contas_pagar"
  ON contas_pagar FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

**Important:** These are permissive "all authenticated" policies for single-tenant mode. When the system becomes SaaS (Sprint 4+), policies will be tightened to filter by `tenant_id`. For now, the critical thing is that **unauthenticated (anon) access is blocked**.

- [ ] **Step 2: Execute the migration on Supabase**

Run via Supabase MCP `execute_sql` tool against project `djwjmfgplnqyffdcgdaw`.

Expected: All 8 `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` succeed. All 8 `CREATE POLICY` succeed.

- [ ] **Step 3: Verify RLS is active**

Run via Supabase MCP:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('clientes','propostas','proposta_itens','pedidos','pedido_itens','leads','contas_receber','contas_pagar');
```

Expected: All 8 rows show `rowsecurity = true`.

- [ ] **Step 4: Save migration file locally and commit**

```bash
git add supabase/migrations/023_rls_blindagem.sql
git commit -m "feat(db): enable RLS on 8 critical tables with authenticated policies"
```

---

### Task 2: FK Indexes on Transaction Tables

**Context:** 78 Foreign Keys lack indexes, causing sequential scans on JOINs. Focus on the 14 highest-traffic FKs.

**Files:**
- Modify: `supabase/migrations/023_rls_blindagem.sql` (append to same migration) OR create separate `024_indexes.sql`

- [ ] **Step 1: Write the index creation SQL**

```sql
-- Indexes on high-traffic Foreign Keys
-- Using IF NOT EXISTS to be idempotent

CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_id ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_proposta_id ON pedidos(proposta_id);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido_id ON pedido_itens(pedido_id);
CREATE INDEX IF NOT EXISTS idx_proposta_itens_proposta_id ON proposta_itens(proposta_id);
CREATE INDEX IF NOT EXISTS idx_propostas_cliente_id ON propostas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordens_producao_pedido_id ON ordens_producao(pedido_id);
CREATE INDEX IF NOT EXISTS idx_ordens_producao_pedido_item_id ON ordens_producao(pedido_item_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_pedido_id ON contas_receber(pedido_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_cliente_id ON contas_receber(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_pedido_id ON contas_pagar(pedido_id);
CREATE INDEX IF NOT EXISTS idx_instalacoes_pedido_id ON instalacoes(pedido_id);
CREATE INDEX IF NOT EXISTS idx_instalacoes_cliente_id ON instalacoes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_leads_cliente_id ON leads(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_documentos_pedido_id ON fiscal_documentos(pedido_id);
```

- [ ] **Step 2: Execute on Supabase**

Run via Supabase MCP `execute_sql`. Expected: 14 indexes created (or already exist).

- [ ] **Step 3: Verify indexes exist**

```sql
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY indexname;
```

Expected: All 14 `idx_*` indexes listed.

- [ ] **Step 4: Save and commit**

```bash
git add supabase/migrations/023_rls_blindagem.sql
git commit -m "perf(db): add 14 FK indexes on transaction tables"
```

---

### Task 3: NOT NULL Constraints + Defaults on Critical Fields

**Context:** 12 critical fields are nullable (status, valor_total, quantidade in pedidos/propostas/OPs), allowing corrupted data.

**Files:**
- Append to migration file

- [ ] **Step 1: Write constraint SQL**

```sql
-- Set defaults and NOT NULL on critical fields
-- First update any existing NULLs to the default value

UPDATE pedidos SET status = 'novo' WHERE status IS NULL;
ALTER TABLE pedidos ALTER COLUMN status SET DEFAULT 'novo';
ALTER TABLE pedidos ALTER COLUMN status SET NOT NULL;

UPDATE propostas SET status = 'rascunho' WHERE status IS NULL;
ALTER TABLE propostas ALTER COLUMN status SET DEFAULT 'rascunho';
ALTER TABLE propostas ALTER COLUMN status SET NOT NULL;

UPDATE pedido_itens SET quantidade = 1 WHERE quantidade IS NULL;
ALTER TABLE pedido_itens ALTER COLUMN quantidade SET DEFAULT 1;
ALTER TABLE pedido_itens ALTER COLUMN quantidade SET NOT NULL;

UPDATE proposta_itens SET quantidade = 1 WHERE quantidade IS NULL;
ALTER TABLE proposta_itens ALTER COLUMN quantidade SET DEFAULT 1;
ALTER TABLE proposta_itens ALTER COLUMN quantidade SET NOT NULL;

UPDATE pedidos SET valor_total = 0 WHERE valor_total IS NULL;
ALTER TABLE pedidos ALTER COLUMN valor_total SET DEFAULT 0;
ALTER TABLE pedidos ALTER COLUMN valor_total SET NOT NULL;

UPDATE propostas SET valor_total = 0 WHERE valor_total IS NULL;
ALTER TABLE propostas ALTER COLUMN valor_total SET DEFAULT 0;
ALTER TABLE propostas ALTER COLUMN valor_total SET NOT NULL;

UPDATE ordens_producao SET status = 'pendente' WHERE status IS NULL;
ALTER TABLE ordens_producao ALTER COLUMN status SET DEFAULT 'pendente';
ALTER TABLE ordens_producao ALTER COLUMN status SET NOT NULL;
```

- [ ] **Step 2: Execute on Supabase**

Run via Supabase MCP. Expected: All `ALTER` and `UPDATE` succeed.

- [ ] **Step 3: Verify constraints**

```sql
SELECT table_name, column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('pedidos','propostas','pedido_itens','proposta_itens','ordens_producao')
  AND column_name IN ('status','valor_total','quantidade')
ORDER BY table_name, column_name;
```

Expected: `status`, `quantidade`, and `valor_total` columns show `is_nullable = NO`.

- [ ] **Step 4: Save and commit**

```bash
git add supabase/migrations/023_rls_blindagem.sql
git commit -m "fix(db): add NOT NULL constraints and defaults on critical fields"
```

---

### Task 4: Clean Corrupted Data — R$ 0 Propostas

**Context:** Some active propostas have `valor_total = 0.00`, which are likely corrupted. Revert them to `rascunho` status.

- [ ] **Step 1: Check how many propostas are affected**

```sql
SELECT id, status, valor_total, created_at
FROM propostas
WHERE valor_total = 0 AND status NOT IN ('rascunho', 'cancelado')
ORDER BY created_at DESC;
```

- [ ] **Step 2: Revert affected propostas to rascunho**

```sql
UPDATE propostas
SET status = 'rascunho'
WHERE valor_total = 0 AND status NOT IN ('rascunho', 'cancelado');
```

- [ ] **Step 3: Verify no active R$ 0 propostas remain**

```sql
SELECT COUNT(*) as corrupted
FROM propostas
WHERE valor_total = 0 AND status NOT IN ('rascunho', 'cancelado');
```

Expected: `corrupted = 0`.

---

## Chunk 2: Permission & Auth Fixes

### Task 5: Fix AuthContext Null-Role Bypass

**Context:** `AuthContext.tsx` line 88-89 sets `effectiveRole = 'comercial'` for null-role users (good), but lines 100-103 still return `accessibleModules = null` for null-role users, which means **the sidebar shows ALL modules** (admin, financeiro, etc.). Note: `PermissionGuard` itself already uses `can()` which respects `effectiveRole`, so actual page access is restricted. The real vulnerability is in **sidebar/navigation visibility** — a null-role user sees admin menus (even though clicking them shows "Acesso Restrito"). This is confusing UX and a soft security issue.

**Files:**
- Modify: `src/contexts/AuthContext.tsx:99-105`

- [ ] **Step 1: Read the current code**

Read `src/contexts/AuthContext.tsx` lines 99-105.

Current code:
```typescript
const accessibleModules = useMemo<string[] | null>(() => {
  if (!profile?.role) {
    return null; // sem role = acesso total (admin)
  }
  return getAccessibleModules(profile.role);
}, [profile?.role]);
```

- [ ] **Step 2: Fix the null-role to use comercial permissions**

Replace with:
```typescript
const accessibleModules = useMemo<string[] | null>(() => {
  // Sem role = acesso restrito (comercial) por segurança
  return getAccessibleModules(effectiveRole);
}, [effectiveRole]);
```

This ensures null-role users get `comercial` module access, consistent with `effectiveRole`.

- [ ] **Step 3: Update the PermissionGuard comment**

In `src/shared/components/PermissionGuard.tsx`, update the comment at lines 19-20:

Replace:
```typescript
 * Nota: usuários sem role (profile.role === null) recebem acesso total
 * por design (admin provisório até que roles sejam atribuídos).
```
With:
```typescript
 * Nota: usuários sem role recebem acesso de 'comercial' por segurança.
 * Para acesso admin, a role deve ser atribuída explicitamente no banco.
```

- [ ] **Step 4: Verify build passes**

```bash
cd C:/Users/Caldera/Claude/CRM-Croma && npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/contexts/AuthContext.tsx src/shared/components/PermissionGuard.tsx
git commit -m "fix(auth): remove null-role full-access bypass — default to comercial permissions"
```

---

### Task 6: Auth on /tv Route

**Context:** The `/tv` route displays real-time production data publicly without authentication. Anyone who knows the URL can see production status, order details, and client information.

**Files:**
- Modify: `src/App.tsx` (or wherever `/tv` route is defined)
- Possible new file: `src/shared/components/TvAuthGuard.tsx`

- [ ] **Step 1: Find the /tv route definition**

Search for `/tv` route in the routes/App.tsx files.

```bash
grep -rn '"/tv"' src/
```

- [ ] **Step 2: Wrap /tv with authentication**

The simplest approach: wrap the `/tv` route with the existing `ProtectedRoute` component used by all other routes. This requires the user to be logged in.

If the route is currently outside `ProtectedRoute`:
```typescript
// Before:
<Route path="/tv" element={<TvDisplayPage />} />

// After:
<Route path="/tv" element={<ProtectedRoute><TvDisplayPage /></ProtectedRoute>} />
```

If a token-based approach is preferred (e.g. for a wall-mounted TV), create a simple token guard:

```typescript
// src/shared/components/TvAuthGuard.tsx
import { useSearchParams, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const VALID_TV_TOKENS = ['croma-tv-2026']; // In production, validate against DB

export default function TvAuthGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token');

  // Allow if authenticated OR has valid token
  if (user || (token && VALID_TV_TOKENS.includes(token))) {
    return <>{children}</>;
  }

  return <Navigate to="/login" replace />;
}
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/shared/components/TvAuthGuard.tsx
git commit -m "fix(auth): protect /tv route — require login or valid token"
```

---

## Chunk 3: Business Logic Guards

### Task 7: Fix gerarContasReceber Ordering Bug

**Context:** In `PedidoDetailPage.tsx:130-138`, `concluirPedido()` calls `updatePedido.mutate()` (fire-and-forget) BEFORE `gerarContasReceber()`. If CR generation fails, the pedido is already marked as `concluido` without billing records. The fix: generate contas a receber FIRST, then update status only on success.

**Files:**
- Modify: `src/domains/pedidos/pages/PedidoDetailPage.tsx:130-139`

- [ ] **Step 1: Read the current buggy code**

Current (lines 130-138):
```typescript
const concluirPedido = async () => {
  if (!id) return
  updatePedido.mutate({ id, status: 'concluido' as any })
  try {
    await gerarContasReceber(id)
  } catch (err: any) {
    console.error('[gerarContasReceber]', err)
    showError('Pedido concluído, mas houve erro ao gerar cobranças. Verifique o módulo financeiro.')
  }
}
```

- [ ] **Step 2: Fix the ordering — CR first, status second**

Replace with:
```typescript
const concluirPedido = async () => {
  if (!id) return
  try {
    // 1. Gerar contas a receber ANTES de marcar como concluído
    await gerarContasReceber(id)
    // 2. Atualizar status via Supabase direto (não mutate fire-and-forget)
    const { error } = await supabase
      .from('pedidos')
      .update({ status: 'concluido' })
      .eq('id', id)
    if (error) throw error
    // 3. Invalidar cache para refletir no UI
    queryClient.invalidateQueries({ queryKey: ['pedidos'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    showSuccess('Pedido concluído com sucesso!')
  } catch (err: any) {
    console.error('[concluirPedido]', err)
    showError('Erro ao concluir pedido. Verifique o módulo financeiro.')
  }
}
```

**Key changes:**
1. `gerarContasReceber()` runs first — if it fails, nothing changes.
2. Status update uses `await supabase.from().update()` instead of fire-and-forget `.mutate()` — if the update fails after CR was generated, the error is caught and shown.
3. Both operations are awaited, making the flow truly sequential and error-aware.

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/domains/pedidos/pages/PedidoDetailPage.tsx
git commit -m "fix(pedidos): generate contas_receber BEFORE marking pedido as concluído"
```

---

### Task 8: Status Transition Validation for Pedidos

**Context:** The `FLOW_ACTIONS` map at `PedidoDetailPage.tsx:30-38` defines valid transitions, but `handleAdvanceStatus()` at line 169 allows ANY status update via `updatePedido.mutate({ id, status: action.next })` without server-side validation. A user could manipulate the UI to skip steps. Add a guard that validates the transition before executing.

**Files:**
- Modify: `src/domains/pedidos/pages/PedidoDetailPage.tsx:141-170`

- [ ] **Step 1: Read handleAdvanceStatus**

Current code at lines 141-170:
```typescript
const handleAdvanceStatus = async () => {
  if (!id || !pedido) return
  const action = FLOW_ACTIONS[pedido.status]
  if (!action) return

  if (pedido.status === 'aprovado') {
    iniciarProducao.mutate(id)
    return
  }

  if (action.next === 'concluido') {
    const { data: nfes } = await supabase
      .from('fiscal_documentos')
      .select('id')
      .eq('pedido_id', id)
      .limit(1)

    if (!nfes || nfes.length === 0) {
      setShowConcluirSemNfeDialog(true)
      return
    }

    await concluirPedido()
    return
  }

  updatePedido.mutate({ id, status: action.next as any })
}
```

- [ ] **Step 2: Add pre-condition checks for key transitions**

Replace with:
```typescript
// Mapa de transições válidas — rejeita saltos de status
const VALID_TRANSITIONS: Record<string, string[]> = {
  rascunho:              ['aguardando_aprovacao'],
  aguardando_aprovacao:  ['aprovado', 'cancelado'],
  aprovado:              ['em_producao', 'cancelado'],
  em_producao:           ['produzido', 'cancelado'],
  produzido:             ['aguardando_instalacao', 'cancelado'],
  aguardando_instalacao: ['em_instalacao', 'cancelado'],
  em_instalacao:         ['concluido', 'cancelado'],
}

const handleAdvanceStatus = async () => {
  if (!id || !pedido) return
  const action = FLOW_ACTIONS[pedido.status]
  if (!action) return

  // Guard geral: validar que a transição é permitida
  const allowed = VALID_TRANSITIONS[pedido.status] ?? []
  if (!allowed.includes(action.next)) {
    showError(`Transição inválida: ${pedido.status} → ${action.next}`)
    return
  }

  // Guard: "Aprovado → Em Produção" — cria OP automaticamente
  if (pedido.status === 'aprovado') {
    iniciarProducao.mutate(id)
    return
  }

  // Guard: "Em Produção → Produzido" — verificar se todas as OPs estão concluídas
  if (pedido.status === 'em_producao') {
    const { data: ops } = await supabase
      .from('ordens_producao')
      .select('id, status')
      .eq('pedido_id', id)

    if (!ops || ops.length === 0) {
      showError('Nenhuma Ordem de Produção encontrada. Crie as OPs antes de marcar como produzido.')
      return
    }

    const pendentes = ops.filter(op => op.status !== 'concluida')
    if (pendentes.length > 0) {
      showError(`${pendentes.length} OP(s) ainda não concluída(s). Finalize todas antes de marcar como produzido.`)
      return
    }
  }

  // Guard: "Em Instalação → Concluído" — verificar NF-e + gerar contas
  if (action.next === 'concluido') {
    const { data: nfes } = await supabase
      .from('fiscal_documentos')
      .select('id')
      .eq('pedido_id', id)
      .limit(1)

    if (!nfes || nfes.length === 0) {
      setShowConcluirSemNfeDialog(true)
      return
    }

    await concluirPedido()
    return
  }

  updatePedido.mutate({ id, status: action.next as any })
}
```

**Key additions:**
1. `VALID_TRANSITIONS` map defines exactly which status changes are allowed — prevents skipping steps.
2. The `em_producao → produzido` transition checks that all OPs are `concluida`.
3. General guard at the top rejects any transition not in the map.

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/domains/pedidos/pages/PedidoDetailPage.tsx
git commit -m "fix(pedidos): validate pre-conditions before status transitions (OPs check)"
```

---

### Task 9: Remove tender-archimedes from Documentation Files

**Context:** 13 files still reference `tender-archimedes.lovable.app`. While the code (Edge Functions) already uses the correct URL, documentation files should be updated to avoid confusion.

**Files to update** (found via grep):
- `docs/QA-REPORT-BANNER-TESTE-2026-03-13.md`
- `docs/RELATORIO_FALHAS_TESTE_E2E_2026-03-12.md`
- `ESTADO.md`
- `docs/MANUAL_FINANCEIRO.md`
- `docs/MANUAL_VENDEDOR.md`
- `docs/MANUAL_IMPLANTACAO.md`
- `docs/PROJECT_MEMORY.md`
- `docs/PROJECT_GOVERNANCE.md`
- `docs/FIELD_APP.md`
- `docs/ARCHITECTURE.md`
- `README.md`

- [ ] **Step 1: Replace all occurrences**

For each file, replace all instances of:
- `tender-archimedes.lovable.app` → `crm-croma.vercel.app`
- `https://tender-archimedes.lovable.app` → `https://crm-croma.vercel.app`

Use sed or manual edit for each file.

```bash
cd C:/Users/Caldera/Claude/CRM-Croma
find . -name "*.md" -exec sed -i 's/tender-archimedes\.lovable\.app/crm-croma.vercel.app/g' {} \;
```

- [ ] **Step 2: Verify no references remain**

```bash
grep -rn "tender-archimedes" . --include="*.md" --include="*.ts" --include="*.tsx"
```

Expected: Zero matches.

- [ ] **Step 3: Commit only the changed .md files**

```bash
git add README.md ESTADO.md docs/QA-REPORT-BANNER-TESTE-2026-03-13.md docs/RELATORIO_FALHAS_TESTE_E2E_2026-03-12.md docs/MANUAL_FINANCEIRO.md docs/MANUAL_VENDEDOR.md docs/MANUAL_IMPLANTACAO.md docs/PROJECT_MEMORY.md docs/PROJECT_GOVERNANCE.md docs/FIELD_APP.md docs/ARCHITECTURE.md
git commit -m "docs: replace all tender-archimedes URLs with crm-croma.vercel.app"
```

---

## Chunk 4: Verification & Deploy

### Task 10: Final Build Verification

- [ ] **Step 1: Run TypeScript check**

```bash
cd C:/Users/Caldera/Claude/CRM-Croma && npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 2: Run Vite build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Verify git status is clean**

```bash
git status
git log --oneline -10
```

Expected: All changes committed, branch ready for PR.

---

### Task 11: Create PR and Merge

- [ ] **Step 1: Push branch**

If working in a worktree branch:
```bash
git push -u origin sprint1-blindagem
```

- [ ] **Step 2: Create PR**

```bash
gh pr create --title "Sprint 1: Blindagem — Security + Business Guards" --body "$(cat <<'EOF'
## Summary
- RLS enabled on 8 critical tables (clientes, propostas, pedidos, leads, contas_*)
- 14 FK indexes on transaction tables for performance
- NOT NULL constraints on critical fields (status, quantidade)
- Fixed AuthContext null-role bypass (was granting full access)
- Protected /tv route with authentication
- Fixed gerarContasReceber ordering (CR before status update)
- Status transition validation for pedidos (OPs check before "produzido")
- Cleaned corrupted R$0 propostas
- Removed all tender-archimedes URL references

## Test plan
- [ ] Login as user without role → should see only comercial modules
- [ ] Try accessing /tv without login → should redirect to login
- [ ] Try concluding pedido with pending OPs → should show error
- [ ] Try concluding pedido → contas_receber should be generated before status changes
- [ ] Verify all admin routes still require admin role
- [ ] Check site loads at crm-croma.vercel.app after deploy

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Merge and verify deploy**

Merge PR on GitHub, verify Vercel auto-deploys successfully.

---

## Execution Notes

### Parallel Execution Strategy

Tasks 1-4 (database) are independent from Tasks 5-8 (code). They can run in parallel:

| Agent A (Database) | Agent B (Code) |
|---|---|
| Task 1: RLS policies | Task 5: AuthContext fix |
| Task 2: FK indexes | Task 6: /tv auth |
| Task 3: NOT NULL constraints | Task 7: gerarContasReceber fix |
| Task 4: Clean R$0 propostas | Task 8: Status transitions |

Task 9 (docs cleanup) can run in parallel with both.

Tasks 10-11 (verification + PR) run last, sequentially.

### Tools Required

- **Supabase MCP** (`execute_sql`): Tasks 1-4
- **Code editor**: Tasks 5-8
- **Bash/grep/sed**: Task 9
- **GitHub API**: Task 11

### Estimated Time

- Database tasks: ~30 min
- Code tasks: ~45 min
- Docs + verification: ~15 min
- **Total: ~1.5 hours** (with parallel execution ~45 min)
