# Architecture Audit Report — Croma Print ERP/CRM

> **Date**: 2026-03-22
> **Auditor**: Senior Software Architect (Automated)
> **Scope**: Full codebase (`src/`, `APP-Campo/`, `supabase/`, `nfe-service/`)
> **Build**: PASS (23.46s) | **Tests**: 384/384 PASS (31.50s)

---

## Scores

| Dimension | Score | Notes |
|---|---|---|
| **Architecture** | **6.5 / 10** | Good domain decomposition, marred by god-components and leaky layers |
| **Code Quality** | **5.5 / 10** | 154 `: any`, 288 `as any`, 14 pages with direct DB calls |
| **Test Coverage** | **4.0 / 10** | 38 test files for 499 source files (7.6% file coverage) |
| **Dependency Health** | **7.0 / 10** | Clean deps, minor duplication between ERP and Campo |
| **Route Organization** | **8.5 / 10** | Excellent: lazy loading, permission guards, modular route files |
| **Build Health** | **7.0 / 10** | Builds clean but 4 chunks exceed 500 KB warning threshold |
| **Overall** | **6.4 / 10** | Functional system with significant technical debt in component size and typing |

---

## 1. Project Structure Overview

### Metrics

| Metric | Value |
|---|---|
| Total source files (src/) | 499 |
| Total lines of code (src/) | 102,753 |
| APP-Campo source lines | 12,681 |
| Domains | 16 |
| Edge Functions | 36 |
| Migration files | 93 |
| UI components (shadcn) | 37 (ERP) / 49 (Campo) |
| Shared components | 15 |
| Test files | 38 |

### Domain Size Distribution

| Domain | Lines | Pages | Components | Hooks | Services |
|---|---|---|---|---|---|
| comercial | 17,026 | 16 | 17 | 18 | 2 |
| admin | 14,563 | 16 | 10 | 6 | 2 |
| financeiro | 10,590 | 10 | 9 | 5 | 11 |
| producao | 8,064 | 9 | 13 | 7 | 4 |
| agent | 5,452 | 4 | 5 | 5 | 2 |
| fiscal | 4,372 | 6 | 2 | 2 | 1 |
| contabilidade | 3,244 | 7 | 5 | 5 | 5 |
| dados | 3,045 | 2 | 9 | 4 | 3 |
| clientes | 2,986 | 2 | 0 | 7 | 0 |
| ai | 2,466 | 0 | 14 | 8 | 0 |
| instalacao | 2,422 | 1 | 1 | 2 | 2 |
| estoque | 2,279 | 3 | 4 | 3 | 2 |
| compras | 1,915 | 3 | 3 | 2 | 1 |
| qualidade | 1,651 | 3 | 3 | 3 | 1 |
| portal | 1,407 | 2 | 7 | 3 | 3 |
| pedidos | 2,146 | 2 | 0 | 4 | 0 |

---

## 2. Findings by Severity

### CRITICAL

#### C1. God Components (13 files > 800 lines)

These page components violate Single Responsibility Principle. They contain state management, data fetching, business logic, and complex UI all in one file.

| File | Lines | useStates | Queries/Mutations |
|---|---|---|---|
| `src/domains/admin/pages/AdminProdutosPage.tsx` | **2,620** | 28 | 35 |
| `src/domains/producao/pages/ProducaoPage.tsx` | **2,167** | 23 | 11 |
| `src/domains/financeiro/pages/FinanceiroPage.tsx` | **2,111** | 15 | 17 |
| `src/domains/clientes/pages/ClienteDetailPage.tsx` | **1,800** | — | — |
| `src/domains/admin/pages/AdminUsuariosPage.tsx` | **1,679** | — | — |
| `src/domains/comercial/pages/OrcamentoEditorPage.tsx` | **1,481** | — | — |
| `src/domains/instalacao/pages/InstalacaoPage.tsx` | **1,391** | — | — |
| `src/domains/pedidos/pages/PedidosPage.tsx` | **1,172** | — | — |
| `src/domains/agent/pages/AgentConfigPage.tsx` | **1,149** | — | — |
| `src/domains/fiscal/pages/FiscalConfiguracaoPage.tsx` | **1,034** | — | — |
| `src/domains/financeiro/pages/ComissoesPage.tsx` | **1,023** | — | — |
| `src/domains/admin/pages/AdminPrecificacaoPage.tsx` | **1,023** | — | — |
| `src/domains/financeiro/pages/DrePage.tsx` | **1,000** | — | — |

