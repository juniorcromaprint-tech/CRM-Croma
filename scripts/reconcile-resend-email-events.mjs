#!/usr/bin/env node
/**
 * scripts/reconcile-resend-email-events.mjs
 *
 * Reconciliação retroativa: para cada agent_messages.metadata.resend_id, consulta
 * GET https://api.resend.com/emails/{id} e injeta um evento equivalente em
 * public.email_events. O trigger trg_apply_email_event do banco se encarrega de
 * atualizar agent_messages.delivery_status na sequência de prioridade correta.
 *
 * USO:
 *   RESEND_API_KEY=re_xxx \
 *   SUPABASE_URL=https://djwjmfgplnqyffdcgdaw.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx \
 *   node scripts/reconcile-resend-email-events.mjs
 *
 * Filtros opcionais:
 *   --since=YYYY-MM-DD     Data ISO mínima de created_at (default: hoje)
 *   --until=YYYY-MM-DD     Data ISO máxima
 *   --campanha=<uuid>      Reconciliar só uma campanha
 *   --dry-run              Não grava nada, só mostra o que faria
 *   --limit=N              Limite de mensagens (default: 100)
 *
 * IMPORTANTE:
 *   - O endpoint GET /emails/{id} do Resend retorna o estado ATUAL do email,
 *     não o histórico. Ou seja: se o email foi delivered e depois opened, esta
 *     reconciliação só captura o último estado conhecido pelo Resend.
 *   - Para histórico completo, depende-se do webhook (eventos em tempo real).
 *   - Esta reconciliação garante: (a) snapshot retroativo dos 50 disparos de
 *     2026-05-08; (b) atualiza delivery_status para o estado mais recente.
 *
 * Idempotência:
 *   - UNIQUE INDEX (resend_id, event_type, occurred_at) em email_events evita
 *     duplicar evento. Re-rodar o script é seguro.
 */

import { createClient } from '@supabase/supabase-js';

// ─── Config ───────────────────────────────────────────────────────────────
const RESEND_API_KEY  = process.env.RESEND_API_KEY;
const SUPABASE_URL    = process.env.SUPABASE_URL;
const SERVICE_ROLE    = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!RESEND_API_KEY)  { console.error('RESEND_API_KEY ausente'); process.exit(1); }
if (!SUPABASE_URL)    { console.error('SUPABASE_URL ausente'); process.exit(1); }
if (!SERVICE_ROLE)    { console.error('SUPABASE_SERVICE_ROLE_KEY ausente'); process.exit(1); }

// ─── Args ─────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const SINCE     = args.since    ?? new Date().toISOString().slice(0, 10);
const UNTIL     = args.until    ?? null;
const CAMPANHA  = args.campanha ?? null;
const LIMIT     = parseInt(args.limit ?? '100', 10);
const DRY_RUN   = !!args['dry-run'];

console.log(`[reconcile] since=${SINCE} until=${UNTIL ?? '—'} campanha=${CAMPANHA ?? 'todas'} limit=${LIMIT} dry=${DRY_RUN}`);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

// ─── 1. Buscar mensagens com resend_id ────────────────────────────────────
let q = supabase
  .from('agent_messages')
  .select('id, status, delivery_status, created_at, conversation_id, metadata, campanha_id')
  .eq('canal', 'email')
  .not('metadata->>resend_id', 'is', null)
  .gte('created_at', `${SINCE}T00:00:00Z`)
  .order('created_at', { ascending: true })
  .limit(LIMIT);

if (UNTIL)    q = q.lte('created_at', `${UNTIL}T23:59:59Z`);
if (CAMPANHA) q = q.eq('campanha_id', CAMPANHA);

const { data: messages, error: qErr } = await q;
if (qErr) { console.error('Query error:', qErr); process.exit(1); }
if (!messages || messages.length === 0) {
  console.log('[reconcile] Nenhuma mensagem encontrada com resend_id no período.');
  process.exit(0);
}
console.log(`[reconcile] ${messages.length} mensagens com resend_id.`);

