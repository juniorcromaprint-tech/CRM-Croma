# Plano E2E Completo + Expansão MCP Server

> **Para**: Claude CLI (Sonnet)
> **Objetivo**: Tornar o MCP Server Croma completo o suficiente para que o Claude gerencie 100% do sistema, e validar com teste E2E abrangente antes de liberar para produção
> **Data**: 2026-04-01

---

## Situação Atual

| Métrica | Valor |
|---------|-------|
| Ferramentas MCP existentes | 29 |
| Rotas do frontend | 74 |
| Edge Functions | 44 |
| Cobertura MCP sobre o frontend | ~30% |
| Módulos com 0% de cobertura MCP | Fiscal, Contabilidade, Qualidade, Compras, Admin |

O MCP cobre bem CRM e Comercial, mas Financeiro, Produção, Fiscal e Admin estão praticamente cegos.

---

## FASE 1 — Ferramentas MCP Essenciais (desbloqueia o fluxo completo)

**Prioridade**: CRÍTICA — sem isso o sistema não está pronto para produção
**Estimativa**: ~2h de trabalho para o CLI

Todas as ferramentas seguem o padrão existente em `mcp-server/src/tools/`. Usar `getUserClient()` para writes e `getAdminClient()` para reads. Sempre `.select().single()` em inserts/updates.

### 1.1 — Financeiro (em `financeiro.ts`)

```
croma_criar_conta_receber        — INSERT em contas_receber (com idempotência por pedido_id)
croma_registrar_pagamento        — UPDATE em contas_receber (valor_pago, data_pagamento, status→pago)
croma_criar_conta_pagar          — INSERT em contas_pagar
croma_registrar_pagamento_cp     — UPDATE em contas_pagar (marcar como pago)
```

**Implementação `croma_registrar_pagamento`:**
- Params: `id` (UUID da CR), `valor_pago` (number), `data_pagamento` (string ISO), `forma_pagamento` (enum)
- Lógica: se `valor_pago >= saldo` → status = "pago"; se `valor_pago < saldo` → status = "parcial"
- Atualiza `saldo = valor_original - valor_pago`

### 1.2 — Produção (em `pedidos.ts`)

```
croma_criar_ordem_producao       — INSERT em ordens_producao (já planejado no plano anterior)
```

### 1.3 — Fiscal (novo arquivo `fiscal.ts`)

```
croma_listar_nfe                 — SELECT em fiscal_documentos com filtros
croma_emitir_nfe                 — Chama Edge Function fiscal-emitir-nfe (via fetch ao Supabase)
croma_consultar_status_nfe       — Chama Edge Function fiscal-consultar-nfe
```

**Nota**: As Edge Functions fiscais já existem e funcionam. O MCP só precisa chamá-las via `fetch` ao Supabase:
```typescript
const response = await fetch(
  `https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/fiscal-emitir-nfe`,
  {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ pedido_id: params.pedido_id })
  }
);
```

### 1.4 — Qualidade (novo arquivo `qualidade.ts`)

```
croma_listar_ocorrencias         — SELECT em ocorrencias_qualidade
croma_criar_ocorrencia           — INSERT em ocorrencias_qualidade
croma_atualizar_ocorrencia       — UPDATE status da ocorrência
```

### 1.5 — Estoque (em `estoque.ts`)

```
croma_registrar_movimento        — INSERT em estoque_movimentos (entrada/saída/ajuste)
```

### 1.6 — Admin/Catálogo (novo arquivo `admin.ts`)

```
croma_listar_produtos            — SELECT em produtos com modelos e materiais
croma_atualizar_preco_material   — UPDATE em materiais (preço_medio)
croma_listar_regras_precificacao — SELECT em regras_precificacao
```

### Registro no index.ts

Adicionar imports e chamadas para os novos módulos:
```typescript
import { registerFiscalTools } from "./tools/fiscal.js";
import { registerQualidadeTools } from "./tools/qualidade.js";
import { registerAdminTools } from "./tools/admin.js";

registerFiscalTools(server);
registerQualidadeTools(server);
registerAdminTools(server);
```

**Total após Fase 1: ~44 ferramentas** (de 29 para 44)

---

## FASE 2 — Teste E2E Completo (validação antes de liberar)

Após implementar a Fase 1, executar este roteiro completo. Cada cenário deve ser testado VIA MCP, simulando o Claude operando o sistema como gestor.

### Cenário 1 — Fluxo Comercial Completo (Lead → Faturamento)

