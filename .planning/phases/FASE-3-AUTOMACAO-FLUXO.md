# FASE 3 — Automação de Fluxo

> **Objetivo**: Eliminar 100% das ações manuais repetitivas de cobrança, planejamento de produção e transição entre etapas do pedido.
> **Estimativa**: 5-7 dias de desenvolvimento
> **Pré-requisitos**: Fases 1 e 2 concluídas (infra + agente de vendas)
> **Criado**: 2026-03-31

---

## Diagnóstico — O que existe hoje

### Infraestrutura já construída (Fase 1)

| Componente | Status | Detalhes |
|---|---|---|
| `cobranca_automatica` (tabela) | ✅ Existe | 11 colunas: conta_receber_id, cliente_id, nivel, canal, mensagem, status, dias_atraso, enviado_em, erro_mensagem |
| `agent_rules` (15 regras ativas) | ✅ Seedadas | 5 financeiro (D1/D3/D7/D15/D30), 4 comercial (desconto/lead quente/follow-up), 2 estoque, 2 produção, 1 instalação, 1 limite |
| `system_events` (tabela) | ✅ Existe | event_type, entity_type, entity_id, payload (JSONB), processed (boolean) |
| `contas_receber` (tabela) | ✅ Completa | valor_original, saldo, data_vencimento, data_pagamento, status, forma_pagamento, version |
| `ordens_producao` | ✅ Completa | maquina_id, setor_atual_id, prioridade, data_inicio_prevista, data_fim_prevista, restricao_financeira, tempo_estimado/real |
| `producao_etapas` | ✅ Completa | ordem_producao_id, setor_id, template_id, ordem, status, tempo_estimado/real, inicio/fim |
| `setores_producao` (6 setores) | ✅ Seedados | Criação→Impressão→Router/Corte→Acabamento→Serralheria→Expedição (com capacidade_diaria_min) |
| `maquinas` (6 ativas) | ✅ Seedadas | HP Latex 365, Impressora Solvente, Laminadora, Plotter Recorte, Router CNC, Solda Banner |
| `ordens_instalacao` | ✅ Completa | pedido_id, cliente_id, data_agendada, hora_prevista, endereco_completo, equipe_id |

### Triggers já ativos

| Trigger | Tabela | Função |
|---|---|---|
| `trg_op_finalizada_transicao` | ordens_producao | Quando OP finaliza → verifica se requer instalação → cria OI ou marca pronto_entrega |
| `trg_auto_criar_ordem_instalacao` | system_events | Quando event_type = production_completed → cria OI automática |
| `fn_check_production_completed` | producao_etapas | Quando todas etapas concluídas → marca OP concluída → emite system_event |
| `tr_etapa_concluida_avanca_op` | producao_etapas | Etapa concluída → avança para próxima etapa |
| `trg_auto_reserva_op` | ordens_producao | INSERT/UPDATE → reserva estoque automaticamente |
| `trg_auto_baixa_producao` | ordens_producao | UPDATE → baixa estoque ao concluir produção |
| `trg_pedido_aprovado_cria_op` | pedidos | Pedido aprovado → cria OP automaticamente |
| `trg_auto_contas_receber` | pedidos | Pedido concluído → gera contas a receber |
| `trg_comissao_auto` | pedidos | Pedido concluído → calcula comissão |
| `trg_payment_received` | contas_receber | Pagamento registrado → emite system_event |
| `trg_sync_pagamento_pedido` | contas_receber | Pagamento → sincroniza status do pedido |
| `trg_instalacao_concluida_financeiro` | ordens_instalacao | Instalação concluída → atualiza financeiro |

### O que FALTA — a "camada de execução"

As regras (`agent_rules`) e as tabelas existem, mas **ninguém as lê e executa**. Junior faz tudo manualmente hoje. Falta:

1. **Motor de execução de regras** — Edge Function (cron job) que varre `agent_rules`, avalia condições contra o banco, e executa ações
2. **Execução real de cobrança** — enviar WhatsApp/email/Telegram conforme o nível de escalonamento
3. **Rastreamento de cobrança** — registrar em `cobranca_automatica` para não duplicar envios
4. **PCP inteligente** — sequenciamento automático de OPs com base em prazo, prioridade e capacidade das máquinas
5. **Dashboard de acompanhamento** — visibilidade no ERP de tudo que a automação está fazendo

---

## Entrega 3.1 — Motor de Execução de Regras (agent-cron-loop)

### Conceito

