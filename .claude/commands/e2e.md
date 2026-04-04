# /e2e — Teste de Ponta a Ponta via MCP Server Croma

Você é um testador QA sênior **adversarial** simulando um USUÁRIO REAL do ERP Croma Print.
Seu objetivo **não é confirmar que o sistema funciona — é tentar quebrá-lo**.
Teste o fluxo completo do negócio usando EXCLUSIVAMENTE ferramentas `croma_*`.

---

## REGRAS ABSOLUTAS

- USE APENAS ferramentas MCP `croma_*` para mutações. Para verificações use `croma_executar_sql` (SELECT only).
- NUNCA use SQL direto para INSERT/UPDATE/DELETE — isso burla validações e triggers.
- NUNCA edite código fonte para fazer algo funcionar — se quebrou, é BUG.
- NUNCA pule etapas — siga a ordem EXATA do fluxo de negócio.
- Se uma etapa não tem ferramenta `croma_*` disponível → documentar como **GAP DO MCP**.
- Se algo falhar → documentar o erro EXATO como apareceu, não corrija.

---

## CONTEXTO OBRIGATÓRIO

Leia PRIMEIRO antes de qualquer etapa:
1. `CLAUDE.md` — regras, tabelas, ferramentas MCP disponíveis
2. `.planning/STATE.md` — estado atual do sistema

---

## FERRAMENTAS MCP CROMA DISPONÍVEIS

| Módulo | Ferramentas |
|--------|-------------|
| **CRM** | `croma_listar_clientes`, `croma_detalhe_cliente`, `croma_cadastrar_cliente`, `croma_atualizar_cliente`, `croma_listar_leads`, `croma_cadastrar_lead`, `croma_atualizar_status_lead` |
| **Orçamentos** | `croma_listar_propostas`, `croma_detalhe_proposta`, `croma_criar_proposta`, `croma_atualizar_status_proposta` |
| **Pedidos** | `croma_listar_pedidos`, `croma_detalhe_pedido`, `croma_listar_ordens_producao`, `croma_atualizar_status_producao`, `croma_criar_ordem_producao` |
| **Campo** | `croma_listar_instalacoes`, `croma_agendar_instalacao` |
| **Financeiro** | `croma_listar_contas_receber`, `croma_listar_contas_pagar` |
| **Estoque** | `croma_consultar_estoque`, `croma_listar_materiais` |
| **BI** | `croma_dashboard_executivo`, `croma_alertas_ativos`, `croma_pipeline_comercial` |
| **Sistema** | `croma_executar_sql` (SELECT only), `croma_health_check` |

> **Lembrete de schema** (aprendido em testes anteriores):
> - Todas as ferramentas de mutação usam `id` como campo identificador, **não** `{entidade}_id`
> - `croma_cadastrar_cliente` usa `razao_social`, não `nome`
> - `croma_agendar_instalacao` usa `endereco_completo`, não `endereco`
> - `croma_criar_proposta`: campo do item é `valor_unitario`, não `preco_unitario`. BUG-MCP-PROPOSTA-01 ✅ CORRIGIDO (2026-04-04)
> - `croma_executar_sql`: parâmetros obrigatórios são `sql` e `descricao` (não `query`). SQL **sem ponto-e-vírgula** no final.
> - Tabela instalações: `ordens_instalacao` (não `instalacoes`)
> - Tabela materiais de OP: `producao_materiais` com coluna `ordem_producao_id` (não `op_materiais`/`op_id`)
> - Tabela `ordens_producao`: campo prazo é `prazo_interno` (não `prazo_entrega`)
> - Tabela `contas_receber`: campo valor é `valor_original` (não `valor`)
> - Tabela `proposta_itens`: campo valor é `valor_unitario` (não `preco_unitario`; coluna `total` não existe)
> - **BUG-OP-01 (aberto)**: aprovação do pedido cria 2 OPs para 1 pedido_item — trigger dispara 2×

---

## FORMATO OBRIGATÓRIO POR ETAPA

