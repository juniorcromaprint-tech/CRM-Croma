# Auditoria — Fluxo de Leads + Agente de Vendas IA

> **Data:** 2026-05-20 · **Modelo:** Opus 4.7 · **Escopo:** módulo comercial (Leads) + Agente de Vendas IA (WhatsApp/e-mail)
> **Ótica:** uso DIÁRIO pela equipe comercial da Croma — prospectar, atender, follow-up, gerar proposta, fechar pedido, com IA ajudando **sem colocar a empresa em risco**.
> **Status:** ENTREGA = auditoria + plano. Nenhuma correção aplicada. Execução aguarda autorização do Junior.
> **Método:** leitura do código real (frontend `src/domains/comercial` + `src/domains/agent`, edge functions `supabase/functions`), consultas ao banco de produção via MCP Croma, e cruzamento com auditorias anteriores (REQUIREMENTS v4–v7, memória 2026-05-18).

---

## 1. Visão geral do estado atual

**Diagnóstico em uma frase:** o topo do funil funciona (captação e abertura de conversa), mas o **meio e o fim quebram** (qualificação, follow-up, conversão) — e o caminho de **orçamento automático coloca a empresa em risco real** (envia proposta formal + PIX sem validar dados nem aprovação humana).

| Métrica (produção, 2026-05-20) | Valor | Leitura |
|---|---|---|
| Leads totais | **3.456** | base grande, mas estagnada |
| Leads em `novo` | **3.127** (90%) | **100% parados há +7 dias** |
| Leads `novo` sem e-mail | 1.741 | metade não pode receber proposta formal |
| Leads `novo` sem contato_nome | 1.496 | impessoaliza follow-up |
| Convertidos em cliente | **4** (~0,12%) | conversão quase nula |
| Propostas | 12 (5 enviadas, 4 aprovadas, 2 rascunho, 1 recusada) | volume baixíssimo |
| Pedidos | 8 | — |
| Mensagens do agente | 828 | 300 enviada, 215 respondida, 73 lida, 45 entregue, **195 erro** |
| **Taxa de erro de envio** | **~23,5%** | 1 em cada 4 mensagens falha |
| Última mensagem do agente | **2026-05-15** | **agente parado há 5 dias** |
| Reply rate (respondidas/enviadas) | alto (~70%) | **a abertura funciona** — gargalo é o resto |

**Conclusão:** a máquina de prospecção entrega volume e a mensagem de abertura engaja bem. O problema não é "gerar lead" — é **qualificar, dar sequência e converter com segurança**. Pior: o módulo que mais precisa de trava (orçamento automático via WhatsApp) é o que está mais aberto.

> ⚠️ **Observação de processo:** a auditoria de 2026-05-18 referenciada na memória aponta para `docs/qa-reports/2026-05-18-audit-vendas-ia-leads.md`, **que não existe no repositório**. As 4 conclusões dela (modelo grátis, limite 15/dia, campanha 100% erro, sweep `.select().single()`) **seguem sem correção** e estão reconsolidadas aqui.

---

## 2. Mapa dos arquivos analisados

### Frontend — Leads / comercial (`src/domains/comercial/`)
- `pages/LeadsPage.tsx` — lista paginada (lê `vw_leads_disparo`), cesta, dialog novo lead, disparo em massa.
- `pages/LeadDetailPage.tsx` — detalhe/edição + **conversão lead→cliente** + soft-delete + timeline de e-mail.
- `pages/CampanhasPage.tsx` — gestão de campanhas (status).
- `hooks/useLeads.ts` — query/CRUD do lead (lista, detalhe, create, update, stats).
- `hooks/useLeadsDisparo.ts` — `vw_leads_disparo` + contadores por segmento.
- `hooks/useLeadsSelection.ts` — seleção múltipla (sessionStorage).
- `hooks/useExcluirLead.ts` — soft-delete individual e em lote (corretos).
- `hooks/useDispararAbertura.ts` / `useLeadSegments.ts` / `useAgentCampanhas.ts` — disparo, segmentos, campanhas.
- `components/leads/*` — LeadCard, LeadsCardList, LeadsTable, LeadsCesta, LeadsBulkActionBar, LeadsFilters, DispararAberturaModal, CampanhaSelector, QuickCriarCampanhaDialog, CampanhaBanner, SegmentoPills, SegmentoSalvoLoader, EmailTimeline.

