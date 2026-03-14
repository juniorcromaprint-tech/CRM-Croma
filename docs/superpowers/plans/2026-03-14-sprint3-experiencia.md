# Sprint 3 — Experiência: Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transformar o ERP de protótipo em sistema profissional — performance rápida, feedback visual correto, codebase limpo sem dead code.

**Architecture:** 6 chunks independentes que podem ser executados em paralelo (2-3 subagentes por vez). Chunks 1-2 são infraestrutura (lazy loading + tipos). Chunks 3-4 são otimização (paginação + queries). Chunks 5-6 são polimento (UX + limpeza).

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui + TanStack Query v5 + Supabase

**Repositório:** `C:\Users\Caldera\Claude\CRM-Croma`

---

## Achados da Investigação (2026-03-14)

Antes de planejar, auditei o codebase. Itens da spec que já estão resolvidos:

| Item Spec | Status | Evidência |
|-----------|--------|-----------|
| G.3: Substituir window.confirm | ✅ JÁ FEITO | 0 instâncias. AlertDialog padronizado em 12+ arquivos |
| G.5: Remover console.log | ✅ JÁ FEITO | 0 instâncias em src/ |
| G.2: AlertDialog em ações destrutivas | ✅ JÁ FEITO | Presente em todos os locais de delete/cancel |
| F.4: staleTime nos hooks de stats | ✅ JÁ FEITO | Default 2min no QueryClient + explícito nos hooks |

Itens que precisam de trabalho:

| Item Spec | Situação Encontrada |
|-----------|---------------------|
| F.1: Lazy loading | 49 rotas, apenas 1 lazy (PortalOrcamentoPage) |
| F.2: Tipos Supabase | Nenhum arquivo de tipos gerado. Tipos manuais dispersos |
| F.3: Paginação | 4/7 páginas OK. Faltam: OrcamentosPage, ProducaoPage, EstoquePage |
| F.5: select('*') | 37+ instâncias. Zero otimização de colunas |
| G.1: Loading states | Padrão bom mas não universal |
| G.4: /admin/auditoria | Bug real: busca client-side após paginação server-side |
| G.6: Dead code | 5 arquivos (2.036 linhas): JobDetail, Jobs, NewJob, NotFound, Team |

---

## Chunk 1: Lazy Loading nas Rotas Protegidas

> **Paralelizável:** SIM — independente de todos os outros chunks

### Task 1.1: Criar componente LazyPage wrapper

**Files:**
- Create: `src/shared/components/LazyPage.tsx`

- [ ] **Step 1: Criar o wrapper de Suspense reutilizável**

```tsx
import { Suspense, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

const fallback = (
  <div className="flex h-[60vh] items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
  </div>
);

export default function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/components/LazyPage.tsx
git commit -m "feat: add LazyPage Suspense wrapper for route code-splitting"
```

---

### Task 1.2: Converter comercialRoutes para lazy imports

**Files:**
- Modify: `src/routes/comercialRoutes.tsx`

- [ ] **Step 1: Ler o arquivo atual**

```
Read: src/routes/comercialRoutes.tsx
```

- [ ] **Step 2: Reescrever com lazy imports**

Substituir o conteúdo inteiro de `src/routes/comercialRoutes.tsx`:

```tsx
import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";

const DashboardPage = lazy(() => import("@/domains/comercial/pages/DashboardPage"));
const LeadsPage = lazy(() => import("@/domains/comercial/pages/LeadsPage"));
const LeadDetailPage = lazy(() => import("@/domains/comercial/pages/LeadDetailPage"));
const PipelinePage = lazy(() => import("@/domains/comercial/pages/PipelinePage"));
const OrcamentosPage = lazy(() => import("@/domains/comercial/pages/OrcamentosPage"));
const OrcamentoEditorPage = lazy(() => import("@/domains/comercial/pages/OrcamentoEditorPage"));
const OrcamentoViewPage = lazy(() => import("@/domains/comercial/pages/OrcamentoViewPage"));
const PropostasPage = lazy(() => import("@/domains/comercial/pages/PropostasPage"));
const CalendarioPage = lazy(() => import("@/domains/comercial/pages/CalendarioPage"));
const CampanhasPage = lazy(() => import("@/domains/comercial/pages/CampanhasPage"));

export const comercialRoutes = (
  <>
    <Route index element={<LazyPage><DashboardPage /></LazyPage>} />
    <Route path="leads" element={<LazyPage><LeadsPage /></LazyPage>} />
    <Route path="leads/:id" element={<LazyPage><LeadDetailPage /></LazyPage>} />
    <Route path="pipeline" element={<LazyPage><PipelinePage /></LazyPage>} />
    <Route path="orcamentos" element={<LazyPage><OrcamentosPage /></LazyPage>} />
    <Route path="orcamentos/novo" element={<LazyPage><OrcamentoEditorPage /></LazyPage>} />
    <Route path="orcamentos/:id" element={<LazyPage><OrcamentoViewPage /></LazyPage>} />
    <Route path="orcamentos/:id/editar" element={<LazyPage><OrcamentoEditorPage /></LazyPage>} />
    <Route path="propostas" element={<LazyPage><PropostasPage /></LazyPage>} />
    <Route path="calendario" element={<LazyPage><CalendarioPage /></LazyPage>} />
    <Route path="campanhas" element={<LazyPage><CampanhasPage /></LazyPage>} />
  </>
);
```

- [ ] **Step 3: Verificar build**

Run: `npx vite build --mode production 2>&1 | tail -20`
Expected: Build success sem erros de import

- [ ] **Step 4: Commit**

```bash
git add src/routes/comercialRoutes.tsx
git commit -m "perf: lazy-load comercial routes for code splitting"
```

---

### Task 1.3: Converter clientesRoutes para lazy imports

**Files:**
- Modify: `src/routes/clientesRoutes.tsx`

- [ ] **Step 1: Reescrever com lazy imports**

```tsx
import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";

const ClientesPage = lazy(() => import("@/domains/clientes/pages/ClientesPage"));
const ClienteDetailPage = lazy(() => import("@/domains/clientes/pages/ClienteDetailPage"));

export const clientesRoutes = (
  <>
    <Route path="clientes" element={<LazyPage><ClientesPage /></LazyPage>} />
    <Route path="clientes/:id" element={<LazyPage><ClienteDetailPage /></LazyPage>} />
  </>
);
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/clientesRoutes.tsx
git commit -m "perf: lazy-load clientes routes"
```

---

### Task 1.4: Converter operacionalRoutes para lazy imports

**Files:**
- Modify: `src/routes/operacionalRoutes.tsx`

- [ ] **Step 1: Reescrever com lazy imports**

```tsx
import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";

const PedidosPage = lazy(() => import("@/domains/pedidos/pages/PedidosPage"));
const PedidoDetailPage = lazy(() => import("@/domains/pedidos/pages/PedidoDetailPage"));
const ProducaoPage = lazy(() => import("@/domains/producao/pages/ProducaoPage"));
const InstalacaoPage = lazy(() => import("@/domains/instalacao/pages/InstalacaoPage"));
const AlmoxarifePage = lazy(() => import("@/domains/producao/pages/AlmoxarifePage"));
const DiarioBordoPage = lazy(() => import("@/domains/producao/pages/DiarioBordoPage"));
const EstoquePage = lazy(() => import("@/domains/estoque/pages/EstoquePage"));
const ComprasPage = lazy(() => import("@/domains/compras/pages/ComprasPage"));
const Produtos = lazy(() => import("@/pages/Produtos"));
const OcorrenciasPage = lazy(() => import("@/domains/qualidade/pages/OcorrenciasPage"));

export const operacionalRoutes = (
  <>
    <Route path="pedidos" element={<LazyPage><PedidosPage /></LazyPage>} />
    <Route path="pedidos/:id" element={<LazyPage><PedidoDetailPage /></LazyPage>} />
    <Route path="producao" element={<LazyPage><ProducaoPage /></LazyPage>} />
    <Route path="instalacoes" element={<LazyPage><InstalacaoPage /></LazyPage>} />
    <Route path="almoxarife" element={<LazyPage><AlmoxarifePage /></LazyPage>} />
    <Route path="producao/diario-bordo" element={<LazyPage><DiarioBordoPage /></LazyPage>} />
    <Route path="estoque" element={<LazyPage><EstoquePage /></LazyPage>} />
    <Route path="compras" element={<LazyPage><ComprasPage /></LazyPage>} />
    <Route path="produtos" element={<LazyPage><Produtos /></LazyPage>} />
    <Route path="ocorrencias" element={<LazyPage><OcorrenciasPage /></LazyPage>} />
  </>
);
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/operacionalRoutes.tsx
git commit -m "perf: lazy-load operacional routes"
```

