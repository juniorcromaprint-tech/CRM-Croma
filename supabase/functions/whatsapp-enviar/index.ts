// supabase/functions/whatsapp-enviar/index.ts
// Sends a WhatsApp message via Meta Cloud API for an approved agent_message.
// POST { message_id } → sends the message and updates DB
//
// CREDENTIALS POLICY (2026-05-04 hardening):
// All Edge Functions that talk to Meta Graph API now load credentials
// EXCLUSIVELY from `admin_config` via getWhatsAppCredentials(). Reading
// Deno.env.get('WHATSAPP_*') is forbidden — env vars can drift from the
// canonical DB values and silently send to a stale test phone, producing
// "(#131030) Recipient phone number not in allowed list" errors even
// though the WABA is fully verified and in production.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  handleCorsOptions,
  getCorsHeaders,
  jsonResponse,
  getServiceClient,
} from '../ai-shared/ai-helpers.ts';
import {
  getWhatsAppCredentials,
  postToMetaCloud,
} from '../ai-shared/whatsapp-credentials.ts';

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

// ─────────────────────────────────────────────────────────────
// Build Meta Cloud API payload
// ─────────────────────────────────────────────────────────────
function buildTemplatePayload(to: string, contatoNome: string): Record<string, unknown> {
  return {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: 'croma_abertura',
      language: { code: 'pt_BR' },
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: contatoNome || 'Cliente' }],
        },
      ],
    },
  };
}

function buildTextPayload(to: string, body: string): Record<string, unknown> {
  return {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body },
  };
}

