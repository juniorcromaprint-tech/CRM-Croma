import React, { useState, useMemo, useCallback, useRef, type DragEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";
import { brl, formatDate, formatDateTime } from "@/shared/utils/format";
import {
  PRODUCAO_STATUS,
  PRODUCAO_STATUS_CONFIG,
  type ProducaoStatus,
} from "@/shared/constants/status";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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

import {
  Factory,
  Plus,
  Search,
  ChevronRight,
  AlertTriangle,
  Clock,
  Calendar,
  Loader2,
  ArrowRight,
  XCircle,
  GripVertical,
  List,
  Columns3,
  CheckCircle2,
  Play,
  CircleDashed,
  Eye,
  RotateCcw,
  Timer,
  Scissors,
  ClipboardCheck,
  Printer,
  PenTool,
  Truck,
} from "lucide-react";

// ===========================================================================
// TYPES
// ===========================================================================

interface EtapaRow {
  id: string;
  ordem_producao_id: string;
  nome: string;
  ordem: number;
  status: string;
  responsavel_id: string | null;
  inicio: string | null;
  fim: string | null;
  tempo_estimado_min: number | null;
  tempo_real_min: number | null;
  observacoes: string | null;
  created_at: string;
}

interface PedidoItemJoin {
  descricao: string | null;
  especificacao: string | null;
  quantidade: number | null;
  pedidos: {
    numero: string;
    clientes: {
      nome_fantasia: string | null;
      razao_social: string;
    } | null;
  } | null;
}

interface OrdemProducaoRow {
  id: string;
  numero: string;
  pedido_item_id: string | null;
  pedido_id: string | null;
  status: ProducaoStatus;
  prioridade: number;
  responsavel_id: string | null;
  prazo_interno: string | null;
  data_inicio: string | null;
  data_conclusao: string | null;
  tempo_estimado_min: number | null;
  tempo_real_min: number | null;
  custo_mp_estimado: number | null;
  custo_mp_real: number | null;
  custo_mo_estimado: number | null;
  custo_mo_real: number | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  pedido_itens: PedidoItemJoin | null;
  producao_etapas: EtapaRow[];
}

interface PedidoItemOption {
  id: string;
  descricao: string | null;
  especificacao: string | null;
  quantidade: number | null;
  pedido_id: string;
  pedidos: {
    numero: string;
    clientes: {
      nome_fantasia: string | null;
      razao_social: string;
    } | null;
  } | null;
}

// ===========================================================================
// CONSTANTS
// ===========================================================================

const PRIORIDADE_CONFIG: Record<number, { label: string; color: string; dotColor: string }> = {
  0: { label: "Normal", color: "bg-slate-50 text-slate-600 border-slate-200", dotColor: "bg-slate-400" },
  1: { label: "Alta", color: "bg-amber-50 text-amber-700 border-amber-200", dotColor: "bg-amber-500" },
  2: { label: "Urgente", color: "bg-red-50 text-red-700 border-red-200", dotColor: "bg-red-500" },
};

const STATUS_BADGE_COLORS: Record<ProducaoStatus, string> = {
  aguardando_programacao: "bg-slate-100 text-slate-700 border-slate-200",
  em_fila: "bg-blue-50 text-blue-700 border-blue-200",
  em_producao: "bg-amber-50 text-amber-700 border-amber-200",
  em_acabamento: "bg-purple-50 text-purple-700 border-purple-200",
  em_conferencia: "bg-cyan-50 text-cyan-700 border-cyan-200",
  liberado: "bg-green-50 text-green-700 border-green-200",
  retrabalho: "bg-red-50 text-red-700 border-red-200",
  finalizado: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const STATUS_TRANSITIONS: Record<ProducaoStatus, ProducaoStatus[]> = {
  aguardando_programacao: ["em_fila"],
  em_fila: ["em_producao", "aguardando_programacao"],
  em_producao: ["em_acabamento", "retrabalho"],
  em_acabamento: ["em_conferencia", "retrabalho"],
  em_conferencia: ["liberado", "retrabalho"],
  liberado: ["finalizado"],
  retrabalho: ["em_producao"],
  finalizado: [],
};

// Kanban columns mapping
interface KanbanColumn {
  key: string;
  label: string;
  statuses: ProducaoStatus[];
  color: string;
  dotColor: string;
  bgActive: string;
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    key: "fila",
    label: "Fila",
    statuses: ["aguardando_programacao", "em_fila"],
    color: "bg-blue-50 border-blue-200",
    dotColor: "bg-blue-500",
    bgActive: "ring-blue-400 bg-blue-50/50",
  },
  {
    key: "producao",
    label: "Em Produção",
    statuses: ["em_producao"],
    color: "bg-amber-50 border-amber-200",
    dotColor: "bg-amber-500",
    bgActive: "ring-amber-400 bg-amber-50/50",
  },
  {
    key: "acabamento",
    label: "Acabamento",
    statuses: ["em_acabamento"],
    color: "bg-purple-50 border-purple-200",
    dotColor: "bg-purple-500",
    bgActive: "ring-purple-400 bg-purple-50/50",
  },
  {
    key: "conferencia",
    label: "Conferência",
    statuses: ["em_conferencia"],
    color: "bg-cyan-50 border-cyan-200",
    dotColor: "bg-cyan-500",
    bgActive: "ring-cyan-400 bg-cyan-50/50",
  },
  {
    key: "liberado",
    label: "Liberado",
    statuses: ["liberado"],
    color: "bg-green-50 border-green-200",
    dotColor: "bg-green-500",
    bgActive: "ring-green-400 bg-green-50/50",
  },
];

// Map kanban column keys to the target status when dropped
const KANBAN_DROP_STATUS: Record<string, ProducaoStatus> = {
  fila: "em_fila",
  producao: "em_producao",
  acabamento: "em_acabamento",
  conferencia: "em_conferencia",
  liberado: "liberado",
};

const ETAPA_NOMES = ["criacao", "impressao", "acabamento", "conferencia", "expedicao"] as const;

const ETAPA_LABELS: Record<string, string> = {
  criacao: "Criação",
  impressao: "Impressão",
  acabamento: "Acabamento",
  serralheria: "Serralheria",
  conferencia: "Conferência",
  expedicao: "Expedição",
};

const ETAPA_ICONS: Record<string, typeof Factory> = {
  criacao: PenTool,
  impressao: Printer,
  acabamento: Scissors,
  serralheria: Factory,
  conferencia: ClipboardCheck,
  expedicao: Truck,
};

// ===========================================================================
// HELPERS
// ===========================================================================

function generateNumero(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");
  return `OP-${year}-${seq}`;
}

function getClienteName(op: OrdemProducaoRow): string {
  const c = op.pedido_itens?.pedidos?.clientes;
  if (!c) return "---";
  return c.nome_fantasia || c.razao_social;
}

function getPedidoNumero(op: OrdemProducaoRow): string {
  return op.pedido_itens?.pedidos?.numero ?? "---";
}

function getItemDescricao(op: OrdemProducaoRow): string {
  return op.pedido_itens?.descricao ?? "Sem descricao";
}

function isOverdue(op: OrdemProducaoRow): boolean {
  if (!op.prazo_interno) return false;
  if (op.status === "finalizado") return false;
  return new Date(op.prazo_interno) < new Date();
}

function getEtapaAtual(etapas: EtapaRow[]): string {
  const sorted = [...etapas].sort((a, b) => a.ordem - b.ordem);
  const emAndamento = sorted.find((e) => e.status === "em_andamento");
  if (emAndamento) return ETAPA_LABELS[emAndamento.nome] ?? emAndamento.nome;
  const pendente = sorted.find((e) => e.status === "pendente");
  if (pendente) return ETAPA_LABELS[pendente.nome] ?? pendente.nome;
  return "Concluído";
}

function getProgressPercent(etapas: EtapaRow[]): number {
  if (etapas.length === 0) return 0;
  const concluidas = etapas.filter((e) => e.status === "concluida").length;
  return Math.round((concluidas / etapas.length) * 100);
}

function formatMinutes(min: number | null): string {
  if (min == null || min === 0) return "---";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${m}min` : `${h}h`;
}

// ===========================================================================
// SKELETON
// ===========================================================================

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm animate-pulse border border-slate-100">
      <div className="space-y-2">
        <div className="h-3 bg-slate-100 rounded w-20" />
        <div className="h-4 bg-slate-100 rounded w-32" />
        <div className="flex gap-2">
          <div className="h-5 bg-slate-100 rounded w-16" />
          <div className="h-5 bg-slate-100 rounded w-12" />
        </div>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-slate-100 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-100 rounded w-32" />
          <div className="h-3 bg-slate-100 rounded w-48" />
          <div className="flex gap-2 mt-1">
            <div className="h-5 bg-slate-100 rounded w-20" />
            <div className="h-5 bg-slate-100 rounded w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProducaoPage() {
  const queryClient = useQueryClient();

  // --- State ---
  const [viewMode, setViewMode] = useState<"kanban" | "lista">("kanban");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [prioridadeFilter, setPrioridadeFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedOP, setSelectedOP] = useState<OrdemProducaoRow | null>(null);

  // --- Create form ---
  const [formPedidoItemId, setFormPedidoItemId] = useState("");
  const [formPrioridade, setFormPrioridade] = useState("0");
  const [formPrazoInterno, setFormPrazoInterno] = useState("");
  const [formTempoEstimado, setFormTempoEstimado] = useState("");
  const [formObservacoes, setFormObservacoes] = useState("");

  // --- Drag & drop ---
  const [draggedOPId, setDraggedOPId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const dragCounterRef = useRef<Record<string, number>>({});

  // =========================================================================
  // QUERIES
  // =========================================================================

  const {
    data: ordens = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["producao", "ordens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_producao")
        .select(
          "*, pedido_itens(descricao, especificacao, quantidade, pedidos(numero, clientes(nome_fantasia, razao_social))), producao_etapas(*)"
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as OrdemProducaoRow[];
    },
  });

  const { data: pedidoItens = [] } = useQuery({
    queryKey: ["producao", "pedido-itens-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedido_itens")
        .select(
          "id, descricao, especificacao, quantidade, pedido_id, pedidos(numero, clientes(nome_fantasia, razao_social))"
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as unknown as PedidoItemOption[];
    },
  });

  // =========================================================================
  // MUTATIONS
  // =========================================================================

  const createMutation = useMutation({
    mutationFn: async () => {
      const numero = generateNumero();
      const selectedItem = pedidoItens.find((pi) => pi.id === formPedidoItemId);
      const pedidoId = selectedItem?.pedido_id ?? null;

      const { data: opData, error: opError } = await supabase
        .from("ordens_producao")
        .insert({
          numero,
          pedido_item_id: formPedidoItemId || null,
          pedido_id: pedidoId,
          status: "aguardando_programacao" as ProducaoStatus,
          prioridade: parseInt(formPrioridade, 10),
          prazo_interno: formPrazoInterno || null,
          tempo_estimado_min: formTempoEstimado ? parseInt(formTempoEstimado, 10) : null,
          observacoes: formObservacoes || null,
        })
        .select()
        .single();

      if (opError) throw opError;

      // Create default etapas
      const etapas = ETAPA_NOMES.map((nome, idx) => ({
        ordem_producao_id: opData.id,
        nome,
        ordem: idx,
        status: "pendente",
      }));

      const { error: etapaError } = await supabase
        .from("producao_etapas")
        .insert(etapas);

      if (etapaError) throw etapaError;

      return opData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["producao"] });
      showSuccess("Ordem de produção criada com sucesso!");
      resetCreateForm();
      setIsCreateOpen(false);
    },
    onError: (err: Error) => {
      showError(`Erro ao criar OP: ${err.message}`);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: ProducaoStatus }) => {
      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === "em_producao" || newStatus === "em_fila") {
        updates.data_inicio = updates.data_inicio ?? new Date().toISOString();
      }
      if (newStatus === "finalizado") {
        updates.data_conclusao = new Date().toISOString();
      }

      const { error } = await supabase
        .from("ordens_producao")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["producao"] });
      const label = PRODUCAO_STATUS_CONFIG[variables.newStatus]?.label ?? variables.newStatus;
      showSuccess(`Status atualizado para "${label}"`);
      setSelectedOP(null);
    },
    onError: (err: Error) => {
      showError(`Erro ao atualizar status: ${err.message}`);
    },
  });

  const updateEtapaMutation = useMutation({
    mutationFn: async ({
      etapaId,
      newStatus,
    }: {
      etapaId: string;
      newStatus: string;
    }) => {
      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === "em_andamento") {
        updates.inicio = new Date().toISOString();
      }
      if (newStatus === "concluida") {
        updates.fim = new Date().toISOString();
      }

      const { error } = await supabase
        .from("producao_etapas")
        .update(updates)
        .eq("id", etapaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["producao"] });
      showSuccess("Etapa atualizada!");
    },
    onError: (err: Error) => {
      showError(`Erro ao atualizar etapa: ${err.message}`);
    },
  });

  // =========================================================================
  // COMPUTED
  // =========================================================================

  const filtered = useMemo(() => {
    let result = ordens;

    if (statusFilter !== "all") {
      result = result.filter((op) => op.status === statusFilter);
    }

    if (prioridadeFilter !== "all") {
      result = result.filter((op) => op.prioridade === parseInt(prioridadeFilter, 10));
    }

    const term = searchTerm.toLowerCase().trim();
    if (term) {
      result = result.filter(
        (op) =>
          (op.numero ?? "").toLowerCase().includes(term) ||
          getClienteName(op).toLowerCase().includes(term) ||
          getItemDescricao(op).toLowerCase().includes(term)
      );
    }

    return result;
  }, [ordens, statusFilter, prioridadeFilter, searchTerm]);

  const stats = useMemo(() => {
    const emFila = ordens.filter(
      (op) => op.status === "aguardando_programacao" || op.status === "em_fila"
    ).length;
    const emProducao = ordens.filter(
      (op) => op.status === "em_producao" || op.status === "em_acabamento"
    ).length;
    const emConferencia = ordens.filter(
      (op) => op.status === "em_conferencia"
    ).length;

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const finalizadasMes = ordens.filter(
      (op) =>
        op.status === "finalizado" &&
        op.data_conclusao &&
        new Date(op.data_conclusao) >= firstDay
    ).length;

    return { emFila, emProducao, emConferencia, finalizadasMes };
  }, [ordens]);

  // Group OPs by kanban column
  const opsByColumn = useMemo(() => {
    const result: Record<string, OrdemProducaoRow[]> = {};
    for (const col of KANBAN_COLUMNS) {
      result[col.key] = filtered.filter((op) =>
        col.statuses.includes(op.status)
      );
    }
    return result;
  }, [filtered]);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  function resetCreateForm() {
    setFormPedidoItemId("");
    setFormPrioridade("0");
    setFormPrazoInterno("");
    setFormTempoEstimado("");
    setFormObservacoes("");
  }

  function handleCreate() {
    createMutation.mutate();
  }

  // --- Drag & Drop ---
  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>, opId: string) => {
      e.dataTransfer.setData("text/plain", opId);
      e.dataTransfer.effectAllowed = "move";
      setDraggedOPId(opId);
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDraggedOPId(null);
    setDragOverColumn(null);
    dragCounterRef.current = {};
  }, []);

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>, colKey: string) => {
      e.preventDefault();
      dragCounterRef.current[colKey] = (dragCounterRef.current[colKey] || 0) + 1;
      setDragOverColumn(colKey);
    },
    []
  );

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>, colKey: string) => {
      e.preventDefault();
      dragCounterRef.current[colKey] = (dragCounterRef.current[colKey] || 0) - 1;
      if (dragCounterRef.current[colKey] <= 0) {
        dragCounterRef.current[colKey] = 0;
        setDragOverColumn((prev) => (prev === colKey ? null : prev));
      }
    },
    []
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>, colKey: string) => {
      e.preventDefault();
      setDragOverColumn(null);
      dragCounterRef.current = {};

      const opId = e.dataTransfer.getData("text/plain");
      if (!opId) return;

      const op = ordens.find((o) => o.id === opId);
      if (!op) return;

      const targetStatus = KANBAN_DROP_STATUS[colKey];
      if (!targetStatus) return;
      if (op.status === targetStatus) return;

      // Check valid transition
      const allowed = STATUS_TRANSITIONS[op.status];
      if (!allowed.includes(targetStatus)) {
        const fromLabel = PRODUCAO_STATUS_CONFIG[op.status]?.label ?? op.status;
        const toLabel = PRODUCAO_STATUS_CONFIG[targetStatus]?.label ?? targetStatus;
        showError(
          `Transição inválida: ${fromLabel} -> ${toLabel}. Verifique o fluxo de produção.`
        );
        return;
      }

      updateStatusMutation.mutate({ id: opId, newStatus: targetStatus });
    },
    [ordens, updateStatusMutation]
  );

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ----------------------------------------------------------------- */}
      {/* HEADER                                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            Produção
          </h1>
          <p className="text-slate-500 mt-1">
            {ordens.length} ordem{ordens.length !== 1 ? "ns" : ""} de produção
            {" \u2022 "}
            {stats.emFila} em fila, {stats.emProducao} em produção,{" "}
            {stats.emConferencia} em conferência
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-3 py-2 flex items-center gap-1.5 text-sm font-medium transition-colors ${
                viewMode === "kanban"
                  ? "bg-blue-600 text-white"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Columns3 size={16} />
              Kanban
            </button>
            <button
              onClick={() => setViewMode("lista")}
              className={`px-3 py-2 flex items-center gap-1.5 text-sm font-medium transition-colors ${
                viewMode === "lista"
                  ? "bg-blue-600 text-white"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <List size={16} />
              Lista
            </button>
          </div>

          <Button
            onClick={() => {
              resetCreateForm();
              setIsCreateOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 shadow-sm"
          >
            <Plus size={20} className="mr-2" /> Nova OP
          </Button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* STATS BAR                                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Clock size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {isLoading ? "..." : stats.emFila}
              </p>
              <p className="text-xs text-slate-500">Em Fila</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <Factory size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {isLoading ? "..." : stats.emProducao}
              </p>
              <p className="text-xs text-slate-500">Em Produção</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center">
              <Eye size={20} className="text-cyan-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {isLoading ? "..." : stats.emConferencia}
              </p>
              <p className="text-xs text-slate-500">Em Conferência</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <CheckCircle2 size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {isLoading ? "..." : stats.finalizadasMes}
              </p>
              <p className="text-xs text-slate-500">Finalizadas este mes</p>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* FILTERS (only for list view; kanban has built-in columns)         */}
      {/* ----------------------------------------------------------------- */}
      {viewMode === "lista" && (
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <Input
              placeholder="Buscar por OP, cliente ou item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-xl border-slate-200 bg-white h-11 shadow-sm"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-52 rounded-xl border-slate-200 bg-white h-11 shadow-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(PRODUCAO_STATUS).map(([, value]) => (
                <SelectItem key={value} value={value}>
                  {PRODUCAO_STATUS_CONFIG[value].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
            <SelectTrigger className="w-full md:w-44 rounded-xl border-slate-200 bg-white h-11 shadow-sm">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas prioridades</SelectItem>
              <SelectItem value="0">Normal</SelectItem>
              <SelectItem value="1">Alta</SelectItem>
              <SelectItem value="2">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Search for kanban too */}
      {viewMode === "kanban" && (
        <div className="relative max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            placeholder="Buscar por OP ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-xl border-slate-200 bg-white h-11 shadow-sm"
          />
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* LOADING / ERROR / EMPTY STATES                                    */}
      {/* ----------------------------------------------------------------- */}
      {isLoading ? (
        viewMode === "kanban" ? (
          <div className="grid grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-3">
                <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        )
      ) : isError ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <XCircle className="mx-auto h-12 w-12 text-red-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-700">
            Erro ao carregar ordens de produção
          </h3>
          <p className="text-slate-500 mt-1 text-sm">
            Verifique a conexão com o banco de dados.
          </p>
          <Button
            variant="outline"
            className="mt-4 rounded-xl"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["producao"] })
            }
          >
            Tentar novamente
          </Button>
        </div>
      ) : ordens.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Factory className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-700">
            Nenhuma ordem de produção
          </h3>
          <p className="text-slate-500 mt-1 text-sm">
            Crie a primeira OP para começar a gerenciar a produção.
          </p>
          <Button
            onClick={() => {
              resetCreateForm();
              setIsCreateOpen(true);
            }}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
          >
            <Plus size={18} className="mr-2" /> Criar OP
          </Button>
        </div>
      ) : (
        <>
          {/* ============================================================= */}
          {/* KANBAN VIEW                                                    */}
          {/* ============================================================= */}
          {viewMode === "kanban" && (
            <div className="grid grid-cols-5 gap-4 min-h-[60vh]">
              {KANBAN_COLUMNS.map((col) => {
                const colOPs = opsByColumn[col.key] ?? [];
                const isDragOver = dragOverColumn === col.key;

                return (
                  <div
                    key={col.key}
                    className={`
                      flex flex-col rounded-2xl border transition-all duration-200
                      ${col.color}
                      ${isDragOver ? `ring-2 ${col.bgActive}` : ""}
                    `}
                    onDragEnter={(e) => handleDragEnter(e, col.key)}
                    onDragLeave={(e) => handleDragLeave(e, col.key)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, col.key)}
                  >
                    {/* Column Header */}
                    <div className="p-3 pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                        <h3 className="font-semibold text-slate-700 text-sm">
                          {col.label}
                        </h3>
                        <Badge
                          variant="secondary"
                          className="ml-auto text-[10px] px-1.5 py-0 h-5 bg-white/60"
                        >
                          {colOPs.length}
                        </Badge>
                      </div>
                    </div>

                    {/* Cards */}
                    <div className="flex-1 overflow-y-auto p-2 pt-0 space-y-2 min-h-[200px]">
                      {colOPs.length === 0 ? (
                        <div className="flex items-center justify-center h-24 text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl">
                          {searchTerm ? "Sem resultados" : "Vazio"}
                        </div>
                      ) : (
                        colOPs.map((op) => {
                          const prioCfg = PRIORIDADE_CONFIG[op.prioridade] ?? PRIORIDADE_CONFIG[0];
                          const isDragging = draggedOPId === op.id;
                          const overdue = isOverdue(op);
                          const etapaAtual = getEtapaAtual(op.producao_etapas ?? []);
                          const progress = getProgressPercent(op.producao_etapas ?? []);

                          return (
                            <div
                              key={op.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, op.id)}
                              onDragEnd={handleDragEnd}
                              onClick={() => setSelectedOP(op)}
                              className={`
                                bg-white rounded-2xl border border-slate-200 p-3 cursor-grab
                                hover:shadow-md transition-all duration-150 group
                                active:cursor-grabbing select-none
                                ${isDragging ? "opacity-50 rotate-2 shadow-lg" : "shadow-sm"}
                              `}
                            >
                              {/* Card header */}
                              <div className="flex items-start justify-between gap-1 mb-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono text-[11px] text-slate-400 font-semibold">
                                      {op.numero}
                                    </span>
                                    {op.prioridade > 0 && (
                                      <span
                                        className={`text-[10px] font-semibold px-1.5 py-0 rounded border ${prioCfg.color}`}
                                      >
                                        {prioCfg.label}
                                      </span>
                                    )}
                                    {overdue && (
                                      <AlertTriangle
                                        size={12}
                                        className="text-red-500"
                                      />
                                    )}
                                  </div>
                                  <h4 className="font-semibold text-slate-800 text-sm truncate leading-tight mt-0.5">
                                    {getClienteName(op)}
                                  </h4>
                                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                    {getPedidoNumero(op)}
                                    {" \u2022 "}
                                    {getItemDescricao(op)}
                                  </p>
                                </div>
                                <GripVertical
                                  size={14}
                                  className="text-slate-300 group-hover:text-slate-400 mt-0.5 flex-shrink-0"
                                />
                              </div>

                              {/* Progress */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-500 flex items-center gap-1">
                                    <CircleDashed size={11} />
                                    {etapaAtual}
                                  </span>
                                  <span className="text-slate-400">{progress}%</span>
                                </div>
                                <Progress value={progress} className="h-1" />

                                {op.prazo_interno && (
                                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                    <Calendar size={11} />
                                    <span>
                                      Prazo: {formatDate(op.prazo_interno)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ============================================================= */}
          {/* LIST VIEW                                                      */}
          {/* ============================================================= */}
          {viewMode === "lista" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 px-1">
                Mostrando {filtered.length} OP{filtered.length !== 1 ? "s" : ""}
              </p>
              <div className="grid gap-3">
                {filtered.map((op) => {
                  const statusCfg = PRODUCAO_STATUS_CONFIG[op.status];
                  const prioCfg = PRIORIDADE_CONFIG[op.prioridade] ?? PRIORIDADE_CONFIG[0];
                  const overdue = isOverdue(op);
                  const progress = getProgressPercent(op.producao_etapas ?? []);

                  return (
                    <div
                      key={op.id}
                      onClick={() => setSelectedOP(op)}
                      className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer group"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 flex-shrink-0">
                            <Factory size={22} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs text-slate-400 font-semibold">
                                {op.numero}
                              </span>
                              <span
                                className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${STATUS_BADGE_COLORS[op.status]}`}
                              >
                                {statusCfg?.label ?? op.status}
                              </span>
                              <span
                                className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${prioCfg.color}`}
                              >
                                {prioCfg.label}
                              </span>
                              {overdue && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-md border bg-red-50 text-red-600 border-red-200 flex items-center gap-1">
                                  <AlertTriangle size={12} />
                                  Atrasado
                                </span>
                              )}
                            </div>

                            <h3 className="font-bold text-slate-800 text-base mt-1 group-hover:text-blue-700 transition-colors truncate">
                              {getClienteName(op)}
                            </h3>

                            <div className="flex flex-wrap items-center gap-3 mt-1">
                              <span className="text-xs text-slate-500">
                                Pedido: {getPedidoNumero(op)}
                              </span>
                              {op.prazo_interno && (
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <Calendar size={12} />
                                  Prazo: {formatDate(op.prazo_interno)}
                                </span>
                              )}
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Timer size={12} />
                                {formatMinutes(op.tempo_estimado_min)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="w-24">
                            <div className="text-right text-xs text-slate-400 mb-1">
                              {progress}%
                            </div>
                            <Progress value={progress} className="h-1.5" />
                          </div>
                          <ChevronRight
                            className="text-slate-300 group-hover:text-blue-600 transition-colors"
                            size={20}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filtered.length === 0 && (
                  <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <Search className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                    <h3 className="text-lg font-semibold text-slate-700">
                      Nenhuma OP encontrada
                    </h3>
                    <p className="text-slate-500 mt-1 text-sm">
                      Ajuste os filtros ou a busca.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ================================================================= */}
      {/* CREATE DIALOG                                                     */}
      {/* ================================================================= */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Factory size={22} className="text-blue-600" />
              Nova Ordem de Produção
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Item do pedido */}
            <div className="space-y-2">
              <Label htmlFor="create-item" className="text-slate-700 font-medium">
                Item do Pedido
              </Label>
              <Select value={formPedidoItemId} onValueChange={setFormPedidoItemId}>
                <SelectTrigger id="create-item" className="rounded-xl border-slate-200">
                  <SelectValue placeholder="Selecione um item do pedido" />
                </SelectTrigger>
                <SelectContent>
                  {pedidoItens.map((pi) => {
                    const pedNum = pi.pedidos?.numero ?? "---";
                    const cliente = pi.pedidos?.clientes?.nome_fantasia ?? pi.pedidos?.clientes?.razao_social ?? "";
                    return (
                      <SelectItem key={pi.id} value={pi.id}>
                        {pedNum} - {pi.descricao ?? "Item"} ({cliente})
                      </SelectItem>
                    );
                  })}
                  {pedidoItens.length === 0 && (
                    <div className="px-3 py-2 text-sm text-slate-400">
                      Nenhum item de pedido disponivel
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Prioridade */}
            <div className="space-y-2">
              <Label htmlFor="create-prio" className="text-slate-700 font-medium">
                Prioridade
              </Label>
              <Select value={formPrioridade} onValueChange={setFormPrioridade}>
                <SelectTrigger id="create-prio" className="rounded-xl border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Normal</SelectItem>
                  <SelectItem value="1">Alta</SelectItem>
                  <SelectItem value="2">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Prazo interno */}
            <div className="space-y-2">
              <Label htmlFor="create-prazo" className="text-slate-700 font-medium">
                Prazo interno
              </Label>
              <Input
                id="create-prazo"
                type="date"
                value={formPrazoInterno}
                onChange={(e) => setFormPrazoInterno(e.target.value)}
                className="rounded-xl border-slate-200"
              />
            </div>

            {/* Tempo estimado */}
            <div className="space-y-2">
              <Label htmlFor="create-tempo" className="text-slate-700 font-medium">
                Tempo estimado (minutos)
              </Label>
              <Input
                id="create-tempo"
                type="number"
                value={formTempoEstimado}
                onChange={(e) => setFormTempoEstimado(e.target.value)}
                placeholder="Ex: 120"
                className="rounded-xl border-slate-200"
              />
            </div>

            {/* Observacoes */}
            <div className="space-y-2">
              <Label htmlFor="create-obs" className="text-slate-700 font-medium">
                Observacoes
              </Label>
              <Textarea
                id="create-obs"
                value={formObservacoes}
                onChange={(e) => setFormObservacoes(e.target.value)}
                placeholder="Informacoes adicionais sobre a OP..."
                className="rounded-xl border-slate-200 min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus size={16} className="mr-2" />
                  Criar OP
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* DETAIL DIALOG                                                     */}
      {/* ================================================================= */}
      <Dialog
        open={!!selectedOP}
        onOpenChange={(open) => {
          if (!open) setSelectedOP(null);
        }}
      >
        {selectedOP && (
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-3">
                <Factory size={22} className="text-amber-600" />
                <span className="font-mono">{selectedOP.numero}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-2">
              {/* Status + Prioridade badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-sm font-semibold px-3 py-1 rounded-lg border ${STATUS_BADGE_COLORS[selectedOP.status]}`}
                >
                  {PRODUCAO_STATUS_CONFIG[selectedOP.status]?.label ?? selectedOP.status}
                </span>
                <span
                  className={`text-sm font-semibold px-3 py-1 rounded-lg border ${(PRIORIDADE_CONFIG[selectedOP.prioridade] ?? PRIORIDADE_CONFIG[0]).color}`}
                >
                  {(PRIORIDADE_CONFIG[selectedOP.prioridade] ?? PRIORIDADE_CONFIG[0]).label}
                </span>
                {isOverdue(selectedOP) && (
                  <span className="text-sm font-semibold px-3 py-1 rounded-lg border bg-red-50 text-red-600 border-red-200 flex items-center gap-1">
                    <AlertTriangle size={14} />
                    Atrasado
                  </span>
                )}
              </div>

              {/* Cliente & Pedido */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                      Cliente
                    </p>
                    <p className="text-lg font-bold text-slate-800">
                      {getClienteName(selectedOP)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                      Pedido
                    </p>
                    <p className="text-lg font-bold text-slate-800">
                      {getPedidoNumero(selectedOP)}
                    </p>
                  </div>
                </div>
                {selectedOP.pedido_itens?.descricao && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                      Item
                    </p>
                    <p className="text-sm text-slate-700">
                      {selectedOP.pedido_itens.descricao}
                      {selectedOP.pedido_itens.especificacao &&
                        ` \u2022 ${selectedOP.pedido_itens.especificacao}`}
                      {selectedOP.pedido_itens.quantidade &&
                        ` \u2022 Qtd: ${selectedOP.pedido_itens.quantidade}`}
                    </p>
                  </div>
                )}
              </div>

              {/* Etapas Timeline (Stepper) */}
              <div className="space-y-3">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
                  Etapas da Produção
                </p>
                <div className="space-y-0">
                  {[...(selectedOP.producao_etapas ?? [])]
                    .sort((a, b) => a.ordem - b.ordem)
                    .map((etapa, idx, arr) => {
                      const EIcon = ETAPA_ICONS[etapa.nome] ?? Factory;
                      const isLast = idx === arr.length - 1;
                      const isConcluida = etapa.status === "concluida";
                      const isEmAndamento = etapa.status === "em_andamento";
                      const isPendente = etapa.status === "pendente";

                      return (
                        <div key={etapa.id} className="flex gap-3">
                          {/* Timeline line + dot */}
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                isConcluida
                                  ? "bg-emerald-100 text-emerald-600"
                                  : isEmAndamento
                                    ? "bg-blue-100 text-blue-600 ring-2 ring-blue-300"
                                    : "bg-slate-100 text-slate-400"
                              }`}
                            >
                              {isConcluida ? (
                                <CheckCircle2 size={16} />
                              ) : isEmAndamento ? (
                                <Play size={14} />
                              ) : (
                                <EIcon size={14} />
                              )}
                            </div>
                            {!isLast && (
                              <div
                                className={`w-0.5 flex-1 min-h-[24px] ${
                                  isConcluida ? "bg-emerald-200" : "bg-slate-200"
                                }`}
                              />
                            )}
                          </div>

                          {/* Etapa content */}
                          <div className={`flex-1 pb-4 ${isLast ? "pb-0" : ""}`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <span
                                  className={`font-semibold text-sm ${
                                    isConcluida
                                      ? "text-emerald-700"
                                      : isEmAndamento
                                        ? "text-blue-700"
                                        : "text-slate-600"
                                  }`}
                                >
                                  {ETAPA_LABELS[etapa.nome] ?? etapa.nome}
                                </span>
                                {etapa.inicio && (
                                  <span className="text-[11px] text-slate-400 ml-2">
                                    Inicio: {formatDateTime(etapa.inicio)}
                                  </span>
                                )}
                                {etapa.fim && (
                                  <span className="text-[11px] text-slate-400 ml-2">
                                    Fim: {formatDateTime(etapa.fim)}
                                  </span>
                                )}
                              </div>

                              {/* Action buttons */}
                              <div className="flex gap-1.5">
                                {isPendente && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-lg h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                                    disabled={updateEtapaMutation.isPending}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateEtapaMutation.mutate({
                                        etapaId: etapa.id,
                                        newStatus: "em_andamento",
                                      });
                                    }}
                                  >
                                    <Play size={12} className="mr-1" />
                                    Iniciar
                                  </Button>
                                )}
                                {isEmAndamento && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-lg h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                    disabled={updateEtapaMutation.isPending}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateEtapaMutation.mutate({
                                        etapaId: etapa.id,
                                        newStatus: "concluida",
                                      });
                                    }}
                                  >
                                    <CheckCircle2 size={12} className="mr-1" />
                                    Concluir
                                  </Button>
                                )}
                              </div>
                            </div>

                            {etapa.tempo_real_min != null && etapa.tempo_real_min > 0 && (
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Tempo real: {formatMinutes(etapa.tempo_real_min)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}

                  {(!selectedOP.producao_etapas || selectedOP.producao_etapas.length === 0) && (
                    <div className="bg-slate-50 rounded-xl p-6 border border-dashed border-slate-200 text-center">
                      <CircleDashed size={32} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-sm text-slate-500">
                        Nenhuma etapa cadastrada para esta OP.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Custos estimado vs real */}
              <div className="space-y-3">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
                  Custos Estimado vs Real
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white rounded-xl p-3 border border-slate-100 text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-1">
                      MP Estimado
                    </p>
                    <p className="text-sm font-bold text-slate-700">
                      {brl(selectedOP.custo_mp_estimado ?? 0)}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-slate-100 text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-1">
                      MP Real
                    </p>
                    <p
                      className={`text-sm font-bold ${
                        (selectedOP.custo_mp_real ?? 0) > (selectedOP.custo_mp_estimado ?? 0)
                          ? "text-red-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {brl(selectedOP.custo_mp_real ?? 0)}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-slate-100 text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-1">
                      MO Estimado
                    </p>
                    <p className="text-sm font-bold text-slate-700">
                      {brl(selectedOP.custo_mo_estimado ?? 0)}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-slate-100 text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-1">
                      MO Real
                    </p>
                    <p
                      className={`text-sm font-bold ${
                        (selectedOP.custo_mo_real ?? 0) > (selectedOP.custo_mo_estimado ?? 0)
                          ? "text-red-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {brl(selectedOP.custo_mo_real ?? 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Datas & Tempo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                    Criado em
                  </p>
                  <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    <Clock size={14} className="text-slate-400" />
                    {formatDate(selectedOP.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                    Prazo interno
                  </p>
                  <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    <Calendar size={14} className="text-slate-400" />
                    {selectedOP.prazo_interno
                      ? formatDate(selectedOP.prazo_interno)
                      : "---"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                    Tempo estimado
                  </p>
                  <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    <Timer size={14} className="text-slate-400" />
                    {formatMinutes(selectedOP.tempo_estimado_min)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                    Tempo real
                  </p>
                  <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    <Timer size={14} className="text-slate-400" />
                    {formatMinutes(selectedOP.tempo_real_min)}
                  </p>
                </div>
              </div>

              {/* Status workflow buttons */}
              {STATUS_TRANSITIONS[selectedOP.status]?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
                    Avancar status
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_TRANSITIONS[selectedOP.status].map((nextStatus) => {
                      const nextCfg = PRODUCAO_STATUS_CONFIG[nextStatus];
                      const isRetrabalho = nextStatus === "retrabalho";
                      return (
                        <Button
                          key={nextStatus}
                          variant={isRetrabalho ? "outline" : "default"}
                          size="sm"
                          disabled={updateStatusMutation.isPending}
                          onClick={() =>
                            updateStatusMutation.mutate({
                              id: selectedOP.id,
                              newStatus: nextStatus,
                            })
                          }
                          className={
                            isRetrabalho
                              ? "rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                              : "rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                          }
                        >
                          {updateStatusMutation.isPending ? (
                            <Loader2 size={14} className="mr-1 animate-spin" />
                          ) : isRetrabalho ? (
                            <RotateCcw size={14} className="mr-1" />
                          ) : (
                            <ArrowRight size={14} className="mr-1" />
                          )}
                          {nextCfg?.label ?? nextStatus}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Observacoes */}
              {selectedOP.observacoes && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
                    Observacoes
                  </p>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {selectedOP.observacoes}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSelectedOP(null)}
                className="rounded-xl"
              >
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
