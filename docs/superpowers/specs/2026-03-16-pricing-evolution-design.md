# Evolucao do Motor de Precificacao — Design Spec

> **Data**: 2026-03-16 | **Status**: Aprovado para implementacao
> **Abordagem**: Manter motor Mubisys 9-passos e evoluir

---

## 1. Contexto

O ERP Croma Print ja possui um motor de precificacao profissional baseado no metodo Mubisys (Custeio Direto em 9 passos). O motor funciona e tem testes. Esta spec descreve 10 melhorias para tornar os orcamentos 100% reais e funcionais, incluindo override de preco pelo vendedor.

### Arquivos-chave existentes

| Arquivo | Funcao |
|---------|--------|
| `src/shared/services/pricing-engine.ts` | Motor Mubisys 9 passos (405 linhas) |
| `src/shared/services/orcamento-pricing.service.ts` | Ponte motor ↔ orcamento (245 linhas) |
| `src/shared/services/pricing-explainer.ts` | Explicacao legivel do calculo |
| `src/domains/comercial/hooks/useOrcamentoPricing.ts` | Hook React principal |
| `src/domains/comercial/hooks/useOrcamentoAlerts.ts` | Alertas de margem/markup |
| `src/domains/comercial/pages/OrcamentoEditorPage.tsx` | Editor wizard 3 etapas (1262 linhas) |
| `src/domains/comercial/components/PricingCalculator.tsx` | Breakdown colapsavel |
| `src/domains/comercial/components/ResumoVendedor.tsx` | Card resumo vendedor |
| `src/domains/comercial/components/MaterialEditor.tsx` | Grid de materiais |
| `src/domains/comercial/services/orcamento.service.ts` | CRUD orcamentos + conversao pedido |

---

## 2. Mudancas

### 2.1 Acabamentos dentro do motor Mubisys

**Problema**: Acabamentos sao somados DEPOIS do motor, sem receber rateio de custos fixos, impostos e comissao. Isso subestima o custo real em ~19% sobre acabamentos.

**Solucao**: Incluir acabamentos como materiais no input do motor. O `orcamento-pricing.service.ts` deve concatenar materiais + acabamentos em um unico array `materiais` antes de chamar `calcPricing()`.

**Arquivo alterado**: `src/shared/services/orcamento-pricing.service.ts`

```typescript
// ANTES (bug):
const custoAcabamentos = item.acabamentos.reduce(
  (sum, a) => sum + a.quantidade * a.custo_unitario, 0
);
const precoUnitario = pricingResult.precoVenda + custoAcabamentos; // sem overhead

// DEPOIS (correto):
const materiaisParaMotor = [
  ...item.materiais.map(m => ({ ... })),       // materiais normais
  ...item.acabamentos.map(a => ({              // acabamentos tambem
    nome: a.descricao,
    quantidade: a.quantidade,
    precoUnitario: a.custo_unitario,
  })),
];
const pricingResult = calcPricing(
  { materiais: materiaisParaMotor, processos, markupPercentual: item.markup_percentual },
  config,
);
const precoUnitario = pricingResult.precoVenda; // acabamentos ja inclusos
```

**Impacto**: `OrcamentoItemPricingResult` mantem `custosAcabamentos` como campo informativo (para breakdown visual), mas o valor ja esta dentro do `custoMP` do motor.

**Ajuste no explainer**: `pricing-explainer.ts` deve separar visualmente MP e acabamentos no passo 1, mesmo que o motor os trate juntos.

**Ajuste no PricingCalculator**: Manter linhas separadas "Custo de Material" e "Acabamentos" no breakdown, extraindo os valores do input original.

---

### 2.2 Override de Preco pelo Vendedor (Markup Reverso)

**Problema**: Vendedor so pode ajustar o markup %. Nao consegue digitar o preco final que quer cobrar.

