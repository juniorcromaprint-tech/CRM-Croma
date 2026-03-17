# Sprint 4: Motor Financeiro — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transformar o módulo financeiro de decorativo em operacional — fluxo de caixa projetado, aging de recebíveis, DRE com dados reais, badge de inadimplência, e UI de retorno bancário.

**Architecture:** Views computadas no Postgres para fluxo de caixa e aging (zero stored state). DRE calcula CME real via custo de materiais dos pedidos. Inadimplência = query no cliente com CR vencido. Retorno bancário usa parser CNAB 400 existente + nova UI de upload/preview.

**Tech Stack:** React 19, TypeScript, TanStack Query v5, Recharts, shadcn/ui, Supabase Postgres, Vitest

**Spec de referência:** `docs/superpowers/specs/2026-03-17-erp-5-sprints-design.md` seção 6

---

## Estado Atual (pré-Sprint 4)

### Já existe ✅
- `contas_receber` / `contas_pagar` — tabelas + CRUD + hooks + KPIs
- `comissoes` — tabela + ComissoesPage completa
- `plano_contas` / `centros_custo` — tabelas + hierarquia
- `gerarContasReceber()` — trigger cria CR ao aprovar pedido
- `gerarParcelas()` — service gera parcelas por forma de pagamento
- `DrePage` — existe mas com percentuais hardcoded (45/25/30%)
- `FinanceiroPage` — CR/CP list com KPIs + dialog de baixa
- Parser CNAB 400 retorno — `cnab400-retorno.service.ts` + `retorno-processor.service.ts` + testes
- `BoletosPage` com aba "Retornos" vazia
- `DashboardFinanceiro` — dashboard com contas a vencer / vencidos

### Falta construir ❌
- **Migration**: `parcelas_receber` não existe no schema (service insere mas tabela pode não existir)
- **View**: `v_fluxo_caixa_projetado` (CR + CP por dia, saldo acumulado)
- **View**: `v_aging_receber` (buckets 0-30, 31-60, 61-90, 90+)
- **View**: `v_inadimplentes` (clientes com CR vencido > X dias)
- **Page**: FluxoCaixaPage com CashFlowChart
- **Component**: AgingTable
- **Component**: CreditBlockBanner (inadimplência)
- **Refactor**: DrePage com dados reais (CME = custo materiais dos pedidos)
- **UI**: RetornoUploadPage (upload .RET → preview → processar)

---

## Bloco A — Schema (Migrations + Views)

### Task A1: Migration parcelas_receber + view v_aging_receber

**Files:**
- Create: `supabase/migrations/064_parcelas_receber.sql`

**O que faz:**
1. Cria tabela `parcelas_receber` (id, conta_receber_id FK, numero, valor, data_vencimento, data_pagamento, valor_pago, status, created_at, updated_at)
2. Cria view `v_aging_receber` — agrupa CR não-pagas por bucket de atraso:
   - `a_vencer` (vencimento futuro)
   - `1_30` (1-30 dias vencido)
   - `31_60`
   - `61_90`
   - `90_mais`
3. Cria view `v_inadimplentes` — clientes com pelo menos 1 CR vencida há >30 dias
4. RLS em parcelas_receber
5. Índices: `parcelas_receber(conta_receber_id)`, `contas_receber(data_vencimento, status)`

