# Spec: Correção dos 27 Bugs — Auditoria Funcional Browser

> **Data**: 2026-03-16 | **Origem**: `docs/qa-reports/2026-03-16-AUDITORIA-FUNCIONAL-BROWSER.md`
> **Abordagem**: Cirúrgica por Severidade — 4 waves sequenciais
> **Execução**: Sonnet (economia de tokens) | **Planejamento**: Opus

---

## Contexto

Auditoria funcional realizada via navegador identificou 27 problemas no CRM Croma Print:
- 5 Críticos (impedem uso)
- 4 Altos (afetam funcionalidade)
- 14 Médios (acentuação/UX visual)
- 4 Baixos (melhorias desejáveis)

O sistema tem 44 rotas, 30 funcionais (93.7%). O fluxo principal (Lead → Orçamento → Pedido) está quebrado em pontos-chave.

---

## Wave 1 — 5 Bugs Críticos

Cada fix recebe commit isolado + teste novo no Vitest.

### C1 — Render Loop em `/financeiro/conciliacao`

**Arquivo**: `src/domains/financeiro/pages/ConciliacaoPage.tsx`
**Locais**: `useMemo` com `setLancamentos` em ~L357 (causa primária) + segundo `setLancamentos` em ~L518 (possível contribuinte)
**Causa raiz**: `useMemo(() => { setLancamentos(...) }, [lancamentosRaw])` — `useMemo` chamando `setState` causa loop infinito de re-renders. Pode haver um segundo `setLancamentos` em ~L518 que perpetua o loop.
**Fix**: Substituir o `useMemo` por `useEffect` com a mesma dependência. Verificar também o `setLancamentos` em ~L518 para garantir que não re-entra no loop. O `useEffect` executa após o render, quebrando o ciclo.
**Teste**: Vitest que importa `ConciliacaoPage` e verifica que o módulo carrega sem erro (render completo requer mock do Supabase provider — manter teste leve).

### C2 — `require()` em ESM no `/relatorios`

**Arquivo**: `src/shared/utils/exportPdf.ts:5`
**Causa raiz**: `import html2pdf = require('html2pdf.js')` — sintaxe CommonJS incompatível com Vite (ESM).
**Fix**: Trocar por `const html2pdf = (await import('html2pdf.js')).default` dentro da função que usa. Tornar a função `async` se ainda não for.
**Teste**: Vitest que importa `exportPdf` e verifica que o módulo carrega sem erro.

### C3 — "Pedido não encontrado" em `/pedidos/:id`

**Arquivo**: `src/domains/pedidos/hooks/usePedidos.ts` — hook `usePedido`
**Causa raiz**: Query com `.single()` falha — possível RLS bloqueando ou query mal formada. Listagem funciona mas detalhe não.
**Fix**:
1. Diagnosticar: verificar se RLS em `pedidos` permite SELECT por ID para o role do usuário
2. Adicionar tratamento de erro explícito no hook
3. Se for RLS, ajustar policy — validar contra `027_rls_blindagem.sql` para não regredir outras policies. Se for query, corrigir o filtro.
**Teste**: Vitest que mocka Supabase e verifica que `usePedido(id)` retorna dados corretamente.

### C4 — Item não salva no Orçamento após wizard de 3 etapas

**Arquivo**: `src/domains/comercial/pages/OrcamentoEditorPage.tsx`, `handleAddItem` em ~L356-421
**Causa raiz**: `handleAddItem` chama `adicionarItem.mutateAsync()` e depois `orcamentoService.recalcularTotais(id)`, mas **não invalida o cache do TanStack Query** após essas operações. A invalidação existe em outro local (~L202 em `onActionsApplied`) mas não em `handleAddItem`. A mutação pode salvar no banco mas a UI não reflete.
**Fix**:
1. Verificar se a mutação realmente salva no banco (pode haver erro silencioso)
2. Adicionar `queryClient.invalidateQueries({ queryKey: ['proposta', id] })` **após** `recalcularTotais(id)` em `handleAddItem` (a query key é `['proposta', id]`, NÃO `['orcamento', id]`)
3. Adicionar toast de erro no catch
4. Verificar guard `isDefaultConfig` que pode estar bloqueando
**Teste**: Vitest que verifica a invalidação do cache com key `['proposta', id]` após `handleAddItem`.

