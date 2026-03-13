# CROMA PRINT — CRM/ERP SISTEMA

> **Versão**: 3.1 | **Atualizado**: 2026-03-13 | **Status**: Operacional em Produção

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

---

## EMPRESA

| Campo | Detalhe |
|---|---|
| **Nome** | Croma Print Comunicação Visual |
| **Segmento** | Comunicação visual profissional para varejo e indústria |
| **Localização** | Brasil |
| **Especialização** | Redes de lojas, franquias, fabricantes de calçados, grandes varejistas |
| **Diferenciais** | Produção própria, atendimento nacional, padronização de redes |

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
```

---

## FLUXO PRINCIPAL DO NEGÓCIO

```
Lead → Orçamento → Pedido → Produção → Instalação → Faturamento
```

---

## ESTADO ATUAL DO BANCO (2026-03-13)

| Migration | Status | Conteúdo |
|---|---|---|
| `001_complete_schema.sql` | ✅ Executada | 51 tabelas base |
| `002_schema_corrections.sql` | ✅ Executada | RLS granular, triggers, índices |
| `003_campo_migration.sql` | ✅ Executada | Jobs, fotos, assinaturas, checklists |
| `003_fiscal_module.sql` | ✅ Executada | 11 tabelas fiscal + RPCs NF-e |
| `004_integracao_bridge.sql` | ❌ NÃO executada | Bridge ERP↔Campo (views + triggers) |
| `005_storage_security.sql` | ✅ Executada | RLS nos buckets |
| `006_orcamento_module.sql` | ❌ NÃO executada | acabamentos, servicos, regras_precificacao — **SCHEMA PRECISA SER CORRIGIDO antes de executar** |
| `008_update_materiais_precos.sql` | ✅ Executada | 464 materiais com preço real Mubisys |
| `009_update_produtos_markups.sql` | ✅ Executada | 156 modelos com markup real |
| `020_portal_tracking_pagamento.sql` | ✅ Executada | Portal cliente, tracking, pagamento, notificações |

### Dados no Banco
- `clientes`: 307 registros
- `materiais`: 467 registros (464 com preço_medio, 3 sem) — visíveis em `/admin/materiais`
- `produtos`: 156 registros
- `produto_modelos`: 156 registros (markup seedado)
- `modelo_materiais`: centenas de matérias-primas disponíveis em `/admin/materiais` — vinculação aos modelos pendente
- `modelo_processos`: **0 registros** — CRÍTICO

---

## PROBLEMAS CRÍTICOS CONHECIDOS (atualizado 2026-03-13)

1. **Orçamento gera R$ 0,00** — editor envia arrays vazios para o motor Mubisys
2. **Bug multiplicação dupla** — `precoTotal = precoVenda * quantidade` (precoVenda já inclui qty)
3. **Migration 006 schema incompatível** — 3 definições diferentes no código
4. **modelo_materiais sem vínculo** — materiais existem mas não estão vinculados aos modelos de produto

> ~~ERP sem auth~~ — **RESOLVIDO**: auth real funcionando em `crm-croma.vercel.app`

Ver auditoria completa: `docs/AUDITORIA_COMPLETA_2026-03-10.md`

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
