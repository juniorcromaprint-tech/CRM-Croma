# HANDOFF — Nova sessão de monitoramento dos crons autônomos

**Criado**: 2026-05-28 ~12:00 BRT
**Sessão anterior encerrada**: sessão interativa Junior + Claude que: (1) configurou modo autônomo do CRM (v1→v5), (2) acompanhou 13 ciclos rodarem, (3) corrigiu incidente de corrupção working dir, (4) diagnosticou e religou agent-cron-loop após 4 dias quebrado, (5) desativou cobranças automáticas a pedido do Junior.

---

## CONTEXTO MÍNIMO PRA ENTRAR

### Quem é Junior
Dono da Croma Print (gráfica). Desenvolve as automações internas. Não é dev profissional mas tem domínio técnico (Supabase, edge functions, RLS, triggers, Git, integrações WhatsApp/Telegram). Preferências: português brasileiro, modo adversarial em auditorias, sem perguntar opção A/B (decidir e justificar), termos técnicos em inglês, tabelas + ✅⚠️❌ visuais.

### O que rola
Junior criou um scheduled task autônomo no Cowork (`croma-autonomous-progress`) que roda **a cada 1 hora 24/7** (cron `0 * * * *`). Cada execução é uma sessão isolada do Claude que:
1. Lê 3 cérebros persistentes (`.planning/STATE.md` + `autonomous-ledger.md` + vault Obsidian via Windows-MCP)
2. Aplica REGRA #0 (decide sozinho, nunca pergunta opção A/B pro Junior)
3. Faz health check + escolhe 1-3 tarefas pequenas
4. Executa via orquestrador agressivo (6 agents paralelos OK, plano 20x = tokens sem limite)
5. Atualiza os 3 cérebros + envia Telegram pro chat `1065519625`

Missão norteadora: **CROMA 4.0** — automação total da gráfica (`docs/plano-ia/01_Estrategia/CROMA_4.0_PLANO_AUTONOMIA_TOTAL.md`).

### Seu papel nesta sessão
**MONITOR — não executor.** Junior vai chegar e pedir "como estão os crons?", "quantos ciclos rodaram?", "tem algum bug novo?", etc. Você responde com base nos arquivos abaixo. **Não disparar trabalho do autônomo aqui** — só monitorar.

Se Junior pedir intervenção (ex: "religa o cron X", "desativa rule Y", "investiga bug Z"), aí sim você executa.

---

## ARQUIVOS-CHAVE A LER AO INICIAR (em paralelo, sem economia)

| Arquivo | Pra quê |
|---|---|
| `C:\Users\Caldera\Claude\CRM-Croma\CLAUDE.md` | Regras gerais do projeto |
| `C:\Users\Caldera\Claude\CRM-Croma\.planning\autonomous-mission.md` | Missão CROMA 4.0 + rotação módulo por dia |
| `C:\Users\Caldera\Claude\CRM-Croma\.planning\autonomous-rules.md` | Regras do modo cron v5.0 (8 etapas, guardrails, modo passivo) |
| `C:\Users\Caldera\Claude\CRM-Croma\.planning\autonomous-ledger.md` | **CRÍTICO**: DONE imutável + IN-PROGRESS + BLOCKED + NEXT priorizado |
| `C:\Users\Caldera\Claude\CRM-Croma\.planning\autonomous-log.md` | Log append-only de cada ciclo (auto-diálogo + ações + resultado) |
| `C:\Users\Caldera\Claude\CRM-Croma\.planning\STATE.md` | Histórico vivo do CRM (últimas 500 linhas é suficiente) |
| `C:\Users\Caldera\Claude\CRM-Croma\.planning\REQUIREMENTS.md` | BUGs/GAPs ainda abertos |
| Este arquivo (`HANDOFF-MONITORAMENTO-CRONS-2026-05-28.md`) | Contexto da sessão anterior |

Vault Obsidian (best effort, via Windows-MCP PowerShell se mounted):
- `C:\Users\Caldera\Obsidian\JARVIS\99-Meta\memory.md`
- `C:\Users\Caldera\Obsidian\JARVIS\10-Daily\2026-05-28.md`

---

## ESTADO ATUAL (2026-05-28 ~12:00 BRT)

### Scheduled task `croma-autonomous-progress`
- Cron: `0 * * * *` (a cada 1h, 24/7)
- Ativo: SIM
- Última execução: ciclo #13 ~11:15 BRT
- Próxima execução prevista: ~13:03 BRT

