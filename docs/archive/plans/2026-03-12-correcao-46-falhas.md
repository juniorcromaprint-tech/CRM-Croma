# Correção das 46 Falhas E2E — Plano de Implementação

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir todas as 46 falhas documentadas no relatório E2E de 2026-03-12, tornando o fluxo principal (Lead → Orçamento → Pedido → Produção → Instalação → Faturamento) funcional end-to-end.

**Architecture:** O sistema é um ERP/CRM React 19 + Supabase. Cada módulo vive em `src/domains/{modulo}/`. As correções se dividem em: (1) fixes de frontend isolados, (2) services de automação entre módulos, (3) migrations SQL, e (4) seedar dados faltantes. A maioria das falhas são desconexões entre módulos — dados não fluem automaticamente.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, Radix UI, TanStack Query v5, Zod, Supabase (Postgres + Auth + RLS), Sonner toasts.

**Worktree:** `C:\Users\Caldera\Claude\CRM-Croma\.claude\worktrees\naughty-lewin`
**Branch:** `claude/naughty-lewin`
**Produção:** `crm-croma.vercel.app`
**Supabase:** `djwjmfgplnqyffdcgdaw.supabase.co`

---

## CONTEXTO PARA O DEV

### Padrões obrigatórios
- UI em **português brasileiro** — tudo que o usuário vê
- Código interno em **inglês** (variáveis, funções)
- Cards: `rounded-2xl`, inputs: `rounded-xl`, cor primária: `bg-blue-600`
- Toasts: `showSuccess()` / `showError()` de `@/utils/toast.ts`
- Formatação: `brl()`, `formatDate()` de `@/shared/utils/format.ts`
- Supabase client: `@/integrations/supabase/client.ts`
- TanStack Query v5: **sem onSuccess** em mutations — usar `onSettled` + `queryClient.invalidateQueries()`

### Estrutura de domínios
```
src/domains/{dominio}/
  pages/       — React pages (rotas)
  hooks/       — useQuery / useMutation
  components/  — componentes do domínio
  services/    — lógica de negócio + Supabase
  schemas/     — Zod
```

### Estado do banco
- `clientes`: 307+ registros
- `materiais`: 467 registros (464 com preço_medio)
- `produto_modelos`: 156 registros com markup
- `modelo_materiais`: dados seedados (migration 010)
- Migration `004_integracao_bridge.sql`: **NÃO executada** — precisa executar
- Migration `006_orcamento_module.sql`: **NÃO executada** — schema precisa correção

---

## SPRINT 1 — BLOQUEADORES (14 falhas)

> Objetivo: Tornar o fluxo básico funcional. Um vendedor deve conseguir criar lead, converter em cliente, fazer orçamento com itens, e gerar pedido.

---

### Task 1: Corrigir crash no cadastro de cliente (FALHAS #4, #5)

**Falhas:** #4 (coluna `website` inexistente), #5 (nomes de colunas errados para endereço)

**Files:**
- Modify: `src/components/ClienteFormSheet.tsx`
- Modify: `src/shared/schemas/clientes.schemas.ts`
- Verify: `src/domains/clientes/hooks/useClientes.ts`

**Contexto:** O formulário envia campos que não existem na tabela `clientes` do Supabase: `website`, `endereco_cidade`, `endereco_estado`. A tabela real usa `cidade`, `estado` e não tem coluna `website`.

**Step 1: Ler o schema atual**
```bash
# Verificar quais colunas reais a tabela clientes tem no Supabase
# Abrir: https://supabase.com/dashboard/project/djwjmfgplnqyffdcgdaw/editor
# Ou ler os types gerados:
cat src/integrations/supabase/types.ts | grep -A 50 "clientes:"
```

**Step 2: Corrigir o schema Zod em `clientes.schemas.ts`**
- Remover campo `website` se não existir na tabela
- Renomear `endereco_cidade` → `cidade`, `endereco_estado` → `estado`
- Garantir que todos os campos do schema correspondem exatamente às colunas da tabela

**Step 3: Corrigir o formulário em `ClienteFormSheet.tsx`**
- Remover campo de input `website` (ou criar migration para adicioná-lo)
- Ajustar labels e `name` dos campos de endereço para corresponder à tabela
- Verificar que o `onSubmit` envia exatamente os nomes de colunas do banco

**Step 4: Testar**
- Acessar Clientes → + Novo Cliente
- Preencher todos os campos incluindo cidade/estado
- Salvar → deve funcionar sem erro no console
- Verificar no Supabase que cidade/estado foram salvos

**Step 5: Commit**
```bash
git add src/components/ClienteFormSheet.tsx src/shared/schemas/clientes.schemas.ts
git commit -m "fix(clientes): corrigir campos do formulário para match com tabela Supabase (#4, #5)"
```

---

### Task 2: Corrigir crash do Select.Item no editor de orçamento (FALHA #13)

**Falha:** #13 — Tela branca ao adicionar item no orçamento (Radix Select.Item com value="")

**Files:**
- Modify: `src/domains/comercial/components/ProdutoSelector.tsx`
- Verify: `src/domains/comercial/hooks/useProdutosModelos.ts`
- Verify: `src/domains/comercial/pages/OrcamentoEditorPage.tsx`

**Contexto:** Radix UI `Select.Item` crasha se `value` for string vazia `""`. O dropdown de produtos/modelos renderiza itens com value vazio quando o ID é null/undefined.

