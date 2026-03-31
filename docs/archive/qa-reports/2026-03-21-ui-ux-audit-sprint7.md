# Auditoria UI/UX — Croma Print ERP/CRM
**Sprint 7 | Data: 2026-03-21 | Auditor: Claude Sonnet (UI/UX Pro Max)**

---

## 1. Design System Recomendado para o ERP

### Fundação atual (o que está bem)
O sistema já adota shadcn/ui + Tailwind, o que é excelente para consistência. A paleta de cores está adequada para um ERP B2B:

| Token | Uso atual | Status |
|---|---|---|
| `bg-blue-600` | CTA primário, item ativo sidebar | Correto |
| `rounded-2xl` | Cards, drawers | Correto |
| `rounded-xl` | Inputs, botões, badges | Correto |
| `text-slate-800` | Títulos | Correto |
| `text-slate-500` | Labels secundárias | Correto |
| `border-slate-100/200` | Bordas de cards | Correto |

### Gaps identificados no design system

**Tipografia — não há escala declarada em variável, usa classes espalhadas:**
- Títulos de página: `text-2xl font-bold` (correto)
- Subtítulos de seção: `text-base font-semibold` (inconsistente — às vezes `text-sm font-semibold`)
- Labels de KPI: `text-sm font-medium text-slate-500` (correto)
- **Problema grave**: uso de `text-[10px]` e `text-[11px]` em 166 ocorrências — tamanhos abaixo de 12px violam WCAG 2.1 (legibilidade mínima) e são ilegíveis em telas comuns sem zoom

**Spacing — inconsistência entre páginas:**
- `max-w-6xl` (Layout.tsx), `max-w-[1200px]` (dashboards), `max-w-7xl` (Almoxarife, Calendário, Contabilidade) — três larguras máximas diferentes para o mesmo layout de conteúdo principal
- Páginas com `p-6` interno + `p-4 md:p-8` do Layout geram padding duplo em ~30% das páginas

**Shadows — escala não padronizada:**
- `shadow-sm`, `shadow-md`, `shadow-lg` usados sem critério semântico claro
- Cards elevados (modais, dropdowns) deveriam ter shadow progressivo conforme elevação

---

## 2. Issues Críticas de UX (Bloqueia Uso)

### CRIT-01 — Emojis como ícones de status em dados operacionais
**Arquivos**: `FiscalFilaPage.tsx`, `StatusFiscalBadge.tsx`, `FiscalDocumentosPage.tsx`, `DASStatsCards.tsx`, `OSPrintLayout.tsx`, `FinanceiroPage.tsx`, `DashboardDiretor.tsx` (linha 525)

Emojis (`✅`, `❌`, `⚠️`, `⚠`) são usados como ícones funcionais de status em tabelas e badges. Isso quebra:
- **Acessibilidade**: screen readers leem "check mark button", "cross mark", em inglês, sem contexto
- **Consistência**: o sistema usa Lucide Icons em 95% dos casos; emojis são um sistema visual diferente que conflita
- **Impressão/PDF**: emojis não renderizam de forma consistente em contextos de impressão
- **Internacionalização**: emojis variam por OS/versão

**Fix necessário**: substituir por `<CheckCircle2>`, `<XCircle>`, `<AlertTriangle>` de Lucide com a cor semântica correspondente.

### CRIT-02 — Textos sem acentuação no Portal Público
**Arquivo**: `PortalOrcamentoPage.tsx` linhas 42, 44, 151

O portal `/p/:token` é uma interface voltada ao cliente externo (B2B). Foram encontrados:
- `"Link Invalido"` (sem acento — deveria ser "Link Inválido")
- `"Esta proposta nao foi encontrada"` (sem til — deveria ser "não")
- `"Observacoes"` (sem cedilha — deveria ser "Observações")

Em um documento comercial enviado ao cliente, isso transmite falta de cuidado e profissionalismo — impacto direto na taxa de aprovação de propostas.

### CRIT-03 — KpiCard clickável sem role/keyboard acessibilidade
**Arquivo**: `src/shared/components/KpiCard.tsx` linhas 92-98

