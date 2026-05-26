// supabase/functions/briefing-beira-rio/index.ts
// =============================================================================
// BRIEFING BEIRA RIO — v10-referencia-prazo-logistica
//  - NOVO (v10): popula colunas dedicadas propostas.referencia, prazo_entrega_dias,
//    logistica (alem de manter no config_snapshot pra retrocompatibilidade).
//    referencia: deriva do store_hint/code do briefing (ex: "186958-1 Giseli")
//    prazo_entrega_dias: default 15 dias uteis (regra padrao Croma)
//    logistica: 'instalado' se Grande SP, 'frete' caso contrario
//    proposta_itens.imagem_url default NULL (preencher quando upload existir)
//  - v9: store no config_snapshot pra portal renderizar bloco Loja
//  - v8: param notify_chat_id; v7: lookupStore sem filtro cliente_id, force_store_id
// =============================================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VERSION = 'v10-referencia-prazo-logistica';
const BEIRA_RIO_CLIENTE_ID = 'af166ada-e01b-4197-b8c3-33410af325d1';
const JUNIOR_PROFILE_ID    = 'f91d20a9-9d75-4a2c-8a67-87abfd910cba';
const JUNIOR_CHAT_ID       = '1065519625';
const VIVIANE_CHAT_ID      = JUNIOR_CHAT_ID;
const PRAZO_ENTREGA_DIAS_DEFAULT = 15;

const GRANDE_SP = new Set<string>([
  'sao paulo','são paulo','osasco','guarulhos','santo andre','santo andré',
  'sao bernardo do campo','são bernardo do campo','sao caetano do sul',
  'são caetano do sul','diadema','maua','mauá','ribeirao pires','ribeirão pires',
  'rio grande da serra','taboao da serra','taboão da serra','embu das artes',
  'itapecerica da serra','cotia','caieiras','carapicuiba','carapicuíba',
  'barueri','jandira','itapevi','santana de parnaiba','santana de parnaíba',
  'pirapora do bom jesus','aruja','arujá','itaquaquecetuba','poa','poá',
  'ferraz de vasconcelos','suzano','mogi das cruzes','francisco morato',
  'franco da rocha','mairipora','mairiporã','embu-guacu','embu-guaçu',
  'juquitiba','sao lourenco da serra','são lourenço da serra',
]);
const AI_FALLBACK_TIMEOUT_MS = 15_000;
const AI_GERAR_TIMEOUT_MS    = 60_000;
const TELEGRAM_TIMEOUT_MS    = 10_000;

let _legacyJwt: string | null = null;
let _tgToken: string | null = null;

function getServiceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

async function getLegacyJwt(supabase: any, force = false): Promise<string> {
  if (_legacyJwt && !force) return _legacyJwt;
  const { data, error } = await supabase.rpc('get_service_role_legacy_jwt');
  if (error || !data) throw new Error(`legacy_jwt rpc falhou: ${error?.message || 'sem retorno'}`);
  _legacyJwt = data as string;
  return _legacyJwt!;
}

