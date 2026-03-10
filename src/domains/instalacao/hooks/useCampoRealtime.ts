import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess } from '@/utils/toast';

/**
 * Hook para ouvir mudanças em tempo real nos jobs de um pedido específico.
 * Quando um job muda de status, invalida queries relevantes e exibe toast.
 */
export function useCampoRealtime(pedidoId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!pedidoId) return;

    const channel = supabase
      .channel('campo-jobs-' + pedidoId)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `pedido_id=eq.${pedidoId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['instalacoes', pedidoId] });
          queryClient.invalidateQueries({ queryKey: ['vw_campo_instalacoes'] });
          queryClient.invalidateQueries({ queryKey: ['campo-instalacoes-hoje'] });

          const job = payload.new as { status: string; os_number: string };
          if (job.status === 'Concluído') {
            showSuccess(`OS ${job.os_number} concluída no campo!`);
          } else if (job.status === 'Em Andamento') {
            showSuccess(`OS ${job.os_number} em execução no campo`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pedidoId, queryClient]);
}

/**
 * Hook global para monitorar TODAS as OS em tempo real.
 * Usado no painel de monitoramento de instalações.
 */
export function useCampoRealtimeGlobal() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('campo-global')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['vw_campo_instalacoes'] });
          queryClient.invalidateQueries({ queryKey: ['campo-instalacoes-hoje'] });
          queryClient.invalidateQueries({ queryKey: ['campo-instalacoes-todas'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
