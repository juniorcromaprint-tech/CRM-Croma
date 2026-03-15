// src/domains/ai/hooks/useDetectarProblemas.ts

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import type { AIActionableResponse } from '../types/ai.types';

export function useDetectarProblemas() {
  return useMutation({
    mutationFn: async (mode: 'manual' | 'cron' = 'manual'): Promise<AIActionableResponse> => {
      const { data, error } = await supabase.functions.invoke('ai-detectar-problemas', {
        body: { mode },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as AIActionableResponse;
    },
    onError: (err: Error) => showError(err.message || 'Erro ao detectar problemas'),
  });
}
