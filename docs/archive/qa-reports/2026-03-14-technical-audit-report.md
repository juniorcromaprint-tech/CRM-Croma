# AUDITORIA TECNICA PROFUNDA — CROMA PRINT CRM/ERP

> Data: 2026-03-14 | Auditor: Claude Opus 4.6 | Branch: `claude/optimistic-mendeleev`

---

## SUMARIO EXECUTIVO

| Metrica | Valor |
|---|---|
| **Total de arquivos TS/TSX (src/)** | 132 |
| **Total de linhas de codigo (src/)** | ~64.125 |
| **Dominios mapeados** | 12 (admin, clientes, comercial, compras, estoque, financeiro, fiscal, instalacao, pedidos, portal, producao, qualidade) |
| **Rotas protegidas** | 38 |
| **Rotas publicas** | 3 (/login, /tv, /p/:token) |
| **Tabelas no banco** | 51+ (migration 001) + extensoes |
| **Migrations** | 26 arquivos (11+ executadas, 1 pendente critica) |
| **Edge Functions** | 14 |
| **Schemas Zod** | 8 arquivos de schemas |
| **Testes unitarios** | 1 arquivo (pricing-engine.test.ts) |

---

## 1. MAPEAMENTO COMPLETO DO SISTEMA

### 1.1 Rotas

#### Publicas (sem autenticacao)
| Rota | Pagina | Descricao |
|---|---|---|
| `/login` | LoginPage | Autenticacao Supabase |
| `/tv` | TvPage | Painel TV producao (sem layout) |
| `/p/:token` | PortalOrcamentoPage | Portal publico do cliente (lazy loaded) |

#### Protegidas — Comercial
| Rota | Pagina | Descricao |
|---|---|---|
| `/` (index) | DashboardPage | Dashboard responsivo por role |
| `/leads` | LeadsPage | Gestao de leads |
| `/leads/:id` | LeadDetailPage | Detalhe do lead |
| `/pipeline` | PipelinePage | Kanban de oportunidades |
| `/orcamentos` | OrcamentosPage | Lista de orcamentos |
| `/orcamentos/novo` | OrcamentoEditorPage | Editor de orcamento (wizard 3 etapas) |
| `/orcamentos/:id` | OrcamentoViewPage | Visualizacao do orcamento |
| `/orcamentos/:id/editar` | OrcamentoEditorPage | Edicao de orcamento |
| `/propostas` | PropostasPage | Gestao de propostas |
| `/calendario` | CalendarioPage | Calendario comercial |
| `/campanhas` | CampanhasPage | Campanhas de marketing |

#### Protegidas — Clientes
| Rota | Pagina |
|---|---|
| `/clientes` | ClientesPage |
| `/clientes/:id` | ClienteDetailPage |

#### Protegidas — Operacional
| Rota | Pagina |
|---|---|
| `/pedidos` | PedidosPage |
| `/pedidos/:id` | PedidoDetailPage |
| `/producao` | ProducaoPage |
| `/instalacoes` | InstalacaoPage |
| `/almoxarife` | AlmoxarifePage |
| `/producao/diario-bordo` | DiarioBordoPage |
| `/estoque` | EstoquePage |
| `/compras` | ComprasPage |
| `/produtos` | Produtos (legado em src/pages) |
| `/ocorrencias` | OcorrenciasPage |

#### Protegidas — Financeiro
| Rota | Pagina |
|---|---|
| `/financeiro` | FinanceiroPage |
| `/dre` | DrePage |
| `/comissoes` | ComissoesPage |
| `/financeiro/faturamento` | FaturamentoLotePage |
| `/financeiro/pedidos-a-faturar` | PedidosAFaturarPage |
| `/financeiro/conciliacao` | ConciliacaoPage |
| `/financeiro/boletos` | BoletosPage |
| `/financeiro/config-bancaria` | ConfigBancariaPage |

#### Protegidas — Fiscal
| Rota | Pagina |
|---|---|
| `/fiscal` | FiscalDashboardPage |
| `/fiscal/documentos` | FiscalDocumentosPage |
| `/fiscal/fila` | FiscalFilaPage |
| `/fiscal/emissao` | FiscalFilaPage (rota duplicada!) |
| `/fiscal/configuracao` | FiscalConfiguracaoPage |
| `/fiscal/certificado` | FiscalCertificadoPage |
| `/fiscal/auditoria` | FiscalAuditoriaPage |

