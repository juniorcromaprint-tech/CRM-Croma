# CROMA 4.0 — Plano de Autonomia Total

**Versão:** 1.0
**Data:** 2026-03-29
**Autor:** Claude (Cérebro Administrativo da Croma Print)
**Missão:** Tornar a Croma Print a primeira empresa de comunicação visual gerida por IA

---

## VISÃO

Junior chega na empresa e encontra tudo pronto: clientes contatados, leads prospectados, orçamentos feitos, arquivos recebidos para impressão organizados, produção planejada, rotas de entrega e instalação geradas. Humanos fazem apenas o trabalho físico: imprimir, instalar, entregar.

**Divisão definitiva:**

| Claude (IA) | Humanos |
|---|---|
| Prospecção e captação de leads | Impressão e acabamento |
| Contato inicial e follow-up | Instalação em campo |
| Orçamentos e propostas | Entrega física |
| Aprovação e geração de pedidos | Manutenção de máquinas |
| Planejamento de produção (PCP) | Conferência visual de qualidade |
| Compras e estoque | |
| Financeiro (cobrança, conciliação) | |
| Relatórios e decisões estratégicas | |

---

## DIAGNÓSTICO — ONDE ESTAMOS

### O que já funciona (70% do sistema)

O ERP-Croma já tem 160+ tabelas, 30 Edge Functions, 16 módulos, 102 testes. O roadmap de 20 requirements foi 100% entregue. O fluxo Lead→Faturamento está completo no código.

**Módulos operacionais:**
- Comercial: leads, clientes, oportunidades, propostas, portal aprovação
- Orçamento: motor Mubisys (9 passos), 464 materiais, 156 modelos, 17 acabamentos
- Pedidos: conversão proposta→pedido, status machine, contas a receber automáticas
- Produção: OP, etapas, apontamentos, Gantt, PCP
- Instalação: App Campo PWA com fotos, checklist, assinatura, geolocalização
- Financeiro: dashboard, boletos CNAB, fluxo de caixa, DRE, aging
- Estoque: reservas, alertas mínimo, movimentos
- Fiscal: NF-e em homologação, 8 Edge Functions
- IA: AISidebar com 6 appliers, análise de orçamento, detecção de problemas

### O que falta para autonomia total (30%)

1. **Agente de Vendas desconectado** — código existe mas WhatsApp não conectado, cron não agendado, 0 dados nas tabelas do agente
2. **Eventos sem triggers formais** — production_completed, installation_completed, payment_received, payment_overdue não disparam automação
3. **Prospecção passiva** — Google Search implementado mas não roda automaticamente
4. **Cobrança manual** — inadimplentes identificados mas sem ação automática
5. **PCP reativo** — sequenciamento manual, sem replanning automático
6. **Sem ponte Claude↔ERP** — botões do sistema usam OpenRouter em vez do Claude
7. **Memory Layer ausente** — sem aprendizado de padrões, score de crédito, curva de produção
8. **Dashboard executivo incompleto** — BI a 40%, falta cockpit unificado

---

## ARQUITETURA CROMA 4.0

```
┌─────────────────────────────────────────────────────┐
│                    JUNIOR (Telegram)                  │
│            Comandos de voz, aprovações, campo         │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              CLAUDE — CÉREBRO CENTRAL                │
│                                                       │
│  ┌─────────┐  ┌──────────┐  ┌─────────────────┐     │
│  │ Channels │  │ MCP Croma│  │ Supabase MCP    │     │
│  │(Telegram)│  │(26 tools)│  │(SQL, migrations)│     │
│  └─────────┘  └──────────┘  └─────────────────┘     │
│                                                       │
│  Orquestração: skill croma-orchestrator               │
│  Decisões: contexto completo do negócio               │
│  Custo: ZERO (incluído no plano Claude)               │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                  CAMADA DE AÇÕES                      │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ WhatsApp │  │  Email   │  │  ERP Frontend    │   │
│  │ Business │  │ (Resend) │  │  (React UI)      │   │
│  │   API    │  │          │  │                   │   │
│  └──────────┘  └──────────┘  └──────────────────┘   │
│                                                       │
│  OpenRouter: APENAS para respostas instantâneas       │
│  (WhatsApp auto-reply em <5s quando Claude offline)   │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                SUPABASE (Backend)                     │
│                                                       │
│  PostgreSQL · Auth · Storage · Edge Functions         │
│  Triggers · Cron Jobs · Realtime                     │
│  160+ tabelas · RLS · Audit logs                     │
└─────────────────────────────────────────────────────┘
```

### Princípio de custo

