# FEATURE — Terceirização Scan: do catálogo ao orçamento integrado

> **Versão**: 2.0 — plano completo | **Criado**: 2026-04-24 | **Atualizado**: 2026-04-24 | **Status**: pronto para execução | **Owner**: próxima sessão Sonnet | **Estimativa total**: 12–16h distribuídas em 10 fases

---

## 0. Resumo executivo

Em 24/04/2026 foi feito o trabalho de descoberta, scraping e cadastro do parceiro **Scan Revenda Impressão Digital** no banco do CRM. Ficou pronto: fornecedor cadastrado, 146 produtos com preço Scan, markup diferenciado por categoria (25–55%) e preço de venda Croma calculado automaticamente.

Esta sessão é pra fechar o ciclo: frontend, scrapings complementares (faixas de quantidade, variações, descrições), integração com o orçamento Mubisys, automação semanal, fiscal/operacional e documentação.

A motivação imediata: a impressora **Ampla Targa XT (boca 1,80m)** está em manutenção. A Scan está cobrindo. Esse trabalho transforma um arranjo manual em sistema.

---

## 1. Estado atual no Supabase (projeto `djwjmfgplnqyffdcgdaw`)

| Recurso | Status | Detalhes |
|---|---|---|
| `public.fornecedores` | ✅ | Scan cadastrada, id `33a79fe3-959b-42d5-a80e-7c2a2d2fd3de`, CNPJ 11.247.686/0001-36 |
| `public.terceirizacao_catalogo` | ✅ | 146 linhas — categoria, nome, variações, preço Scan, markup, preço venda |
| `public.terceirizacao_margens_categoria` | ✅ | 10 markups por categoria (25–55%) |
| Função `recalcular_preco_venda_terceirizacao()` | ✅ | Recalcula preço de venda em massa |
| Frontend `/terceirizacao` | ❌ | Fase 1 |
| `public.terceirizacao_catalogo_faixas` | ❌ | Fase 2 |
| `public.terceirizacao_catalogo_variacoes` | ❌ | Fase 3 |
| Coluna `descricao` em `terceirizacao_catalogo` | ❌ | Fase 4 |
| Integração com orçamento Mubisys | ❌ | Fase 5 |
| Re-scrape automático semanal | ❌ | Fase 6 |
| Multi-fornecedor (preparar pra mais parceiros) | ❌ | Fase 7 |
| Fiscal e operacional (NF, recebimento, SLA) | ❌ | Fase 8 |
| Dashboard BI de terceirização | ❌ | Fase 9 |
| Documentação final (STATE, memory, processos) | ❌ | Fase 10 |

---

## 2. Bootstrap — leia isto antes de tocar em código (5 min)

1. `C:\Users\Caldera\Claude\CRM-Croma\CLAUDE.md`
2. `C:\Users\Caldera\Claude\CRM-Croma\.planning\STATE.md`
3. `C:\Users\Caldera\Claude\CRM-Croma\.planning\IDENTITY.md`
4. `C:\Users\Caldera\Claude\CRM-Croma\.claude\rules\supabase-mutations.md` — `.select().single()` obrigatório
5. `C:\Users\Caldera\Claude\CRM-Croma\.claude\rules\alert-dialog-async.md` — `e.preventDefault()`
6. `C:\Users\Caldera\Obsidian\JARVIS\30-Conhecimento\Parceiros\scan-revenda.md` — contexto de negócio
7. `C:\Users\Caldera\Claude\JARVIS\parceiros\scan-revenda\catalogo_final.json` — dados fonte
8. `C:\Users\Caldera\Obsidian\JARVIS\01-Daily\2026-04-24.md` — o que foi feito hoje

### Estrutura de `terceirizacao_catalogo`

`id`, `fornecedor_id`, `categoria`, `nome`, `cores`, `material`, `revestimento`, `acabamento`, `extras`, `prazo`, `preco_info`, `preco_texto`, `preco_valor`, `preco_unidade` (m²/ml/cada), `markup_override`, `markup_aplicado`, `preco_venda`, `url`, `ativo`, `capturado_em`, `created_at`, `updated_at`.

### Padrões obrigatórios do CRM-Croma

