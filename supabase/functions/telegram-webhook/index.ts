// telegram-webhook v9 — centralizado na Claudete (@Claudete_Juca_bot)
// Deploy: supabase functions deploy telegram-webhook
// Registrar webhook: curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/telegram-webhook"

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';
// Bot oficial: Claudete (@Claudete_Juca_bot). Hardcoded para evitar divergencia com secret legado.
const TELEGRAM_TOKEN = '8750164337:AAH8Diet4zGJddKHq_F2F1JobUA2djisU8s';
const AUTHORIZED_CHAT_IDS = [1065519625];
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const MAX_HISTORY = 20;

function getDb() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

async function sendTelegram(chatId: number, text: string) {
  const chunks: string[] = text.length <= 4000 ? [text] : [];
  if (!chunks.length) {
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= 4000) { chunks.push(remaining); break; }
      let splitAt = remaining.lastIndexOf('\n', 4000);
      if (splitAt < 2000) splitAt = 4000;
      chunks.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt);
    }
  }
  for (const chunk of chunks) {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: chunk }),
    });
    if (!res.ok) console.error('Telegram send failed:', await res.text());
  }
}

async function sendTyping(chatId: number) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    });
  } catch {}
}

interface ToolDef {
  name: string;
  description: string;
  execute: (args: Record<string, unknown>, db: ReturnType<typeof getDb>) => Promise<string>;
}

