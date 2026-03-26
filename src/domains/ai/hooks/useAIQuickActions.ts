// src/domains/ai/hooks/useAIQuickActions.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

function useInvokeFunction(functionName: string, successMsg: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown> = {}) => {
      const { data, error } = await supabase.functions.invoke(functionName, { body });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      showSuccess(successMsg);
      // Invalidate relevant queries after running
      qc.invalidateQueries({ queryKey: ['ai-command-hub'] });
      qc.invalidateQueries({ queryKey: ['ai-logs'] });
      qc.invalidateQueries({ queryKey: ['ai-alertas'] });
    },
    onError: (err: Error) => showError(err.message || `Erro ao executar ${functionName}`),
  });
}

export function useRodarInteligenciaComercial() {
  return useInvokeFunction('ai-inteligencia-comercial', 'Inteligência Comercial executada com sucesso');
}

export function useGerarInsightsDiarios() {
  return useInvokeFunction('ai-insights-diarios', 'Insights Diários gerados com sucesso');
}

export function useDetectarProblemasQuick() {
  return useInvokeFunction('ai-detectar-problemas', 'Detecção de Problemas concluída');
}
