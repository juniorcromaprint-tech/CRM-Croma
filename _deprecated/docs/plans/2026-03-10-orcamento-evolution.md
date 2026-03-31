# Orçamento Evolution — Plano de Implementação

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transformar o módulo de orçamentos da Croma Print de um sistema parcialmente mockado em um sistema profissional de precificação para comunicação visual — com catálogo real, cálculo correto, persistência completa e integração pedido.

**Architecture:** Domain-driven (domains/comercial + domains/admin). Motor Mubisys corrigido em pricing-engine.ts. Tabelas 006+007 para persistência completa. Catálogo de produtos com CRUD real substituindo mock.

**Tech Stack:** React 19, TypeScript, Supabase (PostgreSQL + RLS), TanStack Query v5, shadcn/ui, Zod, pricing-engine.ts (Mubisys)

**Documentos de referência:**
- `docs/ORCAMENTO_AUDIT.md` — todos os bugs e problemas encontrados
- `docs/PRICING_ARCHITECTURE.md` — arquitetura final e decisões

---

## FASE 0 — Setup e Verificação

### Task 0.1: Verificar estado atual do banco

**Files:** (apenas consulta, sem alteração)

**Step 1:** Verificar tabelas ausentes
```bash
cd /c/Users/Caldera/Claude/CRM-Croma
# Verificar via Supabase API se acabamentos existe
curl -s "https://djwjmfgplnqyffdcgdaw.supabase.co/rest/v1/acabamentos?limit=1" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqd2ptZmdwbG5xeWZmZGNnZGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjU2OTcsImV4cCI6MjA4ODY0MTY5N30.pi2HDGyXhsoZS0sivfUDzn9z3Qao-6hMKrWBxoQ-1uE"
```
Expected: 404 ou relation does not exist → confirmado que 006 não foi executada

**Step 2:** Build limpo antes de começar
```bash
cd /c/Users/Caldera/Claude/CRM-Croma && npm run build 2>&1 | tail -20
```
Expected: `✓ built in X.Xs` com zero erros

**Step 3:** Commit estado atual antes das mudanças
```bash
git add -A && git status
```

---

## FASE 1 — Corrigir o Motor de Precificação (P0 — bloqueadores matemáticos)

### Task 1.1: Corrigir pricing-engine.ts

**Files:**
- Modify: `src/shared/services/pricing-engine.ts`

**Bugs a corrigir:**
- BUG-01: `precoVenda` multiplica quantidade no motor → mover para camada acima
- BUG-07: Markup Passo 8 divide por (1-Pv) duas vezes → remover segunda divisão
- Exposição: tornar públicas as funções atualmente mortas (calcBreakEven, simularDesconto, etc.)

**Step 1:** Ler o arquivo completo antes de editar
```bash
cat src/shared/services/pricing-engine.ts | head -280
```

**Step 2:** Corrigir Passo 8 (linha ~244) — remover dupla divisão:
```typescript
// ANTES (bugado):
const Vm = (Vam * markupPercentual / 100) / (1 - Pv);

// DEPOIS (correto):
const Vm = Vam * (markupPercentual / 100);
```

**Step 3:** Corrigir Passo 9 — precoVenda sempre unitário:
```typescript
// ANTES (bugado): multiplica por quantidade dentro do motor
const precoVenda = precoVendaUnitario * (input.quantidade ?? 1);

// DEPOIS (correto): motor sempre retorna unitário
const precoVenda = precoVendaUnitario;
// quantidade é removida do PricingInput — não é responsabilidade do motor
```

**Step 4:** Remover `quantidade` do tipo `PricingInput`:
```typescript
// ANTES:
interface PricingInput {
  materiais: MaterialItem[];
  processos: ProcessoItem[];
  markupPercentual: number;
  quantidade?: number;  // ← REMOVER
}

// DEPOIS:
interface PricingInput {
  materiais: MaterialItem[];
  processos: ProcessoItem[];
  markupPercentual: number;
}
```

