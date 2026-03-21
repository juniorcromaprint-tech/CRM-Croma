// ============================================================================
// CONTRATOS PAGE — Contratos de manutenção recorrente (MRR)
// Rota: /contratos
// ============================================================================

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { brl, formatDate } from "@/shared/utils/format";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  FileText,
  Plus,
  MoreVertical,
  Pencil,
  PauseCircle,
  XCircle,
  TrendingUp,
  Calendar,
  Building2,
  Loader2,
  RefreshCw,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ContratoStatus = "ativo" | "suspenso" | "encerrado";
type Periodicidade = "mensal" | "bimestral" | "trimestral" | "semestral" | "anual";

interface Contrato {
  id: string;
  cliente_id: string;
  descricao: string;
  valor_mensal: number;
  periodicidade: Periodicidade;
  data_inicio: string;
  data_fim: string | null;
  status: ContratoStatus;
  proximo_faturamento: string | null;
  observacoes: string | null;
  created_at: string;
  clientes?: { nome_fantasia: string | null; razao_social: string } | null;
}

interface ClienteOption {
  id: string;
  nome_fantasia: string | null;
  razao_social: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ContratoStatus, { label: string; className: string }> = {
  ativo:     { label: "Ativo",     className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  suspenso:  { label: "Suspenso",  className: "bg-amber-50 text-amber-700 border-amber-200" },
  encerrado: { label: "Encerrado", className: "bg-slate-50 text-slate-500 border-slate-200" },
};

const PERIODICIDADE_CONFIG: Record<Periodicidade, string> = {
  mensal:     "Mensal",
  bimestral:  "Bimestral",
  trimestral: "Trimestral",
  semestral:  "Semestral",
  anual:      "Anual",
};

/** Calcula próximo faturamento com base na periodicidade. */
function calcularProximoFaturamento(dataInicio: string, periodicidade: Periodicidade): string {
  const d = new Date(dataInicio + "T00:00:00");
  const meses: Record<Periodicidade, number> = {
    mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12,
  };
  const today = new Date();
  while (d <= today) {
    d.setMonth(d.getMonth() + meses[periodicidade]);
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Form defaults ────────────────────────────────────────────────────────────

const FORM_EMPTY = {
  cliente_id: "",
  descricao: "",
  valor_mensal: "",
  periodicidade: "mensal" as Periodicidade,
  data_inicio: "",
  data_fim: "",
  observacoes: "",
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <Card className="border-none shadow-sm rounded-2xl bg-white">
      <CardContent className="p-5 flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-28" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  sub,
  subColor,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <Card className="border-none shadow-sm rounded-2xl bg-white">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <Icon size={22} className={iconColor} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide truncate">{label}</p>
          <p className="text-xl font-bold text-slate-800 mt-0.5 leading-tight font-mono">{value}</p>
          {sub && <p className={`text-xs mt-0.5 font-medium ${subColor ?? "text-slate-400"}`}>{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Dialog de Contrato ───────────────────────────────────────────────────────

interface ContratoDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editTarget: Contrato | null;
  clientes: ClienteOption[];
}

function ContratoDialog({ open, onOpenChange, editTarget, clientes }: ContratoDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(FORM_EMPTY);

  // Preencher form ao editar
  useEffect(() => {
    if (editTarget) {
      setForm({
        cliente_id: editTarget.cliente_id,
        descricao: editTarget.descricao,
        valor_mensal: String(editTarget.valor_mensal),
        periodicidade: editTarget.periodicidade,
        data_inicio: editTarget.data_inicio,
        data_fim: editTarget.data_fim ?? "",
        observacoes: editTarget.observacoes ?? "",
      });
    } else {
      setForm(FORM_EMPTY);
    }
  }, [editTarget]);

  // Reset ao abrir/fechar
  const handleOpenChange = (v: boolean) => {
    if (!v) setForm(FORM_EMPTY);
    onOpenChange(v);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.cliente_id || !form.descricao || !form.valor_mensal || !form.data_inicio) {
        throw new Error("Preencha os campos obrigatórios");
      }
      const valor = parseFloat(form.valor_mensal);
      if (isNaN(valor) || valor <= 0) throw new Error("Valor inválido");

      const proximoFaturamento = calcularProximoFaturamento(form.data_inicio, form.periodicidade);

      const payload = {
        cliente_id: form.cliente_id,
        descricao: form.descricao,
        valor_mensal: valor,
        periodicidade: form.periodicidade,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim || null,
        observacoes: form.observacoes || null,
        proximo_faturamento: proximoFaturamento,
        status: "ativo" as ContratoStatus,
      };

      if (editTarget) {
        const { error } = await supabase
          .from("contratos_servico")
          .update(payload)
          .eq("id", editTarget.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("contratos_servico")
          .insert(payload);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contratos"] });
      showSuccess(editTarget ? "Contrato atualizado" : "Contrato criado com sucesso");
      handleOpenChange(false);
    },
    onError: (err: Error) => showError(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={18} className="text-blue-600" />
            {editTarget ? "Editar Contrato" : "Novo Contrato"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Cliente */}
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Select
              value={form.cliente_id || "__none__"}
              onValueChange={(v) => setForm((p) => ({ ...p, cliente_id: v === "__none__" ? "" : v }))}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Selecione o cliente..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Selecione —</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome_fantasia || c.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label>Descrição do serviço *</Label>
            <Input
              placeholder="Ex: Manutenção mensal de fachadas..."
              value={form.descricao}
              onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
              className="rounded-xl"
            />
          </div>

          {/* Valor + Periodicidade */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor Mensal (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={form.valor_mensal}
                onChange={(e) => setForm((p) => ({ ...p, valor_mensal: e.target.value }))}
                className="rounded-xl font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Periodicidade</Label>
              <Select
                value={form.periodicidade}
                onValueChange={(v) => setForm((p) => ({ ...p, periodicidade: v as Periodicidade }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PERIODICIDADE_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data de Início *</Label>
              <Input
                type="date"
                value={form.data_inicio}
                onChange={(e) => setForm((p) => ({ ...p, data_inicio: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Término (opcional)</Label>
              <Input
                type="date"
                value={form.data_fim}
                onChange={(e) => setForm((p) => ({ ...p, data_fim: e.target.value }))}
                className="rounded-xl"
              />
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Detalhes adicionais do contrato..."
              value={form.observacoes}
              onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
              className="rounded-xl resize-none"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 rounded-xl"
          >
            {saveMutation.isPending
              ? <><Loader2 size={16} className="animate-spin mr-2" />Salvando...</>
              : editTarget ? "Salvar Alterações" : "Criar Contrato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContratosPage() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<Contrato | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ativo");

  // ── Queries ──
  const { data: contratos = [], isLoading } = useQuery({
    queryKey: ["contratos"],
    queryFn: async (): Promise<Contrato[]> => {
      const { data, error } = await supabase
        .from("contratos_servico")
        .select("*, clientes(nome_fantasia, razao_social)")
        .is("excluido_em", null)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Contrato[];
    },
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes_options"],
    queryFn: async (): Promise<ClienteOption[]> => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome_fantasia, razao_social")
        .eq("ativo", true)
        .order("nome_fantasia", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as ClienteOption[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // ── Mutations ──
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ContratoStatus }) => {
      const { error } = await supabase
        .from("contratos_servico")
        .update({ status })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contratos"] });
      showSuccess("Status do contrato atualizado");
    },
    onError: (err: Error) => showError(err.message),
  });

  // ── Derived ──
  const filtered = useMemo(() => {
    if (statusFilter === "todos") return contratos;
    return contratos.filter((c) => c.status === statusFilter);
  }, [contratos, statusFilter]);

  const ativos = contratos.filter((c) => c.status === "ativo");
  const mrr = ativos.reduce((sum, c) => sum + Number(c.valor_mensal), 0);
  const arr = mrr * 12;

  const getClienteName = (c: Contrato) =>
    c.clientes?.nome_fantasia || c.clientes?.razao_social || "—";

  const handleEdit = (c: Contrato) => {
    setEditTarget(c);
    setShowDialog(true);
  };

  const handleNovoContrato = () => {
    setEditTarget(null);
    setShowDialog(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <RefreshCw size={20} className="text-blue-600" />
            </div>
            Contratos Recorrentes
          </h1>
          <p className="text-slate-500 mt-1 ml-1">
            Manutenção de fachadas, adesivos sazonais e serviços recorrentes
          </p>
        </div>
        <Button
          onClick={handleNovoContrato}
          className="bg-blue-600 hover:bg-blue-700 rounded-xl gap-2"
        >
          <Plus size={16} />
          Novo Contrato
        </Button>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <KpiSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label="Contratos Ativos"
            value={String(ativos.length)}
            icon={FileText}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
            sub={`${contratos.filter((c) => c.status === "suspenso").length} suspensos`}
          />
          <KpiCard
            label="MRR (Receita Mensal)"
            value={brl(mrr)}
            icon={TrendingUp}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            sub="Receita recorrente mensal"
            subColor="text-emerald-600"
          />
          <KpiCard
            label="ARR (Receita Anual)"
            value={brl(arr)}
            icon={Building2}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-600"
            sub="Projeção anual"
          />
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: "todos", label: "Todos" },
          { key: "ativo", label: "Ativos" },
          { key: "suspenso", label: "Suspensos" },
          { key: "encerrado", label: "Encerrados" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`text-xs font-semibold px-4 py-2 rounded-xl border transition-all ${
              statusFilter === f.key
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Tabela */}
      {isLoading ? (
        <Card className="border-none shadow-sm rounded-2xl bg-white">
          <CardContent className="p-6 space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <FileText size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-600">Nenhum contrato encontrado</h3>
          <p className="text-sm text-slate-400 mt-1">
            {statusFilter === "todos"
              ? "Crie o primeiro contrato de manutenção recorrente"
              : `Não há contratos com status "${STATUS_CONFIG[statusFilter as ContratoStatus]?.label ?? statusFilter}"`}
          </p>
        </div>
      ) : (
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Cliente
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Descrição
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Valor Mensal
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                    Periodicidade
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden md:table-cell">
                    Próx. Faturamento
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((contrato) => {
                  const cfg = STATUS_CONFIG[contrato.status];
                  return (
                    <tr key={contrato.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                            <Building2 size={14} className="text-blue-500" />
                          </div>
                          <p className="font-semibold text-slate-800 truncate max-w-[160px]">
                            {getClienteName(contrato)}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-slate-700 truncate max-w-[200px]">{contrato.descricao}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Desde {formatDate(contrato.data_inicio)}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-slate-800 tabular-nums font-mono">
                        {brl(Number(contrato.valor_mensal))}
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-slate-500 hidden sm:table-cell">
                        {PERIODICIDADE_CONFIG[contrato.periodicidade]}
                      </td>
                      <td className="px-4 py-4 text-center hidden md:table-cell">
                        {contrato.proximo_faturamento ? (
                          <div className="flex items-center justify-center gap-1.5 text-sm text-slate-600">
                            <Calendar size={13} className="text-slate-400" />
                            {formatDate(contrato.proximo_faturamento)}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge variant="outline" className={`text-xs font-semibold ${cfg.className}`}>
                          {cfg.label}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg">
                              <MoreVertical size={15} className="text-slate-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl shadow-md">
                            <DropdownMenuItem
                              onClick={() => handleEdit(contrato)}
                              className="gap-2 text-sm cursor-pointer"
                            >
                              <Pencil size={14} />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {contrato.status === "ativo" && (
                              <DropdownMenuItem
                                onClick={() => statusMutation.mutate({ id: contrato.id, status: "suspenso" })}
                                className="gap-2 text-sm cursor-pointer text-amber-600"
                              >
                                <PauseCircle size={14} />
                                Suspender
                              </DropdownMenuItem>
                            )}
                            {contrato.status === "suspenso" && (
                              <DropdownMenuItem
                                onClick={() => statusMutation.mutate({ id: contrato.id, status: "ativo" })}
                                className="gap-2 text-sm cursor-pointer text-emerald-600"
                              >
                                <RefreshCw size={14} />
                                Reativar
                              </DropdownMenuItem>
                            )}
                            {contrato.status !== "encerrado" && (
                              <DropdownMenuItem
                                onClick={() => statusMutation.mutate({ id: contrato.id, status: "encerrado" })}
                                className="gap-2 text-sm cursor-pointer text-red-600"
                              >
                                <XCircle size={14} />
                                Encerrar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Dialog */}
      <ContratoDialog
        open={showDialog}
        onOpenChange={(v) => {
          setShowDialog(v);
          if (!v) setEditTarget(null);
        }}
        editTarget={editTarget}
        clientes={clientes}
      />
    </div>
  );
}
