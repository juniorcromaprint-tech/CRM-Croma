# Prompt para CLI — Commit da Integração HP Latex 365 + Monitoramento Consumíveis

Cole este prompt no Claude Code CLI para fazer o commit de tudo que foi feito nas sessões Cowork de 02/04/2026.

---

## Prompt

Faça commit e push de todas as alterações da integração HP Latex 365 com o CRM. Os arquivos são:

### Arquivos novos (git add):
- `mcp-server/src/tools/impressora.ts` — 8 ferramentas MCP (listar_jobs, resumo, vincular, registrar, custo_real_pedido, mapear_substrato, registrar_recarga, nivel_cartuchos)
- `supabase/migrations/114_impressora_integracao_completa.sql` — substrato_map, views, trigger, RPC
- `supabase/migrations/115_impressora_custo_maquina_3componentes.sql` — custo_maquina_brl, views 3 componentes
- `supabase/migrations/116_impressora_consumiveis.sql` — impressora_consumiveis, impressora_recargas, vw_nivel_cartuchos
- `.planning/summaries/2026-04-02-hp-latex-integracao.md` — resumo da sessão

### Arquivos modificados:
- `croma_plotter_sync.py` — modelo 3 componentes, coleta consumíveis ConsumableConfigDyn.xml, nível estimado por cor, service_role JWT, wakeup handling
- `mcp-server/src/index.ts` — import impressora + contagem 93 ferramentas
- `CLAUDE.md` — v5.10 com seção HP Latex 365, monitoramento consumíveis, 93 ferramentas
- `.planning/STATE.md` — atualizado com sessão 02/04

### IMPORTANTE — Antes do commit:
1. `cd mcp-server && npm run build` — compilar as 2 ferramentas novas (registrar_recarga, nivel_cartuchos)
2. Incluir os arquivos `dist/` gerados no commit

### Mensagem de commit:
```
feat: HP Latex 365 — custeio 3 componentes + monitoramento consumíveis + nível estimado cartuchos

- Modelo "LM Âncora": tinta HP original (R$0,52/ml bag 3L) + substrato + máquina (R$2,40/m²)
- 8 ferramentas MCP impressora (+2 novas: registrar_recarga, nivel_cartuchos)
- Migrations 113-116: jobs, config, substrato_map, consumíveis, recargas, vw_nivel_cartuchos
- croma_plotter_sync.py: coleta EWS + ConsumableConfigDyn.xml, nível estimado por cor
- Sistema de recargas: registra enchimento (800ml), subtrai consumo por cor via LM Âncora
- campo nivel_confiavel: diferencia cartuchos com/sem medição real (refilledColor)
- MCP Server: 91→93 ferramentas
```

NÃO precisa de deploy Vercel — nada de frontend mudou. As migrations já estão aplicadas no Supabase.

Faça `git add` dos arquivos listados acima + dist/ compilado, commit com a mensagem, e push para main.
