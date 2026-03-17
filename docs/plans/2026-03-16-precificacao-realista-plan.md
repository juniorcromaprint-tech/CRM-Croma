# Precificação Realista — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix pricing engine to produce realistic quotes by fixing cache bug, adding machine costs, improving material yield defaults, supporting labor charges, and enforcing minimum price/m².

**Architecture:** 6 tasks that modify the pricing engine core, admin UI, DB schema (migration), and orçamento validation. Tasks 1-2 are quick bug fixes. Tasks 3-4 are DB + engine changes. Task 5 is a new admin page + route. Task 6 updates tests.

**Tech Stack:** React 19, TypeScript, Supabase (Postgres), TanStack Query v5, Vite, Vitest, shadcn/ui, Tailwind CSS

---

### Task 1: Fix Cache Bug — Query Key Mismatch

**The root cause:** `AdminPrecificacaoPage.tsx` uses queryKey `["config-precificacao"]` (hyphen) but `useOrcamentoPricing.ts` uses `["config_precificacao"]` (underscore). Invalidation after save never reaches the pricing hook.

**Files:**
- Modify: `src/domains/admin/pages/AdminPrecificacaoPage.tsx:326,452`
- Modify: `src/domains/admin/pages/AdminPrecificacaoPage.tsx:452` (add second invalidation)

**Step 1: Fix query key in AdminPrecificacaoPage**

In `src/domains/admin/pages/AdminPrecificacaoPage.tsx`, change the queryKey at line 326 from `["config-precificacao"]` to `["config_precificacao"]` to match the hook. Also ensure `onSuccess` at line 452 invalidates the same key.

```typescript
// Line 326: Change queryKey
const { data: config, isLoading: loadingConfig } = useQuery({
  queryKey: ["config_precificacao"],  // was "config-precificacao"
  // ...
});

// Line 452: onSuccess should also invalidate regras (used in pricing)
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["config_precificacao"] });
  queryClient.invalidateQueries({ queryKey: ["regras_precificacao"] });
  showSuccess("Parâmetros salvos com sucesso!");
},
```

**Step 2: Verify fix**

Run: `npx vitest run src/shared/services/__tests__/pricing-engine.test.ts`
Expected: All existing tests PASS (no behavior change in engine)

**Step 3: Commit**

```bash
git add src/domains/admin/pages/AdminPrecificacaoPage.tsx
git commit -m "fix(pricing): fix query key mismatch — config changes now apply immediately"
```

---

### Task 2: Update DEFAULT_PRICING_CONFIG + Fix Tests

**Files:**
- Modify: `src/shared/services/pricing-engine.ts:105-114`
- Modify: `src/shared/services/__tests__/pricing-engine.test.ts` (update expected values)

**Step 1: Update defaults in pricing-engine.ts**

```typescript
export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  faturamentoMedio: 30_000,
  custoOperacional: 24_850,
  custoProdutivo: 16_400,
  qtdFuncionarios: 3,
  horasMes: 176,
  percentualComissao: 5,
  percentualImpostos: 12,
  percentualJuros: 2,
};
```

**Step 2: Update test expectations**

The tests at lines 49-50, 68-69 use hardcoded expected values based on the old config. Update:

```typescript
// calcPercentualFixo test — new: ((24850 - 16400) * 100) / 30000 = 28.1667
it("retorna valor correto com config Croma padrão", () => {
  const p = calcPercentualFixo(CROMA_CONFIG);
  expect(p).toBeCloseTo(28.167, 2);
});

// calcCustoPorMinuto test — new: ((16400 / 3) / 176) / 60 = 0.5176
it("retorna valor correto com config Croma padrão", () => {
  const cm = calcCustoPorMinuto(CROMA_CONFIG);
  expect(cm).toBeCloseTo(0.5176, 3);
});
```

Also update the `custoMP` expected values at lines 95-96, 100 — these don't change (material costs are the same), so they should still pass. Only the config-derived values change.

**Step 3: Run tests**

