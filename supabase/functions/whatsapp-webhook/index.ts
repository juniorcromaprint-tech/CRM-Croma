// supabase/functions/whatsapp-webhook/index.ts
// ⚠️ SYNCED FROM PRODUCTION 2026-05-21 — espelha a edge function DEPLOYADA (Supabase version 35).
//    O repo guardava uma v18 antiga que divergiu da prod (v19-v35 foram deployadas sem commit).
//    Investigacao 2026-05-21 (outputs/2026-05-21-fix-webhook-relatorio.md): o webhook ESTA FUNCIONAL.
//    No-replies intermitentes = falha TRANSITORIA da chamada OpenRouter em generateClaudeResponse,
//    invisivel por 3 motivos: (1) inbound grava status='respondida' hardcoded; (2) caminho null nao
//    cria registro de erro; (3) insert em ai_logs e bloqueado silenciosamente por RLS.
//    >>> 2026-05-21 MIGRACAO ONDA 1: OpenRouter ELIMINADO. callOpenRouter (inline) agora chama
//        Anthropic API direto (claude-sonnet-4-20250514, fallback claude-haiku-4-5-20251001).
//        Hardening aplicado: (achado #2) caminho null cria agent_messages status='erro' erro_codigo='IA_NULL';
//        (achado #1) ai_logs.user_id nullable + insert defensivo. NAO mexido: status='respondida' do inbound (fora de escopo).
// ======================================================================
// supabase/functions/whatsapp-webhook/index.ts
// v18 (2026-05-11, migration 151) — captura errors[0].code + error_data.details em status='failed'.
//                                    Permite RPC private.fn_auto_marcar_sem_whatsapp identificar
//                                    leads com numero invalido permanente (codigo 131026 etc).
//                                    Inlined ai-shared/* para single-file deploy.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ═══════════════════════════════════════════════════════════════════════
// ai-shared/* inlined (types + helpers + openrouter + whatsapp-credentials)
// ═══════════════════════════════════════════════════════════════════════

type AIModel = string;
interface AIRequestConfig {
  model?: AIModel;
  temperature?: number;
  max_tokens?: number;
  timeout_ms?: number;
  text_mode?: boolean;
}
// 2026-05-21: preços Anthropic API direto (USD por 1M tokens). OpenRouter eliminado.
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-opus-4-7': { input: 15.00, output: 75.00 },
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
};

function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

// ── WhatsApp credentials helper ───────────────────────────────────────
interface WhatsAppCredentials {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
  apiVersion: string;
}
type WhatsAppCredentialsResult =
  | ({ ok: true } & WhatsAppCredentials)
  | { ok: false; missing: string[]; message: string };

async function getWhatsAppCredentials(supabase: any): Promise<WhatsAppCredentialsResult> {
  const REQUIRED_KEYS = ['WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_BUSINESS_ACCOUNT_ID','WHATSAPP_API_VERSION'];
  const { data: configs, error } = await supabase.from('admin_config').select('chave, valor').in('chave', REQUIRED_KEYS);
  if (error) return { ok: false, missing: ['<query failed>'], message: 'Falha admin_config: ' + (error.message ?? error) };
  const cfg: Record<string, string> = {};
  for (const c of configs ?? []) cfg[c.chave] = c.valor;
  const accessToken = cfg['WHATSAPP_ACCESS_TOKEN'];
  const phoneNumberId = cfg['WHATSAPP_PHONE_NUMBER_ID'];
  const wabaId = cfg['WHATSAPP_BUSINESS_ACCOUNT_ID'];
  const apiVersion = cfg['WHATSAPP_API_VERSION'] || 'v22.0';
  const missing: string[] = [];
  if (!accessToken) missing.push('WHATSAPP_ACCESS_TOKEN');
  if (!phoneNumberId) missing.push('WHATSAPP_PHONE_NUMBER_ID');
  if (!wabaId) missing.push('WHATSAPP_BUSINESS_ACCOUNT_ID');
  if (missing.length > 0) return { ok: false, missing, message: 'Credenciais ausentes: ' + missing.join(', ') };
  return { ok: true, accessToken, phoneNumberId, wabaId, apiVersion };
}

async function postToMetaCloud(creds: WhatsAppCredentials, payload: Record<string, unknown>): Promise<{ ok: true; metaData: Record<string, unknown> } | { ok: false; status: number; body: string }> {
  const url = `https://graph.facebook.com/${creds.apiVersion}/${creds.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const body = await res.text(); return { ok: false, status: res.status, body: body.substring(0, 1000) }; }
  return { ok: true, metaData: await res.json() };
}

// ── Anthropic provider (API direto — OpenRouter ELIMINADO 2026-05-21) ───────────────────────────────────────────────
// Chama Anthropic API direto (1 ponto de falha em vez de 2). Nome `callOpenRouter` mantido (drop-in).
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL: AIModel = 'claude-haiku-4-5-20251001';
// Mapeia IDs antigos do OpenRouter → IDs Anthropic diretos (compat. com chamadores que ainda passam strings antigas)
const MODEL_MAP: Record<string, string> = {
  'openai/gpt-4.1-mini': 'claude-haiku-4-5-20251001',
  'openai/gpt-4.1': 'claude-sonnet-4-20250514',
  'anthropic/claude-haiku-3.5': 'claude-haiku-4-5-20251001',
  'anthropic/claude-sonnet-4': 'claude-sonnet-4-20250514',
};
function resolveModel(m?: string): string {
  if (!m) return DEFAULT_MODEL;
  if (MODEL_MAP[m]) return MODEL_MAP[m];
  if (m.startsWith('claude-')) return m;
  return DEFAULT_MODEL;
}
let _fallbackOverride: AIModel | null = null;
function setFallbackModel(m: AIModel) { _fallbackOverride = m; }
function getFallbackModel(): AIModel { return resolveModel(_fallbackOverride ?? 'claude-haiku-4-5-20251001'); }
interface AICallResult { content: string; model_used: string; tokens_input: number; tokens_output: number; cost_usd: number; duration_ms: number; }

// Anthropic não tem response_format json_object — extrai JSON do texto bruto (igual o openrouter-provider fazia).
function extractJSON(raw: string): string {
  try { JSON.parse(raw); return raw; } catch { /* continua */ }
  const md = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (md?.[1]) { const c = md[1].trim(); try { JSON.parse(c); return c; } catch { /* continua */ } }
  const obj = raw.match(/(\{[\s\S]*\})/);
  if (obj?.[1]) { try { JSON.parse(obj[1]); return obj[1]; } catch { /* continua */ } }
  return raw;
}

async function callOpenRouter(systemPrompt: string, userPrompt: string, config?: AIRequestConfig): Promise<AICallResult> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  const model = resolveModel(config?.model);
  const startTime = Date.now();
  const fetchIt = async (m: string) => {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), config?.timeout_ms ?? 30000);
    try {
      // 2026-05-21: claude-opus-4-7 DEPRECOU o parâmetro `temperature` (retorna 400). Só envia p/ modelos que aceitam.
      const reqBody: Record<string, unknown> = { model: m, max_tokens: config?.max_tokens ?? 2000, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] };
      if (!m.includes('opus-4-7')) reqBody.temperature = config?.temperature ?? 0.3;
      const resp = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify(reqBody),
        signal: ctrl.signal,
      });
      if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${await resp.text()}`);
      return await resp.json();
    } finally { clearTimeout(tid); }
  };
  // Resiliência: se o modelo primário falhar (erro transitório), tenta o fallback (Haiku) uma vez.
  let response: any; let used = model;
  try { response = await fetchIt(model); }
  catch (e) {
    const fb = getFallbackModel();
    if (model === fb) throw e;
    response = await fetchIt(fb); used = fb;
  }
  const usage = response.usage ?? { input_tokens: 0, output_tokens: 0 };
  const costs = MODEL_COSTS[used] ?? MODEL_COSTS['claude-haiku-4-5-20251001'];
  const costUsd = (usage.input_tokens * costs.input + usage.output_tokens * costs.output) / 1_000_000;
  const rawContent = response.content?.[0]?.text ?? '';
  return { content: extractJSON(rawContent), model_used: used, tokens_input: usage.input_tokens, tokens_output: usage.output_tokens, cost_usd: costUsd, duration_ms: Date.now() - startTime };
}

