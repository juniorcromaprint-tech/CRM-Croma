import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";
import { brl, formatDate } from "@/shared/utils/format";
import {
  PEDIDO_STATUS,
  PEDIDO_STATUS_CONFIG,
  PEDIDO_PRIORIDADE,
  PEDIDO_PRIORIDADE_CONFIG,
  type PedidoStatus,
  type PedidoPrioridade,
} from "@/shared/constants/status";
import StatusFiscalBadge from "@/domains/fiscal/components/StatusFiscalBadge";
import QueryErrorState from "@/shared/components/QueryErrorState";
import { usePedidoItens } from "../hooks/usePedidoItens";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Package,
  Plus,
  Search,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  Clock,
  Factory,
  Calendar,
  Hash,
  FileText,
  Loader2,
  ArrowRight,
  XCircle,
  ClipboardList,
  Trash2,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface PedidoRow {
  id: string;
  numero: string;
  cliente_id: string;
  status: PedidoStatus;
  prioridade: PedidoPrioridade;
  valor_total: number;
  custo_total: number;
  margem_real: number;
  data_prometida: string | null;
  data_conclusao: string | null;
  observacoes: string | null;
  status_fiscal?: string | null;
  created_at: string;
  excluido_em: string | null;
  clientes: {
    nome_fantasia: string | null;
    razao_social: string;
  } | null;
  pedido_itens: { count: number }[];
}

interface ClienteOption {
  id: string;
  nome_fantasia: string | null;
  razao_social: string;
}

// ---------------------------------------------------------------------------
// STATUS TRANSITIONS
// ---------------------------------------------------------------------------

const STATUS_TRANSITIONS: Record<PedidoStatus, PedidoStatus[]> = {
  rascunho: ["aguardando_aprovacao"],
  aguardando_aprovacao: ["aprovado", "cancelado"],
  aprovado: ["em_producao", "cancelado"],
  em_producao: ["produzido"],
  produzido: ["aguardando_instalacao"],
  aguardando_instalacao: ["em_instalacao"],
  em_instalacao: ["concluido", "parcialmente_concluido"],
  parcialmente_concluido: ["concluido"],
  concluido: [],
  cancelado: [],
};

// ---------------------------------------------------------------------------
// STATUS COLOR MAP (badge-specific colors per spec)
// ---------------------------------------------------------------------------

const STATUS_BADGE_COLORS: Record<PedidoStatus, string> = {
  rascunho: "bg-slate-100 text-slate-700 border-slate-200",
  aguardando_aprovacao: "bg-yellow-50 text-yellow-700 border-yellow-200",
  aprovado: "bg-blue-50 text-blue-700 border-blue-200",
  em_producao: "bg-indigo-50 text-indigo-700 border-indigo-200",
  produzido: "bg-cyan-50 text-cyan-700 border-cyan-200",
  aguardando_instalacao: "bg-orange-50 text-orange-700 border-orange-200",
  em_instalacao: "bg-amber-50 text-amber-700 border-amber-200",
  parcialmente_concluido: "bg-lime-50 text-lime-700 border-lime-200",
  concluido: "bg-green-50 text-green-700 border-green-200",
  cancelado: "bg-red-50 text-red-700 border-red-200",
};

