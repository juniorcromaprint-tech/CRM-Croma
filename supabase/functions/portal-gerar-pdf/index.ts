// supabase/functions/portal-gerar-pdf/index.ts
// Gera HTML da proposta e retorna para impressão/download como PDF via browser
// Não requer Chrome nem libs externas - zero alerta de antivírus
// Mesmo padrão do fiscal-gerar-danfe

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { gerarPropostaHTML } from './proposta-generator.ts';

// Portal é público (acesso por token) - não precisa de auth JWT
// Mas limita acesso apenas aos domínios permitidos
const ALLOWED_ORIGINS = [
  'https://crm-croma.vercel.app',
  'https://campo-croma.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { token } = await req.json();

    if (!token || typeof token !== 'string' || token.length < 10) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    // Buscar proposta via RPC (mesma função usada pelo portal frontend)
    const { data: proposta, error } = await supabase.rpc('portal_get_proposta', {
      p_token: token,
    });

    if (error || !proposta) {
      return new Response(JSON.stringify({ error: 'Proposta não encontrada ou link inválido' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Registrar acesso no log (opcional - não bloqueia)
    supabase.from('pessoal.log_acoes').insert({
      acao: 'portal_download_pdf',
      detalhes: { proposta_numero: proposta.numero },
    }).catch(() => {});

    // Gerar HTML completo da proposta
    const html = gerarPropostaHTML(proposta);

    // Retornar como HTML - o browser abre e chama window.print() automaticamente
    // O usuário salva como PDF via diálogo nativo (idêntico ao DANFE)
    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });

  } catch (err) {
    console.error('[portal-gerar-pdf] Erro:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
