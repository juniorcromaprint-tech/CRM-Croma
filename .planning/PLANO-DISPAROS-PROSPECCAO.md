# PLANO DE EXECUÇÃO — Sistema de Disparos de Prospecção

> **Versão**: 1.0 | **Criado**: 2026-05-04 | **Autor**: Claudete (sessão Cowork)
> **Status**: PRONTO PARA EXECUÇÃO
> **Executor pretendido**: Próxima sessão Cowork/Claude Code (Sonnet)
> **Tempo estimado total**: 6-10h de codificação

---

## 0. COMO USAR ESTE DOCUMENTO

Este documento é **auto-suficiente**. Você (Sonnet em outra sessão) deve conseguir
executar tudo sem precisar consultar histórico. Cada fase tem:

- **Objetivo**: o que precisa ficar pronto
- **Pré-requisitos**: o que tem que estar feito antes
- **Passos**: ordem exata de execução
- **Código pronto**: SQL/TS/JSX prontos pra copiar/colar
- **Critério de aceitação**: como validar que ficou ok
- **Como testar**: queries SQL ou ações UI

**Regra de ouro**: Não pular fases. Cada fase entrega algo testável standalone.

---

## 1. CONTEXTO

### 1.1 O que aconteceu

A Croma Print começou a estruturar prospecção fria via WhatsApp para **194 leads do
segmento "Segurança"** descobertos via Apify Google Maps em SP/Grande SP.
Os leads estão importados e classificados em 4 sub-segmentos. A campanha é
"Envelopamento de poste para empresas de segurança".

### 1.2 Estado atual da base (verificado em 2026-05-04)

| Item | Status |
|---|---|
| Conversas zumbi (302) | ✅ DELETADAS — `agent_conversations` zerada |
| Cron `agent-cron-loop-30min` (jobid 15) | ⏸️ DESATIVADO (`active=false`) |
| Lead de teste interno `Wls` (id `0339d969-29d4-4eea-accb-70a27dbee4ca`) | ✅ Marcado em `observacoes`: "TESTE INTERNO - NAO INCLUIR EM DISPAROS" |
| Templates v2 Segurança no Meta | ✅ Aprovados (Junior cadastrou em sessão anterior) |
| Templates v1 Segurança no Meta | ⚠️ Pendente Junior deletar manualmente |
| Edge function `whatsapp-enviar` v20 | Funcional, mas com `croma_abertura` HARDCODED |
| Edge function `buscar-leads-google` | Timeout 60s (3 de 9 buscas falham para fallback demo) |
| Templates `agent_templates` para Segurança | ❌ NÃO existem no banco |
| 194 leads de Segurança | ✅ Cadastrados, 187 com telefone válido |
| Página `/leads` no frontend | Filtros pobres, sem multi-select, sem ação em massa |

### 1.3 Distribuição dos 194 leads de Segurança

| Sub-segmento | Total | Com telefone válido | Sem telefone |
|---|---:|---:|---:|
| `vigilancia_patrimonial` | 75 | 69 | 6 |
| `seguranca_eletronica` | 70 | 70 | 0 |
| `portaria_acesso` | 29 | 28 | 1 |
| `monitoramento_24h` | 20 | 19 | 1 |
| `sem_subsegmento` | 1 | 0 | 1 |
| **Total disparável** | **194** | **186** | 9 |

Sub-segmento está nas `observacoes` no formato `Sub-segmento: <slug>`.

---

## 2. DECISÕES TOMADAS (NÃO REDISCUTIR)

### 2.1 Filosofia do disparo

**Decisão**: dispatch **não-automático com seleção manual no UI**, NÃO automação
cega via cron de criação de conversas.

**Justificativa**: na sessão anterior, o cron criou 302 conversas zumbi sem
controle. Junior precisa **ver o que vai disparar** antes de confirmar. UX
manual com filtros ricos > automação opaca.

### 2.2 Cadência

**Decisão**: rampa progressiva — **15/dia × 2 dias úteis → 30/dia**.

**Justificativa**: aquecimento do número WhatsApp Business previne flag de spam.
Total ~8 dias úteis para 194 leads (rampa: 15+15+30×6).

### 2.3 Janela horária

**Decisão**: **dois blocos** — **10h-12h e 14h-17h BRT**.

**Justificativa**: bloco único concentra muito disparo numa janela curta e
WhatsApp pode flagar como spam em massa. Espalhar reduz risco.

### 2.4 Ordem de sub-segmentos

**Decisão**: começar por **Vigilância Patrimonial** (75 leads, 69 disparáveis),
depois Segurança Eletrônica (70/70), Portaria/Acesso (29/28), Monitoramento 24h (20/19).

**Justificativa**: Vigilância Patrimonial é mais homogêneo — calibra resposta
melhor.

### 2.5 Arquitetura de mensagens

**Decisão**: `agent_messages.metadata` carrega:
- `template_name` (nome do template aprovado pelo Meta)
- `template_params` (array de strings das variáveis `{{1}}`, `{{2}}`...)
- `template_language` (default `pt_BR`)

A edge function `whatsapp-enviar` lê esses campos. Sem hardcode.

### 2.6 Filtro de exclusão sempre ativo

**Decisão**: toda query de seleção de leads para disparo aplica:
```sql
AND excluido_em IS NULL
AND (observacoes IS NULL OR observacoes NOT ILIKE '%NAO INCLUIR%')
```