**Step 5:** Build para verificar
```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

---

### Task 1.2: Corrigir orcamento-pricing.service.ts

**Files:**
- Modify: `src/shared/services/orcamento-pricing.service.ts`

**Bugs a corrigir:**
- BUG-02: Acabamentos entram no motor como materiais (dupla contagem)
- BUG-01 consequência: `precoTotal = precoVenda * quantidade` → agora correto pois motor retorna unitário
- Normalizar nomenclatura: sempre usar `valor_total` (não `preco_total`)

**Step 1:** Separar acabamentos dos materiais no input do motor:
```typescript
// ANTES: acabamentos misturados com materiais
const allMateriais = [
  ...item.materiais.map(m => ({ nome: m.descricao, quantidade: m.quantidade, precoUnitario: m.custo_unitario })),
  ...item.acabamentos.map(a => ({ nome: a.descricao, quantidade: a.quantidade, precoUnitario: a.custo_unitario })),
];

// DEPOIS: materiais apenas (sem acabamentos)
const materiaisParaMotor = item.materiais.map(m => ({
  nome: m.descricao,
  quantidade: m.quantidade,
  precoUnitario: m.custo_unitario,
}));

// Acabamentos calculados DEPOIS do motor, somados ao final
const custoAcabamentos = item.acabamentos.reduce(
  (sum, a) => sum + a.quantidade * a.custo_unitario, 0
);
```

**Step 2:** Calcular precoUnitario corretamente (motor já retorna unitário):
```typescript
const pricingResult = calcPricing({ materiais: materiaisParaMotor, processos, markupPercentual }, config);

const precoUnitario = pricingResult.precoVenda + custoAcabamentos;
const precoTotal = precoUnitario * item.quantidade;
```

**Step 3:** Corrigir breakdown (sem subtração):
```typescript
return {
  custoMP: pricingResult.custoMP,                    // ← sem subtrair acabamentos
  custosAcabamentos: custoAcabamentos,               // ← custo real dos acabamentos
  custoMO: pricingResult.custoMO,
  custoFixo: pricingResult.custoFixo,
  custoTotal: pricingResult.custoTotal + custoAcabamentos,
  precoUnitario,                                     // ← unitário real
  precoTotal,                                        // ← unitário × quantidade
  margemBruta: precoUnitario - (pricingResult.custoTotal + custoAcabamentos),
  areaM2: calcAreaM2(item.largura_cm, item.altura_cm),
  precoM2: item.largura_cm && item.altura_cm
    ? precoUnitario / calcAreaM2(item.largura_cm, item.altura_cm)
    : undefined,
  detalhes: pricingResult,
};
```

**Step 4:** Build
```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

**Step 5:** Commit
```bash
git add src/shared/services/pricing-engine.ts src/shared/services/orcamento-pricing.service.ts
git commit -m "fix(pricing): corrigir BUG-01 (qtd ao quadrado), BUG-02 (acabamentos duplos), BUG-07 (markup inflado)"
```

---

## FASE 2 — Executar Migrations SQL

### Task 2.1: Corrigir e executar migration 006

**Files:**
- Modify: `supabase/migrations/006_orcamento_module.sql` (corrigir bug antes de executar)

**Step 1:** Corrigir BUG-05 na migration 006:
```sql
-- Encontrar a linha com:
categoria TEXT DEFAULT 'servico'
-- Substituir por:
categoria TEXT DEFAULT 'outro'
-- 'servico' não está no CHECK, 'outro' está
```

**Step 2:** Executar a migration no Supabase
Copiar o conteúdo de `supabase/migrations/006_orcamento_module.sql` e executar no:
`https://supabase.com/dashboard/project/djwjmfgplnqyffdcgdaw/sql/new`

