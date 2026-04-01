// src/domains/ai/hooks/useResumoCliente.ts
// Migrado para ponte MCP — Claude primeiro, fallback OpenRouter

import { useAIBridge } from './useAIBridge';
import type { AIActionableResponse } from '../types/ai.types';
import type { AIBridgeResult } from './useAIBridge';

export function useResumoCliente() {
  const bridge = useAIBridge();

  return {
    ...bridge,
    mutate: (vars: { clienteId: string; model?: string }, options?: Parameters<typeof bridge.mutate>[1]) =>
      bridge.mutate(
        {
          tipo: 'resumo-cliente',
          entityType: 'cliente',
          entityId: vars.clienteId,
          contexto: { cliente_id: vars.clienteId, model: vars.model },
        },
        options,
      ),
    mutateAsync: async (vars: { clienteId: string; model?: string }): Promise<AIActionableResponse> => {
      const result: AIBridgeResult = await bridge.mutateAsync({
        tipo: 'resumo-cliente',
        entityType: 'cliente',
        entityId: vars.clienteId,
        contexto: { cliente_id: vars.clienteId, model: vars.model },
      });
      return result.response as AIActionableResponse;
    },
  };
}
