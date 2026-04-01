import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { showSuccess, showError } from '@/utils/toast'

export type CampanhaStatus = 'ativa' | 'pausada' | 'encerrada'
export type CampanhaOrigem = 'google_ads' | 'instagram' | 'facebook' | 'email' | 'whatsapp' | 'outro'

export interface Campanha {
  id: string
  nome: string
  descricao: string | null
  origem: CampanhaOrigem
  status: CampanhaStatus
  orcamento: number
  inicio: string
  fim: string | null
  leads_gerados: number
  conversoes: number
  excluido_em: string | null
  created_at: string
}

const KEY = 'campanhas'

export function useCampanhas() {
  return useQuery({
    queryKey: [KEY],
    queryFn: async (): Promise<Campanha[]> => {
      const { data, error } = await supabase
        .from('campanhas')
        .select('*')
        .is('excluido_em', null)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as Campanha[]
    },
    staleTime: 1000 * 60 * 2,
  })
}

export function useCriarCampanha() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<Campanha, 'id' | 'excluido_em' | 'created_at' | 'leads_gerados' | 'conversoes'>) => {
      const { data, error } = await supabase
        .from('campanhas')
        .insert({ ...input, leads_gerados: 0, conversoes: 0 })
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [KEY] }); showSuccess('Campanha criada!') },
    onError: (e: Error) => showError(e.message),
  })
}

export function useExcluirCampanha() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('campanhas')
        .update({ excluido_em: new Date().toISOString() })
        .eq('id', id)
        .select('id')
        .single()
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [KEY] }); showSuccess('Campanha excluída!') },
    onError: (e: Error) => showError(e.message),
  })
}

export function useAtualizarCampanha() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Campanha> & { id: string }) => {
      const { error } = await supabase
        .from('campanhas')
        .update(updates)
        .eq('id', id)
        .select('id')
        .single()
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [KEY] }); showSuccess('Campanha atualizada!') },
    onError: (e: Error) => showError(e.message),
  })
}

export function useDestinatariosCampanha(campanhaId: string | undefined) {
  return useQuery({
    queryKey: ['campanha-destinatarios', campanhaId],
    queryFn: async () => {
      if (!campanhaId) return [];
      const { data, error } = await supabase
        .from('campanha_destinatarios')
        .select('*')
        .eq('campanha_id', campanhaId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!campanhaId,
  });
}

export function useAdicionarDestinatarios() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      campanhaId,
      destinatarios,
    }: {
      campanhaId: string;
      destinatarios: { nome: string; email: string; cliente_id?: string; lead_id?: string }[];
    }) => {
      const rows = destinatarios.map(d => ({
        campanha_id: campanhaId,
        ...d,
      }));
      const { error } = await supabase.from('campanha_destinatarios').insert(rows);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['campanha-destinatarios', vars.campanhaId] });
    },
  });
}

export function useDispararCampanha() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (campanhaId: string) => {
      const { data, error } = await supabase.functions.invoke('enviar-email-campanha', {
        body: { campanha_id: campanhaId },
      });
      if (error) throw error;
      return data as { enviados: number; erros: number; demo?: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campanhas'] });
      queryClient.invalidateQueries({ queryKey: ['campanha-destinatarios'] });
    },
  });
}
