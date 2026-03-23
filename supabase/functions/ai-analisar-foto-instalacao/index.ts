// ai-analisar-foto-instalacao: Analyzes installation photos via AI vision
// Uses Claude Sonnet 4 via OpenRouter with vision capability
// Returns quality score, approval status, observations, detected problems

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

    // Get OpenRouter API key
    const { data: configRow } = await supabase
      .from('admin_config')
      .select('valor')
      .eq('chave', 'OPENROUTER_API_KEY')
      .single();

    const apiKey = configRow?.valor as string;
    if (!apiKey) {
      return jsonResponse({ error: 'OpenRouter API key não configurada' }, 500, corsHeaders);
    }

    // Build image content
    const imageContent = foto_base64
      ? { type: 'image_url' as const, image_url: { url: `data:image/jpeg;base64,${foto_base64}` } }
      : { type: 'image_url' as const, image_url: { url: foto_url } };

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

    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://campo-croma.vercel.app',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analise esta foto de instalação:' },
              imageContent,
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.2,
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
      const raw = aiData.choices?.[0]?.message?.content ?? '';
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

    // Log
    await supabase.from('ai_logs').insert({
      funcao: 'analisar-foto-instalacao',
      tokens_usados: 0,
      custo: 0,
      metadata: { job_id, score: analise.score_qualidade, aprovado: analise.aprovado },
    }).catch(() => {});

    return jsonResponse(analise, 200, corsHeaders);

  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500, getCorsHeaders(req));
  }
});
