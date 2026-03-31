// ai-sequenciar-producao — STANDALONE (sem imports relativos)
// Deploy: npx supabase@latest functions deploy ai-sequenciar-producao --project-ref djwjmfgplnqyffdcgdaw

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
async function authenticateAndAuthorize(req: Request, allowedRoles: string[]) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return { error: 'Não autorizado' };
  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) return { error: 'Token inválido' };
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = profile?.role ?? 'comercial';
  if (!allowedRoles.includes(role)) return { error: 'Sem permissão' };
  return { userId: user.id, userRole: role };
}
// ────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const authResult = await authenticateAndAuthorize(req, ['admin', 'gerente', 'producao', 'diretor']);
    if ('error' in authResult) return jsonResponse({ error: authResult.error }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: ops } = await supabase
      .from('ordens_producao')
      .select(`
        id, numero, status, prioridade, created_at,
        pedido_itens(descricao, quantidade, valor_total),
        pedidos(numero, data_prometida, clientes(nome_fantasia))
      `)
      .in('status', ['criada', 'em_producao', 'liberada'])
      .order('created_at', { ascending: true });

    if (!ops || ops.length === 0) {
      return jsonResponse({ sequencia: [], resumo: 'Nenhuma OP pendente' }, 200);
    }

    const now = new Date();
    const scored = ops.map((op) => {
      const pedido = op.pedidos as any;
      const dataPrometida = pedido?.data_prometida ? new Date(pedido.data_prometida) : null;
      const diasRestantes = dataPrometida
        ? Math.ceil((dataPrometida.getTime() - now.getTime()) / 86400000)
        : 999;

      const prioridadeScore: Record<string, number> = { urgente: 100, alta: 75, normal: 50, baixa: 25 };
      const pScore = prioridadeScore[op.prioridade ?? 'normal'] ?? 50;
      const deadlineScore = diasRestantes <= 0 ? 150 : diasRestantes <= 3 ? 100 : diasRestantes <= 7 ? 60 : diasRestantes <= 14 ? 30 : 10;
      const statusBoost = op.status === 'em_producao' ? 50 : 0;
      const totalScore = pScore + deadlineScore + statusBoost;

      const item = op.pedido_itens as any;
      const statusLabel = diasRestantes <= 0 ? 'atrasado' : diasRestantes <= 3 ? 'urgente' : diasRestantes <= 7 ? 'apertado' : 'no_prazo';

      return {
        op_id: op.id,
        op_numero: op.numero,
        pedido_numero: pedido?.numero ?? '—',
        cliente: pedido?.clientes?.nome_fantasia ?? '—',
        descricao: item?.descricao ?? '—',
        quantidade: item?.quantidade ?? 0,
        prioridade: op.prioridade ?? 'normal',
        status: op.status,
        data_prometida: pedido?.data_prometida ?? null,
        dias_restantes: diasRestantes === 999 ? null : diasRestantes,
        status_prazo: statusLabel,
        score: totalScore,
      };
    });

    scored.sort((a, b) => b.score - a.score);

    let diasAcumulados = 0;
    const sequencia = scored.map((item, idx) => {
      const diasEstimados = 2;
      const dataInicio = new Date(now);
      dataInicio.setDate(dataInicio.getDate() + diasAcumulados);
      const dataFim = new Date(dataInicio);
      dataFim.setDate(dataFim.getDate() + diasEstimados);
      diasAcumulados += diasEstimados;
      return {
        ordem: idx + 1,
        ...item,
        data_inicio_estimada: dataInicio.toISOString().slice(0, 10),
        data_fim_estimada: dataFim.toISOString().slice(0, 10),
      };
    });

    const atrasados = sequencia.filter(s => s.status_prazo === 'atrasado').length;
    const urgentes = sequencia.filter(s => s.status_prazo === 'urgente').length;

    await supabase.from('ai_logs').insert({
      funcao: 'sequenciar-producao',
      user_id: authResult.userId,
      tokens_usados: 0,
      custo: 0,
      metadata: { total_ops: sequencia.length, atrasados, urgentes },
    }).catch(() => {});

    return jsonResponse({
      sequencia,
      resumo: { total: sequencia.length, atrasados, urgentes, no_prazo: sequencia.length - atrasados - urgentes },
    }, 200);

  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
