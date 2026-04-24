# Requirements: ERP-Croma

**Defined:** 2026-03-28
**Updated:** 2026-03-31
**Core Value:** Fluxo Lead→Faturamento funcionando de ponta a ponta sem falhas

## v1 Requirements (Auditoria Crítica)

### Bugs Críticos

- [x] **BUG-01**: Status faturado funciona corretamente e atualiza financeiro
- [x] **BUG-02**: NCM preenchido em todos os produtos (fiscal não quebra)
- [x] **BUG-03**: Pagamento conectado ao fluxo de pedidos
- [x] **BUG-04**: Comissões calculadas automaticamente sobre vendas
- [x] **BUG-05**: Dimensões propagam corretamente no orçamento→pedido

### Gaps Funcionais

- [x] **GAP-01**: Dashboard financeiro consolidado (receitas, despesas, fluxo de caixa)
- [x] **GAP-02**: Integração bancária para boletos (não manual)
- [x] **GAP-03**: Reserva de estoque ao criar pedido
- [x] **GAP-04**: Gantt funcional na produção (não decorativo)
- [x] **GAP-05**: Sistema de alertas e notificações
- [x] **GAP-06**: Funil comercial completo (Lead→Cliente com métricas)
- [x] **GAP-07**: Conversão Proposta→Pedido sem perda de dados

## v2 Requirements (Produto)

### Expansão

- [x] **PROD-01**: Contratos recorrentes para clientes fixos
- [x] **PROD-02**: NPS e pesquisa de satisfação
- [x] **PROD-03**: PIX como forma de pagamento
- [x] **PROD-04**: RFQ — solicitação de cotação para fornecedores
- [x] **PROD-05**: Approval workflow em cadeia

### IA Avançada

- [x] **AI-03**: Agente de Vendas multicanal com follow-ups automáticos
- [x] **AI-04**: AI Orçamento — detecção de intenção + proposta automática
- [x] **TELE-01**: Gestão completa via Telegram

## v3 Requirements (CROMA 4.0 — Autonomia Total)

### Infraestrutura de Autonomia

- [x] **AUTO-01**: Ponte MCP (ai_requests/ai_responses) — Claude processa botões do ERP
- [x] **AUTO-02**: Triggers de eventos formais (production_completed, installation_completed, payment_received, payment_overdue)
- [x] **AUTO-03**: System events para automação em cadeia
- [x] **AUTO-04**: Memory layer (ai_memory) para padrões detectados
- [x] **AUTO-05**: Scheduled tasks de orquestração (matinal 08h, noturna 22h, polling 30min)
- [x] **AUTO-06**: Desativar Telegram webhook (Channels substitui)

### Automação de Fluxo

- [x] **FLOW-01**: Cobrança automática escalonada (D+1/D+3/D+7/D+15/D+30)
- [x] **FLOW-02**: Transição automática Produção→Instalação (trigger + auto-criar OI)
- [x] **FLOW-03**: Agent rules — 14 regras de decisão seedadas (comercial, financeiro, estoque, produção, instalação)

### Experiência

- [x] **UX-01**: ChatERP componente (criado, não integrado — prioridade baixa)
- [x] **UX-02**: Cockpit Executivo com system_events e cobrança — views criadas (106), agent_rules + cobranca_automatica + 5 views

### WhatsApp IA

- [x] **WA-01**: WhatsApp Business API ativo com integração CRM completa (webhook v14 + ai-gerar-orcamento + coleta dados + email SMTP)

### Pendentes

- [x] **WA-02**: Templates Meta Business — Edge Function whatsapp-submit-templates criada (3 templates: abertura, followup, proposta)
- [x] **CRON-01**: pg_cron configurado (migration 107) — 4 jobs: agent-loop 30min, overdue daily, expire requests 2h, resumo 22h

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-tenant / SaaS | Sistema exclusivo da Croma |
| App nativo mobile | PWA suficiente para campo |
| Troca de banco (Supabase) | Investimento já feito, funciona bem |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUG-01 a BUG-05 | Phase 1 | Done |
| GAP-01 a GAP-07 | Phase 1-2 | Done |
| PROD-01 a PROD-05 | Phase 3 | Done |
| AI-03, AI-04, TELE-01 | Phase 3 | Done |
| AUTO-01 a AUTO-06 | CROMA 4.0 F1 | Done |
| FLOW-01 a FLOW-03 | CROMA 4.0 F2 | Done |
| UX-01 | CROMA 4.0 F3 | Done |
| WA-01 | CROMA 4.0 F2 | Done |
| UX-02, WA-02, CRON-01 | CROMA 4.0 F3+ | Done |

