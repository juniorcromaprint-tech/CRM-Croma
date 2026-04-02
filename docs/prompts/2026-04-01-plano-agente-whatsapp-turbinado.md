# PLANO: Agente de Vendas WhatsApp — Turbinar para 100% Funcional

> **Data**: 2026-04-01 | **Executor**: CLI (Sonnet) | **Revisor**: Cowork (Opus)
> **Prioridade**: MÁXIMA — este é o módulo comercial principal da empresa

---

## DIAGNÓSTICO (estado atual)

### ✅ O que funciona
- `whatsapp-webhook` v15 recebe mensagens da Meta e auto-responde com Claude (Sonnet 4 via OpenRouter)
- `ai-gerar-orcamento` cria propostas reais no CRM com preços do banco (motor Mubisys)
- Coleta de dados cadastrais implementada (nome, email, empresa, cidade)
- Envio de WhatsApp pela Meta Cloud API funcionando (v10 corrigiu auth 401)
- 2 propostas geradas pela IA com sucesso (PROP-0007 R$469, PROP-0008 R$75)
- Telegram Bot Token hardcoded e funcionando no webhook

### 🔴 PROBLEMAS CRÍTICOS

| # | Problema | Impacto | Arquivo |
|---|---------|---------|---------|
| **P1** | `agent-cron-loop` retorna 500 em TODAS execuções (últimas 24h+) | Motor de automação inteiro parado: cobranças, follow-ups, alertas, resumo diário — NADA funciona | `supabase/functions/agent-cron-loop/index.ts` |
| **P2** | `ai-decidir-acao` retorna 401 — tem `verify_jwt: true` mas cron-loop chama via `supabase.functions.invoke()` que NÃO passa JWT de usuário | Follow-ups de leads não executam, cascateia erro no cron-loop | `supabase/functions/ai-decidir-acao/index.ts` |
| **P3** | `ai-compor-mensagem` tem `verify_jwt: true` — mesmo problema quando chamado pelo cron-loop | Composição de mensagens automáticas falha | `supabase/functions/ai-compor-mensagem/index.ts` |
| **P4** | `agent-enviar-email` tem `verify_jwt: true` — idem | Envio de emails de cobrança pelo cron falha | `supabase/functions/agent-enviar-email/index.ts` |
| **P5** | `TELEGRAM_BOT_TOKEN` não está em `Deno.env` — cron-loop lê de env var que está vazia | Alertas Telegram do cron-loop não enviam (webhook funciona pois tem token hardcoded) | `supabase/functions/agent-cron-loop/index.ts` linha 52 |
| **P6** | `OPENROUTER_API_KEY` não confirmado em env vars — Edge Functions leem da `admin_config` | Funciona mas é frágil; funções que usam `Deno.env.get('OPENROUTER_API_KEY')` podem falhar | Todas as funções `ai-*` |
| **P7** | Templates do banco nunca foram usados (`vezes_usado = 0` em todos os 17) | O agente compõe tudo via Claude, desperdiça os templates optimizados | Lógica de composição |
| **P8** | `sendCobrancaEmail` no cron-loop busca chave `smtp_config` mas NÃO existe — temos chaves separadas: `smtp_host`, `smtp_port`, `smtp_user`, `smtp_password` | Emails de cobrança automática NUNCA enviam | `agent-cron-loop/index.ts` linhas 548-556 |
| **P9** | Nenhuma regra do cron-loop tem `modulo` preenchido no campo `condicao` — o `evaluateRule()` faz `cond.campo?.split('.')[0]` para obter a tabela, mas as regras legadas (Follow-up lead 3d, 7d, etc.) não têm campo `condicao` estruturado | Regras legadas (com tipo `follow_up`, `alerta`, `cobranca`, `transicao`, `automatica`) caem no `default` do switch e retornam `[]` | `agent-cron-loop/index.ts` linhas 236-379 |
| **P10** | Telegram Bot Token EXPOSTO em texto plano no código fonte do webhook | Risco de segurança — qualquer pessoa com acesso ao repo pode usar o bot | `whatsapp-webhook/index.ts` linha 20 |

