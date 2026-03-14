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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validar autenticação do usuário
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verificar token JWT via Supabase
  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Token inválido' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const token = formData.get('token') as string;

    if (!file || !token) throw new Error('file and token required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get proposta + client info for folder path
    const { data: proposta } = await supabase
      .from('propostas')
      .select('numero, cliente:clientes(nome_fantasia)')
      .eq('share_token', token)
      .single();

    if (!proposta) throw new Error('Proposta não encontrada');

    const clienteName = (proposta.cliente as any)?.nome_fantasia || 'cliente';
    const folderPath = `Croma/Clientes/${clienteName}/Proposta-${proposta.numero}`;

    // Upload to OneDrive via Composio
    const fileBytes = await file.arrayBuffer();
    const base64Content = btoa(String.fromCharCode(...new Uint8Array(fileBytes)));

    const composioRes = await fetch('https://backend.composio.dev/api/v2/actions/ONE_DRIVE_ONEDRIVE_UPLOAD_FILE/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('COMPOSIO_API_KEY')!,
      },
      body: JSON.stringify({
        connectedAccountId: Deno.env.get('ONEDRIVE_CONNECTED_ACCOUNT_ID'),
        input: {
          parent_folder_path: folderPath,
          file_name: file.name,
          content: base64Content,
        },
      }),
    });

    if (!composioRes.ok) throw new Error('OneDrive upload failed');
    const result = await composioRes.json();

    const fileId = result?.response_data?.id || '';
    const fileUrl = result?.response_data?.webUrl || '';

    return new Response(JSON.stringify({ file_id: fileId, file_url: fileUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
