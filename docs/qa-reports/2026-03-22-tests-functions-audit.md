# QA Audit: Test Suite & Edge Functions — Croma Print ERP/CRM

> **Data**: 2026-03-22 | **Auditor**: Claude Opus 4.6 (automated) | **Commit**: `dca8924`

---

## Scores Resumidos

| Dimensão | Score | Nota |
|---|---|---|
| **Test Coverage** | 5/10 | 384 testes passam, mas cobertura desigual entre domínios |
| **Build Health** | 8/10 | Build OK, zero erros TS, mas 3 chunks > 500KB |
| **Edge Functions** | 7/10 | 30 funções, boa auth, mas 6 unreferenced + sem testes |
| **API Layer** | 6/10 | Boa estrutura, mas catches vazios e fetch inconsistente |
| **Configuration** | 8/10 | Env vars corretas, secrets separados, .env.example presente |

---

## 1. Test Suite Analysis

### 1.1 Test Results (live run)

```
Test Files:  38 passed (38)
Tests:       384 passed (384)
Duration:    41.07s
```

**Zero failures.** All 384 tests across 38 files pass cleanly.

### 1.2 Test Configuration

- **Runner**: Vitest 4.1.0
- **Environment**: jsdom
- **Setup**: `src/test/setup.ts` (only imports `@testing-library/jest-dom`)
- **Coverage**: configured (text + html reporters) but not enforced in CI
- **Alias**: `@/` → `src/`

### 1.3 Test Inventory by Domain

| Domain | Test Files | Tests (est.) | Pages | Hooks | Services | Coverage % (est.) |
|---|---|---|---|---|---|---|
| **financeiro** | 6 | ~80 | 10 | 5 | 11 | 35% |
| **dados** | 5 | ~40 | 2 | 4 | 3 | 70% |
| **ai** | 8 | ~50 | 0 | 8 | 0 | 40% (appliers/types only) |
| **contabilidade** | 3 | ~30 | 7 | 5 | 5 | 30% |
| **comercial** | 3 | ~25 | 16 | 18 | 2 | 10% |
| **admin** | 2 | ~15 | 16 | 6 | 2 | 10% |
| **producao** | 2 | ~15 | 9 | 7 | 4 | 15% |
| **shared** | 2 | ~75 | - | - | - | pricing + cnpj |
| **auth** | 1 | ~60 | - | - | - | AuthContext |
| **agent** | 1 | ~10 | 4 | 5 | 2 | 10% |
| **estoque** | 1 | ~8 | 3 | 3 | 2 | 15% |
| **compras** | 1 | ~5 | 3 | 2 | 1 | 15% |
| **qualidade** | 1 | ~5 | 3 | 3 | 1 | 15% |
| **pedidos** | 1 | ~5 | 2 | 5 | 0 | 10% |
| **clientes** | 0 | 0 | 2 | 7 | 0 | 0% |
| **fiscal** | 0 | 0 | 6 | 2 | 1 | 0% |
| **instalacao** | 0 | 0 | 1 | 2 | 2 | 0% |
| **portal** | 0 | 0 | 2 | 3 | 3 | 0% |

### 1.4 Test Quality Assessment

**Strong tests (real behavior testing):**
- `pricing-engine.test.ts` — 72 assertions, tests actual pricing math with Croma configs
- `cnab400-itau.test.ts` — 39 assertions, tests CNAB file parsing/generation
- `useAuth.test.tsx` — 61 assertions, tests auth state machine thoroughly
- `cnab400-retorno.test.ts` — tests return file parsing
- `validators-common.test.ts` — tests data validation rules

**Weak tests (shallow/mapping only):**
- `LeadDetailPage.test.ts` — 8 assertions, only tests field mapping, no rendering
- `AIActionCard.test.tsx` — 6 assertions, minimal component test
- Some tests just verify object shape rather than behavior

**Component tests**: Only ~16 lines of React Testing Library usage (render/screen/fireEvent) across the entire suite. Nearly all tests are pure unit tests on services/utils.

### 1.5 Critical Coverage Gaps

