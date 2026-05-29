# SEC-AUDIT — Exposição ANON / RLS / Secrets (backlog abril)

> Ciclo autônomo #37 — 2026-05-29 11:07 BRT — read-only adversarial. Runtime-provado (não inspeção estática).
> Backlog de abril (SEC-001 / INT-001 / INT-005) nunca tocado pelo loop; 5 ciclos no NEXT (#32–#36); corroborado por Obsidian memory 2026-05-27 ("3 secret leaks — URGENTE").

---

## VEREDICTO

| Item | Achado de abril | Veredicto #37 | Severidade |
|---|---|---|---|
| **SEC-001** | "37 tabelas RLS off?" | 🔴 **MAL ROTULADO + EXPOSIÇÃO REAL**: só 1 tabela RLS off; o real são **policies `TO public USING(true)`** que expõem PII ao role `anon` | 🔴 ALTA (LGPD) |
| **INT-001** | "cron 5/6 JWT hardcoded?" | ✅ **REFUTADO/RESOLVIDO**: 0 cron com JWT literal; todos via `private.get_service_role_key()` (vault) | ✅ OK |
| **INT-005** | "tokens hardcoded" | 🔴 **PARCIAL**: 1 token Telegram ainda hardcoded em `telegram-webhook:11` | 🔴 ALTA |

---

## SEC-001 🔴 — EXPOSIÇÃO ANON (PROVA DE RUNTIME)

**Método**: `SET ROLE anon` + `count(*)` por tabela (= o que a chave pública do frontend, sem login, consegue ler).

| Tabela | Linhas visíveis ao `anon` | Conteúdo |
|---|---|---|
| leads | **3460** | nome, telefone, email de prospects |
| ai_alertas | **357** | alertas internos (policy `ALL` → leitura E escrita) |
| clientes | **336** | razão social, CNPJ, contatos, endereço |
| produtos | 107 | catálogo |
| telegram_messages | 42 | conteúdo de mensagens + chat_id |
| regras_precificacao | 11 | markup / regras de custo |
| **pedidos** (controle) | **0** | ✅ gated `get_user_role()` |
| **contas_receber** (controle) | **0** | ✅ gated |
| **jobs** (controle) | **0** | ✅ gated |

Os controles em 0 **provam** que o vetor são as policies abertas — não um bypass geral, e que a checagem `get_user_role()` funciona.

### Causa-raiz
1. `anon` tem `GRANT ALL` (SELECT/INSERT/UPDATE/DELETE/TRUNCATE) em **todas as 181 tabelas** (default do Supabase). → **RLS é o único gate.**
2. As tabelas expostas têm policy `FOR SELECT/ALL TO public USING(true)`. O role `public` é herdado por `anon`, então `anon` passa.
3. A anon key fica **embutida no JS do frontend** (extraível trivialmente) → `GET /rest/v1/leads?select=*` retorna os 3460 leads.

### As policies problemáticas (todas `TO public USING(true)`)
- `leads.leads_all_read` (SELECT) — 🔴 PII
- `clientes.clientes_all_read` (SELECT) — 🔴 PII
- `ai_alertas.service_role_manage_alertas` (ALL) — 🔴 mal nomeada (service_role já bypassa RLS; a policy só serve pra expor anon/authenticated)
- `telegram_messages.service_role_full_telegram_messages` (ALL, USING+CHECK true) — 🔴 mal nomeada; é a ÚNICA policy da tabela
- `nps_respostas.nps_public_read_by_token` (SELECT) + `nps_public_update_by_token` (UPDATE) — 🟡 nome diz "by_token" mas o USING é `true` (sem checagem de token) → UPDATE-any perigoso (tabela vazia hoje)
- catálogo/preços `TO public USING(true)`: `produtos`, `produto_modelos`, `categorias_produto`, `modelo_materiais`, `modelo_processos`, `regras_precificacao`, `faixas_quantidade`, `maquinas`, `orcamento_item_maquinas`, `materiais_historico_preco` — 🟡 intel de custo/markup; **NEEDS-CONFIRM** se o portal anon renderiza proposta lendo catálogo

### RLS off de verdade (só 1)
- `alertas_telegram_dedup` — RLS OFF, 0 policies, tabela interna de dedup (acessada por trigger/Edge via service_role). Baixo risco; hardening = `ENABLE RLS` (service_role não é afetado).
- `campo_audit_logs` — RLS ON + 0 policies (locked-by-default, morta; já documentado #33). Não é hole.

### As policies que estão CORRETAS (amostra — `get_user_role()`/`is_role()`)
`pedidos`, `contas_receber`, `contas_pagar`, `ordens_producao`, `profiles`, `roles`, `clientes_write/update/delete`, `leads_write/update/delete`, `email_events`, `contratos_servico`, `estoque_reservas_op`, etc. → auth-gated, anon bloqueado (provado: controles = 0).

---

## INT-001 ✅ — CRON JWT (REFUTADO)

14 cron jobs ativos. Todos que chamam Edge usam `'Bearer ' || private.get_service_role_key()`. Cross-check `pg_get_functiondef`:
- `private.get_service_role_key` → `SECURITY DEFINER`, **uses_vault=true**, jwt_literal=false. ✅
- Nenhum job com `eyJ...` literal. O concern de abril ("5/6 hardcoded") está **obsoleto** (Junior refatorou pro getter vault).

---

## INT-005 🔴 — SECRETS HARDCODED (PARCIAL)

Scan HOST (`Select-String`) em `supabase/functions` + `mcp-server` + `scripts`:

| Arquivo:linha | Achado | Severidade |
|---|---|---|
| `supabase/functions/telegram-webhook/index.ts:11` | `const TELEGRAM_TOKEN = '8750164337:AAH8…'` **hardcoded** | 🔴 ALTA |
| `supabase/functions/notificar-aprovacao-telegram/index.ts` | header `v2-vault-token` — "Hardcode REMOVIDO", usa `get_telegram_bot_token` (vault) | ✅ corrigido |
| `mcp-server/src/supabase-client.ts:20` (+ dist) | `SUPABASE_ANON_KEY` (JWT) hardcoded | 🟡 BAIXA (chave pública por design; tool local) |
| `mcp-server/node_modules/zod/.../string.test.ts` | `eyJ…` em fixture de teste | ⬜ falso-positivo |

**O fix do Junior de 2026-05-27 cobriu 1 de ≥2 arquivos.** O mesmo token segue vivo em `telegram-webhook:11`. RPC vault `public.get_telegram_bot_token` (SECURITY DEFINER, uses_vault=true) já existe — basta usá-la.

---

## RECOMENDAÇÕES (decisão de risco = Junior)

> Nada aplicado neste ciclo (11:07 business hours; mudança de policy em core/catálogo pode quebrar ERP/portal; rotação de token = ação @BotFather). Exposição é de meses → sem regressão em esperar janela monitorada.

**P0-a — Fechar exposição anon (RLS)** — aplicar `SEC-001-remediacao-anon-rls-VALIDADA.sql` em janela monitorada, **após confirmar que nenhuma página ANON (pré-login) lê leads/clientes/catálogo**:
- SAFE (PII): `leads_all_read` e `clientes_all_read` → trocar `TO public` por `TO authenticated` (mantém leitura logada, fecha anon).
- SAFE: `DROP` das policies mal nomeadas `service_role_manage_alertas` (ai_alertas) — authenticated mantém acesso via `authenticated_read_alertas`/`authenticated_resolve_alertas`; service_role bypassa.
- NEEDS-CONFIRM: `telegram_messages` (sem policy de fallback p/ authenticated), `nps_respostas` (gate por token real), catálogo (portal anon?).

**P0-b — Rotacionar token Telegram**: gerar novo token via @BotFather, gravar no vault, trocar `telegram-webhook:11` pra `get_telegram_bot_token` + fallback env (mesmo patch do `notificar-aprovacao-telegram` v2). O token atual deve ser considerado comprometido (estava na lista URGENTE de 05-27 e segue exposto).

**P2 — Defense-in-depth**: revogar `GRANT ALL` de `anon` nas tabelas que não precisam (risco: portal/Edge anon). Só com mapeamento prévio dos paths anon.
