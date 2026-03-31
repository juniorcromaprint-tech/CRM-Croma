# FASE 4 — Inteligência

> **Objetivo**: Dotar o sistema de capacidade analítica e preditiva — cockpit executivo para Junior, score de crédito por cliente, e memória de longo prazo para que a IA aprenda com a operação.
> **Estimativa**: 5-7 dias de desenvolvimento
> **Pré-requisitos**: Fase 3 concluída (automação de fluxo + agent-cron-loop operacional)
> **Criado**: 2026-03-31

---

## Diagnóstico — O que existe hoje

### Infraestrutura de dados

| Componente | Status | Detalhes |
|---|---|---|
| `ai_memory` (tabela) | ✅ Existe | 4 registros iniciais: ticket_medio_conversao, tempo_impressao_banner, prazo_entrega_por_tipo, prazo_medio_pagamento |
| `business_intelligence_config` | ✅ 15 configs | Metas (taxa conversão 75%, ticket médio R$2.100), risco (concentração 60%), sazonalidade 12 meses |
| `system_events` | ✅ 5 eventos | Tipos: daily_closing, daily_summary |
| `registros_auditoria` | ✅ Existe | Triggers de auditoria em todas tabelas críticas |
| Dashboard financeiro | ✅ GAP-01 resolvido | Receitas, despesas, fluxo de caixa |
| Funil comercial | ✅ GAP-06 resolvido | Lead→Cliente com métricas |
| `DashboardExecutivoPage` | ⚠️ Existe mas incompleto | UX-02 pendente — falta integrar system_events e dados de cobrança |

### Dados disponíveis para análise

| Fonte | Registros | Uso |
|---|---|---|
| `clientes` | 312 | Base para score de crédito |
| `pedidos` | 3 clientes com pedidos | Histórico de compras |
| `contas_receber` | 2 registros | Histórico de pagamentos |
| `propostas` | Existentes | Taxa de conversão |
| `leads` | Existentes | Funil de aquisição |
| `ordens_producao` | 3 abertas | Dados de produção |
| `materiais` | 467 | Consumo e estoque |
| `cobranca_automatica` | Será populada pela Fase 3 | Histórico de cobranças |

### ai_memory — padrões já detectados

| Chave | Tipo | Confiança | Fonte |
|---|---|---|---|
| ticket_medio_conversao | pricing_pattern | 40% | ia_inferencia |
| tempo_impressao_banner_por_m2 | production_pattern | 50% | observacao |
| prazo_entrega_por_tipo | operational_pattern | 60% | observacao |
| prazo_medio_pagamento | client_pattern | 45% | ia_inferencia |

---

## Entrega 4.1 — Cockpit Executivo

### Conceito

Página `/dashboard/executivo` que dá ao Junior uma visão de helicóptero da empresa inteira em uma única tela. Projetada para ser a primeira coisa que ele abre no celular de manhã.

### Layout (mobile-first, 1 coluna no celular)