Run: `npx vitest run src/shared/services/__tests__/pricing-engine.test.ts`
Expected: All PASS

**Step 4: Commit**

```bash
git add src/shared/services/pricing-engine.ts src/shared/services/__tests__/pricing-engine.test.ts
git commit -m "fix(pricing): update DEFAULT_PRICING_CONFIG to real company values"
```

---

### Task 3: Add Encargos + Aproveitamento + Machine Cost — Migration

**Files:**
- Create: `supabase/migrations/036_pricing_realista.sql`

**Step 1: Write migration SQL**

```sql
-- 036_pricing_realista.sql
-- Adds: percentual_encargos to config, aproveitamento_padrao to regras, maquinas table

-- 1. Add percentual_encargos to config_precificacao
ALTER TABLE config_precificacao
  ADD COLUMN IF NOT EXISTS percentual_encargos NUMERIC(5,2) DEFAULT 0;

-- 2. Add aproveitamento_padrao to regras_precificacao
ALTER TABLE regras_precificacao
  ADD COLUMN IF NOT EXISTS aproveitamento_padrao NUMERIC(5,2) DEFAULT 85;

-- Update existing regras with category-specific defaults
UPDATE regras_precificacao SET aproveitamento_padrao = 90 WHERE categoria IN ('banner', 'backdrop');
UPDATE regras_precificacao SET aproveitamento_padrao = 85 WHERE categoria IN ('adesivo', 'fachada', 'placa', 'painel', 'geral', 'pdv');
UPDATE regras_precificacao SET aproveitamento_padrao = 80 WHERE categoria IN ('letreiro', 'totem');
UPDATE regras_precificacao SET aproveitamento_padrao = 75 WHERE categoria = 'envelopamento';

-- 3. Create maquinas table
CREATE TABLE IF NOT EXISTS maquinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('impressao', 'corte', 'acabamento')),
  custo_hora NUMERIC(10,2) DEFAULT 0,
  custo_m2 NUMERIC(10,4) DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create orcamento_item_maquinas junction table
CREATE TABLE IF NOT EXISTS orcamento_item_maquinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_item_id UUID REFERENCES proposta_itens(id) ON DELETE CASCADE,
  maquina_id UUID REFERENCES maquinas(id) ON DELETE RESTRICT,
  tempo_minutos NUMERIC(10,2) DEFAULT 0,
  area_m2 NUMERIC(10,4) DEFAULT 0,
  custo_calculado NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oim_proposta_item ON orcamento_item_maquinas(proposta_item_id);
CREATE INDEX IF NOT EXISTS idx_oim_maquina ON orcamento_item_maquinas(maquina_id);

-- 5. Seed initial machines (Croma Print equipment)
INSERT INTO maquinas (nome, tipo, custo_hora, custo_m2) VALUES
  ('Impressora Solvente', 'impressao', 0, 0),
  ('HP Latex 365', 'impressao', 0, 0),
  ('Plotter de Recorte', 'corte', 0, 0),
  ('Router CNC', 'corte', 0, 0),
  ('Laminadora', 'acabamento', 0, 0),
  ('Solda Banner', 'acabamento', 0, 0);

-- 6. RLS for maquinas (authenticated can read, admin can write)
ALTER TABLE maquinas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maquinas_select" ON maquinas FOR SELECT TO authenticated USING (true);
CREATE POLICY "maquinas_all" ON maquinas FOR ALL TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'gerente')
  );

ALTER TABLE orcamento_item_maquinas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oim_select" ON orcamento_item_maquinas FOR SELECT TO authenticated USING (true);
CREATE POLICY "oim_all" ON orcamento_item_maquinas FOR ALL TO authenticated USING (true);

-- 7. Updated_at trigger for maquinas
CREATE OR REPLACE TRIGGER set_updated_at_maquinas
  BEFORE UPDATE ON maquinas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**Step 2: Execute migration on Supabase**

Go to `supabase.com/dashboard/project/djwjmfgplnqyffdcgdaw/sql` and run the migration.

**Step 3: Commit migration file**

```bash
git add supabase/migrations/036_pricing_realista.sql
git commit -m "feat(db): migration 036 — encargos, aproveitamento_padrao, maquinas table"
```

---

### Task 4: Update Pricing Engine + Services

**Files:**
- Modify: `src/shared/services/pricing-engine.ts` (add percentualEncargos to PricingConfig, update calc)
- Modify: `src/shared/services/orcamento-pricing.service.ts` (add machine cost input, aproveitamento fallback)
- Modify: `src/domains/comercial/hooks/useOrcamentoPricing.ts` (map new DB fields)
- Modify: `src/domains/comercial/hooks/useItemEditor.ts` (pass aproveitamento_padrao)
- Modify: `src/shared/services/__tests__/pricing-engine.test.ts` (add new tests)

**Step 1: Add percentualEncargos to PricingConfig**

In `src/shared/services/pricing-engine.ts`:

```typescript
export interface PricingConfig {
  // ... existing fields ...
  /** Percentual de encargos trabalhistas sobre custo produtivo */
  percentualEncargos: number;
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  faturamentoMedio: 30_000,
  custoOperacional: 24_850,
  custoProdutivo: 16_400,
  qtdFuncionarios: 3,
  horasMes: 176,
  percentualComissao: 5,
  percentualImpostos: 12,
  percentualJuros: 2,
  percentualEncargos: 0,
};
```

**Step 2: Update calcCustoPorMinuto to apply encargos**

```typescript
export function calcCustoPorMinuto(config: PricingConfig): number {
  const { custoProdutivo, qtdFuncionarios, horasMes, percentualEncargos } = config;
  if (qtdFuncionarios === 0 || horasMes === 0) return 0;

  // Apply encargos to productive cost
  const custoComEncargos = custoProdutivo * (1 + (percentualEncargos ?? 0) / 100);
  const custoPorFuncionario = custoComEncargos / qtdFuncionarios;
  const custoPorHora = custoPorFuncionario / horasMes;
  return custoPorHora / 60;
}
```

**Step 3: Add custoMaquinas to PricingInput and calcPricing**

In `src/shared/services/pricing-engine.ts`:

```typescript
export interface PricingInput {
  materiais: MaterialItem[];
  processos: ProcessoItem[];
  markupPercentual: number;
  /** Custo total de máquinas (já calculado externamente) */
  custoMaquinas?: number;
}
```

In `calcPricing`, after Step 2 (tempoTotal) and before Step 6:

```typescript
// Custo de máquinas (passado externamente, já calculado)
const custoMaquinas = input.custoMaquinas ?? 0;

