import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Factory,
  AlertTriangle,
  Clock,
  Calendar,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Play,
  CircleDashed,
  RotateCcw,
  Timer,
  Scissors,
  ClipboardCheck,
  Printer,
  PenTool,
  Truck,
} from "lucide-react";
import { brl, formatDate, formatDateTime } from "@/shared/utils/format";
import { PRODUCAO_STATUS_CONFIG, type ProducaoStatus } from "@/shared/constants/status";
import OPMateriais from "@/domains/producao/components/OPMateriais";
import {
  PRIORIDADE_CONFIG,
  STATUS_BADGE_COLORS,
  STATUS_TRANSITIONS,
  ETAPA_LABELS,
  type OrdemProducaoRow,
} from "../types/producao.types";
import {
  getClienteName,
  getPedidoNumero,
  isOverdue,
  formatMinutes,
} from "../utils/producao.helpers";

const ETAPA_ICONS: Record<string, typeof Factory> = {
  criacao: PenTool,
  impressao: Printer,
  acabamento: Scissors,
  serralheria: Factory,
  conferencia: ClipboardCheck,
  expedicao: Truck,
};

interface OPDetailDialogProps {
  selectedOP: OrdemProducaoRow | null;
  onClose: () => void;
  onUpdateStatus: (params: { id: string; newStatus: ProducaoStatus }) => void;
  onUpdateEtapa: (params: { etapaId: string; newStatus: string; opId?: string }) => void;
  isStatusUpdating: boolean;
  isEtapaUpdating: boolean;
}

