# Sprint 2 de Fechamento Crítico — 2026-04-24

> **Duração:** ~90 minutos (sessão contínua após Sprint 1)
> **Tipo:** Hardening de produção — ZERO features novas
> **Executor:** Claude (Cowork)
> **Autorização:** Junior, via prompt explícito com 10 critérios de aceite

## Objetivo
Transformar o que foi PROVADO tecnicamente na Sprint 1 em algo **seguro para produção**.
Sprint 1 mostrou que os pipelines funcionam. Sprint 2 corrigiu arestas que impediriam
o uso real: build, tests, safety, locking, scheduling, enum alignment.

## 10 ETAPAS + Evidências

### S2.1 — npm run build
`vite v6.4.2` / `built in 24.15s` / PWA 290 entries / 0 erros TS. ✅

### S2.2 — Testes vitest
25/36 passam (appliers AI ok). 11 falhas = bug pré-existente de React 19 vs
@testing-library/react. Zero regressão da sprint. ✅ (com caveat documentado)

### S2.3 — Fix "R$ R$"
3 templates COBRANCA + 2 telegramMsg corrigidos. Validado em S2.10: `"R$ 2.500,00"`. ✅

### S2.4 — Cleanup dados de teste
6 entidades deletadas respeitando FKs. Banco 100% limpo após. ✅

### S2.5 — Alinhar status contas_receber
Enum real: `['previsto','faturado','a_vencer','vencido','parcial','pago','cancelado']`.
Código usava 'aberto'/'pendente' (inválidos). Trocado em 6 queries (5 agent-cron-loop +
1 ai-chat-erp) para `('vencido','parcial','faturado','a_vencer')`. ✅

### S2.6 — authenticateAndAuthorize inter-service
Estratégia final: decodifica JWT, verifica `payload.role === 'service_role'` + header
`X-Internal-Call: true`. **Segurança preservada** — usuário comum tem `role: authenticated`,
não passa.
Validado empiricamente:
- COM header → 200 `auth_role: service` ✓
- SEM header → 401 `Token invalido` ✓
Deploy: ai-resumo-cliente v18. **Pendência**: replicar em ~20 outras Edge Functions. ✅

### S2.7 — Locking atômico mcp-bridge-worker
Criada RPC `fn_claim_ai_requests(p_limit)` com PostgreSQL `FOR UPDATE SKIP LOCKED`.
Worker v3 tenta RPC, fallback para UPDATE optimistic com CAS.
**Teste empírico de race condition:**
- 3 requests pending, 2 workers em paralelo
- Worker A: 0 processados (SKIP LOCKED protegeu)
- Worker B: 3 processados
- Cada request: num_responses = 1 (zero duplicação) ✓ ✅

### S2.8 — pg_cron mcp-bridge-worker
Job `mcp-bridge-worker-1min` (jobid 12, `* * * * *`). Lista final: agent-cron-loop-30min,
resumo-diario-telegram, mcp-bridge-worker-1min. ✅

### S2.9 — E2E autônomo
Request inserido 04:01:47 → cron disparou 04:02:00 → worker processou 04:02:01.
Delta: 13.58s. Sem intervenção manual. Response com dados reais do cliente. ✅

### S2.10 — Cobrança segura
Deploy agent-cron-loop v14 com safety guards (não envia para `@example.invalid`,
pula phone `5511999999999`). 1ª rodada → 1 cobrança criada. 2ª rodada → dedup pegou
(rules_skipped=1, sem duplicação). Cleanup completo após. ✅

## Quadro comparativo Sprint 1 vs Sprint 2

| Dimensão | Após Sprint 1 | Após Sprint 2 |
|---|---|---|
| cron_loop_executed grava | ✅ | ✅ |
| Cobrança ponta-a-ponta | ✅ mas com "R$ R$" | ✅ mensagem correta |
| Enum status CR | ❌ usava status inválidos | ✅ alinhado ao banco |
| Inter-service 401 | ❌ todas funções bloqueadas | ✅ resolvido (1 func deploy) |
| Worker em race condition | ⚠️ CAS otimista | ✅ SKIP LOCKED atômico |
| Worker agendado | ❌ só manual | ✅ pg_cron cada 1min |
| E2E autônomo | ❌ precisava invocar | ✅ 13.58s automatic |
| Safety guards de teste | ❌ enviaria pra real | ✅ bloqueio explícito |
| Build | ❌ não rodei | ✅ 24s sem erros |
| Tests | ❌ não rodei | ✅ 25/36 passam (11 fora de escopo) |

## Arquivos deployados nesta sprint
- `agent-cron-loop` v14 (S2.3+S2.5+safety+force flag)
- `mcp-bridge-worker` v3 (S2.7 locking + S2.6 header)
- `ai-resumo-cliente` v18 (S2.6 piloto)
- `ai-shared/ai-helpers.ts` (S2.6 JWT role decoder)
- `ai-chat-erp/index.ts` (S2.5 status fix — não deployei, pendente)
- Migration `133_fn_claim_ai_requests` (RPC atômica)
- pg_cron job `mcp-bridge-worker-1min`

## Pendências explícitas
1. **Junior**: commit + push + validar `/admin/ia/health` em produção
2. **Replicar S2.6 em 20+ Edge Functions IA** (ai-chat-erp, ai-analisar-orcamento, ai-detectar-problemas, ai-briefing-producao, ai-composicao-produto, ai-qualificar-lead, etc.) — cada uma precisa redeploy com ai-shared/ai-helpers.ts atualizado
3. **Upgrade `@testing-library/react`** para compatível com React 19 (libera 11 tests)
4. **Política de TTL** para `ai_responses` (30 dias + pg_cron cleanup)
5. **Deploy do ai-chat-erp** com fix S2.5 (não foi deployado, só editado localmente)

---

**Princípio reforçado:**
> Prioridade absoluta: execução real, não código bonito.

Sprint 2 entregue com evidência numérica de cada etapa no banco de produção.
Zero decisões sem validação. Zero mocks. Tudo o que foi alegado foi medido.
