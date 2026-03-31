# CROMA ERP — RELATÓRIO MASTER DE AUDITORIA
> Data: 2026-03-21 | 3 agentes em paralelo | ~1.4h de análise combinada

---

## VEREDITO GERAL

| Sistema | Taxa de Sucesso |
|---------|----------------|
| QA Sequencial (17 passos Lead→Faturamento) | **59%** |
| Simulação Multi-Agente (5 domínios) | **75%** |
| **Sistema como um todo** | **~67%** apto para operação crítica |

**O fluxo comercial central é sólido.** Os gaps são quase todos de **integração entre módulos que já existem** — não falta construir do zero, falta conectar o que foi construído.

---

## NÍVEL 1 — BUGS CRÍTICOS (quebram operação agora)

### 🔴 BUG-01 — Status "faturado" é beco sem saída
- **Onde**: `PedidoDetailPage.tsx` → `VALID_TRANSITIONS`
- **Problema**: Status `faturado` existe no banco e em FaturamentoLotePage, mas está ausente do mapa de transições. Pedidos faturados somem da ExpediçãoPage e ficam presos.
- **Impacto**: Fluxo operacional quebra no último passo
- **Correção**: ~2h

### 🔴 BUG-02 — NCM nulo em 156 modelos → NF-e falha
- **Onde**: Tabela `produto_modelos`, campo `ncm`
- **Problema**: 156 modelos sem NCM. A NF-e vai falhar ao transmitir ao SEFAZ.
- **Impacto**: Todo o módulo fiscal está inutilizável em produção
- **Correção**: Script de seed + campo obrigatório no formulário (~3h)

### 🔴 BUG-03 — Pagamento desconectado do pedido
- **Onde**: `FinanceiroPage` → `contas_receber` → `pedidos`
- **Problema**: Marcar CR como "pago" não dispara nenhuma atualização no status do pedido. Risco real de expedir sem pagamento confirmado.
- **Impacto**: Risco financeiro direto + operação cega
- **Correção**: Trigger ou hook de sincronização (~4h)

### 🔴 BUG-04 — Comissões nunca são geradas
- **Onde**: `/financeiro/comissoes` + tabela `comissoes`
- **Problema**: Tela existe, diz "geradas automaticamente", mas não há nenhum código que insira registros. Vendedores veem tabela sempre vazia.
- **Impacto**: Feature prometida 100% não funcional
- **Correção**: Trigger pós-pedido concluído (~3h)

### 🔴 BUG-05 — Campos de dimensão ausentes no cadastro de modelos
- **Onde**: `ModeloFormDialog` em `/produtos`
- **Problema**: Campos `largura_cm` e `altura_cm` existem no banco mas não no formulário. Para banners/adesivos, operador recalcula área manualmente em cada orçamento.
- **Impacto**: Erro manual em cada orçamento dimensional
- **Correção**: Adicionar campos ao form (~2h)

---

## NÍVEL 2 — GAPS FUNCIONAIS (módulos existem pela metade)

### 🟠 GAP-01 — Financeiro cego até a conclusão do pedido
`gerarContasReceber` só é chamado quando pedido é marcado `concluido` (semanas depois). O financeiro não tem visão de receita projetada, não pode emitir boleto antecipado nem planejar fluxo de caixa.

### 🟠 GAP-02 — Boleto desconectado do pedido
Criação de boleto é 100% manual — sem pull de valor, cliente ou vencimento a partir do pedido. Condição de pagamento aprovada no orçamento não alimenta o vencimento do boleto.

### 🟠 GAP-03 — Sem reserva de estoque antes da produção
`criarOrdemProducao()` anota materiais previstos mas não reserva do saldo. Dois pedidos em paralelo podem consumir os mesmos materiais sem alerta — problema aparece tarde demais.

### 🟠 GAP-04 — Gantt de produção decorativo
`maquinas` cadastradas, PCPDashboard existe, mas não há campo de seleção de máquina na OP. O Gantt está fixo com `bars={[]}`. O PCP não tem ferramenta real de planejamento de capacidade.

### 🟠 GAP-05 — Alerta de estoque mínimo não dispara
O campo `estoque_minimo` existe nos materiais, mas não há trigger ou job que alerte quando o saldo cai abaixo do mínimo após consumo de OP.

### 🟠 GAP-06 — Funil analytics Lead→Faturamento quebrado
Leads não têm `proposta_id`. Propostas não têm `lead_id` em pedidos. É impossível responder "Quantos leads de franquias viraram pedidos este mês?" com um clique.

### 🟠 GAP-07 — Proposta→Pedido ainda manual
Migration 024 existe com a lógica, mas a UI não está conectada. O vendedor precisa recriar o pedido manualmente a partir da proposta aprovada.

---

## NÍVEL 3 — GAPS DE PRODUTO (funcionalidades que faltam construir)

