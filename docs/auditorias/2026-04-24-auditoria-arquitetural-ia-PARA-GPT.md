# AUDITORIA TÉCNICA — Sistema de IA CRM-Croma

**Data:** 24/04/2026  
**Auditor:** Claude (Opus) — atuando como Arquiteto de Software Sênior  
**Escopo:** Arquitetura IA, autenticação inter-service, worker MCP, agent-cron-loop, Edge Functions  
**Base:** Código real lido diretamente do repositório (não resumos)

---

## 1. ARQUITETURA DE AUTENTICAÇÃO (JWT role + X-Internal-Call)

### O que foi implementado

O `ai-helpers.ts` decodifica o payload do JWT (base64url), verifica se `role === 'service_role'` e exige o header `X-Internal-Call: true`. Se ambos passam, retorna auth bypass com userId sentinel (`000...000`) e userRole `'service'`.

### Pontos fortes

- **Dupla verificação** (JWT claim + header) é melhor que cada um sozinho.
- O JWT `service_role` só pode ser gerado com o `JWT_SECRET` do Supabase, então um atacante externo não fabrica um.
- Fallback seguro: se a decodificação falha, cai na autenticação normal de usuário.
- Separação clara: `userRole: 'service'` distingue chamadas inter-service de chamadas de usuário nos logs.

### Riscos e problemas

**RISCO MÉDIO — Sem verificação de assinatura do JWT.**  
O código faz `atob(payload)` e confia no claim `role`. Ele NÃO verifica a assinatura HMAC do JWT. Isso significa que qualquer pessoa que envie um JWT com payload `{"role":"service_role"}` + header `X-Internal-Call: true` passa na autenticação, DESDE QUE o Supabase Gateway não bloqueie antes.

**Mitigação atual:** O Supabase Gateway (quando `verify_jwt: true` no config.toml) valida a assinatura antes de passar a request para a Edge Function. Então na prática o JWT precisa ser válido. Porém:
- Se alguma Edge Function tiver `verify_jwt: false` (como `ai-gerar-orcamento` e `whatsapp-webhook`), essa proteção desaparece.
- Se o sistema migrar para fora do Supabase, essa camada some.

**Recomendação:** Verificar a assinatura do JWT usando `jose` ou `djwt` no Deno. Não depender apenas do gateway.

```typescript
// Exemplo com djwt (Deno)
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
const key = await crypto.subtle.importKey(
  "raw", new TextEncoder().encode(Deno.env.get("JWT_SECRET")!),
  { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
);
const payload = await verify(token, key);
if (payload.role === 'service_role') { /* bypass */ }
```

**RISCO BAIXO — Header `X-Internal-Call` é trivial de forjar.**  
Qualquer HTTP client pode enviar `X-Internal-Call: true`. A segurança real vem do JWT, não do header. O header é redundância fraca — serve mais como sinal de intenção que como barreira.

**Recomendação:** O header está OK como sinal de intenção, mas não documentar como "camada de segurança". A segurança é o JWT. Considerar remover o header check e confiar apenas no JWT role claim (com verificação de assinatura).

**RISCO BAIXO — `verify_jwt: false` em 2 Edge Functions.**  
`ai-gerar-orcamento` e `whatsapp-webhook` têm `verify_jwt: false`. Essas estão fora do `authenticateAndAuthorize` (Grupo C), mas se alguém copiar o padrão de bypass para elas sem ativar verify_jwt, a brecha abre.

### Escalabilidade do padrão

**Boa para o cenário atual** (< 20 Edge Functions). Não escala bem se:
- O projeto crescer para 50+ funções com necessidade de roles granulares inter-service.
- Precisar de múltiplos "service accounts" com permissões diferentes.

Para esse futuro: considerar um middleware compartilhado real (importado via Deno import map) que valida assinatura + emite contexto tipado, ao invés de copiar lógica de auth em 24 arquivos.

### Veredicto: 6.5/10

Funciona e é seguro o suficiente para o cenário atual (Supabase gateway faz o trabalho pesado). Mas confiar em `atob` sem verificar assinatura é uma bomba-relógio se o contexto de deploy mudar.

---

## 2. WORKER MCP (SKIP LOCKED + RPC)

### O que foi implementado

RPC `fn_claim_ai_requests(p_limit)` usando `FOR UPDATE SKIP LOCKED` + `UPDATE RETURNING`. Worker v3 tenta RPC primeiro, com fallback para UPDATE optimistic com CAS.

