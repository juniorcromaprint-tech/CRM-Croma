# Email Tracking — Resend Webhook

> Status: webhook deployed, aguardando configuração no painel Resend
> Última atualização: 2026-05-08

## Como funciona

```
Disparo /leads
  → fn_disparar_abertura_em_massa (cria agent_messages.status='aprovada')
  → pg_cron dispatch-approved-messages-30min
  → agent-enviar-email (Edge Function)
  → POST api.resend.com/emails  ← Resend ACEITA
  → status='enviada' + metadata.resend_id

Resend processa:
  → email.sent          (aceito)
  → email.delivered     (MX destinatário aceitou)
  → email.bounced       (rejeitado)
  → email.opened/clicked (engajamento)

Resend chama webhook ↓

POST /functions/v1/resend-webhook
  → valida assinatura HMAC svix
  → INSERT email_events (resend_id, event_type, payload)
  → trigger trg_apply_email_event reflete em agent_messages.delivery_status
```

## Estado atual de uma campanha

```sql
SELECT * FROM public.vw_email_campanha_delivery
WHERE campanha_nome = 'Campanha lojas de calçados';
```

Retorna: total_disparados, aceitos_resend, entregues, abertos, clicados, bouncaram, reclamacoes, falharam, sem_evento_ainda.

## Métricas calculadas (taxa de entrega, abertura, etc)

```sql
SELECT
  campanha_nome,
  total_disparados,
  entregues,
  bouncaram,
  abertos,
  clicados,
  ROUND(100.0 * entregues / NULLIF(total_disparados, 0), 1) AS taxa_entrega,
  ROUND(100.0 * bouncaram / NULLIF(total_disparados, 0), 1) AS taxa_bounce,
  ROUND(100.0 * abertos   / NULLIF(entregues, 0), 1)         AS taxa_abertura,
  ROUND(100.0 * clicados  / NULLIF(abertos, 0), 1)           AS taxa_clique
FROM public.vw_email_campanha_delivery
WHERE total_disparados > 0
ORDER BY total_disparados DESC;
```

## Ver detalhe de uma mensagem específica

```sql
SELECT
  am.id,
  am.assunto,
  am.status                 AS lifecycle_status,    -- enviada / erro / etc
  am.delivery_status,                                -- delivered / bounced / opened
  am.delivery_status_at,
  am.delivery_meta,
  am.metadata->>'resend_id' AS resend_id,
  l.contato_email,
  l.empresa
FROM agent_messages am
LEFT JOIN agent_conversations ac ON ac.id = am.conversation_id
LEFT JOIN leads l ON l.id = ac.lead_id
WHERE am.id = '<uuid>';
```

## Ver eventos brutos de uma mensagem

```sql
SELECT event_type, occurred_at, to_email, payload
FROM email_events
WHERE resend_id = (SELECT metadata->>'resend_id' FROM agent_messages WHERE id = '<uuid>')
ORDER BY occurred_at ASC;
```

## Reconciliação retroativa

⚠️ Requer `RESEND_API_KEY` com **Full Access** (a key send-only retorna 401 `restricted_api_key`).

Depois de criar a key full no painel Resend e atualizar o vault:

```sql
-- Fase 1: enfileira 100 mensagens não-reconciliadas desde a data
SELECT private.reconcile_resend_enqueue('2026-05-08'::date, 100);

-- Aguardar 5-10s

-- Fase 2: coleta e injeta em email_events (trigger atualiza delivery_status)
SELECT * FROM private.reconcile_resend_collect();

-- Resumo
SELECT out_result, COUNT(*) FROM private.reconcile_resend_collect() GROUP BY 1;
```

Idempotente — UNIQUE INDEX em `email_events(resend_id, event_type, occurred_at)` evita duplicar.

## Arquitetura de status

`agent_messages` tem **2 colunas de status independentes**:

| Coluna | Domínio | Quem atualiza |
|---|---|---|
| `status` | rascunho, pendente_aprovacao, aprovada, enviada, erro | Lifecycle de aprovação/envio (agent-enviar-email) |
| `delivery_status` | sent, delayed, delivered, opened, clicked, complained, failed, bounced | Webhook Resend (trigger trg_apply_email_event) |

Prioridade do `delivery_status` (mais forte sobrescreve mais fraco):
`bounced > failed > complained > clicked > opened > delivered > delayed > sent`

Ou seja, se chega `delivered` e depois `bounced`, fica `bounced`. Se chega `delivered` e depois `opened`, fica `opened`.

## Setup do webhook

URL do endpoint: `https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/resend-webhook`

Configurar no painel: https://resend.com/webhooks → Add Endpoint.

Marcar eventos: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked` (e `email.failed` se aparecer).

Copiar o Signing Secret (whsec_...) e configurar como secret da Edge Function:
- Painel: https://supabase.com/dashboard/project/djwjmfgplnqyffdcgdaw/functions/secrets
- Nome: `RESEND_WEBHOOK_SECRET`
- Valor: `whsec_xxxxx`

## Health check

```bash
curl -i -X POST https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/resend-webhook \
  -H "Content-Type: application/json" -d '{}'
```

Esperado: `401 {"error":"Missing svix headers"}` — confirma que a função está viva e validando.

---

## Status atual (atualizado 2026-05-08)

- ✅ Tracking 100% operacional (webhook ativo, secret configurado, validação ao vivo)
- ✅ Reconciliação dos 50 disparos da campanha "lojas de calçados" completa
- ⚠️ **Resultado: 14% taxa de bounce** (43 delivered, 7 bounced, 1 delayed). Acima do limite saudável (5%).
- ⏸ Disparo em massa **PAUSADO** até validação externa da base
- ✅ 7 leads bouncados auto-bloqueados (trigger 145)
- ✅ 101 lojas C&A removidas (não eram leads, eram filiais Beira Rio)

## Plano de limpeza da base (segmento Calçados)

Documento detalhado em `Obsidian → 10-Projetos/Croma-Print/dados/PLANO-VALIDACAO-EMAIL-CALCADOS.md`.

Estado pós-limpeza inicial: 543 leads únicos elegíveis no segmento.

| Classificação | Qtd | O que fazer |
|---|---|---|
| ok_para_validar | 357 | Subir pro Hunter primeiro |
| prefixo_generico | 145 | Validar separado |
| dominio_alto_risco (bol/terra/ig/globo) | 38 | Validar com cuidado |

## Critérios pra retomar disparo

1. Validação externa (Hunter/NeverBounce) rodada
2. Resultado importado em `staging.email_validation_2026_05`
3. Inválidos marcados com `[NAO INCLUIR]` em `observacoes`
4. 24-48h passadas desde último disparo (08/05)
5. Painel Resend: domínio ainda Verified, sem alertas
6. Próximo disparo: máximo 30 emails, todos `valid` no validador

## Lista pré-selecionada para a próxima campanha (30 leads)

```sql
SELECT * FROM public.vw_proxima_campanha_calcados_30;
```

**A view existe mas a campanha NÃO foi disparada.** Aguardando aprovação do Junior + validação externa.
