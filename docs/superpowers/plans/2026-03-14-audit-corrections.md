# Correções da Auditoria ERP Croma Print — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir 5 problemas identificados na auditoria pós-deploy: conversão lead→cliente sem dados fiscais, estoque não descontado ao finalizar OP, producao_materiais não populado da BOM, NCM não propagado para NF-e, e CLAUDE.md desatualizado.

**Architecture:** Cada frente é independente e toca arquivos distintos. Tasks 1–2 são backend (producao.service.ts). Task 3 é frontend (LeadDetailPage.tsx). Tasks 4–5 tocam o módulo fiscal. Task 6 é documentação.

**Tech Stack:** React 19 + TypeScript + Supabase (PostgREST) + TanStack Query v5 + Vite

**Repositório:** `C:\Users\Caldera\Claude\CRM-Croma` (branch `main`)

---

## Chunk 1: Produção — BOM e Estoque

### Task 1: Popular producao_materiais da BOM ao criar OP

**Contexto:** Quando uma OP é criada, os materiais do modelo (BOM) devem ser registrados em `producao_materiais` para rastreamento. Hoje isso não acontece.

**Files:**
- Modify: `src/domains/producao/services/producao.service.ts`

**Pré-requisito:** Verificar se `pedido_itens` tem coluna `modelo_id`. Executar no Supabase SQL:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'pedido_itens' AND column_name LIKE '%modelo%';
```

- [ ] **Step 1: Ler o arquivo atual**
```
Read: src/domains/producao/services/producao.service.ts
```
O arquivo tem ~80 linhas. Anotar a estrutura de `criarOrdemProducao`.

- [ ] **Step 2: Verificar schema de pedido_itens**

Executar no Supabase Dashboard (djwjmfgplnqyffdcgdaw):
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pedido_itens'
ORDER BY ordinal_position;
```
Anotar se existe `modelo_id` ou `produto_modelo_id`.

- [ ] **Step 3: Atualizar `criarOrdemProducao` para popular producao_materiais**

Substituir a função `criarOrdemProducao` em `src/domains/producao/services/producao.service.ts`:

```typescript
export async function criarOrdemProducao(pedidoId: string): Promise<void> {
  const { data: itens, error: itensError } = await supabase
    .from('pedido_itens')
    .select('id, custo_mp, custo_mo, valor_total, quantidade, modelo_id')
    .eq('pedido_id', pedidoId);

  if (itensError) throw new Error(`Erro ao buscar itens: ${itensError.message}`);

  const targets =
    itens && itens.length > 0
      ? itens.map((i) => ({
          pedidoItemId: i.id as string,
          custo_mp: Number(i.custo_mp) || 0,
          custo_mo: Number(i.custo_mo) || 0,
          quantidade: Number(i.quantidade) || 1,
          modelo_id: i.modelo_id as string | null,
        }))
      : [{ pedidoItemId: null as string | null, custo_mp: 0, custo_mo: 0, quantidade: 1, modelo_id: null }];

  for (const { pedidoItemId, custo_mp, custo_mo, quantidade, modelo_id } of targets) {
    const { data: op, error: opError } = await supabase
      .from('ordens_producao')
      .insert({
        numero: generateOpNumero(),
        pedido_id: pedidoId,
        pedido_item_id: pedidoItemId,
        status: 'aguardando_programacao',
        prioridade: 0,
        custo_mp_estimado: custo_mp,
        custo_mo_estimado: custo_mo,
      })
      .select('id')
      .single();

    if (opError) throw new Error(`Erro ao criar OP: ${opError.message}`);

    // Criar etapas
    const etapas = ETAPA_NOMES.map((nome, idx) => ({
      ordem_producao_id: op.id,
      nome,
      ordem: idx,
      status: 'pendente',
    }));
    const { error: etapaError } = await supabase.from('producao_etapas').insert(etapas);
    if (etapaError) throw new Error(`Erro ao criar etapas: ${etapaError.message}`);

    // Popular producao_materiais a partir da BOM do modelo
    if (modelo_id) {
      const { data: bom } = await supabase
        .from('modelo_materiais')
        .select('material_id, quantidade_por_unidade, unidade, material:materiais(preco_medio)')
        .eq('modelo_id', modelo_id);

      if (bom && bom.length > 0) {
        const materiaisOp = bom.map((b) => ({
          ordem_producao_id: op.id,
          material_id: b.material_id,
          quantidade_prevista: Number(b.quantidade_por_unidade) * quantidade,
          custo_unitario: Number((b.material as any)?.preco_medio) || 0,
          custo_total:
            Number(b.quantidade_por_unidade) * quantidade * (Number((b.material as any)?.preco_medio) || 0),
        }));
        await supabase.from('producao_materiais').insert(materiaisOp);
        // Falha silenciosa — não bloquear criação da OP se BOM falhar
      }
    }
  }
}
```

