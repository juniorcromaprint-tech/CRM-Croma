// ai-preco-dinamico: Dynamic pricing based on historical win/loss rates
// Analyzes approved vs rejected proposals by segment/category/volume
// Returns suggested markup with conversion rate estimate

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsOptions, authenticateAndAuthorize, jsonResponse } from '../ai-shared/ai-helpers.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsOptions();
  const corsHeaders = getCorsHeaders(req);

  try {
    const authResult = await authenticateAndAuthorize(req, ['admin', 'gerente', 'diretor', 'comercial']);
    if ('error' in authResult) return jsonResponse({ error: authResult.error }, 401, corsHeaders);

    const body = await req.json();
    const { proposta_id, segmento, categoria_produto } = body;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ── 1. Get proposal context ──────────────────────────────────────
    let clienteSegmento = segmento;
    let propCategoria = categoria_produto;

    if (proposta_id) {
      const { data: prop } = await supabase
        .from('propostas')
        .select('cliente_id, valor_total, clientes(segmento)')
        .eq('id', proposta_id)
        .single();

      if (prop) {
        clienteSegmento = clienteSegmento || (prop.clientes as any)?.segmento;
      }
    }

    // ── 2. Get historical proposals (last 6 months) ──────────────────
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: historico } = await supabase
      .from('propostas')
      .select('id, status, valor_total, desconto_percentual, created_at, clientes(segmento)')
      .in('status', ['aprovada', 'recusada', 'expirada'])
      .gte('created_at', sixMonthsAgo.toISOString())
      .not('valor_total', 'is', null);

    if (!historico || historico.length < 5) {
      return jsonResponse({
        markup_sugerido: null,
        motivo: 'Dados insuficientes — menos de 5 propostas finalizadas nos últimos 6 meses',
        total_analisadas: historico?.length ?? 0,
      }, 200, corsHeaders);
    }

    // ── 3. Statistical analysis ──────────────────────────────────────
    // Group by segment
    const bySegment: Record<string, { aprovadas: number[]; recusadas: number[]; total: number }> = {};

    for (const p of historico) {
      const seg = (p.clientes as any)?.segmento ?? 'geral';
      if (!bySegment[seg]) bySegment[seg] = { aprovadas: [], recusadas: [], total: 0 };
      bySegment[seg].total++;

      const desconto = Number(p.desconto_percentual) || 0;
      const markupEfetivo = 100 - desconto; // simplified proxy

      if (p.status === 'aprovada') {
        bySegment[seg].aprovadas.push(markupEfetivo);
      } else {
        bySegment[seg].recusadas.push(markupEfetivo);
      }
    }

    // Calculate stats for target segment
    const targetSeg = clienteSegmento ?? 'geral';
    const segData = bySegment[targetSeg] ?? bySegment['geral'] ?? Object.values(bySegment)[0];

    if (!segData || segData.total === 0) {
      return jsonResponse({
        markup_sugerido: null,
        motivo: 'Sem dados para o segmento especificado',
      }, 200, corsHeaders);
    }

    const taxaConversao = segData.total > 0
      ? Math.round((segData.aprovadas.length / segData.total) * 100)
      : 0;

    // Calculate optimal range
    const allMarkups = [...segData.aprovadas, ...segData.recusadas].sort((a, b) => a - b);
    const aprovMediana = segData.aprovadas.length > 0
      ? segData.aprovadas.sort((a, b) => a - b)[Math.floor(segData.aprovadas.length / 2)]
      : 0;
    const recusMediana = segData.recusadas.length > 0
      ? segData.recusadas.sort((a, b) => a - b)[Math.floor(segData.recusadas.length / 2)]
      : 100;

    const q25 = allMarkups[Math.floor(allMarkups.length * 0.25)] ?? 0;
    const q75 = allMarkups[Math.floor(allMarkups.length * 0.75)] ?? 100;

    // Benchmarks by all segments
    const benchmarks = Object.entries(bySegment).map(([seg, data]) => ({
      segmento: seg,
      taxa_conversao: data.total > 0 ? Math.round((data.aprovadas.length / data.total) * 100) : 0,
      total_propostas: data.total,
      markup_medio_aprovadas: data.aprovadas.length > 0
        ? Math.round(data.aprovadas.reduce((s, v) => s + v, 0) / data.aprovadas.length)
        : null,
    }));

    const resultado = {
      markup_sugerido: Math.round(aprovMediana),
      faixa_competitiva: { min: Math.round(q25), max: Math.round(q75) },
      taxa_conversao_estimada: taxaConversao,
      segmento_analisado: targetSeg,
      total_analisadas: segData.total,
      aprovadas: segData.aprovadas.length,
      recusadas: segData.recusadas.length,
      benchmarks,
    };

    // Log
    await supabase.from('ai_logs').insert({
      funcao: 'preco-dinamico',
      user_id: authResult.userId,
      tokens_usados: 0,
      custo: 0,
      metadata: { segmento: targetSeg, markup: resultado.markup_sugerido, taxa: taxaConversao },
    }).catch(() => {});

    return jsonResponse(resultado, 200, corsHeaders);

  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500, getCorsHeaders(req));
  }
});
