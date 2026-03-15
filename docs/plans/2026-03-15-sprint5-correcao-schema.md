# Sprint 5 — Correção de Schema Mismatches — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir todos os mismatches entre código frontend/triggers e o schema real do Supabase nos módulos Compras, Estoque e Qualidade.

**Architecture:** DB é source of truth. Corrigir triggers SQL (migration 032), alinhar tipos TypeScript, services, hooks, components e pages. Expandir CHECK constraint de ocorrências onde faz sentido para o negócio.

**Tech Stack:** PostgreSQL (Supabase), React 19, TypeScript, TanStack Query v5, Vitest

---

## Task 1: Migration SQL — Corrigir Triggers e Expandir CHECK

**Files:**
- Create: `supabase/migrations/032_fix_triggers_schema.sql`

**Step 1: Write the migration file**

```sql
-- Migration 032: Fix trigger column mismatches and duplicate trigger
-- Fixes: fn_compra_recebimento_estoque, fn_compra_gera_conta_pagar, fn_producao_estoque
-- Removes: duplicate saida logic from fn_producao_estoque (debitar_estoque_producao handles it)
-- Expands: ocorrencias tipo CHECK to include material_defeituoso, outro
-- Adds: prioridade column to ocorrencias (used by code but missing from DB)
-- Drops: duplicate trg_debitar_estoque trigger (debitar_estoque_producao handles saida)

-- ============================================================
-- 1. Fix fn_compra_recebimento_estoque
--    observacao → motivo
--    quantidade → quantidade_disponivel
-- ============================================================
CREATE OR REPLACE FUNCTION fn_compra_recebimento_estoque()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'recebido' AND (OLD.status IS NULL OR OLD.status != 'recebido') THEN
    -- Entrada de cada item do pedido de compra
    INSERT INTO estoque_movimentacoes (material_id, tipo, quantidade, referencia_tipo, referencia_id, motivo)
    SELECT pci.material_id, 'entrada', pci.quantidade, 'pedido_compra', NEW.id,
      'Entrada automática - Pedido de Compra #' || COALESCE(NEW.numero, NEW.id::text)
    FROM pedido_compra_itens pci WHERE pci.pedido_compra_id = NEW.id;

    -- Atualizar saldos existentes
    UPDATE estoque_saldos es
    SET quantidade_disponivel = es.quantidade_disponivel + pci.quantidade, updated_at = NOW()
    FROM pedido_compra_itens pci
    WHERE pci.pedido_compra_id = NEW.id AND es.material_id = pci.material_id;

    -- Criar saldos para materiais novos
    INSERT INTO estoque_saldos (material_id, quantidade_disponivel)
    SELECT pci.material_id, pci.quantidade
    FROM pedido_compra_itens pci
    WHERE pci.pedido_compra_id = NEW.id
      AND NOT EXISTS (SELECT 1 FROM estoque_saldos WHERE material_id = pci.material_id)
    ON CONFLICT (material_id) DO UPDATE SET quantidade_disponivel = estoque_saldos.quantidade_disponivel + EXCLUDED.quantidade_disponivel;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. Fix fn_compra_gera_conta_pagar
--    descricao → numero_titulo
--    valor → valor_original
--    data_entrega → previsao_entrega
--    'pendente' → 'a_pagar'
--    + idempotency guard
-- ============================================================
CREATE OR REPLACE FUNCTION fn_compra_gera_conta_pagar()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'aprovado' AND (OLD.status IS NULL OR OLD.status != 'aprovado') THEN
    -- Guard de idempotência: não criar duplicata
    IF NOT EXISTS (SELECT 1 FROM contas_pagar WHERE pedido_compra_id = NEW.id) THEN
      INSERT INTO contas_pagar (
        fornecedor_id, pedido_compra_id, numero_titulo, valor_original,
        data_vencimento, data_emissao, status
      )
      VALUES (
        NEW.fornecedor_id,
        NEW.id,
        'PC-' || COALESCE(NEW.numero, NEW.id::text),
        NEW.valor_total,
        COALESCE(NEW.previsao_entrega, CURRENT_DATE + INTERVAL '30 days'),
        CURRENT_DATE,
        'a_pagar'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. Fix fn_producao_estoque
--    observacao → motivo
--    quantidade → quantidade_disponivel
--    REMOVE saida block (debitar_estoque_producao already handles it)
--    Keep: reserva on em_producao + liberacao_reserva on finalizado
-- ============================================================
CREATE OR REPLACE FUNCTION fn_producao_estoque()
RETURNS TRIGGER AS $$
BEGIN
  -- Reserva de materiais quando OP entra em produção
  IF NEW.status = 'em_producao' AND (OLD.status IS NULL OR OLD.status != 'em_producao') THEN
    INSERT INTO estoque_movimentacoes (material_id, tipo, quantidade, referencia_tipo, referencia_id, motivo)
    SELECT mm.material_id, 'reserva', mm.quantidade * COALESCE(NEW.quantidade, 1),
      'ordem_producao', NEW.id, 'Reserva automática - OP #' || COALESCE(NEW.numero, NEW.id::text)
    FROM modelo_materiais mm WHERE mm.modelo_id = NEW.modelo_id;

    -- Atualizar quantidade_reservada nos saldos
    UPDATE estoque_saldos es
    SET quantidade_reservada = COALESCE(es.quantidade_reservada, 0) + (mm.quantidade * COALESCE(NEW.quantidade, 1)),
        updated_at = NOW()
    FROM modelo_materiais mm
    WHERE mm.modelo_id = NEW.modelo_id AND es.material_id = mm.material_id;
  END IF;

  -- Liberação de reserva quando OP é finalizada (saída feita por debitar_estoque_producao)
  IF NEW.status = 'finalizado' AND (OLD.status IS NULL OR OLD.status != 'finalizado') THEN
    INSERT INTO estoque_movimentacoes (material_id, tipo, quantidade, referencia_tipo, referencia_id, motivo)
    SELECT mm.material_id, 'liberacao_reserva', mm.quantidade * COALESCE(NEW.quantidade, 1),
      'ordem_producao', NEW.id, 'Liberação reserva - OP #' || COALESCE(NEW.numero, NEW.id::text)
    FROM modelo_materiais mm WHERE mm.modelo_id = NEW.modelo_id;

    -- Liberar quantidade_reservada nos saldos
    UPDATE estoque_saldos es
    SET quantidade_reservada = GREATEST(0, COALESCE(es.quantidade_reservada, 0) - (mm.quantidade * COALESCE(NEW.quantidade, 1))),
        updated_at = NOW()
    FROM modelo_materiais mm
    WHERE mm.modelo_id = NEW.modelo_id AND es.material_id = mm.material_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. Expandir CHECK de ocorrencias.tipo
-- ============================================================
ALTER TABLE ocorrencias DROP CONSTRAINT IF EXISTS ocorrencias_tipo_check;
ALTER TABLE ocorrencias ADD CONSTRAINT ocorrencias_tipo_check
  CHECK (tipo = ANY (ARRAY['retrabalho', 'devolucao', 'erro_producao', 'erro_instalacao', 'divergencia_cliente', 'material_defeituoso', 'outro']));

-- ============================================================
-- 5. Adicionar coluna prioridade a ocorrencias (usada pelo código mas ausente no DB)
-- ============================================================
ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS prioridade TEXT DEFAULT 'media';
ALTER TABLE ocorrencias ADD CONSTRAINT ocorrencias_prioridade_check
  CHECK (prioridade = ANY (ARRAY['baixa', 'media', 'alta', 'critica']));

-- ============================================================
-- 6. Drop trigger duplicado que causa débito duplo de estoque
--    debitar_estoque_producao já faz saída no finalizado/concluido
--    fn_producao_estoque agora só faz reserva/liberação (sem saída)
-- ============================================================
-- Nota: NÃO dropar debitar_estoque_producao — ele é o trigger correto para saída
-- O fn_producao_estoque já foi reescrito acima sem bloco de saída
```