**Step 1: Ler o componente ProdutoSelector.tsx**
```bash
cat src/domains/comercial/components/ProdutoSelector.tsx
```
Procurar: `<Select.Item` ou `<SelectItem` com value dinâmico.

**Step 2: Adicionar filtro de segurança**
- Antes de renderizar `Select.Item`, filtrar itens com `value` vazio ou undefined:
```tsx
// ANTES (causa crash):
{items.map(item => (
  <SelectItem value={item.id} key={item.id}>{item.nome}</SelectItem>
))}

// DEPOIS (seguro):
{items.filter(item => item.id).map(item => (
  <SelectItem value={item.id} key={item.id}>{item.nome}</SelectItem>
))}
```

**Step 3: Verificar useProdutosModelos.ts**
- Garantir que a query retorna IDs válidos
- Verificar se há modelos com `id = null` ou `id = ""`

**Step 4: Testar**
- Orçamentos → Novo Orçamento → selecionar cliente → "+ Adicionar Item"
- Deve abrir o formulário de item sem crash (sem tela branca)
- Console do browser sem erros de Radix

**Step 5: Commit**
```bash
git add src/domains/comercial/components/ProdutoSelector.tsx
git commit -m "fix(orcamento): filtrar Select.Item com value vazio para evitar crash Radix (#13)"
```

---

### Task 3: Validação — orçamento precisa de itens para avançar (FALHAS #14, #16)

**Falhas:** #14 (permite enviar orçamento vazio), #16 (pedido com 0 itens e R$0)

**Files:**
- Modify: `src/domains/comercial/hooks/useOrcamentos.ts`
- Modify: `src/domains/comercial/pages/OrcamentoEditorPage.tsx`
- Modify: `src/domains/comercial/pages/OrcamentoViewPage.tsx`

**Contexto:** O sistema permite salvar, enviar e aprovar orçamentos com 0 itens / R$ 0,00. Precisamos validar que existe pelo menos 1 item com valor > 0 antes de enviar ou aprovar.

**Step 1: Adicionar validação no hook useOrcamentos.ts**
Na função/mutation de `enviarOrcamento` e `aprovarOrcamento`:
```tsx
// Antes de executar a mutation:
if (!orcamento.itens || orcamento.itens.length === 0) {
  showError('Orçamento precisa de pelo menos 1 item para ser enviado.');
  return;
}
if (orcamento.valor_total <= 0) {
  showError('Orçamento precisa ter valor maior que R$ 0,00.');
  return;
}
```

**Step 2: Adicionar validação visual na UI**
Em `OrcamentoEditorPage.tsx`: desabilitar botão "Enviar" se não houver itens:
```tsx
<Button disabled={itens.length === 0} onClick={handleEnviar}>
  Enviar Orçamento
</Button>
```

**Step 3: Validar na conversão orçamento → pedido**
Na função que converte orçamento aprovado em pedido (dentro de `useOrcamentos.ts` ou `orcamento.service.ts`), adicionar mesma validação.

**Step 4: Testar**
- Criar orçamento sem itens → botão "Enviar" desabilitado
- Tentar enviar via manipulação → toast de erro
- Criar orçamento com item → enviar → funciona
- Aprovar → gera pedido com valor > R$0

**Step 5: Commit**
```bash
git add src/domains/comercial/hooks/useOrcamentos.ts src/domains/comercial/pages/OrcamentoEditorPage.tsx src/domains/comercial/pages/OrcamentoViewPage.tsx
git commit -m "fix(orcamento): validar itens e valor antes de enviar/aprovar (#14, #16)"
```

---

### Task 4: Criar página de detalhe do Lead (FALHA #2)

**Falha:** #2 — Lead não tem página de detalhe

**Files:**
- Create: `src/domains/comercial/pages/LeadDetailPage.tsx`
- Modify: `src/routes/comercialRoutes.tsx` (adicionar rota)
- Modify: `src/domains/comercial/pages/LeadsPage.tsx` (link para detalhe)

**Contexto:** Clicar em um lead na lista não faz nada. Precisa de uma página `/leads/:id` que mostre dados completos, histórico e ações.

**Step 1: Criar LeadDetailPage.tsx**
```tsx
// src/domains/comercial/pages/LeadDetailPage.tsx
// Página com:
// - Breadcrumbs: Dashboard > Leads > {lead.nome}
// - Card com dados do lead (nome, empresa, email, telefone, origem, status)
// - Seção de histórico de atividades (usar useAtividades hook se existir)
// - Botão "Converter em Cliente" (ver Task 5)
// - Botão "Editar" (abre modal/sheet de edição)
// - Botão "Excluir" com confirmação
```

**Step 2: Adicionar rota**
Em `comercialRoutes.tsx`:
```tsx
import LeadDetailPage from '@/domains/comercial/pages/LeadDetailPage';
// Dentro das rotas:
{ path: 'leads/:id', element: <LeadDetailPage /> }
```

**Step 3: Adicionar link na lista**
Em `LeadsPage.tsx`, tornar cada linha/card clicável:
```tsx
onClick={() => navigate(`/leads/${lead.id}`)}
// ou
<Link to={`/leads/${lead.id}`}>
```

**Step 4: Testar**
- Leads → clicar em lead → navega para `/leads/{uuid}`
- Página mostra dados do lead
- Botão Voltar funciona
- Lead inexistente → mensagem de erro amigável

