# ERP Croma — Fases 1-2-3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar OneDrive integration, Propostas, Faturamento em Lote (Fase 1), Almoxarife, Diário de Bordo, Acompanhamento TV (Fase 2), e Relatórios, Conciliação Bancária, Calendário, Campanhas + Progress Tracker (Fase 3) — levando o ERP de 58% para 100%.

**Architecture:** Cada feature segue o padrão domain-driven existente (domains/{nome}/{hooks,pages,services,types}/). OneDrive é integrado via Supabase Edge Function que chama a Composio API com conta já conectada. Progress Tracker usa feature flags em `admin_config`.

**Tech Stack:** React 19 + Vite + TypeScript + shadcn/ui + TanStack Query v5 + Supabase (Postgres + Edge Functions + Deno) + Composio API (OneDrive)

---

## FASE 1 — Core Business (58% → 72%)

---

### Task 1: Migração SQL — OneDrive + Almoxarife + Propostas

**Files:**
- Create: `supabase/migrations/017_onedrive_almoxarife_propostas.sql`

**Step 1: Escrever migração**

```sql
-- 017: OneDrive fields, Almoxarife tables, Propostas table

-- 1. OneDrive fields on pedidos
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS onedrive_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS onedrive_folder_url TEXT;

-- 2. Ferramentas (almoxarife)
CREATE TABLE IF NOT EXISTS ferramentas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  codigo TEXT,
  categoria TEXT DEFAULT 'ferramenta' CHECK (categoria IN ('ferramenta','veiculo','equipamento')),
  descricao TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Checkout almoxarife
CREATE TABLE IF NOT EXISTS checkout_almoxarife (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferramenta_id UUID NOT NULL REFERENCES ferramentas(id),
  pedido_id UUID REFERENCES pedidos(id),
  usuario_id UUID REFERENCES profiles(id),
  retirado_em TIMESTAMPTZ DEFAULT NOW(),
  devolvido_em TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Diário de bordo (equipamentos)
CREATE TABLE IF NOT EXISTS diario_bordo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferramenta_id UUID NOT NULL REFERENCES ferramentas(id),
  tipo TEXT DEFAULT 'preventiva' CHECK (tipo IN ('preventiva','corretiva','inspecao')),
  descricao TEXT NOT NULL,
  realizado_por UUID REFERENCES profiles(id),
  realizado_em TIMESTAMPTZ DEFAULT NOW(),
  proximo_em TIMESTAMPTZ,
  custo NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Propostas (pipeline comercial)
CREATE TABLE IF NOT EXISTS propostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT,
  titulo TEXT NOT NULL,
  cliente_id UUID REFERENCES clientes(id),
  vendedor_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviada','em_negociacao','aprovada','recusada','expirada')),
  valor_estimado NUMERIC(14,2) DEFAULT 0,
  probabilidade INTEGER DEFAULT 50 CHECK (probabilidade BETWEEN 0 AND 100),
  validade_dias INTEGER DEFAULT 30,
  descricao TEXT,
  observacoes TEXT,
  excluido_em TIMESTAMPTZ,
  excluido_por UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-número propostas
CREATE SEQUENCE IF NOT EXISTS propostas_numero_seq START 1;
CREATE OR REPLACE FUNCTION set_proposta_numero()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.numero IS NULL THEN
    NEW.numero := 'PROP-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('propostas_numero_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_proposta_numero ON propostas;
CREATE TRIGGER trg_proposta_numero BEFORE INSERT ON propostas FOR EACH ROW EXECUTE FUNCTION set_proposta_numero();

-- 6. admin_config feature flags (progress tracker)
INSERT INTO admin_config (chave, valor, descricao) VALUES
  ('feature_onedrive', 'false', 'Integração OneDrive ativa'),
  ('feature_propostas', 'false', 'Módulo Propostas ativo'),
  ('feature_faturamento_lote', 'false', 'Faturamento em lote ativo'),
  ('feature_almoxarife', 'false', 'Módulo Almoxarife ativo'),
  ('feature_diario_bordo', 'false', 'Diário de bordo ativo'),
  ('feature_tv', 'false', 'Acompanhamento TV ativo'),
  ('feature_relatorios', 'false', 'Relatórios ativo'),
  ('feature_conciliacao', 'false', 'Conciliação bancária ativo'),
  ('feature_calendario', 'false', 'Calendário integrado ativo'),
  ('feature_campanhas', 'false', 'Campanhas comerciais ativo')
ON CONFLICT (chave) DO NOTHING;
```

**Step 2: Aplicar no Supabase**

```bash
cd C:\Users\Caldera\Claude\CRM-Croma
npx supabase db push
```

Expected: migração aplicada sem erros.

**Step 3: Commit**

```bash
git add supabase/migrations/017_onedrive_almoxarife_propostas.sql
git commit -m "feat: migration 017 — OneDrive fields, almoxarife, propostas, feature flags"
```

---

### Task 2: Edge Function — onedrive-criar-pasta

**Files:**
- Create: `supabase/functions/onedrive-criar-pasta/index.ts`

