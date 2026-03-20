// supabase/functions/ai-gerar-orcamento/index.ts
// Gera orçamentos automaticamente via IA quando o agente detecta intenção de compra.
// Fluxo: Extração (IA) → Match de modelos + Cálculo (determinístico) → Persistência + Mensagem

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getServiceClient } from '../ai-shared/ai-helpers.ts';
import { callOpenRouter } from '../ai-shared/openrouter-provider.ts';
import { calcPricing, PricingConfig, PricingInput } from '../ai-shared/pricing-engine.ts';

// ─────────────────────────────────────────────────────────────
// Helpers internos (função service-to-service, sem CORS necessário)
// ─────────────────────────────────────────────────────────────
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// ─────────────────────────────────────────────────────────────
// FASE 1 — System prompt para extração de itens
// ─────────────────────────────────────────────────────────────
const EXTRACTION_PROMPT = `Voce e um assistente de vendas da Croma Print, empresa de comunicacao visual.
Analise a conversa e extraia os itens que o cliente quer orcar.

CATEGORIAS VALIDAS: banner, adesivo, fachada, placa, letreiro, painel, totem, backdrop, pdv, envelopamento, geral

ACABAMENTOS VALIDOS: ilhos, bastao, laminacao, faca especial, dobra, vinco, hot stamping, verniz UV, relevo, metalizado, perfuracao, solda, costura, velcro, dupla-face, estrutura, canaleta

Responda APENAS em JSON valido:
{
  "itens": [
    {
      "descricao_livre": "descricao do que o cliente pediu",
      "categoria_inferida": "uma das categorias validas",
      "largura_cm": 300,
      "altura_cm": 100,
      "quantidade": 2,
      "acabamentos": ["ilhos"],
      "confianca": 0.85
    }
  ],
  "info_faltante": null,
  "mensagem_clarificacao": null,
  "dados_cliente_faltantes": null
}

REGRAS:
- Se o lead nao especificou dimensoes, infira do contexto (ex: "banner para fachada" = provavel 3x1m)
- Se nao da pra inferir dimensao, coloque em info_faltante como array de strings
- confianca 0.0-1.0: 1.0 = certeza total, 0.5 = chute, 0.0 = sem ideia
- Sempre use cm para dimensoes
- Se o lead pediu algo fora de comunicacao visual, retorne itens=[] e mensagem_clarificacao`;

// ─────────────────────────────────────────────────────────────
// FASE 2 — Match de modelos
// ─────────────────────────────────────────────────────────────
interface ItemExtraido {
  descricao_livre: string;
  categoria_inferida: string;
  largura_cm: number;
  altura_cm: number;
  quantidade: number;
  acabamentos: string[];
  confianca: number;
}

interface ModeloMatch {
  modelo_id: string;
  modelo_nome: string;
  confianca: number;
  materiais: Array<{
    material_id: string;
    nome: string;
    preco_medio: number;
    quantidade: number;
    unidade: string;
  }>;
  processos: Array<{ etapa: string; tempo_minutos: number; ordem: number }>;
  markup_sugerido: number;
}

function buildMatchResult(modelo: Record<string, unknown>, confianca: number, markupSugerido?: number): ModeloMatch {
  return {
    modelo_id: modelo.id as string,
    modelo_nome: modelo.nome as string,
    confianca,
    materiais: ((modelo.modelo_materiais as unknown[]) || []).map((mm: Record<string, unknown>) => ({
      material_id: (mm.materiais as Record<string, unknown>)?.id as string || mm.material_id as string,
      nome: (mm.materiais as Record<string, unknown>)?.nome as string || 'Material',
      preco_medio: (mm.materiais as Record<string, unknown>)?.preco_medio as number || 0,
      quantidade: mm.quantidade_por_m2 as number || 1,
      unidade: (mm.materiais as Record<string, unknown>)?.unidade as string || 'm²',
    })),
    processos: ((modelo.modelo_processos as unknown[]) || []).map((mp: Record<string, unknown>) => ({
      etapa: mp.etapa as string,
      tempo_minutos: mp.tempo_minutos as number,
      ordem: mp.ordem as number,
    })),
    markup_sugerido: markupSugerido || (modelo.markup_padrao as number) || 40,
  };
}

