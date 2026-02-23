import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, AlertCircle, ArrowRight, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Index() {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['recent-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, stores(name, brand)')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    }
  });

  const pendentes = jobs?.filter(j => j.status === 'Pendente').length || 0;
  const concluidas = jobs?.filter(j => j.status === 'Concluído').length || 0;
  const divergencias = jobs?.filter(j => j.issues && j.issues.length > 0).length || 0;

  const stats = [
    { title: "Pendentes Hoje", value: pendentes, icon: Clock, color: "text-amber-500", bg: "bg-amber-100" },
    { title: "Concluídas", value: concluidas, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-100" },
    { title: "Com Divergência", value: divergencias, icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-100" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Olá, Equipe! 👋</h1>
          <p className="text-slate-500 mt-1">Aqui está o resumo das instalações de hoje.</p>
        </div>
        <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm">
          <Link to="/jobs/new">Nova Instalação</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="border-none shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-6 flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${stat.bg}`}>
                  <Icon size={28} className={stat.color} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                  <h3 className="text-3xl font-bold text-slate-800">{isLoading ? '-' : stat.value}</h3>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-none shadow-sm rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-bold text-slate-800">Agenda Recente</CardTitle>
          <Button variant="ghost" size="sm" className="text-blue-600" asChild>
            <Link to="/jobs">Ver todas <ArrowRight size={16} className="ml-1" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-slate-500 py-4">Carregando instalações...</p>
          ) : (
            <div className="space-y-4 mt-4">
              {jobs?.map((job) => (
                <Link 
                  key={job.id} 
                  to={`/jobs/${job.id}`}
                  className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-blue-100 hover:bg-blue-50/50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-12 rounded-full ${job.status === 'Concluído' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-800">{job.stores?.brand}</h4>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {job.os_number}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                        <MapPin size={14} />
                        <span>{job.stores?.name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-bold px-3 py-1 rounded-lg mt-1 ${job.status === 'Concluído' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {job.status}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}