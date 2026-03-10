# Motor de Precificação Mubisys — Auditoria e Referência Técnica

> Atualizado em: 2026-03-10 | Status: Auditado e Validado

---

## Status da Auditoria

| Item | Status | Observação |
|---|---|---|
| Implementação matemática dos 9 passos | Correto | Fórmulas validadas contra documentação Mubisys |
| Bug de multiplicação dupla (precoTotal × qty²) | Corrigido | `precoVenda` é unitário; `precoTotal = precoVenda × qty` feito pelo serviço |
| Dados chegando ao motor | FALHA | Arrays `materiais[]` e `processos[]` chegam vazios do editor — motor retorna R$ 0,00 |
| Parâmetros de configuração | Correto | `config_precificacao` seedado com valores reais Mubisys |
| Integração com banco | PARCIAL | `modelo_materiais` com 0 registros — motor nunca recebe custo real de material |

**Resumo**: O motor matemático é correto. O problema está na camada de integração: materiais do catálogo não chegam ao motor.

---

## Os 9 Passos do Motor Mubisys

### Passo 1 — Levantamento de Matéria Prima (Vmp)

```
Vmp = Σ (quantidade_material × preço_unitário_material)
```

Soma o custo de todos os materiais utilizados na produção de **uma unidade** do item.

---

### Passo 2 — Levantamento de Tempo Produtivo (T)

```
T = Σ tempo_de_cada_etapa (em minutos)
```

Soma o tempo de produção de todas as etapas do processo.

---

### Passo 3 — Percentual de Custos Fixos (P%)

```
P% = ((C - CP) × 100) / F

Onde:
  C  = Custo operacional total mensal
  CP = Custo produtivo (folha de pagamento da produção)
  F  = Faturamento médio mensal
```

Representa o peso percentual dos custos fixos sobre o faturamento.

---

### Passo 4 — Custo por Minuto (Cm)

```
Cm = ((CP / Qf) / horasMes) / 60

MO = T × Cm

Onde:
  CP       = Custo produtivo (folha da produção)
  Qf       = Quantidade de funcionários produtivos
  horasMes = Horas trabalhadas por mês (padrão: 176h)
```

`MO` é o custo de mão de obra para produzir o item.

---

### Passo 5 — Percentual de Vendas (Pv)

```
Pv = (comissao + impostos + juros) / 100
```

Retorna como fração decimal (ex: 0,19 = 19%).

---

### Passo 6 — Custo Base (Vb)

```
Vb = (Vmp + MO) × (1 + P% / 100)
```

Incorpora os custos fixos sobre os custos diretos.

---

### Passo 7 — Valor Antes do Markup (Vam)

```
Vam = Vb / (1 - Pv)
```

Incorpora os custos de venda (impostos, comissão, juros) no preço mínimo.

---

### Passo 8 — Aplicar Markup (Vm)

```
Vm = Vam × (markup% / 100)
```

Calcula o valor adicional de markup sobre o custo total com vendas.

---

### Passo 9 — Valor Final de Venda (Vv)

```
Vv = Vam + Vm
```

O motor sempre retorna o **preço unitário**. Multiplicar por quantidade é responsabilidade do serviço que chama o motor (`orcamento-pricing.service.ts`).

---

## Parâmetros com Valores Padrão

| Parâmetro | Campo no banco | Valor padrão | Unidade |
|---|---|---|---|
| Faturamento médio mensal | `faturamento_medio` | R$ 110.000 | R$/mês |
| Custo operacional total | `custo_operacional` | R$ 36.800 | R$/mês |
| Custo produtivo (folha) | `custo_produtivo` | R$ 23.744 | R$/mês |
| Quantidade de funcionários | `qtd_funcionarios` | 6 | pessoas |
| Horas trabalhadas por mês | `horas_mes` | 176 | horas (22 dias × 8h) |
| Comissão de vendas | `percentual_comissao` | 5 | % |
| Impostos sobre venda | `percentual_impostos` | 12 | % |
| Juros/custo financeiro | `percentual_juros` | 2 | % |

Esses valores são configuráveis em `/admin/precificacao`.

---

## Exemplo Calculado — Banner Lona 440g 100×80cm × 50 unidades

**Dados do item:**
- Material: Lona 440g, consumo = 0,80m² por unidade, preço = R$ 4,50/m²
- Processo: impressão digital 8 min + acabamento (ilhós + reforço) 12 min = 20 min/unidade

**Configuração (padrões):**
- Custo operacional: R$ 36.800 | Custo produtivo: R$ 23.744
- Faturamento médio: R$ 110.000 | Funcionários: 6 | Horas/mês: 176
- Comissão: 5% | Impostos: 12% | Juros: 2%
- Markup desejado: 40%

---

### Passo a passo para UMA unidade

**Passo 1 — Matéria Prima (Vmp):**
```
Vmp = 0,80 m² × R$ 4,50 = R$ 3,60
```

**Passo 2 — Tempo Produtivo (T):**
```
T = 8 min + 12 min = 20 min
```

**Passo 3 — Percentual Fixo (P%):**
```
P% = ((36.800 - 23.744) × 100) / 110.000
P% = (13.056 × 100) / 110.000
P% = 11,87%
```