const ERP_TOOLS: ToolDef[] = [
  {
    name: 'listar_pedidos',
    description: 'Lista pedidos recentes. Args: { status?, limit? }',
    execute: async (args, db) => {
      let q = db.from('pedidos').select('numero, status, valor_total, created_at, clientes(nome_fantasia)').order('created_at', { ascending: false }).limit(Number(args.limit) || 10);
      if (args.status) q = q.eq('status', args.status);
      const { data, error } = await q;
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhum pedido encontrado.';
      return data.map((p: any) => `${p.numero} | ${p.status} | R$ ${(p.valor_total||0).toFixed(2)} | ${p.clientes?.nome_fantasia||'-'}`).join('\n');
    },
  },
  {
    name: 'listar_orcamentos',
    description: 'Lista orcamentos/propostas. Args: { status?, limit? }',
    execute: async (args, db) => {
      let q = db.from('propostas').select('numero, status, total, created_at, cliente_nome_snapshot').order('created_at', { ascending: false }).limit(Number(args.limit) || 10);
      if (args.status) q = q.eq('status', args.status);
      const { data, error } = await q;
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhum orcamento encontrado.';
      return data.map((p: any) => `${p.numero} | ${p.status} | R$ ${(p.total||0).toFixed(2)} | ${p.cliente_nome_snapshot||'-'}`).join('\n');
    },
  },
  {
    name: 'listar_leads',
    description: 'Lista leads recentes. Args: { status?, limit? }',
    execute: async (args, db) => {
      let q = db.from('leads').select('empresa, contato_nome, status, temperatura, score, created_at').order('created_at', { ascending: false }).limit(Number(args.limit) || 10);
      if (args.status) q = q.eq('status', args.status);
      const { data, error } = await q;
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhum lead encontrado.';
      return data.map((l: any) => `${l.empresa||l.contato_nome} | ${l.status} | ${l.temperatura||'-'} | Score: ${l.score||0}`).join('\n');
    },
  },
  {
    name: 'producao_status',
    description: 'OPs ativas de producao. Args: { limit? }',
    execute: async (args, db) => {
      const { data, error } = await db.from('ordens_producao').select('numero, status, prazo_entrega, pedidos(numero, clientes(nome_fantasia))').in('status', ['em_fila','em_producao','pausada']).order('prazo_entrega', { ascending: true }).limit(Number(args.limit)||15);
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhuma OP ativa.';
      return data.map((op: any) => `${op.numero} | ${op.status} | Prazo: ${op.prazo_entrega||'-'} | ${(op.pedidos as any)?.clientes?.nome_fantasia||'-'}`).join('\n');
    },
  },
  {
    name: 'contas_receber',
    description: 'Contas a receber. Args: { status?, dias_vencimento? }',
    execute: async (args, db) => {
      let q = db.from('contas_receber').select('descricao, valor, vencimento, status, clientes(nome_fantasia)').order('vencimento', { ascending: true }).limit(15);
      if (args.status) q = q.eq('status', args.status);
      if (args.dias_vencimento) { const d = new Date(); d.setDate(d.getDate()+Number(args.dias_vencimento)); q = q.lte('vencimento', d.toISOString().split('T')[0]); }
      const { data, error } = await q;
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhuma conta a receber.';
      const total = data.reduce((s: number, c: any) => s+(c.valor||0), 0);
      return data.map((c: any) => `R$ ${(c.valor||0).toFixed(2)} | ${c.vencimento} | ${c.status} | ${c.clientes?.nome_fantasia||c.descricao||'-'}`).join('\n') + `\nTotal: R$ ${total.toFixed(2)}`;
    },
  },
  {
    name: 'contas_pagar',
    description: 'Contas a pagar. Args: { status?, dias_vencimento? }',
    execute: async (args, db) => {
      let q = db.from('contas_pagar').select('descricao, valor, vencimento, status, fornecedores(nome_fantasia)').order('vencimento', { ascending: true }).limit(15);
      if (args.status) q = q.eq('status', args.status);
      if (args.dias_vencimento) { const d = new Date(); d.setDate(d.getDate()+Number(args.dias_vencimento)); q = q.lte('vencimento', d.toISOString().split('T')[0]); }
      const { data, error } = await q;
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhuma conta a pagar.';
      const total = data.reduce((s: number, c: any) => s+(c.valor||0), 0);
      return data.map((c: any) => `R$ ${(c.valor||0).toFixed(2)} | ${c.vencimento} | ${c.status} | ${(c.fornecedores as any)?.nome_fantasia||c.descricao||'-'}`).join('\n') + `\nTotal: R$ ${total.toFixed(2)}`;
    },
  },
  {
    name: 'dashboard_executivo',
    description: 'Resumo executivo do mes. Args: {}',
    execute: async (_args, db) => {
      const mesInicio = new Date(); mesInicio.setDate(1); mesInicio.setHours(0,0,0,0);
      const mesStr = mesInicio.toISOString();
      const hoje = new Date().toISOString().split('T')[0];
      const [pedidosMes, faturados, leadsMes, vencidas, opsAtivas, orcPendentes] = await Promise.all([
        db.from('pedidos').select('*',{count:'exact',head:true}).gte('created_at',mesStr),
        db.from('pedidos').select('valor_total').in('status',['concluido','faturado']).gte('created_at',mesStr),
        db.from('leads').select('*',{count:'exact',head:true}).gte('created_at',mesStr),
        db.from('contas_receber').select('*',{count:'exact',head:true}).eq('status','pendente').lt('vencimento',hoje),
        db.from('ordens_producao').select('*',{count:'exact',head:true}).in('status',['em_fila','em_producao']),
        db.from('propostas').select('*',{count:'exact',head:true}).eq('status','enviada'),
      ]);
      const fat = (faturados.data||[]).reduce((s: number, p: any) => s+(p.valor_total||0), 0);
      return `Dashboard - ${new Date().toLocaleDateString('pt-BR')}\n\nFaturamento mes: R$ ${fat.toFixed(2)}\nPedidos mes: ${pedidosMes.count||0}\nLeads mes: ${leadsMes.count||0}\nOrcamentos pendentes: ${orcPendentes.count||0}\nOPs ativas: ${opsAtivas.count||0}\nContas vencidas: ${vencidas.count||0}`;
    },
  },
  {
    name: 'buscar_cliente',
    description: 'Busca cliente por nome. Args: { busca }',
    execute: async (args, db) => {
      const busca = String(args.busca||'');
      if (!busca) return 'Informe o nome do cliente.';
      const { data, error } = await db.from('clientes').select('nome_fantasia, razao_social, cnpj, telefone, email, cidade, estado, classificacao').or(`nome_fantasia.ilike.%${busca}%,razao_social.ilike.%${busca}%`).limit(5);
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return `Nenhum cliente encontrado para "${busca}".`;
      return data.map((c: any) => `${c.nome_fantasia||c.razao_social}\nCNPJ: ${c.cnpj||'-'} | Tel: ${c.telefone||'-'}\nEmail: ${c.email||'-'} | ${c.cidade||'-'}/${c.estado||'-'}`).join('\n\n');
    },
  },
];

const SYSTEM_PROMPT = `Voce e a Claudete, assistente ERP da Croma Print via Telegram (@Claudete_Juca_bot).
Conversa com o Junior (dono) e tem acesso ao ERP completo.

FERRAMENTAS DISPONIVEIS (chame uma por vez em JSON):
${ERP_TOOLS.map(t => `- ${t.name}: ${t.description}`).join('\n')}

Para usar ferramenta, responda EXATAMENTE:
{"tool": "nome", "args": {"param": "valor"}}

Regras:
- Portugues brasileiro sempre
- Seja direta - Junior esta no celular
- Nunca invente dados - consulte o ERP
- Consultas: execute direto sem pedir confirmacao
- Acoes que alteram dados: peca confirmacao
- Valores em R$ com 2 decimais, datas DD/MM/YYYY`;

interface Msg { role: 'user'|'assistant'; content: string; }

async function getHistory(db: ReturnType<typeof getDb>, chatId: number): Promise<Msg[]> {
  const { data } = await db.from('telegram_messages').select('role, content').eq('chat_id', chatId).order('created_at', { ascending: false }).limit(MAX_HISTORY);
  return (data||[]).reverse() as Msg[];
}

