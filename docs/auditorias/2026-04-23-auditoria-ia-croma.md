# Auditoria Completa — Agentes de IA da Croma Print

> **Data:** 2026-04-23
> **Auditor:** Claude (Cowork)
> **Contexto:** Croma 4.0 — empresa gerida por IA. Junior pediu diagnóstico do estado real dos agentes integrados ao CRM.
> **Fontes:** `.planning/MAPA-IA-CROMA.md`, `phases/FASE-3..5`, Obsidian vault, código real das Edge Functions, MCP Supabase (banco produção)

---

## TL;DR — o que está em pé, o que está caído

| Camada | Planejado | Real (hoje, 23/04/2026) | Gap |
|---|---|---|---|
| **Edge Functions IA** | 22 deployadas | 22 deployadas | ✅ em pé |
| **Uso das Edge Functions IA** | 22 em rotação | **3 chamadas em 30 dias** | 🔴 19 funções ociosas |
| **Agente WhatsApp v15** | Inbound automático | **Última msg 31/03** (23 dias parado) | 🟡 sem tráfego de cliente |
| **agent-cron-loop** | A cada 30min, 15 rules | Roda diário ~01:00 UTC — **mas só `follow_up_lead_24h` dispara, em loop de 100-191 por dia** | 🔴 motor de regras em loop vazio |
| **Cobrança automática D1→D30** | 5 níveis ativos | **ZERO cobranças enviadas na história** (`cobranca_automatica` vazia) | 🔴 regra aciona mas ação não executa |
| **Ponte Cowork→MCP** | Claude lê `ai_requests`, grava `ai_responses` | **2 requests em toda história, 0 responses** | 🔴 ponte existe mas nenhum fluxo realmente migrou |
| **Score de crédito (F4.2)** | 319 clientes | **319 calculados** | ✅ funcionando |
| **Memory layer (F4.3)** | 7 padrões auto-detectados | **4 padrões, todos seedados em 26/03, nenhuma atualização** | 🔴 cron noturno não atualiza memory |
| **Resumo diário Telegram 22h** | Via agent-cron-loop | Last cron_loop_executed **nunca registrado** | 🔴 ciclo noturno não roda |
| **AI Sidebar + 20 appliers** | 12 funções IA via OpenRouter | Código maduro, mas **3 usos em 30 dias** | 🟡 feature pronta, uso baixo |
| **ChatERP (F5)** | Chat natural em 3 estágios | Código existe, Edge Function `ai-chat-erp` deployada | 🟡 não há log de uso real |

**Veredicto geral:** a arquitetura de IA é **ampla e bem planejada**, o código das Edge Functions é **maduro**, mas a **camada de execução real tem buracos grandes** — regras acionam sem executar ações, o memory layer não aprende, a ponte MCP está morta. O agente WhatsApp funciona (foi testado com a lead "Vih"), mas não há tráfego inbound suficiente para exercitá-lo. A promessa de "empresa gerida por IA" está **30% real, 70% esqueleto vazio**.

---

## 1. Inventário — o que existe

### 1.1 Edge Functions de IA (22, deployadas)

**Grupo 1 — Agente de Vendas (inbound + outbound)**
| Edge | Versão | Provedor IA | Chamada por |
|---|---|---|---|
| `whatsapp-webhook` | v15 | Claude via OpenRouter | Meta API |
| `whatsapp-enviar` | v10 | — (HTTP puro Meta) | Botão ERP |
| `ai-compor-mensagem` | v8 | OpenRouter (gpt-4.1-mini) | ERP |
| `ai-decidir-acao` | v6 | lógica pura | ERP |
| `ai-qualificar-lead` | v6 | OpenRouter | ERP |
| `ai-gerar-orcamento` | v1 | OpenRouter + motor Mubisys | Webhook/ERP |
| `agent-enviar-email` | v7 | — (SMTP) | ERP |
| `agent-cron-loop` | v3 | lógica pura | Cron |
| `buscar-leads-google` | v6 | Google Maps API | ERP |
| `ai-detectar-intencao-orcamento` | v1 | OpenRouter | AI Sidebar |

**Grupo 2 — IA do ERP (AI Sidebar + telas)**
`ai-analisar-orcamento`, `ai-resumo-cliente`, `ai-briefing-producao`, `ai-detectar-problemas`, `ai-composicao-produto`, `ai-chat-erp`, `ai-chat-portal`, `ai-insights-diarios`, `ai-inteligencia-comercial`

