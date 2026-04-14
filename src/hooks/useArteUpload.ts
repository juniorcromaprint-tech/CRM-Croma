/**
 * useArteUpload.ts
 *
 * Faz upload paralelo do arquivo ORIGINAL + PREVIEW gerado client-side
 * para o bucket publico `job-attachments`. Retorna as URLs publicas.
 *
 * Caminho no storage:
 *   job-attachments/artes/<scope>/<entityId>/<itemId>/original_<ts>.<ext>
 *   job-attachments/artes/<scope>/<entityId>/<itemId>/preview_<ts>.jpg
 *
 * Scope: 'pedido' | 'proposta'
 */

import { useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { gerarPreviewArte, type PreviewResult } from '@/lib/arte-preview'

const BUCKET = 'job-attachments'

export type ArteUploadScope = 'pedido' | 'proposta'

export type ArteUploadResult = {
  arte_url: string
  arte_preview_url: string
  arte_nome_original: string
  arte_tamanho_bytes: number
  arte_mime: string
  preview: PreviewResult
}

export type ArteUploadProgress = {
  stage: 'gerando_preview' | 'enviando_original' | 'enviando_preview' | 'concluido' | 'erro'
  message?: string
}

function sanitizarNome(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120)
}

function extrairExtensao(name: string, mime: string): string {
  const m = name.match(/\.([a-zA-Z0-9]+)$/)
  if (m) return m[1].toLowerCase()
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/webp') return 'webp'
  return 'bin'
}

export function useArteUpload() {
  const [progress, setProgress] = useState<ArteUploadProgress>({ stage: 'concluido' })
  const [uploading, setUploading] = useState(false)

  const upload = useCallback(
    async (params: {
      file: File
      scope: ArteUploadScope
      entityId: string
      itemId: string
    }): Promise<ArteUploadResult> => {
      const { file, scope, entityId, itemId } = params
      setUploading(true)
      try {
        setProgress({ stage: 'gerando_preview' })
        const preview = await gerarPreviewArte(file)

        const ts = Date.now()
        const ext = extrairExtensao(file.name, file.type)
        const baseDir = `artes/${scope}/${entityId}/${itemId}`
        const originalPath = `${baseDir}/original_${ts}_${sanitizarNome(file.name)}`
        const previewPath = `${baseDir}/preview_${ts}.jpg`

        setProgress({ stage: 'enviando_original' })
        const uploadOriginal = supabase.storage
          .from(BUCKET)
          .upload(originalPath, file, {
            cacheControl: '3600',
            upsert: true,
            contentType: file.type || `application/${ext}`,
          })

        setProgress({ stage: 'enviando_preview' })
        const uploadPreview = supabase.storage
          .from(BUCKET)
          .upload(previewPath, preview.blob, {
            cacheControl: '3600',
            upsert: true,
            contentType: 'image/jpeg',
          })

        const [origRes, prevRes] = await Promise.all([uploadOriginal, uploadPreview])

        if (origRes.error) throw origRes.error
        if (prevRes.error) throw prevRes.error

        const { data: origUrl } = supabase.storage.from(BUCKET).getPublicUrl(originalPath)
        const { data: prevUrl } = supabase.storage.from(BUCKET).getPublicUrl(previewPath)

        setProgress({ stage: 'concluido' })
        return {
          arte_url: origUrl.publicUrl,
          arte_preview_url: prevUrl.publicUrl,
          arte_nome_original: file.name,
          arte_tamanho_bytes: file.size,
          arte_mime: file.type || `application/${ext}`,
          preview,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha no upload'
        setProgress({ stage: 'erro', message })
        throw error
      } finally {
        setUploading(false)
      }
    },
    [],
  )

  return { upload, progress, uploading }
}