---

### Task 1.5: Converter financeiroRoutes para lazy imports

**Files:**
- Modify: `src/routes/financeiroRoutes.tsx`

- [ ] **Step 1: Reescrever com lazy imports**

```tsx
import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";

const FinanceiroPage = lazy(() => import("@/domains/financeiro/pages/FinanceiroPage"));
const ComissoesPage = lazy(() => import("@/domains/financeiro/pages/ComissoesPage"));
const DrePage = lazy(() => import("@/domains/financeiro/pages/DrePage"));
const FaturamentoLotePage = lazy(() => import("@/domains/financeiro/pages/FaturamentoLotePage"));
const PedidosAFaturarPage = lazy(() => import("@/domains/financeiro/pages/PedidosAFaturarPage"));
const ConciliacaoPage = lazy(() => import("@/domains/financeiro/pages/ConciliacaoPage"));
const BoletosPage = lazy(() => import("@/domains/financeiro/pages/BoletosPage"));
const ConfigBancariaPage = lazy(() => import("@/domains/financeiro/pages/ConfigBancariaPage"));

export const financeiroRoutes = (
  <>
    <Route path="financeiro" element={<LazyPage><FinanceiroPage /></LazyPage>} />
    <Route path="dre" element={<LazyPage><DrePage /></LazyPage>} />
    <Route path="comissoes" element={<LazyPage><ComissoesPage /></LazyPage>} />
    <Route path="financeiro/faturamento" element={<LazyPage><FaturamentoLotePage /></LazyPage>} />
    <Route path="financeiro/pedidos-a-faturar" element={<LazyPage><PedidosAFaturarPage /></LazyPage>} />
    <Route path="financeiro/conciliacao" element={<LazyPage><ConciliacaoPage /></LazyPage>} />
    <Route path="financeiro/boletos" element={<LazyPage><BoletosPage /></LazyPage>} />
    <Route path="financeiro/config-bancaria" element={<LazyPage><ConfigBancariaPage /></LazyPage>} />
  </>
);
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/financeiroRoutes.tsx
git commit -m "perf: lazy-load financeiro routes"
```

---

### Task 1.6: Converter fiscalRoutes para lazy imports

**Files:**
- Modify: `src/routes/fiscalRoutes.tsx`

- [ ] **Step 1: Reescrever com lazy imports**

```tsx
import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";

const FiscalDashboardPage = lazy(() => import("@/domains/fiscal/pages/FiscalDashboardPage"));
const FiscalDocumentosPage = lazy(() => import("@/domains/fiscal/pages/FiscalDocumentosPage"));
const FiscalFilaPage = lazy(() => import("@/domains/fiscal/pages/FiscalFilaPage"));
const FiscalConfiguracaoPage = lazy(() => import("@/domains/fiscal/pages/FiscalConfiguracaoPage"));
const FiscalCertificadoPage = lazy(() => import("@/domains/fiscal/pages/FiscalCertificadoPage"));
const FiscalAuditoriaPage = lazy(() => import("@/domains/fiscal/pages/FiscalAuditoriaPage"));

export const fiscalRoutes = (
  <>
    <Route path="fiscal" element={<LazyPage><FiscalDashboardPage /></LazyPage>} />
    <Route path="fiscal/documentos" element={<LazyPage><FiscalDocumentosPage /></LazyPage>} />
    <Route path="fiscal/fila" element={<LazyPage><FiscalFilaPage /></LazyPage>} />
    <Route path="fiscal/configuracao" element={<LazyPage><FiscalConfiguracaoPage /></LazyPage>} />
    <Route path="fiscal/certificado" element={<LazyPage><FiscalCertificadoPage /></LazyPage>} />
    <Route path="fiscal/auditoria" element={<LazyPage><FiscalAuditoriaPage /></LazyPage>} />
  </>
);
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/fiscalRoutes.tsx
git commit -m "perf: lazy-load fiscal routes"
```

---

### Task 1.7: Converter adminRoutes para lazy imports

**Files:**
- Modify: `src/routes/adminRoutes.tsx`