// ═══════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════
let _telegramToken: string | null = null;
const JUNIOR_CHAT_ID = '1065519625';
async function getTelegramToken(supabase: any): Promise<string> {
  if (_telegramToken) return _telegramToken;
  _telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
  if (!_telegramToken) {
    const { data } = await supabase.from('admin_config').select('valor').eq('chave', 'TELEGRAM_BOT_TOKEN').single();
    _telegramToken = data?.valor ?? '';
  }
  return _telegramToken;
}
// 2026-05-21 noite: arquitetura mudando para ponte Cowork (zero API custo via plano Max).
// Estes 2 modelos SÓ são usados como FALLBACK quando o scheduled task da ponte estiver
// indisponível (caminho normal: webhook grava em ai_requests, Cowork processa via MCP).
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';      // FALLBACK primário (qualidade > custo, evento raro)
const FALLBACK_MODEL = 'claude-haiku-4-5-20251001';   // FALLBACK do fallback (transitorio Sonnet)
const ESCALATION_KEYWORDS = /\b(cancelar|cancelamento|reclamação|reclamar|insatisfeito|problema grave|advogado|procon|processo|jurídico|péssimo|horrível|nunca mais|devolver|reembolso)\b/i;

const BOT_PATTERNS: { regex: RegExp; tipo: string }[] = [
  { regex: /agradecemos?\s+(o\s+)?seu\s+contato/i, tipo: 'saudacao_automatica' },
  { regex: /obrigad[oa]\s+por\s+entrar\s+em\s+contato/i, tipo: 'saudacao_automatica' },
  { regex: /agradece\s+seu\s+contato/i, tipo: 'saudacao_automatica' },
  { regex: /\bsou\s+(o|a)?\s*(assistente|atendente)\s+virtual\b/i, tipo: 'assistente_virtual' },
  { regex: /\b(assistente|atendente)\s+virtual\s+d[ao]\b/i, tipo: 'assistente_virtual' },
  { regex: /\batendimento\s+autom[aá]tico\b/i, tipo: 'atendimento_automatico' },
  { regex: /\bbot\s+d[ao]\s+atendimento\b/i, tipo: 'assistente_virtual' },
  { regex: /\b(eu\s+)?vou\s+te\s+enviar\s+algumas\s+perguntas\b/i, tipo: 'assistente_virtual' },
  { regex: /por\s+gentileza,?\s+(escolha|selecione|digite)/i, tipo: 'menu_ura' },
  { regex: /escolha\s+(uma\s+|a\s+)?op[cç][aã]o/i, tipo: 'menu_ura' },
  { regex: /selecione\s+(uma\s+|a\s+)?op[cç][aã]o/i, tipo: 'menu_ura' },
  { regex: /digite\s+\d+\s+para/i, tipo: 'menu_ura' },
  { regex: /clicar\s+na\s+op[cç][aã]o\s+que\s+mais\s+se\s+encaixa/i, tipo: 'menu_ura' },
  { regex: /\*?\s*1\s*\*?\s*[-–]\s*\w[^\n]{0,40}[\s\S]{0,80}\*?\s*2\s*\*?\s*[-–]\s*\w/i, tipo: 'menu_ura' },
  { regex: /(nosso\s+)?hor[aá]rio\s+de\s+atendimento\s+(via\s+whatsapp\s+)?[éeè]/i, tipo: 'horario_automatico' },
  { regex: /atendimento\s+via\s+whatsapp\s+(de|é)\s+(seg|2)/i, tipo: 'horario_automatico' },
  { regex: /fora\s+do\s+(nosso\s+)?hor[aá]rio\s+(de\s+)?atendimento/i, tipo: 'horario_automatico' },
  { regex: /central\s+24h/i, tipo: 'horario_automatico' },
];

const BOT_INVISIBLE_PREFIX = /^[\u200E\u200F\u202A-\u202E\u2066-\u2069]/;

function normalizarTexto(s: string): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036F]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function similaridade(a: string, b: string): number {
  const na = normalizarTexto(a); const nb = normalizarTexto(b);
  if (!na || !nb) return 0; if (na === nb) return 1;
  const min = Math.min(na.length, nb.length);
  if (min >= 40) { const slice = Math.min(120, min); if (na.startsWith(nb.slice(0, slice)) || nb.startsWith(na.slice(0, slice))) return 0.95; }
  const tA = new Set(na.split(' ')); const tB = new Set(nb.split(' '));
  let inter = 0; for (const t of tA) if (tB.has(t)) inter++;
  const union = new Set([...tA, ...tB]).size;
  return union ? inter / union : 0;
}

interface DeteccaoBot { blocked: true; motivo: string; tipo: string; }
async function detectarBotOuLoop(supabase: any, conversationId: string, mensagemAtual: string): Promise<DeteccaoBot | null> {
  const texto = (mensagemAtual ?? '').trim();
  if (!texto) return null;
  if (BOT_INVISIBLE_PREFIX.test(texto)) return { blocked: true, motivo: 'Mensagem com caracter invisível típico de bot WhatsApp Business', tipo: 'bot_signature_char' };
  for (const { regex, tipo } of BOT_PATTERNS) { if (regex.test(texto)) return { blocked: true, motivo: `Padrão detectado: ${tipo}`, tipo }; }
  const { data: ultimas } = await supabase.from('agent_messages').select('conteudo, created_at').eq('conversation_id', conversationId).eq('direcao', 'recebida').order('created_at', { ascending: false }).limit(3);
  if (ultimas && ultimas.length >= 2) {
    const cs = ultimas.map((m: any) => (m.conteudo as string) ?? '');
    let pares = 0;
    if (similaridade(cs[0], cs[1]) >= 0.9) pares++;
    if (cs.length >= 3 && similaridade(cs[0], cs[2]) >= 0.9) pares++;
    if (cs.length >= 3 && similaridade(cs[1], cs[2]) >= 0.9) pares++;
    if (pares >= 1 && cs.length >= 3) return { blocked: true, motivo: 'Contraparte enviou mensagens praticamente idênticas em sequência', tipo: 'loop_repeticao' };
  }
  const cincoMinAtras = new Date(Date.now() - 5 * 60_000).toISOString();
  const { count: enviadasRecentes } = await supabase.from('agent_messages').select('id', { count: 'exact', head: true }).eq('conversation_id', conversationId).eq('direcao', 'enviada').gte('created_at', cincoMinAtras);
  if ((enviadasRecentes ?? 0) >= 5) return { blocked: true, motivo: `Circuit breaker: ${enviadasRecentes} respostas enviadas em 5min`, tipo: 'circuit_breaker' };
  return null;
}

