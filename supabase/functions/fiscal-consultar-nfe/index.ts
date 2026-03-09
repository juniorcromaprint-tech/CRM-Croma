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

    const nfeToken = Deno.env.get('NFE_PROVIDER_TOKEN');
    const nfeBaseUrl = Deno.env.get('NFE_PROVIDER_URL') ?? 'https://homologacao.focusnfe.com.br';
    const tipoAmbiente = ambiente ?? 'homologacao';

    let resultado: any;

    if (!nfeToken || nfeToken === 'DEMO_MODE') {
      // Modo demo
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
      const response = await fetch(
        `${nfeBaseUrl}/v2/nfe/${chave}?completo=1`,
        {
          headers: { 'Authorization': `Token token=${nfeToken}` },
        }
      );
      const retorno = await response.json();

      resultado = {
        sucesso: response.ok,
        status: retorno.status ?? 'desconhecido',
        chave_acesso: retorno.chave_nfe ?? chave,
        protocolo: retorno.protocolo_autorizacao,
        data_autorizacao: retorno.data_hora_autorizacao,
        mensagem: retorno.mensagem ?? retorno.status_sefaz,
        retorno_raw: retorno,
      };
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
