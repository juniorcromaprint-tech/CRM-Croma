# SECURITY AUDIT REPORT — Croma Print ERP/CRM

> **Date**: 2026-03-22
> **Auditor**: Security Engineering Analysis (Opus 4.6)
> **Scope**: Full-stack security audit — Authentication, Authorization, RLS, Input Validation, API Security, Data Exposure, Critical Action Protection
> **Codebase**: `C:\Users\Caldera\Claude\CRM-Croma` (branch: `claude/loving-mahavira`)

---

## SECURITY SCORE: 6.5 / 10

| Area | Score | Weight | Notes |
|---|---|---|---|
| Authentication | 7/10 | 20% | Solid session handling, safe null-role default |
| Authorization (Frontend) | 6/10 | 15% | PermissionGuard on most routes; agent routes unprotected |
| Authorization (Backend/RLS) | 5/10 | 25% | RLS enabled broadly but policies are overly permissive |
| Input Validation | 7/10 | 10% | Good Zod coverage; minor XSS vectors |
| API Security | 6/10 | 15% | Most Edge Functions authenticated; webhook signature bypass risk |
| Data Exposure | 8/10 | 5% | No secrets in frontend; minimal console.log |
| Critical Action Protection | 7/10 | 10% | Optimistic lock, soft delete; some gaps |

**Weighted Score: 6.5/10**

---

## 1. AUTHENTICATION ANALYSIS

### Architecture

- **Provider**: Supabase Auth (JWT-based)
- **Session Management**: `supabase.auth.getSession()` + `onAuthStateChange` listener
- **Profile Fetch**: Fetches `profiles.role` after auth state change
- **Client**: `@supabase/supabase-js` with anon key (correct)

### Findings

| ID | Severity | Finding | Location |
|---|---|---|---|
| AUTH-1 | **LOW** | `effectiveRole` defaults to `'comercial'` when `profile.role` is null — safe fallback (least privilege among internal roles) | `src/contexts/AuthContext.tsx:89` |
| AUTH-2 | **LOW** | No explicit session expiry enforcement on the frontend — relies entirely on Supabase's JWT expiry. If Supabase token refresh fails silently, the user may remain in a stale authenticated state. | `src/contexts/AuthContext.tsx` |
| AUTH-3 | **INFO** | `/tv` route is properly protected with `ProtectedRoute` | `src/App.tsx:65` |
| AUTH-4 | **INFO** | Public routes (`/p/:token`, `/nps/:token`, `/login`) are correctly unprotected | `src/App.tsx:64-67` |
| AUTH-5 | **INFO** | `ProtectedRoute` correctly redirects to `/login` when session is null | `src/App.tsx:49-50` |

### Verdict

Authentication is well-implemented. The null-role-to-comercial default is a safe design choice that prevents privilege escalation. No critical issues found.

---

## 2. AUTHORIZATION & ROLE-BASED ACCESS

### Role Definitions (9 roles)

| Role | Label | Module Access |
|---|---|---|
| `admin` | Administrador | ALL modules, ALL actions |
| `diretor` | Diretor | ALL modules, read + approve |
| `comercial` | Comercial | comercial, clientes (CRUD); pedidos (read) |
| `comercial_senior` | Comercial Senior | + pedidos CRUD, financeiro read |
| `financeiro` | Financeiro | financeiro (full), fiscal, clientes/pedidos/comercial (read) |
| `producao` | Producao | producao, estoque (CRUD); pedidos/qualidade (CRUD) |
| `compras` | Compras | compras (full), estoque (CRUD), financeiro (read) |
| `logistica` | Logistica | instalacao (CRUD), pedidos/producao (read) |
| `instalador` | Instalador | instalacao (ver, editar only) |

### Frontend Permission Enforcement

| Route Group | PermissionGuard | Module | Status |
|---|---|---|---|
| `comercialRoutes` | YES | `comercial` | OK |
| `clientesRoutes` | YES | `clientes` | OK |
| `operacionalRoutes` | YES | `pedidos` / `producao` | OK |
| `suprimentosRoutes` | YES | `compras` / `estoque` | OK |
| `qualidadeRoutes` | YES | `qualidade` | OK |
| `financeiroRoutes` | YES | `financeiro` | OK |
| `fiscalRoutes` | YES | `fiscal` | OK |
| `contabilidadeRoutes` | YES | `financeiro` | OK |
| `adminRoutes` | YES | `admin` | OK |
| **`agentRoutes`** | **NO** | *none* | **VULNERABILITY** |