async function getTelegramToken(supabase: any): Promise<string | null> {
  if (_tgToken) return _tgToken;
  const fromEnv = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (fromEnv && fromEnv.length > 10) { _tgToken = fromEnv; return _tgToken; }
  try {
    const { data, error } = await supabase.rpc('get_telegram_bot_token');
    if (error) { console.error('[TELEGRAM] rpc get_telegram_bot_token err:', error.message); return null; }
    if (typeof data === 'string' && data.length > 10) { _tgToken = data; return _tgToken; }
    return null;
  } catch (err) {
    console.error('[TELEGRAM] rpc throw:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function logErr(ctx: string, err: unknown) {
  console.error(`briefing-beira-rio: [${ctx}]`, err instanceof Error ? err.stack || err.message : err);
}
function normalize(s: string | null | undefined): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}
function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseBriefing(texto: string) {
  const t = texto.replace(/\s+/g, ' ').trim();
  const codeMatch = t.match(/\b(\d{4,7}-\d{1,3})\b/);
  const code = codeMatch ? codeMatch[1] : null;
  const medidaMatch = t.match(/(\d+[.,]?\d*)\s*[x×]\s*(\d+[.,]?\d*)\s*(cm|m|mm)?/i);
  let largura_cm: number | null = null; let altura_cm: number | null = null;
  if (medidaMatch) {
    const a = parseFloat(medidaMatch[1].replace(',', '.'));
    const b = parseFloat(medidaMatch[2].replace(',', '.'));
    const unidade = (medidaMatch[3] || 'cm').toLowerCase();
    const fator = unidade === 'm' ? 100 : (unidade === 'mm' ? 0.1 : 1);
    largura_cm = a * fator; altura_cm = b * fator;
  }
  let quantidade: number | null = null;
  const qMatch1 = t.match(/\b(\d{1,4})\s*(un|und|pcs|pe[çc]as?)\b/i);
  const qMatch2 = t.match(/\bqtd[:\s]+(\d{1,4})\b/i);
  const qMatch3 = t.match(/\b(\d{1,4})\s*(?=ps\b|adesivo|banner|placa|blackout|lona|vinil)/i);
  if (qMatch1) quantidade = parseInt(qMatch1[1], 10);
  else if (qMatch2) quantidade = parseInt(qMatch2[1], 10);
  else if (qMatch3) quantidade = parseInt(qMatch3[1], 10);
  let produto: string | null = null;
  if (/\bps\s*1\s*mm\b/i.test(t)) produto = 'PS 1mm';
  else if (/\bps\b/i.test(t)) produto = 'PS';
  else if (/\bblackout\b/i.test(t)) produto = 'blackout';
  else if (/\badesivo(\s+vitrine)?\b/i.test(t)) produto = 'adesivo';
  else if (/\bbanner\b/i.test(t)) produto = 'banner';
  else if (/\bplaca\b/i.test(t)) produto = 'placa';
  else if (/\b(lona|vinil)\b/i.test(t)) produto = 'lona';
  let store_hint: string | null = null;
  const lojaMatch = t.match(/loja\s+([^\-—,\n]{2,40})/i);
  if (lojaMatch) store_hint = lojaMatch[1].trim();
  const camposPreenchidos = (code ? 1 : 0) + (largura_cm ? 1 : 0) + (quantidade ? 1 : 0) + (produto ? 1 : 0);
  return { code, store_hint, produto, largura_cm, altura_cm, quantidade, camposPreenchidos, raw: t };
}

async function parseBriefingViaAI(texto: string) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return null;
  const system = `Voce extrai dados de briefings curtos. Responda APENAS JSON valido: { "code": "... ou null", "store_hint": "... ou null", "produto": "PS 1mm|adesivo|blackout|banner|placa|lona|null", "largura_cm": numero ou null, "altura_cm": numero ou null, "quantidade": numero ou null }. Sem markdown.`;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), AI_FALLBACK_TIMEOUT_MS);
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, system, messages: [{ role: 'user', content: texto }] }),
      signal: controller.signal,
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const raw = data.content?.[0]?.text ?? '';
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    return JSON.parse(m[0]);
  } catch { return null; }
  finally { clearTimeout(tid); }
}

// -----------------------------------------------------------------------------
// v10: deriva referencia (free-text) do briefing
//   Prioridade: code + store_hint > store_hint > store.code > store.name
// -----------------------------------------------------------------------------
function derivarReferencia(parsed: any, store: any): string | null {
  if (parsed?.code && parsed?.store_hint) return `${parsed.code} ${parsed.store_hint}`.trim();
  if (parsed?.store_hint) return String(parsed.store_hint).trim();
  if (parsed?.code) return String(parsed.code).trim();
  if (store?.code && store?.name) return `${store.code} ${store.name}`.trim();
  if (store?.name) return String(store.name).trim();
  return null;
}

