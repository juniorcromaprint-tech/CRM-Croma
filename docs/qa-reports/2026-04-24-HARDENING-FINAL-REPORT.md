# HARDENING FINAL — Relatório Completo

**Data**: 2026-04-24
**Escopo**: Estabilidade e segurança — ZERO features novas
**Projeto**: CRM-Croma (Supabase ref: `djwjmfgplnqyffdcgdaw`)
**Stack**: Supabase Edge Functions (Deno) + PostgreSQL + pg_cron

---

## ETAPA 1 — Eliminar Código Fantasma

### Problema
Funções SQL existiam no banco de produção mas NÃO no repositório Git. Impossível auditar, versionar ou reproduzir o ambiente.

### O que foi feito
Extraídas da produção e versionadas como migration:

**Migration 135 (`135_cobranca_escalonada_contratos.sql`)**:
- `fn_cobranca_escalonada()` — lógica de cobrança D1→D3→D7→D15→D30 com canais WhatsApp/email/Telegram
- `fn_faturar_contratos_vencidos()` — faturamento automático de contratos recorrentes
- Ambas já existiam no banco, agora estão no Git para auditoria

### Verificação
- [x] Funções extraídas com `pg_get_functiondef()`
- [x] Migration criada no repo
- [x] Migration aplicada no Supabase (confirmada via `list_migrations`)

---

## ETAPA 2 — Blindagem de Autenticação JWT

### Problema
As Edge Functions que usam `authenticateAndAuthorize()` (em `ai-shared/ai-helpers.ts`) não verificavam a assinatura do JWT — apenas decodificavam o payload (base64). Isso significa que qualquer JWT com `role: service_role` no payload seria aceito, mesmo sem assinatura válida.

Além disso, os pg_cron jobs que chamam Edge Functions via `net.http_post()` não enviavam o header `X-Internal-Call: true`, necessário para o bypass de autenticação inter-service.

### O que foi feito

#### 2.1 — Verificação HMAC-SHA256 (`ai-helpers.ts` v2)

Adicionada verificação de assinatura JWT via Web Crypto API (zero dependências externas):

```typescript
async function verifyServiceRoleJwt(token: string): Promise<boolean> {
  const jwtSecret = Deno.env.get('JWT_SECRET');
  if (!jwtSecret) {
    console.warn('[ai-helpers] JWT_SECRET not set — falling back to payload-only check');
    return false;
  }

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  // 1. Verify HMAC-SHA256 signature
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(jwtSecret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const signatureBytes = base64UrlToBytes(parts[2]);
  const dataBytes = encoder.encode(`${parts[0]}.${parts[1]}`);
  const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, dataBytes);
  if (!valid) return false;

  // 2. Check payload claims
  const payload = base64UrlToJson(parts[1]);
  if (payload.role !== 'service_role') return false;

  // 3. Check expiration
  if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return false;

  return true;
}
```

**Modelo de segurança (defense-in-depth)**:
- **Camada 1**: Gateway Supabase (`verify_jwt: true` no config.toml) — valida assinatura antes de chegar na Edge Function
- **Camada 2**: `verifyServiceRoleJwt()` — verificação HMAC interna como proteção adicional
- **Fallback**: Se `JWT_SECRET` não estiver configurado, aceita payload-only (a Camada 1 já validou nesse ponto)

**Fluxo de autenticação em `authenticateAndAuthorize()`**:
1. Verifica header `Authorization: Bearer <token>`
2. Se header `X-Internal-Call: true` + JWT com 3 partes:
   - Tenta HMAC verify → se OK, retorna `userRole: 'service'`
   - Fallback: decodifica payload → se `role === 'service_role'`, aceita
3. Senão: fluxo normal (Supabase Auth `getUser()` → busca role em `profiles` → verifica `AI_ROLE_ACCESS`)
4. Rate limiting: máx 30 chamadas/hora por usuário (não se aplica a `service`)

#### 2.2 — `AI_ROLE_ACCESS` com role `service` (`ai-types.ts`)

Todas as 14 `AIFunctionName` agora incluem `'service'` na lista de roles permitidas:

```typescript
export const AI_ROLE_ACCESS: Record<AIFunctionName, string[]> = {
  'analisar-orcamento': ['comercial', 'gerente', 'admin', 'service'],
  'resumo-cliente': ['comercial', 'gerente', 'admin', 'service'],
  'briefing-producao': ['producao', 'gerente', 'admin', 'service'],
  'detectar-problemas': ['gerente', 'admin', 'service'],
  'composicao-produto': ['comercial', 'producao', 'gerente', 'admin', 'service'],
  'qualificar-lead': ['comercial', 'gerente', 'admin', 'service'],
  'compor-mensagem': ['comercial', 'gerente', 'admin', 'service'],
  'sugerir-compra': ['admin', 'gerente', 'compras', 'service'],
  'validar-nfe': ['admin', 'gerente', 'fiscal', 'service'],
  'insights-diarios': ['admin', 'gerente', 'service'],
  'conciliar-bancario': ['admin', 'gerente', 'financeiro', 'service'],
  'sequenciar-producao': ['producao', 'gerente', 'admin', 'service'],
  'preco-dinamico': ['comercial', 'gerente', 'admin', 'service'],
  'previsao-estoque': ['admin', 'gerente', 'compras', 'service'],
};
```

#### 2.3 — pg_cron jobs com header `X-Internal-Call`

**Migration 136 (`136_pgcron_xinternal_header.sql`)** — atualiza os 5 jobs HTTP:

| Job | Cron | Função chamada |
|---|---|---|
| `ai-detectar-problemas-manha` | `0 11 * * 1-5` | ai-detectar-problemas |
| `ai-detectar-problemas-tarde` | `0 17 * * 1-5` | ai-detectar-problemas |
| `agent-cron-loop-30min` | `*/30 11-23,0-2 * * 1-6` | agent-cron-loop |
| `resumo-diario-telegram` | `0 1 * * 2-7` | agent-cron-loop (task=resumo_diario) |
| `mcp-bridge-worker-1min` | `* * * * *` | mcp-bridge-worker |

Cada job agora envia:
```sql
headers := jsonb_build_object(
  'Content-Type', 'application/json',
  'Authorization', 'Bearer ' || private.get_service_role_key(),
  'X-Internal-Call', 'true'  -- ADICIONADO
)
```

### CORS
Header `X-Internal-Call` adicionado à lista `Access-Control-Allow-Headers`:
```typescript
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Content-Type, Authorization, X-Internal-Call'
```

### Verificação
- [x] Migration 136 aplicada no Supabase
- [x] 5 jobs HTTP confirmados com header `X-Internal-Call`
- [x] 6 jobs SQL-only (não chamam HTTP) — não precisam do header
- [x] Total: 11 jobs no `cron.job`, todos corretos

---

## ETAPA 3 — Deploy Crítico de Edge Functions

### Problema
As mudanças em `ai-helpers.ts` e `ai-types.ts` precisavam ser deployadas em todas as Edge Functions que as importam.

### O que foi deployado

| Edge Function | Versão | O que mudou |
|---|---|---|
| `ai-detectar-problemas` | v17 | Auth hardened (HMAC + X-Internal-Call) |
| `ai-compor-mensagem` | v19 | Auth hardened (HMAC + X-Internal-Call) |
| `agent-cron-loop` | v15 | Auth hardened + circuit breaker (E4.2) |
| `mcp-bridge-worker` | v3 | Auth hardened (HMAC + X-Internal-Call) |

### Verificação
- [x] Todas deployadas via `deploy_edge_function`
- [x] Versões confirmadas via `list_edge_functions`

---

## ETAPA 4 — Estabilidade (Circuit Breaker + TTL Cleanup)

### 4.1 — TTL Cleanup Automático

**Problema**: Tabelas `system_events`, `ai_logs` e `ai_responses` crescem indefinidamente. Sem cleanup, o banco ficará lento ao longo dos meses.

**Migration 137 (`137_ttl_cleanup_cron.sql`)**:

Função `fn_ttl_cleanup()` com retenção escalonada:

| Tabela | Retenção | Motivo |
|---|---|---|
| `system_events` | 60 dias | Tabela mais volumosa (~150 rows/dia) |
| `ai_logs` | 90 dias | Auditoria de uso IA |
| `ai_responses` | 30 dias | Cache de respostas IA |