### 🟡 MELHORIAS NECESSÁRIAS

| # | Melhoria | Benefício |
|---|---------|-----------|
| **M1** | Migrar model de `openai/gpt-4.1-mini` para `anthropic/claude-sonnet-4` no `ai-gerar-orcamento` (extração) | Melhor qualidade de extração de specs, coerência com o resto do sistema |
| **M2** | Envio proativo de WhatsApp para follow-ups (não só email) — usar templates Meta aprovados | Alcançar leads onde eles estão (WhatsApp >> email) |
| **M3** | Verificar se templates Meta (croma_proposta, croma_cobranca, croma_reativacao) foram aprovados | Habilitar envio proativo de WhatsApp |
| **M4** | Melhorar system prompt do agente — adicionar tabela de preços de referência para respostas mais informadas | Cliente recebe range de preço na conversa antes do orçamento formal |
| **M5** | Implementar status `lida` e `entregue` via webhook de status da Meta | Métricas reais de engajamento |
| **M6** | Dashboard de métricas do agente WhatsApp (mensagens/dia, tempo resposta, taxa conversão) | Visibilidade para o Junior |

---

## PLANO DE EXECUÇÃO — 4 LOTES

### LOTE 1: DESBLOQUEIO CRÍTICO (cron-loop + auth)
> **Objetivo**: Fazer o motor de automação voltar a funcionar

#### Task 1.1 — Corrigir `verify_jwt` das funções chamadas pelo cron

**O problema**: `agent-cron-loop` (que roda via pg_cron sem user session) chama estas funções que exigem JWT:
- `ai-decidir-acao` (verify_jwt: true) → 401
- `ai-compor-mensagem` (verify_jwt: true) → 401
- `agent-enviar-email` (verify_jwt: true) → 401

**A solução**: Mudar `verify_jwt` para `false` nestas 3 funções e adicionar validação INTERNA — aceitar tanto JWT de user quanto service_role_key.

**Implementação**:

```
# Re-deployar com verify_jwt: false
# ATENÇÃO: usar flag --no-verify-jwt no deploy

Para cada função (ai-decidir-acao, ai-compor-mensagem, agent-enviar-email):

1. No INÍCIO do handler, ANTES de qualquer lógica:
   - Tentar extrair user do JWT (como já faz)
   - Se não tem JWT OU JWT inválido → verificar se veio via service_role (header Authorization com service_role_key)
   - Se nenhum dos dois → retornar 401

   Código padrão:
   ```ts
   // Auth: accept user JWT OR service_role (for cron/internal calls)
   const authHeader = req.headers.get('Authorization');
   const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

   let isAuthorized = false;
   let userId: string | null = null;

   if (authHeader?.startsWith('Bearer ')) {
     const token = authHeader.replace('Bearer ', '');
     // Check if it's the service_role_key (internal call)
     if (token === SERVICE_ROLE_KEY) {
       isAuthorized = true;
     } else {
       // Try user JWT
       const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
       const { data: { user } } = await supabaseAuth.auth.getUser(token);
       if (user) {
         isAuthorized = true;
         userId = user.id;
       }
     }
   }

   if (!isAuthorized) {
     return jsonResponse({ error: 'Unauthorized' }, 401);
   }
   ```

2. Deploy com: `supabase functions deploy <function-name> --no-verify-jwt`
```

**Arquivos a alterar**:
- `supabase/functions/ai-decidir-acao/index.ts` — linhas 105-120 (substituir bloco auth)
- `supabase/functions/ai-compor-mensagem/index.ts` — localizar bloco auth equivalente
- `supabase/functions/agent-enviar-email/index.ts` — localizar bloco auth equivalente

**Deploy**: Todas 3 funções precisam ser re-deployadas com `--no-verify-jwt`

#### Task 1.2 — Corrigir TELEGRAM_BOT_TOKEN no cron-loop

