# ARQUITETURA FINAL — DOMÍNIO DE ORÇAMENTOS E PRECIFICAÇÃO
> **Versão**: 2.0 | **Data**: 2026-03-10 | **Status**: Proposta aprovada para implementação

---

## Índice
1. [Visão Geral](#1-visão-geral)
2. [Entidades e Relacionamentos](#2-entidades-e-relacionamentos)
3. [Modelo de Dados Final](#3-modelo-de-dados-final)
4. [Fluxo de Cálculo do Preço](#4-fluxo-de-cálculo-do-preço)
5. [Fluxo de Criação do Orçamento](#5-fluxo-de-criação-do-orçamento)
6. [Fluxo de Conversão em Pedido](#6-fluxo-de-conversão-em-pedido)
7. [Motor de Precificação Corrigido](#7-motor-de-precificação-corrigido)
8. [Arquitetura de Código](#8-arquitetura-de-código)
9. [Migrations Necessárias](#9-migrations-necessárias)
10. [Catálogo de Produtos](#10-catálogo-de-produtos)
11. [Admin de Precificação](#11-admin-de-precificação)

---

## 1. Visão Geral

### Princípio Fundamental

> **Todo item de orçamento deve ser tecnicamente rastreável, com cálculo reproduzível.**
>
> Ao salvar um item, os componentes de custo (materiais, acabamentos, processos) são persistidos.
> Ao reabrir, o cálculo pode ser reconstruído a partir dos dados salvos.

### Terminologia Definitiva

| Conceito | Banco (SQL) | Frontend (UX/TS) | Motivo |
|---|---|---|---|
| Documento de precificação | `propostas` | "Orçamento" | Banco não muda; UX usa termo do negócio |
| Linha do orçamento | `proposta_itens` | `OrcamentoItem` | |
| Materiais de um item | `proposta_item_materiais` | `OrcamentoItemMaterial` | |
| Acabamentos de um item | `proposta_item_acabamentos` | `OrcamentoItemAcabamento` | |
| Serviços do orçamento | `proposta_servicos` | `OrcamentoServico` | |
| FK em outros módulos | `proposta_id` | — | Compatibilidade com banco existente |

---

## 2. Entidades e Relacionamentos

### Mapa Completo do Domínio

```
┌─────────────────────────────────────────────────────────────────┐
│                        CATÁLOGO                                  │
│                                                                   │
│  produtos ──────────────► produto_modelos                        │
│  (banner, adesivo...)       (banner_ilhós, banner_bastão...)     │
│                                 │                                 │
│                    ┌────────────┴────────────┐                   │
│                    │                         │                   │
│             modelo_materiais          modelo_processos           │
│          (lona, tinta, verniz)    (impressão, acabamento...)     │
│                    │                                             │
│             materiais (467)                                      │
│          (catálogo de insumos)                                   │
│                                                                   │
│  acabamentos (ilhós, bastão, bainha, laminação...)               │
│  servicos (criação de arte, instalação, frete...)                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ usuário seleciona
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ORÇAMENTO (proposta)                        │
│                                                                   │
│  propostas                                                        │
│  ├── proposta_itens (com modelo_id ← novo)                       │
│  │   ├── proposta_item_materiais  ← componentes de custo         │
│  │   └── proposta_item_acabamentos ← componentes de custo        │
│  ├── proposta_servicos            ← serviços do orçamento       │
│  └── proposta_versoes             ← histórico de versões         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ aprovado → converter
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         PEDIDO                                    │
│                                                                   │
│  pedidos (proposta_id FK)                                         │
│  └── pedido_itens (proposta_item_id FK + campos técnicos ← novo) │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       CONFIGURAÇÃO                                │
│                                                                   │
│  config_precificacao (1 registro global Mubisys)                 │
│  regras_precificacao (markup mínimo/sugerido por categoria)      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Modelo de Dados Final

### 3.1 Tabelas Existentes (sem alteração de schema)

| Tabela | Status | Observação |
|---|---|---|
| `produtos` | ✅ OK | 156 registros reais |
| `produto_modelos` | ✅ OK | Seed de 10 modelos |
| `modelo_materiais` | ✅ OK | Join modelo ↔ material |
| `modelo_processos` | ✅ OK | Etapas produtivas por modelo |
| `materiais` | ✅ OK | 467 registros reais |
| `propostas` | ✅ OK | Tabela principal do orçamento |
| `proposta_versoes` | ✅ OK | Versionamento |
| `config_precificacao` | ✅ OK | 1 registro com defaults Mubisys |
| `pedidos` | ✅ OK | Header do pedido |

### 3.2 Tabelas a Executar (migration 006 — com correções)

| Tabela | Correção Necessária |
|---|---|
| `acabamentos` | Nenhuma — schema OK |
| `servicos` | Corrigir: `categoria DEFAULT 'servico'` → `DEFAULT 'outro'` |
| `proposta_item_materiais` | Nenhuma — schema OK |
| `proposta_item_acabamentos` | Nenhuma — schema OK |
| `proposta_servicos` | Nenhuma — schema OK |
| `regras_precificacao` | Reconciliar com AdminPrecificacaoPage (ver 3.3) |
| `templates_orcamento` | Nenhuma — schema OK |

### 3.3 Migration 007 — Campos Novos Necessários

```sql
-- 1. proposta_itens: adicionar rastreabilidade de modelo
ALTER TABLE proposta_itens
  ADD COLUMN modelo_id UUID REFERENCES produto_modelos(id) ON DELETE SET NULL;

CREATE INDEX idx_proposta_itens_modelo ON proposta_itens(modelo_id);

-- 2. pedido_itens: adicionar campos técnicos de custeio
ALTER TABLE pedido_itens
  ADD COLUMN modelo_id          UUID REFERENCES produto_modelos(id) ON DELETE SET NULL,
  ADD COLUMN custo_mp           NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN custo_mo           NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN custo_fixo         NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN markup_percentual  NUMERIC(5,2)  DEFAULT 40,
  ADD COLUMN largura_cm         NUMERIC(10,2),
  ADD COLUMN altura_cm          NUMERIC(10,2),
  ADD COLUMN area_m2            NUMERIC(10,4),
  ADD COLUMN prazo_producao_dias INTEGER;

-- 3. regras_precificacao: schema compatível com AdminPrecificacaoPage
-- (opção: criar view sobre a tabela existente OU recriar com schema adequado)
-- Recriar com schema que o frontend espera e que é mais legível:
-- A tabela tipo/valor da 006 é mais genérica, mas menos usável.
-- Decisão: usar schema colunar (mais claro, menos queries)
CREATE TABLE IF NOT EXISTS regras_precificacao_v2 AS (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria       TEXT NOT NULL,
  markup_minimo   NUMERIC(5,2) NOT NULL DEFAULT 30,
  markup_sugerido NUMERIC(5,2) NOT NULL DEFAULT 45,
  desconto_maximo NUMERIC(5,2) DEFAULT 15,
  preco_m2_minimo NUMERIC(12,2),
  taxa_urgencia   NUMERIC(5,2) DEFAULT 50,
  ativo           BOOLEAN DEFAULT TRUE,
  criado_por      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Corrigir bug de default no servicos (se 006 ainda não foi executada)
-- → Incluir no script de execução da 006 com a correção
```

### 3.4 Schema Final de `proposta_itens`

```sql
proposta_itens {
  id                UUID PK
  proposta_id       UUID FK → propostas
  produto_id        UUID FK → produtos        ← categoria do produto
  modelo_id         UUID FK → produto_modelos ← modelo específico ← NOVO
  descricao         TEXT NOT NULL
  especificacao     TEXT
  quantidade        NUMERIC(10,3) DEFAULT 1
  unidade           TEXT DEFAULT 'un'
  largura_cm        NUMERIC(10,2)
  altura_cm         NUMERIC(10,2)
  area_m2           NUMERIC(10,4)
  custo_mp          NUMERIC(12,2) DEFAULT 0   ← custo de matéria-prima
  custo_mo          NUMERIC(12,2) DEFAULT 0   ← custo de mão de obra
  custo_fixo        NUMERIC(12,2) DEFAULT 0   ← custo fixo rateado
  markup_percentual NUMERIC(5,2)  DEFAULT 40
  valor_unitario    NUMERIC(12,2) DEFAULT 0
  valor_total       NUMERIC(12,2) DEFAULT 0
  prazo_producao_dias INTEGER
  ordem             INTEGER DEFAULT 0
  created_at        TIMESTAMPTZ DEFAULT NOW()
}
```

---

## 4. Fluxo de Cálculo do Preço

### 4.1 Inputs do Motor (após correção BUG-01 e BUG-02)

```typescript
// Separação clara entre materiais e acabamentos
interface PricingInputV2 {
  // Matéria-prima (dimensões × preço do material)
  materiais: Array<{
    nome: string;
    quantidade: number;      // ex: área em m²
    precoUnitario: number;   // ex: preço/m² do material
  }>;

  // Processos produtivos (tempo × custo/minuto)
  processos: Array<{
    etapa: string;
    tempoMinutos: number;
  }>;

  // Acabamentos (custo fixo adicional, não entra no motor Mubisys)
  acabamentos: Array<{
    descricao: string;
    quantidade: number;
    custoUnitario: number;
  }>;

  markupPercentual: number;
  quantidade: number;        // ATENÇÃO: apenas para saída final
}
```

### 4.2 Algoritmo Corrigido (9 Passos Mubisys)

```
ENTRADAS:
  materiais[]    → lista de matérias-primas
  processos[]    → etapas produtivas com tempo
  acabamentos[]  → acabamentos (tratados separado)
  markup%        → percentual de markup
  config         → config_precificacao (faturamento, custos, taxas)

PASSO 1 — Custo de Matéria-Prima (sem acabamentos):
  Vmp = SUM(material.quantidade × material.precoUnitario)

PASSO 2 — Tempo Total de Produção:
  T = SUM(processo.tempoMinutos)

PASSO 3 — Percentual de Custo Fixo:
  P% = ((custoOperacional - custoProdutivo) × 100) / faturamentoMedio

PASSO 4 — Custo de Mão de Obra:
  Cm = (custoProdutivo / qtdFuncionarios / horasMes) / 60  [custo/min]
  MO = T × Cm

PASSO 5 — Percentual de Vendas:
  Pv = (comissao + impostos + juros) / 100

PASSO 6 — Valor Base:
  Vb = (Vmp + MO) × (1 + P/100)

PASSO 7 — Valor com Custo de Vendas:
  Vam = Vb / (1 - Pv)

PASSO 8 — Valor com Markup (CORRIGIDO — sem dupla divisão):
  Vm = Vam × (markup / 100)       ← antes era dividido por (1-Pv) de novo

PASSO 9 — Valor Final Unitário:
  Vv_unitario = Vam + Vm

PASSO 10 — Acabamentos (somados após Mubisys, não dentro):
  custo_acabamentos = SUM(acabamento.quantidade × acabamento.custoUnitario)
  Vv_com_acabamentos = Vv_unitario + custo_acabamentos

SAÍDA (unitária — quantidade aplicada apenas para exibição total):
  precoUnitario = Vv_com_acabamentos
  precoTotal    = precoUnitario × quantidade   ← única multiplicação

MÉTRICAS:
  margemBruta   = precoUnitario - (Vmp + MO + custo_acabamentos + custoFixo)
  percMargem    = (margemBruta / precoUnitario) × 100
  precoM2       = precoUnitario / area_m2  (quando área > 0)
```

### 4.3 Breakdown de Custo por Item

```
┌─────────────────────────────────────────────────────┐
│  COMPOSIÇÃO DO PREÇO UNITÁRIO                        │
│                                                       │
│  Matéria-Prima (Vmp)         R$ ___  ___,__  ___% │
│  Mão de Obra (MO)            R$ ___  ___,__  ___% │
│  Custo Fixo (Vb-Vamp)        R$ ___  ___,__  ___% │
│  Acabamentos                 R$ ___  ___,__  ___% │
│  ─────────────────────────────────────────────────── │
│  Custo Total                 R$ ___  ___,__        │
│  Markup (___%)               R$ ___  ___,__        │
│  Impostos/Comissão/Juros     R$ ___  ___,__        │
│  ─────────────────────────────────────────────────── │
│  PREÇO UNITÁRIO              R$ ___  ___,__        │
│  × Quantidade                × ___                  │
│  PREÇO TOTAL                 R$ ___  ___,__        │
└─────────────────────────────────────────────────────┘
```

---

## 5. Fluxo de Criação do Orçamento

### 5.1 Fluxo do Editor (passo a passo)

```
1. CABEÇALHO
   └─ Selecionar cliente → título → validade → condições de pagamento

2. ADICIONAR ITEM
   ├─ [A] Seleção por catálogo (recomendado):
   │   a. Selecionar Produto (banner, adesivo, faixa...)
   │   b. Selecionar Modelo (banner_ilhós, banner_bastão...)
   │   c. Sistema auto-preenche:
   │      → materiais do modelo (modelo_materiais)
   │      → processos do modelo (modelo_processos)
   │      → markup_padrao do modelo
   │      → largura/altura padrão do modelo (se houver)
   │   d. Preencher quantidade + dimensões (se variável)
   │   e. Sistema calcula área automaticamente
   │   f. [Opcional] Ajustar materiais manualmente
   │   g. [Opcional] Adicionar acabamentos
   │   h. [Opcional] Ajustar markup
   │   i. PricingCalculator exibe resultado ao vivo
   │   j. Clicar "Adicionar" → salva item com todos os componentes
   │
   └─ [B] Entrada manual (fallback):
       → Descrição livre + preço direto (sem catálogo)

3. SERVIÇOS (opcional, por orçamento inteiro)
   └─ Criação de arte, instalação, frete, etc.

4. DESCONTO (opcional)
   └─ Percentual ou valor fixo sobre subtotal

5. RESUMO FINANCEIRO
   ├─ Subtotal
   ├─ Serviços
   ├─ Desconto
   ├─ Total
   └─ Margem média do orçamento

6. AÇÕES
   ├─ Salvar rascunho
   ├─ Enviar para aprovação
   ├─ Converter em PDF (OrcamentoPDF)
   └─ Aprovar → Converter em Pedido
```

### 5.2 Estado do Editor (ItemEditorState)

```typescript
interface ItemEditorState {
  // Identificadores de catálogo
  produto_id: string | null;
  modelo_id: string | null;       // ← salvo em proposta_itens.modelo_id

  // Descrição
  descricao: string;
  especificacao: string;

  // Dimensões
  quantidade: number;
  largura_cm: number;
  altura_cm: number;
  // area_m2 calculado: (largura_cm × altura_cm) / 10000

  // Componentes de custo (persistidos)
  materiais: OrcamentoMaterial[];
  processos: OrcamentoProcesso[];
  acabamentos: OrcamentoAcabamento[];

  // Precificação
  markup_percentual: number;
  prazo_producao_dias: number;
}
```

---

## 6. Fluxo de Conversão em Pedido

### 6.1 Fluxo Completo (após correção)

```
ORÇAMENTO APROVADO
        │
        ▼ converterParaPedido(orcamentoId, userId)
        │
        ├─ 1. Atualizar proposta.status = 'aprovada'
        │      + proposta.aprovado_por = userId
        │      + proposta.aprovado_em = now()
        │
        ├─ 2. Gerar número PED-YYYY-NNNN (confiar no trigger do banco)
        │
        ├─ 3. Criar pedidos:
        │      - proposta_id (FK rastreabilidade)
        │      - cliente_id, vendedor_id
        │      - status = 'aguardando_aprovacao'
        │      - valor_total (total do orçamento)
        │      - custo_total (soma de custo_mp + custo_mo + custo_fixo)
        │      - margem_real (calculada)
        │
        ├─ 4. Para cada proposta_item → criar pedido_item:
        │      - proposta_item_id (FK rastreabilidade)
        │      - produto_id, modelo_id          ← novo
        │      - descricao, especificacao
        │      - quantidade, unidade
        │      - largura_cm, altura_cm, area_m2 ← novo
        │      - valor_unitario, valor_total
        │      - custo_mp, custo_mo, custo_fixo ← novo
        │      - markup_percentual               ← novo
        │      - prazo_producao_dias             ← novo
        │      - status = 'pendente'
        │
        └─ 5. Retornar pedido_id → navegar para /pedidos/:id
```

### 6.2 Rastreabilidade Bidirecional

```
propostas.id ←→ pedidos.proposta_id
proposta_itens.id ←→ pedido_itens.proposta_item_id
```

Isso permite:
- Navegar do pedido de volta ao orçamento original
- Comparar preço previsto vs realizado
- Auditoria completa do ciclo comercial

---

## 7. Motor de Precificação Corrigido

### 7.1 Funções do pricing-engine.ts (versão 2.0)

```typescript
// FUNÇÕES PRINCIPAIS
calcPricing(input: PricingInputV2, config: PricingConfig): PricingResult
  → retorna SEMPRE preço unitário (sem multiplicar por quantidade)

// FUNÇÕES DE APOIO (expostas publicamente)
calcAreaM2(largura_cm, altura_cm): number
calcPrecoRapido(custoMP, markup): number           ← atalho sem Mubisys
calcMargemReal(preco, custos, config): number      ← margem reversa
calcBreakEven(fixo, precoUnit, custoVarUnit): number
simularDesconto(preco, desconto%, custo, config): SimulacaoResult

// FUNÇÕES EXPLICATIVAS (pricing-explainer.ts - nova)
explicarCalculo(input, config): ExplicacaoCalculo
  → texto legível explicando como o preço foi formado
validarMarkup(markup, categoria, regras[]): ValidacaoMarkup
  → alerta quando abaixo do mínimo
sugerirMarkup(categoria, regras[]): number
```

### 7.2 pricing-explainer.ts (novo arquivo)

```typescript
// Gera explicação legível do cálculo para o vendedor ver
interface ExplicacaoCalculo {
  resumo: string;
  passos: Array<{
    passo: number;
    nome: string;
    formula: string;
    resultado: number;
    explicacao: string;
  }>;
  alertas: string[];  // "Markup abaixo do mínimo para banner (30%)"
}

// Exemplo de saída:
// Passo 1: Custo de Matéria-Prima
// Fórmula: lona_440 (2.4m² × R$12,50) + ilhós (10un × R$0,50) = R$35,00
// ...
```

---

## 8. Arquitetura de Código

### 8.1 Estrutura de Domínio Final

```
src/
├── domains/
│   ├── comercial/
│   │   ├── components/
│   │   │   ├── ProdutoSelector.tsx         ← existe, mantém
│   │   │   ├── MaterialEditor.tsx          ← existe, mantém
│   │   │   ├── AcabamentoSelector.tsx      ← existe, refatorar (trata separado)
│   │   │   ├── ServicoSelector.tsx         ← existe, mantém
│   │   │   ├── TemplateSelector.tsx        ← existe, ativar quando 006 executar
│   │   │   ├── OrcamentoPDF.tsx            ← existe, mantém
│   │   │   └── PricingCalculator.tsx       ← existe, corrigir breakdown
│   │   ├── hooks/
│   │   │   ├── useOrcamentos.ts            ← mover recalcularTotais para dentro
│   │   │   ├── useOrcamentoPricing.ts      ← mantém
│   │   │   ├── useProdutosModelos.ts       ← adicionar mutations (create/update/delete)
│   │   │   └── useTemplates.ts             ← ativar quando 006 executar
│   │   ├── pages/
│   │   │   ├── OrcamentosPage.tsx          ← mantém
│   │   │   ├── OrcamentoEditorPage.tsx     ← refatorar: restaurar estado, fix template
│   │   │   ├── OrcamentoViewPage.tsx       ← mantém
│   │   │   └── TemplatesPage.tsx           ← ativar
│   │   └── services/
│   │       ├── orcamento.service.ts        ← corrigir bugs, expandir converterParaPedido
│   │       └── produto.service.ts          ← NOVO: CRUD real de produtos/modelos
│   │
│   └── admin/
│       └── pages/
│           ├── AdminPrecificacaoPage.tsx   ← corrigir schema regras_precificacao
│           └── AdminProdutosPage.tsx       ← NOVO: substitui src/pages/Produtos.tsx
│
└── shared/
    └── services/
        ├── pricing-engine.ts               ← corrigir BUG-01 (qtd), BUG-02 (acabamentos), BUG-07 (markup)
        ├── orcamento-pricing.service.ts    ← corrigir bridge
        └── pricing-explainer.ts           ← NOVO
```

### 8.2 Regra de Responsabilidade

| Camada | Responsabilidade |
|---|---|
| `pricing-engine.ts` | Matemática pura Mubisys. Zero side effects. Zero Supabase. |
| `orcamento-pricing.service.ts` | Converter tipos do orçamento para inputs do motor. Bridge apenas. |
| `useOrcamentoPricing.ts` | Buscar config/regras do banco + chamar bridge. Memoização. |
| `orcamento.service.ts` | CRUD no Supabase. Regras de negócio de orçamento. |
| `useOrcamentos.ts` | React Query wrappers + recalcularTotais após mutations. |
| `OrcamentoEditorPage.tsx` | UI pura. Zero lógica de negócio. Chama hooks. |

---

## 9. Migrations Necessárias

### Ordem de Execução

```
1. Corrigir e executar: 006_orcamento_module.sql
   - Fix: servicos.categoria DEFAULT 'outro' (era 'servico', inválido no CHECK)
   - As demais tabelas estão corretas

2. Executar nova: 007_orcamento_campos.sql
   - proposta_itens.modelo_id
   - pedido_itens: 8 campos técnicos
   - regras_precificacao: decisão sobre schema (ver abaixo)

3. Executar pendente: 004_integracao_bridge.sql
   - Integração ERP ↔ App de Campo (paralelo, não bloqueia orçamento)
```

### Decisão: regras_precificacao

**Opção A** (recomendada): Reescrever a tabela com schema colunar legível:
```sql
-- Mais simples, mais legível, direto ao ponto
CREATE TABLE regras_precificacao (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria       TEXT NOT NULL,  -- 'banner', 'adesivo', etc.
  markup_minimo   NUMERIC(5,2) NOT NULL DEFAULT 30,
  markup_sugerido NUMERIC(5,2) NOT NULL DEFAULT 45,
  desconto_maximo NUMERIC(5,2) DEFAULT 15,
  preco_m2_minimo NUMERIC(12,2),
  taxa_urgencia   NUMERIC(5,2) DEFAULT 50,
  ativo           BOOLEAN DEFAULT TRUE,
  criado_por      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**Opção B**: Manter schema tipo/valor da 006, reescrever AdminPrecificacaoPage para ler/escrever em múltiplas linhas (uma por tipo).

→ **Recomendação**: Opção A. É mais legível, menos queries, mais simples de manter.

---

## 10. Catálogo de Produtos

### 10.1 CRUD Real (AdminProdutosPage)

```
/admin/produtos
  ├─ Lista de produtos com categorias
  ├─ Criar / Editar produto
  │   - nome, categoria, unidade_padrao, descricao, ativo
  └─ Accordion de modelos por produto
      ├─ Criar / Editar modelo
      │   - nome, dimensões padrão, markup, margem mínima, tempo produtivo
      └─ Vincular materiais ao modelo
          - Buscar no catálogo de materiais (467 items)
          - quantidade_por_unidade, unidade
```

### 10.2 produto.service.ts (novo)

```typescript
export const produtoService = {
  // Produtos
  listar(filtros?): Promise<Produto[]>
  buscarPorId(id): Promise<Produto & { modelos: ProdutoModelo[] }>
  criar(dados): Promise<Produto>
  atualizar(id, dados): Promise<Produto>
  alterarStatus(id, ativo): Promise<void>

  // Modelos
  criarModelo(produtoId, dados): Promise<ProdutoModelo>
  atualizarModelo(id, dados): Promise<ProdutoModelo>
  excluirModelo(id): Promise<void>

  // Materiais do modelo
  salvarMaterialModelo(modeloId, materiais): Promise<void>  // replace-all
  removerMaterialModelo(id): Promise<void>

  // Processos do modelo
  salvarProcessosModelo(modeloId, processos): Promise<void>  // replace-all
};
```

---

## 11. Admin de Precificação

### 11.1 AdminPrecificacaoPage (corrigida)

A página já é funcional para `config_precificacao`. O problema é o schema de `regras_precificacao`. Após executar migration 007 com schema colunar, o CRUD de regras funciona sem alteração.

### 11.2 Funcionalidades da Área Admin de Pricing

| Feature | Status Atual | Após Implementação |
|---|---|---|
| Config global Mubisys | ✅ Funcional | ✅ Mantém |
| Preview ao vivo (custo/min, etc.) | ✅ Funcional | ✅ Mantém |
| Markup mínimo/sugerido por categoria | ⚠️ Schema errado | ✅ Funcional |
| Desconto máximo por categoria | ❌ Não existe | ✅ Campo novo |
| Preço mínimo por m² | ❌ Não existe | ✅ Campo novo |
| Taxa de urgência | ❌ Não existe | ✅ Campo novo |
| Simulador de break-even | ❌ Não existe | 🔜 Fase 2 |
| Simulador de desconto | ❌ Não existe | 🔜 Fase 2 |

---

## Apêndice: Decisões de Arquitetura

| Decisão | Opção Escolhida | Motivo |
|---|---|---|
| Renomear tabela `propostas` | ❌ Não renomear | 307 clientes + FKs em 6 tabelas. Custo alto, ganho zero. |
| Processos no item | Não persistir em tabela separada | `proposta_itens` já tem `custo_mo` (agregado). Processos individuais ficam no modelo. |
| Templates: JSONB vs tabela relacional | Manter JSONB por ora | Simples o suficiente para fase atual. Templates são specs simples. |
| `regras_precificacao` | Schema colunar (Opção A) | Mais legível, menos código, mais fácil de manter. |
| Auto-numeração | Confiar no trigger do banco | Race condition no frontend resolvida. Trigger já existe e funciona. |
| Acabamentos no motor | Calcular separado, somar no final | Elimina dupla contagem. Acabamentos não participam de overhead/MO Mubisys. |
