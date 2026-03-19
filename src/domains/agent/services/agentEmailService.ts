import { supabase } from '@/integrations/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SequenceStatus =
  | 'mensagem_pendente'
  | 'descartado'
  | 'erro_qualificacao'
  | 'erro_composicao';

export interface SequenceResult {
  lead_id: string;
  status: SequenceStatus;
  score?: number;
  conversation_id?: string;
  error?: string;
}

export interface SendApprovedResult {
  enviadas: number;
  erros: number;
  total: number;
}

// ─── Service Functions ────────────────────────────────────────────────────────
// Note: supabase.functions.invoke automatically attaches the current session's
// Authorization header and handles token auto-refresh. No manual headers needed.

/**
 * Orquestra qualificação + composição de email para uma lista de leads.
 * Processa sequencialmente para respeitar rate limits das Edge Functions.
 */
export async function iniciarSequenciaEmail(leadIds: string[]): Promise<SequenceResult[]> {
  const results: SequenceResult[] = [];

  for (const lead_id of leadIds) {
    // Step 1: Qualify lead
    const qualRes = await supabase.functions.invoke('ai-qualificar-lead', {
      body: { lead_id },
    });

    if (qualRes.error) {
      results.push({
        lead_id,
        status: 'erro_qualificacao',
        error: qualRes.error.message,
      });
      continue;
    }

    const qualification = qualRes.data;

    // Step 2: Discard if recommended
    if (qualification?.proxima_acao === 'descartar') {
      results.push({
        lead_id,
        status: 'descartado',
        score: qualification.score,
      });
      continue;
    }

    // Step 3: Compose opening email
    const composeRes = await supabase.functions.invoke('ai-compor-mensagem', {
      body: { lead_id, canal: 'email', etapa: 'abertura' },
    });

    if (composeRes.error) {
      results.push({
        lead_id,
        status: 'erro_composicao',
        score: qualification?.score,
        error: composeRes.error.message,
      });
      continue;
    }

    results.push({
      lead_id,
      status: 'mensagem_pendente',
      score: qualification?.score,
      conversation_id: composeRes.data?.conversation_id,
    });
  }

  return results;
}

/**
 * Envia todas as mensagens com status 'aprovada' e canal 'email' (até 20 por vez).
 * Retorna contagem de enviadas, erros e total processado.
 */
export async function enviarMensagensAprovadas(): Promise<SendApprovedResult> {
  const { data: messages, error: fetchError } = await supabase
    .from('agent_messages')
    .select('id, conversation_id')
    .eq('status', 'aprovada')
    .eq('canal', 'email')
    .limit(20);

  if (fetchError || !messages) {
    return { enviadas: 0, erros: 0, total: 0 };
  }

  let enviadas = 0;
  let erros = 0;

  for (const message of messages) {
    const res = await supabase.functions.invoke('agent-enviar-email', {
      body: { message_id: message.id, conversation_id: message.conversation_id },
    });

    if (res.error) {
      erros++;
    } else {
      enviadas++;
    }
  }

  return { enviadas, erros, total: messages.length };
}