// ─────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  const corsResponse = handleCorsOptions(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // Auth: validate JWT and check role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Token não fornecido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const token = authHeader.replace('Bearer ', '');
    // Use service client to validate user token (anon client can fail with certain JWT configs)
    const supabaseService = getServiceClient();
    const { data: { user }, error: userAuthError } = await supabaseService.auth.getUser(token);
    if (userAuthError || !user) {
      console.error('whatsapp-enviar: auth failed', userAuthError?.message);
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const { data: profile } = await supabaseService.from('profiles').select('role').eq('id', user.id).single();
    const allowedRoles = ['comercial', 'gerente', 'admin'];
    if (!profile || !allowedRoles.includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Sem permissão' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { message_id } = body as { message_id: string };

    if (!message_id) {
      return jsonResponse({ error: 'message_id obrigatorio' }, 400, corsHeaders);
    }

    const supabase = getServiceClient();

    // ── 0. Check daily send limit & business hours ──────────────
    // Skip business hours check for manual messages (human operator)
    {
      // Pre-fetch message metadata to check if manual
      const { data: preCheck } = await supabase
        .from('agent_messages')
        .select('metadata')
        .eq('id', message_id)
        .single();

      const isManual = preCheck?.metadata?.manual === true;

      const { data: configRow } = await supabase
        .from('admin_config')
        .select('valor')
        .eq('chave', 'agent_config')
        .single();

      let maxPerDay = 50;
      let horarioInicio = '08:00';
      let horarioFim = '18:00';
      if (configRow?.valor) {
        try {
          const cfg = JSON.parse(configRow.valor);
          maxPerDay = cfg.max_contatos_dia ?? 50;
          horarioInicio = cfg.horario_inicio ?? '08:00';
          horarioFim = cfg.horario_fim ?? '18:00';
        } catch { /* use default */ }
      }

      // Check business hours (Brazil timezone UTC-3) — skip for manual messages
      if (!isManual) {
        const nowBR = new Date(Date.now() - 3 * 60 * 60 * 1000);
        const hhmm = `${String(nowBR.getUTCHours()).padStart(2, '0')}:${String(nowBR.getUTCMinutes()).padStart(2, '0')}`;
        if (hhmm < horarioInicio || hhmm >= horarioFim) {
          return jsonResponse(
            { error: `Fora do horário de envio (${horarioInicio}–${horarioFim})` },
            429,
            corsHeaders
          );
        }
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('agent_messages')
        .select('id', { count: 'exact', head: true })
        .eq('canal', 'whatsapp')
        .eq('status', 'enviada')
        .gte('enviado_em', todayStart.toISOString());

      if ((count ?? 0) >= maxPerDay) {
        return jsonResponse(
          { error: `Limite diário de ${maxPerDay} mensagens atingido` },
          429,
          corsHeaders
        );
      }
    }

    // ── 1. Fetch agent_message (must be aprovada + whatsapp) ──
    const { data: msg, error: msgErr } = await supabase
      .from('agent_messages')
      .select(`
        id, conteudo, status, metadata, canal,
        conversation_id,
        agent_conversations (
          id, lead_id, mensagens_enviadas, mensagens_recebidas, ultima_mensagem_em,
          leads (
            id, empresa, contato_nome, contato_telefone, status
          )
        )
      `)
      .eq('id', message_id)
      .eq('status', 'aprovada')
      .eq('canal', 'whatsapp')
      .single();

    if (msgErr || !msg) {
      return jsonResponse({ error: 'Mensagem nao encontrada ou nao aprovada' }, 404, corsHeaders);
    }

    const conversa = msg.agent_conversations as any;
    const lead = conversa?.leads as any;

    if (!lead) {
      return jsonResponse({ error: 'Lead nao encontrado para esta conversa' }, 404, corsHeaders);
    }

    // ── 2. Validate phone ─────────────────────────────────────
    if (!lead.contato_telefone) {
      await supabase
        .from('agent_messages')
        .update({ status: 'erro', erro_mensagem: 'Lead sem telefone' })
        .eq('id', message_id);

      return jsonResponse({ error: 'Lead sem telefone cadastrado' }, 400, corsHeaders);
    }

    const toPhone = normalizePhone(lead.contato_telefone);
    const now = new Date().toISOString();

    // ── 3. Load canonical credentials from admin_config ───────
    // Single source of truth — NEVER read Deno.env for WHATSAPP_*.
    const credsResult = await getWhatsAppCredentials(supabase);

    if (!credsResult.ok) {
      // Production must always have credentials. If they are missing,
      // this is an operational failure — surface it clearly instead of
      // silently dropping the message into a "demo" mode.
      console.error('whatsapp-enviar: credenciais ausentes:', credsResult.message);
      await supabase
        .from('agent_messages')
        .update({ status: 'erro', erro_mensagem: credsResult.message })
        .eq('id', message_id);

      return jsonResponse(
        { error: credsResult.message, missing: credsResult.missing },
        500,
        corsHeaders
      );
    }

    const creds = credsResult;

    // ── 4. Decide payload: template vs free-form text ─────────
    // First message (mensagens_enviadas === 0) AND lead never replied → must use approved template
    // Subsequent messages OR lead has replied (24h window open) → free-form text
    const isFirstMessage = (conversa.mensagens_enviadas ?? 0) === 0;
    const hasReceivedReply = (conversa.mensagens_recebidas ?? 0) > 0;

    let waPayload: Record<string, unknown>;

    if (isFirstMessage && !hasReceivedReply) {
      waPayload = buildTemplatePayload(toPhone, lead.contato_nome ?? lead.empresa ?? '');
    } else {
      waPayload = buildTextPayload(toPhone, msg.conteudo ?? '');
    }

    // ── 5. Call Meta Cloud API via shared helper ──────────────
    const metaResult = await postToMetaCloud(creds, waPayload);

    if (!metaResult.ok) {
      console.error(
        `whatsapp-enviar: Meta API falhou (${metaResult.status}) para ${toPhone}:`,
        metaResult.body,
      );
      await supabase
        .from('agent_messages')
        .update({ status: 'erro', erro_mensagem: metaResult.body })
        .eq('id', message_id);

      return jsonResponse(
        { error: 'Falha ao enviar via Meta Cloud API', status: metaResult.status, detail: metaResult.body },
        502,
        corsHeaders
      );
    }

    const waMessageId = (metaResult.metaData as any)?.messages?.[0]?.id as string | undefined;

    // ── 6. Mark message as sent ───────────────────────────────
    await supabase
      .from('agent_messages')
      .update({
        status: 'enviada',
        enviado_em: now,
        metadata: {
          ...(msg.metadata || {}),
          whatsapp_message_id: waMessageId,
          sent_as: isFirstMessage && !hasReceivedReply ? 'template' : 'text',
        },
      })
      .eq('id', message_id);

    // ── 7. Update conversation ────────────────────────────────
    await supabase
      .from('agent_conversations')
      .update({
        mensagens_enviadas: (conversa.mensagens_enviadas ?? 0) + 1,
        ultima_mensagem_em: now,
      })
      .eq('id', msg.conversation_id);

    // ── 8. Log atividade comercial ────────────────────────────
    await supabase.from('atividades_comerciais').insert({
      entidade_tipo: 'lead',
      entidade_id: lead.id,
      tipo: 'whatsapp',
      descricao: `[Agente] WhatsApp enviado: ${(msg.conteudo ?? '').substring(0, 80)}`,
      resultado: 'enviado',
      data_atividade: now,
    });

    // ── 9. Update lead status novo → contatado ────────────────
    if (lead.status === 'novo') {
      await supabase
        .from('leads')
        .update({ status: 'contatado' })
        .eq('id', lead.id)
        .eq('status', 'novo');
    }

    return jsonResponse(
      {
        success: true,
        message_id,
        whatsapp_message_id: waMessageId,
        to: toPhone,
        sent_as: isFirstMessage && !hasReceivedReply ? 'template' : 'text',
      },
      200,
      corsHeaders
    );
  } catch (err) {
    console.error('whatsapp-enviar error:', err);
    return jsonResponse(
      { error: 'Erro interno ao enviar WhatsApp', detail: (err as Error).message },
      500,
      corsHeaders
    );
  }
});
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 