**Grupo 3 — outros módulos**
`ai-classificar-extrato`, `ai-conciliar-bancario`, `ai-validar-nfe`, `ai-analisar-nps`, `ai-analisar-foto-instalacao`, `ai-previsao-estoque`, `ai-preco-dinamico`, `ai-sugerir-compra`, `ai-sequenciar-producao`, `ai-enviar-nps`

### 1.2 AI Sidebar — 20+ appliers de contexto

Localização: `src/domains/ai/`. Estrutura madura com:
- 15 appliers por domínio (cliente, composicao, orcamento, problemas, producao)
- 8 hooks especializados (`useAnalisarOrcamento`, `useBriefingProducao`, `useComposicaoProduto`, `useDetectarProblemas`, `useResumoCliente`, `useDetectarIntencaoOrcamento`, `useAlertasAI`, `useAIBridge`)
- Sidebar com gradient blue-600 → blue-700, checkboxes, barra de aplicar, Apply Bar
- 11 testes automatizados (.test.tsx / .test.ts)
- Hook `useAIBridge.ts` = integração com ai_requests/ai_responses (ponte Cowork→MCP)

### 1.3 Tabelas de suporte IA

`ai_logs` (function_name, tokens, custo, duração) · `ai_memory` (padrões com confiança) · `ai_requests/ai_responses` (ponte MCP) · `agent_conversations/agent_messages` (WhatsApp) · `agent_rules` (motor de regras) · `cobranca_automatica` · `system_events` · `business_intelligence_config`

### 1.4 Motor Mubisys — precificação em 9 passos

Em `ai-shared/pricing-engine.ts`. Consulta `materiais` (467), `produto_modelos` (156), `regras_precificacao` (11 categorias). Usado por `ai-gerar-orcamento` e pelo frontend.

---

## 2. Achados críticos — estado real no banco

### 2.1 🔴 Motor de regras em loop vazio (CRÍTICO)

**Evidência:**
- `system_events` dos últimos 14 dias: 533 `rule_executed` + 533 `alert_generated`
- Distribuição: **100–191 execuções/dia**, todas da mesma regra `follow_up_lead_24h`
- `cobranca_automatica` (tabela de execução real): **0 registros na história**
- `cron_loop_executed`: **nunca gravado** (bug de logging do cron)

**Diagnóstico:** O `agent-cron-loop` está rodando via scheduled task, dispara a regra `follow_up_lead_24h` contra os 402 leads importados em bulk no dia 02/04, mas:
1. Os leads são **frios demais** (importação sem enriquecimento) — nenhum tem `contato_telefone` ou `contato_email` validado para o follow-up ter algum efeito
2. A **ação** (`enviar mensagem` / `enviar email`) provavelmente retorna erro silencioso ou não está conectada
3. O log de execução do cron (`cron_loop_executed`) não grava, então não dá para ver duração, falhas, etc.
4. A regra não tem deduplicação funcional — repete os mesmos leads dia após dia

**Impacto:** Custo de infraestrutura + poluição de `system_events` + sensação de "está rodando" mas nada está saindo. Pior: se o Junior olhar o dashboard, vê "191 regras executadas hoje" e pensa que IA está funcionando.

### 2.2 🔴 Zero cobranças enviadas em toda a história

**Evidência:**
```
cobrancas_total: 0
cobrancas_enviadas: 0
cobrancas_30d: 0
```

**Diagnóstico:** Das 5 regras de cobrança escalonada (`cobranca_d1`, `d3`, `d7`, `d15`, `d30`), **nenhuma** disparou uma cobrança real. Possíveis causas:
- Não há contas a receber vencidas com cliente elegível (contas_receber: 2 registros totais no banco)
- Os templates exigem dados (`{cliente}`, `{pedido}`, `{valor}`) que não batem com o schema real
- A função `executeCobranca` (agent-cron-loop linha ~400) pode estar falhando silenciosamente

**Verificar:** rodar manualmente uma invocação do `agent-cron-loop` com log verbose e ver onde a cadeia quebra em produção.

### 2.3 🔴 Memory layer estagnado

**Evidência:**
- 4 padrões em `ai_memory`
- Todos seedados em **2026-03-26** (há 28 dias)
- `observacoes_count = 1` em todos — ou seja, nunca foi reforçado
- O "ciclo noturno 22h" que deveria detectar padrões (Fase 4.3) **nunca executou**

**Diagnóstico:** O código do `processNightlyCycle` está no `agent-cron-loop/index.ts`, mas:
- Condição `if (brtHour === 22)` — só roda se o cron bater exatamente entre 22:00–22:59 BRT
- A task `jarvis-obsidian-diario` roda 22h **localmente no PC do Junior**, mas a scheduled task do Supabase que dispara o cron-loop pode estar fora desse horário
- `ultimo_cron` (via `cron_loop_executed`) é `null` — sem evidência de que o ciclo noturno já executou uma vez

