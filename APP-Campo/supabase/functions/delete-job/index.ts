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

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    const { data: profile } = await supabaseClient.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') throw new Error('Apenas administradores podem excluir OSs.')

    const { jobId } = await req.json()
    if (!jobId) throw new Error('jobId é obrigatório')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const extractFileName = (url: string) => url.split('/').pop() || ''

    const [photosResult, videosResult] = await Promise.all([
      supabaseAdmin.from('job_photos').select('photo_url').eq('job_id', jobId),
      supabaseAdmin.from('job_videos').select('video_url').eq('job_id', jobId),
    ])

    if (photosResult.data && photosResult.data.length > 0) {
      await supabaseAdmin.storage.from('job_photos').remove(
        photosResult.data.map(p => extractFileName(p.photo_url))
      )
    }
    if (videosResult.data && videosResult.data.length > 0) {
      await supabaseAdmin.storage.from('job_videos').remove(
        videosResult.data.map(v => extractFileName(v.video_url))
      )
    }

    const { error } = await supabaseAdmin.from('jobs').delete().eq('id', jobId)
    if (error) throw error

    console.log("[delete-job] Job deleted successfully", { jobId, deletedBy: user.id })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error("[delete-job] Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
