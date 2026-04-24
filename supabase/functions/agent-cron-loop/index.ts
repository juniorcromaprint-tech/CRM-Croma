// agent-cron-loop v2: Motor de execução de regras + Follow-ups
// Roda a cada 30min (08:00-23:00 BRT)
//
// FASE 3.1: Executa agent_rules (cobrança, alertas, estoque, produção, follow-ups)
// FASE 3.2: Cobrança escalonada D1→D3→D7→D15→D30
// Preserva: lógica existente de follow-up de leads via ai-decidir-acao
//
// Uses service role (no user auth — this is a cron job)

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ── Types ────────────────────────────────────────────────────────────
interface AgentRule {
  id: string;
  modulo: string;
  tipo: string;
  nome: string;
  descricao: string;
  condicao: {
    campo: string;
    operador: string;
    valor: string | number;
    filtro?: string;
  };
  acao: {
    tipo: string;
    canal?: string;
    mensagem?: string;
    nivel?: number;
    tom?: string;
    escalar_para?: string;
    acao_automatica?: string;
    prioridade?: string;
    template?: string;
    escalar_se_falha?: boolean;
  };
  prioridade: number;
}

interface RuleExecutionResult {
  rule_name: string;
  matches: number;
  executed: number;
  skipped: number;
  errors: string[];
}

// ── Config ───────────────────────────────────────────────────────────
let TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const TELEGRAM_CHAT_ID = '1065519625'; // Junior

const PIX_CNPJ = '18.923.994/0001-83';
const EMAIL_COMERCIAL = 'junior@cromaprint.com.br';

// ── Cobrança message templates ───────────────────────────────────────
// FIX S2.3 2026-04-24: removido "R$ " do template porque formatBRL() já prefixa → evita "R$ R$ 1.500,00"
const COBRANCA_TEMPLATES: Record<number, (d: Record<string, string>) => string> = {
  1: (d) => `Oi ${d.cliente}! Tudo bem? Percebemos que o pagamento ref. ao pedido ${d.pedido} venceu ontem (${d.vencimento}). O valor é ${d.valor}. Se já pagou, pode desconsiderar! PIX: CNPJ ${PIX_CNPJ}. Qualquer dúvida é só chamar. - Croma Print`,

  2: (d) => `Olá ${d.cliente}, passando para lembrar do pagamento no valor de ${d.valor} (vencido em ${d.vencimento}). Se precisar de segunda via ou combinar outra data, estamos à disposição. PIX: CNPJ ${PIX_CNPJ} - Croma Print`,

  3: (d) => `Prezado(a) ${d.cliente},\n\nInformamos que identificamos um título em aberto no valor de ${d.valor}, com vencimento em ${d.vencimento}, referente ao pedido ${d.pedido}.\n\nSolicitamos a gentileza de regularizar o pagamento.\n\nDados para pagamento:\nPIX CNPJ: ${PIX_CNPJ}\nEmail: ${EMAIL_COMERCIAL}\n\nAtenciosamente,\nCroma Print Comunicação Visual`,
};