**Solucao**: Na Step 3 do wizard, adicionar campos editaveis de Preco Unitario e Preco/m². Qualquer alteracao recalcula o markup reverso.

#### Interface do motor

Adicionar funcao em `pricing-engine.ts`:

```typescript
/**
 * Calcula o markup necessario para atingir um preco-alvo.
 * Faz o calculo reverso do passo 9 → passo 8 do Mubisys.
 *
 * precoAlvo = valorAntesMarkup × (1 + markup/100)
 * markup = ((precoAlvo / valorAntesMarkup) - 1) × 100
 */
export function calcMarkupReverso(
  precoAlvo: number,
  input: Omit<PricingInput, 'markupPercentual'>,
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
): { markupPercentual: number; margemBruta: number; valido: boolean } {
  // Roda o motor com markup 0 para obter valorAntesMarkup
  const base = calcPricing({ ...input, markupPercentual: 0 }, config);

  if (base.valorAntesMarkup <= 0) {
    return { markupPercentual: 0, margemBruta: 0, valido: false };
  }

  const markupPercentual = ((precoAlvo / base.valorAntesMarkup) - 1) * 100;
  const margemBruta = precoAlvo > 0
    ? ((precoAlvo - base.custoBase) / precoAlvo) * 100
    : 0;

  return {
    markupPercentual: Math.round(markupPercentual * 100) / 100,
    margemBruta: Math.round(margemBruta * 100) / 100,
    valido: markupPercentual >= 0,
  };
}
```

#### Interface do orcamento-pricing.service

Adicionar funcao:

```typescript
/**
 * Dado um preco-alvo (unitario ou por m²), retorna o markup necessario.
 */
export function calcMarkupParaPreco(
  precoAlvo: number,
  tipo: 'unitario' | 'm2',
  item: Omit<OrcamentoItemInput, 'markup_percentual'>,
  config: PricingConfig,
): { markup_percentual: number; margem_bruta: number; valido: boolean } {
  let precoUnitarioAlvo = precoAlvo;

  if (tipo === 'm2') {
    const areaM2 = calcAreaM2(item.largura_cm, item.altura_cm);
    if (!areaM2 || areaM2 <= 0) {
      return { markup_percentual: 0, margem_bruta: 0, valido: false };
    }
    precoUnitarioAlvo = precoAlvo * areaM2;
  }

  // Monta input do motor (materiais + acabamentos juntos, conforme 2.1)
  const materiaisParaMotor = [
    ...item.materiais.map(m => ...),
    ...item.acabamentos.map(a => ...),
  ];
  const processos = item.processos.map(p => ...);

  return calcMarkupReverso(precoUnitarioAlvo, { materiais: materiaisParaMotor, processos }, config);
}
```

#### UI — Step 3 do wizard

No `OrcamentoEditorPage.tsx`, Step 3, adicionar ao lado do campo Markup:

```
┌─────────────────────────────────────────────┐
│ Precificacao                                │
│                                             │
│  Markup (%)    [ 45    ]  [Sugerido: 45%]  │
│                                             │
│  ── OU defina o preco diretamente ──        │
│                                             │
│  Preco Unitario  [ R$ 165,00 ]             │
│  Preco/m²        [ R$ 110,00 ]  (se dims)  │
│                                             │
│  ⚠ Margem: 33.1%   ✓ Acima do minimo      │
└─────────────────────────────────────────────┘
```

**Comportamento bidirecional**:
- Vendedor altera Markup → recalcula preco unitario e preco/m²
- Vendedor altera Preco Unitario → recalcula markup e preco/m²
- Vendedor altera Preco/m² → recalcula preco unitario e markup
- Ultimo campo editado pelo vendedor "ganha" (sem loop infinito)
- Flag `overrideSource: 'markup' | 'preco' | 'm2'` controla qual campo foi editado por ultimo