Não tem exceção. Lead de teste interno e leads opt-out ficam fora automaticamente.

---

## 3. ARQUITETURA — VISÃO 30.000 PÉS

```
┌────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React)                          │
│  /leads                                                            │
│   ├─ Filtros (segmento, sub-seg, região, status, tem-tel, etc.)    │
│   ├─ Tabela com checkbox + select-all                              │
│   └─ Barra de ações em massa → Modal "Disparar Abertura"           │
│         └─ chama RPC: disparar_abertura_em_massa()                 │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│                       SUPABASE (Postgres)                          │
│  vw_leads_disparo (view)  ←  filtros do UI consomem                │
│  fn_disparar_abertura_em_massa() (RPC)                             │
│   └─ cria agent_conversations + agent_messages (status='aprovada') │
│  agent_templates (templates por canal/etapa/segmento)              │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│             pg_cron job (jobid 15) — RELIGAR EM FASE 4             │
│  agent-cron-loop a cada 30 min nas janelas 10-12 / 14-17 BRT       │
│   └─ pega agent_messages.status='aprovada' do dia                  │
│       └─ chama whatsapp-enviar (uma por uma, com throttle)         │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│              EDGE FUNCTION whatsapp-enviar (v21)                   │
│  Lê metadata.template_name + template_params                       │
│  Verifica janela, limite diário, telefone                          │
│  Posta na Meta Cloud API → grava whatsapp_message_id               │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                        Meta WhatsApp Business API
                                  │
                                  ▼
                   Lead recebe mensagem; resposta cai
                   no whatsapp-webhook → atualiza conversa
```

---

## 4. FASE 1 — ESTRUTURA DE DADOS (SQL)

> **Objetivo**: criar a fundação que tudo o resto depende.
> **Tempo**: 1-2h
> **Pré-requisitos**: nenhum (banco já está limpo)

### 4.1 Migração: View `vw_leads_disparo`

Crie via `apply_migration` com nome `2026_05_05_create_vw_leads_disparo`:

```sql
CREATE OR REPLACE VIEW public.vw_leads_disparo AS
SELECT
  l.id,
  l.empresa,
  l.contato_nome,
  l.contato_telefone,
  l.contato_email,
  l.email,
  l.telefone,
  l.segmento,
  l.status,
  l.temperatura,
  l.score,
  l.valor_estimado,
  l.observacoes,
  l.cargo,
  l.vendedor_id,
  l.created_at,
  l.updated_at,
  l.origem_id,
  o.nome AS origem_nome,
  -- sub-segmento extraído das observações (formato "Sub-segmento: <slug>")
  COALESCE(
    (regexp_match(l.observacoes, 'Sub-segmento:\s*([\w_]+)'))[1],
    NULL
  ) AS sub_segmento,
  -- cidade extraída das observações (formato "... <Cidade> - SP, ...")
  COALESCE(
    (regexp_match(l.observacoes, ',\s*([\w\sÀ-ú]+)\s*-\s*SP'))[1],
    NULL
  ) AS cidade,
  -- estado fixo SP por enquanto (todos os leads atuais são SP)
  CASE
    WHEN l.observacoes ILIKE '%- SP%' THEN 'SP'
    ELSE NULL
  END AS estado,
  -- região simplificada
  CASE
    WHEN l.observacoes ILIKE '%São Paulo - SP%' OR l.observacoes ILIKE '%Sao Paulo SP%' THEN 'capital'
    WHEN l.observacoes ILIKE '%Guarulhos%' THEN 'grande_sp'
    WHEN l.observacoes ILIKE '%São Bernardo%' OR l.observacoes ILIKE '%Sao Bernardo%' OR l.observacoes ILIKE '%Santo André%' OR l.observacoes ILIKE '%Santo Andre%' OR l.observacoes ILIKE '%São Caetano%' OR l.observacoes ILIKE '%Sao Caetano%' OR l.observacoes ILIKE '%Diadema%' THEN 'abc'
    WHEN l.observacoes ILIKE '%Grande Sao Paulo%' OR l.observacoes ILIKE '%Grande São Paulo%' THEN 'grande_sp'
    ELSE 'outros'
  END AS regiao,
  -- flags úteis pro frontend
  (l.contato_telefone IS NOT NULL
    AND length(regexp_replace(l.contato_telefone, '\D', '', 'g')) BETWEEN 10 AND 13
  ) AS tem_telefone_valido,
  (l.contato_email IS NOT NULL AND l.contato_email LIKE '%@%')
    OR (l.email IS NOT NULL AND l.email LIKE '%@%')
    AS tem_email_valido,
  (l.observacoes ILIKE '%NAO INCLUIR%' OR l.observacoes ILIKE '%NÃO INCLUIR%') AS bloqueado_disparo,
  -- conversa ativa atual (se houver)
  EXISTS (
    SELECT 1 FROM agent_conversations ac
    WHERE ac.lead_id = l.id AND ac.status = 'ativa'
  ) AS em_conversa_ativa,
  -- última conversa (qualquer status)
  (SELECT MAX(ac.created_at)
    FROM agent_conversations ac WHERE ac.lead_id = l.id) AS ultima_conversa_em
FROM public.leads l
LEFT JOIN public.origens_lead o ON o.id = l.origem_id
WHERE l.excluido_em IS NULL;

GRANT SELECT ON public.vw_leads_disparo TO authenticated;
COMMENT ON VIEW public.vw_leads_disparo IS
'View enriquecida de leads para UI de disparos. Extrai sub-segmento, cidade, região e flags úteis.';
```

