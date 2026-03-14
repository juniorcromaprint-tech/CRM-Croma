# RELATÓRIO CONSOLIDADO — AUDITORIA EXTREMA DO ERP CROMA PRINT

> **Data**: 2026-03-14 | **Modelo**: Claude Opus 4.6
> **4 agentes executados em paralelo** | **Cobertura**: 10 blocos completos
> **Tempo total de análise**: ~30 min (4 agentes × ~8 min cada)

---

## 1. RESUMO EXECUTIVO

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VEREDITO FINAL: PARCIALMENTE APTO PARA PRODUÇÃO
  RISCO GERAL: ALTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Problemas únicos encontrados (deduplicados):

    🔴 CRÍTICO:  14
    🟠 ALTO:     22
    🟡 MÉDIO:    18
    🟢 BAIXO:    12
    ─────────────────
    TOTAL:       66 problemas únicos

  Taxa de sucesso do fluxo E2E: 47% (8/17 passos sem bloqueador)

  O QUE FUNCIONA BEM:
  ✅ Auth real via Supabase (ProtectedRoute em todas as rotas internas)
  ✅ Motor de precificação Mubisys (9 passos, correto)
  ✅ Portal do cliente (/p/:token) com aprovação
  ✅ Boletos CNAB 400 Itaú com transições robustas
  ✅ Kanban de produção 5 etapas + retrabalho
  ✅ 467 materiais + 156 modelos + 896 modelo_materiais + 912 modelo_processos
  ✅ nfe-service com todos endpoints protegidos por NFE_INTERNAL_SECRET
  ✅ Nenhum service_role_key exposto no frontend

  O QUE IMPEDE PRODUÇÃO:
  ❌ 80 tabelas sem RLS — qualquer autenticado acessa tudo
  ❌ 3 Edge Functions sem auth — abuso de email/OneDrive possível
  ❌ Zero lock otimista — sobrescrita silenciosa entre usuários
  ❌ Orçamento aprovado pode ser editado livremente
  ❌ Boleto aceita vencimento no passado e cobrança duplicada
  ❌ 78 FKs sem índice — JOINs fazem sequential scan
  ❌ N+1 query no orçamento (3 + 2*N queries por visualização)
  ❌ 1 arquivo de teste em 71.888 linhas de código
