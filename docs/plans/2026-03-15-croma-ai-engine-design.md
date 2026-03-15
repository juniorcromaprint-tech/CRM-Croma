# Croma AI Engine — Design Document

> **Data**: 2026-03-15 | **Status**: Aprovado | **Fase**: 1 de 3

---

## Visao Geral

Adicionar uma camada de inteligencia operacional ao ERP da Croma Print, transformando-o de um sistema que apenas registra informacao em um que analisa, sugere, alerta e acelera operacao.

**Nome interno**: Croma AI Engine

**Fase 1 entrega 5 funcionalidades:**
1. Analisar Orcamento (margem, riscos, itens faltantes)
2. Resumo do Cliente (historico, padrao de compra, risco)
3. Briefing de Producao (ordem clara a partir do pedido)
4. Detector de Problemas (cron automatico + analise sob demanda)
5. Composicao de Produto (sugerir materiais, acabamentos, processos)

**Roadmap futuro:**
- Fase 2: Chat lateral contextual, mensagens comerciais, follow-up automatico
- Fase 3: Score de cliente, previsao de margem, copiloto completo

---

## Decisoes de Arquitetura

### Provider: OpenRouter (unico)
- Um unico provider, uma API key, uma fatura
- Acessa Claude, GPT, Llama pelo mesmo endpoint
- Troca de modelo sem mudar codigo
- API compativel com formato OpenAI

### Modelo por tarefa (preferencia menor custo)

| Funcionalidade | Modelo | Justificativa |
|---|---|---|
| Analisar Orcamento | `gpt-4.1-mini` | Calculos + checklist estruturado |
| Resumo Cliente | `gpt-4.1-mini` | Sumarizacao simples |
| Briefing Producao | `gpt-4.1-mini` | Formatacao de dados existentes |
| Detector de Problemas | `gpt-4.1-mini` | Regras + queries |
| Composicao de Produto | `gpt-4.1-mini` | Match com modelos existentes |
| Fallback (se mini falhar) | `claude-sonnet-4` | Upgrade automatico em erro |

### Infraestrutura: Edge Functions Supabase
- Sem servidor Node.js adicional
- Padrao ja estabelecido (13 Edge Functions existentes)
- API key como secret em `Deno.env.get('OPENROUTER_API_KEY')`
- Custo de infra: zero adicional

### Permissao por role
- Verificacao de `user.role` no JWT dentro da Edge Function
- Roles permitidas configuradas por funcionalidade

### Interface: Botoes contextuais
- Botoes especificos em cada tela relevante
- Resultado em painel/modal estruturado
- Sem chat lateral na Fase 1 (roadmap Fase 2)

### Detector de Problemas: Cron + Manual
- Cron 2x/dia com queries SQL puras (sem IA, custo zero)
- Botao "Atualizar Agora" com analise por IA sob demanda
- Vendedor nao espera o cron — pode analisar antes de enviar orcamento

---

## Arquitetura Tecnica

```
Browser (React)
  |
  |  supabase.functions.invoke('ai-*')
  v
Supabase Edge Functions (Deno)
  |-- ai-analisar-orcamento/
  |-- ai-resumo-cliente/
  |-- ai-briefing-producao/
  |-- ai-detectar-problemas/
  |-- ai-composicao-produto/
  +-- ai-shared/  (codigo compartilhado)
        |-- openrouter-provider.ts   <- unico provider
        |-- prompt-builder.ts        <- monta prompts com contexto
        |-- context-loader.ts        <- carrega dados do Supabase
        |-- ai-types.ts              <- tipos compartilhados
        +-- ai-logger.ts             <- log de uso (tabela)
  |
  |  fetch (Authorization: Bearer OPENROUTER_API_KEY)
  v
OpenRouter API
  |-- gpt-4.1-mini  (default)
  +-- claude-sonnet-4  (fallback)
```

### Fluxo padrao de todas as Edge Functions

```
JWT check -> Role check -> Context loader (Supabase queries) ->
Prompt builder (template + contexto) -> OpenRouter call ->
Parse response -> Log em ai_logs -> Return AIResponse
```

---

## Frontend — Hooks e Componentes

### Estrutura

```
src/domains/ai/
  hooks/
    useAnalisarOrcamento.ts     <- useMutation -> Edge Function
    useResumoCliente.ts
    useBriefingProducao.ts
    useDetectarProblemas.ts
    useComposicaoProduto.ts
    useAlertasAI.ts             <- useQuery -> tabela ai_alertas
  components/
    AIResultPanel.tsx            <- painel generico de resultado
    AIButton.tsx                 <- botao com loading + icone sparkle
    AIAlertsBadge.tsx            <- badge no dashboard
    OrcamentoAnalise.tsx         <- resultado analise orcamento
    ClienteResumo.tsx            <- card resumo cliente
    ProducaoBriefing.tsx         <- briefing formatado
    ProblemasPanel.tsx           <- lista de problemas com severidade
    ComposicaoSugestao.tsx       <- sugestao de composicao de produto
```

