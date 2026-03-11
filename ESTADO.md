# ESTADO DO PROJETO — CRM CROMA PRINT
> **Atualizado**: 2026-03-10 | **Cole este arquivo no início de cada nova sessão**

---

## COMO USAR ESTE ARQUIVO

No início de cada nova sessão, diga:
> "Projeto CRM Croma Print. Leia o arquivo ESTADO.md em C:\Users\Caldera\Claude\CRM-Croma\ESTADO.md e continue de onde paramos."

---

## LOCALIZAÇÃO

| Item | Valor |
|---|---|
| **Pasta do projeto** | `C:\Users\Caldera\Claude\CRM-Croma` |
| **GitHub** | `https://github.com/juniorcromaprint-tech/CRM-Croma.git` |
| **ERP online** | `https://tender-archimedes.vercel.app/` |
| **App Campo** | `https://campo-croma.vercel.app/` |
| **Supabase** | `djwjmfgplnqyffdcgdaw.supabase.co` |
| **Branch principal** | `main` |

---

## STACK

```
React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui
TanStack Query v5 + Zod + React Hook Form + Recharts
Supabase (Postgres + Auth + Storage + Edge Functions)
```

---

## O QUE JÁ ESTÁ PRONTO ✅

### Banco de dados (Supabase)
- 51+ tabelas com RLS granular
- 307 clientes importados
- 467 materiais com preço real (dados Mubisys)
- 156 produtos/modelos com markup seedado
- Motor de precificação Mubisys (9 passos) implementado
- Módulo fiscal completo (NF-e, config_fiscal)
- Auditoria automática em 16 tabelas críticas
- Numeração sequencial automática (PROP, PED, OP, INST)

### Migrations executadas no Supabase
- `001_complete_schema.sql` ✅
- `002_schema_corrections.sql` ✅
- `003_campo.sql` ✅
- `003_fiscal.sql` ✅
- `004_integracao_bridge.sql` ✅
- `005_storage_security.sql` ✅
- `006_orcamento_module.sql` ✅
- `008_update_materiais_precos.sql` ✅
- `009_update_produtos_markups.sql` ✅

### Páginas do ERP (tender-archimedes.vercel.app)
| Rota | Página | Status |
|---|---|---|
| `/` | Dashboard (4 roles) | ✅ Real |
| `/clientes` | Lista de clientes | ✅ Real |
| `/clientes/:id` | Detalhe do cliente | ✅ Real |
| `/comercial` | Funil + Pipeline | ✅ Real |
| `/orcamentos` | Lista de orçamentos | ✅ Real |
| `/orcamentos/novo` | Editor de orçamento | ⚠️ Pricing zerado |
| `/pedidos` | Lista de pedidos | ✅ Real |
| `/producao` | Fila de produção (Kanban) | ⚠️ Sem integração |
| `/estoque` | Materiais e saldos | ✅ Real |
| `/financeiro` | Contas e DRE | ✅ Real |
| `/dre` | DRE Gerencial | ✅ Real |
| `/instalacao` | Agenda de instalação | ✅ Real |
| `/admin/precificacao` | Config Mubisys | ✅ Real |

### App de Campo (campo-croma.vercel.app)
- Auth real com Supabase
- Jobs, fotos, assinatura digital, mapa
- PWA instalável no celular

---

## PROBLEMAS CRÍTICOS CONHECIDOS 🔴

### 1. Orçamento gera R$ 0,00
**Causa**: Editor de orçamento envia arrays vazios para o motor de precificação.
**Arquivo**: `src/domains/orcamentos/` (editor)
**Impacto**: Nenhum orçamento consegue calcular preço real.

### 2. `modelo_materiais` com 0 registros
**Causa**: Nenhum material foi vinculado a nenhum modelo de produto.
**Impacto**: Motor nunca recebe custo de material, só pode gerar R$ 0,00.

### 3. ERP sem autenticação
**Causa**: `DemoRoute` é pass-through, não exige login.
**Arquivo**: `src/App.tsx` — rotas usando `DemoRoute` ao invés de `ProtectedRoute`
**Impacto**: Qualquer pessoa acessa dados de 307 clientes, financeiro, etc.

### 4. Bug de multiplicação dupla no orçamento
**Causa**: `precoTotal = precoVenda * quantidade` mas `precoVenda` já inclui quantidade.
**Impacto**: Preços duplicados quando quantidade > 1.

### 5. CRUD de produtos inexistente
**Causa**: `AdminProdutosPage` é read-only — não cria, edita nem deleta produtos/modelos.
**Impacto**: Não dá para gerenciar o catálogo de produtos.

### 6. Permissões decorativas
**Causa**: Função `can()` existe mas nunca é chamada em nenhuma página.
**Impacto**: Qualquer usuário autenticado acessa qualquer módulo.

---

## PRÓXIMAS TAREFAS PENDENTES 📋

### Prioridade ALTA (bloqueiam uso real)
- [ ] **Corrigir orçamento**: Conectar editor ao `modelo_materiais` + motor Mubisys
- [ ] **Popular `modelo_materiais`**: Vincular materiais aos 156 modelos de produtos
- [ ] **Ativar autenticação**: Substituir `DemoRoute` por `ProtectedRoute` no ERP
- [ ] **CRUD de produtos**: Criar interface para adicionar/editar/deletar produtos e modelos

### Prioridade MÉDIA
- [ ] Corrigir bug multiplicação dupla no orçamento
- [ ] Implementar verificação de permissões (`can()`) nas páginas
- [ ] Integrar produção com pedidos (Kanban usa dados reais)
- [ ] DRE com categorias reais (não percentuais estimados)

### Prioridade BAIXA
- [ ] Remover 19 páginas legacy mortas
- [ ] Adicionar ErrorBoundary global
- [ ] Offline sync no App de Campo
- [ ] Checklists no App de Campo

---

## ARQUITETURA DE REFERÊNCIA RÁPIDA

```
src/domains/{dominio}/
  pages/       → React pages (rotas)
  hooks/       → useQuery / useMutation
  components/  → componentes do domínio
  services/    → lógica + Supabase calls
  schemas/     → schemas Zod
```

**Fluxo obrigatório**: Componente → Hook → Service → Supabase

**Padrões UI**:
- Cards: `rounded-2xl`
- Inputs: `rounded-xl`
- Cor primária: `bg-blue-600 hover:bg-blue-700`
- Toasts: `showSuccess()` / `showError()` de `@/utils/toast.ts`
- Formatação: `brl()`, `formatDate()` de `@/shared/utils/format.ts`

---

## INSTRUÇÕES PARA A PRÓXIMA SESSÃO

1. Cole este arquivo no início da conversa
2. Diga qual tarefa quer fazer (ex: "Quero corrigir o orçamento")
3. Envie APENAS o(s) arquivo(s) relevantes para aquela tarefa
4. Ao terminar, peça para atualizar este ESTADO.md

---

## HISTÓRICO DE SESSÕES

| Data | O que foi feito |
|---|---|
| 2026-03-10 | Auditoria completa do projeto (6 agentes paralelos) |
| 2026-03-10 | DRE Gerencial + AdminPrecificacao implementados |
| 2026-03-10 | Criado este arquivo ESTADO.md para controle de sessões |
