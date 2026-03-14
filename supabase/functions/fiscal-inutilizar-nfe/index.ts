import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { serie, numero_inicial, numero_final, justificativa } = await req.json();

    if (!justificativa || justificativa.length < 15) {
      return new Response(
        JSON.stringify({ sucesso: false, mensagem_erro: 'Justificativa mínima de 15 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!serie || !numero_inicial || !numero_final) {
      return new Response(
        JSON.stringify({ sucesso: false, mensagem_erro: 'serie, numero_inicial e numero_final são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nfeServiceUrl = Deno.env.get('NFE_SERVICE_URL');
    const nfeInternalSecret = Deno.env.get('NFE_INTERNAL_SECRET');

    let resultado: any;

    if (!nfeServiceUrl || !nfeInternalSecret) {
      // Modo demo
      console.log('[fiscal-inutilizar-nfe] MODO DEMO — NFE_SERVICE_URL não configurado');
      resultado = {
        sucesso: true,
        mensagem: `Inutilização simulada: série ${serie}, números ${numero_inicial}-${numero_final} (DEMO)`,
        retorno_raw: { status: 'DEMO' },
      };
    } else {
      const response = await fetch(`${nfeServiceUrl}/api/inutilizar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': nfeInternalSecret,
        },
        body: JSON.stringify({ serie, numero_inicial, numero_final, justificativa }),
      });

      resultado = await response.json();
    }

    // Registra inutilização no banco
    await supabaseAdmin.from('fiscal_eventos').insert({
      tipo_evento: 'inutilizacao',
      status: resultado.sucesso ? 'sucesso' : 'falha',
      mensagem: `Inutilização ${serie}/${numero_inicial}-${numero_final}: ${justificativa}`,
      payload_retorno: resultado.retorno ?? resultado.retorno_raw ?? resultado,
    });

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[fiscal-inutilizar-nfe]', err);
    return new Response(
      JSON.stringify({ sucesso: false, mensagem_erro: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
