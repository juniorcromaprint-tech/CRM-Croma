# Auditoria UX/UI Completa -- Croma Print ERP/CRM

> **Data**: 2026-03-22
> **Auditor**: Claude Opus 4.6 (1M context)
> **Perspectiva**: Operador de 8h/dia em comunicacao visual
> **Escopo**: 74 rotas, 10 grupos de navegacao, ~154 arquivos TSX

---

## Score Geral: 7.4 / 10

| Dimensao | Score | Peso |
|---|---|---|
| Arquitetura de Informacao | 8.0 | 15% |
| Consistencia Visual | 7.5 | 20% |
| Qualidade de Formularios | 6.5 | 20% |
| Exibicao de Dados | 7.5 | 15% |
| Dashboard e KPIs | 9.0 | 15% |
| Usabilidade Operacional | 7.0 | 15% |

---

## 1. INVENTARIO COMPLETO DE MODULOS

### 1.1 Rotas Publicas (sem autenticacao)

| Rota | Componente | Funcao |
|---|---|---|
| `/login` | `shared/pages/LoginPage.tsx` | Login com email/senha |
| `/p/:token` | `domains/portal/pages/PortalOrcamentoPage.tsx` | Portal publico do orcamento para cliente |
| `/nps/:token` | `domains/portal/pages/NpsPage.tsx` | Pesquisa NPS pos-entrega |

### 1.2 Rotas Protegidas Especiais

| Rota | Componente | Funcao | Nav? |
|---|---|---|---|
| `/tv` | `domains/producao/pages/TvPage.tsx` | TV de producao (painel chao de fabrica) | Nao |

### 1.3 Rotas Protegidas -- Comercial (11 rotas)

| Rota | Componente | Nav? | Funcao |
|---|---|---|---|
| `/` (index) | `DashboardPage.tsx` | Sim | Dashboard principal (role-based) |
| `/leads` | `LeadsPage.tsx` | Sim | Listagem e gestao de leads |
| `/leads/:id` | `LeadDetailPage.tsx` | Nao | Detalhe do lead |
| `/pipeline` | `PipelinePage.tsx` | Sim | Kanban de oportunidades |
| `/orcamentos` | `OrcamentosPage.tsx` | Sim | Listagem de orcamentos |
| `/orcamentos/novo` | `OrcamentoEditorPage.tsx` | Nao | Editor de orcamento (novo) |
| `/orcamentos/:id` | `OrcamentoViewPage.tsx` | Nao | Visualizacao do orcamento |
| `/orcamentos/:id/editar` | `OrcamentoEditorPage.tsx` | Nao | Edicao de orcamento |
| `/propostas` | `PropostasPage.tsx` | Sim | Listagem de propostas |
| `/calendario` | `CalendarioPage.tsx` | Sim | Calendario unificado |
| `/campanhas` | `CampanhasPage.tsx` | Sim | Campanhas de email |
| `/contratos` | `ContratosPage.tsx` | Sim | Contratos de servico recorrente |

### 1.4 Rotas Protegidas -- Agente de Vendas (4 rotas)

| Rota | Componente | Nav? | Funcao |
|---|---|---|---|
| `/agente` | `AgentDashboardPage.tsx` | Sim | Dashboard do agente AI |
| `/agente/conversa/:id` | `AgentConversationPage.tsx` | Nao | Detalhe da conversa |
| `/agente/aprovacao` | `AgentApprovalPage.tsx` | Sim | Fila de aprovacao de orcamentos AI |
| `/agente/config` | `AgentConfigPage.tsx` | Sim | Configuracao do agente |

### 1.5 Rotas Protegidas -- Clientes (2 rotas)

| Rota | Componente | Nav? | Funcao |
|---|---|---|---|
| `/clientes` | `ClientesPage.tsx` | Sim | Listagem de clientes |
| `/clientes/:id` | `ClienteDetailPage.tsx` | Nao | Detalhe do cliente |

### 1.6 Rotas Protegidas -- Operacional (12 rotas)