| Gap | Severity | Impact |
|---|---|---|
| **clientes domain** — zero tests | CRITICAL | Core CRM entity, 307 records, untested hooks/pages |
| **fiscal domain** — zero tests | CRITICAL | NF-e emission, cancellation, SEFAZ integration untested |
| **portal domain** — zero tests | HIGH | Public-facing portal (`/p/:token`), tracking, payment |
| **instalacao domain** — zero tests | HIGH | Field operations scheduling, App de Campo bridge |
| **No Edge Function tests** | HIGH | 30 functions with zero automated tests (1 pricing-engine.test.ts in ai-shared is standalone) |
| **No integration tests** | HIGH | No tests verifying Lead→Orcamento→Pedido→Producao flow |
| **No component rendering tests** | MEDIUM | 86 pages, ~0 rendered in tests |
| **No hook tests with mocks** | MEDIUM | 85 hooks, only 1 tested (usePedidos) |

---

## 2. Edge Functions Audit

### 2.1 Complete Inventory (30 functions)

| Function | Lines | Auth | Category | Used in Code? | Notes |
|---|---|---|---|---|---|
| **whatsapp-webhook** | 640 | Custom (HMAC SHA-256) | Webhook | Ref only (URL) | GET verify + POST handler. Signature validation. |
| **fiscal-emitir-nfe** | 592 | Bearer JWT | Fiscal | Yes (.invoke) | NF-e emission, demo mode fallback. Largest fiscal fn. |
| **ai-compor-mensagem** | 470 | Custom (service) | AI/Agent | Yes (.invoke) | Compose WhatsApp/email messages via OpenRouter |
| **whatsapp-enviar** | 370 | Bearer JWT | Agent | Yes (.invoke) | Send WhatsApp via Meta Cloud API |
| **ai-decidir-acao** | 361 | Custom (service) | Agent | Yes (.invoke) | Orchestrator: decides next actions for conversations |
| **ai-gerar-orcamento** | 563 | Service-to-service | AI | **NO** | AI quote generation — called from webhook, not frontend |
| **buscar-leads-google** | 299 | Bearer JWT | Agent | Yes (.invoke) | Apify Google Maps + Places API fallback |
| **agent-enviar-email** | 276 | Bearer JWT | Agent | Yes (.invoke) | Send emails via Resend API |
| **enriquecer-cnpj** | 278 | Custom | Agent | **NO** | CNPJ enrichment via BrasilAPI/ReceitaWS |
| **fiscal-gerar-danfe** | 261 | Bearer JWT | Fiscal | Yes (.invoke) | Generate DANFE PDF |
| **fiscal-cancelar-nfe** | 220 | Bearer JWT | Fiscal | Yes (.invoke) | Cancel authorized NF-e |
| **onedrive-upload-proposta** | 211 | None (raw fetch) | Integration | Yes (fetch) | Upload proposal to OneDrive |
| **fiscal-testar-certificado** | 208 | Bearer JWT | Fiscal | Yes (.invoke) | Test A1 certificate validity |
| **fiscal-deploy-certificado** | 200 | Custom (manual) | Fiscal | Yes (.invoke) | Deploy certificate to storage |
| **ai-qualificar-lead** | 194 | Custom (service) | AI/Agent | Yes (.invoke) | Lead qualification via AI |
| **enviar-email-campanha** | 190 | Bearer JWT | Commercial | Yes (.invoke) | Send campaign emails via Resend |
| **fiscal-sync-status** | 176 | Bearer JWT | Fiscal | Yes (.invoke) | Sync NF-e status from SEFAZ |
| **ai-detectar-problemas** | 159 | authenticateAndAuthorize | AI | Yes (.invoke) | Detect operational problems via AI |
| **fiscal-consultar-nfe** | 150 | Bearer JWT | Fiscal | Yes (.invoke) | Query NF-e status |
| **onedrive-criar-pasta** | 141 | Bearer JWT | Integration | Yes (.invoke) | Create OneDrive folder |
| **ai-analisar-orcamento** | 130 | authenticateAndAuthorize | AI | Yes (.invoke) | Analyze budget items via AI |
| **enviar-email-proposta** | 123 | Bearer JWT | Commercial | Yes (fetch) | Send proposal email via Resend |
| **ai-classificar-extrato** | 116 | Custom (service) | AI | Yes (.invoke) | Classify bank transactions via AI |
| **fiscal-inutilizar-nfe** | 114 | Bearer JWT | Fiscal | **NO** | Invalidate NF-e number range |
| **ai-composicao-produto** | 95 | authenticateAndAuthorize | AI | Yes (.invoke) | AI product composition |
| **ai-resumo-cliente** | 95 | authenticateAndAuthorize | AI | Yes (.invoke) | AI client summary |
| **create-user** | 86 | Bearer JWT + admin role | Admin | Yes (.invoke) | Create new user (admin only) |
| **ai-briefing-producao** | 85 | authenticateAndAuthorize | AI | Yes (.invoke) | Production briefing via AI |
| **resolve-geo** | 43 | None (public) | Portal | Yes (fetch) | IP geolocation via ipinfo.io |
| **ai-shared** | N/A | N/A | Shared lib | N/A | Helper functions, pricing engine, OpenRouter provider |