**Step 2: Execute migration on Supabase**

Use the Supabase MCP tool `execute_sql` with project_id `djwjmfgplnqyffdcgdaw` to run the migration.

**Step 3: Verify triggers work**

Run test queries:
```sql
-- Verify functions exist with correct source
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('fn_compra_recebimento_estoque', 'fn_compra_gera_conta_pagar', 'fn_producao_estoque');

-- Verify expanded CHECK
SELECT pg_get_constraintdef(oid) FROM pg_constraint
WHERE conname = 'ocorrencias_tipo_check';

-- Verify prioridade column exists
SELECT column_name FROM information_schema.columns
WHERE table_name = 'ocorrencias' AND column_name = 'prioridade';
```

**Step 4: Commit**

```bash
git add supabase/migrations/032_fix_triggers_schema.sql
git commit -m "fix(sql): correct trigger column mismatches and remove duplicate estoque debit"
```

---

## Task 2: Fix Compras Types

**Files:**
- Modify: `src/domains/compras/types/compras.types.ts`

**Step 1: Rewrite compras.types.ts**

```typescript
export interface Fornecedor {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
  contato_nome?: string;
  categorias?: string[];
  lead_time_dias?: number;
  condicao_pagamento?: string;
  observacoes?: string;
  ativo: boolean;
  created_at: string;
}

export type PedidoCompraStatus = 'rascunho' | 'aprovado' | 'enviado' | 'parcial' | 'recebido' | 'cancelado';

export interface PedidoCompra {
  id: string;
  numero?: string;
  fornecedor_id: string;
  fornecedor?: Fornecedor;
  status: PedidoCompraStatus;
  valor_total: number;
  previsao_entrega?: string;
  observacoes?: string;
  criado_por?: string;
  aprovado_por?: string;
  created_at: string;
  itens?: PedidoCompraItem[];
}

export interface PedidoCompraItem {
  id: string;
  pedido_compra_id: string;
  material_id: string;
  material?: { nome: string; unidade: string };
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

export type PedidoCompraCreate = Omit<PedidoCompra, 'id' | 'created_at' | 'fornecedor' | 'itens'>;
export type PedidoCompraItemCreate = Omit<PedidoCompraItem, 'id' | 'material'>;
```

