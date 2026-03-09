import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { brl } from "@/shared/utils/format";
import { formatDate, formatDateRelative, pct } from "@/shared/utils/format";
import {
  PROPOSTA_STATUS,
  PROPOSTA_STATUS_CONFIG,
  type PropostaStatus,
} from "@/shared/constants/status";
import {
  FileText,
  Search,
  Plus,
  Send,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  TrendingUp,
  DollarSign,
  BarChart3,
  Package,
  CalendarDays,
  ChevronRight,
  ArrowUpDown,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Proposta {
  id: string;
  numero: string | null;
  cliente_id: string;
  oportunidade_id: string | null;
  vendedor_id: string | null;
  versao: number;
  status: PropostaStatus;
  titulo: string | null;
  validade_dias: number;
  subtotal: number;
  desconto_percentual: number;
  desconto_valor: number;
  total: number;
  condicoes_pagamento: string | null;
  observacoes: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  cliente_nome_snapshot: string | null;
  cliente_cnpj_snapshot: string | null;
  created_at: string;
  updated_at: string;
  excluido_em: string | null;
  clientes: {
    nome_fantasia: string | null;
    razao_social: string;
  } | null;
  proposta_itens: { count: number }[];
}

interface Cliente {
  id: string;
  nome_fantasia: string | null;
  razao_social: string;
}

interface NewPropostaForm {
  titulo: string;
  cliente_id: string;
  validade_dias: number;
  condicoes_pagamento: string;
  observacoes: string;
}

const INITIAL_FORM: NewPropostaForm = {
  titulo: "",
  cliente_id: "",
  validade_dias: 10,
  condicoes_pagamento: "",
  observacoes: "",
};

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function getStatusBadgeClasses(status: PropostaStatus): string {
  const map: Record<PropostaStatus, string> = {
    rascunho: "bg-slate-100 text-slate-600 border-slate-200",
    enviada: "bg-blue-100 text-blue-700 border-blue-200",
    em_revisao: "bg-yellow-100 text-yellow-700 border-yellow-200",
    aprovada: "bg-green-100 text-green-700 border-green-200",
    recusada: "bg-red-100 text-red-700 border-red-200",
    expirada: "bg-slate-100 text-slate-500 border-slate-200",
  };
  return map[status] ?? "bg-slate-100 text-slate-600 border-slate-200";
}

function getStatusLabel(status: PropostaStatus): string {
  return PROPOSTA_STATUS_CONFIG[status]?.label ?? status;
}

/** Generates the next PROP-YYYY-NNN number */
function generateNumero(existingCount: number): string {
  const year = new Date().getFullYear();
  const seq = String(existingCount + 1).padStart(3, "0");
  return `PROP-${year}-${seq}`;
}

/** Compute expiration date */
function getExpirationDate(createdAt: string, validadeDias: number): Date {
  const d = new Date(createdAt);
  d.setDate(d.getDate() + validadeDias);
  return d;
}

function isExpired(createdAt: string, validadeDias: number): boolean {
  return getExpirationDate(createdAt, validadeDias) < new Date();
}

// ---------------------------------------------------------------------------
// Allowed status transitions
// ---------------------------------------------------------------------------

const STATUS_TRANSITIONS: Partial<Record<PropostaStatus, { label: string; to: PropostaStatus; icon: typeof Send }[]>> = {
  rascunho: [{ label: "Enviar", to: "enviada", icon: Send }],
  enviada: [
    { label: "Aprovar", to: "aprovada", icon: CheckCircle2 },
    { label: "Recusar", to: "recusada", icon: XCircle },
    { label: "Solicitar revisao", to: "em_revisao", icon: Eye },
  ],
  em_revisao: [{ label: "Reenviar", to: "enviada", icon: Send }],
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function PropostasPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [selectedProposta, setSelectedProposta] = useState<Proposta | null>(null);
  const [form, setForm] = useState<NewPropostaForm>(INITIAL_FORM);

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  const { data: propostas, isLoading } = useQuery({
    queryKey: ["propostas", search, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("propostas")
        .select("*, clientes(nome_fantasia, razao_social), proposta_itens(count)")
        .is("excluido_em", null)
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (search) {
        query = query.or(
          `titulo.ilike.%${search}%,numero.ilike.%${search}%,cliente_nome_snapshot.ilike.%${search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Proposta[];
    },
  });

  const { data: clientes } = useQuery({
    queryKey: ["clientes-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome_fantasia, razao_social")
        .eq("ativo", true)
        .order("nome_fantasia", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Cliente[];
    },
  });

  const { data: propostaCount } = useQuery({
    queryKey: ["propostas-count-year"],
    queryFn: async () => {
      const year = new Date().getFullYear();
      const { count, error } = await supabase
        .from("propostas")
        .select("id", { count: "exact", head: true })
        .ilike("numero", `PROP-${year}-%`);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const createProposta = useMutation({
    mutationFn: async (payload: NewPropostaForm) => {
      const numero = generateNumero(propostaCount ?? 0);

      const selectedCliente = clientes?.find((c) => c.id === payload.cliente_id);

      const { data, error } = await supabase
        .from("propostas")
        .insert({
          numero,
          titulo: payload.titulo,
          cliente_id: payload.cliente_id,
          validade_dias: payload.validade_dias,
          condicoes_pagamento: payload.condicoes_pagamento || null,
          observacoes: payload.observacoes || null,
          status: "rascunho",
          cliente_nome_snapshot: selectedCliente?.nome_fantasia ?? selectedCliente?.razao_social ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["propostas"] });
      queryClient.invalidateQueries({ queryKey: ["propostas-count-year"] });
      showSuccess("Proposta criada com sucesso!");
      setShowNewDialog(false);
      setForm(INITIAL_FORM);
    },
    onError: (err: Error) => showError(err.message || "Erro ao criar proposta"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PropostaStatus }) => {
      const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (status === "aprovada") {
        updates.aprovado_em = new Date().toISOString();
      }
      const { error } = await supabase.from("propostas").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["propostas"] });
      showSuccess(`Status atualizado para ${getStatusLabel(variables.status)}`);
      // Refresh detail dialog data
      if (selectedProposta && selectedProposta.id === variables.id) {
        setSelectedProposta((prev) =>
          prev ? { ...prev, status: variables.status } : null
        );
      }
    },
    onError: (err: Error) => showError(err.message || "Erro ao atualizar status"),
  });

  // -------------------------------------------------------------------------
  // Stats
  // -------------------------------------------------------------------------

  const stats = useMemo(() => {
    if (!propostas) return { total: 0, pipeline: 0, aprovadas: 0, conversao: "0%" };
    const total = propostas.length;
    const pipelineStatuses: PropostaStatus[] = ["rascunho", "enviada", "em_revisao"];
    const pipelineItems = propostas.filter((p) => pipelineStatuses.includes(p.status));
    const pipeline = pipelineItems.reduce((sum, p) => sum + Number(p.total || 0), 0);
    const aprovadas = propostas.filter((p) => p.status === "aprovada").length;
    const decididas = propostas.filter((p) => p.status === "aprovada" || p.status === "recusada").length;
    const conversao = decididas > 0 ? pct(aprovadas, decididas) : "0%";
    return { total, pipeline, aprovadas, conversao };
  }, [propostas]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleCreateSubmit() {
    if (!form.titulo.trim()) {
      showError("Informe o titulo da proposta");
      return;
    }
    if (!form.cliente_id) {
      showError("Selecione um cliente");
      return;
    }
    createProposta.mutate(form);
  }

  function getClienteName(p: Proposta): string {
    if (p.clientes) {
      return p.clientes.nome_fantasia ?? p.clientes.razao_social;
    }
    return p.cliente_nome_snapshot ?? "Cliente desconhecido";
  }

  function getItemCount(p: Proposta): number {
    if (p.proposta_itens && p.proposta_itens.length > 0) {
      return p.proposta_itens[0]?.count ?? 0;
    }
    return 0;
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            Propostas Comerciais
          </h1>
          <p className="text-slate-500 mt-1">
            Gerencie propostas, acompanhe o pipeline e converta oportunidades.
          </p>
        </div>
        <Button
          onClick={() => setShowNewDialog(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 shadow-sm w-full md:w-auto"
        >
          <Plus size={20} className="mr-2" /> Nova Proposta
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          icon={<FileText size={20} className="text-blue-600" />}
          label="Total de Propostas"
          value={String(stats.total)}
          bg="bg-blue-50"
        />
        <StatsCard
          icon={<DollarSign size={20} className="text-amber-600" />}
          label="Pipeline (valor)"
          value={brl(stats.pipeline)}
          bg="bg-amber-50"
        />
        <StatsCard
          icon={<CheckCircle2 size={20} className="text-emerald-600" />}
          label="Aprovadas"
          value={String(stats.aprovadas)}
          bg="bg-emerald-50"
        />
        <StatsCard
          icon={<TrendingUp size={20} className="text-purple-600" />}
          label="Taxa de Conversao"
          value={stats.conversao}
          bg="bg-purple-50"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <Input
            placeholder="Buscar por titulo, numero ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl border-slate-200 bg-white h-12 shadow-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-52 rounded-xl border-slate-200 bg-white h-12 shadow-sm">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.values(PROPOSTA_STATUS).map((s) => (
              <SelectItem key={s} value={s}>
                {PROPOSTA_STATUS_CONFIG[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          <p className="text-slate-500 mt-4">Carregando propostas...</p>
        </div>
      ) : !propostas || propostas.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <FileText className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-700">
            Nenhuma proposta encontrada
          </h3>
          <p className="text-slate-500 mt-1 text-sm">
            {search || statusFilter !== "all"
              ? "Tente ajustar os filtros."
              : "Crie sua primeira proposta comercial."}
          </p>
          {!search && statusFilter === "all" && (
            <Button
              onClick={() => setShowNewDialog(true)}
              variant="outline"
              className="mt-4 rounded-xl"
            >
              <Plus size={16} className="mr-2" /> Nova Proposta
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 px-1">
            Mostrando {propostas.length} proposta{propostas.length !== 1 ? "s" : ""}
          </p>

          {/* Table header (desktop) */}
          <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <div className="col-span-2">Numero</div>
            <div className="col-span-3">Cliente / Titulo</div>
            <div className="col-span-2 text-right">Valor Total</div>
            <div className="col-span-1 text-center">Itens</div>
            <div className="col-span-2 text-center">Status</div>
            <div className="col-span-2 text-right">Criada</div>
          </div>

          <div className="space-y-2">
            {propostas.map((p) => {
              const clienteName = getClienteName(p);
              const itemCount = getItemCount(p);
              const expired = isExpired(p.created_at, p.validade_dias);
              const expirationDate = getExpirationDate(p.created_at, p.validade_dias);

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProposta(p)}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer group"
                >
                  {/* Mobile layout */}
                  <div className="lg:hidden p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-mono text-slate-400">
                          {p.numero ?? "---"}
                        </span>
                        <h3 className="font-bold text-slate-800 text-base leading-tight group-hover:text-blue-700 transition-colors">
                          {p.titulo || "Sem titulo"}
                        </h3>
                        <p className="text-sm text-slate-500">{clienteName}</p>
                      </div>
                      <Badge
                        className={`text-xs font-semibold border ${getStatusBadgeClasses(p.status)}`}
                        variant="outline"
                      >
                        {getStatusLabel(p.status)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-800">
                        {brl(Number(p.total || 0))}
                      </span>
                      <span className="text-slate-400 text-xs">
                        {formatDateRelative(p.created_at)}
                      </span>
                    </div>
                    {expired && p.status !== "aprovada" && p.status !== "recusada" && p.status !== "expirada" && (
                      <div className="flex items-center gap-1 text-xs text-amber-600">
                        <Clock size={12} />
                        Validade expirada em {formatDate(expirationDate)}
                      </div>
                    )}
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden lg:grid lg:grid-cols-12 gap-4 items-center px-5 py-4">
                    <div className="col-span-2">
                      <span className="font-mono text-sm text-slate-600 font-medium">
                        {p.numero ?? "---"}
                      </span>
                    </div>
                    <div className="col-span-3 min-w-0">
                      <h3 className="font-semibold text-slate-800 truncate group-hover:text-blue-700 transition-colors">
                        {p.titulo || "Sem titulo"}
                      </h3>
                      <p className="text-sm text-slate-500 truncate">{clienteName}</p>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="font-semibold text-slate-800">
                        {brl(Number(p.total || 0))}
                      </span>
                    </div>
                    <div className="col-span-1 text-center">
                      <span className="text-sm text-slate-500">
                        {itemCount > 0 ? `${itemCount} ${itemCount === 1 ? "item" : "itens"}` : "-"}
                      </span>
                    </div>
                    <div className="col-span-2 text-center">
                      <Badge
                        className={`text-xs font-semibold border ${getStatusBadgeClasses(p.status)}`}
                        variant="outline"
                      >
                        {getStatusLabel(p.status)}
                      </Badge>
                      {expired && p.status !== "aprovada" && p.status !== "recusada" && p.status !== "expirada" && (
                        <div className="flex items-center justify-center gap-1 text-xs text-amber-600 mt-1">
                          <Clock size={11} />
                          Expirada
                        </div>
                      )}
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-sm text-slate-500">
                        {formatDate(p.created_at)}
                      </span>
                      <p className="text-xs text-slate-400">
                        {formatDateRelative(p.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* NEW PROPOSAL DIALOG                                               */}
      {/* ================================================================= */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">
              Nova Proposta Comercial
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Numero preview */}
            <div>
              <Label className="text-sm text-slate-600">Numero</Label>
              <Input
                value={generateNumero(propostaCount ?? 0)}
                readOnly
                disabled
                className="mt-1 font-mono bg-slate-50 text-slate-500 rounded-xl"
              />
              <p className="text-xs text-slate-400 mt-1">
                Gerado automaticamente ao salvar.
              </p>
            </div>

            {/* Titulo */}
            <div>
              <Label htmlFor="titulo" className="text-sm text-slate-600">
                Titulo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="titulo"
                placeholder="Ex.: Fachada ACM - Loja Centro"
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                className="mt-1 rounded-xl"
              />
            </div>

            {/* Cliente */}
            <div>
              <Label htmlFor="cliente" className="text-sm text-slate-600">
                Cliente <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.cliente_id}
                onValueChange={(v) => setForm((f) => ({ ...f, cliente_id: v }))}
              >
                <SelectTrigger id="cliente" className="mt-1 rounded-xl">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_fantasia ?? c.razao_social}
                    </SelectItem>
                  ))}
                  {(!clientes || clientes.length === 0) && (
                    <div className="px-3 py-2 text-sm text-slate-400">
                      Nenhum cliente cadastrado
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Validade */}
            <div>
              <Label htmlFor="validade" className="text-sm text-slate-600">
                Validade (dias)
              </Label>
              <Input
                id="validade"
                type="number"
                min={1}
                max={365}
                value={form.validade_dias}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    validade_dias: Math.max(1, Number(e.target.value) || 10),
                  }))
                }
                className="mt-1 rounded-xl"
              />
            </div>

            {/* Condicoes de pagamento */}
            <div>
              <Label htmlFor="condicoes" className="text-sm text-slate-600">
                Condicoes de Pagamento
              </Label>
              <Input
                id="condicoes"
                placeholder="Ex.: 30/60/90 dias"
                value={form.condicoes_pagamento}
                onChange={(e) =>
                  setForm((f) => ({ ...f, condicoes_pagamento: e.target.value }))
                }
                className="mt-1 rounded-xl"
              />
            </div>

            {/* Observacoes */}
            <div>
              <Label htmlFor="obs" className="text-sm text-slate-600">
                Observacoes
              </Label>
              <Textarea
                id="obs"
                placeholder="Observacoes internas ou para o cliente..."
                rows={3}
                value={form.observacoes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, observacoes: e.target.value }))
                }
                className="mt-1 rounded-xl resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowNewDialog(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateSubmit}
              disabled={createProposta.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
            >
              {createProposta.isPending ? "Criando..." : "Criar Proposta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* DETAIL DIALOG                                                     */}
      {/* ================================================================= */}
      <Dialog
        open={!!selectedProposta}
        onOpenChange={(open) => {
          if (!open) setSelectedProposta(null);
        }}
      >
        {selectedProposta && (
          <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-mono text-slate-400">
                    {selectedProposta.numero ?? "---"}
                  </p>
                  <DialogTitle className="text-xl font-bold text-slate-800 mt-1">
                    {selectedProposta.titulo || "Sem titulo"}
                  </DialogTitle>
                  <p className="text-sm text-slate-500 mt-1">
                    {getClienteName(selectedProposta)}
                  </p>
                </div>
                <Badge
                  className={`text-sm font-semibold border px-3 py-1 ${getStatusBadgeClasses(selectedProposta.status)}`}
                  variant="outline"
                >
                  {getStatusLabel(selectedProposta.status)}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">
                    Subtotal
                  </p>
                  <p className="text-lg font-bold text-slate-800 mt-1">
                    {brl(Number(selectedProposta.subtotal || 0))}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">
                    Desconto
                  </p>
                  <p className="text-lg font-bold text-red-600 mt-1">
                    {Number(selectedProposta.desconto_valor || 0) > 0
                      ? `- ${brl(Number(selectedProposta.desconto_valor))}`
                      : brl(0)}
                  </p>
                  {Number(selectedProposta.desconto_percentual || 0) > 0 && (
                    <p className="text-xs text-slate-400">
                      ({Number(selectedProposta.desconto_percentual).toFixed(1).replace(".", ",")}%)
                    </p>
                  )}
                </div>
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-blue-600 uppercase tracking-wider font-semibold">
                    Total
                  </p>
                  <p className="text-lg font-bold text-blue-700 mt-1">
                    {brl(Number(selectedProposta.total || 0))}
                  </p>
                </div>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <CalendarDays size={14} className="text-slate-400" />
                  <span className="text-slate-500">Criada em:</span>
                  <span className="font-medium text-slate-700">
                    {formatDate(selectedProposta.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-slate-400" />
                  <span className="text-slate-500">Validade:</span>
                  <span className="font-medium text-slate-700">
                    {selectedProposta.validade_dias} dias
                    {isExpired(selectedProposta.created_at, selectedProposta.validade_dias) &&
                      selectedProposta.status !== "aprovada" &&
                      selectedProposta.status !== "recusada" && (
                        <span className="text-amber-600 ml-1">(expirada)</span>
                      )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <BarChart3 size={14} className="text-slate-400" />
                  <span className="text-slate-500">Versao:</span>
                  <span className="font-medium text-slate-700">
                    v{selectedProposta.versao}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Package size={14} className="text-slate-400" />
                  <span className="text-slate-500">Itens:</span>
                  <span className="font-medium text-slate-700">
                    {getItemCount(selectedProposta) || 0}
                  </span>
                </div>
                {selectedProposta.condicoes_pagamento && (
                  <div className="col-span-2 flex items-start gap-2">
                    <DollarSign size={14} className="text-slate-400 mt-0.5" />
                    <span className="text-slate-500">Pagamento:</span>
                    <span className="font-medium text-slate-700">
                      {selectedProposta.condicoes_pagamento}
                    </span>
                  </div>
                )}
                {selectedProposta.aprovado_em && (
                  <div className="col-span-2 flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    <span className="text-slate-500">Aprovada em:</span>
                    <span className="font-medium text-emerald-700">
                      {formatDate(selectedProposta.aprovado_em)}
                    </span>
                  </div>
                )}
              </div>

              {/* Observacoes */}
              {selectedProposta.observacoes && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Observacoes
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">
                    {selectedProposta.observacoes}
                  </p>
                </div>
              )}

              {/* Items placeholder */}
              <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center">
                <Package className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-500">
                  Itens da Proposta
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Adicionar itens na proxima versao
                </p>
              </div>

              {/* Status actions */}
              {STATUS_TRANSITIONS[selectedProposta.status] && (
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Acoes
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_TRANSITIONS[selectedProposta.status]!.map((action) => {
                      const Icon = action.icon;
                      const isApprove = action.to === "aprovada";
                      const isReject = action.to === "recusada";
                      return (
                        <Button
                          key={action.to}
                          variant={isApprove ? "default" : isReject ? "destructive" : "outline"}
                          size="sm"
                          className={`rounded-xl ${
                            isApprove
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                              : ""
                          }`}
                          disabled={updateStatus.isPending}
                          onClick={() =>
                            updateStatus.mutate({
                              id: selectedProposta.id,
                              status: action.to,
                            })
                          }
                        >
                          <Icon size={14} className="mr-1.5" />
                          {action.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Timeline placeholder */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Historico
                </p>
                <div className="space-y-3">
                  <TimelineItem
                    icon={<Plus size={12} />}
                    text={`Proposta criada${selectedProposta.numero ? ` (${selectedProposta.numero})` : ""}`}
                    date={selectedProposta.created_at}
                  />
                  {selectedProposta.status !== "rascunho" && (
                    <TimelineItem
                      icon={<ArrowUpDown size={12} />}
                      text={`Status: ${getStatusLabel(selectedProposta.status)}`}
                      date={selectedProposta.updated_at}
                    />
                  )}
                  {selectedProposta.aprovado_em && (
                    <TimelineItem
                      icon={<CheckCircle2 size={12} />}
                      text="Proposta aprovada"
                      date={selectedProposta.aprovado_em}
                      highlight
                    />
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function StatsCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bg: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 uppercase tracking-wider truncate">
            {label}
          </p>
          <p className="text-lg font-bold text-slate-800 truncate">{value}</p>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({
  icon,
  text,
  date,
  highlight,
}: {
  icon: React.ReactNode;
  text: string;
  date: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
          highlight
            ? "bg-emerald-100 text-emerald-600"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-700">{text}</p>
        <p className="text-xs text-slate-400">
          {formatDate(date)} - {formatDateRelative(date)}
        </p>
      </div>
    </div>
  );
}
