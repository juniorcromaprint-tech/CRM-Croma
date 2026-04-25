// supabase/functions/ai-shared/ai-types.ts

export interface AIResponse {
  summary: string;
  confidence: 'alta' | 'media' | 'baixa';
  risks: AIRisk[];
  suggestions: AISuggestion[];
  required_actions: string[];
  structured_data: Record<string, unknown>;
  model_used: string;
  tokens_used: number;
}

export interface AIRisk {
  level: 'alta' | 'media' | 'baixa';
  description: string;
  action: string;
}

export interface AISuggestion {
  priority: 'alta' | 'media' | 'baixa';
  text: string;
  impact: string;
}

export type AIFunctionName =
  | 'analisar-orcamento'
  | 'resumo-cliente'
  | 'briefing-producao'
  | 'detectar-problemas'
  | 'composicao-produto'
  | 'qualificar-lead'
  | 'compor-mensagem'
  | 'sugerir-compra'
  | 'validar-nfe'
  | 'insights-diarios'
  | 'conciliar-bancario'
  | 'sequenciar-producao'
  | 'preco-dinamico'
  | 'previsao-estoque';

export type AIEntityType = 'proposta' | 'cliente' | 'pedido' | 'geral';

export type AIModel = string;

export interface AILogEntry {
  user_id?: string;
  function_name: AIFunctionName;
  entity_type: AIEntityType;
  entity_id: string | null;
  model_used: string;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  duration_ms: number;
  status: 'success' | 'error' | 'timeout';
  error_message?: string;
}

export interface AIRequestConfig {
  model?: AIModel;
  temperature?: number;
  max_tokens?: number;
  timeout_ms?: number;
  /** When true, skip response_format: json_object — useful for text/chat responses */
  text_mode?: boolean;
}

// Role-based access per function
// 'service' role = chamadas inter-service (mcp-bridge-worker, agent-cron-loop, pg_cron)
export const AI_ROLE_ACCESS: Record<AIFunctionName, string[]> = {
  'analisar-orcamento': ['comercial', 'gerente', 'admin', 'service'],
  'resumo-cliente': ['comercial', 'gerente', 'admin', 'service'],
  'briefing-producao': ['producao', 'gerente', 'admin', 'service'],
  'detectar-problemas': ['gerente', 'admin', 'service'],
  'composicao-produto': ['comercial', 'producao', 'gerente', 'admin', 'service'],
  'qualificar-lead': ['comercial', 'gerente', 'admin', 'service'],
  'compor-mensagem': ['comercial', 'gerente', 'admin', 'service'],
  'sugerir-compra': ['admin', 'gerente', 'compras', 'service'],
  'validar-nfe': ['admin', 'gerente', 'fiscal', 'service'],
  'insights-diarios': ['admin', 'gerente', 'service'],
  'conciliar-bancario': ['admin', 'gerente', 'financeiro', 'service'],
  'sequenciar-producao': ['producao', 'gerente', 'admin', 'service'],
  'preco-dinamico': ['comercial', 'gerente', 'admin', 'service'],
  'previsao-estoque': ['admin', 'gerente', 'compras', 'service'],
};

// Cost per 1M tokens (USD) for estimation
export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'openai/gpt-4.1-mini': { input: 0.40, output: 1.60 },
  'anthropic/claude-sonnet-4': { input: 3.00, output: 15.00 },
};

// ═══════ AI Actionable Response v2 ═══════

export interface AIActionV2 {
  id: string;
  tipo: string;
  severidade: 'critica' | 'importante' | 'dica';
  titulo: string;
  descricao: string;
  campo_alvo: string;
  valor_atual: unknown;
  valor_sugerido: unknown;
  impacto: string;
  aplicavel: boolean;
}

export interface AIActionableResponse {
  summary: string;
  kpis: Record<string, number | string>;
  actions: AIActionV2[];
  model_used: string;
  tokens_used: number;
}