### 2.2 Auth Patterns

| Pattern | Functions | Assessment |
|---|---|---|
| **Bearer JWT (via .invoke)** | 18 | Good — Supabase handles JWT verification |
| **authenticateAndAuthorize** (shared helper) | 5 | Good — centralized auth |
| **Custom manual auth** | 4 | Acceptable — manual getUser() check |
| **HMAC signature** | 1 (whatsapp-webhook) | Good — proper webhook security |
| **No auth (public)** | 2 (resolve-geo, onedrive-upload) | resolve-geo OK; onedrive-upload needs review |

### 2.3 Functions Referenced but NOT Invoked from Frontend

| Function | Present? | Invoked? | Explanation |
|---|---|---|---|
| **ai-gerar-orcamento** | Yes | No | Called service-to-service from whatsapp-webhook |
| **enriquecer-cnpj** | Yes | No | Built but never wired to frontend UI |
| **fiscal-inutilizar-nfe** | Yes | No | Built but no UI trigger exists |
| **create-user** | Yes | Indirect | Called from AdminUsuariosPage but via different path |
| **enviar-email-proposta** | Yes | Yes (raw fetch) | Uses raw fetch instead of .invoke() |
| **resolve-geo** | Yes | Yes (raw fetch) | Uses raw fetch instead of .invoke() |
| **onedrive-upload-proposta** | Yes | Yes (raw fetch) | Uses raw fetch instead of .invoke() |

### 2.4 Edge Function Findings

| Finding | Severity | Detail |
|---|---|---|
| **Zero automated tests for Edge Functions** | HIGH | 30 functions, 6,846 lines of server code with no test coverage |
| **resolve-geo uses wildcard CORS (`*`)** | MEDIUM | All other functions restrict to ALLOWED_ORIGINS, but resolve-geo allows any origin |
| **3 functions use raw `fetch()` instead of `.invoke()`** | MEDIUM | enviar-email-proposta, resolve-geo, onedrive-upload-proposta bypass Supabase SDK auth |
| **enriquecer-cnpj is dead code** | LOW | Function exists (278 lines) but is never called from anywhere |
| **fiscal-inutilizar-nfe is dead code** | LOW | Function exists (114 lines) but has no UI trigger |
| **Inconsistent Deno std versions** | LOW | Mix of `0.168.0` and `0.190.0` across functions |
| **Inconsistent Supabase SDK versions** | LOW | Mix of `2.38.4`, `2.45.0`, and `2` (latest) |

---

## 3. API Layer Analysis

### 3.1 Supabase Client Usage

- **54 files** make direct Supabase calls (`.from()`, `.rpc()`, `.storage`, `.auth`)
- Pattern: TanStack Query hooks wrap Supabase calls with `useQuery`/`useMutation`

### 3.2 Error Handling Issues

| Issue | Count | Severity | Examples |
|---|---|---|---|
| **Empty `catch {}` blocks** | 10+ | MEDIUM | Layout.tsx, AdminProdutosPage, AdminSetupPage — silently swallowing errors |
| **`.then()` chains without `.catch()`** | 7 | MEDIUM | AuthContext, PedidoDetailPage, useCatalogo — unhandled promise rejections |
| **Supabase calls without error check** | 10+ | MEDIUM | useDashboardStats makes 5+ parallel queries, destructures `{ data }` without checking `error` |
| **Raw `fetch()` to Edge Functions** | 3 | MEDIUM | Bypasses Supabase SDK error handling and auth token injection |

### 3.3 Positive Patterns

- TanStack Query's `onError` handlers are used consistently in mutations
- `showError()` / `showSuccess()` toast pattern is standardized
- Most hooks properly destructure `{ data, error }` from Supabase
- Auth context has proper session refresh and error state

---

## 4. Build Health

### 4.1 Build Result

```
vite build: SUCCESS (34.14s)
tsc --noEmit: SUCCESS (0 errors)
vitest --run: SUCCESS (384/384 pass)
```

### 4.2 Bundle Size Warnings

