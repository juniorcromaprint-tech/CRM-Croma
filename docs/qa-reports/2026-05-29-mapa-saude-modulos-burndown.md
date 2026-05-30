# Mapa de Saúde por Módulo + Burndown Real — CRM Croma

> Levantado: 2026-05-29 ~20:30 BRT | Sessão monitor (Opus)
> Método: verificação **ao vivo** contra Supabase prod (`djwjmfgplnqyffdcgdaw`) + advisors + leitura de source das Edge Functions. Modo adversarial — não confiamos no checklist de abril; medimos o estado atual.
> Escopo: ~65 achados das auditorias v4–v7 (abril) + advisors atuais + watch items do loop autônomo.

---

## Veredito global

| Métrica | Valor |
|---|---|
| Achados resolvidos ✅ | ~16 (25%) |
| Parciais ⚠️ | ~10 (15%) |
| Abertos 🔴 | ~39 (60%) |
| **Maior risco financeiro de abril (triggers duplicados DB-001..005)** | **100% RESOLVIDO** ✅ |
| Maior dívida aberta | Qualidade de dados Comercial + bloqueios fiscais (NF-e) + views SECURITY DEFINER (41) |

**Leitura honesta:** o loop autônomo fechou bem a dívida de **banco e segurança que dava pra resolver sozinho** (triggers, índices, RLS anon, search_path). O que ficou aberto é dominado por (a) **qualidade de dados operacional** que exige regra de negócio ou entrada humana, (b) itens **BLOCKED-Junior** (views definer, buckets, token, secrets fiscais), e (c) **gaps de autonomia** (Fase 2–4) que nunca entraram na fila do loop.

---

## Matriz por módulo (rotação semanal)

