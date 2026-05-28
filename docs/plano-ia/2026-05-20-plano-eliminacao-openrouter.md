# Plano — Eliminação do OpenRouter

> ⚠️ **STATUS 2026-05-20 NOITE — SUPERSEDED**
>
> Em sessão noturna 20/05, Junior decidiu **NÃO executar este plano agora**. OpenRouter continua ativo no `whatsapp-webhook` e nas 10 outras Edge Functions IA. Os bugs do agente WhatsApp NÃO eram OpenRouter (eram template/janela Meta + bug status='respondida' no webhook v35).
>
> **Para estado canônico atual ver `.planning/STATE.md` sessão 2026-05-20 NOITE.**
>
> Este documento fica como REFERÊNCIA do drop-in possível, caso seja revisitado. Não executar sem nova autorização.
>
> ---

# Plano original (mantido como referência)

> **Criado**: 2026-05-20 | **Autor**: Claude (Cowork) | **Status**: ~~Aguardando aprovação do Junior~~ SUPERSEDED 2026-05-20 NOITE
> **Decisão original**: 2026-03-30 ("OpenRouter ELIMINADO da arquitetura futura") — nunca executada
> **Trigger**: Junior pediu verificação em 2026-05-20 — achava que tinha sido feito; descobriu que não

---

## Resumo executivo

OpenRouter ainda está ativo em **11 Edge Functions** (não 22 como o MAPA-IA-CROMA.md indicava — várias foram removidas). O `whatsapp-webhook` v18 é uma delas: cliente manda mensagem → modelo `anthropic/claude-sonnet-4` via OpenRouter responde, com prompt estático, sem MCP.

A confusão veio do canal Telegram: a **Claudete** (`@Claudete_Juca_bot`) sim usa Claude direto via `anthropic-provider.ts` + MCP Server Croma. WhatsApp é um sistema separado.

## DESCOBERTA importante — o que JÁ foi feito (2026-04-24)

Junior lembrava que a "ponte completa" tinha sido feita. **Sim, parcialmente:**

Em 24/04 (Sprint Estabilização IA) foi entregue em produção:
- Tabelas `ai_requests` / `ai_responses` (migration 104, 29/03)
- `mcp-bridge-worker` Edge Function rodando via pg_cron 1min
- RPC atômica `fn_claim_ai_requests` (FOR UPDATE SKIP LOCKED)
- Hook `useAIBridge.ts` com polling 2s + fallback Edge Function

**MAS** — e aqui está o que o Junior não lembrava:

- O worker NÃO conecta no Cowork/Claude Max. Não tem "askClaude" do meu lado.
- Para `resumo-cliente` o worker tem um handler **LOCAL determinístico** (SQL puro, `cost_usd: 0`, `model_used: 'bridge-worker-local-v3'`). Não é IA — é função TypeScript que agrega dados do banco. Por isso aparenta "responder sem OpenRouter".
- Para os outros 4 tipos suportados (analisar-orcamento, detectar-problemas, briefing-producao, composicao-produto, qualificar-lead), o worker **re-invoca as Edge Functions `ai-*`** — que continuam usando OpenRouter. A ponte é só um intermediário burocrático.
- `whatsapp-webhook` nunca entrou na ponte.

## Limitação técnica que muda o plano

O sonho do Junior é "Claude Max via Cowork, respondendo cliente WhatsApp 24/7, sem API key intermediária". **Não dá pra entregar isso hoje**:

- Claude Max via Cowork exige sessão **aberta e ativa**. Cowork fechado = eu durmo.
- Anthropic não oferece modo headless do plano Max. Uso programático 24/7 = `ANTHROPIC_API_KEY` (cobra).
- Claude Agent SDK existe mas usa API key — não consome saldo Max.

Resultado: nenhuma arquitetura disponível hoje entrega "Claude Max servindo WhatsApp 24/7 sem API key". Pra WhatsApp inbound, ou paga API direto (sem OpenRouter), ou aceita janela de atendimento.

**A boa notícia**: a infra de drop-in já existe.

1. `anthropic-provider.ts` exporta `callOpenRouter = callAnthropic` (linha 93) — drop-in puro. Trocar 11 imports elimina OpenRouter, passa a pagar API Anthropic direto. Menos intermediário, mais qualidade, custo similar.
2. Ponte MCP existente pode ser reaproveitada para botões do ERP — usar Cowork (Claude Max sem custo) quando Junior está conectado.

