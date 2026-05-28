# Handoff — Etapa 2: Reconstruir ponte Cowork (zero API)

> **Criado**: 2026-05-21 noite | **Para retomar em**: nova sessão Cowork
> **Status**: Etapa 1 ✅ completa (commit `f194fad`). Etapa 2.1 ✅ auditoria fila. Faltam 2.2 → 2.5.

---

## TL;DR pra próxima sessão

Junior decidiu **eliminar API Anthropic** e usar SÓ o plano Max via ponte Cowork. Etapa 1 já reverteu Opus→Sonnet 4 como fallback (custo 86% menor). Falta construir a ponte propriamente: webhook enfileira em `ai_requests`, scheduled task Cowork processa via MCP, fallback Sonnet API só se a ponte cair.

**Trade-off aceito**: latência 30s-1min na resposta ao cliente. Sem ACK inicial.

---

## Estado validado em 21/05 noite

### Webhook em produção
- `whatsapp-webhook` **v39** (commit `f194fad` espelha o deployado)
- `CLAUDE_MODEL = 'claude-sonnet-4-20250514'` (fallback primário)
- `FALLBACK_MODEL = 'claude-haiku-4-5-20251001'` (fallback do fallback)
- Função `callOpenRouter` inline aponta pra Anthropic API direto
- Hardening do CLI já aplicado: caminho null cria `agent_messages status='erro' erro_codigo='IA_NULL'` + `ai_logs.user_id` nullable

### Fila `ai_requests` (audit OK em 21/05)
- Schema: `id, tipo, entity_type, entity_id, contexto jsonb, status (pending), solicitante_id, created_at, processed_at, expires_at (now+1h), error_message`
- RPC atômica `fn_claim_ai_requests(p_limit integer)` — usar SEMPRE no consumidor
- RLS: 3 policies (`ai_requests_insert`, `ai_requests_select`, `ai_requests_service` ALL service_role)
- Índices: status, tipo, created_at, solicitante_id

### `mcp-bridge-worker` v5 (Edge Function)
- Já existe, roda a cada 60s via pg_cron
- HOJE só processa `tipo='resumo-cliente'` (handler local SQL) + 5 outros via re-invoke
- **NÃO TOCAR** — pode coexistir com o nosso novo scheduled task Cowork

### `ai_logs` (RLS corrigido pelo CLI)
- Policy `service_role_insert_logs` permite insert do webhook
- Webhook v39 grava cost/tokens corretamente (validado: $0.0117 em Sonnet 4)

### Credenciais e secrets
- `ANTHROPIC_API_KEY`: ativa, $1 saldo (verificar via console.anthropic.com)
- `WHATSAPP_ACCESS_TOKEN`: SYSTEM_USER, never expires, escopo `whatsapp_business_management` OK
- `SUPABASE_SERVICE_ROLE_KEY`: ativa
- Token Supabase MCP/CLI: `<REDACTED — ver Vault/1Password>` (Junior compartilhou em chat, agendar rotacao depois)

---

## Plano de execução das sub-etapas restantes

### 2.2 — Criar scheduled task `croma-whatsapp-responder` (30min)

**Onde**: `D:\OneDrive\Documentos\Claude\Scheduled\croma-whatsapp-responder\SKILL.md`

**Cron**: a cada 1 minuto, 24/7 → `cronExpression: "* * * * *"`

**O que faz**:
1. Chama RPC `fn_claim_ai_requests(p_limit := 5)` pra pegar até 5 pendings ATOMICAMENTE (sem race)
2. Filtra os que têm `tipo = 'whatsapp-resposta'`
3. Pra cada uma:
   - Carrega contexto completo via MCP Server Croma: lead + histórico de mensagens + memória + pedidos
   - Gera resposta usando minha IA + tools MCP (preço real, regras Mubisys, gerar orçamento se intent)
   - Chama Edge Function `whatsapp-enviar` (já existe em prod, v30) OU envia direto via Graph API Meta
   - Insere `ai_responses` com payload da resposta
   - Insere `agent_messages` direcao='enviada' com `modelo_ia='claude-via-cowork-mcp'` e `metadata.fallback_used=false`
   - Atualiza `ai_requests.status = 'completed'` + `processed_at = now()`
4. Se erro: deixa pendente (watchdog vai pegar)

**Critério de validação**: injetar manualmente 1 ai_request fake com `tipo='whatsapp-resposta'` antes de mexer no webhook. Verificar que a task processa em ≤1min e cria resposta.

### 2.3 — Modificar webhook v40 (20min)

**Mudança no `supabase/functions/whatsapp-webhook/index.ts`**:

Substituir o bloco que chama `generateClaudeResponse` (linha ~630) por:

```ts
// 2026-05-22: arquitetura nova — enfileira em ai_requests, Cowork processa via MCP
const { data: aiReq, error: aiReqErr } = await supabase.from('ai_requests').insert({
  tipo: 'whatsapp-resposta',
  entity_type: 'agent_conversation',
  entity_id: conversation.id,
  contexto: {
    lead_id: lead.id,
    message_id: messageId,
    from_phone: fromPhone,
    normalized_phone: normalizedPhone,
    contact_name: contactName,
    text_body: textBody,
    media_info: mediaInfo,
    is_new_lead: isNewLead,
  },
  status: 'pending',
}).select('id').single();

if (aiReqErr) {
  // Falha ao enfileirar: cai no fallback síncrono (caminho antigo) pra não perder a mensagem
  console.error('ai_requests insert failed, fallback to sync:', aiReqErr);
  const claudeResult = await generateClaudeResponse(...);  // caminho antigo, mantido
  // ... resto do fluxo antigo
} else {
  // Sucesso: confia na ponte. Não responde aqui.
  console.log('Enfileirado em ai_requests:', aiReq.id);
  return new Response('OK', { status: 200 });
}
```

