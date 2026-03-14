import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AtividadeTipo = 'ligacao' | 'email' | 'visita' | 'reuniao' | 'whatsapp' | 'nota';

export interface AtividadeComercial {
  id: string;
  tipo: AtividadeTipo;
  entidade_tipo: string; // lead, oportunidade, cliente
  entidade_id: string;
  descricao: string;
  data_atividade: string;
  duracao_minutos: number | null;
  resultado: string | null;
  proximo_passo: string | null;
  autor_id: string | null;
  created_at: string;
}

export interface AtividadeCreate {
  tipo: AtividadeTipo;
  entidade_tipo: string;
  entidade_id: string;
  descricao: string;
  data_atividade?: string;
  duracao_minutos?: number | null;
  resultado?: string | null;
  proximo_passo?: string | null;
  autor_id?: string | null;
}

// ─── Query Keys ─────────────────────────────────────────────────────────────

const ATIVIDADES_KEY = ['comercial', 'atividades'] as const;

function atividadesQueryKey(entidadeTipo: string, entidadeId: string) {
  return [...ATIVIDADES_KEY, entidadeTipo, entidadeId];
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Lista atividades comerciais de uma entidade (lead, oportunidade, cliente).
 */
export function useAtividades(entidadeTipo: string, entidadeId: string | undefined) {
  return useQuery({
    queryKey: atividadesQueryKey(entidadeTipo, entidadeId ?? ''),
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<AtividadeComercial[]> => {
      if (!entidadeId) return [];
      const { data, error } = await supabase
        .from('atividades_comerciais')
        .select('id, tipo, entidade_tipo, entidade_id, descricao, data_atividade, duracao_minutos, resultado, proximo_passo, autor_id, created_at')
        .eq('entidade_tipo', entidadeTipo)
        .eq('entidade_id', entidadeId)
        .order('data_atividade', { ascending: false });
      if (error) throw new Error(`Erro ao buscar atividades: ${error.message}`);
      return (data ?? []) as AtividadeComercial[];
    },
    enabled: !!entidadeId,
  });
}

/**
 * Lista atividades recentes (global — para dashboard).
 */
export function useAtividadesRecentes(limit = 20) {
  return useQuery({
    queryKey: [...ATIVIDADES_KEY, 'recentes', limit],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<AtividadeComercial[]> => {
      const { data, error } = await supabase
        .from('atividades_comerciais')
        .select('id, tipo, entidade_tipo, entidade_id, descricao, data_atividade, duracao_minutos, resultado, proximo_passo, autor_id, created_at')
        .order('data_atividade', { ascending: false })
        .limit(limit);
      if (error) throw new Error(`Erro ao buscar atividades recentes: ${error.message}`);
      return (data ?? []) as AtividadeComercial[];
    },
  });
}

/**
 * Registra uma nova atividade comercial.
 */
export function useCreateAtividade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AtividadeCreate): Promise<AtividadeComercial> => {
      const { data, error } = await supabase
        .from('atividades_comerciais')
        .insert({
          ...payload,
          data_atividade: payload.data_atividade || new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw new Error(`Erro ao registrar atividade: ${error.message}`);
      return data as AtividadeComercial;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: atividadesQueryKey(variables.entidade_tipo, variables.entidade_id),
      });
      queryClient.invalidateQueries({ queryKey: [...ATIVIDADES_KEY, 'recentes'] });
      showSuccess('Atividade registrada');
    },
    onError: (error: Error) => showError(error.message),
  });
}