**Step 3:** Verificar execução
```bash
curl -s "https://djwjmfgplnqyffdcgdaw.supabase.co/rest/v1/acabamentos?limit=3" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqd2ptZmdwbG5xeWZmZGNnZGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjU2OTcsImV4cCI6MjA4ODY0MTY5N30.pi2HDGyXhsoZS0sivfUDzn9z3Qao-6hMKrWBxoQ-1uE"
```
Expected: JSON com array de acabamentos (ilhós, bastão, bainha, etc.)

---

### Task 2.2: Criar e executar migration 007

**Files:**
- Create: `supabase/migrations/007_orcamento_campos.sql`

**Step 1:** Criar o arquivo:
```sql
-- Migration 007: Campos técnicos para rastreabilidade de custeio
-- Data: 2026-03-10

-- 1. proposta_itens: adicionar modelo_id para rastreabilidade
ALTER TABLE proposta_itens
  ADD COLUMN IF NOT EXISTS modelo_id UUID REFERENCES produto_modelos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_proposta_itens_modelo ON proposta_itens(modelo_id);

-- 2. pedido_itens: adicionar campos técnicos de custeio
ALTER TABLE pedido_itens
  ADD COLUMN IF NOT EXISTS modelo_id          UUID REFERENCES produto_modelos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custo_mp           NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_mo           NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_fixo         NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS markup_percentual  NUMERIC(5,2)  DEFAULT 40,
  ADD COLUMN IF NOT EXISTS largura_cm         NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS altura_cm          NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS area_m2            NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS prazo_producao_dias INTEGER;

-- 3. Recriar regras_precificacao com schema colunar (mais legível)
-- DROP a tabela criada pela 006 e recriar com schema adequado
DROP TABLE IF EXISTS regras_precificacao;

CREATE TABLE regras_precificacao (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria       TEXT NOT NULL,
  markup_minimo   NUMERIC(5,2) NOT NULL DEFAULT 30,
  markup_sugerido NUMERIC(5,2) NOT NULL DEFAULT 45,
  desconto_maximo NUMERIC(5,2) DEFAULT 15,
  preco_m2_minimo NUMERIC(12,2),
  taxa_urgencia   NUMERIC(5,2) DEFAULT 50,
  ativo           BOOLEAN DEFAULT TRUE,
  criado_por      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trigger_regras_precificacao_updated_at
  BEFORE UPDATE ON regras_precificacao
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE regras_precificacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regras_precificacao_read" ON regras_precificacao FOR SELECT USING (true);
CREATE POLICY "regras_precificacao_write" ON regras_precificacao FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'diretor'))
);

-- Seed inicial
INSERT INTO regras_precificacao (categoria, markup_minimo, markup_sugerido, desconto_maximo, preco_m2_minimo) VALUES
  ('banner',   30, 45, 15, 18),
  ('adesivo',  35, 50, 10, 22),
  ('fachada',  40, 60, 10, 85),
  ('placa',    35, 55, 12, 45),
  ('letreiro', 45, 70, 8,  120),
  ('geral',    30, 45, 15, NULL);
```

**Step 2:** Executar no Supabase SQL Editor

**Step 3:** Verificar
```bash
curl -s "https://djwjmfgplnqyffdcgdaw.supabase.co/rest/v1/regras_precificacao" \
  -H "apikey: ..."
```
Expected: array com 6 regras

**Step 4:** Commit
```bash
git add supabase/migrations/006_orcamento_module.sql supabase/migrations/007_orcamento_campos.sql
git commit -m "sql: executar migration 006 (fix categoria) + 007 (modelo_id + custeio pedido_itens + regras)"
```

---

## FASE 3 — Corrigir o Serviço de Orçamento

### Task 3.1: Atualizar orcamento.service.ts

**Files:**
- Modify: `src/domains/comercial/services/orcamento.service.ts`

