import React, { useState } from "react";
import { MapPin, FileText, Camera, ExternalLink, Loader2, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ImageModal from "@/components/ImageModal";

interface JobAttachment {
  id: string;
  tipo: "referencia_local" | "arte_aprovada" | "foto_impresso";
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  description: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

interface JobAttachmentsProps {
  jobId: string;
}

const TIPO_CONFIG = {
  referencia_local: {
    label: "Referencia do Local",
    icon: MapPin,
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
    badge: "bg-purple-100 text-purple-700",
    emoji: "\uD83D\uDCCD",
  },
  arte_aprovada: {
    label: "Arte Aprovada",
    icon: FileText,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-700",
    emoji: "\uD83C\uDFA8",
  },
  foto_impresso: {
    label: "Material Impresso",
    icon: Camera,
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
    badge: "bg-green-100 text-green-700",
    emoji: "\uD83D\uDDA8\uFE0F",
  },
} as const;

function isPdf(attachment: JobAttachment) {
  return (
    attachment.mime_type === "application/pdf" ||
    attachment.file_name?.toLowerCase().endsWith(".pdf")
  );
}

export default function JobAttachments({ jobId }: JobAttachmentsProps) {
  const [modalUrl, setModalUrl] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: attachments, isLoading } = useQuery({
    queryKey: ["job-attachments", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_attachments")
        .select("id, tipo, file_url, file_name, file_size, mime_type, description, uploaded_by_name, created_at")
        .eq("job_id", jobId)
        .is("deleted_at", null)
        .order("tipo")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as JobAttachment[];
    },
    enabled: !!jobId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="animate-spin text-gray-400" size={20} />
      </div>
    );
  }

  if (!attachments || attachments.length === 0) return null;

  // Agrupar por tipo
  const grouped = attachments.reduce<Record<string, JobAttachment[]>>((acc, att) => {
    if (!acc[att.tipo]) acc[att.tipo] = [];
    acc[att.tipo].push(att);
    return acc;
  }, {});

  const tiposPresentes = (["referencia_local", "arte_aprovada", "foto_impresso"] as const).filter(
    (t) => grouped[t]?.length > 0
  );

  return (
    <>
      <div className="mb-4 space-y-3">
        <div className="flex items-center gap-2 px-1">
          <span className="text-sm font-semibold text-gray-700">Referencias</span>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
            {attachments.length}
          </span>
        </div>

        {tiposPresentes.map((tipo) => {
          const config = TIPO_CONFIG[tipo];
          const items = grouped[tipo];
          const Icon = config.icon;

          return (
            <div
              key={tipo}
              className={`rounded-xl border ${config.border} ${config.bg} overflow-hidden`}
            >
              {/* Header do grupo */}
              <div className="flex items-center gap-2 px-3 py-2">
                <Icon size={14} className={config.color} />
                <span className={`text-xs font-semibold ${config.color}`}>
                  {config.emoji} {config.label}
                </span>
                <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full font-medium ${config.badge}`}>
                  {items.length}
                </span>
              </div>

              {/* Grid de thumbnails */}
              <div className="px-3 pb-3 grid grid-cols-3 gap-2">
                {items.map((att) => (
                  <div key={att.id} className="flex flex-col gap-1">
                    {isPdf(att) ? (
                      // PDF: botao de abrir
                      <a
                        href={att.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full aspect-square bg-white rounded-lg border border-gray-200 flex flex-col items-center justify-center gap-1 shadow-sm active:opacity-70"
                      >
                        <FileText size={28} className="text-red-400" />
                        <ExternalLink size={10} className="text-gray-400" />
                      </a>
                    ) : (
                      // Imagem: abre modal
                      <button
                        onClick={() => {
                          setModalUrl(att.file_url);
                          setIsModalOpen(true);
                        }}
                        className="w-full aspect-square rounded-lg overflow-hidden border border-gray-200 shadow-sm active:opacity-70"
                      >
                        <img
                          src={att.file_url}
                          alt={att.file_name ?? tipo}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    )}

                    {/* Nome do arquivo */}
                    <p className="text-[10px] text-gray-500 truncate leading-tight">
                      {att.file_name ?? "arquivo"}
                    </p>

                    {/* Descricao */}
                    {att.description && (
                      <p className="text-[10px] text-gray-600 leading-tight line-clamp-2">
                        {att.description}
                      </p>
                    )}

                    {/* Enviado por */}
                    {att.uploaded_by_name && (
                      <p className="text-[9px] text-gray-400 flex items-center gap-0.5 truncate">
                        <User size={8} />
                        {att.uploaded_by_name}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <ImageModal
        isOpen={isModalOpen}
        imageUrl={modalUrl}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
