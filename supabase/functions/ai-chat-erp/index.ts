import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface ClassifyResponse {
  intent: string;
  entities: string[];
  confidence: number;
}

interface ExecuteResult {
  status: string;
  response: string;
  intent: string;
  queries_executed: number;
  data: Record<string, unknown>;
}

// SQL Query Templates by Intent
const QUERY_TEMPLATES: Record<string, Record<string, string>> = {
  financeiro: {
    faturamento_mes: `SELECT 
      COALESCE(SUM(valor_pago), 0) as total, 
      COUNT(*) as titulos 
      FROM contas_receber 
      WHERE date_trunc('month', data_pagamento) = date_trunc('month', CURRENT_DATE) 
      AND excluido_em IS NULL`,
    vencidos: `SELECT 
      COUNT(*) as count, 
      COALESCE(SUM(saldo), 0) as valor 
      FROM contas_receber 
      WHERE status IN ('aberto','vencido') 
      AND data_vencimento < CURRENT_DATE 
      AND data_pagamento IS NULL 
      AND excluido_em IS NULL`,
    a_receber: `SELECT 
      COUNT(*) as count, 
      COALESCE(SUM(saldo), 0) as valor 
      FROM contas_receber 
      WHERE status NOT IN ('pago','cancelado') 
      AND data_pagamento IS NULL 
      AND excluido_em IS NULL`,
    a_pagar: `SELECT 
      COUNT(*) as count, 
      COALESCE(SUM(valor_original), 0) as valor 
      FROM contas_pagar 
      WHERE status NOT IN ('pago','cancelado') 
      AND excluido_em IS NULL`,
    fluxo_caixa: `SELECT 
      (SELECT COALESCE(SUM(saldo), 0) FROM contas_receber 
        WHERE data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 30 
        AND status NOT IN ('pago','cancelado') 
        AND excluido_em IS NULL) as a_receber_30d, 
      (SELECT COALESCE(SUM(valor_original), 0) FROM contas_pagar 
        WHERE data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 30 
        AND status NOT IN ('pago','cancelado') 
        AND excluido_em IS NULL) as a_pagar_30d`,
  },
  vendas: {
    pipeline: `SELECT 
      status, 
      COUNT(*) as total, 
      COALESCE(SUM(total), 0) as valor 
      FROM propostas 
      WHERE excluido_em IS NULL 
      AND status NOT IN ('cancelada','expirada') 
      GROUP BY status`,
    leads_recentes: `SELECT 
      COUNT(*) as total, 
      COUNT(*) FILTER (WHERE created_at > now() - interval '7 days') as ultimos_7d 
      FROM leads 
      WHERE status NOT IN ('perdido','descartado')`,
    top_clientes: `SELECT 
      c.nome_fantasia, 
      COUNT(p.id) as pedidos, 
      COALESCE(SUM(p.valor_total), 0) as faturado 
      FROM clientes c 
      LEFT JOIN pedidos p ON p.cliente_id = c.id 
      WHERE p.status NOT IN ('cancelado') AND p.excluido_em IS NULL
      GROUP BY c.id, c.nome_fantasia 
      ORDER BY faturado DESC 
      LIMIT 5`,
    conversao: `SELECT 
      COUNT(*) FILTER (WHERE status = 'aprovada') as aprovadas, 
      COUNT(*) as total, 
      ROUND(COUNT(*) FILTER (WHERE status = 'aprovada')::numeric / NULLIF(COUNT(*), 0) * 100, 1) as taxa 
      FROM propostas 
      WHERE excluido_em IS NULL`,
  },
  producao: {
    ops_abertas: `SELECT 
      op.numero, 
      op.status, 
      op.prazo_interno, 
      c.nome_fantasia as cliente 
      FROM ordens_producao op 
      LEFT JOIN pedidos p ON p.id = op.pedido_id 
      LEFT JOIN clientes c ON c.id = p.cliente_id 
      WHERE op.status NOT IN ('concluida','cancelada','finalizado') 
      AND op.excluido_em IS NULL 
      ORDER BY op.prazo_interno ASC 
      LIMIT 10`,
    atrasadas: `SELECT 
      op.numero, 
      op.status, 
      op.prazo_interno, 
      (CURRENT_DATE - op.prazo_interno) as dias_atraso, 
      c.nome_fantasia as cliente 
      FROM ordens_producao op 
      LEFT JOIN pedidos p ON p.id = op.pedido_id 
      LEFT JOIN clientes c ON c.id = p.cliente_id 
      WHERE op.prazo_interno < CURRENT_DATE 
      AND op.status NOT IN ('concluida','cancelada','finalizado') 
      AND op.excluido_em IS NULL`,
  },
  estoque: {
    abaixo_minimo: `SELECT 
      m.nome, 
      m.unidade, 
      m.estoque_minimo, 
      COALESCE(es.saldo_disponivel, 0) as saldo 
      FROM materiais m 
      LEFT JOIN vw_estoque_disponivel es ON es.material_id = m.id 
      WHERE m.estoque_minimo > 0 
      AND COALESCE(es.saldo_disponivel, 0) <= m.estoque_minimo 
      AND m.estoque_controlado = true`,
  },
  comercial: {
    agente_stats: `SELECT 
      COUNT(*) as total_conversations, 
      COUNT(*) FILTER (WHERE status = 'ativa') as ativas 
      FROM agent_conversations`,
  },
  geral: {
    info_empresa: `SELECT 
      (SELECT COUNT(*) FROM clientes WHERE excluido_em IS NULL) as total_clientes,
      (SELECT COUNT(*) FROM pedidos WHERE status NOT IN ('cancelado') AND excluido_em IS NULL) as total_pedidos,
      (SELECT COALESCE(SUM(valor_total), 0) FROM pedidos WHERE excluido_em IS NULL) as faturamento_total`,
  },
};

