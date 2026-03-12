// ============================================================================
// FINANCEIRO PAGE — Croma Print ERP/CRM
// Contas a Receber, Contas a Pagar e DRE (Demonstrativo de Resultado)
// ============================================================================

import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";
import { brl, formatDate } from "@/shared/utils/format";

/** Returns today's date as "yyyy-MM-dd" in local timezone (avoids UTC offset bug). */
function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Receipt,
  CreditCard,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  CircleDollarSign,
  Banknote,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type ContaReceberStatus =
  | "previsto"
  | "faturado"
  | "a_vencer"
  | "vencido"
  | "parcial"
  | "pago"
  | "cancelado";

type ContaPagarStatus =
  | "a_pagar"
  | "vencido"
  | "parcial"
  | "pago"
  | "cancelado";

interface ContaReceber {
  id: string;
  pedido_id: string | null;
  cliente_id: string;
  numero_titulo: string | null;
  valor_original: number;
  valor_pago: number;
  saldo: number | null;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento: string | null;
  status: ContaReceberStatus;
  forma_pagamento: string | null;
  observacoes: string | null;
  excluido_em: string | null;
  created_at: string;
  updated_at: string;
  clientes?: { nome_fantasia: string | null; razao_social: string } | null;
  pedidos?: { numero: string | null } | null;
}

interface ContaPagar {
  id: string;
  pedido_compra_id: string | null;
  fornecedor_id: string | null;
  categoria: string | null;
  numero_titulo: string | null;
  numero_nf: string | null;
  valor_original: number;
  valor_pago: number;
  saldo: number | null;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento: string | null;
  status: ContaPagarStatus;
  forma_pagamento: string | null;
  observacoes: string | null;
  excluido_em: string | null;
  created_at: string;
  updated_at: string;
  fornecedores?: { nome_fantasia: string | null; razao_social: string } | null;
}