| Rota | Componente | Nav? | Funcao |
|---|---|---|---|
| `/pedidos` | `PedidosPage.tsx` | Sim | Listagem de pedidos |
| `/pedidos/:id` | `PedidoDetailPage.tsx` | Nao | Detalhe do pedido |
| `/os/:pedidoId` | `OrdemServicoPage.tsx` | Nao | Ordem de servico do pedido |
| `/os/op/:opId` | `OrdemServicoOPPage.tsx` | Nao | OP individual |
| `/producao` | `ProducaoPage.tsx` | Sim | Dashboard de producao |
| `/expedicao` | `ExpedicaoPage.tsx` | Sim | Controle de expedicao |
| `/instalacoes` | `InstalacaoPage.tsx` | Sim | Gestao de instalacoes |
| `/almoxarife` | `AlmoxarifePage.tsx` | Sim | Separacao de materiais |
| `/producao/diario-bordo` | `DiarioBordoPage.tsx` | Sim | Log de producao |
| `/producao/pcp` | `PCPDashboardPage.tsx` | Sim | PCP com Gantt |
| `/producao/setor/:sectorId` | `SectorQueuePage.tsx` | Nao | Fila do setor |
| `/produtos` | `Produtos.tsx` (pages/) | Sim | Catalogo de produtos |

### 1.7 Rotas Protegidas -- Suprimentos (5 rotas + 2 redirects)

| Rota | Componente | Nav? | Funcao |
|---|---|---|---|
| `/compras` | Redirect -> `/compras/fornecedores` | Nao | -- |
| `/compras/fornecedores` | `FornecedoresPage.tsx` | Sim | Cadastro de fornecedores |
| `/compras/pedidos` | `PedidosCompraPage.tsx` | Sim | Pedidos de compra |
| `/compras/pedidos/:id` | `PedidoCompraDetailPage.tsx` | Nao | Detalhe do pedido de compra |
| `/estoque` | `EstoqueDashboardPage.tsx` | Sim | Dashboard de estoque |
| `/estoque/movimentacoes` | Redirect -> `/estoque?tab=movimentacoes` | Sim* | Alias via nav |
| `/estoque/inventario` | Redirect -> `/estoque?tab=inventario` | Sim* | Alias via nav |

### 1.8 Rotas Protegidas -- Qualidade (3 rotas)

| Rota | Componente | Nav? | Funcao |
|---|---|---|---|
| `/qualidade` | `QualidadeDashboardPage.tsx` | Sim | Dashboard de qualidade |
| `/qualidade/ocorrencias` | `OcorrenciasPage.tsx` | Sim | Listagem de ocorrencias |
| `/qualidade/ocorrencias/:id` | `OcorrenciaDetailPage.tsx` | Nao | Detalhe da ocorrencia |

### 1.9 Rotas Protegidas -- Financeiro (10 rotas)

| Rota | Componente | Nav? | Funcao |
|---|---|---|---|
| `/financeiro` | `FinanceiroPage.tsx` | Sim | Dashboard financeiro |
| `/dre` | `DrePage.tsx` | Sim | DRE gerencial |
| `/comissoes` | `ComissoesPage.tsx` | Sim | Gestao de comissoes |
| `/financeiro/faturamento` | `FaturamentoLotePage.tsx` | Sim | Faturamento em lote |
| `/financeiro/pedidos-a-faturar` | `PedidosAFaturarPage.tsx` | Sim | Fila de faturamento |
| `/financeiro/conciliacao` | `ConciliacaoPage.tsx` | Sim | Conciliacao bancaria |
| `/financeiro/boletos` | `BoletosPage.tsx` | Sim | Gestao de boletos |
| `/financeiro/config-bancaria` | `ConfigBancariaPage.tsx` | Sim | Config. bancaria |
| `/financeiro/fluxo-caixa` | `FluxoCaixaPage.tsx` | Sim | Fluxo de caixa |
| `/financeiro/retornos` | `RetornoUploadPage.tsx` | Sim | Upload retorno CNAB |

