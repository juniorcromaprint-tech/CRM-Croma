# Estoque — Redesign Funcional

> Data: 2026-03-22 | Abordagem B aprovada | Escopo: ~6-8h

## Contexto

Página `/estoque` com 496 materiais, 3 sub-rotas (dashboard, movimentações, inventário).
Problemas: sem paginação (496 cards no DOM), nomes "Material" genéricos, alertas falso-positivos,
KPIs client-side, rota de movimentações quebrada, sem navegação entre sub-páginas, types `as any`.

## 1. Layout Principal — Tabs Integradas

Substituir 3 rotas separadas por **tabs dentro da mesma página**:

```
┌─────────────────────────────────────────────────────────┐
│ Estoque                              [+ Ajuste Manual]  │
│ Saldos, alertas e movimentações de materiais            │
├─────────────────────────────────────────────────────────┤
│  [Saldos]  [Movimentações]  [Inventário]                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  KPIs (4 cards)                         Alertas (badge) │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ DataTable (paginação server-side, 25/página)    │    │
│  │ Material | Qtd | Reservado | Mínimo | Semáforo  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

As rotas `/estoque/movimentacoes` e `/estoque/inventario` continuam funcionando (deep link),
mas redirecionam para a tab correspondente na página principal.

## 2. DataTable no lugar do Grid de Cards

Substituir o grid de 496 `<SaldoCard>` por uma `<DataTable>` com:

| Coluna | Tipo | Sorting | Filtro |
|--------|------|---------|--------|
| Material (nome) | text | ✅ asc/desc | ✅ busca |
| Quantidade | number | ✅ | — |
| Reservado | number | ✅ | — |
| Mínimo | number | ✅ | — |
| Semáforo | badge | ✅ | ✅ filtro por cor |
| Última Mov. | date | ✅ | — |

**Paginação server-side**: 25 itens/página via `.range(offset, offset+limit)` no Supabase.
**Busca com debounce**: 300ms antes de disparar query.
**Contagens nos filtros**: Badge com número real de cada status (verde/amarelo/vermelho).

## 3. KPIs Server-Side

Criar RPC `rpc_estoque_kpis()` no Supabase que retorna em 1 query:

```sql
SELECT
  COUNT(*) as total_materiais,
  COUNT(*) FILTER (WHERE semaforo = 'vermelho') as critico,
  COUNT(*) FILTER (WHERE semaforo = 'amarelo') as atencao,
  (SELECT COALESCE(SUM(quantidade), 0) FROM estoque_movimentacoes
   WHERE tipo = 'entrada' AND created_at >= date_trunc('month', now())) as entradas_mes,
  (SELECT COALESCE(SUM(quantidade), 0) FROM estoque_movimentacoes
   WHERE tipo = 'saida' AND created_at >= date_trunc('month', now())) as saidas_mes
FROM v_estoque_semaforo;
```

Elimina: busca de 500 movimentações no client-side + 2 iterações de filter/reduce.

## 4. Alertas — Sidebar Colapsável

- **Default**: colapsado, mostra apenas badge vermelho no header "Alertas (N)"
- **Expandido**: Sheet/Drawer lateral com lista de materiais abaixo do mínimo
- **Filtrar falso-positivos**: excluir materiais com `estoque_minimo = 0` ou `NULL`

## 5. Ajuste Manual — Combobox com Busca

Substituir `<Select>` com 496 itens por `<Combobox>` (Popover + Command do shadcn/ui):
- Busca por nome do material
- Mostra unidade ao lado
- Adicionar tipo "ajuste" (além de entrada/saída)

## 6. Fix Tipos — Eliminar `as any`

Atualizar `estoque.types.ts` para refletir os campos reais da view `v_estoque_semaforo`:

```ts
interface EstoqueSemaforo {
  id: string;
  material_id: string;
  nome: string;           // da view
  unidade: string;        // da view
  estoque_minimo: number; // da view
  saldo_disponivel: number;
  saldo_reservado: number;
  semaforo: SemaforoStatus;
  qtd_reposicao_sugerida: number;
  ultima_movimentacao?: string;
}
```

## 7. Fix Rota Movimentações

O erro "Failed to fetch dynamically imported module" é causado por chunk stale no Vercel.
Solução: adicionar retry no lazy loading ou mover conteúdo para tab na mesma página.

## 8. Contagem correta no filtro Normal

Adicionar `(N)` no botão Normal, calculando `total - vermelho - amarelo`.

## Fora de Escopo (Abordagem C)

- Curva ABC / Pareto
- Gráficos de evolução
- Ponto de reposição automático
- Lote/validade
- QR code

## Arquivos Impactados

| Arquivo | Ação |
|---------|------|
| `EstoqueDashboardPage.tsx` | Rewrite — tabs + DataTable |
| `SaldoCard.tsx` | Manter (pode ser usado em detalhe futuro) |
| `MovimentacoesPage.tsx` | Integrar como tab |
| `InventarioPage.tsx` | Integrar como tab |
| `estoque.types.ts` | Fix tipos da view |
| `estoqueService.ts` | Paginação + RPC KPIs |
| `useEstoqueSaldos.ts` | Paginação + debounce |
| `useMovimentacoes.ts` | Sem mudança |
| `suprimentosRoutes.tsx` | Redirect sub-rotas para tabs |
| Migration nova | RPC `rpc_estoque_kpis` |