function normalizePhone(raw: string): string { const d = raw.replace(/\D/g, ''); if (d.startsWith('55') && d.length >= 12) return d; if (d.length === 11 || d.length === 10) return `55${d}`; return d; }
function last10(p: string): string { return p.replace(/\D/g, '').slice(-10); }

async function validateSignature(req: Request, rawBody: string): Promise<boolean> {
  let appSecret = Deno.env.get('WHATSAPP_APP_SECRET');
  if (!appSecret) {
    const supabase = getServiceClient();
    const { data } = await supabase.from('admin_config').select('valor').eq('chave', 'WHATSAPP_APP_SECRET').single();
    appSecret = data?.valor ?? null;
  }
  if (!appSecret) { console.warn('whatsapp-webhook: WHATSAPP_APP_SECRET not set — accepting without validation'); return true; }
  const signature = req.headers.get('x-hub-signature-256');
  if (!signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const sigHex = 'sha256=' + Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return sigHex === signature;
}

async function notifyTelegram(supabase: any, text: string): Promise<void> {
  try {
    const token = await getTelegramToken(supabase);
    if (!token) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: JUNIOR_CHAT_ID, text, parse_mode: 'Markdown' }),
    });
  } catch (err) { console.error('whatsapp-webhook: Telegram notification failed:', err); }
}

async function sendWhatsApp(supabase: any, toPhone: string, message: string): Promise<boolean> {
  try {
    const credsResult = await getWhatsAppCredentials(supabase);
    if (!credsResult.ok) { console.error('whatsapp-webhook: Missing WhatsApp credentials —', credsResult.message); return false; }
    const result = await postToMetaCloud(credsResult, { messaging_product: 'whatsapp', to: toPhone, type: 'text', text: { body: message } });
    if (!result.ok) { console.error('whatsapp-webhook: WhatsApp send failed:', result.status, result.body); return false; }
    return true;
  } catch (err) { console.error('whatsapp-webhook: WhatsApp send error:', err); return false; }
}

interface CatalogoConfig { produtos: string[]; diferenciais: string[]; regra_inclusao: string; }
interface LicoesConfig { licoes: string[]; }

async function loadCatalogoELicoes(supabase: any): Promise<{ catalogo: CatalogoConfig | null; licoes: LicoesConfig | null }> {
  try {
    const { data } = await supabase.from('admin_config').select('chave, valor').in('chave', ['agent_catalogo', 'agente_licoes']);
    let catalogo: CatalogoConfig | null = null; let licoes: LicoesConfig | null = null;
    for (const row of data ?? []) {
      const v = typeof row.valor === 'string' ? JSON.parse(row.valor) : row.valor;
      if (row.chave === 'agent_catalogo') catalogo = v as CatalogoConfig;
      if (row.chave === 'agente_licoes') licoes = v as LicoesConfig;
    }
    return { catalogo, licoes };
  } catch (err) { console.error('loadCatalogoELicoes:', err); return { catalogo: null, licoes: null }; }
}

function buildCromaSystemPrompt(dadosFaltantes: string[], catalogo: CatalogoConfig | null, licoes: LicoesConfig | null): string {
  const coletaDados = dadosFaltantes.length > 0 ? `\n## COLETA DE DADOS — PRIORIDADE\nAntes de gerar qualquer orçamento formal, você PRECISA coletar os seguintes dados que ainda faltam do cliente:\n${dadosFaltantes.map(d => `- ${d}`).join('\n')}\n\nPeça essas informações de forma natural e amigável na conversa. Exemplo: "Para formalizar o orçamento, preciso de alguns dados: seu nome completo, email para envio e a cidade/estado de vocês."\nNÃO gere orçamento sem ter pelo menos: nome completo, email e cidade/estado.\n` : '';
  const produtosLista = catalogo?.produtos?.length ? catalogo.produtos.map(p => `- ${p}`).join('\n') : `- Banners, lonas, adesivos, placas, fachadas ACM, letras caixa, cavaletes, totens, material PDV, envelopamento veicular, postes de monitoramento, comunicação visual para empresas de segurança, projetos sob medida`;
  const diferenciaisLista = catalogo?.diferenciais?.length ? catalogo.diferenciais.map(d => `- ${d}`).join('\n') : '- Produção própria, atendimento nacional, solução do projeto à instalação';
  const regraInclusao = catalogo?.regra_inclusao ?? 'Se o cliente perguntar por algo que não está na lista, NÃO afirmar categoricamente que não fazemos. Responder: "A Croma trabalha com comunicação visual e projetos sob medida. Consigo verificar com a equipe e confirmar a melhor solução para você."';
  const licoesBloco = licoes?.licoes?.length ? `\n## LIÇÕES APRENDIDAS (regras globais — sempre respeitar)\n${licoes.licoes.map(l => `- ${l}`).join('\n')}\n` : '';
  return `Você é o vendedor consultivo da *Croma Print Comunicação Visual*, respondendo clientes via WhatsApp.\n\n## SOBRE A EMPRESA\n- Produção própria em Nova Hartz/RS, atendimento nacional\n- Especialidade: redes de lojas, franquias, grandes varejistas\n- Clientes de referência: Beira Rio, Renner, Paquetá\n- 6 funcionários de produção, faturamento médio R$ 110.000/mês\n- Responsável: Junior (dono)\n\n## CATÁLOGO DE PRODUTOS (atualizado de admin_config)\n${produtosLista}\n\n## DIFERENCIAIS\n${diferenciaisLista}\n\n## REGRA DE INCLUSÃO (IMPORTANTE)\n${regraInclusao}\n${licoesBloco}\n\n## FAIXAS DE PREÇO (referência — orçamento formal calculado pelo sistema)\n- *Banners/Lonas*: a partir de R$ 25/m²\n- *Adesivos*: a partir de R$ 35/m²\n- *Fachadas ACM*: a partir de R$ 450/m²\n- *Placas PVC*: a partir de R$ 90/m²\n- *Letras caixa*: a partir de R$ 85/letra\n- *Cavaletes*: R$ 120 a R$ 350\n- *Material PDV*: displays a partir de R$ 45\n- ATENÇÃO: estes são valores de *REFERÊNCIA*. O orçamento formal terá o preço exato calculado automaticamente pelo sistema.\n${coletaDados}\n## REGRAS DE RESPOSTA\n1. SEMPRE em português brasileiro, profissional mas caloroso\n2. Máximo 2-3 parágrafos curtos (WhatsApp = tela pequena)\n3. Use *negrito* para destaques importantes\n4. Emojis com moderação (1-2 por mensagem)\n5. NUNCA invente preços\n6. Se o cliente pedir preço → peça: produto, dimensões, quantidade, acabamento\n7. Se o cliente já informou produto + dimensões + quantidade → diga que vai gerar o orçamento\n8. NÃO assine cada mensagem.\n\n## DADOS DE PAGAMENTO\n- *PIX*: CNPJ 18.923.994/0001-83 (Croma Print Comunicação Visual)\n- *Email oficial*: junior@cromaprint.com.br\n\n## FORMATO DA RESPOSTA — JSON OBRIGATÓRIO\n{\n  "resposta_texto": "texto curto",\n  "intent": "conversa|coleta_dados|orcamento|formalizar|suporte|reclamacao",\n  "dados_extraidos": { "nome": null, "email": null, "telefone": null, "empresa": null, "cnpj": null, "cidade": null, "uf": null, "cargo": null, "segmento": null, "endereco": null, "necessidade": null, "urgencia": null, "produto_interesse": null },\n  "confianca": { "nome": "alta|media|baixa", "email": "alta|media|baixa", "telefone": "alta|media|baixa", "empresa": "alta|media|baixa", "cnpj": "alta|media|baixa", "cidade": "alta|media|baixa", "uf": "alta|media|baixa" },\n  "memoria_atualizar": { "produto_interesse": null, "necessidade": null, "urgencia": null, "proximos_passos": null, "resumo_curto": null }\n}\n\nREGRAS DE INTENT: Só marque "orcamento" ou "formalizar" se nome+email+cidade JÁ foram coletados.\nREGRAS DE EXTRAÇÃO: nome NUNCA cargo/bot. email validar @ e domínio. cnpj 14 dígitos. uf 2 letras.\nREGRAS DE MEMÓRIA: resumo_curto 1-2 frases sobrescreve anterior.`;
}

