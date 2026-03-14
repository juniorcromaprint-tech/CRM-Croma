# CROMA PRINT — PROJECT MEMORY

> **Versão**: 1.0 | **Atualizado**: 2026-03-10 | **Mantido por**: ARCHITECT_AGENT
> **Propósito**: Registro permanente de todas as decisões arquiteturais, padrões e regras do sistema.
> Este arquivo NUNCA deve ser apagado. Apenas additive — novas decisões são adicionadas no final.

---

## DECISÃO #001 — Arquitetura de Dois Produtos

**Data**: 2026-03-09
**Agente**: CTO_AGENT + ARCHITECT_AGENT
**Status**: IMPLEMENTADA

**Decisão**: O sistema Croma Print é composto por DOIS produtos independentes que compartilham o mesmo backend Supabase:

| Produto | Nome | Público | Interface | Foco |
|---|---|---|---|---|
| A | CRM/ERP | Equipe interna (direção, comercial, financeiro, produção) | Desktop-first (React SPA) | Gestão completa |
| B | App de Campo | Técnicos e instaladores | Mobile-first (PWA) | Execução de tarefas |

**Motivo**: Os dois sistemas têm públicos completamente diferentes, cases de uso incompatíveis e requisitos de UX opostos (desktop vs mobile). Manter no mesmo app cria confusão de domínio.

**Impacto**:
- Produto A: `src/` — ERP/CRM
- Produto B: `apps/campo/` — App de Campo
- Backend compartilhado: Supabase `djwjmfgplnqyffdcgdaw.supabase.co`

---

## DECISÃO #002 — Stack Tecnológico

**Data**: 2026-03-09
**Agente**: CTO_AGENT
**Status**: IMPLEMENTADA

**Stack aprovado e imutável sem aprovação do CTO_AGENT**:

```
Frontend (ambos produtos):
  - React 19 + TypeScript
  - Vite (build tool)
  - Tailwind CSS
  - shadcn/ui (componentes)
  - TanStack Query v5 (server state)
  - React Hook Form + Zod (formulários)
  - Recharts (gráficos)
  - html2pdf.js (exportação PDF)
  - Sonner (toasts)

Backend:
  - Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions)
  - Row Level Security (RLS) em TODAS as tabelas
  - pg_trgm (busca por texto)

Roteamento:
  - react-router-dom v6
  - DemoRoute (sem auth) para desenvolvimento; será substituído por ProtectedRoute
```

**Por que Supabase**: Backend-as-a-service elimina necessidade de infraestrutura própria. Realtime nativo permite sincronização ERP ↔ Campo sem polling.

---

## DECISÃO #003 — Estrutura de Domínios no Frontend

**Data**: 2026-03-09
**Agente**: ARCHITECT_AGENT
**Status**: IMPLEMENTADA

**Estrutura obrigatória para TODOS os domínios**:

```
src/domains/{dominio}/
  pages/          — Componentes de página (lazy-loaded via React.lazy)
  components/     — Componentes específicos do domínio
  hooks/          — Custom hooks (useQuery, useMutation, estado local)
  services/       — Funções de acesso ao Supabase (queries/mutations)
  types/          — TypeScript types específicos do domínio
  schemas/        — Zod schemas de validação
```

**Regra inviolável**: Componentes React NUNCA contêm lógica de negócio ou queries Supabase diretas.
- Componentes → chamam Hooks
- Hooks → chamam Services
- Services → chamam Supabase

**Domínios implementados**:
- `comercial` — Leads, oportunidades, propostas, pipeline, metas
- `clientes` — Empresas, unidades, contatos
- `pedidos` — Pedidos, itens, status workflow
- `producao` — Ordens de produção, etapas, qualidade
- `financeiro` — Contas a receber/pagar, DRE, comissões
- `estoque` — Materiais, saldos, movimentações
- `compras` — Fornecedores, pedidos de compra
- `instalacao` — Agendamento, equipes, ordens
- `qualidade` — Ocorrências, retrabalhos
- `admin` — Usuários, permissões, auditoria

---

## DECISÃO #004 — Convenção de Nomenclatura do Banco

**Data**: 2026-03-09
**Agente**: ARCHITECT_AGENT
**Status**: IMPLEMENTADA