**O que falta**: ajustar `mcp-bridge-worker` para chamar Cowork via tabela `ai_requests` (eu leio a fila ao abrir Cowork), e migrar 11 imports para o anthropic-provider.

---

## Inventário verificado

### 11 Edge Functions com `callOpenRouter()` ativo no código

| Função | Versão | Criticidade | Uso |
|---|---|---|---|
| `whatsapp-webhook` | v18 | **CRÍTICA** | Cliente WhatsApp manda msg → responde Claude/OpenRouter |
| `ai-gerar-orcamento` | v1 | **CRÍTICA** | Gera proposta REAL no CRM com preços Mubisys |
| `ai-qualificar-lead` | v6 | Alta | Score 0-100 + temperatura + próxima ação |
| `ai-compor-mensagem` | v8 | Média | Compõe msg de prospecção |
| `ai-detectar-intencao-orcamento` | v1 | Média | Detecta intent de orçamento em conversa |
| `ai-analisar-orcamento` | v12 | Baixa | Análise no AI Sidebar (uso baixo) |
| `ai-resumo-cliente` | v9 | Baixa | Resumo executivo cliente (AI Sidebar) |
| `ai-briefing-producao` | v9 | Baixa | Briefing produção (AI Sidebar) |
| `ai-detectar-problemas` | v9 | Baixa | Detecta problemas em pedidos (AI Sidebar) |
| `ai-composicao-produto` | v9 | Baixa | Composição materiais (AI Sidebar) |
| `ai-classificar-extrato` | v1 | Baixa | Classifica lançamentos bancários |

### Infra de ponte MCP existente

- `ai_requests` (id, tipo, entity_type, entity_id, contexto, status, solicitante_id, expires_at)
- `ai_responses` (id, request_id, conteudo, actions, summary, model_used, tokens_used, cost_usd, duration_ms)
- `useAIBridge.ts`: polling a cada 2s, timeout default 60s, fallback automático para Edge Function se Claude não responde
- 2 hooks específicos já criados: `useAnalisarOrcamentoBridge`, `useDetectarProblemasBridge`

### O gargalo da "ponte MCP completa" para WhatsApp

Junior escolheu Opção B (Ponte MCP completa). Funciona para os botões do ERP (Junior está conectado quando usa). **Não funciona para WhatsApp inbound**: cliente manda mensagem 3h da manhã → ponte espera consumidor → Cowork não está aberto → cliente fica sem resposta.

Resolução: ou (a) rodar um worker persistente (Python, no mesmo servidor da Claudete) que consome `ai_requests` e chama a Anthropic API com **Tool Use** apontando para o MCP Server Croma, ou (b) WhatsApp usa Claude direto via Anthropic API (drop-in) com Tool Use no próprio webhook.

A opção (b) é tecnicamente mais simples e dá o mesmo resultado: Claude com acesso ao MCP Croma respondendo 24/7. É o que vou recomendar abaixo.

---

## Plano em fases

### Fase 0 — Pré-checks (antes de qualquer mudança)

**Bloqueadores que precisam ser resolvidos antes de migrar:**

1. **Saldo da `ANTHROPIC_API_KEY`** — não consigo verificar billing via tools daqui. Junior abre `console.anthropic.com` → Settings → Billing → confirma saldo e limites. Como referência: a Claudete consome ~$X/dia hoje; WhatsApp inbound + 10 funções vai multiplicar isso por ~5-10×. Critério: ter pelo menos $50 de saldo + auto-recarga configurada.

2. **Segurança P0 do whatsapp-webhook** — auditoria de 2026-05-20 identificou 4 itens P0 que precisam ser resolvidos antes de religar o agente. Não estão neste plano (estão em `docs/qa-reports/2026-05-20-auditoria-leads-agente-vendas.md`). Recomendação: resolver P0 primeiro, migração depois.

3. **Backup da config atual** — exportar `admin_config` (modelos IA configurados), Edge Functions atuais e secrets. Permite rollback rápido se algo quebrar.

**Saída da Fase 0**: ✅ saldo ok, ✅ P0 segurança resolvido, ✅ backup salvo.

---

### Fase 1 — WhatsApp para Claude direto + Tool Use (1-2 dias)

**Por que essa abordagem e não a ponte pura**: WhatsApp precisa responder 24/7 sem depender do Cowork estar aberto. Claude direto via Anthropic API com Tool Use dá acesso ao MCP Server Croma sem precisar de worker intermediário.

