import React, { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Upload, FileText, AlertTriangle, CheckCircle2, Printer, MapPin, Calendar, Navigation, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { showSuccess, showError } from "@/utils/toast";
import { CromaLogo, CromaLogoFallback } from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isLocating, setIsLocating] = useState(false);
  const [uploadingType, setUploadingType] = useState<'before' | 'after' | null>(null);
  
  const fileInputBeforeRef = useRef<HTMLInputElement>(null);
  const fileInputAfterRef = useRef<HTMLInputElement>(null);

  // Buscar dados da OS
  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, stores(*)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  // Buscar fotos da OS
  const { data: photos } = useQuery({
    queryKey: ['job-photos', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_photos')
        .select('*')
        .eq('job_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  // Atualizar OS (Status, Notas, GPS)
  const updateJobMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase.from('jobs').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', id] });
      queryClient.invalidateQueries({ queryKey: ['all-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['recent-jobs'] });
      if (job?.store_id) {
        queryClient.invalidateQueries({ queryKey: ['store-jobs', job.store_id] });
      }
    }
  });

  // Excluir OS Inteira
  const deleteJobMutation = useMutation({
    mutationFn: async () => {
      // 1. Deletar fotos do storage primeiro para não deixar lixo
      if (photos && photos.length > 0) {
        const fileNames = photos.map(p => {
          const urlParts = p.photo_url.split('/');
          return urlParts[urlParts.length - 1];
        });
        await supabase.storage.from('job_photos').remove(fileNames);
      }
      
      // 2. Deletar a OS (as fotos no banco de dados serão deletadas em cascata se configurado, ou deletamos manualmente)
      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['recent-jobs'] });
      if (job?.store_id) {
        queryClient.invalidateQueries({ queryKey: ['store-jobs', job.store_id] });
      }
      showSuccess("OS excluída com sucesso!");
      navigate(-1); // Volta para a tela anterior
    },
    onError: () => {
      showError("Erro ao excluir a OS.");
    }
  });

  // Excluir Foto Individual
  const deletePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const photo = photos?.find(p => p.id === photoId);
      if (photo) {
        const urlParts = photo.photo_url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        await supabase.storage.from('job_photos').remove([fileName]);
      }
      const { error } = await supabase.from('job_photos').delete().eq('id', photoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-photos', id] });
      showSuccess("Foto removida com sucesso!");
    }
  });

  const captureLocation = () => {
    setIsLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          updateJobMutation.mutate({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }, {
            onSuccess: () => {
              setIsLocating(false);
              showSuccess("Localização salva no banco de dados!");
            }
          });
        },
        (error) => {
          setIsLocating(false);
          showError("Não foi possível capturar a localização.");
        }
      );
    } else {
      setIsLocating(false);
      showError("Geolocalização não suportada.");
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const files = event.target.files;
    if (!files || files.length === 0 || !id) return;

    setUploadingType(type);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${id}-${type}-${Math.random()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('job_photos')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('job_photos')
          .getPublicUrl(fileName);

        const { error: dbError } = await supabase
          .from('job_photos')
          .insert({ job_id: id, photo_type: type, photo_url: publicUrl });

        if (dbError) throw dbError;
      }

      showSuccess(`${files.length > 1 ? 'Fotos salvas' : 'Foto salva'} com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['job-photos', id] });
    } catch (error) {
      showError("Erro ao fazer upload da foto.");
      console.error(error);
    } finally {
      setUploadingType(null);
      if (type === 'before' && fileInputBeforeRef.current) fileInputBeforeRef.current.value = '';
      if (type === 'after' && fileInputAfterRef.current) fileInputAfterRef.current.value = '';
    }
  };

  const handleComplete = () => {
    updateJobMutation.mutate({ status: 'Concluído' }, {
      onSuccess: () => showSuccess("Instalação finalizada com sucesso!")
    });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    updateJobMutation.mutate({ status: newStatus }, {
      onSuccess: () => showSuccess(`Status alterado para ${newStatus}`)
    });
  };

  const handleDeleteJob = () => {
    if (window.confirm("Tem certeza que deseja excluir esta OS? Esta ação não pode ser desfeita e apagará todas as fotos vinculadas.")) {
      deleteJobMutation.mutate();
    }
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>, field: 'notes' | 'issues') => {
    updateJobMutation.mutate({ [field]: e.target.value });
  };

  if (isLoading) return <div className="p-10 text-center text-slate-500">Carregando OS...</div>;
  if (!job) return <div className="p-10 text-center text-slate-500">OS não encontrada.</div>;

  const beforePhotos = photos?.filter(p => p.photo_type === 'before') || [];
  const afterPhotos = photos?.filter(p => p.photo_type === 'after') || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10 print:space-y-8 print:pb-0 print:bg-white">
      {/* Header - Hidden on Print */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-slate-600 bg-white border border-slate-200 shadow-sm hover:bg-slate-50">
          <ArrowLeft size={20} />
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={handleDeleteJob} 
            disabled={deleteJobMutation.isPending}
            className="rounded-xl border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50 bg-white shadow-sm"
          >
            {deleteJobMutation.isPending ? <Loader2 className="animate-spin mr-2" size={18} /> : <Trash2 size={18} className="mr-2" />}
            Excluir
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="rounded-xl border-slate-200 text-blue-600 hover:text-blue-700 hover:bg-blue-50 bg-white shadow-sm">
            <Printer size={18} className="mr-2" /> Gerar PDF
          </Button>
          {job.status !== "Concluído" && (
            <Button onClick={handleComplete} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
              <CheckCircle2 size={18} className="mr-2" /> Finalizar OS
            </Button>
          )}
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:flex items-center justify-between border-b-2 border-slate-800 pb-6 mb-8">
        <div>
          <CromaLogo className="scale-125 origin-left mb-2" />
          <p className="text-sm text-slate-500">Comunicação Visual & Impressão Digital</p>
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Relatório de Instalação</h1>
          <p className="text-slate-500 font-medium mt-1">Documento Oficial de Conclusão</p>
        </div>
      </div>

      {/* Job Info Card */}
      <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white print:shadow-none print:border print:border-slate-200 print:rounded-lg">
        <div className="h-2 w-full bg-blue-600 print:hidden" />
        <CardContent className="p-6 print:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
            <div>
              <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg inline-block mb-3 print:bg-transparent print:p-0 print:text-slate-500 print:text-base">
                OS: {job.os_number}
              </span>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">{job.stores?.brand}</h2>
              <p className="text-slate-500 font-medium text-lg mt-1">{job.type}</p>
            </div>
            
            {/* Dropdown de Status */}
            <div className="relative print:hidden">
              <select
                value={job.status}
                onChange={handleStatusChange}
                className={`appearance-none pl-4 pr-10 py-2 rounded-xl text-sm font-bold outline-none cursor-pointer transition-colors shadow-sm border ${
                  job.status === 'Concluído' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' :
                  job.status === 'Cancelado' ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' :
                  job.status === 'Em andamento' ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' :
                  'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                }`}
              >
                <option value="Pendente">Pendente</option>
                <option value="Em andamento">Em andamento</option>
                <option value="Concluído">Concluído</option>
                <option value="Cancelado">Cancelado</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={
                  job.status === 'Concluído' ? 'text-emerald-700' :
                  job.status === 'Cancelado' ? 'text-red-700' :
                  job.status === 'Em andamento' ? 'text-blue-700' :
                  'text-amber-700'
                }><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>

            {/* Status para Impressão */}
            <div className="hidden print:block px-4 py-2 rounded-xl text-sm font-bold border border-slate-300 text-slate-800">
              Status: {job.status}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
            <div className="flex items-center gap-3 text-slate-700 bg-slate-50 p-4 rounded-xl print:bg-transparent print:p-0 print:border-t print:border-slate-100 print:pt-4 print:rounded-none">
              <MapPin size={20} className="text-blue-600 print:text-slate-400" />
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase">Local da Instalação</p>
                <p className="font-bold">{job.stores?.name}</p>
                <p className="text-sm text-slate-500">{job.stores?.address}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-slate-700 bg-slate-50 p-4 rounded-xl print:bg-transparent print:p-0 print:border-t print:border-slate-100 print:pt-4 print:rounded-none">
              <Calendar size={20} className="text-blue-600 print:text-slate-400" />
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase">Data da Execução</p>
                <p className="font-bold">{new Date(job.scheduled_date).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
          </div>

          {/* Geolocation Section */}
          <div className="mt-4 pt-4 border-t border-slate-100 print:border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-slate-700">
                <Navigation size={20} className={job.lat ? "text-emerald-500" : "text-slate-400"} />
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase">Coordenadas GPS</p>
                  {job.lat ? (
                    <p className="font-bold text-sm font-mono">
                      Lat: {job.lat.toFixed(6)} <br className="sm:hidden" />
                      Lng: {job.lng.toFixed(6)}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">Localização não capturada</p>
                  )}
                </div>
              </div>
              {!job.lat && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={captureLocation} 
                  disabled={isLocating}
                  className="rounded-xl print:hidden"
                >
                  {isLocating ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                  {isLocating ? "Buscando..." : "Capturar Localização"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Field Work */}
      <Tabs defaultValue="photos" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 rounded-xl p-1 bg-slate-200/50 print:hidden">
          <TabsTrigger value="photos" className="rounded-lg font-medium">Fotos da Instalação</TabsTrigger>
          <TabsTrigger value="notes" className="rounded-lg font-medium">Relatório & Medidas</TabsTrigger>
        </TabsList>
        
        <TabsContent value="photos" className="space-y-8 print:block print:mt-8">
          <h3 className="hidden print:block text-xl font-bold text-slate-800 border-b border-slate-200 pb-2 mb-6">
            Registro Fotográfico
          </h3>
          
          {/* Seção: Antes da Instalação */}
          <div className="print:break-inside-avoid bg-white p-5 rounded-2xl border border-slate-100 shadow-sm print:border-none print:shadow-none print:p-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 print:text-base print:uppercase print:tracking-wider">
                <Camera size={20} className="text-slate-400 print:hidden" /> Antes da Instalação
              </h3>
              <span className="text-sm text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded-md print:hidden">
                {beforePhotos.length} {beforePhotos.length === 1 ? 'foto' : 'fotos'}
              </span>
            </div>
            
            <input type="file" accept="image/*" multiple capture="environment" className="hidden" ref={fileInputBeforeRef} onChange={(e) => handleFileUpload(e, 'before')} />
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 print:grid-cols-3">
              {beforePhotos.map(photo => (
                <div key={photo.id} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-50">
                  <img src={photo.photo_url} alt="Antes" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center print:hidden">
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      className="rounded-full h-10 w-10"
                      onClick={() => deletePhotoMutation.mutate(photo.id)}
                    >
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </div>
              ))}
              
              {/* Botão Adicionar Mais (Antes) */}
              <div 
                onClick={() => fileInputBeforeRef.current?.click()} 
                className="border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100 hover:border-blue-300 transition-colors cursor-pointer aspect-square print:hidden"
              >
                {uploadingType === 'before' ? (
                  <Loader2 className="animate-spin text-blue-600" size={24} />
                ) : (
                  <>
                    <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center mb-2 text-blue-600">
                      <Plus size={20} />
                    </div>
                    <span className="text-sm font-bold text-slate-600">Adicionar</span>
                  </>
                )}
              </div>
            </div>
            
            {beforePhotos.length === 0 && (
              <div className="hidden print:flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-300 rounded-xl p-8 mt-2">
                <Camera size={48} className="mb-2 opacity-20" />
                <span className="text-sm font-medium uppercase tracking-widest">Espaço para Fotos (Antes)</span>
              </div>
            )}
          </div>

          {/* Seção: Depois da Instalação */}
          <div className="print:break-inside-avoid bg-white p-5 rounded-2xl border border-slate-100 shadow-sm print:border-none print:shadow-none print:p-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 print:text-base print:uppercase print:tracking-wider">
                <CheckCircle2 size={20} className="text-emerald-500 print:hidden" /> Depois da Instalação
              </h3>
              <span className="text-sm text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded-md print:hidden">
                {afterPhotos.length} {afterPhotos.length === 1 ? 'foto' : 'fotos'}
              </span>
            </div>
            
            <input type="file" accept="image/*" multiple capture="environment" className="hidden" ref={fileInputAfterRef} onChange={(e) => handleFileUpload(e, 'after')} />
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 print:grid-cols-3">
              {afterPhotos.map(photo => (
                <div key={photo.id} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-50">
                  <img src={photo.photo_url} alt="Depois" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center print:hidden">
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      className="rounded-full h-10 w-10"
                      onClick={() => deletePhotoMutation.mutate(photo.id)}
                    >
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </div>
              ))}
              
              {/* Botão Adicionar Mais (Depois) */}
              <div 
                onClick={() => fileInputAfterRef.current?.click()} 
                className="border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100 hover:border-emerald-300 transition-colors cursor-pointer aspect-square print:hidden"
              >
                {uploadingType === 'after' ? (
                  <Loader2 className="animate-spin text-emerald-600" size={24} />
                ) : (
                  <>
                    <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center mb-2 text-emerald-600">
                      <Plus size={20} />
                    </div>
                    <span className="text-sm font-bold text-slate-600">Adicionar</span>
                  </>
                )}
              </div>
            </div>

            {afterPhotos.length === 0 && (
              <div className="hidden print:flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-300 rounded-xl p-8 mt-2">
                <Camera size={48} className="mb-2 opacity-20" />
                <span className="text-sm font-medium uppercase tracking-widest">Espaço para Fotos (Depois)</span>
              </div>
            )}
          </div>

        </TabsContent>
        
        <TabsContent value="notes" className="space-y-6 print:block print:mt-8">
          <h3 className="hidden print:block text-xl font-bold text-slate-800 border-b border-slate-200 pb-2 mb-6">
            Observações Técnicas
          </h3>
          <Card className="border-slate-200 shadow-sm rounded-2xl print:shadow-none print:border-none print:rounded-none">
            <CardContent className="p-6 space-y-6 print:p-0">
              <div className="print:break-inside-avoid">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2 print:text-base print:uppercase">
                  <FileText size={18} className="print:hidden" /> Relatório do Instalador
                </label>
                <Textarea 
                  placeholder="Descreva como foi a instalação, materiais utilizados, etc..." 
                  className="min-h-[120px] rounded-xl border-slate-200 resize-none print:border-slate-300 print:bg-slate-50"
                  defaultValue={job.notes || ""}
                  onBlur={(e) => handleNotesChange(e, 'notes')}
                />
              </div>
              
              <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 print:bg-transparent print:border-slate-300 print:break-inside-avoid">
                <label className="text-sm font-bold text-rose-800 flex items-center gap-2 mb-2 print:text-slate-800 print:text-base print:uppercase">
                  <AlertTriangle size={18} className="print:hidden" /> Divergência de Medidas / Problemas
                </label>
                <Textarea 
                  placeholder="Houve alguma diferença no tamanho da vitrine? O adesivo faltou? Anote aqui..." 
                  className="min-h-[100px] rounded-xl border-rose-200 bg-white resize-none focus-visible:ring-rose-500 print:border-none print:bg-transparent print:p-0 print:min-h-[60px]"
                  defaultValue={job.issues || ""}
                  onBlur={(e) => handleNotesChange(e, 'issues')}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Print Signatures */}
      <div className="hidden print:flex justify-between items-end mt-24 pt-8 break-inside-avoid">
        <div className="w-64 text-center">
          <div className="border-t border-slate-400 pt-2">
            <p className="font-bold text-slate-800">Equipe Cromaprint</p>
            <p className="text-sm text-slate-500">Responsável Técnico</p>
          </div>
        </div>
        <div className="w-64 text-center">
          <div className="border-t border-slate-400 pt-2">
            <p className="font-bold text-slate-800">Cliente / Gerente da Loja</p>
            <p className="text-sm text-slate-500">Assinatura de Aprovação</p>
          </div>
        </div>
      </div>
    </div>
  );
}