# RELATÓRIO DE AUDITORIA — CROMA PRINT ERP/CRM

> **Data**: 2026-03-14 | **Sistema**: `crm-croma.vercel.app` | **Banco**: `djwjmfgplnqyffdcgdaw.supabase.co`
> **PR mergeado**: [#5 — fix: 19 bugs corrigidos](https://github.com/juniorcromaprint-tech/CRM-Croma/pull/5)
> **Build**: TypeScript ✅ zero erros | **Deploy**: Vercel em produção ✅

---

## 1. O QUE FOI CORRIGIDO (PR #5 — já em produção)

19 bugs corrigidos em 15 arquivos. Commit `ec63284` na `main`.

### 🔴 Críticos (5)

| ID | Arquivo | O que era | O que faz agora |
|----|---------|-----------|-----------------|
| C-01 | `OrcamentoEditorPage.tsx:461` | `toast.warning` sem `return` — item R$ 0,00 era salvo | `showError() + return` — bloqueia item com valor zero |
| C-02 | `PedidoDetailPage.tsx:152` | Consultava tabela `nfe_documentos` (não existe) | Consulta `fiscal_documentos` (correta) |
| C-05 | `LeadDetailPage.tsx:114` | `createCliente` não enviava `lead_id` no payload | Envia `lead_id: id` — rastreabilidade Lead→Cliente preservada |
| A-01 | `orcamento.service.ts:660` | Sem verificação de pedido existente + `COUNT` não-atômico | Verifica `proposta_id` antes de criar + numeração via `MAX+1` |
| A-02 | `producao.service.ts` + `instalacao-criacao.service.ts` | `Math.random() * 9999` — risco real de colisão | Busca último número no banco via `ORDER BY DESC LIMIT 1` + incrementa |

### 🟠 Altos (8)

| ID | Arquivo | Correção |
|----|---------|----------|
| A-05 | `useFiscal.ts:132` | `user_id` fixo `00000000...` → `supabase.auth.getUser()` real |
| A-06 | `clientes.schemas.ts:12` | CNPJ validado apenas por regex → algoritmo módulo 11 completo |
| A-07 | `AuthContext.tsx:89` | Default role `'admin'` → `'comercial'` (segurança: novo usuário sem role era admin) |
| A-09 | `App.tsx` | `ErrorBoundary` existia mas não era usado → wrapping de todo o app |
| A-12 | `Layout.tsx:21-37` | 7 ícones (`Calendar, Megaphone, Package2, ArrowLeftRight, Building, Layers, BarChart2`) sem registro no `ICON_MAP` → corrigidos |
| A-13 | `navigation.ts:36` | Item "Templates" no menu apontava para `/orcamentos/templates` sem Route → removido |
| A-14 | `producao.service.ts` | Finalizar OP não atualizava status do pedido → `atualizarStatusPedidoSeTodasOpsConcluidas()` muda para `'produzido'` |
| M-15 | `fiscalRoutes.tsx:14` | `/fiscal/emissao` e `/fiscal/fila` apontavam para o mesmo componente → duplicata removida |

### 🟡 Médios (6)

| ID | Arquivo | Correção |
|----|---------|----------|
| M-01 | `LeadDetailPage.tsx` | Sem validação de email/telefone → regex de email + padrão `(XX) XXXXX-XXXX` no `handleSave()` |
| M-02 | `AdminProdutosPage.tsx:476` | `area_m2` não calculada → `area_m2 = (largura_cm / 100) * (altura_cm / 100)` automático |
| M-04 | `LeadDetailPage.tsx` | Dialog de conversão Lead→Cliente sem campo CNPJ → input adicionado, valor enviado no payload |
| M-05 | `financeiro-automation.service.ts` | Vencimento fixo 30 dias → busca `forma_pagamento` da proposta (PIX=1d, Boleto=5d, parcelado=prazo_dias) |
| M-09 | `OrcamentoEditorPage.tsx:480` | `custo_fixo` podia ficar negativo → `Math.max(0, ...)` |
| M-14 | `PedidoDetailPage.tsx:77` | Motivo de cancelamento era concatenado em `observacoes` → campos `cancelado_em` + `motivo_cancelamento` dedicados |

### 🗄️ Banco — Migration executada

| Migration | O que criou |
|-----------|-------------|
| `022_pedidos_cancelamento_fields` | `cancelado_em TIMESTAMPTZ` + `motivo_cancelamento TEXT` na tabela `pedidos` + índice |

---

## 2. PROBLEMAS AINDA ABERTOS

Ordenados por prioridade. Os itens com **Sprint 1** são bloqueadores de go-live em volume real.

### 🔴 Críticos — Sprint 1 (estimativa: 2-3 dias)

| ID | Problema | Arquivo / Local | Correção sugerida | Esforço |
|----|----------|-----------------|-------------------|---------|
| SEC-01 | **80+ tabelas sem RLS** — qualquer usuário autenticado lê custos, margens, dados de outros clientes | Banco Supabase | Habilitar RLS + policies por `role` em: `clientes, propostas, pedidos, leads, profiles, contas_receber, contas_pagar, ordens_producao` (prioritárias) | 4h |
| SEC-02 | **3 Edge Functions sem validação de JWT** — enviar-email-proposta, onedrive-criar-pasta, onedrive-upload-proposta acessíveis sem login | `supabase/functions/` | Validar `Authorization: Bearer <token>` antes de processar | 1h |
| PERF-01 | **N+1 query no orçamento** — `buscarPorId` faz 3 + 2×N queries (10 itens = 23 queries) | `orcamento.service.ts:281-307` | Substituir loop de `Promise.all` por nested select do Supabase | 1h |
| NEG-01 | **Orçamento aprovado pode ser editado** — sem bloqueio após aprovação, quebrando integridade contratual | `orcamento.service.ts:352-370` | Verificar `status = 'aprovado'` antes de permitir update | 30min |
| NEG-02 | **Orçamento recusado pode virar pedido** — `converterParaPedido` não valida status | `orcamento.service.ts` | Guard: `if (status === 'recusado') throw` | 30min |
| NEG-03 | **Pedido avança status sem validar pré-condições** — pode ser "concluído" sem OP, NF-e ou pagamento | `PedidoDetailPage.tsx:73-85` | Mapa de transições: `em_producao → produzido` só se todas as OPs concluídas | 2h |
| NEG-04 | **gerarContasReceber com `.catch` silencioso** — pedido marcado "concluído" sem gerar cobrança | `PedidoDetailPage.tsx:81` | Remover `.catch` ou relançar o erro; tornar transacional | 1h |
| FIN-01 | **Boleto aceita vencimento no passado** — lote CNAB rejeitado pelo banco | `bankSlipCreateSchema` | Adicionar `.refine(d => d >= hoje)` no schema Zod | 15min |
| FIN-02 | **Sem check de boleto duplicado** — cliente cobrado em duplicidade | `boleto.service.ts` | Query `conta_id + status = 'pendente'` antes de inserir | 1h |
| IDX-01 | **78 Foreign Keys sem índice** — JOINs fazem sequential scan | Banco | `CREATE INDEX` nas FKs de: `pedidos, propostas, ordens_producao, instalacoes, contas_*` (14 prioritárias) | 30min |

### 🟠 Altos — Sprint 2 (estimativa: 3-4 dias)

| ID | Problema | Local | Esforço |
|----|----------|-------|---------|
| SEC-03 | Rotas `/admin/*` sem `PermissionGuard` — qualquer autenticado acessa | `adminRoutes.tsx` | 30min |
| SEC-04 | `/tv` pública expõe dados de produção em tempo real | `App.tsx:61` | Auth por token de query string | 1h |
| SEC-05 | URL desatualizada hardcoded no fallback de email | `enviar-email-proposta/index.ts:33` | Usar `crm-croma.vercel.app` | 5min |
| PERF-02 | Dashboard produção faz 8 queries `COUNT` separadas — 240 req/h por usuário | `useDashboardStats` | Consolidar em 1 query com `GROUP BY status` | 1h |
| NEG-05 | Pedidos cancelados somam no total do dashboard | `useDashboardStats` | Adicionar `.neq('status', 'cancelado')` | 15min |
| NEG-06 | Quantidade 0 ou negativa aceita no orçamento | `OrcamentoEditorPage.tsx` | `if (quantidade <= 0) return showError(...)` | 15min |
| NEG-07 | Duplicação de OP/contas a receber sem verificação de idempotência | `producao.service.ts`, `financeiro-automation.service.ts` | Check de existência antes de `INSERT` | 1h |
| UX-01 | Ações destrutivas sem confirmação (excluir regra de precificação, template) | Admin pages | Adicionar `AlertDialog` de confirmação | 30min |
| DB-01 | 12 campos críticos nullable (`status`, `valor_total`, `quantidade` em pedidos/propostas/OPs) | Banco | `ALTER COLUMN SET NOT NULL + DEFAULT` | 1h |
| TECH-01 | Tipos TypeScript do Supabase não gerados — 279 usos de `any` | Todo o codebase | `supabase gen types typescript --project-id djwjmfgplnqyffdcgdaw > src/integrations/supabase/types.ts` | 2h |
| TECH-02 | Zero lazy loading nas 38 rotas protegidas — bundle ~2MB | `src/routes/*.tsx` | Converter imports para `React.lazy()` | 2h |

### 🟡 Médios — Sprint 3 (estimativa: 3-4 dias)

| ID | Problema | Esforço |
|----|----------|---------|
| UX-02 | Sem paginação em listagens (Clientes, Leads, Pedidos, Orçamentos) — lentidão com crescimento | 4h |
| UX-03 | Botões de submit sem `loading state` — double-click cria registros duplicados | 2h |
| UX-04 | `window.confirm` nativo em 4 locais — inconsistente com o design system | 1h |
| FIN-03 | Estoque não debitado ao concluir produção — saldo nunca atualiza | 3h |
| FISCAL-01 | NF-e criada sem itens e sem impostos — não pode ser transmitida à SEFAZ | 4h |
| ARCH-01 | 6 arquivos com 1500+ linhas (`OrcamentoEditorPage`, `orcamento.service`, etc.) — manutenção difícil | 8h |
| ARCH-02 | Zod validando apenas 2 de ~20 formulários — sem schema no restante | 4h |
| ARCH-03 | Lógica de negócio diretamente nos componentes (8/12 domínios) — dívida técnica | 8h |
| DB-02 | `registros_auditoria` sem política de retenção — cresce infinitamente | 1h |
| DB-03 | CORS wildcard (`*`) em todas as Edge Functions | 1h |
| DB-04 | Dois triggers de numeração em propostas (conflito potencial) | 1h |

### 🟢 Baixos — Backlog (Sprint 4)

| ID | Problema |
|----|----------|
| B-01 | 35 `console.log` em produção |
| B-02 | 10 páginas dead code (~6.700 linhas em `src/pages/`) |
| B-03 | Soft-delete inconsistente entre entidades |
| B-04 | `NotFound.tsx` existe mas não é usado em nenhuma rota |
| B-05 | Namespace `utils` duplicado (`src/utils/` + `src/shared/utils/`) |
| B-06 | `updated_at` atualizado manualmente no frontend (redundante — já tem trigger no banco) |
| B-07 | Portal não exibe prazo de entrega nem validade do orçamento |
| B-08 | Rota `/admin/auditoria` renderiza `AdminUsuariosPage` (componente errado) |

---

## 3. FUNCIONALIDADES NOVAS SUGERIDAS (roadmap)

| # | Funcionalidade | Prioridade | Justificativa |
|---|---------------|-----------|---------------|
| 1 | **Emissão real de NF-e** via API gratuita (Focus NFe ou NF-e.io) | CRÍTICA | Edge Functions existem, falta provider. Sem isso, o fiscal é manual |
| 2 | **Parser CNAB 400 retorno** para baixa automática de boletos | ALTA | Tabelas já existem, falta o parser |
| 3 | **Tela de Expedição** dedicada | ALTA | Hoje usa PedidoDetailPage sem controle de liberação |
| 4 | **Aprovação portal → Pedido automático** | ALTA | Hoje requer ação manual do vendedor |
| 5 | **Testes** (alvo mínimo: 30% de cobertura) | ALTA | 1 arquivo de teste para 71.888 linhas de código |
| 6 | **Relatórios exportáveis** (PDF/Excel) | MÉDIA | Atualmente os dados são mock |
| 7 | **Paginação em listagens** | MÉDIA | Incluído no Sprint 3, mas vale destacar como feature |
| 8 | **Conciliação bancária real** (importação OFX) | MÉDIA | Hoje é básica |
| 9 | **Importação de clientes via CSV** | MÉDIA | Onboarding de bases existentes |
| 10 | **Lock otimista** (campo `version`) | MÉDIA | Sem isso, dois usuários simultâneos sobrescrevem dados silenciosamente |

---

## 4. ESTADO DO BANCO (verificado 2026-03-14)

| Tabela | Registros | Status |
|--------|-----------|--------|
| `clientes` | 307 | ✅ |
| `materiais` | 467 (464 com preço) | ✅ |
| `produtos` | 156 | ✅ |
| `produto_modelos` | 156 (markup seedado) | ✅ |
| `modelo_materiais` | 321 | ✅ |
| `modelo_processos` | 362 | ✅ |
| `acabamentos` | 17 | ✅ |
| `servicos` | 16 | ✅ |
| `regras_precificacao` | 11 categorias | ✅ |

**Migrations executadas**: 001, 002, 003, 003b_fiscal, 004, 005, 006, 007, 008, 009, 010, 020, 021, 022

---

## 5. CHECKLIST GO-LIVE

### Bloqueadores (obrigatório antes de colocar em uso real com múltiplos usuários)

- [ ] RLS habilitado nas tabelas com dados sensíveis (clientes, propostas, pedidos, leads, perfis, contas)
- [ ] JWT validado nas 3 Edge Functions públicas
- [ ] Guard de transição de status nos pedidos (não pode pular etapas)
- [ ] `gerarContasReceber` transacional (não silenciar erro)
- [ ] Bloquear edição de orçamento aprovado
- [ ] Bloquear conversão de orçamento recusado para pedido
- [ ] Validação de vencimento futuro no boleto
- [ ] Check de boleto duplicado antes de inserir
- [ ] Índices nas FKs de transação (14 prioritárias)
- [ ] URL correta no fallback de email (usar `crm-croma.vercel.app`)

### Recomendados (não bloqueiam, mas melhoram muito a experiência)

- [ ] Tipos TypeScript do Supabase gerados (`supabase gen types typescript`)
- [ ] Lazy loading nas 38 rotas
- [ ] Paginação nas listagens
- [ ] Loading state nos botões de submit
- [ ] Pedidos cancelados excluídos do total do dashboard
- [ ] N+1 corrigido no `orcamento.service.ts`

---

## 6. COMO TESTAR O QUE FOI CORRIGIDO

```
1. Lead → Criar lead com email inválido → deve REJEITAR
2. Lead → Converter em cliente → CNPJ aparece no dialog, lead_id fica vinculado
3. Orçamento → Adicionar item sem materiais → deve BLOQUEAR com erro (não warning)
4. Orçamento → Portal → Aprovar → tentar converter manualmente → "pedido já existe"
5. Produção → Criar OP → número sequencial (OP-2026-0001, não aleatório)
6. Produção → Finalizar última OP do pedido → status do pedido muda para "produzido"
7. Pedido → Concluir → sistema consulta fiscal_documentos (não mais nfe_documentos)
8. Pedido → Cancelar → motivo fica em campo dedicado, não em observações
9. Segurança → Criar usuário sem role → acesso "comercial" (não "admin")
10. UI → Sidebar → todos os ícones corretos, "Templates" não aparece no menu
```

---

*Auditoria realizada em 2026-03-14 por Claude Opus 4.6 + Sonnet 4.6 | 4 agentes paralelos*
*132 arquivos analisados | ~64k linhas de código | PR #5 mergeado*