#### Critério de aceitação 4.1

```sql
-- Deve retornar 194-195 linhas para Segurança
SELECT count(*) FROM vw_leads_disparo WHERE segmento ILIKE '%segur%';

-- Deve retornar 4 sub-segmentos válidos + 1 nulo
SELECT sub_segmento, count(*) FROM vw_leads_disparo
WHERE segmento ILIKE '%segur%' GROUP BY sub_segmento;

-- Lead de teste deve aparecer com bloqueado_disparo = true
SELECT id, empresa, bloqueado_disparo FROM vw_leads_disparo
WHERE id = '0339d969-29d4-4eea-accb-70a27dbee4ca';
```

---

### 4.2 Migração: Templates Segurança no `agent_templates`

> ✅ **Templates aprovados no Meta** (confirmado via memory.md sessão `2026-05-04G`):
> - `croma_poste_seg_abertura_v2` — abertura, **SEM variáveis** (apresentação fixa "Aqui eh o Junior, da Croma Print")
> - `croma_poste_seg_followup_v2` — followup, SEM variáveis
> - Mensagem usa verbo "transformamos" (não "viramos")
> - Strategy: imagem vende, copy qualifica, mockup é recompensa por engajamento (NÃO oferecer mockup na 1ª mensagem)
>
> Conteúdo exato dos templates: ver `JARVIS/Templates_Abordagem_Seguranca.md`
> Junior só precisa confirmar se quer um único template para os 4 sub-segmentos
> ou dividir mensagem por sub-segmento (atualmente parece ser ÚNICO).

Migration nome: `2026_05_05_seed_templates_seguranca`:

```sql
-- Adicionar colunas de suporte ao novo modelo
ALTER TABLE public.agent_templates
  ADD COLUMN IF NOT EXISTS meta_template_name text,
  ADD COLUMN IF NOT EXISTS sub_segmento text,
  ADD COLUMN IF NOT EXISTS template_language text DEFAULT 'pt_BR';

COMMENT ON COLUMN public.agent_templates.meta_template_name IS
'Nome exato do template aprovado no Meta WhatsApp Business Manager. Se NULL, fallback usa croma_abertura.';

-- Inserir o template ÚNICO (sem variáveis) — Junior pode duplicar por sub-segmento depois
-- Conteúdo exato: ler arquivo JARVIS/Templates_Abordagem_Seguranca.md ANTES de inserir
-- Substituir <PLACEHOLDER_CONTEUDO_ABERTURA_V2> pelo texto real do template aprovado

INSERT INTO public.agent_templates (
  nome, canal, etapa, segmento, sub_segmento,
  conteudo, variaveis, meta_template_name, template_language, ativo
) VALUES (
  'WhatsApp Abertura Segurança v2 (Envelopamento Poste)',
  'whatsapp',
  'abertura',
  'seguranca',
  NULL,  -- aplica a todos os sub-segmentos
  '<PLACEHOLDER_CONTEUDO_ABERTURA_V2>',  -- ler de Templates_Abordagem_Seguranca.md
  ARRAY[]::text[],  -- v2 NÃO tem variáveis
  'croma_poste_seg_abertura_v2',
  'pt_BR',
  true
);

INSERT INTO public.agent_templates (
  nome, canal, etapa, segmento, sub_segmento,
  conteudo, variaveis, meta_template_name, template_language, ativo
) VALUES (
  'WhatsApp Followup Segurança v2 (Envelopamento Poste)',
  'whatsapp',
  'followup1',
  'seguranca',
  NULL,
  '<PLACEHOLDER_CONTEUDO_FOLLOWUP_V2>',
  ARRAY[]::text[],
  'croma_poste_seg_followup_v2',
  'pt_BR',
  true
);
```

> **Importante**: como o template v2 não tem variáveis, o array `template_params` no
> metadata da mensagem deve ficar vazio (`[]`). A edge function `whatsapp-enviar` v21
> já trata isso (não envia o array `parameters` vazio se não houver vars no template).

#### Critério de aceitação 4.2

```sql
SELECT nome, sub_segmento, meta_template_name, ativo
FROM agent_templates
WHERE segmento = 'seguranca'
ORDER BY sub_segmento;
-- Deve retornar 4 (ou 1) linhas, todas ativas, com meta_template_name preenchido
```

---

### 4.3 Migração: RPC `fn_disparar_abertura_em_massa`

Migration nome: `2026_05_05_create_fn_disparar_abertura`:

```sql
CREATE OR REPLACE FUNCTION public.fn_disparar_abertura_em_massa(
  p_lead_ids uuid[],
  p_template_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_auto_aprovar boolean DEFAULT true,
  p_modo text DEFAULT 'imediato'  -- 'imediato' | 'agendado'
)
RETURNS TABLE (
  lead_id uuid,
  conversation_id uuid,
  message_id uuid,
  status text,
  motivo text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template record;
  v_lead record;
  v_conv_id uuid;
  v_msg_id uuid;
  v_canal text;
  v_etapa text;
  v_meta_name text;
  v_template_lang text;
  v_template_params text[];
BEGIN
  -- Validação do template
  SELECT id, canal, etapa, conteudo, variaveis, meta_template_name, template_language, ativo
    INTO v_template
  FROM public.agent_templates WHERE id = p_template_id;

  IF NOT FOUND OR NOT v_template.ativo THEN
    RAISE EXCEPTION 'Template % nao encontrado ou inativo', p_template_id;
  END IF;

  v_canal := v_template.canal;
  v_etapa := v_template.etapa;
  v_meta_name := COALESCE(v_template.meta_template_name, 'croma_abertura');
  v_template_lang := COALESCE(v_template.template_language, 'pt_BR');
  v_template_params := COALESCE(v_template.variaveis, ARRAY['contato_nome']);

  -- Loop pelos leads
  FOR v_lead IN
    SELECT l.id, l.empresa, l.contato_nome, l.contato_telefone, l.contato_email,
           l.observacoes, l.status as lead_status
    FROM public.leads l
    WHERE l.id = ANY(p_lead_ids)
      AND l.excluido_em IS NULL
  LOOP
    -- Skip se bloqueado por observação
    IF v_lead.observacoes ILIKE '%NAO INCLUIR%' OR v_lead.observacoes ILIKE '%NÃO INCLUIR%' THEN
      lead_id := v_lead.id;
      conversation_id := NULL;
      message_id := NULL;
      status := 'bloqueado';
      motivo := 'Lead marcado como NAO INCLUIR EM DISPAROS';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Skip se WhatsApp e sem telefone válido
    IF v_canal = 'whatsapp' AND (
      v_lead.contato_telefone IS NULL
      OR length(regexp_replace(v_lead.contato_telefone, '\D', '', 'g')) NOT BETWEEN 10 AND 13
    ) THEN
      lead_id := v_lead.id;
      conversation_id := NULL;
      message_id := NULL;
      status := 'pulado';
      motivo := 'Lead sem telefone valido para WhatsApp';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Skip se ja tem conversa ativa
    IF EXISTS (
      SELECT 1 FROM public.agent_conversations
      WHERE lead_id = v_lead.id AND status = 'ativa'
    ) THEN
      lead_id := v_lead.id;
      conversation_id := NULL;
      message_id := NULL;
      status := 'duplicado';
      motivo := 'Lead ja tem conversa ativa';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Criar conversa
    INSERT INTO public.agent_conversations (
      lead_id, canal, status, etapa, mensagens_enviadas, mensagens_recebidas,
      tentativas, max_tentativas, score_engajamento, automacao_pausada, auto_aprovacao, metadata
    ) VALUES (
      v_lead.id, v_canal, 'ativa', v_etapa, 0, 0, 0, 3, 0, false, p_auto_aprovar,
      jsonb_build_object(
        'campanha', 'disparo_manual',
        'template_id', p_template_id,
        'criada_por', p_user_id,
        'criada_em', now(),
        'modo', p_modo
      )
    )
    RETURNING id INTO v_conv_id;

    -- Renderizar parametros do template
    DECLARE
      v_params_render text[];
      v_param_name text;
    BEGIN
      v_params_render := ARRAY[]::text[];
      FOREACH v_param_name IN ARRAY v_template_params LOOP
        v_params_render := v_params_render || CASE v_param_name
          WHEN 'contato_nome' THEN COALESCE(v_lead.contato_nome, v_lead.empresa, 'Cliente')
          WHEN 'empresa' THEN COALESCE(v_lead.empresa, '')
          ELSE ''
        END;
      END LOOP;

      -- Criar mensagem aprovada
      INSERT INTO public.agent_messages (
        conversation_id, canal, conteudo, status, metadata, created_at
      ) VALUES (
        v_conv_id, v_canal, v_template.conteudo, 'aprovada',
        jsonb_build_object(
          'template_name', v_meta_name,
          'template_params', v_params_render,
          'template_language', v_template_lang,
          'template_id', p_template_id,
          'campanha', 'disparo_manual',
          'criada_por', p_user_id
        ),
        now()
      )
      RETURNING id INTO v_msg_id;
    END;

    -- Atualizar contador do template
    UPDATE public.agent_templates SET vezes_usado = vezes_usado + 1
      WHERE id = p_template_id;

    -- Retorno
    lead_id := v_lead.id;
    conversation_id := v_conv_id;
    message_id := v_msg_id;
    status := 'criado';
    motivo := NULL;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_disparar_abertura_em_massa(uuid[], uuid, uuid, boolean, text)
  TO authenticated;

COMMENT ON FUNCTION public.fn_disparar_abertura_em_massa IS
'Cria conversa + mensagem aprovada em massa para uma lista de leads usando um template específico.
Pula leads bloqueados (NAO INCLUIR), sem telefone, ou em conversa ativa.
Retorna uma linha por lead com status (criado/bloqueado/pulado/duplicado).';
```

> **Coluna `agent_messages.status` valores válidos**: confirmar com `\d+ agent_messages` antes
> de executar; ajustar `'aprovada'` se necessário (provavelmente é exato).

#### Critério de aceitação 4.3

Teste seco com 1 lead de teste interno (deve retornar `bloqueado`):

```sql
SELECT * FROM fn_disparar_abertura_em_massa(
  ARRAY['0339d969-29d4-4eea-accb-70a27dbee4ca']::uuid[],
  (SELECT id FROM agent_templates WHERE segmento='seguranca' AND ativo LIMIT 1)
);
-- status deve ser 'bloqueado', motivo: 'Lead marcado como NAO INCLUIR EM DISPAROS'

-- Conferir que NÃO criou conversa
SELECT count(*) FROM agent_conversations WHERE lead_id = '0339d969-29d4-4eea-accb-70a27dbee4ca';
-- Deve ser 0
```

