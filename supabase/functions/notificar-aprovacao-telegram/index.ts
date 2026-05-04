// notificar-aprovacao-telegram v1
// Chamada via pg_net quando cliente aprova proposta no portal.
// Envia mensagem formatada pro Telegram do Junior.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEGRAM_TOKEN = '8750164337:AAH8Diet4zGJddKHq_F2F1JobUA2djisU8s';
const JUNIOR_CHAT_ID = 1065519625;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

interface Payload {
  proposta_id: string;
  proposta_numero: string;
  cliente_id: string | null;
  valor_total: number;
  comentario_cliente: string | null;
}

async function sendTelegram(text: string) {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: JUNIOR_CHAT_ID,
      text,
      parse_mode: 'HTML',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('Telegram send failed:', err);
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200 });

  // Validar secret header (pg_net envia isso)
  const authHeader = req.headers.get('x-webhook-secret');
  if (authHeader !== 'croma-aprovacao-2026') {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const payload: Payload = await req.json();
    const { proposta_id, proposta_numero, cliente_id, valor_total, comentario_cliente } = payload;

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Buscar nome do cliente
    let clienteNome = 'Cliente não identificado';
    if (cliente_id) {
      const { data: cli } = await db
        .from('clientes')
        .select('nome_fantasia, razao_social')
        .eq('id', cliente_id)
        .single();
      if (cli) clienteNome = cli.nome_fantasia || cli.razao_social || clienteNome;
    }

    // Verificar se tem arquivos anexados (bucket job-attachments, pasta proposta-previews)
    const { data: files } = await db.storage
      .from('job-attachments')
      .list(`proposta-previews/${proposta_id.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40)}`);

    // Tentar via share_token também
    let totalArquivos = files?.length || 0;
    if (totalArquivos === 0) {
      const { data: prop } = await db
        .from('propostas')
        .select('share_token')
        .eq('id', proposta_id)
        .single();
      if (prop?.share_token) {
        const token = String(prop.share_token).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40);
        const { data: filesToken } = await db.storage
          .from('job-attachments')
          .list(`proposta-previews/${token}`);
        totalArquivos = filesToken?.length || 0;
      }
    }

    const arquivosStatus = totalArquivos > 0
      ? `\u2705 ${totalArquivos} arquivo(s) enviado(s)`
      : '\u26A0\uFE0F Nenhum arquivo enviado ainda';

    const valorFormatado = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor_total || 0);

    const msg = [
      '\u2705 <b>ORCAMENTO APROVADO PELO CLIENTE!</b>',
      '',
      `<b>Proposta:</b> ${proposta_numero}`,
      `<b>Cliente:</b> ${clienteNome}`,
      `<b>Valor:</b> ${valorFormatado}`,
      `<b>Arquivos:</b> ${arquivosStatus}`,
      comentario_cliente ? `\n<b>Comentario:</b> ${comentario_cliente}` : '',
      '',
      'Pedido gerado automaticamente no CRM.',
      'Acesse o sistema para dar continuidade.',
    ].filter(Boolean).join('\n');

    await sendTelegram(msg);

    // Logar na tabela de notificacoes tambem
    await db.from('notifications').insert({
      user_id: null,
      tipo: 'aprovacao_cliente_telegram',
      titulo: `Cliente aprovou ${proposta_numero}`,
      mensagem: `${clienteNome} - ${valorFormatado} - ${arquivosStatus}`,
      entidade_tipo: 'proposta',
      entidade_id: proposta_id,
    }).select().single();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Erro notificar-aprovacao-telegram:', err);
    // Tenta avisar Junior mesmo em erro
    try {
      await sendTelegram(`\u26A0\uFE0F Erro na notificacao de aprovacao: ${String(err).slice(0, 200)}`);
    } catch {}
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