**Validacoes**:
- Se markup reverso < `markup_minimo` da categoria → alerta amarelo
- Se markup reverso < 0 → alerta vermelho "Preco abaixo do custo!"
- Se preco/m² < `preco_m2_minimo` → alerta amarelo
- Vendedor PODE salvar com alertas (nao e bloqueante), mas o alerta fica registrado

**Salvar no banco**: O `proposta_itens` ja tem todos os campos necessarios (`markup_percentual`, `valor_unitario`, `valor_total`). O override nao muda o schema — apenas muda COMO o markup e calculado.

Adicionar campo `preco_override` BOOLEAN em `proposta_itens` (migration) para auditoria — indica que o vendedor ajustou manualmente o preco em vez de usar o markup sugerido.

---

### 2.3 Remover `preco_fixo` de produto_modelos

**Problema**: Campo `preco_fixo` em `produto_modelos` permite bypass de toda a logica de custeio. Se alguem preencher, o preco ignora materiais, processos, overhead.

**Solucao**:
1. Migration: `ALTER TABLE produto_modelos DROP COLUMN preco_fixo;`
2. Verificar se algum registro tem valor != NULL antes de dropar
3. Remover qualquer referencia no codigo TypeScript

**Risco**: Baixo — campo raramente usado (verificar dados antes).

---

### 2.4 Remover `calcPrecoRapido()`

**Problema**: Funcao `calcPrecoRapido(custoMP, markup)` ignora MO, custos fixos, impostos. Qualquer uso gera preco incorreto.

**Solucao**: Deletar a funcao de `pricing-engine.ts`. Buscar todos os call sites e substituir por `calcPricing()`.

**Call sites a verificar**: grep por `calcPrecoRapido` em todo o projeto.

---

### 2.5 Custo de material read-only para vendedor

**Problema**: `MaterialEditor.tsx` permite vendedor alterar `custo_unitario` de qualquer material. Isso pode causar precos incorretos por erro ou manipulacao.

**Solucao**:
- Campo `custo_unitario` read-only para role `comercial`
- Campo editavel para roles `admin` e `gerente`
- Verificar role via `useAuth()` hook existente
- Vendedor pode VER os custos mas nao alterar

**Arquivo alterado**: `src/domains/comercial/components/MaterialEditor.tsx`

---

### 2.6 Tempo de setup por processo

**Problema**: `modelo_processos` so tem `tempo_por_unidade_min`. Nao tem tempo de preparacao de maquina (setup), que e cobrado uma vez por lote.

**Solucao**:

Migration:
```sql
ALTER TABLE modelo_processos
  ADD COLUMN tempo_setup_min INTEGER DEFAULT 0;
```

Calculo no motor — adicionar ao `orcamento-pricing.service.ts`:

```typescript
// Tempo total = Σ(tempo_por_unidade × quantidade) + Σ(tempo_setup)
// O setup e dividido pela quantidade para obter custo/unidade
const tempoProducao = processos.reduce((t, p) => t + p.tempoMinutos, 0);
const tempoSetup = processos.reduce((t, p) => t + (p.tempoSetup ?? 0), 0);
const tempoTotalPorUnidade = tempoProducao + (tempoSetup / quantidade);
```

**Interface atualizada**: `OrcamentoProcesso` ganha campo `tempo_setup_min?: number`.

---

### 2.7 Escala por quantidade (desconto progressivo)

**Problema**: Preco unitario e fixo independente do volume. Na pratica, quanto maior o lote, menor o custo fixo por unidade (ja que setup e diluido). Mas nao ha desconto automatico.

**Solucao**: Nova tabela + logica.

Migration:
```sql
CREATE TABLE faixas_quantidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_id UUID NOT NULL REFERENCES regras_precificacao(id) ON DELETE CASCADE,
  quantidade_minima INTEGER NOT NULL,
  desconto_markup_percentual NUMERIC(5,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_faixas_quantidade_regra ON faixas_quantidade(regra_id);
```

