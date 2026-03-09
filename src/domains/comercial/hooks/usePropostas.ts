import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

// ─── Types ──────────────────────────────────────────────────────────────────

export type PropostaStatus =
  | 'rascunho'
  | 'enviada'
  | 'em_analise'
  | 'aprovada'
  | 'rejeitada'
  | 'expirada'
  | 'revisao';

export interface Proposta {
  id: string;
  numero: string;
  cliente_id: string;
  oportunidade_id: string | null;
  vendedor_id: string | null;
  status: PropostaStatus;
  valor_total: number;
  desconto_percentual: number;
  valor_final: number;
  validade: string | null;
  condicao_pagamento: string | null;
  prazo_entrega: string | null;
  observacoes: string | null;
  excluido_em: string | null;
  excluido_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropostaCreate {
  numero: string;
  cliente_id: string;
  oportunidade_id?: string | null;
  vendedor_id?: string | null;
  status?: PropostaStatus;
  valor_total?: number;
  desconto_percentual?: number;
  valor_final?: number;
  validade?: string | null;
  condicao_pagamento?: string | null;
  prazo_entrega?: string | null;
  observacoes?: string | null;
}

export interface PropostaUpdate extends Partial<Omit<PropostaCreate, 'numero'>> {
  id: string;
  numero?: string;
}

export interface PropostaFilters {
  status?: PropostaStatus | PropostaStatus[];
  search?: string;
  cliente_id?: string;
  vendedor_id?: string;
}

// ─── Query Keys ─────────────────────────────────────────────────────────────

const PROPOSTAS_KEY = ['comercial', 'propostas'] as const;

function propostasQueryKey(filters?: PropostaFilters) {
  return filters
    ? [...PROPOSTAS_KEY, 'list', filters]
    : [...PROPOSTAS_KEY, 'list'];
}

function propostaQueryKey(id: string) {
  return [...PROPOSTAS_KEY, 'detail', id];
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Lista propostas com filtros opcionais.
 * Exclui registros soft-deleted (excluido_em IS NULL).
 */
export function usePropostas(filters?: PropostaFilters) {
  return useQuery({
    queryKey: propostasQueryKey(filters),
    queryFn: async (): Promise<Proposta[]> => {
      let query = supabase
        .from('propostas')
        .select('*')
        .is('excluido_em', null)
        .order('created_at', { ascending: false });

      // Filtro por status
      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status);
        } else {
          query = query.eq('status', filters.status);
        }
      }

      // Filtro por cliente
      if (filters?.cliente_id) {
        query = query.eq('cliente_id', filters.cliente_id);
      }

      // Filtro por vendedor
      if (filters?.vendedor_id) {
        query = query.eq('vendedor_id', filters.vendedor_id);
      }

      // Busca textual (numero, observacoes)
      if (filters?.search && filters.search.trim().length > 0) {
        const term = `%${filters.search.trim()}%`;
        query = query.or(
          `numero.ilike.${term},observacoes.ilike.${term}`
        );
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar propostas: ${error.message}`);
      }

      return (data ?? []) as Proposta[];
    },
  });
}

/**
 * Busca uma proposta individual pelo ID.
 * Retorna null se o registro estiver soft-deleted.
 */
export function useProposta(id: string | undefined) {
  return useQuery({
    queryKey: propostaQueryKey(id ?? ''),
    queryFn: async (): Promise<Proposta | null> => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('propostas')
        .select('*')
        .eq('id', id)
        .is('excluido_em', null)
        .single();

      if (error) {
        throw new Error(`Erro ao buscar proposta: ${error.message}`);
      }

      return data as Proposta;
    },
    enabled: !!id,
  });
}

/**
 * Cria uma nova proposta.
 */
export function useCreateProposta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: PropostaCreate): Promise<Proposta> => {
      const { data, error } = await supabase
        .from('propostas')
        .insert(payload)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao criar proposta: ${error.message}`);
      }

      return data as Proposta;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROPOSTAS_KEY });
      showSuccess('Proposta criada com sucesso');
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}

/**
 * Atualiza uma proposta existente.
 */
export function useUpdateProposta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: PropostaUpdate): Promise<Proposta> => {
      const { data, error } = await supabase
        .from('propostas')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .is('excluido_em', null)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao atualizar proposta: ${error.message}`);
      }

      return data as Proposta;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: PROPOSTAS_KEY });
      queryClient.setQueryData(propostaQueryKey(data.id), data);
      showSuccess('Proposta atualizada com sucesso');
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}