#### Protegidas — Admin (com PermissionGuard)
| Rota | Pagina |
|---|---|
| `/admin/usuarios` | AdminUsuariosPage |
| `/admin/precificacao` | AdminPrecificacaoPage |
| `/admin/config` | AdminConfigPage |
| `/admin/produtos` | AdminProdutosPage |
| `/admin/auditoria` | AdminAuditoriaPage |
| `/admin/setup` | AdminSetupPage |
| `/admin/centros-custo` | AdminCentrosCustoPage |
| `/admin/plano-contas` | AdminPlanoContasPage |
| `/admin/materiais` | AdminMateriaisPage |
| `/relatorios` | RelatoriosPage |
| `/admin/progresso` | ProgressoPage |
| `/settings` | Settings (legado, sem PermissionGuard) |

### 1.2 Navegacao (Sidebar)

8 grupos de menu com 41 itens totais:
- **PAINEL** (1): Dashboard
- **COMERCIAL** (8): Leads, Pipeline, Clientes, Orcamentos, Propostas, Calendario, Campanhas, Templates
- **OPERACIONAL** (5): Pedidos, Producao, Instalacoes, Almoxarife, Diario de Bordo
- **SUPRIMENTOS** (4): Estoque, Compras, Produtos, Materia Prima
- **FINANCEIRO** (10): Financeiro, DRE, Comissoes, Pedidos a Faturar, Faturamento em Lote, Conciliacao, Boletos, Config. Bancaria, Centros de Custo, Plano de Contas
- **QUALIDADE** (1): Ocorrencias
- **FISCAL** (6): NF-e Dashboard, Documentos, Fila de Emissao, Configuracao Fiscal, Certificado Digital, Auditoria Fiscal
- **ADMINISTRACAO** (6): Usuarios, Configuracoes, Auditoria, Precificacao, Relatorios, Progresso ERP

### 1.3 Rotas no Menu vs. Rotas Registradas

**BUG ENCONTRADO** [MEDIO]: Existem itens no menu de navegacao (`navigation.ts`) que NAO possuem rotas registradas:
- `/orcamentos/templates` (nav item "Templates") — nao tem Route correspondente
- Icones referenciados no nav que NAO estao no ICON_MAP do Layout: `Calendar`, `Megaphone`, `Package2`, `ArrowLeftRight`, `Building`, `Layers`, `BarChart2` — estes icones caem no fallback `LayoutDashboard`

**BUG ENCONTRADO** [BAIXO]: Rota `/fiscal/emissao` e `/fiscal/fila` apontam para o MESMO componente `FiscalFilaPage`.

### 1.4 Paginas Legado (src/pages/)

7 arquivos em `src/pages/` fora da estrutura de dominios:
- `JobDetail.tsx` (1137 linhas) — componente do APP-Campo importado no ERP
- `Jobs.tsx`, `NewJob.tsx`, `Team.tsx` — componentes legados do APP-Campo
- `Produtos.tsx` (953 linhas) — deveria estar em `src/domains/producao/pages/`
- `Settings.tsx` — deveria estar em `src/domains/admin/pages/`
- `NotFound.tsx` — unico que faz sentido em src/pages (mas NAO e usado, rota `*` redireciona para `/`)

---

## 2. ANALISE DE ARQUITETURA

### 2.1 Estrutura de Dominios

A arquitetura Domain-Driven e BEM implementada. Cada dominio segue o padrao:
```
src/domains/{dominio}/
  pages/       — Paginas React
  hooks/       — useQuery / useMutation
  components/  — Componentes especificos
  services/    — Logica de negocio + Supabase
  schemas/     — Schemas Zod
  types/       — Tipos TypeScript
```

**Pontos positivos:**
- Separacao clara entre 12 dominios
- Services desacoplados de componentes
- Hooks encapsulam TanStack Query corretamente
- Schemas Zod centralizados em `src/shared/schemas/`

**Problemas encontrados:**

| ID | Severidade | Descricao |
|---|---|---|
| ARQ-01 | MEDIO | 7 arquivos legados em `src/pages/` quebram a arquitetura de dominios |
| ARQ-02 | MEDIO | `src/components/` mistura componentes UI (shadcn) com componentes de negocio (`ErrorBoundary`, `NotificationBadge`, `StoreFormSheet`, `JobFormSheet`, `TeamMemberFormSheet`) |
| ARQ-03 | BAIXO | `src/hooks/` contem hooks globais (`useNotifications`) que deveriam estar em shared |
| ARQ-04 | BAIXO | `src/utils/` e `src/shared/utils/` coexistem — duplicacao de namespace |

### 2.2 Gestao de Estado

| Tecnologia | Uso | Avaliacao |
|---|---|---|
| TanStack Query v5 | Cache de dados server-side | Bem implementado, staleTime configurado |
| React Context | Auth (AuthContext) | Correto, unico contexto global |
| useState local | State de UI | Adequado |
| Supabase Realtime | 3 arquivos (notifications, campo, tracking) | Uso minimo |

