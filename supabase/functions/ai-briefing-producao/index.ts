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
    const result = await callOpenRouter(systemPrompt, userPrompt, { max_tokens: 3000 });

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
