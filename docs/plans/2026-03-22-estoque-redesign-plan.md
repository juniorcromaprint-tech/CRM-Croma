# Estoque Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the /estoque page from a card grid (496 cards) to a tabbed DataTable with server-side pagination, KPIs via RPC, and integrated sub-pages.

**Architecture:** Single-page with Tabs (Saldos | Movimentações | Inventário), DataTable with server-side pagination via Supabase `.range()`, KPIs via SQL RPC, Combobox for material selection, collapsible alerts sidebar via Sheet.

**Tech Stack:** React 19, shadcn/ui (Tabs, DataTable, Sheet, Command/Combobox), TanStack Query v5, Supabase RPC, Vitest

---

## Phase 1: Backend (RPC + Paginação)

### Task 1: Migration — RPC `rpc_estoque_kpis`

**Files:**
- Create: `supabase/migrations/093_estoque_kpis_rpc.sql`

**Step 1: Write the migration SQL**

```sql
-- 093_estoque_kpis_rpc.sql
-- RPC para KPIs do estoque — elimina fetch de 500 movimentações no client

CREATE OR REPLACE FUNCTION rpc_estoque_kpis()
RETURNS JSON
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'total_materiais', (SELECT COUNT(*) FROM v_estoque_semaforo),
    'critico', (SELECT COUNT(*) FROM v_estoque_semaforo WHERE semaforo = 'vermelho'),
    'atencao', (SELECT COUNT(*) FROM v_estoque_semaforo WHERE semaforo = 'amarelo'),
    'normal', (SELECT COUNT(*) FROM v_estoque_semaforo WHERE semaforo = 'verde'),
    'entradas_mes', (
      SELECT COALESCE(SUM(quantidade), 0)
      FROM estoque_movimentacoes
      WHERE tipo = 'entrada'
        AND created_at >= date_trunc('month', now())
    ),
    'saidas_mes', (
      SELECT COALESCE(SUM(quantidade), 0)
      FROM estoque_movimentacoes
      WHERE tipo = 'saida'
        AND created_at >= date_trunc('month', now())
    )
  );
$$;
```

**Step 2: Apply migration**

Run in Supabase SQL Editor at `supabase.com/dashboard/project/djwjmfgplnqyffdcgdaw/sql`

**Step 3: Test the RPC**

```sql
SELECT rpc_estoque_kpis();
```

Expected: JSON object with all 6 fields populated.

**Step 4: Commit**

```bash
git add supabase/migrations/093_estoque_kpis_rpc.sql
git commit -m "feat(estoque): RPC rpc_estoque_kpis — server-side KPIs"
```

---

### Task 2: Paginação server-side no service + hook

**Files:**
- Modify: `src/domains/estoque/services/estoqueService.ts`
- Modify: `src/domains/estoque/hooks/useEstoqueSaldos.ts`

**Step 1: Add paginated semaforo + KPIs to estoqueService.ts**

Add these methods after the existing `listarSemaforo`:

```typescript
// Add to estoqueService object:

async listarSemaforoPaginado(filtros?: {
  busca?: string;
  semaforo?: string;
  pagina?: number;
  porPagina?: number;
}) {
  const pagina = filtros?.pagina ?? 1;
  const porPagina = filtros?.porPagina ?? 25;
  const from = (pagina - 1) * porPagina;
  const to = from + porPagina - 1;

  let q = db.from("v_estoque_semaforo").select("*", { count: "exact" }).order("nome");
  if (filtros?.busca) q = q.ilike("nome", `%${filtros.busca}%`);
  if (filtros?.semaforo) q = q.eq("semaforo", filtros.semaforo);
  q = q.range(from, to);

  const { data, error, count } = await q;
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0 };
},

async buscarKPIs() {
  const { data, error } = await db.rpc("rpc_estoque_kpis");
  if (error) throw error;
  return data as {
    total_materiais: number;
    critico: number;
    atencao: number;
    normal: number;
    entradas_mes: number;
    saidas_mes: number;
  };
},
```

