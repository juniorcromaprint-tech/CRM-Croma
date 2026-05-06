# STATE — CRM Croma

**Última sessão**: 2026-05-06 (Cowork — Pipeline de disparos destravado + UX de exclusão de leads)

## Sessão 2026-05-06 — PIPELINE DESTRAVADO + EXCLUIR LEADS

### Causa raiz identificada e corrigida (CRÍTICA)
Supabase migrou `service_role_key` para o novo formato `sb_secret_xxx`, mas o gateway das
Edge Functions (`verify_jwt: true`) ainda exige JWT legacy `eyJ...`. Resultado: TODAS as
invocações `agent-cron-loop → whatsapp-enviar` retornavam `401 INVALID_JWT_FORMAT` e as
mensagens ficavam presas em `status='aprovada'` indefinidamente (63 mensagens travadas).

### Solução em camadas (commit `05d19b5` + `e6f9524`)

**FASE 2 — Auth segura**
- JWT legacy guardado em `vault.secrets.service_role_key_legacy_jwt` (nao em texto puro)
- `private.get_service_role_key()` prefere vault legacy, fallback para sb_secret
- `public.get_service_role_key_for_dispatch()` RPC restrita a service_role via GRANT
- Edge `whatsapp-enviar` v25: aceita JWT legacy (decodifica role do payload, gateway ja
  validou assinatura) + sb_secret env match + user JWT
- Edge `agent-enviar-email` v20: mesma logica de auth
- Edge nova `dispatch-approved-messages` v1: dispatcher dedicado com fetch direto +
  Authorization JWT legacy + apikey sb_secret

**FASE 3 — Retry e tratamento de erro**
- `agent_messages.tentativas_envio` + `max_tentativas_envio` + `proximo_envio` (cols novas)
- Backoff exponencial: 5min → 15min → 45min entre tentativas
- Apos `max_tentativas` (3): status → `'falha_envio'` (nao tenta mais)
- Index `idx_agent_messages_dispatch_ready` para query rapida

**FASE 4 — Validado com mensagem real**
- 1 mensagem teste enviada via JWT legacy → wamid retornado, status=enviada
- 12 mensagens reais disparadas em sequencia (15:00–15:01 BRT)
- 5 erros do Meta foram numeros invalidos (Apify Google Maps)

**FASE 5 — Rampa progressiva**
- `public.fn_calcular_limite_diario()` calcula 15→30→60/dia
- `useCampanhaStatus` le do RPC backend (fonte unica da verdade)

**FASE 6 — Janelas BRT consistentes**
- `CampanhaBanner.tsx` le `agent_config.horarios` em vez de hardcoded "10–12 / 14–17"

**FASE 7 — Tabela `agent_campanhas`**
- Schema completo com contadores, status, datas
- `agent_messages.campanha_id` (FK opcional)
- Trigger `fn_atualizar_contadores_campanha` mantem totais sincronizados
- RLS por role (admin/diretor/comercial/comercial_senior)

**Bonus — Header IMAGE em templates**
- Bug separado: template `croma_poste_seg_abertura_v2` foi criado no Meta com header IMAGE.
- `whatsapp-enviar` v25 agora le `admin_config.WHATSAPP_MEDIA_<template_name>` e injeta
  `component type=header parameter type=image` no payload Meta.

**pg_cron**
- Job `dispatch-approved-messages-30min`: `*/30 12-14,17-19 * * 1-6` (BRT 09–12 e 14–17)
- Removido `agent-cron-loop` antigo do dispatch (mantido para regras/follow-ups)

### Excluir leads na tela `/leads` (commits `77f1e89` + `e6f9524`)
- Botao lixeira individual SEMPRE visivel na linha do lead (cinza, fica vermelho ao hover)
- Click → AlertDialog vermelho "⚠ Excluir lead permanentemente?" com bloco vermelho
  destacando "Esta acao e PERMANENTE e IRREVERSIVEL"
- Botao em lote no rodape da `LeadsCesta` (desktop sticky + mobile sheet) com mesma confirmacao
- Hook novo `useExcluirLead` + `useExcluirLeadsEmLote` em `src/domains/comercial/hooks/`
- Soft delete: `UPDATE leads SET excluido_em=now(), excluido_por=user_id` — `vw_leads_disparo`
  ja filtra `excluido_em IS NULL`, leads excluidos somem da listagem automaticamente
- RLS `leads_update`: admin/diretor/comercial/comercial_senior