### 1.10 Rotas Protegidas -- Contabilidade (7 rotas)

| Rota | Componente | Nav? | Funcao |
|---|---|---|---|
| `/contabilidade` | `ContabilidadeDashboardPage.tsx` | Sim | Dashboard contabil |
| `/contabilidade/lancamentos` | `LancamentosPage.tsx` | Sim | Lancamentos contabeis |
| `/contabilidade/balancete` | `BalancetePage.tsx` | Sim | Balancete |
| `/contabilidade/razao` | `RazaoPage.tsx` | Sim | Razao contabil |
| `/contabilidade/das` | `DASPage.tsx` | Sim | DAS Simples Nacional |
| `/contabilidade/defis` | `DEFISPage.tsx` | Sim | DEFIS |
| `/contabilidade/extrato-bancario` | `ExtratoBancarioPage.tsx` | Sim | Import OFX |

### 1.11 Rotas Protegidas -- Fiscal (6 rotas)

| Rota | Componente | Nav? | Funcao |
|---|---|---|---|
| `/fiscal` | `FiscalDashboardPage.tsx` | Sim | Dashboard NF-e |
| `/fiscal/documentos` | `FiscalDocumentosPage.tsx` | Sim | Documentos fiscais |
| `/fiscal/fila` | `FiscalFilaPage.tsx` | Sim | Fila de emissao |
| `/fiscal/configuracao` | `FiscalConfiguracaoPage.tsx` | Sim | Config. fiscal |
| `/fiscal/certificado` | `FiscalCertificadoPage.tsx` | Sim | Certificado digital |
| `/fiscal/auditoria` | `FiscalAuditoriaPage.tsx` | Sim | Auditoria fiscal |

### 1.12 Rotas Protegidas -- Administracao (16 rotas)

| Rota | Componente | Nav? | Funcao |
|---|---|---|---|
| `/admin/empresa` | `EmpresaPage.tsx` | Sim | Dados da empresa |
| `/admin/usuarios` | `AdminUsuariosPage.tsx` | Sim | Gestao de usuarios |
| `/admin/config` | `AdminConfigPage.tsx` | Sim | Configuracoes do sistema |
| `/admin/produtos` | `AdminProdutosPage.tsx` | Nao | Admin de produtos |
| `/admin/auditoria` | `AdminAuditoriaPage.tsx` | Sim | Log de auditoria |
| `/admin/setup` | `AdminSetupPage.tsx` | Nao | Setup inicial |
| `/admin/centros-custo` | `AdminCentrosCustoPage.tsx` | Sim* | Centros de custo |
| `/admin/plano-contas` | `AdminPlanoContasPage.tsx` | Sim* | Plano de contas |
| `/admin/materiais` | `AdminMateriaisPage.tsx` | Sim | Materia prima |
| `/admin/maquinas` | `AdminMaquinasPage.tsx` | Sim | Maquinas e equipamentos |
| `/admin/precificacao` | `AdminPrecificacaoPage.tsx` | Sim | Regras de precificacao |
| `/admin/dados` | `DadosHubPage.tsx` | Sim | Gestao de dados (import/export) |
| `/admin/dados/historico` | `ImportHistoricoPage.tsx` | Nao | Historico de importacoes |
| `/admin/catalogo` | `CatalogoProdutosPage.tsx` | Nao | Catalogo de produtos |
| `/admin/webhooks` | `WebhooksPage.tsx` | Sim | Webhooks |
| `/admin/avisos` | `AdminAvisosPage.tsx` | Sim | Quadro de avisos |
| `/relatorios` | `RelatoriosPage.tsx` | Sim | Relatorios exportaveis |
| `/settings` | `Settings.tsx` (pages/) | Nao** | Configuracoes do usuario |

**Notas**:
- *Sim**: Centros de Custo e Plano de Contas aparecem no grupo FINANCEIRO, nao em ADMINISTRACAO
- **Settings: Acessivel via link no user section do sidebar, nao via nav group

