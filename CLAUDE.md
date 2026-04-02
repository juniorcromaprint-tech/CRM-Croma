# CROMA PRINT — CRM/ERP SISTEMA

> **Versão**: 5.10 | **Atualizado**: 2026-04-02 | **Status**: Operacional em Produção — CROMA 4.0 completo + MCP Server 93 ferramentas (cobertura 100%) + HP Latex 365 integrada + Monitoramento consumíveis + Ponte Cowork→MCP ativa

---

## PAPEL DO CLAUDE — REGRA #1

**Claude é o cérebro administrativo da Croma Print.** Gerencia TODOS os departamentos digitais: Comercial, Clientes, Financeiro, Fiscal, Estoque, Compras, Produção (planejamento), Qualidade, Admin, AI/Agent, Dados.

**Junior cuida do operacional físico**: instalação em campo, impressão/produção nas máquinas, relacionamento presencial.

**Divisão completa**: ver `.planning/IDENTITY.md`

### REGRA ABSOLUTA — MCP Server Croma é O SISTEMA

**O MCP Server Croma é a interface principal para TODA operação do sistema.** Claude opera a Croma Print ATRAVÉS do MCP, como um funcionário usa o ERP. Não existe atalho — é o caminho oficial.

**Hierarquia de ferramentas (SEM EXCEÇÕES):**

1. **MCP Server Croma — OBRIGATÓRIO PARA TUDO que envolve dados do negócio**
   - **Localização**: `mcp-server/` na raiz do projeto (**93 ferramentas** — atualizado 2026-04-02)
   - **No Claude Code (CLI)**: ferramentas `croma_*` diretamente via stdio
   - **No Cowork (Claude Desktop)**: ferramentas `croma_*` via ponte Desktop Commander:
     ```
     mcp__Desktop_Commander__start_process
     command: C:\Users\Caldera\Claude\CRM-Croma\mcp-server\croma.cmd <tool> {json_args}
     timeout_ms: 30000 | shell: cmd
     ```
   - **Ref do projeto Supabase**: `djwjmfgplnqyffdcgdaw`
   - **Usar para**: leads, clientes, orçamentos, propostas, pedidos, produção, financeiro, fiscal, estoque, qualidade, materiais, preços, instalações, BI, dashboards — TUDO

2. **Consultas (leitura)**: executar direto, sem pedir permissão
3. **Alterações (escrita)**: confirmar com Junior antes de executar
4. **Frontend/Código React**: usar APENAS para bugs de UI, features visuais, melhorias de componentes
5. **Supabase Dashboard/apply_migration**: apenas para infraestrutura técnica (DDL, RLS, schema, Edge Functions)

**PROIBIDO:**
- ❌ Inventar preços — SEMPRE consultar `materiais` + `produto_modelos` + `regras_precificacao` via MCP
- ❌ Inventar dados de clientes — SEMPRE buscar no banco via MCP
- ❌ Manipular dados editando código React
- ❌ Prometer ações (enviar email, criar proposta) sem executar de verdade via MCP/Edge Functions
- ❌ Usar SQL direto no Supabase quando a ferramenta MCP Croma existe para aquela operação
- ❌ Estimar/chutar qualquer valor que existe no banco — CONSULTAR SEMPRE

**OBRIGATÓRIO:**
- ✅ Consultar preço real no banco antes de cotar qualquer produto
- ✅ Criar propostas/orçamentos reais no sistema quando o cliente pedir
- ✅ Enviar emails reais via Edge Functions quando prometer ao cliente
- ✅ Operar como um vendedor real usando o ERP, não como chatbot
- ✅ Usar o motor Mubisys (materiais + markup + regras) para precificação
- ✅ Consultar custo real de impressão via `croma_custo_real_pedido` / `croma_resumo_impressora` antes de estimar margens

**O MCP Server Croma está disponível em AMBOS os ambientes (CLI e Cowork). Usar `execute_sql` direto no Supabase APENAS para diagnóstico técnico (bugs, triggers, schema).**

