# Prompts para Claude Code — ERP-Croma: Inteligência Comercial

> **Como usar:** Copie e cole cada prompt diretamente no Claude Code dentro do projeto `C:\Users\Caldera\Claude\CRM-Croma`. Execute na ordem (1 → 2 → 3 → 4), pois cada etapa depende da anterior.

---

## PROMPT 1 — Seed de Dados de Inteligência Comercial no Supabase

```
CONTEXTO: O ERP-Croma é um sistema React 19 + TypeScript + Supabase para a Croma Print, empresa de comunicação visual em São Paulo (zona leste), 4 pessoas. O projeto está em C:\Users\Caldera\Claude\CRM-Croma. Já temos 12 edge functions de IA via OpenRouter.

Temos dados históricos analisados de 1.192 orçamentos (2022-2026) que precisam ser estruturados no banco Supabase para alimentar o agente de vendas e dashboards.

TAREFA: Crie a estrutura de tabelas e faça o seed dos dados de inteligência comercial no Supabase.

PASSO 1 — Criar migration SQL com as seguintes tabelas:

1. `business_intelligence_config` — Configurações gerais de inteligência:
   - id (uuid, PK)
   - key (text, unique) — ex: 'sazonalidade', 'ticket_medio', 'taxa_conversao'
   - value (jsonb) — dados estruturados
   - description (text)
   - updated_at (timestamptz)
   - created_at (timestamptz)

2. `client_intelligence` — Perfil de inteligência por cliente:
   - id (uuid, PK)
   - client_id (uuid, FK → clients) — nullable para dados agregados
   - client_name (text)
   - revenue_share_percent (numeric) — % do faturamento total
   - total_quoted (numeric) — total orçado em R$
   - total_approved (numeric) — total aprovado em R$
   - conversion_rate (numeric) — taxa de conversão %
   - avg_ticket (numeric) — ticket médio em R$
   - preferred_services (text[]) — serviços mais solicitados
   - seasonality_months (int[]) — meses de maior atividade
   - last_order_date (date)
   - risk_level (text) — 'low', 'medium', 'high', 'critical'
   - dependency_alert (boolean) — true se > 30% do faturamento
   - notes (text)
   - updated_at (timestamptz)
   - created_at (timestamptz)

3. `sales_benchmarks` — Benchmarks históricos mensais:
   - id (uuid, PK)
   - year (int)
   - month (int)
   - total_quotes (int) — quantidade de orçamentos
   - total_quoted_value (numeric) — valor total orçado
   - total_approved_value (numeric) — valor total aprovado
   - conversion_rate (numeric)
   - avg_ticket (numeric)
   - top_services (jsonb) — ranking de serviços do mês
   - notes (text)
   - created_at (timestamptz)

4. `alert_rules` — Regras de alertas automáticos:
   - id (uuid, PK)
   - name (text)
   - type (text) — 'stale_quote', 'inactive_client', 'concentration_risk', 'conversion_drop', 'volume_drop'
   - condition (jsonb) — condições do alerta em JSON
   - severity (text) — 'info', 'warning', 'critical'
   - message_template (text) — template da mensagem
   - is_active (boolean)
   - check_interval_hours (int) — de quantas em quantas horas verificar
   - created_at (timestamptz)

5. `alert_history` — Histórico de alertas disparados:
   - id (uuid, PK)
   - alert_rule_id (uuid, FK → alert_rules)
   - triggered_at (timestamptz)
   - context (jsonb) — dados do momento do disparo
   - status (text) — 'new', 'seen', 'resolved', 'dismissed'
   - resolved_at (timestamptz)
   - resolved_by (uuid, FK → profiles)

PASSO 2 — Criar seed SQL inserindo os dados reais:

A) business_intelligence_config — inserir:

- key: 'sazonalidade'
  value: {
    "alta": [1, 2, 3],
    "media": [4, 5, 6, 7, 8, 9, 10],
    "baixa": [11, 12],
    "descricao": "Janeiro-março é alta temporada (showrooms, feiras). Novembro-dezembro são meses fracos.",
    "recomendacao_prospecao": "Intensificar prospecção em outubro-novembro para garantir pipeline em janeiro."
  }

- key: 'ticket_medio_geral'
  value: {
    "2022": 1822,
    "2023": 1950,
    "2024": 2200,
    "2025": 2489,
    "tendencia": "crescente",
    "crescimento_percent": 37
  }

- key: 'taxa_conversao'
  value: {
    "historica": 75,
    "2022": 78,
    "2023": 80,
    "2024": 72,
    "2025": 62,
    "tendencia": "queda",
    "alerta": "Taxa caiu de 80% para 62% — investigar causas (preço? tempo resposta? concorrência?)"
  }

- key: 'volume_orcamentos'
  value: {
    "media_mensal_historica": 24,
    "2022_media": 22,
    "2023_media": 28,
    "2024_media": 26,
    "2025_media": 16,
    "tendencia": "queda_acentuada",
    "alerta": "Volume caiu de 28/mês para 16/mês — necessário aumentar prospecção"
  }

- key: 'concentracao_clientes'
  value: {
    "total_empresas_atendidas": 79,
    "cliente_principal": "Beira Rio",
    "percentual_beira_rio": {"min": 67, "max": 88, "media": 75},
    "risco": "CRÍTICO — depender 75% de um cliente é insustentável",
    "meta_diversificacao": "Reduzir Beira Rio para < 50% até 2027",
    "clientes_potencial_crescimento": ["Pontal", "L. Paulistanas", "Poupa Farma", "Pampili"]
  }

- key: 'servicos_principais'
  value: {
    "ranking": [
      {"servico": "Showroom/Estande", "percentual": 35, "ticket_medio": 4500},
      {"servico": "Banners/Faixas", "percentual": 20, "ticket_medio": 800},
      {"servico": "Placas/Painéis", "percentual": 15, "ticket_medio": 1500},
      {"servico": "Adesivos", "percentual": 12, "ticket_medio": 600},
      {"servico": "Camisetas/Uniformes", "percentual": 10, "ticket_medio": 1200},
      {"servico": "Mobiliário", "percentual": 8, "ticket_medio": 3000}
    ]
  }

- key: 'perfil_operacional'
  value: {
    "equipe": 4,
    "responsavel_orcamentos": "Viviane",
    "capacidade_mensal_orcamentos": 30,
    "gargalo": "Viviane faz 100% dos orçamentos — risco operacional se ficar indisponível",
    "total_orcado_historico": 4300000,
    "total_aprovado_historico": 1700000
  }

B) client_intelligence — inserir perfis dos principais clientes:

- Beira Rio: revenue_share=75, total_quoted=3200000, total_approved=1350000, conversion_rate=80, avg_ticket=3500, preferred_services=['Showroom','Banners','Placas','Mobiliário'], seasonality_months=[1,2,3,6,7], risk_level='critical', dependency_alert=true
- Pontal: revenue_share=5, total_quoted=250000, total_approved=150000, conversion_rate=60, avg_ticket=1800, preferred_services=['Banners','Adesivos'], seasonality_months=[3,4,5,9,10], risk_level='low', dependency_alert=false
- L. Paulistanas: revenue_share=4, total_quoted=180000, total_approved=120000, conversion_rate=67, avg_ticket=1500, preferred_services=['Placas','Adesivos','Banners'], seasonality_months=[2,3,8,9], risk_level='low', dependency_alert=false
- Poupa Farma: revenue_share=3, total_quoted=150000, total_approved=90000, conversion_rate=60, avg_ticket=1200, preferred_services=['Placas','Adesivos','Faixas'], seasonality_months=[1,4,7,10], risk_level='low', dependency_alert=false
- Pampili: revenue_share=3, total_quoted=140000, total_approved=100000, conversion_rate=71, avg_ticket=2000, preferred_services=['Showroom','Banners'], seasonality_months=[1,2,6,7], risk_level='low', dependency_alert=false

C) alert_rules — inserir regras padrão:

1. name: 'Orçamento Parado', type: 'stale_quote', condition: {"days_without_update": 3, "status": "pending"}, severity: 'warning', message_template: 'O orçamento #{quote_number} para {client_name} está parado há {days} dias sem resposta. Sugestão: fazer follow-up agora.', check_interval_hours: 12

2. name: 'Cliente Inativo', type: 'inactive_client', condition: {"months_without_order": 3}, severity: 'warning', message_template: 'O cliente {client_name} está inativo há {months} meses. Último pedido: {last_order_date}. Sugestão: entrar em contato com oferta personalizada.', check_interval_hours: 168

3. name: 'Concentração de Receita Perigosa', type: 'concentration_risk', condition: {"max_revenue_share_percent": 50}, severity: 'critical', message_template: 'ALERTA CRÍTICO: {client_name} representa {percent}% do faturamento. Meta: reduzir para menos de 50%.', check_interval_hours: 720

4. name: 'Queda na Taxa de Conversão', type: 'conversion_drop', condition: {"min_conversion_rate": 65, "period_months": 3}, severity: 'warning', message_template: 'A taxa de conversão dos últimos {period} meses caiu para {rate}% (meta: >65%). Verificar: preços, tempo de resposta, qualidade dos leads.', check_interval_hours: 720

5. name: 'Queda no Volume de Orçamentos', type: 'volume_drop', condition: {"min_monthly_quotes": 20, "period_months": 2}, severity: 'warning', message_template: 'Volume de orçamentos caiu para {count}/mês nos últimos {period} meses (meta: >20/mês). Intensificar prospecção.', check_interval_hours: 720

PASSO 3 — Habilitar RLS nas tabelas novas com policy de leitura para authenticated users e escrita para service_role.

PASSO 4 — Criar as migrations usando o padrão já existente no projeto (verificar pasta supabase/migrations). Gerar o arquivo SQL com nome no padrão do projeto.

PASSO 5 — Criar um arquivo TypeScript de tipos em src/types/ com as interfaces correspondentes às tabelas criadas.

IMPORTANTE:
- Consulte a estrutura existente do banco antes de criar (verificar supabase/migrations/)
- Use o mesmo padrão de nomenclatura e estilo do projeto
- NÃO altere tabelas existentes
- Verifique se já existe alguma tabela similar antes de criar duplicatas
- Após criar, rode `npx supabase db push` ou instruções de como aplicar a migration
```