function checkDadosFaltantes(lead: Record<string, unknown>): string[] {
  const f: string[] = [];
  const nome = (lead.contato_nome as string) || '';
  if (!nome || nome.split(' ').length < 2) f.push('Nome completo');
  if (!lead.contato_email && !lead.email) f.push('Email');
  if (!lead.empresa || lead.empresa === nome || (lead.empresa as string)?.startsWith('WhatsApp ')) f.push('Nome da empresa');
  const obs = ((lead.observacoes as string) || '').toLowerCase();
  const hasCidade = obs.includes('cidade') || obs.includes('estado') || obs.includes('/rs') || obs.includes('/sp');
  if (!hasCidade && !lead.segmento) f.push('Cidade/Estado');
  return f;
}

async function tryUpdateLeadFromMessage(supabase: any, leadId: string, message: string, currentLead: Record<string, unknown>): Promise<void> {
  const updates: Record<string, unknown> = {};
  const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
  if (emailMatch && !currentLead.contato_email) updates.contato_email = emailMatch[0].toLowerCase();
  const cidadeMatch = message.match(/(?:de|em|sou de|fico em|estou em|moro em|cidade[:\s]*)\s*([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)*)\s*[-\/]\s*([A-Z]{2})/i);
  if (cidadeMatch) {
    const obsAtual = (currentLead.observacoes as string) || '';
    if (!obsAtual.includes(cidadeMatch[1])) updates.observacoes = obsAtual ? `${obsAtual} | Cidade: ${cidadeMatch[1]}/${cidadeMatch[2]}` : `Cidade: ${cidadeMatch[1]}/${cidadeMatch[2]}`;
  }
  const nomeMatch = message.match(/(?:meu nome[:\s]+(?:é\s+)?|me chamo\s+|sou\s+(?:o|a)?\s*)([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)+)/i);
  if (nomeMatch && (!currentLead.contato_nome || (currentLead.contato_nome as string).split(' ').length < 2)) updates.contato_nome = nomeMatch[1].trim();
  const empresaMatch = message.match(/(?:empresa[:\s]+(?:é\s+)?|trabalho\s+(?:na|no)\s+|sou\s+(?:da|do)\s+)([A-ZÀ-Ü][^\n,]{2,40})/i);
  if (empresaMatch && (!currentLead.empresa || (currentLead.empresa as string).startsWith('WhatsApp '))) updates.empresa = empresaMatch[1].trim();
  if (Object.keys(updates).length > 0) { updates.updated_at = new Date().toISOString(); await supabase.from('leads').update(updates).eq('id', leadId); }
}

interface LeadMemoria { resumo: string; dados_confirmados: Record<string, unknown>; produto_interesse: string | null; necessidade: string | null; urgencia: string | null; proximos_passos: string | null; mensagens_processadas: number; }
async function lerMemoriaLead(supabase: any, leadId: string): Promise<LeadMemoria | null> {
  try {
    const { data } = await supabase.from('lead_memoria').select('resumo, dados_confirmados, produto_interesse, necessidade, urgencia, proximos_passos, mensagens_processadas').eq('lead_id', leadId).maybeSingle();
    return data as LeadMemoria | null;
  } catch { return null; }
}
async function atualizarMemoriaLead(supabase: any, leadId: string, patch: Partial<LeadMemoria> & { incrementar_processadas?: boolean }): Promise<void> {
  try {
    const atual = await lerMemoriaLead(supabase, leadId);
    const novoResumo = patch.resumo ?? atual?.resumo ?? '';
    const novosDados = { ...(atual?.dados_confirmados ?? {}), ...(patch.dados_confirmados ?? {}) };
    const upsert = { lead_id: leadId, resumo: novoResumo.substring(0, 2000), dados_confirmados: novosDados, produto_interesse: patch.produto_interesse ?? atual?.produto_interesse ?? null, necessidade: patch.necessidade ?? atual?.necessidade ?? null, urgencia: patch.urgencia ?? atual?.urgencia ?? null, proximos_passos: patch.proximos_passos ?? atual?.proximos_passos ?? null, mensagens_processadas: (atual?.mensagens_processadas ?? 0) + (patch.incrementar_processadas ? 1 : 0), atualizado_em: new Date().toISOString() };
    await supabase.from('lead_memoria').upsert(upsert, { onConflict: 'lead_id' }).select().single();
  } catch (err) { console.error('atualizarMemoriaLead:', err); }
}

const NOMES_BLOCKLIST = /^(assistente|atendente|atendimento|comercial|financeiro|suporte|bot|ura|robo|virtual|automatico|sac|callcenter|cobranca|recepcao|vendas|administracao|secretaria|gerencia)\b/i;
function isValidEmail(e: string): boolean { return /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(e.trim()); }
function digitsOnly(s: string): string { return (s ?? '').replace(/\D/g, ''); }
function isValidCNPJ(c: string): boolean { const d = digitsOnly(c); if (d.length !== 14) return false; if (/^(\d)\1{13}$/.test(d)) return false; return true; }

interface DadosExtraidos { nome?: string | null; email?: string | null; telefone?: string | null; empresa?: string | null; cnpj?: string | null; cidade?: string | null; uf?: string | null; cargo?: string | null; segmento?: string | null; endereco?: string | null; necessidade?: string | null; urgencia?: string | null; produto_interesse?: string | null; }
type ConfiancaLevel = 'alta' | 'media' | 'baixa';
type Confiancas = Partial<Record<keyof DadosExtraidos, ConfiancaLevel>>;