**Step 2: Commit**

```bash
git add src/domains/compras/types/compras.types.ts
git commit -m "fix(compras): align types with DB schema - previsao_entrega, parcial status"
```

---

## Task 3: Fix Estoque Types

**Files:**
- Modify: `src/domains/estoque/types/estoque.types.ts`

**Step 1: Rewrite estoque.types.ts**

```typescript
export interface EstoqueSaldo {
  id: string;
  material_id: string;
  material?: { nome: string; unidade: string; estoque_minimo: number };
  quantidade_disponivel: number;
  quantidade_reservada?: number;
  updated_at: string;
}

export interface EstoqueMovimentacao {
  id: string;
  material_id: string;
  material?: { nome: string; unidade: string };
  tipo: 'entrada' | 'saida' | 'reserva' | 'liberacao_reserva' | 'ajuste' | 'devolucao';
  quantidade: number;
  referencia_tipo?: string;
  referencia_id?: string;
  motivo?: string;
  usuario_id?: string;
  created_at: string;
}

export interface Inventario {
  id: string;
  data_inventario: string;
  status: 'aberto' | 'finalizado';
  responsavel_id?: string;
  observacoes?: string;
  created_at: string;
  itens?: InventarioItem[];
}

export interface InventarioItem {
  id: string;
  inventario_id: string;
  material_id: string;
  material?: { nome: string; unidade: string };
  quantidade_sistema: number;
  quantidade_contada?: number;
  diferenca: number;
  justificativa?: string;
}
```

**Step 2: Commit**

```bash
git add src/domains/estoque/types/estoque.types.ts
git commit -m "fix(estoque): align types - quantidade_disponivel, motivo"
```

---

## Task 4: Fix Qualidade Types

**Files:**
- Modify: `src/domains/qualidade/types/qualidade.types.ts`

**Step 1: Rewrite qualidade.types.ts**

```typescript
export type OcorrenciaTipo = 'retrabalho' | 'devolucao' | 'erro_producao' | 'erro_instalacao' | 'divergencia_cliente' | 'material_defeituoso' | 'outro';
export type OcorrenciaStatus = 'aberta' | 'em_analise' | 'em_tratativa' | 'resolvida' | 'encerrada';
export type OcorrenciaCausa = 'material_defeituoso' | 'erro_operacional' | 'erro_projeto' | 'instrucao_incorreta' | 'outro';
export type OcorrenciaPrioridade = 'baixa' | 'media' | 'alta' | 'critica';

export interface Ocorrencia {
  id: string;
  numero?: string;
  descricao: string;
  tipo: OcorrenciaTipo;
  causa?: OcorrenciaCausa;
  prioridade: OcorrenciaPrioridade;
  status: OcorrenciaStatus;
  pedido_id?: string;
  ordem_producao_id?: string;
  ordem_instalacao_id?: string;
  fornecedor_id?: string;
  responsavel_id?: string;
  responsavel?: { first_name: string; last_name: string };
  custo_mp?: number;
  custo_mo?: number;
  custo_total?: number;
  impacto_prazo_dias?: number;
  created_at: string;
  updated_at?: string;
  tratativas?: Tratativa[];
}

export interface Tratativa {
  id: string;
  ocorrencia_id: string;
  acao_corretiva?: string;
  responsavel_id?: string;
  prazo?: string;
  data_conclusao?: string;
  observacoes?: string;
  created_at: string;
}

export interface QualidadeKPIs {
  total_ocorrencias: number;
  abertas: number;
  resolvidas_mes: number;
  mttr_horas: number;
  por_tipo: { tipo: string; count: number }[];
  por_prioridade: { prioridade: string; count: number }[];
}
```

