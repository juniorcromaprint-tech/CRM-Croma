# Mapa Completo de IA — Croma Print

> **Criado**: 2026-03-31 | **Propósito**: Entender exatamente o que existe, o que funciona, o que usa OpenRouter, e o que precisa mudar para centralizar tudo no Claude (Cowork/Desktop).

---

## A Visão: Claude como cérebro central

O Junior gerencia a Croma pelo celular. O Claude (via Cowork, Desktop, Telegram Channels) é quem executa: responde clientes, gera orçamentos, consulta preços reais, cadastra dados, analisa financeiro, etc. O Claude tem acesso completo ao sistema via MCP/Supabase.

**Regra**: Tudo que pode ser feito por IA passa pelo Claude. Não por modelos genéricos sem contexto.

---

## O que existe hoje — inventário completo

### Edge Functions DEPLOYADAS no Supabase (45 total)

#### GRUPO 1 — Agente de Vendas (fluxo principal)

| Edge Function | Versão | Usa OpenRouter? | Chamada por quem | O que faz |
|---|---|---|---|---|
| `whatsapp-webhook` | v15 | ✅ SIM — Claude via OpenRouter | Meta API (inbound) | Recebe msg do WhatsApp → gera resposta via Claude/OpenRouter → detecta intenção → gera orçamento se pedido → envia resposta → notifica Junior no Telegram |
| `whatsapp-enviar` | v10 | ❌ Não | Frontend ERP (botão manual) | Envia mensagem aprovada manualmente para WhatsApp via Meta API. Bug 401 corrigido em v10 |
| `ai-compor-mensagem` | v8 | ✅ SIM — modelo da config | Frontend ERP (botão "Compor") | Compõe mensagem de prospecção usando templates + modelo IA (hoje gpt-4.1-mini via OpenRouter) |
| `ai-decidir-acao` | v6 | ❌ Não (lógica pura) | Frontend ERP (botão "Executar Orquestrador") | Avalia conversas ativas e decide próxima ação (follow-up, encerrar, etc.). Sem IA |
| `ai-qualificar-lead` | v6 | ✅ SIM — modelo da config | Frontend ERP (botão "Qualificar") | Analisa lead e dá score 0-100 + temperatura + próxima ação |
| `ai-gerar-orcamento` | v1 | ✅ SIM — Claude via OpenRouter | `whatsapp-webhook` e `ai-compor-mensagem` | Extrai itens da conversa → busca preços reais no banco (motor Mubisys) → cria proposta real no CRM |
| `agent-enviar-email` | v7 | ❌ Não | Frontend ERP (botão enviar email) | Envia email aprovado de prospecção via SMTP |
| `agent-cron-loop` | v3 | ❌ Não | Scheduled task (cada 30min) | Motor de regras: 16 agent_rules (cobrança D1-D30, alertas estoque, follow-up leads, PCP) |
| `buscar-leads-google` | v6 | ❌ Não (Google API) | Frontend ERP (Descoberta de Leads) | Busca empresas no Google Maps para prospecção |
| `ai-detectar-intencao-orcamento` | v1 | ✅ SIM | Frontend ERP (AI Sidebar) | Detecta se conversa tem intenção de orçamento |

#### GRUPO 2 — IA do ERP (botões na AI Sidebar e telas)

| Edge Function | Versão | Usa OpenRouter? | Chamada por quem | O que faz |
|---|---|---|---|---|
| `ai-analisar-orcamento` | v12 | ✅ SIM | AI Sidebar | Analisa orçamento e sugere melhorias |
| `ai-resumo-cliente` | v9 | ✅ SIM | AI Sidebar | Gera resumo executivo do cliente |
| `ai-briefing-producao` | v9 | ✅ SIM | AI Sidebar | Gera briefing de produção para pedido |
| `ai-detectar-problemas` | v9 | ✅ SIM | AI Sidebar | Detecta problemas em pedidos/orçamentos |
| `ai-composicao-produto` | v9 | ✅ SIM | AI Sidebar | Sugere composição de materiais para produto |
| `ai-chat-erp` | v1 | ✅ SIM | ChatERP floating panel | Chat natural no ERP (pergunta → SQL → resposta) |
| `ai-chat-portal` | v2 | ✅ SIM | Portal do cliente | Chat para clientes no portal |
| `ai-insights-diarios` | v1 | ✅ SIM | Tela InsightsDiarios | Gera insights diários do negócio |
| `ai-inteligencia-comercial` | v1 | ✅ SIM | Não chamada pelo frontend ainda | Análise de inteligência comercial |