**Step 1:** Adicionar `modelo_id` ao tipo `OrcamentoItemCreateInput`:
```typescript
export interface OrcamentoItemCreateInput {
  proposta_id: string;
  produto_id?: string;
  modelo_id?: string;    // ← NOVO
  descricao: string;
  especificacao?: string;
  quantidade: number;
  unidade?: string;
  largura_cm?: number;
  altura_cm?: number;
  area_m2?: number;
  custo_mp?: number;
  custo_mo?: number;
  custo_fixo?: number;
  markup_percentual?: number;
  valor_unitario: number;
  valor_total: number;
  prazo_producao_dias?: number;
}
```

**Step 2:** Corrigir `duplicar` para usar `adicionarItemDetalhado`:
```typescript
// ANTES: usava adicionarItem (perdia materiais)
for (const item of itens) {
  await this.adicionarItem(novoId, { ...item });
}

// DEPOIS: usa adicionarItemDetalhado
for (const item of itens) {
  const materiais = item.materiais ?? [];
  const acabamentos = item.acabamentos ?? [];
  await this.adicionarItemDetalhado(novoId, { ...item, materiais, acabamentos });
}
```

**Step 3:** Expandir `converterParaPedido` com campos técnicos:
```typescript
// Ao inserir em pedido_itens, incluir campos de custeio:
const pedidoItens = itens.map(item => ({
  pedido_id: pedidoId,
  proposta_item_id: item.id,
  produto_id: item.produto_id,
  modelo_id: item.modelo_id,          // ← novo
  descricao: item.descricao,
  especificacao: item.especificacao,
  quantidade: item.quantidade,
  unidade: item.unidade,
  largura_cm: item.largura_cm,        // ← novo
  altura_cm: item.altura_cm,          // ← novo
  area_m2: item.area_m2,              // ← novo
  valor_unitario: item.valor_unitario,
  valor_total: item.valor_total,
  custo_mp: item.custo_mp,            // ← novo
  custo_mo: item.custo_mo,            // ← novo
  custo_fixo: item.custo_fixo,        // ← novo
  markup_percentual: item.markup_percentual, // ← novo
  prazo_producao_dias: item.prazo_producao_dias, // ← novo
  status: 'pendente',
}));

// Calcular e salvar custo_total e margem_real no pedido:
const custoTotal = itens.reduce((s, i) => s + (i.custo_mp ?? 0) + (i.custo_mo ?? 0) + (i.custo_fixo ?? 0), 0);
const margemReal = valorTotal > 0 ? ((valorTotal - custoTotal) / valorTotal) * 100 : 0;
// UPDATE pedidos SET custo_total, margem_real, aprovado_por
```

**Step 4:** Remover `try/catch` silencioso — substituir por alerta ao usuário:
```typescript
// Ao invés de silenciar: mostrar toast de aviso se tabelas não existirem
// Ou: remover o try/catch agora que a migration 006 foi executada
```

