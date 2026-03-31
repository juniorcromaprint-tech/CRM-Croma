# Project State

## Project Reference

See: .planning/IDENTITY.md (papel, responsabilidades, regras)
See: .planning/PROJECT.md (updated 2026-03-28)
See: .planning/ROADMAP.md (created 2026-03-28)
See: docs/plano-ia/01_Estrategia/CROMA_4.0_PLANO_AUTONOMIA_TOTAL.md (CROMA 4.0)

**Core value:** Fluxo Lead → Orçamento → Pedido → Produção → Instalação → Faturamento funcionando de ponta a ponta
**Current focus:** CROMA 4.0 — Autonomia Total (empresa gerida por IA)

## Current Position

Phase: CROMA 4.0 — Fases 3+4+5 CONCLUÍDAS — Autonomia Total
Roadmap v1: 20/20 completo (100%) ✅
CROMA 4.0: 5/5 fases concluídas (100%) — Empresa gerida por IA
Status: CROMA 4.0 COMPLETO + Limpeza centralização Claude concluída.
Last activity: 2026-03-31 — Limpeza do agente de vendas para centralizar no Claude:
  - Removida aba "Modelos IA" do AgentConfigPage (seleção de modelos OpenRouter não faz sentido quando Claude Cowork é o agente)
  - Removido switch "Auto-aprovação leads frios" (existia na UI mas não era lido por nenhum código)
  - Removidos campos modelo_qualificacao/modelo_composicao/modelo_fallback do type AgentConfig
  - Limpas 9 mensagens órfãs (status 'aprovada' nunca enviadas — bug 401 whatsapp-enviar v9, já corrigido em v10)
  - Deletados 2 templates desativados v1 com 0 usos (substituídos por v2)
  - whatsapp-enviar v10 deployado com fix auth (service client ao invés de anon)
  - MAPA-IA-CROMA.md criado com inventário completo de 45 Edge Functions e plano de simplificação

Progress Roadmap v1: [████████████████████] 100% (20/20) ✅
Progress CROMA 4.0:  [████████████████████] 100% (5/5 fases)

## Performance Metrics

**Velocity:**
- Sprints concluídos: 4 (blindagem, fluxo, UX, crescimento)
- Bugs E2E corrigidos: 5
- Total bugs auditoria corrigidos: 24
- Bugs Phase 1 corrigidos: 6 (BUG-01 a BUG-05 + App Campo vídeo)
- GAPs Phase 1+2 resolvidos: 7 (GAP-01 a GAP-07)

**Histórico:**

| Sprint | Foco | Entregues |
|--------|------|-----------|
| Sprint 1 | Blindagem/Segurança | RLS, FK indexes, NOT NULL, AuthContext |
| Sprint 2 | Fluxo Completo | N+1 fix, idempotência, KPIs, Expedição |
| Sprint 3 | Performance/UX | Lazy loading, paginação, dead code |
| Sprint 4 | Features Avançadas | 102 testes, CNAB, relatórios, NF-e, campanhas |
| Phase 1 W1-2 | Faturamento + MCP | 5 triggers DB, sweep .select().single(), MCP Croma config, App Campo vídeo |
| Phase 1 W3 | NCM + Funil + Conversão | BUG-02 NCM seed, GAP-07 Proposta→Pedido, GAP-06 Funil analytics |
| Phase 2 | Auditoria + validação | GAP-01 a GAP-05 confirmados implementados |
| Phase 3 | Produto + IA | PROD-01 a PROD-05, AI-03, AI-04, TELE-01 |
| CROMA 4.0 F1 | Infraestrutura Autonomia | Ponte MCP, triggers eventos, scheduled tasks, hooks frontend |
| CROMA 4.0 F2 | WhatsApp IA v14 | Webhook v14 com CRM, coleta dados, ai-gerar-orcamento, email SMTP, PIX correto |

## CROMA 4.0 — Status das Fases

| Fase | Status | Entregues |
|------|--------|-----------|
| Fase 1 — Infraestrutura | ✅ Concluída | Ponte MCP (ai_requests/ai_responses), 3 triggers eventos (production_completed, installation_completed, payment_received), fn_detect_overdue_payments, system_events, ai_memory, useAIBridge.ts, 3 scheduled tasks |
| Fase 2 — Agente de Vendas | ✅ Concluída | WhatsApp webhook v14 com CRM integrado: detecta intenção, coleta dados cadastrais, cria propostas reais via ai-gerar-orcamento (motor Mubisys), envia link portal + email SMTP, PIX CNPJ 18.923.994/0001-83 correto, 3 Edge Functions deployadas (whatsapp-webhook, ai-compor-mensagem, agent-enviar-email) |
| Fase 3 — Automação Fluxo | ✅ Concluída | Migration 106+107: vw_fila_producao, fn_pcp_sequenciar_op (trigger auto-cria etapas), fn_op_finalizada_transicao (dual status), vw_automacao_cobrancas, vw_automacao_rules_status, execute_sql_readonly RPC. agent-cron-loop v3: motor de regras (15 rules), cobrança escalonada D1→D30 (WhatsApp/email/Telegram), PCP sequenciamento, alertas estoque/produção. AutomacaoPage (/admin/automacao) com 4 KPIs + 4 tabs. |
| Fase 4 — Inteligência | ✅ Concluída | Migration 108+109: score_credito/score_nivel/limite_credito_sugerido em clientes (312 calculados: 3×C, 309×D), vw_cockpit_executivo, vw_cockpit_timeline, vw_resumo_diario, fn_calcular_score_credito (4 fatores: pagamento 40%, volume 25%, relacionamento 20%, recência 15%), fn_recalcular_todos_scores, fn_detectar_padroes_memoria (4 padrões auto). CockpitExecutivoPage (/admin/cockpit) 7 seções. Resumo diário 22h BRT via Telegram. Memory layer com unique index + detecção automática. |
| Fase 5 — Conversacional | ✅ Concluída | ai-chat-erp Edge Function: pipeline 3 estágios (classify intent via OpenRouter → plan query templates → execute via execute_sql_readonly + format response). 24 SQL query templates em 6 categorias (financeiro, vendas, produção, estoque, comercial, geral). ChatERP floating panel integrado no Layout.tsx (bottom-right, mobile-responsive). |

