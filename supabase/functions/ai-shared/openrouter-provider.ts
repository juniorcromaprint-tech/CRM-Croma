// supabase/functions/ai-shared/openrouter-provider.ts

import { AIModel, AIRequestConfig, MODEL_COSTS } from './ai-types.ts';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL: AIModel = 'openai/gpt-4.1-mini';
const DEFAULT_FALLBACK_MODEL: AIModel = 'openai/gpt-4.1-mini';

// Fallback can be overridden via config.fallback_model
let _fallbackOverride: AIModel | null = null;
export function setFallbackModel(model: AIModel) { _fallbackOverride = model; }
function getFallbackModel(): AIModel { return _fallbackOverride ?? DEFAULT_FALLBACK_MODEL; }

// Modelos que suportam response_format: { type: 'json_object' }
// Modelos gratuitos (:free suffix) geralmente NÃO suportam — omitir o parâmetro para eles
const SUPPORTS_JSON_FORMAT = new Set([
  'openai/gpt-4.1-mini',
  'openai/gpt-4.1',
  'openai/gpt-4.1-nano',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'openai/gpt-3.5-turbo',
  'anthropic/claude-sonnet-4',
  'anthropic/claude-haiku-3.5',
  'anthropic/claude-opus-4',
  'google/gemini-2.0-flash-001',
  'google/gemini-2.5-flash-preview',
  'google/gemini-2.5-pro-preview',
  'mistralai/mistral-large',
  'mistralai/mistral-medium',
]);

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
  id: string;
  choices: { message: { content: string } }[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  model: string;
}

export interface AICallResult {
  content: string;
  model_used: string;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  duration_ms: number;
}

export async function callOpenRouter(
  systemPrompt: string,
  userPrompt: string,
  config?: AIRequestConfig
): Promise<AICallResult> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

  const model = config?.model ?? DEFAULT_MODEL;
  const startTime = Date.now();

  const messages: OpenRouterMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  try {
    const result = await fetchCompletion(apiKey, model, messages, config);
    return buildResult(result, model, startTime);
  } catch (error) {
    // Fallback sempre para modelo confiável — nunca o mesmo modelo que falhou
    const fallback = getFallbackModel();
    const safeFallback = (model === fallback || fallback === model) ? DEFAULT_FALLBACK_MODEL : fallback;

    if (model === safeFallback) {
      console.error(`Primary model ${model} failed and equals fallback — no retry possible:`, error);
      throw error;
    }

    console.warn(`Primary model ${model} failed, falling back to ${safeFallback}:`, error);
    const result = await fetchCompletion(apiKey, safeFallback, messages, config);
    return buildResult(result, safeFallback, startTime);
  }
}

async function fetchCompletion(
  apiKey: string,
  model: string,
  messages: OpenRouterMessage[],
  config?: AIRequestConfig
): Promise<OpenRouterResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config?.timeout_ms ?? 30000);

  try {
    // Só envia response_format para modelos que suportam — modelos gratuitos ignoram ou rejeitam
    // text_mode: skip json_object format (used by Telegram bot and other text-based responses)
    const supportsJsonFormat = SUPPORTS_JSON_FORMAT.has(model) && !model.endsWith(':free') && !config?.text_mode;
    const bodyPayload: Record<string, unknown> = {
      model,
      messages,
      temperature: config?.temperature ?? 0.3,
      max_tokens: config?.max_tokens ?? 2000,
    };
    if (supportsJsonFormat) {
      bodyPayload.response_format = { type: 'json_object' };
    }

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://crm-croma.vercel.app',
        'X-Title': 'Croma AI Engine',
      },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenRouter ${response.status}: ${errorBody}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extrai JSON válido de uma string que pode conter texto extra ou markdown code blocks.
 * Necessário para modelos que não suportam response_format e retornam JSON misturado com texto.
 */
function extractJSON(raw: string): string {
  // Já é JSON válido
  try { JSON.parse(raw); return raw; } catch { /* continua */ }

  // Tenta extrair de ```json ... ``` ou ``` ... ```
  const mdMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (mdMatch?.[1]) {
    const candidate = mdMatch[1].trim();
    try { JSON.parse(candidate); return candidate; } catch { /* continua */ }
  }

  // Tenta extrair o maior objeto JSON da string
  const objMatch = raw.match(/(\{[\s\S]*\})/);
  if (objMatch?.[1]) {
    try { JSON.parse(objMatch[1]); return objMatch[1]; } catch { /* continua */ }
  }

  // Último recurso: retorna o raw (vai falhar no parse do caller com mensagem útil)
  console.warn('extractJSON: não foi possível extrair JSON válido, retornando raw');
  return raw;
}

function buildResult(
  response: OpenRouterResponse,
  model: string,
  startTime: number
): AICallResult {
  const usage = response.usage;
  const costs = MODEL_COSTS[model] ?? MODEL_COSTS['openai/gpt-4.1-mini'];
  const costUsd = (usage.prompt_tokens * costs.input + usage.completion_tokens * costs.output) / 1_000_000;

  const rawContent = response.choices[0]?.message?.content ?? '';

  return {
    content: extractJSON(rawContent),
    model_used: model,
    tokens_input: usage.prompt_tokens,
    tokens_output: usage.completion_tokens,
    cost_usd: costUsd,
    duration_ms: Date.now() - startTime,
  };
}