### Ciclos rodados hoje (1-13)
- #1 (02:10 run-now manual): validação framework end-to-end VERDE
- #2 (00:05): adversarial ai-chat-portal v15 + descoberta Obsidian via Windows-MCP OK
- #3 (01:10): auditoria Produção + fix drift VERSION ai-chat-portal v14→v15
- #4 (02:05): trigger SHADOW production_completed + seed etapa_templates + descoberta schema ai_logs
- #5 (03:15): patch ai-briefing-producao v22 + ai-analisar-foto-instalacao v13 + audit cross-Edge
- #6 (04:20): refactor ai-logger.ts v2 + whatsapp-webhook v46 + correção premissa RLS
- #7 (05:25): reality check Padrão C false positive + auditoria Fase 2 banco
- #8 (06:10): Fase 2.3 destravada — agent_config + 12 seeds + RLS + trigger
- #9 (07:30): ACHADO P0 6 rules schema quebrado + 3 templates WA sem meta_template_name
- #10 (08:05): CORREÇÃO P0 4 rules fix + 2 desativadas + 5 templates off + 1 acao.template
- #11 (09:05): 🔴 ABORTADO defensivamente por guardrail anti-corrupção (8 arquivos `.ts` truncados)
- #12 (10:00): smoketest #10 NEGATIVO (last_run 4 dias atrás) + ACHADO P0 agent-cron-loop quebrado + DEDUP 6 templates
- #13 (~11:15): 🎯 **RELIGOU agent-cron-loop** — deploy v24 substituindo v23 corrompido (placeholder no source). 12 rules voltaram a rodar. VITÓRIA EMPÍRICA.

### Health prod (verificado 12:00 BRT)
- Vercel: 🟢 200 OK
- Branch: main
- HEAD: `83d794e` (sync com origin)
- 76 Edges ACTIVE
- Working dir: limpo (só `.claude/settings.local.json` + scripts untracked)
- Supabase: zero 5xx última hora
- Bot Claudete: PID dinâmico (não verificado neste momento)

### Mudanças manuais aplicadas pelo Junior nesta sessão
1. **08:36 BRT**: `git checkout HEAD --` em 8 arquivos `.ts` corrompidos por truncamento (Layout, comercialRoutes, navigation, 5 Edges)
2. **09:30 BRT**: fechou Bloco de Notas que tinha `autonomous-log.md` aberto (causa parcial da corrupção)
3. **~12:00 BRT**: **DESATIVADAS 5 rules de cobrança automática** (`cobranca_d1/d3/d7/d15/d30`) — Junior fará cobrança manualmente até critério claro de segurança

---

## ITENS NO LEDGER (resumo pra você responder Junior rápido)

### DONE recente (não refazer)
- Ciclo #13 deploy agent-cron-loop v24 (placeholder corrompido removido)
- Ciclo #12 dedup 6 templates obsoletos
- Ciclo #10 correção 6 rules schema quebrado + 5 templates WA + acao.template
- Ciclo #8 Fase 2.3 — tabela agent_config criada com 12 seeds
- Ciclo #4 trigger SHADOW production_completed + 6 etapa_templates seed
- Refundação Beira Rio Parte 6 (whatsapp-webhook v46, briefing-beira-rio v10, ai-chat-portal v15, etc.)

### BLOCKED (aguardando Junior)
- 🔴 **Rotacionar PAT Supabase** (`sbp_db39d12f...` vazou em 21/05) — CRÍTICO
- ⚠️ **Storage policy `portal_uploads_insert_anon_restricted`** — aplicar via `supabase db push` local
- ⚠️ **Mojibake `claudete_bot.py`** — 85 linhas com `?` literal (estratégia c já no ledger)
- 🟡 Cobranças desativadas (Junior fará manualmente — não é blocker do autônomo, é decisão de produto)

