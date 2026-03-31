# FASE 5 — Conversacional

> **Objetivo**: Permitir que Junior (e futuros usuários) interajam com o ERP usando linguagem natural — fazer perguntas, pedir relatórios, executar ações, tudo como se estivessem conversando com um colega que conhece cada detalhe da empresa.
> **Estimativa**: 6-8 dias de desenvolvimento
> **Pré-requisitos**: Fase 4 concluída (cockpit, scores e memory layer ativos)
> **Criado**: 2026-03-31

---

## Diagnóstico — O que existe hoje

### Infraestrutura já construída

| Componente | Status | Detalhes |
|---|---|---|
| `ai_requests` (tabela) | ✅ Existe | Ponte MCP: tipo, entity_type, entity_id, contexto (JSONB), status, processed_at |
| `ai_responses` (tabela) | ✅ Existe | request_id, conteudo (JSONB), summary, actions (JSONB), model_used, tokens_used, cost_usd |
| `agent_conversations` | ✅ Existe | canal, lead_id, etapa, status, score_engajamento, auto_aprovacao, metadata |
| `agent_messages` | ✅ Existe | conversation_id, canal, direcao, conteudo, assunto, status, modelo_ia, custo_ia |
| `ai_logs` | ✅ Existe | function_name, model_used, tokens_input/output, cost_usd, duration_ms |
| AI Sidebar | ✅ 20+ appliers | Sidebar com contexto adaptativo por página |
| 12 Edge Functions IA | ✅ Deployadas | ai-gerar-orcamento, ai-compor-mensagem, ai-analisar-*, etc. |
| ChatERP componente | ⚠️ Criado mas não integrado | UX-01 done, mas nunca plugado no ERP real |
| OpenRouter provider | ✅ Operacional | callOpenRouter() com fallback, JSON extraction |
| MCP Server Croma | ✅ 26 ferramentas | Interface oficial para todas operações de dados |

### O que FALTA

1. **Chat como interface principal** — o ChatERP existe como componente mas não está conectado a nenhum backend de processamento de linguagem natural
2. **Interpretação de intenção** — traduzir "quanto faturamos esse mês?" para a query SQL correta
3. **Execução segura** — executar consultas sem permitir SQL injection ou alterações não autorizadas
4. **Contexto de conversa** — manter histórico para perguntas encadeadas ("e o mês passado?")
5. **Relatórios por linguagem natural** — "gera um relatório de vendas do trimestre" → PDF/Excel
6. **Actions** — "cria um orçamento para o cliente X" → executa via MCP/Edge Functions

---

## Entrega 5.1 — Chat ERP Backend (Edge Function)

### Conceito

Uma Edge Function (`ai-chat-erp`) que recebe mensagens em linguagem natural e responde com dados reais do sistema. Usa um pipeline de 3 estágios:

```
Mensagem do usuário
    │
    ▼
┌── ESTÁGIO 1: Classificação de intenção ──┐
│  Claude classifica a mensagem como:       │
│  - CONSULTA (leitura de dados)            │
│  - AÇÃO (escrita/alteração)               │
│  - RELATÓRIO (geração de documento)       │
│  - CONVERSA (papo sem dados)              │
│  - AJUDA (como usar o sistema)            │
└───────────────┬───────────────────────────┘
                │
                ▼
┌── ESTÁGIO 2: Geração de plano ────────────┐
│  Claude gera um "plano de execução":      │
│  - Para CONSULTA: query SQL segura        │
│  - Para AÇÃO: chamada MCP/Edge Function   │
│  - Para RELATÓRIO: query + formato        │
│  - Para CONVERSA: resposta direta         │
└───────────────┬───────────────────────────┘
                │
                ▼
┌── ESTÁGIO 3: Execução + Resposta ─────────┐
│  - Executa a query/ação                   │
│  - Formata o resultado em linguagem       │
│    natural para o usuário                 │
│  - Registra em ai_logs                    │
└───────────────────────────────────────────┘
```

### Arquivo: `supabase/functions/ai-chat-erp/index.ts`

