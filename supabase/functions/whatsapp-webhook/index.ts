// supabase/functions/whatsapp-webhook/index.ts
// Receives incoming WhatsApp messages from Meta Cloud API webhook.
// GET  → webhook verification challenge
// POST → incoming message handler + AI auto-response generation

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getServiceClient } from '../ai-shared/ai-helpers.ts';
import { callOpenRouter } from '../ai-shared/openrouter-provider.ts';

// ─────────────────────────────────────────────────────────────
// Phone normalization
// Strip non-digits; prepend 55 (Brazil) if no country code.
// ─────────────────────────────────────────────────────────────
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 11 || digits.length === 10) return `55${digits}`;
  return digits;
}

/** Last 10 digits for ILIKE search (ignores country code variations) */
function last10(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-10);
}

// ─────────────────────────────────────────────────────────────
// HMAC SHA-256 signature validation (X-Hub-Signature-256)
// ─────────────────────────────────────────────────────────────
async function validateSignature(req: Request, rawBody: string): Promise<boolean> {
  let appSecret = Deno.env.get('WHATSAPP_APP_SECRET');
  // Fallback: read from admin_config
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
    // If secret not configured, skip validation (dev mode)
    console.warn('whatsapp-webhook: WHATSAPP_APP_SECRET not set — skipping signature check');
    return true;
  }

  const signature = req.headers.get('x-hub-signature-256');
  if (!signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const sigHex = 'sha256=' + Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return sigHex === signature;
}

// ─────────────────────────────────────────────────────────────
// AI auto-response system prompt
// ─────────────────────────────────────────────────────────────
function buildAutoResponseSystemPrompt(): string {
  return `Voce e um vendedor consultivo da Croma Print Comunicacao Visual (www.cromaprint.com.br).
Producao propria de banners, faixas, adesivos, placas, totens, fachadas, paineis e materiais de comunicacao visual.
Atendimento nacional. Clientes: redes de lojas, franquias, fabricantes de calcados, grandes varejistas.

PERSONALIDADE: Profissional mas caloroso. Confiante e estrategico. Nunca pressiona, educa e gera valor.

CONTEXTO: Voce esta respondendo a uma MENSAGEM RECEBIDA do cliente via WhatsApp.
Analise o que o cliente disse e responda de forma natural e relevante.

REGRAS ABSOLUTAS:
- Responda SEMPRE em portugues brasileiro coloquial mas profissional
- Responda SEMPRE em JSON valido
- Maximo 3 paragrafos no campo "conteudo" (WhatsApp precisa ser curto)
- Use *negrito* para destaques (funciona no WhatsApp)
- Emojis com moderacao (1-2 no maximo)
- Sempre faca 1 pergunta inteligente ao final (mas apenas 1)
- NUNCA forneca preco sem antes diagnosticar a necessidade do cliente
- Se o cliente responde positivamente → avance a conversa
- Se o cliente faz pergunta → responda e redirecione para valor
- Se o cliente mostra objecao → trate com empatia e reformule

GATILHOS DE UPSELL:
- 1 banner → proponha kit campanha completo
- Fachada → sugira fachada + totem + adesivos
- 1 loja → pergunte sobre outras lojas da rede
- Pedido pontual → apresente contrato recorrente

TRATAMENTO DE OBJECOES:
- "Muito caro" → apresente ROI e durabilidade
- "Vou pensar" → gere urgencia real com prazo/campanha
- "Ja tenho fornecedor" → oferea piloto sem compromisso
- "Nao preciso agora" → pergunte sobre proxima campanha

ESTRUTURA DO JSON DE RESPOSTA (obrigatorio):
{
  "conteudo": "corpo da mensagem — texto puro, paragrafos separados por \\n\\n",
  "tom_detectado": "frio|morno|quente|neutro",
  "upsell_sugerido": "descricao do upsell mais relevante, ou null",
  "pergunta_feita": "a pergunta exata feita ao cliente",
  "etapa_sugerida": "abertura|followup1|followup2|followup3|proposta|negociacao"
}`;
}

