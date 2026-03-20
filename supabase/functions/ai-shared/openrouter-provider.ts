// supabase/functions/ai-shared/openrouter-provider.ts

import { AIModel, AIRequestConfig, MODEL_COSTS } from './ai-types.ts';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL: AIModel = 'openai/gpt-4.1-mini';
const DEFAULT_FALLBACK_MODEL: AIModel = 'openai/gpt-4.1-mini';

// Fallback can be overridden via config.fallback_model
let _fallbackOverride: AIModel | null = null;
export function setFallbackModel(model: AIModel) { _fallbackOverride = model; }
function getFallbackModel(): AIModel { return _fallbackOverride ?? DEFAULT_FALLBACK_MODEL; }

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
    // Fallback to cheaper model if primary fails
    const fallback = getFallbackModel();
    if (model !== fallback) {
      console.warn(`Primary model ${model} failed, falling back to ${fallback}:`, error);
      const result = await fetchCompletion(apiKey, fallback, messages, config);
      return buildResult(result, fallback, startTime);
    }
    throw error;
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
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://crm-croma.vercel.app',
        'X-Title': 'Croma AI Engine',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: config?.temperature ?? 0.3,
        max_tokens: config?.max_tokens ?? 2000,
        response_format: { type: 'json_object' },
      }),
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

function buildResult(
  response: OpenRouterResponse,
  model: string,
  startTime: number
): AICallResult {
  const usage = response.usage;
  const costs = MODEL_COSTS[model] ?? MODEL_COSTS['openai/gpt-4.1-mini'];
  const costUsd = (usage.prompt_tokens * costs.input + usage.completion_tokens * costs.output) / 1_000_000;

  return {
    content: response.choices[0]?.message?.content ?? '',
    model_used: model,
    tokens_input: usage.prompt_tokens,
    tokens_output: usage.completion_tokens,
    cost_usd: costUsd,
    duration_ms: Date.now() - startTime,
  };
}