**Impacto:** A IA "não aprende" com a operação. Cada dia é zero.

### 2.4 🔴 Ponte Cowork → MCP praticamente morta

**Evidência:**
```
ai_requests total: 2
ai_requests pending: 0
ai_requests últimos 7 dias: 0
ai_responses total: 0
```

**Diagnóstico:** A Fase 1 da Croma 4.0 construiu a infra (tabelas + hook `useAIBridge.ts`), mas **nenhum fluxo real foi migrado**. A ideia era que botões de IA no ERP parassem de chamar OpenRouter e passassem a gravar em `ai_requests`, esperando Claude (Cowork) responder via `ai_responses`. Na prática:
- Os botões continuam chamando as Edge Functions (que usam OpenRouter)
- O `useAIBridge` está codado mas **nenhum componente o usa** para gravar request
- A tabela `ai_responses` nunca teve 1 linha sequer

**O que existe vs o que falta:**
| Item | Status |
|---|---|
| Tabela `ai_requests` | ✅ criada |
| Tabela `ai_responses` | ✅ criada |
| Hook `useAIBridge.ts` | ✅ criado |
| RLS / triggers de notificação | ✅ existem |
| Botão no ERP que escreve em ai_requests | ❌ nenhum |
| Scheduled task que Claude lê/processa | ❌ não existe |
| Componente que lê ai_responses e renderiza | ❌ nenhum |

### 2.5 🟡 Agente WhatsApp em pausa (não é bug, é falta de tráfego)

**Evidência:**
- Última `agent_messages.created_at`: **2026-03-31 14:10** (há 23 dias)
- 4 conversas totais (1 escalada, 3 ativas)
- 53 recebidas / 51 enviadas — mas 50 das 53 foram da conversa da lead "Vih" em 30/03
- `ai_logs` não tem entradas de `auto-resposta-whatsapp` em 30 dias → consistente

**Diagnóstico:** O código do webhook v15 está robusto:
- Dedup por `whatsapp_message_id` ✓
- HMAC validation ✓
- Detecção de escalação (ESCALATION_KEYWORDS) ✓
- `checkDadosFaltantes()` coleta nome/email/empresa/cidade ✓
- `tryUpdateLeadFromMessage()` extrai dados do texto ✓
- Dispatch de `[INTENT:orcamento/formalizar]` → `ai-gerar-orcamento` → proposta real ✓
- Envio de email SMTP com portal link ✓
- PIX/email hardcoded corretos ✓

**O que acontece na prática:** o pipeline não quebra porque **ninguém manda WhatsApp para o número da Croma**. Junior continua respondendo clientes pelo celular dele. O número oficial do agente não está divulgado nos canais de prospecção (site, Instagram, cartão).

### 2.6 🟡 Duplicação de `agent_rules` (sistema velho vs novo)

**Evidência:**
- 31 regras totais, **16 ativas + 15 inativas**
- Ativas: snake_case (`cobranca_d1`, `follow_up_lead_24h`, etc.) — Fase 3.1
- Inativas: Title Case (`Cobrança D+1`, `Follow-up lead 7d`, etc.) — schema antigo da auditoria de março
- Nomes DIFERENTES, não são duplicatas literais

**Diagnóstico:** Migração inacabada — quando a Fase 3 foi implementada, seedaram 16 novas regras padronizadas e **desativaram** as 15 antigas (ao invés de deletar). O motor lê só `ativo=true`, então não atrapalha. Mas polui a UI de admin (tela de regras mostra 31 linhas, confunde).

### 2.7 🟡 Uso das Edge Functions IA do ERP (AI Sidebar) é ~zero

**Evidência (ai_logs últimos 30 dias):**
| Função | Chamadas | Última | Custo |
|---|---|---|---|
| analisar-orcamento | 1 | 12/04 | $0,0037 |
| detectar-problemas | 1 | 26/03 | $0,0020 |
| resumo-cliente | 1 | 06/04 | $0,0010 |
| **Todas as outras 19** | **0** | — | $0 |

**Diagnóstico:** As 20+ appliers da AI Sidebar estão **codados, testados e deployados**, mas o Junior não abre a sidebar no dia-a-dia. Isso não é falha de código — é falha de adoção / ritual de uso. Possivelmente porque:
- Não há onboarding/tutorial que mostre o valor
- As respostas genéricas de OpenRouter (gpt-4.1-mini) não são melhores do que perguntar direto ao Claude (Cowork)
- O loop é: Junior → Claude (Cowork) → fala com banco via MCP → responde ao Junior. Por que abrir a sidebar?

