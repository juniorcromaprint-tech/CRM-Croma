// src/domains/ai/hooks/useComposicaoProduto.ts
// Migrado para ponte MCP — Claude primeiro, fallback OpenRouter

import { useAIBridge } from './useAIBridge';
import type { AIActionableResponse } from '../types/ai.types';
import type { AIBridgeResult } from './useAIBridge';

export function useComposicaoProduto() {
  const bridge = useAIBridge();

  return {
    ...bridge,
    mutate: (vars: { descricao: string; model?: string }, options?: Parameters<typeof bridge.mutate>[1]) =>
      bridge.mutate(
        {
          tipo: 'composicao-produto',
          entityType: 'produto',
          contexto: { descricao: vars.descricao, model: vars.model },
        },
        options,
      ),
    mutateAsync: async (vars: { descricao: string; model?: string }): Promise<AIActionableResponse> => {
      const result: AIBridgeResult = await bridge.mutateAsync({
        tipo: 'composicao-produto',
        entityType: 'produto',
        contexto: { descricao: vars.descricao, model: vars.model },
      });
      return result.response as AIActionableResponse;
    },
  };
}