### Frontend — Agente (`src/domains/agent/`)
- `pages/` — AgentDashboardPage, AgentConversationPage (**2º caminho de conversão lead→cliente**), AgentApprovalPage, AgentConfigPage.
- `hooks/` — useAgentActions, useAgentConversations, useAgentMessages, useWhatsAppStatus.
- `components/` — OrcamentoApprovalCard, ConversationDetail, WhatsAppStatusCard, QualifyLeadButton.

### Backend — Edge Functions (`supabase/functions/`)
- `whatsapp-webhook/index.ts` (1.811 linhas) — inbound, match de lead, signature, extração de dados, resposta IA, **dispara orçamento**.
- `whatsapp-enviar/index.ts` — outbound + limite diário (RPCs `fn_contar_enviadas_hoje` / `fn_limite_diario_efetivo`).
- `ai-gerar-orcamento/index.ts` — gera proposta real (preço determinístico via pricing-engine). **Sem auth própria.**
- `ai-detectar-intencao-orcamento`, `ai-qualificar-lead`, `ai-compor-mensagem`, `ai-decidir-acao` — IA de classificação/composição/decisão.
- `agent-cron-loop/index.ts` — follow-ups agendados.
- `dispatch-approved-messages/index.ts` — dispara mensagens aprovadas (rampa).
- `agent-enviar-email`, `ai-enviar-nps`, `enviar-email-campanha`, `buscar-leads-google`, `enriquecer-cnpj`.
- `_shared/ai-helpers.ts` (CORS allowlist + auth HMAC), `openrouter-provider.ts`, `whatsapp-credentials.ts`.
- `supabase/config.toml` — **NÃO EXISTE** → `verify_jwt` não declarado por função (não versionado).

### Regras de negócio (devem ser cumpridas)
- `.claude/rules/agent-vendas-coleta-dados.md` — coletar nome/e-mail/empresa/cidade **antes** de orçar.
- `.claude/rules/supabase-mutations.md` — todo insert/update com `.select().single()`.
- `.claude/rules/alert-dialog-async.md` — `AlertDialogAction` async com `e.preventDefault()`.

---

## 3. Mapa de tabelas / funções analisadas

| Objeto | Papel | Observação da auditoria |
|---|---|---|
| `leads` | base de prospecção (37 colunas) | 3.456 linhas; `vw_leads_disparo` filtra `excluido_em IS NULL` |
| `cliente_contatos` | contatos do cliente | insert na conversão **sem `.select().single()`**; clona empresa→nome |
| `clientes` | clientes convertidos | coluna `excluido_em` existe (filtros de conversão válidos) |
| `agent_conversations` | conversas do agente | tem `campanha_id` (migration 140) |
| `agent_messages` | mensagens enviadas/recebidas | 828 linhas, 23,5% em `erro`; sem `lead_id` (só `conversation_id`) |
| `agent_campanhas` | campanhas (mestre nova UX) | nomenclatura PT (`criada_em`); 7 colunas de canal |
| `campanhas` | campanhas legacy | só leitura, FK de `leads.campanha_id` |
| `propostas` / `proposta_itens` | propostas geradas | 12 propostas; `share_token_active` controla portal |
| `admin_config` (`agent_config`) | config do agente | `modelo_qualificacao` grátis, `max_contatos_dia=15`, `auto_aprovacao=false` |
| `produto_modelos` / `modelo_materiais` | motor de preço (Mubisys) | usado por `ai-gerar-orcamento`; BOM vazia gera preço 0 (achado v6 DB-007) |
| `lead_segments` | segmentos salvos | migration 150 |
| **RPCs** | `fn_disparar_abertura_em_massa`, `fn_contar_enviadas_hoje`, `fn_limite_diario_efetivo`, `fn_validar_transicao_status`, `registrar_atividade_comercial` | última existe mas **não é chamada** nas telas de lead |

---