async function lookupStore(supabase: any, code: string | null, hint: string | null) {
  if (code) {
    const { data: exact } = await supabase.from('stores')
      .select('id, code, name, corporate_name, address, neighborhood, city, state, zip_code, cliente_id, brand')
      .is('deleted_at', null)
      .ilike('code', `%${code}%`)
      .limit(5);
    if (exact && exact.length === 1) return { tier: 'code_exact', match: exact[0], options: exact };
    if (exact && exact.length > 1) {
      const beiraRio = exact.filter((s: any) =>
        s.cliente_id === BEIRA_RIO_CLIENTE_ID ||
        (s.corporate_name && /beira\s*rio/i.test(s.corporate_name))
      );
      if (beiraRio.length === 1) return { tier: 'code_exact_br_preferred', match: beiraRio[0], options: beiraRio };
      return { tier: 'code_ambiguous', match: null, options: exact };
    }
  }
  const { data: scope } = await supabase.from('stores')
    .select('id, code, name, corporate_name, address, neighborhood, city, state, zip_code, cliente_id, brand')
    .is('deleted_at', null)
    .or(`cliente_id.eq.${BEIRA_RIO_CLIENTE_ID},corporate_name.ilike.%beira rio%`);
  const todas = scope || [];
  if (todas.length === 0) return { tier: 'none', match: null, options: [] };
  const needle = normalize(hint || code || '');
  if (!needle) return { tier: 'no_hint', match: null, options: todas.slice(0, 5) };
  const scored = todas.map((s: any) => {
    const haystack = normalize(`${s.name || ''} ${s.corporate_name || ''} ${s.code || ''} ${s.address || ''}`);
    let score = 0;
    if (haystack.includes(needle)) score += 0.6;
    const needleTokens = needle.split(' ').filter((x: string) => x.length >= 3);
    const hayTokens = new Set(haystack.split(' ').filter((x: string) => x.length >= 3));
    let hits = 0;
    for (const t of needleTokens) if (hayTokens.has(t)) hits++;
    if (needleTokens.length > 0) score += 0.4 * (hits / needleTokens.length);
    return { store: s, score };
  });
  scored.sort((a: any, b: any) => b.score - a.score);
  const best = scored[0]; const second = scored[1];
  if (best.score >= 0.6 && (!second || best.score - second.score >= 0.2)) return { tier: 'fuzzy_strong', match: best.store, options: [best.store] };
  if (best.score >= 0.4) return { tier: 'fuzzy_ambiguous', match: null, options: scored.slice(0, 3).map((x: any) => x.store) };
  return { tier: 'no_match', match: null, options: scored.slice(0, 3).map((x: any) => x.store) };
}

function decidirInstalacao(store: any) {
  const cidade = normalize(store?.city);
  if (cidade && GRANDE_SP.has(cidade)) return { tipo: 'instalada', frete_estimado_min: 0, observacao: 'instalacao local (Grande SP)', logistica: 'instalado' };
  return { tipo: 'instalada_com_frete', frete_estimado_min: 400, observacao: 'cotar frete real apos aprovacao', logistica: 'frete' };
}