**TOTAL: 74 rotas registradas** (3 publicas + 1 especial + 70 protegidas)

---

## 2. NAVEGACAO E ARQUITETURA DE INFORMACAO

### 2.1 Estrutura do Menu (10 grupos, 55 itens)

| Grupo | Itens | Observacao |
|---|---|---|
| PAINEL | 1 | Dashboard -- sempre visivel |
| COMERCIAL | 8 | Leads, Pipeline, Clientes, Orcamentos, Propostas, Calendario, Campanhas, Contratos |
| AGENTE DE VENDAS | 3 | Agente, Aprovacao, Config. Agente |
| OPERACIONAL | 7 | Pedidos, Producao, Expedicao, Instalacoes, Almoxarife, Diario, PCP |
| SUPRIMENTOS | 7 | Fornecedores, Ped. Compra, Estoque, Movimentacoes, Inventario, Produtos, Materia Prima |
| FINANCEIRO | 12 | Financeiro, DRE, Comissoes, Ped. Faturar, Fat. Lote, Conciliacao, Boletos, Config Bancaria, Fluxo Caixa, Retornos, Centros Custo, Plano Contas |
| CONTABILIDADE | 7 | Dashboard, DAS, Extrato, Lancamentos, Balancete, Razao, DEFIS |
| QUALIDADE | 2 | Dashboard, Ocorrencias |
| FISCAL | 6 | NF-e Dashboard, Documentos, Fila, Configuracao, Certificado, Auditoria |
| ADMINISTRACAO | 10 | Empresa, Usuarios, Config, Precificacao, Maquinas, Auditoria, Gestao Dados, Webhooks, Avisos, Relatorios |

### 2.2 Problemas Encontrados

| ID | Severidade | Problema | Detalhe |
|---|---|---|---|
| NAV-01 | MEDIA | Icone "Webhook" nao mapeado no ICON_MAP | `navigation.ts` define `icon: 'Webhook'` mas `Layout.tsx` nao importa `Webhook` do lucide-react. Resultado: fallback para `LayoutDashboard` no nav. |
| NAV-02 | BAIXA | Grupo FINANCEIRO com 12 itens | Excessivo para accordion. Centros de Custo e Plano de Contas sao admin, nao financeiro operacional. |
| NAV-03 | BAIXA | Movimentacoes e Inventario sao redirects | Nav mostra como itens separados mas redirecionam para tabs de `/estoque`. Confuso porque parecem paginas independentes. |
| NAV-04 | BAIXA | `/admin/produtos`, `/admin/setup`, `/admin/catalogo` sem nav | Acessiveis apenas via URL direta ou links internos. Setup deveria ter link visivel para admin. |
| NAV-05 | BAIXA | Command Palette referencia `/orcamentos/templates` | Rota nao existe no router. Resulta em redirect para `/`. |
| NAV-06 | INFO | Ocorrencias na nav aponta para `/qualidade/ocorrencias` mas MetricPill do dashboard aponta para `/ocorrencias` | `/ocorrencias` nao tem rota definida -- resulta em redirect para dashboard. |
| NAV-07 | INFO | Agente de Vendas sem PermissionGuard | As 4 rotas de `/agente/*` nao usam PermissionGuard. Qualquer usuario autenticado acessa. |

### 2.3 Pontos Positivos

- Accordion sidebar com persistencia no localStorage
- Modo collapsed com tooltips
- Auto-expand do grupo da rota ativa
- Command Palette (Ctrl+K) com navegacao rapida
- Breadcrumbs automaticos
- Mobile: Sheet navigation + bottom nav com 4 itens
- Filtro por modules/roles via `filterNavByModules`
- Logo da empresa dinamica via `useEmpresaPrincipal`

---

## 3. CONSISTENCIA VISUAL

### 3.1 Design Tokens