**Impact**: Extremely hard to maintain, test, review, or refactor. `AdminProdutosPage.tsx` alone has 28 useState calls and 124 function definitions — it is essentially 5-6 components fused into one.

**Recommendation**: Extract into sub-components, custom hooks, and service layers. Target: no page > 400 lines.

#### C2. Weak Type Safety — 442 Type Suppressions

| Pattern | Count | Severity |
|---|---|---|
| `: any` annotations | 154 | Critical |
| `as any` casts | 288 | Critical |
| `@ts-ignore` / `@ts-nocheck` | 0 | Good |
| Total suppressions | **442** | — |

**Hotspots** (from sample):
- `src/domains/admin/components/ComposicaoEditor.tsx` — `(item: any)` in loops
- `src/domains/comercial/hooks/useItemEditor.ts` — `(regras as any[])`, `(r: any)`
- `src/domains/comercial/pages/DashboardDiretor.tsx` — `(lead: any)`, `(ped: any)`
- `src/domains/comercial/pages/DashboardFinanceiro.tsx` — `(c: any)` in loops
- `src/domains/clientes/pages/ClienteDetailPage.tsx` — `(u: any)`, `(c: any)` for unidades/contatos

**Impact**: Bypasses TypeScript's entire value proposition. Runtime crashes from unexpected data shapes become undetectable at compile time.

**Recommendation**: Define interfaces for all Supabase response shapes. Create a `src/shared/types/database.ts` with typed table rows. Use Supabase's generated types.

#### C3. Business Logic in Page Components — 14 Pages with Direct Supabase Calls

The following page files execute `supabase.from(...)` directly instead of going through service layers:

1. `src/domains/admin/pages/AdminSetupPage.tsx`
2. `src/domains/admin/pages/AdminUsuariosPage.tsx`
3. `src/domains/agent/pages/AgentConfigPage.tsx`
4. `src/domains/clientes/pages/ClientesPage.tsx`
5. `src/domains/comercial/pages/CampanhasPage.tsx`
6. `src/domains/comercial/pages/DashboardDiretor.tsx`
7. `src/domains/comercial/pages/LeadsPage.tsx`
8. `src/domains/financeiro/pages/FinanceiroPage.tsx`
9. `src/domains/fiscal/pages/FiscalCertificadoPage.tsx`
10. `src/domains/fiscal/pages/FiscalConfiguracaoPage.tsx`
11. `src/domains/fiscal/pages/FiscalDocumentosPage.tsx`
12. `src/domains/fiscal/pages/FiscalFilaPage.tsx`
13. `src/domains/instalacao/pages/InstalacaoPage.tsx`
14. `src/domains/pedidos/pages/PedidoDetailPage.tsx`

**Impact**: Mixing data access with UI makes testing impossible without mocking Supabase. Duplicated query logic across pages. No single source of truth for data operations.

**Recommendation**: Every `supabase.from()` call in a page should move to a domain service file. Pages should only call hooks that delegate to services.

---

### HIGH

#### H1. Missing Service/Schema Layers in Key Domains

Several domains with significant code have no service or schema files:

| Domain | Lines | Services | Schemas | Issue |
|---|---|---|---|---|
| clientes | 2,986 | **0** | **0** | All DB logic in pages |
| pedidos | 2,146 | **0** | **0** | All DB logic in pages |
| ai | 2,466 | **0** | **0** | No service abstraction |

**Recommendation**: Create `clientes/services/clienteService.ts`, `pedidos/services/pedidoService.ts`.

#### H2. Low Test Coverage — 7.6% File Coverage

- 38 test files covering 499 source files
- No tests exist for any of the 13 god-component pages
- Zero component render tests for any page
- Tests concentrated in service layers (good) but absent from UI and hooks