**SQL:**
```sql
-- =============================================
-- 064: parcelas_receber + views financeiras
-- =============================================

-- 1. Tabela parcelas_receber
CREATE TABLE IF NOT EXISTS parcelas_receber (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_receber_id UUID NOT NULL REFERENCES contas_receber(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  valor_pago NUMERIC(12,2) DEFAULT 0,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','parcial','pago','cancelado')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcelas_receber_conta ON parcelas_receber(conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_receber_vencimento ON parcelas_receber(data_vencimento, status);

-- Trigger updated_at
CREATE TRIGGER tr_parcelas_receber_updated
  BEFORE UPDATE ON parcelas_receber
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE parcelas_receber ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parcelas_receber_select"
  ON parcelas_receber FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "parcelas_receber_insert"
  ON parcelas_receber FOR INSERT TO authenticated
  WITH CHECK (
    is_admin() OR get_user_role() IN ('financeiro','gerente','comercial')
  );

CREATE POLICY "parcelas_receber_update"
  ON parcelas_receber FOR UPDATE TO authenticated
  USING (
    is_admin() OR get_user_role() IN ('financeiro','gerente')
  );

-- 2. View: Aging de Recebíveis
CREATE OR REPLACE VIEW v_aging_receber AS
WITH cr_abertas AS (
  SELECT
    id,
    cliente_id,
    valor_original,
    valor_pago,
    saldo,
    data_vencimento,
    CURRENT_DATE - data_vencimento AS dias_atraso
  FROM contas_receber
  WHERE status NOT IN ('pago','cancelado')
    AND excluido_em IS NULL
)
SELECT
  cliente_id,
  SUM(CASE WHEN dias_atraso <= 0 THEN saldo ELSE 0 END) AS a_vencer,
  SUM(CASE WHEN dias_atraso BETWEEN 1 AND 30 THEN saldo ELSE 0 END) AS d1_30,
  SUM(CASE WHEN dias_atraso BETWEEN 31 AND 60 THEN saldo ELSE 0 END) AS d31_60,
  SUM(CASE WHEN dias_atraso BETWEEN 61 AND 90 THEN saldo ELSE 0 END) AS d61_90,
  SUM(CASE WHEN dias_atraso > 90 THEN saldo ELSE 0 END) AS d90_mais,
  SUM(saldo) AS total_aberto,
  MAX(dias_atraso) AS maior_atraso
FROM cr_abertas
GROUP BY cliente_id;

-- 3. View: Inadimplentes (>30 dias vencido)
CREATE OR REPLACE VIEW v_inadimplentes AS
SELECT DISTINCT
  c.id AS cliente_id,
  c.nome_fantasia,
  c.razao_social,
  ag.total_aberto,
  ag.maior_atraso,
  ag.d1_30 + ag.d31_60 + ag.d61_90 + ag.d90_mais AS total_vencido
FROM v_aging_receber ag
JOIN clientes c ON c.id = ag.cliente_id
WHERE ag.maior_atraso > 30;

-- 4. View: Fluxo de Caixa Projetado (próximos 180 dias)
CREATE OR REPLACE VIEW v_fluxo_caixa_projetado AS
WITH entradas AS (
  SELECT
    data_vencimento AS data,
    SUM(saldo) AS valor,
    'entrada' AS tipo
  FROM contas_receber
  WHERE status NOT IN ('pago','cancelado')
    AND excluido_em IS NULL
    AND data_vencimento >= CURRENT_DATE
  GROUP BY data_vencimento
),
saidas AS (
  SELECT
    data_vencimento AS data,
    SUM(saldo) AS valor,
    'saida' AS tipo
  FROM contas_pagar
  WHERE status NOT IN ('pago','cancelado')
    AND excluido_em IS NULL
    AND data_vencimento >= CURRENT_DATE
  GROUP BY data_vencimento
)
SELECT * FROM entradas
UNION ALL
SELECT * FROM saidas
ORDER BY data, tipo;

-- 5. Índice para performance das views
CREATE INDEX IF NOT EXISTS idx_cr_vencimento_status
  ON contas_receber(data_vencimento, status)
  WHERE excluido_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_cp_vencimento_status
  ON contas_pagar(data_vencimento, status)
  WHERE excluido_em IS NULL;
```

**Aplicar via:** Supabase MCP `apply_migration` ou SQL Editor

**Commit:** `feat(schema): migration 064 — parcelas_receber + views aging/fluxo_caixa/inadimplentes`

---

## Bloco B — Types + Services + Hooks

### Task B1: Types financeiro-motor

**Files:**
- Create: `src/domains/financeiro/types/motor-financeiro.types.ts`