---

## 5. FASE 2 — EDGE FUNCTIONS

> **Objetivo**: refatorar `whatsapp-enviar` para template parametrizado + aumentar timeout
> da `buscar-leads-google`.
> **Tempo**: 1h
> **Pré-requisitos**: Fase 1 concluída

### 5.1 Refatorar `whatsapp-enviar` v21

Trocar HARDCODE `croma_abertura` por leitura de `agent_messages.metadata.template_name`.

**Comando**: `mcp__supabase__deploy_edge_function`
**Slug**: `whatsapp-enviar`
**Verify JWT**: `true`

> ⚠️ **Aviso**: nesta sessão (2026-05-04) tentei deploy 3x e falhou com
> `InternalServerErrorException` — provavelmente flap do servidor Supabase.
> **Tente de novo na sua sessão. Se falhar, faça via Supabase CLI local:**
> ```bash
> cd CRM-Croma
> supabase functions deploy whatsapp-enviar --no-verify-jwt=false
> ```

**Conteúdo do `index.ts` v21**:

```typescript
// supabase/functions/whatsapp-enviar/index.ts
// v21 (2026-05-04): template_name parametrizado + suporte a multiplas janelas horarias.
// Mudanças vs v20:
//  - Aceita agent_messages.metadata.template_name (fallback: croma_abertura)
//  - Aceita agent_messages.metadata.template_params (array de strings)
//  - Aceita agent_messages.metadata.template_language (default pt_BR)
//  - Aceita admin_config.agent_config.horarios = [['10:00','12:00'],['14:00','17:00']]

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
  // v21: só inclui components se HOUVER parâmetros. Templates sem variáveis
  // (como croma_poste_seg_abertura_v2) não devem mandar components vazio.
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

    // v21: lê template parametrizado do metadata
    const md = msg.metadata || {};
    const tn: string = md.template_name || 'croma_abertura';
    // v21: aceita array vazio explicitamente (templates sem vars)
    // Se metadata.template_params NÃO está definido (legado), usa [contato_nome] como fallback
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
    console.error('whatsapp-enviar error:', err);
    return jsonResp({ error: 'Erro interno', detail: err.message }, 500, ch);
  }
});
```

#### Critério de aceitação 5.1

Teste manual com `curl`:

```bash
# Pega um message_id de teste interno e roda
curl -X POST "https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/whatsapp-enviar" \
  -H "Authorization: Bearer $SERVICE_ROLE" \
  -H "Content-Type: application/json" \
  -d '{"message_id":"<UUID>"}'
# Deve retornar template_used preenchido com o template_name customizado
```

---

### 5.2 Aumentar timeout `buscar-leads-google` 60s→120s

Buscar a configuração de timeout no código atual e ajustar. Se o timeout estiver
sendo definido via `setTimeout`/`AbortController` no fetch interno, alterar lá.

> Não tenho o código desta função carregado neste plano. Sonnet:
> 1. Pegue via `mcp__supabase__get_edge_function('buscar-leads-google')`
> 2. Procure por `60000` ou `60_000` ou `setTimeout` com 60s
> 3. Troque por 120s
> 4. Re-deploy

#### Critério de aceitação 5.2

```bash
# Logs de execução não devem mais mostrar fallback demo após 60s
# Buscar via SQL:
SELECT count(*) FROM agent_messages
WHERE metadata->>'fallback_demo' = 'true'
  AND created_at > now() - interval '7 days';
-- Deve cair pra zero/perto de zero nas próximas execuções
```

---

## 6. FASE 3 — FRONTEND `/leads` (FILTROS + MULTI-SELECT)

> **Objetivo**: enriquecer página `/leads` com filtros completos e seleção múltipla.
> **Tempo**: 3-5h
> **Pré-requisitos**: Fase 1 (view) concluída
> **Stack atual**: React + TypeScript + Tailwind + shadcn/ui

### 6.1 Estrutura de componentes

```
src/pages/Leads.tsx                          (página principal — refatorar)
src/components/leads/
  ├── LeadsFilters.tsx                       (NOVO — barra lateral ou top filters)
  ├── LeadsTable.tsx                         (REFATORAR — adicionar checkbox column)
  ├── LeadsBulkActionBar.tsx                 (NOVO — sticky bottom)
  ├── DispararAberturaModal.tsx              (NOVO — modal de disparo)
  └── hooks/
      ├── useLeadsDisparo.ts                 (NOVO — query + filtros)
      ├── useLeadsSelection.ts               (NOVO — set de IDs selecionados)
      └── useDispararAbertura.ts             (NOVO — mutation que chama RPC)
```

### 6.2 Hook `useLeadsDisparo`