**Mudanças:**

1. **`whatsapp-webhook/index.ts`** — trocar import:
   ```ts
   // de:
   import { callOpenRouter, setFallbackModel } from '../ai-shared/openrouter-provider.ts';
   // para:
   import { callOpenRouter, setFallbackModel } from '../ai-shared/anthropic-provider.ts';
   ```
   O alias `callOpenRouter = callAnthropic` já existe (linha 93 do anthropic-provider). Zero mudança em código de chamada.

2. **Adicionar Tool Use ao anthropic-provider** — expandir `callAnthropic()` para aceitar `tools` parameter mapeando para as ferramentas MCP Croma mais relevantes (croma_buscar_cliente, croma_consultar_preco_material, croma_criar_proposta_rascunho, croma_listar_propostas_cliente). Claude decide quando chamar, edge function executa via REST contra o MCP Server.

   - Alternativa mais simples (Fase 1a): drop-in puro sem tool use. Continua prompt estático, mas pelo menos elimina OpenRouter. Qualidade igual ao que tem hoje.
   - Versão completa (Fase 1b): tool use. Qualidade superior (Claude consulta dados reais).

3. **`setFallbackModel('claude-haiku-4-5-20251001')`** — fallback do Sonnet vira Haiku, não gpt-4.1-mini.

4. **Verificar `text_mode` e `response_format`** — o anthropic-provider atual não trata isso. Algumas funções (detectar-intent) usam `response_format: json_object`. Adicionar suporte: instruir Claude no system prompt a retornar JSON puro + parse via `extractJSON()` (lógica idêntica ao openrouter-provider linha 139).

**Rollback**: reverter o import. Edge function volta a usar OpenRouter. Cliente fica desservido por 5min no pior caso.

**Validação**:
- Testar em ambiente local primeiro (`supabase functions serve whatsapp-webhook`)
- Deploy em staging se houver, ou direto em produção com canary (10% dos números via feature flag em `admin_config`)
- Monitorar `agent_metrics` por 24h: taxa de erro, latência, custo
- Critério de sucesso: 0 erros de provider, latência ≤ 3s, custo ≤ 2× custo OpenRouter atual

---

### Fase 2 — `ai-gerar-orcamento` para Claude direto (1 dia)

Função crítica: cria propostas REAIS no CRM com preços Mubisys. Tratamento separado porque ela é chamada PELO `whatsapp-webhook` (cadeia), e qualquer erro aqui falha o webhook inteiro.

**Mudanças**:
1. Mesmo drop-in da Fase 1 (trocar import).
2. Auditar prompt — essa função tem 3 chamadas a `callOpenRouter()`. Verificar se todas se beneficiam do mapeamento Sonnet ou se alguma podia ir pra Haiku (mais barata).
3. **Resolver INT-003**: REQUIREMENTS.md aponta que `ai-gerar-orcamento` aceita chamada sem auth → anon key pode gerar propostas e queimar tokens. Adicionar HMAC ou JWT verify ANTES de migrar provider. Senão estamos só trocando o lado que sangra tokens.

**Rollback**: igual Fase 1.

---

### Fase 3 — 9 funções restantes do ERP (2-3 dias)

| Função | Estratégia | Justificativa |
|---|---|---|
| `ai-analisar-orcamento` | **Ponte MCP** (já tem hook) | Botão no ERP, Junior conectado |
| `ai-detectar-problemas` | **Ponte MCP** (já tem hook) | Idem |
| `ai-resumo-cliente` | Ponte MCP (criar hook) | Idem |
| `ai-briefing-producao` | Ponte MCP (criar hook) | Idem |
| `ai-composicao-produto` | Ponte MCP (criar hook) | Idem |
| `ai-qualificar-lead` | Drop-in Claude direto | Pode ser disparada por cron, não só botão |
| `ai-compor-mensagem` | Drop-in Claude direto | Idem (orquestrador outbound) |
| `ai-detectar-intencao-orcamento` | Drop-in Claude direto | Chamada por webhook |
| `ai-classificar-extrato` | Drop-in Claude direto | Uso baixo, pode ser batch |