## 4. Fluxo atual de Leads (real do código)

1. **Lista** — `LeadsPage` → `useLeadsDisparo(filters)` lê `vw_leads_disparo` (filtra excluídos), **ordena só por `created_at desc`**, 50/página. Filtros na URL, cesta em sessionStorage (cross-página).
2. **Novo lead** — dialog → `verificarDuplicata` (busca em `leads`, **sem filtrar excluídos**) → insert direto.
3. **Disparo** — cesta → `DispararAberturaModal` → RPC `fn_disparar_abertura_em_massa` (e-mail/WhatsApp, com campanha opcional).
4. **Detalhe** — `useLead(id)` → editar (`useUpdateLead` valida transição) → **Converter em Cliente**: checa CNPJ duplicado (bloqueia) + razão social (confirma) → cria cliente → insert `cliente_contatos` → marca lead `convertido` → navega p/ `/clientes/:id`.
5. **2º caminho idêntico** de conversão dentro do `AgentConversationPage`.
6. **NÃO há** geração de proposta a partir da tela de lead, nem registro de histórico de contato manual, nem alerta de follow-up vencido.

## 5. Fluxo atual do Agente de Vendas (real do código)

1. **Inbound** POST no `whatsapp-webhook` → `validateSignature`. Se `WHATSAPP_APP_SECRET` ausente → **retorna `true` (aceita sem validar)**.
2. **Match de lead** — `.ilike('contato_telefone','%'+ult10dígitos+'%').limit(1)` → match por substring (pode colidir).
3. **Extração estruturada** (Claude) → grava nome (anti-cargo/anti-bot), e-mail/CNPJ validados; `contato_nome` é atualizado corretamente aqui.
4. `checkDadosFaltantes` calcula faltantes e **injeta no prompt** (instrução, não trava).
5. **Resposta** gerada por `claude-sonnet-4` (pago — bom).
6. **Gate de orçamento** — se intent = `orcamento`/`formalizar` → chama `ai-gerar-orcamento` **direto, sem checar `dadosFaltantes` em código**.
7. `ai-gerar-orcamento` — IA **infere itens e dimensões**, match em `produto_modelos`, preço determinístico, cria proposta `rascunho` com `share_token_active:true`, monta URL do portal.
8. **Envio direto ao WhatsApp** com link + PIX, **sem aprovação humana** (apesar de `agent_config.auto_aprovacao=false`).
9. **Follow-ups** — `agent-cron-loop` → `ai-decidir-acao`/`ai-compor-mensagem`.

---

## 6. Bugs encontrados

| ID | Arquivo:linha | Descrição | Sev |
|---|---|---|---|
| BUG-01 | `useLeads.ts:158-162` | `useLeads()` (lista) não filtra `excluido_em IS NULL` → leads excluídos reaparecem (consumido por `LeadDiscoveryDialog`). | P1 |
| BUG-02 | `LeadDetailPage.tsx:257-268`, `AgentConversationPage.tsx:558-569` | insert em `cliente_contatos` **sem `.select().single()`** → bloqueio RLS silencioso: cliente criado sem contato, só `console.error`. | P1 |
| BUG-03 | `LeadDetailPage.tsx:259`, `AgentConversationPage.tsx:560` | `nome: lead.contato_nome \|\| lead.empresa` → quando contato é NULL, **clona o nome da empresa como nome de pessoa** e marca `principal/e_decisor=true`. Cria contato-fantasma (foi o caso "Marcos/SI"). | P1 |
| BUG-04 | `whatsapp-webhook:1458` | Match de lead por `ilike '%10díg%'` + `.limit(1)` → pode atribuir conversa/orçamento ao **lead errado**. | P1 |
| BUG-05 | `dispatch-approved-messages:102-104` | Contador diário conta só `status='enviada'` (diverge do `whatsapp-enviar` v27) → pode subcontar e **estourar limite Meta**. | P2 |
| BUG-06 | `LeadsPage.tsx:185-187` | `verificarDuplicata` ignora `excluido_em` → falso alerta de duplicata contra lead já excluído. | P2 |
| BUG-07 | `LeadDetailPage.tsx:213`, `AgentConversationPage.tsx:522` | Checagem de razão social usa `.ilike(...)` **sem wildcards** → só match exato (apesar do comentário "parecida"). | P2 |
| BUG-08 | `LeadDetailPage.tsx:896-898` | `AlertDialogAction` de exclusão sem `e.preventDefault()` → dialog fecha antes; spinner `isPending` nunca aparece. | P2 |
| BUG-09 | `useLeads.ts:209,361` | Paginação com cap de 10 páginas (10k) **trunca silenciosamente** — contagens erradas em base grande. | P3 |
| BUG-10 | `whatsapp-webhook:805-834` | `gerarOrcamentoReal` confunde `info_faltante` com erro → vira "não consegui gerar" silencioso. | P3 |