**Step 5: Commit**
```bash
git add src/domains/comercial/pages/LeadDetailPage.tsx src/routes/comercialRoutes.tsx src/domains/comercial/pages/LeadsPage.tsx
git commit -m "feat(leads): criar página de detalhe do lead (#2)"
```

---

### Task 5: Implementar conversão Lead → Cliente (FALHA #3)

**Falha:** #3 — Não existe fluxo Lead → Cliente

**Files:**
- Modify: `src/domains/comercial/pages/LeadDetailPage.tsx` (botão converter)
- Create: `src/domains/comercial/services/lead-conversion.service.ts`
- Modify: `src/domains/comercial/hooks/useLeads.ts` (mutation de conversão)

**Contexto:** O vendedor precisa poder converter um lead qualificado em cliente. A conversão deve pré-preencher dados do lead no formulário de cliente.

**Step 1: Criar service de conversão**
```tsx
// src/domains/comercial/services/lead-conversion.service.ts
// Função que:
// 1. Lê dados do lead (nome, empresa, email, telefone)
// 2. Cria registro em `clientes` com dados mapeados
// 3. Atualiza lead com status "convertido" e referência ao cliente_id
// 4. Retorna o cliente criado
```

**Step 2: Adicionar mutation no hook**
Em `useLeads.ts`:
```tsx
const useConvertLeadToCliente = () => {
  return useMutation({
    mutationFn: convertLeadToCliente,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    }
  });
};
```

**Step 3: Botão na LeadDetailPage**
- Botão "Converter em Cliente" que:
  - Abre modal de confirmação mostrando dados que serão copiados
  - Ao confirmar, executa mutation
  - Sucesso: showSuccess + navega para o cliente criado
  - Erro: showError

**Step 4: Testar**
- Lead detalhe → "Converter em Cliente" → modal confirmação → confirmar
- Novo cliente criado com dados do lead
- Lead marcado como "convertido"
- Navega para página do cliente

**Step 5: Commit**
```bash
git add src/domains/comercial/services/lead-conversion.service.ts src/domains/comercial/hooks/useLeads.ts src/domains/comercial/pages/LeadDetailPage.tsx
git commit -m "feat(leads): implementar conversão lead → cliente (#3)"
```

---

### Task 6: Diálogo de confirmação ao aprovar orçamento (FALHA #15)

**Falha:** #15 — Aprovação sem confirmação

**Files:**
- Modify: `src/domains/comercial/pages/OrcamentoViewPage.tsx`

**Contexto:** Aprovar orçamento é ação irreversível que gera pedido. Precisa de diálogo "Tem certeza?".

