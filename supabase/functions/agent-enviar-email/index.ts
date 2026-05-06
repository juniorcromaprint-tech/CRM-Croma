// supabase/functions/agent-enviar-email/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  handleCorsOptions,
  getCorsHeaders,
  jsonResponse,
  getServiceClient,
} from '../ai-shared/ai-helpers.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DEFAULT_EMAIL_FROM = 'Croma Print <junior@cromaprint.com.br>';
const DEFAULT_EMAIL_REPLY_TO = 'junior@cromaprint.com.br';

/** Convert plain text to basic HTML: split on blank lines → <p> tags.
 *  If hasInlineImage is true, renders a CID-referenced image AFTER the text body. */
function textToHtml(text: string, hasInlineImage: boolean): string {
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.replace(/\n/g, '<br>'))
    .map(
      (p) =>
        `<p style="margin: 0 0 16px 0; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #333;">${p}</p>`
    )
    .join('\n');

  // Use CID reference so image displays inline without "allow remote images"
  const imageHtml = hasInlineImage
    ? `<img src="cid:portfolio_croma" alt="Croma Print - Portfolio" style="width:100%;max-width:600px;height:auto;display:block;border-radius:0 0 8px 8px;margin-top:8px;" />`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 24px;background:#f5f5f5;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
    <div style="padding:32px;">
      ${paragraphs}
    </div>
    ${imageHtml}
    <div style="padding:0 32px 24px 32px;">
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0 16px 0;">
      <p style="font-family:Arial,sans-serif;font-size:12px;color:#999;margin:0;">
        Croma Print Comunicação Visual — comunicação@cromaprint.com.br
      </p>
    </div>
  </div>
