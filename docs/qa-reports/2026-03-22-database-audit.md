# CROMA PRINT ERP/CRM - Database Architecture Audit

> **Date**: 2026-03-22
> **Auditor**: Senior Database Architect (Automated)
> **Supabase Project**: `djwjmfgplnqyffdcgdaw`
> **Database**: PostgreSQL (Supabase-managed)

---

## Database Health Score: 5.2 / 10

| Category | Score | Weight | Weighted |
|---|---|---|---|
| Schema Completeness | 6/10 | 20% | 1.2 |
| Migration Hygiene | 4/10 | 15% | 0.6 |
| RLS Coverage | 5/10 | 20% | 1.0 |
| Data Integrity | 5/10 | 15% | 0.75 |
| Foreign Keys & Indexes | 6/10 | 15% | 0.9 |
| Code-to-Schema Alignment | 5/10 | 15% | 0.75 |
| **TOTAL** | | **100%** | **5.2** |

---

## 1. Schema Overview

| Metric | Value |
|---|---|
| **Total tables** | 143 |
| **Total views** | 15 |
| **Tables in types.ts** | 148 (tables + views) |
| **Total foreign keys** | 255 |
| **Total migrations on disk** | 94 files |
| **Tables with data** | ~60 (42% populated) |

---

## 2. CRITICAL Findings

### CRIT-01: `pedidos.status` CHECK Constraint Missing `faturado`

**Severity**: CRITICAL
**Impact**: Prevents billing workflow from functioning; triggers silently fail

The `pedidos` table has a CHECK constraint from migration `001_complete_schema.sql` line 665:
```sql
status TEXT DEFAULT 'rascunho' CHECK (status IN (
  'rascunho', 'aguardando_aprovacao', 'aprovado', 'em_producao',
  'produzido', 'aguardando_instalacao', 'em_instalacao',
  'parcialmente_concluido', 'concluido', 'cancelado'
))
```

However, the application code extensively uses `faturado` as a pedidos status:
- `src/domains/financeiro/pages/FaturamentoLotePage.tsx:146` does `.update({ status: "faturado" })`
- `src/domains/pedidos/pages/PedidoDetailPage.tsx:44` defines transitions `concluido -> ['faturado']`
- `src/domains/comercial/hooks/useDashboardStats.ts:259` filters by `status === 'faturado'`
- Migration `091_comissoes_trigger.sql` creates a trigger that fires on `status = 'faturado'`

**No migration ever modifies this CHECK constraint.** Any attempt to set `pedidos.status = 'faturado'` will be silently rejected by PostgreSQL (or throw an error, depending on RLS/trigger context). The commission trigger (091) will **never fire** because the status can never be set to `faturado`.

**Also missing**: `entregue` status used in `src/domains/admin/pages/RelatoriosPage.tsx:184`.

**Fix required**: Add migration to DROP and recreate the CHECK constraint:
```sql
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_status_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_status_check
  CHECK (status IN (
    'rascunho', 'aguardando_aprovacao', 'aprovado', 'em_producao',
    'produzido', 'aguardando_instalacao', 'em_instalacao',
    'parcialmente_concluido', 'concluido', 'faturado', 'entregue', 'cancelado'
  ));
```

---

### CRIT-02: Code References Non-Existent Tables

**Severity**: CRITICAL
**Impact**: Runtime errors when specific features are used

| Table in Code | File | Exists in DB? |
|---|---|---|
| `audit_logs` | Multiple imports (from 001 schema) | NO - renamed to `registros_auditoria` |
| `checklist_producao` | `src/domains/ai/appliers/producao/checklistApplier.ts:7` | NO - actual table is `producao_checklist` |
| `role_permissions` | `src/domains/admin/pages/AdminUsuariosPage.tsx:797` | NO - actual table is `permissoes_perfil` |
| `vw_estoque_disponivel` | `src/domains/producao/services/estoque-reserva.service.ts:50` | NO - view not found in any migration |

**Evidence**: Migration 001 creates `audit_logs` but later migration (002 or similar) renamed it to `registros_auditoria`. Code at `AdminUsuariosPage.tsx:797` queries `role_permissions` but the actual table is `permissoes_perfil` (composite PK table). The view `vw_estoque_disponivel` appears in code but is not created by any migration.

---

### CRIT-03: types.ts Missing 10 Active Tables

**Severity**: CRITICAL
**Impact**: No TypeScript type safety for these tables; queries use `any` types

Tables in the live database but **not** in `types.ts`:

