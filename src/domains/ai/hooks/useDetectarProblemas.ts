// src/domains/ai/hooks/useDetectarProblemas.ts
// Migrado para ponte MCP — Claude primeiro, fallback OpenRouter

import { useAIBridge } from './useAIBridge';
import type { AIActionableResponse } from '../types/ai.types';
import type { AIBridgeResult } from './useAIBridge';

export function useDetectarProblemas() {
  const bridge = useAIBridge();

  return {
    ...bridge,
    mutate: (vars: { mode?: 'manual' | 'cron'; model?: string } = {}, options?: Parameters<typeof bridge.mutate>[1]) =>
      bridge.mutate(
        {
          tipo: 'detectar-problemas',
          entityType: 'sistema',
          contexto: { mode: vars.mode ?? 'manual', model: vars.model },
        },
        options,
      ),
    mutateAsync: async (vars: { mode?: 'manual' | 'cron'; model?: string } = {}): Promise<AIActionableResponse> => {
      const result: AIBridgeResult = await bridge.mutateAsync({
        tipo: 'detectar-problemas',
        entityType: 'sistema',
        contexto: { mode: vars.mode ?? 'manual', model: vars.model },
      });
      return result.response as AIActionableResponse;
    },
  };
}
