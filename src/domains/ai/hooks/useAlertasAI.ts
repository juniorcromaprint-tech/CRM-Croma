// src/domains/ai/hooks/useAlertasAI.ts

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AIAlerta {
  id: string;
  tipo: string;
  severidade: 'alta' | 'media' | 'baixa';
  titulo: string;
  descricao: string;
  entity_type: string;
  entity_id: string;
  resolvido: boolean;
  created_at: string;
}

export function useAlertasAI() {
  return useQuery({
    queryKey: ['ai-alertas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_alertas')
        .select('*')
        .eq('resolvido', false)
        .order('severidade', { ascending: true }) // alta first
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as AIAlerta[];
    },
    staleTime: 1000 * 60 * 5, // 5 min
  });
}

export function useResolverAlerta() {
  return async (alertaId: string, userId: string) => {
    const { error } = await supabase
      .from('ai_alertas')
      .update({
        resolvido: true,
        resolvido_por: userId,
        resolvido_em: new Date().toISOString(),
      })
      .eq('id', alertaId);

    if (error) throw error;
  };
}
