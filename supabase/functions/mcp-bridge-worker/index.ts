// mcp-bridge-worker v3 (2026-04-24 S2.7) — locking atômico + X-Internal-Call
// - ATOMIC claim: UPDATE status='processing' WHERE status='pending' RETURNING (via RPC)
// - Fallback: SELECT FOR UPDATE SKIP LOCKED então UPDATE (se RPC não existir)
// - Usa header X-Internal-Call quando chama outras Edge Functions IA (fix S2.6)

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const TIPO_TO_EDGE: Record<string, string> = {
  'analisar-orcamento': 'ai-analisar-orcamento',
  'detectar-problemas': 'ai-detectar-problemas',
  'briefing-producao': 'ai-briefing-producao',
  'composicao-produto': 'ai-composicao-produto',
  'qualificar-lead': 'ai-qualificar-lead',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    }});
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const startTime = Date.now();

  try {
    // ATOMIC CLAIM: marca pending → processing em uma única query + RETURNING
    const claimed = await claimPendingRequests(supabase, 10);
    if (claimed.length === 0) {
      return json({ status: 'ok', processed: 0, message: 'Nenhum request pending', duration_ms: Date.now() - startTime });
    }

    const results: any[] = [];

    for (const r of claimed) {
      if (r.expires_at && new Date(r.expires_at) < new Date()) {
        await supabase.from('ai_requests').update({ status: 'expired', error_message: 'Expired before processing' }).eq('id', r.id);
        results.push({ id: r.id, status: 'expired' });
        continue;
      }

      const reqStart = Date.now();
      try {
        let response: any;

        if (r.tipo === 'resumo-cliente') {
          response = await handleResumoClienteLocal(supabase, r);
        } else if (TIPO_TO_EDGE[r.tipo]) {
          response = await invokeEdgeFunctionInternal(TIPO_TO_EDGE[r.tipo], r);
        } else {
          throw new Error(`Tipo desconhecido: ${r.tipo}`);
        }

        await supabase.from('ai_responses').insert({
          request_id: r.id,
          conteudo: response,
          summary: response?.summary ?? null,
          actions: response?.actions ?? null,
          model_used: response?.model_used ?? 'bridge-worker-local',
          tokens_used: response?.tokens_used ?? null,
          cost_usd: response?.cost_usd ?? 0,
          duration_ms: Date.now() - reqStart,
        });

        await supabase.from('ai_requests').update({
          status: 'completed', processed_at: new Date().toISOString(),
        }).eq('id', r.id);

        results.push({ id: r.id, tipo: r.tipo, status: 'completed', duration_ms: Date.now() - reqStart });
      } catch (err) {
        await supabase.from('ai_requests').update({
          status: 'error',
          error_message: (err as Error).message.substring(0, 500),
          processed_at: new Date().toISOString(),
        }).eq('id', r.id);
        results.push({ id: r.id, tipo: r.tipo, status: 'error', error: (err as Error).message });
      }
    }

    return json({ status: 'ok', processed: results.length, duration_ms: Date.now() - startTime, results });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});

// ── ATOMIC CLAIM: usa RPC se disponível, senão fallback OPTIMISTIC UPDATE ──
async function claimPendingRequests(supabase: SupabaseClient, limit: number): Promise<any[]> {
  // Tentar RPC primeiro (se existir)
  try {
    const { data, error } = await supabase.rpc('fn_claim_ai_requests', { p_limit: limit });
    if (!error && data) return data;
  } catch { /* fall through */ }

  // Fallback optimistic: SELECT ids → UPDATE WHERE id IN (ids) AND status='pending' RETURNING
  // (a cláusula status='pending' na condição faz o CAS: se outro worker já pegou, retorna 0 rows)
  const { data: candidates } = await supabase
    .from('ai_requests')
    .select('id, tipo, entity_type, entity_id, contexto, expires_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!candidates || candidates.length === 0) return [];

  const ids = candidates.map((c: any) => c.id);
  const { data: claimed, error: updateErr } = await supabase
    .from('ai_requests')
    .update({ status: 'processing' })
    .in('id', ids)
    .eq('status', 'pending') // CAS: só atualiza se ainda estiver pending
    .select('id, tipo, entity_type, entity_id, contexto, expires_at');

  if (updateErr) throw updateErr;
  return claimed ?? [];
}

// ── Chama Edge Function interna com header X-Internal-Call (fix S2.6) ──
async function invokeEdgeFunctionInternal(fnName: string, r: any): Promise<any> {
  const body = { ...(r.contexto ?? {}) };
  if (r.entity_id) {
    if (r.entity_type === 'cliente') body.cliente_id = r.entity_id;
    else if (r.entity_type === 'proposta') body.proposta_id = r.entity_id;
    else if (r.entity_type === 'pedido') body.pedido_id = r.entity_id;
    else if (r.entity_type === 'lead') body.lead_id = r.entity_id;
  }
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'X-Internal-Call': 'true',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`${fnName} retornou ${resp.status}: ${errText.substring(0, 200)}`);
  }
  return await resp.json();
}