// Stage 1: Classify intent using OpenRouter
async function classifyIntent(message: string): Promise<ClassifyResponse> {
  const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!openrouterKey) {
    return {
      intent: 'geral',
      entities: [],
      confidence: 0.5,
    };
  }

  const systemPrompt = `Você é um classificador de intenção para um ERP de comunicação visual. 
Classifique a mensagem do usuário em uma destas categorias:
- vendas: pipeline, propostas, orçamentos, clientes, leads, conversão, fechamento
- financeiro: faturamento, contas a receber/pagar, boletos, inadimplência, DRE, fluxo de caixa, fluxo
- producao: OPs, ordens de produção, etapas, máquinas, prazos, eficiência, atrasadas, corte, impressão
- estoque: materiais, saldo, movimentações, mínimo, inventário
- comercial: campanhas, follow-ups, agente, WhatsApp, marketing
- geral: saudação, ajuda, sobre o sistema, info geral, resumo

Responda em JSON puro com: {"intent": "...", "entities": [...], "confidence": 0.0-1.0}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openrouterKey}`,
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-20250514',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      console.error('OpenRouter error:', response.statusText);
      return { intent: 'geral', entities: [], confidence: 0.5 };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    return JSON.parse(content);
  } catch (error) {
    console.error('Classify error:', error);
    return { intent: 'geral', entities: [], confidence: 0.5 };
  }
}

