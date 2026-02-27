"use client";

import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Upload, FileText, AlertTriangle, CheckCircle2, Printer, MapPin, Calendar, Navigation, Loader2, Plus, Trash2, PenTool, User, MessageCircle, ExternalLink, Video, Play, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { showSuccess, showError } from "@/utils/toast";
import { CromaLogo, CromaLogoFallback } from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import imageCompression from 'browser-image-compression';
import SignatureCanvas from 'react-signature-canvas';
import ImageModal from "@/components/ImageModal";

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isLocating, setIsLocating] = useState(false);
  const [uploadingType, setUploadingType] = useState<'before' | 'after' | 'video' | null>(null);
  const [isSavingSignature, setIsSavingSignature] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState("");
  const [photoDescriptions, setPhotoDescriptions] = useState<{ [key: string]: string }>({});
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const fileInputBeforeRef = useRef<HTMLInputElement>(null);
  const fileInputAfterRef = useRef<HTMLInputElement>(null);
  const fileInputVideoRef = useRef<HTMLInputElement>(null);
  const sigCanvas = useRef<SignatureCanvas>(null);

  // Monitorar status da conexão
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, stores(*), profiles!jobs_assigned_to_fkey(first_name, last_name)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  const { data: photos } = useQuery({
    queryKey: ['job-photos', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_photos')
        .select('*')
        .eq('job_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const initialDescriptions = {};
      data?.forEach(photo => {
        initialDescriptions[photo.id] = photo.description || '';
      });
      setPhotoDescriptions(initialDescriptions);
      return data;
    },
    enabled: !!id
  });

  const { data: videos } = useQuery({
    queryKey: ['job-videos', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_videos')
        .select('*')
        .eq('job_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id
  });

  const updateJobMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase.from('jobs').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', id] });
      if (!isOffline) showSuccess("Alteração salva!");
    },
    onError: (error) => {
      if (isOffline) {
        showError("Você está offline. A alteração será salva quando houver sinal.");
      } else {
        showError("Erro ao salvar alteração.");
      }
    }
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const files = event.target.files;
    if (!files || files.length === 0 || !id) return;

    if (isOffline) {
      showError("Upload de fotos requer conexão com a internet.");
      return;
    }

    setUploadingType(type);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
        const compressedFile = await imageCompression(file, options);
        const fileExt = file.name.split('.').pop();
        const fileName = `img_${id}_${type}_${Date.now()}_${i}.${fileExt}`;
        
        await supabase.storage.from('job_photos').upload(fileName, compressedFile);
        const { data: { publicUrl } } = supabase.storage.from('job_photos').getPublicUrl(fileName);
        await supabase.from('job_photos').insert({ job_id: id, photo_type: type, photo_url: publicUrl });
      }
      showSuccess("Upload concluído!");
      queryClient.invalidateQueries({ queryKey: ['job-photos', id] });
    } catch (error) {
      showError("Erro no upload.");
    } finally {
      setUploadingType(null);
    }
  };

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id) return;

    if (isOffline) {
      showError("Upload de vídeos requer conexão com a internet.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      showError("O vídeo deve ter no máximo 15MB.");
      return;
    }

    setUploadingType('video');
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `vid_${id}_${Date.now()}.${fileExt}`;
      
      await supabase.storage.from('job_videos').upload(fileName, file);
      const { data: { publicUrl } } = supabase.storage.from('job_videos').getPublicUrl(fileName);
      await supabase.from('job_videos').insert({ job_id: id, video_url: publicUrl });

      showSuccess("Vídeo enviado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['job-videos', id] });
    } catch (error: any) {
      showError("Erro ao enviar vídeo.");
    } finally {
      setUploadingType(null);
      if (fileInputVideoRef.current) fileInputVideoRef.current.value = "";
    }
  };

  const captureLocation = () => {
    if (isOffline) return showError("GPS requer internet para salvar no mapa.");
    setIsLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          updateJobMutation.mutate({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }, {
            onSuccess: () => setIsLocating(false)
          });
        },
        () => {
          setIsLocating(false);
          showError("Erro ao capturar localização.");
        }
      );
    }
  };

  const saveSignature = async () => {
    if (isOffline) return showError("Assinatura digital requer internet para salvar.");
    if (sigCanvas.current?.isEmpty()) return showError("Assine primeiro.");
    setIsSavingSignature(true);
    try {
      const signatureDataUrl = sigCanvas.current?.getCanvas().toDataURL('image/png');
      const blob = await (await fetch(signatureDataUrl!)).blob();
      const fileName = `sig_${id}_${Date.now()}.png`;
      await supabase.storage.from('job_photos').upload(fileName, blob);
      const { data: { publicUrl } } = supabase.storage.from('job_photos').getPublicUrl(fileName);
      updateJobMutation.mutate({ signature_url: publicUrl });
    } catch (error) {
      showError("Erro ao salvar assinatura.");
    } finally {
      setIsSavingSignature(false);
    }
  };

  const openImageModal = (url: string) => {
    setSelectedImageUrl(url);
    setIsImageModalOpen(true);
  };

  if (isLoading) return <div className="p-10 text-center">Carregando...</div>;
  if (!job) return <div className="p-10 text-center">Não encontrado.</div>;

  const beforePhotos = photos?.filter(p => p.photo_type === 'before') || [];
  const afterPhotos = photos?.filter(p => p.photo_type === 'after') || [];

  return (
    <div className="space-y-6 pb-10 print:pb-0 print:space-y-0 print:bg-white print:block print:overflow-visible">
      {/* Alerta Offline */}
      {isOffline && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center gap-3 text-amber-800 animate-pulse print:hidden">
          <WifiOff size={20} />
          <p className="text-sm font-bold">Você está sem internet. Algumas funções estão limitadas.</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="bg-white border shadow-sm shrink-0 self-start">
          <ArrowLeft size={20} />
        </Button>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => window.confirm("Excluir OS?") && !isOffline && deleteJobMutation.mutate()} disabled={isOffline} className="text-red-600 border-red-200 flex-1 sm:flex-none">
            <Trash2 size={18} className="mr-2" /> Excluir
          </Button>
          <Button variant="outline" onClick={() => !isOffline && window.print()} disabled={isOffline} className="text-blue-600 border-slate-200 flex-1 sm:flex-none">
            <Printer size={18} className="mr-2" /> PDF
          </Button>
          {job.status !== "Concluído" && (
            <Button onClick={() => updateJobMutation.mutate({ status: 'Concluído' })} disabled={isOffline} className="bg-emerald-600 text-white flex-1 sm:flex-none">
              <CheckCircle2 size={18} className="mr-2" /> Finalizar
            </Button>
          )}
        </div>
      </div>

      {/* Card Principal */}
      <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white print:shadow-none print:border print:border-slate-200 print:rounded-xl print:mb-8">
        <div className="h-2 w-full bg-blue-600 print:hidden" />
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg mb-3 inline-block print:bg-transparent print:p-0 print:text-slate-500">OS: {job.os_number}</span>
              <h2 className="text-3xl font-black text-slate-800 print:text-2xl">{job.stores?.brand}</h2>
              <p className="text-slate-500 font-medium text-lg print:text-base">{job.type}</p>
            </div>
            <div className="print:hidden">
              <select 
                value={job.status} 
                disabled={isOffline}
                onChange={(e) => updateJobMutation.mutate({ status: e.target.value })}
                className="p-2 rounded-xl border font-bold text-sm bg-slate-50 disabled:opacity-50"
              >
                <option value="Pendente">Pendente</option>
                <option value="Em andamento">Em andamento</option>
                <option value="Concluído">Concluído</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3">
            <div className="bg-slate-50 p-4 rounded-xl print:bg-transparent print:border print:border-slate-100 print:p-3">
              <p className="text-xs text-slate-500 font-bold uppercase">Local</p>
              <p className="font-bold text-sm text-slate-800">{job.stores?.name}</p>
              <p className="text-xs text-slate-500">{job.stores?.address}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl print:bg-transparent print:border print:border-slate-100 print:p-3">
              <p className="text-xs text-slate-500 font-bold uppercase">Data</p>
              <p className="font-bold text-sm text-slate-800">{new Date(job.scheduled_date).toLocaleDateString('pt-BR')}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl print:bg-transparent print:border print:border-slate-100 print:p-3">
              <p className="text-xs text-slate-500 font-bold uppercase">Instalador</p>
              <p className="font-bold text-sm text-slate-800">{job.profiles ? `${job.profiles.first_name} ${job.profiles.last_name}` : 'Não atribuído'}</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t flex justify-between items-center print:border-slate-100">
            <div className="flex items-center gap-2">
              <Navigation size={18} className={job.lat ? "text-emerald-500" : "text-slate-400"} />
              {job.lat ? (
                <span className="text-sm font-bold text-slate-600">GPS: {job.lat.toFixed(6)}, {job.lng.toFixed(6)}</span>
              ) : (
                <span className="text-sm font-medium text-slate-400">GPS não capturado</span>
              )}
            </div>
            {!job.lat && (
              <Button variant="outline" size="sm" onClick={captureLocation} disabled={isLocating || isOffline} className="rounded-xl print:hidden">
                {isLocating ? <Loader2 className="animate-spin mr-2" size={14} /> : null} Capturar GPS
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs Interativas */}
      <div className="print:hidden">
        <Tabs defaultValue="photos" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6 rounded-xl p-1 bg-slate-200/50">
            <TabsTrigger value="photos">Fotos</TabsTrigger>
            <TabsTrigger value="videos">Vídeos</TabsTrigger>
            <TabsTrigger value="notes">Relatório</TabsTrigger>
            <TabsTrigger value="signature">Assinatura</TabsTrigger>
          </TabsList>
          
          <TabsContent value="photos" className="space-y-8">
            <div className="bg-white p-5 rounded-2xl border shadow-sm">
              <div className="flex justify-between mb-4 border-b-2 border-slate-100 pb-2">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg"><Camera size={20} /> Antes da Instalação</h3>
                <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded">{beforePhotos.length} fotos</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {beforePhotos.map(photo => (
                  <div key={photo.id} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                    <img src={photo.photo_url} className="w-full h-full object-cover cursor-zoom-in" onClick={() => openImageModal(photo.photo_url)} />
                  </div>
                ))}
                <div onClick={() => !isOffline && fileInputBeforeRef.current?.click()} className={`aspect-square border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 ${isOffline ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <input type="file" accept="image/*" multiple className="hidden" ref={fileInputBeforeRef} onChange={(e) => handleFileUpload(e, 'before')} />
                  {uploadingType === 'before' ? <Loader2 className="animate-spin" /> : <Plus />}
                  <span className="text-xs font-bold mt-1">Adicionar</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border shadow-sm">
              <div className="flex justify-between mb-4 border-b-2 border-slate-100 pb-2">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg"><CheckCircle2 size={20} className="text-emerald-500" /> Depois da Instalação</h3>
                <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded">{afterPhotos.length} fotos</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {afterPhotos.map(photo => (
                  <div key={photo.id} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                    <img src={photo.photo_url} className="w-full h-full object-cover cursor-zoom-in" onClick={() => openImageModal(photo.photo_url)} />
                  </div>
                ))}
                <div onClick={() => !isOffline && fileInputAfterRef.current?.click()} className={`aspect-square border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 ${isOffline ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <input type="file" accept="image/*" multiple className="hidden" ref={fileInputAfterRef} onChange={(e) => handleFileUpload(e, 'after')} />
                  {uploadingType === 'after' ? <Loader2 className="animate-spin" /> : <Plus />}
                  <span className="text-xs font-bold mt-1">Adicionar</span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="videos" className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border shadow-sm">
              <div className="flex justify-between mb-4 border-b-2 border-slate-100 pb-2">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg"><Video size={20} className="text-blue-600" /> Vídeos do Local</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {videos?.map(video => (
                  <div key={video.id} className="relative rounded-xl overflow-hidden border border-slate-200 bg-black aspect-video">
                    <video src={video.video_url} controls className="w-full h-full" />
                  </div>
                ))}
                <div onClick={() => !isOffline && fileInputVideoRef.current?.click()} className={`aspect-video border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 ${isOffline ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <input type="file" accept="video/*" className="hidden" ref={fileInputVideoRef} onChange={handleVideoUpload} />
                  {uploadingType === 'video' ? <Loader2 className="animate-spin" /> : <Plus />}
                  <span className="text-sm font-bold mt-1">Adicionar Vídeo</span>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="notes" className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <div className="mb-8">
                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider block mb-3 border-b pb-1">Relatório do Instalador</label>
                <Textarea 
                  className="min-h-[120px] rounded-xl" 
                  defaultValue={job.notes || ""} 
                  onBlur={(e) => updateJobMutation.mutate({ notes: e.target.value })} 
                />
              </div>
              <div className="bg-rose-50 p-5 rounded-2xl border border-rose-100">
                <label className="text-sm font-bold text-rose-800 block mb-3 border-b border-rose-200 pb-1">Divergências / Problemas Relatados</label>
                <Textarea 
                  className="min-h-[100px] rounded-xl bg-white" 
                  defaultValue={job.issues || ""} 
                  onBlur={(e) => updateJobMutation.mutate({ issues: e.target.value })} 
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="signature" className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-lg border-b-2 border-slate-100 pb-2"><PenTool size={20} /> Assinatura de Recebimento</h3>
              {job.signature_url ? (
                <div className="flex flex-col items-center">
                  <img src={job.signature_url} className="max-h-40 object-contain mb-4" />
                  <p className="text-xs uppercase font-black text-slate-600">Assinatura do Cliente</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 overflow-hidden">
                    <SignatureCanvas ref={sigCanvas} penColor="black" canvasProps={{ className: "w-full h-64" }} />
                  </div>
                  <div className="flex justify-between">
                    <Button variant="ghost" onClick={() => sigCanvas.current?.clear()}>Limpar</Button>
                    <Button onClick={saveSignature} disabled={isSavingSignature || isOffline} className="bg-blue-600 text-white rounded-xl px-6">
                      {isSavingSignature ? <Loader2 className="animate-spin mr-2" /> : null} Salvar Assinatura
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <ImageModal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} imageUrl={selectedImageUrl} />
    </div>
  );
}