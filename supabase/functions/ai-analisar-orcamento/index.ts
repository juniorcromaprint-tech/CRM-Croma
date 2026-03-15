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
