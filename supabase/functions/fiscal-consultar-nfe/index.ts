import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Validar autenticação do usuário
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ sucesso: false, mensagem: 'Não autorizado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseAuthCheck = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authError } = await supabaseAuthCheck.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ sucesso: false, mensagem: 'Token inválido' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { chave_acesso, ambiente, documento_id } = await req.json();

    let chave = chave_acesso;
    let docId = documento_id;

    // Se passou documento_id, busca a chave
    if (!chave && docId) {
      const { data: doc } = await supabaseAdmin
        .from('fiscal_documentos')
        .select('chave_acesso, fiscal_ambientes(tipo)')
        .eq('id', docId)
        .single();
      chave = doc?.chave_acesso;
    }

    if (!chave) {
      return new Response(
        JSON.stringify({ sucesso: false, mensagem: 'chave_acesso ou documento_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nfeServiceUrl = Deno.env.get('NFE_SERVICE_URL');
    const nfeInternalSecret = Deno.env.get('NFE_INTERNAL_SECRET');

    let resultado: any;

    if (!nfeServiceUrl || !nfeInternalSecret) {
      // Modo demo — nfe-service não configurado
      resultado = {
        sucesso: true,
        status: 'autorizado',
        chave_acesso: chave,
        protocolo: `1${Date.now()}`,
        data_autorizacao: new Date().toISOString(),
        mensagem: 'NF-e autorizada (DEMO)',
        retorno_raw: { status: 'DEMO', chave },
      };
    } else {
      const response = await fetch(`${nfeServiceUrl}/api/consultar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': nfeInternalSecret,
        },
        body: JSON.stringify({ chave_acesso: chave }),
      });
      const retorno = await response.json();

      if (retorno.sucesso) {
        const r = retorno.retorno;
        const cStat = r?.protNFe?.infProt?.cStat ?? r?.cStat;
        resultado = {
          sucesso: cStat === '100',
          status: cStat === '100' ? 'autorizado' : cStat === '110' ? 'denegado' : 'desconhecido',
          chave_acesso: r?.protNFe?.infProt?.chNFe ?? chave,
          protocolo: r?.protNFe?.infProt?.nProt,
          data_autorizacao: r?.protNFe?.infProt?.dhRecbto,
          mensagem: r?.protNFe?.infProt?.xMotivo ?? retorno.mensagem_erro,
          retorno_raw: retorno.retorno,
        };
      } else {
        resultado = {
          sucesso: false,
          status: 'erro',
          chave_acesso: chave,
          mensagem: retorno.mensagem_erro,
          retorno_raw: retorno,
        };
      }
    }

    // Registra evento de consulta
    if (docId) {
      await supabaseAdmin.from('fiscal_eventos').insert({
        fiscal_documento_id: docId,
        tipo_evento: 'consulta',
        status: resultado.sucesso ? 'sucesso' : 'falha',
        mensagem: resultado.mensagem,
        payload_retorno: resultado.retorno_raw,
      });
    }

    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[fiscal-consultar-nfe]', err);
    return new Response(
      JSON.stringify({ sucesso: false, mensagem: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