| Token | Padrao (CLAUDE.md) | Contagem | Conformidade |
|---|---|---|---|
| Cards: `rounded-2xl` | Obrigatorio | 429 usos em 132 arquivos | ALTO |
| Inputs: `rounded-xl` | Obrigatorio | 899 usos em 154 arquivos | ALTO |
| `rounded-lg` | Deveria ser raro | 209 usos em 75 arquivos | MEDIO -- usado em sub-elementos, aceitavel |
| `rounded-md` | Deveria ser raro | 47 usos em 24 arquivos | OK -- maioria em componentes UI base (shadcn) |
| Cor primaria: `bg-blue-600` | Obrigatorio | 184 usos em 81 arquivos | ALTO |
| `bg-blue-500` (inconsistente) | Deveria ser 600 | 14 usos em 11 arquivos | DESVIO MENOR |

### 3.2 Problemas de Consistencia

| ID | Severidade | Problema |
|---|---|---|
| UI-01 | MEDIA | 14 usos de `bg-blue-500` quando padrao e `bg-blue-600` -- PipelinePage, CalendarioPage, CampanhasPage, entre outros |
| UI-02 | BAIXA | Dashboard usa gradients (`bg-gradient-to-br from-emerald-500`) nos Hero KPIs enquanto resto do sistema usa flat cards. Justificavel por hierarquia visual. |
| UI-03 | BAIXA | `Produtos.tsx` esta em `src/pages/` em vez de `src/domains/`. Unico arquivo legacy fora da estrutura de dominios. |
| UI-04 | BAIXA | `Settings.tsx` tambem em `src/pages/` -- deveria estar em `domains/admin/pages/`. |

### 3.3 Loading States

| Padrao | Contagem | Cobertura |
|---|---|---|
| Skeleton (animate-pulse divs) | 149 usos em 27 paginas | BOM |
| `Loader2` spinner | 325 usos em 96 arquivos | EXCELENTE |
| `isLoading`/`isPending` checks | 730 usos em 123 arquivos | EXCELENTE |
| KpiCard tem loading prop | Sim | BOM |

### 3.4 Empty States

- **203 ocorrencias** de textos de estado vazio ("Nenhum", "Sem dados", etc.) em 108 arquivos
- Padrao consistente: icone + titulo + descricao + acao sugerida
- ErrorBoundary global com design correto (`rounded-2xl`, `bg-white`)
- PermissionGuard com tela de acesso negado bem desenhada

### 3.5 Toast / Feedback

| Padrao | Uso |
|---|---|
| `showSuccess()` / `showError()` | 685 usos em 104 arquivos |
| `toast.warning()` direto | 4 usos em 3 arquivos |

A norma e usar `showSuccess/showError` do `utils/toast.ts`. Porem, `toast.warning()` e chamado diretamente em `ProducaoPage.tsx` e `DashboardPage.tsx`. Desvio menor, pois `showWarning` nao existe no wrapper.

---

## 4. QUALIDADE DE FORMULARIOS

### 4.1 Abordagem de Formularios

| Tipo | Quantidade | Observacao |
|---|---|---|
| React Hook Form + Zod | 5 formularios (BankAccountForm, BoletoFormDialog, FornecedorForm, AvisoFormDialog, componente ui/form) | MELHOR PRATICA |
| Zod schemas (sem RHF) | 78 usos em 24 arquivos (schemas/, validators/) | Validacao no import engine |
| Formularios com `useState` inline | ~50+ formularios | MAIORIA -- sem validacao formal de frontend |

### 4.2 Problemas

| ID | Severidade | Problema |
|---|---|---|
| FORM-01 | ALTA | Maioria dos formularios usa `useState` sem validacao Zod no frontend. Erros so aparecem apos submit (toast). Nao ha inline validation em campos como CNPJ, email, telefone nos formularios de clientes, leads, pedidos de compra. |
| FORM-02 | MEDIA | Apenas 5 formularios usam React Hook Form. Formularios grandes como OrcamentoEditorPage, ClienteDetailPage, LeadDetailPage, PedidosPage usam state manual. |
| FORM-03 | MEDIA | Indicadores de campo obrigatorio (`*`) nao padronizados. Alguns formularios mostram, outros nao. |
| FORM-04 | BAIXA | Cancel/Discard: a maioria dos dialogs tem botao "Cancelar" que fecha sem perguntar sobre alteracoes nao salvas. |

