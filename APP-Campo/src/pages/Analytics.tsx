"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart3, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Calendar,
  FileText,
  MapPin,
  Truck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function Analytics() {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['analytics-stats'],
    queryFn: async () => {
      const { data: jobs, error } = await supabase
        .from('jobs')
        .select('status, created_at, finished_at, started_at');
      
      if (error) throw error;

      const total = jobs.length;
      const completed = jobs.filter(j => j.status === 'Concluído').length;
      const pending = jobs.filter(j => j.status === 'Pendente').length;
      
      // Cálculo de deslocamento médio (exemplo simplificado)
      const travelTimes = jobs
        .filter(j => j.started_at && j.finished_at)
        .map(j => {
          const start = new Date(j.started_at!).getTime();
          const end = new Date(j.finished_at!).getTime();
          return (end - start) / (1000 * 60); // minutos
        });
      
      const avgTravel = travelTimes.length > 0 
        ? Math.round(travelTimes.reduce((a, b) => a + b, 0) / travelTimes.length) 
        : 0;

      return { total, completed, pending, avgTravel };
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Relatórios</h1>
          <p className="text-slate-500">Visão geral de produtividade e desempenho.</p>
        </div>
        <Button 
          onClick={() => navigate('/billing-report')}
          className="bg-slate-900 text-white shadow-lg hover:bg-slate-800"
        >
          <FileText size={18} className="mr-2" /> Relatório de Faturamento
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-blue-100 text-xs font-bold uppercase tracking-wider">Total de OS</p>
                <h3 className="text-3xl font-black mt-1">{stats?.total || 0}</h3>
              </div>
              <div className="bg-blue-500/30 p-2 rounded-lg">
                <BarChart3 size={20} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Concluídas</p>
                <h3 className="text-3xl font-black mt-1 text-emerald-600">{stats?.completed || 0}</h3>
              </div>
              <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
                <CheckCircle2 size={20} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Pendentes</p>
                <h3 className="text-3xl font-black mt-1 text-amber-500">{stats?.pending || 0}</h3>
              </div>
              <div className="bg-amber-50 p-2 rounded-lg text-amber-500">
                <Clock size={20} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Tempo Médio</p>
                <h3 className="text-3xl font-black mt-1 text-blue-600">{stats?.avgTravel || 0} min</h3>
              </div>
              <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                <Truck size={20} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm bg-white">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-600" /> Desempenho Mensal
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-slate-400 italic">
          Gráfico de evolução de instalações (Em breve)
        </CardContent>
      </Card>
    </div>
  );
}