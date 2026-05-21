// supabase/functions/ai-shared/anthropic-provider.ts
// Provider direto para Anthropic API — substitui OpenRouter para o telegram-webhook.
// Usa a ANTHROPIC_API_KEY que já existe nos secrets do Supabase.

import { AIRequestConfig, MODEL_COSTS } from './ai-types.ts';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

export interface AICallResult {
  content: string;
  model_used: string;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  duration_ms: number;
}

// Mapeamento de modelos OpenRouter → Anthropic (para compatibilidade)
const MODEL_MAP: Record<string, string> = {
  'openai/gpt-4.1-mini': DEFAULT_MODEL,
  'openai/gpt-4.1': 'claude-sonnet-4-20250514',
  'anthropic/claude-haiku-3.5': 'claude-haiku-4-5-20251001',
  'anthropic/claude-sonnet-4': 'claude-sonnet-4-20250514',
};
const ANTHROPIC_COSTS: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
};

function resolveModel(model?: string): string {
  if (!model) return DEFAULT_MODEL;
  if (MODEL_MAP[model]) return MODEL_MAP[model];
  // Se já é um modelo Anthropic válido, usar direto
  if (model.startsWith('claude-')) return model;
  return DEFAULT_MODEL;
}

// 2026-05-21: Anthropic não tem response_format json_object (que o OpenRouter forçava).
// O Claude costuma embrulhar JSON em ```json ... ``` ou em prosa. Extrai o JSON do texto bruto
// para manter compatibilidade drop-in com o openrouter-provider. Texto puro passa intacto.
function extractJSON(raw: string): string {
  try { JSON.parse(raw); return raw; } catch { /* continua */ }
  const md = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (md?.[1]) { const c = md[1].trim(); try { JSON.parse(c); return c; } catch { /* continua */ } }
  const obj = raw.match(/(\{[\s\S]*\})/);
  if (obj?.[1]) { try { JSON.parse(obj[1]); return obj[1]; } catch { /* continua */ } }
  return raw;
}

export async function callAnthropic(
  systemPrompt: string,
  userPrompt: string,
  config?: AIRequestConfig
): Promise<AICallResult> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const model = resolveModel(config?.model);
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config?.timeout_ms ?? 30000);
  // 2026-05-21: claude-opus-4-7 DEPRECOU o parâmetro `temperature` (retorna 400). Só envia p/ modelos que aceitam.
  const reqBody: Record<string, unknown> = {
    model,
    max_tokens: config?.max_tokens ?? 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  };
  if (!model.includes('opus-4-7')) reqBody.temperature = config?.temperature ?? 0.3;
  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(reqBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const content = extractJSON(data.content?.[0]?.text ?? '');
    const usage = data.usage ?? { input_tokens: 0, output_tokens: 0 };
    const costs = ANTHROPIC_COSTS[model] ?? ANTHROPIC_COSTS[DEFAULT_MODEL];    const costUsd = (usage.input_tokens * costs.input + usage.output_tokens * costs.output) / 1_000_000;

    return {
      content,
      model_used: model,
      tokens_input: usage.input_tokens,
      tokens_output: usage.output_tokens,
      cost_usd: costUsd,
      duration_ms: Date.now() - startTime,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Alias para compatibilidade — drop-in replacement do callOpenRouter
export const callOpenRouter = callAnthropic;