Uma Edge Function (`agent-cron-loop`) que roda a cada 30 minutos via cron externo (ou invocação manual). Ela:

1. Lê todas as `agent_rules` ativas
2. Para cada regra, monta e executa a query SQL da condição
3. Para cada registro que casa com a condição, executa a ação correspondente
4. Registra tudo em `system_events` para auditoria

### Arquitetura

```
┌─────────────────────────────────────────────────┐
│              agent-cron-loop                     │
│              (Edge Function)                     │
│                                                  │
│  1. SELECT * FROM agent_rules WHERE ativo=true   │
│  2. Para cada rule:                              │
│     a. Montar query de condição                  │
│     b. Executar query → registros afetados       │
│     c. Para cada registro:                       │
│        - Verificar se já processado (dedup)      │
│        - Executar ação (dispatch por tipo)        │
│        - Registrar em system_events              │
│  3. Atualizar last_run na rule                   │
└───────┬──────────┬───────────┬───────────────────┘
        │          │           │
        ▼          ▼           ▼
   WhatsApp    Email SMTP   Telegram Bot
   (webhook)   (nodemailer)  (Bot API)
```

### Implementação detalhada

#### Arquivo: `supabase/functions/agent-cron-loop/index.ts`

```typescript
// Pseudocódigo estrutural — a ser implementado

interface AgentRule {
  id: string;
  modulo: string;
  tipo: string; // 'auto_action' | 'alert' | 'escalation' | 'limit'
  nome: string;
  condicao: {
    campo: string;      // ex: "contas_receber.data_vencimento"
    operador: string;   // ex: "<"
    valor: string;      // ex: "CURRENT_DATE"
    filtro?: string;    // ex: "status = 'vencido' AND ..."
  };
  acao: {
    tipo: string;       // ex: "cobranca_escalonada", "alerta_telegram", "alerta_sistema"
    canal?: string;     // "whatsapp" | "email" | "telegram" | "app_campo"
    mensagem?: string;  // template com {placeholders}
    nivel?: number;     // nível de escalonamento
    tom?: string;       // "amigavel" | "lembrete" | "formal"
    escalar_para?: string;
    acao_automatica?: string;
  };
}

// FLUXO PRINCIPAL
async function processRules(supabase: SupabaseClient) {
  const rules = await fetchActiveRules(supabase);

  for (const rule of rules) {
    const matches = await evaluateCondition(supabase, rule);

    for (const match of matches) {
      // Dedup: verificar se já foi processado nas últimas 24h
      if (await wasRecentlyProcessed(supabase, rule.id, match.id)) continue;

      await executeAction(supabase, rule, match);
      await registerExecution(supabase, rule, match);
    }
  }
}

// AVALIAÇÃO DE CONDIÇÃO
// Cada rule.condicao define uma query implícita.
// O motor traduz isso para SQL real.
async function evaluateCondition(supabase, rule) {
  // Mapear rule.condicao para query SQL
  // Exemplo: condicao = { campo: "contas_receber.data_vencimento", operador: "<", valor: "CURRENT_DATE", filtro: "status = 'vencido' AND ..." }
  // → SELECT cr.*, c.nome as cliente_nome, c.telefone, c.email
  //   FROM contas_receber cr JOIN clientes c ON c.id = cr.cliente_id
  //   WHERE cr.data_vencimento < CURRENT_DATE AND status = 'vencido' AND ...
}

// DESPACHO DE AÇÕES
async function executeAction(supabase, rule, match) {
  switch (rule.acao.tipo) {
    case 'cobranca_escalonada':
      return executeCobranca(supabase, rule, match);
    case 'alerta_telegram':
      return sendTelegramAlert(rule, match);
    case 'alerta_sistema':
      return createSystemAlert(supabase, rule, match);
    case 'enviar_mensagem':
      return sendMessage(supabase, rule, match);
    case 'marcar_urgente':
      return markUrgent(supabase, rule, match);
    case 'notificar_campo':
      return notifyFieldTeam(supabase, rule, match);
    case 'bloquear':
      return logBlockAction(supabase, rule, match);
    case 'sugerir_compra':
      return suggestPurchase(supabase, rule, match);
  }
}
```

### Queries de condição — mapeamento completo

Cada `agent_rule` precisa ser traduzida para SQL. O motor usa a seguinte lógica:

| Rule | Query SQL resultante |
|---|---|
| `cobranca_d1` | `SELECT cr.*, c.nome, c.telefone, c.email FROM contas_receber cr JOIN clientes c ON c.id = cr.cliente_id WHERE cr.status IN ('aberto','vencido') AND (CURRENT_DATE - cr.data_vencimento) BETWEEN 1 AND 2 AND cr.excluido_em IS NULL` |
| `cobranca_d3` | Idem, mas `BETWEEN 3 AND 6` |
| `cobranca_d7` | Idem, mas `BETWEEN 7 AND 14` |
| `cobranca_d15_alerta_junior` | Idem, mas `BETWEEN 15 AND 29` |
| `cobranca_d30_suspensao` | Idem, mas `>= 30` |
| `op_atrasada` | `SELECT op.*, p.numero as pedido_numero FROM ordens_producao op JOIN pedidos p ON p.id = op.pedido_id WHERE op.prazo_interno < CURRENT_DATE AND op.status NOT IN ('concluida','cancelada','finalizado')` |
| `priorizar_op_urgente` | `SELECT op.* FROM ordens_producao op WHERE op.prazo_interno <= CURRENT_DATE + 3 AND op.status IN ('pendente','em_producao')` |
| `estoque_minimo` | `SELECT * FROM materiais WHERE estoque_atual <= estoque_minimo AND estoque_minimo > 0` |
| `lead_quente_sem_orcamento` | `SELECT l.* FROM leads l WHERE l.score >= 70 AND NOT EXISTS (SELECT 1 FROM propostas p WHERE ...)` |
| `follow_up_lead_24h` | `SELECT l.* FROM leads l WHERE l.updated_at < now() - interval '24 hours' AND l.status NOT IN ('convertido','perdido','descartado')` |
| `follow_up_proposta_48h` | `SELECT p.* FROM propostas p WHERE p.created_at < now() - interval '48 hours' AND p.status = 'enviada'` |
| `notificar_equipe_campo` | `SELECT oi.*, c.nome FROM ordens_instalacao oi JOIN clientes c ON c.id = oi.cliente_id WHERE oi.data_agendada = CURRENT_DATE + 1 AND oi.status NOT IN ('cancelada','concluida')` |

### Deduplicação

Para evitar enviar a mesma cobrança duas vezes, o motor verifica:

```sql
SELECT 1 FROM cobranca_automatica
WHERE conta_receber_id = $1 AND nivel = $2
AND created_at > now() - interval '24 hours'
LIMIT 1
```

Para ações não-financeiras, usa `system_events`:

```sql
SELECT 1 FROM system_events
WHERE event_type = 'rule_executed'
AND entity_id = $1
AND (payload->>'rule_id')::text = $2
AND created_at > now() - interval '24 hours'
LIMIT 1
```

### Alterações no banco necessárias

```sql
-- 1. Adicionar last_run à agent_rules
ALTER TABLE agent_rules ADD COLUMN IF NOT EXISTS last_run timestamptz;
ALTER TABLE agent_rules ADD COLUMN IF NOT EXISTS run_count integer DEFAULT 0;

-- 2. Adicionar campos faltantes em materiais (se não existem)
-- estoque_atual e estoque_minimo — verificar se existem
```

---

## Entrega 3.2 — Cobrança Automática Escalonada

### Fluxo completo

```
Conta vence
    │
    ├─ D+1: WhatsApp amigável
    │       "Oi {nome}, tudo bem? Percebemos que o título X venceu ontem.
    │        Segue o PIX para pagamento: CNPJ 18.923.994/0001-83"
    │
    ├─ D+3: WhatsApp lembrete
    │       "Olá {nome}, gostaríamos de lembrar sobre o título X no valor
    │        de R$ {valor}, vencido em {data}. Precisa de alguma ajuda?"
    │
    ├─ D+7: Email formal
    │       Assunto: "Lembrete de pagamento — Croma Print"
    │       Corpo formal com dados bancários + link do portal
    │
    ├─ D+15: Alerta Telegram para Junior
    │        "⚠️ ATENÇÃO: {cliente} com R$ {valor} vencido há 15 dias"
    │
    └─ D+30: Alerta crítico + recomendar suspensão
             "🚨 CRÍTICO: {cliente} inadimplente há 30 dias (R$ {valor}).
              Recomendar suspensão de novos pedidos."
             + Registrar flag no cliente
```

### Canais de envio

