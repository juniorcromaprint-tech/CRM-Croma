// src/domains/ai/hooks/useAIBridge.ts
// Ponte MCP — envia requests para ai_requests, aguarda resposta via ai_responses
// Claude processa via MCP. Fallback: Edge Function com OpenRouter após timeout.

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import type { AIActionableResponse } from '../types/ai.types';

interface AIBridgeRequest {
  tipo: string;
  entityType: string;
  entityId?: string;
  contexto?: Record<string, unknown>;
  /** Timeout em ms antes de cair no fallback Edge Function (default: 60000) */
  timeoutMs?: number;
  /** Se true, não tenta fallback — espera apenas Claude */
  claudeOnly?: boolean;
}

interface AIBridgeResult {
  response: AIActionableResponse | Record<string, unknown>;
  source: 'claude' | 'openrouter';
  durationMs: number;
}

/** Map tipo → Edge Function name para fallback */
const FALLBACK_FUNCTIONS: Record<string, string> = {
  'analisar-orcamento': 'ai-analisar-orcamento',
  'detectar-problemas': 'ai-detectar-problemas',
  'resumo-cliente': 'ai-resumo-cliente',
  'briefing-producao': 'ai-briefing-producao',
  'composicao-produto': 'ai-composicao-produto',
  'qualificar-lead': 'ai-qualificar-lead',
};

/**
 * Aguarda resposta do Claude via Supabase Realtime (polling)
 */
async function waitForResponse(
  requestId: string,
  timeoutMs: number,
): Promise<AIBridgeResult | null> {
  const startTime = Date.now();
  const pollInterval = 2000; // 2s

  while (Date.now() - startTime < timeoutMs) {
    // Check if request was processed
    const { data: request } = await supabase
      .from('ai_requests')
      .select('status')
      .eq('id', requestId)
      .single();

    if (request?.status === 'completed') {
      // Fetch response
      const { data: response } = await supabase
        .from('ai_responses')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (response) {
        return {
          response: response.conteudo as AIActionableResponse,
          source: 'claude',
          durationMs: Date.now() - startTime,
        };
      }
    }

    if (request?.status === 'error') {
      throw new Error('Claude não conseguiu processar o request');
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return null; // Timeout
}

/**
 * Fallback: chama Edge Function diretamente via OpenRouter
 */
async function callFallback(
  tipo: string,
  entityId?: string,
  contexto?: Record<string, unknown>,
): Promise<AIBridgeResult> {
  const fnName = FALLBACK_FUNCTIONS[tipo];
  if (!fnName) {
    throw new Error(`Sem fallback disponível para tipo: ${tipo}`);
  }

  const startTime = Date.now();
  const { data, error } = await supabase.functions.invoke(fnName, {
    body: { ...contexto, proposta_id: entityId, cliente_id: entityId, pedido_id: entityId },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  return {
    response: data,
    source: 'openrouter',
    durationMs: Date.now() - startTime,
  };
}

/**
 * Hook principal da Ponte MCP
 *
 * Fluxo:
 * 1. Cria request em ai_requests
 * 2. Aguarda Claude processar via MCP (polling)
 * 3. Se timeout: chama Edge Function diretamente (fallback OpenRouter)
 */
export function useAIBridge() {
  return useMutation({
    mutationFn: async (req: AIBridgeRequest): Promise<AIBridgeResult> => {
      const {
        tipo,
        entityType,
        entityId,
        contexto,
        timeoutMs = 60000,
        claudeOnly = false,
      } = req;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Create request
      const { data: aiRequest, error: insertError } = await supabase
        .from('ai_requests')
        .insert({
          tipo,
          entity_type: entityType,
          entity_id: entityId || null,
          contexto: contexto || {},
          solicitante_id: user?.id,
        })
        .select()
        .single();

      if (insertError) throw new Error(`Erro ao criar request: ${insertError.message}`);

      // 2. Wait for Claude
      const claudeResult = await waitForResponse(aiRequest.id, timeoutMs);

      if (claudeResult) {
        return claudeResult;
      }

      // 3. Timeout — try fallback
      if (claudeOnly) {
        // Mark as expired
        await supabase
          .from('ai_requests')
          .update({ status: 'expired' })
          .eq('id', aiRequest.id);
        throw new Error('Claude não respondeu no tempo limite');
      }

      // Mark original as expired, try Edge Function
      await supabase
        .from('ai_requests')
        .update({ status: 'expired', error_message: 'Timeout — fallback para OpenRouter' })
        .eq('id', aiRequest.id);

      const fallbackResult = await callFallback(tipo, entityId, contexto);
      return fallbackResult;
    },
    onError: (err: Error) => showError(err.message || 'Erro ao processar request IA'),
  });
}

/**
 * Hook simplificado para análise de orçamento via ponte
 */
export function useAnalisarOrcamentoBridge() {
  const bridge = useAIBridge();

  return {
    ...bridge,
    mutate: (propostaId: string) =>
      bridge.mutate({
        tipo: 'analisar-orcamento',
        entityType: 'proposta',
        entityId: propostaId,
        contexto: { proposta_id: propostaId },
      }),
    mutateAsync: (propostaId: string) =>
      bridge.mutateAsync({
        tipo: 'analisar-orcamento',
        entityType: 'proposta',
        entityId: propostaId,
        contexto: { proposta_id: propostaId },
      }),
  };
}

/**
 * Hook simplificado para detectar problemas via ponte
 */
export function useDetectarProblemasBridge() {
  const bridge = useAIBridge();

  return {
    ...bridge,
    mutate: (pedidoId: string) =>
      bridge.mutate({
        tipo: 'detectar-problemas',
        entityType: 'pedido',
        entityId: pedidoId,
        contexto: { pedido_id: pedidoId },
      }),
    mutateAsync: (pedidoId: string) =>
      bridge.mutateAsync({
        tipo: 'detectar-problemas',
        entityType: 'pedido',
        entityId: pedidoId,
        contexto: { pedido_id: pedidoId },
      }),
  };
}
