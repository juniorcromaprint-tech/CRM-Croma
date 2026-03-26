// src/domains/ai/hooks/useAILogs.ts

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AILog {
  id: string;
  user_id: string;
  function_name: string;
  entity_type: string | null;
  entity_id: string | null;
  model_used: string;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  duration_ms: number | null;
  status: 'success' | 'error' | 'timeout';
  error_message: string | null;
  created_at: string;
}

export function useAILogs(limit = 20) {
  return useQuery({
    queryKey: ['ai-logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as AILog[];
    },
    staleTime: 1000 * 60 * 2, // 2 min
  });
}