```typescript
// Estrutura do request
interface ChatRequest {
  message: string;
  conversation_id?: string;  // para manter contexto
  user_id: string;
  context?: {
    current_page?: string;   // ex: "/pedidos/123"
    selected_entity?: { type: string; id: string };
  };
}

// Estrutura do response
interface ChatResponse {
  message: string;           // resposta em linguagem natural
  data?: any;                // dados estruturados (para renderização)
  actions?: ChatAction[];    // botões de ação sugeridos
  visualization?: {
    type: 'table' | 'chart' | 'card' | 'list';
    config: any;
  };
  sql_executed?: string;     // para transparência (apenas consultas)
}

interface ChatAction {
  label: string;
  action: string;            // ex: "navigate:/pedidos/123"
  confirm?: boolean;         // requer confirmação do usuário
}
```

### Estágio 1 — Classificação de intenção

System prompt para classificação:

```
Você é o classificador de intenções do ERP da Croma Print.
Classifique a mensagem do usuário em uma das categorias:

CONSULTA — Perguntas sobre dados (faturamento, estoque, pedidos, clientes, etc.)
ACAO — Pedido para criar, alterar ou deletar algo no sistema
RELATORIO — Pedido para gerar relatório, exportar dados, criar documento
CONVERSA — Conversa casual, saudação, agradecimento
AJUDA — Pergunta sobre como usar o sistema

Responda APENAS com JSON:
{"intent": "CONSULTA|ACAO|RELATORIO|CONVERSA|AJUDA", "entities": [...], "confidence": 0.0-1.0}

Exemplos de entities: {"type": "cliente", "value": "Renner"}, {"type": "periodo", "value": "este mês"}, {"type": "produto", "value": "banner 1x2m"}
```

### Estágio 2 — Geração de plano

#### Para CONSULTA — Text-to-SQL

System prompt para geração de SQL:

```
Você é um gerador de SQL para o ERP da Croma Print (PostgreSQL/Supabase).
Gere APENAS queries SELECT seguras. Nunca INSERT/UPDATE/DELETE.

Schema disponível:
- clientes (id, nome, email, telefone, endereco, tipo_pessoa, cnpj_cpf, score_credito, score_nivel)
- pedidos (id, numero, cliente_id, status, valor_total, data_entrega, created_at)
- propostas (id, numero, cliente_id, status, valor_total, share_token, created_at)
- leads (id, contato_nome, contato_email, empresa, score, status, canal_origem, created_at)
- contas_receber (id, pedido_id, cliente_id, valor_original, saldo, data_vencimento, data_pagamento, status)
- contas_pagar (id, fornecedor, valor_original, data_vencimento, status)
- ordens_producao (id, numero, pedido_id, status, prioridade, maquina_id, prazo_interno)
- ordens_instalacao (id, numero, pedido_id, cliente_id, status, data_agendada)
- materiais (id, nome, unidade, estoque_atual, estoque_minimo, preco_medio)
- cobranca_automatica (id, conta_receber_id, cliente_id, nivel, canal, status, dias_atraso, created_at)
- system_events (id, event_type, entity_type, entity_id, payload, processed, created_at)
- ai_memory (id, chave, tipo, entity_type, valor_numerico, valor_texto, confianca)
- maquinas (id, nome, tipo, custo_hora, ativo)

Status possíveis:
- pedidos: rascunho, orcamento, aprovado, em_producao, pronto_instalacao, aguardando_instalacao, em_instalacao, concluido, faturar, faturado, entregue, cancelado
- propostas: rascunho, enviada, negociacao, aprovada, rejeitada, expirada
- leads: novo, contatado, qualificado, proposta_enviada, convertido, perdido, descartado
- contas_receber: pendente, aberto, vencido, pago, cancelado

Regras:
1. SEMPRE incluir WHERE excluido_em IS NULL quando a tabela tem esse campo
2. Usar COALESCE para evitar NULLs em somas
3. Limitar resultados a 50 linhas (LIMIT 50)
4. Para períodos: 'este mês' = date_trunc('month', CURRENT_DATE), 'hoje' = CURRENT_DATE
5. Formatar valores como R$ quando for dinheiro
6. JOINs devem ser LEFT JOIN para não perder dados

Responda com JSON: {"sql": "...", "description": "O que essa query faz"}
```