O `KpiCard` com `onClick` usa uma `<div>` (não interativa semanticamente). Usuários de teclado não conseguem focar ou ativar o card via Enter/Space. Screen readers não anunciam que é clicável. Afeta todos os dashboards onde KPIs são clicáveis.

```tsx
// Problema atual:
<div onClick={onClick} className="...cursor-pointer...">

// Deveria ser:
<button onClick={onClick} className="..." role="button">
```

### CRIT-04 — Sidebar sem `aria-label` na nav
**Arquivo**: `Layout.tsx` linha 463

```tsx
<nav className="flex-1 overflow-y-auto pr-1 -mr-1 scrollbar-thin">
```

O elemento `<nav>` não tem `aria-label`. Com múltiplos `<nav>` na página (sidebar + bottom nav mobile), screen readers não conseguem distinguir qual é qual. WCAG 2.4.1 exige que regiões landmarks sejam diferenciáveis.

### CRIT-05 — Accordion sidebar sem indicação de estado para screen readers
**Arquivo**: `Layout.tsx` linhas 210-223

O botão de grupo do accordion não tem `aria-expanded`. O usuário de screen reader não sabe se o grupo está aberto ou fechado.

```tsx
// Falta:
<button aria-expanded={isExpanded} aria-controls={`group-${group.label}`}>
```

---

## 3. Issues de Média Prioridade (Degrada UX)

### MED-01 — Textos de 10px e 11px — ilegíveis e inacessíveis
**Ocorrências**: 166 em 56 arquivos

`text-[10px]` e `text-[11px]` aparecem massivamente em: labels de sidebar, badges de notificação, subtextos de KPI, legendas de status. WCAG 2.1 AA recomenda mínimo de 12px para textos normais e 14px para textos de interface.

Casos concretos:
- `Layout.tsx` linha 206: labels de grupo da sidebar em `text-[10px]` — praticamente ilegível em telas de resolução padrão
- `PortalApproval.tsx` linhas 27, 45: subtexto dos trust signals em `text-[10px]`
- `DashboardDiretor.tsx` linha 525: alerta de pedidos atrasados em `text-[10px]` — dado crítico operacional ilegível

**Fix**: elevar mínimo para `text-xs` (12px) em todos os casos. Labels de sidebar de grupo podem usar `text-[11px]` apenas se não forem o único portador de informação.

### MED-02 — Saudações com emojis na UI interna
**Arquivos**: `DashboardComercial.tsx` linha 117, `DashboardDiretor.tsx` linha 302

```tsx
<h1>Bom dia, Comercial 🎯</h1>  // Dashboard Comercial
<h1>Bom dia 👋</h1>            // Dashboard Diretor
```

Emojis em títulos H1 violam a regra UI/UX Pro Max "Sem emojis como ícones". O `👋` e `🎯` não adicionam informação — são puramente decorativos, mas criam ruído visual e são anunciados por screen readers.

### MED-03 — StatusBar (Diretor) sem tooltip nos segmentos
**Arquivo**: `DashboardDiretor.tsx` linhas 139-164

O componente `StatusBar` exibe barras coloridas de status de pedidos sem tooltip ao hover. O usuário não consegue identificar o status de um segmento pequeno (<10%) sem consultar a legenda separada. Em telas menores (768px), a legenda fica esmagada.

### MED-04 — Gantt de Máquinas não é um Gantt real
**Arquivo**: `PCPDashboardPage.tsx` — componente `GanttMaquinas`

O componente chamado "Gantt" é na verdade uma tabela de linhas. Não há:
- Linha do tempo visual com escala de horas/dias
- Barras de duração proporcionais
- Indicação de conflito de máquina (duas OPs no mesmo horário)
- Navegação temporal (hoje, amanhã, semana)

Para chão de fábrica, a falta de visualização temporal real é um gap operacional significativo. Um supervisor não consegue ver de relance a carga do dia.

### MED-05 — Propostas recentes no Dashboard Comercial: rows sem link
**Arquivo**: `DashboardComercial.tsx` linhas 186-207

As propostas na lista são `<div>` não clicáveis. O usuário vê o nome da proposta mas não pode clicar para abri-la — precisa ir para a listagem de orçamentos e buscar. Quebra a scanabilidade do dashboard e aumenta tempo de tarefa.

