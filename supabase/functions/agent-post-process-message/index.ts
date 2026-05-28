// agent-post-process-message v1 (2026-05-22 — Etapa 2.3 ponte Cowork)
// Invocado pela SKILL Cowork (croma-whatsapp-responder) após gerar resposta estruturada via Claude Max.
// Encapsula 4 ações que o webhook v39 fazia inline:
//   1. gravarDadosExtraidos (UPDATE leads + INSERT atividades_comerciais)
//   2. atualizarMemoriaLead (UPSERT lead_memoria)
//   3. gerarOrcamentoReal (POST ai-gerar-orcamento se intent ∈ orcamento|formalizar)
//   4. incrementar_contador_conversa (RPC)
// Mantém paridade funcional do webhook antigo sem precisar inflar o prompt da SKILL.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const NOMES_BLOCKLIST =
  /^(assistente|atendente|atendimento|comercial|financeiro|suporte|bot|ura|robo|virtual|automatico|sac|callcenter|cobranca|recepcao|vendas|administracao|secretaria|gerencia)\b/i;

function isValidEmail(e: string): boolean {
  return /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test((e ?? '').trim());
}
function digitsOnly(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '');
}
function isValidCNPJ(c: string | null | undefined): boolean {
  const d = digitsOnly(c);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;
  return true;
}

async function lerLead(supabase: any, leadId: string): Promise<any> {
  const { data } = await supabase
    .from('leads')
    .select('id, contato_nome, contato_email, empresa, cnpj, cidade, uf, cargo, segmento, telefone2, observacoes')
    .eq('id', leadId).single();
  return data ?? null;
}

async function lerMemoriaLead(supabase: any, leadId: string): Promise<any> {
  try {
    const { data } = await supabase
      .from('lead_memoria')
      .select('resumo, dados_confirmados, produto_interesse, necessidade, urgencia, proximos_passos, mensagens_processadas')
      .eq('lead_id', leadId).maybeSingle();
    return data;
  } catch { return null; }
}

async function gravarDadosExtraidos(supabase: any, leadId: string, currentLead: any, dados: any, confianca: any) {
  const updates: any = {};
  const bloqueados: string[] = [];
  const obsExtras: string[] = [];
  const conf = (k: string) => confianca?.[k] ?? 'baixa';

  if (dados?.nome) {
    const nome = String(dados.nome).trim();
    if (NOMES_BLOCKLIST.test(nome)) bloqueados.push(`nome:"${nome}" (parece cargo/bot)`);
    else if (conf('nome') !== 'baixa') {
      const palavras = nome.split(/\s+/).filter(Boolean);
      const nomeAtual = currentLead?.contato_nome ?? '';
      if (palavras.length === 1) {
        if (!nomeAtual || nomeAtual.startsWith('WhatsApp ')) updates.contato_nome = nome;
      } else if (palavras.length >= 2) {
        const ap = nomeAtual.split(/\s+/).filter(Boolean).length;
        if (ap < 2 || conf('nome') === 'alta') updates.contato_nome = nome;
      }
    }
  }
  if (dados?.email && isValidEmail(dados.email)) {
    if (!currentLead?.contato_email || conf('email') === 'alta') updates.contato_email = String(dados.email).toLowerCase().trim();
  }
  if (dados?.cnpj && isValidCNPJ(dados.cnpj)) {
    if (!currentLead?.cnpj || conf('cnpj') === 'alta') updates.cnpj = digitsOnly(dados.cnpj);
  }
  if (dados?.empresa) {
    const empresa = String(dados.empresa).trim();
    const ea = currentLead?.empresa ?? '';
    if (!NOMES_BLOCKLIST.test(empresa) && (!ea || ea.startsWith('WhatsApp ') || (conf('empresa') === 'alta' && empresa.toLowerCase() !== ea.toLowerCase()))) {
      updates.empresa = empresa.substring(0, 200);
    }
  }
  if (dados?.cidade && (!currentLead?.cidade || conf('cidade') === 'alta')) updates.cidade = String(dados.cidade).trim().substring(0, 100);
  if (dados?.uf && /^[A-Za-z]{2}$/.test(String(dados.uf).trim()) && (!currentLead?.uf || conf('uf') === 'alta')) updates.uf = String(dados.uf).trim().toUpperCase();
  if (dados?.cargo && !currentLead?.cargo) updates.cargo = String(dados.cargo).trim().substring(0, 100);
  if (dados?.segmento && !currentLead?.segmento) updates.segmento = String(dados.segmento).trim().substring(0, 100);
  if (dados?.telefone) {
    const tD = digitsOnly(dados.telefone);
    if (tD.length >= 10 && !currentLead?.telefone2) updates.telefone2 = tD;
  }
  if (dados?.necessidade) obsExtras.push(`Necessidade: ${dados.necessidade}`);
  if (dados?.urgencia) obsExtras.push(`Urgência: ${dados.urgencia}`);
  if (dados?.produto_interesse) obsExtras.push(`Interesse: ${dados.produto_interesse}`);
  if (dados?.endereco) obsExtras.push(`Endereço: ${dados.endereco}`);
  if (obsExtras.length > 0) {
    const obsAtual = currentLead?.observacoes ?? '';
    const novas = obsExtras.filter((o) => !obsAtual.includes(o.split(':')[0] + ':'));
    if (novas.length > 0) updates.observacoes = (obsAtual ? `${obsAtual} | ${novas.join(' | ')}` : novas.join(' | ')).substring(0, 2000);
  }

  if (Object.keys(updates).length === 0) {
    return { ok: true, gravados: [], bloqueados, observacao_extra: obsExtras };
  }
  updates.updated_at = new Date().toISOString();
  const { error } = await supabase.from('leads').update(updates).eq('id', leadId).select().single();
  if (error) return { ok: false, gravados: [], bloqueados, observacao_extra: obsExtras };

  const camposGravados = Object.keys(updates).filter((k) => k !== 'updated_at');
  await supabase.from('atividades_comerciais').insert({
    entidade_tipo: 'lead', entidade_id: leadId,
    tipo: 'sistema',
    descricao: `[IA-Extração] Atualizou: ${camposGravados.join(', ')}` + (bloqueados.length > 0 ? ` | Bloqueado: ${bloqueados.join('; ')}` : ''),
    resultado: 'sucesso',
    data_atividade: new Date().toISOString(),
  });
  return { ok: true, gravados: camposGravados, bloqueados, observacao_extra: obsExtras };
}

