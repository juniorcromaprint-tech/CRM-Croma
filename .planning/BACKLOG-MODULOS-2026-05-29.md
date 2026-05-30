# BACKLOG DE MÓDULOS — driver primário do loop autônomo

> Criado: 2026-05-29 22:00 BRT | Por: Junior + sessão monitor (Opus)
> Fonte: mapa de saúde verificado ao vivo — `docs/qa-reports/2026-05-29-mapa-saude-modulos-burndown.md`
> **REGRA**: este backlog é o DRIVER PRIMÁRIO da Etapa 5. O loop pega o próximo item `default-exec` do módulo do dia, na ordem de prioridade abaixo. Advisor cleanup virou FILLER (só quando este backlog + a rotação do dia estão esgotados).
> Ao fechar um item: mover pra DONE no ledger (não aqui) + marcar `[x]` aqui no commit do ciclo.

---

## ORDEM DE PRIORIDADE (lanes)

- **P0 — Correção de dinheiro** (decisão do Junior 29/05): impacto direto em faturamento correto, 100% automável.
- **P1 — Fiscal/segurança de código**: fecha superfície de risco sem depender do Junior.
- **P2 — Infra/limpeza**: custo/bloat, menor urgência.
- **BLOCKED-Junior**: decisão de negócio/risco — registrar 1 recomendação, NÃO executar.

---

## P0 — CORREÇÃO DE DINHEIRO (default-exec)

- [ ] **DB-012** (Orçamento/Pedidos): 5/23 proposta_itens + 5/12 pedido_itens sem `largura_cm`/`altura_cm`/`area_m2` → preço por m² sai errado/zero. **Default-exec**: identificar itens NULL, backfill `area_m2` onde largura/altura existem; itens sem dimensão = listar pra Junior (não inventar medida). Critério: 0 itens com area_m2 NULL quando largura+altura presentes. [NAO-VALIDADO: confirmar trigger de cálculo + colunas reais antes].
- [ ] **DB-013** (Pedidos/Produção): `fn_validar_transicao_status` não cobre `ordens_producao` (ELSE NULL = passa qualquer transição). **Default-exec**: mapear estados válidos de OP (do validator de produção real) + adicionar CASE pra ordens_producao na função. Critério: transição inválida de OP rejeitada em smoketest. [NAO-VALIDADO: ler fn + estados reais antes; migration validada].
- [x] **DB-006** (Orçamento): 60/107 produtos (56%) sem `produto_modelos` → Mubisys custeia cego. **Default-exec**: o loop NÃO inventa BOM. Gerar relatório dos 60 produtos sem modelo (priorizado por uso recente em propostas/pedidos) + alerta pro Junior cadastrar. Critério: relatório no ledger + Telegram. (Cadastro da BOM = Junior/negócio.) — ✅ FECHADO #52 (2026-05-30): 53 ativos sem modelo (60,2%), TODOS com 0 uso em propostas/pedidos (catálogo seed 2026-03-11, nunca cotados = landmine latente, não sangramento ativo). Relatório: `docs/qa-reports/2026-05-30-DB-006-produtos-sem-modelo-sem-uso.md`. Cadastro BOM por categoria = Junior.

## P1 — FISCAL/SEGURANÇA DE CÓDIGO (default-exec)

