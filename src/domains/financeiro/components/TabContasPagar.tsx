// ============================================================================
// TAB: Contas a Pagar
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
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  CreditCard,
  Loader2,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";

import { KpiCard, KpiSkeleton, TableSkeleton } from "./FinanceiroShared";
import {
  type ContaPagar,
  type ContaPagarStatus,
  STATUS_PAGAR_CONFIG,
  CATEGORIAS_PAGAR,
  LIMITE_AUTO_APROVACAO,
  localDateStr,
  isValidDate,
  getFornecedorName,
} from "../types/financeiro";

export default function TabContasPagar() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const userRole = profile?.role ?? "comercial";
  const podeAprovar = userRole === "diretor" || userRole === "financeiro";

  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [rejeicaoTarget, setRejeicaoTarget] = useState<ContaPagar | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");

  // ── Queries ──
  const {
    data: contas = [],
    isLoading,
    isError,
    refetch,
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
      const requerAprovacao = payload.valor_original > LIMITE_AUTO_APROVACAO;
      const status: ContaPagarStatus = requerAprovacao ? "pendente_aprovacao" : "a_pagar";
      const { data, error } = await supabase
        .from("contas_pagar")
        .insert({
          categoria: payload.categoria,
          valor_original: payload.valor_original,
          data_vencimento: payload.data_vencimento,
          numero_nf: payload.numero_nf || null,
          observacoes: payload.observacoes || null,
          status,
          requer_aprovacao: requerAprovacao,
          saldo: payload.valor_original,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { data, requerAprovacao };
    },
    onSuccess: ({ requerAprovacao }) => {
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      if (requerAprovacao) {
        showSuccess("Conta criada — aguardando aprovação (valor acima de R$ 500)");
      } else {
        showSuccess("Conta a pagar criada com sucesso");
      }
      setShowCreateDialog(false);
    },
    onError: (err: Error) => showError(err.message),
  });

  const aprovarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("contas_pagar")
        .update({
          status: "a_pagar" as ContaPagarStatus,
          aprovado_por: user?.id ?? null,
          aprovado_em: new Date().toISOString(),
          motivo_rejeicao: null,
        })
        .eq("id", id)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Falha ao aprovar conta — verifique suas permissões.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      showSuccess("Conta aprovada — movida para A Pagar");
    },
    onError: (err: Error) => showError(err.message),
  });

  const rejeitarMutation = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { data, error } = await supabase
        .from("contas_pagar")
        .update({
          status: "rejeitado" as ContaPagarStatus,
          motivo_rejeicao: motivo || "Sem motivo informado",
        })
        .eq("id", id)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Falha ao rejeitar conta — verifique suas permissões.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      showSuccess("Conta rejeitada");
      setRejeicaoTarget(null);
      setMotivoRejeicao("");
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
      } else if (c.status !== "cancelado" && c.status !== "pendente_aprovacao" && c.status !== "rejeitado") {
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
    if (!isValidDate(formCP.data_vencimento)) {
      showError("Data inválida");
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

  if (isError) {
    return <QueryErrorState onRetry={refetch} />;
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard
            label="Total a Pagar"
            value={brl(stats.totalPagar)}
            icon={CreditCard}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
            sub={`${contas.filter((c) => !["pago", "cancelado", "pendente_aprovacao", "rejeitado"].includes(c.status)).length} titulos`}
          />
          <KpiCard
            label="Aguard. Aprovação"
            value={String(contas.filter((c) => c.status === "pendente_aprovacao").length)}
            icon={AlertTriangle}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
            sub={podeAprovar ? "Clique para revisar" : "Sem permissão de aprovar"}
            subColor={contas.filter((c) => c.status === "pendente_aprovacao").length > 0 ? "text-amber-600" : "text-slate-400"}
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
            { key: "pendente_aprovacao", label: "Aguard. Aprovação", badge: contas.filter((c) => c.status === "pendente_aprovacao").length },
            { key: "a_pagar", label: "A pagar" },
            { key: "vencido", label: "Vencido" },
            { key: "parcial", label: "Parcial" },
            { key: "pago", label: "Pago" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`relative text-xs font-semibold px-4 py-2 rounded-xl border transition-all ${
                statusFilter === f.key
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >
              {f.label}
              {'badge' in f && (f as { badge: number }).badge > 0 && (
                <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 text-xs font-bold rounded-full ${
                  statusFilter === f.key ? "bg-white/30 text-white" : "bg-amber-500 text-white"
                }`}>
                  {(f as { badge: number }).badge}
                </span>
              )}
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
                    Ação
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
                        {conta.status === "pendente_aprovacao" ? (
                          podeAprovar ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => aprovarMutation.mutate(conta.id)}
                                disabled={aprovarMutation.isPending}
                                className="h-8 text-xs rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 gap-1"
                              >
                                <ShieldCheck size={13} />
                                Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setRejeicaoTarget(conta); setMotivoRejeicao(""); }}
                                className="h-8 text-xs rounded-xl border-red-200 text-red-600 hover:bg-red-50 gap-1"
                              >
                                <ShieldX size={13} />
                                Rejeitar
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-amber-500 font-medium">Aguardando aprovação</span>
                          )
                        ) : conta.status === "rejeitado" ? (
                          <span className="text-xs text-red-400" title={conta.motivo_rejeicao ?? ""}>Rejeitado</span>
                        ) : conta.status !== "pago" && conta.status !== "cancelado" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => pagarMutation.mutate({ id: conta.id })}
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
              <Label>Observações</Label>
              <Textarea
                placeholder="Observações adicionais..."
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
              {createMutation.isPending ? <><Loader2 size={16} className="animate-spin mr-2" />Criando...</> : "Criar Conta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejeição Dialog */}
      <Dialog
        open={rejeicaoTarget !== null}
        onOpenChange={(open) => {
          if (!open) { setRejeicaoTarget(null); setMotivoRejeicao(""); }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldX size={18} className="text-red-600" />
              Rejeitar Conta a Pagar
            </DialogTitle>
          </DialogHeader>
          {rejeicaoTarget && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 rounded-xl p-4 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Fornecedor / Categoria</span>
                  <span className="font-semibold text-slate-800">{getFornecedorName(rejeicaoTarget)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Valor</span>
                  <span className="font-mono font-bold text-slate-800">{brl(Number(rejeicaoTarget.valor_original))}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Motivo da rejeição *</Label>
                <Textarea
                  placeholder="Descreva o motivo da rejeição..."
                  value={motivoRejeicao}
                  onChange={(e) => setMotivoRejeicao(e.target.value)}
                  className="rounded-xl resize-none"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setRejeicaoTarget(null); setMotivoRejeicao(""); }}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!rejeicaoTarget) return;
                if (!motivoRejeicao.trim()) { showError("Informe o motivo da rejeição"); return; }
                rejeitarMutation.mutate({ id: rejeicaoTarget.id, motivo: motivoRejeicao });
              }}
              disabled={rejeitarMutation.isPending}
              className="bg-red-600 hover:bg-red-700 rounded-xl"
            >
              {rejeitarMutation.isPending ? <><Loader2 size={16} className="animate-spin mr-2" />Rejeitando...</> : "Confirmar Rejeição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
