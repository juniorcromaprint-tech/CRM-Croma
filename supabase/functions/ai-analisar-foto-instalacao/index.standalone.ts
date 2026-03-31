// ai-analisar-foto-instalacao — STANDALONE (sem imports relativos)
// Deploy: npx supabase@latest functions deploy ai-analisar-foto-instalacao --project-ref djwjmfgplnqyffdcgdaw

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Shared helpers inline ───────────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Content-Type, Authorization',
};
function jsonResponse(data: unknown, status: number, h = CORS_HEADERS): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...h, 'Content-Type': 'application/json' } });
}
// ────────────────────────────────────────────────────────────────────────────

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const body = await req.json();
    const { foto_base64, foto_url, job_id, tipo_produto } = body;

    if (!foto_base64 && !foto_url) {
      return jsonResponse({ error: 'foto_base64 ou foto_url é obrigatório' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: configRow } = await supabase.from('admin_config').select('valor').eq('chave', 'OPENROUTER_API_KEY').single();
    const apiKey = configRow?.valor as string;
    if (!apiKey) return jsonResponse({ error: 'OpenRouter API key não configurada' }, 500);

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
          { role: 'user', content: [{ type: 'text', text: 'Analise esta foto de instalação:' }, imageContent] },
        ],
        max_tokens: 500, temperature: 0.2,
      }),
    });

    let analise: AnaliseResult = {
      aprovado: false, score_qualidade: 0, observacoes: [],
      problemas_detectados: ['Não foi possível analisar a foto'], recomendacoes: [],
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

    if (job_id) {
      await supabase
        .from('campo_jobs')
        .update({ observacoes: `Score qualidade: ${analise.score_qualidade}/100 - ${analise.aprovado ? 'Aprovado' : 'Reprovado'}` })
        .eq('id', job_id)
        .then(() => {});
    }

    await supabase.from('ai_logs').insert({
      funcao: 'analisar-foto-instalacao',
      tokens_usados: 0,
      custo: 0,
      metadata: { job_id, score: analise.score_qualidade, aprovado: analise.aprovado },
    }).catch(() => {});

    return jsonResponse(analise, 200);

  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
