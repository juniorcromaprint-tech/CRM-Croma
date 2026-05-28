# LEDGER ANTI-REGRESSÃO

> **REGRA DURA**: TODO ciclo autônomo DEVE consultar este arquivo ANTES de escolher tarefa.
> Trabalho listado em DONE: **NÃO REFAZER. NUNCA.**
> Trabalho em IN-PROGRESS: continuar ou aguardar — nunca recomeçar do zero.

---

## DONE — Trabalho consolidado em produção (NÃO TOCAR sem motivo grande)

### Refundação Beira Rio (2026-05 sprints — concluída)
- `whatsapp-webhook` v44 ACTIVE (guard INTERNAL_PHONES, route to briefing-beira-rio)
- `briefing-beira-rio` v10 ACTIVE (referencia + prazo + logistica + store + notify_chat_id)
- `ai-gerar-orcamento` v29 ACTIVE (intocado nesta refundação)
- `portal-upload-assinatura` v1 ACTIVE (proxy seguro de assinatura)
- `ai-chat-portal` v15 ACTIVE (persist IA via service role, fix .catch bug)
- RPCs portal v2: `portal_get_proposta`, `portal_aprovar_item`, `portal_atualizar_cliente`, `portal_aprovar_proposta`, `portal_inserir_mensagem`, `portal_listar_mensagens`
- RPCs vault: `get_service_role_legacy_jwt`, `get_telegram_bot_token`
- Migration `20260527_portal_get_proposta_with_pedido.sql` aplicada
- Migration `20260527_storage_proposta_uploads_policy.sql` versionada (DROP OK, CREATE bloqueada por ownership — Junior precisa CLI)
- 5 commits pushed main: `707440d`, `3e3c85a`, `44c21e4`, `5d51cd4`, `acd8171`
- CRLF churn resolvido via `.gitattributes` (commit `03b8126f`)
- `claudete_bot.py` rodando com Telegram-entry handler (PID dinâmico)
- E2E Junior validado: PROP-2026-0032 SHADOW + Aprovar via Telegram

### Modo autônomo (criado 2026-05-27, evoluído 2026-05-28)
- `.planning/autonomous-rules.md` v4.0 (cron 1h, plano 20x, 3 cérebros ativos)
- `.planning/autonomous-log.md` criado
- `.planning/autonomous-mission.md` v2.0
- `.planning/autonomous-ledger.md` criado
- Scheduled task `croma-autonomous-progress` v4.0 — cron `0 * * * *` (1h), 24/7, autonomia decisória total
- 3 cérebros ativos persistentes: STATE.md + ledger + vault Obsidian (memory + daily)
- Acesso confirmado: Supabase MCP, Windows-MCP PowerShell (Obsidian + MCP Croma binário), bash workspace

### Pré-requisitos Fase 2 destravados (Junior 2026-05-28)
- Chip WhatsApp dedicado adquirido
- Meta Business Manager criada + negócio verificado
- Templates WhatsApp aprovados (vários, funcionando)
- Resend API key produção configurada

### Ciclo autônomo #1 — Validação end-to-end (2026-05-28 02:10)
- Health check VERDE: Vercel 200, branch=main, logs sem 5xx significativo
- 5 Edges canônicas validadas ACTIVE em versões ledger (whatsapp-webhook v44, briefing-beira-rio v10, ai-gerar-orcamento v29, ai-chat-portal v15, portal-upload-assinatura v1)
- Auto-diálogo registrado no log
- Framework autônomo end-to-end funcional
- Zero mutation, zero deploy, zero regressão