**Nota:** adminRoutes usa `PermissionGuard` que deve ser importado estaticamente (é leve e necessário antes do lazy load da página).

- [ ] **Step 1: Reescrever com lazy imports**

```tsx
import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";
import PermissionGuard from "@/shared/components/PermissionGuard";

const AdminUsuariosPage = lazy(() => import("@/domains/admin/pages/AdminUsuariosPage"));
const AdminAuditoriaPage = lazy(() => import("@/domains/admin/pages/AdminAuditoriaPage"));
const AdminPrecificacaoPage = lazy(() => import("@/domains/admin/pages/AdminPrecificacaoPage"));
const AdminConfigPage = lazy(() => import("@/domains/admin/pages/AdminConfigPage"));
const AdminProdutosPage = lazy(() => import("@/domains/admin/pages/AdminProdutosPage"));
const AdminSetupPage = lazy(() => import("@/domains/admin/pages/AdminSetupPage"));
const AdminCentrosCustoPage = lazy(() => import("@/domains/admin/pages/AdminCentrosCustoPage"));
const AdminPlanoContasPage = lazy(() => import("@/domains/admin/pages/AdminPlanoContasPage"));
const AdminMateriaisPage = lazy(() => import("@/domains/admin/pages/AdminMateriaisPage"));
const RelatoriosPage = lazy(() => import("@/domains/admin/pages/RelatoriosPage"));
const ProgressoPage = lazy(() => import("@/domains/admin/pages/ProgressoPage"));
const Settings = lazy(() => import("@/pages/Settings"));

export const adminRoutes = (
  <>
    <Route path="admin/usuarios" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><AdminUsuariosPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/precificacao" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><AdminPrecificacaoPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/config" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><AdminConfigPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/produtos" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><AdminProdutosPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/auditoria" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><AdminAuditoriaPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/setup" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><AdminSetupPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/centros-custo" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><AdminCentrosCustoPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/plano-contas" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><AdminPlanoContasPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/materiais" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><AdminMateriaisPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="relatorios" element={<LazyPage><RelatoriosPage /></LazyPage>} />
    <Route path="admin/progresso" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><ProgressoPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="settings" element={<LazyPage><Settings /></LazyPage>} />
  </>
);
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/adminRoutes.tsx
git commit -m "perf: lazy-load admin routes with PermissionGuard"
```

---

### Task 1.8: Limpar App.tsx — remover lazy/Suspense inline do portal

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Ler App.tsx**

```
Read: src/App.tsx
```

- [ ] **Step 2: Simplificar a rota do portal**

O portal já usa lazy inline. Migrar para usar o mesmo `LazyPage` wrapper:

Em `src/App.tsx`, substituir:
```tsx
import { lazy, Suspense } from "react";
```
por:
```tsx
import { lazy } from "react";
import LazyPage from "./shared/components/LazyPage";
```

E substituir o bloco da rota `/p/:token`:
```tsx
<Route path="/p/:token" element={
  <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}>
    <PortalOrcamentoPage />
  </Suspense>
} />
```
por:
```tsx
<Route path="/p/:token" element={<LazyPage><PortalOrcamentoPage /></LazyPage>} />
```

Remover import de `Suspense` (não mais usado). Manter import de `Loader2` (usado em `ProtectedRoute`).

- [ ] **Step 3: Verificar build completo**

Run: `npx vite build --mode production 2>&1 | tail -30`
Expected: Build success. Output mostra múltiplos chunks JS (code splitting funcionando).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: unify portal route to use LazyPage wrapper"
```

---

## Chunk 2: Gerar Tipos TypeScript do Supabase

> **Paralelizável:** SIM — independente de todos os outros chunks

### Task 2.1: Gerar tipos via Supabase CLI

**Files:**
- Create: `src/integrations/supabase/types.ts`

- [ ] **Step 1: Instalar Supabase CLI (se não instalada)**

Run: `npx supabase --version`
Se falhar: `npm install -D supabase`

- [ ] **Step 2: Gerar tipos do projeto**

Run:
```bash
npx supabase gen types typescript --project-id djwjmfgplnqyffdcgdaw > src/integrations/supabase/types.ts
```

Caso o comando peça login:
```bash
npx supabase login
```
E usar a service role key ou access token do dashboard.

**Alternativa se CLI falhar:** Ir ao Supabase Dashboard → Settings → API → "Generate types" → copiar output para `src/integrations/supabase/types.ts`.

- [ ] **Step 3: Verificar que o arquivo foi gerado corretamente**

```
Read: src/integrations/supabase/types.ts (primeiras 50 linhas)
```

Deve conter `export type Database = { public: { Tables: { ... } } }` com todas as 51+ tabelas.

- [ ] **Step 4: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "feat: add auto-generated Supabase TypeScript types"
```

