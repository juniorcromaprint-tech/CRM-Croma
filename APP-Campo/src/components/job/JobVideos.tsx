import React, { useRef, useState } from "react";
import { Video, Loader2, Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";

interface JobVideosProps {
  jobId: string;
  isOffline: boolean;
}

export default function JobVideos({ jobId, isOffline }: JobVideosProps) {
  const queryClient = useQueryClient();
  const fileInputVideoRef = useRef<HTMLInputElement>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

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
    if (isOffline) return showError("Upload requer internet.");
    if (file.size > 15 * 1024 * 1024) return showError("Máximo 15MB.");

    setIsUploadingVideo(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `vid_${jobId}_${Date.now()}.${fileExt}`;
      await supabase.storage.from("job_videos").upload(fileName, file);
      const {
        data: { publicUrl },
      } = supabase.storage.from("job_videos").getPublicUrl(fileName);
      await supabase.from("job_videos").insert({ job_id: jobId, video_url: publicUrl });
      showSuccess("Vídeo enviado!");
      queryClient.invalidateQueries({ queryKey: ["job-videos", jobId] });
    } catch (error) {
      showError("Erro no vídeo.");
    } finally {
      setIsUploadingVideo(false);
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border shadow-sm">
        <div className="flex justify-between mb-4 border-b-2 border-slate-100 pb-2">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
            <Video size={20} className="text-blue-600" /> Vídeos do Local
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {videos?.map((video) => (
            <div key={video.id} className="relative rounded-xl overflow-hidden border border-slate-200 bg-black aspect-video">
              <video src={video.video_url} controls className="w-full h-full" />
            </div>
          ))}
          <div
            onClick={() => !isOffline && fileInputVideoRef.current?.click()}
            className={`aspect-video border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 ${isOffline ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <input
              type="file"
              accept="video/*"
              className="hidden"
              ref={fileInputVideoRef}
              onChange={handleVideoUpload}
            />
            {isUploadingVideo ? <Loader2 className="animate-spin" /> : <Plus />}
            <span className="text-sm font-bold mt-1">Adicionar Vídeo</span>
          </div>
        </div>
      </div>
    </div>
  );
}
