import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Log de todos os cabeçalhos pra diagnóstico
    const headerSnapshot: Record<string, string> = {}
    for (const [k, v] of req.headers.entries()) {
      headerSnapshot[k] = k.toLowerCase() === 'authorization' || k.toLowerCase() === 'apikey'
        ? `${v.slice(0, 20)}...(${v.length} chars)`
        : v
    }
    console.log('[delete-job] incoming headers', headerSnapshot)

    // Aceita o token vindo do header Authorization OU apikey como fallback
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    const apiKeyHeader = req.headers.get('apikey') || req.headers.get('x-client-info')
    const tokenRaw = authHeader || (apiKeyHeader ? `Bearer ${apiKeyHeader}` : null)

    if (!tokenRaw) {
      console.warn('[delete-job] sem Authorization/apikey')
      return jsonResponse({ error: 'Token de autenticação ausente. Faça login novamente.' }, 401)
    }

    // Normaliza para Bearer <jwt>
    const bearerToken = tokenRaw.startsWith('Bearer ') ? tokenRaw : `Bearer ${tokenRaw}`
    const jwt = bearerToken.replace(/^Bearer /, '').trim()

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[delete-job] env SUPABASE_URL/SERVICE_ROLE_KEY ausentes')
      return jsonResponse({ error: 'Configuração do servidor incompleta.' }, 500)
    }

    // Cliente com service role pra tudo (bypass RLS)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // Valida o JWT do usuário chamando getUser no admin
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt)

    if (userError || !userData?.user) {
      console.warn('[delete-job] JWT inválido', userError?.message)
      return jsonResponse({ error: 'Sessão expirada. Faça login novamente.' }, 401)
    }

    const user = userData.user
    console.log('[delete-job] autenticado como', user.id, user.email)

    // Valida que é admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[delete-job] erro ao buscar profile', profileError)
      return jsonResponse({ error: 'Perfil do usuário não encontrado.' }, 403)
    }

    if (profile?.role !== 'admin') {
      console.warn('[delete-job] usuário não é admin', { userId: user.id, role: profile?.role })
      return jsonResponse({ error: 'Apenas administradores podem excluir OSs.' }, 403)
    }

    // Pega o jobId do body
    let body: { jobId?: string } = {}
    try {
      body = await req.json()
    } catch (e) {
      console.error('[delete-job] body inválido', e)
      return jsonResponse({ error: 'Body JSON inválido.' }, 400)
    }

    const { jobId } = body
    if (!jobId) {
      return jsonResponse({ error: 'jobId é obrigatório.' }, 400)
    }

    // Verifica se o job existe
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('id, os_number')
      .eq('id', jobId)
      .maybeSingle()

    if (jobError) {
      console.error('[delete-job] erro ao buscar job', jobError)
      return jsonResponse({ error: `Erro ao buscar OS: ${jobError.message}` }, 500)
    }

    if (!job) {
      return jsonResponse({ error: 'OS não encontrada.' }, 404)
    }

    const extractFileName = (url: string) => {
      try {
        const u = new URL(url)
        return decodeURIComponent(u.pathname.split('/').pop() || '')
      } catch {
        return url.split('/').pop() || ''
      }
    }

    // Limpa arquivos do storage (fotos e vídeos)
    const [photosResult, videosResult] = await Promise.all([
      supabaseAdmin.from('job_photos').select('photo_url').eq('job_id', jobId),
      supabaseAdmin.from('job_videos').select('video_url').eq('job_id', jobId),
    ])

    if (photosResult.data && photosResult.data.length > 0) {
      const files = photosResult.data.map(p => extractFileName(p.photo_url)).filter(Boolean)
      if (files.length > 0) {
        const { error: storageErr } = await supabaseAdmin.storage.from('job_photos').remove(files)
        if (storageErr) console.warn('[delete-job] falha ao remover fotos do storage', storageErr)
      }
    }

    if (videosResult.data && videosResult.data.length > 0) {
      const files = videosResult.data.map(v => extractFileName(v.video_url)).filter(Boolean)
      if (files.length > 0) {
        const { error: storageErr } = await supabaseAdmin.storage.from('job_videos').remove(files)
        if (storageErr) console.warn('[delete-job] falha ao remover vídeos do storage', storageErr)
      }
    }

    // Deleta a OS (CASCADE remove job_photos/job_videos/job_attachments)
    const { error: deleteError } = await supabaseAdmin
      .from('jobs')
      .delete()
      .eq('id', jobId)

    if (deleteError) {
      console.error('[delete-job] erro ao deletar job', deleteError)
      return jsonResponse({ error: `Erro ao excluir a OS: ${deleteError.message}` }, 500)
    }

    console.log('[delete-job] OS excluída com sucesso', { jobId, osNumber: job.os_number, deletedBy: user.id })
    return jsonResponse({ success: true, jobId, osNumber: job.os_number }, 200)
  } catch (error: any) {
    console.error('[delete-job] erro não tratado', error)
    return jsonResponse({ error: error?.message || 'Erro desconhecido.' }, 500)
  }
})