### Findings

| ID | Severity | Finding | Location |
|---|---|---|---|
| AUTHZ-1 | **HIGH** | **Agent routes have NO PermissionGuard**. All 4 routes (`/agente`, `/agente/conversa/:id`, `/agente/aprovacao`, `/agente/config`) are accessible to ANY authenticated user regardless of role. An `instalador` user could access AI agent config, view all conversations, and approve AI-generated messages. | `src/routes/agentRoutes.tsx:10-17` |
| AUTHZ-2 | **MEDIUM** | `operacionalRoutes` uses `module="pedidos"` for production-specific routes (producao, expedicao, almoxarife, PCP). A `comercial` user has `pedidos: ['ver']` permission, which gives them read access to production management pages that should be restricted to `producao` role. | `src/routes/operacionalRoutes.tsx:25-31` |
| AUTHZ-3 | **MEDIUM** | Permission checks are frontend-only for most actions. The `can()` function is a React hook — there is no server-side permission enforcement besides RLS. If a user crafts direct Supabase API calls, they bypass frontend guards entirely. | `src/contexts/AuthContext.tsx:92-97` |
| AUTHZ-4 | **LOW** | The `settings` route at `/settings` requires `admin` module access, which may be overly restrictive if it contains user-specific settings. | `src/routes/adminRoutes.tsx:108` |
| AUTHZ-5 | **INFO** | RLS-level role checks use `is_role()` and `is_admin()` functions — but the roles checked in RLS (e.g., `'gerente'`, `'almoxarife'`) do not match the frontend role definitions. `gerente` and `almoxarife` are not defined in `permissions.ts`. This means RLS policies reference roles that may never be assigned through the UI. | `migrations/058_rls_estoque.sql`, `migrations/063_rls_producao.sql` |

---

## 3. RLS (ROW LEVEL SECURITY) COVERAGE

### Tables WITH RLS Enabled (verified from migrations)

**Core Business (8 tables — migration 027):**
clientes, propostas, proposta_itens, pedidos, pedido_itens, leads, contas_receber, contas_pagar

**Catalog (6 tables — migrations 051):**
categorias_produto, produtos, produto_modelos, modelo_materiais, modelo_processos, regras_precificacao

**Estoque (6 tables — migration 058):**
estoque_saldos, estoque_movimentacoes, estoque_reservas, fornecedores, inventarios, inventario_itens

**Producao (9 tables — migration 063):**
ordens_producao, producao_etapas, producao_materiais, producao_apontamentos, producao_checklist, producao_retrabalho, setores_producao, etapa_templates, routing_rules

**Fiscal (11 tables — migration 075):**
fiscal_ambientes, fiscal_series, fiscal_certificados, fiscal_regras_operacao, fiscal_documentos, fiscal_documentos_itens, fiscal_eventos, fiscal_xmls, fiscal_filas_emissao, fiscal_erros_transmissao, fiscal_audit_logs

**Other modules with RLS:**
bank_accounts, bank_slips, bank_remittances, bank_remittance_items, bank_returns, bank_return_items, retornos_bancarios, proposta_views, proposta_attachments, notifications, agent_conversations, agent_messages, agent_templates, lancamentos_contabeis, das_apuracoes, extrato_bancario_importacoes, extrato_bancario_itens, extrato_regras_classificacao, config_tributaria, empresas, parcelas_receber, checklists, checklist_itens, checklist_execucoes, checklist_execucao_itens, acabamentos, servicos, proposta_item_materiais, proposta_item_acabamentos, proposta_servicos, templates_orcamento, config_precificacao, proposta_item_processos, ai_logs, ai_alertas, campanha_destinatarios, import_logs, faixas_quantidade, materiais_historico_preco, maquinas, orcamento_item_maquinas, centros_custo, plano_contas, categorias_despesa, nps_respostas, estoque_reservas_op, contratos_servico, webhook_configs, quadro_avisos, usinagem_tempos