**Step 1: Escrever Edge Function**

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { pedido_id } = await req.json()
    if (!pedido_id) throw new Error('pedido_id obrigatório')

    // Busca dados do pedido + cliente
    const { data: pedido, error: pedidoErr } = await supabase
      .from('pedidos')
      .select('id, numero, clientes(nome_fantasia, razao_social)')
      .eq('id', pedido_id)
      .single()
    if (pedidoErr || !pedido) throw new Error('Pedido não encontrado')

    const clienteNome = (pedido.clientes as any)?.nome_fantasia
      || (pedido.clientes as any)?.razao_social
      || 'Cliente'
    const folderName = pedido.numero ?? pedido_id

    // Chama Composio API para criar pasta
    const composioApiKey = Deno.env.get('COMPOSIO_API_KEY') ?? ''
    const composioConnectedAccountId = Deno.env.get('ONEDRIVE_CONNECTED_ACCOUNT_ID') ?? ''

    // Primeiro: cria pasta do cliente se não existir (dentro de Croma/Clientes/)
    // Depois: cria subpasta do pedido dentro da pasta do cliente
    const createFolder = async (folderPath: string, parentId?: string) => {
      const body: Record<string, unknown> = {
        connectedAccountId: composioConnectedAccountId,
        input: parentId
          ? { folder_name: folderPath, parent_folder_id: parentId }
          : { folder_name: folderPath },
      }
      const res = await fetch(
        'https://backend.composio.dev/api/v1/actions/ONE_DRIVE_ONEDRIVE_CREATE_FOLDER/execute',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': composioApiKey,
          },
          body: JSON.stringify(body),
        }
      )
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(`Composio error: ${txt}`)
      }
      return res.json()
    }

    // Cria estrutura: Croma/Clientes/{clienteNome}/{folderName}
    const clienteFolder = await createFolder(`Croma/Clientes/${clienteNome}`)
    const parentId = clienteFolder?.data?.id ?? clienteFolder?.response?.data?.id
    const pedidoFolder = await createFolder(folderName, parentId)

    const folderId = pedidoFolder?.data?.id ?? pedidoFolder?.response?.data?.id
    const folderUrl = pedidoFolder?.data?.webUrl ?? pedidoFolder?.response?.data?.webUrl

    // Salva no banco
    await supabase.from('pedidos').update({
      onedrive_folder_id: folderId,
      onedrive_folder_url: folderUrl,
    }).eq('id', pedido_id)

    console.log('[onedrive-criar-pasta] Pasta criada', { pedido_id, folderId, folderUrl })

    return new Response(JSON.stringify({ folder_id: folderId, folder_url: folderUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error('[onedrive-criar-pasta] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
```

**Step 2: Adicionar secrets no Supabase Dashboard**

No Supabase Dashboard → Project Settings → Edge Functions → Secrets, adicionar:
- `COMPOSIO_API_KEY` — API key do Composio
- `ONEDRIVE_CONNECTED_ACCOUNT_ID` — `ca_VHrSrrvq1gPQ`

**Step 3: Deploy**

```bash
npx supabase functions deploy onedrive-criar-pasta
```

**Step 4: Commit**

```bash
git add supabase/functions/onedrive-criar-pasta/
git commit -m "feat: edge function onedrive-criar-pasta via Composio API"
```

---

### Task 3: Hook useOneDrive + integração no PedidoDetail

**Files:**
- Create: `src/domains/pedidos/hooks/useOneDrive.ts`
- Modify: `src/domains/pedidos/pages/PedidoDetailPage.tsx` (adicionar aba Arquivos)

**Step 1: Hook useOneDrive**

```typescript
// src/domains/pedidos/hooks/useOneDrive.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { showSuccess, showError } from '@/utils/toast'

export function useCriarPastaOneDrive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (pedidoId: string) => {
      const { data, error } = await supabase.functions.invoke('onedrive-criar-pasta', {
        body: { pedido_id: pedidoId },
      })
      if (error) throw new Error(error.message)
      return data as { folder_id: string; folder_url: string }
    },
    onSuccess: (_data, pedidoId) => {
      qc.invalidateQueries({ queryKey: ['pedidos', 'detail', pedidoId] })
      showSuccess('Pasta OneDrive criada!')
    },
    onError: (err: Error) => showError(`Erro ao criar pasta: ${err.message}`),
  })
}
```

**Step 2: Verificar se PedidoDetailPage existe**

```bash
dir "C:\Users\Caldera\Claude\CRM-Croma\src\domains\pedidos\pages\"
```

Se não existir `PedidoDetailPage.tsx`, criar página com Tabs (Dados | Itens | Arquivos).

**Step 3: Aba Arquivos no detalhe do Pedido**

Dentro do componente de detalhe do pedido, adicionar aba `📁 Arquivos`:

```tsx
// Dentro da aba Arquivos
import { useCriarPastaOneDrive } from '../hooks/useOneDrive'
import { FolderOpen, ExternalLink, Loader2 } from 'lucide-react'

// Dentro do componente:
const criarPasta = useCriarPastaOneDrive()

// JSX da aba:
{pedido.onedrive_folder_url ? (
  <div className="space-y-4">
    <a
      href={pedido.onedrive_folder_url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Button variant="outline" className="rounded-xl gap-2">
        <ExternalLink size={16} /> Abrir no OneDrive
      </Button>
    </a>
    {/* Lista de arquivos via Composio (Task 4) */}
  </div>
) : (
  <div className="flex flex-col items-center gap-4 py-12">
    <FolderOpen size={48} className="text-slate-200" />
    <p className="text-slate-500">Pasta OneDrive não criada ainda</p>
    <Button
      onClick={() => criarPasta.mutate(pedido.id)}
      disabled={criarPasta.isPending}
      className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
    >
      {criarPasta.isPending
        ? <Loader2 size={16} className="animate-spin mr-2" />
        : <FolderOpen size={16} className="mr-2" />}
      Criar Pasta no OneDrive
    </Button>
  </div>
)}
```

**Step 4: Adicionar rota /pedidos/:id em App.tsx**

```tsx
// App.tsx — após import PedidosPage:
import PedidoDetailPage from "@/domains/pedidos/pages/PedidoDetailPage";

// Dentro das Routes:
<Route path="pedidos/:id" element={<PedidoDetailPage />} />
```

**Step 5: Testar no browser**

- Abrir `/pedidos`
- Clicar num pedido → deve ir para `/pedidos/:id`
- Aba Arquivos → botão "Criar Pasta no OneDrive"
- Clicar → spinner → toast "Pasta OneDrive criada!"
- Botão "Abrir no OneDrive" aparece com link correto

**Step 6: Commit**

```bash
git add src/domains/pedidos/hooks/useOneDrive.ts
git add src/domains/pedidos/pages/PedidoDetailPage.tsx
git add src/App.tsx
git commit -m "feat: OneDrive integration — criar pasta automática por pedido"
```

---

### Task 4: Propostas — página /propostas

**Files:**
- Create: `src/domains/comercial/hooks/usePropostas.ts`
- Create: `src/domains/comercial/pages/PropostasPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/shared/constants/navigation.ts`

**Step 1: Hook usePropostas**

```typescript
// src/domains/comercial/hooks/usePropostas.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { showSuccess, showError } from '@/utils/toast'

const KEY = 'propostas'

export function usePropostas(filtros?: { status?: string; search?: string }) {
  return useQuery({
    queryKey: [KEY, filtros],
    queryFn: async () => {
      let q = supabase
        .from('propostas')
        .select('*, clientes(nome_fantasia, razao_social), profiles(full_name)')
        .is('excluido_em', null)
        .order('created_at', { ascending: false })
      if (filtros?.status && filtros.status !== 'todos') q = q.eq('status', filtros.status)
      if (filtros?.search) q = q.ilike('titulo', `%${filtros.search}%`)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return data ?? []
    },
    staleTime: 1000 * 60 * 2,
  })
}

export function useCriarProposta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      titulo: string; cliente_id?: string; valor_estimado?: number;
      probabilidade?: number; descricao?: string;
    }) => {
      const { data, error } = await supabase.from('propostas').insert(input).select().single()
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [KEY] }); showSuccess('Proposta criada!') },
    onError: (e: Error) => showError(e.message),
  })
}

