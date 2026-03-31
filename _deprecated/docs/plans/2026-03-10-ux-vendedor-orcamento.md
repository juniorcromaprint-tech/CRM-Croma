# UX Vendedor — Orçamento Claro e Confiável

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transformar o módulo de orçamento de uma ferramenta técnica confusa em uma experiência guiada, clara e confiável para o vendedor — eliminando R$ 0,00 inexplicáveis, linguagem técnica e fluxos sem feedback.

**Architecture:**
- Fase 1: Bugs críticos de dados (schema mismatch + price=null + template zero)
- Fase 2: Novos componentes de UX (ResumoVendedor, Wizard 3 passos, Alertas)
- Fase 3: Admin setup wizard + linguagem comercial em toda a UI
- Fase 4: Documentação (4 manuais + 2 audits)

**Tech Stack:** React 19, TypeScript, Vite, Tailwind, shadcn/ui, TanStack Query v5, Supabase, Zod, react-router-dom

---

## DESCOBERTAS CRÍTICAS DA AUDITORIA

Antes de implementar, estes são os problemas raiz identificados:

| # | Problema | Impacto | Arquivo |
|---|---|---|---|
| C1 | `sugerirMarkup`/`validarMarkup` usa shape `{tipo,categoria,valor}` mas DB tem `{categoria,markup_minimo,markup_sugerido}` — **incompatibilidade silenciosa** | Markup mínimo nunca validado | `orcamento-pricing.service.ts` |
| C2 | `materiais.preco_medio` é NULLABLE sem DEFAULT — 467 materiais importados sem preço; NULL vira 0 silenciosamente | Preço R$ 0,00 sem explicação | `001_complete_schema.sql` |
| C3 | Template multi-item insere itens com `valor_unitario: 0` (engine não é chamada) | Itens zerados no orçamento | `OrcamentoEditorPage.tsx` |
| C4 | `AdminConfigPage.tsx` não existe — link quebrado na navegação | Tela de config inexistente | `navigation.ts` |
| C5 | `pricing-explainer.ts` gera alertas mas nenhum é exibido na UI | Alertas mortos | `pricing-explainer.ts` |
| C6 | Nenhum wizard/stepper existe no codebase | Fluxo não guiado | (novo) |
| C7 | Linguagem técnica: "Mubisys", "Pv", "Vam", "custo MP" confundem vendedor | UX ruim | múltiplos arquivos |
| C8 | Acabamentos bypassam overhead Mubisys — precificados abaixo do custo real | Margem incorreta | `orcamento-pricing.service.ts` |

---

## FASE 1 — FUNDAÇÃO: Bugs Críticos de Dados

### Task 1.1 — Fix schema mismatch: sugerirMarkup/validarMarkup

**Files:**
- Modify: `src/shared/services/orcamento-pricing.service.ts`

**Problema:** As funções `sugerirMarkup` e `validarMarkup` filtram por `r.tipo === 'markup_padrao'` e `r.tipo === 'markup_minimo'`, mas a tabela `regras_precificacao` (schema columnar após migration 007) tem colunas `markup_minimo`, `markup_sugerido` — não coluna `tipo`.

**Step 1: Localizar as funções no arquivo**

Abrir `src/shared/services/orcamento-pricing.service.ts` e encontrar `sugerirMarkup` e `validarMarkup`.

**Step 2: Substituir ambas as funções**

```typescript
// Tipo correto para regras_precificacao (schema colunar, migration 007)
export interface RegraPrecificacao {
  id?: string
  categoria: string
  markup_minimo: number
  markup_sugerido: number
  desconto_maximo?: number | null
  preco_m2_minimo?: number | null
  taxa_urgencia?: number | null
  ativo?: boolean
}

export function sugerirMarkup(
  regras: RegraPrecificacao[],
  categoria?: string
): number {
  const ativas = regras.filter(r => r.ativo !== false)
  // Procura regra específica da categoria
  const especifica = ativas.find(r => r.categoria === categoria)
  if (especifica) return especifica.markup_sugerido
  // Fallback: regra geral
  const geral = ativas.find(r => r.categoria === 'geral')
  if (geral) return geral.markup_sugerido
  // Fallback hardcoded
  return 45
}

export function validarMarkup(
  regras: RegraPrecificacao[],
  markup: number,
  categoria?: string
): { valido: boolean; minimo: number; mensagem?: string } {
  const ativas = regras.filter(r => r.ativo !== false)
  const regra = ativas.find(r => r.categoria === categoria)
    ?? ativas.find(r => r.categoria === 'geral')
  const minimo = regra?.markup_minimo ?? 30
  const valido = markup >= minimo
  return {
    valido,
    minimo,
    mensagem: valido
      ? undefined
      : `Markup ${markup}% abaixo do mínimo de ${minimo}% para "${categoria ?? 'geral'}"`,
  }
}
```

**Step 3: Atualizar o hook `useRegrasPrecificacao` em `useOrcamentos.ts`**

Verificar se o hook mapeia corretamente as colunas. Se ele faz `select('tipo, categoria, valor')`, alterar para `select('*')`.

**Step 4: Build check**

```bash
cd C:\Users\Caldera\Claude\CRM-Croma && npm run build 2>&1 | tail -20
```

**Step 5: Commit**

```bash
git add src/shared/services/orcamento-pricing.service.ts
git commit -m "fix(pricing): corrigir schema mismatch em sugerirMarkup/validarMarkup"
```

---

### Task 1.2 — Validação de material sem preço + alerta visual

**Files:**
- Modify: `src/domains/comercial/components/MaterialEditor.tsx`
- Modify: `src/domains/comercial/pages/OrcamentoEditorPage.tsx`

**Problema:** Quando `material.preco_medio` é null, vira 0 silenciosamente. O usuário não sabe que o material não tem custo cadastrado.

**Step 1: Adicionar badge de aviso em MaterialEditor**

Em `MaterialEditor.tsx`, na linha que renderiza cada material da lista, adicionar após o campo de custo:

```tsx
{(mat.custo_unitario === 0 || mat.custo_unitario === null) && (
  <div className="flex items-center gap-1 text-amber-600 text-xs mt-1">
    <AlertTriangle className="h-3 w-3" />
    <span>Material sem custo cadastrado</span>
  </div>
)}
```

Garantir que o import de `AlertTriangle` está em uso:
```tsx
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
```

**Step 2: Bloquear adição de material sem preço com erro claro**

Na função que adiciona material ao array, antes de adicionar:

```typescript
// Se preco_medio é null ou 0, exibir erro e não adicionar
if (!selectedMaterial.preco_medio || selectedMaterial.preco_medio <= 0) {
  toast.error(
    `"${selectedMaterial.nome}" não tem custo cadastrado. Acesse Admin → Estoque → Materiais para definir o preço.`,
    { duration: 6000 }
  )
  return
}
```