### 2.8 ✅ O que efetivamente FUNCIONA

- **Score de crédito (Fase 4.2)** — 319/319 clientes calculados ✓
- **MCP Server Croma** — 93 ferramentas, 100% cobertura ✓
- **Motor Mubisys** — preços reais no banco, 464 materiais ✓
- **whatsapp-webhook v15** — código maduro, pronto para tráfego ✓
- **ai-gerar-orcamento** — integração Mubisys + cria proposta real ✓
- **Portal cliente + tracking + pagamento** — funciona ✓
- **Email SMTP via Edge Function** — testado com Vih em 30/03 ✓

---

## 3. Arquitetura — o desalinhamento com a visão

A visão declarada em `MAPA-IA-CROMA.md` (2026-03-31):

> "O Claude (Cowork/Desktop) tem contexto completo da Croma. [...] A decisão do dia 2026-03-30 foi clara: **OpenRouter ELIMINADO da arquitetura futura**. Mas na prática, as Edge Functions continuam usando."

### 3.1 Status dessa decisão

| Item | Decisão (30/03) | Real (23/04) |
|---|---|---|
| Remover aba "Modelos IA" da config | Plano | ⬜ não feito |
| Deletar templates v1 desativados | Plano | ⬜ não feito |
| Implementar ou remover "Auto-aprovação leads frios" | Plano | ⬜ não feito |
| Limpar mensagens órfãs da Vih | Plano | ⬜ não feito |
| Centralizar botões de IA na ponte MCP | Plano | ⬜ não feito |
| Eliminar OpenRouter | Plano | 🔴 22 funções ainda usam |

### 3.2 Dois caminhos arquiteturais coexistem — sem sincronia

**Caminho A — Edge Functions + OpenRouter** (o que roda hoje)
- 22 Edge Functions chamam `callOpenRouter()`
- Modelos genéricos (gpt-4.1-mini, claude-sonnet-4 via proxy)
- Latência ~2-4s
- Custo $0,001-0,005 por chamada
- **Funciona, mas é inferior ao Claude direto**

**Caminho B — Ponte Cowork→MCP** (o que deveria estar migrando)
- Frontend grava `ai_requests`
- Claude (Cowork) lê via scheduled task, processa, grava `ai_responses`
- Frontend faz polling e exibe
- **Nunca foi exercitado além das 2 linhas iniciais**

**Consequência:** dois sistemas em paralelo, nenhum sendo a "fonte da verdade". Junior não sabe qual é o canônico. Documentação diz uma coisa, código diz outra.

---

## 4. Prioridades de ação — o que mexer primeiro

### 🔴 P0 — corrigir hoje/amanhã

| # | Ação | Esforço | Por quê |
|---|---|---|---|
| P0.1 | Investigar o loop do `follow_up_lead_24h` — por que 100-191 execuções/dia sem saída real? Adicionar dedup por lead_id + last_executed_at | 2-3h | Evita poluição de events + custo desnecessário |
| P0.2 | Corrigir logging do `cron_loop_executed` (o evento não está sendo gravado) | 30min | Sem isso não dá para observar o cron |
| P0.3 | Rodar `agent-cron-loop` manualmente com 1 conta_receber vencida real → verificar se cobrança sai | 1h | Testar se a cadeia D1→D30 realmente funciona |
| P0.4 | Remover ou implementar a aba "Modelos IA" da config do agente (pendência desde 30/03) | 1h | Reduz confusão na UI |

### 🟡 P1 — esta semana

| # | Ação | Esforço | Por quê |
|---|---|---|---|
| P1.1 | Ativar o tráfego inbound do WhatsApp — divulgar o número oficial (site, Instagram, cartão) | 2h + marketing | Sem tráfego, o agente não justifica existir |
| P1.2 | Rodar o ciclo noturno manualmente (`processNightlyCycle`) e ver se memory layer ganha padrões novos | 1h | Validar Fase 4.3 |
| P1.3 | Deletar as 15 regras antigas inativas de `agent_rules` | 15min | Limpeza |
| P1.4 | Remover ou relançar as 12 Edge Functions IA que nunca foram usadas (analisar-nps, preco-dinamico, sequenciar-producao, etc.) | 2h | Custo zero, mas infra de manutenção |

### 🟢 P2 — próximas 2 semanas