export default function OPDetailDialog({
  selectedOP,
  onClose,
  onUpdateStatus,
  onUpdateEtapa,
  isStatusUpdating,
  isEtapaUpdating,
}: OPDetailDialogProps) {
  return (
    <Dialog
      open={!!selectedOP}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {selectedOP && (
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-3">
              <Factory size={22} className="text-amber-600" />
              <span className="font-mono">{selectedOP.numero}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Status + Prioridade badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-sm font-semibold px-3 py-1 rounded-lg border ${STATUS_BADGE_COLORS[selectedOP.status]}`}
              >
                {PRODUCAO_STATUS_CONFIG[selectedOP.status]?.label ?? selectedOP.status}
              </span>
              <span
                className={`text-sm font-semibold px-3 py-1 rounded-lg border ${(PRIORIDADE_CONFIG[selectedOP.prioridade] ?? PRIORIDADE_CONFIG[0]).color}`}
              >
                {(PRIORIDADE_CONFIG[selectedOP.prioridade] ?? PRIORIDADE_CONFIG[0]).label}
              </span>
              {isOverdue(selectedOP) && (
                <span className="text-sm font-semibold px-3 py-1 rounded-lg border bg-red-50 text-red-600 border-red-200 flex items-center gap-1">
                  <AlertTriangle size={14} />
                  Atrasado
                </span>
              )}
            </div>

            {/* Cliente & Pedido */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                    Cliente
                  </p>
                  <p className="text-lg font-bold text-slate-800">
                    {getClienteName(selectedOP)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                    Pedido
                  </p>
                  <p className="text-lg font-bold text-slate-800">
                    {getPedidoNumero(selectedOP)}
                  </p>
                </div>
              </div>
              {selectedOP.pedido_itens?.descricao && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                    Item
                  </p>
                  <p className="text-sm text-slate-700">
                    {selectedOP.pedido_itens.descricao}
                    {selectedOP.pedido_itens.especificacao &&
                      ` \u2022 ${selectedOP.pedido_itens.especificacao}`}
                    {selectedOP.pedido_itens.quantidade &&
                      ` \u2022 Qtd: ${selectedOP.pedido_itens.quantidade}`}
                  </p>
                </div>
              )}
            </div>

            {/* Etapas Timeline (Stepper) */}
            <div className="space-y-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
                Etapas da Produção
              </p>
              <div className="space-y-0">
                {[...(selectedOP.producao_etapas ?? [])]
                  .sort((a, b) => a.ordem - b.ordem)
                  .map((etapa, idx, arr) => {
                    const EIcon = ETAPA_ICONS[etapa.nome] ?? Factory;
                    const isLast = idx === arr.length - 1;
                    const isConcluida = etapa.status === "concluida";
                    const isEmAndamento = etapa.status === "em_andamento";
                    const isPendente = etapa.status === "pendente";

                    return (
                      <div key={etapa.id} className="flex gap-3">
                        {/* Timeline line + dot */}
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isConcluida
                                ? "bg-emerald-100 text-emerald-600"
                                : isEmAndamento
                                  ? "bg-blue-100 text-blue-600 ring-2 ring-blue-300"
                                  : "bg-slate-100 text-slate-400"
                            }`}
                          >
                            {isConcluida ? (
                              <CheckCircle2 size={16} />
                            ) : isEmAndamento ? (
                              <Play size={14} />
                            ) : (
                              <EIcon size={14} />
                            )}
                          </div>
                          {!isLast && (
                            <div
                              className={`w-0.5 flex-1 min-h-[24px] ${
                                isConcluida ? "bg-emerald-200" : "bg-slate-200"
                              }`}
                            />
                          )}
                        </div>

                        {/* Etapa content */}
                        <div className={`flex-1 pb-4 ${isLast ? "pb-0" : ""}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <span
                                className={`font-semibold text-sm ${
                                  isConcluida
                                    ? "text-emerald-700"
                                    : isEmAndamento
                                      ? "text-blue-700"
                                      : "text-slate-600"
                                }`}
                              >
                                {ETAPA_LABELS[etapa.nome] ?? etapa.nome}
                              </span>
                              {etapa.inicio && (
                                <span className="text-xs text-slate-400 ml-2">
                                  Inicio: {formatDateTime(etapa.inicio)}
                                </span>
                              )}
                              {etapa.fim && (
                                <span className="text-xs text-slate-400 ml-2">
                                  Fim: {formatDateTime(etapa.fim)}
                                </span>
                              )}
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-1.5">
                              {isPendente && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                                  disabled={isEtapaUpdating}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdateEtapa({
                                      etapaId: etapa.id,
                                      newStatus: "em_andamento",
                                      opId: selectedOP.id,
                                    });
                                  }}
                                >
                                  <Play size={12} className="mr-1" />
                                  Iniciar
                                </Button>
                              )}
                              {isEmAndamento && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                  disabled={isEtapaUpdating}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdateEtapa({
                                      etapaId: etapa.id,
                                      newStatus: "concluida",
                                      opId: selectedOP.id,
                                    });
                                  }}
                                >
                                  <CheckCircle2 size={12} className="mr-1" />
                                  Concluir
                                </Button>
                              )}
                            </div>
                          </div>

                          {etapa.tempo_real_min != null && etapa.tempo_real_min > 0 && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              Tempo real: {formatMinutes(etapa.tempo_real_min)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}

                {(!selectedOP.producao_etapas || selectedOP.producao_etapas.length === 0) && (
                  <div className="bg-slate-50 rounded-xl p-6 border border-dashed border-slate-200 text-center">
                    <CircleDashed size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-500">
                      Nenhuma etapa cadastrada para esta OP.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Materiais Necessários */}
            {selectedOP.pedido_itens?.modelo_id && (
              <div className="space-y-3">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
                  Materiais Necessários
                </p>
                <OPMateriais
                  modeloId={selectedOP.pedido_itens.modelo_id}
                  quantidade={selectedOP.pedido_itens.quantidade ?? 1}
                />
              </div>
            )}

            {/* Custos estimado vs real */}
            <div className="space-y-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
                Custos Estimado vs Real
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl p-3 border border-slate-100 text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                    MP Estimado
                  </p>
                  <p className="text-sm font-bold text-slate-700">
                    {brl(selectedOP.custo_mp_estimado ?? 0)}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-3 border border-slate-100 text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                    MP Real
                  </p>
                  <p
                    className={`text-sm font-bold ${
                      (selectedOP.custo_mp_real ?? 0) > (selectedOP.custo_mp_estimado ?? 0)
                        ? "text-red-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {brl(selectedOP.custo_mp_real ?? 0)}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-3 border border-slate-100 text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                    MO Estimado
                  </p>
                  <p className="text-sm font-bold text-slate-700">
                    {brl(selectedOP.custo_mo_estimado ?? 0)}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-3 border border-slate-100 text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                    MO Real
                  </p>
                  <p
                    className={`text-sm font-bold ${
                      (selectedOP.custo_mo_real ?? 0) > (selectedOP.custo_mo_estimado ?? 0)
                        ? "text-red-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {brl(selectedOP.custo_mo_real ?? 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Datas & Tempo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                  Criado em
                </p>
                <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                  <Clock size={14} className="text-slate-400" />
                  {formatDate(selectedOP.created_at)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                  Prazo interno
                </p>
                <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                  <Calendar size={14} className="text-slate-400" />
                  {selectedOP.prazo_interno
                    ? formatDate(selectedOP.prazo_interno)
                    : "---"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                  Tempo estimado
                </p>
                <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                  <Timer size={14} className="text-slate-400" />
                  {formatMinutes(selectedOP.tempo_estimado_min)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">
                  Tempo real
                </p>
                <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                  <Timer size={14} className="text-slate-400" />
                  {formatMinutes(
                    selectedOP.tempo_real_min ||
                    (selectedOP.producao_etapas ?? []).reduce((acc, e) => {
                      if (e.inicio && e.fim) {
                        return acc + Math.round((new Date(e.fim).getTime() - new Date(e.inicio).getTime()) / 60000);
                      }
                      return acc;
                    }, 0) || null
                  )}
                </p>
              </div>
            </div>

            {/* Status workflow buttons */}
            {STATUS_TRANSITIONS[selectedOP.status]?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
                  Avancar status
                </p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_TRANSITIONS[selectedOP.status].map((nextStatus) => {
                    const nextCfg = PRODUCAO_STATUS_CONFIG[nextStatus];
                    const isRetrabalho = nextStatus === "retrabalho";
                    return (
                      <Button
                        key={nextStatus}
                        variant={isRetrabalho ? "outline" : "default"}
                        size="sm"
                        disabled={isStatusUpdating}
                        onClick={() =>
                          onUpdateStatus({
                            id: selectedOP.id,
                            newStatus: nextStatus,
                          })
                        }
                        className={
                          isRetrabalho
                            ? "rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                            : "rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                        }
                      >
                        {isStatusUpdating ? (
                          <Loader2 size={14} className="mr-1 animate-spin" />
                        ) : isRetrabalho ? (
                          <RotateCcw size={14} className="mr-1" />
                        ) : (
                          <ArrowRight size={14} className="mr-1" />
                        )}
                        {nextCfg?.label ?? nextStatus}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Observacoes */}
            {selectedOP.observacoes && (
              <div className="space-y-2">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
                  Observacoes
                </p>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">
                    {selectedOP.observacoes}
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-xl"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
