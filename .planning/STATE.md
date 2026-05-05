# STATE — CRM Croma

**Última sessão**: 2026-05-05 (Cowork — Limpeza completa de 2810 leads)

## Base de Leads LIMPA E PRONTA PARA DISPARO ✅

Sessão 2026-05-05 executou limpeza completa dos 2810 leads ativos:
- 640 sites trocados movidos para observacoes
- 585 emails com dominio errado limpos (457 email + 128 email2)
- 87 notas de status removidas do campo email2
- 53 duplicatas email1=email2 limpas
- 324 micro-segmentos consolidados em 17 categorias
- Rescoring completo: 887 quente, 1279 morno, 644 frio
- **1476 emails validos** | **1528 WhatsApp-ready** | **2305 (82%) com canal**
- Padrão: dados removidos preservados em `observacoes` com tags `[tag]`

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

## Estado da base (atualizado 2026-05-05)

- `leads`: **2810 ativos** — 17 segmentos limpos
  - 1476 com email válido | 1528 com WhatsApp | 2305 com pelo menos 1 canal
  - Score médio 38.8 | 887 quente, 1279 morno, 644 frio
  - Top segmentos: Outros (937), Calçados e Moda (926), Varejo (358), Segurança (228)
- Templates ativos: **2 WhatsApp** (croma_poste_seg_*) + **7 email** (4 abertura + 2 followup1 + 1 followup2)
- `cron.job` 15: **active** (agent-cron-loop v17)
- `whatsapp-enviar`: v22 (header IMAGE automático)
- `agent-enviar-email`: funcional (Resend API)
- `buscar-leads-google`: v14 (timeout 120s)

## Aguardando ação do Junior

- [ ] Escolher ferramenta de email marketing (Brevo, Mailchimp, RD Station, ou nativo Croma)
- [ ] Configurar WhatsApp Business API para disparo em massa
- [ ] Criar templates de mensagem por segmento (além de Segurança)
- [ ] Executar campanhas piloto de email e WhatsApp

## TODO próxima sessão

- [ ] Aplicar `e.preventDefault()` em `src/pages/Produtos.tsx:656`
  (mesmo bug do AlertDialog, fora do escopo desta sessão)
- [ ] Criar templates de abertura para os outros 16 segmentos
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