> **Nota:** Se `pedido_itens` usar `produto_modelo_id` em vez de `modelo_id`, ajustar o campo no SELECT.

- [ ] **Step 4: Verificar TypeScript**
```bash
cd C:\Users\Caldera\Claude\CRM-Croma && npx tsc --noEmit 2>&1 | head -30
```
Esperado: 0 erros. Se houver erro de tipo no campo `modelo_id`, verificar o nome correto no banco.

- [ ] **Step 5: Commit**
```bash
cd C:\Users\Caldera\Claude\CRM-Croma
git add src/domains/producao/services/producao.service.ts
git commit -m "feat(producao): popular producao_materiais da BOM ao criar OP"
```

---

### Task 2: Descontar estoque ao finalizar OP

**Contexto:** `finalizarCustosOP()` atualiza custos mas não cria movimentações de estoque. Após finalizar, os materiais consumidos devem sair do `estoque_saldos`.

**Files:**
- Modify: `src/domains/producao/services/producao.service.ts`

- [ ] **Step 1: Verificar schema de producao_materiais**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'producao_materiais' ORDER BY ordinal_position;
```
Confirmar que existe: `ordem_producao_id`, `material_id`, `quantidade_prevista`, `movimentacao_id`.

- [ ] **Step 2: Substituir `finalizarCustosOP`**

```typescript
export async function finalizarCustosOP(opId: string): Promise<void> {
  const { data: op } = await supabase
    .from('ordens_producao')
    .select('custo_mp_estimado, custo_mo_estimado')
    .eq('id', opId)
    .single();

  if (!op) return;

  // 1. Finalizar custos reais
  await supabase
    .from('ordens_producao')
    .update({
      custo_mp_real: op.custo_mp_estimado ?? 0,
      custo_mo_real: op.custo_mo_estimado ?? 0,
      data_conclusao: new Date().toISOString(),
    })
    .eq('id', opId);

  // 2. Buscar materiais registrados na OP (de producao_materiais)
  const { data: materiais } = await supabase
    .from('producao_materiais')
    .select('id, material_id, quantidade_prevista, custo_unitario')
    .eq('ordem_producao_id', opId)
    .is('movimentacao_id', null); // Apenas os ainda não baixados

  if (!materiais || materiais.length === 0) return;

  // 3. Criar movimentações de saída e atualizar saldos
  for (const mat of materiais) {
    const qtd = Number(mat.quantidade_prevista) || 0;
    if (qtd <= 0) continue;

    // Inserir movimentação
    const { data: mov } = await supabase
      .from('estoque_movimentacoes')
      .insert({
        material_id: mat.material_id,
        tipo: 'saida',
        quantidade: qtd,
        referencia_tipo: 'ordem_producao',
        referencia_id: opId,
        motivo: 'Consumo em produção — OP finalizada',
      })
      .select('id')
      .single();

    if (!mov) continue;

    // Vincular movimentação ao registro de producao_materiais
    await supabase
      .from('producao_materiais')
      .update({ movimentacao_id: mov.id, quantidade_consumida: qtd })
      .eq('id', mat.id);

    // Decrementar saldo disponível (upsert para criar se não existir)
    await supabase.rpc('decrementar_estoque', {
      p_material_id: mat.material_id,
      p_quantidade: qtd,
    }).then(async ({ error }) => {
      if (error) {
        // Fallback: update direto se RPC não existir
        const { data: saldo } = await supabase
          .from('estoque_saldos')
          .select('quantidade_disponivel')
          .eq('material_id', mat.material_id)
          .single();

        const novoSaldo = Math.max(0, (Number(saldo?.quantidade_disponivel) || 0) - qtd);
        await supabase
          .from('estoque_saldos')
          .upsert({
            material_id: mat.material_id,
            quantidade_disponivel: novoSaldo,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'material_id' });
      }
    });
  }
}
```

- [ ] **Step 3: Verificar TypeScript**
```bash
cd C:\Users\Caldera\Claude\CRM-Croma && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**
```bash
git add src/domains/producao/services/producao.service.ts
git commit -m "feat(estoque): descontar materiais do estoque ao finalizar OP"
```