---

## PROMPT 2 — Configurar Agente de Vendas com Inteligência Comercial

```
CONTEXTO: O ERP-Croma (C:\Users\Caldera\Claude\CRM-Croma) é React 19 + TypeScript + Supabase, com 12 edge functions de IA via OpenRouter. Acabamos de criar tabelas de inteligência comercial no Supabase (business_intelligence_config, client_intelligence, sales_benchmarks, alert_rules, alert_history).

A Croma Print é uma empresa de comunicação visual em SP (zona leste), 4 pessoas. Os dados-chave:
- 1.192 orçamentos históricos, R$ 4,3M orçados, R$ 1,7M aprovados
- 79 empresas atendidas
- Beira Rio = 67-88% do faturamento (risco crítico)
- Ticket médio: R$ 2.489 (crescendo 37%)
- Taxa conversão: caiu de 80% pra 62% em 2025
- Volume: caiu de 28/mês pra 16/mês
- Viviane faz 100% dos orçamentos
- Alta temporada: jan-mar | Baixa: nov-dez

TAREFA: Configurar o agente de vendas (edge function existente ou nova) para usar os dados de inteligência comercial ao interagir com a equipe.

PASSO 1 — Verificar as edge functions existentes:
- Listar todas em supabase/functions/
- Identificar a que faz chat/assistente de vendas (provavelmente ai-chat-portal ou similar)
- Entender como ela se conecta ao OpenRouter e qual model usa

PASSO 2 — Criar uma edge function `ai-sales-intelligence` (ou adaptar a existente) que:

A) Na inicialização, carregue do Supabase:
   - Todos os registros de business_intelligence_config
   - O client_intelligence do cliente sendo discutido (se aplicável)
   - Alertas ativos de alert_history (status = 'new')

B) Monte um system prompt rico para o LLM com essas seções:

```
Você é o assistente comercial da Croma Print, empresa de comunicação visual em São Paulo.

