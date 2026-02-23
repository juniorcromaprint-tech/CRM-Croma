import React, { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Upload, FileText, AlertTriangle, CheckCircle2, Printer, MapPin, Calendar, Navigation, Loader2 } from "lucide-react";
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
        .eq('job_id', id);
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
    const file = event.target.files?.[0];
    if (!file || !id) return;

    setUploadingType(type);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}-${type}-${Math.random()}.${fileExt}`;
      
      // 1. Upload para o Storage
      const { error: uploadError } = await supabase.storage
        .from('job_photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 2. Pegar URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('job_photos')
        .getPublicUrl(fileName);

      // 3. Salvar no banco de dados
      const { error: dbError } = await supabase
        .from('job_photos')
        .insert({ job_id: id, photo_type: type, photo_url: publicUrl });

      if (dbError) throw dbError;

      showSuccess(`Foto salva com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['job-photos', id] });
    } catch (error) {
      showError("Erro ao fazer upload da foto.");
      console.error(error);
    } finally {
      setUploadingType(null);
    }
  };

  const handleComplete = () => {
    updateJobMutation.mutate({ status: 'Concluído' }, {
      onSuccess: () => showSuccess("Instalação finalizada com sucesso!")
    });
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>, field: 'notes' | 'issues') => {
    updateJobMutation.mutate({ [field]: e.target.value });
  };

  if (isLoading) return <div className="p-10 text-center text-slate-500">Carregando OS...</div>;
  if (!job) return <div className="p-10 text-center text-slate-500">OS não encontrada.</div>;

  const beforePhoto = photos?.find(p => p.photo_type === 'before');
  const afterPhoto = photos?.find(p => p.photo_type === 'after');

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10 print:space-y-8 print:pb-0 print:bg-white">
      {/* Header - Hidden on Print */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-slate-600">
          <ArrowLeft size={24} />
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()} className="rounded-xl border-slate-200 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
            <Printer size={18} className="mr-2" /> Gerar PDF
          </Button>
          {job.status !== "Concluído" && (
            <Button onClick={handleComplete} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
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
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg inline-block mb-3 print:bg-transparent print:p-0 print:text-slate-500 print:text-base">
                OS: {job.os_number}
              </span>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">{job.stores?.brand}</h2>
              <p className="text-slate-500 font-medium text-lg mt-1">{job.type}</p>
            </div>
            <div className={`px-4 py-2 rounded-xl text-sm font-bold print:border print:border-slate-300 print:bg-transparent print:text-slate-800 ${job.status === 'Concluído' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
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
        
        <TabsContent value="photos" className="space-y-6 print:block print:mt-8">
          <h3 className="hidden print:block text-xl font-bold text-slate-800 border-b border-slate-200 pb-2 mb-6">
            Registro Fotográfico
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:gap-8">
            
            {/* Foto Antes */}
            <div className="print:break-inside-avoid">
              <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2 print:text-base print:uppercase print:tracking-wider">
                <Camera size={20} className="text-slate-400 print:hidden" /> Antes da Instalação
              </h3>
              <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputBeforeRef} onChange={(e) => handleFileUpload(e, 'before')} />
              
              {beforePhoto ? (
                <div className="rounded-2xl overflow-hidden border border-slate-200 relative group">
                  <img src={beforePhoto.photo_url} alt="Antes" className="w-full h-64 object-cover" />
                  <Button variant="secondary" size="sm" className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden" onClick={() => fileInputBeforeRef.current?.click()}>
                    Trocar Foto
                  </Button>
                </div>
              ) : (
                <div onClick={() => fileInputBeforeRef.current?.click()} className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer min-h-[256px] print:border-solid print:border-slate-300 print:bg-white">
                  {uploadingType === 'before' ? (
                    <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 text-blue-600 print:hidden"><Camera size={32} /></div>
                      <h4 className="font-bold text-slate-700 mb-1 print:hidden">Adicionar foto do local antes</h4>
                      <Button variant="outline" size="sm" className="rounded-xl bg-white print:hidden"><Upload size={16} className="mr-2" /> Câmera / Galeria</Button>
                      <div className="hidden print:flex flex-col items-center justify-center text-slate-300"><Camera size={48} className="mb-2 opacity-20" /><span className="text-sm font-medium uppercase tracking-widest">Espaço para Foto (Antes)</span></div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Foto Depois */}
            <div className="print:break-inside-avoid">
              <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2 print:text-base print:uppercase print:tracking-wider">
                <CheckCircle2 size={20} className="text-emerald-500 print:hidden" /> Depois da Instalação
              </h3>
              <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputAfterRef} onChange={(e) => handleFileUpload(e, 'after')} />
              
              {afterPhoto ? (
                <div className="rounded-2xl overflow-hidden border border-slate-200 relative group">
                  <img src={afterPhoto.photo_url} alt="Depois" className="w-full h-64 object-cover" />
                  <Button variant="secondary" size="sm" className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden" onClick={() => fileInputAfterRef.current?.click()}>
                    Trocar Foto
                  </Button>
                </div>
              ) : (
                <div onClick={() => fileInputAfterRef.current?.click()} className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer min-h-[256px] print:border-solid print:border-slate-300 print:bg-white">
                  {uploadingType === 'after' ? (
                    <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 text-blue-600 print:hidden"><Camera size={32} /></div>
                      <h4 className="font-bold text-slate-700 mb-1 print:hidden">Adicionar foto do serviço finalizado</h4>
                      <Button variant="outline" size="sm" className="rounded-xl bg-white print:hidden"><Upload size={16} className="mr-2" /> Câmera / Galeria</Button>
                      <div className="hidden print:flex flex-col items-center justify-center text-slate-300"><Camera size={48} className="mb-2 opacity-20" /><span className="text-sm font-medium uppercase tracking-widest">Espaço para Foto (Depois)</span></div>
                    </>
                  )}
                </div>
              )}
            </div>

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