### Ferramentas MCP Server Croma (93 total — atualizado 2026-04-02)
| Módulo | Ferramentas |
|---|---|
| **CRM** | `croma_listar_clientes`, `croma_detalhe_cliente`, `croma_cadastrar_cliente`, `croma_atualizar_cliente`, `croma_listar_leads`, `croma_cadastrar_lead`, `croma_atualizar_status_lead`, `croma_listar_atividades_comerciais`, `croma_registrar_atividade_comercial`, `croma_listar_comissoes`, `croma_registrar_comissao`, `croma_listar_contratos`, `croma_criar_contrato`, `croma_listar_campanhas`, `croma_listar_nps` |
| **Orçamentos** | `croma_listar_propostas`, `croma_detalhe_proposta`, `croma_criar_proposta`, `croma_atualizar_status_proposta`, `croma_enviar_proposta` |
| **Pedidos** | `croma_listar_pedidos`, `croma_detalhe_pedido`, `croma_atualizar_status_pedido`, `croma_listar_ordens_producao`, `croma_atualizar_status_producao`, `croma_criar_ordem_producao`, `croma_registrar_apontamento_producao`, `croma_listar_apontamentos_producao` |
| **Campo** | `croma_listar_instalacoes`, `croma_agendar_instalacao`, `croma_listar_jobs_campo`, `croma_detalhe_job_campo`, `croma_listar_fotos_job`, `croma_criar_job_campo`, `croma_atualizar_job_campo`, `croma_listar_equipes` |
| **Financeiro** | `croma_listar_contas_receber`, `croma_listar_contas_pagar`, `croma_criar_conta_receber`, `croma_registrar_pagamento`, `croma_criar_conta_pagar`, `croma_registrar_pagamento_cp`, `croma_registrar_lancamento_caixa`, `croma_listar_lancamentos_caixa`, `croma_listar_contas_bancarias`, `croma_gerar_boleto`, `croma_consultar_das` |
| **Fiscal** | `croma_listar_nfe`, `croma_emitir_nfe`, `croma_consultar_status_nfe` |
| **Qualidade** | `croma_listar_ocorrencias`, `croma_criar_ocorrencia`, `croma_atualizar_ocorrencia` |
| **Estoque** | `croma_consultar_estoque`, `croma_listar_materiais`, `croma_registrar_movimento`, `croma_cadastrar_material`, `croma_atualizar_material`, `croma_sugerir_compra`, `croma_historico_precos_material` |
| **Impressora** | `croma_listar_jobs_impressora`, `croma_resumo_impressora`, `croma_vincular_job_impressora`, `croma_registrar_jobs_impressora`, `croma_custo_real_pedido`, `croma_mapear_substrato`, `croma_registrar_recarga`, `croma_nivel_cartuchos` |
| **Admin** | `croma_listar_produtos`, `croma_atualizar_preco_material`, `croma_listar_regras_precificacao`, `croma_criar_produto`, `croma_criar_modelo_produto`, `croma_atualizar_modelo_produto`, `croma_criar_regra_precificacao`, `croma_atualizar_regra_precificacao`, `croma_listar_maquinas`, `croma_listar_acabamentos_servicos` |
| **Fornecedores** | `croma_listar_fornecedores`, `croma_detalhe_fornecedor`, `croma_cadastrar_fornecedor`, `croma_atualizar_fornecedor`, `croma_historico_compras_fornecedor` |
| **Compras** | `croma_listar_compras`, `croma_detalhe_compra`, `croma_criar_compra`, `croma_atualizar_status_compra`, `croma_registrar_recebimento` |
| **BI** | `croma_dashboard_executivo`, `croma_alertas_ativos`, `croma_pipeline_comercial` |
| **Sistema** | `croma_executar_sql` (SELECT only), `croma_health_check` |

---

## LOCALIZAÇÃO DO PROJETO

| Item | Caminho |
|---|---|
| **Repositório principal** | `C:\Users\Caldera\Claude\CRM-Croma` |
| **GitHub** | `https://github.com/juniorcromaprint-tech/CRM-Croma.git` |
| **Vercel ERP** | `crm-croma.vercel.app` (deploy automático de `main`) |
| **Vercel Campo** | `campo-croma.vercel.app` (deploy automático de `main`) |
| **Supabase** | `djwjmfgplnqyffdcgdaw.supabase.co` |

**IMPORTANTE**: O projeto roda em `C:\Users\Caldera\Claude\CRM-Croma`. Não usar caminhos antigos (`dyad-apps\instalações`).

