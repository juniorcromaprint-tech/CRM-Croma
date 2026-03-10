# CROMA PRINT — MOTOR DE PRECIFICACAO

> Sistema de formacao de preco baseado no metodo Mubisys (Custeio Direto em 9 Passos)
> Implementacao: `src/shared/services/pricing-engine.ts`
> Atualizado: 2026-03-10

---

## 1. Visao Geral

A Croma Print utiliza o metodo **Mubisys de Custeio Direto** para calcular precos de venda. O algoritmo considera:

- Custo real de materia-prima por item
- Tempo produtivo por etapa
- Rateio de custos fixos da empresa
- Percentuais de venda (comissao + impostos + juros)
- Markup configuravel por categoria de produto

O motor esta implementado em TypeScript puro (sem dependencias externas) e e chamado em tempo real durante a criacao de orcamentos.

---

## 2. Configuracao Base (PricingConfig)

Valores configurados na tabela `config_precificacao` do Supabase:

| Parametro | Variavel | Default | Descricao |
|-----------|----------|---------|-----------|
| Faturamento medio | `F` | R$ 110.000 | Faturamento medio mensal da empresa |
| Custo operacional total | `C` | R$ 36.800 | Total de custos fixos + variaveis mensais |
| Custo produtivo (folha) | `CP` | R$ 23.744 | Folha de pagamento da producao |
| Funcionarios producao | `Qf` | 6 | Quantidade de funcionarios produtivos |
| Horas/mes | `H` | 176 | 22 dias x 8 horas |
| Comissao de venda | - | 5% | Percentual sobre venda |
| Impostos | - | 12% | Carga tributaria sobre receita |
| Juros/financeiro | - | 2% | Custo financeiro de prazo |

### Formula dos Custos Fixos
```
Folha por funcionario (Fp) = CP / Qf
                           = R$ 23.744 / 6
                           = R$ 3.957,33
```

---

## 3. Os 9 Passos do Mubisys

### Passo 1 — Levantamento de Materia-Prima (Vmp)

Soma do custo de todos os materiais utilizados no item:

```
Vmp = SUM(quantidade_material × preco_unitario)
```

**Exemplo**: Banner 100x120cm
| Material | Quantidade | Preco Unit. | Subtotal |
|----------|-----------|-------------|----------|
| Lona 440g | 1.2 m² | R$ 8,50/m² | R$ 10,20 |
| Tinta eco-solvente | 0.12 L | R$ 45,00/L | R$ 5,40 |
| Ilhos (10 pares) | 10 un | R$ 0,50/un | R$ 5,00 |
| **Total Vmp** | | | **R$ 20,60** |

---

### Passo 2 — Levantamento de Tempo Produtivo (T)

Soma do tempo de cada etapa produtiva em minutos:

```
T = SUM(tempo_por_etapa)
```

**Exemplo**: Banner 100x120cm
| Etapa | Tempo |
|-------|-------|
| Criacao/arte | 30 min |
| Impressao | 5 min |
| Acabamento (ilhos) | 10 min |
| Conferencia | 3 min |
| **Total T** | **48 min** |

---

### Passo 3 — Percentual de Custos Fixos (P%)

Quanto os custos fixos representam sobre o faturamento:

```
P = ((C - CP) × 100) / F
P = ((36.800 - 23.744) × 100) / 110.000
P = (13.056 × 100) / 110.000
P = 11,87%
```

---

### Passo 4 — Custo por Minuto de Producao (Cm)

Quanto custa cada minuto de trabalho produtivo:

```
Cm = ((Fp / Qf) / H) / 60
Cm = ((23.744 / 6) / 176) / 60
Cm = (3.957,33 / 176) / 60
Cm = 22,49 / 60
Cm = R$ 0,3748 por minuto
```

---

### Passo 5 — Percentual de Vendas (Pv)

Soma dos percentuais que incidem sobre a venda:

```
Pv = (comissao + impostos + juros) / 100
Pv = (5 + 12 + 2) / 100
Pv = 0,19 (19%)
```

---

