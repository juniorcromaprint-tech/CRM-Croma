# Módulos Integrados (Compras, Estoque, Qualidade) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Decompor 3 módulos monolíticos (~5.572 linhas) em domínios estruturados com integrações entre si e com produção/financeiro.

**Architecture:** Cada monólito (ComprasPage 2099L, EstoquePage 1968L, OcorrenciasPage 1505L) será decomposto em services → hooks → components → pages seguindo o padrão de `src/domains/comercial/`. Migration `031` cria tabelas de inventário, triggers de integração estoque, e RLS. Rotas migram de `operacionalRoutes.tsx` para arquivos dedicados.

**Tech Stack:** React 19, TypeScript, TanStack Query v5, Supabase, Zod, shadcn/ui, Recharts, Vitest

**Spec:** `docs/superpowers/specs/2026-03-15-modulos-integrados-design.md`

**Modelo de execução:** Sonnet para implementação, Opus para review.

---

## Task 1: Migration SQL — Tabelas, Triggers e RLS

**Files:**
- Create: `supabase/migrations/031_modulos_integrados.sql`

**Step 1: Write the migration file**

```sql
-- =============================================
-- 031_modulos_integrados.sql
-- Inventário, integração estoque, qualidade FK
-- =============================================

-- 1. Tabelas de Inventário
CREATE TABLE IF NOT EXISTS inventarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_inventario DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'finalizado')),
  responsavel_id UUID REFERENCES profiles(id),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventario_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventario_id UUID NOT NULL REFERENCES inventarios(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materiais(id),
  quantidade_sistema NUMERIC(12,4) NOT NULL DEFAULT 0,
  quantidade_contada NUMERIC(12,4),
  diferenca NUMERIC(12,4) GENERATED ALWAYS AS (COALESCE(quantidade_contada, 0) - quantidade_sistema) STORED,
  justificativa TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Coluna nova em ocorrencias
ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS fornecedor_id UUID REFERENCES fornecedores(id);

-- 3. RLS para tabelas novas
ALTER TABLE inventarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventarios_auth" ON inventarios
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "inventario_itens_auth" ON inventario_itens
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_inventario_itens_inventario ON inventario_itens(inventario_id);
CREATE INDEX IF NOT EXISTS idx_inventario_itens_material ON inventario_itens(material_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_fornecedor ON ocorrencias(fornecedor_id);

-- 5. Trigger: Compras → Estoque (recebimento gera entrada)
CREATE OR REPLACE FUNCTION fn_compra_recebimento_estoque()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'recebido' AND (OLD.status IS NULL OR OLD.status != 'recebido') THEN
    INSERT INTO estoque_movimentacoes (material_id, tipo, quantidade, referencia_tipo, referencia_id, observacao)
    SELECT
      pci.material_id,
      'entrada',
      pci.quantidade,
      'pedido_compra',
      NEW.id,
      'Entrada automática - Pedido de Compra #' || NEW.numero
    FROM pedido_compra_itens pci
    WHERE pci.pedido_compra_id = NEW.id;

    -- Atualiza saldos
    UPDATE estoque_saldos es
    SET quantidade = es.quantidade + pci.quantidade,
        updated_at = NOW()
    FROM pedido_compra_itens pci
    WHERE pci.pedido_compra_id = NEW.id
      AND es.material_id = pci.material_id;

    -- Insere saldo para materiais que ainda não têm registro
    INSERT INTO estoque_saldos (material_id, quantidade)
    SELECT pci.material_id, pci.quantidade
    FROM pedido_compra_itens pci
    WHERE pci.pedido_compra_id = NEW.id
      AND NOT EXISTS (SELECT 1 FROM estoque_saldos WHERE material_id = pci.material_id)
    ON CONFLICT (material_id) DO UPDATE SET quantidade = estoque_saldos.quantidade + EXCLUDED.quantidade;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compra_recebimento ON pedidos_compra;
CREATE TRIGGER trg_compra_recebimento
  AFTER UPDATE ON pedidos_compra
  FOR EACH ROW
  EXECUTE FUNCTION fn_compra_recebimento_estoque();

-- 6. Trigger: Compras → Financeiro (aprovação gera conta a pagar)
CREATE OR REPLACE FUNCTION fn_compra_gera_conta_pagar()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'aprovado' AND (OLD.status IS NULL OR OLD.status != 'aprovado') THEN
    INSERT INTO contas_pagar (
      fornecedor_id, pedido_compra_id, descricao, valor, data_vencimento, status
    ) VALUES (
      NEW.fornecedor_id,
      NEW.id,
      'Pedido de Compra #' || NEW.numero,
      NEW.valor_total,
      COALESCE(NEW.data_entrega, CURRENT_DATE + INTERVAL '30 days'),
      'pendente'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compra_conta_pagar ON pedidos_compra;
CREATE TRIGGER trg_compra_conta_pagar
  AFTER UPDATE ON pedidos_compra
  FOR EACH ROW
  EXECUTE FUNCTION fn_compra_gera_conta_pagar();

-- 7. Trigger: Produção → Estoque (reserva e saída)
CREATE OR REPLACE FUNCTION fn_producao_estoque()
RETURNS TRIGGER AS $$
BEGIN
  -- OP entra em produção → reserva materiais
  IF NEW.status = 'em_producao' AND (OLD.status IS NULL OR OLD.status != 'em_producao') THEN
    INSERT INTO estoque_movimentacoes (material_id, tipo, quantidade, referencia_tipo, referencia_id, observacao)
    SELECT
      mm.material_id,
      'reserva',
      mm.quantidade * COALESCE(NEW.quantidade, 1),
      'ordem_producao',
      NEW.id,
      'Reserva automática - OP #' || NEW.numero
    FROM modelo_materiais mm
    WHERE mm.modelo_id = NEW.modelo_id;
  END IF;

  -- OP finalizada → libera reserva + saída definitiva
  IF NEW.status = 'finalizado' AND (OLD.status IS NULL OR OLD.status != 'finalizado') THEN
    -- Liberação da reserva
    INSERT INTO estoque_movimentacoes (material_id, tipo, quantidade, referencia_tipo, referencia_id, observacao)
    SELECT
      mm.material_id,
      'liberacao_reserva',
      mm.quantidade * COALESCE(NEW.quantidade, 1),
      'ordem_producao',
      NEW.id,
      'Liberação reserva - OP #' || NEW.numero
    FROM modelo_materiais mm
    WHERE mm.modelo_id = NEW.modelo_id;

    -- Saída definitiva
    INSERT INTO estoque_movimentacoes (material_id, tipo, quantidade, referencia_tipo, referencia_id, observacao)
    SELECT
      mm.material_id,
      'saida',
      mm.quantidade * COALESCE(NEW.quantidade, 1),
      'ordem_producao',
      NEW.id,
      'Consumo produção - OP #' || NEW.numero
    FROM modelo_materiais mm
    WHERE mm.modelo_id = NEW.modelo_id;

    -- Atualiza saldos (decrementa)
    UPDATE estoque_saldos es
    SET quantidade = es.quantidade - (mm.quantidade * COALESCE(NEW.quantidade, 1)),
        updated_at = NOW()
    FROM modelo_materiais mm
    WHERE mm.modelo_id = NEW.modelo_id
      AND es.material_id = mm.material_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_producao_estoque ON ordens_producao;
CREATE TRIGGER trg_producao_estoque
  AFTER UPDATE ON ordens_producao
  FOR EACH ROW
  EXECUTE FUNCTION fn_producao_estoque();
```