async function saveMessage(db: ReturnType<typeof getDb>, chatId: number, role: 'user'|'assistant', content: string) {
  try {
    const { error } = await db.from('telegram_messages').insert({ chat_id: chatId, role, content });
    if (error) console.error('saveMessage error:', error.message);
  } catch (e) {
    console.error('saveMessage exception:', e);
  }
}

function tryParseToolCall(text: string): { tool: string; args: Record<string,unknown> }|null {
  try { const o = JSON.parse(text.trim()); if (o.tool) return o; } catch {}
  const m = text.match(/\{[\s\S]*?"tool"\s*:\s*"[^"]+"/);
  if (m) { try { let d=0,e=text.indexOf(m[0]); for(let i=e;i<text.length;i++){if(text[i]==='{')d++;if(text[i]==='}'){d--;if(d===0){return JSON.parse(text.slice(e,i+1));}} } } catch {} }
  return null;
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic ${response.status}: ${err}`);
  }
  const data = await response.json();
  return data.content?.[0]?.text ?? '';
}

async function processMessage(db: ReturnType<typeof getDb>, chatId: number, userMessage: string): Promise<string> {
  const history = await getHistory(db, chatId);
  await saveMessage(db, chatId, 'user', userMessage);
  const messages = [...history.map(m=>({role:m.role,content:m.content})), {role:'user' as const,content:userMessage}];
  const aiResponse = await callAI(SYSTEM_PROMPT, messages.map(m=>`${m.role}: ${m.content}`).join('\n'));
  let finalResponse = aiResponse;
  for (let i=0; i<3; i++) {
    const tc = tryParseToolCall(finalResponse);
    if (!tc) break;
    const tool = ERP_TOOLS.find(t=>t.name===tc.tool);
    if (!tool) { finalResponse=`Ferramenta "${tc.tool}" nao encontrada.`; break; }
    const toolResult = await tool.execute(tc.args, db);
    finalResponse = await callAI(SYSTEM_PROMPT, [...messages.map(m=>`${m.role}: ${m.content}`), `assistant: [Executei ${tool.name}]`, `system: Resultado:\n${toolResult}`, 'Formate resposta clara e direta. NAO chame outra ferramenta.'].join('\n'));
    if (!tryParseToolCall(finalResponse)) break;
  }
  await saveMessage(db, chatId, 'assistant', finalResponse);
  return finalResponse;
}

async function handleCommand(db: ReturnType<typeof getDb>, chatId: number, command: string): Promise<string|null> {
  switch(command) {
    case '/start': return 'Oi Junior! Sou a Claudete, assistente do ERP da Croma Print.\n\nComandos:\n/erp - Dashboard executivo\n/pedidos - Pedidos recentes\n/producao - OPs ativas\n/financeiro - Contas a receber/pagar\n/leads - Leads recentes\n/clear - Limpar historico\n\nOu me pergunte qualquer coisa sobre o ERP!';
    case '/erp': case '/dashboard': return processMessage(db, chatId, 'dashboard executivo de hoje');
    case '/pedidos': return processMessage(db, chatId, 'lista os ultimos pedidos');
    case '/producao': return processMessage(db, chatId, 'status das OPs ativas');
    case '/financeiro': return processMessage(db, chatId, 'contas a receber e pagar desta semana');
    case '/leads': return processMessage(db, chatId, 'leads recentes');
    case '/clear': {
      const { error } = await db.from('telegram_messages').delete().eq('chat_id', chatId);
      return error ? `Erro: ${error.message}` : 'Historico limpo!';
    }
    default: return null;
  }
}

serve(async (req: Request) => {
  if (req.method==='OPTIONS') return new Response('ok',{status:200});
  if (req.method==='GET') return new Response(JSON.stringify({status:'ok',bot:'claudete',provider:'anthropic-direct',version:9}),{headers:{'Content-Type':'application/json'}});
  try {
    const update = await req.json();
    const message = update.message;
    if (!message?.text) return new Response('ok',{status:200});
    const chatId = message.chat.id;
    const text = (message.text||'').trim();
    if (!AUTHORIZED_CHAT_IDS.includes(chatId)) {
      await sendTelegram(chatId, 'Acesso nao autorizado.');
      return new Response('ok',{status:200});
    }
    const db = getDb();
    await sendTyping(chatId);
    let response: string;
    if (text.startsWith('/')) {
      const cmd = text.split(' ')[0].toLowerCase().split('@')[0];
      response = await handleCommand(db, chatId, cmd) || await processMessage(db, chatId, text);
    } else {
      response = await processMessage(db, chatId, text);
    }
    await sendTelegram(chatId, response);
    return new Response('ok',{status:200});
  } catch(err) {
    console.error('FATAL:', err);
    try { await sendTelegram(1065519625, 'Erro: ' + String(err).slice(0, 300)); } catch {}
    return new Response('ok',{status:200});
  }
});