```
PASSO  FERRAMENTA MCP                    VALIDAÇÃO
─────  ────────────────────────────────   ────────────────────────────────
1.     croma_cadastrar_lead              Lead criado, aparece na listagem
2.     croma_atualizar_status_lead ×7    Pipeline: novo→...→convertido
3.     croma_cadastrar_cliente           Cliente com lead_id vinculado
4.     croma_listar_materiais            Consultar preço real de materiais
5.     croma_criar_proposta              Proposta com itens e total correto
6.     croma_enviar_proposta             Email enviado (verificar SMTP)
7.     croma_atualizar_status_proposta   rascunho→enviada→aprovada
8.     croma_listar_pedidos              Pedido criado por trigger (verificar)
9.     croma_atualizar_status_pedido     aguardando_aprovacao→aprovado
10.    croma_listar_ordens_producao      OPs criadas por trigger (1 por item)
11.    croma_atualizar_status_producao   aguard_prog→em_fila→em_prod→...→finalizado
12.    croma_listar_contas_receber       CR criada por trigger (verificar)
13.    croma_agendar_instalacao          Instalação agendada
14.    croma_registrar_pagamento         Marcar CR como paga
15.    croma_dashboard_executivo         KPIs refletem todo o fluxo
```

**Critério**: 15/15 PASS

### Cenário 2 — Financeiro

```
PASSO  FERRAMENTA MCP                    VALIDAÇÃO
─────  ────────────────────────────────   ────────────────────────────────
1.     croma_listar_contas_receber       Listar CRs existentes
2.     croma_criar_conta_receber         Criar CR manual
3.     croma_registrar_pagamento         Pagamento parcial (status→parcial)
4.     croma_registrar_pagamento         Pagamento final (status→pago, saldo=0)
5.     croma_listar_contas_pagar         Listar CPs
6.     croma_criar_conta_pagar           Criar CP manual
7.     croma_registrar_pagamento_cp      Pagar CP
```

**Critério**: 7/7 PASS

### Cenário 3 — Produção Isolada

```
PASSO  FERRAMENTA MCP                    VALIDAÇÃO
─────  ────────────────────────────────   ────────────────────────────────
1.     croma_criar_ordem_producao        OP manual para pedido aprovado
2.     croma_atualizar_status_producao   Avançar: aguard→fila→prod→acab→conf→lib→final
3.     croma_listar_ordens_producao      Filtrar por status, verificar atrasadas
4.     croma_alertas_ativos              Verificar alertas de OPs vencidas
```

**Critério**: 4/4 PASS + OPs vencidas reais aparecem nos alertas

### Cenário 4 — Fiscal (NF-e em homologação)

```
PASSO  FERRAMENTA MCP                    VALIDAÇÃO
─────  ────────────────────────────────   ────────────────────────────────
1.     croma_listar_nfe                  Listar documentos fiscais existentes
2.     croma_emitir_nfe                  Emitir NF-e de teste (homologação)
3.     croma_consultar_status_nfe        Verificar status na SEFAZ
```

**Critério**: 3/3 PASS (em homologação é OK retornar código de teste)

### Cenário 5 — Qualidade

```
PASSO  FERRAMENTA MCP                    VALIDAÇÃO
─────  ────────────────────────────────   ────────────────────────────────
1.     croma_criar_ocorrencia            Registrar problema de qualidade
2.     croma_listar_ocorrencias          Verificar que aparece
3.     croma_atualizar_ocorrencia        Resolver/fechar ocorrência
```

**Critério**: 3/3 PASS

### Cenário 6 — Estoque

```
PASSO  FERRAMENTA MCP                    VALIDAÇÃO
─────  ────────────────────────────────   ────────────────────────────────
1.     croma_listar_materiais            496 materiais com preço
2.     croma_consultar_estoque           Saldo de material específico
3.     croma_registrar_movimento         Entrada de material
4.     croma_consultar_estoque           Saldo atualizado
```

**Critério**: 4/4 PASS

### Cenário 7 — Admin/Catálogo

```
PASSO  FERRAMENTA MCP                    VALIDAÇÃO
─────  ────────────────────────────────   ────────────────────────────────
1.     croma_listar_produtos             156 produtos com markup
2.     croma_listar_regras_precificacao  11 categorias de precificação
3.     croma_atualizar_preco_material    Atualizar preço de um material
4.     croma_listar_materiais            Verificar preço atualizado
```

**Critério**: 4/4 PASS

### Cenário 8 — Resiliência e Edge Cases

```
PASSO  TESTE                             VALIDAÇÃO
─────  ────────────────────────────────   ────────────────────────────────
1.     Transição inválida de pedido      Deve retornar erro claro, não crashar
2.     Criar proposta sem itens          Deve rejeitar (validação Zod)
3.     Aprovar proposta já aprovada      Deve rejeitar (status final)
4.     Criar CR duplicada pro mesmo ped  Deve retornar aviso (idempotência)
5.     croma_executar_sql com DELETE     Deve rejeitar (read-only)
6.     croma_health_check                <2s de resposta
```

**Critério**: 6/6 PASS (todos rejeitam graciosamente)

---

## RESUMO DE CRITÉRIOS

