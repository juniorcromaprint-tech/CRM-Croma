# HANDOFF — Monitoramento crons CRM-Croma — 2026-05-29 (fim de sessão Opus)

**Criado**: 2026-05-29 ~20:20 BRT
**Sessão anterior**: monitor (Opus) iniciada 28/05 ~22:51 BRT. Começou monitorando os ciclos autônomos; descobriu que o autônomo "girava em falso" (só ~31% de progresso real, 5 falso-positivos de corrupção seguidos, 2 problemas de negócio parados). Junior mandou deixar os crons precisos e corrigir as brechas. A sessão fez hardening do autônomo + destravou produção + corrigiu/travou prospecção + fechou exposições de segurança. Encerrou ~20:20 BRT.

---

## O QUE ESTA SESSÃO FEZ (tudo em prod, validado, commitado — ver ledger DONE entrada "SESSÃO JUNIOR + MONITOR 2026-05-29")

| Frente | Resultado | Commit |
|---|---|---|
| Hardening autônomo v5 | rules.md + SKILL.md reescritos (HOST=verdade, fechamento blindado, agents obrigatórios, validar SQL, mapear-antes-de-corrigir) | `a03be23` |
| Fase 1.2 Produção→Instalação | fn_op_finalizada_transicao 2 hops válidos + 2 pedidos destravados (1070, PED-2026-0025) | `4195dc7` |
| Prospecção | motor corrigido + **kill-switch followup_engine_ativo=false (TRAVADO)** | `16e1ee2` |
| SEC-001 | RLS leads/clientes/ai_alertas só authenticated (anon 3460→0) | `a2aeea0` |
| SEC-002 | revoke anon de funções SECURITY DEFINER (cofre/SQL-livre + 22 jobs/fiscal) | `0e8a493` |
| lead_quente | filtro recência 7d (parou flood ~100 alertas/dia) | `a2aeea0` |

**Comprovação**: ciclos #28-#45 rodaram com as regras v5 → 0 falso-positivo, 100% commit+Telegram. Ciclo #44 revalidou as 3 mudanças de segurança ("zero regressão"). App Campo verificado intacto.

---

## ESTADO ATUAL (2026-05-29 ~20:17 BRT)

