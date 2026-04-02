# Sessão 2026-04-02 — Integração HP Latex 365 ↔ CRM Croma

## Objetivo
Integração profissional da impressora HP Latex 365 ao CRM, com coleta automática de jobs, custeio real por pedido e sync automático com Supabase.

## Entregues

### Banco de Dados (Migrations 113-115)
- **impressora_jobs**: tabela principal com custos, vínculo com pedido/cliente/OP
- **impressora_config**: 12 parâmetros de configuração (preços, fatores, substratos)
- **impressora_proporcoes_tinta**: 7 cores com proporções relativas ao LM
- **impressora_substrato_map**: 22 substratos do EWS (1 mapeado: SM790)
- **custo_maquina_brl**: nova coluna para 3º componente de custo
- **Views**: vw_custo_real_por_pedido, vw_custo_real_por_op (3 componentes)
- **Trigger**: auto-atualiza custo da OP ao vincular job
- **Function**: atualizar_custo_real_op(uuid)

### MCP Server (48→93 ferramentas, +8 módulo Impressora)
8 ferramentas no módulo Impressora:
1. `croma_listar_jobs_impressora` — listar/filtrar jobs com custos
2. `croma_resumo_impressora` — KPIs de produção por período
3. `croma_vincular_job_impressora` — vincular job a pedido/cliente/OP
4. `croma_registrar_jobs_impressora` — bulk upsert do script de coleta
5. `croma_custo_real_pedido` — custo real de impressão por pedido
6. `croma_mapear_substrato` — vincular substrato EWS ao catálogo
7. `croma_registrar_recarga` — registrar enchimento de cartucho (800ml padrão)
8. `croma_nivel_cartuchos` — nível estimado de tinta por cor (LM Âncora)

### Script de Coleta (croma_plotter_sync.py)
- Coleta via EWS HTTP (HTML parsing com BeautifulSoup)
- Modelo "LM Âncora" com 3 componentes de custo
- Auth via service_role JWT (sem dependência de login)
- Detecção inteligente de sleep/desligada (sai limpo, sem erro)
- Upsert com deduplicação por hash_job
- Saída: JSON + CSV local + Supabase remoto

### Automação (Scheduled Task)
- **hp-latex-sync**: a cada 1h, seg-sex 8-18h
- Não roda fora do horário comercial
- Se impressora em sleep → sai silenciosamente

## Modelo de Custeio — 3 Componentes

| Componente | Valor | Fonte |
|---|---|---|
| Tinta | ~R$1,58/m² (varia) | HP original bag 3L (outro modelo) = R$1.560 → R$0,52/ml |
| Substrato | varia por material | SM790 = R$11,64/m² (catálogo Mubisys) |
| Máquina | R$2,40/m² (fixo) | depreciação + cabeçotes + cartucho manutenção |

**Total médio SM790**: ~R$15,62/m² (substrato = 76%, máquina = 16%, tinta = 8%)

## Dados Sincronizados
10 jobs reais no banco:
- CLOVIS: 21,33 m², R$409
- EUGENIO: 5,98 m², R$114
- ML: 5,13 m², R$98
- ANDRE: 0,45 m², R$8
- WILSON: 0,46 m², R$8
- **Total: 33,36 m², R$639,35**

### Monitoramento de Consumíveis (Migration 116 — Sessão 3 Cowork)
- **impressora_consumiveis**: estado atual cartuchos/cabeçotes (serial, nível, estado, garantia)
- **impressora_consumiveis_historico**: snapshots para gráficos de consumo
- **impressora_recargas**: registro de enchimento de cartuchos (800ml padrão)
- **vw_nivel_cartuchos**: nível estimado por cor = injetado - consumido (modelo LM Âncora)
- **nivel_confiavel**: campo que diferencia cartuchos com/sem medição real
- **Sync script**: agora coleta ConsumableConfigDyn.xml e mostra nível estimado no terminal
- **Correção documental**: tinta é HP ORIGINAL de bag 3L (não paralela). Cartuchos aparecem como "refilledColor" porque foram reabastecidos, não porque a tinta é falsa.

## Pendências para próximas sessões
- Git commit de TODOS os arquivos (migrations, script, MCP tools, docs)
- Build do MCP Server (npm run build no mcp-server/) para compilar 2 ferramentas novas
- 21/22 substratos sem material_id no impressora_substrato_map
- Vincular jobs existentes aos pedidos do CRM (matching por nome do arquivo)
- Registrar primeira recarga de cada cartucho via croma_registrar_recarga