| Canal | Provider | Custo |
|---|---|---|
| Botões do ERP (análise, problemas, briefing) | Claude via MCP Bridge | R$ 0 |
| Consultas via Telegram | Claude Channels | R$ 0 |
| Orquestração e decisões | Claude Channels/MCP | R$ 0 |
| Resposta automática WhatsApp (quando Claude offline) | OpenRouter gpt-4.1-mini | ~R$ 15/mês |
| Follow-ups automáticos do agente | OpenRouter gpt-4.1-mini | ~R$ 10/mês |

**Meta: reduzir custo de IA de ~R$ 80/mês para ~R$ 25/mês** eliminando OpenRouter onde Claude substitui.

---

## FASES DE IMPLEMENTAÇÃO

### FASE 1 — Infraestrutura de Autonomia (Imediato)
> **Esforço:** 3-5 dias | **Prioridade:** CRÍTICA
> **Objetivo:** Criar as fundações para que Claude opere autonomamente

#### 1.1 Ponte MCP (ai_requests/ai_responses)
Permite que botões do ERP peçam análise ao Claude em vez do OpenRouter.

**Como funciona:**
1. Usuário clica "Analisar Orçamento" no frontend
2. Frontend salva em `ai_requests` (tipo, entity_id, contexto)
3. Claude monitora a tabela via MCP (polling ou Realtime)
4. Claude processa, analisa e salva resposta em `ai_responses`
5. Frontend recebe via Supabase Realtime e mostra ao usuário

**Tabelas:**
```sql
CREATE TABLE ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,              -- 'analisar-orcamento', 'detectar-problemas', etc.
  entity_type TEXT NOT NULL,       -- 'proposta', 'pedido', 'cliente'
  entity_id UUID,
  contexto JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',   -- pending, processing, completed, error
  solicitante_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT now() + interval '1 hour'
);

CREATE TABLE ai_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES ai_requests(id),
  conteudo JSONB NOT NULL,         -- resposta estruturada do Claude
  actions JSONB DEFAULT '[]',      -- ações aplicáveis (appliers)
  model_used TEXT DEFAULT 'claude',
  tokens_used INT DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Fallback:** Se Claude não responder em 60s, Edge Function com OpenRouter processa automaticamente.

#### 1.2 Triggers de Eventos Formais
Criar triggers para os 4 eventos que faltam:

| Evento | Trigger | Ação automática |
|---|---|---|
| `production_completed` | Quando todas as etapas da OP = concluído | Notifica instalação, atualiza pedido |
| `installation_completed` | Quando checklist finalizado + assinatura | Gera NF-e, atualiza status pedido |
| `payment_received` | Quando baixa bancária confirmada | Atualiza conta_receber, notifica |
| `payment_overdue` | Job diário verifica vencimentos | Envia cobrança WhatsApp/email |

#### 1.3 Desativar Telegram Webhook
Remover webhook do Telegram (redundante com Channels). Manter a Edge Function no código para referência, mas não ativa.

#### 1.4 Scheduled Task — Orquestração Diária
Criar skill `croma-orchestrator` que roda automaticamente:

**Rotina matinal (08:00):**
- Verificar inadimplentes e disparar cobranças
- Verificar leads sem follow-up há >24h
- Verificar propostas pendentes há >48h
- Verificar estoque abaixo do mínimo
- Gerar resumo executivo do dia para Junior

**Rotina contínua (a cada 30min, 08:00-20:00):**
- Processar ai_requests pendentes
- Verificar novas mensagens WhatsApp
- Verificar novos leads para qualificação

**Rotina noturna (22:00):**
- Fechamento do dia (KPIs, faturamento, produção)
- Planejar produção do dia seguinte
- Enviar relatório para Junior via Telegram

---

### FASE 2 — Agente de Vendas Completo (Semana 2)
> **Esforço:** 5-7 dias | **Prioridade:** ALTA
> **Objetivo:** WhatsApp respondendo automaticamente, prospecção ativa

#### 2.1 WhatsApp Business API
**Pré-requisitos (Junior precisa fazer):**
- Adquirir chip dedicado para o agente
- Criar conta Meta Business Manager
- Verificar negócio no Meta Business

**Configuração técnica:**
- Edge Function `whatsapp-webhook` para receber mensagens
- Edge Function `whatsapp-enviar` para enviar (já existe)
- Template `croma_abertura` para primeiro contato
- Template `croma_followup` para follow-up
- Template `croma_cobranca` para cobrança

**Fluxo de resposta:**
```
Cliente envia WhatsApp
  → webhook recebe
  → Verifica se Claude está online (ai_requests)
  → Se sim: Claude processa via MCP (resposta inteligente com contexto completo)
  → Se não: OpenRouter gpt-4.1-mini responde (resposta básica em <5s)
  → Resposta enviada via WhatsApp API
  → Conversa logada em agent_conversations
