# MCP Server Croma — 93 Ferramentas

> Arquivo de referência — carregado sob demanda quando precisar saber que ferramenta usar

## Acesso

- **Claude Code (CLI)**: ferramentas `croma_*` diretamente via stdio
- **Cowork (Desktop)**: via Desktop Commander:
  ```
  mcp__Desktop_Commander__start_process
  command: C:\Users\Caldera\Claude\CRM-Croma\mcp-server\croma.cmd <tool> {json_args}
  timeout_ms: 30000 | shell: cmd
  ```

## Ferramentas por Módulo

| Módulo | Ferramentas |
|---|---|
| **CRM** | `croma_listar_clientes`, `croma_detalhe_cliente`, `croma_cadastrar_cliente`, `croma_atualizar_cliente`, `croma_listar_leads`, `croma_cadastrar_lead`, `croma_atualizar_status_lead`, `croma_listar_atividades_comerciais`, `croma_registrar_atividade_comercial`, `croma_listar_comissoes`, `croma_registrar_comissao`, `croma_listar_contratos`, `croma_criar_contrato`, `croma_listar_campanhas`, `croma_listar_nps` |
| **Orçamentos** | `croma_listar_propostas`, `croma_detalhe_proposta`, `croma_criar_proposta`, `croma_atualizar_status_proposta`, `croma_enviar_proposta` |
| **Pedidos** | `croma_listar_pedidos`, `croma_detalhe_pedido`, `croma_atualizar_status_pedido`, `croma_listar_ordens_producao`, `croma_atualizar_status_producao`, `croma_criar_ordem_producao`, `croma_registrar_apontamento_producao`, `croma_listar_apontamentos_producao` || **Campo** | `croma_listar_instalacoes`, `croma_agendar_instalacao`, `croma_listar_jobs_campo`, `croma_detalhe_job_campo`, `croma_listar_fotos_job`, `croma_criar_job_campo`, `croma_atualizar_job_campo`, `croma_listar_equipes` |
| **Financeiro** | `croma_listar_contas_receber`, `croma_listar_contas_pagar`, `croma_criar_conta_receber`, `croma_registrar_pagamento`, `croma_criar_conta_pagar`, `croma_registrar_pagamento_cp`, `croma_registrar_lancamento_caixa`, `croma_listar_lancamentos_caixa`, `croma_listar_contas_bancarias`, `croma_gerar_boleto`, `croma_consultar_das` |
| **Fiscal** | `croma_listar_nfe`, `croma_emitir_nfe`, `croma_consultar_status_nfe` |
| **Qualidade** | `croma_listar_ocorrencias`, `croma_criar_ocorrencia`, `croma_atualizar_ocorrencia` |
| **Estoque** | `croma_consultar_estoque`, `croma_listar_materiais`, `croma_registrar_movimento`, `croma_cadastrar_material`, `croma_atualizar_material`, `croma_sugerir_compra`, `croma_historico_precos_material` |
| **Impressora** | `croma_listar_jobs_impressora`, `croma_resumo_impressora`, `croma_vincular_job_impressora`, `croma_registrar_jobs_impressora`, `croma_custo_real_pedido`, `croma_mapear_substrato`, `croma_registrar_recarga`, `croma_nivel_cartuchos` |
| **Admin** | `croma_listar_produtos`, `croma_atualizar_preco_material`, `croma_listar_regras_precificacao`, `croma_criar_produto`, `croma_criar_modelo_produto`, `croma_atualizar_modelo_produto`, `croma_criar_regra_precificacao`, `croma_atualizar_regra_precificacao`, `croma_listar_maquinas`, `croma_listar_acabamentos_servicos` |
| **Fornecedores** | `croma_listar_fornecedores`, `croma_detalhe_fornecedor`, `croma_cadastrar_fornecedor`, `croma_atualizar_fornecedor`, `croma_historico_compras_fornecedor` |
| **Compras** | `croma_listar_compras`, `croma_detalhe_compra`, `croma_criar_compra`, `croma_atualizar_status_compra`, `croma_registrar_recebimento` |
| **BI** | `croma_dashboard_executivo`, `croma_alertas_ativos`, `croma_pipeline_comercial` |
| **Sistema** | `croma_executar_sql` (SELECT only), `croma_health_check` |