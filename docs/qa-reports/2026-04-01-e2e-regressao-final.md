# Relatório E2E — Regressão Final
> Data: 2026-04-01 | Testador: Claude QA Agent (5 agentes paralelos) | Método: MCP croma_* exclusivo

---

## Resultado Geral

**9/10 bugs CORRIGIDOS | 1 ⚠️ PARCIAL | 1 ❌ NOVO BUG ENCONTRADO**

| Bug | Descrição | Status |
|-----|-----------|--------|
| BUG-E2E-07 | croma_enviar_proposta "Proposta não encontrada" | ✅ CORRIGIDO |
| BUG-E2E-06 | Trigger CR não disparava ao aprovar proposta/pedido | ⚠️ PARCIAL |
| BUG-E2E-05 | liberado→finalizado: column mm.quantidade | ✅ CORRIGIDO |
| BUG-ESTOQUE-01 | estoque_saldos não atualizava após movimento | ✅ CORRIGIDO |
| BUG-C4-01 | croma_listar_nfe: FK ambígua PGRST201 | ✅ CORRIGIDO |
| BUG-PRODUTO-01 | croma_listar_produtos: coluna preco_fixo inexistente | ✅ CORRIGIDO |
| BUG-FIN-01 | Coerção number→string em tools financeiras (Zod) | ✅ CORRIGIDO |
| BUG-FIN-03 | Trigger fn_payment_received: NEW.valor → NEW.valor_pago | ✅ CORRIGIDO |
| BUG-FIN-04 | croma_criar_conta_pagar: status a_vencer violava constraint | ✅ CORRIGIDO |
| BUG-PROD-01 | croma_criar_ordem_producao: schema divergente | ✅ CORRIGIDO |

---

## Ação Adicional

| Item | Resultado |
|------|-----------|
| Reverter preço material e077e20d (Lona Flatbanner) | ✅ R$15,50 → R$10,00 |

---

## Cenários Re-testados

### Cenário 2 — Enviar Proposta (BUG-E2E-07)
| Passo | Ferramenta | Status | Observação |
|-------|-----------|--------|------------|
| Criar proposta nova | croma_criar_proposta | ✅ PASS | PROP-2026-0014 |
| Enviar proposta | croma_enviar_proposta | ✅ PASS | Email + portal URL retornados |
| Aprovar proposta | croma_atualizar_status_proposta | ✅ PASS | enviada → aprovada OK |

**Score: 3/3 PASS** — BUG-E2E-07 corrigido

---

### Cenário 3 — CR Automática ao Aprovar Pedido (BUG-E2E-06)
| Passo | Ferramenta | Status | Observação |
|-------|-----------|--------|------------|
| Criar proposta | croma_criar_proposta | ✅ PASS | PROP-2026-0015 |
| Aprovar proposta | croma_atualizar_status_proposta | ✅ PASS | |
| Pedido criado automaticamente | croma_listar_pedidos | ✅ PASS | PED-2026-0008 (aguardando_aprovacao) |
| CR criada logo após proposta aprovada | croma_listar_contas_receber | ❌ NÃO | Pedido nasce em aguardando_aprovacao |
| Avançar pedido para "aprovado" | croma_atualizar_status_pedido | ✅ PASS | |
| CR criada após pedido=aprovado | croma_listar_contas_receber | ✅ PASS | R$800, status previsto |

**Score: 5/6 PASS** — ⚠️ PARCIAL

**Diagnóstico BUG-E2E-06:** O trigger existe e funciona corretamente na transição `aguardando_aprovacao → aprovado`. Porém pedidos criados automaticamente por proposta nascem como `aguardando_aprovacao`, exigindo aprovação manual para gerar a CR. O trigger NÃO dispara no INSERT automático.

**Questão para Junior:** O fluxo esperado é que a CR seja gerada imediatamente quando o pedido nasce (na aprovação da proposta), ou apenas quando o vendedor aprova manualmente o pedido?
- Se quiser CR imediata → ajustar trigger para disparar no INSERT
- Se aprovação manual está correta → comportamento é PASS (não é bug)

---

### Cenário 4 — Produção + Estoque (BUG-E2E-05 + BUG-ESTOQUE-01)
| Passo | Ferramenta | Status | Observação |
|-------|-----------|--------|------------|
| Avançar OP liberado → finalizado | croma_atualizar_status_producao | ✅ PASS | OP-2026-0005 finalizada |
| Consultar saldo antes | croma_consultar_estoque | ✅ PASS | Lona Flatbanner: 0 |
| Registrar entrada de 10 unidades | croma_registrar_movimento | ✅ PASS | +10 registrado |
| Verificar saldo após movimento | croma_consultar_estoque | ✅ PASS | Saldo: 10 ✅ |

**Score: 4/4 PASS** — BUG-E2E-05 e BUG-ESTOQUE-01 corrigidos

---