| Table | Row Count | Used in Code? |
|---|---|---|
| `agent_conversations` | 3 | YES (heavily) |
| `agent_messages` | 54 | YES (heavily) |
| `agent_templates` | 19 | YES |
| `acabamentos` | 17 | YES |
| `nps_respostas` | 0 | YES |
| `contratos_servico` | 0 | YES |
| `webhook_configs` | 0 | YES |
| `quadro_avisos` | 0 | YES |
| `usinagem_tempos` | 0 | YES |
| `estoque_reservas_op` | 0 | YES |

The `types.ts` file needs regeneration via `supabase gen types typescript`. All of these tables have active code references but zero type safety.

Additionally, ALL tables in types.ts have `Relationships: []` (empty), meaning the Supabase type generation never captured FK relationships. This eliminates relationship-based type inference.

---

## 3. HIGH Severity Findings

### HIGH-01: 41 Tables Without RLS (Row Level Security)

**Severity**: HIGH
**Impact**: Data accessible to any authenticated user via Supabase client; potential data leakage

41 out of 143 tables (28.7%) have RLS **disabled**:

| Table | Has Data? | Sensitivity |
|---|---|---|
| `admin_config` | 22 rows | HIGH - system settings |
| `atividades_comerciais` | 46 rows | MEDIUM - sales activity |
| `campanhas` | 0 rows | LOW |
| `cliente_contatos` | 296 rows | HIGH - PII (phone, email) |
| `cliente_documentos` | 0 rows | HIGH - documents |
| `cliente_unidades` | 0 rows | MEDIUM |
| `comissoes` | 0 rows | HIGH - financial |
| `lancamentos_caixa` | 0 rows | HIGH - financial |
| `metas_vendas` | 0 rows | MEDIUM |
| `notas_internas` | 0 rows | MEDIUM |
| `ocorrencias` | 0 rows | MEDIUM |
| `oportunidades` | 0 rows | MEDIUM |
| `parcelas_pagar` | 0 rows | HIGH - financial |
| `pedido_compra_itens` | 0 rows | MEDIUM |
| `pedido_historico` | 0 rows | MEDIUM |
| `pedidos_compra` | 0 rows | MEDIUM |
| `permissions` | 57 rows | HIGH - access control |
| `permissoes_perfil` | 201 rows | HIGH - access control |
| `roles` | 9 rows | HIGH - access control |
| `veiculos` | 3 rows | LOW |
| ... (21 more tables) | | |

**Most concerning**: `admin_config`, `permissions`, `permissoes_perfil`, `roles` have NO RLS but contain access control data. Any authenticated user can read/modify roles and permissions.

Also: `cliente_contatos` has 296 rows of PII (names, phones, emails) with NO RLS.

### HIGH-02: RLS Policies Are All Permissive (`USING (true)`)

**Severity**: HIGH
**Impact**: RLS enabled but provides no actual protection

All RLS policies follow this pattern (from migration 027):
```sql
CREATE POLICY "Authenticated users can manage X"
  ON X FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

This means **any authenticated user can read/write/delete ALL rows in ALL RLS-enabled tables**. There is no role-based filtering (e.g., vendedor sees only their clients, instalador sees only their jobs). The RLS is effectively a no-op.

### HIGH-03: 5 Duplicate Migration Numbers

**Severity**: HIGH
**Impact**: Non-deterministic execution order; potential conflicts

| Number | File A | File B |
|---|---|---|
| 011 | `011_categorias_produtos_reais.sql` | `011_fix_serie_lock.sql` |
| 022 | `022_fix_portal_aprovacao.sql` | `022_seed_modelo_materiais_processos.sql` |
| 031 | `031_ai_engine_tables.sql` | `031_modulos_integrados.sql` |
| 078 | `078_agent_templates_seed.sql` | `078_ai_orcamento.sql` |
| 093 | `093_estoque_kpis_rpc.sql` | `093_fix_agent_status_constraint.sql` |

When using `supabase db push` or `supabase migration up`, the execution order of duplicates is filesystem-dependent (alphabetical), not guaranteed. This creates a fragile migration chain.

### HIGH-04: Migration Gap (044-047, 066-069)

**Severity**: HIGH
**Impact**: Suggests deleted or lost migrations; audit trail broken

Gaps in migration numbering:
- 044, 045, 046, 047 are missing
- 066, 067, 068, 069 are missing

These gaps suggest migrations were created and then deleted, possibly due to conflicts or errors. Any production database that had these applied is now out of sync with the migration files.

### HIGH-05: CASCADE DELETE on `materiais` Risks Mass Data Loss

**Severity**: HIGH
**Impact**: Deleting one material cascades to 7 dependent tables

```
DELETE FROM materiais WHERE id = '...' cascades to:
  -> estoque_movimentacoes
  -> estoque_reservas
  -> estoque_saldos
  -> historico_precos_fornecedor
  -> materiais_historico_preco
  -> modelo_materiais (BOM)
  -> usinagem_tempos