**Domain coverage gaps**:
- `admin/` — 0 page tests, 2 service tests
- `producao/` — 0 page tests, 2 service tests
- `financeiro/` — 0 page tests, 5 service tests
- `instalacao/` — 0 tests at all
- `estoque/` — 1 service test only
- `fiscal/` — 0 tests at all
- `clientes/` — 0 tests at all

**Recommendation**: Prioritize integration tests for the business-critical flow: Lead -> Orcamento -> Pedido -> Producao.

#### H3. Build Chunk Size Warnings — 4 Oversized Chunks

| Chunk | Size | Gzipped |
|---|---|---|
| `html2pdf-*.js` | **984.61 KB** | 285.64 KB |
| `DadosHubPage-*.js` | **731.76 KB** | 136.80 KB |
| `index-*.js` | **679.60 KB** | 202.12 KB |
| `exportExcel-*.js` | **426.33 KB** | 142.53 KB |

**Impact**: Slow initial load. The `index-*.js` chunk (680 KB) loads on every page.

**Recommendation**:
- Configure `manualChunks` in `vite.config.ts` to split vendor libs (radix, recharts, tanstack)
- Dynamic import `html2pdf.js` and `xlsx` only where used
- The `DadosHubPage` chunk is too large — lazy-load its sub-components

#### H4. 3 Direct `sonner` Imports Bypassing Toast Wrapper

Files importing `toast` from `sonner` directly instead of using `@/utils/toast.ts`:

1. `src/domains/comercial/pages/DashboardPage.tsx:4` — `import { toast } from "sonner"`
2. `src/domains/comercial/pages/OrcamentoEditorPage.tsx:51` — `import { toast } from "sonner"`
3. `src/domains/producao/pages/ProducaoPage.tsx:14` — `import { toast } from "sonner"`

**Impact**: Inconsistent toast behavior if the wrapper is ever enhanced (e.g., logging, analytics).

---

### MEDIUM

#### M1. Legacy Files Outside Domain Structure

Two page files remain in `src/pages/` instead of being organized under domains:

| File | Lines | Used By |
|---|---|---|
| `src/pages/Produtos.tsx` | 938 | `operacionalRoutes.tsx` |
| `src/pages/Settings.tsx` | 693 | `adminRoutes.tsx` |

**Recommendation**: Move to `src/domains/admin/pages/` to maintain consistency.

#### M2. Duplicate Migration Number Prefixes

5 collision pairs found in `supabase/migrations/`:

- `011_categorias_produtos_reais.sql` vs `011_fix_serie_lock.sql`
- `022_fix_portal_aprovacao.sql` vs `022_seed_modelo_materiais_processos.sql`
- `031_*` (2 files)
- `078_*` (2 files)
- `093_*` (2 files)

**Impact**: Migration ordering is ambiguous. While Supabase may run them alphabetically, collisions create confusion and risk during manual re-runs.

#### M3. Junk Files Tracked in Git Repository

| File | Status |
|---|---|
| `commit.cmd` | Tracked |
| `start-dev.cmd` | Tracked |
| `croma_telegram_bot.log` | **Untracked but present** |
| `croma_telegram_bot.py` | **Untracked but present** |
| `qa_notificar.py` | **Untracked but present** |
| `leads_calcados_grande_sp.csv` | **Untracked but present** |
| `leads_calcados_grande_sp.xlsx` | **Untracked but present** |
| `start-dev.cmd.bak` | **Untracked but present** |
| `AUDIT-REPORT-2026-03-12.md` | **Untracked but present** |
| `Arquivo_ uteis_ para_croma_CRM/` | **Untracked directory** |

**Recommendation**: Add `*.log`, `*.csv`, `*.xlsx`, `*.py`, `*.bak`, `*.cmd` to `.gitignore`. Remove `commit.cmd` and `start-dev.cmd` from git tracking.

#### M4. UI Component Duplication Between ERP and APP-Campo

37 of 37 ERP UI components are identically duplicated in APP-Campo (only `calendar.tsx` differs). This is ~18,000 lines of copy-pasted shadcn components.

