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

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verifica se quem está fazendo a requisição é um admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    const { data: profile } = await supabaseClient.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') throw new Error('Apenas administradores podem excluir usuários.')

    // Pega o ID do usuário a ser excluído
    const { userId } = await req.json()
    if (!userId) throw new Error('ID do usuário é obrigatório.')

    // Impede que o admin exclua a si mesmo
    if (userId === user.id) throw new Error('Você não pode excluir sua própria conta.')

    // Cria um cliente admin para operações privilegiadas
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verifica se o usuário tem jobs ativos (em_andamento) atribuídos
    const { data: activeJobs, error: jobsError } = await supabaseAdmin
      .from('jobs')
      .select('id, os_number, status')
      .eq('assigned_to', userId)
      .in('status', ['Em andamento', 'Agendado', 'Pendente'])

    if (jobsError) {
      console.error("[delete-user] Error checking jobs:", jobsError)
    }

    if (activeJobs && activeJobs.length > 0) {
      throw new Error(`Este usuário possui ${activeJobs.length} OS ativa(s). Reatribua ou finalize as OS antes de excluir.`)
    }

    // Desvincula jobs concluídos/cancelados (não apaga os jobs, só remove a referência)
    await supabaseAdmin
      .from('jobs')
      .update({ assigned_to: null })
      .eq('assigned_to', userId)

    // Remove o perfil (pode ter cascade ou não, depende do schema)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileError) {
      console.error("[delete-user] Error deleting profile:", profileError)
      // Continua mesmo se falhar — o importante é deletar o auth user
    }

    // Deleta o usuário do auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteError) throw deleteError

    console.log("[delete-user] User deleted successfully", { userId })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error("[delete-user] Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})