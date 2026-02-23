import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, AlertCircle, ArrowRight, MapPin, Plus, Store, Users, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Index() {
  const { data: jobs, isLoading, error } = useQuery({
    queryKey: ['recent-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, stores(name, brand)')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) {
        console.error("Erro ao buscar jobs:", error);
        return [];
      }
      return data || [];
    }
  });

  // Cálculos seguros (não quebra se jobs for undefined)
  const pendentes = jobs ? jobs.filter(j => j.status === 'Pendente').length : 0;
  const concluidas = jobs ? jobs.filter(j => j.status === 'Concluído').length : 0;
  const divergencias = jobs ? jobs.filter(j => j.status === 'Divergência' || (j.issues && j.issues.length > 0)).length : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Olá, Equipe! 👋</h1>
          <p className="text-slate-500 mt-1 text-lg">Bem-vindo ao painel de Instalações e Merchandising.</p>
        </div>
        <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm h-12 px-6 text-base font-bold">
          <Link to="/jobs/new">
            <Plus size={20} className="mr-2" /> Nova OS / Merchandising
          </Link>
        </Button>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-gradient-to-br from-amber-50 to-amber-100/50">
          <CardContent className="p-6 flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-amber-500 text-white shadow-md shadow-amber-200">
              <Clock size={32} />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-700/70 uppercase tracking-wider">Pendentes</p>
              <h3 className="text-4xl font-black text-amber-900">{isLoading ? '-' : pendentes}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-50 to-emerald-100/50">
          <CardContent className="p-6 flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-emerald-500 text-white shadow-md shadow-emerald-200">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-700/70 uppercase tracking-wider">Concluídas</p>
              <h3 className="text-4xl font-black text-emerald-900">{isLoading ? '-' : concluidas}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-gradient-to-br from-rose-50 to-rose-100/50">
          <CardContent className="p-6 flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-rose-500 text-white shadow-md shadow-rose-200">
              <AlertCircle size={32} />
            </div>
            <div>
              <p className="text-sm font-bold text-rose-700/70 uppercase tracking-wider">Divergências</p>
              <h3 className="text-4xl font-black text-rose-900">{isLoading ? '-' : divergencias}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Lista de Agenda Recente */}
        <Card className="border-none shadow-sm rounded-3xl lg:col-span-2 bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-6 px-6">
            <CardTitle className="text-xl font-black text-slate-800">Agenda Recente</CardTitle>
            <Button variant="ghost" size="sm" className="text-blue-600 font-bold hover:bg-blue-50 rounded-xl" asChild>
              <Link to="/jobs">Ver todas <ArrowRight size={16} className="ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <p className="font-medium">Carregando instalações...</p>
              </div>
            ) : error ? (
              <div className="text-center py-10 bg-rose-50 rounded-2xl">
                <p className="text-rose-600 font-bold">Erro ao carregar os dados.</p>
              </div>
            ) : jobs && jobs.length > 0 ? (
              <div className="space-y-4">
                {jobs.map((job) => {
                  // Garante que não vai quebrar se o Supabase retornar um array ou objeto
                  const store = Array.isArray(job.stores) ? job.stores[0] : job.stores;
                  
                  return (
                    <Link 
                      key={job.id} 
                      to={`/jobs/${job.id}`}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border border-slate-100 hover:border-blue-200 hover:shadow-md hover:bg-blue-50/30 transition-all group gap-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-14 rounded-full shrink-0 ${job.status === 'Concluído' ? 'bg-emerald-500' : job.status === 'Divergência' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-black text-slate-800 text-lg">{store?.brand || 'Loja não informada'}</h4>
                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600">
                              {job.os_number}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                            <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md">
                              <MapPin size={14} className="text-slate-400" />
                              <span className="truncate max-w-[150px]">{store?.name || 'Sem endereço'}</span>
                            </span>
                            <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-medium">
                              <ClipboardList size={14} />
                              {job.type}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="sm:text-right shrink-0">
                        <div className={`inline-flex items-center justify-center text-sm font-bold px-4 py-2 rounded-xl ${job.status === 'Concluído' ? 'bg-emerald-100 text-emerald-700' : job.status === 'Divergência' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                          {job.status}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <ClipboardList size={32} className="text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-700 mb-1">Nenhuma OS encontrada</h3>
                <p className="text-slate-500 mb-6">Você ainda não tem nenhuma instalação ou merchandising cadastrado.</p>
                <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                  <Link to="/jobs/new">Criar Primeira OS</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ações Rápidas */}
        <div className="space-y-6">
          <h3 className="text-xl font-black text-slate-800 px-2">Ações Rápidas</h3>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
            <Link to="/jobs/new" className="flex items-center gap-4 p-5 rounded-3xl bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-md shadow-blue-200 group">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus size={24} />
              </div>
              <span className="font-bold text-lg">Nova OS</span>
            </Link>
            
            <Link to="/stores" className="flex items-center gap-4 p-5 rounded-3xl bg-white border border-slate-100 hover:border-fuchsia-200 hover:shadow-md transition-all group">
              <div className="w-12 h-12 bg-fuchsia-100 text-fuchsia-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Store size={24} />
              </div>
              <span className="font-bold text-slate-700 text-lg">Lojas</span>
            </Link>

            <Link to="/clients" className="flex items-center gap-4 p-5 rounded-3xl bg-white border border-slate-100 hover:border-cyan-200 hover:shadow-md transition-all group">
              <div className="w-12 h-12 bg-cyan-100 text-cyan-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users size={24} />
              </div>
              <span className="font-bold text-slate-700 text-lg">Clientes</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}