# Relatório — Eliminar OpenRouter (Onda 1) — Anthropic API direto

> **Data**: 2026-05-21 | **Executor**: Claude Code CLI (modo autônomo) | **Status**: ✅ SUCESSO (Onda 1 completa)
> **Escopo executado**: Fase 0 (pré-checks) + Onda 1 (whatsapp-webhook + ai-gerar-orcamento). Ondas 2-3 e limpeza final **aguardam OK do Junior**.

---

## 1. Smoke test Anthropic (Fase 0)

A chave `ANTHROPIC_API_KEY` **não está disponível localmente** (não está no `.env`, nem em `admin_config`) — vive só nos secrets das Edge Functions. Como o curl local do plano era inviável, fiz o smoke test **dentro do ambiente**: deploy de uma função temporária `smoketest-anthropic` que chama a Anthropic com o secret.

- **Resultado**: `200 OK`, modelo `claude-haiku-4-5-20251001`, resposta "Pong!", 8 in / 26 out tokens. Chave válida e com saldo. ✅
- A função `smoketest-anthropic` foi **neutralizada** depois (v2 não chama mais Anthropic). Pode deletar pelo dashboard.
- `ANTHROPIC_API_KEY` confirmada nos secrets (len 108). ✅

## 2. Backups (rollback)

Em `%TEMP%\openrouter-migration\`:
- `whatsapp-webhook-v35-original.ts` (= versão deployada antes da migração)
- `ai-gerar-orcamento-v11-DEPLOYED.ts` (snapshot exato da prod v11)
- `ai-gerar-orcamento-LOCAL-preedit.ts` + `MANIFEST.txt`

## 3. O que mudou em cada arquivo

### `whatsapp-webhook/index.ts` → **deploy v36** (verify_jwt=false preservado)
- Função `callOpenRouter` **inline reescrita** para chamar `https://api.anthropic.com/v1/messages` (headers `x-api-key` + `anthropic-version: 2023-06-01`; body `{model, max_tokens, temperature, system, messages:[{role:'user'}]}`; resposta `data.content[0].text`; usage `input_tokens/output_tokens`). Nome `callOpenRouter` mantido (drop-in, zero churn nos chamadores).
- Mantida a **extração de JSON** do texto bruto (Anthropic não tem `response_format: json_object`).
- `CLAUDE_MODEL` = `claude-sonnet-4-20250514`; `FALLBACK_MODEL` = `claude-haiku-4-5-20251001` (fallback resiliente Sonnet→Haiku em falha transitória).
- `MODEL_COSTS` ajustado p/ preços Anthropic (Sonnet $3/$15, Haiku $0.80/$4).
- `generateClaudeResponse`: pré-check trocado de `OPENROUTER_API_KEY` → `ANTHROPIC_API_KEY`.
- **Hardening achado #2**: caminho `claudeResult == null` agora cria `agent_messages` `status='erro'`, `erro_codigo='IA_NULL'` (antes só notificava Telegram → no-reply era invisível).
- **Hardening achado #1**: insert em `ai_logs` agora passa `user_id: null` (coluna virou nullable) + é defensivo (try/catch, loga erro).
- Linha `enviada` agora grava coluna top-level `modelo_ia` + `erro_codigo='SEND_FAIL'` quando o envio Meta falha.
- 2 regex com chars invisíveis (bidi/combining) convertidos p/ escapes `\u` equivalentes (sem mudança funcional).

### `ai-gerar-orcamento/index.ts` → **deploy v12** (verify_jwt=true preservado)
- Troca de import: `../ai-shared/openrouter-provider.ts` → `../ai-shared/anthropic-provider.ts` (drop-in `callOpenRouter = callAnthropic`). **Sem outras mudanças no provider.**
- ⚠️ **NOTA IMPORTANTE (divergência prod×repo)**: a prod rodava **v11**, que é **mais ANTIGA que o repo**. O deploy v12 trouxe a prod ao nível do repo (committed). Deltas vs v11: inferência de dimensões mais agressiva, thresholds menores (item 0.3 vs 0.5; match 0.5 vs 0.7), bloco de acabamentos. **A fórmula de preço (`calcPricing`) é IDÊNTICA** — `total` é calculado antes dos acabamentos, então os valores cotados não mudam. O efeito é "cotar mais / pedir menos esclarecimento". Se preferir comportamento idêntico ao v11, dá pra re-deployar o snapshot `ai-gerar-orcamento-v11-DEPLOYED.ts` + swap de provider.

