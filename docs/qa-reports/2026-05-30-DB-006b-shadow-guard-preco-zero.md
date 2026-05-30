# QA Report — DB-006b: Shadow Guard de Preço-Zero-Sem-Modelo

**Ciclo autônomo #55** | 2026-05-30 05:08 BRT | Tipo: corrigir + validar
**Migration:** `shadow_guard_orcamento_item_preco_zero_sem_modelo_cycle55` (idempotente)
**Status:** ✅ APLICADO + validado em RUNTIME | 0 deploy Edge | 0 prod-data write

## Contexto

DB-006 (#52): 53 produtos ativos sem `produto_modelos` (60,2% do catálogo ativo), todos com **0 uso** = landmine dormente. DB-007 (backlog v6): 7 `produto_modelos` com BOM (`modelo_materiais`) vazia. O NEXT **DB-006b** (#52) pedia um guard para tornar "produto sem modelo → preço zero silencioso" VISÍVEL, em vez de gravar zero sem aviso.

## Mapeamento do path zero-price (agent adversarial, file:line)

| Path | Comportamento com produto SEM fonte de preço | Persiste item? |
|---|---|---|
| Edge `ai-gerar-orcamento` v29 — produto sem `produto_modelos` | item vai p/ `itensSemMatch`, descartado | ❌ não grava |
| Edge `ai-gerar-orcamento` v29 — modelo existe mas BOM vazia | `calcPricing` com custoMP=0 → markup sobre zero | ⚠️ grava `valor_unitario` ~0 (L523-543) |
| Editor manual `OrcamentoEditorPage.tsx` — fluxo normal | guard C-01 (L436) bloqueia preço ≤ 0 com erro explícito | ❌ não grava |
| Editor manual — **path de TEMPLATE (~L690)** | **BYPASSA o guard C-01**, insere `valor_unitario=0/valor_total=0` direto | ⚠️ **grava zero (PRICE-004)** |

Coluna de preço unitário confirmada no código e no schema: `proposta_itens.valor_unitario` / `pedido_itens.valor_unitario` (numeric).

## Guard aplicado (warn-only, padrão #51)

- `fn_orcamento_item_preco_zero_shadow()` — SECURITY DEFINER, `search_path=public,pg_temp`, `BEGIN/EXCEPTION WHEN OTHERS THEN RETURN NEW` (jamais aborta a gravação).
- Triggers `AFTER INSERT OR UPDATE OF valor_unitario, produto_id` em `proposta_itens` **E** `pedido_itens`, com `WHEN (valor_unitario<=0 AND produto_id NOT NULL)`.
- Loga `system_events` `event_type='orcamento_item_preco_zero_sem_modelo'` **SÓ** quando o produto NÃO tem `produto_modelos` ativo com BOM (`modelo_materiais`) nem `preco_fixo>0` → exclui zero legítimo em produto bem-modelado (desconto/brinde).

## Validação (3 provas)

1. **Schema pré-validado**: `produto_modelos.ativo`/`preco_fixo`, `modelo_materiais.modelo_id`, `system_events` (event_type/entity_type/entity_id NOT NULL + payload jsonb).
2. **RUNTIME (smoketest rolled-back via RAISE)**:
   - Positivo — produto modelless + `valor_unitario=0` → `delta=+1` ✅
   - Controle negativo — produto COM modelo+BOM/preco_fixo + `valor_unitario=0` → `delta=0` ✅ (zero falso-positivo)
3. **Catálogo + pollution**: fn SECURITY DEFINER + search_path confirmados; 2 triggers (`proposta_itens`, `pedido_itens`); `pollution_check=0` (rollback limpo, zero poluição).

## Veredito

✅ Landmine DB-006/DB-007 agora é **observável** em `system_events` no instante em que materializar (qualquer dos 2 paths + o bug do template). Guard isolado, warn-only, **NÃO** toca o motor de preço nem altera valores cotados.

## NEXT (Junior)

- **PRICE-004** (agent-reported, NÃO-VALIDADO por mim): template path do editor (`OrcamentoEditorPage.tsx ~L690 handleApplyTemplate`) bypassa o guard C-01. Confirmar a linha + aplicar o mesmo guard C-01 no path de template (Claude Code, validar impacto). O shadow guard #55 fornece a evidência de runtime antes de mexer no frontend.
- **P2 watch**: monitorar `system_events` `orcamento_item_preco_zero_sem_modelo`. Se disparar em prod → revisar payload + avisar Junior.
- Fix de preço (PRICE-001/002/003 + DATA-004) segue **BLOCKED-Junior** (muda preço cotado).
