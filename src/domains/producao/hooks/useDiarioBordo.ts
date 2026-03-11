import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { showSuccess, showError } from '@/utils/toast'

export type ManutencaoTipo = 'preventiva' | 'corretiva' | 'limpeza' | 'calibracao'

export interface DiarioBordoEntry {
  id: string
  ferramenta_id: string
  tipo: ManutencaoTipo
  descricao: string
  realizado_por: string | null
  custo: number | null
  proxima_manutencao: string | null
  created_at: string
  ferramentas?: { nome: string } | null
  profiles?: { full_name: string | null } | null
}

export function useDiarioBordo(ferramentaId?: string) {
  return useQuery({
    queryKey: ['diario_bordo', ferramentaId],
    queryFn: async (): Promise<DiarioBordoEntry[]> => {
      let q = supabase
        .from('diario_bordo')
        .select('*, ferramentas(nome), profiles(full_name)')
        .order('created_at', { ascending: false })
      if (ferramentaId) q = q.eq('ferramenta_id', ferramentaId)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return (data ?? []) as DiarioBordoEntry[]
    },
    staleTime: 1000 * 60 * 2,
  })
}

export function useRegistrarManutencao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      ferramenta_id: string
      tipo: ManutencaoTipo
      descricao: string
      realizado_por?: string
      custo?: number
      proxima_manutencao?: string
    }) => {
      const { error } = await supabase.from('diario_bordo').insert(input)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diario_bordo'] })
      showSuccess('Manutenção registrada!')
    },
    onError: (e: Error) => showError(e.message),
  })
}
