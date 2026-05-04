// supabase/functions/whatsapp-enviar/index.ts
// v21 (2026-05-05): template_name parametrizado + suporte a multiplas janelas horarias.
// Mudancas vs v20:
//  - Aceita agent_messages.metadata.template_name (fallback: croma_abertura)
//  - Aceita agent_messages.metadata.template_params (array de strings)
//  - Aceita agent_messages.metadata.template_language (default pt_BR)
//  - Aceita admin_config.agent_config.horarios = [["10:00","12:00"],["14:00","17:00"]]
//  - NAO envia components vazio para templates sem variaveis

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://crm-croma.vercel.app',
  'https://campo-croma.vercel.app',
  'http://localhost:5173',
  'http://localhost:8080'
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Content-Type, Authorization',
  };
}

function jsonResp(data: any, status: number, headers: Record<string,string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
}

function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

async function getWhatsAppCredentials(supabase: any) {
  const REQUIRED = [
    'WHATSAPP_ACCESS_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'WHATSAPP_BUSINESS_ACCOUNT_ID',
    'WHATSAPP_API_VERSION'
  ];
  const { data, error } = await supabase
    .from('admin_config')
    .select('chave, valor')
    .in('chave', REQUIRED);

  if (error) {
    return { ok: false, missing: ['<query failed>'], message: 'Falha admin_config: ' + error.message };
  }
  const cfg: Record<string,string> = {};
  for (const c of data || []) cfg[c.chave] = c.valor;

  const accessToken = cfg['WHATSAPP_ACCESS_TOKEN'];
  const phoneNumberId = cfg['WHATSAPP_PHONE_NUMBER_ID'];
  const wabaId = cfg['WHATSAPP_BUSINESS_ACCOUNT_ID'];
  const apiVersion = cfg['WHATSAPP_API_VERSION'] || 'v22.0';

  const missing: string[] = [];
  if (!accessToken) missing.push('WHATSAPP_ACCESS_TOKEN');
  if (!phoneNumberId) missing.push('WHATSAPP_PHONE_NUMBER_ID');
  if (!wabaId) missing.push('WHATSAPP_BUSINESS_ACCOUNT_ID');
  if (missing.length > 0) {
    return { ok: false, missing, message: 'Credenciais ausentes: ' + missing.join(', ') };
  }
  return { ok: true, accessToken, phoneNumberId, wabaId, apiVersion };
}