### Pontos fortes

- **SKIP LOCKED é o padrão correto** para job queues em PostgreSQL. Não bloqueia workers concorrentes.
- **Fallback CAS** é boa defesa em profundidade (se a RPC falhar por qualquer motivo).
- **Teste empírico validado:** 2 workers em paralelo, 3 requests, zero duplicação.

### Riscos e problemas

**RISCO BAIXO — RPC não encontrada no repositório.**  
O agente de busca não encontrou o arquivo de migração `133_fn_claim_ai_requests.sql` no diretório `/supabase/migrations/`. Possível que tenha sido aplicada diretamente no banco via SQL Editor sem migration file. Isso é um risco de manutenção: se o banco precisar ser recriado, a RPC não existe no código versionado.

**Recomendação:** Verificar se a migração existe no banco (`SELECT routine_name FROM information_schema.routines WHERE routine_name = 'fn_claim_ai_requests'`). Se sim, extrair o DDL e salvar como migration versionada.

**RISCO MÉDIO — Worker `mcp-bridge-worker` não encontrado no repositório.**  
O agente de busca não encontrou o diretório `supabase/functions/mcp-bridge-worker/`. O STATE.md documenta ele como v3 deployado, mas o código fonte não está versionado no repo Git.

**Isso é crítico para manutenção.** Se o worker precisa ser re-deployado e o código só existe no Supabase Functions runtime, qualquer alteração manual lá vira "código fantasma".

**Recomendação:** Localizar o código do worker (pode estar em outro diretório ou ter sido deployado via CLI sem commit) e versioná-lo no repo imediatamente.

**RISCO BAIXO — Escala com volume alto.**  
`SKIP LOCKED` escala bem até ~1000 requests/minuto com um único banco Postgres. Para além disso, o gargalo seria o pg_cron (1 invocação/minuto) + round-trip HTTP do `net.http_post`. Se precisar de latência sub-segundo, pg_cron não serve — precisa de long-polling ou pg_notify.

### Veredicto: 7/10

O padrão está correto. A ausência do código versionado é preocupante para manutenibilidade.

---

## 3. AGENT-CRON-LOOP (Motor de Regras)

### O que foi analisado

1.061 linhas. Motor de regras configurável via tabela `agent_rules`. Executa cobrança escalonada (D1→D3→D7→D15→D30), alertas de produção, estoque, follow-up de leads, resumo diário noturno.

### Pontos fortes

- **Dedup robusto** por rule_name + entity_id + janela 24h (fix do falso-positivo entre rules diferentes — bom).
- **Safety guards**: emails @example.invalid e telefones de teste são pulos.
- **Escalonamento de cobrança** bem estruturado com 5 níveis + fallback de canal.
- **Horário comercial** respeitado (8h-23h BRT) com override `?force=1`.
- **Ciclo noturno** separado (22h) com memory patterns + resumo diário.
- **Templates de cobrança** com dados hardcoded (PIX, email) — correto.
- **`ensureConversationScheduled`** — fix inteligente que conecta rules ao fluxo real de follow-up.

### Riscos e problemas

**RISCO ALTO — SQL injection via `execute_sql_readonly`.**  
As queries de regras são construídas como strings SQL estáticas no switch/case. Não há interpolação de input do usuário, então não há SQL injection HOJE. Porém o pattern é frágil: se alguém adicionar uma regra que interpola dados do `agent_rules.condicao` direto na query string, abre brecha.

**Recomendação:** As queries hardcoded estão seguras. Documentar como regra de código: "NUNCA interpolar campos de `agent_rules` na query SQL. Usar parameterized queries ou filter via Supabase client."

**RISCO MÉDIO — Arquivo monolítico de 1.061 linhas.**  
Tudo está num único arquivo: handler HTTP, motor de regras, cobrança, Telegram, WhatsApp, email, follow-ups, nightly cycle, scores, helpers. Qualquer bug num subsistema exige navegar 1000+ linhas.

**Recomendação:** Extrair módulos:
- `rules-engine.ts` (evaluateRule, processAgentRules, wasRecentlyProcessed)
- `cobranca.ts` (executeCobranca, sendCobrancaEmail, templates)
- `notifications.ts` (sendTelegram, sendTelegramAlert, sendWhatsAppTemplate)
- `followups.ts` (processLeadFollowUps, ensureConversationScheduled)
- `nightly.ts` (processNightlyCycle)