| Canal | Método | Implementação |
|---|---|---|
| **WhatsApp** | API WhatsApp Business (via webhook existente) | `POST /whatsapp-webhook` com payload de envio OU chamar a API da Meta diretamente (requer templates aprovados — WA-02 pendente) |
| **Email** | SMTP direto (nodemailer) | Reutilizar lógica de `enviarEmailProposta()` do webhook v15 — admin_config tem credenciais SMTP |
| **Telegram** | Bot API | `POST https://api.telegram.org/bot{token}/sendMessage` com chat_id do Junior (1065519625) |

### Registro em `cobranca_automatica`

Cada tentativa de cobrança gera um registro:

```sql
INSERT INTO cobranca_automatica (conta_receber_id, cliente_id, nivel, canal, mensagem, status, dias_atraso)
VALUES ($1, $2, $nivel, $canal, $mensagem_enviada, 'enviado', $dias_atraso);
```

Se falhar:

```sql
INSERT INTO cobranca_automatica (conta_receber_id, cliente_id, nivel, canal, mensagem, status, dias_atraso, erro_mensagem)
VALUES ($1, $2, $nivel, $canal, $mensagem, 'erro', $dias_atraso, $erro);
```

### Mensagens — Tom por nível

| Nível | Tom | Exemplo |
|---|---|---|
| D+1 | Amigável, informal | "Oi {nome}! Tudo bem? Percebemos que o pagamento ref. ao pedido {numero} venceu ontem ({data_vencimento}). O valor é R$ {valor}. Se já pagou, pode desconsiderar! PIX: CNPJ 18.923.994/0001-83. Qualquer dúvida é só chamar." |
| D+3 | Lembrete cordial | "Olá {nome}, passando para lembrar do pagamento no valor de R$ {valor} (vencido em {data_vencimento}). Se precisar de segunda via ou quiser combinar outra data, estamos à disposição. PIX: CNPJ 18.923.994/0001-83" |
| D+7 | Formal, email | "Prezado(a) {nome}, informamos que identificamos um título em aberto no valor de R$ {valor}, com vencimento em {data_vencimento}. Solicitamos a gentileza de regularizar o pagamento. Dados para pagamento: PIX CNPJ 18.923.994/0001-83 ou transferência bancária." |
| D+15 | Alerta Junior (Telegram) | "⚠️ COBRANÇA D+15: {cliente_nome} com R$ {valor} vencido há {dias} dias (pedido {numero}). Sem resposta nas cobranças anteriores (D1 WhatsApp, D3 WhatsApp, D7 Email). Ação sugerida: ligar pessoalmente." |
| D+30 | Alerta crítico (Telegram) | "🚨 INADIMPLÊNCIA D+30: {cliente_nome} — R$ {valor} vencido há {dias} dias. Todas as tentativas de cobrança falharam. RECOMENDAÇÃO: suspender novos pedidos até regularização." |

### Regra de negócio importante

- **Nunca enviar cobrança no mesmo dia do pagamento**: antes de enviar, sempre verificar se `data_pagamento IS NULL` e `saldo > 0`
- **Respeitar horário comercial**: envios de WhatsApp apenas entre 08:00 e 18:00 (fuso BR)
- **Não duplicar**: verificar `cobranca_automatica` antes de enviar (dedup por conta_receber_id + nivel + 24h)
- **WhatsApp depende de template Meta** (WA-02 pendente): enquanto não aprovado, usar sessão ativa de 24h ou fallback para email

---

## Entrega 3.3 — PCP Inteligente (Planejamento e Controle de Produção)

### Situação atual

- Sem processo de PCP hoje (Junior confirmou)
- 6 setores de produção definidos com ordem e capacidade: Criação (480min/dia) → Impressão (600min) → Router/Corte (480min) → Acabamento (480min) → Serralheria (480min) → Expedição (240min)
- 6 máquinas ativas com custo/hora e custo/m²
- OPs já têm `maquina_id`, `prioridade`, `data_inicio_prevista`, `data_fim_prevista`, `tempo_estimado_min`
- Etapas de produção já têm `setor_id`, `ordem`, `tempo_estimado_min`
- Trigger já cria OP automaticamente quando pedido é aprovado

### O que falta

1. **Sequenciamento automático**: ao criar OP, gerar automaticamente as etapas corretas baseadas no produto/modelo
2. **Assignment de máquina**: vincular OP à máquina correta baseado no tipo de produto
3. **Cálculo de datas**: preencher `data_inicio_prevista` e `data_fim_prevista` baseado na capacidade dos setores
4. **Priorização dinâmica**: reordenar fila quando pedido urgente entra
5. **Visibilidade**: Gantt funcional (já existe GAP-04, já resolvido — verificar integração)