// Step 6 — updated:
const custoBase = (custoMP + custoMO + custoMaquinas) * (1 + percentualFixo / 100);
```

Also update PricingResult to include `custoMaquinas` and `percMaquinas` in breakdown.

**Step 4: Update orcamento-pricing.service.ts**

Add `OrcamentoMaquina` type and machine cost calculation:

```typescript
export interface OrcamentoMaquina {
  maquina_id: string;
  nome: string;
  tipo: 'impressao' | 'corte' | 'acabamento';
  custo_hora: number;
  custo_m2: number;
  tempo_minutos?: number; // for hora-based machines
}

export interface OrcamentoItemInput {
  // ... existing fields ...
  maquinas?: OrcamentoMaquina[];
}
```

In `calcOrcamentoItem`, before calling `calcPricing`, compute machine costs:

```typescript
// Calculate machine costs
const areaM2 = calcAreaM2(item.largura_cm, item.altura_cm);
let custoMaquinas = 0;
for (const maq of (item.maquinas ?? [])) {
  if (maq.custo_m2 > 0 && areaM2 && areaM2 > 0) {
    custoMaquinas += areaM2 * maq.custo_m2;
  } else if (maq.custo_hora > 0 && maq.tempo_minutos) {
    custoMaquinas += (maq.tempo_minutos / 60) * maq.custo_hora;
  }
}