```typescript
// =============================================
// Motor Financeiro — Types
// =============================================

export interface ParcelaReceber {
  id: string;
  conta_receber_id: string;
  numero: number;
  valor: number;
  valor_pago: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: 'pendente' | 'parcial' | 'pago' | 'cancelado';
  created_at: string;
}

export interface AgingBucket {
  cliente_id: string;
  a_vencer: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90_mais: number;
  total_aberto: number;
  maior_atraso: number;
}

export interface AgingComCliente extends AgingBucket {
  nome_fantasia: string;
  razao_social: string | null;
}

export interface Inadimplente {
  cliente_id: string;
  nome_fantasia: string;
  razao_social: string | null;
  total_aberto: number;
  maior_atraso: number;
  total_vencido: number;
}

export interface FluxoCaixaDia {
  data: string;
  valor: number;
  tipo: 'entrada' | 'saida';
}

export interface FluxoCaixaAcumulado {
  data: string;
  entradas: number;
  saidas: number;
  saldo_dia: number;
  saldo_acumulado: number;
}

export interface AgingResumo {
  a_vencer: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90_mais: number;
  total: number;
}

export interface DREReal {
  periodo: string;
  receita_bruta: number;
  deducoes: number;
  receita_liquida: number;
  cme: number; // Custo de Materiais e Equipamentos (real, dos pedidos)
  lucro_bruto: number;
  despesas_comerciais: number;
  despesas_administrativas: number;
  despesas_pessoal: number;
  ebitda: number;
  margem_bruta_pct: number;
  margem_ebitda_pct: number;
}
```

**Commit:** `feat(types): motor-financeiro types — Aging, FluxoCaixa, DRE, Inadimplente`

---

### Task B2: Services fluxo-caixa + aging + dre-real

**Files:**
- Create: `src/domains/financeiro/services/fluxo-caixa.service.ts`
- Create: `src/domains/financeiro/services/aging.service.ts`
- Create: `src/domains/financeiro/services/dre-real.service.ts`
- Create: `src/domains/financeiro/services/inadimplencia.service.ts`

#### fluxo-caixa.service.ts
```typescript
import { supabase } from '@/integrations/supabase/client';
import type { FluxoCaixaDia, FluxoCaixaAcumulado } from '../types/motor-financeiro.types';

/**
 * Busca projeção de fluxo de caixa da view v_fluxo_caixa_projetado
 * e calcula saldo acumulado no frontend.
 */
export async function listarFluxoCaixaProjetado(
  dias: number = 90
): Promise<FluxoCaixaAcumulado[]> {
  const limite = new Date();
  limite.setDate(limite.getDate() + dias);

  const { data, error } = await supabase
    .from('v_fluxo_caixa_projetado' as any)
    .select('data, valor, tipo')
    .lte('data', limite.toISOString().split('T')[0])
    .order('data');

  if (error) throw new Error(`Erro ao buscar fluxo de caixa: ${error.message}`);

  const raw = (data ?? []) as FluxoCaixaDia[];
  return calcularAcumulado(raw);
}

export function calcularAcumulado(items: FluxoCaixaDia[]): FluxoCaixaAcumulado[] {
  const porDia = new Map<string, { entradas: number; saidas: number }>();

  for (const item of items) {
    const existing = porDia.get(item.data) ?? { entradas: 0, saidas: 0 };
    if (item.tipo === 'entrada') {
      existing.entradas += Number(item.valor);
    } else {
      existing.saidas += Number(item.valor);
    }
    porDia.set(item.data, existing);
  }

  const result: FluxoCaixaAcumulado[] = [];
  let acumulado = 0;

  const sortedDates = [...porDia.keys()].sort();
  for (const data of sortedDates) {
    const { entradas, saidas } = porDia.get(data)!;
    const saldo_dia = entradas - saidas;
    acumulado += saldo_dia;
    result.push({ data, entradas, saidas, saldo_dia, saldo_acumulado: acumulado });
  }

  return result;
}

/**
 * Busca saldo realizado: total pago em CR - total pago em CP
 */
export async function saldoRealizado(): Promise<number> {
  const [{ data: cr }, { data: cp }] = await Promise.all([
    supabase.from('contas_receber').select('valor_pago').eq('status', 'pago').is('excluido_em', null),
    supabase.from('contas_pagar').select('valor_pago').eq('status', 'pago').is('excluido_em', null),
  ]);

  const totalCR = (cr ?? []).reduce((s, r) => s + Number(r.valor_pago ?? 0), 0);
  const totalCP = (cp ?? []).reduce((s, r) => s + Number(r.valor_pago ?? 0), 0);
  return totalCR - totalCP;
}
```