**Step 2: Commit**

```bash
git add src/domains/qualidade/types/qualidade.types.ts
git commit -m "fix(qualidade): align types - em_tratativa, encerrada, acao_corretiva, causa"
```

---

## Task 5: Fix comprasService.ts

**Files:**
- Modify: `src/domains/compras/services/comprasService.ts`

**Step 1: Update service**

Key changes:
- `(supabase as any)` → `const db = supabase as any;` at top, use `db` everywhere
- `data_entrega` → `previsao_entrega` in types/params
- Add `listarFornecedoresAtivos()` — extracted from PedidoCompraForm
- Add `listarMateriaisSelect()` — extracted from PedidoCompraForm
- Import `PedidoCompraCreate, PedidoCompraItemCreate` from types

```typescript
import { supabase } from "@/integrations/supabase/client";
import type { PedidoCompraCreate, PedidoCompraItemCreate } from "../types/compras.types";

const db = supabase as any;

export const comprasService = {
  // === FORNECEDORES ===
  async listarFornecedores(filtros?: { ativo?: boolean; busca?: string }) {
    let q = db.from("fornecedores").select("*").order("nome_fantasia");
    if (filtros?.ativo !== undefined) q = q.eq("ativo", filtros.ativo);
    if (filtros?.busca) q = q.or(`nome_fantasia.ilike.%${filtros.busca}%,razao_social.ilike.%${filtros.busca}%`);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async listarFornecedoresAtivos() {
    const { data, error } = await db
      .from("fornecedores")
      .select("id, nome_fantasia, razao_social")
      .eq("ativo", true)
      .order("nome_fantasia", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async listarMateriaisSelect() {
    const { data, error } = await db
      .from("materiais")
      .select("id, codigo, nome, unidade, preco_medio")
      .order("nome", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async criarFornecedor(dados: Record<string, any>) {
    const { data, error } = await db.from("fornecedores").insert(dados).select().single();
    if (error) throw error;
    return data;
  },

  async atualizarFornecedor(id: string, dados: Record<string, any>) {
    const { data, error } = await db.from("fornecedores").update(dados).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async excluirFornecedor(id: string) {
    const { error } = await db.from("fornecedores").delete().eq("id", id);
    if (error) throw error;
  },

  // === PEDIDOS DE COMPRA ===
  async listarPedidosCompra(filtros?: { status?: string; fornecedor_id?: string }) {
    let q = db
      .from("pedidos_compra")
      .select("*, fornecedor:fornecedores(nome_fantasia, razao_social)")
      .order("created_at", { ascending: false });
    if (filtros?.status) q = q.eq("status", filtros.status);
    if (filtros?.fornecedor_id) q = q.eq("fornecedor_id", filtros.fornecedor_id);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async buscarPedidoCompra(id: string) {
    const { data, error } = await db
      .from("pedidos_compra")
      .select("*, fornecedor:fornecedores(*), itens:pedido_compra_itens(*, material:materiais(nome, unidade))")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  async criarPedidoCompra(pedido: PedidoCompraCreate, itens: Omit<PedidoCompraItemCreate, 'pedido_compra_id'>[]) {
    const { data: pedidoCriado, error: errPedido } = await db
      .from("pedidos_compra")
      .insert(pedido)
      .select()
      .single();
    if (errPedido) throw errPedido;

    if (itens.length > 0) {
      const { error: errItens } = await db
        .from("pedido_compra_itens")
        .insert(itens.map(i => ({ ...i, pedido_compra_id: pedidoCriado.id })));
      if (errItens) throw errItens;
    }
    return pedidoCriado;
  },

  async atualizarStatusPedido(id: string, status: string) {
    const { data, error } = await db
      .from("pedidos_compra")
      .update({ status })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
```

**Step 2: Commit**

```bash
git add src/domains/compras/services/comprasService.ts
git commit -m "fix(compras): align service with DB schema, extract form queries"
```

---

## Task 6: Fix estoqueService.ts

**Files:**
- Modify: `src/domains/estoque/services/estoqueService.ts`

**Step 1: Update service**