```typescript
// src/components/leads/hooks/useLeadsDisparo.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LeadsFilterState {
  segmentos?: string[];
  subSegmentos?: string[];
  origens?: string[];
  status?: string[];
  temperaturas?: string[];
  estados?: string[];
  cidades?: string[];
  regioes?: string[];
  temTelefone?: boolean | null;     // true | false | null (qualquer)
  temEmail?: boolean | null;
  emConversaAtiva?: boolean | null;
  scoreMin?: number;
  scoreMax?: number;
  vendedorId?: string | null;
  cadastroDe?: string;              // ISO date
  cadastroAte?: string;
  excluirBloqueados?: boolean;      // default true
  busca?: string;                   // texto livre
}

export function useLeadsDisparo(filters: LeadsFilterState) {
  return useQuery({
    queryKey: ['leads-disparo', filters],
    queryFn: async () => {
      let q = supabase.from('vw_leads_disparo').select('*');

      if (filters.segmentos?.length) q = q.in('segmento', filters.segmentos);
      if (filters.subSegmentos?.length) q = q.in('sub_segmento', filters.subSegmentos);
      if (filters.origens?.length) q = q.in('origem_nome', filters.origens);
      if (filters.status?.length) q = q.in('status', filters.status);
      if (filters.temperaturas?.length) q = q.in('temperatura', filters.temperaturas);
      if (filters.estados?.length) q = q.in('estado', filters.estados);
      if (filters.regioes?.length) q = q.in('regiao', filters.regioes);
      if (filters.temTelefone === true) q = q.eq('tem_telefone_valido', true);
      if (filters.temTelefone === false) q = q.eq('tem_telefone_valido', false);
      if (filters.temEmail === true) q = q.eq('tem_email_valido', true);
      if (filters.temEmail === false) q = q.eq('tem_email_valido', false);
      if (filters.emConversaAtiva === true) q = q.eq('em_conversa_ativa', true);
      if (filters.emConversaAtiva === false) q = q.eq('em_conversa_ativa', false);
      if (filters.scoreMin != null) q = q.gte('score', filters.scoreMin);
      if (filters.scoreMax != null) q = q.lte('score', filters.scoreMax);
      if (filters.vendedorId) q = q.eq('vendedor_id', filters.vendedorId);
      if (filters.cadastroDe) q = q.gte('created_at', filters.cadastroDe);
      if (filters.cadastroAte) q = q.lte('created_at', filters.cadastroAte);
      if (filters.excluirBloqueados !== false) q = q.eq('bloqueado_disparo', false);
      if (filters.busca) {
        q = q.or(
          `empresa.ilike.%${filters.busca}%,contato_nome.ilike.%${filters.busca}%,contato_telefone.ilike.%${filters.busca}%`
        );
      }

      q = q.order('created_at', { ascending: false }).limit(1000);

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}
```

### 6.3 Componente `LeadsFilters`

Layout sugerido — barra lateral colapsável (desktop) ou drawer (mobile):

```tsx
// src/components/leads/LeadsFilters.tsx
import { Select, MultiSelect, Switch, RangeSlider, DateRangePicker, Button } from '@/components/ui/...';

interface Props {
  filters: LeadsFilterState;
  onChange: (next: LeadsFilterState) => void;
  segmentosOpts: string[];
  subSegmentosOpts: string[];
  origensOpts: string[];
  cidadesOpts: string[];
  vendedoresOpts: { id: string; nome: string }[];
}

export function LeadsFilters({ filters, onChange, ...opts }: Props) {
  // Layout em sections agrupadas:
  // 1. Busca livre (text input)
  // 2. Segmentação (segmento, sub-segmento, origem)
  // 3. Geografia (estado, região, cidade)
  // 4. Status (status, temperatura, score range)
  // 5. Contato (tem telefone, tem email, em conversa ativa)
  // 6. Atribuição (vendedor, data de cadastro)
  // 7. Toggle "Excluir leads marcados NAO INCLUIR" (default ON)
  // 8. Botão "Limpar filtros"
  return ( /* ... JSX ... */ );
}
```

**Importante**: persistir filtros na **URL querystring** (use `useSearchParams` do
react-router-dom). Permite compartilhar link e mantém estado em refresh.

### 6.4 Tabela `LeadsTable`

Colunas mínimas:
- Checkbox (com `selectAll` na header)
- Empresa (link pra detalhe do lead)
- Contato
- Telefone (badge verde se válido, vermelho se ausente)
- Segmento + sub-segmento (badges)
- Status (badge colorido)
- Última conversa (relativa, ex: "há 3 dias")
- Score (number)
- Cidade
- Em conversa ativa? (ícone)

`<tr>` do lead bloqueado: opacity-50 + tooltip "Bloqueado para disparos".

### 6.5 Hook `useLeadsSelection`

```typescript
// src/components/leads/hooks/useLeadsSelection.ts
import { useState, useCallback } from 'react';

export function useLeadsSelection() {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const toggle = useCallback((id: string) => {
    setIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);
  const selectMany = useCallback((newIds: string[]) =>
    setIds(prev => new Set([...prev, ...newIds])), []);
  const clear = useCallback(() => setIds(new Set()), []);
  const has = useCallback((id: string) => ids.has(id), [ids]);
  return { ids, toggle, selectMany, clear, has, count: ids.size };
}
```

### 6.6 Barra de ações em massa

```tsx
// src/components/leads/LeadsBulkActionBar.tsx
// Sticky bottom, aparece quando count > 0
// Botões:
//   - [✕] Limpar seleção
//   - [N selecionados]
//   - [Disparar abertura] (primary)
//   - [Atribuir vendedor]
//   - [Marcar como contatado]
//   - [Exportar CSV]
```

### 6.7 Modal `DispararAberturaModal`

Wizard de 4 steps com estado interno:

**Step 1 — Confirmação inicial**
> Você selecionou **47 leads**. Vamos disparar a mensagem de abertura.
> ⚠️ X leads serão pulados automaticamente:
>  - 2 sem telefone válido
>  - 1 marcado como "NAO INCLUIR"
>  - 0 já em conversa ativa
> **47 leads vão receber.**
> [Cancelar] [Próximo]

