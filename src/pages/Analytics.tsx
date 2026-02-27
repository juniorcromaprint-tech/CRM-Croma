"use client";

import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from "recharts";
import { 
  TrendingUp, Clock, AlertTriangle, CheckCircle2, 
  Calendar, Filter, Download, Loader2, BarChart3 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#ca8a04'];

export default function Analytics() {
  const { profile } = useAuth();

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['analytics-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, profiles!jobs_assigned_to_fkey(first_name, last_name)');
      if (error) throw error;
      return data || [];
    }
  });

  const stats = useMemo(() => {
    if (!jobs) return null;

    const completed = jobs.filter(j => j.status === 'Concluído');
    const withIssues = jobs.filter(j => j.issues && j.issues.length > 0);
    
    // Tempo Médio (em minutos)
    const durations = completed
      .filter(j => j.started_at && j.finished_at)
      .map(j => {
        const start = new Date(j.started_at).getTime();
        const end = new Date(j.finished_at).getTime();
        return (end - start) / 60000;
      });
    
    const avgTime = durations.length > 0 
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) 
      : 0;

    // Dados para Gráfico de Pizza (Tipos)
    const typesMap = jobs.reduce((acc: any, job) => {
      acc[job.type] = (acc[job.type] || 0) + 1;
      return acc;
    }, {});
    const pieData = Object.keys(typesMap).map(name => ({ name, value: typesMap[name] }));

    // Dados para Gráfico de Linha (Evolução Diária - últimos 15 dias)
    const last15Days = Array.from({ length: 15 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const lineData = last15Days.map(date => ({
      date: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      total: jobs.filter(j => j.created_at.startsWith(date)).length,
      concluidas: jobs.filter(j => j.status === 'Concluído' && j.finished_at?.startsWith(date)).length
    }));

    // Ranking de Instaladores
    const installerMap = completed.reduce((acc: any, job) => {
      const name = job.profiles ? `${job.profiles.first_name}` : 'N/A';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});
    const barData = Object.keys(installerMap)
      .map(name => ({ name, total: installerMap[name] }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      total: jobs.length,
      completedCount: completed.length,
      issueRate: Math.round((withIssues.length / jobs.length) * 100) || 0,
      avgTime,
      pieData,
      lineData,
      barData
    };
  }, [jobs]);

  if (profile?.role !== 'admin') {
    return <div className="p-10 text-center">Acesso restrito a administradores.</div>;
  }

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
      <p className="text-slate-500">Gerando relatórios...</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Relatórios & Análises</h1>
          <p className="text-slate-500 mt-1">Métricas de desempenho da equipe e volume de serviços.</p>
        </div>
        <Button variant="outline" className="rounded-xl border-slate-200">
          <Download size={18} className="mr-2" /> Exportar Dados
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase">Total de OSs</p>
              <h3 className="text-2xl font-black text-slate-800">{stats?.total}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase">Concluídas</p>
              <h3 className="text-2xl font-black text-slate-800">{stats?.completedCount}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase">Tempo Médio</p>
              <h3 className="text-2xl font-black text-slate-800">{stats?.avgTime} min</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase">Divergências</p>
              <h3 className="text-2xl font-black text-slate-800">{stats?.issueRate}%</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Evolução */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <BarChart3 size={20} className="text-blue-600" /> Evolução Diária
            </CardTitle>
            <CardDescription>Volume de OSs criadas vs concluídas nos últimos 15 dias.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.lineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
                <Line type="monotone" dataKey="total" name="Criadas" stroke="#94a3b8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="concluidas" name="Concluídas" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Tipos de Serviço */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Distribuição por Tipo</CardTitle>
            <CardDescription>Quais serviços são mais solicitados.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats?.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Ranking de Instaladores */}
        <Card className="border-none shadow-sm bg-white lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Top 5 Instaladores</CardTitle>
            <CardDescription>Membros da equipe com maior número de conclusões.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.barData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{fontSize: 12, fontWeight: 'bold'}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="total" name="OSs Concluídas" fill="#2563eb" radius={[0, 8, 8, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}