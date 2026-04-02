# T6 — MCP Fase 3B: Ferramentas Financeiro + Produção (10 novas tools)
> Copiar e colar no CLI

---

Expandir MCP Server com 10 ferramentas de Financeiro e Produção.

## Contexto
- Financeiro tem 6 tools (listar CR/CP, criar CR/CP, registrar pagamento CR/CP) — faltam dashboards e operações avançadas
- Produção tem 3 tools básicas (listar OPs, atualizar status, criar OP) — falta dia-a-dia
- Mesmo padrão de código dos tools existentes

## FINANCEIRO — adicionar em mcp-server/src/tools/financeiro.ts (6 novas)

### 1. croma_dashboard_financeiro
Query agregada em uma única chamada:
```sql
SELECT
  -- CR aberto
  (SELECT COALESCE(SUM(saldo), 0) FROM contas_receber WHERE status NOT IN ('pago', 'cancelado', 'baixado')) as cr_aberto,
  -- CR vencido
  (SELECT COALESCE(SUM(saldo), 0) FROM contas_receber WHERE status NOT IN ('pago', 'cancelado', 'baixado') AND data_vencimento < CURRENT_DATE) as cr_vencido,
  -- CP aberto
  (SELECT COALESCE(SUM(valor_original), 0) FROM contas_pagar WHERE status NOT IN ('pago', 'cancelado')) as cp_aberto,
  -- CP vencido
  (SELECT COALESCE(SUM(valor_original), 0) FROM contas_pagar WHERE status NOT IN ('pago', 'cancelado') AND data_vencimento < CURRENT_DATE) as cp_vencido,
  -- Faturamento mês atual (CR pagas)
  (SELECT COALESCE(SUM(valor_pago), 0) FROM contas_receber WHERE status = 'pago' AND data_pagamento >= date_trunc('month', CURRENT_DATE)) as faturamento_mes,
  -- Faturamento mês anterior
  (SELECT COALESCE(SUM(valor_pago), 0) FROM contas_receber WHERE status = 'pago' AND data_pagamento >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month') AND data_pagamento < date_trunc('month', CURRENT_DATE)) as faturamento_mes_anterior
```
Sem parâmetros. Retornar tudo formatado com formatBRL.
Incluir top 5 clientes devedores (CR aberto GROUP BY cliente_id ORDER BY SUM(saldo) DESC LIMIT 5).

### 2. croma_fluxo_caixa
```sql
-- Entradas previstas (CR) agrupadas por semana, próximos 90 dias
SELECT date_trunc('week', data_vencimento) as semana,
  SUM(saldo) as entradas_previstas
FROM contas_receber
WHERE status NOT IN ('pago', 'cancelado', 'baixado')
  AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
GROUP BY 1

-- Saídas previstas (CP) agrupadas por semana
SELECT date_trunc('week', data_vencimento) as semana,
  SUM(valor_original) as saidas_previstas
FROM contas_pagar
WHERE status NOT IN ('pago', 'cancelado')
  AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
GROUP BY 1
```
Param opcional: dias (30/60/90, default 90)
Combinar em saldo_projetado por semana.

### 3. croma_dre_mensal
```sql
SELECT
  (SELECT COALESCE(SUM(valor_pago), 0) FROM contas_receber WHERE status = 'pago' AND date_trunc('month', data_pagamento) = $1::date) as receita,
  (SELECT COALESCE(SUM(valor_pago), 0) FROM contas_pagar WHERE status = 'pago' AND date_trunc('month', data_pagamento) = $1::date) as custo
```
Param: mes (YYYY-MM, default mês atual)
Retornar: receita, custo, resultado (receita - custo), margem % ((receita-custo)/receita*100)

### 4. croma_faturamento_lote
```sql
SELECT p.id, p.numero, c.nome as cliente, p.valor_total, p.updated_at as concluido_em
FROM pedidos p
JOIN clientes c ON c.id = p.cliente_id
WHERE p.status = 'concluido'
  AND NOT EXISTS (SELECT 1 FROM fiscal_documentos fd WHERE fd.pedido_id = p.id AND fd.status != 'cancelada')
ORDER BY p.updated_at DESC
```
Sem parâmetros. Retornar lista de pedidos prontos para faturar (concluídos sem NF-e).