</body>
</html>`;
}

/** Fetch image from URL and return base64-encoded content + content type */
async function fetchImageAsBase64(url: string): Promise<{ base64: string; contentType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // Convert to base64
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    const contentType = res.headers.get('content-type') || 'image/png';
    return { base64, contentType };
  } catch (err) {
    console.error('Failed to fetch image:', err);
    return null;
  }
}

serve(async (req: Request) => {
  const corsResponse = handleCorsOptions(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // Auth v2 (2026-05-06): aceita 3 formatos.
    //  1. Token == env SUPABASE_SERVICE_ROLE_KEY (sb_secret novo formato) -> service_role
    //  2. Token e JWT legacy com role=service_role no payload -> service_role
    //     (gateway ja validou a assinatura quando verify_jwt=true)
    //  3. Token e JWT de user valido com role allowed -> user
    const authHeader = req.headers.get('Authorization');
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    let isAuthorized = false;

    // Decodifica payload de JWT (sem validar assinatura - gateway ja validou)
    const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
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
    };

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');

      // Caso 1: token e o env (sb_secret novo formato)
      if (token === SERVICE_ROLE_KEY) {
        isAuthorized = true;
      } else {
        // Tenta decodificar como JWT
        const payload = decodeJwtPayload(token);

        // Caso 2: JWT legacy com role=service_role (gateway ja validou assinatura)
        if (payload && payload.role === 'service_role' && payload.iss === 'supabase') {
          isAuthorized = true;
        }
        // Caso 3: JWT de user valido com role allowed
        else if (payload && typeof payload.sub === 'string' && payload.aud === 'authenticated') {
          const supabaseAuth = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!
          );
          const { data: { user } } = await supabaseAuth.auth.getUser(token);
          if (user) {
            const supabaseService = getServiceClient();
            const { data: profile } = await supabaseService.from('profiles').select('role').eq('id', user.id).single();
            const allowedRoles = ['comercial', 'gerente', 'admin'];
            if (profile && allowedRoles.includes(profile.role)) {
              isAuthorized = true;
            }
          }
        }
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { message_id } = body;

    if (!message_id) {
      return jsonResponse({ error: 'message_id obrigatorio' }, 400, corsHeaders);
    }

    const supabase = getServiceClient();

    // 1. Fetch the agent message (must be status='aprovada')
    const { data: msg, error: msgErr } = await supabase
      .from('agent_messages')
      .select(`
        id, assunto, conteudo, status, metadata,
        conversation_id,
        agent_conversations (
          id, lead_id, mensagens_enviadas,
          leads (
            id, empresa, contato_nome, contato_email, status
          )
        )
      `)
      .eq('id', message_id)
      .eq('status', 'aprovada')
      .single();

    if (msgErr || !msg) {
      return jsonResponse({ error: 'Mensagem nao encontrada ou nao aprovada' }, 404, corsHeaders);
    }

    const conversa = (msg.agent_conversations as any);
    const lead = conversa?.leads as any;

    if (!lead) {
      return jsonResponse({ error: 'Lead nao encontrado para esta conversa' }, 404, corsHeaders);
    }

    // 2. Check if lead has email
    if (!lead.contato_email) {
      await supabase
        .from('agent_messages')
        .update({ status: 'erro', erro_mensagem: 'Lead sem email' })
        .eq('id', message_id);

      return jsonResponse({ error: 'Lead sem email cadastrado' }, 400, corsHeaders);
    }

    // 3. Fetch agent_config from admin_config table
    const { data: configRow } = await supabase
      .from('admin_config')
      .select('valor')
      .eq('chave', 'agent_config')
      .single();

    const agentConfig = (configRow?.valor && typeof configRow.valor === 'object'
      ? configRow.valor
      : typeof configRow?.valor === 'string'
        ? JSON.parse(configRow.valor)
        : {}) as Record<string, string>;

    const emailRemetente = agentConfig?.email_remetente || DEFAULT_EMAIL_REPLY_TO;
    const nomeRemetente = agentConfig?.nome_remetente || 'Croma Print';
    const fromAddress = `${nomeRemetente} <${emailRemetente}>`;

    // 4. Build HTML body + fetch image for inline CID attachment
    const imagemUrl = (msg.metadata as any)?.imagem_url || '';
    let imageAttachment: { base64: string; contentType: string } | null = null;
    if (imagemUrl) {
      imageAttachment = await fetchImageAsBase64(imagemUrl);
    }
    const htmlBody = textToHtml(msg.conteudo || '', !!imageAttachment);

    // 5. Build email subject
    const subject =
      msg.assunto ||
      `Comunicação visual profissional — ${lead.empresa || lead.contato_nome || 'sua empresa'}`;

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const now = new Date().toISOString();

    // 6. Demo mode if no RESEND_API_KEY
    if (!RESEND_API_KEY) {
      await supabase
        .from('agent_messages')
        .update({
          status: 'enviada',
          enviado_em: now,
          metadata: { ...(msg.metadata || {}), demo: true },
        })
        .eq('id', message_id);

      // Update conversation ultima_mensagem_em
      await supabase
        .from('agent_conversations')
        .update({ ultima_mensagem_em: now })
        .eq('id', msg.conversation_id);

      // Insert atividade comercial
      await supabase.from('atividades_comerciais').insert({
        entidade_tipo: 'lead',
        entidade_id: lead.id,
        tipo: 'email',
        descricao: `[Agente] Email enviado: ${subject}`,
        resultado: 'enviado',
        data_atividade: now,
      });

      // Update lead status novo → contatado
      if (lead.status === 'novo') {
        await supabase
          .from('leads')
          .update({ status: 'contatado' })
          .eq('id', lead.id)
          .eq('status', 'novo');
      }

      return jsonResponse(
        { success: true, demo: true, message_id, to: lead.contato_email },
        200,
        corsHeaders
      );
    }

    // 7. Send via Resend (with inline CID image if available)
    const emailPayload: Record<string, unknown> = {
      from: fromAddress,
      to: [lead.contato_email],
      subject,
      html: htmlBody,
      reply_to: emailRemetente,
    };

    // Attach image as inline CID so it displays without "allow remote images"
    if (imageAttachment) {
      const ext = imageAttachment.contentType.includes('jpeg') ? 'jpg' : 'png';
      emailPayload.attachments = [
        {
          filename: `portfolio.${ext}`,
          content: imageAttachment.base64,
          content_type: imageAttachment.contentType,
        },
      ];
      // Resend uses 'headers' per attachment for Content-ID (CID inline)
      // Alternative: some Resend versions support content_id field directly
      (emailPayload.attachments as any[])[0].content_id = 'portfolio_croma';
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      const errMsg = errText.substring(0, 500);

      await supabase
        .from('agent_messages')
        .update({ status: 'erro', erro_mensagem: errMsg })
        .eq('id', message_id);

      return jsonResponse(
        { error: 'Falha ao enviar email via Resend', detail: errMsg },
        502,
        corsHeaders
      );
    }

    const resendData = await resendRes.json();
    const resendId = resendData?.id;

    // 8. Mark message as sent
    await supabase
      .from('agent_messages')
      .update({
        status: 'enviada',
        enviado_em: now,
        metadata: { ...(msg.metadata || {}), resend_id: resendId },
      })
      .eq('id', message_id);

    // 9. Update conversation ultima_mensagem_em
    await supabase
      .from('agent_conversations')
      .update({ ultima_mensagem_em: now })
      .eq('id', msg.conversation_id);

    // 10. Insert atividade comercial
    await supabase.from('atividades_comerciais').insert({
      entidade_tipo: 'lead',
      entidade_id: lead.id,
      tipo: 'email',
      descricao: `[Agente] Email enviado: ${subject}`,
      resultado: 'enviado',
      data_atividade: now,
    });

    // 11. Update lead status novo → contatado
    if (lead.status === 'novo') {
      await supabase
        .from('leads')
        .update({ status: 'contatado' })
        .eq('id', lead.id)
        .eq('status', 'novo');
    }

    return jsonResponse(
      { success: true, message_id, resend_id: resendId, to: lead.contato_email },
      200,
      corsHeaders
    );
  } catch (err) {
    console.error('agent-enviar-email error:', err);
    return jsonResponse(
      { error: 'Erro interno ao enviar email', detail: (err as Error).message },
      500,
      corsHeaders
    );
  }
});
