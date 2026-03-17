// src/domains/estoque/components/MovementTimeline.tsx

import { cn } from "@/lib/utils";
import { formatDate } from "@/shared/utils/format";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Lock,
  Unlock,
  RotateCcw,
  SlidersHorizontal,
  Clock,
} from "lucide-react";
import type { EstoqueMovimentacao } from "../types/estoque.types";

type TipoMovimentacao = EstoqueMovimentacao["tipo"];

const TIPO_CONFIG: Record<
  TipoMovimentacao,
  { icon: React.ElementType; color: string; bgColor: string; label: string }
> = {
  entrada: {
    icon: ArrowDownToLine,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    label: "Entrada",
  },
  saida: {
    icon: ArrowUpFromLine,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    label: "Saída",
  },
  reserva: {
    icon: Lock,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    label: "Reserva",
  },
  liberacao_reserva: {
    icon: Unlock,
    color: "text-teal-600",
    bgColor: "bg-teal-50",
    label: "Liberação",
  },
  devolucao: {
    icon: RotateCcw,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    label: "Devolução",
  },
  ajuste: {
    icon: SlidersHorizontal,
    color: "text-slate-600",
    bgColor: "bg-slate-100",
    label: "Ajuste",
  },
};

function groupByDay(
  movs: EstoqueMovimentacao[]
): [string, EstoqueMovimentacao[]][] {
  const groups: Record<string, EstoqueMovimentacao[]> = {};
  for (const m of movs) {
    const day = m.created_at.slice(0, 10);
    if (!groups[day]) groups[day] = [];
    groups[day].push(m);
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
}

interface MovementTimelineProps {
  movimentacoes: EstoqueMovimentacao[];
  loading?: boolean;
}

export function MovementTimeline({
  movimentacoes,
  loading,
}: MovementTimelineProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex-shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 bg-slate-100 rounded w-24" />
              <div className="h-3 bg-slate-100 rounded w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (movimentacoes.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock size={32} className="mx-auto text-slate-300 mb-2" />
        <p className="text-sm text-slate-400">Nenhuma movimentação registrada</p>
      </div>
    );
  }

  const groups = groupByDay(movimentacoes);

  return (
    <div className="space-y-4">
      {groups.map(([day, movs]) => (
        <div key={day}>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            {formatDate(day)}
          </p>
          <div className="space-y-2">
            {movs.map((mov) => {
              const config = TIPO_CONFIG[mov.tipo] ?? TIPO_CONFIG.ajuste;
              const Icon = config.icon;
              const isNegative =
                mov.tipo === "saida" || mov.tipo === "reserva";
              return (
                <div key={mov.id} className="flex gap-3 items-start">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                      config.bgColor
                    )}
                  >
                    <Icon size={14} className={config.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn("text-xs font-semibold", config.color)}
                      >
                        {config.label}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {mov.created_at.slice(11, 16)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 font-medium">
                      {isNegative ? "-" : "+"}
                      {mov.quantidade} {mov.material?.unidade ?? "un"}
                    </p>
                    {mov.motivo && (
                      <p className="text-xs text-slate-400 truncate">
                        {mov.motivo}
                      </p>
                    )}
                    {mov.referencia_tipo && (
                      <p className="text-xs text-slate-300">
                        Ref: {mov.referencia_tipo}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
