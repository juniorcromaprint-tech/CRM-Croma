import {
  Clock,
  Factory,
  Eye,
  CheckCircle2,
} from "lucide-react";

interface ProducaoStatsBarProps {
  isLoading: boolean;
  emFila: number;
  emProducao: number;
  emConferencia: number;
  finalizadasMes: number;
}

export default function ProducaoStatsBar({
  isLoading,
  emFila,
  emProducao,
  emConferencia,
  finalizadasMes,
}: ProducaoStatsBarProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <Clock size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">
              {isLoading ? "..." : emFila}
            </p>
            <p className="text-xs text-slate-500">Em Fila</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
            <Factory size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">
              {isLoading ? "..." : emProducao}
            </p>
            <p className="text-xs text-slate-500">Em Produção</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center">
            <Eye size={20} className="text-cyan-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">
              {isLoading ? "..." : emConferencia}
            </p>
            <p className="text-xs text-slate-500">Em Conferência</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
            <CheckCircle2 size={20} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">
              {isLoading ? "..." : finalizadasMes}
            </p>
            <p className="text-xs text-slate-500">Finalizadas este mes</p>
          </div>
        </div>
      </div>
    </div>
  );
}