async function telegramSendMessage(supabase: any, chatId: string, text: string, replyMarkup?: any, suppress = false) {
  if (suppress) {
    console.log('[TELEGRAM] suppressed by request flag');
    return { ok: true, suppressed: true };
  }
  const token = await getTelegramToken(supabase);
  if (!token) {
    console.error('[TELEGRAM] FATAL: token nao disponivel (env+vault)');
    return { ok: false, reason: 'no_token' };
  }
  console.log(`[TELEGRAM] sending chat_id=${chatId} len=${text.length} kb=${!!replyMarkup} tokenLen=${token.length}`);
  async function attempt(useMarkdown: boolean) {
    const body: any = { chat_id: chatId, text };
    if (useMarkdown) body.parse_mode = 'Markdown';
    if (replyMarkup) body.reply_markup = replyMarkup;
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body), signal: controller.signal,
      });
      const respText = await r.text();
      console.log(`[TELEGRAM] status=${r.status} md=${useMarkdown} resp=${respText.slice(0, 300)}`);
      return { ok: r.ok, status: r.status, body: respText };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[TELEGRAM] fetch FAILED md=${useMarkdown} err=${msg}`);
      return { ok: false, status: 0, body: msg, error: true as const };
    } finally { clearTimeout(tid); }
  }
  let res = await attempt(true);
  if (!res.ok && res.status === 400) {
    console.warn('[TELEGRAM] 400 Markdown — retry plain');
    res = await attempt(false);
  }
  return res;
}

function buildShadowCard(opts: any) {
  const txt = `*BRIEFING BEIRA RIO — SHADOW*\n\n*Proposta:* ${opts.numero}\n*Ref:* ${opts.referencia || '—'}\n*Loja:* ${opts.loja}\n*Produto:* ${opts.quantidade}x ${opts.produto}\n*Medida:* ${opts.medida}\n*Logistica:* ${opts.logistica}\n*Prazo:* ${opts.prazoEntrega}d uteis\n*Total:* ${brl(opts.total)}\n\n_Modo SHADOW: nada enviado ao cliente._`;
  const kb = { inline_keyboard: [[
    { text: 'Aprovar + Enviar', callback_data: `brio:approve:${opts.propostaId}` },
    { text: 'Editar', callback_data: `brio:edit:${opts.propostaId}` },
    { text: 'Cancelar', callback_data: `brio:cancel:${opts.propostaId}` },
  ]] };
  return { text: txt, reply_markup: kb };
}

function buildAmbiguousCard(briefing: string, options: any[]) {
  const lines = options.map((s: any, i: number) => `${i + 1}. *${s.name}* ${s.code ? `(${s.code})` : ''} — ${s.city || '?'}/${s.state || '?'}`);
  const txt = `*BRIEFING BEIRA RIO — LOJA AMBIGUA*\n\n_Briefing:_ "${briefing.slice(0, 220)}"\n\nOpcoes:\n` + lines.join('\n');
  const kb = { inline_keyboard: options.slice(0, 3).map((s: any, i: number) => [{ text: `${i + 1}. ${s.name}`, callback_data: `brio:pickstore:${s.id}` }]) };
  return { text: txt, reply_markup: kb };
}

async function callAiGerarOrcamento(supabase: any, payload: any) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  let jwt = await getLegacyJwt(supabase);
  const doFetch = async (token: string) => {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), AI_GERAR_TIMEOUT_MS);
    try {
      const r = await fetch(`${supabaseUrl}/functions/v1/ai-gerar-orcamento`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: controller.signal,
      });
      const txt = await r.text();
      let parsed: any = null;
      try { parsed = JSON.parse(txt); } catch { parsed = { raw: txt }; }
      return { ok: r.ok, status: r.status, body: parsed };
    } finally { clearTimeout(tid); }
  };
  let res = await doFetch(jwt);
  if (res.status === 401) {
    console.warn('[ai-gerar-call] 401 com JWT cached — refetch do vault');
    jwt = await getLegacyJwt(supabase, true);
    res = await doFetch(jwt);
  }
  console.log('[ai-gerar-call] final status:', res.status);
  return res;
}

async function alreadyProcessed(supabase: any, whatsappMessageId: string | null) {
  if (!whatsappMessageId) return null;
  const { data } = await supabase.from('ai_requests').select('id, entity_id, contexto, status')
    .eq('tipo', 'briefing_beira_rio_shadow')
    .filter('contexto->>whatsapp_message_id', 'eq', whatsappMessageId).limit(1).maybeSingle();
  return data;
}

async function logAiRequest(supabase: any, fields: any) {
  try {
    await supabase.from('ai_requests').insert({
      tipo: 'briefing_beira_rio_shadow', entity_type: 'proposta', entity_id: fields.entity_id,
      contexto: fields.contexto, status: fields.status, solicitante_id: JUNIOR_PROFILE_ID,
      processed_at: fields.status === 'pending' ? null : new Date().toISOString(),
      error_message: fields.error_message ?? null,
    });
  } catch (err) { logErr('logAiRequest', err); }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200 });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  console.log(`[briefing-beira-rio ${VERSION}] request received`);
  const supabase = getServiceClient();
  let payload: any = {};
  try { payload = await req.json(); } catch { return json({ ok: false, error: 'invalid json' }, 200); }
  const briefing: string = payload?.briefing || payload?.message_text || '';
  const sender = payload?.sender || { wa_id: payload?.from_phone, profile_name: 'Smoketest' };
  const whatsappMessageId: string | null = payload?.whatsapp_message_id || null;
  const force_store_id: string | null = payload?.force_store_id || null;
  const suppress_telegram: boolean = payload?.suppress_telegram === true;
  const notify_chat_id: string | null = payload?.notify_chat_id ? String(payload.notify_chat_id) : null;

  if (!briefing || typeof briefing !== 'string' || briefing.length < 5) {
    await telegramSendMessage(supabase, notify_chat_id || JUNIOR_CHAT_ID, `BRIEFING BEIRA RIO\nIgnorado — briefing vazio.`, undefined, suppress_telegram);
    return json({ ok: false, reason: 'empty_briefing' }, 200);
  }
  try {
    const dup = await alreadyProcessed(supabase, whatsappMessageId);
    if (dup) {
      console.log(`[briefing-beira-rio ${VERSION}] IDEMPOTENT wamid=${whatsappMessageId} ai_request=${dup.id}`);
      return json({ ok: true, idempotent: true, ai_request_id: dup.id, proposta_id: dup.entity_id }, 200);
    }
  } catch (err) { logErr('idempotencia', err); }
  try {
    let parsed: any = parseBriefing(briefing);
    if (parsed.camposPreenchidos < 2) {
      const ai = await parseBriefingViaAI(briefing);
      if (ai) parsed = { ...parsed, code: ai.code ?? parsed.code, store_hint: ai.store_hint ?? parsed.store_hint, produto: ai.produto ?? parsed.produto, largura_cm: ai.largura_cm ?? parsed.largura_cm, altura_cm: ai.altura_cm ?? parsed.altura_cm, quantidade: ai.quantidade ?? parsed.quantidade };
    }
    if (!parsed.produto) parsed.produto = 'PS 1mm';
    if (!parsed.quantidade) parsed.quantidade = 1;
    if (!parsed.largura_cm || !parsed.altura_cm) { parsed.largura_cm = parsed.largura_cm || 50; parsed.altura_cm = parsed.altura_cm || 70; }

    let store: any = null;
    let lookup_tier: string = '';
    let lookup_options: any[] = [];

    if (force_store_id) {
      const { data: forced, error: forcedErr } = await supabase.from('stores')
        .select('id, code, name, corporate_name, address, neighborhood, city, state, zip_code, cliente_id, brand')
        .eq('id', force_store_id)
        .is('deleted_at', null)
        .maybeSingle();
      if (forcedErr || !forced) {
        await logAiRequest(supabase, { entity_id: null, status: 'error', contexto: { whatsapp_message_id: whatsappMessageId, briefing, parsed, force_store_id, sender, shadow: true, outcome: 'force_store_id_not_found' }, error_message: `force_store_id ${force_store_id} nao encontrado` });
        return json({ ok: false, reason: 'force_store_id_not_found', force_store_id }, 200);
      }
      store = forced;
      lookup_tier = 'forced';
      lookup_options = [forced];
      console.log(`[briefing-beira-rio ${VERSION}] FORCED store=${store.id} name=${store.name}`);
    } else {
      const lookup = await lookupStore(supabase, parsed.code, parsed.store_hint);
      lookup_tier = lookup.tier;
      lookup_options = lookup.options;
      if (!lookup.match) {
        const card = buildAmbiguousCard(briefing, lookup.options);
        const tgRes = await telegramSendMessage(supabase, notify_chat_id || VIVIANE_CHAT_ID, card.text, card.reply_markup, suppress_telegram);
        await logAiRequest(supabase, { entity_id: null, status: 'completed', contexto: { whatsapp_message_id: whatsappMessageId, briefing, parsed, lookup_tier, sender, shadow: true, outcome: 'ambiguous_store_no_proposta', telegram: tgRes, notify_chat_id } });
        return json({ ok: true, outcome: 'ambiguous_store', tier: lookup_tier, telegram: tgRes }, 200);
      }
      store = lookup.match;
    }

    const instalacao = decidirInstalacao(store);
    const referencia = derivarReferencia(parsed, store);
    const logistica = instalacao.logistica; // 'instalado' | 'frete'
    const prazoEntrega = PRAZO_ENTREGA_DIAS_DEFAULT;

    const { data: leadRow, error: leadErr } = await supabase.from('leads').insert({
      empresa: `[BRIEFING-INT] Beira Rio - ${store.name}`,
      contato_nome: sender?.profile_name || 'Viviane', telefone: sender?.wa_id || null,
      status: 'novo', segmento: 'briefing_interno', origens: 'briefing_beira_rio_shadow',
      observacoes: `BRIEFING SHADOW — ${briefing}`,
    }).select('id, empresa').single();
    if (leadErr || !leadRow) throw new Error(`lead: ${leadErr?.message || 'sem retorno'}`);
    const { data: convRow, error: convErr } = await supabase.from('agent_conversations').insert({
      lead_id: leadRow.id, canal: 'whatsapp', status: 'ativa', etapa: 'proposta',
      metadata: { briefing_interno: true, source: 'briefing_beira_rio_shadow' }, automacao_pausada: true,
    }).select('id').single();
    if (convErr || !convRow) throw new Error(`conv: ${convErr?.message || 'sem retorno'}`);
    const descricaoSintetica = `Preciso de ${parsed.quantidade}x ${parsed.produto} ${parsed.largura_cm}x${parsed.altura_cm} cm para a loja ${store.name}` + (instalacao.tipo === 'instalada' ? ' com instalacao local.' : ' com instalacao + frete.');
    await supabase.from('agent_messages').insert({
      conversation_id: convRow.id, direcao: 'recebida', canal: 'whatsapp', conteudo: descricaoSintetica,
      status: 'recebida', metadata: { briefing_original: briefing, briefing_interno: true },
    });
    const aiResp = await callAiGerarOrcamento(supabase, {
      conversation_id: convRow.id, lead_id: leadRow.id, canal: 'whatsapp',
      mensagens: [{ direcao: 'recebida', conteudo: descricaoSintetica }],
    });
    if (!aiResp.ok || aiResp.body?.status !== 'proposta_criada') throw new Error(`ai-gerar-orcamento falhou: status=${aiResp.status} body=${JSON.stringify(aiResp.body).slice(0, 400)}`);
    const propostaId: string = aiResp.body.proposta_id;
    const propostaNumero: string = aiResp.body.proposta_numero;
    const total: number = Number(aiResp.body.total || 0);
    const { data: propAtual } = await supabase.from('propostas').select('config_snapshot, observacoes_internas').eq('id', propostaId).single();
    const novoConfig = {
      ...(propAtual?.config_snapshot || {}), shadow_awaiting_approval: true, shadow_source: 'briefing_beira_rio',
      shadow_created_at: new Date().toISOString(),
      store: { id: store.id, code: store.code, name: store.name, brand: store.brand ?? null, address: store.address ?? null, neighborhood: store.neighborhood ?? null, city: store.city, state: store.state, zip_code: store.zip_code },
      instalacao,
      referencia,
      prazo_entrega_dias: prazoEntrega,
      logistica,
      briefing_original: briefing, parsed, lookup_tier,
    };
    const observacoesInternas = (propAtual?.observacoes_internas ? propAtual.observacoes_internas + '\n\n' : '') +
      `[BRIEFING SHADOW Beira Rio - ${new Date().toISOString()}] Loja: ${store.name} (${store.id}). MODO SHADOW. tier=${lookup_tier} ref=${referencia} log=${logistica} prazo=${prazoEntrega}d`;
    const { error: updErr } = await supabase.from('propostas').update({
      cliente_id: BEIRA_RIO_CLIENTE_ID, config_snapshot: novoConfig, observacoes_internas: observacoesInternas,
      cliente_nome_snapshot: 'CALCADOS BEIRA RIO S/A',
      referencia, prazo_entrega_dias: prazoEntrega, logistica,
    }).eq('id', propostaId).select().single();
    if (updErr) logErr('update-proposta-shadow', updErr);
    try {
      await supabase.from('agent_messages').update({ status: 'cancelado', erro_mensagem: 'briefing-beira-rio SHADOW' })
        .eq('conversation_id', convRow.id).eq('status', 'pendente_aprovacao');
    } catch (err) { logErr('cancel-pendentes', err); }
    const card = buildShadowCard({ numero: propostaNumero, loja: `${store.name}${store.code ? ` (${store.code})` : ''}`, produto: parsed.produto, medida: `${parsed.largura_cm}x${parsed.altura_cm}cm`, quantidade: parsed.quantidade, logistica, prazoEntrega, referencia, total, propostaId });
    const tgRes = await telegramSendMessage(supabase, notify_chat_id || VIVIANE_CHAT_ID, card.text, card.reply_markup, suppress_telegram);
    console.log(`[briefing-beira-rio ${VERSION}] telegram final: ${JSON.stringify(tgRes).slice(0, 200)}`);
    await logAiRequest(supabase, { entity_id: propostaId, status: 'completed', contexto: { whatsapp_message_id: whatsappMessageId, briefing, parsed, lookup_tier, store_id: store.id, store_name: store.name, instalacao, referencia, logistica, prazo_entrega_dias: prazoEntrega, ai_gerar_response: aiResp.body, lead_id: leadRow.id, conversation_id: convRow.id, sender, shadow: true, telegram: tgRes, force_store_id, suppress_telegram, notify_chat_id } });
    try { await supabase.from('atividades_comerciais').insert({ tipo: 'briefing_recebido', entidade_tipo: 'proposta', entidade_id: propostaId, descricao: `Briefing SHADOW Beira Rio — Loja ${store.name} — ${parsed.quantidade}x ${parsed.produto} ${parsed.largura_cm}x${parsed.altura_cm}cm — ${brl(total)} (tier=${lookup_tier}, ref=${referencia}, log=${logistica})`, resultado: 'sucesso', autor_id: JUNIOR_PROFILE_ID, data_atividade: new Date().toISOString() }); } catch (err) { logErr('atividade', err); }
    return json({ ok: true, shadow: true, proposta_id: propostaId, proposta_numero: propostaNumero, total, lookup_tier, referencia, logistica, prazo_entrega_dias: prazoEntrega, telegram: tgRes }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logErr('global', err);
    await logAiRequest(supabase, { entity_id: null, status: 'error', contexto: { whatsapp_message_id: whatsappMessageId, briefing, sender, shadow: true, notify_chat_id }, error_message: msg });
    await telegramSendMessage(supabase, notify_chat_id || JUNIOR_CHAT_ID, `*BRIEFING BEIRA RIO — ERRO*\n\n*Erro:* \`${msg.slice(0, 400)}\``, undefined, suppress_telegram);
    return json({ ok: false, error: msg }, 200);
  }
});
