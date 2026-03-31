# xQuads Design Squad -- Auditoria UX/UI Completa
## CRM Croma Print ERP

**Data**: 2026-03-17
**Auditor**: xQuads Design Chief
**URL**: https://crm-croma.vercel.app/
**Stack**: React 19 + Vite + shadcn/ui + TanStack Query v5 + Tailwind CSS
**Total de arquivos analisados**: 441 (TSX/TS)
**Modulos auditados**: 15

---

## Sumario Executivo

O ERP Croma Print apresenta uma base visual solida com boa adocao do shadcn/ui e padroes consistentes na maioria dos modulos. O sistema de layout (sidebar colapsavel, mobile bottom nav, command palette) e bem implementado. Porem, existem inconsistencias significativas entre modulos construidos em fases diferentes, gaps de acessibilidade, e problemas de padronizacao que comprometem a experiencia profissional esperada de um ERP.

**Score Geral: 6.8/10**

---

## Score de UX por Modulo

| # | Modulo | Score | Principais Issues |
|---|--------|-------|-------------------|
| 1 | Dashboard | 8.0 | Excelente. 4 dashboards por role, KPIs com gradientes, skeleton loaders. |
| 2 | Clientes | 7.5 | Busca funcional, CNPJ auto-lookup, paginacao. Form dialog poderia ser Sheet. |
| 3 | Orcamentos | 8.0 | KPIs contextuais, tabela desktop + cards mobile, filtros, empty states. |
| 4 | Pedidos/OS | 7.0 | Bom, mas arquivo monolitico (53KB). Dialog de criacao densa demais. |
| 5 | Instalacoes | 7.5 | Realtime, tabs por status, checklist sheet. Complexidade alta mas funcional. |
| 6 | Comissoes | 8.5 | Melhor modulo. 3 tabs (Vendedor/Detalhamento/Metas), KPIs, progress bars, empty states, skeleton loaders, filtros granulares. |
| 7 | Faturamento em Lote | 7.5 | Checkbox selection, context bar, confirmation dialog. Falta busca/filtro. |
| 8 | Almoxarife | 6.0 | Usa `gray-*` em vez de `slate-*`. Padding `p-6` proprio (Layout ja tem `p-4 md:p-8`). Tabs basicas sem estilizacao consistente. |
| 9 | Diario de Bordo | 6.5 | Funcional mas basico. Padding duplicado. Sem busca/paginacao na tabela. |
| 10 | TV Producao | 8.5 | Excelente para o caso de uso. Dark theme, rotacao automatica, progress bar, clock. Acessibilidade de botoes OK. |
| 11 | Relatorios | 7.0 | Grid de cards com export multi-formato. Preview apenas para 2 de 11 tipos. Usa `text-primary` (semantico) vs hardcoded `text-blue-600` em outros modulos. |
| 12 | Conciliacao Bancaria | 7.5 | Drag-and-drop CSV, auto-matching, summary cards. Bem construido. |
| 13 | Calendario | 7.0 | Calendar shadcn com modifiers, filtros por tipo. Panel de dia precisa de melhor empty state. |
| 14 | Campanhas | 6.5 | Badge component local conflita com shadcn Badge. Sheet para detalhes OK. |
| 15 | Propostas | 7.0 | Estrutura similar a Orcamentos. KPIs, filtros, cards mobile. |

---

## Top 10 Problemas Mais Impactantes

### 1. CRITICO -- Dual Toast System (Toaster + Sonner)

**Arquivo**: `src/App.tsx` (linhas 59-60)
**Problema**: O app renderiza DOIS sistemas de toast simultaneamente: `<Toaster />` (shadcn) e `<Sonner />`. Isso causa notificacoes duplicadas ou inconsistentes dependendo de qual util e chamada.
**Impacto**: Confusao do usuario, notificacoes podem aparecer em cantos diferentes da tela.
**Referencia**: Brad Frost, Atomic Design -- "One source of truth per pattern."
**Recomendacao**: Escolher UM sistema (Sonner e mais moderno) e migrar todos os `showSuccess`/`showError` para ele. Remover `<Toaster />`.

### 2. CRITICO -- Inconsistencia de Color Palette (gray vs slate)