**Step 2 — Escolher template**
> Dropdown com `agent_templates` ativos onde `canal=whatsapp` AND `etapa=abertura`
> filtrados pelo `segmento`/`sub_segmento` mais comum dos selecionados.
> Se houver match exato → pré-seleciona.
> Pré-visualização do conteúdo (com `{{contato_nome}}` substituído por exemplo do
> primeiro lead selecionado).

**Step 3 — Cadência**
> Radio:
>  - ☐ Disparar tudo agora (vai respeitar limite diário, restante fica enfileirado)
>  - ☐ Espalhar em N dias úteis (sugestão default 8 para 194 leads)
>  - ☐ Agendar para data específica
> Se "espalhar": preview de quantos por dia.

**Step 4 — Confirmação final**
> Resumo:
>   - Template: WhatsApp Abertura Segurança - Vigilância Patrimonial
>   - Leads que recebem: 47
>   - Cadência: 15/dia × 4 dias úteis
>   - Janela: 10h-12h e 14h-17h BRT
>   - Início: hoje 10:00
> [Cancelar] [Confirmar e Disparar]

Ao confirmar → chama `useDispararAbertura.mutate({ leadIds, templateId, modo, ... })`.

### 6.8 Hook `useDispararAbertura`

```typescript
// src/components/leads/hooks/useDispararAbertura.ts
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

interface DispararParams {
  leadIds: string[];
  templateId: string;
  modo: 'imediato' | 'agendado';
  autoAprovar?: boolean;
}

export function useDispararAbertura() {
  return useMutation({
    mutationFn: async (params: DispararParams) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.rpc('fn_disparar_abertura_em_massa', {
        p_lead_ids: params.leadIds,
        p_template_id: params.templateId,
        p_user_id: userData.user?.id,
        p_auto_aprovar: params.autoAprovar ?? true,
        p_modo: params.modo,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any[]) => {
      const criados = data.filter(d => d.status === 'criado').length;
      const bloqueados = data.filter(d => d.status === 'bloqueado').length;
      const pulados = data.filter(d => d.status === 'pulado').length;
      const dups = data.filter(d => d.status === 'duplicado').length;
      showSuccess(
        `${criados} disparos enfileirados. ` +
        (bloqueados ? `${bloqueados} bloqueados. ` : '') +
        (pulados ? `${pulados} sem telefone. ` : '') +
        (dups ? `${dups} já em conversa.` : '')
      );
    },
    onError: (e: any) => showError('Falha no disparo: ' + e.message),
  });
}
```

#### Critério de aceitação 6 (frontend)

- [ ] Filtrar segmento "Segurança" + sub-segmento "Vigilância Patrimonial" mostra exatamente 75 leads
- [ ] Toggle "Tem telefone" = true → cai para 69
- [ ] Toggle "Excluir bloqueados" = true → continua 69 (lead de teste não está em segurança)
- [ ] Selecionar todos visíveis → barra mostra "69 selecionados"
- [ ] Modal de disparo step 1 mostra "69 leads vão receber"
- [ ] Step 2 pré-seleciona o template mais relevante
- [ ] Step 3 sugere "15/dia × 5 dias úteis"
- [ ] Confirmar → criou 69 conversas + 69 mensagens aprovadas
- [ ] Lead de teste interno NUNCA aparece como criado, mesmo se selecionado por engano

---

## 7. FASE 4 — RECONFIGURAR `agent_config` E RELIGAR CRON

> **Objetivo**: religar o cron com config segura nova.
> **Tempo**: 15 min
> **Pré-requisitos**: Fases 1, 2, 3 concluídas E testadas com 5 leads de teste

### 7.1 Atualizar `admin_config.agent_config`

```sql
UPDATE public.admin_config
SET valor = '{
  "max_contatos_dia": 30,
  "horarios": [["10:00","12:00"],["14:00","17:00"]],
  "horario_inicio": "10:00",
  "horario_fim": "17:00",
  "rampa_aquecimento": [
    {"dia": 1, "max": 15},
    {"dia": 2, "max": 15},
    {"dia": 3, "max": 30}
  ],
  "auto_aprovacao": false
}'
WHERE chave = 'agent_config';
```

### 7.2 Religar pg_cron job

```sql
SELECT cron.alter_job(15, active := true);
-- Verificar:
SELECT jobid, jobname, active, schedule FROM cron.job WHERE jobid = 15;
```

> ⚠️ Se for o **primeiro disparo de teste**, deixar o cron desativado e
> processar manualmente as primeiras 5-10 mensagens com:
> ```sql
> SELECT id, conteudo FROM agent_messages
> WHERE status = 'aprovada' AND canal = 'whatsapp'
> ORDER BY created_at LIMIT 5;
> -- Para cada id, chamar whatsapp-enviar via curl ou painel
> ```

#### Critério de aceitação 7

```sql
-- Deve haver mensagens enviando após 30 min:
SELECT count(*), status FROM agent_messages
WHERE created_at > now() - interval '1 hour'
GROUP BY status;
-- Esperado: alguns 'enviada', resto 'aprovada' aguardando próxima execução do cron
```

---

## 8. FASE 5 — TESTE END-TO-END

> **Objetivo**: validar com 5 leads reais antes de disparar 194.
> **Tempo**: 30-60 min

### Roteiro

