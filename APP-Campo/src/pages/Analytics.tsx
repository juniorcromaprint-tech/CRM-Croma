import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function getMonthKey(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function getMonthLabel(dateStr: string) {
  const d = new Date(dateStr);
  return MONTH_LABELS[d.getMonth()];
}

function getLast6MonthKeys() {
  const keys: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: MONTH_LABELS[d.getMonth()],
    });
  }
  return keys;
}

export default function Analytics() {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ["analytics-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select(
          "id, status, created_at, started_at, finished_at, scheduled_date, assigned_to, issues, profiles!jobs_assigned_to_fkey(first_name, last_name)"
        );
      if (error) throw error;
      return data as Array<{
        id: string;
        status: string;
        created_at: string;
        started_at: string | null;
        finished_at: string | null;
        scheduled_date: string | null;
        assigned_to: string | null;
        issues: string | null;
        profiles: { first_name: string | null; last_name: string | null } | null;
      }>;
    },
  });

  // KPI calculations
  const kpis = useMemo(() => {
    if (!jobs) return { total: 0, completed: 0, avgHours: 0, divergenciaRate: 0 };

    const total = jobs.length;
    const completed = jobs.filter((j) => j.status === "Concluído");

    const completedWithTimes = completed.filter((j) => j.started_at && j.finished_at);
    const totalHours = completedWithTimes.reduce((sum, j) => {
      const start = new Date(j.started_at!).getTime();
      const end = new Date(j.finished_at!).getTime();
      return sum + (end - start) / (1000 * 60 * 60);
    }, 0);
    const avgHours = completedWithTimes.length > 0 ? totalHours / completedWithTimes.length : 0;

    const withIssues = jobs.filter((j) => j.issues && j.issues.trim() !== "").length;
    const divergenciaRate = total > 0 ? (withIssues / total) * 100 : 0;

    return {
      total,
      completed: completed.length,
      avgHours: Math.round(avgHours * 10) / 10,
      divergenciaRate: Math.round(divergenciaRate * 10) / 10,
    };
  }, [jobs]);

  // Chart 1: OS por Mês (last 6 months)
  const osPorMes = useMemo(() => {
    const months = getLast6MonthKeys();
    const map: Record<string, { Concluídas: number; Outras: number }> = {};
    months.forEach(({ key }) => { map[key] = { Concluídas: 0, Outras: 0 }; });

    jobs?.forEach((j) => {
      if (!j.created_at) return;
      const key = getMonthKey(j.created_at);
      if (!map[key]) return;
      if (j.status === "Concluído") {
        map[key].Concluídas++;
      } else {
        map[key].Outras++;
      }
    });

    return months.map(({ key, label }) => ({
      mes: label,
      Concluídas: map[key].Concluídas,
      Outras: map[key].Outras,
    }));
  }, [jobs]);

  // Chart 2: OS por Instalador (top 10)
  const osPorInstalador = useMemo(() => {
    const map: Record<string, number> = {};
    jobs?.forEach((j) => {
      const name = j.profiles
        ? `${j.profiles.first_name ?? ""} ${j.profiles.last_name ?? ""}`.trim()
        : "Sem atribuição";
      if (!name) return;
      map[name] = (map[name] ?? 0) + 1;
    });

    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([nome, total]) => ({ nome, total }));
  }, [jobs]);

  // Chart 3: Conclusão no Prazo (last 6 months)
  const conclusaoNoPrazo = useMemo(() => {
    const months = getLast6MonthKeys();
    const map: Record<string, { total: number; noPrazo: number }> = {};
    months.forEach(({ key }) => { map[key] = { total: 0, noPrazo: 0 }; });

    jobs?.forEach((j) => {
      if (j.status !== "Concluído" || !j.finished_at || !j.created_at) return;
      const key = getMonthKey(j.created_at);
      if (!map[key]) return;
      map[key].total++;
      if (j.scheduled_date) {
        const finished = new Date(j.finished_at).setHours(0, 0, 0, 0);
        const scheduled = new Date(j.scheduled_date).setHours(0, 0, 0, 0);
        if (finished <= scheduled) map[key].noPrazo++;
      }
    });

    return months.map(({ key, label }) => {
      const { total, noPrazo } = map[key];
      return {
        mes: label,
        "% no Prazo": total > 0 ? Math.round((noPrazo / total) * 100) : 0,
      };
    });
  }, [jobs]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Relatórios</h1>
          <p className="text-slate-500">Visão geral de produtividade e desempenho.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-80 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Relatórios</h1>
        <p className="text-slate-500">Visão geral de produtividade e desempenho.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total de OS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total de OS</p>
            <p className="text-3xl font-black text-blue-600 mt-1">{kpis.total}</p>
          </div>
          <div className="bg-blue-50 p-2 rounded-xl text-blue-600">
            <FileText size={20} />
          </div>
        </div>

        {/* Concluídas */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Concluídas</p>
            <p className="text-3xl font-black text-green-600 mt-1">{kpis.completed}</p>
          </div>
          <div className="bg-green-50 p-2 rounded-xl text-green-600">
            <CheckCircle2 size={20} />
          </div>
        </div>

        {/* Tempo Médio */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Tempo Médio</p>
            <p className="text-3xl font-black text-purple-600 mt-1">{kpis.avgHours}h</p>
          </div>
          <div className="bg-purple-50 p-2 rounded-xl text-purple-600">
            <Clock size={20} />
          </div>
        </div>

        {/* Taxa Divergências */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Taxa Divergências</p>
            <p className="text-3xl font-black text-amber-500 mt-1">{kpis.divergenciaRate}%</p>
          </div>
          <div className="bg-amber-50 p-2 rounded-xl text-amber-500">
            <AlertTriangle size={20} />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Chart 1: OS por Mês */}
        <Card className="rounded-2xl border border-slate-200 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-700">OS por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={osPorMes} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Concluídas" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Outras" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chart 2: OS por Instalador */}
        <Card className="rounded-2xl border border-slate-200 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-700">OS por Instalador</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={osPorInstalador}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: "#64748b" }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="nome"
                  width={110}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                />
                <Tooltip />
                <Bar dataKey="total" name="OS" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chart 3: Conclusão no Prazo */}
        <Card className="rounded-2xl border border-slate-200 shadow-none md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-700">Conclusão no Prazo (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={conclusaoNoPrazo} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} unit="%" />
                <Tooltip formatter={(value: number) => [`${value}%`, "% no Prazo"]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="% no Prazo"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#16a34a" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