**Impact**: Bug fixes or upgrades to shadcn must be applied in both places manually.

**Recommendation**: Extract shared UI into a `packages/ui` workspace package (pnpm workspace).

#### M5. Cross-Domain Import Coupling

46 total cross-domain imports detected. Most (29) are from `@/domains/ai/` being consumed everywhere, which is acceptable for a cross-cutting concern. However:

- `instalacao` imports from `financeiro/services` (line 5 of InstalacaoPage.tsx)
- `producao` imports from `financeiro/services` and `instalacao/services`
- `pedidos` imports from `producao/services`, `fiscal/services`, `financeiro/services`

**Impact**: `pedidos` depends on 3 other domains directly. Changes in financeiro can break pedidos.

**Recommendation**: Extract shared business operations (gerar contas receber, criar OP, criar NF-e) into `shared/services/` or use an event/command bus pattern.

#### M6. Residual Console Statements

17 `console.log/warn/error` statements found in production source files (excluding tests).

---

### LOW

#### L1. Empty Catch Blocks

5 instances of `catch {` without error handling found in:
- `src/components/Layout.tsx` (3 instances — localStorage access, acceptable)
- `src/domains/admin/pages/AdminProdutosPage.tsx` (2 instances)

#### L2. Inconsistent Barrel Exports

Only 16 `index.ts` barrel files exist across the project. Most domain subdirectories lack barrel exports, forcing consumers to import from deep paths.

#### L3. `eslint-disable` Comments — 4 instances

Low count, acceptable.

#### L4. Utility File Fragmentation

Utility functions are split across 3 locations:
- `src/lib/utils.ts` — `cn()` only (shadcn pattern)
- `src/utils/toast.ts` — toast wrappers
- `src/shared/utils/` — format, cnpj, export, validation, etc.

The `src/utils/` and `src/lib/` locations should be consolidated into `src/shared/utils/`.

---

## 3. Dead Code Inventory

| Category | Item | Location | Evidence |
|---|---|---|---|
| Legacy page | `src/pages/Produtos.tsx` | Root pages dir | Should be under `domains/admin/pages/` |
| Legacy page | `src/pages/Settings.tsx` | Root pages dir | Should be under `domains/admin/pages/` |
| Root-level hook | `src/hooks/useNotifications.ts` | Outside domain structure | Only 1 hook, should be in `shared/hooks/` |
| Junk directory | `Arquivo_ uteis_ para_croma_CRM/` | Project root | Reference materials, not code |
| Python scripts | `croma_telegram_bot.py`, `qa_notificar.py` | Project root | DevOps artifacts mixed with frontend |
| Data files | `leads_calcados_grande_sp.csv`, `.xlsx` | Project root | Business data in repo root |

---

## 4. Duplication Inventory

| Item | Location A | Location B | Lines Duplicated |
|---|---|---|---|
| 36 shadcn UI components | `src/components/ui/` | `APP-Campo/src/components/ui/` | ~18,000 |
| `sidebar.tsx` | `src/components/ui/sidebar.tsx` (769 lines) | `APP-Campo/src/components/ui/sidebar.tsx` (769 lines) | 769 |
| `Settings.tsx` | `src/pages/Settings.tsx` (693 lines) | `APP-Campo/src/pages/Settings.tsx` (693 lines) | 693 (identical) |
| Direct sonner imports | 3 files | Should use `@/utils/toast.ts` | — |

---

## 5. Architecture Diagram

```
src/
  components/           # 3 files — Layout, ErrorBoundary, NotificationBadge
    ui/                 # 37 shadcn components
  contexts/             # AuthContext (+ tests)
  domains/              # 16 domain modules (good)
    {domain}/
      pages/            # Route-level page components
      components/       # Domain-specific UI
      hooks/            # TanStack Query hooks
      services/         # Business logic + Supabase calls
      schemas/          # Zod schemas (sparse)
      types/            # TypeScript types
  hooks/                # 1 orphan hook (useNotifications)
  integrations/supabase # Supabase client
  lib/                  # 1 file (cn utility)
  pages/                # 2 LEGACY pages (Produtos, Settings)
  routes/               # 10 modular route files (good)
  shared/               # 7,024 lines of shared code
    components/         # 15 reusable components
    hooks/              # 2 shared hooks
    services/           # Pricing engine
    utils/              # Format, export, validation
    types/              # Common types
    schemas/            # Shared Zod schemas
  test/                 # Test setup
  types/                # 1 type declaration (html2pdf.d.ts)
  utils/                # 2 files (toast, watermark) — should be in shared/
```