### MED-06 — Tarefas do dia sem link ou ação
**Arquivo**: `DashboardComercial.tsx` linhas 223-235

Semelhante ao MED-05: tarefas listadas sem ação. O usuário não consegue marcar como concluída, abrir detalhes ou navegar para a tarefa diretamente do dashboard.

### MED-07 — Formulário de Contrato: validação inline ausente
**Arquivo**: `ContratosPage.tsx` — `ContratoDialog`

A validação de campos obrigatórios (cliente, descrição, valor, data de início) só acontece no `mutationFn` ao submeter. O usuário preenche um formulário longo, clica em "Criar Contrato" e apenas então vê um toast de erro genérico sem indicar qual campo está incorreto. Ausência de:
- `required` HTML5 no input
- Mensagens de erro inline por campo
- Destaque visual no campo inválido

### MED-08 — Tabela de Contratos: colunas ocultas em mobile sem estratégia
**Arquivo**: `ContratosPage.tsx` linhas 577-588

As colunas "Periodicidade" e "Próx. Faturamento" usam `hidden sm:table-cell` e `hidden md:table-cell`. Em mobile (375px), a tabela mostra apenas: Cliente, Descrição, Valor Mensal, Status, Ação — mas "Descrição" pode ter `max-w-[200px]` truncado. A experiência em mobile fica comprometida. Uma abordagem de cards responsivos seria mais adequada para a tabela de contratos em telas < 640px.

### MED-09 — Indicadores de alerta piscantes sem preferências de movimento
**Arquivo**: `DashboardDiretor.tsx` linhas 95, 127; outros componentes

```tsx
<div className="w-2.5 h-2.5 bg-yellow-300 rounded-full animate-pulse" />
<div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
```

`animate-pulse` não respeita `prefers-reduced-motion`. Usuários com epilepsia fotossensível ou vestibular disorder podem ser afetados. WCAG 2.3.3 recomenda respeitar essa preferência.

**Fix**: `motion-safe:animate-pulse` (classe Tailwind que respeita a preferência do sistema).

### MED-10 — Portal: seção de observações sem heading semântico correto
**Arquivo**: `PortalOrcamentoPage.tsx` linha 151

```tsx
<h4 className="text-sm font-semibold text-slate-700 mb-2">Observacoes</h4>
```

Além do problema de acento (CRIT-02), usar `<h4>` sem `<h2>` e `<h3>` no DOM quebra a hierarquia de headings. O portal usa `<h1>` no header e salta para `<h4>` no corpo — screen readers perdem a navegação estrutural.

### MED-11 — WebhooksPage: campos de URL sem validação client-side
**Arquivo**: `WebhooksPage.tsx`

Um campo `<Input>` para URL de webhook não tem `type="url"`. Sem validação, o usuário pode salvar uma URL malformada e só descobrir o erro quando o evento falhar silenciosamente no futuro.

---

## 4. Issues de Baixa Prioridade (Polish)

### LOW-01 — Inconsistência de `max-width` do conteúdo principal
Três valores diferentes: `max-w-6xl` (Layout), `max-w-[1200px]` (Dashboards), `max-w-7xl` (Almoxarife, Calendário). Em telas 1440px+, dashboards ficam estreitos enquanto outras páginas se expandem. Definir um único `max-w-screen-xl` (1280px) para todo o conteúdo interno.

### LOW-02 — `HeroKpi` do Dashboard Diretor: escala ao hover conflita com navegação
**Arquivo**: `DashboardDiretor.tsx` linha 75

```tsx
className="... hover:scale-[1.02]"
```

O transform scale em cards de KPI cria layout shift que pode mover elementos vizinhos. Em grids apertados, isso faz cards "empurrar" uns aos outros. Preferir `hover:shadow-lg` sem scale.

### LOW-03 — `OPKanbanCard`: click handler em `<div>` sem `role` ou `tabIndex`
**Arquivo**: `PCPDashboardPage.tsx` linhas 33-56

```tsx
<div onClick={() => navigate(`/os/op/${item.id}`)} className="...cursor-pointer">
```

