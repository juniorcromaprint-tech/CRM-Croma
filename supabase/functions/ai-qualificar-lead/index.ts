// supabase/functions/ai-qualificar-lead/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCorsOptions, getCorsHeaders, jsonResponse, authenticateAndAuthorize, getServiceClient } from '../ai-shared/ai-helpers.ts';
import { callOpenRouter } from '../ai-shared/openrouter-provider.ts';
import { buildSystemPrompt, buildUserPrompt } from '../ai-shared/prompt-builder.ts';
import { logAICall } from '../ai-shared/ai-logger.ts';

const QUALIFICAR_LEAD_PROMPT = `TAREFA: Qualificar este lead de comunicacao visual e retornar scoring com proxima acao recomendada.

A Croma Print Comunicacao Visual produz banners, faixas, adesivos, placas, totens, fachadas, paineis, letreiros,
backdrop, PDV e envelopamento. Clientes: redes de lojas, franquias, fabricantes de calcados, grandes varejistas.
Diferencial: producao propria, atendimento nacional, padronizacao de redes.

Considere:
- Perfil do segmento (varejo, franquias e redes tem maior potencial de recorrencia)
- Temperatura atual e historico de atividades
- Valor estimado vs ticket medio tipico da Croma (R$ 2.000–R$ 50.000 por pedido)
- Dias sem contato (risco de esfriamento)
- Cargo do contato (decisor vs influenciador)
- Observacoes e contexto disponivel

Retorne JSON EXATO:
{
  "score": 0,
  "temperatura_sugerida": "frio|morno|quente",
  "segmento_refinado": "string com segmento mais especifico se possivel identificar",
  "potencial_estimado": 0.0,
  "produtos_sugeridos": ["produto1", "produto2"],
  "proxima_acao": "string descrevendo a proxima acao recomendada",
  "motivo_acao": "string explicando o motivo em 1-2 frases",
  "mensagem_sugerida": "string com texto sugerido para abordar o lead (pode ser WhatsApp ou email)",
  "riscos": ["risco1", "risco2"]
}

REGRAS DO SCORE (0-100):
- 0-25: Lead frio, pouco interesse ou informacoes insuficientes
- 26-50: Lead morno, demonstrou interesse mas sem clareza de necessidade
- 51-75: Lead quente, necessidade clara, decisor identificado ou contato recente
- 76-100: Lead muito quente, urgencia, decisor em contato, valor definido

TEMPERATURA:
- frio: score < 35 ou ultimo contato > 30 dias sem resposta
- morno: score 35-65 ou interesse parcial demonstrado
- quente: score > 65 ou interesse claro com prazo definido`;

serve(async (req: Request) => {
  const corsResponse = handleCorsOptions(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // Auth + role check
    const { auth, error: authError } = await authenticateAndAuthorize(req, 'qualificar-lead');
    if (authError) return authError;

    const { lead_id, model } = await req.json();
    if (!lead_id) {
      return jsonResponse({ error: 'lead_id obrigatorio' }, 400, corsHeaders);
    }

    const supabase = getServiceClient();

    // Fetch lead data
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select(`
        id, empresa, contato_nome, contato_email, contato_telefone,
        segmento, status, temperatura, valor_estimado, cargo,
        observacoes, score, proximo_contato, created_at
      `)
      .eq('id', lead_id)
      .single();

    if (leadErr || !lead) {
      return jsonResponse({ error: 'Lead nao encontrado' }, 404, corsHeaders);
    }

    // Fetch last 5 activities for this lead
    const { data: atividades } = await supabase
      .from('atividades_comerciais')
      .select('tipo, descricao, data_atividade, resultado')
      .eq('entidade_id', lead_id)
      .eq('entidade_tipo', 'lead')
      .order('data_atividade', { ascending: false })
      .limit(5);

    // Fetch pricing rules for product suggestions context
    const { data: regras } = await supabase
      .from('regras_precificacao')
      .select('categoria, margem_minima, markup_padrao')
      .limit(11);

    // Calculate days since last contact
    const lastActivity = atividades && atividades.length > 0 ? atividades[0] : null;
    const diasSemContato = lastActivity
      ? Math.floor((Date.now() - new Date(lastActivity.data_atividade).getTime()) / (1000 * 60 * 60 * 24))
      : Math.floor((Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24));

    // Build context for AI
    const context = {
      lead,
      atividades_recentes: atividades ?? [],
      dias_sem_contato: diasSemContato,
      regras_precificacao: regras ?? [],
      data_atual: new Date().toISOString().split('T')[0],
    };

    // Call OpenRouter
    const systemPrompt = buildSystemPrompt(QUALIFICAR_LEAD_PROMPT);
    const userPrompt = buildUserPrompt(context);
    const result = await callOpenRouter(systemPrompt, userPrompt, {
      max_tokens: 1500,
      model: model || 'openai/gpt-4.1-mini',
      temperature: 0.2,
    });

    // Parse AI response
    const aiData = JSON.parse(result.content);

    // Update lead with AI-derived values
    const updates: Record<string, unknown> = {
      score: aiData.score,
      temperatura: aiData.temperatura_sugerida,
    };
    // Only set valor_estimado if not already defined and AI has a suggestion
    if (!lead.valor_estimado && aiData.potencial_estimado && aiData.potencial_estimado > 0) {
      updates.valor_estimado = aiData.potencial_estimado;
    }

    await supabase.from('leads').update(updates).eq('id', lead_id);

    // Build response
    const response = {
      ...aiData,
      lead_id,
      dias_sem_contato: diasSemContato,
      model_used: result.model_used,
      tokens_used: result.tokens_input + result.tokens_output,
      cost_usd: result.cost_usd,
      duration_ms: result.duration_ms,
    };

    // Log AI call
    await logAICall({
      user_id: auth!.userId,
      function_name: 'qualificar-lead',
      entity_type: 'geral',
      entity_id: lead_id,
      model_used: result.model_used,
      tokens_input: result.tokens_input,
      tokens_output: result.tokens_output,
      cost_usd: result.cost_usd,
      duration_ms: result.duration_ms,
      status: 'success',
    });

    return jsonResponse(response, 200, corsHeaders);
  } catch (error) {
    console.error('ai-qualificar-lead error:', error);
    return jsonResponse(
      { error: 'Erro ao qualificar lead', detail: error.message },
      500,
      corsHeaders
    );
  }
});