## CONTEXTO DA EMPRESA
- Equipe de 4 pessoas, Viviane responsável por todos os orçamentos
- Faturamento histórico: R$ 1,7M aprovados de R$ 4,3M orçados
- 79 empresas atendidas ao longo de 4 anos
- Capacidade: ~30 orçamentos/mês

## DADOS DE INTELIGÊNCIA (carregados dinamicamente)
{dados do business_intelligence_config formatados}

## PERFIL DO CLIENTE ATUAL (se houver)
{dados do client_intelligence}

## ALERTAS ATIVOS
{alertas pendentes}

## SUAS DIRETRIZES
1. PRIORIZAÇÃO DE LEADS:
   - Clientes com histórico de alta conversão → prioridade máxima
   - Clientes novos no setor de calçados/moda (perfil similar ao Beira Rio) → alta prioridade
   - Período de alta temporada (jan-mar) → urgência em todos os follow-ups
   - Clientes inativos há 3+ meses → oportunidade de reativação

2. SUGESTÕES DE FOLLOW-UP:
   - Orçamento parado 2+ dias → sugerir follow-up com script personalizado
   - Usar histórico do cliente para personalizar abordagem
   - Em meses fracos (nov-dez), sugerir promoções ou antecipação de demanda
   - Sempre mencionar cases de sucesso relevantes ao serviço solicitado

