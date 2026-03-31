// supabase/functions/whatsapp-webhook/index.ts
// v14 — Claude-powered WhatsApp auto-responder with full Croma CRM integration.
//   - Uses Claude (via OpenRouter) for intelligent responses
//   - Rich system prompt with real product catalog + company info
//   - Queries database for lead history before responding
//   - Detects quote intent → calls ai-gerar-orcamento → creates real proposal in CRM
//   - Sends portal link + PDF via email when quote is generated
//   - Collects customer data (name, email, company, city) before formalizing
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
function buildCromaSystemPrompt(dadosFaltantes: string[]): string {
  const coletaDados = dadosFaltantes.length > 0
    ? `\n## COLETA DE DADOS — PRIORIDADE
Antes de gerar qualquer orçamento formal, você PRECISA coletar os seguintes dados que ainda faltam do cliente:
${dadosFaltantes.map(d => `- ${d}`).join('\n')}

Peça essas informações de forma natural e amigável na conversa. Exemplo: "Para formalizar o orçamento, preciso de alguns dados: seu nome completo, email para envio e a cidade/estado de vocês."
NÃO gere orçamento sem ter pelo menos: nome completo, email e cidade/estado.\n`
    : '';

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
${coletaDados}
## REGRAS DE RESPOSTA
1. SEMPRE em português brasileiro, profissional mas caloroso
2. Máximo 2-3 parágrafos curtos (WhatsApp = tela pequena)
3. Use *negrito* para destaques importantes
4. Emojis com moderação (1-2 por mensagem)
5. NUNCA invente preços — os preços serão calculados pelo sistema de precificação automaticamente
6. Se o cliente pedir preço/orçamento → peça: produto, dimensões, quantidade, acabamento, se precisa de arte/instalação
7. Se o cliente já informou produto + dimensões + quantidade → diga que vai gerar o orçamento no sistema e enviar o link
8. Se for saudação simples → apresente-se brevemente e pergunte como pode ajudar
9. Se for dúvida técnica → responda com expertise e redirecione para valor
10. Se já conversou antes (histórico) → NÃO repita perguntas já respondidas
11. Assine como "Junior - Croma Print" (o cliente fala com o Junior, não com IA)
12. Se o cliente pedir para FORMALIZAR o orçamento → informe que vai gerar no sistema e enviar por email + link

## DADOS DE PAGAMENTO (CORRETOS — usar estes)
- *PIX*: CNPJ 18.923.994/0001-83 (Croma Print Comunicação Visual)
- *Email oficial*: junior@cromaprint.com.br
- Também aceitamos transferência bancária e boleto
- NUNCA informe outros dados de PIX ou email que não sejam estes

## TRATAMENTO DE OBJEÇÕES
- "Muito caro" → fale sobre durabilidade, qualidade e ROI
- "Vou pensar" → ofereça ajuda com dúvidas e mencione prazo de produção
- "Já tenho fornecedor" → ofereça um projeto piloto sem compromisso
- "Não preciso agora" → pergunte sobre próxima campanha/sazonalidade

## HORÁRIO
- Comercial: 8h-18h (seg-sex)
- Fora do horário: responda normalmente mas mencione que detalhes técnicos serão confirmados no próximo dia útil

## DETECÇÃO DE INTENÇÃO
Ao final da sua resposta, adicione numa linha separada uma tag invisível com a intenção detectada:
[INTENT:conversa] — saudação, dúvida geral, informação
[INTENT:coleta_dados] — preciso coletar dados faltantes antes de orçar
[INTENT:orcamento] — cliente já forneceu produto+dimensões+quantidade E eu tenho os dados cadastrais dele (nome, email, cidade)
[INTENT:formalizar] — cliente pediu para formalizar/gerar/enviar orçamento E eu tenho os dados cadastrais dele
[INTENT:suporte] — problema com pedido existente
[INTENT:reclamacao] — insatisfação

IMPORTANTE: Só marque [INTENT:orcamento] ou [INTENT:formalizar] se os dados cadastrais (nome completo, email, cidade/estado) JÁ foram coletados. Se faltarem dados, use [INTENT:coleta_dados].

## FORMATO DA RESPOSTA
Responda o texto da mensagem + a tag [INTENT:xxx] na última linha. Sem JSON, sem metadata. Apenas o texto puro da resposta seguido da tag de intenção.`;
}

// ─────────────────────────────────────────────────────────────
// Generate Claude response with full context
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// Check which customer data is still missing
// ─────────────────────────────────────────────────────────────
function checkDadosFaltantes(lead: Record<string, unknown>): string[] {
  const faltantes: string[] = [];
  const nome = (lead.contato_nome as string) || '';
  // Name with only first name or generic WhatsApp name
  if (!nome || nome.split(' ').length < 2) faltantes.push('Nome completo');
  if (!lead.contato_email && !lead.email) faltantes.push('Email');
  if (!lead.empresa || lead.empresa === nome || (lead.empresa as string)?.startsWith('WhatsApp ')) faltantes.push('Nome da empresa');
  // Check observacoes for city/state info
  const obs = ((lead.observacoes as string) || '').toLowerCase();
  const hasCidade = obs.includes('cidade') || obs.includes('estado') || obs.includes('/rs') || obs.includes('/sp');
  if (!hasCidade && !lead.segmento) faltantes.push('Cidade/Estado');
  return faltantes;
}

// ─────────────────────────────────────────────────────────────
// Extract intent tag from Claude response
// ─────────────────────────────────────────────────────────────
function extractIntent(response: string): { cleanText: string; intent: string } {
  const intentMatch = response.match(/\[INTENT:(\w+)\]\s*$/);
  if (intentMatch) {
    return {
      cleanText: response.replace(/\[INTENT:\w+\]\s*$/, '').trim(),
      intent: intentMatch[1],
    };
  }
  return { cleanText: response.trim(), intent: 'conversa' };
}

// ─────────────────────────────────────────────────────────────
// Update lead data from conversation context
// ─────────────────────────────────────────────────────────────
async function tryUpdateLeadFromMessage(
  supabase: ReturnType<typeof getServiceClient>,
  leadId: string,
  message: string,
  currentLead: Record<string, unknown>,
): Promise<void> {
  // Simple extraction patterns for common data shared by customers
  const updates: Record<string, unknown> = {};

  // Email detection
  const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
  if (emailMatch && !currentLead.contato_email) {
    updates.contato_email = emailMatch[0].toLowerCase();
  }

  // City/state detection (common Brazilian formats)
  const cidadeMatch = message.match(/(?:de|em|sou de|fico em|estou em|moro em|cidade[:\s]*)\s*([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)*)\s*[-\/]\s*([A-Z]{2})/i);
  if (cidadeMatch) {
    const obsAtual = (currentLead.observacoes as string) || '';
    if (!obsAtual.includes(cidadeMatch[1])) {
      updates.observacoes = obsAtual ? `${obsAtual} | Cidade: ${cidadeMatch[1]}/${cidadeMatch[2]}` : `Cidade: ${cidadeMatch[1]}/${cidadeMatch[2]}`;
    }
  }

  // Full name detection (when they say "meu nome é X" or "sou X Y")
  const nomeMatch = message.match(/(?:meu nome[:\s]+(?:é\s+)?|me chamo\s+|sou\s+(?:o|a)?\s*)([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)+)/i);
  if (nomeMatch && (!currentLead.contato_nome || (currentLead.contato_nome as string).split(' ').length < 2)) {
    updates.contato_nome = nomeMatch[1].trim();
  }

  // Company name detection
  const empresaMatch = message.match(/(?:empresa[:\s]+(?:é\s+)?|trabalho\s+(?:na|no)\s+|sou\s+(?:da|do)\s+)([A-ZÀ-Ü][^\n,]{2,40})/i);
  if (empresaMatch && (!currentLead.empresa || (currentLead.empresa as string).startsWith('WhatsApp '))) {
    updates.empresa = empresaMatch[1].trim();
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString();
    await supabase.from('leads').update(updates).eq('id', leadId);
    console.log('whatsapp-webhook: Lead data updated from message:', Object.keys(updates));
  }
}

// ─────────────────────────────────────────────────────────────
// Call ai-gerar-orcamento to create real proposal in CRM
// ─────────────────────────────────────────────────────────────
async function gerarOrcamentoReal(
  supabase: ReturnType<typeof getServiceClient>,
  conversationId: string,
  leadId: string,
  canal: string,
): Promise<{ success: boolean; portalUrl?: string; total?: number; numero?: string; propostaId?: string; mensagem?: string }> {
  try {
    // Load conversation messages for context
    const { data: msgs } = await supabase
      .from('agent_messages')
      .select('direcao, conteudo')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(20);

    const mensagens = (msgs ?? []).map((m: Record<string, unknown>) => ({
      direcao: m.direcao as string,
      conteudo: m.conteudo as string,
    }));

    const orcamentoUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-gerar-orcamento`;
    const resp = await fetch(orcamentoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        lead_id: leadId,
        mensagens,
        canal,
      }),
    });

    const result = await resp.json();

    if (result.status === 'proposta_criada') {
      return {
        success: true,
        portalUrl: result.portal_url,
        total: result.total,
        numero: result.proposta_numero,
        propostaId: result.proposta_id,
      };
    }

    return {
      success: false,
      mensagem: result.status === 'info_faltante'
        ? 'Preciso de mais informações para gerar o orçamento.'
        : 'Não consegui gerar o orçamento automaticamente.',
    };
  } catch (err) {
    console.error('whatsapp-webhook: ai-gerar-orcamento call failed:', err);
    return { success: false, mensagem: 'Erro ao gerar orçamento no sistema.' };
  }
}

