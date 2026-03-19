// supabase/functions/ai-decidir-acao/index.ts
// Orchestrator: processes all active conversations and decides next actions.
// Pure business logic — no AI calls.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  handleCorsOptions,
  getCorsHeaders,
  jsonResponse,
  getServiceClient,
} from '../ai-shared/ai-helpers.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentConfig {
  max_contatos_dia: number;
  dias_entre_followup: number;
  max_tentativas: number;
  canais_ativos: string[];
}

interface Conversation {
  id: string;
  lead_id: string;
  canal: string;
  status: string;
  etapa: string;
  mensagens_enviadas: number;
  mensagens_recebidas: number;
  tentativas: number;
  max_tentativas: number;
  score_engajamento: number;
  proximo_followup: string | null;
  leads: {
    empresa: string;
    contato_nome: string | null;
    segmento: string | null;
    temperatura: string | null;
    score: number | null;
    status: string;
  } | null;
}

type Acao =
  | 'compor_resposta'
  | 'enviar_followup'
  | 'encerrar'
  | 'aguardar_aprovacao'
  | 'sem_acao';

interface AcaoResult {
  conversation_id: string;
  acao: Acao;
  motivo?: string;
  etapa?: string;
  canal?: string;
  lead?: {
    empresa: string;
    segmento: string | null;
  };
}

// ─── Etapa progression maps ───────────────────────────────────────────────────

// When there HAS been a reply — advance toward proposal/negotiation
const ETAPA_COM_RESPOSTA: Record<string, string | null> = {
  abertura: 'followup1',
  followup1: 'followup2',
  followup2: 'proposta',
  followup3: 'proposta',
  proposta: 'negociacao',
  negociacao: null, // already at the end
  reengajamento: 'proposta',
};