**Step 2: Execute migration no Supabase**

Run: Execute via MCP `mcp__claude_ai_Supabase__execute_sql` ou Supabase Dashboard.
Expected: Tabelas `inventarios` e `inventario_itens` criadas. 3 triggers ativos.

**Step 3: Commit**

```bash
git add supabase/migrations/031_modulos_integrados.sql
git commit -m "feat(db): add inventario tables, estoque triggers, qualidade FK"
```

---

## Task 2: Services — Compras

**Files:**
- Create: `src/domains/compras/services/comprasService.ts`
- Create: `src/domains/compras/types/compras.types.ts`

**Step 1: Create types**

```typescript
// src/domains/compras/types/compras.types.ts

export interface Fornecedor {
  id: string;
  nome: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
  contato?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  observacoes?: string;
  ativo: boolean;
  created_at: string;
}

export interface PedidoCompra {
  id: string;
  numero?: string;
  fornecedor_id: string;
  fornecedor?: Fornecedor;
  status: 'rascunho' | 'pendente' | 'aprovado' | 'enviado' | 'recebido' | 'cancelado';
  valor_total: number;
  data_entrega?: string;
  observacoes?: string;
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

**Step 2: Create service**

```typescript
// src/domains/compras/services/comprasService.ts

import { supabase } from "@/integrations/supabase/client";
import type { PedidoCompraCreate, PedidoCompraItemCreate } from "../types/compras.types";