**Arquivos afetados**: `AlmoxarifePage.tsx`, `OrcamentoViewPage.tsx`, `FinanceiroPage.tsx`, `FiscalFilaPage.tsx`
**Problema**: 4 modulos usam `gray-*` (Tailwind default) enquanto todo o resto usa `slate-*`. Cria desalinhamento visual perceptivel.
**Impacto**: Quebra de consistencia visual, parece que partes do app sao de projetos diferentes.
**Referencia**: Design Tokens (Nathan Curtis) -- palette unica.
**Recomendacao**: Substituir todas as ocorrencias de `text-gray-*`, `bg-gray-*`, `border-gray-*` por equivalentes `slate-*`.

### 3. ALTO -- Padding Duplo em Modulos

**Arquivos afetados**: `AlmoxarifePage.tsx`, `DiarioBordoPage.tsx`, `CalendarioPage.tsx`, `RelatoriosPage.tsx`, e 12+ outros
**Problema**: O `Layout.tsx` ja aplica `p-4 md:p-8` no `<main>`. Muitos modulos adicionam `p-6` proprio, resultando em padding duplo (p-8 + p-6 = 56px no desktop).
**Impacto**: Conteudo empurrado para dentro desnecessariamente, area util reduzida.
**Recomendacao**: Remover `p-6` dos containers raiz de cada pagina. Manter apenas `space-y-6` no wrapper.

### 4. ALTO -- Acessibilidade Deficiente (29 aria-labels em 441 arquivos)

**Analise**: Apenas 17 arquivos usam `aria-label`, `aria-describedby` ou `role=`. A grande maioria dos botoes de acao (editar, excluir, duplicar) nao tem labels acessiveis.
**Problema especifico**: Botoes icon-only na tabela de Orcamentos (`<Eye>`, `<ArrowRight>`, `<Copy>`, `<Trash2>`) nao tem `aria-label`. Screen readers leriam apenas "button".
**Impacto**: WCAG 2.1 AA violation. Usuarios com leitores de tela nao conseguem navegar.
**Referencia**: WCAG 2.1, Success Criterion 1.1.1 (Non-text Content), 4.1.2 (Name, Role, Value).
**Recomendacao**: Criar um lint rule (`jsx-a11y/aria-props`) e adicionar `aria-label` a todos os botoes icon-only. Priorizar tabelas e acoes destrutivas.

### 5. ALTO -- Ausencia de Skeleton/Loading em Modulos Criticos

**Modulos afetados**: Clientes (usa div pulso basico), Calendario (sem loading), Campanhas (sem loading)
**Problema**: Enquanto Comissoes e Dashboard tem skeletons sofisticados, outros modulos mostram apenas `<Loader2 className="animate-spin" />` centralizado, causando "flash of empty content".
**Impacto**: Percepcao de lentidao, UX inconsistente.
**Referencia**: Skeleton screens (Luke Wroblewski) -- matching content shape.
**Recomendacao**: Criar componente `<TableSkeleton rows={5} cols={4} />` e `<CardGridSkeleton count={6} />` reutilizaveis. Aplicar em todos os modulos.

### 6. ALTO -- Falta de Animacao de Entrada Consistente

**Analise**: Apenas 12 de ~40 paginas usam `animate-in fade-in duration-500`.
**Problema**: Metade dos modulos tem transicao de entrada suave, a outra metade "pula" na tela.
**Impacto**: Experiencia fragmentada, o app nao parece polido.
**Recomendacao**: Aplicar `animate-in fade-in duration-300` no `<Outlet />` do Layout, removendo a classe individual de cada pagina.

### 7. MEDIO -- Sem max-width Consistente

**Problema**: Layout aplica `max-w-6xl` no container de conteudo, mas `AlmoxarifePage` aplica `max-w-7xl`, `CalendarioPage` aplica `max-w-7xl`, e `AdminCentrosCustoPage` aplica `max-w-screen-xl`.
**Impacto**: Largura de conteudo varia entre paginas, quebrando ritmo visual.
**Recomendacao**: Usar `max-w-6xl` (do Layout) como unico constraint. Remover max-width individuais.

### 8. MEDIO -- Badge Component Local Conflita com shadcn Badge

**Arquivo**: `CampanhasPage.tsx` (linha 60-66)
**Problema**: Define um componente `Badge` local que shadowa o import do shadcn `Badge`, usado em outros modulos.
**Impacto**: Comportamento visual diferente no mesmo ERP.
**Recomendacao**: Renomear para `StatusTag` ou usar `<span>` com classes inline. Nunca shadowing de componentes do design system.

