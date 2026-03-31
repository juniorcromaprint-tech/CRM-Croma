# APP-Campo v2 — Plano de Implementação

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Melhorar estabilidade, produtividade em campo e visibilidade de gestão do APP-Campo sem quebrar nada.

**Architecture:** Melhorias incrementais em 4 blocos independentes. Cada task é um commit isolado. Sem migrations, sem Edge Functions novas. Tudo client-side + queries Supabase.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind, shadcn/ui, Supabase, Recharts (novo), TanStack Query v5

**Design doc:** `docs/plans/2026-03-18-app-campo-melhorias-design.md`

---

## Bloco 1 — Bugs & Estabilidade

### Task 1: Fix botão excluir OS visível para instalador

**Files:**
- Modify: `APP-Campo/src/pages/Jobs.tsx:460-472`

**Step 1: Esconder botão de excluir para não-admin**

No `Jobs.tsx`, o botão Trash2 na linha ~462 aparece para todos. Envolver com checagem de role:

```tsx
// ANTES (linha ~462):
<Button
  variant="ghost"
  size="icon"
  onClick={(e) => handleDeleteClick(e, job.id)}
  className="w-10 h-10 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 z-10"
  title="Excluir OS"
>
  <Trash2 size={18} />
</Button>

// DEPOIS:
{profile?.role === 'admin' && (
  <Button
    variant="ghost"
    size="icon"
    onClick={(e) => handleDeleteClick(e, job.id)}
    className="w-10 h-10 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 z-10"
    title="Excluir OS"
  >
    <Trash2 size={18} />
  </Button>
)}
```

**Step 2: Verificar que build compila**

Run: `cd APP-Campo && npm run build`
Expected: Build sem erros

**Step 3: Commit**

```bash
git add APP-Campo/src/pages/Jobs.tsx
git commit -m "fix(campo): esconder botão excluir OS para instaladores — somente admin"
```

---

### Task 2: Fix status snake_case na Edge Function delete-user

**Files:**
- Modify: `APP-Campo/supabase/functions/delete-user/index.ts:51`

**Step 1: Corrigir valores de status**

Na linha 51, a query usa `['em_andamento', 'agendado', 'pendente']` mas a tabela `jobs` usa title case.

```ts
// ANTES (linha 51):
.in('status', ['em_andamento', 'agendado', 'pendente'])

// DEPOIS:
.in('status', ['Em andamento', 'Agendado', 'Pendente'])
```

**Step 2: Commit**

```bash
git add APP-Campo/supabase/functions/delete-user/index.ts
git commit -m "fix(campo): corrigir status title case na Edge Function delete-user"
```

---

### Task 3: Debounce nos filtros de busca

**Files:**
- Modify: `APP-Campo/src/pages/Jobs.tsx`
- Modify: `APP-Campo/src/pages/Stores.tsx`

**Step 1: Adicionar debounce no search de Jobs**

No `Jobs.tsx`, o `searchTerm` é usado diretamente na query. Adicionar estado `debouncedSearch` com useEffect:

```tsx
// Adicionar após a linha dos estados (~linha 28):
const [debouncedSearch, setDebouncedSearch] = useState("");

// Adicionar useEffect de debounce:
useEffect(() => {
  const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
  return () => clearTimeout(timer);
}, [searchTerm]);
```

Depois, trocar todas as referências de `searchTerm` dentro de `fetchJobs` e `useMemo` por `debouncedSearch`. Manter `searchTerm` no Input (para UX responsiva).

Na query `fetchJobs`, onde faz `.or(...)` com `searchTerm`, usar `debouncedSearch`.
No `queryKey` do `useInfiniteQuery`, trocar `searchTerm` por `debouncedSearch`.

**Step 2: Repetir no Stores.tsx**

Mesma lógica: criar `debouncedSearch` com debounce de 300ms. Usar na query/filtro.

**Step 3: Verificar build**

Run: `cd APP-Campo && npm run build`

**Step 4: Commit**

```bash
git add APP-Campo/src/pages/Jobs.tsx APP-Campo/src/pages/Stores.tsx
git commit -m "perf(campo): debounce 300ms nos filtros de busca — Jobs e Stores"
```

