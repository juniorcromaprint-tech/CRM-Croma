# APP-Campo v2 — Design de Melhorias

> **Data**: 2026-03-18 | **Status**: Aprovado | **Executor**: Sonnet
> **Princípio**: Simples, ágil, zero risco de quebrar o que funciona

---

## Contexto

APP-Campo é um PWA mobile-first para instaladores/técnicos de campo da Croma Print.
Deploy em `campo-croma.vercel.app`, banco compartilhado com ERP (`djwjmfgplnqyffdcgdaw.supabase.co`).
Sem testes automatizados. Deploy automático (push na main).

## Restrições

- **Sem migrations** — nenhuma mudança no banco
- **Sem Edge Functions novas** — tudo client-side ou queries Supabase diretas
- **Cada bloco em commits separados** — se algo quebra, reverte fácil
- **Não complicar** — é app de campo, tem que ser simples e rápido

---

## Bloco 1 — Bugs & Estabilidade (risco zero, impacto imediato)

### 1.1 Fix exclusão de OS (bug ativo)
- **Problema**: Botão excluir aparece pra todos mas RLS bloqueia pra instalador → erro silencioso
- **Solução**: Esconder botão de excluir se `profile.role !== 'admin'`
- **Arquivo**: `APP-Campo/src/pages/Jobs.tsx` (linha ~462)

### 1.2 Fix snake_case na Edge Function delete-user
- **Problema**: `delete-user` Edge Function checa `em_andamento` (snake_case) mas tabela jobs usa `Em andamento` (title case)
- **Solução**: Alinhar os valores de status na Edge Function
- **Arquivo**: `APP-Campo/supabase/functions/delete-user/index.ts`

### 1.3 Debounce nos filtros
- **Problema**: Busca e filtros de data disparam query a cada keystroke
- **Solução**: Adicionar 300ms debounce no search input e filtros de data
- **Arquivos**: `Jobs.tsx`, `Stores.tsx`

### 1.4 Select de colunas específicas
- **Problema**: Queries fazem `select(*)` trazendo dados desnecessários
- **Solução**: Trocar por colunas específicas nas queries de listagem (Jobs, Stores)
- **Arquivos**: `Jobs.tsx`, `Stores.tsx`, `Index.tsx`

---

## Bloco 2 — Produtividade em Campo

### 2.1 Alert de início de contagem de tempo
- **Problema**: Instalador abre OS pendente mas o botão "Iniciar Serviço" fica abaixo do scroll, fácil de esquecer
- **Solução**: Ao abrir JobDetail com status `Pendente` ou `Agendado`, exibir AlertDialog destacado: "Você está na loja? Iniciar contagem de tempo?" com botões "Sim, iniciar" e "Ainda não"
- **Arquivo**: `APP-Campo/src/pages/JobDetail.tsx`

### 2.2 Checklist fixo no JobDetail
- **Items padrão**: Conferir medidas, Limpar área, Foto antes, Foto depois, Conferir acabamento, Assinatura cliente
- **Storage**: Campo `checklist_data` como JSON no campo `notes` ou coluna existente da tabela `jobs` (verificar se já existe coluna checklist)
- **UI**: Seção de checkboxes acima das notas no JobDetail
- **Arquivo**: `APP-Campo/src/pages/JobDetail.tsx` (extrair componente `JobChecklist.tsx`)

### 2.3 Code split do JobDetail
- **Problema**: JobDetail.tsx tem 63KB — carrega lento em 3G
- **Solução**: Extrair em componentes lazy: `JobPhotos.tsx`, `JobSignature.tsx`, `JobVideos.tsx`, `JobTimeMetrics.tsx`
- **Resultado**: Página principal carrega rápido, tabs carregam sob demanda

### 2.4 Indicador de conexão
- **Problema**: `isOffline` state existe mas só aparece em mensagens de erro
- **Solução**: Banner fixo sutil no topo quando offline ("Sem conexão — alterações serão salvas quando reconectar")
- **Arquivo**: `APP-Campo/src/components/Layout.tsx`

---

## Bloco 3 — Visibilidade para Gestão

### 3.1 Analytics com gráficos reais (Recharts)
- **Adicionar Recharts** como dependência (`npm install recharts`)
- **3 gráficos**:
  1. OS por mês (BarChart) — últimos 6 meses
  2. OS por instalador (horizontal BarChart) — ranking
  3. Taxa de conclusão no prazo (LineChart) — tendência
- **KPIs reais**: Tempo médio de conclusão, % divergências, OS no prazo vs atrasadas
- **Arquivo**: `APP-Campo/src/pages/Analytics.tsx` (reescrever)

### 3.2 BillingReport melhorado
- **Adicionar**: Totalizadores (total OS, total fotos, total horas)
- **Adicionar**: Filtro por cliente/marca
- **Melhorar**: Export PDF com layout profissional
- **Arquivo**: `APP-Campo/src/pages/BillingReport.tsx`

---

## Bloco 4 — Polish & UX

### 4.1 Loading skeletons
- **Substituir** spinners por skeletons nas listas (Jobs, Stores, Dashboard)
- **Componente**: Criar `Skeleton.tsx` reutilizável (shadcn/ui já tem)
- **Arquivos**: `Jobs.tsx`, `Stores.tsx`, `Index.tsx`

### 4.2 Pull-to-refresh
- **Gesto**: Puxar pra baixo nas listas refaz a query
- **Implementação**: CSS overscroll + touch events + `refetch()`
- **Arquivos**: `Jobs.tsx`, `Stores.tsx`

### 4.3 Empty states padronizados
- **Padrão ERP**: Ícone + título + texto + ação sugerida (rounded-2xl, border-slate-200)
- **Aplicar em**: Jobs vazio, Stores vazio, Analytics sem dados, fotos vazias
- **Arquivos**: Todos os pages com listas

---

## O que NÃO entra (decisão consciente)

| Feature | Motivo |
|---------|--------|
| Push notifications | Complexidade alta (service worker, permissões), pouco ganho |
| Fila offline de fotos | IndexedDB + sync engine = risco alto de bugs |
| Realtime WebSocket | Overkill — técnico atualiza manualmente |
| GPS tracking contínuo | Já usa GPS pontual (ao iniciar), suficiente |
| Job templates | Nice-to-have, não essencial agora |

---

## Ordem de execução sugerida

1. **Bloco 1** (bugs) → merge imediato, zero risco
2. **Bloco 2** (campo) → maior impacto pro dia-a-dia
3. **Bloco 3** (gestão) → valor pra administração
4. **Bloco 4** (polish) → profissionalismo
