// supabase/functions/whatsapp-webhook/index.ts
// v17 — P0+P1+P2+P3+P4 consolidados.
//   P0 — bot/URA/loop detector + automacao_pausada early-return
//   P1 — extração estruturada de dados via Claude (JSON) + gravarDadosExtraidos
//        (validação CNPJ/email, blocklist nome=cargo, anti-sobrescrita por confiança)
//   P2 — catálogo + lições aprendidas vindos de admin_config (editável sem deploy)
//   P3 — counter atômico via RPC incrementar_contador_conversa (race fix)
//   P4 — memória por lead (lead_memoria) lida e atualizada a cada conversa
// v15 — P0: bot/URA/loop detector + automacao_pausada early-return.
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
import {
  getWhatsAppCredentials,
  postToMetaCloud,
} from '../ai-shared/whatsapp-credentials.ts';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
let _telegramToken: string | null = null;
const JUNIOR_CHAT_ID = '1065519625';

async function getTelegramToken(supabase: ReturnType<typeof getServiceClient>): Promise<string> {
  if (_telegramToken) return _telegramToken;
  _telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
  if (!_telegramToken) {
    const { data } = await supabase
      .from('admin_config')
      .select('valor')
      .eq('chave', 'TELEGRAM_BOT_TOKEN')
      .single();
    _telegramToken = data?.valor ?? '';
  }
  return _telegramToken;
}
const CLAUDE_MODEL = 'anthropic/claude-sonnet-4';
const FALLBACK_MODEL = 'openai/gpt-4.1-mini';

// Palavras que indicam escalação (não responder automaticamente)
const ESCALATION_KEYWORDS = /\b(cancelar|cancelamento|reclamação|reclamar|insatisfeito|problema grave|advogado|procon|processo|jurídico|péssimo|horrível|nunca mais|devolver|reembolso)\b/i;

// ─────────────────────────────────────────────────────────────
// P0 — Bot/URA/loop detection patterns
// Detecta quando o "cliente" do outro lado é, na verdade, um bot, URA,
// assistente virtual ou menu automático. Pausar auto-resposta nesses casos
// para evitar loop bot vs bot e desperdício de tokens.
// ─────────────────────────────────────────────────────────────
const BOT_PATTERNS: { regex: RegExp; tipo: string }[] = [
  // Saudações automáticas de URA / chatbot empresarial
  { regex: /agradecemos?\s+(o\s+)?seu\s+contato/i, tipo: 'saudacao_automatica' },
  { regex: /obrigad[oa]\s+por\s+entrar\s+em\s+contato/i, tipo: 'saudacao_automatica' },
  { regex: /agradece\s+seu\s+contato/i, tipo: 'saudacao_automatica' },

  // Identificação explícita de bot / assistente virtual
  { regex: /\bsou\s+(o|a)?\s*(assistente|atendente)\s+virtual\b/i, tipo: 'assistente_virtual' },
  { regex: /\b(assistente|atendente)\s+virtual\s+d[ao]\b/i, tipo: 'assistente_virtual' },
  { regex: /\batendimento\s+autom[aá]tico\b/i, tipo: 'atendimento_automatico' },
  { regex: /\bbot\s+d[ao]\s+atendimento\b/i, tipo: 'assistente_virtual' },
  { regex: /\b(eu\s+)?vou\s+te\s+enviar\s+algumas\s+perguntas\b/i, tipo: 'assistente_virtual' },

  // Menus / URA
  { regex: /por\s+gentileza,?\s+(escolha|selecione|digite)/i, tipo: 'menu_ura' },
  { regex: /escolha\s+(uma\s+|a\s+)?op[cç][aã]o/i, tipo: 'menu_ura' },
  { regex: /selecione\s+(uma\s+|a\s+)?op[cç][aã]o/i, tipo: 'menu_ura' },
  { regex: /digite\s+\d+\s+para/i, tipo: 'menu_ura' },
  { regex: /clicar\s+na\s+op[cç][aã]o\s+que\s+mais\s+se\s+encaixa/i, tipo: 'menu_ura' },
  // 2+ opções numeradas em sequência: "*1* - Comercial ... *2* - Boleto"
  { regex: /\*?\s*1\s*\*?\s*[-–]\s*\w[^\n]{0,40}[\s\S]{0,80}\*?\s*2\s*\*?\s*[-–]\s*\w/i, tipo: 'menu_ura' },

  // Horário de atendimento automático
  { regex: /(nosso\s+)?hor[aá]rio\s+de\s+atendimento\s+(via\s+whatsapp\s+)?[éeè]/i, tipo: 'horario_automatico' },
  { regex: /atendimento\s+via\s+whatsapp\s+(de|é)\s+(seg|2)/i, tipo: 'horario_automatico' },
  { regex: /fora\s+do\s+(nosso\s+)?hor[aá]rio\s+(de\s+)?atendimento/i, tipo: 'horario_automatico' },
  { regex: /central\s+24h/i, tipo: 'horario_automatico' },
];

// Caracteres invisíveis (LRM/RLM/PDI/etc.) que muitos bots de WhatsApp Business
// inserem no início das mensagens — assinatura forte de bot.
// U+200E LRM, U+200F RLM, U+202A-U+202E (embedding/override), U+2066-U+2069 (isolates).
const BOT_INVISIBLE_PREFIX = /^[‎‏‪-‮⁦-⁩]/;