### Passo 6 — Custo Base (Vb)

Custo do produto incluindo materia-prima, mao-de-obra e rateio fixo:

```
MO = T × Cm = 48 × 0,3748 = R$ 18,00
Vb = (Vmp + MO) × (1 + P/100)
Vb = (20,60 + 18,00) × (1 + 11,87/100)
Vb = 38,60 × 1,1187
Vb = R$ 43,18
```

---

### Passo 7 — Valor Antes do Markup (Vam)

Preco minimo que cobre custos + percentuais de venda:

```
Vam = Vb / (1 - Pv)
Vam = 43,18 / (1 - 0,19)
Vam = 43,18 / 0,81
Vam = R$ 53,31
```

---

### Passo 8 — Valor do Markup (Vm)

Lucro adicionado sobre o preco:

```
Vm = (Vam × Pm / 100) / (1 - Pv)

Onde Pm = markup percentual (ex: 45%)

Vm = (53,31 × 45 / 100) / (1 - 0,19)
Vm = 23,99 / 0,81
Vm = R$ 29,62
```

---

### Passo 9 — Preco Final de Venda (Vv)

```
Vv = Vam + Vm
Vv = 53,31 + 29,62
Vv = R$ 82,93 por unidade
```

---

## 4. Resumo do Calculo (Exemplo Completo)

**Produto**: Banner 100x120cm, Lona 440g com ilhos

| Passo | Calculo | Valor |
|-------|---------|-------|
| 1. MP (Vmp) | Lona + tinta + ilhos | R$ 20,60 |
| 2. Tempo (T) | 48 minutos total | 48 min |
| 3. Fixos (P%) | (C-CP)/F × 100 | 11,87% |
| 4. Cm | Custo/minuto | R$ 0,3748 |
| 5. Pv | Comissao+impostos+juros | 19% |
| 6. Custo base (Vb) | (MP+MO) × (1+P%) | R$ 43,18 |
| 7. Antes markup (Vam) | Vb/(1-Pv) | R$ 53,31 |
| 8. Markup (Vm) | Vam×Pm/(1-Pv) | R$ 29,62 |
| 9. **Preco final (Vv)** | Vam + Vm | **R$ 82,93** |

**Margem real**: 45% sobre o custo base
**Preco por m²**: R$ 82,93 / 1,2m² = R$ 69,11/m²

---

## 5. Funcoes Auxiliares

### `calcPrecoRapido(custoMP, tempoMin, markup)`
Calculo simplificado para estimativas rapidas sem detalhar materiais.

### `calcMargemReal(precoVenda, custoMPReal, tempoReal)`
Apos conclusao do pedido, calcula a margem real comparando preco vendido com custos efetivos.

### `calcBreakEven(custoFixo, precoUnitario, custoVariavel)`
Calcula quantidade minima para atingir ponto de equilibrio.

### `simularDesconto(precoOriginal, descontoPercent, margemMinima)`
Simula impacto de desconto na margem, alertando se ficaria abaixo do minimo.

---

## 6. Regras de Precificacao

Configuradas na tabela `regras_precificacao`:

| Regra | Tipo | Valor | Descricao |
|-------|------|-------|-----------|
| Markup minimo padrao | `markup_minimo` | 30% | Nenhum item pode ter markup < 30% |
| Markup padrao | `markup_padrao` | 45% | Sugestao padrao para maioria dos produtos |
| Markup premium | `markup_padrao` | 55% | Para ACM, letra-caixa (alto valor agregado) |
| Desconto maximo volume | `desconto_maximo` | 15% | Limite de desconto por volume |
| Preco m² minimo (lona) | `preco_m2_minimo` | R$ 18 | Floor price para lona |
| Taxa urgencia 24h | `taxa_urgencia` | 50% | Acrescimo para prazo < 24h |
| Taxa urgencia 48h | `taxa_urgencia` | 25% | Acrescimo para prazo 24-48h |

### Validacao de Markup
O sistema valida em tempo real:
- **Abaixo do minimo (30%)**: Bloqueio com aviso vermelho
- **Abaixo do padrao (45%)**: Aviso amarelo, requer justificativa
- **Acima do padrao**: OK, sem restricao