```

Deleting a single material wipes all its stock history, reservations, price history, BOM links, and machining data. This should be `RESTRICT` (block delete if dependents exist) since the table has soft-delete columns (`excluido_em`).

Similarly dangerous CASCADE chains exist for:
- `ordens_producao` -> 6 tables (production steps, materials, rework, all gone)
- `propostas` -> 5 tables (items, services, views, attachments)
- `profiles` -> 4 tables (commissions, team memberships, targets, notifications)

---

## 4. MEDIUM Severity Findings

### MED-01: 41 Orphan Tables (Not Referenced in Application Code)

41 tables exist in the database but have ZERO references in the `src/` codebase:

**Likely dead tables**: `agenda_instalacao`, `assinaturas_campo`, `campo_audit_logs`, `checklists_campo`, `checkout_almoxarife`, `cotacoes_compra`, `diario_bordo`, `equipe_membros`, `equipes`, `estoque_inventario`, `historico_precos_fornecedor`, `lancamentos_caixa`, `midias_campo`, `notas_internas`, `origens_lead`, `pedido_historico`, `permissoes_perfil`, `processos_producao`, `producao_checklist`, `producao_retrabalho`, `recebimento_itens`, `recebimentos`, `solicitacoes_compra`, `tarefas_campo`, `templates_orcamento`

**Possibly used by App de Campo (separate codebase)**: `job_photos`, `job_videos`, `jobs`, `assinaturas_campo`, `checklists_campo`, `midias_campo`, `tarefas_campo`

**Possibly used via Edge Functions**: `ai_logs`, `campo_audit_logs`, `notificacoes`, `notifications`

These should be audited individually. Some may be legitimately used by the Campo app or Edge Functions not in `src/`.

### MED-02: Dual Notification Tables

Two separate notification tables exist:
- `notificacoes` (11 cols, RLS enabled, 0 rows)
- `notifications` (9 cols, RLS enabled, 0 rows)

Neither is referenced in the main codebase. This is likely a naming conflict from different development phases. One should be dropped.

### MED-03: Table Naming Inconsistencies

| Pattern | Tables | Expected | Issue |
|---|---|---|---|
| Portuguese names | `clientes`, `pedidos`, `propostas` | Consistent | OK |
| English names | `bank_slips`, `bank_accounts`, `jobs`, `stores`, `permissions`, `roles` | Consistent | Mix of languages |
| Renamed tables | `audit_logs` -> `registros_auditoria` | Code updated | Code NOT updated |
| Renamed tables | `role_permissions` -> `permissoes_perfil` | Code updated | Code NOT updated |
| Renamed tables | `historico_precos` -> `historico_precos_fornecedor` | Code updated | Unknown |

### MED-04: `stores` Table Has 1308 Rows But Only Used in 1 File

The `stores` table has the most rows in the system (1308) but is only referenced in `src/pages/Settings.tsx`. This appears to be imported/migrated data that might be a reference dataset, not operational data.

### MED-05: Trigger Exception Swallowing in Commission Trigger

Migration `091_comissoes_trigger.sql` has:
```sql
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
```

This silently swallows ALL errors during commission creation. If the INSERT fails (e.g., constraint violation, missing column), the pedido status update proceeds but no commission is generated, with no error logged anywhere.

### MED-06: 81 Foreign Keys with NO ACTION Delete Rule

81 FKs use `NO ACTION` on delete. When the parent row is deleted, these will fail with a constraint violation error rather than cascading or setting null. This is technically correct for data integrity but:
- No application error handling exists for most of these cases
- Users will see generic "constraint violation" errors

Most problematic: `fiscal_documentos` has 14 NO ACTION FKs to various parent tables. Deleting a client, pedido, or fiscal_ambiente will fail silently if fiscal documents reference them.

---

## 5. LOW Severity Findings

### LOW-01: `propostas` Has 47 Columns

The `propostas` table has grown to 47 columns, making it the widest table. This suggests it may benefit from normalization (e.g., extracting portal/tracking columns to a separate table).

### LOW-02: Missing `updated_at` Triggers on Some Tables

Several tables with `updated_at` columns may not have corresponding `update_updated_at` triggers. The trigger was created in migration 001 but only applied to a subset of tables.

### LOW-03: `fornecedores.cnpj` Is Not UNIQUE

Unlike `clientes.cnpj` which has a UNIQUE constraint, `fornecedores.cnpj` allows duplicates. This could lead to duplicate supplier entries.

### LOW-04: No Partial Indexes for Soft Delete

Migration 037 added `excluido_em` columns to 10 critical tables with an index `WHERE excluido_em IS NULL`, but application queries don't consistently filter by `excluido_em IS NULL`. Some queries will return soft-deleted rows.

### LOW-05: `oportunidades.cliente_id` FK Added via DO Block

The FK from `oportunidades.cliente_id` to `clientes.id` is added via a DO block (conditional ALTER TABLE) in migration 001. This pattern works but doesn't benefit from `IF NOT EXISTS` on the FK itself, only on the constraint name check.

---

## 6. Migration Analysis Summary

| Metric | Value | Assessment |
|---|---|---|
| Total migration files | 94 | Large but manageable |
| Duplicate numbers | 5 pairs (10 files) | BAD - needs renumbering |
| Gaps in numbering | 8 missing numbers | BAD - lost migrations |
| Largest migration | 001 (1911 lines) | OK for initial schema |
| Seed-only migrations | ~8 (data inserts) | OK |
| Migrations with IF NOT EXISTS | Most | GOOD - idempotent |
| Migrations with transactions | Few | BAD - should use BEGIN/COMMIT |

---

## 7. Business Data Model Validation

### Lead -> Client -> Proposal -> Order -> Production -> Delivery -> Financial

| Step | Table | FK Chain | Status |
|---|---|---|---|
| Lead | `leads` | - | OK |
| Lead -> Client | `clientes.lead_id` -> `leads.id` | SET NULL | OK |
| Client -> Proposal | `propostas.cliente_id` -> `clientes.id` | RESTRICT | OK |
| Proposal -> Items | `proposta_itens.proposta_id` -> `propostas.id` | CASCADE | OK |
| Proposal -> Order | `pedidos.proposta_id` -> `propostas.id` | SET NULL | OK (weak link) |
| Order -> Items | `pedido_itens.pedido_id` -> `pedidos.id` | CASCADE | OK |
| Order -> Production | `ordens_producao.pedido_id` -> `pedidos.id` | SET NULL | WEAK - should be RESTRICT |
| Order -> Financial | `contas_receber.pedido_id` -> `pedidos.id` | SET NULL | WEAK - should be RESTRICT |
| Order -> Fiscal | `fiscal_documentos.pedido_id` -> `pedidos.id` | NO ACTION | OK |

**Issues**:
- `ordens_producao.pedido_id` uses SET NULL: if a pedido is deleted, all production orders lose their parent reference but remain in the system as orphans
- `contas_receber.pedido_id` uses SET NULL: financial records lose traceability to orders if orders are deleted
- No FK exists from `pedido_itens.proposta_item_id` back-tracking which proposal item generated which order item (SET NULL is used, but losing this link is problematic)

### Pricing Model

| Table | Rows | Status |
|---|---|---|
| `materiais` | 498 | OK |
| `produtos` | 106 | OK - was 156, some soft-deleted? |
| `produto_modelos` | 113 | OK - was 156, some removed |
| `modelo_materiais` | 380 | OK - BOM linkage |
| `modelo_processos` | 339 | OK - routing linkage |
| `regras_precificacao` | 11 | OK - 11 categories |
| `config_precificacao` | 1 | OK - single config |
| `maquinas` | 6 | OK |

---

## 8. Recommendations (Priority Order)

### Immediate (Week 1)
1. **Fix pedidos status CHECK constraint** to include `faturado` and `entregue` (CRIT-01)
2. **Fix code references** to non-existent tables: `audit_logs`, `checklist_producao`, `role_permissions`, `vw_estoque_disponivel` (CRIT-02)
3. **Regenerate types.ts** with `supabase gen types typescript` to include all 143 tables (CRIT-03)

### Short-term (Week 2-3)
4. **Enable RLS on 10 critical tables**: `admin_config`, `permissions`, `permissoes_perfil`, `roles`, `cliente_contatos`, `comissoes`, `lancamentos_caixa`, `parcelas_pagar`, `pedidos_compra`, `pedido_compra_itens` (HIGH-01)
5. **Replace permissive RLS** with role-based policies at least for financial/admin tables (HIGH-02)
6. **Renumber duplicate migrations** (HIGH-03)
7. **Change CASCADE to RESTRICT** on `materiais` delete rule for `modelo_materiais`, `estoque_saldos`, `estoque_movimentacoes` (HIGH-05)

### Medium-term (Month 2)
8. Audit and drop orphan tables or connect them to the application
9. Consolidate notification tables (`notificacoes` vs `notifications`)
10. Add explicit CHECK constraints for all status/enum-like fields
11. Implement role-based RLS policies (vendedor scope, admin scope, instalador scope)
12. Add transaction wrapping to critical triggers

---

## Appendix A: Complete RLS Coverage Map

### RLS ENABLED (102 tables)
acabamentos, agent_conversations, agent_messages, agent_templates, ai_alertas, ai_logs, bank_accounts, bank_remittance_items, bank_remittances, bank_return_items, bank_returns, bank_slips, campanha_destinatarios, campo_audit_logs, categorias_produto, centros_custo, checklist_execucao_itens, checklist_execucoes, checklist_itens, checklists, clientes, company_settings, config_precificacao, config_tributaria, contas_pagar, contas_receber, contratos_servico, das_apuracoes, empresas, estoque_movimentacoes, estoque_reservas, estoque_reservas_op, estoque_saldos, etapa_templates, extrato_bancario_importacoes, extrato_bancario_itens, extrato_regras_classificacao, faixas_quantidade, fiscal_ambientes, fiscal_audit_logs, fiscal_certificados, fiscal_documentos, fiscal_documentos_itens, fiscal_erros_transmissao, fiscal_eventos, fiscal_filas_emissao, fiscal_regras_operacao, fiscal_series, fiscal_xmls, fornecedores, import_logs, inventario_itens, inventarios, job_photos, job_videos, jobs, lancamentos_contabeis, leads, maquinas, materiais, materiais_historico_preco, modelo_materiais, modelo_processos, notificacoes, notifications, nps_respostas, orcamento_item_maquinas, ordens_instalacao, ordens_producao, parcelas_receber, pedido_itens, pedidos, plano_contas, producao_apontamentos, producao_checklist, producao_etapas, producao_materiais, producao_retrabalho, produto_modelos, produtos, profiles, proposta_attachments, proposta_item_acabamentos, proposta_item_materiais, proposta_item_processos, proposta_itens, proposta_servicos, proposta_versoes, proposta_views, propostas, quadro_avisos, registros_auditoria, regras_precificacao, retornos_bancarios, routing_rules, servicos, setores_producao, stores, templates_orcamento, usinagem_tempos, webhook_configs

### RLS DISABLED (41 tables)
admin_config, agenda_instalacao, anexos, assinaturas_campo, atividades_comerciais, campanhas, checklists_campo, checkout_almoxarife, cliente_contatos, cliente_documentos, cliente_unidades, comissoes, cotacoes_compra, diario_bordo, equipe_membros, equipes, estoque_inventario, ferramentas, historico_precos_fornecedor, lancamentos_caixa, metas_vendas, midias_campo, notas_internas, ocorrencia_tratativas, ocorrencias, oportunidades, origens_lead, parcelas_pagar, pedido_compra_itens, pedido_historico, pedidos_compra, permissions, permissoes_perfil, processos_producao, recebimento_itens, recebimentos, roles, solicitacoes_compra, tarefas_campo, tarefas_comerciais, veiculos

---

## Appendix B: Foreign Key Summary

| Delete Rule | Count | Assessment |
|---|---|---|
| CASCADE | 71 | Some too aggressive (materiais, profiles) |
| SET NULL | 84 | Appropriate for most optional references |
| NO ACTION | 81 | Will block deletes - needs error handling |
| RESTRICT | 19 | Correct for critical references |
| **Total** | **255** | |

---

## Appendix C: Duplicate Migration Files

| Number | File 1 | File 2 |
|---|---|---|
| 011 | `011_categorias_produtos_reais.sql` (1080 lines) | `011_fix_serie_lock.sql` (32 lines) |
| 022 | `022_fix_portal_aprovacao.sql` (37 lines) | `022_seed_modelo_materiais_processos.sql` (524 lines) |
| 031 | `031_ai_engine_tables.sql` (56 lines) | `031_modulos_integrados.sql` (174 lines) |
| 078 | `078_agent_templates_seed.sql` (213 lines) | `078_ai_orcamento.sql` (11 lines) |
| 093 | `093_estoque_kpis_rpc.sql` (27 lines) | `093_fix_agent_status_constraint.sql` (9 lines) |

---

*Report generated 2026-03-22 by automated database architecture audit.*