**Step 3: Adicionar alerta na página de orçamento quando item tem custo zero**

Em `OrcamentoEditorPage.tsx`, antes do botão "Adicionar Item", verificar:

```tsx
{pricingResult && pricingResult.custoMP === 0 && newItem.materiais.length > 0 && (
  <Alert variant="destructive" className="mb-3">
    <AlertTriangle className="h-4 w-4" />
    <AlertTitle>Materiais sem custo cadastrado</AlertTitle>
    <AlertDescription>
      Um ou mais materiais têm custo R$ 0,00. O preço calculado será incorreto.
      Verifique em Admin → Estoque → Materiais.
    </AlertDescription>
  </Alert>
)}
```

**Step 4: Build check + commit**

```bash
npm run build 2>&1 | tail -20
git add src/domains/comercial/components/MaterialEditor.tsx \
        src/domains/comercial/pages/OrcamentoEditorPage.tsx
git commit -m "fix(orcamento): bloquear material sem custo + alerta visual R$ 0,00"
```

---

### Task 1.3 — Fix template multi-item zero-price

**Files:**
- Modify: `src/domains/comercial/pages/OrcamentoEditorPage.tsx`

**Problema:** `handleTemplateSelect` itera os itens do template e chama `adicionarItem.mutateAsync({ valor_unitario: 0, valor_total: 0 })` sem invocar a pricing engine.

**Step 1: Localizar `handleTemplateSelect` no editor**

Está por volta da linha 352. A função atual para N itens:
```typescript
for (const item of template.itens) {
  await adicionarItem.mutateAsync({
    // ← valor_unitario: 0 aqui
  })
}
```

**Step 2: Para cada item do template, calcular preço antes de inserir**

```typescript
const handleTemplateSelect = async (template: TemplateOrcamento) => {
  if (!orcamento || !template.itens || template.itens.length === 0) return

  if (template.itens.length === 1) {
    // Fluxo existente: preenche o formulário para o usuário revisar
    const item = template.itens[0]
    setNewItem({
      ...DEFAULT_ITEM,
      ...item,
      markup_percentual: item.markup_percentual ?? markupSugerido,
    })
    return
  }

  // Multi-item: calcular pricing para cada item antes de inserir
  let count = 0
  for (const templateItem of template.itens) {
    try {
      const matInput: OrcamentoMaterial[] = (templateItem.materiais ?? []).map(m => ({
        descricao: m.descricao ?? '',
        quantidade: m.quantidade ?? 1,
        unidade: m.unidade ?? 'un',
        precoUnitario: m.custo_unitario ?? 0,
      }))
      const procInput = (templateItem.processos ?? []).map(p => ({
        nome: p.nome ?? '',
        tempoMinutos: p.tempo_minutos ?? 0,
        custo_por_hora: 0,
      }))

      const pricing = calcOrcamentoItem(
        {
          descricao: templateItem.descricao,
          quantidade: templateItem.quantidade ?? 1,
          largura_cm: templateItem.largura_cm ?? undefined,
          altura_cm: templateItem.altura_cm ?? undefined,
          materiais: matInput,
          acabamentos: (templateItem.acabamentos ?? []).map(a => ({
            descricao: a.descricao ?? '',
            quantidade: a.quantidade ?? 1,
            custo_unitario: a.custo_unitario ?? 0,
          })),
          processos: procInput,
          markup_percentual: templateItem.markup_percentual ?? markupSugerido,
        },
        config,
        regras
      )

      await adicionarItem.mutateAsync({
        descricao: templateItem.descricao,
        especificacao: templateItem.especificacao,
        produto_id: templateItem.produto_id ?? undefined,
        modelo_id: templateItem.modelo_id ?? undefined,
        quantidade: templateItem.quantidade ?? 1,
        largura_cm: templateItem.largura_cm ?? undefined,
        altura_cm: templateItem.altura_cm ?? undefined,
        area_m2: pricing.areaM2 ?? undefined,
        markup_percentual: templateItem.markup_percentual ?? markupSugerido,
        custo_mp: pricing.custoMP,
        custo_mo: pricing.custoMO,
        custo_fixo: pricing.custoFixo,
        valor_unitario: pricing.precoUnitario,
        valor_total: pricing.precoTotal,
        materiais: matInput,
        acabamentos: (templateItem.acabamentos ?? []),
        processos: procInput,
      })
      count++
    } catch (e) {
      console.warn('Erro ao inserir item do template:', templateItem.descricao, e)
    }
  }

  await recalcularTotais(orcamento.id)
  toast.success(`${count} iten(s) do template "${template.nome}" adicionados`)
  setActiveTab('itens')
}
```

**Step 3: Build + commit**

```bash
npm run build 2>&1 | tail -20
git add src/domains/comercial/pages/OrcamentoEditorPage.tsx
git commit -m "fix(orcamento): template multi-item agora calcula pricing antes de inserir"
```

---

## FASE 2 — UX PARA VENDEDOR

### Task 2.1 — Componente ResumoVendedor

**Files:**
- Create: `src/domains/comercial/components/ResumoVendedor.tsx`

**Descrição:** Substituir "Precificação Mubisys" por um painel focado no vendedor com linguagem comercial.

**Step 1: Criar o componente**

