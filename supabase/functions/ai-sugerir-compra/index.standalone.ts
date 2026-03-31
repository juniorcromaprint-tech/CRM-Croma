// ai-sugerir-compra — STANDALONE (sem imports relativos)
// Deploy: npx supabase@latest functions deploy ai-sugerir-compra --project-ref djwjmfgplnqyffdcgdaw

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
    const authResult = await authenticateAndAuthorize(req, ['admin', 'gerente', 'compras', 'diretor']);
    if ('error' in authResult) return jsonResponse({ error: authResult.error }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: saldos } = await supabase
      .from('v_estoque_saldos')
      .select('material_id, nome, unidade, saldo_disponivel, saldo_reservado, estoque_minimo, estoque_ideal');

    if (!saldos || saldos.length === 0) return jsonResponse({ sugestoes: [], resumo: 'Nenhum material cadastrado' }, 200);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: movs } = await supabase
      .from('estoque_movimentacoes')
      .select('material_id, quantidade')
      .in('tipo', ['saida', 'reserva'])
      .gte('created_at', thirtyDaysAgo.toISOString());

    const consumo30d: Record<string, number> = {};
    for (const m of movs ?? []) {
      consumo30d[m.material_id] = (consumo30d[m.material_id] ?? 0) + Math.abs(Number(m.quantidade) || 0);
    }

    const { data: materiais } = await supabase.from('materiais').select('id, preco_medio, fornecedor_principal');
    const precoMap = new Map((materiais ?? []).map(m => [m.id, { preco: Number(m.preco_medio) || 0, fornecedor: m.fornecedor_principal }]));

    const sugestoes = [];
    for (const s of saldos) {
      const disponivel = Number(s.saldo_disponivel) || 0;
      const reservado = Number(s.saldo_reservado) || 0;
      const minimo = Number(s.estoque_minimo) || 0;
      const ideal = Number(s.estoque_ideal) || minimo * 1.5;
      const consumoMensal = consumo30d[s.material_id] ?? 0;
      const consumoDiario = consumoMensal / 30;
      const diasCobertura = consumoDiario > 0 ? Math.floor(disponivel / consumoDiario) : (disponivel > 0 ? 999 : 0);

      if (disponivel >= ideal && consumoMensal === 0) continue;

      const qtdSugerida = Math.max(0, ideal - disponivel + (consumoMensal * 1.5));
      if (qtdSugerida <= 0) continue;

      const info = precoMap.get(s.material_id);
      const custoEstimado = (info?.preco ?? 0) * qtdSugerida;

      let urgencia: 'critico' | 'alto' | 'medio' | 'baixo' = 'baixo';
      if (disponivel <= 0 || diasCobertura <= 3) urgencia = 'critico';
      else if (disponivel <= minimo || diasCobertura <= 7) urgencia = 'alto';
      else if (disponivel <= ideal || diasCobertura <= 15) urgencia = 'medio';

      sugestoes.push({
        material_id: s.material_id, nome: s.nome, unidade: s.unidade ?? 'un',
        saldo_atual: disponivel, reservado, estoque_minimo: minimo, estoque_ideal: ideal,
        consumo_mensal: Math.round(consumoMensal * 100) / 100,
        dias_cobertura: diasCobertura === 999 ? null : diasCobertura,
        qtd_sugerida: Math.round(qtdSugerida * 100) / 100,
        preco_unitario: info?.preco ?? 0,
        custo_estimado: Math.round(custoEstimado * 100) / 100,
        fornecedor: info?.fornecedor ?? null,
        urgencia,
      });
    }

    const urgOrder = { critico: 0, alto: 1, medio: 2, baixo: 3 };
    sugestoes.sort((a, b) => urgOrder[a.urgencia] - urgOrder[b.urgencia]);

    const custoTotal = sugestoes.reduce((s, item) => s + item.custo_estimado, 0);

    await supabase.from('ai_logs').insert({ funcao: 'sugerir-compra', user_id: authResult.userId, tokens_usados: 0, custo: 0, metadata: { total: sugestoes.length, custo_total: custoTotal } }).catch(() => {});

    return jsonResponse({
      sugestoes,
      resumo: {
        total_materiais: sugestoes.length,
        criticos: sugestoes.filter(s => s.urgencia === 'critico').length,
        altos: sugestoes.filter(s => s.urgencia === 'alto').length,
        custo_total_estimado: Math.round(custoTotal * 100) / 100,
      },
    }, 200);

  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
