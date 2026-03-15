// src/domains/ai/hooks/useAnalisarOrcamento.ts

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import type { AIActionableResponse } from '../types/ai.types';

export function useAnalisarOrcamento() {
  return useMutation({
    mutationFn: async (propostaId: string): Promise<AIActionableResponse> => {
      const { data, error } = await supabase.functions.invoke('ai-analisar-orcamento', {
        body: { proposta_id: propostaId },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as AIActionableResponse;
    },
    onError: (err: Error) => showError(err.message || 'Erro ao analisar orcamento'),
  });
}
