import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

// ─── Types ──────────────────────────────────────────────────────────────────

export type PedidoItemStatus =
  | 'pendente'
  | 'em_producao'
  | 'produzido'
  | 'em_instalacao'
  | 'instalado'
  | 'cancelado';

export interface PedidoItem {
  id: string;
  pedido_id: string;
  proposta_item_id: string | null;
  produto_id: string | null;
  descricao: string;
  especificacao: string | null;
  quantidade: number;
  unidade: string;
  valor_unitario: number | null;
  valor_total: number | null;
  status: PedidoItemStatus;
  arte_url: string | null;
  arte_preview_url: string | null;
  arte_nome_original: string | null;
  arte_tamanho_bytes: number | null;
  arte_mime: string | null;
  arte_uploaded_at: string | null;
  arte_uploaded_by: string | null;
  instrucoes: string | null;
  largura_cm: number | null;
  altura_cm: number | null;
  created_at: string;
}

export interface PedidoItemCreate {
  pedido_id: string;
  proposta_item_id?: string | null;
  produto_id?: string | null;
  descricao: string;
  especificacao?: string | null;
  quantidade?: number;
  unidade?: string;
  valor_unitario?: number | null;
  valor_total?: number | null;
  arte_url?: string | null;
  arte_preview_url?: string | null;
  arte_nome_original?: string | null;
  arte_tamanho_bytes?: number | null;
  arte_mime?: string | null;
  arte_uploaded_at?: string | null;
  arte_uploaded_by?: string | null;
  instrucoes?: string | null;
}

export interface PedidoItemUpdate extends Partial<Omit<PedidoItemCreate, 'pedido_id'>> {
  id: string;
}

// ─── Query Keys ─────────────────────────────────────────────────────────────

const ITENS_KEY = ['pedidos', 'itens'] as const;

function itensQueryKey(pedidoId: string) {
  return [...ITENS_KEY, pedidoId];
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Lista itens de um pedido específico.
 */
export function usePedidoItens(pedidoId: string | undefined) {
  return useQuery({
    queryKey: itensQueryKey(pedidoId ?? ''),
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<PedidoItem[]> => {
      if (!pedidoId) return [];
      const { data, error } = await supabase
        .from('pedido_itens')
        .select('*')
        .eq('pedido_id', pedidoId)
        .order('created_at', { ascending: true });
      if (error) throw new Error(`Erro ao buscar itens: ${error.message}`);
      return (data ?? []) as PedidoItem[];
    },
    enabled: !!pedidoId,
  });
}

/**
 * Adiciona um item ao pedido.
 */
export function useCreatePedidoItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PedidoItemCreate): Promise<PedidoItem> => {
      const { data, error } = await supabase
        .from('pedido_itens')
        .insert(payload)
        .select()
        .single();
      if (error) throw new Error(`Erro ao adicionar item: ${error.message}`);
      return data as PedidoItem;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: itensQueryKey(variables.pedido_id) });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      showSuccess('Item adicionado');
    },
    onError: (error: Error) => showError(error.message),
  });
}

/**
 * Atualiza um item do pedido.
 */
export function useUpdatePedidoItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: PedidoItemUpdate): Promise<PedidoItem> => {
      const { data, error } = await supabase
        .from('pedido_itens')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(`Erro ao atualizar item: ${error.message}`);
      return data as PedidoItem;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: itensQueryKey(data.pedido_id) });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      showSuccess('Item atualizado');
    },
    onError: (error: Error) => showError(error.message),
  });
}
