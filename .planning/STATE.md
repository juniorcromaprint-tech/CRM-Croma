# STATE — CRM Croma

**Última sessão**: 2026-05-04 (sessão 2026-05-04N — Cowork, canal EMAIL adicionado)

## Pipeline E2E OPERACIONAL ✅ (WhatsApp + Email)

Sessão N adicionou canal EMAIL ao pipeline de prospecção:
1. RPC `fn_disparar_abertura_em_massa` v5 — valida email (regex), renderiza assunto com variáveis
2. `agent-enviar-email` já funcional (Resend API, domínio cromaprint.com.br verificado)
3. `agent-cron-loop` v17 — nova `processApprovedMessages()` despacha msg aprovadas pelo RPC
4. Frontend: `DispararAberturaModal` v3 com toggle WhatsApp/Email, contagem de elegíveis
5. 7 templates email ativos (4 abertura + 2 followup1 + 1 followup2)
6. Remetente: `junior@cromaprint.com.br` (configurável via `admin_config.agent_config`)

### Bug crítico corrigido (sessão N)
O RPC criava mensagens `status='aprovada'` mas nada as despachava (proximo_followup=NULL).
Adicionada `processApprovedMessages` ao cron que pega mensagens aprovadas e roteia para
`whatsapp-enviar` ou `agent-enviar-email` respeitando janelas e limites diários.

### Pipeline anterior (sessão M):
- `whatsapp-enviar` v22 com header IMAGE automático
- Janelas 09:00-12:00 e 14:00-17:00 BRT
- Cron jobid 15 ATIVO
- 4 leads WhatsApp enviados + 1 E2E


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

- [ ] Deploy edge function: `npx supabase functions deploy agent-cron-loop --no-verify-jwt --project-ref djwjmfgplnqyffdcgdaw`
- [ ] `npm run dev` → testar toggle WhatsApp/Email no modal de disparo
- [ ] Selecionar 2-3 leads com email válido → disparar canal Email → verificar inbox
- [ ] Confirmar que cron (próxima execução) despacha as mensagens aprovadas
- [ ] Verificar RESEND_API_KEY está configurado como secret na Edge Function

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