**Passo 4 — Custo por Minuto (Cm) e Mão de Obra (MO):**
```
Cm = ((23.744 / 6) / 176) / 60
Cm = (3.957,33 / 176) / 60
Cm = 22,49 / 60
Cm = R$ 0,3748/min

MO = 20 min × R$ 0,3748 = R$ 7,50
```

**Passo 5 — Percentual de Vendas (Pv):**
```
Pv = (5 + 12 + 2) / 100 = 0,19  (19%)
```

**Passo 6 — Custo Base (Vb):**
```
Vb = (R$ 3,60 + R$ 7,50) × (1 + 11,87/100)
Vb = R$ 11,10 × 1,1187
Vb = R$ 12,42
```

**Passo 7 — Valor Antes do Markup (Vam):**
```
Vam = R$ 12,42 / (1 - 0,19)
Vam = R$ 12,42 / 0,81
Vam = R$ 15,33
```

**Passo 8 — Markup (Vm):**
```
Vm = R$ 15,33 × (40 / 100)
Vm = R$ 6,13
```

**Passo 9 — Preço Final Unitário (Vv):**
```
Vv = R$ 15,33 + R$ 6,13 = R$ 21,46 por banner
```

**Preço Total para 50 unidades:**
```
Preço Total = R$ 21,46 × 50 = R$ 1.073,00
```

**Margem bruta estimada:**
```
Margem = ((Vv - Vb) / Vv) × 100
Margem = ((21,46 - 12,42) / 21,46) × 100
Margem ≈ 42,1%
```

---

## Sobre o Bug de Multiplicação Dupla

**Confirmado: NÃO existe bug de multiplicação dupla no motor atual.**

O motor (`pricing-engine.ts`) retorna `precoVenda` como preço **unitário** por design — veja o comentário explícito no código:

```typescript
// O motor retorna SEMPRE o preço UNITÁRIO.
// A multiplicação por quantidade é responsabilidade de quem chama
// (orcamento-pricing.service).
const precoVenda = valorAntesMarkup + valorMarkup;
```

O serviço de integração (`orcamento-pricing.service.ts`) é responsável por:
```
precoTotal = precoVenda × quantidade
```

**Porém**: a auditoria de 2026-03-10 identificou que versões anteriores do arquivo `orcamento-pricing.service.ts` tinham este bug. Se o sistema apresentar preços inflados para quantidade > 1, verificar se o serviço de integração está multiplicando por `qty` após já ter passado `qty` para o motor.

---

## Interface OrcamentoMaterial e Fluxo de Dados

### Como os materiais chegam ao motor

```typescript
// Interface no motor
export interface MaterialItem {
  nome: string;
  quantidade: number;   // consumo por unidade do produto
  precoUnitario: number; // preço por unidade do material (ex: R$/m²)
}

// Interface no orçamento
export interface OrcamentoMaterial {
  material_id: string;
  nome: string;
  quantidade: number;
  unidade: string;
  preco_unitario: number;
  custo_total: number;
}
```

**Fluxo esperado:**
1. Usuário seleciona produto/modelo no editor de orçamento
2. `useProdutosModelos` carrega `modelo_materiais` do Supabase (tabela `modelo_materiais`)
3. `useOrcamentoPricing` converte `modelo_materiais` → `MaterialItem[]`
4. Motor recebe arrays preenchidos e calcula preço real

**Fluxo atual (problema):**
1. Usuário seleciona produto/modelo
2. `modelo_materiais` tem 0 registros no banco (CRÍTICO)
3. Motor recebe `materiais: []` e `processos: []`
4. Motor retorna `precoVenda = 0`

**Solução**: Vincular materiais aos modelos de produto via `AdminProdutosPage` aba "Modelos", ou via seed SQL na tabela `modelo_materiais`.

---

## Arquivos Principais

| Arquivo | Responsabilidade |
|---|---|
| `src/shared/services/pricing-engine.ts` | Motor de cálculo puro — os 9 passos Mubisys |
| `src/shared/services/orcamento-pricing.service.ts` | Bridge: converte dados do orçamento → input do motor |
| `src/domains/comercial/hooks/useOrcamentoPricing.ts` | Hook React que carrega config do banco e chama o serviço |
| `src/domains/admin/pages/AdminPrecificacaoPage.tsx` | UI para configurar parâmetros do motor |
| `supabase/migrations/006_orcamento_module.sql` | Tabelas de acabamentos, serviços e regras de precificação |

---

## Verificação Rápida (Diagnóstico)

Para confirmar que o motor está recebendo dados, execute no console do navegador:

```javascript
// Verificar se modelo_materiais tem registros
// No Supabase SQL Editor:
SELECT COUNT(*) FROM modelo_materiais;
-- Esperado: > 0
-- Atual: 0 (problema)

SELECT COUNT(*) FROM modelo_processos;
-- Esperado: > 0
-- Atual: 0 (problema)
```

Se ambas as tabelas tiverem 0 registros, o motor sempre retornará R$ 0,00 independentemente de qualquer outra correção.
