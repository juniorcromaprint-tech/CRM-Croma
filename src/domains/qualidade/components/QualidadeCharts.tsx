// src/domains/qualidade/components/QualidadeCharts.tsx

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { QualidadeKPIs } from "../types/qualidade.types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface QualidadeChartsProps {
  kpis: QualidadeKPIs;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIORIDADE_COLORS: Record<string, string> = {
  baixa: "#22c55e",
  media: "#eab308",
  alta: "#f97316",
  critica: "#ef4444",
};

const PRIORIDADE_LABELS: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

const BAR_COLOR = "#3b82f6";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTipoLabel(tipo: string): string {
  const labels: Record<string, string> = {
    retrabalho: "Retrabalho",
    devolucao: "Devolução",
    erro_producao: "Erro Prod.",
    erro_instalacao: "Erro Inst.",
    divergencia_cliente: "Diverg.",
    material_defeituoso: "Mat. Def.",
    outro: "Outro",
  };
  return labels[tipo] ?? tipo;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function QualidadeCharts({ kpis }: QualidadeChartsProps) {
  const tipoData = kpis.por_tipo.map((d) => ({
    ...d,
    label: formatTipoLabel(d.tipo),
  }));

  const prioridadeData = kpis.por_prioridade.map((d) => ({
    ...d,
    label: PRIORIDADE_LABELS[d.prioridade] ?? d.prioridade,
    color: PRIORIDADE_COLORS[d.prioridade] ?? "#94a3b8",
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Bar chart — por tipo */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
          Ocorrências por Tipo
        </h3>
        {tipoData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-slate-400 text-sm">
            Sem dados
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={tipoData}
              margin={{ top: 4, right: 8, left: -16, bottom: 40 }}
            >
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#64748b" }}
                angle={-30}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
              <Tooltip
                formatter={(value: number) => [value, "Ocorrências"]}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="count" fill={BAR_COLOR} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pie chart — por prioridade */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
          Ocorrências por Prioridade
        </h3>
        {prioridadeData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-slate-400 text-sm">
            Sem dados
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={prioridadeData}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="45%"
                outerRadius={90}
                label={({ label, percent }) =>
                  `${label} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {prioridadeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [value, "Ocorrências"]}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Legend
                iconType="circle"
                iconSize={10}
                formatter={(value) => (
                  <span style={{ fontSize: 12, color: "#475569" }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default QualidadeCharts;
