# Eliminar OpenRouter — drop-in para Anthropic API direto

> **Criado**: 2026-05-21 manhã | **Para executar**: Claude Code CLI modo autônomo
> **Decisão**: Junior virou em 21/05 manhã (sessão Cowork anterior dizia "manter por enquanto" mas mudou após auditoria do CLI que confirmou: falha transitória do OpenRouter foi a causa raiz dos no-replies do webhook). OpenRouter é o intermediário desnecessário que está falhando — eliminar.

---

## Por que migrar agora

1. **Causa raiz confirmada do problema do agente WhatsApp**: chamada `callOpenRouter` em `generateClaudeResponse` retorna `null` em falhas transitórias do OpenRouter. Eliminar o intermediário reduz superfície de falha.
2. **Modelo final será o mesmo** (`claude-sonnet-4`), só sem intermediário. Anthropic API direto = 1 ponto de falha em vez de 2.
3. **Drop-in já existe**: `supabase/functions/ai-shared/anthropic-provider.ts` exporta `export const callOpenRouter = callAnthropic` na linha 93. Trocar `import` em quase tudo. O webhook v35 fez **inline** do código provider — esse precisa de tratamento especial (substituir a função inline pela chamada Anthropic).
4. **`ANTHROPIC_API_KEY` já configurada** nos secrets do Supabase (Claudete usa). Validar saldo antes.

---

## Escopo gradual (3 ondas)

### Onda 1 (CRÍTICA, primeira a migrar) — 2 funções
- `whatsapp-webhook` — coração do agente inbound (versão deployada: v35, inlined; repo synced em 7f43b44)
- `ai-gerar-orcamento` — chamada PELO webhook quando detecta intent de orçamento

### Onda 2 (alto uso) — 3 funções
- `ai-qualificar-lead`
- `ai-compor-mensagem`
- `ai-detectar-intencao-orcamento`

### Onda 3 (botões do ERP, uso baixo) — 6 funções
- `ai-analisar-orcamento`
- `ai-resumo-cliente`
- `ai-briefing-producao`
- `ai-detectar-problemas`
- `ai-composicao-produto`
- `ai-classificar-extrato`

**Total**: 11 funções migradas + provider deprecado + secret rotacionado.

---

## Estratégia técnica por tipo de arquivo

### Tipo A — Edge Functions que importam `openrouter-provider.ts`
Trocar import de:
```ts
import { callOpenRouter, setFallbackModel } from '../ai-shared/openrouter-provider.ts';
```
para:
```ts
import { callOpenRouter, setFallbackModel } from '../ai-shared/anthropic-provider.ts';
```
O `anthropic-provider.ts` exporta `callOpenRouter = callAnthropic` (drop-in alias). **Zero outras mudanças** no chamador, exceto:
- `setFallbackModel` não existe no anthropic-provider — verificar uso e remover se trivial, ou adicionar export no provider.
- Modelos OpenRouter (`anthropic/claude-sonnet-4`, `openai/gpt-4.1-mini`) mapeiam pra Anthropic via `MODEL_MAP` interno do anthropic-provider.

### Tipo B — Edge Functions que fizeram inline do provider (como `whatsapp-webhook` v35)
Inline foi feito linha 92-188 do `whatsapp-webhook/index.ts` synced. Estratégia:
1. **Não voltar a importar** (deploy single-file ainda é desejado pelo time).
2. **Reescrever a função `callOpenRouter` inline** pra chamar Anthropic direto:
   - URL: `https://api.anthropic.com/v1/messages`
   - Headers: `x-api-key: ANTHROPIC_API_KEY`, `anthropic-version: 2023-06-01`
   - Body: `{model, max_tokens, temperature, system, messages: [{role:'user', content: userPrompt}]}`
   - Resposta: `data.content[0].text` em vez de `data.choices[0].message.content`
   - Usage: `data.usage.input_tokens` / `data.usage.output_tokens` (não `prompt_tokens` / `completion_tokens`)
3. Manter o NOME `callOpenRouter` por enquanto pra evitar churn — só trocar o corpo.
4. Atualizar `CLAUDE_MODEL` constante de `'anthropic/claude-sonnet-4'` pra `'claude-sonnet-4-20250514'` (ID Anthropic direto).
5. Remover o `setFallbackModel(FALLBACK_MODEL)` ou trocar pra Haiku se quiser fallback (`'claude-haiku-4-5-20251001'`).