async function matchModelo(
  supabase: ReturnType<typeof getServiceClient>,
  item: ItemExtraido,
  regrasMap: Record<string, { markup_sugerido?: number }>,
): Promise<ModeloMatch | null> {
  const MODEL_SELECT = `
    id, nome, markup_padrao,
    modelo_materiais(material_id, quantidade_por_m2, materiais(id, nome, preco_medio, unidade)),
    modelo_processos(etapa, tempo_minutos, ordem)
  `;

  const markupSugerido = regrasMap[item.categoria_inferida]?.markup_sugerido
    || regrasMap['geral']?.markup_sugerido
    || 40;

  // Tenta match direto por categoria
  const { data: modelos } = await supabase
    .from('produto_modelos')
    .select(MODEL_SELECT)
    .ilike('nome', `%${item.categoria_inferida}%`)
    .limit(20);

  if (modelos?.length === 1) {
    return buildMatchResult(modelos[0] as Record<string, unknown>, 0.9, markupSugerido);
  }

  if (modelos && modelos.length > 1) {
    // Usar IA para escolher entre modelos da categoria
    const matchResult = await callOpenRouter(
      `Escolha o modelo mais similar ao pedido do cliente. Responda APENAS JSON: { "modelo_idx": 0, "confianca": 0.85 }
Modelos: ${JSON.stringify(modelos.map((m: Record<string, unknown>, i: number) => `${i}: ${m.nome}`))}`,
      item.descricao_livre,
      { model: 'openai/gpt-4.1-mini', temperature: 0.1, max_tokens: 200 },
    );
    const match = JSON.parse(matchResult.content);
    const modeloEscolhido = modelos[match.modelo_idx as number];
    if (!modeloEscolhido) return null;
    return buildMatchResult(modeloEscolhido as Record<string, unknown>, match.confianca as number, markupSugerido);
  }

  // Fallback: buscar todos e deixar IA escolher
  const { data: todosModelos } = await supabase
    .from('produto_modelos')
    .select('id, nome')
    .limit(50);

  if (!todosModelos?.length) return null;

  const matchResult = await callOpenRouter(
    `Escolha o modelo mais similar ao pedido do cliente. Responda APENAS JSON: { "modelo_idx": 0, "confianca": 0.8 }
Modelos disponíveis: ${JSON.stringify(todosModelos.map((m: Record<string, unknown>, i: number) => `${i}: ${m.nome}`))}`,
    item.descricao_livre,
    { model: 'openai/gpt-4.1-mini', temperature: 0.1, max_tokens: 200 },
  );
  const match = JSON.parse(matchResult.content);
  if ((match.confianca as number) < 0.7 || !todosModelos[match.modelo_idx as number]) return null;

  const modeloId = todosModelos[match.modelo_idx as number].id;
  const { data: modeloCompleto } = await supabase
    .from('produto_modelos')
    .select(MODEL_SELECT)
    .eq('id', modeloId)
    .single();

  if (!modeloCompleto) return null;
  return buildMatchResult(modeloCompleto as Record<string, unknown>, match.confianca as number, markupSugerido);
}

