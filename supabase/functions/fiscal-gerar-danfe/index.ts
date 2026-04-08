import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { gerarDanfeHTMLEdge } from './danfe-generator.ts';

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
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Validar autenticação do usuário
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ ok: false, mensagem: 'Não autorizado' }), {
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
    return new Response(JSON.stringify({ ok: false, mensagem: 'Token inválido' }), {
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

    const { documento_id } = await req.json();

    if (!documento_id) {
      return new Response(
        JSON.stringify({ ok: false, mensagem: 'documento_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: doc, error: docError } = await supabaseAdmin
      .from('fiscal_documentos')
      .select('id, chave_acesso, status, pdf_url, fiscal_ambientes(tipo), numero')
      .eq('id', documento_id)
      .single();

    if (docError || !doc) {
      return new Response(
        JSON.stringify({ ok: false, mensagem: 'Documento não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (doc.status !== 'autorizado') {
      return new Response(
        JSON.stringify({ ok: false, mensagem: `DANFE disponível apenas para documentos autorizados. Status atual: ${doc.status}` }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se já tem PDF salvo, retorna URL assinada
    if (doc.pdf_url) {
      const { data: existingXml } = await supabaseAdmin
        .from('fiscal_xmls')
        .select('storage_path')
        .eq('fiscal_documento_id', documento_id)
        .eq('tipo_arquivo', 'pdf_danfe')
        .single();

      if (existingXml?.storage_path) {
        const { data: signedUrl } = await supabaseAdmin.storage
          .from('fiscal-xmls')
          .createSignedUrl(existingXml.storage_path, 3600);

        if (signedUrl?.signedUrl) {
          // Registra evento de download
          await supabaseAdmin.from('fiscal_eventos').insert({
            fiscal_documento_id: documento_id,
            tipo_evento: 'download_pdf',
            status: 'sucesso',
            mensagem: 'DANFE acessado (cache)',
          });

          return new Response(
            JSON.stringify({ ok: true, pdf_url: signedUrl.signedUrl, cached: true }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    const nfeServiceUrl = Deno.env.get('NFE_SERVICE_URL');
    const nfeInternalSecret = Deno.env.get('NFE_INTERNAL_SECRET');

    let pdfUrl = '';
    let pdfPath = '';

    if (!nfeServiceUrl || !nfeInternalSecret) {
      // Modo DANFE profissional: gera HTML completo no padrao classico brasileiro
      // Buscar documento completo com itens, cliente e empresa para gerar DANFE real
      const { data: docCompleto } = await supabaseAdmin
        .from('fiscal_documentos')
        .select(`*, fiscal_documentos_itens(*), clientes(*), fiscal_ambientes(nome, tipo), fiscal_series(serie)`)
        .eq('id', documento_id)
        .single();

      // Buscar dados da empresa emitente
      const ambienteId = docCompleto?.ambiente_id;
      let empresa: any = null;
      if (ambienteId) {
        const { data: amb } = await supabaseAdmin
          .from('fiscal_ambientes')
          .select('empresa_id, empresas(*)')
          .eq('id', ambienteId)
          .single();
        empresa = amb?.empresas;
      }

      const danfeHtml = gerarDanfeHTMLEdge(docCompleto ?? doc, empresa);

      const htmlBytes = new TextEncoder().encode(danfeHtml);
      pdfPath = `documentos/${documento_id}/danfe.html`;

      await supabaseAdmin.storage
        .from('fiscal-xmls')
        .upload(pdfPath, htmlBytes, { contentType: 'text/html; charset=utf-8', upsert: true });

      const { data: signedUrl } = await supabaseAdmin.storage
        .from('fiscal-xmls')
        .createSignedUrl(pdfPath, 3600);

      pdfUrl = signedUrl?.signedUrl ?? '';

    } else if (doc.chave_acesso) {
      // Modo real: busca PDF via nfe-service (nfewizard-io)
      try {
        const response = await fetch(
          `${nfeServiceUrl}/api/danfe`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-secret': nfeInternalSecret!,
              'Accept': 'application/pdf',
            },
            body: JSON.stringify({ chave_acesso: doc.chave_acesso }),
          }
        );

        if (response.ok) {
          const pdfBytes = await response.arrayBuffer();
          pdfPath = `documentos/${documento_id}/danfe.pdf`;

          await supabaseAdmin.storage
            .from('fiscal-xmls')
            .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true });

          // Salva referência na tabela fiscal_xmls
          await supabaseAdmin.from('fiscal_xmls').upsert({
            fiscal_documento_id: documento_id,
            tipo_arquivo: 'pdf_danfe',
            storage_path: pdfPath,
            tamanho_bytes: pdfBytes.byteLength,
          });

          // Atualiza pdf_url no documento
          await supabaseAdmin
            .from('fiscal_documentos')
            .update({ pdf_url: pdfPath, updated_at: new Date().toISOString() })
            .eq('id', documento_id);

          const { data: signedUrl } = await supabaseAdmin.storage
            .from('fiscal-xmls')
            .createSignedUrl(pdfPath, 3600);

          pdfUrl = signedUrl?.signedUrl ?? '';
        } else {
          throw new Error(`Provider retornou ${response.status} ao gerar PDF`);
        }
      } catch (pdfErr) {
        console.error('[fiscal-gerar-danfe] Erro ao buscar PDF:', pdfErr);
        return new Response(
          JSON.stringify({ ok: false, mensagem: `Erro ao gerar DANFE: ${String(pdfErr)}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (pdfUrl) {
      // Atualiza referência no documento se não tinha
      if (!doc.pdf_url && pdfPath) {
        await supabaseAdmin
          .from('fiscal_documentos')
          .update({ pdf_url: pdfPath, updated_at: new Date().toISOString() })
          .eq('id', documento_id);
      }

      // Registra evento de download
      await supabaseAdmin.from('fiscal_eventos').insert({
        fiscal_documento_id: documento_id,
        tipo_evento: 'download_pdf',
        status: 'sucesso',
        mensagem: 'DANFE gerado e acessado com sucesso',
      });

      // Auditoria
      await supabaseAdmin.rpc('fiscal_registrar_auditoria', {
        p_user_id: null,
        p_entidade: 'fiscal_documentos',
        p_entidade_id: documento_id,
        p_acao: 'baixar_pdf',
        p_resultado: 'sucesso',
        p_antes: null,
        p_depois: null,
        p_metadados: JSON.stringify({ pdf_path: pdfPath }),
      });
    }

    return new Response(
      JSON.stringify({ ok: !!pdfUrl, pdf_url: pdfUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[fiscal-gerar-danfe] Erro:', err);
    return new Response(
      JSON.stringify({ ok: false, mensagem: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
