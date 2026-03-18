// supabase/functions/ai-classificar-extrato/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCorsOptions, getCorsHeaders, jsonResponse, getServiceClient } from '../ai-shared/ai-helpers.ts';
import { callOpenRouter } from '../ai-shared/openrouter-provider.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req: Request) => {
  const corsResponse = handleCorsOptions(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // Autenticação manual — função financeira
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Não autorizado' }, 401, corsHeaders);
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Token inválido' }, 401, corsHeaders);
    }

    const { itens } = await req.json();

    if (!itens || itens.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getServiceClient();

    // Buscar plano de contas para contexto
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
      // deno-lint-ignore no-explicit-any
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

    const result = await callOpenRouter(systemPrompt, userPrompt, {
      temperature: 0.1,
    });

    // Mapear resultado para IDs
    let parsed;
    try {
      parsed = JSON.parse(result.content);
      if (!Array.isArray(parsed)) {
        // deno-lint-ignore no-explicit-any
        parsed = (parsed as any).classificacoes || (parsed as any).items || (parsed as any).results || [];
      }
    } catch {
      parsed = [];
    }

    const contasMap = new Map((contas || []).map((c: { codigo: string; id: string }) => [c.codigo, c.id]));

    // deno-lint-ignore no-explicit-any
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return jsonResponse({ error: (error as Error).message }, 500, getCorsHeaders(req));
  }
});