// ─────────────────────────────────────────────────────────────
// Handler principal
// ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200 });

  try {
    const { conversation_id, lead_id, mensagens, canal } = await req.json() as {
      conversation_id: string;
      lead_id: string;
      mensagens: Array<{ direcao: string; conteudo: string }>;
      canal: string;
    };

    if (!conversation_id || !lead_id || !mensagens?.length) {
      return json({ error: 'conversation_id, lead_id e mensagens são obrigatórios' }, 400);
    }

    const supabase = getServiceClient();

    // ── Carregar dados do lead ────────────────────────────────
    const { data: lead } = await supabase
      .from('leads')
      .select('id, empresa, contato_nome, email, telefone, segmento, cliente_id')
      .eq('id', lead_id)
      .single();

    if (!lead) return json({ error: 'Lead não encontrado' }, 404);

    // ── FASE 1: Extração via IA ───────────────────────────────
    const historicoFormatado = mensagens
      .map((m) => `${m.direcao === 'recebida' ? 'LEAD' : 'VENDEDOR'}: ${m.conteudo}`)
      .join('\n');

    const userPrompt = JSON.stringify({
      lead: {
        empresa: lead.empresa,
        segmento: lead.segmento,
        contato: lead.contato_nome,
      },
      historico: historicoFormatado,
    });

    const aiResult = await callOpenRouter(EXTRACTION_PROMPT, userPrompt, {
      model: 'openai/gpt-4.1-mini',
      temperature: 0.2,
      max_tokens: 2000,
    });

    const extracao = JSON.parse(aiResult.content) as {
      itens: ItemExtraido[];
      info_faltante?: string[] | null;
      mensagem_clarificacao?: string | null;
      dados_cliente_faltantes?: string[] | null;
    };

    // Se faltam informações, criar mensagem de clarificação
    if (
      (extracao.info_faltante?.length || extracao.dados_cliente_faltantes?.length)
    ) {
      const mensagemClarificacao = extracao.mensagem_clarificacao ||
        `Para preparar seu orçamento, preciso de mais algumas informações: ${
          [
            ...(extracao.info_faltante || []),
            ...(extracao.dados_cliente_faltantes || []),
          ].join(', ')
        }`;

      await supabase.from('agent_messages').insert({
        conversation_id,
        direcao: 'enviada',
        canal,
        conteudo: mensagemClarificacao,
        status: 'pendente_aprovacao',
        metadata: {
          tipo: 'orcamento_clarificacao',
          info_faltante: extracao.info_faltante,
          dados_cliente_faltantes: extracao.dados_cliente_faltantes,
        },
        custo_ia: aiResult.cost_usd || 0,
        modelo_ia: aiResult.model_used || 'openai/gpt-4.1-mini',
      });

      return json({ status: 'info_faltante', info_faltante: extracao.info_faltante });
    }

    if (!extracao.itens?.length) {
      return json({ status: 'sem_itens', mensagem: 'Nenhum item identificado' });
    }

    // ── FASE 2: Match de modelos + Cálculo de preços ─────────

    // Carregar config de precificação
    const { data: configRow } = await supabase
      .from('admin_config')
      .select('valor')
      .eq('chave', 'config_precificacao')
      .single();

    const pricingConfig: PricingConfig = (configRow?.valor as PricingConfig) || {
      faturamentoMedio: 30000,
      custoOperacional: 24850,
      custoProdutivo: 16400,
      qtdFuncionarios: 3,
      horasMes: 176,
      percentualComissao: 5,
      percentualImpostos: 12,
      percentualJuros: 2,
      percentualEncargos: 0,
    };

    // Carregar máquinas
    const { data: maquinas } = await supabase
      .from('maquinas')
      .select('id, nome, custo_hora')
      .gt('custo_hora', 0)
      .limit(3);

    // Carregar regras de precificação (aproveitamento + markup por categoria)
    const { data: regras } = await supabase
      .from('regras_precificacao')
      .select('categoria, aproveitamento_padrao, markup_sugerido');

    const regrasMap = Object.fromEntries(
      (regras || []).map((r: Record<string, unknown>) => [r.categoria, r]),
    ) as Record<string, { aproveitamento_padrao?: number; markup_sugerido?: number }>;

    // Processar cada item
    const itensCalculados: Array<{
      item: ItemExtraido;
      match: ModeloMatch;
      pricing: ReturnType<typeof calcPricing>;
      areaM2: number;
      aproveitamento: number;
    }> = [];
    const itensSemMatch: Array<{ item: ItemExtraido }> = [];

    for (const item of extracao.itens) {
      if (item.confianca < 0.5) {
        itensSemMatch.push({ item });
        continue;
      }

      const match = await matchModelo(supabase, item, regrasMap);

      if (!match || match.confianca < 0.7) {
        itensSemMatch.push({ item });
        continue;
      }

      const regraCategoria = regrasMap[item.categoria_inferida] || regrasMap['geral'];
      const aproveitamento = regraCategoria?.aproveitamento_padrao || 0.85;
      const areaM2 = (item.largura_cm * item.altura_cm) / 10000;

      const pricingInput: PricingInput = {
        materiais: match.materiais.map((m) => ({
          nome: m.nome,
          precoUnitario: m.preco_medio,
          quantidade: m.quantidade * areaM2 * item.quantidade,
          unidade: m.unidade,
        })),
        processos: match.processos.map((p) => ({
          etapa: p.etapa,
          tempoMinutos: p.tempo_minutos * item.quantidade,
        })),
        maquinas: (maquinas || []).slice(0, 2).map((m: Record<string, unknown>) => ({
          nome: m.nome as string,
          custoHora: m.custo_hora as number,
          tempoMinutos: match.processos.reduce((sum, p) => sum + p.tempo_minutos, 0),
        })),
        markupPercentual: match.markup_sugerido,
        aproveitamento,
      };

      const pricing = calcPricing(pricingInput, pricingConfig);
      itensCalculados.push({ item, match, pricing, areaM2, aproveitamento });
    }

    // Se nenhum item calculável, pedir clarificação
    if (itensCalculados.length === 0) {
      const mensagemClarificacao = `Para preparar seu orçamento precisamente, pode me informar as dimensões e quantidade dos itens desejados?`;
      await supabase.from('agent_messages').insert({
        conversation_id,
        direcao: 'enviada',
        canal,
        conteudo: mensagemClarificacao,
        status: 'pendente_aprovacao',
        metadata: { tipo: 'orcamento_clarificacao', motivo: 'sem_match_modelo' },
        custo_ia: aiResult.cost_usd || 0,
        modelo_ia: aiResult.model_used || 'openai/gpt-4.1-mini',
      });
      return json({ status: 'info_faltante', info_faltante: ['modelo não encontrado'] });
    }

    // ── FASE 3: Persistência + Mensagem ──────────────────────

    // 3a. Garantir que o lead tem cliente_id
    let clienteId = lead.cliente_id as string | null;
    if (!clienteId) {
      const { data: novoCliente, error: clienteErr } = await supabase
        .from('clientes')
        .insert({
          nome_fantasia: lead.empresa || lead.contato_nome,
          contato_nome: lead.contato_nome,
          telefone: lead.telefone,
          email: lead.email,
          segmento: lead.segmento,
          status: 'ativo',
          origem: 'agente_ia',
        })
        .select('id')
        .single();

      if (clienteErr || !novoCliente) {
        console.error('Erro ao criar cliente:', clienteErr);
        return json({ error: 'Erro ao criar cliente para proposta' }, 500);
      }

      clienteId = novoCliente.id as string;
      await supabase.from('leads').update({ cliente_id: clienteId }).eq('id', lead_id);
    }

    // 3b. Gerar número da proposta
    const { data: ultimaProposta } = await supabase
      .from('propostas')
      .select('numero')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const proximoNumero = ultimaProposta?.numero
      ? `ORC-${(parseInt((ultimaProposta.numero as string).replace('ORC-', '')) + 1).toString().padStart(4, '0')}`
      : 'ORC-0001';

    // 3c. Criar proposta
    const totalGeral = itensCalculados.reduce((sum, ic) => sum + ic.pricing.precoVenda, 0);

    const { data: proposta, error: propostaErr } = await supabase
      .from('propostas')
      .insert({
        numero: proximoNumero,
        cliente_id: clienteId,
        titulo: `Orçamento ${lead.empresa || lead.contato_nome} - ${new Date().toLocaleDateString('pt-BR')}`,
        status: 'rascunho',
        validade_dias: 10,
        subtotal: totalGeral,
        total: totalGeral,
        gerado_por_ia: true,
        conversation_id,
        share_token_active: true,
        cliente_nome_snapshot: lead.empresa || lead.contato_nome,
        config_snapshot: pricingConfig,
      })
      .select('id, numero, share_token')
      .single();

    if (propostaErr || !proposta) {
      console.error('Erro ao criar proposta:', propostaErr);
      return json({ error: 'Erro ao criar proposta' }, 500);
    }

    // 3d. Criar itens + materiais + acabamentos
    for (const ic of itensCalculados) {
      const { data: itemCriado } = await supabase
        .from('proposta_itens')
        .insert({
          proposta_id: proposta.id,
          produto_id: null,
          modelo_id: ic.match.modelo_id,
          descricao: `${ic.item.quantidade}x ${ic.match.modelo_nome} ${(ic.item.largura_cm / 100).toFixed(1)}×${(ic.item.altura_cm / 100).toFixed(1)}m`,
          quantidade: ic.item.quantidade,
          unidade: 'un',
          largura_cm: ic.item.largura_cm,
          altura_cm: ic.item.altura_cm,
          area_m2: ic.areaM2 * ic.item.quantidade,
          custo_mp: ic.pricing.custoMP,
          custo_mo: ic.pricing.custoMO,
          custo_fixo: ic.pricing.custoBase - ic.pricing.custoMP - ic.pricing.custoMO,
          markup_percentual: ic.match.markup_sugerido,
          valor_unitario: ic.pricing.precoVenda / ic.item.quantidade,
          valor_total: ic.pricing.precoVenda,
          ordem: itensCalculados.indexOf(ic) + 1,
        })
        .select('id')
        .single();

      if (!itemCriado) continue;

      // Materiais do item
      if (ic.match.materiais.length > 0) {
        await supabase.from('proposta_item_materiais').insert(
          ic.match.materiais.map((m) => ({
            proposta_item_id: itemCriado.id,
            material_id: m.material_id,
            descricao: m.nome,
            quantidade: m.quantidade * ic.areaM2 * ic.item.quantidade,
            unidade: m.unidade,
            custo_unitario: m.preco_medio,
            custo_total: (m.preco_medio * m.quantidade * ic.areaM2 * ic.item.quantidade) / ic.aproveitamento,
          })),
        );
      }

      // Acabamentos do item
      if (ic.item.acabamentos?.length > 0) {
        const { data: acabamentosDb } = await supabase
          .from('acabamentos')
          .select('id, nome, custo_padrao')
          .in('nome', ic.item.acabamentos.map((a: string) => a.toLowerCase()));

        if (acabamentosDb?.length) {
          await supabase.from('proposta_item_acabamentos').insert(
            acabamentosDb.map((a: Record<string, unknown>) => ({
              proposta_item_id: itemCriado.id,
              acabamento_id: a.id,
              descricao: a.nome,
              quantidade: ic.item.quantidade,
              custo_unitario: a.custo_padrao || 0,
              custo_total: ((a.custo_padrao as number) || 0) * ic.item.quantidade,
            })),
          );
        }
      }
    }

    // 3e. Gerar mensagem com link do portal
    const portalUrl = `https://crm-croma.vercel.app/p/${proposta.share_token}`;
    const resumoItens = itensCalculados
      .map((ic) => `• ${ic.item.quantidade}x ${ic.match.modelo_nome} ${(ic.item.largura_cm / 100).toFixed(1)}×${(ic.item.altura_cm / 100).toFixed(1)}m`)
      .join('\n');

    const primeiroNome = (lead.contato_nome as string)?.split(' ')[0] || '';
    const saudacao = primeiroNome ? `, ${primeiroNome}` : '';

    const mensagemParaLead = canal === 'whatsapp'
      ? `Olá${saudacao}! 😊\n\nPreparei o orçamento conforme conversamos:\n\n${resumoItens}\n\n*Total: R$ ${totalGeral.toFixed(2).replace('.', ',')}*\n\nAcesse todos os detalhes e condições de pagamento aqui:\n${portalUrl}\n\nQualquer dúvida, estou à disposição!`
      : `Olá${saudacao}!\n\nPreparei o orçamento conforme conversamos:\n\n${resumoItens}\n\nTotal: R$ ${totalGeral.toFixed(2).replace('.', ',')}\n\nAcesse todos os detalhes e condições de pagamento no link abaixo:\n${portalUrl}\n\nQualquer dúvida, estou à disposição!\n\nAtt,\nEquipe Croma Print`;

    // 3f. Salvar mensagem para aprovação
    await supabase.from('agent_messages').insert({
      conversation_id,
      direcao: 'enviada',
      canal,
      conteudo: mensagemParaLead,
      assunto: canal === 'email' ? `Orçamento ${proposta.numero} - Croma Print` : null,
      status: 'pendente_aprovacao',
      metadata: {
        tipo: 'orcamento',
        proposta_id: proposta.id,
        proposta_numero: proposta.numero,
        share_token: proposta.share_token,
        portal_url: portalUrl,
        total: totalGeral,
        itens_count: itensCalculados.length,
      },
      custo_ia: aiResult.cost_usd || 0,
      modelo_ia: aiResult.model_used || 'openai/gpt-4.1-mini',
    });

    // 3g. Atualizar conversa para etapa "proposta"
    await supabase
      .from('agent_conversations')
      .update({ etapa: 'proposta', updated_at: new Date().toISOString() })
      .eq('id', conversation_id);

    // 3h. Log de atividade
    await supabase.from('atividades_comerciais').insert({
      lead_id,
      tipo: 'orcamento_gerado',
      descricao: `Orçamento ${proposta.numero} gerado por IA — ${itensCalculados.length} item(ns), total R$ ${totalGeral.toFixed(2)}`,
      metadata: { proposta_id: proposta.id, gerado_por_ia: true },
    });

    return json({
      status: 'proposta_criada',
      proposta_id: proposta.id,
      proposta_numero: proposta.numero,
      portal_url: portalUrl,
      total: totalGeral,
      itens_count: itensCalculados.length,
    });

  } catch (err) {
    console.error('ai-gerar-orcamento error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
