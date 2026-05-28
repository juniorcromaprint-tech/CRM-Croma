# Próximo commit — feat: Resend email tracking webhook

## Comando

```bash
cd C:\Users\Caldera\Claude\CRM-Croma

# 1. Conferir o que mudou
git status
git diff --stat

# 2. Garantir que NENHUM secret vaze (deve retornar 0 linhas)
git diff | grep -iE "whsec_|re_[A-Za-z0-9]{20}|RESEND_API_KEY=|RESEND_WEBHOOK_SECRET=" | grep -v "Deno.env.get"

# 3. Adicionar arquivos
git add supabase/migrations/142_email_events_tracking.sql
git add supabase/migrations/143_reconcile_resend_email_events.sql
git add supabase/migrations/144_reconcile_resend_two_phase.sql
git add supabase/migrations/145_auto_block_bounced_leads.sql
git add supabase/functions/resend-webhook/
git add supabase/functions/enviar-email-campanha/index.ts
git add supabase/functions/ai-enviar-nps/index.ts
git add scripts/reconcile-resend-email-events.mjs
git add docs/operacao/email-tracking-resend.md
git add .planning/PROXIMO-COMMIT.md
git add .planning/STATE.md

# 4. Commit
git commit -m "feat(email): add Resend webhook tracking + reconciliation RPCs

- migration 142: email_events table + delivery_status columns + trigger + view
- migration 143/144: RPCs de reconciliação retroativa (2 fases via pg_net)
- new function resend-webhook: HMAC svix validation, Web Crypto nativo
- enviar-email-campanha: reply_to via admin_config.agent_config (era ausente)
- ai-enviar-nps: reply_to via admin_config (era ausente)
- script Node fallback de reconciliação
- docs/operacao/email-tracking-resend.md

Auditoria em Obsidian: 10-Projetos/Croma-Print/auditorias/2026-05-08-email-disparo-leads.md"

# 5. Push (se quiser)
git push origin main
```

## Arquivos esperados no diff

| Arquivo | Tipo |
|---|---|
| supabase/migrations/142_email_events_tracking.sql | NEW |
| supabase/migrations/143_reconcile_resend_email_events.sql | NEW |
| supabase/migrations/144_reconcile_resend_two_phase.sql | NEW |
| supabase/functions/resend-webhook/index.ts | NEW |
| supabase/functions/resend-webhook/config.toml | NEW |
| supabase/functions/enviar-email-campanha/index.ts | MODIFIED (reply_to + email_remetente do agent_config) |
| supabase/functions/ai-enviar-nps/index.ts | MODIFIED (reply_to do agent_config) |
| scripts/reconcile-resend-email-events.mjs | NEW |
| docs/operacao/email-tracking-resend.md | NEW |

## Garantias de segurança

- ✅ Nenhum secret hardcoded — só referências `Deno.env.get('RESEND_WEBHOOK_SECRET')`, `Deno.env.get('RESEND_API_KEY')`
- ✅ Migration usa `vault.decrypted_secrets` para ler API key (não expõe valor)
- ✅ Webhook valida HMAC svix antes de aceitar qualquer payload
- ✅ RLS de `email_events`: insert só service_role, update/delete negados
- ✅ RPCs `private.*` com `SECURITY DEFINER` + GRANT só pra service_role

## Pós-commit (lembrete)

1. Confirmar que Vercel rebuilt (não muda nada de frontend, mas garante)
2. Confirmar via `supabase functions list --project-ref djwjmfgplnqyffdcgdaw` que `resend-webhook` está ACTIVE
3. Configurar endpoint no painel Resend
4. Setar `RESEND_WEBHOOK_SECRET`
5. Test event no painel Resend → conferir `email_events`
6. (Se criar key Full Access) Rodar reconciliação dos 50 disparos
