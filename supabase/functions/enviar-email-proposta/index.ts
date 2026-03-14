// supabase/functions/enviar-email-proposta/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validar autenticação do usuário
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verificar token JWT via Supabase
  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Token inválido' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { proposta_id, destinatario_email, destinatario_nome } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch proposta data
    const { data: proposta, error } = await supabase
      .from('propostas')
      .select('numero, total, share_token, cliente:clientes(nome_fantasia, contato_nome)')
      .eq('id', proposta_id)
      .single();

    if (error || !proposta) throw new Error('Proposta não encontrada');

    const portalUrl = `${Deno.env.get('APP_URL') || 'https://crm-croma.vercel.app'}/p/${proposta.share_token}`;
    const clienteName = destinatario_nome || proposta.cliente?.contato_nome || proposta.cliente?.nome_fantasia || 'Cliente';

    // Send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      },
      body: JSON.stringify({
        from: Deno.env.get('EMAIL_FROM') || 'Croma Print <noreply@cromaprint.com.br>',
        to: destinatario_email,
        subject: `Proposta Comercial ${proposta.numero} — Croma Print`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#1e40af;">Croma Print</h2>
            <p>Olá, ${clienteName}!</p>
            <p>Segue sua proposta comercial <strong>${proposta.numero}</strong>.</p>
            <p style="text-align:center;margin:32px 0;">
              <a href="${portalUrl}" style="background:#2563eb;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
                Ver Proposta
              </a>
            </p>
            <p style="color:#64748b;font-size:14px;">Qualquer dúvida, entre em contato com seu vendedor.</p>
          </div>
        `,
      }),
    });

    if (!resendRes.ok) {
      const errData = await resendRes.json();
      throw new Error(errData.message || 'Resend API error');
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
