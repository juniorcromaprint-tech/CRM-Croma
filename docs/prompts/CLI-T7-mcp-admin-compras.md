# T7 — MCP Fase 3C: Ferramentas Admin + Compras (10 novas tools)
> Copiar e colar no CLI

---

Expandir MCP Server com 10 ferramentas de Admin e Compras para cobertura completa.

## Contexto
- Admin tem 3 tools (listar_produtos, listar_regras, atualizar_preco) — faltam 15 páginas de cobertura
- Compras tem 0 tools — 4 páginas sem MCP
- Prioridade: ferramentas que eu (Claude/Cowork) preciso para operar o dia a dia

## ADMIN — adicionar em mcp-server/src/tools/admin.ts (6 novas)

### 1. croma_listar_usuarios
```sql
SELECT id, raw_user_meta_data->>'nome' as nome, email,
  raw_user_meta_data->>'role' as role,
  last_sign_in_at
FROM auth.users
ORDER BY last_sign_in_at DESC NULLS LAST
```
Se não tiver acesso a auth.users (RLS), usar tabela `profiles` ou equivalente.
Sem parâmetros. Retornar lista de usuários do sistema.

### 2. croma_listar_maquinas
```sql
SELECT * FROM maquinas ORDER BY nome
```
Se tabela não existir: "Módulo de máquinas não configurado."
Retornar: id, nome, tipo, setor, status, capacidade_diaria

### 3. croma_config_empresa
```sql
SELECT * FROM admin_config WHERE chave IN (
  'empresa_nome', 'empresa_cnpj', 'empresa_endereco', 'empresa_telefone',
  'empresa_email', 'horario_comercial', 'agent_config'
)
```
Se admin_config não existir, tentar empresa ou configuracoes.
Retornar configurações chave=valor.

### 4. croma_cockpit_executivo
Usar view vw_cockpit_executivo se existir:
```sql
SELECT * FROM vw_cockpit_executivo
```
Se não existir, montar query:
```sql
SELECT
  (SELECT COUNT(*) FROM leads WHERE status = 'novo' AND created_at > CURRENT_DATE - INTERVAL '7 days') as leads_semana,
  (SELECT COUNT(*) FROM propostas WHERE status = 'enviada') as propostas_abertas,
  (SELECT COUNT(*) FROM pedidos WHERE status NOT IN ('concluido', 'cancelado', 'entregue')) as pedidos_ativos,
  (SELECT COUNT(*) FROM ordens_producao WHERE status = 'em_producao') as ops_em_producao,
  (SELECT COALESCE(SUM(saldo), 0) FROM contas_receber WHERE status NOT IN ('pago', 'cancelado')) as cr_aberto,
  (SELECT COALESCE(SUM(valor_pago), 0) FROM contas_receber WHERE status = 'pago' AND data_pagamento >= date_trunc('month', CURRENT_DATE)) as faturamento_mes
```
Sem parâmetros. Visão 360° da empresa.

### 5. croma_listar_automacoes
```sql
SELECT ar.nome, ar.modulo, ar.tipo, ar.ativo, ar.prioridade,
  ar.ultima_execucao, ar.total_execucoes,
  ar.condicao, ar.acao
FROM agent_rules ar
ORDER BY ar.prioridade DESC
```
Sem parâmetros. Retornar todas as regras de automação com status.

### 6. croma_listar_eventos_sistema
```sql
SELECT se.id, se.event_type, se.entity_type, se.entity_id,
  se.payload, se.processed, se.created_at
FROM system_events se
ORDER BY se.created_at DESC
LIMIT 50
```
Filtros opcionais: event_type, entity_type, processed (true/false)
Uso: "quais eventos aconteceram hoje?"

## COMPRAS — criar mcp-server/src/tools/compras.ts (4 novas)

### 7. croma_listar_fornecedores
```sql
SELECT * FROM fornecedores ORDER BY nome
```
Se tabela não existir: "Módulo de fornecedores não configurado no banco."
Filtros: ativo (true/false), busca (ILIKE no nome)
Retornar: id, nome, cnpj, telefone, email, categorias, avaliacao

### 8. croma_cadastrar_fornecedor
```sql
INSERT INTO fornecedores (nome, cnpj, telefone, email, endereco, categorias, observacoes)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *
```
Params: nome (required), cnpj, telefone, email, endereco, categorias (array), observacoes
Usar .select().single()

### 9. croma_listar_pedidos_compra
```sql
SELECT pc.*, f.nome as fornecedor_nome
FROM pedidos_compra pc
LEFT JOIN fornecedores f ON f.id = pc.fornecedor_id
ORDER BY pc.created_at DESC
```
Se tabela não existir: "Módulo de pedidos de compra não configurado."
Filtros: status, fornecedor_id
Retornar: id, numero, fornecedor_nome, valor_total, status, data_entrega

### 10. croma_criar_pedido_compra
```sql
INSERT INTO pedidos_compra (fornecedor_id, itens, valor_total, prazo_entrega, observacoes, status)
VALUES ($1, $2, $3, $4, $5, 'rascunho')
RETURNING *
```
Params: fornecedor_id (required), itens (jsonb), valor_total, prazo_entrega, observacoes
Usar .select().single()

## Registrar no index.ts:
```typescript
import { registerComprasTools } from "./tools/compras.js";
registerComprasTools(server);
```

## Build e teste:
```bash
cd mcp-server && npm run build
node dist/call-tool.cjs croma_listar_usuarios '{}'
node dist/call-tool.cjs croma_cockpit_executivo '{}'
node dist/call-tool.cjs croma_listar_automacoes '{}'
node dist/call-tool.cjs croma_listar_fornecedores '{}'
```

REGRA: Toda ferramenta que acessa tabela que pode não existir DEVE ter try/catch com mensagem amigável.
Nunca crashar o MCP Server por tabela faltante.