- TypeScript no código, **pt-BR em TUDO** que o usuário vê.
- Cards `rounded-2xl`, inputs `rounded-xl`.
- Cor primária `bg-blue-600 hover:bg-blue-700`.
- Toasts: `showSuccess`/`showError` de `@/utils/toast.ts`.
- BRL: `brl()` de `@/shared/utils/format.ts`. Datas: `formatDate()`.
- Mutations Supabase: SEMPRE `.select().single()` no insert/update.
- AlertDialogAction async: SEMPRE `e.preventDefault()` + close manual via `onSettled`.
- Auth: `ProtectedRoute` em todas as rotas exceto `/p/:token` e `/nps/:token`.
- Estado vazio: padrão `rounded-2xl border border-slate-200 p-12 text-center`.

---

## Fase 1 — Página frontend `/terceirizacao` (Caminho A)

### Goal
Página no CRM listando produtos terceirizáveis com filtros, busca, comparação de preço Scan vs preço venda Croma. Item no menu lateral.

### Tasks

1. **Roteamento**: rota `/terceirizacao` em `src/App.tsx` (ou onde estiver o router).
2. **Página**: `src/pages/Terceirizacao/TerceirizacaoPage.tsx`.
3. **Subcomponentes**:
   - `TerceirizacaoFilters.tsx` — Select fornecedor (preparado pra mais), Select categoria (10), Input busca debounced.
   - `TerceirizacaoCardGrid.tsx` — grid responsivo de cards.
   - `TerceirizacaoProductCard.tsx` — nome, badge categoria, preço Scan, preço venda Croma com diferença em % e R$, prazo, link externo pra origem (Scan).
   - `TerceirizacaoDetailDrawer.tsx` — abre ao clicar; mostra tudo + faixas (Fase 2) + variações (Fase 3) + descrição (Fase 4).
   - `TerceirizacaoEmptyState.tsx` — quando filtro retorna 0.
4. **Hook**: `src/hooks/useTerceirizacaoCatalogo.ts` — fetch via `@/integrations/supabase/client`. Aceita `{ fornecedorId?, categoria?, search? }`.
5. **Menu lateral**: item "Terceirização" em `Sidebar.tsx`. Ícone `Truck` ou `Network` do lucide-react. Posição: depois de Produtos, antes de Estoque.
6. **Permissão**: `ProtectedRoute` + roles `admin`, `gerencia`, `comercial`.

### Query base

```ts
const { data, error } = await supabase
  .from('terceirizacao_catalogo')
  .select(`
    id, categoria, nome, cores, material, revestimento, acabamento, extras,
    prazo, preco_info, preco_texto, preco_valor, preco_unidade,
    markup_aplicado, preco_venda, url, capturado_em,
    fornecedores!inner(id, razao_social, nome_fantasia)
  `)
  .eq('ativo', true)
  .order('categoria')
  .order('nome');
```

### Acceptance
- [ ] `/terceirizacao` carrega sem erro.
- [ ] 146 produtos listados com paginação (50/página) ou virtualização.
- [ ] Filtro por categoria (10 opções) funciona.
- [ ] Busca por nome debounced 300 ms.
- [ ] Card mostra Scan vs Venda lado a lado, badge `+40%`.
- [ ] Estado vazio amigável.
- [ ] Item no menu, navegação funcional.
- [ ] Sem warnings TypeScript.

### Estimativa: 60–90 min

---

## Fase 2 — Scraping de faixas de quantidade

### Goal
Capturar a tabela de descontos por volume de cada produto (ex: placa imobiliária — Acima de 1 = R$ 17, Acima de 10 = R$ 16, Acima de 19 = R$ 15, Acima de 64 = R$ 14,50, Acima de 100 = R$ 14, Acima de 201 = R$ 13,50).