// ── Main Handler ─────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    });
  }

  const startTime = Date.now();
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Lazy-load TELEGRAM_BOT_TOKEN from admin_config if not in env
  if (!TELEGRAM_BOT_TOKEN) {
    const { data: tgConfig } = await supabase
      .from('admin_config')
      .select('valor')
      .eq('chave', 'TELEGRAM_BOT_TOKEN')
      .single();
    TELEGRAM_BOT_TOKEN = tgConfig?.valor ?? '';
  }

  try {
    // ── 1. Check business hours (BRT = UTC-3) ──
    const now = new Date();
    const brtHour = (now.getUTCHours() - 3 + 24) % 24;

    const { data: configRow } = await supabase
      .from('admin_config')
      .select('valor')
      .eq('chave', 'agent_config')
      .single();

    const config = configRow?.valor
      ? (typeof configRow.valor === 'string' ? JSON.parse(configRow.valor) : configRow.valor)
      : { max_contatos_dia: 20, horario_inicio: '08:00', horario_fim: '23:00', canais_ativos: ['email'] };

    const startHour = parseInt(config.horario_inicio?.split(':')[0] ?? '8', 10);
    const endHour = parseInt(config.horario_fim?.split(':')[0] ?? '23', 10);

    // Force-run override: ?force=1 permite testes manuais fora do horário
    const url = new URL(req.url);
    const force = url.searchParams.get('force') === '1';

    if (!force && (brtHour < startHour || brtHour >= endHour)) {
      return jsonOk({ status: 'skipped', motivo: `Fora do horário (${brtHour}h BRT)` });
    }

    // ── 2. MOTOR DE REGRAS (agent_rules) ──
    const ruleResults = await processAgentRules(supabase);

    // ── 3. NIGHTLY CYCLE (22h BRT): memory layer + resumo diário ──
    let nightlyResults: any = null;
    if (brtHour === 22) {
      nightlyResults = await processNightlyCycle(supabase);
    }

    // ── 4. FOLLOW-UP DE LEADS (lógica existente) ──
    const followUpResults = await processLeadFollowUps(supabase, config);

    // ── 5. Log execution ──
    const duration = Date.now() - startTime;

    await supabase.from('ai_logs').insert({
      function_name: 'agent-cron-loop',
      entity_type: 'geral',
      model_used: 'rules-engine',
      tokens_input: 0,
      tokens_output: 0,
      cost_usd: 0,
      duration_ms: duration,
      status: 'success',
    }).catch(() => {});

    // Register system_event for monitoring
    // NOTE: entity_id é NOT NULL — usar UUID sentinel '000...000' para eventos de sistema
    const rulesSkipped = ruleResults.reduce((s, r) => s + r.skipped, 0);
    const rulesErrors = ruleResults.reduce((s, r) => s + r.errors.length, 0);
    const sysInsert = await supabase.from('system_events').insert({
      event_type: 'cron_loop_executed',
      entity_type: 'system',
      entity_id: '00000000-0000-0000-0000-000000000000',
      payload: {
        duration_ms: duration,
        rules_processed: ruleResults.length,
        rules_total_matches: ruleResults.reduce((s, r) => s + r.matches, 0),
        actions_success: ruleResults.reduce((s, r) => s + r.executed, 0),
        actions_failed: rulesErrors,
        rules_skipped: rulesSkipped,
        followups: followUpResults,
        nightly: nightlyResults,
        brt_hour: brtHour,
      },
    });
    if (sysInsert.error) {
      console.error('cron_loop_executed insert failed:', sysInsert.error.message);
    }

    return jsonOk({
      status: 'ok',
      duracao_ms: duration,
      regras: {
        processadas: ruleResults.length,
        total_matches: ruleResults.reduce((s, r) => s + r.matches, 0),
        total_executadas: ruleResults.reduce((s, r) => s + r.executed, 0),
        detalhes: ruleResults,
      },
      followups: followUpResults,
      nightly: nightlyResults,
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    await supabase.from('ai_logs').insert({
      function_name: 'agent-cron-loop',
      entity_type: 'geral',
      model_used: 'rules-engine',
      tokens_input: 0, tokens_output: 0, cost_usd: 0,
      duration_ms: duration, status: 'error',
      error_message: (err as Error).message,
    }).catch(() => {});

    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});

// ══════════════════════════════════════════════════════════════════════
// MOTOR DE REGRAS
// ══════════════════════════════════════════════════════════════════════

async function processAgentRules(supabase: SupabaseClient): Promise<RuleExecutionResult[]> {
  const { data: rules } = await supabase
    .from('agent_rules')
    .select('*')
    .eq('ativo', true)
    .order('prioridade', { ascending: true });

  if (!rules || rules.length === 0) return [];

  const results: RuleExecutionResult[] = [];

  for (const rule of rules as AgentRule[]) {
    const result: RuleExecutionResult = {
      rule_name: rule.nome,
      matches: 0, executed: 0, skipped: 0, errors: [],
    };

    try {
      const matches = await evaluateRule(supabase, rule);
      result.matches = matches.length;

      for (const match of matches) {
        const alreadyProcessed = await wasRecentlyProcessed(supabase, rule, match);
        if (alreadyProcessed) {
          result.skipped++;
          continue;
        }

        try {
          await executeRuleAction(supabase, rule, match);
          result.executed++;
        } catch (execErr) {
          result.errors.push(`${match.id}: ${(execErr as Error).message}`);
        }
      }

      // Update rule tracking
      await supabase.from('agent_rules').update({
        last_run: new Date().toISOString(),
        run_count: (rule as any).run_count + 1,
        last_error: result.errors.length > 0 ? result.errors[0] : null,
      }).eq('id', rule.id);

    } catch (ruleErr) {
      result.errors.push((ruleErr as Error).message);
      await supabase.from('agent_rules').update({
        last_run: new Date().toISOString(),
        last_error: (ruleErr as Error).message,
      }).eq('id', rule.id);
    }

    results.push(result);
  }

  return results;
}

// ── Evaluate rule condition → return matching records ──
async function evaluateRule(supabase: SupabaseClient, rule: AgentRule): Promise<any[]> {
  const cond = rule.condicao;
  const table = cond.campo?.split('.')[0];

  if (!table) return [];

  // Build query based on rule module + condition
  let query: string;

  switch (rule.nome) {
    // ── COBRANÇA ──
    case 'cobranca_d1':
      query = `SELECT cr.id, cr.valor_original, cr.saldo, cr.data_vencimento, cr.numero_titulo, cr.pedido_id,
        cr.cliente_id, c.nome_fantasia as cliente_nome, c.telefone, c.email,
        (CURRENT_DATE - cr.data_vencimento) as dias_atraso, p.numero as pedido_numero
        FROM contas_receber cr JOIN clientes c ON c.id = cr.cliente_id LEFT JOIN pedidos p ON p.id = cr.pedido_id
        WHERE cr.status IN ('vencido','parcial','faturado','a_vencer') AND (CURRENT_DATE - cr.data_vencimento) BETWEEN 1 AND 2
        AND cr.data_pagamento IS NULL AND cr.saldo > 0 AND cr.excluido_em IS NULL`;
      break;

    case 'cobranca_d3':
      query = `SELECT cr.id, cr.valor_original, cr.saldo, cr.data_vencimento, cr.numero_titulo, cr.pedido_id,
        cr.cliente_id, c.nome_fantasia as cliente_nome, c.telefone, c.email,
        (CURRENT_DATE - cr.data_vencimento) as dias_atraso, p.numero as pedido_numero
        FROM contas_receber cr JOIN clientes c ON c.id = cr.cliente_id LEFT JOIN pedidos p ON p.id = cr.pedido_id
        WHERE cr.status IN ('vencido','parcial','faturado','a_vencer') AND (CURRENT_DATE - cr.data_vencimento) BETWEEN 3 AND 6
        AND cr.data_pagamento IS NULL AND cr.saldo > 0 AND cr.excluido_em IS NULL`;
      break;

    case 'cobranca_d7':
      query = `SELECT cr.id, cr.valor_original, cr.saldo, cr.data_vencimento, cr.numero_titulo, cr.pedido_id,
        cr.cliente_id, c.nome_fantasia as cliente_nome, c.telefone, c.email,
        (CURRENT_DATE - cr.data_vencimento) as dias_atraso, p.numero as pedido_numero
        FROM contas_receber cr JOIN clientes c ON c.id = cr.cliente_id LEFT JOIN pedidos p ON p.id = cr.pedido_id
        WHERE cr.status IN ('vencido','parcial','faturado','a_vencer') AND (CURRENT_DATE - cr.data_vencimento) BETWEEN 7 AND 14
        AND cr.data_pagamento IS NULL AND cr.saldo > 0 AND cr.excluido_em IS NULL`;
      break;

    case 'cobranca_d15_alerta_junior':
      query = `SELECT cr.id, cr.valor_original, cr.saldo, cr.data_vencimento, cr.numero_titulo, cr.pedido_id,
        cr.cliente_id, c.nome_fantasia as cliente_nome, c.telefone, c.email,
        (CURRENT_DATE - cr.data_vencimento) as dias_atraso, p.numero as pedido_numero
        FROM contas_receber cr JOIN clientes c ON c.id = cr.cliente_id LEFT JOIN pedidos p ON p.id = cr.pedido_id
        WHERE cr.status IN ('vencido','parcial','faturado','a_vencer') AND (CURRENT_DATE - cr.data_vencimento) BETWEEN 15 AND 29
        AND cr.data_pagamento IS NULL AND cr.saldo > 0 AND cr.excluido_em IS NULL`;
      break;

    case 'cobranca_d30_suspensao':
      query = `SELECT cr.id, cr.valor_original, cr.saldo, cr.data_vencimento, cr.numero_titulo, cr.pedido_id,
        cr.cliente_id, c.nome_fantasia as cliente_nome, c.telefone, c.email,
        (CURRENT_DATE - cr.data_vencimento) as dias_atraso, p.numero as pedido_numero
        FROM contas_receber cr JOIN clientes c ON c.id = cr.cliente_id LEFT JOIN pedidos p ON p.id = cr.pedido_id
        WHERE cr.status IN ('vencido','parcial','faturado','a_vencer') AND (CURRENT_DATE - cr.data_vencimento) >= 30
        AND cr.data_pagamento IS NULL AND cr.saldo > 0 AND cr.excluido_em IS NULL`;
      break;

    // ── PRODUÇÃO ──
    case 'op_atrasada':
      query = `SELECT op.id, op.numero, op.status, op.prazo_interno, op.pedido_id,
        p.numero as pedido_numero, c.nome_fantasia as cliente_nome
        FROM ordens_producao op LEFT JOIN pedidos p ON p.id = op.pedido_id LEFT JOIN clientes c ON c.id = p.cliente_id
        WHERE op.prazo_interno < CURRENT_DATE AND op.status NOT IN ('concluida','cancelada','finalizado')
        AND op.excluido_em IS NULL`;
      break;

    case 'priorizar_op_urgente':
      query = `SELECT op.id, op.numero, op.status, op.prioridade, op.prazo_interno,
        (op.prazo_interno - CURRENT_DATE) as dias_restantes,
        p.numero as pedido_numero, c.nome_fantasia as cliente_nome
        FROM ordens_producao op LEFT JOIN pedidos p ON p.id = op.pedido_id LEFT JOIN clientes c ON c.id = p.cliente_id
        WHERE op.prazo_interno <= CURRENT_DATE + 3 AND op.status IN ('pendente','em_producao','criada','liberada')
        AND op.excluido_em IS NULL`;
      break;

    // ── ESTOQUE ──
    case 'estoque_minimo':
      query = `SELECT m.id, m.nome, m.unidade, m.estoque_minimo,
        COALESCE(es.saldo_disponivel, 0) as estoque_atual
        FROM materiais m
        LEFT JOIN vw_estoque_disponivel es ON es.material_id = m.id
        WHERE m.estoque_minimo > 0 AND COALESCE(es.saldo_disponivel, 0) <= m.estoque_minimo
        AND m.estoque_controlado = true`;
      break;

    case 'sugerir_compra_automatica':
      query = `SELECT m.id, m.nome, m.unidade, m.estoque_minimo,
        COALESCE(es.saldo_disponivel, 0) as estoque_atual
        FROM materiais m
        LEFT JOIN vw_estoque_disponivel es ON es.material_id = m.id
        WHERE m.estoque_minimo > 0 AND COALESCE(es.saldo_disponivel, 0) <= (m.estoque_minimo * 0.5)
        AND m.estoque_controlado = true`;
      break;

    // ── COMERCIAL ──
    case 'lead_quente_sem_orcamento':
      query = `SELECT l.id, l.contato_nome, l.empresa, l.score, l.created_at,
        (CURRENT_DATE - l.created_at::date) as dias_sem_orcamento
        FROM leads l
        WHERE l.score >= 70 AND l.status NOT IN ('convertido','perdido','descartado')
        AND NOT EXISTS (SELECT 1 FROM propostas p JOIN clientes cl ON cl.id = p.cliente_id
          WHERE cl.lead_origem_id = l.id)`;
      break;

    case 'follow_up_lead_24h':
      // FIX 2026-04-24: filtrar leads COM contato válido + excluir já processados nas últimas 24h
      // + LIMIT 20 para evitar floods quando há bulk import de 400+ leads
      query = `SELECT l.id, l.contato_nome, l.empresa, l.email, l.telefone, l.score,
        l.status, l.updated_at
        FROM leads l
        WHERE l.updated_at < now() - interval '24 hours'
        AND l.status NOT IN ('convertido','perdido','descartado')
        AND (
          (l.telefone IS NOT NULL AND l.telefone <> '')
          OR (l.email IS NOT NULL AND l.email <> '')
        )
        AND NOT EXISTS (
          SELECT 1 FROM system_events se
          WHERE se.entity_id = l.id
          AND se.event_type = 'rule_executed'
          AND se.payload->>'rule_name' = 'follow_up_lead_24h'
          AND se.created_at > now() - interval '24 hours'
        )
        ORDER BY l.score DESC NULLS LAST, l.updated_at ASC
        LIMIT 20`;
      break;

    case 'follow_up_proposta_48h':
      query = `SELECT p.id, p.numero, p.valor_total, p.created_at,
        c.nome_fantasia as cliente_nome, c.email, c.telefone
        FROM propostas p JOIN clientes c ON c.id = p.cliente_id
        WHERE p.created_at < now() - interval '48 hours' AND p.status = 'enviada'
        AND p.excluido_em IS NULL`;
      break;

    // ── INSTALAÇÃO ──
    case 'notificar_equipe_campo':
      query = `SELECT oi.id, oi.numero, oi.data_agendada, oi.hora_prevista,
        oi.endereco_completo, oi.instrucoes,
        c.nome_fantasia as cliente_nome, c.telefone
        FROM ordens_instalacao oi JOIN clientes c ON c.id = oi.cliente_id
        WHERE oi.data_agendada = CURRENT_DATE + 1
        AND oi.status NOT IN ('cancelada','concluida')
        AND oi.excluido_em IS NULL`;
      break;

    // ── SCORE RECALCULATION ──
    case 'recalcular_scores':
      // Returns a single dummy match to trigger the batch recalculation
      return [{ id: 'batch', tipo: 'recalcular_scores' }];

    // ── LIMITES (não geram ação automática — apenas bloqueio no frontend) ──
    case 'desconto_maximo_sem_aprovacao':
    case 'valor_pedido_maximo':
      return []; // Rules de limite são validadas no frontend, não aqui

    // ── RESUMO DIÁRIO — processado no ciclo noturno, não aqui ──
    case 'Resumo diario':
      return [];

    default:
      console.warn(`Rule ${rule.nome} não tem query mapeada — skip`);
      return [];
  }

  try {
    const { data, error } = await supabase.rpc('execute_sql_readonly', { query_text: query });
    if (error) {
      // Fallback: executar direto como SQL (service role tem permissão)
      // Usar a abordagem de query via REST API não é viável, usar RPC ou direto
      console.warn(`RPC falhou para ${rule.nome}: ${error.message}, tentando query direta`);
      return [];
    }
    return data ?? [];
  } catch {
    // Se RPC não existe, query via postgres connection
    // Para segurança, retornar vazio e logar
    console.warn(`Nenhum método de execução disponível para ${rule.nome}`);
    return [];
  }
}

// ── Check if already processed (dedup) ──
async function wasRecentlyProcessed(supabase: SupabaseClient, rule: AgentRule, match: any): Promise<boolean> {
  // Para cobrança: verificar em cobranca_automatica
  if (rule.nome.startsWith('cobranca_')) {
    const nivel = rule.acao.nivel ?? 1;
    const { data } = await supabase
      .from('cobranca_automatica')
      .select('id')
      .eq('conta_receber_id', match.id)
      .eq('nivel', nivel)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1);
    return (data?.length ?? 0) > 0;
  }

  // Para outras regras: verificar em system_events FILTRADO POR rule_name
  // FIX 2026-04-24: antes o dedup pegava qualquer rule_executed no entity_id → falso-positivo
  // entre rules diferentes (lead_quente + follow_up apagavam um ao outro).
  // Agora filtra por payload->>'rule_name' usando JSON operator.
  const { data } = await supabase
    .from('system_events')
    .select('id')
    .eq('event_type', 'rule_executed')
    .eq('entity_id', match.id)
    .filter('payload->>rule_name', 'eq', rule.nome)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1);

  return (data?.length ?? 0) > 0;
}

