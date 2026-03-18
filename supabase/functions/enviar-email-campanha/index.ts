import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validar JWT antes de prosseguir
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service role client para operações privilegiadas
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Rate limiting: máx 5 disparos de campanha por hora por usuário
    const { count: recentCount } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('action', 'email_campanha')
      .gte('created_at', new Date(Date.now() - 3600000).toISOString());
    if ((recentCount ?? 0) >= 5) {
      return new Response(JSON.stringify({ error: 'Rate limit excedido. Máximo 5 disparos por hora.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { campanha_id } = await req.json();
    if (!campanha_id) {
      return new Response(JSON.stringify({ error: 'campanha_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar campanha
    const { data: campanha, error: cErr } = await supabase
      .from('campanhas')
      .select('id, nome, assunto_email, corpo_email')
      .eq('id', campanha_id)
      .single();

    if (cErr || !campanha) {
      return new Response(JSON.stringify({ error: 'Campanha não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!campanha.assunto_email || !campanha.corpo_email) {
      return new Response(
        JSON.stringify({ error: 'Campanha sem assunto ou corpo de email configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar destinatários pendentes
    const { data: destinatarios, error: dErr } = await supabase
      .from('campanha_destinatarios')
      .select('id, nome, email')
      .eq('campanha_id', campanha_id)
      .eq('status', 'pendente')
      .limit(100); // processa em lotes de 100

    if (dErr) throw dErr;

    if (!destinatarios || destinatarios.length === 0) {
      return new Response(
        JSON.stringify({ enviados: 0, message: 'Nenhum destinatário pendente' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar nome da empresa emitente para o sender
    const { data: empresa } = await supabase
      .from('empresas')
      .select('razao_social, nome_fantasia')
      .eq('ativa', true)
      .order('created_at')
      .limit(1)
      .single();
    const nomeEmpresa = empresa?.nome_fantasia || empresa?.razao_social || 'Croma Print';
    const emailFrom = Deno.env.get('EMAIL_FROM') || `${nomeEmpresa} <noreply@cromaprint.com.br>`;

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      // Modo demo: marca como enviado sem chamar Resend
      await supabase
        .from('campanha_destinatarios')
        .update({ status: 'enviado', enviado_em: new Date().toISOString() })
        .eq('campanha_id', campanha_id)
        .eq('status', 'pendente');

      return new Response(
        JSON.stringify({ enviados: destinatarios.length, demo: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let enviados = 0;
    let erros = 0;

    for (const dest of destinatarios) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: emailFrom,
            to: [dest.email],
            subject: campanha.assunto_email,
            html: (campanha.corpo_email as string).replace(/\{\{nome\}\}/g, dest.nome),
          }),
        });

        if (res.ok) {
          await supabase
            .from('campanha_destinatarios')
            .update({ status: 'enviado', enviado_em: new Date().toISOString() })
            .eq('id', dest.id);
          enviados++;
        } else {
          const errText = await res.text();
          await supabase
            .from('campanha_destinatarios')
            .update({ status: 'erro', erro_mensagem: errText.substring(0, 500) })
            .eq('id', dest.id);
          erros++;
        }
      } catch (err) {
        await supabase
          .from('campanha_destinatarios')
          .update({ status: 'erro', erro_mensagem: (err as Error).message })
          .eq('id', dest.id);
        erros++;
      }
    }

    // Atualizar contador da campanha
    if (enviados > 0) {
      await supabase
        .from('campanhas')
        .update({ total_enviados: enviados })
        .eq('id', campanha_id);
    }

    return new Response(
      JSON.stringify({ enviados, erros }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