**100% PT-BR para toda nomenclatura do banco**:

| Elemento | Padrão | Exemplo |
|---|---|---|
| Tabelas | snake_case PT-BR, plural | `ordens_producao`, `pedido_itens` |
| Colunas | snake_case PT-BR | `data_vencimento`, `valor_total` |
| Functions | verbo_substantivo PT-BR | `fn_registrar_auditoria`, `fn_sync_job_to_ordem` |
| Triggers | trg_acao_tabela | `trg_sync_job_to_ordem` |
| Indexes | idx_tabela_coluna | `idx_pedidos_cliente_id` |
| Views | vw_descricao | `vw_campo_instalacoes` |
| Sequences | tabela_coluna_seq | `proposta_numero_seq` |

**Exceções aceitas**: `id`, `uuid`, `url`, `email`, `status`, `json`, `jsonb`, `timestamp`

**Motivo**: A equipe da Croma fala PT-BR. Misturar idiomas cria confusão ao ler logs, queries e errors.

---

## DECISÃO #005 — Soft Delete em Todas as Tabelas Transacionais

**Data**: 2026-03-09
**Agente**: ARCHITECT_AGENT
**Status**: IMPLEMENTADA

**Tabelas com soft delete** (`excluido_em` + `excluido_por`):
- `pedidos`, `pedido_itens`
- `propostas`, `proposta_itens`
- `leads`, `oportunidades`
- `ordens_producao`, `ordens_instalacao`
- `contas_receber`, `contas_pagar`
- `clientes`, `cliente_unidades`

**Tabelas SEM soft delete** (dados mestres estáveis):
- `materiais`, `fornecedores`, `produtos` — usam `ativo BOOLEAN` em vez disso
- `roles`, `permissions` — nunca são excluídos
- `registros_auditoria` — imutável por definição

**Motivo**: Dados financeiros e comerciais NUNCA podem ser apagados definitivamente por questões legais/fiscais. Soft delete preserva o histórico.

---

## DECISÃO #006 — Sistema de Auditoria Universal

**Data**: 2026-03-09
**Agente**: BACKEND_AGENT
**Status**: IMPLEMENTADA

**Trigger automático** `fn_registrar_auditoria()` aplicado em 16 tabelas críticas:
- `clientes`, `pedidos`, `propostas`, `oportunidades`
- `ordens_producao`, `ordens_instalacao`
- `contas_receber`, `contas_pagar`, `comissoes`
- `estoque_movimentacoes`, `pedidos_compra`
- `ocorrencias`, `profiles`, `regras_precificacao`
- `config_precificacao`, `config_fiscal`

**Registro gravado em**: `registros_auditoria` (renomeado de `audit_logs`)

**Campos auditados por operação**:
- `INSERT`: dados_novos (JSONB com todos os campos)
- `UPDATE`: dados_anteriores + dados_novos (JSONB)
- `DELETE`: dados_anteriores

---

## DECISÃO #007 — Motor de Precificação Mubisys (9 Passos)

**Data**: 2026-03-09
**Agente**: BACKEND_AGENT
**Status**: IMPLEMENTADA

**Arquivo**: `src/shared/services/pricing-engine.ts`

**Fórmulas implementadas**:

```
1. P = ((C - CP) × 100) / F        — % custo fixo sobre faturamento
2. Cm = ((Fp/Qf) / 176) / 60       — custo por minuto de mão de obra
3. Pv = (comissão + impostos + juros) / 100  — % despesas de venda
4. Vb = (Vmp + MO) × (1 + P/100)   — valor base (MP + MO + fixo)
5. Vam = Vb / (1 - Pv)             — valor antes do markup
6. Vm = (Vam × Pm/100) / (1 - Pv)  — valor do markup
7. Vv = Vam + Vm                    — preço de venda final
```

**Defaults configuráveis em `config_precificacao`**:
- Folha de pagamento: R$ 23.744
- Funcionários: 6
- Horas/mês: 176
- Comissão: 5%
- Impostos: 12%
- Juros: 2%

**Regra**: Preço mínimo = `Vam` (sem markup). Nunca vender abaixo disso.

---

## DECISÃO #008 — Row Level Security (RLS) por Role

**Data**: 2026-03-09
**Agente**: BACKEND_AGENT
**Status**: IMPLEMENTADA