**Coverage:**
- v1: 12/12 complete (100%)
- v2: 8/8 complete (100%)
- v3: 15/15 complete (100%)
- Overall: 35/35 complete (100%) ✅
- Overall: 32/35 complete (91%)

---

## v4 — Auditoria de Saúde Operacional (2026-04-16, Opus 4.7)

24 achados levantados via MCP Server Croma contra o Supabase de produção.
Relatório: `docs/qa-reports/2026-04-16-auditoria-saude-operacional.docx` + `.xlsx`.

### P0 — Crítico (24-48h)
- [ ] **CRM-001**: 406/408 leads (99,5%) parados há >7d — pipeline congelado
- [ ] **CRM-002**: 391/408 leads (96%) sem email — viola `.claude/rules/agent-vendas-coleta-dados.md`
- [ ] **HP-001**: 2 printheads HP vencidas em uso (uma de 12/2023, uma de 01/2026)

### P0 reclassificados (16/04 tarde) — Junior confirmou que fase de testes
- [~] **OPS-001** → P2: 20 jobs HP Latex sem vínculo ERP. **Não é perda real** — nem tudo passa pelo CRM ainda (fase de testes/implementação da integração).
- [~] **OPS-002** → P2: 5 clientes HP sem cadastro. **Esperado** nesta fase; cadastrar conforme migração ao CRM avançar.

### P1 — Alto (semana)
- [ ] **CRM-003**: 320/321 clientes (99,7%) sem vendedor atribuído
- [ ] **CRM-004**: 151/321 clientes (47%) sem email
- [ ] **FIS-001**: 23/321 clientes sem CNPJ/CPF — bloqueia NF-e
- [ ] **FIS-002**: 374/497 materiais (75%) sem NCM
- [ ] **HP-002**: 21 de 22 substratos HP não mapeados (só SM790)
- [ ] **DATA-001**: 5 leads de teste E2E poluindo a base
- [ ] **PROD-001**: 3/3 OPs ativas sem máquina atribuída
- [ ] **OPS-003**: falso positivo em alertas — pedido #1069 concluído gera alerta "atrasado"
- [ ] **FIS-003**: pedido #1069 (R$ 2.005,55 Beira Rio) concluído com `status_fiscal=nao_aplicavel`

### P2 — Médio (próximo sprint)
- [ ] **CRM-005**: 113/408 leads sem contato_nome
- [ ] **CRM-006**: 99/408 leads sem telefone
- [ ] **CRM-007**: 2 pares de leads com telefone igual e empresas diferentes
- [ ] **DATA-002**: status `contatado` vs `em_contato` não normalizado
- [ ] **DATA-003**: 2 emails com 2 leads duplicados cada
- [ ] **EST-001**: 2 materiais ativos sem `preco_medio`
- [ ] **FIS-004**: 26/321 clientes sem endereço
- [ ] **CAMPO-001**: 3 jobs de campo parados há >7d

### P3 — Baixo (backlog)
- [ ] **FIS-005**: 5/321 clientes sem cidade
- [x] **CRM-008**: Grupo BOXTER — 6 leads com telefone central (validado, não é bug)

---

## v5 — Auditoria de Segurança + RLS + Secrets (2026-04-16, Opus 4.7, Sessão 2/4)

15 achados levantados via Supabase Advisor (272 lints) + inspeção de Edge Functions + scan de secrets.
Relatório: `docs/qa-reports/2026-04-16-auditoria-seguranca-rls.docx` + `.xlsx`.

