# Estado do Banco — Migrations

> Arquivo de referência — carregado sob demanda para trabalho de infraestrutura

## Migrations Aplicadas

| Migration | Conteúdo resumido |
|---|---|
| `001_complete_schema.sql` | 51 tabelas base |
| `002_schema_corrections.sql` | RLS granular, triggers, índices |
| `003_campo_migration.sql` | Jobs, fotos, assinaturas, checklists |
| `003_fiscal_module.sql` | 11 tabelas fiscal + RPCs NF-e |
| `004_integracao_bridge.sql` | Bridge ERP↔Campo |
| `005_storage_security.sql` | RLS nos buckets |
| `006_orcamento_module.sql` | Acabamentos (17), serviços (16), templates orçamento |
| `007_orcamento_campos.sql` | Regras precificação (11 categorias), campos custeio |
| `008_update_materiais_precos.sql` | 464 materiais com preço Mubisys |
| `009_update_produtos_markups.sql` | 156 modelos com markup real |
| `020_portal_tracking_pagamento.sql` | Portal cliente, tracking, pagamento |
| `022_pedidos_cancelamento_fields.sql` | cancelado_em, motivo_cancelamento |
| `027_rls_blindagem.sql` | RLS 8 tabelas + 14 FK indexes |
| `028_retornos_bancarios.sql` | CNAB 400 (baixa automática boletos) |
| `029_campanha_destinatarios.sql` | Destinatários campanhas |
| `030_optimistic_lock.sql` | Campo version (lock otimista) |
| `113_impressora_jobs.sql` | impressora_jobs, config, proporções tinta |
| `114_impressora_integracao_completa.sql` | substrato_map, views custo real |
| `115_impressora_custo_maquina_3componentes.sql` | custo_maquina 3 componentes |
| `116_impressora_consumiveis.sql` | consumíveis, histórico, recargas, vw_nivel_cartuchos |

## Dados no Banco
- clientes: 307 | materiais: 467 (464 c/ preço) | produtos: 156
- produto_modelos: 156 | modelo_materiais: 321 | modelo_processos: 362
- acabamentos: 17 | serviços: 16 | regras_precificacao: 11