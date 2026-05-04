#!/usr/bin/env bash
# Script de commit dos arquivos do redesign UX da /leads (sessão 2026-05-04L).
# Foi gerado porque o git index.lock estava preso por outro processo durante
# a sessão Cowork — Junior rode esse script local para finalizar o commit.
#
# Uso:
#   cd C:\Users\Caldera\Claude\CRM-Croma
#   bash .planning/commit-redesign-ux.sh
#
# Pré-requisito: nenhum processo segurando o git index (feche IDE com git plugin
# se necessário).

set -e

cd "$(git rev-parse --show-toplevel)"

git add \
  .planning/STATE.md \
  src/shared/hooks/useDebouncedValue.ts \
  src/domains/comercial/hooks/useLeadsDisparo.ts \
  src/domains/comercial/hooks/useDispararAbertura.ts \
  src/domains/comercial/components/leads/CampanhaBanner.tsx \
  src/domains/comercial/components/leads/SegmentoPills.tsx \
  src/domains/comercial/components/leads/LeadCard.tsx \
  src/domains/comercial/components/leads/LeadsCardList.tsx \
  src/domains/comercial/components/leads/LeadsCesta.tsx \
  src/domains/comercial/components/leads/LeadsFilters.tsx \
  src/domains/comercial/components/leads/DispararAberturaModal.tsx \
  src/domains/comercial/pages/LeadsPage.tsx

git commit -m "feat(ux/leads): redesign com cesta lateral + galeria de aberturas

- CampanhaBanner: status agregado da campanha em andamento (KPIs, rampa)
- SegmentoPills: pills clicaveis de segmento e sub-segmento com counts
- LeadCard + LeadsCardList: substitui tabela densa por cards visuais
- LeadsCesta: coluna sticky desktop / Sheet mobile, remocao individual
- LeadsFilters: busca debounced (300ms) + Sheet 'Mais filtros'
- DispararAberturaModal: galeria de templates como cards + preview com
  lead real (substitui placeholders)
- LeadsPage: layout novo banner -> pills -> busca -> grid (lista | cesta)
- useLeadsDisparo: paginacao 50/pg + countsBySub + countsBySegmento +
  useCampanhaStatus
- useDebouncedValue: hook utilitario novo em shared/hooks
- Fix: e.preventDefault() no AlertDialog 'Criar mesmo assim'
  (regra .claude/rules/alert-dialog-async.md)

Refs: PLANO-DISPAROS-PROSPECCAO.md, sessao 2026-05-04L"

echo ""
echo "✓ Commit criado. Para enviar ao GitHub:"
echo "  git push origin main"