### 9. MEDIO -- Tabelas sem Paginacao/Scroll Virtual

**Modulos afetados**: Comissoes (detalhamento), Diario de Bordo, Almoxarife (historico), Conciliacao Bancaria
**Problema**: Tabelas renderizam todos os registros sem paginacao. Com 200+ lancamentos na Conciliacao, o DOM fica pesado.
**Impacto**: Performance degradada, scroll infinito sem feedback.
**Recomendacao**: Implementar paginacao via `usePagination` hook ou TanStack Virtual para tabelas com 50+ registros.

### 10. MEDIO -- Mobile Bottom Nav Limitada

**Arquivo**: `Layout.tsx` (linhas 429-455)
**Problema**: A bottom nav mobile mostra apenas Dashboard + 3 primeiros itens de "COMERCIAL" + Settings (5 itens fixos). Modulos como Producao, Financeiro, Instalacoes nao sao acessiveis sem abrir o menu hamburger.
**Impacto**: Usuarios mobile de producao/financeiro precisam de 2 cliques extras para chegar a sua area principal.
**Recomendacao**: Tornar a bottom nav dinamica baseada no `profile.role`. Ex: role `producao` ve Dashboard, Producao, OS, Almoxarife, Menu.

---

## Analise Detalhada por Modulo

### 1. Dashboard (Score: 8.0/10)

**Pontos fortes**:
- 4 dashboards especializados por role (Diretor, Comercial, Financeiro, Producao) via lazy loading
- Skeleton loader com shape matching (`DashboardSkeleton`)
- Hero KPI cards com gradientes e hover scale
- AI integration (AIButton, AISidebar, ProblemasPanel)
- ProgressTracker widget integrado

**Issues**:
- `DashboardDiretor.tsx` importa `ProblemasPanel` com `@deprecated` tag mas continua usando (BAIXO)
- Greeting time-of-day e funcional mas nao atualiza sem refresh (BAIXO)
- AI sidebar pode conflitar com command palette em mobile (BAIXO)

### 2. Clientes (Score: 7.5/10)

**Pontos fortes**:
- CNPJ auto-lookup via API com feedback visual
- Duplicate CNPJ detection com highlight vermelho
- Paginacao server-side (20 por pagina)
- Filtros por segmento e classificacao
- Cards com chevron affordance

**Issues**:
- Dialog de criacao deveria ser Sheet (mais espaco para formulario) (MEDIO)
- Emojis hardcoded no `CLASSIFICACAO_CONFIG` -- nao e pattern de design system (BAIXO)
- Stats badges no topo nao sao clicaveis para filtrar (oportunidade perdida) (BAIXO)

### 3. Orcamentos (Score: 8.0/10)

**Pontos fortes**:
- KPIs contextuais (Total, Pendentes, Aprovados, Valor em Aberto)
- Desktop table com hover actions (opacity transition)
- Mobile cards com CTAs diretos (Ver/Editar)
- Status badges com cores semanticas consistentes
- Paginacao com info "Mostrando X-Y de Z"
- AlertDialog para exclusao com feedback de loading

**Issues**:
- Acoes de tabela ficam invisiveis (opacity-0) ate hover -- problematico para touch/tablet (ALTO)
- `max-w-[200px]` e `max-w-[160px]` hardcoded para truncate -- deveria ser responsivo (BAIXO)
- Nao ha debounce no campo de busca (MEDIO)

### 4. Pedidos/OS (Score: 7.0/10)

**Pontos fortes**:
- Status badges com dot indicators
- Dialog de criacao com steps (cliente, itens)
- StatusFiscalBadge integrado
- Navegacao para detalhe

**Issues**:
- Arquivo monolitico com 53KB -- viola separation of concerns (ALTO)
- Dialog de criacao muito denso para mobile (ALTO)
- Sem KPIs visao geral (ao contrario de Orcamentos) (MEDIO)

### 5. Instalacoes (Score: 7.5/10)

**Pontos fortes**:
- Realtime updates via `useCampoRealtimeGlobal`
- Tabs por status (Pendente/Em campo/Concluido)
- ChecklistSheet com fotos e video
- Timer integrado
- Indicador WiFi/offline

