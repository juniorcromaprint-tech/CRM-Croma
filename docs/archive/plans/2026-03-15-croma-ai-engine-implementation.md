# Croma AI Engine — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an AI intelligence layer to Croma Print ERP with 5 features: budget analysis, customer summary, production briefing, problem detector, and product composition — all powered by OpenRouter via Supabase Edge Functions.

**Architecture:** Edge Functions call OpenRouter API (gpt-4.1-mini default, claude-sonnet-4 fallback). Frontend uses useMutation hooks + contextual buttons. Two new tables (ai_logs, ai_alertas) for auditing and alerts.

**Tech Stack:** Supabase Edge Functions (Deno), OpenRouter API, React 19, TanStack Query v5, shadcn/ui, Tailwind CSS, Zod

**Design doc:** `docs/plans/2026-03-15-croma-ai-engine-design.md`

---

## Sprint AI-1: Infrastructure Base

### Task 1: Create migration for ai_logs and ai_alertas tables

**Files:**
- Create: `supabase/migrations/031_ai_engine_tables.sql`

**Step 1: Write the migration SQL**

```sql
-- 031_ai_engine_tables.sql
-- Croma AI Engine: tables for logging and operational alerts

-- 1. AI usage logs (audit + cost tracking)
CREATE TABLE ai_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  function_name text NOT NULL,
  entity_type text,
  entity_id uuid,
  model_used text NOT NULL,
  tokens_input int NOT NULL DEFAULT 0,
  tokens_output int NOT NULL DEFAULT 0,
  cost_usd numeric(10,6) DEFAULT 0,
  duration_ms int,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ai_logs_user ON ai_logs(user_id, created_at DESC);
CREATE INDEX idx_ai_logs_entity ON ai_logs(entity_type, entity_id);

-- 2. Operational alerts (cron + manual detection)
CREATE TABLE ai_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  severidade text NOT NULL DEFAULT 'media',
  titulo text NOT NULL,
  descricao text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  resolvido boolean DEFAULT false,
  resolvido_por uuid REFERENCES auth.users(id),
  resolvido_em timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ai_alertas_active ON ai_alertas(resolvido, severidade) WHERE NOT resolvido;
CREATE INDEX idx_ai_alertas_entity ON ai_alertas(entity_type, entity_id);

-- 3. RLS
ALTER TABLE ai_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_own_logs" ON ai_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "service_role_insert_logs" ON ai_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "authenticated_read_alertas" ON ai_alertas
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_resolve_alertas" ON ai_alertas
  FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "service_role_manage_alertas" ON ai_alertas
  FOR ALL USING (true);
```

**Step 2: Execute migration on Supabase**

Run the SQL above in the Supabase SQL editor at `supabase.com/dashboard/project/djwjmfgplnqyffdcgdaw/sql`. Use the MCP tool `mcp__d972dcbc-07a8-4bda-9c80-f932664e8c48__execute_sql` if available.

**Step 3: Commit**

```bash
git add supabase/migrations/031_ai_engine_tables.sql
git commit -m "feat(ai): add ai_logs and ai_alertas tables with RLS"
```

---

### Task 2: Create ai-shared types module

**Files:**
- Create: `supabase/functions/ai-shared/ai-types.ts`

**Step 1: Write the shared types**

```typescript
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
  | 'composicao-produto';

export type AIEntityType = 'proposta' | 'cliente' | 'pedido' | 'geral';

export type AIModel = 'openai/gpt-4.1-mini' | 'anthropic/claude-sonnet-4';

export interface AILogEntry {
  user_id: string;
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
}

// Role-based access per function
export const AI_ROLE_ACCESS: Record<AIFunctionName, string[]> = {
  'analisar-orcamento': ['comercial', 'gerente', 'admin'],
  'resumo-cliente': ['comercial', 'gerente', 'admin'],
  'briefing-producao': ['producao', 'gerente', 'admin'],
  'detectar-problemas': ['gerente', 'admin'],
  'composicao-produto': ['comercial', 'producao', 'gerente', 'admin'],
};

// Cost per 1M tokens (USD) for estimation
export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'openai/gpt-4.1-mini': { input: 0.40, output: 1.60 },
  'anthropic/claude-sonnet-4': { input: 3.00, output: 15.00 },
};
```

**Step 2: Commit**

```bash
git add supabase/functions/ai-shared/ai-types.ts
git commit -m "feat(ai): add shared AI types, roles, and model costs"
```

---

### Task 3: Create OpenRouter provider

**Files:**
- Create: `supabase/functions/ai-shared/openrouter-provider.ts`

**Step 1: Write the provider**

```typescript
// supabase/functions/ai-shared/openrouter-provider.ts

import { AIModel, AIRequestConfig, MODEL_COSTS } from './ai-types.ts';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL: AIModel = 'openai/gpt-4.1-mini';
const FALLBACK_MODEL: AIModel = 'anthropic/claude-sonnet-4';

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
    // Fallback to stronger model if primary fails
    if (model !== FALLBACK_MODEL) {
      console.warn(`Primary model ${model} failed, falling back to ${FALLBACK_MODEL}:`, error);
      const result = await fetchCompletion(apiKey, FALLBACK_MODEL, messages, config);
      return buildResult(result, FALLBACK_MODEL, startTime);
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
```

**Step 2: Commit**

```bash
git add supabase/functions/ai-shared/openrouter-provider.ts
git commit -m "feat(ai): add OpenRouter provider with fallback and cost tracking"
```

---

### Task 4: Create AI logger and CORS/auth helpers

**Files:**
- Create: `supabase/functions/ai-shared/ai-logger.ts`
- Create: `supabase/functions/ai-shared/ai-helpers.ts`

**Step 1: Write the logger**

```typescript
// supabase/functions/ai-shared/ai-logger.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AILogEntry } from './ai-types.ts';

export async function logAICall(entry: AILogEntry): Promise<void> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabase.from('ai_logs').insert(entry);
  } catch (error) {
    // Log but don't fail the main request
    console.error('Failed to log AI call:', error);
  }
}
```

**Step 2: Write the helpers (CORS, auth, role check)**

```typescript
// supabase/functions/ai-shared/ai-helpers.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AIFunctionName, AI_ROLE_ACCESS } from './ai-types.ts';

const ALLOWED_ORIGINS = [
  'https://crm-croma.vercel.app',
  'https://campo-croma.vercel.app',
  'http://localhost:5173',
  'http://localhost:8080',
];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Content-Type, Authorization',
  };
}

export function handleCorsOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }
  return null;
}

export function jsonResponse(data: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export interface AuthResult {
  userId: string;
  userRole: string;
}

export async function authenticateAndAuthorize(
  req: Request,
  functionName: AIFunctionName
): Promise<{ auth: AuthResult | null; error: Response | null }> {
  const corsHeaders = getCorsHeaders(req);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      auth: null,
      error: jsonResponse({ error: 'Nao autorizado' }, 401, corsHeaders),
    };
  }

  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) {
    return {
      auth: null,
      error: jsonResponse({ error: 'Token invalido' }, 401, corsHeaders),
    };
  }

  // Get user role from profiles table
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role ?? 'comercial';
  const allowedRoles = AI_ROLE_ACCESS[functionName];

  if (!allowedRoles.includes(role)) {
    return {
      auth: null,
      error: jsonResponse({ error: 'Sem permissao para esta funcao de IA' }, 403, corsHeaders),
    };
  }

  return { auth: { userId: user.id, userRole: role }, error: null };
}

export function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}
```

**Step 3: Commit**

```bash
git add supabase/functions/ai-shared/ai-logger.ts supabase/functions/ai-shared/ai-helpers.ts
git commit -m "feat(ai): add AI logger, CORS helpers, and role-based auth"
```

---

### Task 5: Create prompt builder

**Files:**
- Create: `supabase/functions/ai-shared/prompt-builder.ts`

**Step 1: Write the prompt builder**

```typescript
// supabase/functions/ai-shared/prompt-builder.ts

const CROMA_SYSTEM_CONTEXT = `Voce e o assistente de IA da Croma Print Comunicacao Visual.
A Croma produz banners, faixas, adesivos, placas, totens, fachadas, paineis e materiais de comunicacao visual sob encomenda.
Clientes: redes de lojas, franquias, fabricantes de calcados, grandes varejistas.
Diferencial: producao propria, atendimento nacional, padronizacao de redes.

REGRAS:
- Responda SEMPRE em portugues brasileiro
- Responda SEMPRE em formato JSON valido
- Considere sempre: margem, producao, instalacao, prazo, acabamento, frete, risco operacional e financeiro
- Seja direto e pratico, sem enrolacao
- Use valores em BRL (R$)
- Nao invente dados — se nao tem informacao, diga que falta`;

export function buildSystemPrompt(taskInstructions: string): string {
  return `${CROMA_SYSTEM_CONTEXT}\n\n${taskInstructions}`;
}

export function buildUserPrompt(context: Record<string, unknown>): string {
  return JSON.stringify(context, null, 2);
}

// Task-specific system prompt additions

export const PROMPTS = {
  analisarOrcamento: `TAREFA: Analisar este orcamento e retornar analise critica.

