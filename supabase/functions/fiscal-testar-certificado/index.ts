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

    const { certificado_id } = await req.json();

    if (!certificado_id) {
      return new Response(
        JSON.stringify({ ok: false, mensagem: 'certificado_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SEGURANÇA: busca apenas metadados — NUNCA retorna o arquivo do certificado
    const { data: cert, error: certError } = await supabaseAdmin
      .from('fiscal_certificados')
      .select('id, nome, validade_fim, validade_inicio, arquivo_encriptado_url, cnpj_titular, ativo')
      .eq('id', certificado_id)
      .single();

    if (certError || !cert) {
      return new Response(
        JSON.stringify({ ok: false, mensagem: 'Certificado não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!cert.ativo) {
      const resultado = { ok: false, mensagem: 'Certificado inativo' };
      await supabaseAdmin.from('fiscal_certificados').update({
        ultimo_teste_em: new Date().toISOString(),
        ultimo_teste_status: 'falha',
        updated_at: new Date().toISOString(),
      }).eq('id', certificado_id);
      return new Response(JSON.stringify(resultado), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verifica validade
    if (cert.validade_fim) {
      const validade = new Date(cert.validade_fim);
      const agora = new Date();
      if (validade < agora) {
        const diasExpirado = Math.floor((agora.getTime() - validade.getTime()) / (1000 * 60 * 60 * 24));
        const resultado = {
          ok: false,
          mensagem: `Certificado expirado há ${diasExpirado} dias (validade: ${cert.validade_fim})`,
        };
        await supabaseAdmin.from('fiscal_certificados').update({
          ultimo_teste_em: new Date().toISOString(),
          ultimo_teste_status: 'falha_expiracao',
          updated_at: new Date().toISOString(),
        }).eq('id', certificado_id);
        return new Response(JSON.stringify(resultado), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Verifica se arquivo/referência existe
    const storagePath = cert.arquivo_encriptado_url;

    if (!storagePath) {
      const resultado = { ok: false, mensagem: 'Nenhum arquivo ou referência de certificado configurada' };
      await supabaseAdmin.from('fiscal_certificados').update({
        ultimo_teste_em: new Date().toISOString(),
        ultimo_teste_status: 'falha_config',
        updated_at: new Date().toISOString(),
      }).eq('id', certificado_id);
      return new Response(JSON.stringify(resultado), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (storagePath.startsWith('env:')) {
      // Certificate stored as env var reference (e.g., "env:NFE_CERT_BASE64")
      // This is a valid configuration — the actual cert lives as a Vercel/Supabase secret
      const envName = storagePath.replace('env:', '');
      if (!envName) {
        const resultado = { ok: false, mensagem: 'Referência de certificado inválida (env: sem nome)' };
        await supabaseAdmin.from('fiscal_certificados').update({
          ultimo_teste_em: new Date().toISOString(),
          ultimo_teste_status: 'falha_config',
          updated_at: new Date().toISOString(),
        }).eq('id', certificado_id);
        return new Response(JSON.stringify(resultado), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // env-based certificate is valid — skip storage file check
    } else {
      // Storage-based certificate — verify file exists in bucket
      const folder = storagePath.split('/').slice(0, -1).join('/') || 'certificados';
      const fileName = storagePath.split('/').pop();

      let arquivoExiste = false;
      if (fileName) {
        const { data: files } = await supabaseAdmin.storage
          .from('fiscal-certificados')
          .list(folder);
        arquivoExiste = (files ?? []).some((f: { name: string }) => f.name === fileName);
      }

      if (!arquivoExiste) {
        const resultado = { ok: false, mensagem: 'Arquivo do certificado não encontrado no storage seguro' };
        await supabaseAdmin.from('fiscal_certificados').update({
          ultimo_teste_em: new Date().toISOString(),
          ultimo_teste_status: 'falha_arquivo',
          updated_at: new Date().toISOString(),
        }).eq('id', certificado_id);
        return new Response(JSON.stringify(resultado), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Calcula dias restantes de validade
    let diasRestantes: number | null = null;
    let avisoValidade = '';
    if (cert.validade_fim) {
      diasRestantes = Math.floor(
        (new Date(cert.validade_fim).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (diasRestantes <= 30) {
        avisoValidade = ` Atencao: expira em ${diasRestantes} dias!`;
      }
    }

    // Tudo OK — certifica os metadados
    const resultado = {
      ok: true,
      mensagem: `Certificado '${cert.nome}' válido${avisoValidade}`,
      cnpj: cert.cnpj_titular,
      validade: cert.validade_fim,
      dias_restantes: diasRestantes,
    };

    await supabaseAdmin.from('fiscal_certificados').update({
      ultimo_teste_em: new Date().toISOString(),
      ultimo_teste_status: 'sucesso',
      updated_at: new Date().toISOString(),
    }).eq('id', certificado_id);

    // Auditoria
    await supabaseAdmin.rpc('fiscal_registrar_auditoria', {
      p_user_id: null,
      p_entidade: 'fiscal_certificados',
      p_entidade_id: certificado_id,
      p_acao: 'testar_certificado',
      p_resultado: 'sucesso',
      p_antes: null,
      p_depois: JSON.stringify({ teste: 'sucesso', dias_restantes: diasRestantes }),
      p_metadados: null,
    });

    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[fiscal-testar-certificado] Erro:', err);
    return new Response(
      JSON.stringify({ ok: false, mensagem: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