// When there has been NO reply — keep nudging with follow-ups
const ETAPA_SEM_RESPOSTA: Record<string, string | null> = {
  abertura: 'followup1',
  followup1: 'followup2',
  followup2: 'followup3',
  followup3: null, // exhausted follow-ups → close
  proposta: 'followup1',
  negociacao: 'followup1',
  reengajamento: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextFollowupDate(diasEntreFollowup: number): string {
  const d = new Date();
  d.setDate(d.getDate() + diasEntreFollowup);
  return d.toISOString();
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const corsResponse = handleCorsOptions(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // ── Auth: require a valid Bearer token ──────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Nao autorizado' }, 401, corsHeaders);
    }

    // ── Parse body ──────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    if (body?.modo !== 'batch') {
      return jsonResponse({ error: "Campo 'modo' deve ser 'batch'" }, 400, corsHeaders);
    }

    const supabase = getServiceClient();

    // ── 1. Fetch agent_config ────────────────────────────────────────────────
    const { data: configRow, error: configErr } = await supabase
      .from('admin_config')
      .select('valor')
      .eq('chave', 'agent_config')
      .single();

    if (configErr || !configRow) {
      return jsonResponse({ error: 'agent_config nao encontrado em admin_config' }, 500, corsHeaders);
    }

    const config: AgentConfig = {
      max_contatos_dia: 20,
      dias_entre_followup: 3,
      max_tentativas: 5,
      canais_ativos: ['email'],
      ...(typeof configRow.valor === 'string' ? JSON.parse(configRow.valor) : configRow.valor),
    };

    // ── 2. Fetch active conversations due for action ─────────────────────────
    const now = new Date().toISOString();

    const { data: conversations, error: convErr } = await supabase
      .from('agent_conversations')
      .select(`
        id,
        lead_id,
        canal,
        status,
        etapa,
        mensagens_enviadas,
        mensagens_recebidas,
        tentativas,
        max_tentativas,
        score_engajamento,
        proximo_followup,
        leads (
          empresa,
          contato_nome,
          segmento,
          temperatura,
          score,
          status
        )
      `)
      .eq('status', 'ativa')
      .or(`proximo_followup.is.null,proximo_followup.lte.${now}`)
      .order('proximo_followup', { ascending: true, nullsFirst: true })
      .limit(config.max_contatos_dia);

    if (convErr) {
      console.error('Erro ao buscar conversas:', convErr);
      return jsonResponse({ error: 'Erro ao buscar conversas ativas', detail: convErr.message }, 500, corsHeaders);
    }

    const rows = (conversations ?? []) as Conversation[];

    // ── 3. Apply deterministic rules to each conversation ────────────────────
    const acoes: AcaoResult[] = [];

    for (const conv of rows) {
      const lead = conv.leads;
      const leadInfo = lead
        ? { empresa: lead.empresa, segmento: lead.segmento }
        : undefined;

      // ── Rule A: Max tentativas exceeded ─────────────────────────────────
      const maxTentativas = conv.max_tentativas ?? config.max_tentativas;
      if (conv.tentativas >= maxTentativas) {
        await supabase
          .from('agent_conversations')
          .update({ status: 'encerrada', updated_at: new Date().toISOString() })
          .eq('id', conv.id);

        if (lead) {
          await supabase
            .from('leads')
            .update({ temperatura: 'frio' })
            .eq('id', conv.lead_id);
        }

        acoes.push({
          conversation_id: conv.id,
          acao: 'encerrar',
          motivo: `Máximo de tentativas atingido (${conv.tentativas}/${maxTentativas})`,
          etapa: conv.etapa,
          canal: conv.canal,
          lead: leadInfo,
        });
        continue;
      }

      // ── Rule B: Lead already converted or lost ───────────────────────────
      if (lead && (lead.status === 'convertido' || lead.status === 'perdido')) {
        await supabase
          .from('agent_conversations')
          .update({ status: 'encerrada', updated_at: new Date().toISOString() })
          .eq('id', conv.id);

        acoes.push({
          conversation_id: conv.id,
          acao: 'encerrar',
          motivo: `Lead com status '${lead.status}' — conversa encerrada automaticamente`,
          etapa: conv.etapa,
          canal: conv.canal,
          lead: leadInfo,
        });
        continue;
      }

      // ── Rule C: Has received replies ─────────────────────────────────────
      if (conv.mensagens_recebidas > 0) {
        const proximaEtapa = ETAPA_COM_RESPOSTA[conv.etapa] ?? conv.etapa;
        const novoScore = Math.min(100, conv.score_engajamento + 25);
        const scoreAlto = novoScore >= 75;

        const updates: Record<string, unknown> = {
          etapa: proximaEtapa,
          score_engajamento: novoScore,
          updated_at: new Date().toISOString(),
        };

        if (scoreAlto) {
          updates.status = 'aguardando_aprovacao';
        }

        await supabase
          .from('agent_conversations')
          .update(updates)
          .eq('id', conv.id);

        if (scoreAlto && lead) {
          await supabase
            .from('leads')
            .update({ temperatura: 'quente' })
            .eq('id', conv.lead_id);
        }

        const acao: Acao = scoreAlto ? 'aguardar_aprovacao' : 'compor_resposta';

        acoes.push({
          conversation_id: conv.id,
          acao,
          motivo: scoreAlto
            ? `Score de engajamento alto (${novoScore}) — aguardando aprovação humana`
            : `Lead respondeu — avançando para etapa '${proximaEtapa}'`,
          etapa: proximaEtapa,
          canal: conv.canal,
          lead: leadInfo,
        });
        continue;
      }

      // ── Rule D: No reply — advance follow-up etapa ───────────────────────
      const proximaEtapa = ETAPA_SEM_RESPOSTA[conv.etapa];

      if (proximaEtapa === null) {
        // No next etapa → close conversation
        await supabase
          .from('agent_conversations')
          .update({ status: 'encerrada', updated_at: new Date().toISOString() })
          .eq('id', conv.id);

        await supabase
          .from('leads')
          .update({ temperatura: 'frio' })
          .eq('id', conv.lead_id);

        acoes.push({
          conversation_id: conv.id,
          acao: 'encerrar',
          motivo: `Sem resposta após etapa '${conv.etapa}' — sem follow-ups disponíveis`,
          etapa: conv.etapa,
          canal: conv.canal,
          lead: leadInfo,
        });
      } else {
        const novasTentativas = conv.tentativas + 1;
        const proximoFollowup = nextFollowupDate(config.dias_entre_followup);

        await supabase
          .from('agent_conversations')
          .update({
            etapa: proximaEtapa,
            tentativas: novasTentativas,
            proximo_followup: proximoFollowup,
            updated_at: new Date().toISOString(),
          })
          .eq('id', conv.id);

        acoes.push({
          conversation_id: conv.id,
          acao: 'enviar_followup',
          motivo: `Sem resposta — avançando para '${proximaEtapa}' (tentativa ${novasTentativas})`,
          etapa: proximaEtapa,
          canal: conv.canal,
          lead: leadInfo,
        });
      }
    }

    // ── 4. Return result ─────────────────────────────────────────────────────
    return jsonResponse(
      {
        acoes,
        total_processadas: rows.length,
        timestamp: new Date().toISOString(),
      },
      200,
      corsHeaders,
    );
  } catch (error) {
    console.error('ai-decidir-acao error:', error);
    return jsonResponse(
      { error: 'Erro no orquestrador de ações', detail: error.message },
      500,
      corsHeaders,
    );
  }
});