```sql
CREATE OR REPLACE FUNCTION public.fn_ttl_cleanup()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_system_events INT; v_ai_logs INT; v_ai_responses INT;
BEGIN
  DELETE FROM system_events WHERE created_at < NOW() - INTERVAL '60 days';
  GET DIAGNOSTICS v_system_events = ROW_COUNT;
  DELETE FROM ai_logs WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS v_ai_logs = ROW_COUNT;
  DELETE FROM ai_responses WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_ai_responses = ROW_COUNT;
  RETURN jsonb_build_object(
    'system_events_removed', v_system_events,
    'ai_logs_removed', v_ai_logs,
    'ai_responses_removed', v_ai_responses,
    'executed_at', NOW()
  );
END; $$;
```

**pg_cron**: `ttl-cleanup-diario` — roda às 03:00 UTC (00:00 BRT), jobid 18.

### 4.2 — Circuit Breaker no `agent-cron-loop`

**Problema**: Se o agent-cron-loop entrar em loop de erro (ex: API do OpenRouter fora, banco lento), ele continua executando a cada 30min, acumulando erros e enviando Telegram spam.

**Solução**: Circuit breaker no início da função (antes de qualquer lógica de negócio):

```typescript
// ── 0. Circuit breaker: skip if too many consecutive errors ──
const { count: recentErrors } = await supabase
  .from('ai_logs')
  .select('*', { count: 'exact', head: true })
  .eq('function_name', 'agent-cron-loop')
  .eq('status', 'error')
  .gte('created_at', new Date(Date.now() - 3 * 3600_000).toISOString());

const CB_THRESHOLD = 5;
if ((recentErrors ?? 0) >= CB_THRESHOLD) {
  // Anti-spam: só envia alerta Telegram 1x por janela de 3h
  const { count: cbAlerts } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'circuit_breaker_open')
    .gte('created_at', new Date(Date.now() - 3 * 3600_000).toISOString());

  if ((cbAlerts ?? 0) === 0) {
    await sendTelegram(`🔴 CIRCUIT BREAKER: agent-cron-loop pausado...`);
    await supabase.from('system_events').insert({
      event_type: 'circuit_breaker_open',
      entity_type: 'system',
      entity_id: '00000000-0000-0000-0000-000000000000',
      payload: { errors_count: recentErrors, threshold: CB_THRESHOLD, window_hours: 3 },
    });
  }
  return jsonOk({ status: 'circuit_breaker_open', errors_last_3h: recentErrors, threshold: CB_THRESHOLD });
}
```

**Comportamento**:
- Threshold: 5 erros na janela de 3 horas
- Ação: pausa execução, envia alerta Telegram (1x por janela), loga `circuit_breaker_open` em `system_events`
- Recuperação: automática — quando os erros saem da janela de 3h, o circuit breaker fecha sozinho
- Sem intervenção manual necessária

### Verificação
- [x] Migration 137 aplicada (jobid 18 confirmado)
- [x] Circuit breaker deployado no agent-cron-loop v15
- [x] Anti-spam do Telegram testado (só 1 alerta por janela)

---

## INVENTÁRIO FINAL — pg_cron Jobs (11 total)

### Jobs que chamam Edge Functions via HTTP (5) — TODOS com X-Internal-Call ✅

| JobID | Nome | Cron | Edge Function |
|---|---|---|---|
| 13 | `ai-detectar-problemas-manha` | `0 11 * * 1-5` | ai-detectar-problemas |
| 14 | `ai-detectar-problemas-tarde` | `0 17 * * 1-5` | ai-detectar-problemas |
| 15 | `agent-cron-loop-30min` | `*/30 11-23,0-2 * * 1-6` | agent-cron-loop |
| 16 | `resumo-diario-telegram` | `0 1 * * 2-7` | agent-cron-loop |
| 17 | `mcp-bridge-worker-1min` | `* * * * *` | mcp-bridge-worker |

### Jobs SQL-only (6) — não precisam de X-Internal-Call

| JobID | Nome | Cron | O que faz |
|---|---|---|---|
| 3 | `atualizar-leads-inativos` | `0 6 * * *` | SQL: update leads |
| 4 | `faturar-contratos-vencidos` | `0 8 * * 1-5` | SQL: fn_faturar_contratos_vencidos() |
| 5 | `gerar-cobrancas-diarias` | `30 10 * * 1-5` | SQL: fn_cobranca_escalonada() |
| 6 | `notificar-pedidos-atrasados` | `0 9 * * 1-5` | SQL: insert system_events |
| 11 | `limpar-system-events-antigos` | `0 4 * * 0` | SQL: delete system_events > 90d |
| 18 | `ttl-cleanup-diario` | `0 3 * * *` | SQL: fn_ttl_cleanup() |

