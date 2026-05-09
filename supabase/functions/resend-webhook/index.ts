// supabase/functions/resend-webhook/index.ts
//
// Recebe eventos do Resend (https://resend.com/docs/dashboard/webhooks/event-types)
// e persiste em public.email_events. O trigger trg_apply_email_event reflete
// automaticamente o estado em agent_messages.delivery_status.
//
// Eventos suportados:
//   email.sent              → Resend aceitou
//   email.delivered         → MX do destinatário aceitou
//   email.delivery_delayed  → tentando reentregar
//   email.bounced           → rejeitado definitivamente
//   email.complained        → marcou como spam
//   email.opened            → abriu o email
//   email.clicked           → clicou em link
//   email.failed            → falha definitiva
//
// Auth: assinatura svix (mesmo padrão usado pelo Resend).
//   Headers: svix-id, svix-timestamp, svix-signature
//   Secret:  RESEND_WEBHOOK_SECRET (formato whsec_<base64>)
//
// CRITICAL: config.toml desta função tem verify_jwt=false porque o Resend
// não envia JWT do Supabase. Auth é feita inteiramente por HMAC svix dentro
// da função.
//
// Implementação usa Web Crypto API nativa do Deno (sem imports externos).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET') ?? '';

const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Decodifica o secret do Resend (formato whsec_<base64-padded>) → bytes. */
function decodeSvixSecret(secret: string): Uint8Array {
  const cleaned = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const binStr = atob(cleaned);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
  return bytes;
}

/** Comparação tempo-constante para evitar timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Calcula HMAC-SHA256 e retorna como base64. */
async function hmacSha256Base64(keyBytes: Uint8Array, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  // ArrayBuffer → base64
  const bytes = new Uint8Array(sig);
  let binStr = '';
  for (let i = 0; i < bytes.length; i++) binStr += String.fromCharCode(bytes[i]);
  return btoa(binStr);
}

async function verifySvixSignature(
  rawBody: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string,
): Promise<boolean> {
  if (!secret) {
    console.warn('RESEND_WEBHOOK_SECRET não configurado — rejeitando webhook');
    return false;
  }

  // Janela de tolerância
  const ts = parseInt(svixTimestamp, 10);
  if (Number.isNaN(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SECONDS) {
    console.warn(`Timestamp fora da janela: now=${now} ts=${ts} delta=${Math.abs(now - ts)}s`);
    return false;
  }

  const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
  const keyBytes = decodeSvixSecret(secret);
  const expectedB64 = await hmacSha256Base64(keyBytes, toSign);

  // svix-signature pode ter múltiplas: "v1,abc v1,def" (rotação de keys)
  const sigs = svixSignature.split(' ').map((s) => s.trim());
  for (const sig of sigs) {
    const parts = sig.split(',');
    if (parts.length !== 2) continue;
    const [version, value] = parts;
    if (version === 'v1' && timingSafeEqual(value, expectedB64)) return true;
  }
  return false;
}

// ─── Handler ────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type, svix-id, svix-timestamp, svix-signature',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody = await req.text();

  const svixId        = req.headers.get('svix-id')        ?? '';
  const svixTimestamp = req.headers.get('svix-timestamp') ?? '';
  const svixSignature = req.headers.get('svix-signature') ?? '';

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response(
      JSON.stringify({ error: 'Missing svix headers' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const ok = await verifySvixSignature(
    rawBody, svixId, svixTimestamp, svixSignature, WEBHOOK_SECRET,
  );
  if (!ok) {
    return new Response(
      JSON.stringify({ error: 'Invalid signature' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Esquema do Resend:
  // {
  //   type: "email.delivered",
  //   created_at: "2026-05-08T13:01:00Z",
  //   data: { email_id, to, subject, from, ... }
  // }
  const eventType = (event as any)?.type;
  const data = (event as any)?.data ?? {};
  const resendId = data?.email_id;
  const occurredAt = (event as any)?.created_at ?? new Date().toISOString();
  const toEmail = Array.isArray(data?.to) ? data.to[0] : data?.to;
  const subject = data?.subject ?? null;

  if (!eventType || !resendId) {
    return new Response(
      JSON.stringify({ error: 'Missing type or data.email_id' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // INSERT — UNIQUE INDEX (resend_id, event_type, occurred_at) garante dedup
  const { error: insErr } = await supabase.from('email_events').insert({
    resend_id: resendId,
    event_type: eventType,
    occurred_at: occurredAt,
    to_email: toEmail,
    subject,
    payload: event,
  });

  // 23505 = unique_violation → evento duplicado, retorna 200 mesmo
  if (insErr && (insErr as any).code !== '23505') {
    console.error('email_events insert failed:', insErr.message);
    return new Response(
      JSON.stringify({ error: 'DB insert failed', detail: insErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // O trigger trg_apply_email_event já cuidou de atualizar agent_messages.delivery_status
  return new Response(
    JSON.stringify({
      ok: true,
      event_type: eventType,
      resend_id: resendId,
      duplicate: insErr?.code === '23505',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
