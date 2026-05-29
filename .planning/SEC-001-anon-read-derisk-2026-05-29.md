# SEC-001 — De-risk anon-read (Ciclo autonomo #40, 2026-05-29 14:14 BRT)

> Objetivo: PROVAR, antes do Junior aplicar a remediacao RLS, se mudar as policies
> de `TO public` para `TO authenticated` quebra alguma pagina ANON (pre-login).
> Metodo: agent read-only adversarial mapeou o frontend (ERP `src/` + APP-Campo + APP-Landing).
> Resultado: aplicacao de SEC-001 Bloco1+Bloco2 e SEGURA. So `nps_respostas` precisa de cuidado.

## Rotas PRE-AUTH (fora do auth guard)
- `/login` — so `auth.signInWithPassword` (zero `.from`).
- `/p/:token` (Portal) — le a proposta via Edge `usePortalProposta` + `fetch portal-gerar-pdf` (service_role). ZERO `.from()` nas 6 tabelas sensiveis.
- `/nps/:token` (NPS) — `NpsPage.tsx:46,60` LE + UPDATE `nps_respostas` via anon key.
- ERP `src/App.tsx`: auth guard = `ProtectedRoute` (linha 39-82). `/tv` esta DENTRO do guard (App.tsx:93).
- APP-Campo (`APP-Campo/src/App.tsx:25-29`): guard proprio; tudo exceto `/login` protegido.
- APP-Landing: nenhum `.from()`.

## Veredito por tabela — anon pre-login le DIRETO via `.from()`?
| Tabela | Anon pre-login le direto? | Evidencia |
|---|---|---|
| leads | NAO | so rotas protegidas (useLeads/usePipeline/comercial/*); APP-Campo StoreDetail.tsx:28 em rota protegida |
| clientes | NAO | idem (hooks/services protegidos; StoreFormSheet.tsx:27 protegido) |
| produtos | NAO | so admin/comercial/* (protegido) |
| catalogo | NAO | `.from('catalogo')` NAO EXISTE em nenhum frontend (zero matches) |
| ai_alertas | NAO | so ai/hooks/useAlertasAI.ts + alertaApplier.ts (protegidos) |
| telegram_messages | NAO | `.from('telegram_messages')` NAO EXISTE em nenhum frontend (zero matches) |

## Conclusao para a remediacao
- **Bloco1** (`leads_all_read` + `clientes_all_read`: `TO public` -> `TO authenticated`): SEGURO. Nenhuma rota anon pre-login le essas tabelas via anon key; ERP exige login, Portal usa Edge service_role.
- **Bloco2** (DROP `service_role_manage_alertas` / endurecer `telegram_messages`): SEGURO. ai_alertas/telegram_messages so sao tocados por codigo logado ou Edge.
- **NAO TOCAR `nps_respostas`**: `NpsPage` (rota publica `/nps/:token`) LE + UPDATE via anon. A policy `nps_public_update_by_token USING(true)` e NECESSARIA pro fluxo NPS anon. Se for endurecer, **gatear por token** (validar o token no WHERE/WITH CHECK), NUNCA restringir a `authenticated` (quebraria a pagina de NPS do cliente).

## NEEDS-CONFIRM do #37
- telegram_messages -> RESOLVIDO (sem acesso frontend; dropar policy nao afeta ERP).
- catalogo no portal anon -> RESOLVIDO (portal nao le catalogo/produtos via `.from`; proposta vem da Edge).
- nps_respostas -> EM ABERTO com fix conhecido (gate por token, mantendo anon).

## Refs
- `planning/SEC-001-remediacao-anon-rls-VALIDADA.sql` (idempotente, NAO-aplicada, #37)
- `planning/SEC-AUDIT-2026-05-29-anon-exposure.md` (#37)
- Evidencia de exposicao runtime (SET ROLE anon): leads 3460 / clientes 336 / telegram_messages 42 / ai_alertas 357 (#37)

**Status**: BLOCKED-Junior (aplicar em janela monitorada). Agora 1-comando — de-risco concluido.
