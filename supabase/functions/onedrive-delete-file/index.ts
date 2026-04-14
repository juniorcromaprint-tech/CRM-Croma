// supabase/functions/onedrive-delete-file/index.ts
// Deleta arquivo no OneDrive via Microsoft Graph API
// Move para lixeira (nao apaga permanente) — rede de seguranca
// Auth via JWT (Bearer token do usuario logado no ERP)
// v1 (2026-04-14)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://crm-croma.vercel.app',
  'https://campo-croma.vercel.app',
  'http://localhost:5173',
  'http://localhost:8080',
];
const TOKEN_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Content-Type, Authorization',
  };
}

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get('AZURE_CLIENT_ID_V2');
  const refreshToken = Deno.env.get('AZURE_REFRESH_TOKEN_V2');
  if (!clientId || !refreshToken) throw new Error('Credenciais Azure nao configuradas');
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: 'https://graph.microsoft.com/Files.ReadWrite offline_access',
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error('Token exchange falhou');
  const data = await res.json();
  return data.access_token;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Auth JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Nao autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token invalido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { fileId } = await req.json();
    if (!fileId || typeof fileId !== 'string') {
      return new Response(JSON.stringify({ error: 'fileId obrigatorio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const accessToken = await getAccessToken();
    const res = await fetch(`${GRAPH_BASE}/me/drive/items/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // 204 = sucesso. 404 = ja deletado (idempotencia, tratar como sucesso).
    if (res.status !== 204 && res.status !== 404) {
      const errBody = await res.text().catch(() => '');
      console.error('[onedrive-delete-file] Graph retornou', res.status, errBody);
      return new Response(JSON.stringify({ error: `Graph ${res.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[onedrive-delete-file] OK fileId=${fileId} status=${res.status}`);
    return new Response(JSON.stringify({ success: true, status: res.status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = (err as Error).message || 'Erro interno';
    console.error('[onedrive-delete-file] ERRO:', msg);
    return new Response(JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
