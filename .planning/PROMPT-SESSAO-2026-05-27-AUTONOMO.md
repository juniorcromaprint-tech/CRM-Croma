Sou Junior, retomando refundação Beira Rio Parte 6. Modo AUTÔNOMO — você executa sem
pedir confirmação pra cada passo. Decisões pré-aprovadas estão listadas abaixo. Só
pause se encontrar algo que NÃO está coberto pelas pré-aprovações OU se um risco
real (perda de dados, downtime de prod) aparecer.

# REGRAS DA SESSÃO (inegociáveis)

1. **Modo orquestrador OBRIGATÓRIO** — você planeja + coordena + valida. Trabalho
   pesado (recon ≥500 linhas, implementação ≥100 LOC, deploy multi-step, debug
   isolado) vai pra sub-agent via Agent tool. CLAUDE.md REGRA #0 detalha.
2. **Budget ~250k tokens** (sessão anterior usou 250k de 300k — você tem folga
   maior aqui mas escala agents se passar de 150k).
3. **NUNCA "parar pra economizar tokens"** sem ter tentado delegar pra agent.
4. **Paralelismo obrigatório** se blocos são independentes — múltiplos `Agent()`
   no mesmo message.
5. **Modo adversarial em validações** — agents recebem instrução explícita pra
   questionar premissas + verificações cruzadas.
6. **Cowork vs Claude Code**: arquivos >500 linhas (Edit do Cowork trunca) →
   recomendar Junior rodar Claude Code local. Cowork é melhor pra orquestração +
   deploys + queries.
7. **Notificar Telegram** (chat_id 1065519625, sem parse_mode Markdown) quando
   tarefa longa terminar.
8. **Português brasileiro** sempre. Termos técnicos em inglês (deploy, trigger,
   webhook, edge function, branch, merge, push, pull request, etc).

# LEITURA OBRIGATÓRIA (na ordem, antes de qualquer agent)

