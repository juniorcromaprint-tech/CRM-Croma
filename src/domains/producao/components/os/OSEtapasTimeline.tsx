import type { OSEtapa } from '../../types/ordem-servico';
import { ETAPA_STATUS_ICON } from '../../types/ordem-servico';

interface OSEtapasTimelineProps {
  etapas: OSEtapa[];
}

const ETAPA_LABELS: Record<string, string> = {
  criacao: 'Criação/Arte',
  impressao: 'Impressão',
  acabamento: 'Acabamento',
  conferencia: 'Conferência',
  expedicao: 'Expedição',
};

function formatMinutos(min: number | null): string {
  if (!min) return '-';
  if (min < 60) return `${min.toFixed(1)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function OSEtapasTimeline({ etapas }: OSEtapasTimelineProps) {
  if (etapas.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
        Processos de Produção
      </h3>
      <div className="flex items-center justify-between overflow-x-auto pb-2">
        {etapas.map((etapa, idx) => {
          const icon = ETAPA_STATUS_ICON[etapa.status] || '⏳';
          const isLast = idx === etapas.length - 1;
          const isConcluida = etapa.status === 'concluida';
          const emAndamento = etapa.status === 'em_andamento';

          return (
            <div key={etapa.id} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center text-center min-w-[80px]">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg
                  ${isConcluida ? 'bg-green-100' : emAndamento ? 'bg-orange-100' : 'bg-slate-100'}`}>
                  {icon}
                </div>
                <span className="text-xs font-medium text-slate-600 mt-1">
                  {ETAPA_LABELS[etapa.nome] || etapa.nome}
                </span>
                <span className="text-xs text-slate-400">
                  {formatMinutos(etapa.tempo_estimado_min)}
                </span>
              </div>
              {!isLast && (
                <div className={`flex-1 h-0.5 mx-1 ${isConcluida ? 'bg-green-300' : 'bg-slate-200'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
