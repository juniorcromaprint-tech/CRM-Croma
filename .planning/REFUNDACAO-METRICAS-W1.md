# REFUNDACAO — Métricas Semana 1 (25/05 a 31/05/2026)

> Criado: 2026-05-28 (quinta) | Fonte de verdade: `public.vw_refundacao_metrics_semana_1`
> Cliente Beira Rio: `af166ada-e01b-4197-b8c3-33410af325d1`
> Migration: `20260528_refundacao_metrics_view_20260528.sql`

---

## Estado atual (consulta de 2026-05-28 03:21 UTC)

| Métrica                                      | Valor      | Meta REFUNDACAO |
|----------------------------------------------|------------|-----------------|
| Orçamentos Beira Rio gerados via IA          | **3**      | ≥3              |
| Orçamentos enviados (status=enviada)         | 2          | -               |
| Aprovados internamente (Viviane)             | **0**      | -               |
| Aprovados pelo cliente (portal)              | 0          | -               |
| Viraram pedido em ≤7 dias                    | **0**      | -               |
| Tempo médio briefing→envio (segundos)        | -2,82*     | -               |
| Custo USD semana (funções refundação)        | **0,00**   | -               |
| Tokens in / out semana                       | 0 / 0      | -               |
| % aprovados sem edição                       | NULL       | -               |

\* Valor negativo é artefato do modo SHADOW — `processed_at < created_at` por ~0,1s em ai_requests; ver "Limitações".

---

## Definição das métricas + fontes

| # | Métrica | SQL (resumo) | Fonte real |
|---|---------|--------------|------------|
| 1 | Orçamentos gerados via IA | `propostas WHERE cliente_id = BEIRA_RIO AND gerado_por_ia AND created_at >= 25/05` | `propostas.gerado_por_ia` (boolean) |
| 2 | Enviados | mesma janela + `status='enviada'` | `propostas.status` |
| 3 | Aprovados pela Viviane | mesma janela + `aprovado_em IS NOT NULL` | `propostas.aprovado_em` + `aprovado_por` (uuid do user interno) |
| 4 | Aprovados pelo cliente | mesma janela + `aprovado_pelo_cliente=true` | `propostas.aprovado_pelo_cliente_at` (portal) |
| 5 | Viraram pedido em 7d | JOIN `pedidos` ON `proposta_id` + `pedidos.created_at <= proposta.created_at + 7d` | `pedidos.proposta_id` |
| 6 | Tempo briefing→envio | `proposta.created_at - ai_requests.created_at` (mesma proposta) | `ai_requests` JOIN por `entity_id` |
| 7 | Custo USD semana | `sum(ai_logs.cost_usd) WHERE function_name IN (briefing-beira-rio, ai-gerar-orcamento, ai-chat-portal)` | `ai_logs.cost_usd` |
| 8 | Tokens in/out | mesmo filtro, `sum(tokens_input)` / `sum(tokens_output)` | `ai_logs.tokens_input/output` |
| 9 | % aprovados sem edição | **NÃO INSTRUMENTADO** — não há flag no schema atual | (ver Gap-1) |

---

## SQL da view (já aplicada)

```sql
CREATE OR REPLACE VIEW public.vw_refundacao_metrics_semana_1 AS
WITH
janela AS (SELECT '2026-05-25'::timestamptz AS inicio, '2026-06-01'::timestamptz AS fim),
props AS (
  SELECT p.*
  FROM propostas p, janela j
  WHERE p.cliente_id = 'af166ada-e01b-4197-b8c3-33410af325d1'
    AND p.created_at >= j.inicio AND p.created_at < j.fim
    AND p.excluido_em IS NULL
),
briefings AS (
  SELECT ar.entity_id AS proposta_id, ar.created_at AS briefing_iniciado_em
  FROM ai_requests ar, janela j
  WHERE ar.tipo IN ('briefing_beira_rio_shadow','briefing_beira_rio')
    AND ar.created_at >= j.inicio AND ar.created_at < j.fim
),
custos AS (
  SELECT coalesce(sum(al.cost_usd),0) AS custo_usd,
         coalesce(sum(al.tokens_input),0) AS tokens_in,
         coalesce(sum(al.tokens_output),0) AS tokens_out
  FROM ai_logs al, janela j
  WHERE al.created_at >= j.inicio AND al.created_at < j.fim
    AND al.function_name IN ('briefing-beira-rio','ai-gerar-orcamento','ai-chat-portal')
)
SELECT
  (SELECT count(*) FROM props WHERE gerado_por_ia) AS orcamentos_gerados_ia,
  (SELECT count(*) FROM props WHERE gerado_por_ia AND status='enviada') AS orcamentos_enviados,
  (SELECT count(*) FROM props WHERE gerado_por_ia AND aprovado_em IS NOT NULL) AS aprovados_internamente,
  (SELECT count(*) FROM props WHERE gerado_por_ia AND aprovado_pelo_cliente) AS aprovados_pelo_cliente,
  (SELECT count(*) FROM props p JOIN pedidos pe ON pe.proposta_id=p.id
     WHERE p.gerado_por_ia AND pe.created_at <= p.created_at + interval '7 days'
       AND pe.excluido_em IS NULL) AS viraram_pedido_7d,
  (SELECT round(avg(EXTRACT(epoch FROM (p.created_at - b.briefing_iniciado_em)))::numeric, 2)
     FROM props p JOIN briefings b ON b.proposta_id = p.id
    WHERE p.gerado_por_ia) AS tempo_medio_briefing_envio_seg,
  (SELECT custo_usd FROM custos) AS custo_usd_semana,
  (SELECT tokens_in FROM custos) AS tokens_in_semana,
  (SELECT tokens_out FROM custos) AS tokens_out_semana,
  NULL::numeric AS pct_aprovados_sem_edicao,
  '2026-05-25'::date AS janela_inicio,
  '2026-05-31'::date AS janela_fim,
  now() AS calculado_em;
```

