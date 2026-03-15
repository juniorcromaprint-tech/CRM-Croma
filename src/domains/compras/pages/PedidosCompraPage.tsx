// src/domains/compras/pages/PedidosCompraPage.tsx

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  ChevronRight,
  Hash,
  Loader2,
  Plus,
  ShoppingCart,
  XCircle,
} from "lucide-react";
import { brl, formatDate } from "@/shared/utils/format";
import { usePedidosCompra } from "../hooks/usePedidosCompra";
import PedidoCompraForm from "../components/PedidoCompraForm";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type PCStatus = "rascunho" | "aprovado" | "enviado" | "parcial" | "recebido" | "cancelado";

interface PedidoCompra {
  id: string;
  numero?: string;
  fornecedor?: { nome_fantasia?: string | null; razao_social?: string } | null;
  status: PCStatus;
  valor_total: number;
  previsao_entrega?: string | null;
  created_at: string;
  itens?: any[];
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PCStatus, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-slate-50 text-slate-700 border-slate-200" },
  aprovado: { label: "Aprovado", className: "bg-blue-50 text-blue-700 border-blue-200" },
  enviado: { label: "Enviado", className: "bg-amber-50 text-amber-700 border-amber-200" },
  parcial: { label: "Parcialmente Recebido", className: "bg-orange-50 text-orange-700 border-orange-200" },
  recebido: { label: "Recebido", className: "bg-green-50 text-green-700 border-green-200" },
  cancelado: { label: "Cancelado", className: "bg-red-50 text-red-600 border-red-200" },
};

const TABS: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "rascunho", label: "Rascunho" },
  { value: "aprovado", label: "Aprovado" },
  { value: "enviado", label: "Enviado" },
  { value: "parcial", label: "Parcial" },
  { value: "recebido", label: "Recebido" },
];

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-slate-100 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-100 rounded w-40" />
          <div className="h-3 bg-slate-100 rounded w-56" />
        </div>
        <div className="h-5 bg-slate-100 rounded w-24" />
      </div>
    </div>
  );
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function PedidosCompraPage() {
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("todos");

  const { data: pedidos = [], isLoading, isError } = usePedidosCompra();

  const filtered = useMemo(() => {
    if (activeTab === "todos") return pedidos as PedidoCompra[];
    return (pedidos as PedidoCompra[]).filter((p) => p.status === activeTab);
  }, [pedidos, activeTab]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Pedidos de Compra</h1>
          <p className="text-slate-500 mt-1">Gerencie os pedidos de compra de materiais</p>
        </div>
        <Button
          onClick={() => setFormOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 shadow-sm self-start md:self-auto"
        >
          <Plus size={18} className="mr-2" /> Novo Pedido
        </Button>
      </div>

      {/* Tabs de status */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white shadow-sm rounded-2xl p-1.5 border border-slate-100 h-auto flex flex-wrap gap-1 w-full">
          {TABS.map(({ value, label }) => {
            const count = value === "todos"
              ? (pedidos as PedidoCompra[]).length
              : (pedidos as PedidoCompra[]).filter((p) => p.status === value).length;
            return (
              <TabsTrigger
                key={value}
                value={value}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 transition-all"
              >
                {label}
                {count > 0 && (
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-current/10 min-w-[20px] text-center">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {TABS.map(({ value }) => (
          <TabsContent key={value} value={value} className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            ) : isError ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <XCircle className="mx-auto h-12 w-12 text-red-300 mb-3" />
                <h3 className="text-lg font-semibold text-slate-700">Erro ao carregar pedidos</h3>
                <p className="text-slate-500 mt-1 text-sm">Verifique a conexão com o banco de dados.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <ShoppingCart size={40} className="mx-auto text-slate-300 mb-3" />
                <h3 className="font-semibold text-slate-600">Nenhum pedido encontrado</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {(pedidos as PedidoCompra[]).length === 0
                    ? "Crie o primeiro pedido de compra."
                    : "Não há pedidos nesta etapa."}
                </p>
                {(pedidos as PedidoCompra[]).length === 0 && (
                  <Button
                    onClick={() => setFormOpen(true)}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                  >
                    <Plus size={18} className="mr-2" /> Novo pedido
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-500 px-1">
                  Mostrando {filtered.length} pedido{filtered.length !== 1 ? "s" : ""}
                </p>
                <div className="grid gap-3">
                  {filtered.map((pc) => {
                    const statusCfg = STATUS_CONFIG[pc.status] ?? STATUS_CONFIG.rascunho;
                    const fornecedorNome = pc.fornecedor?.nome_fantasia ?? pc.fornecedor?.razao_social ?? "Fornecedor não informado";

                    return (
                      <div
                        key={pc.id}
                        onClick={() => navigate(`/compras/pedidos/${pc.id}`)}
                        className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer group"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 flex-shrink-0">
                              <ShoppingCart size={22} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {pc.numero && (
                                  <span className="font-mono text-xs text-slate-400 font-semibold">
                                    {pc.numero}
                                  </span>
                                )}
                                <Badge
                                  variant="outline"
                                  className={statusCfg.className}
                                >
                                  {statusCfg.label}
                                </Badge>
                              </div>
                              <h3 className="font-bold text-slate-800 text-base mt-1 group-hover:text-blue-700 transition-colors truncate">
                                {fornecedorNome}
                              </h3>
                              <div className="flex flex-wrap items-center gap-3 mt-1">
                                {pc.previsao_entrega && (
                                  <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <Calendar size={12} />
                                    Entrega: {formatDate(pc.previsao_entrega)}
                                  </span>
                                )}
                                {pc.itens && (
                                  <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <Hash size={12} />
                                    {pc.itens.length} ite{pc.itens.length !== 1 ? "ns" : "m"}
                                  </span>
                                )}
                                <span className="text-xs text-slate-400">
                                  Criado em {formatDate(pc.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <p className="font-bold text-slate-800 text-lg">
                              {brl(pc.valor_total ?? 0)}
                            </p>
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
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Form Dialog */}
      <PedidoCompraForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}
