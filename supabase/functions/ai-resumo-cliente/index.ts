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

    const { cliente_id, model } = await req.json();
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
        .select('id, numero, status, valor_total, created_at, data_conclusao')
        .eq('cliente_id', cliente_id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('contas_receber')
        .select('id, valor_original, status, data_vencimento, data_pagamento')
        .eq('cliente_id', cliente_id)
        .order('data_vencimento', { ascending: false })
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
    const result = await callOpenRouter(systemPrompt, userPrompt, { max_tokens: 3000, model: model || undefined });

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
