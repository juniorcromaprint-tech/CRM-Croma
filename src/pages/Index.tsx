import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, AlertCircle, ArrowRight, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Index() {
  // Dados simulados
  const stats = [
    { title: "Pendentes Hoje", value: "4", icon: Clock, color: "text-amber-500", bg: "bg-amber-100" },
    { title: "Concluídas", value: "12", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-100" },
    { title: "Com Divergência", value: "2", icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-100" },
  ];

  const recentJobs = [
    { id: "OS-1042", client: "Beira Rio", store: "Shopping Morumbi", status: "pending", time: "14:00" },
    { id: "OS-1041", client: "Vizzano", store: "Rua Oscar Freire, 120", status: "completed", time: "10:30" },
    { id: "OS-1040", client: "Moleca", store: "Shopping Tatuapé", status: "completed", time: "09:00" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Olá, Equipe! 👋</h1>
          <p className="text-slate-500 mt-1">Aqui está o resumo das instalações de hoje.</p>
        </div>
        <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm">
          <Link to="/jobs/new">Nova Instalação</Link>
        </Button>
      </div>

      {/* Stats Grid */}
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
                  <h3 className="text-3xl font-bold text-slate-800">{stat.value}</h3>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Jobs */}
      <Card className="border-none shadow-sm rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-bold text-slate-800">Agenda de Hoje</CardTitle>
          <Button variant="ghost" size="sm" className="text-indigo-600" asChild>
            <Link to="/jobs">Ver todas <ArrowRight size={16} className="ml-1" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mt-4">
            {recentJobs.map((job) => (
              <Link 
                key={job.id} 
                to={`/jobs/${job.id}`}
                className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/50 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-12 rounded-full ${job.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-800">{job.client}</h4>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        {job.id}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                      <MapPin size={14} />
                      <span>{job.store}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-slate-800">{job.time}</div>
                  <div className={`text-xs font-medium mt-1 ${job.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {job.status === 'completed' ? 'Concluído' : 'Pendente'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}