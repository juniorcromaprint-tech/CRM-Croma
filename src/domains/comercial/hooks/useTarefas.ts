import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

// ─── Types ──────────────────────────────────────────────────────────────────

export type TarefaTipo = 'follow_up' | 'visita' | 'ligacao' | 'enviar_proposta' | 'outro';
export type TarefaStatus = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
export type TarefaPrioridade = 'baixa' | 'normal' | 'alta' | 'urgente';

export interface TarefaComercial {
  id: string;
  tipo: TarefaTipo;
  titulo: string;
  descricao: string | null;
  entidade_tipo: string | null;
  entidade_id: string | null;
  responsavel_id: string | null;
  data_prevista: string;
  data_conclusao: string | null;
  status: TarefaStatus;
  prioridade: TarefaPrioridade;
  created_at: string;
}

export interface TarefaCreate {
  tipo?: TarefaTipo;
  titulo: string;
  descricao?: string | null;
  entidade_tipo?: string | null;
  entidade_id?: string | null;
  responsavel_id?: string | null;
  data_prevista: string;
  status?: TarefaStatus;
  prioridade?: TarefaPrioridade;
}

export interface TarefaUpdate extends Partial<TarefaCreate> {
  id: string;
  data_conclusao?: string | null;
}

// ─── Query Keys ─────────────────────────────────────────────────────────────

const TAREFAS_KEY = ['comercial', 'tarefas'] as const;

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Lista tarefas comerciais, opcionalmente filtradas por entidade ou status.
 */
export function useTarefas(opts?: { entidadeTipo?: string; entidadeId?: string; status?: TarefaStatus }) {
  return useQuery({
    queryKey: [...TAREFAS_KEY, opts],
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<TarefaComercial[]> => {
      let query = supabase
        .from('tarefas_comerciais')
        .select('*')
        .order('data_prevista', { ascending: true });

      if (opts?.entidadeTipo) query = query.eq('entidade_tipo', opts.entidadeTipo);
      if (opts?.entidadeId) query = query.eq('entidade_id', opts.entidadeId);
      if (opts?.status) query = query.eq('status', opts.status);

      const { data, error } = await query;
      if (error) throw new Error(`Erro ao buscar tarefas: ${error.message}`);
      return (data ?? []) as TarefaComercial[];
    },
  });
}

/**
 * Tarefas pendentes para hoje e atrasadas (para dashboard).
 */
export function useTarefasPendentes() {
  return useQuery({
    queryKey: [...TAREFAS_KEY, 'pendentes'],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<TarefaComercial[]> => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('tarefas_comerciais')
        .select('*')
        .in('status', ['pendente', 'em_andamento'])
        .lte('data_prevista', today)
        .order('data_prevista', { ascending: true })
        .limit(20);
      if (error) throw new Error(`Erro ao buscar tarefas pendentes: ${error.message}`);
      return (data ?? []) as TarefaComercial[];
    },
  });
}

/**
 * Cria uma nova tarefa comercial.
 */
export function useCreateTarefa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TarefaCreate): Promise<TarefaComercial> => {
      const { data, error } = await supabase
        .from('tarefas_comerciais')
        .insert(payload)
        .select()
        .single();
      if (error) throw new Error(`Erro ao criar tarefa: ${error.message}`);
      return data as TarefaComercial;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAREFAS_KEY });
      showSuccess('Tarefa criada');
    },
    onError: (error: Error) => showError(error.message),
  });
}

/**
 * Atualiza uma tarefa (ex: marcar como concluída).
 */
export function useUpdateTarefa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: TarefaUpdate): Promise<TarefaComercial> => {
      const { data, error } = await supabase
        .from('tarefas_comerciais')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(`Erro ao atualizar tarefa: ${error.message}`);
      return data as TarefaComercial;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAREFAS_KEY });
      showSuccess('Tarefa atualizada');
    },
    onError: (error: Error) => showError(error.message),
  });
}