```tsx
// src/domains/comercial/components/ResumoVendedor.tsx
import { AlertTriangle, TrendingUp, TrendingDown, DollarSign, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import type { OrcamentoItemPricingResult } from '@/shared/services/orcamento-pricing.service'
import type { RegraPrecificacao } from '@/shared/services/orcamento-pricing.service'
import { validarMarkup } from '@/shared/services/orcamento-pricing.service'

interface ResumoVendedorProps {
  resultado: OrcamentoItemPricingResult | null
  quantidade: number
  markup: number
  categoria?: string
  regras: RegraPrecificacao[]
  onMarkupSugerido?: () => void
  markupSugerido?: number
}

function brl(v: number | null | undefined) {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function pct(v: number) {
  return `${v.toFixed(1)}%`
}

export function ResumoVendedor({
  resultado,
  quantidade,
  markup,
  categoria,
  regras,
  onMarkupSugerido,
  markupSugerido,
}: ResumoVendedorProps) {
  const [detalhesAbertos, setDetalhesAbertos] = useState(false)

  if (!resultado) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center h-32 text-sm text-muted-foreground">
          Preencha produto, medidas e materiais para ver o resumo de preços
        </CardContent>
      </Card>
    )
  }

  const validacao = validarMarkup(regras, markup, categoria)
  const margem = resultado.margemBruta ?? 0
  const custoTotal = resultado.custoTotal ?? 0
  const precoUnitario = resultado.precoUnitario ?? 0
  const precoTotal = precoUnitario * quantidade

  // Calcular preço mínimo (com markup mínimo da categoria)
  const markupMinimo = validacao.minimo
  // precoUnitario = valorAntesMarkup * (1 + markup/100)
  // valorAntesMarkup = precoUnitario / (1 + markup/100) — aproximação suficiente
  const valorAntesMarkup = markup > 0 ? precoUnitario / (1 + markup / 100) : custoTotal
  const precoMinimo = valorAntesMarkup * (1 + markupMinimo / 100)
  const precoSugerido = markupSugerido != null
    ? valorAntesMarkup * (1 + markupSugerido / 100)
    : null

  const margemCorBg = margem >= 30
    ? 'bg-emerald-50 border-emerald-200'
    : margem >= 20
    ? 'bg-amber-50 border-amber-200'
    : 'bg-red-50 border-red-200'

  const margemCorText = margem >= 30
    ? 'text-emerald-700'
    : margem >= 20
    ? 'text-amber-700'
    : 'text-red-700'

  return (
    <div className="space-y-3">
      {/* Alertas de risco ACIMA de tudo */}
      {!validacao.valido && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">Markup abaixo do mínimo</p>
            <p className="text-xs text-red-700 mt-0.5">
              {validacao.mensagem}
              {onMarkupSugerido && (
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs text-red-700 underline h-auto p-0 ml-1"
                  onClick={onMarkupSugerido}
                >
                  Aplicar sugerido ({markupSugerido}%)
                </Button>
              )}
            </p>
          </div>
        </div>
      )}

      {resultado.custoMP === 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Sem custo de materiais</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Nenhum material com custo cadastrado. O preço calculado pode estar incorreto.
            </p>
          </div>
        </div>
      )}

      {/* Painel principal — visível para o vendedor */}
      <Card className={`border ${margemCorBg}`}>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-700">
              Resumo de Preços
            </CardTitle>
            <Badge variant="outline" className={`text-xs ${margemCorText}`}>
              {margem >= 30
                ? '✓ Margem saudável'
                : margem >= 20
                ? '⚠ Margem razoável'
                : '✗ Margem baixa'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {/* Grade principal: 4 métricas */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg bg-white border border-slate-100 p-3">
              <p className="text-xs text-muted-foreground mb-1">Custo de Produção</p>
              <p className="text-base font-semibold text-slate-800">{brl(custoTotal)}</p>
              <p className="text-xs text-muted-foreground">por unidade</p>
            </div>
            <div className="rounded-lg bg-white border border-slate-100 p-3">
              <p className="text-xs text-muted-foreground mb-1">Preço Mínimo</p>
              <p className="text-base font-semibold text-orange-700">{brl(precoMinimo)}</p>
              <p className="text-xs text-muted-foreground">markup {markupMinimo}%</p>
            </div>
            {precoSugerido != null && (
              <div className="rounded-lg bg-white border border-slate-100 p-3">
                <p className="text-xs text-muted-foreground mb-1">Preço Sugerido</p>
                <p className="text-base font-semibold text-blue-700">{brl(precoSugerido)}</p>
                <p className="text-xs text-muted-foreground">markup {markupSugerido}%</p>
              </div>
            )}
            <div className={`rounded-lg bg-white border border-slate-100 p-3`}>
              <p className="text-xs text-muted-foreground mb-1">Margem Atual</p>
              <p className={`text-base font-semibold ${margemCorText}`}>{pct(margem)}</p>
              <p className="text-xs text-muted-foreground">markup {pct(markup)}</p>
            </div>
          </div>

          {/* Preço total em destaque */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 mb-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-muted-foreground">Preço por Unidade</p>
                <p className="text-lg font-bold text-slate-900">{brl(precoUnitario)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total ({quantidade}x)</p>
                <p className="text-xl font-bold text-blue-700">{brl(precoTotal)}</p>
              </div>
            </div>
          </div>

          {/* Detalhamento técnico — recolhido por padrão */}
          <Collapsible open={detalhesAbertos} onOpenChange={setDetalhesAbertos}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground h-7 gap-1">
                {detalhesAbertos ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {detalhesAbertos ? 'Ocultar detalhes técnicos' : 'Ver detalhes de custo'}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-1.5 text-xs border-t border-slate-100 pt-3">
                <div className="flex justify-between text-muted-foreground">
                  <span>Custo de Material (MP)</span>
                  <span className="font-medium text-slate-700">{brl(resultado.custoMP)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Custo de Produção (MO)</span>
                  <span className="font-medium text-slate-700">{brl(resultado.custoMO)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Acabamentos</span>
                  <span className="font-medium text-slate-700">{brl(resultado.custoAcabamentos)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Custo Fixo Rateado</span>
                  <span className="font-medium text-slate-700">{brl(resultado.custoFixo)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-1.5 font-medium text-slate-800">
                  <span>Custo Total</span>
                  <span>{brl(custoTotal)}</span>
                </div>
                {resultado.precoM2 != null && (
                  <div className="flex justify-between text-muted-foreground pt-1">
                    <span>Preço por m²</span>
                    <span className="font-medium text-slate-700">{brl(resultado.precoM2)}/m²</span>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 2: Exportar do índice de componentes (se existir)**

Verificar se existe `src/domains/comercial/components/index.ts` — se sim, adicionar:
```typescript
export { ResumoVendedor } from './ResumoVendedor'
```

**Step 3: Integrar em OrcamentoEditorPage**

Substituir o uso do `PricingCalculator` no editor pelo `ResumoVendedor`:
```tsx
// Em vez de:
<PricingCalculator resultado={pricingResult} quantidade={newItem.quantidade} />

// Usar:
<ResumoVendedor
  resultado={pricingResult}
  quantidade={newItem.quantidade}
  markup={newItem.markup_percentual}
  categoria={newItem.categoria}
  regras={regras}
  markupSugerido={markupSugerido}
  onMarkupSugerido={() => setNewItem(p => ({ ...p, markup_percentual: markupSugerido }))}
/>
```

Manter o `PricingCalculator` como fallback técnico (visível sob accordion "Detalhes de Engenharia") — não excluir.

**Step 4: Build + commit**

```bash
npm run build 2>&1 | tail -20
git add src/domains/comercial/components/ResumoVendedor.tsx \
        src/domains/comercial/pages/OrcamentoEditorPage.tsx