## 7. Gaps operacionais (uso diário da equipe)

| ID | Onde | Descrição | Sev |
|---|---|---|---|
| GAP-01 | regra `agent-vendas-coleta-dados.md` | **`checkDadosFaltantes` não existe em código.** Nenhuma trava exige nome/e-mail/empresa/cidade antes de orçar/converter. | P1 |
| GAP-02 | `useLeadsDisparo.ts:176` | Lista ordena **só por `created_at`** — sem ordenar por última interação, temperatura, score ou valor. Equipe não consegue priorizar quem atender. | P1 |
| GAP-03 | `LeadCard.tsx` / lista | **Sem indicador de follow-up vencido** — `proximo_contato` é editável mas não há alerta de "retornar hoje" em lugar nenhum. | P1 |
| GAP-04 | telas de lead | **Sem registro de histórico de contato** (ligação/visita/WhatsApp manual). `registrar_atividade_comercial` existe mas nenhuma tela chama. | P1 |
| GAP-05 | pipeline | 3.127 leads `novo` parados; com `max_contatos_dia=15` levaria **~208 dias** para tocar todos. | P1 |
| GAP-06 | tela de lead | Sem botão "gerar orçamento" a partir do lead qualificado (hoje só via WhatsApp automático ou manual no /orcamentos). | P2 |

## 8. Riscos técnicos

| ID | Descrição | Sev |
|---|---|---|
| TEC-01 | Erros silenciosos de RLS (BUG-02 e qualquer insert sem `.select().single()`) → dados perdidos sem feedback. | P1 |
| TEC-02 | Agente **parado desde 15/05** com 195 erros (23,5%). **Causa verificada (não é IA/OpenRouter):** erros de entrega do **Meta WhatsApp** — 49× cód. 131047 (janela de 24h fechada → exige template aprovado), 50× cód. 132000 (template), 71× "undeliverable". O agente tenta mandar texto livre fora da janela de 24h e a Meta bloqueia. Falta cadência baseada em templates + monitor/alarme. | P1 |
| TEC-03 | Match de lead por substring (BUG-04) corrompe atribuição de conversas. | P1 |
| TEC-04 | Duas tabelas de campanha (`campanhas` legacy × `agent_campanhas`) → risco de inconsistência ao vincular leads. | P2 |
| TEC-05 | Args do cliente/LLM usados sem validação Zod em `ai-gerar-orcamento:181` (cast `as`). | P2 |

## 9. Riscos comerciais

| ID | Descrição | Sev |
|---|---|---|
| COM-01 | **Proposta formal + PIX enviada automaticamente** a lead sem nome/e-mail/cidade, sem aprovação humana (`webhook:1713-1748`, apesar de `auto_aprovacao=false`). Cliente recebe cobrança/preço da Croma sem revisão. | **P0** |
| COM-02 | **Preço por dimensão inferida pela IA** (`ai-gerar-orcamento:31-46` manda "SEMPRE inferir dimensões padrão") → preço de m² possivelmente errado num documento formal. | P1 |
| COM-03 | **Verificado** (código + nota `2026-05-04-arquitetura-agente-vendas.md` + deploy v28): a **resposta ao cliente É Claude Sonnet 4, mas passa pelo OpenRouter** (API externa, `OPENROUTER_API_KEY`). A **qualificação** usa o modelo **grátis** `glm-4.5-air:free` e a **composição** usa `gpt-4.1-mini` (OpenAI) — nenhum dos dois é Claude. A nota de 04/05 escolheu OpenRouter de propósito ("não migrar p/ Anthropic direta sem ganho"). Junior (20/05) quer reavaliar rodar **só no Claude**. **Decisão pendente** (ver Fase 2, item 10). | P1 |
| COM-04 | Mensagem hardcoded assina "Junior - Croma Print" e promete total/PIX automaticamente (`webhook:1727-1745`). | P2 |
| COM-05 | Conversão com contato-fantasma (BUG-03) → follow-up impessoal e CRM sujo. | P1 |