### Discovery já feito
- Calculadora client-side: `total = largura(m) × altura(m) × valor_metro × qtd`.
- Faixas aparecem só em produtos tipo "cada".
- Cookie autenticado da Viviane (#4055) é necessário pra ver preços.
- Prefixo URL: `https://www.revendascan.com.br/produto/{slug}`.

### Tasks

1. **Migration**:

```sql
CREATE TABLE IF NOT EXISTS public.terceirizacao_catalogo_faixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogo_id uuid NOT NULL REFERENCES public.terceirizacao_catalogo(id) ON DELETE CASCADE,
  qtd_min int NOT NULL,
  preco_unitario numeric(12,2) NOT NULL,
  preco_unitario_com_markup numeric(12,2) GENERATED ALWAYS AS
    (ROUND(preco_unitario * (1 + COALESCE(
      (SELECT markup_aplicado FROM public.terceirizacao_catalogo WHERE id = catalogo_id), 40
    ) / 100), 2)) STORED,
  capturado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(catalogo_id, qtd_min)
);
CREATE INDEX idx_catalogo_faixas_catalogo ON public.terceirizacao_catalogo_faixas(catalogo_id);
ALTER TABLE public.terceirizacao_catalogo_faixas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "faixas_select_authenticated" ON public.terceirizacao_catalogo_faixas FOR SELECT TO authenticated USING (true);
CREATE POLICY "faixas_all_authenticated" ON public.terceirizacao_catalogo_faixas FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

> Nota: GENERATED com subquery pode não funcionar em todas as versões do Postgres. Plano B: trigger `BEFORE INSERT/UPDATE` que calcula.

2. **Discovery do HTML**: abrir `/produto/placa-imobiliaria-40x60cm-poliondas-4x0-8591` (Junior já validou que tem 6 faixas) e identificar onde fica a tabela de faixas no HTML estático.

3. **Script** `scripts/scan/scrape_faixas.ts` (ou Python via Cowork autenticado):
   - Para cada URL no catálogo, fetch com cookies autenticados.
   - Parse padrão `Acima de N = R$ X,YY`.
   - UPSERT em `terceirizacao_catalogo_faixas`.
   - Rate limit 500 ms. Total ~75s.
   - Log progresso a cada 20 produtos.

4. **Frontend**: no `TerceirizacaoDetailDrawer`, exibir tabela faixas (qtd_min, preço unitário, preço com markup, total estimado).

### Acceptance
- [ ] Tabela criada.
- [ ] ≥ 80% dos produtos "cada" com ≥ 1 faixa.
- [ ] Drawer renderiza tabela de faixas.

### Estimativa: 90 min

---

## Fase 3 — Scraping de variações (cores, revestimentos, opções)

### Goal
Capturar variações por produto: `<input name="var[revestimento]" value="N">`, `<input name="var[opcao]" value="N">`, etc.

### Discovery já feito
- Radios estão no formulário `addCarrinho`.
- Labels legíveis em `<label>` adjacentes.
- Quantidade típica: 0–4 variações por tipo, por produto.

### Tasks

1. **Migration**:

```sql
CREATE TABLE IF NOT EXISTS public.terceirizacao_catalogo_variacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogo_id uuid NOT NULL REFERENCES public.terceirizacao_catalogo(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('cor','revestimento','opcao','outro')),
  valor_id text NOT NULL,
  rotulo text NOT NULL,
  modificador_preco numeric(12,2),
  capturado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(catalogo_id, tipo, valor_id)
);
CREATE INDEX idx_catalogo_variacoes_catalogo ON public.terceirizacao_catalogo_variacoes(catalogo_id);
ALTER TABLE public.terceirizacao_catalogo_variacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "variacoes_select_authenticated" ON public.terceirizacao_catalogo_variacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "variacoes_all_authenticated" ON public.terceirizacao_catalogo_variacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

2. **Script** parseia cada página, captura `var[*]` + label associado.

3. **Frontend**: chips agrupados por tipo no Drawer.

### Acceptance
- [ ] Tabela criada.
- [ ] ≥ 50% dos produtos com 1+ variação.
- [ ] Drawer renderiza variações.

### Estimativa: 60 min

---

## Fase 4 — Descrições técnicas resumidas

### Goal
Cada produto com descrição factual curta (3–5 frases), em palavras próprias da Croma — não reproduzir prosa de marketing.

### Tasks

1. Migration: `ALTER TABLE public.terceirizacao_catalogo ADD COLUMN IF NOT EXISTS descricao text;`
2. Script identifica seção técnica em cada página (após título, antes da calculadora).
3. Extrai dados factuais: material, gramatura, finalidade, cuidados.
4. Resume em 3–5 frases curtas, sem reproduzir frases inteiras.
5. Frontend: Drawer mostra descrição.

### Acceptance
- [ ] Coluna populada para 100% dos produtos.
- [ ] Drawer exibe descrição.

### Estimativa: 60 min

---

## Fase 5 — Integração com orçamento Mubisys (Caminho C)

### Goal
Vendedor monta orçamento → sistema sugere automaticamente "alternativa terceirizada Scan" quando faz sentido (máquina ocupada, custo interno alto, prazo apertado).

