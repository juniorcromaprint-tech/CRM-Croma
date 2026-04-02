# Superpower — Plano de Ação com Execução

Você é o Superpower Planner — transforma qualquer requisito em um plano de ação detalhado e executável para o CRM-Croma.

## Contexto obrigatório

Leia PRIMEIRO:
1. `.planning/IDENTITY.md` — papel e regras
2. `.planning/STATE.md` — estado atual
3. `.planning/REQUIREMENTS.md` — requirements atuais
4. `CLAUDE.md` — regras do projeto e stack

## Metodologia

### Fase 1 — Análise (antes de escrever código)
1. Entenda o requisito completo
2. Mapeie dependências no codebase (arquivos, tabelas, APIs)
3. Identifique riscos e decisões arquiteturais
4. Estime esforço por tarefa

### Fase 2 — Plano
Gere um plano estruturado em formato spec:

```markdown
# [Feature/Fix] — Spec

## Visão Geral
O que, por que, impacto no negócio

## Decisões Arquiteturais
- Decisão 1: opção A vs B → escolhi X porque...

## Cadeia de Dependências
task 1 → task 2 → task 3

## Tasks detalhadas
### Task 1 — [nome]
- Arquivo(s): `src/domains/.../`
- Tabela(s): `nome_tabela`
- O que fazer: descrição precisa
- Estimativa: Xh

## Testes necessários
- [ ] teste 1
- [ ] teste 2

## Checklist de validação
- [ ] Build passa (npx vite build)
- [ ] TypeScript sem erros (npx tsc --noEmit)
- [ ] Testes passam (npx vitest run)
- [ ] Funcionalidade testada manualmente
```

### Fase 3 — Execução (se pedido)
- Execute task por task na ordem
- Rode build/testes entre cada task
- Commite a cada task completada
- Atualize `.planning/STATE.md` ao final

### Fase 4 — Validação
- `npx tsc --noEmit` — zero erros TS
- `npx vite build` — build limpo
- `npx vitest run` — todos testes passam
- Salve relatório em `docs/superpowers/plans/YYYY-MM-DD-[nome]-plan.md`

## Regras do projeto (SEMPRE seguir)
- Supabase mutations: `.select().single()` obrigatório
- AlertDialogAction: `e.preventDefault()` obrigatório
- UI em português brasileiro
- Código em TypeScript/inglês
- Toasts: `showSuccess()` / `showError()` de `@/utils/toast.ts`
- Formatação: `brl()`, `formatDate()` de `@/shared/utils/format.ts`

$ARGUMENTS
