/**
 * useArteUpload.ts (v2 - 2026-04-14)
 *
 * Faz upload paralelo:
 *  - ORIGINAL: via Edge Function onedrive-upload-interno -> OneDrive na pasta do cliente
 *  - PREVIEW JPEG leve: Supabase Storage bucket job-attachments (pra thumbnail)
 *
 * Sem limite de tamanho (OneDrive aguenta arquivos grandes via chunked upload na edge).
 * Retorna URLs + fileId do OneDrive (necessario pra deletar ao substituir).
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
  arte_onedrive_file_id: string
  preview: PreviewResult
}

export type ArteUploadProgress = {
  stage: 'gerando_preview' | 'enviando' | 'concluido' | 'erro'
  message?: string
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
        const baseDir = `artes/${scope}/${entityId}/${itemId}`
        const previewPath = `${baseDir}/preview_${ts}.jpg`

        setProgress({ stage: 'enviando' })

        // Preview no Storage (leve, para thumbnail no App Campo)
        const uploadPreview = supabase.storage
          .from(BUCKET)
          .upload(previewPath, preview.blob, {
            cacheControl: '3600',
            upsert: true,
            contentType: 'image/jpeg',
          })

        // Original no OneDrive via Edge Function (sem limite de tamanho)
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) throw new Error('Sessao expirada, faca login novamente')

        const formData = new FormData()
        formData.append('file', file)
        formData.append('scope', scope)
        formData.append('entityId', entityId)

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
        const uploadOriginal = fetch(
          `${supabaseUrl}/functions/v1/onedrive-upload-interno`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: formData,
          }
        )

        const [prevRes, origRes] = await Promise.all([uploadPreview, uploadOriginal])

        if (prevRes.error) throw prevRes.error
        if (!origRes.ok) {
          const err = await origRes.json().catch(() => ({}))
          throw new Error((err as { error?: string }).error || `Upload OneDrive falhou (${origRes.status})`)
        }

        const origData = await origRes.json() as { webUrl?: string; fileId?: string }
        if (!origData.webUrl || !origData.fileId) {
          throw new Error('Resposta do OneDrive incompleta')
        }

        const { data: prevUrl } = supabase.storage.from(BUCKET).getPublicUrl(previewPath)

        setProgress({ stage: 'concluido' })
        return {
          arte_url: origData.webUrl,
          arte_preview_url: prevUrl.publicUrl,
          arte_nome_original: file.name,
          arte_tamanho_bytes: file.size,
          arte_mime: file.type || 'application/octet-stream',
          arte_onedrive_file_id: origData.fileId,
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