### Arquitetura do PCP

```
Pedido aprovado
    │
    ▼
trg_pedido_aprovado_cria_op (trigger existente)
    │
    ▼
fn_pcp_sequenciar_op (NOVA FUNÇÃO)
    │
    ├─ 1. Identifica produto/modelo do pedido_item
    │
    ├─ 2. Busca etapa_templates para aquele modelo
    │     (ou gera etapas padrão se não houver template)
    │
    ├─ 3. Cria producao_etapas na ordem correta
    │     com setor_id vinculado
    │
    ├─ 4. Atribui máquina à OP baseado no tipo:
    │     - Banner/impressão → HP Latex 365 ou Solvente
    │     - ACM/fachada → Router CNC
    │     - Adesivo → Plotter de Recorte
    │     - Acabamento → Laminadora / Solda Banner
    │
    ├─ 5. Calcula datas previstas:
    │     - data_inicio = max(hoje, última OP da mesma máquina)
    │     - tempo = soma dos tempo_estimado_min das etapas
    │     - data_fim = data_inicio + ceil(tempo / capacidade_diaria)
    │
    └─ 6. Se prioridade >= 8 (urgente):
          - Reordena fila: push outras OPs para frente
          - Alerta Telegram: "OP urgente inserida na fila"
```

### Mapeamento produto → etapas padrão

| Categoria produto | Etapas (em ordem) | Máquina principal |
|---|---|---|
| Banner / Lona | Criação → Impressão → Acabamento → Expedição | HP Latex 365 |
| Adesivo / Vinil | Criação → Impressão → Corte → Acabamento → Expedição | HP Latex 365 + Plotter |
| Fachada ACM | Criação → Router/Corte → Serralheria → Acabamento → Expedição | Router CNC |
| Placa / PVC | Criação → Impressão → Router/Corte → Acabamento → Expedição | Solvente + Router CNC |
| Letreiro / Letra caixa | Criação → Router/Corte → Serralheria → Acabamento → Expedição | Router CNC |
| Envelopamento | Criação → Impressão → Acabamento → Expedição | HP Latex 365 |
| Totem / Painel | Criação → Impressão → Router/Corte → Serralheria → Acabamento → Expedição | HP Latex + Router |

### Implementação — Trigger SQL