| # | Funcionalidade | Impacto de Negócio |
|---|---------------|-------------------|
| P-01 | **Contratos de manutenção recorrente** | Receita recorrente de redes sendo perdida sistematicamente |
| P-02 | **NPS pós-instalação** | Zero rastreamento de satisfação |
| P-03 | **PIX no portal do cliente** | Só boleto disponível; PIX é >70% dos pagamentos digitais no Brasil |
| P-04 | **Cotação multi-fornecedor (RFQ)** | Compras 100% manual sem registro |
| P-05 | **Approval workflow contas a pagar** | Risco de fraude interna sem fluxo de aprovação |
| P-06 | **Prazo prometido por capacidade** | PCP promete datas sem base real em máquinas |
| P-07 | **Orçamento por faixa de quantidade** | Precificação por escala não exposta ao cliente |
| P-08 | **Cadastro de arte/briefing no pedido** | Arquivo aprovado não rastreado no sistema |
| P-09 | **Arquivo na OP para chão de fábrica** | Operador sem acesso ao arquivo na produção |
| P-10 | **Follow-up com contexto do agente IA** | Vendedor não recebe brief quando agente escala para humano |

---

## NÍVEL 4 — GAPS ESTRATÉGICOS (Sprint 7+)

| # | Gap | Impacto Estratégico |
|---|-----|---------------------|
| E-01 | **Multi-filial real** | `empresa_id` ausente nas tabelas operacionais — não escala |
| E-02 | **Upsell automático no orçamento** | Motor calcula por item, sem sugestão de bundle ou aumento de ticket |
| E-03 | **Portal de fornecedores** | Fornecedores ainda fora do sistema |
| E-04 | **API webhooks configurável** | Integrações externas dependem de Edge Functions customizadas |

---

## MATRIZ DE PRIORIDADE — Impacto × Esforço

```
ALTO IMPACTO
│
│  BUG-02(NCM)   GAP-07(Proposta→Pedido)   P-01(Contratos)
│  BUG-03(Pgto)  GAP-06(Funil analytics)   P-03(PIX)
│  BUG-04(Com.)  GAP-01(Financeiro cego)
│
│  BUG-01(Fat.)  GAP-02(Boleto)            P-06(Prazo/Cap.)
│  BUG-05(Dim.)  GAP-03(Estoque)           P-04(RFQ)
│                GAP-04(Gantt)             P-05(Approval)
│
│─────────────────────────────────────────────────────────
│   BAIXO ESFORÇO          MÉDIO ESFORÇO      ALTO ESFORÇO
│      (~2-4h)               (~1-3 dias)        (1+ semana)
```

**Quadrante ouro** (alto impacto, baixo esforço): BUG-01, BUG-02, BUG-04, GAP-07, GAP-06, P-03

---

## ROADMAP — PRÓXIMOS 3 SPRINTS

### Sprint 5 — "Conectar o que existe" (estimativa: 8-10 dias)
> Foco: bugs críticos + integrações entre módulos que já existem

1. BUG-01: Status "faturado" no VALID_TRANSITIONS
2. BUG-02: NCM nos 156 modelos + campo obrigatório
3. BUG-03: Sincronização pagamento ↔ status do pedido
4. BUG-04: Trigger geração de comissões
5. BUG-05: Campos dimensão no ModeloFormDialog
6. GAP-07: Proposta→Pedido automático (UI já tem migration)
7. GAP-06: Funil analytics Lead→Faturamento (views + dashboard)
8. GAP-02: Boleto com pull automático do pedido
9. P-03: PIX no portal do cliente
10. P-02: NPS pós-instalação (formulário simples)

### Sprint 6 — "Operação Eficiente" (estimativa: 10-12 dias)
> Foco: produção, estoque e financeiro completos

1. GAP-03: Reserva de estoque (picking) antes da OP
2. GAP-04: Seleção de máquina na OP + Gantt real
3. GAP-01: Receita projetada no financeiro (antes da conclusão)
4. GAP-05: Alerta de estoque mínimo automático
5. P-06: Prazo prometido baseado em capacidade
6. P-01: Contratos de manutenção recorrente (schema básico)
7. P-04: RFQ cotação multi-fornecedor
8. P-05: Approval workflow contas a pagar
9. P-07: Orçamento por faixa de quantidade
10. P-08: Cadastro de arte/briefing no pedido

### Sprint 7 — "Escala" (estimativa: 12-15 dias)
> Foco: crescimento, multi-filial, automações avançadas

1. E-01: Multi-filial real (empresa_id nas tabelas operacionais)
2. P-09: Arquivo na OP para chão de fábrica
3. P-10: Follow-up com contexto do agente IA
4. E-02: Upsell automático no orçamento
5. E-03: Portal de fornecedores (básico)
6. E-04: API webhooks configurável

---

## O QUE FUNCIONA BEM (não mexer sem motivo)

- Lead → Orçamento com motor Mubisys: sólido
- Portal público `/p/{token}`: tracking + aprovação funcionando
- Bridge ERP↔Campo: trigger ativo, sync bidirecional OK
- NF-e (quando NCM estiver preenchido): funcional em homologação
- CNAB 400 / boletos Itaú: parser + retorno funcionando
- Módulo contábil (DAS, OFX, balancete): operacional
- Relatórios Excel/PDF: funcionando
- Auth + RLS: sólido após Sprint 4
- Campanhas Resend: funcionando
- AI Orçamento (intent → proposta → aprovação): funcionando

---

*Relatório gerado por 3 agentes em paralelo: QA Sequencial + Simulação Multi-Agente + xQuads Master*
*Arquivos fonte: 2026-03-21-qa-sequential-report.md, 2026-03-21-operations-sim-report.md, 2026-03-21-xquads-strategic-gaps.md*