Elemento clicável sem semântica de botão. Mesma classe de problema do CRIT-03 mas em contexto de chão de fábrica onde operadores podem usar teclado USB externo.

### LOW-04 — Sidebar: `scrollbar-thin` sem fallback cross-browser
**Arquivo**: `Layout.tsx` linha 463

`scrollbar-thin` é uma classe custom do plugin `tailwind-scrollbar`. Em browsers sem o plugin configurado, não há fallback. A scrollbar de overflow do nav pode ficar com aparência padrão do OS, quebrando o visual clean do sidebar.

### LOW-05 — `PortalHeader`: logo com `onError` de `img` não testado no portal
O `PortalHeader` usa `<img src="/logo_croma.png">` sem o handler `onError` que existe no `Layout.tsx`. Se a imagem falhar no servidor, o header do portal do cliente fica com espaço vazio.

### LOW-06 — `CromaLogoFallback`: `hidden` com `flex` — conflito CSS
**Arquivo**: `Layout.tsx` linha 65

```tsx
<div className={`hidden flex items-center gap-1.5 ${className}`}>
```

`hidden` (display: none) e `flex` (display: flex) no mesmo elemento é semanticamente incorreto. O JS remove `hidden` via `classList.remove("hidden")` no `onError`, mas isso é frágil — se a classe `hidden` tiver maior especificidade, `flex` não aplica. O padrão correto é usar `display: none` inline e remover via style no onError.

### LOW-07 — `ContratosPage`: `font-mono` no valor de KPI sem variável de token
**Arquivo**: `ContratosPage.tsx` linha 165

```tsx
<p className="text-xl font-bold text-slate-800 mt-0.5 leading-tight font-mono">{value}</p>
```

O KPI de contratos usa `font-mono` para valores monetários. O `KpiCard` compartilhado não usa `font-mono`. Há inconsistência na apresentação de valores numéricos entre componentes. Definir `tabular-nums` (já usado em alguns lugares) como padrão para todos os valores monetários.

### LOW-08 — Portal de aprovação: comentário oculto por padrão pode ser perdido
**Arquivo**: `PortalApproval.tsx` linhas 51-69

O link "+ Adicionar comentário ou observação" é `text-sm text-blue-600 hover:underline`. Clientes que têm dúvidas ou pedidos de ajuste podem não perceber essa opção e aprovar sem comunicar suas necessidades. Mostrar o campo de texto diretamente (expandido, mas opcional) aumentaria a captura de feedback.

### LOW-09 — Empty state do Dashboard Comercial usa ícone diferente do padrão
**Arquivo**: `DashboardComercial.tsx` linha 238

O empty state de "Nenhuma tarefa pendente" usa `<Zap>` — enquanto o padrão do CLAUDE.md especifica o ícone contextual da seção. `Zap` não representa "tarefas" semanticamente. Usar `<CheckSquare>` ou `<Clock>`.

### LOW-10 — `StatusFiscalBadge` mistura emojis com Lucide
**Arquivo**: `StatusFiscalBadge.tsx`

Status fiscal usam emojis (`✅ Apto`, `❌ Rejeitado`, `⚠️ Inutilizado`) enquanto o resto do sistema usa Lucide Icons. Criar badges com `<CheckCircle2 className="text-emerald-600">`, `<XCircle className="text-red-600">`, `<AlertTriangle className="text-orange-600">`.

---

## 5. Top 10 Melhorias de UX por Impacto

