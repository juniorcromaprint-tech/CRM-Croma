# Roadmap: ERP-Croma

**Created:** 2026-03-28
**Source:** Auditoria 2026-03-21 (MASTER-AUDIT-REPORT) + Plano IA Mestre
**Total phases:** 3
**Total requirements:** 12 (v1) + 10 (v2) + 4 (estratégico)

---

## Phase 1 — "Conectar o que existe" (Sprint 5)

> **Foco:** Bugs críticos + integrações entre módulos existentes
> **Estimativa:** 8-10 dias | **Prioridade:** URGENTE
> **Quadrante ouro:** alto impacto, baixo esforço

### Plans

| # | Requirement | Descrição | Esforço |
|---|-------------|-----------|---------|
| 1.1 | BUG-01 | Status "faturado" no VALID_TRANSITIONS — pedidos somem após faturamento | ~2h |
| 1.2 | BUG-02 | NCM nos 156 modelos + campo obrigatório no form — fiscal quebrado | ~3h |
| 1.3 | BUG-03 | Sincronização pagamento ↔ status pedido — risco financeiro | ~4h |
| 1.4 | BUG-04 | Trigger geração de comissões pós-pedido concluído | ~3h |
| 1.5 | BUG-05 | Campos largura/altura no ModeloFormDialog — erro manual em orçamentos | ~2h |
| 1.6 | GAP-07 | Proposta→Pedido automático (migration 024 existe, falta UI) | ~6h |
| 1.7 | GAP-06 | Funil analytics Lead→Faturamento (views SQL + dashboard) | ~8h |

**Wave 1 (paralelo):** 1.1, 1.2, 1.5 — independentes, baixo risco
**Wave 2 (paralelo):** 1.3, 1.4 — financeiro, precisam de testes
**Wave 3 (sequencial):** 1.6, 1.7 — integrações maiores, dependem do fluxo base estar ok

### Exit criteria
- [ ] Todos os 5 bugs corrigidos e testados
- [ ] Fluxo Lead→Faturamento completo sem intervenção manual
- [ ] Funil analytics responde "quantos leads viraram pedidos este mês"
- [ ] Build limpo (zero errors, zero warnings críticos)

---

## Phase 2 — "Operação Eficiente" (Sprint 6)

> **Foco:** Produção, estoque e financeiro completos
> **Estimativa:** 10-12 dias | **Prioridade:** ALTA
> **Pré-requisito:** Phase 1 completa

### Plans

| # | Requirement | Descrição | Esforço |
|---|-------------|-----------|---------|
| 2.1 | GAP-01 | Dashboard financeiro consolidado (receita projetada antes da conclusão) | ~1-2 dias |
| 2.2 | GAP-02 | Boleto com pull automático do pedido (valor, cliente, vencimento) | ~1-2 dias |
| 2.3 | GAP-03 | Reserva de estoque (picking) ao criar OP | ~1 dia |
| 2.4 | GAP-04 | Seleção de máquina na OP + Gantt funcional | ~2-3 dias |
| 2.5 | GAP-05 | Alerta de estoque mínimo (trigger/job automático) | ~4h |

**Wave 1 (paralelo):** 2.1, 2.5 — financeiro e alertas, independentes
**Wave 2 (paralelo):** 2.2, 2.3 — boleto e estoque
**Wave 3:** 2.4 — Gantt depende de OP ter máquina vinculada

### Exit criteria
- [ ] Dashboard financeiro com fluxo de caixa projetado
- [ ] Boletos gerados automaticamente a partir do pedido
- [ ] Estoque reservado ao criar OP, com alerta de mínimo
- [ ] Gantt com barras reais baseadas em máquinas e OPs

---

## Phase 3 — "Produto Completo" (Sprint 7)

> **Foco:** Features de produto + IA avançada + gestão via Telegram
> **Estimativa:** 12-15 dias | **Prioridade:** MÉDIA
> **Pré-requisito:** Phase 2 completa

### Plans

| # | Requirement | Descrição | Esforço |
|---|-------------|-----------|---------|
| 3.1 | PROD-01 | Contratos de manutenção recorrente | ~2-3 dias |
| 3.2 | PROD-02 | NPS pós-instalação (formulário + tracking) | ~1 dia |
| 3.3 | PROD-03 | PIX no portal do cliente | ~1-2 dias |
| 3.4 | PROD-04 | RFQ — cotação multi-fornecedor | ~2-3 dias |
| 3.5 | PROD-05 | Approval workflow contas a pagar | ~2 dias |
| 3.6 | AI-03 | Agente de Vendas multicanal completo | ~3-4 dias |
| 3.7 | AI-04 | AI Orçamento — detecção de intenção + proposta automática | ~2-3 dias |
| 3.8 | TELE-01 | Gestão completa via Telegram | ~3-4 dias |

### Exit criteria
- [ ] Contratos recorrentes funcionando com cobrança automática
- [ ] NPS disparado após instalação com dashboard de resultados
- [ ] PIX funcional no portal do cliente
- [ ] Junior gerencia operações críticas pelo Telegram

---

## Progress Tracker

| Phase | Status | Plans | Completed |
|-------|--------|-------|-----------|
| Phase 1 — Conectar | ✅ Done | 7 | 7/7 |
| Phase 2 — Operação | ✅ Done | 5 | 5/5 |
| Phase 3 — Produto | ✅ Done | 8 | 8/8 |

**Overall:** 20/20 plans complete (100%) ✅

---

## CROMA 4.0 — Autonomia Total

> **Foco:** Empresa gerida quase exclusivamente por IA
> **Status:** Fases 1-2 concluídas, 3-5 planejadas em detalhe