#### GRUPO 3 — IA de outros módulos

| Edge Function | Versão | Usa OpenRouter? | Chamada por quem | O que faz |
|---|---|---|---|---|
| `ai-classificar-extrato` | v1 | ✅ SIM | Tela ConciliacaoIA | Classifica lançamentos bancários |
| `ai-conciliar-bancario` | v1 | ✅ SIM | Tela ConciliacaoIA | Concilia extrato com contas a receber/pagar |
| `ai-validar-nfe` | v1 | ✅ SIM | Tela Fiscal | Valida NF-e antes de emitir |
| `ai-analisar-nps` | v1 | ✅ SIM | Não chamada ainda | Analisa respostas NPS |
| `ai-analisar-foto-instalacao` | v1 | ✅ SIM | Não chamada ainda | Analisa fotos de instalação |
| `ai-previsao-estoque` | v1 | ✅ SIM | Tela PrevisaoDemanda | Previsão de demanda de materiais |
| `ai-preco-dinamico` | v1 | ✅ SIM | Não chamada ainda | Sugestão de preço dinâmico |
| `ai-sugerir-compra` | v1 | ✅ SIM | Não chamada ainda | Sugestão de compra de materiais |
| `ai-sequenciar-producao` | v1 | ✅ SIM | Não chamada ainda | Sequenciamento de OPs |
| `ai-enviar-nps` | v1 | ❌ Não | Não chamada ainda | Envia pesquisa NPS |

#### GRUPO 4 — Não-IA (infraestrutura)

| Edge Function | O que faz |
|---|---|
| `fiscal-emitir-nfe`, `fiscal-consultar-nfe`, `fiscal-cancelar-nfe`, `fiscal-gerar-danfe`, `fiscal-sync-status`, `fiscal-inutilizar-nfe`, `fiscal-testar-certificado`, `fiscal-deploy-certificado` | Módulo fiscal NF-e (SEFAZ) |
| `enviar-email-proposta`, `enviar-email-campanha` | Envio de emails (SMTP) |
| `create-user`, `delete-user`, `delete-job` | Admin |
| `onedrive-criar-pasta`, `onedrive-upload-proposta` | Integração OneDrive |
| `resolve-geo` | Geocodificação |
| `enriquecer-cnpj` | Consulta CNPJ |
| `telegram-webhook` | Webhook do Telegram (TAMBÉM usa OpenRouter) |

---

## Resumo: 22 Edge Functions usam OpenRouter

**Todas** as funções de IA usam OpenRouter como provedor. Mesmo quando chamam `anthropic/claude-sonnet-4` (caso do whatsapp-webhook), a chamada passa pelo OpenRouter, não pela API da Anthropic diretamente.

---

## Os dois mundos do agente de vendas

### Mundo 1: INBOUND (cliente manda mensagem → resposta automática)

```
Cliente manda WhatsApp
  → Meta API chama whatsapp-webhook
    → Busca/cria lead no banco
    → Busca histórico da conversa
    → Gera resposta via Claude (OpenRouter) com system prompt completo da Croma
    → Detecta intenção ([INTENT:xxx])
    → Se orcamento/formalizar: chama ai-gerar-orcamento → cria proposta real com preços Mubisys
    → Envia resposta diretamente via Meta API
    → Notifica Junior no Telegram
```

**Status**: FUNCIONANDO. Testado com lead "Vih" — gerou orçamento real, enviou email, tudo automático.