### 4.3 Pontos Positivos

- CEP lookup automatico (hook `useCepLookup`)
- CNPJ lookup automatico (hook `useCnpjLookup`)
- Mascaras de telefone (`maskPhone`)
- Formatacao BRL nos inputs de valor
- Loading state nos botoes de submit (Loader2 icon)

---

## 5. EXIBICAO DE DADOS

### 5.1 Tabelas e Listagens

| Feature | Presente? | Onde |
|---|---|---|
| Paginacao server-side | Sim | EstoqueDashboardPage (DataTable), PedidosPage |
| Paginacao client-side | Sim | Maioria das listagens |
| Busca/filtro | Sim | Todas as listagens principais |
| Ordenacao | Parcial | Algumas tabelas, nao universal |
| Formatacao BRL | Sim | `brl()` de `format.ts` usado consistentemente |
| Formatacao de datas | Sim | `formatDate()`, `formatDateTime()`, `formatDateRelative()` |
| Tooltips em conteudo truncado | Parcial | Alguns usam `truncate()`, poucos com tooltip real |
| Export (Excel/PDF) | Sim | RelatoriosPage, DRE, varios |

### 5.2 Problemas

| ID | Severidade | Problema |
|---|---|---|
| DATA-01 | MEDIA | DataTable (estoque/UsinagemTab) e unico lugar com componente DataTable formal. Outras tabelas sao `<table>` manual ou divs. Inconsistente. |
| DATA-02 | BAIXA | Ordenacao de colunas nao universal. Pedidos e Leads permitem, mas Fornecedores e Orcamentos nao tem. |
| DATA-03 | BAIXA | Conteudo truncado sem tooltip em varias tabelas -- nomes de clientes longos ficam cortados sem forma de ver completo. |

---

## 6. DASHBOARD E KPIs -- ANALISE DE DADOS REAIS vs MOCK

### 6.1 Veredicto: NENHUM DADO MOCK ENCONTRADO

Todos os dashboards buscam dados reais do Supabase:

| Hook | Tabelas consultadas | Status |
|---|---|---|
| `useDashComercial` | clientes, leads, propostas | REAL |
| `useDashPedidos` | pedidos | REAL |
| `useDashProducao` | ordens_producao | REAL |
| `useDashFinanceiro` | contas_receber, contas_pagar | REAL |
| `useDashInstalacoes` | ordens_instalacao | REAL |
| `useDashEstoque` | estoque_saldos + materiais | REAL |
| `useDashQualidade` | ocorrencias | REAL |
| `useFunnelStats` | leads + propostas + pedidos (3 meses) | REAL |
| `useDashNPS` | nps_respostas | REAL |
| Recent Leads | leads (limit 5) | REAL |
| Recent Pedidos | pedidos (limit 5) | REAL |
| MRR | contratos_servico (ativos) | REAL |
| Receita Projetada | pedidos em andamento (valor_total) | REAL |

### 6.2 Dashboards por Role

| Role | Dashboard | Qualidade |
|---|---|---|
| admin/diretor | DashboardDiretor | Completo: 4 Hero KPIs, 6 MetricPills, StatusBar, Activity Feed, Financeiro, Producao, NPS, Funil, MRR |
| comercial | DashboardComercial | Focado em pipeline e leads |
| financeiro | DashboardFinanceiro | Focado em contas e fluxo |
| producao | DashboardProducao | Focado em OPs e producao |

### 6.3 Links dos KPIs

Todos os Hero KPIs e MetricPills tem prop `to=` linkando para suas paginas de detalhe. **Excelente drill-down.**

---

## 7. USABILIDADE OPERACIONAL

### 7.1 Acessibilidade