## 10. Riscos de segurança

| ID | Arquivo:linha | Descrição | Sev |
|---|---|---|---|
| SEC-01 | `whatsapp-webhook:220-222` | `validateSignature` retorna `true` quando `WHATSAPP_APP_SECRET` ausente → **qualquer um forja payload Meta** e dispara resposta/orçamento/PIX em nome da Croma. | **P0** |
| SEC-02 | `ai-gerar-orcamento:177-189` | **Sem autenticação própria** — cria proposta+cliente só com `lead_id`. Depende do `verify_jwt` do gateway. | **P0** |
| SEC-03 | `supabase/` (sem `config.toml`) | `verify_jwt` **não versionado** por função → segurança implícita, frágil a redeploy. Bate com achados v7 INT-002/INT-003 e v5 SEC-007. | **P0** |
| SEC-04 | `_shared/ai-helpers.ts` (HMAC) | Fallback aceita JWT **payload-only** (`role:service_role` + header) sem verificar assinatura → token forjável se gateway não bloquear. | P1 |
| SEC-05 | `whatsapp-webhook` (prompt) | **Prompt injection**: conteúdo do cliente entra no prompt sem sanitização e pode induzir `intent=formalizar` → gera proposta/PIX. | P1 |
| SEC-06 | `dispatch-approved-messages` | CORS `Access-Control-Allow-Origin:'*'` (mitigado por auth service_role). | P3 |

> Pontos OK (não são achados): credenciais WhatsApp vêm de `admin_config` (não hardcoded); CORS das funções IA usa allowlist; PIX/e-mail hardcoded conforme regra.

## 11. Problemas de UX/UI

| ID | Arquivo:linha | Descrição | Sev |
|---|---|---|---|
| UX-01 | `LeadsPage.tsx:272` | Cesta fica como 2ª coluna só no desktop; **no mobile renderiza abaixo da lista inteira** → scroll longo até disparar. Junior usa muito pelo celular. | P2 |
| UX-02 | `LeadDetailPage.tsx:411-434` | View mistura campos legados (`telefone`/`email`) com `contato_*`, mas edição só altera `contato_*` → campos visíveis e **não-editáveis**, confuso. | P2 |
| UX-03 | telas de lead | Sem feedback de "quantos leads foram efetivamente enviados" após disparo (depende do modal). | P3 |
| UX-04 | lista de leads | Sem visão de "minha fila de hoje" / triagem por temperatura — relacionado a GAP-02/03. | P1 |

## 12. Problemas de IA e automação

| ID | Onde | Descrição | Sev |
|---|---|---|---|
| IA-01 | `ai-qualificar-lead` (via OpenRouter) | Qualificação roda no modelo **grátis** `glm-4.5-air:free` (não-Claude) → classificação fraca de lead B2B. Opções: (A) trocar por modelo melhor mantendo OpenRouter, ou (B) migrar o agente p/ `anthropic-provider.ts` (Claude Haiku/Sonnet direto, zero externo). Ligada à decisão COM-03. | P1 |
| IA-02 | `agent_config.max_contatos_dia=15` | Gargalo: 3.127 leads em `novo` levariam ~208 dias. Subir gradual (rampa) p/ 40–60. | P1 |
| IA-03 | `ai-gerar-orcamento` | IA infere dimensões → preço formal errado (ver COM-02). | P1 |
| IA-04 | `whatsapp-webhook` gate | Orçamento dispara sem trava de dados nem aprovação humana (ver COM-01). | **P0** |
| IA-05 | `ai-qualificar-lead:84`, `detectar:114` | `model` aceito do payload sem allowlist → caller pode forçar modelo arbitrário. | P3 |
| IA-06 | campanha 100% erro (memória 18/05) | Campanha de calçados SP com 50 msgs criadas / 0 enviadas — diagnosticar e pausar. | P1 |

