# AI Actionable Redesign — Spec Document

> **Data**: 2026-03-15 | **Status**: Aprovado | **Autor**: Claude Opus + Junior
> **Projeto**: Croma Print CRM/ERP
> **Objetivo**: Transformar o sistema de IA de read-only para ações aplicáveis automaticamente

---

## Problema

O sistema de IA atual (5 Edge Functions via OpenRouter) retorna análises passivas: mostra dados como margem estimada, itens faltantes e comparativos, mas não permite que o usuário aplique nenhuma sugestão. A resposta é visualmente confusa, sem hierarquia clara, e não indica O QUE mudar nem COMO mudar.

## Decisões de Design

| Decisão | Escolha | Alternativas descartadas |
|---|---|---|
| Modelo de interação | **Híbrido** — checkbox por sugestão + "Aplicar Selecionadas" + preview antes/depois | Individual (muito lento), Aplicar Todas (pouco controle) |
| Layout | **Sidebar direita (drawer)** — orçamento e sugestões lado a lado | Modal (bloqueia visão), Inline (mistura análise com edição) |
| Pós-aplicação | **Sidebar permanece** — cards aplicados com ✅, botão "Re-analisar" | Toast silencioso (sem contexto), Resumo temporário (desaparece) |
| Escopo | **Todas as 5 funções de IA** com ações aplicáveis | Só orçamento (limitado), Orçamento + visual (meio-termo) |
| Categorias de ação | **Todas as 6**: preço, item faltante, material, acabamento, quantidade, erro | — |

---

## Arquitetura

### Conceito Central: AI Action Cards

Cada função de IA retorna uma lista de **ações tipadas** (`AIAction`) que o sistema sabe executar. Não é texto livre — é uma estrutura com `tipo`, `campo_alvo`, `valor_atual`, `valor_sugerido` e uma função de aplicação registrada no frontend.

### Tipo AIAction

```typescript
interface AIAction {
  id: string;
  tipo: AIActionType;
  severidade: 'critica' | 'importante' | 'dica';
  titulo: string;
  descricao: string;
  campo_alvo: AIActionCampoAlvo;
  valor_atual: unknown;
  valor_sugerido: unknown;
  impacto: string;
  aplicavel: boolean;
}

type AIActionType =
  // Orçamento
  | 'preco'
  | 'adicionar_item'
  | 'trocar_material'
  | 'adicionar_acabamento'
  | 'ajustar_quantidade'
  | 'corrigir_erro'
  // Composição
  | 'definir_modelo'
  | 'adicionar_material'
  | 'adicionar_servico'
  // Cliente
  | 'criar_tarefa'
  | 'agendar_contato'
  | 'aplicar_desconto'
  // Produção
  | 'criar_checklist'
  | 'marcar_pendencia'
  | 'atribuir_responsavel'
  // Problemas
  | 'revalidar_orcamento'
  | 'mover_pedido'
  | 'criar_alerta'
  | 'notificar_responsavel';

type AIActionCampoAlvo =
  | 'itens' | 'servicos' | 'materiais' | 'acabamentos'
  | 'proposta' | 'pedido' | 'cliente' | 'ordem_producao'
  | 'proposta_itens.largura' | 'proposta_itens.altura' | string; // extensível
```

### Shapes esperados de valor_atual / valor_sugerido por tipo

| AIActionType | valor_atual shape | valor_sugerido shape |
|---|---|---|
| `preco` | `{ item_id: string, preco: number }` | `{ item_id: string, preco: number }` |
| `adicionar_item` | `null` | `{ servico_id?: string, nome: string, valor: number }` ou `{ descricao: string, quantidade: number, preco: number }` |
| `trocar_material` | `{ material_id: string, item_id: string, nome: string, preco: number }` | `{ material_id: string, nome: string, preco: number }` |
| `adicionar_acabamento` | `null` | `{ acabamento_id: string, item_id: string, nome: string, preco: number }` |
| `ajustar_quantidade` | `{ item_id: string, quantidade: number }` | `{ item_id: string, quantidade: number }` |
| `corrigir_erro` | `{ item_id: string, campo: string, valor: unknown }` | `{ item_id: string, campo: string, valor: unknown }` |
| `definir_modelo` | `null` | `{ item_id: string, modelo_id: string, nome: string }` |
| `adicionar_material` | `null` | `{ item_id: string, material_id: string, nome: string, preco: number, quantidade: number }` |
| `adicionar_servico` | `null` | `{ servico_id: string, nome: string, valor: number }` |
| `criar_tarefa` | `null` | `{ titulo: string, descricao: string, data_limite?: string, responsavel_id?: string }` |
| `agendar_contato` | `null` | `{ titulo: string, descricao: string, data_agendamento: string }` |
| `aplicar_desconto` | `{ desconto: number }` | `{ desconto: number }` |
| `criar_checklist` | `null` | `{ titulo: string, itens: string[] }` |
| `marcar_pendencia` | `{ status: string }` | `{ pendencia_id: string, status: string }` |
| `atribuir_responsavel` | `null` | `{ ordem_producao_id: string, responsavel_id: string }` |
| `revalidar_orcamento` | `{ proposta_id: string, validade: string }` | `{ proposta_id: string, nova_validade: string }` |
| `mover_pedido` | `{ pedido_id: string, status_atual: string }` | `{ pedido_id: string, novo_status: string }` |
| `criar_alerta` | `null` | `{ titulo: string, descricao: string, severidade: string, entity_type: string, entity_id: string }` |
| `notificar_responsavel` | `null` | `{ responsavel_id: string, mensagem: string, entity_type: string, entity_id: string }` |