3. PERSONALIZAÇÃO DE ABORDAGEM:
   - Para Beira Rio: foco em qualidade, prazo, e proatividade (cliente VIP)
   - Para novos clientes: apresentar portfólio diversificado, enfatizar experiência com grandes marcas
   - Para clientes inativos: oferta especial ou novidade no portfólio
   - Para clientes de ticket baixo: sugerir upsell com serviços complementares

4. ALERTAS DE RISCO:
   - Se concentração Beira Rio > 60%: mencionar necessidade de diversificação
   - Se taxa conversão < 65%: sugerir revisão de pricing ou follow-up mais rápido
   - Se volume < 20/mês: recomendar ações de prospecção ativa

5. INTELIGÊNCIA SAZONAL:
   - Out-Nov: prospectar ativamente para pipeline de janeiro
   - Jan-Mar: foco em execução e upsell
   - Abr-Out: equilibrar prospecção e execução
   - Nov-Dez: promoções e fidelização

6. FORMATO DAS RESPOSTAS:
   - Seja direto e prático (equipe pequena, sem tempo para relatórios longos)
   - Sempre sugira UMA ação concreta imediata
   - Use dados para justificar sugestões ("Baseado no histórico, este cliente tem 80% de chance de aprovar")
   - Priorize em ordem: urgente > importante > rotina
```

C) Implemente os seguintes endpoints/funções dentro da edge function:

   1. `POST /ai-sales-intelligence` — Chat geral com o assistente
      - Recebe: { message: string, client_id?: string, quote_id?: string }
      - Retorna: resposta do LLM com contexto de inteligência

   2. `POST /ai-sales-intelligence/suggest-followup` — Sugestão de follow-up
      - Recebe: { quote_id: string }
      - Carrega dados do orçamento + cliente + histórico
      - Retorna: script de follow-up personalizado com timing sugerido

   3. `POST /ai-sales-intelligence/prioritize-leads` — Priorização do dia
      - Não recebe parâmetros
      - Analisa: orçamentos pendentes, clientes inativos, sazonalidade
      - Retorna: lista priorizada de ações para o dia

   4. `POST /ai-sales-intelligence/analyze-client` — Análise de cliente
      - Recebe: { client_id: string }
      - Retorna: perfil completo com recomendações, risco, oportunidades

PASSO 3 — Criar o hook/service no frontend para consumir a edge function:
- Criar src/services/salesIntelligenceService.ts com funções para cada endpoint
- Criar src/hooks/useSalesIntelligence.ts com React Query

PASSO 4 — Integrar com o chat existente (se houver componente de chat no projeto):
- Verificar se existe componente de chat
- Adicionar opção de "Assistente Comercial" que usa a nova edge function
- O chat deve mostrar os alertas ativos como cards no topo

IMPORTANTE:
- Use OpenRouter como provider de LLM (mesmo padrão das 12 edge functions existentes)
- Verifique qual modelo está sendo usado nas outras functions e use o mesmo
- Mantenha o padrão de autenticação já existente (JWT do Supabase)
- Trate erros com mensagens em português
- O system prompt deve ser construído DINAMICAMENTE a cada chamada (dados sempre atualizados)
- Mantenha logs de cada interação para análise futura
```

---

## PROMPT 3 — Dashboard de Inteligência Comercial