```

---

## 2. MATRIZ DE FALHAS (66 problemas deduplicados)

### 🔴 CRÍTICOS (14)

| ID | Título | Módulo | Arquivo(s) | Impacto | Sprint |
|---|---|---|---|---|---|
| C-01 | 80 tabelas sem RLS | Segurança/DB | Banco Supabase | Qualquer autenticado lê custos, margens, dados financeiros | 1 |
| C-02 | 3 Edge Functions sem auth de usuário | Segurança | enviar-email-proposta, onedrive-criar-pasta, onedrive-upload-proposta | Abuso de email, acesso OneDrive sem login | 1 |
| C-03 | N+1 query no buscarPorId do orçamento | Performance | orcamento.service.ts L281-307 | 3+2*N queries por visualização (10 itens = 23 queries) | 1 |
| C-04 | 8 propostas ativas com total R$ 0,00 | Integridade | propostas (banco) | Proposta aprovada/enviada com R$ 0,00 | 1 |
| C-05 | Campos críticos nullable (status, valor_total, quantidade) | Modelagem | pedidos, propostas, pedido_itens, ordens_producao | Dados inconsistentes, NULL safety em todo frontend | 1 |
| C-06 | 78 Foreign Keys sem índice | Performance/DB | 40+ tabelas | JOINs e cascades fazem sequential scan | 1 |
| C-07 | Apenas 1 arquivo de teste (71.888 linhas de código) | Qualidade | pricing-engine.test.ts único | Regressões não detectadas, refatoração impossível | 2 |
| C-08 | Orçamento aprovado pode ser editado sem restrição | Regra de Negócio | orcamento.service.ts L352-370 | Quebra de integridade contratual pós-aprovação | 1 |
| C-09 | gerarContasReceber com .catch silencioso | Financeiro | PedidoDetailPage.tsx L81 | Pedido concluído sem cobrança, receita perdida | 1 |
| C-10 | Math.random() para números de OP e OS | Produção/Instalação | producao.service.ts, instalacao-criacao.service.ts | Colisão de números, OPs duplicadas | 1 |
| C-11 | Pedido avança status sem validar pré-condições | Fluxo | PedidoDetailPage.tsx L73-85 | Pedido "concluído" sem OP, NF-e ou pagamento | 1 |
| C-12 | BOM vazia aceita silenciosamente no editor | Orçamentos | OrcamentoEditorPage.tsx | Item salvo com R$ 0,00 sem alerta | 1 |
| C-13 | Boleto aceita vencimento no passado | Financeiro | bankSlipCreateSchema | Rejeição bancária em lote CNAB | 1 |
| C-14 | Duplicidade de cobrança (boleto) sem check | Financeiro | boleto.service.ts | Cliente cobrado em duplicidade | 1 |

### 🟠 ALTOS (22)

| ID | Título | Módulo | Sprint |
|---|---|---|---|
| A-01 | Rotas /admin/* sem PermissionGuard | Segurança | 1 |
| A-02 | URL antiga (tender-archimedes) no fallback de email | Edge Functions | 1 |
| A-03 | Ações destrutivas sem confirmação (excluir regra, template) | UX | 1 |
| A-04 | Orçamento recusado pode virar pedido (converterParaPedido não valida status) | Regra de Negócio | 1 |
| A-05 | Duplicação de OP/contas (sem idempotência em inserts) | Concorrência | 1 |
| A-06 | Pedidos cancelados somam no total do dashboard | Financeiro | 1 |
| A-07 | Conversão Lead→Cliente sem validar CNPJ, sem migrar todos dados | CRM | 1 |
| A-08 | Quantidade 0 ou negativa aceita no orçamento | Orçamentos | 1 |
| A-09 | Rota /tv pública sem auth (dados produção expostos) | Segurança | 1 |
| A-10 | 6 arquivos monolíticos com 1500+ linhas | Arquitetura | 2 |
| A-11 | 279 usos de `any` (types Supabase desatualizados) | Código | 2 |
| A-12 | Lógica de negócio direto nos componentes (8/12 domínios) | Arquitetura | 2 |
| A-13 | Zod usado em apenas 2 de ~20 formulários | Validação | 2 |
| A-14 | NF-e cria rascunho sem itens/impostos | Fiscal | 2 |
| A-15 | Custo real = custo estimado (sem apontamento real) | Produção | 2 |
| A-16 | Sem fluxo de cancelamento de pedido em produção | Pedidos | 2 |
| A-17 | Sem painel "pedidos a faturar" dedicado | Financeiro | 2 |
| A-18 | Aprovação portal não gera pedido automaticamente | Comercial | 2 |
| A-19 | Dashboard produção faz 8 queries COUNT separadas | Performance | 1 |
| A-20 | Hooks sem staleTime explícito (refetch excessivo) | Performance | 2 |
| A-21 | RLS policy de bypass total em anexos | Segurança | 2 |
| A-22 | Sem detecção de leads duplicados | CRM | 2 |

### 🟡 MÉDIOS (18)

| ID | Título | Sprint |
|---|---|---|
| M-01 | CORS wildcard em todas Edge Functions | 2 |
| M-02 | Sem paginação em listagens (Clientes, Leads, Pedidos) | 2 |
| M-03 | Botões sem loading state na maioria dos formulários | 2 |
| M-04 | window.confirm nativo em 4 locais (inconsistente) | 3 |
| M-05 | Estoque não debitado ao concluir produção | 3 |
| M-06 | area_m2 não calculada automaticamente no banco | 3 |
| M-07 | OP não exibe lista de materiais necessários (BOM × qty) | 2 |
| M-08 | NF-e sem cálculo de impostos (ICMS, PIS, COFINS) | 2 |
| M-09 | Materiais/acabamentos silenciados (migration 006 pendente) | 2 |
| M-10 | OP número random (colisão possível) — reforço de C-10 | 1 |
| M-11 | Search com ilike sem sanitização em filtros | 2 |
| M-12 | 40+ queries com .select('*') | 3 |
| M-13 | registros_auditoria cresce sem política de retenção | 3 |
| M-14 | Dois triggers de numeração em propostas (conflito) | 2 |
| M-15 | Kanban drag-and-drop sem confirmação de mudança de status | 3 |
| M-16 | Portal sem exibir validade do orçamento | 3 |
| M-17 | Upload de certificado .pfx sem validação de tamanho | 3 |
| M-18 | Rota admin/auditoria renderiza AdminUsuariosPage (componente errado) | 3 |

### 🟢 BAIXOS (12)

| ID | Título | Sprint |
|---|---|---|
| B-01 | 10 páginas dead code (~6.700 linhas) | 3 |
| B-02 | Páginas duplicadas entre src/pages e src/domains | 3 |
| B-03 | TEMP_CONFIG duplicado em 3 arquivos | 4 |
| B-04 | 35 console.log em produção | 4 |
| B-05 | made-with-dyad.tsx morto | 4 |
| B-06 | updated_at manual no frontend (redundante com trigger) | 3 |
| B-07 | Sem campo "próximo_contato" no form de lead | 4 |
| B-08 | Sem filtro por máquina no kanban | 4 |
| B-09 | Sem dashboard financeiro KPIs (DRE) | 3 |
| B-10 | Portal sem opção de solicitar alteração | 4 |
| B-11 | Sem log de auditoria visível no admin | 4 |
| B-12 | dangerouslySetInnerHTML com CSS estático (baixo risco) | 4 |

---

## 3. GARGALOS DE PERFORMANCE (ranqueados)

| # | Gargalo | Impacto | Causa | Correção | Esforço |
|---|---|---|---|---|---|
| 1 | N+1 no orcamento.service.ts | 3+2*N queries/view | Loop de Promise.all por item | Nested select Supabase | 1h |
| 2 | Dashboard produção 8 queries | 240 queries/h/usuário | 8 COUNT separados | Consolidar em 1 query | 1h |
| 3 | 78 FKs sem índice | Sequential scan em JOINs | Migrations não criaram índices | CREATE INDEX (14 prioritários) | 30min |
| 4 | useClientes/useLeads sem paginação | Payload cresce linearmente | .select('*') sem .range() | Implementar .range() | 3h |
| 5 | 40+ queries com .select('*') | Payload inflado | Falta de seleção de colunas | Selecionar colunas necessárias | 3h |
| 6 | Stats hooks sem staleTime | Refetch a cada mount | TanStack Query default 0ms | Adicionar staleTime: 5min | 1h |

---

## 4. FALHAS DE SEGURANÇA

| # | Vulnerabilidade | Risco | Evidência | Correção | Sprint |
|---|---|---|---|---|---|
| 1 | 80 tabelas sem RLS | CRÍTICO | Query pg_tables (RLS-01) | Habilitar RLS + policies por role | 1 |
| 2 | 3 Edge Functions sem auth | CRÍTICO | Código fonte (SEC-01) | Validar JWT do usuário | 1 |
| 3 | Rotas admin sem PermissionGuard | ALTO | adminRoutes.tsx (SEC-04) | Envolver com PermissionGuard | 1 |
| 4 | /tv pública (dados produção) | ALTO | App.tsx L59 | Adicionar auth por token | 1 |
| 5 | URL antiga no email | ALTO | enviar-email-proposta L33 | Alterar fallback | 1 |
| 6 | CORS wildcard | MÉDIO | Todas Edge Functions | Restringir origins | 2 |
| 7 | Policy bypass em anexos | ALTO | pg_policies (RLS-02) | Restringir por role | 2 |
| 8 | resolve-geo sem rate limiting | MÉDIO | Edge Function | Rate limit ou auth | 3 |

---

## 5. PROBLEMAS DE UX E OPERAÇÃO

| # | Problema | Impacto | Melhoria | Sprint |
|---|---|---|---|---|
| 1 | Excluir regra/template sem confirmação | Perda de dados por clique acidental | AlertDialog | 1 |
| 2 | Botões sem loading state | Double-click → duplicação | disabled + Loader2 | 2 |
| 3 | Sem paginação em listagens | Lentidão com crescimento | Pagination shadcn/ui | 2 |
| 4 | window.confirm nativo (inconsistente) | UX feia e inconsistente | AlertDialog padronizado | 3 |
| 5 | Wizard orçamento sem feedback BOM vazia | Item R$ 0,00 sem aviso | Alerta amarelo | 1 |
| 6 | PedidoDetailPage não mostra itens | Operador sem visibilidade | Tab "Itens" | 2 |
| 7 | Kanban sem confirmação de drop | Mudança acidental de status | Dialog confirm | 3 |
| 8 | Muitos cliques para criar orçamento | Ineficiência operacional | Atalho no Dashboard | 3 |

---

## 6. PROBLEMAS DE MODELAGEM E BANCO

| # | Problema | Risco | SQL de Correção | Sprint |
|---|---|---|---|---|
| 1 | 12 campos críticos nullable | Dados inconsistentes | ALTER COLUMN SET NOT NULL + defaults | 1 |
| 2 | stores sem FK para clientes | Registros órfãos | ADD CONSTRAINT FK | 2 |
| 3 | jobs sem FK para pedidos/ordens | Integridade quebrada | ADD CONSTRAINT FK | 2 |
| 4 | Dupla numeração em propostas (2 triggers + JS) | Conflito de número | Remover duplicata | 2 |
| 5 | registros_auditoria sem retenção | Crescimento infinito | Cron de limpeza 6 meses | 3 |
| 6 | 11 tabelas sem nenhum índice | Sequential scan | CREATE INDEX | 1 |

---

## 7. DÍVIDA TÉCNICA E ARQUITETURA

| # | Item | Gravidade | Refatoração |
|---|---|---|---|
| 1 | 1 teste em 71.888 linhas | CRÍTICO | Testes para: pricing, boleto, orçamento, auth |
| 2 | 6 arquivos com 1500+ linhas | ALTO | Decompor em service + hooks + components |
| 3 | 279 usos de `any` | ALTO | Regenerar tipos Supabase |
| 4 | 8/12 domínios com lógica no componente | ALTO | Extrair para services/ e hooks/ |
| 5 | Zod em 2/20 formulários | ALTO | Integrar zodResolver nos demais |
| 6 | 10 páginas dead code (6.700 linhas) | MÉDIO | Deletar ou mover para _deprecated/ |
| 7 | Zero lock otimista/pessimista | ALTO | Campo `version` + check antes de update |
| 8 | Migration 006 incompatível (3 definições) | MÉDIO | Consolidar e executar |

---

## 8. FLUXOS QUEBRADOS OU INCOMPLETOS

| Fluxo | Ponto de Quebra | Consequência | Sprint |
|---|---|---|---|
| Produção → Pedido | OP concluída não atualiza status do pedido | Pedido fica "em_produção" para sempre | 1 |
| Pedido → Financeiro | gerarContasReceber falha silenciosamente | Pedido "concluído" sem cobrança | 1 |
| Orçamento recusado → Pedido | converterParaPedido não valida status | Pedido gerado de proposta rejeitada | 1 |
| Aprovação portal → Pedido | Pedido não gerado automaticamente | Atraso no fluxo, ação manual | 2 |
| Produção → Expedição | Sem módulo de expedição dedicado | Sem controle de liberação | 2 |
| ERP → App de Campo | Migration 004 executada mas triggers podem não existir | Bridge pode estar inoperante | 1 |
| Pedido → Cancelamento | Sem UI/fluxo de cancelamento | Impossível cancelar em produção | 2 |
| Produção → Estoque | Estoque não debitado ao concluir OP | Saldo de estoque nunca atualiza | 3 |
| NF-e → SEFAZ | Rascunho sem itens/impostos | NF-e não pode ser transmitida como está | 2 |

---

## 9. PLANO DE CORREÇÃO PRIORIZADO

### 🔴 Sprint 1 — URGÊNCIA CRÍTICA (estimativa: 2-3 dias)

| # | Ação | Esforço | IDs |
|---|---|---|---|
| 1 | Habilitar RLS em tabelas críticas (clientes, propostas, pedidos, leads, profiles, contas_*) | 4h | C-01 |
| 2 | Auth nas 3 Edge Functions (validar JWT) | 1h | C-02 |
| 3 | Corrigir N+1 no orcamento.service.ts (nested select) | 1h | C-03 |
| 4 | NOT NULL em campos críticos + corrigir dados existentes | 1h | C-05 |
| 5 | Criar 14 índices prioritários em FKs de transação | 30min | C-06 |
| 6 | Guards de transição de status no pedido | 2h | C-11 |
| 7 | gerarContasReceber transacional (não silenciar erro) | 1h | C-09 |
| 8 | Geração atômica de números OP/OS (sequência do banco) | 1h | C-10 |
| 9 | Bloquear edição de orçamento aprovado | 30min | C-08 |
| 10 | Bloquear conversão de orçamento recusado | 30min | A-04 |
| 11 | Idempotência: check duplicidade antes de insert (CR, OP, boleto) | 1h | A-05, C-14 |
| 12 | Validação vencimento futuro no boleto | 15min | C-13 |
| 13 | Validar materiais.length > 0 no editor de orçamento | 30min | C-12 |
| 14 | Reverter propostas aprovadas/enviadas com R$ 0,00 para rascunho | 15min | C-04 |
| 15 | Quantidade min=1 no orçamento | 15min | A-08 |
| 16 | Excluir cancelados do totalValor no dashboard | 15min | A-06 |
| 17 | PermissionGuard nas rotas /admin/* | 30min | A-01 |
| 18 | URL correta no fallback de email | 5min | A-02 |
| 19 | Confirmação em ações destrutivas | 30min | A-03 |
| 20 | Dashboard produção: 8 queries → 1 | 1h | A-19 |

**Total Sprint 1: ~16h**

### 🟠 Sprint 2 — ESTABILIZAÇÃO (estimativa: 3-4 dias)

| # | Ação | Esforço | IDs |
|---|---|---|---|
| 1 | Paginação em listagens (Clientes, Leads, Pedidos, Orçamentos) | 4h | M-02 |
| 2 | Loading state em todos os botões de submit | 2h | M-03 |
| 3 | staleTime explícito nos hooks de stats | 1h | A-20 |
| 4 | Completar NF-e (itens + impostos básicos) | 4h | A-14, M-08 |
| 5 | Funcionalidade de cancelamento de pedido | 3h | A-16 |
| 6 | Detecção de leads duplicados | 2h | A-22 |
| 7 | Validação CNPJ (dígito verificador) na conversão Lead→Cliente | 1h | A-07 |
| 8 | FKs em stores e jobs | 1h | MOD-02/03 |
| 9 | Resolver dupla numeração de propostas | 1h | M-14 |
| 10 | CORS restritivo nas Edge Functions | 1h | M-01 |
| 11 | Consolidar migration 006 | 4h | M-09 |
| 12 | Validar dados sacado antes de remessa CNAB | 1h | A-17 |

**Total Sprint 2: ~25h**

### 🟡 Sprint 3 — CONSISTÊNCIA E PERFORMANCE (estimativa: 3-4 dias)

| # | Ação | Esforço | IDs |
|---|---|---|---|
| 1 | Decompor 6 arquivos monolíticos (service + hooks + components) | 8h | A-10 |
| 2 | Regenerar tipos Supabase (eliminar 279 `any`) | 3h | A-11 |
| 3 | Integrar Zod nos 18 formulários restantes | 4h | A-13 |
| 4 | Deletar 10 páginas dead code + duplicatas | 1h | B-01, B-02 |
| 5 | Substituir .select('*') por colunas específicas (top 10) | 3h | M-12 |
| 6 | Implementar optimistic updates (top 5 hooks) | 3h | FE-03 |
| 7 | Política de retenção em registros_auditoria | 1h | M-13 |
| 8 | Índices trigram para busca textual | 30min | IDX-03 |

**Total Sprint 3: ~23h**

### 🔵 Sprint 4 — REFINAMENTO E ESCALA (estimativa: 5+ dias)

| # | Ação | Esforço | IDs |
|---|---|---|---|
| 1 | RLS granular para TODAS as tabelas restantes | 8h | - |
| 2 | Testes unitários (pricing, boleto, orçamento, auth) | 8h | C-07 |
| 3 | Lock otimista (campo version + check) | 4h | - |
| 4 | Views materializadas para dashboards | 4h | - |
| 5 | Extrair lógica para services nos 8 domínios restantes | 8h | A-12 |
| 6 | Resolver items menores (TEMP_CONFIG, console.log, etc.) | 2h | B-* |

**Total Sprint 4: ~34h**

---

## 10. CHECKLIST DE GO-LIVE

### Bloqueadores (DEVEM estar prontos antes de produção)

- [ ] RLS habilitado em todas as tabelas com dados sensíveis
- [ ] Edge Functions com validação de JWT do usuário
- [ ] PermissionGuard nas rotas /admin/*
- [ ] Guards de transição de status nos pedidos
- [ ] gerarContasReceber transacional (não silenciar erro)
- [ ] Bloquear edição de orçamento aprovado/convertido
- [ ] Bloquear conversão de orçamento recusado para pedido
- [ ] Validação de vencimento futuro no boleto
- [ ] Check de duplicidade antes de inserir boleto/OP/CR
- [ ] Geração atômica de números OP/OS
- [ ] NOT NULL em campos críticos (status, valor_total, quantidade)
- [ ] Índices nas FKs de transação
- [ ] N+1 corrigido no orcamento.service.ts
- [ ] URL correta no fallback de email

### Recomendados (idealmente antes, mas não bloqueiam)

- [ ] Paginação nas listagens
- [ ] Loading state nos botões
- [ ] Validação CNPJ
- [ ] Detecção de leads duplicados
- [ ] NF-e com itens e impostos básicos
- [ ] Cancelamento de pedido implementado
- [ ] Migration 006 consolidada e executada

### Monitoramento pós-go-live

- [ ] Verificar proposta_views (tracking) gerando dados
- [ ] Monitorar registros_auditoria (crescimento)
- [ ] Verificar se bridge ERP↔Campo está sincronizando
- [ ] Acompanhar slow queries via pg_stat_statements
- [ ] Validar NF-e em homologação antes de trocar para produção

---

## NOTA SOBRE FALSO-POSITIVOS

Os agentes de QA apontaram "Migration 004 não executada" como CRÍTICO, mas ela **já foi executada** na sessão anterior (commit `0e2cb67`). Os triggers existem no banco (3 triggers confirmados via query). Este item foi removido da matriz de falhas.

Da mesma forma, `handleConverter` em LeadDetailPage **já foi corrigido** (commit `6152348`) para criar registro em clientes. A conversão funciona, mas falta validação de CNPJ — este ponto foi mantido como ALTO.

---

*Relatório gerado por Claude Opus 4.6 | 4 agentes em paralelo | 2026-03-14*
*Próxima auditoria recomendada: após conclusão da Sprint 1*
