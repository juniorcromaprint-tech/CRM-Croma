// supabase/functions/whatsapp-enviar/index.ts
// Sends a WhatsApp message via Meta Cloud API for an approved agent_message.
// POST { message_id } → sends the message and updates DB

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  handleCorsOptions,
  getCorsHeaders,
  jsonResponse,
  getServiceClient,
} from '../ai-shared/ai-helpers.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const META_API_VERSION = 'v19.0';

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
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );
    const { data: { user }, error: userAuthError } = await supabaseAuth.auth.getUser(token);
    if (userAuthError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const supabaseService = getServiceClient();
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

    // ── 3. Env vars ───────────────────────────────────────────
    const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    const ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const now = new Date().toISOString();

    // ── 4. Demo mode if ACCESS_TOKEN not set ──────────────────
    if (!ACCESS_TOKEN) {
      await supabase
        .from('agent_messages')
        .update({
          status: 'enviada',
          enviado_em: now,
          metadata: { ...(msg.metadata || {}), demo: true },
        })
        .eq('id', message_id);

      await supabase
        .from('agent_conversations')
        .update({
          mensagens_enviadas: (conversa.mensagens_enviadas ?? 0) + 1,
          ultima_mensagem_em: now,
        })
        .eq('id', msg.conversation_id);

      await supabase.from('atividades_comerciais').insert({
        entidade_tipo: 'lead',
        entidade_id: lead.id,
        tipo: 'whatsapp',
        descricao: `[Agente] WhatsApp enviado (demo): ${(msg.conteudo ?? '').substring(0, 80)}`,
        resultado: 'enviado',
        data_atividade: now,
      });

      if (lead.status === 'novo') {
        await supabase
          .from('leads')
          .update({ status: 'contatado' })
          .eq('id', lead.id)
          .eq('status', 'novo');
      }

      return jsonResponse(
        { success: true, demo: true, message_id, to: toPhone },
        200,
        corsHeaders
      );
    }

    if (!PHONE_NUMBER_ID) {
      return jsonResponse(
        { error: 'WHATSAPP_PHONE_NUMBER_ID nao configurado' },
        500,
        corsHeaders
      );
    }

    // ── 5. Decide payload: template vs free-form text ─────────
    // First message (mensagens_enviadas === 0) → must use approved template
    // Subsequent messages (lead replied = mensagens_recebidas > 0) → free-form text
    const isFirstMessage = (conversa.mensagens_enviadas ?? 0) === 0;
    const hasReceivedReply = (conversa.mensagens_recebidas ?? 0) > 0;

    let waPayload: Record<string, unknown>;

    if (isFirstMessage && !hasReceivedReply) {
      // Initiating conversation: use template
      waPayload = buildTemplatePayload(toPhone, lead.contato_nome ?? lead.empresa ?? '');
    } else {
      // Inside 24h window: free-form text
      waPayload = buildTextPayload(toPhone, msg.conteudo ?? '');
    }

    // ── 6. Call Meta Cloud API ────────────────────────────────
    const apiUrl = `https://graph.facebook.com/${META_API_VERSION}/${PHONE_NUMBER_ID}/messages`;

    const metaRes = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(waPayload),
    });

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      const errMsg = errText.substring(0, 500);

      await supabase
        .from('agent_messages')
        .update({ status: 'erro', erro_mensagem: errMsg })
        .eq('id', message_id);

      return jsonResponse(
        { error: 'Falha ao enviar via Meta Cloud API', detail: errMsg },
        502,
        corsHeaders
      );
    }

    const metaData = await metaRes.json();
    const waMessageId = metaData?.messages?.[0]?.id as string | undefined;

    // ── 7. Mark message as sent ───────────────────────────────
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

    // ── 8. Update conversation ────────────────────────────────
    await supabase
      .from('agent_conversations')
      .update({
        mensagens_enviadas: (conversa.mensagens_enviadas ?? 0) + 1,
        ultima_mensagem_em: now,
      })
      .eq('id', msg.conversation_id);

    // ── 9. Log atividade comercial ────────────────────────────
    await supabase.from('atividades_comerciais').insert({
      entidade_tipo: 'lead',
      entidade_id: lead.id,
      tipo: 'whatsapp',
      descricao: `[Agente] WhatsApp enviado: ${(msg.conteudo ?? '').substring(0, 80)}`,
      resultado: 'enviado',
      data_atividade: now,
    });

    // ── 10. Update lead status novo → contatado ───────────────
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
