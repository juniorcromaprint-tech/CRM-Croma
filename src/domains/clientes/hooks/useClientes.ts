import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { ilikeTerm } from '@/shared/utils/searchUtils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClienteFilters {
  segmento?: string;
  classificacao?: string;
  ativo?: boolean;
  search?: string;
}

export interface ClienteInput {
  razao_social: string;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  inscricao_estadual?: string | null;
  segmento?: string | null;
  classificacao?: string | null;
  tipo_cliente?: string | null;
  origem?: string | null;
  vendedor_id?: string | null;
  email?: string | null;
  telefone?: string | null;
  // DB column name is `site`, not `website`
  site?: string | null;
  // DB address columns are flat: endereco, cidade, estado, cep
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  observacoes?: string | null;
  ativo?: boolean;
}

export interface ClienteUpdate extends Partial<ClienteInput> {
  id: string;
}

interface ClassificacaoCount {
  classificacao: string;
  count: number;
}

interface SegmentoCount {
  segmento: string;
  count: number;
}

export interface ClienteStats {
  total: number;
  ativos: number;
  inativos: number;
  porClassificacao: ClassificacaoCount[];
  porSegmento: SegmentoCount[];
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const CLIENTES_KEY = 'clientes';
const CLIENTES_STATS_KEY = 'clientes-stats';

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * List clientes with optional filters.
 */
export function useClientes(filters?: ClienteFilters) {
  return useQuery({
    queryKey: [CLIENTES_KEY, filters],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      let query = supabase
        .from('clientes')
        .select('*')
        .order('razao_social', { ascending: true });

      if (filters?.segmento) {
        query = query.eq('segmento', filters.segmento);
      }
      if (filters?.classificacao) {
        query = query.eq('classificacao', filters.classificacao);
      }
      if (filters?.ativo !== undefined) {
        query = query.eq('ativo', filters.ativo);
      }
      if (filters?.search) {
        const term = ilikeTerm(filters.search);
        query = query.or(
          `razao_social.ilike.${term},nome_fantasia.ilike.${term},cnpj.ilike.${term},email.ilike.${term}`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Fetch a single cliente by ID.
 */
export function useCliente(id: string | undefined) {
  return useQuery({
    queryKey: [CLIENTES_KEY, id],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      if (!id) throw new Error('ID do cliente nao informado');

      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

/**
 * Create a new cliente.
 */
export function useCreateCliente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ClienteInput) => {
      const { data, error } = await supabase
        .from('clientes')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLIENTES_KEY] });
      queryClient.invalidateQueries({ queryKey: [CLIENTES_STATS_KEY] });
      showSuccess('Cliente criado com sucesso');
    },
    onError: (error: Error) => {
      showError(`Erro ao criar cliente: ${error.message}`);
    },
  });
}

/**
 * Update an existing cliente.
 */
export function useUpdateCliente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: ClienteUpdate) => {
      const { data, error } = await supabase
        .from('clientes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [CLIENTES_KEY] });
      queryClient.invalidateQueries({ queryKey: [CLIENTES_KEY, data.id] });
      queryClient.invalidateQueries({ queryKey: [CLIENTES_STATS_KEY] });
      showSuccess('Cliente atualizado com sucesso');
    },
    onError: (error: Error) => {
      showError(`Erro ao atualizar cliente: ${error.message}`);
    },
  });
}

/**
 * Soft-delete a cliente (set ativo = false).
 */
export function useDeleteCliente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('clientes')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLIENTES_KEY] });
      queryClient.invalidateQueries({ queryKey: [CLIENTES_STATS_KEY] });
      showSuccess('Cliente desativado com sucesso');
    },
    onError: (error: Error) => {
      showError(`Erro ao desativar cliente: ${error.message}`);
    },
  });
}

/**
 * Aggregated stats: totals, counts by classificacao and segmento.
 */
export function useClienteStats() {
  return useQuery<ClienteStats>({
    queryKey: [CLIENTES_STATS_KEY],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      // Fetch all clientes (only the columns we need for aggregation)
      const { data, error } = await supabase
        .from('clientes')
        .select('classificacao, segmento, ativo');

      if (error) throw error;

      const rows = data ?? [];

      const total = rows.length;
      const ativos = rows.filter((r) => r.ativo).length;
      const inativos = total - ativos;

      // Count by classificacao
      const classMap = new Map<string, number>();
      for (const r of rows) {
        const key = r.classificacao ?? 'sem_classificacao';
        classMap.set(key, (classMap.get(key) ?? 0) + 1);
      }
      const porClassificacao: ClassificacaoCount[] = Array.from(classMap.entries()).map(
        ([classificacao, count]) => ({ classificacao, count }),
      );

      // Count by segmento
      const segMap = new Map<string, number>();
      for (const r of rows) {
        const key = r.segmento ?? 'sem_segmento';
        segMap.set(key, (segMap.get(key) ?? 0) + 1);
      }
      const porSegmento: SegmentoCount[] = Array.from(segMap.entries()).map(
        ([segmento, count]) => ({ segmento, count }),
      );

      return { total, ativos, inativos, porClassificacao, porSegmento };
    },
  });
}
