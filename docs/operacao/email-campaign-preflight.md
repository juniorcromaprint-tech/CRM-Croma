# Pré-flight de campanha de email

> Função criada em 2026-05-09 (migration 152) — bloqueia disparos com problemas estruturais

## Uso

```sql
SELECT * FROM public.fn_preflight_email_campaign(
  ARRAY[ '<lead_id1>', '<lead_id2>', ... ]::uuid[],
  '<template_id>'::uuid
);
```

Retorna 10 linhas (uma por check) com:
- `check_name` — nome do check
- `status` — PASS / FAIL / WARN
- `total_afetados` — quantos leads fazem parte deste check
- `detalhe` — explicação humana
- `exemplos` — primeiros 5 leads afetados (quando aplicável)

## Os 10 checks

| # | Check | Bloqueia se FAIL? |
|---|---|---|
| 1 | `template_existe_ativo` | Sim |
| 2 | `placeholders_suportados` | Sim — placeholder não reconhecido = bug certo |
| 3 | `leads_com_nao_incluir` | Sim — respeita marcação manual |
| 4 | `leads_sem_email_valido` | Sim — email inválido = bounce certo |
| 5 | `leads_com_bounce_anterior` | WARN — recomendado remover |
| 6 | `emails_duplicados_na_lista` | WARN — vai mandar 2x pra mesma pessoa |
| 7 | `leads_em_conversa_ativa` | Sim — RPC pula esses |
| 8 | `leads_excluidos` | Sim |
| 9 | `respeita_limite_diario` | WARN — pode passar do `max_emails_dia` |
| 10 | `total_leads_elegiveis` | Sim — precisa ter pelo menos 1 |

## Critério de "campanha autorizada"

A campanha está autorizada SE:
- Nenhum check 1, 2, 3, 4, 7, 8 está FAIL
- Check 10 está PASS (>0 leads)
- WARNs (5, 6, 9) podem ser aceitos com decisão consciente

## Anti-placeholder em runtime

Mesmo se o pré-flight passar, a edge function `agent-enviar-email` v24 tem
guarda em runtime: se o body ou subject contém `{{...}}` após render, marca
mensagem como `status='erro'` e NÃO chama Resend. Defesa em profundidade.

## Auditoria de mensagens já enviadas

```sql
-- Encontra mensagens enviadas com placeholder quebrado nas últimas 24h
SELECT * FROM public.fn_detect_broken_placeholders(24);

-- Últimos 7 dias
SELECT * FROM public.fn_detect_broken_placeholders(168);
```