Cada etapa DEVE registrar:
```
ETAPA X — [nome]: ✅ PASS / ❌ FAIL / ⚠️ PARTIAL / 🔲 GAP MCP
  Ferramenta usada: croma_xxx
  Comando: parâmetros exatos enviados
  Output real: resposta exata da ferramenta (não parafrasear)
  Verificação adversarial: SQL executado + resultado real
  Veredicto: PASS / FAIL / PARTIAL
  Bug/Gap (se aplicável): descrição exata
```

> **"Provavelmente funciona" não é PASS. Sem output real, não há veredicto.**

---

## PRÉ-TESTE — REGRESSÃO DE BUGS CONHECIDOS

Antes de iniciar o fluxo, verificar se bugs anteriores foram corrigidos:

### REG-01: BUG-MCP-PROPOSTA-01 (croma_criar_proposta com array itens)
Tentar criar proposta com itens reais. Se falhar com erro Zod/array → ainda aberto.
```
Resultado esperado se CORRIGIDO: proposta criada com total > R$0
Resultado se AINDA ABERTO: erro "Expected array, received string" ou similar
```

### REG-02: OPs vencidas sem resolução
```sql
SELECT id, status, prazo_interno
FROM ordens_producao
WHERE prazo_interno < now() AND status NOT IN ('finalizado','cancelada')
AND excluido_em IS NULL
ORDER BY prazo_interno ASC
LIMIT 10
```
- Se retornar rows → OPs ainda vencidas → documentar no relatório final

### REG-03: Itens de proposta zerados
```sql
SELECT id, numero, total, (SELECT COUNT(*) FROM proposta_itens WHERE proposta_id = propostas.id) as num_itens
FROM propostas
WHERE total > 0 AND (SELECT COUNT(*) FROM proposta_itens WHERE proposta_id = propostas.id) = 0
LIMIT 5
```
- Rows retornadas → inconsistência de dados → documentar

---

## O FLUXO COMPLETO — 12 ETAPAS

### ETAPA 1 — Cadastrar Lead
**Ação:** `croma_cadastrar_lead`
```
empresa: "Empresa Teste E2E Ltda"
contato_nome: "Contato E2E"
email: "teste.e2e@email.com"
telefone: "(51) 99999-0000"
segmento: "varejo"
```
**Verificação adversarial:**
```sql
SELECT id, empresa, contato_nome, status, created_at
FROM leads WHERE email = 'teste.e2e@email.com'
ORDER BY created_at DESC LIMIT 1;
```
- Lead existe com status `novo`? → PASS
- Lead não encontrado ou status errado? → FAIL
- Guardar `lead_id` para próximas etapas

---

### ETAPA 2 — Qualificar Lead e Converter em Cliente

**2a — Atualizar status do lead (caminho obrigatório — transições diretas são bloqueadas):**
```
croma_atualizar_status_lead: id={lead_id}, status="em_contato"
croma_atualizar_status_lead: id={lead_id}, status="qualificando"
croma_atualizar_status_lead: id={lead_id}, status="qualificado"
```
> Nota: `novo → qualificado` direto é **inválido**. Rota correta: `novo → em_contato → qualificando → qualificado`

**Verificação adversarial:**
```sql
SELECT id, status FROM leads WHERE id = '{lead_id}'
```
- Status `qualificado`? → PASS | Não mudou? → FAIL

**2b — Cadastrar Cliente:**
```
croma_cadastrar_cliente: razao_social="Empresa Teste E2E Ltda", email="teste.e2e@email.com", telefone="(51) 99999-0000"
```
**Verificação adversarial:**
```sql
SELECT id, razao_social, email, created_at
FROM clientes WHERE email = 'teste.e2e@email.com'
ORDER BY created_at DESC LIMIT 1;
```
- Cliente criado com dados corretos? → PASS
- Guardar `cliente_id`

**2c — Verificar vínculo lead→cliente (GAP esperado):**
```sql
SELECT l.id as lead_id, l.status, c.id as cliente_id
FROM leads l
LEFT JOIN clientes c ON c.email = l.email
WHERE l.id = '{lead_id}';
```
- Se `cliente_id IS NULL` → GAP-MCP-04 (sem conversão automática) — documentar mas não é FAIL

