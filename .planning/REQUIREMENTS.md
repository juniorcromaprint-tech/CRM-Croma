# Requirements: ERP-Croma

**Defined:** 2026-03-28
**Updated:** 2026-03-31
**Core Value:** Fluxo Lead→Faturamento funcionando de ponta a ponta sem falhas

## v1 Requirements (Auditoria Crítica)

### Bugs Críticos

- [x] **BUG-01**: Status faturado funciona corretamente e atualiza financeiro
- [x] **BUG-02**: NCM preenchido em todos os produtos (fiscal não quebra)
- [x] **BUG-03**: Pagamento conectado ao fluxo de pedidos
- [x] **BUG-04**: Comissões calculadas automaticamente sobre vendas
- [x] **BUG-05**: Dimensões propagam corretamente no orçamento→pedido

### Gaps Funcionais

- [x] **GAP-01**: Dashboard financeiro consolidado (receitas, despesas, fluxo de caixa)
- [x] **GAP-02**: Integração bancária para boletos (não manual)
- [x] **GAP-03**: Reserva de estoque ao criar pedido
- [x] **GAP-04**: Gantt funcional na produção (não decorativo)
- [x] **GAP-05**: Sistema de alertas e notificações
- [x] **GAP-06**: Funil comercial completo (Lead→Cliente com métricas)
- [x] **GAP-07**: Conversão Proposta→Pedido sem perda de dados

## v2 Requirements (Produto)

### Expansão

- [x] **PROD-01**: Contratos recorrentes para clientes fixos
- [x] **PROD-02**: NPS e pesquisa de satisfação
- [x] **PROD-03**: PIX como forma de pagamento
- [x] **PROD-04**: RFQ — solicitação de cotação para fornecedores
- [x] **PROD-05**: Approval workflow em cadeia

### IA Avançada

- [x] **AI-03**: Agente de Vendas multicanal com follow-ups automáticos
- [x] **AI-04**: AI Orçamento — detecção de intenção + proposta automática
- [x] **TELE-01**: Gestão completa via Telegram

## v3 Requirements (CROMA 4.0 — Autonomia Total)

### Infraestrutura de Autonomia

- [x] **AUTO-01**: Ponte MCP (ai_requests/ai_responses) — Claude processa botões do ERP
- [x] **AUTO-02**: Triggers de eventos formais (production_completed, installation_completed, payment_received, payment_overdue)
- [x] **AUTO-03**: System events para automação em cadeia
- [x] **AUTO-04**: Memory layer (ai_memory) para padrões detectados
- [x] **AUTO-05**: Scheduled tasks de orquestração (matinal 08h, noturna 22h, polling 30min)
- [x] **AUTO-06**: Desativar Telegram webhook (Channels substitui)

### Automação de Fluxo

- [x] **FLOW-01**: Cobrança automática escalonada (D+1/D+3/D+7/D+15/D+30)
- [x] **FLOW-02**: Transição automática Produção→Instalação (trigger + auto-criar OI)
- [x] **FLOW-03**: Agent rules — 14 regras de decisão seedadas (comercial, financeiro, estoque, produção, instalação)

### Experiência

- [x] **UX-01**: ChatERP componente (criado, não integrado — prioridade baixa)
- [ ] **UX-02**: Cockpit Executivo com system_events e cobrança (DashboardExecutivoPage já existe, falta integrar novos dados)

### WhatsApp IA

- [x] **WA-01**: WhatsApp Business API ativo com integração CRM completa (webhook v14 + ai-gerar-orcamento + coleta dados + email SMTP)

### Pendentes

- [ ] **WA-02**: Configurar templates Meta Business (para mensagens proativas)
- [ ] **CRON-01**: Agendar cron do agent-cron-loop no Supabase

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-tenant / SaaS | Sistema exclusivo da Croma |
| App nativo mobile | PWA suficiente para campo |
| Troca de banco (Supabase) | Investimento já feito, funciona bem |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUG-01 a BUG-05 | Phase 1 | Done |
| GAP-01 a GAP-07 | Phase 1-2 | Done |
| PROD-01 a PROD-05 | Phase 3 | Done |
| AI-03, AI-04, TELE-01 | Phase 3 | Done |
| AUTO-01 a AUTO-06 | CROMA 4.0 F1 | Done |
| FLOW-01 a FLOW-03 | CROMA 4.0 F2 | Done |
| UX-01 | CROMA 4.0 F3 | Done |
| WA-01 | CROMA 4.0 F2 | Done |
| UX-02, WA-02, CRON-01 | CROMA 4.0 F3+ | Pending |

**Coverage:**
- v1: 12/12 complete (100%)
- v2: 8/8 complete (100%)
- v3: 12/15 complete (80%) — WA-01 concluído, 3 pendentes (UX-02, WA-02, CRON-01)
- Overall: 32/35 complete (91%)

---
*Requirements defined: 2026-03-28*
*v3 added: 2026-03-29*
