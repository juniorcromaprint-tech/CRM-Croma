# CROMA PRINT CRM/ERP — ARQUITETURA DO SISTEMA

> Documento de referencia arquitetural | Atualizado: 2026-03-10

---

## 1. Visao Geral

O sistema da Croma Print e composto por **dois produtos independentes** que compartilham o mesmo backend Supabase:

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
        Gestao completa           Execucao only
```

### Produto A — CRM/ERP de Gestao (foco principal)
- **Publico**: Equipe interna (direcao, comercial, financeiro, producao, compras)
- **Interface**: Desktop-first, responsivo para tablet
- **Rota base**: `/` (raiz)
- **Deploy**: Vercel (tender-archimedes.vercel.app)

### Produto B — App de Campo
- **Publico**: Instaladores e equipe externa
- **Interface**: Mobile-first (PWA)
- **Rota base**: `/` (app separado em `apps/campo/`)
- **Deploy**: Vercel (campo-croma.vercel.app)

---

## 2. Stack Tecnologico

| Camada | Tecnologia | Versao |
|--------|-----------|--------|
| Framework | React | 19.2.3 |
| Linguagem | TypeScript | 5.5.3 |
| Build | Vite | 6.3.4 |
| CSS | Tailwind CSS | 3.4.11 |
| Componentes UI | shadcn/ui (Radix) | 50+ componentes |
| Data Fetching | TanStack React Query | 5.56.2 |
| Roteamento | React Router | 6.26.2 |
| Backend | Supabase | 2.97.0 |
| Validacao | Zod | 3.23.8 |
| Formularios | React Hook Form | 7.53.0 |
| Graficos | Recharts | 2.12.7 |
| Mapas | Leaflet | 1.9.4 |
| Datas | date-fns | 3.6.0 |
| Toasts | Sonner | - |
| PDF | html2pdf.js | - |

---

## 3. Estrutura de Diretorios

```
src/
  app/                          # (futuro) providers, router principal

  domains/                      # DOMINIOS DE NEGOCIO (12 modulos)
    admin/                      # Usuarios, perfis, permissoes, auditoria
      components/
      hooks/
      pages/
      schemas/
      services/
      types/
    clientes/                   # Empresas, unidades, contatos
    comercial/                  # Leads, oportunidades, propostas, orcamentos
    compras/                    # Fornecedores, cotacoes, pedidos de compra
    estoque/                    # Materiais, saldos, movimentacoes
    financeiro/                 # Contas receber/pagar, DRE, comissoes
    fiscal/                     # NF-e, certificados, documentos fiscais
    instalacao/                 # Agendamento, equipes, ordens
    pedidos/                    # Pedidos, itens, timeline
    producao/                   # Ordens producao, etapas, qualidade
    qualidade/                  # Ocorrencias, tratativas, analise

  shared/                       # CODIGO COMPARTILHADO
    components/                 # Layout, Sidebar, Header, KpiCard
    constants/                  # status.ts, permissions.ts, navigation.ts
    hooks/                      # useAuth, usePagination, useDebounce
    schemas/                    # Zod schemas por dominio (7 arquivos)
    services/                   # pricing-engine.ts, supabase client
    types/                      # common.types.ts, database.types.ts
    utils/                      # format.ts (BRL, datas, CNPJ, telefone)

  components/ui/                # shadcn/ui (gerados, nao editar)
  contexts/                     # AuthContext.tsx
  integrations/supabase/        # client.ts (conexao)
  styles/                       # globals.css
  pages/                        # (legado) paginas antigas sendo migradas
```

### Convenção por Dominio

Cada dominio segue a mesma estrutura:
```
domains/{dominio}/
  components/    # Componentes especificos do dominio
  hooks/         # React Query hooks (queries + mutations)
  pages/         # Paginas/rotas do dominio
  schemas/       # Zod schemas de validacao
  services/      # Logica de negocio + chamadas Supabase
  types/         # TypeScript interfaces/types