Exemplo de dados:
```
regra_id (banner) | quantidade_minima | desconto_markup_percentual
                  | 10                | 5
                  | 50                | 10
                  | 100               | 15
```

**Logica**: Ao calcular item, verificar faixa correspondente. Se quantidade >= 50, aplicar -10% no markup. Ex: markup sugerido 45% → 45 - 10 = 35%.

**UI**: Na Step 3, ao lado do campo quantidade, mostrar badge "Desconto por volume: -10% markup" quando aplicavel. Vendedor pode aceitar ou override.

---

### 2.8 Config obrigatoria no banco

**Problema**: Se nao tiver `config_precificacao` no banco, o sistema usa `DEFAULT_PRICING_CONFIG` hardcoded. Valores podem estar desatualizados.

**Solucao**:
- `useConfigPrecificacao()` retorna `{ config, isDefault }`
- Se `isDefault === true`, `useOrcamentoAlerts()` adiciona alerta vermelho: "Configure os parametros de precificacao em Admin > Configuracoes antes de criar orcamentos"
- Botao "Adicionar Item" desabilitado enquanto config nao estiver no banco
- Manter DEFAULT_PRICING_CONFIG como fallback de seguranca (nao deletar), mas avisar

**Arquivo alterado**: `src/domains/comercial/hooks/useOrcamentoPricing.ts`

---

### 2.9 Historico de precos de materiais

**Problema**: So existe `preco_medio` atual. Nao da para ver se o custo subiu ou desceu, nem quando foi a ultima atualizacao.

**Solucao**:

Migration:
```sql
CREATE TABLE materiais_historico_preco (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
  preco_anterior NUMERIC(12,4),
  preco_novo NUMERIC(12,4) NOT NULL,
  motivo TEXT,
  atualizado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mat_hist_material ON materiais_historico_preco(material_id, created_at DESC);

-- Trigger para registrar automaticamente
CREATE OR REPLACE FUNCTION fn_log_preco_material()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.preco_medio IS DISTINCT FROM NEW.preco_medio THEN
    INSERT INTO materiais_historico_preco (material_id, preco_anterior, preco_novo)
    VALUES (NEW.id, OLD.preco_medio, NEW.preco_medio);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_preco_material
  AFTER UPDATE ON materiais
  FOR EACH ROW EXECUTE FUNCTION fn_log_preco_material();
```

**UI**: Na pagina de admin de materiais, ao clicar no material, mostrar mini-grafico de evolucao de preco (sparkline). Nao e prioridade para v1.

---

### 2.10 Refatorar OrcamentoEditorPage

**Problema**: 1262 linhas em um unico arquivo. Dificil de manter.

**Solucao**: Extrair em componentes menores:

| Novo Componente | Linhas aprox | Responsabilidade |
|----------------|-------------|------------------|
| `OrcamentoHeader.tsx` | ~50 | Titulo, botoes salvar/template/IA |
| `OrcamentoDadosForm.tsx` | ~90 | Campos titulo, cliente, validade, desconto |
| `OrcamentoItensTable.tsx` | ~80 | Tabela de itens existentes |
| `ItemWizard.tsx` | ~200 | Container do wizard 3 etapas |
| `ItemStep1Produto.tsx` | ~80 | Step 1: produto, modelo, descricao, qtd |
| `ItemStep2Materiais.tsx` | ~60 | Step 2: dimensoes, materiais, acabamentos |
| `ItemStep3Revisao.tsx` | ~100 | Step 3: markup, override preco, alertas, resumo |
| `OrcamentoResumoFinanceiro.tsx` | ~50 | Subtotal, servicos, desconto, total |
| `useItemEditor.ts` | ~150 | Hook com toda a logica do editor de item |

O `OrcamentoEditorPage.tsx` final tera ~100 linhas, compondo esses componentes.

---

### 2.11 IA Integrada — Manter e Evoluir