export function useExcluirProposta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId?: string }) => {
      const { error } = await supabase.from('propostas').update({
        excluido_em: new Date().toISOString(), excluido_por: userId ?? null,
      }).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [KEY] }); showSuccess('Proposta excluída!') },
    onError: (e: Error) => showError(e.message),
  })
}
```

**Step 2: PropostasPage — seguir o padrão de OrcamentosPage**

Criar `src/domains/comercial/pages/PropostasPage.tsx` com:
- Header + botão "Nova Proposta"
- 4 KPI cards: Total, Em negociação, Aprovadas, Valor estimado
- Filtro por status + busca por título
- Tabela desktop + cards mobile (mesmo padrão de OrcamentosPage)
- AlertDialog de confirmação para exclusão

Campos na tabela: Número | Título | Cliente | Valor Est. | Prob. % | Status | Ações

Status config:
```typescript
const STATUS_CONFIG = {
  rascunho:       { label: 'Rascunho',        cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  enviada:        { label: 'Enviada',          cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  em_negociacao:  { label: 'Em negociação',    cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  aprovada:       { label: 'Aprovada',         cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  recusada:       { label: 'Recusada',         cls: 'bg-red-100 text-red-700 border-red-200' },
  expirada:       { label: 'Expirada',         cls: 'bg-slate-100 text-slate-500 border-slate-200' },
}
```

**Step 3: Registrar rota e nav**

Em `App.tsx`:
```tsx
import PropostasPage from "@/domains/comercial/pages/PropostasPage"
// ...
<Route path="propostas" element={<PropostasPage />} />
```

Em `navigation.ts`, adicionar ao grupo COMERCIAL (antes de Templates):
```typescript
{ name: 'Propostas', path: '/propostas', icon: 'FileText', module: 'comercial' },
```

**Step 4: Testar**

- Acessar `/propostas` → página carrega
- Criar proposta via botão → dialog → salvar → aparece na lista
- Excluir proposta rascunho → confirmação → some da lista

**Step 5: Commit**

```bash
git add src/domains/comercial/hooks/usePropostas.ts
git add src/domains/comercial/pages/PropostasPage.tsx
git add src/App.tsx src/shared/constants/navigation.ts
git commit -m "feat: módulo Propostas — listagem, criação, exclusão"
```

---

### Task 5: Faturamento em Lote — /financeiro/faturamento

**Files:**
- Create: `src/domains/financeiro/pages/FaturamentoLotePage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/shared/constants/navigation.ts`

**Step 1: FaturamentoLotePage**

Lógica:
1. Busca pedidos com status `concluido` ou `produzido` que não tenham `nota_fiscal_id` (ou campo similar)
2. Checkbox em cada linha para selecionar
3. Botão "Gerar Faturamento" → para cada selecionado, cria lançamento em `financeiro_lancamentos` (ou tabela equivalente)

```typescript
// Busca pedidos faturáveis
const { data: pedidosFaturaveis } = useQuery({
  queryKey: ['faturamento-lote'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, clientes(nome_fantasia, razao_social)')
      .in('status', ['concluido', 'produzido'])
      .is('excluido_em', null)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  },
})
```

UI:
- Tabela com checkbox, número pedido, cliente, valor total, data conclusão
- "Selecionar todos" checkbox no header
- Rodapé com: N selecionados | Total: R$ X.XXX | Botão "Faturar Selecionados"
- Confirmação AlertDialog antes de processar

**Step 2: Rota + nav**

```tsx
// App.tsx
import FaturamentoLotePage from "@/domains/financeiro/pages/FaturamentoLotePage"
<Route path="financeiro/faturamento" element={<FaturamentoLotePage />} />
```

Nav — adicionar ao grupo FINANCEIRO:
```typescript
{ name: 'Faturamento em Lote', path: '/financeiro/faturamento', icon: 'Receipt', module: 'financeiro' },
```

**Step 3: Commit**

```bash
git add src/domains/financeiro/pages/FaturamentoLotePage.tsx
git add src/App.tsx src/shared/constants/navigation.ts
git commit -m "feat: Faturamento em Lote — seleção de OSes concluídas"
```

---

## FASE 2 — Operacional (72% → 83%)

---

### Task 6: Almoxarife — /almoxarife

**Files:**
- Create: `src/domains/producao/hooks/useAlmoxarife.ts`
- Create: `src/domains/producao/pages/AlmoxarifePage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/shared/constants/navigation.ts`

**Step 1: Hook useAlmoxarife**

```typescript
// src/domains/producao/hooks/useAlmoxarife.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { showSuccess, showError } from '@/utils/toast'

const KEY = 'ferramentas'

export function useFerramentas() {
  return useQuery({
    queryKey: [KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ferramentas')
        .select('*')
        .eq('ativo', true)
        .order('nome')
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

export function useCheckouts(ferramentaId?: string) {
  return useQuery({
    queryKey: ['checkouts', ferramentaId],
    queryFn: async () => {
      let q = supabase
        .from('checkout_almoxarife')
        .select('*, ferramentas(nome), pedidos(numero), profiles(full_name)')
        .order('retirado_em', { ascending: false })
      if (ferramentaId) q = q.eq('ferramenta_id', ferramentaId)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return data ?? []
    },
    enabled: true,
  })
}

export function useCheckoutFerramenta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      ferramenta_id: string; pedido_id?: string; usuario_id?: string; observacoes?: string
    }) => {
      const { error } = await supabase.from('checkout_almoxarife').insert(input)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['checkouts'] }); showSuccess('Checkout registrado!') },
    onError: (e: Error) => showError(e.message),
  })
}

export function useDevolverFerramenta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (checkoutId: string) => {
      const { error } = await supabase
        .from('checkout_almoxarife')
        .update({ devolvido_em: new Date().toISOString() })
        .eq('id', checkoutId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['checkouts'] }); showSuccess('Devolução registrada!') },
    onError: (e: Error) => showError(e.message),
  })
}
```

**Step 2: AlmoxarifePage**

Duas abas:
- **Ferramentas**: lista todas as ferramentas + badge "Em uso" / "Disponível" + botão "Checkout"
- **Histórico**: tabela com todos checkouts — ferramenta, quem retirou, pedido vinculado, retirado_em, devolvido_em, botão "Devolver" se devolvido_em = null

**Step 3: Rota + nav**

```tsx
// App.tsx
import AlmoxarifePage from "@/domains/producao/pages/AlmoxarifePage"
<Route path="almoxarife" element={<AlmoxarifePage />} />
```

Nav — adicionar ao grupo OPERACIONAL:
```typescript
{ name: 'Almoxarife', path: '/almoxarife', icon: 'Wrench', module: 'producao' },
```

**Step 4: Commit**

```bash
git add src/domains/producao/hooks/useAlmoxarife.ts
git add src/domains/producao/pages/AlmoxarifePage.tsx
git add src/App.tsx src/shared/constants/navigation.ts
git commit -m "feat: módulo Almoxarife — checkout de ferramentas e veículos"
```

---

### Task 7: Diário de Bordo — /producao/diario-bordo

**Files:**
- Create: `src/domains/producao/hooks/useDiarioBordo.ts`
- Create: `src/domains/producao/pages/DiarioBordoPage.tsx`
- Modify: `src/App.tsx`, `src/shared/constants/navigation.ts`

**Step 1: Hook useDiarioBordo**

```typescript
// src/domains/producao/hooks/useDiarioBordo.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { showSuccess, showError } from '@/utils/toast'

