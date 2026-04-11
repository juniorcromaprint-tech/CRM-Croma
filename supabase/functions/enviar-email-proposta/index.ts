// supabase/functions/enviar-email-proposta/index.ts
// Envia proposta por email via SMTP HostGator (cromaprint.com.br)
// Usa credenciais do vendedor logado (profiles.email_smtp_*) com fallback para admin_config

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9';

const ALLOWED_ORIGINS = [
  'https://crm-croma.vercel.app',
  'https://campo-croma.vercel.app',
  'http://localhost:5173',
  'http://localhost:8080',
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Content-Type, Authorization',
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validar autenticação JWT do usuário
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verificar token via Supabase Auth
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

    if (!proposta_id || !destinatario_email) {
      throw new Error('proposta_id e destinatario_email são obrigatórios');
    }

    // Cliente admin para leitura de dados
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Buscar dados da proposta
    const { data: proposta, error: propostaError } = await supabase
      .from('propostas')
      .select('numero, status, total, share_token, cliente:clientes(nome_fantasia, razao_social, contato_nome)')
      .eq('id', proposta_id)
      .single();

    if (propostaError || !proposta) throw new Error('Proposta não encontrada');

    // Ativar share_token para que o link do portal funcione
    const updateData: Record<string, unknown> = { share_token_active: true };
    // Se ainda esta em rascunho, marcar como enviada automaticamente
    if (proposta.status === 'rascunho') {
      updateData.status = 'enviada';
    }
    await supabase.from('propostas').update(updateData).eq('id', proposta_id);

    // Buscar SMTP do vendedor logado (do seu profile)
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email_smtp_user, email_smtp_password')
      .eq('id', user.id)
      .single();

    // Buscar config SMTP padrão do admin_config (fallback)
    const { data: smtpRows } = await supabase
      .from('admin_config')
      .select('chave, valor')
      .in('chave', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password']);

    const smtpMap: Record<string, string> = {};
    for (const row of smtpRows ?? []) {
      if (row.chave && row.valor) smtpMap[row.chave] = row.valor;
    }

    // Resolver credenciais SMTP: perfil do vendedor > admin_config > env vars
    const smtpHost = smtpMap['smtp_host'] || Deno.env.get('SMTP_HOST') || 'mail.cromaprint.com.br';
    const smtpPort = parseInt(smtpMap['smtp_port'] || Deno.env.get('SMTP_PORT') || '465');
    const smtpUser = profile?.email_smtp_user || smtpMap['smtp_user'] || Deno.env.get('SMTP_USER') || '';
    const smtpPassword = profile?.email_smtp_password || smtpMap['smtp_password'] || Deno.env.get('SMTP_PASSWORD') || '';

    if (!smtpUser || !smtpPassword) {
      throw new Error(
        'SMTP não configurado. Acesse Configurações > Usuários e preencha o email/senha SMTP do vendedor, ou configure em Admin > Configurações.'
      );
    }

    // Buscar nome da empresa emitente
    const { data: empresa } = await supabase
      .from('empresas')
      .select('razao_social, nome_fantasia')
      .eq('ativa', true)
      .order('created_at')
      .limit(1)
      .single();
    const nomeEmpresa = empresa?.nome_fantasia || empresa?.razao_social || 'Croma Print';

    const portalUrl = `${Deno.env.get('APP_URL') || 'https://crm-croma.vercel.app'}/p/${proposta.share_token}`;
    const cliente = proposta.cliente as { nome_fantasia?: string; razao_social?: string; contato_nome?: string } | null;
    const nomeCliente = destinatario_nome || cliente?.contato_nome || cliente?.nome_fantasia || cliente?.razao_social || 'Cliente';
    const nomeRemetente = profile?.full_name || smtpUser;

    // Montar email HTML
    const htmlBody = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b;">
        <h2 style="color:#1e40af;margin-bottom:4px;">${nomeEmpresa}</h2>
        <p style="color:#64748b;font-size:13px;margin-top:0;">Comunicação Visual Profissional</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />

        <p>Olá, <strong>${nomeCliente}</strong>!</p>
        <p>Preparamos a sua proposta comercial <strong>${proposta.numero}</strong> e ela já está disponível para visualização.</p>

        <p style="text-align:center;margin:32px 0;">
          <a href="${portalUrl}"
             style="background:#2563eb;color:white;padding:14px 36px;border-radius:8px;
                    text-decoration:none;font-weight:600;font-size:16px;display:inline-block;">
            Ver Proposta
          </a>
        </p>

        <p style="color:#64748b;font-size:13px;">
          Pelo portal você pode visualizar todos os detalhes, aprovar a proposta e tirar dúvidas diretamente.
        </p>
        <p style="color:#64748b;font-size:13px;">
          Qualquer dúvida, responda este email ou entre em contato conosco.
        </p>

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
        <p style="color:#94a3b8;font-size:12px;margin:0;">
          ${nomeRemetente} · ${nomeEmpresa}<br/>
          Este email foi enviado automaticamente pelo sistema CRM Croma Print.
        </p>
      </div>
    `;

    // Enviar via SMTP HostGator
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // SSL em 465, TLS em 587
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      tls: {
        rejectUnauthorized: false, // HostGator às vezes usa cert auto-assinado
      },
    });

    await transporter.sendMail({
      from: `${nomeRemetente} <${smtpUser}>`,
      to: destinatario_email,
      subject: `Proposta ${proposta.numero} — ${nomeEmpresa}`,
      html: htmlBody,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
