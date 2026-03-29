import React, { useRef, useState, useCallback, useEffect } from "react";
import { Video, Loader2, Camera, Upload, Trash2, AlertCircle, StopCircle, Clock } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── Limites ────────────────────────────────────────────────
const MAX_VIDEO_SIZE_MB = 50;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
const MAX_DURATION_S = 60;
// Bitrate alvo para compactação (~1.5 Mbps = ~11MB por 60s)
const TARGET_VIDEO_BITRATE = 1_500_000;
const TARGET_AUDIO_BITRATE = 64_000;

// ─── Helpers ────────────────────────────────────────────────

/** Lê a duração de um vídeo a partir de um File */
function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const el = document.createElement("video");
    el.preload = "metadata";
    const url = URL.createObjectURL(file);
    el.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(el.duration); };
    el.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível ler o vídeo.")); };
    el.src = url;
  });
}

/**
 * Compacta um vídeo usando canvas + MediaRecorder.
 * Reproduz o vídeo num <video> offscreen, desenha no canvas frame a frame,
 * e regrava com bitrate controlado. Funciona em mobile Chrome/Safari.
 */
function compressVideo(
  file: File,
  onProgress: (msg: string) => void,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const videoEl = document.createElement("video");
    videoEl.playsInline = true;
    videoEl.muted = true;
    const url = URL.createObjectURL(file);
    videoEl.src = url;

    videoEl.onloadedmetadata = () => {
      // Se já é pequeno (< 8MB), não compacta
      if (file.size < 8 * 1024 * 1024) {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }

      const canvas = document.createElement("canvas");
      // Reduz resolução para 720p max (mantendo aspect ratio)
      const scale = Math.min(1, 720 / Math.max(videoEl.videoWidth, videoEl.videoHeight));
      canvas.width = Math.round(videoEl.videoWidth * scale);
      canvas.height = Math.round(videoEl.videoHeight * scale);
      const ctx = canvas.getContext("2d")!;

      // Captura stream do canvas + áudio do vídeo
      const canvasStream = canvas.captureStream(30);
      try {
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaElementSource(videoEl);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        source.connect(audioCtx.destination);
        dest.stream.getAudioTracks().forEach(t => canvasStream.addTrack(t));
      } catch {
        // Sem áudio — ok para vídeos de instalação
      }

      // Escolhe codec suportado
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
          ? "video/webm;codecs=vp8"
          : "video/webm";

      const recorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: TARGET_VIDEO_BITRATE,
        audioBitsPerSecond: TARGET_AUDIO_BITRATE,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        URL.revokeObjectURL(url);
        const blob = new Blob(chunks, { type: mimeType });
        onProgress(`Compactado: ${(file.size / 1024 / 1024).toFixed(1)}MB → ${(blob.size / 1024 / 1024).toFixed(1)}MB`);
        resolve(blob);
      };
      recorder.onerror = () => {
        URL.revokeObjectURL(url);
        // Fallback: envia original se compactação falhar
        resolve(file);
      };

      // Desenha frame a frame
      const drawFrame = () => {
        if (videoEl.paused || videoEl.ended) return;
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        const pct = Math.round((videoEl.currentTime / videoEl.duration) * 100);
        onProgress(`Compactando... ${pct}%`);
        requestAnimationFrame(drawFrame);
      };

      videoEl.onplay = () => { drawFrame(); };
      videoEl.onended = () => { recorder.stop(); };

      recorder.start(100); // chunks de 100ms
      videoEl.play().catch(() => {
        URL.revokeObjectURL(url);
        resolve(file); // fallback
      });
    };

    videoEl.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Erro ao processar vídeo para compactação."));
    };
  });
}

// ─── Componente ─────────────────────────────────────────────

interface JobVideosProps {
  jobId: string;
  isOffline: boolean;
}