| Aspecto | Status | Contagem |
|---|---|---|
| `aria-label` | 29 usos em 20 arquivos | BASICO |
| `div onClick` (sem role=button) | 0 ocorrencias | EXCELENTE |
| `onKeyDown` support | 29 usos | BASICO |
| Teclado: Ctrl+K (busca) | Sim | BOM |
| Skip-nav | Nao | AUSENTE |
| Focus visible rings | Via Tailwind default | OK |

### 7.2 Responsividade

| Aspecto | Status |
|---|---|
| Layout responsivo | Sim -- flex-col md:flex-row |
| Mobile sidebar via Sheet | Sim |
| Bottom nav mobile (4 itens + Settings) | Sim |
| Print support | Sim -- 37 regras @media print em 12 arquivos. Layout esconde nav, DRE/OrcamentoView tem estilos de impressao |
| `pb-safe` para notch iOS | Sim (bottom nav) |

### 7.3 Quick Actions (clicks para tarefas comuns)

| Tarefa | Clicks | Observacao |
|---|---|---|
| Novo Lead | 1 (Quick Action no dashboard) | BOM |
| Novo Orcamento | 1-2 (Quick Action ou nav > Orcamentos > botao) | BOM |
| Novo Pedido | 2-3 (nav > Pedidos > botao) | OK |
| Ver financeiro | 1 (click no Hero KPI) | EXCELENTE |
| Buscar qualquer coisa | 1 (Ctrl+K) | EXCELENTE |
| Ver pedido em atraso | 2 (dashboard alert > pedidos) | BOM |

### 7.4 Problemas

| ID | Severidade | Problema |
|---|---|---|
| OP-01 | MEDIA | Grupo FINANCEIRO com 12 itens no sidebar. Operador financeiro precisa scrollar dentro do accordion para encontrar funcoes. |
| OP-02 | MEDIA | `/settings` requer permissao `admin.ver` -- operadores nao-admin nao conseguem trocar propria senha ou configurar perfil. |
| OP-03 | BAIXA | Command Palette nao inclui itens do Fiscal, Contabilidade e Agente. Busca limitada. |
| OP-04 | BAIXA | Sem atalhos de teclado alem de Ctrl+K. Operadores de 8h se beneficiariam de: N = novo, E = editar, Esc = voltar. |
| OP-05 | INFO | Bottom nav mobile mostra apenas 4 itens (Dashboard, Leads, Pipeline, Clientes) + Settings. Operadores de producao/financeiro nao tem acesso rapido mobile. |

---

## 8. SUMARIO DE ISSUES POR SEVERIDADE

### ALTA (1)

| ID | Area | Descricao |
|---|---|---|
| FORM-01 | Formularios | Maioria dos forms sem validacao inline. Erros so apos submit. |

### MEDIA (8)

| ID | Area | Descricao |
|---|---|---|
| NAV-01 | Navegacao | Icone Webhook nao mapeado no Layout.tsx ICON_MAP |
| NAV-06 | Navegacao | MetricPill "Ocorrencias" aponta para `/ocorrencias` (rota inexistente) |
| UI-01 | Consistencia | 14 usos de `bg-blue-500` em vez de `bg-blue-600` |
| FORM-02 | Formularios | Apenas 5/50+ forms usam React Hook Form |
| FORM-03 | Formularios | Indicador de campo obrigatorio nao padronizado |
| DATA-01 | Dados | DataTable formal existe em apenas 2 lugares |
| OP-01 | Usabilidade | Financeiro tem 12 itens no accordion |
| OP-02 | Usabilidade | `/settings` bloqueado para nao-admins |

### BAIXA (11)

| ID | Area | Descricao |
|---|---|---|
| NAV-02 | Navegacao | Grupo FINANCEIRO superlotado |
| NAV-03 | Navegacao | Redirects enganosos (Movimentacoes, Inventario) |
| NAV-04 | Navegacao | 3 paginas admin sem nav entry |
| NAV-05 | Navegacao | Command Palette referencia rota inexistente |
| UI-03 | Consistencia | `Produtos.tsx` fora da estrutura de dominios |
| UI-04 | Consistencia | `Settings.tsx` fora da estrutura de dominios |
| FORM-04 | Formularios | Sem confirmacao de "discard changes" |
| DATA-02 | Dados | Ordenacao de colunas nao universal |
| DATA-03 | Dados | Truncamento sem tooltip |
| OP-03 | Usabilidade | Command Palette incompleta |
| OP-04 | Usabilidade | Sem keyboard shortcuts alem de Ctrl+K |

