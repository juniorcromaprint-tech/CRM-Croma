# Prompt para Claude CLI — Corrigir 9 bugs de schema mismatch no MCP Server

Cole este prompt inteiro no Claude CLI:

---

## TAREFA: Corrigir 9 bugs de schema mismatch no MCP Server

O teste E2E do MCP Server (`mcp-server/`) revelou que 9 ferramentas estão falhando porque o código referencia colunas/objetos que NÃO existem no banco Supabase real. A causa raiz é que o MCP Server foi escrito com um schema "futuro" diferente do que está no Supabase hoje.

**REGRA**: Corrigir o CÓDIGO do MCP Server para usar as colunas REAIS do banco. NÃO criar migrations, NÃO alterar o banco.

**Relatório E2E**: `docs/qa-reports/2026-04-01-e2e-mcp-test.md`

---

### Bug 1 — `croma_listar_materiais` (arquivo: `mcp-server/src/tools/estoque.ts`)
- **Erro**: Seleciona coluna `custo_metro_quadrado` que NÃO existe
- **Schema real de `materiais`**: id, codigo, nome, categoria, unidade, estoque_minimo, preco_medio, localizacao, ativo, created_at, updated_at, ncm, venda_direta, plano_contas_entrada, plano_contas_saida, data_referencia_preco, aproveitamento, estoque_ideal, estoque_controlado
- **Fix**: Remover referência a `custo_metro_quadrado`. Se quiser custo por m², calcular a partir de `preco_medio` + `aproveitamento` ou simplesmente retornar `preco_medio`.

### Bug 2 — `croma_criar_proposta` (arquivo: `mcp-server/src/tools/propostas.ts`)
- **Erro**: Tenta inserir `material_descricao` em `proposta_itens`, coluna que NÃO existe
- **Schema real de `proposta_itens`**: id, proposta_id, produto_id, descricao, especificacao, quantidade, unidade, largura_cm, altura_cm, area_m2, custo_mp, custo_mo, custo_fixo, markup_percentual, valor_unitario, valor_total, prazo_producao_dias, ordem, created_at, modelo_id, preco_override, grupo_uniao, nome_exibicao, item_visivel
- **Fix**: Mapear `material_descricao` → `descricao`. Usar apenas colunas que existem na tabela real.

### Bug 3 — `croma_atualizar_status_proposta` (arquivo: `mcp-server/src/tools/propostas.ts`)
- **Erro**: Tenta atualizar coluna `enviada_em` em `propostas`, que NÃO existe
- **Schema real de `propostas`** (colunas de data): created_at, updated_at, aprovado_em, excluido_em, share_token_expires_at, aprovado_pelo_cliente_at
- **Fix**: Remover o set de `enviada_em`. Quando status = 'enviada', apenas atualizar o `status` e `updated_at`. Se precisar rastrear quando foi enviada, usar `updated_at` como referência.

### Bug 4 — `croma_listar_ordens_producao` (arquivo: `mcp-server/src/tools/pedidos.ts`)
- **Erro**: Seleciona coluna `setor` que NÃO existe em `ordens_producao`
- **Schema real de `ordens_producao`**: id, numero, pedido_item_id, pedido_id, status, prioridade, responsavel_id, prazo_interno, data_inicio, data_conclusao, tempo_estimado_min, tempo_real_min, custo_mp_estimado, custo_mp_real, custo_mo_estimado, custo_mo_real, observacoes, created_at, updated_at, excluido_em, excluido_por, restricao_financeira, setor_atual_id, maquina_id, data_inicio_prevista, data_fim_prevista
- **Fix**: Substituir `setor` por `setor_atual_id`. Se precisar do nome do setor, fazer join com a tabela de setores, ou retornar apenas o ID.

### Bug 5 — `croma_listar_instalacoes` (arquivo: `mcp-server/src/tools/campo.ts`)
- **Erro**: Faz FK join com tabela `equipes_instalacao` que NÃO existe
- **Tabela real**: `equipes` (colunas: id, nome, regiao, ativo, created_at)
- **Fix**: Trocar `equipes_instalacao` → `equipes`. O campo FK em `ordens_instalacao` é `equipe_id` que referencia `equipes.id`.

### Bug 6 — `croma_agendar_instalacao` (arquivo: `mcp-server/src/tools/campo.ts`)
- **Erro**: Tenta inserir `cidade` em `ordens_instalacao`, coluna que NÃO existe
- **Schema real de `ordens_instalacao`**: id, numero, pedido_id, pedido_item_id, cliente_id, unidade_id, equipe_id, status, data_agendada, hora_prevista, data_execucao, endereco_completo, instrucoes, materiais_necessarios, custo_logistico, observacoes, motivo_reagendamento, created_at, updated_at, excluido_em, excluido_por
- **Fix**: Remover `cidade` do insert. Se receber cidade como parâmetro, concatenar no campo `endereco_completo`.

### Bug 7 — `croma_listar_contas_pagar` (arquivo: `mcp-server/src/tools/financeiro.ts`)
- **Erro**: Seleciona coluna `descricao` que NÃO existe em `contas_pagar`
- **Schema real de `contas_pagar`**: id, pedido_compra_id, fornecedor_id, categoria, numero_titulo, numero_nf, valor_original, valor_pago, saldo, data_emissao, data_vencimento, data_pagamento, status, forma_pagamento, conta_plano_id, centro_custo_id, observacoes, created_at, updated_at, excluido_em, excluido_por, version, aprovado_por, aprovado_em, requer_aprovacao, motivo_rejeicao
- **Fix**: Substituir `descricao` por `categoria` (ou `observacoes`, depende do contexto). O campo mais adequado como "descrição" é `categoria` + `numero_titulo`.

### Bug 8 — `croma_executar_sql` (arquivo: `mcp-server/src/tools/sistema.ts`)
- **Erro**: Chama função `execute_readonly_query` que NÃO existe no banco
- **Função real no banco**: `execute_sql_readonly` (confirmado via information_schema.routines)
- **Fix**: Trocar `execute_readonly_query` → `execute_sql_readonly` na chamada RPC.

---

### INSTRUÇÕES DE EXECUÇÃO

1. Abrir cada arquivo listado acima em `mcp-server/src/tools/`
2. Para cada bug, localizar o trecho com a coluna/objeto errado
3. Aplicar o fix descrito — usar APENAS colunas do schema real
4. Após corrigir todos, rodar `cd mcp-server && npm run build` para verificar que compila
5. NÃO criar migrations, NÃO alterar tabelas no banco
6. Fazer commit com mensagem: `fix(mcp-server): corrigir 9 schema mismatches E2E — alinhar com banco real`

### VERIFICAÇÃO

Após corrigir, listar as mudanças feitas e confirmar que cada tool agora referencia apenas colunas existentes no schema real documentado acima.