async function gravarDadosExtraidos(supabase: any, leadId: string, currentLead: Record<string, unknown>, dados: DadosExtraidos, confianca: Confiancas): Promise<{ ok: boolean; gravados: string[]; bloqueados: string[]; observacao_extra: string[] }> {
  const updates: Record<string, unknown> = {};
  const bloqueados: string[] = []; const obsExtras: string[] = [];
  const conf = (k: keyof DadosExtraidos): ConfiancaLevel => (confianca[k] as ConfiancaLevel) ?? 'baixa';
  if (dados.nome) {
    const nome = dados.nome.trim();
    if (NOMES_BLOCKLIST.test(nome)) bloqueados.push(`nome:"${nome}" (parece cargo/bot)`);
    else if (conf('nome') !== 'baixa') {
      const palavras = nome.split(/\s+/).filter(Boolean);
      const nomeAtual = (currentLead.contato_nome as string) ?? '';
      if (palavras.length === 1) { if (!nomeAtual || nomeAtual.startsWith('WhatsApp ')) updates.contato_nome = nome; }
      else if (palavras.length >= 2) { const ap = nomeAtual.split(/\s+/).filter(Boolean).length; if (ap < 2 || conf('nome') === 'alta') updates.contato_nome = nome; }
    }
  }
  if (dados.email && isValidEmail(dados.email)) { if (!currentLead.contato_email || conf('email') === 'alta') updates.contato_email = dados.email.toLowerCase().trim(); }
  if (dados.cnpj && isValidCNPJ(dados.cnpj)) { if (!currentLead.cnpj || conf('cnpj') === 'alta') updates.cnpj = digitsOnly(dados.cnpj); }
  if (dados.empresa) {
    const empresa = dados.empresa.trim();
    const ea = (currentLead.empresa as string) ?? '';
    if (!NOMES_BLOCKLIST.test(empresa) && (!ea || ea.startsWith('WhatsApp ') || (conf('empresa') === 'alta' && empresa.toLowerCase() !== ea.toLowerCase()))) updates.empresa = empresa.substring(0, 200);
  }
  if (dados.cidade && (!currentLead.cidade || conf('cidade') === 'alta')) updates.cidade = dados.cidade.trim().substring(0, 100);
  if (dados.uf && /^[A-Za-z]{2}$/.test(dados.uf.trim()) && (!currentLead.uf || conf('uf') === 'alta')) updates.uf = dados.uf.trim().toUpperCase();
  if (dados.cargo && !currentLead.cargo) updates.cargo = dados.cargo.trim().substring(0, 100);
  if (dados.segmento && !currentLead.segmento) updates.segmento = dados.segmento.trim().substring(0, 100);
  if (dados.telefone) { const tD = digitsOnly(dados.telefone); if (tD.length >= 10 && !currentLead.telefone2) updates.telefone2 = tD; }
  if (dados.necessidade) obsExtras.push(`Necessidade: ${dados.necessidade}`);
  if (dados.urgencia) obsExtras.push(`Urgência: ${dados.urgencia}`);
  if (dados.produto_interesse) obsExtras.push(`Interesse: ${dados.produto_interesse}`);
  if (dados.endereco) obsExtras.push(`Endereço: ${dados.endereco}`);
  if (obsExtras.length > 0) {
    const obsAtual = (currentLead.observacoes as string) ?? '';
    const novas = obsExtras.filter(o => !obsAtual.includes(o.split(':')[0] + ':'));
    if (novas.length > 0) updates.observacoes = (obsAtual ? `${obsAtual} | ${novas.join(' | ')}` : novas.join(' | ')).substring(0, 2000);
  }
  if (Object.keys(updates).length === 0) return { ok: true, gravados: [], bloqueados, observacao_extra: obsExtras };
  updates.updated_at = new Date().toISOString();
  const { error } = await supabase.from('leads').update(updates).eq('id', leadId).select().single();
  if (error) return { ok: false, gravados: [], bloqueados, observacao_extra: obsExtras };
  const camposGravados = Object.keys(updates).filter(k => k !== 'updated_at');
  await supabase.from('atividades_comerciais').insert({ entidade_tipo: 'lead', entidade_id: leadId, tipo: 'sistema', descricao: `[IA-Extração] Atualizou: ${camposGravados.join(', ')}` + (bloqueados.length > 0 ? ` | Bloqueado: ${bloqueados.join('; ')}` : ''), resultado: 'sucesso', data_atividade: new Date().toISOString() });
  return { ok: true, gravados: camposGravados, bloqueados, observacao_extra: obsExtras };
}

async function gerarOrcamentoReal(supabase: any, conversationId: string, leadId: string, canal: string): Promise<{ success: boolean; portalUrl?: string; total?: number; numero?: string; propostaId?: string; mensagem?: string }> {
  try {
    const { data: msgs } = await supabase.from('agent_messages').select('direcao, conteudo').eq('conversation_id', conversationId).order('created_at', { ascending: true }).limit(20);
    const mensagens = (msgs ?? []).map((m: any) => ({ direcao: m.direcao as string, conteudo: m.conteudo as string }));
    const orcamentoUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-gerar-orcamento`;
    const resp = await fetch(orcamentoUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` }, body: JSON.stringify({ conversation_id: conversationId, lead_id: leadId, mensagens, canal }) });
    const result = await resp.json();
    if (result.status === 'proposta_criada') return { success: true, portalUrl: result.portal_url, total: result.total, numero: result.proposta_numero, propostaId: result.proposta_id };
    return { success: false, mensagem: result.status === 'info_faltante' ? 'Preciso de mais informações para gerar o orçamento.' : 'Não consegui gerar o orçamento automaticamente.' };
  } catch (err) { console.error('whatsapp-webhook: ai-gerar-orcamento call failed:', err); return { success: false, mensagem: 'Erro ao gerar orçamento no sistema.' }; }
}

interface ClaudeStructuredResponse { text: string; intent: string; dados: DadosExtraidos; confianca: Confiancas; memoria: { produto_interesse?: string | null; necessidade?: string | null; urgencia?: string | null; proximos_passos?: string | null; resumo_curto?: string | null }; }

