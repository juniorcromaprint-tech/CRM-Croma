# DB-011 — Auditoria regras_precificacao + motor de preço (Mubisys)

> Ciclo autônomo #54 — 2026-05-30 ~04:30 BRT | Rotação Sábado/Financeiro+Orçamento (ângulo novo: integridade de precificação)
> Status: 🟡 **doc-drift FECHADO (doc-sync)** + 🔴 **achado de integridade de preço (BLOCKED-Junior)**

## TL;DR (veredito)

O "drift 11 vs 9" do backlog era **imprecisão de doc**, não contradição: a tabela tem **11 regras** (9 ativas + 2 inativas). Sincronizado em `.context/migrations.md`.

Mas a investigação adversarial achou algo **maior e não documentado antes**: o motor de preço **não aplica as regras de categoria no caminho de orçamento manual** — todo item manual usa o fallback `geral` (markup fixo 40%). As regras calibradas por categoria (placa, adesivo, etc.) só funcionam no caminho da IA.

## 1. Estado real de `regras_precificacao`

| # | categoria | ativo | markup_min | markup_sug | markup_max | obs |
|---|---|---|---|---|---|---|
| 1 | geral | ✅ | 30 | 45 | 300 | fallback padrão |
| 2 | banner | ✅ | 35 | 50 | 300 | |
| 3 | pdv | ✅ | 35 | 55 | 300 | |
| 4 | adesivo | ✅ | **400** | **580** | 300 | ⚠️ min>max, sug>max |
| 5 | painel | ✅ | 40 | 60 | 300 | |
| 6 | totem | ✅ | 45 | 65 | 300 | |
| 7 | placa | ✅ | 35 | **310** | 300 | ⚠️ sug>max (conhecido, STATE) |
| 8 | backdrop | ✅ | 30 | 45 | 300 | |
| 9 | envelopamento | ✅ | 40 | 65 | 300 | |
| 10 | **letreiro** | ❌ | 45 | 70 | 300 | desativada 2026-03-22 02:40 |
| 11 | **fachada** | ❌ | 40 | 60 | 300 | desativada 2026-03-22 02:40 |

**11 total, 9 ativas, 2 inativas.** As 2 inativas foram desativadas deliberadamente (updated_at 02:40 vs lote ativo 02:48) — reativar = decisão do Junior.

## 2. Motor de preço — como casa produto→regra (validado por agent, file:line)

Caminho | Como resolve a regra | Resultado
---|---|---
**Manual (UI)** | `useItemEditor.ts:135` grava `categoria: produto.categoria` (cru, plural/free-text) → `useOrcamentoPricing.ts` → `orcamento-pricing.service.ts:307` `ativas.find(r => r.categoria === categoria)` | **NÃO casa** — `"adesivos" === "adesivo"` = false → cai em `geral`/hardcoded (markup **40**, min **25**, aprov **85**)
**IA** | `ai-gerar-orcamento/index.ts:142,386` `regrasMap[categoria_inferida]`; `categoria_inferida` vem da LLM travada em `CATEGORIAS VALIDAS` singular (`index.ts:42`) | **Casa** — usa a regra da categoria
**markup_maximo** | só em `types.ts`, `precificacao.types.ts`, `mcp-server/admin.ts` (CRUD) | **dead code** — nunca lido em cálculo, **sem clamp**

### Por que as categorias não casam
`produtos.categoria` é texto livre, plural e com inconsistência de caixa/idioma:
`adesivos, banners_lonas, Comunicação Visual, displays, estruturas, fachadas, Fachadas, grafica, iluminacao, letreiros, luminosos, Outros, placas, Placas e Displays, servicos`

`regras_precificacao.categoria` é singular:
`adesivo, banner, pdv, painel, totem, placa, backdrop, geral, envelopamento, letreiro, fachada`

Nenhum valor de produto casa exatamente um valor de regra → no caminho manual, 100% cai em `geral`.

## 3. Impacto (realizado vs latente)

- Volume realizado **baixo**: 23 `proposta_itens` + 12 `pedido_itens` no total (muitos pedidos são Mubisys com `skip` de precificação). Não há sangramento massivo **agora**.
- **Latente / direcional**: categorias com markup calibrado **alto** porque o material é barato (placa sug=310, adesivo sug=580) são **sub-precificadas** no UI manual (saem com 40% em vez de 310%/580%). Em volume, isso seria perda de margem real.
- `markup_maximo=300` uniforme é inerte (dead code) — as "anomalias" adesivo/placa não causam efeito em runtime hoje.

## 4. Recomendações (BLOCKED-Junior — mexe em preço/código)

1. **PRICE-001 (P1)**: corrigir o match de categoria no caminho manual (normalizar singular/lowercase ou mapear `produto.categoria`→`regra.categoria`). Fix em frontend → Claude Code + validação com pedido real antes de prod.
2. **PRICE-002 (P2)**: decidir o destino de `markup_maximo` — ligar como teto real (clamp) ou remover do admin (hoje é campo que não faz nada).
3. **PRICE-003 (watch)**: confirmar se adesivo=580 / placa=310 são calibração intencional ou erro de digitação (no caminho AI eles JÁ se aplicam, sem teto).
4. **DATA-004 (P2)**: normalizar a taxonomia de `produtos.categoria` (eliminar "Fachadas"/"fachadas", "Comunicação Visual", "Placas e Displays", "Outros", plurais).
5. **letreiro/fachada inativas**: reativar só se o Junior quiser markup específico para esses tipos (hoje, mesmo se casassem, estão inativas → cairiam em geral).

## 5. Ação autônoma deste ciclo
- ✅ Doc-sync: `.context/migrations.md` (11 regras = 9 ativas + 2 inativas).
- ✅ Backlog: DB-011 `[x]` + PRICE-001/002/003 + DATA-004 adicionados.
- ❌ Zero alteração em `regras_precificacao` (mexer em markup = decisão de preço do Junior).
- ❌ Zero deploy/migration.