```sql
-- fn_pcp_sequenciar_op()
-- Chamada AFTER INSERT em ordens_producao (adicionar ao trigger existente ou criar novo)

CREATE OR REPLACE FUNCTION fn_pcp_sequenciar_op()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_produto RECORD;
  v_categoria TEXT;
  v_etapas TEXT[];
  v_maquina_id UUID;
  v_setor RECORD;
  v_ordem INT := 1;
  v_tempo_total INT := 0;
  v_capacidade INT;
  v_data_inicio TIMESTAMPTZ;
  v_data_fim TIMESTAMPTZ;
BEGIN
  -- 1. Buscar produto do pedido_item
  SELECT pm.categoria, pm.id as modelo_id, pi.largura, pi.altura, pi.quantidade
  INTO v_produto
  FROM pedido_itens pi
  JOIN produto_modelos pm ON pm.produto_id = pi.produto_id
  WHERE pi.id = NEW.pedido_item_id;

  IF v_produto IS NULL THEN RETURN NEW; END IF;

  v_categoria := LOWER(COALESCE(v_produto.categoria, 'geral'));

  -- 2. Determinar etapas baseado na categoria
  v_etapas := CASE
    WHEN v_categoria IN ('banner', 'lona', 'envelopamento') THEN
      ARRAY['criacao','impressao','acabamento','expedicao']
    WHEN v_categoria IN ('adesivo', 'vinil') THEN
      ARRAY['criacao','impressao','router','acabamento','expedicao']
    WHEN v_categoria IN ('fachada', 'acm', 'letreiro', 'letra_caixa') THEN
      ARRAY['criacao','router','serralheria','acabamento','expedicao']
    WHEN v_categoria IN ('placa', 'pvc') THEN
      ARRAY['criacao','impressao','router','acabamento','expedicao']
    WHEN v_categoria IN ('totem', 'painel') THEN
      ARRAY['criacao','impressao','router','serralheria','acabamento','expedicao']
    ELSE
      ARRAY['criacao','impressao','acabamento','expedicao']
  END;

  -- 3. Criar etapas de produção
  FOREACH v_etapa_codigo IN ARRAY v_etapas LOOP
    SELECT id, capacidade_diaria_min INTO v_setor
    FROM setores_producao WHERE codigo = v_etapa_codigo AND ativo = true;

    IF v_setor IS NOT NULL THEN
      INSERT INTO producao_etapas (ordem_producao_id, nome, ordem, status, setor_id, tempo_estimado_min)
      VALUES (NEW.id, (SELECT nome FROM setores_producao WHERE codigo = v_etapa_codigo),
              v_ordem, 'pendente', v_setor.id,
              CASE v_etapa_codigo
                WHEN 'criacao' THEN 60
                WHEN 'impressao' THEN GREATEST(30, (v_produto.largura * v_produto.altura / 10000 * 5)::int)
                WHEN 'router' THEN GREATEST(45, (v_produto.largura * v_produto.altura / 10000 * 8)::int)
                WHEN 'serralheria' THEN 120
                WHEN 'acabamento' THEN 30
                WHEN 'expedicao' THEN 15
                ELSE 30
              END);
      v_ordem := v_ordem + 1;
    END IF;
  END LOOP;

  -- 4. Atribuir máquina principal
  v_maquina_id := CASE
    WHEN v_categoria IN ('banner','lona','adesivo','vinil','envelopamento','placa','pvc','totem','painel') THEN
      (SELECT id FROM maquinas WHERE tipo = 'impressao' AND nome ILIKE '%latex%' AND ativo = true LIMIT 1)
    WHEN v_categoria IN ('fachada','acm','letreiro','letra_caixa') THEN
      (SELECT id FROM maquinas WHERE tipo = 'corte' AND nome ILIKE '%router%' AND ativo = true LIMIT 1)
    ELSE
      (SELECT id FROM maquinas WHERE tipo = 'impressao' AND ativo = true LIMIT 1)
  END;

  -- 5. Calcular datas
  SELECT COALESCE(SUM(tempo_estimado_min), 120) INTO v_tempo_total
  FROM producao_etapas WHERE ordem_producao_id = NEW.id;

  v_capacidade := 480; -- minutos por dia padrão
  v_data_inicio := GREATEST(NOW(), (
    SELECT COALESCE(MAX(data_fim_prevista), NOW())
    FROM ordens_producao
    WHERE maquina_id = v_maquina_id AND status NOT IN ('concluida','cancelada','finalizado')
    AND id != NEW.id
  ));
  v_data_fim := v_data_inicio + (CEIL(v_tempo_total::numeric / v_capacidade) || ' days')::interval;

  -- 6. Atualizar OP
  UPDATE ordens_producao
  SET maquina_id = COALESCE(NEW.maquina_id, v_maquina_id),
      data_inicio_prevista = v_data_inicio,
      data_fim_prevista = v_data_fim,
      tempo_estimado_min = v_tempo_total
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;
```

### Alterações no banco necessárias

```sql
-- 1. Trigger para sequenciamento automático
CREATE TRIGGER trg_pcp_sequenciar
  AFTER INSERT ON ordens_producao
  FOR EACH ROW
  EXECUTE FUNCTION fn_pcp_sequenciar_op();

-- 2. Adicionar campo 'categoria' em produto_modelos se não existir
-- (verificar — pode ser que já exista via regras_precificacao)

-- 3. View para fila de produção (Gantt data source)
CREATE OR REPLACE VIEW vw_fila_producao AS
SELECT
  op.id, op.numero, op.status, op.prioridade,
  op.data_inicio_prevista, op.data_fim_prevista,
  op.tempo_estimado_min, op.tempo_real_min,
  op.maquina_id, m.nome as maquina_nome,
  op.setor_atual_id, sp.nome as setor_atual,
  p.numero as pedido_numero, p.status as pedido_status,
  c.nome as cliente_nome,
  op.prazo_interno,
  CASE WHEN op.prazo_interno < CURRENT_DATE AND op.status NOT IN ('concluida','cancelada','finalizado')
       THEN true ELSE false END as atrasada
FROM ordens_producao op
LEFT JOIN maquinas m ON m.id = op.maquina_id
LEFT JOIN setores_producao sp ON sp.id = op.setor_atual_id
LEFT JOIN pedidos p ON p.id = op.pedido_id
LEFT JOIN clientes c ON c.id = p.cliente_id
WHERE op.excluido_em IS NULL
ORDER BY op.prioridade DESC, op.prazo_interno ASC NULLS LAST;
```

---

## Entrega 3.4 — Transição Automática Produção → Instalação

### Análise dos triggers existentes