- [ ] **INT-006** (Comercial): `whatsapp-webhook:380` aceita payload sem assinatura quando `WHATSAPP_APP_SECRET` ausente (fallback permissivo). **Default-exec**: confirmar se o secret está setado em prod; se sim, remover o fallback `return true` (rejeitar sem assinatura). Janela 22h-7h (Edge cliente). [NAO-VALIDADO: confirmar env antes de endurecer]. — ⚠️ **VALIDADO #53 (2026-05-30)**: fail-open REAL em `validateSignature` (v46, **L381** `return true` se `!appSecret`; backlog "L380" = off-by-one). DE-RISK: `admin_config` tem 13 chaves `WHATSAPP_*` mas **NÃO** `WHATSAPP_APP_SECRET` → secret provavelmente NÃO setado → fail-open provavelmente **ATIVO**. Fix = L381 `return true`→`return false`. **BLOCKED-Junior**: setar `WHATSAPP_APP_SECRET` no Edge env (Meta App > Settings > Basic > App Secret) ANTES, senão 403 em 100% do inbound; depois deploy via Claude Code (1294L > limite Cowork) em janela. NÃO deployar cego.
- [ ] **INT-014** (IA): `telegram-webhook:56-112` injeta args do LLM em `.eq()/.limit()/.lte()` sem validação. **Default-exec**: adicionar schema Zod nos args antes do `tool.execute`. Edge interna, qualquer hora.
- [ ] **SEC-013** (Fiscal/IA): proteção de senha vazada (HaveIBeenPwned) OFF no Auth. **Default-exec**: habilitar no config do Auth (sem deploy). Critério: advisor `auth_leaked_password_protection` zera.
- [ ] **SEC-011** (Infra): `pg_trgm` + `pg_net` em `public`. **Default-exec**: migration `ALTER EXTENSION ... SET SCHEMA extensions` (validar dependências antes). [NAO-VALIDADO: checar objetos que referenciam as extensions].

## P2 — INFRA/LIMPEZA (default-exec)