**QueryClient config:** `staleTime: 2min`, `retry: 1` — adequado para aplicacao ERP.

### 2.3 Code Splitting e Performance

| Aspecto | Status | Nota |
|---|---|---|
| Lazy loading | Parcial | Apenas PortalOrcamentoPage e 4 dashboards usam React.lazy |
| Route-level splitting | Nenhum | Todas as 38+ rotas protegidas sao importadas sincronamente |
| Bundle size | Grande | 64k+ linhas sem splitting por rota |
| Suspense | Minimo | Apenas nos lazy loads existentes |

**ACHADO CRITICO** [ALTO]: **Nenhuma rota protegida usa lazy loading.** Todas as paginas sao importadas no bundle principal. Com 38 rotas e 64k linhas de codigo, o bundle inicial e desnecessariamente grande.

### 2.4 Tratamento de Erros

- **ErrorBoundary existe** (`src/components/ErrorBoundary.tsx`), mas **NAO e usado em nenhum lugar** do App.tsx ou Layout.
- Os hooks usam `onError` do TanStack Query com `showError()` (toast) — adequado.
- Services usam try/catch com fallbacks silenciosos (`console.warn`) quando tabelas nao existem — perigoso em producao.

| ID | Severidade | Descricao |
|---|---|---|
| ERR-01 | ALTO | ErrorBoundary existe mas NAO esta wrapping nenhum componente |
| ERR-02 | MEDIO | 12 catch blocks silenciosos em orcamento.service.ts que engolem erros de tabelas nao-existentes |
| ERR-03 | BAIXO | 31 console.log/warn/error em producao (deveria usar logging service) |

### 2.5 Integracao Supabase

- **Client**: Centralizado em `src/integrations/supabase/client.ts` — correto
- **Types gerados**: NAO EXISTE arquivo `types.ts` no diretorio — queries usam `as unknown as Type` extensivamente
- 101 arquivos importam o Supabase client
- Queries sao bem estruturadas com joins (select + nested selects)
- N+1 corrigido em orcamento.service.ts com Promise.all

| ID | Severidade | Descricao |
|---|---|---|
| SUP-01 | ALTO | Tipos TypeScript do Supabase NAO estao gerados — todo o codigo usa `as any` ou `as unknown as Type` |
| SUP-02 | MEDIO | 14 ocorrencias de `as any` no orcamento.service.ts sozinho |
| SUP-03 | BAIXO | Sem retry automatico em Edge Function calls |

---

## 3. ANALISE DE LOGICA DE NEGOCIO

### 3.1 Motor de Precificacao (Mubisys)

**Implementacao: EXCELENTE.** O motor de custeio direto em 9 passos esta implementado corretamente:

```
Passo 1: Custo MP = soma(qtd x preco) de materiais
Passo 2: Tempo Produtivo = soma(minutos) de processos
Passo 3: % Custos Fixos = ((CustoOp - CustoProd) x 100) / Faturamento
Passo 4: Custo/Minuto = (FolhaProd / QtdFunc) / horasMes / 60
Passo 5: % Vendas = (comissao + impostos + juros) / 100
Passo 6: Custo Base = (MP + MO) x (1 + P%/100)
Passo 7: Valor antes Markup = CustoBase / (1 - Pv)
Passo 8: Valor Markup = Vam x (markup/100)
Passo 9: Preco Venda = Vam + Vm
```

**Pontos fortes:**
- Testes unitarios cobrem todos os 9 passos + invariantes
- Config pode ser customizada via tabela `config_precificacao`
- Snapshot da config e salvo no orcamento (imutabilidade)
- Explainer gera texto legivel em pt-BR
- Simulador de desconto e break-even implementados
- Aproveitamento de material calculado corretamente

**Problemas encontrados:**

| ID | Severidade | Descricao |
|---|---|---|
| PREC-01 | CRITICO | **Orcamento pode gerar R$ 0,00**: Se materiais[] e processos[] estao vazios, o motor retorna 0. O OrcamentoEditorPage permite salvar item sem selecionar materiais. Validacao no front permite salvar valor_total = 0. |
| PREC-02 | MEDIO | Acabamentos sao calculados FORA do motor Mubisys e somados ao preco sem aplicar custos fixos rateados — subestima o custo real de acabamentos |
| PREC-03 | MEDIO | Config padrao (`DEFAULT_PRICING_CONFIG`) hardcoded com valores especificos da Croma Print — se config_precificacao nao existir no banco, usa fallback sem avisar o usuario |
| PREC-04 | BAIXO | `useConfigPrecificacao` usa `Record<string, unknown>` com type assertions — sem seguranca de tipos |

### 3.2 Fluxo de Status