---

### Task 2.2: Tipar o cliente Supabase

**Files:**
- Modify: `src/integrations/supabase/client.ts`

- [ ] **Step 1: Ler o arquivo atual**

```
Read: src/integrations/supabase/client.ts
```

- [ ] **Step 2: Adicionar tipo Database ao cliente**

Adicionar import e tipar o createClient:

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = 'https://djwjmfgplnqyffdcgdaw.supabase.co';
const supabaseKey = '...'; // manter a key existente

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);
```

Isso dá autocomplete em `.from('tabela').select(...)` automaticamente.

- [ ] **Step 3: Verificar build**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: Pode mostrar erros de tipo onde o código usava `any` — isso é esperado e será corrigido gradualmente.

Run: `npx vite build --mode production 2>&1 | tail -10`
Expected: Build success (Vite não bloqueia em erros de tipo).

- [ ] **Step 4: Commit**

```bash
git add src/integrations/supabase/client.ts
git commit -m "feat: type Supabase client with generated Database types"
```

---

## Chunk 3: Paginação nas Listagens Faltantes

> **Paralelizável:** SIM — cada página é independente

### Task 3.1: Paginação em OrcamentosPage

**Files:**
- Modify: `src/domains/comercial/pages/OrcamentosPage.tsx`
- Modify: `src/domains/comercial/hooks/useOrcamentos.ts`

**Contexto:** OrcamentosPage carrega TODOS os registros (sem .range()). Além disso, busca TODOS uma segunda vez sem filtro para calcular KPIs. Os KPIs devem ser calculados via query separada com COUNT/SUM no banco.

- [ ] **Step 1: Ler os arquivos atuais**

```
Read: src/domains/comercial/hooks/useOrcamentos.ts
Read: src/domains/comercial/pages/OrcamentosPage.tsx
```

- [ ] **Step 2: Adicionar hook de KPIs server-side**

Em `src/domains/comercial/hooks/useOrcamentos.ts`, adicionar um novo hook que busca KPIs via RPC ou query otimizada:

```typescript
export function useOrcamentoKpis() {
  return useQuery({
    queryKey: ['orcamentos', 'kpis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('propostas')
        .select('status, total');

      if (error) throw error;

      const total = data.length;
      const pendentes = data.filter(o => o.status === 'enviada' || o.status === 'em_revisao').length;
      const aprovados = data.filter(o => o.status === 'aprovada').length;
      const valorAberto = data
        .filter(o => o.status === 'enviada' || o.status === 'em_revisao')
        .reduce((acc, o) => acc + (o.total ?? 0), 0);

      return { total, pendentes, aprovados, valorAberto };
    },
    staleTime: 1000 * 60 * 5, // 5 minutos — KPIs não mudam frequentemente
  });
}
```

**Nota:** Busca apenas 2 colunas (`status, total`) em vez de `select('*')`. Muito mais leve.

- [ ] **Step 3: Adicionar paginação ao hook principal**

Modificar `useOrcamentos` para aceitar `page` e usar `.range()`:

```typescript
const PAGE_SIZE = 20;

