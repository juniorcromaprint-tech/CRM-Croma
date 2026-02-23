import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, Store, MapPin, Phone, Mail, Building2, 
  Briefcase, Calendar, AlertTriangle, FileText, Image as ImageIcon,
  CheckCircle2, Clock, XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StoreDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Busca os dados da loja
  const { data: store, isLoading: isLoadingStore } = useQuery({
    queryKey: ['store', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  // Busca o histórico de serviços (jobs) desta loja, incluindo as fotos
  const { data: jobsHistory, isLoading: isLoadingJobs } = useQuery({
    queryKey: ['store-jobs', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, job_photos(*)')
        .eq('store_id', id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const formatDate = (dateString: string) => {
    if (!dateString) return "Data não informada";
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(dateString));
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'concluído': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'em andamento': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'cancelado': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-amber-100 text-amber-700 border-amber-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'concluído': return <CheckCircle2 size={14} className="mr-1" />;
      case 'em andamento': return <Clock size={14} className="mr-1" />;
      case 'cancelado': return <XCircle size={14} className="mr-1" />;
      default: return <Clock size={14} className="mr-1" />;
    }
  };

  if (isLoadingStore) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500">Carregando informações do cliente...</p>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-slate-800">Cliente não encontrado</h2>
        <Button onClick={() => navigate('/stores')} className="mt-4">Voltar para Lojas</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/stores')}
          className="bg-white shadow-sm border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600"
        >
          <ArrowLeft size={20} />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">{store.name}</h1>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-bold rounded-lg border border-blue-200">
              {store.brand}
            </span>
          </div>
          {store.code && <p className="text-slate-500 mt-1 font-medium">Código do Cliente: {store.code}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Coluna Esquerda: Dados Cadastrais */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                <Building2 size={20} className="text-blue-600" />
                Dados Cadastrais
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              
              {store.corporate_name && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Razão Social</p>
                  <p className="text-slate-800 font-medium">{store.corporate_name}</p>
                </div>
              )}
              
              {store.cnpj && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">CNPJ</p>
                  <p className="text-slate-800 font-medium">{store.cnpj}</p>
                </div>
              )}

              {(store.address || store.neighborhood || store.state) && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <MapPin size={12} /> Endereço
                  </p>
                  <p className="text-slate-800 font-medium">
                    {store.address}
                    {store.neighborhood && `, ${store.neighborhood}`}
                    {store.state && ` - ${store.state}`}
                    {store.zip_code && ` (${store.zip_code})`}
                  </p>
                </div>
              )}

              {(store.phone || store.email) && (
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Contato</p>
                  <div className="space-y-2">
                    {store.phone && (
                      <div className="flex items-center gap-2 text-slate-700">
                        <Phone size={16} className="text-slate-400" />
                        <span className="font-medium">{store.phone}</span>
                      </div>
                    )}
                    {store.email && (
                      <div className="flex items-center gap-2 text-slate-700">
                        <Mail size={16} className="text-slate-400" />
                        <span className="font-medium">{store.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </CardContent>
          </Card>
        </div>

        {/* Coluna Direita: Histórico de Serviços */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Briefcase size={24} className="text-blue-600" />
              Histórico de Instalações
            </h2>
            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm font-bold">
              {jobsHistory?.length || 0} registros
            </span>
          </div>

          {isLoadingJobs ? (
            <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div></div>
          ) : !jobsHistory || jobsHistory.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 bg-slate-50 shadow-none rounded-2xl">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                  <Briefcase size={32} className="text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Nenhum serviço registrado</h3>
                <p className="text-slate-500 mt-1 max-w-sm">
                  Ainda não há histórico de instalações ou manutenções para este cliente.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
              {jobsHistory.map((job) => (
                <div key={job.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  
                  {/* Timeline dot */}
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-blue-100 text-blue-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                    <Calendar size={16} />
                  </div>
                  
                  {/* Card do Serviço */}
                  <Card className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] border-none shadow-sm hover:shadow-md transition-shadow rounded-2xl bg-white overflow-hidden cursor-pointer" onClick={() => navigate(`/jobs/${job.id}`)}>
                    <CardHeader className="p-4 pb-2 border-b border-slate-50 bg-slate-50/30">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">
                          OS: {job.os_number}
                        </span>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border flex items-center ${getStatusColor(job.status)}`}>
                          {getStatusIcon(job.status)}
                          {job.status}
                        </span>
                      </div>
                      <CardTitle className="text-lg text-slate-800">{job.type}</CardTitle>
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                        <Calendar size={14} /> {formatDate(job.scheduled_date || job.created_at)}
                      </p>
                    </CardHeader>
                    
                    <CardContent className="p-4 space-y-4">
                      
                      {/* Dificuldades / Problemas (Destaque para o próximo instalador) */}
                      {job.issues && (
                        <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                          <p className="text-xs font-bold text-red-800 flex items-center gap-1.5 mb-1 uppercase tracking-wider">
                            <AlertTriangle size={14} /> Atenção / Dificuldades Relatadas
                          </p>
                          <p className="text-sm text-red-900">{job.issues}</p>
                        </div>
                      )}

                      {/* Anotações Gerais */}
                      {job.notes && (
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                          <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mb-1 uppercase tracking-wider">
                            <FileText size={14} /> Relatório / Anotações
                          </p>
                          <p className="text-sm text-slate-700 line-clamp-3">{job.notes}</p>
                        </div>
                      )}

                      {/* Galeria de Fotos */}
                      {job.job_photos && job.job_photos.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mb-2 uppercase tracking-wider">
                            <ImageIcon size={14} /> Fotos do Local ({job.job_photos.length})
                          </p>
                          <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
                            {job.job_photos.map((photo: any) => (
                              <div key={photo.id} className="w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-slate-200 snap-start">
                                <img 
                                  src={photo.photo_url} 
                                  alt={photo.photo_type} 
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}