import { brl } from '@/shared/utils/format';

interface AIKPIBarProps {
  kpis: Record<string, number | string>;
}

const KPI_DISPLAY: Record<string, { label: string; format: (v: number | string) => string; color?: string }> = {
  margem_atual: { label: 'Margem Atual', format: (v) => `${v}%`, color: 'text-red-400' },
  margem_sugerida: { label: 'Margem Sugerida', format: (v) => `${v}%`, color: 'text-green-400' },
  total_atual: { label: 'Total Atual', format: (v) => brl(Number(v)) },
  total_sugerido: { label: 'Total Sugerido', format: (v) => brl(Number(v)), color: 'text-green-400' },
  economia_possivel: { label: 'Economia', format: (v) => brl(Number(v)), color: 'text-blue-400' },
  ticket_medio: { label: 'Ticket Médio', format: (v) => brl(Number(v)) },
  total_pedidos: { label: 'Pedidos', format: (v) => String(v) },
  risco: { label: 'Risco', format: (v) => String(v) },
  custo_estimado: { label: 'Custo Estimado', format: (v) => brl(Number(v)) },
  prazo_producao: { label: 'Prazo', format: (v) => String(v) },
  total_pendencias: { label: 'Pendências', format: (v) => String(v) },
  total_alertas: { label: 'Alertas', format: (v) => String(v) },
  alertas_alta: { label: 'Alta', format: (v) => String(v), color: 'text-red-400' },
};

export default function AIKPIBar({ kpis }: AIKPIBarProps) {
  const entries = Object.entries(kpis).filter(([key]) => KPI_DISPLAY[key]);
  if (entries.length === 0) return null;

  const displayEntries = entries.slice(0, 4);
  const cols = Math.min(displayEntries.length, 4);

  return (
    <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {displayEntries.map(([key, value]) => {
        const config = KPI_DISPLAY[key]!;
        return (
          <div key={key} className="bg-slate-800/50 rounded-lg px-3 py-2 text-center">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider">{config.label}</div>
            <div className={`text-sm font-bold mt-0.5 ${config.color ?? 'text-white'}`}>
              {config.format(value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