### Discovery a fazer

- Tela de orçamento atual: `src/pages/Propostas/` ou `src/pages/Orcamentos/` (verificar).
- Hook que calcula custo Croma (Mubisys: `materiais` + `produto_modelos` + `regras_precificacao`).
- Status de máquina: `public.maquinas` — verificar campo `em_manutencao` ou similar.

### Tasks

1. **Mapeamento Croma↔Scan** — função SQL `sugerir_terceirizacao(produto_croma_id uuid, medidas jsonb, qtd int)`:
   - Recebe produto da Croma + medidas + quantidade.
   - Busca em `terceirizacao_catalogo` por categoria/material compatíveis.
   - Considera faixas de quantidade (se aplicável).
   - Retorna candidatos ranqueados por preço.

2. **View `vw_terceirizacao_alternativas`** — junta `produtos` Croma com `terceirizacao_catalogo` por categoria/material similar (LIKE/ILIKE).

3. **Card "Alternativa de fornecimento"** no orçamento. Mostra:
   - Custo Scan + markup → preço venda comparável.
   - Prazo Scan vs prazo Croma.
   - Aviso "máquina X em manutenção" se aplicável.
   - Botão "usar este fornecedor" → marca o item como terceirizado.

4. **Trigger de destaque**: quando `maquinas.em_manutencao = true` para máquina-chave do produto, card fica destacado (border azul, badge "recomendado agora").

5. **Snapshot no `proposta_itens`**:
   - Adicionar colunas: `fornecedor_id uuid`, `terceirizado boolean DEFAULT false`, `terceirizacao_catalogo_id uuid`, `preco_terceirizacao_snapshot numeric`.
   - Quando vendedor escolhe terceirizar, gravar snapshot do preço Scan no momento.
   - Snapshot é importante porque preço Scan muda; o snapshot trava o que foi cotado.

6. **Pedido de compra automático**: quando proposta vira pedido e tem itens marcados como `terceirizado`, gerar `pedido_compra` com fornecedor=Scan.

### Acceptance
- [ ] Função `sugerir_terceirizacao()` retorna ≥ 1 candidato pra produtos Croma com equivalente.
- [ ] Card de alternativa aparece no orçamento.
- [ ] Vendedor consegue marcar item como terceirizado.
- [ ] Snapshot é gravado em `proposta_itens`.
- [ ] Quando proposta vira pedido, pedido de compra é gerado pra Scan.

### Estimativa: 2–3h

---

## Fase 6 — Re-scrape automático semanal + alertas

### Goal
Catálogo Scan se mantém atualizado sem intervenção manual; Junior recebe alerta no Telegram quando preços sobem.

### Tasks

1. **Scheduled task** (segunda-feira, 6h):
   - Rodar `scrape_catalogo_completo.py` (já validado nesta sessão).
   - Comparar `preco_valor` antigo vs novo por produto.
   - Atualizar `capturado_em`.
   - Recalcular `preco_venda` via `recalcular_preco_venda_terceirizacao()`.

2. **Tabela de auditoria**:

```sql
CREATE TABLE IF NOT EXISTS public.terceirizacao_catalogo_auditoria_preco (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogo_id uuid REFERENCES public.terceirizacao_catalogo(id) ON DELETE CASCADE,
  preco_anterior numeric(12,2),
  preco_novo numeric(12,2),
  variacao_pct numeric(7,2),
  detectado_em timestamptz NOT NULL DEFAULT now()
);
```

3. **Alerta Telegram** (chat_id `1065519625` — Junior):
   - Variação ≥ +10%: alerta "alta de preço" com lista dos produtos.
   - Variação ≤ -10%: aviso "redução" (oportunidade).
   - Produto sumido do catálogo: alerta "produto descontinuado".
   - Produto novo no catálogo: aviso "novo item disponível na Scan".

4. **Cookie da Viviane**: documentar processo de renovação em `Obsidian/30-Conhecimento/Processos/scan-renovar-cookie.md` (pegar via DevTools → guardar em Supabase Vault ou env var, com TTL alerta).

### Acceptance
- [ ] Scheduled task ativa, rodou pelo menos 1 ciclo.
- [ ] Auditoria de preços populada.
- [ ] Alerta no Telegram entregue em pelo menos 1 evento de teste (alta forçada).
- [ ] Processo de renovação de cookie documentado.

