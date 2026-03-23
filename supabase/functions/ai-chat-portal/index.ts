// ai-chat-portal: AI chat for the client portal
// Auth via share_token (no login required)
// Only answers about the specific proposal/order linked to the token
// Cannot: modify orders, give discounts, reveal margins

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ALLOWED_ORIGINS = [
  'https://crm-croma.vercel.app',
  'https://campo-croma.vercel.app',
  'http://localhost:8080',
  'http://localhost:8090',
  'http://localhost:5173',
];

function getCors(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

const SYSTEM_PROMPT = `Você é o assistente virtual da Croma Print Comunicação Visual.
Você está respondendo ao cliente que está visualizando sua proposta/pedido no portal.

REGRAS ABSOLUTAS:
- Só responda sobre o pedido/proposta do contexto fornecido
- NUNCA invente dados que não estejam no contexto
- NUNCA altere pedidos, dê descontos ou negocie preços
- NUNCA revele margens, custos internos ou markup
- NUNCA invente prazos que não estejam no contexto
- Se não souber, diga "Vou encaminhar sua dúvida para nosso time comercial"
- Seja cordial, profissional e conciso
- Responda em português brasileiro
- Se o cliente pedir algo que você não pode fazer (alterar pedido, desconto), diga educadamente que vai passar para o comercial

PODE:
- Informar status do pedido/proposta
- Explicar itens da proposta (descrição, quantidade, especificação)
- Informar formas de pagamento disponíveis
- Informar prazo de validade da proposta
- Explicar como funciona o processo (aprovação → produção → instalação)
- Responder dúvidas gerais sobre a Croma Print

FORMATO: Responda de forma direta e breve (máximo 3 parágrafos).`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCors(req) });
  }

  const cors = getCors(req);

  try {
    const body = await req.json();
    const { share_token, mensagem, historico } = body as {
      share_token: string;
      mensagem: string;
      historico: Message[];
    };

    if (!share_token || !mensagem) {
      return new Response(
        JSON.stringify({ error: 'share_token e mensagem são obrigatórios' }),
        { status: 400, headers: cors }
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ── 1. Fetch proposal data via token ──────────────────────────────
    const { data: proposta, error: propError } = await supabase
      .rpc('portal_get_proposta', { p_token: share_token });

    if (propError || !proposta) {
      return new Response(
        JSON.stringify({ error: 'Proposta não encontrada' }),
        { status: 404, headers: cors }
      );
    }

    // ── 2. Fetch related order if exists ──────────────────────────────
    let pedidoInfo = '';
    if (proposta.id) {
      const { data: pedido } = await supabase
        .from('pedidos')
        .select('numero, status, data_prometida, valor_total')
        .eq('proposta_id', proposta.id)
        .is('excluido_em', null)
        .single();

      if (pedido) {
        const statusMap: Record<string, string> = {
          rascunho: 'Em preparação',
          aprovado: 'Aprovado',
          em_producao: 'Em produção',
          produzido: 'Produção concluída',
          aguardando_instalacao: 'Aguardando instalação',
          em_instalacao: 'Em instalação',
          concluido: 'Concluído',
          faturado: 'Faturado',
          entregue: 'Entregue',
        };
        pedidoInfo = `\n\nPEDIDO VINCULADO:
- Número: ${pedido.numero}
- Status: ${statusMap[pedido.status] ?? pedido.status}
- Prazo prometido: ${pedido.data_prometida ?? 'Não definido'}
- Valor total: R$ ${Number(pedido.valor_total ?? 0).toFixed(2)}`;
      }
    }

    // ── 3. Build context ──────────────────────────────────────────────
    const itensStr = (proposta.itens ?? [])
      .map((item: any, i: number) =>
        `${i + 1}. ${item.descricao} — Qtd: ${item.quantidade}, Valor: R$ ${Number(item.valor_total ?? 0).toFixed(2)}${item.especificacao ? ` (${item.especificacao})` : ''}`
      )
      .join('\n');

    const contexto = `PROPOSTA #${proposta.numero ?? '—'}
- Cliente: ${proposta.cliente?.nome_fantasia ?? proposta.cliente?.contato_nome ?? '—'}
- Status: ${proposta.status}
- Valor total: R$ ${Number(proposta.valor_total ?? 0).toFixed(2)}
- Forma de pagamento: ${proposta.forma_pagamento ?? 'A definir'}
- Validade: ${proposta.data_validade ?? 'Não definida'}
- Criada em: ${proposta.created_at?.slice(0, 10) ?? '—'}

ITENS:
${itensStr || 'Nenhum item'}${pedidoInfo}`;

    // ── 4. Call OpenRouter ────────────────────────────────────────────
    const { data: configRows } = await supabase
      .from('admin_config')
      .select('valor')
      .eq('chave', 'OPENROUTER_API_KEY')
      .single();

    const apiKey = configRows?.valor as string;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ resposta: 'Chat indisponível no momento. Entre em contato conosco por WhatsApp ou e-mail.', tipo: 'info' }),
        { status: 200, headers: cors }
      );
    }

    const messages = [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\nCONTEXTO DO PEDIDO:\n${contexto}` },
      ...(historico ?? []).slice(-8).map((m: Message) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: mensagem },
    ];

    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://crm-croma.vercel.app',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4.1-mini',
        messages,
        max_tokens: 500,
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      return new Response(
        JSON.stringify({ resposta: 'Desculpe, não consegui processar sua pergunta. Tente novamente.', tipo: 'info' }),
        { status: 200, headers: cors }
      );
    }

    const aiData = await aiResponse.json();
    const resposta = aiData.choices?.[0]?.message?.content ?? 'Desculpe, não entendi. Pode reformular?';

    // Detect if response suggests escalation
    const tipo = resposta.toLowerCase().includes('comercial') || resposta.toLowerCase().includes('encaminhar')
      ? 'acao_necessaria'
      : 'info';

    // ── 5. Log usage ─────────────────────────────────────────────────
    await supabase.from('ai_logs').insert({
      funcao: 'chat-portal',
      tokens_usados: aiData.usage?.total_tokens ?? 0,
      custo: 0,
      metadata: {
        share_token: share_token.slice(0, 8) + '...',
        tipo,
        modelo: 'gpt-4.1-mini',
      },
    }).catch(() => {});

    return new Response(
      JSON.stringify({ resposta, tipo }),
      { status: 200, headers: cors }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: getCors(req) }
    );
  }
});
