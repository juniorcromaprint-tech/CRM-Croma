// supabase/functions/whatsapp-webhook/index.ts
// v13 — Claude-powered WhatsApp auto-responder with full Croma context.
//   - Uses Claude (via OpenRouter) instead of generic GPT
//   - Rich system prompt with real product catalog, pricing, company info
//   - Queries database for lead history before responding
//   - Sends response directly to WhatsApp (no human approval needed)
//   - Notifies Junior on Telegram with what was said
//   - Escalation: detects complaints/urgency and notifies without auto-responding

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getServiceClient } from '../ai-shared/ai-helpers.ts';
import { callOpenRouter, setFallbackModel } from '../ai-shared/openrouter-provider.ts';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const TELEGRAM_BOT_TOKEN = '8750164337:AAH8Diet4zGJddKHq_F2F1JobUA2djisU8s';
const JUNIOR_CHAT_ID = '1065519625';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const CLAUDE_MODEL = 'anthropic/claude-sonnet-4';
const FALLBACK_MODEL = 'openai/gpt-4.1-mini';

// Palavras que indicam escalação (não responder automaticamente)
const ESCALATION_KEYWORDS = /\b(cancelar|cancelamento|reclamação|reclamar|insatisfeito|problema grave|advogado|procon|processo|jurídico|péssimo|horrível|nunca mais|devolver|reembolso)\b/i;

// ─────────────────────────────────────────────────────────────
// Phone normalization
// ─────────────────────────────────────────────────────────────
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 11 || digits.length === 10) return `55${digits}`;
  return digits;
}

function last10(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-10);
}

