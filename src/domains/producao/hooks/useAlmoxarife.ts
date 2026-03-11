import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { showSuccess, showError } from '@/utils/toast'

export interface Ferramenta {
  id: string
  nome: string
  descricao: string | null
  em_uso: boolean
  pedido_id_atual: string | null
  created_at: string
}

export interface CheckoutAlmoxarife {
  id: string
  ferramenta_id: string
  pedido_id: string | null
  usuario_id: string | null
  saida_em: string
  retorno_em: string | null
  observacoes: string | null
  created_at: string
  ferramentas?: { nome: string } | null
  pedidos?: { numero: string | null } | null
  profiles?: { full_name: string | null } | null
}

/** Lista todas as ferramentas */
export function useFerramentas() {
  return useQuery({
    queryKey: ['ferramentas'],
    queryFn: async (): Promise<Ferramenta[]> => {
      const { data, error } = await supabase
        .from('ferramentas')
        .select('*')
        .order('nome')
      if (error) throw new Error(error.message)
      return (data ?? []) as Ferramenta[]
    },
    staleTime: 1000 * 60 * 2,
  })
}

/** Lista checkouts (histórico), opcionalmente filtrando por ferramenta */
export function useCheckouts(ferramentaId?: string) {
  return useQuery({
    queryKey: ['checkouts', ferramentaId],
    queryFn: async (): Promise<CheckoutAlmoxarife[]> => {
      let q = supabase
        .from('checkout_almoxarife')
        .select('*, ferramentas(nome), pedidos(numero), profiles(full_name)')
        .order('saida_em', { ascending: false })
      if (ferramentaId) q = q.eq('ferramenta_id', ferramentaId)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return (data ?? []) as CheckoutAlmoxarife[]
    },
    staleTime: 1000 * 60 * 2,
  })
}

/** Faz checkout (marca ferramenta como em uso) */
export function useCheckoutFerramenta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      ferramenta_id: string
      pedido_id?: string
      usuario_id?: string
      observacoes?: string
    }) => {
      // 1. Insert checkout record
      const { error: err1 } = await supabase
        .from('checkout_almoxarife')
        .insert({ ...input, saida_em: new Date().toISOString() })
      if (err1) throw new Error(err1.message)
      // 2. Update ferramenta em_uso
      const { error: err2 } = await supabase
        .from('ferramentas')
        .update({ em_uso: true, pedido_id_atual: input.pedido_id ?? null })
        .eq('id', input.ferramenta_id)
      if (err2) throw new Error(err2.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ferramentas'] })
      qc.invalidateQueries({ queryKey: ['checkouts'] })
      showSuccess('Ferramenta retirada!')
    },
    onError: (e: Error) => showError(e.message),
  })
}

/** Devolve ferramenta (preenche retorno_em) */
export function useDevolverFerramenta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      checkoutId,
      ferramentaId,
    }: {
      checkoutId: string
      ferramentaId: string
    }) => {
      const { error: err1 } = await supabase
        .from('checkout_almoxarife')
        .update({ retorno_em: new Date().toISOString() })
        .eq('id', checkoutId)
      if (err1) throw new Error(err1.message)
      const { error: err2 } = await supabase
        .from('ferramentas')
        .update({ em_uso: false, pedido_id_atual: null })
        .eq('id', ferramentaId)
      if (err2) throw new Error(err2.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ferramentas'] })
      qc.invalidateQueries({ queryKey: ['checkouts'] })
      showSuccess('Ferramenta devolvida!')
    },
    onError: (e: Error) => showError(e.message),
  })
}
