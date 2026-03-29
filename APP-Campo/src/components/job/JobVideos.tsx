import React, { useRef, useState } from "react";
import { Video, Loader2, Plus, Camera, Upload, Trash2, AlertCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Limite de 50MB para vídeos (Supabase free tier = 50MB per file)
const MAX_VIDEO_SIZE_MB = 50;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;

interface JobVideosProps {
  jobId: string;
  isOffline: boolean;
}

export default function JobVideos({ jobId, isOffline }: JobVideosProps) {
  const queryClient = useQueryClient();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [videoToDelete, setVideoToDelete] = useState<string | null>(null);
  const [isDeletingVideo, setIsDeletingVideo] = useState(false);

  const { data: videos } = useQuery({
    queryKey: ["job-videos", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_videos")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!jobId,
  });

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (isOffline) return showError("Upload requer conexão com a internet.");

    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      return showError(`Vídeo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo: ${MAX_VIDEO_SIZE_MB}MB. Tente gravar um vídeo mais curto.`);
    }

    setIsUploadingVideo(true);
    setUploadProgress("Enviando vídeo...");

    try {
      const fileExt = file.name.split(".").pop() || "mp4";
      const fileName = `vid_${jobId}_${Date.now()}.${fileExt}`;

      setUploadProgress(`Enviando (${(file.size / 1024 / 1024).toFixed(1)}MB)...`);

      const { error: uploadError } = await supabase.storage
        .from("job_videos")
        .upload(fileName, file, {
          cacheControl: "3600",
          contentType: file.type || "video/mp4",
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("job_videos")
        .getPublicUrl(fileName);

      const { data: insertData, error: insertError } = await supabase
        .from("job_videos")
        .insert({ job_id: jobId, video_url: publicUrl })
        .select()
        .single();

      if (insertError) throw insertError;
      if (!insertData) throw new Error("Falha ao registrar vídeo — verifique suas permissões.");

      showSuccess("Vídeo enviado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["job-videos", jobId] });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      showError(`Erro ao enviar vídeo: ${msg}`);
    } finally {
      setIsUploadingVideo(false);
      setUploadProgress("");
      event.target.value = "";
    }
  };

  const handleDeleteVideo = async () => {
    if (!videoToDelete) return;
    setIsDeletingVideo(true);
    try {
      // Extract filename from URL to delete from storage
      const video = videos?.find(v => v.id === videoToDelete);
      if (video?.video_url) {
        const urlParts = video.video_url.split("/");
        const storagePath = urlParts[urlParts.length - 1];
        if (storagePath) {
          await supabase.storage.from("job_videos").remove([storagePath]);
        }
      }

      const { error } = await supabase
        .from("job_videos")
        .delete()
        .eq("id", videoToDelete);

      if (error) throw error;

      showSuccess("Vídeo removido!");
      queryClient.invalidateQueries({ queryKey: ["job-videos", jobId] });
    } catch (error) {
      showError("Erro ao remover vídeo.");
    } finally {
      setIsDeletingVideo(false);
      setVideoToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border shadow-sm">
        <div className="flex justify-between items-center mb-4 border-b-2 border-slate-100 pb-2">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
            <Video size={20} className="text-blue-600" /> Vídeos da Instalação
          </h3>
          <span className="text-xs text-slate-400">{videos?.length || 0} vídeo(s)</span>
        </div>

        {/* Botões de ação: Gravar e Galeria */}
        <div className="flex gap-3 mb-4">
          {/* Botão GRAVAR — abre câmera direto */}
          <Button
            variant="default"
            size="sm"
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            disabled={isOffline || isUploadingVideo}
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera size={16} className="mr-1.5" />
            Gravar Vídeo
          </Button>
          <input
            type="file"
            accept="video/*"
            capture="environment"
            className="hidden"
            ref={cameraInputRef}
            onChange={handleVideoUpload}
          />

          {/* Botão GALERIA — abre seletor de arquivo */}
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={isOffline || isUploadingVideo}
            onClick={() => galleryInputRef.current?.click()}
          >
            <Upload size={16} className="mr-1.5" />
            Da Galeria
          </Button>
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/*"
            className="hidden"
            ref={galleryInputRef}
            onChange={handleVideoUpload}
          />
        </div>

        {/* Status de upload */}
        {isUploadingVideo && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-blue-50 rounded-xl text-sm text-blue-700">
            <Loader2 size={16} className="animate-spin" />
            <span>{uploadProgress || "Enviando..."}</span>
          </div>
        )}

        {/* Info de offline */}
        {isOffline && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-amber-50 rounded-xl text-sm text-amber-700">
            <AlertCircle size={16} />
            <span>Sem internet — vídeos não podem ser enviados agora.</span>
          </div>
        )}

        {/* Lista de vídeos */}
        {videos && videos.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {videos.map((video) => (
              <div key={video.id} className="relative rounded-xl overflow-hidden border border-slate-200 bg-black">
                <video
                  src={video.video_url}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full aspect-video"
                />
                <button
                  onClick={() => setVideoToDelete(video.id)}
                  className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 transition-colors"
                  title="Remover vídeo"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          !isUploadingVideo && (
            <div className="text-center py-8 text-slate-400">
              <Video size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">Nenhum vídeo registrado</p>
              <p className="text-xs mt-1">Use os botões acima para gravar ou enviar</p>
            </div>
          )
        )}
      </div>

      {/* Dialog de confirmação para deletar */}
      <AlertDialog open={!!videoToDelete} onOpenChange={(open) => !open && setVideoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover vídeo?</AlertDialogTitle>
            <AlertDialogDescription>
              Este vídeo será removido permanentemente da OS.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingVideo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault();
                handleDeleteVideo();
              }}
              disabled={isDeletingVideo}
            >
              {isDeletingVideo ? (
                <><Loader2 size={14} className="animate-spin mr-1.5" /> Removendo...</>
              ) : (
                "Remover"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
