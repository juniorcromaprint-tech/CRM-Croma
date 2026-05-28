Sou Junior, retomando refundação Beira Rio Parte 7.

Sessão anterior (2026-05-27 TARDE-2) fechou 9 blocos com 8 commits push origin/main e identificou 3
secret leaks que precisam ação MINHA antes de qualquer trabalho novo arriscado.

# LEITURA OBRIGATÓRIA (na ordem)

1. `C:\Users\Caldera\Claude\CRM-Croma\CLAUDE.md` (REGRA #0 orquestrador + REGRA #1 MCP)
2. `C:\Users\Caldera\Claude\CRM-Croma\.planning\STATE.md` (entradas TARDE-2 + TARDE da Parte 5 pra contexto)
3. Este arquivo (escopo completo)

# REGRAS DA SESSÃO (inegociáveis)

1. **Modo orquestrador OBRIGATÓRIO** — planejar + coordenar + validar. Trabalho pesado
   (recon ≥500 linhas, implementação ≥100 LOC, deploy multi-step) vai pra sub-agent isolado.
2. **Paralelismo agressivo** — múltiplos Agent() no mesmo message se blocos são independentes.
3. **Budget ~250k tokens**. Escalar agents se passar de 150k.
4. **NUNCA "parar pra economizar tokens"** sem ter tentado delegar.
5. **Modo adversarial em validações** — agents recebem instrução explícita.
6. **Cowork vs Claude Code**: arquivos >500 linhas → recomendar Claude Code local.
7. **Notificar Telegram** (chat_id 1065519625, sem parse_mode Markdown) quando tarefa longa termina.
8. **Português brasileiro sempre**. Termos técnicos em inglês.
9. **NUNCA escrever token completo em prosa ou docs** — sempre `prefix... (REDACTED)`.

# ESTADO EM PROD (confiável, não revalidar)

- 8 commits push origin/main em 27/05
- `whatsapp-webhook` v44 ACTIVE
- `briefing-beira-rio` v10 ACTIVE **(validada via smoketest hoje)**
- `ai-gerar-orcamento` v29 ACTIVE intocado
- `ai-chat-portal` **v15 ACTIVE** (persiste IA + 2 bug fixes)
- `portal-upload-assinatura` v1 ACTIVE
- RPCs portal v2: get/aprovar_item/atualizar_cliente/aprovar_proposta_v2/inserir_mensagem/listar_mensagens — v1 legacy DROPada
- RPCs vault: `get_service_role_legacy_jwt`, `get_telegram_bot_token` (versionadas em migration agora)
- Trigger ativo: `trg_notify_vendedor_cliente_update` em clientes
- Tabela nova: `portal_alteracoes_cliente` (audit log)
- Coluna nova: `profiles.telegram_chat_id` (Junior seedado com 1065519625)

# AÇÕES MANUAIS DO JUNIOR (CONFIRMAR ANTES DE TUDO)

Confirma comigo no início da sessão quais já foram feitos:

- [ ] **#1 ROTACIONOU Supabase PAT** `sbp_db39d12f... (REDACTED)` no painel Supabase?
- [ ] **#2 ROTACIONOU Telegram bot token** `8750164337:AAH8... (REDACTED)` via @BotFather?
- [ ] **#3 Aplicou CREATE da policy `portal_uploads_insert_anon_restricted`** via Supabase Dashboard?

Se algum não foi feito, parar a sessão e me lembrar de pedir. Se TODOS foram feitos, prosseguir.

# OBJETIVO DESTA SESSÃO

Continuar a refundação Beira Rio fechando blocos de SEGURANÇA + INVESTIGAÇÃO. Ordem sugerida:

---

## BLOCO 1 — Fix BUG-JWT nas 5 Edges (~60 min, AGENT pesado paralelo)

Padrão: trocar `Authorization: Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` por
helper `getLegacyJwt()` (RPC `get_service_role_legacy_jwt` cached em isolate).

**Edges afetadas (ordem por blast radius)**:

1. `mcp-bridge-worker:146` — função `invokeEdgeFunctionInternal` (MAIOR impacto: TODAS as chamadas MCP→Edge)
2. `whatsapp-webhook:622` — função `gerarOrcamentoReal` (chama `ai-gerar-orcamento`)
3. `agent-post-process-message:152` — chama `ai-gerar-orcamento`
4. `ai-compor-mensagem:332` — chama `ai-gerar-orcamento`
5. `ai-requests-fallback-watchdog:153` — chama `whatsapp-enviar`

Briefing pra agent:
- Ler cada Edge no path `supabase/functions/<nome>/index.ts`
- Copiar helper `getLegacyJwt()` + cache em isolate da `briefing-beira-rio` v10 (linhas 52-62)
- Adicionar import + função no topo
- Substituir o `Bearer ${SERVICE_ROLE_KEY}` pelo `Bearer ${await getLegacyJwt(supabase)}`
- Adicionar retry sob 401 (igual `briefing-beira-rio` faz com `getLegacyJwt(supabase, true)`)
- Deploy + smoketest cada uma
- Versionar local em `supabase/functions/<nome>/index.ts` se ainda não está
- 1 commit por Edge ou 1 commit agrupado por feature — Junior decide depois

Cuidado: `whatsapp-webhook` é o mais sensível (rota webhook ativa de cliente). Smoketest após deploy.

---

## BLOCO 2 — Fix HARDCODE Telegram token em notificar-aprovacao-telegram (~15 min, AGENT pequeno)

- Ler `supabase/functions/notificar-aprovacao-telegram/index.ts`
- Substituir `const TELEGRAM_TOKEN = '...HARDCODED...'` pelo padrão `getTelegramToken()` via RPC vault
- Confirmar que o token JÁ foi rotacionado (BLOCO 0 verifica)
- Deploy + smoketest
- Commit + push

---

## BLOCO 3 — Aplicar CREATE policy storage (~10 min, INLINE)

Se Junior já aplicou via Dashboard (BLOCO 0), validar via SQL:
```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
  AND policyname LIKE '%proposta_uploads%';
```

Se não aplicou, GUIAR Junior na aplicação via Dashboard (sem fazer por ele — MCP não tem ownership).

---

## BLOCO 4 — Resolver mojibake do claudete_bot.py (~30 min, AGENT + decisão)

Arquivo: `C:\Users\Caldera\Claude\JARVIS\claudete_bot.py` (6499 linhas, mojibake em 85 strings).
Backup: `claudete_bot.py.bak-pre-emoji-fix-20260528-005823`.

**Opção A — Git revert (RECOMENDADO se vault JARVIS tem .git)**:
- Briefing pra agent: `cd JARVIS && git log --all --oneline -- claudete_bot.py` pra achar commit pré-mojibake
- Confirmar com Junior qual commit voltar
- `git checkout <sha> -- claudete_bot.py`
- Diff + validate AST

**Opção B — Heurística semântica (FALLBACK)**:
- Substituir `?` literal por ASCII inferido pelo contexto:
  - `f"? *APROVADA*"` → `f"[OK] *APROVADA*"`
  - `f"?? *EDITAR*"` → `f"EDITAR"` 
  - `f"? *CANCELADA*"` → `f"[X] *CANCELADA*"`
- Agent gera DIFF completo pra Junior revisar ANTES de salvar

**Opção C — Apagar `?` solitários** (mais conservador).

Pedir decisão de Junior no início. NÃO commitar nem restartar bot sem aprovação.

---

## BLOCO 5 — E2E REAL Viviane (depende dela estar disponível)

Já agendado pra Quinta 28/05.
- Viviane manda briefing pelo Telegram dela (chat_id 7755709957)
- Esperado: `_brio_detectar_e_despachar` detecta + Edge v10 dispatch + card SHADOW chega no chat DELA
- Viviane aprova → status `enviada` + handler V2 funciona

Validação SQL:
```sql
SELECT id, contexto->>'notify_chat_id' AS notify, contexto->>'store_name', status, created_at 
FROM ai_requests WHERE tipo='briefing_beira_rio_shadow' 
  AND contexto->>'notify_chat_id' = '7755709957' 
ORDER BY created_at DESC LIMIT 5;
```

---

## BLOCO 6 — Decisão UPDATE 1255 stores sem cliente_id (~20 min, INLINE)

Pedir DECISÃO de Junior:
- Aplicar UPDATE em massa vinculando `cliente_id = 'af166ada-e01b-4197-b8c3-33410af325d1'` (CALCADOS BEIRA RIO S/A)?
- OU criar uma migration de checagem caso-a-caso (mais seguro mas mais lento)?

Se aprovar batch:
- Migration `20260528_link_stores_cliente_beira_rio.sql`:
  ```sql
  UPDATE stores
  SET cliente_id = 'af166ada-e01b-4197-b8c3-33410af325d1'
  WHERE cliente_id IS NULL
    AND code ~ '^\d{4,7}-\d{1,3}$'
    AND deleted_at IS NULL;
  ```
- Apply + validar count
- Commit + push

Após esse fix, dá pra backfillar 15 propostas pre-v10 sem store no snapshot (BLOCO 7).

---

## BLOCO 7 — Backfill propostas pre-v10 sem store (~15 min, INLINE)

Depende do BLOCO 6.

```sql
UPDATE propostas p
SET config_snapshot = coalesce(config_snapshot, '{}'::jsonb) || jsonb_build_object(
  'store', (
    SELECT to_jsonb(s) - 'cliente_id' - 'deleted_at' 
    FROM stores s 
    WHERE s.cliente_id = p.cliente_id 
    LIMIT 1
  )
)
WHERE created_at > NOW() - INTERVAL '90 days'
  AND p.cliente_id = 'af166ada-e01b-4197-b8c3-33410af325d1'
  AND (config_snapshot IS NULL OR NOT (config_snapshot ? 'store'));
```

Validar quantas linhas afetadas + smoketest portal /p/:token.

---

## BLOCO 8 — Padronizar tipos p_token nas RPCs portal (~15 min, INLINE)

Inconsistência detectada no recon:
- `portal_aprovar_item(p_token uuid, ...)` e `portal_aprovar_proposta(p_token uuid, ...)` usam UUID
- `portal_get_proposta(p_token TEXT)`, `portal_atualizar_cliente(p_token TEXT)`, `portal_inserir_mensagem(p_token TEXT)`, `portal_listar_mensagens(p_token TEXT)` usam TEXT

Decisão sugerida: padronizar tudo como `TEXT` (front passa string mesmo, evita cast). Migration cirúrgica.

⚠️ Verificar callers do front primeiro — se algum hook depende do tipo, ajustar conjunto.

---

## BLOCO 9 — JARVIS-T15 validador anti-alucinação (fila — não fazer)

Já documentado no aprendizado da Claudete (2026-05-27-claudete-alucinacao-agendamento-moto.md).
Anotar como pendência futura no STATE.md. Não bloqueia foco no CRM.

---

# ANTI-PATTERNS PROIBIDOS

❌ Centralizar trabalho na sessão principal (use agents)
❌ Parar pra "economizar tokens" sem ter tentado delegar
❌ `git add .` que arrasta arquivos não-finalizados
❌ Commit sem mensagem semântica
❌ Apply_migration sem `IF NOT EXISTS` / `IF EXISTS`
❌ Edit em arquivo grande sem backup prévio
❌ Restart de bot sem confirmar via log que subiu OK
❌ **ESCREVER TOKEN/SECRET COMPLETO em prosa, log, ou docs**
❌ Mexer em propostas reais sem cleanup explícito

# COMANDO INICIAL

1. Lê CLAUDE.md + STATE.md (entrada TARDE-2) — 30s
2. Pergunta a Junior o status das 3 ações manuais (#1 PAT / #2 Telegram / #3 storage policy)
3. Cria TaskList com blocos 1-8 (TaskCreate em paralelo)
4. Dispara BLOCO 1 (5 agents em paralelo, um por Edge) + BLOCO 2 (agent menor) + BLOCO 4 (agent recon git) em paralelo
5. Seguir ordem dos blocos baseado em prioridade (segurança primeiro)

# CRÍTICOS DE ARQUITETURA (lembrança)

- WhatsApp Croma = canal cliente (atendimento) + ENTRY Beira Rio via Viviane/Junior
- Telegram Claudete = comando-livre dono + ENTRY Beira Rio
- Portal Croma `/p/:token` = substitui Mubisys, 9 features novas
- Bot Python autônomo Anthropic API
- Ponte Cowork DESLIGADA em 22/05 — não reabilitar
- Mubisys = SaaS PHP externo, sem API, manual — objetivo APOSENTAR

---

Estou pronto. Pode arrancar perguntando o status das 3 ações manuais do Junior.