#### Para AÇÃO — Mapeamento para MCP/Edge Functions

```
Ações permitidas e seus mapeamentos:

"cadastrar lead" → INSERT em leads (requer: contato_nome, canal_origem)
"criar orçamento" → chamar ai-gerar-orcamento Edge Function
"enviar proposta" → chamar agent-enviar-email Edge Function
"atualizar status pedido" → UPDATE pedidos SET status (com validação de transição)
"agendar instalação" → UPDATE ordens_instalacao SET data_agendada
"registrar pagamento" → UPDATE contas_receber SET data_pagamento, status

REGRA: Toda ação DEVE retornar confirmação antes de executar.
Resposta: {"action": "...", "params": {...}, "confirm_message": "Vou fazer X. Confirma?"}
```

#### Para RELATÓRIO — Templates de relatório

```
Relatórios disponíveis:
1. Vendas por período → query + formato Excel/PDF
2. Contas a receber → query + Excel
3. Produção (OPs) → query + PDF
4. Funil comercial → query + gráfico
5. Estoque baixo → query + tabela
6. Clientes inativos → query + tabela
7. Score de crédito → fn_calcular_score_credito + tabela

Resposta: {"report_type": "...", "query": "...", "format": "excel|pdf|table", "title": "..."}
```

### Estágio 3 — Execução + Formatação

```typescript
async function executeAndFormat(plan: ExecutionPlan, supabase: SupabaseClient) {
  switch (plan.intent) {
    case 'CONSULTA': {
      // Validar SQL (apenas SELECT)
      if (!plan.sql.trim().toUpperCase().startsWith('SELECT')) {
        return { message: 'Só consigo executar consultas de leitura.' };
      }
      const { data, error } = await supabase.rpc('execute_readonly_query', { query: plan.sql });
      if (error) return { message: `Erro na consulta: ${error.message}` };

      // Claude formata o resultado em linguagem natural
      const formatted = await formatResultWithAI(data, plan.description, originalMessage);
      return { message: formatted, data, sql_executed: plan.sql };
    }

    case 'ACAO': {
      // Retorna confirmação (não executa ainda)
      return {
        message: plan.confirm_message,
        actions: [{
          label: 'Confirmar',
          action: `execute:${JSON.stringify(plan)}`,
          confirm: true
        }]
      };
    }

    case 'RELATORIO': {
      // Executa query e gera relatório
      const { data } = await supabase.rpc('execute_readonly_query', { query: plan.query });
      // Gera link para download
      return {
        message: `Relatório "${plan.title}" gerado com ${data.length} registros.`,
        data,
        visualization: { type: 'table', config: { columns: Object.keys(data[0] || {}) } }
      };
    }

    case 'CONVERSA':
      return { message: plan.response };

    case 'AJUDA':
      return { message: plan.help_text };
  }
}
```

### RPC segura para queries de leitura

```sql
-- Função que executa apenas SELECTs (segurança)
CREATE OR REPLACE FUNCTION execute_readonly_query(query TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result JSONB;
  v_clean TEXT;
BEGIN
  -- Sanitizar: remover comments
  v_clean := regexp_replace(query, '--.*$', '', 'gm');
  v_clean := regexp_replace(v_clean, '/\*.*?\*/', '', 'g');
  v_clean := TRIM(v_clean);

  -- Validar: apenas SELECT
  IF NOT (UPPER(v_clean) ~ '^(SELECT|WITH)') THEN
    RAISE EXCEPTION 'Apenas consultas SELECT são permitidas';
  END IF;

  -- Bloquear palavras perigosas
  IF UPPER(v_clean) ~ '(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXECUTE|COPY)' THEN
    RAISE EXCEPTION 'Operação não permitida em consulta de leitura';
  END IF;

  -- Forçar LIMIT se não especificado
  IF NOT (UPPER(v_clean) ~ 'LIMIT\s+\d+') THEN
    v_clean := v_clean || ' LIMIT 100';
  END IF;

  -- Executar
  EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', v_clean) INTO v_result;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
```