| # | Melhoria | Impacto | Esforço | Área |
|---|---|---|---|---|
| 1 | **Substituir todos os emojis de status por Lucide Icons** com semântica ARIA | Alto — afeta acessibilidade, profissionalismo, impressão | Médio — 15 arquivos | Todo o sistema |
| 2 | **Corrigir textos sem acento no Portal Público** (`Inválido`, `não`, `Observações`) | Alto — impacto direto na conversão e confiança do cliente externo | Baixo — 3 linhas | Portal `/p/:token` |
| 3 | **Elevar texto mínimo de 10px/11px para 12px (text-xs)** em toda a UI | Alto — WCAG, legibilidade em ambientes de fábrica, telas de baixa qualidade | Médio — 56 arquivos | Todo o sistema |
| 4 | **Tornar linhas de propostas e tarefas no Dashboard Comercial clicáveis** | Alto — reduz cliques e tempo de tarefa do vendedor; é a ação mais frequente | Baixo — 2 componentes | Dashboard Comercial |
| 5 | **Substituir `<div onClick>` por `<button>` em KpiCard e OPKanbanCard** | Alto — acessibilidade de teclado; operadores de fábrica com periféricos USB | Baixo — 2 componentes | Shared + PCP |
| 6 | **Adicionar `aria-label` nos `<nav>` e `aria-expanded` nos accordions do sidebar** | Médio-alto — conformidade WCAG; afeta todos os usuários de screen reader | Baixo — 1 arquivo | Layout.tsx |
| 7 | **Validação inline nos formulários** (Contrato, Webhook, campos críticos) | Médio — reduz erros e retrabalho; melhora experiência de criação de contratos | Médio — 3-5 formulários | Formulários |
| 8 | **Gantt de Máquinas: adicionar escala temporal real** (barra horizontal de horas) | Médio — visibilidade operacional real para o supervisor de produção | Alto — novo componente | PCP |
| 9 | **`motion-safe:animate-pulse` em todos os indicadores piscantes** | Médio — WCAG 2.3.3, respeito a usuários com distúrbios vestibulares | Baixo — busca/replace | Múltiplos |
| 10 | **Padronizar `max-width` do conteúdo principal** em `max-w-screen-xl` (1280px) | Baixo-médio — consistência visual em telas 1440px+; evita dashboards estreitos | Baixo — 10 arquivos | Layouts |

---

## 6. Score de Maturidade UI/UX

| Dimensão | Score (0-10) | Justificativa |
|---|---|---|
| **Consistência** | 7.0 | Design system bem definido, radii e cores consistentes. Perda de pontos por 3 max-widths diferentes, 2 sistemas de ícones (Lucide + emojis), inconsistência de heading hierarchy |
| **Acessibilidade** | 4.5 | Muitos `<div onClick>` sem role, textos abaixo de 12px em 56 arquivos, `<nav>` sem aria-label, accordions sem aria-expanded, emojis de status sem alternativa textual, `animate-pulse` sem motion-safe |
| **Performance Percebida** | 7.5 | Loading skeletons presentes (KpiSkeleton, HeroKpi animate-pulse inline), lazy loading ativo, TanStack Query com staleTime configurado. Perde por falta de skeleton em algumas listagens secundárias |
| **Responsividade** | 6.5 | Layout mobile bem estruturado (bottom nav, sheet drawer). Perde por tabelas sem estratégia mobile (ContratosPage), textos minúsculos em 375px, e Gantt de máquinas inútil em mobile |
| **Hierarquia Visual** | 7.5 | Dashboard Diretor tem estrutura clara: Hero KPIs → Métricas secundárias → Conteúdo. Portal tem hierarquia limpa. Perde por heading H1→H4 sem intermediários no portal, e StatusBar sem interatividade que dilui a hierarquia de atenção |

**Score médio: 6.6/10** — Sistema sólido e bem estruturado para um ERP, com base técnica robusta. As maiores oportunidades de melhoria estão em acessibilidade (impacto regulatório e operacional) e nos micro-textos ilegíveis que afetam especialmente o contexto de uso em chão de fábrica com telas de 1080p padrão.

---

## Anexo: Arquivos mais críticos para ação imediata

1. `/src/domains/fiscal/components/StatusFiscalBadge.tsx` — emojis em badge de status fiscal
2. `/src/domains/portal/pages/PortalOrcamentoPage.tsx` — textos sem acentuação (impacto cliente externo)
3. `/src/shared/components/KpiCard.tsx` — `<div>` clicável sem semântica
4. `/src/components/Layout.tsx` — aria-label e aria-expanded faltando
5. `/src/domains/comercial/pages/DashboardComercial.tsx` — emojis no H1, rows não clicáveis
6. `/src/domains/comercial/pages/DashboardDiretor.tsx` — emojis no H1, text-[10px] crítico na linha 525
7. `/src/domains/fiscal/pages/FiscalFilaPage.tsx` — emojis como labels funcionais de status