export default function JobVideos({ jobId, isOffline }: JobVideosProps) {
  const queryClient = useQueryClient();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [videoToDelete, setVideoToDelete] = useState<string | null>(null);
  const [isDeletingVideo, setIsDeletingVideo] = useState(false);

  // ─── Gravação nativa ────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      cameraStream?.getTracks().forEach(t => t.stop());
    };
  }, [cameraStream]);

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

  // ─── Iniciar gravação ───────────────────────────────────
  const startRecording = useCallback(async () => {
    if (isOffline) return showError("Gravação requer conexão com a internet para enviar depois.");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });

      setCameraStream(stream);

      // Mostra preview
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
          ? "video/webm;codecs=vp8"
          : "video/mp4";

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: TARGET_VIDEO_BITRATE,
        audioBitsPerSecond: TARGET_AUDIO_BITRATE,
      });

      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        setCameraStream(null);
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        const file = new File([blob], `gravacao_${Date.now()}.${ext}`, { type: mimeType });
        uploadVideoFile(file);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(500);
      setIsRecording(true);
      setRecordingSeconds(0);

      // Timer visual + auto-stop em 60s
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          const next = prev + 1;
          if (next >= MAX_DURATION_S) {
            stopRecording();
          }
          return next;
        });
      }, 1000);

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao acessar câmera";
      if (msg.includes("NotAllowedError") || msg.includes("Permission")) {
        showError("Permita o acesso à câmera nas configurações do navegador.");
      } else {
        showError(`Erro ao iniciar gravação: ${msg}`);
      }
    }
  }, [isOffline]);

  // ─── Parar gravação ─────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  }, []);

  // ─── Upload (usado tanto pela gravação quanto pela galeria) ──
  const uploadVideoFile = async (file: File) => {
    setIsUploadingVideo(true);

    try {
      // Validar duração
      try {
        setUploadProgress("Verificando duração...");
        const duration = await getVideoDuration(file);
        if (duration > MAX_DURATION_S) {
          showError(`Vídeo muito longo (${Math.round(duration)}s). Máximo: ${MAX_DURATION_S} segundos.`);
          return;
        }
      } catch {
        // Se não conseguir ler metadata, prossegue
      }

      // Compactar se necessário
      let finalBlob: Blob = file;
      if (file.size > 8 * 1024 * 1024) {
        setUploadProgress("Compactando vídeo...");
        try {
          finalBlob = await compressVideo(file, setUploadProgress);
        } catch {
          finalBlob = file; // fallback: envia original
        }
      }

      // Validar tamanho final
      if (finalBlob.size > MAX_VIDEO_SIZE_BYTES) {
        showError(`Vídeo ainda muito grande após compactação (${(finalBlob.size / 1024 / 1024).toFixed(1)}MB). Tente um vídeo mais curto.`);
        return;
      }

      const ext = file.name?.split(".").pop() || (file.type.includes("mp4") ? "mp4" : "webm");
      const fileName = `vid_${jobId}_${Date.now()}.${ext}`;

      setUploadProgress(`Enviando (${(finalBlob.size / 1024 / 1024).toFixed(1)}MB)...`);

      const { error: uploadError } = await supabase.storage
        .from("job_videos")
        .upload(fileName, finalBlob, {
          cacheControl: "3600",
          contentType: finalBlob.type || "video/webm",
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
    }
  };

  // ─── Galeria handler ────────────────────────────────────
  const handleGallerySelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (isOffline) return showError("Upload requer conexão com a internet.");
    await uploadVideoFile(file);
  };

  // ─── Deletar vídeo ──────────────────────────────────────
  const handleDeleteVideo = async () => {
    if (!videoToDelete) return;
    setIsDeletingVideo(true);
    try {
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
    } catch {
      showError("Erro ao remover vídeo.");
    } finally {
      setIsDeletingVideo(false);
      setVideoToDelete(null);
    }
  };

  // Formata segundos em MM:SS
  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border shadow-sm">
        <div className="flex justify-between items-center mb-4 border-b-2 border-slate-100 pb-2">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
            <Video size={20} className="text-blue-600" /> Vídeos da Instalação
          </h3>
          <span className="text-xs text-slate-400">{videos?.length || 0} vídeo(s)</span>
        </div>

        {/* ── Preview da câmera durante gravação ── */}
        {isRecording && (
          <div className="relative mb-4 rounded-xl overflow-hidden border-2 border-red-500 bg-black">
            <video
              ref={videoPreviewRef}
              autoPlay
              playsInline
              muted
              className="w-full aspect-video"
            />
            {/* Timer overlay */}
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 text-white px-3 py-1.5 rounded-full text-sm font-mono">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <Clock size={14} />
              <span>{formatTime(recordingSeconds)}</span>
              <span className="text-red-300 text-xs">/ {formatTime(MAX_DURATION_S)}</span>
            </div>
            {/* Barra de progresso */}
            <div className="absolute bottom-0 left-0 h-1 bg-red-500 transition-all duration-1000"
              style={{ width: `${(recordingSeconds / MAX_DURATION_S) * 100}%` }}
            />
          </div>
        )}

        {/* ── Botões de ação ── */}
        <div className="flex gap-3 mb-4">
          {isRecording ? (
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              onClick={stopRecording}
            >
              <StopCircle size={16} className="mr-1.5" />
              Parar Gravação ({formatTime(MAX_DURATION_S - recordingSeconds)})
            </Button>
          ) : (
            <>
              <Button
                variant="default"
                size="sm"
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={isOffline || isUploadingVideo}
                onClick={startRecording}
              >
                <Camera size={16} className="mr-1.5" />
                Gravar Vídeo
              </Button>
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
                onChange={handleGallerySelect}
              />
            </>
          )}
        </div>

        {/* Dica de limite */}
        {!isRecording && !isUploadingVideo && (
          <p className="text-xs text-slate-400 mb-4 text-center">
            Máx. {MAX_DURATION_S}s por vídeo — compactação automática
          </p>
        )}

        {/* Status de upload/compactação */}
        {isUploadingVideo && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-blue-50 rounded-xl text-sm text-blue-700">
            <Loader2 size={16} className="animate-spin" />
            <span>{uploadProgress || "Processando..."}</span>
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
          !isUploadingVideo && !isRecording && (
            <div className="text-center py-8 text-slate-400">
              <Video size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">Nenhum vídeo registrado</p>
              <p className="text-xs mt-1">Grave direto da câmera ou envie da galeria</p>
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
