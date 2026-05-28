// supabase/functions/ai-shared/anthropic-retry.ts
// Wrapper de retry exponencial para callAnthropic — trata 429 (rate-limit) e 529 (overloaded).
//
// Contexto (ciclo autonomo #22 — 2026-05-28):
// Cluster recorrente de POST 500 em ai-compor-mensagem v24 — root cause confirmado por agent adversarial:
// Anthropic 429/529 (overloaded) em bursts de 14-20 follow-ups consecutivos por cron tick.
// callOpenRouter (alias callAnthropic) throw `Anthropic ${status}: ...`, catch superior retorna 500
// sem retry e sem gravar ai_logs (zero visibilidade). Sem retry exponencial em 429/529.
//
// Uso (drop-in):
//   import { callAnthropicWithRetry } from '../ai-shared/anthropic-retry.ts';
//   const result = await callAnthropicWithRetry(systemPrompt, userPrompt, config);
//
// Mesmo retorno que callAnthropic. Retry SOMENTE em 429/529. Outros erros (incluindo 4xx, abort,
// network) re-throw imediato sem retry — manter latência baixa quando o erro nao é recuperavel.

import { callAnthropic, AICallResult } from './anthropic-provider.ts';
import { AIRequestConfig } from './ai-types.ts';

export interface RetryOptions {
  maxAttempts?: number; // default 3 (1 tentativa + 2 retries)
  baseDelayMs?: number; // default 1000 — 1s, 2s, 4s
  retryStatuses?: number[]; // default [429, 529]
}

function isRetryableAnthropicError(err: unknown, retryStatuses: number[]): boolean {
  if (!(err instanceof Error)) return false;
  // Pattern do anthropic-provider.ts linha 85: `Anthropic ${status}: ${body}`
  const match = err.message.match(/^Anthropic (\d{3}):/);
  if (!match) return false;
  return retryStatuses.includes(Number(match[1]));
}

export async function callAnthropicWithRetry(
  systemPrompt: string,
  userPrompt: string,
  config?: AIRequestConfig,
  retryOpts?: RetryOptions
): Promise<AICallResult> {
  const maxAttempts = retryOpts?.maxAttempts ?? 3;
  const baseDelayMs = retryOpts?.baseDelayMs ?? 1000;
  const retryStatuses = retryOpts?.retryStatuses ?? [429, 529];
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await callAnthropic(systemPrompt, userPrompt, config);
      if (attempt > 0) {
        console.warn(`[anthropic-retry] success after ${attempt} retry(ies)`);
      }
      return result;
    } catch (err) {
      lastError = err;
      const isLast = attempt === maxAttempts - 1;
      if (isLast || !isRetryableAnthropicError(err, retryStatuses)) {
        throw err;
      }
      const delay = baseDelayMs * Math.pow(2, attempt);
      console.warn(
        `[anthropic-retry] attempt ${attempt + 1}/${maxAttempts} failed (${(err as Error).message.slice(0, 80)}), retrying in ${delay}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  // Inalcançavel — laço sempre throw na ultima tentativa via `isLast`
  throw lastError;
}