---

### Task 4: Select de colunas específicas nas queries

**Files:**
- Modify: `APP-Campo/src/pages/Jobs.tsx:77`
- Modify: `APP-Campo/src/pages/Index.tsx:35-38`

**Step 1: Otimizar query de Jobs**

```ts
// ANTES (Jobs.tsx linha 77):
.select('*, stores!inner(name, brand), profiles!jobs_assigned_to_fkey(first_name, last_name)', { count: 'exact' })

// DEPOIS:
.select('id, os_number, type, status, scheduled_date, created_at, notes, issues, assigned_to, store_id, stores!inner(name, brand), profiles!jobs_assigned_to_fkey(first_name, last_name)', { count: 'exact' })
```

**Step 2: Otimizar queries do Dashboard (Index.tsx)**

As queries do dashboard já usam `head: true` com count — isso é eficiente. Verificar se `select('*')` pode ser `select('id')` para reduzir payload:

```ts
// ANTES (Index.tsx linhas 35-38):
supabase.from('jobs').select('*', { count: 'exact', head: true })...

// DEPOIS:
supabase.from('jobs').select('id', { count: 'exact', head: true })...
```

Nota: com `head: true` o Supabase já não retorna dados, mas `select('id')` é mais explícito.

**Step 3: Verificar build**

Run: `cd APP-Campo && npm run build`

**Step 4: Commit**

```bash
git add APP-Campo/src/pages/Jobs.tsx APP-Campo/src/pages/Index.tsx
git commit -m "perf(campo): select colunas específicas — Jobs e Dashboard"
```

---

## Bloco 2 — Produtividade em Campo

### Task 5: Alert de início de contagem de tempo

**Files:**
- Modify: `APP-Campo/src/pages/JobDetail.tsx`

**Step 1: Adicionar AlertDialog ao abrir OS pendente**

Importar `AlertDialog` do shadcn/ui e adicionar estado:

```tsx
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Adicionar estado (junto dos outros estados):
const [showStartAlert, setShowStartAlert] = useState(false);
```

Adicionar useEffect que dispara o alert quando job carrega com status pendente/agendado:

```tsx
useEffect(() => {
  if (job && !isAdmin && (job.status === 'Pendente' || job.status === 'Agendado') && !job.started_at) {
    setShowStartAlert(true);
  }
}, [job?.id, job?.status]);
```

Adicionar o dialog no JSX (antes do return final, dentro do fragment):

```tsx
<AlertDialog open={showStartAlert} onOpenChange={setShowStartAlert}>
  <AlertDialogContent className="rounded-2xl mx-4">
    <AlertDialogHeader>
      <AlertDialogTitle className="text-xl font-black flex items-center gap-2">
        <PlayCircle className="text-blue-600" size={24} />
        Iniciar Serviço?
      </AlertDialogTitle>
      <AlertDialogDescription className="text-base text-slate-600">
        Você está na loja? Ao iniciar, a contagem de tempo e o GPS serão registrados automaticamente.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
      <AlertDialogCancel className="rounded-xl h-12">Ainda não</AlertDialogCancel>
      <AlertDialogAction
        onClick={handleStartJob}
        className="bg-blue-600 hover:bg-blue-700 rounded-xl h-12 font-bold"
      >
        Sim, Iniciar Agora
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Step 2: Verificar que AlertDialog existe nos componentes shadcn**

Checar se `APP-Campo/src/components/ui/alert-dialog.tsx` existe. Se não, criar com `npx shadcn@latest add alert-dialog` (rodar dentro de `APP-Campo/`).

**Step 3: Verificar build**

Run: `cd APP-Campo && npm run build`

**Step 4: Commit**

```bash
git add APP-Campo/src/pages/JobDetail.tsx
git commit -m "feat(campo): alert automático para iniciar contagem de tempo ao abrir OS pendente"
```

---

### Task 6: Checklist fixo no JobDetail

**Files:**
- Create: `APP-Campo/src/components/JobChecklist.tsx`
- Modify: `APP-Campo/src/pages/JobDetail.tsx`

**Step 1: Criar componente JobChecklist**

```tsx
// APP-Campo/src/components/JobChecklist.tsx
import React, { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckSquare } from "lucide-react";

