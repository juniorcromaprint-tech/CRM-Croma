import React, { useRef, useState } from "react";
import { MapPin, FileText, Camera, Plus, Loader2, ExternalLink, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import PropostaAttachmentsHerdados from "@/shared/components/PropostaAttachmentsHerdados";

interface JobAttachment {
  id: string;
  tipo: string;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  description: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

interface OSAnexosReferenciaProps {
  pedidoId: string;
  jobId?: string | null;
  ordemInstalacaoId?: string | null;
}

const MAX_SIZE_MB = 10;

export function OSAnexosReferencia({ pedidoId, jobId, ordemInstalacaoId }: OSAnexosReferenciaProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isAdmin = profile?.role === "admin";

  // Buscar proposta_id do pedido para herdar anexos da proposta
  const { data: pedidoInfo } = useQuery({
    queryKey: ["pedido-proposta-id", pedidoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("proposta_id")
        .eq("id", pedidoId)
        .maybeSingle();
      if (error) throw error;
      return data as { proposta_id: string | null } | null;
    },
    enabled: !!pedidoId,
    staleTime: 5 * 60 * 1000,
  });

  // Buscar todos os attachments do pedido/job
  const { data: attachments, isLoading } = useQuery({
    queryKey: ["os-attachments", pedidoId, jobId],
    queryFn: async () => {
      const query = supabase
        .from("job_attachments")
        .select("id, tipo, file_url, file_name, file_size, mime_type, description, uploaded_by_name, created_at")
        .is("deleted_at", null)
        .order("tipo")
        .order("created_at", { ascending: true });

      // Buscar por pedido_id OU job_id
      if (jobId) {
        query.or(`pedido_id.eq.${pedidoId},job_id.eq.${jobId}`);
      } else {
        query.eq("pedido_id", pedidoId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as JobAttachment[];
    },
    enabled: !!pedidoId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        throw new Error(`Arquivo muito grande. Maximo: ${MAX_SIZE_MB}MB`);
      }

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const timestamp = Date.now();
      const rand = Math.floor(Math.random() * 1000);
      const basePath = jobId ?? pedidoId;
      const storagePath = `${basePath}/foto_impresso_${timestamp}_${rand}.${ext}`;

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
          tipo: "foto_impresso",
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          description: null,
          uploaded_by_name: profile?.full_name ?? profile?.email ?? "Producao",
          source: "erp",
          pedido_id: pedidoId,
          ordem_instalacao_id: ordemInstalacaoId ?? null,
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["os-attachments", pedidoId, jobId] });
      if (jobId) queryClient.invalidateQueries({ queryKey: ["job-attachments", jobId] });
      toast.success("Foto do impresso enviada! Tecnico ja pode ver no App Campo.");
    },
    onError: (err: Error) => toast.error(err.message ?? "Erro ao enviar foto"),
    onSettled: () => setIsUploading(false),
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
      queryClient.invalidateQueries({ queryKey: ["os-attachments", pedidoId, jobId] });
      toast.success("Removido");
    },
  });

  function handleFotoImpresso(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    uploadMutation.mutate(file);
    e.target.value = "";
  }

  const referencias = (attachments ?? []).filter((a) =>
    a.tipo === "referencia_local" || a.tipo === "arte_aprovada"
  );
  const impressos = (attachments ?? []).filter((a) => a.tipo === "foto_impresso");

  const TIPO_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
    referencia_local: { label: "📍 Referencia do Local", color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
    arte_aprovada:   { label: "🎨 Arte Aprovada",        color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200" },
    foto_impresso:   { label: "🖨️ Material Impresso",    color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200" },
  };

  function renderCard(att: JobAttachment) {
    const isPdf = att.mime_type === "application/pdf" || att.file_name?.endsWith(".pdf");
    return (
      <div key={att.id} className="relative group flex flex-col gap-1">
        {isPdf ? (
          <a href={att.file_url} target="_blank" rel="noopener noreferrer"
            className="w-full aspect-square bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center gap-2 shadow-sm hover:shadow-md transition-shadow">
            <FileText size={32} className="text-red-400" />
            <span className="text-[10px] text-slate-400 flex items-center gap-1"><ExternalLink size={9} /> PDF</span>
          </a>
        ) : (
          <a href={att.file_url} target="_blank" rel="noopener noreferrer"
            className="w-full aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow block">
            <img src={att.file_url} alt={att.file_name ?? ""} className="w-full h-full object-cover" loading="lazy" />
          </a>
        )}
        {isAdmin && (
          <button onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(att.id); }}
            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow">
            <Trash2 size={11} />
          </button>
        )}
        <p className="text-[10px] text-slate-500 truncate">{att.file_name ?? "arquivo"}</p>
        {att.uploaded_by_name && (
          <p className="text-[9px] text-slate-400 truncate">Por: {att.uploaded_by_name}</p>
        )}
      </div>
    );
  }

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="animate-spin text-slate-400" size={18} /></div>;

  return (
    <div className="space-y-4">
      {/* ===== Arte herdada da proposta (OneDrive) ===== */}
      {pedidoInfo?.proposta_id && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 overflow-hidden shadow-sm p-4">
          <PropostaAttachmentsHerdados
            propostaId={pedidoInfo.proposta_id}
            titulo="Arte do Cliente (da Proposta)"
          />
        </div>
      )}

      {/* ===== Secao A: Referencias (read-only para producao) ===== */}
      {referencias.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-200">
            <p className="text-sm font-semibold text-slate-600">Referencias do Pedido</p>
            <p className="text-xs text-slate-400 mt-0.5">Enviadas pelo comercial para orientar a producao</p>
          </div>
          <div className="px-4 py-3 space-y-3">
            {(["referencia_local", "arte_aprovada"] as const).map((tipo) => {
              const items = referencias.filter((a) => a.tipo === tipo);
              if (items.length === 0) return null;
              const cfg = TIPO_LABELS[tipo];
              return (
                <div key={tipo}>
                  <p className={`text-xs font-semibold mb-2 ${cfg.color}`}>{cfg.label}</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {items.map(renderCard)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== Secao B: Foto do Impresso (upload da producao) ===== */}
      <div className="rounded-2xl border border-green-200 bg-green-50 overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-green-200">
          <Camera size={16} className="text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-700">🖨️ Foto do Material Impresso</p>
            <p className="text-xs text-green-600">Tire uma foto apos imprimir — o tecnico mostra ao lojista antes de instalar</p>
          </div>
          <div className="ml-auto">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFotoImpresso} />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
              size="sm"
              className="gap-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs"
            >
              {isUploading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Adicionar foto
            </Button>
          </div>
        </div>

        {impressos.length === 0 ? (
          <div className="px-4 py-4 text-xs text-green-600 italic">
            Nenhuma foto do impresso ainda. Adicione apos imprimir o material.
          </div>
        ) : (
          <div className="px-4 py-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {impressos.map(renderCard)}
          </div>
        )}
      </div>
    </div>
  );
}
