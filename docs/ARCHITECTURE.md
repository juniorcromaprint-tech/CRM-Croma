# CROMA PRINT CRM/ERP — ARQUITETURA DO SISTEMA

> Documento de referência arquitetural | Atualizado: 2026-03-10

**Documentos relacionados**: [BUSINESS_FLOW](BUSINESS_FLOW.md) | [PRICING_ENGINE](PRICING_ENGINE.md) | [FIELD_APP](FIELD_APP.md) | [DATABASE_OVERVIEW](DATABASE_OVERVIEW.md) | [MUBISYS_ANALYSIS](MUBISYS_ANALYSIS.md) | [PROJECT_GOVERNANCE](PROJECT_GOVERNANCE.md)

---

## Índice

- [1. Visão Geral](#1-visão-geral)
- [2. Stack Tecnológico](#2-stack-tecnológico)
- [3. Estrutura de Diretórios](#3-estrutura-de-diretórios)
- [4. Camadas da Aplicação](#4-camadas-da-aplicação)
- [5. Roteamento](#5-roteamento-38-rotas)
- [6. Autenticação e Autorização](#6-autenticação-e-autorização)
- [7. Backend (Supabase)](#7-backend-supabase)
- [8. Design System](#8-design-system)
- [9. Padrões de Código](#9-padrões-de-código)
- [10. Deploy e CI/CD](#10-deploy-e-cicd)
- [11. Setup Local (Desenvolvedor)](#11-setup-local-desenvolvedor)

---

## 1. Visão Geral

O sistema da Croma Print é composto por **dois produtos independentes** que compartilham o mesmo backend Supabase:

```
                    SUPABASE (Backend Unificado)
                 PostgreSQL + Auth + Storage + RLS
                           |
              +------------+------------+
              |                         |
        PRODUTO A                 PRODUTO B
        CRM/ERP                   App de Campo
        React SPA                 React SPA/PWA
        Desktop-first             Mobile-first
        Gestão completa           Execução only
```

### Produto A — CRM/ERP de Gestão (foco principal)
- **Público**: Equipe interna (direção, comercial, financeiro, produção, compras)
- **Interface**: Desktop-first, responsivo para tablet
- **Rota base**: `/` (raiz)
- **Deploy**: Vercel (tender-archimedes.vercel.app)
- **Status**: ✅ 29 páginas implementadas, 12 domínios de negócio

### Produto B — App de Campo
- **Público**: Instaladores e equipe externa
- **Interface**: Mobile-first (PWA)
- **Rota base**: `/` (app separado em `apps/campo/`)
- **Deploy**: Vercel (campo-croma.vercel.app)
- **Status**: ✅ 10 páginas, auth real, fotos/assinatura/mapa

> Detalhes completos do App de Campo em [FIELD_APP.md](FIELD_APP.md)

---

## 2. Stack Tecnológico

| Camada | Tecnologia | Versão | Notas |
|--------|-----------|--------|-------|
| Framework | React | 19.2.3 | Concurrent features habilitados |
| Linguagem | TypeScript | 5.5.3 | Strict mode |
| Build | Vite | 6.3.4 | SWC + PWA plugin |
| CSS | Tailwind CSS | 3.4.11 | + @tailwindcss/typography |
| Componentes UI | shadcn/ui (Radix) | 50+ componentes | Acessibilidade ARIA nativa |
| Data Fetching | TanStack React Query | 5.56.2 | staleTime 2min, auto-refetch |
| Roteamento | React Router | 6.26.2 | Code splitting com lazy() |
| Backend | Supabase | 2.97.0 | PostgreSQL + Auth + Storage + Realtime |
| Validação | Zod | 3.23.8 | 7 arquivos de schemas |
| Formulários | React Hook Form | 7.53.0 | Integrado com Zod |
| Gráficos | Recharts | 2.12.7 | Dashboards + KPIs |
| Mapas | Leaflet | 1.9.4 | Mapa de instalações |
| Datas | date-fns | 3.6.0 | Formatação PT-BR |
| Toasts | Sonner | - | Notificações |
| PDF | html2pdf.js | - | Exportação de orçamentos |

---

## 3. Estrutura de Diretórios

```
CRM-Croma/
├── src/                             # PRODUTO A — CRM/ERP
│   ├── domains/                     # DOMÍNIOS DE NEGÓCIO (12 módulos)
│   │   ├── admin/                   # Usuários, perfis, permissões, auditoria
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── pages/
│   │   │   ├── schemas/
│   │   │   ├── services/
│   │   │   └── types/
│   │   ├── clientes/                # Empresas, unidades, contatos
│   │   ├── comercial/               # Leads, oportunidades, propostas, orçamentos
│   │   ├── compras/                 # Fornecedores, cotações, pedidos de compra
│   │   ├── estoque/                 # Materiais, saldos, movimentações
│   │   ├── financeiro/              # Contas receber/pagar, DRE, comissões
│   │   ├── fiscal/                  # NF-e, certificados, documentos fiscais
│   │   ├── instalacao/              # Agendamento, equipes, ordens
│   │   ├── pedidos/                 # Pedidos, itens, timeline
│   │   ├── producao/                # Ordens produção, etapas, qualidade
│   │   └── qualidade/               # Ocorrências, tratativas, análise
│   │
│   ├── shared/                      # CÓDIGO COMPARTILHADO
│   │   ├── components/              # Layout, KpiCard, Breadcrumbs, CommandPalette
│   │   ├── constants/               # status.ts (472 linhas), permissions.ts, navigation.ts
│   │   ├── hooks/                   # useAuth, usePagination, useDebounce
│   │   ├── schemas/                 # Zod schemas por domínio (7 arquivos)
│   │   ├── services/                # pricing-engine.ts (Mubisys 9 passos), orcamento-pricing.service.ts
│   │   ├── types/                   # common.types.ts, database.types.ts
│   │   └── utils/                   # format.ts (BRL, datas, CNPJ, telefone), toast.ts
│   │
│   ├── components/ui/               # shadcn/ui (gerados, não editar manualmente)
│   ├── contexts/                    # AuthContext.tsx (sessão + permissões)
│   ├── integrations/supabase/       # client.ts (conexão)
│   ├── pages/                       # (legado) páginas em migração para domains/
│   └── styles/                      # globals.css
│
├── apps/campo/                      # PRODUTO B — App de Campo (PWA)
│   └── src/                         # Mesma stack, deploy separado
│
├── supabase/migrations/             # 7 arquivos SQL (001-006)
├── scripts/                         # Seeds, importações, utilitários
├── docs/                            # Documentação técnica (este diretório)
└── public/                          # Assets estáticos
```

### Convenção por Domínio

Cada domínio segue a mesma estrutura padronizada:
```
domains/{domínio}/
  components/    # Componentes específicos do domínio
  hooks/         # React Query hooks (queries + mutations)
  pages/         # Páginas/rotas do domínio
  schemas/       # Zod schemas de validação
  services/      # Lógica de negócio + chamadas Supabase
  types/         # TypeScript interfaces/types
```

---

## 4. Camadas da Aplicação

```
┌─────────────────────────────────────────────────────┐
│                  CAMADA DE UI                        │
│   Pages → Components → shadcn/ui                    │
│   (React components, layout, interação do usuário)  │
├─────────────────────────────────────────────────────┤
│               CAMADA DE ESTADO                       │
│   React Query (cache, refetch, mutations)            │
│   AuthContext (sessão, perfil, permissões)            │
├─────────────────────────────────────────────────────┤
│              CAMADA DE SERVIÇO                        │
│   services/*.ts (lógica de negócio)                  │
│   pricing-engine.ts (precificação Mubisys)           │
│   Zod schemas (validação de entrada)                 │
├─────────────────────────────────────────────────────┤
│               CAMADA DE DADOS                        │
│   Supabase Client (REST API + Realtime)              │
│   PostgreSQL (RLS, triggers, functions)              │
│   Storage (fotos, documentos, artes)                 │
└─────────────────────────────────────────────────────┘
```

### Regra Fundamental
> **Componentes React NUNCA contêm lógica de negócio.**
> Componentes chamam hooks → hooks chamam services → services chamam Supabase.

### Fluxo de Dados (exemplo)
```
OrcamentosPage.tsx (UI)
  → useOrcamentos() (hook React Query)
    → orcamentoService.listar() (service)
      → supabase.from("propostas").select(...) (Supabase client)
        → PostgreSQL com RLS (banco)
```

---

## 5. Roteamento (38 rotas)

Todas as rotas usam `React.lazy()` com code splitting automático.

| Grupo | Rotas | Descrição |
|-------|-------|-----------|
| Dashboard | `/` | Painel por role (diretor/comercial/financeiro/produção) |
| Comercial | `/leads`, `/pipeline`, `/propostas`, `/clientes`, `/orcamentos` | CRM completo |
| Orçamentos | `/orcamentos/novo`, `/orcamentos/:id`, `/orcamentos/:id/editar`, `/orcamentos/templates` | CRUD orçamentos + templates |
| Operacional | `/pedidos`, `/producao`, `/instalacoes` | Gestão operacional |
| Suprimentos | `/estoque`, `/compras`, `/produtos` | Materiais e compras |
| Financeiro | `/financeiro`, `/dre`, `/comissoes` | Gestão financeira |
| Qualidade | `/ocorrencias` | Não-conformidades |
| Fiscal | `/fiscal/*` (6 sub-rotas) | NF-e, documentos, certificados, fila, auditoria |
| Admin | `/admin/usuarios`, `/admin/precificacao`, `/admin/config`, `/admin/auditoria` | Configuração |

### Agrupamento por Navegação (Sidebar)
8 grupos: **Painel**, **Comercial**, **Operacional**, **Suprimentos**, **Financeiro**, **Qualidade**, **Fiscal**, **Administração** — filtrados automaticamente por role do usuário.

---

## 6. Autenticação e Autorização

### Autenticação
- Supabase Auth (email/senha)
- Sessão gerenciada via `AuthContext`
- `DemoRoute` wrapper permite acesso sem auth (modo demo/protótipo)
- `ProtectedRoute` para áreas autenticadas (usado no App de Campo)
- Perfil do usuário carregado da tabela `profiles` (id, first_name, last_name, role)

### Perfis (9 roles)

| Role | Módulos com Acesso | Nível |
|------|--------------------|-------|
| `admin` | Todos os módulos, todas as ações | Total |
| `diretor` | Todos os módulos (leitura + aprovações seletivas) | Estratégico |
| `comercial` | Comercial, clientes (CRUD) | Operacional |
| `comercial_senior` | Comercial, clientes, pedidos (CRUD + aprovações) | Tático |
| `financeiro` | Financeiro, DRE, comissões (CRUD + aprovação) | Operacional |
| `producao` | Produção, estoque (CRUD) | Operacional |
| `compras` | Compras, estoque, fornecedores (CRUD) | Operacional |
| `logistica` | Instalação, pedidos (leitura) | Operacional |
| `instalador` | App de Campo apenas (suas próprias tarefas) | Campo |

### Permissões Granulares
- **11 módulos** × **6 ações** = 66 combinações possíveis
- Ações: `ver`, `criar`, `editar`, `excluir`, `aprovar`, `exportar`
- Verificação via `can(módulo, ação)` no AuthContext
- Sidebar filtra navegação automaticamente por role
- 201 vínculos role↔permission configurados no banco

---

## 7. Backend (Supabase)

### Banco de Dados
- PostgreSQL com **65+ tabelas** organizadas por domínio
- Row Level Security (RLS) em **todas** as tabelas
- Triggers de auditoria em 16 tabelas críticas
- Validação de transição de status (máquina de estados)
- 175+ índices (simples + compostos + trigram para busca textual)

> Detalhes completos em [DATABASE_OVERVIEW.md](DATABASE_OVERVIEW.md)

### Migrations
```
supabase/migrations/
  001_complete_schema.sql       # 51 tabelas base (1.911 linhas)
  002_schema_corrections.sql    # +14 tabelas, RLS, audit, triggers (1.874 linhas)
  003_campo_migration.sql       # Tabelas do app de campo
  003_fiscal_module.sql         # Módulo fiscal / NF-e (11 tabelas)
  004_integracao_bridge.sql     # Bridge CRM↔Campo (views + triggers)
  005_storage_security.sql      # Segurança de storage (buckets)
  006_orcamento_module.sql      # Módulo de orçamento avançado (7 tabelas)
```

### Sequences para Auto-Numeração
| Prefixo | Entidade | Exemplo |
|---------|----------|---------|
| `PROP-YYYY-####` | Propostas/Orçamentos | PROP-2026-0001 |
| `PED-YYYY-####` | Pedidos de venda | PED-2026-0042 |
| `OP-YYYY-####` | Ordens de produção | OP-2026-0127 |
| `INST-YYYY-####` | Ordens de instalação | INST-2026-0018 |
| `PC-YYYY-####` | Pedidos de compra | PC-2026-0005 |
| `OC-YYYY-####` | Ocorrências | OC-2026-0003 |

### Dados em Produção
| Tabela | Registros | Observação |
|--------|-----------|-----------|
| `clientes` | 307 | Importados do Mubisys (Beira Rio, Renner, Paquetá, etc.) |
| `materiais` | 467 | Catálogo completo importado |
| `produtos` | 156 | Todas as categorias |
| `profiles` | 4 | admin, técnico1, técnico2, supervisor |
| `config_precificacao` | 1 | Defaults Mubisys corretos |

---

## 8. Design System

### Princípios
- **Consistência**: Todos os componentes usam shadcn/ui como base
- **Responsividade**: Desktop-first com breakpoints `md:` (768px) e `lg:` (1024px)
- **Acessibilidade**: Componentes Radix UI com ARIA built-in
- **Status visual**: Badges coloridas por status em todo o sistema

### Layout Principal
- **Sidebar**: 256px (desktop), colapsável para 64px com tooltip
- **Mobile**: Header + bottom nav (5 ícones) + sheet menu lateral
- **Command palette**: `Ctrl+K` / `Cmd+K` — 20 atalhos em 7 grupos
- **Breadcrumbs**: Auto-gerado por URL, 28 segmentos mapeados

### Padrão de Cores por Domínio
| Domínio | Cor | Tailwind |
|---------|-----|----------|
| Comercial | Azul | `blue-500` |
| Financeiro | Esmeralda | `emerald-500` |
| Produção | Laranja | `orange-500` |
| Qualidade | Vermelho | `red-500` |
| Instalação | Índigo | `indigo-500` |
| Admin | Cinza | `slate-600` |

### Componentes Shared Destacados
| Componente | Arquivo | Descrição |
|-----------|---------|-----------|
| `KpiCard` | `shared/components/KpiCard.tsx` | Card com sparkline, 11 variantes de cor, skeleton loading |
| `Breadcrumbs` | `shared/components/Breadcrumbs.tsx` | Auto-gerado, 30 segmentos mapeados |
| `CommandPalette` | `shared/components/CommandPalette.tsx` | Ctrl+K, busca em 7 grupos (22 atalhos) |
| `Layout` | `components/Layout.tsx` | Sidebar colapsável, mobile responsive |
| `ProdutoSelector` | `comercial/components/ProdutoSelector.tsx` | Cascata Produto→Modelo com auto-preenchimento |
| `MaterialEditor` | `comercial/components/MaterialEditor.tsx` | Editor de materiais por item (add/remove/edit) |
| `AcabamentoSelector` | `comercial/components/AcabamentoSelector.tsx` | Toggle de acabamentos com custo calculado |
| `ServicoSelector` | `comercial/components/ServicoSelector.tsx` | Seletor de serviços (horas × custo) |
| `TemplateSelector` | `comercial/components/TemplateSelector.tsx` | Modal de templates de orçamento |
| `OrcamentoPDF` | `comercial/components/OrcamentoPDF.tsx` | Layout A4 para impressão/PDF profissional |
| `PricingCalculator` | `comercial/components/PricingCalculator.tsx` | Painel de precificação Mubisys ao vivo |

---

## 9. Padrões de Código

### Hooks (React Query)
```typescript
// Padrão: use{Entidade}s para lista, use{Entidade} para detalhe
export function useClientes(filtros?: FiltrosCliente) {
  return useQuery({
    queryKey: ["clientes", filtros],
    queryFn: () => clienteService.listar(filtros),
    staleTime: 2 * 60 * 1000, // 2 minutos
  });
}

// Mutations invalidam cache automaticamente
export function useCriarCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clienteService.criar,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clientes"] }),
  });
}
```

### Services
```typescript
// Padrão: objeto com métodos CRUD + lógica de negócio
export const clienteService = {
  listar: async (filtros) => { /* supabase query com joins */ },
  buscarPorId: async (id) => { /* supabase query + subqueries */ },
  criar: async (dados) => { /* validação Zod + supabase insert */ },
  atualizar: async (id, dados) => { /* supabase update */ },
  excluir: async (id) => { /* soft delete: set excluido_em */ },
};
```

### Validação (Zod)
```typescript
// Padrão: schema por entidade, 7 arquivos em shared/schemas/
export const clienteSchema = z.object({
  razao_social: z.string().min(1, "Obrigatório"),
  cnpj: z.string().regex(/^\d{14}$/, "CNPJ inválido"),
  classificacao: z.enum(["A", "B", "C", "D"]),
  // ...
});
```

### Nomenclatura
| Tipo | Convenção | Exemplo |
|------|-----------|---------|
| Página | `{Nome}Page.tsx` | `ClientesPage.tsx` |
| Hook | `use{Nome}.ts` | `useClientes.ts` |
| Service | `{nome}.service.ts` | `orcamento.service.ts` |
| Schema | `{domínio}.schemas.ts` | `comercial.schemas.ts` |
| Componente | `{NomePascal}.tsx` | `PricingCalculator.tsx` |

---

## 10. Deploy e CI/CD

| Ambiente | Plataforma | URL | Trigger |
|----------|-----------|-----|---------|
| CRM/ERP | Vercel (tender-archimedes) | tender-archimedes.vercel.app | Push para `main` |
| App Campo | Vercel (campo-croma) | campo-croma.vercel.app | Push para `main` (root: `apps/campo/`) |

- **Build automático** via Vercel em cada push para `main`
- **Preview deploys** em branches (URL temporária para revisão)
- **GitHub**: `juniorcromaprint-tech/CRM-Croma`
- **Build time**: ~13 segundos (Vite + SWC)
- **Bundle size**: ~1.6 MB (antes de gzip), ~430 KB (gzipped)

---

## 11. Setup Local (Desenvolvedor)

### Pré-requisitos
- Node.js 18+ (recomendado 20 LTS)
- npm 9+
- Git

### Instalação
```bash
git clone https://github.com/juniorcromaprint-tech/CRM-Croma.git
cd CRM-Croma
npm install --legacy-peer-deps   # Necessário por conflito next-themes + React 19
```

### Desenvolvimento
```bash
npm run dev          # Inicia Vite dev server (porta 5173)
npm run build        # Build de produção (verifica TypeScript)
npm run preview      # Preview do build local
npm run lint         # ESLint
```

### Variáveis de Ambiente
O projeto usa as credenciais Supabase diretamente no client.ts (projeto compartilhado). Para desenvolvimento local, nenhuma configuração adicional é necessária.

### Notas Importantes
- `--legacy-peer-deps` é obrigatório no `npm install` devido a conflito de peer dependency entre `next-themes@0.3.0` e React 19
- O `DemoRoute` wrapper permite navegar sem login (modo demo)
- Build deve passar com **zero erros TypeScript** antes de qualquer push