**O problema**: Linha 52 lê `Deno.env.get('TELEGRAM_BOT_TOKEN')` que retorna `''` (não está como env var do Supabase).

**Duas opções** (escolher UMA):

**Opção A (recomendada)**: Ler da `admin_config` como fallback (padrão já usado no webhook):
```ts
// Linha 52-53 do agent-cron-loop/index.ts — SUBSTITUIR:
// DE:
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';

// PARA:
let TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';

// Dentro do handler, após criar supabase client (antes da lógica):
if (!TELEGRAM_BOT_TOKEN) {
  const { data: tgConfig } = await supabase
    .from('admin_config')
    .select('valor')
    .eq('chave', 'TELEGRAM_BOT_TOKEN')
    .single();
  TELEGRAM_BOT_TOKEN = tgConfig?.valor ?? '';
}
```

Mas ANTES, inserir o token no `admin_config`:
```sql
INSERT INTO admin_config (chave, valor)
VALUES ('TELEGRAM_BOT_TOKEN', '8750164337:AAH8Diet4zGJddKHq_F2F1JobUA2djisU8s')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;
```

**Opção B**: Adicionar como Supabase Secret via CLI:
```bash
supabase secrets set TELEGRAM_BOT_TOKEN=8750164337:AAH8Diet4zGJddKHq_F2F1JobUA2djisU8s --project-ref djwjmfgplnqyffdcgdaw
```

**NOTA DE SEGURANÇA** (P10): O token está exposto no código fonte do `whatsapp-webhook/index.ts` linha 20. Depois de salvar no `admin_config` ou como secret, o webhook também deve ser atualizado para ler da mesma fonte (admin_config ou env). Mas isso é Lote 3.

#### Task 1.3 — Corrigir `sendCobrancaEmail` (chave SMTP errada)

**O problema**: Linha 549-553 busca `admin_config` com `chave = 'smtp_config'` mas no banco as chaves são separadas: `smtp_host`, `smtp_port`, `smtp_user`, `smtp_password`.

**Correção**: No `agent-cron-loop/index.ts`, função `sendCobrancaEmail` (linhas 547-577):

```ts
// SUBSTITUIR sendCobrancaEmail inteiro:
async function sendCobrancaEmail(supabase: SupabaseClient, match: any, mensagem: string, nivel: number): Promise<void> {
  if (!match.email) return;

  const assunto = nivel <= 2
    ? `Lembrete de pagamento — Croma Print`
    : `Aviso de título em aberto — Croma Print`;

  // Usar agent-enviar-email que já tem lógica de envio via Resend
  try {
    // Criar mensagem no sistema para ser enviada
    const { data: msg, error: msgErr } = await supabase
      .from('agent_messages')
      .insert({
        conversation_id: null, // cobrança avulsa
        direcao: 'enviada',
        canal: 'email',
        conteudo: mensagem,
        assunto: assunto,
        status: 'aprovada', // auto-aprovada (cobrança automática)
        aprovado_em: new Date().toISOString(),
        metadata: {
          tipo: 'cobranca_automatica',
          nivel,
          cliente_id: match.cliente_id,
          conta_receber_id: match.id,
          destinatario: match.email,
        },
      })
      .select()
      .single();

    if (msgErr || !msg) {
      console.error('Erro ao criar msg cobrança:', msgErr?.message);
      return;
    }

    // Invocar agent-enviar-email
    await supabase.functions.invoke('agent-enviar-email', {
      body: { message_id: msg.id },
    });
  } catch (emailErr) {
    console.error(`Erro ao enviar email cobrança: ${(emailErr as Error).message}`);
  }
}
```

**NOTA**: Isso depende da Task 1.1 estar concluída (agent-enviar-email aceitar service_role).

#### Task 1.4 — Corrigir regras legadas que caem no `default` do switch