### Dev Server Local (preview_start)

O script `start-dev.cmd` na raiz do repo:
- Faz `cd` automático para seu próprio diretório (funciona em main repo e worktrees)
- Cria `.env` automaticamente se não existir
- Usa o `vite` do `node_modules` do repo principal

**Ao criar um novo worktree**, atualizar `.claude/launch.json` do worktree para apontar para o `start-dev.cmd` do próprio worktree:
```json
"runtimeArgs": ["/c", "C:\\Users\\Caldera\\Claude\\CRM-Croma\\.claude\\worktrees\\<NOME-DO-WORKTREE>\\start-dev.cmd"]
```

---

## EMPRESA

| Campo | Detalhe |
|---|---|
| **Nome** | Croma Print Comunicação Visual |
| **Segmento** | Comunicação visual profissional para varejo e indústria |
| **Localização** | São Paulo-SP, Brasil |
| **Especialização** | Redes de lojas, franquias, fabricantes de calçados, grandes varejistas |
| **Diferenciais** | Produção própria, atendimento nacional, padronização de redes |
| **Faturamento médio** | R$ 110.000/mês |
| **Custo operacional** | R$ 36.800/mês |
| **Equipe de produção** | 6 funcionários |

### Produtos fabricados
- Fachadas em ACM (Alumínio Composto)
- Banners e impressão digital grande formato
- Material PDV (Ponto de Venda)
- Envelopamento veicular
- Letreiros e sinalização
- Placas e totens

### Clientes de referência
Redes de lojas, franquias e grandes varejistas: **Beira Rio, Renner, Paquetá**, entre outros.

### Dados Oficiais (para propostas, emails e WhatsApp)
| Campo | Detalhe |
|---|---|
| **PIX** | CNPJ 18.923.994/0001-83 (Croma Print Comunicação Visual) |
| **Email oficial** | junior@cromaprint.com.br |
| **Formas de pagamento** | PIX, transferência bancária, boleto |

### Dono / Contato Principal
| Campo | Detalhe |
|---|---|
| **Nome** | Junior |
| **Email pessoal** | junior.cromaprint@gmail.com |
| **Email comercial** | junior@cromaprint.com.br |
| **Telegram** | @Jucabio |
| **Telegram chat_id** | 1065519625 |

---

## ERP-CROMA — VISÃO GERAL DO SISTEMA

### Módulos disponíveis (16 no total)
`Comercial` · `Clientes` · `Pedidos` · `Produção` · `Estoque` · `Financeiro` · `Fiscal` · `Contabilidade` · `Compras` · `Instalação` · `Qualidade` · `Admin` · `Portal` · `Dados` · `AI` · `Agent`

### Funcionalidades IA
- **12 Edge Functions de IA** via OpenRouter
- **AI Sidebar** com 20+ appliers de contexto
- **Agente de Vendas WhatsApp v14** — CRM integrado: detecta intenção via tags [INTENT:xxx], coleta dados cadastrais (nome, email, empresa, cidade), cria propostas reais via ai-gerar-orcamento com motor Mubisys, envia link do portal + email SMTP, dados PIX/email corretos hardcoded
- **Motor Mubisys** — precificação em 9 passos (materiais, máquinas, encargos, markup)
- **AI Orçamento** — agente detecta intenção, gera proposta completa no CRM, envia por email e WhatsApp

### App de Campo (PWA)
- URL: `campo-croma.vercel.app`
- Para técnicos e instaladores — mobile-first
- Integrado ao ERP via bridge Supabase