Key changes:
- `const db = supabase as any;` at top
- `observacao` → `motivo` in criarMovimentacao
- `quantidade` → `quantidade_disponivel` in criarInventario (when reading saldos)
- Filter `abaixoMinimo`: compare against `quantidade_disponivel`

```typescript
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export const estoqueService = {
  async listarSaldos(filtros?: { abaixoMinimo?: boolean; busca?: string }) {
    let q = db
      .from("estoque_saldos")
      .select("*, material:materiais(nome, unidade, estoque_minimo)")
      .order("material(nome)");
    if (filtros?.busca) q = q.ilike("material.nome", `%${filtros.busca}%`);
    const { data, error } = await q;
    if (error) throw error;
    let result = data ?? [];
    if (filtros?.abaixoMinimo) {
      result = result.filter((s: any) => s.quantidade_disponivel < (s.material?.estoque_minimo ?? 0));
    }
    return result;
  },

  async alertasEstoqueMinimo() {
    const { data, error } = await db
      .from("estoque_saldos")
      .select("*, material:materiais(nome, unidade, estoque_minimo)");
    if (error) throw error;
    return (data ?? []).filter((s: any) =>
      s.material?.estoque_minimo > 0 && s.quantidade_disponivel < s.material.estoque_minimo
    );
  },

  async listarMovimentacoes(filtros?: { material_id?: string; tipo?: string; limit?: number }) {
    let q = db
      .from("estoque_movimentacoes")
      .select("*, material:materiais(nome, unidade)")
      .order("created_at", { ascending: false })
      .limit(filtros?.limit ?? 100);
    if (filtros?.material_id) q = q.eq("material_id", filtros.material_id);
    if (filtros?.tipo) q = q.eq("tipo", filtros.tipo);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async criarMovimentacao(dados: { material_id: string; tipo: string; quantidade: number; motivo?: string }) {
    const { data, error } = await db
      .from("estoque_movimentacoes")
      .insert(dados)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async listarInventarios() {
    const { data, error } = await db
      .from("inventarios")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async criarInventario(dados: { observacoes?: string; responsavel_id?: string }) {
    const { data: inv, error: errInv } = await db
      .from("inventarios")
      .insert(dados)
      .select()
      .single();
    if (errInv) throw errInv;

    const { data: saldos, error: errSaldos } = await db
      .from("estoque_saldos")
      .select("material_id, quantidade_disponivel");
    if (errSaldos) throw errSaldos;

    if (saldos?.length > 0) {
      await db
        .from("inventario_itens")
        .insert(saldos.map((s: any) => ({
          inventario_id: inv.id,
          material_id: s.material_id,
          quantidade_sistema: s.quantidade_disponivel,
        })));
    }
    return inv;
  },

  async buscarInventario(id: string) {
    const { data, error } = await db
      .from("inventarios")
      .select("*, itens:inventario_itens(*, material:materiais(nome, unidade))")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  async atualizarItemInventario(id: string, quantidade_contada: number, justificativa?: string) {
    const { error } = await db
      .from("inventario_itens")
      .update({ quantidade_contada, justificativa })
      .eq("id", id);
    if (error) throw error;
  },

  async finalizarInventario(id: string) {
    const { error } = await db
      .from("inventarios")
      .update({ status: 'finalizado' })
      .eq("id", id);
    if (error) throw error;
  },
};
```

**Step 2: Commit**

```bash
git add src/domains/estoque/services/estoqueService.ts
git commit -m "fix(estoque): align service - quantidade_disponivel, motivo"
```

---

## Task 7: Fix qualidadeService.ts

**Files:**
- Modify: `src/domains/qualidade/services/qualidadeService.ts`

**Step 1: Update service**

Key changes:
- `const db = supabase as any;` at top
- `titulo` removido (usar `descricao`)
- `adicionarTratativa`: `descricao` → `acao_corretiva`, remove `tipo`, add `prazo`, `data_conclusao`, `observacoes`
- Tratativas join: select `acao_corretiva, prazo, data_conclusao, observacoes` instead of `*`

