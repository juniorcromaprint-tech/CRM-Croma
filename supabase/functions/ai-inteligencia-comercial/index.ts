// ai-inteligencia-comercial: PROMPT 2 — Inteligência comercial com benchmarks e alertas
// Analisa pipeline atual vs benchmarks históricos, sazonalidade e perfil de clientes-chave
// Dispara alertas via disparar_alerta() e retorna insights estratégicos para o dashboard
//
// Tabelas: business_intelligence_config, client_intelligence, sales_benchmarks, alert_rules
// Auth: admin, diretor, gerente, comercial

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsOptions, jsonResponse } from '../ai-shared/ai-helpers.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const ALLOWED_ROLES = ['admin', 'diretor', 'gerente', 'comercial'];
const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) });
  const corsHeaders = getCorsHeaders(req);

  try {
    // ── Auth ──────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Não autorizado' }, 401, corsHeaders);
    }

    const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Token inválido' }, 401, corsHeaders);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!ALLOWED_ROLES.includes(profile?.role ?? '')) {
      return jsonResponse({ error: 'Sem permissão para inteligência comercial' }, 403, corsHeaders);
    }

    const userId = user.id;

    // ── 1. Carregar dados de inteligência de negócio ──────────────────
    const [biConfigRes, clientIntRes, benchmarksRes, alertRulesRes] = await Promise.all([
      supabase.from('business_intelligence_config').select('chave, valor_numerico, descricao, categoria').eq('ativo', true),
      supabase.from('client_intelligence').select('*').order('percentual_faturamento', { ascending: false }),
      supabase.from('sales_benchmarks').select('*').order('ano', { ascending: false }).limit(4),
      supabase.from('alert_rules').select('id, codigo, nome, descricao, tipo, severidade, threshold_valor, threshold_unidade').eq('ativo', true),
    ]);

    // ── 2. Carregar métricas do período atual (30 e 90 dias) ──────────
    const now = new Date();
    const mesAtual = MONTHS_PT[now.getMonth()];
    const trintaDiasAtras = new Date(now); trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
    const noventaDiasAtras = new Date(now); noventaDiasAtras.setDate(noventaDiasAtras.getDate() - 90);
    const inicioDia3 = new Date(now); inicioDia3.setDate(inicioDia3.getDate() - 3);

    const [
      propostasRecentes,
      propostasAprovadas,
      pedidosRecentes,
      propostasParadas,
      clientesInativos,
      contasVencidas,
    ] = await Promise.all([
      // Propostas criadas nos últimos 30 dias
      supabase.from('propostas')
        .select('id, numero, total, status, cliente_id, created_at')
        .gte('created_at', trintaDiasAtras.toISOString())
        .is('excluido_em', null),

      // Propostas aprovadas nos últimos 30 dias
      supabase.from('propostas')
        .select('id, total')
        .gte('created_at', trintaDiasAtras.toISOString())
        .eq('status', 'aprovada')
        .is('excluido_em', null),

      // Pedidos criados nos últimos 30 dias
      supabase.from('pedidos')
        .select('id, valor_total, status, cliente_id, created_at')
        .gte('created_at', trintaDiasAtras.toISOString())
        .is('excluido_em', null),

      // Propostas paradas há mais de 3 dias (sem resposta) — regra ORC_PARADO_3D
      supabase.from('propostas')
        .select('id, numero, total, cliente_id, created_at')
        .lt('created_at', inicioDia3.toISOString())
        .in('status', ['enviada', 'visualizada'])
        .is('excluido_em', null),

      // Clientes sem proposta nos últimos 60 dias — regra CLI_INATIVO_60D
      supabase.rpc('get_clientes_inativos_60d').catch(() => ({ data: [], error: null })),

      // Contas vencidas
      supabase.from('contas_receber')
        .select('id, valor_original, cliente_id')
        .eq('status', 'vencida')
        .gt('saldo', 0),
    ]);

    // ── 3. Calcular métricas ──────────────────────────────────────────
    const totalPropostas30d = propostasRecentes.data?.length ?? 0;
    const totalAprovadas30d = propostasAprovadas.data?.length ?? 0;
    const taxaConversao30d = totalPropostas30d > 0
      ? Math.round((totalAprovadas30d / totalPropostas30d) * 100)
      : 0;

    const valorAprovado30d = (propostasAprovadas.data ?? [])
      .reduce((s: number, p: any) => s + (Number(p.total) || 0), 0);

    const ticketMedio30d = totalAprovadas30d > 0
      ? Math.round(valorAprovado30d / totalAprovadas30d)
      : 0;

    // Sazonalidade do mês atual
    const biConfig = biConfigRes.data ?? [];
    const sazConfig = biConfig.find((c) => c.chave === `sazonalidade_${mesAtual}`);
    const fatorSazonalidade = sazConfig?.valor_numerico ?? 1.0;
    const ticketMediometa = biConfig.find((c) => c.chave === 'ticket_medio_geral')?.valor_numerico ?? 2100;
    const taxaConversaoMeta = biConfig.find((c) => c.chave === 'taxa_conversao_meta')?.valor_numerico ?? 75;
    const limiteConcentracao = biConfig.find((c) => c.chave === 'limite_concentracao_cliente')?.valor_numerico ?? 60;

    // Benchmark mais recente
    const ultimoBenchmark = (benchmarksRes.data ?? [])[0];

    // Clientes em risco crítico
    const clientesCriticos = (clientIntRes.data ?? []).filter((c: any) => c.nivel_risco === 'critico');

    // Calcular concentração Beira Rio nos últimos 90 dias
    let concentracaoBeirario = 0;
    const pedidosAll90d = pedidosRecentes.data ?? [];
    const totalFat90d = pedidosAll90d.reduce((s: number, p: any) => s + (Number(p.valor_total) || 0), 0);

    if (totalFat90d > 0 && clientesCriticos.length > 0) {
      // Buscar cliente Beira Rio
      const { data: beirarioCliente } = await supabase
        .from('clientes')
        .select('id')
        .ilike('nome_fantasia', '%beira rio%')
        .single()
        .catch(() => ({ data: null }));

      if (beirarioCliente) {
        const fatBeirario = pedidosAll90d
          .filter((p: any) => p.cliente_id === beirarioCliente.id)
          .reduce((s: number, p: any) => s + (Number(p.valor_total) || 0), 0);
        concentracaoBeirario = totalFat90d > 0 ? Math.round((fatBeirario / totalFat90d) * 100) : 0;
      }
    }

    // ── 4. Disparar alertas baseados em regras ────────────────────────
    const alertasDisparados: string[] = [];
    const alertRules = alertRulesRes.data ?? [];

    // ORC_PARADO_3D: orçamentos parados
    const qtdParados = propostasParadas.data?.length ?? 0;
    if (qtdParados > 0) {
      const rule = alertRules.find((r: any) => r.codigo === 'ORC_PARADO_3D');
      if (rule) {
        for (const proposta of (propostasParadas.data ?? []).slice(0, 5)) {
          await supabase.rpc('disparar_alerta', {
            p_rule_codigo: 'ORC_PARADO_3D',
            p_titulo: `Orçamento #${proposta.numero} sem resposta há 3+ dias`,
            p_descricao: `Valor: R$ ${Number(proposta.total || 0).toFixed(0)} — aguardando retorno do cliente`,
            p_entity_type: 'orcamento',
            p_entity_id: proposta.id,
          }).catch(() => {});
        }
        alertasDisparados.push(`ORC_PARADO_3D: ${qtdParados} orçamento(s)`);
      }
    }

    // CONCENTRACAO_60PCT: concentração acima do limite
    if (concentracaoBeirario > Number(limiteConcentracao)) {
      await supabase.rpc('disparar_alerta', {
        p_rule_codigo: 'CONCENTRACAO_60PCT',
        p_titulo: `Concentração Beira Rio: ${concentracaoBeirario}% do faturamento`,
        p_descricao: `Limite seguro é ${limiteConcentracao}%. Risco crítico de dependência. Diversifique a carteira.`,
        p_entity_type: 'cliente',
        p_entity_id: null,
      }).catch(() => {});
      alertasDisparados.push(`CONCENTRACAO_60PCT: ${concentracaoBeirario}%`);
    }

    // CONVERSAO_ABAIXO_65PCT: taxa de conversão baixa
    if (totalPropostas30d >= 5 && taxaConversao30d < 65) {
      await supabase.rpc('disparar_alerta', {
        p_rule_codigo: 'CONVERSAO_ABAIXO_65PCT',
        p_titulo: `Taxa de conversão baixa: ${taxaConversao30d}% nos últimos 30 dias`,
        p_descricao: `Meta: ${taxaConversaoMeta}%. Últimos 30 dias: ${taxaConversao30d}% (${totalAprovadas30d}/${totalPropostas30d} propostas).`,
        p_entity_type: 'comercial',
        p_entity_id: null,
      }).catch(() => {});
      alertasDisparados.push(`CONVERSAO_ABAIXO_65PCT: ${taxaConversao30d}%`);
    }

    // ── 5. Gerar insight com IA (OpenRouter) ──────────────────────────
    const { data: configRow } = await supabase
      .from('admin_config')
      .select('valor')
      .eq('chave', 'OPENROUTER_API_KEY')
      .single();

    const apiKey = configRow?.valor as string;

    let insightIA = '';
    let recomendacoes: string[] = [];

    if (apiKey) {
      const benchmarkStr = (benchmarksRes.data ?? []).slice(0, 3)
        .map((b: any) => `${b.ano}: ${b.total_orcamentos} orç, ${b.taxa_conversao_pct}% conv, R$${Number(b.ticket_medio_reais).toFixed(0)} ticket`)
        .join(' | ');

      const clientesStr = (clientIntRes.data ?? []).slice(0, 5)
        .map((c: any) => `${c.nome_cliente} (${c.nivel_risco === 'critico' ? '⚠️ CRÍTICO' : c.nivel_risco}, ${c.percentual_faturamento ?? '?'}% fat)`)
        .join(', ');

      const prompt = `Análise de inteligência comercial da Croma Print (comunicação visual):

PERÍODO: últimos 30 dias (${now.toLocaleDateString('pt-BR')})
SAZONALIDADE ${mesAtual.toUpperCase()}: fator ${fatorSazonalidade}x (${Number(fatorSazonalidade) < 1 ? 'abaixo da média' : 'acima da média'})

PIPELINE ATUAL:
- Propostas criadas: ${totalPropostas30d}
- Taxa de conversão: ${taxaConversao30d}% (meta: ${taxaConversaoMeta}%)
- Ticket médio: R$ ${ticketMedio30d} (meta: R$ ${Number(ticketMediometa).toFixed(0)})
- Valor aprovado: R$ ${valorAprovado30d.toFixed(0)}
- Orçamentos parados (3+ dias): ${qtdParados}
- Contas vencidas: ${contasVencidas.data?.length ?? 0}

BENCHMARKS HISTÓRICOS: ${benchmarkStr || 'indisponível'}

CLIENTES: ${clientesStr || 'dados não disponíveis'}
CONCENTRAÇÃO BEIRA RIO: ${concentracaoBeirario > 0 ? `${concentracaoBeirario}%` : 'não calculada'}
ALERTAS DISPARADOS: ${alertasDisparados.join(', ') || 'nenhum'}

Gere análise estratégica em JSON:
{
  "insight": "2-3 frases de análise do momento comercial, considerando sazonalidade e benchmarks",
  "situacao": "critica|atencao|normal|positiva",
  "recomendacoes": ["ação 1", "ação 2", "ação 3"]
}`;

      try {
        const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://crm-croma.vercel.app',
          },
          body: JSON.stringify({
            model: 'openai/gpt-4.1-mini',
            messages: [
              { role: 'system', content: 'Você é um analista comercial sênior da Croma Print. Responda apenas em JSON válido.' },
              { role: 'user', content: prompt },
            ],
            max_tokens: 500,
            temperature: 0.3,
            response_format: { type: 'json_object' },
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const raw = aiData.choices?.[0]?.message?.content ?? '{}';
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            insightIA = parsed.insight ?? '';
            recomendacoes = parsed.recomendacoes ?? [];

            // Log uso de AI
            await supabase.from('ai_logs').insert({
              user_id: userId,
              function_name: 'inteligencia-comercial',
              entity_type: 'geral',
              entity_id: null,
              model_used: 'openai/gpt-4.1-mini',
              tokens_input: aiData.usage?.prompt_tokens ?? 0,
              tokens_output: aiData.usage?.completion_tokens ?? 0,
              cost_usd: ((aiData.usage?.prompt_tokens ?? 0) * 0.40 + (aiData.usage?.completion_tokens ?? 0) * 1.60) / 1_000_000,
              duration_ms: 0,
              status: 'success',
            }).catch(() => {});
          }
        }
      } catch {
        // AI falhou — retorna insights sem IA
      }
    }

    // Fallback se IA não gerou
    if (!insightIA) {
      const partes: string[] = [];
      if (taxaConversao30d < 65) partes.push(`Conversão abaixo da meta: ${taxaConversao30d}% vs ${taxaConversaoMeta}% alvo.`);
      else partes.push(`Conversão em ${taxaConversao30d}% — ${taxaConversao30d >= Number(taxaConversaoMeta) ? 'meta atingida' : 'abaixo da meta'}.`);
      if (qtdParados > 0) partes.push(`${qtdParados} orçamento(s) aguardando retorno há 3+ dias.`);
      if (concentracaoBeirario > Number(limiteConcentracao)) partes.push(`Concentração Beira Rio em ${concentracaoBeirario}% — acima do limite de ${limiteConcentracao}%.`);
      insightIA = partes.join(' ') || 'Sem dados suficientes para análise no período.';
    }

    // ── 6. Retornar resultado ─────────────────────────────────────────
    return jsonResponse({
      insight: insightIA,
      situacao: concentracaoBeirario > Number(limiteConcentracao) || taxaConversao30d < 50
        ? 'critica'
        : qtdParados > 3 || taxaConversao30d < Number(taxaConversaoMeta)
          ? 'atencao'
          : 'normal',
      metricas: {
        total_propostas_30d: totalPropostas30d,
        total_aprovadas_30d: totalAprovadas30d,
        taxa_conversao_30d: taxaConversao30d,
        taxa_conversao_meta: Number(taxaConversaoMeta),
        ticket_medio_30d: ticketMedio30d,
        ticket_medio_meta: Number(ticketMediometa),
        valor_aprovado_30d: valorAprovado30d,
        orcamentos_parados: qtdParados,
        contas_vencidas: contasVencidas.data?.length ?? 0,
        concentracao_maior_cliente_pct: concentracaoBeirario,
        fator_sazonalidade: Number(fatorSazonalidade),
        mes_referencia: mesAtual,
      },
      benchmarks: {
        ultimo_ano: ultimoBenchmark?.ano ?? null,
        taxa_conversao_historica: ultimoBenchmark?.taxa_conversao_pct ?? null,
        ticket_medio_historico: ultimoBenchmark?.ticket_medio_reais ?? null,
      },
      clientes_risco: clientesCriticos.map((c: any) => ({
        nome: c.nome_cliente,
        nivel_risco: c.nivel_risco,
        percentual_faturamento: c.percentual_faturamento,
        alerta_ativo: c.alerta_ativo,
      })),
      alertas_disparados: alertasDisparados,
      recomendacoes,
    }, 200, corsHeaders);

  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500, getCorsHeaders(req));
  }
});