### Onde os botoes aparecem

| Tela | Botao | Acao |
|---|---|---|
| `OrcamentoEditorPage` | "Analisar Orcamento" | Margem, riscos, sugestoes |
| `OrcamentoEditorPage` | "Sugerir Composicao" | Ao adicionar item, sugere materiais/acabamentos |
| `ClienteDetailPage` | "Resumo Inteligente" | Historico, padrao, risco |
| `OrdemServicoPage` | "Gerar Briefing" | Briefing tecnico estruturado |
| Dashboard principal | Painel "Alertas Operacionais" | Alertas cron + botao "Atualizar Agora" |
| `AdminProdutosPage` | "Sugerir Composicao" | Composicao base para novo produto |

### Contrato de resposta padrao

```typescript
interface AIResponse {
  summary: string;
  confidence: 'alta' | 'media' | 'baixa';
  risks: AIRisk[];
  suggestions: AISuggestion[];
  required_actions: string[];
  structured_data: Record<string, unknown>;
  model_used: string;
  tokens_used: number;
}

interface AIRisk {
  level: 'alta' | 'media' | 'baixa';
  description: string;
  action: string;
}

interface AISuggestion {
  priority: 'alta' | 'media' | 'baixa';
  text: string;
  impact: string;
}
```

### Padrao visual
- Card `rounded-2xl` com header azul gradiente
- Icone sparkle no botao
- Resultado em secoes colapsaveis
- Design system existente (shadcn/ui + Tailwind)

---

## Banco de Dados — Tabelas Novas

### `ai_logs` — Auditoria e controle de custo

```sql
CREATE TABLE ai_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  function_name text NOT NULL,
  entity_type text,
  entity_id uuid,
  model_used text NOT NULL,
  tokens_input int NOT NULL DEFAULT 0,
  tokens_output int NOT NULL DEFAULT 0,
  cost_usd numeric(10,6) DEFAULT 0,
  duration_ms int,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ai_logs_user ON ai_logs(user_id, created_at DESC);
CREATE INDEX idx_ai_logs_entity ON ai_logs(entity_type, entity_id);
```

### `ai_alertas` — Alertas do detector automatico

```sql
CREATE TABLE ai_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  severidade text NOT NULL DEFAULT 'media',
  titulo text NOT NULL,
  descricao text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  resolvido boolean DEFAULT false,
  resolvido_por uuid REFERENCES auth.users(id),
  resolvido_em timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ai_alertas_active ON ai_alertas(resolvido, severidade) WHERE NOT resolvido;
CREATE INDEX idx_ai_alertas_entity ON ai_alertas(entity_type, entity_id);
```

### RLS

```sql
ALTER TABLE ai_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users read own logs" ON ai_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "service role inserts logs" ON ai_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "authenticated users read alertas" ON ai_alertas
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated users resolve alertas" ON ai_alertas
  FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "service role manages alertas" ON ai_alertas
  FOR ALL USING (true);
```

---

## Edge Functions — Detalhe das 5 Funcionalidades

### 1) `ai-analisar-orcamento`

| Campo | Detalhe |
|---|---|
| **Trigger** | Botao na tela de orcamento |
| **Input** | `proposta_id` |
| **Context loader** | Proposta + itens + materiais + acabamentos + servicos + cliente + regras_precificacao + historico de propostas do cliente |
| **IA analisa** | Margem estimada, itens faltantes (instalacao, frete, acabamento), comparacao com ticket medio do cliente, prazo vs volume, sugestao de upsell |
| **structured_data** | `{ margem_estimada, itens_faltantes[], preco_sugerido, comparativo_historico }` |
| **Modelo** | `gpt-4.1-mini` |
| **Roles** | `comercial`, `gerente`, `admin` |

### 2) `ai-resumo-cliente`

| Campo | Detalhe |
|---|---|
| **Trigger** | Botao na tela de detalhe do cliente |
| **Input** | `cliente_id` |
| **Context loader** | Cliente + contatos + propostas (ultimas 20) + pedidos (ultimos 20) + contas_receber (inadimplencia) |
| **IA analisa** | Perfil, ticket medio, padrao de compra (sazonalidade, tipo de produto), risco comercial, proxima acao |
| **structured_data** | `{ ticket_medio, total_pedidos, produtos_frequentes[], risco, padrao_compra, sugestao_abordagem }` |
| **Modelo** | `gpt-4.1-mini` |
| **Roles** | `comercial`, `gerente`, `admin` |

### 3) `ai-briefing-producao`

| Campo | Detalhe |
|---|---|
| **Trigger** | Botao na tela de Ordem de Servico |
| **Input** | `pedido_id` |
| **Context loader** | Pedido + itens + materiais (com estoque atual) + acabamentos + processos + cliente (endereco instalacao) |
| **IA gera** | Briefing tecnico: produto, medidas, materiais com quantidade, acabamentos, etapas, prazo, pendencias (arte aprovada? endereco confirmado?) |
| **structured_data** | `{ itens_briefing[], materiais_necessarios[], pendencias[], prazo_producao, observacoes_criticas[] }` |
| **Modelo** | `gpt-4.1-mini` |
| **Roles** | `producao`, `gerente`, `admin` |