| Módulo | Saúde | % fechado | Gaps abertos críticos |
|---|---|---|---|
| **Comercial** (Seg) | 🔴 | ~14% | Base de leads congelada (96%), 99,7% clientes sem vendedor, 34% leads sem email, whatsapp aceita payload sem assinatura |
| **Orçamento** (Ter) | ⚠️ | ~40% | 56% produtos sem modelo/BOM → motor Mubisys custeia cego |
| **Pedidos** (Qua) | ✅ | ~65% | Itens legados sem dimensão/area_m2 (cálculo m² errado); state-machine não cobre OP |
| **Produção** (Qui) | 🔴 | ~20% | 100% jobs HP sem vínculo ERP, 3 OPs sem máquina, 2 printheads vencidos em uso, chain Produção→Instalação dormente |
| **Instalação** (Sex) | 🔴 | ~10% | install_completed parado 24d, 15 jobs campo parados >7d, PWA "offline-first" só rótulo |
| **Financeiro** (Sáb) | ✅ | ~85% | Saudável (auditado #41). R$822 CP vencidas a conferir; módulos comissão/caixa dormentes |
| **Estoque/Fiscal/IA** (Dom) | 🔴 | ~25% | 75% materiais sem NCM + 35 clientes sem doc (bloqueiam NF-e); 41 views SECURITY DEFINER; secrets fiscais hardcoded |

---

## Detalhe verificado — Comercial 🔴

| Cód | Estado | Número real | Evidência |
|---|---|---|---|
| CRM-001 | 🔴 | 96,1% (2660/2769) | Leads sem atividade e `updated_at` >7d — pipeline congelado |
| CRM-002 | 🔴 | 34,2% (947) | Sem email nem contato_email |
| CRM-003 | 🔴 | 99,7% (334/335) | Clientes sem `vendedor_id` — só 1 atribuído na base inteira |
| CRM-004 | 🔴 | 49,0% (164) | Clientes sem email |
| CRM-005 | 🔴 | 52,4% (1452) | Leads sem `contato_nome` |
| CRM-006 | 🔴 | 41,0% (1134) | Leads sem telefone |
| CRM-007 | 🔴 | 18 | Mesmo telefone em empresas distintas |
| DATA-001 | ⚠️ | ~7 reais | Leads de teste E2E (regex inicial inflou pra 11 com falsos positivos) |
| DATA-002 | ✅ | 0 | Status de lead normalizado (sem "em_contato") |
| DATA-003 | 🔴 | 13 | Emails com leads duplicados |
| INT-006 | 🔴 | — | `whatsapp-webhook:380` aceita payload sem assinatura quando APP_SECRET ausente |

## Orçamento ⚠️

| Cód | Estado | Evidência |
|---|---|---|
| DB-004 | ✅ | area_m2: 1 trigger por tabela (dedup feito) |
| DB-006 | 🔴 | 60/107 produtos (56%) sem `produto_modelos` → Mubisys custeia cego |
| DB-007 | ⚠️ | 10/116 modelos sem BOM (8,6%, melhorou) |
| DB-011 | ⚠️ | 9 regras_precificacao ativas vs "11" no CLAUDE.md (drift de 2) |
| DB-012 | 🔴 | 5/23 proposta_itens + 5/12 pedido_itens sem largura/altura/area_m2 → preço m² errado |

## Pedidos ✅

| Cód | Estado | Evidência |
|---|---|---|
| BUG-01..05, GAP-07 | ✅ | Fluxo lead→faturamento core entregue (v1) |
| DB-005 | ✅ | 1 só trigger CR (`trg_pedido_aprovado_conta_receber`); sem duplo |
| DB-010 | ✅ | `vw_cockpit_executivo` filtra `excluido_em IS NULL` |
| DB-013 | ⚠️ | `fn_validar_transicao_status` cobre pedidos/propostas mas NÃO ordens_producao (ELSE NULL passa tudo) |

## Produção 🔴

| Cód | Estado | Evidência |
|---|---|---|
| DB-001 | ✅ | ordens_producao: 1 só trigger de estoque (2 duplicados removidos) |
| PROD-001 | 🔴 | 3/3 OPs ativas sem `maquina_id` |
| OPS-001 | 🔴 | 107/107 impressora_jobs sem `pedido_id`/`ordem_producao_id` (0% vinculado) |
| HP-001 | 🔴 | 2 printheads vencidos em uso (exp 2023-12 e 2026-01); 3º vence 2026-06-03 |
| HP-002 | 🔴 | 21 substratos EWS sem `material_id` |
| (watch) | 🔴 | `production_completed_transition` = 0 lifetime — chain dormente |

## Instalação 🔴

| Cód | Estado | Evidência |
|---|---|---|
| CAMPO-001 | 🔴 | 15 jobs de campo parados >7d |
| INSTAL-01 | 🔴 | `installation_completed` parado há 24d |
| INSTAL-02 | 🔴 | PWA "offline-first" é rótulo — sem IndexedDB/fila/replay |

## Financeiro ✅

| Cód | Estado | Evidência |
|---|---|---|
| GAP-01/02, BUG-03/04 | ✅ | Dashboard, boletos, pagamento, comissão entregues |
| DB-002 | ✅ | 1 só trigger contas_pagar (sem risco de pagamento duplo) |
| (watch) | ⚠️ | R$822 CP vencidas (conferir baixa externa); comissão/caixa 0 linhas (provável by-design) |

## Estoque / Fiscal / IA 🔴

| Cód | Estado | Número/Evidência |
|---|---|---|
| EST-001 | ✅ | Só 2/502 materiais sem preco_medio |
| FIS-001 | 🔴 | 35 clientes ativos sem CNPJ/CPF — bloqueia NF-e |
| FIS-002 | 🔴 | 75,5% (379/502) materiais sem NCM |
| FIS-004 | 🔴 | 36 clientes sem endereço |
| FIS-005 | ⚠️ | 17 clientes sem cidade |
| DB-008 | ⚠️ | 2 materiais ativos preco_medio=0 |
| SEC-001 | ✅ | RLS anon trancado (3460→0), validado #44 |
| SEC-002 | ✅ | Revoke anon EXECUTE (62→35; resto retido by-design) |
| SEC-004 | ⚠️ | 7 SECURITY DEFINER fixados (#45); 58 INVOKER restam (baixo risco) |
| SEC-005 | 🔴 | **41 views SECURITY DEFINER** (ERROR) — bypassam RLS |
| SEC-003 | 🔴 | 124 policies `USING(true)` (triar by-design vs frouxas) |
| SEC-009 | 🔴 | 5 buckets com listing público |
| SEC-011 | 🔴 | pg_trgm + pg_net em `public` |
| SEC-013 | 🔴 | Proteção senha vazada (HaveIBeenPwned) OFF |
| INT-002 | 🔴 | SERVICE_TOKEN `croma-fiscal-interno-2026` hardcoded = bypass total de auth nas edges fiscais |
| INT-004 | 🔴 | `fiscal-debug-sefaz`/`fiscal-debug-nfe` ACTIVE em prod + header forense hardcoded |
| INT-005 | 🔴 | TELEGRAM_BOT_TOKEN hardcoded vivo `telegram-webhook:11` |
| INT-011 | 🔴 | Família `croma-<tema>-2026` em 4 gates de auth |
| INT-014 | 🔴 | args do LLM injetados sem Zod em telegram-webhook |

---

## Resolvidos com destaque (não reabrir)

- **DB-001 a DB-005** — triggers duplicados (pagamento/CR/baixa-estoque dobrados): **integralmente resolvidos**, 1 trigger por efeito. Era o maior risco financeiro de abril.
- **DB-009** — 0 FKs sem índice (loop #43).
- **SEC-001/002** — anon trancado + EXECUTE revogado.
- **INT-001/003** — cron sem JWT hardcoded; ai-gerar-orcamento com verify_jwt=true.
- **INT-013** — telegram_messages com TTL (purge mensal).

---

## Gaps de autonomia (mission CROMA 4.0 — nunca entraram na fila do loop)

1. Triggers de evento formais não disparam automação (production/installation/payment) — parcial
2. Prospecção construída mas **gated OFF** (`followup_engine_ativo=false`) — operacional, aguarda sessão ao vivo
3. Cobrança escalonada existe mas não exercitada
4. PCP reativo (sem replanning automático)
5. Memory Layer ausente (sem aprendizado de padrões/score)
6. Cockpit executivo incompleto

---

## Por que o loop não fechou isso sozinho (causa-raiz)

A heurística da Etapa 5 prioriza "P0/P1 já no ledger NEXT" acima da "rotação de módulo". Cada ciclo roda advisor → acha lints → grava no NEXT como default-exec → próximo ciclo pega o lint (não o módulo). **O loop come a própria cauda de faxina e nunca volta a varrer Comercial/Orçamento/Produção atrás dos gaps acima.** Correção proposta: rotação de módulo vira driver primário; advisor cleanup vira filler; carregar estes gaps verificados no ledger por módulo.
