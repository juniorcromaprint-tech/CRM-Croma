import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { ilikeTerm } from '@/shared/utils/searchUtils';

// ─── Types ──────────────────────────────────────────────────────────────────

export type PedidoStatus =
  | 'rascunho'
  | 'aguardando_aprovacao'
  | 'aprovado'
  | 'em_producao'
  | 'produzido'
  | 'aguardando_instalacao'
  | 'em_instalacao'
  | 'parcialmente_concluido'
  | 'concluido'
  | 'cancelado';

export type PedidoPrioridade = 'baixa' | 'normal' | 'alta' | 'urgente';

export interface Pedido {
  id: string;
  numero: string | null;
  proposta_id: string | null;
  cliente_id: string;
  vendedor_id: string | null;
  status: PedidoStatus;
  prioridade: PedidoPrioridade;
  data_prometida: string | null;
  data_conclusao: string | null;
  valor_total: number;
  custo_total: number;
  margem_real: number | null;
  observacoes: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  excluido_em: string | null;
  created_at: string;
  updated_at: string;
  // joins
  clientes?: { nome_fantasia: string | null; razao_social: string } | null;
  pedido_itens?: { count: number }[] | null;
}

export interface PedidoCreate {
  proposta_id?: string | null;
  cliente_id: string;
  vendedor_id?: string | null;
  status?: PedidoStatus;
  prioridade?: PedidoPrioridade;
  data_prometida?: string | null;
  valor_total?: number;
  observacoes?: string | null;
}

export interface PedidoUpdate extends Partial<PedidoCreate> {
  id: string;
}

export interface PedidoFilters {
  status?: PedidoStatus | PedidoStatus[];
  prioridade?: PedidoPrioridade;
  search?: string;
  cliente_id?: string;
}

// ─── Query Keys ─────────────────────────────────────────────────────────────

const PEDIDOS_KEY = ['pedidos'] as const;

function pedidosQueryKey(filters?: PedidoFilters) {
  return filters ? [...PEDIDOS_KEY, 'list', filters] : [...PEDIDOS_KEY, 'list'];
}

function pedidoQueryKey(id: string) {
  return [...PEDIDOS_KEY, 'detail', id];
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Lista pedidos com filtros e joins.
 */
export function usePedidos(filters?: PedidoFilters) {
  return useQuery({
    queryKey: pedidosQueryKey(filters),
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<Pedido[]> => {
      let query = supabase
        .from('pedidos')
        .select('*, clientes(nome_fantasia, razao_social), pedido_itens(count)')
        .is('excluido_em', null)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status);
        } else {
          query = query.eq('status', filters.status);
        }
      }

      if (filters?.prioridade) query = query.eq('prioridade', filters.prioridade);
      if (filters?.cliente_id) query = query.eq('cliente_id', filters.cliente_id);

      if (filters?.search && filters.search.trim().length > 0) {
        const term = ilikeTerm(filters.search);
        query = query.or(`numero.ilike.${term},observacoes.ilike.${term}`);
      }

      const { data, error } = await query;
      if (error) throw new Error(`Erro ao buscar pedidos: ${error.message}`);
      return (data ?? []) as Pedido[];
    },
  });
}

/**
 * Busca um pedido individual com itens.
 */
export function usePedido(id: string | undefined) {
  return useQuery({
    queryKey: pedidoQueryKey(id ?? ''),
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<Pedido | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('pedidos')
        .select('*, clientes(nome_fantasia, razao_social)')
        .eq('id', id)
        .single();
      if (error) throw new Error(`Erro ao buscar pedido: ${error.message}`);
      return data as Pedido;
    },
    enabled: !!id,
  });
}

/**
 * Cria um novo pedido.
 */
export function useCreatePedido() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PedidoCreate): Promise<Pedido> => {
      const { data, error } = await supabase
        .from('pedidos')
        .insert(payload)
        .select()
        .single();
      if (error) throw new Error(`Erro ao criar pedido: ${error.message}`);
      return data as Pedido;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PEDIDOS_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      showSuccess('Pedido criado com sucesso');
    },
    onError: (error: Error) => showError(error.message),
  });
}

/**
 * Atualiza um pedido existente.
 */
export function useUpdatePedido() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: PedidoUpdate): Promise<Pedido> => {
      const { data, error } = await supabase
        .from('pedidos')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(`Erro ao atualizar pedido: ${error.message}`);
      return data as Pedido;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: PEDIDOS_KEY });
      queryClient.setQueryData(pedidoQueryKey(data.id), data);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      showSuccess('Pedido atualizado');
    },
    onError: (error: Error) => showError(error.message),
  });
}

/**
 * Estatísticas de pedidos para dashboard.
 */
export function usePedidoStats() {
  return useQuery({
    queryKey: [...PEDIDOS_KEY, 'stats'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('status, prioridade, valor_total, data_prometida')
        .is('excluido_em', null);
      if (error) throw new Error(`Erro ao buscar stats de pedidos: ${error.message}`);

      const pedidos = data ?? [];
      let totalValor = 0;
      let emAtraso = 0;
      const byStatus: Record<string, { count: number; valor: number }> = {};
      const today = new Date().toISOString().split('T')[0];

      for (const p of pedidos) {
        const status = p.status as PedidoStatus;
        const valor = Number(p.valor_total) || 0;
        totalValor += valor;

        if (!byStatus[status]) byStatus[status] = { count: 0, valor: 0 };
        byStatus[status].count += 1;
        byStatus[status].valor += valor;

        // Em atraso: não concluído e data prometida ultrapassada
        if (
          p.data_prometida &&
          p.data_prometida < today &&
          !['concluido', 'cancelado'].includes(status)
        ) {
          emAtraso += 1;
        }
      }

      return {
        total: pedidos.length,
        totalValor,
        emAtraso,
        byStatus,
      };
    },
  });
}