const DEFAULT_ITEMS = [
  "Conferir medidas no local",
  "Limpar/preparar área de instalação",
  "Fotografar ANTES da instalação",
  "Executar instalação",
  "Fotografar DEPOIS da instalação",
  "Conferir acabamento final",
];

interface JobChecklistProps {
  jobId: string;
  initialData?: Record<string, boolean>;
  onSave: (data: Record<string, boolean>) => void;
  disabled?: boolean;
}

export default function JobChecklist({ jobId, initialData, onSave, disabled }: JobChecklistProps) {
  const [checks, setChecks] = useState<Record<string, boolean>>(() => {
    if (initialData && Object.keys(initialData).length > 0) return initialData;
    return Object.fromEntries(DEFAULT_ITEMS.map(item => [item, false]));
  });

  const completedCount = Object.values(checks).filter(Boolean).length;
  const totalCount = Object.keys(checks).length;

  const toggle = (item: string) => {
    if (disabled) return;
    const updated = { ...checks, [item]: !checks[item] };
    setChecks(updated);
    onSave(updated);
  };

  return (
    <div className="bg-white p-5 rounded-2xl border shadow-sm">
      <div className="flex items-center justify-between border-b pb-2 mb-3">
        <label className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <CheckSquare size={16} /> Checklist
        </label>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
          completedCount === totalCount ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
        }`}>
          {completedCount}/{totalCount}
        </span>
      </div>
      <div className="space-y-3">
        {Object.entries(checks).map(([item, checked]) => (
          <label
            key={item}
            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
              checked ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-100 hover:bg-slate-100'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            onClick={() => toggle(item)}
          >
            <Checkbox checked={checked} disabled={disabled} className="pointer-events-none" />
            <span className={`text-sm font-medium ${checked ? 'text-green-700 line-through' : 'text-slate-700'}`}>
              {item}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Integrar no JobDetail**

No `JobDetail.tsx`, o campo `notes` do job é texto livre. Vamos usar o campo `issues` ou um JSON dentro de `notes` — mas o melhor é usar um campo separado. Verificar se a tabela `jobs` tem alguma coluna tipo `metadata` ou `checklist`.

Abordagem segura: salvar checklist como JSON no localStorage + no campo `notes` como prefixo JSON separado por delimitador. MAS isso é frágil.

**Abordagem melhor**: Usar coluna `metadata` se existir, ou salvar no localStorage por jobId e exibir localmente. Para persistência cross-device, adicionar uma coluna `checklist_json` futuramente (fora deste plano — sem migrations).

**Para agora**: localStorage por jobId.

```tsx
// No JobDetail.tsx, importar:
import JobChecklist from "@/components/JobChecklist";

// Adicionar no JSX, logo antes da seção de Tabs (antes da linha ~714, dentro do div print:hidden):
// Colocar entre o Card de informações e a seção de "Serviço não iniciado"/Tabs:

{canInteract && (
  <JobChecklist
    jobId={id!}
    initialData={JSON.parse(localStorage.getItem(`checklist_${id}`) || '{}')}
    onSave={(data) => localStorage.setItem(`checklist_${id}`, JSON.stringify(data))}
  />
)}
```

**Step 3: Verificar build**

Run: `cd APP-Campo && npm run build`

**Step 4: Commit**

```bash
git add APP-Campo/src/components/JobChecklist.tsx APP-Campo/src/pages/JobDetail.tsx
git commit -m "feat(campo): checklist fixo de instalação no JobDetail — 6 items padrão"
```

---

### Task 7: Code split do JobDetail

**Files:**
- Create: `APP-Campo/src/components/job/JobPhotos.tsx`
- Create: `APP-Campo/src/components/job/JobVideos.tsx`
- Create: `APP-Campo/src/components/job/JobSignature.tsx`
- Create: `APP-Campo/src/components/job/JobTimeMetrics.tsx`
- Modify: `APP-Campo/src/pages/JobDetail.tsx`

**Step 1: Ler JobDetail.tsx completo e identificar as seções**

O arquivo tem ~900+ linhas. Extrair:
- **JobPhotos**: Seção de fotos antes/depois (TabsContent "photos") — inclui upload, compressão, watermark, modal
- **JobVideos**: Seção de vídeos (TabsContent "videos") — upload + playback
- **JobSignature**: Seção de assinatura (TabsContent "signature") — canvas + fullscreen modal
- **JobTimeMetrics**: Seção de métricas de tempo + edição admin (o bloco bg-blue-50)

Cada componente recebe as props necessárias (job, isAdmin, mutation, refs).

**Step 2: Criar `APP-Campo/src/components/job/` directory**

**Step 3: Extrair cada componente**

Mover o JSX + lógica relacionada para cada arquivo. JobDetail.tsx fica como orquestrador com lazy imports:

```tsx
const JobPhotos = React.lazy(() => import('@/components/job/JobPhotos'));
const JobVideos = React.lazy(() => import('@/components/job/JobVideos'));
const JobSignature = React.lazy(() => import('@/components/job/JobSignature'));
```

Envolver cada TabsContent com `<Suspense fallback={<Loader2 className="animate-spin mx-auto my-8" />}>`.

**IMPORTANTE**: Esta task é a mais complexa. Ler o JobDetail.tsx inteiro antes de começar. Manter a mesma funcionalidade exata — não mudar comportamento, só extrair.

**Step 4: Verificar build**

Run: `cd APP-Campo && npm run build`

**Step 5: Testar manualmente no browser**

Abrir uma OS, verificar que cada tab carrega corretamente.

**Step 6: Commit**

```bash
git add APP-Campo/src/components/job/ APP-Campo/src/pages/JobDetail.tsx
git commit -m "refactor(campo): code split JobDetail — fotos, vídeos, assinatura em componentes lazy"
```

---

### Task 8: Indicador de conexão offline

**Files:**
- Modify: `APP-Campo/src/components/Layout.tsx`

**Step 1: Adicionar banner de conexão no Layout**

```tsx
// No Layout.tsx, adicionar estado e listeners:
const [isOffline, setIsOffline] = useState(!navigator.onLine);

useEffect(() => {
  const onOnline = () => setIsOffline(false);
  const onOffline = () => setIsOffline(true);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}, []);
```

No JSX, adicionar banner fixo no topo (antes do conteúdo principal):

```tsx
{isOffline && (
  <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-bold flex items-center justify-center gap-2 z-50">
    <WifiOff size={16} /> Sem conexão — dados podem estar desatualizados
  </div>
)}
```

Importar `WifiOff` de `lucide-react`.

**Step 2: Verificar build**

Run: `cd APP-Campo && npm run build`

**Step 3: Commit**

```bash
git add APP-Campo/src/components/Layout.tsx
git commit -m "feat(campo): banner de indicador offline no Layout"
```

---

## Bloco 3 — Visibilidade para Gestão

### Task 9: Instalar Recharts

**Step 1: Adicionar dependência**

Run: `cd APP-Campo && npm install recharts`

**Step 2: Commit**

```bash
git add APP-Campo/package.json APP-Campo/package-lock.json
git commit -m "deps(campo): adicionar recharts para gráficos de analytics"
```

---

### Task 10: Reescrever Analytics com gráficos reais

**Files:**
- Rewrite: `APP-Campo/src/pages/Analytics.tsx`

**Step 1: Ler o Analytics.tsx atual completo**

Entender o que já existe (KPIs básicos, query de stats).

**Step 2: Reescrever com 4 KPIs + 3 gráficos**

KPIs:
1. Total de OS (todas)
2. Concluídas no período
3. Tempo médio de conclusão (horas)
4. Taxa de divergências (%)

Gráficos (Recharts):
1. `BarChart` — OS por mês (últimos 6 meses), barras empilhadas (concluídas vs pendentes)
2. `BarChart` horizontal — OS por instalador (ranking top 10)
3. `LineChart` — Taxa de conclusão no prazo por mês (linha percentual)

Query: Buscar `jobs` com `select('id, status, created_at, started_at, finished_at, scheduled_date, assigned_to, profiles!jobs_assigned_to_fkey(first_name, last_name)')` e processar client-side.

Manter design consistente: cards rounded-2xl, cores slate/blue, Geist-style.

**Step 3: Verificar build**

Run: `cd APP-Campo && npm run build`

**Step 4: Commit**

```bash
git add APP-Campo/src/pages/Analytics.tsx
git commit -m "feat(campo): analytics com KPIs reais + 3 gráficos Recharts"
```

---

### Task 11: Melhorar BillingReport

**Files:**
- Modify: `APP-Campo/src/pages/BillingReport.tsx`

**Step 1: Ler BillingReport.tsx atual completo**

**Step 2: Adicionar melhorias**

- Totalizadores no topo: Total OS, Total fotos, Total horas trabalhadas
- Filtro por cliente/marca (dropdown)
- Manter export Excel existente
- Melhorar layout da tabela

**Step 3: Verificar build**

Run: `cd APP-Campo && npm run build`

**Step 4: Commit**

```bash
git add APP-Campo/src/pages/BillingReport.tsx
git commit -m "feat(campo): billing report com totalizadores e filtro por marca"
```

---

## Bloco 4 — Polish & UX

### Task 12: Loading skeletons nas listas

**Files:**
- Create: `APP-Campo/src/components/Skeletons.tsx`
- Modify: `APP-Campo/src/pages/Jobs.tsx`
- Modify: `APP-Campo/src/pages/Stores.tsx`
- Modify: `APP-Campo/src/pages/Index.tsx`

**Step 1: Criar componentes Skeleton reutilizáveis**

```tsx
// APP-Campo/src/components/Skeletons.tsx
import { Skeleton } from "@/components/ui/skeleton";

export function JobCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <div className="flex justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-48" />
      <div className="flex gap-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

export function StoreCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <Skeleton className="h-4 w-20 mb-2" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}
```

Verificar se `APP-Campo/src/components/ui/skeleton.tsx` existe. Se não, adicionar com `npx shadcn@latest add skeleton`.

**Step 2: Substituir Loader2 spinners por skeletons**

Em `Jobs.tsx`, `Stores.tsx` e `Index.tsx`, trocar os estados de loading (`isLoading`) que mostram `<Loader2>` por arrays de skeletons:

```tsx
// Exemplo em Jobs.tsx:
if (isLoading) {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => <JobCardSkeleton key={i} />)}
    </div>
  );
}
```

**Step 3: Verificar build**

Run: `cd APP-Campo && npm run build`

**Step 4: Commit**

```bash
git add APP-Campo/src/components/Skeletons.tsx APP-Campo/src/pages/Jobs.tsx APP-Campo/src/pages/Stores.tsx APP-Campo/src/pages/Index.tsx
git commit -m "feat(campo): loading skeletons em Jobs, Stores e Dashboard"
```

---

### Task 13: Pull-to-refresh nas listas

**Files:**
- Create: `APP-Campo/src/hooks/use-pull-refresh.ts`
- Modify: `APP-Campo/src/pages/Jobs.tsx`
- Modify: `APP-Campo/src/pages/Stores.tsx`

**Step 1: Criar hook usePullRefresh**

```tsx
// APP-Campo/src/hooks/use-pull-refresh.ts
import { useState, useRef, useCallback } from "react";

