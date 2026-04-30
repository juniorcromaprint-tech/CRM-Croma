// src/shared/components/PropostaAttachmentsHerdados.tsx
// Componente read-only que exibe anexos herdados da proposta (via proposta_id)
// Usado em: PedidoDetailPage, OSAnexosReferencia, Campo JobAttachments
// v1 (2026-04-28)
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Image, File, ExternalLink, Loader2, Paperclip } from 'lucide-react';

type PropostaAttachment = {
  id: string;
  nome_arquivo: string;
  tipo_mime: string;
  tamanho_bytes: number | null;
  onedrive_file_url: string | null;
  preview_url: string | null;
  uploaded_by_type: string | null;
  uploaded_by_name: string | null;
  created_at: string;
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getFileIcon(mimeOrExt: string) {
  const t = mimeOrExt.toLowerCase();
  if (t.includes('pdf')) return <FileText size={28} className="text-red-500" />;
  if (t.includes('image') || t.match(/\.(jpg|jpeg|png|webp|tiff|tif)$/))
    return <Image size={28} className="text-blue-500" />;
  if (t.match(/\.(ai|cdr|eps|svg|psd)$/))
    return <File size={28} className="text-purple-500" />;
  if (t.match(/\.(zip|rar)$/))
    return <File size={28} className="text-yellow-600" />;
  return <FileText size={28} className="text-slate-400" />;
}

function usePropostaAttachmentsByPropostaId(propostaId: string | null | undefined) {
  return useQuery<PropostaAttachment[]>({
    queryKey: ['proposta-attachments-herdados', propostaId],
    enabled: !!propostaId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!propostaId) return [];
      const { data, error } = await supabase
        .from('proposta_attachments')
        .select('id, nome_arquivo, tipo_mime, tamanho_bytes, onedrive_file_url, preview_url, uploaded_by_type, uploaded_by_name, created_at')
        .eq('proposta_id', propostaId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as PropostaAttachment[];
    },
  });
}

type Props = {
  propostaId: string | null | undefined;
  /** Titulo da secao (default: "Arte do Cliente") */
  titulo?: string;
  /** Se true, mostra layout compacto (Campo app) */
  compacto?: boolean;
};

export default function PropostaAttachmentsHerdados({
  propostaId,
  titulo = 'Arte do Cliente',
  compacto = false,
}: Props) {
  const { data: attachments, isLoading } = usePropostaAttachmentsByPropostaId(propostaId);

  if (!propostaId) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 size={20} className="animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-400">Carregando arquivos da proposta...</span>
      </div>
    );
  }

  if (!attachments || attachments.length === 0) {
    return (
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
        <Paperclip size={24} className="mx-auto text-slate-300 mb-1" />
        <p className="text-sm text-slate-400">Nenhum arquivo anexado na proposta</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Paperclip size={16} className="text-blue-500" />
        <h4 className="font-semibold text-slate-700 text-sm">{titulo}</h4>
        <span className="text-xs text-slate-400">({attachments.length} arquivo{attachments.length > 1 ? 's' : ''})</span>
      </div>

      <div className={`grid gap-3 ${compacto ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'}`}>
        {attachments.map((att) => (
          <a
            key={att.id}
            href={att.onedrive_file_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white rounded-xl border border-slate-200 p-3 flex flex-col gap-2 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            {/* Preview ou icone */}
            <div className="flex items-center justify-center h-20 bg-slate-50 rounded-lg overflow-hidden">
              {att.preview_url ? (
                <img
                  src={att.preview_url}
                  alt={att.nome_arquivo}
                  className="max-h-20 max-w-full object-contain"
                />
              ) : (
                getFileIcon(att.tipo_mime || att.nome_arquivo)
              )}
            </div>

            {/* Info */}
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-700 truncate" title={att.nome_arquivo}>
                {att.nome_arquivo}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                {att.tamanho_bytes && (
                  <span className="text-[10px] text-slate-400">{formatBytes(att.tamanho_bytes)}</span>
                )}
                {att.uploaded_by_type === 'cliente' && (
                  <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full">
                    Cliente
                  </span>
                )}
              </div>
            </div>

            {/* Link indicator */}
            {att.onedrive_file_url && (
              <div className="flex items-center gap-1 text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <ExternalLink size={10} />
                Abrir no OneDrive
              </div>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
