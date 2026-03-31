// ai-previsao-estoque — STANDALONE (sem imports relativos)
// Deploy: npx supabase@latest functions deploy ai-previsao-estoque --project-ref djwjmfgplnqyffdcgdaw

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Content-Type, Authorization',
};
function jsonResponse(data: unknown, status: number, h = CORS_HEADERS): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...h, 'Content-Type': 'application/json' } });
}
async function authenticateAndAuthorize(req: Request, allowedRoles: string[]) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return { error: 'Não autorizado' };
  const supabaseAuth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) return { error: 'Token inválido' };
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = profile?.role ?? 'comercial';
  if (!allowedRoles.includes(role)) return { error: 'Sem permissão' };
  return { userId: user.id, userRole: role };
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const authResult = await authenticateAndAuthorize(req, ['gerente', 'admin', 'compras']);
    if ('error' in authResult) return jsonResponse({ error: authResult.error }, 401);

    const body = await req.json().catch(() => ({}));
    const periodo_dias = body.periodo_dias ?? 30;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: saldos } = await supabase
      .from('v_estoque_saldos')
      .select('material_id, nome, unidade, saldo_disponivel, saldo_reservado, estoque_minimo, estoque_ideal');

    if (!saldos || saldos.length === 0) return jsonResponse({ materiais: [], resumo: 'Nenhum material com saldo cadastrado' }, 200);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: movimentacoes } = await supabase
      .from('estoque_movimentacoes')
      .select('material_id, tipo, quantidade, created_at')
      .in('tipo', ['saida', 'reserva'])
      .gte('created_at', ninetyDaysAgo.toISOString());

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

    const { data: pipelineItems } = await supabase
      .from('proposta_item_materiais')
      .select('material_id, quantidade, proposta_itens!inner(propostas!inner(status))')
      .in('proposta_itens.propostas.status', ['enviada', 'visualizada', 'rascunho']);

    const pipelineDemanda: Record<string, number> = {};
    for (const item of pipelineItems ?? []) {
      const mid = item.material_id;
      if (!pipelineDemanda[mid]) pipelineDemanda[mid] = 0;
      const status = (item as any).proposta_itens?.propostas?.status;
      const prob = status === 'visualizada' ? 0.4 : status === 'enviada' ? 0.25 : 0.1;
      pipelineDemanda[mid] += (Number(item.quantidade) || 0) * prob;
    }

    const forecasts = [];
    for (const s of saldos) {
      const c = consumo[s.material_id] ?? { d90: 0, d60: 0, d30: 0 };
      const consumoMedioDiario = (c.d30 / 30 * 0.5) + (c.d60 / 60 * 0.3) + (c.d90 / 90 * 0.2);
      const consumoPrevisto = consumoMedioDiario * periodo_dias;
      const pipeline = pipelineDemanda[s.material_id] ?? 0;
      const disponivel = Number(s.saldo_disponivel) || 0;
      const reservado = Number(s.saldo_reservado) || 0;
      const estoqueMinimo = Number(s.estoque_minimo) || 0;
      const estoqueIdeal = Number(s.estoque_ideal) || estoqueMinimo * 1.5;
      const diasCobertura = consumoMedioDiario > 0 ? Math.floor(disponivel / consumoMedioDiario) : (disponivel > 0 ? 999 : 0);

      const d30Rate = c.d30 / 30;
      const d60Rate = (c.d60 - c.d30) / 30;
      const tendencia: 'crescente' | 'estavel' | 'decrescente' =
        d30Rate > d60Rate * 1.2 ? 'crescente' : d30Rate < d60Rate * 0.8 ? 'decrescente' : 'estavel';

      const sugestaoCompra = Math.max(0, estoqueIdeal + consumoPrevisto + pipeline - disponivel - reservado);
      let urgencia: 'critico' | 'atencao' | 'ok' = 'ok';
      if (disponivel <= estoqueMinimo || diasCobertura <= 7) urgencia = 'critico';
      else if (diasCobertura <= 15 || disponivel <= estoqueIdeal * 0.5) urgencia = 'atencao';

      if (consumoMedioDiario > 0 || urgencia !== 'ok' || pipeline > 0) {
        forecasts.push({
          material_id: s.material_id, nome: s.nome, unidade: s.unidade ?? 'un',
          saldo_atual: disponivel + reservado, reservado, disponivel, estoque_minimo: estoqueMinimo,
          consumo_medio_diario: Math.round(consumoMedioDiario * 100) / 100,
          consumo_previsto_periodo: Math.round(consumoPrevisto * 100) / 100,
          dias_cobertura: diasCobertura, sugestao_compra: Math.round(sugestaoCompra * 100) / 100,
          urgencia, pipeline_demanda: Math.round(pipeline * 100) / 100, tendencia,
        });
      }
    }

    const urgencyOrder = { critico: 0, atencao: 1, ok: 2 };
    forecasts.sort((a, b) => urgencyOrder[a.urgencia] - urgencyOrder[b.urgencia] || a.dias_cobertura - b.dias_cobertura);

    const criticos = forecasts.filter(f => f.urgencia === 'critico').length;
    const atencao = forecasts.filter(f => f.urgencia === 'atencao').length;
    const valorCompra = forecasts.reduce((sum, f) => sum + f.sugestao_compra, 0);

    await supabase.from('ai_logs').insert({ funcao: 'previsao-estoque', user_id: authResult.userId, tokens_usados: 0, custo: 0, metadata: { periodo_dias, total: forecasts.length, criticos, atencao } }).catch(() => {});

    return jsonResponse({
      materiais: forecasts,
      resumo: { total_analisados: forecasts.length, criticos, atencao, ok: forecasts.length - criticos - atencao, periodo_dias, valor_compra_sugerido: Math.round(valorCompra * 100) / 100 },
    }, 200);

  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
