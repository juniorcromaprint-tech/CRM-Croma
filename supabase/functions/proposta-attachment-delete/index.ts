// supabase/functions/proposta-attachment-delete/index.ts
// Soft-delete de anexos de proposta com policy de permissao por role
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Token exchange falhou: ${err.error_description || res.statusText}`);
  }
  const data = await res.json();
  return data.access_token;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Auth via JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Nao autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token invalido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Buscar profile + checar role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const ALLOWED_ROLES = ['admin', 'diretor', 'comercial_senior', 'comercial', 'vendedor', 'producao'];
    if (!profile || !ALLOWED_ROLES.includes(profile.role || '')) {
      return new Response(JSON.stringify({ error: 'Sem permissao' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Input JSON
    const { attachmentId } = await req.json();
    if (!attachmentId || typeof attachmentId !== 'string') {
      return new Response(JSON.stringify({ error: 'attachmentId e obrigatorio' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar o anexo + proposta (para checar vendedor_id)
    const { data: attachment, error: fetchErr } = await supabase
      .from('proposta_attachments')
      .select(`
        id, onedrive_file_id, uploaded_by_type, uploaded_by_user_id, uploaded_by_name,
        proposta:propostas(vendedor_id)
      `)
      .eq('id', attachmentId)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchErr || !attachment) {
      return new Response(JSON.stringify({ error: 'Anexo nao encontrado ou ja deletado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Policy de permissao
    const isAdmin = ['admin', 'diretor', 'comercial_senior'].includes(profile.role!);
    const isCliente = attachment.uploaded_by_type === 'cliente';
    const isOwnUpload = attachment.uploaded_by_user_id === user.id;

    if (isCliente && !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Apenas admin pode remover anexos enviados pelo cliente' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!isAdmin && !isOwnUpload) {
      return new Response(
        JSON.stringify({ error: 'Apenas o responsavel pelo upload ou admin pode remover este anexo' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // OneDrive DELETE primeiro (move pra lixeira — idempotente, 404 = ok)
    if (attachment.onedrive_file_id) {
      try {
        const accessToken = await getAccessToken();
        await fetch(`${GRAPH_BASE}/me/drive/items/${attachment.onedrive_file_id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        console.log(`[proposta-attachment-delete] OneDrive delete OK: ${attachment.onedrive_file_id}`);
      } catch (err) {
        // Silencioso: log mas continua — DB soft-delete e o arquivo fica no OneDrive
        console.error(`[proposta-attachment-delete] OneDrive delete falhou (continuando): ${(err as Error).message}`);
      }
    }

    // DB soft-delete
    const { error: updateErr } = await supabase
      .from('proposta_attachments')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by_user_id: user.id,
      })
      .eq('id', attachmentId)
      .is('deleted_at', null);

    if (updateErr) {
      console.error(`[proposta-attachment-delete] DB update falhou: ${updateErr.message}`);
      return new Response(
        JSON.stringify({ error: 'Falha ao registrar remocao no banco' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[proposta-attachment-delete] OK id=${attachmentId} by user=${user.id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const msg = (err as Error).message || 'Erro interno';
    console.error('[proposta-attachment-delete] ERRO:', msg);
    return new Response(
      JSON.stringify({ error: 'Erro interno no servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