**Para "Ponte MCP" funcionar de verdade**:
- Implementar **consumidor persistente** — opção A: script Python que roda como serviço Windows ao lado da Claudete, faz polling em `ai_requests` (status='pending'), chama Anthropic API com Tool Use → MCP, grava em `ai_responses`. Opção B: agente Cowork sempre ligado (frágil).
- Recomendo opção A. Pode reusar 80% do código da Claudete.
- Fallback no `useAIBridge.ts` continua apontando para Edge Function (segurança). Após validar a ponte por 30 dias, trocar fallback para o anthropic-provider direto (não OpenRouter).

**Para "Drop-in"**: igual Fase 1, só trocar import.

---

### Fase 4 — Limpeza (1 dia)

Só depois das Fases 1-3 estabilizadas por pelo menos 7 dias.

1. **Remover `OPENROUTER_API_KEY`** dos secrets das Edge Functions
2. **Revogar a chave** no painel OpenRouter (`openrouter.ai/keys`)
3. **Remover entrada `OPENROUTER_API_KEY` da `admin_config`** (estava marcada como risco em 2026-03-24 security-audit)
4. **Renomear `openrouter-provider.ts` → `openrouter-provider.ts.deprecated`** ou deletar
5. **Atualizar docs**: `.context/arquitetura.md`, `.planning/MAPA-IA-CROMA.md`, `.planning/PROJECT.md` — remover toda menção a OpenRouter como provider ativo, manter histórico como nota
6. **Atualizar `AIModelsTab.tsx`** — tela admin que ainda lista modelos OpenRouter
7. **Migration final**: limpar `ai_logs` ou marcar entries antigas com `provider='openrouter-legacy'`

---

## Riscos e mitigação

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| ANTHROPIC_API_KEY estourar limite no meio do dia | Média | Alto (agente para) | Fase 0 valida saldo + auto-recarga. Monitorar `agent_metrics.cost_ia` diário |
| Drop-in quebrar `response_format: json_object` | Alta | Médio | Testar cada função em staging. Anthropic não tem JSON mode nativo igual — usar instrução em prompt + `extractJSON()` |
| Tool Use lento (latência adicional) | Média | Médio | Limitar a 3 tools por turno. Pré-buscar contexto comum no system prompt como hoje. |
| Worker da ponte cair | Média | Alto (Fase 3) | Cron de healthcheck (igual Claudete). Notificar Junior via Telegram se parar > 5min |
| Migração quebrar fluxo de auto-orçamento via WhatsApp | Baixa | **CRÍTICO** | Canary deploy 10% → 50% → 100%. Manter Edge Function v18 atual como rollback de 1 comando |
| Custo Anthropic muito acima do OpenRouter | Média | Médio | Auditoria de 23/04 estimava $5-10/dia OpenRouter. Anthropic direto deve ficar 1.5-3×. Se passar disso, voltar parte para Haiku |

---

## O que NÃO está neste plano

- **`agent-cron-loop`** — não usa OpenRouter (lógica pura), continua igual.
- **`telegram-webhook`** — apesar do MAPA-IA-CROMA.md mencionar OpenRouter, hoje a Claudete tem fluxo separado (bot Python conecta direto à Anthropic + MCP). O webhook no Supabase é vestigial — verificar se ainda é chamado, se não, deprecar.
- **Funções padrão (`*.standalone.ts`)** — versões offline para testes, não rodam em produção. Migrar junto na Fase 4.
- **Funções não-IA** (fiscal, email, admin, OneDrive) — não usam OpenRouter.

---

## Próxima decisão do Junior

Antes de eu tocar em qualquer linha de código, preciso confirmação em 3 pontos:

1. **Aprova a abordagem híbrida acima** (WhatsApp/críticas via drop-in Anthropic direto, botões ERP via ponte MCP com worker Python), ou ainda insiste em ponte MCP pura para tudo (vai exigir worker persistente desde a Fase 1)?
2. **Quem implementa o worker da Fase 3** — eu desenho e Junior roda no servidor da Claudete, ou Junior prefere terceirizar/adiar?
3. **Janela de execução** — emergência (Fase 0+1 nas próximas 48h, antes de religar o agente) ou planejada (sprint dedicado de 1 semana com canary)?

Sem essas respostas, o plano fica em rascunho. Com as respostas, parto para implementação fase por fase, sempre com confirmação antes de aplicar em produção (regra #1 do CLAUDE.md).

---

*Documento será atualizado após decisões do Junior. Quando o plano for executado, mover para `docs/archive/plans/`.*
