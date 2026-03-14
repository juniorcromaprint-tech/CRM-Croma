import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Validar autenticação do usuário
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verificar token JWT via Supabase
  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Token inválido' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { pedido_id } = await req.json()
    if (!pedido_id) throw new Error('pedido_id obrigatório')

    // Busca dados do pedido + cliente
    const { data: pedido, error: pedidoErr } = await supabase
      .from('pedidos')
      .select('id, numero, clientes(nome_fantasia, razao_social)')
      .eq('id', pedido_id)
      .single()
    if (pedidoErr || !pedido) throw new Error('Pedido não encontrado')

    const clientes = pedido.clientes as any
    const clienteNome = (clientes?.nome_fantasia || clientes?.razao_social || 'Cliente')
      .replace(/[/\\:*?"<>|]/g, '_')
    const folderName = (pedido.numero ?? pedido_id).replace(/[/\\:*?"<>|]/g, '_')

    const composioApiKey = Deno.env.get('COMPOSIO_API_KEY') ?? ''
    const connectedAccountId = Deno.env.get('ONEDRIVE_CONNECTED_ACCOUNT_ID') ?? ''

    const execTool = async (toolName: string, input: Record<string, unknown>) => {
      const res = await fetch(
        `https://backend.composio.dev/api/v1/actions/${toolName}/execute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': composioApiKey,
          },
          body: JSON.stringify({ connectedAccountId, input }),
        }
      )
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(`Composio ${toolName} error: ${txt}`)
      }
      return res.json()
    }

    // Cria estrutura: Croma/Clientes/{clienteNome}/{folderName}
    const clienteResult = await execTool('ONE_DRIVE_ONEDRIVE_CREATE_FOLDER', {
      folder_name: clienteNome,
      parent_folder_path: 'Croma/Clientes',
    })

    const parentId =
      clienteResult?.data?.id ??
      clienteResult?.response?.data?.id ??
      clienteResult?.successData?.id

    const pedidoInput: Record<string, unknown> = { folder_name: folderName }
    if (parentId) pedidoInput.parent_folder_id = parentId

    const pedidoResult = await execTool('ONE_DRIVE_ONEDRIVE_CREATE_FOLDER', pedidoInput)

    const folderId =
      pedidoResult?.data?.id ??
      pedidoResult?.response?.data?.id ??
      pedidoResult?.successData?.id

    const folderUrl =
      pedidoResult?.data?.webUrl ??
      pedidoResult?.response?.data?.webUrl ??
      pedidoResult?.successData?.webUrl

    // Salva no banco
    const { error: updateErr } = await supabase
      .from('pedidos')
      .update({ onedrive_folder_id: folderId, onedrive_folder_url: folderUrl })
      .eq('id', pedido_id)

    if (updateErr) throw new Error(`Erro ao salvar: ${updateErr.message}`)

    console.log('[onedrive-criar-pasta] OK', { pedido_id, folderId })

    return new Response(
      JSON.stringify({ success: true, folder_id: folderId, folder_url: folderUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('[onedrive-criar-pasta] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