### Estimativa: 2h

---

## Fase 7 — Multi-fornecedor (preparar pra escala)

### Goal
Estrutura pronta pra adicionar outros parceiros de terceirização sem refatoração.

### Tasks

1. **Auditoria** dos 13 fornecedores existentes em `public.fornecedores`:
   - Marcar quais são parceiros de terceirização (categorias inclui `terceirizacao`).
   - Marcar quais são fornecedores de matéria-prima (categorias diferentes).
   - Coluna `tipo_relacao text CHECK (tipo_relacao IN ('materia_prima','terceirizacao','ambos'))`.

2. **Frontend `/terceirizacao`** — Select de fornecedor pré-existe; só popular dinamicamente.

3. **Documentar template** de onboarding de novo fornecedor parceiro:
   - Cadastrar em `fornecedores`
   - Importar catálogo (script reutilizável adaptado)
   - Definir markups por categoria
   - Aparece automaticamente em `/terceirizacao`

4. **Criar processo Obsidian**: `Obsidian/30-Conhecimento/Processos/onboard-parceiro-terceirizacao.md`.

### Acceptance
- [ ] `tipo_relacao` populado nos 13 fornecedores existentes.
- [ ] Documento de onboarding criado.
- [ ] Frontend mostra Select com 1+ fornecedor.

### Estimativa: 60 min

---

## Fase 8 — Fiscal e operacional

### Goal
Resolver perguntas práticas que surgem quando a Croma revende serviço da Scan: NF, recebimento, conferência, comunicação ao cliente, retrabalho.

### Tasks

1. **Modelo fiscal de revenda**:
   - Verificar com contador: a Croma emite NF própria pra cliente final? (provavelmente sim, com base na regra do Simples).
   - Documentar CFOP usado para revenda (geralmente 5102 ou 5403 dependendo do caso).
   - Anexar política em `Obsidian/30-Conhecimento/Fiscal/revenda-terceirizacao.md`.
   - Conferir como fica a NF da Scan que entra (entrada — CFOP 1102 / 1403).

2. **Recebimento**: ao receber mercadoria da Scan, fluxo no CRM:
   - Pedido de compra com fornecedor=Scan já existe (gerado na Fase 5).
   - Recebimento conferido em `public.recebimentos` (tabela já existe).
   - Vincular ao pedido do cliente final.

3. **SLA de comunicação ao cliente**:
   - Política: comunicar prazo somando prazo Scan + 1 dia de buffer (transporte interno + conferência).
   - Template Telegram pronto pra enviar ao cliente quando atraso na Scan acontecer.

4. **Retrabalho**: quando cliente reclama de produto vindo da Scan:
   - Registro em `public.ocorrencias` com `tipo='terceirizacao'` e `fornecedor_id`.
   - Decisão: refazer interno, devolver pra Scan, ou aceitar?
   - Histórico ajuda decidir manter ou trocar de fornecedor.

5. **Política de pagamento Croma → Scan**:
   - Saldo de crédito no portal (preferido — sem boleto).
   - Cartão 1x ou 2x sem juros (até R$ 500).
   - Documentar em `Obsidian/30-Conhecimento/Processos/pagamento-scan.md`.

6. **Dados bancários da Scan** — verificar no portal e documentar:
   - PIX (CNPJ 11.247.686/0001-36).
   - Conta bancária (se houver depósito).

### Acceptance
- [ ] Política fiscal documentada (`revenda-terceirizacao.md`).
- [ ] Fluxo de recebimento mapeado.
- [ ] Template SLA pronto.
- [ ] Processo de retrabalho definido.
- [ ] Política de pagamento documentada.
- [ ] Dados bancários Scan registrados.

### Estimativa: 2h (mais conversa com contador que código)

---

## Fase 9 — BI e analytics

### Goal
Visualização do uso da terceirização ao longo do tempo. Quanto a Croma gasta com terceirização? Em quais categorias? Em quais momentos (Targa em manutenção, picos de demanda)?

### Tasks

1. **View** `vw_terceirizacao_uso_mensal`:

```sql
CREATE OR REPLACE VIEW public.vw_terceirizacao_uso_mensal AS
SELECT
  DATE_TRUNC('month', p.created_at) AS mes,
  pi.fornecedor_id,
  f.razao_social,
  tc.categoria,
  COUNT(*) AS qtd_itens,
  SUM(pi.preco_terceirizacao_snapshot) AS custo_total,
  SUM(pi.valor_total) AS receita_total,
  SUM(pi.valor_total - pi.preco_terceirizacao_snapshot) AS lucro_total
FROM public.proposta_itens pi
JOIN public.propostas p ON p.id = pi.proposta_id
LEFT JOIN public.fornecedores f ON f.id = pi.fornecedor_id
LEFT JOIN public.terceirizacao_catalogo tc ON tc.id = pi.terceirizacao_catalogo_id
WHERE pi.terceirizado = true
GROUP BY 1, 2, 3, 4
ORDER BY mes DESC, custo_total DESC;
```

2. **Dashboard `/terceirizacao/analytics`**:
   - Cards: total terceirizado mês, lucro médio, fornecedor mais usado.
   - Gráfico: uso ao longo do tempo (linha).
   - Top 10 produtos terceirizados.
   - Comparativo: período com Targa XT em manutenção vs operacional.

3. **Alerta**: quando uso de terceirização passa de X% do faturamento mensal, alerta no Telegram (sinal de que máquinas internas precisam atenção).

### Acceptance
- [ ] View criada.
- [ ] Dashboard funcional com dados reais (após Fase 5 popular `proposta_itens.terceirizado`).
- [ ] Alerta configurado.

### Estimativa: 90 min

---

## Fase 10 — Documentação final e protocolo de fim de sessão

### Goal
Tudo registrado conforme regras CLAUDE.md, sem deixar dívida de documentação.

### Tasks

1. **STATE.md do CRM-Croma**: atualizar com:
   - O que foi feito nesta sessão (todas as Fases concluídas).
   - Qual a próxima ação prioritária.
   - Blockers se houver.

2. **memory.md do vault Obsidian** (`99-Meta/memory.md`): inserir bloco da sessão NO TOPO. Formato:

```
## YYYY-MM-DD — Sessão Sonnet (terceirizacao-fase-X)
- O que foi feito (3-5 bullets curtos)
- Decisões importantes
- Próxima ação
```

3. **Daily note** (`01-Daily/YYYY-MM-DD.md`): criar/atualizar com resumo da sessão.

4. **Decisões importantes** → `10-Projetos/Croma-Print/decisoes/YYYY-MM-DD-{slug}.md`.
   Ex: "decisão de markup diferenciado por categoria", "decisão de Caminho A + C combinados".

5. **Aprendizados** → `10-Projetos/Croma-Print/aprendizados/YYYY-MM-DD-{slug}.md`.
   Ex: "calculadora Scan é client-side", "site exige login pra ver preço".

6. **Processos novos** → `30-Conhecimento/Processos/`:
   - `scan-renovar-cookie.md`
   - `pagamento-scan.md`
   - `onboard-parceiro-terceirizacao.md`
   - `recebimento-terceirizacao.md`

7. **Atualizar `Parceiros/scan-revenda.md`**: marcar como concluídas as Fases que foram feitas.

8. **REQUIREMENTS.md** do CRM-Croma: marcar requirements relacionados como `[x]` quando completados.

9. **Avisar Junior**: mensagem curta listando o que foi entregue + link pro dashboard.

### Acceptance
- [ ] STATE.md atualizado.
- [ ] memory.md com bloco no topo.
- [ ] Daily note criada/atualizada.
- [ ] Decisões e aprendizados registrados.
- [ ] 4 processos criados em Obsidian.
- [ ] scan-revenda.md atualizado.
- [ ] Junior avisado no fim.

### Estimativa: 30 min

---

## Checklist consolidado

**Mínimo viável (Fase 1) — ~1h30**
- [ ] Bootstrap (ler arquivos)
- [ ] Rota `/terceirizacao` no router
- [ ] Hook `useTerceirizacaoCatalogo`
- [ ] Página com filtros, busca, cards
- [ ] Item no menu lateral
- [ ] Smoke test em dev server
- [ ] Atualizar STATE.md

**Catálogo enriquecido (Fases 2+3+4) — ~+3h30**
- [ ] Tabelas faixas + variações + coluna descricao (migrations)
- [ ] 3 scripts de scraping rodados
- [ ] Drawer renderizando os 3
- [ ] Atualizar Obsidian