---

## Entrega 5.2 — Chat ERP Frontend (Componente React)

### Conceito

O ChatERP já existe como componente (UX-01). Precisa ser:
1. Conectado ao backend `ai-chat-erp`
2. Posicionado como floating button no canto inferior direito (como um Intercom)
3. Renderizar respostas ricas (tabelas, gráficos, botões de ação)

### Componentes

```
src/domains/ai/components/
  ChatERP.tsx              — container principal (floating panel)
  ChatMessage.tsx          — bolha de mensagem (user ou AI)
  ChatDataTable.tsx        — renderizar resultados tabulares
  ChatActionButton.tsx     — botão de ação com confirmação
  ChatVisualization.tsx    — gráfico inline (Recharts)
  ChatReportLink.tsx       — link para download de relatório
```

### Layout

```
┌── Chat ERP ───────────────────┐
│  ┌─ HEADER ─────────────────┐ │
│  │ 🤖 Assistente Croma  [x] │ │
│  └──────────────────────────┘ │
│                                │
│  ┌─ MESSAGES ───────────────┐ │
│  │                          │ │
│  │  Oi! Como posso ajudar?  │ │
│  │                          │ │
│  │    Quanto faturamos   ◄──│ │
│  │    esse mês?             │ │
│  │                          │ │
│  │  O faturamento em março  │ │
│  │  foi de R$ 87.400, que   │ │
│  │  representa 79% da meta  │ │
│  │  de R$ 110.000.          │ │
│  │                          │ │
│  │  ┌────────────────────┐  │ │
│  │  │ Cliente  │ Valor   │  │ │
│  │  │ Renner   │ R$ 32k  │  │ │
│  │  │ Beira R. │ R$ 28k  │  │ │
│  │  │ Outros   │ R$ 27k  │  │ │
│  │  └────────────────────┘  │ │
│  │                          │ │
│  │  [Ver relatório completo]│ │
│  │                          │ │
│  └──────────────────────────┘ │
│                                │
│  ┌─ INPUT ──────────────────┐ │
│  │ Digite sua pergunta...  ⏎│ │
│  └──────────────────────────┘ │
└────────────────────────────────┘
```

### Exemplos de interação

| Pergunta do usuário | Intenção | Resposta |
|---|---|---|
| "quanto faturamos esse mês?" | CONSULTA | "Em março, o faturamento foi R$ 87.400 (79% da meta)." + tabela por cliente |
| "quais pedidos estão atrasados?" | CONSULTA | "Há 1 pedido atrasado:" + tabela com detalhes |
| "estoque de vinil adesivo" | CONSULTA | "Vinil adesivo branco: 45m² (mínimo: 50m²) ⚠️ Abaixo do mínimo" |
| "cadastra um lead: João Silva, Loja ABC, (51)99999" | AÇÃO | "Vou cadastrar o lead João Silva (Loja ABC). Confirma?" + botão |
| "gera relatório de vendas do trimestre" | RELATÓRIO | "Relatório gerado com 47 registros." + link download |
| "como faço para criar um pedido?" | AJUDA | Explicação passo a passo |
| "bom dia!" | CONVERSA | "Bom dia, Junior! Posso ajudar com algo hoje?" |
| "e o mês passado?" | CONSULTA (contexto) | Entende que se refere ao faturamento de fevereiro |

### Contexto de conversa

O chat mantém histórico na `agent_conversations` + `agent_messages`:

```typescript
// Ao enviar mensagem
const conversation = await getOrCreateConversation(userId, 'erp_chat');

// Salvar mensagem do usuário
await saveMessage(conversation.id, 'inbound', message);

// Buscar últimas 10 mensagens para contexto
const history = await getHistory(conversation.id, 10);

// Incluir no prompt do Claude
const contextMessages = history.map(m => ({
  role: m.direcao === 'inbound' ? 'user' : 'assistant',
  content: m.conteudo
}));
```

