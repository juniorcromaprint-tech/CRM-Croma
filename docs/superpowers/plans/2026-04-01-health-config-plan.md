# Health Config — Plano de Ação

## Visão Geral

O `/health` identificou 9 problemas na configuração do Claude Code para o projeto CRM-Croma. Nenhum desses problemas afeta o funcionamento do ERP em produção — são problemas na "estrutura de trabalho" do Claude (configuração, segurança, organização). Corrigir garante que o Claude trabalhe de forma mais consistente e segura entre sessões.

**Impacto no negócio:** Sem correção, o Claude pode ignorar regras importantes em sessões futuras, settings podem vazar para o GitHub, e o contexto entre sessões se perde.

---

## Decisões Arquiteturais

- **C1 (gitignore)**: Adicionar `.claude/settings.local.json` ao `.gitignore` — sem discussão, é risco de segurança.
- **C3 (hooks)**: Criar hooks mínimos: 1 hook pós-commit para atualizar STATE.md, 1 hook pré-Supabase para confirmar com Junior.
- **S1 (rules)**: Extrair as 3 "REGRAS NOVAS" do CLAUDE.md para arquivos `.claude/rules/` separados — mais fácil de manter.
- **S2 (memory)**: Popular MEMORY.md com contexto acumulado desta e de sessões anteriores.
- **S3 (worktrees)**: Limpar worktrees antigos — são 39 diretórios desnecessários.
- **I1 (allowedTools lixo)**: Remover entradas inúteis do settings.local.json.

---

## Cadeia de Dependências

```
Task 1 (gitignore) → independente
Task 2 (rules/)    → independente
Task 3 (memory)    → independente
Task 4 (hooks)     → independente
Task 5 (worktrees) → independente
Task 6 (allowedTools limpeza) → independente
```

Todas as tasks são independentes — podem ser executadas em qualquer ordem.

---

## Tasks Detalhadas

### Task 1 — [C1] Gitignore: proteger settings.local.json
- **Arquivo**: `.gitignore` (raiz do projeto)
- **O que fazer**: Adicionar `.claude/settings.local.json` ao `.gitignore`
- **Por que**: O arquivo contém padrões de permissão internos. Se for commitado acidentalmente, expõe a superfície de ataque do projeto no GitHub público.
- **Risco**: Baixíssimo — só adiciona 1 linha ao .gitignore
- **Estimativa**: 2 min

### Task 2 — [S1] Rules: extrair regras críticas para arquivos dedicados
- **Diretório**: `.claude/rules/`
- **O que fazer**: Criar 3 arquivos de regras com as "REGRAS NOVAS" que estão enterradas no CLAUDE.md
  - `supabase-mutations.md` — regra do `.select().single()`
  - `alert-dialog-async.md` — regra do `e.preventDefault()`
  - `agent-vendas-coleta-dados.md` — regra de coleta cadastral antes de orçar
- **Por que**: Regras em arquivos separados são lidas com mais frequência pelo Claude e não se perdem no CLAUDE.md de 415 linhas.
- **Estimativa**: 10 min

### Task 3 — [S2] Memory: popular MEMORY.md com contexto do projeto
- **Arquivo**: `~/.claude/projects/.../memory/MEMORY.md` e arquivos de memória
- **O que fazer**: Criar memórias sobre:
  - Perfil do Junior (dono, não-técnico, opera pelo celular)
  - Feedback aprendido (PIX hardcoded, e.preventDefault, etc.)
  - Contexto do projeto (CROMA 4.0 completo, ERP ativo)
- **Por que**: Sem memória, cada nova sessão começa do zero. Claude não "lembra" que Junior prefere respostas curtas, que PIX deve ser hardcoded, etc.
- **Estimativa**: 15 min

### Task 4 — [C3] Hooks: criar automações básicas
- **Arquivo**: `.claude/settings.local.json` (seção `hooks`)
- **O que fazer**: Adicionar 2 hooks mínimos:
  1. `PostToolUse` em `git commit` → lembrete para atualizar STATE.md
  2. `PreToolUse` em `mcp__claude_ai_Supabase__apply_migration` → confirmar com Junior antes de executar migration
- **Por que**: Hooks executam automaticamente — garantem que regras importantes sejam seguidas sem depender da memória do Claude.
- **Estimativa**: 10 min

### Task 5 — [S3] Limpeza de worktrees antigos
- **Diretório**: `.claude/worktrees/`
- **O que fazer**: Remover os 39 worktrees antigos que contêm CLAUDE.md desatualizados
- **Por que**: São diretórios "fantasma" de trabalhos já concluídos. Não interferem no sistema mas ocupam espaço e confundem.
- **Atenção**: Verificar antes se algum worktree ainda está ativo (`git worktree list`)
- **Estimativa**: 5 min

### Task 6 — [I1] Limpeza do allowedTools no settings.local.json
- **Arquivo**: `.claude/settings.local.json`
- **O que fazer**: Remover entradas inúteis:
  - `Bash(done)`, `Bash(for file:*)`, `Bash(do grep:*)`, `Bash(echo "Found in: $file")`
  - Os dois `Bash(echo '{...JSON complexo...}')` com strings de GAQL escapadas
- **Por que**: São artefatos de sessões antigas que poluem a lista sem adicionar segurança.
- **Estimativa**: 5 min

---

## O que NÃO fazer agora

- ❌ **C2 (MCP overhead)**: Os 7 servidores MCP estão todos em uso no projeto (Supabase, Telegram, Rube, context-mode são essenciais). Desabilitar não vale o risco.
- ❌ **S4 (HANDOFF.md)**: STATE.md já cobre essa função no projeto.
- ❌ **I2/I3 (skills globais, CLAUDE.md global)**: Baixa prioridade, sem impacto imediato.

---

## Checklist de Validação

- [ ] `.gitignore` contém `.claude/settings.local.json`
- [ ] `git check-ignore -v .claude/settings.local.json` retorna hit
- [ ] `.claude/rules/` tem 3 arquivos de regras
- [ ] MEMORY.md tem pelo menos 5 entradas
- [ ] `settings.local.json` tem seção `hooks`
- [ ] `git worktree list` mostra apenas worktrees ativos
- [ ] `settings.local.json` não tem entradas `Bash(done)` etc.

---

## Ordem de execução sugerida

1. Task 1 (gitignore) — mais urgente, risco de segurança
2. Task 6 (allowedTools limpeza) — aproveita que está no settings
3. Task 4 (hooks) — junto com settings.local.json
4. Task 2 (rules) — cria estrutura de regras
5. Task 3 (memory) — contexto entre sessões
6. Task 5 (worktrees) — limpeza final

---

*Plano criado: 2026-04-01 | Origem: /health audit*
