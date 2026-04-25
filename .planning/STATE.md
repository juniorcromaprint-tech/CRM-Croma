# STATE — CRM-Croma

> Atualizado: 2026-04-25

## Status Atual
**Fase**: Terceirização — Fase 4 CONCLUÍDA | Fase 5 pendente

## Último trabalho
- Fase 1 (✅ commit 6573cfb): página, hook, components, rota, menu
- Fase 2 (✅ commit 4f613d5): migration faixas, hook useTerceirizacaoFaixas, FaixasTable no drawer, 27 faixas inseridas
- Fase 3 (✅ commit d038ec1): migration variacoes, hook useTerceirizacaoVariacoes, 380 variações em 87 produtos (59.6%)
- Fase 4 (✅ 2026-04-25): coluna `descricao` em terceirizacao_catalogo, script `scrape_descricoes.py`, 144 descrições (98.6%), bloco "Sobre o produto" no drawer

## Próxima tarefa
**Fase 5**: Integração com orçamento Mubisys
- Função SQL `sugerir_terceirizacao(produto_croma_id, medidas, qtd)`
- View `vw_terceirizacao_alternativas`
- Card "Alternativa de fornecimento" no orçamento
- Snapshot em `proposta_itens` (fornecedor_id, terceirizado, preco_terceirizacao_snapshot)
- Pedido de compra automático quando proposta vira pedido

## Resultados da Fase 4
- Descrições: **144/146 (98.6%)**
- Tamanho médio: 211 chars (min 41, max 395)
- Fonte: blocos `produto-pagina-info` + `produto-pagina-descricao-html` das páginas Scan
- Filtro: remoção de marketing ("garanta", "perfeito", "ideal", "alta visibilidade", etc.)

## Fases pendentes (5-10)
Ver: `.planning/FEATURE-terceirizacao.md`

## Blockers
- Nenhum no momento

## Branch
main — aguardando commit da Fase 4