```

#### 2.2 Prospecção Automática
Ativar busca automática de leads por segmento:
- Buscar empresas de varejo/franquias no Google
- Enriquecer CNPJ via ReceitaWS
- Qualificar automaticamente (score)
- Enviar primeiro contato via WhatsApp/email
- Agendar follow-up automático

**Frequência:** 5 novos leads/dia (configurável)

#### 2.3 Seed de Templates e Dados do Agente
Popular tabelas vazias:
- `agent_templates` — 8 templates (abertura, follow-up, proposta, cobrança, etc.)
- `agent_config` — configurações do agente (horários, limites, modelos)
- `agent_rules` — regras de decisão (quando fazer follow-up, quando escalar)

---

### FASE 3 — Automação de Fluxo Completo (Semanas 3-4)
> **Esforço:** 7-10 dias | **Prioridade:** ALTA
> **Objetivo:** Fluxo ponta a ponta sem intervenção humana

#### 3.1 Transição Automática Produção→Instalação
Quando OP finaliza:
1. Trigger `production_completed` dispara
2. Claude verifica pedido associado
3. Gera ordem de instalação com endereço do cliente
4. Notifica equipe de campo via App Campo
5. Sugere data/horário baseado em agenda e localização

#### 3.2 Cobrança Automática de Inadimplentes
Escala progressiva:
- D+1 do vencimento: lembrete amigável (WhatsApp)
- D+3: segundo lembrete (WhatsApp + email)
- D+7: notificação formal (email)
- D+15: alerta para Junior (Telegram)
- D+30: suspensão de novos pedidos

#### 3.3 PCP Inteligente
Claude como PCP:
- Sequencia OPs baseado em prazo, prioridade e capacidade
- Aloca máquinas automaticamente
- Detecta gargalos e sugere reorganização
- Atualiza Gantt em tempo real

#### 3.4 Compras Automáticas
Quando estoque atinge mínimo:
1. Claude identifica materiais necessários
2. Gera RFQ (cotação) para fornecedores cadastrados
3. Compara preços e sugere melhor opção
4. Junior aprova pelo Telegram
5. Pedido de compra gerado automaticamente

---

### FASE 4 — Inteligência e Aprendizado (Semanas 5-6)
> **Esforço:** 7-10 dias | **Prioridade:** MÉDIA
> **Objetivo:** IA que aprende e melhora com o tempo

#### 4.1 Memory Layer
Tabelas para armazenar padrões detectados:

```sql
CREATE TABLE ai_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,           -- 'cliente_padrao', 'produto_popular', 'prazo_real', 'margem_media'
  chave TEXT NOT NULL,          -- identificador do padrão
  valor JSONB NOT NULL,         -- dados do padrão
  confianca NUMERIC(3,2),      -- 0.00 a 1.00
  ocorrencias INT DEFAULT 1,
  primeira_vez TIMESTAMPTZ DEFAULT now(),
  ultima_vez TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tipo, chave)
);
```

**Padrões a detectar:**
- Clientes que pedem os mesmos produtos sazonalmente
- Tempo real de produção por tipo de produto (vs. estimado)
- Margem média por categoria de produto
- Taxa de conversão por origem do lead
- Materiais mais usados por tipo de serviço

#### 4.2 Score de Crédito Interno
Baseado em histórico do cliente:
- Pontualidade de pagamentos (peso 40%)
- Volume de compras (peso 20%)
- Tempo como cliente (peso 15%)
- Recorrência (peso 15%)
- Inadimplência (peso -10%)

Score determina: limite de crédito, condições de pagamento, prioridade de atendimento.

#### 4.3 Dashboard Executivo (Cockpit)
Tela única com visão de todos os módulos:
- KPIs do dia (faturamento, produção, vendas)
- Alertas ativos (estoque, inadimplência, prazos)
- Pipeline comercial visual
- Produção em andamento
- Agenda de instalações
- Fluxo de caixa projetado

---

### FASE 5 — Experiência Conversacional (Semanas 7-8)
> **Esforço:** 5-7 dias | **Prioridade:** MÉDIA
> **Objetivo:** Interação natural com o sistema

#### 5.1 Chat Natural no ERP
Interface no frontend onde o usuário digita em linguagem natural:
- "Mostra os pedidos atrasados" → Claude consulta via MCP → retorna lista
- "Cria um orçamento para Renner, 10 banners 3x1m" → Claude gera proposta
- "Quanto faturamos este mês?" → Claude consulta financeiro

**Implementação:** React component `ChatERP.tsx` que envia para `ai_requests` e recebe de `ai_responses` via Realtime.

#### 5.2 Relatórios em Linguagem Natural
"Me gera um relatório de vendas do trimestre" → Claude:
1. Consulta dados via MCP
2. Analisa tendências
3. Gera documento PDF/DOCX formatado
4. Envia link para download

---

## MAPA DE ELIMINAÇÃO — OPENROUTER

### Manter com OpenRouter (respostas instantâneas automáticas)
| Edge Function | Razão |
|---|---|
| `whatsapp-webhook` (resposta) | Cliente não pode esperar >5s |
| `agent-cron-loop` → `ai-compor-mensagem` | Follow-ups automáticos sem Claude online |
| `ai-detectar-intencao-orcamento` | Classificação rápida de intenção |

### Migrar para Claude via MCP Bridge
| Edge Function | Substituição |
|---|---|
| `analisar-orcamento` | Claude analisa via ai_requests |
| `resumo-cliente` | Claude gera via MCP |
| `briefing-producao` | Claude gera via MCP |
| `detectar-problemas` | Claude detecta via MCP |
| `composicao-produto` | Claude analisa via MCP |
| `qualificar-lead` | Claude qualifica via MCP |

### Desativar completamente
| Edge Function | Razão |
|---|---|
| `telegram-webhook` | Channels substitui |

---

## CRONOGRAMA CONSOLIDADO

| Semana | Fase | Entregas |
|---|---|---|
| 1 | Infraestrutura | Ponte MCP, triggers, desativar Telegram webhook, scheduled task |
| 2 | Agente de Vendas | WhatsApp API, prospecção, seed templates |
| 3-4 | Automação Fluxo | Produção→Instalação, cobrança, PCP, compras |
| 5-6 | Inteligência | Memory layer, score crédito, cockpit executivo |
| 7-8 | Conversacional | Chat natural, relatórios linguagem natural |

**Total estimado:** 8 semanas para autonomia completa

---

## MÉTRICAS DE SUCESSO

| Métrica | Antes (hoje) | Meta CROMA 4.0 |
|---|---|---|
| Tempo resposta a lead | Manual (~2h) | Automático (<5min) |
| Orçamentos/dia | 3-5 (manual) | 10-15 (assistido por IA) |
| Taxa de follow-up | ~30% dos leads | 100% automatizado |
| Cobrança de inadimplentes | Manual, irregular | Automática, escalonada |
| Tempo planejamento produção | 1-2h/dia | Automático |
| Custo mensal de IA | ~R$ 80 | ~R$ 25 |
| Intervenção humana no digital | ~60% das tarefas | <10% das tarefas |

---

## RISCOS E MITIGAÇÃO

| Risco | Mitigação |
|---|---|
| WhatsApp API rejeitar mensagens | Templates pré-aprovados, respeitar limites de envio |
| Claude offline por manutenção | Fallback OpenRouter para fluxos críticos |
| Decisão errada da IA | Guardrails: limites de desconto, aprovação humana para valores >R$ 5.000 |
| Sobrecarga de mensagens | Rate limiting, fila de processamento |
| Perda de contexto entre sessões | GSD (.planning/) + Memory Layer |

---

## DEPENDÊNCIAS DO JUNIOR

| Item | Quando | Prioridade |
|---|---|---|
| Chip WhatsApp dedicado | Amanhã | CRÍTICA |
| Conta Meta Business Manager | Esta semana | CRÍTICA |
| Verificação do negócio no Meta | Esta semana | ALTA |
| Aprovação de templates WhatsApp | Após verificação | ALTA |
| Resend API key (produção) | Esta semana | MÉDIA |
| Feedback sobre cockpit design | Semana 5 | BAIXA |

---

## PRÓXIMOS PASSOS IMEDIATOS

1. **AGORA:** Criar migration para `ai_requests` + `ai_responses`
2. **AGORA:** Criar triggers formais para 4 eventos
3. **AGORA:** Desativar webhook Telegram
4. **AGORA:** Criar scheduled task para orquestração diária
5. **AMANHÃ (Junior):** Fornecer número WhatsApp
6. **ESTA SEMANA:** Configurar WhatsApp Business API completa

---

*Documento criado em 2026-03-29 por Claude — Cérebro Administrativo da Croma Print*
*Próxima revisão: após conclusão da Fase 1*
