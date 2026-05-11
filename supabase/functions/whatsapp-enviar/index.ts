// supabase/functions/whatsapp-enviar/index.ts
// v26 (2026-05-11, migration 151) — captura error.code + error_data.details quando Meta retorna falha sincrona.
//                                    Permite RPC private.fn_auto_marcar_sem_whatsapp identificar leads invalidos.
// v22 (2026-05-06): aceita JWT legacy service_role + sb_secret novo formato + user JWT.
// Resolve o conflito entre gateway (verify_jwt=true exige JWT legacy) e env
// SUPABASE_SERVICE_ROLE_KEY (novo formato sb_secret_xxx).
//
// Estrategia de auth (em ordem):
//  1. Token == env SUPABASE_SERVICE_ROLE_KEY (sb_secret novo) -> service_role
//  2. Token e JWT legacy com role=service_role no payload -> service_role
//     (gateway ja validou a assinatura antes de chegar aqui)
//  3. Token e JWT de usuario valido com role allowed -> user
//
// v21 (2026-05-05): template_name parametrizado + suporte a multiplas janelas horarias.
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

// v22 (2026-05-06): inclui suporte a header IMAGE.
// Se admin_config tem WHATSAPP_MEDIA_<template_name> com media_id, monta o
// component type=header com parameter type=image referenciando esse media.
// Caso contrario, omite o header (templates sem header).
function buildTemplatePayload(
  to: string,
  templateName: string,
  params: any[],
  lang: string,
  headerMediaId?: string,
  headerImageLink?: string,
) {
  const tpl: any = {
    name: templateName,
    language: { code: lang || 'pt_BR' },
  };

  const components: any[] = [];

  // Header IMAGE (se template foi criado com header de imagem)
  if (headerMediaId || headerImageLink) {
    const imageParam: any = headerMediaId
      ? { type: 'image', image: { id: headerMediaId } }
      : { type: 'image', image: { link: headerImageLink } };
    components.push({ type: 'header', parameters: [imageParam] });
  }

  // Body parameters (se template tem variaveis)
  if (params && params.length > 0) {
    components.push({
      type: 'body',
      parameters: params.map(p => ({ type: 'text', text: String(p || 'Cliente') })),
    });
  }

  if (components.length > 0) tpl.components = components;

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

// Decodifica payload de um JWT (sem validar assinatura — o gateway já validou
// quando verify_jwt=true). Retorna null se nao for JWT legacy valido.
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // Base64url decode do payload
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padding = padded.length % 4;
    const b64 = padded + (padding ? '='.repeat(4 - padding) : '');
    const json = atob(b64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Retorna 'service_role' | 'user_jwt' | null. NAO valida assinatura — apenas
// classifica o token. Gateway ja validou JWT antes de chegar aqui.
function classifyToken(token: string, envKey: string | undefined): 'env_match' | 'jwt_service_role' | 'user_jwt' | 'invalid' {
  if (envKey && token === envKey) return 'env_match'; // sb_secret novo formato OU JWT legacy igual ao env
  const payload = decodeJwtPayload(token);
  if (!payload) return 'invalid';
  // Service role JWT: tem campo "role": "service_role"
  if (payload.role === 'service_role' && payload.iss === 'supabase') return 'jwt_service_role';
  // User JWT: tem "sub" (user id) e "aud": "authenticated"
  if (typeof payload.sub === 'string' && payload.aud === 'authenticated') return 'user_jwt';
  return 'invalid';
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
    const cls = classifyToken(tk, SK);

    let ok = false;
    if (cls === 'env_match' || cls === 'jwt_service_role') {
      // Service role: env match (sb_secret) OU JWT legacy com role=service_role
      // Gateway ja validou a assinatura quando verify_jwt=true, entao confiamos no payload.
      ok = true;
    } else if (cls === 'user_jwt') {
      const { data: { user }, error } = await ss.auth.getUser(tk);
      if (error || !user) return jsonResp({ error: 'Token invalido' }, 401, ch);
      const { data: profile } = await ss.from('profiles').select('role').eq('id', user.id).single();
      const allowed = ['comercial', 'gerente', 'admin'];
      if (!profile || !allowed.includes(profile.role)) {
        return jsonResp({ error: 'Sem permissao' }, 403, ch);
      }
      ok = true;
    } else {
      return jsonResp({ error: 'Token invalido' }, 401, ch);
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
      .select('id, conteudo, status, metadata, canal, conversation_id, media_url, media_type, agent_conversations ( id, lead_id, mensagens_enviadas, mensagens_recebidas, ultima_mensagem_em, leads ( id, empresa, contato_nome, contato_telefone, status ) )')
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

    // Montar payload: imagem manual tem prioridade; depois template (1ª msg); depois texto livre
    let wp: Record<string, unknown>;
    if ((msg as any).media_url && (msg as any).media_type === 'image') {
      // Envio de imagem — suporta apenas em janela de conversa aberta (não como template)
      wp = {
        messaging_product: 'whatsapp',
        to: tp,
        type: 'image',
        image: {
          link: (msg as any).media_url,
          ...(msg.conteudo ? { caption: msg.conteudo } : {}),
        },
      };
    } else if (isFirst && !hasReply) {
      // v22: busca media_id se template tiver header IMAGE configurado
      // Convencao: admin_config.WHATSAPP_MEDIA_<template_name> = media_id
      let headerMediaId: string | undefined;
      let headerImageLink: string | undefined;
      try {
        const mediaKey = `WHATSAPP_MEDIA_${tn}`;
        const { data: mediaCfg } = await sb.from('admin_config')
          .select('valor').eq('chave', mediaKey).maybeSingle();
        if (mediaCfg?.valor) {
          // Pode ser media_id puro OU URL http(s)
          const v = String(mediaCfg.valor).trim();
          if (v.startsWith('http://') || v.startsWith('https://')) {
            headerImageLink = v;
          } else if (v) {
            headerMediaId = v;
          }
        }
        // Fallback: metadata.imagem_url da propria mensagem
        if (!headerMediaId && !headerImageLink && md.imagem_url) {
          headerImageLink = String(md.imagem_url);
        }
      } catch (_) { /* sem header */ }

      wp = buildTemplatePayload(tp, tn, tps, tl, headerMediaId, headerImageLink);
    } else {
      wp = buildTextPayload(tp, msg.conteudo || '');
    }

    const mr = await postToMetaCloud(cr2, wp);
    if (!mr.ok) {
      // v26 (migration 151): tentar parsear body Meta como JSON pra extrair code + error_data.details.
      // Meta retorna {"error":{"code":131026,"message":"...","error_data":{"details":"..."}}} em falhas.
      let erroCodigo: string | null = null;
      let erroDetalhes: string | null = null;
      let erroMensagem: string = mr.body;
      try {
        const parsed = JSON.parse(mr.body);
        const e = parsed?.error;
        if (e) {
          if (e.code != null) erroCodigo = String(e.code);
          erroMensagem = e.message ?? mr.body;
          erroDetalhes = e.error_data?.details ?? e.error_subcode != null ? String(e.error_subcode) : null;
        }
      } catch (_) { /* body nao era JSON — fica com body raw */ }
      await sb.from('agent_messages').update({
        status: 'erro',
        erro_mensagem: erroMensagem,
        erro_codigo: erroCodigo,
        erro_detalhes: erroDetalhes,
      }).eq('id', message_id);
      return jsonResp({ error: 'Falha Meta Cloud API', status: mr.status, detail: mr.body, code: erroCodigo }, 502, ch);
    }
    const wmid = mr.metaData?.messages?.[0]?.id;

    const sentAs = (msg as any).media_url && (msg as any).media_type === 'image'
      ? 'image'
      : isFirst && !hasReply ? 'template' : 'text';

    await sb.from('agent_messages').update({
      status: 'enviada',
      enviado_em: now,
      metadata: {
        ...(msg.metadata || {}),
        whatsapp_message_id: wmid,
        sent_as: sentAs,
        template_used: sentAs === 'template' ? tn : null,
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
      sent_as: sentAs,
      template_used: sentAs === 'template' ? tn : null,
    }, 200, ch);
  } catch (err: any) {
    console.error('whatsapp-enviar v21 error:', err);
    return jsonResp({ error: 'Erro interno', detail: err.message }, 500, ch);
  }
});
