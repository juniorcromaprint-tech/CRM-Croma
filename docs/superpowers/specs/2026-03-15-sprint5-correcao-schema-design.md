# Sprint 5 — Correção de Schema Mismatches (Design Spec)

> **Data**: 2026-03-15 | **Status**: Aprovado
> **Abordagem**: Código segue o Banco (DB é source of truth)
> **Escopo**: Corrigir todos os mismatches entre frontend/triggers e o schema real do Supabase

---

## Contexto

Os módulos Compras, Estoque e Qualidade foram decompostos de monolitos em domínios estruturados (commit 393118b). Porém, a auditoria QA revelou que o código gerado usa **nomes de colunas e valores de enum diferentes** do schema real do banco.

Além disso, 4 trigger functions no banco estão com colunas erradas e vão **falhar em runtime**. Há também um trigger duplicado que causa **débito duplo de estoque**.

---

## Problema 1: Triggers SQL Quebrados

### 1.1 `fn_compra_recebimento_estoque`
- Usa `observacao` → coluna real é `motivo`
- Usa `quantidade` em estoque_saldos → coluna real é `quantidade_disponivel`
- INSERT INTO estoque_saldos usa `quantidade` → deve usar `quantidade_disponivel`

### 1.2 `fn_compra_gera_conta_pagar`
- Usa `descricao` → coluna não existe em contas_pagar (usar `numero_titulo`)
- Usa `valor` → coluna real é `valor_original`
- Usa `data_entrega` → coluna real é `previsao_entrega`
- Usa status `'pendente'` → CHECK constraint aceita `'a_pagar'`
- Sem guard de idempotência (pode criar duplicatas)

### 1.3 `fn_producao_estoque`
- Usa `observacao` → coluna real é `motivo`
- Usa `quantidade` em estoque_saldos → coluna real é `quantidade_disponivel`
- Bloco de `saida` no status `finalizado` **duplica** com trigger antigo `debitar_estoque_producao`

### 1.4 Trigger Duplicado
- `trg_producao_estoque` (migration 031) e `trg_debitar_estoque` (migration antiga) ambos disparam no UPDATE de `ordens_producao`
- Ambos fazem saída de estoque no status `finalizado` → **estoque debitado 2x**
- Solução: Remover bloco de saída do `fn_producao_estoque`, manter apenas reserva/liberação

---

## Problema 1.5: Coluna `prioridade` faltando na tabela `ocorrencias`

O código usa `prioridade` (baixa, media, alta, critica) extensivamente em forms, filtros, KPIs e gráficos. Mas a coluna **não existe** no banco.

**Ação**: Adicionar via migration 032:
```sql
ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS prioridade TEXT DEFAULT 'media';
ALTER TABLE ocorrencias ADD CONSTRAINT ocorrencias_prioridade_check
  CHECK (prioridade = ANY (ARRAY['baixa', 'media', 'alta', 'critica']));
```

---

## Problema 1.6: Fornecedores — Colunas erradas no type

| Código atual | DB real |
|---|---|
| `nome` | NÃO EXISTE (usar `razao_social` + `nome_fantasia`) |
| `contato` | `contato_nome` |
| `endereco, cidade, estado, cep` | NÃO EXISTEM |
| — | `categorias` (ARRAY), `lead_time_dias`, `condicao_pagamento` |

**Ação**: Corrigir interface Fornecedor no type e service (`order("nome")` → `order("nome_fantasia")`)

---

## Problema 2: Frontend ↔ DB Enum Mismatches

### 2.1 Compras — Status
| Código atual | DB CHECK constraint |
|---|---|
| `rascunho, pendente, aprovado, enviado, recebido, cancelado` | `rascunho, aprovado, enviado, parcial, recebido, cancelado` |

**Ação**: Remover `pendente`, adicionar `parcial`

### 2.2 Compras — Campo data_entrega
| Código atual | DB real |
|---|---|
| `data_entrega` | `previsao_entrega` |

**Ação**: Renomear em types, service, pages