**Step 5:** Build
```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

**Step 6:** Commit
```bash
git add src/domains/comercial/services/orcamento.service.ts
git commit -m "fix(orcamento): duplicar preserva materiais, converterParaPedido copia custeio completo"
```

---

### Task 3.2: Mover recalcularTotais para os hooks

**Files:**
- Modify: `src/domains/comercial/hooks/useOrcamentos.ts`

**Step 1:** Mover chamada de `recalcularTotais` para dentro de cada mutation:
```typescript
// Cada mutation que modifica itens deve recalcular totais ao final:
export function useAdicionarItemDetalhado() {
  return useMutation({
    mutationFn: async (params) => {
      const item = await orcamentoService.adicionarItemDetalhado(params.propostaId, params.item);
      await orcamentoService.recalcularTotais(params.propostaId);  // ← adicionar aqui
      return item;
    },
    onSuccess: (_, { propostaId }) => {
      queryClient.invalidateQueries({ queryKey: [ORCAMENTOS_QUERY_KEY, propostaId] });
    },
  });
}
// Idem para: useRemoverItemOrcamento, useSalvarServicos
```

**Step 2:** Build + Commit
```bash
npm run build 2>&1 | tail -5
git add src/domains/comercial/hooks/useOrcamentos.ts
git commit -m "refactor(hooks): recalcularTotais movido para dentro dos hooks (SRP)"
```

---

## FASE 4 — Catálogo de Produtos Real

### Task 4.1: Criar produto.service.ts

**Files:**
- Create: `src/domains/comercial/services/produto.service.ts`

**Step 1:** Criar service com CRUD completo:
```typescript
export const produtoService = {
  // Produtos
  async listar(filtros?: { categoria?: string; ativo?: boolean }): Promise<Produto[]> {
    let q = supabase.from("produtos").select("*");
    if (filtros?.ativo !== undefined) q = q.eq("ativo", filtros.ativo);
    if (filtros?.categoria) q = q.eq("categoria", filtros.categoria);
    const { data, error } = await q.order("nome");
    if (error) throw error;
    return data ?? [];
  },

  async criar(dados: { nome: string; categoria: string; unidade_padrao?: string; descricao?: string }): Promise<Produto> {
    const { data, error } = await supabase.from("produtos").insert(dados).select().single();
    if (error) throw error;
    return data;
  },

  async atualizar(id: string, dados: Partial<Produto>): Promise<Produto> {
    const { data, error } = await supabase.from("produtos").update(dados).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  // Modelos
  async criarModelo(produtoId: string, dados: Omit<ProdutoModelo, "id" | "produto_id">): Promise<ProdutoModelo> { ... },
  async atualizarModelo(id: string, dados: Partial<ProdutoModelo>): Promise<ProdutoModelo> { ... },
  async excluirModelo(id: string): Promise<void> { ... },

  // Materiais do modelo (replace-all)
  async salvarMaterialModelo(modeloId: string, materiais: Array<{ material_id: string; quantidade_por_unidade: number; unidade: string }>): Promise<void> {
    await supabase.from("modelo_materiais").delete().eq("modelo_id", modeloId);
    if (materiais.length > 0) {
      await supabase.from("modelo_materiais").insert(
        materiais.map(m => ({ ...m, modelo_id: modeloId }))
      );
    }
  },

  // Processos do modelo (replace-all)
  async salvarProcessosModelo(modeloId: string, processos: Array<{ etapa: string; tempo_por_unidade_min: number; ordem: number }>): Promise<void> { ... },
};
```

**Step 2:** Build + Commit

---

### Task 4.2: Adicionar hooks de mutação ao useProdutosModelos.ts

**Files:**
- Modify: `src/domains/comercial/hooks/useProdutosModelos.ts`

**Step 1:** Adicionar hooks de create/update/delete:
```typescript
export function useCriarProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: produtoService.criar,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["produtos"] }),
  });
}

