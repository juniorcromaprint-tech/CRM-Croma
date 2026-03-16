// supabase/functions/onedrive-upload-proposta/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Content-Type, Authorization',
  };
}

/** Chunked base64 encoding to avoid stack overflow on large files */
function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  return btoa(parts.join(''));
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // --- Parse FormData ---
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const token = formData.get('token') as string | null;
    const clientNameOverride = formData.get('clientName') as string | null;

    if (!file || !token) {
      return new Response(JSON.stringify({ error: 'file e token são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Validate share_token ---
    const { data: proposta, error: propostaError } = await supabase
      .from('propostas')
      .select('id, numero, cliente:clientes(nome_fantasia)')
      .eq('share_token', token)
      .eq('share_token_active', true)
      .or('share_token_expires_at.is.null,share_token_expires_at.gt.now()')
      .maybeSingle();

    if (propostaError || !proposta) {
      return new Response(JSON.stringify({ error: 'Token inválido ou expirado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nomeCliente = (proposta.cliente as any)?.nome_fantasia || 'cliente';
    const uploadedByName = clientNameOverride || nomeCliente;
    const targetFolder = `Croma/Clientes/${nomeCliente}`;
    const fileName = `${proposta.numero}_${file.name}`;

    const COMPOSIO_API_KEY = Deno.env.get('COMPOSIO_API_KEY')!;
    const ONEDRIVE_ACCOUNT_ID = Deno.env.get('ONEDRIVE_CONNECTED_ACCOUNT_ID')!;

    const composioHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': COMPOSIO_API_KEY,
    };

    // --- Look up existing folder before creating ---
    let folderExists = false;
    try {
      const findRes = await fetch(
        'https://backend.composio.dev/api/v2/actions/ONE_DRIVE_ONEDRIVE_FIND_FOLDER/execute',
        {
          method: 'POST',
          headers: composioHeaders,
          body: JSON.stringify({
            connectedAccountId: ONEDRIVE_ACCOUNT_ID,
            input: {
              folder_name: nomeCliente,
              parent_path: '/Croma/Clientes',
            },
          }),
        }
      );
      if (findRes.ok) {
        const findResult = await findRes.json();
        // Consider folder found if response_data has an id
        folderExists = !!(findResult?.response_data?.id);
      }
    } catch (_) {
      // If find fails we'll attempt to create anyway
    }

    if (!folderExists) {
      const createRes = await fetch(
        'https://backend.composio.dev/api/v2/actions/ONE_DRIVE_ONEDRIVE_CREATE_FOLDER/execute',
        {
          method: 'POST',
          headers: composioHeaders,
          body: JSON.stringify({
            connectedAccountId: ONEDRIVE_ACCOUNT_ID,
            input: {
              parent_folder_path: 'Croma/Clientes',
              folder_name: nomeCliente,
            },
          }),
        }
      );
      if (!createRes.ok) {
        return new Response(JSON.stringify({ error: 'Serviço de upload indisponível' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // --- Encode file and upload ---
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const base64Content = uint8ToBase64(fileBytes);

    const uploadRes = await fetch(
      'https://backend.composio.dev/api/v2/actions/ONE_DRIVE_ONEDRIVE_UPLOAD_FILE/execute',
      {
        method: 'POST',
        headers: composioHeaders,
        body: JSON.stringify({
          connectedAccountId: ONEDRIVE_ACCOUNT_ID,
          input: {
            folder_path: targetFolder,
            file_name: fileName,
            content: base64Content,
            conflict_behavior: 'rename',
          },
        }),
      }
    );

    if (!uploadRes.ok) {
      return new Response(JSON.stringify({ error: 'Serviço de upload indisponível' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const uploadResult = await uploadRes.json();
    const onedriveFileId: string = uploadResult?.response_data?.id || '';
    const onedriveFileUrl: string = uploadResult?.response_data?.webUrl || '';

    // --- Insert into proposta_attachments ---
    const { data: attachment, error: insertError } = await supabase
      .from('proposta_attachments')
      .insert({
        proposta_id: proposta.id,
        nome_arquivo: fileName,
        tipo_mime: file.type || 'application/octet-stream',
        tamanho_bytes: file.size,
        onedrive_file_id: onedriveFileId,
        onedrive_file_url: onedriveFileUrl,
        uploaded_by_type: 'cliente',
        uploaded_by_name: uploadedByName,
      })
      .select('id')
      .single();

    if (insertError) {
      // Upload succeeded but DB record failed — log and return partial success
      console.error('proposta_attachments insert error:', insertError.message);
      return new Response(
        JSON.stringify({ attachmentId: null, onedriveUrl: onedriveFileUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ attachmentId: attachment.id, onedriveUrl: onedriveFileUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('onedrive-upload-proposta error:', (err as Error).message);
    return new Response(JSON.stringify({ error: 'Erro interno no servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