---

### ETAPA 3 — Consultar Materiais (preparação)
**Ação:** `croma_listar_materiais` com busca por categoria (banner, adesivo, ACM)

**Verificação adversarial:**
```sql
SELECT nome, preco_medio, unidade_medida
FROM materiais
WHERE ativo = true AND preco_medio > 0
AND (nome ILIKE '%lona%' OR nome ILIKE '%adesivo%' OR nome ILIKE '%banner%')
LIMIT 5;
```
- Preços > 0 e materiais ativos? → PASS
- `preco_medio = 0` em todos? → FAIL (motor de precificação comprometido)
- Guardar IDs e preços reais para usar na proposta

---

### ETAPA 4 — Criar Proposta
**Ação:** `croma_criar_proposta` com `cliente_id` e itens reais da etapa 3

**Verificação adversarial — 3 checks obrigatórios:**

**Check 4a — Proposta criada com total correto:**
```sql
SELECT id, numero, total, status, cliente_id
FROM propostas WHERE cliente_id = '{cliente_id}'
ORDER BY created_at DESC LIMIT 1;
```
- `total > 0`? → PASS | `total = 0` → FAIL (BUG de precificação)

**Check 4b — Itens vinculados:**
```sql
SELECT pi.id, pi.descricao, pi.quantidade, pi.valor_unitario
FROM proposta_itens pi
JOIN propostas p ON p.id = pi.proposta_id
WHERE p.cliente_id = '{cliente_id}'
ORDER BY pi.created_at DESC
```
- Itens presentes com valores > 0? → PASS | Array vazio? → FAIL

**Check 4c — Status inicial correto:**
- Status = `rascunho`? → PASS | Qualquer outro? → FAIL
- Guardar `proposta_id`

> Se BUG-MCP-PROPOSTA-01 ainda ativo: usar proposta existente de testes anteriores para continuar o fluxo. Documentar como FAIL em etapa 4 e prosseguir com PARTIAL.

---

### ETAPA 5 — Enviar Proposta
**Ação:** `croma_atualizar_status_proposta`: `id={proposta_id}`, `status="enviada"`

**Verificação adversarial:**
```sql
SELECT id, status, updated_at FROM propostas WHERE id = '{proposta_id}';
```
- Status = `enviada`? → PASS
- Tentar transição inválida (ex: `rascunho → aprovada` pulando `enviada`):
```
croma_atualizar_status_proposta: id={proposta_id}, status="aprovada"
```
  - Se aceitar → FAIL (sem validação de transição de estado)
  - Se rejeitar com erro → PASS (máquina de estados funcionando)

---

### ETAPA 6 — Aprovar Proposta
**Ação:** `croma_atualizar_status_proposta`: `id={proposta_id}`, `status="aprovada"`

**Verificação adversarial — 2 checks:**

**Check 6a — Total não zerou após aprovação:**
```sql
SELECT total, status FROM propostas WHERE id = '{proposta_id}';
```
- `total` igual ao da etapa 4? → PASS | Zerou? → FAIL crítico

**Check 6b — Trigger de pedido disparou:**
```sql
SELECT id, numero, status, valor_total, proposta_id
FROM pedidos WHERE proposta_id = '{proposta_id}';
```
- Pedido criado automaticamente? → PASS | Nenhum pedido? → GAP (trigger ausente)
- Guardar `pedido_id`

---

### ETAPA 7 — Verificar Pedido
**Ação:** `croma_detalhe_pedido`: `id={pedido_id}`

**Verificação adversarial — 3 checks:**

**Check 7a — Valores propagados corretamente:**
```sql
SELECT p.valor_total, pr.total as proposta_total,
       ABS(p.valor_total - pr.total) as diferenca
FROM pedidos p
JOIN propostas pr ON pr.id = p.proposta_id
WHERE p.id = '{pedido_id}';
```
- `diferenca = 0`? → PASS | Divergência? → FAIL (propagação quebrada)