---

## Como rodar relatório diário

### Manual (sob demanda)
```sql
SELECT * FROM public.vw_refundacao_metrics_semana_1;
```

### Sugestão: scheduled task → Telegram
Criar script (`C:\Users\Caldera\Claude\JARVIS\scripts\refundacao-metricas-w1.py`) que:
1. Consulta a view via Supabase service role.
2. Formata como mensagem curta (template abaixo).
3. POST para Telegram `chat_id=1065519625`.

Registrar em `pessoal.scheduled_tasks` rodando às 09:00 e 19:00 BRT (12:00 e 22:00 UTC) entre 28/05 e 31/05.

Template Telegram:
```
[REFUNDACAO W1 — DD/MM HH:MM]
Orçamentos IA: X (meta: ≥3)
Enviados: X | Aprov.Viviane: X | Aprov.Cliente: X
Viraram pedido 7d: X
Tempo briefing→envio: Xs
Custo Claude: US$ X,XX (in/out: X/X tokens)
```

---

## Limitações conhecidas (modo adversarial)

### GAP-1 — `pct_aprovados_sem_edicao` não é mensurável hoje
Schema atual não distingue "aprovado direto" de "aprovado com edição manual de itens/preço". Para instrumentar, opções:
- Adicionar coluna `aprovado_sem_edicao` (boolean) preenchida pelo handler Telegram V2 + tela ERP.
- OU: snapshot inicial em `propostas.config_snapshot` no momento de criação, diff contra estado em `aprovado_em`.

### GAP-2 — `ai_logs` não captura funções da Refundação
`ai_logs` tem 61 registros (último 22/05), mas nenhuma chamada de `briefing-beira-rio`, `ai-gerar-orcamento` ou `ai-chat-portal`. As Edges atuais (`briefing-beira-rio` em SHADOW) **não estão escrevendo `ai_logs`**. Antes do relatório final é necessário:
- Auditar as 3 funções: `supabase/functions/{briefing-beira-rio,ai-gerar-orcamento,ai-chat-portal}/index.ts`.
- Adicionar `await supabase.from('ai_logs').insert({...})` após cada call de modelo, com `function_name`, `tokens_input/output`, `cost_usd`, `duration_ms`, `status`, `entity_type/id`.
- Sem isso, custo USD da semana fica em **0,00** falsamente.

### GAP-3 — Tempo briefing→envio impreciso
`ai_requests.created_at` é praticamente igual a `processed_at` (delta ~0,1s) no modo SHADOW — significa que a request é registrada quando a IA termina, não quando inicia. Diff vs `propostas.created_at` chega a ser **negativo** (-2,82s na medição atual) porque a proposta é inserida ANTES do ai_request. Para medir corretamente:
- Capturar `briefing_iniciado_em` no momento da primeira mensagem do briefing (handler webhook WhatsApp).
- Salvar em `ai_requests.created_at` **antes** de chamar modelo + flushar imediato.

### GAP-4 — Aprovação Telegram V2 vs tela ERP
Ambos caminhos preenchem `propostas.aprovado_em` e `aprovado_por`. **Sem coluna de canal**, não dá pra distinguir onde a Viviane aprovou. Para B-tests futuros, adicionar `aprovado_via` text ('telegram_v2' | 'erp_tela' | 'portal_cliente').

### GAP-5 — Modo SHADOW vs real
Todas as 3 propostas (PROP-2026-0030/0031/0032) estão marcadas como SHADOW em `observacoes_internas`. A Viviane não recebeu via Telegram — não houve E2E real. Bloco #9 (E2E real Viviane Quinta 28/05) depende disso.

---

## Próximos passos

| Quando | Ação |
|--------|------|
| **Sex 29/05 manhã** | Rodar `SELECT * FROM vw_refundacao_metrics_semana_1` — coleta intermediária. Se aprovados ainda = 0, escalar com Junior (E2E Viviane). |
| **Sex 29/05 tarde** | Instrumentar `ai_logs` em pelo menos `ai-gerar-orcamento` (a única que roda hoje em produção). Sem isso, custo USD fica zerado. |
| **Sáb 30/05** | Adicionar coluna `aprovado_via` em propostas para diferenciar canais (Telegram V2 / ERP / Portal). |
| **Dom 31/05** | Relatório final. SELECT da view + screenshot + post-mortem da semana. Decisão go/no-go Semana 2. |
| **Pós-Semana 1** | Implementar GAP-1 (flag aprovado_sem_edicao) e GAP-3 (briefing_iniciado_em real). |

---

## Comandos prontos

Inspeção rápida via Cowork:
```sql
SELECT * FROM public.vw_refundacao_metrics_semana_1;
```

Detalhe das 3 propostas:
```sql
SELECT numero, status, gerado_por_ia, aprovado_em, aprovado_pelo_cliente_at, total
FROM propostas
WHERE cliente_id = 'af166ada-e01b-4197-b8c3-33410af325d1'
  AND created_at >= '2026-05-25'
ORDER BY created_at DESC;
```

Detalhe dos shadow briefings:
```sql
SELECT id, tipo, status, created_at, processed_at, entity_id
FROM ai_requests
WHERE tipo LIKE '%beira_rio%'
ORDER BY created_at DESC;
```