- [ ] **DB-015** (Infra): `registros_auditoria` 476k linhas / **1,1 GB** sem retenção. **Default-exec**: política de retenção (ex: purge >90d via cron) ou partitioning por mês. Critério: cron de retenção ativo + tamanho estabiliza. [NAO-VALIDADO: confirmar nada crítico depende de auditoria antiga].
- [ ] **DB-014** (Perf): 303 índices `idx_scan=0`. **Default-exec**: DROP em lote APÓS confirmar idx_scan=0 live (alguns são recentes do #43 — excluir os <30d). [NAO-VALIDADO: re-checar idx_scan no momento + idade].
- [ ] **DATA-001/003** (Comercial): ~7 leads de teste E2E + 13 emails com leads duplicados. **Default-exec**: limpar leads de teste (cascade explícito, preservar evidência) + dedupe por email (manter o mais completo). [NAO-VALIDADO: listar e confirmar antes de deletar].
- [x] **DB-011** (Orçamento): drift CLAUDE.md "11 categorias" vs 9 regras_precificacao ativas. **Default-exec**: sincronizar doc com banco (ou reativar as 2 faltantes se forem válidas). — ✅ FECHADO #54 (2026-05-30): banco = 11 regras (9 ativas + 2 inativas letreiro/fachada, desativadas deliberadamente 2026-03-22 02:40). Doc `.context/migrations.md` sincronizado. **Achado MAIOR (validado por agent)**: motor de preço NÃO aplica as regras de categoria no caminho manual — `orcamento-pricing.service.ts:307` faz match exato `r.categoria === produto.categoria`, mas produto.categoria é plural/free-text ("adesivos","Fachadas") ≠ regra singular ("adesivo","fachada") → todo orçamento manual cai em `geral` (markup hardcoded 40%, min 25, aprov 85). Caminho AI (ai-gerar-orcamento) casa (LLM emite categoria_inferida singular). `markup_maximo` = dead code (nunca lido em cálculo). Ver `docs/qa-reports/2026-05-30-DB-011-regras-precificacao-engine.md`. Fix de código/preço = BLOCKED-Junior (PRICE-001/002, ledger NEXT).

## NOVOS (achados #54 — lane Orçamento/preço, BLOCKED-Junior — fix mexe em preço/código)
- [ ] **PRICE-001** (Orçamento, P1, VALIDADO): orçamento manual ignora markup por categoria. `useItemEditor.ts:135` passa produto.categoria cru → `orcamento-pricing.service.ts:307` `ativas.find(r => r.categoria === categoria)` nunca casa (plural vs singular) → sempre `geral` 40%. Categorias com markup calibrado alto (placa sug=310, adesivo sug=580) ficam SUB-precificadas no UI manual. Rec: normalizar match (singular/lowercase) OU mapear produto.categoria→regra.categoria. Fix em frontend = Claude Code + validação Junior (impacto de preço). Volume realizado baixo (23 proposta_itens/12 pedido_itens, muitos mubisys skip-priced).
- [ ] **PRICE-002** (Orçamento, P2, VALIDADO): `markup_maximo` é dead code — só em types.ts + admin CRUD, nunca lido no cálculo (sem clamp). Admin UI deixa setar teto que não é aplicado; `adesivo` (min 400 > max 300) e `placa` (sug 310 > max 300) são inconsistências inertes. Rec: ou ligar markup_maximo como teto, ou remover do admin. BLOCKED-Junior (decisão de produto).
- [ ] **PRICE-003** (Orçamento, watch): no caminho AI a regra `adesivo` casa e usaria markup_sugerido=580% sem clamp. Confirmar com Junior se 580/310 são calibração intencional (material barato → markup alto) ou erro de digitação. BLOCKED-Junior (preço).
- [ ] **DATA-004** (Orçamento, P2): taxonomia de produto.categoria inconsistente — duplicatas por caixa/idioma ("fachadas"+"Fachadas", "Comunicação Visual", "Placas e Displays", "Outros", "letreiros" plural). Agrava PRICE-001. Rec: normalizar vocabulário de categorias [NAO-VALIDADO: confirmar nenhum código depende dos valores atuais].

## BLOCKED-Junior (1 recomendação cada — NÃO executar)

### Comercial 🔴 (dados — precisa de processo/entrada humana)
- **CRM-001/002/004/005/006** — base de leads/clientes congelada e incompleta (96% parados, 99,7% sem vendedor). Rec: definir processo de atribuição de vendedor + enriquecimento (a prospecção ligada ajuda no influxo novo, mas a base velha precisa de decisão de limpeza/arquivamento).
- **CRM-003** — atribuir vendedor à carteira (decisão comercial).

### Fiscal 🔴 (bloqueia NF-e)
- **FIS-001** (35 clientes sem CNPJ/CPF) + **FIS-002** (379 materiais sem NCM) + **FIS-004** (36 sem endereço). Rec: mutirão de cadastro fiscal — o loop pode gerar a lista priorizada, mas o preenchimento é dado de negócio.

### Segurança 🔴 (decisão de risco)
- **SEC-005** (41 views SECURITY DEFINER bypassam RLS) — rec: agent mapeia quais expõem PII → recriar não-essenciais com `security_invoker=on` em janela.
- **SEC-009** (5 buckets com listing público) — rec: refactor signed-URL (já na tua pendência).
- **SEC-003** (124 policies `USING(true)`) — rec: triar by-design (portal) vs frouxas.
- **INT-002/INT-011** (SERVICE_TOKEN `croma-fiscal-interno-2026` + família `croma-*-2026` hardcoded = bypass de auth fiscal) — rec: mover pra env/vault + rotacionar.
- **INT-004** (`fiscal-debug-sefaz`/`fiscal-debug-nfe` ACTIVE em prod) — rec: desativar/remover do prod.
- **INT-005 / SEC-010** (TELEGRAM_BOT_TOKEN hardcoded `telegram-webhook:11`) — rec: rotacionar no BotFather → vault (já na tua pendência).

### Produção 🔴
- **OPS-001** (107/107 jobs HP sem vínculo ERP) — rec: definir chave de match job HP↔pedido (precisa de regra de negócio); loop pode propor heurística em SHADOW.
- **HP-001** (2 printheads vencidos em uso) — ação física (trocar).
- **PROD-001** (3 OPs sem máquina) — atribuição operacional.

### Autonomia (Fase 2-4)
- Ligar prospecção (`followup_engine_ativo=true`) com Junior presente + fila de aprovação manual.
- Triggers de evento formais, cobrança exercitada, PCP replanning, Memory Layer, cockpit.

---

## STATUS DO BACKLOG

| Lane | Itens | Fechados |
|---|---|---|
| P0 Correção de dinheiro | 3 | 0 |
| P1 Fiscal/segurança código | 4 | 0 |
| P2 Infra/limpeza | 4 | 0 |
| BLOCKED-Junior | ~18 | — |