### C5 — Conversão Lead → Cliente falha silenciosamente

**Arquivo**: `src/domains/comercial/pages/LeadDetailPage.tsx:~103-129`
**Causa raiz**: O catch block em ~L127 já chama `showError("Erro ao converter lead em cliente.")`, mas a mensagem é genérica — o erro real do Supabase não é surfaceado. O problema provável é no `createCliente.mutateAsync`: mapeamento incorreto de campos (ex: `razao_social` NOT NULL no banco mas não preenchido a partir dos dados do lead), ou o `updateLead.mutateAsync({ id, status: "convertido" })` em ~L123 falha por RLS.
**Fix**:
1. No catch: logar `err` no console (dev) e incluir `err.message` no toast: `showError(\`Erro: ${err.message}\`)`
2. Verificar se `createCliente` mapeia corretamente `razao_social` e `nome_fantasia` a partir dos dados do lead
3. Verificar se RLS em `leads` permite UPDATE do campo `status`
4. Após sucesso: invalidar queries de leads e clientes, navegar para o cliente criado
**Teste**: Vitest que verifica que o mapeamento de campos lead→cliente produz um payload válido para a tabela `clientes`.

---

## Wave 2 — 4 Bugs Altos

### A1 — Valor estimado negativo em Leads

**Arquivo**: Formulário de criação de lead (modal)
**Fix**: Adicionar `min={0}` no input de valor estimado + validação Zod `z.number().min(0)` no schema.
**Escopo**: Apenas o campo de valor — sem over-engineering.

### A2 — Campo de busca preenchido após criar Lead

**Arquivo**: `src/domains/comercial/pages/LeadsPage.tsx`, função `handleCreate` ~L148-162
**Fix**: Adicionar `setSearch('')` dentro de `handleCreate` após a mutação bem-sucedida (~L162). A página usa async functions inline, não `useMutation` com `onSuccess`.

### A3 — OP 100% concluída na coluna "Fila" do Kanban

**Arquivo**: `src/domains/producao/pages/ProducaoPage.tsx`, filtro do kanban ~L190-192 e lógica `updateEtapaStatus` ~L594-597
**Causa raiz**: Existe lógica `allDone` em ~L594 que deveria auto-avançar o status, mas o filtro da coluna "Fila" em ~L192 usa `["aguardando_programacao", "em_fila"]` sem excluir OPs com progresso 100%.
**Fix**: No filtro da coluna "Fila", adicionar guard que exclui OPs onde progresso calculado === 100%. Ex: `.filter(op => op.status in ['aguardando_programacao', 'em_fila'] && op.progresso < 100)`. Opcionalmente, também corrigir o dado existente da OP-2026-9625 via SQL.

### A4 — Dashboard KPIs inconsistentes com Produção

**Arquivo**: Dashboard + query de KPIs
**Fix**: Garantir que o KPI "em produção" no dashboard use a mesma query/view que a página de Produção. Alinhar contagem e mensagem "Todos no prazo" com dados reais.

---

## Wave 3 — 14 Bugs Médios (Acentuação + UX)

### Estratégia: Grep + Replace em batch

Varredura nos arquivos dos módulos afetados para corrigir todas as strings sem acento:

| Bug | De | Para | Módulo |
|-----|----|------|--------|
| M1 | "ordemns" | "ordens" | Produção |
| M2 | "Expedicao" | "Expedição" | Expedição breadcrumb |
| M3 | "Itens do Orcamento" | "Itens do Orçamento" | Orçamento |
| M4 | "Descricao" | "Descrição" | Orçamento |
| M5 | "Servicos" | "Serviços" | Orçamento |
| M6 | "Adicionar servico" | "Adicionar serviço" | Orçamento |
| M7 | "Revisao" | "Revisão" | Orçamento wizard |
| M8 | "Preco Total" | "Preço Total" | Orçamento wizard |
| M9 | "precificacao automatica" | "precificação automática" | Orçamento aviso |
| M10 | "Analisar Orcamento" | "Analisar Orçamento" | Orçamento |
| M11 | "Package Banners è Lonas" | Verificar se vem do banco (tabela categorias/produtos.categoria) — se sim, corrigir via SQL; se não, corrigir no JSX | Orçamento categoria |
| M12 | "Comissoes" | "Comissões" | Comissões heading |
| M13 | "Calcados" | "Calçados" | Lead detail (verificar se vem do banco) |
| M14 | Cards truncados | Aumentar min-w ou adicionar title/tooltip | Produção Kanban |

**Commit único** para todas as correções de acentuação (M1–M13) + commit separado para M14 (mudança de CSS/componente).

---

## Wave 4 — 4 Bugs Baixos

### B1 — React Router v7 warnings

**Arquivo**: Onde `<BrowserRouter>` é instanciado (provavelmente `App.tsx` ou `main.tsx`)
**Fix**: Adicionar future flags: `<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>`

### B2 — Validação HTML5 nativa em Lead form

**Status**: Parcialmente coberto por A1 (min=0). Melhoria de UX com mensagens inline é backlog — não implementar agora.

### B3 — Default cidade/estado no form de Cliente

**Arquivo**: Formulário de criação de cliente
**Fix**: Trocar `defaultValue="Porto Alegre"` por `placeholder="Porto Alegre"` (sugestão visual sem pré-preencher).

### B4 — Mensagem "Todos no prazo" contradiz Produção "2 Atrasadas"

**Arquivo**: Dashboard — componente que renderiza a mensagem de prazos
**Fix**: Bug distinto de A4 (que corrige os números). Aqui o problema é o texto "Todos no prazo" que é hardcoded ou condicionado incorretamente. Tornar condicional: exibir "Todos no prazo" apenas quando `stats.atrasadas === 0`, caso contrário exibir `"${stats.atrasadas} atrasada(s)"`.

---

## Regras de Execução

1. **Cada wave em sequência** — só avançar após build limpo + testes passando
2. **Commits isolados** — 1 commit por bug crítico, agrupados para médios/baixos
3. **Sem refactoring colateral** — tocar apenas o necessário
4. **Build check obrigatório** entre waves: `npm run build && npx vitest run`
5. **Sonnet para execução** — economia de tokens, Opus só para decisões arquiteturais
6. **Novos testes Vitest** para cada bug crítico (C1–C5)

## Ordem de Commits Esperada

```
fix(financeiro): resolve render loop in ConciliacaoPage (C1)
fix(relatorios): replace require() with dynamic import in exportPdf (C2)
fix(pedidos): fix pedido detail query/RLS for single view (C3)
fix(orcamento): fix item save + cache invalidation in wizard (C4)
fix(comercial): fix lead-to-client conversion with error feedback (C5)
fix(leads): validate min value >= 0 + clear search after create (A1, A2)
fix(producao): align OP status with progress percentage (A3)
fix(dashboard): align KPIs with production real data (A4)
fix(i18n): correct 13 missing accents across UI labels (M1-M13)
fix(producao): improve kanban card readability (M14)
chore: add React Router v7 future flags + fix client form defaults (B1, B3, B4)
```

---

## Critérios de Sucesso

- [ ] 0 páginas quebradas (atualmente 2)
- [ ] Fluxo Lead → Cliente → Orçamento → Pedido funcional end-to-end
- [ ] Build limpo sem warnings de require/CommonJS
- [ ] Todos os 102+ testes passando + novos testes para C1–C5
- [ ] Nenhuma string sem acento nos módulos corrigidos
- [ ] KPIs do Dashboard consistentes com páginas individuais