**App de Campo:**
stores, jobs, job_photos, job_videos, company_settings, campo_audit_logs

### Tables LIKELY WITHOUT RLS (from 001_complete_schema.sql, not found in subsequent RLS migrations)

| Table | Risk | Notes |
|---|---|---|
| `roles` | LOW | Static reference data |
| `permissions` | LOW | Static reference data |
| `role_permissions` | LOW | Static reference data |
| `audit_logs` | **MEDIUM** | Contains user activity history — should have read restrictions |
| `attachments` | **MEDIUM** | File references — any authenticated user may access |
| `notas_internas` | **MEDIUM** | Internal notes could contain sensitive info |
| `lead_sources` | LOW | Reference data |
| `oportunidades` | **MEDIUM** | Business opportunities — lacks access control |
| `atividades_comerciais` | **MEDIUM** | Commercial activities log |
| `tarefas_comerciais` | **MEDIUM** | Commercial tasks |
| `metas_vendas` | **MEDIUM** | Sales targets — financial data |
| `cliente_unidades` | LOW | Client units |
| `cliente_contatos` | LOW | Client contacts |
| `materiais` | LOW | Materials reference |
| `pedidos_compra` | **MEDIUM** | Purchase orders — financial data |
| `pedido_compra_itens` | LOW | Purchase order items |
| `historico_precos` | LOW | Price history |
| `pedido_historico` | LOW | Order history |
| `parcelas_pagar` | **MEDIUM** | Payment installments |
| `comissoes` | **HIGH** | Commission data — financial |
| `equipes` | LOW | Teams |
| `ordens_instalacao` | **MEDIUM** | Installation orders |
| `field_tasks` | LOW | Field tasks |
| `field_checklists` | LOW | Checklists |
| `field_media` | LOW | Photos/media |
| `field_signatures` | **MEDIUM** | Digital signatures |
| `ocorrencias` | LOW | Quality occurrences |
| `ocorrencia_tratativas` | LOW | Quality treatments |
| `admin_config` | **CRITICAL** | Stores API keys (OPENROUTER, WHATSAPP) — any authenticated user can read |
| `profiles` | **HIGH** | User profiles with roles — role tampering risk |

> **Note**: migration 001 has a loop that attempts to enable RLS on all tables, and migration 002 does the same. However, without explicit policies, RLS being enabled means NO access for the `anon` role but FULL access for `authenticated` if a permissive policy was also added. The critical issue is the **policy content**, not just RLS enablement.

### Critical RLS Findings

| ID | Severity | Finding |
|---|---|---|
| RLS-1 | **CRITICAL** | **Core business table policies are `USING (true) WITH CHECK (true)`** — migration 027 enables RLS on 8 critical tables (clientes, propostas, pedidos, leads, contas_receber, contas_pagar, etc.) but the policies allow ALL operations for ALL authenticated users. An `instalador` can delete client records, modify financial data, or change order statuses via direct API calls. |
| RLS-2 | **CRITICAL** | **`admin_config` table likely has no restrictive RLS policies** — it stores API keys for OPENROUTER, WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN. Any authenticated user can `SELECT * FROM admin_config` and extract all secrets. |
| RLS-3 | **HIGH** | **`profiles` table role field may be writable** — if RLS allows authenticated users to UPDATE their own profile, a user could change their `role` from `instalador` to `admin`, gaining full system access. |
| RLS-4 | **HIGH** | **`comissoes` table lacks RLS** — commission data is financial and should be restricted to financeiro/admin roles. |
| RLS-5 | **MEDIUM** | **Role mismatch between RLS and frontend**: RLS policies reference `'almoxarife'` and `'gerente'` roles that don't exist in the frontend role definitions (`permissions.ts`). This creates dead code in RLS policies and may indicate design confusion. |
| RLS-6 | **MEDIUM** | **Fiscal table RLS has overlapping FOR ALL + FOR SELECT policies** — e.g., `fiscal_ambientes` has both a SELECT policy (`USING (true)`) and an ALL policy with role checks. The SELECT policy may override the ALL policy's intent, allowing any authenticated user to read fiscal config data. |