// ─────────────────────────────────────────────────────────────
// HMAC SHA-256 signature validation
// ─────────────────────────────────────────────────────────────
async function validateSignature(req: Request, rawBody: string): Promise<boolean> {
  let appSecret = Deno.env.get('WHATSAPP_APP_SECRET');
  if (!appSecret) {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from('admin_config')
      .select('valor')
      .eq('chave', 'WHATSAPP_APP_SECRET')
      .single();
    appSecret = data?.valor ?? null;
  }
  if (!appSecret) {
    console.warn('whatsapp-webhook: WHATSAPP_APP_SECRET not set — accepting without validation');
    return true;
  }

  const signature = req.headers.get('x-hub-signature-256');
  if (!signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const sigHex = 'sha256=' + Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0')).join('');

  return sigHex === signature;
}

// ─────────────────────────────────────────────────────────────
// Send Telegram notification
// ─────────────────────────────────────────────────────────────
async function notifyTelegram(text: string): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: JUNIOR_CHAT_ID,
        text,
        parse_mode: 'Markdown',
      }),
    });
  } catch (err) {
    console.error('whatsapp-webhook: Telegram notification failed:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// Send WhatsApp message via Meta Cloud API
// ─────────────────────────────────────────────────────────────
async function sendWhatsApp(
  supabase: ReturnType<typeof getServiceClient>,
  toPhone: string,
  message: string,
): Promise<boolean> {
  try {
    // Load credentials from admin_config
    const keys = ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_API_VERSION'];
    const { data: configs } = await supabase
      .from('admin_config')
      .select('chave, valor')
      .in('chave', keys);

    const cfg: Record<string, string> = {};
    for (const c of configs ?? []) cfg[c.chave] = c.valor;

    const token = cfg['WHATSAPP_ACCESS_TOKEN'];
    const phoneId = cfg['WHATSAPP_PHONE_NUMBER_ID'];
    const apiVersion = cfg['WHATSAPP_API_VERSION'] || 'v22.0';

    if (!token || !phoneId) {
      console.error('whatsapp-webhook: Missing WhatsApp credentials');
      return false;
    }

    const resp = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: toPhone,
          type: 'text',
          text: { body: message },
        }),
      }
    );

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error('whatsapp-webhook: WhatsApp send failed:', resp.status, errBody);
      return false;
    }

    console.log('whatsapp-webhook: WhatsApp message sent to', toPhone);
    return true;
  } catch (err) {
    console.error('whatsapp-webhook: WhatsApp send error:', err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Build Claude system prompt with full Croma context
// ─────────────────────────────────────────────────────────────
function buildCromaSystemPrompt(): string {
  return `Você é o vendedor consultivo da *Croma Print Comunicação Visual*, respondendo clientes via WhatsApp.

## SOBRE A EMPRESA
- Produção própria em Nova Hartz/RS, atendimento nacional
- Especialidade: redes de lojas, franquias, grandes varejistas
- Clientes de referência: Beira Rio, Renner, Paquetá
- 6 funcionários de produção, faturamento médio R$ 110.000/mês
- Responsável: Junior (dono)

## CATÁLOGO DE PRODUTOS (resumo)
- *Banners e Lonas*: diversos tamanhos (40x60 a 120x200cm), personalizado por m². Acabamentos: ilhós, bastão, corda
- *Fachadas/Revestimento ACM*: alumínio composto, alta durabilidade, projeto personalizado
- *Adesivos*: blackout, leitoso, perfurado, recorte eletrônico (1ª e 2ª linha)
- *Placas*: ACM, PS, PVC expandido, acrílico (branco e transparente)
- *Letras Caixa*: galvanizada, com/sem acrílico, diversos tamanhos
- *Luminosos*: caixa 1ª linha, frente acrílico + laterais ACM
- *Cavaletes*: madeira+lona, metálico (P/M/G, 1 ou 2 faces)
- *Totens ACM*: projeto personalizado
- *Material PDV*: displays, móbiles, precificadores, faixas de gôndola, bolsas PETG
- *Envelopamento veicular*
- *Cartões de visita*: 2ª linha, 1ª linha (laminação fosca + verniz), premium (hot stamping)
- *Corte em Router CNC*
- *Criação e Arte Final*
- *Serviços*: instalação, laminação, acabamentos especiais

## DIFERENCIAS
1. Produção própria = controle total de qualidade e prazo
2. Experiência com redes = padronização para múltiplas lojas
3. Atendimento personalizado = cada projeto é único
4. Desde o projeto até a instalação = solução completa

## REGRAS DE RESPOSTA
1. SEMPRE em português brasileiro, profissional mas caloroso
2. Máximo 2-3 parágrafos curtos (WhatsApp = tela pequena)
3. Use *negrito* para destaques importantes
4. Emojis com moderação (1-2 por mensagem)
5. NUNCA invente preços — diga que vai preparar um orçamento personalizado
6. Se o cliente pedir preço/orçamento → peça: produto, dimensões, quantidade, se precisa de arte/instalação
7. Se for saudação simples → apresente-se brevemente e pergunte como pode ajudar
8. Se for dúvida técnica → responda com expertise e redirecione para valor
9. Se já conversou antes (histórico) → NÃO repita perguntas já respondidas
10. Assine como "Junior - Croma Print" (o cliente fala com o Junior, não com IA)

## TRATAMENTO DE OBJEÇÕES
- "Muito caro" → fale sobre durabilidade, qualidade e ROI
- "Vou pensar" → ofereça ajuda com dúvidas e mencione prazo de produção
- "Já tenho fornecedor" → ofereça um projeto piloto sem compromisso
- "Não preciso agora" → pergunte sobre próxima campanha/sazonalidade

## HORÁRIO
- Comercial: 8h-18h (seg-sex)
- Fora do horário: responda normalmente mas mencione que detalhes técnicos serão confirmados no próximo dia útil

## FORMATO DA RESPOSTA
Responda APENAS o texto da mensagem que será enviada ao cliente. Sem JSON, sem metadata, sem explicações. Apenas o texto puro da resposta.`;
}

// ─────────────────────────────────────────────────────────────
// Generate Claude response with full context
// ─────────────────────────────────────────────────────────────
async function generateClaudeResponse(
  supabase: ReturnType<typeof getServiceClient>,
  lead: Record<string, unknown>,
  conversation: Record<string, unknown>,
  incomingMessage: string,
  contactName: string,
): Promise<string | null> {
  try {
    // Check API key
    let apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) {
      const { data: keyConfig } = await supabase
        .from('admin_config')
        .select('valor')
        .eq('chave', 'OPENROUTER_API_KEY')
        .single();
      if (!keyConfig?.valor) {
        console.log('whatsapp-webhook: OPENROUTER_API_KEY not set — skipping auto-response');
        return null;
      }
      Deno.env.set('OPENROUTER_API_KEY', keyConfig.valor as string);
    }

    setFallbackModel(FALLBACK_MODEL);

    // Load last 10 messages for context
    const { data: recentMsgs } = await supabase
      .from('agent_messages')
      .select('direcao, conteudo, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const historico = (recentMsgs ?? []).reverse().map((m: Record<string, unknown>) => {
      const who = m.direcao === 'recebida' ? 'CLIENTE' : 'CROMA';
      return `${who}: ${m.conteudo}`;
    }).join('\n');

    // Load full lead info
    const { data: fullLead } = await supabase
      .from('leads')
      .select('empresa, contato_nome, segmento, temperatura, observacoes, status')
      .eq('id', lead.id)
      .single();

    // Check if lead has existing orders
    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('id, numero, status, valor_total')
      .eq('cliente_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(3);

    // Build user prompt with all context
    const userPrompt = [
      `## DADOS DO LEAD`,
      `Nome: ${contactName || fullLead?.contato_nome || 'Não informado'}`,
      `Empresa: ${fullLead?.empresa || 'Não informada'}`,
      `Segmento: ${fullLead?.segmento || 'Não identificado'}`,
      `Temperatura: ${fullLead?.temperatura || 'morno'}`,
      `Status: ${fullLead?.status || 'novo'}`,
      fullLead?.observacoes ? `Observações: ${fullLead.observacoes}` : '',
      ``,
      pedidos && pedidos.length > 0 ? `## PEDIDOS ANTERIORES\n${pedidos.map((p: Record<string, unknown>) => `- Pedido #${p.numero}: ${p.status} (R$ ${p.valor_total})`).join('\n')}` : '## PEDIDOS ANTERIORES\nNenhum pedido anterior (lead novo)',
      ``,
      `## HISTÓRICO DA CONVERSA`,
      historico || '(primeira mensagem)',
      ``,
      `## MENSAGEM RECEBIDA AGORA`,
      incomingMessage,
      ``,
      `Responda como Junior da Croma Print. Texto puro, sem JSON.`,
    ].filter(Boolean).join('\n');

    const aiResult = await callOpenRouter(
      buildCromaSystemPrompt(),
      userPrompt,
      {
        model: CLAUDE_MODEL,
        temperature: 0.7,
        max_tokens: 500,
        text_mode: true,
      }
    );

    // Log AI usage
    await supabase.from('ai_logs').insert({
      function_name: 'auto-resposta-whatsapp',
      entity_type: 'geral',
      entity_id: lead.id as string,
      model_used: aiResult.model_used,
      tokens_input: aiResult.tokens_input,
      tokens_output: aiResult.tokens_output,
      cost_usd: aiResult.cost_usd,
      duration_ms: aiResult.duration_ms,
      status: 'success',
    });

    console.log(`whatsapp-webhook: Claude response generated (${aiResult.duration_ms}ms, $${aiResult.cost_usd.toFixed(4)})`);
    return aiResult.content.trim();
  } catch (err) {
    console.error('whatsapp-webhook: Claude response failed:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  const url = new URL(req.url);

  // ── GET: webhook verification ───────────────────────────────
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    let verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN');
    if (!verifyToken) {
      const supa = getServiceClient();
      const { data: vtData } = await supa.from('admin_config').select('valor').eq('chave', 'WHATSAPP_VERIFY_TOKEN').single();
      verifyToken = vtData?.valor ?? undefined;
    }

    if (mode === 'subscribe' && token === verifyToken && challenge) {
      console.log('whatsapp-webhook: verification OK');
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // ── POST: incoming message ──────────────────────────────────
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const rawBody = await req.text();

  const valid = await validateSignature(req, rawBody);
  if (!valid) {
    return new Response('Forbidden', { status: 403 });
  }

  let payload: Record<string, unknown>;
  try { payload = JSON.parse(rawBody); }
  catch { return new Response('Bad Request', { status: 400 }); }

  try {
    const entry = (payload?.entry as unknown[])?.[0] as Record<string, unknown> | undefined;
    const change = (entry?.changes as unknown[])?.[0] as Record<string, unknown> | undefined;
    const value = change?.value as Record<string, unknown> | undefined;

    if (!value) return new Response('OK', { status: 200 });

    const messages = value.messages as Record<string, unknown>[] | undefined;
    const contacts = value.contacts as Record<string, unknown>[] | undefined;

    if (!messages || messages.length === 0) return new Response('OK', { status: 200 });

    const message = messages[0];
    const contact = contacts?.[0];

    if (message.type !== 'text') {
      console.log('whatsapp-webhook: ignoring non-text message type', message.type);
      return new Response('OK', { status: 200 });
    }

    const fromPhone = message.from as string;
    const messageId = message.id as string;
    const textBody = (message.text as Record<string, string>)?.body ?? '';
    const contactName = (contact?.profile as Record<string, string>)?.name ?? '';
    const normalizedPhone = normalizePhone(fromPhone);

    const supabase = getServiceClient();
    const now = new Date().toISOString();
    const phoneSearch = last10(normalizedPhone);

    // ── 1. Find or create lead ──────────────────────────────
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('id, empresa, contato_nome, contato_telefone, status')
      .ilike('contato_telefone', `%${phoneSearch}%`)
      .limit(1);

    let lead = existingLeads?.[0] ?? null;
    let isNewLead = false;

    if (!lead) {
      const { data: newLead, error: leadErr } = await supabase
        .from('leads')
        .insert({
          empresa: contactName || `WhatsApp ${normalizedPhone}`,
          contato_nome: contactName || null,
          contato_telefone: normalizedPhone,
          status: 'novo',
          temperatura: 'morno',
          segmento: null,
        })
        .select('id, empresa, contato_nome, contato_telefone, status')
        .single();

      if (leadErr || !newLead) {
        console.error('whatsapp-webhook: failed to create lead', leadErr);
        return new Response('OK', { status: 200 });
      }
      lead = newLead;
      isNewLead = true;
    }

    // ── 2. Find or create conversation ──────────────────────
    const { data: convRows } = await supabase
      .from('agent_conversations')
      .select('id, status, mensagens_recebidas, score_engajamento')
      .eq('lead_id', lead.id)
      .eq('canal', 'whatsapp')
      .in('status', ['ativa', 'escalada'])
      .order('created_at', { ascending: false })
      .limit(1);

    let conversation = convRows?.[0] ?? null;

    if (!conversation) {
      const { data: newConv, error: convErr } = await supabase
        .from('agent_conversations')
        .insert({
          lead_id: lead.id,
          canal: 'whatsapp',
          status: 'ativa',
          etapa: 'abertura',
          mensagens_recebidas: 0,
          mensagens_enviadas: 0,
          score_engajamento: 0,
        })
        .select('id, status, mensagens_recebidas, score_engajamento')
        .single();

      if (convErr || !newConv) {
        console.error('whatsapp-webhook: failed to create conversation', convErr);
        return new Response('OK', { status: 200 });
      }
      conversation = newConv;
    }

    // ── 3. Deduplication ────────────────────────────────────
    {
      const { data: existing } = await supabase
        .from('agent_messages')
        .select('id')
        .eq('conversation_id', conversation.id)
        .eq('direcao', 'recebida')
        .contains('metadata', { whatsapp_message_id: messageId })
        .limit(1);

      if (existing && existing.length > 0) {
        return new Response('OK', { status: 200 });
      }
    }

    // ── 4. Save incoming message ────────────────────────────
    const preview = textBody.substring(0, 80) + (textBody.length > 80 ? '…' : '');

    await supabase.from('agent_messages').insert({
      conversation_id: conversation.id,
      direcao: 'recebida',
      canal: 'whatsapp',
      conteudo: textBody,
      status: 'respondida',
      metadata: {
        whatsapp_message_id: messageId,
        from_phone: fromPhone,
        contact_name: contactName,
      },
    });

    // ── 5. Update counters ──────────────────────────────────
    await supabase
      .from('agent_conversations')
      .update({
        mensagens_recebidas: (conversation.mensagens_recebidas ?? 0) + 1,
        ultima_mensagem_em: now,
        score_engajamento: (conversation.score_engajamento ?? 0) + 15,
      })
      .eq('id', conversation.id);

    // ── 6. Log activity ─────────────────────────────────────
    await supabase.from('atividades_comerciais').insert({
      entidade_tipo: 'lead',
      entidade_id: lead.id,
      tipo: 'whatsapp',
      descricao: `[WhatsApp] Mensagem recebida: ${preview}`,
      resultado: 'recebido',
      data_atividade: now,
    });

    // ── 7. Check for escalation ─────────────────────────────
    if (ESCALATION_KEYWORDS.test(textBody) || conversation.status === 'escalada') {
      // Don't auto-respond — escalate to Junior
      await supabase
        .from('agent_conversations')
        .update({ status: 'escalada' })
        .eq('id', conversation.id);

      const leadLabel = isNewLead ? '🆕 NOVO' : '⚠️';
      await notifyTelegram(
        `${leadLabel} *ESCALAÇÃO WhatsApp*\n\n` +
        `👤 *${contactName || 'Sem nome'}*\n` +
        `📞 +${normalizedPhone}\n\n` +
        `💬 ${textBody.substring(0, 300)}\n\n` +
        `⚠️ *Detectei reclamação/urgência — NÃO respondi automaticamente.*\n` +
        `_Responda manualmente via Cowork ou ERP_`
      );

      console.log('whatsapp-webhook: ESCALATED — not auto-responding');
      return new Response('OK', { status: 200 });
    }

    // ── 8. Generate Claude response ─────────────────────────
    const resposta = await generateClaudeResponse(
      supabase, lead, conversation, textBody, contactName,
    );

    if (!resposta) {
      // Claude failed — notify Junior to respond manually
      await notifyTelegram(
        `📱 *WhatsApp — ${isNewLead ? '🆕 NOVO LEAD' : '💬 MENSAGEM'}*\n\n` +
        `👤 *${contactName || 'Sem nome'}*\n` +
        `📞 +${normalizedPhone}\n\n` +
        `💬 ${textBody.substring(0, 300)}\n\n` +
        `⚠️ _Não consegui gerar resposta automática. Responda manualmente._`
      );
      return new Response('OK', { status: 200 });
    }

    // ── 9. Send response via WhatsApp ───────────────────────
    const sent = await sendWhatsApp(supabase, normalizedPhone, resposta);

    // ── 10. Save sent message ───────────────────────────────
    await supabase.from('agent_messages').insert({
      conversation_id: conversation.id,
      direcao: 'enviada',
      canal: 'whatsapp',
      conteudo: resposta,
      status: sent ? 'enviada' : 'erro',
      metadata: {
        auto_generated: true,
        sent_by: 'claude-whatsapp-v13',
        modelo_ia: CLAUDE_MODEL,
        sent_success: sent,
      },
    });

    // Update conversation counters
    await supabase
      .from('agent_conversations')
      .update({
        mensagens_enviadas: (conversation.mensagens_enviadas ?? 0) + 1,
      })
      .eq('id', conversation.id);

    // ── 11. Notify Junior on Telegram ───────────────────────
    const statusEmoji = sent ? '✅' : '❌';
    const truncResp = resposta.length > 200 ? resposta.substring(0, 200) + '…' : resposta;
    const truncMsg = textBody.length > 150 ? textBody.substring(0, 150) + '…' : textBody;

    await notifyTelegram(
      `🤖 *Auto-resposta WhatsApp* ${statusEmoji}\n\n` +
      `👤 *${contactName || 'Sem nome'}*${isNewLead ? ' (NOVO LEAD)' : ''}\n` +
      `📞 +${normalizedPhone}\n\n` +
      `💬 *Cliente:* ${truncMsg}\n\n` +
      `✍️ *Respondido:* ${truncResp}\n\n` +
      `_${sent ? 'Enviado com sucesso' : 'FALHA no envio — responda manualmente'}_`
    );

    console.log('whatsapp-webhook: Claude auto-response sent for lead', lead.id);
    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('whatsapp-webhook error:', err);
    return new Response('OK', { status: 200 });
  }
});
