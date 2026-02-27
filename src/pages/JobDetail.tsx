"use client";

import React, { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Upload, FileText, AlertTriangle, CheckCircle2, Printer, MapPin, Calendar, Navigation, Loader2, Plus, Trash2, PenTool, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
  const [uploadingType, setUploadingType] = useState<'before' | 'after' | null>(null);
  const [isSavingSignature, setIsSavingSignature] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState("");
  const [photoDescriptions, setPhotoDescriptions] = useState<{ [key: string]: string }>({});

  const fileInputBeforeRef = useRef<HTMLInputElement>(null);
  const fileInputAfterRef = useRef<HTMLInputElement>(null);
  const sigCanvas = useRef<SignatureCanvas>(null);

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

  const deleteJobMutation = useMutation({
    mutationFn: async () => {
      if (photos && photos.length > 0) {
        const fileNames = photos.map(p => {
          const urlParts = p.photo_url.split('/');
          return urlParts[urlParts.length - 1];
        });
        await supabase.storage.from('job_photos').remove(fileNames);
      }
      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("OS excluída com sucesso!");
      navigate(-1);
    }
  });

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
              showSuccess("Localização salva!");
            }
          });
        },
        () => {
          setIsLocating(false);
          showError("Erro ao capturar localização.");
        }
      );
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const files = event.target.files;
    if (!files || files.length === 0 || !id) return;

    setUploadingType(type);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
        const compressedFile = await imageCompression(file, options);
        const fileExt = file.name.split('.').pop();
        const fileName = `${id}-${type}-${Math.random()}.${fileExt}`;
        
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

  const handleDescriptionChange = (photoId: string, description: string) => {
    setPhotoDescriptions(prev => ({ ...prev, [photoId]: description }));
    supabase.from('job_photos').update({ description }).eq('id', photoId).then(({ error }) => {
      if (error) showError("Erro ao salvar descrição.");
    });
  };

  const saveSignature = async () => {
    if (sigCanvas.current?.isEmpty()) return showError("Assine primeiro.");
    setIsSavingSignature(true);
    try {
      const signatureDataUrl = sigCanvas.current?.getCanvas().toDataURL('image/png');
      const blob = await (await fetch(signatureDataUrl!)).blob();
      const fileName = `${id}-signature-${Math.random()}.png`;
      await supabase.storage.from('job_photos').upload(fileName, blob);
      const { data: { publicUrl } } = supabase.storage.from('job_photos').getPublicUrl(fileName);
      updateJobMutation.mutate({ signature_url: publicUrl }, { onSuccess: () => showSuccess("Assinatura salva!") });
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
    <div className="space-y-6 pb-10 print:bg-white">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="bg-white border shadow-sm">
          <ArrowLeft size={20} />
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.confirm("Excluir OS?") && deleteJobMutation.mutate()} className="text-red-600 border-red-200">
            <Trash2 size={18} className="mr-2" /> Excluir
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="text-blue-600 border-slate-200">
            <Printer size={18} className="mr-2" /> PDF
          </Button>
          {job.status !== "Concluído" && (
            <Button onClick={() => updateJobMutation.mutate({ status: 'Concluído' })} className="bg-emerald-600 text-white">
              <CheckCircle2 size={18} className="mr-2" /> Finalizar
            </Button>
          )}
        </div>
      </div>

      <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
        <div className="h-2 w-full bg-blue-600 print:hidden" />
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg mb-3 inline-block">OS: {job.os_number}</span>
              <h2 className="text-3xl font-black text-slate-800">{job.stores?.brand}</h2>
              <p className="text-slate-500 font-medium text-lg">{job.type}</p>
            </div>
            <div className="print:hidden">
              <select 
                value={job.status} 
                onChange={(e) => updateJobMutation.mutate({ status: e.target.value })}
                className="p-2 rounded-xl border font-bold text-sm bg-slate-50"
              >
                <option value="Pendente">Pendente</option>
                <option value="Em andamento">Em andamento</option>
                <option value="Concluído">Concluído</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl">
              <p className="text-xs text-slate-500 font-bold uppercase">Local</p>
              <p className="font-bold">{job.stores?.name}</p>
              <p className="text-sm text-slate-500">{job.stores?.address}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl">
              <p className="text-xs text-slate-500 font-bold uppercase">Data</p>
              <p className="font-bold">{new Date(job.scheduled_date).toLocaleDateString('pt-BR')}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl">
              <p className="text-xs text-slate-500 font-bold uppercase">Instalador</p>
              <p className="font-bold">{job.profiles ? `${job.profiles.first_name} ${job.profiles.last_name}` : 'Não atribuído'}</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Navigation size={18} className={job.lat ? "text-emerald-500" : "text-slate-400"} />
              <span className="text-sm font-medium text-slate-600">
                {job.lat ? `GPS: ${job.lat.toFixed(6)}, ${job.lng.toFixed(6)}` : "GPS não capturado"}
              </span>
            </div>
            {!job.lat && (
              <Button variant="outline" size="sm" onClick={captureLocation} disabled={isLocating} className="rounded-xl">
                {isLocating ? <Loader2 className="animate-spin mr-2" size={14} /> : null} Capturar GPS
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="photos" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 rounded-xl p-1 bg-slate-200/50 print:hidden">
          <TabsTrigger value="photos">Fotos</TabsTrigger>
          <TabsTrigger value="notes">Relatório</TabsTrigger>
          <TabsTrigger value="signature">Assinatura</TabsTrigger>
        </TabsList>
        
        <TabsContent value="photos" className="space-y-8">
          {/* Antes */}
          <div className="bg-white p-5 rounded-2xl border shadow-sm">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Camera size={20} /> Antes</h3>
              <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded">{beforePhotos.length} fotos</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {beforePhotos.map(photo => (
                <div key={photo.id} className="relative group aspect-square rounded-xl overflow-hidden border bg-slate-50">
                  <img 
                    src={photo.photo_url} 
                    className="w-full h-full object-cover cursor-zoom-in" 
                    onClick={() => openImageModal(photo.photo_url)} 
                  />
                  <Button 
                    variant="destructive" size="icon" 
                    className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); window.confirm("Excluir foto?") && deletePhotoMutation.mutate(photo.id); }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
              <div onClick={() => fileInputBeforeRef.current?.click()} className="aspect-square border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50">
                <input type="file" accept="image/*" multiple className="hidden" ref={fileInputBeforeRef} onChange={(e) => handleFileUpload(e, 'before')} />
                {uploadingType === 'before' ? <Loader2 className="animate-spin" /> : <Plus />}
                <span className="text-xs font-bold mt-1">Adicionar</span>
              </div>
            </div>
          </div>

          {/* Depois */}
          <div className="bg-white p-5 rounded-2xl border shadow-sm">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><CheckCircle2 size={20} className="text-emerald-500" /> Depois</h3>
              <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded">{afterPhotos.length} fotos</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {afterPhotos.map(photo => (
                <div key={photo.id} className="relative group aspect-square rounded-xl overflow-hidden border bg-slate-50">
                  <img 
                    src={photo.photo_url} 
                    className="w-full h-full object-cover cursor-zoom-in" 
                    onClick={() => openImageModal(photo.photo_url)} 
                  />
                  <Button 
                    variant="destructive" size="icon" 
                    className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); window.confirm("Excluir foto?") && deletePhotoMutation.mutate(photo.id); }}
                  >
                    <Trash2 size={14} />
                  </Button>
                  <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/50">
                    <input 
                      className="w-full bg-transparent text-[10px] text-white outline-none" 
                      placeholder="Legenda..." 
                      value={photoDescriptions[photo.id] || ''}
                      onChange={(e) => handleDescriptionChange(photo.id, e.target.value)}
                    />
                  </div>
                </div>
              ))}
              <div onClick={() => fileInputAfterRef.current?.click()} className="aspect-square border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50">
                <input type="file" accept="image/*" multiple className="hidden" ref={fileInputAfterRef} onChange={(e) => handleFileUpload(e, 'after')} />
                {uploadingType === 'after' ? <Loader2 className="animate-spin" /> : <Plus />}
                <span className="text-xs font-bold mt-1">Adicionar</span>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="notes" className="space-y-6">
          <Card className="p-6 space-y-6">
            <div>
              <label className="text-sm font-bold text-slate-700 block mb-2">Relatório do Instalador</label>
              <Textarea 
                className="min-h-[120px] rounded-xl" 
                defaultValue={job.notes || ""} 
                onBlur={(e) => updateJobMutation.mutate({ notes: e.target.value })} 
              />
            </div>
            <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
              <label className="text-sm font-bold text-rose-800 block mb-2">Divergências / Problemas</label>
              <Textarea 
                className="min-h-[100px] rounded-xl bg-white" 
                defaultValue={job.issues || ""} 
                onBlur={(e) => updateJobMutation.mutate({ issues: e.target.value })} 
              />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="signature" className="space-y-6">
          <Card className="p-6">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><PenTool size={20} /> Assinatura</h3>
            {job.signature_url ? (
              <div className="space-y-4">
                <div className="border rounded-xl p-4 bg-slate-50 flex justify-center">
                  <img src={job.signature_url} className="max-h-48" />
                </div>
                <Button variant="outline" onClick={() => window.confirm("Remover?") && updateJobMutation.mutate({ signature_url: null })} className="text-red-600">Remover</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border-2 border-dashed rounded-xl bg-slate-50 overflow-hidden">
                  <SignatureCanvas ref={sigCanvas} penColor="black" canvasProps={{ className: "w-full h-64" }} />
                </div>
                <div className="flex justify-between">
                  <Button variant="ghost" onClick={() => sigCanvas.current?.clear()}>Limpar</Button>
                  <Button onClick={saveSignature} disabled={isSavingSignature} className="bg-blue-600 text-white">
                    {isSavingSignature ? <Loader2 className="animate-spin" /> : "Salvar Assinatura"}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <ImageModal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} imageUrl={selectedImageUrl} />
    </div>
  );
}