// supabase/functions/ai-detectar-intencao-orcamento/index.ts
// Detecta intenção de compra/orçamento em conversas do agente.
// Chamado pelo agent-cron-loop quando uma conversa recebe resposta.
// Se detectar intenção, chama ai-gerar-orcamento automaticamente.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCorsOptions, getCorsHeaders, jsonResponse, getServiceClient } from '../ai-shared/ai-helpers.ts';
import { callOpenRouter } from '../ai-shared/openrouter-provider.ts';

// ─── Prompt de detecção ──────────────────────────────────────────────────────

const INTENT_PROMPT = `Voce e um classificador de intencoes para a Croma Print, empresa de comunicacao visual.
Analise a conversa e classifique a intencao do lead.

Responda APENAS em JSON valido:
{
  "intencao": "orcamento" | "informacao" | "reclamacao" | "suporte" | "outros",
  "confianca": 0.85,
  "itens_detectados": ["banner 3x1m", "adesivo vitrine"],
  "sinais": ["pediu preco", "mencionou dimensoes", "perguntou prazo"],
  "urgencia": "alta" | "media" | "baixa",
  "recomendacao": "gerar_orcamento" | "pedir_mais_info" | "responder_duvida" | "encaminhar_humano"
}

SINAIS DE INTENCAO DE ORCAMENTO:
- Pede preço, valor, quanto custa, orçamento
- Menciona dimensões (metros, centímetros, tamanho)
- Menciona quantidade (unidades, peças)
- Descreve material ou produto (banner, placa, fachada, adesivo, letreiro, totem)
- Pergunta prazo de entrega
- Menciona urgência ou data específica
- Envia foto/referência de projeto

SINAIS QUE NAO SAO ORCAMENTO:
- Pede informações genéricas sobre a empresa
- Reclamação sobre pedido existente
- Suporte técnico / pós-venda
- Conversa social sem intenção comercial

REGRAS:
- confianca 0.0-1.0 (1.0 = certeza absoluta)
- Se confianca >= 0.7 e intencao = "orcamento" → recomendacao = "gerar_orcamento"
- Se confianca >= 0.5 e intencao = "orcamento" → recomendacao = "pedir_mais_info"
- Sempre liste os itens detectados, mesmo com confiança baixa
- Urgência alta: prazo < 7 dias ou palavra "urgente"/"emergência"`;

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface IntentResult {
  intencao: 'orcamento' | 'informacao' | 'reclamacao' | 'suporte' | 'outros';
  confianca: number;
  itens_detectados: string[];
  sinais: string[];
  urgencia: 'alta' | 'media' | 'baixa';
  recomendacao: 'gerar_orcamento' | 'pedir_mais_info' | 'responder_duvida' | 'encaminhar_humano';
}

// ─── Handler ─────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const corsResponse = handleCorsOptions(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { conversation_id, auto_gerar } = await req.json() as {
      conversation_id: string;
      auto_gerar?: boolean; // se true, chama ai-gerar-orcamento automaticamente
    };

    if (!conversation_id) {
      return jsonResponse({ error: 'conversation_id é obrigatório' }, 400, corsHeaders);
    }

    const supabase = getServiceClient();

    // ── Buscar conversa + lead + mensagens ────────────────────────────────
    const { data: conv } = await supabase
      .from('agent_conversations')
      .select('id, lead_id, canal, etapa, status')
      .eq('id', conversation_id)
      .single();

    if (!conv) {
      return jsonResponse({ error: 'Conversa não encontrada' }, 404, corsHeaders);
    }

    // Buscar últimas mensagens da conversa
    const { data: mensagens } = await supabase
      .from('agent_messages')
      .select('direcao, conteudo, created_at')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })
      .limit(30);

    if (!mensagens?.length) {
      return jsonResponse({
        intencao: 'outros',
        confianca: 0,
        recomendacao: 'responder_duvida',
        motivo: 'Sem mensagens na conversa',
      }, 200, corsHeaders);
    }

    // ── Chamar IA para classificar ────────────────────────────────────────
    const historicoFormatado = mensagens
      .map((m: Record<string, unknown>) =>
        `${m.direcao === 'recebida' ? 'LEAD' : 'VENDEDOR'}: ${m.conteudo}`
      )
      .join('\n');

    const aiResult = await callOpenRouter(INTENT_PROMPT, historicoFormatado, {
      model: 'openai/gpt-4.1-mini',
      temperature: 0.1,
      max_tokens: 500,
    });

    const intent: IntentResult = JSON.parse(aiResult.content);

    // ── Log da detecção ──────────────────────────────────────────────────
    await supabase.from('ai_logs').insert({
      funcao: 'ai-detectar-intencao-orcamento',
      duracao_ms: 0,
      tokens_usados: aiResult.tokens_used || 0,
      custo: aiResult.cost_usd || 0,
      metadata: {
        conversation_id,
        lead_id: conv.lead_id,
        intencao: intent.intencao,
        confianca: intent.confianca,
        recomendacao: intent.recomendacao,
        itens_detectados: intent.itens_detectados,
      },
    });

    // ── Auto-gerar orçamento se detectou intenção com confiança alta ─────
    if (
      auto_gerar &&
      intent.intencao === 'orcamento' &&
      intent.confianca >= 0.7 &&
      intent.recomendacao === 'gerar_orcamento'
    ) {
      // Chamar ai-gerar-orcamento diretamente
      const { data: gerarResult, error: gerarError } = await supabase.functions.invoke(
        'ai-gerar-orcamento',
        {
          body: {
            conversation_id,
            lead_id: conv.lead_id,
            mensagens: mensagens.map((m: Record<string, unknown>) => ({
              direcao: m.direcao,
              conteudo: m.conteudo,
            })),
            canal: conv.canal,
          },
        }
      );

      if (gerarError) {
        console.error('Erro ao gerar orçamento automático:', gerarError);
        return jsonResponse({
          ...intent,
          orcamento_auto: false,
          erro_orcamento: gerarError.message,
        }, 200, corsHeaders);
      }

      // Atualizar conversa para etapa "proposta" se orçamento criado
      if (gerarResult?.status === 'proposta_criada') {
        // Log de atividade
        await supabase.from('atividades_comerciais').insert({
          lead_id: conv.lead_id,
          tipo: 'intencao_detectada',
          descricao: `Intenção de orçamento detectada automaticamente (confiança ${(intent.confianca * 100).toFixed(0)}%). Orçamento ${gerarResult.proposta_numero} gerado.`,
          metadata: {
            intent,
            proposta_id: gerarResult.proposta_id,
            auto_gerado: true,
          },
        });
      }

      return jsonResponse({
        ...intent,
        orcamento_auto: true,
        orcamento_resultado: gerarResult,
      }, 200, corsHeaders);
    }

    // ── Retornar resultado sem gerar ─────────────────────────────────────
    return jsonResponse(intent, 200, corsHeaders);

  } catch (err) {
    console.error('ai-detectar-intencao-orcamento error:', err);
    return jsonResponse({ error: (err as Error).message }, 500, corsHeaders);
  }
});