**Helper function**: `get_user_role()` — retorna o role do usuário autenticado consultando `profiles.role`

**Roles do sistema**:

| Role | Acesso |
|---|---|
| `admin` | TODOS os módulos, todas as operações |
| `diretor` | Leitura em tudo + dashboard executivo |
| `comercial` | Clientes, leads, oportunidades, propostas |
| `comercial_senior` | Como comercial + aprovação de propostas/pedidos |
| `financeiro` | Financeiro, clientes (leitura), pedidos (leitura) |
| `producao` | Produção, estoque (leitura), pedidos (leitura) |
| `compras` | Compras, estoque, fornecedores |
| `logistica` | Instalação, pedidos (leitura) |
| `instalador` | App de Campo APENAS (sem acesso ao ERP) |

**Convenção das policies**:
```sql
-- Padrão de nomenclatura
"{role}_ver_{tabela}"    -- SELECT
"{role}_editar_{tabela}" -- INSERT + UPDATE
"{role}_excluir_{tabela}" -- DELETE (só admin)
```

---

## DECISÃO #009 — Integração ERP ↔ App de Campo (Bridge)

**Data**: 2026-03-10
**Agente**: ARCHITECT_AGENT
**Status**: MIGRATION PENDENTE (004_integracao_bridge.sql)

**Mecanismo de sincronização bidirecional**:

### ERP → Campo (CRM agenda → Campo recebe tarefa)
```sql
-- Trigger: quando ordens_instalacao.status = 'agendada'
-- Cria automaticamente um job na tabela jobs do Campo
fn_create_job_from_ordem() → INSERT INTO jobs
```

### Campo → ERP (técnico conclui → ERP atualiza)
```sql
-- Trigger: quando jobs.status = 'Concluído'
-- Atualiza automaticamente ordens_instalacao.status = 'concluida'
fn_sync_job_to_ordem() → UPDATE ordens_instalacao
```

**Views de integração**:
- `vw_campo_instalacoes` — jobs + stores + profiles + contagens de mídia
- `vw_campo_fotos` — fotos com contexto do pedido e loja

**Bridge columns adicionadas**:
- `jobs.ordem_instalacao_id` — FK para ordens_instalacao
- `jobs.pedido_id` — FK para pedidos
- `stores.cliente_id` — FK para clientes
- `stores.cliente_unidade_id` — FK para cliente_unidades

**⚠️ Status mapeamento** (inconsistência conhecida, a resolver):
| Campo | ERP |
|---|---|
| `Pendente` | `aguardando_agendamento` |
| `Em Andamento` | `em_execucao` |
| `Concluído` | `concluida` |

---

## DECISÃO #010 — Validação de Transição de Status

**Data**: 2026-03-09
**Agente**: BACKEND_AGENT
**Status**: IMPLEMENTADA

**Função**: `fn_validar_transicao_status()` — aplicada como trigger em tabelas com workflow de status.

**Máquinas de estado protegidas**:

```
Pedido:
rascunho → aguardando_aprovacao → aprovado → em_producao → produzido
→ aguardando_instalacao → em_instalacao → parcialmente_concluido
→ concluido | cancelado

Proposta:
rascunho → enviada → em_revisao → aprovada | recusada | expirada

Ordem de Produção:
aguardando_programacao → em_fila → em_producao → em_acabamento
→ em_conferencia → liberado | retrabalho → finalizado
```

**Regra**: Qualquer tentativa de transição inválida (ex: `rascunho → concluido`) será rejeitada com erro PostgreSQL.

---

## DECISÃO #011 — Sequências de Numeração Automática

**Data**: 2026-03-09
**Agente**: BACKEND_AGENT
**Status**: IMPLEMENTADA

| Entidade | Formato | Exemplo |
|---|---|---|
| Proposta | `PROP-YYYY-####` | PROP-2026-0001 |
| Pedido | `PED-YYYY-####` | PED-2026-0001 |
| Ordem de Produção | `OP-YYYY-####` | OP-2026-0001 |
| Ordem de Instalação | `INST-YYYY-####` | INST-2026-0001 |
| Pedido de Compra | `PC-YYYY-####` | PC-2026-0001 |
| Solicitação de Compra | `SC-YYYY-####` | SC-2026-0001 |
| Ocorrência | `OC-YYYY-####` | OC-2026-0001 |