export function usePullRefresh(onRefresh: () => Promise<void>) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const scrollContainer = useRef<HTMLElement | null>(null);

  const THRESHOLD = 80;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const el = e.currentTarget;
    if (el.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      scrollContainer.current = el;
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!startY.current || !scrollContainer.current) return;
    if (scrollContainer.current.scrollTop > 0) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, THRESHOLD * 1.5));
    }
  }, []);

  const onTouchEnd = useCallback(async () => {
    if (pullDistance >= THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
    startY.current = 0;
  }, [pullDistance, isRefreshing, onRefresh]);

  return { isRefreshing, pullDistance, onTouchStart, onTouchMove, onTouchEnd, threshold: THRESHOLD };
}
```

**Step 2: Integrar no Jobs.tsx e Stores.tsx**

Envolver a lista principal com os handlers de touch. Mostrar indicador de refresh (spinner) no topo quando puxar:

```tsx
const { isRefreshing, pullDistance, onTouchStart, onTouchMove, onTouchEnd, threshold } = usePullRefresh(
  async () => { await refetch(); }
);

// No JSX, envolver a lista:
<div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
  {pullDistance > 0 && (
    <div className="flex justify-center py-2 transition-all" style={{ height: pullDistance }}>
      <Loader2 className={`text-blue-600 ${pullDistance >= threshold ? 'animate-spin' : ''}`} size={24} />
    </div>
  )}
  {isRefreshing && (
    <div className="flex justify-center py-3">
      <Loader2 className="animate-spin text-blue-600" size={20} />
    </div>
  )}
  {/* lista existente */}
