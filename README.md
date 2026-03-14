# CROMA PRINT — CRM/ERP

> Sistema operacional completo para a Croma Print Comunicação Visual.
> Dois produtos integrados: **CRM/ERP de gestão** (desktop) + **App de Campo** (mobile PWA).

**Stack**: React 19 · TypeScript · Vite · Tailwind · shadcn/ui · Supabase · TanStack Query v5

---

## Navegação Rápida

| Documento | Conteúdo |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, estrutura de diretórios, padrões de código, deploy |
| [docs/DATABASE_OVERVIEW.md](docs/DATABASE_OVERVIEW.md) | 65+ tabelas, RLS, triggers, índices, migrations |
| [docs/PRICING_ENGINE.md](docs/PRICING_ENGINE.md) | Motor Mubisys 9 passos — fórmulas, markups, margens |
| [docs/MUBISYS_ANALYSIS.md](docs/MUBISYS_ANALYSIS.md) | Análise do sistema legado Mubisys e mapeamento de dados |
| [docs/BUSINESS_FLOW.md](docs/BUSINESS_FLOW.md) | Fluxo Prospect → Pedido → Produção → Instalação |
| [docs/FIELD_APP.md](docs/FIELD_APP.md) | App de Campo — guia completo (features, deploy, auth) |
| [docs/PROJECT_GOVERNANCE.md](docs/PROJECT_GOVERNANCE.md) | Agentes de desenvolvimento, regras, decisões |
| [docs/PROJECT_MEMORY.md](docs/PROJECT_MEMORY.md) | Histórico de decisões arquiteturais e padrões |
| [AI_RULES.md](AI_RULES.md) | Regras do assistente de IA para este projeto |

---

## Dois Produtos

```
                    SUPABASE (Backend Unificado)
                 PostgreSQL + Auth + Storage + Realtime
                              |
               +--------------+--------------+
               |                             |
         PRODUTO A                     PRODUTO B
         CRM/ERP                       App de Campo
         src/                          apps/campo/
         Desktop-first                 Mobile PWA
         28 páginas                    10 páginas
         Modo demo (sem auth)          Auth real
```

### Produto A — CRM/ERP
- **URL produção**: `crm-croma.vercel.app`
- **Domínios**: Admin, Comercial, Clientes, Pedidos, Produção, Estoque, Compras, Financeiro, Fiscal, Instalação, Qualidade
- **Deploy**: Vercel — push para `main` → build automático (~13s)

### Produto B — App de Campo
- **URL produção**: `campo-croma.vercel.app`
- **Features**: Jobs, fotos com watermark, assinatura digital, mapa Leaflet, analytics
- **Deploy**: Vercel (root: `apps/campo/`) — mesmo push para `main`

---

## Módulos do CRM/ERP (28 páginas)

| Módulo | Páginas | Destaques |
|--------|---------|-----------|
| **Dashboard** | 4 (diretor, comercial, financeiro, produção) | KPIs + sparklines Recharts, por role |
| **Comercial** | Leads, Pipeline Kanban, Propostas | CRM completo |
| **Orçamentos** | Lista, Editor, View, Templates | Motor Mubisys ao vivo, PDF profissional |
| **Clientes** | Lista, Detalhe | 307 clientes importados |
| **Pedidos** | Lista + timeline | Conversão automática de orçamento |
| **Produção** | Kanban de ordens | Etapas, responsáveis, prioridade |
| **Estoque** | 3 abas (saldos, movimentações, materiais) | 467 materiais no catálogo |
| **Compras** | Cotações, pedidos de compra | Integrado com estoque |
| **Financeiro** | Contas a receber/pagar, comissões | Dashboard financeiro |
| **Fiscal** | NF-e (6 sub-páginas) | Emissão, certificados, fila, auditoria |
| **Instalação** | Realtime via Supabase | Integração App de Campo |
| **Qualidade** | Ocorrências | Não-conformidades, tratativas |
| **Admin** | Usuários, Config, Auditoria, Precificação | 9 roles, 201 permissões |

---

## Banco de Dados — Migrations

| Arquivo | Tabelas | Status |
|---------|---------|--------|
| `001_complete_schema.sql` | 51 tabelas base | ✅ Executada |
| `002_schema_corrections.sql` | +14 tabelas, RLS, audit triggers | ✅ Executada |
| `003_campo_migration.sql` | Jobs, fotos, assinaturas, checklists | ✅ Executada |
| `003_fiscal_module.sql` | 11 tabelas fiscal / NF-e | ✅ Executada |
| `004_integracao_bridge.sql` | Views + triggers ERP↔Campo | ⚠️ Pendente |
| `005_storage_security.sql` | RLS nos buckets de storage | ✅ Executada |
| `006_orcamento_module.sql` | acabamentos, servicos, proposta_item_materiais, templates | ⚠️ Pendente |

> Execute `004` e `006` no [Supabase SQL Editor](https://supabase.com/dashboard) para ativar a integração completa ERP↔Campo e o módulo de orçamento avançado.

---

## Quick Start

```bash
# 1. Clonar
git clone https://github.com/juniorcromaprint-tech/CRM-Croma.git
cd CRM-Croma

# 2. Instalar dependências (--legacy-peer-deps obrigatório: next-themes + React 19)
npm install --legacy-peer-deps

# 3. Iniciar desenvolvimento
npm run dev          # CRM/ERP em http://localhost:5173

# App de Campo (separado)
cd apps/campo && npm install --legacy-peer-deps && npm run dev
```

### Comandos úteis

```bash
npm run build        # Build de produção (verifica TypeScript — deve ter 0 erros)
npm run preview      # Preview do build local
npm run lint         # ESLint
```

> **Acesso demo**: O CRM/ERP usa `DemoRoute` — qualquer rota abre sem necessidade de login.

---

## Motor de Precificação (Mubisys 9 passos)

O orçamento usa o algoritmo Mubisys para calcular preços em tempo real:

```
Cm   → Custo de materiais (MP × área)
P    → Custo de processos (MO × tempo)
Pv   → Preço de venda mínimo
Vb   → Valor base sem markup
Vam  → Valor com acabamentos
Vm   → Valor com margem mínima
Vv   → Valor final de venda
```

Ver detalhes completos em [docs/PRICING_ENGINE.md](docs/PRICING_ENGINE.md) e [docs/MUBISYS_ANALYSIS.md](docs/MUBISYS_ANALYSIS.md).

---

## Arquitetura de Dados

- **Projeto Supabase**: `djwjmfgplnqyffdcgdaw.supabase.co`
- **PostgreSQL**: 65+ tabelas com RLS em todas
- **Auth**: Supabase Auth — 9 roles, 201 permissões granulares
- **Storage**: Buckets para fotos, documentos e artes
- **Realtime**: Supabase Realtime para instalações (ERP ← Campo)

Ver schema completo em [docs/DATABASE_OVERVIEW.md](docs/DATABASE_OVERVIEW.md).

---

## Repositório e Deploy

| Item | Detalhe |
|------|---------|
| **GitHub** | `github.com/juniorcromaprint-tech/CRM-Croma` |
| **Branch produção** | `main` |
| **Vercel CRM** | `crm-croma.vercel.app` |
| **Vercel Campo** | `campo-croma.vercel.app` |
| **Build time** | ~13 segundos (Vite + SWC) |
| **Bundle** | ~1.6 MB (~430 KB gzip) |