A IA ja esta integrada no modulo de orcamentos e deve continuar funcionando com as mudancas de precificacao. Componentes existentes:

#### O que ja existe e MANTEM

| Componente | Funcao |
|------------|--------|
| `AIButton` + `AISidebar` | Trigger + painel lateral de sugestoes |
| `useAnalisarOrcamento` | Edge Function que analisa proposta completa |
| `useComposicaoProduto` | Edge Function que sugere composicao (modelo, materiais, acabamentos) |
| `useAISidebar` + `registry.ts` | Orquestrador de acoes + appliers |
| `precoApplier.ts` | Aplica sugestao de preco no item |
| `materialApplier.ts` | Troca/adiciona material no item |
| `acabamentoApplier.ts` | Adiciona acabamento no item |
| `quantidadeApplier.ts` | Ajusta quantidade do item |
| `adicionarItemApplier.ts` | Adiciona item/servico na proposta |
| `modeloApplier.ts` | Define modelo do item |
| `servicoApplier.ts` | Adiciona servico |
| `ComposicaoSugestao.tsx` | UI de sugestao de composicao |
| `useAIModels` + `AIModelsTab` | Gestao de modelos IA em admin |

#### Ajustes necessarios nos appliers

**`precoApplier.ts`** — Atualmente escreve direto `valor_unitario` no banco. Com o sistema de markup reverso (2.2), o applier deve:
1. Receber o `preco_sugerido` da IA
2. Chamar `calcMarkupParaPreco(preco_sugerido, 'unitario', item, config)` para obter o markup correspondente
3. Salvar `markup_percentual` E `valor_unitario` juntos
4. Setar `preco_override = true` no item
5. Assim o preco sugerido pela IA passa pelo mesmo pipeline do vendedor

**`materialApplier.ts`** — Ao trocar material, o preco do item deve ser recalculado pelo motor. O applier deve:
1. Atualizar material no banco
2. Triggar recalculo via `orcamentoService.recalcularTotais(propostaId)`

**`acabamentoApplier.ts`** — Com acabamentos dentro do motor (2.1), ao adicionar acabamento:
1. Atualizar no banco
2. Triggar recalculo (ja que acabamento agora afeta custo base)

**`quantidadeApplier.ts`** — Com faixas de quantidade (2.7), ao mudar quantidade:
1. Verificar se nova quantidade entra em faixa de desconto
2. Recalcular preco com markup ajustado

#### Fluxo IA atualizado

```
Vendedor clica "Analisar Orcamento"
  → Edge Function analisa proposta (materiais, precos, margens)
  → Retorna AIActionableResponse com sugestoes
  → AISidebar exibe acoes (preco, material, acabamento, etc.)
  → Vendedor seleciona acoes
  → Applier executa:
      - Se preco: calcMarkupReverso → salva markup + preco + flag override
      - Se material/acabamento: atualiza + recalcula motor
      - Se quantidade: verifica faixa + recalcula
  → Invalidate query → UI atualiza com novos valores
```

#### Composicao de Produto (manter)

O botao de composicao IA continua funcionando. Quando a IA sugere modelo + materiais + acabamentos, o sistema:
1. Seta modelo_id no item
2. Carrega BOM do modelo (materiais + processos)
3. Adiciona acabamentos sugeridos
4. Motor calcula preco automaticamente
5. Vendedor pode override se quiser

---

## 3. Schema SQL — Migration Completa