```
CONTEXTO: O ERP-Croma (C:\Users\Caldera\Claude\CRM-Croma) é React 19 + TypeScript + Supabase. Já temos tabelas de inteligência comercial populadas (business_intelligence_config, client_intelligence, sales_benchmarks, alert_rules, alert_history) e o agente de vendas configurado.

A Croma Print tem esses dados-chave:
- R$ 4,3M orçados, R$ 1,7M aprovados (2022-2026)
- 79 empresas, Beira Rio = ~75% do faturamento
- Ticket médio R$ 2.489, tendência de alta
- Conversão caiu de 80% → 62%
- Volume caiu de 28 → 16 orçamentos/mês
- Alta temporada: jan-mar, baixa: nov-dez

TAREFA: Criar um dashboard de inteligência comercial completo como nova página do ERP.

PASSO 1 — Verificar a estrutura de rotas e componentes existentes:
- Conferir como as páginas são organizadas (src/pages/, src/routes/, etc.)
- Ver quais bibliotecas de UI e gráficos já estão instaladas (shadcn? recharts? chart.js?)
- Seguir exatamente o mesmo padrão de layout, sidebar, e estilo das páginas existentes

PASSO 2 — Criar a página src/pages/BusinessIntelligence.tsx (ou no padrão do projeto) com estes blocos:

### BLOCO 1 — KPIs Principais (cards no topo)
4 cards em uma row:
- **Pipeline Atual**: valor total de orçamentos pendentes + quantidade | cor verde se > R$ 50k, amarelo se < R$ 50k, vermelho se < R$ 20k
- **Taxa de Conversão** (últimos 90 dias): % com seta de tendência (↑ ou ↓) comparando com período anterior | verde se > 70%, amarelo 60-70%, vermelho < 60%
- **Ticket Médio** (últimos 90 dias): valor em R$ com tendência | comparação com mesmo período ano anterior
- **Volume Mensal**: orçamentos no mês corrente vs meta (20/mês) | barra de progresso

### BLOCO 2 — Gráfico de Sazonalidade (meia largura, esquerda)
- Gráfico de barras agrupadas: meses (x) vs valor orçado e aprovado (y)
- Linha overlay com taxa de conversão por mês
- Dados dos últimos 12 meses + mesmo período ano anterior para comparação
- Highlight nos meses de alta/baixa temporada com cores diferentes
- Carregar de sales_benchmarks

### BLOCO 3 — Concentração de Clientes (meia largura, direita)
- Gráfico de pizza/donut mostrando % do faturamento por cliente (top 10)
- Beira Rio com cor vermelha/destaque indicando risco
- Legenda com nome do cliente e %
- Abaixo: barra de progresso "Meta de Diversificação: Beira Rio hoje X% → meta <50%"
- Carregar de client_intelligence

### BLOCO 4 — Pipeline de Vendas (largura total)
- Tabela com orçamentos pendentes, ordenados por prioridade:
  - Colunas: Cliente | Serviço | Valor | Dias Parado | Probabilidade | Ação Sugerida
  - "Probabilidade" calculada com base no histórico do cliente (conversion_rate)
  - "Ação Sugerida" = texto curto gerado a partir das regras (ex: "Follow-up urgente", "Enviar proposta revisada")
  - Linha fica vermelha se parado > 5 dias, amarela se > 3 dias
  - Botão "Gerar Follow-up" que chama a edge function ai-sales-intelligence/suggest-followup
- Carregar de quotes (tabela existente) + client_intelligence

### BLOCO 5 — Alertas Ativos (sidebar ou seção destacada)
- Cards com alertas de alert_history (status = 'new' ou 'seen')
- Cada card mostra: ícone de severidade, mensagem formatada, horário, botões "Resolver" / "Dispensar"
- Ordenar por severidade (critical primeiro) e depois por data
- Ao clicar "Resolver": atualiza status para 'resolved' e abre modal para anotar resolução
- Badge com contador de alertas no menu lateral (sidebar)

### BLOCO 6 — Tendências (largura total, abaixo)
- Gráfico de linhas com 3 séries: Volume mensal, Ticket médio, Taxa de conversão
- Eixo X: últimos 24 meses
- Toggle para alternar entre valor absoluto e variação %
- Anotações nos pontos de inflexão relevantes

PASSO 3 — Adicionar a rota no router do projeto:
- Path: /intelligence ou /inteligencia (verificar idioma usado no projeto)
- Menu item na sidebar com ícone adequado (Brain, TrendingUp, ou BarChart)
- Proteger com autenticação (mesmo padrão das outras rotas)

PASSO 4 — Criar os hooks e services necessários:
- src/hooks/useBusinessIntelligence.ts — queries para business_intelligence_config
- src/hooks/useClientIntelligence.ts — queries para client_intelligence
- src/hooks/useSalesBenchmarks.ts — queries para sales_benchmarks
- src/hooks/useAlerts.ts — queries e mutations para alert_history
- Usar React Query (ou o que o projeto já usa) com cache e invalidação adequados

PASSO 5 — Componentes reutilizáveis (se ainda não existirem):
- KPICard.tsx — card de KPI com valor, tendência, cor condicional
- TrendChart.tsx — gráfico de tendência reutilizável
- AlertCard.tsx — card de alerta com ações
- PriorityBadge.tsx — badge de prioridade (alta/média/baixa)

IMPORTANTE:
- Use EXATAMENTE as mesmas bibliotecas de UI e gráficos já instaladas no projeto (não adicione novas sem necessidade)
- Siga o design system existente (cores, fontes, espaçamentos, componentes)
- Todos os textos em português brasileiro
- Valores monetários formatados como R$ X.XXX,XX (padrão brasileiro)
- Responsivo (funcionar em tela cheia e tablets)
- Loading states e empty states para cada bloco
- O dashboard deve carregar dados REAIS das tabelas criadas no Prompt 1
- Se algum dado ainda não existir (ex: sales_benchmarks vazio), mostrar estado vazio elegante com mensagem "Dados sendo coletados..."
```

