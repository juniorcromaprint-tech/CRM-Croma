# AUDITORIA COMPLETA — MÓDULO DE ORÇAMENTOS
> **Auditado por**: 6 agentes especializados | **Data**: 2026-03-10 | **Status**: Pronto para implementação

---

## Índice
1. [Resumo Executivo](#1-resumo-executivo)
2. [Estado Atual do Módulo](#2-estado-atual-do-módulo)
3. [Bugs Críticos](#3-bugs-críticos)
4. [Inconsistências de Nomenclatura](#4-inconsistências-de-nomenclatura)
5. [Problemas de Modelagem](#5-problemas-de-modelagem)
6. [Problemas de Persistência](#6-problemas-de-persistência)
7. [Problemas de UX](#7-problemas-de-ux)
8. [Problemas de Integração](#8-problemas-de-integração)
9. [Problemas de Regra de Negócio](#9-problemas-de-regra-de-negócio)
10. [Código Morto / Não Utilizado](#10-código-morto--não-utilizado)
11. [Score por Área](#11-score-por-área)
12. [Proposta de Arquitetura Final](#12-proposta-de-arquitetura-final)

---

## 1. Resumo Executivo

O módulo de orçamentos da Croma Print tem **fundação sólida** (motor Mubisys completo, estrutura de tabelas bem projetada, hooks organizados) mas é **bloqueado por 3 problemas sistêmicos**:

### Os 3 Bloqueadores Raiz

| # | Bloqueador | Impacto |
|---|---|---|
| **B1** | Migration 006 nunca executada | 7 tabelas críticas não existem. Materiais, acabamentos, serviços, regras e templates = inoperantes |
| **B2** | Cálculo de quantidade duplicado | Preços de itens com quantidade > 1 estão inflados ao quadrado (`preço = unitário × qtd²`) |
| **B3** | Catálogo de produtos é 100% mock | `src/pages/Produtos.tsx` usa `useState(MOCK_PRODUTOS)`, nunca toca Supabase. CRUD não persiste nada |

### Resultado Prático

```
O que o usuário vê:         O que realmente acontece:
"Sistema de precificação"   Cálculo em memória funciona, mas componentes
completo com materiais,     (materiais/acabamentos/processos) se perdem ao
acabamentos e Mubisys       salvar. Reabre o orçamento = só descrição + preço.
```

---

## 2. Estado Atual do Módulo

### Inventário de Arquivos Auditados

| Arquivo | Linhas | Status Real |
|---|---|---|
| `src/shared/services/pricing-engine.ts` | 406 | ✅ Motor Mubisys real, 2 bugs de cálculo |
| `src/shared/services/orcamento-pricing.service.ts` | 185 | ⚠️ Bridge com bugs de quantidade e acabamentos |
| `src/domains/comercial/services/orcamento.service.ts` | 583 | ⚠️ CRUD real mas silencia erros das tabelas 006 |
| `src/domains/comercial/hooks/useOrcamentos.ts` | 165 | ⚠️ Hooks OK, mas recálculo de totais no componente |
| `src/domains/comercial/hooks/useTemplates.ts` | 219 | ❌ 100% inoperante (tabela não existe) |
| `src/domains/comercial/hooks/useOrcamentoPricing.ts` | 103 | ⚠️ Config funciona, regras não existem |
| `src/domains/comercial/hooks/useProdutosModelos.ts` | 145 | ⚠️ Leitura OK, zero hooks de mutação |
| `src/domains/comercial/pages/OrcamentoEditorPage.tsx` | 829 | ⚠️ Calculado em memória, persiste incompleto |
| `src/domains/comercial/pages/OrcamentosPage.tsx` | ~400 | ✅ Lista funciona |
| `src/domains/comercial/pages/OrcamentoViewPage.tsx` | ~350 | ✅ Visualização OK |
| `src/domains/comercial/pages/TemplatesPage.tsx` | ~300 | ❌ Inoperante (tabela não existe) |
| `src/pages/Produtos.tsx` | ~400 | ❌ 100% mock, dados não persistem |
| `src/domains/admin/pages/AdminPrecificacaoPage.tsx` | 872 | ⚠️ Funcional mas schema incompatível com 006 |
| `src/domains/pedidos/pages/PedidosPage.tsx` | ~900 | ⚠️ Bug margem, detalhe é placeholder |

### Status das Migrations

| Migration | Status | Impacto |
|---|---|---|
| `001_complete_schema.sql` | ✅ Executada | Base sólida |
| `002_schema_corrections.sql` | ✅ Executada | RLS, audit, índices |
| `006_orcamento_module.sql` | ❌ **NÃO EXECUTADA** | **7 tabelas ausentes** |

---

## 3. Bugs Críticos

### 🔴 BUG-01 — Preço calculado com quantidade ao quadrado
**Arquivo**: `orcamento-pricing.service.ts:109` + `pricing-engine.ts:253`
**Severidade**: CRÍTICO — afeta todos os itens com quantidade > 1

```typescript
// pricing-engine.ts linha 253 — já multiplica por quantidade:
precoVenda = precoVendaUnitario * quantidade  // ex: 50 * 3 = 150

// orcamento-pricing.service.ts linha 109 — multiplica DE NOVO:
const precoTotal = pricingResult.precoVenda * quantidade  // 150 * 3 = 450 ← ERRADO
// correto seria: 50 * 3 = 150
```

**Fix**: O `calcPricing` deve sempre retornar o preço unitário. A multiplicação por quantidade deve ocorrer apenas na camada de orçamento.

---

### 🔴 BUG-02 — Acabamentos contabilizados duas vezes
**Arquivo**: `orcamento-pricing.service.ts:81-113`
**Severidade**: CRÍTICO — custos de acabamento inflados

```typescript
// O que acontece:
// 1. Acabamentos são SOMADOS aos materiais antes de entrar no motor (linha 92)
// 2. Motor Mubisys aplica P%, MO, Pv, markup sobre o total materiais+acabamentos
// 3. Depois calcula acabamentos brutos separado (linha 104)
// 4. Tenta "descontar" subtraindo o bruto do MP (linha 113):
custoMP: pricingResult.custoMP - custosAcabamentos  // ERRADO
// O motor já calculou juros/overhead/markup sobre os acabamentos
// Subtrair apenas o bruto não desfaz a cascata. custoMP fica subestimado.
```

**Fix**: Separar materiais e acabamentos como inputs distintos no motor. Calcular cada grupo independentemente e somar no final.

---

### 🔴 BUG-03 — Migration 006 não executada: 7 tabelas ausentes
**Severidade**: CRÍTICO — metade do módulo é inoperante

Tabelas que não existem no banco:
```
acabamentos                  → AcabamentoSelector retorna vazio
servicos                     → ServicoSelector retorna vazio
proposta_item_materiais      → materiais silenciosamente não salvos
proposta_item_acabamentos    → acabamentos silenciosamente não salvos
proposta_servicos            → serviços silenciosamente não salvos
regras_precificacao          → markup sugerido sempre null
templates_orcamento          → TemplatesPage inoperante
```

**Agravante**: O código usa `try/catch` silencioso para não quebrar. O usuário não vê erro — mas os dados se perdem sem aviso.

---

### 🟠 BUG-04 — `margem_percentual` vs `margem_real` em PedidosPage
**Arquivo**: `src/domains/pedidos/pages/PedidosPage.tsx:66,859`
**Severidade**: ALTA — margem sempre exibe 0%

```typescript
// Interface local (errada):
interface PedidoRow { margem_percentual: number }  // ← não existe no banco

// Banco tem:
pedidos.margem_real  // ← campo correto

// Resultado: PedidosPage.tsx linha 859 exibe:
{selectedPedido.margem_percentual?.toFixed(1)}%  // → "undefined%" → 0%
```

---

### 🟠 BUG-05 — `servicos.categoria` tem default inválido no schema 006
**Arquivo**: `supabase/migrations/006_orcamento_module.sql`
**Severidade**: ALTA — qualquer INSERT sem categoria explícita vai falhar

```sql
-- Migration 006 define:
categoria TEXT DEFAULT 'servico'  -- default = 'servico'
CHECK (categoria IN ('criacao', 'instalacao', 'montagem', 'transporte', 'consultoria', 'outro'))
-- 'servico' NÃO está no CHECK → viola constraint → INSERT falha
```

---

### 🟠 BUG-06 — AdminPrecificacaoPage incompatível com schema da migration 006
**Arquivo**: `src/domains/admin/pages/AdminPrecificacaoPage.tsx:44-65`
**Severidade**: ALTA — vai quebrar quando migration 006 for executada

```typescript
// O que AdminPrecificacaoPage espera da tabela regras_precificacao:
{ id, categoria, markup_minimo, markup_sugerido, descricao, ativo }

// O que migration 006 define na tabela regras_precificacao:
{ id, nome, categoria, tipo, valor, ativo }
// onde tipo IN ('markup_minimo', 'markup_padrao', 'desconto_maximo', 'preco_m2_minimo', 'taxa_urgencia')
```

---

### 🟡 BUG-07 — Markup do Passo 8 inflado artificialmente
**Arquivo**: `pricing-engine.ts:244`
**Severidade**: MÉDIA — markup efetivo é sempre maior que o solicitado

```typescript
// Passo 8 atual:
Vm = (Vam * markup/100) / (1 - Pv)
// Problema: Vam já incorporou Pv (Passo 7). Dividir por (1-Pv) de novo infla.
// Se usuário pede 40% markup, o markup efetivo sobre Vam é ~47-50%

// Correto deveria ser:
Vm = Vam * (markup / 100)
```

---

### 🟡 BUG-08 — Race condition na geração de números sequenciais
**Arquivo**: `orcamento.service.ts:270-276` e `PedidosPage.tsx:131-135`
**Severidade**: MÉDIA — pode gerar números duplicados em concorrência

```typescript
// Padrão problemático:
const count = await supabase.from("propostas").select("*", { count: "exact" })
const numero = `PROP-${year}-${String((count || 0) + 1).padStart(4, "0")}`
// Se 2 usuários criam ao mesmo tempo → count igual → número duplicado
// Banco tem UNIQUE no campo numero → vai falhar com erro para um deles

// A trigger automática do banco (gerar_numero_auto) já resolve isso
// O código deveria confiar na trigger, não gerar o número manualmente
```

---

## 4. Inconsistências de Nomenclatura

### "Proposta" vs "Orçamento" — Dois nomes para a mesma coisa

| Contexto | Nome Usado | Correto? |
|---|---|---|
| Tabela SQL | `propostas` | ✅ nome da entidade no banco |
| Tipo TypeScript | `Orcamento`, `OrcamentoItem` | ⚠️ inconsistente com banco |
| Service | `orcamento.service.ts` → `orcamentoService` | ⚠️ |
| Hook | `useOrcamentos()` | ⚠️ |
| URL | `/orcamentos` | ✅ (UX term, OK) |
| Coluna FK | `proposta_id` em pedidos | ✅ |
| Coluna FK | `proposta_item_id` em pedido_itens | ✅ |

**Decisão recomendada**: Manter `propostas` no banco (sem rename). No frontend, usar `orcamento` como UX term (URL, labels, títulos). Nos services/hooks, usar `orcamento` como padrão. **Não trocar** — o banco não muda.

### Campos com nomes duplos

| Conceito | Variações encontradas | Padrão a adotar |
|---|---|---|
| Preço total do item | `preco_total`, `valor_total` | `valor_total` (alinhado com banco) |
| Margem do pedido | `margem_percentual`, `margem_real` | `margem_real` (nome do banco) |
| Custo de material | `custo_mp`, `custoMP`, `custoMp` | `custo_mp` (snake_case, banco) |
| Área | `area_m2`, `areaM2`, `area` | `area_m2` (banco) |

---

## 5. Problemas de Modelagem

### M1 — `proposta_itens` não tem `modelo_id`
A tabela `proposta_itens` referencia `produto_id` mas **não tem `modelo_id`**. Isso significa:
- Não é possível saber qual modelo foi usado ao gerar um item
- Ao reabrir o orçamento, ProdutoSelector não consegue pré-selecionar o modelo
- A rastreabilidade item → modelo → materiais padrão é perdida

**Solução**: Adicionar `modelo_id UUID REFERENCES produto_modelos(id) ON DELETE SET NULL` à tabela.

### M2 — `pedido_itens` não tem campos técnicos de custeio
A tabela `pedido_itens` tem apenas: `descricao`, `especificacao`, `quantidade`, `unidade`, `valor_unitario`, `valor_total`, `status`, `arte_url`, `instrucoes`.

Campos ausentes necessários para rastreabilidade de custo:
```sql
custo_mp           NUMERIC(12,2)  -- custo de matéria-prima
custo_mo           NUMERIC(12,2)  -- custo de mão de obra
custo_fixo         NUMERIC(12,2)  -- custo fixo rateado
markup_percentual  NUMERIC(5,2)   -- markup aplicado
largura_cm         NUMERIC(10,2)  -- dimensão
altura_cm          NUMERIC(10,2)  -- dimensão
area_m2            NUMERIC(10,4)  -- área calculada
prazo_producao_dias INTEGER       -- prazo estimado
modelo_id          UUID           -- modelo usado
```

### M3 — `proposta_item_processos` não existe em nenhuma migration
O código de `orcamento.service.ts` e o `OrcamentoEditorPage` esperam persistir processos por item, mas não existe tabela para isso. Os processos (etapas produtivas) são definidos no modelo (`modelo_processos`) mas não são "instanciados" por item de proposta.

### M4 — Templates usam JSONB genérico (frágil)
`templates_orcamento.itens` é JSONB sem schema definido. Isso impede:
- Validação no banco
- Joins com produtos/modelos
- Migrações de schema

---

## 6. Problemas de Persistência

### P1 — Materiais/acabamentos por item se perdem ao salvar
**Causa raiz**: Migration 006 não executada + `try/catch` silencioso.

O que é salvo em `proposta_itens`:
- ✅ `descricao`, `quantidade`, `largura_cm`, `altura_cm`, `area_m2`
- ✅ `custo_mp`, `custo_mo`, `custo_fixo`, `markup_percentual`
- ✅ `valor_unitario`, `valor_total`
- ❌ Lista de materiais (proposta_item_materiais inexiste)
- ❌ Lista de acabamentos (proposta_item_acabamentos inexiste)

### P2 — `duplicar` perde materiais/acabamentos
`orcamento.service.ts:duplicar` usa `adicionarItem()` (versão simples) em vez de `adicionarItemDetalhado()`. Mesmo após migration 006 executada, a duplicação vai perder os materiais/acabamentos dos itens.

### P3 — `converterParaPedido` perde todos os dados de custeio
Ao criar `pedido_itens`, copia apenas descrição + valores. Perde: `custo_mp`, `custo_mo`, `custo_fixo`, `markup_percentual`, `largura_cm`, `altura_cm`, `area_m2`, `prazo_producao_dias`, `modelo_id`. O pedido fica "cego" sobre como o preço foi formado.

### P4 — Hooks não recalculam totais
`useAdicionarItemOrcamento`, `useAdicionarItemDetalhado`, `useRemoverItemOrcamento` não chamam `recalcularTotais`. A lógica de negócio está vazando para o componente `OrcamentoEditorPage` (violação de SRP).

---

## 7. Problemas de UX

### UX1 — Editor não restaura estado ao reabrir
Ao reabrir um orçamento para edição, o `OrcamentoEditorPage` não carrega os materiais/acabamentos dos itens existentes (porque não persistem). O painel de precificação fica vazio para itens já salvos.

### UX2 — Template aplica apenas o 1º item
`OrcamentoEditorPage:handleTemplateSelect` busca apenas `template.itens[0]`. Um template com 5 itens vai adicionar apenas 1.

### UX3 — Nenhum feedback quando save silencia erro
O `try/catch` em `adicionarItemDetalhado` silencia falhas de inserção em `proposta_item_materiais`. O usuário vê "salvo com sucesso" mas os materiais foram perdidos.

### UX4 — Página de Produtos é mock que parece real
`/produtos` exibe um CRUD completo com dados visualmente convincentes (12 produtos mockados). O usuário cria/edita produtos mas tudo se perde ao recarregar.

### UX5 — Detalhe de pedido é placeholder
`PedidosPage.tsx:958`: "O gerenciamento de itens será disponibilizado em breve". Pedido aprovado não mostra seus itens.

### UX6 — Nenhuma validação de margem mínima visível no editor
O motor tem `validarMarkup()` mas o editor não exibe alerta quando markup está abaixo do mínimo da categoria.

---

## 8. Problemas de Integração

### I1 — Orçamento → Pedido perde dados de custeio (ver P3 acima)

### I2 — Pedido → Produção é 100% manual
Não há automação: quando pedido muda para "em_producao", ordens de produção precisam ser criadas manualmente, uma por item. Não existe trigger, webhook ou automação.

### I3 — AdminPrecificacaoPage vai quebrar quando migration 006 executar
Os schemas são incompatíveis (ver BUG-06). Executar 006 sem corrigir o frontend vai quebrar a página de admin de precificação.

### I4 — `usePedidos` hook não é usado pela PedidosPage
`PedidosPage.tsx` duplica queries que já existem em `usePedidos.ts`. Dois lugares para manter.

---

## 9. Problemas de Regra de Negócio

### RN1 — Não existe validação de margem no fluxo de aprovação
Um orçamento pode ser enviado ao cliente com margem negativa sem nenhum alerta ou bloqueio.

### RN2 — Número de proposta gerado pelo frontend (race condition)
O banco tem um trigger `gerar_numero_auto()` para propostas, mas o service também tenta gerar o número no frontend. Deveria confiar apenas no trigger do banco.

### RN3 — `converterParaPedido` não registra `aprovado_por`
O campo `aprovado_por` fica `undefined` (null) no pedido criado. Não há auditoria de quem aprovou.

### RN4 — Status de `proposta_itens` não é atualizado com produção
Quando a ordem de produção de um item é concluída, o `proposta_itens.status` (e `pedido_itens.status`) não é atualizado. Não existe sincronização bidirecional.

---

## 10. Código Morto / Não Utilizado

| Função/Hook | Arquivo | Evidência de não-uso |
|---|---|---|
| `calcPrecoRapido()` | pricing-engine.ts:320 | Nenhum import em todo o codebase |
| `calcMargemReal()` | pricing-engine.ts:333 | Nenhum import |
| `calcBreakEven()` | pricing-engine.ts:369 | Nenhum import |
| `simularDesconto()` | pricing-engine.ts:388 | Nenhum import |
| `calcOrcamentoTotal()` | orcamento-pricing.service.ts:129 | Nenhum import |
| `useAdicionarItemOrcamento()` (simples) | useOrcamentos.ts:82 | Editor usa `DetalhAdo` |
| `useTemplate(id)` | useTemplates.ts:71 | Nenhum consumidor |
| `useAtualizarTemplate()` | useTemplates.ts:120 | Nenhum consumidor |
| `useExcluirTemplate()` | useTemplates.ts:144 | Nenhum consumidor |
| `pedido_historico` (tabela) | migration 001 | Tabela existe, nenhum insert no frontend |

---

## 11. Score por Área

| Área | Score | Motivo |
|---|---|---|
| Motor Mubisys (engine) | 7/10 | Fórmulas corretas, 2 bugs de cálculo |
| Bridge orçamento-pricing | 4/10 | Bugs críticos de quantidade e acabamentos |
| Serviço de orçamento (CRUD) | 6/10 | Funcional mas falhas silenciosas |
| Persistência de componentes | 2/10 | Migration 006 ausente = quase zero |
| Catálogo de produtos CRUD | 1/10 | 100% mock |
| Modelos/materiais/processos | 3/10 | Leitura OK, escrita zero |
| UX do editor | 5/10 | Calcula bem, não restaura estado |
| Conversão orçamento→pedido | 4/10 | Funciona, mas perde dados |
| Pedidos (listagem) | 6/10 | Funciona, bug de margem |
| Admin precificação | 6/10 | Funcional, schema incompatível com 006 |
| Templates | 1/10 | 100% inoperante |
| **TOTAL** | **4.1/10** | Base boa, implementação incompleta |

---

## 12. Proposta de Arquitetura Final

> Detalhada em [`PRICING_ARCHITECTURE.md`](PRICING_ARCHITECTURE.md)

### Princípio Central

> **Um item de orçamento deve ser tecnicamente rastreável e reproduzível.**
> Ao reabrir um orçamento, o sistema deve reconstruir completamente o cálculo original.

### Decisão de Nomenclatura

| Camada | Terminologia |
|---|---|
| Tabelas SQL | `propostas`, `proposta_itens` (não renomear) |
| UX / Labels / URLs | "Orçamento" (termo do negócio) |
| Services / Hooks | `orcamento` (manter padrão atual) |
| FK em outros módulos | `proposta_id` (manter para compatibilidade) |

### Stack de Migrations Necessárias

```
006_orcamento_module.sql     → Executar (corrigindo BUG-05: servicos.categoria)
007_orcamento_campos.sql     → Nova migration:
                               + proposta_itens.modelo_id
                               + pedido_itens: campos técnicos de custeio
                               + corrige regras_precificacao para schema do AdminPrecificacaoPage
```

### Prioridade de Implementação

```
P0 (Bloqueadores)       → BUG-01, BUG-02, BUG-03 (execute 006, fix engine)
P1 (Dados corretos)     → M1 (modelo_id), M2 (pedido_itens técnicos), BUG-06 (admin schema)
P2 (Catálogo real)      → Produtos CRUD real, modelos/materiais/processos
P3 (UX profissional)    → Editor restaura estado, templates completos, validação margem
P4 (Integração)         → converterParaPedido completo, automação producao
P5 (Documentação)       → PRICING_ENGINE.md, PRODUCT_CATALOG.md, DATA_MODEL_ORCAMENTO.md
```
