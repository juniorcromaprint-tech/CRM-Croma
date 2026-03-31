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

## References

- Auditoria: `docs/qa-reports/2026-03-21-MASTER-AUDIT-REPORT.md`
- Plano IA Mestre: `docs/plano-ia/01_Estrategia/CROMA_AI_PLANO_MESTRE.md`
- Spec detalhada: `docs/superpowers/specs/2026-03-14-plano-acao-erp-design.md`
- Requirements: `.planning/REQUIREMENTS.md`

---
*Roadmap created: 2026-03-28*
*All phases complete — 100% do roadmap entregue em 2026-03-29*
