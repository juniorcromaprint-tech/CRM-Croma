# Auditoria: Pricing Evolution — Motor Mubisys + Override Bidirecional

> **Data**: 2026-03-16 | **Branch**: claude/pedantic-meitner (mergeada em main)
> **Auditor**: Claude Opus 4.6 | **Status**: Concluida

---

## Resumo Executivo

| Categoria | Contagem |
|-----------|----------|
| Bugs criticos | 1 |
| Bugs moderados | 2 |
| Avisos / melhorias | 4 |
| Itens corretos | 12 |

**Veredicto**: O motor Mubisys 9 passos esta matematicamente correto. O override bidirecional funciona. Os 40 testes passam. O unico bug critico e a **dupla contagem de acabamentos** na persistencia e no ResumoVendedor.

---

## Motor Mubisys — 9 Passos (pricing-engine.ts)

### Calculo Manual Verificado

**Config Croma padrao:**
```
faturamentoMedio: 110,000 | custoOperacional: 36,800
custoProdutivo: 23,744   | qtdFuncionarios: 6
horasMes: 176             | comissao: 5% | impostos: 12% | juros: 2%
```

**Input teste (Banner Lona):**
```
Materiais: Lona 440g (5 × R$12.50 = R$62.50), Tinta UV (2 × R$8.00 = R$16.00)
Processos: Impressao (30 min), Acabamento (15 min)
Markup: 40%
```

| Passo | Formula | Valor Manual | Motor | Status |
|-------|---------|-------------|-------|--------|
| 1. Materia Prima | Σ(qtd × preco) | R$ 78.50 | 78.50 | ✅ |
| 2. Tempo Produtivo | Σ minutos | 45 min | 45 | ✅ |
| 3. % Custos Fixos | ((36800-23744)×100)/110000 | 11.869% | 11.869% | ✅ |
| 4. Custo/Minuto | ((23744/6)/176)/60 | R$ 0.3747 | 0.3747 | ✅ |
| 4b. Mao de Obra | 45 × 0.3747 | R$ 16.864 | 16.864 | ✅ |
| 5. % Vendas | (5+12+2)/100 | 0.19 | 0.19 | ✅ |
| 6. Custo Base | (78.50+16.864)×1.11869 | R$ 106.687 | 106.687 | ✅ |
| 7. Valor antes Markup | 106.687/0.81 | R$ 131.713 | 131.713 | ✅ |
| 8. Valor Markup | 131.713×0.40 | R$ 52.685 | 52.685 | ✅ |
| 9. Preco Venda | 131.713+52.685 | **R$ 184.40** | **184.40** | ✅ |

### Verificacao Override Reverso

```
Preco-alvo: R$ 184.40 → calcMarkupReverso → markup: 40.00% ✅
Preco-alvo: R$ 250.00 → calcMarkupReverso → markup: 89.83%
  Verificacao: 131.713 × 1.8983 = R$ 250.04 ≈ R$ 250 ✅
Preco-alvo: R$ 50.00 → markup: -62.03% (abaixo do custo) → valido: false ✅
```

### Cenario Realista — Banner Lona 3×1.5m, qty 5, com acabamentos

```
Materiais: Lona 440g (4.5m² × R$12.50), Tinta UV (4.5L × R$8.00)
Acabamentos: Ilhos (20 × R$0.50), Bastao (2 × R$3.00)
Processos: Impressao (30 min, setup 10 min), Acabamento (15 min, setup 5 min)
Markup: 40%, Quantidade: 5
```

| Passo | Calculo | Valor |
|-------|---------|-------|
| 1. Vmp | 56.25 + 36.00 + 10.00 + 6.00 | R$ 108.25 |
| 2. T | (30+10/5) + (15+5/5) = 32+16 | 48 min |
| 4b. MO | 48 × 0.3747 | R$ 17.99 |
| 6. Vb | 126.24 × 1.11869 | R$ 141.22 |
| 7. Vam | 141.22 / 0.81 | R$ 174.34 |
| 9. Vv | 174.34 × 1.40 | **R$ 244.08/un** |
| Total | 244.08 × 5 | **R$ 1,220.38** |

Setup time dilution: qty 1 = R$ 259.32/un vs qty 5 = R$ 244.08/un (desconto natural de 5.9%) ✅

---

## Testes Automatizados

```
40 testes — todos passam (vitest)
```

Cobertura:
- ✅ Cada passo individual do motor (3, 4, 5)
- ✅ Motor completo (9 passos end-to-end)
- ✅ Invariantes de negocio (linearidade, monotonia)
- ✅ calcMarkupReverso (round-trip, preco negativo, preco zero)
- ✅ calcOrcamentoItem com acabamentos no motor
- ✅ Setup time dilution por quantidade
- ✅ calcMarkupParaPreco (unitario e m2)
- ✅ validarDesconto (limites, aprovacao, alertas)

---

## Bugs Encontrados

### ❌ BUG CRITICO — Dupla contagem de acabamentos na persistencia

**Arquivos**: `OrcamentoEditorPage.tsx:386-388`, `ResumoVendedor.tsx:63`

O `calcOrcamentoItem` alimenta acabamentos DENTRO do motor como materiais (correto para calculo). O resultado `custoMP` do motor ja inclui acabamentos. Porem:

**1. Persistencia no banco (OrcamentoEditorPage.tsx:386)**:
```ts
custo_mp: pricingResult.custoMP + pricingResult.custosAcabamentos,
// custoMP ja inclui acabamentos! Resultado: custo_mp inflado
```

**2. Display no ResumoVendedor (ResumoVendedor.tsx:63)**:
```ts
brl(resultado.custoMP + resultado.custosAcabamentos)
// Mostra custo de material inflado ao vendedor
```