#### aging.service.ts
```typescript
import { supabase } from '@/integrations/supabase/client';
import type { AgingComCliente, AgingResumo } from '../types/motor-financeiro.types';

/**
 * Busca aging por cliente da view v_aging_receber + join com clientes
 */
export async function listarAgingPorCliente(): Promise<AgingComCliente[]> {
  const { data, error } = await supabase
    .from('v_aging_receber' as any)
    .select('*');

  if (error) throw new Error(`Erro ao buscar aging: ${error.message}`);
  if (!data || data.length === 0) return [];

  // Buscar nomes dos clientes
  const clienteIds = data.map((d: any) => d.cliente_id);
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nome_fantasia, razao_social')
    .in('id', clienteIds);

  const clienteMap = new Map((clientes ?? []).map(c => [c.id, c]));

  return data.map((row: any) => {
    const cliente = clienteMap.get(row.cliente_id);
    return {
      ...row,
      nome_fantasia: cliente?.nome_fantasia ?? 'Desconhecido',
      razao_social: cliente?.razao_social ?? null,
    } as AgingComCliente;
  });
}

/**
 * Calcula totais agregados por bucket
 */
export function calcularResumoAging(items: AgingComCliente[]): AgingResumo {
  return items.reduce(
    (acc, item) => ({
      a_vencer: acc.a_vencer + Number(item.a_vencer),
      d1_30: acc.d1_30 + Number(item.d1_30),
      d31_60: acc.d31_60 + Number(item.d31_60),
      d61_90: acc.d61_90 + Number(item.d61_90),
      d90_mais: acc.d90_mais + Number(item.d90_mais),
      total: acc.total + Number(item.total_aberto),
    }),
    { a_vencer: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_mais: 0, total: 0 },
  );
}
```

#### dre-real.service.ts
```typescript
import { supabase } from '@/integrations/supabase/client';
import type { DREReal } from '../types/motor-financeiro.types';

/**
 * Calcula DRE com dados REAIS:
 * - Receita = soma de CR pagas no período
 * - CME = soma de custo_materiais dos pedidos pagos (via pedido_itens.custo_total)
 * - Despesas = soma de CP pagas por categoria
 */
export async function calcularDRE(
  dataInicio: string,
  dataFim: string
): Promise<DREReal> {
  // 1. Receita bruta: CR pagas no período
  const { data: crPagas } = await supabase
    .from('contas_receber')
    .select('valor_pago')
    .eq('status', 'pago')
    .gte('data_pagamento', dataInicio)
    .lte('data_pagamento', dataFim)
    .is('excluido_em', null);

  const receita_bruta = (crPagas ?? []).reduce((s, r) => s + Number(r.valor_pago ?? 0), 0);

  // 2. CME: custo real dos pedidos faturados no período
  // Busca pedidos que tiveram CR paga neste período
  const { data: pedidosPagos } = await supabase
    .from('contas_receber')
    .select('pedido_id')
    .eq('status', 'pago')
    .gte('data_pagamento', dataInicio)
    .lte('data_pagamento', dataFim)
    .is('excluido_em', null)
    .not('pedido_id', 'is', null);

  let cme = 0;
  if (pedidosPagos && pedidosPagos.length > 0) {
    const pedidoIds = [...new Set(pedidosPagos.map(p => p.pedido_id).filter(Boolean))];
    if (pedidoIds.length > 0) {
      const { data: itens } = await supabase
        .from('pedido_itens')
        .select('custo_total')
        .in('pedido_id', pedidoIds);
      cme = (itens ?? []).reduce((s, i) => s + Number((i as any).custo_total ?? 0), 0);
    }
  }

  // 3. Despesas: CP pagas por categoria
  const { data: cpPagas } = await supabase
    .from('contas_pagar')
    .select('valor_pago, categoria')
    .eq('status', 'pago')
    .gte('data_pagamento', dataInicio)
    .lte('data_pagamento', dataFim)
    .is('excluido_em', null);

  let despesas_comerciais = 0;
  let despesas_administrativas = 0;
  let despesas_pessoal = 0;

  for (const cp of cpPagas ?? []) {
    const val = Number(cp.valor_pago ?? 0);
    const cat = (cp.categoria ?? '').toLowerCase();
    if (cat.includes('comercial') || cat.includes('venda') || cat.includes('marketing')) {
      despesas_comerciais += val;
    } else if (cat.includes('pessoal') || cat.includes('folha') || cat.includes('salario')) {
      despesas_pessoal += val;
    } else {
      despesas_administrativas += val;
    }
  }

  // 4. Cálculos
  const deducoes = 0; // Impostos sobre receita — calcular no Sprint 5
  const receita_liquida = receita_bruta - deducoes;
  const lucro_bruto = receita_liquida - cme;
  const totalDespesas = despesas_comerciais + despesas_administrativas + despesas_pessoal;
  const ebitda = lucro_bruto - totalDespesas;

  return {
    periodo: `${dataInicio} a ${dataFim}`,
    receita_bruta,
    deducoes,
    receita_liquida,
    cme,
    lucro_bruto,
    despesas_comerciais,
    despesas_administrativas,
    despesas_pessoal,
    ebitda,
    margem_bruta_pct: receita_bruta > 0 ? (lucro_bruto / receita_bruta) * 100 : 0,
    margem_ebitda_pct: receita_bruta > 0 ? (ebitda / receita_bruta) * 100 : 0,
  };
}
```