Retorne JSON com esta estrutura EXATA:
{
  "summary": "resumo em 1-2 frases da analise",
  "confidence": "alta|media|baixa",
  "risks": [{"level": "alta|media|baixa", "description": "descricao", "action": "o que fazer"}],
  "suggestions": [{"priority": "alta|media|baixa", "text": "sugestao", "impact": "impacto esperado"}],
  "required_actions": ["acao obrigatoria 1", "acao 2"],
  "structured_data": {
    "margem_estimada": 0.0,
    "itens_faltantes": ["instalacao", "frete"],
    "preco_sugerido": 0.0,
    "comparativo_historico": "acima|abaixo|dentro da media"
  }
}

CHECKLIST de analise:
1. Margem estimada — alerta se < 30%
2. Itens faltantes — instalacao incluida? frete? acabamento? arte?
3. Prazo vs volume — prazo realista para a quantidade?
4. Comparar com ticket medio do cliente
5. Oportunidade de upsell (acabamento premium, quantidade maior)
6. Risco operacional (material especial, instalacao complexa)`,

  resumoCliente: `TAREFA: Gerar resumo inteligente deste cliente.

Retorne JSON com esta estrutura EXATA:
{
  "summary": "resumo em 1-2 frases do perfil do cliente",
  "confidence": "alta|media|baixa",
  "risks": [{"level": "alta|media|baixa", "description": "descricao", "action": "o que fazer"}],
  "suggestions": [{"priority": "alta|media|baixa", "text": "sugestao", "impact": "impacto esperado"}],
  "required_actions": [],
  "structured_data": {
    "ticket_medio": 0.0,
    "total_pedidos": 0,
    "produtos_frequentes": ["banner", "adesivo"],
    "risco": "baixo|medio|alto",
    "padrao_compra": "descricao do padrao",
    "sugestao_abordagem": "como abordar este cliente"
  }
}

ANALISE:
1. Ticket medio e tendencia (subindo/caindo/estavel)
2. Produtos mais comprados e sazonalidade
3. Risco comercial (inadimplencia, atrasos)
4. Padrao de compra (recorrente, esporadico, por campanha)
5. Sugestao de abordagem personalizada`,

  briefingProducao: `TAREFA: Gerar briefing tecnico de producao a partir do pedido.

Retorne JSON com esta estrutura EXATA:
{
  "summary": "resumo do pedido para producao",
  "confidence": "alta|media|baixa",
  "risks": [{"level": "alta|media|baixa", "description": "descricao", "action": "o que fazer"}],
  "suggestions": [],
  "required_actions": ["pendencia 1"],
  "structured_data": {
    "itens_briefing": [{"produto": "", "medidas": "", "material": "", "acabamento": "", "quantidade": 0, "observacoes": ""}],
    "materiais_necessarios": [{"nome": "", "quantidade": 0, "unidade": "", "disponivel_estoque": false}],
    "pendencias": ["arte nao aprovada", "endereco nao confirmado"],
    "prazo_producao": "X dias uteis",
    "observacoes_criticas": ["observacao 1"]
  }
}

CHECKLIST:
1. Cada item com: produto, medidas exatas, material, acabamento, quantidade
2. Lista consolidada de materiais com quantidades totais
3. Pendencias bloqueantes (arte, aprovacao, endereco, pagamento)
4. Prazo realista de producao
5. Riscos (material indisponivel, instalacao complexa, prazo apertado)`,

  detectarProblemas: `TAREFA: Analisar dados operacionais e priorizar problemas encontrados.

Retorne JSON com esta estrutura EXATA:
{
  "summary": "resumo geral da situacao operacional",
  "confidence": "alta|media|baixa",
  "risks": [],
  "suggestions": [{"priority": "alta|media|baixa", "text": "sugestao", "impact": "impacto esperado"}],
  "required_actions": ["acao urgente 1"],
  "structured_data": {
    "problemas": [
      {
        "tipo": "orcamento_vencido|pedido_parado|sem_followup|sem_faturamento|sem_responsavel",
        "severidade": "alta|media|baixa",
        "titulo": "titulo curto",
        "descricao": "descricao detalhada",
        "entity_type": "proposta|pedido|cliente",
        "entity_id": "uuid",
        "acao_sugerida": "o que fazer"
      }
    ],
    "total_por_severidade": {"alta": 0, "media": 0, "baixa": 0}
  }
}

Priorize por impacto financeiro e urgencia.`,

  composicaoProduto: `TAREFA: Sugerir composicao de produto a partir da descricao.

Retorne JSON com esta estrutura EXATA:
{
  "summary": "resumo da sugestao de composicao",
  "confidence": "alta|media|baixa",
  "risks": [{"level": "alta|media|baixa", "description": "descricao", "action": "o que fazer"}],
  "suggestions": [{"priority": "alta|media|baixa", "text": "sugestao", "impact": "impacto esperado"}],
  "required_actions": [],
  "structured_data": {
    "modelo_sugerido": {"id": "uuid ou null", "nome": "", "categoria": ""},
    "materiais": [{"material_id": "uuid ou null", "nome": "", "quantidade_estimada": 0, "unidade": "", "preco_unitario": 0}],
    "acabamentos": [{"acabamento_id": "uuid ou null", "nome": "", "obrigatorio": true}],
    "processos": [{"processo": "", "ordem": 1, "tempo_estimado_min": 0}],
    "servicos_sugeridos": [{"servico_id": "uuid ou null", "nome": "", "motivo": ""}],
    "custo_estimado": 0,
    "observacoes": ["observacao 1"]
  }
}

REGRAS:
1. Sempre buscar o modelo mais proximo dos existentes no catalogo
2. Usar material_id/acabamento_id reais quando encontrar match
3. Usar null nos IDs quando sugerir algo que nao existe no catalogo
4. Estimar quantidades baseado nas medidas informadas
5. Sugerir servicos relevantes (instalacao se > 2m, arte se nao mencionada)
6. Alertar sobre acabamentos obrigatorios vs opcionais`,
};
```

**Step 2: Commit**

```bash
git add supabase/functions/ai-shared/prompt-builder.ts
git commit -m "feat(ai): add prompt builder with task-specific prompts"
```

---

### Task 6: Create frontend AI types and shared components

**Files:**
- Create: `src/domains/ai/types/ai.types.ts`
- Create: `src/domains/ai/components/AIButton.tsx`
- Create: `src/domains/ai/components/AIResultPanel.tsx`

**Step 1: Write frontend AI types**

```typescript
// src/domains/ai/types/ai.types.ts

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

// Structured data per function
export interface OrcamentoAnaliseData {
  margem_estimada: number;
  itens_faltantes: string[];
  preco_sugerido: number;
  comparativo_historico: string;
}

export interface ClienteResumoData {
  ticket_medio: number;
  total_pedidos: number;
  produtos_frequentes: string[];
  risco: string;
  padrao_compra: string;
  sugestao_abordagem: string;
}

export interface BriefingProducaoData {
  itens_briefing: {
    produto: string;
    medidas: string;
    material: string;
    acabamento: string;
    quantidade: number;
    observacoes: string;
  }[];
  materiais_necessarios: {
    nome: string;
    quantidade: number;
    unidade: string;
    disponivel_estoque: boolean;
  }[];
  pendencias: string[];
  prazo_producao: string;
  observacoes_criticas: string[];
}

export interface DetectarProblemasData {
  problemas: {
    tipo: string;
    severidade: 'alta' | 'media' | 'baixa';
    titulo: string;
    descricao: string;
    entity_type: string;
    entity_id: string;
    acao_sugerida: string;
  }[];
  total_por_severidade: { alta: number; media: number; baixa: number };
}

export interface ComposicaoProdutoData {
  modelo_sugerido: { id: string | null; nome: string; categoria: string };
  materiais: {
    material_id: string | null;
    nome: string;
    quantidade_estimada: number;
    unidade: string;
    preco_unitario: number;
  }[];
  acabamentos: {
    acabamento_id: string | null;
    nome: string;
    obrigatorio: boolean;
  }[];
  processos: {
    processo: string;
    ordem: number;
    tempo_estimado_min: number;
  }[];
  servicos_sugeridos: {
    servico_id: string | null;
    nome: string;
    motivo: string;
  }[];
  custo_estimado: number;
  observacoes: string[];
}
```

**Step 2: Write AIButton component**

```tsx
// src/domains/ai/components/AIButton.tsx

import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AIButtonProps {
  label: string;
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default';
  className?: string;
}

export default function AIButton({
  label,
  onClick,
  isLoading = false,
  disabled = false,
  variant = 'outline',
  size = 'sm',
  className = '',
}: AIButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`rounded-xl gap-1.5 ${className}`}
    >
      {isLoading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Sparkles size={14} className="text-amber-500" />
      )}
      {isLoading ? 'Analisando...' : label}
    </Button>
  );
}
```

**Step 3: Write AIResultPanel component**

