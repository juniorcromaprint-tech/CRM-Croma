# Queries operacionais de engajamento de email

> Todas usam a view `vw_email_engajamento_leads` (migration 154).
> Pivota `email_events` por mensagem com timestamps de sent/delivered/opened/clicked/bounced.

## 1. Quem abriu emails nas últimas 24h

```sql
SELECT 
  empresa,
  contato_nome,
  contato_email,
  assunto,
  abriu_em,
  qtd_opens,
  CASE WHEN clicou_em IS NOT NULL THEN 'CLICOU TAMBEM' ELSE '' END AS clicou
FROM public.vw_email_engajamento_leads
WHERE abriu_em > now() - interval '24 hours'
ORDER BY abriu_em DESC;
```

## 2. Quem clicou nas últimas 24h (LEAD QUENTE)

```sql
SELECT 
  empresa,
  contato_nome,
  contato_email,
  assunto,
  clicou_em,
  qtd_clicks,
  EXTRACT(EPOCH FROM (clicou_em - entregue_em))/60 AS minutos_entre_entrega_e_clique
FROM public.vw_email_engajamento_leads
WHERE clicou_em > now() - interval '24 hours'
ORDER BY clicou_em DESC;
```

## 3. Quem recebeu mas NÃO abriu (oportunidade pra follow-up)

```sql
SELECT 
  empresa,
  contato_nome,
  contato_email,
  assunto,
  entregue_em,
  EXTRACT(EPOCH FROM (now() - entregue_em))/3600 AS horas_desde_entrega
FROM public.vw_email_engajamento_leads
WHERE entregue_em IS NOT NULL
  AND abriu_em IS NULL
  AND entregue_em > now() - interval '7 days'
  AND entregue_em < now() - interval '4 hours'   -- exclui muito recentes
ORDER BY entregue_em DESC;
```

## 4. Quem deu bounce (email morto — marcar como NAO INCLUIR)

```sql
SELECT 
  empresa,
  contato_nome,
  contato_email,
  assunto,
  bounced_em
FROM public.vw_email_engajamento_leads
WHERE bounced_em IS NOT NULL
ORDER BY bounced_em DESC;

-- Marcar todos como NAO INCLUIR de uma vez:
UPDATE public.leads
SET observacoes = COALESCE(observacoes, '') || E'\n[NAO INCLUIR] [BOUNCE-AUTOMATICO] email teve bounce no Resend.'
WHERE contato_email IN (
  SELECT DISTINCT contato_email FROM public.vw_email_engajamento_leads WHERE bounced_em IS NOT NULL
)
AND COALESCE(observacoes, '') NOT ILIKE '%NAO INCLUIR%'
AND COALESCE(observacoes, '') NOT ILIKE '%NÃO INCLUIR%';
```

## 5. Funil completo (bonus — métricas agregadas)

```sql
SELECT 
  COUNT(*) FILTER (WHERE enviado_em IS NOT NULL) AS enviados,
  COUNT(*) FILTER (WHERE entregue_em IS NOT NULL) AS entregues,
  COUNT(*) FILTER (WHERE abriu_em IS NOT NULL) AS abertos,
  COUNT(*) FILTER (WHERE clicou_em IS NOT NULL) AS clicaram,
  COUNT(*) FILTER (WHERE bounced_em IS NOT NULL) AS bounces,
  COUNT(*) FILTER (WHERE reclamado_em IS NOT NULL) AS reclamacoes,
  ROUND(100.0 * COUNT(*) FILTER (WHERE entregue_em IS NOT NULL) / NULLIF(COUNT(*) FILTER (WHERE enviado_em IS NOT NULL), 0), 1) AS taxa_entrega_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE abriu_em IS NOT NULL) / NULLIF(COUNT(*) FILTER (WHERE entregue_em IS NOT NULL), 0), 1) AS taxa_abertura_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE clicou_em IS NOT NULL) / NULLIF(COUNT(*) FILTER (WHERE abriu_em IS NOT NULL), 0), 1) AS taxa_clique_pct
FROM public.vw_email_engajamento_leads
WHERE data_envio > now() - interval '30 days';
```

## 6. Top 10 leads mais engajados

```sql
SELECT 
  empresa,
  contato_email,
  COUNT(*) AS emails_enviados,
  SUM(qtd_opens) AS total_opens,
  SUM(qtd_clicks) AS total_clicks,
  MAX(ultimo_evento_em) AS ultima_atividade
FROM public.vw_email_engajamento_leads
WHERE data_envio > now() - interval '30 days'
GROUP BY empresa, contato_email
HAVING SUM(qtd_opens) > 0 OR SUM(qtd_clicks) > 0
ORDER BY total_clicks DESC, total_opens DESC
LIMIT 10;
```