### Mundo 2: OUTBOUND (agente prospecta leads proativamente)

```
Junior clica "Executar Orquestrador" no ERP
  → ai-decidir-acao avalia conversas ativas (lógica pura, sem IA)
  → Para cada lead que precisa de ação:
    → ai-compor-mensagem compõe mensagem (usa modelo OpenRouter da config + templates do banco)
    → Mensagem fica como "pendente_aprovacao"
    → Junior aprova no ERP
    → whatsapp-enviar ou agent-enviar-email envia
```

**OU automaticamente:**

```
agent-cron-loop roda a cada 30min
  → Executa 16 agent_rules (cobrança, follow-up, alertas)
  → Envia cobranças via WhatsApp/email
  → Notifica Junior via Telegram
```

**Status do outbound**: O cron-loop funciona para cobranças. A prospecção proativa (orquestrador + composição) EXISTE mas nunca foi usada na prática (templates com 0 usos). Usa OpenRouter com modelos genéricos que NÃO têm o contexto da Croma que o Claude tem.

---

## O problema central

O Claude (Cowork/Desktop) tem contexto completo da Croma: catálogo, preços, clientes, histórico. Mas as 22 Edge Functions de IA usam OpenRouter com modelos genéricos que recebem apenas o que está no prompt — um resumo limitado. Funciona razoavelmente para o webhook do WhatsApp (que tem um system prompt rico) mas é inferior ao que o Claude faz diretamente.

A decisão do dia 2026-03-30 foi clara: **OpenRouter ELIMINADO da arquitetura futura**. Mas na prática, as Edge Functions continuam usando.

---

## Plano de simplificação proposto

### Fase A — Eliminar confusão imediata (não quebra nada)

1. **Remover aba "Modelos IA" da config do agente** — os selects de modelo OpenRouter não fazem sentido se o Claude é quem opera. Essa aba só confunde.

2. **Limpar templates desativados** — deletar as 2 versões "v1" substituídas por "v2".

3. **Remover ou implementar "Auto-aprovação leads frios"** — o switch existe mas não faz nada.

4. **Limpar mensagens órfãs** — 4 mensagens na conversa da Vih com status "aprovada" que nunca foram enviadas (bug do 401 que já foi corrigido).

### Fase B — Centralizar no Claude (médio prazo)

Para cada função de IA do ERP que hoje usa OpenRouter, o caminho é:
- O botão no ERP, ao invés de chamar a Edge Function, envia o pedido para a **ponte MCP** (tabela `ai_requests`)
- O Claude (via scheduled task) lê os pedidos, processa com contexto completo, e grava a resposta em `ai_responses`
- O frontend pega a resposta

Isso já foi planejado (CROMA 4.0 Fase 1) e a infraestrutura existe (`ai_requests`, `ai_responses`, `useAIBridge.ts`). Falta migrar cada função.

### Fase C — Prospecção ativa pelo Claude (longo prazo)

Ao invés do orquestrador + ai-compor-mensagem via OpenRouter, o Claude avalia leads diariamente, compõe mensagens personalizadas com contexto completo, e envia via WhatsApp/email. Isso daria à prospecção outbound a mesma qualidade que o inbound já tem.

---

## O que NÃO mexer

- **whatsapp-webhook v15** — funciona, usa Claude via OpenRouter, é o coração do agente inbound
- **agent-cron-loop v3** — funciona, motor de regras, cobranças escalonadas
- **whatsapp-enviar v10** — recém corrigido, funciona
- **Templates de WhatsApp** — serão úteis quando a prospecção outbound for ativada
- **Config Geral** (limites, horários, canais) — usada pelo cron-loop e whatsapp-enviar
- **Config WhatsApp** (credenciais Meta) — essencial
- **16 agent_rules** — todas ativas e úteis
- **Edge Functions fiscais, email, admin** — não são IA, funcionam independente

---

*Este documento é a fonte de verdade sobre a arquitetura de IA da Croma. Atualizar quando houver mudanças.*