```sql
-- Migration: 035_pricing_evolution.sql

-- 2.3: Remover preco_fixo de produto_modelos
-- (Verificar se ha dados antes de rodar)
ALTER TABLE produto_modelos DROP COLUMN IF EXISTS preco_fixo;

-- 2.2: Flag de override para auditoria
ALTER TABLE proposta_itens
  ADD COLUMN IF NOT EXISTS preco_override BOOLEAN DEFAULT false;

-- 2.6: Tempo de setup
ALTER TABLE modelo_processos
  ADD COLUMN IF NOT EXISTS tempo_setup_min INTEGER DEFAULT 0;

-- 2.7: Faixas de quantidade
CREATE TABLE IF NOT EXISTS faixas_quantidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_id UUID NOT NULL REFERENCES regras_precificacao(id) ON DELETE CASCADE,
  quantidade_minima INTEGER NOT NULL,
  desconto_markup_percentual NUMERIC(5,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_faixas_quantidade_regra
  ON faixas_quantidade(regra_id);

-- 2.7: Seed de faixas padrao para banner
INSERT INTO faixas_quantidade (regra_id, quantidade_minima, desconto_markup_percentual)
SELECT r.id, faixa.qtd, faixa.desconto
FROM regras_precificacao r
CROSS JOIN (VALUES
  (10, 3.0),
  (50, 7.0),
  (100, 12.0)
) AS faixa(qtd, desconto)
WHERE r.categoria = 'banner' AND r.ativo = true
ON CONFLICT DO NOTHING;

-- 2.9: Historico de precos
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

-- Trigger de historico
CREATE OR REPLACE FUNCTION fn_log_preco_material()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.preco_medio IS DISTINCT FROM NEW.preco_medio THEN
    INSERT INTO materiais_historico_preco (material_id, preco_anterior, preco_novo)
    VALUES (NEW.id, OLD.preco_medio, NEW.preco_medio);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_preco_material ON materiais;
CREATE TRIGGER trg_log_preco_material
  AFTER UPDATE ON materiais
  FOR EACH ROW EXECUTE FUNCTION fn_log_preco_material();

-- RLS para novas tabelas
ALTER TABLE faixas_quantidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiais_historico_preco ENABLE ROW LEVEL SECURITY;

CREATE POLICY "faixas_quantidade_select" ON faixas_quantidade
  FOR SELECT USING (true);

CREATE POLICY "faixas_quantidade_all" ON faixas_quantidade
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gerente'))
  );

CREATE POLICY "materiais_historico_select" ON materiais_historico_preco
  FOR SELECT USING (true);

CREATE POLICY "materiais_historico_insert" ON materiais_historico_preco
  FOR INSERT WITH CHECK (true);
```

---

## 4. Arquitetura de Dados — Fluxo Atualizado

```
Vendedor seleciona Produto → Modelo
  ↓
Sistema carrega BOM (modelo_materiais) + Processos (modelo_processos)
  ↓
Materiais + Acabamentos → array unico para motor
  ↓
Motor Mubisys (pricing-engine.ts):
  1. custoMP = Σ(materiais + acabamentos) com aproveitamento
  2. tempoTotal = Σ(tempo_unidade) + Σ(tempo_setup) / quantidade
  3-6. overhead, MO, custo base
  7. valorAntesMarkup (com impostos/comissao embutidos)
  8-9. markup → preco final
  ↓
Vendedor pode:
  A) Ajustar markup % → preco recalcula
  B) Digitar preco unitario → markup reverso
  C) Digitar preco/m² → preco unitario → markup reverso
  ↓
Faixa de quantidade aplicada (se existir)
  ↓
Validacoes:
  - markup >= minimo da categoria?
  - preco/m² >= minimo da categoria?
  - margem >= 15%?
  ↓
Salvar em proposta_itens (com flag preco_override se vendedor alterou preco)
  ↓
config_snapshot congelada na proposta
```

---

## 5. Testes Necessarios

### Unitarios (pricing-engine.test.ts — expandir)

- `calcMarkupReverso` — preco-alvo retorna markup correto
- `calcMarkupReverso` — preco abaixo do custo retorna markup negativo
- Acabamentos dentro do motor — custo base inclui acabamentos
- Setup time — diluicao por quantidade
- Faixa de quantidade — desconto aplicado corretamente

### Unitarios (orcamento-pricing.service — criar)