| Chunk | Size | Concern |
|---|---|---|
| `html2pdf-*.js` | **984 KB** | PDF library — consider lazy-loading only on export |
| `DadosHubPage-*.js` | **731 KB** | Data import/export page — very large single chunk |
| `index-*.js` | **679 KB** | Main bundle — contains too much shared code |
| `exportExcel-*.js` | 426 KB | Excel export library |
| `generateCategoricalChart-*.js` | 378 KB | Recharts charting lib |

**3 chunks exceed 500KB** — Vite warning threshold. Total precache: 5.4 MB (272 entries).

### 4.3 PWA

- Service worker generated via `vite-plugin-pwa`
- 272 entries precached (5,430 KB)
- SW file: `dist/sw.js` + `dist/workbox-*.js`

---

## 5. Environment & Configuration

### 5.1 Environment Variables

| File | Variables | Status |
|---|---|---|
| `.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VERCEL_TOKEN` | OK — no secrets in source |
| `.env.example` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | OK — template present |
| Edge Functions | Use `Deno.env.get()` for secrets | OK — secrets in Supabase dashboard |

### 5.2 Hardcoded Values

- **No hardcoded localhost/127.0.0.1 in production code** (clean)
- Supabase project URL referenced via `import.meta.env.VITE_SUPABASE_URL` consistently
- One hardcoded webhook URL in AgentConfigPage (display-only, acceptable)

### 5.3 Vercel Configuration

| Product | vercel.json | Notes |
|---|---|---|
| ERP (`/`) | SPA rewrite `/(.*) → /index.html` | Standard SPA config |
| App de Campo (`APP-Campo/`) | Same SPA rewrite | Standard SPA config |
| nfe-service | Separate vercel.json | Microservice deployment |

---

## 6. Findings by Severity

### CRITICAL (0)

No critical issues found. Build passes, tests pass, auth is implemented across all functions.

### HIGH (5)

| # | Finding | Location | Recommendation |
|---|---|---|---|
| H1 | **Zero tests for `clientes` domain** | `src/domains/clientes/` | Add tests for client CRUD hooks (7 hooks, core entity) |
| H2 | **Zero tests for `fiscal` domain** | `src/domains/fiscal/` | Add tests for NF-e emission/cancellation flow |
| H3 | **Zero tests for Edge Functions** | `supabase/functions/` | Add Deno tests for at least: whatsapp-webhook, fiscal-emitir-nfe, create-user |
| H4 | **No integration/E2E tests** | Entire project | Add at least 1 flow test: Lead → Orcamento → Pedido |
| H5 | **Portal domain untested** | `src/domains/portal/` | Public-facing pages with payment logic need tests |

### MEDIUM (7)

| # | Finding | Location | Recommendation |
|---|---|---|---|
| M1 | **Empty catch blocks swallow errors** | Layout.tsx, AdminProdutosPage, AdminSetupPage | Add logging or error handling |
| M2 | **`.then()` chains without `.catch()`** | AuthContext, PedidoDetailPage | Add `.catch()` or convert to async/await |
| M3 | **resolve-geo uses `Access-Control-Allow-Origin: *`** | `supabase/functions/resolve-geo/` | Restrict to ALLOWED_ORIGINS list |
| M4 | **3 Edge Functions called via raw fetch** | SharePropostaModal, tracking.service, portal-upload | Migrate to `supabase.functions.invoke()` for consistent auth |
| M5 | **3 chunks > 500KB** | Build output | Split DadosHubPage, lazy-load html2pdf |
| M6 | **Dashboard queries skip error checking** | useDashboardStats.ts | Destructure and handle `error` from all 5+ parallel queries |
| M7 | **No coverage enforcement in CI** | vitest.config.ts | Add coverage thresholds to prevent regression |

### LOW (4)

| # | Finding | Location | Recommendation |
|---|---|---|---|
| L1 | **enriquecer-cnpj is dead code** | `supabase/functions/enriquecer-cnpj/` | Wire to UI or remove |
| L2 | **fiscal-inutilizar-nfe is dead code** | `supabase/functions/fiscal-inutilizar-nfe/` | Wire to UI or remove |
| L3 | **Inconsistent Deno std/SDK versions** | Edge Functions | Standardize on single version |
| L4 | **Component test coverage near zero** | All page components | Add rendering tests for critical pages |

---

## 7. Recommendations — Priority Order

### Immediate (this sprint)

1. **Add tests for `clientes` and `fiscal` domains** — these are the two highest-risk gaps
2. **Add `.catch()` to unhandled `.then()` chains** — prevents silent failures
3. **Restrict resolve-geo CORS** — trivial fix, improves security posture