### INFO (3)

| ID | Area | Descricao |
|---|---|---|
| NAV-07 | Seguranca | Agente de Vendas sem PermissionGuard |
| OP-05 | Mobile | Bottom nav nao atende roles operacionais |
| -- | Toast | 4 usos de `toast.warning()` direto (sem wrapper) |

---

## 9. RECOMENDACOES PRIORITARIAS

### 9.1 Quick Wins (1-2 horas cada)

1. **Adicionar `Webhook` ao ICON_MAP** em Layout.tsx (NAV-01) -- 1 linha
2. **Corrigir link de Ocorrencias** no DashboardDiretor: `/ocorrencias` -> `/qualidade/ocorrencias` (NAV-06)
3. **Remover `/orcamentos/templates` do CommandPalette** (NAV-05)
4. **Padronizar `bg-blue-500` para `bg-blue-600`** nos 11 arquivos afetados (UI-01)
5. **Adicionar PermissionGuard** nas 4 rotas de `/agente/*` (NAV-07)
6. **Separar `/settings` em "perfil"** acessivel a todos (trocar senha, avatar) vs "sistema" admin-only (OP-02)

### 9.2 Melhorias Estruturais (1-2 dias)

7. **Criar componente `DataTable` reutilizavel** baseado no do Estoque. Aplicar em PedidosPage, ClientesPage, LeadsPage, FornecedoresPage.
8. **Adicionar React Hook Form + Zod** nos 5 formularios mais usados: Lead, Cliente, Orcamento, Pedido de Compra, Ocorrencia.
9. **Reorganizar Financeiro** no nav: mover Centros de Custo e Plano de Contas para ADMINISTRACAO; agrupar sub-itens (Faturamento: Pedidos a Faturar + Lote; Bancario: Boletos + Retornos + Config).
10. **Adicionar Command Palette completa** com itens de Fiscal, Contabilidade e Agente.

### 9.3 Melhorias de Longo Prazo

11. **Inline validation** em todos os formularios (FORM-01)
12. **Keyboard shortcuts** para operacoes frequentes
13. **Unsaved changes guard** (`beforeunload` + dialog)
14. **Tooltips em conteudo truncado** (DATA-03)
15. **Mobile bottom nav dinamico** baseado no role do usuario (OP-05)
16. **Mover `Produtos.tsx` e `Settings.tsx`** para estrutura de dominios

---

## 10. CONCLUSAO

O sistema Croma Print ERP/CRM esta em um nivel de maturidade **BOM** para uso diario. Os pontos fortes sao:

- **Zero dados mock** -- todos os dashboards e KPIs usam dados reais do Supabase
- **Dashboard role-based** com drill-down em todos os KPIs
- **Cobertura de loading states** excelente (730+ checks)
- **Empty states** em 108 arquivos com padrao consistente
- **Design system** bem seguido (rounded-2xl cards, blue-600 primary)
- **Command Palette** para navegacao rapida
- **Accordion sidebar** com persistencia
- **Print/export** em modulos financeiros

Os pontos de atencao para operacao de 8h/dia:

- **Formularios sem validacao inline** e o maior gap de UX. Operadores perdem tempo preenchendo tudo para so descobrir erros apos submit.
- **Navegacao financeira muito densa** com 12 itens.
- **Settings inacessivel para nao-admins** bloqueia troca de senha.
- **1 icone quebrado** e **1 link morto** no dashboard principal.

> Score final: **7.4/10** -- Sistema usavel e funcional, com gaps concentrados em validacao de formularios e refinamentos de navegacao.
