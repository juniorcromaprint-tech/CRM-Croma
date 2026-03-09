import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Clock, AlertCircle, ArrowRight, MapPin, Plus, Store, Users, ClipboardList, TrendingUp, Trophy, Building2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import JobFormSheet from "@/components/JobFormSheet";

export default function Index() {
  const navigate = useNavigate();
  const [isJobSheetOpen, setIsJobSheetOpen] = useState(false);

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

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [pendRes, andRes, concRes, divRes] = await Promise.all([
        supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'Pendente'),
        supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'Em andamento'),
        supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'Concluído'),
        supabase.from('jobs').select('*', { count: 'exact', head: true }).not('issues', 'is', null).neq('issues', ''),
      ]);
      return {
        pendentes: pendRes.count ?? 0,
        emAndamento: andRes.count ?? 0,
        concluidas: concRes.count ?? 0,
        divergencias: divRes.count ?? 0,
      };
    }
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Olá, Equipe! 👋</h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">Bem-vindo ao painel de Instalações e Merchandising.</p>
        </div>
        <Button
          onClick={() => setIsJobSheetOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm h-10 px-4 text-sm font-bold"
        >
          <Plus size={18} className="mr-2" /> Nova OS / Merchandising
        </Button>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          onClick={() => navigate('/jobs?status=Pendente')}
          className="border-none shadow-sm rounded-2xl overflow-hidden bg-gradient-to-br from-amber-50 to-amber-100/50 cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all group"
        >
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-500 text-white shadow-sm shadow-amber-200 group-hover:scale-110 transition-transform">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-700/70 uppercase tracking-wider">Pendentes</p>
              <h3 className="text-2xl font-black text-amber-900">{stats?.pendentes ?? '-'}</h3>
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => navigate('/jobs?status=Em andamento')}
          className="border-none shadow-sm rounded-2xl overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100/50 cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all group"
        >
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-500 text-white shadow-sm shadow-blue-200 group-hover:scale-110 transition-transform">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-700/70 uppercase tracking-wider">Em andamento</p>
              <h3 className="text-2xl font-black text-blue-900">{stats?.emAndamento ?? '-'}</h3>
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => navigate('/jobs?status=Concluído')}
          className="border-none shadow-sm rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-50 to-emerald-100/50 cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all group"
        >
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-500 text-white shadow-sm shadow-emerald-200 group-hover:scale-110 transition-transform">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-700/70 uppercase tracking-wider">Concluídas</p>
              <h3 className="text-2xl font-black text-emerald-900">{stats?.concluidas ?? '-'}</h3>
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => navigate('/jobs?status=Divergência')}
          className="border-none shadow-sm rounded-2xl overflow-hidden bg-gradient-to-br from-rose-50 to-rose-100/50 cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all group"
        >
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-rose-500 text-white shadow-sm shadow-rose-200 group-hover:scale-110 transition-transform">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-rose-700/70 uppercase tracking-wider">Divergências</p>
              <h3 className="text-2xl font-black text-rose-900">{stats?.divergencias ?? '-'}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Agenda Recente */}
        <Card className="border-none shadow-sm rounded-2xl lg:col-span-2 bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
            <CardTitle className="text-lg font-black text-slate-800">Agenda Recente</CardTitle>
            <Button variant="ghost" size="sm" className="text-blue-600 font-bold hover:bg-blue-50 rounded-lg h-8 px-3 text-xs" asChild>
              <Link to="/jobs">Ver todas <ArrowRight size={14} className="ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="p-5">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <div className="w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3"></div>
                <p className="text-sm font-medium">Carregando instalações...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8 bg-rose-50 rounded-xl">
                <p className="text-sm text-rose-600 font-bold">Erro ao carregar os dados.</p>
              </div>
            ) : jobs && jobs.length > 0 ? (
              <div className="space-y-3">
                {jobs.map((job) => {
                  const store = Array.isArray(job.stores) ? job.stores[0] : job.stores;
                  
                  return (
                    <Link 
                      key={job.id} 
                      to={`/jobs/${job.id}`}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:shadow-sm hover:bg-blue-50/30 transition-all group gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-10 rounded-full shrink-0 ${job.status === 'Concluído' ? 'bg-emerald-500' : job.status === 'Divergência' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="font-bold text-slate-800 text-base">{store?.brand || 'Loja não informada'}</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                              {job.os_number}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded">
                              <MapPin size={12} className="text-slate-400" />
                              <span className="truncate max-w-[120px]">{store?.name || 'Sem endereço'}</span>
                            </span>
                            <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                              <ClipboardList size={12} />
                              {job.type}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="sm:text-right shrink-0">
                        <div className={`inline-flex items-center justify-center text-xs font-bold px-3 py-1.5 rounded-lg ${job.status === 'Concluído' ? 'bg-emerald-100 text-emerald-700' : job.status === 'Divergência' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                          {job.status}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                  <ClipboardList size={24} className="text-slate-300" />
                </div>
                <h3 className="text-base font-bold text-slate-700 mb-1">Nenhuma OS encontrada</h3>
                <p className="text-sm text-slate-500 mb-4">Você ainda não tem nenhuma instalação cadastrada.</p>
                <Button
                  onClick={() => setIsJobSheetOpen(true)}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Criar Primeira OS
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ações Rápidas */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-slate-800 px-1">Ações Rápidas</h3>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
            <button
              onClick={() => setIsJobSheetOpen(true)}
              className="flex items-center gap-3 p-4 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200 group text-left"
            >
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus size={20} />
              </div>
              <span className="font-bold text-base">Nova OS</span>
            </button>
            
            <Link to="/stores" className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-slate-100 hover:border-fuchsia-200 hover:shadow-sm transition-all group">
              <div className="w-10 h-10 bg-fuchsia-100 text-fuchsia-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Store size={20} />
              </div>
              <span className="font-bold text-slate-700 text-base">Lojas</span>
            </Link>

            <Link to="/clients" className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-slate-100 hover:border-cyan-200 hover:shadow-sm transition-all group">
              <div className="w-10 h-10 bg-cyan-100 text-cyan-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users size={20} />
              </div>
              <span className="font-bold text-slate-700 text-base">Clientes</span>
            </Link>
          </div>
        </div>
      </div>

      {/* === MÓDULO COMERCIAL === */}
      <div className="pt-4 border-t border-slate-200 mt-2">
        <h2 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
          <TrendingUp size={20} className="text-blue-600" />
          Comercial
        </h2>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {/* Pipeline */}
          <Card className="border-none shadow-sm rounded-2xl bg-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-100 shrink-0">
                <TrendingUp size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide leading-none mb-1">Pipeline</p>
                <p className="text-lg font-black text-slate-800 leading-none">R$ 354.500</p>
              </div>
            </CardContent>
          </Card>

          {/* Ganho/Mês */}
          <Card className="border-none shadow-sm rounded-2xl bg-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-100 shrink-0">
                <Trophy size={18} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide leading-none mb-1">Ganho/Mês</p>
                <p className="text-lg font-black text-slate-800 leading-none">R$ 27.350</p>
              </div>
            </CardContent>
          </Card>

          {/* Orçamentos Abertos */}
          <Card className="border-none shadow-sm rounded-2xl bg-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-100 shrink-0">
                <FileText size={18} className="text-amber-600" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide leading-none mb-1">Orçamentos</p>
                <p className="text-lg font-black text-slate-800 leading-none">4 abertos</p>
              </div>
            </CardContent>
          </Card>

          {/* Clientes */}
          <Card className="border-none shadow-sm rounded-2xl bg-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 shrink-0">
                <Building2 size={18} className="text-slate-600" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide leading-none mb-1">Clientes</p>
                <p className="text-lg font-black text-slate-800 leading-none">7</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Two columns: Recent Orçamentos + Funil */}
        <div className="grid md:grid-cols-2 gap-4">

          {/* Últimos Orçamentos */}
          <Card className="border-none shadow-sm rounded-2xl bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
              <CardTitle className="text-base font-black text-slate-800">Últimos Orçamentos</CardTitle>
              <Link
                to="/orcamentos"
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                Ver todos <ArrowRight size={13} />
              </Link>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-1">
              <div className="space-y-2">
                {[
                  { id: "ORC-2026-002", title: "Campanha Verão 2026", client: "Renner", status: "enviado", value: "R$ 32.800" },
                  { id: "ORC-2026-004", title: "Proj. Visual Shopping", client: "Paquetá", status: "aprovado", value: "R$ 27.350" },
                  { id: "ORC-2026-007", title: "Totem + Painel", client: "Kreatif", status: "enviado", value: "R$ 12.300" },
                  { id: "ORC-2026-003", title: "Adesivação Vitrine", client: "São João", status: "rascunho", value: "R$ 4.200" },
                ].map((orc) => {
                  const badgeMap: Record<string, string> = {
                    rascunho: "bg-slate-100 text-slate-600",
                    enviado: "bg-blue-100 text-blue-700",
                    aprovado: "bg-emerald-100 text-emerald-700",
                    convertido: "bg-purple-100 text-purple-700",
                  };
                  return (
                    <Link
                      key={orc.id}
                      to="/orcamentos"
                      className="flex items-center gap-2 p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all group"
                    >
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${badgeMap[orc.status]}`}>
                        {orc.status.charAt(0).toUpperCase() + orc.status.slice(1)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{orc.title}</p>
                        <p className="text-[11px] text-slate-500 truncate">{orc.id} · {orc.client}</p>
                      </div>
                      <span className="text-sm font-black text-slate-700 shrink-0">{orc.value}</span>
                      <ArrowRight size={13} className="text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Funil de Vendas */}
          <Card className="border-none shadow-sm rounded-2xl bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
              <CardTitle className="text-base font-black text-slate-800">Funil de Vendas</CardTitle>
              <Link
                to="/funil-vendas"
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                Ver funil <ArrowRight size={13} />
              </Link>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-1">
              {(() => {
                const stages = [
                  { label: "Prospecto", count: 1, value: 94000, color: "bg-slate-400", dot: "bg-slate-400" },
                  { label: "Contato Feito", count: 2, value: 40500, color: "bg-blue-400", dot: "bg-blue-400" },
                  { label: "Proposta Enviada", count: 2, value: 110000, color: "bg-blue-500", dot: "bg-blue-500" },
                  { label: "Negociação", count: 2, value: 110000, color: "bg-amber-500", dot: "bg-amber-500" },
                  { label: "Ganho (mês)", count: 1, value: 27350, color: "bg-emerald-500", dot: "bg-emerald-500" },
                ];
                const maxValue = Math.max(...stages.map((s) => s.value));
                return (
                  <div className="space-y-3">
                    {stages.map((stage) => (
                      <div key={stage.label} className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${stage.dot}`} />
                        <span className="text-xs font-semibold text-slate-600 w-32 shrink-0 truncate">{stage.label}</span>
                        <span className="text-[11px] text-slate-400 w-12 shrink-0">{stage.count} op.</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${stage.color}`}
                            style={{ width: `${Math.round((stage.value / maxValue) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-black text-slate-700 w-20 text-right shrink-0">
                          {stage.value >= 1000
                            ? `R$ ${(stage.value / 1000).toFixed(0)}k`
                            : `R$ ${stage.value}`}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

        </div>
      </div>

      <JobFormSheet
        isOpen={isJobSheetOpen}
        onClose={() => setIsJobSheetOpen(false)}
      />
    </div>
  );
}