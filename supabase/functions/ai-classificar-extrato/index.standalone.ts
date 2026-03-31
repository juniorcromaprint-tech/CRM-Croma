// ai-classificar-extrato — STANDALONE (sem imports relativos)
// Deploy: npx supabase@latest functions deploy ai-classificar-extrato --project-ref djwjmfgplnqyffdcgdaw

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Shared helpers inline ───────────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Content-Type, Authorization',
};
function jsonResponse(data: unknown, status: number, h = CORS_HEADERS): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...h, 'Content-Type': 'application/json' } });
}
function getServiceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

// Inline callOpenRouter (uses OPENROUTER_API_KEY env var)
async function callOpenRouter(systemPrompt: string, userPrompt: string, config?: { temperature?: number; max_tokens?: number }): Promise<{ content: string }> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) throw new Error('OPENROUTER_API_KEY não configurada');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://crm-croma.vercel.app',
      'X-Title': 'Croma AI Engine',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: config?.temperature ?? 0.3,
      max_tokens: config?.max_tokens ?? 2000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${err}`);
  }
  const result = await response.json();
  const rawContent = result.choices[0]?.message?.content ?? '';

  // Extract JSON if wrapped in markdown
  const mdMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (mdMatch?.[1]) {
    try { JSON.parse(mdMatch[1].trim()); return { content: mdMatch[1].trim() }; } catch { /* continue */ }
  }
  return { content: rawContent };
}
// ────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Não autorizado' }, 401);

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) return jsonResponse({ error: 'Token inválido' }, 401);

    const { itens } = await req.json();
    if (!itens || itens.length === 0) {
      return new Response(JSON.stringify([]), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    const supabase = getServiceClient();

    const { data: contas } = await supabase
      .from('plano_contas')
      .select('id, codigo, nome, tipo')
      .eq('natureza', 'analitica')
      .eq('ativo', true)
      .order('codigo');

    const contasStr = (contas || [])
      .map((c: { codigo: string; nome: string; tipo: string }) => `${c.codigo} - ${c.nome} (${c.tipo})`)
      .join('\n');

    const itensStr = itens
      .map((i: any, idx: number) => `${idx + 1}. "${i.descricao}" | R$ ${i.valor}`)
      .join('\n');

    const systemPrompt = `Você é um assistente contábil especializado em classificação de extratos bancários para uma empresa de comunicação visual (Croma Print) optante pelo Simples Nacional.

Plano de contas disponível:
${contasStr}

Regras:
- Classifique cada transação do extrato na conta contábil mais adequada
- Para cada item, retorne o código da conta e um score de confiança (0.0 a 1.0)
- Transações entre contas da mesma titularidade (transferências) devem ser marcadas como "ignorar"
- PIX recebidos de pessoas/empresas geralmente são receita de vendas
- Boletos pagos com nomes de concessionárias são despesas operacionais
- Responda APENAS em JSON válido`;

    const userPrompt = `Classifique estas transações do extrato bancário:

${itensStr}

Responda em JSON:
[{"index": 1, "conta_codigo": "4.1.01", "confianca": 0.85, "ignorar": false}, ...]`;

    const result = await callOpenRouter(systemPrompt, userPrompt, { temperature: 0.1 });

    let parsed;
    try {
      parsed = JSON.parse(result.content);
      if (!Array.isArray(parsed)) {
        parsed = (parsed as any).classificacoes || (parsed as any).items || (parsed as any).results || [];
      }
    } catch {
      parsed = [];
    }

    const contasMap = new Map((contas || []).map((c: { codigo: string; id: string }) => [c.codigo, c.id]));

    const classificacoes = parsed.map((p: any) => {
      const idx = (p.index || 1) - 1;
      const item = itens[idx];
      if (!item) return null;
      return {
        itemId: item.id,
        contaPlanoId: contasMap.get(p.conta_codigo) || null,
        confianca: p.confianca || 0.5,
        ignorar: p.ignorar || false,
      };
    }).filter(Boolean);

    return new Response(JSON.stringify(classificacoes), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
