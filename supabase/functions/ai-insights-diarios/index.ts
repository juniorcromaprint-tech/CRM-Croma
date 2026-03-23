// ai-insights-diarios: Daily AI-generated business insights
// Fetches KPIs, compares with previous periods, generates executive summary

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsOptions, authenticateAndAuthorize, jsonResponse } from '../ai-shared/ai-helpers.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsOptions();
  const corsHeaders = getCorsHeaders(req);

  try {
    const authResult = await authenticateAndAuthorize(req, ['admin', 'diretor', 'gerente', 'comercial', 'financeiro']);
    if ('error' in authResult) {
      return jsonResponse({ error: authResult.error }, 401, corsHeaders);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const weekAgoStart = new Date(todayStart); weekAgoStart.setDate(weekAgoStart.getDate() - 7);
    const monthAgoStart = new Date(todayStart); monthAgoStart.setDate(monthAgoStart.getDate() - 30);

    // ── Parallel KPI queries ─────────────────────────────────────────
    const [
      leadsHoje, leadsOntem, leadsSemana,
      orcHoje, orcOntem, orcSemana,
      pedidosHoje, pedidosOntem,
      faturamentoMes,
      contasVencidas,
      alertas,
    ] = await Promise.all([
      // Leads
      supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
      supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', yesterdayStart.toISOString()).lt('created_at', todayStart.toISOString()),
      supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', weekAgoStart.toISOString()),

      // Propostas enviadas
      supabase.from('propostas').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
      supabase.from('propostas').select('*', { count: 'exact', head: true }).gte('created_at', yesterdayStart.toISOString()).lt('created_at', todayStart.toISOString()),
      supabase.from('propostas').select('valor_total').gte('created_at', weekAgoStart.toISOString()),

      // Pedidos
      supabase.from('pedidos').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()).is('excluido_em', null),
      supabase.from('pedidos').select('*', { count: 'exact', head: true }).gte('created_at', yesterdayStart.toISOString()).lt('created_at', todayStart.toISOString()).is('excluido_em', null),

      // Faturamento (pedidos concluídos no mês)
      supabase.from('pedidos').select('valor_total').gte('data_conclusao', monthAgoStart.toISOString()).is('excluido_em', null).in('status', ['concluido', 'faturado', 'entregue']),

      // Contas vencidas
      supabase.from('contas_receber').select('*', { count: 'exact', head: true }).eq('status', 'vencida').gt('saldo', 0),

      // Alertas ativos
      supabase.from('ai_alertas').select('id, tipo, titulo, descricao, severidade, created_at').eq('resolvido', false).order('created_at', { ascending: false }).limit(10),
    ]);

    // ── Aggregate values ─────────────────────────────────────────────
    const valorOrcSemana = (orcSemana.data ?? []).reduce((s: number, r: any) => s + (Number(r.valor_total) || 0), 0);
    const valorFatMes = (faturamentoMes.data ?? []).reduce((s: number, r: any) => s + (Number(r.valor_total) || 0), 0);

    const metricas = {
      leads_hoje: leadsHoje.count ?? 0,
      leads_ontem: leadsOntem.count ?? 0,
      leads_semana: leadsSemana.count ?? 0,
      orcamentos_hoje: orcHoje.count ?? 0,
      orcamentos_ontem: orcOntem.count ?? 0,
      valor_orcamentos_semana: valorOrcSemana,
      pedidos_hoje: pedidosHoje.count ?? 0,
      pedidos_ontem: pedidosOntem.count ?? 0,
      faturamento_mes: valorFatMes,
      contas_vencidas: contasVencidas.count ?? 0,
      alertas_ativos: (alertas.data ?? []).length,
    };

    // ── Generate AI summary ──────────────────────────────────────────
    const { data: configRow } = await supabase
      .from('admin_config')
      .select('valor')
      .eq('chave', 'OPENROUTER_API_KEY')
      .single();

    const apiKey = configRow?.valor as string;

    let resumo_executivo = '';
    let acoes_recomendadas: string[] = [];

    if (apiKey) {
      const prompt = `Analise os KPIs de hoje da empresa Croma Print (comunicação visual) e gere um resumo executivo em português:

MÉTRICAS DE HOJE:
- Novos leads hoje: ${metricas.leads_hoje} (ontem: ${metricas.leads_ontem})
- Orçamentos criados hoje: ${metricas.orcamentos_hoje} (ontem: ${metricas.orcamentos_ontem})
- Pedidos hoje: ${metricas.pedidos_hoje} (ontem: ${metricas.pedidos_ontem})
- Valor orçamentos últimos 7 dias: R$ ${valorOrcSemana.toFixed(2)}
- Faturamento últimos 30 dias: R$ ${valorFatMes.toFixed(2)}
- Contas vencidas: ${metricas.contas_vencidas}
- Alertas ativos: ${metricas.alertas_ativos}

ALERTAS:
${(alertas.data ?? []).map((a: any) => `- [${a.severidade}] ${a.titulo}: ${a.descricao}`).join('\n') || 'Nenhum alerta'}

Responda EXATAMENTE neste JSON:
{
  "resumo": "2-3 frases de resumo executivo do dia, mencionando o que está bom e o que precisa de atenção",
  "acoes": ["ação recomendada 1", "ação recomendada 2", "ação recomendada 3"]
}`;

      try {
        const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://crm-croma.vercel.app',
          },
          body: JSON.stringify({
            model: 'openai/gpt-4.1-mini',
            messages: [
              { role: 'system', content: 'Você é um analista de negócios. Responda apenas em JSON válido.' },
              { role: 'user', content: prompt },
            ],
            max_tokens: 400,
            temperature: 0.3,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const raw = aiData.choices?.[0]?.message?.content ?? '';
          // Extract JSON from response
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            resumo_executivo = parsed.resumo ?? '';
            acoes_recomendadas = parsed.acoes ?? [];
          }
        }
      } catch {
        // AI failed, continue without summary
      }
    }

    // Fallback if AI didn't generate
    if (!resumo_executivo) {
      const parts = [];
      if (metricas.leads_hoje > metricas.leads_ontem) parts.push(`Dia positivo em leads: ${metricas.leads_hoje} novos (${metricas.leads_hoje - metricas.leads_ontem} a mais que ontem).`);
      else if (metricas.leads_hoje > 0) parts.push(`${metricas.leads_hoje} novo${metricas.leads_hoje > 1 ? 's' : ''} lead${metricas.leads_hoje > 1 ? 's' : ''} hoje.`);
      if (metricas.contas_vencidas > 0) parts.push(`Atenção: ${metricas.contas_vencidas} conta${metricas.contas_vencidas > 1 ? 's' : ''} vencida${metricas.contas_vencidas > 1 ? 's' : ''}.`);
      if (metricas.alertas_ativos > 0) parts.push(`${metricas.alertas_ativos} alerta${metricas.alertas_ativos > 1 ? 's' : ''} ativo${metricas.alertas_ativos > 1 ? 's' : ''} requerem ação.`);
      resumo_executivo = parts.join(' ') || 'Sem atividade significativa hoje.';
    }

    // ── Log ──────────────────────────────────────────────────────────
    await supabase.from('ai_logs').insert({
      funcao: 'insights-diarios',
      user_id: authResult.userId,
      tokens_usados: 0,
      custo: 0,
      metadata: { metricas },
    }).catch(() => {});

    return jsonResponse({
      resumo_executivo,
      metricas,
      alertas_priorizados: alertas.data ?? [],
      acoes_recomendadas,
    }, 200, corsHeaders);

  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500, getCorsHeaders(req));
  }
});
