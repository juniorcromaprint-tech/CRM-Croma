// ============================================================================
// CashFlowChart — Gráfico de Fluxo de Caixa (Entradas x Saídas x Acumulado)
// Croma Print ERP/CRM — Módulo Financeiro
// ============================================================================

import { brl } from '@/shared/utils/format';
import type { FluxoCaixaAcumulado } from '../types/motor-financeiro.types';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

interface CashFlowChartProps {
  data: FluxoCaixaAcumulado[];
  loading?: boolean;
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm min-w-[180px]">
      <p className="font-semibold text-slate-700 mb-2">{formatDateLabel(label)}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex justify-between gap-4 mb-1">
          <span style={{ color: entry.color }} className="font-medium">
            {entry.name}
          </span>
          <span className="tabular-nums text-slate-700 font-semibold">
            {brl(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse">
      <div className="h-5 w-48 bg-slate-100 rounded mb-6" />
      <div className="h-[360px] bg-slate-50 rounded-xl" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
      <TrendingUp size={40} className="mx-auto text-slate-300 mb-3" />
      <h3 className="font-semibold text-slate-600">Sem dados de fluxo de caixa</h3>
      <p className="text-sm text-slate-400 mt-1">
        Cadastre contas a receber e a pagar para visualizar o fluxo projetado
      </p>
    </div>
  );
}

export default function CashFlowChart({ data, loading = false }: CashFlowChartProps) {
  if (loading) return <LoadingSkeleton />;
  if (!data || data.length === 0) return <EmptyState />;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
          barGap={2}
          barCategoryGap="25%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#f1f5f9"
            vertical={false}
          />
          <XAxis
            dataKey="data"
            tickFormatter={formatDateLabel}
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => {
              if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
              if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
              return String(v);
            }}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '12px', color: '#64748b' }}
          />
          <ReferenceLine
            y={0}
            stroke="#ef4444"
            strokeDasharray="4 4"
            strokeOpacity={0.6}
          />
          <Bar
            dataKey="entradas"
            name="Entradas"
            fill="#10b981"
            radius={[3, 3, 0, 0]}
          />
          <Bar
            dataKey="saidas"
            name="Saídas"
            fill="#ef4444"
            radius={[3, 3, 0, 0]}
          />
          <Line
            type="monotone"
            dataKey="saldo_acumulado"
            name="Saldo Acumulado"
            stroke="#3b82f6"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: '#3b82f6' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