| Fase | Foco | Status | Estimativa | Entregues / Entregas |
|------|------|--------|------------|----------------------|
| F1 — Infraestrutura | Ponte MCP, triggers, scheduled tasks | ✅ Done | — | 6 tabelas, 4 triggers, 3 tasks, hooks frontend |
| F2 — Agente de Vendas | WhatsApp IA integrado ao CRM | ✅ Done | — | Webhook v15, ai-gerar-orcamento, coleta dados, email SMTP, PIX correto |
| F3 — Automação Fluxo | Cobrança, PCP, transições automáticas | ✅ Done | — | Migration 106+107, agent-cron-loop v3 (motor 15 rules), cobrança D1→D30, PCP trigger, transição Prod→Inst, AutomacaoPage |
| F4 — Inteligência | Cockpit, score crédito, memory layer | ✅ Done | — | Migration 108+109, score crédito A-E (312 clientes), CockpitExecutivoPage (7 seções), memory layer (4 padrões auto), resumo diário 22h Telegram |
| F5 — Conversacional | Chat natural, relatórios linguagem natural | ✅ Done | — | ai-chat-erp (3 estágios, 24 templates), ChatERP floating panel, integração Telegram |

### Fase 3 — Automação de Fluxo (detalhes)

> Plano completo: `.planning/phases/FASE-3-AUTOMACAO-FLUXO.md`

**Entregas:**
- **3.1** Motor de execução de regras (`agent-cron-loop`) — Edge Function que varre 15 agent_rules a cada 30min
- **3.2** Cobrança automática escalonada — D+1 WhatsApp amigável → D+3 lembrete → D+7 email formal → D+15 Telegram Junior → D+30 alerta crítico + suspensão
- **3.3** PCP inteligente — sequenciamento de OPs: gera etapas por categoria, atribui máquina, calcula datas previstas
- **3.4** Transição Produção→Instalação — unificação de status, notificação automática ao criar OI
- **3.5** Dashboard de automação — `/admin/automacao` com cobranças, fila produção, transições, saúde das regras

**Infra existente**: `cobranca_automatica` (tabela), `agent_rules` (15 ativas), `system_events`, 6 setores, 6 máquinas, 12 triggers de produção
**Gap principal**: camada de execução — regras existem mas ninguém as lê e executa

### Fase 4 — Inteligência (detalhes)

> Plano completo: `.planning/phases/FASE-4-INTELIGENCIA.md`

**Entregas:**
- **4.1** Cockpit Executivo — 7 seções: pulso do dia, alertas IA, financeiro, produção, comercial, automação, timeline
- **4.2** Score de crédito — fórmula 4 fatores (pagamento 40%, volume 25%, relacionamento 20%, recência 15%), níveis A-E, limite sugerido
- **4.3** Memory layer — detecção automática de 7 tipos de padrão (pagamento, pricing, produção, dia da semana, recorrência, consumo, sazonalidade)
- **4.4** Resumo diário inteligente — 22h via Telegram, gerado por IA com dados reais do dia

**Infra existente**: `ai_memory` (4 padrões), `business_intelligence_config` (15 configs, sazonalidade), `DashboardExecutivoPage` (incompleta)
**Gap principal**: cockpit sem dados de automação, scores não calculados, memory layer com apenas 4 padrões

### Fase 5 — Conversacional (detalhes)

> Plano completo: `.planning/phases/FASE-5-CONVERSACIONAL.md`

**Entregas:**
- **5.1** Backend `ai-chat-erp` — pipeline 3 estágios (classificação → plano → execução), text-to-SQL seguro
- **5.2** Frontend ChatERP — floating button, respostas ricas (tabelas, gráficos, ações), histórico
- **5.3** Relatórios por linguagem natural — 10 templates (vendas, contas, produção, funil, estoque, inativos, etc.)
- **5.4** Integração Telegram — Junior conversa com ERP pelo Telegram
- **5.5** Sugestões proativas — chat sugere ações baseado no contexto

**Infra existente**: `ai_requests/ai_responses` (ponte MCP), `agent_conversations/agent_messages`, ChatERP componente (criado, não integrado), 12 Edge Functions IA
**Gap principal**: ChatERP desconectado do backend, text-to-SQL inexistente, relatórios NL não implementados

---

## Sequência de execução recomendada

```
Fase 3 (5-7d) ──→ Fase 4 (5-7d) ──→ Fase 5 (6-8d)
                                               │
Total estimado: 16-22 dias de desenvolvimento  │
                                               ▼
                                    CROMA 4.0 COMPLETO
                                    Empresa gerida por IA
```

**Dependências:**
- F4 depende de F3 (cockpit precisa dos dados de automação/cobrança)
- F5 depende de F4 (chat usa cockpit views + memory layer + scores)
- F5.4 (Telegram) depende de F3.1 (agent-cron-loop) para contexto

---

## References

- Auditoria: `docs/qa-reports/2026-03-21-MASTER-AUDIT-REPORT.md`
- Plano IA Mestre: `docs/plano-ia/01_Estrategia/CROMA_AI_PLANO_MESTRE.md`
- Spec detalhada: `docs/superpowers/specs/2026-03-14-plano-acao-erp-design.md`
- Requirements: `.planning/REQUIREMENTS.md`
- Fase 3: `.planning/phases/FASE-3-AUTOMACAO-FLUXO.md`
- Fase 4: `.planning/phases/FASE-4-INTELIGENCIA.md`
- Fase 5: `.planning/phases/FASE-5-CONVERSACIONAL.md`

---
*Roadmap created: 2026-03-28*
*v1 phases complete — 100% do roadmap entregue em 2026-03-29*
*CROMA 4.0 F3-F5 planejadas em detalhe: 2026-03-31*