**Pedidos** (bem definido em `PedidoDetailPage.tsx`):
```
rascunho -> aguardando_aprovacao -> aprovado -> em_producao -> produzido
  -> aguardando_instalacao -> em_instalacao -> concluido
                                            -> cancelado (qualquer momento)
```

**Orcamentos/Propostas**:
```
rascunho -> enviada -> em_revisao -> aprovada -> (converte em pedido)
                                  -> recusada
                                  -> expirada
```

**Producao**:
```
planejada -> fila -> em_producao -> corte -> impressao -> acabamento
  -> revisao_qualidade -> pronta -> entregue -> retrabalho (loop)
```

**Problemas encontrados:**

| ID | Severidade | Descricao |
|---|---|---|
| FLOW-01 | ALTO | Nao existe validacao server-side de transicao de status — qualquer status pode ser setado via update direto |
| FLOW-02 | MEDIO | `converterParaPedido()` valida status "aprovada" mas a aprovacao em si nao tem workflow de aprovacao real (sem notificacao ao gestor) |
| FLOW-03 | MEDIO | Cancelamento de pedido grava motivo nas `observacoes` (hack) porque colunas `cancelado_em`/`motivo_cancelamento` NAO existem no schema |
| FLOW-04 | BAIXO | Status duplicados entre constantes em `PedidoDetailPage.tsx` e `shared/constants/status.ts` |

### 3.3 Validacoes Zod

8 arquivos de schemas cobrindo todos os dominios principais:
- `comercial.schemas.ts` — 15 schemas (leads, oportunidades, propostas, atividades, tarefas, acabamentos, servicos, regras, templates)
- `clientes.schemas.ts` — 6 schemas (cliente, unidade, contato, documento)
- `financeiro.schemas.ts`, `pedidos.schemas.ts`, `producao.schemas.ts`, `estoque-compras.schemas.ts`, `instalacao-qualidade.schemas.ts`, `fiscal.schemas.ts`

**Ponto positivo:** Validacao de CNPJ com regex, CEP, email, UF (2 chars). Schemas derivados (Create, Update) com `.omit()` e `.partial()`.

**Problema:** Schemas Zod sao definidos mas nem todos sao usados nos formularios — varias paginas fazem insert direto no Supabase sem validar contra o schema.

### 3.4 Regras de Negocio Codificadas

| Regra | Local | Status |
|---|---|---|
| Numero do orcamento auto-gerado | Trigger no banco | OK |
| Numero do pedido sequencial (PED-ANO-XXXX) | `orcamento.service.ts` | Race condition possivel |
| Soft delete de orcamentos | `excluido_em` field | OK |
| Bloqueio de edicao de orcamentos aprovados/recusados/expirados | `orcamento.service.ts` | OK |
| Validacao de markup minimo | `orcamento-pricing.service.ts` | OK |
| Validacao de desconto maximo com workflow aprovacao | `orcamento-pricing.service.ts` | OK |
| Calculo de comissoes por vendedor | `ComissoesPage.tsx` | Implementado |
| Nosso Numero atomico (boletos) | RPC `next_nosso_numero` | OK |
| NF-e CSOSN 400 (Simples Nacional) | `nfe-creation.service.ts` | OK |

---

## 4. ANALISE DO BANCO DE DADOS

### 4.1 Tabelas (Migration 001)

51 tabelas base cobrindo:
- **Core Admin** (7): roles, permissions, role_permissions, profiles (alter), audit_logs, attachments, notas_internas
- **Comercial** (6): lead_sources, leads, oportunidades, atividades_comerciais, tarefas_comerciais, metas_vendas
- **Clientes** (3): clientes, cliente_unidades, cliente_contatos
- **Produtos** (3): produtos, produto_modelos, config_precificacao
- **Estoque/Compras** (9): materiais, modelo_materiais, modelo_processos, estoque_saldos, estoque_movimentacoes, fornecedores, pedidos_compra, pedido_compra_itens, historico_precos
- **Propostas** (2): propostas, proposta_itens
- **Pedidos** (3): pedidos, pedido_itens, pedido_historico
- **Producao** (4): ordens_producao, producao_etapas, producao_checklist, producao_retrabalho
- **Financeiro** (7): plano_contas, centros_custo, contas_receber, parcelas_receber, contas_pagar, parcelas_pagar, comissoes
- **Instalacao** (5): equipes, ordens_instalacao, field_tasks, field_checklists, field_media, field_signatures
- **Qualidade** (2): ocorrencias, ocorrencia_tratativas

### 4.2 Migrations Executadas vs Pendentes