---

## 4. INPUT VALIDATION

### Zod Schema Coverage

| Domain | Schema File | Status |
|---|---|---|
| Financeiro | `financeiro.schemas.ts` | Comprehensive: UUID validation, positive numbers, date defaults, enum constraints |
| Comercial | `comercial.schemas.ts` | Present |
| Clientes | `clientes.schemas.ts` | Present |
| Pedidos | `pedidos.schemas.ts` | Present |
| Estoque/Compras | `estoque-compras.schemas.ts` | Present |
| Producao | `producao.schemas.ts` | Present |
| Instalacao | `instalacao-qualidade.schemas.ts` | Present |
| Fiscal | `fiscal.schemas.ts` | Present |
| Boletos | `boleto.schemas.ts` | Present |

### Findings

| ID | Severity | Finding | Location |
|---|---|---|---|
| VAL-1 | **LOW** | XSS via `dangerouslySetInnerHTML` — used in `OrcamentoPDF.tsx` for print CSS styles. The content is hardcoded CSS, not user input, so actual risk is minimal. | `src/domains/comercial/components/OrcamentoPDF.tsx:168` |
| VAL-2 | **LOW** | `innerHTML` in `exportPdf.ts` — used for PDF generation from HTML template. Content is generated server-side, not raw user input. | `src/shared/utils/exportPdf.ts:61` |
| VAL-3 | **LOW** | `dangerouslySetInnerHTML` in `chart.tsx` — shadcn/ui chart component, static content. | `src/components/ui/chart.tsx:79` |
| VAL-4 | **INFO** | No raw SQL queries found in frontend code — all database access goes through Supabase client `.from()`, `.rpc()`, or Edge Functions. SQL injection risk is negligible. |
| VAL-5 | **MEDIUM** | **ILIKE injection in whatsapp-webhook** — `phoneSearch` derived from user input is interpolated into an ILIKE pattern: `.ilike('contato_telefone', '%${phoneSearch}%')`. While `phoneSearch` is sanitized to digits only via `replace(/\D/g, '')`, the `%` wildcard character itself could theoretically match too broadly if the phone normalization fails. | `supabase/functions/whatsapp-webhook/index.ts:503` |
| VAL-6 | **INFO** | Portal RPC calls (`portal_get_proposta`, `portal_aprovar_proposta`) pass token as parameter to stored procedures — safe against SQL injection. |

---

## 5. API SECURITY (EDGE FUNCTIONS)

### Edge Function Inventory (20+ functions)

| Function | Auth Method | Concerns |
|---|---|---|
| `create-user` | JWT + admin role check | OK — properly validates admin role |
| `enviar-email-campanha` | JWT + user validation + rate limit (5/hr) | OK — good rate limiting |
| `enviar-email-proposta` | JWT | OK |
| `whatsapp-webhook` | HMAC signature (Meta) | **ISSUE: Bypasses signature when secret not configured** |
| `resolve-geo` | **NONE** | **ISSUE: Open endpoint, wildcard CORS** |
| `fiscal-*` (8 functions) | JWT (manual `getUser()`) | OK — verified auth |
| `fiscal-sync-status` | JWT OR cron-secret header | OK |
| `onedrive-*` | JWT | OK |
| `ai-*` (10+ functions) | Service role (server-to-server) | OK — called internally |
| `buscar-leads-google` | Unknown | Needs verification |
| `enriquecer-cnpj` | Unknown | Needs verification |
| `whatsapp-enviar` | Unknown | Needs verification |
| `agent-enviar-email` | Unknown | Needs verification |

### Findings