export function useAtualizarProduto() { ... }
export function useCriarModelo() { ... }
export function useAtualizarModelo() { ... }
export function useExcluirModelo() { ... }
export function useSalvarMaterialModelo() { ... }
export function useSalvarProcessosModelo() { ... }
```

**Step 2:** Build + Commit

---

### Task 4.3: Criar AdminProdutosPage.tsx

**Files:**
- Create: `src/domains/admin/pages/AdminProdutosPage.tsx`
- Modify: `src/App.tsx` (adicionar rota `/admin/produtos`)
- Modify: `src/shared/constants/navigation.ts` (adicionar item de menu)

**Step 1:** Criar página com:
- Lista de produtos (agrupada por categoria)
- Accordion de modelos por produto
- Dialogs de criação/edição de produto
- Dialogs de criação/edição de modelo
- Editor de materiais do modelo (busca nos 467 materiais do catálogo)
- Editor de processos do modelo
- Botão ativar/desativar produto

**Step 2:** Adicionar rota em App.tsx:
```typescript
{ path: "/admin/produtos", element: <AdminProdutosPage /> }
```

**Step 3:** Remover (ou marcar como deprecated) `src/pages/Produtos.tsx` — substituído pelo AdminProdutosPage

**Step 4:** Build + Commit
```bash
git add src/domains/admin/pages/AdminProdutosPage.tsx src/App.tsx src/shared/constants/navigation.ts
git commit -m "feat(admin): AdminProdutosPage com CRUD real de produtos/modelos/materiais"
```

---

## FASE 5 — Editor de Orçamento

### Task 5.1: Corrigir OrcamentoEditorPage — persistir modelo_id

**Files:**
- Modify: `src/domains/comercial/pages/OrcamentoEditorPage.tsx`

**Step 1:** Incluir `modelo_id` no `ItemEditorState`:
```typescript
interface ItemEditorState {
  produto_id: string | null;
  modelo_id: string | null;     // ← garantir que existe
  // ...resto
}
```

**Step 2:** Incluir `modelo_id` ao chamar `adicionarItemDetalhado`:
```typescript
await adicionarItem.mutateAsync({
  propostaId: id,
  item: {
    produto_id: newItem.produto_id ?? undefined,
    modelo_id: newItem.modelo_id ?? undefined,   // ← NOVO
    // ...resto
  }
});
```

**Step 3:** Corrigir `handleTemplateSelect` para aplicar TODOS os itens (não só o primeiro):
```typescript
// ANTES: template.itens[0]
// DEPOIS:
async function handleTemplateSelect(template: OrcamentoTemplate) {
  for (const item of template.itens) {
    setNewItem({ /* preencher com item */ });
    // OU: criar todos de uma vez via mutations em sequência
  }
  setTemplateOpen(false);
}
```

**Step 4:** Restaurar estado dos itens existentes ao editar orçamento:
```typescript
// Quando mode === 'editar', carregar materiais/acabamentos do item existente
// via proposta_item_materiais e proposta_item_acabamentos
// para que o PricingCalculator mostre os valores corretos
```

**Step 5:** Adicionar validação de margem mínima (alertas visíveis):
```typescript
// Usar validarMarkup() e mostrar badge/alerta quando abaixo do mínimo
const validacao = validarMarkup(newItem.markup_percentual, categoria, regras);
if (!validacao.valido) {
  // exibir: "⚠️ Markup abaixo do mínimo (30%) para banner"
}
```

**Step 6:** Build + Commit
```bash
git add src/domains/comercial/pages/OrcamentoEditorPage.tsx
git commit -m "fix(editor): modelo_id persistido, template aplica todos itens, validação de margem"
```

---

## FASE 6 — Corrigir Admin Precificação e Pedidos

### Task 6.1: Corrigir AdminPrecificacaoPage schema

**Files:**
- Modify: `src/domains/admin/pages/AdminPrecificacaoPage.tsx`

**Step 1:** Atualizar interface para schema colunar da migration 007:
```typescript
interface RegraPrecificacao {
  id: string;
  categoria: string;
  markup_minimo: number;
  markup_sugerido: number;
  desconto_maximo: number;
  preco_m2_minimo: number | null;
  taxa_urgencia: number;
  ativo: boolean;
}
```

**Step 2:** Garantir que as queries usam os nomes corretos de coluna (não `tipo`/`valor`)

**Step 3:** Build + Commit

---

### Task 6.2: Corrigir PedidosPage — bug margem_real

**Files:**
- Modify: `src/domains/pedidos/pages/PedidosPage.tsx`

**Step 1:** Renomear `margem_percentual` → `margem_real` na interface local:
```typescript
interface PedidoRow {
  // ...
  margem_real: number;  // era margem_percentual (ERRADO)
  // ...
}
```

**Step 2:** Atualizar todas as referências no JSX (`margem_percentual` → `margem_real`)

**Step 3:** Implementar listagem real de itens no detalhe do pedido (substituir placeholder):
```typescript
// Buscar pedido_itens e renderizar tabela real
// usar usePedidoItens(pedidoId) que já existe
```

**Step 4:** Build + Commit
```bash
git add src/domains/pedidos/pages/PedidosPage.tsx
git commit -m "fix(pedidos): margem_real (era margem_percentual), listagem de itens funcional"
```

---

## FASE 7 — pricing-explainer.ts + UX Final

### Task 7.1: Criar pricing-explainer.ts

**Files:**
- Create: `src/shared/services/pricing-explainer.ts`

**Step 1:** Implementar função que gera explicação em português:
```typescript
export function explicarCalculo(
  input: OrcamentoItemInput,
  resultado: OrcamentoItemPricingResult,
  config: PricingConfig
): ExplicacaoCalculo {
  return {
    resumo: `Banner ${input.largura_cm}cm × ${input.altura_cm}cm = ${resultado.areaM2?.toFixed(2)}m²`,
    passos: [
      {
        passo: 1,
        nome: "Custo de Matéria-Prima",
        formula: input.materiais.map(m => `${m.descricao} (${m.quantidade} × R$${m.custo_unitario})`).join(" + "),
        resultado: resultado.custoMP,
        explicacao: "Soma dos insumos necessários para produzir 1 unidade",
      },
      // ... demais passos
    ],
    alertas: [
      resultado.percMargem < 20 ? `⚠️ Margem de ${resultado.percMargem.toFixed(1)}% está abaixo do mínimo recomendado (20%)` : null,
    ].filter(Boolean) as string[],
  };
}
```

**Step 2:** Integrar no PricingCalculator (exibir "Como foi calculado" expandível)

**Step 3:** Build + Commit

---

## FASE 8 — Documentação Final

### Task 8.1: Criar documentos do domínio

**Files:**
- Create: `docs/ORCAMENTO_DOMAIN.md`
- Create: `docs/PRODUCT_CATALOG.md`
- Create: `docs/ORCAMENTO_WORKFLOW.md`
- Create: `docs/DATA_MODEL_ORCAMENTO.md`
- Update: `docs/PRICING_ENGINE.md` (com correções dos bugs)

### Task 8.2: Atualizar MEMORY.md no .claude/

**Files:**
- Update: `C:\Users\Caldera\.claude\projects\...\memory\MEMORY.md`

---

## FASE 9 — Build Final e Deploy

### Task 9.1: Build e verificação

```bash
cd /c/Users/Caldera/Claude/CRM-Croma