**O problema**: As regras com nomes como "Resumo diario", "Follow-up lead 3d", "Follow-up lead 7d", "Follow-up proposta 2d", "Alerta estoque minimo", "Alerta instalacao pendente", "Cobrança D+1/3/7/15/30", "PCP sequenciamento", "Detectar pagamentos vencidos", "Alerta OP atrasada", "Transicao producao instalacao" NÃO têm case no switch de `evaluateRule()`. O switch só mapeia nomes tipo `cobranca_d1`, `op_atrasada`, etc.

**Tem 31 regras no banco mas o switch só cobre ~14 nomes**. As outras 17 caem no `default → return []`.

**Correção**: Adicionar aliases no switch para os nomes legados, OU unificar os nomes no banco.

**Opção recomendada**: Normalizar os nomes no banco para coincidir com o switch. Executar SQL:

```sql
-- Mapear nomes legados para os nomes que o switch reconhece
UPDATE agent_rules SET nome = 'cobranca_d1' WHERE nome = 'Cobrança D+1';
UPDATE agent_rules SET nome = 'cobranca_d3' WHERE nome = 'Cobrança D+3';
UPDATE agent_rules SET nome = 'cobranca_d7' WHERE nome = 'Cobrança D+7';
UPDATE agent_rules SET nome = 'cobranca_d15_alerta_junior' WHERE nome = 'Cobrança D+15';
UPDATE agent_rules SET nome = 'cobranca_d30_suspensao' WHERE nome = 'Cobrança D+30';
UPDATE agent_rules SET nome = 'op_atrasada' WHERE nome = 'Alerta OP atrasada';
UPDATE agent_rules SET nome = 'estoque_minimo' WHERE nome = 'Alerta estoque minimo';

-- Regras que são follow-ups legados — apontar para os nomes do switch
UPDATE agent_rules SET nome = 'follow_up_lead_24h' WHERE nome = 'Follow-up lead 3d' AND tipo = 'follow_up';
UPDATE agent_rules SET nome = 'follow_up_lead_24h' WHERE nome = 'Follow-up lead 7d' AND tipo = 'follow_up';
UPDATE agent_rules SET nome = 'follow_up_proposta_48h' WHERE nome = 'Follow-up proposta 2d' AND tipo = 'follow_up';
UPDATE agent_rules SET nome = 'notificar_equipe_campo' WHERE nome = 'Alerta instalacao pendente';
```

**MELHOR ABORDAGEM**: Em vez de renomear, desativar as regras legadas DUPLICADAS e manter só as que o switch reconhece:

```sql
-- Desativar regras legadas que são duplicatas das regras mapeadas no switch
UPDATE agent_rules SET ativo = false
WHERE nome IN (
  'Cobrança D+1', 'Cobrança D+3', 'Cobrança D+7', 'Cobrança D+15', 'Cobrança D+30',
  'Alerta OP atrasada', 'Alerta estoque minimo', 'Alerta instalacao pendente',
  'Follow-up lead 3d', 'Follow-up lead 7d', 'Follow-up proposta 2d',
  'Transicao producao instalacao', 'PCP sequenciamento', 'Detectar pagamentos vencidos'
);

-- Verificar: devem restar ~17 regras ativas (as que TÊM case no switch)
SELECT nome, ativo FROM agent_rules ORDER BY nome;
```

Também adicionar case para `Resumo diario` no switch:
```ts
case 'Resumo diario':
  // O resumo é processado no ciclo noturno, não aqui
  return [];
```

#### Task 1.5 — Re-deploy do agent-cron-loop

Após todas as correções acima, deploy:
```bash
supabase functions deploy agent-cron-loop --no-verify-jwt --project-ref djwjmfgplnqyffdcgdaw
```

**Validação**: Chamar manualmente e verificar que retorna 200:
```bash
curl -X POST https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/agent-cron-loop \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json"
```

---

### LOTE 2: ROBUSTEZ DO WEBHOOK (recepção + resposta)
> **Objetivo**: Webhook WhatsApp mais robusto e seguro

#### Task 2.1 — Remover tokens hardcoded do webhook