**Implementação**: Functions PostgreSQL com sequences + lógica de formatação por ano.

---

## DECISÃO #012 — Dashboard Roteado por Role

**Data**: 2026-03-09
**Agente**: FRONTEND_AGENT
**Status**: IMPLEMENTADA

**Arquivo**: `src/domains/comercial/pages/DashboardPage.tsx`

Cada role vê um dashboard diferente com KPIs relevantes para sua função:

| Role | Dashboard | KPIs principais |
|---|---|---|
| `diretor` / `admin` | `DashboardDiretor` | Faturamento, pipeline, margem, todos os módulos |
| `comercial` / `comercial_senior` | `DashboardComercial` | Pipeline, metas, conversão, propostas |
| `financeiro` | `DashboardFinanceiro` | Contas, fluxo de caixa, inadimplência, DRE |
| `producao` | `DashboardProducao` | OPs em fila, tempo médio, retrabalho, expedição |

**Implementação**: `React.lazy` + `Suspense` por role. Code splitting automático.

---

## PADRÕES DE CÓDIGO (REFERENCE CARD)

### Service Pattern
```typescript
// src/domains/{dominio}/services/{dominio}.service.ts
import { supabase } from '@/lib/supabase'
import type { Cliente } from '../types/clientes.types'

export const clienteService = {
  list: async (filters?: { ativo?: boolean }) => {
    let query = supabase.from('clientes').select('*, cliente_unidades(count)').is('excluido_em', null)
    if (filters?.ativo !== undefined) query = query.eq('ativo', filters.ativo)
    return query.order('razao_social')
  },
  getById: async (id: string) =>
    supabase.from('clientes').select('*, cliente_unidades(*), cliente_contatos(*)').eq('id', id).single(),
  create: async (data: Omit<Cliente, 'id' | 'created_at'>) =>
    supabase.from('clientes').insert(data).select().single(),
  update: async (id: string, data: Partial<Cliente>) =>
    supabase.from('clientes').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id),
  softDelete: async (id: string, userId: string) =>
    supabase.from('clientes').update({ excluido_em: new Date().toISOString(), excluido_por: userId }).eq('id', id),
}
```

### Hook Pattern
```typescript
// src/domains/{dominio}/hooks/useClientes.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clienteService } from '../services/clientes.service'
import { showSuccess, showError } from '@/utils/toast'

export const CLIENTES_QUERY_KEY = ['clientes']

export function useClientes(filters?: { ativo?: boolean }) {
  return useQuery({
    queryKey: [...CLIENTES_QUERY_KEY, filters],
    queryFn: () => clienteService.list(filters),
    staleTime: 2 * 60 * 1000, // 2 minutos
  })
}

export function useCreateCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: clienteService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CLIENTES_QUERY_KEY })
      showSuccess('Cliente criado com sucesso')
    },
    onError: () => showError('Erro ao criar cliente'),
  })
}
```

### Component Pattern
```typescript
// src/domains/{dominio}/pages/ClientesList.tsx
import { useClientes } from '../hooks/useClientes'
import { Card, CardContent } from '@/components/ui/card'
import { DataTableSkeleton } from '@/shared/components/DataTableSkeleton'

export default function ClientesList() {
  const { data: clientes, isLoading } = useClientes({ ativo: true })

  if (isLoading) return <DataTableSkeleton rows={10} />

  return (
    <div className="space-y-4">
      {/* lista */}
    </div>
  )
}
```

---

## MÓDULO FISCAL — REFERÊNCIA

**Migration**: `supabase/migrations/003_fiscal.sql`

**Tabelas**:
- `config_fiscal` — Regime tributário, alíquotas, CNPJ emissor
- `notas_fiscais` — NF-e emitidas com XML
- `nota_fiscal_itens` — Itens com CFOP, NCM, alíquotas
- `eventos_nfe` — Histórico de eventos (cancelamento, carta de correção)

**Regime padrão**: Simples Nacional
**Alíquota ISS**: 2-5% (configurável)
**NCM padrão comunicação visual**: 4911.91.00

---

## GLOSSÁRIO DO NEGÓCIO CROMA PRINT

