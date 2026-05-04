// src/domains/comercial/components/leads/CampanhaBanner.tsx
// Banner do topo da tela /leads — mostra status agregado da campanha em andamento.
// Fonte: redesign UX 2026-05-04L (mockup aprovado).

import { Megaphone, TrendingUp, Clock, Send } from 'lucide-react';
import { useCampanhaStatus } from '../../hooks/useLeadsDisparo';

interface Props {
  segmento?: string;       // default 'seguranca'
  titulo?: string;         // default 'Envelopamento de poste para segurança'
  className?: string;
}

export function CampanhaBanner({
  segmento = 'seguranca',
  titulo = 'Envelopamento de poste para segurança',
  className = '',
}: Props) {
  const { data, isLoading } = useCampanhaStatus(segmento);

  if (isLoading || !data) {
    return (
      <div className={`bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 animate-pulse ${className}`}>
        <div className="h-4 bg-blue-100 rounded w-1/3 mb-2" />
        <div className="h-3 bg-blue-100 rounded w-2/3" />
      </div>
    );
  }

  const pctConcluido = data.totalLeads > 0
    ? Math.round((data.totalDisparados / data.totalLeads) * 100)
    : 0;

  return (
    <div className={`bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 ${className}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="bg-blue-100 text-blue-700 rounded-xl p-2 shrink-0">
            <Megaphone size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-blue-700 uppercase tracking-wide">
              Campanha em andamento
            </div>
            <div className="text-sm font-semibold text-slate-800 mt-0.5 truncate">
              {titulo}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap">
              <span>
                <strong className="text-slate-700">{data.totalLeads}</strong> leads totais
              </span>
              <span>·</span>
              <span>
                <strong className="text-slate-700">{data.totalDisparados}</strong> já disparados
                <span className="text-slate-400 ml-1">({pctConcluido}%)</span>
              </span>
              {data.totalEnfileiradas > 0 && (
                <>
                  <span>·</span>
                  <span>
                    <strong className="text-slate-700">{data.totalEnfileiradas}</strong> na fila
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Stat
            icon={<TrendingUp size={11} />}
            label="Dia da rampa"
            value={data.diaDaRampa != null ? `${data.diaDaRampa}/8` : '—'}
          />
          <Stat
            icon={<Send size={11} />}
            label="Enviadas hoje"
            value={`${data.enviadasHoje}/${data.limiteDiarioAtual}`}
          />
          <Stat
            icon={<Clock size={11} />}
            label="Janelas BRT"
            value="10–12 / 14–17"
          />
        </div>
      </div>

      {/* Barra de progresso geral */}
      {data.totalLeads > 0 && (
        <div className="mt-3 h-1 bg-blue-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${pctConcluido}%` }}
          />
        </div>
      )}
    </div>
  );
}

function Stat({
  icon, label, value,
}: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white/60 border border-blue-100 rounded-xl px-3 py-1.5 text-center min-w-[78px]">
      <div className="text-[10px] text-blue-600 flex items-center justify-center gap-1 uppercase tracking-wide">
        {icon} {label}
      </div>
      <div className="text-xs font-semibold text-slate-800 mt-0.5">{value}</div>
    </div>
  );
}