export function useOrcamentos(filtros?: OrcamentoFiltros & { page?: number }) {
  const page = filtros?.page ?? 0;
  return useQuery({
    queryKey: ['orcamentos', filtros],
    queryFn: async () => {
      let query = supabase
        .from('propostas')
        .select('id, numero, titulo, status, total, created_at, cliente:clientes(nome_fantasia, razao_social)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filtros?.search) {
        query = query.or(`numero.ilike.%${filtros.search}%,titulo.ilike.%${filtros.search}%`);
      }
      if (filtros?.status) {
        query = query.eq('status', filtros.status);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data ?? [], total: count ?? 0 };
    },
  });
}
```

- [ ] **Step 4: Atualizar OrcamentosPage com paginação**

Em `src/domains/comercial/pages/OrcamentosPage.tsx`:

1. Adicionar `const [page, setPage] = useState(0);`
2. Substituir `const { data: orcamentos = [], isLoading } = useOrcamentos(filtros);` por:
   ```typescript
   const { data: result, isLoading } = useOrcamentos({ ...filtros, page });
   const orcamentos = result?.data ?? [];
   const totalRegistros = result?.total ?? 0;
   const totalPages = Math.ceil(totalRegistros / 20);
   ```
3. Substituir `const { data: todos = [] } = useOrcamentos();` e o `useMemo` de KPIs por:
   ```typescript
   const { data: kpis = { total: 0, pendentes: 0, aprovados: 0, valorAberto: 0 } } = useOrcamentoKpis();
   ```
4. Adicionar bloco de paginação no final da lista (antes do AlertDialog):
   ```tsx
   {totalPages > 1 && (
     <div className="flex items-center justify-between px-4 py-3">
       <p className="text-sm text-slate-500">
         Mostrando {page * 20 + 1}–{Math.min((page + 1) * 20, totalRegistros)} de {totalRegistros}
       </p>
       <div className="flex gap-2">
         <Button
           variant="outline" size="sm" className="rounded-xl"
           disabled={page === 0}
           onClick={() => setPage(p => p - 1)}
         >
           Anterior
         </Button>
         <Button
           variant="outline" size="sm" className="rounded-xl"
           disabled={page >= totalPages - 1}
           onClick={() => setPage(p => p + 1)}
         >
           Próximo
         </Button>
       </div>
     </div>
   )}
   ```
5. Resetar page ao mudar filtros: adicionar `useEffect` que chama `setPage(0)` quando `search` ou `statusFilter` mudam.

- [ ] **Step 5: Verificar build**

Run: `npx vite build --mode production 2>&1 | tail -10`
Expected: Build success

- [ ] **Step 6: Commit**

```bash
git add src/domains/comercial/hooks/useOrcamentos.ts src/domains/comercial/pages/OrcamentosPage.tsx
git commit -m "perf: add server-side pagination to OrcamentosPage + KPI optimization"
```

---

### Task 3.2: Fix busca server-side em AdminAuditoriaPage

**Files:**
- Modify: `src/domains/admin/pages/AdminAuditoriaPage.tsx`

**Bug:** A página busca 30 registros paginados do servidor, depois filtra por search client-side. Resultado: busca só funciona nos 30 registros da página atual, não em todos.

- [ ] **Step 1: Ler o arquivo**

```
Read: src/domains/admin/pages/AdminAuditoriaPage.tsx
```

- [ ] **Step 2: Mover busca para o servidor**

Modificar a query Supabase (dentro do `useQuery`) para aplicar filtro de busca server-side:

Na query existente (provavelmente `.from('auditoria_log').select('*').range(...)`), adicionar antes do `.range()`:

```typescript
if (search) {
  query = query.or(`acao.ilike.%${search}%,tabela.ilike.%${search}%,registro_id.ilike.%${search}%`);
}
```

Remover o `useMemo` ou `filter()` client-side que faz a filtragem em `filtered`.

Usar o resultado da query diretamente na renderização em vez da variável `filtered`.

- [ ] **Step 3: Resetar página ao buscar**

Adicionar lógica para voltar à página 0 quando o `search` muda (similar a Task 3.1).

- [ ] **Step 4: Commit**

```bash
git add src/domains/admin/pages/AdminAuditoriaPage.tsx
git commit -m "fix: move audit search to server-side to work across all pages"
```

---

### Task 3.3: Paginação em ProducaoPage e EstoquePage

**Files:**
- Modify: `src/domains/producao/pages/ProducaoPage.tsx`
- Modify: `src/domains/estoque/pages/EstoquePage.tsx`

**Contexto:** Ambas são páginas grandes (1600+ e 1800+ linhas) que carregam tudo do banco. Estas páginas usam queries inline com `supabase.from().select('*')` direto no componente.

- [ ] **Step 1: Ler ProducaoPage.tsx**

```
Read: src/domains/producao/pages/ProducaoPage.tsx (primeiras 100 linhas)
```

Identificar a query principal que busca as OPs. Provavelmente algo como:
```typescript
const { data: ops } = useQuery({
  queryKey: ['producao'],
  queryFn: async () => {
    const { data } = await supabase.from('ordens_producao').select('*')...
  }
});
```

- [ ] **Step 2: Adicionar paginação à query de OPs em ProducaoPage**

Adicionar estado `page` e `.range()` à query de ordens de produção. Manter filtros de status que já existem.

Pattern:
```typescript
const PAGE_SIZE = 20;
const [page, setPage] = useState(0);

