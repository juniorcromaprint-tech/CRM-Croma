# Pricing Evolution Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the Mubisys 9-step pricing engine to include acabamentos in overhead, allow salesperson price override (reverse markup), add setup time, volume discounts, material price history, and refactor the 1262-line editor into focused components.

**Architecture:** Keep existing `pricing-engine.ts` (9-step Mubisys motor) intact. Add `calcMarkupReverso()` for reverse calculation. Move acabamentos inside motor input. Refactor `OrcamentoEditorPage.tsx` into 9 smaller components with a `useItemEditor` hook. AI appliers get updated to use motor instead of direct DB writes.

**Tech Stack:** React 19 + TypeScript + Vite + Vitest + Supabase + TanStack Query v5 + shadcn/ui + Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-16-pricing-evolution-design.md`

**IMPORTANT for executor:** Use Sonnet model. Each task is independent and can be assigned to a parallel subagent. Run `npx vitest run` after each task that touches `.test.ts` files.

---

## Chunk 1: Motor + Services (Backend Logic)

### Task 1: Migration SQL

**Files:**
- Create: `supabase/migrations/035_pricing_evolution.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Migration: 035_pricing_evolution.sql
-- Pricing Evolution — spec 2026-03-16

-- 1. Remove preco_fixo from produto_modelos (bypass risk)
-- NOTE: servicos.preco_fixo is a DIFFERENT column and MUST be kept
ALTER TABLE produto_modelos DROP COLUMN IF EXISTS preco_fixo;

-- 2. Audit flag for price override
ALTER TABLE proposta_itens
  ADD COLUMN IF NOT EXISTS preco_override BOOLEAN DEFAULT false;

-- 3. Setup time per process
ALTER TABLE modelo_processos
  ADD COLUMN IF NOT EXISTS tempo_setup_min INTEGER DEFAULT 0;

-- 4. Volume quantity discount tiers
CREATE TABLE IF NOT EXISTS faixas_quantidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_id UUID NOT NULL REFERENCES regras_precificacao(id) ON DELETE CASCADE,
  quantidade_minima INTEGER NOT NULL,
  desconto_markup_percentual NUMERIC(5,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_faixas_regra_qtd UNIQUE (regra_id, quantidade_minima)
);

CREATE INDEX IF NOT EXISTS idx_faixas_quantidade_regra
  ON faixas_quantidade(regra_id);

-- Seed default tiers for banner category
INSERT INTO faixas_quantidade (regra_id, quantidade_minima, desconto_markup_percentual)
SELECT r.id, faixa.qtd, faixa.desconto
FROM regras_precificacao r
CROSS JOIN (VALUES
  (10, 3.0),
  (50, 7.0),
  (100, 12.0)
) AS faixa(qtd, desconto)
WHERE r.categoria = 'banner' AND r.ativo = true
ON CONFLICT ON CONSTRAINT uq_faixas_regra_qtd DO NOTHING;

-- 5. Material price history with auto-trigger
CREATE TABLE IF NOT EXISTS materiais_historico_preco (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
  preco_anterior NUMERIC(12,4),
  preco_novo NUMERIC(12,4) NOT NULL,
  motivo TEXT,
  atualizado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mat_hist_material
  ON materiais_historico_preco(material_id, created_at DESC);

CREATE OR REPLACE FUNCTION fn_log_preco_material()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.preco_medio IS DISTINCT FROM NEW.preco_medio THEN
    INSERT INTO materiais_historico_preco (material_id, preco_anterior, preco_novo, atualizado_por)
    VALUES (NEW.id, OLD.preco_medio, NEW.preco_medio, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_preco_material ON materiais;
CREATE TRIGGER trg_log_preco_material
  AFTER UPDATE ON materiais
  FOR EACH ROW EXECUTE FUNCTION fn_log_preco_material();

-- 6. RLS
ALTER TABLE faixas_quantidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiais_historico_preco ENABLE ROW LEVEL SECURITY;

CREATE POLICY "faixas_quantidade_select" ON faixas_quantidade
  FOR SELECT USING (true);

CREATE POLICY "faixas_quantidade_manage" ON faixas_quantidade
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gerente'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gerente'))
  );

CREATE POLICY "materiais_historico_select" ON materiais_historico_preco
  FOR SELECT USING (true);

CREATE POLICY "materiais_historico_insert" ON materiais_historico_preco
  FOR INSERT WITH CHECK (true);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/035_pricing_evolution.sql
git commit -m "feat(db): add pricing evolution migration — override flag, setup time, volume tiers, price history"
```

**NOTE:** Migration must be applied to Supabase dashboard manually: `supabase.com/dashboard/project/djwjmfgplnqyffdcgdaw/sql`

---

### Task 2: Add `calcMarkupReverso` to pricing engine

**Files:**
- Modify: `src/shared/services/pricing-engine.ts`
- Modify: `src/shared/services/__tests__/pricing-engine.test.ts`

- [ ] **Step 1: Write failing tests for calcMarkupReverso**

Add to `src/shared/services/__tests__/pricing-engine.test.ts`:

```typescript
// Add import: calcMarkupReverso
import {
  // ...existing imports...
  calcMarkupReverso,
} from "../pricing-engine";

// After the "invariantes de negocio" describe block:

describe("calcMarkupReverso", () => {
  it("retorna markup correto para preco-alvo conhecido", () => {
    // Primeiro, calcula preco com markup 40%
    const input = makeInput({ markupPercentual: 40 });
    const forward = calcPricing(input, CROMA_CONFIG);

    // Agora faz o reverso: dado precoVenda, deve retornar ~40%
    const reverso = calcMarkupReverso(
      forward.precoVenda,
      { materiais: input.materiais, processos: input.processos },
      CROMA_CONFIG,
    );
    expect(reverso.markupPercentual).toBeCloseTo(40, 1);
    expect(reverso.valido).toBe(true);
  });

  it("retorna valido=false para preco-alvo <= 0", () => {
    const input = makeInput();
    const r = calcMarkupReverso(0, { materiais: input.materiais, processos: input.processos }, CROMA_CONFIG);
    expect(r.valido).toBe(false);
    expect(r.markupPercentual).toBe(0);
  });

  it("retorna valido=false para preco-alvo negativo", () => {
    const input = makeInput();
    const r = calcMarkupReverso(-100, { materiais: input.materiais, processos: input.processos }, CROMA_CONFIG);
    expect(r.valido).toBe(false);
  });

  it("retorna markup negativo quando preco abaixo do custo", () => {
    const input = makeInput();
    // Preco muito baixo (abaixo do Vam)
    const r = calcMarkupReverso(1, { materiais: input.materiais, processos: input.processos }, CROMA_CONFIG);
    expect(r.markupPercentual).toBeLessThan(0);
    expect(r.valido).toBe(false);
  });

  it("retorna margemBruta coerente com o motor forward", () => {
    const input = makeInput({ markupPercentual: 50 });
    const forward = calcPricing(input, CROMA_CONFIG);
    const reverso = calcMarkupReverso(
      forward.precoVenda,
      { materiais: input.materiais, processos: input.processos },
      CROMA_CONFIG,
    );
    expect(reverso.margemBruta).toBeCloseTo(forward.margemBruta, 0);
  });

  it("funciona com materiais vazios", () => {
    const r = calcMarkupReverso(100, { materiais: [], processos: [] }, CROMA_CONFIG);
    // With no costs, base is 0, so any price gives huge markup
    expect(r.valido).toBe(false); // valorAntesMarkup = 0
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/shared/services/__tests__/pricing-engine.test.ts
```

Expected: FAIL — `calcMarkupReverso` is not exported.

- [ ] **Step 3: Implement calcMarkupReverso**

Add to `src/shared/services/pricing-engine.ts` BEFORE the `// ATALHOS` section (before line 307):

```typescript
// ---------------------------------------------------------------------------
// MARKUP REVERSO — Calcula markup necessario para atingir preco-alvo
// ---------------------------------------------------------------------------

/**
 * Dado um preco-alvo, calcula qual markup % seria necessario.
 * Faz o calculo reverso: preco → markup (inverso do passo 9).
 *
 * @param precoAlvo - Preco de venda desejado (unitario)
 * @param input - Materiais e processos (sem markup)
 * @param config - Configuracao de precificacao
 */
export function calcMarkupReverso(
  precoAlvo: number,
  input: Omit<PricingInput, 'markupPercentual'>,
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
): { markupPercentual: number; margemBruta: number; valido: boolean } {
  if (!precoAlvo || precoAlvo <= 0) {
    return { markupPercentual: 0, margemBruta: 0, valido: false };
  }

  const base = calcPricing({ ...input, markupPercentual: 0 }, config);

  if (base.valorAntesMarkup <= 0) {
    return { markupPercentual: 0, margemBruta: 0, valido: false };
  }

  const markupPercentual = ((precoAlvo / base.valorAntesMarkup) - 1) * 100;
  const margemBruta = ((precoAlvo - base.custoBase) / precoAlvo) * 100;

  return {
    markupPercentual: Math.round(markupPercentual * 100) / 100,
    margemBruta: Math.round(margemBruta * 100) / 100,
    valido: markupPercentual >= 0,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/shared/services/__tests__/pricing-engine.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Remove `calcPrecoRapido` function**

In `src/shared/services/pricing-engine.ts`, delete the entire `calcPrecoRapido` function (lines 311-321).

In `src/shared/services/__tests__/pricing-engine.test.ts`, remove the import of `calcPrecoRapido` from line 12.

- [ ] **Step 5b: Verify no other call sites remain**

```bash
grep -r "calcPrecoRapido" src/
```

Expected: Zero results. If any found, replace with `calcPricing()` call.

- [ ] **Step 6: Run tests again**

```bash
npx vitest run src/shared/services/__tests__/pricing-engine.test.ts
```

Expected: ALL PASS (calcPrecoRapido was not tested directly, only imported)

- [ ] **Step 7: Commit**

```bash
git add src/shared/services/pricing-engine.ts src/shared/services/__tests__/pricing-engine.test.ts
git commit -m "feat(pricing): add calcMarkupReverso + remove calcPrecoRapido"
```

---

### Task 3: Acabamentos inside motor + setup time in orcamento-pricing.service

**Files:**
- Modify: `src/shared/services/orcamento-pricing.service.ts`
- Modify: `src/shared/services/__tests__/pricing-engine.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/shared/services/__tests__/pricing-engine.test.ts`:

```typescript
import {
  calcOrcamentoItem,
  calcMarkupParaPreco,
  calcAreaM2,
  type OrcamentoItemInput,
} from "../orcamento-pricing.service";

describe("calcOrcamentoItem — acabamentos inside motor", () => {
  const baseItem: OrcamentoItemInput = {
    descricao: "Banner teste",
    quantidade: 1,
    largura_cm: 100,
    altura_cm: 200,
    materiais: [
      { descricao: "Lona 440g", quantidade: 2, unidade: "m2", custo_unitario: 15 },
    ],
    acabamentos: [
      { descricao: "Ilhos", quantidade: 10, custo_unitario: 0.5 },
    ],
    processos: [
      { etapa: "Impressao", tempo_minutos: 30 },
    ],
    markup_percentual: 40,
  };

  it("includes acabamentos cost in custoMP (via motor)", () => {
    const result = calcOrcamentoItem(baseItem);
    // custoMP should include raw material cost (2*15=30) AND acabamentos (10*0.5=5)
    expect(result.custoMP).toBeCloseTo(35, 1);
  });

  it("custosAcabamentos is still available as informational field", () => {
    const result = calcOrcamentoItem(baseItem);
    expect(result.custosAcabamentos).toBeCloseTo(5, 1);
  });

  it("precoUnitario includes acabamentos with full overhead", () => {
    const withAcab = calcOrcamentoItem(baseItem);
    const withoutAcab = calcOrcamentoItem({ ...baseItem, acabamentos: [] });
    // Difference should be MORE than just 5 (acabamento raw cost)
    // because overhead (custos fixos, impostos, comissao) is applied
    expect(withAcab.precoUnitario - withoutAcab.precoUnitario).toBeGreaterThan(5);
  });

  it("works identically with empty acabamentos (regression)", () => {
    const result = calcOrcamentoItem({ ...baseItem, acabamentos: [] });
    expect(result.custosAcabamentos).toBe(0);
    expect(result.precoUnitario).toBeGreaterThan(0);
  });
});

describe("calcOrcamentoItem — setup time", () => {
  it("dilutes setup time across quantity", () => {
    const item1: OrcamentoItemInput = {
      descricao: "Placa",
      quantidade: 1,
      materiais: [{ descricao: "PVC", quantidade: 1, unidade: "m2", custo_unitario: 20 }],
      acabamentos: [],
      processos: [{ etapa: "Corte", tempo_minutos: 10, tempo_setup_min: 30 }],
      markup_percentual: 40,
    };

    const item10 = { ...item1, quantidade: 10 };

    const r1 = calcOrcamentoItem(item1);
    const r10 = calcOrcamentoItem(item10);

    // Price per unit should be lower with 10 qty (setup diluted)
    expect(r10.precoUnitario).toBeLessThan(r1.precoUnitario);
  });
});

describe("calcMarkupParaPreco", () => {
  const item = {
    descricao: "Banner",
    quantidade: 1,
    largura_cm: 100,
    altura_cm: 200,
    materiais: [{ descricao: "Lona", quantidade: 2, unidade: "m2", custo_unitario: 15 }],
    acabamentos: [],
    processos: [{ etapa: "Impressao", tempo_minutos: 30 }],
  };

  it("returns correct markup for unit price target", () => {
    // First calculate with known markup to get a price
    const known = calcOrcamentoItem({ ...item, markup_percentual: 40 });
    const result = calcMarkupParaPreco(known.precoUnitario, "unitario", item, DEFAULT_PRICING_CONFIG);
    expect(result.markup_percentual).toBeCloseTo(40, 0);
    expect(result.valido).toBe(true);
  });

  it("returns correct markup for m2 price target", () => {
    const known = calcOrcamentoItem({ ...item, markup_percentual: 40 });
    if (known.precoM2) {
      const result = calcMarkupParaPreco(known.precoM2, "m2", item, DEFAULT_PRICING_CONFIG);
      expect(result.markup_percentual).toBeCloseTo(40, 0);
      expect(result.valido).toBe(true);
    }
  });

  it("returns valido=false when no dimensions for m2 type", () => {
    const noDims = { ...item, largura_cm: undefined, altura_cm: undefined };
    const result = calcMarkupParaPreco(100, "m2", noDims as any, DEFAULT_PRICING_CONFIG);
    expect(result.valido).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/shared/services/__tests__/pricing-engine.test.ts
```

Expected: FAIL — new tests reference updated interfaces

- [ ] **Step 3: Update OrcamentoProcesso interface and calcOrcamentoItem**

Replace the content of `src/shared/services/orcamento-pricing.service.ts`:

Key changes:
1. Add `tempo_setup_min?: number` to `OrcamentoProcesso`
2. In `calcOrcamentoItem`: concatenate materiais + acabamentos into single array for motor
3. Apply setup time dilution by quantity
4. Add `calcMarkupParaPreco` function
5. Keep `custosAcabamentos` as informational field

In `OrcamentoProcesso`, add:
```typescript
export interface OrcamentoProcesso {
  etapa: string;
  tempo_minutos: number;
  tempo_setup_min?: number; // Setup time, diluted by quantity
}
```

In `calcOrcamentoItem`, replace the motor call section:

```typescript
export function calcOrcamentoItem(
  item: OrcamentoItemInput,
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
): OrcamentoItemPricingResult {
  const quantidade = item.quantidade || 1;
  const areaM2 = calcAreaM2(item.largura_cm, item.altura_cm);

  // Calculate acabamentos cost (informational — for UI breakdown)
  const custoAcabamentosInfo = item.acabamentos.reduce(
    (sum, a) => sum + a.quantidade * a.custo_unitario,
    0,
  );

  // Materiais + acabamentos go into motor TOGETHER (both get overhead)
  const materiaisParaMotor = [
    ...item.materiais.map((m) => {
      const aproveitamento = (m.aproveitamento ?? 100) / 100;
      const quantidadeReal = aproveitamento > 0 ? m.quantidade / aproveitamento : m.quantidade;
      return {
        nome: m.descricao,
        quantidade: quantidadeReal,
        precoUnitario: m.custo_unitario,
      };
    }),
    ...item.acabamentos.map((a) => ({
      nome: a.descricao,
      quantidade: a.quantidade,
      precoUnitario: a.custo_unitario,
    })),
  ];

  // Processos with setup time diluted by quantity
  const qtdSafe = Math.max(1, quantidade);
  const processos = item.processos.map((p) => ({
    etapa: p.etapa,
    tempoMinutos: p.tempo_minutos + ((p.tempo_setup_min ?? 0) / qtdSafe),
  }));

  // Motor Mubisys — returns UNIT price
  const pricingResult = calcPricing(
    { materiais: materiaisParaMotor, processos, markupPercentual: item.markup_percentual },
    config,
  );

  const precoUnitario = pricingResult.precoVenda;
  const precoTotal = precoUnitario * quantidade;
  const precoM2 = areaM2 && areaM2 > 0 ? precoUnitario / areaM2 : null;
  const custoTotalUnitario = pricingResult.custoTotal ?? 0;

  return {
    custoMP: pricingResult.custoMP,
    custosAcabamentos: custoAcabamentosInfo,
    custoMO: pricingResult.custoMO,
    custoTotal: custoTotalUnitario,
    precoUnitario,
    precoTotal,
    margemBruta: precoUnitario > 0
      ? ((precoUnitario - custoTotalUnitario) / precoUnitario) * 100
      : 0,
    areaM2,
    precoM2,
    detalhes: pricingResult,
  };
}
```

Add `calcMarkupParaPreco` function after `calcOrcamentoItem`:

```typescript
/**
 * Given a target price (unit or m2), returns the required markup.
 */
export function calcMarkupParaPreco(
  precoAlvo: number,
  tipo: 'unitario' | 'm2',
  item: Omit<OrcamentoItemInput, 'markup_percentual'>,
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
): { markup_percentual: number; margem_bruta: number; valido: boolean } {
  let precoUnitarioAlvo = precoAlvo;

  if (tipo === 'm2') {
    const areaM2 = calcAreaM2(item.largura_cm, item.altura_cm);
    if (!areaM2 || areaM2 <= 0) {
      return { markup_percentual: 0, margem_bruta: 0, valido: false };
    }
    precoUnitarioAlvo = precoAlvo * areaM2;
  }

  const quantidade = item.quantidade || 1;
  const qtdSafe = Math.max(1, quantidade);

  const materiaisParaMotor = [
    ...item.materiais.map((m) => {
      const aproveitamento = (m.aproveitamento ?? 100) / 100;
      const quantidadeReal = aproveitamento > 0 ? m.quantidade / aproveitamento : m.quantidade;
      return { nome: m.descricao, quantidade: quantidadeReal, precoUnitario: m.custo_unitario };
    }),
    ...item.acabamentos.map((a) => ({
      nome: a.descricao, quantidade: a.quantidade, precoUnitario: a.custo_unitario,
    })),
  ];

  const processos = item.processos.map((p) => ({
    etapa: p.etapa,
    tempoMinutos: p.tempo_minutos + ((p.tempo_setup_min ?? 0) / qtdSafe),
  }));

  const result = calcMarkupReverso(precoUnitarioAlvo, { materiais: materiaisParaMotor, processos }, config);

  return {
    markup_percentual: result.markupPercentual,
    margem_bruta: result.margemBruta,
    valido: result.valido,
  };
}
```

Add import of `calcMarkupReverso` at top of file:
```typescript
import {
  calcPricing,
  calcMarkupReverso,
  DEFAULT_PRICING_CONFIG,
  type PricingConfig,
  type PricingResult,
} from "./pricing-engine";
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/shared/services/__tests__/pricing-engine.test.ts
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/orcamento-pricing.service.ts src/shared/services/__tests__/pricing-engine.test.ts
git commit -m "feat(pricing): acabamentos inside motor + setup time + calcMarkupParaPreco"
```

---

### Task 4: Update pricing explainer for new flow

**Files:**
- Modify: `src/shared/services/pricing-explainer.ts`

- [ ] **Step 1: Update explainer**

In `pricing-explainer.ts`, the breakdown steps need updating. The current step 2 says "Acabamentos somados ao custo final (calculados fora do motor Mubisys)" — this is no longer true. Change it to:

Replace the `passos` array construction. The key change: step 1 now says acabamentos are included, step 2 becomes just informational.

Find:
```typescript
    {
      passo: 2,
      nome: "Custo de Acabamentos",
      formula: acabamentosDesc,
      resultado: resultado.custosAcabamentos,
      explicacao:
        "Acabamentos somados ao custo final (calculados fora do motor Mubisys)",
    },
```

Replace with:
```typescript
    {
      passo: 2,
      nome: "Custo de Acabamentos",
      formula: acabamentosDesc,
      resultado: resultado.custosAcabamentos,
      explicacao:
        "Acabamentos inclusos no custo de material (recebem overhead do motor Mubisys)",
    },
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/services/pricing-explainer.ts
git commit -m "fix(pricing): update explainer — acabamentos now inside motor"
```

---

## Chunk 2: Hooks + Config

### Task 5: Update useOrcamentoPricing hook with isDefaultConfig

**Files:**
- Modify: `src/domains/comercial/hooks/useOrcamentoPricing.ts`

- [ ] **Step 1: Update useConfigPrecificacao return type**

Change `useConfigPrecificacao` to return `{ config, isDefault }`:

```typescript
export function useConfigPrecificacao(): { config: PricingConfig; isDefault: boolean } {
  const { data } = useQuery({
    queryKey: ["config_precificacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config_precificacao")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  return useMemo(() => {
    if (!data) return { config: DEFAULT_PRICING_CONFIG, isDefault: true };
    return {
      config: {
        faturamentoMedio: (data as Record<string, unknown>).faturamento_medio as number ?? DEFAULT_PRICING_CONFIG.faturamentoMedio,
        custoOperacional: (data as Record<string, unknown>).custo_operacional as number ?? DEFAULT_PRICING_CONFIG.custoOperacional,
        custoProdutivo: (data as Record<string, unknown>).custo_produtivo as number ?? DEFAULT_PRICING_CONFIG.custoProdutivo,
        qtdFuncionarios: (data as Record<string, unknown>).qtd_funcionarios as number ?? DEFAULT_PRICING_CONFIG.qtdFuncionarios,
        horasMes: (data as Record<string, unknown>).horas_mes as number ?? DEFAULT_PRICING_CONFIG.horasMes,
        percentualComissao: (data as Record<string, unknown>).percentual_comissao as number ?? DEFAULT_PRICING_CONFIG.percentualComissao,
        percentualImpostos: (data as Record<string, unknown>).percentual_impostos as number ?? DEFAULT_PRICING_CONFIG.percentualImpostos,
        percentualJuros: (data as Record<string, unknown>).percentual_juros as number ?? DEFAULT_PRICING_CONFIG.percentualJuros,
      },
      isDefault: false,
    };
  }, [data]);
}
```

- [ ] **Step 2: Update useOrcamentoPricing to use new return type**

Change where it calls `useConfigPrecificacao()`:

```typescript
export function useOrcamentoPricing(
  item: OrcamentoItemInput | null,
  categoria?: string | null,
) {
  const { config, isDefault: isDefaultConfig } = useConfigPrecificacao();
  const { data: regras = [] } = useRegrasPrecificacao();

  // ...rest stays the same...

  return {
    resultado,
    config,
    isDefaultConfig,
    regras,
    markupSugerido,
    validacaoMarkup,
  };
}
```

- [ ] **Step 3: Update all call sites**

Search for `useConfigPrecificacao()` and `useOrcamentoPricing(` calls. Update destructuring where needed. The main call site is `OrcamentoEditorPage.tsx` line 301:

```typescript
const { resultado: pricingResult, markupSugerido, validacaoMarkup, config: pricingConfig, isDefaultConfig } =
    useOrcamentoPricing(pricingInput, newItem.categoria);
```

- [ ] **Step 4: Commit**

```bash
git add src/domains/comercial/hooks/useOrcamentoPricing.ts src/domains/comercial/pages/OrcamentoEditorPage.tsx
git commit -m "feat(pricing): useConfigPrecificacao returns isDefault flag"
```

---

### Task 6: Add volume discount hook

**Files:**
- Create: `src/domains/comercial/hooks/useFaixasQuantidade.ts`

- [ ] **Step 1: Create hook**

```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FaixaQuantidade {
  id: string;
  regra_id: string;
  quantidade_minima: number;
  desconto_markup_percentual: number;
  ativo: boolean;
}

export function useFaixasQuantidade(regraId?: string | null) {
  return useQuery({
    queryKey: ["faixas_quantidade", regraId],
    queryFn: async () => {
      if (!regraId) return [];
      const { data, error } = await supabase
        .from("faixas_quantidade")
        .select("*")
        .eq("regra_id", regraId)
        .eq("ativo", true)
        .order("quantidade_minima", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FaixaQuantidade[];
    },
    enabled: !!regraId,
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Given quantity and faixas, returns the applicable discount on markup.
 * Uses the highest tier where quantity >= quantidade_minima.
 */
export function calcDescontoVolume(
  quantidade: number,
  faixas: FaixaQuantidade[],
): { desconto: number; faixaAplicada: FaixaQuantidade | null } {
  if (!faixas.length || quantidade <= 0) {
    return { desconto: 0, faixaAplicada: null };
  }

  // Faixas should be sorted ascending by quantidade_minima
  const sorted = [...faixas].sort((a, b) => b.quantidade_minima - a.quantidade_minima);
  const faixaAplicada = sorted.find((f) => quantidade >= f.quantidade_minima) ?? null;

  return {
    desconto: faixaAplicada?.desconto_markup_percentual ?? 0,
    faixaAplicada,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/comercial/hooks/useFaixasQuantidade.ts
git commit -m "feat(pricing): add useFaixasQuantidade hook + calcDescontoVolume"
```

---

## Chunk 3: UI Refactor — Extract Components

### Task 7: Create useItemEditor hook

**Files:**
- Create: `src/domains/comercial/hooks/useItemEditor.ts`

- [ ] **Step 1: Create the hook**

This hook extracts ALL item editor logic from OrcamentoEditorPage. It manages:
- Item state (newItem)
- Wizard step navigation
- Produto/modelo selection handlers
- Material/acabamento change handlers
- Pricing calculation via useOrcamentoPricing
- **NEW: Bidirectional price override (markup ↔ price ↔ price/m²)**
- Volume discount application
- Alerts

```typescript
import { useState, useCallback, useMemo } from "react";
import { useOrcamentoPricing, useRegrasPrecificacao } from "./useOrcamentoPricing";
import { useOrcamentoAlerts } from "./useOrcamentoAlerts";
import { useFaixasQuantidade, calcDescontoVolume } from "./useFaixasQuantidade";
import { calcMarkupParaPreco, calcAreaM2 } from "@/shared/services/orcamento-pricing.service";
import type { PricingConfig } from "@/shared/services/pricing-engine";
import type {
  OrcamentoMaterial,
  OrcamentoAcabamento,
  OrcamentoProcesso,
  OrcamentoItemInput,
} from "@/shared/services/orcamento-pricing.service";
import type { Produto, ProdutoModelo } from "./useProdutosModelos";

export interface ItemEditorState {
  produto_id: string | null;
  modelo_id: string | null;
  descricao: string;
  especificacao: string;
  quantidade: number;
  largura_cm: number | null;
  altura_cm: number | null;
  materiais: OrcamentoMaterial[];
  acabamentos: OrcamentoAcabamento[];
  processos: OrcamentoProcesso[];
  markup_percentual: number;
  categoria: string | null;
}

const DEFAULT_ITEM: ItemEditorState = {
  produto_id: null,
  modelo_id: null,
  descricao: "",
  especificacao: "",
  quantidade: 1,
  largura_cm: null,
  altura_cm: null,
  materiais: [],
  acabamentos: [],
  processos: [],
  markup_percentual: 40,
  categoria: null,
};

export type OverrideSource = 'markup' | 'preco' | 'm2';

export function useItemEditor() {
  const [newItem, setNewItem] = useState<ItemEditorState>(DEFAULT_ITEM);
  const [currentStep, setCurrentStep] = useState(1);
  const [overrideSource, setOverrideSource] = useState<OverrideSource>('markup');
  const [precoOverrideValue, setPrecoOverrideValue] = useState<number | null>(null);
  const [precoM2OverrideValue, setPrecoM2OverrideValue] = useState<number | null>(null);

  // Pricing
  const pricingInput: OrcamentoItemInput | null = useMemo(() => {
    if (!newItem.descricao && !newItem.produto_id) return null;
    return {
      descricao: newItem.descricao || "Item",
      quantidade: newItem.quantidade,
      largura_cm: newItem.largura_cm,
      altura_cm: newItem.altura_cm,
      materiais: newItem.materiais,
      acabamentos: newItem.acabamentos,
      processos: newItem.processos,
      markup_percentual: newItem.markup_percentual,
    };
  }, [newItem]);

  const { resultado: pricingResult, markupSugerido, validacaoMarkup, config, isDefaultConfig, regras } =
    useOrcamentoPricing(pricingInput, newItem.categoria);

  // Volume discount
  const regraCategoria = useMemo(() => {
    const ativas = (regras as any[]).filter((r: any) => r.ativo !== false);
    return ativas.find((r: any) => r.categoria === newItem.categoria) ?? ativas.find((r: any) => r.categoria === 'geral');
  }, [regras, newItem.categoria]);

  const { data: faixas = [] } = useFaixasQuantidade(regraCategoria?.id);
  const volumeDiscount = useMemo(
    () => calcDescontoVolume(newItem.quantidade, faixas),
    [newItem.quantidade, faixas],
  );

  // Auto-apply volume discount to markup when quantity changes
  // Only when user hasn't manually overridden the price
  const [volumeApplied, setVolumeApplied] = useState(false);
  const baseMarkup = useMemo(() => {
    // Base markup from modelo or default
    return newItem.markup_percentual;
  }, [newItem.modelo_id]); // only recompute on modelo change

  // Effect: when volumeDiscount changes and source is 'markup', apply discount
  React.useEffect(() => {
    if (overrideSource !== 'markup') return;
    if (!volumeDiscount.desconto || volumeDiscount.desconto === 0) {
      if (volumeApplied) {
        // Remove previously applied discount — restore base markup
        setVolumeApplied(false);
      }
      return;
    }
    // Apply discount to the modelo's markup_padrao, not the already-discounted value
    const modeloMarkup = markupSugerido || newItem.markup_percentual;
    const adjustedMarkup = Math.max(0, modeloMarkup - volumeDiscount.desconto);
    setNewItem((s) => ({ ...s, markup_percentual: Math.round(adjustedMarkup * 100) / 100 }));
    setVolumeApplied(true);
  }, [volumeDiscount.desconto, overrideSource]);

  // Alerts
  const alerts = useOrcamentoAlerts({
    materiais: newItem.materiais,
    acabamentos: newItem.acabamentos,
    markup: newItem.markup_percentual,
    markupMinimo: validacaoMarkup.markup_minimo,
    resultado: pricingResult,
    config,
  });

  // Is price overridden by user?
  const isPrecoOverride = overrideSource !== 'markup';

  // Handlers
  const handleProdutoChange = useCallback((produto: Produto | null) => {
    setNewItem((s) => ({
      ...s,
      produto_id: produto?.id ?? null,
      categoria: produto?.categoria ?? null,
      descricao: produto?.nome ?? s.descricao,
    }));
  }, []);

  const handleModeloChange = useCallback((modelo: ProdutoModelo | null) => {
    if (!modelo) {
      setNewItem((s) => ({ ...s, modelo_id: null }));
      return;
    }

    const materiaisFromModelo: OrcamentoMaterial[] = (modelo.materiais ?? []).map((m) => {
      const precoMedio = Number(m.material?.preco_medio) || 0;
      return {
        material_id: m.material_id,
        descricao: m.material?.nome ?? `Material ${m.material_id}`,
        quantidade: Number(m.quantidade_por_unidade) || 0,
        unidade: m.unidade ?? "un",
        custo_unitario: precoMedio,
        aproveitamento: Number(m.material?.aproveitamento) || 100,
      };
    });

    const processosFromModelo: OrcamentoProcesso[] = (modelo.processos ?? []).map((p) => ({
      etapa: p.etapa,
      tempo_minutos: Number(p.tempo_por_unidade_min) || 0,
      tempo_setup_min: Number((p as any).tempo_setup_min) || 0,
    }));

    setNewItem((s) => ({
      ...s,
      modelo_id: modelo.id,
      descricao: s.descricao || modelo.nome,
      especificacao: modelo.descritivo_nf ?? modelo.nome,
      largura_cm: modelo.largura_cm ?? s.largura_cm,
      altura_cm: modelo.altura_cm ?? s.altura_cm,
      markup_percentual: modelo.markup_padrao ?? s.markup_percentual,
      materiais: materiaisFromModelo,
      processos: processosFromModelo,
    }));
    setOverrideSource('markup');
    setPrecoOverrideValue(null);
    setPrecoM2OverrideValue(null);
  }, []);

  const handleMateriaisChange = useCallback((materiais: OrcamentoMaterial[]) => {
    setNewItem((s) => ({ ...s, materiais }));
  }, []);

  const handleAcabamentosChange = useCallback((acabamentos: OrcamentoAcabamento[]) => {
    setNewItem((s) => ({ ...s, acabamentos }));
  }, []);

  // Markup change (user types markup %)
  const handleMarkupChange = useCallback((markup: number) => {
    setNewItem((s) => ({ ...s, markup_percentual: markup }));
    setOverrideSource('markup');
    setPrecoOverrideValue(null);
    setPrecoM2OverrideValue(null);
  }, []);

  // Price override (user types unit price)
  const handlePrecoOverride = useCallback((preco: number) => {
    setPrecoOverrideValue(preco);
    setOverrideSource('preco');
    if (!pricingInput) return;
    const result = calcMarkupParaPreco(preco, 'unitario', pricingInput, config);
    if (result.valido || result.markup_percentual < 0) {
      setNewItem((s) => ({ ...s, markup_percentual: Math.round(result.markup_percentual * 100) / 100 }));
    }
    // Update m2 value
    const area = calcAreaM2(newItem.largura_cm, newItem.altura_cm);
    if (area && area > 0) {
      setPrecoM2OverrideValue(Math.round((preco / area) * 100) / 100);
    }
  }, [pricingInput, config, newItem.largura_cm, newItem.altura_cm]);

  // Price/m2 override (user types price per m2)
  const handlePrecoM2Override = useCallback((precoM2: number) => {
    setPrecoM2OverrideValue(precoM2);
    setOverrideSource('m2');
    if (!pricingInput) return;
    const result = calcMarkupParaPreco(precoM2, 'm2', pricingInput, config);
    if (result.valido || result.markup_percentual < 0) {
      setNewItem((s) => ({ ...s, markup_percentual: Math.round(result.markup_percentual * 100) / 100 }));
    }
    // Update unit price value
    const area = calcAreaM2(newItem.largura_cm, newItem.altura_cm);
    if (area && area > 0) {
      setPrecoOverrideValue(Math.round(precoM2 * area * 100) / 100);
    }
  }, [pricingInput, config, newItem.largura_cm, newItem.altura_cm]);

  // Navigation
  const nextStep = useCallback(() => setCurrentStep((s) => Math.min(s + 1, 3)), []);
  const prevStep = useCallback(() => setCurrentStep((s) => Math.max(s - 1, 1)), []);

  const reset = useCallback(() => {
    setNewItem(DEFAULT_ITEM);
    setCurrentStep(1);
    setOverrideSource('markup');
    setPrecoOverrideValue(null);
    setPrecoM2OverrideValue(null);
  }, []);

  return {
    // State
    newItem,
    setNewItem,
    currentStep,
    overrideSource,
    isPrecoOverride,
    precoOverrideValue,
    precoM2OverrideValue,

    // Pricing
    pricingInput,
    pricingResult,
    config,
    isDefaultConfig,
    markupSugerido,
    validacaoMarkup,
    alerts,
    volumeDiscount,

    // Handlers
    handleProdutoChange,
    handleModeloChange,
    handleMateriaisChange,
    handleAcabamentosChange,
    handleMarkupChange,
    handlePrecoOverride,
    handlePrecoM2Override,

    // Navigation
    nextStep,
    prevStep,
    reset,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/comercial/hooks/useItemEditor.ts
git commit -m "feat(pricing): create useItemEditor hook with bidirectional price override"
```

---

### Task 8: Create ItemStep3Revisao component with price override UI

**Files:**
- Create: `src/domains/comercial/components/ItemStep3Revisao.tsx`

- [ ] **Step 1: Create component**

```typescript
import React, { useRef } from "react";
import { AlertTriangle, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import AlertasOrcamento from "./AlertasOrcamento";
import ResumoVendedor from "./ResumoVendedor";
import type { OrcamentoItemPricingResult } from "@/shared/services/orcamento-pricing.service";
import type { OverrideSource } from "../hooks/useItemEditor";
import type { FaixaQuantidade } from "../hooks/useFaixasQuantidade";

interface ItemStep3RevisaoProps {
  markup: number;
  markupSugerido: number;
  markupMinimo: number;
  validacaoMarkup: { valido: boolean; aviso: string | null };
  pricingResult: OrcamentoItemPricingResult | null;
  quantidade: number;
  alerts: Array<{ type: string; message: string }>;
  overrideSource: OverrideSource;
  isPrecoOverride: boolean;
  precoOverrideValue: number | null;
  precoM2OverrideValue: number | null;
  hasArea: boolean;
  isDefaultConfig: boolean;
  volumeDiscount: { desconto: number; faixaAplicada: FaixaQuantidade | null };
  onMarkupChange: (markup: number) => void;
  onPrecoOverride: (preco: number) => void;
  onPrecoM2Override: (precoM2: number) => void;
  onMarkupSugeridoClick: () => void;
}

export default function ItemStep3Revisao({
  markup,
  markupSugerido,
  markupMinimo,
  validacaoMarkup,
  pricingResult,
  quantidade,
  alerts,
  overrideSource,
  isPrecoOverride,
  precoOverrideValue,
  precoM2OverrideValue,
  hasArea,
  isDefaultConfig,
  volumeDiscount,
  onMarkupChange,
  onPrecoOverride,
  onPrecoM2Override,
  onMarkupSugeridoClick,
}: ItemStep3RevisaoProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handlePrecoBlur = (value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) onPrecoOverride(num);
  };

  const handlePrecoM2Blur = (value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) onPrecoM2Override(num);
  };

  return (
    <div className="space-y-5">
      {/* Default config warning */}
      {isDefaultConfig && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle size={14} />
          Configure os parametros de precificacao em Admin &gt; Configuracoes antes de criar orcamentos.
        </div>
      )}

      {/* Volume discount badge */}
      {volumeDiscount.desconto > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-700 flex items-center gap-2">
          <DollarSign size={14} />
          Desconto por volume: -{volumeDiscount.desconto}% no markup (qtd {quantidade} &ge; {volumeDiscount.faixaAplicada?.quantidade_minima})
        </div>
      )}

      {/* Markup field */}
      <div className="flex items-end gap-4">
        <div className="flex-1">
          <Label className="text-xs">Markup (%)</Label>
          <Input
            type="number"
            min={0}
            step={1}
            value={markup}
            onChange={(e) => onMarkupChange(Number(e.target.value))}
            className={`mt-1 rounded-xl h-9 text-sm ${overrideSource === 'markup' ? 'border-blue-400 ring-1 ring-blue-200' : ''}`}
          />
        </div>
        {markupSugerido !== markup && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl h-9 text-xs"
            onClick={onMarkupSugeridoClick}
          >
            Sugerido: {markupSugerido}%
          </Button>
        )}
      </div>

      {/* Price override section */}
      <div className="space-y-3">
        <Separator />
        <p className="text-xs font-medium text-slate-500">Ou defina o preco diretamente</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Preco Unitario (R$)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={overrideSource === 'preco' ? (precoOverrideValue ?? '') : (pricingResult?.precoUnitario?.toFixed(2) ?? '')}
              onBlur={(e) => handlePrecoBlur(e.target.value)}
              onChange={(e) => {
                // Live update on change with debounce
                clearTimeout(debounceRef.current);
                const val = e.target.value;
                debounceRef.current = setTimeout(() => {
                  const num = parseFloat(val);
                  if (!isNaN(num) && num > 0) onPrecoOverride(num);
                }, 300);
              }}
              className={`mt-1 rounded-xl h-9 text-sm ${overrideSource === 'preco' ? 'border-blue-400 ring-1 ring-blue-200' : ''}`}
            />
          </div>
          {hasArea && (
            <div>
              <Label className="text-xs">Preco/m² (R$)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={overrideSource === 'm2' ? (precoM2OverrideValue ?? '') : (pricingResult?.precoM2?.toFixed(2) ?? '')}
                onBlur={(e) => handlePrecoM2Blur(e.target.value)}
                onChange={(e) => {
                  clearTimeout(debounceRef.current);
                  const val = e.target.value;
                  debounceRef.current = setTimeout(() => {
                    const num = parseFloat(val);
                    if (!isNaN(num) && num > 0) onPrecoM2Override(num);
                  }, 300);
                }}
                className={`mt-1 rounded-xl h-9 text-sm ${overrideSource === 'm2' ? 'border-blue-400 ring-1 ring-blue-200' : ''}`}
              />
            </div>
          )}
        </div>
        {isPrecoOverride && (
          <Badge variant="secondary" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
            Preco ajustado manualmente
          </Badge>
        )}
      </div>

      {/* Markup validations */}
      {!validacaoMarkup.valido && (
        <div className="flex items-center gap-2 text-amber-600 text-xs">
          <AlertTriangle size={14} />
          {validacaoMarkup.aviso}
        </div>
      )}
      {validacaoMarkup.valido && markup < 30 && (
        <p className="text-xs text-amber-600">
          Markup abaixo de 30% — verifique a rentabilidade
        </p>
      )}
      {markup < 0 && (
        <div className="flex items-center gap-2 text-red-600 text-xs font-semibold">
          <AlertTriangle size={14} />
          Preco abaixo do custo! Margem negativa.
        </div>
      )}

      {/* Alerts */}
      <AlertasOrcamento alerts={alerts} />

      {/* Seller summary */}
      {pricingResult && (
        <ResumoVendedor
          resultado={pricingResult}
          quantidade={quantidade}
          markup={markup}
          markupSugerido={markupSugerido}
          markupMinimo={markupMinimo}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/comercial/components/ItemStep3Revisao.tsx
git commit -m "feat(ui): create ItemStep3Revisao with bidirectional price override"
```

---

### Task 9: Update MaterialEditor — read-only for comercial role

**Files:**
- Modify: `src/domains/comercial/components/MaterialEditor.tsx`

- [ ] **Step 1: Add role check**

At the top of the component, add:
```typescript
import { useAuth } from "@/contexts/AuthContext";
```

Inside the component function:
```typescript
const { user } = useAuth();
const canEditCost = user?.role === 'admin' || user?.role === 'gerente';
```

Find the `custo_unitario` Input field and add `readOnly={!canEditCost}`:
```tsx
<Input
  type="number"
  min={0}
  step={0.01}
  value={m.custo_unitario}
  onChange={...}
  readOnly={!canEditCost}
  className={`... ${!canEditCost ? 'bg-slate-100 cursor-not-allowed' : ''}`}
/>
```

Note: Check if `useAuth` hook exists. If it uses a different name (e.g. `useAuthContext`), use that instead. Search for `useAuth` or `AuthContext` in the codebase.

- [ ] **Step 2: Commit**

```bash
git add src/domains/comercial/components/MaterialEditor.tsx
git commit -m "feat(ui): make material cost read-only for comercial role"
```

---

### Task 10: Update ResumoVendedor — override indicator

**Files:**
- Modify: `src/domains/comercial/components/ResumoVendedor.tsx`

- [ ] **Step 1: Add optional override indicator**

Add prop `isPrecoOverride?: boolean` to `ResumoVendedorProps`.

After the price box, add:
```tsx
{isPrecoOverride && (
  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 text-center">
    <span className="text-[10px] font-medium text-amber-700">Preco ajustado manualmente</span>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/comercial/components/ResumoVendedor.tsx
git commit -m "feat(ui): add override indicator to ResumoVendedor"
```

---

## Chunk 4: Wire Everything + AI Appliers + Cleanup

### Task 11: Refactor OrcamentoEditorPage to use new components

> **Scope note:** This plan extracts `useItemEditor` + `ItemStep3Revisao` — the two components needed for the pricing evolution features. The remaining 6 components (`OrcamentoHeader`, `OrcamentoDadosForm`, `OrcamentoItensTable`, `ItemWizard`, `ItemStep1Produto`, `ItemStep2Materiais`, `OrcamentoResumoFinanceiro`) are deferred to a follow-up refactor plan to keep this PR focused on pricing.

**Files:**
- Modify: `src/domains/comercial/pages/OrcamentoEditorPage.tsx`

- [ ] **Step 1: Replace item editor logic with useItemEditor hook**

This is the largest change. Replace ALL item editor state and handlers with the `useItemEditor` hook. Replace Step 3 content with `ItemStep3Revisao` component.

Key replacements:
1. Remove `useState<ItemEditorState>` and `DEFAULT_ITEM` — use `useItemEditor().newItem` instead
2. Remove `handleProdutoChange`, `handleModeloChange`, etc. — use hook's handlers
3. Remove `pricingInput` useMemo — use hook's `pricingInput`
4. Remove pricing-related state — use hook's returns
5. In Step 3 render, replace markup input + ResumoVendedor with `<ItemStep3Revisao ... />`
6. In `handleAddItem`, check `isPrecoOverride` and include `preco_override: true` when saving

The `OrcamentoEditorPage` should import from `useItemEditor` and delegate:
```typescript
const editor = useItemEditor();
```

Then use `editor.newItem`, `editor.pricingResult`, `editor.handleMarkupChange`, etc.

In `handleAddItem`, update the item payload to include:
```typescript
preco_override: editor.isPrecoOverride,
```

Also disable the "Adicionar Item" button when config is default (no real config in DB):
```typescript
<Button
  disabled={editor.isDefaultConfig}
  onClick={handleAddItem}
>
  Adicionar Item
</Button>
```

- [ ] **Step 2: Verify build compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No new type errors

- [ ] **Step 3: Commit**

```bash
git add src/domains/comercial/pages/OrcamentoEditorPage.tsx
git commit -m "refactor(ui): wire OrcamentoEditorPage to useItemEditor + ItemStep3Revisao"
```

---

### Task 12: Update AI appliers to use motor

**Files:**
- Modify: `src/domains/ai/appliers/orcamento/precoApplier.ts`
- Modify: `src/domains/ai/appliers/orcamento/materialApplier.ts`
- Modify: `src/domains/ai/appliers/orcamento/acabamentoApplier.ts`
- Modify: `src/domains/ai/appliers/orcamento/quantidadeApplier.ts`

- [ ] **Step 1: Update precoApplier to save markup + preco_override**

Replace `src/domains/ai/appliers/orcamento/precoApplier.ts`:

```typescript
import type { AIAction, ApplierContext, ApplierResult } from '../../types/ai.types';

export async function precoApplier(action: AIAction, ctx: ApplierContext): Promise<ApplierResult> {
  const suggested = action.valor_sugerido as { item_id: string; preco: number };
  const previous = action.valor_atual as { item_id: string; preco: number };

  if (!suggested?.item_id || !suggested?.preco) {
    return { success: false, message: 'Dados insuficientes: item_id e preco obrigatorios' };
  }

  // Update price + markup + override flag together
  const { error, count } = await ctx.supabase
    .from('proposta_itens')
    .update({
      valor_unitario: suggested.preco,
      valor_total: suggested.preco * ((await ctx.supabase
        .from('proposta_itens')
        .select('quantidade')
        .eq('id', suggested.item_id)
        .single()).data?.quantidade ?? 1),
      preco_override: true,
    })
    .eq('id', suggested.item_id)
    .eq('proposta_id', ctx.entityId);

  if (error) return { success: false, message: `Erro ao atualizar preco: ${error.message}` };
  if (count === 0) return { success: false, message: `Item ${suggested.item_id} nao encontrado nesta proposta` };

  return {
    success: true,
    message: `Preco atualizado de R$ ${previous?.preco?.toFixed(2) ?? '?'} para R$ ${suggested.preco.toFixed(2)} (override IA)`,
    rollback: async () => {
      if (previous?.preco) {
        await ctx.supabase
          .from('proposta_itens')
          .update({ valor_unitario: previous.preco, preco_override: false })
          .eq('id', suggested.item_id);
      }
    },
  };
}
```

- [ ] **Step 2: Update materialApplier to trigger recalculation**

In `materialApplier.ts`, after the main update, add:
```typescript
// Trigger totals recalculation after material change
await ctx.supabase.rpc('recalcular_totais_proposta', { proposta_id_param: ctx.entityId }).catch(() => {});
```

Note: If `recalcular_totais_proposta` RPC doesn't exist, the applier should at minimum invalidate the cache. Check if `orcamentoService.recalcularTotais` is available. If not, the frontend invalidation via `queryClient.invalidateQueries` (already done in useAISidebar's onActionsApplied callback) handles this.

- [ ] **Step 3: Update acabamentoApplier to trigger recalculation**

In `acabamentoApplier.ts`, after adding/modifying an acabamento, ensure recalculation is triggered. The acabamento now participates in the motor (overhead), so any change must invalidate pricing:

```typescript
// After the main acabamento update succeeds:
// Frontend invalidation handles recalc via queryClient.invalidateQueries
// But if direct DB update, also recalc valor_total on proposta_itens
```

Read the current `acabamentoApplier.ts` file. If it directly writes to `proposta_item_acabamentos`, verify it does NOT also write a stale `valor_unitario`. The motor will recalculate on next render.

- [ ] **Step 4: Update quantidadeApplier to check volume discount tier**

In `quantidadeApplier.ts`, after changing quantity:
1. The volume discount tier may change — the frontend hook handles this automatically
2. Ensure the applier does NOT write a stale `valor_unitario` after quantity change
3. Add a comment noting that volume discount is applied client-side via `useItemEditor`

Read the current `quantidadeApplier.ts` file and verify it only updates `quantidade` on the DB row, letting the frontend recalculate pricing.

- [ ] **Step 5: Commit**

```bash
git add src/domains/ai/appliers/orcamento/precoApplier.ts src/domains/ai/appliers/orcamento/materialApplier.ts src/domains/ai/appliers/orcamento/acabamentoApplier.ts src/domains/ai/appliers/orcamento/quantidadeApplier.ts
git commit -m "feat(ai): update all appliers for pricing evolution — preco_override + recalc"
```

---

### Task 13: Cleanup — remove preco_fixo from TypeScript

**Files:**
- Modify: `src/domains/comercial/hooks/useProdutosModelos.ts` — remove `preco_fixo` from `ProdutoModelo` interface
- Modify: `src/domains/comercial/services/produto.service.ts` — remove `preco_fixo` from type
- Modify: `src/pages/Produtos.tsx` — remove preco_fixo form field and display
- Modify: `src/domains/admin/pages/AdminProdutosPage.tsx` — remove preco_fixo from modelo form (lines ~420, 437, 452, 481, 606-608) BUT KEEP preco_fixo in servicos section (~2114, 2126, 2135, 2153, 2237-2239, 2429)
- Modify: `src/shared/schemas/comercial.schemas.ts` — KEEP `preco_fixo` in `servicoSchema` (line 249), this is servicos table not produto_modelos

**CRITICAL**: `servicos.preco_fixo` is a DIFFERENT column and MUST be kept. Only remove from `produto_modelos` context.

- [ ] **Step 1: Remove preco_fixo from ProdutoModelo interface**

In `src/domains/comercial/hooks/useProdutosModelos.ts`:
- Remove `preco_fixo: number | null;` from the `ProdutoModelo` interface (line 34)
- Remove `preco_fixo?: number` from the `useCreateModelo` mutation type (~line 232)
- **KEEP** `preco_fixo` in the `Servico` interface (~line 83) — this is `servicos.preco_fixo`, a different table

- [ ] **Step 2: Remove from produto.service.ts**

In `src/domains/comercial/services/produto.service.ts`, remove `preco_fixo?: number;` (line 24).

- [ ] **Step 3: Remove from Produtos.tsx form**

In `src/pages/Produtos.tsx`:
- Remove `preco_fixo: "" as string | number,` from default state (line 401)
- Remove `preco_fixo: editando?.preco_fixo ?? "",` (line 411)
- Remove `preco_fixo: form.preco_fixo !== "" ? Number(form.preco_fixo) : null,` (line 422)
- Remove the Preco Fixo Input block (~lines 490-494)
- Remove `{m.preco_fixo && <span ...>}` display (line 609)

- [ ] **Step 4: Remove from AdminProdutosPage.tsx — ONLY modelo section**

In `src/domains/admin/pages/AdminProdutosPage.tsx`:
- Remove `preco_fixo: number | null;` from the Modelo interface (line 72)
- Remove `preco_fixo: "",` from default form state (~420, 452)
- Remove `preco_fixo: modelo.preco_fixo != null ? String(modelo.preco_fixo) : "",` (~437)
- Remove `if (form.preco_fixo) payload.preco_fixo = parseFloat(form.preco_fixo);` (~481)
- Remove the Preco Fixo Input in modelo form (~605-608)

**DO NOT touch** the servicos section (~2113-2239, 2429) which uses `preco_fixo` for the `servicos` table.

- [ ] **Step 5: Verify build compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Note: `types.ts` (supabase auto-generated) will still have `preco_fixo` — that's OK, it reflects the DB and will update when types are regenerated after migration.

- [ ] **Step 6: Commit**

```bash
git add src/domains/comercial/hooks/useProdutosModelos.ts src/domains/comercial/services/produto.service.ts src/pages/Produtos.tsx src/domains/admin/pages/AdminProdutosPage.tsx
git commit -m "cleanup: remove preco_fixo from produto_modelos code (keep servicos.preco_fixo)"
```

---

### Task 14: Run full test suite + build check

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: ALL PASS (102+ existing + new tests)

- [ ] **Step 2: Run build**

```bash
npx vite build 2>&1 | tail -20
```

Expected: Build succeeds with no errors

- [ ] **Step 3: If any failures, fix and commit**

---

## Summary

| Task | What | Files | Independent? |
|------|------|-------|-------------|
| 1 | Migration SQL | `supabase/migrations/035_*` | Yes |
| 2 | calcMarkupReverso + remove calcPrecoRapido | `pricing-engine.ts`, tests | Yes |
| 3 | Acabamentos in motor + setup time + calcMarkupParaPreco | `orcamento-pricing.service.ts`, tests | Depends on Task 2 |
| 4 | Update explainer | `pricing-explainer.ts` | Yes |
| 5 | useConfigPrecificacao isDefault | `useOrcamentoPricing.ts` | Yes |
| 6 | Volume discount hook | `useFaixasQuantidade.ts` | Yes |
| 7 | useItemEditor hook | `useItemEditor.ts` | Depends on Tasks 3, 5, 6 |
| 8 | ItemStep3Revisao component | `ItemStep3Revisao.tsx` | Depends on Task 7 |
| 9 | MaterialEditor read-only | `MaterialEditor.tsx` | Yes |
| 10 | ResumoVendedor override indicator | `ResumoVendedor.tsx` | Yes |
| 11 | Wire OrcamentoEditorPage | `OrcamentoEditorPage.tsx` | Depends on Tasks 7, 8 |
| 12 | AI appliers update | `precoApplier.ts`, etc. | Yes |
| 13 | Cleanup preco_fixo | Multiple files | Depends on Task 1 (migration) |
| 14 | Full test + build | None | Depends on all |

**Parallel execution groups:**
- **Wave 1** (independent): Tasks 1, 2, 4, 5, 6, 9, 10
- **Wave 2** (depends on wave 1): Tasks 3, 7, 12, 13
- **Wave 3** (depends on wave 2): Tasks 8, 11
- **Wave 4** (final): Task 14

> **Note:** Task 12 (AI appliers) moved to Wave 2 because `precoApplier` should reference `calcMarkupReverso` from Task 2.

**Deferred to follow-up plan:**
- Material price history UI (sparkline in admin/materiais) — migration creates table + trigger, UI deferred per spec
- Remaining editor refactor: 6 components (`OrcamentoHeader`, `OrcamentoDadosForm`, `OrcamentoItensTable`, `ItemWizard`, `ItemStep1Produto`, `ItemStep2Materiais`, `OrcamentoResumoFinanceiro`)
