// supabase/functions/ai-compor-mensagem/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCorsOptions, getCorsHeaders, jsonResponse, getServiceClient } from '../ai-shared/ai-helpers.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callOpenRouter } from '../ai-shared/openrouter-provider.ts';
import { logAICall } from '../ai-shared/ai-logger.ts';

// ─────────────────────────────────────────────────────────────
// System prompt — vendedor consultivo Croma Print
// ─────────────────────────────────────────────────────────────
function buildSystemPrompt(canal: 'email' | 'whatsapp'): string {
  const maxParagrafos = canal === 'whatsapp' ? 3 : 5;

  return `Voce e um vendedor consultivo da Croma Print Comunicacao Visual (www.cromaprint.com.br).
Producao propria de banners, faixas, adesivos, placas, totens, fachadas, paineis e materiais de comunicacao visual.
Atendimento nacional. Clientes: redes de lojas, franquias, fabricantes de calcados, grandes varejistas.

PERSONALIDADE: Profissional mas caloroso. Confiante e estrategico. Nunca pressiona, educa e gera valor.

REGRAS ABSOLUTAS:
- Responda SEMPRE em portugues brasileiro coloquial mas profissional
- Responda SEMPRE em JSON valido
- Maximo ${maxParagrafos} paragrafos no campo "conteudo"
- Sempre faca 1 pergunta inteligente ao final (mas apenas 1)
- NUNCA forneca preco sem antes diagnosticar a necessidade do cliente
- Se o cliente tem multiplas lojas → sugira padronizacao de rede
- Se o cliente e industria → foque em PDV e lancamentos de produto

GATILHOS DE UPSELL:
- 1 banner → proponha kit campanha completo (banner + faixa + adesivo vitrine)
- Fachada → sugira fachada + totem de sinalizacao + adesivos
- 1 loja → pergunte sobre outras lojas da rede
- Pedido pontual → apresente possibilidade de contrato mensal/recorrente

DADOS DE PAGAMENTO (CORRETOS — usar estes):
- PIX: CNPJ 18.923.994/0001-83 (Croma Print Comunicacao Visual)
- Email oficial: junior@cromaprint.com.br
- Tambem aceitamos transferencia bancaria e boleto
- NUNCA informe outros dados de PIX ou email que nao sejam estes

TRATAMENTO DE OBJECOES:
- "Muito caro" → apresente ROI: custo por loja/mes, durabilidade, impacto no faturamento
- "Vou pensar" → gere urgencia real: agenda de producao, prazo de entrega, campanha com data fixa
- "Ja tenho fornecedor" → pergunte sobre satisfacao, oferea piloto sem compromisso
- "Nao preciso agora" → pergunte sobre proxima campanha ou data comemorativa

ESTRUTURA DO JSON DE RESPOSTA (obrigatorio):
{
  "assunto": "assunto do email — OMITIR se canal for whatsapp",
  "conteudo": "corpo da mensagem — texto puro, sem markdown, paragrafos separados por \\n\\n",
  "tom_detectado": "frio|morno|quente|neutro",
  "upsell_sugerido": "descricao do upsell mais relevante para este lead, ou null",
  "pergunta_feita": "a pergunta exata feita ao cliente",
  "intent_detectada": "conversa|orcamento|suporte|reclamacao|negociacao"
}

REGRAS PARA intent_detectada:
- "orcamento": lead pediu preco, orcamento, cotacao, "quanto custa", "preciso de X", mencionou produto + quantidade/dimensao
- "negociacao": lead quer desconto, prazo, condicao especial sobre proposta JA enviada
- "suporte": lead tem problema com pedido existente, instalacao, qualidade
- "reclamacao": lead esta insatisfeito, reclamando
- "conversa": qualquer outra interacao (saudacao, duvida geral, informacao)`;
}

// ─────────────────────────────────────────────────────────────
// User prompt — contexto completo do lead
// ─────────────────────────────────────────────────────────────
function buildUserPrompt(context: Record<string, unknown>): string {
  return JSON.stringify(context, null, 2);
}