1. Junior se cadastra como lead de teste real (ou usa conhecidos que aprovaram receber)
2. Acessar `/leads`, filtrar pelos 5 leads de teste
3. Selecionar todos
4. Modal "Disparar abertura"
5. Confirmar
6. Verificar:
   - Lead recebeu mensagem? (confirmar com Junior)
   - `agent_conversations` tem 5 conversas ativas?
   - `agent_messages` 5 enviadas, 0 erro?
   - `atividades_comerciais` tem 5 entradas tipo `whatsapp`?
   - Status do lead virou `contatado`?
7. Junior responde no WhatsApp dele
8. Verificar:
   - `whatsapp-webhook` registrou a resposta?
   - `agent_conversations.mensagens_recebidas = 1`?
   - `agent_messages` tem nova entrada com `tipo='recebida'`?

#### Critério de aceitação 8

Todos os 7 pontos do roteiro retornam OK. Se algum falha, NÃO escalar para 194.

---

## 9. PENDÊNCIAS DO USUÁRIO (JUNIOR)

Antes da Fase 4, Junior precisa:

| # | Ação | Tempo | Onde |
|---|------|-------|------|
| 1 | Deletar v1 templates `croma_poste_seguranca_abertura` + `croma_poste_seguranca_followup` | 2 min | https://business.facebook.com/wa/manager |
| 2 | Confirmar nome exato dos templates v2 aprovados no Meta | 1 min | Mesma página |
| 3 | Fornecer conteúdo final (texto) dos templates v2 e ordem das variáveis | 5 min | Aqui na conversa |
| 4 | Confirmar cadência sugerida (15/d×2d → 30/d) ou ajustar | 1 min | Aqui |
| 5 | Confirmar janela 10-12 / 14-17 ou ajustar | 1 min | Aqui |

> **Bloqueio**: Fases 1.4.2, 4.1 e 6.7 dependem desses dados. Sem eles,
> Sonnet deve **parar e pedir para Junior** antes de continuar.

---

## 10. RISCOS CONHECIDOS

| Risco | Mitigação |
|---|---|
| WhatsApp Business banir o número por flood | Cadência rampada + janelas múltiplas + max 30/dia |
| Lead reclamar / opt-out | Webhook deve detectar palavras "PARE", "SAIR", "DESCADASTRAR" e marcar `observacoes += 'NAO INCLUIR'` automaticamente |
| RLS bloquear silenciosamente | Toda mutation usa `.select().single()` (regra `supabase-mutations.md`) |
| Template Meta rejeitado no envio (erro 131000) | `whatsapp-enviar` já loga erro em `agent_messages.erro_mensagem` |
| Lead de teste interno disparado por engano | Triplo bloqueio: view, RPC, edge function |
| Cron disparar fora da janela | v21 valida em runtime, retorna 429 |

---

## 11. ARQUIVOS A ATUALIZAR NO VAULT (FIM DA EXECUÇÃO)

```
C:\Users\Caldera\Obsidian\JARVIS\
  ├── 99-Meta\memory.md                    (bloco da sessão no topo)
  ├── 01-Daily\YYYY-MM-DD.md               (daily note)
  └── 10-Projetos\Croma-Print\
      ├── decisoes\YYYY-MM-DD-disparos-prospeccao.md
      └── aprendizados\YYYY-MM-DD-aprendizados-prospeccao.md
```

E:

```
C:\Users\Caldera\Claude\CRM-Croma\.planning\STATE.md  (atualizar)
```

---

## 12. SEQUÊNCIA DE EXECUÇÃO RESUMIDA

```
1. Junior fornece conteúdo dos templates v2 e nome no Meta              [BLOQUEIO]
2. Sonnet executa Fase 1 (3 migrations)                                  [1-2h]
   └─ Critério: queries SQL retornam o esperado
3. Sonnet executa Fase 2 (deploy edge functions)                         [1h]
   └─ Critério: smoke test com curl funciona
4. Sonnet executa Fase 3 (frontend)                                      [3-5h]
   └─ Critério: manual UI test passa
5. Sonnet executa Fase 4 (config + cron)                                 [15min]
   └─ Cron permanece DESATIVADO até Fase 5 passar
6. Junior + Sonnet executam Fase 5 (teste E2E com 5 leads)               [30-60min]
   └─ Critério: 7 pontos do roteiro OK
7. Junior libera disparo dos 194 — modal de confirmação                  [1 click]
8. Sonnet ativa cron, dispara monitoramento                              [imediato]
9. Atualizar Obsidian + STATE.md                                         [10 min]
```

---

## 13. REFERÊNCIAS

- Sessão prévia que criou os templates Meta: `Obsidian → 99-Meta/memory.md` bloco `2026-05-04G`
- Sessão atual (este plano): bloco `2026-05-04H` (a ser criado pelo Sonnet ao final)
- Regras do projeto:
  - `CRM-Croma/.claude/rules/supabase-mutations.md` — `.select().single()` obrigatório
  - `CRM-Croma/.claude/rules/alert-dialog-async.md` — `e.preventDefault()` em modais
  - `CRM-Croma/.claude/rules/agent-vendas-coleta-dados.md` — coleta antes de orçar
  - `JARVIS/.claude/rules/anti-alucinacao.md` — sempre consultar fonte real
- Lead bloqueado para disparo: `0339d969-29d4-4eea-accb-70a27dbee4ca`

---

**FIM DO PLANO. Boa execução, Sonnet.**
