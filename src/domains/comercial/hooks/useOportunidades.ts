import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

// ─── Types ──────────────────────────────────────────────────────────────────

export type OportunidadeFase =
  | 'aberta'
  | 'proposta_enviada'
  | 'em_negociacao'
  | 'ganha'
  | 'perdida';

export interface Oportunidade {
  id: string;
  lead_id: string | null;
  cliente_id: string | null;
  titulo: string;
  descricao: string | null;
  valor_estimado: number | null;
  fase: OportunidadeFase;
  probabilidade: number;
  data_fechamento_prevista: string | null;
  data_fechamento_real: string | null;
  motivo_perda: string | null;
  vendedor_id: string | null;
  created_at: string;
  updated_at: string;
  // joins
  clientes?: { nome_fantasia: string | null; razao_social: string } | null;
  leads?: { empresa: string; contato_nome: string | null } | null;
}

export interface OportunidadeCreate {
  titulo: string;
  lead_id?: string | null;
  cliente_id?: string | null;
  descricao?: string | null;
  valor_estimado?: number | null;
  fase?: OportunidadeFase;
  probabilidade?: number;
  data_fechamento_prevista?: string | null;
  vendedor_id?: string | null;
}

export interface OportunidadeUpdate extends Partial<OportunidadeCreate> {
  id: string;
  motivo_perda?: string | null;
  data_fechamento_real?: string | null;
}

export interface OportunidadeFilters {
  fase?: OportunidadeFase | OportunidadeFase[];
  search?: string;
  vendedor_id?: string;
  cliente_id?: string;
}

// ─── Query Keys ─────────────────────────────────────────────────────────────

const OPORT_KEY = ['comercial', 'oportunidades'] as const;

function oportunidadesQueryKey(filters?: OportunidadeFilters) {
  return filters ? [...OPORT_KEY, 'list', filters] : [...OPORT_KEY, 'list'];
}

function oportunidadeQueryKey(id: string) {
  return [...OPORT_KEY, 'detail', id];
}

const OPORT_STATS_KEY = [...OPORT_KEY, 'stats'] as const;

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Lista oportunidades com filtros e joins para cliente e lead.
 */
export function useOportunidades(filters?: OportunidadeFilters) {
  return useQuery({
    queryKey: oportunidadesQueryKey(filters),
    queryFn: async (): Promise<Oportunidade[]> => {
      let query = supabase
        .from('oportunidades')
        .select('*, clientes(nome_fantasia, razao_social), leads(empresa, contato_nome)')
        .order('updated_at', { ascending: false });

      if (filters?.fase) {
        if (Array.isArray(filters.fase)) {
          query = query.in('fase', filters.fase);
        } else {
          query = query.eq('fase', filters.fase);
        }
      }

      if (filters?.vendedor_id) {
        query = query.eq('vendedor_id', filters.vendedor_id);
      }

      if (filters?.cliente_id) {
        query = query.eq('cliente_id', filters.cliente_id);
      }

      if (filters?.search && filters.search.trim().length > 0) {
        const term = `%${filters.search.trim()}%`;
        query = query.or(`titulo.ilike.${term},descricao.ilike.${term}`);
      }

      const { data, error } = await query;
      if (error) throw new Error(`Erro ao buscar oportunidades: ${error.message}`);
      return (data ?? []) as Oportunidade[];
    },
  });
}

/**
 * Busca uma oportunidade individual pelo ID.
 */
export function useOportunidade(id: string | undefined) {
  return useQuery({
    queryKey: oportunidadeQueryKey(id ?? ''),
    queryFn: async (): Promise<Oportunidade | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('oportunidades')
        .select('*, clientes(nome_fantasia, razao_social), leads(empresa, contato_nome)')
        .eq('id', id)
        .single();
      if (error) throw new Error(`Erro ao buscar oportunidade: ${error.message}`);
      return data as Oportunidade;
    },
    enabled: !!id,
  });
}

/**
 * Cria uma nova oportunidade.
 */
export function useCreateOportunidade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: OportunidadeCreate): Promise<Oportunidade> => {
      const { data, error } = await supabase
        .from('oportunidades')
        .insert(payload)
        .select()
        .single();
      if (error) throw new Error(`Erro ao criar oportunidade: ${error.message}`);
      return data as Oportunidade;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OPORT_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      showSuccess('Oportunidade criada com sucesso');
    },
    onError: (error: Error) => showError(error.message),
  });
}

/**
 * Atualiza uma oportunidade existente.
 */
export function useUpdateOportunidade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: OportunidadeUpdate): Promise<Oportunidade> => {
      const { data, error } = await supabase
        .from('oportunidades')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(`Erro ao atualizar oportunidade: ${error.message}`);
      return data as Oportunidade;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: OPORT_KEY });
      queryClient.setQueryData(oportunidadeQueryKey(data.id), data);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      showSuccess('Oportunidade atualizada');
    },
    onError: (error: Error) => showError(error.message),
  });
}

/**
 * Estatísticas do pipeline de oportunidades.
 */
export function useOportunidadeStats() {
  return useQuery({
    queryKey: OPORT_STATS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('oportunidades')
        .select('fase, valor_estimado, probabilidade');
      if (error) throw new Error(`Erro ao buscar stats: ${error.message}`);

      const oportunidades = data ?? [];
      let pipelineTotal = 0;
      let pipelinePonderado = 0;
      let ganhas = 0;
      let perdidas = 0;
      const byFase: Record<string, { count: number; valor: number }> = {};

      for (const op of oportunidades) {
        const fase = op.fase as OportunidadeFase;
        const valor = Number(op.valor_estimado) || 0;
        const prob = Number(op.probabilidade) || 0;

        if (!byFase[fase]) byFase[fase] = { count: 0, valor: 0 };
        byFase[fase].count += 1;
        byFase[fase].valor += valor;

        if (fase === 'ganha') {
          ganhas += 1;
        } else if (fase === 'perdida') {
          perdidas += 1;
        } else {
          pipelineTotal += valor;
          pipelinePonderado += valor * (prob / 100);
        }
      }

      const totalFechadas = ganhas + perdidas;
      const taxaConversao = totalFechadas > 0 ? (ganhas / totalFechadas) * 100 : 0;

      return {
        pipelineTotal,
        pipelinePonderado,
        ganhas,
        perdidas,
        taxaConversao,
        total: oportunidades.length,
        byFase,
      };
    },
  });
}