// Na query:
.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

// Adicionar { count: 'exact' } ao select:
.select('...colunas...', { count: 'exact' })
```

Adicionar UI de paginação no final da lista (mesmo componente visual da Task 3.1).

- [ ] **Step 3: Mesmo padrão para EstoquePage**

```
Read: src/domains/estoque/pages/EstoquePage.tsx (primeiras 100 linhas)
```

Aplicar mesmo padrão de paginação à query principal de materiais/estoque.

- [ ] **Step 4: Verificar build**

Run: `npx vite build --mode production 2>&1 | tail -10`
Expected: Build success

- [ ] **Step 5: Commit**

```bash
git add src/domains/producao/pages/ProducaoPage.tsx src/domains/estoque/pages/EstoquePage.tsx
git commit -m "perf: add pagination to ProducaoPage and EstoquePage"
```

---

## Chunk 4: Otimização de Queries — select('*') → colunas específicas

> **Paralelizável:** SIM — cada hook é independente

### Task 4.1: Otimizar top 10 queries com select('*')

**Files (as 10 mais impactantes):**
- Modify: `src/contexts/AuthContext.tsx` — perfil do usuário
- Modify: `src/domains/clientes/hooks/useClientes.ts` — listagem de clientes
- Modify: `src/domains/comercial/hooks/useLeads.ts` — listagem de leads
- Modify: `src/domains/comercial/hooks/useAtividades.ts` — atividades
- Modify: `src/domains/financeiro/hooks/useBoletos.ts` — boletos
- Modify: `src/domains/fiscal/hooks/useFiscal.ts` — documentos fiscais

**Abordagem:** Para cada arquivo, ler o código, identificar os `.select('*')`, substituir por colunas específicas usadas no componente que consome o hook.

- [ ] **Step 1: Ler cada arquivo e identificar colunas usadas**

Para cada hook:
1. Ler o hook
2. Ler o componente que consome o hook (a página correspondente)
3. Listar quais propriedades do resultado são acessadas no JSX
4. Substituir `.select('*')` por `.select('col1, col2, col3, ...')`

**Exemplo — AuthContext.tsx:**
```
Read: src/contexts/AuthContext.tsx
```

O perfil de usuário provavelmente usa: `id, email, nome, role, avatar_url`. Substituir:
```typescript
// De:
.select('*')
// Para:
.select('id, email, nome, role, avatar_url')
```

- [ ] **Step 2: Aplicar em useClientes.ts**

```
Read: src/domains/clientes/hooks/useClientes.ts
Read: src/domains/clientes/pages/ClientesPage.tsx (verificar quais campos são renderizados)
```

Colunas prováveis na listagem: `id, razao_social, nome_fantasia, cnpj, email, telefone, cidade, uf, classificacao, created_at`.

- [ ] **Step 3: Aplicar em useLeads.ts**

```
Read: src/domains/comercial/hooks/useLeads.ts
```

- [ ] **Step 4: Aplicar em useAtividades.ts**

```
Read: src/domains/comercial/hooks/useAtividades.ts
```

- [ ] **Step 5: Aplicar em useBoletos.ts**

```
Read: src/domains/financeiro/hooks/useBoletos.ts
```

- [ ] **Step 6: Aplicar em useFiscal.ts**

```
Read: src/domains/fiscal/hooks/useFiscal.ts
```

- [ ] **Step 7: Verificar build**

Run: `npx vite build --mode production 2>&1 | tail -10`
Expected: Build success

- [ ] **Step 8: Commit**

```bash
git add src/contexts/AuthContext.tsx src/domains/clientes/hooks/useClientes.ts src/domains/comercial/hooks/useLeads.ts src/domains/comercial/hooks/useAtividades.ts src/domains/financeiro/hooks/useBoletos.ts src/domains/fiscal/hooks/useFiscal.ts
git commit -m "perf: replace select('*') with specific columns in top 10 queries"
```

---

## Chunk 5: Remover Dead Code

> **Paralelizável:** SIM — independente dos outros chunks

### Task 5.1: Deletar páginas não-roteadas

**Files:**
- Delete: `src/pages/JobDetail.tsx` (1.137 linhas)
- Delete: `src/pages/Jobs.tsx` (537 linhas)
- Delete: `src/pages/NewJob.tsx` (207 linhas)
- Delete: `src/pages/NotFound.tsx` (27 linhas)
- Delete: `src/pages/Team.tsx` (128 linhas)

**Total: ~2.036 linhas de dead code**

- [ ] **Step 1: Verificar que nenhum arquivo referencia estas páginas**

```bash
grep -r "JobDetail\|Jobs\|NewJob\|NotFound\|Team" src/routes/ src/App.tsx --include="*.tsx" --include="*.ts"
```

Se `NotFound` for referenciado em algum lugar, NÃO deletar. Os outros (JobDetail, Jobs, NewJob, Team) não são referenciados em nenhuma rota.

**Nota:** `src/pages/Produtos.tsx` e `src/pages/Settings.tsx` SÃO usados — NÃO deletar.

- [ ] **Step 2: Deletar os arquivos**

```bash
rm src/pages/JobDetail.tsx src/pages/Jobs.tsx src/pages/NewJob.tsx src/pages/NotFound.tsx src/pages/Team.tsx
```

- [ ] **Step 3: Verificar build**

Run: `npx vite build --mode production 2>&1 | tail -10`
Expected: Build success (nenhum import quebrado)

Se o build falhar por algum import referenciando esses arquivos, localizar e remover o import.

- [ ] **Step 4: Commit**

```bash
git add -u src/pages/
git commit -m "chore: remove 5 dead code pages (~2036 lines) — JobDetail, Jobs, NewJob, NotFound, Team"
```

---

## Chunk 6: Verificação Final + Build

> **Sequencial — executar DEPOIS de todos os chunks anteriores**

### Task 6.1: Build final e verificação

- [ ] **Step 1: Verificar build limpo**

```bash
npx vite build --mode production 2>&1
```

Expected: Build success. Verificar que há múltiplos chunks JS no output (evidência de code splitting).

- [ ] **Step 2: Verificar que não restam erros de TypeScript graves**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

Anotar o número de erros. Se > 0, são provavelmente erros pré-existentes (não introduzidos neste sprint).

- [ ] **Step 3: Commit final se necessário**

Se algum ajuste foi necessário:
```bash
git add -A
git commit -m "fix: resolve build issues from Sprint 3 changes"
```

---

## Resumo de Execução

| Chunk | Tasks | Estimativa | Pode Paralelizar |
|-------|-------|-----------|-----------------|
| 1. Lazy Loading | 1.1–1.8 | 8 tasks | SIM (independente) |
| 2. Supabase Types | 2.1–2.2 | 2 tasks | SIM (independente) |
| 3. Paginação | 3.1–3.3 | 3 tasks | SIM (cada página independente) |
| 4. Query Optimization | 4.1 | 1 task (6 hooks) | SIM (independente) |
| 5. Dead Code | 5.1 | 1 task | SIM (independente) |
| 6. Verificação | 6.1 | 1 task | NÃO (depende de 1-5) |

**Estratégia de paralelização sugerida:**

- **Wave 1:** Chunks 1 + 2 + 5 (lazy loading + tipos + dead code) — 3 subagentes
- **Wave 2:** Chunks 3 + 4 (paginação + queries) — 2 subagentes
- **Wave 3:** Chunk 6 (verificação final) — 1 subagente

**Total: 16 tasks, ~15 commits**

---

## Itens da Spec NÃO Incluídos (já resolvidos)

| Item | Razão |
|------|-------|
| G.3: Substituir window.confirm | 0 instâncias — já usa AlertDialog em todo lugar |
| G.5: Remover console.log | 0 instâncias em src/ |
| G.2: AlertDialog em ações destrutivas | Já padronizado em 12+ páginas |
| F.4: staleTime de 5 min | Default já é 2min global + hooks de stats com 2min explícito. OK como está. |

---

*Plano gerado em 2026-03-14 por Claude Opus 4.6*