### 2.3 Compras — Fornecedor type incompleto
| Código atual | DB real |
|---|---|
| `nome, cnpj, email, telefone, contato, endereco, cidade, estado, cep` | Tem também: `nome_fantasia, razao_social, lead_time_dias, condicao_pagamento, categorias` |

**Ação**: Forms já usam `nome_fantasia`/`razao_social` mas o tipo não define. Alinhar.

### 2.4 Compras — State machine incompleta
| Status | Ações disponíveis |
|---|---|
| rascunho | ✅ Enviar para aprovação, Cancelar |
| ~~pendente~~ | ~~Aprovar, Cancelar~~ (removido) |
| aprovado | ✅ Marcar enviado, Cancelar |
| enviado | ❌ FALTAM ações → adicionar "Marcar Recebido" + "Recebimento Parcial" |
| parcial | ❌ FALTAM ações → adicionar "Marcar Recebido" |
| recebido | Fim do fluxo |
| cancelado | Fim do fluxo |

### 2.5 Estoque — Campos errados
| Código atual | DB real |
|---|---|
| `EstoqueSaldo.quantidade` | `quantidade_disponivel` |
| `EstoqueMovimentacao.observacao` | `motivo` |

**Ação**: Renomear em types, service, hooks, components, pages, testes

### 2.6 Qualidade — Status
| Código atual | DB CHECK |
|---|---|
| `em_tratamento` | `em_tratativa` |
| `fechada` | `encerrada` |

**Ação**: Renomear em todos os arquivos do módulo

### 2.7 Qualidade — Tipo
| Código atual | DB CHECK |
|---|---|
| inclui `material_defeituoso`, `outro` | CHECK rejeita esses valores |

**Ação**: ALTER TABLE para expandir o CHECK (são cenários reais do negócio)

### 2.8 Qualidade — Campo titulo
| Código atual | DB real |
|---|---|
| `Ocorrencia.titulo` (campo separado) | Não existe — só tem `descricao NOT NULL` |

**Ação**: Remover `titulo` do type e form. Usar `descricao` diretamente.

### 2.9 Qualidade — Tratativa campos
| Código atual | DB real |
|---|---|
| `descricao, tipo` | `acao_corretiva, prazo, data_conclusao, observacoes` |

**Ação**: Alinhar type Tratativa, service, TratativaTimeline, OcorrenciaDetailPage

### 2.10 Qualidade — Ocorrencia campos extras no DB
| Código não usa | DB tem |
|---|---|
| — | `causa` (CHECK: material_defeituoso, erro_operacional, erro_projeto, instrucao_incorreta, outro) |
| — | `numero` |
| — | `custo_mp, custo_mo, custo_total, impacto_prazo_dias` |

**Ação**: Adicionar ao type e exibir onde relevante (form e detail page)

---

## Problema 3: Limpeza

### 3.1 Monolitos antigos
- `src/domains/compras/pages/ComprasPage.tsx` (2099 linhas) — dead code
- `src/domains/estoque/pages/EstoquePage.tsx` (1968 linhas) — dead code
- Ambos desconectados das rotas, inflam o bundle

**Ação**: Deletar ambos

### 3.2 Redirect órfão
- `src/routes/qualidadeRoutes.tsx` linha 11: redirect de `ocorrencias` → nunca atingido

**Ação**: Remover

### 3.3 `(supabase as any)` — 40+ casts
Os 3 services (comprasService, estoqueService, qualidadeService) usam `(supabase as any)` em todas as queries.

**Ação**: O Supabase client do projeto não tem tipos gerados. Manter cast mas tipá-lo uma vez no topo de cada service:
```typescript
const db = supabase as any;
```
Isso centraliza o cast e facilita futura migração quando `supabase gen types` for rodado.

### 3.4 Cache invalidation — Qualidade KPIs
`useCriarOcorrencia` e `useAtualizarOcorrencia` não invalidam `["qualidade-kpis"]`.

**Ação**: Adicionar invalidação.

### 3.5 PedidoCompraForm — queries diretas ao Supabase
Componente faz 2 queries diretas ao Supabase ao invés de usar comprasService.

