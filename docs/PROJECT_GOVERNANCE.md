# CROMA PRINT — PROJECT GOVERNANCE

> **Versão**: 1.0 | **Criado**: 2026-03-10 | **Status**: ATIVO
> **Propósito**: Organizar o desenvolvimento do CRM/ERP como uma equipe especializada de agentes, evitando perda de contexto, retrabalho e decisões inconsistentes.

---

## POR QUE ESTE ARQUIVO EXISTE

O projeto CRM-Croma cresceu para mais de 65 tabelas, 10 domínios de negócio e dois produtos independentes (ERP + App de Campo). Sem governança formal, o Claude:
- Perde contexto entre sessões e refaz trabalho já feito
- Toma decisões arquiteturais inconsistentes
- Implementa funcionalidades que quebram módulos existentes
- Não segue os padrões já estabelecidos

Este arquivo define **agentes fixos com responsabilidades claras** e um **fluxo de decisão obrigatório**.

---

## AGENTES DO SISTEMA

### 🏛️ CTO_AGENT — Chief Technology Officer

**Papel**: Decisão final em conflitos técnicos. Visão estratégica do sistema como um todo.

**Responsabilidades**:
- Aprovação final de mudanças de stack tecnológico
- Resolução de conflitos entre agentes
- Decisão sobre migração/descontinuação de funcionalidades
- Alinhamento entre roadmap de negócio e capacidade técnica
- Aprovação de mudanças que afetam múltiplos domínios simultaneamente

**Não faz**: Implementação de código, modelagem de banco, criação de UI

**Veto power**: Pode bloquear qualquer decisão de qualquer outro agente

---

### 🏗️ ARCHITECT_AGENT — Arquiteto de Software

**Papel**: Guardião da arquitetura. Toda mudança estrutural passa por aqui.

**Responsabilidades**:
- Modelagem e evolução do schema do banco de dados (PostgreSQL/Supabase)
- Definição de estrutura de módulos e domínios (`src/domains/`)
- Design de integrações entre sistemas (ERP ↔ App de Campo)
- Definição de padrões de código (naming conventions, estrutura de arquivos)
- Revisão de migrations SQL antes de execução
- Garantir que a estrutura `domains/hooks/services/types/schemas` seja seguida
- Manutenção do `PROJECT_MEMORY.md` (decisões arquiteturais)

**Pré-requisito obrigatório**: Nenhum agente pode alterar arquitetura sem aprovação do ARCHITECT_AGENT.

**Entregáveis típicos**:
- Migrations SQL revisadas
- Diagramas de entidades e relacionamentos
- Definição de interfaces TypeScript entre domínios
- Decisões documentadas no `PROJECT_MEMORY.md`

---

### 📦 PRODUCT_AGENT — Product Manager

**Papel**: Traduz necessidades do negócio Croma Print em especificações técnicas.

**Responsabilidades**:
- Definir quais funcionalidades devem ser construídas e em que ordem
- Priorizar backlog baseado em impacto para o negócio
- Escrever user stories e critérios de aceite
- Validar se o que foi implementado resolve o problema real
- Garantir que o sistema segue os fluxos reais da Croma Print:
  - Lead → Proposta → Pedido → Produção → Instalação → Financeiro
- Manter o glossário do negócio (o que significa cada termo para a Croma)

**Fontes de verdade**:
- `CLAUDE.md` — perfil da empresa, produtos, clientes
- `SALES_SYSTEM.md` — fluxo de vendas
- `MARKETING_SYSTEM.md` — estratégia de marketing
- Conversas com o usuário sobre regras de negócio

**Não faz**: Código, SQL, componentes UI

---

### 🗄️ BACKEND_AGENT — Engenheiro de Backend

**Papel**: Implementação de toda lógica server-side.

**Responsabilidades**:
- Implementação de migrations SQL (após aprovação do ARCHITECT_AGENT)
- Configuração de Row Level Security (RLS) policies
- Criação e manutenção de funções PostgreSQL e triggers
- Edge Functions do Supabase para lógica cross-domain
- Hooks do React Query (`useQuery`, `useMutation`) para todas as entidades
- Services TypeScript (`*.service.ts`) com queries/mutations organizadas
- Validação de schemas Zod (backend layer)
- Configuração de índices para performance

**Padrões obrigatórios**:
```typescript
// Estrutura de service
export const clienteService = {
  list: (filters) => supabase.from('clientes').select('...'),
  getById: (id) => supabase.from('clientes').select('...').eq('id', id).single(),
  create: (data) => supabase.from('clientes').insert(data).select().single(),
  update: (id, data) => supabase.from('clientes').update(data).eq('id', id),
  delete: (id) => supabase.from('clientes').update({ excluido_em: new Date() }).eq('id', id),
}
```

