// dispatch-approved-messages v1 (2026-05-06)
// Dedicated dispatcher: pega mensagens aprovadas e invoca whatsapp-enviar / agent-enviar-email
// com headers corretos (Authorization JWT legacy + apikey sb_secret).
//
// Substituiu a logica de processApprovedMessages do agent-cron-loop, que estava
// quebrada por incompatibilidade de auth entre gateway e env SERVICE_ROLE_KEY.
//
// Auth: aceita JWT legacy service_role (gateway valida) ou env match.
// Retry: backoff exponencial (5/15/45 min), max 3 tentativas -> 'falha_envio'.
// Rampa: usa fn_calcular_limite_diario() do banco.
// Janelas: respeita admin_config.agent_config.horarios.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function sb() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padding = padded.length % 4;
    const b64 = padded + (padding ? '='.repeat(4 - padding) : '');
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

function isAuthorized(req: Request): boolean {
  const ah = req.headers.get('Authorization');
  if (!ah?.startsWith('Bearer ')) return false;
  const tk = ah.replace('Bearer ', '');
  if (tk === SERVICE_ROLE_KEY) return true;
  const p = decodeJwtPayload(tk);
  return !!(p && p.role === 'service_role' && p.iss === 'supabase');
}

interface DispatchResult {
  status: 'ok' | 'skipped' | 'error';
  total_pending: number;
  whatsapp_sent: number;
  email_sent: number;
  errors: string[];
  motivo?: string;
  limite_dia?: number;
  enviadas_hoje?: number;
}