const KEY = 'diario_bordo'

export function useDiarioBordo(ferramentaId?: string) {
  return useQuery({
    queryKey: [KEY, ferramentaId],
    queryFn: async () => {
      let q = supabase
        .from('diario_bordo')
        .select('*, ferramentas(nome, categoria), profiles(full_name)')
        .order('realizado_em', { ascending: false })
      if (ferramentaId) q = q.eq('ferramenta_id', ferramentaId)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

export function useRegistrarManutencao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      ferramenta_id: string; tipo: 'preventiva'|'corretiva'|'inspecao';
      descricao: string; realizado_por?: string; proximo_em?: string; custo?: number
    }) => {
      const { error } = await supabase.from('diario_bordo').insert(input)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [KEY] }); showSuccess('Manutenção registrada!') },
    onError: (e: Error) => showError(e.message),
  })
}
```

**Step 2: DiarioBordoPage**

- Select de equipamento/ferramenta no topo (filtra o histórico)
- Botão "Registrar Manutenção" → Sheet/Dialog com campos: tipo (preventiva/corretiva/inspeção), descrição, realizado_em, próxima manutenção, custo
- Tabela de histórico com badge por tipo (preventiva=verde, corretiva=vermelho, inspeção=azul)

**Step 3: Rota + nav + commit**

```tsx
<Route path="producao/diario-bordo" element={<DiarioBordoPage />} />
```

Nav OPERACIONAL:
```typescript
{ name: 'Diário de Bordo', path: '/producao/diario-bordo', icon: 'BookOpen', module: 'producao' },
```

```bash
git add src/domains/producao/hooks/useDiarioBordo.ts
git add src/domains/producao/pages/DiarioBordoPage.tsx
git add src/App.tsx src/shared/constants/navigation.ts
git commit -m "feat: Diário de Bordo — manutenção preventiva/corretiva de equipamentos"
```

---

### Task 8: Acompanhamento TV — /tv

**Files:**
- Create: `src/domains/producao/pages/TvPage.tsx`
- Modify: `src/App.tsx`

**Step 1: TvPage — rota sem sidebar**

A página TV deve ficar FORA do `<Layout />` (sem sidebar, sem header).

```tsx
// App.tsx — DENTRO de <Routes> mas FORA do Route path="/"
import TvPage from "@/domains/producao/pages/TvPage"

