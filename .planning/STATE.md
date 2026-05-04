# STATE — CRM Croma

**Última sessão**: 2026-05-04 (sessão 2026-05-04M — Cowork/Claudete, pipeline E2E ativado)

## Pipeline E2E OPERACIONAL ✅

Sessão M corrigiu cadeia de erros do disparo:
1. RPC `fn_disparar_abertura_em_massa` v4 (qualifica colunas + direcao='enviada')
2. `vault.service_role_key` regravada para `sb_secret_...` (formato novo)
3. `whatsapp-enviar` v22 com header IMAGE automático via `admin_config.WHATSAPP_MEDIA_<template>`
4. `agent-cron-loop` v16 com `verify_jwt:false`
5. Janelas 09:00-12:00 e 14:00-17:00 BRT
6. Cron jobid 15 ATIVO

4 leads enviados + 1 E2E. 190 leads de Segurança aguardam fila. Junior dispara pela UI, cron processa.


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
  `vezes_usado`, `taxa_resposta`, `variaveis`, `template_language`
- ✅ `src/domains/comercial/components/leads/CampanhaBanner.tsx` (novo) —
  banner azul topo com KPIs (total, disparados, dia da rampa, enviadas hoje)
- ✅ `src/domains/comercial/components/leads/SegmentoPills.tsx` (novo) —
  pills clicáveis multi-select com counts ao vivo
- ✅ `src/domains/comercial/components/leads/LeadCard.tsx` (novo) — card
  visual com avatar colorido por sub-segmento, badges, tooltip bloqueio
- ✅ `src/domains/comercial/components/leads/LeadsCardList.tsx` (novo) —
  lista paginada 50/pg, select-all visíveis, paginação shadcn
- ✅ `src/domains/comercial/components/leads/LeadsCesta.tsx` (novo) —
  coluna sticky desktop / Sheet bottom mobile, remove individual, mini-stats
- ✅ `src/domains/comercial/components/leads/LeadsFilters.tsx` (reescrito) —
  busca debounced + Sheet "Mais filtros" com status/temp/região/score/datas
- ✅ `src/domains/comercial/components/leads/DispararAberturaModal.tsx`
  (reescrito) — galeria de templates como cards, preview com lead real
  substituindo placeholders, modo padrão "agendado"
- ✅ `src/domains/comercial/pages/LeadsPage.tsx` (refatorado) — novo layout
  banner→pills→busca→grid (lista|cesta), URL persiste filtros + página

#### Bug fixes aplicados

- ✅ `e.preventDefault()` no AlertDialogAction "Criar mesmo assim" —
  regra `.claude/rules/alert-dialog-async.md`
- ✅ Debounce 300ms na busca livre (evita refetch a cada keystroke)
- ✅ Cesta carrega leads selecionados de qualquer página (não só visível)
- ✅ Paginação preserva filtros ativos na URL

#### Componentes deprecados (mantidos para histórico)

- `LeadsBulkActionBar.tsx` — substituído pelo `LeadsCesta`
- `LeadsTable.tsx` — substituído pelo par `LeadsCardList` + `LeadCard`

### Sessão anterior (2026-05-04K) — Backend FASES 1, 2, 4 parcial

- ✅ FASE 1 SQL: `vw_leads_disparo`, `fn_disparar_abertura_em_massa`, seed
  templates segurança v2
- ✅ FASE 2 Edge Functions: `buscar-leads-google v14` (timeout 120s),
  `whatsapp-enviar v21` (template parametrizado + janelas múltiplas)
- ✅ FASE 4 parcial: `admin_config.agent_config` com janelas duplas e rampa
- ⏳ Cron jobid 15 = `inactive` (correto — religar só após FASE 5 E2E)

## Estado da base

- `agent_conversations`: **0 ativas**
- `leads`: **605 ativos**, sendo **195 segurança** (lead de teste interno
  bloqueado), 271 calçados
- Templates ativos canal whatsapp etapa abertura: **2** (croma_poste_seg_*)
- `cron.job` 15: **active=false** — manter até FASE 5 passar
- `whatsapp-enviar`: v21 (template parametrizado)
- `buscar-leads-google`: v14 (timeout 120s)

## Aguardando ação do Junior

- [ ] `git pull` + `npm install` + `npm run build` para validar TypeScript local
- [ ] `npm run dev` e teste visual da nova `/leads`
- [ ] Selecionar leads de teste reais (não internos) e disparar — FASE 5 E2E
- [ ] Após E2E OK: `SELECT cron.alter_job(15, active := true);`
- [ ] Deletar v1 templates manualmente em business.facebook.com

## TODO próxima sessão

- [ ] Aplicar `e.preventDefault()` em `src/pages/Produtos.tsx:656`
  (mesmo bug do AlertDialog, fora do escopo desta sessão)
- [ ] Após E2E: religar cron + considerar aumentar pra 30/dia
- [ ] Considerar virtualização da lista quando passar de 1000 leads visíveis
- [ ] Ações em massa adicionais: atribuir vendedor, marcar contatado,
  exportar CSV (planejadas mas não nesta sessão)

## Documentos chave

- 📄 `.planning/PLANO-DISPAROS-PROSPECCAO.md` — plano técnico FASES 1-5
- 📝 Obsidian: bloco `2026-05-04L` em `99-Meta/memory.md` (a ser criado ao final)
- 🎨 Mockup aprovado: ver bloco visual da sessão Cowork 2026-05-04L

## Referência rápida

- Lead de teste interno bloqueado: `0339d969-29d4-4eea-accb-70a27dbee4ca`
- Supabase project: `djwjmfgplnqyffdcgdaw`