**Issues**:
- Arquivo gigante -- deveria ser split em sub-componentes menores (ALTO)
- Muitas cards informacao pode overwhelm em mobile (MEDIO)

### 6. Comissoes (Score: 8.5/10)

**Pontos fortes**:
- Melhor modulo do ponto de vista UX
- 3 tabs bem definidas com icons
- KPI cards com skeleton loaders dedicados
- ProgressBar reutilizavel com cores semanticas (vermelho < 50%, amber 50-75%, azul 75-100%, verde 100%+)
- EmptyState component reutilizavel com icon + title + description
- Tabela com summary footer (total + count)
- Filtros triplos (busca + status + vendedor)
- Tab "Por Vendedor" com cards compactos e progress de meta

**Issues**:
- Sem paginacao na tab Detalhamento -- pode crescer muito (MEDIO)
- KpiCard component e local -- deveria ser shared (MEDIO)

### 7. Faturamento em Lote (Score: 7.5/10)

**Pontos fortes**:
- Checkbox selection com select-all/indeterminate
- Context bar azul com total selecionado
- Confirmation AlertDialog com valores
- Feedback de loading no botao
- Bom uso de shadcn Table components

**Issues**:
- Sem busca ou filtro por cliente (MEDIO)
- Sem paginacao -- lista pode ficar grande (MEDIO)
- Click na row para selecionar e bom, mas falta visual cue (BAIXO)

### 8. Almoxarife (Score: 6.0/10)

**Issues criticos**:
- Usa `gray-*` em vez de `slate-*` (4 ocorrencias: `gray-100`, `gray-50`, `gray-600`, `gray-900`) (ALTO)
- Padding `p-6` duplicado com Layout (ALTO)
- `max-w-7xl` conflita com Layout `max-w-6xl` (MEDIO)
- Tabs usa `bg-gray-100` em vez do pattern de tabs estilizadas usado em Comissoes (MEDIO)
- Dialog de checkout usa `text-muted-foreground` (semantico) misturado com `text-gray-900` (nao-semantico) (MEDIO)

**Pontos fortes**:
- Card grid responsivo (1/2/3 cols)
- Badge status (Em uso / Disponivel)
- Skeleton loader dedicado
- Empty state com icon

### 9. Diario de Bordo (Score: 6.5/10)

**Issues**:
- Padding `p-6` duplicado (ALTO)
- Sem busca na tabela (MEDIO)
- Sem paginacao (MEDIO)
- Header icon usa `bg-slate-100` enquanto outros modulos usam cores tematicas (BAIXO)
- Filtro de equipamento em card separado ocupa espaco desnecessariamente -- poderia estar inline no header (BAIXO)

**Pontos fortes**:
- TipoBadge com cores por tipo
- Dialog de criacao com campos opcionais bem marcados
- Uso correto de shadcn Table/TableRow

### 10. TV Producao (Score: 8.5/10)

**Pontos fortes**:
- Design dark theme dedicado e coerente
- Rotacao automatica de setores (20s) com progress bar
- Clock em tempo real
- Navigation dots interativos
- OS cards com prioridade visual (cores + pulse para urgente)
- Live indicator (verde/amber)
- Empty state adequado
- Token guard para seguranca

**Issues**:
- SVG icons inline em vez de Lucide -- inconsistencia (BAIXO)
- Sem modo manual "pause rotation" (BAIXO)

### 11. Relatorios (Score: 7.0/10)

**Pontos fortes**:
- 11 tipos de relatorio com configuracao centralizada
- Export multi-formato (CSV, Excel, PDF)
- DropdownMenu para escolha de formato
- Preview com Recharts para vendas e DRE
- Date range picker funcional

**Issues**:
- Usa `text-primary` (CSS var semantica) enquanto maioria dos modulos usa `text-blue-600` hardcoded -- inconsistencia inversa (MEDIO)
- Padding `p-6` duplicado (ALTO)
- Card component padrao do shadcn (sem rounded-2xl customizado) vs cards customizados em outros modulos (MEDIO)
- Preview disponivel para apenas 2 de 11 tipos (BAIXO)

### 12. Conciliacao Bancaria (Score: 7.5/10)