```tsx
// src/domains/ai/components/AIResultPanel.tsx

import { AlertTriangle, CheckCircle, Info, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { AIResponse, AIRisk, AISuggestion } from '../types/ai.types';

interface AIResultPanelProps {
  result: AIResponse;
  title: string;
  onClose?: () => void;
  children?: React.ReactNode;
}

const CONFIDENCE_STYLES = {
  alta: 'bg-green-100 text-green-700',
  media: 'bg-amber-100 text-amber-700',
  baixa: 'bg-red-100 text-red-700',
};

const SEVERITY_CONFIG = {
  alta: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', Icon: XCircle, iconClass: 'text-red-500' },
  media: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', Icon: AlertTriangle, iconClass: 'text-amber-500' },
  baixa: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', Icon: Info, iconClass: 'text-blue-500' },
};

export default function AIResultPanel({ result, title, onClose, children }: AIResultPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    risks: true,
    suggestions: true,
    actions: true,
  });

  const toggleSection = (section: string) =>
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3 flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <span>Croma AI</span>
          <span className="text-blue-200">|</span>
          <span className="font-normal">{title}</span>
        </h3>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CONFIDENCE_STYLES[result.confidence]}`}>
            {result.confidence}
          </span>
          {onClose && (
            <button onClick={onClose} className="text-white/70 hover:text-white text-sm">
              Fechar
            </button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Summary */}
        <p className="text-sm text-slate-700">{result.summary}</p>

        {/* Risks */}
        {result.risks.length > 0 && (
          <CollapsibleSection
            title={`Riscos (${result.risks.length})`}
            expanded={expandedSections.risks}
            onToggle={() => toggleSection('risks')}
          >
            <div className="space-y-2">
              {result.risks.map((risk, i) => (
                <RiskItem key={i} risk={risk} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Suggestions */}
        {result.suggestions.length > 0 && (
          <CollapsibleSection
            title={`Sugestoes (${result.suggestions.length})`}
            expanded={expandedSections.suggestions}
            onToggle={() => toggleSection('suggestions')}
          >
            <div className="space-y-2">
              {result.suggestions.map((s, i) => (
                <SuggestionItem key={i} suggestion={s} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Required Actions */}
        {result.required_actions.length > 0 && (
          <CollapsibleSection
            title={`Acoes Obrigatorias (${result.required_actions.length})`}
            expanded={expandedSections.actions}
            onToggle={() => toggleSection('actions')}
          >
            <ul className="space-y-1">
              {result.required_actions.map((action, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                  <CheckCircle size={12} className="text-blue-500 mt-0.5 shrink-0" />
                  {action}
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        )}

        {/* Custom content (structured_data rendered by parent) */}
        {children}
      </div>

      {/* Footer */}
      <div className="px-5 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
        <span>Modelo: {result.model_used}</span>
        <span>{result.tokens_used} tokens</span>
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-800 w-full"
      >
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {title}
      </button>
      {expanded && <div className="mt-2">{children}</div>}
    </div>
  );
}

function RiskItem({ risk }: { risk: AIRisk }) {
  const style = SEVERITY_CONFIG[risk.level];
  return (
    <div className={`flex items-start gap-2 ${style.bg} border ${style.border} rounded-xl p-3 text-xs ${style.text}`}>
      <style.Icon size={14} className={`${style.iconClass} shrink-0 mt-0.5`} />
      <div>
        <span className="font-semibold">{risk.description}</span>
        {risk.action && <span className="block mt-0.5 opacity-80">{risk.action}</span>}
      </div>
    </div>
  );
}

function SuggestionItem({ suggestion }: { suggestion: AISuggestion }) {
  const priorityColor = {
    alta: 'text-red-600 bg-red-50',
    media: 'text-amber-600 bg-amber-50',
    baixa: 'text-blue-600 bg-blue-50',
  }[suggestion.priority];

  return (
    <div className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 rounded-xl p-3">
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${priorityColor}`}>
        {suggestion.priority}
      </span>
      <div>
        <span>{suggestion.text}</span>
        {suggestion.impact && <span className="block mt-0.5 text-slate-400">{suggestion.impact}</span>}
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/domains/ai/
git commit -m "feat(ai): add frontend AI types, AIButton, and AIResultPanel components"
```

---

### Task 7: Set OPENROUTER_API_KEY secret in Supabase

**Step 1: Set secret**

Go to Supabase Dashboard > Project Settings > Edge Functions > Secrets, and add:
- Name: `OPENROUTER_API_KEY`
- Value: (the OpenRouter API key from https://openrouter.ai/keys)

Alternatively via CLI:
```bash
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

**Step 2: Verify secret is accessible**

This will be verified in Task 8 integration test.

---

## Sprint AI-2: Orcamento + Composicao

### Task 8: Create ai-analisar-orcamento Edge Function

**Files:**
- Create: `supabase/functions/ai-analisar-orcamento/index.ts`

**Step 1: Write the Edge Function**

```typescript
// supabase/functions/ai-analisar-orcamento/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCorsOptions, getCorsHeaders, jsonResponse, authenticateAndAuthorize, getServiceClient } from '../ai-shared/ai-helpers.ts';
import { callOpenRouter } from '../ai-shared/openrouter-provider.ts';
import { buildSystemPrompt, buildUserPrompt, PROMPTS } from '../ai-shared/prompt-builder.ts';
import { logAICall } from '../ai-shared/ai-logger.ts';

serve(async (req: Request) => {
  const corsResponse = handleCorsOptions(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // Auth + role check
    const { auth, error: authError } = await authenticateAndAuthorize(req, 'analisar-orcamento');
    if (authError) return authError;

    const { proposta_id } = await req.json();
    if (!proposta_id) {
      return jsonResponse({ error: 'proposta_id obrigatorio' }, 400, corsHeaders);
    }

    const supabase = getServiceClient();

    // Load context
    const { data: proposta, error: pErr } = await supabase
      .from('propostas')
      .select(`
        id, numero, titulo, status, total, subtotal, desconto, prazo_entrega,
        created_at, observacoes,
        cliente:clientes(id, nome_fantasia, razao_social, segmento, classificacao),
        itens:proposta_itens(
          id, descricao, quantidade, largura, altura, preco_unitario, preco_total,
          modelo_id, unidade,
          materiais:proposta_item_materiais(material_id, quantidade, preco_unitario, preco_total, nome_material),
          acabamentos:proposta_item_acabamentos(acabamento_id, preco, nome_acabamento)
        ),
        servicos:proposta_servicos(servico_id, preco, nome_servico)
      `)
      .eq('id', proposta_id)
      .single();

    if (pErr || !proposta) {
      return jsonResponse({ error: 'Proposta nao encontrada' }, 404, corsHeaders);
    }

    // Load pricing rules
    const { data: regras } = await supabase
      .from('regras_precificacao')
      .select('categoria, markup_minimo, markup_sugerido');

    // Load client history
    const clienteId = (proposta.cliente as any)?.id;
    let historico = null;
    if (clienteId) {
      const { data } = await supabase
        .from('propostas')
        .select('total, status, created_at')
        .eq('cliente_id', clienteId)
        .is('excluido_em', null)
        .order('created_at', { ascending: false })
        .limit(10);
      historico = data;
    }

    // Build context
    const context = {
      proposta,
      regras_precificacao: regras ?? [],
      historico_cliente: historico ?? [],
      data_atual: new Date().toISOString().split('T')[0],
    };

    // Call AI
    const systemPrompt = buildSystemPrompt(PROMPTS.analisarOrcamento);
    const userPrompt = buildUserPrompt(context);
    const result = await callOpenRouter(systemPrompt, userPrompt);

    // Parse AI response
    const aiData = JSON.parse(result.content);
    const response = {
      ...aiData,
      model_used: result.model_used,
      tokens_used: result.tokens_input + result.tokens_output,
    };

    // Log
    await logAICall({
      user_id: auth!.userId,
      function_name: 'analisar-orcamento',
      entity_type: 'proposta',
      entity_id: proposta_id,
      model_used: result.model_used,
      tokens_input: result.tokens_input,
      tokens_output: result.tokens_output,
      cost_usd: result.cost_usd,
      duration_ms: result.duration_ms,
      status: 'success',
    });

    return jsonResponse(response, 200, corsHeaders);
  } catch (error) {
    console.error('ai-analisar-orcamento error:', error);
    return jsonResponse(
      { error: 'Erro ao analisar orcamento', detail: error.message },
      500,
      corsHeaders
    );
  }
});
```

**Step 2: Commit**

```bash
git add supabase/functions/ai-analisar-orcamento/
git commit -m "feat(ai): add ai-analisar-orcamento Edge Function"
```

---

### Task 9: Create ai-composicao-produto Edge Function

**Files:**
- Create: `supabase/functions/ai-composicao-produto/index.ts`

**Step 1: Write the Edge Function**

```typescript
// supabase/functions/ai-composicao-produto/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCorsOptions, getCorsHeaders, jsonResponse, authenticateAndAuthorize, getServiceClient } from '../ai-shared/ai-helpers.ts';
import { callOpenRouter } from '../ai-shared/openrouter-provider.ts';
import { buildSystemPrompt, buildUserPrompt, PROMPTS } from '../ai-shared/prompt-builder.ts';
import { logAICall } from '../ai-shared/ai-logger.ts';

serve(async (req: Request) => {
  const corsResponse = handleCorsOptions(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { auth, error: authError } = await authenticateAndAuthorize(req, 'composicao-produto');
    if (authError) return authError;

    const { descricao } = await req.json();
    if (!descricao || typeof descricao !== 'string' || descricao.trim().length < 3) {
      return jsonResponse({ error: 'descricao obrigatoria (min 3 caracteres)' }, 400, corsHeaders);
    }

    const supabase = getServiceClient();

    // Load catalog data
    const [modelosRes, materiaisRes, acabamentosRes, servicosRes] = await Promise.all([
      supabase.from('produto_modelos').select('id, nome, categoria, markup')
        .order('nome'),
      supabase.from('materiais').select('id, nome, unidade, preco_medio, categoria')
        .not('preco_medio', 'is', null)
        .order('nome'),
      supabase.from('acabamentos').select('id, nome, preco_padrao')
        .order('nome'),
      supabase.from('servicos').select('id, nome, preco_padrao')
        .order('nome'),
    ]);

    // Load model compositions (for reference)
    const { data: composicoes } = await supabase
      .from('modelo_materiais')
      .select('modelo_id, material_id, quantidade, unidade, materiais(nome)')
      .limit(200);

    const { data: processos } = await supabase
      .from('modelo_processos')
      .select('modelo_id, processo, ordem, tempo_estimado')
      .limit(200);

    const context = {
      descricao_produto: descricao.trim(),
      catalogo: {
        modelos: modelosRes.data ?? [],
        materiais: materiaisRes.data ?? [],
        acabamentos: acabamentosRes.data ?? [],
        servicos: servicosRes.data ?? [],
      },
      composicoes_existentes: composicoes ?? [],
      processos_existentes: processos ?? [],
    };

    const systemPrompt = buildSystemPrompt(PROMPTS.composicaoProduto);
    const userPrompt = buildUserPrompt(context);
    const result = await callOpenRouter(systemPrompt, userPrompt);

    const aiData = JSON.parse(result.content);
    const response = {
      ...aiData,
      model_used: result.model_used,
      tokens_used: result.tokens_input + result.tokens_output,
    };

    await logAICall({
      user_id: auth!.userId,
      function_name: 'composicao-produto',
      entity_type: 'geral',
      entity_id: null,
      model_used: result.model_used,
      tokens_input: result.tokens_input,
      tokens_output: result.tokens_output,
      cost_usd: result.cost_usd,
      duration_ms: result.duration_ms,
      status: 'success',
    });

    return jsonResponse(response, 200, corsHeaders);
  } catch (error) {
    console.error('ai-composicao-produto error:', error);
    return jsonResponse(
      { error: 'Erro ao sugerir composicao', detail: error.message },
      500,
      corsHeaders
    );
  }
});
```

**Step 2: Commit**

```bash
git add supabase/functions/ai-composicao-produto/
git commit -m "feat(ai): add ai-composicao-produto Edge Function"
```

---

### Task 10: Create frontend hooks for orcamento and composicao

**Files:**
- Create: `src/domains/ai/hooks/useAnalisarOrcamento.ts`
- Create: `src/domains/ai/hooks/useComposicaoProduto.ts`

**Step 1: Write useAnalisarOrcamento hook**

```typescript
// src/domains/ai/hooks/useAnalisarOrcamento.ts

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import type { AIResponse } from '../types/ai.types';

export function useAnalisarOrcamento() {
  return useMutation({
    mutationFn: async (propostaId: string): Promise<AIResponse> => {
      const { data, error } = await supabase.functions.invoke('ai-analisar-orcamento', {
        body: { proposta_id: propostaId },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as AIResponse;
    },
    onError: (err: Error) => showError(err.message || 'Erro ao analisar orcamento'),
  });
}
```

**Step 2: Write useComposicaoProduto hook**

```typescript
// src/domains/ai/hooks/useComposicaoProduto.ts

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import type { AIResponse } from '../types/ai.types';

export function useComposicaoProduto() {
  return useMutation({
    mutationFn: async (descricao: string): Promise<AIResponse> => {
      const { data, error } = await supabase.functions.invoke('ai-composicao-produto', {
        body: { descricao },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as AIResponse;
    },
    onError: (err: Error) => showError(err.message || 'Erro ao sugerir composicao'),
  });
}
```

**Step 3: Commit**

```bash
git add src/domains/ai/hooks/
git commit -m "feat(ai): add useAnalisarOrcamento and useComposicaoProduto hooks"
```

---

### Task 11: Create OrcamentoAnalise result component

**Files:**
- Create: `src/domains/ai/components/OrcamentoAnalise.tsx`

**Step 1: Write the component**

```tsx
// src/domains/ai/components/OrcamentoAnalise.tsx

import AIResultPanel from './AIResultPanel';
import { brl } from '@/shared/utils/format';
import type { AIResponse, OrcamentoAnaliseData } from '../types/ai.types';

interface OrcamentoAnaliseProps {
  result: AIResponse;
  onClose: () => void;
}

export default function OrcamentoAnalise({ result, onClose }: OrcamentoAnaliseProps) {
  const data = result.structured_data as unknown as OrcamentoAnaliseData;

  return (
    <AIResultPanel result={result} title="Analise do Orcamento" onClose={onClose}>
      {data && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          {data.margem_estimada != null && (
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">Margem Estimada</span>
              <p className={`text-lg font-bold ${data.margem_estimada < 30 ? 'text-red-600' : 'text-green-600'}`}>
                {data.margem_estimada.toFixed(1)}%
              </p>
            </div>
          )}
          {data.preco_sugerido != null && data.preco_sugerido > 0 && (
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">Preco Sugerido</span>
              <p className="text-lg font-bold text-slate-800">{brl(data.preco_sugerido)}</p>
            </div>
          )}
          {data.comparativo_historico && (
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">vs Historico</span>
              <p className="text-sm font-semibold text-slate-700 mt-1">{data.comparativo_historico}</p>
            </div>
          )}
          {data.itens_faltantes?.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-3">
              <span className="text-[10px] text-amber-500 uppercase tracking-wide">Itens Faltantes</span>
              <ul className="mt-1 space-y-0.5">
                {data.itens_faltantes.map((item, i) => (
                  <li key={i} className="text-xs text-amber-700">- {item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </AIResultPanel>
  );
}
```

**Step 2: Commit**

```bash
git add src/domains/ai/components/OrcamentoAnalise.tsx
git commit -m "feat(ai): add OrcamentoAnalise result component"
```

---

### Task 12: Create ComposicaoSugestao result component

**Files:**
- Create: `src/domains/ai/components/ComposicaoSugestao.tsx`

**Step 1: Write the component**

```tsx
// src/domains/ai/components/ComposicaoSugestao.tsx

import AIResultPanel from './AIResultPanel';
import { brl } from '@/shared/utils/format';
import type { AIResponse, ComposicaoProdutoData } from '../types/ai.types';

interface ComposicaoSugestaoProps {
  result: AIResponse;
  onClose: () => void;
  onApply?: (data: ComposicaoProdutoData) => void;
}

export default function ComposicaoSugestao({ result, onClose, onApply }: ComposicaoSugestaoProps) {
  const data = result.structured_data as unknown as ComposicaoProdutoData;

  return (
    <AIResultPanel result={result} title="Composicao Sugerida" onClose={onClose}>
      {data && (
        <div className="space-y-3 mt-3">
          {/* Modelo sugerido */}
          {data.modelo_sugerido?.nome && (
            <div className="bg-blue-50 rounded-xl p-3">
              <span className="text-[10px] text-blue-500 uppercase tracking-wide">Modelo Base</span>
              <p className="text-sm font-semibold text-blue-800 mt-1">
                {data.modelo_sugerido.nome}
                {data.modelo_sugerido.categoria && (
                  <span className="ml-2 text-xs font-normal text-blue-500">({data.modelo_sugerido.categoria})</span>
                )}
              </p>
            </div>
          )}

          {/* Materiais */}
          {data.materiais?.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-slate-600">Materiais ({data.materiais.length})</span>
              <div className="mt-1 space-y-1">
                {data.materiais.map((m, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-xs">
                    <span className="text-slate-700">{m.nome}</span>
                    <span className="text-slate-500">
                      {m.quantidade_estimada} {m.unidade} | {brl(m.preco_unitario)}/{m.unidade}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Acabamentos */}
          {data.acabamentos?.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-slate-600">Acabamentos ({data.acabamentos.length})</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {data.acabamentos.map((a, i) => (
                  <span
                    key={i}
                    className={`px-2 py-1 rounded-lg text-xs ${a.obrigatorio ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}
                  >
                    {a.nome} {a.obrigatorio && '*'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Custo estimado */}
          {data.custo_estimado > 0 && (
            <div className="bg-green-50 rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs text-green-700">Custo Estimado de Materiais</span>
              <span className="font-bold text-green-800">{brl(data.custo_estimado)}</span>
            </div>
          )}

          {/* Apply button */}
          {onApply && (
            <button
              onClick={() => onApply(data)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl py-2.5 transition-colors"
            >
              Aplicar Composicao ao Orcamento
            </button>
          )}
        </div>
      )}
    </AIResultPanel>
  );
}
```

**Step 2: Commit**

```bash
git add src/domains/ai/components/ComposicaoSugestao.tsx
git commit -m "feat(ai): add ComposicaoSugestao result component"
```

---

### Task 13: Integrate AI buttons into OrcamentoEditorPage

**Files:**
- Modify: `src/domains/comercial/pages/OrcamentoEditorPage.tsx`

**Step 1: Add imports and state**

At the top of OrcamentoEditorPage.tsx, add these imports:

```typescript
import AIButton from '@/domains/ai/components/AIButton';
import OrcamentoAnalise from '@/domains/ai/components/OrcamentoAnalise';
import ComposicaoSugestao from '@/domains/ai/components/ComposicaoSugestao';
import { useAnalisarOrcamento } from '@/domains/ai/hooks/useAnalisarOrcamento';
import { useComposicaoProduto } from '@/domains/ai/hooks/useComposicaoProduto';
import type { AIResponse } from '@/domains/ai/types/ai.types';
```

Add state variables inside the component:

```typescript
const [analiseResult, setAnaliseResult] = useState<AIResponse | null>(null);
const [composicaoResult, setComposicaoResult] = useState<AIResponse | null>(null);
const analisarOrcamento = useAnalisarOrcamento();
const composicaoProduto = useComposicaoProduto();
```

**Step 2: Add "Analisar Orcamento" button in the header action area**

In the header `<div className="flex items-center gap-2">` section, add before the Save button:

```tsx
{!isNew && (
  <AIButton
    label="Analisar Orcamento"
    onClick={() => {
      analisarOrcamento.mutate(id!, {
        onSuccess: (data) => setAnaliseResult(data),
      });
    }}
    isLoading={analisarOrcamento.isPending}
  />
)}
```

**Step 3: Add result panels below the form**

After the main form content, add:

```tsx
{analiseResult && (
  <div className="mt-4">
    <OrcamentoAnalise
      result={analiseResult}
      onClose={() => setAnaliseResult(null)}
    />
  </div>
)}

{composicaoResult && (
  <div className="mt-4">
    <ComposicaoSugestao
      result={composicaoResult}
      onClose={() => setComposicaoResult(null)}
    />
  </div>
)}
```

**Step 4: Commit**

```bash
git add src/domains/comercial/pages/OrcamentoEditorPage.tsx
git commit -m "feat(ai): integrate AI analysis and composition buttons in OrcamentoEditor"
```

---

## Sprint AI-3: Cliente + Producao

### Task 14: Create ai-resumo-cliente Edge Function

**Files:**
- Create: `supabase/functions/ai-resumo-cliente/index.ts`

**Step 1: Write the Edge Function**

```typescript
// supabase/functions/ai-resumo-cliente/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCorsOptions, getCorsHeaders, jsonResponse, authenticateAndAuthorize, getServiceClient } from '../ai-shared/ai-helpers.ts';
import { callOpenRouter } from '../ai-shared/openrouter-provider.ts';
import { buildSystemPrompt, buildUserPrompt, PROMPTS } from '../ai-shared/prompt-builder.ts';
import { logAICall } from '../ai-shared/ai-logger.ts';

serve(async (req: Request) => {
  const corsResponse = handleCorsOptions(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { auth, error: authError } = await authenticateAndAuthorize(req, 'resumo-cliente');
    if (authError) return authError;

    const { cliente_id } = await req.json();
    if (!cliente_id) {
      return jsonResponse({ error: 'cliente_id obrigatorio' }, 400, corsHeaders);
    }

    const supabase = getServiceClient();

    // Load client data
    const [clienteRes, propostasRes, pedidosRes, contasRes, contatosRes] = await Promise.all([
      supabase.from('clientes')
        .select('id, nome_fantasia, razao_social, segmento, classificacao, cnpj, cidade, estado, created_at, ativo')
        .eq('id', cliente_id)
        .single(),
      supabase.from('propostas')
        .select('id, numero, titulo, status, total, created_at')
        .eq('cliente_id', cliente_id)
        .is('excluido_em', null)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('pedidos')
        .select('id, numero, status, total, created_at, concluido_em')
        .eq('cliente_id', cliente_id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('contas_receber')
        .select('id, valor, status, vencimento, pago_em')
        .eq('cliente_id', cliente_id)
        .order('vencimento', { ascending: false })
        .limit(20),
      supabase.from('cliente_contatos')
        .select('nome, cargo, email, telefone')
        .eq('cliente_id', cliente_id),
    ]);

    if (clienteRes.error || !clienteRes.data) {
      return jsonResponse({ error: 'Cliente nao encontrado' }, 404, corsHeaders);
    }

    const context = {
      cliente: clienteRes.data,
      contatos: contatosRes.data ?? [],
      propostas: propostasRes.data ?? [],
      pedidos: pedidosRes.data ?? [],
      contas_receber: contasRes.data ?? [],
      data_atual: new Date().toISOString().split('T')[0],
    };

    const systemPrompt = buildSystemPrompt(PROMPTS.resumoCliente);
    const userPrompt = buildUserPrompt(context);
    const result = await callOpenRouter(systemPrompt, userPrompt);

    const aiData = JSON.parse(result.content);
    const response = {
      ...aiData,
      model_used: result.model_used,
      tokens_used: result.tokens_input + result.tokens_output,
    };

    await logAICall({
      user_id: auth!.userId,
      function_name: 'resumo-cliente',
      entity_type: 'cliente',
      entity_id: cliente_id,
      model_used: result.model_used,
      tokens_input: result.tokens_input,
      tokens_output: result.tokens_output,
      cost_usd: result.cost_usd,
      duration_ms: result.duration_ms,
      status: 'success',
    });

    return jsonResponse(response, 200, corsHeaders);
  } catch (error) {
    console.error('ai-resumo-cliente error:', error);
    return jsonResponse({ error: 'Erro ao gerar resumo', detail: error.message }, 500, corsHeaders);
  }
});
```

**Step 2: Commit**

```bash
git add supabase/functions/ai-resumo-cliente/
git commit -m "feat(ai): add ai-resumo-cliente Edge Function"
```

---

### Task 15: Create ai-briefing-producao Edge Function

**Files:**
- Create: `supabase/functions/ai-briefing-producao/index.ts`

**Step 1: Write the Edge Function**

```typescript
// supabase/functions/ai-briefing-producao/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCorsOptions, getCorsHeaders, jsonResponse, authenticateAndAuthorize, getServiceClient } from '../ai-shared/ai-helpers.ts';
import { callOpenRouter } from '../ai-shared/openrouter-provider.ts';
import { buildSystemPrompt, buildUserPrompt, PROMPTS } from '../ai-shared/prompt-builder.ts';
import { logAICall } from '../ai-shared/ai-logger.ts';

serve(async (req: Request) => {
  const corsResponse = handleCorsOptions(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { auth, error: authError } = await authenticateAndAuthorize(req, 'briefing-producao');
    if (authError) return authError;

    const { pedido_id } = await req.json();
    if (!pedido_id) {
      return jsonResponse({ error: 'pedido_id obrigatorio' }, 400, corsHeaders);
    }

    const supabase = getServiceClient();

    // Load order with items
    const { data: pedido, error: pErr } = await supabase
      .from('pedidos')
      .select(`
        id, numero, status, total, prazo_entrega, observacoes, created_at,
        cliente:clientes(nome_fantasia, cidade, estado, endereco),
        itens:pedido_itens(
          id, descricao, quantidade, largura, altura, material, acabamento,
          preco_unitario, preco_total, observacoes
        )
      `)
      .eq('id', pedido_id)
      .single();

    if (pErr || !pedido) {
      return jsonResponse({ error: 'Pedido nao encontrado' }, 404, corsHeaders);
    }

    // Load stock for materials mentioned
    const { data: estoque } = await supabase
      .from('estoque_saldos')
      .select('material_id, saldo_atual, materiais(nome)')
      .gt('saldo_atual', 0);

    const context = {
      pedido,
      estoque_disponivel: estoque ?? [],
      data_atual: new Date().toISOString().split('T')[0],
    };

    const systemPrompt = buildSystemPrompt(PROMPTS.briefingProducao);
    const userPrompt = buildUserPrompt(context);
    const result = await callOpenRouter(systemPrompt, userPrompt);

    const aiData = JSON.parse(result.content);
    const response = {
      ...aiData,
      model_used: result.model_used,
      tokens_used: result.tokens_input + result.tokens_output,
    };

    await logAICall({
      user_id: auth!.userId,
      function_name: 'briefing-producao',
      entity_type: 'pedido',
      entity_id: pedido_id,
      model_used: result.model_used,
      tokens_input: result.tokens_input,
      tokens_output: result.tokens_output,
      cost_usd: result.cost_usd,
      duration_ms: result.duration_ms,
      status: 'success',
    });

    return jsonResponse(response, 200, corsHeaders);
  } catch (error) {
    console.error('ai-briefing-producao error:', error);
    return jsonResponse({ error: 'Erro ao gerar briefing', detail: error.message }, 500, corsHeaders);
  }
});
```

**Step 2: Commit**

```bash
git add supabase/functions/ai-briefing-producao/
git commit -m "feat(ai): add ai-briefing-producao Edge Function"
```

---

### Task 16: Create frontend hooks for cliente and producao

**Files:**
- Create: `src/domains/ai/hooks/useResumoCliente.ts`
- Create: `src/domains/ai/hooks/useBriefingProducao.ts`

**Step 1: Write useResumoCliente hook**

```typescript
// src/domains/ai/hooks/useResumoCliente.ts

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import type { AIResponse } from '../types/ai.types';

export function useResumoCliente() {
  return useMutation({
    mutationFn: async (clienteId: string): Promise<AIResponse> => {
      const { data, error } = await supabase.functions.invoke('ai-resumo-cliente', {
        body: { cliente_id: clienteId },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as AIResponse;
    },
    onError: (err: Error) => showError(err.message || 'Erro ao gerar resumo do cliente'),
  });
}
```

**Step 2: Write useBriefingProducao hook**

```typescript
// src/domains/ai/hooks/useBriefingProducao.ts

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import type { AIResponse } from '../types/ai.types';

export function useBriefingProducao() {
  return useMutation({
    mutationFn: async (pedidoId: string): Promise<AIResponse> => {
      const { data, error } = await supabase.functions.invoke('ai-briefing-producao', {
        body: { pedido_id: pedidoId },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as AIResponse;
    },
    onError: (err: Error) => showError(err.message || 'Erro ao gerar briefing'),
  });
}
```

**Step 3: Commit**

```bash
git add src/domains/ai/hooks/useResumoCliente.ts src/domains/ai/hooks/useBriefingProducao.ts
git commit -m "feat(ai): add useResumoCliente and useBriefingProducao hooks"
```

---

### Task 17: Create ClienteResumo and ProducaoBriefing result components

**Files:**
- Create: `src/domains/ai/components/ClienteResumo.tsx`
- Create: `src/domains/ai/components/ProducaoBriefing.tsx`

**Step 1: Write ClienteResumo**

```tsx
// src/domains/ai/components/ClienteResumo.tsx

import AIResultPanel from './AIResultPanel';
import { brl } from '@/shared/utils/format';
import type { AIResponse, ClienteResumoData } from '../types/ai.types';

interface ClienteResumoProps {
  result: AIResponse;
  onClose: () => void;
}

export default function ClienteResumo({ result, onClose }: ClienteResumoProps) {
  const data = result.structured_data as unknown as ClienteResumoData;

  const riscoColor = {
    baixo: 'text-green-600 bg-green-50',
    medio: 'text-amber-600 bg-amber-50',
    alto: 'text-red-600 bg-red-50',
  }[data?.risco ?? 'baixo'] ?? 'text-slate-600 bg-slate-50';

  return (
    <AIResultPanel result={result} title="Resumo do Cliente" onClose={onClose}>
      {data && (
        <div className="space-y-3 mt-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">Ticket Medio</span>
              <p className="text-lg font-bold text-slate-800">{brl(data.ticket_medio)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">Total Pedidos</span>
              <p className="text-lg font-bold text-slate-800">{data.total_pedidos}</p>
            </div>
            <div className={`rounded-xl p-3 ${riscoColor}`}>
              <span className="text-[10px] uppercase tracking-wide opacity-70">Risco</span>
              <p className="text-lg font-bold capitalize">{data.risco}</p>
            </div>
          </div>

          {data.produtos_frequentes?.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-slate-600">Produtos Frequentes</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {data.produtos_frequentes.map((p, i) => (
                  <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs">{p}</span>
                ))}
              </div>
            </div>
          )}

          {data.padrao_compra && (
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">Padrao de Compra</span>
              <p className="text-xs text-slate-700 mt-1">{data.padrao_compra}</p>
            </div>
          )}

          {data.sugestao_abordagem && (
            <div className="bg-blue-50 rounded-xl p-3">
              <span className="text-[10px] text-blue-500 uppercase tracking-wide">Sugestao de Abordagem</span>
              <p className="text-xs text-blue-800 mt-1">{data.sugestao_abordagem}</p>
            </div>
          )}
        </div>
      )}
    </AIResultPanel>
  );
}
```

**Step 2: Write ProducaoBriefing**

```tsx
// src/domains/ai/components/ProducaoBriefing.tsx

import AIResultPanel from './AIResultPanel';
import { CheckCircle, XCircle } from 'lucide-react';
import type { AIResponse, BriefingProducaoData } from '../types/ai.types';

interface ProducaoBriefingProps {
  result: AIResponse;
  onClose: () => void;
}

export default function ProducaoBriefing({ result, onClose }: ProducaoBriefingProps) {
  const data = result.structured_data as unknown as BriefingProducaoData;

  return (
    <AIResultPanel result={result} title="Briefing de Producao" onClose={onClose}>
      {data && (
        <div className="space-y-3 mt-3">
          {/* Prazo */}
          {data.prazo_producao && (
            <div className="bg-blue-50 rounded-xl p-3">
              <span className="text-[10px] text-blue-500 uppercase tracking-wide">Prazo Estimado</span>
              <p className="text-sm font-semibold text-blue-800 mt-1">{data.prazo_producao}</p>
            </div>
          )}

          {/* Itens do briefing */}
          {data.itens_briefing?.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-slate-600">Itens ({data.itens_briefing.length})</span>
              <div className="mt-1 space-y-2">
                {data.itens_briefing.map((item, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl p-3 text-xs space-y-1">
                    <p className="font-semibold text-slate-800">{item.produto}</p>
                    <div className="grid grid-cols-2 gap-1 text-slate-600">
                      <span>Medidas: {item.medidas}</span>
                      <span>Qtd: {item.quantidade}</span>
                      <span>Material: {item.material}</span>
                      <span>Acabamento: {item.acabamento}</span>
                    </div>
                    {item.observacoes && <p className="text-slate-500 italic">{item.observacoes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Materiais necessarios */}
          {data.materiais_necessarios?.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-slate-600">Materiais Necessarios</span>
              <div className="mt-1 space-y-1">
                {data.materiais_necessarios.map((m, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-xs">
                    <span className="text-slate-700">{m.nome}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">{m.quantidade} {m.unidade}</span>
                      {m.disponivel_estoque ? (
                        <CheckCircle size={12} className="text-green-500" />
                      ) : (
                        <XCircle size={12} className="text-red-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pendencias */}
          {data.pendencias?.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-3">
              <span className="text-[10px] text-amber-500 uppercase tracking-wide">Pendencias</span>
              <ul className="mt-1 space-y-0.5">
                {data.pendencias.map((p, i) => (
                  <li key={i} className="text-xs text-amber-700">- {p}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Observacoes criticas */}
          {data.observacoes_criticas?.length > 0 && (
            <div className="bg-red-50 rounded-xl p-3">
              <span className="text-[10px] text-red-500 uppercase tracking-wide">Observacoes Criticas</span>
              <ul className="mt-1 space-y-0.5">
                {data.observacoes_criticas.map((o, i) => (
                  <li key={i} className="text-xs text-red-700">- {o}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </AIResultPanel>
  );
}
```

**Step 3: Commit**

```bash
git add src/domains/ai/components/ClienteResumo.tsx src/domains/ai/components/ProducaoBriefing.tsx
git commit -m "feat(ai): add ClienteResumo and ProducaoBriefing result components"
```

---

### Task 18: Integrate AI button into ClienteDetailPage

**Files:**
- Modify: `src/domains/clientes/pages/ClienteDetailPage.tsx`

**Step 1: Add imports and state**

```typescript
import AIButton from '@/domains/ai/components/AIButton';
import ClienteResumo from '@/domains/ai/components/ClienteResumo';
import { useResumoCliente } from '@/domains/ai/hooks/useResumoCliente';
import type { AIResponse } from '@/domains/ai/types/ai.types';
```

Inside the component, add:

```typescript
const [resumoResult, setResumoResult] = useState<AIResponse | null>(null);
const resumoCliente = useResumoCliente();
```

**Step 2: Add button in the page header**

Add next to existing action buttons:

```tsx
<AIButton
  label="Resumo Inteligente"
  onClick={() => {
    resumoCliente.mutate(clienteId!, {
      onSuccess: (data) => setResumoResult(data),
    });
  }}
  isLoading={resumoCliente.isPending}
/>
```

**Step 3: Add result panel**

Below the main content or as first item in tabs area:

```tsx
{resumoResult && (
  <div className="mb-4">
    <ClienteResumo
      result={resumoResult}
      onClose={() => setResumoResult(null)}
    />
  </div>
)}
```

**Step 4: Commit**

```bash
git add src/domains/clientes/pages/ClienteDetailPage.tsx
git commit -m "feat(ai): integrate AI Resumo Inteligente button in ClienteDetailPage"
```

---

### Task 19: Integrate AI button into OrdemServicoPage

**Files:**
- Modify: `src/domains/producao/pages/OrdemServicoPage.tsx`

**Step 1: Add imports and state**

```typescript
import AIButton from '@/domains/ai/components/AIButton';
import ProducaoBriefing from '@/domains/ai/components/ProducaoBriefing';
import { useBriefingProducao } from '@/domains/ai/hooks/useBriefingProducao';
import type { AIResponse } from '@/domains/ai/types/ai.types';
```

Inside the component, add:

```typescript
const [briefingResult, setBriefingResult] = useState<AIResponse | null>(null);
const briefingProducao = useBriefingProducao();
```

**Step 2: Add button in header area**

```tsx
<AIButton
  label="Gerar Briefing"
  onClick={() => {
    briefingProducao.mutate(pedidoId!, {
      onSuccess: (data) => setBriefingResult(data),
    });
  }}
  isLoading={briefingProducao.isPending}
/>
```

**Step 3: Add result panel**

```tsx
{briefingResult && (
  <div className="mb-4">
    <ProducaoBriefing
      result={briefingResult}
      onClose={() => setBriefingResult(null)}
    />
  </div>
)}
```

**Step 4: Commit**

```bash
git add src/domains/producao/pages/OrdemServicoPage.tsx
git commit -m "feat(ai): integrate AI Gerar Briefing button in OrdemServicoPage"
```

---

## Sprint AI-4: Detector + Dashboard

### Task 20: Create ai-detectar-problemas Edge Function

**Files:**
- Create: `supabase/functions/ai-detectar-problemas/index.ts`

**Step 1: Write the Edge Function**

```typescript
// supabase/functions/ai-detectar-problemas/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCorsOptions, getCorsHeaders, jsonResponse, authenticateAndAuthorize, getServiceClient } from '../ai-shared/ai-helpers.ts';
import { callOpenRouter } from '../ai-shared/openrouter-provider.ts';
import { buildSystemPrompt, buildUserPrompt, PROMPTS } from '../ai-shared/prompt-builder.ts';
import { logAICall } from '../ai-shared/ai-logger.ts';

serve(async (req: Request) => {
  const corsResponse = handleCorsOptions(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { auth, error: authError } = await authenticateAndAuthorize(req, 'detectar-problemas');
    if (authError) return authError;

    const body = await req.json().catch(() => ({}));
    const mode = body.mode ?? 'manual'; // 'manual' (with AI) or 'cron' (SQL only)

    const supabase = getServiceClient();

    // Run detection queries
    const now = new Date().toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [orcVencidos, pedidosParados, semFaturamento, semFollowup] = await Promise.all([
      // Orcamentos enviados ha mais de 7 dias sem resposta
      supabase.from('propostas')
        .select('id, numero, titulo, total, updated_at, cliente:clientes(nome_fantasia)')
        .in('status', ['enviada', 'visualizada'])
        .lt('updated_at', sevenDaysAgo)
        .is('excluido_em', null)
        .limit(20),

      // Pedidos sem mudanca de status ha mais de 3 dias
      supabase.from('pedidos')
        .select('id, numero, status, total, updated_at, cliente:clientes(nome_fantasia)')
        .not('status', 'in', '("concluido","cancelado","entregue")')
        .lt('updated_at', threeDaysAgo)
        .limit(20),

      // Producao concluida sem faturamento
      supabase.from('pedidos')
        .select('id, numero, total, updated_at, cliente:clientes(nome_fantasia)')
        .eq('status', 'concluido')
        .limit(20),

      // Clientes sem interacao ha mais de 14 dias
      supabase.from('clientes')
        .select('id, nome_fantasia, updated_at')
        .eq('ativo', true)
        .lt('updated_at', fourteenDaysAgo)
        .limit(20),
    ]);

    const problemasDetectados = {
      orcamentos_vencidos: orcVencidos.data ?? [],
      pedidos_parados: pedidosParados.data ?? [],
      sem_faturamento: semFaturamento.data ?? [],
      sem_followup: semFollowup.data ?? [],
    };

    if (mode === 'cron') {
      // Save directly to ai_alertas without AI
      const alertas = [];

      for (const orc of problemasDetectados.orcamentos_vencidos) {
        alertas.push({
          tipo: 'orcamento_vencido',
          severidade: 'media',
          titulo: `Orcamento ${orc.numero} sem resposta`,
          descricao: `Orcamento "${orc.titulo}" para ${(orc.cliente as any)?.nome_fantasia ?? 'cliente'} esta sem resposta ha mais de 7 dias.`,
          entity_type: 'proposta',
          entity_id: orc.id,
        });
      }

      for (const ped of problemasDetectados.pedidos_parados) {
        alertas.push({
          tipo: 'pedido_parado',
          severidade: 'alta',
          titulo: `Pedido ${ped.numero} parado`,
          descricao: `Pedido em status "${ped.status}" sem movimentacao ha mais de 3 dias.`,
          entity_type: 'pedido',
          entity_id: ped.id,
        });
      }

      for (const ped of problemasDetectados.sem_faturamento) {
        alertas.push({
          tipo: 'sem_faturamento',
          severidade: 'alta',
          titulo: `Pedido ${ped.numero} concluido sem faturamento`,
          descricao: `Pedido concluido mas sem registro de faturamento.`,
          entity_type: 'pedido',
          entity_id: ped.id,
        });
      }

      if (alertas.length > 0) {
        // Clear old unresolved alerts of same types before inserting new ones
        await supabase.from('ai_alertas')
          .update({ resolvido: true, resolvido_em: now })
          .in('tipo', ['orcamento_vencido', 'pedido_parado', 'sem_faturamento', 'sem_followup'])
          .eq('resolvido', false);

        await supabase.from('ai_alertas').insert(alertas);
      }

      return jsonResponse({ mode: 'cron', alertas_criados: alertas.length }, 200, corsHeaders);
    }

    // Manual mode: use AI to analyze and prioritize
    const context = {
      problemas_detectados: problemasDetectados,
      totais: {
        orcamentos_vencidos: problemasDetectados.orcamentos_vencidos.length,
        pedidos_parados: problemasDetectados.pedidos_parados.length,
        sem_faturamento: problemasDetectados.sem_faturamento.length,
        sem_followup: problemasDetectados.sem_followup.length,
      },
      data_atual: new Date().toISOString().split('T')[0],
    };

    const systemPrompt = buildSystemPrompt(PROMPTS.detectarProblemas);
    const userPrompt = buildUserPrompt(context);
    const result = await callOpenRouter(systemPrompt, userPrompt);

    const aiData = JSON.parse(result.content);
    const response = {
      ...aiData,
      model_used: result.model_used,
      tokens_used: result.tokens_input + result.tokens_output,
    };

    await logAICall({
      user_id: auth!.userId,
      function_name: 'detectar-problemas',
      entity_type: 'geral',
      entity_id: null,
      model_used: result.model_used,
      tokens_input: result.tokens_input,
      tokens_output: result.tokens_output,
      cost_usd: result.cost_usd,
      duration_ms: result.duration_ms,
      status: 'success',
    });

    return jsonResponse(response, 200, corsHeaders);
  } catch (error) {
    console.error('ai-detectar-problemas error:', error);
    return jsonResponse({ error: 'Erro ao detectar problemas', detail: error.message }, 500, corsHeaders);
  }
});
```

**Step 2: Commit**

```bash
git add supabase/functions/ai-detectar-problemas/
git commit -m "feat(ai): add ai-detectar-problemas Edge Function with cron and manual modes"
```

---

### Task 21: Create frontend hooks and components for detector

**Files:**
- Create: `src/domains/ai/hooks/useDetectarProblemas.ts`
- Create: `src/domains/ai/hooks/useAlertasAI.ts`
- Create: `src/domains/ai/components/ProblemasPanel.tsx`
- Create: `src/domains/ai/components/AIAlertsBadge.tsx`

**Step 1: Write useDetectarProblemas hook**

```typescript
// src/domains/ai/hooks/useDetectarProblemas.ts

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import type { AIResponse } from '../types/ai.types';

export function useDetectarProblemas() {
  return useMutation({
    mutationFn: async (mode: 'manual' | 'cron' = 'manual'): Promise<AIResponse> => {
      const { data, error } = await supabase.functions.invoke('ai-detectar-problemas', {
        body: { mode },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as AIResponse;
    },
    onError: (err: Error) => showError(err.message || 'Erro ao detectar problemas'),
  });
}
```

**Step 2: Write useAlertasAI hook**

```typescript
// src/domains/ai/hooks/useAlertasAI.ts

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AIAlerta {
  id: string;
  tipo: string;
  severidade: 'alta' | 'media' | 'baixa';
  titulo: string;
  descricao: string;
  entity_type: string;
  entity_id: string;
  resolvido: boolean;
  created_at: string;
}

export function useAlertasAI() {
  return useQuery({
    queryKey: ['ai-alertas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_alertas')
        .select('*')
        .eq('resolvido', false)
        .order('severidade', { ascending: true }) // alta first
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as AIAlerta[];
    },
    staleTime: 1000 * 60 * 5, // 5 min
  });
}

export function useResolverAlerta() {
  return async (alertaId: string, userId: string) => {
    const { error } = await supabase
      .from('ai_alertas')
      .update({
        resolvido: true,
        resolvido_por: userId,
        resolvido_em: new Date().toISOString(),
      })
      .eq('id', alertaId);

    if (error) throw error;
  };
}
```

**Step 3: Write ProblemasPanel**

```tsx
// src/domains/ai/components/ProblemasPanel.tsx

import { AlertTriangle, XCircle, Info, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AIButton from './AIButton';
import { useAlertasAI, type AIAlerta } from '../hooks/useAlertasAI';
import { useDetectarProblemas } from '../hooks/useDetectarProblemas';
import AIResultPanel from './AIResultPanel';
import type { AIResponse } from '../types/ai.types';
import { useState } from 'react';

export default function ProblemasPanel() {
  const { data: alertas = [], isLoading, refetch } = useAlertasAI();
  const detectar = useDetectarProblemas();
  const [manualResult, setManualResult] = useState<AIResponse | null>(null);

  const porSeveridade = {
    alta: alertas.filter((a) => a.severidade === 'alta'),
    media: alertas.filter((a) => a.severidade === 'media'),
    baixa: alertas.filter((a) => a.severidade === 'baixa'),
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-800">Alertas Operacionais</h3>
          <p className="text-xs text-slate-400 mt-0.5">{alertas.length} alertas ativos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="rounded-xl"
          >
            <RefreshCw size={14} />
          </Button>
          <AIButton
            label="Analise Completa"
            onClick={() => {
              detectar.mutate('manual', {
                onSuccess: (data) => setManualResult(data),
              });
            }}
            isLoading={detectar.isPending}
          />
        </div>
      </div>

      <div className="p-5 space-y-2">
        {isLoading && <p className="text-sm text-slate-400">Carregando alertas...</p>}

        {!isLoading && alertas.length === 0 && (
          <div className="text-center py-8">
            <CheckCircle size={32} className="mx-auto text-green-400 mb-2" />
            <p className="text-sm text-slate-500">Nenhum problema detectado</p>
          </div>
        )}

        {porSeveridade.alta.map((a) => (
          <AlertaItem key={a.id} alerta={a} />
        ))}
        {porSeveridade.media.map((a) => (
          <AlertaItem key={a.id} alerta={a} />
        ))}
        {porSeveridade.baixa.map((a) => (
          <AlertaItem key={a.id} alerta={a} />
        ))}
      </div>

      {manualResult && (
        <div className="p-5 border-t border-slate-100">
          <AIResultPanel
            result={manualResult}
            title="Analise de Problemas"
            onClose={() => setManualResult(null)}
          />
        </div>
      )}
    </div>
  );
}

const SEVERIDADE_CONFIG = {
  alta: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', Icon: XCircle, iconClass: 'text-red-500' },
  media: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', Icon: AlertTriangle, iconClass: 'text-amber-500' },
  baixa: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', Icon: Info, iconClass: 'text-blue-500' },
};

function AlertaItem({ alerta }: { alerta: AIAlerta }) {
  const style = SEVERIDADE_CONFIG[alerta.severidade];

  return (
    <div className={`flex items-start gap-2 ${style.bg} border ${style.border} rounded-xl p-3 text-xs ${style.text}`}>
      <style.Icon size={14} className={`${style.iconClass} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <span className="font-semibold">{alerta.titulo}</span>
        <p className="mt-0.5 opacity-80">{alerta.descricao}</p>
      </div>
    </div>
  );
}
```

**Step 4: Write AIAlertsBadge**

```tsx
// src/domains/ai/components/AIAlertsBadge.tsx

import { Bell } from 'lucide-react';
import { useAlertasAI } from '../hooks/useAlertasAI';

interface AIAlertsBadgeProps {
  onClick?: () => void;
}

export default function AIAlertsBadge({ onClick }: AIAlertsBadgeProps) {
  const { data: alertas = [] } = useAlertasAI();
  const count = alertas.length;
  const hasAlta = alertas.some((a) => a.severidade === 'alta');

  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors"
      title={`${count} alertas operacionais`}
    >
      <Bell size={18} className="text-slate-600" />
      <span
        className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white ${
          hasAlta ? 'bg-red-500' : 'bg-amber-500'
        }`}
      >
        {count > 99 ? '99+' : count}
      </span>
    </button>
  );
}
```

**Step 5: Commit**

```bash
git add src/domains/ai/hooks/useDetectarProblemas.ts src/domains/ai/hooks/useAlertasAI.ts src/domains/ai/components/ProblemasPanel.tsx src/domains/ai/components/AIAlertsBadge.tsx
git commit -m "feat(ai): add detector hooks, ProblemasPanel, and AIAlertsBadge"
```

---

### Task 22: Integrate ProblemasPanel into Dashboard

**Files:**
- Modify: `src/domains/comercial/pages/DashboardPage.tsx` (or the relevant dashboard component like `DashboardDiretor`)

**Step 1: Add import**

```typescript
import ProblemasPanel from '@/domains/ai/components/ProblemasPanel';
```

**Step 2: Add ProblemasPanel to the dashboard layout**

Add after the existing KPI cards section:

```tsx
<div className="mt-6">
  <ProblemasPanel />
</div>
```

**Step 3: Commit**

```bash
git add src/domains/comercial/pages/DashboardPage.tsx
git commit -m "feat(ai): integrate ProblemasPanel into dashboard"
```

---

### Task 23: Add AIAlertsBadge to app sidebar/header

**Files:**
- Modify: The main layout component that contains the sidebar or top navigation (find via `src/App.tsx` or similar layout component)

**Step 1: Find the layout component**

Search for the component that renders the sidebar navigation. It may be in `src/components/layout/` or `src/components/Sidebar.tsx`.

**Step 2: Add import**

```typescript
import AIAlertsBadge from '@/domains/ai/components/AIAlertsBadge';
```

**Step 3: Add badge near notifications or user menu area**

```tsx
<AIAlertsBadge onClick={() => navigate('/dashboard')} />
```

**Step 4: Commit**

```bash
git add <layout-file>
git commit -m "feat(ai): add AIAlertsBadge to app navigation"
```

---

### Task 24: Configure cron for automatic problem detection

**Step 1: Set up Supabase cron job**

Go to Supabase Dashboard > SQL Editor and run:

```sql
-- Enable pg_cron if not already
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule problem detection twice daily (8am and 2pm BRT = 11:00 and 17:00 UTC)
SELECT cron.schedule(
  'ai-detectar-problemas-manha',
  '0 11 * * 1-5',  -- Monday-Friday at 8am BRT
  $$
  SELECT net.http_post(
    url := 'https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/ai-detectar-problemas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"mode": "cron"}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'ai-detectar-problemas-tarde',
  '0 17 * * 1-5',  -- Monday-Friday at 2pm BRT
  $$
  SELECT net.http_post(
    url := 'https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/ai-detectar-problemas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"mode": "cron"}'::jsonb
  );
  $$
);
```

Note: The cron mode uses SQL queries only (no AI calls), so it costs $0. If `pg_cron` or `net.http_post` are not available on the current Supabase plan, this can alternatively be set up as a Supabase scheduled function or external cron (e.g., GitHub Actions or cron-job.org).

**Step 2: Verify cron is registered**

```sql
SELECT * FROM cron.job;
```

---

### Task 25: Deploy all Edge Functions

**Step 1: Deploy all 5 AI Edge Functions + shared code**

```bash
supabase functions deploy ai-analisar-orcamento
supabase functions deploy ai-resumo-cliente
supabase functions deploy ai-briefing-producao
supabase functions deploy ai-detectar-problemas
supabase functions deploy ai-composicao-produto
```

**Step 2: Verify deployments**

Go to Supabase Dashboard > Edge Functions and confirm all 5 functions appear and are active.

**Step 3: Test one function manually**

```bash
curl -X POST https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/ai-analisar-orcamento \
  -H "Authorization: Bearer <user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"proposta_id": "<some-proposta-uuid>"}'
```

---

### Task 26: Final build verification and commit

**Step 1: Run build**

```bash
cd /c/Users/Caldera/Claude/CRM-Croma/.claude/worktrees/beautiful-bassi
pnpm build
```

Expected: Build succeeds with no TypeScript errors.

**Step 2: Run existing tests**

```bash
pnpm test
```

Expected: All 102 existing tests still pass.

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(ai): Croma AI Engine Phase 1 complete — 5 AI features integrated"
```

---

## Summary of all files created/modified

### New files (Edge Functions — Deno):
- `supabase/functions/ai-shared/ai-types.ts`
- `supabase/functions/ai-shared/openrouter-provider.ts`
- `supabase/functions/ai-shared/ai-logger.ts`
- `supabase/functions/ai-shared/ai-helpers.ts`
- `supabase/functions/ai-shared/prompt-builder.ts`
- `supabase/functions/ai-analisar-orcamento/index.ts`
- `supabase/functions/ai-resumo-cliente/index.ts`
- `supabase/functions/ai-briefing-producao/index.ts`
- `supabase/functions/ai-detectar-problemas/index.ts`
- `supabase/functions/ai-composicao-produto/index.ts`

### New files (Frontend — React/TS):
- `src/domains/ai/types/ai.types.ts`
- `src/domains/ai/components/AIButton.tsx`
- `src/domains/ai/components/AIResultPanel.tsx`
- `src/domains/ai/components/OrcamentoAnalise.tsx`
- `src/domains/ai/components/ComposicaoSugestao.tsx`
- `src/domains/ai/components/ClienteResumo.tsx`
- `src/domains/ai/components/ProducaoBriefing.tsx`
- `src/domains/ai/components/ProblemasPanel.tsx`
- `src/domains/ai/components/AIAlertsBadge.tsx`
- `src/domains/ai/hooks/useAnalisarOrcamento.ts`
- `src/domains/ai/hooks/useComposicaoProduto.ts`
- `src/domains/ai/hooks/useResumoCliente.ts`
- `src/domains/ai/hooks/useBriefingProducao.ts`
- `src/domains/ai/hooks/useDetectarProblemas.ts`
- `src/domains/ai/hooks/useAlertasAI.ts`

### New files (Migration):
- `supabase/migrations/031_ai_engine_tables.sql`

### Modified files:
- `src/domains/comercial/pages/OrcamentoEditorPage.tsx`
- `src/domains/clientes/pages/ClienteDetailPage.tsx`
- `src/domains/producao/pages/OrdemServicoPage.tsx`
- `src/domains/comercial/pages/DashboardPage.tsx`
- Layout/sidebar component (for AIAlertsBadge)
