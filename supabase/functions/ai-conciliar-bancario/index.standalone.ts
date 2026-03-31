// ai-conciliar-bancario — STANDALONE (sem imports relativos)
// Deploy: npx supabase@latest functions deploy ai-conciliar-bancario --project-ref djwjmfgplnqyffdcgdaw

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

interface Transacao { data: string; descricao: string; valor: number; tipo: 'credito' | 'debito'; }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const authResult = await authenticateAndAuthorize(req, ['admin', 'financeiro', 'gerente', 'diretor']);
    if ('error' in authResult) return jsonResponse({ error: authResult.error }, 401);

    const body = await req.json();
    const transacoes: Transacao[] = body.transacoes ?? [];
    const auto_conciliar = body.auto_conciliar !== false;
    if (!transacoes.length) return jsonResponse({ error: 'Nenhuma transação fornecida' }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: contasReceber } = await supabase
      .from('contas_receber')
      .select('id, pedido_id, cliente_id, valor_original, saldo, data_vencimento, observacoes, status, clientes(nome_fantasia, razao_social)')
      .in('status', ['a_vencer', 'vencida']).gt('saldo', 0);

    const { data: contasPagar } = await supabase
      .from('contas_pagar')
      .select('id, fornecedor, descricao, valor, data_vencimento, status')
      .in('status', ['pendente', 'aprovada']);

    const results = [];
    const autoCount = { conciliados: 0 };

    for (const tx of transacoes) {
      let bestMatch: any = null;
      let bestConfianca = 0;
      let motivo = 'Sem correspondência encontrada';
      const txValor = Math.abs(tx.valor);
      const txDesc = tx.descricao.toLowerCase();

      if (tx.tipo === 'credito' || tx.valor > 0) {
        for (const cr of contasReceber ?? []) {
          const saldo = Number(cr.saldo) || 0;
          let score = 0;
          if (Math.abs(saldo - txValor) < 0.02) score += 0.5;
          else if (Math.abs(saldo - txValor) / saldo < 0.05) score += 0.25;
          const clienteNome = ((cr.clientes as any)?.nome_fantasia ?? (cr.clientes as any)?.razao_social ?? '').toLowerCase();
          if (clienteNome && txDesc.includes(clienteNome.split(' ')[0])) score += 0.3;
          if (cr.data_vencimento && tx.data) {
            const daysDiff = Math.abs((new Date(tx.data).getTime() - new Date(cr.data_vencimento).getTime()) / 86400000);
            if (daysDiff <= 3) score += 0.15; else if (daysDiff <= 7) score += 0.08;
          }
          if (cr.observacoes && txDesc.includes(cr.observacoes.toLowerCase().slice(0, 15))) score += 0.1;
          if (score > bestConfianca) {
            bestConfianca = score;
            bestMatch = { tabela: 'contas_receber', registro_id: cr.id, descricao: cr.observacoes ?? `Pedido ${cr.pedido_id?.slice(0, 8) ?? '—'}`, valor_sistema: saldo, cliente_fornecedor: clienteNome || null };
            motivo = score >= 0.8 ? 'Valor exato + nome similar' : score >= 0.5 ? 'Valor compatível' : 'Correspondência parcial';
          }
        }
      } else {
        for (const cp of contasPagar ?? []) {
          const valor = Number(cp.valor) || 0;
          let score = 0;
          if (Math.abs(valor - txValor) < 0.02) score += 0.5;
          else if (Math.abs(valor - txValor) / valor < 0.05) score += 0.25;
          const fornecedor = (cp.fornecedor ?? '').toLowerCase();
          if (fornecedor && txDesc.includes(fornecedor.split(' ')[0])) score += 0.3;
          if (cp.descricao && txDesc.includes(cp.descricao.toLowerCase().slice(0, 15))) score += 0.15;
          if (cp.data_vencimento && tx.data) {
            const daysDiff = Math.abs((new Date(tx.data).getTime() - new Date(cp.data_vencimento).getTime()) / 86400000);
            if (daysDiff <= 3) score += 0.1; else if (daysDiff <= 7) score += 0.05;
          }
          if (score > bestConfianca) {
            bestConfianca = score;
            bestMatch = { tabela: 'contas_pagar', registro_id: cp.id, descricao: cp.descricao ?? cp.fornecedor ?? '—', valor_sistema: valor, cliente_fornecedor: cp.fornecedor ?? null };
            motivo = score >= 0.8 ? 'Valor exato + fornecedor identificado' : score >= 0.5 ? 'Valor compatível' : 'Correspondência parcial';
          }
        }
      }

      const confianca = Math.min(1, Math.round(bestConfianca * 100) / 100);
      const shouldAuto = auto_conciliar && confianca >= 0.9 && bestMatch?.registro_id;

      if (shouldAuto && bestMatch) {
        try {
          if (bestMatch.tabela === 'contas_receber') {
            const newSaldo = Math.max(0, (bestMatch.valor_sistema ?? 0) - txValor);
            await supabase.from('contas_receber').update({ saldo: newSaldo, status: newSaldo <= 0.01 ? 'paga' : 'a_vencer', data_pagamento: newSaldo <= 0.01 ? tx.data : null, observacoes_pagamento: `Auto-conciliado: ${tx.descricao}` }).eq('id', bestMatch.registro_id);
            autoCount.conciliados++;
          } else if (bestMatch.tabela === 'contas_pagar') {
            await supabase.from('contas_pagar').update({ status: 'paga', data_pagamento: tx.data, observacoes: `Auto-conciliado: ${tx.descricao}` }).eq('id', bestMatch.registro_id);
            autoCount.conciliados++;
          }
        } catch { /* silently fail, user can do manual */ }
      }

      results.push({
        transacao: tx,
        match: bestConfianca >= 0.2 ? bestMatch : null,
        confianca,
        motivo: bestConfianca >= 0.2 ? motivo : 'Sem correspondência encontrada',
        auto_conciliado: shouldAuto ? true : false,
      });
    }

    await supabase.from('ai_logs').insert({ funcao: 'conciliar-bancario', user_id: authResult.userId, tokens_usados: 0, custo: 0, metadata: { total_transacoes: transacoes.length, matches: results.filter(r => r.match).length, auto_conciliados: autoCount.conciliados } }).catch(() => {});

    return jsonResponse({
      matches: results,
      resumo: {
        total: transacoes.length,
        com_match: results.filter(r => r.match).length,
        sem_match: results.filter(r => !r.match).length,
        auto_conciliados: autoCount.conciliados,
        alta_confianca: results.filter(r => r.confianca >= 0.8).length,
        media_confianca: results.length > 0 ? Math.round(results.reduce((s, r) => s + r.confianca, 0) / results.length * 100) / 100 : 0,
      },
    }, 200);
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