```typescript
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export const qualidadeService = {
  async listarOcorrencias(filtros?: { status?: string; prioridade?: string; tipo?: string }) {
    let q = db
      .from("ocorrencias")
      .select("*, responsavel:profiles(first_name, last_name)")
      .is("excluido_em", null)
      .order("created_at", { ascending: false });
    if (filtros?.status) q = q.eq("status", filtros.status);
    if (filtros?.prioridade) q = q.eq("prioridade", filtros.prioridade);
    if (filtros?.tipo) q = q.eq("tipo", filtros.tipo);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async buscarOcorrencia(id: string) {
    const { data, error } = await db
      .from("ocorrencias")
      .select("*, tratativas:ocorrencia_tratativas(id, ocorrencia_id, acao_corretiva, responsavel_id, prazo, data_conclusao, observacoes, created_at), responsavel:profiles(first_name, last_name)")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  async criarOcorrencia(dados: Record<string, any>) {
    const { data, error } = await db
      .from("ocorrencias")
      .insert(dados)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async atualizarOcorrencia(id: string, dados: Record<string, any>) {
    const { data, error } = await db
      .from("ocorrencias")
      .update(dados)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async adicionarTratativa(dados: {
    ocorrencia_id: string;
    acao_corretiva?: string;
    responsavel_id?: string;
    prazo?: string;
    observacoes?: string;
  }) {
    const { data, error } = await db
      .from("ocorrencia_tratativas")
      .insert(dados)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async buscarKPIs() {
    const { data: ocorrencias, error } = await db
      .from("ocorrencias")
      .select("id, tipo, prioridade, status, created_at, updated_at")
      .is("excluido_em", null);
    if (error) throw error;

    const all = ocorrencias ?? [];
    const abertas = all.filter((o: any) => !['resolvida', 'encerrada'].includes(o.status));
    const now = new Date();
    const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const resolvidasMes = all.filter((o: any) =>
      ['resolvida', 'encerrada'].includes(o.status) && (o.updated_at ?? '').startsWith(mesAtual)
    );

    // MTTR (Mean Time To Resolution)
    const resolvidas = all.filter((o: any) => ['resolvida', 'encerrada'].includes(o.status) && o.updated_at);
    const mttrHoras = resolvidas.length > 0
      ? resolvidas.reduce((acc: number, o: any) => {
          const diff = new Date(o.updated_at).getTime() - new Date(o.created_at).getTime();
          return acc + diff / (1000 * 60 * 60);
        }, 0) / resolvidas.length
      : 0;

    // Agrupamentos
    const porTipo: Record<string, number> = {};
    const porPrioridade: Record<string, number> = {};
    all.forEach((o: any) => {
      porTipo[o.tipo] = (porTipo[o.tipo] ?? 0) + 1;
      porPrioridade[o.prioridade] = (porPrioridade[o.prioridade] ?? 0) + 1;
    });

    return {
      total_ocorrencias: all.length,
      abertas: abertas.length,
      resolvidas_mes: resolvidasMes.length,
      mttr_horas: Math.round(mttrHoras * 10) / 10,
      por_tipo: Object.entries(porTipo).map(([tipo, count]) => ({ tipo, count })),
      por_prioridade: Object.entries(porPrioridade).map(([prioridade, count]) => ({ prioridade, count })),
    };
  },
};
```

**Step 2: Commit**

```bash
git add src/domains/qualidade/services/qualidadeService.ts
git commit -m "fix(qualidade): align service - em_tratativa, encerrada, acao_corretiva, causa"
```

---

## Task 8: Fix Compras Components & Pages

**Files:**
- Modify: `src/domains/compras/pages/PedidoCompraDetailPage.tsx`
- Modify: `src/domains/compras/pages/PedidosCompraPage.tsx`
- Modify: `src/domains/compras/components/PedidoCompraForm.tsx`

**Step 1: PedidoCompraDetailPage.tsx**

Key changes:
- Remove `pendente` from PCStatus, add `parcial`
- Update STATUS_CONFIG: remove pendente, add parcial
- Update STATUS_ACTIONS:
  - rascunho → [Aprovar, Cancelar] (skip pendente, go direct to aprovado)
  - aprovado → [Marcar Enviado, Cancelar]
  - enviado → [Confirmar Recebimento, Recebimento Parcial, Cancelar] ← NEW
  - parcial → [Confirmar Recebimento] ← NEW
- `data_entrega` → `previsao_entrega`

**Step 2: PedidosCompraPage.tsx**

Key changes:
- Remove `pendente` from PCStatus and TABS, add `parcial`
- Update STATUS_CONFIG
- `data_entrega` → `previsao_entrega`
- Fornecedor name: use `fornecedor?.nome_fantasia || fornecedor?.razao_social`

**Step 3: PedidoCompraForm.tsx**

Key changes:
- Remove direct Supabase imports
- Import `comprasService` and use `useQuery` with service methods
- `data_entrega` state → `previsaoEntrega`
- Submit payload: `previsao_entrega` instead of `data_entrega`