**Arquivo**: `supabase/functions/whatsapp-webhook/index.ts`

Substituir linhas 20-22:
```ts
// DE:
const TELEGRAM_BOT_TOKEN = '8750164337:AAH8Diet4zGJddKHq_F2F1JobUA2djisU8s';
const JUNIOR_CHAT_ID = '1065519625';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// PARA:
let _telegramToken: string | null = null;
const JUNIOR_CHAT_ID = '1065519625';

async function getTelegramToken(supabase: ReturnType<typeof getServiceClient>): Promise<string> {
  if (_telegramToken) return _telegramToken;
  _telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
  if (!_telegramToken) {
    const { data } = await supabase
      .from('admin_config')
      .select('valor')
      .eq('chave', 'TELEGRAM_BOT_TOKEN')
      .single();
    _telegramToken = data?.valor ?? '';
  }
  return _telegramToken;
}
```

E atualizar `notifyTelegram` para receber supabase e usar `getTelegramToken()`.

#### Task 2.2 — Implementar webhook de status (delivery receipts)

A Meta envia status updates (sent, delivered, read) no mesmo webhook. O código atual IGNORA esses eventos.

**No handler principal do webhook**, após processar `entry.changes[].value.messages`, adicionar processamento de `entry.changes[].value.statuses`:

```ts
// Processar status updates (delivered, read)
const statuses = value.statuses ?? [];
for (const status of statuses) {
  const waMessageId = status.id;
  const statusType = status.status; // 'sent' | 'delivered' | 'read' | 'failed'

  // Buscar mensagem pelo whatsapp_message_id nos metadata
  const { data: msgs } = await supabase
    .from('agent_messages')
    .select('id, status')
    .contains('metadata', { whatsapp_message_id: waMessageId })
    .limit(1);

  if (msgs && msgs.length > 0) {
    const msg = msgs[0];
    const newStatus = statusType === 'read' ? 'lida'
      : statusType === 'delivered' ? 'entregue'
      : statusType === 'failed' ? 'erro'
      : msg.status; // keep current for 'sent'

    const updateData: Record<string, any> = { status: newStatus };
    if (statusType === 'read') updateData.lido_em = new Date().toISOString();
    if (statusType === 'failed') updateData.erro_mensagem = status.errors?.[0]?.message ?? 'Delivery failed';

    await supabase.from('agent_messages').update(updateData).eq('id', msg.id);
  }
}
```

#### Task 2.3 — Melhorar system prompt com faixas de preço

Adicionar ao `buildCromaSystemPrompt()`, dentro da seção CATÁLOGO:

```ts
## FAIXAS DE PREÇO (referência — orçamento formal será calculado pelo sistema)
- Banners: a partir de R$ 25/m² (lona 280g) até R$ 55/m² (lona 440g frontlit)
- Adesivos: a partir de R$ 35/m² (vinil comum) até R$ 120/m² (perfurado)
- Fachadas ACM: a partir de R$ 450/m² (projeto completo com instalação)
- Placas PVC: a partir de R$ 90/m² | PS: R$ 80/m² | ACM: R$ 280/m²
- Letras caixa: a partir de R$ 85/letra (galvanizada 20cm)
- Cavaletes: R$ 120 (P madeira) a R$ 350 (G metálico)
- ATENÇÃO: estes são valores de REFERÊNCIA. O orçamento formal terá o preço exato calculado pelo sistema.
```

**NOTA**: Verificar preços reais no banco antes de colocar. Consultar via MCP:
```
croma_listar_materiais + croma_listar_regras_precificacao
```

#### Task 2.4 — Deploy do webhook atualizado

```bash
supabase functions deploy whatsapp-webhook --no-verify-jwt --project-ref djwjmfgplnqyffdcgdaw
```

---

### LOTE 3: FOLLOW-UPS INTELIGENTES
> **Objetivo**: Follow-ups automáticos que realmente enviam mensagens