---

## PROMPT 4 — Sistema de Alertas Automáticos

```
CONTEXTO: O ERP-Croma (C:\Users\Caldera\Claude\CRM-Croma) é React 19 + TypeScript + Supabase com edge functions. Já temos:
- Tabelas de inteligência comercial (business_intelligence_config, client_intelligence, sales_benchmarks, alert_rules, alert_history)
- Agente de vendas com IA (ai-sales-intelligence)
- Dashboard de inteligência comercial

Dados da Croma Print:
- Beira Rio = ~75% do faturamento (risco crítico)
- Conversão caiu de 80% → 62% em 2025
- Volume caiu de 28 → 16 orçamentos/mês
- Alta temporada: jan-mar, baixa: nov-dez
- Viviane faz 100% dos orçamentos

TAREFA: Implementar o sistema de alertas automáticos que monitora o banco de dados e dispara alertas baseados nas regras configuradas.

PASSO 1 — Criar edge function `check-alerts` que roda periodicamente:

A) A função deve consultar alert_rules (is_active = true) e para cada regra:

1. **Orçamento Parado** (type: 'stale_quote'):
   - Consultar tabela de quotes/orçamentos existente
   - Filtrar: status = 'pending' E updated_at < NOW() - interval '{days_without_update} days'
   - Para cada orçamento encontrado, criar registro em alert_history com:
     - context: { quote_id, quote_number, client_name, value, days_stale, client_phone, last_interaction }
     - Não duplicar: verificar se já existe alerta ativo (status != 'resolved') para o mesmo quote_id

2. **Cliente Inativo** (type: 'inactive_client'):
   - Consultar clients + última quote/order com status 'approved'
   - Filtrar: clientes que tiveram ao menos 2 orçamentos aprovados MAS último aprovado há mais de {months_without_order} meses
   - context: { client_id, client_name, last_order_date, months_inactive, total_historical_value, preferred_services }
   - Não duplicar: 1 alerta por cliente inativo (verificar existente)

3. **Concentração de Receita** (type: 'concentration_risk'):
   - Calcular % de faturamento dos últimos 12 meses por cliente
   - Se qualquer cliente > {max_revenue_share_percent}%: alertar
   - context: { client_name, current_percent, threshold, total_revenue_12m, client_revenue_12m }
   - Recalcular mensalmente (verificar último alerta deste tipo)

4. **Queda na Conversão** (type: 'conversion_drop'):
   - Calcular taxa de conversão dos últimos {period_months} meses
   - Se < {min_conversion_rate}%: alertar
   - context: { current_rate, threshold, period, total_quotes, approved_quotes, comparison_previous_period }

5. **Queda no Volume** (type: 'volume_drop'):
   - Calcular média de orçamentos/mês dos últimos {period_months} meses
   - Se < {min_monthly_quotes}: alertar
   - context: { current_avg, threshold, period, monthly_breakdown }

B) A função deve ser idempotente — rodar múltiplas vezes sem criar duplicatas.

PASSO 2 — Configurar execução periódica:
- Usar pg_cron do Supabase (se disponível) OU
- Criar um cron job via Supabase scheduled functions OU
- Implementar via pg_net + pg_cron para chamar a edge function periodicamente
- Frequência padrão: a cada 12 horas para orçamentos parados, diário para os demais
- Documentar no README como configurar o cron

SQL para pg_cron (se disponível):
```sql
SELECT cron.schedule(
  'check-alerts-frequent',
  '0 8,20 * * *',  -- 8h e 20h todo dia
  $$SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/check-alerts',
    headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb
  )$$
);
```

PASSO 3 — Criar sistema de notificação no frontend:

A) Componente `AlertNotificationBell` para a navbar/header:
   - Ícone de sino com badge contador de alertas não lidos
   - Ao clicar: dropdown com últimos 10 alertas
   - Cada item: ícone de severidade + mensagem resumida + tempo relativo ("há 2h")
   - Link "Ver todos" que leva ao dashboard de inteligência
   - Polling a cada 5 minutos OU usar Supabase Realtime para atualizar em tempo real

B) Configurar Supabase Realtime na tabela alert_history:
   - Subscription para INSERT na alert_history
   - Ao receber novo alerta critical: mostrar toast/notificação na tela
   - Ao receber warning: apenas atualizar o badge do sino

C) Página de configuração de alertas (pode ser seção nas configurações):
   - Listar alert_rules com toggle on/off
   - Permitir editar os thresholds de cada regra (dias, meses, percentuais)
   - Preview da regra: "Se um orçamento ficar parado por mais de [3] dias..."
   - Botão "Testar agora" que executa a verificação manualmente

PASSO 4 — Criar edge function `resolve-alert`:
   - POST /resolve-alert com { alert_id, resolution_note }
   - Atualiza alert_history: status = 'resolved', resolved_at = now(), resolved_by = user_id
   - Se era alerta de orçamento parado: verificar se houve follow-up registrado
   - Retornar alerta atualizado

PASSO 5 — Criar edge function `alert-daily-digest`:
   - Função que gera resumo diário dos alertas
   - Usa o LLM (via OpenRouter) para criar um resumo em linguagem natural:
     "Bom dia! Hoje você tem: 3 orçamentos parados (R$ 12.500 em pipeline), 2 clientes para reativar, e a concentração no Beira Rio está em 72%. Sugestão: priorize o follow-up do orçamento #456 da Pontal (R$ 5.200, parado há 4 dias)."
   - Pode ser mostrado como card no topo do dashboard quando o usuário logar
   - Armazenar o digest em uma tabela ou cache para não regenerar a cada refresh

PASSO 6 — Integrar alertas com o agente de vendas:
   - Quando o usuário perguntar algo ao agente, incluir alertas ativos no contexto
   - O agente deve mencionar alertas relevantes proativamente:
     Ex: "Antes de falar sobre o novo orçamento, quero avisar que o orçamento #123 da Pontal está parado há 5 dias. Quer que eu gere um script de follow-up?"

IMPORTANTE:
- Todas as queries devem usar o padrão de acesso ao Supabase já existente no projeto
- Edge functions devem seguir o mesmo padrão das 12 já existentes (CORS, auth, error handling)
- Timestamps em horário de Brasília (America/Sao_Paulo) nas mensagens para o usuário
- A verificação de duplicatas é CRÍTICA — alertas duplicados destroem a credibilidade do sistema
- Começar com thresholds conservadores (menos alertas no início, ajustar depois)
- Logar cada execução do check-alerts para debugging
- Se Supabase Realtime não estiver habilitado, usar polling como fallback
- Testar manualmente chamando a edge function antes de configurar o cron
```

---

## Ordem de Execução Recomendada

1. **Prompt 1** primeiro — cria a base de dados
2. **Prompt 2** segundo — configura o agente que usa os dados
3. **Prompt 3** terceiro — cria a interface visual
4. **Prompt 4** por último — liga o sistema de alertas que depende de tudo anterior

> **Dica:** Após cada prompt, valide que as tabelas/functions foram criadas corretamente antes de passar para o próximo. Se o Claude Code sugerir ajustes por conta da estrutura existente do projeto, aceite — ele está adaptando ao que já existe.