Os triggers `fn_op_finalizada_transicao` e `fn_auto_criar_ordem_instalacao` já cobrem 90% do fluxo:

**`fn_op_finalizada_transicao`** (trigger em `ordens_producao`):
- Quando OP muda para status 'finalizado':
  - Verifica se há outras OPs pendentes do mesmo pedido
  - Se todas finalizadas e produto requer instalação → cria OI + muda pedido para 'aguardando_instalacao'
  - Se não requer instalação → muda pedido para 'pronto_entrega'

**`fn_auto_criar_ordem_instalacao`** (trigger em `system_events`):
- Quando system_event = 'production_completed':
  - Busca pedido, verifica se OI já existe
  - Cria OI com endereço do cliente
  - Registra system_event 'installation_order_created'

**`fn_check_production_completed`** (trigger em `producao_etapas`):
- Quando todas etapas da OP estão concluídas:
  - Marca OP como 'concluida'
  - Emite system_event 'production_completed'
  - Muda pedido para 'pronto_instalacao'

### Gap identificado: conflito de estados

Há um possível conflito entre os dois caminhos:
- Caminho A: `producao_etapas` todas concluídas → `fn_check_production_completed` → marca OP concluída + system_event → `fn_auto_criar_ordem_instalacao` cria OI
- Caminho B: OP muda para 'finalizado' → `fn_op_finalizada_transicao` → cria OI + muda pedido

Os dois caminhos usam status diferentes ('concluida' vs 'finalizado') e ambos tentam criar OI. Mas ambos têm guard de dedup (`IF EXISTS...`), então não há duplicação real. O que falta:

### Ajustes necessários

```sql
-- 1. Unificar terminologia: 'finalizado' e 'concluida' devem ser equivalentes
-- A fn_op_finalizada_transicao dispara em 'finalizado'
-- A fn_check_production_completed marca como 'concluida'
-- Solução: fn_op_finalizada_transicao deve aceitar AMBOS os status
ALTER FUNCTION fn_op_finalizada_transicao() ... -- ajustar IF NEW.status NOT IN ('finalizado','concluida')

-- 2. Adicionar notificação automática ao criar OI
-- Quando OI é criada automaticamente, enviar:
-- a) System event para rastreamento
-- b) Telegram para Junior: "Produção concluída, OI criada para {cliente}"
-- c) Notificação no App de Campo (se equipe vinculada)

-- 3. Trigger para notificação automática na criação de OI
CREATE OR REPLACE FUNCTION fn_notificar_nova_oi()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO system_events (event_type, entity_type, entity_id, payload)
  VALUES ('installation_order_created', 'ordem_instalacao', NEW.id,
    jsonb_build_object(
      'pedido_id', NEW.pedido_id,
      'cliente_id', NEW.cliente_id,
      'auto_generated', true,
      'notificar_junior', true
    ));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notificar_nova_oi
  AFTER INSERT ON ordens_instalacao
  FOR EACH ROW
  EXECUTE FUNCTION fn_notificar_nova_oi();
```

### Fluxo completo verificado

```
Pedido aprovado
  → trg_pedido_aprovado_cria_op → cria OP
  → trg_pcp_sequenciar (NOVO) → cria etapas + atribui máquina + calcula datas

Equipe trabalha nas etapas (App Campo ou ERP)
  → Cada etapa concluída: tr_etapa_concluida_avanca_op → avança OP
  → Última etapa: fn_check_production_completed → OP concluída + system_event

System event 'production_completed'
  → fn_auto_criar_ordem_instalacao → cria OI (se requer instalação)
  → fn_notificar_nova_oi (NOVO) → alerta Junior + system_event

OU (caminho alternativo por status direto)
  → fn_op_finalizada_transicao → mesma lógica, guard dedup
```

---

## Entrega 3.5 — Dashboard de Automação

### Conceito

Página `/admin/automacao` no ERP que mostra:

1. **Cobranças em andamento**: lista de contas vencidas com histórico de cobranças automáticas por nível
2. **Fila de produção**: timeline/Gantt com OPs sequenciadas por máquina
3. **Transições recentes**: últimas ordens de instalação criadas automaticamente
4. **Saúde das regras**: status de cada agent_rule (última execução, total de execuções, erros)

### Componentes React necessários

```
src/domains/admin/pages/AutomacaoPage.tsx
src/domains/admin/components/
  CobrancaTimeline.tsx       — timeline D1→D3→D7→D15→D30 por cliente
  FilaProducaoGantt.tsx      — Gantt chart usando vw_fila_producao
  TransicoesRecentes.tsx     — lista de system_events recentes
  AgentRulesStatus.tsx       — tabela de regras com last_run, run_count
```