| # | Ação | Esforço | Por quê |
|---|---|---|---|
| P2.1 | Escolher UM fluxo-piloto para migrar da OpenRouter para a Ponte Cowork→MCP (sugestão: `ai-resumo-cliente`) | 1-2 dias | Provar que o caminho B funciona na prática |
| P2.2 | Criar scheduled task que roda Claude (via Cowork headless ou Claudete bot) a cada 5min processando `ai_requests` pending | 1 dia | Coração do caminho B |
| P2.3 | Adicionar dashboard `/admin/ia/health` — mostra: custo por função, loops, memory, pendências da ponte | 4h | Observabilidade |
| P2.4 | Integrar Claudete bot Telegram ao `ai-chat-erp` — Junior pergunta "quanto faturamos?" e recebe via Telegram | 1 dia | F5.4 do roadmap, alto valor |

### 🔵 P3 — mês

| # | Ação | Esforço |
|---|---|---|
| P3.1 | Revisitar os 20 appliers da AI Sidebar — quais o Junior realmente abriria? Cortar 10, iterar nos 10 restantes | 3-5 dias |
| P3.2 | Resumo diário 22h funcional com envio para Telegram | 2 dias |
| P3.3 | Detecção automática de 7 padrões em `ai_memory` (Fase 4.3 completa) | 3 dias |
| P3.4 | Migrar 3 fluxos-chave da OpenRouter para a Ponte MCP (gerar-orcamento, analisar-orcamento, chat-erp) | 5-7 dias |

---

## 5. Risco vs potencial

### Riscos se nada for feito
- O sistema continua parecendo "pronto" mas está inerte. Impressão ruim em demos.
- Custo de OpenRouter silencioso (hoje ~$0,01/dia, mas escalaria com uso).
- Quando o tráfego WhatsApp crescer, bugs não-detectados vão aparecer em produção.
- Memory layer parado = score de crédito e precificação não melhoram sozinhos (precisam feedback loop).
- Narrativa "empresa gerida por IA" perde credibilidade se um jornalista ou investidor auditar.

### Potencial se P0+P1+P2 forem executados
- Cron funcional + cobrança saindo = economia de ~10h/mês do Junior
- Inbound WhatsApp ativo = 5-10 leads/mês convertidos pelo agente sozinho
- Ponte MCP viva = 1 fluxo real migrado prova o caminho para os outros 21
- Memory layer aprendendo = scores e pricing ficam melhores automaticamente
- Credibilidade: cada seção do cockpit mostra "automação ativa há X dias, Y ações executadas"

---

## 6. Resumo em 5 linhas para o Junior

1. **Código de IA está maduro** (22 Edge Functions, AI Sidebar completa, WhatsApp v15 robusto, Score de crédito 100%)
2. **Execução real tem 4 buracos graves:** loop vazio do follow-up, zero cobranças saindo, memory parado, ponte MCP morta
3. **Inbound WhatsApp está pronto mas sem tráfego** — precisa divulgar o número
4. **A decisão "matar OpenRouter" do dia 30/03 nunca foi executada** — dois sistemas em paralelo sem canônico
5. **Próximo passo mais valioso**: fix do cron + ativar tráfego WhatsApp + migrar UM fluxo-piloto para a Ponte MCP. Nessa ordem.

---

## Fontes

- `.planning/MAPA-IA-CROMA.md` (31/03/2026)
- `.planning/phases/FASE-3-AUTOMACAO-FLUXO.md`
- `.planning/phases/FASE-4-INTELIGENCIA.md`
- `.planning/phases/FASE-5-CONVERSACIONAL.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `Obsidian → 10-Projetos/Croma-Print/Croma-Print.md`
- `Obsidian → 10-Projetos/Croma-Print/aprendizados/aprendizado-whatsapp-v14-agente.md`
- `Obsidian → 99-Meta/memory.md` (sessões 23/04, 22/04, 21/04, 20/04)
- `supabase/functions/whatsapp-webhook/index.ts` (v15, 1200+ linhas)
- `supabase/functions/ai-gerar-orcamento/index.ts`
- `supabase/functions/agent-cron-loop/index.ts`
- `supabase/functions/ai-chat-erp/index.ts`
- `src/domains/ai/` (63 arquivos: appliers, hooks, components, tests)
- MCP Supabase: `ai_logs`, `agent_conversations`, `agent_messages`, `agent_rules`, `system_events`, `cobranca_automatica`, `ai_requests`, `ai_responses`, `ai_memory`, `clientes`

---

*Auditoria concluída em 2026-04-23 por Claude (Cowork). Duração: ~40min. Método: leitura dos 9 arquivos de planejamento + vault Obsidian + código real + 11 consultas SQL no banco produção via MCP Supabase.*