```

---

## 4. Camadas da Aplicacao

```
┌─────────────────────────────────────────────┐
│              CAMADA DE UI                     │
│  Pages → Components → shadcn/ui              │
│  (React components, layout, interacao)       │
├─────────────────────────────────────────────┤
│           CAMADA DE ESTADO                    │
│  React Query (cache, refetch, mutations)     │
│  AuthContext (sessao, perfil, permissoes)     │
├─────────────────────────────────────────────┤
│          CAMADA DE SERVICO                    │
│  services/*.ts (logica de negocio)           │
│  pricing-engine.ts (precificacao Mubisys)    │
│  Zod schemas (validacao)                     │
├─────────────────────────────────────────────┤
│          CAMADA DE DADOS                      │
│  Supabase Client (REST API)                  │
│  PostgreSQL (RLS, triggers, functions)       │
│  Storage (fotos, documentos, artes)          │
└─────────────────────────────────────────────┘
```

### Regra Fundamental
> **Componentes React NUNCA contem logica de negocio.**
> Componentes chamam hooks → hooks chamam services → services chamam Supabase.

---

## 5. Roteamento (38 rotas)

| Grupo | Rotas | Descricao |
|-------|-------|-----------|
| Dashboard | `/` | Painel por role (diretor/comercial/financeiro/producao) |
| Comercial | `/leads`, `/pipeline`, `/propostas`, `/clientes`, `/orcamentos` | CRM completo |
| Orcamentos | `/orcamentos/novo`, `/orcamentos/:id`, `/orcamentos/:id/editar` | CRUD orcamentos |
| Operacional | `/pedidos`, `/producao`, `/instalacoes` | Gestao operacional |
| Suprimentos | `/estoque`, `/compras`, `/produtos` | Materiais e compras |
| Financeiro | `/financeiro`, `/dre`, `/comissoes` | Gestao financeira |
| Qualidade | `/ocorrencias` | Nao-conformidades |
| Fiscal | `/fiscal/*` | NF-e, documentos, certificados |
| Admin | `/admin/usuarios`, `/admin/precificacao`, `/admin/config`, `/admin/auditoria` | Configuracao |

Todas as rotas usam `React.lazy()` com code splitting automatico.

---

## 6. Autenticacao e Autorizacao

### Autenticacao
- Supabase Auth (email/senha)
- Sessao gerenciada via `AuthContext`
- `DemoRoute` wrapper permite acesso sem auth (modo demo/prototipo)
- `ProtectedRoute` para areas autenticadas

### Perfis (8 roles)
| Role | Acesso |
|------|--------|
| `admin` | Tudo |
| `diretor` | Leitura total + aprovacoes |
| `comercial` | CRM, clientes |
| `comercial_senior` | CRM + aprovacoes |
| `financeiro` | Financeiro, DRE, comissoes |
| `producao` | Producao, estoque |
| `compras` | Compras, estoque, fornecedores |
| `logistica` | Instalacao, pedidos |
| `instalador` | App de campo apenas |

### Permissoes Granulares
- 11 modulos x 6 acoes = 66 combinacoes possiveis
- Acoes: `ver`, `criar`, `editar`, `excluir`, `aprovar`, `exportar`
- Verificacao via `can(modulo, acao)` no AuthContext
- Sidebar filtra navegacao automaticamente por role

---

## 7. Backend (Supabase)

### Banco de Dados
- PostgreSQL com 65 tabelas organizadas por dominio
- Row Level Security (RLS) em todas as tabelas
- Triggers de auditoria em 16 tabelas criticas
- Validacao de transicao de status (maquina de estados)
- 175+ indices (simples + compostos + trigram)

### Migrations
```
supabase/migrations/
  001_complete_schema.sql       # 51 tabelas base (1.911 linhas)
  002_schema_corrections.sql    # 14 tabelas novas + RLS + audit (1.874 linhas)
  003_campo_migration.sql       # Tabelas do app de campo
  003_fiscal_module.sql         # Modulo fiscal / NF-e
  004_integracao_bridge.sql     # Camada de integracao
  005_storage_security.sql      # Seguranca de storage
  006_orcamento_module.sql      # Modulo de orcamento avancado
```

### Sequences para Auto-Numeracao
- `PROP-YYYY-####` (propostas)
- `PED-YYYY-####` (pedidos)
- `OP-YYYY-####` (ordens producao)
- `INST-YYYY-####` (ordens instalacao)
- `PC-YYYY-####` (pedidos compra)

---

## 8. Design System

### Principios
- **Consistencia**: Todos os componentes usam shadcn/ui como base
- **Responsividade**: Desktop-first com breakpoints `md:` (768px) e `lg:` (1024px)
- **Acessibilidade**: Componentes Radix UI com ARIA built-in
- **Status visual**: Badges coloridas por status em todo o sistema

### Layout Principal
- Sidebar: 256px (desktop), colapsavel para 64px
- Mobile: Header + bottom nav + sheet menu
- Command palette: `Ctrl+K` / `Cmd+K`
- Breadcrumbs em todas as paginas

### Padrao de Cores por Dominio
- Comercial: Azul (`blue-500`)
- Financeiro: Esmeralda (`emerald-500`)
- Producao: Laranja (`orange-500`)
- Qualidade: Vermelho (`red-500`)
- Admin: Slate (`slate-600`)

---

## 9. Padroes de Codigo

### Hooks (React Query)
```typescript
// Padrao: use{Entidade}s para lista, use{Entidade} para detalhe
export function useClientes(filtros?: FiltrosCliente) {
  return useQuery({
    queryKey: ["clientes", filtros],
    queryFn: () => clienteService.listar(filtros),
    staleTime: 2 * 60 * 1000, // 2 min
  });
}
```

### Services
```typescript
// Padrao: classe ou objeto com metodos CRUD
export const clienteService = {
  listar: async (filtros) => { /* supabase query */ },
  buscarPorId: async (id) => { /* supabase query */ },
  criar: async (dados) => { /* supabase insert */ },
  atualizar: async (id, dados) => { /* supabase update */ },
  excluir: async (id) => { /* soft delete */ },
};
```

### Validacao (Zod)
```typescript
// Padrao: schema por entidade com .parse() ou .safeParse()
export const clienteSchema = z.object({
  razao_social: z.string().min(1, "Obrigatorio"),
  cnpj: z.string().regex(/^\d{14}$/, "CNPJ invalido"),
  // ...
});
```

---

## 10. Deploy e CI/CD

| Ambiente | Plataforma | Trigger |
|----------|-----------|---------|
| CRM/ERP | Vercel (tender-archimedes) | Push para `main` |
| App Campo | Vercel (campo-croma) | Push para `main` (root: `apps/campo/`) |

- Build automatico via Vercel
- Preview deploys em branches
- GitHub: `juniorcromaprint-tech/CRM-Croma`
