// src/domains/ai/hooks/useResumoCliente.ts

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import type { AIResponse } from '../types/ai.types';

export function useResumoCliente() {
  return useMutation({
    mutationFn: async (clienteId: string): Promise<AIResponse> => {
      const { data, error } = await supabase.functions.invoke('ai-resumo-cliente', {
        body: { cliente_id: clienteId },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as AIResponse;
    },
    onError: (err: Error) => showError(err.message || 'Erro ao gerar resumo do cliente'),
  });
}
