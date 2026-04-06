// supabase/functions/telegram-webhook/index.ts
// Webhook do Telegram — recebe mensagens do Junior e executa operações no ERP.
// Deploy: supabase functions deploy telegram-webhook
// Registrar webhook: curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/telegram-webhook"

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callOpenRouter } from '../ai-shared/anthropic-provider.ts';

// ─── Config ──────────────────────────────────────────────────────────────────

const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '8645464702:AAGoy9_8uHJB9Bfo4hHQgmKw3bZ26mqSaBo';
const AUTHORIZED_CHAT_IDS = [1065519625]; // Junior
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAX_HISTORY = 20;

// ─── Supabase client ─────────────────────────────────────────────────────────

function getDb() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

// ─── Telegram helpers ────────────────────────────────────────────────────────

async function sendTelegram(chatId: number, text: string, parseMode = 'Markdown') {
  // Telegram has 4096 char limit — split if needed
  const chunks = splitMessage(text, 4000);
  for (const chunk of chunks) {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        parse_mode: parseMode,
      }),
    }).catch(async () => {
      // Fallback without parse_mode if markdown fails
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: chunk }),
      });
    });
  }
}

function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt < maxLen / 2) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  return chunks;
}

async function sendTyping(chatId: number) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
  }).catch(() => {});
}

// ─── ERP Tools (SQL-based queries via Supabase) ──────────────────────────────

interface ToolDef {
  name: string;
  description: string;
  execute: (args: Record<string, unknown>, db: ReturnType<typeof getDb>) => Promise<string>;
}