async function generateClaudeResponse(supabase: any, lead: Record<string, unknown>, conversation: Record<string, unknown>, incomingMessage: string, contactName: string): Promise<ClaudeStructuredResponse | null> {
  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) { console.error('whatsapp-webhook: ANTHROPIC_API_KEY not configured — cannot generate response'); return null; }
    setFallbackModel(FALLBACK_MODEL);
    const { catalogo, licoes } = await loadCatalogoELicoes(supabase);
    const memoria = await lerMemoriaLead(supabase, lead.id as string);
    const { data: recentMsgs } = await supabase.from('agent_messages').select('direcao, conteudo, created_at, media_type, media_url, media_transcription').eq('conversation_id', conversation.id).order('created_at', { ascending: false }).limit(10);
    const historico = (recentMsgs ?? []).reverse().map((m: any) => {
      const who = m.direcao === 'recebida' ? 'CLIENTE' : 'CROMA';
      const tr = (m.media_transcription as string | null) ?? null;
      if (m.media_type === 'image') return `${who}: [Cliente enviou uma IMAGEM] (URL: ${m.media_url ?? 'não disponível'})`;
      if (m.media_type === 'audio') return tr ? `${who}: [áudio] "${tr}"` : `${who}: [áudio - transcrição indisponível]`;
      if (m.media_type === 'video') return tr ? `${who}: [vídeo] "${tr}"` : `${who}: [vídeo]`;
      if (m.media_type === 'document') return `${who}: [documento]`;
      return `${who}: ${m.conteudo}`;
    }).join('\n');
    const { data: fullLead } = await supabase.from('leads').select('empresa, contato_nome, contato_email, segmento, temperatura, observacoes, status').eq('id', lead.id).single();
    const { data: pedidos } = await supabase.from('pedidos').select('id, numero, status, valor_total').eq('cliente_id', lead.id).order('created_at', { ascending: false }).limit(3);
    const dadosFaltantes = checkDadosFaltantes(fullLead || lead);
    const memoriaBloco = memoria ? [`## MEMÓRIA`, memoria.resumo ? `Resumo: ${memoria.resumo}` : '', memoria.produto_interesse ? `Produto: ${memoria.produto_interesse}` : '', memoria.necessidade ? `Necessidade: ${memoria.necessidade}` : '', memoria.urgencia ? `Urgência: ${memoria.urgencia}` : '', memoria.proximos_passos ? `Próximos: ${memoria.proximos_passos}` : '', `Mensagens processadas: ${memoria.mensagens_processadas ?? 0}`].filter(Boolean).join('\n') : '## MEMÓRIA\n(primeiro contato)';
    const userPrompt = [`## DADOS DO LEAD`, `Nome: ${contactName || fullLead?.contato_nome || 'Não informado'}`, `Email: ${fullLead?.contato_email || 'Não informado'}`, `Empresa: ${fullLead?.empresa || 'Não informada'}`, `Segmento: ${fullLead?.segmento || 'Não identificado'}`, `Temperatura: ${fullLead?.temperatura || 'morno'}`, `Status: ${fullLead?.status || 'novo'}`, fullLead?.observacoes ? `Observações: ${fullLead.observacoes}` : '', dadosFaltantes.length > 0 ? `\n⚠️ DADOS FALTANTES: ${dadosFaltantes.join(', ')}` : '\n✅ Todos os dados coletados', ``, memoriaBloco, ``, pedidos && pedidos.length > 0 ? `## PEDIDOS\n${pedidos.map((p: any) => `- #${p.numero}: ${p.status} (R$ ${p.valor_total})`).join('\n')}` : '## PEDIDOS\nNenhum', ``, `## HISTÓRICO`, historico || '(primeira mensagem)', ``, `## MENSAGEM ATUAL`, incomingMessage, ``, `Retorne SOMENTE o JSON estruturado.`].filter(Boolean).join('\n');
    const aiResult = await callOpenRouter(buildCromaSystemPrompt(dadosFaltantes, catalogo, licoes), userPrompt, { model: CLAUDE_MODEL, temperature: 0.7, max_tokens: 1200, text_mode: false });
    // 2026-05-21 hardening (achado #1): user_id explícito null (coluna agora nullable) + defensivo.
    // Antes: insert silenciava erro de NOT NULL → ai_logs ficava vazio (telemetria/custo invisível).
    try {
      const { error: logErr } = await supabase.from('ai_logs').insert({ user_id: null, function_name: 'auto-resposta-whatsapp', entity_type: 'geral', entity_id: lead.id as string, model_used: aiResult.model_used, tokens_input: aiResult.tokens_input, tokens_output: aiResult.tokens_output, cost_usd: aiResult.cost_usd, duration_ms: aiResult.duration_ms, status: 'success' });
      if (logErr) console.error('whatsapp-webhook: ai_logs insert falhou:', logErr.message);
    } catch (logEx) { console.error('whatsapp-webhook: ai_logs insert exception:', logEx); }
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(aiResult.content); } catch { return { text: String(aiResult.content || '').trim() || 'Recebi sua mensagem! Em instantes te respondo melhor.', intent: 'conversa', dados: {}, confianca: {}, memoria: {} }; }
    const text = String(parsed.resposta_texto ?? '').trim();
    const intent = String(parsed.intent ?? 'conversa');
    const dados = (parsed.dados_extraidos as DadosExtraidos) ?? {};
    const confianca = (parsed.confianca as Confiancas) ?? {};
    const mU = (parsed.memoria_atualizar as Record<string, unknown>) ?? {};
    return { text: text || 'Recebi sua mensagem!', intent, dados, confianca, memoria: { produto_interesse: (mU.produto_interesse as string) ?? null, necessidade: (mU.necessidade as string) ?? null, urgencia: (mU.urgencia as string) ?? null, proximos_passos: (mU.proximos_passos as string) ?? null, resumo_curto: (mU.resumo_curto as string) ?? null } };
  } catch (err) { console.error('whatsapp-webhook: Claude response failed:', err); return null; }
}

async function downloadAndStoreMedia(supabase: any, mediaId: string, mediaType: string, mimeType: string): Promise<{ url: string | null; buffer: ArrayBuffer | null }> {
  try {
    const credsResult = await getWhatsAppCredentials(supabase);
    if (!credsResult.ok) return { url: null, buffer: null };
    const metaRes = await fetch(`https://graph.facebook.com/${credsResult.apiVersion}/${mediaId}`, { headers: { Authorization: `Bearer ${credsResult.accessToken}` }, signal: AbortSignal.timeout(15000) });
    if (!metaRes.ok) return { url: null, buffer: null };
    const metaData = await metaRes.json();
    const downloadUrl = metaData.url as string | undefined;
    if (!downloadUrl) return { url: null, buffer: null };
    const fileRes = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${credsResult.accessToken}` }, signal: AbortSignal.timeout(15000) });
    if (!fileRes.ok) return { url: null, buffer: null };
    const fileBuffer = await fileRes.arrayBuffer();
    const ext = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : mimeType.includes('gif') ? 'gif' : mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mpeg') ? 'mp3' : mimeType.includes('mp4') ? 'mp4' : mimeType.includes('pdf') ? 'pdf' : 'bin';
    const filename = `${mediaType}_${Date.now()}_${mediaId.slice(-8)}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('whatsapp-media').upload(filename, fileBuffer, { contentType: mimeType, upsert: false });
    if (uploadErr) return { url: null, buffer: fileBuffer };
    const { data: urlData } = supabase.storage.from('whatsapp-media').getPublicUrl(filename);
    return { url: urlData?.publicUrl ?? null, buffer: fileBuffer };
  } catch (err) { console.error('whatsapp-webhook: downloadAndStoreMedia error:', err); return { url: null, buffer: null }; }
}