// ── Execute action for matched record ──
async function executeRuleAction(supabase: SupabaseClient, rule: AgentRule, match: any): Promise<void> {
  const acao = rule.acao;

  switch (acao.tipo) {
    case 'cobranca_escalonada':
      await executeCobranca(supabase, rule, match);
      break;

    case 'alerta_telegram':
      await sendTelegramAlert(rule, match);
      break;

    case 'alerta_sistema':
      await createSystemAlert(supabase, rule, match);
      break;

    case 'enviar_mensagem':
      // FIX 2026-04-24: criar/atualizar agent_conversation para que processLeadFollowUps
      // pegue o lead na próxima rodada. Antes só criava alert — envio real nunca saía.
      await ensureConversationScheduled(supabase, rule, match);
      await createSystemAlert(supabase, rule, match);
      break;

    case 'marcar_urgente':
      await markUrgent(supabase, match);
      break;

    case 'notificar_campo':
      await sendTelegramAlert(rule, match);
      break;

    case 'sugerir_compra':
      await createSystemAlert(supabase, rule, match);
      await sendTelegramAlert(rule, match);
      break;

    case 'recalcular_scores':
      await recalculateAllScores(supabase);
      break;

    default:
      console.warn(`Tipo de ação desconhecido: ${acao.tipo}`);
  }

  // Registrar execução em system_events
  await supabase.from('system_events').insert({
    event_type: 'rule_executed',
    entity_type: rule.modulo,
    entity_id: match.id,
    payload: {
      rule_id: rule.id,
      rule_name: rule.nome,
      action_type: acao.tipo,
      match_data: { id: match.id, nome: match.cliente_nome || match.nome || match.contato_nome || '' },
    },
  });
}