#### Task 3.1 — Reescrever `processLeadFollowUps` no cron-loop

A função atual (linhas 752-835) depende de `ai-decidir-acao` + `ai-compor-mensagem` em cadeia, que é frágil. Simplificar para lógica direta:

```ts
async function processLeadFollowUps(supabase: SupabaseClient, config: any): Promise<any> {
  try {
    // 1. Buscar conversas ativas com follow-up agendado para agora ou no passado
    const { data: convs } = await supabase
      .from('agent_conversations')
      .select(`
        id, lead_id, canal, etapa, status, tentativas, max_tentativas,
        score_engajamento, auto_aprovacao, proximo_followup,
        leads!inner(id, contato_nome, empresa, email, telefone, temperatura, status, segmento)
      `)
      .eq('status', 'ativa')
      .lte('proximo_followup', new Date().toISOString())
      .order('proximo_followup', { ascending: true })
      .limit(config.max_contatos_dia ?? 20);

    if (!convs || convs.length === 0) return { status: 'ok', total: 0, enviadas: 0 };

    let enviadas = 0;

    for (const conv of convs) {
      if (enviadas >= (config.max_contatos_dia ?? 20)) break;
      if (!conv.leads) continue;

      // Verificar se já atingiu máximo de tentativas
      if (conv.tentativas >= (conv.max_tentativas || config.max_tentativas || 5)) {
        await supabase.from('agent_conversations').update({
          status: 'encerrada',
          metadata: { motivo: 'max_tentativas' },
        }).eq('id', conv.id);
        continue;
      }

      try {
        // Compor mensagem via ai-compor-mensagem
        const { data: msgResult, error: msgError } = await supabase.functions.invoke(
          'ai-compor-mensagem',
          { body: { lead_id: conv.lead_id, canal: conv.canal, etapa: conv.etapa } }
        );
        if (msgError || !msgResult?.message_id) continue;

        // Auto-aprovar se configurado e lead frio/morno
        const autoApprove = conv.auto_aprovacao === true;
        if (autoApprove) {
          await supabase.from('agent_messages').update({
            status: 'aprovada',
            aprovado_em: new Date().toISOString(),
            metadata: { auto_aprovado: true, motivo: 'followup_automatico' },
          }).eq('id', msgResult.message_id);

          // Enviar
          const dispatchFn = conv.canal === 'whatsapp' ? 'whatsapp-enviar' : 'agent-enviar-email';
          await supabase.functions.invoke(dispatchFn, { body: { message_id: msgResult.message_id } });
          enviadas++;
        }

        // Atualizar próximo follow-up
        const diasFollowup = config.dias_entre_followup ?? 3;
        const proxFollowup = new Date();
        proxFollowup.setDate(proxFollowup.getDate() + diasFollowup);

        await supabase.from('agent_conversations').update({
          tentativas: (conv.tentativas ?? 0) + 1,
          proximo_followup: proxFollowup.toISOString(),
          etapa: nextEtapa(conv.etapa),
        }).eq('id', conv.id);
      } catch (err) {
        console.error(`Follow-up error conv ${conv.id}:`, (err as Error).message);
      }
    }

    return { status: 'ok', total: convs.length, enviadas };
  } catch (err) {
    return { status: 'error', motivo: (err as Error).message };
  }
}

function nextEtapa(current: string): string {
  const progression: Record<string, string> = {
    'abertura': 'followup1',
    'followup1': 'followup2',
    'followup2': 'followup3',
    'followup3': 'reengajamento',
    'reengajamento': 'reengajamento', // para aqui
    'proposta': 'negociacao',
    'negociacao': 'negociacao',
  };
  return progression[current] ?? current;
}
```

#### Task 3.2 — Verificar status dos templates Meta WhatsApp

Os 3 templates (croma_proposta, croma_cobranca, croma_reativacao) foram submetidos em 01/04. Precisamos verificar se foram aprovados.

**Ação**: Verificar no Meta Business Suite (business.facebook.com) → WhatsApp Manager → Message Templates.

