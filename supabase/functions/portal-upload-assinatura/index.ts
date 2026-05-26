// supabase/functions/portal-upload-assinatura/index.ts
// =============================================================================
// PORTAL UPLOAD ASSINATURA - FASE 2-F
//   Recebe assinatura PNG base64 do portal /p/:token e faz upload seguro no
//   bucket proposta-uploads como service_role. Retorna signedUrl com TTL 1 ano
//   pra gravar em propostas.assinatura_cliente_url.
//
//   Auth: nenhuma (verify_jwt=false). Autoriza via share_token na tabela.
//   Padrao JWT: usa get_service_role_legacy_jwt() pra contornar BUG-JWT
//   (sb_secret_* nao-JWT) -- mesma estrategia da briefing-beira-rio v10.
//
//   Body esperado: { token: string (uuid), assinatura_base64: string (data URL ou base64 raw) }
//   Resposta sucesso: { ok: true, url: string, path: string }
//   Resposta erro:    { ok: false, error: string }
//
//   Limites:
//   - tamanho body checado (max 2MB de PNG bruto = ~3MB de data URL base64)
//   - mime forcado image/png
//   - path determinístico assinaturas/{proposta_id}/assinatura.png (upsert=true)
// =============================================================================
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VERSION = 'v1-portal-upload-assinatura';
const MAX_BASE64_BYTES = 3_000_000; // ~3MB string base64 (~2.2MB PNG real)
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 ano

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function getServiceClient() {
  // Tenta SERVICE_ROLE_KEY direto; se for sb_secret_* nao-JWT, fallback via RPC depois
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getLegacyJwtClient() {
  // Usa anon key inicial pra invocar a RPC publica get_service_role_legacy_jwt(),
  // depois cria um client novo com o JWT legacy resolvido (storage upload precisa de JWT real).
  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const bootstrap = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await bootstrap.rpc('get_service_role_legacy_jwt');
  if (error || !data) throw new Error(`legacy_jwt rpc falhou: ${error?.message || 'sem retorno'}`);
  return createClient(url, data as string, { auth: { persistSession: false } });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'method not allowed' }, 405);

  console.log(`[portal-upload-assinatura ${VERSION}] request received`);

  let body: { token?: string; assinatura_base64?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'invalid json' }, 400);
  }

  const { token, assinatura_base64 } = body;
  if (!token || typeof token !== 'string') {
    return json({ ok: false, error: 'token obrigatorio' }, 400);
  }
  if (!assinatura_base64 || typeof assinatura_base64 !== 'string') {
    return json({ ok: false, error: 'assinatura_base64 obrigatoria' }, 400);
  }
  if (assinatura_base64.length > MAX_BASE64_BYTES) {
    return json({ ok: false, error: `assinatura muito grande (max ${MAX_BASE64_BYTES} bytes base64)` }, 413);
  }

  // 1) Resolve token -> proposta_id (RLS bloqueado, mas RPC SECURITY DEFINER usa share_token)
  //    Usamos service client direto na tabela propostas com filtro de share_token.
  let supabase;
  try {
    // Primeiro tenta SERVICE_ROLE_KEY direto (pode ser sb_secret_*)
    supabase = getServiceClient();
    const probe = await supabase.from('propostas').select('id').limit(1);
    if (probe.error && /JWT|jwt/i.test(probe.error.message)) {
      console.warn('[portal-upload-assinatura] SERVICE_ROLE_KEY nao-JWT, fallback legacy_jwt');
      supabase = await getLegacyJwtClient();
    }
  } catch (err) {
    console.error('[portal-upload-assinatura] client init falhou:', err);
    supabase = await getLegacyJwtClient();
  }

  const { data: propostaRow, error: errProp } = await supabase
    .from('propostas')
    .select('id, share_token_active, share_token_expires_at')
    .eq('share_token', token)
    .maybeSingle();

  if (errProp) {
    console.error('[portal-upload-assinatura] lookup proposta erro:', errProp.message);
    return json({ ok: false, error: 'lookup failed: ' + errProp.message }, 500);
  }
  if (!propostaRow) {
    return json({ ok: false, error: 'token invalido' }, 401);
  }
  if (propostaRow.share_token_active === false) {
    return json({ ok: false, error: 'token desativado' }, 401);
  }
  if (propostaRow.share_token_expires_at && new Date(propostaRow.share_token_expires_at) < new Date()) {
    return json({ ok: false, error: 'token expirado' }, 401);
  }

  const propostaId = propostaRow.id as string;

  // 2) Decode base64 -> Uint8Array
  let buffer: Uint8Array;
  try {
    const base64Clean = assinatura_base64.replace(/^data:image\/\w+;base64,/, '');
    const binary = atob(base64Clean);
    buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
  } catch (err) {
    return json({ ok: false, error: 'base64 invalido' }, 400);
  }

  if (buffer.length === 0) {
    return json({ ok: false, error: 'assinatura vazia' }, 400);
  }
  if (buffer.length > 2_500_000) {
    return json({ ok: false, error: 'PNG decodificado > 2.5MB' }, 413);
  }

  // 3) Upload pro Storage (upsert=true permite refazer assinatura)
  const path = `assinaturas/${propostaId}/assinatura.png`;
  const { error: errUp } = await supabase.storage
    .from('proposta-uploads')
    .upload(path, buffer, {
      contentType: 'image/png',
      upsert: true,
      cacheControl: '3600',
    });

  if (errUp) {
    console.error('[portal-upload-assinatura] upload falhou:', errUp.message);
    return json({ ok: false, error: 'upload falhou: ' + errUp.message }, 500);
  }

  // 4) Gera signed URL com TTL longo
  const { data: signed, error: errSign } = await supabase.storage
    .from('proposta-uploads')
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (errSign || !signed?.signedUrl) {
    console.error('[portal-upload-assinatura] signed url falhou:', errSign?.message);
    return json({ ok: false, error: 'signed url falhou: ' + (errSign?.message || 'sem retorno') }, 500);
  }

  console.log(`[portal-upload-assinatura ${VERSION}] OK proposta_id=${propostaId} bytes=${buffer.length}`);

  return json({
    ok: true,
    url: signed.signedUrl,
    path,
    proposta_id: propostaId,
    bytes: buffer.length,
  });
});