**RISCO MÉDIO — Sem circuit breaker para serviços externos.**  
Se a API do Telegram estiver fora, o Resend caiu, ou o WhatsApp retorna 429, o cron loop continua tentando para cada match. Com 20 cobranças + 20 follow-ups = 40 chamadas HTTP potencialmente falhando, o loop pode demorar vários minutos e estourar o timeout da Edge Function (default 60s no Supabase).

**Recomendação:** Implementar timeout individual por chamada HTTP (5s) + contador de falhas consecutivas. Se 3 falhas seguidas no mesmo serviço, skip o resto daquele canal e registrar no log.

**RISCO BAIXO — `run_count` incremento não atômico.**  
Linha 241: `run_count: (rule as any).run_count + 1`. Se dois cron loops rodarem simultaneamente (improvável mas possível com force=1), o count pode perder incremento. Não é crítico — é métrica, não lógica.

**RISCO BAIXO — Dependência de views e RPCs que podem não existir.**  
`vw_estoque_disponivel`, `vw_resumo_diario`, `fn_recalcular_todos_scores`, `fn_detectar_padroes_memoria`, `execute_sql_readonly` — se alguma não existir, o catch silencia o erro. Funciona, mas dificulta diagnóstico.

### Veredicto: 7.5/10

Motor de regras bem implementado com boa lógica de negócio. Precisa de modularização e circuit breakers para produção sustentável.

---

## 4. CONSISTÊNCIA — 11 Edge Functions não redeployadas

### Diagnóstico

11 de 12 Edge Functions que usam `authenticateAndAuthorize` ainda estão com a versão antiga do `ai-helpers.ts`. Isso significa que chamadas inter-service (via `mcp-bridge-worker` ou `agent-cron-loop`) para essas funções retornarão 401.

### Risco real

**RISCO ALTO SE** o worker ou cron já estiver tentando chamar essas funções. Nesse caso, falhas silenciosas estão acontecendo agora em produção.

**RISCO MÉDIO SE** ninguém está chamando essas funções inter-service ainda — são chamadas apenas pelo frontend (que usa JWT de usuário, não service_role). Nesse caso, não há impacto imediato, mas a dívida cresce.

**Verificação necessária:** Consultar `ai_logs` para ver se alguma dessas 11 funções está sendo chamada com status='error' nas últimas 48h.

### Recomendação prática

Criar um script de deploy em batch:

```bash
#!/bin/bash
FUNCTIONS=(
  ai-analisar-orcamento
  ai-detectar-problemas
  ai-composicao-produto
  ai-briefing-producao
  ai-sugerir-compra
  ai-validar-nfe
  ai-insights-diarios
  ai-conciliar-bancario
  ai-sequenciar-producao
  ai-preco-dinamico
  ai-previsao-estoque
)

for fn in "${FUNCTIONS[@]}"; do
  echo "Deploying $fn..."
  supabase functions deploy "$fn" --no-verify-jwt=false
  echo "Done: $fn"
done
```

Depois rodar o teste 200/401 para cada uma.

**Para evitar isso no futuro:** Criar um `Makefile` ou script `deploy-all-ai.sh` que deploya TODAS as funções que compartilham `ai-helpers.ts` de uma vez. Nunca deployar `ai-helpers.ts` sem redeployar as dependentes.

### Veredicto: 6/10

Ter 11 de 12 funções desatualizadas é risco operacional. O fix é mecânico (batch deploy), mas a falta de processo para deploy coordenado é o problema real.

---

## 5. PADRONIZAÇÃO DE AUTENTICAÇÃO

### Diagnóstico

Existem 3 padrões de auth no sistema:

| Padrão | Onde | Problema |
|---|---|---|
| `authenticateAndAuthorize()` centralizado | 12 Edge Functions (Grupo A) | O bom — mas precisa redeploy |
| Auth inline com JWT decoder | `ai-compor-mensagem` (Grupo B) | Duplicação do fix S2.6 — cópia manual |
| Sem auth interna (depende de gateway ou HMAC) | `ai-gerar-orcamento`, `ai-chat-erp`, `whatsapp-webhook` (Grupo C) | OK para cada caso, mas inconsistente |

### Risco real