```
┌──────────────────────────────────────┐
│  🏢 COCKPIT EXECUTIVO                │
│  Terça-feira, 31 de março de 2026    │
├──────────────────────────────────────┤
│                                      │
│  ┌─── PULSO DO DIA ───────────────┐  │
│  │ 💰 Faturado hoje: R$ 3.200     │  │
│  │ 📊 Pipeline ativo: R$ 47.800   │  │
│  │ ⚠️ Vencidos: 2 (R$ 4.300)     │  │
│  │ 🏭 OPs em produção: 3          │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌─── ALERTAS IA ─────────────────┐  │
│  │ 🔴 Cliente X com R$ 2k D+15   │  │
│  │ 🟡 Vinil adesivo abaixo min   │  │
│  │ 🟢 OP-2026-001 concluída      │  │
│  │ 🔵 Lead quente sem orçamento   │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌─── FINANCEIRO ─────────────────┐  │
│  │ Receita mês: R$ 87.400 / 110k │  │
│  │ [████████████░░░] 79%          │  │
│  │                                │  │
│  │ A receber 7 dias: R$ 12.300    │  │
│  │ A pagar 7 dias: R$ 8.700      │  │
│  │ Saldo projetado: +R$ 3.600    │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌─── PRODUÇÃO ───────────────────┐  │
│  │ OPs hoje: 3 de 5 concluídas   │  │
│  │ Eficiência: 87%               │  │
│  │ Atrasadas: 1 (OP-2026-004)    │  │
│  │ Próxima entrega: amanhã       │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌─── COMERCIAL ──────────────────┐  │
│  │ Leads novos (7d): 8           │  │
│  │ Propostas enviadas (7d): 5    │  │
│  │ Conversão: 60%                │  │
│  │ Ticket médio: R$ 2.340        │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌─── AUTOMAÇÃO ──────────────────┐  │
│  │ Cobranças enviadas (7d): 12   │  │
│  │ Follow-ups enviados (7d): 6   │  │
│  │ Regras ativas: 15/15          │  │
│  │ Último cron: há 12min         │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌─── LINHA DO TEMPO ────────────┐  │
│  │ 10:32 OP-004 → Acabamento    │  │
│  │ 09:15 Proposta #47 enviada   │  │
│  │ 08:45 Cobrança D3 → Cliente Y│  │
│  │ 08:01 Cron executado (15 ok) │  │
│  │ [ver mais...]                 │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### Fonte de dados — Views SQL

```sql
-- View principal: dados do cockpit em uma única query
CREATE OR REPLACE VIEW vw_cockpit_executivo AS
SELECT
  -- Financeiro
  (SELECT COALESCE(SUM(valor_pago), 0) FROM contas_receber
   WHERE data_pagamento = CURRENT_DATE AND excluido_em IS NULL) as faturado_hoje,

  (SELECT COALESCE(SUM(valor_original), 0) FROM propostas
   WHERE status IN ('enviada','negociacao') AND excluido_em IS NULL) as pipeline_ativo,

  (SELECT COUNT(*) FROM contas_receber
   WHERE status IN ('aberto','vencido','pendente') AND data_vencimento < CURRENT_DATE
   AND excluido_em IS NULL) as vencidos_count,

  (SELECT COALESCE(SUM(saldo), 0) FROM contas_receber
   WHERE status IN ('aberto','vencido','pendente') AND data_vencimento < CURRENT_DATE
   AND excluido_em IS NULL) as vencidos_valor,

  -- Receita mês
  (SELECT COALESCE(SUM(valor_pago), 0) FROM contas_receber
   WHERE date_trunc('month', data_pagamento) = date_trunc('month', CURRENT_DATE)
   AND excluido_em IS NULL) as receita_mes,

  -- A receber próximos 7 dias
  (SELECT COALESCE(SUM(saldo), 0) FROM contas_receber
   WHERE data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
   AND status NOT IN ('pago','cancelado') AND excluido_em IS NULL) as a_receber_7d,

  -- A pagar próximos 7 dias
  (SELECT COALESCE(SUM(valor_original), 0) FROM contas_pagar
   WHERE data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
   AND status NOT IN ('pago','cancelado') AND excluido_em IS NULL) as a_pagar_7d,

  -- Produção
  (SELECT COUNT(*) FROM ordens_producao
   WHERE status NOT IN ('concluida','cancelada','finalizado')
   AND excluido_em IS NULL) as ops_abertas,

  (SELECT COUNT(*) FROM ordens_producao
   WHERE prazo_interno < CURRENT_DATE AND status NOT IN ('concluida','cancelada','finalizado')
   AND excluido_em IS NULL) as ops_atrasadas,

  -- Comercial (7 dias)
  (SELECT COUNT(*) FROM leads
   WHERE created_at > now() - interval '7 days') as leads_novos_7d,

  (SELECT COUNT(*) FROM propostas
   WHERE created_at > now() - interval '7 days' AND excluido_em IS NULL) as propostas_7d,

  -- Automação
  (SELECT COUNT(*) FROM cobranca_automatica
   WHERE created_at > now() - interval '7 days') as cobrancas_7d,

  (SELECT COUNT(*) FROM system_events
   WHERE created_at > now() - interval '7 days') as eventos_7d;