async function postToMetaCloud(creds: any, payload: any) {
  const url = `https://graph.facebook.com/${creds.apiVersion}/${creds.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + creds.accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, body: (await res.text()).substring(0, 1000) };
  }
  return { ok: true, metaData: await res.json() };
}

function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 11 || digits.length === 10) return '55' + digits;
  return digits;
}

function buildTemplatePayload(to: string, templateName: string, params: any[], lang: string) {
  const tpl: any = {
    name: templateName,
    language: { code: lang || 'pt_BR' },
  };
  // v21: so inclui components se HOUVER parametros.
  // Templates sem variaveis (como croma_poste_seg_abertura_v2) nao devem mandar components vazio.
  if (params && params.length > 0) {
    tpl.components = [{
      type: 'body',
      parameters: params.map(p => ({ type: 'text', text: String(p || 'Cliente') }))
    }];
  }
  return {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: tpl,
  };
}

function buildTextPayload(to: string, body: string) {
  return { messaging_product: 'whatsapp', to, type: 'text', text: { body } };
}

function dentroDaJanela(hhmm: string, cfg: any) {
  if (cfg.horarios && Array.isArray(cfg.horarios) && cfg.horarios.length > 0) {
    return cfg.horarios.some((win: any) =>
      Array.isArray(win) && win.length === 2 && hhmm >= win[0] && hhmm < win[1]
    );
  }
  const ini = cfg.horario_inicio || '08:00';
  const fim = cfg.horario_fim || '18:00';
  return hhmm >= ini && hhmm < fim;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) });
  const ch = getCorsHeaders(req);

  try {
    const ah = req.headers.get('Authorization');
    if (!ah || !ah.startsWith('Bearer ')) return jsonResp({ error: 'Token nao fornecido' }, 401, ch);
    const tk = ah.replace('Bearer ', '');
    const ss = getServiceClient();
    const SK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    let ok = false;
    if (tk === SK) {
      ok = true;
    } else {
      const { data: { user }, error } = await ss.auth.getUser(tk);
      if (error || !user) return jsonResp({ error: 'Token invalido' }, 401, ch);
      const { data: profile } = await ss.from('profiles').select('role').eq('id', user.id).single();
      const allowed = ['comercial', 'gerente', 'admin'];
      if (!profile || !allowed.includes(profile.role)) {
        return jsonResp({ error: 'Sem permissao' }, 403, ch);
      }
      ok = true;
    }
    if (!ok) return jsonResp({ error: 'Nao autorizado' }, 401, ch);

    const body = await req.json();
    const { message_id } = body;
    if (!message_id) return jsonResp({ error: 'message_id obrigatorio' }, 400, ch);

    const sb = getServiceClient();

    // Pre-check: limites e janela
    {
      const { data: pc } = await sb.from('agent_messages').select('metadata').eq('id', message_id).single();
      const isManual = pc && pc.metadata && pc.metadata.manual === true;
      const { data: cr } = await sb.from('admin_config').select('valor').eq('chave', 'agent_config').single();
      let cfg: any = { max_contatos_dia: 50, horario_inicio: '08:00', horario_fim: '18:00' };
      if (cr && cr.valor) {
        try { cfg = { ...cfg, ...JSON.parse(cr.valor) }; } catch (_) {}
      }
      const max = cfg.max_contatos_dia || 50;
      if (!isManual) {
        // Hora BRT = UTC - 3
        const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
        const hm = String(now.getUTCHours()).padStart(2, '0') + ':' +
                   String(now.getUTCMinutes()).padStart(2, '0');
        if (!dentroDaJanela(hm, cfg)) {
          const desc = cfg.horarios ? JSON.stringify(cfg.horarios) : (cfg.horario_inicio + '-' + cfg.horario_fim);
          return jsonResp({ error: 'Fora do horario (' + desc + ')' }, 429, ch);
        }
      }
      const ts = new Date(); ts.setHours(0, 0, 0, 0);
      const { count } = await sb.from('agent_messages')
        .select('id', { count: 'exact', head: true })
        .eq('canal', 'whatsapp').eq('status', 'enviada').gte('enviado_em', ts.toISOString());
      if ((count || 0) >= max) {
        return jsonResp({ error: 'Limite diario ' + max + ' atingido' }, 429, ch);
      }
    }

    // Carregar mensagem + lead
    const { data: msg, error: msgErr } = await sb
      .from('agent_messages')
      .select('id, conteudo, status, metadata, canal, conversation_id, agent_conversations ( id, lead_id, mensagens_enviadas, mensagens_recebidas, ultima_mensagem_em, leads ( id, empresa, contato_nome, contato_telefone, status ) )')
      .eq('id', message_id).eq('status', 'aprovada').eq('canal', 'whatsapp').single();
    if (msgErr || !msg) return jsonResp({ error: 'Mensagem nao encontrada ou nao aprovada' }, 404, ch);

    const cv: any = msg.agent_conversations;
    const ld: any = cv && cv.leads;
    if (!ld) return jsonResp({ error: 'Lead nao encontrado' }, 404, ch);
    if (!ld.contato_telefone) {
      await sb.from('agent_messages').update({
        status: 'erro', erro_mensagem: 'Lead sem telefone'
      }).eq('id', message_id);
      return jsonResp({ error: 'Lead sem telefone cadastrado' }, 400, ch);
    }

    const tp = normalizePhone(ld.contato_telefone);
    const now = new Date().toISOString();

    const cr2 = await getWhatsAppCredentials(sb);
    if (!cr2.ok) {
      await sb.from('agent_messages').update({
        status: 'erro', erro_mensagem: cr2.message
      }).eq('id', message_id);
      return jsonResp({ error: cr2.message, missing: cr2.missing }, 500, ch);
    }

    const isFirst = (cv.mensagens_enviadas || 0) === 0;
    const hasReply = (cv.mensagens_recebidas || 0) > 0;

    // v21: le template parametrizado do metadata
    const md = msg.metadata || {};
    const tn: string = md.template_name || 'croma_abertura';
    // v21: aceita array vazio explicitamente (templates sem vars)
    // Se metadata.template_params NAO esta definido (legado), usa [contato_nome] como fallback
    const tps: any[] = Array.isArray(md.template_params)
      ? md.template_params
      : [ld.contato_nome || ld.empresa || ''];
    const tl: string = md.template_language || 'pt_BR';

    const wp = isFirst && !hasReply
      ? buildTemplatePayload(tp, tn, tps, tl)
      : buildTextPayload(tp, msg.conteudo || '');

    const mr = await postToMetaCloud(cr2, wp);
    if (!mr.ok) {
      await sb.from('agent_messages').update({
        status: 'erro', erro_mensagem: mr.body
      }).eq('id', message_id);
      return jsonResp({ error: 'Falha Meta Cloud API', status: mr.status, detail: mr.body }, 502, ch);
    }
    const wmid = mr.metaData?.messages?.[0]?.id;

    await sb.from('agent_messages').update({
      status: 'enviada',
      enviado_em: now,
      metadata: {
        ...(msg.metadata || {}),
        whatsapp_message_id: wmid,
        sent_as: isFirst && !hasReply ? 'template' : 'text',
        template_used: isFirst && !hasReply ? tn : null
      }
    }).eq('id', message_id);

    await sb.from('agent_conversations').update({
      mensagens_enviadas: (cv.mensagens_enviadas || 0) + 1,
      ultima_mensagem_em: now
    }).eq('id', msg.conversation_id);

    await sb.from('atividades_comerciais').insert({
      entidade_tipo: 'lead', entidade_id: ld.id, tipo: 'whatsapp',
      descricao: '[Agente] WhatsApp enviado: ' + (msg.conteudo || '').substring(0, 80),
      resultado: 'enviado', data_atividade: now,
    });

    if (ld.status === 'novo') {
      await sb.from('leads').update({ status: 'contatado' })
        .eq('id', ld.id).eq('status', 'novo');
    }

    return jsonResp({
      success: true,
      message_id,
      whatsapp_message_id: wmid,
      to: tp,
      sent_as: isFirst && !hasReply ? 'template' : 'text',
      template_used: isFirst && !hasReply ? tn : null,
    }, 200, ch);
  } catch (err: any) {
    console.error('whatsapp-enviar v21 error:', err);
    return jsonResp({ error: 'Erro interno', detail: err.message }, 500, ch);
  }
});
