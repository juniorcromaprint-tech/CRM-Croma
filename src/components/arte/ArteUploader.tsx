/**
 * ArteUploader.tsx
 *
 * Uploader completo de arte para itens de pedido/proposta:
 *  - Drag-and-drop ou clique para selecionar (PDF/PNG/JPG/WEBP)
 *  - Gera preview JPG leve client-side (pdfjs para PDF)
 *  - Upload paralelo de original + preview para o bucket publico job-attachments
 *  - Persiste as URLs e metadados no item (via callback onUploaded)
 *  - Mostra preview atual com opcoes de abrir original, substituir ou remover
 */

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { ImageIcon, Upload, Loader2, ExternalLink, Trash2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { showError, showSuccess } from '@/utils/toast'
import {
  useArteUpload,
  type ArteUploadResult,
  type ArteUploadScope,
} from '@/hooks/useArteUpload'
import { FORMATOS_SUPORTADOS_ARTE } from '@/lib/arte-preview'

export type ArteAtual = {
  arte_url?: string | null
  arte_preview_url?: string | null
  arte_nome_original?: string | null
  arte_tamanho_bytes?: number | null
  arte_mime?: string | null
}

type ArteUploaderProps = {
  scope: ArteUploadScope
  entityId: string
  itemId: string
  atual?: ArteAtual | null
  onUploaded: (result: ArteUploadResult) => void | Promise<void>
  onRemove?: () => void | Promise<void>
  /** Ativar o modo compacto (thumbnail pequeno em linha) */
  compact?: boolean
  /** Desabilita o componente */
  disabled?: boolean
}

function formatarTamanho(bytes?: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ArteUploader({
  scope,
  entityId,
  itemId,
  atual,
  onUploaded,
  onRemove,
  compact = false,
  disabled = false,
}: ArteUploaderProps) {
  const { upload, uploading, progress } = useArteUpload()
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const temArte = Boolean(atual?.arte_preview_url || atual?.arte_url)

  const onDrop = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      const file = files[0]
      try {
        const result = await upload({ file, scope, entityId, itemId })
        await onUploaded(result)
        showSuccess('Arte enviada com preview gerado')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao enviar arte'
        showError(msg)
      }
    },
    [upload, scope, entityId, itemId, onUploaded],
  )

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    multiple: false,
    disabled: disabled || uploading,
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
    },
    maxFiles: 1,
  })

  const labelProgresso =
    progress.stage === 'gerando_preview'
      ? 'Gerando preview...'
      : progress.stage === 'enviando_original'
        ? 'Enviando original...'
        : progress.stage === 'enviando_preview'
          ? 'Enviando preview...'
          : 'Processando...'

  // --- Modo compacto (thumbnail pequeno) ----------------------------------
  if (compact) {
    if (temArte) {
      return (
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 hover:ring-2 hover:ring-blue-500 transition"
              onClick={() => setLightboxOpen(true)}
              title="Visualizar arte"
            >
              <img
                src={atual!.arte_preview_url || atual!.arte_url!}
                alt="Preview da arte"
                className="h-full w-full object-cover"
              />
            </button>
            <div className="flex flex-col gap-1 text-xs text-slate-600">
              <span className="truncate max-w-[12ch]" title={atual?.arte_nome_original || ''}>
                {atual?.arte_nome_original || 'arte'}
              </span>
              <div className="flex gap-1">
                {atual?.arte_url && (
                  <a
                    href={atual.arte_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                    title="Baixar original"
                  >
                    <ExternalLink size={12} className="inline" /> orig
                  </a>
                )}
                <button
                  type="button"
                  onClick={open}
                  disabled={uploading}
                  className="text-slate-500 hover:text-slate-700 disabled:opacity-50"
                  title="Substituir"
                >
                  <Upload size={12} className="inline" /> trocar
                </button>
                {onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove()}
                    disabled={uploading}
                    className="text-red-500 hover:text-red-700 disabled:opacity-50"
                    title="Remover"
                  >
                    <Trash2 size={12} className="inline" />
                  </button>
                )}
              </div>
            </div>
            <input {...getInputProps()} />
          </div>
          <LightboxArte
            open={lightboxOpen}
            onOpenChange={setLightboxOpen}
            previewUrl={atual!.arte_preview_url || atual!.arte_url!}
            originalUrl={atual?.arte_url || null}
            nome={atual?.arte_nome_original || 'Arte'}
          />
        </>
      )
    }

    return (
      <div
        {...getRootProps()}
        className={`flex items-center gap-2 rounded-xl border-2 border-dashed px-3 py-2 cursor-pointer text-xs transition ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 hover:border-slate-400 bg-slate-50'
        } ${disabled || uploading ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <>
            <Loader2 size={16} className="animate-spin text-blue-600" />
            <span className="text-slate-700">{labelProgresso}</span>
          </>
        ) : (
          <>
            <ImageIcon size={16} className="text-slate-500" />
            <span className="text-slate-600">
              {isDragActive ? 'Solte aqui' : 'Anexar arte'}
            </span>
          </>
        )}
      </div>
    )
  }

  // --- Modo completo (card) -----------------------------------------------
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ImageIcon size={18} className="text-slate-500" />
          <h3 className="font-semibold text-slate-800">Arte do item</h3>
        </div>
        {temArte && atual?.arte_url && (
          <a
            href={atual.arte_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            <ExternalLink size={14} /> Baixar original
          </a>
        )}
      </div>

      {temArte ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 hover:ring-2 hover:ring-blue-500 transition"
          >
            <img
              src={atual!.arte_preview_url || atual!.arte_url!}
              alt="Preview da arte"
              className="w-full max-h-[480px] object-contain bg-white"
            />
          </button>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <FileText size={14} />
              <span>
                {atual?.arte_nome_original || 'arquivo'}
                {atual?.arte_tamanho_bytes ? ` · ${formatarTamanho(atual.arte_tamanho_bytes)}` : ''}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={open}
                disabled={uploading || disabled}
              >
                {uploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-1" /> {labelProgresso}
                  </>
                ) : (
                  <>
                    <Upload size={14} className="mr-1" /> Substituir
                  </>
                )}
              </Button>
              {onRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove()}
                  disabled={uploading}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 size={14} className="mr-1" /> Remover
                </Button>
              )}
            </div>
          </div>

          <input {...getInputProps()} />

          <LightboxArte
            open={lightboxOpen}
            onOpenChange={setLightboxOpen}
            previewUrl={atual!.arte_preview_url || atual!.arte_url!}
            originalUrl={atual?.arte_url || null}
            nome={atual?.arte_nome_original || 'Arte'}
          />
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition ${
            isDragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-300 hover:border-slate-400 bg-slate-50'
          } ${disabled || uploading ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <>
              <Loader2 size={32} className="mx-auto text-blue-600 animate-spin mb-2" />
              <p className="text-sm font-medium text-slate-700">{labelProgresso}</p>
              <p className="text-xs text-slate-500 mt-1">
                Nao feche esta pagina enquanto o upload termina
              </p>
            </>
          ) : (
            <>
              <Upload size={32} className="mx-auto text-slate-400 mb-2" />
              <p className="text-sm font-medium text-slate-700">
                {isDragActive ? 'Solte o arquivo aqui' : 'Arraste o arquivo ou clique para escolher'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Formatos aceitos: {FORMATOS_SUPORTADOS_ARTE.join(', ')} — o preview e gerado
                automaticamente
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// --- Lightbox para visualizacao ------------------------------------------

function LightboxArte({
  open,
  onOpenChange,
  previewUrl,
  originalUrl,
  nome,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  previewUrl: string
  originalUrl: string | null
  nome: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogTitle className="text-slate-800">{nome}</DialogTitle>
        <div className="overflow-auto max-h-[80vh]">
          <img src={previewUrl} alt={nome} className="w-full h-auto" />
        </div>
        {originalUrl && (
          <div className="flex justify-end pt-2">
            <a
              href={originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              <ExternalLink size={14} /> Abrir arquivo original
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