**Step 2: Add paginated hook to useEstoqueSaldos.ts**

Add after existing hooks:

```typescript
export function useEstoqueSemaforoPaginado(filtros?: {
  busca?: string;
  semaforo?: string;
  pagina?: number;
  porPagina?: number;
}) {
  return useQuery({
    queryKey: ["estoque-semaforo-pag", filtros],
    queryFn: () => estoqueService.listarSemaforoPaginado(filtros),
    placeholderData: (prev) => prev, // keepPreviousData equivalent in v5
  });
}

export function useEstoqueKPIs() {
  return useQuery({
    queryKey: ["estoque-kpis"],
    queryFn: () => estoqueService.buscarKPIs(),
    staleTime: 30_000, // 30s
  });
}
```

**Step 3: Run build to check types**

```bash
cd C:/Users/Caldera/Claude/CRM-Croma/.claude/worktrees/condescending-bassi && npx vite build 2>&1 | head -30
```

Expected: No errors related to estoque.

**Step 4: Commit**

```bash
git add src/domains/estoque/services/estoqueService.ts src/domains/estoque/hooks/useEstoqueSaldos.ts
git commit -m "feat(estoque): paginated semaforo + KPIs hook via RPC"
```

---

## Phase 2: UI — Tabs + DataTable

### Task 3: Rewrite EstoqueDashboardPage with Tabs + DataTable

**Files:**
- Modify: `src/domains/estoque/pages/EstoqueDashboardPage.tsx` (full rewrite)

**Step 1: Rewrite the page**

Replace entire content of `EstoqueDashboardPage.tsx` with:

```tsx
// src/domains/estoque/pages/EstoqueDashboardPage.tsx

import { useState, useMemo, lazy, Suspense } from "react";
import {
  Package, AlertTriangle, ArrowDownToLine, ArrowUpFromLine,
  Search, Loader2, Plus, Bell, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { SemaforoBadge } from "@/shared/components/SemaforoBadge";
import {
  useEstoqueSemaforoPaginado, useEstoqueKPIs, useAlertasEstoqueMinimo,
} from "../hooks/useEstoqueSaldos";
import { useCriarMovimentacao } from "../hooks/useMovimentacoes";
import { useSearchParams } from "react-router-dom";
import { formatDate } from "@/shared/utils/format";
import type { EstoqueSemaforo, SemaforoStatus } from "../types/estoque.types";

const MovimentacoesPage = lazy(() => import("./MovimentacoesPage"));
const InventarioPage = lazy(() => import("./InventarioPage"));

const TIPOS_MOV = [
  { value: "entrada", label: "Entrada" },
  { value: "saida", label: "Saída" },
  { value: "ajuste", label: "Ajuste" },
];

function KpiCard({ label, value, icon: Icon, iconBg, iconColor, highlight }: {
  label: string; value: string | number; icon: React.ElementType;
  iconBg: string; iconColor: string; highlight?: boolean;
}) {
  return (
    <Card className={`rounded-2xl border shadow-sm ${highlight ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <Icon size={22} className={iconColor} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide truncate">{label}</p>
          <p className={`text-xl font-bold mt-0.5 leading-tight font-mono ${highlight ? "text-red-700" : "text-slate-800"}`}>
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function KpiSkeleton() {
  return (
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardContent className="p-5 flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

const POR_PAGINA = 25;

export default function EstoqueDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "saldos";

  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [filtroSemaforo, setFiltroSemaforo] = useState<SemaforoStatus | "todos">("todos");
  const [pagina, setPagina] = useState(1);
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);
  const [ajusteForm, setAjusteForm] = useState({
    material_id: "", material_nome: "",
    tipo: "entrada" as "entrada" | "saida" | "ajuste",
    quantidade: "", observacao: "",
  });

  // Debounce busca 300ms
  const debounceRef = useState<ReturnType<typeof setTimeout> | null>(null);
  function handleBusca(value: string) {
    setBusca(value);
    if (debounceRef[0]) clearTimeout(debounceRef[0]);
    debounceRef[0] = setTimeout(() => {
      setBuscaDebounced(value);
      setPagina(1);
    }, 300);
  }

  // Data
  const { data: kpis, isLoading: loadingKpis } = useEstoqueKPIs();
  const { data: saldosResult, isLoading: loadingSaldos } = useEstoqueSemaforoPaginado({
    busca: buscaDebounced || undefined,
    semaforo: filtroSemaforo !== "todos" ? filtroSemaforo : undefined,
    pagina,
    porPagina: POR_PAGINA,
  });
  const { data: alertas = [] } = useAlertasEstoqueMinimo();

  const saldos = saldosResult?.data ?? [];
  const totalRegistros = saldosResult?.total ?? 0;
  const totalPaginas = Math.ceil(totalRegistros / POR_PAGINA);

  const criarMov = useCriarMovimentacao();

  // Alertas reais (excluir falso-positivos com estoque_minimo = 0)
  const alertasReais = useMemo(
    () => (alertas as EstoqueSemaforo[]).filter((a) => a.estoque_minimo > 0),
    [alertas]
  );

  function handleFiltroSemaforo(s: SemaforoStatus | "todos") {
    setFiltroSemaforo(s);
    setPagina(1);
  }

  function handleAjuste() {
    if (!ajusteForm.material_id || !ajusteForm.quantidade) return;
    criarMov.mutate(
      {
        material_id: ajusteForm.material_id,
        tipo: ajusteForm.tipo,
        quantidade: parseFloat(ajusteForm.quantidade),
        observacao: ajusteForm.observacao || undefined,
      },
      {
        onSuccess: () => {
          setAjusteOpen(false);
          setAjusteForm({ material_id: "", material_nome: "", tipo: "entrada", quantidade: "", observacao: "" });
        },
      }
    );
  }

  function setTab(tab: string) {
    setSearchParams({ tab }, { replace: true });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Estoque</h1>
          <p className="text-sm text-slate-400 mt-0.5">Saldos, alertas e movimentações de materiais</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Alertas Sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-xl relative">
                <Bell size={16} className="text-slate-500" />
                {alertasReais.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {alertasReais.length}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[380px]">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <AlertTriangle size={18} className="text-red-500" />
                  Alertas de Estoque ({alertasReais.length})
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-2 overflow-y-auto max-h-[calc(100vh-120px)]">
                {alertasReais.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">Nenhum material abaixo do mínimo</p>
                ) : (
                  alertasReais.map((a) => (
                    <div key={a.material_id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{a.nome}</p>
                        <p className="text-xs text-slate-400">Mínimo: {a.estoque_minimo} {a.unidade}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-mono font-bold text-slate-800">{a.saldo_disponivel}</p>
                        <p className="text-xs font-medium text-red-600">
                          {a.saldo_disponivel - a.estoque_minimo}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SheetContent>
          </Sheet>

          <Button onClick={() => setAjusteOpen(true)} className="bg-blue-600 hover:bg-blue-700 rounded-xl">
            <Plus size={16} className="mr-2" />
            Ajuste Manual
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingKpis ? (
          <>{[1,2,3,4].map(i => <KpiSkeleton key={i} />)}</>
        ) : (
          <>
            <KpiCard label="Total Materiais" value={kpis?.total_materiais ?? 0} icon={Package} iconBg="bg-blue-50" iconColor="text-blue-600" />
            <KpiCard label="Crítico (Vermelho)" value={kpis?.critico ?? 0} icon={AlertTriangle}
              iconBg={(kpis?.critico ?? 0) > 0 ? "bg-red-100" : "bg-slate-100"}
              iconColor={(kpis?.critico ?? 0) > 0 ? "text-red-600" : "text-slate-400"}
              highlight={(kpis?.critico ?? 0) > 0} />
            <KpiCard label="Entradas no Mês" value={(kpis?.entradas_mes ?? 0).toLocaleString("pt-BR")} icon={ArrowDownToLine} iconBg="bg-green-50" iconColor="text-green-600" />
            <KpiCard label="Saídas no Mês" value={(kpis?.saidas_mes ?? 0).toLocaleString("pt-BR")} icon={ArrowUpFromLine} iconBg="bg-orange-50" iconColor="text-orange-600" />
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList className="rounded-xl bg-slate-100 p-1">
          <TabsTrigger value="saldos" className="rounded-lg text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Saldos
          </TabsTrigger>
          <TabsTrigger value="movimentacoes" className="rounded-lg text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Movimentações
          </TabsTrigger>
          <TabsTrigger value="inventario" className="rounded-lg text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Inventário
          </TabsTrigger>
        </TabsList>

        {/* ── TAB: SALDOS ── */}
        <TabsContent value="saldos" className="mt-4 space-y-4">
          {/* Search + Semáforo filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Buscar material..." value={busca} onChange={(e) => handleBusca(e.target.value)} className="pl-9 rounded-xl" />
            </div>
            <div className="flex flex-wrap gap-2">
              {(["todos", "vermelho", "amarelo", "verde"] as const).map((s) => (
                <button key={s} onClick={() => handleFiltroSemaforo(s)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                    filtroSemaforo === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}>
                  {s !== "todos" && <SemaforoBadge status={s} size="sm" pulsing={false} />}
                  {s === "todos" ? `Todos (${kpis?.total_materiais ?? 0})`
                    : s === "vermelho" ? `Crítico (${kpis?.critico ?? 0})`
                    : s === "amarelo" ? `Atenção (${kpis?.atencao ?? 0})`
                    : `Normal (${kpis?.normal ?? 0})`}
                </button>
              ))}
            </div>
          </div>

          {/* DataTable */}
          {loadingSaldos ? (
            <Card className="rounded-2xl border-slate-200">
              <CardContent className="p-0">
                <div className="space-y-0">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-slate-100">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-4 w-20 ml-auto" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : saldos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Package size={40} className="mx-auto text-slate-300 mb-3" />
              <h3 className="font-semibold text-slate-600">
                {busca ? "Nenhum material encontrado" : "Sem saldos cadastrados"}
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                {busca ? `Nenhum material corresponde a "${busca}".` : "Registre movimentações para ver saldos aqui."}
              </p>
            </div>
          ) : (
            <Card className="rounded-2xl border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Material</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Disponível</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide hidden md:table-cell">Reservado</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide hidden lg:table-cell">Mínimo</th>
                      <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide hidden xl:table-cell">Última Mov.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(saldos as EstoqueSemaforo[]).map((s) => (
                      <tr key={s.material_id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <Package size={14} className="text-slate-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-800 truncate">{s.nome}</p>
                              <p className="text-xs text-slate-400">{s.unidade}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-slate-800">
                          {s.saldo_disponivel.toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-500 hidden md:table-cell">
                          {s.saldo_reservado > 0 ? (
                            <span className="text-amber-600">{s.saldo_reservado.toLocaleString("pt-BR")}</span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-500 hidden lg:table-cell">
                          {s.estoque_minimo > 0 ? s.estoque_minimo.toLocaleString("pt-BR") : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <SemaforoBadge status={s.semaforo} size="sm"
                            label={s.semaforo === "vermelho" ? "Crítico" : s.semaforo === "amarelo" ? "Atenção" : "OK"} />
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-slate-400 hidden xl:table-cell">
                          {s.ultima_movimentacao ? formatDate(s.ultima_movimentacao) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {totalPaginas > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                  <p className="text-xs text-slate-400">
                    {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, totalRegistros)} de {totalRegistros} materiais
                  </p>
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" className="rounded-xl h-8 w-8"
                      onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina === 1}>
                      <ChevronLeft size={14} />
                    </Button>
                    <span className="flex items-center px-3 text-xs text-slate-600 font-medium">
                      {pagina} / {totalPaginas}
                    </span>
                    <Button variant="outline" size="icon" className="rounded-xl h-8 w-8"
                      onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}>
                      <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </TabsContent>

        {/* ── TAB: MOVIMENTAÇÕES ── */}
        <TabsContent value="movimentacoes" className="mt-4">
          <Suspense fallback={<div className="flex items-center justify-center p-12 text-slate-400"><Loader2 size={20} className="animate-spin mr-2" />Carregando...</div>}>
            <MovimentacoesPage />
          </Suspense>
        </TabsContent>

        {/* ── TAB: INVENTÁRIO ── */}
        <TabsContent value="inventario" className="mt-4">
          <Suspense fallback={<div className="flex items-center justify-center p-12 text-slate-400"><Loader2 size={20} className="animate-spin mr-2" />Carregando...</div>}>
            <InventarioPage />
          </Suspense>
        </TabsContent>
      </Tabs>

      {/* Dialog ajuste manual com Combobox */}
      <Dialog open={ajusteOpen} onOpenChange={setAjusteOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Ajuste Manual de Estoque</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Material Combobox */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Material</Label>
              <Popover open={materialOpen} onOpenChange={setMaterialOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={materialOpen}
                    className="w-full justify-between rounded-xl font-normal">
                    {ajusteForm.material_nome || "Selecione o material..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[380px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar material..." />
                    <CommandList>
                      <CommandEmpty>Nenhum material encontrado.</CommandEmpty>
                      <CommandGroup>
                        {(saldos as EstoqueSemaforo[]).map((s) => (
                          <CommandItem key={s.material_id} value={s.nome}
                            onSelect={() => {
                              setAjusteForm((p) => ({ ...p, material_id: s.material_id, material_nome: `${s.nome} (${s.unidade})` }));
                              setMaterialOpen(false);
                            }}>
                            {s.nome} <span className="ml-auto text-xs text-slate-400">{s.unidade}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Tipo</Label>
              <Select value={ajusteForm.tipo}
                onValueChange={(v) => setAjusteForm((p) => ({ ...p, tipo: v as any }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_MOV.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Quantidade</Label>
              <Input type="number" step="any" placeholder="0" value={ajusteForm.quantidade}
                onChange={(e) => setAjusteForm((p) => ({ ...p, quantidade: e.target.value }))} className="rounded-xl" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Observação</Label>
              <Textarea placeholder="Motivo do ajuste..." value={ajusteForm.observacao}
                onChange={(e) => setAjusteForm((p) => ({ ...p, observacao: e.target.value }))}
                className="rounded-xl resize-none" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAjusteOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleAjuste}
              disabled={!ajusteForm.material_id || !ajusteForm.quantidade || criarMov.isPending}
              className="bg-blue-600 hover:bg-blue-700 rounded-xl">
              {criarMov.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 2: Run build**

```bash
cd C:/Users/Caldera/Claude/CRM-Croma/.claude/worktrees/condescending-bassi && npx vite build 2>&1 | tail -20
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/domains/estoque/pages/EstoqueDashboardPage.tsx
git commit -m "feat(estoque): tabs + DataTable + Combobox + collapsible alerts"
```

---

### Task 4: Route redirects for sub-pages

**Files:**
- Modify: `src/routes/suprimentosRoutes.tsx`

**Step 1: Add redirects for deep links**

Replace the estoque route definitions:

```tsx
// Replace lines 19-21 with:
<Route path="estoque" element={<PermissionGuard module="estoque" action="ver"><LazyPage><EstoqueDashboardPage /></LazyPage></PermissionGuard>} />
<Route path="estoque/movimentacoes" element={<Navigate to="/estoque?tab=movimentacoes" replace />} />
<Route path="estoque/inventario" element={<Navigate to="/estoque?tab=inventario" replace />} />
```

Add `Navigate` import at top:

```tsx
import { Route, Navigate } from "react-router-dom";
```

**Step 2: Commit**

```bash
git add src/routes/suprimentosRoutes.tsx
git commit -m "fix(estoque): redirect sub-routes to tabs"
```

---

### Task 5: Remove duplicate headers from sub-pages

**Files:**
- Modify: `src/domains/estoque/pages/MovimentacoesPage.tsx`
- Modify: `src/domains/estoque/pages/InventarioPage.tsx`

When rendered as tabs inside EstoqueDashboardPage, the sub-pages show duplicate headers. Remove the top `<div>` header with h1/subtitle from each, since the parent already has it.

**Step 1: MovimentacoesPage — remove header div (lines 150-167)**

Remove the block:
```tsx
{/* Header */}
<div className="flex items-start justify-between gap-4">
  <div>
    <h1 className="text-2xl font-bold text-slate-800">Movimentações</h1>
    ...
  </div>
  ...
</div>
```

Keep the Export CSV button, move it to the filter row.

**Step 2: InventarioPage — remove header div (lines 151-166)**

Remove the block:
```tsx
{/* Header */}
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-bold text-slate-800">Inventários</h1>
    ...
  </div>
  ...
</div>
```

Move the "Novo Inventário" button to be inline with the content.

**Step 3: Build and commit**

```bash
npx vite build 2>&1 | tail -10
git add src/domains/estoque/pages/MovimentacoesPage.tsx src/domains/estoque/pages/InventarioPage.tsx
git commit -m "fix(estoque): remove duplicate headers from sub-pages in tab mode"
```

---

## Phase 3: Polishing

### Task 6: Ensure shadcn components are installed

**Step 1: Check and install required components**

```bash
cd C:/Users/Caldera/Claude/CRM-Croma/.claude/worktrees/condescending-bassi
npx shadcn@latest add tabs sheet command popover --yes 2>&1
```

If components already exist, the CLI will skip them.

**Step 2: Commit any new components**

```bash
git add src/components/ui/
git commit -m "chore: add shadcn tabs, sheet, command, popover components"
```

---

### Task 7: Sidebar menu — sub-items under Estoque

**Files:**
- Find and modify the sidebar navigation component

**Step 1: Find sidebar file**

```bash
grep -r "Estoque" src/shared/components/ --include="*.tsx" -l
```

**Step 2: Remove sub-items for Movimentações/Inventário**

Since these are now tabs, the sidebar should only show "Estoque" as a single link (not expandable). Update accordingly.

**Step 3: Commit**

```bash
git add <sidebar-file>
git commit -m "fix(sidebar): estoque is single link, sub-pages are tabs"
```

---

### Task 8: Final build verification + tests

**Step 1: Full build**

```bash
cd C:/Users/Caldera/Claude/CRM-Croma/.claude/worktrees/condescending-bassi
npx vite build
```

**Step 2: Run existing tests**

```bash
npx vitest run --reporter=verbose 2>&1 | tail -30
```

**Step 3: Final commit with all remaining changes**

```bash
git add -A
git commit -m "feat(estoque): redesign completo — DataTable, tabs, KPIs RPC, paginação server-side"
```

---

## Summary

| Task | Description | Est. |
|------|-------------|------|
| 1 | Migration RPC `rpc_estoque_kpis` | 10min |
| 2 | Service + hooks paginação | 15min |
| 3 | Rewrite dashboard (tabs + DataTable + Combobox + Sheet) | 45min |
| 4 | Route redirects | 5min |
| 5 | Remove duplicate headers from sub-pages | 15min |
| 6 | Install shadcn components | 5min |
| 7 | Sidebar cleanup | 10min |
| 8 | Build verification + tests | 10min |
| **Total** | | **~2h** |