> **Nota**: No frontend, usar validação Zod para parsear `AIActionableResponse` recebida da Edge Function antes de renderizar (LLM pode retornar dados malformados).

### Novo Formato de Resposta das Edge Functions

```typescript
interface AIActionableResponse {
  summary: string;
  kpis: Record<string, number | string>;
  actions: AIAction[];
  model_used: string;
  tokens_used: number;
}
```

Exemplo concreto (ai-analisar-orcamento):

```json
{
  "summary": "3 sugestões para melhorar este orçamento",
  "kpis": {
    "margem_atual": 18,
    "margem_sugerida": 35,
    "total_atual": 800,
    "total_sugerido": 1400,
    "economia_possivel": 120
  },
  "actions": [
    {
      "id": "act_1",
      "tipo": "preco",
      "severidade": "critica",
      "titulo": "Margem abaixo do mínimo",
      "descricao": "Margem de 18% está abaixo do mínimo de 30% para banners",
      "campo_alvo": "itens",
      "valor_atual": { "item_id": "uuid", "preco": 500 },
      "valor_sugerido": { "item_id": "uuid", "preco": 680 },
      "impacto": "+R$ 180",
      "aplicavel": true
    },
    {
      "id": "act_2",
      "tipo": "adicionar_item",
      "severidade": "importante",
      "titulo": "Serviço de instalação ausente",
      "descricao": "85% dos banners deste porte incluem instalação",
      "campo_alvo": "servicos",
      "valor_atual": null,
      "valor_sugerido": { "servico_id": "uuid", "nome": "Instalação padrão", "valor": 350 },
      "impacto": "+R$ 350",
      "aplicavel": true
    },
    {
      "id": "act_3",
      "tipo": "trocar_material",
      "severidade": "dica",
      "titulo": "Material mais econômico disponível",
      "descricao": "Lona 280g atende este formato e reduz custo",
      "campo_alvo": "materiais",
      "valor_atual": { "material_id": "uuid", "nome": "Lona 440g", "preco": 45.00 },
      "valor_sugerido": { "material_id": "uuid", "nome": "Lona 280g", "preco": 28.50 },
      "impacto": "-R$ 120",
      "aplicavel": true
    }
  ]
}
```

---

## UI/UX

### Componentes Novos

| Componente | Responsabilidade |
|---|---|
| **`AISidebar.tsx`** | Container principal — slide-in da direita, ~380px largura, header com KPIs, scroll nos cards, footer fixo com ações |
| **`AIActionCard.tsx`** | Card individual — checkbox, ícone cor por severidade, título, descrição, preview antes/depois colapsável, status badge após aplicar |
| **`AIActionPreview.tsx`** | Diff visual dentro do card — coluna ANTES / DEPOIS com valores destacados |
| **`AIKPIBar.tsx`** | Barra de KPIs no topo da sidebar — métricas contextuais (margem, total, economia, etc.) |
| **`AIApplyBar.tsx`** | Footer fixo — contador "X selecionadas", botão "Aplicar Selecionadas", "Selecionar Todas", "Re-analisar" |
| **`AIStatusBadge.tsx`** | Badge de status por card — ✅ Aplicado, ❌ Erro, ⏳ Aplicando |

### Componentes Refatorados

