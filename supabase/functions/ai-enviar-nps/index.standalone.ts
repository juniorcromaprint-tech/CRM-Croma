// ai-enviar-nps — STANDALONE (sem imports relativos)
// Deploy: npx supabase@latest functions deploy ai-enviar-nps --project-ref djwjmfgplnqyffdcgdaw

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Content-Type, Authorization',
};
function jsonResponse(data: unknown, status: number, h = CORS_HEADERS): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...h, 'Content-Type': 'application/json' } });
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('id, numero, cliente_id, data_conclusao, clientes(nome_fantasia, contato_nome, email)')
      .in('status', ['concluido', 'entregue', 'faturado'])
      .gte('data_conclusao', sevenDaysAgo.toISOString())
      .is('excluido_em', null);

    if (!pedidos || pedidos.length === 0) return jsonResponse({ enviados: 0, motivo: 'Nenhum pedido elegível' }, 200);

    const pedidoIds = pedidos.map(p => p.id);
    const { data: existingNps } = await supabase.from('nps_respostas').select('pedido_id').in('pedido_id', pedidoIds);
    const alreadySent = new Set((existingNps ?? []).map(n => n.pedido_id));
    const elegiveis = pedidos.filter(p => !alreadySent.has(p.id));

    if (elegiveis.length === 0) return jsonResponse({ enviados: 0, motivo: 'Todos já possuem NPS' }, 200);

    const { data: resendConfig } = await supabase.from('admin_config').select('valor').eq('chave', 'RESEND_API_KEY').single();
    const resendKey = resendConfig?.valor as string;

    let enviados = 0;
    const erros: string[] = [];

    for (const pedido of elegiveis.slice(0, 20)) {
      const cliente = pedido.clientes as any;
      const email = cliente?.email;
      const nome = cliente?.contato_nome || cliente?.nome_fantasia || 'Cliente';
      const token = crypto.randomUUID();

      const { error: insertError } = await supabase.from('nps_respostas').insert({ pedido_id: pedido.id, cliente_id: pedido.cliente_id, token });
      if (insertError) { erros.push(`Pedido ${pedido.numero}: ${insertError.message}`); continue; }

      if (resendKey && email) {
        const npsUrl = `https://crm-croma.vercel.app/nps/${token}`;
        try {
          const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'Croma Print <nps@cromaprint.com.br>',
              to: email,
              subject: `Como foi sua experiência? — Pedido #${pedido.numero}`,
              html: `<div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1e40af;">Olá, ${nome}!</h2>
  <p>Seu pedido <strong>#${pedido.numero}</strong> foi concluído.</p>
  <p>Gostaríamos muito de saber como foi sua experiência com a Croma Print.</p>
  <p>Leva menos de 1 minuto:</p>
  <div style="text-align: center; margin: 30px 0;">
    <a href="${npsUrl}" style="background-color: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">Avaliar agora</a>
  </div>
  <p style="color: #94a3b8; font-size: 12px;">Croma Print Comunicação Visual</p>
</div>`,
            }),
          });
          if (emailRes.ok) enviados++; else erros.push(`Email ${email}: ${emailRes.statusText}`);
        } catch (err) { erros.push(`Email ${email}: ${(err as Error).message}`); }
      } else {
        enviados++;
      }
    }

    await supabase.from('ai_logs').insert({ funcao: 'enviar-nps', tokens_usados: 0, custo: 0, metadata: { elegiveis: elegiveis.length, enviados, erros: erros.slice(0, 5) } }).catch(() => {});
    return jsonResponse({ enviados, total_elegiveis: elegiveis.length, erros }, 200);

  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
