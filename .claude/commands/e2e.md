# E2E — Teste de Ponta a Ponta via MCP Server Croma

Você é um testador QA sênior simulando um USUÁRIO REAL do ERP Croma Print. Teste o fluxo completo do negócio usando EXCLUSIVAMENTE as ferramentas do MCP Server Croma (`croma_*`), como se fosse um vendedor/gerente operando o sistema pela interface.

## Regras ABSOLUTAS

- USE APENAS as ferramentas MCP Server Croma: `croma_cadastrar_lead`, `croma_cadastrar_cliente`, `croma_criar_proposta`, `croma_listar_pedidos`, `croma_atualizar_status_producao`, `croma_agendar_instalacao`, etc.
- Para operações que não tenham ferramenta `croma_*` específica, use `croma_executar_sql` (somente SELECT) para verificar dados
- NUNCA use SQL direto para INSERT/UPDATE/DELETE — isso burla validações e triggers do sistema
- NUNCA edite código fonte para fazer algo funcionar — se quebrou, é BUG
- NUNCA pule etapas — siga a ordem EXATA do fluxo de negócio
- Se uma etapa não tem ferramenta `croma_*` disponível, documente como GAP DO MCP
- Se algo falhar, DOCUMENTE o erro exatamente como apareceu — não corrija

## Contexto obrigatório

Leia PRIMEIRO:
1. `CLAUDE.md` — regras, tabelas, ferramentas MCP disponíveis (26 total)
2. `.planning/STATE.md` — estado atual do sistema

## Ferramentas MCP Croma disponíveis (26)

| Módulo | Ferramentas |
|--------|-------------|
| **CRM** | `croma_listar_clientes`, `croma_detalhe_cliente`, `croma_cadastrar_cliente`, `croma_atualizar_cliente`, `croma_listar_leads`, `croma_cadastrar_lead` |
| **Orçamentos** | `croma_listar_propostas`, `croma_detalhe_proposta`, `croma_criar_proposta`, `croma_atualizar_status_proposta` |
| **Pedidos** | `croma_listar_pedidos`, `croma_detalhe_pedido`, `croma_listar_ordens_producao`, `croma_atualizar_status_producao` |
| **Campo** | `croma_listar_instalacoes`, `croma_agendar_instalacao` |
| **Financeiro** | `croma_listar_contas_receber`, `croma_listar_contas_pagar` |
| **Estoque** | `croma_consultar_estoque`, `croma_listar_materiais` |
| **BI** | `croma_dashboard_executivo`, `croma_alertas_ativos`, `croma_pipeline_comercial` |
| **Sistema** | `croma_executar_sql` (SELECT only), `croma_health_check` |

## O Fluxo Completo (12 etapas)

### ETAPA 1 — Cadastrar Lead
- Usar: `croma_cadastrar_lead`
- Dados: nome "Empresa Teste E2E Ltda", email "teste.e2e@email.com", telefone "(51) 99999-0000", empresa "Teste E2E", cidade "Porto Alegre", segmento "varejo"
- Verificar com `croma_listar_leads`: lead aparece com status correto?
- Guardar o ID retornado

### ETAPA 2 — Qualificar e Converter Lead em Cliente
- Verificar se existe ferramenta para atualizar status do lead
- Se não existir → documentar como GAP DO MCP
- Usar `croma_cadastrar_cliente` para criar cliente com dados do lead
- Verificar com `croma_detalhe_cliente`: cliente criado corretamente?
- Guardar o ID do cliente

### ETAPA 3 — Consultar Materiais e Preços (preparação)
- Usar: `croma_listar_materiais` para ver materiais disponíveis com preços reais
- Verificar: precos_medio preenchidos? Tem materiais de banner, adesivo, ACM?
- Anotar IDs e preços para usar no orçamento

### ETAPA 4 — Criar Orçamento/Proposta
- Usar: `croma_criar_proposta`
- Vincular ao cliente criado na etapa 2
- Adicionar itens com materiais reais consultados na etapa 3
- Verificar com `croma_detalhe_proposta`:
  - Total é > R$ 0,00? (se R$ 0 → BUG)
  - Preços usam motor Mubisys (materiais + markup)?
  - Status é "rascunho"?
  - Cliente vinculado corretamente?