---

## 6. Structural Recommendations (Priority Order)

### P1 — Break God Components (Effort: HIGH, Impact: HIGH)

Target the 5 worst offenders first:
1. `AdminProdutosPage.tsx` (2,620 lines) — Split into ProductTab, ModelTab, AcabamentoTab, ServicoTab + shared hooks
2. `ProducaoPage.tsx` (2,167 lines) — Extract OP table, filters, status modals into components
3. `FinanceiroPage.tsx` (2,111 lines) — Split tabs into separate components
4. `ClienteDetailPage.tsx` (1,800 lines) — Extract history, unidades, contatos sections
5. `AdminUsuariosPage.tsx` (1,679 lines) — Extract user form, permissions table, role editor

### P2 — Introduce Supabase Generated Types (Effort: MEDIUM, Impact: HIGH)

Run `supabase gen types typescript` and replace all `any` casts with typed table rows. This eliminates 300+ type suppressions.

### P3 — Extract Service Layers for clientes/pedidos (Effort: LOW, Impact: MEDIUM)

Create:
- `src/domains/clientes/services/clienteService.ts`
- `src/domains/pedidos/services/pedidoService.ts`

Move all `supabase.from()` calls from their pages into these services.

### P4 — Shared UI Package (Effort: MEDIUM, Impact: MEDIUM)

Convert the project to a pnpm workspace:
```
packages/
  ui/          # Shared shadcn components
  shared/      # Shared utils, types, hooks
apps/
  erp/         # Current src/
  campo/       # Current APP-Campo/
```

This eliminates ~18,000 lines of duplication and ensures consistent component updates.

### P5 — Configure Manual Chunks in Vite (Effort: LOW, Impact: MEDIUM)

Add to `vite.config.ts`:
```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-popover', ...],
        'vendor-charts': ['recharts'],
        'vendor-query': ['@tanstack/react-query'],
      }
    }
  }
}
```

### P6 — Test Coverage Expansion (Effort: HIGH, Impact: HIGH)

Priority test targets:
1. Business flow integration: Lead -> Orcamento -> Pedido conversion
2. Service layer: financeiro-automation, producao, instalacao
3. Hook tests: useOrcamentoPricing, useItemEditor
4. Page smoke tests: Render without crash for top 10 pages

---

## 7. What Is Done Well

1. **Domain decomposition**: 16 clear domains with consistent internal structure (pages/hooks/services/components)
2. **Route organization**: Modular route files with lazy loading and `PermissionGuard` on every protected route
3. **Lazy loading**: All routes use `React.lazy()` + `LazyPage` Suspense wrapper consistently
4. **No TypeScript suppressions**: Zero `@ts-ignore` or `@ts-nocheck` — discipline is good
5. **Toast abstraction**: `@/utils/toast.ts` wrapper used in 102 files (with only 3 exceptions)
6. **Error boundary**: Global `ErrorBoundary` component wraps the app
7. **Query configuration**: Sensible defaults (staleTime: 2min, retry: 1)
8. **Edge Functions**: Well-organized with `ai-shared/` module for AI function reuse
9. **PWA configuration**: Proper workbox setup with correct cache strategies (NetworkFirst for API, NetworkOnly for auth/realtime)
10. **Shared components**: 15 well-named reusable components (KpiCard, KanbanBoard, GanttTimeline, etc.)

---

## Appendix: File Counts by Type

| Extension | ERP (src/) | Campo (APP-Campo/src/) |
|---|---|---|
| `.tsx` | 310 | ~60 |
| `.ts` | 189 | ~20 |
| `.test.ts/.tsx` | 38 | 0 |
| **Total** | **499** (+38 tests) | ~80 |
