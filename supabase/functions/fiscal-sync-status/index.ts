import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Validar autenticação: aceita JWT de usuário autenticado ou segredo interno de cron
  const authHeader = req.headers.get('Authorization');
  const cronSecret = req.headers.get('x-cron-secret');
  const expectedCronSecret = Deno.env.get('CRON_SECRET');

  const isValidCron = expectedCronSecret && cronSecret === expectedCronSecret;
  const hasBearerToken = authHeader && authHeader.startsWith('Bearer ');

  if (!isValidCron && !hasBearerToken) {
    return new Response(JSON.stringify({ ok: false, mensagem: 'Não autorizado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!isValidCron && hasBearerToken) {
    const supabaseAuthCheck = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader! } } }
    );
    const { data: { user }, error: authError } = await supabaseAuthCheck.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ ok: false, mensagem: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Busca documentos em estados transitórios que precisam de sync
    const { data: documentosPendentes } = await supabaseAdmin
      .from('fiscal_documentos')
      .select('id, chave_acesso, status, fiscal_ambientes(tipo)')
      .in('status', ['emitindo', 'validando'])
      .not('chave_acesso', 'is', null)
      .order('updated_at', { ascending: true })
      .limit(50);

    const nfeToken = Deno.env.get('NFE_PROVIDER_TOKEN');
    const nfeBaseUrl = Deno.env.get('NFE_PROVIDER_URL') ?? 'https://homologacao.focusnfe.com.br';

    let processados = 0;
    const resultados: Array<{ id: string; de: string; para: string }> = [];

    for (const doc of documentosPendentes ?? []) {
      try {
        if (!nfeToken || nfeToken === 'DEMO_MODE') {
          // Demo: não altera status automaticamente
          continue;
        }

        const response = await fetch(
          `${nfeBaseUrl}/v2/nfe/${doc.chave_acesso}`,
          { headers: { 'Authorization': `Token token=${nfeToken}` } }
        );

        if (!response.ok) continue;

        const retorno = await response.json();
        const statusProvider = (retorno.status ?? '').toLowerCase();
        let novoStatus = doc.status;
        let protocolo = null;

        if (statusProvider === 'autorizado') {
          novoStatus = 'autorizado';
          protocolo = retorno.protocolo_autorizacao;
        } else if (['rejeitado', 'cancelado', 'denegado'].includes(statusProvider)) {
          novoStatus = statusProvider;
        }

        if (novoStatus !== doc.status) {
          await supabaseAdmin
            .from('fiscal_documentos')
            .update({
              status: novoStatus,
              ...(protocolo ? { protocolo } : {}),
              updated_at: new Date().toISOString(),
            })
            .eq('id', doc.id);

          await supabaseAdmin.from('fiscal_eventos').insert({
            fiscal_documento_id: doc.id,
            tipo_evento: 'sincronizacao_status',
            status: 'sucesso',
            protocolo,
            mensagem: `Status sincronizado: ${doc.status} → ${novoStatus}`,
            payload_retorno: retorno,
          });

          resultados.push({ id: doc.id, de: doc.status, para: novoStatus });
          processados++;
        }
      } catch (itemErr) {
        console.error(`[fiscal-sync-status] Erro ao processar ${doc.id}:`, itemErr);
      }
    }

    // Verifica também a fila de emissão para itens presos
    const { data: filaTravaada } = await supabaseAdmin
      .from('fiscal_filas_emissao')
      .select('id, fiscal_documento_id, locked_at')
      .eq('status_fila', 'processando')
      .lt('locked_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()); // travado há > 10 min

    for (const item of filaTravaada ?? []) {
      await supabaseAdmin
        .from('fiscal_filas_emissao')
        .update({
          status_fila: 'pendente',
          locked_at: null,
          locked_by: null,
          ultimo_erro: 'Lock expirado — resetado pelo sync',
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processados,
        total_verificados: documentosPendentes?.length ?? 0,
        fila_desbloqueada: filaTravaada?.length ?? 0,
        resultados,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[fiscal-sync-status] Erro:', err);
    return new Response(
      JSON.stringify({ ok: false, mensagem: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
