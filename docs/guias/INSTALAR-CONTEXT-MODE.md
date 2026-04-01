# Guia de Instalação — Context Mode para Claude Code

> **Para**: Junior | **Data**: 2026-03-31 | **Tempo estimado**: 2 minutos

---

## O que é

Context Mode comprime a saída das ferramentas do Claude Code (que podem ter 50-300 KB) para poucos bytes, guardando tudo num banco SQLite local com busca inteligente. Resultado: sessões 6x mais longas e sem perda de contexto quando a conversa compacta.

---

## Instalação (2 comandos)

Abra o **Claude Code no terminal** (PowerShell ou CMD) e execute:

```
/plugin marketplace add mksglu/context-mode
```

Depois:

```
/plugin install context-mode@context-mode
```

Reinicie o Claude Code ou rode:

```
/reload-plugins
```

Pronto. Tudo automático — hooks, ferramentas, configuração.

---

## Verificar se funcionou

Rode no Claude Code:

```
/context-mode:ctx-doctor
```

Todos os checks devem aparecer com `[x]`. Se algum falhar, o doctor mostra o que corrigir.

---

## Alternativa: só MCP (sem plugin)

Se o marketplace não funcionar:

```
claude mcp add context-mode -- npx -y context-mode
```

Isso registra as ferramentas mas sem os hooks automáticos de routing (menos eficiente).

---

## O que é instalado

| Item | Descrição |
|------|-----------|
| 6 ferramentas sandbox | `ctx_batch_execute`, `ctx_execute`, `ctx_execute_file`, `ctx_index`, `ctx_search`, `ctx_fetch_and_index` |
| 4 hooks automáticos | PreToolUse, PostToolUse, PreCompact, SessionStart |
| Banco SQLite local | Sessão indexada com FTS5 + BM25 |

Nenhum dado sai da máquina. Zero telemetria, zero cloud.

---

## Como usar no dia a dia

Após instalar, o Claude Code automaticamente:
- Comprime saídas grandes antes de entrar no contexto
- Indexa cada ação para busca posterior
- Recupera estado se a conversa compactar

Comandos úteis:
- `ctx-stats` — ver quanto contexto está economizando
- `ctx-doctor` — diagnóstico do sistema
- `ctx-upgrade` — atualizar versão

---

## Importante

- Funciona **apenas no Claude Code CLI** (terminal), não no Cowork/Desktop
- Licença: Elastic License 2.0 (uso interno OK, não pode revender como SaaS)
- Repo: https://github.com/mksglu/context-mode
