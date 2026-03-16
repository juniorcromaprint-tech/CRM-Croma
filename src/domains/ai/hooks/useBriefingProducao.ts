// src/domains/ai/hooks/useBriefingProducao.ts

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import type { AIActionableResponse } from '../types/ai.types';

export function useBriefingProducao() {
  return useMutation({
    mutationFn: async ({ pedidoId, model }: { pedidoId: string; model?: string }): Promise<AIActionableResponse> => {
      const { data, error } = await supabase.functions.invoke('ai-briefing-producao', {
        body: { pedido_id: pedidoId, model },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as AIActionableResponse;
    },
    onError: (err: Error) => showError(err.message || 'Erro ao gerar briefing'),
  });
}
