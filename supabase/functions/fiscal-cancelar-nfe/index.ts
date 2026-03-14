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

    const { documento_id, justificativa } = await req.json();

    if (!documento_id || !justificativa) {
      return new Response(
        JSON.stringify({ sucesso: false, mensagem: 'documento_id e justificativa são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (justificativa.length < 15) {
      return new Response(
        JSON.stringify({ sucesso: false, mensagem: 'Justificativa deve ter no mínimo 15 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: doc, error: docError } = await supabaseAdmin
      .from('fiscal_documentos')
      .select('*, fiscal_ambientes(tipo), fiscal_certificados(cnpj_titular), clientes(razao_social), pedidos(numero)')
      .eq('id', documento_id)
      .single();

    if (docError || !doc) {
      return new Response(
        JSON.stringify({ sucesso: false, mensagem: 'Documento não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (doc.status !== 'autorizado') {
      return new Response(
        JSON.stringify({ sucesso: false, mensagem: `Documento com status '${doc.status}' não pode ser cancelado. Apenas documentos autorizados podem ser cancelados.` }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nfeServiceUrl = Deno.env.get('NFE_SERVICE_URL');
    const nfeInternalSecret = Deno.env.get('NFE_INTERNAL_SECRET');

    let resultado: Record<string, unknown>;

    if (!nfeServiceUrl || !nfeInternalSecret) {
      // Modo demo: simula cancelamento autorizado
      console.log('[fiscal-cancelar-nfe] MODO DEMO — NFE_SERVICE_URL não configurado');
      resultado = {
        sucesso: true,
        protocolo: `CAN${Date.now()}`,
        data_cancelamento: new Date().toISOString(),
        mensagem: 'Cancelamento autorizado (DEMO)',
        retorno_raw: { status: 'DEMO_CANCELADO', chave: doc.chave_acesso },
      };
    } else {
      try {
        const response = await fetch(`${nfeServiceUrl}/api/cancelar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': nfeInternalSecret,
          },
          body: JSON.stringify({
            chave_acesso: doc.chave_acesso,
            protocolo: doc.protocolo,
            justificativa,
          }),
        });
        const retorno = await response.json();

        if (retorno.sucesso) {
          const r = retorno.retorno;
          resultado = {
            sucesso: true,
            protocolo: r?.retEvento?.infEvento?.nProt ?? `CAN${Date.now()}`,
            data_cancelamento: r?.retEvento?.infEvento?.dhRegEvento ?? new Date().toISOString(),
            mensagem: r?.retEvento?.infEvento?.xMotivo ?? 'Cancelamento autorizado',
            retorno_raw: retorno.retorno,
          };
        } else {
          resultado = {
            sucesso: false,
            mensagem: retorno.mensagem_erro ?? 'Erro no cancelamento',
            retorno_raw: retorno,
          };
        }
      } catch (fetchErr) {
        resultado = {
          sucesso: false,
          mensagem: `Falha ao contactar serviço NF-e: ${String(fetchErr)}`,
          retorno_raw: { error: String(fetchErr) },
        };
      }
    }

    if (resultado.sucesso) {
      // Atualiza status do documento
      await supabaseAdmin
        .from('fiscal_documentos')
        .update({
          status: 'cancelado',
          data_cancelamento: resultado.data_cancelamento as string,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documento_id);

      // Registra evento de cancelamento
      await supabaseAdmin.from('fiscal_eventos').insert({
        fiscal_documento_id: documento_id,
        tipo_evento: 'cancelamento',
        status: 'sucesso',
        protocolo: resultado.protocolo as string,
        justificativa,
        mensagem: resultado.mensagem as string,
        payload_retorno: resultado.retorno_raw as Record<string, unknown>,
      });

      // Salva XML de cancelamento se disponível
      if (resultado.xml_cancelamento) {
        const xmlContent = new TextEncoder().encode(resultado.xml_cancelamento as string);
        const xmlPath = `documentos/${documento_id}/cancelamento.xml`;
        await supabaseAdmin.storage
          .from('fiscal-xmls')
          .upload(xmlPath, xmlContent, { contentType: 'application/xml', upsert: true });

        await supabaseAdmin.from('fiscal_xmls').insert({
          fiscal_documento_id: documento_id,
          tipo_arquivo: 'xml_cancelamento',
          storage_path: xmlPath,
          tamanho_bytes: xmlContent.length,
        });
      }

      // Auditoria
      await supabaseAdmin.rpc('fiscal_registrar_auditoria', {
        p_user_id: null,
        p_entidade: 'fiscal_documentos',
        p_entidade_id: documento_id,
        p_acao: 'cancelar_nfe',
        p_resultado: 'sucesso',
        p_antes: JSON.stringify({ status: 'autorizado' }),
        p_depois: JSON.stringify({ status: 'cancelado', justificativa }),
        p_metadados: null,
      });

    } else {
      // Registra evento de falha no cancelamento
      await supabaseAdmin.from('fiscal_eventos').insert({
        fiscal_documento_id: documento_id,
        tipo_evento: 'cancelamento',
        status: 'falha',
        justificativa,
        mensagem: resultado.mensagem as string,
        payload_retorno: resultado.retorno_raw as Record<string, unknown>,
      });
    }

    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[fiscal-cancelar-nfe] Erro:', err);
    return new Response(
      JSON.stringify({ sucesso: false, mensagem: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