| Cenário | Passos | Critério |
|---------|--------|----------|
| 1 — Fluxo Completo | 15 | 15/15 PASS |
| 2 — Financeiro | 7 | 7/7 PASS |
| 3 — Produção | 4 | 4/4 PASS |
| 4 — Fiscal | 3 | 3/3 PASS |
| 5 — Qualidade | 3 | 3/3 PASS |
| 6 — Estoque | 4 | 4/4 PASS |
| 7 — Admin | 4 | 4/4 PASS |
| 8 — Edge Cases | 6 | 6/6 PASS |
| **TOTAL** | **46** | **46/46 PASS** |

---

## FASE 3 — Ferramentas MCP Avançadas (pós-liberação, evolução contínua)

Estas não bloqueiam a liberação mas completam a gestão:

```
croma_enviar_whatsapp            — Chamar Edge Function whatsapp-enviar
croma_enviar_email               — Chamar Edge Function agent-enviar-email
croma_listar_campanhas           — SELECT em campanhas
croma_criar_campanha             — INSERT em campanhas + Edge Function
croma_resumo_diario              — Chamar Edge Function ai-insights-diarios
croma_score_credito_cliente      — SELECT score_credito de clientes
croma_recalcular_scores          — Chamar fn_recalcular_todos_scores
croma_listar_comissoes           — SELECT em comissoes
croma_fluxo_caixa                — SELECT em vw_fluxo_caixa ou service
croma_conciliar_bancario         — Chamar Edge Function ai-conciliar-bancario
croma_importar_ofx               — Chamar Edge Function ai-classificar-extrato
croma_listar_fornecedores        — SELECT em fornecedores
croma_criar_pedido_compra        — INSERT em pedidos_compra
croma_listar_usuarios            — SELECT em profiles
croma_atualizar_config           — UPDATE em admin_config
```

**Total final projetado: ~60 ferramentas**

---

## Comando para o Claude CLI

Copiar e colar isso no terminal:

```
Executar o plano em docs/qa-reports/2026-04-01-PLANO-E2E-COMPLETO.md

FASE 1 — Implementar as ferramentas MCP que faltam, na seguinte ordem:

1. Em mcp-server/src/tools/financeiro.ts:
   - Adicionar import de getUserClient (substituir getSupabaseClient por getAdminClient nas reads existentes e getUserClient nas writes novas)
   - croma_criar_conta_receber (com idempotência por pedido_id)
   - croma_registrar_pagamento (pagamento parcial ou total, atualiza saldo)
   - croma_criar_conta_pagar
   - croma_registrar_pagamento_cp

2. Em mcp-server/src/tools/pedidos.ts:
   - croma_criar_ordem_producao (validar que pedido está aprovado/em_producao)

3. Criar mcp-server/src/tools/fiscal.ts:
   - croma_listar_nfe (SELECT em fiscal_documentos)
   - croma_emitir_nfe (fetch à Edge Function fiscal-emitir-nfe)
   - croma_consultar_status_nfe (fetch à Edge Function fiscal-consultar-nfe)
   - Registrar no index.ts

4. Criar mcp-server/src/tools/qualidade.ts:
   - croma_listar_ocorrencias
   - croma_criar_ocorrencia
   - croma_atualizar_ocorrencia
   - Registrar no index.ts

5. Em mcp-server/src/tools/estoque.ts:
   - croma_registrar_movimento (INSERT em estoque_movimentos, tipo: entrada/saida/ajuste)

6. Criar mcp-server/src/tools/admin.ts:
   - croma_listar_produtos (com modelos e markup)
   - croma_atualizar_preco_material
   - croma_listar_regras_precificacao
   - Registrar no index.ts

7. Atualizar index.ts: imports, comentários, contagem total

8. Build: cd mcp-server && npm run build — zero erros

FASE 2 — Após build OK, executar os 8 cenários de teste E2E documentados no plano (46 passos total). Usar as ferramentas MCP reais. Gerar relatório em docs/qa-reports/2026-04-01-e2e-completo-resultado.md com status PASS/FAIL de cada passo.

IMPORTANTE:
- Seguir padrão existente dos tools (Zod strict, getUserClient para writes, getAdminClient para reads, .select().single() em inserts)
- Para Edge Functions fiscais: usar fetch com Authorization Bearer service_role_key
- Consultar schema das tabelas via migrations em supabase/migrations/ se precisar saber colunas
- Verificar se tabelas existem antes de implementar (fiscal_documentos, ocorrencias_qualidade, estoque_movimentos, etc.)
- Se tabela não existir, criar migration SQL primeiro
```

---

## Bugs Conhecidos a Monitorar no Teste

| Bug | Descrição | Origem |
|-----|-----------|--------|
| BUG-E2E-05 | "column mm.quantidade does not exist" ao avançar OP | Possível view quebrada (vw_fila_producao?) |
| BUG-E2E-06 | Trigger trg_pedido_gera_conta_receber não dispara via MCP | Possível condição no trigger que não detecta update via service_role |
| BUG-E2E-01 | custo_mp/mo/fixo = 0 em propostas via MCP | Motor Mubisys não chamado na criação via ferramenta |

Se qualquer um desses aparecer no teste, investigar e corrigir inline.