async function atualizarMemoriaLead(supabase: any, leadId: string, patch: any) {
  try {
    const atual = await lerMemoriaLead(supabase, leadId);
    const novoResumo = (patch.resumo ?? atual?.resumo ?? '') as string;
    const novosDados = { ...(atual?.dados_confirmados ?? {}), ...(patch.dados_confirmados ?? {}) };
    const upsert = {
      lead_id: leadId,
      resumo: String(novoResumo).substring(0, 2000),
      dados_confirmados: novosDados,
      produto_interesse: patch.produto_interesse ?? atual?.produto_interesse ?? null,
      necessidade: patch.necessidade ?? atual?.necessidade ?? null,
      urgencia: patch.urgencia ?? atual?.urgencia ?? null,
      proximos_passos: patch.proximos_passos ?? atual?.proximos_passos ?? null,
      mensagens_processadas: (atual?.mensagens_processadas ?? 0) + (patch.incrementar_processadas ? 1 : 0),
      atualizado_em: new Date().toISOString(),
    };
    await supabase.from('lead_memoria').upsert(upsert, { onConflict: 'lead_id' }).select().single();
    return { ok: true };
  } catch (err) {
    console.error('atualizarMemoriaLead:', err);
    return { ok: false, error: String((err as Error).message ?? err) };
  }
}

async function gerarOrcamentoReal(supabase: any, conversationId: string, leadId: string, canal: string) {
  try {
    const { data: msgs } = await supabase.from('agent_messages')
      .select('direcao, conteudo')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(20);
    const mensagens = (msgs ?? []).map((m: any) => ({ direcao: m.direcao, conteudo: m.conteudo }));
    const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-gerar-orcamento`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'X-Internal-Call': 'true',
      },
      body: JSON.stringify({ conversation_id: conversationId, lead_id: leadId, mensagens, canal }),
    });
    const result = await resp.json();
    if (result.status === 'proposta_criada') {
      return {
        success: true,
        portalUrl: result.portal_url,
        total: result.total,
        numero: result.proposta_numero,
        propostaId: result.proposta_id,
      };
    }
    return {
      success: false,
      mensagem: result.status === 'info_faltante'
        ? 'Preciso de mais informações para gerar o orçamento.'
        : 'Não consegui gerar o orçamento automaticamente.',
    };
  } catch (err) {
    console.error('agent-post-process-message: ai-gerar-orcamento call failed:', err);
    return { success: false, mensagem: 'Erro ao gerar orçamento no sistema.' };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Internal-Call',
      },
    });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // Auth: aceita service_role (gateway valida JWT antes) OU header X-Internal-Call (uso interno)
  const auth = req.headers.get('Authorization') ?? '';
  const isInternal = req.headers.get('X-Internal-Call') === 'true';
  if (!isInternal && !auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  let body: any;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 }); }

  const { lead_id, conversation_id, intent, dados, confianca, memoria, canal } = body ?? {};
  if (!lead_id || !conversation_id) {
    return new Response(JSON.stringify({ error: 'lead_id e conversation_id obrigatorios' }), { status: 400 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const out: any = {};

  // 1. Grava dados extraídos (só se houver)
  if (dados && typeof dados === 'object' && Object.keys(dados).length > 0) {
    const currentLead = await lerLead(supabase, lead_id);
    if (currentLead) {
      out.extracao = await gravarDadosExtraidos(supabase, lead_id, currentLead, dados, confianca ?? {});
    }
  }

  // 2. Atualiza memória (sempre, mesmo que campos sejam null — para incrementar contador)
  if (memoria && typeof memoria === 'object') {
    const dadosConfirmados: any = {};
    if (dados) {
      for (const [k, v] of Object.entries(dados)) {
        if (v !== null && v !== undefined && v !== '') dadosConfirmados[k] = v;
      }
    }
    out.memoria = await atualizarMemoriaLead(supabase, lead_id, {
      resumo: memoria.resumo_curto ?? undefined,
      produto_interesse: memoria.produto_interesse ?? undefined,
      necessidade: memoria.necessidade ?? undefined,
      urgencia: memoria.urgencia ?? undefined,
      proximos_passos: memoria.proximos_passos ?? undefined,
      dados_confirmados: dadosConfirmados,
      incrementar_processadas: true,
    });
  }

  // 3. Gera orçamento se intent indicar
  if (intent === 'orcamento' || intent === 'formalizar') {
    out.orcamento = await gerarOrcamentoReal(supabase, conversation_id, lead_id, canal ?? 'whatsapp');
  }

  // 4. Incrementa contador da conversa (1 mensagem enviada)
  try {
    await supabase.rpc('incrementar_contador_conversa', {
      p_id: conversation_id, p_enviadas: 1, p_recebidas: 0, p_score: 0,
    });
    out.contador = { ok: true };
  } catch (err) {
    out.contador = { ok: false, error: String((err as Error).message ?? err) };
  }

  return new Response(JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
