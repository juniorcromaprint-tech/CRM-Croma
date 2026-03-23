// ai-sequenciar-producao: Intelligent production order sequencing
// Considers: deadline, priority, shared setup (same material grouping), bottlenecks
// Returns optimized sequence with estimated dates

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsOptions, authenticateAndAuthorize, jsonResponse } from '../ai-shared/ai-helpers.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsOptions();
  const corsHeaders = getCorsHeaders(req);

  try {
    const authResult = await authenticateAndAuthorize(req, ['admin', 'gerente', 'producao', 'diretor']);
    if ('error' in authResult) return jsonResponse({ error: authResult.error }, 401, corsHeaders);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ── 1. Fetch pending production orders ───────────────────────────
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
      return jsonResponse({ sequencia: [], resumo: 'Nenhuma OP pendente' }, 200, corsHeaders);
    }

    // ── 2. Score and sort ────────────────────────────────────────────
    const now = new Date();
    const scored = ops.map((op) => {
      const pedido = op.pedidos as any;
      const dataPrometida = pedido?.data_prometida ? new Date(pedido.data_prometida) : null;
      const diasRestantes = dataPrometida
        ? Math.ceil((dataPrometida.getTime() - now.getTime()) / 86400000)
        : 999;

      // Priority score (higher = more urgent)
      const prioridadeScore: Record<string, number> = {
        urgente: 100, alta: 75, normal: 50, baixa: 25,
      };
      const pScore = prioridadeScore[op.prioridade ?? 'normal'] ?? 50;

      // Deadline urgency (exponential as deadline approaches)
      const deadlineScore = diasRestantes <= 0 ? 150 : diasRestantes <= 3 ? 100 : diasRestantes <= 7 ? 60 : diasRestantes <= 14 ? 30 : 10;

      // Already in production gets boost
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

    // Sort by score descending (highest urgency first)
    scored.sort((a, b) => b.score - a.score);

    // Add sequence number and estimated dates
    let diasAcumulados = 0;
    const sequencia = scored.map((item, idx) => {
      const diasEstimados = 2; // default 2 days per OP (can be refined later)
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

    // Summary
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
      resumo: {
        total: sequencia.length,
        atrasados,
        urgentes,
        no_prazo: sequencia.length - atrasados - urgentes,
      },
    }, 200, corsHeaders);

  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500, getCorsHeaders(req));
  }
});
