import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, MapPin, ClipboardList, Filter, ChevronLeft, ChevronRight, Calendar, AlertTriangle, User, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import JobFormSheet from "@/components/JobFormSheet";
import { useInView } from "react-intersection-observer";

export default function Jobs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "Todos");
  const [isJobSheetOpen, setIsJobSheetOpen] = useState(false);
  const { ref, inView } = useInView();

  // Sincroniza o filtro com a URL (útil quando clica nos cards da Home)
  useEffect(() => {
    const status = searchParams.get("status");
    if (status) {
      setStatusFilter(status);
    } else {
      setStatusFilter("Todos");
    }
  }, [searchParams]);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    setStatusFilter(newStatus);
    
    if (newStatus === "Todos") {
      searchParams.delete("status");
    } else {
      searchParams.set("status", newStatus);
    }
    setSearchParams(searchParams);
  };

  const fetchJobs = async ({ pageParam = 0 }) => {
    const limit = 20;
    let query = supabase
      .from('jobs')
      .select('*, stores!inner(name, brand), profiles!jobs_assigned_to_fkey(first_name, last_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(pageParam * limit, (pageParam + 1) * limit - 1);

    if (statusFilter !== "Todos") {
      if (statusFilter === "Divergência") {
        query = query.not('issues', 'is', null).neq('issues', '');
      } else {
        query = query.eq('status', statusFilter);
      }
    }

    if (searchTerm) {
      // Supabase doesn't support OR across joined tables easily in a single string,
      // so we might need to do a more complex query or filter client-side if we want to search store names.
      // For now, we'll search OS number and type.
      query = query.or(`os_number.ilike.%${searchTerm}%,type.ilike.%${searchTerm}%`);
    }

    const { data, error, count } = await query;
    
    if (error) throw error;
    
    return {
      data: data || [],
      nextPage: data && data.length === limit ? pageParam + 1 : undefined,
      totalCount: count || 0
    };
  };

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ['infinite-jobs', statusFilter, searchTerm],
    queryFn: fetchJobs,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  const allJobs = useMemo(() => {
    return data?.pages.flatMap(page => page.data) || [];
  }, [data]);

  const totalCount = data?.pages[0]?.totalCount || 0;

  const getStatusColor = (status: string, issues: string) => {
    if (status === 'Divergência' || (issues && issues.length > 0)) return 'bg-rose-100 text-rose-700 border-rose-200';
    if (status === 'Concluído') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'Em andamento') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (status === 'Cancelado') return 'bg-slate-100 text-slate-700 border-slate-200';
    return 'bg-amber-100 text-amber-700 border-amber-200';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Ordens de Serviço</h1>
          <p className="text-slate-500 mt-1">Gerencie todas as instalações e manutenções.</p>
        </div>
        <Button 
          onClick={() => setIsJobSheetOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 shadow-sm w-full md:w-auto"
        >
          <Plus size={20} className="mr-2" /> Nova OS
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <Input 
            placeholder="Buscar por OS, tipo, loja ou marca..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-xl border-slate-200 bg-white h-12 shadow-sm w-full"
          />
        </div>
        
        <div className="relative w-full md:w-64 shrink-0">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Filter size={18} />
          </div>
          <select
            value={statusFilter}
            onChange={handleStatusChange}
            className="w-full h-12 pl-10 pr-10 rounded-xl border border-slate-200 bg-white shadow-sm text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent appearance-none outline-none text-slate-700 font-medium"
          >
            <option value="Todos">Todos os Status</option>
            <option value="Pendente">Pendentes</option>
            <option value="Em andamento">Em andamento</option>
            <option value="Concluído">Concluídas</option>
            <option value="Divergência">Com Divergência</option>
            <option value="Cancelado">Canceladas</option>
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p>Carregando OSs...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <ClipboardList className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-lg font-medium text-slate-900">Nenhuma OS encontrada</h3>
          <p className="text-slate-500 mt-1">Tente ajustar sua busca ou filtro.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-slate-500 px-1">
            <span>Mostrando {paginatedJobs.length} de {filteredJobs.length} OSs</span>
          </div>

          <div className="grid gap-4">
            {paginatedJobs.map((job) => {
              const store = Array.isArray(job.stores) ? job.stores[0] : job.stores;
              const hasIssues = job.issues && job.issues.length > 0;
              const displayStatus = hasIssues && job.status !== 'Concluído' ? 'Divergência' : job.status;

              return (
                <Card 
                  key={job.id} 
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  className="border-none shadow-sm rounded-2xl hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer group bg-white overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row">
                    <div className={`w-full sm:w-2 h-2 sm:h-auto shrink-0 ${
                      displayStatus === 'Concluído' ? 'bg-emerald-500' : 
                      displayStatus === 'Divergência' ? 'bg-rose-500' : 
                      displayStatus === 'Em andamento' ? 'bg-blue-500' : 
                      displayStatus === 'Cancelado' ? 'bg-slate-400' : 
                      'bg-amber-500'
                    }`} />
                    <CardContent className="p-5 flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                            OS: {job.os_number}
                          </span>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${getStatusColor(job.status, job.issues)}`}>
                            {displayStatus}
                          </span>
                        </div>
                        
                        <h3 className="font-bold text-slate-800 text-lg leading-tight group-hover:text-blue-700 transition-colors mt-2">
                          {store?.brand || 'Loja não informada'} - {job.type}
                        </h3>
                        
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <MapPin size={14} />
                            <span className="truncate max-w-[200px] md:max-w-md">
                              {store?.name || 'Sem endereço'}
                            </span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={14} />
                            {new Date(job.scheduled_date || job.created_at).toLocaleDateString('pt-BR')}
                          </span>
                          {job.profiles && (
                            <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                              <User size={14} />
                              {job.profiles.first_name} {job.profiles.last_name}
                            </span>
                          )}
                        </div>

                        {hasIssues && (
                          <div className="mt-3 flex items-start gap-1.5 text-xs text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-100">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                            <span className="line-clamp-1 font-medium">{job.issues}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-end shrink-0">
                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                          <ChevronRight size={20} />
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 pb-4">
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentPage(p => Math.max(1, p - 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={currentPage === 1}
                className="rounded-xl border-slate-200 text-slate-600"
              >
                <ChevronLeft size={16} className="mr-1" /> Anterior
              </Button>
              
              <span className="text-sm font-medium text-slate-500">
                Página {currentPage} de {totalPages}
              </span>
              
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentPage(p => Math.min(totalPages, p + 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={currentPage === totalPages}
                className="rounded-xl border-slate-200 text-slate-600"
              >
                Próxima <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}

      <JobFormSheet 
        isOpen={isJobSheetOpen} 
        onClose={() => setIsJobSheetOpen(false)} 
      />
    </div>
  );
}