// supabase/functions/onedrive-upload-interno/index.ts
// Upload de artes do vendedor interno -> OneDrive via Microsoft Graph API
// Auth via JWT (Bearer token do usuario logado no ERP)
// v1 (2026-04-14): baseado em onedrive-upload-proposta v13
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
const MAX_SIMPLE_UPLOAD = 4 * 1024 * 1024; // 4MB

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Content-Type, Authorization',
  };
}

function sanitizeName(input: string): string {
  return input
    .replace(/[\/\\:*?"<>|#%&{}~]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 200);
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

async function uploadSimple(
  token: string, path: string, fileBytes: Uint8Array, mimeType: string
): Promise<{ id: string; webUrl: string }> {
  const res = await fetch(`${GRAPH_BASE}/me/drive/root:/${encodeURI(path)}:/content`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType || 'application/octet-stream' },
    body: fileBytes,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Upload falhou (${res.status}): ${err.error?.message || res.statusText}`);
  }
  const data = await res.json();
  return { id: data.id || '', webUrl: data.webUrl || '' };
}

async function uploadLargeFile(
  token: string, path: string, fileBytes: Uint8Array
): Promise<{ id: string; webUrl: string }> {
  const sessionRes = await fetch(
    `${GRAPH_BASE}/me/drive/root:/${encodeURI(path)}:/createUploadSession`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'rename' } }),
    }
  );
  if (!sessionRes.ok) {
    const err = await sessionRes.json().catch(() => ({}));
    throw new Error(`Criar sessao falhou: ${err.error?.message || sessionRes.statusText}`);
  }
  const { uploadUrl } = await sessionRes.json();
  const CHUNK = 327680;
  let lastResponse: any = null;
  for (let offset = 0; offset < fileBytes.length; offset += CHUNK) {
    const end = Math.min(offset + CHUNK, fileBytes.length);
    const chunk = fileBytes.subarray(offset, end);
    const chunkRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': chunk.length.toString(),
        'Content-Range': `bytes ${offset}-${end - 1}/${fileBytes.length}`,
      },
      body: chunk,
    });
    if (!chunkRes.ok && chunkRes.status !== 202) {
      throw new Error(`Chunk upload falhou no offset ${offset}: ${chunkRes.statusText}`);
    }
    lastResponse = await chunkRes.json().catch(() => null);
  }
  if (lastResponse?.id) return { id: lastResponse.id, webUrl: lastResponse.webUrl || '' };
  const infoRes = await fetch(`${GRAPH_BASE}/me/drive/root:/${encodeURI(path)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const info = await infoRes.json();
  return { id: info.id || '', webUrl: info.webUrl || '' };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (!Deno.env.get('AZURE_CLIENT_ID_V2') || !Deno.env.get('AZURE_REFRESH_TOKEN_V2')) {
      return new Response(
        JSON.stringify({ error: 'Configuracao de integracao OneDrive incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auth via JWT (usuario logado no ERP)
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

    // Service client pra operacoes de banco
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Buscar profile + checar role
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, full_name, role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'vendedor', 'producao', 'comercial', 'comercial_senior', 'diretor'].includes(profile.role || '')) {
      return new Response(JSON.stringify({ error: 'Sem permissao para upload' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const uploadedByName = profile.full_name
      || [profile.first_name, profile.last_name].filter(Boolean).join(' ')
      || user.email
      || 'Equipe';

    // Input FormData
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const scope = formData.get('scope') as string | null; // 'pedido' | 'proposta'
    const entityId = formData.get('entityId') as string | null; // UUID

    if (!file || !scope || !entityId) {
      return new Response(JSON.stringify({ error: 'file, scope e entityId sao obrigatorios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!['pedido', 'proposta'].includes(scope)) {
      return new Response(JSON.stringify({ error: 'scope invalido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar entity dinamico
    const tabela = scope === 'pedido' ? 'pedidos' : 'propostas';
    const { data: entity, error: entityError } = await supabase
      .from(tabela)
      .select('id, numero, cliente:clientes(nome_fantasia)')
      .eq('id', entityId)
      .maybeSingle();

    if (entityError || !entity) {
      return new Response(JSON.stringify({ error: `${scope} nao encontrado` }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nomeCliente = (entity.cliente as any)?.nome_fantasia || 'cliente';
    const safeCliente = sanitizeName(nomeCliente);
    const safeFileName = sanitizeName(file.name);
    const numeroEntity = entity.numero ?? entityId;
    const targetPath = `Croma/Clientes/${safeCliente}/${numeroEntity}_${safeFileName}`;

    console.log(`[onedrive-upload-interno v1] ${file.name} -> ${targetPath} (${file.size} bytes) by ${uploadedByName}`);

    const accessToken = await getAccessToken();
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    let uploadResult: { id: string; webUrl: string };
    if (fileBytes.length <= MAX_SIMPLE_UPLOAD) {
      uploadResult = await uploadSimple(accessToken, targetPath, fileBytes, file.type);
    } else {
      uploadResult = await uploadLargeFile(accessToken, targetPath, fileBytes);
    }

    console.log(`[onedrive-upload-interno] OK fileId=${uploadResult.id}`);

    // Nao escrevemos em pedido_itens aqui — responsabilidade do frontend
    return new Response(
      JSON.stringify({
        fileId: uploadResult.id,
        webUrl: uploadResult.webUrl,
        uploadedByName,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const msg = (err as Error).message || 'Erro interno';
    console.error('[onedrive-upload-interno] ERRO:', msg);
    let userMessage = 'Erro interno no servidor';
    if (msg.includes('Token exchange')) userMessage = 'Servico de upload temporariamente indisponivel';
    if (msg.includes('Upload falhou')) userMessage = 'Falha ao enviar arquivo para o armazenamento';
    if (msg.includes('Sem permissao')) userMessage = msg;
    return new Response(
      JSON.stringify({ error: userMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