git commit -m "feat(ux): componente ResumoVendedor com linguagem comercial"
```

---

### Task 2.2 — Wizard de 3 passos para Novo Item

**Files:**
- Create: `src/domains/comercial/components/ItemWizard.tsx`
- Modify: `src/domains/comercial/pages/OrcamentoEditorPage.tsx`

**Descrição:** O "Novo Item" passa a ser um wizard de 3 passos claros com progresso visual.

**Step 1: Criar o componente ItemWizard.tsx**

```tsx
// src/domains/comercial/components/ItemWizard.tsx
import { useState } from 'react'
import { Check, ChevronRight, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface WizardStep {
  id: number
  titulo: string
  descricao: string
  icone: React.ReactNode
}

interface ItemWizardProps {
  steps: WizardStep[]
  currentStep: number
  onNext: () => void
  onBack: () => void
  canProceed: boolean
  children: React.ReactNode
  isLastStep: boolean
  onSubmit: () => void
  isSubmitting?: boolean
}

export function ItemWizard({
  steps,
  currentStep,
  onNext,
  onBack,
  canProceed,
  children,
  isLastStep,
  onSubmit,
  isSubmitting,
}: ItemWizardProps) {
  return (
    <div className="space-y-4">
      {/* Indicador de passos */}
      <div className="flex items-center gap-2">
        {steps.map((step, i) => {
          const done = i < currentStep
          const active = i === currentStep
          return (
            <div key={step.id} className="flex items-center gap-2 flex-1 last:flex-none">
              <div className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                done && 'text-emerald-700 bg-emerald-50',
                active && 'text-blue-700 bg-blue-50 ring-1 ring-blue-200',
                !done && !active && 'text-slate-400 bg-slate-50',
              )}>
                <span className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold',
                  done && 'bg-emerald-600 text-white',
                  active && 'bg-blue-600 text-white',
                  !done && !active && 'bg-slate-200 text-slate-500',
                )}>
                  {done ? <Check className="h-3 w-3" /> : step.id + 1}
                </span>
                <span className="hidden sm:inline">{step.titulo}</span>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />
              )}
            </div>
          )
        })}
      </div>

      {/* Descrição do passo atual */}
      <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
        <p className="text-xs font-semibold text-blue-700">
          Passo {currentStep + 1}: {steps[currentStep].titulo}
        </p>
        <p className="text-xs text-blue-600 mt-0.5">{steps[currentStep].descricao}</p>
      </div>

      {/* Conteúdo do passo */}
      <div className="space-y-3">{children}</div>

      {/* Navegação */}
      <div className="flex justify-between pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          disabled={currentStep === 0}
          className="gap-1"
        >
          <ChevronLeft className="h-3 w-3" />
          Voltar
        </Button>

        {isLastStep ? (
          <Button
            size="sm"
            onClick={onSubmit}
            disabled={!canProceed || isSubmitting}
            className="gap-1 bg-emerald-600 hover:bg-emerald-700"
          >
            {isSubmitting ? 'Adicionando...' : 'Adicionar ao Orçamento'}
            <Check className="h-3 w-3" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onNext}
            disabled={!canProceed}
            className="gap-1"
          >
            Próximo
            <ChevronRight className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Integrar o wizard em OrcamentoEditorPage**

No editor, envolver o formulário de novo item com o `ItemWizard`:

```tsx
// Definir os 3 passos
const WIZARD_STEPS: WizardStep[] = [
  {
    id: 0,
    titulo: 'Produto',
    descricao: 'Selecione o produto e modelo — os materiais serão preenchidos automaticamente',
    icone: <Package className="h-4 w-4" />,
  },
  {
    id: 1,
    titulo: 'Composição',
    descricao: 'Informe as medidas, ajuste materiais, acabamentos e serviços',
    icone: <Ruler className="h-4 w-4" />,
  },
  {
    id: 2,
    titulo: 'Resumo',
    descricao: 'Revise o preço, margem e confirme o item',
    icone: <DollarSign className="h-4 w-4" />,
  },
]

const [wizardStep, setWizardStep] = useState(0)

// canProceed por passo
const canProceedStep = [
  !!newItem.descricao,                    // Passo 0: só precisa de descrição
  newItem.materiais.length > 0,           // Passo 1: pelo menos 1 material
  !!pricingResult && pricingResult.precoUnitario > 0,  // Passo 2: preço calculado
][wizardStep] ?? false
```

No JSX, substituir o formulário linear pelo wizard com conteúdo condicional por passo:

```tsx
<ItemWizard
  steps={WIZARD_STEPS}
  currentStep={wizardStep}
  onNext={() => setWizardStep(s => s + 1)}
  onBack={() => setWizardStep(s => s - 1)}
  canProceed={canProceedStep}
  isLastStep={wizardStep === 2}
  onSubmit={handleAddItem}
  isSubmitting={adicionarItem.isPending}
>
  {wizardStep === 0 && (
    /* Passo 1: ProdutoSelector + Descrição + Especificação */
    <div className="space-y-3">
      <ProdutoSelector ... />
      <div>
        <Label>Nome do item *</Label>
        <Input
          placeholder="Ex: Banner lona 440g com ilhós a cada 50cm"
          value={newItem.descricao}
          onChange={e => setNewItem(p => ({ ...p, descricao: e.target.value }))}
        />
      </div>
    </div>
  )}
  {wizardStep === 1 && (
    /* Passo 2: Medidas + Materiais + Acabamentos + Processos */
    <div className="space-y-4">
      {/* Dimensões */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Largura (cm)</Label>
          <Input type="number" value={newItem.largura_cm ?? ''} ... />
        </div>
        <div>
          <Label>Altura (cm)</Label>
          <Input type="number" value={newItem.altura_cm ?? ''} ... />
        </div>
        <div>
          <Label>Quantidade</Label>
          <Input type="number" min={1} value={newItem.quantidade} ... />
        </div>
      </div>
      <MaterialEditor materiais={newItem.materiais} ... />
      <AcabamentoSelector acabamentos={newItem.acabamentos} ... />
    </div>
  )}
  {wizardStep === 2 && (
    /* Passo 3: Resumo + Markup + Preço final */
    <div className="space-y-4">
      <div>
        <Label>Markup de venda (%)</Label>
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            min={0}
            value={newItem.markup_percentual}
            onChange={e => setNewItem(p => ({ ...p, markup_percentual: +e.target.value }))}
            className="w-24"
          />
          {markupSugerido !== newItem.markup_percentual && (
            <Button variant="outline" size="sm"
              onClick={() => setNewItem(p => ({ ...p, markup_percentual: markupSugerido }))}>
              Sugerido: {markupSugerido}%
            </Button>
          )}
        </div>
      </div>
      <ResumoVendedor
        resultado={pricingResult}
        quantidade={newItem.quantidade}
        markup={newItem.markup_percentual}
        categoria={newItem.categoria}
        regras={regras}
        markupSugerido={markupSugerido}
        onMarkupSugerido={() => setNewItem(p => ({ ...p, markup_percentual: markupSugerido }))}
      />
    </div>
  )}
</ItemWizard>
```

**Step 3: Reset o wizard step ao cancelar/adicionar**

```typescript
const handleAddItem = async () => {
  // ... lógica existente ...
  setWizardStep(0)  // reset para próximo item
}

const handleCancelItem = () => {
  setWizardStep(0)
  setNewItem(DEFAULT_ITEM)
}
```

**Step 4: Build + commit**

```bash
npm run build 2>&1 | tail -20
git add src/domains/comercial/components/ItemWizard.tsx \
        src/domains/comercial/pages/OrcamentoEditorPage.tsx
git commit -m "feat(ux): wizard 3 passos para adição de item no orçamento"
```

---

### Task 2.3 — Alertas globais de orçamento

**Files:**
- Create: `src/domains/comercial/hooks/useOrcamentoAlerts.ts`
- Modify: `src/domains/comercial/pages/OrcamentoEditorPage.tsx`
- Modify: `src/domains/comercial/pages/OrcamentoViewPage.tsx`

**Step 1: Criar o hook de alertas**

```typescript
// src/domains/comercial/hooks/useOrcamentoAlerts.ts
import { useMemo } from 'react'
import { useConfigPrecificacao } from './useOrcamentos'
import { useRegrasPrecificacao } from './useOrcamentos'

export interface OrcamentoAlert {
  tipo: 'erro' | 'aviso' | 'info'
  titulo: string
  descricao: string
  acao?: { label: string; href: string }
}

interface UseOrcamentoAlertsParams {
  itens?: Array<{
    valor_unitario?: number
    custo_mp?: number
    descricao?: string
  }>
  total?: number
}

export function useOrcamentoAlerts({ itens = [], total }: UseOrcamentoAlertsParams) {
  const { data: config } = useConfigPrecificacao()
  const { data: regras } = useRegrasPrecificacao()

  return useMemo<OrcamentoAlert[]>(() => {
    const alerts: OrcamentoAlert[] = []

    // 1. Config de pricing não configurada
    if (!config) {
      alerts.push({
        tipo: 'aviso',
        titulo: 'Configuração de precificação incompleta',
        descricao: 'Os parâmetros de custo (comissão, impostos, custo operacional) não estão configurados. Os preços usam valores padrão.',
        acao: { label: 'Configurar agora', href: '/admin/precificacao' },
      })
    }

    // 2. Regras de markup ausentes
    if (!regras || regras.length === 0) {
      alerts.push({
        tipo: 'aviso',
        titulo: 'Regras de markup não definidas',
        descricao: 'Sem regras de markup por categoria, o sistema usa 45% padrão para tudo.',
        acao: { label: 'Definir markups', href: '/admin/precificacao' },
      })
    }

    // 3. Itens com valor zero
    const itensZerados = itens.filter(i => !i.valor_unitario || i.valor_unitario <= 0)
    if (itensZerados.length > 0) {
      alerts.push({
        tipo: 'erro',
        titulo: `${itensZerados.length} item(s) com preço R$ 0,00`,
        descricao: `"${itensZerados.map(i => i.descricao ?? 'Item').slice(0, 2).join('", "')}" precisam ser recalculados.`,
      })
    }

    // 4. Itens sem custo de material
    const itensSemCusto = itens.filter(i => i.custo_mp === 0 && i.valor_unitario && i.valor_unitario > 0)
    if (itensSemCusto.length > 0) {
      alerts.push({
        tipo: 'aviso',
        titulo: 'Itens sem custo de material',
        descricao: `${itensSemCusto.length} item(s) com preço definido mas sem custo de material. Verifique os materiais cadastrados.`,
        acao: { label: 'Ver materiais', href: '/estoque' },
      })
    }

    return alerts
  }, [config, regras, itens, total])
}
```

**Step 2: Criar componente de exibição de alertas**

```tsx
// src/domains/comercial/components/AlertasOrcamento.tsx
import { AlertTriangle, AlertCircle, Info, ExternalLink } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import type { OrcamentoAlert } from '../hooks/useOrcamentoAlerts'

interface AlertasOrcamentoProps {
  alertas: OrcamentoAlert[]
}

export function AlertasOrcamento({ alertas }: AlertasOrcamentoProps) {
  if (alertas.length === 0) return null

  return (
    <div className="space-y-2">
      {alertas.map((alerta, i) => (
        <Alert
          key={i}
          variant={alerta.tipo === 'erro' ? 'destructive' : 'default'}
          className={
            alerta.tipo === 'aviso'
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : alerta.tipo === 'info'
              ? 'border-blue-200 bg-blue-50 text-blue-800'
              : undefined
          }
        >
          {alerta.tipo === 'erro' && <AlertCircle className="h-4 w-4" />}
          {alerta.tipo === 'aviso' && <AlertTriangle className="h-4 w-4" />}
          {alerta.tipo === 'info' && <Info className="h-4 w-4" />}
          <AlertTitle className="text-sm">{alerta.titulo}</AlertTitle>
          <AlertDescription className="text-xs flex items-center gap-2 flex-wrap">
            {alerta.descricao}
            {alerta.acao && (
              <Link to={alerta.acao.href}>
                <Button variant="link" size="sm" className="h-auto p-0 text-xs gap-1">
                  {alerta.acao.label}
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            )}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  )
}
```

**Step 3: Integrar alertas nas páginas**

Em `OrcamentoEditorPage.tsx`, adicionar após o header da página:
```tsx
const alertas = useOrcamentoAlerts({
  itens: orcamento?.itens,
  total: orcamento?.total,
})

// ... no JSX, antes do formulário:
<AlertasOrcamento alertas={alertas} />
```

Em `OrcamentoViewPage.tsx`, adicionar antes da tabela de itens:
```tsx
const alertas = useOrcamentoAlerts({ itens: orcamento?.itens })
<AlertasOrcamento alertas={alertas} />
```

**Step 4: Build + commit**

```bash
npm run build 2>&1 | tail -20
git add src/domains/comercial/hooks/useOrcamentoAlerts.ts \
        src/domains/comercial/components/AlertasOrcamento.tsx \
        src/domains/comercial/pages/OrcamentoEditorPage.tsx \
        src/domains/comercial/pages/OrcamentoViewPage.tsx
git commit -m "feat(ux): alertas visuais de orçamento (preço zero, config ausente, margem baixa)"
```

---

### Task 2.4 — Linguagem comercial em toda a UI do orçamento

**Files:**
- Modify: `src/domains/comercial/pages/OrcamentosPage.tsx`
- Modify: `src/domains/comercial/pages/OrcamentoEditorPage.tsx`
- Modify: `src/domains/comercial/pages/OrcamentoViewPage.tsx`
- Modify: `src/domains/comercial/components/PricingCalculator.tsx`

**Step 1: Substituições de texto no OrcamentosPage**

| De | Para |
|---|---|
| "Orçamentos" (subtítulo técnico) | "Propostas para seus clientes — precificação automática Mubisys" |
| "Gerencie propostas comerciais com precificacao automatica" | "Crie, envie e acompanhe orçamentos com precificação automática" |

**Step 2: Substituições no OrcamentoEditorPage**

| De | Para |
|---|---|
| "Precificação Mubisys" | "Resumo de Preços" |
| "Markup (%)" | "Markup de Venda (%)" |
| "Matéria Prima (MP)" | "Custo de Material" |
| "Mão de Obra (MO)" | "Custo de Produção" |
| "Custo Fixo" | "Custo Operacional" |
| "Margem Bruta" | "Margem" |
| "Preencha os dados do item para ver o cálculo de preço" | "Preencha o produto, medidas e materiais para ver o preço sugerido" |
| Label "Markup abaixo do mínimo ({min}%)" | "⚠️ Este preço está abaixo do mínimo rentável. Consulte seu gestor." |
| "Especificação" (campo técnico) | "Detalhes adicionais para produção" |
| Toast "Informe a descrição do item" | "Dê um nome ao item (ex: Banner lona 440g 1×2m)" |

**Step 3: Substituições no PricingCalculator**

| De | Para |
|---|---|
| "Precificação Mubisys" | hidden (já substituído pelo ResumoVendedor) |
| Porcentagem de margem com threshold 25% | usar threshold da regra da categoria (via props) |

**Step 4: Substituições no OrcamentoViewPage**

| De | Para |
|---|---|
| "Validade: {n} dias" | "Válido até {dataExpiracao}" (calculado) |
| "PROPOSTA COMERCIAL" | manter |
| Expanded cost line "MP: {brl}" | "Material: {brl}" |
| Expanded cost line "MO: {brl}" | "Produção: {brl}" |
| "Markup: {pct}%" | "Margem: {pct}%" (mais intuitivo para cliente) |

**Step 5: Calcular data de expiração no ViewPage**

```typescript
// Em OrcamentoViewPage
const dataExpiracao = useMemo(() => {
  if (!orc?.created_at || !orc?.validade_dias) return null
  const criado = new Date(orc.created_at)
  criado.setDate(criado.getDate() + orc.validade_dias)
  return criado
}, [orc?.created_at, orc?.validade_dias])

// No JSX:
<span>
  {dataExpiracao
    ? `Válido até ${dataExpiracao.toLocaleDateString('pt-BR')}`
    : `${orc.validade_dias} dias`}
</span>
```

**Step 6: Build + commit**

```bash
npm run build 2>&1 | tail -20
git add src/domains/comercial/pages/OrcamentosPage.tsx \
        src/domains/comercial/pages/OrcamentoEditorPage.tsx \
        src/domains/comercial/pages/OrcamentoViewPage.tsx \
        src/domains/comercial/components/PricingCalculator.tsx
git commit -m "feat(ux): linguagem comercial em toda a UI de orçamento"
```

---

## FASE 3 — ADMIN SETUP WIZARD

### Task 3.1 — Criar AdminConfigPage.tsx (Setup Wizard de Implantação)

**Files:**
- Create: `src/domains/admin/pages/AdminConfigPage.tsx`
- Modify: `src/App.tsx` (garantir rota)

**Problema:** `/admin/config` existe na navegação mas o arquivo não existe.

**Step 1: Criar a página de configuração com wizard de 4 passos**

O wizard deve guiar o administrador antes do primeiro uso. Passos:
1. **Produção** — funcionários, horas, custo operacional
2. **Vendas** — comissão, impostos, juros
3. **Markups** — regras por categoria (usa dados da `regras_precificacao`)
4. **Materiais** — validação: mostra materiais com preco_medio = null/0

```tsx
// src/domains/admin/pages/AdminConfigPage.tsx
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, AlertCircle, Settings, ChevronRight, ChevronLeft, Package, DollarSign, Percent, Wrench } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

// Re-usa os hooks existentes de AdminPrecificacaoPage
import { useConfigPrecificacao, useAtualizarConfigPrecificacao } from '../hooks/useAdminPrecificacao'
import { useRegrasPrecificacao } from '@/domains/comercial/hooks/useOrcamentos'

const SETUP_STEPS = [
  { id: 0, titulo: 'Produção', descricao: 'Custos operacionais e capacidade produtiva', icone: Wrench },
  { id: 1, titulo: 'Vendas', descricao: 'Comissões, impostos e encargos de venda', icone: Percent },
  { id: 2, titulo: 'Markups', descricao: 'Margens por categoria de produto', icone: DollarSign },
  { id: 3, titulo: 'Materiais', descricao: 'Verificar preços dos materiais cadastrados', icone: Package },
]

export default function AdminConfigPage() {
  const [step, setStep] = useState(0)
  const { data: config, isLoading } = useConfigPrecificacao()
  const { data: regras } = useRegrasPrecificacao()
  const atualizar = useAtualizarConfigPrecificacao()

  // Buscar materiais sem preço
  const [materiaisSemPreco, setMateriaisSemPreco] = useState<Array<{id: string, nome: string, categoria: string | null}>>([])
  const [verificando, setVerificando] = useState(false)

  const verificarMateriais = async () => {
    setVerificando(true)
    const { data } = await supabase
      .from('materiais')
      .select('id, nome, categoria')
      .or('preco_medio.is.null,preco_medio.eq.0')
      .eq('ativo', true)
      .limit(50)
    setMateriaisSemPreco(data ?? [])
    setVerificando(false)
  }

  // Executar verificação ao chegar no passo 3
  const handleGoToStep = (newStep: number) => {
    setStep(newStep)
    if (newStep === 3) verificarMateriais()
  }

  const isSetupCompleto = config && regras && regras.length > 0

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configuração do Sistema</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure o sistema antes de criar orçamentos para os vendedores
          </p>
        </div>
        {isSetupCompleto && (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Sistema Configurado
          </Badge>
        )}
      </div>

      {/* Progresso */}
      <div className="flex items-center gap-2">
        {SETUP_STEPS.map((s, i) => {
          const Icon = s.icone
          const done = i < step
          const active = i === step
          return (
            <button
              key={s.id}
              onClick={() => handleGoToStep(i)}
              className={[
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                done ? 'bg-emerald-50 text-emerald-700' : '',
                active ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : '',
                !done && !active ? 'bg-slate-50 text-slate-400' : '',
              ].join(' ')}
            >
              <span className={[
                'flex h-5 w-5 items-center justify-center rounded-full',
                done ? 'bg-emerald-600 text-white' : '',
                active ? 'bg-blue-600 text-white' : '',
                !done && !active ? 'bg-slate-200 text-slate-500' : '',
              ].join(' ')}>
                {done ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
              </span>
              <span className="hidden md:inline">{s.titulo}</span>
            </button>
          )
        })}
      </div>

      {/* Conteúdo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{SETUP_STEPS[step].titulo}</CardTitle>
          <CardDescription>{SETUP_STEPS[step].descricao}</CardDescription>
        </CardHeader>
        <CardContent>
          {step === 0 && <StepProducao config={config} onSave={atualizar.mutateAsync} />}
          {step === 1 && <StepVendas config={config} onSave={atualizar.mutateAsync} />}
          {step === 2 && <StepMarkups regras={regras ?? []} />}
          {step === 3 && (
            <StepMateriais
              materiais={materiaisSemPreco}
              verificando={verificando}
              onVerificar={verificarMateriais}
            />
          )}
        </CardContent>
      </Card>

      {/* Navegação */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => handleGoToStep(step - 1)} disabled={step === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
        </Button>
        {step < SETUP_STEPS.length - 1 ? (
          <Button onClick={() => handleGoToStep(step + 1)}>
            Próximo <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Link to="/admin/precificacao">
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              Ir para Precificação Avançada <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}

// Sub-componentes internos (StepProducao, StepVendas, StepMarkups, StepMateriais)
// são implementados como funções dentro do mesmo arquivo, cada um como um formulário
// simples com campos e botão "Salvar Configuração".
```

**Step 2: Garantir rota em App.tsx**

Verificar se `/admin/config` tem uma rota que aponta para `AdminConfigPage`. Se não tiver:

```tsx
// Em App.tsx, dentro das rotas admin:
const AdminConfigPage = lazy(() => import('@/domains/admin/pages/AdminConfigPage'))

// Na rota:
<Route path="/admin/config" element={
  <DemoRoute><AdminConfigPage /></DemoRoute>
} />
```

**Step 3: Build + commit**

```bash
npm run build 2>&1 | tail -20
git add src/domains/admin/pages/AdminConfigPage.tsx src/App.tsx
git commit -m "feat(admin): setup wizard de configuração do sistema (/admin/config)"
```

---

### Task 3.2 — Validador de materiais sem preço no AdminProdutosPage

**Files:**
- Modify: `src/domains/admin/pages/AdminProdutosPage.tsx`

**Step 1: Adicionar aba "Validação" na página de produtos**

Ao lado das abas existentes (Produtos, Modelos), adicionar "Materiais sem Preço":

```tsx
// Query para materiais sem preço
const { data: materiaisSemPreco } = useQuery({
  queryKey: ['materiais-sem-preco'],
  queryFn: async () => {
    const { data } = await supabase
      .from('materiais')
      .select('id, nome, categoria, unidade, preco_medio')
      .or('preco_medio.is.null,preco_medio.eq.0')
      .eq('ativo', true)
      .order('nome')
    return data ?? []
  }
})

// Na UI, badge com contagem:
<TabsTrigger value="validacao">
  Materiais sem Preço
  {materiaisSemPreco && materiaisSemPreco.length > 0 && (
    <Badge variant="destructive" className="ml-1 h-4 text-xs px-1">
      {materiaisSemPreco.length}
    </Badge>
  )}
</TabsTrigger>
```

**Step 2: Conteúdo da aba de validação**

```tsx
<TabsContent value="validacao">
  {materiaisSemPreco?.length === 0 ? (
    <div className="flex flex-col items-center py-12 text-emerald-600">
      <CheckCircle2 className="h-12 w-12 mb-3" />
      <p className="font-semibold">Todos os materiais têm custo cadastrado!</p>
    </div>
  ) : (
    <div className="space-y-2">
      <Alert variant="default" className="border-amber-200 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 text-sm">
          {materiaisSemPreco?.length} material(is) sem custo cadastrado. Esses materiais causarão
          preços R$ 0,00 nos orçamentos até que o custo seja informado.
        </AlertDescription>
      </Alert>
      <div className="rounded-lg border divide-y">
        {materiaisSemPreco?.map(mat => (
          <div key={mat.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">{mat.nome}</p>
              <p className="text-xs text-muted-foreground">{mat.categoria} · {mat.unidade}</p>
            </div>
            <Badge variant="destructive" className="text-xs">Sem preço</Badge>
          </div>
        ))}
      </div>
    </div>
  )}
</TabsContent>
```

**Step 3: Build + commit**

```bash
npm run build 2>&1 | tail -20
git add src/domains/admin/pages/AdminProdutosPage.tsx
git commit -m "feat(admin): aba 'Materiais sem Preço' com contagem e lista"
```

---

## FASE 4 — DOCUMENTAÇÃO

### Task 4.1 — MANUAL_IMPLANTACAO.md

**Files:**
- Create: `docs/MANUAL_IMPLANTACAO.md`

**Conteúdo:**

```markdown
# Manual de Implantação — Croma Print CRM

## 1. Pré-requisitos
- Node.js 20+
- Conta Supabase (projeto já configurado: djwjmfgplnqyffdcgdaw)
- Vercel (deploy automático via main branch)

## 2. Configuração Inicial Obrigatória

### 2.1 Parâmetros de Produção (Admin → Configurações)
Antes de criar o primeiro orçamento, o administrador DEVE configurar:

| Parâmetro | O que é | Exemplo |
|---|---|---|
| Faturamento médio mensal | Receita média dos últimos 6 meses | R$ 110.000 |
| Custo operacional total | Aluguel + água + luz + administrativo | R$ 36.800 |
| Custo produtivo (RH) | Folha de pagamento produção | R$ 23.744 |
| Funcionários produtivos | Quem trabalha direto na produção | 6 |
| Horas/mês por funcionário | Normalmente 176h (22 dias × 8h) | 176 |

### 2.2 Parâmetros de Venda
| Parâmetro | O que é | Exemplo |
|---|---|---|
| Comissão (%) | % pago ao vendedor | 5% |
| Impostos (%) | Simples Nacional ou Lucro Presumido | 12% |
| Juros/Inadimplência (%) | Provisão para inadimplência | 2% |

### 2.3 Regras de Markup por Categoria
(Admin → Precificação → Markups por Categoria)
Cada categoria de produto tem um markup mínimo e sugerido diferentes:
- Banners: mínimo 30%, sugerido 45%
- Fachadas: mínimo 40%, sugerido 60%
- etc.

### 2.4 Preço dos Materiais
(Admin → Produtos → Materiais sem Preço)
Verificar se há materiais sem custo cadastrado. Acesse Estoque → Materiais e preencha o campo "Preço Médio" de cada material.

## 3. Executando Migrations Supabase
...
```

**Step: Criar o arquivo e commitar**

```bash
git add docs/MANUAL_IMPLANTACAO.md
git commit -m "docs: MANUAL_IMPLANTACAO.md completo"
```

---

### Task 4.2 — MANUAL_VENDEDOR.md

**Files:**
- Create: `docs/MANUAL_VENDEDOR.md`

**Conteúdo deve cobrir:**
- Como criar um orçamento em 3 passos
- O que fazer quando aparece "Material sem custo"
- Como interpretar Preço Mínimo vs Preço Sugerido
- O que é Margem e por que importa
- Como aplicar desconto sem ir abaixo do mínimo
- Como enviar e acompanhar o orçamento
- Perguntas frequentes (o preço veio R$ 0,00, o que fazer?)

---

### Task 4.3 — MANUAL_FINANCEIRO.md

**Files:**
- Create: `docs/MANUAL_FINANCEIRO.md`

**Conteúdo deve cobrir:**
- O algoritmo Mubisys em linguagem acessível (9 passos explicados)
- Como cada parâmetro afeta o preço final
- Custo por minuto: como calcular e ajustar
- Percentual fixo: o que inclui e como reduzir
- Como interpretar o DRE
- Análise de margem por categoria
- Como saber se um produto está sendo vendido abaixo do custo

---

### Task 4.4 — MANUAL_PRODUCAO.md

**Files:**
- Create: `docs/MANUAL_PRODUCAO.md`

**Conteúdo deve cobrir:**
- Como registrar tempo de produção por processo
- Como o tempo afeta o custo (Custo por Minuto × Tempo)
- Como vincular materiais aos modelos de produto
- Atualização de preços de materiais e impacto nos orçamentos
- Gestão de estoque vs. orçamentos aprovados
- Como usar o App de Campo para registro de instalações

---

### Task 4.5 — MANUAL_PRODUCAO.md já cobre campo, criar UX_AUDIT_GERAL.md

**Files:**
- Create: `docs/UX_AUDIT_GERAL.md`

**Conteúdo:**

```markdown
# Auditoria de UX — CRM Croma Print

## Score por Módulo

| Módulo | Score UX | Score Lógica | Prioridade |
|---|---|---|---|
| Orçamento Editor | 4/10 | 6/10 | 🔴 Crítico |
| Orçamento View | 6/10 | 7/10 | 🟡 Médio |
| Admin Precificação | 7/10 | 8/10 | 🟢 Ok |
| App Campo | 7/10 | 7/10 | 🟢 Ok |
| Financeiro | 6/10 | 5/10 | 🟡 Médio |
| Vendedor (Leads/Pipeline) | 7/10 | 8/10 | 🟢 Ok |

## Problemas por Persona

### Vendedor
1. ❌ Não sabe por que o preço é R$ 0,00
2. ❌ Formulário de item é técnico, não guiado
3. ❌ "Markup", "MP", "MO" não têm significado para ele
4. ❌ Não há feedback claro de "preço abaixo do mínimo"
5. ❌ Ações invisíveis em tablets (opacity-0 hover)

### Financeiro
1. ❌ DRE é placeholder (não implementado)
2. ⚠️ Nenhuma auditoria de margem por período
3. ⚠️ Não é possível ver "todos os orçamentos com margem abaixo de X%"

### Produção
1. ❌ Tempo de processo não é editável no orçamento
2. ❌ Não há visão de "fila de produção" por material
3. ⚠️ Orçamento aprovado não gera automaticamente ordem de produção

### Campo
1. ✅ App funcionando bem
2. ❌ Offline sync não implementado
3. ❌ Checklists de conclusão não implementados

## Recomendações por Prioridade

### 🔴 Urgente (impacta toda operação)
1. [FIX] Material sem preço → mostrar erro claro, nunca R$ 0,00 sem explicação
2. [FIX] Markup mínimo não é validado (schema mismatch)
3. [NEW] Modo guiado (wizard 3 passos) para novo item

### 🟡 Importante (impacta qualidade)
4. [NEW] ResumoVendedor — substituir "Mubisys" por linguagem comercial
5. [NEW] AlertasGlobais — aviso de config incompleta
6. [FIX] Data de expiração vs. "10 dias" (mostrar data real)

### 🟢 Melhorias
7. [FIX] Ações visíveis em mobile (não depender de hover)
8. [NEW] Edição inline de itens (não só add/delete)
9. [FIX] Confirmação antes de Enviar/Aprovar/Recusar proposta
10. [NEW] Filtro por data nos orçamentos
```

---

### Task 4.6 — PRICING_AUDIT.md

**Files:**
- Create: `docs/PRICING_AUDIT.md`

**Conteúdo detalhado do algoritmo, bugs encontrados e recomendações.**

---

## ORDEM DE EXECUÇÃO (Agentes Paralelos)

### Wave 1 (parallel — independentes):
- Agent A: Tasks 1.1 + 1.2 + 1.3 (bugs críticos)
- Agent B: Tasks 4.1 + 4.2 (MANUAL_IMPLANTACAO + MANUAL_VENDEDOR)
- Agent C: Tasks 4.3 + 4.4 + 4.5 + 4.6 (demais manuais e audits)

### Wave 2 (após Wave 1 — dependem de fundação):
- Agent D: Task 2.1 (ResumoVendedor)
- Agent E: Task 2.2 (ItemWizard)
- Agent F: Task 2.3 (AlertasOrcamento hook + componente)
- Agent G: Task 3.1 (AdminConfigPage)
- Agent H: Task 3.2 (validador materiais no AdminProdutosPage)

### Wave 3 (final):
- Task 2.4 (linguagem comercial) — integra tudo, roda por último
- Build check geral + commit final

---

## VERIFICAÇÃO FINAL

Após todas as waves, executar:

```bash
cd C:\Users\Caldera\Claude\CRM-Croma
npm run build 2>&1 | tail -30
git log --oneline -10
```

Verificar no browser:
1. `/orcamentos/novo` → deve mostrar wizard 3 passos
2. Adicionar item sem materiais → deve mostrar alerta
3. `/admin/config` → deve abrir setup wizard
4. `/admin/produtos` → aba "Materiais sem Preço" com lista
5. Orçamento existente com item zerado → deve mostrar alerta vermelho