const PRIORIDADE_BADGE_COLORS: Record<PedidoPrioridade, string> = {
  baixa: "bg-slate-100 text-slate-600 border-slate-200",
  normal: "bg-blue-50 text-blue-700 border-blue-200",
  alta: "bg-orange-50 text-orange-700 border-orange-200",
  urgente: "bg-red-50 text-red-700 border-red-200",
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function generateNumero(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
  return `PED-${year}-${seq}`;
}

function getClienteName(pedido: PedidoRow): string {
  if (!pedido.clientes) return "---";
  return pedido.clientes.nome_fantasia || pedido.clientes.razao_social;
}

function getItemCount(pedido: PedidoRow): number {
  if (!pedido.pedido_itens || pedido.pedido_itens.length === 0) return 0;
  return pedido.pedido_itens[0]?.count ?? 0;
}

function isOverdue(pedido: PedidoRow): boolean {
  if (!pedido.data_prometida) return false;
  if (
    pedido.status === "concluido" ||
    pedido.status === "cancelado"
  )
    return false;
  return new Date(pedido.data_prometida) < new Date();
}

// ---------------------------------------------------------------------------
// SKELETON COMPONENT
// ---------------------------------------------------------------------------

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
        <div className="text-right space-y-2">
          <div className="h-5 bg-slate-100 rounded w-24 ml-auto" />
          <div className="h-3 bg-slate-100 rounded w-20 ml-auto" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PedidosPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { profile, can } = useAuth();
  const isAdmin = !profile?.role || profile.role === 'admin';
  const canCriarPedido = can('pedidos', 'criar');

  // --- State ---
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [prioridadeFilter, setPrioridadeFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedPedido, setSelectedPedido] = useState<PedidoRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");

  // Hook for items of selected pedido (must be called unconditionally at top level)
  const { data: pedidoItens = [] } = usePedidoItens(selectedPedido?.id);

  // --- Create form state ---
  const [formClienteId, setFormClienteId] = useState("");
  const [formPrioridade, setFormPrioridade] = useState<PedidoPrioridade>("normal");
  const [formDataPrometida, setFormDataPrometida] = useState("");
  const [formObservacoes, setFormObservacoes] = useState("");

  // =========================================================================
  // QUERIES
  // =========================================================================

  const {
    data: pedidos = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["pedidos"],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*, status_fiscal, clientes(nome_fantasia, razao_social), pedido_itens(count)")
        .is("excluido_em", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as PedidoRow[];
    },
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-select"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome_fantasia, razao_social")
        .is("excluido_em", null)
        .eq("ativo", true)
        .order("nome_fantasia", { ascending: true });

      if (error) throw error;
      return (data ?? []) as ClienteOption[];
    },
  });

  // =========================================================================
  // MUTATIONS
  // =========================================================================

  const createMutation = useMutation({
    mutationFn: async () => {
      const numero = generateNumero();
      const { data, error } = await supabase
        .from("pedidos")
        .insert({
          numero,
          cliente_id: formClienteId,
          status: "rascunho" as PedidoStatus,
          prioridade: formPrioridade,
          data_prometida: formDataPrometida || null,
          observacoes: formObservacoes || null,
          valor_total: 0,
          custo_total: 0,
          margem_real: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      showSuccess("Pedido criado com sucesso!");
      resetCreateForm();
      setIsCreateOpen(false);
    },
    onError: (err: Error) => {
      showError(`Erro ao criar pedido: ${err.message}`);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      newStatus,
    }: {
      id: string;
      newStatus: PedidoStatus;
    }) => {
      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === "concluido") {
        updates.data_conclusao = new Date().toISOString();
      }

      const { error } = await supabase
        .from("pedidos")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      const label =
        PEDIDO_STATUS_CONFIG[variables.newStatus]?.label ?? variables.newStatus;
      showSuccess(`Status atualizado para "${label}"`);
      setSelectedPedido(null);
    },
    onError: (err: Error) => {
      showError(`Erro ao atualizar status: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pedidos")
        .update({ excluido_em: new Date().toISOString(), excluido_por: profile?.id ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      showSuccess("Pedido excluído!");
      setDeleteId(null);
    },
    onError: (err: Error) => showError(`Erro ao excluir: ${err.message}`),
  });

  // =========================================================================
  // COMPUTED
  // =========================================================================

  const filtered = useMemo(() => {
    let result = pedidos;

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Prioridade filter
    if (prioridadeFilter !== "all") {
      result = result.filter((p) => p.prioridade === prioridadeFilter);
    }

    // Search
    const term = searchTerm.toLowerCase().trim();
    if (term) {
      result = result.filter(
        (p) =>
          (p.numero ?? "").toLowerCase().includes(term) ||
          getClienteName(p).toLowerCase().includes(term)
      );
    }

    return result;
  }, [pedidos, statusFilter, prioridadeFilter, searchTerm]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pagedPedidos = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  const stats = useMemo(() => {
    const total = pedidos.length;
    const valorPipeline = pedidos.reduce(
      (sum, p) => sum + (p.valor_total ?? 0),
      0
    );
    const emAtraso = pedidos.filter(isOverdue).length;
    const emProducao = pedidos.filter(
      (p) => p.status === "em_producao"
    ).length;

    return { total, valorPipeline, emAtraso, emProducao };
  }, [pedidos]);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  function resetCreateForm() {
    setFormClienteId("");
    setFormPrioridade("normal");
    setFormDataPrometida("");
    setFormObservacoes("");
  }

  function handleStatusFilterChange(value: string) {
    setStatusFilter(value);
    setPage(1);
  }

  function handlePrioridadeFilterChange(value: string) {
    setPrioridadeFilter(value);
    setPage(1);
  }

  function handleSearchChange(value: string) {
    setSearchTerm(value);
    setPage(1);
  }

  function handleCreate() {
    if (!formClienteId) {
      showError("Selecione um cliente.");
      return;
    }
    createMutation.mutate();
  }

  function handleAdvanceStatus(pedido: PedidoRow, newStatus: PedidoStatus) {
    updateStatusMutation.mutate({ id: pedido.id, newStatus });
  }

  // =========================================================================
  // RENDER
  // =========================================================================

  if (isError) {
    return <QueryErrorState onRetry={refetch} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ----------------------------------------------------------------- */}
      {/* HEADER                                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            Pedidos
          </h1>
          <p className="text-slate-500 mt-1">
            Gerenciamento de pedidos e acompanhamento de produção
          </p>
        </div>
        {canCriarPedido && (
          <Button
            onClick={() => {
              resetCreateForm();
              setIsCreateOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 shadow-sm w-full md:w-auto"
          >
            <Plus size={20} className="mr-2" /> Novo Pedido
          </Button>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* STATS BAR                                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <ClipboardList size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {isLoading ? "..." : stats.total}
              </p>
              <p className="text-xs text-slate-500">Total de pedidos</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <TrendingUp size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {isLoading ? "..." : brl(stats.valorPipeline)}
              </p>
              <p className="text-xs text-slate-500">Valor total pipeline</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {isLoading ? "..." : stats.emAtraso}
              </p>
              <p className="text-xs text-slate-500">Em atraso</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <Factory size={20} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {isLoading ? "..." : stats.emProducao}
              </p>
              <p className="text-xs text-slate-500">Em produção</p>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* FILTERS                                                           */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <Input
            placeholder="Buscar por número ou nome do cliente..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 rounded-xl border-slate-200 bg-white h-11 shadow-sm"
          />
        </div>

        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
          <SelectTrigger className="w-full md:w-52 rounded-xl border-slate-200 bg-white h-11 shadow-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(PEDIDO_STATUS).map(([, value]) => (
              <SelectItem key={value} value={value}>
                {PEDIDO_STATUS_CONFIG[value].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={prioridadeFilter} onValueChange={handlePrioridadeFilterChange}>
          <SelectTrigger className="w-full md:w-44 rounded-xl border-slate-200 bg-white h-11 shadow-sm">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas prioridades</SelectItem>
            {Object.entries(PEDIDO_PRIORIDADE).map(([, value]) => (
              <SelectItem key={value} value={value}>
                {PEDIDO_PRIORIDADE_CONFIG[value].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* PEDIDOS LIST                                                      */}
      {/* ----------------------------------------------------------------- */}
      {isLoading ? (
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : isError ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <XCircle className="mx-auto h-12 w-12 text-red-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-700">
            Erro ao carregar pedidos
          </h3>
          <p className="text-slate-500 mt-1 text-sm">
            Verifique a conexão com o banco de dados.
          </p>
        </div>
      ) : filtered.length === 0 && !isLoading ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Package className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-700">
            Nenhum pedido encontrado
          </h3>
          <p className="text-slate-500 mt-1 text-sm">
            {pedidos.length === 0
              ? "Crie o primeiro pedido para começar."
              : "Ajuste os filtros ou a busca."}
          </p>
          {pedidos.length === 0 && (
            <Button
              onClick={() => {
                resetCreateForm();
                setIsCreateOpen(true);
              }}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
            >
              <Plus size={18} className="mr-2" /> Criar pedido
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 px-1">
            Mostrando {pagedPedidos.length} de {filtered.length} pedido
            {filtered.length !== 1 ? "s" : ""}
          </p>
          <div className="grid gap-3">
            {pagedPedidos.map((pedido) => {
              const statusCfg = PEDIDO_STATUS_CONFIG[pedido.status];
              const prioCfg = PEDIDO_PRIORIDADE_CONFIG[pedido.prioridade];
              const clienteName = getClienteName(pedido);
              const itemCount = getItemCount(pedido);
              const overdue = isOverdue(pedido);

              return (
                <div
                  key={pedido.id}
                  onClick={() => navigate(`/pedidos/${pedido.id}`)}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Left side */}
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 flex-shrink-0">
                        <Package size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Numero + badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-slate-400 font-semibold">
                            {pedido.numero}
                          </span>
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${STATUS_BADGE_COLORS[pedido.status]}`}
                          >
                            {statusCfg?.label ?? pedido.status}
                          </span>
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${PRIORIDADE_BADGE_COLORS[pedido.prioridade]}`}
                          >
                            {prioCfg?.label ?? pedido.prioridade}
                          </span>
                          {pedido.status_fiscal ? (
                            <StatusFiscalBadge status={pedido.status_fiscal} size="sm" />
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                          {overdue && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md border bg-red-50 text-red-600 border-red-200 flex items-center gap-1">
                              <AlertTriangle size={12} />
                              Atrasado
                            </span>
                          )}
                        </div>

                        {/* Cliente */}
                        <h3 className="font-bold text-slate-800 text-base mt-1 group-hover:text-blue-700 transition-colors truncate">
                          {clienteName}
                        </h3>

                        {/* Meta info */}
                        <div className="flex flex-wrap items-center gap-3 mt-1">
                          {pedido.data_prometida && (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Calendar size={12} />
                              Entrega: {formatDate(pedido.data_prometida)}
                            </span>
                          )}
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Hash size={12} />
                            {itemCount} ite{itemCount !== 1 ? "ns" : "m"}
                          </span>
                          <span className="text-xs text-slate-400">
                            Criado em {formatDate(pedido.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right side: value + actions */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="font-bold text-slate-800 text-lg">
                          {brl(pedido.valor_total ?? 0)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/os/${pedido.id}`); }}
                        title="Ordem de Serviço"
                        className="p-1.5 rounded-lg text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <FileText size={16} />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteId(pedido.id); setDeleteName(pedido.numero); }}
                          title="Excluir (Admin)"
                          className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      <ChevronRight
                        className="text-slate-300 group-hover:text-blue-600 transition-colors"
                        size={20}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="px-4 py-2 text-sm text-slate-600">
                    Página {page} de {totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* CREATE DIALOG                                                     */}
      {/* ================================================================= */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Package size={22} className="text-blue-600" />
              Novo Pedido
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Cliente */}
            <div className="space-y-2">
              <Label htmlFor="create-cliente" className="text-slate-700 font-medium">
                Cliente *
              </Label>
              <Select value={formClienteId} onValueChange={setFormClienteId}>
                <SelectTrigger
                  id="create-cliente"
                  className="rounded-xl border-slate-200"
                >
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_fantasia || c.razao_social}
                    </SelectItem>
                  ))}
                  {clientes.length === 0 && (
                    <div className="px-3 py-2 text-sm text-slate-400">
                      Nenhum cliente cadastrado
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Prioridade */}
            <div className="space-y-2">
              <Label htmlFor="create-prioridade" className="text-slate-700 font-medium">
                Prioridade
              </Label>
              <Select
                value={formPrioridade}
                onValueChange={(v) => setFormPrioridade(v as PedidoPrioridade)}
              >
                <SelectTrigger
                  id="create-prioridade"
                  className="rounded-xl border-slate-200"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PEDIDO_PRIORIDADE).map(([, value]) => (
                    <SelectItem key={value} value={value}>
                      {PEDIDO_PRIORIDADE_CONFIG[value].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Data prometida */}
            <div className="space-y-2">
              <Label htmlFor="create-data" className="text-slate-700 font-medium">
                Data prometida
              </Label>
              <Input
                id="create-data"
                type="date"
                value={formDataPrometida}
                onChange={(e) => setFormDataPrometida(e.target.value)}
                className="rounded-xl border-slate-200"
              />
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <Label htmlFor="create-obs" className="text-slate-700 font-medium">
                Observações
              </Label>
              <Textarea
                id="create-obs"
                value={formObservacoes}
                onChange={(e) => setFormObservacoes(e.target.value)}
                placeholder="Informações adicionais sobre o pedido..."
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
              disabled={createMutation.isPending || !formClienteId}
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
                  Criar Pedido
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
        open={!!selectedPedido}
        onOpenChange={(open) => {
          if (!open) setSelectedPedido(null);
        }}
      >
        {selectedPedido && (
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-3">
                <Package size={22} className="text-blue-600" />
                <span className="font-mono">{selectedPedido.numero}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-2">
              {/* Status + Prioridade header */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-sm font-semibold px-3 py-1 rounded-lg border ${STATUS_BADGE_COLORS[selectedPedido.status]}`}
                >
                  {PEDIDO_STATUS_CONFIG[selectedPedido.status]?.label ??
                    selectedPedido.status}
                </span>
                <span
                  className={`text-sm font-semibold px-3 py-1 rounded-lg border ${PRIORIDADE_BADGE_COLORS[selectedPedido.prioridade]}`}
                >
                  {PEDIDO_PRIORIDADE_CONFIG[selectedPedido.prioridade]?.label ??
                    selectedPedido.prioridade}
                </span>
                {isOverdue(selectedPedido) && (
                  <span className="text-sm font-semibold px-3 py-1 rounded-lg border bg-red-50 text-red-600 border-red-200 flex items-center gap-1">
                    <AlertTriangle size={14} />
                    Atrasado
                  </span>
                )}
              </div>

              {/* Cliente */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                  Cliente
                </p>
                <p className="text-lg font-bold text-slate-800">
                  {getClienteName(selectedPedido)}
                </p>
                {selectedPedido.clientes?.razao_social &&
                  selectedPedido.clientes.nome_fantasia &&
                  selectedPedido.clientes.razao_social !==
                    selectedPedido.clientes.nome_fantasia && (
                    <p className="text-sm text-slate-500">
                      {selectedPedido.clientes.razao_social}
                    </p>
                  )}
              </div>

              {/* Financeiro summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-4 border border-slate-100 text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                    Valor Total
                  </p>
                  <p className="text-xl font-bold text-slate-800">
                    {brl(selectedPedido.valor_total ?? 0)}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-100 text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                    Custo Total
                  </p>
                  <p className="text-xl font-bold text-slate-800">
                    {brl(selectedPedido.custo_total ?? 0)}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-100 text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                    Margem
                  </p>
                  <p className="text-xl font-bold text-emerald-600">
                    {(selectedPedido.margem_real ?? 0).toFixed(1).replace(".", ",")}%
                  </p>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                    Criado em
                  </p>
                  <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    <Clock size={14} className="text-slate-400" />
                    {formatDate(selectedPedido.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                    Data prometida
                  </p>
                  <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    <Calendar size={14} className="text-slate-400" />
                    {selectedPedido.data_prometida
                      ? formatDate(selectedPedido.data_prometida)
                      : "---"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                    Conclusão
                  </p>
                  <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    <Calendar size={14} className="text-slate-400" />
                    {selectedPedido.data_conclusao
                      ? formatDate(selectedPedido.data_conclusao)
                      : "---"}
                  </p>
                </div>
              </div>

              {/* Status workflow buttons */}
              {STATUS_TRANSITIONS[selectedPedido.status]?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
                    Avançar status
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_TRANSITIONS[selectedPedido.status].map(
                      (nextStatus) => {
                        const nextCfg = PEDIDO_STATUS_CONFIG[nextStatus];
                        const isCancelado = nextStatus === "cancelado";
                        return (
                          <Button
                            key={nextStatus}
                            variant={isCancelado ? "outline" : "default"}
                            size="sm"
                            disabled={updateStatusMutation.isPending}
                            onClick={() =>
                              handleAdvanceStatus(selectedPedido, nextStatus)
                            }
                            className={
                              isCancelado
                                ? "rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                                : "rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                            }
                          >
                            {updateStatusMutation.isPending ? (
                              <Loader2
                                size={14}
                                className="mr-1 animate-spin"
                              />
                            ) : isCancelado ? (
                              <XCircle size={14} className="mr-1" />
                            ) : (
                              <ArrowRight size={14} className="mr-1" />
                            )}
                            {nextCfg?.label ?? nextStatus}
                          </Button>
                        );
                      }
                    )}
                  </div>
                </div>
              )}

              {/* Itens do pedido */}
              <div className="space-y-2">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
                  Itens do pedido
                </p>
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-xs font-semibold text-slate-600">Descrição</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600">Qtd</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 text-right">Valor Unit.</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 text-right">Total</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pedidoItens.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="py-2">
                            <div className="font-medium text-slate-800 text-sm">{item.descricao}</div>
                            {item.especificacao && (
                              <div className="text-xs text-slate-400 mt-0.5">{item.especificacao}</div>
                            )}
                          </TableCell>
                          <TableCell className="py-2 text-sm text-slate-700">
                            {item.quantidade} {item.unidade}
                          </TableCell>
                          <TableCell className="py-2 text-sm text-slate-700 text-right">
                            {brl(item.valor_unitario ?? 0)}
                          </TableCell>
                          <TableCell className="py-2 text-sm font-semibold text-slate-800 text-right">
                            {brl(item.valor_total ?? 0)}
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge variant="outline" className="text-xs">
                              {item.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {pedidoItens.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-slate-400 py-8">
                            <FileText size={28} className="mx-auto text-slate-300 mb-2" />
                            <span className="text-sm">Nenhum item encontrado</span>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Observações */}
              {selectedPedido.observacoes && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
                    Observações
                  </p>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {selectedPedido.observacoes}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSelectedPedido(null)}
                className="rounded-xl"
              >
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* ================================================================= */}
      {/* DELETE DIALOG (Admin)                                             */}
      {/* ================================================================= */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl max-w-md mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Pedido</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o pedido <strong>{deleteName}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