### NEXT que próximos ciclos devem atacar
- **P0 INFRA AUTONOMIA**: portar autônomo pra Edge Function Supabase com `pg_cron` (independe do PC ligado)
- **P1 fix `.catch is not a function`** em agent-cron-loop linhas 174-183 + 232-239 (bug residual descoberto ciclo #13, não-bloqueante)
- **P1 ai-chat-portal v16 SHADOW** (rate-limit + historico server-side + sanitização + .select().single())
- **P1 17 chamadas 401 ai-compor-mensagem** durante smoketest ciclo #13 (X-Internal-Call headers precisa investigação)
- **P2 SALDO MATERIAIS via view** (reativar `estoque_minimo` + `sugerir_compra_automatica`)
- **P2 promover trigger production_completed** — 3+ fires consistentes, ready
- Avançar CROMA 4.0 Fase 1 (`ai_requests`/`ai_responses`, triggers `installation_completed`, `payment_received`, `payment_overdue`)

---

## INCIDENTES IMPORTANTES PRA LEMBRAR

### 🚨 Incidente 08:30 — Corrupção working dir
8 arquivos `.ts` apareceram com EOF truncado (1 insertion + várias deletions, cortados no meio de tags/palavras). Padrão idêntico ao agent-cron-loop v23 deployado com PLACEHOLDER no source. Causa provável: **Edit tool do Cowork em arquivo > 500 LOC trunca silenciosamente** (whatsapp-webhook 1374 LOC, agent-cron-loop 1230 LOC).

**Mitigação implementada**: guardrail Etapa 4 do autônomo abre `git diff --stat HEAD` e ABORTA se ≥3 arquivos modified fora de `.planning/`. Ciclo #11 acionou defensivamente (status VERMELHO + Telegram 🔴).

**Suspeito INVESTIGADO mas DESCARTADO**: `npm run dev` PID 336 é do projeto Mineração (`D:\Onedrive\Documentos\Claude\Projects\Mineração\dashboard`), não toca CRM. CRM-Croma fora do OneDrive. Antivírus desativado.

**Causa root**: não 100% confirmada. Hipótese mais provável: Edit tool buggado em arquivo grande. Junior deve evitar editar `.ts` em editor externo enquanto cron roda; usar `git checkout HEAD --` se aparecer.

### 🟡 Bugs residuais descobertos no ciclo #13
1. `supabase.from(...).insert(...).catch is not a function` — supabase-js v2 recente removeu `.catch()` direto do PostgrestBuilder. Cosmético (perde log mas rules processam). Linhas: 174-183, 232-239 em agent-cron-loop. Fix: trocar `.catch(() => {})` por `try { await ... } catch {}`.
2. 17x HTTP 401 em `ai-compor-mensagem` durante smoketest ciclo #13. Header `X-Internal-Call` provavelmente não tá sendo validado direito. Investigar próximo ciclo.

---

## COMO MONITORAR (queries prontas)

### Última execução de cada cron
```sql
-- Scheduled tasks Cowork
-- (via tool mcp__scheduled-tasks__list_scheduled_tasks)
```

### Agent_rules status
```sql
SELECT nome, modulo, ativo, last_run, run_count, LEFT(last_error, 60) AS err
FROM agent_rules 
ORDER BY ativo DESC, last_run DESC NULLS LAST;
```

### Edge logs últimas execuções agent-cron-loop
```sql
SELECT created_at, function_name, status, duration_ms, LEFT(error_message, 100) AS err
FROM ai_logs
WHERE function_name = 'agent-cron-loop'
ORDER BY created_at DESC
LIMIT 20;
```

### Health prod rápido
```sql
SELECT
  (SELECT COUNT(*) FROM ai_logs WHERE status='error' AND created_at > now()-interval '1h') AS errors_1h,
  (SELECT COUNT(*) FROM agent_rules WHERE ativo=true) AS rules_ativas,
  (SELECT MAX(last_run) FROM agent_rules) AS rules_ultimo_run;
```

### Confirmar Vercel
- `mcp__workspace__web_fetch` em `https://crm-croma.vercel.app/` → esperar 200

---

## TELEGRAM (sempre que terminar trabalho longo)
- chat_id: `1065519625` (Junior)
- **SEM Markdown** (parse_mode null)
- **SEM `.md`** no fim de paths (cliente faz auto-link em TLD)
- Via 1: `SELECT get_telegram_bot_token()` + curl bash
- Via 2: Windows-MCP PowerShell Invoke-RestMethod
- Máx 12 linhas

---

## REGRAS DESTA SESSÃO (monitoramento)

✅ **Faça**:
- Ler arquivos `.planning/*` antes de responder qualquer pergunta sobre status
- Consultar `agent_rules`, `ai_logs`, `cron.job_run_details` para evidência empírica
- Verificar `crm-croma.vercel.app` health quando perguntado sobre prod
- Reportar de forma estruturada (tabela + status visual ✅⚠️🔴)
- **Verificar antes de assumir** (regra adversarial)

❌ **Não faça**:
- Disparar trabalho do autônomo aqui (já tem cron rodando a cada 1h)
- Tomar decisões de produto sem perguntar Junior (ex: reativar cobranças)
- Editar `.ts` em arquivos grandes (> 500 LOC) — risco de corrupção do Edit tool
- Esquecer de manter `.planning/STATE.md` atualizada se Junior pedir mudanças manuais

---

## ÚLTIMA PALAVRA

Junior tá deixando o sistema rodar. Ele pediu pra você ser o monitor — alguém que ele possa abrir a qualquer hora e perguntar "tá tudo bem?" e ter resposta auditável.

Se algum ciclo der vermelho ou descobrir bug crítico, **Junior espera transparência adversarial**: o que quebrou, qual a evidência, qual a recomendação. Sem suavizar.

Se ele perguntar "como tá indo?", responde com:
1. Quantos ciclos rodaram desde última check
2. Status do último (verde/amarelo/vermelho)
3. Commits feitos pelos ciclos
4. Achados P0/P1 novos
5. O que tá no NEXT do ledger pra próximos ciclos atacarem

Boa sorte. Junior é parceiro de qualidade, modo adversarial é bem-vindo.
