// ai-requests-fallback-watchdog v1 (2026-05-22 — Etapa 2.4 ponte Cowork)
// pg_cron */5min → busca ai_requests tipo='whatsapp-resposta' status IN ('pending','processing')
// AND created_at < now()-5min AND fallback_used NOT TRUE.
// Pra cada (até 3 por execução): chama Anthropic API Sonnet 4 → INSERT agent_messages aprovada
// (metadata.manual=true pra bypass janela horária — é fallback de emergência) → POST whatsapp-enviar
// → marca completed. Telegram alert no primeiro acionamento de cada janela 1h.
// INDEPENDENTE do Cowork: se Cowork cair, esta função continua respondendo via API.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const JUNIOR_CHAT_ID = '1065519625';
const FALLBACK_MODEL = 'claude-sonnet-4-20250514';
const MAX_PER_RUN = 3;
const STALE_MINUTES = 5;

let _telegramTokenCache: string | null = null;
async function getTelegramToken(supabase: any): Promise<string> {
  if (_telegramTokenCache !== null) return _telegramTokenCache;
  let token = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
  if (!token) {
    const { data } = await supabase.from('admin_config').select('valor').eq('chave', 'TELEGRAM_BOT_TOKEN').single();
    token = data?.valor ?? '';
  }
  _telegramTokenCache = token;
  return token;
}

async function pickStale(supabase: any): Promise<any[]> {
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('ai_requests')
    .select('id, tipo, entity_id, contexto, status, created_at, metadata')
    .eq('tipo', 'whatsapp-resposta')
    .in('status', ['pending', 'processing'])
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(MAX_PER_RUN);
  return (data ?? []).filter((r: any) => {
    const fu = r.metadata?.fallback_used;
    return fu !== true && fu !== 'true';
  });
}

async function notifyTelegram(supabase: any, message: string) {
  try {
    const token = await getTelegramToken(supabase);
    if (!token) {
      console.log('watchdog: TELEGRAM_BOT_TOKEN nao configurado, pulando alert');
      return;
    }
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: JUNIOR_CHAT_ID, text: message, parse_mode: 'Markdown' }),
    });
  } catch (err) {
    console.error('telegram notify failed:', err);
  }
}

async function gerarRespostaAnthropic(ctx: any): Promise<{ text: string; tokens_in: number; tokens_out: number; cost_usd: number } | null> {
  if (!ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set — cannot fallback');
    return null;
  }
  const systemPrompt = [
    'Voce e atendente da Croma Print (comunicacao visual). Responda em pt-BR natural, 1-3 paragrafos curtos.',
    'Nunca invente preco/prazo/dado. Se cliente pede orcamento e faltam dados (nome completo, email, empresa, cidade/estado), peca esses dados ANTES.',
    'Pagamento APENAS: PIX CNPJ 18.923.994/0001-83 | Email: junior@cromaprint.com.br.',
    'Se cliente pede falar com humano: responda "Vou chamar alguem da equipe pra te atender."',
    'Assina "Croma" (nao "Claude" nem "IA"). Esta resposta vem do WATCHDOG (fallback) — ponte Cowork esta lenta. Resposta deve ser curta e direta.',
  ].join(' ');
  const userPrompt = `Contexto:\nContato: ${ctx.contact_name ?? 'sem nome'}\nMensagem: ${ctx.text_body ?? ''}\n\nResponda em pt-BR.`;

  const t0 = Date.now();
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: FALLBACK_MODEL,
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!resp.ok) {
    console.error('anthropic api failed:', resp.status, await resp.text());
    return null;
  }
  const data = await resp.json();
  const text = (data.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
  const tokens_in = data.usage?.input_tokens ?? 0;
  const tokens_out = data.usage?.output_tokens ?? 0;
  const cost_usd = (tokens_in * 3.00 + tokens_out * 15.00) / 1_000_000;
  console.log(`anthropic fallback: ${Date.now() - t0}ms, ${tokens_in}/${tokens_out} tokens, $${cost_usd.toFixed(4)}`);
  return { text, tokens_in, tokens_out, cost_usd };
}

