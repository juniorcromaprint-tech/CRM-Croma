# CROMA PRINT — MOTOR DE PRECIFICAÇÃO

> Sistema de formação de preço baseado no método Mubisys (Custeio Direto em 9 Passos)
> Implementação: `src/shared/services/pricing-engine.ts` (405 linhas)
> Atualizado: 2026-03-10

**Documentos relacionados**: [ARCHITECTURE](ARCHITECTURE.md) | [BUSINESS_FLOW](BUSINESS_FLOW.md) | [DATABASE_OVERVIEW](DATABASE_OVERVIEW.md)

---

## Índice

- [1. Visão Geral](#1-visão-geral)
- [2. Configuração Base](#2-configuração-base-pricingconfig)
- [3. Os 9 Passos do Mubisys](#3-os-9-passos-do-mubisys)
- [4. Resumo do Cálculo](#4-resumo-do-cálculo-exemplo-completo)
- [5. Segundo Exemplo: Fachada ACM](#5-segundo-exemplo-fachada-acm)
- [6. Funções Auxiliares](#6-funções-auxiliares)
- [7. Regras de Precificação](#7-regras-de-precificação)
- [8. Categorias e Markups](#8-categorias-de-produto-e-markups)
- [9. Acabamentos e Custos Extras](#9-acabamentos-e-custos-extras)
- [10. Serviços](#10-serviços)
- [11. Fluxo de Dados no Código](#11-fluxo-de-dados-no-código)
- [12. Quando Alterar os Parâmetros](#12-quando-alterar-os-parâmetros)

---

## 1. Visão Geral

A Croma Print utiliza o método **Mubisys de Custeio Direto** para calcular preços de venda. O algoritmo considera:

- Custo real de matéria-prima por item
- Tempo produtivo por etapa
- Rateio de custos fixos da empresa
- Percentuais de venda (comissão + impostos + juros)
- Markup configurável por categoria de produto

O motor está implementado em **TypeScript puro** (sem dependências externas) e é chamado **em tempo real** durante a criação de orçamentos no editor.

### Status da Implementação
| Componente | Status |
|-----------|--------|
| Motor de cálculo (9 passos) | ✅ Funcional |
| Configuração via banco (`config_precificacao`) | ✅ Funcional |
| Regras de markup via banco (`regras_precificacao`) | ✅ Hooks prontos, ⚠️ UI parcial |
| Cálculo em tempo real no editor | ✅ Funcional (com arrays vazios — sendo corrigido) |
| Funções auxiliares (break-even, desconto, margem real) | ✅ Funcional |

---

## 2. Configuração Base (PricingConfig)

Valores configurados na tabela `config_precificacao` do Supabase:

| Parâmetro | Variável | Default | Descrição |
|-----------|----------|---------|-----------|
| Faturamento médio | `F` | R$ 110.000 | Faturamento médio mensal da empresa |
| Custo operacional total | `C` | R$ 36.800 | Total de custos fixos + variáveis mensais |
| Custo produtivo (folha) | `CP` | R$ 23.744 | Folha de pagamento da produção |
| Funcionários produção | `Qf` | 6 | Quantidade de funcionários produtivos |
| Horas/mês | `H` | 176 | 22 dias × 8 horas |
| Comissão de venda | `%Com` | 5% | Percentual sobre venda |
| Impostos | `%Imp` | 12% | Carga tributária sobre receita |
| Juros/financeiro | `%Jur` | 2% | Custo financeiro de prazo |

### Valores Derivados
```
Folha por funcionário (Fp) = CP / Qf = R$ 23.744 / 6 = R$ 3.957,33
Custos fixos não-produtivos = C - CP = R$ 36.800 - R$ 23.744 = R$ 13.056
```

---

## 3. Os 9 Passos do Mubisys

### Passo 1 — Levantamento de Matéria-Prima (Vmp)

Soma do custo de todos os materiais utilizados no item:

```
Vmp = SUM(quantidade_material × preço_unitário)
```

**Exemplo**: Banner 100×120cm
| Material | Quantidade | Preço Unit. | Subtotal |
|----------|-----------|-------------|----------|
| Lona 440g | 1,2 m² | R$ 8,50/m² | R$ 10,20 |
| Tinta eco-solvente | 0,12 L | R$ 45,00/L | R$ 5,40 |
| Ilhós (10 pares) | 10 un | R$ 0,50/un | R$ 5,00 |
| **Total Vmp** | | | **R$ 20,60** |

---

### Passo 2 — Levantamento de Tempo Produtivo (T)

Soma do tempo de cada etapa produtiva em minutos:

```
T = SUM(tempo_por_etapa)
```

**Exemplo**: Banner 100×120cm
| Etapa | Tempo |
|-------|-------|
| Criação/arte | 30 min |
| Impressão | 5 min |
| Acabamento (ilhós) | 10 min |
| Conferência | 3 min |
| **Total T** | **48 min** |

---

### Passo 3 — Percentual de Custos Fixos (P%)

Quanto os custos fixos não-produtivos representam sobre o faturamento:

```
P = ((C - CP) × 100) / F
P = ((36.800 - 23.744) × 100) / 110.000
P = (13.056 × 100) / 110.000
P = 11,87%
```

---

### Passo 4 — Custo por Minuto de Produção (Cm)

Quanto custa cada minuto de trabalho produtivo:

```
Cm = (Fp / H) / 60

Onde Fp = CP / Qf (folha por funcionário)

Cm = (3.957,33 / 176) / 60
Cm = 22,49 / 60
Cm = R$ 0,3748 por minuto
```

> **Nota**: `Fp` já é o custo por funcionário (CP/Qf). Dividir por H converte para custo/hora, e por 60 para custo/minuto.

---

### Passo 5 — Percentual de Vendas (Pv)

Soma dos percentuais que incidem sobre a venda:

```
Pv = (comissão + impostos + juros) / 100
Pv = (5 + 12 + 2) / 100
Pv = 0,19 (19%)
```

---

### Passo 6 — Custo Base (Vb)

Custo do produto incluindo matéria-prima, mão-de-obra e rateio fixo:

```
MO = T × Cm = 48 × 0,3748 = R$ 18,00
Vb = (Vmp + MO) × (1 + P/100)
Vb = (20,60 + 18,00) × (1 + 11,87/100)
Vb = 38,60 × 1,1187
Vb = R$ 43,18
```

---

### Passo 7 — Valor Antes do Markup (Vam)

Preço mínimo que cobre custos + percentuais de venda:

```
Vam = Vb / (1 - Pv)
Vam = 43,18 / (1 - 0,19)
Vam = 43,18 / 0,81
Vam = R$ 53,31
```

> ⚠️ **Vam é o preço mínimo de venda** — abaixo deste valor, a empresa perde dinheiro mesmo sem lucro.

---

### Passo 8 — Valor do Markup (Vm)

Lucro adicionado sobre o preço:

```
Vm = (Vam × Pm / 100) / (1 - Pv)

Onde Pm = markup percentual (ex: 45%)

Vm = (53,31 × 45 / 100) / (1 - 0,19)
Vm = 23,99 / 0,81
Vm = R$ 29,62
```

---

### Passo 9 — Preço Final de Venda (Vv)

```
Vv = Vam + Vm
Vv = 53,31 + 29,62
Vv = R$ 82,93 por unidade
```

---

## 4. Resumo do Cálculo (Exemplo Completo)

**Produto**: Banner 100×120cm, Lona 440g com ilhós | Markup: 45%

| Passo | Fórmula | Valor |
|-------|---------|-------|
| 1. MP (Vmp) | Lona + tinta + ilhós | R$ 20,60 |
| 2. Tempo (T) | 4 etapas produtivas | 48 min |
| 3. Fixos (P%) | (C-CP)/F × 100 | 11,87% |
| 4. Custo/min (Cm) | (Fp/H)/60 | R$ 0,3748 |
| 5. % Vendas (Pv) | (com+imp+jur)/100 | 19% |
| 6. Custo base (Vb) | (MP+MO) × (1+P%) | R$ 43,18 |
| 7. Antes markup (Vam) | Vb/(1-Pv) | R$ 53,31 |
| 8. Markup (Vm) | Vam×Pm/(1-Pv) | R$ 29,62 |
| 9. **Preço final (Vv)** | Vam + Vm | **R$ 82,93** |

**Métricas derivadas**:
- Margem sobre custo base: 45%
- Preço por m²: R$ 82,93 / 1,2 m² = **R$ 69,11/m²**
- Para 50 unidades: **R$ 4.146,50** total

---

## 5. Segundo Exemplo: Fachada ACM

**Produto**: Fachada em ACM 300×100cm (3m²) com letra-caixa | Markup: 55%

### Passo 1 — Matéria-Prima
| Material | Quantidade | Preço Unit. | Subtotal |
|----------|-----------|-------------|----------|
| Chapa ACM 4mm | 3,0 m² | R$ 95,00/m² | R$ 285,00 |
| Estrutura metalon | 6,0 m | R$ 12,00/m | R$ 72,00 |
| Parafusos inox | 20 un | R$ 0,80/un | R$ 16,00 |
| Rebites | 40 un | R$ 0,25/un | R$ 10,00 |
| Adesivo vinílico recortado | 1,5 m² | R$ 35,00/m² | R$ 52,50 |
| **Total Vmp** | | | **R$ 435,50** |

### Passo 2 — Tempo Produtivo
| Etapa | Tempo |
|-------|-------|
| Projeto/arte | 60 min |
| Corte e dobra ACM | 45 min |
| Serralheria (estrutura) | 90 min |
| Aplicação vinílico | 30 min |
| Montagem | 40 min |
| Conferência | 15 min |
| **Total T** | **280 min** |

### Passos 3-5 — (mesmos valores da configuração base)
- P = 11,87% | Cm = R$ 0,3748/min | Pv = 19%

### Passos 6-9 — Cálculo Final
```
MO = 280 × 0,3748 = R$ 104,94
Vb = (435,50 + 104,94) × 1,1187 = 540,44 × 1,1187 = R$ 604,58
Vam = 604,58 / 0,81 = R$ 746,40
Vm = (746,40 × 55 / 100) / 0,81 = 410,52 / 0,81 = R$ 506,81
Vv = 746,40 + 506,81 = R$ 1.253,21 por unidade
```

**Métricas derivadas**:
- Preço por m²: R$ 1.253,21 / 3,0 m² = **R$ 417,74/m²**
- Margem sobre custo: 55%
- Custo da MP representa **34,7%** do preço final (vs. 24,8% no banner)

### Comparação: Banner vs Fachada ACM
| Métrica | Banner (45%) | Fachada ACM (55%) |
|---------|-------------|-------------------|
| Custo MP | R$ 20,60 | R$ 435,50 |
| Tempo produtivo | 48 min | 280 min |
| Custo base | R$ 43,18 | R$ 604,58 |
| Preço final | R$ 82,93 | R$ 1.253,21 |
| Preço/m² | R$ 69,11 | R$ 417,74 |
| % MP no preço | 24,8% | 34,7% |

> Produtos com alta concentração de MP (como ACM) justificam markups maiores para cobrir o capital empregado.

---

## 6. Funções Auxiliares

### `calcPrecoRapido(custoMP, tempoMin, markup)`
Cálculo simplificado para estimativas rápidas sem detalhar materiais individualmente. Usa os defaults de config.

### `calcMargemReal(precoVenda, custoMPReal, tempoReal)`
Após conclusão do pedido, calcula a margem **real** comparando preço vendido com custos efetivos (MP real consumido + tempo real gasto).

### `calcBreakEven(custoFixo, precoUnitario, custoVariavel)`
Calcula quantidade mínima para atingir ponto de equilíbrio. Útil para definir quantidade mínima de pedido.

### `simularDesconto(precoOriginal, descontoPercent, margemMinima)`
Simula impacto de desconto na margem, alertando se ficaria abaixo do mínimo configurado. Retorna: `{ precoComDesconto, margemResultante, valido }`.

---

## 7. Regras de Precificação

Configuradas na tabela `regras_precificacao` (editáveis via Admin > Precificação):

| Regra | Tipo | Valor | Descrição |
|-------|------|-------|-----------|
| Markup mínimo padrão | `markup_minimo` | 30% | Nenhum item pode ter markup < 30% |
| Markup padrão | `markup_padrao` | 45% | Sugestão para maioria dos produtos |
| Markup premium | `markup_padrao` | 55% | Para ACM, letra-caixa (alto valor agregado) |
| Desconto máximo volume | `desconto_maximo` | 15% | Limite de desconto por volume |
| Preço m² mínimo (lona) | `preco_m2_minimo` | R$ 18 | Floor price para lona impressa |
| Taxa urgência 24h | `taxa_urgencia` | 50% | Acréscimo para prazo < 24h |
| Taxa urgência 48h | `taxa_urgencia` | 25% | Acréscimo para prazo 24-48h |

### Validação de Markup no Editor
O sistema valida em tempo real durante a criação do orçamento:
- 🔴 **Abaixo do mínimo (< 30%)**: Bloqueio visual, aviso vermelho
- 🟡 **Abaixo do padrão (30-45%)**: Aviso amarelo, requer justificativa
- 🟢 **Acima do padrão (> 45%)**: OK, sem restrição

---

## 8. Categorias de Produto e Markups

| Categoria | Markup Sugerido | Margem Mín. | Produtos Típicos |
|-----------|----------------|-------------|------------------|
| Fachadas | 55% | 20% | ACM, lona tensionada, letra-caixa, totens |
| PDV | 45% | 15% | Banners, displays, wobblers, stoppers |
| Comunicação interna | 40% | 15% | Placas, sinalização, quadros, murais |
| Campanhas | 45% | 10% | Faixas, materiais sazonais, kits |
| Envelopamento | 50% | 15% | Veículos, vitrines, mobiliário |
| Grandes formatos | 40% | 12% | Outdoors, backdrops, cenografia |

---

## 9. Acabamentos e Custos Extras

Custos adicionais por item (tabela `acabamentos`). São somados ao **Vmp** (custo de matéria-prima) antes do cálculo:

| Acabamento | Custo | Unidade | Quando Usar |
|-----------|-------|---------|-------------|
| Ilhós a cada 50cm | R$ 0,50 | un | Banners, faixas |
| Ilhós a cada 30cm | R$ 0,80 | un | Banners premium |
| Bastão superior e inferior | R$ 8,00 | un | Banners com cordinha |
| Bainha superior | R$ 3,00 | un | Para bastão |
| Fundo branco | R$ 0,15 | m² | Lonas translúcidas |
| Laminação brilho | R$ 2,50 | m² | Proteção UV + brilho |
| Laminação fosco | R$ 2,80 | m² | Proteção UV + anti-reflexo |
| Cantoneiras | R$ 4,00 | un | Placas rígidas |
| Velcro adesivo | R$ 1,20 | par | Fixação removível |
| Enrolado em tubo | R$ 2,00 | un | Transporte seguro |

---

## 10. Serviços

Serviços são adicionados ao orçamento como **itens separados** (não afetam o preço por item de produção):

| Serviço | Custo/Hora | Horas Est. | Preço Fixo | Categoria |
|---------|-----------|-----------|-----------|-----------|
| Criação de Arte | R$ 80 | 2h | - | criação |
| Arte Urgente (24h) | R$ 120 | 2h | - | criação |
| Revisão de Arte | R$ 80 | 0,5h | - | criação |
| Instalação Local | R$ 150 | 3h | - | instalação |
| Instalação Viagem (diária) | R$ 600 | 8h | R$ 600 | instalação |
| Montagem de Estrutura | R$ 120 | 4h | - | montagem |
| Frete Cidade | - | - | R$ 80 | transporte |
| Frete Estado | - | - | R$ 250 | transporte |

> Cálculo do serviço: `valor = preco_fixo ?? (custo_hora × horas)`

---

## 11. Fluxo de Dados no Código

```
OrcamentoEditorPage (UI)
    ↓ Usuário seleciona produto → modelo → materiais → acabamentos
    ↓ Monta OrcamentoItemInput { materiais[], acabamentos[], processos[] }

useOrcamentoPricing (hook)
    ↓ Chama calcOrcamentoItem() com o input + config do banco

orcamento-pricing.service.ts (bridge)
    ↓ Combina materiais + acabamentos em lista única (MaterialInput[])
    ↓ Formata processos com tempoMinutos (ProcessoInput[])
    ↓ Chama calcPricing()

pricing-engine.ts (motor)
    ↓ Executa 9 passos do Mubisys
    ↓ Retorna PricingResult completo

PricingCalculator (componente visual)
    ← Exibe breakdown: custos, margem, composição (barra visual)
```

### Interfaces Chave

```typescript
interface PricingInput {
  materiais: MaterialInput[];   // { nome, quantidade, precoUnitario }
  processos: ProcessoInput[];   // { etapa, tempoMinutos }
  markupPercentual: number;
  quantidade: number;
}

interface PricingResult {
  // 9 Passos
  custoMP: number;              // Vmp — soma matéria-prima
  tempoTotal: number;           // T — minutos totais
  percentualFixos: number;      // P% — custos fixos
  custoMinuto: number;          // Cm — custo/minuto
  percentualVendas: number;     // Pv — % vendas
  custoBase: number;            // Vb — custo completo
  valorAntesMarkup: number;     // Vam — preço mínimo
  valorMarkup: number;          // Vm — lucro
  precoUnitario: number;        // Vv — preço final
  // Derivados
  precoTotal: number;           // Vv × quantidade
  margemPercentual: number;     // % de margem real
  custoMO: number;              // T × Cm
  precoPorM2: number;           // Vv / área
  composicao: {
    mp: number;                 // % MP no preço
    mo: number;                 // % MO no preço
    fixos: number;              // % custos fixos
    vendas: number;             // % custos de venda
    margem: number;             // % margem
  };
}
```

---

## 12. Quando Alterar os Parâmetros

Os parâmetros em `config_precificacao` devem ser revisados periodicamente:

| Parâmetro | Quando Revisar | Sinal de Alerta |
|-----------|---------------|-----------------|
| Faturamento médio (F) | Trimestral | Margem real < estimada em > 5% |
| Custo operacional (C) | Quando mudar aluguel, conta, seguro | Custos fixos > 12% do faturamento |
| Custo produtivo (CP) | Ao contratar/demitir ou reajuste salarial | Cm muito alto/baixo vs mercado |
| Funcionários (Qf) | Ao alterar quadro | Cm muda automaticamente |
| Horas/mês (H) | Ao alterar jornada | Raramente muda (176h é padrão CLT) |
| Comissão (%) | Ao renegociar com vendedores | Margem líquida < 10% |
| Impostos (%) | Ao mudar regime tributário | Anual (janeiro) |

> **Importante**: Qualquer alteração afeta **todos os orçamentos futuros**. Orçamentos já salvos mantêm os valores calculados na data de criação (snapshot).

### Acesso
Parâmetros editáveis em: **Admin > Precificação** (`/admin/precificacao`)