**Step 4: Commit**

```bash
git add src/domains/compras/pages/PedidoCompraDetailPage.tsx src/domains/compras/pages/PedidosCompraPage.tsx src/domains/compras/components/PedidoCompraForm.tsx
git commit -m "fix(compras): align pages with DB - parcial status, previsao_entrega, service layer"
```

---

## Task 9: Fix Estoque Components & Pages

**Files:**
- Modify: `src/domains/estoque/components/SaldoCard.tsx`
- Modify: `src/domains/estoque/components/AlertaEstoqueMinimo.tsx`
- Modify: `src/domains/estoque/pages/EstoqueDashboardPage.tsx`

**Step 1: SaldoCard.tsx**

- `saldo.quantidade` → `saldo.quantidade_disponivel`

**Step 2: AlertaEstoqueMinimo.tsx**

- `alerta.quantidade` → `alerta.quantidade_disponivel`
- Fix pluralization: `material{alertas.length > 1 ? "is" : ""}` → `materia{alertas.length > 1 ? "is" : "l"}`

**Step 3: EstoqueDashboardPage.tsx**

- `ajusteForm.observacao` → `ajusteForm.motivo`
- Dialog label: "Observação" → "Motivo"
- `criarMov.mutate` payload: `observacao` → `motivo`
- `saldos.map` references: `saldo.quantidade` → `saldo.quantidade_disponivel`

**Step 4: Commit**

```bash
git add src/domains/estoque/components/SaldoCard.tsx src/domains/estoque/components/AlertaEstoqueMinimo.tsx src/domains/estoque/pages/EstoqueDashboardPage.tsx
git commit -m "fix(estoque): align components - quantidade_disponivel, motivo, fix pluralization"
```

---

## Task 10: Fix Qualidade Components & Pages

**Files:**
- Modify: `src/domains/qualidade/components/OcorrenciaForm.tsx`
- Modify: `src/domains/qualidade/components/TratativaTimeline.tsx`
- Modify: `src/domains/qualidade/components/QualidadeCharts.tsx`
- Modify: `src/domains/qualidade/pages/QualidadeDashboardPage.tsx`
- Modify: `src/domains/qualidade/pages/OcorrenciaDetailPage.tsx`

**Step 1: OcorrenciaForm.tsx**

Key changes:
- Remove `titulo` field from form
- TIPO_OPTIONS: add `material_defeituoso`, `outro` (now valid after CHECK expansion)
- Add `causa` field (select with DB enum values)
- Submit: use `descricao` as main field, no `titulo`
- STATUS references: `em_tratamento` → `em_tratativa`, `fechada` → `encerrada`

**Step 2: TratativaTimeline.tsx**

Key changes:
- `tratativa.descricao` → `tratativa.acao_corretiva`
- `tratativa.tipo` → remove (not in DB)
- Add display for `tratativa.prazo`, `tratativa.data_conclusao`, `tratativa.observacoes`
- Add tratativa form: `acao_corretiva`, `prazo`, `observacoes` fields

**Step 3: QualidadeCharts.tsx**

- formatTipoLabel: add `material_defeituoso` → "Material Defeituoso", `outro` → "Outro"

**Step 4: QualidadeDashboardPage.tsx**

- STATUS_CONFIG: `em_tratamento` → `em_tratativa`, `fechada` → `encerrada`
- Labels: "Em Tratamento" → "Em Tratativa", "Fechada" → "Encerrada"

**Step 5: OcorrenciaDetailPage.tsx**

- STATUS_CONFIG: same as dashboard
- STATUS_NEXT map: align with DB values
  - `aberta` → `em_analise`
  - `em_analise` → `em_tratativa`
  - `em_tratativa` → `resolvida`
  - `resolvida` → `encerrada`
- Display `causa`, `custo_mp`, `custo_mo`, `custo_total`, `impacto_prazo_dias` if present
- Tratativas: use `acao_corretiva` instead of `descricao`

**Step 6: Commit**

```bash
git add src/domains/qualidade/
git commit -m "fix(qualidade): align all components - em_tratativa, encerrada, acao_corretiva, causa"
```

---

## Task 11: Fix Qualidade Hooks (Cache Invalidation)

**Files:**
- Modify: `src/domains/qualidade/hooks/useOcorrencias.ts`
- Modify: `src/domains/qualidade/hooks/useQualidadeKPIs.ts` (no changes needed, just verify)
- Modify: `src/domains/qualidade/hooks/useTratativas.ts`

