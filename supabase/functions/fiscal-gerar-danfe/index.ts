import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

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
      // Modo demo: cria um PDF placeholder simples
      const numero = doc.numero ?? 'DEMO';
      const chave = doc.chave_acesso ?? documento_id;

      // HTML simples que simula DANFE
      const danfeHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>DANFE - NF-e ${numero}</title>
<style>body{font-family:Arial;padding:20px;max-width:800px;margin:0 auto}
.header{background:#1e3a5f;color:white;padding:15px;border-radius:5px;margin-bottom:15px}
.field{margin:8px 0;padding:8px;background:#f5f5f5;border-radius:3px}
.label{font-size:11px;color:#666;text-transform:uppercase}
.value{font-size:14px;font-weight:bold}
.badge{display:inline-block;background:#22c55e;color:white;padding:3px 10px;border-radius:15px;font-size:12px}
</style></head>
<body>
<div class="header">
  <h1 style="margin:0">DANFE — Documento Auxiliar da NF-e</h1>
  <p style="margin:5px 0 0;opacity:.8">Croma Print Comunicação Visual</p>
</div>
<div class="field"><div class="label">Número</div><div class="value">${numero}</div></div>
<div class="field"><div class="label">Chave de Acesso</div><div class="value" style="font-size:11px;font-family:monospace">${chave}</div></div>
<div class="field"><div class="label">Status</div><div class="value"><span class="badge">AUTORIZADO (DEMO)</span></div></div>
<div class="field"><div class="label">Data/Hora Emissão</div><div class="value">${new Date().toLocaleString('pt-BR')}</div></div>
<p style="color:#999;font-size:11px;margin-top:20px;text-align:center">
  Este é um DANFE de HOMOLOGAÇÃO gerado em modo DEMO.<br>
  Para produção, configure NFE_PROVIDER_TOKEN com credenciais reais.
</p>
</body></html>`;

      const htmlBytes = new TextEncoder().encode(danfeHtml);
      pdfPath = `documentos/${documento_id}/danfe_demo.html`;

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