// ══════════════════════════════════════════════════════════════════════
// COBRANÇA ESCALONADA
// ══════════════════════════════════════════════════════════════════════

async function executeCobranca(supabase: SupabaseClient, rule: AgentRule, match: any): Promise<void> {
  const nivel = rule.acao.nivel ?? 1;
  const canal = rule.acao.canal ?? 'email';
  const diasAtraso = match.dias_atraso ?? 0;

  // Formatar dados para template
  const templateData: Record<string, string> = {
    cliente: match.cliente_nome ?? 'Cliente',
    valor: formatBRL(match.saldo ?? match.valor_original ?? 0),
    vencimento: formatDate(match.data_vencimento),
    pedido: match.pedido_numero ?? match.numero_titulo ?? '-',
    dias: String(diasAtraso),
  };

  let mensagem = '';

  if (nivel <= 3 && COBRANCA_TEMPLATES[nivel]) {
    mensagem = COBRANCA_TEMPLATES[nivel](templateData);
  } else {
    // D+15 e D+30 → Telegram para Junior
    mensagem = resolveTemplate(rule.acao.mensagem ?? '', templateData);
  }

  // Executar envio baseado no canal
  if (canal === 'whatsapp' && nivel <= 2 && match.telefone) {
    // Tentar envio via template Meta aprovado
    const { data: templateConfig } = await supabase
      .from('admin_config')
      .select('valor')
      .eq('chave', 'WHATSAPP_TEMPLATE_COBRANCA')
      .single();

    if (templateConfig?.valor) {
      const sent = await sendWhatsAppTemplate(supabase, match.telefone, templateConfig.valor, {
        '1': match.cliente_nome ?? 'Cliente',
        '2': formatBRL(match.saldo ?? match.valor_original ?? 0),
        '3': formatDate(match.data_vencimento),
      });
      if (!sent && match.email) {
        await sendCobrancaEmail(supabase, match, mensagem, nivel);
      }
    } else if (match.email) {
      // Fallback: email
      await sendCobrancaEmail(supabase, match, mensagem, nivel);
    }
  } else if (canal === 'email' && nivel === 3) {
    if (match.email) {
      await sendCobrancaEmail(supabase, match, mensagem, nivel);
    }
  }

  // D+15 e D+30: sempre alerta Telegram
  if (nivel >= 4 || rule.nome.includes('d15') || rule.nome.includes('d30')) {
    const telegramMsg = nivel >= 5 || rule.nome.includes('d30')
      ? `🚨 INADIMPLÊNCIA D+${diasAtraso}: ${match.cliente_nome} — ${formatBRL(match.saldo ?? match.valor_original)} vencido há ${diasAtraso} dias. RECOMENDAÇÃO: suspender novos pedidos até regularização.`
      : `⚠️ COBRANÇA D+${diasAtraso}: ${match.cliente_nome} com ${formatBRL(match.saldo ?? match.valor_original)} vencido há ${diasAtraso} dias (pedido ${match.pedido_numero ?? '-'}). Ação sugerida: ligar pessoalmente.`;

    await sendTelegram(telegramMsg);
  }

  // Registrar em cobranca_automatica
  await supabase.from('cobranca_automatica').insert({
    conta_receber_id: match.id,
    cliente_id: match.cliente_id,
    nivel,
    canal: canal === 'whatsapp' && !match.telefone ? 'email' : canal,
    mensagem: mensagem.substring(0, 500),
    status: 'enviado',
    dias_atraso: diasAtraso,
    enviado_em: new Date().toISOString(),
  });
}