Se aprovados → atualizar `admin_config` com os nomes:
```sql
INSERT INTO admin_config (chave, valor) VALUES
('WHATSAPP_TEMPLATE_PROPOSTA', 'croma_proposta'),
('WHATSAPP_TEMPLATE_COBRANCA', 'croma_cobranca'),
('WHATSAPP_TEMPLATE_REATIVACAO', 'croma_reativacao')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;
```

Se rejeitados → resubmeter com ajustes.

#### Task 3.3 — Implementar envio proativo via template WhatsApp

Atualmente a cobrança D1/D2 tenta enviar WhatsApp mas faz fallback para email (linhas 512-523 do cron-loop). Com templates aprovados, implementar envio real:

```ts
// Na executeCobranca, quando canal === 'whatsapp':
if (canal === 'whatsapp' && match.telefone) {
  // Verificar se há template aprovado para cobrança
  const { data: templateConfig } = await supabase
    .from('admin_config')
    .select('valor')
    .eq('chave', 'WHATSAPP_TEMPLATE_COBRANCA')
    .single();

  if (templateConfig?.valor) {
    // Enviar template message via Meta API
    await sendWhatsAppTemplate(supabase, match.telefone, templateConfig.valor, {
      '1': match.cliente_nome,
      '2': formatBRL(match.saldo ?? match.valor_original),
      '3': formatDate(match.data_vencimento),
    });
  } else {
    // Fallback: enviar por email
    if (match.email) await sendCobrancaEmail(supabase, match, mensagem, nivel);
  }
}
```

E criar `sendWhatsAppTemplate()` helper no cron-loop:

```ts
async function sendWhatsAppTemplate(
  supabase: SupabaseClient,
  toPhone: string,
  templateName: string,
  params: Record<string, string>
): Promise<boolean> {
  const keys = ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_API_VERSION'];
  const { data: configs } = await supabase
    .from('admin_config')
    .select('chave, valor')
    .in('chave', keys);

  const cfg: Record<string, string> = {};
  for (const c of configs ?? []) cfg[c.chave] = c.valor;

  const token = cfg['WHATSAPP_ACCESS_TOKEN'];
  const phoneId = cfg['WHATSAPP_PHONE_NUMBER_ID'];
  const apiVersion = cfg['WHATSAPP_API_VERSION'] || 'v22.0';
  if (!token || !phoneId) return false;

  const components = Object.entries(params).map(([key, value]) => ({
    type: 'body',
    parameters: [{ type: 'text', text: value }],
  }));

  const resp = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneId}/messages`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'template',
        template: { name: templateName, language: { code: 'pt_BR' }, components },
      }),
    }
  );
  return resp.ok;
}
```

---

### LOTE 4: VALIDAÇÃO E DEPLOY
> **Objetivo**: Garantir que tudo funciona de ponta a ponta

#### Task 4.1 — Teste E2E do cron-loop

Após deploy de todas as funções corrigidas, executar o cron-loop manualmente:
```bash
curl -X POST https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/agent-cron-loop \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json"
```

**Verificar**:
- [ ] Retorna 200 (não 500)
- [ ] `regras.processadas` > 0
- [ ] `regras.total_matches` ≥ 0 (pode ser 0 se não houver matches no momento)
- [ ] `regras.detalhes` mostra cada regra sem errors
- [ ] `followups` retorna status (não error)
- [ ] Se há cobranças vencidas → verifica que registrou em `cobranca_automatica`

#### Task 4.2 — Teste E2E do webhook WhatsApp

Enviar mensagem de teste pelo WhatsApp para +55 11 93947-1862.

**Verificar**:
- [ ] Mensagem aparece em `agent_messages` com `direcao = 'recebida'`
- [ ] Resposta automática é enviada pelo WhatsApp
- [ ] Telegram do Junior recebe notificação
- [ ] Se pedir orçamento → `ai-gerar-orcamento` cria proposta no CRM

#### Task 4.3 — Verificar logs no Supabase

Após 30-60min, verificar que o cron-loop executou com sucesso:
- Dashboard Supabase → Edge Functions → Logs
- `agent-cron-loop` deve mostrar 200 (não mais 500)
- `ai-decidir-acao` deve mostrar 200 (não mais 401)

#### Task 4.4 — Commit e deploy

```bash
git add -A
git commit -m "fix(agent): desbloqueio cron-loop + robustez webhook WhatsApp

