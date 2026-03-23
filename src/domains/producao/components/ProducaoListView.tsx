import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Factory,
  ChevronRight,
  AlertTriangle,
  Calendar,
  Timer,
  Search,
  FileText,
} from "lucide-react";
import { formatDate } from "@/shared/utils/format";
import { PRODUCAO_STATUS_CONFIG } from "@/shared/constants/status";
import {
  PRIORIDADE_CONFIG,
  STATUS_BADGE_COLORS,
  type OrdemProducaoRow,
} from "../types/producao.types";
import {
  getClienteName,
  getPedidoNumero,
  isOverdue,
  getProgressPercent,
  formatMinutes,
} from "../utils/producao.helpers";

interface ProducaoListViewProps {
  filtered: OrdemProducaoRow[];
  totalOrdens: number;
  totalOrdensPages: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onSelectOP: (op: OrdemProducaoRow) => void;
}

export default function ProducaoListView({
  filtered,
  totalOrdens,
  totalOrdensPages,
  page,
  pageSize,
  onPageChange,
  onSelectOP,
}: ProducaoListViewProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 px-1">
        Mostrando {filtered.length} OP{filtered.length !== 1 ? "s" : ""}
      </p>
      <div className="grid gap-3">
        {filtered.map((op) => {
          const statusCfg = PRODUCAO_STATUS_CONFIG[op.status];
          const prioCfg = PRIORIDADE_CONFIG[op.prioridade] ?? PRIORIDADE_CONFIG[0];
          const overdue = isOverdue(op);
          const progress = getProgressPercent(op.producao_etapas ?? []);

          return (
            <div
              key={op.id}
              onClick={() => onSelectOP(op)}
              className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 flex-shrink-0">
                    <Factory size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-slate-400 font-semibold">
                        {op.numero}
                      </span>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${STATUS_BADGE_COLORS[op.status]}`}
                      >
                        {statusCfg?.label ?? op.status}
                      </span>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${prioCfg.color}`}
                      >
                        {prioCfg.label}
                      </span>
                      {overdue && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md border bg-red-50 text-red-600 border-red-200 flex items-center gap-1">
                          <AlertTriangle size={12} />
                          Atrasado
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-slate-800 text-base mt-1 group-hover:text-blue-700 transition-colors truncate" title={getClienteName(op)}>
                      {getClienteName(op)}
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      <span className="text-xs text-slate-500">
                        Pedido: {getPedidoNumero(op)}
                      </span>
                      {op.prazo_interno && (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Calendar size={12} />
                          Prazo: {formatDate(op.prazo_interno)}
                        </span>
                      )}
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Timer size={12} />
                        {formatMinutes(op.tempo_estimado_min)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="w-24">
                    <div className="text-right text-xs text-slate-400 mb-1">
                      {progress}%
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/os/op/${op.id}`); }}
                    title="Ordem de Serviço"
                    className="p-1.5 rounded-lg text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <FileText size={16} />
                  </button>
                  <ChevronRight
                    className="text-slate-300 group-hover:text-blue-600 transition-colors"
                    size={20}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <Search className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <h3 className="text-lg font-semibold text-slate-700">
              Nenhuma OP encontrada
            </h3>
            <p className="text-slate-500 mt-1 text-sm">
              Ajuste os filtros ou a busca.
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalOrdensPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-500">
            Mostrando {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalOrdens)} de {totalOrdens}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm" className="rounded-xl"
              disabled={page === 0}
              onClick={() => onPageChange(page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline" size="sm" className="rounded-xl"
              disabled={page >= totalOrdensPages - 1}
              onClick={() => onPageChange(page + 1)}
            >
              Próximo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