| Termo técnico | Significado no negócio |
|---|---|
| `lead` | Empresa prospectada que ainda não comprou |
| `oportunidade` | Lead qualificado com potencial de compra identificado |
| `proposta` | Orçamento formal com validade, itens e preços |
| `pedido` | Proposta aprovada pelo cliente — "a venda foi fechada" |
| `ordem_producao` | Instrução interna para produzir um item do pedido |
| `ordem_instalacao` | Agendamento da instalação dos itens produzidos |
| `job` | Tarefa no App de Campo = ordem de instalação em execução |
| `store` | Loja do cliente no App de Campo = unidade do cliente |
| `acabamento` | Finalização do material: ilhós, bastão, laminação, etc. |
| `markup` | Percentual de margem aplicado sobre o custo para chegar ao preço |
| `Cm` | Custo por minuto de mão de obra (fórmula Mubisys) |
| `OP` | Ordem de Produção |
| `OS` | Ordem de Serviço (sinônimo de job no campo) |
| `PDV` | Ponto de Venda — local onde o material será exibido |
| `ACM` | Alumínio Composto — material para fachadas |
| `ICP` | Ideal Customer Profile — perfil do cliente ideal |

---

## ESTADO ATUAL DO DEPLOY (2026-03-10)

### URLs dos Produtos
| Produto | URL | Status |
|---|---|---|
| CRM/ERP (Produto A) | `https://crm-croma.vercel.app/` | ✅ Online |
| App de Campo (Produto B) | `https://campo-croma.vercel.app/` | ✅ Online |

### Migrations Supabase (`djwjmfgplnqyffdcgdaw.supabase.co`)
| Arquivo | Status |
|---|---|
| `001_complete_schema.sql` | ✅ EXECUTADO — 51 tabelas base |
| `002_schema_corrections.sql` | ✅ EXECUTADO — 14 tabelas novas, RLS granular, audit triggers |
| `003_campo.sql` | ✅ EXECUTADO |
| `003_fiscal.sql` | ✅ EXECUTADO — config_fiscal, notas_fiscais |
| `004_integracao_bridge.sql` | ✅ EXECUTADO — sync CRM ↔ Campo via triggers |
| `005_*.sql` | ✅ EXECUTADO |
| `006_orcamento_module.sql` | ✅ EXECUTADO — acabamentos, serviços, regras_precificacao |

### Commits em main (últimos)
| Commit | Descrição |
|---|---|
| `e56374c` | feat(financeiro): implementa DRE gerencial completa + AdminPrecificacao |
| `484a1d3` | feat: adiciona PROJECT_GOVERNANCE.md + PROJECT_MEMORY.md |
| `75e0ee3` | feat(fase-fg): App.tsx routes para orçamentos e admin/precificacao |

### Páginas Implementadas no CRM
| Rota | Página | Status |
|---|---|---|
| `/` | Dashboard (4 roles) | ✅ Real |
| `/clientes` | Lista de clientes | ✅ Real |
| `/clientes/:id` | Detalhe do cliente | ✅ Real |
| `/comercial` | Funil + Pipeline | ✅ Real |
| `/orcamentos` | Lista de orçamentos | ✅ Real |
| `/orcamentos/novo` | Editor de orçamento | ✅ Real |
| `/pedidos` | Lista de pedidos | ✅ Real |
| `/producao` | Fila de produção | ✅ Real |
| `/estoque` | Materiais e saldos | ✅ Real |
| `/financeiro` | Contas e DRE | ✅ Real |
| `/dre` | **DRE Gerencial** | ✅ **NOVO** |
| `/instalacao` | Agenda de instalação | ✅ Real |
| `/admin/precificacao` | Config Mubisys | ✅ **NOVO** |

---

## LOG DE ATUALIZAÇÕES DESTE ARQUIVO

| Data | Agente | O que foi adicionado |
|---|---|---|
| 2026-03-10 | ARCHITECT_AGENT | Versão inicial — 12 decisões, padrões de código, glossário |
| 2026-03-10 | ARCHITECT_AGENT | Estado atual do deploy, URLs, migrations e páginas implementadas |

---

*Toda decisão arquitetural relevante DEVE ser adicionada aqui antes de ser implementada.*
*Este arquivo é consultado no início de cada sessão para restaurar o contexto do projeto.*