#### inadimplencia.service.ts
```typescript
import { supabase } from '@/integrations/supabase/client';
import type { Inadimplente } from '../types/motor-financeiro.types';

/**
 * Lista clientes inadimplentes (>30 dias de atraso)
 */
export async function listarInadimplentes(): Promise<Inadimplente[]> {
  const { data, error } = await supabase
    .from('v_inadimplentes' as any)
    .select('*')
    .order('total_vencido', { ascending: false });

  if (error) throw new Error(`Erro ao buscar inadimplentes: ${error.message}`);
  return (data ?? []) as Inadimplente[];
}

/**
 * Verifica se um cliente específico é inadimplente
 */
export async function clienteInadimplente(clienteId: string): Promise<boolean> {
  const { data } = await supabase
    .from('v_inadimplentes' as any)
    .select('cliente_id')
    .eq('cliente_id', clienteId)
    .limit(1);

  return (data?.length ?? 0) > 0;
}
```

**Commit:** `feat(services): fluxo-caixa, aging, dre-real, inadimplencia services`

---

### Task B3: Hooks TanStack Query

**Files:**
- Create: `src/domains/financeiro/hooks/useMotorFinanceiro.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { listarFluxoCaixaProjetado, saldoRealizado } from '../services/fluxo-caixa.service';
import { listarAgingPorCliente, calcularResumoAging } from '../services/aging.service';
import { calcularDRE } from '../services/dre-real.service';
import { listarInadimplentes, clienteInadimplente } from '../services/inadimplencia.service';

export const MOTOR_FIN_KEYS = {
  fluxoCaixa: (dias: number) => ['motor-fin', 'fluxo-caixa', dias] as const,
  saldoRealizado: ['motor-fin', 'saldo-realizado'] as const,
  aging: ['motor-fin', 'aging'] as const,
  agingResumo: ['motor-fin', 'aging-resumo'] as const,
  dre: (inicio: string, fim: string) => ['motor-fin', 'dre', inicio, fim] as const,
  inadimplentes: ['motor-fin', 'inadimplentes'] as const,
  clienteInadimplente: (id: string) => ['motor-fin', 'inadimplente', id] as const,
};

export function useFluxoCaixa(dias = 90) {
  return useQuery({
    queryKey: MOTOR_FIN_KEYS.fluxoCaixa(dias),
    queryFn: () => listarFluxoCaixaProjetado(dias),
    staleTime: 5 * 60_000,
  });
}

export function useSaldoRealizado() {
  return useQuery({
    queryKey: MOTOR_FIN_KEYS.saldoRealizado,
    queryFn: saldoRealizado,
    staleTime: 5 * 60_000,
  });
}

export function useAging() {
  return useQuery({
    queryKey: MOTOR_FIN_KEYS.aging,
    queryFn: listarAgingPorCliente,
    staleTime: 5 * 60_000,
  });
}

export function useAgingResumo() {
  const { data: aging } = useAging();
  return useQuery({
    queryKey: MOTOR_FIN_KEYS.agingResumo,
    queryFn: () => calcularResumoAging(aging ?? []),
    enabled: !!aging,
  });
}

export function useDREReal(dataInicio: string, dataFim: string) {
  return useQuery({
    queryKey: MOTOR_FIN_KEYS.dre(dataInicio, dataFim),
    queryFn: () => calcularDRE(dataInicio, dataFim),
    enabled: !!dataInicio && !!dataFim,
    staleTime: 10 * 60_000,
  });
}

export function useInadimplentes() {
  return useQuery({
    queryKey: MOTOR_FIN_KEYS.inadimplentes,
    queryFn: listarInadimplentes,
    staleTime: 5 * 60_000,
  });
}

export function useClienteInadimplente(clienteId: string | undefined) {
  return useQuery({
    queryKey: MOTOR_FIN_KEYS.clienteInadimplente(clienteId ?? ''),
    queryFn: () => clienteInadimplente(clienteId!),
    enabled: !!clienteId,
    staleTime: 60_000,
  });
}
```