function normalizarTexto(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacríticos
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Similaridade simples (Jaccard de tokens + substring overlap).
// Suficiente pra detectar URA mandando o mesmo menu repetido.
function similaridade(a: string, b: string): number {
  const na = normalizarTexto(a);
  const nb = normalizarTexto(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  // Substring forte (uma é prefixo da outra)
  const min = Math.min(na.length, nb.length);
  if (min >= 40) {
    const slice = Math.min(120, min);
    if (na.startsWith(nb.slice(0, slice)) || nb.startsWith(na.slice(0, slice))) return 0.95;
  }
  const tokensA = new Set(na.split(' '));
  const tokensB = new Set(nb.split(' '));
  let inter = 0;
  for (const t of tokensA) if (tokensB.has(t)) inter++;
  const union = new Set([...tokensA, ...tokensB]).size;
  return union ? inter / union : 0;
}

interface DeteccaoBot {
  blocked: true;
  motivo: string;
  tipo: string;
}

// Retorna não-null se a conversa deve ter auto-resposta PAUSADA.
async function detectarBotOuLoop(
  supabase: ReturnType<typeof getServiceClient>,
  conversationId: string,
  mensagemAtual: string,
): Promise<DeteccaoBot | null> {
  const texto = (mensagemAtual ?? '').trim();
  if (!texto) return null;

  // (a) Caracter invisível típico de bot WhatsApp Business
  if (BOT_INVISIBLE_PREFIX.test(texto)) {
    return { blocked: true, motivo: 'Mensagem com caracter invisível típico de bot WhatsApp Business', tipo: 'bot_signature_char' };
  }

  // (b) Padrões de bot/URA conhecidos
  for (const { regex, tipo } of BOT_PATTERNS) {
    if (regex.test(texto)) {
      return { blocked: true, motivo: `Padrão detectado: ${tipo}`, tipo };
    }
  }

  // (c) Repetição: 2+ das últimas 3 recebidas são praticamente iguais
  const { data: ultimas } = await supabase
    .from('agent_messages')
    .select('conteudo, created_at')
    .eq('conversation_id', conversationId)
    .eq('direcao', 'recebida')
    .order('created_at', { ascending: false })
    .limit(3);

  if (ultimas && ultimas.length >= 2) {
    const conteudos = ultimas.map((m: Record<string, unknown>) => (m.conteudo as string) ?? '');
    let pares = 0;
    if (similaridade(conteudos[0], conteudos[1]) >= 0.9) pares++;
    if (conteudos.length >= 3 && similaridade(conteudos[0], conteudos[2]) >= 0.9) pares++;
    if (conteudos.length >= 3 && similaridade(conteudos[1], conteudos[2]) >= 0.9) pares++;
    if (pares >= 1 && conteudos.length >= 3) {
      return { blocked: true, motivo: 'Contraparte enviou mensagens praticamente idênticas em sequência', tipo: 'loop_repeticao' };
    }
  }

  // (d) Circuit breaker volumétrico: 5+ enviadas pelo nosso bot nos últimos 5 min
  const cincoMinAtras = new Date(Date.now() - 5 * 60_000).toISOString();
  const { count: enviadasRecentes } = await supabase
    .from('agent_messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .eq('direcao', 'enviada')
    .gte('created_at', cincoMinAtras);

  if ((enviadasRecentes ?? 0) >= 5) {
    return { blocked: true, motivo: `Circuit breaker: ${enviadasRecentes} respostas enviadas em 5min`, tipo: 'circuit_breaker' };
  }

  return null;
}

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
async function notifyTelegram(supabase: ReturnType<typeof getServiceClient>, text: string): Promise<void> {
  try {
    const token = await getTelegramToken(supabase);
    if (!token) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
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
// Uses the shared credential helper — single source of truth.
// ─────────────────────────────────────────────────────────────
async function sendWhatsApp(
  supabase: ReturnType<typeof getServiceClient>,
  toPhone: string,
  message: string,
): Promise<boolean> {
  try {
    const credsResult = await getWhatsAppCredentials(supabase);
    if (!credsResult.ok) {
      console.error('whatsapp-webhook: Missing WhatsApp credentials —', credsResult.message);
      return false;
    }

    const result = await postToMetaCloud(credsResult, {
      messaging_product: 'whatsapp',
      to: toPhone,
      type: 'text',
      text: { body: message },
    });

    if (!result.ok) {
      console.error('whatsapp-webhook: WhatsApp send failed:', result.status, result.body);
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
// v17 (P1+P2): catálogo carregado de admin_config, lições aprendidas,
// JSON estruturado de saída com dados_extraidos + confianca.
// ─────────────────────────────────────────────────────────────
function buildCromaSystemPrompt(
  dadosFaltantes: string[],
  catalogo: CatalogoConfig | null,
  licoes: LicoesConfig | null,
): string {
  const coletaDados = dadosFaltantes.length > 0
    ? `\n## COLETA DE DADOS — PRIORIDADE
Antes de gerar qualquer orçamento formal, você PRECISA coletar os seguintes dados que ainda faltam do cliente:
${dadosFaltantes.map(d => `- ${d}`).join('\n')}

Peça essas informações de forma natural e amigável na conversa. Exemplo: "Para formalizar o orçamento, preciso de alguns dados: seu nome completo, email para envio e a cidade/estado de vocês."
NÃO gere orçamento sem ter pelo menos: nome completo, email e cidade/estado.\n`
    : '';

  // Catálogo dinâmico de admin_config.agent_catalogo (fallback hardcoded curto)
  const produtosLista = catalogo?.produtos?.length
    ? catalogo.produtos.map(p => `- ${p}`).join('\n')
    : `- Banners, lonas, adesivos, placas, fachadas ACM, letras caixa, cavaletes, totens, material PDV, envelopamento veicular, postes de monitoramento, comunicação visual para empresas de segurança, projetos sob medida`;
  const diferenciaisLista = catalogo?.diferenciais?.length
    ? catalogo.diferenciais.map(d => `- ${d}`).join('\n')
    : '- Produção própria, atendimento nacional, solução do projeto à instalação';
  const regraInclusao = catalogo?.regra_inclusao
    ?? 'Se o cliente perguntar por algo que não está na lista, NÃO afirmar categoricamente que não fazemos. Responder: "A Croma trabalha com comunicação visual e projetos sob medida. Consigo verificar com a equipe e confirmar a melhor solução para você."';

  // Lições aprendidas globais (admin_config.agente_licoes)
  const licoesBloco = licoes?.licoes?.length
    ? `\n## LIÇÕES APRENDIDAS (regras globais — sempre respeitar)
${licoes.licoes.map(l => `- ${l}`).join('\n')}\n`
    : '';

  return `Você é o vendedor consultivo da *Croma Print Comunicação Visual*, respondendo clientes via WhatsApp.

## SOBRE A EMPRESA
- Produção própria em Nova Hartz/RS, atendimento nacional
- Especialidade: redes de lojas, franquias, grandes varejistas
- Clientes de referência: Beira Rio, Renner, Paquetá
- 6 funcionários de produção, faturamento médio R$ 110.000/mês
- Responsável: Junior (dono)

## CATÁLOGO DE PRODUTOS (atualizado de admin_config)
${produtosLista}

## DIFERENCIAIS
${diferenciaisLista}

## REGRA DE INCLUSÃO (IMPORTANTE)
${regraInclusao}
${licoesBloco}

## FAIXAS DE PREÇO (referência — orçamento formal calculado pelo sistema)
- *Banners/Lonas*: a partir de R$ 25/m² (lona 280g) até R$ 55/m² (lona 440g frontlit)
- *Adesivos*: a partir de R$ 35/m² (vinil comum) até R$ 120/m² (perfurado/especial)
- *Fachadas ACM*: a partir de R$ 450/m² (projeto completo com instalação)
- *Placas PVC*: a partir de R$ 90/m² | PS: R$ 80/m² | ACM: R$ 280/m²
- *Letras caixa*: a partir de R$ 85/letra (galvanizada 20cm)
- *Cavaletes*: R$ 120 (P madeira) a R$ 350 (G metálico)
- *Material PDV*: displays a partir de R$ 45, faixas de gôndola a partir de R$ 12
- ATENÇÃO: estes são valores de *REFERÊNCIA*. O orçamento formal terá o preço exato calculado automaticamente pelo sistema com os materiais e configurações específicas.
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
11. NÃO assine cada mensagem. Responda como se estivesse digitando no WhatsApp normalmente — sem "Junior - Croma Print" no fim de toda resposta. A assinatura SÓ é usada em mensagens de fechamento de orçamento (geração de proposta) ou de encerramento da conversa.
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

## FORMATO DA RESPOSTA — JSON OBRIGATÓRIO (sem markdown, sem texto antes/depois)
Retorne EXATAMENTE este JSON:
{
  "resposta_texto": "texto curto e natural que será enviado ao cliente via WhatsApp (max 3 parágrafos)",
  "intent": "conversa|coleta_dados|orcamento|formalizar|suporte|reclamacao",
  "dados_extraidos": {
    "nome": null,
    "email": null,
    "telefone": null,
    "empresa": null,
    "cnpj": null,
    "cidade": null,
    "uf": null,
    "cargo": null,
    "segmento": null,
    "endereco": null,
    "necessidade": null,
    "urgencia": null,
    "produto_interesse": null
  },
  "confianca": {
    "nome": "alta|media|baixa",
    "email": "alta|media|baixa",
    "telefone": "alta|media|baixa",
    "empresa": "alta|media|baixa",
    "cnpj": "alta|media|baixa",
    "cidade": "alta|media|baixa",
    "uf": "alta|media|baixa"
  },
  "memoria_atualizar": {
    "produto_interesse": null,
    "necessidade": null,
    "urgencia": null,
    "proximos_passos": null,
    "resumo_curto": null
  }
}

REGRAS DE INTENT:
- Só marque "orcamento" ou "formalizar" se nome+email+cidade JÁ foram coletados.
- Se faltam dados cadastrais use "coleta_dados".

REGRAS DE EXTRAÇÃO (dados_extraidos):
- Preencha SOMENTE com informação dita pelo cliente NA MENSAGEM ATUAL ou no histórico recente. Nunca invente.
- "nome": APENAS pessoa real. NUNCA cargo/função/bot ("assistente virtual", "atendimento", "comercial", "financeiro", "suporte", "bot", "URA", "atendente"). Se for esse caso, deixe null.
- "email": valide se contém @ e domínio. Se duvidoso, null.
- "cnpj": apenas se 14 dígitos numéricos válidos. Senão null.
- "uf": 2 letras maiúsculas (RS, SP, etc.).
- Se o dado já está confirmado em conversa anterior (ver "MEMÓRIA") e o cliente não repetiu, deixe null (não duplica).
- "confianca": "alta" se cliente afirmou explicitamente; "media" se claramente inferido; "baixa" se incerto.

REGRAS DE MEMÓRIA (memoria_atualizar):
- "resumo_curto": 1-2 frases resumindo o estado atual da conversa (interesse, dores, próximo passo). Sobrescreve o resumo anterior.
- Outros campos: preencher só se mudaram. Se não mudou, null.`;
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
    console.log('whatsapp-webhook: Lead data updated from message (regex fallback):', Object.keys(updates));
  }
}

// ─────────────────────────────────────────────────────────────
// P2 — Carregar catálogo + lições aprendidas de admin_config
// ─────────────────────────────────────────────────────────────
interface CatalogoConfig {
  produtos: string[];
  diferenciais: string[];
  regra_inclusao: string;
}
interface LicoesConfig {
  licoes: string[];
}

async function loadCatalogoELicoes(
  supabase: ReturnType<typeof getServiceClient>,
): Promise<{ catalogo: CatalogoConfig | null; licoes: LicoesConfig | null }> {
  try {
    const { data } = await supabase
      .from('admin_config')
      .select('chave, valor')
      .in('chave', ['agent_catalogo', 'agente_licoes']);
    let catalogo: CatalogoConfig | null = null;
    let licoes: LicoesConfig | null = null;
    for (const row of data ?? []) {
      const v = typeof row.valor === 'string' ? JSON.parse(row.valor) : row.valor;
      if (row.chave === 'agent_catalogo') catalogo = v as CatalogoConfig;
      if (row.chave === 'agente_licoes') licoes = v as LicoesConfig;
    }
    return { catalogo, licoes };
  } catch (err) {
    console.error('loadCatalogoELicoes:', err);
    return { catalogo: null, licoes: null };
  }
}

// ─────────────────────────────────────────────────────────────
// P4 — Memória por lead (lê e injeta no contexto)
// ─────────────────────────────────────────────────────────────
interface LeadMemoria {
  resumo: string;
  dados_confirmados: Record<string, unknown>;
  produto_interesse: string | null;
  necessidade: string | null;
  urgencia: string | null;
  proximos_passos: string | null;
  mensagens_processadas: number;
}

async function lerMemoriaLead(
  supabase: ReturnType<typeof getServiceClient>,
  leadId: string,
): Promise<LeadMemoria | null> {
  try {
    const { data } = await supabase
      .from('lead_memoria')
      .select('resumo, dados_confirmados, produto_interesse, necessidade, urgencia, proximos_passos, mensagens_processadas')
      .eq('lead_id', leadId)
      .maybeSingle();
    return data as LeadMemoria | null;
  } catch (err) {
    console.error('lerMemoriaLead:', err);
    return null;
  }
}

async function atualizarMemoriaLead(
  supabase: ReturnType<typeof getServiceClient>,
  leadId: string,
  patch: Partial<LeadMemoria> & { incrementar_processadas?: boolean },
): Promise<void> {
  try {
    const atual = await lerMemoriaLead(supabase, leadId);
    const novoResumo = patch.resumo ?? atual?.resumo ?? '';
    const novosDados = { ...(atual?.dados_confirmados ?? {}), ...(patch.dados_confirmados ?? {}) };
    const upsert = {
      lead_id: leadId,
      resumo: novoResumo.substring(0, 2000), // limite pra não inflar contexto
      dados_confirmados: novosDados,
      produto_interesse: patch.produto_interesse ?? atual?.produto_interesse ?? null,
      necessidade: patch.necessidade ?? atual?.necessidade ?? null,
      urgencia: patch.urgencia ?? atual?.urgencia ?? null,
      proximos_passos: patch.proximos_passos ?? atual?.proximos_passos ?? null,
      mensagens_processadas: (atual?.mensagens_processadas ?? 0) + (patch.incrementar_processadas ? 1 : 0),
      atualizado_em: new Date().toISOString(),
    };
    const { error } = await supabase.from('lead_memoria').upsert(upsert, { onConflict: 'lead_id' }).select().single();
    if (error) console.error('atualizarMemoriaLead upsert:', error.message);
  } catch (err) {
    console.error('atualizarMemoriaLead:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// P1 — Extração inteligente: validar e gravar dados extraídos pela IA
// Aplica regras de blocklist, validação de formato, anti-sobrescrita.
// ─────────────────────────────────────────────────────────────
const NOMES_BLOCKLIST = /^(assistente|atendente|atendimento|comercial|financeiro|suporte|bot|ura|robo|virtual|automatico|sac|callcenter|cobranca|recepcao|vendas|administracao|secretaria|gerencia)\b/i;

function isValidEmail(email: string): boolean {
  return /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(email.trim());
}
function digitsOnly(s: string): string {
  return (s ?? '').replace(/\D/g, '');
}
function isValidCNPJ(cnpj: string): boolean {
  const d = digitsOnly(cnpj);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false; // todos iguais
  return true; // checagem completa de DV é opcional, formato OK
}

interface DadosExtraidos {
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  empresa?: string | null;
  cnpj?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cargo?: string | null;
  segmento?: string | null;
  endereco?: string | null;
  necessidade?: string | null;
  urgencia?: string | null;
  produto_interesse?: string | null;
}
type ConfiancaLevel = 'alta' | 'media' | 'baixa';
type Confiancas = Partial<Record<keyof DadosExtraidos, ConfiancaLevel>>;

async function gravarDadosExtraidos(
  supabase: ReturnType<typeof getServiceClient>,
  leadId: string,
  currentLead: Record<string, unknown>,
  dados: DadosExtraidos,
  confianca: Confiancas,
): Promise<{ ok: boolean; gravados: string[]; bloqueados: string[]; observacao_extra: string[] }> {
  const updates: Record<string, unknown> = {};
  const bloqueados: string[] = [];
  const obsExtras: string[] = [];

  const conf = (k: keyof DadosExtraidos): ConfiancaLevel => (confianca[k] as ConfiancaLevel) ?? 'baixa';

  // Nome — anti-cargo, anti-bot
  if (dados.nome) {
    const nome = dados.nome.trim();
    if (NOMES_BLOCKLIST.test(nome)) {
      bloqueados.push(`nome:"${nome}" (parece cargo/bot)`);
    } else if (conf('nome') !== 'baixa') {
      const palavras = nome.split(/\s+/).filter(Boolean);
      const nomeAtual = (currentLead.contato_nome as string) ?? '';
      if (palavras.length === 1) {
        // Primeiro nome só — aceita só se atual está vazio ou é placeholder WhatsApp
        if (!nomeAtual || nomeAtual.startsWith('WhatsApp ')) updates.contato_nome = nome;
        else bloqueados.push(`nome:"${nome}" (só primeiro nome, atual já tem mais)`);
      } else if (palavras.length >= 2) {
        // Nome completo — sobrescreve se atual está fraco ou se confiança alta
        const atualPalavras = nomeAtual.split(/\s+/).filter(Boolean).length;
        if (atualPalavras < 2 || conf('nome') === 'alta') updates.contato_nome = nome;
      }
    } else {
      bloqueados.push(`nome:"${nome}" (confiança baixa)`);
    }
  }

  // Email
  if (dados.email && isValidEmail(dados.email)) {
    if (!currentLead.contato_email || conf('email') === 'alta') {
      updates.contato_email = dados.email.toLowerCase().trim();
    }
  } else if (dados.email) {
    bloqueados.push(`email:"${dados.email}" (formato inválido)`);
  }

  // CNPJ
  if (dados.cnpj) {
    if (isValidCNPJ(dados.cnpj)) {
      if (!currentLead.cnpj || conf('cnpj') === 'alta') updates.cnpj = digitsOnly(dados.cnpj);
    } else {
      bloqueados.push(`cnpj:"${dados.cnpj}" (formato inválido)`);
    }
  }

  // Empresa
  if (dados.empresa) {
    const empresa = dados.empresa.trim();
    const empresaAtual = (currentLead.empresa as string) ?? '';
    if (NOMES_BLOCKLIST.test(empresa)) {
      bloqueados.push(`empresa:"${empresa}" (parece cargo)`);
    } else if (!empresaAtual || empresaAtual.startsWith('WhatsApp ') || (conf('empresa') === 'alta' && empresa.toLowerCase() !== empresaAtual.toLowerCase())) {
      updates.empresa = empresa.substring(0, 200);
    }
  }

  // Cidade — coluna própria
  if (dados.cidade) {
    if (!currentLead.cidade || conf('cidade') === 'alta') {
      updates.cidade = dados.cidade.trim().substring(0, 100);
    }
  }
  // UF — coluna própria, valida 2 letras
  if (dados.uf && /^[A-Za-z]{2}$/.test(dados.uf.trim())) {
    if (!currentLead.uf || conf('uf') === 'alta') updates.uf = dados.uf.trim().toUpperCase();
  }

  // Cargo
  if (dados.cargo && !currentLead.cargo) updates.cargo = dados.cargo.trim().substring(0, 100);

  // Segmento
  if (dados.segmento && !currentLead.segmento) updates.segmento = dados.segmento.trim().substring(0, 100);

  // Telefone alternativo (não sobrescreve contato_telefone principal)
  if (dados.telefone) {
    const telD = digitsOnly(dados.telefone);
    if (telD.length >= 10 && !currentLead.telefone2) updates.telefone2 = telD;
  }

  // Necessidade / urgência / produto / endereço — vão pra observações estruturadas
  if (dados.necessidade) obsExtras.push(`Necessidade: ${dados.necessidade}`);
  if (dados.urgencia) obsExtras.push(`Urgência: ${dados.urgencia}`);
  if (dados.produto_interesse) obsExtras.push(`Interesse: ${dados.produto_interesse}`);
  if (dados.endereco) obsExtras.push(`Endereço: ${dados.endereco}`);

  if (obsExtras.length > 0) {
    const obsAtual = (currentLead.observacoes as string) ?? '';
    const novas = obsExtras.filter(o => !obsAtual.includes(o.split(':')[0] + ':'));
    if (novas.length > 0) {
      const merged = obsAtual ? `${obsAtual} | ${novas.join(' | ')}` : novas.join(' | ');
      updates.observacoes = merged.substring(0, 2000);
    }
  }

  if (Object.keys(updates).length === 0) {
    return { ok: true, gravados: [], bloqueados, observacao_extra: obsExtras };
  }

  updates.updated_at = new Date().toISOString();
  const { error } = await supabase.from('leads').update(updates).eq('id', leadId).select().single();
  if (error) {
    console.error('gravarDadosExtraidos:', error.message);
    return { ok: false, gravados: [], bloqueados, observacao_extra: obsExtras };
  }

  // Auditoria
  const camposGravados = Object.keys(updates).filter(k => k !== 'updated_at');
  await supabase.from('atividades_comerciais').insert({
    entidade_tipo: 'lead',
    entidade_id: leadId,
    tipo: 'sistema',
    descricao: `[IA-Extração] Atualizou: ${camposGravados.join(', ')}` + (bloqueados.length > 0 ? ` | Bloqueado: ${bloqueados.join('; ')}` : ''),
    resultado: 'sucesso',
    data_atividade: new Date().toISOString(),
  });

  return { ok: true, gravados: camposGravados, bloqueados, observacao_extra: obsExtras };
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

interface ClaudeStructuredResponse {
  text: string;
  intent: string;
  dados: DadosExtraidos;
  confianca: Confiancas;
  memoria: {
    produto_interesse?: string | null;
    necessidade?: string | null;
    urgencia?: string | null;
    proximos_passos?: string | null;
    resumo_curto?: string | null;
  };
}

async function generateClaudeResponse(
  supabase: ReturnType<typeof getServiceClient>,
  lead: Record<string, unknown>,
  conversation: Record<string, unknown>,
  incomingMessage: string,
  contactName: string,
): Promise<ClaudeStructuredResponse | null> {
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

    // P2: catálogo + lições; P4: memória do lead
    const { catalogo, licoes } = await loadCatalogoELicoes(supabase);
    const memoria = await lerMemoriaLead(supabase, lead.id as string);

    // Load last 10 messages for context (including media fields)
    const { data: recentMsgs } = await supabase
      .from('agent_messages')
      .select('direcao, conteudo, created_at, media_type, media_url, media_transcription')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const historico = (recentMsgs ?? []).reverse().map((m: Record<string, unknown>) => {
      const who = m.direcao === 'recebida' ? 'CLIENTE' : 'CROMA';
      const transcription = (m.media_transcription as string | null) ?? null;
      // Indicar mídia no contexto para o Claude entender o que o cliente enviou
      if (m.media_type === 'image') {
        const caption = m.conteudo && m.conteudo !== '[image]' ? `: "${m.conteudo}"` : '';
        return `${who}: [Cliente enviou uma IMAGEM${caption}] (URL: ${m.media_url ?? 'não disponível'})`;
      } else if (m.media_type === 'audio') {
        if (transcription) {
          return `${who}: [áudio do cliente, transcrito] "${transcription}"`;
        }
        return `${who}: [Cliente enviou um ÁUDIO — transcrição indisponível. Pergunte se ele pode escrever a mensagem.]`;
      } else if (m.media_type === 'video') {
        if (transcription) {
          return `${who}: [vídeo do cliente, áudio transcrito] "${transcription}"`;
        }
        return `${who}: [Cliente enviou um VÍDEO]`;
      } else if (m.media_type === 'document') {
        return `${who}: [Cliente enviou um DOCUMENTO]`;
      }
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

    // P4: bloco de memória pra injetar no contexto
    const memoriaBloco = memoria
      ? [
          `## MEMÓRIA DESTE LEAD (de conversas anteriores)`,
          memoria.resumo ? `Resumo: ${memoria.resumo}` : '',
          memoria.produto_interesse ? `Produto/interesse: ${memoria.produto_interesse}` : '',
          memoria.necessidade ? `Necessidade: ${memoria.necessidade}` : '',
          memoria.urgencia ? `Urgência: ${memoria.urgencia}` : '',
          memoria.proximos_passos ? `Próximos passos: ${memoria.proximos_passos}` : '',
          `Mensagens já processadas: ${memoria.mensagens_processadas ?? 0}`,
        ].filter(Boolean).join('\n')
      : '## MEMÓRIA DESTE LEAD\n(primeiro contato — sem memória prévia)';

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
      memoriaBloco,
      ``,
      pedidos && pedidos.length > 0 ? `## PEDIDOS ANTERIORES\n${pedidos.map((p: Record<string, unknown>) => `- Pedido #${p.numero}: ${p.status} (R$ ${p.valor_total})`).join('\n')}` : '## PEDIDOS ANTERIORES\nNenhum pedido anterior (lead novo)',
      ``,
      `## HISTÓRICO DA CONVERSA`,
      historico || '(primeira mensagem)',
      ``,
      `## MENSAGEM RECEBIDA AGORA`,
      incomingMessage,
      ``,
      `Responda como Junior da Croma Print. Retorne SOMENTE o JSON estruturado especificado no system prompt.`,
    ].filter(Boolean).join('\n');

    const aiResult = await callOpenRouter(
      buildCromaSystemPrompt(dadosFaltantes, catalogo, licoes),
      userPrompt,
      {
        model: CLAUDE_MODEL,
        temperature: 0.7,
        max_tokens: 1200, // mais espaço pro JSON estruturado
        text_mode: false, // queremos JSON
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

    // Parse JSON estruturado (P1)
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(aiResult.content);
    } catch (e) {
      console.error('whatsapp-webhook: Claude JSON parse failed, fallback p/ texto puro:', e);
      // Fallback gracioso: usa o conteúdo como texto direto, intent=conversa
      const fallbackText = String(aiResult.content || '').replace(/\[INTENT:\w+\]\s*$/, '').trim();
      return {
        text: fallbackText || 'Recebi sua mensagem! Em instantes te respondo melhor.',
        intent: 'conversa',
        dados: {},
        confianca: {},
        memoria: {},
      };
    }

    const text = String(parsed.resposta_texto ?? '').trim();
    const intent = String(parsed.intent ?? 'conversa');
    const dados = (parsed.dados_extraidos as DadosExtraidos) ?? {};
    const confianca = (parsed.confianca as Confiancas) ?? {};
    const memoriaUpdate = (parsed.memoria_atualizar as Record<string, unknown>) ?? {};

    return {
      text: text || 'Recebi sua mensagem! Em instantes te respondo melhor.',
      intent,
      dados,
      confianca,
      memoria: {
        produto_interesse: (memoriaUpdate.produto_interesse as string) ?? null,
        necessidade: (memoriaUpdate.necessidade as string) ?? null,
        urgencia: (memoriaUpdate.urgencia as string) ?? null,
        proximos_passos: (memoriaUpdate.proximos_passos as string) ?? null,
        resumo_curto: (memoriaUpdate.resumo_curto as string) ?? null,
      },
    };
  } catch (err) {
    console.error('whatsapp-webhook: Claude response failed:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// downloadAndStoreMedia — baixa mídia da Meta Cloud API e salva no Storage
// ─────────────────────────────────────────────────────────────
async function downloadAndStoreMedia(
  supabase: ReturnType<typeof getServiceClient>,
  mediaId: string,
  mediaType: string,
  mimeType: string,
): Promise<{ url: string | null; buffer: ArrayBuffer | null }> {
  try {
    const credsResult = await getWhatsAppCredentials(supabase);
    if (!credsResult.ok) {
      console.error('whatsapp-webhook: downloadAndStoreMedia — sem credenciais');
      return { url: null, buffer: null };
    }

    // 1. Obter URL temporária da mídia (Meta Cloud API)
    const metaRes = await fetch(
      `https://graph.facebook.com/${credsResult.apiVersion}/${mediaId}`,
      {
        headers: { Authorization: `Bearer ${credsResult.accessToken}` },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!metaRes.ok) {
      console.error('whatsapp-webhook: downloadAndStoreMedia — falha ao obter URL da mídia', metaRes.status);
      return { url: null, buffer: null };
    }
    const metaData = await metaRes.json();
    const downloadUrl = metaData.url as string | undefined;
    if (!downloadUrl) return { url: null, buffer: null };

    // 2. Baixar o arquivo binário
    const fileRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${credsResult.accessToken}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!fileRes.ok) {
      console.error('whatsapp-webhook: downloadAndStoreMedia — falha ao baixar arquivo', fileRes.status);
      return { url: null, buffer: null };
    }
    const fileBuffer = await fileRes.arrayBuffer();

    // 3. Determinar extensão pelo MIME type
    const ext = mimeType.includes('jpeg') ? 'jpg'
      : mimeType.includes('png') ? 'png'
      : mimeType.includes('webp') ? 'webp'
      : mimeType.includes('gif') ? 'gif'
      : mimeType.includes('ogg') ? 'ogg'
      : mimeType.includes('mpeg') ? 'mp3'
      : mimeType.includes('mp4') ? 'mp4'
      : mimeType.includes('pdf') ? 'pdf'
      : mimeType.includes('msword') ? 'doc'
      : mimeType.includes('spreadsheet') ? 'xlsx'
      : 'bin';

    // 4. Upload para Supabase Storage
    const filename = `${mediaType}_${Date.now()}_${mediaId.slice(-8)}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from('whatsapp-media')
      .upload(filename, fileBuffer, { contentType: mimeType, upsert: false });

    if (uploadErr) {
      console.error('whatsapp-webhook: Storage upload failed:', uploadErr.message);
      return { url: null, buffer: fileBuffer };
    }

    // 5. Retornar URL pública e buffer (buffer reusado para transcrição se for áudio)
    const { data: urlData } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(filename);

    return { url: urlData?.publicUrl ?? null, buffer: fileBuffer };
  } catch (err) {
    console.error('whatsapp-webhook: downloadAndStoreMedia error:', err);
    return { url: null, buffer: null };
  }
}

// ─────────────────────────────────────────────────────────────
// transcribeAudio — transcreve áudio via Groq Whisper (whisper-large-v3, pt-BR)
// Reusa a chave do admin_config.GROQ_API_KEY ou env var, mesmo padrão do OpenRouter.
// ─────────────────────────────────────────────────────────────
async function transcribeAudio(
  supabase: ReturnType<typeof getServiceClient>,
  buffer: ArrayBuffer,
  mimeType: string,
): Promise<string | null> {
  try {
    let groqKey = Deno.env.get('GROQ_API_KEY');
    if (!groqKey) {
      const { data } = await supabase
        .from('admin_config')
        .select('valor')
        .eq('chave', 'GROQ_API_KEY')
        .single();
      groqKey = (data?.valor as string) || '';
    }
    if (!groqKey) {
      console.log('whatsapp-webhook: GROQ_API_KEY ausente — pulando transcrição. Configure em admin_config ou supabase secrets.');
      return null;
    }

    const ext = mimeType.includes('ogg') ? 'ogg'
      : mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'mp3'
      : mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a'
      : mimeType.includes('wav') ? 'wav'
      : mimeType.includes('webm') ? 'webm'
      : 'ogg';

    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: mimeType || 'audio/ogg' }), `audio.${ext}`);
    formData.append('model', 'whisper-large-v3');
    formData.append('language', 'pt');
    formData.append('response_format', 'json');

    const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body: formData,
      signal: AbortSignal.timeout(60000),
    });

    if (!resp.ok) {
      const errTxt = await resp.text();
      console.error('whatsapp-webhook: Groq transcription falhou', resp.status, errTxt.slice(0, 300));
      return null;
    }
    const data = await resp.json();
    const text = (data?.text as string | undefined)?.trim() ?? null;
    console.log('whatsapp-webhook: transcricao Groq ok,', text?.length ?? 0, 'chars');
    return text;
  } catch (err) {
    console.error('whatsapp-webhook: transcribeAudio error:', err);
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

    // ── Process delivery/read status updates ────────────────
    const statuses = (value.statuses as Record<string, unknown>[] | undefined) ?? [];
    if (statuses.length > 0) {
      const supabaseStatus = getServiceClient();
      for (const status of statuses) {
        const waMessageId = status.id as string;
        const statusType = status.status as string;
        const { data: msgs } = await supabaseStatus
          .from('agent_messages')
          .select('id, status')
          .contains('metadata', { whatsapp_message_id: waMessageId })
          .limit(1);
        if (msgs && msgs.length > 0) {
          const newStatus = statusType === 'read' ? 'lida'
            : statusType === 'delivered' ? 'entregue'
            : statusType === 'failed' ? 'erro'
            : (msgs[0] as any).status;
          const updateData: Record<string, unknown> = { status: newStatus };
          if (statusType === 'read') updateData.lido_em = new Date().toISOString();
          if (statusType === 'failed') updateData.erro_mensagem = (status.errors as any)?.[0]?.message ?? 'Delivery failed';
          await supabaseStatus.from('agent_messages').update(updateData).eq('id', (msgs[0] as any).id);
        }
      }
    }

    if (!messages || messages.length === 0) return new Response('OK', { status: 200 });

    const message = messages[0];
    const contact = contacts?.[0];

    // Extract textBody based on message type
    //  - text:        { type: 'text',        text: { body } }
    //  - button:      { type: 'button',      button: { text, payload } }                  ← Quick Reply de TEMPLATE
    //  - interactive: { type: 'interactive', interactive: { type: 'button_reply'|'list_reply', button_reply: { id, title } } }
    //  - image/audio/video/document: baixar da Meta Cloud API e salvar no Storage
    let textBody = '';
    let messageOrigin: 'text' | 'button' | 'interactive' | 'media' | 'other' = 'other';
    let mediaInfo: { url: string | null; type: string; mime: string; filename?: string; transcription?: string | null } | null = null;

    if (message.type === 'text') {
      textBody = (message.text as Record<string, string>)?.body ?? '';
      messageOrigin = 'text';
    } else if (message.type === 'button') {
      const btn = message.button as Record<string, string> | undefined;
      textBody = btn?.text ?? btn?.payload ?? '';
      messageOrigin = 'button';
    } else if (message.type === 'interactive') {
      const inter = message.interactive as Record<string, unknown> | undefined;
      const interType = inter?.type as string | undefined;
      if (interType === 'button_reply') {
        const br = inter?.button_reply as Record<string, string> | undefined;
        textBody = br?.title ?? br?.id ?? '';
      } else if (interType === 'list_reply') {
        const lr = inter?.list_reply as Record<string, string> | undefined;
        textBody = lr?.title ?? lr?.id ?? '';
      }
      messageOrigin = 'interactive';
    } else if (['image', 'audio', 'video', 'document'].includes(message.type as string)) {
      // Mídia recebida — buscar URL na Meta, baixar e salvar no Storage
      const mediaObj = message[message.type as string] as Record<string, string> | undefined;
      const mediaId = mediaObj?.id;
      const mimeType = mediaObj?.mime_type ?? '';
      const caption = mediaObj?.caption ?? '';
      const originalFilename = mediaObj?.filename ?? '';

      let mediaUrl: string | null = null;
      let transcription: string | null = null;
      if (mediaId) {
        const supabaseMedia = getServiceClient();
        const dl = await downloadAndStoreMedia(supabaseMedia, mediaId, message.type as string, mimeType);
        mediaUrl = dl.url;

        // Transcrever áudio (e voz dentro de vídeo) via Groq Whisper
        if (dl.buffer && (message.type === 'audio' || message.type === 'video')) {
          transcription = await transcribeAudio(supabaseMedia, dl.buffer, mimeType);
        }
      }

      mediaInfo = {
        url: mediaUrl,
        type: message.type as string,
        mime: mimeType,
        filename: originalFilename,
        transcription,
      };
      // Se houver caption do cliente, prevalece. Senão usar transcrição de áudio (assim a IA
      // processa o conteúdo natural). Para outras mídias sem caption, usa placeholder.
      textBody = caption || transcription || `[${message.type}]`;
      messageOrigin = 'media';
    } else {
      console.log('whatsapp-webhook: ignoring unsupported message type', message.type);
      return new Response('OK', { status: 200 });
    }

    if (!textBody && !mediaInfo) {
      console.log('whatsapp-webhook: empty textBody for type', message.type);
      return new Response('OK', { status: 200 });
    }

    const fromPhone = message.from as string;
    const messageId = message.id as string;
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
      .select('id, status, mensagens_recebidas, mensagens_enviadas, score_engajamento, automacao_pausada, metadata')
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
        .select('id, status, mensagens_recebidas, mensagens_enviadas, score_engajamento, automacao_pausada, metadata')
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
      media_url: mediaInfo?.url ?? null,
      media_type: mediaInfo?.type ?? null,
      media_mime: mediaInfo?.mime ?? null,
      media_filename: mediaInfo?.filename ?? null,
      media_transcription: mediaInfo?.transcription ?? null,
      metadata: {
        whatsapp_message_id: messageId,
        from_phone: fromPhone,
        contact_name: contactName,
        message_origin: messageOrigin,
        message_type: message.type,
      },
    });

    // ── 5. Update counters (P3 — incremento atômico via RPC) ──
    await supabase.rpc('incrementar_contador_conversa', {
      p_id: conversation.id,
      p_enviadas: 0,
      p_recebidas: 1,
      p_score: 15,
    });

    // ── 6. Log activity ─────────────────────────────────────
    await supabase.from('atividades_comerciais').insert({
      entidade_tipo: 'lead',
      entidade_id: lead.id,
      tipo: 'whatsapp',
      descricao: `[WhatsApp] Mensagem recebida: ${preview}`,
      resultado: 'recebido',
      data_atividade: now,
    });

    // ── 7. Check for escalation (palavras-chave) ───────────
    if (ESCALATION_KEYWORDS.test(textBody) || conversation.status === 'escalada') {
      // Don't auto-respond — escalate to Junior
      await supabase
        .from('agent_conversations')
        .update({ status: 'escalada' })
        .eq('id', conversation.id);

      // Se já estava escalada antes, não spammar Telegram a cada nova msg.
      const jaEstavaEscalada = conversation.status === 'escalada';
      if (!jaEstavaEscalada) {
        const leadLabel = isNewLead ? '🆕 NOVO' : '⚠️';
        await notifyTelegram(supabase,
          `${leadLabel} *ESCALAÇÃO WhatsApp*\n\n` +
          `👤 *${contactName || 'Sem nome'}*\n` +
          `📞 +${normalizedPhone}\n\n` +
          `💬 ${textBody.substring(0, 300)}\n\n` +
          `⚠️ *Detectei reclamação/urgência — NÃO respondi automaticamente.*\n` +
          `_Responda manualmente via Cowork ou ERP_`
        );
      }

      console.log('whatsapp-webhook: ESCALATED — not auto-responding');
      return new Response('OK', { status: 200 });
    }

    // ── 7.1. Auto-resposta pausada para esta conversa ───────
    // Junior (ou o próprio detector) pausou. Salvar a mensagem (já feito) e sair.
    if ((conversation as Record<string, unknown>).automacao_pausada === true) {
      console.log(`whatsapp-webhook: automacao_pausada=true for ${conversation.id} — skipping auto-response`);
      return new Response('OK', { status: 200 });
    }

    // ── 7.5. Try to extract data from incoming message ────
    await tryUpdateLeadFromMessage(supabase, lead.id as string, textBody, lead);

    // ── 7.6. P0 — Detectar bot/URA/loop ANTES de gastar token ──
    const deteccao = await detectarBotOuLoop(supabase, conversation.id as string, textBody);
    if (deteccao) {
      const metaAtual = ((conversation as Record<string, unknown>).metadata as Record<string, unknown>) ?? {};
      await supabase
        .from('agent_conversations')
        .update({
          status: 'escalada',
          automacao_pausada: true,
          metadata: {
            ...metaAtual,
            escalado_por: 'bot_loop_detector',
            motivo_escalacao: deteccao.motivo,
            tipo_escalacao: deteccao.tipo,
            escalado_em: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversation.id);

      await supabase.from('atividades_comerciais').insert({
        entidade_tipo: 'lead',
        entidade_id: lead.id,
        tipo: 'sistema',
        descricao: `[Auto-resposta PAUSADA] ${deteccao.motivo}`,
        resultado: 'escalado',
        data_atividade: new Date().toISOString(),
      });

      const empresa = (lead as Record<string, unknown>).empresa as string | undefined;
      await notifyTelegram(supabase,
        `🛑 *Auto-resposta PAUSADA — ${deteccao.tipo}*\n\n` +
        `👤 *${contactName || (lead as Record<string, unknown>).contato_nome || 'Sem nome'}*\n` +
        `📞 +${normalizedPhone}\n` +
        (empresa ? `🏢 ${empresa}\n` : '') +
        `\n🤖 *Motivo:* ${deteccao.motivo}\n\n` +
        `💬 _Última msg:_ ${textBody.substring(0, 250)}\n\n` +
        `_Conversa marcada como ESCALADA + automação PAUSADA._\n` +
        `_Responda manualmente. Para reativar: zerar automacao_pausada na conversa._`
      );

      console.log(`whatsapp-webhook: PAUSED — ${deteccao.tipo}: ${deteccao.motivo}`);
      return new Response('OK', { status: 200 });
    }

    // ── 8. Generate Claude response ─────────────────────────
    const claudeResult = await generateClaudeResponse(
      supabase, lead, conversation, textBody, contactName,
    );

    if (!claudeResult) {
      // Claude failed — notify Junior to respond manually
      await notifyTelegram(supabase,
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

    // ── 8.1. P1 — Gravar dados extraídos pela IA (com regras de confiança/blocklist) ──
    try {
      const { data: leadAtual } = await supabase
        .from('leads')
        .select('contato_nome, contato_email, empresa, cnpj, cidade, uf, cargo, segmento, telefone2, observacoes')
        .eq('id', lead.id)
        .single();
      const leadCtx = (leadAtual ?? lead) as Record<string, unknown>;
      const resultado = await gravarDadosExtraidos(supabase, lead.id as string, leadCtx, claudeResult.dados, claudeResult.confianca);
      if (resultado.gravados.length > 0) {
        console.log('whatsapp-webhook: P1 dados gravados:', resultado.gravados.join(', '));
      }
      if (resultado.bloqueados.length > 0) {
        console.log('whatsapp-webhook: P1 dados bloqueados:', resultado.bloqueados.join(' | '));
      }
    } catch (err) {
      console.error('whatsapp-webhook: gravarDadosExtraidos falhou (não bloqueia resposta):', err);
    }

    // ── 8.2. P4 — Atualizar memória do lead com o resumo da conversa ──
    try {
      await atualizarMemoriaLead(supabase, lead.id as string, {
        resumo: claudeResult.memoria.resumo_curto ?? undefined,
        produto_interesse: claudeResult.memoria.produto_interesse ?? undefined,
        necessidade: claudeResult.memoria.necessidade ?? undefined,
        urgencia: claudeResult.memoria.urgencia ?? undefined,
        proximos_passos: claudeResult.memoria.proximos_passos ?? undefined,
        dados_confirmados: Object.fromEntries(Object.entries(claudeResult.dados).filter(([_, v]) => v !== null && v !== undefined)),
        incrementar_processadas: true,
      });
    } catch (err) {
      console.error('whatsapp-webhook: atualizarMemoriaLead falhou (não bloqueia resposta):', err);
    }

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

    // Update conversation counter (P3 — incremento atômico via RPC)
    await supabase.rpc('incrementar_contador_conversa', {
      p_id: conversation.id,
      p_enviadas: 1,
      p_recebidas: 0,
      p_score: 0,
    });

    // ── 11. Notify Junior on Telegram ───────────────────────
    const statusEmoji = sent ? '✅' : '❌';
    const intentLabel = orcamentoGerado ? '📋 ORÇAMENTO GERADO' : `🏷️ ${intent}`;
    const truncResp = resposta.length > 200 ? resposta.substring(0, 200) + '…' : resposta;
    const truncMsg = textBody.length > 150 ? textBody.substring(0, 150) + '…' : textBody;

    await notifyTelegram(supabase,
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