// ─── 2. Mapeamento status do Resend → event_type esperado pelo trigger ───
//
// Documentação Resend: status retornados pelo GET /emails/{id} podem ser:
//   sent, delivered, delivery_delayed, bounced, complained, opened, clicked, failed
// Mapear cada um para o event_type que o trigger entende.
function statusToEventType(status) {
  switch (status) {
    case 'sent':              return 'email.sent';
    case 'delivered':         return 'email.delivered';
    case 'delivery_delayed':  return 'email.delivery_delayed';
    case 'bounced':           return 'email.bounced';
    case 'complained':        return 'email.complained';
    case 'opened':            return 'email.opened';
    case 'clicked':           return 'email.clicked';
    case 'failed':            return 'email.failed';
    default:                  return null; // ignore unknown
  }
}

// ─── 3. Para cada mensagem, consultar Resend e inserir evento ────────────
let consultados = 0;
let inseridos   = 0;
let duplicados  = 0;
let errosResend = 0;
let semStatus   = 0;
const erros = [];

for (const msg of messages) {
  const resendId = msg.metadata?.resend_id;
  if (!resendId) continue;

  consultados++;
  let resp;
  try {
    resp = await fetch(`https://api.resend.com/emails/${resendId}`, {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    });
  } catch (err) {
    errosResend++;
    erros.push({ resend_id: resendId, error: err.message });
    continue;
  }

  if (!resp.ok) {
    errosResend++;
    const body = await resp.text();
    erros.push({ resend_id: resendId, status: resp.status, body: body.slice(0, 200) });
    // Pequena pausa em caso de rate limit
    if (resp.status === 429) await new Promise((r) => setTimeout(r, 1000));
    continue;
  }

  const data = await resp.json();
  // Resend retorna: { id, last_event, created_at, to, from, subject, ... }
  const status = data?.last_event ?? data?.status; // last_event é o campo novo
  const occurredAt = data?.last_event_at ?? data?.created_at ?? new Date().toISOString();

  const eventType = statusToEventType(status);
  if (!eventType) {
    semStatus++;
    erros.push({ resend_id: resendId, status_unknown: status, raw: data });
    continue;
  }

  if (DRY_RUN) {
    console.log(`[dry] ${resendId}: ${status} → ${eventType} @ ${occurredAt}`);
    continue;
  }

  const { error: insErr } = await supabase.from('email_events').insert({
    resend_id: resendId,
    event_type: eventType,
    occurred_at: occurredAt,
    to_email: Array.isArray(data?.to) ? data.to[0] : data?.to,
    subject: data?.subject ?? null,
    payload: { source: 'reconcile-script', resend_response: data },
  });

  if (insErr) {
    if (insErr.code === '23505') {
      duplicados++;
    } else {
      errosResend++;
      erros.push({ resend_id: resendId, db_error: insErr.message });
    }
  } else {
    inseridos++;
  }

  // Throttle: Resend permite ~10 req/s. Vamos manter folga.
  await new Promise((r) => setTimeout(r, 150));
}

// ─── 4. Resumo ───────────────────────────────────────────────────────────
console.log('\n=== RESUMO ===');
console.log(`Consultados no Resend: ${consultados}`);
console.log(`Eventos inseridos:     ${inseridos}`);
console.log(`Duplicados (já existia): ${duplicados}`);
console.log(`Status desconhecido:   ${semStatus}`);
console.log(`Erros Resend/DB:       ${errosResend}`);

if (erros.length > 0) {
  console.log('\n=== AMOSTRA DE ERROS (primeiros 5) ===');
  for (const e of erros.slice(0, 5)) console.log(JSON.stringify(e, null, 2));
}

// ─── 5. Mostra resultado consolidado ─────────────────────────────────────
const { data: summary } = await supabase
  .from('agent_messages')
  .select('delivery_status')
  .eq('canal', 'email')
  .gte('created_at', `${SINCE}T00:00:00Z`);

const counts = {};
for (const r of summary ?? []) {
  const s = r.delivery_status ?? '(null)';
  counts[s] = (counts[s] ?? 0) + 1;
}
console.log('\n=== DELIVERY STATUS APÓS RECONCILIAÇÃO ===');
console.table(counts);

process.exit(0);