| Migration | Status | Impacto |
|---|---|---|
| 001-005 | Executadas | Schema base |
| **006_orcamento_module.sql** | **NAO EXECUTADA** | Tabelas `acabamentos`, `servicos`, `regras_precificacao`, `proposta_item_materiais`, `proposta_item_acabamentos` NAO existem no banco. Todo o codigo de materiais/acabamentos de orcamento FALHA SILENCIOSAMENTE |
| 007-005, 008-026 | Executadas | Extensoes |

### 4.3 Problemas Criticos no Banco

| ID | Severidade | Descricao |
|---|---|---|
| DB-01 | **CRITICO** | **Migration 006 nunca executada**: 6+ tabelas referenciadas no codigo nao existem no banco. O servico de orcamento usa try/catch para engolir erros quando tenta inserir em `proposta_item_materiais`, `proposta_item_acabamentos`, `proposta_item_processos`, `proposta_servicos`. Resultado: orcamentos salvos SEM detalhamento de materiais. |
| DB-02 | ALTO | **Tipos TypeScript nao gerados**: Nao existe `src/integrations/supabase/types.ts`. Todas as queries usam casting manual (`as unknown as Type`), perdendo seguranca de tipos e autocomplete. |
| DB-03 | ALTO | **Numeracao de pedido com race condition**: `converterParaPedido()` faz SELECT COUNT + INSERT separados — dois pedidos simultaneos podem receber o mesmo numero. Deveria usar sequence ou RPC atomica. |
| DB-04 | MEDIO | Pedido nao tem colunas `cancelado_em`, `motivo_cancelamento` — cancelamento grava em `observacoes` |
| DB-05 | MEDIO | `roles` e `permissions` existem no banco mas NAO sao usados pela app — o AuthContext usa ROLE_PERMISSIONS hardcoded em TypeScript |
| DB-06 | BAIXO | Tabela `historico_precos` existe mas nao tem UI nem service para consulta |

### 4.4 RLS (Row Level Security)

RLS esta configurado em 11 migrations com 301 ocorrencias de POLICY/ENABLE RLS. A migration 002 adiciona RLS granular para a maioria das tabelas. A migration 005 cobre buckets de storage.

**Problema:** Migration 006 (nao executada) continha 22 policies de RLS para as tabelas de orcamento. Como a migration nao foi executada, essas tabelas operam SEM RLS.

---

## 5. ANALISE DE SEGURANCA

### 5.1 Autenticacao

| Aspecto | Status | Nota |
|---|---|---|
| Supabase Auth | Implementado | Session-based com JWT |
| ProtectedRoute | Implementado | Redireciona para /login |
| Profile loading | Implementado | Busca na tabela profiles |
| Logout | Implementado | `supabase.auth.signOut()` |

**Problema de seguranca:**
- `effectiveRole = profile?.role ?? 'admin'` — Se o perfil nao tem role atribuido, o usuario recebe **acesso de admin**. Isso e intencional (conforme comentario "sem role = admin") mas e perigoso: qualquer usuario novo sem role configurado tem acesso total.

### 5.2 Autorizacao

| Aspecto | Status | Nota |
|---|---|---|
| PermissionGuard | Implementado | Apenas em rotas `/admin/*` |
| Filtragem de menu | Implementado | `filterNavByModules()` filtra itens de nav por role |
| `can()` function | Implementada | Verifica module + action |
| Server-side enforcement | **AUSENTE** | RLS apenas, sem verificacao de role no backend |

| ID | Severidade | Descricao |
|---|---|---|
| SEC-01 | ALTO | **Autorizacao apenas client-side**: PermissionGuard esconde UI mas nao impede acesso direto via URL. Um usuario "comercial" pode acessar `/admin/config` digitando a URL (o componente renderiza, RLS pode bloquear dados mas nao a pagina). |
| SEC-02 | ALTO | **Default admin para sem role**: Usuarios sem role no profile recebem permissao total |
| SEC-03 | MEDIO | Anon key exposta no CLAUDE.md (necessario para Supabase, mas deveria estar apenas em .env) |
| SEC-04 | MEDIO | `portal-upload.service.ts` envia Anon Key no header Authorization para Edge Functions — correto para Supabase, mas o patten expoe a key no JavaScript do cliente |
| SEC-05 | BAIXO | Sem rate limiting em endpoints publicos (/p/:token, Edge Functions) |

### 5.3 Validacao de Input

- Schemas Zod existem mas nem todos os formularios os usam
- Queries Supabase usam parametrizacao (seguro contra SQL injection)
- Sem sanitizacao de HTML/XSS em campos de texto livre (observacoes, descricao)

---

## 6. COMPARACAO COM ERPs REAIS

### 6.1 Funcionalidades Presentes

