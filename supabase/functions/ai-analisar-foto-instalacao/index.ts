// ai-analisar-foto-instalacao: Analyzes installation photos via AI vision
// Uses Claude Sonnet 4 via Anthropic API direct (vision capability)
// Returns quality score, approval status, observations, detected problems
// VERSION 2026-05-28 (ciclo autonomo #5): schema ai_logs fix (funcao/tokens_usados/custo/metadata NAO existem)
const VERSION = 'v13-schema-fix';

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsOptions, jsonResponse } from '../ai-shared/ai-helpers.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface AnaliseResult {
  aprovado: boolean;
  score_qualidade: number;
  observacoes: string[];
  problemas_detectados: string[];
  recomendacoes: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsOptions();
  const corsHeaders = getCorsHeaders(req);

  try {
    const body = await req.json();
    const { foto_base64, foto_url, job_id, tipo_produto } = body;

    if (!foto_base64 && !foto_url) {
      return jsonResponse({ error: 'foto_base64 ou foto_url é obrigatório' }, 400, corsHeaders);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 2026-05-21: OpenRouter ELIMINADO. Vision via Anthropic API direto (ANTHROPIC_API_KEY).
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return jsonResponse({ error: 'ANTHROPIC_API_KEY não configurada' }, 500, corsHeaders);
    }

    // Build image content (formato Anthropic)
    const imageContent = foto_base64
      ? { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg', data: foto_base64 } }
      : { type: 'image' as const, source: { type: 'url' as const, url: foto_url } };

    const systemPrompt = `Você é um inspetor de qualidade de instalações de comunicação visual.
Analise a foto da instalação e avalie:

1. ALINHAMENTO — A peça está nivelada, centralizada, sem torção?
2. ACABAMENTO — Bordas limpas, sem bolhas, sem rugas, sem rasgos?
3. FIXAÇÃO — Parafusos/fitas/estruturas visíveis e firmes?
4. LIMPEZA — Área limpa, sem resíduos de instalação?
5. CONFORMIDADE — A peça parece corresponder ao que foi pedido?

${tipo_produto ? `Tipo de produto esperado: ${tipo_produto}` : ''}

Responda EXATAMENTE neste JSON:
{
  "aprovado": true/false,
  "score_qualidade": 0-100,
  "observacoes": ["observação positiva 1", "observação positiva 2"],
  "problemas_detectados": ["problema 1 se houver"],
  "recomendacoes": ["recomendação se houver"]
}

Se a foto não mostrar uma instalação de comunicação visual, responda com score 0 e observação explicando.
Seja rigoroso mas justo. Score >= 70 = aprovado.`;

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        temperature: 0.2,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analise esta foto de instalação:' },
              imageContent,
            ],
          },
        ],
      }),
    });

    let analise: AnaliseResult = {
      aprovado: false,
      score_qualidade: 0,
      observacoes: [],
      problemas_detectados: ['Não foi possível analisar a foto'],
      recomendacoes: [],
    };

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const raw = aiData.content?.[0]?.text ?? '';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          analise = {
            aprovado: parsed.aprovado ?? (parsed.score_qualidade >= 70),
            score_qualidade: Math.min(100, Math.max(0, parsed.score_qualidade ?? 0)),
            observacoes: parsed.observacoes ?? [],
            problemas_detectados: parsed.problemas_detectados ?? [],
            recomendacoes: parsed.recomendacoes ?? [],
          };
        } catch { /* use default */ }
      }
    }

    // Save analysis to job if job_id provided
    if (job_id) {
      await supabase
        .from('campo_jobs')
        .update({
          metadata: supabase.rpc ? undefined : {}, // Will merge via spread
        })
        .eq('id', job_id)
        .then(() => {
          // Update metadata with analysis
          return supabase.rpc('jsonb_merge_campo_job', {
            p_job_id: job_id,
            p_data: { analise_foto: analise },
          });
        })
        .catch(() => {
          // Fallback: just update a simple field
          supabase
            .from('campo_jobs')
            .update({ observacoes: `Score qualidade: ${analise.score_qualidade}/100 - ${analise.aprovado ? 'Aprovado' : 'Reprovado'}` })
            .eq('id', job_id)
            .then(() => {});
        });
    }

    // Log — schema correto: function_name/model_used (NOT NULL)/tokens_input/tokens_output/cost_usd/status/error_message
    // 2026-05-28 ciclo #5: fix schema (eram funcao/tokens_usados/custo/metadata — colunas NAO existem). Encadear .select().single() pra detectar falha.
    const { error: aiLogErr } = await supabase
      .from('ai_logs')
      .insert({
        function_name: 'analisar-foto-instalacao',
        entity_type: 'campo_job',
        entity_id: job_id ?? null,
        model_used: 'claude-sonnet-4-20250514',
        tokens_input: 0,
        tokens_output: 0,
        cost_usd: 0,
        duration_ms: 0,
        status: analise.aprovado ? 'success' : 'success',
        error_message: `[${VERSION}] job_id=${job_id ?? 'none'} score=${analise.score_qualidade} aprovado=${analise.aprovado}`,
      })
      .select()
      .single();
    if (aiLogErr) console.warn('[analisar-foto-instalacao] ai_logs insert error:', aiLogErr);

    return jsonResponse({ ...analise, _version: VERSION }, 200, corsHeaders);

  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500, getCorsHeaders(req));
  }
});