1. `C:\Users\Caldera\Claude\CRM-Croma\CLAUDE.md` (regra #0 orquestrador + #1 MCP)
2. `C:\Users\Caldera\Claude\CRM-Croma\.planning\STATE.md` (entrada
   `2026-05-26 TARDE` + `MADRUGADA-2` pra contexto recente)
3. `C:\Users\Caldera\Claude\CRM-Croma\.planning\PROMPT-SESSAO-2026-05-26.md`
   (sessão anterior — contexto completo)

# ESTADO EM PROD (não revalidar — confiável)

- `whatsapp-webhook` v44 ACTIVE (guard INTERNAL_PHONES)
- `briefing-beira-rio` v10 ACTIVE (referencia + prazo + logistica + store
  com address/neighborhood + notify_chat_id)
- `ai-gerar-orcamento` v29 ACTIVE intocado
- `portal-upload-assinatura` v1 ACTIVE (proxy seguro assinatura → Storage)
- `claudete_bot.py` rodando com Telegram-entry handler
  (`_brio_detectar_e_despachar` linha 5680). PID dinâmico, conferir
  `Get-Process pythonw` se precisar restart.
- RPCs portal v2: `portal_get_proposta`, `portal_aprovar_item`,
  `portal_atualizar_cliente`, `portal_aprovar_proposta` (v1 legacy
  DROPPED), `portal_inserir_mensagem`, `portal_listar_mensagens`
- RPCs vault: `get_service_role_legacy_jwt`, `get_telegram_bot_token`
- Frontend deployado via commit `63bee93c` (push 2026-05-26 TARDE)
- E2E real Junior validado: PROP-2026-0032 SHADOW + Aprovar via Telegram

# PRÉ-APROVAÇÕES (modo autônomo — sem confirmar comigo)

✅ **PODE FAZER SEM PEDIR**:
- `git commit` atômico + `git push origin main` (Vercel auto-deploy)
- `apply_migration` no Supabase (idempotente)
- `deploy_edge_function` no Supabase
- SQL READ direto (SELECT, schema discovery, count, etc.)
- SQL WRITE em dados de TESTE (LIKE '%TEST%', wamid LIKE 'tg_TEST_*')
- Cleanup de smoketests (DELETE com filtro explícito)
- Disparar até 6 agents em paralelo
- Patch em `claudete_bot.py` (com backup obrigatório + UTF-8 sem BOM)
- Restart do bot (`Stop-Process pythonw` + `Start-Process`)
- Criar/modificar arquivos de docs, planning, migrations
- Atualizar STATE.md (adicionar entrada nova)
- Notificar Telegram (chat 1065519625 sem Markdown)

⛔ **NÃO PODE FAZER SEM CONFIRMAR**:
- UPDATE/DELETE em propostas REAIS (PROP-2026-0030/0031/0032 ou qualquer
  proposta sem flag de teste)
- Dropar tabelas/colunas em produção
- Apagar arquivos não-temporários (.bak, outputs, _legacy-imports são
  exceções — pode apagar)
- Disparar template WhatsApp Meta (regra janela 24h)
- Commit arrastando arquivos de SESSÕES ANTIGAS sem auditoria explícita
- Push --force ou rewrite de history
- Criar conta/recurso em provedor pago novo (Vercel, Supabase tier, etc.)
- Mexer em `.env` ou secrets em prod

⚠️ **DECISÕES PRÉ-TOMADAS (não reabrir)**:
- Frontend é Vercel auto-deploy via main. PR separado não — commits atômicos
  com mensagens claras.
- Package manager: pnpm (não npm — gera conflito react@19 vs next-themes)
- Bucket de uploads: `proposta-uploads` (privado, signed URL)
- Bucket de assinaturas: mesmo bucket, path `assinaturas/{proposta_id}/...`
- Storage policy `portal_uploads_insert_anon` permissiva — bloquear path
  `assinaturas/%` é TODO V2 (não bloqueante agora)
- Stores.brand fica NULL — Junior popula manual caso a caso (MALUMA etc.)
- `imagem_url` em proposta_itens fica NULL inicial — fluxo de upload é V2
- `responder_claude` perde contexto se intercepta briefing — aceitável V1

# OBJETIVO DESTA SESSÃO

Continuar a refundação Beira Rio fechando os blocos abaixo na ORDEM SUGERIDA.
Pode pular blocos que não dão pra fazer no tempo (ex: E2E Viviane depende
dela estar disponível).

---

## BLOCO 0 — VALIDAÇÃO IMEDIATA (~15 min, INLINE + 1 agent)

**Disparar AGORA antes de tudo** — confirmar que o push de ontem não quebrou
nada em prod.

Briefing pra agent recon adversarial:
- Fetch `https://crm-croma.vercel.app/` via mcp__workspace__web_fetch
- Validar status 200 + cabeçalhos (X-Vercel-Cache, X-Vercel-Id) + se HTML
  serve a página principal sem erro de JS
- Se possível, fetch um portal específico com share_token de PROP-2026-0032:
  - SQL: `SELECT share_token FROM propostas WHERE numero='PROP-2026-0032'`
  - Path: `https://crm-croma.vercel.app/p/<token>`
  - Confirmar renderiza HTML sem erro
- Validar Vercel build do commit `63bee93c`:
  - Tentar `git log --oneline -1` + buscar evidência de build success
  - Se acesso ao painel Vercel não dá, reportar STATUS do HTTP HEAD
- Anti-regressão: abrir 1 proposta SEM `config_snapshot.store` (PROP-2026-0028
  provável) e confirmar que portal renderiza graciosamente sem o bloco Loja

Output: report curto (≤80 linhas) com status verde/amarelo/vermelho.

Se algo quebrar:
- Erro de build npm vs pnpm → criar `vercel.json` com
  `{"installCommand": "pnpm install"}` + commit + push
- Erro de runtime React (componente crashando) → identificar componente,
  agent dedicado pra fix
- 500 ou 404 no /p/:token → checar logs Edge + RLS + RPC

INLINE depois do agent:
- Validar Edge `briefing-beira-rio` v10 ainda ACTIVE via `list_edge_functions`
- Validar bot Claudete vivo via `Get-CimInstance Win32_Process -Filter
  "Name='pythonw.exe'"` filtrando claudete_bot.py
- Notificar Telegram com resumo da validação

---

## BLOCO 1 — PR HOUSEKEEPING (~45 min, AGENT pesado)

**18 arquivos modified + 60+ untracked** de sessões 21-25/05 ainda no working
dir. Tudo já em prod, mas sem rastro git. Plano: organizar em 3-5 commits
atômicos por escopo + push.

Briefing pra agent pesado:
- Auditoria fresh do estado atual:
  ```powershell
  cd 'C:\Users\Caldera\Claude\CRM-Croma'
  git status --short
  git diff --stat HEAD
  ```
- **Cuidado**: o agent de auditoria git da sessão anterior identificou 45
  arquivos com CRLF churn que NÃO devem ser comitados. `.gitattributes`
  agora está em prod (commit `03b8126f`), então ao Cassandra rodar
  `git checkout -- <arquivos-CRLF>` o problema deve estar resolvido.
  Re-validar.

Agrupar em commits por escopo:

**COMMIT A — feat(ia): ponte Cowork webhook v40 + Edges novas**:
- `supabase/functions/whatsapp-webhook/index.ts` (1374 LOC, v40 com
  INTERNAL_PHONES e routeToBriefingBeiraRio)
- `supabase/functions/agent-post-process-message/` (Edge nova v1 Etapa 2.3)
- `supabase/functions/ai-requests-fallback-watchdog/` (Edge nova v1 Etapa 2.4)
- `supabase/functions/whatsapp-enviar-audio/` (Edge nova v2 OGG/Opus)

**COMMIT B — fix(orcamento): ai-gerar-orcamento v29 + pricing-engine**:
- `supabase/functions/ai-gerar-orcamento/index.ts` (107 LOC, v26→v29)
- `supabase/functions/ai-shared/pricing-engine.ts` (44 LOC, companion fix)

**COMMIT C — fix(cron): agent-cron-loop dedup Telegram**:
- `supabase/functions/agent-cron-loop/index.ts` (24 LOC)
- `supabase/functions/ai-enviar-nps/index.ts` (12 LOC, mistas — pode entrar
  aqui ou COMMIT A)
- `supabase/functions/enviar-email-campanha/index.ts` (18 LOC)
- `supabase/functions/mcp-bridge-worker/index.ts` (9 LOC)

**COMMIT D — feat(mcp): telegram tools + admin upgrades**:
- `mcp-server/src/index.ts` (6 LOC, registra registerTelegramTools)
- `mcp-server/src/tools/admin.ts` (64 LOC, criar_modelo_produto extended)
- `mcp-server/src/tools/telegram.ts` (NEW, 3 tools)

**COMMIT E — docs: refundação + REGRA #0 + planning sessões**:
- `CLAUDE.md` (143 LOC, REGRA #0 ORQUESTRADOR)
- `AGENTS.md` (raiz, novo) — checar se é proposital antes de comitar
- `.context/mcp-ferramentas.md`, `.context/codigo.md`, `.context/karpathy.md`
- `.planning/REFUNDACAO-2026-05.md`, `MAPA-IA-CROMA.md`, `REQUIREMENTS.md`,
  `CONTINUACAO-2026-05-25.md`, `PROMPT-NOVA-SESSAO.md`,
  `PROMPT-SESSAO-2026-05-25.md`, `PROMPT-SESSAO-2026-05-26.md`,
  `PROMPT-SESSAO-2026-05-27-AUTONOMO.md` (esse arquivo), `PROXIMO-COMMIT.md`
- `docs/plano-ia/*.md` (8 arquivos)
- `docs/qa-reports/2026-05-20-auditoria-leads-agente-vendas.md`
- `STATE.md` (entradas TARDE + MADRUGADA-2)

**Antes de commit E**:
- Sanitizar telefones em STATE.md? Junior pode decidir. Default: manter
  (já estão hardcoded no código Edge mesmo)

**Antes de qualquer commit**:
- Deletar `supabase/functions/whatsapp-webhook/index.v39-prod.ts` (backup
  já ignorado pelo .gitignore)
- Deletar `supabase/functions/agent-cron-loop/index.ts.bak_dedup_*`
- Deletar `mcp-server/args_pay.json` (payload de teste)
- Decidir `scripts/hp-latex-sync_hidden.vbs` — manter ou deletar?

**ZERO commit `npm` lock se foi modificado** — só pnpm-lock.yaml.

**ZERO push --force** ou rewrite history.

Output: report condensado com SHA de cada commit + status push.

---

## BLOCO 2 — FIX RÁPIDO: EMOJIS ASCII NO BOT (~10 min, AGENT pequeno)

Bug conhecido: emojis `✅❌✏️` quebram em alguns clientes Telegram (Junior
viu `? APROVADA` em vez de `✅ APROVADA` no E2E real).

Briefing pra agent:
- Backup obrigatório `claudete_bot.py.bak-pre-emoji-fix-<timestamp>`
- Trocar globalmente (com cuidado por contexto):
  - `✅` → `[OK]` ou `[v]`
  - `❌` → `[X]` ou `[-]`
  - `✏️` → `[edit]` ou `EDITAR`
  - `🟢🟡🔴` (se houver) → `[OK]` `[!]` `[X]`
  - **NÃO mexer** em emojis em comentários `# 🚀 ...` (só em strings que
    vão pro Telegram via `bot.send` ou `edit_message_text`)
- Validar via `ast.parse` que o arquivo continua válido
- Restart do bot
- Smoketest: gerar briefing pelo Telegram, validar que card chega com texto
  legível

Output: lista de linhas alteradas + screenshot/print do card real.

---

## BLOCO 3 — E2E REAL VIVIANE (depende dela)

Esse bloco só roda se Viviane estiver disponível na Quinta 28/05. Junior
confirma antes.

- Viviane manda briefing pelo Telegram dela (chat_id 7755709957)
- Esperado: `_brio_detectar_e_despachar` detecta + Edge v10 dispatch +
  card SHADOW chega no chat DELA (não no Junior) graças ao `notify_chat_id`
- Viviane aprova → status `enviada` + handler V2 funciona

Validação inline:
- SQL: `SELECT * FROM ai_requests WHERE contexto->>'notify_chat_id' = '7755709957'`
- SQL: `SELECT * FROM propostas WHERE config_snapshot->'store'->>'code' IS NOT NULL ORDER BY created_at DESC LIMIT 5`

Se NÃO chegar card no chat dela:
- Conferir Edge v10 está honrando `notify_chat_id` no insert (sites 2-5
  do v8 patch — re-checar arquivo `supabase/functions/briefing-beira-rio/index.ts`)
- Conferir que o bot está passando `notify_chat_id` corretamente
  (helper `_brio_detectar_e_despachar` linha 5740)

---

## BLOCO 4 — TODO V2 DO PORTAL (~60 min, múltiplos agents paralelos)

Ordem por prioridade:

### 4A — Patchar Edge `ai-chat-portal` pra persistir resposta IA

Hoje: IA responde mas state local só → some no F5.
Fix: Edge `ai-chat-portal` deve chamar `portal_inserir_mensagem`
(`remetente='ia'`) ANTES de retornar resposta pro front. Service role precisa
bypass de validação `remetente IN ('cliente','vendedor','ia')` — já no CHECK.

Briefing pra agent:
- Ler `supabase/functions/ai-chat-portal/index.ts`
- Identificar onde a resposta IA é gerada (Anthropic/OpenAI call)
- Adicionar `portal_inserir_mensagem(token, resposta, {tipo: 'ia_auto'})`
  com service_role token (via vault RPC se SERVICE_ROLE_KEY virou sb_secret_*)
- Deploy v2 da Edge
- Smoketest: mandar mensagem no chat do portal → recarregar página →
  resposta IA deve permanecer

### 4B — Estender `portal_get_proposta` retornando pedido

Hoje: Timeline sempre mostra "Aguardando pedido" porque RPC não retorna pedido.
Fix: RPC retorna pedido vinculado (`SELECT FROM pedidos WHERE proposta_id = ...`)
com status, created_at, data_conclusao, data_prometida.

Briefing pra agent:
- Recuperar RPC atual via `pg_get_functiondef`
- Adicionar SELECT joinando pedidos
- Apply migration `20260527_portal_get_proposta_with_pedido.sql`
- Confirmar Timeline renderiza 3+ estágios em proposta convertida

### 4C — Restringir storage policy `proposta-uploads`

Hoje: `portal_uploads_insert_anon` permite qualquer anon upload em
qualquer path do bucket.
Fix: restringir a `name LIKE 'assinaturas/%'` OR `name LIKE 'briefings/%'`
(ajustar conforme uso real).

Briefing pra agent:
- SQL: listar todas as policies do bucket `proposta-uploads`
- DROP da policy permissiva + CREATE da policy restritiva
- Apply migration `20260527_storage_proposta_uploads_policy.sql`
- Smoketest: tentar upload em path proibido (deve dar erro 403); tentar em
  `assinaturas/<uuid>/` (deve permitir)

### 4D — Trigger notificação vendedor quando cliente edita dados

Hoje: cliente muda CEP/endereço via portal → vendedor não fica sabendo.
Fix: trigger `AFTER UPDATE ON clientes` que insere row em
`portal_alteracoes_cliente` (tabela nova) e dispara mensagem Telegram pro
vendedor responsável (lookup via proposta ativa → vendedor_id → profiles.telefone).

Briefing pra agent:
- Criar tabela `portal_alteracoes_cliente` (id, cliente_id, proposta_id,
  campos_alterados JSONB, ip, user_agent, created_at)
- Trigger PL/pgSQL que captura mudança, identifica vendedor, chama
  `pg_net.http_post` pra Telegram Bot API (token via vault RPC)
- Apply migration + smoketest

### 4E — Persistir RPCs vault em migration versionada

Hoje: `get_service_role_legacy_jwt` e `get_telegram_bot_token` vivem só no
banco (criadas via execute_sql).
Fix: migration `20260527_vault_rpcs.sql` com `pg_get_functiondef` dump.

Briefing inline (rápido):
- `SELECT pg_get_functiondef(p.oid) FROM pg_proc p WHERE p.proname IN
   ('get_service_role_legacy_jwt', 'get_telegram_bot_token')`
- Salvar em `supabase/migrations/20260527_vault_rpcs.sql`
- Add ao próximo commit (BLOCO 1 docs ou separado)

---

## BLOCO 5 — ROADMAP MAIOR (não fazer nesta sessão, mapear)

Lista pra Junior decidir prioridade futura:

1. Aprovação digital com validade jurídica (ICP-Brasil opcional)
2. Multi-store dashboard (cliente Beira Rio ver todas as propostas abertas
   das várias lojas num só lugar)
3. Dark mode + auto-detect (`prefers-color-scheme`)
4. Compartilhar via Web Share API (mobile)
5. Auditoria de bucket `proposta-uploads` (quem upou o quê, quando)
6. Auditar 1258 stores sem cliente_id + limpar `stores.state` poluído
   (`CIDADE-UF` em 1254 rows)
7. Tela ERP `/orcamentos/pendentes-aprovacao` (sessão pendente desde MADRUGADA)
8. Disparo WhatsApp automático pós-Aprovar (Meta janela 24h + template
   aprovado — escopo grande, requer Meta config)
9. Migration UPDATE pra popular `stores.brand` (MALUMA etc.) — bloqueada por
   Junior ter que decidir cada uma
10. `code` da tabela `stores` inclui o nome (`186958-1 Giseli` em vez de
    `186958-1`) — bug de importação CSV original. Cosmético.

Output: NÃO fazer nada. Só listar no STATE.md como pendência.

---

## BLOCO 6 — AUDITORIAS ADVERSARIAIS PERIÓDICAS (se sobrar token)

Em paralelo, dispara agents pra auditar:

### 6A — Outras Edges usando SERVICE_ROLE_KEY ou TELEGRAM_BOT_TOKEN

Procurar padrão BUG-JWT em outras Edges:
- `grep -r "Bearer.*SERVICE_ROLE_KEY"` em `supabase/functions/`
- `grep -r "Deno.env.get('TELEGRAM_BOT_TOKEN')"`
- Validar se cada uma usa o helper `getLegacyJwt()` / `getTelegramToken()` ou
  se ainda quebra silenciosamente

### 6B — Auditoria de stores sem cliente_id

- Listar 1258 stores sem cliente_id (importadas via CSV)
- Identificar quais são Beira Rio (heurística: code com formato `XXXXXX-X`)
- Sugerir UPDATE em batch pra vincular

### 6C — Auditoria de propostas sem `config_snapshot.store`

- Listar todas as propostas SHADOW sem store
- Backfill se possível (re-popular do `lookupStore` agora que Edge v10
  retorna address+neighborhood)

---

# CRONOGRAMA SUGERIDO (3-4h sessão)

| Hora | Bloco |
|---|---|
| 0:00-0:15 | BLOCO 0 — Validação imediata Vercel + portal |
| 0:15-1:00 | BLOCO 1 — PR Housekeeping (5 commits) |
| 1:00-1:15 | BLOCO 2 — Emojis ASCII no bot |
| 1:15-1:30 | BLOCO 4E — Migration RPCs vault (rápido) |
| 1:30-2:30 | BLOCO 4A-D — TODO V2 portal em paralelo (4 agents) |
| 2:30-2:45 | BLOCO 6 — Auditorias adversariais (se sobrar token) |
| 2:45-3:00 | Update STATE.md TARDE-2 + Telegram notify |

BLOCO 3 (Viviane) depende dela — agendar separado.
BLOCO 5 (roadmap) só listar como pendência.

---

# ANTI-PATTERNS PROIBIDOS

❌ Centralizar trabalho na sessão principal (use agents paralelos)
❌ Parar pra "economizar tokens" sem ter tentado delegar
❌ `git add .` que arrasta arquivos não-finalizados
❌ Commit sem mensagem semântica (`feat`, `fix`, `chore`, `docs`)
❌ Push sem ter visto `git status` antes
❌ Apply_migration sem `IF NOT EXISTS` / `IF EXISTS` (precisa ser idempotente)
❌ Edit em arquivo grande sem backup prévio
❌ Restart de bot sem confirmar via log que subiu OK
❌ Trocar emojis em comentários Python (só em strings que vão pro Telegram)
❌ Mexer em propostas reais sem cleanup explícito

# COMANDO INICIAL

Comece assim:
1. Lê CLAUDE.md + STATE.md (entrada TARDE) — 30s
2. Cria TaskList com os blocos 0-6 (TaskCreate em paralelo)
3. Dispara BLOCO 0 (1 agent recon) + carrega tools que vai precisar
   (ToolSearch select:execute_sql,apply_migration,deploy_edge_function,
   list_edge_functions,list_migrations em paralelo)
4. Quando agent BLOCO 0 voltar, decide cronograma baseado em achados
5. Segue ordem sugerida disparando agents em paralelo onde possível

# CRÍTICOS DE ARQUITETURA (mantra antes de mexer)

- WhatsApp Croma = canal cliente (atendimento) + ENTRY Beira Rio via
  encaminhar Viviane/Junior (webhook v44)
- Telegram Claudete = comando-livre dono + ENTRY Beira Rio (handler novo)
- Portal Croma `/p/:token` = substitui Mubisys, 9 features novas
- Bot Python autônomo Anthropic API — NÃO usa Cowork pra mensagens leves
- Ponte Cowork foi DESLIGADA em 22/05 (revisão estratégica) — não tentar
  reabilitar
- Mubisys (mubisys.com) = SaaS PHP externo, sem integração API com Croma —
  Junior/Viviane cadastram manual. Objetivo é APOSENTAR o Mubisys.

---

Estou pronto. Pode arrancar disparando agent recon do BLOCO 0 + criando
TaskList em paralelo.
