#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "=== ADDING FILES ==="
git add \
  src/domains/comercial/hooks/useLeads.ts \
  src/domains/comercial/pages/OrcamentoViewPage.tsx \
  src/domains/comercial/pages/PropostasPage.tsx \
  src/domains/comercial/pages/LeadsPage.tsx \
  src/domains/comercial/pages/LeadDetailPage.tsx \
  docs/qa-reports/2026-03-26-E2E-TESTE-RELATORIO.md

echo "=== COMMITTING ==="
git commit -m "fix: corrigir 5 bugs E2E — transicao lead, aprovacao proposta, cliente combobox

- useLeads.ts: adicionar convertido como transicao valida de novo/contatado/qualificado
- OrcamentoViewPage.tsx: trocar orc.valor_total por orc.total (campo correto)
- OrcamentoViewPage.tsx: e.preventDefault no AlertDialogAction + onSettled + loading
- PropostasPage.tsx: trocar Input texto por ClienteCombobox (vinculo real com clientes)
- LeadsPage.tsx: .select().single() no insert para detectar bloqueio RLS
- LeadDetailPage.tsx: e.preventDefault no converter + .select().single() no delete

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" || echo "COMMIT_SKIP (already committed or nothing to commit)"

echo "=== PULLING ==="
git pull --rebase origin main

echo "=== PUSHING ==="
git push origin main

echo "=== DONE ==="
git log --oneline -3