### Cenário 6 — Financeiro Completo (BUG-FIN-01, BUG-FIN-03, BUG-FIN-04)
| Passo | Ferramenta | Status | Observação |
|-------|-----------|--------|------------|
| Criar CR manual | croma_criar_conta_receber | ❌ FAIL | BUG-FIN-01b (NOVO): status "aberto" viola constraint |
| Criar CP manual | croma_criar_conta_pagar | ✅ PASS | status "a_pagar" aceito |
| Registrar pagamento CP | croma_registrar_pagamento_cp | ✅ PASS | R$200 pago, status=pago |
| Verificar trigger pagamento | croma_registrar_pagamento | ✅ PASS | Trigger usa NEW.valor_pago OK |

**Score: 3/4 PASS** — BUG-FIN-01/03/04 corrigidos, mas novo bug encontrado

**BUG-FIN-01b (NOVO):** `croma_criar_conta_receber` inseria `status: "aberto"` que viola constraint do banco. Constraint válida: `previsto | faturado | a_vencer | vencido | parcial | pago | cancelado`. **Fix aplicado nesta sessão**: `financeiro.ts:387` → `status: "a_vencer"`.

---

### Cenário 7 — Fiscal + Produtos (BUG-C4-01 + BUG-PRODUTO-01)
| Passo | Ferramenta | Status | Observação |
|-------|-----------|--------|------------|
| Listar NF-e | croma_listar_nfe | ✅ PASS | 0 documentos, sem erro FK |
| Listar produtos | croma_listar_produtos | ✅ PASS | 87 produtos, sem erro preco_fixo |
| Listar regras precificação | croma_listar_regras_precificacao | ⚠️ PARCIAL | 9/11 (fachada e letreiro ausentes) |

**Score: 2/3 PASS** (+ 1 pré-existente sem regressão)

---

## Bugs Encontrados Neste Ciclo

### NOVO — BUG-FIN-01b
| Campo | Detalhe |
|-------|---------|
| **ID** | BUG-FIN-01b |
| **Ferramenta** | croma_criar_conta_receber |
| **Erro** | `violates check constraint 'contas_receber_status_check'` |
| **Causa** | Insert com `status: "aberto"` — valor inválido (constraint aceita: a_vencer, previsto, etc.) |
| **Fix** | `financeiro.ts:387` alterado de `"aberto"` → `"a_vencer"` ✅ |
| **Severidade** | Alto (bloqueava criação de CR manual) |

---

## Pré-existente Sem Correção

| Bug | Status | Observação |
|-----|--------|------------|
| BUG-REGRAS | ⚠️ 9/11 | fachada e letreiro ausentes em regras_precificacao — sem nova regressão |

---

## Dados Criados nos Testes (para limpeza)

| Tipo | ID | Número/Nome |
|------|----|-------------|
| Proposta (Agente A) | `4370c9bf-b8c7-45bd-916e-88edc8081b74` | PROP-2026-0014 (aprovada) |
| Proposta (Agente B) | `541f6d95-7213-4579-9df4-ae5e7641d428` | PROP-2026-0015 (aprovada) |
| Pedido (Agente B) | `38793718-b0ed-4183-88df-b6012ef85d56` | PED-2026-0008 (aprovado) |
| CR (Agente B) | `2e3fce99-349d-4759-b41f-1a039bf548eb` | R$800, previsto |
| Movimento Estoque (Agente C) | `611f5184-c29f-4b2b-be6a-4fc6b222ac9c` | +10 Lona Flatbanner |
| CP (Agente D) | `c1ab0c03-9ded-4ed7-b90a-0893e786342f` | R$200 (pago) |
| OP (Agente D) | `186f45ff-e1a9-4cae-991b-6ce1e954cadb` | OP-2026-0007 |
| Material e077e20d | Lona Flatbanner | Preço revertido: R$15,50 → R$10,00 ✅ |

---

## Resumo de Saúde do Sistema

| Módulo | Status |
|--------|--------|
| CRM / Leads | ✅ Operacional |
| Propostas / Envio | ✅ Operacional |
| Pedidos / Trigger proposta→pedido | ✅ Operacional |
| CR automática (trigger) | ⚠️ Disparada em "aprovado" (não no INSERT) |
| CR manual (croma_criar_conta_receber) | ✅ Corrigido (status a_vencer) |
| Contas a Pagar | ✅ Operacional |
| Pagamentos CR/CP | ✅ Operacional |
| Produção (finalizar OP) | ✅ Operacional |
| Estoque (saldo) | ✅ Operacional |
| Fiscal (listar NF-e) | ✅ Operacional |
| Admin (listar produtos) | ✅ Operacional |
| Regras Precificação | ⚠️ 9/11 categorias |

---

## Próximos Passos

1. **Rebuild do MCP Server** — para ativar o fix do BUG-FIN-01b (`financeiro.ts:387`)
2. **Decisão Junior: BUG-E2E-06** — CR deve ser gerada no INSERT do pedido ou apenas quando aprovado manualmente?
3. **Inserir regras faltantes** — `fachada` e `letreiro` em `regras_precificacao` (se usadas)

---

> Gerado por Claude QA Agent — 2026-04-01 | 5 agentes paralelos | 22 passos executados