**Commit:** `feat(hooks): useMotorFinanceiro — fluxoCaixa, aging, DRE, inadimplência`

---

## Bloco C — UI Components + Pages

### Task C1: CashFlowChart + AgingTable + CreditBlockBanner components

**Files:**
- Create: `src/domains/financeiro/components/CashFlowChart.tsx`
- Create: `src/domains/financeiro/components/AgingTable.tsx`
- Create: `src/shared/components/CreditBlockBanner.tsx`

#### CashFlowChart.tsx
- Recharts BarChart + LineChart compostas
- Barras verdes (entradas) + vermelhas (saídas)
- Linha azul (saldo acumulado)
- Zona vermelha quando saldo < 0
- Period selector: 30d / 90d / 180d
- Tooltip com formatação BRL

#### AgingTable.tsx
- Table com 6 colunas: Cliente | A vencer | 1-30 | 31-60 | 61-90 | 90+ | Total
- Cores gradient: verde → amarelo → laranja → vermelho → vermelho escuro
- Click no bucket filtra (optional)
- Summary row no topo com totais
- Collapse por cliente (se muitas linhas)

#### CreditBlockBanner.tsx
- Banner `bg-red-50 border-red-300 rounded-2xl p-4`
- Ícone ShieldAlert + "Cliente com títulos vencidos" + valor total + dias
- Aparece em: topo de orçamento, pedido, detalhes do cliente
- Recebe `clienteId` como prop, usa `useClienteInadimplente`
- Se não inadimplente, retorna null (nada renderizado)

**Commit:** `feat(ui): CashFlowChart + AgingTable + CreditBlockBanner components`

---

### Task C2: FluxoCaixaPage

**Files:**
- Create: `src/domains/financeiro/pages/FluxoCaixaPage.tsx`

**Layout:**
- 4 KPI cards no topo: Saldo Atual, Entradas Projetadas 30d, Saídas Projetadas 30d, Saldo Projetado 30d
- CashFlowChart full-width abaixo
- Tabela dia-a-dia abaixo do chart (data, entradas, saídas, saldo do dia, acumulado)
- Toggle de período: 30d | 90d | 180d
- Rota: `/financeiro/fluxo-caixa`

**Commit:** `feat(page): FluxoCaixaPage — projeção de fluxo de caixa`

---

### Task C3: Refactor DrePage com dados reais

**Files:**
- Modify: `src/domains/financeiro/pages/DrePage.tsx`

**O que muda:**
- Substituir os hardcoded 45/25/30% por chamada a `useDREReal(dataInicio, dataFim)`
- CME vem de `dre.cme` (custo real dos materiais dos pedidos pagos)
- Despesas vêm categorizadas da CP real
- Manter o layout existente (chart mensal, period selector)
- Se não tem dados reais, mostrar banner "Cadastre categorias nas Contas a Pagar para DRE preciso"

