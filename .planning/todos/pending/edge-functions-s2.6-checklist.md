# Checklist — Edge Functions que precisam fix S2.6 (JWT role decoder)

> Criado: 2026-04-24 (Sprint Fechamento Operacional)
> Status: em andamento

## Contexto
Fix S2.6 implementado em `ai-shared/ai-helpers.ts`: decodifica JWT e permite bypass
inter-service via `role: 'service_role'` claim + header `X-Internal-Call: true`.
Segurança preservada (usuário comum tem `role: authenticated`).

Cada Edge Function que usa `authenticateAndAuthorize` precisa ser **redeployada** com a
versão nova do `ai-helpers.ts` (bundled junto).

## Grupo A — Usam `ai-helpers.authenticateAndAuthorize` (precisa redeploy)

| # | Edge Function | Status | Prioridade |
|---|---|---|---|
| 1 | `ai-shared/ai-helpers.ts` | ✅ atualizada localmente + deploy piloto em ai-resumo-cliente v18 | — |
| 2 | `ai-resumo-cliente` | ✅ v18 deployada (2026-04-24) | Piloto |
| 3 | `ai-analisar-orcamento` | ⬜ Pendente redeploy | Alta |
| 4 | `ai-detectar-problemas` | ⬜ Pendente redeploy | Alta |
| 5 | `ai-composicao-produto` | ⬜ Pendente redeploy | Alta |
| 6 | `ai-briefing-producao` | ⬜ Pendente redeploy | Média |
| 7 | `ai-sugerir-compra` | ⬜ Pendente redeploy | Média |
| 8 | `ai-sequenciar-producao` | ⬜ Pendente redeploy | Baixa (não usada) |
| 9 | `ai-preco-dinamico` | ⬜ Pendente redeploy | Baixa (não usada) |
| 10 | `ai-validar-nfe` | ⬜ Pendente redeploy | Média |
| 11 | `ai-insights-diarios` | ⬜ Pendente redeploy | Média |
| 12 | `ai-conciliar-bancario` | ⬜ Pendente redeploy | Média |
| 13 | `ai-previsao-estoque` | ⬜ Pendente redeploy | Baixa |

## Grupo B — Auth INLINE própria (precisa fix similar)

| # | Edge Function | Problema | Ação |
|---|---|---|---|
| 14 | `ai-compor-mensagem` | Service_role bypass por string compare (linha 98) — pode falhar se token env ≠ token pg_net | ⬜ Aplicar JWT role decoder + header X-Internal-Call |

## Grupo C — Sem autenticação padrão (fora do S2.6)

| # | Edge Function | Observação |
|---|---|---|
| 15 | `ai-gerar-orcamento` | Chamada apenas inter-service (whatsapp-webhook, ai-compor-mensagem). Sem auth. OK. |
| 16 | `ai-chat-erp` | `verify_jwt: true` no Supabase (auth externa). Sem check interno. OK para uso via frontend. |
| 17 | `whatsapp-webhook` | HMAC signature (`x-hub-signature-256`). OK. |

## Arquivos `.standalone.ts` (backups, NÃO deployados)

`ai-sequenciar-producao/index.standalone.ts`, `ai-sugerir-compra/index.standalone.ts`,
`ai-validar-nfe/index.standalone.ts`, `ai-conciliar-bancario/index.standalone.ts`,
`ai-insights-diarios/index.standalone.ts`, `ai-preco-dinamico/index.standalone.ts`,
`ai-previsao-estoque/index.standalone.ts` — são versões antigas inline. Ignorar no deploy.

## Teste de validação por Edge Function (200/401)

Para cada redeploy, rodar:

```sql
-- COM X-Internal-Call → deve passar (200 com auth_role=service, ou 400 por falta de body)
SELECT net.http_post(
  url := 'https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/<NOME>',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || private.get_service_role_key(),
    'X-Internal-Call', 'true'
  ),
  body := '{}'::jsonb
);

-- SEM X-Internal-Call → deve dar 401 ("Token invalido")
SELECT net.http_post(
  url := 'https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/<NOME>',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || private.get_service_role_key()
  ),
  body := '{}'::jsonb
);
```

## Progresso da Sprint Fechamento Operacional

- [x] ai-resumo-cliente (piloto, v18)
- [x] ai-chat-erp (S2.5 apenas, v9)
- [ ] ai-analisar-orcamento + teste 200/401
- [ ] ai-detectar-problemas + teste 200/401
- [ ] ai-composicao-produto + teste 200/401
- [ ] ai-compor-mensagem (Grupo B)
