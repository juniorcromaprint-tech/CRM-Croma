# CROMA PRINT — CRM/ERP SISTEMA

> **Versão**: 4.0 | **Atualizado**: 2026-03-14 | **Status**: Operacional em Produção — 4 Sprints concluídos

---

## LOCALIZAÇÃO DO PROJETO

| Item | Caminho |
|---|---|
| **Repositório principal** | `C:\Users\Caldera\Claude\CRM-Croma` |
| **GitHub** | `https://github.com/juniorcromaprint-tech/CRM-Croma.git` |
| **Vercel ERP** | `crm-croma.vercel.app` (deploy automático de `main`) |
| **Vercel Campo** | `campo-croma.vercel.app` (deploy automático de `main`) |
| **Supabase** | `djwjmfgplnqyffdcgdaw.supabase.co` |

**IMPORTANTE**: O projeto roda em `C:\Users\Caldera\Claude\CRM-Croma`. Não usar caminhos antigos (`dyad-apps\instalações`).

### Dev Server Local (preview_start)

O script `start-dev.cmd` na raiz do repo:
- Faz `cd` automático para seu próprio diretório (funciona em main repo e worktrees)
- Cria `.env` automaticamente se não existir
- Usa o `vite` do `node_modules` do repo principal

**Ao criar um novo worktree**, atualizar `.claude/launch.json` do worktree para apontar para o `start-dev.cmd` do próprio worktree:
```json
"runtimeArgs": ["/c", "C:\\Users\\Caldera\\Claude\\CRM-Croma\\.claude\\worktrees\\<NOME-DO-WORKTREE>\\start-dev.cmd"]
```

---

## EMPRESA

| Campo | Detalhe |
|---|---|
| **Nome** | Croma Print Comunicação Visual |
| **Segmento** | Comunicação visual profissional para varejo e indústria |
| **Localização** | Rio Grande do Sul, Brasil |
| **Especialização** | Redes de lojas, franquias, fabricantes de calçados, grandes varejistas |
| **Diferenciais** | Produção própria, atendimento nacional, padronização de redes |
| **Faturamento médio** | R$ 110.000/mês |
| **Custo operacional** | R$ 36.800/mês |
| **Equipe de produção** | 6 funcionários |

### Produtos fabricados
- Fachadas em ACM (Alumínio Composto)
- Banners e impressão digital grande formato
- Material PDV (Ponto de Venda)
- Envelopamento veicular
- Letreiros e sinalização
- Placas e totens

### Clientes de referência
Redes de lojas, franquias e grandes varejistas: **Beira Rio, Renner, Paquetá**, entre outros.

### Dono / Contato Principal
| Campo | Detalhe |
|---|---|
| **Nome** | Junior |
| **Email** | junior.cromaprint@gmail.com |
| **Telegram** | @Jucabio |
| **Telegram chat_id** | 1065519625 |

---

## ERP-CROMA — VISÃO GERAL DO SISTEMA

### Módulos disponíveis (16 no total)
`Comercial` · `Clientes` · `Pedidos` · `Produção` · `Estoque` · `Financeiro` · `Fiscal` · `Contabilidade` · `Compras` · `Instalação` · `Qualidade` · `Admin` · `Portal` · `Dados` · `AI` · `Agent`

### Funcionalidades IA
- **12 Edge Functions de IA** via OpenRouter
- **AI Sidebar** com 20+ appliers de contexto
- **Agente de Vendas** multicanal com conversas e follow-ups automáticos
- **Motor Mubisys** — precificação em 9 passos (materiais, máquinas, encargos, markup)
- **AI Orçamento** — agente detecta intenção, gera proposta completa, humano aprova

### App de Campo (PWA)
- URL: `campo-croma.vercel.app`
- Para técnicos e instaladores — mobile-first
- Integrado ao ERP via bridge Supabase

---

## CONTEXTO TELEGRAM — INSTRUÇÕES PARA ACESSO VIA CHAT

Quando acessado via Telegram Channel (Claude Code integrado ao Telegram do Junior):

### Comportamento esperado
- **Sempre responder em português brasileiro**
- **Ser direto e objetivo** — é celular, tela pequena, sem enrolação
- **Nunca pedir confirmação** para consultas (leitura de dados)
- **Sempre pedir confirmação** antes de ações que alteram dados (criar, editar, deletar)
- Usar formatação simples — evitar tabelas grandes, preferir listas curtas