---

## 13. Priorização P0/P1/P2/P3

**P0 — Crítico (a empresa está em risco AGORA, resolver antes de reativar o agente):**
- SEC-01 webhook aceita payload sem signature
- SEC-02 `ai-gerar-orcamento` sem auth
- SEC-03 `verify_jwt` não versionado (criar `config.toml`)
- COM-01 / IA-04 orçamento formal + PIX automático, sem trava de dados nem aprovação humana

**P1 — Alto (destrava conversão e protege dados — esta semana):**
BUG-01, BUG-02, BUG-03, BUG-04 · GAP-01, GAP-02, GAP-03, GAP-04, GAP-05 · TEC-01, TEC-02, TEC-03 · COM-02, COM-03, COM-05 · SEC-04, SEC-05 · UX-04 · IA-01, IA-02, IA-03, IA-06

**P2 — Médio (próximo sprint):**
BUG-05, BUG-06, BUG-07, BUG-08 · GAP-06 · TEC-04, TEC-05 · COM-04 · UX-01, UX-02

**P3 — Baixo (backlog):**
BUG-09, BUG-10 · SEC-06 · UX-03 · IA-05

---

## 14. Plano de correção faseado

### FASE 0 — Contenção de risco (1 dia · só backend/config · ANTES de religar o agente)
1. Criar `supabase/config.toml` declarando `verify_jwt=true` em `ai-gerar-orcamento`, `whatsapp-webhook` (com validação de signature interna), e revisar as demais (SEC-03).
2. `validateSignature`: **falhar fechado** quando `WHATSAPP_APP_SECRET` ausente (SEC-01). Setar o secret no Supabase.
3. `ai-gerar-orcamento`: exigir auth (service_role/JWT) (SEC-02).
4. **Trava de dados + aprovação**: orçamento via WhatsApp passa a (a) chamar `checkDadosFaltantes` em código e **só gerar** com nome+e-mail+empresa+cidade; (b) cair na fila de **aprovação humana** (`OrcamentoApprovalCard`) em vez de enviar direto — respeitando `auto_aprovacao=false` (COM-01/IA-04).

### FASE 1 — Confiabilidade de dados (2–3 dias · backend + frontend)
5. Sweep `.select().single()` nos inserts de conversão (`cliente_contatos`) e demais hooks críticos (BUG-02/TEC-01).
6. Conversão: **não clonar empresa→nome**; se `contato_nome` nulo, gravar contato "A definir" e pedir o nome (BUG-03/COM-05).
7. `useLeads`/`verificarDuplicata`: filtrar `excluido_em IS NULL` (BUG-01/BUG-06).
8. Match de lead por telefone **normalizado e exato** (não substring) (BUG-04/TEC-03).
9. Monitor de erro de envio + alerta quando taxa > 10% ou agente parado >24h (TEC-02); diagnosticar campanha 100% erro (IA-06).

### FASE 2 — Destravar conversão (3–5 dias · frontend + config)
10. **Decidir o provider de IA do agente** (COM-03/IA-01): manter **OpenRouter** (decisão documentada de 04/05) OU **migrar p/ Claude direto** via `anthropic-provider.ts` (drop-in já existe — trocar o import nas 5 funções `whatsapp-webhook`, `ai-qualificar-lead`, `ai-compor-mensagem`, `ai-gerar-orcamento`, `ai-detectar-intencao-orcamento`; usa `ANTHROPIC_API_KEY`, confirmar key ativa + saldo). Em qualquer caso: **tirar a qualificação do modelo grátis**. Subir `max_contatos_dia` em rampa (IA-02).
11. Lista de leads: ordenação por última interação/temperatura + **fila "Atender hoje"** com follow-up vencido (GAP-02/03/UX-04).
12. Botão "Registrar contato" chamando `registrar_atividade_comercial` na tela de lead (GAP-04).
13. Botão "Gerar orçamento" a partir do lead qualificado, com a trava de dados (GAP-01/06).
14. `ai-gerar-orcamento`: quando faltar dimensão, marcar `info_faltante` e **pedir medida/foto** em vez de chutar (IA-03/COM-02/BUG-10).