**Pontos fortes**:
- Drag-and-drop + click para upload CSV
- Auto-conciliacao por valor com tolerancia
- Summary cards com cores semanticas
- Side-by-side panels (extrato vs sistema)
- Status icons (CheckCircle2 / Minus) por row
- Badges de conciliados/pendentes
- Upload area com keyboard accessibility (role="button", onKeyDown)

**Issues**:
- Sem paginacao -- 200 lancamentos renderizados de uma vez (MEDIO)
- Falta debounce visual ao conciliar (BAIXO)
- Limite hardcoded de 200 lancamentos nao e comunicado ao usuario (MEDIO)

### 13. Calendario (Score: 7.0/10)

**Pontos fortes**:
- Calendar shadcn com modifiers visuais (dots, rings)
- Filtros toggle por tipo de evento
- Legenda visual
- Panel de proximos 30 dias
- Click em evento navega para entidade

**Issues**:
- Padding `p-6 max-w-7xl` duplicado e inconsistente com Layout (ALTO)
- Grid `grid-cols-[auto_1fr]` pode quebrar em telas intermediarias (MEDIO)
- Sem loading state (MEDIO)
- Calendar locale nao esta configurado (passa `undefined`) -- meses em ingles (ALTO)

### 14. Campanhas (Score: 6.5/10)

**Issues**:
- Badge component local shadowing shadcn Badge (ALTO)
- Sem loading state na listagem principal (ALTO)
- KPIs do topo nao tem skeleton loader (MEDIO)
- Sheet de detalhes e funcional mas denso (MEDIO)

**Pontos fortes**:
- CRUD completo (criar, editar, excluir)
- Disparo de campanha com confirmacao
- Destinatarios management
- Status + Origem badges com cores distintas

### 15. Propostas (Score: 7.0/10)

**Pontos fortes**:
- Estrutura espelhada de Orcamentos (consistencia)
- KPIs funcionais
- Filtros por status
- Permission-based rendering (canCriar, canExcluir)

**Issues**:
- Sem responsividade mobile dedicada (tabela simples) (MEDIO)
- Sem cards mobile como Orcamentos tem (MEDIO)
- Probabilidade como campo numerico -- deveria ser slider ou select com ranges (BAIXO)

---

## Problemas Cross-Cutting

### Design Tokens vs Hardcoded Values

| Aspecto | Estado Atual | Recomendacao |
|---------|-------------|--------------|
| Cores | Mix de `blue-600` hardcoded + `text-primary` CSS var | Migrar para CSS vars: `--brand-primary`, `--brand-accent` |
| Border radius | Mix de `rounded-2xl`, `rounded-xl`, `rounded-lg` | Padronizar: cards = `rounded-2xl`, buttons = `rounded-xl`, badges = `rounded-full` |
| Shadows | Mix de `shadow-sm`, `shadow-md`, sem shadow | Cards = `shadow-sm`, hover = `shadow-md` |
| Spacing | `p-4`, `p-5`, `p-6` usados intercambiavelmente | Cards = `p-5`, dialogs = `py-4`, KPIs = `p-5` |

### Componentes que Deveriam Ser Shared

| Componente | Onde Existe | Onde Deveria Estar |
|-----------|------------|-------------------|
| `KpiCard` | `ComissoesPage.tsx` | `src/shared/components/KpiCard.tsx` |
| `EmptyState` | `ComissoesPage.tsx` | `src/shared/components/EmptyState.tsx` |
| `ProgressBar` | `ComissoesPage.tsx` | `src/shared/components/ProgressBar.tsx` |
| `SummaryCard` | `ConciliacaoPage.tsx` | `src/shared/components/SummaryCard.tsx` |
| `SkeletonRow` / `SkeletonCard` | `ComissoesPage.tsx` | `src/shared/components/TableSkeleton.tsx` |
| `StatusBadge` pattern | Duplicado em 8+ modulos | `src/shared/components/StatusBadge.tsx` |

### Hierarquia Tipografica

| Nivel | Atual | Recomendacao |
|-------|-------|-------------|
| Page title | `text-2xl font-bold` ou `text-2xl md:text-3xl font-bold` | Padronizar: `text-2xl font-bold text-slate-800` |
| Subtitle | `text-slate-500 mt-1` ou `text-sm text-slate-500` ou `text-slate-500 text-sm mt-0.5` | Padronizar: `text-sm text-slate-500 mt-1` |
| Section header | Varia muito | `text-base font-semibold text-slate-800` |
| Table header | `text-xs font-semibold text-slate-400 uppercase tracking-wider` ou `font-semibold text-slate-600` | Padronizar: `text-xs font-semibold text-slate-500 uppercase tracking-wider` |