- Fix verify_jwt em ai-decidir-acao, ai-compor-mensagem, agent-enviar-email
  para aceitar service_role (chamadas internas do cron)
- Fix TELEGRAM_BOT_TOKEN no cron-loop (ler da admin_config)
- Fix sendCobrancaEmail (usar agent-enviar-email ao invés de SMTP direto)
- Desativar regras legadas duplicadas no banco
- Remover tokens hardcoded do webhook
- Implementar delivery receipts (status: entregue, lida)
- Melhorar system prompt com faixas de preço
- Reescrever processLeadFollowUps (sem dependência do ai-decidir-acao)
- Implementar envio proativo via template WhatsApp

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

git push origin main
```

Deploy das Edge Functions:
```bash
supabase functions deploy agent-cron-loop --no-verify-jwt --project-ref djwjmfgplnqyffdcgdaw
supabase functions deploy ai-decidir-acao --no-verify-jwt --project-ref djwjmfgplnqyffdcgdaw
supabase functions deploy ai-compor-mensagem --no-verify-jwt --project-ref djwjmfgplnqyffdcgdaw
supabase functions deploy agent-enviar-email --no-verify-jwt --project-ref djwjmfgplnqyffdcgdaw
supabase functions deploy whatsapp-webhook --no-verify-jwt --project-ref djwjmfgplnqyffdcgdaw
```

---

## ORDEM DE EXECUÇÃO (OBRIGATÓRIA)

```
LOTE 1 (CRÍTICO — fazer primeiro):
  1.1 → 1.2 → 1.3 → 1.4 → 1.5 (deploy cron-loop + 3 funções auth)

LOTE 2 (WEBHOOK):
  2.1 → 2.2 → 2.3 → 2.4 (deploy webhook)

LOTE 3 (FOLLOW-UPS):
  3.1 → 3.2 → 3.3 (deploy cron-loop novamente com follow-ups)

LOTE 4 (VALIDAÇÃO):
  4.1 → 4.2 → 4.3 → 4.4 (testes + commit)
```

## ARQUIVOS TOCADOS (resumo)

| Arquivo | Lote | Alteração |
|---------|------|-----------|
| `supabase/functions/agent-cron-loop/index.ts` | 1,3 | Fix TELEGRAM, fix sendCobrancaEmail, rewrite processLeadFollowUps, add WhatsApp template sender |
| `supabase/functions/ai-decidir-acao/index.ts` | 1 | Auth: aceitar service_role + JWT |
| `supabase/functions/ai-compor-mensagem/index.ts` | 1 | Auth: aceitar service_role + JWT |
| `supabase/functions/agent-enviar-email/index.ts` | 1 | Auth: aceitar service_role + JWT |
| `supabase/functions/whatsapp-webhook/index.ts` | 2 | Remover tokens hardcoded, add delivery receipts, melhorar prompt |
| **Banco (SQL)** | 1,3 | Insert TELEGRAM_BOT_TOKEN, desativar regras duplicadas, insert template names |

## REGRAS DO PROJETO (lembrete para o CLI)

- Todo `.insert()` e `.update()` DEVE usar `.select().single()` para detectar RLS
- Toda mutation em `AlertDialogAction` DEVE usar `e.preventDefault()`
- Dados PIX: CNPJ 18.923.994/0001-83 | Email: junior@cromaprint.com.br
- Coletar dados cadastrais (nome, email, empresa, cidade) ANTES de gerar orçamento
- Nunca inventar preços — SEMPRE consultar banco