// ─────────────────────────────────────────────────────────────
// Substituir variaveis de template
// ─────────────────────────────────────────────────────────────
function replaceTemplateVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// ─────────────────────────────────────────────────────────────
// Handler principal
// ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  const corsResponse = handleCorsOptions(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // Auth: validate JWT and check role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Token não fornecido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );
    const { data: { user }, error: userAuthError } = await supabaseAuth.auth.getUser(token);
    if (userAuthError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    {
      const supabaseService = getServiceClient();
      const { data: profile } = await supabaseService.from('profiles').select('role').eq('id', user.id).single();
      const allowedRoles = ['comercial', 'gerente', 'admin'];
      if (!profile || !allowedRoles.includes(profile.role)) {
        return new Response(JSON.stringify({ error: 'Sem permissão' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const body = await req.json();
    const { lead_id, canal, etapa, contexto_extra } = body as {
      lead_id: string;
      canal: 'email' | 'whatsapp';
      etapa?: string;
      contexto_extra?: string;
    };

    if (!lead_id) return jsonResponse({ error: 'lead_id obrigatorio' }, 400, corsHeaders);
    if (!canal || !['email', 'whatsapp'].includes(canal)) {
      return jsonResponse({ error: 'canal deve ser "email" ou "whatsapp"' }, 400, corsHeaders);
    }

    const supabase = getServiceClient();

    // ── 1. Lead data ──────────────────────────────────────────
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('id, empresa, contato_nome, contato_email, segmento, status, temperatura, valor_estimado, cargo, observacoes, score')
      .eq('id', lead_id)
      .single();

    if (leadErr || !lead) {
      return jsonResponse({ error: 'Lead nao encontrado' }, 404, corsHeaders);
    }

    // ── 2. Conversa ativa para este lead + canal ──────────────
    const { data: conversations } = await supabase
      .from('agent_conversations')
      .select('id, etapa, mensagens_enviadas, mensagens_recebidas, score_engajamento, tentativas, ultima_mensagem_em')
      .eq('lead_id', lead_id)
      .eq('canal', canal)
      .eq('status', 'ativa')
      .order('created_at', { ascending: false })
      .limit(1);

    const activeConversation = conversations?.[0] ?? null;

    // ── 3. Últimas 10 mensagens da conversa ───────────────────
    let recentMessages: unknown[] = [];
    if (activeConversation) {
      const { data: msgs } = await supabase
        .from('agent_messages')
        .select('direcao, conteudo, assunto, status, created_at')
        .eq('conversation_id', activeConversation.id)
        .order('created_at', { ascending: false })
        .limit(10);

      recentMessages = (msgs ?? []).reverse(); // cronologico
    }

    // ── 4. Template (canal + etapa + segmento, fallback NULL segmento) ──
    const etapaAtual = etapa ?? activeConversation?.etapa ?? 'abertura';

    let template: { assunto: string | null; conteudo: string } | null = null;

    // Tenta com segmento primeiro
    if (lead.segmento) {
      const { data: tplSeg } = await supabase
        .from('agent_templates')
        .select('id, nome, assunto, conteudo')
        .eq('canal', canal)
        .eq('etapa', etapaAtual)
        .eq('segmento', lead.segmento)
        .eq('ativo', true)
        .limit(1)
        .single();

      template = tplSeg ?? null;
    }

    // Fallback: segmento NULL
    if (!template) {
      const { data: tplNull } = await supabase
        .from('agent_templates')
        .select('id, nome, assunto, conteudo')
        .eq('canal', canal)
        .eq('etapa', etapaAtual)
        .is('segmento', null)
        .eq('ativo', true)
        .limit(1)
        .single();

      template = tplNull ?? null;
    }

    // ── 5. agent_config de admin_config ──────────────────────
    const { data: configRow } = await supabase
      .from('admin_config')
      .select('valor')
      .eq('chave', 'agent_config')
      .single();

    const agentConfig: Record<string, unknown> = (configRow?.valor as Record<string, unknown>) ?? {};
    const modeloComposicao = (agentConfig.modelo_composicao as string) ?? 'anthropic/claude-sonnet-4';
    const nomeRemetente = (agentConfig.nome_remetente as string) ?? 'Croma Print';
    const emailRemetente = (agentConfig.email_remetente as string) ?? 'junior@cromaprint.com.br';

    // ── 6. Regras de precificação ─────────────────────────────
    const { data: regras } = await supabase
      .from('regras_precificacao')
      .select('categoria, markup_minimo, markup_sugerido');

    // ── 7. Montar contexto para a IA ──────────────────────────
    const aiContext = {
      lead: {
        empresa: lead.empresa,
        contato_nome: lead.contato_nome,
        contato_email: lead.contato_email,
        segmento: lead.segmento,
        status: lead.status,
        temperatura: lead.temperatura,
        valor_estimado: lead.valor_estimado,
        cargo: lead.cargo,
        observacoes: lead.observacoes,
        score: lead.score,
      },
      canal,
      etapa: etapaAtual,
      conversa: activeConversation
        ? {
            mensagens_enviadas: activeConversation.mensagens_enviadas,
            mensagens_recebidas: activeConversation.mensagens_recebidas,
            score_engajamento: activeConversation.score_engajamento,
            tentativas: activeConversation.tentativas,
            ultima_mensagem_em: activeConversation.ultima_mensagem_em,
          }
        : null,
      historico_mensagens: recentMessages,
      template_base: template
        ? { assunto: template.assunto, conteudo: template.conteudo }
        : null,
      agente: {
        nome_remetente: nomeRemetente,
        email_remetente: emailRemetente,
        site: 'www.cromaprint.com.br',
      },
      regras_precificacao: regras ?? [],
      contexto_extra: contexto_extra ?? null,
      data_atual: new Date().toISOString().split('T')[0],
    };

    // ── 8. Chamada OpenRouter ─────────────────────────────────
    const systemPrompt = buildSystemPrompt(canal);
    const userPrompt = buildUserPrompt(aiContext);
    const aiResult = await callOpenRouter(systemPrompt, userPrompt, {
      model: modeloComposicao,
      temperature: 0.7, // mais criativo para mensagens
      max_tokens: 1500,
    });

    // ── 9. Parse resposta ─────────────────────────────────────
    const aiData: {
      assunto?: string;
      conteudo: string;
      tom_detectado: string;
      upsell_sugerido: string | null;
      pergunta_feita: string;
      intent_detectada?: string;
    } = JSON.parse(aiResult.content);

    const intentDetectada = aiData.intent_detectada || 'conversa';

    // ── 10. Substituir variáveis de template ──────────────────
    const templateVars: Record<string, string> = {
      empresa: lead.empresa ?? '',
      contato_nome: lead.contato_nome ?? '',
      nome_remetente: nomeRemetente,
      telefone_empresa: '', // pode ser expandido via admin_config futuramente
    };

    const conteudoFinal = replaceTemplateVars(aiData.conteudo, templateVars);
    const assuntoFinal = aiData.assunto
      ? replaceTemplateVars(aiData.assunto, templateVars)
      : null;

    // ── 11. Criar ou reusar conversa ──────────────────────────
    let conversationId: string;

    if (activeConversation) {
      conversationId = activeConversation.id;
    } else {
      const { data: newConv, error: convErr } = await supabase
        .from('agent_conversations')
        .insert({
          lead_id,
          canal,
          status: 'ativa',
          etapa: etapaAtual,
        })
        .select('id')
        .single();

      if (convErr || !newConv) {
        throw new Error(`Falha ao criar conversa: ${convErr?.message}`);
      }
      conversationId = newConv.id;
    }

    // ── 12. Salvar mensagem como pendente_aprovacao ───────────
    const { data: savedMsg, error: msgErr } = await supabase
      .from('agent_messages')
      .insert({
        conversation_id: conversationId,
        direcao: 'enviada',
        canal,
        conteudo: conteudoFinal,
        assunto: assuntoFinal,
        status: 'pendente_aprovacao',
        custo_ia: aiResult.cost_usd,
        modelo_ia: aiResult.model_used,
        metadata: {
          tom_detectado: aiData.tom_detectado,
          upsell_sugerido: aiData.upsell_sugerido,
          pergunta_feita: aiData.pergunta_feita,
          intent_detectada: intentDetectada,
          tokens_input: aiResult.tokens_input,
          tokens_output: aiResult.tokens_output,
          duration_ms: aiResult.duration_ms,
          etapa: etapaAtual,
        },
      })
      .select('id')
      .single();

    if (msgErr || !savedMsg) {
      throw new Error(`Falha ao salvar mensagem: ${msgErr?.message}`);
    }

    // ── 13. Se intent === 'orcamento', acionar geração de proposta ──
    if (intentDetectada === 'orcamento' && activeConversation) {
      try {
        const orcamentoUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-gerar-orcamento`;
        const orcamentoResp = await fetch(orcamentoUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            lead_id,
            mensagens: recentMessages,
            canal,
          }),
        });
        const orcamentoResult = await orcamentoResp.json();

        if (orcamentoResult.status === 'proposta_criada') {
          // ai-gerar-orcamento já criou mensagem pendente_aprovacao com o link
          // Deletar a mensagem genérica que acabamos de salvar
          await supabase.from('agent_messages').delete().eq('id', savedMsg.id);

          await logAICall({
            user_id: user.id,
            function_name: 'compor-mensagem' as any,
            entity_type: 'geral',
            entity_id: lead_id,
            model_used: aiResult.model_used,
            tokens_input: aiResult.tokens_input,
            tokens_output: aiResult.tokens_output,
            cost_usd: aiResult.cost_usd,
            duration_ms: aiResult.duration_ms,
            status: 'success',
          });

          return jsonResponse(
            {
              conversation_id: conversationId,
              message_id: null,
              intent: 'orcamento',
              proposta_id: orcamentoResult.proposta_id,
              proposta_numero: orcamentoResult.proposta_numero,
              portal_url: orcamentoResult.portal_url,
            },
            200,
            corsHeaders
          );
        }

        if (orcamentoResult.status === 'info_faltante') {
          // ai-gerar-orcamento criou mensagem de clarificação — deletar a genérica
          await supabase.from('agent_messages').delete().eq('id', savedMsg.id);

          await logAICall({
            user_id: user.id,
            function_name: 'compor-mensagem' as any,
            entity_type: 'geral',
            entity_id: lead_id,
            model_used: aiResult.model_used,
            tokens_input: aiResult.tokens_input,
            tokens_output: aiResult.tokens_output,
            cost_usd: aiResult.cost_usd,
            duration_ms: aiResult.duration_ms,
            status: 'success',
          });

          return jsonResponse(
            { conversation_id: conversationId, intent: 'orcamento_incompleto' },
            200,
            corsHeaders
          );
        }
        // Qualquer outro status: continua com a mensagem genérica
      } catch (err) {
        console.error('Erro ao acionar ai-gerar-orcamento:', err);
        // Fallback: continua com mensagem normal composta pela IA
      }
    }

    // ── 15. Log ───────────────────────────────────────────────
    await logAICall({
      user_id: user.id,
      function_name: 'compor-mensagem' as any,
      entity_type: 'geral',
      entity_id: lead_id,
      model_used: aiResult.model_used,
      tokens_input: aiResult.tokens_input,
      tokens_output: aiResult.tokens_output,
      cost_usd: aiResult.cost_usd,
      duration_ms: aiResult.duration_ms,
      status: 'success',
    });

    // ── 16. Resposta ──────────────────────────────────────────
    return jsonResponse(
      {
        conversation_id: conversationId,
        message_id: savedMsg.id,
        mensagem: {
          assunto: assuntoFinal,
          conteudo: conteudoFinal,
          canal,
          status: 'pendente_aprovacao',
        },
        ia: {
          tom_detectado: aiData.tom_detectado,
          upsell_sugerido: aiData.upsell_sugerido,
          pergunta_feita: aiData.pergunta_feita,
          intent_detectada: intentDetectada,
          model_used: aiResult.model_used,
          tokens_used: aiResult.tokens_input + aiResult.tokens_output,
          cost_usd: aiResult.cost_usd,
          duration_ms: aiResult.duration_ms,
        },
      },
      200,
      corsHeaders
    );
  } catch (error) {
    console.error('ai-compor-mensagem error:', error);
    return jsonResponse(
      { error: 'Erro ao compor mensagem', detail: error.message },
      500,
      corsHeaders
    );
  }
});