| Funcionalidade | Mubisys | Tiny ERP | Omie | Bling | Croma ERP |
|---|---|---|---|---|---|
| Cadastro de Clientes | Sim | Sim | Sim | Sim | **Sim** (307 registros) |
| Cadastro de Produtos | Sim | Sim | Sim | Sim | **Sim** (156 modelos) |
| Orcamentos | Sim | Sim | Sim | Sim | **Sim** (com motor de preco) |
| Pedidos de Venda | Sim | Sim | Sim | Sim | **Sim** |
| Ordem de Producao | Sim | Nao | Sim | Nao | **Sim** (kanban) |
| Estoque | Sim | Sim | Sim | Sim | **Sim** (basico) |
| Compras | Sim | Sim | Sim | Sim | **Sim** (basico) |
| Financeiro (contas) | Sim | Sim | Sim | Sim | **Sim** |
| NF-e | Nao | Sim | Sim | Sim | **Parcial** (rascunho, sem emissao real) |
| Boletos | Nao | Sim | Sim | Sim | **Sim** (CNAB 400 Itau) |
| CRM/Pipeline | Nao | Nao | Sim | Nao | **Sim** (completo) |
| Portal do Cliente | Nao | Nao | Nao | Nao | **Sim** (diferencial!) |
| App de Campo | Nao | Nao | Nao | Nao | **Sim** (PWA) |
| Motor Custeio Direto | Sim | Nao | Nao | Nao | **Sim** (replica Mubisys) |

### 6.2 Funcionalidades Ausentes (vs. ERPs profissionais)

| Funcionalidade | Prioridade | Justificativa |
|---|---|---|
| **Emissao real de NF-e** | CRITICA | Edge Functions de NF-e existem mas sem provider configurado. Sem isso, faturamento e manual. |
| **Retorno bancario CNAB** | ALTA | Tabelas prontas, falta parser de retorno + UI |
| **Contas a Pagar completo** | ALTA | Tabela existe, UI basica, falta fluxo de aprovacao |
| **Conciliacao bancaria real** | ALTA | Pagina existe mas sem integracao OFX/bancaria |
| **Relatorios exportaveis** | MEDIA | RelatoriosPage existe mas com dados mock |
| **Multi-empresa** | MEDIA | Sem suporte a CNPJ multiplos |
| **Controle de caixa** | MEDIA | Sem fluxo de caixa diario |
| **Integracao contabil** | MEDIA | DRE existe mas sem exportacao SPED/ECD |
| **Controle de frete** | BAIXA | Sem gestao de transportadoras |
| **Nota de servico (NFS-e)** | BAIXA | Apenas NF-e implementada |

### 6.3 Diferenciais Competitivos

O Croma ERP tem 3 funcionalidades que ERPs convencionais NAO possuem:
1. **Motor de custeio direto Mubisys** com 9 passos e simulacao de margem
2. **Portal do Cliente** com tracking comportamental (termometro de interesse)
3. **App de Campo PWA** para instaladores com fotos, assinaturas e checklists

---

## 7. ANALISE DE UX

### 7.1 Pontos Positivos
- Design system consistente com shadcn/ui
- Cor primaria blue-600 aplicada uniformemente
- Sidebar collapsible com tooltips
- Mobile bottom nav para paginas principais
- Command Palette (Ctrl+K) para navegacao rapida
- Breadcrumbs para orientacao
- Dashboard responsivo por role (admin, financeiro, producao, comercial)
- Badge de notificacao em orcamentos

### 7.2 Problemas Encontrados

| ID | Severidade | Descricao |
|---|---|---|
| UX-01 | ALTO | **Paginas gigantes sem paginacao**: AdminProdutosPage (2583 linhas), ComprasPage (2099 linhas), EstoquePage (1932 linhas), FinanceiroPage (1843 linhas). Deveriam ser decompostas em sub-componentes. |
| UX-02 | ALTO | **OrcamentoEditorPage (1202 linhas)**: Wizard de 3 etapas em componente monolitico. Dificil de manter e testar. |
| UX-03 | MEDIO | **Menu com 41 itens** e muito denso. Usuarios com role "admin" veem todos os 41 itens — sobrecarga cognitiva. |
| UX-04 | MEDIO | **Templates de orcamento**: Item "Templates" no menu aponta para rota inexistente `/orcamentos/templates` |
| UX-05 | MEDIO | **Icones faltantes no sidebar**: 7 icones referenciados no nav nao estao no ICON_MAP — caem no fallback LayoutDashboard, gerando confusao visual |
| UX-06 | MEDIO | **Falta confirmacao em acoes destrutivas**: Exclusao de orcamento/item faz soft delete mas sem dialog de confirmacao visivel |
| UX-07 | BAIXO | NotFound.tsx existe mas nao e usado — rota `*` redireciona silenciosamente para `/` |
| UX-08 | BAIXO | Pagina Settings esta em src/pages (legado) sem PermissionGuard |

---