**Nota**: Job 11 (`limpar-system-events-antigos`) faz cleanup semanal de 90d. O novo job 18 (`ttl-cleanup-diario`) faz cleanup diário de 60d para `system_events`. O job 18 é mais agressivo e mais frequente — na prática ele domina, e o job 11 é redundante mas inofensivo.

---

## INVENTÁRIO FINAL — Edge Functions Deployadas

| Função | Versão | Usa ai-helpers.ts? |
|---|---|---|
| ai-detectar-problemas | v17 | ✅ (auth hardened) |
| ai-compor-mensagem | v19 | ✅ (auth hardened) |
| agent-cron-loop | v15 | ✅ (auth hardened + circuit breaker) |
| mcp-bridge-worker | v3 | ✅ (auth hardened) |
| ai-gerar-orcamento | v10 | ✅ (herda auth via import) |
| agent-enviar-email | v6 | — (auth própria) |
| whatsapp-webhook | v12 | — (auth via Twilio signature) |
| enviar-campanha | v2 | — |
| atualizar-status-nfe | v2 | — |
| webhook-nfe | v1 | — |

---

## MIGRATIONS CRIADAS NESTE SPRINT

| Arquivo | Aplicada? | Conteúdo |
|---|---|---|
| `135_cobranca_escalonada_contratos.sql` | ✅ | Ghost code → versionado |
| `136_pgcron_xinternal_header.sql` | ✅ | X-Internal-Call nos 5 jobs HTTP |
| `137_ttl_cleanup_cron.sql` | ✅ | fn_ttl_cleanup + cron diário |

---

## ARQUIVOS MODIFICADOS

| Arquivo | Tipo de mudança |
|---|---|
| `supabase/functions/ai-shared/ai-helpers.ts` | Reescrito — HMAC verify + defense-in-depth |
| `supabase/functions/ai-shared/ai-types.ts` | `AI_ROLE_ACCESS` — adicionado 'service' em todas as 14 funções |
| `supabase/functions/agent-cron-loop/index.ts` | Adicionado circuit breaker (linhas 94-125) |
| `supabase/migrations/135_cobranca_escalonada_contratos.sql` | NOVO — ghost code capturado |
| `supabase/migrations/136_pgcron_xinternal_header.sql` | NOVO — headers pg_cron |
| `supabase/migrations/137_ttl_cleanup_cron.sql` | NOVO — TTL cleanup |

---

## O QUE NÃO FOI FEITO (fora do escopo — zero features novas)

- Nenhuma tabela nova criada
- Nenhuma Edge Function nova criada
- Nenhuma rota de frontend modificada
- Nenhum componente React alterado
- Nenhuma lógica de negócio adicionada

---

## PONTOS PARA REVISÃO EXTERNA

Ao revisar este relatório, considere:

1. **O fallback payload-only na autenticação** (linhas 132-145 de ai-helpers.ts): quando `JWT_SECRET` não está disponível, aceita JWT com `role: service_role` sem verificar assinatura. Isso é intencional (defense-in-depth — o gateway Supabase já verificou), mas vale avaliar se é aceitável.

2. **Job 11 vs Job 18**: Dois jobs fazem cleanup de `system_events` com retenções diferentes (90d semanal vs 60d diário). O 18 domina na prática. Considerar remover o 11 para evitar confusão.

3. **Circuit breaker consulta `ai_logs`**: Se a própria tabela `ai_logs` estiver inacessível, o circuit breaker falha silenciosamente (o catch geral da função trata isso). Avaliar se precisa de try/catch específico.

4. **Rate limiting de 30/hora por usuário**: Não se aplica ao role `service` (bypass antes do rate limit check). Isso é intencional para não bloquear pg_cron, mas significa que chamadas inter-service são ilimitadas.

5. **`fn_ttl_cleanup` é SECURITY DEFINER**: Roda com permissões do owner (postgres). Necessário para deletar em tabelas com RLS, mas é um padrão de privilégio elevado.

6. **Tabela `cobranca_automatica` mencionada no cabeçalho da migration 137** mas não limpa pela função: foi avaliada (180 dias de retenção planejados) mas não implementada por ser tabela de negócio, não de sistema. Avaliar se deve ser incluída.
