import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { showSuccess, showError } from '@/utils/toast'

export function useCriarPastaOneDrive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (pedidoId: string) => {
      const { data, error } = await supabase.functions.invoke('onedrive-criar-pasta', {
        body: { pedido_id: pedidoId },
      })
      if (error) throw new Error(error.message)
      return data as { folder_id: string; folder_url: string }
    },
    onSuccess: (_data, pedidoId) => {
      qc.invalidateQueries({ queryKey: ['pedidos', 'detail', pedidoId] })
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      showSuccess('Pasta OneDrive criada com sucesso!')
    },
    onError: (err: Error) => showError(`Erro ao criar pasta: ${err.message}`),
  })
}
