import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePullRefresh } from "@/hooks/use-pull-refresh";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, MapPin, ClipboardList, Filter, ChevronLeft, ChevronRight, Calendar, AlertTriangle, User, Loader2, Download, Trash2, CalendarCheck } from "lucide-react";
import { JobCardSkeleton } from "@/components/Skeletons";
import EmptyState from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import JobFormSheet from "@/components/JobFormSheet";
import { useInView } from "react-intersection-observer";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from 'xlsx';
import { showSuccess, showError } from "@/utils/toast";

export default function Jobs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "Todos");
  const [myJobsFilter, setMyJobsFilter] = useState(searchParams.get("my_jobs") === "true");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const [isJobSheetOpen, setIsJobSheetOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [todayFilter, setTodayFilter] = useState(searchParams.get("today") === "true");
  const { ref, inView } = useInView();

  // Sincroniza o filtro com a URL
  useEffect(() => {
    const status = searchParams.get("status");
    if (status) {
      setStatusFilter(status);
    } else {
      setStatusFilter("Todos");
    }
    
    const myJobs = searchParams.get("my_jobs");
    if (myJobs === "true") {
      setMyJobsFilter(true);
    } else {
      setMyJobsFilter(false);
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

  const toggleMyJobsFilter = () => {
    const newValue = !myJobsFilter;
    setMyJobsFilter(newValue);
    
    if (newValue) {
      searchParams.set("my_jobs", "true");
    } else {
      searchParams.delete("my_jobs");
    }
    setSearchParams(searchParams);
  };

  const fetchJobs = async ({ pageParam = 0 }) => {
    const limit = 20;
    let query = supabase
      .from('jobs')
      .select('id, os_number, type, status, scheduled_date, created_at, notes, issues, assigned_to, store_id, stores!inner(name, brand), profiles!jobs_assigned_to_fkey(first_name, last_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(pageParam * limit, (pageParam + 1) * limit - 1);

    if (statusFilter !== "Todos") {
      if (statusFilter === "Divergência") {
        query = query.not('issues', 'is', null).neq('issues', '');
      } else {
        query = query.eq('status', statusFilter);
      }
    }

    if (myJobsFilter && profile?.id) {
      query = query.eq('assigned_to', profile.id);
    }

    if (debouncedSearch) {
      query = query.or(`os_number.ilike.%${debouncedSearch}%,type.ilike.%${debouncedSearch}%`);
    }

    if (todayFilter) {
      const today = new Date().toISOString().split('T')[0];
      query = query.eq('scheduled_date', today);
    }

    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00.000Z`);
    }

    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59.999Z`);
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
    isFetchingNextPage,
    refetch
  } = useInfiniteQuery({
    queryKey: ['infinite-jobs', statusFilter, debouncedSearch, myJobsFilter, profile?.id, startDate, endDate, todayFilter],
    queryFn: fetchJobs,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  const { isRefreshing, pullDistance, onTouchStart, onTouchMove, onTouchEnd, threshold } = usePullRefresh(
    async () => { await refetch(); }
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  const allJobs = useMemo(() => {
    return data?.pages.flatMap(page => page.data) || [];
  }, [data]);

  const totalCount = data?.pages[0]?.totalCount || 0;

  // Mutação para excluir OS
  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const extractFileName = (url: string) => url.split('/').pop() || '';

      // 1. Buscar e deletar arquivos do storage
      const [{ data: photos }, { data: videos }] = await Promise.all([
        supabase.from('job_photos').select('photo_url').eq('job_id', jobId),
        supabase.from('job_videos').select('video_url').eq('job_id', jobId),
      ]);

      if (photos && photos.length > 0) {
        await supabase.storage.from('job_photos').remove(photos.map(p => extractFileName(p.photo_url)));
      }
      if (videos && videos.length > 0) {
        await supabase.storage.from('job_videos').remove(videos.map(v => extractFileName(v.video_url)));
      }

      // 2. Deletar a OS (cascade deleta job_photos e job_videos)
      const { error } = await supabase.from('jobs').delete().eq('id', jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['infinite-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['all-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['recent-jobs'] });
      showSuccess("OS excluída com sucesso!");
    },
    onError: () => {
      showError("Erro ao excluir a OS.");
    }
  });

  const handleDeleteClick = (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation(); // Evita que o clique abra os detalhes da OS
    if (window.confirm("Tem certeza que deseja excluir esta OS? Todas as fotos vinculadas também serão apagadas.")) {
      deleteJobMutation.mutate(jobId);
    }
  };

  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: exportData, error } = await supabase
        .from('jobs')
        .select('*, stores!inner(name, brand, code, address, neighborhood, state), profiles!jobs_assigned_to_fkey(first_name, last_name)')
        .eq('status', 'Concluído')
        .gte('created_at', startOfMonth.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!exportData || exportData.length === 0) {
        showError("Nenhuma OS concluída encontrada neste mês para exportar.");
        setIsExporting(false);
        return;
      }

      const excelData = exportData.map(job => {
        const store = Array.isArray(job.stores) ? job.stores[0] : job.stores;
        const profile = job.profiles;
        
        return {
          'OS': job.os_number,
          'Data Conclusão': new Date(job.created_at).toLocaleDateString('pt-BR'),
          'Marca': store?.brand || '',
          'Código Loja': store?.code || '',
          'Nome Loja': store?.name || '',
          'Endereço': store?.address || '',
          'Bairro': store?.neighborhood || '',
          'Estado': store?.state || '',
          'Tipo de Serviço': job.type,
          'Instalador': profile ? `${profile.first_name} ${profile.last_name}` : 'Não atribuído',
          'Observações': job.notes || '',
          'Divergências': job.issues || ''
        };
      });

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "OSs Concluídas");

      const monthName = startOfMonth.toLocaleString('pt-BR', { month: 'long' });
      const year = startOfMonth.getFullYear();
      const fileName = `Faturamento_Cromaprint_${monthName}_${year}.xlsx`;

      XLSX.writeFile(wb, fileName);
      showSuccess("Planilha exportada com sucesso!");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      showError("Erro ao exportar planilha.");
    } finally {
      setIsExporting(false);
    }
  };

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
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <Button
            variant="outline"
            onClick={exportToExcel}
            disabled={isExporting}
            className="border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl h-11 px-5 shadow-sm w-full sm:w-auto"
          >
            {isExporting ? (
              <><Loader2 className="animate-spin mr-2" size={20} /> Exportando...</>
            ) : (
              <><Download size={20} className="mr-2" /> Exportar Faturamento</>
            )}
          </Button>
          <Button
            onClick={() => setIsJobSheetOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 shadow-sm w-full sm:w-auto"
          >
            <Plus size={20} className="mr-2" /> Nova OS
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {/* Linha 1: Busca e Filtros Principais */}
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
          
          <div className="flex gap-2 w-full md:w-auto">
            <Button
              variant={todayFilter ? "default" : "outline"}
              onClick={() => {
                const newVal = !todayFilter;
                setTodayFilter(newVal);
                if (newVal) searchParams.set("today", "true"); else searchParams.delete("today");
                setSearchParams(searchParams);
              }}
              className={`h-12 rounded-xl px-4 shadow-sm flex-1 md:flex-none ${
                todayFilter
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <CalendarCheck size={18} className="mr-2" />
              Hoje
            </Button>
            <Button
              variant={myJobsFilter ? "default" : "outline"}
              onClick={toggleMyJobsFilter}
              className={`h-12 rounded-xl px-4 shadow-sm flex-1 md:flex-none ${
                myJobsFilter
                  ? "bg-blue-600 hover:bg-blue-700 text-white border-transparent"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <User size={18} className="mr-2" />
              Minhas OSs
            </Button>

            <div className="relative w-full md:w-48 shrink-0">
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
        </div>

        {/* Linha 2: Filtro de Datas */}
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-sm text-slate-500 font-medium w-8">De:</span>
            <Input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="h-10 rounded-lg border-slate-200 bg-white"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-sm text-slate-500 font-medium w-8">Até:</span>
            <Input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="h-10 rounded-lg border-slate-200 bg-white"
            />
          </div>
          {(startDate || endDate) && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => { setStartDate(""); setEndDate(""); }} 
              className="text-slate-500 hover:text-slate-700 w-full sm:w-auto"
            >
              Limpar Datas
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <JobCardSkeleton key={i} />)}
        </div>
      ) : allJobs.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma OS encontrada"
          description="Tente ajustar os filtros ou crie uma nova OS"
          action={{ label: "Nova OS", onClick: () => setIsJobSheetOpen(true) }}
        />
      ) : (
        <div
          className="space-y-4"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {(pullDistance > 0 || isRefreshing) && (
            <div
              className="flex justify-center py-2 overflow-hidden transition-all"
              style={{ height: isRefreshing ? 40 : pullDistance }}
            >
              <Loader2
                className={`text-blue-600 ${pullDistance >= threshold || isRefreshing ? "animate-spin" : ""}`}
                size={24}
              />
            </div>
          )}

          <div className="flex items-center justify-between text-sm text-slate-500 px-1">
            <span>Mostrando {allJobs.length} de {totalCount} OSs</span>
          </div>

          <div className="grid gap-4">
            {allJobs.map((job) => {
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
                      
                      <div className="flex items-center justify-end shrink-0 gap-2">
                        {profile?.role === 'admin' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDeleteClick(e, job.id)}
                            className="w-10 h-10 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 z-10"
                            title="Excluir OS"
                          >
                            <Trash2 size={18} />
                          </Button>
                        )}
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

          {/* Infinite Scroll Trigger */}
          <div ref={ref} className="py-4 flex justify-center">
            {isFetchingNextPage ? (
              <div className="flex items-center text-slate-500">
                <Loader2 className="animate-spin mr-2" size={20} />
                <span>Carregando mais...</span>
              </div>
            ) : hasNextPage ? (
              <span className="text-slate-400 text-sm">Role para carregar mais</span>
            ) : allJobs.length > 0 ? (
              <span className="text-slate-400 text-sm">Fim da lista</span>
            ) : null}
          </div>
        </div>
      )}

      <JobFormSheet
        isOpen={isJobSheetOpen}
        onClose={() => setIsJobSheetOpen(false)}
      />
    </div>
  );
}