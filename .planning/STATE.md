# STATE — CRM Croma

**Última sessão**: 2026-05-04 (sessão 2026-05-04L — Cowork/Claudete, redesign UX)
**Último commit**: a commitar nesta sessão
**Commit anterior**: `53c57fa` — feat(disparos): FASE 1-3 pipeline prospeccao WhatsApp

## Status atual

### O que foi feito nesta sessão (2026-05-04L) — REDESIGN UX

Junior reportou "interface fraca/ruim, usuário precisa poder selecionar quais
leads e qual abertura". Mockup visual aprovado antes de codar (cards de lead,
cesta lateral sticky, galeria de aberturas, banner de campanha, paginação).

#### Frontend — arquivos criados/atualizados

- ✅ `src/shared/hooks/useDebouncedValue.ts` (novo, 300ms default)
- ✅ `src/domains/comercial/hooks/useLeadsDisparo.ts` — adicionada paginação
  `{page,pageSize}` retornando `{data,totalCount}`, `useLeadsDisparoCountsBySub`,
  `useLeadsDisparoCountsBySegmento`, `useCampanhaStatus`
- ✅ `src/domains/comercial/hooks/useDispararAbertura.ts` — select traz
  `vezes_usado`, `taxa_resposta`, `variaveis`, `templat