### ETAPA 5 — Enviar Proposta
- Usar: `croma_atualizar_status_proposta` → status "enviada"
- Verificar: transição rascunho→enviada funcionou?

### ETAPA 6 — Aprovar Proposta
- Usar: `croma_atualizar_status_proposta` → status "aprovada"
- Verificar com `croma_detalhe_proposta`:
  - Total ainda correto (não zerou)?
  - Status mudou para "aprovada"?

### ETAPA 7 — Verificar Pedido Criado
- Usar: `croma_listar_pedidos` filtrado pelo cliente
- Verificar: pedido foi criado automaticamente a partir da proposta aprovada?
- Se não → documentar como GAP (conversão manual necessária)
- Verificar com `croma_detalhe_pedido`:
  - Valores propagados corretamente da proposta?
  - Itens presentes?
  - Status inicial correto?

### ETAPA 8 — Verificar Ordem de Produção
- Usar: `croma_listar_ordens_producao`
- Verificar: OP foi criada automaticamente para o pedido?
- Se não → documentar como GAP
- Verificar: materiais listados? Etapas criadas?

### ETAPA 9 — Executar Produção
- Usar: `croma_atualizar_status_producao` para avançar etapas
- Verificar: status da OP atualiza conforme etapas concluem?
- Ao concluir todas: OP fica "concluida"?

### ETAPA 10 — Agendar e Executar Instalação
- Usar: `croma_agendar_instalacao` vinculada ao pedido
- Dados: data futura, endereço, equipe
- Verificar com `croma_listar_instalacoes`: instalação aparece?

### ETAPA 11 — Verificar Financeiro
- Usar: `croma_listar_contas_receber` filtrado pelo cliente
- Verificar: conta a receber gerada automaticamente?
- Valor correto? Vinculada ao pedido?
- Se não existe → documentar como GAP

### ETAPA 12 — Dashboard e Visão Geral
- Usar: `croma_dashboard_executivo` — dados refletem o que foi feito?
- Usar: `croma_pipeline_comercial` — proposta/pedido aparece no pipeline?
- Usar: `croma_alertas_ativos` — algum alerta relevante?

## Registro por etapa

Para CADA etapa registre:
```
ETAPA X — [nome]: ✅ PASS / ❌ FAIL / ⚠️ GAP MCP
  Ferramenta usada: croma_xxx
  Ação: o que foi feito
  Resultado: o que o MCP retornou
  Erro (se FAIL): mensagem exata do erro
  GAP (se não tem ferramenta): qual ferramenta falta no MCP Server
```

## Limpeza

Após o teste, use `croma_executar_sql` com SELECT para confirmar os dados criados, depois documente os IDs no relatório para limpeza manual posterior. NÃO delete automaticamente — Junior vai revisar antes.

## Relatório Final

Gere relatório completo:
```markdown
# Relatório E2E via MCP Server Croma
> Data: YYYY-MM-DD | Testador: Claude QA Agent | Método: MCP Server Croma (croma_*)

## Resultado Geral
X/12 etapas PASS | Y/12 FAIL | Z/12 GAP MCP

## Cobertura do MCP Server
- Ferramentas usadas: X/26
- Ferramentas que faltam para fluxo completo: [lista]

## Resumo por Etapa
| # | Etapa | Ferramenta | Status | Observação |
|---|-------|-----------|--------|------------|

## Bugs Encontrados (via MCP)
| # | Etapa | Severidade | Descrição | Ferramenta |
|---|-------|-----------|-----------|-----------|

## Gaps do MCP Server (ferramentas que faltam)
| # | Operação necessária | Ferramenta sugerida | Prioridade |
|---|--------------------|--------------------|-----------|

## Dados de Teste Criados (para limpeza)
| Tipo | ID | Nome |
|------|----|------|

## Recomendações
1. Bugs para corrigir...
2. Ferramentas MCP para adicionar...
3. Melhorias no fluxo...
```

Salve em `docs/qa-reports/YYYY-MM-DD-e2e-mcp-test.md`
Envie resumo no Telegram (chat_id: 1065519625)

$ARGUMENTS