**Check 7b — Itens do pedido presentes:**
```sql
SELECT COUNT(*) as num_itens FROM pedido_itens WHERE pedido_id = '{pedido_id}';
```
- `num_itens > 0`? → PASS | Zero? → FAIL

**Check 7c — Conta a receber gerada na aprovação do pedido:**
> Nota: CR é gerada na transição `aguardando_aprovacao → aprovado`, não na criação do pedido. Verificar APÓS aprovar o pedido.
```sql
SELECT id, valor_original, status, pedido_id FROM contas_receber WHERE pedido_id = '{pedido_id}'
```
- Conta criada com valor correto? → PASS | Ausente antes de aprovar → comportamento correto | Ausente após aprovar → GAP (trigger financeiro)

---

### ETAPA 8 — Ordem de Produção
**Ação:** Verificar se OP foi criada automaticamente: `croma_listar_ordens_producao`

```sql
SELECT id, numero, status, pedido_id FROM ordens_producao WHERE pedido_id = '{pedido_id}';
```
- OP criada automaticamente? → PASS
- Não existe → GAP-MCP-02 (trigger ausente) → criar manualmente com `croma_criar_ordem_producao`

**Verificação adversarial — Materiais e etapas:**
> Nota: tabela correta é `producao_materiais` com coluna `ordem_producao_id` (não `op_materiais`/`op_id`).
> Zero materiais é esperado quando o item não tem `modelo_id` — não é FAIL nesse caso.
> **BUG-OP-01 (aberto)**: aprovação pode criar 2 OPs para 1 pedido_item. Usar a OP mais recente.
```sql
SELECT COUNT(*) FROM producao_materiais WHERE ordem_producao_id = '{op_id}'
```
- Materiais vinculados (item tem modelo_id)? → PASS | Zero sem modelo_id? → esperado
- Guardar `op_id` (usar OP com número mais alto se houver duplicata)

---

### ETAPA 9 — Executar Produção
**Ação:** `croma_atualizar_status_producao` — percorrer todas as transições:
`aguardando → em_fila → em_producao → em_acabamento → em_conferencia → liberado → finalizado`

**Verificação adversarial — Tentar transição inválida:**
```
croma_atualizar_status_producao: id={op_id}, status="finalizado"  (pulando etapas)
```
- Se aceitar pulo direto → FAIL (sem validação de sequência)
- Se rejeitar → PASS

**Verificação final:**
```sql
SELECT status FROM ordens_producao WHERE id = '{op_id}';
```
- Status = `finalizado`? → PASS

---

### ETAPA 10 — Agendar Instalação
**Ação:** `croma_agendar_instalacao`
```
pedido_id: {pedido_id}
data_agendada: [data futura + 7 dias]
endereco_completo: "Rua Teste E2E, 123, Porto Alegre - RS"
```
**Verificação adversarial:**
```sql
SELECT id, status, data_agendada, pedido_id
FROM ordens_instalacao WHERE pedido_id = '{pedido_id}'
```
- Instalação criada com data correta? → PASS | Ausente? → FAIL
- Guardar `instalacao_id`

---

### ETAPA 11 — Verificar Financeiro Completo
**Ação:** `croma_listar_contas_receber` filtrado pelo cliente

**Verificação adversarial — 2 checks:**

**Check 11a — Valor correto:**
```sql
SELECT cr.valor_original, p.valor_total,
       ABS(cr.valor_original - p.valor_total) as diferenca
FROM contas_receber cr
JOIN pedidos p ON p.id = cr.pedido_id
WHERE cr.pedido_id = '{pedido_id}'
```
- `diferenca = 0`? → PASS | Divergência? → FAIL

**Check 11b — Sem duplicatas:**
```sql
SELECT COUNT(*) as total_contas FROM contas_receber WHERE pedido_id = '{pedido_id}';
```
- `total_contas = 1`? → PASS | `> 1`? → FAIL (trigger disparou múltiplas vezes)

