# DB-006 — Produtos sem `produto_modelos` (Mubisys custeia cego)

> Gerado pelo loop autônomo — **Ciclo #52** — 2026-05-30 ~02:10 BRT
> Lane: **P0 — Correção de dinheiro** (backlog de módulos) · Módulo: Orçamento (Mubisys)
> Fonte: query ao vivo no Supabase `djwjmfgplnqyffdcgdaw` (produtos × produto_modelos × proposta_itens × pedido_itens)

---

## Veredito

⚠️ **Risco LATENTE, não sangramento ativo.** 53 produtos ativos (60,2% do catálogo ativo) não têm **nenhum** `produto_modelos` cadastrado — o motor Mubisys custeia cego (preço zero / sem BOM) se algum deles for selecionado num orçamento.

✅ **Mitigador crítico (verificação cruzada):** os **53 produtos nunca foram usados** — 0 ocorrências em `proposta_itens` e `pedido_itens`, todos criados em 2026-03-11 (catálogo seed). Ou seja: nenhum orçamento/pedido real foi precificado errado por causa disso. São **landmines dormentes** — o problema só dispara no primeiro uso de qualquer um deles.

➡️ **Ação do loop = ESTE relatório.** O loop **não inventa BOM** (medidas/materiais/markup são decisão de negócio). Cadastro dos `produto_modelos` + `modelo_materiais` por categoria = **Junior**.

---

## Números (ao vivo)

| Métrica | Valor |
|---|---|
| Total de produtos | 107 |
| Produtos ativos | 88 |
| **Ativos SEM `produto_modelos`** | **53 (60,2% dos ativos)** |
| Ativos só com modelo inativo | 0 |
| Inativos sem modelo | 7 |
| Total sem modelo (ativos+inativos) | 60 *(= o "60" histórico do DB-006)* |
| Dos 53 ativos sem modelo: já usados em proposta/pedido | **0** |

A divergência histórica ("60 produtos") = 53 ativos + 7 inativos. O subconjunto **acionável** é os 53 ativos.

---

## Priorização por categoria

Como o uso é uniformemente zero (não dá pra priorizar por "mais cotado"), a priorização prática é **por categoria** — Junior cadastra a BOM em lote, categoria por categoria. Ordenado por volume de pendência:

| # | Categoria | Produtos sem modelo |
|---|---|---|
| 1 | displays | 11 |
| 2 | placas | 9 |
| 3 | estruturas | 8 |
| 4 | grafica | 8 |
| 5 | fachadas | 7 |
| 6 | banners_lonas | 4 |
| 7 | adesivos | 2 |
| 8 | luminosos | 2 |
| 9 | servicos | 2 |
| | **TOTAL** | **53** |

---

## Lista completa (53 produtos ativos sem modelo, agrupados por categoria)

### displays (11)
Ambientação · Chaveiro Acrílico · Imantado 0,8mm · Mobile Impresso · Mobile Papel · Painel de Gestão à Vista · Porta Cartão de Visitas Mesa · Porta Folder/Take-One · Porta Sachê · Urna de MDF · Woobler

### placas (9)
Placa de Aço Inox · Placa de Acrílico · Placa de Alumínio Natural · Placa de FOAM · Placa de MDF · Placa de Papelão · Placa de Polionda · Placa de Vidro · Placa Fotoluminescente

### estruturas (8)
Quadro Alumínio · Quadro Canvas · Quadro Galvanizado · Quadro Galvanizado c/ Mecânica · Quadro Madeira Placas · Quadro Smart-Frame · Sapatas Sustentação · Suporte Sustentação Galvanizado

### grafica (8)
Cartela de Etiqueta · Cordão Crachá Silicone · Cordão Sublimado Crachá · Crachá PS · Folder/Cardápio · Jacaré Crachá · Panfletos · Pastas Personalizadas

### fachadas (7)
Front Light Parede (Ilhós) · Front Light Parede (Rebite) · Mega Totens · Poste Simples Front Light · Requadro Parede (Ilhós) · Requadro Parede (Rebite) · TypeTotem

### banners_lonas (4)
Banner Lona e Tecido (m²) · Canvas Impresso · Roll-up · Wind Banner

### adesivos (2)
Adesivo Jateado · Adesivo Refletivos

### luminosos (2)
Luminária/Plafon · Luminoso Caixa 2ª Linha

### servicos (2)
Corte em CNC (m²) · Corte em Laser (m²)

---

## Recomendação (Junior)

1. **Não é urgência de prod** — nenhum desses 53 está em uso. Pode ser feito em lote, sem pressa, sem risco financeiro retroativo.
2. **Cadastrar BOM por categoria**, começando pelas categorias de maior volume e maior chance de venda no perfil da Croma (sugestão: `placas`, `fachadas`, `banners_lonas`, `displays`).
3. **Salvaguarda recomendada (default-exec do loop, próximo ciclo):** guard no `ai-gerar-orcamento` / Mubisys para **bloquear ou alertar** quando um produto sem `produto_modelos` ativo for selecionado, em vez de retornar preço zero silencioso. Isso transforma o landmine latente em erro visível antes de virar proposta. (Item proposto no ledger NEXT como DB-006b.)
4. **DB-007 relacionado** (não coberto aqui): produtos COM modelo mas com `modelo_materiais` vazia (BOM zerada) — auditar separadamente.

---

*Critério de fechamento DB-006 (backlog): relatório gerado + alerta Telegram ao Junior. ✅ atendido pelo ciclo #52. O cadastro da BOM permanece com o Junior (negócio).*
