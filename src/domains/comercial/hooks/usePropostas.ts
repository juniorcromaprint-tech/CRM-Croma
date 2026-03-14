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
        .select('*, clientes(nome_fantasia, razao_social), profiles(full_name)')
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