// ── Handler local: resumo-cliente sem IA externa ──
async function handleResumoClienteLocal(supabase: SupabaseClient, r: any): Promise<any> {
  const clienteId = r.entity_id ?? r.contexto?.cliente_id;
  if (!clienteId) throw new Error('cliente_id ausente no request');

  const [cliente, propostas, pedidos, cr] = await Promise.all([
    supabase.from('clientes').select('id, nome_fantasia, razao_social, cnpj, email, telefone, segmento, ativo, created_at, score_credito, score_nivel').eq('id', clienteId).single(),
    supabase.from('propostas').select('id, numero, status, total, created_at').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(10),
    supabase.from('pedidos').select('id, numero, status, valor_total, created_at').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(10),
    supabase.from('contas_receber').select('id, valor_original, saldo, status, data_vencimento, data_pagamento').eq('cliente_id', clienteId).order('data_vencimento', { ascending: false }).limit(20),
  ]);

  if (cliente.error || !cliente.data) throw new Error('Cliente não encontrado');

  const c = cliente.data;
  const props = propostas.data ?? [];
  const peds = pedidos.data ?? [];
  const crs = cr.data ?? [];

  const totalFaturado = peds.filter((p: any) => p.status !== 'cancelado').reduce((s: number, p: any) => s + Number(p.valor_total ?? 0), 0);
  const propostasAprovadas = props.filter((p: any) => p.status === 'aprovada').length;
  const propostasPendentes = props.filter((p: any) => ['enviada','negociacao','rascunho'].includes(p.status)).length;
  const crVencidas = crs.filter((x: any) => x.status === 'vencido').length;
  const crVencidasValor = crs.filter((x: any) => x.status === 'vencido').reduce((s: number, x: any) => s + Number(x.saldo ?? 0), 0);
  const crPagas = crs.filter((x: any) => x.status === 'pago').length;
  const taxaConversao = props.length > 0 ? Math.round((propostasAprovadas / props.length) * 100) : 0;

  const actions: any[] = [];
  if (crVencidas > 0) {
    actions.push({
      id: `acao-cobranca-${clienteId}`, tipo: 'cobranca',
      titulo: `Cobrar títulos vencidos`,
      descricao: `${crVencidas} título(s) vencido(s) somando R$ ${crVencidasValor.toFixed(2)}`,
      aplicavel: true, severidade: 'alta',
    });
  }
  if (propostasPendentes > 0) {
    actions.push({
      id: `acao-followup-${clienteId}`, tipo: 'followup',
      titulo: `Follow-up de proposta`,
      descricao: `${propostasPendentes} proposta(s) aguardando resposta`,
      aplicavel: true, severidade: 'media',
    });
  }
  if (props.length === 0 && peds.length === 0) {
    actions.push({
      id: `acao-ativar-${clienteId}`, tipo: 'ativar',
      titulo: `Ativar relacionamento`,
      descricao: `Cliente sem propostas nem pedidos — oportunidade de prospecção`,
      aplicavel: true, severidade: 'baixa',
    });
  }

  return {
    cliente: { id: c.id, nome: c.nome_fantasia ?? c.razao_social, cnpj: c.cnpj, segmento: c.segmento, score: c.score_credito, score_nivel: c.score_nivel },
    kpis: {
      total_propostas: props.length, propostas_aprovadas: propostasAprovadas, propostas_pendentes: propostasPendentes,
      taxa_conversao_pct: taxaConversao, total_pedidos: peds.length, total_faturado: totalFaturado,
      cr_vencidas: crVencidas, cr_vencidas_valor: crVencidasValor, cr_pagas: crPagas,
    },
    ultimos_pedidos: peds.slice(0, 3).map((p: any) => ({ numero: p.numero, status: p.status, valor: p.valor_total })),
    ultimas_propostas: props.slice(0, 3).map((p: any) => ({ numero: p.numero, status: p.status, total: p.total })),
    summary: `${c.nome_fantasia ?? c.razao_social}: ${props.length} propostas (${propostasAprovadas} aprovadas, ${propostasPendentes} pendentes), ${peds.length} pedidos, R$ ${totalFaturado.toFixed(2)} faturado${crVencidas > 0 ? `. ALERTA: ${crVencidas} títulos vencidos (R$ ${crVencidasValor.toFixed(2)}).` : '.'}`,
    actions,
    model_used: 'bridge-worker-local-v3',
    cost_usd: 0,
    tokens_used: 0,
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