| Componente atual | Mudança |
|---|---|
| `AIButton.tsx` | Mantém — já funciona bem como trigger |
| `AIResultPanel.tsx` | **Deprecado** — substituído por `AISidebar` |
| `OrcamentoAnalise.tsx` | **Deprecado** — absorvido pelos AIActionCards |
| `ClienteResumo.tsx` | **Refatorado** — usa AISidebar com KPIs de cliente |
| `ProducaoBriefing.tsx` | **Refatorado** — usa AISidebar com KPIs de produção |
| `ComposicaoSugestao.tsx` | **Refatorado** — usa AISidebar com ações de composição |
| `ProblemasPanel.tsx` | **Refatorado** — usa AISidebar com ações de problemas |

### Cores por Severidade

| Severidade | Background | Borda | Uso |
|---|---|---|---|
| Crítica | `bg-red-500/10` | `border-red-500/30` | Margem negativa, erro grave |
| Importante | `bg-amber-500/10` | `border-amber-500/30` | Item faltante, inconsistência |
| Dica | `bg-blue-500/10` | `border-blue-500/30` | Otimização, economia |
| Aplicada | `bg-green-500/10` | `border-green-500/30` | Ação já executada |

### Estados da Sidebar

```
FECHADA
  → [Clica "Analisar com IA"]
CARREGANDO (skeleton pulse nos cards)
  → [Resposta chega]
RESULTADO (cards com checkboxes)
  → [Seleciona cards + clica "Aplicar"]
APLICANDO (spinner individual por card)
  → [Sucesso]
APLICADO (✅ nos cards aplicados, ☐ nos restantes)
  → [Clica "Re-analisar"]
CARREGANDO (nova análise com dados atualizados)
  → ...ciclo continua
```

### Adaptação por Tela

| Tela | Trigger | KPIs no topo | Tipos de ação |
|---|---|---|---|
| Orçamento Editor | "Analisar com IA" | Margem atual→sugerida, Total, Economia | preco, adicionar_item, trocar_material, adicionar_acabamento, ajustar_quantidade, corrigir_erro |
| Orçamento Editor | "Sugerir Composição" | Custo estimado, Modelo sugerido | definir_modelo, adicionar_material, adicionar_acabamento, adicionar_servico |
| Cliente Detalhe | "Resumo Inteligente" | Ticket médio, Risco, Total pedidos | criar_tarefa, agendar_contato, aplicar_desconto |
| Pedido Detalhe | "Briefing Produção" | Prazo estimado, Pendências, Materiais | criar_checklist, marcar_pendencia, atribuir_responsavel |
| Dashboard Diretor | Painel "Alertas IA" | Alertas por severidade (alta/média/baixa) | revalidar_orcamento, mover_pedido, notificar_responsavel |

---

## Backend — Edge Functions

### Mudanças no prompt-builder.ts

Instrução universal adicionada a todos os prompts:

```
REGRA CRÍTICA: Toda sugestão DEVE ser retornada como uma action no array "actions" com:
- id: identificador único (act_1, act_2, etc.)
- tipo: um dos tipos permitidos para esta função
- severidade: "critica" | "importante" | "dica"
- titulo: frase curta descritiva
- descricao: explicação do porquê (1-2 frases)
- campo_alvo: qual entidade/campo será alterado
- valor_atual: valor corrente (null se não existe)
- valor_sugerido: valor recomendado com IDs reais do banco
- impacto: string com impacto financeiro ("+R$ 250", "-R$ 120")
- aplicavel: true se pode ser aplicado automaticamente

Também retorne um objeto "kpis" com métricas resumo relevantes.

NÃO retorne sugestões em texto livre. Tudo deve ser uma action estruturada.
```

### Mudanças por Edge Function

#### ai-analisar-orcamento
- Prompt atualizado para retornar actions tipadas
- Context enriquecido: IDs dos materiais e serviços disponíveis para sugestão de troca/adição
- KPIs: margem_atual, margem_sugerida, total_atual, total_sugerido, economia_possivel
- Tipos permitidos: preco, adicionar_item, trocar_material, adicionar_acabamento, ajustar_quantidade, corrigir_erro

#### ai-composicao-produto
- Já retorna dados estruturados, reformatar como actions
- KPIs: custo_estimado, modelo_sugerido
- Tipos permitidos: definir_modelo, adicionar_material, adicionar_acabamento, adicionar_servico

#### ai-resumo-cliente
- Prompt pede sugestões acionáveis
- KPIs: ticket_medio, total_pedidos, risco
- Tipos permitidos: criar_tarefa, agendar_contato, aplicar_desconto

#### ai-briefing-producao
- Prompt pede pendências como ações resolvíveis
- KPIs: prazo_producao, total_pendencias, materiais_disponíveis
- Tipos permitidos: criar_checklist, marcar_pendencia, atribuir_responsavel