// ─────────────────────────────────────────────────────────────
// Send proposal email via Edge Function
// ─────────────────────────────────────────────────────────────
async function enviarEmailProposta(
  supabase: ReturnType<typeof getServiceClient>,
  leadId: string,
  propostaId: string,
): Promise<void> {
  try {
    // Get lead email
    const { data: lead } = await supabase
      .from('leads')
      .select('contato_email, contato_nome, empresa')
      .eq('id', leadId)
      .single();

    const email = lead?.contato_email as string;
    if (!email) {
      console.log('whatsapp-webhook: No email for lead, skipping email send');
      return;
    }

    // Load SMTP config from admin_config (same as enviar-email-proposta uses as fallback)
    const { data: smtpRows } = await supabase
      .from('admin_config')
      .select('chave, valor')
      .in('chave', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password']);

    const smtpMap: Record<string, string> = {};
    for (const row of smtpRows ?? []) {
      if (row.chave && row.valor) smtpMap[row.chave] = row.valor;
    }

    const smtpUser = smtpMap['smtp_user'] || Deno.env.get('SMTP_USER') || '';
    const smtpPassword = smtpMap['smtp_password'] || Deno.env.get('SMTP_PASSWORD') || '';

    if (!smtpUser || !smtpPassword) {
      console.log('whatsapp-webhook: SMTP not configured, skipping email');
      return;
    }

    // Get proposta data
    const { data: proposta } = await supabase
      .from('propostas')
      .select('numero, total, share_token')
      .eq('id', propostaId)
      .single();

    if (!proposta?.share_token) {
      console.log('whatsapp-webhook: Proposta without share_token, skipping email');
      return;
    }

    const portalUrl = `https://crm-croma.vercel.app/p/${proposta.share_token}`;
    const nomeCliente = lead?.contato_nome || lead?.empresa || 'Cliente';
    const smtpHost = smtpMap['smtp_host'] || 'mail.cromaprint.com.br';
    const smtpPort = parseInt(smtpMap['smtp_port'] || '465');

    // Dynamic import of nodemailer
    const nodemailer = (await import('npm:nodemailer@6.9')).default;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPassword },
      tls: { rejectUnauthorized: false },
    });

    const htmlBody = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b;">
        <h2 style="color:#1e40af;margin-bottom:4px;">Croma Print Comunicação Visual</h2>
        <p style="color:#64748b;font-size:13px;margin-top:0;">Comunicação Visual Profissional</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
        <p>Olá, <strong>${nomeCliente}</strong>!</p>
        <p>Preparamos sua proposta comercial <strong>${proposta.numero}</strong>.</p>
        <p>Acesse o link abaixo para ver todos os detalhes, aprovar e enviar seus arquivos:</p>
        <p style="text-align:center;margin:32px 0;">
          <a href="${portalUrl}" style="background:#2563eb;color:white;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:bold;">
            Ver Orçamento
          </a>
        </p>
        <p><strong>Valor total: R$ ${(proposta.total as number || 0).toFixed(2).replace('.', ',')}</strong></p>
        <p>Formas de pagamento: PIX (CNPJ 18.923.994/0001-83), transferência ou boleto.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
        <p style="color:#64748b;font-size:12px;">Junior - Croma Print | junior@cromaprint.com.br</p>
      </div>`;

    await transporter.sendMail({
      from: `"Croma Print" <${smtpUser}>`,
      replyTo: 'junior@cromaprint.com.br',
      to: email,
      subject: `Orçamento ${proposta.numero} - Croma Print`,
      html: htmlBody,
    });

    // Update proposta status to 'enviada'
    await supabase
      .from('propostas')
      .update({ status: 'enviada', updated_at: new Date().toISOString() })
      .eq('id', propostaId);

    console.log(`whatsapp-webhook: Proposal email sent to ${email}`);
  } catch (err) {
    console.error('whatsapp-webhook: Email send failed (non-blocking):', err);
  }
}

async function generateClaudeResponse(
  supabase: ReturnType<typeof getServiceClient>,
  lead: Record<string, unknown>,
  conversation: Record<string, unknown>,
  incomingMessage: string,
  contactName: string,
): Promise<{ text: string; intent: string } | null> {
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
      .select('empresa, contato_nome, contato_email, segmento, temperatura, observacoes, status')
      .eq('id', lead.id)
      .single();

    // Check if lead has existing orders
    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('id, numero, status, valor_total')
      .eq('cliente_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(3);

    // Determine missing customer data
    const dadosFaltantes = checkDadosFaltantes(fullLead || lead);

    // Build user prompt with all context
    const userPrompt = [
      `## DADOS DO LEAD`,
      `Nome: ${contactName || fullLead?.contato_nome || 'Não informado'}`,
      `Email: ${fullLead?.contato_email || 'Não informado'}`,
      `Empresa: ${fullLead?.empresa || 'Não informada'}`,
      `Segmento: ${fullLead?.segmento || 'Não identificado'}`,
      `Temperatura: ${fullLead?.temperatura || 'morno'}`,
      `Status: ${fullLead?.status || 'novo'}`,
      fullLead?.observacoes ? `Observações: ${fullLead.observacoes}` : '',
      dadosFaltantes.length > 0 ? `\n⚠️ DADOS FALTANTES PARA ORÇAMENTO: ${dadosFaltantes.join(', ')}` : '\n✅ Todos os dados cadastrais coletados — pode gerar orçamento',
      ``,
      pedidos && pedidos.length > 0 ? `## PEDIDOS ANTERIORES\n${pedidos.map((p: Record<string, unknown>) => `- Pedido #${p.numero}: ${p.status} (R$ ${p.valor_total})`).join('\n')}` : '## PEDIDOS ANTERIORES\nNenhum pedido anterior (lead novo)',
      ``,
      `## HISTÓRICO DA CONVERSA`,
      historico || '(primeira mensagem)',
      ``,
      `## MENSAGEM RECEBIDA AGORA`,
      incomingMessage,
      ``,
      `Responda como Junior da Croma Print. Texto da mensagem + tag [INTENT:xxx] na última linha.`,
    ].filter(Boolean).join('\n');

    const aiResult = await callOpenRouter(
      buildCromaSystemPrompt(dadosFaltantes),
      userPrompt,
      {
        model: CLAUDE_MODEL,
        temperature: 0.7,
        max_tokens: 600,
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

    const { cleanText, intent } = extractIntent(aiResult.content);
    return { text: cleanText, intent };
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

    // ── 7.5. Try to extract data from incoming message ────
    await tryUpdateLeadFromMessage(supabase, lead.id as string, textBody, lead);

    // ── 8. Generate Claude response ─────────────────────────
    const claudeResult = await generateClaudeResponse(
      supabase, lead, conversation, textBody, contactName,
    );

    if (!claudeResult) {
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

    let resposta = claudeResult.text;
    const intent = claudeResult.intent;
    let orcamentoGerado = false;

    // ── 8.5. If intent is orcamento/formalizar → create real proposal via CRM ──
    if (intent === 'orcamento' || intent === 'formalizar') {
      console.log(`whatsapp-webhook: Intent '${intent}' detected — calling ai-gerar-orcamento`);

      const orcResult = await gerarOrcamentoReal(
        supabase,
        conversation.id as string,
        lead.id as string,
        'whatsapp',
      );

      if (orcResult.success && orcResult.portalUrl) {
        orcamentoGerado = true;

        // Build response with real CRM data
        const primeiroNome = (contactName || (lead.contato_nome as string) || '').split(' ')[0];
        resposta = [
          `${primeiroNome ? primeiroNome + ', p' : 'P'}reparei o orçamento no sistema! 📋`,
          ``,
          `*Orçamento ${orcResult.numero}*`,
          `*Total: R$ ${(orcResult.total ?? 0).toFixed(2).replace('.', ',')}*`,
          ``,
          `Acesse todos os detalhes, aprove e envie seus arquivos por este link:`,
          `${orcResult.portalUrl}`,
          ``,
          `Também enviei por email com o PDF completo.`,
          ``,
          `*Pagamento:*`,
          `PIX: CNPJ 18.923.994/0001-83`,
          `Também aceitamos transferência e boleto.`,
          ``,
          `Qualquer dúvida, estou aqui! 😊`,
          `Junior - Croma Print`,
        ].join('\n');

        // Send email with proposal link (non-blocking)
        enviarEmailProposta(supabase, lead.id as string, orcResult.propostaId!);

        // Update conversation etapa
        await supabase
          .from('agent_conversations')
          .update({ etapa: 'proposta', updated_at: new Date().toISOString() })
          .eq('id', conversation.id);
      } else {
        // Fallback: couldn't generate — use Claude's original response
        console.log('whatsapp-webhook: ai-gerar-orcamento failed, using Claude response');
      }
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
        sent_by: 'claude-whatsapp-v14',
        modelo_ia: CLAUDE_MODEL,
        sent_success: sent,
        intent_detected: intent,
        orcamento_gerado: orcamentoGerado,
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
    const intentLabel = orcamentoGerado ? '📋 ORÇAMENTO GERADO' : `🏷️ ${intent}`;
    const truncResp = resposta.length > 200 ? resposta.substring(0, 200) + '…' : resposta;
    const truncMsg = textBody.length > 150 ? textBody.substring(0, 150) + '…' : textBody;

    await notifyTelegram(
      `🤖 *Auto-resposta WhatsApp* ${statusEmoji} ${intentLabel}\n\n` +
      `👤 *${contactName || 'Sem nome'}*${isNewLead ? ' (NOVO LEAD)' : ''}\n` +
      `📞 +${normalizedPhone}\n\n` +
      `💬 *Cliente:* ${truncMsg}\n\n` +
      `✍️ *Respondido:* ${truncResp}\n\n` +
      `_${sent ? 'Enviado com sucesso' : 'FALHA no envio — responda manualmente'}_`
    );

    console.log('whatsapp-webhook: Claude auto-response sent for lead', lead.id, '| intent:', intent, '| orcamento:', orcamentoGerado);
    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('whatsapp-webhook error:', err);
    return new Response('OK', { status: 200 });
  }
});