### 4) `ai-detectar-problemas`

| Campo | Detalhe |
|---|---|
| **Trigger** | Botao "Atualizar Agora" no dashboard + cron 2x/dia |
| **Modo cron** | Queries SQL puras (sem IA), salva em `ai_alertas` |
| **Modo manual** | IA analisa resultados das queries + contexto, prioriza e sugere acoes |
| **Queries do cron** | Orcamentos vencidos (>7d), pedidos parados (>3d), producao concluida sem faturamento, clientes sem follow-up (>14d), pedidos sem responsavel |
| **structured_data** | `{ problemas[]: {tipo, severidade, titulo, descricao, entity_type, entity_id, acao_sugerida} }` |
| **Modelo (manual)** | `gpt-4.1-mini` |
| **Roles** | `gerente`, `admin` |

### 5) `ai-composicao-produto`

| Campo | Detalhe |
|---|---|
| **Trigger** | Botao ao adicionar item no orcamento + cadastro de produto |
| **Input** | Descricao livre (ex: "banner lona 440g 3x1.5m com ilhos") |
| **Context loader** | `produto_modelos` + `modelo_materiais` + `modelo_processos` + `acabamentos` + `materiais` (precos) + `servicos` |
| **IA faz** | Interpreta descricao, identifica modelo mais proximo dos 156 existentes, sugere composicao completa |
| **structured_data** | `{ modelo_sugerido, materiais[], acabamentos[], processos[], servicos_sugeridos[], custo_estimado, observacoes[] }` |
| **Modelo** | `gpt-4.1-mini` |
| **Roles** | `comercial`, `producao`, `gerente`, `admin` |

**Dois modos de uso:**
- **No orcamento**: Vendedor digita descricao -> "Sugerir Composicao" -> IA preenche materiais/acabamentos/processos -> vendedor ajusta e confirma
- **No cadastro**: Admin descreve novo produto -> IA sugere composicao base a partir de modelos similares -> admin refina e salva

---

## Estimativa de Custo

### Custo por chamada (gpt-4.1-mini)

| Funcionalidade | Input estimado | Output estimado | Custo/chamada |
|---|---|---|---|
| Analisar Orcamento | ~2.000 tokens | ~500 tokens | ~$0.001 |
| Resumo Cliente | ~3.000 tokens | ~500 tokens | ~$0.0015 |
| Briefing Producao | ~2.500 tokens | ~800 tokens | ~$0.0015 |
| Detector Problemas | ~4.000 tokens | ~1.000 tokens | ~$0.002 |
| Composicao Produto | ~3.000 tokens | ~600 tokens | ~$0.0015 |

### Cenario mensal (equipe de 5 vendedores, uso ativo)

| Uso | Chamadas/mes | Custo/mes |
|---|---|---|
| Conservador | ~500 | ~$0.75 |
| Moderado | ~2.000 | ~$3.00 |
| Intenso | ~5.000 | ~$7.50 |

**Custo praticamente irrelevante** com gpt-4.1-mini.

---

## Plano de Sprints (Fase 1)

### Sprint AI-1: Infraestrutura base
- Migration: tabelas `ai_logs` e `ai_alertas`
- Edge Function `ai-shared/` (provider, prompt builder, context loader, logger, types)
- Secret `OPENROUTER_API_KEY` no Supabase
- Teste de integracao com OpenRouter

### Sprint AI-2: Funcionalidades core
- Edge Function `ai-analisar-orcamento`
- Edge Function `ai-composicao-produto`
- Hooks + componentes frontend (OrcamentoAnalise, ComposicaoSugestao, AIButton)
- Integracao na OrcamentoEditorPage

### Sprint AI-3: Cliente + Producao
- Edge Function `ai-resumo-cliente`
- Edge Function `ai-briefing-producao`
- Hooks + componentes frontend (ClienteResumo, ProducaoBriefing)
- Integracao na ClienteDetailPage e OrdemServicoPage

### Sprint AI-4: Detector + Dashboard
- Edge Function `ai-detectar-problemas`
- Queries SQL do cron (5 regras iniciais)
- Configurar cron 2x/dia
- Painel de alertas no dashboard
- AIAlertsBadge + ProblemasPanel

---

## Riscos e Mitigacoes

| Risco | Mitigacao |
|---|---|
| OpenRouter fora do ar | Fallback: retornar erro amigavel, funcionalidade nao-critica |
| Custo escalar | Logs em `ai_logs` + alerta se custo > threshold |
| IA dar sugestao errada | Sempre mostrar como "sugestao", vendedor confirma/ajusta |
| Latencia alta (>5s) | Loading state no botao, timeout de 30s na Edge Function |
| API key vazada | Secret no Supabase, nunca no frontend |
| Modelo descontinuado | OpenRouter permite trocar modelo em 1 linha |