### 5. croma_comissoes
Verificar se tabela `comissoes` existe. Se sim:
```sql
SELECT vendedor_id, SUM(valor_comissao) as total
FROM comissoes
WHERE date_trunc('month', created_at) = $1::date
GROUP BY vendedor_id
```
Se não existir, retornar: "Módulo de comissões ainda não configurado."
Param opcional: mes (YYYY-MM)

### 6. croma_contas_vencendo_hoje
```sql
SELECT cr.id, cr.numero_titulo, cr.valor_original, cr.saldo, cr.data_vencimento,
  c.nome as cliente, c.telefone
FROM contas_receber cr
JOIN clientes c ON c.id = cr.cliente_id
WHERE cr.data_vencimento = CURRENT_DATE
  AND cr.status NOT IN ('pago', 'cancelado', 'baixado')
ORDER BY cr.saldo DESC
```
Sem parâmetros. Uso: "quais contas vencem hoje?"

## PRODUÇÃO — criar mcp-server/src/tools/producao.ts (4 novas)

### 7. croma_dashboard_producao
```sql
SELECT
  (SELECT COUNT(*) FROM ordens_producao WHERE status = 'pendente') as ops_pendentes,
  (SELECT COUNT(*) FROM ordens_producao WHERE status = 'em_producao') as ops_em_producao,
  (SELECT COUNT(*) FROM ordens_producao WHERE status = 'finalizado') as ops_finalizadas,
  (SELECT COUNT(*) FROM ordens_producao WHERE status NOT IN ('finalizado', 'cancelado') AND prazo_entrega < CURRENT_DATE) as ops_atrasadas,
  (SELECT AVG(EXTRACT(DAY FROM (updated_at - created_at))) FROM ordens_producao WHERE status = 'finalizado' AND created_at > CURRENT_DATE - INTERVAL '30 days') as media_dias_conclusao
```

### 8. croma_fila_producao
Usar a view vw_fila_producao se existir:
```sql
SELECT * FROM vw_fila_producao ORDER BY prioridade DESC, prazo_entrega ASC LIMIT 20
```
Se view não existir, fazer query direta em ordens_producao com status NOT IN ('finalizado', 'cancelado').

### 9. croma_expedicao
```sql
SELECT p.id, p.numero, c.nome as cliente, p.valor_total,
  p.prazo_entrega, p.observacoes,
  (SELECT COUNT(*) FROM pedido_itens pi WHERE pi.pedido_id = p.id) as total_itens
FROM pedidos p
JOIN clientes c ON c.id = p.cliente_id
WHERE p.status IN ('pronto_expedicao', 'pronto_entrega', 'concluido')
  AND NOT EXISTS (SELECT 1 FROM ordens_instalacao oi WHERE oi.pedido_id = p.id AND oi.status = 'concluida')
ORDER BY p.prazo_entrega ASC
```
Retornar pedidos prontos para despachar/instalar.

### 10. croma_ops_atrasadas
```sql
SELECT op.id, op.numero, op.status, op.prazo_entrega,
  CURRENT_DATE - op.prazo_entrega as dias_atraso,
  p.numero as pedido_numero, c.nome as cliente
FROM ordens_producao op
JOIN pedidos p ON p.id = op.pedido_id
JOIN clientes c ON c.id = p.cliente_id
WHERE op.status NOT IN ('finalizado', 'concluido', 'cancelado')
  AND op.prazo_entrega < CURRENT_DATE
ORDER BY dias_atraso DESC
```
Sem parâmetros. Uso: "quais OPs estão atrasadas?"

## Registrar no index.ts:
```typescript
import { registerProducaoTools } from "./tools/producao.js";
registerProducaoTools(server);
```

## Build e teste:
```bash
cd mcp-server && npm run build
node dist/call-tool.cjs croma_dashboard_financeiro '{}'
node dist/call-tool.cjs croma_dashboard_producao '{}'
```

Se alguma tabela/view não existir, retornar mensagem amigável (try/catch).
