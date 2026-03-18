import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

/**
 * fiscal-deploy-certificado
 *
 * Recebe o certificado .pfx em base64, atualiza as env vars no nfe-service (Vercel)
 * e dispara um redeploy automatico. Tambem registra o certificado no banco.
 *
 * Body: { cert_base64: string, cert_password: string, certificado_id: string }
 *
 * Secrets necessarios:
 *   VERCEL_TOKEN           — token de API do Vercel com acesso ao projeto nfe-service
 *   NFE_SERVICE_PROJECT_ID — project ID do nfe-service no Vercel
 */
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // --- Auth ---
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ ok: false, mensagem: 'Não autorizado' }, 401, corsHeaders);
  }

  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
  if (authErr || !user) {
    return json({ ok: false, mensagem: 'Token inválido' }, 401, corsHeaders);
  }

  try {
    const { cert_base64, cert_password, certificado_id } = await req.json();

    if (!cert_base64 || !cert_password) {
      return json({ ok: false, mensagem: 'cert_base64 e cert_password são obrigatórios' }, 400, corsHeaders);
    }

    const vercelToken = Deno.env.get('VERCEL_TOKEN');
    const projectId = Deno.env.get('NFE_SERVICE_PROJECT_ID');

    if (!vercelToken || !projectId) {
      return json({
        ok: false,
        mensagem: 'Configuração incompleta: VERCEL_TOKEN ou NFE_SERVICE_PROJECT_ID não definidos. Configure nas secrets do Supabase.',
      }, 500, corsHeaders);
    }

    // --- 1. Atualizar env vars no Vercel ---
    const envVars = [
      { key: 'NFE_CERT_BASE64', value: cert_base64, target: ['production', 'preview'], type: 'encrypted' },
      { key: 'NFE_CERT_PASSWORD', value: cert_password, target: ['production', 'preview'], type: 'encrypted' },
    ];

    for (const envVar of envVars) {
      // Primeiro tenta criar, se ja existe, atualiza (PATCH)
      const createRes = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(envVar),
      });

      if (!createRes.ok) {
        const errBody = await createRes.json().catch(() => ({}));
        // Se ja existe (409 ou error code ENV_ALREADY_EXISTS), faz PATCH
        if (createRes.status === 409 || (errBody as any)?.error?.code === 'ENV_ALREADY_EXISTS') {
          // Buscar o ID da env var existente
          const listRes = await fetch(
            `https://api.vercel.com/v9/projects/${projectId}/env`,
            { headers: { Authorization: `Bearer ${vercelToken}` } }
          );
          const listBody = await listRes.json() as { envs?: { id: string; key: string }[] };
          const existing = (listBody.envs ?? []).find((e: { key: string }) => e.key === envVar.key);

          if (existing) {
            const patchRes = await fetch(
              `https://api.vercel.com/v9/projects/${projectId}/env/${existing.id}`,
              {
                method: 'PATCH',
                headers: {
                  Authorization: `Bearer ${vercelToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ value: envVar.value }),
              }
            );
            if (!patchRes.ok) {
              const patchErr = await patchRes.text();
              throw new Error(`Falha ao atualizar ${envVar.key}: ${patchErr}`);
            }
          }
        } else {
          throw new Error(`Falha ao criar ${envVar.key}: ${JSON.stringify(errBody)}`);
        }
      }
    }

    // --- 2. Trigger redeploy ---
    // Busca o ultimo deploy de producao para redeploy
    const deploysRes = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=1&target=production`,
      { headers: { Authorization: `Bearer ${vercelToken}` } }
    );
    const deploysBody = await deploysRes.json() as { deployments?: { uid: string }[] };
    const lastDeploy = (deploysBody.deployments ?? [])[0];

    let redeployTriggered = false;
    if (lastDeploy) {
      const redeployRes = await fetch(
        `https://api.vercel.com/v13/deployments`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${vercelToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'croma-nfe-service',
            deploymentId: lastDeploy.uid,
            target: 'production',
          }),
        }
      );
      redeployTriggered = redeployRes.ok;
    }

    // --- 3. Atualizar certificado no banco (se ID informado) ---
    if (certificado_id) {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false } }
      );

      // Desativa todos os certs e ativa o novo
      await supabaseAdmin.from('fiscal_certificados').update({ ativo: false }).neq('id', certificado_id);
      await supabaseAdmin.from('fiscal_certificados').update({
        ativo: true,
        ultimo_teste_em: new Date().toISOString(),
        ultimo_teste_status: 'deploy_ok',
        updated_at: new Date().toISOString(),
      }).eq('id', certificado_id);

      // Auditoria
      await supabaseAdmin.rpc('fiscal_registrar_auditoria', {
        p_user_id: user.id,
        p_entidade: 'fiscal_certificados',
        p_entidade_id: certificado_id,
        p_acao: 'deploy_certificado',
        p_resultado: 'sucesso',
        p_antes: null,
        p_depois: JSON.stringify({ redeploy: redeployTriggered }),
        p_metadados: null,
      }).catch(() => {});
    }

    return json({
      ok: true,
      mensagem: redeployTriggered
        ? 'Certificado atualizado e nfe-service redeployado com sucesso!'
        : 'Certificado atualizado. Redeploy não foi possível — faça manualmente no Vercel.',
      redeploy: redeployTriggered,
    }, 200, corsHeaders);

  } catch (err) {
    console.error('[fiscal-deploy-certificado] Erro:', err);
    return json({ ok: false, mensagem: String(err) }, 500, corsHeaders);
  }
});

function json(body: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