const ERP_TOOLS: ToolDef[] = [
  {
    name: 'listar_pedidos',
    description: 'Lista pedidos recentes com status, valor e cliente. Args: { status?, limit? }',
    execute: async (args, db) => {
      let q = db.from('pedidos')
        .select('numero, status, valor_total, created_at, clientes(nome_fantasia)')
        .order('created_at', { ascending: false })
        .limit(Number(args.limit) || 10);
      if (args.status) q = q.eq('status', args.status);
      const { data, error } = await q;
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhum pedido encontrado.';
      return data.map((p: any) =>
        `• ${p.numero} | ${p.status} | R$ ${(p.valor_total || 0).toFixed(2)} | ${p.clientes?.nome_fantasia || '—'}`
      ).join('\n');
    },
  },
  {
    name: 'listar_orcamentos',
    description: 'Lista orçamentos/propostas recentes. Args: { status?, limit? }',
    execute: async (args, db) => {
      let q = db.from('propostas')
        .select('numero, status, total, created_at, cliente_nome_snapshot')
        .order('created_at', { ascending: false })
        .limit(Number(args.limit) || 10);
      if (args.status) q = q.eq('status', args.status);
      const { data, error } = await q;
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhum orçamento encontrado.';
      return data.map((p: any) =>
        `• ${p.numero} | ${p.status} | R$ ${(p.total || 0).toFixed(2)} | ${p.cliente_nome_snapshot || '—'}`
      ).join('\n');
    },
  },
  {
    name: 'listar_leads',
    description: 'Lista leads recentes. Args: { status?, limit? }',
    execute: async (args, db) => {
      let q = db.from('leads')
        .select('empresa, contato_nome, status, temperatura, score, created_at')
        .order('created_at', { ascending: false })
        .limit(Number(args.limit) || 10);
      if (args.status) q = q.eq('status', args.status);
      const { data, error } = await q;
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhum lead encontrado.';
      return data.map((l: any) =>
        `• ${l.empresa || l.contato_nome} | ${l.status} | ${l.temperatura || '—'} | Score: ${l.score || 0}`
      ).join('\n');
    },
  },
  {
    name: 'producao_status',
    description: 'Status das ordens de produção ativas. Args: { limit? }',
    execute: async (args, db) => {
      const { data, error } = await db.from('ordens_producao')
        .select('numero, status, prazo_entrega, pedidos(numero, clientes(nome_fantasia))')
        .in('status', ['em_fila', 'em_producao', 'pausada'])
        .order('prazo_entrega', { ascending: true })
        .limit(Number(args.limit) || 15);
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhuma OP ativa.';
      return data.map((op: any) =>
        `• ${op.numero} | ${op.status} | Prazo: ${op.prazo_entrega || '—'} | ${(op.pedidos as any)?.clientes?.nome_fantasia || '—'}`
      ).join('\n');
    },
  },
  {
    name: 'contas_receber',
    description: 'Contas a receber (boletos, PIX). Args: { status?, dias_vencimento? }',
    execute: async (args, db) => {
      let q = db.from('contas_receber')
        .select('descricao, valor, vencimento, status, clientes(nome_fantasia)')
        .order('vencimento', { ascending: true })
        .limit(15);
      if (args.status) q = q.eq('status', args.status);
      if (args.dias_vencimento) {
        const limite = new Date();
        limite.setDate(limite.getDate() + Number(args.dias_vencimento));
        q = q.lte('vencimento', limite.toISOString().split('T')[0]);
      }
      const { data, error } = await q;
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhuma conta a receber encontrada.';
      const total = data.reduce((s: number, c: any) => s + (c.valor || 0), 0);
      const linhas = data.map((c: any) =>
        `• R$ ${(c.valor || 0).toFixed(2)} | ${c.vencimento} | ${c.status} | ${c.clientes?.nome_fantasia || c.descricao || '—'}`
      ).join('\n');
      return `${linhas}\n\n*Total: R$ ${total.toFixed(2)}*`;
    },
  },
  {
    name: 'contas_pagar',
    description: 'Contas a pagar. Args: { status?, dias_vencimento? }',
    execute: async (args, db) => {
      let q = db.from('contas_pagar')
        .select('descricao, valor, vencimento, status, fornecedores(nome_fantasia)')
        .order('vencimento', { ascending: true })
        .limit(15);
      if (args.status) q = q.eq('status', args.status);
      if (args.dias_vencimento) {
        const limite = new Date();
        limite.setDate(limite.getDate() + Number(args.dias_vencimento));
        q = q.lte('vencimento', limite.toISOString().split('T')[0]);
      }
      const { data, error } = await q;
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhuma conta a pagar encontrada.';
      const total = data.reduce((s: number, c: any) => s + (c.valor || 0), 0);
      const linhas = data.map((c: any) =>
        `• R$ ${(c.valor || 0).toFixed(2)} | ${c.vencimento} | ${c.status} | ${(c.fornecedores as any)?.nome_fantasia || c.descricao || '—'}`
      ).join('\n');
      return `${linhas}\n\n*Total: R$ ${total.toFixed(2)}*`;
    },
  },
  {
    name: 'dashboard_executivo',
    description: 'Resumo executivo: faturamento do mês, pedidos, leads, contas. Args: {}',
    execute: async (_args, db) => {
      const mesInicio = new Date();
      mesInicio.setDate(1);
      mesInicio.setHours(0, 0, 0, 0);
      const mesStr = mesInicio.toISOString();

      // Pedidos do mês
      const { count: pedidosMes } = await db.from('pedidos')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', mesStr);

      // Faturamento (pedidos concluídos/faturados)
      const { data: faturados } = await db.from('pedidos')
        .select('valor_total')
        .in('status', ['concluido', 'faturado'])
        .gte('created_at', mesStr);
      const faturamento = (faturados || []).reduce((s: number, p: any) => s + (p.valor_total || 0), 0);

      // Leads do mês
      const { count: leadsMes } = await db.from('leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', mesStr);

      // Contas a receber vencidas
      const hoje = new Date().toISOString().split('T')[0];
      const { count: vencidas } = await db.from('contas_receber')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendente')
        .lt('vencimento', hoje);

      // OPs ativas
      const { count: opsAtivas } = await db.from('ordens_producao')
        .select('*', { count: 'exact', head: true })
        .in('status', ['em_fila', 'em_producao']);

      // Orçamentos pendentes
      const { count: orcPendentes } = await db.from('propostas')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'enviada');

      return [
        `*Dashboard Executivo — ${new Date().toLocaleDateString('pt-BR')}*`,
        '',
        `💰 Faturamento mês: R$ ${faturamento.toFixed(2)}`,
        `📦 Pedidos mês: ${pedidosMes || 0}`,
        `👤 Leads mês: ${leadsMes || 0}`,
        `📋 Orçamentos pendentes: ${orcPendentes || 0}`,
        `🏭 OPs ativas: ${opsAtivas || 0}`,
        `⚠️ Contas vencidas: ${vencidas || 0}`,
      ].join('\n');
    },
  },
  {
    name: 'consultar_estoque',
    description: 'Consulta estoque de materiais. Args: { busca? }',
    execute: async (args, db) => {
      let q = db.from('materiais')
        .select('nome, unidade, estoque_minimo, preco_medio')
        .eq('ativo', true)
        .order('nome')
        .limit(15);
      if (args.busca) q = q.ilike('nome', `%${args.busca}%`);
      const { data, error } = await q;
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhum material encontrado.';
      return data.map((m: any) =>
        `• ${m.nome} | ${m.unidade} | Mín: ${m.estoque_minimo} | R$ ${(m.preco_medio || 0).toFixed(2)}`
      ).join('\n');
    },
  },
  {
    name: 'buscar_cliente',
    description: 'Busca cliente por nome. Args: { busca }',
    execute: async (args, db) => {
      const busca = String(args.busca || '');
      if (!busca) return 'Informe o nome do cliente.';
      const { data, error } = await db.from('clientes')
        .select('nome_fantasia, razao_social, cnpj, telefone, email, cidade, estado, classificacao')
        .or(`nome_fantasia.ilike.%${busca}%,razao_social.ilike.%${busca}%`)
        .limit(5);
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return `Nenhum cliente encontrado para "${busca}".`;
      return data.map((c: any) =>
        `*${c.nome_fantasia || c.razao_social}*\nCNPJ: ${c.cnpj || '—'} | Tel: ${c.telefone || '—'}\nEmail: ${c.email || '—'} | ${c.cidade || '—'}/${c.estado || '—'} | Class: ${c.classificacao || '—'}`
      ).join('\n\n');
    },
  },
  {
    name: 'executar_sql',
    description: 'Executa SELECT SQL no banco. SOMENTE leitura. Args: { sql }',
    execute: async (args, db) => {
      const sql = String(args.sql || '');
      if (!sql) return 'Informe a query SQL.';
      // Security: only SELECT allowed
      const normalized = sql.trim().toLowerCase();
      if (!normalized.startsWith('select')) {
        return 'Apenas queries SELECT são permitidas.';
      }
      if (/\b(insert|update|delete|drop|alter|create|truncate|grant|revoke)\b/i.test(sql)) {
        return 'Query contém comandos de escrita. Apenas SELECT é permitido.';
      }
      const { data, error } = await db.rpc('execute_sql_readonly', { query: sql });
      if (error) {
        // Fallback: try direct query if RPC doesn't exist
        return `Erro SQL: ${error.message}`;
      }
      if (!data) return 'Query executada sem resultados.';
      return typeof data === 'string' ? data : JSON.stringify(data, null, 2).slice(0, 3500);
    },
  },
];