### Hardening adicional ENQUANTO migra (aproveitar a janela)
Ainda no `whatsapp-webhook`:
- **Registrar erro quando IA retornar null** (achado #2 do relatório do CLI). Hoje só notifica Telegram. Criar registro `agent_messages` com `direcao='enviada'`, `status='erro'`, `erro_codigo='IA_NULL'`, `erro_mensagem='IA não gerou resposta'`.
- **Corrigir RLS `ai_logs`** (achado #1). Policy `service_role_insert_logs` está aplicada a `{public}` em vez de `service_role`. Adicionar policy correta.
- **NÃO mexer no hardcoded `status='respondida'` do inbound** (rótulo enganoso, mas mexer pode quebrar consumidores downstream — fora do escopo desta migração).

### Limpeza final (Fase 7)
- Deprecar `supabase/functions/ai-shared/openrouter-provider.ts` (renomear pra `.deprecated.ts` ou deletar)
- Remover `OPENROUTER_API_KEY` dos secrets das Edge Functions
- Revogar a chave no painel openrouter.ai
- Remover entrada `OPENROUTER_API_KEY` da `admin_config` (estava marcada como risco em security-audit 2026-03-24)
- Atualizar `MAPA-IA-CROMA.md`, `.context/arquitetura.md`, etc.

---

## Pré-checks obrigatórios (Fase 0)

1. **Saldo ANTHROPIC_API_KEY** — verificar via curl Claude API que retorna sucesso e checar dashboard Anthropic. Estimar custo diário: webhook v35 tem latência 14-20s, ~2k tokens/chamada × Sonnet 4 ($3/M input, $15/M output) → ~$0,033 por mensagem inbound. 100 mensagens/dia = $3,30/dia = $99/mês.
2. **Backup** `whatsapp-webhook` v35 e `ai-gerar-orcamento` deployados — salvar em `%TEMP%/openrouter-migration/` pra rollback.
3. **Confirmar `ANTHROPIC_API_KEY` está nos secrets** das Edge Functions (não só em admin_config).
4. **Smoke test Anthropic direto** antes de migrar qualquer função: chamada de teste curl direto pra `https://api.anthropic.com/v1/messages` com a chave do secret. Se falhar, parar.

---

## Critério de sucesso (por onda)

### Onda 1 (webhook + ai-gerar-orcamento)
- [ ] Backup das 2 funções salvo
- [ ] Smoke test Anthropic API passou
- [ ] Webhook reescrito sem regressão funcional (mesmo prompt, mesmo fluxo, só provider diferente)
- [ ] `ai-gerar-orcamento` migrada
- [ ] Type-check / lint passaram
- [ ] Deploy via Supabase MCP
- [ ] **Teste simulado**: POST direto no webhook com payload Meta válido → `modelo_ia` começa com `'claude-'` (não mais `'anthropic/claude-'` — provider direto) → resposta gerada → `sent_success=true`
- [ ] **Hardening verificado**: simular falha intencional (chave inválida temporária) → confirmar criação de `agent_messages` com `status='erro'` em vez de silêncio
- [ ] Dados de teste limpos
- [ ] STATE.md atualizado com versão final

### Onda 2 e 3
- Análoga, mas testes menos exaustivos (não bloqueiam o agente)

### Limpeza final
- [ ] `openrouter-provider.ts` deprecado / removido
- [ ] `OPENROUTER_API_KEY` revogado no painel OpenRouter (Junior faz manual ou orienta)
- [ ] Logs Edge Function de 7 dias subsequentes não mostram nenhuma chamada a `openrouter.ai/api`

---

## Rollback

Para CADA função migrada:
1. Backup do deploy anterior salvo em `%TEMP%/openrouter-migration/{nome}-v{versao}.ts`
2. Em caso de regressão pós-deploy:
   - Re-deployar versão de backup via Supabase MCP `deploy_edge_function`
   - Reverter arquivo local pro estado pre-migração
   - Documentar a regressão no relatório

Para a chave OpenRouter:
1. NÃO revogar até validar 7 dias de operação sem ela
2. Manter o secret nos Edge Functions durante a transição (só remove após validação)

---

## 🧑‍💻 PROMPT MODO AUTÔNOMO — pra colar no Claude Code CLI

> **Junior vai estar ao alcance pra confirmar deploy. Modo autônomo executa pré-checks e Onda 1 sem perguntas; Ondas 2-3 espera ok explícito.**

Copia tudo abaixo:

```
<<< INÍCIO — Eliminar OpenRouter (drop-in Anthropic) — MODO AUTÔNOMO >>>

Sou Junior. Quero eliminar o OpenRouter de vez do CRM da Croma. Causa raiz dos no-replies do agente WhatsApp foi confirmada como falha transitória do OpenRouter (sessão CLI 2026-05-21 madrugada). Anthropic API direto reduz 1 ponto de falha.

LEIA PRIMEIRO (contexto completo):
- `docs/plano-ia/2026-05-21-eliminar-openrouter-prompt.md` (escopo, estratégia técnica, fases)
- `outputs/2026-05-21-fix-webhook-relatorio.md` (relatório do diagnóstico que motivou a decisão)
- `.planning/STATE.md` (sessão 2026-05-21 + sessão 2026-05-20 NOITE)
- `CLAUDE.md` (regras do projeto)

AUTORIZAÇÕES PRÉ-APROVADAS pra Fase 0 (pré-checks) + Onda 1 (whatsapp-webhook + ai-gerar-orcamento):
✅ Puxar código deployado via Supabase MCP
✅ Editar arquivos locais em supabase/functions/whatsapp-webhook/ e ai-gerar-orcamento/
✅ Type-check / lint
✅ Deploy via Supabase MCP `deploy_edge_function` — APENAS essas 2 funções na Onda 1
✅ Testes simulados via curl POST direto no webhook
✅ Rollback automático se REGRESSÃO detectada
✅ Commit local + push (mensagem clara: "feat: eliminar OpenRouter — migrar whatsapp-webhook e ai-gerar-orcamento pra Anthropic API direto")

REQUER OK EXPLÍCITO DO JUNIOR ANTES DE PROSSEGUIR:
⏸ Ondas 2 e 3 (9 outras Edge Functions) — só executar depois de eu confirmar Onda 1 estável
⏸ Limpeza final (remover OPENROUTER_API_KEY, deprecar provider) — só após 7 dias de operação OK

ESCOPO BLINDADO (NÃO TOCAR):
❌ Outras 9 Edge Functions IA (ondas 2-3, esperam OK)
❌ Scheduled tasks fantasmas
❌ ai-compor-mensagem 401 (outro sprint)
❌ Hardcoded status='respondida' do inbound (rótulo enganoso, mas fora de escopo — risco de quebrar consumers)
❌ Banco fora do escopo (mexer apenas em agent_messages dos testes que VOCÊ criar)

DADOS DE PRODUÇÃO:
- Supabase project_id: djwjmfgplnqyffdcgdaw
- Número WhatsApp Croma: +5511939471862 (WHATSAPP_PHONE_NUMBER_ID=1042016058997037)
- Webhook URL: https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/whatsapp-webhook
- Modelos Anthropic alvo: `claude-sonnet-4-20250514` (primário), `claude-haiku-4-5-20251001` (fallback)

═══════════════════════════════════════════════════
FASE 0 — Pré-checks
═══════════════════════════════════════════════════

0.1) Smoke test Anthropic direto:
   curl -sS https://api.anthropic.com/v1/messages \
     -H "x-api-key: $ANTHROPIC_API_KEY" \
     -H "anthropic-version: 2023-06-01" \
     -H "content-type: application/json" \
     -d '{"model":"claude-haiku-4-5-20251001","max_tokens":50,"messages":[{"role":"user","content":"ping"}]}'
   ESPERADO: 200 OK com content. SE FALHAR: parar e documentar em outputs/.

0.2) Verificar ANTHROPIC_API_KEY existe nos secrets das Edge Functions (via Supabase MCP).

0.3) Backup deployado:
   mcp__supabase__get_edge_function project_id=djwjmfgplnqyffdcgdaw function_slug=whatsapp-webhook
   → salvar em /tmp/openrouter-migration/whatsapp-webhook-v35-original.ts
   Idem ai-gerar-orcamento → /tmp/openrouter-migration/ai-gerar-orcamento-v{X}-original.ts

═══════════════════════════════════════════════════
ONDA 1 — Migrar whatsapp-webhook + ai-gerar-orcamento
═══════════════════════════════════════════════════

1.1) `whatsapp-webhook/index.ts` (synced no commit 7f43b44):
   - Reescrever função `callOpenRouter` INLINE (linha 92~ até ~180) pra chamar Anthropic API direto
   - URL: https://api.anthropic.com/v1/messages
   - Headers: x-api-key, anthropic-version: 2023-06-01, content-type: application/json
   - Body: {model, max_tokens, temperature, system, messages: [{role:'user', content: userPrompt}]}
   - Resposta: data.content[0].text (não choices[0].message.content)
   - Usage: data.usage.input_tokens / output_tokens
   - MODEL_COSTS: ajustar pra preços Anthropic direto (Sonnet: $3/$15 por 1M tokens; Haiku: $0.80/$4)
   - CLAUDE_MODEL constante: trocar 'anthropic/claude-sonnet-4' → 'claude-sonnet-4-20250514'
   - FALLBACK_MODEL: 'claude-haiku-4-5-20251001' ou remover setFallbackModel call se trivial
   - MANTER o nome `callOpenRouter` (sem renomear na função) pra não tocar nos chamadores

1.2) Hardening EMBUTIDO (achado #2 do relatório do CLI):
   - No caminho onde `generateClaudeResponse` retorna `null` (atualmente só notifica Telegram), CRIAR registro agent_messages com:
     {direcao: 'enviada', status: 'erro', erro_codigo: 'IA_NULL',
      erro_mensagem: 'IA não gerou resposta (provider returned null)',
      conversation_id, lead_id (do contexto)}
   - Não mexer no hardcoded status='respondida' da recebida (fora escopo)

1.3) Hardening EMBUTIDO (achado #1 — RLS ai_logs):
   - Verificar policies da tabela ai_logs via SQL
   - Se policy de INSERT estiver em role 'public' (errado), aplicar migration:
     DROP POLICY IF EXISTS service_role_insert_logs ON ai_logs;
     CREATE POLICY service_role_insert_logs ON ai_logs FOR INSERT TO service_role WITH CHECK (true);
   - Aplicar via mcp__supabase__apply_migration

1.4) `ai-gerar-orcamento/index.ts`:
   - 3 chamadas a `callOpenRouter()` no arquivo
   - Trocar import de '../ai-shared/openrouter-provider.ts' pra '../ai-shared/anthropic-provider.ts'
   - Validar que `setFallbackModel` está sendo usado e se sim, manter (já mapeia no anthropic-provider)
   - Sem outras mudanças

1.5) Type-check local: deno check supabase/functions/whatsapp-webhook/index.ts
   Idem ai-gerar-orcamento. Se falhar, corrigir.

1.6) Deploy via Supabase MCP — UMA POR VEZ:
   - Primeiro: whatsapp-webhook
   - Esperar 30s
   - Smoke test simulado (próxima seção)
   - Se PASSOU: deploy ai-gerar-orcamento
   - Se FALHOU: rollback do webhook (re-deploy /tmp/openrouter-migration/whatsapp-webhook-v35-original.ts)

═══════════════════════════════════════════════════
TESTE SIMULADO PÓS-DEPLOY (cada função)
═══════════════════════════════════════════════════

POST direto no webhook simulando msg Meta (sem signature porque WHATSAPP_APP_SECRET está vazio):

curl -sS -X POST "https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/whatsapp-webhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"object\":\"whatsapp_business_account\",
    \"entry\":[{\"id\":\"1262844242060742\",\"changes\":[{\"value\":{
      \"messaging_product\":\"whatsapp\",
      \"metadata\":{\"display_phone_number\":\"5511939471862\",\"phone_number_id\":\"1042016058997037\"},
      \"contacts\":[{\"profile\":{\"name\":\"Teste Migracao Anthropic\"},\"wa_id\":\"5511999990010\"}],
      \"messages\":[{\"from\":\"5511999990010\",\"id\":\"wamid.TEST_$(date +%s)\",\"timestamp\":\"$(date +%s)\",
        \"type\":\"text\",\"text\":{\"body\":\"Oi, gostaria de saber sobre comunicação visual\"}}]
    },\"field\":\"messages\"}]}]
  }"

Aguardar 30s. Validar via SQL:

SELECT id, direcao, status, modelo_ia, enviado_em, respondido_em, erro_codigo,
       LEFT(conteudo, 100) AS preview, created_at
FROM agent_messages
WHERE metadata->>'from_phone' = '5511999990010'
  AND created_at > now() - interval '2 minutes'
ORDER BY created_at;

CRITÉRIO PASS:
- 2 linhas: 1 RECEBIDA + 1 ENVIADA
- ENVIADA com status='enviada', enviado_em NOT NULL, erro_codigo IS NULL
- **modelo_ia DEVE COMEÇAR COM 'claude-' (não mais 'anthropic/claude-' que era prefixo OpenRouter)** ← prova que provider mudou
- conteudo não vazio
- RECEBIDA com respondido_em NOT NULL

CRITÉRIO FAIL:
- Webhook retornou status >= 400
- ENVIADA não criada OU criada com status='erro'
- modelo_ia ainda começa com 'anthropic/' OU 'openai/' (não migrou de verdade)
- Logs Edge Function mostram fetch pra openrouter.ai/api

TESTE DE HARDENING (achado #2):
Forçar falha intencional: trocar ANTHROPIC_API_KEY pra string inválida temporariamente. Mandar simulado. Validar que criou `agent_messages` com `status='erro'` e `erro_codigo='IA_NULL'`. Restaurar chave.

LIMPEZA pós-testes:
- Captura JSON dos rows criados (ANTES de deletar) e salva em outputs/2026-05-21-evidence-onda1.json
- Só DEPOIS: DELETE FROM agent_messages WHERE metadata->>'from_phone' = '5511999990010';
- Idem agent_conversations e leads dos testes (não tocar em lead pré-existente real)

═══════════════════════════════════════════════════
TEST LOOP — até 3 ciclos
═══════════════════════════════════════════════════

CICLO 1: aplicar Onda 1 → deploy → teste → se OK, parar e gerar relatório aguardando OK do Junior pra Onda 2
CICLO 2 (se falhou): analisar logs, ajustar, redeploy, testar
CICLO 3 (se ainda falhar): ROLLBACK automático + relatório de falha em outputs/

═══════════════════════════════════════════════════
RELATÓRIO FINAL (sempre, sucesso ou falha)
═══════════════════════════════════════════════════

Salvar `outputs/2026-05-21-eliminar-openrouter-relatorio.md`:
1. Resultado do smoke test Anthropic
2. Diff resumido de cada arquivo (incluindo hardening embutido)
3. Versão final deployada de cada função
4. Resultado dos testes (com rows capturados em evidence JSON)
5. Confirmação que NENHUMA chamada a openrouter.ai foi feita pelas funções migradas (via Supabase logs)
6. Custos estimados Anthropic (baseado em tokens de teste)
7. Lista de próximas ondas pendentes (2 e 3) + limpeza
8. Tempo total

Avisar via Telegram (Claudete) ao terminar — sucesso ou falha.

DOCUMENTAÇÃO PERMANENTE (só em caso de sucesso):
- `.planning/STATE.md`: nova sessão 2026-05-21 (migração OpenRouter)
- Aprendizado: `D:\Onedrive\JARVIS\10-Projetos\Croma-Print\aprendizados\2026-05-21-eliminacao-openrouter-onda1.md`
- Commit: "feat(ia): eliminar OpenRouter onda 1 (whatsapp-webhook + ai-gerar-orcamento) — migra pra Anthropic API direto + hardening visibilidade de erro"
- Push origin/main

GUARDRAILS:
- NUNCA deployar duas funções de uma vez — sempre uma por vez, testa, depois a outra
- Antes de cada deploy, GARANTIR backup em /tmp/openrouter-migration/ existe
- Se rollback for executado, AVISAR explicitamente no relatório E no Telegram
- NÃO revogar OPENROUTER_API_KEY (fica como segurança até validar 7 dias)
- Em qualquer erro não previsto: pare, documente, NÃO ARRISCAR

INÍCIO: leia o doc + STATE.md, depois começa Fase 0 (pré-checks). Pode ir direto Fase 0 + Onda 1 sem me perguntar. Pra Ondas 2-3 e Limpeza, espera meu OK explícito.

<<< FIM DO PROMPT >>>
```

---

## Pós-Onda 1: o que esperar

Quando o CLI terminar Onda 1, você terá:
- Webhook respondendo via Anthropic API direto
- `modelo_ia` no banco mostrando `claude-sonnet-4-20250514` (não mais `anthropic/claude-sonnet-4` que era prefixo OpenRouter)
- Erros de IA agora gerando linha `status='erro'` no `agent_messages` (visibilidade)
- `ai_logs` capturando chamadas de IA corretamente

Manda um WhatsApp pro número da Croma pra confirmar. Se responder, peça ao CLI pra avançar pra Onda 2.

---

## Notas finais

- **Tempo estimado**: 1-2h pra Onda 1 (incluindo testes). Ondas 2-3 mais 1-2h. Limpeza final mais 30min.
- **Custo Anthropic estimado**: ~$3-5/dia em uso normal (100 mensagens/dia × Sonnet 4). Comparável ao OpenRouter (~$5-10/dia documentado nas auditorias).
- **Risco**: BAIXO. Drop-in via alias `callOpenRouter = callAnthropic` no provider; teste E2E rigoroso; rollback automático; só 2 funções na primeira onda.
- **Reversibilidade**: ALTA. Backups em `/tmp/openrouter-migration/`, chave OpenRouter mantida 7 dias, provider antigo só deprecado depois.