**RISCO MÉDIO — Duplicação de lógica de auth.**  
`ai-compor-mensagem` tem uma cópia manual do JWT decoder. Se o padrão em `ai-helpers.ts` mudar (ex: adicionar verificação de assinatura), a cópia em `ai-compor-mensagem` fica desatualizada.

### Recomendação

1. **Migrar `ai-compor-mensagem` para usar `authenticateAndAuthorize`**. Isso requer:
   - Adicionar `'compor-mensagem'` ao `AIFunctionName` type em `ai-types.ts`
   - Adicionar ao `AI_ROLE_ACCESS` com as roles permitidas
   - Substituir o bloco inline pelo `authenticateAndAuthorize(req, 'compor-mensagem')`

2. **Para Grupo C**: Documentar explicitamente POR QUÊ cada função não usa `authenticateAndAuthorize`. Criar comentário no topo de cada arquivo:
   ```typescript
   // AUTH: verify_jwt via gateway (frontend-only). Não usa authenticateAndAuthorize.
   // Motivo: [explicação]
   ```

3. **Para o futuro**: O `AIFunctionName` type é um union literal com 6 valores. Precisa ser expandido para incluir todas as funções que passam por `authenticateAndAuthorize`. Sem isso, TypeScript não pega erros de typo.

### Veredicto: 5/10

Múltiplos padrões de auth é um problema clássico. Aceitável temporariamente, inaceitável a longo prazo.

---

## 6. ESCALABILIDADE

### Cenário atual

- ~10-50 requests IA/dia (estimativa baseada no volume de operação)
- 1 worker rodando a cada 1 minuto via pg_cron
- 1 cron loop rodando a cada 30 minutos
- 1 usuário principal (Junior) + agente WhatsApp

### O que aguenta

| Métrica | Limite estimado | Gargalo |
|---|---|---|
| requests/dia | ~5.000 | pg_cron 1/min = 1.440 ciclos/dia × batch de ~3-5 = ~7.000 |
| Tempo de processamento do cron loop | ~60s (timeout Edge Function) | 40 matches × chamadas HTTP externas sem timeout individual |
| Edge Functions simultâneas | ~25 (Supabase free/pro) | Limite de concorrência do plano |
| OpenRouter calls/dia | Depende do budget | ~$5-10/dia com gpt-4.1-mini |

### O que quebraria primeiro

1. **Timeout do agent-cron-loop** — se houver muitos matches (ex: 50 cobranças + 20 follow-ups), as chamadas HTTP sequenciais para Telegram/Resend/WhatsApp podem passar de 60s. **Fix:** Processar em batches de 10, com circuit breaker.

2. **pg_cron scheduling** — 1 invocação/minuto é o máximo prático. Se o worker demorar >60s, invocações se acumulam. **Fix:** O SKIP LOCKED protege contra duplicação, mas o pg_cron vai empilhar net.http_post calls desnecessárias.

3. **Limite de concorrência de Edge Functions** — Supabase tem limite por plano. Se o cron loop, worker, webhook do WhatsApp, e 3 chamadas do frontend rodarem ao mesmo tempo, pode bater no limite. **Fix:** Monitorar `active_connections` no dashboard Supabase.

4. **Tabela `system_events` sem cleanup** — Cada execução de regra gera 1+ inserts em `system_events`. Com 30 rodadas/dia × 10 matches = 300 events/dia = 9.000/mês. Em 1 ano são 100k+ rows usadas apenas para dedup. **Fix:** TTL de 30-60 dias com pg_cron cleanup.

### Para múltiplos agentes

O sistema NÃO está pronto para múltiplos agentes independentes. O `agent-cron-loop` assume que é o único orquestrador. Se dois agentes rodarem regras diferentes, não há namespace isolation — `system_events` e `cobranca_automatica` seriam compartilhados sem conflito, mas `agent_conversations` poderia ter race conditions (dois agentes tentando follow-up no mesmo lead).

**Fix para o futuro:** Adicionar campo `agent_id` em `agent_conversations` e `ai_requests` para isolar contextos.

### Veredicto: 6/10

Escala bem para operação single-user single-agent até ~5.000 requests/dia. Precisa de refactoring para multi-agent ou volume alto.

---

## 7. DÍVIDA TÉCNICA CONSOLIDADA

### Itens críticos (resolver em < 2 semanas)