---

## 7. Categorias de Produto e Markups

| Categoria | Markup Sugerido | Margem Min. | Exemplos |
|-----------|----------------|-------------|----------|
| Fachadas | 55% | 20% | ACM, lona tensionada, letra-caixa |
| PDV | 45% | 15% | Banners, displays, wobblers |
| Comunicacao interna | 40% | 15% | Placas, sinalizacao, quadros |
| Campanhas | 45% | 10% | Faixas, materiais sazonais |
| Envelopamento | 50% | 15% | Veiculos, vitrines, mobiliario |

---

## 8. Acabamentos e Custos Extras

Custos adicionais por item (tabela `acabamentos`):

| Acabamento | Custo | Unidade |
|-----------|-------|---------|
| Ilhos a cada 50cm | R$ 0,50 | un |
| Ilhos a cada 30cm | R$ 0,80 | un |
| Bastao superior e inferior | R$ 8,00 | un |
| Bainha superior | R$ 3,00 | un |
| Fundo branco | R$ 0,15 | m² |
| Laminacao brilho | R$ 2,50 | m² |
| Laminacao fosco | R$ 2,80 | m² |
| Cantoneiras | R$ 4,00 | un |
| Velcro adesivo | R$ 1,20 | par |
| Enrolado em tubo | R$ 2,00 | un |

Acabamentos sao somados ao Vmp (custo de materia-prima) antes do calculo.

---

## 9. Servicos (nao afetam o preco por item)

Servicos sao adicionados ao orcamento como itens separados:

| Servico | Custo/Hora | Horas Est. | Preco Fixo |
|---------|-----------|-----------|-----------|
| Criacao de Arte | R$ 80 | 2h | - |
| Arte Urgente (24h) | R$ 120 | 2h | - |
| Revisao de Arte | R$ 80 | 0.5h | - |
| Instalacao Local | R$ 150 | 3h | - |
| Instalacao Viagem (diaria) | R$ 600 | 8h | R$ 600 |
| Montagem de Estrutura | R$ 120 | 4h | - |
| Frete Cidade | - | - | R$ 80 |
| Frete Estado | - | - | R$ 250 |

---

## 10. Fluxo de Dados no Codigo

```
OrcamentoEditorPage (UI)
    ↓ usuario seleciona produto, modelo, materiais, acabamentos
    ↓ monta OrcamentoItemInput { materiais[], acabamentos[], processos[] }

useOrcamentoPricing (hook)
    ↓ chama calcOrcamentoItem()

orcamento-pricing.service.ts (bridge)
    ↓ combina materiais + acabamentos em lista unica
    ↓ formata processos com tempo
    ↓ chama calcPricing()

pricing-engine.ts (motor)
    ↓ executa 9 passos do Mubisys
    ↓ retorna PricingResult completo

PricingCalculator (componente)
    ← exibe breakdown visual: custos, margem, composicao
```

### Interfaces Chave

```typescript
interface PricingInput {
  materiais: MaterialInput[];   // nome, quantidade, precoUnitario
  processos: ProcessoInput[];   // etapa, tempoMinutos
  markupPercentual: number;
  quantidade: number;
}

interface PricingResult {
  // Passos
  custoMP: number;              // Vmp
  tempoTotal: number;           // T (minutos)
  percentualFixos: number;      // P%
  custoMinuto: number;          // Cm
  percentualVendas: number;     // Pv
  custoBase: number;            // Vb
  valorAntesMarkup: number;     // Vam
  valorMarkup: number;          // Vm
  precoUnitario: number;        // Vv
  // Derivados
  precoTotal: number;           // Vv × quantidade
  margemPercentual: number;
  custoMO: number;
  precoPorM2: number;
  composicao: {
    mp: number;                 // % MP no preco
    mo: number;                 // % MO no preco
    fixos: number;              // % custos fixos
    vendas: number;             // % custos de venda
    margem: number;             // % margem
  };
}
```
