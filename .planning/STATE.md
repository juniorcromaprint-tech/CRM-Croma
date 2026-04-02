# Project State

## Project Reference

See: .planning/IDENTITY.md (papel, responsabilidades, regras)
See: .planning/PROJECT.md (updated 2026-03-28)
See: .planning/ROADMAP.md (created 2026-03-28)
See: docs/plano-ia/01_Estrategia/CROMA_4.0_PLANO_AUTONOMIA_TOTAL.md (CROMA 4.0)

**Core value:** Fluxo Lead → Orçamento → Pedido → Produção → Instalação → Faturamento funcionando de ponta a ponta
**Current focus:** CROMA 4.0 — Autonomia Total (empresa gerida por IA)

## Current Position

Phase: Produção — E2E completo, MCP 93 ferramentas, deploy em produção
Roadmap v1: 20/20 completo (100%) ✅
CROMA 4.0: 5/5 fases concluídas (100%) — Empresa gerida por IA
MCP Server: 93 ferramentas (expandido 91→93 em 2026-04-02, +2 ferramentas monitoramento consumíveis)
E2E: 10/10 bugs corrigidos + 1 novo (BUG-FIN-01b) encontrado e corrigido. Regras 11/11. Dados teste limpos.
Status: EM PRODUÇÃO — HP Latex 365 integrada com monitoramento de consumíveis + nível estimado de tinta
Last activity: 2026-04-02 (sessão 4 CLI) — Limpeza geral do repositório: 39 branches claude/* mergeados deletados, 54 .lock files órfãos removidos do .git, worktrees prunados, planning files commitados e pushed (34ac89d). Edge Functions delete-user e delete-job: sem pasta local, funcionam direto no Supabase.

Progress Roadmap v1:  [████████████████████] 100% (20/20) ✅
Progress CROMA 4.0:   [████████████████████] 100% (5/5 fases)
Progress Requirements: [████████████████████] 100% (35/35) ✅

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

  - [2026-04-01]: E2E MCP test — 8/12 PASS, 4 GAP. Fluxo Lead→Proposta→Pedido OK, gaps no trecho Pedido→Produção→Financeiro.
  - [2026-04-01]: CLI executou Fase 1 — MCP Server expandido de 29 para 43 ferramentas (financeiro, fiscal, qualidade, estoque, admin).
  - [2026-04-01]: PONTE COWORK→MCP CRIADA — `mcp-server/croma.cmd` + `call-tool.cjs`. Claude opera ferramentas `croma_*` via Desktop Commander em ambos ambientes.
  - [2026-04-01]: REGRA ATUALIZADA — Cowork usa MCP Server Croma como canal principal (via ponte croma.cmd). SQL direto APENAS para diagnóstico técnico.
  - [2026-04-01]: E2E Fase 2 concluída — 27/46 PASS (58,7%). 10 bugs documentados em docs/qa-reports/2026-04-01-e2e-fase2-completo.md.
  - [2026-04-01]: CLI adicionou 5 ferramentas App Campo — croma_listar_jobs_campo, croma_detalhe_job_campo, croma_listar_fotos_job, croma_criar_job_campo, croma_atualizar_job_campo. MCP Server: 48 ferramentas total.
  - [2026-04-01]: E2E Regressão Final — 9/10 bugs corrigidos + 1 novo (BUG-FIN-01b) encontrado e corrigido na mesma sessão. Preço material revertido.
  - [2026-04-01]: DECISÃO BUG-E2E-06 — CR gera APENAS na aprovação manual do pedido (transição aguardando_aprovacao→aprovado), NÃO no INSERT automático da proposta. Rationale: pedido precisa de aprovação comercial/financeira antes de gerar compromisso financeiro.
  - [2026-04-01]: Regras precificação completas — fachada e letreiro inseridas (11/11 categorias).
  - [2026-04-01]: Prompt commit+deploy montado pelo Cowork — `docs/prompts/2026-04-01-cli-commit-deploy.md`.
  - [2026-04-01]: T9 PROSPECÇÃO CALÇADOS — 282 leads importados no banco (origem_id e7e06a63). Segmentos: 26 redes, 13 indústria, 34 atacado, 209 varejo. Temperatura: 29 quentes, 26 mornos, 227 frios. Origem: 'Prospecção Calçados SP'.
  - [2026-04-01]: Templates WhatsApp Meta — 3 templates em análise (croma_proposta, croma_cobranca, croma_reativacao). Submetidos 01/04, aprovação esperada em 24-48h.
  - [2026-04-01]: T9 email HTML criado — `T9-Email-Prospeccao-Template.html` na raiz do projeto + cópia na Área de Trabalho. Template moderno baseado nos materiais visuais da Viviane.
  - [2026-04-01]: T9 simulação HTML criada — `T9-Campanha-Email-Simulacao.html` com plano completo de prospecção, segmentação, cronograma e projeção de resultado. Cópia na Área de Trabalho.
  - [2026-04-01]: Sistema tem botão Excluir lead — disponível na LeadsPage.tsx (linha 330) e LeadDetailPage.tsx (linha 258). É soft-delete: preenche excluido_em ao invés de deletar do banco. Confirmação via AlertDialog antes de executar.
  - [2026-04-01 sessão 2]: T9 emails corrigidos — 6 leads atualizados com email no banco: Pontal Calcados (sac@pontal.com.br), Pontal (sac@pontal.com.br), Di Gaspi (atendimento@digaspi.com.br), Di Gaspi - Parelheiros (atendimento@digaspi.com.br), Gabriella Calcados (atendimento@gabriellacalcados.com.br), Kallan (sac@kallan.com.br). O import inicial não mapeou o campo contato_marketing do CSV para o campo email da tabela.
  - [2026-04-01 sessão 2]: Templates WhatsApp verificados — todos 3 AINDA EM ANÁLISE na Meta (submetidos 01/04). croma_reativacao (Marketing), croma_cobranca (Utilidade), croma_proposta (Utilidade). Previsão aprovação: 02/04/2026.
  - [2026-04-02]: INTEGRAÇÃO HP LATEX 365 ↔ CRM — Modelo "LM Âncora" de custeio com 3 componentes:
    - **Tinta**: R$0,52/ml (bag paralela 3L = R$1.560). Consumo estimado via LM âncora (×21,5316) ou fallback 9,86 ml/m²
    - **Substrato**: variável por material (SM790 = R$11,64/m², Bagum = R$4,86, PET = R$15,00)
    - **Máquina**: R$2,40/m² fixo (depreciação + cabeçotes + cartucho manutenção)
  - [2026-04-02]: Migrations 113-115 aplicadas: impressora_jobs, impressora_config (12 params), impressora_proporcoes_tinta (7 cores), impressora_substrato_map (22 substratos), custo_maquina_brl, views vw_custo_real_por_pedido/op com 3 componentes
  - [2026-04-02]: MCP Server 48→54 ferramentas (+6 impressora): croma_listar_jobs_impressora, croma_resumo_impressora, croma_vincular_job_impressora, croma_registrar_jobs_impressora, croma_custo_real_pedido, croma_mapear_substrato
  - [2026-04-02]: croma_plotter_sync.py — script Python coleta EWS → calcula custos → upsert Supabase via service_role key. Lida com sleep/desligada silenciosamente.
  - [2026-04-02]: Scheduled task hp-latex-sync — coleta automática a cada 1h, seg-sex 8-18h. Sem insistência quando impressora em sleep.
  - [2026-04-02]: 10 jobs reais sincronizados: CLOVIS (21,33 m², R$409), EUGENIO (5,98 m², R$114), ML (5,13 m², R$98), ANDRE (0,45 m², R$8), WILSON (0,46 m², R$8). Total: 33,36 m², R$639,35.
  - [2026-04-02]: HP Latex 365 UUID: f7f320c9-baa8-4658-a178-fa67f8de3b9e. SM790 material_id: 1453b2b8-cbd1-453c-ad0d-e16a8c74d27f. 21/22 substratos pendentes de mapeamento para catálogo.

### Pending Todos

**T9 PROSPECÇÃO ATIVA — próximas ações pendentes:**

✅ 282 leads importados (origem_id: e7e06a63-23b0-4c9f-b872-03bfdb228e10)
✅ 6 leads com email atualizados no banco
✅ Templates WA verificados: Em análise na Meta (1 abr), aprovação ~02/04/2026

- 🔴 PRÓXIMO PASSO: Criar campanha no CRM com o email da Viviane e disparar para os 6 leads com email:
  - Pontal Calcados — sac@pontal.com.br
  - Pontal — sac@pontal.com.br
  - Di Gaspi — atendimento@digaspi.com.br
  - Di Gaspi - Parelheiros — atendimento@digaspi.com.br
  - Gabriella Calcados — atendimento@gabriellacalcados.com.br
  - Kallan — sac@kallan.com.br
  - Usar template: `T9-Email-Prospeccao-Template.html` (Área de Trabalho)
  - Edge Function: `enviar-email-campanha` (usa Resend API)
  - Tabelas: `campanhas` + `campanha_destinatarios`

- 🟡 Após aprovação WA (~02/04): disparar `croma_reativacao` para leads com WhatsApp:
  - Oscar Calçados, Mundial, Di Gaspi, Spot Shoes, Gabriella, Kallan, Di Gaspi Parelheiros
  - Filtrar no banco: origem_id = 'e7e06a63...' AND telefone LIKE '%9%' (verificar campo whatsapp)

- 📋 Plano detalhado: `T9-Campanha-Email-Simulacao.html` (Área de Trabalho)
- 📋 Template email: `T9-Email-Prospeccao-Template.html` (Área de Trabalho)

**E2E Fase 2 COMPLETA — 10/10 bugs corrigidos + deploy pendente.**
- ✅ Reverter preço Lona Flatbanner — R$10,00 restaurado
- ✅ BUG-FIN-01 — z.coerce.number() em 5 ferramentas
- ✅ BUG-FIN-01b (novo) — status "a_vencer" em criar_conta_receber
- ✅ BUG-FIN-03 — trigger usa NEW.valor_pago
- ✅ BUG-FIN-04 — status "a_pagar" em criar_conta_pagar
- ✅ BUG-E2E-05 — quantidade_por_unidade no trigger
- ✅ BUG-E2E-06 — NÃO É BUG (CR gera na aprovação manual do pedido, comportamento correto)
- ✅ BUG-E2E-07 — getAdminClient + contato_nome fix
- ✅ BUG-C4-01 — FK hint em listar_nfe
- ✅ BUG-PRODUTO-01 — preco_fixo removido do SELECT
- ✅ BUG-ESTOQUE-01 — trigger trg_atualiza_saldo_estoque
- ✅ BUG-PROD-01 — schema alinhado com banco
- ✅ Regras precificação 11/11 (fachada + letreiro inseridas)
- ✅ Commit + push + deploy Vercel CONCLUÍDO
- Submeter templates WhatsApp à Meta
- NF-e: migrar de homologação para produção SEFAZ
- Fase 3 MCP — ferramentas avançadas (WhatsApp, campanhas, compras, score crédito)

  - [2026-04-02 sessão 2]: MCP SERVER CORRIGIDO — 3 bugs raiz que causavam timeout em todas as chamadas:
    - **Bug 1**: `dist/tools/crm.js` truncado/corrompido — SyntaxError no boot. Fix: rebuild completo (`npm run build`).
    - **Bug 2**: `impressora.ts` — `structuredContent` tipado como `any[]` (inválido no SDK MCP). Fix: envolvidos em `{ items }`.
    - **Bug 3**: `sistema.ts` — chamava `.rpc("execute_sql_readonly", { query })` mas banco espera `{ query_text }`. Fix: parâmetro corrigido + `.single()` removido.
  - [2026-04-02 sessão 2]: `automacao_pausada` adicionada à tabela `agent_conversations` (estava no SKILL.md do cron mas faltava no banco).
  - [2026-04-02 sessão 2]: Cron `whatsapp-auto-responder` testado end-to-end via MCP Server — funciona sem gambiarras. Commits: `09b13a7` (fix impressora/sistema) e `ef108bc` (fix completo).

### Blockers/Concerns

- NF-e ainda em homologação (não produção)
- SMTP precisa estar configurado                                                                                                                          