**Commit:** `feat(refactor): DrePage com DRE real — elimina percentuais hardcoded`

---

### Task C4: RetornoUploadPage (UI para retorno CNAB 400)

**Files:**
- Create: `src/domains/financeiro/pages/RetornoUploadPage.tsx`
- Create: `src/domains/financeiro/components/RetornoPreview.tsx`

**Layout:**
- Upload zone (drag & drop ou click) para arquivo .RET
- Preview: tabela com linhas do retorno (nosso_número, valor, ocorrência, data_credito)
- Stats: X liquidações, Y não encontrados, Z erros
- Botão "Processar Retorno" (disabled até upload)
- Após processar: resumo de baixas realizadas + lista de não-encontrados
- Integra com `parseRetornoFile()` de `cnab400-retorno.service.ts` e `processarRetorno()` de `retorno-processor.service.ts`
- Rota: `/financeiro/retornos`

**Commit:** `feat(page): RetornoUploadPage — upload + preview + processamento CNAB 400`

---

### Task C5: Routes + Navigation

**Files:**
- Modify: `src/routes/financeiroRoutes.tsx` (ou equivalente)
- Modify: `src/shared/constants/navigation.ts`

**Adicionar:**
- Lazy import `FluxoCaixaPage` → rota `/financeiro/fluxo-caixa`
- Lazy import `RetornoUploadPage` → rota `/financeiro/retornos`
- Nav items no grupo FINANCEIRO:
  - `{ name: 'Fluxo de Caixa', path: '/financeiro/fluxo-caixa', icon: 'TrendingUp', module: 'financeiro' }`
  - `{ name: 'Retornos Bancários', path: '/financeiro/retornos', icon: 'FileInput', module: 'financeiro' }`
- Adicionar `CreditBlockBanner` no topo de `OrcamentoEditor` e `PedidoDetail`

**Commit:** `feat(routes): FluxoCaixa + Retornos rotas + nav + CreditBlockBanner integration`

---

## Bloco D — Testes + QA

### Task D1: Testes unitários

**Files:**
- Create: `src/domains/financeiro/services/__tests__/fluxo-caixa.test.ts`
- Create: `src/domains/financeiro/services/__tests__/aging.test.ts`
- Create: `src/domains/financeiro/services/__tests__/dre-real.test.ts`

**Testes para `calcularAcumulado`** (lógica pura, sem Supabase):
- Retorna array vazio para input vazio
- Calcula saldo acumulado corretamente (3 dias, entradas + saidas)
- Ordena por data
- Agrupa múltiplas movimentações no mesmo dia

**Testes para `calcularResumoAging`** (lógica pura):
- Retorna zeros para array vazio
- Soma buckets corretamente
- Total = soma de todos os buckets

**Commit:** `test: testes unitários fluxo-caixa + aging + DRE`

---

### Task D2: TypeScript build check + merge

**Steps:**
1. `npx tsc --noEmit` — corrigir qualquer erro
2. `pnpm vitest run` — todos os testes passando
3. `git checkout main && git merge --no-ff` com mensagem do sprint
4. Cleanup worktree

**Commit (merge):** `feat: Sprint 4 Motor Financeiro — FluxoCaixa, Aging, DRE real, Inadimplência, Retorno CNAB UI`

---

## Dependências entre tasks

```
A1 (migration) ← não depende de nada
     ↓
B1 (types) ← depende de A1 (nomes das views)
     ↓
B2 (services) ← depende de B1
     ↓
B3 (hooks) ← depende de B2
     ↓
C1 (components) ← depende de B3
C2 (FluxoCaixaPage) ← depende de C1 + B3
C3 (DrePage refactor) ← depende de B3
C4 (RetornoUploadPage) ← depende de B3
C5 (routes + nav) ← depende de C2, C3, C4
     ↓
D1 (testes) ← depende de B2
D2 (build + merge) ← depende de tudo
```

**Paralelismo possível:**
- A1 sozinho
- B1 sozinho
- B2 sozinho (4 services em 1 subagent)
- B3 sozinho
- C1 + C2 + C3 + C4 em paralelo (4 subagents)
- C5 depois de C1-C4
- D1 ∥ D2