---

## Entrega 5.3 — Relatórios por Linguagem Natural

### Conceito

O usuário pede "gera um relatório de X" e o sistema:
1. Identifica qual relatório e os parâmetros
2. Executa as queries necessárias
3. Gera o documento (PDF ou Excel)
4. Retorna link de download

### Templates de relatório pré-definidos

| # | Relatório | Trigger phrases | Query base | Formato |
|---|---|---|---|---|
| R1 | Vendas por período | "vendas", "faturamento", "receita" | contas_receber + pedidos | Excel + PDF |
| R2 | Contas a receber | "a receber", "títulos", "inadimplência" | contas_receber + clientes | Excel |
| R3 | Produção | "produção", "OPs", "fábrica" | ordens_producao + etapas | PDF |
| R4 | Funil comercial | "funil", "pipeline", "conversão" | leads + propostas + pedidos | PDF com gráfico |
| R5 | Estoque crítico | "estoque", "materiais baixos" | materiais WHERE estoque_atual <= estoque_minimo | Excel |
| R6 | Clientes inativos | "clientes sem compra", "inativos" | clientes sem pedido há 180+ dias | Excel |
| R7 | Eficiência produção | "eficiência", "tempo real vs estimado" | producao_etapas: estimado vs real | PDF |
| R8 | Score de crédito | "scores", "crédito", "risco" | fn_calcular_score_credito para todos | Excel |
| R9 | Cobranças automáticas | "cobranças", "cobrança automática" | cobranca_automatica | Excel |
| R10 | Resumo executivo | "resumo", "overview", "visão geral" | vw_cockpit_executivo + gráficos | PDF |

### Geração de documentos

Reutilizar infraestrutura existente:
- **Excel**: biblioteca `xlsx` já usada nos relatórios do Sprint 4
- **PDF**: biblioteca `html2pdf` já usada nos relatórios do Sprint 4
- **Storage**: salvar no Supabase Storage (bucket `relatorios`) com URL temporária

```typescript
async function generateReport(plan: ReportPlan, data: any[]) {
  if (plan.format === 'excel') {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, sheet, plan.title);
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Upload para Supabase Storage
    const path = `relatorios/${Date.now()}-${plan.title.replace(/\s/g, '_')}.xlsx`;
    await supabase.storage.from('relatorios').upload(path, buffer);
    return supabase.storage.from('relatorios').createSignedUrl(path, 3600); // 1h
  }

  if (plan.format === 'pdf') {
    // Gerar HTML do relatório → converter para PDF
    // Usar Edge Function existente ou gerar no frontend
  }
}
```

---

## Entrega 5.4 — Integração com canais existentes

### Chat via Telegram

O Junior já usa Telegram para tudo. O chat ERP deve funcionar pelo Telegram também:

```
Telegram → whatsapp-webhook (adaptado) → ai-chat-erp → resposta → Telegram
```

A lógica é: se a mensagem vem do chat_id do Junior (1065519625) e não é de um lead, redirecionar para `ai-chat-erp` ao invés do fluxo de vendas.

### Chat via WhatsApp (para clientes)

Clientes continuam sendo atendidos pelo agente de vendas (webhook v15). O chat ERP é exclusivo para a equipe interna.

### Chat via Cowork

Junior já usa Cowork como interface principal. O chat ERP é acessível de 3 formas:
1. **Componente no ERP** (floating button)
2. **Telegram** (mensagens diretas ao Junior)
3. **Cowork** (via MCP Server Croma — já funciona)

---

## Entrega 5.5 — Sugestões proativas

### Conceito

Além de responder perguntas, o chat sugere ações proativamente baseado no contexto:

| Contexto | Sugestão |
|---|---|
| Usuário na página de pedidos | "Há 1 pedido atrasado. Quer ver os detalhes?" |
| Estoque abaixo do mínimo | "Vinil adesivo está baixo. Gerar cotação para fornecedores?" |
| Lead quente sem orçamento há 3 dias | "Lead Renner está quente e sem orçamento. Criar proposta?" |
| Conta vencida há 15 dias | "Cliente X com R$ 2k vencido. Quer que eu envie uma cobrança?" |
| Todas OPs concluídas do dia | "Produção do dia 100% concluída. Parabéns!" |

### Implementação

As sugestões são geradas pelo `agent-cron-loop` e armazenadas em `ai_alertas`:

```sql
-- Estrutura de ai_alertas (já existe)
-- O chat puxa os alertas não lidos ao abrir
SELECT * FROM ai_alertas
WHERE destinatario_id = $user_id AND lido = false
ORDER BY prioridade DESC, created_at DESC
LIMIT 5;
```

---

## Plano de Execução — Waves

### Wave 1 (paralelo, ~2 dias)

| # | Tarefa | Esforço | Dependência |
|---|---|---|---|
| 5.1.1 | RPC `execute_readonly_query` (SQL seguro) | ~2h | — |
| 5.1.2 | Edge Function `ai-chat-erp` (3 estágios) | ~6h | — |
| 5.1.3 | System prompts (classificação + SQL + ações + relatórios) | ~2h | — |

### Wave 2 (paralelo, ~2 dias)

| # | Tarefa | Esforço | Dependência |
|---|---|---|---|
| 5.2.1 | ChatERP.tsx — container floating com histórico | ~4h | 5.1.2 |
| 5.2.2 | ChatDataTable + ChatVisualization + ChatActionButton | ~4h | 5.2.1 |
| 5.2.3 | Integrar ao layout do ERP (floating button) | ~2h | 5.2.1 |

### Wave 3 (paralelo, ~2 dias)

| # | Tarefa | Esforço | Dependência |
|---|---|---|---|
| 5.3.1 | Geração de relatórios (10 templates) | ~4h | 5.1.2 |
| 5.3.2 | Upload para Storage + signed URL | ~1h | 5.3.1 |
| 5.4.1 | Integrar Telegram → ai-chat-erp (para Junior) | ~3h | 5.1.2 |
| 5.5.1 | Sugestões proativas via ai_alertas | ~2h | 5.1.2 |

### Wave 4 (validação, ~2 dias)

| # | Tarefa | Esforço | Dependência |
|---|---|---|---|
| 5.6.1 | Teste: 20 perguntas variadas no chat | ~3h | Tudo |
| 5.6.2 | Teste: geração de 5 relatórios diferentes | ~2h | 5.3.1 |
| 5.6.3 | Teste: ações com confirmação (cadastrar lead, criar orçamento) | ~2h | 5.1.2 |
| 5.6.4 | Teste: conversa encadeada (contexto) | ~2h | 5.2.1 |
| 5.6.5 | Teste: chat via Telegram | ~1h | 5.4.1 |
| 5.6.6 | Teste de segurança: tentar SQL injection e comandos não permitidos | ~2h | 5.1.1 |

---

## Segurança — Camadas de proteção

### Camada 1: RPC `execute_readonly_query`
- Aceita apenas SELECT/WITH
- Bloqueia INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/TRUNCATE/GRANT/REVOKE
- Força LIMIT 100
- Remove comentários SQL

### Camada 2: Classificação de intenção
- AÇÃO sempre retorna confirmação antes de executar
- Nunca executa DELETE (apenas soft-delete via update)
- Ações destrutivas bloqueadas

### Camada 3: Validação de permissão
- Verifica role do usuário (via JWT)
- Admin: pode tudo
- Comercial: consultas + leads + propostas
- Produção: consultas + OPs

### Camada 4: Rate limiting
- Máximo 30 mensagens por minuto por usuário
- Máximo 100 tokens de saída por resposta
- Custo máximo por dia: $2 (fail-safe)

---

## Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| SQL injection via linguagem natural | Acesso não autorizado | RPC execute_readonly_query com validação rigorosa. Claude gera SQL, mas a RPC valida antes de executar. |
| Respostas incorretas do Claude | Informação errada | Sempre mostrar a query executada para transparência. Validar resultados numéricos. |
| Custo de API alto | Gasto excessivo | Cache de respostas para perguntas frequentes. Rate limiting. Modelo leve (Haiku) para classificação. |
| Contexto de conversa perdido | Experiência ruim | Salvar em agent_conversations/agent_messages. Máximo 10 mensagens de contexto. |
| Relatórios grandes | Timeout | Limitar a 1000 linhas. Para maiores, executar em background. |

---

## Exit Criteria

- [ ] Chat ERP respondendo 20 tipos de perguntas diferentes corretamente
- [ ] Ações com confirmação funcionando (pelo menos 3 tipos)
- [ ] Relatórios por linguagem natural (pelo menos 5 templates)
- [ ] Contexto de conversa mantido por pelo menos 10 mensagens
- [ ] Chat acessível via ERP (floating button) e Telegram
- [ ] Segurança: SQL injection impossível (testado)
- [ ] Sugestões proativas aparecendo no chat
- [ ] Custo de API monitorado e dentro do limite

---

## Exemplos de interações completas

### Exemplo 1: Consulta financeira
```
Junior: quanto faturamos em março?

[Classificação: CONSULTA | Entidades: periodo=março]

[SQL gerado]:
SELECT COALESCE(SUM(valor_pago), 0) as faturamento,
       COUNT(*) as titulos_pagos
FROM contas_receber
WHERE date_trunc('month', data_pagamento) = '2026-03-01'
AND excluido_em IS NULL;

[Resultado]: {faturamento: 87400, titulos_pagos: 12}

Croma: Em março, o faturamento foi de R$ 87.400,00, com 12 títulos pagos.
Isso representa 79% da meta mensal de R$ 110.000.
```

### Exemplo 2: Ação com confirmação
```
Junior: cadastra lead: Maria da Silva, Loja Conceito, maria@lojaconceito.com.br

[Classificação: ACAO | Entidades: nome=Maria da Silva, empresa=Loja Conceito, email=maria@lojaconceito.com.br]

Croma: Vou cadastrar o lead:
- Nome: Maria da Silva
- Empresa: Loja Conceito
- Email: maria@lojaconceito.com.br
- Canal: chat_erp

Confirma? [Confirmar] [Cancelar]

Junior: [clica Confirmar]

Croma: Lead cadastrado com sucesso! ID: #482.
Deseja criar um orçamento para Maria?
```

### Exemplo 3: Relatório
```
Junior: gera relatório de clientes inativos

[Classificação: RELATORIO | Template: R6]

[SQL]:
SELECT c.nome, c.email, c.telefone,
       MAX(p.created_at) as ultimo_pedido,
       EXTRACT(DAY FROM now() - MAX(p.created_at)) as dias_sem_pedido
FROM clientes c LEFT JOIN pedidos p ON p.cliente_id = c.id
GROUP BY c.id, c.nome, c.email, c.telefone
HAVING MAX(p.created_at) < now() - interval '180 days' OR MAX(p.created_at) IS NULL
ORDER BY ultimo_pedido ASC NULLS FIRST
LIMIT 100;

Croma: Relatório gerado com 47 clientes inativos (sem pedido há mais de 180 dias).
[📥 Baixar Excel]
```

---

## Referências

- ai_requests/ai_responses: ponte MCP existente
- agent_conversations/agent_messages: histórico de conversas
- ai_logs: rastreamento de custos
- AI Sidebar: 20+ context appliers (referência para contexto)
- 12 Edge Functions IA existentes
- MCP Server Croma: 26 ferramentas
- OpenRouter: provider principal (callOpenRouter com fallback)
- ChatERP: componente React criado (UX-01), não integrado
- Telegram Junior: chat_id 1065519625

---
*Plano criado: 2026-03-31*
*Autor: Claude (cérebro administrativo Croma Print)*
