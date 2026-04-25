# Integração HP Latex 365

> Arquivo de referência — carregado sob demanda para trabalho com impressora

## Conexão
- **IP**: 192.168.0.136 (rede local)
- **UUID no banco**: f7f320c9-baa8-4658-a178-fa67f8de3b9e
- **Script coleta**: `croma_plotter_sync.py` (raiz do projeto)
- **Sync**: Scheduled task `hp-latex-sync` — a cada 1h, seg-sex 8-18h
- **Auth**: Supabase service_role JWT (hardcoded no script)

## Modelo de Custeio "LM Âncora"
custo = tinta + substrato + máquina
- **Tinta**: R$0,52/ml × ml estimado (bag 3L = R$1.560, injetada nos cartuchos 775ml)
- **Substrato**: variável por mapeamento
- **Máquina**: R$2,40/m² (depreciação + cabeçotes + manutenção)
- **Fator LM**: consumo_total_ml = lm_ml_real × 21,5316. Fallback: 9,86 ml/m²
- Impressora detecta como "refilledColor" (cartucho recarregado, não tinta paralela)

## Tabelas
`impressora_jobs`, `impressora_config` (12 params), `impressora_substrato_map` (22 substratos), `impressora_proporcoes_tinta`

## Views
`vw_custo_real_por_pedido`, `vw_custo_real_por_op` (3 componentes: tinta+substrato+máquina)

## Consumíveis
- Tabelas: `impressora_consumiveis` (estado atual), `impressora_consumiveis_historico` (gráficos)
- Trigger: ao vincular job a OP, `custo_mp_real` atualiza automaticamente
- 21/22 substratos pendentes de mapeamento (só SM790 mapeado)