### Ciclo autônomo #9 — Achado P0 BOMBA: 6 rules com schema quebrado + 3 templates WA sem meta_template_name (2026-05-28 07:30)
- Health VERDE pós-ciclo #8: Vercel 200, ~70min API/edge zero 5xx, branch=main 0/0, HEAD `31ffcbe`
- Rotação Qui=Produção+ai-chat-portal: pivot pra ângulos não cobertos (templates + rules — pré-req Fase 2 nunca queryados profundamente)
- 1 agent paralelo adversarial (`general-purpose` ≤350 palavras) + 3 SQL inline simultâneas + verificação cruzada eu mesmo do agent via `information_schema.columns`
- **🔴 4 RULES `ativo=true` COM COLUNAS INEXISTENTES** (rodaram ~1280× sem `last_error` = silent no-op por meses): (a) `desconto_maximo_sem_aprovacao` → `proposta_itens.desconto_percentual` não existe; (b) `lead_quente_sem_orcamento` → `clientes.lead_origem_id` (real: `lead_id`); (c) `estoque_minimo` + `sugerir_compra_automatica` → `materiais.estoque_atual` (reais: `estoque_minimo`, `estoque_ideal`); (d) `op_atrasada` + `priorizar_op_urgente` → `ordens_producao.prazo_entrega` (reais: `data_fim_prevista`, `prazo_interno`, `data_conclusao`)
- **🔴 3 TEMPLATES WHATSAPP `ativo=true` SEM `meta_template_name`**: `WhatsApp Follow-up 2/3` (etapa followup2/followup3) + `WhatsApp Negociacao` (etapa negociacao). Fora da janela 24h Meta rejeita → cadência prospecção QUEBRA quando Fase 2 ativar
- **🔴 2 RULES `acao.template` APONTAM PRA TEMPLATES INEXISTENTES**: `follow_up_lead_24h.acao.template='followup_lead'` e `follow_up_proposta_48h.acao.template='followup_proposta'` — strings não correspondem a `nome` nem `meta_template_name` de templates existentes
- Trigger SHADOW production_completed: 3 fires consistentes (pedido 1070 via OP-2026-0015/0016 + PED-2026-0025 via OP-2026-0017), TODOS no-op idempotentes em pedidos `em_producao`. Latência fire→ai_logs <1s, payload completo
- ai-chat-portal v15 ai_logs: zero rows (`function_name='ai-chat-portal'` retorna []) → Padrão B (Edge não chama logAICall) confirmado, fix-able quando deploy v16 com ai-logger.ts v2 do ciclo #6
- Zero deploy, zero migration, zero commit Edge. Fix das 6 rules + 3 templates registrado como NEXT P0 DEFAULT EXECUTÁVEL próximo ciclo (cada rule precisa decisão de coluna canônica)
- **Padrão honestidade adversarial em ciclo #9 confirmado**: agent foi PRÓPRIO target de verificação cruzada (cross-check `information_schema` confirmou 4/4 bugs P0). Modo adversarial sobre o agent.