-- View de timeline (últimos eventos)
CREATE OR REPLACE VIEW vw_cockpit_timeline AS
SELECT
  created_at,
  event_type,
  entity_type,
  entity_id,
  payload,
  CASE event_type
    WHEN 'production_completed' THEN '🏭 Produção concluída'
    WHEN 'installation_order_created' THEN '📋 OI criada'
    WHEN 'payment_received' THEN '💰 Pagamento recebido'
    WHEN 'payment_overdue' THEN '⚠️ Pagamento vencido'
    WHEN 'rule_executed' THEN '🤖 Regra executada'
    WHEN 'daily_summary' THEN '📊 Resumo diário'
    ELSE '📌 ' || event_type
  END as descricao_formatada
FROM system_events
ORDER BY created_at DESC
LIMIT 50;
```

### Componentes React

```
src/domains/dashboard/pages/CockpitExecutivoPage.tsx
src/domains/dashboard/components/
  PulsoDoDia.tsx          — 4 KPIs principais (cards coloridos)
  AlertasIA.tsx           — lista priorizada de alertas (system_events + agent_rules matches)
  FinanceiroResumo.tsx    — barra de progresso receita/meta + a receber/pagar
  ProducaoResumo.tsx      — OPs abertas, eficiência, atrasadas
  ComercialResumo.tsx     — leads, propostas, conversão, ticket médio
  AutomacaoResumo.tsx     — cobranças, follow-ups, status das regras
  TimelineEventos.tsx     — lista cronológica dos últimos eventos
```

### Integração com BI config

O cockpit usa `business_intelligence_config` para:
- **Meta de receita mensal**: `ticket_medio_geral` × volume estimado, ajustado por sazonalidade
- **Sazonalidade**: índice do mês corrente (ex: março = 1.10 → meta = R$110k × 1.10 = R$121k)
- **Concentração de risco**: alertar se um cliente representa mais de 60% do faturamento

---

## Entrega 4.2 — Score de Crédito por Cliente

### Conceito

Cada cliente recebe um score de 0-100 que indica confiabilidade financeira. O score é calculado automaticamente e influencia:
- Limite de crédito sugerido
- Prioridade na fila de produção
- Alertas de risco para o Junior
- Condições de pagamento oferecidas pelo agente de vendas

### Fórmula do Score

```
Score = (P_pagamento × 0.40) + (P_volume × 0.25) + (P_relacionamento × 0.20) + (P_recencia × 0.15)
```

#### P_pagamento (0-100) — Peso 40%

Baseado no histórico de pagamentos do cliente:

```sql
-- Cálculo por cliente
SELECT
  cliente_id,
  COUNT(*) as total_titulos,
  COUNT(*) FILTER (WHERE data_pagamento <= data_vencimento) as pagos_no_prazo,
  COUNT(*) FILTER (WHERE data_pagamento > data_vencimento) as pagos_com_atraso,
  COUNT(*) FILTER (WHERE data_pagamento IS NULL AND data_vencimento < CURRENT_DATE) as vencidos_abertos,
  AVG(CASE
    WHEN data_pagamento IS NOT NULL AND data_pagamento > data_vencimento
    THEN EXTRACT(DAY FROM data_pagamento - data_vencimento)
    ELSE 0
  END) as atraso_medio_dias
FROM contas_receber
WHERE excluido_em IS NULL
GROUP BY cliente_id;

