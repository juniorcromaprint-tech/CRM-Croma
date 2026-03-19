import React, { useState, useRef } from "react";
import { Camera, Upload, CheckCircle2, Loader2, Plus, Trash2, MessageSquare } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import imageCompression from "browser-image-compression";
import { applyWatermark } from "@/utils/watermark";
import { showSuccess, showError } from "@/utils/toast";
import ImageModal from "@/components/ImageModal";

interface JobPhotosProps {
  jobId: string;
  jobLat?: number | null;
  jobLng?: number | null;
  isOffline: boolean;
}

export default function JobPhotos({ jobId, jobLat, jobLng, isOffline }: JobPhotosProps) {
  const queryClient = useQueryClient();

  const [uploadingType, setUploadingType] = useState<"before" | "after" | null>(null);
  const [showPhotoSourcePicker, setShowPhotoSourcePicker] = useState<"before" | "after" | null>(null);
  const [annotatingPhoto, setAnnotatingPhoto] = useState<{ id: string; currentNote: string } | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState("");

  const fileInputBeforeRef = useRef<HTMLInputElement>(null);
  const cameraInputBeforeRef = useRef<HTMLInputElement>(null);
  const fileInputAfterRef = useRef<HTMLInputElement>(null);
  const cameraInputAfterRef = useRef<HTMLInputElement>(null);

  const { data: photos } = useQuery({
    queryKey: ["job-photos", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_photos")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!jobId,
  });

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_settings").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async (photo: { id: string; photo_url: string }) => {
      const fileName = photo.photo_url.split("/").pop() || "";
      await supabase.storage.from("job_photos").remove([fileName]);
      const { error } = await supabase.from("job_photos").delete().eq("id", photo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-photos", jobId] });
      showSuccess("Foto removida.");
    },
    onError: () => showError("Erro ao remover foto."),
  });

  const updatePhotoNoteMutation = useMutation({
    mutationFn: async ({ photoId, note }: { photoId: string; note: string }) => {
      const { error } = await supabase.from("job_photos").update({ note }).eq("id", photoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-photos", jobId] });
      setAnnotatingPhoto(null);
      showSuccess("Anotação salva!");
    },
    onError: () => showError("Erro ao salvar anotação."),
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: "before" | "after") => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    if (isOffline) return showError("Upload requer internet.");

    setUploadingType(type);
    try {
      for (let i = 0; i < files.length; i++) {
        let file = files[i];

        if (companySettings?.watermark_enabled) {
          try {
            const watermarkedBlob = await applyWatermark(file, {
              lat: jobLat,
              lng: jobLng,
              companyName: companySettings?.name,
            });
            file = new File([watermarkedBlob], file.name, { type: file.type });
          } catch (err) {
            console.error("Erro ao aplicar marca d'água:", err);
          }
        }

        const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
        const compressedFile = await imageCompression(file, options);
        const fileExt = file.name.split(".").pop();
        const fileName = `img_${jobId}_${type}_${Date.now()}_${i}.${fileExt}`;

        await supabase.storage.from("job_photos").upload(fileName, compressedFile);
        const {
          data: { publicUrl },
        } = supabase.storage.from("job_photos").getPublicUrl(fileName);
        await supabase.from("job_photos").insert({ job_id: jobId, photo_type: type, photo_url: publicUrl });
      }
      showSuccess("Upload concluído!");
      queryClient.invalidateQueries({ queryKey: ["job-photos", jobId] });
    } catch (error) {
      showError("Erro no upload.");
    } finally {
      setUploadingType(null);
      // Reset input so the same file can be uploaded again if needed
      event.target.value = "";
    }
  };

  const beforePhotos = photos?.filter((p) => p.photo_type === "before") || [];
  const afterPhotos = photos?.filter((p) => p.photo_type === "after") || [];

  return (
    <>
      <div className="space-y-8">
        {/* Antes */}
        <div className="bg-white p-5 rounded-2xl border shadow-sm">
          <div className="flex justify-between mb-4 border-b-2 border-slate-100 pb-2">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
              <Camera size={20} /> Antes da Instalação
            </h3>
            <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded">{beforePhotos.length} fotos</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {beforePhotos.map((photo) => (
              <div key={photo.id} className="flex flex-col gap-1">
                <div className="relative group aspect-square rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                  <img
                    src={photo.photo_url}
                    className="w-full h-full object-cover cursor-zoom-in"
                    onClick={() => {
                      setSelectedImageUrl(photo.photo_url);
                      setIsImageModalOpen(true);
                    }}
                  />
                  <button
                    onClick={() => {
                      if (window.confirm("Remover esta foto?"))
                        deletePhotoMutation.mutate({ id: photo.id, photo_url: photo.photo_url });
                    }}
                    className="absolute top-1.5 right-1.5 w-7 h-7 bg-red-500 text-white rounded-lg flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-md"
                  >
                    <Trash2 size={13} />
                  </button>
                  <button
                    onClick={() => setAnnotatingPhoto({ id: photo.id, currentNote: (photo as any).note || "" })}
                    className="absolute bottom-1.5 right-1.5 w-7 h-7 bg-black/60 text-white rounded-lg flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-md"
                  >
                    <MessageSquare size={13} className={(photo as any).note ? "text-yellow-300" : ""} />
                  </button>
                </div>
                {(photo as any).note && (
                  <p className="text-[10px] text-slate-500 px-0.5 line-clamp-2 italic leading-tight">{(photo as any).note}</p>
                )}
              </div>
            ))}
            <div
              onClick={() => !isOffline && setShowPhotoSourcePicker("before")}
              className={`aspect-square border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 ${isOffline ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                ref={fileInputBeforeRef}
                onChange={(e) => handleFileUpload(e, "before")}
              />
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                ref={cameraInputBeforeRef}
                onChange={(e) => handleFileUpload(e, "before")}
              />
              {uploadingType === "before" ? <Loader2 className="animate-spin" /> : <Plus />}
              <span className="text-xs font-bold mt-1">Adicionar</span>
            </div>
          </div>
        </div>

        {/* Depois */}
        <div className="bg-white p-5 rounded-2xl border shadow-sm">
          <div className="flex justify-between mb-4 border-b-2 border-slate-100 pb-2">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
              <CheckCircle2 size={20} className="text-emerald-500" /> Depois da Instalação
            </h3>
            <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded">{afterPhotos.length} fotos</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {afterPhotos.map((photo) => (
              <div key={photo.id} className="flex flex-col gap-1">
                <div className="relative group aspect-square rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                  <img
                    src={photo.photo_url}
                    className="w-full h-full object-cover cursor-zoom-in"
                    onClick={() => {
                      setSelectedImageUrl(photo.photo_url);
                      setIsImageModalOpen(true);
                    }}
                  />
                  <button
                    onClick={() => {
                      if (window.confirm("Remover esta foto?"))
                        deletePhotoMutation.mutate({ id: photo.id, photo_url: photo.photo_url });
                    }}
                    className="absolute top-1.5 right-1.5 w-7 h-7 bg-red-500 text-white rounded-lg flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-md"
                  >
                    <Trash2 size={13} />
                  </button>
                  <button
                    onClick={() => setAnnotatingPhoto({ id: photo.id, currentNote: (photo as any).note || "" })}
                    className="absolute bottom-1.5 right-1.5 w-7 h-7 bg-black/60 text-white rounded-lg flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-md"
                  >
                    <MessageSquare size={13} className={(photo as any).note ? "text-yellow-300" : ""} />
                  </button>
                </div>
                {(photo as any).note && (
                  <p className="text-[10px] text-slate-500 px-0.5 line-clamp-2 italic leading-tight">{(photo as any).note}</p>
                )}
              </div>
            ))}
            <div
              onClick={() => !isOffline && setShowPhotoSourcePicker("after")}
              className={`aspect-square border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 ${isOffline ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                ref={fileInputAfterRef}
                onChange={(e) => handleFileUpload(e, "after")}
              />
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                ref={cameraInputAfterRef}
                onChange={(e) => handleFileUpload(e, "after")}
              />
              {uploadingType === "after" ? <Loader2 className="animate-spin" /> : <Plus />}
              <span className="text-xs font-bold mt-1">Adicionar</span>
            </div>
          </div>
        </div>
      </div>

      {/* Photo source picker bottom sheet */}
      {showPhotoSourcePicker && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center print:hidden"
          onClick={() => setShowPhotoSourcePicker(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white w-full max-w-md rounded-t-2xl p-6 pb-10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center text-sm font-bold text-slate-500 uppercase tracking-wider mb-5">
              {showPhotoSourcePicker === "before" ? "Antes da Instalação" : "Depois da Instalação"}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  const ref = showPhotoSourcePicker === "before" ? cameraInputBeforeRef : cameraInputAfterRef;
                  setShowPhotoSourcePicker(null);
                  ref.current?.click();
                }}
                className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
              >
                <Camera size={32} className="text-blue-600" />
                <span className="font-bold text-slate-800">Câmera</span>
                <span className="text-xs text-slate-400">Tirar foto agora</span>
              </button>
              <button
                onClick={() => {
                  const ref = showPhotoSourcePicker === "before" ? fileInputBeforeRef : fileInputAfterRef;
                  setShowPhotoSourcePicker(null);
                  ref.current?.click();
                }}
                className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
              >
                <Upload size={32} className="text-blue-600" />
                <span className="font-bold text-slate-800">Galeria</span>
                <span className="text-xs text-slate-400">Escolher da galeria</span>
              </button>
            </div>
            <button
              onClick={() => setShowPhotoSourcePicker(null)}
              className="w-full mt-4 py-3 rounded-xl text-slate-500 font-medium hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Annotation bottom sheet */}
      {annotatingPhoto && (
        <div
          className="fixed inset-0 z-[9998] flex items-end justify-center print:hidden"
          onClick={() => setAnnotatingPhoto(null)}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative bg-white w-full max-w-lg rounded-t-2xl p-5 pb-10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-lg">
              <MessageSquare size={20} className="text-blue-600" /> Anotação da Foto
            </p>
            <p className="text-xs text-slate-400 mb-3">
              Use para registrar observações sobre esta foto — o que precisa ser corrigido, tamanhos, detalhes para a
              próxima visita, etc.
            </p>
            <textarea
              autoFocus
              className="w-full min-h-[110px] p-3 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
              placeholder="Ex: Na próxima instalação mandar adesivo maior, cor diferente..."
              value={annotatingPhoto.currentNote}
              onChange={(e) => setAnnotatingPhoto((prev) => (prev ? { ...prev, currentNote: e.target.value } : null))}
            />
            <div className="flex gap-3 mt-3">
              <button
                onClick={() => setAnnotatingPhoto(null)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-500 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() =>
                  updatePhotoNoteMutation.mutate({ photoId: annotatingPhoto.id, note: annotatingPhoto.currentNote })
                }
                disabled={updatePhotoNoteMutation.isPending}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {updatePhotoNoteMutation.isPending ? "Salvando..." : "Salvar Anotação"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ImageModal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} imageUrl={selectedImageUrl} />
    </>
  );
}
