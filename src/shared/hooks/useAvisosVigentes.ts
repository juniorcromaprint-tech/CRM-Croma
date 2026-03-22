// ============================================================================
// useAvisosVigentes — Croma Print ERP/CRM
// Retorna avisos internos vigentes para o papel do usuário atual
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AvisoVigente {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: 'aviso' | 'alerta';
  grupo_destino: string[];
  data_inicio: string;
  data_fim: string | null;
  fixo: boolean;
  created_at: string;
}

export function useAvisosVigentes() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'comercial';

  return useQuery({
    queryKey: ['avisos-vigentes', role],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AvisoVigente[]> => {
      const { data, error } = await (supabase as any).rpc('get_avisos_vigentes', {
        p_role: role,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as AvisoVigente[];
    },
  });
}
