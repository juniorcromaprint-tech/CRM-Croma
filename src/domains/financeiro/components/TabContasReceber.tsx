// ============================================================================
// TAB: Contas a Receber
// ============================================================================

import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";
import { brl, formatDate } from "@/shared/utils/format";

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
import { Card, CardContent } from "@/components/ui/card";
import QueryErrorState from "@/shared/components/QueryErrorState";

import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Receipt,
  Banknote,
  Loader2,
} from "lucide-react";

import { KpiCard, KpiSkeleton, TableSkeleton } from "./FinanceiroShared";
import {
  type ContaReceber,
  type ContaReceberStatus,
  type ClienteOption,
  STATUS_RECEBER_CONFIG,
  localDateStr,
  isValidDate,
  getClienteName,
} from "../types/financeiro";

export default function TabContasReceber() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [baixaTarget, setBaixaTarget] = useState<ContaReceber | null>(null);
  const [baixaValor, setBaixaValor] = useState("");
  const [baixaData, setBaixaData] = useState(localDateStr());
  const [baixaComprovante, setBaixaComprovante] = useState("");

  // ── Queries ──
  const {
    data: contas = [],
    isLoading,
    isError,
    refetch,
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

  const { data: pedidosOptions = [] } = useQuery({
    queryKey: ["financeiro", "pedidos_options"],
    queryFn: async (): Promise<{ id: string; numero: string }[]> => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("id, numero")
        .not("status", "eq", "cancelado")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as { id: string; numero: string }[];
    },
    staleTime: 2 * 60 * 1000,
  });

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: async (payload: {
      cliente_id: string;
      pedido_id?: string | null;
      valor_original: number;
      data_vencimento: string;
      forma_pagamento?: string;
      observacoes?: string;
    }) => {
      // Gerar número sequencial automático no formato CR-AAAA-NNNN
      const year = new Date().getFullYear();
      const { count } = await supabase
        .from("contas_receber")
        .select("*", { count: "exact", head: true })
        .like("numero_titulo", `CR-${year}-%`);
      const seq = String((count ?? 0) + 1).padStart(4, "0");
      const numero_titulo = `CR-${year}-${seq}`;

      const { data, error } = await supabase
        .from("contas_receber")
        .insert({
          cliente_id: payload.cliente_id,
          pedido_id: payload.pedido_id || null,
          numero_titulo,
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
    onSettled: (_data, err) => {
      if (err) {
        showError((err as Error).message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      showSuccess("Conta a receber criada com sucesso");
      setShowCreateDialog(false);
      setFormCR({ cliente_id: "", pedido_id: "", valor_original: "", data_vencimento: "", forma_pagamento: "", observacoes: "" });
    },
  });

  const baixaMutation = useMutation({
    mutationFn: async ({
      id,
      valor_pago,
      data_pagamento,
      comprovante,
    }: {
      id: string;
      valor_pago: number;
      data_pagamento: string;
      comprovante: string;
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
          data_pagamento: data_pagamento || localDateStr(),
          observacoes: comprovante ? `Comprovante: ${comprovante}` : undefined,
        })
        .eq("id", id);
      if (error) throw new Error(error.message);

      // BUG-03: Se conta ficou totalmente paga, sincronizar status do pedido
      if (novoStatus === "pago") {
        const { data: contaFull } = await supabase
          .from("contas_receber")
          .select("pedido_id")
          .eq("id", id)
          .single();

        if (contaFull?.pedido_id) {
          const { data: pedidoCheck } = await supabase
            .from("pedidos")
            .select("id, status")
            .eq("id", contaFull.pedido_id)
            .single();

          if (pedidoCheck?.status === "concluido") {
            await supabase
              .from("pedidos")
              .update({ status: "faturado" })
              .eq("id", contaFull.pedido_id);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      showSuccess("Pagamento registrado com sucesso");
      setBaixaTarget(null);
      setBaixaValor("");
      setBaixaData(localDateStr());
      setBaixaComprovante("");
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

  const { data: pedidosEmAndamento } = useQuery({
    queryKey: ['financeiro', 'pedidos_em_andamento'],
    queryFn: async () => {
      const { data } = await supabase
        .from('pedidos')
        .select('id, status, valor_total, data_prometida')
        .in('status', ['aprovado', 'em_producao', 'parcialmente_concluido', 'produzido', 'aguardando_instalacao', 'em_instalacao'])
        .is('excluido_em', null)
        .order('data_prometida', { ascending: true });
      return data ?? [];
    },
    staleTime: 1000 * 60 * 3,
  });

  const receitaProjetada = (pedidosEmAndamento ?? []).reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
  const pedidosAtrasados = (pedidosEmAndamento ?? []).filter(p => {
    if (!p.data_prometida) return false;
    return new Date(p.data_prometida) < new Date();
  }).length;

  const stats = useMemo(() => {
    let totalReceber = 0;
    let emDia = 0;
    let vencido = 0;
    let recebido = 0;
    for (const c of contas) {
      const val = Number(c.valor_original) || 0;
      const pago = Number(c.valor_pago) || 0;
      recebido += pago; // soma todos os pagamentos, incluindo parciais
      if (c.status === "vencido") {
        vencido += val - pago;
        totalReceber += val - pago;
      } else if (c.status !== "cancelado" && c.status !== "pago") {
        emDia += val - pago;
        totalReceber += val - pago;
      }
    }
    return { totalReceber, emDia, vencido, recebido };
  }, [contas]);

  // ── Create Dialog State ──
  const [formCR, setFormCR] = useState({
    cliente_id: "",
    pedido_id: "",
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
    if (!isValidDate(formCR.data_vencimento)) {
      showError("Data inválida");
      return;
    }
    createMutation.mutate({
      cliente_id: formCR.cliente_id,
      pedido_id: formCR.pedido_id || null,
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
    baixaMutation.mutate({
      id: baixaTarget.id,
      valor_pago: valor,
      data_pagamento: baixaData || localDateStr(),
      comprovante: baixaComprovante,
    });
  };

  if (isError) {
    return <QueryErrorState onRetry={refetch} />;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
          <KpiCard
            label="Em Produção"
            value={brl(receitaProjetada)}
            icon={Clock}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
            sub={pedidosAtrasados > 0
              ? `⚠ ${pedidosAtrasados} com prazo vencido`
              : `${pedidosEmAndamento?.length ?? 0} pedidos em andamento`}
            subColor={pedidosAtrasados > 0 ? "text-red-500" : "text-amber-600"}
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
                pedido_id: "",
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
                    Ação
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
                              setBaixaData(localDateStr());
                              setBaixaComprovante("");
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
                  {clientes.filter((c) => c.id).map((c) => (
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
              <Label>Pedido (opcional)</Label>
              <Select
                value={formCR.pedido_id || "__none__"}
                onValueChange={(v) =>
                  setFormCR((p) => ({ ...p, pedido_id: v === "__none__" ? "" : v }))
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Vincular a um pedido..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhum —</SelectItem>
                  {pedidosOptions.filter((p) => p.id).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.numero}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select
                value={formCR.forma_pagamento || "__none__"}
                onValueChange={(v) =>
                  setFormCR((p) => ({ ...p, forma_pagamento: v === "__none__" ? "" : v }))
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Selecione —</SelectItem>
                  <SelectItem value="Boleto">Boleto</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="Transferência">Transferência</SelectItem>
                  <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                  <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Observações adicionais..."
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
              {createMutation.isPending ? <><Loader2 size={16} className="animate-spin mr-2" />Criando...</> : "Criar Conta"}
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
            setBaixaData(localDateStr());
            setBaixaComprovante("");
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
              <div className="space-y-2">
                <Label>Data do Pagamento</Label>
                <Input
                  type="date"
                  value={baixaData}
                  onChange={(e) => setBaixaData(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Nº Comprovante / Referência</Label>
                <Input
                  placeholder="Ex: 123456, PIX-abc123..."
                  value={baixaComprovante}
                  onChange={(e) => setBaixaComprovante(e.target.value)}
                  className="rounded-xl"
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
                ? <><Loader2 size={16} className="animate-spin mr-2" />Registrando...</>
                : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