### Integração HP Latex 365
- **IP**: `192.168.0.136` (rede local)
- **UUID no banco**: `f7f320c9-baa8-4658-a178-fa67f8de3b9e`
- **Script coleta**: `croma_plotter_sync.py` (raiz do projeto) — Python, roda no PC do Junior
- **Sync automático**: Scheduled task `hp-latex-sync` — a cada 1h, seg-sex 8-18h
- **Autenticação**: Supabase service_role JWT (hardcoded no script)
- **Modelo custeio "LM Âncora"**: custo = tinta (R$0,52/ml × ml estimado) + substrato (variável) + máquina (R$2,40/m²)
- **Tinta HP original**: bag 3L (de outro modelo HP Latex) = R$1.560 → R$0,52/ml. Tinta retirada do bag e injetada nos cartuchos de 775ml. Impressora detecta como "refilledColor" (cartucho recarregado, não porque tinta é paralela).
- **Fator LM**: consumo_total_ml = lm_ml_real × 21,5316. Fallback: 9,86 ml/m²
- **Máquina R$2,40/m²**: depreciação + cabeçotes de impressão + cartucho de manutenção
- **Tabelas**: `impressora_jobs`, `impressora_config` (12 params), `impressora_substrato_map` (22 substratos), `impressora_proporcoes_tinta`
- **Views**: `vw_custo_real_por_pedido`, `vw_custo_real_por_op` (com 3 componentes)
- **Trigger**: ao vincular job a OP, `custo_mp_real` atualiza automaticamente
- **Monitoramento de consumíveis**: coleta automática via ConsumableConfigDyn.xml — nível%, serial, estado (refilledColor/nonHP/ok), datas de instalação/fabricação/validade, garantia
- **Tabelas consumíveis**: `impressora_consumiveis` (estado atual), `impressora_consumiveis_historico` (gráficos de consumo)
- **21/22 substratos** pendentes de mapeamento no `impressora_substrato_map` (só SM790 mapeado)

---

## CONTEXTO TELEGRAM — INSTRUÇÕES PARA ACESSO VIA CHAT

Quando acessado via Telegram Channel (Claude Code integrado ao Telegram do Junior):

### Comportamento esperado
- **Sempre responder em português brasileiro**
- **Ser direto e objetivo** — é celular, tela pequena, sem enrolação
- **Nunca pedir confirmação** para consultas (leitura de dados)
- **Sempre pedir confirmação** antes de ações que alteram dados (criar, editar, deletar)
- Usar formatação simples — evitar tabelas grandes, preferir listas curtas

### O que o Junior pode pedir via Telegram
| Tipo | Exemplos |
|---|---|
| **Consultas** | "status do pedido X", "orçamentos pendentes", "faturamento do mês", "estoque de banner" |
| **Clientes** | "dados do cliente Renner", "últimos clientes cadastrados", "leads do dia" |
| **Produção** | "OPs em andamento", "o que está no corte hoje", "expedição de amanhã" |
| **Financeiro** | "contas a receber esta semana", "boletos vencendo hoje", "faturamento do mês" |
| **Ações** | "cadastrar lead X", "criar orçamento para Y", "atualizar status do pedido Z" |

### Acesso ao Supabase (para consultas)
- **URL**: `https://djwjmfgplnqyffdcgdaw.supabase.co`
- **Anon Key**: ver seção SUPABASE abaixo
- Tabelas principais: `clientes`, `pedidos`, `propostas`, `leads`, `contas_receber`, `ordens_producao`, `estoque_movimentos`

---

## VISÃO — EMPRESA GERIDA POR IA

A Croma Print está em processo de se tornar a **primeira empresa de comunicação visual gerida quase exclusivamente por IA**:

- **Claude (via Cowork/Channels/WhatsApp)** é o "cérebro" central — gerencia operações, consultas, decisões
- **MCP Server Croma** é a interface oficial para TODAS operações de dados (REGRA ABSOLUTA)
- **OpenRouter** para Edge Functions de IA no ERP; **Claude API direta** para WhatsApp/Agentes
- **Documentação do plano**: `.planning/` e `docs/plano-ia/`
- O objetivo é que o Junior gerencie a empresa inteiramente pelo celular

---

## ARQUITETURA — DOIS PRODUTOS

| Produto | Pasta | URL | Público | Foco |
|---|---|---|---|---|
| **ERP/CRM** | `src/` | `crm-croma.vercel.app` | Equipe interna | Desktop-first |
| **App de Campo** | `APP-Campo/` | `campo-croma.vercel.app` | Técnicos/instaladores | Mobile-first PWA |

**Backend compartilhado**: Supabase `djwjmfgplnqyffdcgdaw`

---

## STACK

```
React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui
TanStack Query v5 + Zod + React Hook Form
Recharts (gráficos) + Sonner (toasts)
Supabase (Postgres + Auth + Storage + Edge Functions)
Vitest (102 testes) + html2pdf + xlsx (relatórios)
NFeWizard-io (NF-e SEFAZ) + Resend (email campanhas)
```