- `calcMarkupParaPreco('unitario')` — retorna markup correto
- `calcMarkupParaPreco('m2')` — converte area e retorna markup
- `calcOrcamentoItem` — acabamentos inclusos no custoMP
- Validacao de config obrigatoria

### Integracao

- Fluxo completo: criar orcamento → adicionar item com override → salvar → verificar proposta_itens no banco
- Conversao proposta→pedido preserva campos de override

---

## 6. Componentes UI Alterados

| Componente | Mudanca |
|------------|---------|
| `OrcamentoEditorPage.tsx` | Refatorar em 9 componentes menores |
| `ItemStep3Revisao.tsx` (novo) | Campos markup + preco unitario + preco/m² bidirecionais |
| `PricingCalculator.tsx` | Manter breakdown visual separado (MP vs acabamentos) |
| `ResumoVendedor.tsx` | Adicionar indicador de override ("Preco ajustado manualmente") |
| `MaterialEditor.tsx` | custo_unitario read-only para vendedor |
| `useItemEditor.ts` (novo) | Hook com logica do wizard + override bidirecional |
| `useOrcamentoPricing.ts` | Retornar `isDefaultConfig` |
| `useOrcamentoAlerts.ts` | Alerta de config padrao + alerta de override abaixo minimo |
| `precoApplier.ts` | Usar calcMarkupReverso em vez de escrever preco direto |
| `materialApplier.ts` | Triggar recalculo do motor apos trocar material |
| `acabamentoApplier.ts` | Triggar recalculo do motor apos adicionar acabamento |
| `quantidadeApplier.ts` | Verificar faixa de desconto + recalcular |

---

## 7. Ordem de Implementacao

1. **Migration SQL** (035_pricing_evolution.sql)
2. **Motor**: acabamentos no motor + `calcMarkupReverso()` + setup time
3. **Service**: `calcMarkupParaPreco()` + ajustar `calcOrcamentoItem()`
4. **Testes**: expandir pricing-engine.test.ts
5. **Hook**: `useItemEditor` + `useOrcamentoPricing` (isDefaultConfig)
6. **UI**: Refatorar editor em componentes + Step 3 com override de preco
7. **IA Appliers**: Ajustar precoApplier, materialApplier, acabamentoApplier, quantidadeApplier para usar motor
8. **Admin**: UI para faixas de quantidade (simples tabela CRUD)
9. **Cleanup**: remover `calcPrecoRapido`, `preco_fixo`, read-only materiais

---

## 8. O que NAO muda

- Motor Mubisys 9 passos — mantido intacto (apenas estendido)
- `config_precificacao` — sem alteracao de schema
- `regras_precificacao` — sem alteracao de schema (apenas nova FK para faixas)
- `propostas` — sem alteracao
- `pedidos` / `pedido_itens` — sem alteracao
- `acabamentos` / `servicos` — sem alteracao de schema
- Fluxo Lead → Orcamento → Pedido → Producao — sem alteracao
- Portal do cliente — sem alteracao
- PDF de orcamento — sem alteracao (herda valores calculados)
- **IA integrada** — AIButton, AISidebar, ComposicaoSugestao, useAIModels, Edge Functions — mantidos (appliers ajustados para usar motor)

---

## 9. Riscos e Mitigacoes

| Risco | Mitigacao |
|-------|-----------|
| Precos existentes mudam com acabamentos no motor | Recalcular antes de aplicar: diff sera ~19% nos itens com acabamentos. Comunicar ao usuario |
| Vendedor abusa do override para vender abaixo do custo | Alertas visuais + log de `preco_override` para auditoria |
| Drop de `preco_fixo` afeta modelos existentes | Verificar dados antes da migration. Se existirem valores, converter para markup_padrao equivalente |
| Refatoracao do editor quebra funcionalidade | Manter testes E2E se existirem; testar manualmente cada step |