| ID | Severity | Finding | Location |
|---|---|---|---|
| API-1 | **HIGH** | **WhatsApp webhook skips HMAC signature validation when `WHATSAPP_APP_SECRET` is not configured** — returns `true` (valid). An attacker can forge webhook payloads to create leads, inject messages, and trigger AI auto-responses. The code explicitly says "dev mode" but this is dangerous in production. | `supabase/functions/whatsapp-webhook/index.ts:43-46` |
| API-2 | **MEDIUM** | **`resolve-geo` has no authentication and wildcard CORS (`*`)** — any website can call this endpoint. While it only returns approximate IP geolocation, it could be abused for free geolocation lookups, consuming the ipinfo.io quota (50k/month). | `supabase/functions/resolve-geo/index.ts:5-8` |
| API-3 | **MEDIUM** | **No global rate limiting on Edge Functions** — only `enviar-email-campanha` has explicit rate limiting. Other endpoints (fiscal operations, AI calls) have no protection against abuse. | Various |
| API-4 | **LOW** | Several Edge Functions use `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!` with non-null assertion — if the env var is missing, this crashes. Not a security issue per se, but could cause denial of service. | Multiple files |
| API-5 | **LOW** | `create-user` function in the ERP uses proper CORS with allowed origins list. However, the `enviar-email-campanha` function uses wildcard CORS `*`. | `supabase/functions/enviar-email-campanha/index.ts:5` |
| API-6 | **INFO** | Edge Functions correctly use `SUPABASE_SERVICE_ROLE_KEY` only server-side (via `Deno.env.get`), never exposed to the frontend. |

---

## 6. DATA EXPOSURE

### Findings