#### ai-detectar-problemas
- Prompt pede entity_id + ação direta por problema
- KPIs: total_alertas, alertas_alta, alertas_media, alertas_baixa
- Tipos permitidos: revalidar_orcamento, mover_pedido, criar_alerta, notificar_responsavel (nota: `criar_alerta` agora incluído no `AIActionType`)

### ai-types.ts (shared)

Novo tipo `AIActionableResponse` substitui `AIResponse` como retorno padrão. Manter `AIResponse` como deprecated para backward compatibility durante transição.

---

## Appliers — Camada de Execução

### Estrutura de arquivos

```
src/domains/ai/
  appliers/
    registry.ts              → mapa tipo→applier
    types.ts                 → ApplierFn, ApplierResult, ApplierContext
    orcamento/
      precoApplier.ts        → update proposta_itens.preco_unitario
      adicionarItemApplier.ts→ insert proposta_itens + proposta_servicos
      materialApplier.ts     → update/insert proposta_item_materiais
      acabamentoApplier.ts   → insert proposta_item_acabamentos
      quantidadeApplier.ts   → update proposta_itens.quantidade
      erroApplier.ts         → update campo específico conforme erro
    composicao/
      modeloApplier.ts       → set modelo_id em proposta_itens
      servicoApplier.ts      → insert proposta_servicos
    cliente/
      tarefaApplier.ts       → insert tarefas_comerciais (tabela existente: titulo, descricao, responsavel_id, data_limite, status)
      contatoApplier.ts      → insert tarefas_comerciais com tipo='contato' (follow-up agendado)
      descontoApplier.ts     → update propostas.desconto
    producao/
      checklistApplier.ts    → insert checklist items no pedido
      pendenciaApplier.ts    → update status de pendência
      responsavelApplier.ts  → update ordens_producao.responsavel_id (NÃO pedido_itens — coluna não existe lá)
    problemas/
      revalidarApplier.ts    → update proposta.validade + status
      moverPedidoApplier.ts  → update pedidos.status (com mapa de transição do Sprint 1)
      alertaApplier.ts       → insert ai_alertas (tabela existente)
      notificarApplier.ts    → trigger notificação (Supabase realtime ou edge fn)
```

### Tipo ApplierFn

```typescript
type ApplierContext = {
  supabase: SupabaseClient;
  userId: string;
  entityId: string;
  entityType: string;
  entityVersion?: number; // Lock otimista — capturado no momento da análise
};

type ApplierResult = {
  success: boolean;
  message: string;
  rollback?: () => Promise<void>;
};

type ApplierFn = (action: AIAction, context: ApplierContext) => Promise<ApplierResult>;
```

### Registry

```typescript
// src/domains/ai/appliers/registry.ts
const applierRegistry: Record<AIActionType, ApplierFn> = {
  preco:                 precoApplier,
  adicionar_item:        adicionarItemApplier,
  trocar_material:       materialApplier,
  adicionar_acabamento:  acabamentoApplier,
  ajustar_quantidade:    quantidadeApplier,
  corrigir_erro:         erroApplier,
  definir_modelo:        modeloApplier,
  adicionar_material:    materialApplier,
  adicionar_servico:     servicoApplier,
  criar_tarefa:          tarefaApplier,
  agendar_contato:       contatoApplier,
  aplicar_desconto:      descontoApplier,
  criar_checklist:       checklistApplier,
  marcar_pendencia:      pendenciaApplier,
  atribuir_responsavel:  responsavelApplier,
  revalidar_orcamento:   revalidarApplier,
  mover_pedido:          moverPedidoApplier,
  criar_alerta:          alertaApplier,
  notificar_responsavel: notificarApplier,
};

export async function executeAction(
  action: AIAction,
  context: ApplierContext
): Promise<ApplierResult> {
  const applier = applierRegistry[action.tipo];
  if (!applier) return { success: false, message: `Tipo desconhecido: ${action.tipo}` };
  return applier(action, context);
}
```

---

## Hooks

### Novos

| Hook | Responsabilidade |
|---|---|
| `useAISidebar()` | Estado da sidebar (aberta/fechada, loading, actions, selecionadas) |
| `useApplyActions()` | Mutation que executa N ações selecionadas via registry |

### Refatorados

| Hook atual | Mudança |
|---|---|
| `useAnalisarOrcamento` | Retorno tipado como `AIActionableResponse` em vez de `AIResponse` |
| `useResumoCliente` | Idem |
| `useBriefingProducao` | Idem |
| `useDetectarProblemas` | Idem |
| `useComposicaoProduto` | Idem |