// Adicionar ANTES do Route path="/" com Layout:
<Route path="/tv" element={<TvPage />} />
```

**Step 2: Lógica da TvPage**

```tsx
// src/domains/producao/pages/TvPage.tsx
import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

const SETORES = [
  'Criação', 'Arquivos', 'Impressão', 'Router',
  'Acabamentos', 'Serralheria', 'Expedição', 'Instalação', 'Terceirizados'
]

export default function TvPage() {
  const [setorIndex, setSetorIndex] = useState(0)

  // Auto-rotate a cada 20s
  useEffect(() => {
    const timer = setInterval(() => {
      setSetorIndex(i => (i + 1) % SETORES.length)
    }, 20_000)
    return () => clearInterval(timer)
  }, [])

  const setor = SETORES[setorIndex]

  const { data: oses = [] } = useQuery({
    queryKey: ['tv-oses', setor],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('numero, status, clientes(nome_fantasia), data_prometida')
        .in('status', ['em_producao', 'produzido', 'aguardando_instalacao'])
        .is('excluido_em', null)
        .order('data_prometida', { ascending: true })
        .limit(15)
      if (error) throw new Error(error.message)
      return data ?? []
    },
    refetchInterval: 30_000,
  })

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 flex flex-col gap-6">
      {/* Header com logo e setor atual */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-white">Croma Print</h1>
          <p className="text-slate-400 text-lg">Acompanhamento de Produção</p>
        </div>
        <div className="text-right">
          <p className="text-6xl font-black text-blue-400">{setor}</p>
          <p className="text-slate-500">{setorIndex + 1} / {SETORES.length}</p>
        </div>
      </div>

      {/* Grid de OSes */}
      <div className="flex-1 grid grid-cols-3 gap-4">
        {oses.map((os: any) => (
          <div key={os.numero} className="bg-slate-800 rounded-2xl p-6 flex flex-col gap-2">
            <span className="text-2xl font-black text-blue-400">{os.numero}</span>
            <span className="text-white text-lg font-semibold">
              {os.clientes?.nome_fantasia || '—'}
            </span>
            <span className={`text-sm px-3 py-1 rounded-full self-start ${
              os.status === 'em_producao' ? 'bg-amber-500' :
              os.status === 'produzido' ? 'bg-emerald-500' : 'bg-blue-500'
            }`}>{os.status}</span>
            {os.data_prometida && (
              <span className="text-slate-400 text-sm">
                Entrega: {new Date(os.data_prometida).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Progress bar setores */}
      <div className="flex gap-2">
        {SETORES.map((s, i) => (
          <div
            key={s}
            className={`flex-1 h-2 rounded-full transition-colors ${i === setorIndex ? 'bg-blue-500' : 'bg-slate-700'}`}
          />
        ))}
      </div>
    </div>
  )
}
```

**Step 3: Testar**

- Acessar `/tv` → página sem sidebar, fundo escuro
- Esperar 20s → setor muda automaticamente
- OSes em produção aparecem nos cards

**Step 4: Commit**

```bash
git add src/domains/producao/pages/TvPage.tsx src/App.tsx
git commit -m "feat: Acompanhamento TV — /tv fullscreen sem sidebar, auto-rotate 20s"
```

---

## FASE 3 — Gestão (83% → 100%)

---

### Task 9: Relatórios — /relatorios

**Files:**
- Create: `src/domains/admin/pages/RelatoriosPage.tsx`
- Modify: `src/App.tsx`, `src/shared/constants/navigation.ts`

**Step 1: RelatoriosPage com 11 tipos**

Estrutura: sidebar de tipos + área de resultados + filtros de data + botão export.

Os 11 relatórios:
```typescript
const RELATORIOS = [
  { id: 'vendas', label: 'Vendas', icon: 'TrendingUp' },
  { id: 'orcamentos', label: 'Orçamentos', icon: 'FileText' },
  { id: 'vendas_produto', label: 'Vendas por Produto', icon: 'Package' },
  { id: 'previsto_realizado', label: 'Previsto × Realizado', icon: 'BarChart3' },
  { id: 'dre', label: 'DRE', icon: 'BarChart2' },
  { id: 'plano_contas', label: 'Plano de Contas', icon: 'BookOpen' },
  { id: 'lucratividade', label: 'Lucratividade', icon: 'DollarSign' },
  { id: 'posicao_faturamento', label: 'Posição Faturamento', icon: 'Receipt' },
  { id: 'abc_clientes', label: 'Curva ABC Clientes', icon: 'Users' },
  { id: 'abc_produtos', label: 'Curva ABC Produtos', icon: 'Package' },
  { id: 'fiscal', label: 'Fiscal', icon: 'Shield' },
]
```

Cada relatório:
- Filtros: data_inicio, data_fim (date pickers)
- Tabela de resultados (query específica por tipo)
- Botão "Exportar CSV" (usa `Object.keys` + join para gerar CSV blob)

**Step 2: Queries por tipo de relatório (exemplos)**

```typescript
// Vendas: pedidos concluídos por período
const queryVendas = async (inicio: string, fim: string) => {
  const { data } = await supabase
    .from('pedidos')
    .select('numero, clientes(nome_fantasia), valor_total, data_conclusao, vendedor:profiles(full_name)')
    .eq('status', 'concluido')
    .gte('data_conclusao', inicio)
    .lte('data_conclusao', fim)
    .is('excluido_em', null)
    .order('data_conclusao', { ascending: false })
  return data ?? []
}

// ABC Clientes: agrupa valor_total por cliente, ordena desc
const queryAbcClientes = async (inicio: string, fim: string) => {
  const { data } = await supabase
    .from('pedidos')
    .select('cliente_id, clientes(nome_fantasia), valor_total')
    .eq('status', 'concluido')
    .gte('created_at', inicio)
    .lte('created_at', fim)
    .is('excluido_em', null)
  // Agrupa no frontend
  const map = new Map<string, { nome: string; total: number; count: number }>()
  for (const p of data ?? []) {
    const id = p.cliente_id
    const existing = map.get(id) ?? { nome: (p.clientes as any)?.nome_fantasia ?? '—', total: 0, count: 0 }
    existing.total += Number(p.valor_total) || 0
    existing.count += 1
    map.set(id, existing)
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}
```

**Step 3: Export CSV utility**

```typescript
// src/shared/utils/exportCsv.ts
export function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(',')),
  ].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
```

**Step 4: Rota + nav**

```tsx
<Route path="relatorios" element={<RelatoriosPage />} />
```

Nav — novo grupo ou dentro de ADMINISTRAÇÃO:
```typescript
{ name: 'Relatórios', path: '/relatorios', icon: 'BarChart3', module: 'admin' },
```

**Step 5: Commit**

```bash
git add src/domains/admin/pages/RelatoriosPage.tsx
git add src/shared/utils/exportCsv.ts
git add src/App.tsx src/shared/constants/navigation.ts
git commit -m "feat: Relatórios — 11 tipos com filtros de data e export CSV"
```

---

### Task 10: Conciliação Bancária — /financeiro/conciliacao

**Files:**
- Create: `src/domains/financeiro/pages/ConciliacaoPage.tsx`
- Modify: `src/App.tsx`, `src/shared/constants/navigation.ts`

**Step 1: ConciliacaoPage**

Funcionalidade:
1. Upload de extrato .CSV (input[type=file], parse no frontend com FileReader)
2. Tabela "lado a lado": extrato bancário (esquerda) vs lançamentos ERP (direita)
3. Match automático por valor + data (± 1 dia)
4. Status por linha: ✅ Conciliado | ⚠️ Apenas no banco | ❌ Apenas no ERP

```typescript
// Parse CSV simples (extrato Bradesco/Itaú formato padrão)
const parseExtrato = (csvText: string) => {
  const lines = csvText.split('\n').filter(l => l.trim())
  return lines.slice(1).map(line => {
    const [data, descricao, valor] = line.split(';')
    return {
      data: data?.trim(),
      descricao: descricao?.trim(),
      valor: parseFloat(valor?.replace(',', '.') || '0'),
    }
  }).filter(l => l.data && !isNaN(l.valor))
}
```

**Step 2: Layout da página**

```
[Upload extrato CSV]    [Mês/Período filtro]    [Botão Conciliar]

EXTRATO BANCÁRIO        |    ERP (Financeiro)
Data | Descrição | Valor | Data | Descrição | Valor | Status
```

**Step 3: Rota + nav + commit**

```tsx
<Route path="financeiro/conciliacao" element={<ConciliacaoPage />} />
```

Nav FINANCEIRO:
```typescript
{ name: 'Conciliação Bancária', path: '/financeiro/conciliacao', icon: 'ArrowLeftRight', module: 'financeiro' },
```

```bash
git add src/domains/financeiro/pages/ConciliacaoPage.tsx
git add src/App.tsx src/shared/constants/navigation.ts
git commit -m "feat: Conciliação Bancária — upload extrato CSV + match automático"
```

---

### Task 11: Calendário Integrado — /calendario

**Files:**
- Create: `src/domains/comercial/pages/CalendarioPage.tsx`
- Modify: `src/App.tsx`, `src/shared/constants/navigation.ts`

**Step 1: CalendarioPage**

Usar `@/components/ui/calendar` (já existe shadcn Calendar) como base.

Views: Mês | Semana | Dia (tabs no header)

Fontes de eventos:
```typescript
// 1. Vencimentos financeiros
const { data: vencimentos } = useQuery({
  queryKey: ['calendario-financeiro'],
  queryFn: async () => {
    const { data } = await supabase
      .from('financeiro_lancamentos') // ou tabela equivalente
      .select('id, descricao, valor, data_vencimento, tipo')
      .gte('data_vencimento', startOfMonth)
      .lte('data_vencimento', endOfMonth)
    return (data ?? []).map(v => ({
      id: v.id, tipo: 'financeiro', titulo: v.descricao,
      data: v.data_vencimento, cor: v.tipo === 'receita' ? 'emerald' : 'red',
    }))
  },
})

// 2. Entregas de pedidos (data_prometida)
const { data: entregas } = useQuery({
  queryKey: ['calendario-pedidos'],
  queryFn: async () => {
    const { data } = await supabase
      .from('pedidos')
      .select('id, numero, clientes(nome_fantasia), data_prometida, status')
      .not('data_prometida', 'is', null)
      .gte('data_prometida', startOfMonth)
      .lte('data_prometida', endOfMonth)
      .is('excluido_em', null)
    return (data ?? []).map(p => ({
      id: p.id, tipo: 'pedido', titulo: `OS ${p.numero} — ${(p.clientes as any)?.nome_fantasia}`,
      data: p.data_prometida, cor: 'blue',
    }))
  },
})
```

Cada evento renderizado como badge colorido no dia do calendário.

**Step 2: Rota + nav**

```tsx
<Route path="calendario" element={<CalendarioPage />} />
```

Nav — novo item no grupo PAINEL (ou COMERCIAL):
```typescript
{ name: 'Calendário', path: '/calendario', icon: 'Calendar', module: 'comercial' },
```

**Step 3: Commit**

```bash
git add src/domains/comercial/pages/CalendarioPage.tsx
git add src/App.tsx src/shared/constants/navigation.ts
git commit -m "feat: Calendário Integrado — vencimentos + entregas de pedidos"
```

---

### Task 12: Campanhas Comerciais — /campanhas

**Files:**
- Create: `src/domains/comercial/hooks/useCampanhas.ts`
- Create: `src/domains/comercial/pages/CampanhasPage.tsx`
- Modify: `src/App.tsx`, `src/shared/constants/navigation.ts`

**Step 1: Migração SQL para campanhas**

```sql
-- Adicionar a migrations/018_campanhas.sql
CREATE TABLE IF NOT EXISTS campanhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  origem TEXT DEFAULT 'email' CHECK (origem IN ('email','redes_sociais','indicacao','prospecção','evento','outro')),
  status TEXT DEFAULT 'ativa' CHECK (status IN ('rascunho','ativa','pausada','concluida')),
  data_inicio DATE,
  data_fim DATE,
  orcamento NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vincula leads a campanhas
ALTER TABLE leads ADD COLUMN IF NOT EXISTS campanha_id UUID REFERENCES campanhas(id);
```

**Step 2: Hook useCampanhas**

Padrão idêntico a usePropostas — CRUD básico + query com filtros de status.

**Step 3: CampanhasPage**

KPIs:
- Total campanhas ativas
- Total leads gerados (count de leads com campanha_id)
- Taxa de conversão (leads → orçamentos aprovados)
- Investimento total

Tabela: Nome | Origem | Leads | Conversão % | Status | Período

**Step 4: Rota + nav + commit**

```bash
git add supabase/migrations/018_campanhas.sql
git add src/domains/comercial/hooks/useCampanhas.ts
git add src/domains/comercial/pages/CampanhasPage.tsx
git add src/App.tsx src/shared/constants/navigation.ts
git commit -m "feat: Campanhas Comerciais — origens, leads, taxa de conversão"
```

---

### Task 13: Progress Tracker — widget + /admin/progresso

**Files:**
- Create: `src/domains/admin/hooks/useProgressTracker.ts`
- Create: `src/domains/admin/pages/ProgressoPage.tsx`
- Create: `src/shared/components/ProgressTracker.tsx`
- Modify: `src/domains/comercial/pages/DashboardPage.tsx`
- Modify: `src/App.tsx`, `src/shared/constants/navigation.ts`

**Step 1: Hook useProgressTracker**

```typescript
// src/domains/admin/hooks/useProgressTracker.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

const FEATURE_FLAGS = {
  fase1: ['feature_onedrive', 'feature_propostas', 'feature_faturamento_lote'],
  fase2: ['feature_almoxarife', 'feature_diario_bordo', 'feature_tv'],
  fase3: ['feature_relatorios', 'feature_conciliacao', 'feature_calendario', 'feature_campanhas'],
}

const ERP_BASE = 58 // % já concluído antes das fases

export function useProgressTracker() {
  return useQuery({
    queryKey: ['progress-tracker'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_config')
        .select('chave, valor')
        .like('chave', 'feature_%')
      if (error) throw new Error(error.message)

      const flags = Object.fromEntries((data ?? []).map(r => [r.chave, r.valor === 'true']))

      const calcFase = (keys: string[]) => {
        const done = keys.filter(k => flags[k]).length
        return Math.round((done / keys.length) * 100)
      }

      const fase1 = calcFase(FEATURE_FLAGS.fase1)
      const fase2 = calcFase(FEATURE_FLAGS.fase2)
      const fase3 = calcFase(FEATURE_FLAGS.fase3)

      // Peso de cada fase no ERP total: fase1 → +14%, fase2 → +11%, fase3 → +17%
      const totalErp = ERP_BASE
        + Math.round(fase1 * 0.14)
        + Math.round(fase2 * 0.11)
        + Math.round(fase3 * 0.17)

      return { fase1, fase2, fase3, totalErp, flags }
    },
    staleTime: 1000 * 60 * 5,
  })
}
```

**Step 2: ProgressTracker widget (reutilizável)**

```tsx
// src/shared/components/ProgressTracker.tsx
import { useProgressTracker } from '@/domains/admin/hooks/useProgressTracker'
import { Progress } from '@/components/ui/progress'

export function ProgressTracker({ compact = false }: { compact?: boolean }) {
  const { data } = useProgressTracker()
  if (!data) return null

  const fases = [
    { label: 'Fase 1', sub: 'OneDrive · Propostas · Faturamento', value: data.fase1, color: 'bg-blue-500' },
    { label: 'Fase 2', sub: 'Almoxarife · Diário · TV', value: data.fase2, color: 'bg-amber-500' },
    { label: 'Fase 3', sub: 'Relatórios · Conciliação · Calendário · Campanhas', value: data.fase3, color: 'bg-emerald-500' },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-700">ERP Croma</span>
        <span className="text-2xl font-black text-blue-600">{data.totalErp}%</span>
      </div>
      <Progress value={data.totalErp} className="h-3" />
      {!compact && fases.map(f => (
        <div key={f.label} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-slate-600">{f.label} <span className="text-slate-400 text-xs">— {f.sub}</span></span>
            <span className="font-bold text-slate-700">{f.value}%</span>
          </div>
          <Progress value={f.value} className="h-2" />
        </div>
      ))}
    </div>
  )
}
```

**Step 3: Adicionar widget no Dashboard**

Em `DashboardPage.tsx`, após os KPIs principais, adicionar card com `<ProgressTracker compact />`.

**Step 4: Página /admin/progresso**

Página completa com `<ProgressTracker />` (não compact) + lista de features com toggle para admin ligar/desligar:

```tsx
// Toggle de feature flag (apenas admin)
const toggleFeature = async (chave: string, valorAtual: boolean) => {
  await supabase.from('admin_config')
    .update({ valor: (!valorAtual).toString() })
    .eq('chave', chave)
  qc.invalidateQueries({ queryKey: ['progress-tracker'] })
}
```

**Step 5: Rota + nav**

```tsx
<Route path="admin/progresso" element={<ProgressoPage />} />
```

Nav ADMINISTRAÇÃO:
```typescript
{ name: 'Progresso ERP', path: '/admin/progresso', icon: 'BarChart2', module: 'admin' },
```

**Step 6: Commit**

```bash
git add src/domains/admin/hooks/useProgressTracker.ts
git add src/domains/admin/pages/ProgressoPage.tsx
git add src/shared/components/ProgressTracker.tsx
git add src/domains/comercial/pages/DashboardPage.tsx
git add src/App.tsx src/shared/constants/navigation.ts
git commit -m "feat: Progress Tracker — widget dashboard + /admin/progresso com feature flags"
```

---

## Verificação Final

```bash
# Build de produção (sem erros TypeScript)
npm run build

# Checklist manual no browser:
# /pedidos/:id      → aba Arquivos + criar pasta OneDrive
# /propostas        → listagem + criar + excluir
# /financeiro/faturamento → seleção checkbox + faturar lote
# /almoxarife       → ferramentas + checkout + devolução
# /producao/diario-bordo → registrar manutenção
# /tv               → fullscreen dark, auto-rotate 20s
# /relatorios       → 11 tipos + export CSV
# /financeiro/conciliacao → upload CSV + match
# /calendario       → view mensal com eventos
# /campanhas        → KPIs + listagem
# /admin/progresso  → barras de progresso + toggles
# /               (dashboard) → widget ProgressTracker compact
```

```bash
git tag v1.0.0-fases-completas
git push origin main --tags
```