## 8. TESTES

| Tipo | Quantidade | Cobertura |
|---|---|---|
| Unitarios | 1 arquivo (pricing-engine.test.ts) | Motor de preco apenas |
| Integracao | 0 | Nenhum |
| E2E | 0 | Nenhum |
| Visual/Snapshot | 0 | Nenhum |

**17 testes** no pricing-engine cobrindo:
- 3 testes de `calcPercentualFixo`
- 3 testes de `calcCustoPorMinuto`
- 1 teste de `calcPercentualVendas`
- 7 testes do motor completo
- 3 testes de invariantes de negocio
- 3 testes de `validarDesconto`

| ID | Severidade | Descricao |
|---|---|---|
| TEST-01 | ALTO | Cobertura de testes e ~0.02% (1 arquivo de 132). Zero testes para services, hooks, componentes. |
| TEST-02 | ALTO | Nenhum teste de integracao com Supabase |
| TEST-03 | MEDIO | Nenhum teste E2E para fluxos criticos (criar orcamento, converter pedido) |

---

## 9. BUGS ENCONTRADOS NO CODIGO

### Criticos

| ID | Arquivo | Descricao |
|---|---|---|
| BUG-01 | orcamento.service.ts | **Materiais/acabamentos de orcamento nunca salvos**: try/catch silencioso engole erro quando tabelas de migration 006 nao existem. Item salvo sem detalhamento. |
| BUG-02 | orcamento.service.ts:692 | **Race condition na numeracao de pedidos**: SELECT COUNT + INSERT nao-atomico pode gerar numeros duplicados |
| BUG-03 | OrcamentoEditorPage | **Orcamento com R$ 0,00**: Permite salvar item sem materiais, gerando preco zero |

### Altos

| ID | Arquivo | Descricao |
|---|---|---|
| BUG-04 | AuthContext.tsx:89 | **Default admin**: `profile?.role ?? 'admin'` da acesso total a usuarios sem role |
| BUG-05 | Layout.tsx | **7 icones de menu caem em fallback**: Calendar, Megaphone, Package2, ArrowLeftRight, Building, Layers, BarChart2 nao estao no ICON_MAP |
| BUG-06 | navigation.ts:37 | **Rota de Templates nao existe**: `/orcamentos/templates` no menu nao tem Route correspondente — clique leva para 404 (redirect para /) |
| BUG-07 | PedidoDetailPage.tsx:77-80 | **Cancelamento grava em observacoes**: Motivo do cancelamento concatenado em campo texto porque schema nao tem colunas proprias |

### Medios

| ID | Arquivo | Descricao |
|---|---|---|
| BUG-08 | orcamento.service.ts | 14 ocorrencias de `as any` — perda de type safety |
| BUG-09 | useOrcamentoPricing.ts:53-61 | `Record<string, unknown>` com 8 type assertions — fragil |
| BUG-10 | nfe-creation.service.ts:57 | `(item.modelo as any)?.ncm` — sem type safety no join |

---

## 10. MELHORIAS E RECOMENDACOES

### Prioridade CRITICA (fazer agora)

1. **Executar/corrigir migration 006**: Criar as tabelas `proposta_item_materiais`, `proposta_item_acabamentos`, `proposta_item_processos`, `proposta_servicos`, `acabamentos`, `servicos`, `regras_precificacao`. Sem isso, o modulo de orcamento opera com dados incompletos.

2. **Validar item de orcamento antes de salvar**: Impedir salvamento com materiais[] vazio e valor_total = 0.

3. **Corrigir numeracao de pedido**: Substituir SELECT COUNT + INSERT por RPC atomica ou SEQUENCE no banco.

### Prioridade ALTA

4. **Gerar tipos Supabase**: Executar `supabase gen types typescript` e importar em todo o projeto. Eliminar todos os `as any` e `as unknown as`.

5. **Implementar lazy loading nas rotas**: Usar `React.lazy()` em todas as 38 rotas protegidas. Economia estimada de 60-70% no bundle inicial.

6. **Adicionar ErrorBoundary no App.tsx**: Wrapping do `<Layout />` com `<ErrorBoundary>`.

7. **Corrigir default role para admin**: Alterar `profile?.role ?? 'admin'` para `profile?.role ?? 'comercial'` (role mais restritiva como default).

8. **Corrigir icones faltantes no ICON_MAP**: Adicionar Calendar, Megaphone, Package2, ArrowLeftRight, Building, Layers, BarChart2.

### Prioridade MEDIA

9. **Decompor paginas monoliticas**: AdminProdutosPage (2583 linhas), ComprasPage (2099 linhas), FinanceiroPage (1843 linhas) devem ser divididas em sub-componentes.