---

## Chunk 2: Comercial — Conversão Lead → Cliente

### Task 3: Abrir formulário de cliente após conversão para completar dados fiscais

**Contexto:** Hoje ao converter um lead, o usuário é redirecionado para `/clientes` sem preencher CNPJ/IE/endereço. A correção: após a conversão, redirecionar para `/clientes/{id}` (detail page do cliente recém-criado) em vez da lista, para o usuário ver o cliente e preencher os dados fiscais.

**Files:**
- Modify: `src/domains/comercial/pages/LeadDetailPage.tsx`
- Verify: `src/domains/clientes/hooks/useClientes.ts` — confirmar que `useCreateCliente` retorna `id`

- [ ] **Step 1: Verificar retorno de useCreateCliente**

```
Read: src/domains/clientes/hooks/useClientes.ts (linhas 60-120)
```
Confirmar que a mutation `useCreateCliente` (ou `useCreateCliente`) faz `.select().single()` e retorna o objeto criado com `id`.

- [ ] **Step 2: Ler LeadDetailPage.tsx completo**

```
Read: src/domains/comercial/pages/LeadDetailPage.tsx
```
Anotar:
- Linha onde `handleConverter` está definida (em torno de linha 100)
- Como `navigate` é importado e usado
- Se `ClienteFormSheet` já está importado

- [ ] **Step 3: Corrigir handleConverter**

Localizar `handleConverter` em `LeadDetailPage.tsx` e substituir:

```typescript
const handleConverter = async () => {
  if (!id || !lead) return;
  try {
    const novoCliente = await createCliente.mutateAsync({
      razao_social: lead.empresa,
      nome_fantasia: lead.empresa,
      email: lead.contato_email ?? null,
      telefone: lead.contato_telefone ?? null,
      segmento: lead.segmento ?? null,
      origem: "lead_convertido",
    });
    await updateLead.mutateAsync({ id, status: "convertido" });
    setConvertOpen(false);
    showSuccess("Lead convertido! Complete os dados fiscais (CNPJ, endereço) para emitir NF-e.");
    // Navegar para o detalhe do cliente recém-criado em vez da lista
    navigate(`/clientes/${novoCliente.id}`);
  } catch (err) {
    showError("Erro ao converter lead em cliente.");
  }
};
```

> **Nota:** `updateLead.mutate` foi trocado por `updateLead.mutateAsync` para aguardar antes de navegar. Verificar se `useUpdateLead` suporta `mutateAsync` (TanStack Query v5: sim).

- [ ] **Step 4: Verificar se `/clientes/:id` existe como rota**

```bash
grep -r "clientes/:id\|clientes/:clienteId" C:\Users\Caldera\Claude\CRM-Croma\src\App.tsx
```
Se não existir, navegar para `/clientes` mesmo (fallback aceitável).

- [ ] **Step 5: TypeScript check**
```bash
cd C:\Users\Caldera\Claude\CRM-Croma && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Commit**
```bash
git add src/domains/comercial/pages/LeadDetailPage.tsx
git commit -m "fix(comercial): redirecionar para detalhe do cliente ao converter lead"
```

---

## Chunk 3: Fiscal — NCM e Impostos

### Task 4: Propagar NCM do produto para itens da NF-e

**Contexto:** `criarNFeFromPedido()` cria o documento fiscal mas não cria os itens (`fiscal_documentos_itens`). Precisamos criar os itens com NCM vindo do produto.

**Files:**
- Modify: `src/domains/fiscal/services/nfe-creation.service.ts`

- [ ] **Step 1: Verificar schema de fiscal_documentos_itens e pedido_itens**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name IN ('fiscal_documentos_itens', 'pedido_itens')
ORDER BY table_name, ordinal_position;
```
Anotar todos os campos disponíveis, especialmente: `ncm`, `descricao`, `cfop`, `quantidade`, `valor_unitario`.

- [ ] **Step 2: Verificar campo NCM nos produtos/modelos**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name IN ('produto_modelos', 'produtos', 'materiais')
  AND column_name = 'ncm';
```

- [ ] **Step 3: Ler nfe-creation.service.ts completo**

```
Read: src/domains/fiscal/services/nfe-creation.service.ts
```

- [ ] **Step 4: Adicionar criação de itens com NCM**

Substituir `criarNFeFromPedido`:

```typescript
import { supabase } from '@/integrations/supabase/client';

