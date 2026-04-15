// src/domains/comercial/components/PropostaAttachmentsSection.tsx
// Secao de anexos da proposta — drop-zone, fila de upload, grid de arquivos
// v1 (2026-04-14)
import { useCallback, useRef, useState } from 'react';
import { Upload, X, RefreshCw, ExternalLink, Trash2, FileText, Image, File, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  usePropostaAttachments,
  useDeletePropostaAttachment,
  type PropostaAttachment,
} from '../hooks/usePropostaAttachments';
import { useAttachmentsUpload, type AttachmentUploadItem } from '@/hooks/useAttachmentsUpload';

type Props = {
  propostaId: string;
  readOnly?: boolean;
};

// =================== helpers ===================

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

function statusLabel(status: AttachmentUploadItem['status']): string {
  switch (status) {
    case 'pending': return 'Na fila...';
    case 'computing_hash': return 'Verificando...';
    case 'generating_preview': return 'Gerando preview...';
    case 'uploading': return 'Enviando...';
    case 'done': return 'Enviado';
    case 'error': return 'Erro';
    case 'duplicate': return 'Duplicado';
  }
}

// =================== sub-componentes ===================

function UploadQueueItem({
  item,
  onRetry,
  onRemove,
  propostaId,
  addFiles,
}: {
  item: AttachmentUploadItem;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  propostaId: string;
  addFiles: (files: File[], propostaId: string) => void;
}) {
  const isActive = ['computing_hash', 'generating_preview', 'uploading'].includes(item.status);
  const isError = item.status === 'error';
  const isDuplicate = item.status === 'duplicate';
  const isDone = item.status === 'done';

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm ${
      isError ? 'border-red-200 bg-red-50' :
      isDuplicate ? 'border-yellow-200 bg-yellow-50' :
      isDone ? 'border-green-200 bg-green-50' :
      'border-slate-200 bg-white'
    }`}>
      {/* Icone de status */}
      <span className="shrink-0">
        {isActive && <Loader2 size={16} className="animate-spin text-blue-500" />}
        {isDone && <CheckCircle size={16} className="text-green-500" />}
        {(isError || isDuplicate) && <AlertCircle size={16} className="text-red-500" />}
        {item.status === 'pending' && <Upload size={16} className="text-slate-400" />}
      </span>

      {/* Nome + status */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-slate-700">{item.file.name}</p>
        <p className={`text-xs ${isError || isDuplicate ? 'text-red-600' : isDone ? 'text-green-600' : 'text-slate-400'}`}>
          {item.error || statusLabel(item.status)}
        </p>
      </div>

      {/* Acoes */}
      {isError && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => onRetry(item.id)}
          title="Tentar novamente"
        >
          <RefreshCw size={12} className="mr-1" />
          Retry
        </Button>
      )}
      {!isActive && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
          onClick={() => onRemove(item.id)}
          title="Remover da fila"
        >
          <X size={14} />
        </Button>
      )}
    </div>
  );
}

function AttachmentCard({
  attachment,
  readOnly,
  onDelete,
}: {
  attachment: PropostaAttachment;
  readOnly: boolean;
  onDelete: (id: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { mutate: deleteAttachment } = useDeletePropostaAttachment();

  const ext = attachment.nome_arquivo.split('.').pop()?.toLowerCase() ?? '';
  const isByCliente = attachment.uploaded_by_type === 'cliente';

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); // regra obrigatoria: AlertDialogAction com async
    setDeleting(true);
    deleteAttachment(attachment.id, {
      onSettled: () => {
        setDeleting(false);
        setConfirmOpen(false);
      },
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col gap-2 hover:border-slate-300 transition-colors">
      {/* Preview ou icone */}
      <div className="flex items-center justify-center h-20 bg-slate-50 rounded-lg overflow-hidden">
        {attachment.preview_url ? (
          <img
            src={attachment.preview_url}
            alt={attachment.nome_arquivo}
            className="max-h-20 max-w-full object-contain"
          />
        ) : (
          getFileIcon(`${attachment.tipo_mime}.${ext}`)
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-700 truncate" title={attachment.nome_arquivo}>
          {attachment.nome_arquivo}
        </p>
        <p className="text-xs text-slate-400">
          {formatBytes(attachment.tamanho_bytes)} · {ext.toUpperCase()}
        </p>
      </div>

      {/* Badge de origem */}
      <Badge
        className={`text-xs w-fit ${isByCliente ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}
        variant="secondary"
      >
        {isByCliente ? '👤 Cliente' : `✏️ ${attachment.uploaded_by_name || 'Vendedor'}`}
      </Badge>

      {/* Acoes */}
      <div className="flex gap-1">
        {attachment.onedrive_file_url && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-7 text-xs"
            asChild
          >
            <a href={attachment.onedrive_file_url} target="_blank" rel="noreferrer">
              <ExternalLink size={11} className="mr-1" />
              Abrir
            </a>
          </Button>
        )}
        {!readOnly && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
              onClick={() => setConfirmOpen(true)}
              title="Remover arquivo"
            >
              <Trash2 size={13} />
            </Button>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover arquivo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O arquivo <strong>{attachment.nome_arquivo}</strong> sera removido da proposta.
                    Esta acao pode ser recuperada dentro de 30 dias.
                    {isByCliente && (
                      <span className="block mt-2 text-yellow-700 font-medium">
                        ⚠️ Este arquivo foi enviado pelo cliente.
                      </span>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {deleting ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                    Remover
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  );
}

// =================== componente principal ===================

export function PropostaAttachmentsSection({ propostaId, readOnly = false }: Props) {
  const { data: attachments = [], isLoading, refetch } = usePropostaAttachments(propostaId);
  const { items: uploadItems, addFiles, retryItem, removeFromQueue, clear, isUploading } = useAttachmentsUpload();
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    addFiles(arr, propostaId);
  }, [addFiles, propostaId]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = '';
  }, [handleFiles]);

  // Refetch quando upload termina
  const prevUploadingRef = useRef(false);
  if (prevUploadingRef.current && !isUploading && uploadItems.some((it) => it.status === 'done')) {
    refetch();
  }
  prevUploadingRef.current = isUploading;

  const doneItems = uploadItems.filter((it) => it.status === 'done');
  const pendingItems = uploadItems.filter((it) => it.status !== 'done');
  const totalAnexos = attachments.length;
  const MAX_ATTACHMENTS = 50;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-700 text-sm">
          Arquivos da arte
          {totalAnexos > 0 && (
            <span className="ml-2 text-slate-400 font-normal">({totalAnexos}/{MAX_ATTACHMENTS})</span>
          )}
        </h3>
        {!readOnly && doneItems.length > 0 && (
          <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400" onClick={clear}>
            Limpar concluidos
          </Button>
        )}
      </div>

      {/* Drop-zone (somente editor) */}
      {!readOnly && totalAnexos < MAX_ATTACHMENTS && (
        <div
          ref={dropzoneRef}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
            dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-slate-50'
          }`}
          onClick={() => document.getElementById('attachments-input')?.click()}
        >
          <Upload size={24} className={`mx-auto mb-2 ${dragging ? 'text-blue-500' : 'text-slate-300'}`} />
          <p className="text-sm text-slate-500">
            Arraste arquivos ou <span className="text-blue-600 underline">clique para selecionar</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">
            PDF, AI, CDR, EPS, SVG, JPG, PNG, PSD, ZIP · Ate 150MB por arquivo
          </p>
          <input
            id="attachments-input"
            type="file"
            multiple
            accept=".pdf,.ai,.cdr,.eps,.svg,.jpg,.jpeg,.png,.tiff,.tif,.psd,.webp,.zip,.rar"
            className="hidden"
            onChange={onInputChange}
          />
        </div>
      )}

      {/* Fila de upload */}
      {pendingItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
            Enviando {pendingItems.filter((it) => ['uploading', 'computing_hash', 'generating_preview'].includes(it.status)).length > 0
              ? `(${pendingItems.filter((it) => ['uploading', 'computing_hash', 'generating_preview'].includes(it.status)).length} ativo${pendingItems.filter((it) => ['uploading', 'computing_hash', 'generating_preview'].includes(it.status)).length > 1 ? 's' : ''})`
              : ''}
          </p>
          {pendingItems.map((item) => (
            <UploadQueueItem
              key={item.id}
              item={item}
              onRetry={retryItem}
              onRemove={removeFromQueue}
              propostaId={propostaId}
              addFiles={addFiles}
            />
          ))}
        </div>
      )}

      {/* Grid de anexos existentes */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-slate-300" />
        </div>
      ) : attachments.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {attachments.map((att) => (
            <AttachmentCard
              key={att.id}
              attachment={att}
              readOnly={readOnly}
              onDelete={(id) => {}}
            />
          ))}
        </div>
      ) : !isUploading && uploadItems.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <File size={32} className="mx-auto mb-2 text-slate-200" />
          <p className="text-sm">Nenhum arquivo anexado ainda.</p>
          {!readOnly && (
            <p className="text-xs mt-1">Arraste ou clique acima para enviar.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