**Step 1: Adicionar AlertDialog**
```tsx
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button className="bg-green-600 hover:bg-green-700">Aprovar Orçamento</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Aprovar orçamento?</AlertDialogTitle>
      <AlertDialogDescription>
        Esta ação vai aprovar o orçamento {orcamento.numero} no valor de {brl(orcamento.valor_total)} e gerar um pedido automaticamente. Esta ação não pode ser desfeita.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction onClick={handleAprovar} className="bg-green-600">
        Sim, Aprovar
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Step 2: Testar**
- Orçamento com status "Enviado" → botão "Aprovar" → abre modal
- Cancelar → nada muda
- Confirmar → aprova e gera pedido

**Step 3: Commit**
```bash
git add src/domains/comercial/pages/OrcamentoViewPage.tsx
git commit -m "fix(orcamento): adicionar diálogo de confirmação ao aprovar (#15)"
```

---

### Task 7: Ações de fluxo no pedido (FALHA #17)

**Falha:** #17 — Pedido sem ações de fluxo

**Files:**
- Modify: `src/domains/pedidos/pages/PedidoDetailPage.tsx`

**Contexto:** Tela de detalhe do pedido não tem botões de ação. Precisa: "Enviar para Produção", "Cancelar", baseado no status atual.

**Step 1: Ler PedidoDetailPage.tsx e entender status possíveis**

**Step 2: Adicionar toolbar de ações**
```tsx
// Lógica: mostrar ações baseado no status
{pedido.status === 'pendente' && (
  <>
    <Button onClick={handleEnviarProducao}>Enviar para Produção</Button>
    <Button variant="destructive" onClick={handleCancelar}>Cancelar Pedido</Button>
  </>
)}
{pedido.status === 'em_producao' && (
  <Button onClick={handleFinalizar}>Finalizar Pedido</Button>
)}
```

**Step 3: Implementar handlers**
- `handleEnviarProducao`: muda status do pedido + cria OP (ver Task 10)
- `handleCancelar`: diálogo de confirmação + muda status

**Step 4: Testar e commit**
```bash
git commit -m "feat(pedidos): adicionar ações de fluxo no detalhe do pedido (#17)"
```

---

### Task 8: Searchable Combobox para dropdowns de clientes (FALHAS #11, #12, #37)

**Falhas:** #11 (dropdown carrega ~200), #12 (sem busca), #37 (mesmo no financeiro)

**Files:**
- Create: `src/shared/components/ClienteCombobox.tsx`
- Modify: `src/domains/comercial/pages/OrcamentoEditorPage.tsx`
- Modify: `src/domains/financeiro/pages/FinanceiroPage.tsx`

**Contexto:** Todos os dropdowns de clientes usam `Select` simples com 307+ registros. Precisa de Combobox com busca server-side.

**Step 1: Criar ClienteCombobox reutilizável**
Usar `cmdk` (já instalado no projeto) ou `Popover + Command` do shadcn/ui:
```tsx
// src/shared/components/ClienteCombobox.tsx
// Props: value, onValueChange, placeholder
// Funcionalidades:
// - Busca por nome (filtro server-side via Supabase .ilike())
// - Debounce 300ms
// - Mostra nome + CNPJ/CPF
// - Paginação (limit 50 por busca)
```

**Step 2: Substituir nos pontos de uso**
- `OrcamentoEditorPage.tsx`: trocar `Select` de cliente por `ClienteCombobox`
- `FinanceiroPage.tsx`: trocar nos formulários de contas a receber/pagar

**Step 3: Testar**
- Digitar nome do cliente → resultados filtrados
- Selecionar → preenche corretamente
- Funciona com 307+ registros sem lag

**Step 4: Commit**
```bash
git commit -m "feat(shared): ClienteCombobox searchable para todos os dropdowns de clientes (#11, #12, #37)"
```

---

### Task 9: Corrigir bug timezone nas datas (FALHA #38)

**Falha:** #38 — Data de vencimento salva com 1 dia a menos

**Files:**
- Modify: `src/domains/financeiro/hooks/useContasReceber.ts`
- Verify: `src/shared/schemas/financeiro.schemas.ts`

**Contexto:** Ao informar vencimento 15/04, salva como 14/04. Bug de conversão UTC-3 → UTC.

**Step 1: Identificar onde a data é convertida**
Procurar `.toISOString()` ou construção de Date no hook/form de contas.

**Step 2: Corrigir usando date-fns `format`**
```tsx
import { format } from 'date-fns';
// Em vez de: date.toISOString() que converte para UTC
// Usar: format(date, 'yyyy-MM-dd') que preserva o dia local
```

**Step 3: Aplicar em todos os date pickers do módulo financeiro**
Verificar também contas a pagar.

**Step 4: Testar e commit**
```bash
git commit -m "fix(financeiro): corrigir bug timezone que alterava data de vencimento (#38)"
```

---

### Task 10: Corrigir acentuação em todo o sistema (FALHAS #21, #40, #44, #46)

**Falhas:** #21 (etapas produção), #40 ("Ja Pago"), #44 (DRE), #46 (Dashboard)

**Files:**
- SQL: UPDATE direto no Supabase para etapas de produção e status
- Modify: `src/domains/financeiro/pages/FinanceiroPage.tsx` — "Ja Pago" → "Já Pago"
- Modify: `src/domains/financeiro/pages/DrePage.tsx` — "Ultimos", "LIQUIDO", "Marco"
- Modify: Components do Dashboard que mostram "aprovacao", "concluido"

**Step 1: Fix SQL direto**
```sql
-- Etapas de produção (FALHA #21)
UPDATE etapas_producao SET nome = 'Criação' WHERE nome = 'Criacao';
UPDATE etapas_producao SET nome = 'Impressão' WHERE nome = 'Impressao';
UPDATE etapas_producao SET nome = 'Conferência' WHERE nome = 'Conferencia';
UPDATE etapas_producao SET nome = 'Expedição' WHERE nome = 'Expedicao';

-- Status com acentos (FALHA #46)
-- Verificar se status são armazenados hardcoded no banco ou no frontend
```

**Step 2: Fix frontend**
- Procurar strings sem acento e corrigir:
  - "Ja Pago" → "Já Pago"
  - "Ultimos 6 Meses" → "Últimos 6 Meses"
  - "RESULTADO LIQUIDO" → "RESULTADO LÍQUIDO"
  - Meses sem acento: usar `format(date, 'MMMM', { locale: ptBR })`

**Step 3: Testar e commit**
```bash
git commit -m "fix(i18n): corrigir acentuação em etapas de produção, financeiro e dashboard (#21, #40, #44, #46)"
```

---

## SPRINT 2 — CONEXÕES ENTRE MÓDULOS (12 falhas)

> Objetivo: Fazer dados fluírem automaticamente entre módulos. Pedido→Produção→Instalação→Fiscal→Financeiro.

---

### Task 11: Pedido aprovado → gerar OP automaticamente (FALHA #18)

**Falha:** #18 — Pedido aprovado não gera OP

**Files:**
- Create: `src/domains/producao/services/producao.service.ts`
- Modify: `src/domains/pedidos/pages/PedidoDetailPage.tsx` (ou onde o pedido é aprovado)
- Modify: `src/domains/comercial/hooks/useOrcamentos.ts` (se aprovação do orçamento gera pedido)

**Contexto:** Ao aprovar um pedido (ou enviar para produção), o sistema deve criar automaticamente uma Ordem de Produção (OP) com os itens do pedido.

**Step 1: Criar service de criação de OP**
```tsx
// src/domains/producao/services/producao.service.ts
export async function criarOrdemProducao(pedidoId: string) {
  // 1. Buscar pedido com itens
  // 2. Criar registro em ordens_producao (numero auto, status 'aguardando')
  // 3. Para cada item do pedido, criar registro em op_itens
  // 4. Criar as 5 etapas padrão (Criação, Impressão, Acabamento, Conferência, Expedição)
  // 5. Retornar OP criada
}
```

**Step 2: Integrar ao fluxo**
Quando o pedido for "enviado para produção" (Task 7), chamar `criarOrdemProducao(pedidoId)`.

**Step 3: Testar**
- Aprovar pedido → verificar em Produção que OP aparece
- OP tem os itens do pedido
- Status do pedido muda para "em_producao"

**Step 4: Commit**
```bash
git commit -m "feat(producao): gerar OP automaticamente ao enviar pedido para produção (#18)"
```

---

### Task 12: OP concluída → atualizar Kanban + status (FALHAS #22, #25, #27)

**Falhas:** #22 (status não muda), #25 (Kanban não avança), #27 (OP 100% fica em "Fila")

**Files:**
- Modify: `src/domains/producao/pages/ProducaoPage.tsx`
- Create ou Modify: hook/service que gerencia etapas de produção

**Contexto:** Ao avançar etapas de produção, o Kanban e o status geral da OP devem refletir automaticamente.

**Step 1: Criar lógica de status mapping**
```tsx
// Mapear etapa atual → status da OP
function calcularStatusOP(etapas: Etapa[]): string {
  const concluidas = etapas.filter(e => e.status === 'concluido');
  if (concluidas.length === 0) return 'aguardando';
  if (concluidas.length === etapas.length) return 'concluido';

  // Encontrar a última etapa em andamento
  const emAndamento = etapas.find(e => e.status === 'em_andamento');
  if (emAndamento) {
    const nomeMap: Record<string, string> = {
      'Criação': 'em_criacao',
      'Impressão': 'em_impressao',
      'Acabamento': 'em_acabamento',
      'Conferência': 'em_conferencia',
      'Expedição': 'em_expedicao',
    };
    return nomeMap[emAndamento.nome] || 'em_producao';
  }
  return 'em_producao';
}
```

**Step 2: Atualizar Kanban ao concluir etapa**
Após o PATCH de cada etapa, recalcular status e atualizar:
```tsx
// Após concluir etapa:
const novoStatus = calcularStatusOP(etapasAtualizadas);
await supabase.from('ordens_producao').update({
  status: novoStatus,
  status_kanban: novoStatus === 'concluido' ? 'liberado' : mapToKanban(novoStatus)
}).eq('id', opId);
```

**Step 3: Invalidar queries para refetch**
```tsx
queryClient.invalidateQueries({ queryKey: ['producao'] });
queryClient.invalidateQueries({ queryKey: ['producao', opId] });
```

**Step 4: Testar**
- Avançar etapas → Kanban move a OP
- Concluir todas → OP vai para "Liberado"
- Dashboard mostra contagem correta

**Step 5: Commit**
```bash
git commit -m "feat(producao): sincronizar status/kanban da OP com etapas (#22, #25, #27)"
```

---

### Task 13: Invalidar queries após mutations — fix UI atrasada (FALHA #20)

**Falha:** #20 — UI não atualiza após PATCH em etapa de produção

**Files:**
- Modify: Hooks de produção que fazem mutations (procurar `useMutation` relacionado a etapas)
- Verify: `src/domains/producao/pages/ProducaoPage.tsx`

**Contexto:** O PATCH funciona (204) mas a UI não re-renderiza. Falta `invalidateQueries` após a mutation.

**Step 1: Encontrar a mutation de etapas**
```bash
grep -rn "useMutation" src/domains/producao/
```

**Step 2: Adicionar invalidation**
```tsx
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: ['producao'] });
  queryClient.invalidateQueries({ queryKey: ['op-etapas', opId] });
}
```

**Step 3: Testar**
- Clicar "Iniciar" em etapa → botão muda para "Concluir" imediatamente
- Sem necessidade de fechar/reabrir modal

**Step 4: Commit**
```bash
git commit -m "fix(producao): invalidar queries após PATCH em etapas para atualizar UI (#20)"
```

---

### Task 14: Botões de status com lógica sequencial (FALHA #26)

**Falha:** #26 — Botões permitem avançar e retroceder sem lógica

**Files:**
- Modify: componente de detalhe da OP (dentro de `ProducaoPage.tsx`)

**Step 1: Definir ordem de status válida**
```tsx
const STATUS_ORDER = ['aguardando', 'em_producao', 'em_acabamento', 'em_conferencia', 'liberado'];
// Só mostrar botão para o PRÓXIMO status na sequência
```

**Step 2: Filtrar botões baseado no status atual**
Mostrar apenas o botão de avançar, nunca retroceder.

**Step 3: Testar e commit**
```bash
git commit -m "fix(producao): botões de status seguem lógica sequencial (#26)"
```

---

### Task 15: Produção concluída → gerar OS de instalação (FALHAS #28, #29)

**Falhas:** #28 (não gera automaticamente), #29 (sem botão manual)

**Files:**
- Create: `src/domains/instalacao/services/instalacao-criacao.service.ts`
- Modify: `src/domains/instalacao/pages/InstalacaoPage.tsx` (botão + Nova OS)
- Modify: service de produção (quando OP concluída)

**Step 1: Criar service de criação de OS**
```tsx
export async function criarOrdemServico(opId: string) {
  // 1. Buscar OP com pedido e cliente
  // 2. Buscar endereço do cliente
  // 3. Criar registro em ordens_servico
  // 4. Vincular OP + pedido + cliente
  // 5. Status: 'agendamento_pendente'
}
```

**Step 2: Automação ao concluir OP**
Na Task 12, ao status mudar para "concluido", chamar `criarOrdemServico(opId)`.

**Step 3: Botão manual na InstalacaoPage**
```tsx
<Button onClick={() => setShowNovaOS(true)}>+ Nova OS</Button>
// Sheet/modal com formulário:
// - Selecionar pedido (dropdown)
// - Endereço (pré-preenchido do cliente)
// - Data agendada
// - Observações
```

**Step 4: Testar e commit**
```bash
git commit -m "feat(instalacao): criar OS automaticamente ao concluir OP + botão manual (#28, #29)"
```

---

### Task 16: Executar migration 004 — Bridge ERP↔Campo (FALHA #30)

**Falha:** #30 — ERP e App de Campo desconectados

**Files:**
- Execute: `supabase/migrations/004_integracao_bridge.sql`

**Contexto:** A migration cria views e triggers para sincronizar `ordens_servico` (ERP) com `campo_jobs` (App de Campo).

**Step 1: Revisar a migration**
```bash
cat supabase/migrations/004_integracao_bridge.sql
```
Verificar se o SQL está correto e não conflita com o schema atual.

**Step 2: Executar no Supabase SQL Editor**
- Abrir: https://supabase.com/dashboard/project/djwjmfgplnqyffdcgdaw/sql
- Colar e executar a migration
- Verificar se não há erros

**Step 3: Testar**
- Criar OS no ERP → verificar que aparece no App de Campo
- Criar job no Campo → verificar sincronização

**Step 4: Documentar**
Atualizar CLAUDE.md: migration 004 status ❌ → ✅

**Step 5: Commit** (se houver mudanças no migration file)
```bash
git commit -m "chore(db): executar migration 004 bridge ERP↔Campo (#30)"
```

---

### Task 17: Gerar NF-e a partir de pedido (FALHAS #32, #33)

**Falhas:** #32 (NF-e não gerada automaticamente), #33 (sem botão manual)

**Files:**
- Modify: `src/domains/fiscal/pages/FiscalFilaPage.tsx` (botão + Nova NF-e)
- Create: `src/domains/fiscal/services/nfe-creation.service.ts`
- Modify: `src/domains/pedidos/pages/PedidoDetailPage.tsx` (ação "Gerar NF-e")

**Step 1: Criar service de criação de NF-e**
```tsx
export async function criarNFeFromPedido(pedidoId: string) {
  // 1. Buscar pedido + itens + cliente (dados fiscais)
  // 2. Criar registro em documentos_fiscais
  // 3. Adicionar na fila de emissão (status: 'pendente')
  // 4. Retornar documento criado
}
```

**Step 2: Botão na FiscalFilaPage**
```tsx
<Button onClick={() => setShowNovaNFe(true)}>+ Nova NF-e</Button>
// Modal: selecionar pedido → pré-preencher dados → criar
```

**Step 3: Ação no PedidoDetailPage**
Adicionar botão "Gerar NF-e" quando pedido está em status adequado (produção concluída).

**Step 4: Testar e commit**
```bash
git commit -m "feat(fiscal): criar NF-e a partir de pedido + botão manual na fila (#32, #33)"
```

---

### Task 18: Gerar contas a receber automaticamente (FALHA #34)

**Falha:** #34 — Pedido/produção concluída não gera conta a receber

**Files:**
- Create: `src/domains/financeiro/services/financeiro-automation.service.ts`
- Modify: Service de finalização de pedido (integrar geração de contas)

**Step 1: Criar service de geração de contas**
```tsx
export async function gerarContasReceber(pedidoId: string) {
  // 1. Buscar pedido + condições de pagamento
  // 2. Calcular parcelas e vencimentos
  // 3. Criar registros em contas_receber
  // 4. Vincular ao pedido_id
}
```

**Step 2: Integrar ao fluxo**
Quando pedido for finalizado (após produção ou emissão de NF-e), chamar `gerarContasReceber`.

**Step 3: Testar**
- Fluxo completo → Financeiro → Contas a Receber → nova conta vinculada ao pedido

**Step 4: Commit**
```bash
git commit -m "feat(financeiro): gerar contas a receber automaticamente ao finalizar pedido (#34)"
```

---

### Task 19: Vincular conta a receber ao pedido (FALHA #35)

**Falha:** #35 — Formulário de conta a receber sem vínculo com pedido

**Files:**
- Modify: `src/domains/financeiro/pages/FinanceiroPage.tsx`
- Modify: `src/domains/financeiro/hooks/useContasReceber.ts`

**Step 1: Adicionar campo "Pedido" no formulário**
Dropdown com busca de pedidos existentes (opcional — para contas manuais).

**Step 2: Mostrar pedido na listagem**
Adicionar coluna "Pedido" na tabela de contas a receber.

**Step 3: Testar e commit**
```bash
git commit -m "feat(financeiro): vincular conta a receber ao pedido (#35)"
```

---

### Task 20: Card RECEBIDO somando pagamentos parciais (FALHA #42)

**Falha:** #42 — Card RECEBIDO mostra R$ 0,00

**Files:**
- Modify: `src/domains/financeiro/hooks/useContasReceber.ts`
- Verify: `src/domains/financeiro/pages/FinanceiroPage.tsx`

**Step 1: Corrigir query do card**
A query atual provavelmente filtra por `status = 'pago'`. Precisa somar `valor_pago` de TODAS as contas (incluindo "parcial"):
```tsx
// Em vez de: WHERE status = 'pago'
// Usar: SUM(valor_pago) de todas as contas
const { data: totalRecebido } = useQuery({
  queryKey: ['total-recebido'],
  queryFn: async () => {
    const { data } = await supabase
      .from('contas_receber')
      .select('valor_pago');
    return data?.reduce((sum, c) => sum + (c.valor_pago || 0), 0) || 0;
  }
});
```

**Step 2: Testar**
- Criar conta R$ 1.500 → pagar R$ 500 (parcial)
- Card RECEBIDO mostra R$ 500,00

**Step 3: Commit**
```bash
git commit -m "fix(financeiro): card RECEBIDO soma pagamentos parciais (#42)"
```

---

### Task 21: DRE conectado às contas reais (FALHA #43)

**Falha:** #43 — DRE mostra R$ 0,00

**Files:**
- Modify: `src/domains/financeiro/pages/DrePage.tsx`

**Step 1: Corrigir fonte de dados da DRE**
A DRE deve considerar:
- Receita: `SUM(valor_pago)` de contas a receber por mês
- Despesas: `SUM(valor_pago)` de contas a pagar por mês
- Incluir pagamentos parciais (não apenas status "pago")

**Step 2: Implementar query por mês**
```tsx
// Agrupar por mês usando date_trunc ou filtro por período
const receitaMensal = contas.reduce((acc, conta) => {
  const mes = format(new Date(conta.data_pagamento || conta.data_vencimento), 'yyyy-MM');
  acc[mes] = (acc[mes] || 0) + (conta.valor_pago || 0);
  return acc;
}, {});
```

**Step 3: Testar e commit**
```bash
git commit -m "fix(financeiro): DRE refletindo dados reais de contas a receber/pagar (#43)"
```

---

## SPRINT 3 — POLISH & UX (13 falhas restantes)

> Objetivo: Detalhes de UX, formulários, e integridade de dados.

---

### Task 22: Forma de Pagamento como dropdown (FALHA #36)

**Files:** Modify: `src/domains/financeiro/pages/FinanceiroPage.tsx`

**Correção:** Trocar input de texto por Select com opções:
```tsx
const FORMAS_PAGAMENTO = ['Boleto', 'PIX', 'Transferência', 'Cartão de Crédito', 'Cartão de Débito', 'Dinheiro', 'Cheque'];
```

**Commit:**
```bash
git commit -m "fix(financeiro): forma de pagamento como dropdown padronizado (#36)"
```

---

### Task 23: Numeração automática de contas (FALHA #39)

**Files:** Modify: `src/domains/financeiro/hooks/useContasReceber.ts`

**Correção:** Gerar número sequencial ao criar conta:
```tsx
// Buscar último número e incrementar
// Formato: CR-2026-0001, CR-2026-0002...
```

**Commit:**
```bash
git commit -m "feat(financeiro): numeração automática de contas a receber (#39)"
```

---

### Task 24: Campos de data e comprovante no pagamento (FALHA #41)

**Files:** Modify: componente de modal de registro de pagamento

**Correção:**
- Adicionar campo "Data do Pagamento" (date picker, default hoje)
- Adicionar campo "Nº Comprovante / Referência"

**Commit:**
```bash
git commit -m "feat(financeiro): adicionar data e comprovante no registro de pagamento (#41)"
```

---

### Task 25: Tempo real e custos na OP (FALHAS #23, #24)

**Falhas:** #23 (custos zerados), #24 (tempo real "---")

**Files:**
- Modify: componente de detalhe da OP
- Verify: queries de `modelo_materiais`

**Correção:**
- Calcular tempo real: soma de (data_fim - data_inicio) de cada etapa concluída
- Custos: buscar materiais vinculados via `modelo_materiais` e calcular custo estimado

**Commit:**
```bash
git commit -m "feat(producao): calcular tempo real e custos da OP (#23, #24)"
```

---

### Task 26: Dashboard produção refletindo dados reais (FALHA #31)

**Files:** Modify: `src/domains/comercial/hooks/useDashboardStats.ts`

**Correção:** Ajustar query para incluir todos os status de OP:
```tsx
// Contar OPs por status_kanban (agora que Task 12 atualiza automaticamente)
const { count: naFila } = await supabase.from('ordens_producao').select('*', { count: 'exact' }).eq('status_kanban', 'fila');
const { count: liberadas } = await supabase.from('ordens_producao').select('*', { count: 'exact' }).eq('status_kanban', 'liberado');
```

**Commit:**
```bash
git commit -m "fix(dashboard): card de produção refletindo dados reais (#31)"
```

---

### Task 27: Filtro de pedidos com itens no dropdown de OP (FALHA #19)

**Files:** Modify: formulário de criação manual de OP

**Correção:** Filtrar dropdown para mostrar apenas pedidos com `itens.length > 0`:
```tsx
const { data: pedidos } = useQuery({
  queryFn: async () => {
    const { data } = await supabase.from('pedidos')
      .select('*, pedido_itens(count)')
      .gt('pedido_itens.count', 0);
    return data;
  }
});
```

**Commit:**
```bash
git commit -m "fix(producao): filtrar pedidos com itens no dropdown de criação de OP (#19)"
```

---

### Task 28: Formulário completo de produtos e modelos (FALHAS #6, #7, #8, #9, #10)

**Falhas:** #6 (sem campos essenciais), #7 (sem seletor de produto pai), #8 (auto-vincula errado), #9 (sem autocomplete), #10 (botão não funciona)

**Files:**
- Modify: `src/domains/admin/pages/AdminProdutosPage.tsx`
- Create: `src/domains/admin/components/ProdutoFormSheet.tsx`
- Create: `src/domains/admin/components/ModeloFormSheet.tsx`
- Create: `src/domains/admin/hooks/useAdminProdutos.ts`

**Contexto:** O AdminProdutosPage precisa de CRUD funcional para produtos, modelos e vínculo de materiais.

**Step 1: Corrigir formulário de modelo**
- Adicionar campo Select para produto pai (obrigatório)
- Não auto-vincular ao último produto visualizado

**Step 2: Implementar seletor de materiais**
- Dropdown com busca nos 467 materiais
- Botão "+ Adicionar" funcional (insere em `modelo_materiais`)
- Lista de materiais vinculados com opção de remover

**Step 3: Formulário de produto expandido**
- Abas: Dados Básicos | Modelos | Materiais
- Dados básicos: nome, SKU, categoria, dimensões, descrição
- Modelos: lista de modelos vinculados com link para editar

**Step 4: Testar e commit**
```bash
git commit -m "feat(admin): CRUD completo de produtos, modelos e vínculo de materiais (#6, #7, #8, #9, #10)"
```

---

## RESUMO DE FALHAS × TASKS

| Task | Sprint | Falhas Corrigidas | Prioridade |
|---|---|---|---|
| 1 | S1 | #4, #5 | P0 |
| 2 | S1 | #13 | P0 |
| 3 | S1 | #14, #16 | P0 |
| 4 | S1 | #2 | P0 |
| 5 | S1 | #3 | P1 |
| 6 | S1 | #15 | P1 |
| 7 | S1 | #17 | P1 |
| 8 | S1 | #11, #12, #37 | P1 |
| 9 | S1 | #38 | P1 |
| 10 | S1 | #21, #40, #44, #46 | P2 |
| 11 | S2 | #18 | P0 |
| 12 | S2 | #22, #25, #27 | P0 |
| 13 | S2 | #20 | P1 |
| 14 | S2 | #26 | P1 |
| 15 | S2 | #28, #29 | P0 |
| 16 | S2 | #30 | P0 |
| 17 | S2 | #32, #33 | P1 |
| 18 | S2 | #34 | P1 |
| 19 | S2 | #35 | P1 |
| 20 | S2 | #42 | P1 |
| 21 | S2 | #43 | P1 |
| 22 | S3 | #36 | P2 |
| 23 | S3 | #39 | P2 |
| 24 | S3 | #41 | P2 |
| 25 | S3 | #23, #24 | P2 |
| 26 | S3 | #31 | P2 |
| 27 | S3 | #19 | P2 |
| 28 | S3 | #6, #7, #8, #9, #10 | P3 |

**Total: 28 Tasks cobrindo todas as 46 falhas.**

---

## NOTA: FALHAS NÃO COBERTAS POR TASKS

### FALHA #1 — Sistema sem autenticação
**Status:** Já resolvido na branch `claude/naughty-lewin`. O `App.tsx` já usa `ProtectedRoute` em vez de `DemoRoute`. Verificar se está funcionando em produção.

### FALHA #45 — Geração de boleto
**Status:** Roadmap futuro. Requer integração bancária (API do banco ou serviço como Asaas/PagSeguro). Não incluído neste plano por ser escopo muito grande. Considerar na Sprint 4+.

---

## ORDEM DE EXECUÇÃO RECOMENDADA

### Fase 1 — Independentes (paralelizáveis)
Tasks que não dependem umas das outras, podem rodar em paralelo:
- **Task 1** (fix cliente form)
- **Task 2** (fix Select.Item)
- **Task 8** (ClienteCombobox)
- **Task 9** (timezone)
- **Task 10** (acentuação)

### Fase 2 — Fluxo de vendas
Sequenciais, dependem da fase 1:
- **Task 3** (validação orçamento) → **Task 6** (confirmação aprovar) → **Task 7** (ações pedido)
- **Task 4** (lead detalhe) → **Task 5** (lead → cliente)

### Fase 3 — Automações entre módulos
Sequenciais:
- **Task 11** (pedido → OP) → **Task 12** (OP → Kanban) → **Task 13** (invalidar queries) → **Task 14** (botões sequenciais)
- **Task 15** (OP → OS instalação) → **Task 16** (migration 004)
- **Task 17** (NF-e) → **Task 18** (contas a receber) → **Task 19** (vincular) → **Task 20** (card recebido) → **Task 21** (DRE)

### Fase 4 — Polish (parallelizáveis)
- Tasks 22-28 independentes entre si

---

## COMO USAR ESTE PLANO

Na nova sessão Claude:

1. Diga: `/skill executing-plans` ou peça para seguir este plano
2. Aponte para este arquivo: `docs/plans/2026-03-12-correcao-46-falhas.md`
3. Execute task por task, commitando a cada uma
4. Para tasks independentes, use `/skill dispatching-parallel-agents`
5. Ao final de cada sprint, faça `vercel deploy --prod` e teste em produção
