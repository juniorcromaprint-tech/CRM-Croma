// ============================================================================
// PEDIDOS A FATURAR — Croma Print ERP/CRM
// Lista pedidos em status avançado sem NF-e emitida
// ============================================================================

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { brl, formatDate } from "@/shared/utils/format";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

import {
  FileText,
  Loader2,
  Receipt,
  Search,
  AlertCircle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type StatusElegivel =
  | "produzido"
  | "aguardando_instalacao"
  | "em_instalacao"
  | "concluido";

interface PedidoAFaturar {
  id: string;
  numero: string | null;
  status: StatusElegivel;
  valor_total: number | null;
  created_at: string;
  data_prometida: string | null;
  clientes: {
    razao_social: string | null;
    nome_fantasia: string | null;
  } | null;
  fiscal_documentos: { id: string }[] | null;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

const STATUSES_ELEGIVEIS: StatusElegivel[] = [
  "produzido",
  "aguardando_instalacao",
  "em_instalacao",
  "concluido",
];

function usePedidosAFaturar() {
  return useQuery<PedidoAFaturar[]>({
    queryKey: ["pedidos-a-faturar"],
    queryFn: async () => {
      // Busca pedidos em status avancado com join em fiscal_documentos
      const { data, error } = await supabase
        .from("pedidos")
        .select(
          `id, numero, status, valor_total, created_at, data_prometida,
           clientes(razao_social, nome_fantasia),
           fiscal_documentos!fiscal_documentos_pedido_id_fkey(id)`
        )
        .in("status", STATUSES_ELEGIVEIS)
        .is("excluido_em", null)
        .order("created_at", { ascending: false });

      if (error) {
        showError("Erro ao carregar pedidos a faturar");
        throw error;
      }

      // Filtra apenas os que não têm NF-e associada
      const semNfe = (data ?? []).filter(
        (p: PedidoAFaturar) =>
          !p.fiscal_documentos || p.fiscal_documentos.length === 0
      );

      return semNfe as PedidoAFaturar[];
    },
    staleTime: 1000 * 60 * 2,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nomeCliente(c: PedidoAFaturar["clientes"]): string {
  if (!c) return "—";
  return c.nome_fantasia || c.razao_social || "—";
}

const STATUS_LABELS: Record<StatusElegivel, { label: string; cls: string }> = {
  produzido: {
    label: "Produzido",
    cls: "bg-teal-100 text-teal-700 border-teal-200 hover:bg-teal-100",
  },
  aguardando_instalacao: {
    label: "Aguard. Instalação",
    cls: "bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100",
  },
  em_instalacao: {
    label: "Em Instalação",
    cls: "bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-100",
  },
  concluido: {
    label: "Concluído",
    cls: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
  },
};

function StatusBadge({ status }: { status: StatusElegivel }) {
  const cfg = STATUS_LABELS[status];
  return (
    <Badge className={`font-medium ${cfg.cls}`}>{cfg.label}</Badge>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PedidosAFaturarPage() {
  const navigate = useNavigate();
  const { data: pedidos = [], isLoading } = usePedidosAFaturar();

  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroCliente, setFiltroCliente] = useState("");

  // ── Filtros client-side ────────────────────────────────────────────────────

  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter((p) => {
      if (filtroStatus !== "todos" && p.status !== filtroStatus) return false;
      if (filtroCliente.trim()) {
        const busca = filtroCliente.toLowerCase();
        const cliente = nomeCliente(p.clientes).toLowerCase();
        const numero = (p.numero ?? "").toLowerCase();
        if (!cliente.includes(busca) && !numero.includes(busca)) return false;
      }
      return true;
    });
  }, [pedidos, filtroStatus, filtroCliente]);

  const totalValor = useMemo(
    () =>
      pedidosFiltrados.reduce(
        (acc, p) => acc + (Number(p.valor_total) || 0),
        0
      ),
    [pedidosFiltrados]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ─── Cabeçalho ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
            <Receipt size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Pedidos a Faturar
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Pedidos concluídos ou em estágio avançado sem NF-e emitida
            </p>
          </div>
        </div>

        {/* Totalizador */}
        {!isLoading && pedidosFiltrados.length > 0 && (
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <span className="text-2xl font-bold text-slate-800 tabular-nums">
              {brl(totalValor)}
            </span>
            <span className="text-xs text-slate-500">
              {pedidosFiltrados.length} pedido
              {pedidosFiltrados.length !== 1 ? "s" : ""} aguardando NF-e
            </span>
          </div>
        )}
      </div>

      {/* ─── Filtros ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            placeholder="Buscar cliente ou nº pedido..."
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
            className="rounded-xl pl-9 border-slate-200 text-sm"
          />
        </div>

        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="rounded-xl w-[200px] border-slate-200 text-sm">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="produzido">Produzido</SelectItem>
            <SelectItem value="aguardando_instalacao">
              Aguard. Instalação
            </SelectItem>
            <SelectItem value="em_instalacao">Em Instalação</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ─── Card principal ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-slate-400">
            <Loader2 size={22} className="animate-spin" />
            <span className="text-sm">Carregando pedidos...</span>
          </div>
        ) : pedidosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            {pedidos.length === 0 ? (
              <>
                <Receipt size={40} className="text-slate-300" />
                <h3 className="font-semibold text-slate-600">
                  Nenhum pedido pendente de faturamento
                </h3>
                <p className="text-sm text-slate-400 mt-0.5">
                  Pedidos produzidos ou concluídos sem NF-e aparecerão aqui
                </p>
              </>
            ) : (
              <>
                <AlertCircle size={40} className="text-slate-300" />
                <h3 className="font-semibold text-slate-600">
                  Nenhum resultado para os filtros aplicados
                </h3>
                <p className="text-sm text-slate-400 mt-0.5">
                  Tente ajustar os filtros
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="pl-5 font-semibold text-slate-600 text-xs uppercase tracking-wider">
                    Pedido
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wider">
                    Cliente
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wider text-right">
                    Valor
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wider">
                    Data Prometida
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wider">
                    Status
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 text-xs uppercase tracking-wider text-right pr-5">
                    Ação
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {pedidosFiltrados.map((pedido) => (
                  <TableRow
                    key={pedido.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate(`/pedidos/${pedido.id}`)}
                  >
                    <TableCell className="pl-5 font-semibold text-slate-800">
                      #{pedido.numero ?? "—"}
                    </TableCell>

                    <TableCell className="text-slate-600 max-w-[220px] truncate">
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

                    <TableCell className="text-right pr-5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate("/fiscal/fila");
                        }}
                      >
                        <FileText size={14} />
                        Emitir NF-e
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