// ─── Tool calling via OpenRouter ─────────────────────────────────────────────

const SYSTEM_PROMPT = `Voce e o assistente ERP da Croma Print, empresa de comunicacao visual no RS.
Voce conversa com o Junior (dono) pelo Telegram e tem acesso ao ERP completo.

FERRAMENTAS DISPONIVEIS (chame uma por vez):
${ERP_TOOLS.map((t) => `- ${t.name}: ${t.description}`).join('\n')}

Para usar uma ferramenta, responda EXATAMENTE neste formato JSON:
{"tool": "nome_da_ferramenta", "args": {"param1": "valor"}}

Se nao precisar de ferramenta, responda normalmente em texto.

REGRAS:
- Sempre responda em portugues brasileiro
- Seja direto e objetivo — Junior está no celular
- Nunca invente dados — consulte o ERP via ferramentas
- Para consultas, execute direto sem pedir confirmação
- Para ações que alteram dados, peça confirmação antes
- Use formatação simples — sem tabelas grandes
- Valores sempre em R$ com 2 decimais
- Datas no formato DD/MM/YYYY
- Se o Junior pedir "dashboard", "resumo" ou "status" geral, use dashboard_executivo
- Se pedir algo sobre pedidos, OPs, leads, clientes, financeiro — use a ferramenta certa
- Se a pergunta for genérica ou social, responda sem ferramenta`;

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Store conversation history in memory (per chat_id, ephemeral per function invocation)
// For persistence, we use the telegram_messages table
async function getHistory(db: ReturnType<typeof getDb>, chatId: number): Promise<ConversationMessage[]> {
  const { data } = await db
    .from('telegram_messages')
    .select('role, content')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY);
  return (data || []).reverse() as ConversationMessage[];
}