---

## FLUXO PRINCIPAL DO NEGÓCIO

```
Lead → Orçamento → Pedido → Produção → Instalação → Faturamento
```

---

## ESTADO ATUAL DO BANCO (2026-03-31)

| Migration | Status | Conteúdo |
|---|---|---|
| `001_complete_schema.sql` | ✅ Executada | 51 tabelas base |
| `002_schema_corrections.sql` | ✅ Executada | RLS granular, triggers, índices |
| `003_campo_migration.sql` | ✅ Executada | Jobs, fotos, assinaturas, checklists |
| `003_fiscal_module.sql` | ✅ Executada | 11 tabelas fiscal + RPCs NF-e |
| `004_integracao_bridge.sql` | ✅ Executada | Bridge ERP↔Campo — views vw_campo_instalacoes, vw_campo_fotos + triggers de sincronização ativos |
| `005_storage_security.sql` | ✅ Executada | RLS nos buckets |
| `006_orcamento_module.sql` | ✅ Executada | acabamentos (17), servicos (16), proposta_item_materiais, proposta_item_acabamentos, proposta_servicos, templates_orcamento |
| `007_orcamento_campos.sql` | ✅ Executada | regras_precificacao (11 categorias), modelo_id em proposta_itens, campos de custeio em pedido_itens |
| `008_update_materiais_precos.sql` | ✅ Executada | 464 materiais com preço real Mubisys |
| `009_update_produtos_markups.sql` | ✅ Executada | 156 modelos com markup real |
| `020_portal_tracking_pagamento.sql` | ✅ Executada | Portal cliente, tracking, pagamento, notificações |
| `022_pedidos_cancelamento_fields.sql` | ✅ Executada | `cancelado_em` e `motivo_cancelamento` na tabela pedidos |
| `027_rls_blindagem.sql` | ✅ Executada | RLS em 8 tabelas críticas + 14 FK indexes + NOT NULL constraints |
| `028_retornos_bancarios.sql` | ✅ Executada | Tabelas para retorno CNAB 400 (baixa automática boletos) |
| `029_campanha_destinatarios.sql` | ✅ Executada | Destinatários de campanhas comerciais |
| `030_optimistic_lock.sql` | ✅ Executada | Campo `version` para lock otimista em pedidos e propostas |
| `113_impressora_jobs.sql` | ✅ Executada | impressora_jobs, impressora_config (12 params), impressora_proporcoes_tinta (7 cores) |
| `114_impressora_integracao_completa.sql` | ✅ Executada | impressora_substrato_map (22 substratos), views vw_custo_real_por_pedido/op, trigger auto-custo OP, maquina_id/substrato_material_id |
| `115_impressora_custo_maquina_3componentes.sql` | ✅ Executada | custo_maquina_brl, config custo_maquina_m2=2.40, views com 3 componentes (tinta+substrato+máquina) |
| `116_impressora_consumiveis.sql` | ✅ Executada | impressora_consumiveis, impressora_consumiveis_historico, impressora_recargas, vw_nivel_cartuchos (monitoramento consumíveis + nível estimado por cor) |

### Dados no Banco
- `clientes`: 307 registros
- `materiais`: 467 registros (464 com preço_medio, 3 sem) — visíveis em `/admin/materiais`
- `produtos`: 156 registros
- `produto_modelos`: 156 registros (markup seedado)
- `modelo_materiais`: 321 registros vinculados
- `modelo_processos`: 362 registros
- `acabamentos`: 17 registros (ilhós, bastão, laminação, etc.)
- `servicos`: 16 registros (criação de arte, instalação, etc.)
- `regras_precificacao`: 11 categorias (banner, adesivo, fachada, placa, letreiro, painel, totem, backdrop, geral, pdv, envelopamento)

---

## SPRINTS CONCLUÍDOS (2026-03-14)

Auditoria identificou 66 problemas. 4 sprints executados para resolver todos:

