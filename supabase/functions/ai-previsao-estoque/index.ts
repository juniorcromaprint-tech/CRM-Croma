// ai-previsao-estoque: Demand forecasting for materials
// Analyzes last 90 days of consumption + open proposals pipeline
// Returns: materials with predicted consumption, stockout risk, purchase suggestions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsOptions, authenticateAndAuthorize, jsonResponse } from '../ai-shared/ai-helpers.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface MaterialForecast {
  material_id: string;
  nome: string;
  unidade: string;
  saldo_atual: number;
  reservado: number;
  disponivel: number;
  estoque_minimo: number;
  consumo_medio_diario: number;
  consumo_previsto_periodo: number;
  dias_cobertura: number;
  sugestao_compra: number;
  urgencia: 'critico' | 'atencao' | 'ok';
  pipeline_demanda: number;
  tendencia: 'crescente' | 'estavel' | 'decrescente';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsOptions();

  const corsHeaders = getCorsHeaders(req);

  try {
    // Auth — only gerente, admin, compras
    const authResult = await authenticateAndAuthorize(req, ['gerente', 'admin', 'compras']);
    if ('error' in authResult) {
      return jsonResponse({ error: authResult.error }, 401, corsHeaders);
    }

    const body = await req.json().catch(() => ({}));
    const periodo_dias = body.periodo_dias ?? 30;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ── 1. Get current stock levels ─────────────────────────────────────
    const { data: saldos } = await supabase
      .from('v_estoque_saldos')
      .select('material_id, nome, unidade, saldo_disponivel, saldo_reservado, estoque_minimo, estoque_ideal');

    if (!saldos || saldos.length === 0) {
      return jsonResponse({ materiais: [], resumo: 'Nenhum material com saldo cadastrado' }, 200, corsHeaders);
    }

    // ── 2. Get consumption from last 90 days ────────────────────────────
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: movimentacoes } = await supabase
      .from('estoque_movimentacoes')
      .select('material_id, tipo, quantidade, created_at')
      .in('tipo', ['saida', 'reserva'])
      .gte('created_at', ninetyDaysAgo.toISOString());

    // Aggregate consumption by material (last 90, 60, 30 days)
    const now = Date.now();
    const consumo: Record<string, { d90: number; d60: number; d30: number }> = {};

    for (const mov of movimentacoes ?? []) {
      if (!consumo[mov.material_id]) consumo[mov.material_id] = { d90: 0, d60: 0, d30: 0 };
      const qty = Math.abs(Number(mov.quantidade) || 0);
      const daysAgo = (now - new Date(mov.created_at).getTime()) / (1000 * 60 * 60 * 24);

      consumo[mov.material_id].d90 += qty;
      if (daysAgo <= 60) consumo[mov.material_id].d60 += qty;
      if (daysAgo <= 30) consumo[mov.material_id].d30 += qty;
    }

    // ── 3. Get pipeline demand from open proposals ──────────────────────
    const { data: pipelineItems } = await supabase
      .from('proposta_item_materiais')
      .select(`
        material_id,
        quantidade,
        proposta_itens!inner(
          propostas!inner(status)
        )
      `)
      .in('proposta_itens.propostas.status', ['enviada', 'visualizada', 'rascunho']);

    const pipelineDemanda: Record<string, number> = {};
    for (const item of pipelineItems ?? []) {
      const mid = item.material_id;
      if (!pipelineDemanda[mid]) pipelineDemanda[mid] = 0;
      // Weight by status probability
      const status = (item as any).proposta_itens?.propostas?.status;
      const prob = status === 'visualizada' ? 0.4 : status === 'enviada' ? 0.25 : 0.1;
      pipelineDemanda[mid] += (Number(item.quantidade) || 0) * prob;
    }

    // ── 4. Calculate forecasts ──────────────────────────────────────────
    const forecasts: MaterialForecast[] = [];

    for (const s of saldos) {
      const c = consumo[s.material_id] ?? { d90: 0, d60: 0, d30: 0 };

      // Weighted average: recent months count more
      const consumoMedioDiario = (c.d30 / 30 * 0.5) + (c.d60 / 60 * 0.3) + (c.d90 / 90 * 0.2);
      const consumoPrevisto = consumoMedioDiario * periodo_dias;
      const pipeline = pipelineDemanda[s.material_id] ?? 0;

      const disponivel = Number(s.saldo_disponivel) || 0;
      const reservado = Number(s.saldo_reservado) || 0;
      const estoqueMinimo = Number(s.estoque_minimo) || 0;
      const estoqueIdeal = Number(s.estoque_ideal) || estoqueMinimo * 1.5;

      const diasCobertura = consumoMedioDiario > 0
        ? Math.floor(disponivel / consumoMedioDiario)
        : disponivel > 0 ? 999 : 0;

      // Trend detection
      const d30Rate = c.d30 / 30;
      const d60Rate = (c.d60 - c.d30) / 30;
      const tendencia: 'crescente' | 'estavel' | 'decrescente' =
        d30Rate > d60Rate * 1.2 ? 'crescente' :
        d30Rate < d60Rate * 0.8 ? 'decrescente' : 'estavel';

      // Purchase suggestion: enough to reach ideal level + predicted consumption
      const sugestaoCompra = Math.max(0,
        estoqueIdeal + consumoPrevisto + pipeline - disponivel - reservado
      );

      // Urgency
      let urgencia: 'critico' | 'atencao' | 'ok' = 'ok';
      if (disponivel <= estoqueMinimo || diasCobertura <= 7) urgencia = 'critico';
      else if (diasCobertura <= 15 || disponivel <= estoqueIdeal * 0.5) urgencia = 'atencao';

      // Only include materials with some activity or low stock
      if (consumoMedioDiario > 0 || urgencia !== 'ok' || pipeline > 0) {
        forecasts.push({
          material_id: s.material_id,
          nome: s.nome,
          unidade: s.unidade ?? 'un',
          saldo_atual: disponivel + reservado,
          reservado,
          disponivel,
          estoque_minimo: estoqueMinimo,
          consumo_medio_diario: Math.round(consumoMedioDiario * 100) / 100,
          consumo_previsto_periodo: Math.round(consumoPrevisto * 100) / 100,
          dias_cobertura: diasCobertura,
          sugestao_compra: Math.round(sugestaoCompra * 100) / 100,
          urgencia,
          pipeline_demanda: Math.round(pipeline * 100) / 100,
          tendencia,
        });
      }
    }

    // Sort by urgency then by days of coverage
    const urgencyOrder = { critico: 0, atencao: 1, ok: 2 };
    forecasts.sort((a, b) =>
      urgencyOrder[a.urgencia] - urgencyOrder[b.urgencia] || a.dias_cobertura - b.dias_cobertura
    );

    // ── 5. Summary ──────────────────────────────────────────────────────
    const criticos = forecasts.filter(f => f.urgencia === 'critico').length;
    const atencao = forecasts.filter(f => f.urgencia === 'atencao').length;
    const valorCompra = forecasts.reduce((sum, f) => sum + f.sugestao_compra, 0);

    // Log
    await supabase.from('ai_logs').insert({
      funcao: 'previsao-estoque',
      user_id: authResult.userId,
      duracao_ms: Date.now() - (req.headers.get('x-start') ? parseInt(req.headers.get('x-start')!) : Date.now()),
      tokens_usados: 0,
      custo: 0,
      metadata: { periodo_dias, total: forecasts.length, criticos, atencao },
    }).catch(() => {});

    return jsonResponse({
      materiais: forecasts,
      resumo: {
        total_analisados: forecasts.length,
        criticos,
        atencao,
        ok: forecasts.length - criticos - atencao,
        periodo_dias,
        valor_compra_sugerido: Math.round(valorCompra * 100) / 100,
      },
    }, 200, corsHeaders);

  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500, corsHeaders);
  }
});
