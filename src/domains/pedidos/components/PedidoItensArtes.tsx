/**
 * PedidoItensArtes.tsx
 *
 * Lista todos os itens de um pedido com o ArteUploader em cada um.
 * Permite anexar/trocar/remover a arte do item — preview gerado automaticamente
 * (leve, pra visualizacao no App Campo) e original enviado ao OneDrive.
 *
 * Ao substituir ou remover arte: deleta o arquivo antigo do OneDrive (silencioso em erro).
 */

import { Package, Ruler } from 'lucide-react'
import { ArteUploader, type ArteAtual } from '@/components/arte/ArteUploader'
import { usePedidoItens, useUpdatePedidoItem } from '../hooks/usePedidoItens'
import { supabase } from '@/integrations/supabase/client'
import { brl } from '@/shared/utils/format'
import { showError, showSuccess } from '@/utils/toast'
import type { ArteUploadResult } from '@/hooks/useArteUpload'

type Props = {
  pedidoId: string
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

async function deletarArteOneDrive(fileId: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    await fetch(`${SUPABASE_URL}/functions/v1/onedrive-delete-file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ fileId }),
    })
  } catch (err) {
    console.warn('[PedidoItensArtes] falha ao deletar arte antiga do OneDrive:', err)
  }
}

export function PedidoItensArtes({ pedidoId }: Props) {
  const { data: itens = [], isLoading } = usePedidoItens(pedidoId)
  const update = useUpdatePedidoItem()

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <p className="text-slate-400 text-sm">Carregando itens…</p>
      </div>
    )
  }

  if (itens.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <Package size={40} className="mx-auto text-slate-300 mb-3" />
        <h3 className="font-semibold text-slate-600">Nenhum item neste pedido</h3>
        <p className="text-sm text-slate-400 mt-1">
          Itens aparecem aqui quando o pedido e criado a partir de uma proposta
        </p>
      </div>
    )
  }

  async function handleUploaded(
    itemId: string,
    itemAtualOneDriveId: string | null | undefined,
    result: ArteUploadResult,
  ) {
    const { data: userData } = await supabase.auth.getUser()

    // Deletar arquivo antigo no OneDrive se existir (silencioso em erro)
    if (itemAtualOneDriveId) {
      await deletarArteOneDrive(itemAtualOneDriveId)
    }

    await update.mutateAsync({
      id: itemId,
      arte_url: result.arte_url,
      arte_preview_url: result.arte_preview_url,
      arte_nome_original: result.arte_nome_original,
      arte_tamanho_bytes: result.arte_tamanho_bytes,
      arte_mime: result.arte_mime,
      arte_onedrive_file_id: result.arte_onedrive_file_id,
      arte_uploaded_at: new Date().toISOString(),
      arte_uploaded_by: userData.user?.id ?? null,
    })
  }

  async function handleRemove(itemId: string, itemOneDriveId: string | null | undefined) {
    try {
      // Deletar do OneDrive antes de limpar os campos (silencioso em erro)
      if (itemOneDriveId) {
        await deletarArteOneDrive(itemOneDriveId)
      }

      await update.mutateAsync({
        id: itemId,
        arte_url: null,
        arte_preview_url: null,
        arte_nome_original: null,
        arte_tamanho_bytes: null,
        arte_mime: null,
        arte_onedrive_file_id: null,
        arte_uploaded_at: null,
        arte_uploaded_by: null,
      })
      showSuccess('Arte removida do item')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao remover arte'
      showError(msg)
    }
  }

  return (
    <div className="space-y-4">
      {itens.map((item, idx) => {
        const arteAtual: ArteAtual = {
          arte_url: item.arte_url,
          arte_preview_url: item.arte_preview_url,
          arte_nome_original: item.arte_nome_original,
          arte_tamanho_bytes: item.arte_tamanho_bytes,
          arte_mime: item.arte_mime,
          arte_onedrive_file_id: item.arte_onedrive_file_id,
        }

        return (
          <div
            key={item.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"
          >
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Info do item */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                        {idx + 1}
                      </span>
                      <h3 className="font-semibold text-slate-800">{item.descricao}</h3>
                    </div>
                    {item.especificacao && (
                      <p className="text-sm text-slate-500 mt-1 ml-8">{item.especificacao}</p>
                    )}
                  </div>
                  {item.valor_total != null && (
                    <p className="font-semibold text-slate-800 whitespace-nowrap">
                      {brl(item.valor_total)}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600 ml-8">
                  <span>
                    <strong className="text-slate-500">Qtd:</strong> {item.quantidade}{' '}
                    {item.unidade || ''}
                  </span>
                  {item.largura_cm && item.altura_cm && (
                    <span className="inline-flex items-center gap-1">
                      <Ruler size={12} />
                      {item.largura_cm} × {item.altura_cm} cm
                    </span>
                  )}
                  <span>
                    <strong className="text-slate-500">Status:</strong>{' '}
                    <span className="capitalize">{item.status.replace(/_/g, ' ')}</span>
                  </span>
                </div>

                {item.instrucoes && (
                  <p className="text-xs text-slate-500 mt-2 ml-8 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
                    <strong>Instrucoes:</strong> {item.instrucoes}
                  </p>
                )}
              </div>

              {/* Uploader */}
              <div className="lg:w-[380px] lg:shrink-0">
                <ArteUploader
                  scope="pedido"
                  entityId={item.pedido_id}
                  itemId={item.id}
                  atual={arteAtual}
                  onUploaded={(result) => handleUploaded(item.id, item.arte_onedrive_file_id, result)}
                  onRemove={() => handleRemove(item.id, item.arte_onedrive_file_id)}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