### Sprint 1 — Blindagem (Segurança)
- RLS em 8 tabelas críticas (clientes, propostas, pedidos, leads, contas_*)
- 14 FK indexes para performance
- NOT NULL constraints em campos críticos
- AuthContext null-role bypass corrigido (default = comercial)
- Rota /tv protegida com autenticação
- Mapa de transições de status nos pedidos (impede pular etapas)
- gerarContasReceber transacional (CR antes de marcar concluído)

### Sprint 2 — Fluxo Completo (Lead→Faturamento)
- N+1 do orçamento corrigido (23→2 queries)
- Guards de idempotência (OP e contas_receber)
- KPIs de produção (4 cards)
- Página de Expedição (`/expedicao`)
- Calendário com 3 fontes (pedidos, leads, orçamentos)

### Sprint 3 — Experiência (Performance + UX)
- Lazy loading em todas as rotas (100+ chunks)
- Paginação server-side em listagens
- Select de colunas específicas nas top queries
- Loading states nos botões
- Dead code e console.log removidos

### Sprint 4 — Crescimento (Features avançadas)
- 102 testes automatizados (Vitest)
- Parser CNAB 400 retorno (baixa automática de boletos)
- Relatórios exportáveis (Excel + PDF)
- NF-e em homologação SEFAZ (IBGE mapping, banner amarelo)
- Campanhas comerciais (Edge Function Resend)
- Lock otimista (campo version em pedidos/propostas)

### Bugs da auditoria original (PR #5)
19 bugs corrigidos. Ver `docs/qa-reports/2026-03-14-RELATORIO-DEV.md`.

### Correções E2E (2026-03-26)
5 bugs críticos do teste E2E corrigidos:
- **Bug #1 — Criação de Lead**: Insert sem `.select().single()` não detectava bloqueio RLS. Corrigido em `LeadsPage.tsx`.
- **Bug #2 — Conversão Lead→Cliente**: `AlertDialogAction` do Radix UI fechava o dialog antes da async function terminar, matando o fluxo. Corrigido com `e.preventDefault()` + loading state em `LeadDetailPage.tsx`.
- **Bug #3 — Proposta sem vínculo cliente**: Já estava corrigido — `ClienteCombobox` implementado em `PropostasPage.tsx` e `OrcamentoEditorPage.tsx`.
- **Bug #4 — Aprovação mostra R$ 0,00**: Campo `total` podia ser 0 quando `subtotal` tinha valor (recálculo não executado). Adicionado fallback `orc.total || orc.subtotal || 0` em `OrcamentoViewPage.tsx`.
- **Bug #5 — Aprovação não executa**: Mesmo padrão do Bug #2 — `AlertDialogAction` fechando antes da mutation executar. Corrigido com `e.preventDefault()` + `onSettled` para fechar o dialog em `OrcamentoViewPage.tsx`.

**Padrão aprendido — REGRA NOVA**: Toda mutation dentro de `AlertDialogAction` DEVE usar `e.preventDefault()` para impedir o close automático. O dialog deve ser fechado manualmente via `onSettled` ou `onSuccess`.

**Padrão aprendido — REGRA NOVA**: Todo `.insert()` e `.update()` no Supabase DEVE usar `.select().single()` para detectar bloqueio por RLS (que retorna 0 rows sem erro explícito).

### WhatsApp IA v14 — Integração CRM (2026-03-31)
Auditoria com lead teste "Vih" revelou 3 problemas no agente WhatsApp. Corrigidos:
- **Problema #1 — Preços inventados**: Agente usava Claude para "chutar" preços ao invés de consultar CRM. Corrigido: webhook agora detecta intenção via tags `[INTENT:xxx]` e chama `ai-gerar-orcamento` que usa motor Mubisys com preços reais do banco.
- **Problema #2 — Sem coleta de dados**: Cadastrava lead só com nome e telefone. Corrigido: `checkDadosFaltantes()` verifica nome completo, email, empresa, cidade. System prompt instrui coleta antes de orçar. `tryUpdateLeadFromMessage()` extrai dados automaticamente das mensagens.
- **Problema #3 — PIX/email incorretos**: Corrigido em 3 Edge Functions (whatsapp-webhook, ai-compor-mensagem, agent-enviar-email). PIX: CNPJ 18.923.994/0001-83. Email: junior@cromaprint.com.br.

**Padrão aprendido — REGRA NOVA**: Todo agente de vendas DEVE coletar dados cadastrais (nome completo, email, empresa, cidade/estado) ANTES de gerar qualquer orçamento formal.

