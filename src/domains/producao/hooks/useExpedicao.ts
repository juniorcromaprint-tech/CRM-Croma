import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

export interface PedidoExpedicao {
  id: string;
  numero: string | null;
  cliente_id: string;
  status: string;
  valor_total: number;
  data_prometida: string | null;
  created_at: string;
  clientes: { nome_fantasia: string | null; razao_social: string } | null;
}

export function usePedidosParaExpedicao() {
  return useQuery({
    queryKey: ['expedicao', 'list'],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<PedidoExpedicao[]> => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, numero, cliente_id, status, valor_total, data_prometida, created_at, clientes(nome_fantasia, razao_social)')
        .in('status', ['produzido', 'aguardando_instalacao'])
        .is('excluido_em', null)
        .order('data_prometida', { ascending: true, nullsFirst: false });

      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as PedidoExpedicao[];
    },
  });
}

export function useLiberarExpedicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pedidoId, tipo }: { pedidoId: string; tipo: 'instalacao' | 'retirada' | 'envio' }) => {
      const nextStatus = tipo === 'instalacao' ? 'aguardando_instalacao' : 'concluido';
      const label =
        tipo === 'instalacao' ? 'instalação' :
        tipo === 'retirada' ? 'retirada pelo cliente' : 'envio/transportadora';

      const { error } = await supabase
        .from('pedidos')
        .update({ status: nextStatus, observacoes: `Liberado para ${label}` })
        .eq('id', pedidoId);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expedicao'] });
      qc.invalidateQueries({ queryKey: ['pedidos'] });
      showSuccess('Pedido liberado com sucesso!');
    },
    onError: (err: Error) => showError(err.message),
  });
}