1. **Redeploy das 11 Edge Functions** — batch deploy + teste 200/401.
2. **Versionar `mcp-bridge-worker`** — código precisa estar no repo Git.
3. **Versionar migração `fn_claim_ai_requests`** — extrair DDL do banco e salvar como migration.
4. **Versionar migração `vw_ia_health`** — idem.

### Itens importantes (resolver em < 1 mês)

5. **Verificação de assinatura JWT** no `ai-helpers.ts` — não depender do gateway.
6. **Migrar `ai-compor-mensagem`** para `authenticateAndAuthorize` centralizado.
7. **Expandir `AIFunctionName` type** para cobrir todas as funções que usam auth.
8. **Circuit breaker** no agent-cron-loop para chamadas HTTP externas.
9. **TTL em `system_events`** — cleanup via pg_cron (30-60 dias).
10. **TTL em `ai_responses`** — já documentado, mesma mecânica.

### Itens de manutenção (resolver em < 3 meses)

11. **Modularizar agent-cron-loop** — extrair 5 módulos do monolito de 1.061 linhas.
12. **Upgrade `@testing-library/react`** — 11 testes quebrados por incompatibilidade React 19.
13. **Script `deploy-all-ai.sh`** — automatizar deploy coordenado de todas Edge Functions IA.
14. **Documentar padrão de auth** em cada Edge Function (comentário no topo).
15. **Adicionar `agent_id`** para isolamento multi-agent futuro.

---

## 8. NOTA FINAL

| Dimensão | Nota | Justificativa |
|---|---|---|
| **Maturidade técnica** | 6.5/10 | Padrões bons mas aplicados inconsistentemente. Código que deveria estar versionado não está. Types incompletos. |
| **Robustez** | 7/10 | Dedup funciona, SKIP LOCKED correto, safety guards presentes. Falta circuit breaker e verificação de assinatura JWT. |
| **Prontidão para produção real** | 6/10 | Funciona para o cenário atual (1 usuário, baixo volume). 11 funções desatualizadas é risco. Código fantasma (worker, migrations) é inaceitável em produção séria. |
| **MÉDIA PONDERADA** | **6.5/10** | |

### Resumo em uma frase

**O sistema tem uma base arquitetural sólida (SKIP LOCKED, motor de regras, escalonamento de cobrança, dedup por rule_name), mas sofre de inconsistência de deploy, código não versionado, e falta de automação no ciclo de release das Edge Functions.**

### O que eu faria nos próximos 3 dias se fosse o responsável

1. **Dia 1:** Localizar e versionar `mcp-bridge-worker` + migrations fantasma. Criar script `deploy-all-ai.sh`. Rodar batch deploy das 11 funções. Testar 200/401 em cada uma.
2. **Dia 2:** Adicionar verificação de assinatura JWT no `ai-helpers.ts`. Migrar `ai-compor-mensagem` para usar `authenticateAndAuthorize`. Expandir `AIFunctionName`.
3. **Dia 3:** Criar pg_cron jobs de cleanup (`system_events` 60d, `ai_responses` 30d). Adicionar circuit breaker básico no agent-cron-loop (3 falhas consecutivas → skip canal).

---

## CÓDIGO-FONTE ANALISADO

### Arquivos lidos diretamente do repositório

| Arquivo | Linhas | Conteúdo |
|---|---|---|
| `ai-shared/ai-helpers.ts` | 136 | Autenticação centralizada + CORS + helpers |
| `ai-shared/ai-types.ts` | 99 | Types, roles, costs |
| `agent-cron-loop/index.ts` | 1.061 | Motor de regras completo |
| `ai-analisar-orcamento/index.ts` | ~110 | Exemplo Grupo A (auth centralizada) |
| `ai-detectar-problemas/index.ts` | ~170 | Exemplo Grupo A com modo cron/manual |
| `ai-compor-mensagem/index.ts` | ~120 (auth section) | Grupo B (auth inline com fix S2.6) |
| `107_pg_cron_agent_loop.sql` | ~80 | pg_cron setup (4 jobs) |

### Arquivos NÃO encontrados no repositório

| Arquivo | Status | Risco |
|---|---|---|
| `mcp-bridge-worker/index.ts` | Não encontrado | **ALTO** — código fantasma |
| `133_fn_claim_ai_requests.sql` | Não encontrado | **ALTO** — migration fantasma |
| `132_vw_ia_health.sql` | Não encontrado | **MÉDIO** — migration fantasma |