**Padrão aprendido — REGRA NOVA**: Dados de pagamento (PIX, email) devem ser HARDCODED no system prompt e nas mensagens de orçamento. Nunca confiar no Claude para "lembrar" dados financeiros.

### Auditorias pendentes (2026-03-21)
Ver `docs/qa-reports/2026-03-21-MASTER-AUDIT-REPORT.md` para issues restantes:
- 5 bugs críticos restantes (status faturado, NCM null, pagamento desconectado, comissões, dimensões)
- 7 gaps funcionais (financeiro cego, boleto manual, sem reserva estoque, Gantt decorativo, alertas, funil, proposta→pedido)
- 10 gaps de produto (contratos recorrentes, NPS, PIX, RFQ, approval workflow, etc.)

Ver spec completa: `docs/superpowers/specs/2026-03-14-plano-acao-erp-design.md`
Ver planos: `docs/superpowers/plans/`

---

## PADRÕES DE CÓDIGO

### Obrigatório
- **Idioma do código**: TypeScript/inglês para nomes de variáveis e funções de baixo nível
- **Idioma da UI**: Português brasileiro em TUDO que o usuário vê
- **Componentes**: `rounded-2xl` para cards, `rounded-xl` para inputs
- **Cor primária**: `bg-blue-600 hover:bg-blue-700`
- **Toasts**: `showSuccess()` / `showError()` de `@/utils/toast.ts`
- **Formatação**: `brl()`, `formatDate()` de `@/shared/utils/format.ts`
- **Supabase client**: `@/integrations/supabase/client.ts`
- **Supabase mutations**: TODO insert/update DEVE usar `.select().single()` para detectar RLS silencioso
- **AlertDialogAction async**: SEMPRE usar `e.preventDefault()` dentro do onClick e fechar o dialog manualmente via `onSettled`
- **Auth**: `ProtectedRoute` obrigatório (DemoRoute foi removido). Login exigido em todas as rotas exceto `/p/:token` e `/nps/:token`

### Estrutura de domínios
```
src/domains/{dominio}/
  pages/       — React pages (rotas)
  hooks/       — useQuery / useMutation hooks
  components/  — componentes específicos do domínio
  services/    — lógica de negócio + Supabase calls
  schemas/     — schemas Zod (validação)
```

### Estado vazio padrão
```tsx
<div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
  <Icon size={40} className="mx-auto text-slate-300 mb-3" />
  <h3 className="font-semibold text-slate-600">Título</h3>
  <p className="text-sm text-slate-400 mt-1">Ação sugerida</p>
</div>
```

---

## GSD (GET SHIT DONE) — CONTEXTO ESTRUTURADO

O projeto usa o sistema GSD para manter contexto entre sessões. **SEMPRE leia estes arquivos no início de qualquer tarefa:**

| Arquivo | Propósito | Quando ler |
|---|---|---|
| `.planning/IDENTITY.md` | Papel do Claude, divisão de responsabilidades, regras | **SEMPRE — primeiro arquivo** |
| `.planning/STATE.md` | Onde estamos agora, última atividade, blockers | **SEMPRE — segundo arquivo** |
| `.planning/PROJECT.md` | Visão do projeto, requirements, constraints, decisões | Quando precisar de contexto completo |
| `.planning/REQUIREMENTS.md` | Requirements checkáveis com IDs (BUG-01, GAP-01, etc.) | Quando planejar ou executar tasks |

### Regras GSD no Cowork
1. **Ler IDENTITY.md + STATE.md** antes de qualquer tarefa não-trivial
2. **Atualizar STATE.md** após completar qualquer work significativo (mudar "Last activity", "Current Position", etc.)
3. **Marcar requirements** como [x] no REQUIREMENTS.md quando completados
4. **Logar decisões** na tabela Key Decisions do PROJECT.md
5. **Criar .planning/summaries/YYYY-MM-DD-resumo.md** ao final de sessões produtivas

### Diretório .planning/
```
.planning/
  IDENTITY.md         — papel do Claude, divisão de responsabilidades, regras de operação
  PROJECT.md          — visão, requirements, constraints, decisões
  STATE.md            — esta