**3. custo_fixo deslocado (OrcamentoEditorPage.tsx:388)**:
```ts
custo_fixo: Math.max(0, pricingResult.custoTotal - pricingResult.custoMP
           - pricingResult.custosAcabamentos - pricingResult.custoMO)
// custoFixo fica menor que o real (deflacionado pelo valor dos acabamentos)
```

**Impacto**: O total `custo_mp + custo_mo + custo_fixo` soma corretamente (os erros se cancelam), entao **o preco final nao e afetado**. Mas os campos individuais `custo_mp` e `custo_fixo` na tabela `proposta_itens` estao errados, afetando relatorios de margem por componente.

**Fix**:
```ts
// OrcamentoEditorPage.tsx:386
custo_mp: pricingResult.custoMP,  // ja inclui acabamentos

// OrcamentoEditorPage.tsx:388
custo_fixo: Math.max(0, pricingResult.custoTotal - pricingResult.custoMP - pricingResult.custoMO),

// ResumoVendedor.tsx:63
brl(resultado.custoMP)  // ja inclui acabamentos
```

---

### ❌ BUG MODERADO — useEffect deps incompletas no volume discount

**Arquivo**: `useItemEditor.ts:100`

```ts
}, [volumeDiscount.desconto, overrideSource]);
// Falta: markupSugerido
```

Quando o usuario troca de categoria (ex: "banner" → "adesivo"), `markupSugerido` muda mas o effect nao re-executa porque `volumeDiscount.desconto` pode ser o mesmo. O markup nao e recalculado com o novo sugerido.

**Fix**: Adicionar `markupSugerido` nas deps:
```ts
}, [volumeDiscount.desconto, overrideSource, markupSugerido]);
```

---

### ❌ BUG MODERADO — Falsy check em markupSugerido

**Arquivo**: `useItemEditor.ts:96`

```ts
const modeloMarkup = markupSugerido || newItem.markup_percentual;
```

Se `markupSugerido` for 0 (valor valido), o `||` faz fallback para `newItem.markup_percentual`. Deveria usar `??`:

```ts
const modeloMarkup = markupSugerido ?? newItem.markup_percentual;
```

Na pratica, `sugerirMarkup()` retorna minimo 40, entao este bug nunca dispara hoje. Mas e uma bomba-relogio se alguem configurar markup sugerido = 0.

---

## Avisos / Melhorias

### ⚠️ PricingCalculator — Display confuso de acabamentos

**Arquivo**: `PricingCalculator.tsx:23-24`

```ts
{ label: "Custo de Material", value: resultado.custoMP },     // JA inclui acabamentos
{ label: "Acabamentos", value: resultado.custosAcabamentos },  // Subconjunto do anterior
```

O usuario ve duas linhas que somadas parecem ser o custo total de materiais, mas acabamentos ja esta embutido na primeira. Sugestao: mudar label ou separar o custo puro de materiais.

---

### ⚠️ debounceRef compartilhado entre dois inputs

**Arquivo**: `ItemStep3Revisao.tsx:58`

Um unico `debounceRef` e usado para os inputs de "Preco Unitario" e "Preco/m2". Se o usuario digitar em um e rapidamente no outro, o debounce do primeiro e cancelado. Risco baixo (UX apenas), mas pode causar override perdido.

**Fix**: Usar dois refs separados.

---

### ⚠️ isDefaultConfig duplicado em useOrcamentoAlerts

**Arquivo**: `useOrcamentoAlerts.ts:43-45`

O alert hook recalcula `isDefaultConfig` comparando valores contra `DEFAULT_PRICING_CONFIG`, enquanto `useConfigPrecificacao` ja retorna `isDefault: true/false` com base na existencia de registro no banco. Podem divergir se alguem configurar exatamente os mesmos valores do default.

---

### ⚠️ config_precificacao sem tabela no schema visivel

O hook `useConfigPrecificacao` consulta `config_precificacao`, mas essa tabela nao aparece nas migrations documentadas (001-035). Pode ser criada manualmente ou em migration nao documentada. Se nao existir, o hook retorna `isDefault: true` e usa `DEFAULT_PRICING_CONFIG` — o que funciona, mas o alerta vermelho na UI nao sumira ate a tabela ser populada.

---

## O que esta Correto e Funcionando

| # | Item | Status |
|---|------|--------|
| 1 | Motor Mubisys 9 passos — calculo matematicamente correto | ✅ |
| 2 | Acabamentos entram no motor COM overhead (fix do subcusteio ~19%) | ✅ |
| 3 | Setup time diluido pela quantidade | ✅ |
| 4 | calcMarkupReverso — round-trip exato (forward → reverse → mesmo markup) | ✅ |
| 5 | calcMarkupParaPreco — funciona para unitario e m2 | ✅ |
| 6 | Override bidirecional na UI (markup ↔ preco ↔ preco/m2) | ✅ |
| 7 | Faixas de volume — desconto automatico no markup | ✅ |
| 8 | Validacao de markup minimo com alerta visual | ✅ |
| 9 | Validacao de desconto com workflow de aprovacao | ✅ |
| 10 | isDefaultConfig — alerta vermelho quando config nao foi feita | ✅ |
| 11 | Guard contra item R$ 0,00 (handleAddItem:369-372) | ✅ |
| 12 | Guard contra divisao por zero em todos os calculos (faturamento, funcionarios, horas, Pv) | ✅ |

---

## Conclusao

O motor de precificacao esta **solido** — os 9 passos estao corretos, o override bidirecional funciona, e os 40 testes cobrem bem os cenarios. O unico bug critico (dupla contagem de acabamentos) afeta apenas os campos de breakdown armazenados no banco, nao o preco final. Recomendo corrigir os 3 bugs antes do proximo deploy.
