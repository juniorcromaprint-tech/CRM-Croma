// agent-cron-loop — STANDALONE (sem imports relativos)
// Deploy: npx supabase@latest functions deploy agent-cron-loop --project-ref djwjmfgplnqyffdcgdaw
// Nota: função cron — não usa autenticação de usuário (service role direto)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface AgentConfig {
  max_contatos_dia: number;
  horario_inicio: string;
  horario_fim: string;
  canais_ativos: string[];
}

interface AcaoDecidida {
  conversation_id: string;
  acao: string;
  motivo: string;
  etapa: string;
  canal: string;
  lead: { empresa: string; segmento: string | null };
}

function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

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

  try {
    // ── 1. Verificar horário comercial (BRT = UTC-3) ──────────────────────
    const now = new Date();
    const brtHour = (now.getUTCHours() - 3 + 24) % 24;

    const { data: configRow } = await supabase.from('admin_config').select('valor').eq('chave', 'agent_config').single();

    const config: AgentConfig = configRow?.valor
      ? (typeof configRow.valor === 'string' ? JSON.parse(configRow.valor) : configRow.valor)
      : { max_contatos_dia: 20, horario_inicio: '08:00', horario_fim: '23:00', canais_ativos: ['email'] };

    const startHour = parseInt(config.horario_inicio?.split(':')[0] ?? '8', 10);
    const endHour = parseInt(config.horario_fim?.split(':')[0] ?? '23', 10);

    if (brtHour < startHour || brtHour >= endHour) {
      return jsonOk({ status: 'skipped', motivo: `Fora do horário comercial (${brtHour}h BRT, janela ${startHour}-${endHour}h)` });
    }

    // ── 2. Verificar limite diário ────────────────────────────────────────
    const todayStart = new Date();
    todayStart.setUTCHours(todayStart.getUTCHours() - 3);
    todayStart.setHours(0, 0, 0, 0);

    const { count: sentToday } = await supabase
      .from('agent_messages')
      .select('*', { count: 'exact', head: true })
      .eq('direcao', 'enviada')
      .gte('enviado_em', todayStart.toISOString());

    if ((sentToday ?? 0) >= config.max_contatos_dia) {
      return jsonOk({ status: 'skipped', motivo: `Limite diário atingido (${sentToday}/${config.max_contatos_dia})` });
    }

    // ── 3. Invocar orquestrador (ai-decidir-acao) ─────────────────────────
    const { data: orqResult, error: orqError } = await supabase.functions.invoke('ai-decidir-acao', { body: { modo: 'batch' } });
    if (orqError) throw new Error(`Orquestrador falhou: ${orqError.message}`);

    const acoes: AcaoDecidida[] = orqResult?.acoes ?? [];
    if (acoes.length === 0) return jsonOk({ status: 'ok', motivo: 'Nenhuma conversa precisando de ação', total_processadas: 0 });

    // ── 4. Processar cada ação ────────────────────────────────────────────
    const results: Array<{ conversation_id: string; acao: string; resultado: string }> = [];
    let enviadas = 0;
    const remaining = config.max_contatos_dia - (sentToday ?? 0);

    for (const acao of acoes) {
      if (enviadas >= remaining) {
        results.push({ conversation_id: acao.conversation_id, acao: acao.acao, resultado: 'skipped_limite_diario' });
        continue;
      }
      if (!['enviar_followup', 'compor_resposta'].includes(acao.acao)) {
        results.push({ conversation_id: acao.conversation_id, acao: acao.acao, resultado: 'nao_requer_envio' });
        continue;
      }

      try {
        const { data: conv } = await supabase.from('agent_conversations').select('lead_id, auto_aprovacao').eq('id', acao.conversation_id).single();
        if (!conv?.lead_id) { results.push({ conversation_id: acao.conversation_id, acao: acao.acao, resultado: 'erro_sem_lead' }); continue; }

        const { data: msgResult, error: msgError } = await supabase.functions.invoke('ai-compor-mensagem', {
          body: { lead_id: conv.lead_id, canal: acao.canal, etapa: acao.etapa, contexto_extra: `Ação do orquestrador: ${acao.motivo}` },
        });
        if (msgError) { results.push({ conversation_id: acao.conversation_id, acao: acao.acao, resultado: `erro_composicao: ${msgError.message}` }); continue; }

        const messageId = msgResult?.message_id;
        if (!messageId) { results.push({ conversation_id: acao.conversation_id, acao: acao.acao, resultado: 'erro_sem_message_id' }); continue; }

        const { data: convFull } = await supabase.from('agent_conversations').select('score_engajamento, auto_aprovacao').eq('id', acao.conversation_id).single();
        const autoApprove = convFull?.auto_aprovacao === true && (convFull?.score_engajamento ?? 0) < 50;

        if (!autoApprove) { results.push({ conversation_id: acao.conversation_id, acao: acao.acao, resultado: 'composta_aguardando_aprovacao' }); continue; }

        await supabase.from('agent_messages').update({ status: 'aprovada', aprovado_em: new Date().toISOString(), metadata: { auto_aprovado: true, motivo: 'cron_loop_lead_frio' } }).eq('id', messageId);

        const dispatchFn = acao.canal === 'whatsapp' ? 'whatsapp-enviar' : 'agent-enviar-email';
        const { error: sendError } = await supabase.functions.invoke(dispatchFn, { body: { message_id: messageId } });
        if (sendError) { results.push({ conversation_id: acao.conversation_id, acao: acao.acao, resultado: `erro_envio: ${sendError.message}` }); continue; }

        enviadas++;
        results.push({ conversation_id: acao.conversation_id, acao: acao.acao, resultado: `enviada_${acao.canal}` });
      } catch (err) {
        results.push({ conversation_id: acao.conversation_id, acao: acao.acao, resultado: `erro: ${(err as Error).message}` });
      }
    }

    const duration = Date.now() - startTime;
    await supabase.from('ai_logs').insert({ funcao: 'agent-cron-loop', duracao_ms: duration, tokens_usados: 0, custo: 0, metadata: { total_acoes: acoes.length, enviadas, results: results.slice(0, 50) } });

    return jsonOk({
      status: 'ok',
      total_processadas: acoes.length,
      enviadas,
      aguardando_aprovacao: results.filter(r => r.resultado === 'composta_aguardando_aprovacao').length,
      skipped: results.filter(r => r.resultado.startsWith('skipped')).length,
      erros: results.filter(r => r.resultado.startsWith('erro')).length,
      duracao_ms: duration,
      detalhes: results,
    });

  } catch (err) {
    const duration = Date.now() - startTime;
    await supabase.from('ai_logs').insert({ funcao: 'agent-cron-loop', duracao_ms: duration, tokens_usados: 0, custo: 0, metadata: { erro: (err as Error).message } }).catch(() => {});
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