### O que o Junior pode pedir via Telegram
| Tipo | Exemplos |
|---|---|
| **Consultas** | "status do pedido X", "orçamentos pendentes", "faturamento do mês", "estoque de banner" |
| **Clientes** | "dados do cliente Renner", "últimos clientes cadastrados", "leads do dia" |
| **Produção** | "OPs em andamento", "o que está no corte hoje", "expedição de amanhã" |
| **Financeiro** | "contas a receber esta semana", "boletos vencendo hoje", "faturamento do mês" |
| **Ações** | "cadastrar lead X", "criar orçamento para Y", "atualizar status do pedido Z" |

### Acesso ao Supabase (para consultas)
- **URL**: `https://djwjmfgplnqyffdcgdaw.supabase.co`
- **Anon Key**: ver seção SUPABASE abaixo
- Tabelas principais: `clientes`, `pedidos`, `propostas`, `leads`, `contas_receber`, `ordens_producao`, `estoque_movimentos`

---

## VISÃO — EMPRESA GERIDA POR IA

A Croma Print está em processo de se tornar a **primeira empresa de comunicação visual gerida quase exclusivamente por IA**:

- **Claude (via Telegram/Channels)** é o "cérebro" central — gerencia operações, consultas, decisões
- **OpenRouter** é o provider de IA padrão (não usar Anthropic API direta)
- **Documentação do plano**: `C:\Users\Caldera\Documents\Croma_Print_Plano_IA`
- O objetivo é que o Junior gerencie a empresa inteiramente pelo celular via Telegram

---

## ARQUITETURA — DOIS PRODUTOS

| Produto | Pasta | URL | Público | Foco |
|---|---|---|---|---|
| **ERP/CRM** | `src/` | `crm-croma.vercel.app` | Equipe interna | Desktop-first |
| **App de Campo** | `APP-Campo/` | `campo-croma.vercel.app` | Técnicos/instaladores | Mobile-first PWA |

**Backend compartilhado**: Supabase `djwjmfgplnqyffdcgdaw`

---

## STACK

```
React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui
TanStack Query v5 + Zod + React Hook Form
Recharts (gráficos) + Sonner (toasts)
Supabase (Postgres + Auth + Storage + Edge Functions)
Vitest (102 testes) + html2pdf + xlsx (relatórios)
NFeWizard-io (NF-e SEFAZ) + Resend (email campanhas)
```

---

## FLUXO PRINCIPAL DO NEGÓCIO

```
Lead → Orçamento → Pedido → Produção → Instalação → Faturamento
```

---

## ESTADO ATUAL DO BANCO (2026-03-14)

| Migration | Status | Conteúdo |
|---|---|---|
| `001_complete_schema.sql` | ✅ Executada | 51 tabelas base |
| `002_schema_corrections.sql` | ✅ Executada | RLS granular, triggers, índices |
| `003_campo_migration.sql` | ✅ Executada | Jobs, fotos, assinaturas, checklists |
| `003_fiscal_module.sql` | ✅ Executada | 11 tabelas fiscal + RPCs NF-e |
| `004_integracao_bridge.sql` | ✅ Executada | Bridge ERP↔Campo — views vw_campo_instalacoes, vw_campo_fotos + triggers de sincronização ativos |
| `005_storage_security.sql` | ✅ Executada | RLS nos buckets |
| `006_orcamento_module.sql` | ✅ Executada | acabamentos (17), servicos (16), proposta_item_materiais, proposta_item_acabamentos, proposta_servicos, templates_orcamento |
| `007_orcamento_campos.sql` | ✅ Executada | regras_precificacao (11 categorias), modelo_id em proposta_itens, campos de custeio em pedido_itens |
| `008_update_materiais_precos.sql` | ✅ Executada | 464 materiais com preço real Mubisys |
| `009_update_produtos_markups.sql` | ✅ Executada | 156 modelos com markup real |
| `020_portal_tracking_pagamento.sql` | ✅ Executada | Portal cliente, tracking, pagamento, notificações |
| `022_pedidos_cancelamento_fields.sql` | ✅ Executada | `cancelado_em` e `motivo_cancelamento` na tabela pedidos |
| `027_rls_blindagem.sql` | ✅ Executada | RLS em 8 tabelas críticas + 14 FK indexes + NOT NULL constraints |
| `028_retornos_bancarios.sql` | ✅ Executada | Tabelas para retorno CNAB 400 (baixa automática boletos) |
| `029_campanha_destinatarios.sql` | ✅ Executada | Destinatários de campanhas comerciais |
| `030_optimistic_lock.sql` | ✅ Executada | Campo `version` para lock otimista em pedidos e propostas |