## Accumulated Context

### Decisions

- [Sprint 1]: RLS em 8 tabelas — define padrão de segurança
- [Sprint 4]: Lock otimista — previne conflitos em edição
- [E2E]: e.preventDefault() em AlertDialogAction — REGRA NOVA
- [E2E]: .select().single() em mutations — REGRA NOVA
- [2026-03-28]: GSD adotado para manter contexto entre sessões
- [2026-03-28]: Plano IA integrado em docs/plano-ia/
- [2026-03-28]: IDENTITY.md criado — papel do Claude, divisão de responsabilidades com Junior
- [2026-03-28]: Regra: MCP Server Croma PRIMEIRO (26 ferramentas croma_*)
- [2026-03-29]: ROADMAP 100% COMPLETO — 20/20 requirements entregues
- [2026-03-29]: CROMA 4.0 iniciado — plano de autonomia total criado
- [2026-03-29]: Telegram webhook DESATIVADO — Channels substitui (custo zero)
- [2026-03-29]: Ponte MCP criada — ai_requests/ai_responses para Claude processar via MCP (substitui OpenRouter nos botões do ERP)
- [2026-03-29]: 4 triggers de eventos formais criados (production_completed em producao_etapas, installation_completed em ordens_instalacao, payment_received em contas_receber, payment_overdue via fn_detect_overdue_payments)
- [2026-03-29]: system_events — tabela de eventos para automação em cadeia
- [2026-03-29]: ai_memory — tabela para memory layer (padrões detectados)
- [2026-03-29]: useAIBridge.ts — hook frontend que envia para ai_requests com fallback para Edge Function
- [2026-03-29]: 3 scheduled tasks criadas: croma-orchestrator-morning (08h), croma-orchestrator-evening (22h), croma-ai-request-processor (cada 30min 08-20h)
- [2026-03-29]: WhatsApp Business API PRODUÇÃO configurado: número +55 11 93947-1862 registrado na Meta Developers Console, perfil "Croma Print" (Serviços profissionais), CromaBot com controle total sobre WABA Croma Print (1262844242060742), token permanente gerado e salvo no Supabase
- [2026-03-29]: OpenRouter manter APENAS para: auto-resposta WhatsApp, follow-ups automáticos, detecção de intenção. Resto migrar para Claude via ponte MCP
- [2026-03-30]: PLANO DEFINITIVO WhatsApp + IA criado: Worker Node.js (Fly.io) + Claude API com tool_use + Supabase Realtime + 26 tools extraídas do MCP. Custo ~R$18/mês.
- [2026-03-30]: Scheduled task whatsapp-auto-responder atualizada: frequência de 2min → 1min, prompt completo com regras de escalação, consulta a ferramentas MCP, envio WhatsApp + notificação Telegram
- [2026-03-30]: Pesquisa completa: Claude API tool_use funciona com prompt caching (90% economia), Supabase Realtime <500ms latência, Fly.io $2,32/mês
- [2026-03-30]: Decisão: OpenRouter ELIMINADO da arquitetura futura. Worker usará Anthropic API direta com prompt caching.
- [2026-03-30]: REGRA ABSOLUTA: MCP Server Croma é O SISTEMA — toda operação de dados via MCP, nunca inventar preços/dados, operar como vendedor real. Supabase direto só para configurações técnicas (DDL, RLS, migrations, Edge Functions).
- [2026-03-30]: Scheduled task whatsapp-auto-responder reescrita: agora consulta preços reais, cria propostas no sistema, é direto (máx 2-3 perguntas antes de cotar), opera como vendedor real.
- [2026-03-30]: whatsapp-enviar Edge Function v9: API Meta v22.0 + bypass horário comercial para mensagens manuais.
- [2026-03-30]: AgentConversationPage.tsx: auto-scroll para última mensagem.
- [2026-03-31]: Auditoria do agente WhatsApp: lead "Vih" testado por pessoa se passando por cliente. Agente inventava preços ao invés de usar CRM.
- [2026-03-31]: whatsapp-webhook v14: integração completa com CRM — detecta intenção via [INTENT:xxx], chama ai-gerar-orcamento para propostas reais, coleta dados cadastrais automaticamente (nome, email, empresa, cidade), envia email SMTP com link do portal.
- [2026-03-31]: PIX correto hardcoded: CNPJ 18.923.994/0001-83 | Email: junior@cromaprint.com.br (corrigido em 3 Edge Functions: whatsapp-webhook, ai-compor-mensagem, agent-enviar-email).
- [2026-03-31]: 3 Edge Functions deployadas em produção: whatsapp-webhook v15, ai-compor-mensagem v8, agent-enviar-email v7.
- [2026-03-31]: WA-01 reclassificado como CONCLUÍDO — agente WhatsApp operando com integração CRM real (não precisa mais de chip dedicado separado, já usa API Business ativa).
- [2026-03-31]: CROMA 4.0 Fase 3 concluída — agent-cron-loop v3 é o motor de execução central: varre 15+ agent_rules a cada 30min, cobrança escalonada D1→D30, PCP auto-sequenciamento.
- [2026-03-31]: CROMA 4.0 Fase 4 concluída — Score de crédito A-E implementado com 4 fatores (pagamento, volume, relacionamento, recência). 312 clientes calculados. Memory layer com 4 padrões auto-detectados. Resumo diário 22h no Telegram.
- [2026-03-31]: CROMA 4.0 Fase 5 concluída — ai-chat-erp com pipeline 3 estágios (classify→plan→execute). ChatERP floating panel no Layout. 24 query templates cobrindo 6 categorias do negócio.
- [2026-03-31]: CROMA 4.0 100% COMPLETO — 5/5 fases implementadas. Croma Print é a primeira empresa de comunicação visual gerida por IA.
- [2026-03-31]: LIMPEZA CENTRALIZAÇÃO CLAUDE — Removida aba "Modelos IA" (OpenRouter) do AgentConfigPage, removido switch auto_aprovacao_leads_frios, limpas 9 mensagens órfãs, deletados 2 templates inativos. AgentConfig agora tem 3 tabs: Geral, Templates, WhatsApp.
- [2026-03-31]: whatsapp-enviar v10 deployado — fix auth 401 (service client substitui anon client para validar JWT).
- [2026-03-31]: MAPA-IA-CROMA.md criado — inventário completo de 45 Edge Functions, 22 usam OpenRouter, plano de simplificação em 3 fases (A: limpeza imediata ✅, B: ponte MCP médio prazo, C: prospecção ativa pelo Claude longo prazo).

