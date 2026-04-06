import React, { useRef, useState } from "react";
import {
  MapPin, FileText, Camera, Upload, Trash2, Loader2, ExternalLink, Plus,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type TipoAnexo = "referencia_local" | "arte_aprovada";

interface JobAttachment {
  id: string;
  tipo: TipoAnexo;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  description: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

interface PedidoAnexosProps {
  pedidoId: string;
  jobId?: string | null;
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
    accept: "image/*",
    hint: "Fotos da vitrine, parede ou local de instalacao",
  },
  arte_aprovada: {
    label: "Arte Aprovada",
    icon: FileText,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-700",
    emoji: "\uD83C\uDFA8",
    accept: "image/*,application/pdf",
    hint: "Arquivo de arte aprovado pelo cliente",
  },
} as const;

const MAX_SIZE_MB = 10;

export default function PedidoAnexos({ pedidoId, jobId }: PedidoAnexosProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [uploadingTipo, setUploadingTipo] = useState<TipoAnexo | null>(null);
  const [descricao, setDescricao] = useState<Partial<Record<TipoAnexo, string>>>({});
  const fileRefs = {
    referencia_local: useRef<HTMLInputElement>(null),
    arte_aprovada: useRef<HTMLInputElement>(null),
  };

  const canUpload = profile?.role && ["admin", "vendedor", "producao"].includes(profile.role);
  const isAdmin = profile?.role === "admin";

  const { data: attachments, isLoading } = useQuery({
    queryKey: ["pedido-attachments", pedidoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_attachments")
        .select("id, tipo, file_url, file_name, file_size, mime_type, description, uploaded_by_name, created_at")
        .eq("pedido_id", pedidoId)
        .is("deleted_at", null)
        .order("tipo")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as JobAttachment[];
    },
    enabled: !!pedidoId,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, tipo }: { file: File; tipo: TipoAnexo }) => {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        throw new Error(`Arquivo muito grande. Maximo: ${MAX_SIZE_MB}MB`);
      }

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const timestamp = Date.now();
      const rand = Math.floor(Math.random() * 1000);
      // Usar pedidoId como pasta base (job pode nao existir ainda)
      const basePath = jobId ?? pedidoId;
      const storagePath = `${basePath}/${tipo}_${timestamp}_${rand}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("job-attachments")
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("job-attachments")
        .getPublicUrl(storagePath);

      const { error: insertError } = await supabase
        .from("job_attachments")
        .insert({
          job_id: jobId ?? null,
          tipo,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          description: descricao[tipo] ?? null,
          uploaded_by_name: profile?.full_name ?? profile?.email ?? "Usuario",
          source: "erp",
          pedido_id: pedidoId,
        });

      if (insertError) throw insertError;
    },
    onSuccess: (_, { tipo }) => {
      queryClient.invalidateQueries({ queryKey: ["pedido-attachments", pedidoId] });
      if (jobId) queryClient.invalidateQueries({ queryKey: ["job-attachments", jobId] });
      setDescricao((prev) => ({ ...prev, [tipo]: "" }));
      toast.success("Anexo enviado com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Erro ao enviar arquivo");
    },
    onSettled: () => setUploadingTipo(null),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("job_attachments")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedido-attachments", pedidoId] });
      if (jobId) queryClient.invalidateQueries({ queryKey: ["job-attachments", jobId] });
      toast.success("Anexo removido");
    },
    onError: () => toast.error("Erro ao remover anexo"),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, tipo: TipoAnexo) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingTipo(tipo);
    uploadMutation.mutate({ file, tipo });
    e.target.value = "";
  }

  const grouped = (attachments ?? []).reduce<Record<string, JobAttachment[]>>((acc, att) => {
    if (!acc[att.tipo]) acc[att.tipo] = [];
    acc[att.tipo].push(att);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-slate-400" size={20} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(["referencia_local", "arte_aprovada"] as TipoAnexo[]).map((tipo) => {
        const config = TIPO_CONFIG[tipo];
        const items = grouped[tipo] ?? [];
        const Icon = config.icon;
        const isUploading = uploadingTipo === tipo;

        return (
          <div
            key={tipo}
            className={`rounded-2xl border ${config.border} ${config.bg} overflow-hidden shadow-sm`}
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3">
              <Icon size={16} className={config.color} />
              <span className={`text-sm font-semibold ${config.color}`}>
                {config.emoji} {config.label}
              </span>
              {items.length > 0 && (
                <span className={`ml-1 text-xs px-2 py-0.5 rounded-full font-medium ${config.badge}`}>
                  {items.length}
                </span>
              )}
              {canUpload && (
                <div className="ml-auto flex items-center gap-2">
                  <input
                    ref={fileRefs[tipo]}
                    type="file"
                    accept={config.accept}
                    className="hidden"
                    onChange={(e) => handleFileChange(e, tipo)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileRefs[tipo].current?.click()}
                    disabled={isUploading}
                    className={`gap-1.5 text-xs rounded-lg border ${config.border} ${config.color} bg-white hover:bg-white/80`}
                  >
                    {isUploading ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Plus size={13} />
                    )}
                    Adicionar
                  </Button>
                </div>
              )}
            </div>

            {/* Hint */}
            <p className="px-4 pb-2 text-xs text-slate-500">{config.hint}</p>

            {/* Itens */}
            {items.length === 0 ? (
              <div className="px-4 pb-4 text-xs text-slate-400 italic">
                Nenhum arquivo anexado ainda.
              </div>
            ) : (
              <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {items.map((att) => {
                  const isPdf = att.mime_type === "application/pdf" || att.file_name?.endsWith(".pdf");
                  return (
                    <div key={att.id} className="relative group flex flex-col gap-1">
                      {isPdf ? (
                        <a
                          href={att.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full aspect-square bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center gap-2 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <FileText size={32} className="text-red-400" />
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <ExternalLink size={9} /> Abrir PDF
                          </span>
                        </a>
                      ) : (
                        <a
                          href={att.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow block"
                        >
                          <img
                            src={att.file_url}
                            alt={att.file_name ?? tipo}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </a>
                      )}

                      {/* Botao deletar (admin) */}
                      {isAdmin && (
                        <button
                          onClick={() => {
                            if (confirm("Remover este anexo?")) deleteMutation.mutate(att.id);
                          }}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}

                      <p className="text-[10px] text-slate-500 truncate">{att.file_name ?? "arquivo"}</p>
                      {att.description && (
                        <p className="text-[10px] text-slate-600 line-clamp-2">{att.description}</p>
                      )}
                      {att.uploaded_by_name && (
                        <p className="text-[9px] text-slate-400 truncate">
                          Por: {att.uploaded_by_name}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {jobId && (
        <p className="text-xs text-slate-400 text-center">
          Estes arquivos tambem aparecem no App Campo do tecnico.
        </p>
      )}
    </div>
  );
}