### Dados no Banco
- `clientes`: 307 registros
- `materiais`: 467 registros (464 com preço_medio, 3 sem) — visíveis em `/admin/materiais`
- `produtos`: 156 registros
- `produto_modelos`: 156 registros (markup seedado)
- `modelo_materiais`: 321 registros vinculados
- `modelo_processos`: 362 registros
- `acabamentos`: 17 registros (ilhós, bastão, laminação, etc.)
- `servicos`: 16 registros (criação de arte, instalação, etc.)
- `regras_precificacao`: 11 categorias (banner, adesivo, fachada, placa, letreiro, painel, totem, backdrop, geral, pdv, envelopamento)

---

## SPRINTS CONCLUÍDOS (2026-03-14)

Auditoria identificou 66 problemas. 4 sprints executados para resolver todos:

### Sprint 1 — Blindagem (Segurança)
- RLS em 8 tabelas críticas (clientes, propostas, pedidos, leads, contas_*)
- 14 FK indexes para performance
- NOT NULL constraints em campos críticos
- AuthContext null-role bypass corrigido (default = comercial)
- Rota /tv protegida com autenticação
- Mapa de transições de status nos pedidos (impede pular etapas)
- gerarContasReceber transacional (CR antes de marcar concluído)

### Sprint 2 — Fluxo Completo (Lead→Faturamento)
- N+1 do orçamento corrigido (23→2 queries)
- Guards de idempotência (OP e contas_receber)
- KPIs de produção (4 cards)
- Página de Expedição (`/expedicao`)
- Calendário com 3 fontes (pedidos, leads, orçamentos)

### Sprint 3 — Experiência (Performance + UX)
- Lazy loading em todas as rotas (100+ chunks)
- Paginação server-side em listagens
- Select de colunas específicas nas top queries
- Loading states nos botões
- Dead code e console.log removidos

### Sprint 4 — Crescimento (Features avançadas)
- 102 testes automatizados (Vitest)
- Parser CNAB 400 retorno (baixa automática de boletos)
- Relatórios exportáveis (Excel + PDF)
- NF-e em homologação SEFAZ (IBGE mapping, banner amarelo)
- Campanhas comerciais (Edge Function Resend)
- Lock otimista (campo version em pedidos/propostas)

### Bugs da auditoria original (PR #5)
19 bugs corrigidos. Ver `docs/qa-reports/2026-03-14-RELATORIO-DEV.md`.

Ver spec completa: `docs/superpowers/specs/2026-03-14-plano-acao-erp-design.md`
Ver planos: `docs/superpowers/plans/`

---

## PADRÕES DE CÓDIGO

### Obrigatório
- **Idioma do código**: TypeScript/inglês para nomes de variáveis e funções de baixo nível
- **Idioma da UI**: Português brasileiro em TUDO que o usuário vê
- **Componentes**: `rounded-2xl` para cards, `rounded-xl` para inputs
- **Cor primária**: `bg-blue-600 hover:bg-blue-700`
- **Toasts**: `showSuccess()` / `showError()` de `@/utils/toast.ts`
- **Formatação**: `brl()`, `formatDate()` de `@/shared/utils/format.ts`
- **Supabase client**: `@/integrations/supabase/client.ts`

### Estrutura de domínios
```
src/domains/{dominio}/
  pages/       — React pages (rotas)
  hooks/       — useQuery / useMutation hooks
  components/  — componentes específicos do domínio
  services/    — lógica de negócio + Supabase calls
  schemas/     — schemas Zod (validação)
```

### Estado vazio padrão
```tsx
<div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
  <Icon size={40} className="mx-auto text-slate-300 mb-3" />
  <h3 className="font-semibold text-slate-600">Título</h3>
  <p className="text-sm text-slate-400 mt-1">Ação sugerida</p>
</div>
```

---

## SKILLS DISPONÍVEIS

Ver `C:\Users\Caldera\.claude\skills\` para lista completa.

Skills mais usadas neste projeto:
- `dispatching-parallel-agents` — tarefas independentes em paralelo
- `executing-plans` — execução em lotes com checkpoints
- `using-git-worktrees` — isolamento de branches
- `verification-before-completion` — build check antes de commitar
- `ui-ux-pro-max` — design de componentes

---

## SUPABASE

**Projeto**: `djwjmfgplnqyffdcgdaw.supabase.co`
**Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqd2ptZmdwbG5xeWZmZGNnZGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjU2OTcsImV4cCI6MjA4ODY0MTY5N30.pi2HDGyXhsoZS0sivfUDzn9z3Qao-6hMKrWBxoQ-1uE`

Para executar SQL no banco: abrir `supabase.com/dashboard/project/djwjmfgplnqyffdcgdaw/sql`