10. **Mover paginas legadas**: `src/pages/Produtos.tsx` -> `src/domains/producao/pages/`, `Settings.tsx` -> `src/domains/admin/pages/`.

11. **Adicionar PermissionGuard em todas as rotas admin**: `/settings` e `/relatorios` nao tem guard.

12. **Implementar validacao server-side de status**: Trigger ou RPC que valida transicoes permitidas.

13. **Adicionar colunas de cancelamento ao pedido**: `cancelado_em TIMESTAMPTZ`, `motivo_cancelamento TEXT`, `cancelado_por UUID`.

14. **Registrar rota de templates**: Criar Route para `/orcamentos/templates` ou remover do menu.

### Prioridade BAIXA

15. **Aumentar cobertura de testes**: Alvo minimo de 30% — priorizar services e hooks criticos.

16. **Substituir console.log por logging service**: Centralizar logs com niveis (debug, info, warn, error).

17. **Remover rota duplicada `/fiscal/emissao`**: E identica a `/fiscal/fila`.

18. **Implementar NotFoundPage**: Usar NotFound.tsx na rota `*` ao inves de redirect silencioso.

---

## 11. NOVAS FUNCIONALIDADES RECOMENDADAS

| # | Funcionalidade | Prioridade | Esforco | Impacto |
|---|---|---|---|---|
| 1 | Emissao real NF-e (integrar API gratuita) | CRITICA | Alto | Elimina dependencia de sistema fiscal externo |
| 2 | Parser CNAB 400 retorno (baixa de boletos) | ALTA | Medio | Automatiza conciliacao |
| 3 | Fluxo de aprovacao de pedidos com notificacao | ALTA | Medio | Governance financeira |
| 4 | Relatorios exportaveis (PDF/Excel) | MEDIA | Medio | Valor gerencial |
| 5 | Historico de versoes de orcamento | MEDIA | Medio | Schema existe (propostaVersaoSchema), falta implementar |
| 6 | Importacao de clientes via CSV/Excel | MEDIA | Baixo | Onboarding |
| 7 | Kanban de producao com drag-and-drop | MEDIA | Medio | Ja parcialmente implementado |
| 8 | Indicadores KPI em tempo real (websocket) | BAIXA | Alto | 3 hooks de realtime existem, expandir |
| 9 | Multi-moeda para clientes internacionais | BAIXA | Alto | Escopo futuro |
| 10 | API REST publica (webhook de integracoes) | BAIXA | Alto | Integracao com terceiros |

---

## 12. RESUMO DE CLASSIFICACAO

### Por Severidade

| Severidade | Quantidade | Itens Principais |
|---|---|---|
| **CRITICO** | 4 | Migration 006 pendente, Orcamento R$0, Race condition pedido, Sem NF-e real |
| **ALTO** | 11 | Sem lazy loading, ErrorBoundary nao usado, Default admin, Tipos nao gerados, Sem testes, Icones faltantes |
| **MEDIO** | 14 | Paginas monoliticas, Acabamentos fora do motor, Catch silencioso, Menu denso, Rota templates |
| **BAIXO** | 8 | Console.logs, Rota duplicada, NotFound nao usado, Namespace utils duplicado |

### Por Categoria

| Categoria | Critico | Alto | Medio | Baixo |
|---|---|---|---|---|
| Banco de Dados | 1 | 2 | 2 | 1 |
| Logica de Negocio | 2 | 1 | 2 | 1 |
| Arquitetura | 0 | 2 | 2 | 2 |
| Seguranca | 0 | 2 | 2 | 1 |
| UX | 0 | 2 | 4 | 2 |
| Testes | 0 | 2 | 1 | 0 |
| Performance | 0 | 1 | 0 | 0 |
| Funcionalidade | 1 | 0 | 1 | 1 |

---

## 13. CONCLUSAO

O Croma Print ERP/CRM e um sistema **surpreendentemente completo** para uma aplicacao custom, com 12 dominios cobrindo todo o fluxo Lead-to-Cash. A arquitetura de dominios e bem estruturada, o motor de precificacao Mubisys e profissional, e funcionalidades como Portal do Cliente e App de Campo sao diferenciais competitivos reais.

Os 3 problemas mais urgentes que devem ser resolvidos IMEDIATAMENTE sao:
1. **Executar migration 006** — sem ela, orcamentos perdem detalhamento de materiais
2. **Validar orcamentos com R$ 0** — impedir salvamento de itens vazios
3. **Atomizar numeracao de pedidos** — prevenir duplicatas

Com essas correcoes e a implementacao de lazy loading, geracao de tipos Supabase, e aumento da cobertura de testes, o sistema pode operar de forma profissional e confiavel em producao.

---

*Relatorio gerado em 2026-03-14 por Claude Opus 4.6*