### Telefone errado em mensagens (commit `037f0b7`)
- 3 lugares com `(11) 4200-3724` hardcoded: `DispararAberturaModal.tsx::renderPreview` +
  2 overloads da RPC `fn_disparar_abertura_em_massa`. Corrigido para `(11) 3399-4517`.

### Deploy Vercel
- Auto-deploy GitHub→Vercel estava parado (motivo nao identificado, possivelmente webhook)
- Deploy disparado manualmente via `vercel --prod --force` → build completo (789 deps,
  vite build, 22.14s) → `dpl_HgGBv8ECtG4skqvaV4uTzm5TXVGY` (`crm-croma-a9srq81mg`) Ready
- Aliased para `crm-croma.vercel.app`
- Service Worker do PWA segurava bundle antigo no browser → precisa aba anonima ou
  desregistrar SW para ver mudancas (anotado nos aprendizados)

### Migrations aplicadas hoje
- `138_fix_telefone_disparo_abertura.sql` (drop+recreate ambos overloads da RPC)
- `139_fix_agent_dispatch_pipeline.sql` (consolidada — JWT legacy + retry + rampa + campanhas)
- + migrations diretas: `fix_service_role_key_legacy_jwt`, `store_jwt_legacy_in_vault_secure`,
  `agent_messages_retry_columns`, `rpc_rampa_progressiva_e_jwt_dispatch`,
  `agent_campanhas_table`, `cron_dispatch_approved_messages`, `fix_rpc_jwt_dispatch_grant_only`

### Commits desta sessao
```
e6f9524 feat(leads): icone excluir sempre visivel + aviso PERMANENTE/IRREVERSIVEL
77f1e89 feat(leads): permite excluir lead direto da tela /leads (individual + lote)
05d19b5 fix(agent): destrava pipeline de disparos WhatsApp + rampa progressiva
037f0b7 fix: corrige telefone (11) 3399-4517 em disparo de abertura
```

---

## Sessoes anteriores

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

### O que foi feito nesta sessão (2026-05-05) — EMAIL COM IMAGEM INLINE

1. ✅ `agent-enviar-email` v18 deployed — imagem de portfólio renderiza DEPOIS do texto
2. ✅ `DispararAberturaModal` — upload de imagem + toggle "incluir imagem" direto no modal
3. ✅ `AgentConfigPage` EditTemplateForm — upload de imagem no formulário de template
4. ✅ `useDispararAbertura` — passa `p_incluir_imagem` para o RPC
5. ✅ `fn_disparar_abertura_em_massa` v5 — persiste `imagem_url` no metadata da mensagem
6. ✅ Teste E2E: email enviado via Resend para junior@cromaprint.com.br com layout correto
7. ✅ Layout final: texto da abertura → imagem de portfólio (CID inline) → rodapé
8. ✅ v19: imagem embutida como CID attachment (exibe sem "permitir imagens remotas")

**Nota técnica**: Para invocar `agent-enviar-email` fora do horário do cron, usar
`pg_net` direto chamando Resend API (o gateway Supabase requer service_role JWT
que não está acessível via vault — o cron-loop usa internamente).

### O que foi feito na sessão anterior (2026-05-04L) — REDESIGN UX

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
- `agent-enviar-email`: v19 (imagem CID inline após texto, Resend API)
- `buscar-leads-google`: v14 (timeout 120s)

## Aguardando ação do Junior

- [ ] Escolher ferramenta de email marketing (Brevo, Mailchimp, RD Station, ou nativo Croma)
- [ ] Configurar WhatsApp Business API para disparo em massa
- [ ] Criar templates de mensagem por segmento (além de Segurança)
- [ ] Executar campanhas piloto de email e WhatsApp

## TODO próxima sessão

- [ ] **PRIORIDADE ALTA**: Mídia no WhatsApp (ver/ouvir mensagens de clientes + enviar imagem)
  - Expandir `agent_messages` com `media_url`, `media_type` (image/audio/video/document)
  - Webhook de recebimento deve salvar mídia do cliente (baixar do WhatsApp API → Storage)
  - UI: renderizar `<img>` para fotos, `<audio>` player para áudios na timeline
  - UI: botão de upload de imagem no chat manual (quando assume conversa)
  - Motivo: clientes mandam foto de referência/áudio perguntando sobre serviços — sem ver isso no CRM, Junior fica cego e precisa abrir outro WhatsApp
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