async function processOne(supabase: any, req: any): Promise<{ ok: boolean; reason: string; cost?: number }> {
  const ctx = req.contexto ?? {};
  const conversation_id = req.entity_id;
  if (!conversation_id) return { ok: false, reason: 'sem conversation_id' };

  const { data: existing } = await supabase
    .from('agent_messages')
    .select('id')
    .eq('conversation_id', conversation_id)
    .filter('metadata->>ai_request_id', 'eq', req.id)
    .limit(1)
    .maybeSingle();

  let messageId: string;
  let cost = 0;
  if (existing?.id) {
    messageId = existing.id;
    console.log(`watchdog: agent_messages ${messageId} ja existe pra ai_request ${req.id}, reusing`);
  } else {
    const gen = await gerarRespostaAnthropic(ctx);
    if (!gen) return { ok: false, reason: 'anthropic api falhou' };
    cost = gen.cost_usd;

    const { data: ins, error: insErr } = await supabase.from('agent_messages').insert({
      conversation_id,
      direcao: 'enviada',
      canal: 'whatsapp',
      conteudo: gen.text || 'Recebi sua mensagem! Em instantes te respondo.',
      status: 'aprovada',
      modelo_ia: FALLBACK_MODEL,
      custo_ia: gen.cost_usd,
      metadata: {
        ai_request_id: req.id,
        fallback_used: true,
        source: 'watchdog_anthropic_api',
        manual: true,
        replied_to_meta_message_id: ctx.message_id,
      },
    }).select('id').single();
    if (insErr || !ins?.id) return { ok: false, reason: `insert agent_messages: ${insErr?.message}` };
    messageId = ins.id;
  }

  const sendResp = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-enviar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ message_id: messageId }),
  });
  if (!sendResp.ok) {
    const body = await sendResp.text();
    return { ok: false, reason: `whatsapp-enviar ${sendResp.status}: ${body.substring(0, 200)}`, cost };
  }

  const { data: hasResp } = await supabase.from('ai_responses').select('id').eq('request_id', req.id).limit(1).maybeSingle();
  if (!hasResp) {
    await supabase.from('ai_responses').insert({
      request_id: req.id,
      conteudo: { text: 'fallback via anthropic api (watchdog)', fallback_used: true },
      summary: `[WATCHDOG] Cowork nao respondeu em ${STALE_MINUTES}min, fallback Anthropic acionado.`,
      model_used: `${FALLBACK_MODEL}-watchdog`,
      cost_usd: cost,
    });
  }
  await supabase.from('ai_requests').update({
    status: 'completed',
    processed_at: new Date().toISOString(),
    metadata: { ...(req.metadata ?? {}), fallback_used: true, watchdog_at: new Date().toISOString() },
  }).eq('id', req.id);

  return { ok: true, reason: 'ok', cost };
}

async function shouldNotifyTelegram(supabase: any): Promise<boolean> {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('ai_responses')
    .select('id')
    .eq('model_used', `${FALLBACK_MODEL}-watchdog`)
    .gt('created_at', cutoff)
    .limit(1);
  return !data || data.length === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const startTime = Date.now();

  try {
    const stale = await pickStale(supabase);
    if (stale.length === 0) {
      return new Response(JSON.stringify({ status: 'ok', processed: 0, message: 'nenhum stale' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    const willAlert = await shouldNotifyTelegram(supabase);
    const results: any[] = [];
    let totalCost = 0;
    for (const r of stale) {
      const out = await processOne(supabase, r);
      results.push({ id: r.id, ok: out.ok, reason: out.reason });
      if (out.cost) totalCost += out.cost;
    }

    if (willAlert) {
      const successCount = results.filter((r) => r.ok).length;
      const failCount = results.length - successCount;
      await notifyTelegram(supabase,
        `*Watchdog ativou* (fallback Anthropic)\n\n` +
        `Cowork nao respondeu ${STALE_MINUTES}min+ em ${stale.length} ai_requests.\n` +
        `Recuperados via API: ${successCount}\n` +
        (failCount > 0 ? `Falhas: ${failCount}\n` : '') +
        `Custo: $${totalCost.toFixed(4)}\n\n` +
        `_Verifica se Cowork desktop esta rodando._`
      );
    }

    return new Response(JSON.stringify({
      status: 'ok',
      processed: results.length,
      cost_usd: totalCost,
      duration_ms: Date.now() - startTime,
      results,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('watchdog error:', err);
    return new Response(JSON.stringify({ error: String((err as Error).message ?? err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