---

## Recomendacoes Priorizadas

### P0 -- Fazer Agora (1-2 dias)

1. **Remover dual toast** -- Manter apenas Sonner, remover `<Toaster />`
2. **Substituir gray por slate** -- Find/replace em 4 arquivos
3. **Remover padding duplicado** -- Auditar e remover `p-6` dos wrappers raiz de ~15 paginas
4. **Configurar Calendar locale** -- Importar `ptBR` do date-fns e passar para `<Calendar locale={ptBR} />`

### P1 -- Sprint Atual (1 semana)

5. **Extrair componentes shared** -- `KpiCard`, `EmptyState`, `ProgressBar`, `TableSkeleton`
6. **Adicionar aria-labels** -- Todos os botoes icon-only (tabelas, acoes)
7. **Debounce em campos de busca** -- Aplicar `useDeferredValue` ou `debounce` 300ms
8. **Animar transicao de pagina** -- Adicionar `animate-in fade-in` no `<Outlet />` do Layout

### P2 -- Proximo Sprint (2 semanas)

9. **Bottom nav dinamica por role** -- Adaptar `mobileNavItems` baseado em `profile.role`
10. **Paginacao em tabelas longas** -- Comissoes detalhamento, Conciliacao, Diario de Bordo, Almoxarife historico
11. **Padronizar StatusBadge** -- Criar componente generico com config map
12. **Hover actions para touch** -- Trocar `opacity-0 group-hover:opacity-100` por always-visible em tablets
13. **Renomear Badge local em Campanhas** -- Evitar shadowing do design system

### P3 -- Backlog (continuo)

14. **Design tokens CSS vars** -- Migrar cores hardcoded para variaveis semanticas
15. **Skeleton loaders em todos os modulos** -- Criar componentes reutilizaveis
16. **Dark mode** -- As vars ja existem em `globals.css` mas nenhum toggle foi implementado
17. **Split PedidosPage.tsx** -- Refatorar arquivo de 53KB em sub-componentes
18. **Focus management** -- Trap focus em dialogs, return focus on close
19. **Preview para mais relatorios** -- Adicionar graficos para ABC, Lucratividade, etc.

---

## Padroes Positivos a Preservar

1. **Domain-driven file structure** -- `src/domains/{domain}/{hooks,pages,services,types}/` e excelente
2. **Soft delete pattern** -- `excluido_em + excluido_por` em todas as tabelas
3. **Permission-based rendering** -- `useAuth().can('modulo', 'acao')` e bem implementado
4. **Command Palette** -- `Ctrl+K` com busca global e atalho para navegacao
5. **Breadcrumbs** -- Navegacao contextual automatica
6. **Sidebar colapsavel** -- Com tooltips, transition suave, state persistido
7. **Mobile-first responsive** -- Tabelas desktop com cards mobile em Orcamentos
8. **TanStack Query** -- `staleTime` configurado, `invalidateQueries` correto em mutations
9. **Error Boundary** -- Com fallback visual e opcoes de recovery
10. **Print styles** -- OS com layout dedicado para impressao

---

## Nota sobre Design System Maturity

Baseado no modelo de maturidade de design system do InVision:

**Nivel atual: 2.5 / 5 (Managed)**

- Tokens parcialmente definidos (CSS vars existem mas nao sao usados consistentemente)
- Componentes base do shadcn estao intactos e bem usados
- Componentes compostos (KpiCard, EmptyState) existem mas nao sao shared
- Documentacao de patterns inexistente
- Nenhum Storybook ou playground visual

**Para chegar ao nivel 3 (Standardized)**:
- Extrair 10-15 componentes compostos para `src/shared/components/`
- Criar `DESIGN_TOKENS.md` com regras de uso
- Implementar lint rules para consistencia (no-hardcoded-colors, require-aria-label)
- Considerar Storybook para catalogo visual

---

*Relatorio gerado por xQuads Design Squad -- Auditoria completa baseada em analise estatica de 441 arquivos do codebase.*