interface ClienteOption {
  id: string;
  nome_fantasia: string | null;
  razao_social: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_RECEBER_CONFIG: Record<
  ContaReceberStatus,
  { label: string; className: string }
> = {
  previsto: {
    label: "Previsto",
    className: "bg-slate-50 text-slate-700 border-slate-200",
  },
  faturado: {
    label: "Faturado",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  a_vencer: {
    label: "A vencer",
    className: "bg-sky-50 text-sky-700 border-sky-200",
  },
  vencido: {
    label: "Vencido",
    className: "bg-red-50 text-red-600 border-red-200",
  },
  parcial: {
    label: "Parcial",
    className: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  pago: {
    label: "Pago",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-gray-50 text-gray-500 border-gray-200",
  },
};

const STATUS_PAGAR_CONFIG: Record<
  ContaPagarStatus,
  { label: string; className: string }
> = {
  a_pagar: {
    label: "A pagar",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  vencido: {
    label: "Vencido",
    className: "bg-red-50 text-red-600 border-red-200",
  },
  parcial: {
    label: "Parcial",
    className: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  pago: {
    label: "Pago",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-gray-50 text-gray-500 border-gray-200",
  },
};

const CATEGORIAS_PAGAR = [
  { value: "material", label: "Material" },
  { value: "servico", label: "Servico" },
  { value: "aluguel", label: "Aluguel" },
  { value: "energia", label: "Energia" },
  { value: "agua", label: "Agua" },
  { value: "internet", label: "Internet" },
  { value: "salarios", label: "Salarios" },
  { value: "impostos", label: "Impostos" },
  { value: "outro", label: "Outro" },
] as const;

const MESES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function getClienteName(
  cr: ContaReceber
): string {
  if (cr.clientes?.nome_fantasia) return cr.clientes.nome_fantasia;
  if (cr.clientes?.razao_social) return cr.clientes.razao_social;
  return "Cliente sem nome";
}

function getFornecedorName(
  cp: ContaPagar
): string {
  if (cp.fornecedores?.nome_fantasia) return cp.fornecedores.nome_fantasia;
  if (cp.fornecedores?.razao_social) return cp.fornecedores.razao_social;
  return cp.categoria || "Sem fornecedor";
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(key: string): string {
  const [year, month] = key.split("-");
  return `${MESES_PT[parseInt(month, 10) - 1]} ${year}`;
}

function getLast6Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }
  return months;
}

// ─── KPI Card Sub-component ─────────────────────────────────────────────────

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
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}
        >
          <Icon size={22} className={iconColor} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide truncate">
            {label}
          </p>
          <p className="text-xl font-bold text-slate-800 mt-0.5 leading-tight font-mono">
            {value}
          </p>
          {sub && (
            <p
              className={`text-xs mt-0.5 font-medium ${subColor ?? "text-slate-400"}`}
            >
              {sub}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

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

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
      <div className="p-6 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Tab: Contas a Receber ──────────────────────────────────────────────────

function TabContasReceber() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [baixaTarget, setBaixaTarget] = useState<ContaReceber | null>(null);
  const [baixaValor, setBaixaValor] = useState("");

  // ── Queries ──
  const {
    data: contas = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["financeiro", "contas_receber"],
    queryFn: async (): Promise<ContaReceber[]> => {
      const { data, error } = await supabase
        .from("contas_receber")
        .select(
          "*, clientes(nome_fantasia, razao_social), pedidos(numero)"
        )
        .is("excluido_em", null)
        .order("data_vencimento", { ascending: true });
      if (error)
        throw new Error(`Erro ao buscar contas a receber: ${error.message}`);
      return (data ?? []) as ContaReceber[];
    },
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["financeiro", "clientes_options"],
    queryFn: async (): Promise<ClienteOption[]> => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome_fantasia, razao_social")
        .eq("ativo", true)
        .order("nome_fantasia", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as ClienteOption[];
    },
  });

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: async (payload: {
      cliente_id: string;
      valor_original: number;
      data_vencimento: string;
      forma_pagamento?: string;
      observacoes?: string;
    }) => {
      const { data, error } = await supabase
        .from("contas_receber")
        .insert({
          cliente_id: payload.cliente_id,
          valor_original: payload.valor_original,
          data_vencimento: payload.data_vencimento,
          forma_pagamento: payload.forma_pagamento || null,
          observacoes: payload.observacoes || null,
          status: "a_vencer",
          saldo: payload.valor_original,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      showSuccess("Conta a receber criada com sucesso");
      setShowCreateDialog(false);
    },
    onError: (err: Error) => showError(err.message),
  });

  const baixaMutation = useMutation({
    mutationFn: async ({
      id,
      valor_pago,
    }: {
      id: string;
      valor_pago: number;
    }) => {
      const { data: conta, error: fetchErr } = await supabase
        .from("contas_receber")
        .select("valor_original, valor_pago")
        .eq("id", id)
        .single();
      if (fetchErr) throw new Error(fetchErr.message);

      const novoValorPago = (Number(conta.valor_pago) || 0) + valor_pago;
      const valorOriginal = Number(conta.valor_original) || 0;
      const novoStatus: ContaReceberStatus =
        novoValorPago >= valorOriginal ? "pago" : "parcial";
      const saldo = valorOriginal - novoValorPago;

      const { error } = await supabase
        .from("contas_receber")
        .update({
          valor_pago: novoValorPago,
          saldo,
          status: novoStatus,
          data_pagamento: localDateStr(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      showSuccess("Pagamento registrado com sucesso");
      setBaixaTarget(null);
      setBaixaValor("");
    },
    onError: (err: Error) => showError(err.message),
  });

  // ── Derived ──
  const filtered = useMemo(() => {
    let list = contas;
    if (statusFilter !== "todos") {
      list = list.filter((c) => c.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          getClienteName(c).toLowerCase().includes(q) ||
          (c.numero_titulo && c.numero_titulo.toLowerCase().includes(q))
      );
    }
    return list;
  }, [contas, statusFilter, search]);

  const stats = useMemo(() => {
    let totalReceber = 0;
    let emDia = 0;
    let vencido = 0;
    let recebido = 0;
    for (const c of contas) {
      const val = Number(c.valor_original) || 0;
      const pago = Number(c.valor_pago) || 0;
      if (c.status === "pago") {
        recebido += val;
      } else if (c.status === "vencido") {
        vencido += val - pago;
        totalReceber += val - pago;
      } else if (c.status !== "cancelado") {
        emDia += val - pago;
        totalReceber += val - pago;
      }
    }
    return { totalReceber, emDia, vencido, recebido };
  }, [contas]);

  // ── Create Dialog State ──
  const [formCR, setFormCR] = useState({
    cliente_id: "",
    valor_original: "",
    data_vencimento: "",
    forma_pagamento: "",
    observacoes: "",
  });

  const handleCreateCR = () => {
    if (!formCR.cliente_id || !formCR.valor_original || !formCR.data_vencimento) {
      showError("Preencha os campos obrigatorios");
      return;
    }
    createMutation.mutate({
      cliente_id: formCR.cliente_id,
      valor_original: parseFloat(formCR.valor_original),
      data_vencimento: formCR.data_vencimento,
      forma_pagamento: formCR.forma_pagamento,
      observacoes: formCR.observacoes,
    });
  };

  const handleBaixa = () => {
    if (!baixaTarget || !baixaValor) return;
    const valor = parseFloat(baixaValor);
    if (isNaN(valor) || valor <= 0) {
      showError("Informe um valor valido");
      return;
    }
    baixaMutation.mutate({ id: baixaTarget.id, valor_pago: valor });
  };

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        Erro ao carregar contas a receber. Verifique a conexao.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total a Receber"
            value={brl(stats.totalReceber)}
            icon={Receipt}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
            sub={`${contas.filter((c) => !["pago", "cancelado"].includes(c.status)).length} titulos`}
          />
          <KpiCard
            label="Em Dia"
            value={brl(stats.emDia)}
            icon={Clock}
            iconBg="bg-sky-50"
            iconColor="text-sky-600"
            sub="a vencer"
            subColor="text-sky-600"
          />
          <KpiCard
            label="Vencido"
            value={brl(stats.vencido)}
            icon={AlertCircle}
            iconBg="bg-red-50"
            iconColor="text-red-500"
            sub={`${contas.filter((c) => c.status === "vencido").length} titulos`}
            subColor="text-red-500"
          />
          <KpiCard
            label="Recebido"
            value={brl(stats.recebido)}
            icon={CheckCircle2}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            sub={`${contas.filter((c) => c.status === "pago").length} titulos`}
            subColor="text-emerald-600"
          />
        </div>
      )}

      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: "todos", label: "Todos" },
            { key: "a_vencer", label: "A vencer" },
            { key: "vencido", label: "Vencido" },
            { key: "parcial", label: "Parcial" },
            { key: "pago", label: "Pago" },
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
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              placeholder="Buscar cliente ou titulo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl border-slate-200 h-10 w-full sm:w-60"
            />
          </div>
          <Button
            onClick={() => {
              setFormCR({
                cliente_id: "",
                valor_original: "",
                data_vencimento: "",
                forma_pagamento: "",
                observacoes: "",
              });
              setShowCreateDialog(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 gap-2"
          >
            <Plus size={16} />
            Nova Conta
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <Card className="border-none shadow-sm rounded-2xl bg-white">
          <CardContent className="py-12 text-center text-slate-400">
            <Receipt size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhuma conta a receber encontrada</p>
            <p className="text-sm mt-1">
              Ajuste os filtros ou crie uma nova conta
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Titulo
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Cliente
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Valor
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                    Vencimento
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Acao
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((conta) => {
                  const cfg = STATUS_RECEBER_CONFIG[conta.status];
                  return (
                    <tr
                      key={conta.id}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">
                          {conta.numero_titulo || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-800 truncate max-w-[200px]">
                          {getClienteName(conta)}
                        </p>
                        {conta.pedidos?.numero && (
                          <p className="text-xs text-slate-400 font-mono mt-0.5">
                            Pedido {conta.pedidos.numero}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className="font-bold text-slate-800 tabular-nums font-mono">
                          {brl(Number(conta.valor_original))}
                        </p>
                        {Number(conta.valor_pago) > 0 && (
                          <p className="text-xs text-emerald-600 font-mono mt-0.5">
                            Pago: {brl(Number(conta.valor_pago))}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-slate-500 hidden sm:table-cell">
                        {formatDate(conta.data_vencimento)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge
                          variant="outline"
                          className={`text-xs font-semibold ${cfg.className}`}
                        >
                          {cfg.label}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {conta.status !== "pago" &&
                        conta.status !== "cancelado" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setBaixaTarget(conta);
                              const remaining =
                                Number(conta.valor_original) -
                                (Number(conta.valor_pago) || 0);
                              setBaixaValor(
                                remaining > 0 ? remaining.toFixed(2) : ""
                              );
                            }}
                            className="h-8 text-xs rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300"
                          >
                            <Banknote size={14} className="mr-1" />
                            Registrar Pagamento
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt size={18} className="text-blue-600" />
              Nova Conta a Receber
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select
                value={formCR.cliente_id}
                onValueChange={(v) =>
                  setFormCR((p) => ({ ...p, cliente_id: v }))
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_fantasia || c.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={formCR.valor_original}
                  onChange={(e) =>
                    setFormCR((p) => ({ ...p, valor_original: e.target.value }))
                  }
                  className="rounded-xl font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Vencimento *</Label>
                <Input
                  type="date"
                  value={formCR.data_vencimento}
                  onChange={(e) =>
                    setFormCR((p) => ({
                      ...p,
                      data_vencimento: e.target.value,
                    }))
                  }
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Input
                placeholder="Ex: Boleto, PIX, Transferencia..."
                value={formCR.forma_pagamento}
                onChange={(e) =>
                  setFormCR((p) => ({
                    ...p,
                    forma_pagamento: e.target.value,
                  }))
                }
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Observacoes</Label>
              <Textarea
                placeholder="Observacoes adicionais..."
                value={formCR.observacoes}
                onChange={(e) =>
                  setFormCR((p) => ({ ...p, observacoes: e.target.value }))
                }
                className="rounded-xl resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateCR}
              disabled={createMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 rounded-xl"
            >
              {createMutation.isPending ? "Criando..." : "Criar Conta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Baixa Dialog */}
      <Dialog
        open={baixaTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setBaixaTarget(null);
            setBaixaValor("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote size={18} className="text-emerald-600" />
              Registrar Pagamento
            </DialogTitle>
          </DialogHeader>
          {baixaTarget && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Cliente</span>
                  <span className="font-semibold text-slate-800">
                    {getClienteName(baixaTarget)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Valor Original</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {brl(Number(baixaTarget.valor_original))}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Já Pago</span>
                  <span className="font-mono text-emerald-600">
                    {brl(Number(baixaTarget.valor_pago) || 0)}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between text-sm">
                  <span className="text-slate-500 font-semibold">
                    Saldo Restante
                  </span>
                  <span className="font-mono font-bold text-blue-600">
                    {brl(
                      Number(baixaTarget.valor_original) -
                        (Number(baixaTarget.valor_pago) || 0)
                    )}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Valor do Pagamento *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={baixaValor}
                  onChange={(e) => setBaixaValor(e.target.value)}
                  className="rounded-xl font-mono text-lg"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBaixaTarget(null);
                setBaixaValor("");
              }}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleBaixa}
              disabled={baixaMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 rounded-xl"
            >
              {baixaMutation.isPending
                ? "Registrando..."
                : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab: Contas a Pagar ────────────────────────────────────────────────────

function TabContasPagar() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // ── Queries ──
  const {
    data: contas = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["financeiro", "contas_pagar"],
    queryFn: async (): Promise<ContaPagar[]> => {
      const { data, error } = await supabase
        .from("contas_pagar")
        .select("*, fornecedores(nome_fantasia, razao_social)")
        .is("excluido_em", null)
        .order("data_vencimento", { ascending: true });
      if (error)
        throw new Error(`Erro ao buscar contas a pagar: ${error.message}`);
      return (data ?? []) as ContaPagar[];
    },
  });

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: async (payload: {
      categoria: string;
      valor_original: number;
      data_vencimento: string;
      numero_nf?: string;
      observacoes?: string;
    }) => {
      const { data, error } = await supabase
        .from("contas_pagar")
        .insert({
          categoria: payload.categoria,
          valor_original: payload.valor_original,
          data_vencimento: payload.data_vencimento,
          numero_nf: payload.numero_nf || null,
          observacoes: payload.observacoes || null,
          status: "a_pagar",
          saldo: payload.valor_original,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      showSuccess("Conta a pagar criada com sucesso");
      setShowCreateDialog(false);
    },
    onError: (err: Error) => showError(err.message),
  });

  const pagarMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data: conta, error: fetchErr } = await supabase
        .from("contas_pagar")
        .select("valor_original")
        .eq("id", id)
        .single();
      if (fetchErr) throw new Error(fetchErr.message);

      const { error } = await supabase
        .from("contas_pagar")
        .update({
          valor_pago: Number(conta.valor_original),
          saldo: 0,
          status: "pago" as ContaPagarStatus,
          data_pagamento: localDateStr(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      showSuccess("Conta marcada como paga");
    },
    onError: (err: Error) => showError(err.message),
  });

  // ── Derived ──
  const filtered = useMemo(() => {
    let list = contas;
    if (statusFilter !== "todos") {
      list = list.filter((c) => c.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          getFornecedorName(c).toLowerCase().includes(q) ||
          (c.numero_titulo && c.numero_titulo.toLowerCase().includes(q)) ||
          (c.categoria && c.categoria.toLowerCase().includes(q))
      );
    }
    return list;
  }, [contas, statusFilter, search]);

  const stats = useMemo(() => {
    let totalPagar = 0;
    let vencido = 0;
    let pago = 0;
    for (const c of contas) {
      const val = Number(c.valor_original) || 0;
      const pgto = Number(c.valor_pago) || 0;
      if (c.status === "pago") {
        pago += val;
      } else if (c.status === "vencido") {
        vencido += val - pgto;
        totalPagar += val - pgto;
      } else if (c.status !== "cancelado") {
        totalPagar += val - pgto;
      }
    }
    return { totalPagar, vencido, pago };
  }, [contas]);

  // ── Create Dialog State ──
  const [formCP, setFormCP] = useState({
    categoria: "",
    valor_original: "",
    data_vencimento: "",
    numero_nf: "",
    observacoes: "",
  });

  const handleCreateCP = () => {
    if (!formCP.categoria || !formCP.valor_original || !formCP.data_vencimento) {
      showError("Preencha os campos obrigatorios");
      return;
    }
    createMutation.mutate({
      categoria: formCP.categoria,
      valor_original: parseFloat(formCP.valor_original),
      data_vencimento: formCP.data_vencimento,
      numero_nf: formCP.numero_nf,
      observacoes: formCP.observacoes,
    });
  };

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        Erro ao carregar contas a pagar. Verifique a conexao.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label="Total a Pagar"
            value={brl(stats.totalPagar)}
            icon={CreditCard}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
            sub={`${contas.filter((c) => !["pago", "cancelado"].includes(c.status)).length} titulos`}
          />
          <KpiCard
            label="Vencido"
            value={brl(stats.vencido)}
            icon={AlertCircle}
            iconBg="bg-red-50"
            iconColor="text-red-500"
            sub={`${contas.filter((c) => c.status === "vencido").length} titulos`}
            subColor="text-red-500"
          />
          <KpiCard
            label="Pago"
            value={brl(stats.pago)}
            icon={CheckCircle2}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            sub={`${contas.filter((c) => c.status === "pago").length} titulos`}
            subColor="text-emerald-600"
          />
        </div>
      )}

      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: "todos", label: "Todos" },
            { key: "a_pagar", label: "A pagar" },
            { key: "vencido", label: "Vencido" },
            { key: "parcial", label: "Parcial" },
            { key: "pago", label: "Pago" },
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
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              placeholder="Buscar fornecedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl border-slate-200 h-10 w-full sm:w-60"
            />
          </div>
          <Button
            onClick={() => {
              setFormCP({
                categoria: "",
                valor_original: "",
                data_vencimento: "",
                numero_nf: "",
                observacoes: "",
              });
              setShowCreateDialog(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 gap-2"
          >
            <Plus size={16} />
            Nova Conta
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <Card className="border-none shadow-sm rounded-2xl bg-white">
          <CardContent className="py-12 text-center text-slate-400">
            <CreditCard size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhuma conta a pagar encontrada</p>
            <p className="text-sm mt-1">
              Ajuste os filtros ou crie uma nova conta
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Titulo
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Fornecedor / Categoria
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Valor
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                    Vencimento
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Acao
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((conta) => {
                  const cfg = STATUS_PAGAR_CONFIG[conta.status];
                  return (
                    <tr
                      key={conta.id}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">
                          {conta.numero_titulo || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-800 truncate max-w-[200px]">
                          {getFornecedorName(conta)}
                        </p>
                        {conta.categoria && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {conta.categoria}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-slate-800 tabular-nums font-mono">
                        {brl(Number(conta.valor_original))}
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-slate-500 hidden sm:table-cell">
                        {formatDate(conta.data_vencimento)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge
                          variant="outline"
                          className={`text-xs font-semibold ${cfg.className}`}
                        >
                          {cfg.label}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {conta.status !== "pago" &&
                        conta.status !== "cancelado" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              pagarMutation.mutate({ id: conta.id })
                            }
                            disabled={pagarMutation.isPending}
                            className="h-8 text-xs rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300"
                          >
                            Marcar pago
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard size={18} className="text-blue-600" />
              Nova Conta a Pagar
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select
                value={formCP.categoria}
                onValueChange={(v) =>
                  setFormCP((p) => ({ ...p, categoria: v }))
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_PAGAR.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={formCP.valor_original}
                  onChange={(e) =>
                    setFormCP((p) => ({ ...p, valor_original: e.target.value }))
                  }
                  className="rounded-xl font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Vencimento *</Label>
                <Input
                  type="date"
                  value={formCP.data_vencimento}
                  onChange={(e) =>
                    setFormCP((p) => ({
                      ...p,
                      data_vencimento: e.target.value,
                    }))
                  }
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Numero NF (opcional)</Label>
              <Input
                placeholder="Ex: 12345"
                value={formCP.numero_nf}
                onChange={(e) =>
                  setFormCP((p) => ({ ...p, numero_nf: e.target.value }))
                }
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Observacoes</Label>
              <Textarea
                placeholder="Observacoes adicionais..."
                value={formCP.observacoes}
                onChange={(e) =>
                  setFormCP((p) => ({ ...p, observacoes: e.target.value }))
                }
                className="rounded-xl resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateCP}
              disabled={createMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 rounded-xl"
            >
              {createMutation.isPending ? "Criando..." : "Criar Conta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab: DRE ───────────────────────────────────────────────────────────────

function TabDRE() {
  // Fetch both contas to calculate DRE client-side
  const { data: receber = [], isLoading: loadingCR } = useQuery({
    queryKey: ["financeiro", "contas_receber"],
    queryFn: async (): Promise<ContaReceber[]> => {
      const { data, error } = await supabase
        .from("contas_receber")
        .select(
          "*, clientes(nome_fantasia, razao_social), pedidos(numero)"
        )
        .is("excluido_em", null)
        .order("data_vencimento", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as ContaReceber[];
    },
  });

  const { data: pagar = [], isLoading: loadingCP } = useQuery({
    queryKey: ["financeiro", "contas_pagar"],
    queryFn: async (): Promise<ContaPagar[]> => {
      const { data, error } = await supabase
        .from("contas_pagar")
        .select("*, fornecedores(nome_fantasia, razao_social)")
        .is("excluido_em", null)
        .order("data_vencimento", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as ContaPagar[];
    },
  });

  const isLoading = loadingCR || loadingCP;
  const months = useMemo(() => getLast6Months(), []);

  // Overall summary (pago only)
  const summary = useMemo(() => {
    const receita = receber
      .filter((c) => c.status === "pago")
      .reduce((s, c) => s + (Number(c.valor_pago) || Number(c.valor_original) || 0), 0);

    const custoCategories = ["material", "servico"];
    const custos = pagar
      .filter(
        (c) =>
          c.status === "pago" &&
          c.categoria &&
          custoCategories.includes(c.categoria)
      )
      .reduce((s, c) => s + (Number(c.valor_pago) || Number(c.valor_original) || 0), 0);

    const despesas = pagar
      .filter(
        (c) =>
          c.status === "pago" &&
          (!c.categoria || !custoCategories.includes(c.categoria))
      )
      .reduce((s, c) => s + (Number(c.valor_pago) || Number(c.valor_original) || 0), 0);

    return {
      receita,
      custos,
      despesas,
      resultado: receita - custos - despesas,
    };
  }, [receber, pagar]);

  // Monthly breakdown
  const monthlyData = useMemo(() => {
    const custoCategories = ["material", "servico"];

    return months.map((monthKey) => {
      const receitas = receber
        .filter(
          (c) =>
            c.status === "pago" &&
            c.data_pagamento &&
            getMonthKey(c.data_pagamento) === monthKey
        )
        .reduce((s, c) => s + (Number(c.valor_pago) || Number(c.valor_original) || 0), 0);

      const custos = pagar
        .filter(
          (c) =>
            c.status === "pago" &&
            c.data_pagamento &&
            getMonthKey(c.data_pagamento) === monthKey &&
            c.categoria &&
            custoCategories.includes(c.categoria)
        )
        .reduce((s, c) => s + (Number(c.valor_pago) || Number(c.valor_original) || 0), 0);

      const despesas = pagar
        .filter(
          (c) =>
            c.status === "pago" &&
            c.data_pagamento &&
            getMonthKey(c.data_pagamento) === monthKey &&
            (!c.categoria || !custoCategories.includes(c.categoria))
        )
        .reduce((s, c) => s + (Number(c.valor_pago) || Number(c.valor_original) || 0), 0);

      return {
        month: monthKey,
        label: getMonthLabel(monthKey),
        receitas,
        custos,
        despesas,
        resultado: receitas - custos - despesas,
      };
    });
  }, [receber, pagar, months]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
        <TableSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Receita Bruta"
          value={brl(summary.receita)}
          icon={TrendingUp}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          sub="total recebido"
          subColor="text-emerald-600"
        />
        <KpiCard
          label="(-) Custos"
          value={brl(summary.custos)}
          icon={FileText}
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
          sub="material + servico"
          subColor="text-orange-600"
        />
        <KpiCard
          label="(-) Despesas"
          value={brl(summary.despesas)}
          icon={TrendingDown}
          iconBg="bg-red-50"
          iconColor="text-red-500"
          sub="demais categorias"
          subColor="text-red-500"
        />
        <KpiCard
          label="= Resultado Líquido"
          value={brl(summary.resultado)}
          icon={CircleDollarSign}
          iconBg={summary.resultado >= 0 ? "bg-emerald-50" : "bg-red-50"}
          iconColor={
            summary.resultado >= 0 ? "text-emerald-600" : "text-red-600"
          }
          sub={
            summary.receita > 0
              ? `Margem: ${((summary.resultado / summary.receita) * 100).toFixed(1).replace(".", ",")}%`
              : undefined
          }
          subColor={
            summary.resultado >= 0 ? "text-emerald-600" : "text-red-600"
          }
        />
      </div>

      {/* Monthly Breakdown Table */}
      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <BarChart3 size={18} className="text-blue-600" />
            DRE Mensal — Últimos 6 Meses
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            Base: contas pagas (baixadas)
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Mes
                </th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Receitas
                </th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Custos
                </th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Despesas
                </th>
                <th className="text-right px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Resultado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {monthlyData.map((row) => {
                const hasData =
                  row.receitas > 0 || row.custos > 0 || row.despesas > 0;
                return (
                  <tr
                    key={row.month}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {row.label}
                    </td>
                    <td className="px-4 py-4 text-right font-mono tabular-nums text-emerald-600 font-medium">
                      {hasData ? brl(row.receitas) : "—"}
                    </td>
                    <td className="px-4 py-4 text-right font-mono tabular-nums text-red-500 font-medium">
                      {row.custos > 0 ? `(${brl(row.custos)})` : "—"}
                    </td>
                    <td className="px-4 py-4 text-right font-mono tabular-nums text-red-500 font-medium">
                      {row.despesas > 0 ? `(${brl(row.despesas)})` : "—"}
                    </td>
                    <td
                      className={`px-6 py-4 text-right font-mono tabular-nums font-bold ${
                        !hasData
                          ? "text-slate-300"
                          : row.resultado >= 0
                            ? "text-emerald-700"
                            : "text-red-600"
                      }`}
                    >
                      {hasData ? brl(row.resultado) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr
                className={`font-bold ${
                  summary.resultado >= 0 ? "bg-emerald-50" : "bg-red-50"
                }`}
              >
                <td
                  className={`px-6 py-4 ${summary.resultado >= 0 ? "text-emerald-800" : "text-red-800"}`}
                >
                  TOTAL
                </td>
                <td className="px-4 py-4 text-right font-mono tabular-nums text-emerald-700">
                  {brl(summary.receita)}
                </td>
                <td className="px-4 py-4 text-right font-mono tabular-nums text-red-600">
                  {summary.custos > 0 ? `(${brl(summary.custos)})` : "—"}
                </td>
                <td className="px-4 py-4 text-right font-mono tabular-nums text-red-600">
                  {summary.despesas > 0 ? `(${brl(summary.despesas)})` : "—"}
                </td>
                <td
                  className={`px-6 py-4 text-right font-mono tabular-nums ${
                    summary.resultado >= 0
                      ? "text-emerald-700"
                      : "text-red-600"
                  }`}
                >
                  {brl(summary.resultado)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function FinanceiroPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Wallet size={20} className="text-blue-600" />
            </div>
            Financeiro
          </h1>
          <p className="text-slate-500 mt-1 ml-1">
            Contas a receber, contas a pagar e demonstrativo de resultado
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="receber" className="space-y-6">
        <TabsList className="bg-white shadow-sm rounded-2xl p-1.5 border border-slate-100 h-auto flex gap-1 w-full md:w-auto">
          {[
            { value: "receber", label: "A Receber", icon: ArrowDownLeft },
            { value: "pagar", label: "A Pagar", icon: ArrowUpRight },
            { value: "dre", label: "DRE", icon: BarChart3 },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex-1 md:flex-none flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 transition-all"
            >
              <Icon size={16} className="hidden sm:block" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="receber">
          <TabContasReceber />
        </TabsContent>

        <TabsContent value="pagar">
          <TabContasPagar />
        </TabsContent>

        <TabsContent value="dre">
          <TabDRE />
        </TabsContent>
      </Tabs>
    </div>
  );
}
