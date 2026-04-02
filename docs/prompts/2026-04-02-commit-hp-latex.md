# Prompt para CLI — Commit da Integração HP Latex 365

Cole este prompt no Claude Code CLI para fazer o commit de tudo que foi feito na sessão Cowork de 02/04/2026.

---

## Prompt

Faça commit e push de todas as alterações da integração HP Latex 365 com o CRM. Os arquivos são:

### Arquivos novos (git add):
- `mcp-server/src/tools/impressora.ts` — 6 ferramentas MCP (listar_jobs, resumo, vincular, registrar, custo_real_pedido, mapear_substrato)
- `mcp-server/dist/tools/impressora.js` + `.d.ts` + `.map` — compilado
- `supabase/migrations/114_impressora_integracao_completa.sql` — substrato_map, views, trigger, RPC
- `supabase/migrations/115_impressora_custo_maquina_3componentes.sql` — custo_maquina_brl, views 3 componentes
- `.planning/summaries/2026-04-02-hp-latex-integracao.md` — resumo da sessão

### Arquivos modificados:
- `croma_plotter_sync.py` — modelo 3 componentes (tinta+substrato+máquina R$2,40/m²), SM790 R$11,64, service_role JWT, wakeup handling
- `mcp-server/src/index.ts` — import impressora + contagem 54 ferramentas
- `mcp-server/dist/index.js` — compilado
- `CLAUDE.md` — v5.7 com seção HP Latex 365, tabela ferramentas 54
- `.planning/STATE.md` — atualizado com sessão 02/04

### Mensagem de commit:
```
feat: integração HP Latex 365 — custeio real 3 componentes + 6 ferramentas MCP + sync automático

- Modelo "LM Âncora": tinta (R$0,52/ml) + substrato (variável) + máquina (R$2,40/m²)
- 6 ferramentas MCP impressora (listar_jobs, resumo, vincular, registrar, custo_real_pedido, mapear_substrato)
- Migrations 113-115: impressora_jobs, config, substrato_map, views com 3 componentes
- croma_plotter_sync.py: coleta EWS, service_role JWT, wakeup handling
- Scheduled task hp-latex-sync: cada 1h seg-sex 8-18h
- 10 jobs reais sincronizados no Supabase (33,36 m², R$639,35)
- MCP Server: 48→54 ferramentas
```

NÃO precisa de deploy Vercel — nada de frontend mudou. As migrations já estão aplicadas no Supabase.

Faça `git add` dos arquivos listados acima, commit com a mensagem, e push para main.
