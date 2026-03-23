import { type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  Calendar,
  CircleDashed,
  GripVertical,
  FileText,
} from "lucide-react";
import { formatDate } from "@/shared/utils/format";
import {
  KANBAN_COLUMNS,
  PRIORIDADE_CONFIG,
  type OrdemProducaoRow,
} from "../types/producao.types";
import {
  getClienteName,
  getPedidoNumero,
  getItemDescricao,
  isOverdue,
  getEtapaAtual,
  getProgressPercent,
} from "../utils/producao.helpers";

interface ProducaoKanbanViewProps {
  opsByColumn: Record<string, OrdemProducaoRow[]>;
  searchTerm: string;
  draggedOPId: string | null;
  dragOverColumn: string | null;
  onSelectOP: (op: OrdemProducaoRow) => void;
  onDragStart: (e: DragEvent<HTMLDivElement>, opId: string) => void;
  onDragEnd: () => void;
  onDragEnter: (e: DragEvent<HTMLDivElement>, colKey: string) => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>, colKey: string) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>, colKey: string) => void;
}

export default function ProducaoKanbanView({
  opsByColumn,
  searchTerm,
  draggedOPId,
  dragOverColumn,
  onSelectOP,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
}: ProducaoKanbanViewProps) {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-5 gap-4 min-h-[60vh]">
      {KANBAN_COLUMNS.map((col) => {
        const colOPs = opsByColumn[col.key] ?? [];
        const isDragOver = dragOverColumn === col.key;

        return (
          <div
            key={col.key}
            className={`
              flex flex-col rounded-2xl border transition-all duration-200
              ${col.color}
              ${isDragOver ? `ring-2 ${col.bgActive}` : ""}
            `}
            onDragEnter={(e) => onDragEnter(e, col.key)}
            onDragLeave={(e) => onDragLeave(e, col.key)}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, col.key)}
          >
            {/* Column Header */}
            <div className="p-3 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                <h3 className="font-semibold text-slate-700 text-sm">
                  {col.label}
                </h3>
                <Badge
                  variant="secondary"
                  className="ml-auto text-xs px-1.5 py-0 h-5 bg-white/60"
                >
                  {colOPs.length}
                </Badge>
              </div>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-2 pt-0 space-y-2 min-h-[200px]">
              {colOPs.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl">
                  {searchTerm ? "Sem resultados" : "Vazio"}
                </div>
              ) : (
                colOPs.map((op) => {
                  const prioCfg = PRIORIDADE_CONFIG[op.prioridade] ?? PRIORIDADE_CONFIG[0];
                  const isDragging = draggedOPId === op.id;
                  const overdue = isOverdue(op);
                  const etapaAtual = getEtapaAtual(op.producao_etapas ?? []);
                  const progress = getProgressPercent(op.producao_etapas ?? []);

                  return (
                    <div
                      key={op.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, op.id)}
                      onDragEnd={onDragEnd}
                      onClick={() => onSelectOP(op)}
                      className={cn(
                        "bg-white rounded-2xl p-3 cursor-grab transition-all duration-150 group active:cursor-grabbing select-none",
                        isDragging ? "opacity-50 rotate-2 shadow-lg border border-slate-200" : "shadow-sm",
                        !isDragging && overdue && op.status !== "finalizado" && op.status !== "liberado"
                          ? "border border-red-300 ring-1 ring-red-200"
                          : !isDragging ? "border border-slate-100 hover:shadow-md" : ""
                      )}
                    >
                      {/* Card header */}
                      <div className="flex items-start justify-between gap-1 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs text-slate-400 font-semibold">
                              {op.numero}
                            </span>
                            {op.prioridade > 0 && (
                              <span
                                className={`text-xs font-semibold px-1.5 py-0 rounded border ${prioCfg.color}`}
                              >
                                {prioCfg.label}
                              </span>
                            )}
                            {overdue && (
                              <AlertTriangle
                                size={12}
                                className="text-red-500"
                              />
                            )}
                          </div>
                          <h4 className="font-semibold text-slate-800 text-sm truncate leading-tight mt-0.5" title={getClienteName(op)}>
                            {getClienteName(op)}
                          </h4>
                          <p className="text-xs text-slate-500 truncate mt-0.5" title={`${getPedidoNumero(op)} • ${getItemDescricao(op)}`}>
                            {getPedidoNumero(op)}
                            {" \u2022 "}
                            {getItemDescricao(op)}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/os/op/${op.id}`); }}
                            title="Ordem de Serviço"
                            className="p-1 rounded-lg text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <FileText size={13} />
                          </button>
                          <GripVertical
                            size={14}
                            className="text-slate-300 group-hover:text-slate-400 mt-0.5"
                          />
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 flex items-center gap-1">
                            <CircleDashed size={11} />
                            {etapaAtual}
                          </span>
                          <span className="text-slate-400">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-1" />

                        {op.prazo_interno && (
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <Calendar size={11} />
                            <span>
                              Prazo: {formatDate(op.prazo_interno)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
