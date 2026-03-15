// src/domains/ai/hooks/useComposicaoProduto.ts

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import type { AIActionableResponse } from '../types/ai.types';

export function useComposicaoProduto() {
  return useMutation({
    mutationFn: async (descricao: string): Promise<AIActionableResponse> => {
      const { data, error } = await supabase.functions.invoke('ai-composicao-produto', {
        body: { descricao },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as AIActionableResponse;
    },
    onError: (err: Error) => showError(err.message || 'Erro ao sugerir composicao'),
  });
}