**Step 1: useOcorrencias.ts**

Add `qc.invalidateQueries({ queryKey: ["qualidade-kpis"] })` to:
- `useCriarOcorrencia` onSuccess
- `useAtualizarOcorrencia` onSuccess

**Step 2: useTratativas.ts**

- Update `adicionarTratativa` call signature: `descricao` → `acao_corretiva`, remove `tipo`, add `prazo`, `observacoes`

**Step 3: Commit**

```bash
git add src/domains/qualidade/hooks/
git commit -m "fix(qualidade): fix cache invalidation for KPIs, align tratativa hook"
```

---

## Task 12: Cleanup — Delete Monoliths, Fix Route

**Files:**
- Delete: `src/domains/compras/pages/ComprasPage.tsx`
- Delete: `src/domains/estoque/pages/EstoquePage.tsx`
- Modify: `src/routes/qualidadeRoutes.tsx` (remove orphaned redirect)

**Step 1: Delete old monolith files**

```bash
rm src/domains/compras/pages/ComprasPage.tsx
rm src/domains/estoque/pages/EstoquePage.tsx
```

**Step 2: Fix qualidadeRoutes.tsx**

Remove the orphaned redirect line:
```tsx
// DELETE THIS LINE:
<Route path="ocorrencias" element={<Navigate to="/qualidade/ocorrencias" replace />} />
```

**Step 3: Verify no imports reference deleted files**

```bash
grep -r "ComprasPage" src/ --include="*.tsx" --include="*.ts"
grep -r "EstoquePage" src/ --include="*.tsx" --include="*.ts"
```

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete monolith pages (ComprasPage, EstoquePage), fix orphaned redirect"
```

---

## Task 13: Update Tests

**Files:**
- Modify: `src/domains/compras/services/__tests__/comprasService.test.ts`
- Modify: `src/domains/estoque/services/__tests__/estoqueService.test.ts`
- Modify: `src/domains/qualidade/services/__tests__/qualidadeService.test.ts`

**Step 1: comprasService.test.ts**

- All mock data: `data_entrega` → `previsao_entrega`
- Status values: remove `pendente`, add `parcial`
- Fornecedor mock: add `nome_fantasia`, `razao_social`

**Step 2: estoqueService.test.ts**

- Mock saldos: `quantidade` → `quantidade_disponivel`
- criarMovimentacao: `observacao` → `motivo`
- criarInventario: saldos query returns `quantidade_disponivel`

**Step 3: qualidadeService.test.ts**

- Status values: `em_tratamento` → `em_tratativa`, `fechada` → `encerrada`
- Tratativa mock data: `descricao` → `acao_corretiva`, `tipo` → remove, add `prazo`, `data_conclusao`, `observacoes`
- `titulo` references → `descricao`
- buscarKPIs: filter uses `encerrada` instead of `fechada`

**Step 4: Run tests**

```bash
npx vitest run
```

Expected: All 164+ tests passing.

**Step 5: Commit**

```bash
git add src/domains/compras/services/__tests__/ src/domains/estoque/services/__tests__/ src/domains/qualidade/services/__tests__/
git commit -m "test: update all tests to match corrected DB schema"
```

---

## Task 14: Build & Final Verification

**Step 1: Run build**

```bash
npm run build
```

Expected: Build passes without errors.

**Step 2: Run tests**

```bash
npx vitest run
```

Expected: All tests pass.

**Step 3: Verify no stale references remain**

```bash
# Should return 0 results for each
grep -r "observacao" src/domains/estoque/ --include="*.ts" --include="*.tsx"
grep -r "em_tratamento" src/domains/qualidade/ --include="*.ts" --include="*.tsx"
grep -r "\"fechada\"" src/domains/qualidade/ --include="*.ts" --include="*.tsx"
grep -r "data_entrega" src/domains/compras/ --include="*.ts" --include="*.tsx"
grep -r "\"pendente\"" src/domains/compras/ --include="*.ts" --include="*.tsx"
```

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: final schema alignment cleanup"
```

---

## Execution Notes

- **Model**: Use Sonnet for execution (Opus for planning only)
- **Subagent strategy**: Tasks 2-4 (types) can run in parallel. Tasks 5-7 (services) can run in parallel. Task 8-10 (components) can run in parallel after services are done.
- **Migration**: Task 1 must be executed first via Supabase MCP tool
- **Build check**: After each onda, run `npm run build` to catch errors early
- **Test check**: Final test run in Task 14
