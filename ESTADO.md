# ESTADO DO PROJETO — CRM CROMA PRINT
> **Atualizado**: 2026-03-11 | **Cole este arquivo no início de cada nova sessão**

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
- `modelo_materiais`: 321 registros — motor de precificação recebe custos reais ✅
- `categorias_produto`: 11 categorias + 84 produtos seedados ✅
- `centros_custo` + `plano_contas`: patched + dados seedados ✅
- `checklists` + itens: 6 checklists operacionais seedados ✅
- `vw_modelos_completos`: view criada com descritivos e garantias ✅

### Migrations executadas no Supabase — TODAS ✅
- `001_complete_schema.sql` ✅
- `002_schema_corrections.sql` ✅
- `003_campo.sql` ✅
- `003_fiscal.sql` ✅
- `004_integracao_bridge.sql` ✅
- `005_storage_security.sql` ✅
- `006_orcamento_module.sql` ✅
- `008_update_materiais_precos.sql` ✅
- `009_update_produtos_markups.sql` ✅
- `010_seed_modelo_materiais.sql` ✅ **EXECUTADA 2026-03-11**
- `011_categorias_produtos_reais.sql` ✅ **EXECUTADA 2026-03-11**
- `012_centros_custo_plano_contas.sql` ✅ **EXECUTADA 2026-03-11** (requereu patch de colunas)
- `013_checklists_instalacao_producao.sql` ✅ **EXECUTADA 2026-03-11**
- `014_descritivos_tecnicos_garantias.sql` ✅ **EXECUTADA 2026-03-11** (corrigido enum linha_qualidade)

### Código frontend (TUDO IMPLEMENTADO ✅)
| Arquivo | O que foi corrigido/implementado |
|---|---|
| `src/shared/services/pricing-engine.ts` | BUG CORRIGIDO: preço unitário correto (sem qty) |
| `src/shared/services/orcamento-pricing.service.ts` | Acabamentos separados, 1x multiplicação |
| `src/domains/comercial/services/orcamento.service.ts` | CRUD completo: materiais, acabamentos, serviços, duplicar, converter pedido |
| `src/domains/comercial/hooks/useOrcamentos.ts` | Todas mutations com recalcularTotais |
| `src/domains/comercial/pages/OrcamentoEditorPage.tsx` | Wizard 3 passos, auto-popula materiais do modelo |
| `src/domains/admin/pages/AdminProdutosPage.tsx` | CRUD completo (não é mais read-only) |
| `src/domains/comercial/hooks/useProdutosModelos.ts` | CRUD + salvar materiais/processos do modelo |

### Páginas do ERP (tender-archimedes.vercel.app)
| Rota | Página | Status |
|---|---|---|
| `/` | Dashboard (4 roles) | ✅ Real |
| `/clientes` | Lista de clientes | ✅ Real |
| `/clientes/:id` | Detalhe do cliente | ✅ Real |
| `/comercial` | Funil + Pipeline | ✅ Real |
| `/orcamentos` | Lista de orçamentos | ✅ Real |
| `/orcamentos/novo` | Editor de orçamento | ✅ FUNCIONAL — migrations executadas |
| `/pedidos` | Lista de pedidos | ✅ Real |
| `/producao` | Fila de produção (Kanban) | ⚠️ Sem integração |
| `/estoque` | Materiais e saldos | ✅ Real |
| `/financeiro` | Contas e DRE | ✅ Real |
| `/dre` | DRE Gerencial | ✅ Real |
| `/instalacao` | Agenda de instalação | ✅ Real |
| `/admin/precificacao` | Config Mubisys | ✅ Real |
| `/admin/produtos` | CRUD Produtos/Modelos | ✅ FUNCIONAL — migrations executadas |

### App de Campo (campo-croma.vercel.app)
- Auth real com Supabase
- Jobs, fotos, assinatura digital, mapa
- PWA instalável no celular

---

## BLOQUEIOS RESTANTES 🔴

**Nenhum bloqueio crítico.** Banco 100% populado.

---

## TAREFAS PENDENTES 📋

### Prioridade alta
- [ ] **Testar orçamento end-to-end**: produto → modelo → materiais auto-carregam → preço calculado
- [ ] **Ativar autenticação**: Substituir `DemoRoute` por `ProtectedRoute` no ERP (`src/App.tsx`)

### Prioridade média
- [ ] Implementar verificação de permissões (`can()`) nas páginas
- [ ] Integrar produção com pedidos (Kanban usa dados reais)
- [ ] DRE com categorias reais

### Prioridade baixa
- [ ] Remover 19 páginas legacy mortas
- [ ] Adicionar ErrorBoundary global
- [ ] Offline sync no App de Campo

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
2. Diga qual tarefa quer fazer (ex: "Quero testar o orçamento")
3. Envie APENAS o(s) arquivo(s) relevantes para aquela tarefa
4. Ao terminar, peça para atualizar este ESTADO.md

---

## HISTÓRICO DE SESSÕES

| Data | O que foi feito |
|---|---|
| 2026-03-10 | Auditoria completa do projeto (6 agentes paralelos) |
| 2026-03-10 | DRE Gerencial + AdminPrecificacao implementados |
| 2026-03-10 | Criado este arquivo ESTADO.md para controle de sessões |
| 2026-03-10 | Implementado plano completo: pricing bugs corrigidos, orcamento.service, editor wizard, AdminProdutos CRUD, migrations 010-014 commitadas |
| 2026-03-11 | Executadas todas as migrations 010-014 no Supabase. Patch centros_custo/plano_contas. Fix enum linha_qualidade na 014. Banco 100% populado. |
