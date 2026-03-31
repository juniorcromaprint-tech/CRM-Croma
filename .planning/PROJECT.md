# ERP-Croma — CRM/ERP para Croma Print Comunicação Visual

## What This Is

Sistema ERP/CRM completo para a Croma Print, empresa de comunicação visual profissional (fachadas ACM, banners, PDV, envelopamento, letreiros). Atende equipe interna (desktop) e técnicos de campo (PWA mobile). O objetivo final é ser a primeira empresa de comunicação visual gerida quase exclusivamente por IA.

## Core Value

O fluxo Lead → Orçamento → Pedido → Produção → Instalação → Faturamento deve funcionar de ponta a ponta sem falhas — é o coração financeiro da empresa.

## Requirements

### Validated

<!-- Shipped e confirmados nos 4 sprints + 5 bugs E2E corrigidos -->

- [x] **SEC-01**: RLS em 8 tabelas críticas (clientes, propostas, pedidos, leads, contas_*)
- [x] **SEC-02**: AuthContext com default role = comercial (sem bypass null-role)
- [x] **SEC-03**: Rota /tv protegida com autenticação
- [x] **SEC-04**: Mapa de transições de status nos pedidos
- [x] **FLOW-01**: Fluxo completo Lead→Faturamento operacional
- [x] **FLOW-02**: Guards de idempotência (OP e contas_receber)
- [x] **FLOW-03**: gerarContasReceber transacional
- [x] **PERF-01**: Lazy loading em todas as rotas (100+ chunks)
- [x] **PERF-02**: Paginação server-side em listagens
- [x] **PERF-03**: N+1 do orçamento corrigido (23→2 queries)
- [x] **TEST-01**: 102 testes automatizados (Vitest)
- [x] **FIN-01**: Parser CNAB 400 retorno (baixa automática boletos)
- [x] **REL-01**: Relatórios exportáveis (Excel + PDF)
- [x] **FISC-01**: NF-e em homologação SEFAZ
- [x] **MKT-01**: Campanhas comerciais (Edge Function Resend)
- [x] **LOCK-01**: Lock otimista (campo version em pedidos/propostas)
- [x] **ORC-01**: Motor Mubisys de precificação (9 passos)
- [x] **ORC-02**: 464 materiais com preço real + 156 modelos com markup
- [x] **AI-01**: 12 Edge Functions de IA via OpenRouter
- [x] **AI-02**: AI Sidebar com 20+ appliers de contexto
- [x] **CAMPO-01**: App de Campo PWA (campo-croma.vercel.app)
- [x] **CAMPO-02**: Bridge ERP↔Campo com views e triggers de sincronização

### Active

<!-- Bugs e gaps identificados na auditoria 2026-03-21 -->

- [ ] **BUG-01**: Status faturado não funciona corretamente
- [ ] **BUG-02**: NCM null em produtos (fiscal quebra)
- [ ] **BUG-03**: Pagamento desconectado do fluxo
- [ ] **BUG-04**: Comissões sem cálculo
- [ ] **BUG-05**: Dimensões não propagam no orçamento
- [ ] **GAP-01**: Financeiro cego (sem dashboard consolidado)
- [ ] **GAP-02**: Boleto manual (sem integração bancária automática)
- [ ] **GAP-03**: Sem reserva de estoque ao criar pedido
- [ ] **GAP-04**: Gantt decorativo (sem função real na produção)
- [ ] **GAP-05**: Alertas e notificações inexistentes
- [ ] **GAP-06**: Funil comercial incompleto
- [ ] **GAP-07**: Proposta→Pedido com gaps de dados
- [ ] **PROD-01**: Contratos recorrentes
- [ ] **PROD-02**: NPS e satisfação do cliente
- [ ] **PROD-03**: PIX como forma de pagamento
- [ ] **PROD-04**: RFQ (solicitação de cotação fornecedores)
- [ ] **PROD-05**: Approval workflow (aprovações em cadeia)
- [ ] **AI-03**: Agente de Vendas multicanal completo
- [ ] **AI-04**: AI Orçamento com detecção de intenção e proposta automática
- [ ] **TELE-01**: Gestão completa via Telegram (o Junior gerencia tudo pelo celular)

### Out of Scope

- Multi-tenant / SaaS — sistema é exclusivo da Croma Print
- App nativo iOS/Android — PWA é suficiente para campo
- ERP genérico — todas as regras são específicas para comunicação visual
- Migração de banco — Supabase é definitivo

## Context

- Empresa com 6 funcionários de produção, faturamento médio R$ 110k/mês
- Clientes de referência: Beira Rio, Renner, Paquetá
- Stack: React 19 + TypeScript + Vite + Tailwind + shadcn/ui + Supabase
- 51 tabelas base + 15 migrations executadas
- Deploy automático via Vercel (main → crm-croma.vercel.app)
- IA: Edge Functions via OpenRouter; WhatsApp/Agentes via Claude API direta
- MCP Server Croma é a interface oficial para TODAS operações de dados
- Dono (Junior) opera pelo celular via Telegram/Cowork

## Constraints

- **Stack**: React 19 + TypeScript + Vite + Supabase — não mudar
- **UI Language**: Todo texto visível ao usuário em português brasileiro
- **Code Language**: TypeScript/inglês para variáveis e funções
- **Design**: rounded-2xl cards, rounded-xl inputs, bg-blue-600 primary
- **Supabase**: Todo insert/update DEVE usar .select().single() para detectar RLS
- **AlertDialog**: Toda mutation em AlertDialogAction DEVE usar e.preventDefault()
- **Auth**: ProtectedRoute obrigatório em todas as rotas (exceto /p/:token e /nps/:token)
- **IA Provider**: Edge Functions usam OpenRouter. WhatsApp/Agentes usam Claude API direta. MCP Server Croma é a interface principal para TODAS as operações de dados

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase como backend | Auth + DB + Storage + Edge Functions integrados | ✓ Good |
| OpenRouter como IA provider | Flexibilidade de modelos, melhor custo | ✓ Good |
| PWA para campo (não nativo) | Menor custo, deploy instantâneo via Vercel | ✓ Good |
| Motor Mubisys para precificação | 9 passos reflete realidade do custeio gráfico | ✓ Good |
| Lazy loading em todas rotas | Performance melhorou significativamente | ✓ Good |
| Lock otimista com campo version | Previne conflitos em edição simultânea | ✓ Good |
| RLS granular por role | Segurança sem complexidade de middleware | ✓ Good |
| e.preventDefault() em AlertDialogAction | Radix UI fecha dialog antes de async completar | ✓ Good — REGRA |
| .select().single() em mutations | RLS silencioso retorna 0 rows sem erro | ✓ Good — REGRA |
| MCP Server Croma = sistema oficial | Toda operação de dados via MCP, nunca inventar/estimar | ✓ Good — REGRA ABSOLUTA |
| Nunca inventar preços | Sempre consultar materiais + produto_modelos + regras_precificacao | ✓ Good — REGRA |
| Operar como vendedor real | Criar propostas reais, enviar emails reais, não prometer sem executar | ✓ Good — REGRA |
| WhatsApp IA usa Claude API direta | Scheduled task + futuro Worker Fly.io com tool_use | ✓ Good |

---
*Last updated: 2026-03-30 — regra MCP absoluta + WhatsApp IA fixes*