**Não tocar**:
- Lógica de detecção de bot/loop (mantém igual)
- `tryUpdateLeadFromMessage` (mantém igual — extração rápida sem IA)
- Escalação por keywords (mantém igual)
- `automacao_pausada` (mantém igual)
- `generateClaudeResponse` (manter no código, só vira fallback)

**Deploy**: usar mesma rota da Etapa 1 (curl pra Supabase Management API multipart com arquivo).

### 2.4 — Criar watchdog `ai-requests-fallback-watchdog` (20min)

**Onde**: `D:\OneDrive\Documentos\Claude\Scheduled\ai-requests-fallback-watchdog\SKILL.md`

**Cron**: a cada 5 minutos → `cronExpression: "*/5 * * * *"`

**O que faz**:
1. Query: `SELECT * FROM ai_requests WHERE tipo='whatsapp-resposta' AND status='pending' AND created_at < now() - interval '5 minutes'`
2. Pra cada uma:
   - Chamar Anthropic API com Sonnet 4 (usando ANTHROPIC_API_KEY ainda configurada)
   - Enviar resposta via `whatsapp-enviar`
   - Marcar `status='completed'` + `metadata: { fallback_used: true, reason: 'cowork_unavailable' }`
   - Notificar via Telegram: *"Ponte Cowork não respondeu em 5min, fallback Sonnet API acionado pra mensagem de [cliente]"*

**Goal**: cliente sempre recebe resposta em ≤7min no pior cenário (1min ponte + 5min trigger + 1min processamento).

### 2.5 — Validação 24h + remoção da API key

1. Deixar rodando 24h
2. Query de saúde:
   ```sql
   SELECT
     COUNT(*) FILTER (WHERE (metadata->>'fallback_used')::boolean IS TRUE OR metadata->>'fallback_used' = 'true') AS via_fallback,
     COUNT(*) FILTER (WHERE metadata->>'fallback_used' IS NULL OR metadata->>'fallback_used' = 'false') AS via_cowork,
     COUNT(*) AS total
   FROM ai_responses
   WHERE created_at > now() - interval '24 hours';
   ```
3. Se `via_cowork / total > 0.95` (95%+ pela ponte) → sucesso
4. Remover `ANTHROPIC_API_KEY` dos secrets Supabase (`functions:secrets:unset`)
5. Atualizar STATE.md + Obsidian
6. Revogar a key no console.anthropic.com

---

## Princípios karpathy aplicados em toda Etapa 2

1. **Think Before Coding**: validar diff e infra antes de cada deploy
2. **Simplicity First**: novo SKILL menor que 200 linhas, sem feature flag, sem retry exponential — só o essencial
3. **Surgical Changes**: webhook só MUDA o ramo que chamava `generateClaudeResponse`. Tudo o resto fica.
4. **Goal-Driven Execution**: cada sub-etapa tem critério de PASS validável via SQL ou simulação

## Bugs catalogados (NÃO mexer nesta etapa)

- `agent-cron-loop` em loop 500 (CLI tentou fix `eb42ac6` — validar se resolveu)
- `ai-compor-mensagem` retorna 401 mesmo com X-Internal-Call
- 80+ arquivos não-commitados (maioria CRLF/LF, ruído visual no git diff)
- `hardcoded status='respondida'` em mensagem recebida (achado #3 do CLI, fora de escopo)

## Comando pra retomar na próxima sessão

Cola isso no início da nova sessão Cowork:

```
Sou Junior, vou retomar a Etapa 2 da reconstrução da ponte Cowork.
Lê primeiro:
- C:\Users\Caldera\Claude\CRM-Croma\docs\plano-ia\2026-05-21-handoff-etapa2-ponte-cowork.md
- C:\Users\Caldera\Claude\CRM-Croma\.planning\STATE.md (sessões 2026-05-21)

Depois começa pela Etapa 2.2 (criar scheduled task croma-whatsapp-responder).
Aplica princípios karpathy-guidelines. Confirma comigo antes de cada deploy.
```

---

## Arquivos relacionados

- `outputs/2026-05-21-fix-webhook-relatorio.md` — relatório do CLI da migração OpenRouter
- `docs/plano-ia/2026-05-21-eliminar-openrouter-prompt.md` — plano que foi executado
- `.planning/STATE.md` sessões 2026-05-20 NOITE + 2026-05-21
- `D:\Onedrive\JARVIS\10-Projetos\Croma-Print\aprendizados\2026-05-21-fix-webhook-v35-status-respondida.md`
- Commits relevantes: `7f43b44`, `a0930ff`, `5ee9817`, `e22a7d4`, `537fa95`, `094e5f7`, `e3587ae`, `3346634`, `ec1121a`, `eb42ac6`, `e5a4d38`, `f194fad`
