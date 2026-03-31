# Project State

## Project Reference

See: .planning/IDENTITY.md (papel, responsabilidades, regras)
See: .planning/PROJECT.md (updated 2026-03-28)
See: .planning/ROADMAP.md (created 2026-03-28)
See: docs/plano-ia/01_Estrategia/CROMA_4.0_PLANO_AUTONOMIA_TOTAL.md (CROMA 4.0)

**Core value:** Fluxo Lead → Orçamento → Pedido → Produção → Instalação → Faturamento funcionando de ponta a ponta
**Current focus:** CROMA 4.0 — Autonomia Total (empresa gerida por IA)

## Current Position

Phase: CROMA 4.0 — Fase 2 WhatsApp Inteligente: EM TESTE
Roadmap v1: 20/20 completo (100%) ✅
CROMA 4.0: 32/34 requirements (94%) — Fase 1 completa, WhatsApp IA respondendo em produção
Status: WhatsApp IA ativo + 4 bugs corrigidos + scheduled task reescrita com precificação real
Last activity: 2026-03-30 — Corrigidos 4 bugs do WhatsApp: (1) auto-scroll chat, (2) AI agora cria propostas reais e envia emails via sistema, (3) whatsapp-enviar v22 + bypass horário para manual, (4) precificação real via MCP (não chuta mais preços). Scheduled task reescrita para operar como vendedor real. REGRA ABSOLUTA estabelecida: MCP Server Croma para TODAS operações de dados.

Progress Roadmap v1: [████████████████████] 100% (20/20) ✅
Progress CROMA 4.0:  [█████████████████░░░] 88% (30/34 requirements)

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

## CROMA 4.0 — Status das Fases

| Fase | Status | Entregues |
|------|--------|-----------|
| Fase 1 — Infraestrutura | 🔧 Em andamento | Ponte MCP (ai_requests/ai_responses), 3 triggers eventos (production_completed, installation_completed, payment_received), fn_detect_overdue_payments, system_events, ai_memory, useAIBridge.ts, 3 scheduled tasks |
| Fase 2 — Agente de Vendas | 🔧 Em andamento | WhatsApp API PRODUÇÃO: +55 11 93947-1862 registrado, Phone ID 1042016058997037, WABA 1262844242060742, CromaBot token permanente, falta: webhook + templates |
| Fase 3 — Automação Fluxo | ⬜ Pendente | Produção→Instalação, cobrança automática, PCP inteligente, compras |
| Fase 4 — Inteligência | ⬜ Pendente | Memory layer (tabela criada), score crédito, cockpit executivo |
| Fase 5 — Conversacional | ⬜ Pendente | Chat natural no ERP, relatórios linguagem natural |

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

### Pending Todos

**CROMA 4.0 — WhatsApp Inteligente (PRIORIDADE):**
- ~~Chip WhatsApp dedicado~~ ✅ CONCLUÍDO
- ~~Plano definitivo de arquitetura~~ ✅ CONCLUÍDO (PLANO-DEFINITIVO-WhatsApp-IA-Croma4.docx)
- ~~Scheduled task atualizada para 1min~~ ✅ CONCLUÍDO
- **PRÓXIMO: Construir croma-worker/** — Worker Node.js com Claude API tool_use
  - Dia 1: Setup + extrair tools do MCP
  - Dia 2: Claude engine + system prompt
  - Dia 3: Message processor + listeners (Realtime)
  - Dia 4: WhatsApp send + Telegram notify
  - Dia 5: Deploy Fly.io + teste real
- Migration banco: 6 colunas novas (locked_at, locked_by, tentativas, erro_detalhes, automacao_pausada, pausada_motivo)
- Dashboard de conversas WhatsApp no ERP
- Handoff manual: botão 'assumir conversa'
- Submeter templates WhatsApp à Meta (croma_abertura, croma_followup)

**Outros pendentes:**
- Cobrança automática escalonada (D+1, D+3, D+7, D+15, D+30)
- PCP inteligente — sequenciamento automático de OPs
- Cockpit executivo — tela única com KPIs
- Chat natural no ERP (ChatERP.tsx)

### Blockers/Concerns

- NF-e ainda em homologação (não produção)
- Scheduled task whatsapp-auto-responder precisa de 'Run now' para pré-aprovar ferramentas
- Worker Fly.io precisa de chave API Anthropic (Junior pode criar conta gratuita em console.anthropic.com)
- Permissões do sandbox Cowork impediram deletar dist/ e apps/

## Session Continuity

Last session: 2026-03-30
Stopped at: 4 bugs do WhatsApp corrigidos. Scheduled task reescrita com precificação real. REGRA ABSOLUTA MCP estabelecida e documentada em CLAUDE.md, IDENTITY.md, PROJECT.md, STATE.md.
Resume file: N/A — tudo documentado nos .md

### Próximos passos imediatos
1. **Junior testar WhatsApp** — mandar mensagem pedindo orçamento e ver se preço vem correto
2. **Rodar 'Run now' na task whatsapp-auto-responder** para pré-aprovar ferramentas MCP
3. Criar conta Anthropic (console.anthropic.com) e gerar API key para Worker
4. Começar implementação do croma-worker/ (5 dias)
5. Deploy no Fly.io