| ID | Severity | Finding | Location |
|---|---|---|---|
| DATA-1 | **INFO** | **No secrets in frontend code** — confirmed by grep. No `SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, or `WHATSAPP_APP_SECRET` in `src/` directory. |
| DATA-2 | **LOW** | **17 console.log/error/warn statements** remain in production code across 14 files. Most are error handlers (`console.error`). One in `AuthContext.tsx` logs profile fetch errors. None log sensitive data. | Various src files |
| DATA-3 | **INFO** | Supabase anon key is properly scoped — used only for client-side queries subject to RLS. The key is public by design. | `src/integrations/supabase/client.ts` |
| DATA-4 | **MEDIUM** | **Error messages from Supabase RPC calls are passed directly to UI** — `throw new Error(error.message)` in portal.service.ts could expose internal database error messages to unauthenticated portal users. | `src/domains/portal/services/portal.service.ts:35` |
| DATA-5 | **INFO** | `ErrorBoundary` wraps the entire app — prevents React crashes from exposing stack traces. |

---

## 7. CRITICAL ACTION PROTECTION

### Optimistic Locking

- **Tables covered**: `pedidos`, `propostas`, `contas_receber`, `contas_pagar`
- **Implementation**: Auto-increment `version` column via trigger on UPDATE
- **Assessment**: Correct implementation. Triggers are BEFORE UPDATE, ensuring atomicity.

### Soft Delete

- **Tables covered**: leads, pedidos, pedido_itens, ordens_producao, contas_pagar, contas_receber, pedidos_compra, pedido_compra_itens, estoque_movimentacoes, fiscal_documentos
- **Implementation**: `excluido_em` + `excluido_por` columns with partial index
- **Assessment**: Good coverage of critical tables.

### Findings

| ID | Severity | Finding | Location |
|---|---|---|---|
| CRIT-1 | **MEDIUM** | **No confirmation dialogs verified at API level for destructive operations** — soft delete and cancel operations rely entirely on frontend confirmation dialogs. A direct API call can perform deletions without confirmation. | General |
| CRIT-2 | **MEDIUM** | **Status transition validation exists but relies on database triggers** — the trigger `trigger_validar_status_propostas` validates status transitions for propostas, but was temporarily disabled during migration 027 for data cleanup. Need to verify it's re-enabled. | `migrations/027_rls_blindagem.sql:117-123` |
| CRIT-3 | **LOW** | Optimistic lock `version` field prevents concurrent edit conflicts but does not prevent unauthorized edits — that's the job of RLS (which is overly permissive). |
| CRIT-4 | **INFO** | `gerarContasReceber` is documented as transactional (Sprint 1) — financial record creation happens before marking orders as complete. |

---

## VULNERABILITY INVENTORY

### CRITICAL (2)

| ID | Title | Impact | Remediation |
|---|---|---|---|
| RLS-1 | Core business tables have `USING(true)` RLS policies | Any authenticated user (including `instalador`) can read/modify/delete all clients, orders, proposals, financial records | Replace with role-based policies similar to fiscal tables (migration 075) |
| RLS-2 | `admin_config` stores API keys readable by all authenticated users | API keys for OpenRouter, WhatsApp, OneDrive exposed to any logged-in user | Add RLS: SELECT restricted to admin; consider using Supabase Vault for secrets |

### HIGH (4)

| ID | Title | Impact | Remediation |
|---|---|---|---|
| AUTHZ-1 | Agent routes lack PermissionGuard | All authenticated users can access AI agent config, conversations, approvals | Add `<PermissionGuard module="comercial" action="ver">` or create dedicated `agent` module |
| RLS-3 | `profiles.role` may be self-editable | Privilege escalation: user changes own role to admin | Add RLS policy: UPDATE restricted to admin for role column |
| RLS-4 | `comissoes` table lacks RLS | Commission data exposed to all authenticated users | Enable RLS + add financeiro/admin-only policies |
| API-1 | WhatsApp webhook bypasses signature when secret unconfigured | Forged webhooks can create leads, inject AI messages | Return `false` instead of `true` when secret is missing |

### MEDIUM (8)

| ID | Title | Impact | Remediation |
|---|---|---|---|
| AUTHZ-2 | Production routes use `pedidos` module guard | Comercial users can view production management | Use `module="producao"` for production-specific routes |
| AUTHZ-3 | No server-side permission enforcement beyond RLS | Frontend guards can be bypassed with direct API calls | Add RPC-level role checks for sensitive operations |
| RLS-5 | Role mismatch: `almoxarife`/`gerente` in RLS but not in frontend | Phantom roles that can't be assigned through normal UI | Align role names between frontend and database |
| RLS-6 | Overlapping RLS policies on fiscal tables | Potential for unintended read access | Consolidate to single comprehensive policy per operation |
| API-2 | `resolve-geo` has no auth and wildcard CORS | Quota abuse on ipinfo.io | Add Supabase auth or at minimum restrict CORS |
| API-3 | No rate limiting on most Edge Functions | Abuse potential for AI calls, fiscal operations | Add rate limiting to expensive operations |
| DATA-4 | Raw Supabase errors exposed to portal users | Internal database details leaked | Sanitize error messages before displaying |
| VAL-5 | ILIKE pattern from user phone input | Potentially overly broad phone matching | Add explicit length validation |

### LOW (7)

| ID | Title | Impact | Remediation |
|---|---|---|---|
| AUTH-1 | Null role defaults to `comercial` | Minor — safe default | Monitor for unassigned profiles |
| AUTH-2 | No explicit frontend session expiry | Stale sessions possible | Add session refresh check |
| AUTHZ-4 | Settings route restricted to admin | Users can't manage own settings | Create user-level settings page |
| VAL-1 | `dangerouslySetInnerHTML` in PDF component | Minimal — hardcoded CSS only | Add comment explaining safety |
| API-4 | Non-null assertion on env vars | Crashes if misconfigured | Use `?? ''` with error handling |
| API-5 | Wildcard CORS on email campaign function | Cross-origin abuse | Use allowed origins list |
| DATA-2 | 17 console statements in production | Minor information leakage | Remove or guard with env check |

---

## RECOMMENDATIONS (Priority Order)

### Immediate (This Week)

1. **Fix RLS on core business tables** — Replace `USING(true)` policies on clientes, propostas, pedidos, leads, contas_receber, contas_pagar with role-based policies. At minimum:
   - SELECT: all authenticated
   - INSERT/UPDATE: role-appropriate (comercial for leads/propostas, producao for ordens, etc.)
   - DELETE: admin only (use soft delete for others)

2. **Secure `admin_config` table** — Add RLS policy restricting SELECT to admin role. Move API keys to Supabase Vault or environment variables.

3. **Add PermissionGuard to agent routes** — Wrap all `/agente/*` routes with appropriate permission module.

4. **Fix WhatsApp webhook signature bypass** — Change line 46 from `return true` to `return false` when secret is not configured.

5. **Add RLS to `profiles` table** — Prevent users from modifying their own `role` field.

### Short-Term (2 Weeks)

6. **Align role names** — Add `almoxarife` and `gerente` to the frontend role definitions, or update RLS policies to use existing role names.

7. **Add rate limiting** to AI Edge Functions and fiscal operations.

8. **Restrict `resolve-geo` endpoint** — Add CORS origin restrictions or lightweight auth.

9. **Add RLS to remaining tables** — Priority: comissoes, oportunidades, metas_vendas, audit_logs, admin_config.

### Medium-Term (1 Month)

10. **Implement server-side permission checks** — Create a `check_permission(module, action)` RPC that mirrors frontend `can()` logic, use it in critical database operations.

11. **Sanitize error messages** in portal-facing services.

12. **Add CSRF protection** for state-changing operations.

13. **Security logging** — Add audit trail for role changes, config modifications, and failed auth attempts.

---

## AUTHORIZATION MATRIX (Roles x Modules)

```
Module          | admin | diretor | comercial | com_senior | financeiro | producao | compras | logistica | instalador
----------------|-------|---------|-----------|------------|------------|----------|---------|-----------|----------
comercial       | CRUD+ | R+A     | CRU       | CRU+A      | R          |          |         |           |
clientes        | CRUD+ | R       | CRU       | CRUD       | R          |          |         |           |
pedidos         | CRUD+ | R+A     | R         | CRU        | R          | R        |         | R         |
producao        | CRUD+ | R       |           |            |            | CRU      |         |           |
estoque         | CRUD+ | R       |           |            |            | CRU      | CRU     |           |
compras         | CRUD+ | R+A     |           |            | R          |          | CRUD    |           |
financeiro      | CRUD+ | R+A     |           | R          | CRUD+A+E   |          | R       |           |
fiscal          | CRUD+ | R       |           |            | CRU        |          |         |           |
instalacao      | CRUD+ | R       |           |            |            |          |         | CRU       | R+U
qualidade       | CRUD+ | R       |           |            |            | CRU      |         |           |
admin           | CRUD+ | R       |           |            |            |          |         |           |
agent (MISSING) | ?     | ?       | ?         | ?          | ?          | ?        | ?       | ?         | ?
```

Legend: C=criar, R=ver, U=editar, D=excluir, A=aprovar, E=exportar, +=all actions

---

## FILES EXAMINED

### Authentication
- `src/contexts/AuthContext.tsx`
- `src/App.tsx`
- `src/shared/components/PermissionGuard.tsx`
- `src/shared/constants/permissions.ts`

### Route Files
- `src/routes/comercialRoutes.tsx`, `clientesRoutes.tsx`, `operacionalRoutes.tsx`
- `src/routes/suprimentosRoutes.tsx`, `qualidadeRoutes.tsx`, `financeiroRoutes.tsx`
- `src/routes/fiscalRoutes.tsx`, `contabilidadeRoutes.tsx`, `adminRoutes.tsx`
- `src/routes/agentRoutes.tsx`

### RLS Migrations
- `supabase/migrations/027_rls_blindagem.sql`
- `supabase/migrations/050_rls_helpers.sql`
- `supabase/migrations/051_rls_catalogo.sql`
- `supabase/migrations/058_rls_estoque.sql`
- `supabase/migrations/063_rls_producao.sql`
- `supabase/migrations/071_fix_get_user_role.sql`
- `supabase/migrations/075_rls_fiscal_tables.sql`

### Edge Functions
- `supabase/functions/whatsapp-webhook/index.ts`
- `supabase/functions/resolve-geo/index.ts`
- `supabase/functions/create-user/index.ts`
- `supabase/functions/enviar-email-campanha/index.ts`

### Other
- `src/integrations/supabase/client.ts`
- `src/domains/portal/services/portal.service.ts`
- `src/domains/portal/services/tracking.service.ts`
- `src/shared/schemas/financeiro.schemas.ts`
- `supabase/migrations/030_optimistic_lock.sql`
- `supabase/migrations/037_soft_delete_critical_tables.sql`

---

*Report generated 2026-03-22. Next audit recommended after RLS remediation.*