// Pass to motor
const pricingResult = calcPricing(
  { materiais: materiaisParaMotor, processos, markupPercentual: item.markup_percentual, custoMaquinas },
  config,
);
```

Also update `OrcamentoItemPricingResult` to include `custoMaquinas`.

**Step 5: Update aproveitamento fallback in orcamento-pricing.service.ts**

In `calcOrcamentoItem`, change the aproveitamento logic to accept a category-level default:

```typescript
export function calcOrcamentoItem(
  item: OrcamentoItemInput,
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
  aproveitamentoPadrao: number = 85, // NEW — from regras_precificacao
): OrcamentoItemPricingResult {
```

Then in the material mapping:

```typescript
const aproveitamento = (m.aproveitamento ?? aproveitamentoPadrao) / 100;
```

**Step 6: Update useConfigPrecificacao to map new field**

In `src/domains/comercial/hooks/useOrcamentoPricing.ts`:

```typescript
return {
  config: {
    // ... existing fields ...
    percentualEncargos: (data as Record<string, unknown>).percentual_encargos as number ?? DEFAULT_PRICING_CONFIG.percentualEncargos,
  },
  isDefault: false,
};
```

**Step 7: Update useOrcamentoPricing to pass aproveitamento_padrao**

```typescript
export function useOrcamentoPricing(
  item: OrcamentoItemInput | null,
  categoria?: string | null,
) {
  const { config, isDefault: isDefaultConfig } = useConfigPrecificacao();
  const { data: regras = [] } = useRegrasPrecificacao();

  // Get aproveitamento_padrao for category
  const aproveitamentoPadrao = useMemo(() => {
    const ativas = (regras as any[]).filter((r: any) => r.ativo !== false);
    const regra = ativas.find((r: any) => r.categoria === categoria) ?? ativas.find((r: any) => r.categoria === 'geral');
    return regra?.aproveitamento_padrao ?? 85;
  }, [regras, categoria]);

  const resultado = useMemo((): OrcamentoItemPricingResult | null => {
    if (!item) return null;
    try {
      return calcOrcamentoItem(item, config, aproveitamentoPadrao);
    } catch {
      return null;
    }
  }, [item, config, aproveitamentoPadrao]);

  // ... rest unchanged
}
```

**Step 8: Write tests for new functionality**

Add to `pricing-engine.test.ts`:

```typescript
describe("encargos trabalhistas", () => {
  it("increases custo por minuto when encargos > 0", () => {
    const withEncargos = calcCustoPorMinuto({ ...CROMA_CONFIG, percentualEncargos: 70 });
    const without = calcCustoPorMinuto(CROMA_CONFIG);
    expect(withEncargos).toBeCloseTo(without * 1.7, 3);
  });

  it("encargos 0% = same as no encargos", () => {
    const with0 = calcCustoPorMinuto({ ...CROMA_CONFIG, percentualEncargos: 0 });
    const without = calcCustoPorMinuto(CROMA_CONFIG);
    expect(with0).toBeCloseTo(without, 6);
  });
});

describe("custoMaquinas in motor", () => {
  it("adds machine cost to custoBase", () => {
    const withMaq = calcPricing({ ...makeInput(), custoMaquinas: 50 }, CROMA_CONFIG);
    const without = calcPricing(makeInput(), CROMA_CONFIG);
    expect(withMaq.custoBase).toBeGreaterThan(without.custoBase);
  });

  it("machine cost receives overhead (custos fixos)", () => {
    const withMaq = calcPricing({ ...makeInput(), custoMaquinas: 100 }, CROMA_CONFIG);
    const without = calcPricing(makeInput(), CROMA_CONFIG);
    const diff = withMaq.custoBase - without.custoBase;
    // Diff should be > 100 because overhead is applied
    expect(diff).toBeGreaterThan(100);
  });
});

describe("aproveitamento padrao", () => {
  it("uses aproveitamento_padrao when material has no aproveitamento", () => {
    const item: OrcamentoItemInput = {
      descricao: "Test",
      quantidade: 1,
      materiais: [{ descricao: "Lona", quantidade: 1, unidade: "m2", custo_unitario: 10 }],
      acabamentos: [],
      processos: [],
      markup_percentual: 40,
    };
    const r85 = calcOrcamentoItem(item, DEFAULT_PRICING_CONFIG, 85);
    const r100 = calcOrcamentoItem(item, DEFAULT_PRICING_CONFIG, 100);
    // 85% yield = more material needed = higher cost
    expect(r85.precoUnitario).toBeGreaterThan(r100.precoUnitario);
  });

  it("material-level aproveitamento overrides padrao", () => {
    const item: OrcamentoItemInput = {
      descricao: "Test",
      quantidade: 1,
      materiais: [{ descricao: "Lona", quantidade: 1, unidade: "m2", custo_unitario: 10, aproveitamento: 90 }],
      acabamentos: [],
      processos: [],
      markup_percentual: 40,
    };
    const r85 = calcOrcamentoItem(item, DEFAULT_PRICING_CONFIG, 85);
    const r100 = calcOrcamentoItem(item, DEFAULT_PRICING_CONFIG, 100);
    // Both should be the same — material has explicit 90%
    expect(r85.precoUnitario).toBeCloseTo(r100.precoUnitario, 4);
  });
});
```

**Step 9: Run all tests**

Run: `npx vitest run src/shared/services/__tests__/pricing-engine.test.ts`
Expected: All PASS

**Step 10: Commit**

```bash
git add src/shared/services/pricing-engine.ts src/shared/services/orcamento-pricing.service.ts src/domains/comercial/hooks/useOrcamentoPricing.ts src/domains/comercial/hooks/useItemEditor.ts src/shared/services/__tests__/pricing-engine.test.ts
git commit -m "feat(pricing): add encargos, machine costs, aproveitamento padrao to motor"
```

---

### Task 5: Admin Máquinas Page + Encargos in Config UI

**Files:**
- Create: `src/domains/admin/pages/AdminMaquinasPage.tsx`
- Modify: `src/routes/adminRoutes.tsx` (add route)
- Modify: `src/domains/admin/pages/AdminPrecificacaoPage.tsx` (add encargos field + aproveitamento in regras)

**Step 1: Create AdminMaquinasPage**

Create `src/domains/admin/pages/AdminMaquinasPage.tsx` — a simple CRUD page for machines:

- Uses `useQuery` with key `["maquinas"]` to list machines
- Uses `useMutation` to insert/update/delete
- Table with columns: Nome, Tipo (badge), Custo/Hora, Custo/m², Ativo (switch), Ações
- Inline edit (same pattern as regras_precificacao in AdminPrecificacaoPage)
- Header: icon Cog + "Cadastro de Máquinas" + description "Configure custo por hora e custo por m² de cada equipamento"
- Empty state: "Nenhuma máquina cadastrada. Clique em 'Nova Máquina' para adicionar."
- Tipo selector: dropdown with options `impressao`, `corte`, `acabamento`
- Note below custo fields: "Preencha custo/m² para impressoras e laminadora. Preencha custo/hora para equipamentos de corte e acabamento."
- Follow existing UI patterns: `rounded-2xl` cards, `bg-blue-600 hover:bg-blue-700` buttons, shadcn/ui components

**Step 2: Add route**

In `src/routes/adminRoutes.tsx`:

```typescript
const AdminMaquinasPage = lazy(() => import("@/domains/admin/pages/AdminMaquinasPage"));

// Add route:
<Route path="admin/maquinas" element={
  <PermissionGuard module="admin" action="ver">
    <LazyPage><AdminMaquinasPage /></LazyPage>
  </PermissionGuard>
} />
```

**Step 3: Add encargos field to AdminPrecificacaoPage**

In `src/domains/admin/pages/AdminPrecificacaoPage.tsx`:

- Add `percentualEncargos` state (default "0")
- Add `percentual_encargos` to ConfigPrecificacao interface
- Add input field in the "Parâmetros Gerais" section, after `horasMes`:
  ```tsx
  <div className="space-y-1.5">
    <Label className="text-slate-700 font-medium">
      Encargos Trabalhistas (%)
    </Label>
    <Input
      type="number"
      step="0.01"
      value={percentualEncargos}
      onChange={(e) => setPercentualEncargos(e.target.value)}
      className="h-11"
      placeholder="0"
    />
    <p className="text-xs text-slate-400">
      0% se sem registro CLT. ~70% com registro formal.
    </p>
  </div>
  ```
- Include in save mutation values
- Sync from config on load

**Step 4: Add aproveitamento_padrao column to regras table**

In `AdminPrecificacaoPage.tsx`, add `aproveitamento_padrao` to the RegrasPrecificacao interface and display it in the table as an editable column. Header: "Aprov. Padrão".

**Step 5: Verify build compiles**

Run: `npx vite build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/domains/admin/pages/AdminMaquinasPage.tsx src/routes/adminRoutes.tsx src/domains/admin/pages/AdminPrecificacaoPage.tsx
git commit -m "feat(admin): add Máquinas CRUD page + encargos field + aproveitamento in regras"
```

---

### Task 6: Enforce Preço/m² Mínimo as Blocker

**Files:**
- Modify: `src/domains/comercial/hooks/useOrcamentoAlerts.ts` (add preço/m² alert)
- Modify: `src/domains/comercial/components/ItemStep3Revisao.tsx` (disable save when blocked)
- Modify: `src/domains/comercial/hooks/useItemEditor.ts` (expose precoM2Bloqueado flag)

**Step 1: Add preço/m² validation to alerts**

In `useOrcamentoAlerts.ts`, add params `categoria` and `regras`, then add:

```typescript
// 6. Preço/m² abaixo do mínimo — BLOCKER
if (resultado?.precoM2 != null && categoria) {
  const regra = regras.find((r: any) => r.categoria === categoria && r.ativo !== false);
  if (regra?.preco_m2_minimo && resultado.precoM2 < regra.preco_m2_minimo) {
    alerts.push({
      id: "preco-m2-minimo",
      severity: "error",
      title: "Preço/m² abaixo do mínimo",
      message: `Preço/m² atual (R$ ${resultado.precoM2.toFixed(2)}) está abaixo do mínimo permitido (R$ ${regra.preco_m2_minimo.toFixed(2)}) para categoria "${categoria}". Aumente o markup ou ajuste os custos.`,
    });
  }
}
```

**Step 2: Expose blocker flag in useItemEditor**

In `useItemEditor.ts`, compute:

```typescript
const hasBlockingAlert = alerts.some(a => a.severity === 'error');
```

Return `hasBlockingAlert` from the hook.

**Step 3: Disable save in ItemStep3Revisao**

Pass `hasBlockingAlert` as prop and disable the "Adicionar Item" button when true.

**Step 4: Update PricingCalculator to show machine costs**

In `PricingCalculator.tsx`, add a "Máquinas" row if `resultado.custoMaquinas > 0`:

```typescript
...(resultado.custoMaquinas > 0
  ? [{ label: "Máquinas", value: resultado.custoMaquinas, color: "text-slate-600" }]
  : []),
```

**Step 5: Verify build**

Run: `npx vite build`
Expected: Build succeeds

**Step 6: Run all tests**

Run: `npx vitest run`
Expected: All PASS

**Step 7: Commit**

```bash
git add src/domains/comercial/hooks/useOrcamentoAlerts.ts src/domains/comercial/hooks/useItemEditor.ts src/domains/comercial/components/ItemStep3Revisao.tsx src/domains/comercial/components/PricingCalculator.tsx
git commit -m "feat(pricing): enforce preço/m² mínimo as blocker + show machine costs in breakdown"
```
