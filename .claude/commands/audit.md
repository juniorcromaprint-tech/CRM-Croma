# Audit — Auditoria Técnica Rápida

Auditoria técnica focada em código e build do CRM-Croma.

## Contexto obrigatório

Leia `.planning/STATE.md` e `CLAUDE.md` para contexto.

## Checklist de execução

### 1. Build & Types
```bash
npx tsc --noEmit 2>&1
npx vite build 2>&1
```
Liste TODOS os erros encontrados.

### 2. Testes
```bash
npx vitest run 2>&1
```
Liste testes falhando com motivo.

### 3. Padrões do projeto (grep automatizado)
Procure violações das regras em `src/domains/`:

- `.insert(` ou `.update(` sem `.select().single()` na mesma chain
- `AlertDialogAction` sem `e.preventDefault` no onClick
- `console.log(` que não deveria estar em produção
- Imports não utilizados
- `any` como tipo TypeScript (deveria ter tipo correto)
- Chamadas Supabase sem `.catch` ou sem checar `error`

### 4. Relatório
Gere relatório com formato:

```
## Resultado da Auditoria — YYYY-MM-DD

### Build: PASS/FAIL
### TypeScript: X erros
### Testes: X/Y passando
### Violações de padrão: X encontradas

| # | Tipo | Arquivo | Linha | Descrição | Severidade |
|---|------|---------|-------|-----------|-----------|
```

Salve em `docs/qa-reports/YYYY-MM-DD-audit-tecnica.md`

$ARGUMENTS
