// ai-analisar-nps: Analyzes NPS comment with sentiment analysis
// Triggered after client submits NPS response
// If NPS < 7 + negative sentiment → creates task for manager
// If NPS >= 9 → flags upsell opportunity

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsOptions, jsonResponse } from '../ai-shared/ai-helpers.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsOptions();
  const corsHeaders = getCorsHeaders(req);

  try {
    const body = await req.json();
    const { nps_id } = body;

    if (!nps_id) {
      return jsonResponse({ error: 'nps_id é obrigatório' }, 400, corsHeaders);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ── 1. Fetch NPS response ────────────────────────────────────────
    const { data: nps, error: npsError } = await supabase
      .from('nps_respostas')
      .select('id, pedido_id, cliente_id, nota, comentario, metadata')
      .eq('id', nps_id)
      .single();

    if (npsError || !nps) {
      return jsonResponse({ error: 'NPS não encontrado' }, 404, corsHeaders);
    }

    // Skip if no comment to analyze
    if (!nps.comentario || nps.comentario.trim().length < 3) {
      const categoria = nps.nota >= 9 ? 'promotor' : nps.nota >= 7 ? 'neutro' : 'detrator';
      await supabase
        .from('nps_respostas')
        .update({
          metadata: {
            ...(nps.metadata ?? {}),
            analise: { sentimento: 'neutro', categoria, temas: [], risco_churn: false },
          },
        })
        .eq('id', nps_id);

      return jsonResponse({ analise: { sentimento: 'neutro', categoria, temas: [] } }, 200, corsHeaders);
    }

    // ── 2. Get OpenRouter key ────────────────────────────────────────
    const { data: configRow } = await supabase
      .from('admin_config')
      .select('valor')
      .eq('chave', 'OPENROUTER_API_KEY')
      .single();

    const apiKey = configRow?.valor as string;

    let analise = {
      sentimento: 'neutro' as string,
      categoria: (nps.nota >= 9 ? 'promotor' : nps.nota >= 7 ? 'neutro' : 'detrator'),
      temas: [] as string[],
      risco_churn: false,
      resumo: '',
    };

    if (apiKey) {
      // ── 3. AI sentiment analysis ─────────────────────────────────
      const prompt = `Analise este comentário de pesquisa NPS (nota ${nps.nota}/10) de um cliente de uma empresa de comunicação visual:

"${nps.comentario}"

Responda EXATAMENTE neste JSON:
{
  "sentimento": "positivo" | "neutro" | "negativo",
  "temas": ["tema1", "tema2"],
  "risco_churn": true | false,
  "resumo": "uma frase resumindo o sentimento"
}

Temas possíveis: qualidade, prazo, atendimento, preço, instalação, comunicação, design, material.`;

      try {
        const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://crm-croma.vercel.app',
          },
          body: JSON.stringify({
            model: 'openai/gpt-4.1-mini',
            messages: [
              { role: 'system', content: 'Responda apenas em JSON válido.' },
              { role: 'user', content: prompt },
            ],
            max_tokens: 200,
            temperature: 0.2,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const raw = aiData.choices?.[0]?.message?.content ?? '';
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            analise = {
              ...analise,
              sentimento: parsed.sentimento ?? analise.sentimento,
              temas: parsed.temas ?? [],
              risco_churn: parsed.risco_churn ?? false,
              resumo: parsed.resumo ?? '',
            };
          }
        }
      } catch { /* AI failed, use defaults */ }
    }

    // ── 4. Save analysis ─────────────────────────────────────────────
    await supabase
      .from('nps_respostas')
      .update({
        metadata: { ...(nps.metadata ?? {}), analise },
      })
      .eq('id', nps_id);

    // ── 5. Auto-actions ──────────────────────────────────────────────
    // Detrator with negative sentiment → create alert
    if (nps.nota < 7 && analise.sentimento === 'negativo') {
      await supabase.from('ai_alertas').insert({
        tipo: 'nps_detrator',
        titulo: `NPS Detrator — nota ${nps.nota}/10`,
        descricao: `Cliente insatisfeito: "${nps.comentario?.slice(0, 100)}". Temas: ${analise.temas.join(', ') || 'não identificado'}. ${analise.resumo}`,
        severidade: nps.nota <= 3 ? 'critica' : 'importante',
        resolvido: false,
        metadata: { nps_id, pedido_id: nps.pedido_id, cliente_id: nps.cliente_id, nota: nps.nota },
      }).catch(() => {});
    }

    // Promotor → flag upsell opportunity
    if (nps.nota >= 9) {
      await supabase.from('ai_alertas').insert({
        tipo: 'nps_promotor',
        titulo: `NPS Promotor — nota ${nps.nota}/10`,
        descricao: `Cliente satisfeito: potencial para indicação ou upsell. ${analise.resumo}`,
        severidade: 'dica',
        resolvido: false,
        metadata: { nps_id, pedido_id: nps.pedido_id, cliente_id: nps.cliente_id, nota: nps.nota },
      }).catch(() => {});
    }

    // ── 6. Log ───────────────────────────────────────────────────────
    await supabase.from('ai_logs').insert({
      funcao: 'analisar-nps',
      tokens_usados: 0,
      custo: 0,
      metadata: { nps_id, nota: nps.nota, sentimento: analise.sentimento },
    }).catch(() => {});

    return jsonResponse({ analise }, 200, corsHeaders);

  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500, getCorsHeaders(req));
  }
});