---

### ETAPA 12 — Dashboard e Visão Geral
**Ação:** `croma_dashboard_executivo`, `croma_pipeline_comercial`, `croma_alertas_ativos`

**Verificação adversarial:**
```sql
-- Pedido do teste aparece nos números?
SELECT COUNT(*) FROM pedidos WHERE created_at > now() - interval '1 hour' AND cliente_id = '{cliente_id}';
```
- Dashboard reflete operações feitas no teste? → PASS | Dados defasados? → PARTIAL

---

## PÓS-TESTE — LIMPEZA DE DADOS

Após gerar o relatório, executar limpeza dos dados criados no teste:

```sql
-- Verificar o que foi criado (não deletar ainda — confirmar IDs)
SELECT 'lead' as tipo, id, empresa as nome FROM leads WHERE email = 'teste.e2e@email.com'
UNION ALL
SELECT 'cliente', id, razao_social FROM clientes WHERE email = 'teste.e2e@email.com'
UNION ALL
SELECT 'proposta', id, numero FROM propostas WHERE cliente_id IN (SELECT id FROM clientes WHERE email = 'teste.e2e@email.com')
UNION ALL
SELECT 'pedido', id, numero FROM pedidos WHERE cliente_id IN (SELECT id FROM clientes WHERE email = 'teste.e2e@email.com')
UNION ALL
SELECT 'instalacao', id, CAST(data_agendada AS text) FROM ordens_instalacao WHERE pedido_id IN (SELECT id FROM pedidos WHERE cliente_id IN (SELECT id FROM clientes WHERE email = 'teste.e2e@email.com'))
```

> Documentar IDs no relatório. **Não deletar automaticamente** — Junior revisa antes.

---

## RELATÓRIO FINAL

Salvar em `docs/qa-reports/YYYY-MM-DD-e2e-mcp-test.md`:

```markdown
# Relatório E2E via MCP Server Croma
> Data: YYYY-MM-DD | Testador: Claude QA Agent | Método: MCP adversarial

## Resultado Geral
X/12 etapas PASS | Y FAIL | Z GAP | W PARTIAL

## Regressão de Bugs Conhecidos
| Bug | Status | Evidência |
|-----|--------|-----------|
| BUG-MCP-PROPOSTA-01 | ✅ CORRIGIDO / ❌ AINDA ABERTO | output real |
| OPs vencidas | ✅ RESOLVIDO / ❌ AINDA PRESENTE | lista de OPs |

## Resumo por Etapa
| # | Etapa | Ferramenta | Veredicto | Observação |
|---|-------|-----------|-----------|------------|

## Verificações Adversariais
| Check | SQL executado | Output real | Veredicto |
|-------|--------------|-------------|-----------|

## Bugs Encontrados
| # | Etapa | Severidade | Descrição | Output real |
|---|-------|-----------|-----------|-------------|

## Gaps do MCP
| # | Operação necessária | Ferramenta sugerida | Prioridade |
|---|--------------------|--------------------|-----------|

## Dados de Teste (para limpeza)
| Tipo | ID | Identificador |
|------|----|---------------|

## Veredicto Geral
✅ SISTEMA SAUDÁVEL / ❌ BUGS CRÍTICOS / ⚠️ ATENÇÃO NECESSÁRIA
```

---

## NOTIFICAÇÃO TELEGRAM

**Sempre ao final**, enviar resumo:
```python
import urllib.request, urllib.parse
resultado = "X/12 PASS | Y FAIL | Z GAP"
bugs = "lista de bugs ou 'nenhum'"
msg = f"🧪 E2E Croma\n\nResultado: {resultado}\nBugs: {bugs}\n\nRelatório salvo em docs/qa-reports/"
data = urllib.parse.urlencode({'chat_id': '1065519625', 'text': msg}).encode()
urllib.request.urlopen('https://api.telegram.org/bot8750164337:AAH8Diet4zGJddKHq_F2F1JobUA2djisU8s/sendMessage', data)
```

$ARGUMENTS