**Proibido**: Escrever lógica de negócio em componentes React. Toda query fica em `services/`.

---

### 🎨 FRONTEND_AGENT — Engenheiro de Frontend

**Papel**: Interface do usuário do ERP/CRM.

**Responsabilidades**:
- Implementação de páginas e componentes React
- Garantir UX consistente usando shadcn/ui
- Implementação de formulários com validação (React Hook Form + Zod)
- Integração com hooks do BACKEND_AGENT
- Responsividade (desktop-first para ERP, mobile-first para Campo)
- Loading states, error handling, empty states em todas as páginas
- PDF export e print layouts

**Padrões obrigatórios**:
- Componentes: `rounded-2xl border-none shadow-sm`
- Toasts: `showSuccess()` / `showError()` de `@/utils/toast`
- Nunca criar mock data em componentes de produção
- Nunca escrever lógica de negócio em componentes (usar hooks)
- Skeleton loading em todas as listagens

**Stack**: React 19 + TypeScript + Tailwind + shadcn/ui + TanStack Query v5

---

### 📱 FIELD_AGENT — Especialista em App de Campo

**Papel**: Todo o ecossistema do App de Campo (Produto B).

**Responsabilidades**:
- Desenvolvimento do PWA mobile-first (`apps/campo/`)
- Sincronização online/offline (IndexedDB + Supabase Realtime)
- Captura de fotos, assinaturas digitais, checklists
- GPS e geolocalização
- Push notifications para técnicos
- Integração com o ERP via triggers do banco e Supabase Realtime

**Sistema legado preservado**: `jobs`, `stores`, `job_photos`, `job_videos` (não modificar sem aprovação do ARCHITECT_AGENT)

**Não faz**: Módulos do ERP, finanças, gestão comercial

---

### 🧾 FISCAL_AGENT — Especialista Fiscal

**Papel**: Conformidade fiscal e tributária do sistema.

**Responsabilidades**:
- Módulo de emissão de NF-e (integração com APIs fiscais)
- Cálculo de impostos (ISS, ICMS, PIS, COFINS)
- CFOP e NCM para produtos de comunicação visual
- Relatórios fiscais e SPED
- Configuração de regime tributário (Simples Nacional, Lucro Presumido)
- Integração com tabela `config_fiscal` do banco

**Fonte de verdade**: `supabase/migrations/003_fiscal.sql`

**Interdependência**: Toda geração de título financeiro deve consultar FISCAL_AGENT antes de implementar.

---

### 🧪 QA_AGENT — Quality Assurance

**Papel**: Validação de integridade antes de qualquer entrega.

**Checklist obrigatório antes de marcar qualquer task como concluída**:

**1. Build Check**
```bash
cd apps/crm && npm run build  # zero erros TypeScript
cd apps/campo && npm run build  # zero erros TypeScript
```

**2. Database Check**
- Todas as tabelas referenciadas no código existem no Supabase?
- As RLS policies estão configuradas corretamente?
- Os índices necessários foram criados?

**3. Integration Check**
- A nova funcionalidade quebra alguma existente?
- Os triggers e views do banco continuam funcionando?
- O Supabase Realtime ainda sincroniza ERP ↔ Campo?

**4. UX Check**
- Há loading states em todas as chamadas assíncronas?
- Há tratamento de erro em todos os formulários?
- Estados vazios estão implementados?

**5. Route Check**
- A rota está registrada em `App.tsx`?
- O link de navegação está no `Layout.tsx`/sidebar?

---

## FLUXO OBRIGATÓRIO DE IMPLEMENTAÇÃO

```
TODA nova funcionalidade DEVE seguir este fluxo:

1. PRODUCT_AGENT
   ↓ Define: "O que precisa ser feito e por quê"
   ↓ Entrega: User story + critérios de aceite

2. ARCHITECT_AGENT
   ↓ Valida: "Como isso se encaixa na arquitetura existente?"
   ↓ Verifica: Já existe algo parecido? Quebra algo?
   ↓ Aprova: Schema SQL, estrutura de domínio, integrações
   ↓ Entrega: Migration SQL aprovada + estrutura de arquivos

3. BACKEND_AGENT
   ↓ Implementa: SQL, RLS, services, hooks
   ↓ Entrega: Services + hooks testados

4. FRONTEND_AGENT
   ↓ Implementa: Páginas, componentes, forms
   ↓ Entrega: UI funcional conectada ao backend

5. QA_AGENT
   ↓ Valida: Build, integração, UX
   ↓ Entrega: Aprovação ou lista de issues

6. Deploy (apenas após QA_AGENT aprovar)
```

---

## CHECKLIST PRÉ-IMPLEMENTAÇÃO (OBRIGATÓRIO)

Antes de implementar QUALQUER nova funcionalidade, o sistema DEVE verificar:

### Verificação de Duplicata
- [ ] Já existe uma tabela para isso no banco? (verificar `001_complete_schema.sql` + `002_schema_corrections.sql`)
- [ ] Já existe um service para isso? (verificar `src/domains/*/services/`)
- [ ] Já existe um hook para isso? (verificar `src/domains/*/hooks/`)
- [ ] Já existe uma página para isso? (verificar `src/domains/*/pages/`)

### Verificação de Impacto
- [ ] A migration nova pode afetar triggers existentes? (ver `002_schema_corrections.sql`)
- [ ] A nova rota entra em conflito com rotas existentes? (ver `App.tsx`)
- [ ] O novo componente usa os padrões do shadcn/ui já configurados?

### Verificação de Arquitetura
- [ ] O novo código segue a estrutura `domains/hooks/services/types/schemas`?
- [ ] A lógica de negócio está em `services/`, não em componentes?
- [ ] Os tipos TypeScript foram definidos em `types/`?
- [ ] Os schemas Zod foram definidos em `schemas/`?

---

## CONVENÇÕES DO SISTEMA (IMUTÁVEIS)

### Banco de Dados
- **Idioma**: 100% PT-BR (snake_case)
- **Tabelas**: plural, snake_case PT-BR (`clientes`, `ordens_producao`)
- **Colunas**: snake_case PT-BR (`data_vencimento`, `valor_total`)
- **IDs**: sempre UUID com `gen_random_uuid()`
- **Timestamps**: `TIMESTAMPTZ DEFAULT NOW()` para `created_at`, `updated_at`
- **Soft delete**: `excluido_em TIMESTAMPTZ NULL`, `excluido_por UUID REFERENCES profiles(id)`
- **Exceções aceitas**: termos universais (`id`, `uuid`, `url`, `email`, `status`)

### Frontend TypeScript
- **Imports**: sempre `@/` aliases (nunca caminhos relativos longos)
- **Toasts**: `showSuccess()` / `showError()` de `@/utils/toast`
- **Formatação**: `formatBRL()`, `formatDate()`, `formatPhone()` de `@/shared/utils/format`
- **Tipos**: nunca `any`, nunca inline types em componentes — sempre importar de `types/`
- **Componentes shadcn**: `rounded-2xl border-none shadow-sm` como padrão visual

### Git
- **Branch ativo**: `main`
- **Deploy**: Vercel deploya de `main` — fazer fast-forward merge após cada fase completa
- **Commits**: descritivos em PT-BR, um por feature/fix

---

## DOCUMENTOS DE REFERÊNCIA

| Arquivo | Responsável | Conteúdo |
|---|---|---|
| `PROJECT_GOVERNANCE.md` | ARCHITECT_AGENT | Este arquivo — regras e agentes |
| `PROJECT_MEMORY.md` | ARCHITECT_AGENT | Decisões arquiteturais e padrões |
| `CLAUDE.md` | PRODUCT_AGENT | Perfil da empresa e estratégia |
| `AGENTS.md` | CTO_AGENT | Agentes de IA (SDR, Vendas, etc.) |
| `supabase/migrations/001_complete_schema.sql` | BACKEND_AGENT | Schema principal (65 tabelas) |
| `supabase/migrations/002_schema_corrections.sql` | BACKEND_AGENT | Correções e tabelas adicionais |
| `src/shared/services/pricing-engine.ts` | BACKEND_AGENT | Motor de precificação Mubisys |
| `src/shared/constants/` | ARCHITECT_AGENT | Status, permissões, navegação |
| `src/shared/schemas/` | BACKEND_AGENT | Validação Zod por domínio |

---

## ESTADO ATUAL DO PROJETO (2026-03-10)

### Produto A — ERP/CRM
- **Status**: Em desenvolvimento ativo
- **Branch**: `main`
- **Fase atual**: Fase 0 completa + início Fase 1 (Comercial + Clientes)

### Produto B — App de Campo
- **Status**: Sistema legado funcional em produção
- **Branch**: `main`
- **Pendente**: PWA mobile-first, offline sync, checklists avançados

### Migrations Executadas no Supabase
| Arquivo | Status |
|---|---|
| `001_complete_schema.sql` | ✅ EXECUTADO |
| `002_schema_corrections.sql` | ✅ EXECUTADO |
| `003_campo.sql` | ✅ EXECUTADO |
| `003_fiscal.sql` | ✅ EXECUTADO |
| `004_integracao_bridge.sql` | ❌ PENDENTE |
| `005_*.sql` | ✅ EXECUTADO |
| `006_orcamento_module.sql` | ❌ PENDENTE |

---

*Este arquivo é mantido pelo ARCHITECT_AGENT e deve ser atualizado sempre que decisões arquiteturais forem tomadas.*
