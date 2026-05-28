// supabase/functions/ai-briefing-producao/index.ts
// VERSION 2026-05-28 (ciclo autonomo #5): defensive JSON.parse + structured error log
const VERSION = 'v22-defensive-parse';

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCorsOptions, getCorsHeaders, jsonResponse, authenticateAndAuthorize, getServiceClient } from '../ai-shared/ai-helpers.ts';
// 2026-05-21: OpenRouter ELIMINADO (Onda 3) — callOpenRouter = alias drop-in de callAnthropic.
import { callOpenRouter } from '../ai-shared/anthropic-provider.ts';
import { buildSystemPrompt, buildUserPrompt, PROMPTS } from '../ai-shared/prompt-builder.ts';
import { logAICall } from '../ai-shared/ai-logger.ts';

// 2026-05-28 ciclo #5: helper local pra structured error log em ai_logs sem depender
// do logAICall shared (que tem bug conhecido: .insert sem .select().single() + try/catch
// silencioso em ai-logger.ts). NEXT P1 refactor central.
async function logErrorLocal(
  supabase: ReturnType<typeof getServiceClient>,
  ctx: { pedido_id?: string; userId?: string; error: unknown; raw?: string }
) {
  try {
    const { error: insErr } = await supabase
      .from('ai_logs')
      .insert({
        user_id: ctx.userId ?? null,
        function_name: 'briefing-producao',
        entity_type: 'pedido',
        entity_id: ctx.pedido_id ?? null,
        model_used: 'unknown',
        tokens_input: 0,
        tokens_output: 0,
        cost_usd: 0,
        duration_ms: 0,
        status: 'error',
        error_message: `[${VERSION}] ${(ctx.error as Error)?.message ?? String(ctx.error)} | raw_preview=${(ctx.raw ?? '').slice(0, 200)}`,
      })
      .select()
      .single();
    if (insErr) console.error('[briefing-producao] ai_logs error log failed:', insErr);
  } catch (e) {
    console.error('[briefing-producao] logErrorLocal threw:', e);
  }
}

serve(async (req: Request) => {
  const corsResponse = handleCorsOptions(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { auth, error: authError } = await authenticateAndAuthorize(req, 'briefing-producao');
    if (authError) return authError;

    const { pedido_id, model } = await req.json();
    if (!pedido_id) {
      return jsonResponse({ error: 'pedido_id obrigatorio' }, 400, corsHeaders);
    }

    const supabase = getServiceClient();

    // Load order with items
    const { data: pedido, error: pErr } = await supabase
      .from('pedidos')
      .select(`
        id, numero, status, valor_total, data_prometida, observacoes, created_at,
        cliente:clientes(nome_fantasia, cidade, estado, endereco),
        itens:pedido_itens(
          id, descricao, quantidade, largura_cm, altura_cm, area_m2,
          valor_unitario, valor_total, especificacao, instrucoes
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
      .select('material_id, quantidade_disponivel, materiais(nome)')
      .gt('quantidade_disponivel', 0);

    const context = {
      pedido,
      estoque_disponivel: estoque ?? [],
      data_atual: new Date().toISOString().split('T')[0],
    };

    const systemPrompt = buildSystemPrompt(PROMPTS.briefingProducao);
    const userPrompt = buildUserPrompt(context);
    const result = await callOpenRouter(systemPrompt, userPrompt, { max_tokens: 3000, model: model || undefined });

    // 2026-05-28 ciclo #5: defensive JSON.parse — IA pode devolver texto fora-padrao
    let aiData: Record<string, unknown>;
    try {
      aiData = JSON.parse(result.content);
    } catch (parseErr) {
      console.error(`[${VERSION}] JSON.parse failed:`, parseErr, 'raw:', result.content?.slice(0, 500));
      await logErrorLocal(supabase, {
        pedido_id,
        userId: auth!.userId,
        error: parseErr,
        raw: result.content,
      });
      return jsonResponse(
        { error: 'IA devolveu resposta nao parseavel', detail: (parseErr as Error).message, version: VERSION },
        502,
        corsHeaders
      );
    }
    const response = {
      ...aiData,
      model_used: result.model_used,
      tokens_used: result.tokens_input + result.tokens_output,
      _version: VERSION,
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
