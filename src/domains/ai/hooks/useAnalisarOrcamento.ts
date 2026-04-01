// src/domains/ai/hooks/useAnalisarOrcamento.ts
// Migrado para ponte MCP — Claude primeiro, fallback OpenRouter

import { useAIBridge } from './useAIBridge';
import type { AIActionableResponse } from '../types/ai.types';
import type { AIBridgeResult } from './useAIBridge';

export function useAnalisarOrcamento() {
  const bridge = useAIBridge();

  return {
    ...bridge,
    mutate: (vars: { propostaId: string; model?: string }, options?: Parameters<typeof bridge.mutate>[1]) =>
      bridge.mutate(
        {
          tipo: 'analisar-orcamento',
          entityType: 'proposta',
          entityId: vars.propostaId,
          contexto: { proposta_id: vars.propostaId, model: vars.model },
        },
        options,
      ),
    mutateAsync: async (vars: { propostaId: string; model?: string }): Promise<AIActionableResponse> => {
      const result: AIBridgeResult = await bridge.mutateAsync({
        tipo: 'analisar-orcamento',
        entityType: 'proposta',
        entityId: vars.propostaId,
        contexto: { proposta_id: vars.propostaId, model: vars.model },
      });
      return result.response as AIActionableResponse;
    },
  };
}
