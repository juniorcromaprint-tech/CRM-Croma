// ============================================================================
// useAlertasEstoque — Croma Print ERP/CRM
// Query que retorna materiais abaixo do estoque mínimo via v_estoque_saldos
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MaterialAlerta {
  id: string;
  nome: string;
  unidade: string;
  estoque_atual: number;
  estoque_minimo: number;
}

export function useAlertasEstoque() {
  return useQuery({
    queryKey: ['alertas-estoque'],
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<MaterialAlerta[]> => {
      const { data, error } = await (supabase as any)
        .from('v_estoque_saldos')
        .select('material_id, nome, unidade, saldo_disponivel, estoque_minimo')
        .gt('estoque_minimo', 0)
        .order('nome');

      if (error) throw new Error(error.message);

      return ((data ?? []) as Array<{
        material_id: string;
        nome: string;
        unidade: string;
        saldo_disponivel: number;
        estoque_minimo: number;
      }>)
        .filter((m) => Number(m.saldo_disponivel) <= Number(m.estoque_minimo))
        .map((m) => ({
          id: m.material_id,
          nome: m.nome,
          unidade: m.unidade,
          estoque_atual: Number(m.saldo_disponivel),
          estoque_minimo: Number(m.estoque_minimo),
        }));
    },
  });
}
