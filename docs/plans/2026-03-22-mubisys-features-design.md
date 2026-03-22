# Sprint Mubisys Features — Design Doc

> **Data**: 2026-03-22 | **Migration**: 094_mubisys_features.sql

## Features Implementadas

### ALTA Prioridade
1. **Depreciacao Equipamentos** — campos data_compra, valor_compra, vida_util, saldo_residual, area_util em maquinas + campo GENERATED depreciacao_mensal + RPC get_depreciacao_maquina
2. **Uniao de Itens** — grupo_uniao, nome_exibicao, item_visivel em proposta_itens + agrupamento no portal/PDF
3. **CNH Validade** — cnh_numero, cnh_validade, cnh_categoria em profiles + alertas na designacao instalador

### MEDIA Prioridade
4. **Alerta Emenda Impressao** — usa area_util_m da maquina vs dimensoes do item
5. **Quadro de Avisos** — tabela quadro_avisos + RPC get_avisos_vigentes + banner no Layout
6. **Usinagem CNC** — tabela usinagem_tempos + integracao pricing-engine
7. **Comissionados Externo/Absorver** — tipo_comissionado + absorver_comissao em comissoes e propostas
