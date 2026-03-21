import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, Clock, Package, BarChart3 } from 'lucide-react';
import { brl } from '@/shared/utils/format';

interface AIKPIBarProps {
  kpis: Record<string, number | string>;
}

const KPI_DISPLAY: Record<string, {
  label: string;
  format: (v: number | string) => string;
  color?: string;
  Icon: typeof TrendingUp;
}> = {
  margem_atual: { label: 'Margem Atual', format: (v) => `${v}%`, color: 'text-red-600', Icon: TrendingDown },
  margem_sugerida: { label: 'Margem Sugerida', format: (v) => `${v}%`, color: 'text-emerald-600', Icon: TrendingUp },
  total_atual: { label: 'Total Atual', format: (v) => brl(Number(v)), color: 'text-slate-800', Icon: DollarSign },
  total_sugerido: { label: 'Total Sugerido', format: (v) => brl(Number(v)), color: 'text-emerald-600', Icon: DollarSign },
  economia_possivel: { label: 'Economia', format: (v) => brl(Number(v)), color: 'text-blue-600', Icon: TrendingUp },
  ticket_medio: { label: 'Ticket Medio', format: (v) => brl(Number(v)), color: 'text-slate-800', Icon: BarChart3 },
  total_pedidos: { label: 'Pedidos', format: (v) => String(v), color: 'text-slate-800', Icon: Package },
  risco: { label: 'Risco', format: (v) => String(v), color: 'text-amber-600', Icon: AlertTriangle },
  custo_estimado: { label: 'Custo', format: (v) => brl(Number(v)), color: 'text-slate-800', Icon: DollarSign },
  prazo_producao: { label: 'Prazo', format: (v) => String(v), color: 'text-slate-800', Icon: Clock },
  total_pendencias: { label: 'Pendencias', format: (v) => String(v), color: 'text-amber-600', Icon: AlertTriangle },
  total_alertas: { label: 'Alertas', format: (v) => String(v), color: 'text-red-600', Icon: AlertTriangle },
  alertas_alta: { label: 'Alta', format: (v) => String(v), color: 'text-red-600', Icon: AlertTriangle },
};

export default function AIKPIBar({ kpis }: AIKPIBarProps) {
  const entries = Object.entries(kpis).filter(([key]) => KPI_DISPLAY[key]);
  if (entries.length === 0) return null;

  const displayEntries = entries.slice(0, 4);

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {displayEntries.map(([key, value]) => {
        const config = KPI_DISPLAY[key]!;
        return (
          <div
            key={key}
            className="bg-white rounded-xl px-3.5 py-3 border border-slate-200 shadow-sm"
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <config.Icon size={12} className="text-slate-400" />
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">{config.label}</span>
            </div>
            <div className={`text-base font-bold ${config.color ?? 'text-slate-800'}`}>
              {config.format(value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
