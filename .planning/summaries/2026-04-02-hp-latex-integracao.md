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

### MCP Server (48→54 ferramentas)
6 novas ferramentas no módulo Impressora:
1. `croma_listar_jobs_impressora` — listar/filtrar jobs com custos
2. `croma_resumo_impressora` — KPIs de produção por período
3. `croma_vincular_job_impressora` — vincular job a pedido/cliente/OP
4. `croma_registrar_jobs_impressora` — bulk upsert do script de coleta
5. `croma_custo_real_pedido` — custo real de impressão por pedido
6. `croma_mapear_substrato` — vincular substrato EWS ao catálogo

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
| Tinta | ~R$1,58/m² (varia) | bag paralela 3L = R$1.560 → R$0,52/ml |
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

## Pendências para próximas sessões
- 21/22 substratos sem material_id no impressora_substrato_map
- Git commit dos arquivos novos (migrations, script, MCP tools)
- LM sempre zerado (cartuchos paralelos) — custo usa fallback 9,86 ml/m²
- Vincular jobs existentes aos pedidos do CRM (matching por nome do arquivo)
