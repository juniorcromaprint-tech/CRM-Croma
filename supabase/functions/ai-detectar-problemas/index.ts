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
        .select('id, numero, status, valor_total, updated_at, cliente:clientes(nome_fantasia)')
        .not('status', 'in', '("concluido","cancelado","entregue")')
        .lt('updated_at', threeDaysAgo)
        .limit(20),

      // Producao concluida sem faturamento
      supabase.from('pedidos')
        .select('id, numero, valor_total, updated_at, cliente:clientes(nome_fantasia)')
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