async function transcribeAudio(supabase: any, buffer: ArrayBuffer, mimeType: string): Promise<string | null> {
  try {
    let groqKey = Deno.env.get('GROQ_API_KEY');
    if (!groqKey) { const { data } = await supabase.from('admin_config').select('valor').eq('chave', 'GROQ_API_KEY').single(); groqKey = (data?.valor as string) || ''; }
    if (!groqKey) return null;
    const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp3') ? 'mp3' : 'ogg';
    const fd = new FormData();
    fd.append('file', new Blob([buffer], { type: mimeType || 'audio/ogg' }), `audio.${ext}`);
    fd.append('model', 'whisper-large-v3'); fd.append('language', 'pt'); fd.append('response_format', 'json');
    const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${groqKey}` }, body: fd, signal: AbortSignal.timeout(60000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    return (data?.text as string | undefined)?.trim() ?? null;
  } catch (err) { return null; }
}

// ═══════════════════════════════════════════════════════════════════════
// Main handler
// ═══════════════════════════════════════════════════════════════════════
serve(async (req: Request) => {
  const url = new URL(req.url);
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
    if (mode === 'subscribe' && token === verifyToken && challenge) return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    return new Response('Forbidden', { status: 403 });
  }
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const rawBody = await req.text();
  const valid = await validateSignature(req, rawBody);
  if (!valid) return new Response('Forbidden', { status: 403 });
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(rawBody); } catch { return new Response('Bad Request', { status: 400 }); }
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
        const { data: msgs } = await supabaseStatus.from('agent_messages').select('id, status').contains('metadata', { whatsapp_message_id: waMessageId }).limit(1);
        if (msgs && msgs.length > 0) {
          const newStatus = statusType === 'read' ? 'lida' : statusType === 'delivered' ? 'entregue' : statusType === 'failed' ? 'erro' : (msgs[0] as any).status;
          const updateData: Record<string, unknown> = { status: newStatus };
          if (statusType === 'read') updateData.lido_em = new Date().toISOString();
          if (statusType === 'failed') {
            // v18 (migration 151): capturar codigo + detalhes Meta pra auto-marcacao de leads sem WhatsApp
            const err = (status.errors as any)?.[0];
            updateData.erro_mensagem = err?.message ?? 'Delivery failed';
            updateData.erro_codigo = err?.code != null ? String(err.code) : null;
            updateData.erro_detalhes = err?.error_data?.details ?? err?.title ?? null;
          }
          await supabaseStatus.from('agent_messages').update(updateData).eq('id', (msgs[0] as any).id);
        }
      }
    }

    if (!messages || messages.length === 0) return new Response('OK', { status: 200 });
    const message = messages[0];
    const contact = contacts?.[0];
    let textBody = '';
    let messageOrigin: 'text' | 'button' | 'interactive' | 'media' | 'other' = 'other';
    let mediaInfo: { url: string | null; type: string; mime: string; filename?: string; transcription?: string | null } | null = null;
    if (message.type === 'text') { textBody = (message.text as Record<string, string>)?.body ?? ''; messageOrigin = 'text'; }
    else if (message.type === 'button') { const btn = message.button as Record<string, string> | undefined; textBody = btn?.text ?? btn?.payload ?? ''; messageOrigin = 'button'; }
    else if (message.type === 'interactive') {
      const inter = message.interactive as Record<string, unknown> | undefined;
      const it = inter?.type as string | undefined;
      if (it === 'button_reply') { const br = inter?.button_reply as Record<string, string> | undefined; textBody = br?.title ?? br?.id ?? ''; }
      else if (it === 'list_reply') { const lr = inter?.list_reply as Record<string, string> | undefined; textBody = lr?.title ?? lr?.id ?? ''; }
      messageOrigin = 'interactive';
    }
    else if (['image', 'audio', 'video', 'document'].includes(message.type as string)) {
      const mediaObj = message[message.type as string] as Record<string, string> | undefined;
      const mediaId = mediaObj?.id;
      const mimeType = mediaObj?.mime_type ?? '';
      const caption = mediaObj?.caption ?? '';
      const originalFilename = mediaObj?.filename ?? '';
      let mediaUrl: string | null = null; let transcription: string | null = null;
      if (mediaId) {
        const sM = getServiceClient();
        const dl = await downloadAndStoreMedia(sM, mediaId, message.type as string, mimeType);
        mediaUrl = dl.url;
        if (dl.buffer && (message.type === 'audio' || message.type === 'video')) transcription = await transcribeAudio(sM, dl.buffer, mimeType);
      }
      mediaInfo = { url: mediaUrl, type: message.type as string, mime: mimeType, filename: originalFilename, transcription };
      textBody = caption || transcription || `[${message.type}]`;
      messageOrigin = 'media';
    }
    else return new Response('OK', { status: 200 });
    if (!textBody && !mediaInfo) return new Response('OK', { status: 200 });

    const fromPhone = message.from as string;
    const messageId = message.id as string;
    const contactName = (contact?.profile as Record<string, string>)?.name ?? '';
    const normalizedPhone = normalizePhone(fromPhone);
    const supabase = getServiceClient();
    const now = new Date().toISOString();
    const phoneSearch = last10(normalizedPhone);
    const { data: existingLeads } = await supabase.from('leads').select('id, empresa, contato_nome, contato_telefone, status').ilike('contato_telefone', `%${phoneSearch}%`).limit(1);
    let lead = existingLeads?.[0] ?? null;
    let isNewLead = false;
    if (!lead) {
      const { data: newLead, error: leadErr } = await supabase.from('leads').insert({ empresa: contactName || `WhatsApp ${normalizedPhone}`, contato_nome: contactName || null, contato_telefone: normalizedPhone, status: 'novo', temperatura: 'morno', segmento: null }).select('id, empresa, contato_nome, contato_telefone, status').single();
      if (leadErr || !newLead) return new Response('OK', { status: 200 });
      lead = newLead; isNewLead = true;
    }
    const { data: convRows } = await supabase.from('agent_conversations').select('id, status, mensagens_recebidas, mensagens_enviadas, score_engajamento, automacao_pausada, metadata').eq('lead_id', lead.id).eq('canal', 'whatsapp').in('status', ['ativa', 'escalada']).order('created_at', { ascending: false }).limit(1);
    let conversation = convRows?.[0] ?? null;
    if (!conversation) {
      const { data: newConv, error: convErr } = await supabase.from('agent_conversations').insert({ lead_id: lead.id, canal: 'whatsapp', status: 'ativa', etapa: 'abertura', mensagens_recebidas: 0, mensagens_enviadas: 0, score_engajamento: 0 }).select('id, status, mensagens_recebidas, mensagens_enviadas, score_engajamento, automacao_pausada, metadata').single();
      if (convErr || !newConv) return new Response('OK', { status: 200 });
      conversation = newConv;
    }
    {
      const { data: existing } = await supabase.from('agent_messages').select('id').eq('conversation_id', conversation.id).eq('direcao', 'recebida').contains('metadata', { whatsapp_message_id: messageId }).limit(1);
      if (existing && existing.length > 0) return new Response('OK', { status: 200 });
    }
    const preview = textBody.substring(0, 80) + (textBody.length > 80 ? '…' : '');
    await supabase.from('agent_messages').insert({ conversation_id: conversation.id, direcao: 'recebida', canal: 'whatsapp', conteudo: textBody, status: 'respondida', media_url: mediaInfo?.url ?? null, media_type: mediaInfo?.type ?? null, media_mime: mediaInfo?.mime ?? null, media_filename: mediaInfo?.filename ?? null, media_transcription: mediaInfo?.transcription ?? null, metadata: { whatsapp_message_id: messageId, from_phone: fromPhone, contact_name: contactName, message_origin: messageOrigin, message_type: message.type } });
    await supabase.rpc('incrementar_contador_conversa', { p_id: conversation.id, p_enviadas: 0, p_recebidas: 1, p_score: 15 });
    await supabase.from('atividades_comerciais').insert({ entidade_tipo: 'lead', entidade_id: lead.id, tipo: 'whatsapp', descricao: `[WhatsApp] Mensagem recebida: ${preview}`, resultado: 'recebido', data_atividade: now });
    if (ESCALATION_KEYWORDS.test(textBody) || conversation.status === 'escalada') {
      await supabase.from('agent_conversations').update({ status: 'escalada' }).eq('id', conversation.id);
      const jaEra = conversation.status === 'escalada';
      if (!jaEra) { const ll = isNewLead ? '🆕 NOVO' : '⚠️'; await notifyTelegram(supabase, `${ll} *ESCALAÇÃO WhatsApp*\n\n👤 *${contactName || 'Sem nome'}*\n📞 +${normalizedPhone}\n\n💬 ${textBody.substring(0, 300)}\n\n⚠️ *Detectei reclamação/urgência — NÃO respondi automaticamente.*`); }
      return new Response('OK', { status: 200 });
    }
    if ((conversation as Record<string, unknown>).automacao_pausada === true) return new Response('OK', { status: 200 });
    await tryUpdateLeadFromMessage(supabase, lead.id as string, textBody, lead);
    const deteccao = await detectarBotOuLoop(supabase, conversation.id as string, textBody);
    if (deteccao) {
      const metaAtual = ((conversation as Record<string, unknown>).metadata as Record<string, unknown>) ?? {};
      await supabase.from('agent_conversations').update({ status: 'escalada', automacao_pausada: true, metadata: { ...metaAtual, escalado_por: 'bot_loop_detector', motivo_escalacao: deteccao.motivo, tipo_escalacao: deteccao.tipo, escalado_em: new Date().toISOString() }, updated_at: new Date().toISOString() }).eq('id', conversation.id);
      await supabase.from('atividades_comerciais').insert({ entidade_tipo: 'lead', entidade_id: lead.id, tipo: 'sistema', descricao: `[Auto-resposta PAUSADA] ${deteccao.motivo}`, resultado: 'escalado', data_atividade: new Date().toISOString() });
      const empresa = (lead as Record<string, unknown>).empresa as string | undefined;
      await notifyTelegram(supabase, `🛑 *Auto-resposta PAUSADA — ${deteccao.tipo}*\n\n👤 *${contactName || (lead as Record<string, unknown>).contato_nome || 'Sem nome'}*\n📞 +${normalizedPhone}\n` + (empresa ? `🏢 ${empresa}\n` : '') + `\n🤖 *Motivo:* ${deteccao.motivo}\n\n💬 _Última msg:_ ${textBody.substring(0, 250)}\n\n_Conversa marcada como ESCALADA + automação PAUSADA._`);
      return new Response('OK', { status: 200 });
    }
    const claudeResult = await generateClaudeResponse(supabase, lead, conversation, textBody, contactName);
    if (!claudeResult) {
      // 2026-05-21 hardening (achado #2): registrar visibilidade do erro — antes SÓ notificava Telegram (no-reply invisível).
      try {
        await supabase.from('agent_messages').insert({
          conversation_id: conversation.id, direcao: 'enviada', canal: 'whatsapp',
          conteudo: '[IA não gerou resposta — nada enviado ao cliente]', status: 'erro',
          erro_codigo: 'IA_NULL', erro_mensagem: 'IA não gerou resposta (provider returned null)',
          metadata: { auto_generated: false, lead_id: lead.id, modelo_ia: CLAUDE_MODEL, sent_success: false },
        }).select('id').single();
      } catch (errIns) { console.error('whatsapp-webhook: falha ao registrar agent_messages IA_NULL:', errIns); }
      await notifyTelegram(supabase,`📱 *WhatsApp — ${isNewLead ? '🆕 NOVO LEAD' : '💬 MENSAGEM'}*\n\n👤 *${contactName || 'Sem nome'}*\n📞 +${normalizedPhone}\n\n💬 ${textBody.substring(0, 300)}\n\n⚠️ _Não consegui gerar resposta automática. Responda manualmente._`);
      return new Response('OK', { status: 200 });
    }
    let resposta = claudeResult.text;
    const intent = claudeResult.intent;
    let orcamentoGerado = false;
    try {
      const { data: leadAtual } = await supabase.from('leads').select('contato_nome, contato_email, empresa, cnpj, cidade, uf, cargo, segmento, telefone2, observacoes').eq('id', lead.id).single();
      const leadCtx = (leadAtual ?? lead) as Record<string, unknown>;
      await gravarDadosExtraidos(supabase, lead.id as string, leadCtx, claudeResult.dados, claudeResult.confianca);
    } catch (err) { console.error('whatsapp-webhook: gravarDadosExtraidos falhou:', err); }
    try {
      await atualizarMemoriaLead(supabase, lead.id as string, { resumo: claudeResult.memoria.resumo_curto ?? undefined, produto_interesse: claudeResult.memoria.produto_interesse ?? undefined, necessidade: claudeResult.memoria.necessidade ?? undefined, urgencia: claudeResult.memoria.urgencia ?? undefined, proximos_passos: claudeResult.memoria.proximos_passos ?? undefined, dados_confirmados: Object.fromEntries(Object.entries(claudeResult.dados).filter(([_, v]) => v !== null && v !== undefined)), incrementar_processadas: true });
    } catch (err) { console.error('whatsapp-webhook: atualizarMemoriaLead falhou:', err); }
    if (intent === 'orcamento' || intent === 'formalizar') {
      const orcResult = await gerarOrcamentoReal(supabase, conversation.id as string, lead.id as string, 'whatsapp');
      if (orcResult.success && orcResult.portalUrl) {
        orcamentoGerado = true;
        const primeiroNome = (contactName || (lead.contato_nome as string) || '').split(' ')[0];
        resposta = [`${primeiroNome ? primeiroNome + ', p' : 'P'}reparei o orçamento no sistema! 📋`, ``, `*Orçamento ${orcResult.numero}*`, `*Total: R$ ${(orcResult.total ?? 0).toFixed(2).replace('.', ',')}*`, ``, `Acesse: ${orcResult.portalUrl}`, ``, `Também enviei por email com o PDF completo.`, ``, `*Pagamento:* PIX CNPJ 18.923.994/0001-83`, ``, `Qualquer dúvida, estou aqui! 😊`, `Junior - Croma Print`].join('\n');
        await supabase.from('agent_conversations').update({ etapa: 'proposta', updated_at: new Date().toISOString() }).eq('id', conversation.id);
      }
    }
    const sent = await sendWhatsApp(supabase, normalizedPhone, resposta);
    await supabase.from('agent_messages').insert({ conversation_id: conversation.id, direcao: 'enviada', canal: 'whatsapp', conteudo: resposta, status: sent ? 'enviada' : 'erro', modelo_ia: CLAUDE_MODEL, erro_codigo: sent ? null : 'SEND_FAIL', erro_mensagem: sent ? null : 'Falha ao enviar via WhatsApp Cloud API', metadata: { auto_generated: true, sent_by: 'claude-whatsapp-anthropic', modelo_ia: CLAUDE_MODEL, sent_success: sent, intent_detected: intent, orcamento_gerado: orcamentoGerado } });
    await supabase.rpc('incrementar_contador_conversa', { p_id: conversation.id, p_enviadas: 1, p_recebidas: 0, p_score: 0 });
    const se = sent ? '✅' : '❌';
    const il = orcamentoGerado ? '📋 ORÇAMENTO GERADO' : `🏷️ ${intent}`;
    const tr = resposta.length > 200 ? resposta.substring(0, 200) + '…' : resposta;
    const tm = textBody.length > 150 ? textBody.substring(0, 150) + '…' : textBody;
    await notifyTelegram(supabase, `🤖 *Auto-resposta WhatsApp* ${se} ${il}\n\n👤 *${contactName || 'Sem nome'}*${isNewLead ? ' (NOVO LEAD)' : ''}\n📞 +${normalizedPhone}\n\n💬 *Cliente:* ${tm}\n\n✍️ *Respondido:* ${tr}\n\n_${sent ? 'Enviado com sucesso' : 'FALHA no envio'}_`);
    return new Response('OK', { status: 200 });
  } catch (err) { console.error('whatsapp-webhook error:', err); return new Response('OK', { status: 200 }); }
});
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 