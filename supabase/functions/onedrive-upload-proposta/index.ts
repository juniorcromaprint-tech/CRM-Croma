// supabase/functions/onedrive-upload-proposta/index.ts
// Upload de arquivos do portal cliente -> OneDrive via Microsoft Graph API
// Substitui integracao Composio (descontinuada) - Abril 2026
// v13 (14/04): aceita previewUrl do frontend para salvar thumbnail leve
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
const MAX_SIMPLE_UPLOAD = 4 * 1024 * 1024;

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
    .replace(/[/\\:*?"<>|#%&{}~]/g, '_')
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const token = formData.get('token') as string | null;
    const clientNameOverride = ((formData.get('clientName') as string | null) || '').trim().slice(0, 200) || null;
    // v13: preview_url publico gerado no browser
    const previewUrlRaw = (formData.get('previewUrl') as string | null) || '';
    const previewUrl = previewUrlRaw.trim().slice(0, 2000) || null;

    if (!file || !token) {
      return new Response(
        JSON.stringify({ error: 'file e token sao obrigatorios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: proposta, error: propostaError } = await supabase
      .from('propostas')
      .select('id, numero, cliente:clientes(id, nome_fantasia, razao_social)')
      .eq('share_token', token)
      .eq('share_token_active', true)
      .or('share_token_expires_at.is.null,share_token_expires_at.gt.now()')
      .maybeSingle();

    if (propostaError || !proposta) {
      return new Response(
        JSON.stringify({ error: 'Token invalido ou expirado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clienteObj = proposta.cliente as any;
    const nomeCliente = clienteObj?.nome_fantasia || clienteObj?.razao_social || 'sem-nome';
    const clienteId = clienteObj?.id as string | undefined;
    const clienteIdCurto = clienteId ? clienteId.slice(0, 8) : 'sem-id';
    const uploadedByName = clientNameOverride || nomeCliente;
    const safeCliente = sanitizeName(nomeCliente);
    const safeFileName = sanitizeName(file.name);
    const targetPath = `Croma/Clientes/${clienteIdCurto}_${safeCliente}/${proposta.numero}/${Date.now()}_${safeFileName}`;
    const displayFileName = `${proposta.numero}_${file.name}`;

    console.log(`[upload v13] ${displayFileName} -> OneDrive:/${targetPath} (${file.size} bytes) preview=${previewUrl ? 'yes' : 'no'}`);

    const accessToken = await getAccessToken();
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    let uploadResult: { id: string; webUrl: string };
    if (fileBytes.length <= MAX_SIMPLE_UPLOAD) {
      uploadResult = await uploadSimple(accessToken, targetPath, fileBytes, file.type);
    } else {
      uploadResult = await uploadLargeFile(accessToken, targetPath, fileBytes);
    }

    const { data: attachment, error: insertError } = await supabase
      .from('proposta_attachments')
      .insert({
        proposta_id: proposta.id,
        nome_arquivo: displayFileName,
        tipo_mime: file.type || 'application/octet-stream',
        tamanho_bytes: file.size,
        onedrive_file_id: uploadResult.id,
        onedrive_file_url: uploadResult.webUrl,
        preview_url: previewUrl,
        uploaded_by_type: 'cliente',
        uploaded_by_name: uploadedByName,
      })
      .select('id, preview_url')
      .single();

    if (insertError) {
      console.error('[upload] Insert em proposta_attachments falhou:', insertError.message);
      return new Response(
        JSON.stringify({ attachmentId: null, onedriveUrl: uploadResult.webUrl, previewUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        attachmentId: attachment.id,
        onedriveUrl: uploadResult.webUrl,
        previewUrl: attachment.preview_url,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const msg = (err as Error).message || 'Erro interno';
    console.error('[onedrive-upload-proposta] ERRO:', msg);
    let userMessage = 'Erro interno no servidor';
    if (msg.includes('Token exchange')) userMessage = 'Servico de upload temporariamente indisponivel';
    if (msg.includes('Upload falhou')) userMessage = 'Falha ao enviar arquivo para o armazenamento';
    return new Response(
      JSON.stringify({ error: userMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
