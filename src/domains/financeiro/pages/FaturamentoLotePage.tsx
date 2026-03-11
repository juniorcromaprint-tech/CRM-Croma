// ============================================================================
// FATURAMENTO EM LOTE — Croma Print ERP/CRM
// Seleção e faturamento em lote de pedidos concluídos/produzidos
// ============================================================================

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { brl, formatDate } from "@/shared/utils/format";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { FileCheck, Loader2, PackageCheck } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PedidoFaturamento {
  id: string;
  numero: string;
  status: "concluido" | "produzido";
  valor_total: number | null;
  data_prometida: string | null;
  clientes: {
    nome_fantasia: string | null;
    razao_social: string | null;
  } | null;
}

// ─── Hook de dados ────────────────────────────────────────────────────────────

function usePedidosFaturamento() {
  return useQuery<PedidoFaturamento[]>({
    queryKey: ["pedidos-faturamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select(
          "id, numero, status, valor_total, data_prometida, clientes(nome_fantasia, razao_social)"
        )
        .in("status", ["concluido", "produzido"])
        .is("excluido_em", null)
        .order("created_at", { ascending: false });

      if (error) {
        showError("Erro ao carregar pedidos para faturamento");
        throw error;
      }

      return (data ?? []) as PedidoFaturamento[];
    },
    staleTime: 1000 * 60 * 2,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nomeCliente(cliente: PedidoFaturamento["clientes"]): string {
  if (!cliente) return "—";
  return cliente.nome_fantasia || cliente.razao_social || "—";
}

function StatusBadge({ status }: { status: PedidoFaturamento["status"] }) {
  if (status === "concluido") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 font-medium">
        Concluído
      </Badge>
    );
  }
  return (
    <Badge className="bg-teal-100 text-teal-700 border-teal-200 hover:bg-teal-100 font-medium">
      Produzido
    </Badge>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function FaturamentoLotePage() {
  const queryClient = useQueryClient();
  const { data: pedidos = [], isLoading } = usePedidosFaturamento();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ── Selecão ────────────────────────────────────────────────────────────────

  const allSelected = pedidos.length > 0 && selectedIds.size === pedidos.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < pedidos.length;

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(pedidos.map((p) => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  // ── Totais dos selecionados ────────────────────────────────────────────────

  const totalSelecionado = useMemo(() => {
    return pedidos
      .filter((p) => selectedIds.has(p.id))
      .reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0);
  }, [pedidos, selectedIds]);

  // ── Mutation ───────────────────────────────────────────────────────────────

  const faturarMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("pedidos")
        .update({ status: "faturado" })
        .in("id", ids);

      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess(
        `${selectedIds.size} pedido${selectedIds.size > 1 ? "s" : ""} faturado${selectedIds.size > 1 ? "s" : ""} com sucesso`
      );
      setSelectedIds(new Set());
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["pedidos-faturamento"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    },
    onError: () => {
      showError("Erro ao faturar pedidos. Tente novamente.");
      setConfirmOpen(false);
    },
  });

  function handleConfirmar() {
    faturarMutation.mutate(Array.from(selectedIds));
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ─── Cabeçalho ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <FileCheck size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Faturamento em Lote
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Selecione os pedidos concluídos ou produzidos para faturar
            </p>
          </div>
        </div>

        <Button
          onClick={() => setConfirmOpen(true)}
          disabled={selectedIds.size === 0 || faturarMutation.isPending}
          className="rounded-xl gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
        >
          {faturarMutation.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <PackageCheck size={16} />
          )}
          {selectedIds.size === 0
            ? "Faturar Selecionados"
            : `Faturar ${selectedIds.size} Selecionado${selectedIds.size > 1 ? "s" : ""}`}
        </Button>
      </div>

      {/* ─── Card principal ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Barra de contexto quando há seleção */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between px-5 py-3 bg-blue-50 border-b border-blue-100">
            <span className="text-sm font-medium text-blue-700">
              {selectedIds.size} pedido{selectedIds.size > 1 ? "s" : ""}{" "}
              selecionado{selectedIds.size > 1 ? "s" : ""}
            </span>
            <span className="text-sm font-semibold text-blue-800 tabular-nums">
              Total: {brl(totalSelecionado)}
            </span>
          </div>
        )}

        {/* ─── Conteúdo: loading ──────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-slate-400">
            <Loader2 size={22} className="animate-spin" />
            <span className="text-sm">Carregando pedidos...</span>
          </div>
        ) : pedidos.length === 0 ? (
          /* ─── Empty state ──────────────────────────────────────────────── */
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
            <PackageCheck size={40} className="text-slate-300" />
            <p className="text-sm font-medium">
              Nenhum pedido disponível para faturamento
            </p>
            <p className="text-xs text-slate-400">
              Pedidos com status "Concluído" ou "Produzido" aparecerão aqui
            </p>
          </div>
        ) : (
          /* ─── Tabela ───────────────────────────────────────────────────── */
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="w-12 pl-5">
                    <Checkbox
                      checked={allSelected}
                      ref={(el) => {
                        if (el) {
                          (el as HTMLButtonElement & { indeterminate?: boolean }).indeterminate =
                            someSelected;
                        }
                      }}
                      onCheckedChange={(checked) =>
                        toggleAll(checked === true)
                      }
                      aria-label="Selecionar todos"
                      className="border-slate-300"
                    />
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wider">
                    Número
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wider">
                    Cliente
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wider text-right">
                    Valor Total
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wider">
                    Data Prometida
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wider">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {pedidos.map((pedido) => {
                  const isSelected = selectedIds.has(pedido.id);
                  return (
                    <TableRow
                      key={pedido.id}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-blue-50/60 hover:bg-blue-50"
                          : "hover:bg-slate-50"
                      }`}
                      onClick={() => toggleRow(pedido.id, !isSelected)}
                    >
                      <TableCell className="pl-5">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            toggleRow(pedido.id, checked === true)
                          }
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Selecionar pedido ${pedido.numero}`}
                          className="border-slate-300"
                        />
                      </TableCell>

                      <TableCell className="font-semibold text-slate-800">
                        #{pedido.numero}
                      </TableCell>

                      <TableCell className="text-slate-600 max-w-[200px] truncate">
                        {nomeCliente(pedido.clientes)}
                      </TableCell>

                      <TableCell className="text-right font-medium text-slate-800 tabular-nums">
                        {pedido.valor_total != null
                          ? brl(Number(pedido.valor_total))
                          : "—"}
                      </TableCell>

                      <TableCell className="text-slate-500">
                        {pedido.data_prometida
                          ? formatDate(pedido.data_prometida)
                          : "—"}
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={pedido.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ─── AlertDialog de confirmação ──────────────────────────────────── */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-2xl border-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-800">
              Confirmar Faturamento
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              Você está prestes a faturar{" "}
              <strong className="text-slate-700">
                {selectedIds.size} pedido{selectedIds.size > 1 ? "s" : ""}
              </strong>{" "}
              no total de{" "}
              <strong className="text-slate-700">
                {brl(totalSelecionado)}
              </strong>
              . Esta ação marcará os pedidos como faturados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
              disabled={faturarMutation.isPending}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmar}
              disabled={faturarMutation.isPending}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              {faturarMutation.isPending && (
                <Loader2 size={14} className="animate-spin" />
              )}
              Confirmar Faturamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