export const comprasService = {
  // === FORNECEDORES ===
  async listarFornecedores(filtros?: { ativo?: boolean; busca?: string }) {
    let q = (supabase as any).from("fornecedores").select("*").order("nome");
    if (filtros?.ativo !== undefined) q = q.eq("ativo", filtros.ativo);
    if (filtros?.busca) q = q.ilike("nome", `%${filtros.busca}%`);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async criarFornecedor(dados: Record<string, any>) {
    const { data, error } = await (supabase as any).from("fornecedores").insert(dados).select().single();
    if (error) throw error;
    return data;
  },

  async atualizarFornecedor(id: string, dados: Record<string, any>) {
    const { data, error } = await (supabase as any).from("fornecedores").update(dados).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async excluirFornecedor(id: string) {
    const { error } = await (supabase as any).from("fornecedores").delete().eq("id", id);
    if (error) throw error;
  },

  // === PEDIDOS DE COMPRA ===
  async listarPedidosCompra(filtros?: { status?: string; fornecedor_id?: string }) {
    let q = (supabase as any)
      .from("pedidos_compra")
      .select("*, fornecedor:fornecedores(nome)")
      .order("created_at", { ascending: false });
    if (filtros?.status) q = q.eq("status", filtros.status);
    if (filtros?.fornecedor_id) q = q.eq("fornecedor_id", filtros.fornecedor_id);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async buscarPedidoCompra(id: string) {
    const { data, error } = await (supabase as any)
      .from("pedidos_compra")
      .select("*, fornecedor:fornecedores(*), itens:pedido_compra_itens(*, material:materiais(nome, unidade))")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  async criarPedidoCompra(pedido: PedidoCompraCreate, itens: Omit<PedidoCompraItemCreate, 'pedido_compra_id'>[]) {
    const { data: pedidoCriado, error: errPedido } = await (supabase as any)
      .from("pedidos_compra")
      .insert(pedido)
      .select()
      .single();
    if (errPedido) throw errPedido;

    if (itens.length > 0) {
      const { error: errItens } = await (supabase as any)
        .from("pedido_compra_itens")
        .insert(itens.map(i => ({ ...i, pedido_compra_id: pedidoCriado.id })));
      if (errItens) throw errItens;
    }
    return pedidoCriado;
  },

  async atualizarStatusPedido(id: string, status: string) {
    const { data, error } = await (supabase as any)
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

**Step 3: Commit**

```bash
git add src/domains/compras/types/ src/domains/compras/services/
git commit -m "feat(compras): add types and service layer"
```

---

## Task 3: Services — Estoque

**Files:**
- Create: `src/domains/estoque/services/estoqueService.ts`
- Create: `src/domains/estoque/types/estoque.types.ts`

**Step 1: Create types**

```typescript
// src/domains/estoque/types/estoque.types.ts

export interface EstoqueSaldo {
  id: string;
  material_id: string;
  material?: { nome: string; unidade: string; estoque_minimo: number };
  quantidade: number;
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
  observacao?: string;
  created_at: string;
  usuario_id?: string;
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

**Step 2: Create service**

```typescript
// src/domains/estoque/services/estoqueService.ts

import { supabase } from "@/integrations/supabase/client";

export const estoqueService = {
  // === SALDOS ===
  async listarSaldos(filtros?: { abaixoMinimo?: boolean; busca?: string }) {
    let q = (supabase as any)
      .from("estoque_saldos")
      .select("*, material:materiais(nome, unidade, estoque_minimo)")
      .order("material(nome)");
    if (filtros?.busca) q = q.ilike("material.nome", `%${filtros.busca}%`);
    const { data, error } = await q;
    if (error) throw error;
    let result = data ?? [];
    if (filtros?.abaixoMinimo) {
      result = result.filter((s: any) => s.quantidade < (s.material?.estoque_minimo ?? 0));
    }
    return result;
  },

  async alertasEstoqueMinimo() {
    const { data, error } = await (supabase as any)
      .from("estoque_saldos")
      .select("*, material:materiais(nome, unidade, estoque_minimo)")
    if (error) throw error;
    return (data ?? []).filter((s: any) =>
      s.material?.estoque_minimo > 0 && s.quantidade < s.material.estoque_minimo
    );
  },

  // === MOVIMENTAÇÕES ===
  async listarMovimentacoes(filtros?: { material_id?: string; tipo?: string; limit?: number }) {
    let q = (supabase as any)
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

  async criarMovimentacao(dados: { material_id: string; tipo: string; quantidade: number; observacao?: string }) {
    const { data, error } = await (supabase as any)
      .from("estoque_movimentacoes")
      .insert(dados)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // === INVENTÁRIO ===
  async listarInventarios() {
    const { data, error } = await (supabase as any)
      .from("inventarios")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async criarInventario(dados: { observacoes?: string; responsavel_id?: string }) {
    // Cria inventário e preenche itens com saldos atuais
    const { data: inv, error: errInv } = await (supabase as any)
      .from("inventarios")
      .insert(dados)
      .select()
      .single();
    if (errInv) throw errInv;

    // Busca saldos atuais para preencher itens
    const { data: saldos } = await (supabase as any)
      .from("estoque_saldos")
      .select("material_id, quantidade");

    if (saldos?.length > 0) {
      await (supabase as any)
        .from("inventario_itens")
        .insert(saldos.map((s: any) => ({
          inventario_id: inv.id,
          material_id: s.material_id,
          quantidade_sistema: s.quantidade,
        })));
    }
    return inv;
  },

  async buscarInventario(id: string) {
    const { data, error } = await (supabase as any)
      .from("inventarios")
      .select("*, itens:inventario_itens(*, material:materiais(nome, unidade))")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  async atualizarItemInventario(id: string, quantidade_contada: number, justificativa?: string) {
    const { error } = await (supabase as any)
      .from("inventario_itens")
      .update({ quantidade_contada, justificativa })
      .eq("id", id);
    if (error) throw error;
  },

  async finalizarInventario(id: string) {
    const { error } = await (supabase as any)
      .from("inventarios")
      .update({ status: 'finalizado' })
      .eq("id", id);
    if (error) throw error;
  },
};
```

**Step 3: Commit**

```bash
git add src/domains/estoque/types/ src/domains/estoque/services/
git commit -m "feat(estoque): add types and service layer"
```

---

## Task 4: Services — Qualidade

**Files:**
- Create: `src/domains/qualidade/services/qualidadeService.ts`
- Create: `src/domains/qualidade/types/qualidade.types.ts`

**Step 1: Create types**

```typescript
// src/domains/qualidade/types/qualidade.types.ts

export interface Ocorrencia {
  id: string;
  titulo: string;
  descricao?: string;
  tipo: string;
  prioridade: 'baixa' | 'media' | 'alta' | 'critica';
  status: 'aberta' | 'em_analise' | 'em_tratamento' | 'resolvida' | 'fechada';
  pedido_id?: string;
  ordem_producao_id?: string;
  fornecedor_id?: string;
  responsavel_id?: string;
  custo_estimado?: number;
  created_at: string;
  resolved_at?: string;
  tratativas?: Tratativa[];
}

export interface Tratativa {
  id: string;
  ocorrencia_id: string;
  descricao: string;
  tipo: 'analise' | 'acao_corretiva' | 'acao_preventiva' | 'verificacao';
  responsavel_id?: string;
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

**Step 2: Create service**

```typescript
// src/domains/qualidade/services/qualidadeService.ts

import { supabase } from "@/integrations/supabase/client";

export const qualidadeService = {
  // === OCORRÊNCIAS ===
  async listarOcorrencias(filtros?: { status?: string; prioridade?: string; tipo?: string }) {
    let q = (supabase as any)
      .from("ocorrencias")
      .select("*, responsavel:profiles(first_name, last_name)")
      .order("created_at", { ascending: false });
    if (filtros?.status) q = q.eq("status", filtros.status);
    if (filtros?.prioridade) q = q.eq("prioridade", filtros.prioridade);
    if (filtros?.tipo) q = q.eq("tipo", filtros.tipo);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async buscarOcorrencia(id: string) {
    const { data, error } = await (supabase as any)
      .from("ocorrencias")
      .select("*, tratativas:ocorrencia_tratativas(*), responsavel:profiles(first_name, last_name)")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  async criarOcorrencia(dados: Record<string, any>) {
    const { data, error } = await (supabase as any)
      .from("ocorrencias")
      .insert(dados)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async atualizarOcorrencia(id: string, dados: Record<string, any>) {
    const { data, error } = await (supabase as any)
      .from("ocorrencias")
      .update(dados)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // === TRATATIVAS ===
  async adicionarTratativa(dados: { ocorrencia_id: string; descricao: string; tipo: string; responsavel_id?: string }) {
    const { data, error } = await (supabase as any)
      .from("ocorrencia_tratativas")
      .insert(dados)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // === KPIs ===
  async buscarKPIs(): Promise<any> {
    const { data: todas, error } = await (supabase as any)
      .from("ocorrencias")
      .select("id, tipo, prioridade, status, created_at, resolved_at");
    if (error) throw error;

    const items = todas ?? [];
    const abertas = items.filter((o: any) => !['resolvida', 'fechada'].includes(o.status));
    const agora = new Date();
    const mesAtual = agora.getMonth();
    const anoAtual = agora.getFullYear();
    const resolvidasMes = items.filter((o: any) => {
      if (!o.resolved_at) return false;
      const d = new Date(o.resolved_at);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    });

    // MTTR (horas)
    const comResolucao = items.filter((o: any) => o.resolved_at);
    const mttr = comResolucao.length > 0
      ? comResolucao.reduce((acc: number, o: any) => {
          const diff = new Date(o.resolved_at).getTime() - new Date(o.created_at).getTime();
          return acc + diff / (1000 * 60 * 60);
        }, 0) / comResolucao.length
      : 0;

    // Agrupar por tipo e prioridade
    const porTipo = Object.entries(
      items.reduce((acc: any, o: any) => { acc[o.tipo] = (acc[o.tipo] || 0) + 1; return acc; }, {})
    ).map(([tipo, count]) => ({ tipo, count }));

    const porPrioridade = Object.entries(
      items.reduce((acc: any, o: any) => { acc[o.prioridade] = (acc[o.prioridade] || 0) + 1; return acc; }, {})
    ).map(([prioridade, count]) => ({ prioridade, count }));

    return {
      total_ocorrencias: items.length,
      abertas: abertas.length,
      resolvidas_mes: resolvidasMes.length,
      mttr_horas: Math.round(mttr * 10) / 10,
      por_tipo: porTipo,
      por_prioridade: porPrioridade,
    };
  },
};
```

**Step 3: Commit**

```bash
git add src/domains/qualidade/types/ src/domains/qualidade/services/
git commit -m "feat(qualidade): add types and service layer"
```

---

## Task 5: Hooks — Compras

**Files:**
- Create: `src/domains/compras/hooks/useFornecedores.ts`
- Create: `src/domains/compras/hooks/usePedidosCompra.ts`

**Step 1: Create useFornecedores hook**

```typescript
// src/domains/compras/hooks/useFornecedores.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { comprasService } from "../services/comprasService";
import { showSuccess, showError } from "@/utils/toast";

export function useFornecedores(filtros?: { ativo?: boolean; busca?: string }) {
  return useQuery({
    queryKey: ["fornecedores", filtros],
    queryFn: () => comprasService.listarFornecedores(filtros),
  });
}

export function useCriarFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: comprasService.criarFornecedor,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      showSuccess("Fornecedor cadastrado");
    },
    onError: () => showError("Erro ao cadastrar fornecedor"),
  });
}

export function useAtualizarFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: Record<string, any> }) =>
      comprasService.atualizarFornecedor(id, dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      showSuccess("Fornecedor atualizado");
    },
    onError: () => showError("Erro ao atualizar fornecedor"),
  });
}

export function useExcluirFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: comprasService.excluirFornecedor,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
      showSuccess("Fornecedor excluído");
    },
    onError: () => showError("Erro ao excluir fornecedor"),
  });
}
```

**Step 2: Create usePedidosCompra hook**

```typescript
// src/domains/compras/hooks/usePedidosCompra.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { comprasService } from "../services/comprasService";
import { showSuccess, showError } from "@/utils/toast";

export function usePedidosCompra(filtros?: { status?: string; fornecedor_id?: string }) {
  return useQuery({
    queryKey: ["pedidos-compra", filtros],
    queryFn: () => comprasService.listarPedidosCompra(filtros),
  });
}

export function usePedidoCompra(id: string) {
  return useQuery({
    queryKey: ["pedido-compra", id],
    queryFn: () => comprasService.buscarPedidoCompra(id),
    enabled: !!id,
  });
}

export function useCriarPedidoCompra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pedido, itens }: { pedido: any; itens: any[] }) =>
      comprasService.criarPedidoCompra(pedido, itens),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedidos-compra"] });
      showSuccess("Pedido de compra criado");
    },
    onError: () => showError("Erro ao criar pedido de compra"),
  });
}

export function useAtualizarStatusPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      comprasService.atualizarStatusPedido(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedidos-compra"] });
      qc.invalidateQueries({ queryKey: ["pedido-compra"] });
      qc.invalidateQueries({ queryKey: ["estoque-saldos"] });
      showSuccess("Status atualizado");
    },
    onError: () => showError("Erro ao atualizar status"),
  });
}
```

**Step 3: Commit**

```bash
git add src/domains/compras/hooks/
git commit -m "feat(compras): add query hooks"
```

---

## Task 6: Hooks — Estoque

**Files:**
- Create: `src/domains/estoque/hooks/useEstoqueSaldos.ts`
- Create: `src/domains/estoque/hooks/useMovimentacoes.ts`
- Create: `src/domains/estoque/hooks/useInventario.ts`

**Step 1: Create useEstoqueSaldos**

```typescript
// src/domains/estoque/hooks/useEstoqueSaldos.ts

import { useQuery } from "@tanstack/react-query";
import { estoqueService } from "../services/estoqueService";

export function useEstoqueSaldos(filtros?: { abaixoMinimo?: boolean; busca?: string }) {
  return useQuery({
    queryKey: ["estoque-saldos", filtros],
    queryFn: () => estoqueService.listarSaldos(filtros),
  });
}

export function useAlertasEstoqueMinimo() {
  return useQuery({
    queryKey: ["estoque-alertas"],
    queryFn: () => estoqueService.alertasEstoqueMinimo(),
    refetchInterval: 5 * 60 * 1000, // 5 min
  });
}
```

**Step 2: Create useMovimentacoes**

```typescript
// src/domains/estoque/hooks/useMovimentacoes.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { estoqueService } from "../services/estoqueService";
import { showSuccess, showError } from "@/utils/toast";

export function useMovimentacoes(filtros?: { material_id?: string; tipo?: string; limit?: number }) {
  return useQuery({
    queryKey: ["estoque-movimentacoes", filtros],
    queryFn: () => estoqueService.listarMovimentacoes(filtros),
  });
}

export function useCriarMovimentacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: estoqueService.criarMovimentacao,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estoque-saldos"] });
      qc.invalidateQueries({ queryKey: ["estoque-movimentacoes"] });
      showSuccess("Movimentação registrada");
    },
    onError: () => showError("Erro ao registrar movimentação"),
  });
}
```

**Step 3: Create useInventario**

```typescript
// src/domains/estoque/hooks/useInventario.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { estoqueService } from "../services/estoqueService";
import { showSuccess, showError } from "@/utils/toast";

export function useInventarios() {
  return useQuery({
    queryKey: ["inventarios"],
    queryFn: () => estoqueService.listarInventarios(),
  });
}

export function useInventario(id: string) {
  return useQuery({
    queryKey: ["inventario", id],
    queryFn: () => estoqueService.buscarInventario(id),
    enabled: !!id,
  });
}

export function useCriarInventario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: estoqueService.criarInventario,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventarios"] });
      showSuccess("Inventário criado com saldos atuais");
    },
    onError: () => showError("Erro ao criar inventário"),
  });
}

export function useAtualizarItemInventario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quantidade_contada, justificativa }: { id: string; quantidade_contada: number; justificativa?: string }) =>
      estoqueService.atualizarItemInventario(id, quantidade_contada, justificativa),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventario"] });
      showSuccess("Contagem atualizada");
    },
    onError: () => showError("Erro ao atualizar contagem"),
  });
}

export function useFinalizarInventario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: estoqueService.finalizarInventario,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventarios"] });
      qc.invalidateQueries({ queryKey: ["inventario"] });
      showSuccess("Inventário finalizado");
    },
    onError: () => showError("Erro ao finalizar inventário"),
  });
}
```

**Step 4: Commit**

```bash
git add src/domains/estoque/hooks/
git commit -m "feat(estoque): add query hooks for saldos, movimentacoes, inventario"
```

---

## Task 7: Hooks — Qualidade

**Files:**
- Create: `src/domains/qualidade/hooks/useOcorrencias.ts`
- Create: `src/domains/qualidade/hooks/useTratativas.ts`
- Create: `src/domains/qualidade/hooks/useQualidadeKPIs.ts`

**Step 1: Create useOcorrencias**

```typescript
// src/domains/qualidade/hooks/useOcorrencias.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qualidadeService } from "../services/qualidadeService";
import { showSuccess, showError } from "@/utils/toast";

export function useOcorrencias(filtros?: { status?: string; prioridade?: string; tipo?: string }) {
  return useQuery({
    queryKey: ["ocorrencias", filtros],
    queryFn: () => qualidadeService.listarOcorrencias(filtros),
  });
}

export function useOcorrencia(id: string) {
  return useQuery({
    queryKey: ["ocorrencia", id],
    queryFn: () => qualidadeService.buscarOcorrencia(id),
    enabled: !!id,
  });
}

export function useCriarOcorrencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: qualidadeService.criarOcorrencia,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ocorrencias"] });
      showSuccess("Ocorrência registrada");
    },
    onError: () => showError("Erro ao registrar ocorrência"),
  });
}

export function useAtualizarOcorrencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: Record<string, any> }) =>
      qualidadeService.atualizarOcorrencia(id, dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ocorrencias"] });
      qc.invalidateQueries({ queryKey: ["ocorrencia"] });
      showSuccess("Ocorrência atualizada");
    },
    onError: () => showError("Erro ao atualizar ocorrência"),
  });
}
```

**Step 2: Create useTratativas**

```typescript
// src/domains/qualidade/hooks/useTratativas.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qualidadeService } from "../services/qualidadeService";
import { showSuccess, showError } from "@/utils/toast";

export function useAdicionarTratativa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: qualidadeService.adicionarTratativa,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ocorrencia"] });
      showSuccess("Tratativa adicionada");
    },
    onError: () => showError("Erro ao adicionar tratativa"),
  });
}
```

**Step 3: Create useQualidadeKPIs**

```typescript
// src/domains/qualidade/hooks/useQualidadeKPIs.ts

import { useQuery } from "@tanstack/react-query";
import { qualidadeService } from "../services/qualidadeService";

export function useQualidadeKPIs() {
  return useQuery({
    queryKey: ["qualidade-kpis"],
    queryFn: () => qualidadeService.buscarKPIs(),
    refetchInterval: 5 * 60 * 1000,
  });
}
```

**Step 4: Commit**

```bash
git add src/domains/qualidade/hooks/
git commit -m "feat(qualidade): add query hooks for ocorrencias, tratativas, KPIs"
```

---

## Task 8: Pages — Compras (3 pages, decompose monolith)

**Files:**
- Create: `src/domains/compras/pages/FornecedoresPage.tsx`
- Create: `src/domains/compras/pages/PedidosCompraPage.tsx`
- Create: `src/domains/compras/pages/PedidoCompraDetailPage.tsx`
- Create: `src/domains/compras/components/FornecedorForm.tsx`
- Create: `src/domains/compras/components/PedidoCompraForm.tsx`
- Create: `src/domains/compras/components/RecebimentoChecklist.tsx`
- Deprecate: `src/domains/compras/pages/ComprasPage.tsx` (manter temporariamente, redirect depois)

**Step 1: Create FornecedorForm component**

Extract the fornecedor form dialog from ComprasPage.tsx — use Dialog + form with fields: nome, cnpj, email, telefone, contato, endereco, cidade, estado, cep, observacoes, ativo. Use React Hook Form + Zod validation. Follow shadcn/ui pattern (Dialog, Input, Button, Label, Switch).

**Step 2: Create FornecedoresPage**

Page with: search input, "Novo Fornecedor" button, table with columns (nome, cnpj, telefone, email, ativo, ações). Uses `useFornecedores` hook. Opens `FornecedorForm` dialog for create/edit. Delete with confirmation.

**Step 3: Create PedidoCompraForm component**

Dialog for creating/editing pedido de compra. Fields: fornecedor (select), data_entrega, observacoes. Table de itens: material (select from materiais), quantidade, preco_unitario. Total calculado. Uses React Hook Form with dynamic array for itens.

**Step 4: Create PedidosCompraPage**

Page with: status filter tabs (todos/rascunho/pendente/aprovado/enviado/recebido), table with columns (numero, fornecedor, valor_total, status, data_entrega, ações). "Novo Pedido" button. Badge de status colorido.

**Step 5: Create RecebimentoChecklist component**

Checklist de conferência item a item. Cada item mostra: material, quantidade esperada, checkbox de conferência. Botão "Confirmar Recebimento" que chama `useAtualizarStatusPedido` com status='recebido' (trigger no banco faz o resto).

**Step 6: Create PedidoCompraDetailPage**

Page de detalhe: dados do pedido, fornecedor, itens, status. Botões de ação baseados no status atual (Aprovar, Enviar, Receber). Quando status='enviado', mostra RecebimentoChecklist. Link para conta a pagar se existir.

**Step 7: Run build**

Run: `pnpm build`
Expected: No errors

**Step 8: Commit**

```bash
git add src/domains/compras/
git commit -m "feat(compras): decompose monolith into pages and components"
```

---

## Task 9: Pages — Estoque (3 pages, decompose monolith)

**Files:**
- Create: `src/domains/estoque/pages/EstoqueDashboardPage.tsx` (rename from EstoquePage)
- Create: `src/domains/estoque/pages/MovimentacoesPage.tsx`
- Create: `src/domains/estoque/pages/InventarioPage.tsx`
- Create: `src/domains/estoque/components/SaldoCard.tsx`
- Create: `src/domains/estoque/components/AlertaEstoqueMinimo.tsx`
- Create: `src/domains/estoque/components/InventarioForm.tsx`
- Deprecate: `src/domains/estoque/pages/EstoquePage.tsx`

**Step 1: Create SaldoCard component**

Card showing: material name, quantidade atual, estoque mínimo, badge "Abaixo do mínimo" se quantidade < estoque_minimo, quantidade_reservada se > 0. Colors: green (ok), yellow (próximo do mínimo), red (abaixo).

**Step 2: Create AlertaEstoqueMinimo component**

Panel listing all materials below minimum stock. Each item: material name, current qty, minimum qty, difference. Link to create purchase order.

**Step 3: Create EstoqueDashboardPage**

Dashboard: 4 KPI cards (total materiais, abaixo do mínimo, entradas mês, saídas mês). Grid de SaldoCards. Search/filter. AlertaEstoqueMinimo panel. Botão "Ajuste Manual" para movimentação tipo='ajuste'.

**Step 4: Create MovimentacoesPage**

Table: data, material, tipo (badge colorido), quantidade, referência, observação. Filtros: tipo, material, período. Paginação.

**Step 5: Create InventarioForm component**

Table editable: material, quantidade sistema, input para quantidade contada, diferença calculada (highlight se != 0), campo justificativa. Botão "Finalizar Inventário".

**Step 6: Create InventarioPage**

Lista de inventários (data, status, responsável). Botão "Novo Inventário". Ao clicar em aberto, abre InventarioForm para contagem. Inventários finalizados são read-only.

**Step 7: Run build**

Run: `pnpm build`
Expected: No errors

**Step 8: Commit**

```bash
git add src/domains/estoque/
git commit -m "feat(estoque): decompose monolith into dashboard, movimentacoes, inventario"
```

---

## Task 10: Pages — Qualidade (3 pages, decompose monolith)

**Files:**
- Create: `src/domains/qualidade/pages/QualidadeDashboardPage.tsx`
- Create: `src/domains/qualidade/pages/OcorrenciaDetailPage.tsx`
- Create: `src/domains/qualidade/components/OcorrenciaForm.tsx`
- Create: `src/domains/qualidade/components/TratativaTimeline.tsx`
- Create: `src/domains/qualidade/components/QualidadeCharts.tsx`
- Modify: `src/domains/qualidade/pages/OcorrenciasPage.tsx` (simplify to list only)

**Step 1: Create OcorrenciaForm component**

Dialog: titulo, tipo (select), prioridade (select), descricao (textarea), vinculações opcionais: pedido (select), OP (select), fornecedor (select). Uses `useCriarOcorrencia`.

**Step 2: Create TratativaTimeline component**

Vertical timeline (como o pattern de atividades). Cada item: data, tipo (badge), descrição, responsável. Formulário inline para adicionar nova tratativa.

**Step 3: Create QualidadeCharts component**

2 Recharts: BarChart (ocorrências por tipo), PieChart (por prioridade). Uses `useQualidadeKPIs` data.

**Step 4: Create QualidadeDashboardPage**

4 KPI cards (total, abertas, resolvidas mês, MTTR). QualidadeCharts abaixo. Lista de ocorrências recentes (últimas 5).

**Step 5: Simplify OcorrenciasPage to list-only**

Remove all inline forms/dialogs. Table: titulo, tipo, prioridade (badge), status (badge), data, responsável, ações. Filtros por status/prioridade/tipo. "Nova Ocorrência" abre OcorrenciaForm. Clique na linha navega para detalhe.

**Step 6: Create OcorrenciaDetailPage**

Header: titulo, status, prioridade, tipo. Infos: pedido vinculado, OP vinculada, fornecedor. Botões de mudança de status. TratativaTimeline abaixo.

**Step 7: Run build**

Run: `pnpm build`
Expected: No errors

**Step 8: Commit**

```bash
git add src/domains/qualidade/
git commit -m "feat(qualidade): decompose monolith into dashboard, detail, components"
```

---

## Task 11: Rotas e Navegação

**Files:**
- Create: `src/routes/suprimentosRoutes.tsx`
- Create: `src/routes/qualidadeRoutes.tsx`
- Modify: `src/routes/operacionalRoutes.tsx` — remover rotas de /estoque, /compras, /ocorrencias
- Modify: `src/shared/constants/navigation.ts` — expandir grupos SUPRIMENTOS e QUALIDADE

**Step 1: Create suprimentosRoutes.tsx**

```typescript
// src/routes/suprimentosRoutes.tsx
import React from "react";
import LazyPage from "@/components/LazyPage";
import { Navigate } from "react-router-dom";

const FornecedoresPage = React.lazy(() => import("@/domains/compras/pages/FornecedoresPage"));
const PedidosCompraPage = React.lazy(() => import("@/domains/compras/pages/PedidosCompraPage"));
const PedidoCompraDetailPage = React.lazy(() => import("@/domains/compras/pages/PedidoCompraDetailPage"));
const EstoqueDashboardPage = React.lazy(() => import("@/domains/estoque/pages/EstoqueDashboardPage"));
const MovimentacoesPage = React.lazy(() => import("@/domains/estoque/pages/MovimentacoesPage"));
const InventarioPage = React.lazy(() => import("@/domains/estoque/pages/InventarioPage"));

export const suprimentosRoutes = [
  // Redirects (URLs antigas)
  { path: "/compras", element: <Navigate to="/compras/fornecedores" replace /> },

  // Compras
  { path: "/compras/fornecedores", element: <LazyPage><FornecedoresPage /></LazyPage> },
  { path: "/compras/pedidos", element: <LazyPage><PedidosCompraPage /></LazyPage> },
  { path: "/compras/pedidos/:id", element: <LazyPage><PedidoCompraDetailPage /></LazyPage> },

  // Estoque
  { path: "/estoque", element: <LazyPage><EstoqueDashboardPage /></LazyPage> },
  { path: "/estoque/movimentacoes", element: <LazyPage><MovimentacoesPage /></LazyPage> },
  { path: "/estoque/inventario", element: <LazyPage><InventarioPage /></LazyPage> },
];
```

**Step 2: Create qualidadeRoutes.tsx**

```typescript
// src/routes/qualidadeRoutes.tsx
import React from "react";
import LazyPage from "@/components/LazyPage";
import { Navigate } from "react-router-dom";

const QualidadeDashboardPage = React.lazy(() => import("@/domains/qualidade/pages/QualidadeDashboardPage"));
const OcorrenciasPage = React.lazy(() => import("@/domains/qualidade/pages/OcorrenciasPage"));
const OcorrenciaDetailPage = React.lazy(() => import("@/domains/qualidade/pages/OcorrenciaDetailPage"));

export const qualidadeRoutes = [
  // Redirect (URL antiga)
  { path: "/ocorrencias", element: <Navigate to="/qualidade/ocorrencias" replace /> },

  { path: "/qualidade", element: <LazyPage><QualidadeDashboardPage /></LazyPage> },
  { path: "/qualidade/ocorrencias", element: <LazyPage><OcorrenciasPage /></LazyPage> },
  { path: "/qualidade/ocorrencias/:id", element: <LazyPage><OcorrenciaDetailPage /></LazyPage> },
];
```

**Step 3: Remove old routes from operacionalRoutes.tsx**

Remove the `/estoque`, `/compras`, `/ocorrencias` route entries. Keep all other routes (/pedidos, /producao, /expedicao, etc.).

**Step 4: Register new route files in App.tsx or router config**

Import `suprimentosRoutes` and `qualidadeRoutes` and spread them into the route array alongside the other route files.

**Step 5: Update navigation.ts**

```typescript
// SUPRIMENTOS group — expand with sub-items
{
  label: 'SUPRIMENTOS',
  items: [
    { name: 'Fornecedores',       path: '/compras/fornecedores', icon: 'Users',       module: 'compras' },
    { name: 'Pedidos de Compra',   path: '/compras/pedidos',      icon: 'ShoppingCart', module: 'compras' },
    { name: 'Estoque',             path: '/estoque',              icon: 'Warehouse',   module: 'estoque' },
    { name: 'Movimentações',       path: '/estoque/movimentacoes', icon: 'ArrowLeftRight', module: 'estoque' },
    { name: 'Inventário',          path: '/estoque/inventario',   icon: 'ClipboardList', module: 'estoque' },
    { name: 'Produtos',            path: '/produtos',             icon: 'Package',     module: 'producao' },
    { name: 'Matéria Prima',       path: '/admin/materiais',      icon: 'Package',     module: 'admin' },
  ],
},

// QUALIDADE group — expand with sub-items
{
  label: 'QUALIDADE',
  items: [
    { name: 'Dashboard',     path: '/qualidade',              icon: 'BarChart3',     module: 'qualidade' },
    { name: 'Ocorrências',   path: '/qualidade/ocorrencias',  icon: 'AlertTriangle', module: 'qualidade' },
  ],
},
```

**Step 6: Run build**

Run: `pnpm build`
Expected: No errors

**Step 7: Commit**

```bash
git add src/routes/ src/shared/constants/navigation.ts
git commit -m "feat(routes): add suprimentos and qualidade route files, update navigation"
```

---

## Task 12: Botão "Abrir Ocorrência" — Integração cross-module

**Files:**
- Create: `src/shared/components/AbrirOcorrenciaButton.tsx`
- Modify: páginas de Pedido, Produção e Recebimento — adicionar o botão

**Step 1: Create shared button component**

```typescript
// src/shared/components/AbrirOcorrenciaButton.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { OcorrenciaForm } from "@/domains/qualidade/components/OcorrenciaForm";

interface Props {
  pedido_id?: string;
  ordem_producao_id?: string;
  fornecedor_id?: string;
}

export function AbrirOcorrenciaButton({ pedido_id, ordem_producao_id, fornecedor_id }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <AlertTriangle className="w-4 h-4 mr-1" /> Abrir Ocorrência
      </Button>
      <OcorrenciaForm
        open={open}
        onClose={() => setOpen(false)}
        defaults={{ pedido_id, ordem_producao_id, fornecedor_id }}
      />
    </>
  );
}
```

**Step 2: Add to PedidoDetailPage, ProducaoPage, PedidoCompraDetailPage**

Add `<AbrirOcorrenciaButton pedido_id={pedido.id} />` in the actions area of each page.

**Step 3: Commit**

```bash
git add src/shared/components/AbrirOcorrenciaButton.tsx
git commit -m "feat(qualidade): add cross-module 'Abrir Ocorrencia' button"
```

---

## Task 13: Testes — Services

**Files:**
- Create: `src/domains/compras/services/__tests__/comprasService.test.ts`
- Create: `src/domains/estoque/services/__tests__/estoqueService.test.ts`
- Create: `src/domains/qualidade/services/__tests__/qualidadeService.test.ts`

**Step 1: Write tests for each service**

Test patterns: mock `supabase.from().select()...` chain. Verify correct table names, filters, error handling.

Existing test reference: `src/domains/comercial/services/__tests__/orcamento-conversion.test.ts`

**Step 2: Run tests**

Run: `pnpm test`
Expected: All pass (existing 102 + new tests)

**Step 3: Commit**

```bash
git add src/domains/*/services/__tests__/
git commit -m "test: add service tests for compras, estoque, qualidade"
```

---

## Task 14: Cleanup e Build Final

**Files:**
- Delete or redirect: `src/domains/compras/pages/ComprasPage.tsx` (old monolith)
- Delete or redirect: `src/domains/estoque/pages/EstoquePage.tsx` (old monolith)
- Keep: `src/domains/qualidade/pages/OcorrenciasPage.tsx` (refactored, not deleted)

**Step 1: Verify no imports reference old page files**

Run: grep for `ComprasPage`, `EstoquePage` across codebase. Update any remaining references.

**Step 2: Run full build**

Run: `pnpm build`
Expected: 0 errors, chunks split correctly

**Step 3: Run tests**

Run: `pnpm test`
Expected: All pass

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: cleanup old monolith files, final build verification"
```

---

## Summary

| Task | Módulo | Escopo |
|------|--------|--------|
| 1 | DB | Migration 031 — tabelas, triggers, RLS |
| 2 | Compras | Service + types |
| 3 | Estoque | Service + types |
| 4 | Qualidade | Service + types |
| 5 | Compras | Hooks (TanStack Query) |
| 6 | Estoque | Hooks (TanStack Query) |
| 7 | Qualidade | Hooks (TanStack Query) |
| 8 | Compras | Pages + components (decompose monolith) |
| 9 | Estoque | Pages + components (decompose monolith) |
| 10 | Qualidade | Pages + components (decompose monolith) |
| 11 | Routing | Rotas + navegação + redirects |
| 12 | Cross | Botão "Abrir Ocorrência" shared |
| 13 | Tests | Service tests |
| 14 | Cleanup | Remove monoliths, build final |

**Dependências entre tasks:**
- Tasks 2-4 (services) são independentes → paralelo
- Tasks 5-7 (hooks) dependem de 2-4 → paralelo entre si
- Tasks 8-10 (pages) dependem de 5-7 → paralelo entre si
- Task 11 (rotas) depende de 8-10
- Task 12 depende de 10 (OcorrenciaForm)
- Task 13 depende de 2-4
- Task 14 depende de tudo