### FASE 3 — Polimento (backlog)
15. UX mobile da cesta (UX-01); limpar campos legados na tela de lead (UX-02); allowlist de modelos (IA-05); validação Zod (TEC-05); paginação sem cap silencioso (BUG-09); contador de envio unificado (BUG-05).

---

## 15. Critérios de aceite

- **CA-1 (FASE 0):** nenhum endpoint do agente cria proposta/cliente sem auth; webhook rejeita payload sem signature válida; orçamento NÃO é enviado sem dados completos E sem aprovação humana.
- **CA-2:** conversão lead→cliente nunca grava nome de pessoa = nome da empresa; insert de contato detecta bloqueio RLS e avisa na tela.
- **CA-3:** leads excluídos não aparecem em nenhuma lista nem na checagem de duplicata.
- **CA-4:** uma mensagem inbound só casa com 1 lead pelo telefone normalizado exato.
- **CA-5:** a equipe vê, em até 2 cliques, "quem atender hoje" (follow-up vencido + temperatura).
- **CA-6:** qualificação roda em modelo pago; limite diário sobe sem disparar bloqueio da Meta.
- **CA-7:** orçamento com dimensão faltante pede a medida em vez de inferir.

## 16. Testes necessários

- **Build/types:** `npx tsc --noEmit`, `npx vite build` (pré-requisito: `corepack enable && corepack prepare pnpm@9.15.0 --activate` — ambiente pnpm está quebrado).
- **Unit/integração (Vitest):** `npx vitest run` — cobrir `checkDadosFaltantes`, conversão lead→cliente (contato nulo), match de telefone, filtro de excluídos.
- **Segurança (manual/curl):** POST no `whatsapp-webhook` sem signature → 401; chamada a `ai-gerar-orcamento` sem auth → 401.
- **E2E (skill `/e2e` via MCP):** inbound WhatsApp → lead sem dados → agente PEDE dados (não orça); inbound com dados completos → gera rascunho → cai em aprovação → Junior aprova → envia.
- **Dados (MCP SQL):** após FASE 1, zero `cliente_contatos` com nome = razão social; zero leads excluídos em listas.
- **Carga leve:** rampa de `max_contatos_dia` monitorando taxa de erro < 10%.

## 17. Checklist final de validação

- [ ] `config.toml` criado e `verify_jwt` revisado por função (SEC-03)
- [ ] `WHATSAPP_APP_SECRET` setado + webhook falha fechado sem signature (SEC-01)
- [ ] `ai-gerar-orcamento` exige auth (SEC-02)
- [ ] Orçamento só gera com dados completos + passa por aprovação humana (COM-01/IA-04)
- [ ] Inserts de conversão com `.select().single()` (BUG-02)
- [ ] Conversão não clona empresa→nome (BUG-03)
- [ ] Listas/duplicata filtram `excluido_em` (BUG-01/BUG-06)
- [ ] Match de lead por telefone normalizado exato (BUG-04)
- [ ] Monitor/alerta de erro de envio + campanha 100% erro diagnosticada (TEC-02/IA-06)
- [ ] `modelo_qualificacao` pago + `max_contatos_dia` em rampa (IA-01/IA-02)
- [ ] Fila "Atender hoje" + ordenação por interação/temperatura (GAP-02/03)
- [ ] Botão "Registrar contato" (GAP-04) e "Gerar orçamento" do lead com trava (GAP-01/06)
- [ ] `npx tsc --noEmit` e `npx vite build` sem erro
- [ ] `npx vitest run` verde
- [ ] E2E do fluxo de orçamento com aprovação aprovado pelo Junior

---

*Achados cruzados com auditorias anteriores (REQUIREMENTS v4–v7) e memória 2026-05-18. Nenhuma alteração de código foi feita nesta entrega.*
