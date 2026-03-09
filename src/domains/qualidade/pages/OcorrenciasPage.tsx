// ============================================================================
// OCORRENCIAS PAGE -- Croma Print ERP/CRM
// Gestao de Qualidade: Ocorrencias, Tratativas e Dashboard
// ============================================================================

import { useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";
import { brl, formatDate, formatDateRelative } from "@/shared/utils/format";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

import {
  AlertTriangle,
  Plus,
  Search,
  ShieldAlert,
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingUp,
  Eye,
  BarChart3,
  ListChecks,
  ChevronRight,
  Loader2,
  CalendarDays,
  Target,
  XCircle,
  RotateCcw,
  Package,
  Wrench,
  UserX,
  FileWarning,
  MessageSquarePlus,
  CircleDot,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

type OcorrenciaTipo =
  | "retrabalho"
  | "devolucao"
  | "erro_producao"
  | "erro_instalacao"
  | "divergencia_cliente";

type OcorrenciaStatus =
  | "aberta"
  | "em_analise"
  | "em_tratativa"
  | "resolvida"
  | "encerrada";

type ImpactoLevel = "baixo" | "medio" | "alto" | "critico";

type CausaRaiz =
  | "material_defeituoso"
  | "erro_operacional"
  | "erro_projeto"
  | "instrucao_incorreta"
  | "outro";

type TratativaStatus = "pendente" | "em_andamento" | "concluida" | "cancelada";

interface ClienteJoin {
  nome_fantasia: string | null;
  razao_social: string;
}

interface PedidoJoin {
  numero: string;
}

interface TratativaRow {
  id: string;
  ocorrencia_id: string;
  descricao: string;
  responsavel_id: string | null;
  prazo: string | null;
  status: TratativaStatus;
  created_at: string;
}

interface OcorrenciaRow {
  id: string;
  numero: string | null;
  tipo: OcorrenciaTipo;
  titulo: string;
  descricao: string | null;
  pedido_id: string | null;
  ordem_producao_id: string | null;
  ordem_instalacao_id: string | null;
  cliente_id: string | null;
  causa_raiz: string | null;
  status: OcorrenciaStatus;
  impacto: ImpactoLevel | null;
  custo_adicional: number | null;
  prazo_resolucao: string | null;
  resolvido_em: string | null;
  registrado_por: string | null;
  created_at: string;
  updated_at: string | null;
  clientes: ClienteJoin | null;
  pedidos: PedidoJoin | null;
  ocorrencia_tratativas: TratativaRow[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TIPO_OPTIONS: { value: OcorrenciaTipo; label: string }[] = [
  { value: "retrabalho", label: "Retrabalho" },
  { value: "devolucao", label: "Devolu\u00e7\u00e3o" },
  { value: "erro_producao", label: "Erro de Produ\u00e7\u00e3o" },
  { value: "erro_instalacao", label: "Erro de Instala\u00e7\u00e3o" },
  { value: "divergencia_cliente", label: "Diverg\u00eancia c/ Cliente" },
];

const STATUS_OPTIONS: { value: OcorrenciaStatus; label: string }[] = [
  { value: "aberta", label: "Aberta" },
  { value: "em_analise", label: "Em An\u00e1lise" },
  { value: "em_tratativa", label: "Em Tratativa" },
  { value: "resolvida", label: "Resolvida" },
  { value: "encerrada", label: "Encerrada" },
];

const IMPACTO_OPTIONS: { value: ImpactoLevel; label: string }[] = [
  { value: "baixo", label: "Baixo" },
  { value: "medio", label: "M\u00e9dio" },
  { value: "alto", label: "Alto" },
  { value: "critico", label: "Cr\u00edtico" },
];

const CAUSA_RAIZ_OPTIONS: { value: CausaRaiz; label: string }[] = [
  { value: "material_defeituoso", label: "Material Defeituoso" },
  { value: "erro_operacional", label: "Erro Operacional" },
  { value: "erro_projeto", label: "Erro de Projeto" },
  { value: "instrucao_incorreta", label: "Instru\u00e7\u00e3o Incorreta" },
  { value: "outro", label: "Outro" },
];

const TRATATIVA_STATUS_OPTIONS: { value: TratativaStatus; label: string }[] = [
  { value: "pendente", label: "Pendente" },
  { value: "em_andamento", label: "Em Andamento" },
  { value: "concluida", label: "Conclu\u00edda" },
  { value: "cancelada", label: "Cancelada" },
];

const TIPO_CONFIG: Record<OcorrenciaTipo, { label: string; color: string; icon: typeof AlertTriangle }> = {
  retrabalho: { label: "Retrabalho", color: "bg-red-100 text-red-700 border-red-200", icon: RotateCcw },
  devolucao: { label: "Devolu\u00e7\u00e3o", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Package },
  erro_producao: { label: "Erro Produ\u00e7\u00e3o", color: "bg-orange-100 text-orange-700 border-orange-200", icon: Wrench },
  erro_instalacao: { label: "Erro Instala\u00e7\u00e3o", color: "bg-purple-100 text-purple-700 border-purple-200", icon: AlertTriangle },
  divergencia_cliente: { label: "Diverg. Cliente", color: "bg-blue-100 text-blue-700 border-blue-200", icon: UserX },
};

const STATUS_CONFIG: Record<OcorrenciaStatus, { label: string; color: string }> = {
  aberta: { label: "Aberta", color: "bg-red-100 text-red-700 border-red-200" },
  em_analise: { label: "Em An\u00e1lise", color: "bg-amber-100 text-amber-700 border-amber-200" },
  em_tratativa: { label: "Em Tratativa", color: "bg-blue-100 text-blue-700 border-blue-200" },
  resolvida: { label: "Resolvida", color: "bg-green-100 text-green-700 border-green-200" },
  encerrada: { label: "Encerrada", color: "bg-slate-100 text-slate-600 border-slate-200" },
};

const IMPACTO_CONFIG: Record<ImpactoLevel, { label: string; color: string }> = {
  baixo: { label: "Baixo", color: "bg-slate-100 text-slate-600 border-slate-200" },
  medio: { label: "M\u00e9dio", color: "bg-amber-100 text-amber-700 border-amber-200" },
  alto: { label: "Alto", color: "bg-orange-100 text-orange-700 border-orange-200" },
  critico: { label: "Cr\u00edtico", color: "bg-red-100 text-red-700 border-red-200" },
};

const TRATATIVA_STATUS_CONFIG: Record<TratativaStatus, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-amber-100 text-amber-700 border-amber-200" },
  em_andamento: { label: "Em Andamento", color: "bg-blue-100 text-blue-700 border-blue-200" },
  concluida: { label: "Conclu\u00edda", color: "bg-green-100 text-green-700 border-green-200" },
  cancelada: { label: "Cancelada", color: "bg-slate-100 text-slate-600 border-slate-200" },
};

const CAUSA_RAIZ_LABELS: Record<string, string> = {
  material_defeituoso: "Material Defeituoso",
  erro_operacional: "Erro Operacional",
  erro_projeto: "Erro de Projeto",
  instrucao_incorreta: "Instru\u00e7\u00e3o Incorreta",
  outro: "Outro",
};

// Status workflow: allowed transitions
const STATUS_TRANSITIONS: Record<OcorrenciaStatus, OcorrenciaStatus[]> = {
  aberta: ["em_analise"],
  em_analise: ["em_tratativa", "resolvida"],
  em_tratativa: ["resolvida"],
  resolvida: ["encerrada", "em_tratativa"],
  encerrada: [],
};

// ============================================================================
// HOOKS
// ============================================================================

function useOcorrencias() {
  return useQuery({
    queryKey: ["ocorrencias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ocorrencias")
        .select("*, clientes(nome_fantasia, razao_social), pedidos(numero), ocorrencia_tratativas(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OcorrenciaRow[];
    },
  });
}

function useClientes() {
  return useQuery({
    queryKey: ["clientes-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome_fantasia, razao_social")
        .order("nome_fantasia");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function usePedidos() {
  return useQuery({
    queryKey: ["pedidos-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("id, numero")
        .order("numero", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ============================================================================
// HELPERS
// ============================================================================

function generateNumero(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `OC-${year}-${seq}`;
}

function getClienteName(oc: OcorrenciaRow): string {
  if (!oc.clientes) return "--";
  return oc.clientes.nome_fantasia || oc.clientes.razao_social;
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function OcorrenciasPage() {
  const [activeTab, setActiveTab] = useState("ocorrencias");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedOcorrencia, setSelectedOcorrencia] = useState<OcorrenciaRow | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterImpacto, setFilterImpacto] = useState<string>("todos");

  const queryClient = useQueryClient();
  const { data: ocorrencias = [], isLoading } = useOcorrencias();
  const { data: clientes = [] } = useClientes();
  const { data: pedidos = [] } = usePedidos();

  // ── Filtered data ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = ocorrencias;
    if (filterTipo !== "todos") list = list.filter((o) => o.tipo === filterTipo);
    if (filterStatus !== "todos") list = list.filter((o) => o.status === filterStatus);
    if (filterImpacto !== "todos") list = list.filter((o) => o.impacto === filterImpacto);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.titulo.toLowerCase().includes(q) ||
          (o.numero ?? "").toLowerCase().includes(q) ||
          getClienteName(o).toLowerCase().includes(q)
      );
    }
    return list;
  }, [ocorrencias, filterTipo, filterStatus, filterImpacto, search]);

  // ── KPI stats ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const abertas = ocorrencias.filter((o) => o.status === "aberta" || o.status === "em_analise").length;
    const emTratativa = ocorrencias.filter((o) => o.status === "em_tratativa").length;
    const custoTotal = ocorrencias.reduce((sum, o) => sum + (o.custo_adicional ?? 0), 0);
    const total = ocorrencias.length;
    const resolvidas = ocorrencias.filter((o) => o.status === "resolvida" || o.status === "encerrada").length;
    const taxaResolucao = total > 0 ? Math.round((resolvidas / total) * 100) : 0;
    return { abertas, emTratativa, custoTotal, taxaResolucao, total, resolvidas };
  }, [ocorrencias]);

  // ── Create mutation ──────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (form: {
      tipo: OcorrenciaTipo;
      titulo: string;
      descricao: string;
      pedido_id: string | null;
      cliente_id: string | null;
      impacto: ImpactoLevel | null;
      custo_adicional: number;
      prazo_resolucao: string | null;
      causa_raiz: CausaRaiz | null;
    }) => {
      const { error } = await supabase.from("ocorrencias").insert({
        numero: generateNumero(),
        tipo: form.tipo,
        titulo: form.titulo,
        descricao: form.descricao || null,
        pedido_id: form.pedido_id || null,
        cliente_id: form.cliente_id || null,
        impacto: form.impacto || null,
        custo_adicional: form.custo_adicional || 0,
        prazo_resolucao: form.prazo_resolucao || null,
        causa_raiz: form.causa_raiz || null,
        status: "aberta",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ocorrencias"] });
      showSuccess("Ocorr\u00eancia registrada com sucesso!");
      setShowCreateDialog(false);
    },
    onError: (err: Error) => showError(err.message),
  });

  // ── Update status mutation ───────────────────────────────────────────────
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OcorrenciaStatus }) => {
      const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (status === "resolvida") updates.resolvido_em = new Date().toISOString();
      const { error } = await supabase.from("ocorrencias").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ocorrencias"] });
      showSuccess("Status atualizado!");
      // Refresh detail if open
      if (selectedOcorrencia) {
        const updated = ocorrencias.find((o) => o.id === selectedOcorrencia.id);
        if (updated) setSelectedOcorrencia(updated);
      }
    },
    onError: (err: Error) => showError(err.message),
  });

  // ── Add tratativa mutation ───────────────────────────────────────────────
  const addTratativaMutation = useMutation({
    mutationFn: async (form: { ocorrencia_id: string; descricao: string; prazo: string | null }) => {
      const { error } = await supabase.from("ocorrencia_tratativas").insert({
        ocorrencia_id: form.ocorrencia_id,
        descricao: form.descricao,
        prazo: form.prazo || null,
        status: "pendente",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ocorrencias"] });
      showSuccess("Tratativa adicionada!");
    },
    onError: (err: Error) => showError(err.message),
  });

  // ── Update tratativa status ──────────────────────────────────────────────
  const updateTratativaMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TratativaStatus }) => {
      const { error } = await supabase
        .from("ocorrencia_tratativas")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ocorrencias"] });
      showSuccess("Tratativa atualizada!");
    },
    onError: (err: Error) => showError(err.message),
  });

  // ── Update occurrence fields ─────────────────────────────────────────────
  const updateOcorrenciaMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("ocorrencias")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ocorrencias"] });
      showSuccess("Ocorr\u00eancia atualizada!");
    },
    onError: (err: Error) => showError(err.message),
  });

  // ── Dashboard data ───────────────────────────────────────────────────────
  const dashboardData = useMemo(() => {
    // By tipo
    const byTipo = TIPO_OPTIONS.map((t) => ({
      tipo: t.value,
      label: t.label,
      count: ocorrencias.filter((o) => o.tipo === t.value).length,
    }));

    // By month (last 6 months)
    const now = new Date();
    const months: { key: string; label: string; count: number; custo: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const label = `${monthNames[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
      const inMonth = ocorrencias.filter((o) => o.created_at?.startsWith(key));
      months.push({ key, label, count: inMonth.length, custo: inMonth.reduce((s, o) => s + (o.custo_adicional ?? 0), 0) });
    }

    // Top 5 causa raiz
    const causaMap = new Map<string, number>();
    ocorrencias.forEach((o) => {
      if (o.causa_raiz) {
        causaMap.set(o.causa_raiz, (causaMap.get(o.causa_raiz) ?? 0) + 1);
      }
    });
    const topCausas = [...causaMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([causa, count]) => ({ causa, label: CAUSA_RAIZ_LABELS[causa] ?? causa, count }));

    // Maxes for bar chart scaling
    const maxMonthCount = Math.max(...months.map((m) => m.count), 1);
    const maxMonthCusto = Math.max(...months.map((m) => m.custo), 1);

    return { byTipo, months, topCausas, maxMonthCount, maxMonthCusto };
  }, [ocorrencias]);

  // ────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-blue-600" />
            Gest\u00e3o de Qualidade
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Ocorr\u00eancias, tratativas e indicadores de qualidade
          </p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          onClick={() => setShowCreateDialog(true)}
        >
          <Plus className="h-4 w-4" />
          Nova Ocorr\u00eancia
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100">
          <TabsTrigger value="ocorrencias" className="gap-1.5 data-[state=active]:bg-white">
            <ListChecks className="h-4 w-4" />
            Ocorr\u00eancias
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-1.5 data-[state=active]:bg-white">
            <BarChart3 className="h-4 w-4" />
            Dashboard Qualidade
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 1: OCORRENCIAS
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="ocorrencias" className="mt-4 flex flex-col gap-5">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Abertas"
              value={String(stats.abertas)}
              icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
              accent="bg-red-50 border-red-200"
            />
            <KPICard
              label="Em Tratativa"
              value={String(stats.emTratativa)}
              icon={<Wrench className="h-5 w-5 text-blue-500" />}
              accent="bg-blue-50 border-blue-200"
            />
            <KPICard
              label="Custo Total"
              value={brl(stats.custoTotal)}
              icon={<DollarSign className="h-5 w-5 text-amber-600" />}
              accent="bg-amber-50 border-amber-200"
            />
            <KPICard
              label="Taxa Resolu\u00e7\u00e3o"
              value={`${stats.taxaResolucao}%`}
              icon={<TrendingUp className="h-5 w-5 text-green-600" />}
              accent="bg-green-50 border-green-200"
              subtitle={`${stats.resolvidas} de ${stats.total}`}
            />
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por t\u00edtulo, n\u00famero ou cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Tipos</SelectItem>
                {TIPO_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterImpacto} onValueChange={setFilterImpacto}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Impacto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {IMPACTO_OPTIONS.map((i) => (
                  <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Loading */}
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <ShieldAlert className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-lg font-medium">Nenhuma ocorr\u00eancia encontrada</p>
              <p className="text-sm mt-1">Ajuste os filtros ou registre uma nova ocorr\u00eancia</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((oc) => (
                <OcorrenciaCard
                  key={oc.id}
                  oc={oc}
                  onClick={() => setSelectedOcorrencia(oc)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 2: DASHBOARD QUALIDADE
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="dashboard" className="mt-4 flex flex-col gap-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
            </div>
          ) : ocorrencias.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <BarChart3 className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-lg font-medium">Sem dados para o dashboard</p>
              <p className="text-sm mt-1">Registre ocorr\u00eancias para ver os indicadores</p>
            </div>
          ) : (
            <>
              {/* Row 1: By Tipo + By Month */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Donut / Summary by Tipo */}
                <Card className="rounded-2xl border-slate-200">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                      <FileWarning className="h-4 w-4 text-blue-600" />
                      Ocorr\u00eancias por Tipo
                    </h3>
                    <div className="flex items-center gap-6">
                      {/* Simple donut visualization */}
                      <DonutChart data={dashboardData.byTipo} total={ocorrencias.length} />
                      <div className="flex flex-col gap-2 flex-1">
                        {dashboardData.byTipo.map((item) => {
                          const cfg = TIPO_CONFIG[item.tipo];
                          const pct = ocorrencias.length > 0 ? Math.round((item.count / ocorrencias.length) * 100) : 0;
                          return (
                            <div key={item.tipo} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className={`inline-block w-3 h-3 rounded-full ${cfg.color.split(" ")[0]}`} />
                                <span className="text-slate-600">{item.label}</span>
                              </div>
                              <span className="font-semibold text-slate-800">
                                {item.count} <span className="text-slate-400 font-normal">({pct}%)</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Bar chart: By Month */}
                <Card className="rounded-2xl border-slate-200">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-blue-600" />
                      Ocorr\u00eancias por M\u00eas (6 meses)
                    </h3>
                    <div className="flex items-end gap-3 h-40">
                      {dashboardData.months.map((m) => {
                        const height = dashboardData.maxMonthCount > 0
                          ? Math.max((m.count / dashboardData.maxMonthCount) * 100, 4)
                          : 4;
                        return (
                          <div key={m.key} className="flex flex-col items-center flex-1 gap-1">
                            <span className="text-xs font-semibold text-slate-700">{m.count}</span>
                            <div
                              className="w-full bg-blue-500 rounded-t-lg transition-all"
                              style={{ height: `${height}%` }}
                            />
                            <span className="text-[10px] text-slate-500 mt-1">{m.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Row 2: Top Causas + Custo por Mes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top 5 Causa Raiz */}
                <Card className="rounded-2xl border-slate-200">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                      <Target className="h-4 w-4 text-blue-600" />
                      Top 5 Causas Raiz
                    </h3>
                    {dashboardData.topCausas.length === 0 ? (
                      <p className="text-sm text-slate-400 py-4 text-center">Nenhuma causa raiz registrada</p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {dashboardData.topCausas.map((c, idx) => {
                          const maxCount = dashboardData.topCausas[0]?.count ?? 1;
                          const barWidth = Math.max((c.count / maxCount) * 100, 8);
                          return (
                            <div key={c.causa}>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-slate-600">
                                  <span className="font-semibold text-slate-800 mr-1.5">#{idx + 1}</span>
                                  {c.label}
                                </span>
                                <span className="font-semibold text-slate-800">{c.count}</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2">
                                <div
                                  className="bg-blue-500 h-2 rounded-full transition-all"
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Custo por Mes */}
                <Card className="rounded-2xl border-slate-200">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                      Custo Adicional por M\u00eas
                    </h3>
                    <div className="flex items-end gap-3 h-40">
                      {dashboardData.months.map((m) => {
                        const height = dashboardData.maxMonthCusto > 0
                          ? Math.max((m.custo / dashboardData.maxMonthCusto) * 100, 4)
                          : 4;
                        return (
                          <div key={m.key} className="flex flex-col items-center flex-1 gap-1">
                            <span className="text-[10px] font-semibold text-slate-700 truncate max-w-full">
                              {m.custo > 0 ? brl(m.custo) : "--"}
                            </span>
                            <div
                              className="w-full bg-amber-500 rounded-t-lg transition-all"
                              style={{ height: `${height}%` }}
                            />
                            <span className="text-[10px] text-slate-500 mt-1">{m.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Row 3: Comparativo retrabalho vs total */}
              <Card className="rounded-2xl border-slate-200">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    Comparativo: Retrabalhos vs Total de Ocorr\u00eancias
                  </h3>
                  <div className="grid grid-cols-3 gap-6 text-center">
                    <div>
                      <p className="text-3xl font-bold text-red-600">
                        {ocorrencias.filter((o) => o.tipo === "retrabalho").length}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">Retrabalhos</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-slate-800">{ocorrencias.length}</p>
                      <p className="text-sm text-slate-500 mt-1">Total Ocorr\u00eancias</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-blue-600">
                        {ocorrencias.length > 0
                          ? `${Math.round(
                              (ocorrencias.filter((o) => o.tipo === "retrabalho").length / ocorrencias.length) * 100
                            )}%`
                          : "0%"}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">Taxa Retrabalho</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════════════════════════════
          CREATE DIALOG
      ═══════════════════════════════════════════════════════════════════════ */}
      <CreateOcorrenciaDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={(form) => createMutation.mutate(form)}
        isLoading={createMutation.isPending}
        clientes={clientes}
        pedidos={pedidos}
      />

      {/* ═══════════════════════════════════════════════════════════════════════
          DETAIL DIALOG
      ═══════════════════════════════════════════════════════════════════════ */}
      {selectedOcorrencia && (
        <DetailDialog
          oc={selectedOcorrencia}
          open={!!selectedOcorrencia}
          onClose={() => setSelectedOcorrencia(null)}
          onStatusChange={(id, status) => updateStatusMutation.mutate({ id, status })}
          onAddTratativa={(form) => addTratativaMutation.mutate(form)}
          onUpdateTratativa={(id, status) => updateTratativaMutation.mutate({ id, status })}
          onUpdateOcorrencia={(id, updates) => updateOcorrenciaMutation.mutate({ id, updates })}
          isUpdating={updateStatusMutation.isPending || addTratativaMutation.isPending || updateTratativaMutation.isPending}
          ocorrencias={ocorrencias}
        />
      )}
    </div>
  );
}

// ============================================================================
// KPI CARD
// ============================================================================

function KPICard({
  label,
  value,
  icon,
  accent,
  subtitle,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
  subtitle?: string;
}) {
  return (
    <Card className={`rounded-2xl border ${accent}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="shrink-0">{icon}</div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">{label}</p>
          <p className="text-xl font-bold text-slate-800">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// OCORRENCIA CARD
// ============================================================================

function OcorrenciaCard({ oc, onClick }: { oc: OcorrenciaRow; onClick: () => void }) {
  const tipoCfg = TIPO_CONFIG[oc.tipo] ?? TIPO_CONFIG.retrabalho;
  const statusCfg = STATUS_CONFIG[oc.status] ?? STATUS_CONFIG.aberta;
  const impactoCfg = oc.impacto ? IMPACTO_CONFIG[oc.impacto] : null;
  const TipoIcon = tipoCfg.icon;
  const clienteName = getClienteName(oc);

  return (
    <Card
      className="rounded-2xl border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <TipoIcon className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="text-xs font-mono text-slate-400">{oc.numero ?? "--"}</span>
            <Badge className={`text-[10px] px-1.5 py-0 border ${tipoCfg.color}`}>
              {tipoCfg.label}
            </Badge>
            <Badge className={`text-[10px] px-1.5 py-0 border ${statusCfg.color}`}>
              {statusCfg.label}
            </Badge>
            {impactoCfg && (
              <Badge className={`text-[10px] px-1.5 py-0 border ${impactoCfg.color}`}>
                {impactoCfg.label}
              </Badge>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-slate-300 shrink-0 mt-0.5" />
        </div>

        <h3 className="text-sm font-semibold text-slate-800 truncate">{oc.titulo}</h3>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          {clienteName !== "--" && (
            <span className="flex items-center gap-1">
              <UserX className="h-3 w-3" />
              {clienteName}
            </span>
          )}
          {oc.pedidos?.numero && (
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              {oc.pedidos.numero}
            </span>
          )}
          {(oc.custo_adicional ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-amber-600 font-medium">
              <DollarSign className="h-3 w-3" />
              {brl(oc.custo_adicional ?? 0)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDateRelative(oc.created_at)}
          </span>
          {oc.ocorrencia_tratativas?.length > 0 && (
            <span className="flex items-center gap-1">
              <ListChecks className="h-3 w-3" />
              {oc.ocorrencia_tratativas.length} tratativa{oc.ocorrencia_tratativas.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CREATE DIALOG
// ============================================================================

function CreateOcorrenciaDialog({
  open,
  onClose,
  onSubmit,
  isLoading,
  clientes,
  pedidos,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (form: {
    tipo: OcorrenciaTipo;
    titulo: string;
    descricao: string;
    pedido_id: string | null;
    cliente_id: string | null;
    impacto: ImpactoLevel | null;
    custo_adicional: number;
    prazo_resolucao: string | null;
    causa_raiz: CausaRaiz | null;
  }) => void;
  isLoading: boolean;
  clientes: { id: string; nome_fantasia: string | null; razao_social: string }[];
  pedidos: { id: string; numero: string }[];
}) {
  const [tipo, setTipo] = useState<OcorrenciaTipo>("retrabalho");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [pedidoId, setPedidoId] = useState<string>("");
  const [clienteId, setClienteId] = useState<string>("");
  const [impacto, setImpacto] = useState<string>("");
  const [custoAdicional, setCustoAdicional] = useState("");
  const [prazoResolucao, setPrazoResolucao] = useState("");
  const [causaRaiz, setCausaRaiz] = useState<string>("");

  const handleSubmit = () => {
    if (!titulo.trim()) {
      showError("Informe o t\u00edtulo da ocorr\u00eancia");
      return;
    }
    onSubmit({
      tipo,
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      pedido_id: pedidoId || null,
      cliente_id: clienteId || null,
      impacto: (impacto as ImpactoLevel) || null,
      custo_adicional: parseFloat(custoAdicional) || 0,
      prazo_resolucao: prazoResolucao || null,
      causa_raiz: (causaRaiz as CausaRaiz) || null,
    });
    // Reset form
    setTipo("retrabalho");
    setTitulo("");
    setDescricao("");
    setPedidoId("");
    setClienteId("");
    setImpacto("");
    setCustoAdicional("");
    setPrazoResolucao("");
    setCausaRaiz("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <Plus className="h-5 w-5 text-blue-600" />
            Nova Ocorr\u00eancia
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          {/* Tipo */}
          <div>
            <Label className="text-slate-600">Tipo *</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as OcorrenciaTipo)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPO_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Titulo */}
          <div>
            <Label className="text-slate-600">T\u00edtulo *</Label>
            <Input
              className="mt-1"
              placeholder="Descreva brevemente a ocorr\u00eancia..."
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          {/* Descricao */}
          <div>
            <Label className="text-slate-600">Descri\u00e7\u00e3o</Label>
            <Textarea
              className="mt-1"
              rows={3}
              placeholder="Detalhes sobre a ocorr\u00eancia..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          {/* Pedido + Cliente */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-600">Pedido</Label>
              <Select value={pedidoId} onValueChange={setPedidoId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="(Opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {pedidos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.numero}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-600">Cliente</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="(Opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_fantasia || c.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Impacto + Causa Raiz */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-600">Impacto</Label>
              <Select value={impacto} onValueChange={setImpacto}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">N\u00e3o definido</SelectItem>
                  {IMPACTO_OPTIONS.map((i) => (
                    <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-600">Causa Raiz</Label>
              <Select value={causaRaiz} onValueChange={setCausaRaiz}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">N\u00e3o identificada</SelectItem>
                  {CAUSA_RAIZ_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Custo + Prazo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-600">Custo Adicional (R$)</Label>
              <Input
                className="mt-1"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={custoAdicional}
                onChange={(e) => setCustoAdicional(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-slate-600">Prazo Resolu\u00e7\u00e3o</Label>
              <Input
                className="mt-1"
                type="date"
                value={prazoResolucao}
                onChange={(e) => setPrazoResolucao(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar Ocorr\u00eancia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// DETAIL DIALOG
// ============================================================================

function DetailDialog({
  oc,
  open,
  onClose,
  onStatusChange,
  onAddTratativa,
  onUpdateTratativa,
  onUpdateOcorrencia,
  isUpdating,
  ocorrencias,
}: {
  oc: OcorrenciaRow;
  open: boolean;
  onClose: () => void;
  onStatusChange: (id: string, status: OcorrenciaStatus) => void;
  onAddTratativa: (form: { ocorrencia_id: string; descricao: string; prazo: string | null }) => void;
  onUpdateTratativa: (id: string, status: TratativaStatus) => void;
  onUpdateOcorrencia: (id: string, updates: Record<string, unknown>) => void;
  isUpdating: boolean;
  ocorrencias: OcorrenciaRow[];
}) {
  // Get fresh data from the list
  const fresh = ocorrencias.find((o) => o.id === oc.id) ?? oc;

  const [novaTratativa, setNovaTratativa] = useState("");
  const [novaTratativaPrazo, setNovaTratativaPrazo] = useState("");
  const [showAddTratativa, setShowAddTratativa] = useState(false);

  const tipoCfg = TIPO_CONFIG[fresh.tipo] ?? TIPO_CONFIG.retrabalho;
  const statusCfg = STATUS_CONFIG[fresh.status] ?? STATUS_CONFIG.aberta;
  const impactoCfg = fresh.impacto ? IMPACTO_CONFIG[fresh.impacto] : null;
  const clienteName = getClienteName(fresh);
  const allowedTransitions = STATUS_TRANSITIONS[fresh.status] ?? [];
  const tratativas = fresh.ocorrencia_tratativas ?? [];

  const handleAddTratativa = () => {
    if (!novaTratativa.trim()) {
      showError("Informe a descri\u00e7\u00e3o da tratativa");
      return;
    }
    onAddTratativa({
      ocorrencia_id: fresh.id,
      descricao: novaTratativa.trim(),
      prazo: novaTratativaPrazo || null,
    });
    setNovaTratativa("");
    setNovaTratativaPrazo("");
    setShowAddTratativa(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <Eye className="h-5 w-5 text-blue-600" />
            <span className="font-mono text-sm text-slate-400 mr-1">{fresh.numero}</span>
            {fresh.titulo}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 mt-2">
          {/* Badges row */}
          <div className="flex flex-wrap gap-2">
            <Badge className={`border ${tipoCfg.color}`}>{tipoCfg.label}</Badge>
            <Badge className={`border ${statusCfg.color}`}>{statusCfg.label}</Badge>
            {impactoCfg && <Badge className={`border ${impactoCfg.color}`}>Impacto: {impactoCfg.label}</Badge>}
            {fresh.causa_raiz && (
              <Badge className="border bg-slate-100 text-slate-600 border-slate-200">
                Causa: {CAUSA_RAIZ_LABELS[fresh.causa_raiz] ?? fresh.causa_raiz}
              </Badge>
            )}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <span className="text-slate-500">Cliente:</span>
              <span className="ml-2 font-medium text-slate-800">{clienteName}</span>
            </div>
            <div>
              <span className="text-slate-500">Pedido:</span>
              <span className="ml-2 font-medium text-slate-800">{fresh.pedidos?.numero ?? "--"}</span>
            </div>
            <div>
              <span className="text-slate-500">Custo Adicional:</span>
              <span className="ml-2 font-medium text-amber-700">{brl(fresh.custo_adicional ?? 0)}</span>
            </div>
            <div>
              <span className="text-slate-500">Prazo Resolu\u00e7\u00e3o:</span>
              <span className="ml-2 font-medium text-slate-800">
                {fresh.prazo_resolucao ? formatDate(fresh.prazo_resolucao) : "--"}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Registrada em:</span>
              <span className="ml-2 font-medium text-slate-800">{formatDate(fresh.created_at)}</span>
            </div>
            {fresh.resolvido_em && (
              <div>
                <span className="text-slate-500">Resolvida em:</span>
                <span className="ml-2 font-medium text-green-700">{formatDate(fresh.resolvido_em)}</span>
              </div>
            )}
          </div>

          {/* Descricao */}
          {fresh.descricao && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Descri\u00e7\u00e3o</p>
              <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3 whitespace-pre-wrap">
                {fresh.descricao}
              </p>
            </div>
          )}

          {/* Status workflow buttons */}
          {allowedTransitions.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Avan\u00e7ar Status</p>
              <div className="flex flex-wrap gap-2">
                {allowedTransitions.map((nextStatus) => {
                  const cfg = STATUS_CONFIG[nextStatus];
                  return (
                    <Button
                      key={nextStatus}
                      size="sm"
                      variant="outline"
                      className={`gap-1.5 border ${cfg.color} hover:opacity-80`}
                      onClick={() => onStatusChange(fresh.id, nextStatus)}
                      disabled={isUpdating}
                    >
                      {isUpdating && <Loader2 className="h-3 w-3 animate-spin" />}
                      {cfg.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          <Separator />

          {/* ── TRATATIVAS SECTION ────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium flex items-center gap-1.5">
                <ListChecks className="h-3.5 w-3.5" />
                Tratativas ({tratativas.length})
              </p>
              {fresh.status !== "encerrada" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-blue-600 hover:text-blue-700"
                  onClick={() => setShowAddTratativa(true)}
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  Adicionar
                </Button>
              )}
            </div>

            {/* Add tratativa form */}
            {showAddTratativa && (
              <div className="bg-blue-50 rounded-xl p-3 mb-3 flex flex-col gap-2 border border-blue-100">
                <Textarea
                  rows={2}
                  placeholder="Descreva a a\u00e7\u00e3o de tratativa..."
                  value={novaTratativa}
                  onChange={(e) => setNovaTratativa(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    className="max-w-[180px]"
                    value={novaTratativaPrazo}
                    onChange={(e) => setNovaTratativaPrazo(e.target.value)}
                    placeholder="Prazo"
                  />
                  <div className="flex-1" />
                  <Button size="sm" variant="ghost" onClick={() => setShowAddTratativa(false)}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white gap-1"
                    onClick={handleAddTratativa}
                    disabled={isUpdating}
                  >
                    {isUpdating && <Loader2 className="h-3 w-3 animate-spin" />}
                    Salvar
                  </Button>
                </div>
              </div>
            )}

            {/* Tratativas list */}
            {tratativas.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Nenhuma tratativa registrada</p>
            ) : (
              <div className="flex flex-col gap-2">
                {tratativas
                  .slice()
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((t) => {
                    const tCfg = TRATATIVA_STATUS_CONFIG[t.status] ?? TRATATIVA_STATUS_CONFIG.pendente;
                    return (
                      <div
                        key={t.id}
                        className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col gap-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-slate-700 flex-1">{t.descricao}</p>
                          <Badge className={`text-[10px] px-1.5 py-0 border shrink-0 ${tCfg.color}`}>
                            {tCfg.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span>{formatDateRelative(t.created_at)}</span>
                          {t.prazo && <span>Prazo: {formatDate(t.prazo)}</span>}
                        </div>
                        {/* Tratativa status buttons */}
                        {t.status !== "concluida" && t.status !== "cancelada" && fresh.status !== "encerrada" && (
                          <div className="flex gap-1.5 mt-1">
                            {t.status === "pendente" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs gap-1 text-blue-600"
                                onClick={() => onUpdateTratativa(t.id, "em_andamento")}
                                disabled={isUpdating}
                              >
                                <CircleDot className="h-3 w-3" />
                                Iniciar
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs gap-1 text-green-600"
                              onClick={() => onUpdateTratativa(t.id, "concluida")}
                              disabled={isUpdating}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Concluir
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs gap-1 text-slate-400"
                              onClick={() => onUpdateTratativa(t.id, "cancelada")}
                              disabled={isUpdating}
                            >
                              <XCircle className="h-3 w-3" />
                              Cancelar
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// DONUT CHART (simple CSS-based)
// ============================================================================

function DonutChart({
  data,
  total,
}: {
  data: { tipo: OcorrenciaTipo; label: string; count: number }[];
  total: number;
}) {
  if (total === 0) {
    return (
      <div className="w-28 h-28 rounded-full border-8 border-slate-100 flex items-center justify-center shrink-0">
        <span className="text-xs text-slate-400">Sem dados</span>
      </div>
    );
  }

  // Build conic-gradient
  const colors: Record<OcorrenciaTipo, string> = {
    retrabalho: "#ef4444",
    devolucao: "#f59e0b",
    erro_producao: "#f97316",
    erro_instalacao: "#a855f7",
    divergencia_cliente: "#3b82f6",
  };

  let cumulative = 0;
  const segments = data
    .filter((d) => d.count > 0)
    .map((d) => {
      const pct = (d.count / total) * 100;
      const start = cumulative;
      cumulative += pct;
      return { ...d, color: colors[d.tipo], start, end: cumulative };
    });

  const gradientParts = segments.map(
    (s) => `${s.color} ${s.start}% ${s.end}%`
  );
  const gradient = `conic-gradient(${gradientParts.join(", ")})`;

  return (
    <div className="relative w-28 h-28 shrink-0">
      <div
        className="w-28 h-28 rounded-full"
        style={{ background: gradient }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center">
          <span className="text-lg font-bold text-slate-800">{total}</span>
        </div>
      </div>
    </div>
  );
}