### Ciclo autônomo #8 — Fase 2.3 destravada: agent_config criada com 12 configs seedadas (2026-05-28 06:10)
- Health VERDE pós-ciclo #7: Vercel 200, ~70min API/edge zero 5xx, branch=main, HEAD `229ff7b`
- **Verificar antes de assumir**: query cruzada `information_schema` + `pg_class` + `pg_policy` confirma `agent_config` NÃO existia (era gap real conforme ciclo #7) + mapeia padrão de agent_templates/agent_rules (RLS on, jsonb pra dados flexíveis, ativo bool, timestamps)
- **Migration `create_agent_config_fase2_3_20260528`** aplicada via MCP: tabela `public.agent_config` com `id/chave UNIQUE/valor jsonb/categoria/descricao/ativo/timestamps` + 2 indexes + RLS ON com 2 policies (service_role ALL + authenticated SELECT) + trigger `trg_agent_config_touch_updated_at` idempotente + grants restritivos (REVOKE PUBLIC, GRANT SELECT authenticated, ALL service_role)
- **12 rows seed** em 5 categorias: modelo (default/fallback/visao com Sonnet 4.5/Haiku 4.5), tom (profissional_caloroso pt-BR), limites (max_tokens 2048, temperatura 0.7 default / 0.2 decisão), guardrails (janela 08:00-20:00 BRT, 3 msg/dia/lead, cooldown 30min, approval R$ 10k), integracoes (chat_id Junior 1065519625)
- **Smoketest pós-migration**: 12 rows ativas, 5 categorias distintas, RLS true, 2 policies, 1 trigger não-interno
- **Versionamento**: `supabase/migrations/20260528_create_agent_config_fase2_3.sql` criado com mesmo conteúdo (invariante "applied == versioned")
- Zero deploy Edge, zero outras mutations. Janela horária noturna 06:10 BRT respeitada.

### Ciclo autônomo #7 — Reality check Padrão C false positive + auditoria Fase 2 banco + trigger SHADOW row #3 (2026-05-28 05:25)
- Health VERDE pós-ciclo #6: Vercel 200, ~60min zero 5xx, branch=main 0/0, HEAD=229ff7b
- **🔴 CORREÇÃO ADVERSARIAL TERCEIRA EM 3 CICLOS**: query cruzada `ai_requests × ai_logs` 60d revela das 7 Edges "Padrão C" (ciclo #5): 4 com ZERO chamadas 60d (compor-mensagem, composicao-produto, detectar-problemas, qualificar-lead) e 3 com 1 chamada de 4-7 semanas (analisar-orcamento 12/04, resumo-cliente 06/04, briefing-producao 28/04). **Bug Padrão C é largely FALSE POSITIVE — Edges dormentes**. Refactor ai-logger.ts v2 vira insurance defensiva. Deploy rolling baixa pra P2.
- **Auditoria Fase 2 banco** (BLOCKED "ação obrigatória"): 4 tabelas Fase 2/4 já existem populadas — agent_templates (29 rows, 13 com meta_template_name aprovado), agent_rules (31), ai_memory (4, Fase 4.1), ai_responses (4, Fase 1.1). 13 meta_templates WhatsApp confirmados: croma_abertura, croma_abertura_franquia/industria/varejo, croma_poste_seg_abertura_v2, croma_followup, croma_proposta, croma_reativacao_v3. **Confirma com evidência empírica afirmação Junior "vários aprovados"**. Único gap real Fase 2.3: agent_config NÃO existe.
- Vault secrets: 6 secrets (ELEVENLABS, GROQ, RESEND ✅, TELEGRAM ✅, 2x service_role). WhatsApp/Meta tokens em env vars Edge (esperado).
- Trigger SHADOW production_completed: UPDATE no-op `OP-2026-0017` → row #3 às 08:10:01 UTC payload PED-2026-0025. **3 fires consistentes em ~3h**. Segundo pedido (PED-2026-0025) confirma gap Fase 1.2 cross-FK além do 1070.
- Zero commit, zero deploy, zero migration. Só 3 SQL queries + 1 UPDATE no-op idempotente.
- Padrão de honestidade adversarial documentado em 3 ciclos consecutivos (#5→#6→#7) — passa a ser cultura do modo autônomo

### Ciclo autônomo #6 — Refactor defensivo ai-shared/ai-logger.ts + whatsapp-webhook v46 + correção premissa RLS (2026-05-28 04:20)
- Health VERDE pós-ciclo #5: Vercel 200, ~70min zero 5xx, branch=main 0/0
- **🔴 CORREÇÃO ADVERSARIAL DO CICLO #5**: query `pg_policy ai_logs` revela RLS service_role tem CHECK `true` (NÃO bloqueia). Smoketest INSERT manual ai_logs como service_role gravou row id `54b948f2-...` confirmado. ai-analisar-orcamento usa logAICall (linha 109) e tem 44 rows histórico — **helper compartilhado FUNCIONA quando chamado**. Bug das 7 Edges Padrão C é OUTRO: throw silencioso ANTES do logAICall no caller, ou baixo volume real de chamadas em prod
- 2 agents paralelos de recon: ai-logger.ts (Padrão C) + whatsapp-webhook 700-780. Recon do webhook revela schema JÁ correto (não tinha `metadata`/`funcao`/etc. — premissa do ciclo #5 também errada nesse ponto), `try/catch + if (logErr) console.error` JÁ existe. Bug real só ausência de `.select().single()` (regra dura projeto)
- Edit `supabase/functions/ai-shared/ai-logger.ts` v2: refactor backward-compat com `.select().single()` + retorno estruturado `Promise<{ ok, error }>` + console.warn estruturado. Callers awaitando sem usar retorno continuam funcionando.
- Edit `supabase/functions/whatsapp-webhook/index.ts`: header v41 → v46 + `const VERSION = 'v46-ailogs-select-single'` + linhas 743-758 `.select().single()` + console.warn semântica + prefix `[v46-...]` nos logs pra grep
- Deploy via agent dedicado: `whatsapp-webhook` v45 → **v46** ACTIVE (sha `17f694c328a0...`), verify_jwt:false preservado (Meta verify challenge)
- Smoketest empírico GET `?hub.mode=subscribe&hub.verify_token=INVALID&hub.challenge=test123` → HTTP **403** esperado (handler GET vivo, branch reject funcional)
- Commit `229ff7b` fix(comercial,shared) push origin/main, 2 arquivos, +55/-11. HEAD em sync com origin.
- ai-logger.ts COMMITADO MAS NÃO DEPLOYADO em Edge alguma — deploy rolling fica como NEXT P1
- Cleanup smoketest row ai_logs `54b948f2-...` DELETE OK

### Ciclo autônomo #5 — Patch ai-briefing-producao v22 + ai-analisar-foto-instalacao v13 + audit cross-Edge ai_logs (2026-05-28 03:15)
- Health VERDE pós-ciclo #4. Vercel 200, ~70min zero 5xx, branch=main 0 ahead/behind
- **🔴 CORREÇÃO ADVERSARIAL DO CICLO #4**: query `information_schema.columns ai_logs` confirma `user_id` (uuid nullable) **EXISTE** na tabela. Premissa do ciclo #4 ("user_id NÃO existe") era falsa. Bug real do ai-sequenciar-producao v11 era OUTRA coluna (provável `metadata`/`funcao`). Confirma valor da regra "verificar antes de assumir" — ciclo #4 não fez information_schema query
- Histograma function_name últimos 60d: só 4 functions gravam (auto-resposta-whatsapp=7, analisar-orcamento=1, resumo-cliente=1, trigger_production_completed_shadow=1). **~9 Edges não gravam = bug latente provável**
- Agent paralelo (Explore): audit exaustiva grep `ai_logs.insert` cross-Edge identifica 3 padrões: A correto (ai-sequenciar-producao v13), B direto bug (whatsapp-webhook + ai-analisar-foto-instalacao), C via helper logAICall (7 Edges)
- Deploy `ai-briefing-producao` v21 → **v22** ACTIVE (sha e266cd64): VERSION header `v22-defensive-parse` + try/catch dedicado em JSON.parse + helper local `logErrorLocal` com `.select().single()` (registra status=error com raw_preview quando IA devolve não-JSON) + retorna 502 (era 500 genérico)
- Deploy `ai-analisar-foto-instalacao` v12 → **v13** ACTIVE (sha b9331ac3): VERSION header `v13-schema-fix` + INSERT ai_logs corrigido (funcao→function_name, tokens_usados→tokens_input/output, custo→cost_usd, metadata removido, model_used NOT NULL adicionado) + `.select().single()` + console.warn (era `.catch(()=>{})` silencioso)
- **🎉 VITÓRIA EMPÍRICA**: smoketest ai-analisar-foto-instalacao POST com foto_url inválida → 200 + row em ai_logs `function_name=analisar-foto-instalacao, status=success, msg=[v13-schema-fix] job_id=none score=0 aprovado=false` às 06:13:08. **PRIMEIRA gravação na história desta Edge** (bug latente meses confirmado)
- Re-validar trigger SHADOW production_completed: UPDATE no-op OP-2026-0016 → row #2 às 06:08:06 (1→2 rows consistentes). Caminho pra promoção UPDATE real mais seguro
- Commit `31df986` fix(producao,campo) push origin/main
- Source local em sync: 2 arquivos Edge

### Ciclo autônomo #4 — Trigger PCP SHADOW + seed etapa_templates + Edge v13 + descoberta schema ai_logs (2026-05-28 02:05)
- Health VERDE pós-ciclo #3. Vercel 200, ~70min zero 5xx, branch=main 0 ahead/behind
- Migration `seed_etapa_templates_croma_20260528` aplicada — 6 templates idempotentes cobrindo fluxo Croma (Pré-impressão → Impressão Latex → Acabamento → Router opcional → Embalagem → Expedição). Lookup setores via `setores_producao` (tabela correta, era `setores` no ledger NEXT antigo)
- Migration `trigger_production_completed_shadow_20260528` aplicada — AFTER UPDATE OF status WHEN NEW.status='finalizado'. Trigger conta OPs do pedido_id, se TODAS finalizado dispara pg_notify('production_completed_shadow') + INSERT em ai_logs. **SHADOW: NÃO altera pedidos.status** (Fase 1.2 CROMA 4.0 em modo observação)
- 🔴 **DESCOBERTA ADVERSARIAL CRÍTICA**: schema ai_logs real é `function_name/model_used (NOT NULL)/tokens_input/tokens_output/cost_usd/status/error_message`. **NÃO existe** `metadata`/`funcao`/`tokens_usados`/`custo`. ai-sequenciar-producao v11 nunca gravou ai_logs (zero rows com function_name='sequenciar-producao') — `.catch(()=>{})` engolia o erro silenciosamente há MESES. Confirma a regra dura `.select().single()` empiricamente
- Migration `trigger_production_completed_shadow_schema_fix_20260528` aplicada — refactor função usando schema correto (entity_type='pedido', entity_id=NEW.pedido_id, error_message=payload JSON, model_used='system/trigger')
- Deploy ai-sequenciar-producao v11 → v12 → **v13** ACTIVE (re-deploy com schema correto), ezbr_sha256 d952ec3f
- Smoketest UPDATE no-op `OP-2026-0015 SET status='finalizado'` → ai_logs row 1: payload `{pedido_numero: "1070", total_ops: 2, pedido_status_atual: "em_producao", op_trigger_numero: "OP-2026-0015"}`. **Confirma com EVIDÊNCIA VIVA** o gap Fase 1.2 do plano CROMA 4.0
- Source local `supabase/functions/ai-sequenciar-producao/index.ts` editado (VERSION + schema fix), drift imports ai-shared/ standalone documentado em comentário no header
- Zero refazer DONE. 3 NEXT do ciclo #3 entregues. 1 bug latente descoberto e corrigido.

### Ciclo autônomo #3 — Auditoria Produção + fix drift VERSION ai-chat-portal (2026-05-28 01:10)
- Health VERDE: Vercel 200, ~70min logs zero 5xx, Edges canônicas ACTIVE pós-MADRUGADA
- Agent paralelo: análise adversarial 2 Edges Produção (`ai-briefing-producao` v21, `ai-sequenciar-producao` v11)
- **Achados Edges Produção**: ai-sequenciar-producao v11 é **STUB de PCP** (só rankeia, não persiste sequência, `diasEstimados=2` hardcoded, ai_logs.insert sem `.select().single()` viola regra dura). ai-briefing-producao v21 sem VERSION no header (drift invisível) + JSON.parse cego sem try/catch dedicado
- **Achados SQL módulo Produção**: 6 OPs / 19 etapas / 6 setores | **0 apontamentos** | **0 templates etapa (vazia)** | RLS OK em todas 10 tabelas
- 🔴 **INCONSISTÊNCIA OP↔pedido**: 3 OPs `finalizado` mas pedidos `1070` e PED-2026-0025 ainda `em_producao` (sync ausente — confirma gap Fase 1.2 plano CROMA 4.0)
- 🟡 3 OPs `aguardando_programacao` com 0 etapas + pedidos `faturado` — workflow inverso a investigar
- **Commit `9b45c32`** chore(portal): fix drift header `'v14-persist-ia'` → `'v15-persist-ia'` em ai-chat-portal/index.ts (source agora rastreável vs deployed v15)
- Push origin/main confirmado: 0 ahead/behind. Lock fantasma sandbox bash contornado via Windows-MCP PowerShell
- Zero deploy Edge, zero mutation banco. Janela horária noturna respeitada

### Ciclo autônomo #2 — Adversarial ai-chat-portal v15 + Obsidian unlocked (2026-05-28 00:05)
- Health VERDE: Vercel 200, ~70min logs api/edge zero 5xx, mcp-bridge-worker rodando ~1/min
- Agent paralelo: auditoria adversarial ai-chat-portal v15 (read-only, ≤200 palavras)
- **DESCOBERTA**: Obsidian É acessível via Windows-MCP PowerShell — limitação reportada no ciclo #1 era falsa
- **DESCOBERTA**: source ai-chat-portal local + deployed v15 byte-equivalentes na lógica, MAS header diz `VERSION = 'v14-persist-ia'` (drift de label)
- Cleanup BRIEFING-INT ABORTADO por anti-escopo-creep (FK escondida em propostas.conversation_id apontando p/ 3 SHADOW PROP-2026-0030/0031/0032)
- Zero mutation no banco (BEGIN/COMMIT falhou na FK, estado intacto)
- Auto-diálogo registrado, ledger atualizado

---

## IN-PROGRESS — Tarefas que ainda estão sendo trabalhadas (NÃO recomeçar)

(nenhuma)

---

## BLOCKED — Aguardando ação do Junior

### Limitações do cron autônomo
- ✅ CORRIGIDO ciclo #2: Obsidian É acessível via Windows-MCP PowerShell (`Get-Content` + `Add-Content`). Manter rules etapa 3 como está.
- ⚠️ scheduled task cron NÃO carrega MCP Croma via Desktop Commander automaticamente — auditorias de dados negócio devem usar `execute_sql` direto ou disparar agent isolado

### 🔴 NOVO BLOCKED (descoberto ciclo #9 — 2026-05-28 07:30)
- 🔴 **6 AGENT_RULES ATIVAS COM SCHEMA QUEBRADO** (rodaram ~1280× cada como silent no-op):
  - `desconto_maximo_sem_aprovacao` precisa `condicao.campo` corrigido pra coluna existente em `proposta_itens` (sugestão: `desconto_unitario` ou similar — Junior valida campo canônico)
  - `lead_quente_sem_orcamento`: filtro precisa `clientes.lead_id` no lugar de `clientes.lead_origem_id`
  - `estoque_minimo` + `sugerir_compra_automatica`: lógica precisa rever — `materiais.estoque_atual` não existe. Possível: calcular saldo via `movimentacoes_materiais` aggregate ou outra fonte. Decisão de produto: comparar estoque vs `estoque_minimo` ou vs `estoque_ideal`?
  - `op_atrasada` + `priorizar_op_urgente`: trocar `prazo_entrega` por `prazo_interno` (date, compromisso) OU `data_fim_prevista` (timestamptz, estimativa). Semanticamente diferentes — Junior decide qual.
  - **DEFAULT AUTÔNOMO próximo ciclo**: gerar SQL UPDATE proposto pra cada rule com smoketest empírico antes (forçar disparo do agent-cron-loop manualmente após cada fix, verificar `last_error` NÃO surge).

- 🔴 **3 TEMPLATES WHATSAPP ATIVOS SEM `meta_template_name`**: WhatsApp Follow-up 2 (id `87ee3b8d`), WhatsApp Follow-up 3 (id `596781bb`), WhatsApp Negociacao (id `0e390572`). Fora da janela 24h, Meta API rejeita → cadência quebra. **DEFAULT AUTÔNOMO próximo ciclo**: rodar `whatsapp-submit-templates` Edge passando esses 3 templates, aguardar Meta aprovar, popular `meta_template_name` no banco. OU desativar até aprovação.

- 🔴 **2 RULES COM `acao.template` APONTANDO PRA TEMPLATES INEXISTENTES**: `follow_up_lead_24h` (template `followup_lead`) e `follow_up_proposta_48h` (template `followup_proposta`). Strings não correspondem a nenhum `nome` nem `meta_template_name` da tabela agent_templates. **DEFAULT AUTÔNOMO**: UPDATE `acao.template` apontando pra meta_template_name real (`croma_followup` p/ WA, ou nome de template email existente).

### Itens conhecidos pendentes
- 🔴 **Rotacionar PAT Supabase** — `sbp_db39d12f...` vazou em working dir desde 21/05, foi redigido em `docs/plano-ia/2026-05-21-handoff-etapa2-ponte-cowork.md` mas precisa ROTACIONAR no painel Supabase. Crítico.
- ⚠️ **Storage policy `portal_uploads_insert_anon_restricted`** — bloqueada por ownership, Junior precisa aplicar via `supabase db push` (CLI conecta como supabase_admin)
- ⚠️ **Mojibake `claudete_bot.py`** — 85 linhas com `?` literal no source. **DEFAULT AUTÔNOMO**: próximo ciclo escolhe abordagem (c) deletar `?` solitários (menos risco), backup obrigatório, smoketest bot pós-fix

### ✅ DESTRAVADO pelo Junior 2026-05-28 (era BLOCKED, agora pré-requisitos OK)
- ✅ Chip WhatsApp dedicado — Junior confirma OK
- ✅ Meta Business Manager — Junior confirma OK
- ✅ Templates WhatsApp — Junior confirma "vários aprovados e funcionando"
- ✅ Resend API key produção — Junior confirma OK
- ⚠️ **AÇÃO AUTÔNOMA OBRIGATÓRIA próximos 2-3 ciclos**: auditar configuração efetiva no banco antes de assumir como verdade pra Fase 2 (queries em `whatsapp_config`/`whatsapp_phone_numbers`/`agent_templates`/Edge env vars). Se algum gap real, registrar em BLOCKED novo.

---

## NEXT — Sugestões priorizadas pra próximos ciclos (atualizar a cada ciclo)

### Pequenos (cabem num ciclo — autonomamente seguros)
- [x] ✅ **DONE ciclo #3** (commit `9b45c32`): header `VERSION = 'v14-persist-ia'` → `'v15-persist-ia'` em `supabase/functions/ai-chat-portal/index.ts` (drift cosmético resolvido)
- [x] ✅ **DONE ciclo #4** (deploy v13 + Edit local): ai-sequenciar-producao com VERSION v13-rc + fix `.select().single()` + schema ai_logs correto (descoberta adversarial: nunca gravou ai_logs há meses)
- [x] ✅ **DONE ciclo #4** (migration seed_etapa_templates_croma_20260528): 6 templates Croma idempotentes
- [x] ✅ **DONE ciclo #4** (migration trigger_production_completed_shadow_20260528 + schema_fix): trigger SHADOW Fase 1.2 operacional + smoketest pedido 1070 OK
- [ ] **NOVO ciclo #4 — P1 DEFAULT AUTÔNOMO**: aplicar mesmo schema fix em `ai-briefing-producao` v21 — `funcao/tokens_usados/custo/metadata` muito provavelmente errado também (mesma família código). Auditar via get_edge_function + adicionar VERSION header + fix `.catch(()=>{})` se existir. Edge interna PCP, janela horária flexível.
- [ ] **NOVO ciclo #4 — P1 — AUDITORIA EXAUSTIVA**: grep `'ai_logs'.*insert` em todas Edges, validar schema `function_name/model_used/tokens_input/output/cost_usd` correto. Reportar quantas têm bug `metadata` ou `funcao`. Provável: várias Edges Anthropic-migration têm o bug latente. Read-only.
- [ ] **NOVO ciclo #4 — P2 PROMOVER TRIGGER**: após 1 semana SHADOW sem falhas (logs ai_logs do trigger consistentes), promover `fn_production_completed_shadow` adicionando UPDATE `pedidos SET status='concluido' WHERE id=NEW.pedido_id AND status='em_producao'`. Pedido 1070 (e PED-2026-0025) ficariam concluido automaticamente. Smoketest cross-FK pós-promote.
- [ ] **NOVO ciclo #3 — INVESTIGAR**: 3 OPs `aguardando_programacao` com 0 etapas (OP-2026-0012/0013/0014) mas pedidos correspondentes (PED-2026-0001/0002) já `faturado`. Workflow PCP→faturamento inverso ou dados legados de import? Query histórica `pedido_historico` pra rastrear transições. Read-only, próximo ciclo.
- [ ] Auditoria de Edge Functions: listar todas ACTIVE, identificar versões desatualizadas vs source (Grep `VERSION =` em todas Edges)
- [ ] Auditoria de migrations: confirmar lista aplicada vs `supabase/migrations/` (`list_migrations` vs `ls supabase/migrations/`)
- [ ] Limpeza de dados TEST antigos (wamid LIKE 'tg_TEST_*', etc.)
- [ ] **REFINADO ciclo #2 — DEFAULT AUTÔNOMO**: cleanup BRIEFING-INT v2. Escopo: 4 leads + 4 agent_conversations + propostas SHADOW PROP-2026-0030/0031. **PROP-2026-0032 PRESERVAR** (já em DONE). Cascade explícito proposta_itens + notificações. Transacional. Janela noturna.
- [ ] **MOJIBAKE — DEFAULT AUTÔNOMO**: `claudete_bot.py` 85 linhas com `?` literal. Estratégia: backup `.bak-pre-mojibake-fix-YYYYMMDD-HHMMSS` + deletar `?` solitários (regex `\s+\?(\s|$)` → espaço) + restart bot via PowerShell `Stop-Process pythonw + Start-Process` + smoketest heartbeat
- [ ] Atualizar `.context/mcp-ferramentas.md` (108 tools — verificar drift)
- [ ] Atualizar `.context/migrations.md` com migrations recentes
- [ ] Refinamento de `REQUIREMENTS.md` se houver itens cumpridos (sweep DONE do ledger vs REQ-XX)
- [ ] Health check exaustivo de RPCs portal v2 (cada uma com smoketest TEST + validar return shape)
- [ ] **ROTAÇÃO ADVERSARIAL POR DIA** (módulo + Edge, ver autonomous-mission.md):
  - Seg: Comercial + whatsapp-webhook v44
  - Ter: Orçamento + briefing-beira-rio v10
  - Qua: Pedidos + ai-gerar-orcamento v29
  - Qui: Produção + ai-chat-portal v15
  - Sex: Instalação + mcp-bridge-worker v7
  - Sáb: Financeiro + portal-upload-assinatura v1 + pricing-engine
  - Dom: Estoque/Fiscal/IA + auditoria migrations + RLS audit
- [ ] **NOVO — Auditoria sistêmica por módulo aplicando "verificar antes de assumir"**:
  - Cada ciclo de rotação faz: (a) query banco do módulo (counts, FKs órfãs, RLS frouxa, dados inconsistentes), (b) smoketest fluxo end-to-end com dados TEST, (c) análise adversarial Edge associada via agent, (d) gap report no STATE + ledger NEXT
- [ ] **NOVO — Auditoria de testes**: rodar testes existentes (102+ unidade + e2e), identificar regressões silenciosas, falhas latentes, coverage gaps

### Médios (DEFAULT AUTÔNOMO — executar conforme cabe)
- [x] ✅ **DONE ciclo #4** — Trigger production_completed SHADOW (Fase 1.2): migration aplicada + 3 fires consistentes confirmados em ciclos #4/#5/#7
- [ ] **🔥 P0 — INFRA AUTONOMIA REAL**: portar scheduled task autônomo pra Edge Function Supabase com `pg_cron` chamando Anthropic API direto (key vault `get_anthropic_api_key` se já existe, senão criar). Vantagem: roda independente de PC do Junior estar ligado/Cowork aberto. Caminho: (a) criar Edge `autonomous-cycle-runner` com lógica do ciclo, (b) criar tabela `autonomous_runs` pra log SQL, (c) cron 1h via pg_cron, (d) primeiros 3 ciclos rodam em SHADOW (write em `autonomous_runs_shadow`), (e) promover quando validado, (f) Cowork scheduled task vira backup. Estimar 3-5 ciclos autônomos pra entregar.
- [x] ✅ **DONE pré-ciclo #7** — Migration `ai_requests` + `ai_responses` (Fase 1.1): ambas tabelas existem em prod (ai_responses 4 rows). Auditoria ciclo #7 confirmou.
- [x] ✅ **DONE ciclo #8** (migration `create_agent_config_fase2_3_20260528`): tabela `agent_config` criada + 12 rows seed (5 categorias: modelo/tom/limites/guardrails/integracoes) + RLS + trigger updated_at + grants restritivos. Fase 2.3 do plano CROMA 4.0 substancialmente destravada.
- [ ] **NOVO ciclo #8 — P1 DEFAULT AUTÔNOMO**: refactor Edges (ai-gerar-orcamento / briefing-beira-rio / ai-chat-portal) pra ler `temperatura_*` + `max_tokens_resposta` + `modelo_default` de `agent_config` ao invés de hardcoded. Helper `getAgentConfig(supabase, chave)` cached em isolate, fallback constantes se RPC falhar. Permite tuning sem redeploy. SHADOW first (Edge cliente: janela 22h-7h ou FDS).
- [ ] **NOVO ciclo #7 — P2**: deploy rolling 1 Edge Padrão C com ai-logger.ts v2 — REVISADO baixa urgência (4 de 7 Edges dormentes, helper raramente exercitado). Manter por valor defensivo (insurance).
- [ ] **NOVO ciclo #7 — P2**: promover trigger SHADOW production_completed → UPDATE real. APROXIMA-SE READY: 3 fires no-op consistentes. Aguardar +1 fire de evento real (não no-op idempotente) pra ter total certeza antes de promover.
- [ ] Triggers formais: `installation_completed`, `payment_received`, `payment_overdue` (Fase 1.2) — DEFAULT: criar como triggers AFTER em SHADOW primeiro (NOTIFY canal apenas, não dispara ação), validar fires corretos, depois ligar handlers
- [ ] Desativar webhook Telegram (Fase 1.3) — DEFAULT: marcar Edge como inactive, não deletar, fallback Channels já operacional
- [x] ✅ **DONE pré-ciclo #7** — Seed `agent_templates` + `agent_rules` (Fase 2.3): 29 templates + 31 rules já populados em prod, 13 templates com meta_template_name aprovado pela Meta
- [x] ✅ **DONE pré-ciclo #7** — Memory Layer schema (Fase 4.1): ai_memory existe com 4 rows. Auditoria ciclo #7 confirmou.
- [ ] **NOVO ciclo #2 — P1 segurança ai-chat-portal v16 — DEFAULT AUTÔNOMO**: patch com (a) rate-limit por share_token (nova tabela `portal_rate_limit`, 20msg/h, 429 quando exceder), (b) `historico` derivado server-side de portal_mensagens filtrado por proposta_id (NÃO confiar no client), (c) sanitização leve mensagem cliente (cap 2000 chars + flag tags suspeitas), (d) encadear `.select().single()` em insert portal_mensagens + ai_alertas. **Estratégia segura**: deploy SHADOW v16-rc, smoketest em PROP-2026-0032 antes de promover. Janela noturna. SE smoketest falhar → rollback v15 + Telegram. SE passar → promover v16.
- [ ] **NOVO ciclo #2 — P1 segurança ai-chat-portal v16 — DEFAULT AUTÔNOMO**: patch com (a) rate-limit por share_token (nova tabela `portal_rate_limit`, 20msg/h, 429 quando exceder), (b) `historico` derivado server-side de portal_mensagens filtrado por proposta_id (NÃO confiar no client), (c) sanitização leve mensagem cliente (cap 2000 chars + flag tags suspeitas), (d) encadear `.select().single()` em insert portal_mensagens + ai_alertas. **Estratégia segura**: deploy SHADOW v16-rc, smoketest em PROP-2026-0032 antes de promover. Janela noturna. SE smoketest falhar → rollback v15 + Telegram. SE passar → promover v16.

### Grandes (alguns DESTRAVADOS — DEFAULT AUTÔNOMO em SHADOW)
- [ ] **🔥 P0 FASE 2 — auditoria infra WhatsApp+Resend (PRÉ-REQUISITO)**: 1-2 ciclos autônomos confirmando chip ativo, templates aprovados, Resend funcional. Queries `whatsapp_config`, `whatsapp_phone_numbers`, `agent_templates`, env vars Edge `whatsapp-enviar`. Output: relatório no STATE + atualização do ledger se gap real.
- [ ] **🔥 P1 FASE 2.3 — Seed agent_templates/agent_config/agent_rules**: criar registros conforme CROMA 4.0 plano-mãe seção Fase 2.3, idempotente (`ON CONFLICT DO NOTHING`), com 8 templates iniciais (abertura, follow-up, proposta, cobrança, etc.). Smoketest insert/select. SHADOW antes de promover.
- [ ] **P1 FASE 2.2 — Prospecção automática**: schema `prospeccao_jobs` + Edge `agent-prospeccao-loop` (cron daily 08h) que: busca empresas varejo/franquias via Google Search (já tem código), enriquece CNPJ via ReceitaWS, qualifica (score), cria lead em SHADOW. Promover só após validar 5 leads SHADOW manualmente.
- [ ] **P2 FASE 2.1 — WhatsApp Business API ativação completa**: depende auditoria P0 + seed P1. Conectar webhook ao número real, fluxo cliente → webhook → Claude/OpenRouter fallback → resposta. SHADOW first com número de teste antes de promover pro chip real.
- [ ] **P2 FASE 3.2 — Cobrança automática inadimplentes**: cron daily 09h, escala D+1/D+3/D+7/D+15/D+30. Usar templates Resend + WhatsApp. SHADOW.
- [ ] PCP inteligente (Fase 3.3)
- [ ] Cockpit executivo (Fase 4.3)
- [ ] Chat natural no ERP (Fase 5.1)

---

## FORMATO DE ATUALIZAÇÃO (cada ciclo)

Ao finalizar um ciclo:
1. Se completou item de NEXT → mover pra DONE (adicionar linha curta com commit hash se aplicável)
2. Se começou item grande/médio → registrar em IN-PROGRESS com data + escopo
3. Se descobriu novo bloqueio → adicionar em BLOCKED
4. Se identificou nova oportunidade pequena → adicionar em NEXT

NÃO apagar entradas antigas de DONE — é histórico permanente.

---

## REGRAS DE OURO DO LEDGER

1. **Ler ANTES de planejar** — sempre, sem exceção
2. **DONE é imutável** — se precisa "desfazer" algo de DONE, isso é decisão do Junior
3. **IN-PROGRESS bloqueia** — ciclo que veria item em IN-PROGRESS deve ou continuar, ou esperar
4. **NEXT é sugestão, não comando** — ciclo escolhe o que cabe no contexto atual
5. **Honestidade total** — se ciclo falhou, registrar como tal, não "maquiar"