-- Fórmula:
-- Se sem histórico → 50 (neutro)
-- Se todos no prazo → 100
-- Cada dia de atraso médio → -2 pontos
-- Cada título vencido aberto → -15 pontos
-- Mínimo: 0
```

#### P_volume (0-100) — Peso 25%

Baseado no volume total de compras:

```
Se faturamento total > R$ 50.000 → 100
Se faturamento total > R$ 20.000 → 80
Se faturamento total > R$ 5.000 → 60
Se faturamento total > R$ 1.000 → 40
Se faturamento total > 0 → 20
Se sem compras → 0
```

#### P_relacionamento (0-100) — Peso 20%

Baseado na duração e recorrência:

```
Anos como cliente × 10 (máx 50)
+ Pedidos por ano × 5 (máx 30)
+ Se cliente ativo (pedido nos últimos 6 meses) → +20
```

#### P_recencia (0-100) — Peso 15%

```
Se último pedido < 30 dias → 100
Se último pedido < 90 dias → 80
Se último pedido < 180 dias → 60
Se último pedido < 365 dias → 40
Se último pedido > 365 dias → 20
Se sem pedidos → 0
```

### Implementação — Função SQL

```sql
CREATE OR REPLACE FUNCTION fn_calcular_score_credito(p_cliente_id UUID)
RETURNS TABLE(
  score_total NUMERIC,
  score_pagamento NUMERIC,
  score_volume NUMERIC,
  score_relacionamento NUMERIC,
  score_recencia NUMERIC,
  nivel TEXT,        -- 'A' (80-100), 'B' (60-79), 'C' (40-59), 'D' (20-39), 'E' (0-19)
  limite_sugerido NUMERIC,
  detalhes JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pag NUMERIC := 50;  -- default neutro
  v_vol NUMERIC := 0;
  v_rel NUMERIC := 0;
  v_rec NUMERIC := 0;
  v_total NUMERIC;
  v_nivel TEXT;
  v_limite NUMERIC;
  v_faturamento NUMERIC;
  v_atraso_medio NUMERIC;
  v_vencidos INT;
  v_total_titulos INT;
  v_pagos_prazo INT;
  v_primeiro_pedido TIMESTAMPTZ;
  v_ultimo_pedido TIMESTAMPTZ;
  v_pedidos_ano NUMERIC;
BEGIN
  -- P_pagamento
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE data_pagamento IS NOT NULL AND data_pagamento <= data_vencimento),
    COUNT(*) FILTER (WHERE data_pagamento IS NULL AND data_vencimento < CURRENT_DATE),
    COALESCE(AVG(CASE
      WHEN data_pagamento IS NOT NULL AND data_pagamento > data_vencimento
      THEN EXTRACT(DAY FROM data_pagamento - data_vencimento)
      ELSE 0
    END), 0)
  INTO v_total_titulos, v_pagos_prazo, v_vencidos, v_atraso_medio
  FROM contas_receber
  WHERE cliente_id = p_cliente_id AND excluido_em IS NULL;

  IF v_total_titulos > 0 THEN
    v_pag := GREATEST(0, (v_pagos_prazo::numeric / v_total_titulos * 100) - (v_atraso_medio * 2) - (v_vencidos * 15));
  END IF;

  -- P_volume
  SELECT COALESCE(SUM(valor_total), 0)
  INTO v_faturamento
  FROM pedidos WHERE cliente_id = p_cliente_id AND status NOT IN ('cancelado');

  v_vol := CASE
    WHEN v_faturamento > 50000 THEN 100
    WHEN v_faturamento > 20000 THEN 80
    WHEN v_faturamento > 5000 THEN 60
    WHEN v_faturamento > 1000 THEN 40
    WHEN v_faturamento > 0 THEN 20
    ELSE 0
  END;

  -- P_relacionamento
  SELECT MIN(created_at), MAX(created_at)
  INTO v_primeiro_pedido, v_ultimo_pedido
  FROM pedidos WHERE cliente_id = p_cliente_id AND status NOT IN ('cancelado');

  IF v_primeiro_pedido IS NOT NULL THEN
    v_pedidos_ano := (SELECT COUNT(*) FROM pedidos
      WHERE cliente_id = p_cliente_id AND status NOT IN ('cancelado')
      AND created_at > now() - interval '1 year');

    v_rel := LEAST(50, EXTRACT(YEAR FROM age(now(), v_primeiro_pedido)) * 10)
           + LEAST(30, v_pedidos_ano * 5)
           + CASE WHEN v_ultimo_pedido > now() - interval '6 months' THEN 20 ELSE 0 END;
  END IF;

  -- P_recencia
  IF v_ultimo_pedido IS NOT NULL THEN
    v_rec := CASE
      WHEN v_ultimo_pedido > now() - interval '30 days' THEN 100
      WHEN v_ultimo_pedido > now() - interval '90 days' THEN 80
      WHEN v_ultimo_pedido > now() - interval '180 days' THEN 60
      WHEN v_ultimo_pedido > now() - interval '365 days' THEN 40
      ELSE 20
    END;
  END IF;

  -- Score total
  v_total := ROUND((v_pag * 0.40) + (v_vol * 0.25) + (v_rel * 0.20) + (v_rec * 0.15), 1);

  -- Nível
  v_nivel := CASE
    WHEN v_total >= 80 THEN 'A'
    WHEN v_total >= 60 THEN 'B'
    WHEN v_total >= 40 THEN 'C'
    WHEN v_total >= 20 THEN 'D'
    ELSE 'E'
  END;

  -- Limite sugerido (baseado no maior pedido × multiplicador do nível)
  SELECT COALESCE(MAX(valor_total), 0) INTO v_limite
  FROM pedidos WHERE cliente_id = p_cliente_id AND status NOT IN ('cancelado');

  v_limite := v_limite * CASE v_nivel
    WHEN 'A' THEN 3.0
    WHEN 'B' THEN 2.0
    WHEN 'C' THEN 1.5
    WHEN 'D' THEN 1.0
    ELSE 0.5
  END;

  RETURN QUERY SELECT
    v_total, v_pag, v_vol, v_rel, v_rec,
    v_nivel,
    v_limite,
    jsonb_build_object(
      'total_titulos', v_total_titulos,
      'pagos_prazo', v_pagos_prazo,
      'vencidos_abertos', v_vencidos,
      'atraso_medio_dias', v_atraso_medio,
      'faturamento_total', v_faturamento,
      'pedidos_ultimo_ano', v_pedidos_ano,
      'primeiro_pedido', v_primeiro_pedido,
      'ultimo_pedido', v_ultimo_pedido
    );
