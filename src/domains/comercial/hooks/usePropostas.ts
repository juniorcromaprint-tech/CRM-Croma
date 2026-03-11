import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { showSuccess, showError } from '@/utils/toast'

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
  created_at: string
  clientes?: { nome_fantasia: string | null; razao_social: string } | null
}

export interface PropostaCreateInput {
  titulo: string
  cliente_id?: string
  valor_estimado?: number
  probabilidade?: number
  descricao?: string
  observacoes?: string
}

export interface PropostaFilters {
  status?: PropostaStatus | 'todos'
  search?: string
}

// ─── Query Keys ─────────────────────────────────────────────────────────────

const KEY = 'propostas'

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function usePropostas(filtros?: PropostaFilters) {
  return useQuery({
    queryKey: [KEY, filtros],
    queryFn: async (): Promise<Proposta[]> => {
      let q = supabase
        .from('propostas')
        .select('*, clientes(nome_fantasia, razao_social)')
        .is('excluido_em', null)
        .order('created_at', { ascending: false })
      if (filtros?.status && filtros.status !== 'todos') {
        q = q.eq('status', filtros.status)
      }
      if (filtros?.search) {
        q = q.ilike('titulo', `%${filtros.search}%`)
      }
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return (data ?? []) as Proposta[]
    },
    staleTime: 1000 * 60 * 2,
  })
}

export function useCriarProposta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: PropostaCreateInput) => {
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
      showSuccess('Proposta criada com sucesso!')
    },
    onError: (e: Error) => showError(e.message),
  })
}

export function useExcluirProposta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId?: string }) => {
      const { error } = await supabase
        .from('propostas')
        .update({ excluido_em: new Date().toISOString(), excluido_por: userId ?? null })
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