</div>
```

**Step 3: Verificar build**

Run: `cd APP-Campo && npm run build`

**Step 4: Commit**

```bash
git add APP-Campo/src/hooks/use-pull-refresh.ts APP-Campo/src/pages/Jobs.tsx APP-Campo/src/pages/Stores.tsx
git commit -m "feat(campo): pull-to-refresh nas listas de Jobs e Stores"
```

---

### Task 14: Empty states padronizados

**Files:**
- Create: `APP-Campo/src/components/EmptyState.tsx`
- Modify: `APP-Campo/src/pages/Jobs.tsx`
- Modify: `APP-Campo/src/pages/Stores.tsx`

**Step 1: Criar componente EmptyState**

```tsx
// APP-Campo/src/components/EmptyState.tsx
import React from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
      <Icon size={40} className="mx-auto text-slate-300 mb-3" />
      <h3 className="font-semibold text-slate-600">{title}</h3>
      <p className="text-sm text-slate-400 mt-1">{description}</p>
      {action && (
        <Button onClick={action.onClick} className="mt-4 bg-blue-600 hover:bg-blue-700 rounded-xl">
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

**Step 2: Aplicar nos pages**

Em `Jobs.tsx`, quando a lista está vazia (após filtros):
```tsx
<EmptyState
  icon={ClipboardList}
  title="Nenhuma OS encontrada"
  description="Tente ajustar os filtros ou crie uma nova OS"
  action={{ label: "Nova OS", onClick: () => setIsJobSheetOpen(true) }}
/>
```

Em `Stores.tsx`, quando a lista está vazia:
```tsx
<EmptyState
  icon={Store}
  title="Nenhuma loja encontrada"
  description="Tente ajustar os filtros de busca"
/>
```

**Step 3: Verificar build**

Run: `cd APP-Campo && npm run build`

**Step 4: Commit**

```bash
git add APP-Campo/src/components/EmptyState.tsx APP-Campo/src/pages/Jobs.tsx APP-Campo/src/pages/Stores.tsx
git commit -m "feat(campo): empty states padronizados em Jobs e Stores"
```

---

## Resumo de Execução

| Task | Bloco | Estimativa | Risco |
|------|-------|-----------|-------|
| 1. Fix excluir OS | Bugs | Trivial | Zero |
| 2. Fix snake_case delete-user | Bugs | Trivial | Zero |
| 3. Debounce filtros | Bugs | Simples | Zero |
| 4. Select colunas | Bugs | Simples | Zero |
| 5. Alert início tempo | Campo | Simples | Baixo |
| 6. Checklist fixo | Campo | Médio | Baixo |
| 7. Code split JobDetail | Campo | Alto | Médio |
| 8. Indicador offline | Campo | Simples | Zero |
| 9. Instalar Recharts | Gestão | Trivial | Zero |
| 10. Analytics gráficos | Gestão | Alto | Baixo |
| 11. BillingReport | Gestão | Médio | Baixo |
| 12. Loading skeletons | Polish | Simples | Zero |
| 13. Pull-to-refresh | Polish | Médio | Baixo |
| 14. Empty states | Polish | Simples | Zero |

**Total: 14 tasks, 14 commits isolados**

**Ordem recomendada**: Tasks 1→14 sequencialmente (blocos já estão ordenados por prioridade).

**Task 7 (code split)** é a mais complexa — requer ler JobDetail.tsx inteiro (~900 linhas) e extrair com cuidado. Se der problema, pode ser pulada sem afetar o resto.