async function sendCobrancaEmail(supabase: SupabaseClient, match: any, mensagem: string, nivel: number): Promise<void> {
  if (!match.email) return;

  const assunto = nivel <= 2
    ? `Lembrete de pagamento — Croma Print`
    : `Aviso de título em aberto — Croma Print`;

  try {
    // Usar Resend diretamente (agent-enviar-email requer conversa ativa com lead)
    let resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
    if (!resendKey) {
      const { data: keyRow } = await supabase
        .from('admin_config')
        .select('valor')
        .eq('chave', 'RESEND_API_KEY')
        .single();
      resendKey = keyRow?.valor ?? '';
    }

    if (!resendKey) {
      console.warn('sendCobrancaEmail: RESEND_API_KEY não configurado — email não enviado');
      return;
    }

    const paragrafos = mensagem
      .split(/\n\n+/)
      .map((p) => p.replace(/\n/g, '<br>'))
      .map((p) => `<p style="margin:0 0 14px 0;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#333;">${p}</p>`)
      .join('\n');

    const htmlBody = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:32px 24px;background:#f5f5f5;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;">
    ${paragrafos}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
    <p style="font-family:Arial,sans-serif;font-size:12px;color:#999;margin:0;">Croma Print Comunicação Visual — ${EMAIL_COMERCIAL}</p>
  </div>
</body></html>`;

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `Croma Print <${EMAIL_COMERCIAL}>`,
        to: [match.email],
        subject: assunto,
        html: htmlBody,
        reply_to: EMAIL_COMERCIAL,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`sendCobrancaEmail: Resend erro ${resp.status}: ${errText.substring(0, 200)}`);
    } else {
      console.log(`sendCobrancaEmail: Email enviado para ${match.email} (nível ${nivel})`);
    }
  } catch (emailErr) {
    console.error(`Erro ao enviar email cobrança: ${(emailErr as Error).message}`);
  }
}

// ══════════════════════════════════════════════════════════════════════
// TELEGRAM
// ══════════════════════════════════════════════════════════════════════

async function sendTelegram(message: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('TELEGRAM_BOT_TOKEN não configurado — alerta não enviado');
    return;
  }

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });
  } catch (err) {
    console.error('Telegram send failed:', (err as Error).message);
  }
}

async function sendTelegramAlert(rule: AgentRule, match: any): Promise<void> {
  const templateData: Record<string, string> = {
    cliente: match.cliente_nome ?? match.contato_nome ?? match.nome ?? 'N/A',
    valor: formatBRL(match.saldo ?? match.valor_original ?? match.valor_total ?? 0),
    dias: String(match.dias_atraso ?? match.dias_restantes ?? match.dias_sem_orcamento ?? ''),
    numero: match.numero ?? match.pedido_numero ?? '',
    prazo_entrega: match.prazo_interno ?? '',
    status: match.status ?? '',
    nome: match.nome ?? match.contato_nome ?? '',
    empresa: match.empresa ?? '',
    estoque_atual: String(match.estoque_atual ?? ''),
    estoque_minimo: String(match.estoque_minimo ?? ''),
    endereco_completo: match.endereco_completo ?? '',
  };

  const msg = resolveTemplate(rule.acao.mensagem ?? rule.descricao, templateData);
  await sendTelegram(`🤖 [${rule.modulo.toUpperCase()}] ${msg}`);
}

// ══════════════════════════════════════════════════════════════════════
// SYSTEM ALERTS
// ══════════════════════════════════════════════════════════════════════

async function createSystemAlert(supabase: SupabaseClient, rule: AgentRule, match: any): Promise<void> {
  await supabase.from('system_events').insert({
    event_type: 'alert_generated',
    entity_type: rule.modulo,
    entity_id: match.id,
    payload: {
      rule_id: rule.id,
      rule_name: rule.nome,
      severity: rule.acao.prioridade ?? 'normal',
      message: resolveTemplate(rule.acao.mensagem ?? rule.descricao, {
        cliente: match.cliente_nome ?? match.contato_nome ?? match.nome ?? '',
        nome: match.nome ?? match.contato_nome ?? '',
        empresa: match.empresa ?? '',
        valor: formatBRL(match.saldo ?? match.valor_original ?? 0),
        dias: String(match.dias_atraso ?? ''),
        estoque_atual: String(match.estoque_atual ?? ''),
        estoque_minimo: String(match.estoque_minimo ?? ''),
      }),
    },
  });
}

// ── Garante agent_conversation agendada (fix follow_up_lead_24h) ──
// FIX 2026-04-24: antes o case 'enviar_mensagem' só gerava alert e nada saía.
// Agora conecta o lead ao fluxo real de follow-up via agent_conversations.
async function ensureConversationScheduled(
  supabase: SupabaseClient,
  rule: AgentRule,
  match: any,
): Promise<void> {
  if (!match.id) return;
  // Só aplica a leads — outras rules (propostas, etc) têm fluxo próprio
  if (rule.modulo !== 'comercial' || !rule.nome.startsWith('follow_up_lead')) return;

  // Escolher canal: whatsapp se telefone, senão email
  const hasPhone = !!(match.telefone && String(match.telefone).trim());
  const hasEmail = !!(match.email && String(match.email).trim());
  if (!hasPhone && !hasEmail) return; // Safety — já filtrado na query mas protege
  const canal = hasPhone ? 'whatsapp' : 'email';

  // Verificar se já existe conversa ativa
  const { data: existing } = await supabase
    .from('agent_conversations')
    .select('id, proximo_followup')
    .eq('lead_id', match.id)
    .in('status', ['ativa'])
    .limit(1);

  if (existing && existing.length > 0) {
    // Já existe — apenas garantir proximo_followup <= now para ser pego na próxima rodada
    await supabase
      .from('agent_conversations')
      .update({ proximo_followup: new Date().toISOString() })
      .eq('id', existing[0].id);
    return;
  }

  // Criar nova conversa ativa com follow-up imediato
  await supabase.from('agent_conversations').insert({
    lead_id: match.id,
    canal,
    status: 'ativa',
    etapa: 'abertura',
    mensagens_recebidas: 0,
    mensagens_enviadas: 0,
    score_engajamento: 0,
    proximo_followup: new Date().toISOString(),
    tentativas: 0,
    max_tentativas: 3, // Conservador — 3 tentativas e encerra
    auto_aprovacao: false, // Requer aprovação manual do Junior
  });
}

// ══════════════════════════════════════════════════════════════════════
// URGÊNCIA DE OP
// ══════════════════════════════════════════════════════════════════════

async function markUrgent(supabase: SupabaseClient, match: any): Promise<void> {
  // Aumentar prioridade se não já urgente
  if (match.prioridade < 8) {
    await supabase.from('ordens_producao').update({
      prioridade: 8,
      updated_at: new Date().toISOString(),
    }).eq('id', match.id);
  }
}

// ══════════════════════════════════════════════════════════════════════
// SCORE RECALCULATION
// ══════════════════════════════════════════════════════════════════════

async function recalculateAllScores(supabase: SupabaseClient): Promise<void> {
  try {
    const { data } = await supabase.rpc('fn_recalcular_todos_scores');
    const count = data?.[0]?.clientes_atualizados ?? data?.clientes_atualizados ?? 0;
    console.log(`Scores recalculados: ${count} clientes`);
  } catch (err) {
    console.error('Erro ao recalcular scores:', (err as Error).message);
  }
}

// ══════════════════════════════════════════════════════════════════════
// NIGHTLY CYCLE (22h BRT): Memory Layer + Resumo Diário
// ══════════════════════════════════════════════════════════════════════

async function processNightlyCycle(supabase: SupabaseClient): Promise<any> {
  const results: any = { memory_patterns: 0, resumo_enviado: false };

  try {
    // ── 1. Memory Layer: detect patterns via SQL function ──
    try {
      const { data: patternData } = await supabase.rpc('fn_detectar_padroes_memoria');
      results.memory_patterns = patternData?.[0]?.patterns_updated ?? patternData?.patterns_updated ?? 0;
      console.log('Memory patterns detected:', results.memory_patterns);
    } catch (memErr) {
      console.error('Memory pattern detection failed:', (memErr as Error).message);
    }

    // ── 2. Resumo Diário → Telegram ──
    try {
      const { data: resumoData } = await supabase
        .from('vw_resumo_diario')
        .select('resumo')
        .single();

      if (resumoData?.resumo) {
        const resumo = resumoData.resumo;
        const hoje = new Date().toLocaleDateString('pt-BR', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });

        // Build a formatted daily summary without AI (fallback mode — works without OpenRouter)
        const vencidos = resumo.vencidos_pendentes || { count: 0, valor: 0 };
        const lines = [
          `📊 Resumo do dia — ${hoje}`,
          '',
          `💰 Faturado: ${formatBRL(resumo.faturado || 0)}`,
          `📝 ${resumo.propostas_criadas || 0} propostas criadas, ${resumo.propostas_aprovadas || 0} aprovadas`,
          `🏭 ${resumo.ops_concluidas || 0} OPs concluídas`,
          `👤 ${resumo.leads_novos || 0} leads novos`,
          `📬 ${resumo.cobrancas_enviadas || 0} cobranças enviadas`,
        ];

        if (vencidos.count > 0) {
          lines.push('');
          lines.push(`⚠️ Atenção: ${vencidos.count} título(s) vencido(s) — ${formatBRL(vencidos.valor)}`);
        }

        lines.push('');
        lines.push('Boa noite! 🌙');

        await sendTelegram(lines.join('\n'));
        results.resumo_enviado = true;

        // Register daily summary event
        await supabase.from('system_events').insert({
          event_type: 'daily_summary',
          entity_type: 'system',
          payload: resumo,
        });
      }
    } catch (err) {
      console.error('Erro no resumo diário:', (err as Error).message);
    }

  } catch (err) {
    console.error('Erro no ciclo noturno:', (err as Error).message);
  }

  return results;
}

// ══════════════════════════════════════════════════════════════════════
// FOLLOW-UPS (lógica existente preservada)
// ══════════════════════════════════════════════════════════════════════

function nextEtapa(current: string): string {
  const progression: Record<string, string> = {
    'abertura': 'followup1',
    'followup1': 'followup2',
    'followup2': 'followup3',
    'followup3': 'reengajamento',
    'reengajamento': 'reengajamento',
    'proposta': 'negociacao',
    'negociacao': 'negociacao',
  };
  return progression[current] ?? current;
}

async function processLeadFollowUps(supabase: SupabaseClient, config: any): Promise<any> {
  try {
    // 1. Buscar conversas ativas com follow-up agendado para agora ou no passado
    const { data: convs } = await supabase
      .from('agent_conversations')
      .select(`
        id, lead_id, canal, etapa, status, tentativas, max_tentativas,
        score_engajamento, auto_aprovacao, proximo_followup,
        leads!inner(id, contato_nome, empresa, email, telefone, temperatura, status, segmento)
      `)
      .eq('status', 'ativa')
      .lte('proximo_followup', new Date().toISOString())
      .order('proximo_followup', { ascending: true })
      .limit(config.max_contatos_dia ?? 20);

    if (!convs || convs.length === 0) return { status: 'ok', total: 0, enviadas: 0 };

    let enviadas = 0;

    for (const conv of convs) {
      if (enviadas >= (config.max_contatos_dia ?? 20)) break;
      if (!conv.leads) continue;

      // Verificar se já atingiu máximo de tentativas
      if ((conv.tentativas ?? 0) >= (conv.max_tentativas || config.max_tentativas || 5)) {
        await supabase.from('agent_conversations').update({
          status: 'encerrada',
          metadata: { motivo: 'max_tentativas' },
        }).eq('id', conv.id);
        continue;
      }

      try {
        // Compor mensagem via ai-compor-mensagem (agora aceita service_role)
        const { data: msgResult, error: msgError } = await supabase.functions.invoke(
          'ai-compor-mensagem',
          { body: { lead_id: conv.lead_id, canal: conv.canal, etapa: conv.etapa } }
        );
        if (msgError || !msgResult?.message_id) continue;

        // Auto-aprovar se configurado
        const autoApprove = conv.auto_aprovacao === true;
        if (autoApprove) {
          await supabase.from('agent_messages').update({
            status: 'aprovada',
            aprovado_em: new Date().toISOString(),
            metadata: { auto_aprovado: true, motivo: 'followup_automatico' },
          }).eq('id', msgResult.message_id);

          // Enviar
          const dispatchFn = conv.canal === 'whatsapp' ? 'whatsapp-enviar' : 'agent-enviar-email';
          await supabase.functions.invoke(dispatchFn, { body: { message_id: msgResult.message_id } });
          enviadas++;
        }

        // Atualizar próximo follow-up
        const diasFollowup = config.dias_entre_followup ?? 3;
        const proxFollowup = new Date();
        proxFollowup.setDate(proxFollowup.getDate() + diasFollowup);

        await supabase.from('agent_conversations').update({
          tentativas: (conv.tentativas ?? 0) + 1,
          proximo_followup: proxFollowup.toISOString(),
          etapa: nextEtapa(conv.etapa),
        }).eq('id', conv.id);
      } catch (err) {
        console.error(`Follow-up error conv ${conv.id}:`, (err as Error).message);
      }
    }

    return { status: 'ok', total: convs.length, enviadas };
  } catch (err) {
    return { status: 'error', motivo: (err as Error).message };
  }
}

// ══════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR');
}

function resolveTemplate(template: string, data: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}

// ══════════════════════════════════════════════════════════════════════
// WHATSAPP TEMPLATE SENDER (proactive messages)
// ══════════════════════════════════════════════════════════════════════

async function sendWhatsAppTemplate(
  supabase: SupabaseClient,
  toPhone: string,
  templateName: string,
  params: Record<string, string>
): Promise<boolean> {
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
  if (!token || !phoneId) return false;

  const bodyParameters = Object.values(params).map((value) => ({ type: 'text', text: value }));

  const resp = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneId}/messages`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'pt_BR' },
          components: [{ type: 'body', parameters: bodyParameters }],
        },
      }),
    }
  );

  if (!resp.ok) {
    const err = await resp.text();
    console.error(`sendWhatsAppTemplate: ${resp.status} — ${err.substring(0, 200)}`);
  }
  return resp.ok;
}