async function saveMessage(db: ReturnType<typeof getDb>, chatId: number, role: 'user' | 'assistant', content: string) {
  await db.from('telegram_messages').insert({ chat_id: chatId, role, content }).catch(() => {});
}

// ─── Process message with tool calling ───────────────────────────────────────

async function processMessage(
  db: ReturnType<typeof getDb>,
  chatId: number,
  userMessage: string,
): Promise<string> {
  const history = await getHistory(db, chatId);
  await saveMessage(db, chatId, 'user', userMessage);

  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userMessage },
  ];

  // First call — may return tool call or direct response
  const aiResult = await callOpenRouter(SYSTEM_PROMPT, messages.map(m => `${m.role}: ${m.content}`).join('\n'), {
    model: 'openai/gpt-4.1-mini',
    temperature: 0.3,
    max_tokens: 2000,
    text_mode: true,
  });

  let response = aiResult.content;

  // Check if response is a tool call
  const maxToolCalls = 3;
  for (let i = 0; i < maxToolCalls; i++) {
    const toolCall = tryParseToolCall(response);
    if (!toolCall) break;

    const tool = ERP_TOOLS.find((t) => t.name === toolCall.tool);
    if (!tool) {
      response = `Ferramenta "${toolCall.tool}" não encontrada.`;
      break;
    }

    // Execute the tool
    const toolResult = await tool.execute(toolCall.args, db);

    // Call AI again with tool result
    const followUp = await callOpenRouter(
      SYSTEM_PROMPT,
      [
        ...messages.map(m => `${m.role}: ${m.content}`),
        `assistant: [Executei ${tool.name}]`,
        `system: Resultado da ferramenta ${tool.name}:\n${toolResult}`,
        'Agora formate uma resposta clara e direta para o Junior com base no resultado acima. NÃO chame outra ferramenta — responda em texto.',
      ].join('\n'),
      {
        model: 'openai/gpt-4.1-mini',
        temperature: 0.3,
        max_tokens: 2000,
        text_mode: true,
      }
    );

    response = followUp.content;

    // If the new response is ALSO a tool call, loop
    if (!tryParseToolCall(response)) break;
  }

  await saveMessage(db, chatId, 'assistant', response);

  // Log to ai_logs
  await db.from('ai_logs').insert({
    function_name: 'telegram-webhook',
    entity_type: 'geral',
    model_used: (aiResult as any).model_used || 'openai/gpt-4.1-mini',
    tokens_input: (aiResult as any).tokens_input || 0,
    tokens_output: (aiResult as any).tokens_output || 0,
    cost_usd: aiResult.cost_usd || 0,
    duration_ms: (aiResult as any).duration_ms || 0,
    status: 'success',
  }).catch(() => {});

  return response;
}