- **Scheduled task** `croma-autonomous-progress`: ATIVO, v5.1, cron `0 * * * *` (~:03). Último ciclo **#45 (19:22 BRT)**, próximo ~**#46 (21:03 BRT)**.
- **Health prod**: Vercel 200, 0 5xx, branch=main sincronizado (HEAD `caa2950` = #45 + meus commits). agent-cron-loop **v28**, mcp-bridge-worker **v9**, ai-compor-mensagem **v25**.
- **Segurança**: SEC-001/002/004 aplicados. anon trancado (validado). Só portal_* (9) + 4 helpers auth/RLS executáveis por anon (legítimo).
- **Prospecção**: 🔴 **TRAVADA** (`followup_engine_ativo=false`). Última agent_message 28/05 16:02. Backlog 195 follow-ups (152 nunca contatados) preservado. **NÃO LIGAR sem o Junior presente.**
- **Fase 1.2**: chain corrigida; `production_completed_transition` ainda 0 lifetime (nenhum pedido novo finalizou produção pós-fix — a função valida no 1º evento real; se falhar, grava `production_transition_error`).

---

## PENDÊNCIAS (decisão do Junior — NÃO atacar autonomamente)

1. **Ligar a prospecção**: quando Junior quiser estar presente. Procedimento combinado: configurar aprovação manual (IA compõe → fila de aprovação, Junior revisa/edita/assume antes de enviar) + cap baixo + `followup_engine_ativo=true` + acompanhar 1º tick ao vivo. Decidir política do backlog (cap recentes vs todos).
2. **Buckets de mídia públicos** (job_photos 99MB/job_videos/job-attachments/whatsapp-media): trancar exige refactor pra signed-URL (~10 arquivos do app: JobPhotos/JobVideos/JobAttachments/JobSignature + whatsapp + regerar URLs já salvas). Projeto à parte, atenção especial ao App Campo.
3. **Rotacionar token Telegram** (telegram-webhook/index.ts:11 hardcoded): Junior gera novo no BotFather → mover pro vault.
4. **[watch]** production_completed 0 lifetime; install_completed parado há ~24d; backlog 195 follow-ups.

---

## SEU PAPEL NA PRÓXIMA SESSÃO: MONITOR (não executor)

Junior pergunta "como estão os crons?" → responder com **evidência empírica** (queries em agent_rules, ai_logs, cron.job_run_details, system_events + git log + health). Reportar estruturado (tabela + ✅⚠️🔴 + veredito adversarial honesto). Só executar/intervir se Junior pedir explicitamente. Português BR, termos técnicos em inglês.

⚠️ **bash sandbox tem cache stale (virtiofs)** — usar Windows-MCP PowerShell pra ver realidade do host (git status, mtimes, tail). O autônomo já segue isso (regras v5), você também deve.

---

## ARQUIVOS A LER AO INICIAR (em paralelo)
1. Este handoff
2. `CLAUDE.md`
3. `.planning/autonomous-mission.md`
4. `.planning/autonomous-rules.md` (**v5.0** — já endurecido)
5. `.planning/autonomous-ledger.md` (DONE topo tem a entrada da sessão monitor)
6. `.planning/autonomous-log.md` (últimas 500)
7. `.planning/STATE.md` (últimas 500)

---

## QUERIES PRONTAS (Supabase `djwjmfgplnqyffdcgdaw`)

Health + Fase 1.2 + segurança num golpe:
```sql
SELECT
  to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') AS agora_brt,
  (SELECT COUNT(*) FROM agent_rules WHERE ativo) AS rules_ativas,
  (SELECT COUNT(*) FROM agent_rules WHERE ativo AND last_error IS NOT NULL) AS rules_erro,
  (SELECT valor FROM agent_config WHERE chave='followup_engine_ativo') AS prospec_killswitch,
  (SELECT COUNT(*) FROM agent_messages WHERE created_at > now()-interval '6 hours') AS msgs_6h,
  (SELECT COUNT(*) FROM system_events WHERE event_type='production_completed_transition') AS fase12_transitions,
  (SELECT COUNT(*) FROM system_events WHERE event_type='production_transition_error') AS fase12_erros;
```

Segurança — confirmar anon ainda trancado:
```sql
SET ROLE anon; SELECT (SELECT count(*) FROM leads) AS leads_anon, (SELECT count(*) FROM clientes) AS clientes_anon; RESET ROLE;
-- esperado 0/0
```

Crons pg_cron (jobid 20 = agent-cron-loop-30min, janela UTC 11-23):
```sql
SELECT jobid, status, to_char(start_time AT TIME ZONE 'America/Sao_Paulo','MM-DD HH24:MI') AS start_brt
FROM cron.job_run_details WHERE jobid IN (20,21) ORDER BY start_time DESC LIMIT 10;
```

Host real (Windows-MCP PowerShell — NÃO confiar no bash pra isso):
```
cd C:\Users\Caldera\Claude\CRM-Croma; git log -8 --oneline; git status --short
```

Scheduled task: `mcp__scheduled-tasks__list_scheduled_tasks` (filtrar croma-autonomous-progress).

---

## PROMPT PRA COLAR NA PRÓXIMA SESSÃO

```
Nova sessão (Opus) pra continuar monitorando os crons autônomos do CRM-Croma.

Leia EM PARALELO no início:
1. C:\Users\Caldera\Claude\CRM-Croma\.planning\HANDOFF-MONITORAMENTO-CRONS-2026-05-29.md (teu contexto principal)
2. C:\Users\Caldera\Claude\CRM-Croma\CLAUDE.md
3. C:\Users\Caldera\Claude\CRM-Croma\.planning\autonomous-rules.md (v5.0 endurecido)
4. C:\Users\Caldera\Claude\CRM-Croma\.planning\autonomous-ledger.md (DONE imutável — topo tem a sessão monitor 29/05)
5. C:\Users\Caldera\Claude\CRM-Croma\.planning\autonomous-log.md (últimas 500 linhas)
6. C:\Users\Caldera\Claude\CRM-Croma\.planning\STATE.md (últimas 300 linhas)

Teu papel é MONITOR, não executor. Vou perguntar "como estão os crons?" e tu responde com evidência empírica (queries em agent_rules, ai_logs, cron.job_run_details, system_events + health Vercel + git log). bash sandbox tem cache stale — usa Windows-MCP PowerShell pra realidade do host. Reporta estruturado (tabela + ✅⚠️🔴 + veredito adversarial). Não dispara trabalho do autônomo (cron roda sozinho a cada 1h). Só intervém se eu pedir.

LEMBRETES CRÍTICOS:
- Prospecção está TRAVADA de propósito (followup_engine_ativo=false). NÃO ligar sem eu presente.
- Pendências minhas: trancar buckets de mídia (refactor signed-URL), rotacionar token Telegram.
- Regras v5 já estão ativas — confirma se os ciclos seguem precisos (0 falso-positivo, commit+Telegram, sem girar em falso).

Português BR, termos técnicos em inglês. Confirma que leu tudo e me dá um status snapshot inicial: ciclo mais recente, status, o que atacou, e o que tá no NEXT.
```
