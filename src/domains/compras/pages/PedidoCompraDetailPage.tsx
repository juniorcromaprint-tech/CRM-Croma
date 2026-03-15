// src/domains/compras/pages/PedidoCompraDetailPage.tsx

import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  Loader2,
  Package,
  ShoppingCart,
  XCircle,
} from "lucide-react";
import { brl, formatDate } from "@/shared/utils/format";
import { usePedidoCompra, useAtualizarStatusPedido } from "../hooks/usePedidosCompra";
import RecebimentoChecklist from "../components/RecebimentoChecklist";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type PCStatus = "rascunho" | "aprovado" | "enviado" | "parcial" | "recebido" | "cancelado";

// ─── Constantes ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PCStatus, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-slate-50 text-slate-700 border-slate-200" },
  aprovado: { label: "Aprovado", className: "bg-blue-50 text-blue-700 border-blue-200" },
  enviado: { label: "Enviado", className: "bg-amber-50 text-amber-700 border-amber-200" },
  parcial: { label: "Parcialmente Recebido", className: "bg-orange-50 text-orange-700 border-orange-200" },
  recebido: { label: "Recebido", className: "bg-green-50 text-green-700 border-green-200" },
  cancelado: { label: "Cancelado", className: "bg-red-50 text-red-600 border-red-200" },
};

interface ActionButton {
  label: string;
  nextStatus: PCStatus;
  variant?: "primary" | "danger";
}

const STATUS_ACTIONS: Partial<Record<PCStatus, ActionButton[]>> = {
  rascunho: [
    { label: "Aprovar Pedido", nextStatus: "aprovado", variant: "primary" },
    { label: "Cancelar Pedido", nextStatus: "cancelado", variant: "danger" },
  ],
  aprovado: [
    { label: "Marcar como Enviado", nextStatus: "enviado", variant: "primary" },
    { label: "Cancelar Pedido", nextStatus: "cancelado", variant: "danger" },
  ],
  enviado: [
    { label: "Marcar Recebido", nextStatus: "recebido", variant: "primary" },
    { label: "Recebimento Parcial", nextStatus: "parcial", variant: "primary" },
    { label: "Cancelar Pedido", nextStatus: "cancelado", variant: "danger" },
  ],
  parcial: [
    { label: "Marcar Recebido", nextStatus: "recebido", variant: "primary" },
  ],
};

// ─── Componente ──────────────────────────────────────────────────────────────

export default function PedidoCompraDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: pedido, isLoading, isError } = usePedidoCompra(id ?? "");
  const atualizarStatus = useAtualizarStatusPedido();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={32} className="animate-spin text-blue-600" />
      </div>
    );
  }

  if (isError || !pedido) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <XCircle className="mx-auto h-12 w-12 text-red-300 mb-3" />
        <h3 className="text-lg font-semibold text-slate-700">Pedido não encontrado</h3>
        <p className="text-slate-500 mt-1 text-sm">
          O pedido pode ter sido removido ou o link está incorreto.
        </p>
        <Button
          onClick={() => navigate("/compras/pedidos")}
          variant="outline"
          className="mt-4 rounded-xl"
        >
          <ArrowLeft size={16} className="mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const status: PCStatus = pedido.status ?? "rascunho";
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.rascunho;
  const fornecedorNome = pedido.fornecedor?.nome_fantasia || pedido.fornecedor?.razao_social || "—";
  const itens = pedido.itens ?? [];
  const actions = STATUS_ACTIONS[status] ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Voltar */}
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="text-slate-600 hover:text-slate-800 rounded-xl -ml-2"
      >
        <ArrowLeft size={18} className="mr-2" /> Voltar
      </Button>

      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 flex-shrink-0">
              <ShoppingCart size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {pedido.numero && (
                  <span className="font-mono text-base font-bold text-slate-700">
                    {pedido.numero}
                  </span>
                )}
                <Badge variant="outline" className={statusCfg.className}>
                  {statusCfg.label}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-1 text-slate-600">
                <Building2 size={15} className="text-slate-400" />
                <span className="font-semibold">{fornecedorNome}</span>
              </div>
              {pedido.previsao_entrega && (
                <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                  <Calendar size={14} className="text-slate-400" />
                  Entrega prevista: {formatDate(pedido.previsao_entrega)}
                </div>
              )}
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Valor Total</p>
            <p className="text-3xl font-bold text-slate-800">{brl(pedido.valor_total ?? 0)}</p>
            <p className="text-xs text-slate-400 mt-1">Criado em {formatDate(pedido.created_at)}</p>
          </div>
        </div>
      </div>

      {/* Itens */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">Itens do Pedido</h2>
        </div>
        {itens.length === 0 ? (
          <div className="p-12 text-center">
            <Package size={40} className="mx-auto text-slate-300 mb-3" />
            <h3 className="font-semibold text-slate-600">Nenhum item cadastrado</h3>
            <p className="text-sm text-slate-400 mt-1">Este pedido não possui itens.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider">
                    Material
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                    Quantidade
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                    Vlr. Unitário
                  </th>
                  <th className="text-right px-6 py-3 font-semibold text-xs uppercase tracking-wider">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itens.map((item: any) => {
                  const materialNome = item.material?.nome ?? "—";
                  const unidade = item.material?.unidade;
                  const subtotal = item.subtotal ?? item.preco_unitario * item.quantidade ?? 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-700 font-medium">
                        {materialNome}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-700">
                        {item.quantidade}
                        {unidade && (
                          <span className="text-xs text-slate-400 ml-1">{unidade}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-700">
                        {brl(item.preco_unitario ?? 0)}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-800">
                        {brl(subtotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={3} className="px-6 py-3 text-right font-bold text-slate-700 text-sm">
                    Total
                  </td>
                  <td className="px-6 py-3 text-right font-bold text-slate-800 text-base">
                    {brl(pedido.valor_total ?? 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Observações */}
      {pedido.observacoes && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="font-bold text-slate-800 mb-3">Observações</h2>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{pedido.observacoes}</p>
        </div>
      )}

      {/* Recebimento (quando enviado ou parcial) */}
      {(status === "enviado" || status === "parcial") && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="font-bold text-slate-800 mb-4">Conferência de Recebimento</h2>
          <RecebimentoChecklist pedido={{ id: pedido.id, itens }} />
        </div>
      )}

      {/* Ações de status */}
      {actions.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="font-bold text-slate-800 mb-4">Ações</h2>
          <div className="flex flex-wrap gap-3">
            {actions.map((action) => (
              <Button
                key={action.nextStatus}
                disabled={atualizarStatus.isPending}
                onClick={() => atualizarStatus.mutate({ id: pedido.id, status: action.nextStatus })}
                variant={action.variant === "danger" ? "outline" : "default"}
                className={
                  action.variant === "danger"
                    ? "rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    : "rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                }
              >
                {atualizarStatus.isPending ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : action.variant !== "danger" ? (
                  <ArrowRight size={16} className="mr-2" />
                ) : (
                  <XCircle size={16} className="mr-2" />
                )}
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