// Stage 2: Plan which queries to execute based on intent and entities
function planQueries(intent: string, entities: string[]): string[] {
  const templates = QUERY_TEMPLATES[intent] || QUERY_TEMPLATES.geral;
  const selectedQueries: string[] = [];

  if (intent === 'financeiro') {
    if (entities.some((e) => e.includes('faturament') || e.includes('mes'))) {
      selectedQueries.push('faturamento_mes');
    }
    if (entities.some((e) => e.includes('vencid'))) {
      selectedQueries.push('vencidos');
    }
    if (entities.some((e) => e.includes('receber') || e.includes('pagar'))) {
      if (entities.some((e) => e.includes('receber'))) selectedQueries.push('a_receber');
      if (entities.some((e) => e.includes('pagar'))) selectedQueries.push('a_pagar');
    }
    if (entities.some((e) => e.includes('fluxo'))) {
      selectedQueries.push('fluxo_caixa');
    }
    if (selectedQueries.length === 0) {
      selectedQueries.push('a_receber', 'a_pagar');
    }
  } else if (intent === 'vendas') {
    if (entities.some((e) => e.includes('pipeline'))) selectedQueries.push('pipeline');
    if (entities.some((e) => e.includes('lead'))) selectedQueries.push('leads_recentes');
    if (entities.some((e) => e.includes('cliente'))) selectedQueries.push('top_clientes');
    if (entities.some((e) => e.includes('conversao') || e.includes('taxa')))
      selectedQueries.push('conversao');
    if (selectedQueries.length === 0) selectedQueries.push('pipeline');
  } else if (intent === 'producao') {
    if (entities.some((e) => e.includes('atrasad'))) selectedQueries.push('atrasadas');
    else selectedQueries.push('ops_abertas');
  } else if (intent === 'estoque') {
    selectedQueries.push('abaixo_minimo');
  } else if (intent === 'comercial') {
    selectedQueries.push('agente_stats');
  } else {
    selectedQueries.push('info_empresa');
  }

  return selectedQueries.slice(0, 3);
}

// Stage 3: Execute queries and compile results
async function executeQueries(
  supabase: ReturnType<typeof createClient>,
  selectedQueries: string[],
  intent: string
): Promise<Record<string, unknown>> {
  const templates = QUERY_TEMPLATES[intent] || QUERY_TEMPLATES.geral;
  const results: Record<string, unknown> = {};

  for (const queryKey of selectedQueries) {
    const queryText = templates[queryKey];
    if (!queryText) continue;

    try {
      const { data, error } = await supabase.rpc('execute_sql_readonly', {
        query_text: queryText,
      });

      if (error) {
        console.error(`Query ${queryKey} error:`, error);
        continue;
      }

      results[queryKey] = data;
    } catch (error) {
      console.error(`Query ${queryKey} execution error:`, error);
    }
  }

  return results;
}

// Format response using OpenRouter
async function generateResponse(
  message: string,
  intent: string,
  data: Record<string, unknown>
): Promise<string> {
  const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');

  if (!openrouterKey) {
    // Fallback: format data directly
    return `Resposta para: ${message}\n\nDados disponíveis:\n${JSON.stringify(data, null, 2)}`;
  }

  const systemPrompt = `Você é um assistente de BI para um ERP de comunicação visual (Croma Print).
Você recebe dados brutos do banco de dados e gera respostas em português brasileiro.
- Formate valores monetários como R$ X.XXX,XX
- Seja direto e conciso (máximo 3-4 frases)
- Se não há dados suficientes, diga isso claramente
- Sempre responda com confiança nos dados do banco`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openrouterKey}`,
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-20250514',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Pergunta: "${message}"\n\nDados do banco:\n${JSON.stringify(data, null, 2)}`,
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error('OpenRouter response error:', response.statusText);
      return `Dados retornados: ${JSON.stringify(data, null, 2)}`;
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content || 'Sem resposta disponível.';
  } catch (error) {
    console.error('Generate response error:', error);
    return `Dados disponíveis:\n${JSON.stringify(data, null, 2)}`;
  }
}

// Main handler
async function handleRequest(req: Request): Promise<Response> {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { message, conversation_id, user_id } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Stage 1: Classify
    const classified = await classifyIntent(message);

    // Stage 2: Plan
    const selectedQueries = planQueries(classified.intent, classified.entities);

    // Stage 3: Execute
    const queryResults = await executeQueries(supabase, selectedQueries, classified.intent);

    // Generate response
    const response = await generateResponse(message, classified.intent, queryResults);

    const result: ExecuteResult = {
      status: 'ok',
      response,
      intent: classified.intent,
      queries_executed: selectedQueries.length,
      data: queryResults,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Handler error:', error);
    return new Response(
      JSON.stringify({
        status: 'error',
        response: 'Erro ao processar a solicitação.',
        intent: 'geral',
        queries_executed: 0,
        data: {},
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

Deno.serve(handleRequest);
