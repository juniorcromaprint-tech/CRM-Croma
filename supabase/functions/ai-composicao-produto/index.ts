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
      supabase.from('produto_modelos').select('id, nome, markup_padrao')
        .order('nome'),
      supabase.from('materiais').select('id, nome, unidade, preco_medio, categoria')
        .not('preco_medio', 'is', null)
        .order('nome'),
      supabase.from('acabamentos').select('id, nome, custo_unitario')
        .order('nome'),
      supabase.from('servicos').select('id, nome, preco_fixo, custo_hora')
        .order('nome'),
    ]);

    // Load model compositions (for reference)
    const { data: composicoes } = await supabase
      .from('modelo_materiais')
      .select('modelo_id, material_id, quantidade_por_unidade, unidade, materiais(nome)')
      .limit(200);

    const { data: processos } = await supabase
      .from('modelo_processos')
      .select('modelo_id, etapa, ordem, tempo_por_unidade_min')
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