async function dispatch(): Promise<DispatchResult> {
  const result: DispatchResult = {
    status: 'ok', total_pending: 0, whatsapp_sent: 0, email_sent: 0, errors: [],
  };

  const client = sb();

  // 1) Carregar config (janelas + dias_entre_followup)
  const { data: configRow } = await client
    .from('admin_config').select('valor').eq('chave', 'agent_config').single();
  const config = (configRow?.valor && typeof configRow.valor === 'object'
    ? configRow.valor
    : typeof configRow?.valor === 'string'
      ? JSON.parse(configRow.valor)
      : {}) as Record<string, unknown>;

  // 2) Validar janela horaria BRT
  const now = new Date();
  const brtH = (now.getUTCHours() - 3 + 24) % 24;
  const brtM = now.getUTCMinutes();
  const brtMins = brtH * 60 + brtM;
  const horarios = (config.horarios as [string, string][]) || [['09:00', '12:00'], ['14:00', '17:00']];
  const inWindow = horarios.some(([s, e]) => {
    const [sh, sm] = s.split(':').map(Number);
    const [eh, em] = e.split(':').map(Number);
    return brtMins >= (sh * 60 + sm) && brtMins < (eh * 60 + em);
  });
  if (!inWindow) {
    result.status = 'skipped';
    result.motivo = `Fora das janelas (${brtH}:${String(brtM).padStart(2, '0')} BRT)`;
    return result;
  }

  // 3) Calcular limite via rampa progressiva
  let maxDia = 15;
  try {
    const { data: rpRes } = await client.rpc('fn_calcular_limite_diario');
    if (typeof rpRes === 'number' && rpRes > 0) maxDia = rpRes;
  } catch (_) { /* fallback */ }
  result.limite_dia = maxDia;

  // 4) Contar enviadas hoje (BRT)
  const inicioHoje = new Date();
  inicioHoje.setUTCHours(3, 0, 0, 0);
  if (brtH < 3) inicioHoje.setDate(inicioHoje.getDate() - 1);

  const { count: sentToday } = await client
    .from('agent_messages').select('id', { count: 'exact', head: true })
    .eq('canal', 'whatsapp').eq('status', 'enviada')
    .gte('enviado_em', inicioHoje.toISOString());
  result.enviadas_hoje = sentToday ?? 0;

  const remaining = Math.max(0, maxDia - (sentToday ?? 0));
  if (remaining === 0) {
    result.status = 'skipped';
    result.motivo = `Limite diario atingido (${sentToday}/${maxDia})`;
    return result;
  }

  // 5) Buscar mensagens aprovadas prontas (proximo_envio NULL ou no passado)
  const nowIso = new Date().toISOString();
  const { data: pending, error: pendErr } = await client
    .from('agent_messages')
    .select(`id, canal, conversation_id, tentativas_envio, max_tentativas_envio,
      agent_conversations!inner(id, lead_id, canal, status)`)
    .eq('status', 'aprovada')
    .eq('direcao', 'enviada')
    .or(`proximo_envio.is.null,proximo_envio.lte.${nowIso}`)
    .order('created_at', { ascending: true })
    .limit(remaining);

  if (pendErr) {
    result.status = 'error';
    result.errors.push(`Query: ${pendErr.message}`);
    return result;
  }
  if (!pending || pending.length === 0) return result;
  result.total_pending = pending.length;

  // 6) Carregar JWT legacy do vault
  const { data: jwtLegacy, error: jwtErr } = await client.rpc('get_service_role_key_for_dispatch');
  if (jwtErr || !jwtLegacy) {
    result.status = 'error';
    result.errors.push(`JWT legacy fetch: ${jwtErr?.message || 'null'}`);
    return result;
  }

  // 7) Despachar uma a uma com retry/backoff
  for (const msg of pending) {
    const canal = (msg.canal as string) || (msg.agent_conversations as any)?.canal || 'whatsapp';
    const fn = canal === 'email' ? 'agent-enviar-email' : 'whatsapp-enviar';
    const tentativas = (msg as any).tentativas_envio ?? 0;
    const maxT = (msg as any).max_tentativas_envio ?? 3;

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtLegacy}`,
          'apikey': SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({ message_id: msg.id }),
      });

      const txt = await res.text();
      let body: any = {};
      try { body = JSON.parse(txt); } catch { body = { raw: txt.substring(0, 500) }; }

      if (!res.ok || !body.success) {
        const novas = tentativas + 1;
        const errMsg = body.error || body.detail || `HTTP ${res.status}`;
        if (novas >= maxT) {
          await client.from('agent_messages').update({
            status: 'falha_envio',
            tentativas_envio: novas,
            erro_mensagem: `Max tentativas: ${errMsg}`.substring(0, 500),
          }).eq('id', msg.id);
          result.errors.push(`${msg.id}: max_tentativas (${errMsg})`);
        } else {
          const backoffMin = Math.pow(3, novas) * 5;
          const prox = new Date(Date.now() + backoffMin * 60_000);
          await client.from('agent_messages').update({
            tentativas_envio: novas,
            proximo_envio: prox.toISOString(),
            erro_mensagem: errMsg.substring(0, 500),
          }).eq('id', msg.id);
          result.errors.push(`${msg.id}: tentativa ${novas}/${maxT} retry em ${backoffMin}min`);
        }
        continue;
      }

      // Sucesso
      if (canal === 'email') result.email_sent++;
      else result.whatsapp_sent++;

      const diasFu = (config.dias_entre_followup as number) ?? 3;
      const proxFu = new Date();
      proxFu.setDate(proxFu.getDate() + diasFu);

      if (msg.conversation_id) {
        await client.from('agent_conversations').update({
          proximo_followup: proxFu.toISOString(),
          tentativas: 1,
          mensagens_enviadas: 1,
        }).eq('id', msg.conversation_id);
      }

      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      const novas = tentativas + 1;
      const errMsg = (e as Error).message || 'unknown';
      if (novas >= maxT) {
        await client.from('agent_messages').update({
          status: 'falha_envio', tentativas_envio: novas,
          erro_mensagem: `Exception max: ${errMsg}`.substring(0, 500),
        }).eq('id', msg.id).catch(() => {});
      } else {
        const backoffMin = Math.pow(3, novas) * 5;
        const prox = new Date(Date.now() + backoffMin * 60_000);
        await client.from('agent_messages').update({
          tentativas_envio: novas,
          proximo_envio: prox.toISOString(),
          erro_mensagem: `Exception: ${errMsg}`.substring(0, 500),
        }).eq('id', msg.id).catch(() => {});
      }
      result.errors.push(`${msg.id}: exception ${errMsg}`);
    }
  }

  return result;
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const result = await dispatch();
    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({
      status: 'error', error: (e as Error).message,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
