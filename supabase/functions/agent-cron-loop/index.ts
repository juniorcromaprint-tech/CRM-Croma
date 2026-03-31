// agent-cron-loop: Automated agent orchestrator
// Runs on schedule (every 30 min, 08:00-23:00 BRT)
// Calls ai-decidir-acao → ai-compor-mensagem → whatsapp-enviar / agent-enviar-email
// Uses service role (no user auth — this is a cron job)

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

Deno.serve(async (req) => {
  // Accept GET (cron) and POST (manual trigger)
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
    // ── 1. Check business hours (BRT = UTC-3) ────────────────────────────
    const now = new Date();
    const brtHour = (now.getUTCHours() - 3 + 24) % 24;

    const { data: configRow } = await supabase
      .from('admin_config')
      .select('valor')
      .eq('chave', 'agent_config')
      .single();

    const config: AgentConfig = configRow?.valor
      ? (typeof configRow.valor === 'string' ? JSON.parse(configRow.valor) : configRow.valor)
      : { max_contatos_dia: 20, horario_inicio: '08:00', horario_fim: '23:00', canais_ativos: ['email'] };

    const startHour = parseInt(config.horario_inicio?.split(':')[0] ?? '8', 10);
    const endHour = parseInt(config.horario_fim?.split(':')[0] ?? '23', 10);

    if (brtHour < startHour || brtHour >= endHour) {
      return jsonOk({
        status: 'skipped',
        motivo: `Fora do horário comercial (${brtHour}h BRT, janela ${startHour}-${endHour}h)`,
      });
    }

    // ── 2. Check daily send limit ────────────────────────────────────────
    const todayStart = new Date();
    todayStart.setUTCHours(todayStart.getUTCHours() - 3); // BRT adjustment
    todayStart.setHours(0, 0, 0, 0);

    const { count: sentToday } = await supabase
      .from('agent_messages')
      .select('*', { count: 'exact', head: true })
      .eq('direcao', 'enviada')
      .gte('enviado_em', todayStart.toISOString());

    if ((sentToday ?? 0) >= config.max_contatos_dia) {
      return jsonOk({
        status: 'skipped',
        motivo: `Limite diário atingido (${sentToday}/${config.max_contatos_dia})`,
      });
    }

    // ── 3. Run orchestrator (ai-decidir-acao) ────────────────────────────
    const { data: orqResult, error: orqError } = await supabase.functions.invoke(
      'ai-decidir-acao',
      { body: { modo: 'batch' } }
    );

    if (orqError) {
      throw new Error(`Orquestrador falhou: ${orqError.message}`);
    }

    const acoes: AcaoDecidida[] = orqResult?.acoes ?? [];

    if (acoes.length === 0) {
      return jsonOk({
        status: 'ok',
        motivo: 'Nenhuma conversa precisando de ação',
        total_processadas: 0,
      });
    }

    // ── 4. Process each action ──────────────────────────────────────────
    const results: Array<{ conversation_id: string; acao: string; resultado: string }> = [];
    let enviadas = 0;
    const remaining = config.max_contatos_dia - (sentToday ?? 0);

    for (const acao of acoes) {
      // Skip if we've hit the daily limit
      if (enviadas >= remaining) {
        results.push({
          conversation_id: acao.conversation_id,
          acao: acao.acao,
          resultado: 'skipped_limite_diario',
        });
        continue;
      }

      // Only process send-type actions
      if (!['enviar_followup', 'compor_resposta'].includes(acao.acao)) {
        results.push({
          conversation_id: acao.conversation_id,
          acao: acao.acao,
          resultado: 'nao_requer_envio',
        });
        continue;
      }

      // ── 4a.1 Intent detection: check if lead wants a quote ──────────────
      // When lead has replied (compor_resposta), detect purchase intent first
      if (acao.acao === 'compor_resposta') {
        try {
          const { data: intentResult } = await supabase.functions.invoke(
            'ai-detectar-intencao-orcamento',
            {
              body: {
                conversation_id: acao.conversation_id,
                auto_gerar: true, // auto-generate quote if confidence >= 0.7
              },
            }
          );

          if (intentResult?.orcamento_auto && intentResult?.orcamento_resultado?.status === 'proposta_criada') {
            results.push({
              conversation_id: acao.conversation_id,
              acao: 'gerar_orcamento_auto',
              resultado: `orcamento_gerado_${intentResult.orcamento_resultado.proposta_numero}`,
            });
            enviadas++;
            continue; // Skip normal message composition — quote was sent instead
          }
        } catch (intentErr) {
          console.warn('Intent detection failed, continuing with normal flow:', (intentErr as Error).message);
        }
      }

      try {
        // 4a. Get lead_id from conversation
        const { data: conv } = await supabase
          .from('agent_conversations')
          .select('lead_id, auto_aprovacao')
          .eq('id', acao.conversation_id)
          .single();

        if (!conv?.lead_id) {
          results.push({
            conversation_id: acao.conversation_id,
            acao: acao.acao,
            resultado: 'erro_sem_lead',
          });
          continue;
        }

        // 4b. Compose message via ai-compor-mensagem
        const { data: msgResult, error: msgError } = await supabase.functions.invoke(
          'ai-compor-mensagem',
          {
            body: {
              lead_id: conv.lead_id,
              canal: acao.canal,
              etapa: acao.etapa,
              contexto_extra: `Ação do orquestrador: ${acao.motivo}`,
            },
          }
        );

        if (msgError) {
          results.push({
            conversation_id: acao.conversation_id,
            acao: acao.acao,
            resultado: `erro_composicao: ${msgError.message}`,
          });
          continue;
        }

        const messageId = msgResult?.message_id;
        if (!messageId) {
          results.push({
            conversation_id: acao.conversation_id,
            acao: acao.acao,
            resultado: 'erro_sem_message_id',
          });
          continue;
        }

        // 4c. Check if auto-approval is enabled for this conversation
        // Get the conversation's score to decide auto-approval
        const { data: convFull } = await supabase
          .from('agent_conversations')
          .select('score_engajamento, auto_aprovacao')
          .eq('id', acao.conversation_id)
          .single();

        const autoApprove = convFull?.auto_aprovacao === true
          && (convFull?.score_engajamento ?? 0) < 50; // Only auto-approve for cold leads

        if (!autoApprove) {
          results.push({
            conversation_id: acao.conversation_id,
            acao: acao.acao,
            resultado: 'composta_aguardando_aprovacao',
          });
          continue;
        }

        // 4d. Auto-approve the message
        await supabase
          .from('agent_messages')
          .update({
            status: 'aprovada',
            aprovado_em: new Date().toISOString(),
            metadata: { auto_aprovado: true, motivo: 'cron_loop_lead_frio' },
          })
          .eq('id', messageId);

        // 4e. Dispatch the message
        const dispatchFn = acao.canal === 'whatsapp' ? 'whatsapp-enviar' : 'agent-enviar-email';

        const { error: sendError } = await supabase.functions.invoke(dispatchFn, {
          body: { message_id: messageId },
        });

        if (sendError) {
          results.push({
            conversation_id: acao.conversation_id,
            acao: acao.acao,
            resultado: `erro_envio: ${sendError.message}`,
          });
          continue;
        }

        enviadas++;
        results.push({
          conversation_id: acao.conversation_id,
          acao: acao.acao,
          resultado: `enviada_${acao.canal}`,
        });
      } catch (err) {
        results.push({
          conversation_id: acao.conversation_id,
          acao: acao.acao,
          resultado: `erro: ${(err as Error).message}`,
        });
      }
    }

    // ── 5. Log execution ────────────────────────────────────────────────
    const duration = Date.now() - startTime;

    await supabase.from('ai_logs').insert({
      funcao: 'agent-cron-loop',
      duracao_ms: duration,
      tokens_usados: 0,
      custo: 0,
      metadata: {
        total_acoes: acoes.length,
        enviadas,
        results: results.slice(0, 50), // Cap logged results
      },
    });

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

    // Log error
    await supabase.from('ai_logs').insert({
      funcao: 'agent-cron-loop',
      duracao_ms: duration,
      tokens_usados: 0,
      custo: 0,
      metadata: { erro: (err as Error).message },
    }).catch(() => {}); // Don't fail on log error

    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