**Integração estratégica (Fase 5) — ~+2-3h**
- [ ] Função `sugerir_terceirizacao()`
- [ ] Card de alternativa no orçamento
- [ ] Trigger por status de máquina
- [ ] Snapshot no `proposta_itens`
- [ ] Pedido de compra automático

**Automação (Fase 6) — ~+2h**
- [ ] Scheduled task semanal
- [ ] Auditoria de preços
- [ ] Alerta Telegram
- [ ] Renovação de cookie documentada

**Escala (Fase 7) — ~+1h**
- [ ] `tipo_relacao` em fornecedores
- [ ] Processo onboard de novo parceiro

**Operacional (Fase 8) — ~+2h**
- [ ] Fiscal documentado
- [ ] Recebimento mapeado
- [ ] SLA template
- [ ] Política de pagamento
- [ ] Dados bancários

**BI (Fase 9) — ~+1h30**
- [ ] View de uso mensal
- [ ] Dashboard `/terceirizacao/analytics`
- [ ] Alerta de % do faturamento

**Documentação (Fase 10) — ~+30min**
- [ ] STATE, memory, daily, decisões, aprendizados, processos, REQUIREMENTS

**Total: 12–16h** distribuído em 2–3 sessões (recomendo Sessão 1: Fases 1–4; Sessão 2: Fases 5–6; Sessão 3: Fases 7–10).

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Scan mudar HTML do site, quebrar scraping | Fase 6: re-scrape semanal detecta drop de captura, alerta Telegram |
| Faixas não estarem em HTML estático | Fallback: bater na calculadora AJAX produto-a-produto (lento mas funciona) |
| Cookie da Viviane expirar | Fase 6: documentar renovação em processo Obsidian |
| Misturar conceitos (produtos Croma vs Scan) | Tabelas separadas + páginas separadas + permissão por role |
| Vendedor terceirizar sem necessidade | Fase 5: card só aparece quando custo Croma > X ou máquina em manutenção |
| Snapshot de preço fica desatualizado | Fase 5: snapshot trava no momento do orçamento; re-cotação manual se proposta envelhecer |
| Cliente reclamar de qualidade Scan | Fase 8: ocorrência registrada; histórico decide manter ou trocar fornecedor |
| Concorrência fiscal (Croma como revendedora) | Fase 8: validar CFOP correto com contador antes de emitir NF |
| Multa LGPD por uso de dados de terceiros | Não armazenar dados de clientes de outros fornecedores; só catálogo de produtos é factual e público |

---

## Dependências externas

- **Conta da Viviane na Scan ativa** — sessão atual usa cookies dela; alternativa é criar conta de API se a Scan oferecer.
- **Contador Croma** — pra confirmar CFOP correto na Fase 8.
- **Acesso ao Telegram bot Claudete** (chat_id 1065519625, token guardado em env) — Fase 6.
- **Supabase scheduled functions habilitadas** — Fase 6.
- **Permissões de roles configuradas** — `comercial` deve poder ver `/terceirizacao`; `admin` pode editar markups.

---

## Notas para o(a) próximo(a) Claude

- Junior tem TDAH, autonomia máxima é regra de ouro: **faça e avise depois**, só pede confirmação para gastos > R$ 500 ou alterações de schema impactantes.
- Mensagens curtas e diretas. Lembretes proativos. Idioma SEMPRE pt-BR.
- Antes de afirmar "MCP Croma offline" → testar com `croma_health_check` (ver CLAUDE.md do CRM-Croma).
- Ao final de cada sessão: protocolo de fim obrigatório (Fase 10).
- Trabalhar Fase a Fase, fechar uma antes de começar a próxima.
- Smoke test em dev server depois de cada Fase frontend.
- Não reproduzir prosa de marketing do site da Scan; só dados factuais (specs, dimensões, preços).

---

## Referências

- Site: https://www.revendascan.com.br
- Conta Croma no portal: cadastro #4055
- Página parceiro: `C:\Users\Caldera\Obsidian\JARVIS\30-Conhecimento\Parceiros\scan-revenda.md`
- Dados fonte: `C:\Users\Caldera\Claude\JARVIS\parceiros\scan-revenda\catalogo_final.json`
- Excel referência: `C:\Users\Caldera\Claude\JARVIS\parceiros\scan-revenda\scan-catalogo.xlsx`
- Daily da sessão de discovery: `C:\Users\Caldera\Obsidian\JARVIS\01-Daily\2026-04-24.md`
