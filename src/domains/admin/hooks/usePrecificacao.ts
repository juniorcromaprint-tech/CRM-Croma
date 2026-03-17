/**
 * usePrecificacao.ts
 * TanStack Query v5 hooks para configuração e cálculo de precificação.
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import {
  fetchConfigPrecificacao,
  fetchRegrasPrecificacao,
  calcPrecoBOM,
} from '../services/precificacaoService';
import type { PrecificacaoItemInput } from '../types/precificacao.types';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const PRECIFICACAO_KEYS = {
  config: () => ['precificacao', 'config'] as const,
  regras: () => ['precificacao', 'regras'] as const,
} as const;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Busca a configuração de precificação ativa.
 */
export function usePrecificacaoConfig() {
  return useQuery({
    queryKey: PRECIFICACAO_KEYS.config(),
    staleTime: 5 * 60 * 1000,
    queryFn: fetchConfigPrecificacao,
  });
}

/**
 * Lista todas as regras de precificação por categoria.
 */
export function useRegrasPrecificacao() {
  return useQuery({
    queryKey: PRECIFICACAO_KEYS.regras(),
    staleTime: 5 * 60 * 1000,
    queryFn: fetchRegrasPrecificacao,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Calcula o preço real de venda a partir do BOM de um modelo.
 *
 * Internamente:
 * 1. Busca config e regras em paralelo
 * 2. Chama calcPrecoBOM com o input fornecido
 */
export function useCalcPrecoBOM() {
  return useMutation({
    mutationFn: async (input: PrecificacaoItemInput) => {
      const [config, regras] = await Promise.all([
        fetchConfigPrecificacao(),
        fetchRegrasPrecificacao(),
      ]);

      if (!config) {
        throw new Error('Configuração de precificação não encontrada. Configure em Administração → Precificação.');
      }

      return calcPrecoBOM(input, config, regras);
    },
  });
}