### Pending Todos

**CROMA 4.0 — WhatsApp Inteligente:**
- ~~Chip WhatsApp dedicado~~ ✅ CONCLUÍDO
- ~~Plano definitivo de arquitetura~~ ✅ CONCLUÍDO
- ~~Scheduled task atualizada para 1min~~ ✅ CONCLUÍDO
- ~~Webhook v14 com CRM integrado~~ ✅ CONCLUÍDO (2026-03-31)
- ~~PIX e email corrigidos~~ ✅ CONCLUÍDO (2026-03-31)
- ~~Coleta de dados cadastrais~~ ✅ CONCLUÍDO (2026-03-31)
- ~~Deploy 3 Edge Functions~~ ✅ CONCLUÍDO (2026-03-31)
- Submeter templates WhatsApp à Meta (croma_abertura, croma_followup)
- Handoff manual: botão 'assumir conversa' no ERP
- Worker Fly.io com Claude API tool_use (opcional — webhook Edge Function já funciona)

**Fase 3 — Automação de Fluxo (próximo foco):**
- Cobrança automática escalonada (D+1, D+3, D+7, D+15, D+30)
- PCP inteligente — sequenciamento automático de OPs
- Transição automática Produção→Instalação

**Fase 4 — Inteligência:**
- Cockpit executivo — tela única com KPIs + system_events
- Score de crédito de clientes
- Memory layer — padrões detectados

**Fase 5 — Conversacional:**
- Chat natural no ERP (ChatERP.tsx)
- Relatórios por linguagem natural

### Blockers/Concerns

- NF-e ainda em homologação (não produção)
- Templates WhatsApp ainda não submetidos à Meta (precisa para mensagens proativas)
- SMTP precisa estar configurado no admin_config para emails da proposta funcionarem

## Session Continuity

Last session: 2026-03-31
Stopped at: Limpeza do agente concluída — aba Modelos IA removida, switch auto_aprovacao removido, mensagens órfãs limpas, templates inativos deletados. MAPA-IA-CROMA.md criado. whatsapp-enviar v10 deployado com fix 401.
Resume file: N/A — tudo documentado nos .md

### Próximos passos imediatos
1. Submeter templates WhatsApp à Meta para mensagens proativas (WA-02)
2. Fase B do plano de simplificação — migrar botões do ERP da AI Sidebar para ponte MCP (ai_requests → Claude processa → ai_responses)
3. Verificar se email SMTP está chegando ao cliente
4. Deploy do frontend atualizado (sem aba Modelos IA) via push para main