### P0 — Crítico (24-48h)
- [ ] **SEC-001**: 37 tabelas em `public` com RLS desabilitado (ERROR Advisor)
- [ ] **SEC-002**: 32 tabelas com policies criadas mas RLS desligado (policies inertes)
- [ ] **SEC-003**: 79 policies `USING (true)` permissivas em 70 tabelas — qualquer authenticated lê/edita tudo
- [ ] **SEC-004**: 46 de 121 funções SECURITY DEFINER sem `search_path` fixo — privilege escalation
- [ ] **SEC-005**: 27 views SECURITY DEFINER — burlam RLS das tabelas subjacentes

### P1 — Alto (semana)
- [ ] **SEC-006**: Schema `pessoal` (16 tabelas de app pessoal) convive no mesmo DB do ERP
- [ ] **SEC-007**: 42 de 58 Edge Functions com `verify_jwt=false` — públicas sem autenticação
- [ ] **SEC-008**: CORS wildcard `*` em 10 Edge Functions identificadas
- [ ] **SEC-009**: 3 buckets públicos com listing policy exposto (Advisor)
- [ ] **SEC-010**: Telegram bot tokens + chat_id hardcoded em `supabase/` e `docs/`

### P2 — Médio (próximo sprint)
- [ ] **SEC-011**: Extensões `pg_trgm` e `pg_net` instaladas em `public` (deveriam ir para `extensions`)
- [ ] **SEC-012**: `campo_audit_logs` com RLS ligado mas zero policies
- [ ] **SEC-013**: Proteção HaveIBeenPwned (senhas vazadas) desligada no Auth
- [ ] **SEC-014**: Anon key hardcoded em `mcp-server/src/supabase-client.ts` (commitado)

### P3 — Baixo (backlog / validado)
- [x] **SEC-015**: Arquivos `.env` locais — confirmado não commitados (gitignore funciona)

---

## v6 — Auditoria de Banco de Dados + Regras de Negócio (2026-04-16, Opus 4.7, Sessão 3/4)

15 achados levantados via inspeção direta do schema Supabase (114 triggers, 121 funções, views, FKs).
Relatório: `docs/qa-reports/2026-04-16-auditoria-banco-regras.docx` + `.xlsx`.
Migration de remediação: `supabase/migrations/125_dbhardening_s3.sql` + `126_fk_indexes_s3.sql`.

### P0 — Crítico (24-48h) — TRIGGERS DUPLICADOS
- [ ] **DB-001**: 3 triggers duplicados em `ordens_producao` mutando estoque no mesmo evento (trg_auto_baixa_producao + trg_debitar_estoque + trg_producao_debita_estoque)
- [ ] **DB-002**: 2 triggers duplicados em `pedidos_compra` gerando `contas_pagar` (trg_compra_conta_pagar + trg_compra_gera_conta_pagar) — risco de pagamento duplicado
- [ ] **DB-003**: 2 triggers duplicados em `pedidos_compra` gerando entrada de estoque (trg_compra_recebimento + trg_compra_recebimento_estoque)
- [ ] **DB-004**: 2 triggers duplicados calculando `area_m2` em `proposta_itens` e `pedido_itens` (fn_calc_area_m2 + calcular_area_m2)
- [ ] **DB-005**: 2 triggers de `contas_receber` em `pedidos` disparando em estados diferentes (aprovado + concluido) — CR criado 2x no fluxo completo

### P1 — Alto (semana) — INTEGRIDADE MUBISYS + FKs
- [ ] **DB-006**: 60 produtos sem `produto_modelos` (38% de 156) — orçamento automático falha
- [ ] **DB-007**: 7 `produto_modelos` sem `modelo_materiais` (BOM vazia) — motor Mubisys retorna preço zero
- [ ] **DB-008**: 2 materiais ativos com `preco_medio=0` — cotação retorna 0 em combinações com esses materiais
- [ ] **DB-009**: 118 FKs sem índice de apoio — joins lentos em tabelas grandes
- [ ] **DB-010**: `vw_cockpit_executivo` não filtra `excluido_em IS NULL` — métricas inflam com pedidos excluídos

### P2 — Médio (próximo sprint)
- [ ] **DB-011**: Drift entre CLAUDE.md (11 categorias de regras_precificacao) e banco (9 ativas)
- [ ] **DB-012**: 6 itens (3 proposta_itens + 3 pedido_itens) sem largura/altura/area_m2
- [ ] **DB-013**: Drift semântico entre fluxo de status documentado (CLAUDE.md) e `fn_validar_transicao_status`
- [ ] **DB-014**: 351 índices sem uso (`idx_scan=0`) — candidato a DROP após 30d de observação