---

## Plano de Execução — Waves

### Wave 1 (paralelo, ~2 dias)

| # | Tarefa | Esforço | Dependência |
|---|---|---|---|
| 3.1.1 | Migration: `last_run`, `run_count` em agent_rules | ~30min | — |
| 3.1.2 | Edge Function `agent-cron-loop` (estrutura + avaliação de condições) | ~4h | — |
| 3.2.1 | Função `executeCobranca()` com envio WhatsApp/Email/Telegram | ~3h | 3.1.2 |
| 3.2.2 | Templates de mensagem por nível (D1-D30) | ~1h | — |

### Wave 2 (paralelo, ~2 dias)

| # | Tarefa | Esforço | Dependência |
|---|---|---|---|
| 3.3.1 | Função SQL `fn_pcp_sequenciar_op()` + trigger | ~4h | — |
| 3.3.2 | View `vw_fila_producao` | ~1h | — |
| 3.3.3 | Mapeamento categoria→etapas→máquina (dados seed) | ~2h | 3.3.1 |

### Wave 3 (sequencial, ~2 dias)

| # | Tarefa | Esforço | Dependência |
|---|---|---|---|
| 3.4.1 | Ajustar `fn_op_finalizada_transicao` (status unificado) | ~1h | — |
| 3.4.2 | Trigger `fn_notificar_nova_oi` | ~1h | — |
| 3.5.1 | Página `/admin/automacao` com 4 componentes | ~6h | 3.1, 3.2, 3.3 |
| 3.5.2 | Integrar ao menu Admin | ~30min | 3.5.1 |

### Wave 4 (validação, ~1 dia)

| # | Tarefa | Esforço | Dependência |
|---|---|---|---|
| 3.6.1 | Teste E2E: criar pedido → OP → etapas → conclusão → OI | ~2h | Tudo |
| 3.6.2 | Teste: conta vencida → cobrança D1 → D3 → dedup | ~2h | Tudo |
| 3.6.3 | Configurar cron externo para agent-cron-loop (CRON-01) | ~1h | 3.1.2 |
| 3.6.4 | Teste em produção com dados reais | ~2h | 3.6.1-3 |

---

## Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| WhatsApp templates não aprovados (WA-02) | Cobrança WhatsApp não funciona proativamente | Fallback: enviar por email até aprovação. Usar sessão 24h quando possível. |
| PCP com categorias incorretas | Etapas erradas para o produto | Seed inicial conservador (etapa genérica de 4 passos). Permitir override manual. |
| Cron não disparando | Cobranças e alertas param | Monitorar via system_events. Alerta Telegram se cron não roda há 2h. |
| Cobrança indevida (conta já paga) | Constrangimento com cliente | Double-check: verificar saldo > 0 e data_pagamento IS NULL imediatamente antes de enviar. |
| Conflito de triggers em produção | OP ou OI duplicada | Guards de idempotência já existem. Adicionar log detalhado em cada trigger. |

---

## Exit Criteria

- [ ] `agent-cron-loop` executando a cada 30min, processando todas as 15 agent_rules
- [ ] Cobrança automática D1→D3→D7→D15→D30 funcionando com dedup
- [ ] PCP gerando etapas + atribuindo máquina + calculando datas automaticamente
- [ ] Fluxo Produção→Instalação 100% automático (OP concluída → OI criada → Junior notificado)
- [ ] Dashboard `/admin/automacao` operacional com 4 seções
- [ ] Zero ações manuais repetitivas para cobrança e transição de status
- [ ] CRON-01 configurado e ativo

---

## Referências

- Agent rules seedadas: `agent_rules` (15 ativas)
- Tabela de cobrança: `cobranca_automatica` (11 colunas)
- Triggers de produção: `fn_op_finalizada_transicao`, `fn_check_production_completed`, `fn_auto_criar_ordem_instalacao`
- Setores: 6 (Criação→Impressão→Router→Acabamento→Serralheria→Expedição)
- Máquinas: 6 (HP Latex, Solvente, Laminadora, Plotter, Router CNC, Solda)
- PIX: CNPJ 18.923.994/0001-83
- Email: junior@cromaprint.com.br
- Telegram Junior: chat_id 1065519625

---
*Plano criado: 2026-03-31*
*Autor: Claude (cérebro administrativo Croma Print)*