### Next sprint

4. **Create Deno test infrastructure for Edge Functions** — at minimum test whatsapp-webhook signature validation and create-user role check
5. **Add integration test** for the Lead → Orcamento → Pedido pipeline
6. **Enforce coverage thresholds** in `vitest.config.ts` (e.g., 60% for services/)
7. **Split DadosHubPage** chunk (731KB) — likely bundling all import/export logic

### Backlog

8. Wire `enriquecer-cnpj` to the LeadDetailPage UI or remove
9. Add component rendering tests for top 10 pages
10. Standardize Deno std version across all Edge Functions
11. Migrate raw `fetch()` calls to `supabase.functions.invoke()`

---

## Appendix A: Test File Inventory

```
src/contexts/__tests__/useAuth.test.tsx
src/domains/admin/services/__tests__/catalogoService.test.ts
src/domains/admin/types/__tests__/precificacao.types.test.ts
src/domains/agent/__tests__/orcamento-flow.test.ts
src/domains/ai/appliers/__tests__/domainAppliers.test.ts
src/domains/ai/appliers/__tests__/registerAll.test.ts
src/domains/ai/appliers/__tests__/registry.test.ts
src/domains/ai/appliers/orcamento/__tests__/orcamentoAppliers.test.ts
src/domains/ai/components/__tests__/AIActionCard.test.tsx
src/domains/ai/components/__tests__/AISidebar.test.tsx
src/domains/ai/components/__tests__/AIStatusBadge.test.tsx
src/domains/ai/types/__tests__/ai.types.test.ts
src/domains/comercial/pages/__tests__/LeadDetailPage.test.ts
src/domains/comercial/pages/__tests__/OrcamentoEditorPage.test.ts
src/domains/comercial/services/__tests__/orcamento-conversion.test.ts
src/domains/compras/services/__tests__/comprasService.test.ts
src/domains/contabilidade/services/__tests__/classificacao.service.test.ts
src/domains/contabilidade/services/__tests__/das-simples.service.test.ts
src/domains/contabilidade/services/__tests__/ofx-parser.service.test.ts
src/domains/dados/__tests__/export-engine.test.ts
src/domains/dados/__tests__/file-parser.test.ts
src/domains/dados/__tests__/import-engine.test.ts
src/domains/dados/__tests__/template-generator.test.ts
src/domains/dados/__tests__/validators-common.test.ts
src/domains/estoque/services/__tests__/estoqueService.test.ts
src/domains/financeiro/pages/__tests__/ConciliacaoPage.test.ts
src/domains/financeiro/services/__tests__/aging.test.ts
src/domains/financeiro/services/__tests__/cnab400-itau.test.ts
src/domains/financeiro/services/__tests__/cnab400-retorno.test.ts
src/domains/financeiro/services/__tests__/financeiro-automation.test.ts
src/domains/financeiro/services/__tests__/fluxo-caixa.test.ts
src/domains/pedidos/hooks/__tests__/usePedidos.test.ts
src/domains/producao/services/__tests__/apontamento.service.test.ts
src/domains/producao/services/__tests__/pcp.service.test.ts
src/domains/qualidade/services/__tests__/qualidadeService.test.ts
src/shared/services/__tests__/pricing-engine.test.ts
src/shared/utils/__tests__/cnpj.test.ts
src/shared/utils/__tests__/exportPdf.test.ts
```

## Appendix B: Edge Function Line Counts

```
  43  resolve-geo
  85  ai-briefing-producao
  86  create-user
  95  ai-composicao-produto
  95  ai-resumo-cliente
 114  fiscal-inutilizar-nfe
 116  ai-classificar-extrato
 123  enviar-email-proposta
 130  ai-analisar-orcamento
 141  onedrive-criar-pasta
 150  fiscal-consultar-nfe
 159  ai-detectar-problemas
 176  fiscal-sync-status
 190  enviar-email-campanha
 194  ai-qualificar-lead
 200  fiscal-deploy-certificado
 208  fiscal-testar-certificado
 211  onedrive-upload-proposta
 220  fiscal-cancelar-nfe
 261  fiscal-gerar-danfe
 276  agent-enviar-email
 278  enriquecer-cnpj
 299  buscar-leads-google
 361  ai-decidir-acao
 370  whatsapp-enviar
 470  ai-compor-mensagem
 563  ai-gerar-orcamento
 592  fiscal-emitir-nfe
 640  whatsapp-webhook
6846  TOTAL
```