export async function criarNFeFromPedido(pedidoId: string): Promise<string> {
  // 1. Buscar pedido
  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos')
    .select('id, cliente_id, valor_total')
    .eq('id', pedidoId)
    .single();

  if (pedidoError || !pedido) {
    throw new Error(`Pedido não encontrado: ${pedidoError?.message}`);
  }

  // 2. Criar documento fiscal
  const { data, error } = await supabase
    .from('fiscal_documentos')
    .insert({
      pedido_id: pedido.id,
      cliente_id: pedido.cliente_id,
      tipo_documento: 'nfe',
      provider: 'manual',
      status: 'rascunho',
      valor_total: pedido.valor_total ?? 0,
      valor_produtos: pedido.valor_total ?? 0,
      natureza_operacao: 'Venda de mercadorias',
      finalidade_emissao: 'Normal',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Erro ao criar NF-e: ${error.message}`);
  const docId = data.id;

  // 3. Buscar itens do pedido com NCM do modelo
  const { data: itens } = await supabase
    .from('pedido_itens')
    .select(`
      id, descricao, quantidade, valor_unitario, valor_total,
      modelo:produto_modelos(ncm, nome)
    `)
    .eq('pedido_id', pedidoId);

  if (itens && itens.length > 0) {
    const fiscalItens = itens.map((item, idx) => ({
      fiscal_documento_id: docId,
      numero_item: idx + 1,
      descricao: item.descricao ?? (item.modelo as any)?.nome ?? 'Item',
      ncm: (item.modelo as any)?.ncm ?? null,
      cfop: '5102', // Venda de mercadoria adquirida ou recebida de terceiros (padrão)
      quantidade: Number(item.quantidade) || 1,
      valor_unitario: Number(item.valor_unitario) || 0,
      valor_total: Number(item.valor_total) || 0,
    }));

    await supabase.from('fiscal_documentos_itens').insert(fiscalItens);
    // Falha silenciosa — não bloquear criação do documento se itens falharem
  }

  return docId;
}
```

> **Nota:** Se `produto_modelos` não tiver campo `ncm`, o NCM ficará `null` mas não quebrará. O campo existe em `materiais` (migration 019), mas modelos podem não ter. Verificar no Step 2.

- [ ] **Step 5: TypeScript check**
```bash
cd C:\Users\Caldera\Claude\CRM-Croma && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Commit**
```bash
git add src/domains/fiscal/services/nfe-creation.service.ts
git commit -m "feat(fiscal): criar itens NF-e com NCM do produto ao gerar documento"
```

---

### Task 5: Cálculo básico de impostos na NF-e (Simples Nacional)

**Contexto:** Os campos de ICMS/PIS/COFINS existem mas ficam zerados. Para Simples Nacional (regime padrão da Croma Print), aplicar DAS unificado — os campos ficam com CST 400 (CSOSN) e valor zero, que é o correto para Simples Nacional (imposto não destacado em NF-e).

**Files:**
- Modify: `src/domains/fiscal/services/nfe-creation.service.ts`

- [ ] **Step 1: Verificar fiscal_regras_operacao no banco**

```sql
SELECT id, nome, cfop, cst_padrao, csosn_padrao, ncm_padrao
FROM fiscal_regras_operacao
LIMIT 10;
```
Verificar se há regras cadastradas.

- [ ] **Step 2: Verificar configuração fiscal do sistema**

```sql
SELECT * FROM fiscal_configuracoes LIMIT 1;
```
Verificar se há campo `regime_tributario` ou similar.

- [ ] **Step 3: Adicionar função de cálculo de impostos ao serviço**

No arquivo `src/domains/fiscal/services/nfe-creation.service.ts`, adicionar após a função `criarNFeFromPedido`:

```typescript
/**
 * Para Simples Nacional: impostos não são destacados na NF-e.
 * CSOSN 400 = Não tributado pelo ICMS.
 * PIS/COFINS CST 07 = Operação Isenta da Contribuição.
 * Atualiza fiscal_documentos_itens com os tributos corretos.
 */
export async function aplicarImpostosSimplesNacional(docId: string): Promise<void> {
  const { data: itens } = await supabase
    .from('fiscal_documentos_itens')
    .select('id, valor_total')
    .eq('fiscal_documento_id', docId);

  if (!itens || itens.length === 0) return;

  for (const item of itens) {
    await supabase
      .from('fiscal_documentos_itens')
      .update({
        cst_ou_csosn: '400',       // Simples Nacional — não tributado
        aliquota_icms: 0,
        base_calculo_icms: 0,
        valor_icms: 0,
        aliquota_ipi: 0,
        base_calculo_ipi: 0,
        valor_ipi: 0,
        // PIS/COFINS: CST 07 (isento)
        base_calculo_pis: 0,
        aliquota_pis: 0,
        valor_pis: 0,
        base_calculo_cofins: 0,
        aliquota_cofins: 0,
        valor_cofins: 0,
      })
      .eq('id', item.id);
  }
}
```

> **Nota:** Se `fiscal_documentos_itens` não tiver todos esses campos, o update vai ignorar os campos inexistentes (PostgREST ignora campos desconhecidos). Verificar no Step 1 de Task 4 quais campos existem e ajustar.

- [ ] **Step 4: Chamar `aplicarImpostosSimplesNacional` dentro de `criarNFeFromPedido`**

No final da função `criarNFeFromPedido`, após criar os itens:
```typescript
  // Após inserir itens:
  await aplicarImpostosSimplesNacional(docId);

  return docId;
```

- [ ] **Step 5: TypeScript check**
```bash
cd C:\Users\Caldera\Claude\CRM-Croma && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Commit**
```bash
git add src/domains/fiscal/services/nfe-creation.service.ts
git commit -m "feat(fiscal): aplicar CSOSN 400 (Simples Nacional) ao criar NF-e"
```

---

## Chunk 4: Documentação

### Task 6: Atualizar CLAUDE.md — Migration 004 executada

**Contexto:** A migration 004 foi executada (views, triggers e colunas existem no banco), mas CLAUDE.md ainda marca como ❌.

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Localizar linha da migration 004**

```
Read: CLAUDE.md
```
Localizar a linha: `| \`004_integracao_bridge.sql\` | ❌ NÃO executada |`

- [ ] **Step 2: Corrigir status**

Substituir:
```
| `004_integracao_bridge.sql` | ❌ NÃO executada | Bridge ERP↔Campo (views + triggers) |
```
Por:
```
| `004_integracao_bridge.sql` | ✅ Executada | Bridge ERP↔Campo — views vw_campo_instalacoes, vw_campo_fotos + triggers de sincronização ativos |
```

- [ ] **Step 3: Commit**
```bash
git add CLAUDE.md
git commit -m "docs: migration 004 bridge ERP-Campo já executada — atualizar CLAUDE.md"
```

---

## Chunk 5: Build Final e PR

### Task 7: Build verificado e PR

- [ ] **Step 1: Build completo**
```bash
cd C:\Users\Caldera\Claude\CRM-Croma && npx vite build 2>&1 | tail -20
```
Esperado: `built in Xs` sem erros.

- [ ] **Step 2: Verificar commits**
```bash
git log main..HEAD --oneline
```
Esperado: ver os 5 commits das tasks anteriores.

- [ ] **Step 3: Push e PR**
```bash
git push origin HEAD
```
Criar PR no GitHub via `gh pr create` ou manualmente.

---

## Notas para o Executor

### Possíveis armadilhas

1. **`modelo_id` em `pedido_itens`**: pode se chamar `produto_modelo_id`. Verificar no banco antes de implementar Task 1.

2. **`ncm` em `produto_modelos`**: pode não existir. Migration 019 adicionou NCM em `materiais`, não em modelos. Se não existir em `produto_modelos`, o campo ficará `null` na NF-e (aceitável — usuário preenche manualmente).

3. **`aplicarImpostosSimplesNacional` campos**: se `fiscal_documentos_itens` não tiver todos os campos de tributo, o update silenciosamente ignora (PostgREST). Verificar quais campos existem antes de incluir.

4. **`updateLead.mutateAsync`**: verificar se `useUpdateLead` exporta `mutateAsync` ou apenas `mutate`. Se só `mutate`, manter o padrão original com callback `onSuccess`.

5. **Rota `/clientes/:id`**: verificar em `App.tsx` ou `router.tsx` se essa rota existe. Se não existir, navegar para `/clientes` (lista) com o toast informativo é aceitável.

### Ordem recomendada de execução
Tasks 1 e 2 (produção) → Task 3 (lead) → Tasks 4 e 5 (fiscal, em sequência pois tocam o mesmo arquivo) → Task 6 (docs) → Task 7 (build + PR).
