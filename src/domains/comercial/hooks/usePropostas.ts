import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { showSuccess, showError } from '@/utils/toast'
import { ilikeTerm } from '@/shared/utils/searchUtils'

// ─── Types ──────────────────────────────────────────────────────────────────

export type PropostaStatus =
  | 'rascunho'
  | 'enviada'
  | 'em_negociacao'
  | 'aprovada'
  | 'recusada'
  | 'expirada'

export interface Proposta {
  id: string
  numero: string | null
  titulo: string
  cliente_id: string | null
  vendedor_id: string | null
  status: PropostaStatus
  valor_estimado: number
  probabilidade: number
  validade_dias: number
  descricao: string | null
  observacoes: string | null
  excluido_em: string | null
  excluido_por: string | null
  created_at: string
  updated_at: string
  // joined
  clientes?: { nome_fantasia: string | null; razao_social: string | null } | null
  profiles?: { full_name: string | null } | null
}

export interface PropostaFilters {
  status?: PropostaStatus | 'todos'
  search?: string
}

// ─── Keys ────────────────────────────────────────────────────────────────────

const KEY = 'propostas'

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Lista propostas com filtros opcionais. Exclui soft-deleted.
 */
export function usePropostas(filtros?: PropostaFilters) {
  return useQuery({
    queryKey: [KEY, filtros],
    queryFn: async (): Promise<Proposta[]> => {
      let q = supabase
        .from('propostas')
        .select('*, clientes(nome_fantasia, razao_social), profiles!vendedor_id(full_name)')
        .is('excluido_em', null)
        .order('created_at', { ascending: false })

      if (filtros?.status && filtros.status !== 'todos') {
        q = q.eq('status', filtros.status)
      }
      if (filtros?.search) {
        q = q.ilike('titulo', ilikeTerm(filtros.search))
      }

      const { data, error } = await q
      if (error) throw new Error(error.message)
      return (data ?? []) as Proposta[]
    },
    staleTime: 1000 * 60 * 2,
  })
}

/**
 * Cria nova proposta.
 */
export function useCriarProposta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      titulo: string
      cliente_id?: string
      valor_estimado?: number
      probabilidade?: number
      descricao?: string
    }) => {
      const { data, error } = await supabase
        .from('propostas')
        .insert(input)
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] })
      showSuccess('Proposta criada!')
    },
    onError: (e: Error) => showError(e.message),
  })
}

/**
 * Converte uma proposta aprovada em pedido.
 * Insere o pedido, linkando proposta_id e copiando cliente_id / valor_total.
 * A proposta NÃO precisa de pedido_id — o vínculo é por pedidos.proposta_id.
 */
export function useConverterPropostaEmPedido() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (proposta: {
      id: string
      cliente_id: string | null
      valor_estimado: number
      total?: number
    }) => {
      if (!proposta.cliente_id) {
        throw new Error('Proposta sem cliente vinculado. Associe um cliente antes de converter.')
      }
      // Verifica idempotência: já existe pedido vinculado a esta proposta?
      const { data: existing } = await supabase
        .from('pedidos')
        .select('id')
        .eq('proposta_id', proposta.id)
        .maybeSingle()
      if (existing) {
        throw new Error('Já existe um pedido vinculado a esta proposta.')
      }
      const { data, error } = await supabase
        .from('pedidos')
        .insert({
          proposta_id: proposta.id,
          cliente_id: proposta.cliente_id,
          valor_total: proposta.total ?? proposta.valor_estimado ?? 0,
          status: 'aprovado',
          observacoes: 'Pedido gerado manualmente a partir de proposta aprovada.',
        })
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data as { id: string; numero: string | null }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] })
      qc.invalidateQueries({ queryKey: ['pedidos'] })
    },
    onError: (e: Error) => showError(e.message),
  })
}

/**
 * Verifica se uma proposta já possui pedido vinculado.
 */
export function usePedidoDaProposta(propostaId: string | null) {
  return useQuery({
    queryKey: ['pedido-da-proposta', propostaId],
    enabled: !!propostaId,
    staleTime: 1000 * 60,
    queryFn: async () => {
      if (!propostaId) return null
      const { data } = await supabase
        .from('pedidos')
        .select('id, numero')
        .eq('proposta_id', propostaId)
        .maybeSingle()
      return data as { id: string; numero: string | null } | null
    },
  })
}

/**
 * Soft-delete de proposta.
 */
export function useExcluirProposta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId?: string }) => {
      const { error } = await supabase
        .from('propostas')
        .update({
          excluido_em: new Date().toISOString(),
          excluido_por: userId ?? null,
        })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] })
      showSuccess('Proposta excluída!')
    },
    onError: (e: Error) => showError(e.message),
  })
}