### P3 — Baixo (backlog)
- [ ] **DB-015**: `registros_auditoria` 141k linhas em 30 dias (~1.7M/ano) — planejar partitioning por mês

---

## v7 — Auditoria de Integrações (2026-04-16, Opus 4.7, Sessão 4/4)

15 achados levantados via inspeção de Edge Functions (63), pg_cron jobs, MCP Bridge, HP Latex sync, fiscal SEFAZ e webhooks WhatsApp/Telegram.
Relatório: `docs/qa-reports/2026-04-16-auditoria-integracoes.docx` + `.xlsx`.
Migration de remediação: `supabase/migrations/127_integrations_hardening_s4.sql`.

### P0 — Crítico (24-48h)
- [ ] **INT-001**: 2 jobs `pg_cron` (5 e 6) com anon key JWT hardcoded em `command` — rotação quebra os jobs e JWT vaza em backups
- [ ] **INT-002**: 4 Edge Functions fiscais (`fiscal-emitir-nfe`, `fiscal-cancelar-nfe`, `fiscal-inutilizar-nfe`, `fiscal-deploy-certificado`) com `verify_jwt=false` e SERVICE_TOKEN hardcoded `croma-fiscal-interno-2026`
- [ ] **INT-003**: `ai-gerar-orcamento` sem autenticação — anon key pode gerar propostas e queimar tokens OpenRouter
- [ ] **INT-004**: `fiscal-debug-sefaz` e `fiscal-debug-nfe` ativas em produção; header `x-forense-debug: croma-forense-2026` expõe XMLDSIG + certificado A1
- [ ] **INT-005**: `ANTHROPIC_API_KEY` + `TELEGRAM_BOT_TOKEN` hardcoded como fallback em `telegram-webhook/index.ts`
- [ ] **INT-006**: `whatsapp-webhook` aceita payload sem validar signature quando `WHATSAPP_APP_SECRET` não configurado (fallback permissivo)
- [ ] **INT-007**: MCP Bridge morto há 5 dias — 2 `ai_requests` criados, 0 processados, último em 2026-04-12

### P1 — Alto (semana)
- [ ] **INT-008**: HP Latex sync parado desde 2026-04-07 — Task Scheduler `hp-latex-sync` não roda há 10+ dias
- [ ] **INT-009**: 87 erros de transmissão NF-e em 2026-04-07 (15 cStat 297 assinatura XMLDSIG diverge, 21 retornos NULL)
- [ ] **INT-010**: 10+ Edge Functions write (whatsapp-enviar, agent-enviar-email, onedrive-*, delete-job, enviar-email-*, ai-compor-mensagem, ai-decidir-acao) com `verify_jwt=false`
- [ ] **INT-011**: Padrão previsível `croma-<tema>-2026` em 3 tokens hardcoded (SERVICE_TOKEN, proxySecret, forenseDebug)
- [ ] **INT-012**: `fiscal_documentos` com `status=emitindo` fica órfão se Edge timeout — UI não permite reemitir

### P2 — Médio (próximo sprint)
- [ ] **INT-013**: `telegram_messages` cresce indefinidamente sem política TTL
- [ ] **INT-014**: `tool.execute(tc.args)` em telegram-webhook passa args do LLM sem schema Zod/validação
- [ ] **INT-015**: Match de lead por `ilike '%<últimos 10 dígitos>%'` no whatsapp-webhook pode colidir telefones parecidos

---

*Requirements defined: 2026-03-28*
*v3 added: 2026-03-29*
*v4 added: 2026-04-16 — Auditoria Opus 4.7 (Sessão 1/4)*
*v5 added: 2026-04-16 — Auditoria Opus 4.7 (Sessão 2/4 — Segurança)*
*v6 added: 2026-04-16 — Auditoria Opus 4.7 (Sessão 3/4 — Banco + Regras)*
*v7 added: 2026-04-16 — Auditoria Opus 4.7 (Sessão 4/4 — Integrações)*