# Build limpo
npm run build 2>&1 | tail -10
# Expected: ✓ built in Xs, zero TypeScript errors

# Verificar que proposta_item_materiais salva real
# Abrir /orcamentos/novo → criar item → verificar no Supabase
```

### Task 9.2: Commit final e push

```bash
git add -A
git commit -m "feat(orcamento): implementação completa — motor corrigido, persistência real, catálogo CRUD, pedido com custeio"
git push origin main
```

---

## Sequência de Prioridade

```
P0 (Hoje)      → Fase 1 (engine), Fase 2 (migrations)
P1 (Semana 1)  → Fase 3 (service), Fase 4 (produtos)
P2 (Semana 1)  → Fase 5 (editor), Fase 6 (admin+pedidos)
P3 (Semana 2)  → Fase 7 (explainer), Fase 8 (docs)
P4 (Semana 2)  → Fase 9 (build+deploy)
```

## Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Migration 006 tem outros bugs | Baixa | Executar em staging primeiro |
| Remover quantidade do PricingInput quebra outros consumidores | Média | Buscar todos os imports de calcPricing antes de alterar |
| AdminPrecificacaoPage já tem dados no banco quando 007 executar | Baixa | 007 faz DROP + CREATE, não migra dados (ok, tabela estava vazia) |
| OrcamentoEditorPage refactor introduz regressão | Média | Build TypeScript verifica; testar fluxo completo manualmente |