END;
$$;
```

### Armazenamento do score

```sql
-- Adicionar campos à tabela clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS score_credito NUMERIC(5,1);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS score_nivel TEXT; -- A/B/C/D/E
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS score_atualizado_em TIMESTAMPTZ;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS limite_credito_sugerido NUMERIC(12,2);

-- Job que recalcula scores diariamente (executado pelo agent-cron-loop)
-- Adicionar agent_rule:
INSERT INTO agent_rules (modulo, tipo, nome, descricao, condicao, acao, prioridade, ativo)
VALUES ('financeiro', 'auto_action', 'recalcular_scores',
  'Recalcular score de crédito de todos os clientes diariamente',
  '{"campo": "clientes.score_atualizado_em", "operador": "<", "valor": "CURRENT_DATE"}'::jsonb,
  '{"tipo": "recalcular_scores", "mensagem": "Scores atualizados"}'::jsonb,
  10, true);
```

### Visualização no ERP

No detalhe do cliente (`ClienteDetailPage`), adicionar seção:

```
┌─── SCORE DE CRÉDITO ──────────────┐
│                                    │
│  Score: 78/100  [████████░░] B     │
│                                    │
│  Pagamento:  82  ████████░░        │
│  Volume:     65  ██████░░░░        │
│  Relação:    80  ████████░░        │
│  Recência:   75  ███████░░░        │
│                                    │
│  Limite sugerido: R$ 15.000        │
│  Último cálculo: hoje 08:01        │
│                                    │
│  Histórico: 12 títulos, 10 no      │
│  prazo, atraso médio 2.3 dias      │
└────────────────────────────────────┘
```

---

## Entrega 4.3 — Memory Layer (Aprendizado de Longo Prazo)

### Conceito

A tabela `ai_memory` é o cérebro de longo prazo da IA. Cada padrão detectado é armazenado com nível de confiança, e a confiança aumenta conforme mais observações confirmam o padrão.

### Tipos de memória

| Tipo | Exemplos | Como detectar | Quando usar |
|---|---|---|---|
| `client_pattern` | "Cliente X sempre paga em 45 dias", "Cliente Y prefere boleto" | Análise de contas_receber por cliente | Score de crédito, previsão de recebimento |
| `pricing_pattern` | "Propostas acima de R$5k convertem menos", "Desconto de 10% fecha 80% das vezes" | Análise de propostas aceitas vs rejeitadas | Sugestão de preços ao agente de vendas |
| `production_pattern` | "Banners 1x2m levam 45min na impressão", "ACM tem 30% de retrabalho" | Análise de producao_etapas (estimado vs real) | PCP mais preciso |
| `operational_pattern` | "Terça é dia mais produtivo", "Junho é mês mais fraco" | Análise de pedidos por dia/mês | Planejamento de capacidade |
| `demand_pattern` | "Cliente X faz pedido a cada 60 dias", "Redes de loja pedem mais em janeiro" | Análise de recorrência | Prospecção proativa |

### Função de detecção de padrões

A detecção roda como parte do `agent-cron-loop`, no ciclo noturno (22h):

```sql
-- Exemplo: detectar prazo médio de pagamento por cliente
INSERT INTO ai_memory (chave, tipo, entity_type, entity_id, descricao, valor_numerico, confianca, fonte, observacoes_count)
SELECT
  'prazo_pagamento_medio',
  'client_pattern',
  'cliente',
  cr.cliente_id,
  format('Cliente paga em média %s dias', ROUND(AVG(EXTRACT(DAY FROM cr.data_pagamento - cr.data_emissao)))),
  ROUND(AVG(EXTRACT(DAY FROM cr.data_pagamento - cr.data_emissao))),
  LEAST(95, 30 + COUNT(*) * 10),  -- confiança aumenta com mais observações
  'analise_automatica',
  COUNT(*)
