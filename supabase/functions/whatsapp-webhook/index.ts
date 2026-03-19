// supabase/functions/whatsapp-webhook/index.ts
// Receives incoming WhatsApp messages from Meta Cloud API webhook.
// GET  → webhook verification challenge
// POST → incoming message handler

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getServiceClient } from '../ai-shared/ai-helpers.ts';

// ─────────────────────────────────────────────────────────────
// Phone normalization
// Strip non-digits; prepend 55 (Brazil) if no country code.
// ─────────────────────────────────────────────────────────────
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 11 || digits.length === 10) return `55${digits}`;
  return digits;
}

/** Last 10 digits for ILIKE search (ignores country code variations) */
function last10(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-10);
}

// ─────────────────────────────────────────────────────────────
// HMAC SHA-256 signature validation (X-Hub-Signature-256)
// ─────────────────────────────────────────────────────────────
async function validateSignature(req: Request, rawBody: string): Promise<boolean> {
  const appSecret = Deno.env.get('WHATSAPP_APP_SECRET');
  if (!appSecret) {
    // If secret not configured, skip validation (dev mode)
    console.warn('whatsapp-webhook: WHATSAPP_APP_SECRET not set — skipping signature check');
    return true;
  }

  const signature = req.headers.get('x-hub-signature-256');
  if (!signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const sigHex = 'sha256=' + Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return sigHex === signature;
}

// ─────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  const url = new URL(req.url);

  // ── GET: webhook verification ───────────────────────────────
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === verifyToken && challenge) {
      console.log('whatsapp-webhook: verification OK');
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    console.warn('whatsapp-webhook: verification FAILED', { mode, token });
    return new Response('Forbidden', { status: 403 });
  }

  // ── POST: incoming message ──────────────────────────────────
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Read raw body once (needed for signature check + JSON parse)
  const rawBody = await req.text();

  // Validate HMAC signature
  const valid = await validateSignature(req, rawBody);
  if (!valid) {
    console.warn('whatsapp-webhook: invalid signature');
    return new Response('Forbidden', { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  try {
    // Navigate Meta payload structure
    const entry = (payload?.entry as unknown[])?.[0] as Record<string, unknown> | undefined;
    const change = (entry?.changes as unknown[])?.[0] as Record<string, unknown> | undefined;
    const value = change?.value as Record<string, unknown> | undefined;

    if (!value) {
      // Not a message event we care about
      return new Response('OK', { status: 200 });
    }

    const messages = value.messages as Record<string, unknown>[] | undefined;
    const contacts = value.contacts as Record<string, unknown>[] | undefined;

    // Only process type='messages' — skip statuses (delivery receipts)
    if (!messages || messages.length === 0) {
      return new Response('OK', { status: 200 });
    }

    const message = messages[0];
    const contact = contacts?.[0];

    // Only handle text messages for now
    if (message.type !== 'text') {
      console.log('whatsapp-webhook: ignoring non-text message type', message.type);
      return new Response('OK', { status: 200 });
    }

    const fromPhone = message.from as string;
    const messageId = message.id as string;
    const textBody = (message.text as Record<string, string>)?.body ?? '';
    const contactName = (contact?.profile as Record<string, string>)?.name ?? '';
    const normalizedPhone = normalizePhone(fromPhone);

    const supabase = getServiceClient();
    const now = new Date().toISOString();
    const phoneSearch = last10(normalizedPhone);

    // ── 1. Find lead by phone ─────────────────────────────────
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('id, empresa, contato_nome, contato_telefone, status')
      .ilike('contato_telefone', `%${phoneSearch}%`)
      .limit(1);

    let lead = existingLeads?.[0] ?? null;

    // ── 2. Create lead if not found ───────────────────────────
    if (!lead) {
      const { data: newLead, error: leadErr } = await supabase
        .from('leads')
        .insert({
          empresa: contactName || `WhatsApp ${normalizedPhone}`,
          contato_nome: contactName || null,
          contato_telefone: normalizedPhone,
          status: 'novo',
          temperatura: 'morno',
          segmento: null,
        })
        .select('id, empresa, contato_nome, contato_telefone, status')
        .single();

      if (leadErr || !newLead) {
        console.error('whatsapp-webhook: failed to create lead', leadErr);
        // Still return 200 — Meta must get 200 quickly
        return new Response('OK', { status: 200 });
      }

      lead = newLead;
      console.log('whatsapp-webhook: new lead created', lead.id);
    }

    // ── 3. Find or create active conversation ─────────────────
    const { data: convRows } = await supabase
      .from('agent_conversations')
      .select('id, mensagens_recebidas, score_engajamento')
      .eq('lead_id', lead.id)
      .eq('canal', 'whatsapp')
      .eq('status', 'ativa')
      .order('created_at', { ascending: false })
      .limit(1);

    let conversation = convRows?.[0] ?? null;

    if (!conversation) {
      const { data: newConv, error: convErr } = await supabase
        .from('agent_conversations')
        .insert({
          lead_id: lead.id,
          canal: 'whatsapp',
          status: 'ativa',
          etapa: 'abertura',
          mensagens_recebidas: 0,
          mensagens_enviadas: 0,
          score_engajamento: 0,
        })
        .select('id, mensagens_recebidas, score_engajamento')
        .single();

      if (convErr || !newConv) {
        console.error('whatsapp-webhook: failed to create conversation', convErr);
        return new Response('OK', { status: 200 });
      }

      conversation = newConv;
      console.log('whatsapp-webhook: new conversation created', conversation.id);
    }

    // ── 4. Save incoming message ──────────────────────────────
    const preview = textBody.substring(0, 80) + (textBody.length > 80 ? '…' : '');

    await supabase.from('agent_messages').insert({
      conversation_id: conversation.id,
      direcao: 'recebida',
      canal: 'whatsapp',
      conteudo: textBody,
      status: 'respondida',
      metadata: {
        whatsapp_message_id: messageId,
        from_phone: fromPhone,
        contact_name: contactName,
      },
    });

    // ── 5. Update conversation counters ───────────────────────
    await supabase
      .from('agent_conversations')
      .update({
        mensagens_recebidas: (conversation.mensagens_recebidas ?? 0) + 1,
        ultima_mensagem_em: now,
        score_engajamento: (conversation.score_engajamento ?? 0) + 15,
      })
      .eq('id', conversation.id);

    // ── 6. Log atividade comercial ────────────────────────────
    await supabase.from('atividades_comerciais').insert({
      entidade_tipo: 'lead',
      entidade_id: lead.id,
      tipo: 'whatsapp',
      descricao: `[WhatsApp] Mensagem recebida: ${preview}`,
      resultado: 'recebido',
      data_atividade: now,
    });

    console.log('whatsapp-webhook: message processed for lead', lead.id);

    // Meta requires a fast 200 response
    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('whatsapp-webhook error:', err);
    // Always return 200 to Meta — otherwise they retry endlessly
    return new Response('OK', { status: 200 });
  }
});