function tryParseToolCall(text: string): { tool: string; args: Record<string, unknown> } | null {
  try {
    // Try direct parse
    const obj = JSON.parse(text.trim());
    if (obj.tool && typeof obj.tool === 'string') return obj;
  } catch {
    // Try to find JSON in text
    const match = text.match(/\{[\s\S]*?"tool"\s*:\s*"[^"]+"/);
    if (match) {
      try {
        // Find the complete JSON
        const start = text.indexOf(match[0]);
        let depth = 0;
        let end = start;
        for (let i = start; i < text.length; i++) {
          if (text[i] === '{') depth++;
          if (text[i] === '}') depth--;
          if (depth === 0) { end = i + 1; break; }
        }
        const obj = JSON.parse(text.slice(start, end));
        if (obj.tool) return obj;
      } catch { /* ignore */ }
    }
  }
  return null;
}

// ─── Slash commands ──────────────────────────────────────────────────────────

async function handleCommand(db: ReturnType<typeof getDb>, chatId: number, command: string): Promise<string | null> {
  switch (command) {
    case '/start':
      return [
        '*Croma Print ERP Bot* 🏭',
        '',
        'Olá Junior! Sou o assistente do ERP da Croma.',
        'Posso consultar pedidos, leads, produção, financeiro e mais.',
        '',
        '*Comandos:*',
        '/erp — Resumo executivo',
        '/pedidos — Pedidos recentes',
        '/producao — OPs ativas',
        '/financeiro — Contas a receber/pagar',
        '/leads — Leads recentes',
        '/clear — Limpar histórico',
        '',
        'Ou simplesmente me pergunte qualquer coisa!',
      ].join('\n');

    case '/erp':
    case '/dashboard':
      return processMessage(db, chatId, 'me dá o dashboard executivo de hoje');

    case '/pedidos':
      return processMessage(db, chatId, 'lista os últimos pedidos');

    case '/producao':
      return processMessage(db, chatId, 'status das OPs ativas');

    case '/financeiro':
      return processMessage(db, chatId, 'contas a receber e pagar desta semana');

    case '/leads':
      return processMessage(db, chatId, 'leads recentes');

    case '/clear':
      await db.from('telegram_messages').delete().eq('chat_id', chatId);
      return 'Histórico limpo! ✅';

    default:
      return null;
  }
}

// ─── Main handler ────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 });
  }

  // GET = health check (for webhook registration verification)
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok', bot: 'croma-erp' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const update = await req.json();

    // Ignore non-message updates (callbacks, inline queries, etc.)
    const message = update.message;
    if (!message?.text && !message?.voice) {
      return new Response('ok', { status: 200 });
    }

    const chatId = message.chat.id;
    const text = (message.text || '').trim();

    // Auth check
    if (!AUTHORIZED_CHAT_IDS.includes(chatId)) {
      await sendTelegram(chatId, 'Acesso não autorizado. Este bot é exclusivo da Croma Print.');
      return new Response('ok', { status: 200 });
    }

    const db = getDb();

    // Send typing indicator
    await sendTyping(chatId);

    let response: string;

    // Check for slash commands
    if (text.startsWith('/')) {
      const cmd = text.split(' ')[0].toLowerCase().split('@')[0]; // handle /cmd@botname
      const cmdResult = await handleCommand(db, chatId, cmd);
      response = cmdResult || await processMessage(db, chatId, text);
    } else if (text) {
      response = await processMessage(db, chatId, text);
    } else {
      response = 'Envie uma mensagem de texto. Áudio será suportado em breve!';
    }

    await sendTelegram(chatId, response);

    return new Response('ok', { status: 200 });

  } catch (err) {
    console.error('telegram-webhook error:', err);
    // Don't fail — Telegram will retry
    return new Response('ok', { status: 200 });
  }
});