// ─────────────────────────────────────────────────────────────
// Generate AI response for incoming message
// ─────────────────────────────────────────────────────────────
async function generateAutoResponse(
  supabase: ReturnType<typeof getServiceClient>,
  lead: Record<string, unknown>,
  conversation: Record<string, unknown>,
  incomingMessage: string,
): Promise<void> {
  try {
    // Check if OPENROUTER_API_KEY is available
    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) {
      // Check admin_config fallback
      const { data: keyConfig } = await supabase
        .from('admin_config')
        .select('valor')
        .eq('chave', 'OPENROUTER_API_KEY')
        .single();
      if (!keyConfig?.valor) {
        console.log('whatsapp-webhook: OPENROUTER_API_KEY not set — skipping auto-response');
        return;
      }
      // Set it for the callOpenRouter function
      Deno.env.set('OPENROUTER_API_KEY', keyConfig.valor as string);
    }

    // Check agent_config for auto-response settings
    const { data: configRow } = await supabase
      .from('admin_config')
      .select('valor')
      .eq('chave', 'agent_config')
      .single();

    let agentConfig: Record<string, unknown> = {};
    try {
      agentConfig = typeof configRow?.valor === 'string'
        ? JSON.parse(configRow.valor)
        : (configRow?.valor as Record<string, unknown>) ?? {};
    } catch { /* invalid JSON — use defaults */ }
    const canaisAtivos = (agentConfig.canais_ativos as string[]) ?? [];

    // Only generate if whatsapp channel is active
    if (!canaisAtivos.includes('whatsapp')) {
      console.log('whatsapp-webhook: whatsapp not in canais_ativos — skipping auto-response');
      return;
    }

    const modeloComposicao = (agentConfig.modelo_composicao as string) ?? 'openai/gpt-4.1-mini';
    const nomeRemetente = (agentConfig.nome_remetente as string) ?? 'Croma Print';

    // Load last 10 messages for context
    const { data: recentMsgs } = await supabase
      .from('agent_messages')
      .select('direcao, conteudo, status, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const historico = (recentMsgs ?? []).reverse();

    // Load full lead data
    const { data: fullLead } = await supabase
      .from('leads')
      .select('id, empresa, contato_nome, segmento, status, temperatura, valor_estimado, cargo, observacoes, score')
      .eq('id', lead.id)
      .single();

    // Load conversation details
    const { data: fullConv } = await supabase
      .from('agent_conversations')
      .select('etapa, mensagens_enviadas, mensagens_recebidas, score_engajamento, tentativas')
      .eq('id', conversation.id)
      .single();

    // Try to find a relevant template
    const etapaAtual = (fullConv?.etapa as string) ?? 'abertura';
    let template: { conteudo: string } | null = null;

    if (fullLead?.segmento) {
      const { data: tpl } = await supabase
        .from('agent_templates')
        .select('conteudo')
        .eq('canal', 'whatsapp')
        .eq('etapa', etapaAtual)
        .eq('segmento', fullLead.segmento)
        .eq('ativo', true)
        .limit(1)
        .single();
      template = tpl;
    }
    if (!template) {
      const { data: tpl } = await supabase
        .from('agent_templates')
        .select('conteudo')
        .eq('canal', 'whatsapp')
        .eq('etapa', etapaAtual)
        .is('segmento', null)
        .eq('ativo', true)
        .limit(1)
        .single();
      template = tpl;
    }

    // Build AI context
    const aiContext = {
      mensagem_recebida: incomingMessage,
      lead: {
        empresa: fullLead?.empresa,
        contato_nome: fullLead?.contato_nome,
        segmento: fullLead?.segmento,
        temperatura: fullLead?.temperatura,
        score: fullLead?.score,
        observacoes: fullLead?.observacoes,
      },
      conversa: {
        etapa: etapaAtual,
        mensagens_enviadas: fullConv?.mensagens_enviadas ?? 0,
        mensagens_recebidas: fullConv?.mensagens_recebidas ?? 0,
        score_engajamento: fullConv?.score_engajamento ?? 0,
      },
      historico_mensagens: historico,
      template_referencia: template?.conteudo ?? null,
      agente: { nome_remetente: nomeRemetente },
      data_atual: new Date().toISOString().split('T')[0],
    };

    // Call OpenRouter
    const aiResult = await callOpenRouter(
      buildAutoResponseSystemPrompt(),
      JSON.stringify(aiContext, null, 2),
      {
        model: modeloComposicao,
        temperature: 0.7,
        max_tokens: 800,
      }
    );

    // Parse response
    const aiData = JSON.parse(aiResult.content) as {
      conteudo: string;
      tom_detectado: string;
      upsell_sugerido: string | null;
      pergunta_feita: string;
      etapa_sugerida?: string;
    };

    // Replace template variables
    const conteudoFinal = aiData.conteudo
      .replace(/\{\{contato_nome\}\}/g, (fullLead?.contato_nome as string) ?? '')
      .replace(/\{\{empresa\}\}/g, (fullLead?.empresa as string) ?? '')
      .replace(/\{\{nome_remetente\}\}/g, nomeRemetente);

    // Save AI response as pendente_aprovacao
    await supabase.from('agent_messages').insert({
      conversation_id: conversation.id,
      direcao: 'enviada',
      canal: 'whatsapp',
      conteudo: conteudoFinal,
      status: 'pendente_aprovacao',
      custo_ia: aiResult.cost_usd,
      modelo_ia: aiResult.model_used,
      metadata: {
        tom_detectado: aiData.tom_detectado,
        upsell_sugerido: aiData.upsell_sugerido,
        pergunta_feita: aiData.pergunta_feita,
        etapa_sugerida: aiData.etapa_sugerida,
        tokens_input: aiResult.tokens_input,
        tokens_output: aiResult.tokens_output,
        duration_ms: aiResult.duration_ms,
        auto_generated: true,
      },
    });

    // Update conversation etapa if AI suggests progression
    if (aiData.etapa_sugerida && aiData.etapa_sugerida !== etapaAtual) {
      await supabase
        .from('agent_conversations')
        .update({ etapa: aiData.etapa_sugerida })
        .eq('id', conversation.id);
    }

    // Log AI call
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

    console.log('whatsapp-webhook: AI auto-response generated for lead', lead.id);
  } catch (err) {
    // Never fail the webhook due to AI errors
    console.error('whatsapp-webhook: AI auto-response failed (non-blocking):', err);
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
    // Fallback: read from admin_config
    if (!verifyToken) {
      const supa = getServiceClient();
      const { data: vtData } = await supa.from('admin_config').select('valor').eq('chave', 'WHATSAPP_VERIFY_TOKEN').single();
      verifyToken = vtData?.valor ?? undefined;
    }

    if (mode === 'subscribe' && token === verifyToken && challenge) {
      console.log('whatsapp-webhook: verification OK');
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    console.warn('whatsapp-webhook: verification FAILED', { mode, token });
    return new Response('Forbidden', { status: 403 });
  }

  // ── POST: incoming message ──────────────────────────────────
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Read raw body once (needed for signature check + JSON parse)
  const rawBody = await req.text();

  // Validate HMAC signature
  const valid = await validateSignature(req, rawBody);
  if (!valid) {
    console.warn('whatsapp-webhook: invalid signature');
    return new Response('Forbidden', { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  try {
    // Navigate Meta payload structure
    const entry = (payload?.entry as unknown[])?.[0] as Record<string, unknown> | undefined;
    const change = (entry?.changes as unknown[])?.[0] as Record<string, unknown> | undefined;
    const value = change?.value as Record<string, unknown> | undefined;

    if (!value) {
      // Not a message event we care about
      return new Response('OK', { status: 200 });
    }

    const messages = value.messages as Record<string, unknown>[] | undefined;
    const contacts = value.contacts as Record<string, unknown>[] | undefined;

    // Only process type='messages' — skip statuses (delivery receipts)
    if (!messages || messages.length === 0) {
      return new Response('OK', { status: 200 });
    }

    const message = messages[0];
    const contact = contacts?.[0];

    // Only handle text messages for now
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

    // ── 1. Find lead by phone ─────────────────────────────────
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('id, empresa, contato_nome, contato_telefone, status')
      .ilike('contato_telefone', `%${phoneSearch}%`)
      .limit(1);

    let lead = existingLeads?.[0] ?? null;

    // ── 2. Create lead if not found ───────────────────────────
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
        // Still return 200 — Meta must get 200 quickly
        return new Response('OK', { status: 200 });
      }

      lead = newLead;
      console.log('whatsapp-webhook: new lead created', lead.id);
    }

    // ── 3. Find or create active conversation ─────────────────
    const { data: convRows } = await supabase
      .from('agent_conversations')
      .select('id, mensagens_recebidas, score_engajamento')
      .eq('lead_id', lead.id)
      .eq('canal', 'whatsapp')
      .eq('status', 'ativa')
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
        .select('id, mensagens_recebidas, score_engajamento')
        .single();

      if (convErr || !newConv) {
        console.error('whatsapp-webhook: failed to create conversation', convErr);
        return new Response('OK', { status: 200 });
      }

      conversation = newConv;
      console.log('whatsapp-webhook: new conversation created', conversation.id);
    }

    // ── 4. Save incoming message ──────────────────────────────
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

    // ── 5. Update conversation counters ───────────────────────
    await supabase
      .from('agent_conversations')
      .update({
        mensagens_recebidas: (conversation.mensagens_recebidas ?? 0) + 1,
        ultima_mensagem_em: now,
        score_engajamento: (conversation.score_engajamento ?? 0) + 15,
      })
      .eq('id', conversation.id);

    // ── 6. Log atividade comercial ────────────────────────────
    await supabase.from('atividades_comerciais').insert({
      entidade_tipo: 'lead',
      entidade_id: lead.id,
      tipo: 'whatsapp',
      descricao: `[WhatsApp] Mensagem recebida: ${preview}`,
      resultado: 'recebido',
      data_atividade: now,
    });

    // ── 7. Generate AI auto-response ──────────────────────────
    // Runs inline — Meta gives us ~20s, OpenRouter takes ~3-5s
    await generateAutoResponse(supabase, lead, conversation, textBody);

    console.log('whatsapp-webhook: message processed for lead', lead.id);

    // Meta requires a fast 200 response
    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('whatsapp-webhook error:', err);
    // Always return 200 to Meta — otherwise they retry endlessly
    return new Response('OK', { status: 200 });
  }
});
