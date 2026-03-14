import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProducaoStats {
  total: number;
  byStatus: Record<string, number>;
  atrasadas: number;
  concluidas_hoje: number;
}

export function useProducaoStats() {
  return useQuery({
    queryKey: ['producao', 'stats'],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<ProducaoStats> => {
      const { data, error } = await supabase
        .from('ordens_producao')
        .select('status, data_conclusao, created_at');

      if (error) throw new Error(error.message);

      const ordens = data ?? [];
      const byStatus: Record<string, number> = {};
      let atrasadas = 0;
      let concluidasHoje = 0;
      const hoje = new Date().toISOString().slice(0, 10);

      for (const op of ordens) {
        byStatus[op.status] = (byStatus[op.status] ?? 0) + 1;
        if (op.data_conclusao?.slice(0, 10) === hoje) concluidasHoje++;
        // Ordens abertas criadas há mais de 3 dias sem conclusão
        if (
          !['finalizado', 'cancelada'].includes(op.status) &&
          op.created_at &&
          new Date(op.created_at).getTime() < Date.now() - 3 * 24 * 60 * 60 * 1000
        ) {
          atrasadas++;
        }
      }

      return {
        total: ordens.length,
        byStatus,
        atrasadas,
        concluidas_hoje: concluidasHoje,
      };
    },
  });
}