**Ação**: Mover para comprasService (listarFornecedoresAtivos, listarMateriaisSelect).

### 3.6 AlertaEstoqueMinimo — pluralização errada
`material{alertas.length > 1 ? "is" : ""}` → deveria ser `materia{alertas.length > 1 ? "is" : "l"}`

**Ação**: Corrigir para "1 material" / "N materiais".

### 3.7 EstoqueDashboardPage — campo observacao no form de ajuste
Dialog de ajuste manual passa `observacao` para `criarMovimentacao`.

**Ação**: Renomear para `motivo`.

---

## Arquivos Afetados (por ordem de execução)

### Onda 1 — Migration SQL (032)
1. `supabase/migrations/032_fix_triggers_schema.sql` — nova migration

### Onda 2 — Types (3 arquivos)
2. `src/domains/compras/types/compras.types.ts`
3. `src/domains/estoque/types/estoque.types.ts`
4. `src/domains/qualidade/types/qualidade.types.ts`

### Onda 3 — Services (3 arquivos)
5. `src/domains/compras/services/comprasService.ts`
6. `src/domains/estoque/services/estoqueService.ts`
7. `src/domains/qualidade/services/qualidadeService.ts`

### Onda 4 — Hooks (7 arquivos)
8. `src/domains/compras/hooks/useFornecedores.ts`
9. `src/domains/compras/hooks/usePedidosCompra.ts`
10. `src/domains/estoque/hooks/useEstoqueSaldos.ts`
11. `src/domains/estoque/hooks/useMovimentacoes.ts`
12. `src/domains/estoque/hooks/useInventario.ts`
13. `src/domains/qualidade/hooks/useOcorrencias.ts`
14. `src/domains/qualidade/hooks/useQualidadeKPIs.ts`

### Onda 5 — Components + Pages (14 arquivos)
15. `src/domains/compras/components/PedidoCompraForm.tsx`
16. `src/domains/compras/pages/PedidoCompraDetailPage.tsx`
17. `src/domains/compras/pages/PedidosCompraPage.tsx`
18. `src/domains/estoque/components/SaldoCard.tsx`
19. `src/domains/estoque/components/AlertaEstoqueMinimo.tsx`
20. `src/domains/estoque/pages/EstoqueDashboardPage.tsx`
21. `src/domains/qualidade/components/OcorrenciaForm.tsx`
22. `src/domains/qualidade/components/TratativaTimeline.tsx`
23. `src/domains/qualidade/components/QualidadeCharts.tsx`
24. `src/domains/qualidade/pages/QualidadeDashboardPage.tsx`
25. `src/domains/qualidade/pages/OcorrenciaDetailPage.tsx`
26. `src/shared/components/AbrirOcorrenciaButton.tsx`
27. `src/routes/qualidadeRoutes.tsx`

### Onda 6 — Limpeza + Testes
28. DELETE `src/domains/compras/pages/ComprasPage.tsx`
29. DELETE `src/domains/estoque/pages/EstoquePage.tsx`
30. `src/domains/compras/services/__tests__/comprasService.test.ts`
31. `src/domains/estoque/services/__tests__/estoqueService.test.ts`
32. `src/domains/qualidade/services/__tests__/qualidadeService.test.ts`

---

## Critérios de Sucesso

1. Migration 032 executada no Supabase sem erros
2. Triggers testados: aprovar PC → cria conta_pagar com campos corretos
3. Triggers testados: receber PC → entrada no estoque com campos corretos
4. Triggers testados: OP finalizada → saída de estoque SEM duplicação
5. Build passando (`npm run build`)
6. Todos os testes passando (`npx vitest run`)
7. Monolitos antigos deletados
8. Nenhum `observacao` restante onde deveria ser `motivo`
9. Nenhum `quantidade` restante em estoque_saldos onde deveria ser `quantidade_disponivel`
10. Nenhum `em_tratamento`/`fechada` restante onde deveria ser `em_tratativa`/`encerrada`