FROM contas_receber cr
WHERE cr.data_pagamento IS NOT NULL AND cr.excluido_em IS NULL
GROUP BY cr.cliente_id
HAVING COUNT(*) >= 2
ON CONFLICT (chave, entity_type, COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'))
DO UPDATE SET
  valor_numerico = EXCLUDED.valor_numerico,
  confianca = EXCLUDED.confianca,
  observacoes_count = EXCLUDED.observacoes_count,
  descricao = EXCLUDED.descricao,
  updated_at = NOW();
```

### Padrões a detectar automaticamente

| # | Padrão | Query base | Frequência |
|---|---|---|---|
| 4.3.1 | Prazo médio pagamento por cliente | contas_receber: AVG(data_pagamento - data_emissao) | Diário |
| 4.3.2 | Taxa de conversão por faixa de preço | propostas: COUNT aceitas / COUNT total GROUP BY faixa_valor | Semanal |
| 4.3.3 | Tempo real vs estimado por tipo de produto | producao_etapas: AVG(tempo_real/tempo_estimado) | Diário |
| 4.3.4 | Dia da semana mais produtivo | ordens_producao: COUNT concluídas GROUP BY DOW | Semanal |
| 4.3.5 | Recorrência de compra por cliente | pedidos: intervalo médio entre pedidos por cliente | Semanal |
| 4.3.6 | Material mais consumido por categoria | estoque_movimentos: SUM por material GROUP BY categoria | Semanal |
| 4.3.7 | Sazonalidade real vs configurada | pedidos: faturamento por mês vs business_intelligence_config | Mensal |

### Unique constraint necessária

```sql
-- Para permitir ON CONFLICT (upsert)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_memory_unique_pattern
ON ai_memory (chave, entity_type, COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'));
```

### Expiração e limpeza

```sql
-- Memórias com confiança < 30 e sem atualização há 90 dias → expirar
DELETE FROM ai_memory
WHERE confianca < 30
AND updated_at < now() - interval '90 days';

-- Memórias expiradas (campo expires_at)
DELETE FROM ai_memory
WHERE expires_at IS NOT NULL AND expires_at < now();
```

---

## Entrega 4.4 — Resumo Diário Inteligente

### Conceito

Todo dia às 22h, o `agent-cron-loop` gera um resumo do dia e envia para Junior via Telegram. O resumo é gerado pela IA (Claude via OpenRouter) com base nos dados reais do dia.

### Fluxo

```
22h → agent-cron-loop (ciclo noturno)
  │
  ├─ 1. Consultar dados do dia via views SQL
  │
  ├─ 2. Montar contexto para Claude
  │
  ├─ 3. Claude gera resumo em linguagem natural
  │
  ├─ 4. Enviar via Telegram Bot API
  │
  └─ 5. Registrar em system_events (daily_summary)
```

### Dados coletados para o resumo

```sql
-- Query de dados do dia
SELECT jsonb_build_object(
  'data', CURRENT_DATE,
  'faturado', (SELECT COALESCE(SUM(valor_pago), 0) FROM contas_receber WHERE data_pagamento = CURRENT_DATE AND excluido_em IS NULL),
  'propostas_criadas', (SELECT COUNT(*) FROM propostas WHERE created_at::date = CURRENT_DATE AND excluido_em IS NULL),
  'propostas_aprovadas', (SELECT COUNT(*) FROM propostas WHERE status = 'aprovada' AND updated_at::date = CURRENT_DATE AND excluido_em IS NULL),
  'pedidos_novos', (SELECT COUNT(*) FROM pedidos WHERE created_at::date = CURRENT_DATE),
  'ops_concluidas', (SELECT COUNT(*) FROM ordens_producao WHERE data_conclusao::date = CURRENT_DATE),
  'leads_novos', (SELECT COUNT(*) FROM leads WHERE created_at::date = CURRENT_DATE),
  'cobrancas_enviadas', (SELECT COUNT(*) FROM cobranca_automatica WHERE created_at::date = CURRENT_DATE),
  'vencidos_pendentes', (SELECT jsonb_build_object('count', COUNT(*), 'valor', COALESCE(SUM(saldo), 0))
    FROM contas_receber WHERE status IN ('aberto','vencido') AND data_vencimento < CURRENT_DATE AND excluido_em IS NULL),
  'eventos_notaveis', (SELECT jsonb_agg(jsonb_build_object('tipo', event_type, 'hora', created_at, 'payload', payload))
    FROM system_events WHERE created_at::date = CURRENT_DATE ORDER BY created_at DESC LIMIT 10)
) as resumo_dia;
```

### Prompt para Claude

```
Você é o assistente executivo da Croma Print. Gere um resumo conciso do dia para o Junior ler no Telegram.

Dados do dia: {resumo_dia}

Regras:
- Máximo 15 linhas
- Português brasileiro, direto e objetivo
- Use emojis para categorias
- Destaque o que precisa de atenção (vencidos, atrasados)
- Feche com uma frase motivacional ou insight útil
- Formato: texto simples (Telegram não suporta markdown complexo)
```

### Exemplo de saída

```
📊 Resumo do dia — 31/03/2026

💰 Faturado: R$ 3.200 (meta mês: 79% atingida)
📝 2 propostas criadas, 1 aprovada
🏭 3 OPs concluídas (eficiência 87%)
👤 4 leads novos pelo WhatsApp

⚠️ Atenção:
- 2 títulos vencidos totalizando R$ 4.300
- Cobrança D3 enviada para Cliente X
- OP-2026-004 atrasada (prazo era ontem)

✅ Destaques:
- Pedido #47 da Renner aprovado (R$ 8.200)
- Lead Beira Rio convertido em cliente

Amanhã tem instalação agendada às 09h.
Boa noite! 🌙
```

---

## Plano de Execução — Waves

### Wave 1 (paralelo, ~2 dias)

| # | Tarefa | Esforço | Dependência |
|---|---|---|---|
| 4.1.1 | Migration: campos score em clientes + unique index ai_memory | ~1h | — |
| 4.1.2 | Views SQL: vw_cockpit_executivo + vw_cockpit_timeline | ~2h | — |
| 4.2.1 | Função SQL fn_calcular_score_credito | ~3h | — |
| 4.3.1 | Queries de detecção de padrões (7 padrões) | ~3h | — |

### Wave 2 (paralelo, ~2 dias)

| # | Tarefa | Esforço | Dependência |
|---|---|---|---|
| 4.1.3 | CockpitExecutivoPage.tsx + 7 componentes | ~8h | 4.1.2 |
| 4.2.2 | Seção Score de Crédito na ClienteDetailPage | ~3h | 4.2.1 |
| 4.3.2 | Integrar detecção de padrões ao agent-cron-loop (ciclo noturno) | ~2h | 4.3.1, Fase 3 |

### Wave 3 (sequencial, ~2 dias)

| # | Tarefa | Esforço | Dependência |
|---|---|---|---|
| 4.4.1 | Resumo diário: query + prompt + envio Telegram | ~3h | 4.1.2 |
| 4.4.2 | Agent rule para recalcular scores diariamente | ~1h | 4.2.1 |
| 4.5.1 | Integrar score ao agente de vendas WhatsApp | ~2h | 4.2.1 |
| 4.5.2 | Rota no menu + proteção | ~30min | 4.1.3 |

### Wave 4 (validação, ~1 dia)

| # | Tarefa | Esforço | Dependência |
|---|---|---|---|
| 4.6.1 | Teste: cockpit com dados reais | ~2h | Tudo |
| 4.6.2 | Teste: score de crédito para 5 clientes | ~1h | 4.2.1 |
| 4.6.3 | Teste: resumo diário no Telegram | ~1h | 4.4.1 |
| 4.6.4 | Teste: detecção de padrões com dados reais | ~1h | 4.3.2 |

---

## Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Poucos dados históricos (2 contas_receber, 3 pedidos) | Score impreciso | Default 50 (neutro) para clientes sem histórico. Confiança baixa até ter +5 observações. |
| Views SQL pesadas | Cockpit lento | Materializar as views mais pesadas (refresh a cada 30min via cron). |
| OpenRouter indisponível | Resumo diário falha | Fallback: enviar dados brutos formatados sem IA. |
| Memory layer com memórias incorretas | Decisões ruins | Confiança mínima de 50 para ser usado em decisões. Expiração automática. |

---

## Exit Criteria

- [ ] Cockpit Executivo operacional com 7 seções (Pulso, Alertas, Financeiro, Produção, Comercial, Automação, Timeline)
- [ ] Score de crédito calculado para todos os clientes com histórico
- [ ] Score visível no detalhe do cliente
- [ ] Memory layer detectando pelo menos 4 tipos de padrão
- [ ] Resumo diário chegando no Telegram do Junior às 22h
- [ ] Agent rule de recalcular scores ativa no cron
- [ ] UX-02 (REQUIREMENTS.md) marcado como concluído

---

## Referências

- ai_memory: 4 padrões iniciais (confiança 40-60%)
- business_intelligence_config: 15 configs (metas, sazonalidade, risco)
- DashboardExecutivoPage: existe mas incompleta (UX-02)
- system_events: 5 eventos (daily_closing, daily_summary)
- Dados atuais: 312 clientes, 3 com pedidos, 2 contas a receber
- Telegram Junior: chat_id 1065519625
- Meta receita: R$ 110k/mês (ajustar por sazonalidade)

---
*Plano criado: 2026-03-31*
*Autor: Claude (cérebro administrativo Croma Print)*