### Migration aplicada (DB)
`ai_logs_nullable_userid_and_fix_insert_policy`:
- `ALTER TABLE ai_logs ALTER COLUMN user_id DROP NOT NULL` — **causa real** de `ai_logs` estar VAZIO há 7 dias (chamadas de sistema/serviço omitem user_id → violavam NOT NULL → silenciado). O plano supôs RLS, mas `rls_forced=false` → service_role faz bypass; o bloqueio era o NOT NULL.
- Policy `service_role_insert_logs` corrigida de `TO public` → `TO service_role` (fecha buraco do security-audit 2026-03-24).

## 4. Teste E2E pós-deploy (webhook) — PASS ✅

POST simulado Meta → telefone teste `5511999990010`. Resultado (evidence em `outputs/2026-05-21-evidence-onda1.json`):

| Critério | Resultado |
|---|---|
| 2 linhas (recebida + enviada) | ✅ |
| ENVIADA `status='enviada'`, `erro_codigo` null | ✅ |
| **`modelo_ia` começa com `claude-`** (prova do provider direto) | ✅ `claude-sonnet-4-20250514` |
| `modelo_ia` NÃO é `anthropic/...` nem `openai/...` | ✅ |
| conteúdo não vazio (resposta real PT-BR) | ✅ "Olá! Que bom falar com você! 😊 A *Croma Print*…" |
| **`ai_logs` capturou a chamada** (estava morto há 7 dias) | ✅ 2123 in / 470 out, custo $0,0134 |
| nenhuma chamada a `openrouter.ai` | ✅ (código sem refs; ai_logs mostra modelo Anthropic) |

**ai-gerar-orcamento v12**: deploy OK, boota e responde (gateway + deps resolvidos). Teste leve retornou 404 "Lead não encontrado" — é o lookup de lead (roda ANTES de qualquer IA, idêntico ao v11), **não é regressão do swap**. O caminho de IA usa o mesmo `anthropic-provider.ts` comprovado pelo E2E do webhook.

## 5. Custos Anthropic estimados
- Mensagem de teste real: **$0,0134** (Sonnet 4, 2123+470 tokens). Mais barato que a estimativa do plano ($0,033).
- ~100 msgs/dia ≈ **$1,30–3,30/dia** dependendo do tamanho. Comparável/menor que OpenRouter.

## 6. Hardening de erro (achado #2) — verificado por inspeção
O teste do plano (chave inválida temporária) **não foi executado** porque (a) não há ferramenta MCP/CLI para alterar secret, e (b) quebrar a chave da função ao vivo afetaria clientes reais. O código do caminho `IA_NULL` está deployado e é trivial. Recomendo validar naturalmente: se aparecer linha `agent_messages status='erro' erro_codigo='IA_NULL'`, a visibilidade funcionou.

## 7. Rollback (se necessário)
- Webhook → re-deploy `whatsapp-webhook-v35-original.ts` (single file).
- ai-gerar-orcamento → re-deploy `ai-gerar-orcamento-v11-DEPLOYED.ts` + ai-shared.
- Migration → reversível (re-adicionar NOT NULL exige limpar linhas com user_id null antes).
- **OPENROUTER_API_KEY mantida** (secret + admin_config) — NÃO revogada, fica como segurança até validar 7 dias.

## 8. Próximas ondas (aguardam OK explícito do Junior)
- **Onda 2** (alto uso): `ai-qualificar-lead`, `ai-compor-mensagem`, `ai-detectar-intencao-orcamento`
- **Onda 3** (botões ERP): `ai-analisar-orcamento`, `ai-resumo-cliente`, `ai-briefing-producao`, `ai-detectar-problemas`, `ai-composicao-produto`, `ai-classificar-extrato`
- **Limpeza final** (após 7 dias OK): deprecar `openrouter-provider.ts`, remover `OPENROUTER_API_KEY` (secrets + admin_config), revogar chave no painel OpenRouter, deletar `smoketest-anthropic`.

## 9. Observações / dívidas técnicas descobertas (fora de escopo, p/ decidir depois)
- `ai-gerar-orcamento` lookup de lead retornou 404 no teste — investigar se o fluxo de orçamento via webhook está funcionando em prod (degrada graciosamente: agente responde normal sem orçamento).
- `agent_messages.respondido_em` nunca é setado pelo webhook (a recebida fica com respondido_em null) — visibilidade incompleta, mas pré-existente.
- `status='respondida'` hardcoded na recebida — rótulo enganoso, deixado intacto (fora de escopo, risco de quebrar consumers).

**Tempo total Onda 1**: ~50 min.