---

## Segurança

| Mecanismo | Implementação |
|---|---|
| **Validação dupla** | Frontend valida via Zod schema + applier revalida antes de persistir |
| **Lock otimista** | `entityVersion` capturado no momento da análise e passado no `ApplierContext`. Appliers de orçamento fazem `update(...).eq('version', entityVersion)` — se 0 rows affected, retorna erro "Dados alterados por outro usuário, re-analise" |
| **Auditoria** | Cada ação aplicada gera log via campo JSONB `metadata` na tabela `ai_logs` existente. Formato: `{ action_type, valor_anterior, valor_novo }`. **Não requer migration** — usa a coluna `error_message` (renomear para `metadata` opcionalmente via migration simples) |
| **Rollback** | Cada applier retorna `rollback?: () => Promise<void>`. Closures armazenadas em `useAISidebar` state enquanto sidebar está aberta. **Batch rollback**: botão "Desfazer" reverte todas as ações aplicadas na última batch (executa rollbacks em ordem reversa). Disponível por 30 segundos ou até re-análise/fechar sidebar. Se sidebar fechar, closures são perdidas (by design — ações confirmadas) |
| **Batch execution** | Ações executadas **sequencialmente** (não paralelo), **continue-on-error** (não fail-fast). Cada ação tem status individual (applied/error). Ações aplicadas com sucesso NÃO são revertidas se uma subsequente falhar |
| **Rate limiting** | Mantém rate limit existente nas Edge Functions |
| **Role-based** | Mantém matriz de acesso existente (comercial, produção, gerente, admin) |

---

## Testes

| Camada | O que testar |
|---|---|
| **Appliers** | Cada applier: execução + rollback + erro de validação + lock otimista |
| **Registry** | Tipo desconhecido retorna erro, tipo válido chama applier correto |
| **Hook useApplyActions** | Aplica N ações, reporta sucesso/erro individual |
| **AISidebar** | Render, seleção, loading states, re-análise |
| **AIActionCard** | Checkbox toggle, preview expand/collapse, status badges |
| **Edge Functions** | Formato de resposta segue AIActionableResponse schema |

---

## Arquivos Impactados

### Novos (~25 arquivos)
- `src/domains/ai/components/AISidebar.tsx`
- `src/domains/ai/components/AIActionCard.tsx`
- `src/domains/ai/components/AIActionPreview.tsx`
- `src/domains/ai/components/AIKPIBar.tsx`
- `src/domains/ai/components/AIApplyBar.tsx`
- `src/domains/ai/components/AIStatusBadge.tsx`
- `src/domains/ai/hooks/useAISidebar.ts`
- `src/domains/ai/hooks/useApplyActions.ts`
- `src/domains/ai/appliers/registry.ts`
- `src/domains/ai/appliers/types.ts`
- `src/domains/ai/appliers/orcamento/*.ts` (6 arquivos)
- `src/domains/ai/appliers/composicao/*.ts` (3 arquivos)
- `src/domains/ai/appliers/cliente/*.ts` (3 arquivos)
- `src/domains/ai/appliers/producao/*.ts` (3 arquivos)
- `src/domains/ai/appliers/problemas/*.ts` (3 arquivos)

### Modificados (~12 arquivos)
- `src/domains/ai/types/ai.types.ts` — novos tipos
- `supabase/functions/ai-shared/prompt-builder.ts` — instrução universal
- `supabase/functions/ai-shared/ai-types.ts` — AIActionableResponse
- `supabase/functions/ai-analisar-orcamento/index.ts` — novo formato
- `supabase/functions/ai-resumo-cliente/index.ts` — novo formato
- `supabase/functions/ai-briefing-producao/index.ts` — novo formato
- `supabase/functions/ai-detectar-problemas/index.ts` — novo formato
- `supabase/functions/ai-composicao-produto/index.ts` — novo formato
- `src/domains/comercial/pages/OrcamentoEditorPage.tsx` — integra AISidebar
- `src/domains/clientes/pages/ClienteDetailPage.tsx` — integra AISidebar
- `src/domains/producao/pages/PedidoDetailPage.tsx` (ou equivalente) — integra AISidebar para briefing produção
- `src/domains/comercial/pages/DashboardDiretor.tsx` — integra AISidebar

### Deprecados (manter temporariamente)
- `src/domains/ai/components/AIResultPanel.tsx`
- `src/domains/ai/components/OrcamentoAnalise.tsx`
