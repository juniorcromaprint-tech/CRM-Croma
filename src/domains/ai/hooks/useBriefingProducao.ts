// src/domains/ai/hooks/useBriefingProducao.ts
// Migrado para ponte MCP — Claude primeiro, fallback OpenRouter

import { useAIBridge } from './useAIBridge';
import type { AIActionableResponse } from '../types/ai.types';
import type { AIBridgeResult } from './useAIBridge';

export function useBriefingProducao() {
  const bridge = useAIBridge();

  return {
    ...bridge,
    mutate: (vars: { pedidoId: string; model?: string }, options?: Parameters<typeof bridge.mutate>[1]) =>
      bridge.mutate(
        {
          tipo: 'briefing-producao',
          entityType: 'pedido',
          entityId: vars.pedidoId,
          contexto: { pedido_id: vars.pedidoId, model: vars.model },
        },
        options,
      ),
    mutateAsync: async (vars: { pedidoId: string; model?: string }): Promise<AIActionableResponse> => {
      const result: AIBridgeResult = await bridge.mutateAsync({
        tipo: 'briefing-producao',
        entityType: 'pedido',
        entityId: vars.pedidoId,
        contexto: { pedido_id: vars.pedidoId, model: vars.model },
      });
      return result.response as AIActionableResponse;
    },
  };
}
