# PLANO MASTER — Vendas + MCP Cobertura Total + Prospecção
> Data: 2026-04-01 | Autor: Cowork (Claude Opus) | Aprovação: Junior
> Status: AGUARDANDO APROVAÇÃO

---

## VISÃO GERAL

O sistema CRM-Croma tem **103 páginas** no ERP e **48 ferramentas MCP**. Hoje o MCP cobre ~40% das páginas. O objetivo é chegar a **cobertura total** (toda operação do ERP acessível via MCP) + ativar a **máquina de vendas** (prospecção, WhatsApp, landing page).

**Prioridade absoluta: VENDAS. Sem vendas, nada funciona.**

---

## RESUMO DAS TASKS

| # | Task | Executor | Tempo | Prioridade |
|---|------|----------|-------|------------|
| T1 | Prospecção ativa de clientes | Cowork | 1-2h | 🔴 URGENTE |
| T2 | Landing page comercial | CLI | 3-4h | 🔴 URGENTE |
| T3 | Templates WhatsApp Meta | CLI | 1-2h | 🔴 URGENTE |
| T4 | Turbinar agente WhatsApp (follow-up inteligente) | CLI | 2-3h | 🟠 ALTA |
| T5 | MCP Fase 3A — Ferramentas de Vendas (8 tools) | CLI | 3-4h | 🟠 ALTA |
| T6 | MCP Fase 3B — Ferramentas Financeiro+Produção (10 tools) | CLI | 3-4h | 🟡 MÉDIA |
| T7 | MCP Fase 3C — Ferramentas Admin+Compras (10 tools) | CLI | 3-4h | 🟡 MÉDIA |
| T8 | Limpeza Edge Functions OpenRouter | CLI | 2-3h | 🟡 MÉDIA |
| T9 | Campanha de email para base existente | Cowork | 1h | 🟠 ALTA |
| T10 | Material comercial (apresentação PDF/PPTX) | Cowork | 1-2h | 🟠 ALTA |

**Total estimado: ~22-30h de trabalho**
**Ferramentas MCP ao final: 48 → ~76 ferramentas (cobertura ~90% do ERP)**

---

## T1 — PROSPECÇÃO ATIVA DE CLIENTES
**Executor: COWORK | Prioridade: 🔴 URGENTE | Tempo: 1-2h**

### O que fazer
Usar Vibe Prospecting para buscar empresas reais que precisam de comunicação visual:

**Segmentos prioritários (maior chance de fechar rápido):**
1. Fábricas de calçados no RS (Beira Rio, Paquetá, Grendene — já são referência)
2. Redes de lojas/franquias em SP e RS (fachadas, PDV, sinalização)
3. Concessionárias de veículos (envelopamento, fachada, totem)
4. Supermercados e farmácias regionais (sinalização, PDV)

**Para cada prospect:**
- Nome, CNPJ, telefone, email, cidade
- Contato da pessoa responsável por marketing/compras
- Cadastrar como lead no CRM via `croma_cadastrar_lead`

**Meta: 30 leads qualificados prontos para contato**

### Quem executa
**Cowork** — eu faço direto, sem precisar do CLI.

---

## T2 — LANDING PAGE COMERCIAL
**Executor: CLI | Prioridade: 🔴 URGENTE | Tempo: 3-4h**

### Prompt para o CLI

```
Criar uma landing page comercial para a Croma Print em APP-Landing/ (mesmo padrão do APP-Campo — app Vite standalone).

REQUISITOS:
1. Página única, moderna, mobile-first (clientes acessam pelo celular)
2. Seções:
   - Hero: "Comunicação Visual Profissional para Sua Rede de Lojas" + CTA WhatsApp
   - Serviços: Fachadas ACM, Banners, PDV, Envelopamento, Letreiros, Sinalização (com ícones)
   - Portfólio: Grid de fotos (usar placeholders por enquanto, Junior adiciona depois)
   - Clientes: Logos de referência (Beira Rio, Renner, Paquetá)
   - Sobre: Produção própria, atendimento nacional, equipe especializada
   - CTA final: Botão WhatsApp + formulário simples (nome, empresa, email, o que precisa)

3. O formulário deve enviar dados para o Supabase (tabela leads) via API REST
   - Endpoint: POST https://djwjmfgplnqyffdcgdaw.supabase.co/rest/v1/leads
   - Headers: apikey (anon key do CLAUDE.md), Content-Type: application/json, Prefer: return=representation
   - Campos: contato_nome, email, empresa, telefone, observacoes (o que precisa), origem='landing_page'

4. Botão WhatsApp: link direto wa.me/5511939471862?text=Olá! Vim pelo site e gostaria de um orçamento.

5. Stack: React + Vite + Tailwind (igual APP-Campo)
6. Cores: azul Croma (#1e40af primary, #2563eb secondary), branco, cinza claro
7. Deploy: configurar vercel.json para deploy em landing-croma.vercel.app (ou subpath)

8. SEO básico:
   - Title: "Croma Print - Comunicação Visual Profissional | Fachadas, Banners, PDV"
   - Meta description
   - Open Graph tags

IMPORTANTE:
- NÃO usar imagens externas (CDN) — usar placeholders SVG ou gradientes
- O Junior vai adicionar fotos reais depois
- Responsivo: testar em 375px (mobile) e 1280px (desktop)
- Performance: Lighthouse score > 90
```

---

## T3 — TEMPLATES WHATSAPP META
**Executor: CLI | Prioridade: 🔴 URGENTE | Tempo: 1-2h**

### Prompt para o CLI

```
Submeter os 3 templates WhatsApp à Meta e criar mais 2 templates úteis.

CONTEXTO:
- Edge Function whatsapp-submit-templates já existe em supabase/functions/whatsapp-submit-templates/
- 3 templates já definidos no código: croma_abertura, croma_followup, croma_proposta
- WABA ID: 1262844242060742
- API: Meta Cloud API v22.0

TAREFAS:

1. Verificar se os 3 templates existentes já foram submetidos à Meta:
   - Fazer GET https://graph.facebook.com/v22.0/1262844242060742/message_templates
   - Se não submetidos, invocar a Edge Function whatsapp-submit-templates

2. Criar 2 templates adicionais no código E submeter:

   a) croma_cobranca (UTILITY):
      "Olá {{1}}! Identificamos que o pagamento ref. pedido {{2}} no valor de R$ {{3}}
       venceu em {{4}}. Se já pagou, por favor desconsidere. PIX CNPJ: 18.923.994/0001-83.
       Qualquer dúvida, estamos à disposição! - Croma Print"

   b) croma_reativacao (MARKETING):
      Header: "Saudades de você, {{1}}! 👋"
      Body: "Faz tempo que não nos falamos! A Croma Print tem novidades em comunicação visual
             que podem ajudar sua empresa. Quer saber mais?"
      Buttons: "Quero ver novidades" | "Agora não"

3. Atualizar o agent-cron-loop para usar o template croma_cobranca nas regras de cobrança D1 e D3
   (hoje manda texto livre, que pode falhar fora da janela de 24h)

4. Verificar status de aprovação dos templates via API Meta

REGRAS:
- Templates MARKETING precisam de opt-in do cliente
- Templates UTILITY podem ser enviados a qualquer momento
- Manter PIX CNPJ 18.923.994/0001-83 hardcoded
- Manter email junior@cromaprint.com.br hardcoded
```

---

## T4 — TURBINAR AGENTE WHATSAPP
**Executor: CLI | Prioridade: 🟠 ALTA | Tempo: 2-3h**

### Prompt para o CLI

```
Melhorar o agente WhatsApp para ser mais agressivo no follow-up e fechamento de vendas.

CONTEXTO:
- whatsapp-webhook v15 já funciona: recebe mensagem → Claude responde → detecta intenção → gera orçamento via Mubisys
- agent-cron-loop roda a cada 30min com 15 regras
- Regras follow_up_lead_24h e follow_up_proposta_48h já existem

MELHORIAS:

1. FOLLOW-UP MAIS INTELIGENTE no agent-cron-loop:
   - Adicionar regra follow_up_orcamento_2h: se enviou orçamento e cliente não respondeu em 2h (horário comercial), mandar mensagem tipo "Conseguiu ver o orçamento? Posso ajudar com alguma dúvida?"
   - Adicionar regra follow_up_visualizou_portal: se o cliente acessou o portal (portal_tracking.viewed_at != null) mas não respondeu, mandar "Vi que você deu uma olhada na proposta! Alguma dúvida? Posso ajustar valores ou prazos."
   - Adicionar regra reativacao_cliente_90d: clientes que compraram há mais de 90 dias e não tem pedido ativo, mandar template croma_reativacao

2. MELHORAR O SYSTEM PROMPT do whatsapp-webhook:
   - Ser mais direto: máximo 2 perguntas antes de oferecer orçamento
   - Quando o cliente perguntar "quanto custa", já pedir as dimensões e dar uma faixa de preço estimada ("banners costumam ficar entre R$X e R$Y por m²")
   - Quando coletar todos os dados, gerar o orçamento AUTOMATICAMENTE sem pedir confirmação
   - Incluir senso de urgência: "Essa cotação é válida por 7 dias"
   - Oferecer desconto para pagamento à vista: "5% de desconto no PIX"

3. MÉTRICAS no agent-cron-loop:
   - Contar quantas mensagens enviou no dia
   - Contar quantos orçamentos gerou
   - Contar taxa de resposta (mensagens recebidas / enviadas)
   - Incluir no resumo diário do Telegram das 22h

4. Inserir novas regras na tabela agent_rules via migration:
   ```sql
   INSERT INTO agent_rules (nome, modulo, tipo, ativo, condicao, acao, prioridade) VALUES
   ('follow_up_orcamento_2h', 'comercial', 'follow_up', true,
    '{"campo":"propostas.created_at","operador":"<","valor":"now() - interval ''2 hours''"}',
    '{"tipo":"enviar_mensagem","canal":"whatsapp","mensagem":"Conseguiu ver o orçamento? Posso ajudar com alguma dúvida?"}',
    80),
   ('follow_up_visualizou_portal', 'comercial', 'follow_up', true,
    '{"campo":"portal_tracking.viewed_at","operador":"IS NOT NULL","valor":"true"}',
    '{"tipo":"enviar_mensagem","canal":"whatsapp","mensagem":"Vi que você deu uma olhada na proposta! Alguma dúvida?"}',
    75),
   ('reativacao_cliente_90d', 'comercial', 'reativacao', true,
    '{"campo":"clientes.updated_at","operador":"<","valor":"now() - interval ''90 days''"}',
    '{"tipo":"enviar_template","canal":"whatsapp","template":"croma_reativacao"}',
    30);
   ```

5. Implementar os handlers dessas regras no agent-cron-loop:
   - follow_up_orcamento_2h: buscar propostas criadas há >2h sem resposta do cliente
   - follow_up_visualizou_portal: buscar portal_tracking com viewed_at != null sem mensagem após
   - reativacao_cliente_90d: buscar clientes com último pedido > 90 dias

REGRAS:
- Respeitar horário comercial (8h-18h BRT)
- Máximo 50 mensagens/dia
- Não mandar follow-up se o cliente já respondeu
- Deduplicação: usar wasRecentlyProcessed() para evitar spam
```

---

## T5 — MCP FASE 3A: FERRAMENTAS DE VENDAS (8 novas tools)
**Executor: CLI | Prioridade: 🟠 ALTA | Tempo: 3-4h**

### Prompt para o CLI

```
Expandir o MCP Server com 8 novas ferramentas focadas em vendas. Estas são as ferramentas que
faltam para eu (Claude/Cowork) operar o comercial completo sem precisar do frontend.

CONTEXTO:
- MCP Server em mcp-server/src/tools/
- Padrão: registerXxxTools(server) em cada arquivo, registrado no index.ts
- Usar z.coerce.number() para campos numéricos (aprendizado BUG-FIN-01)
- Usar getSupabaseClient() para leitura, getUserClient() se precisar de auth

NOVAS FERRAMENTAS (criar arquivo mcp-server/src/tools/comercial.ts):

1. croma_listar_campanhas
   - SELECT * FROM campanhas ORDER BY created_at DESC
   - Filtros: status (ativa/concluida/rascunho), tipo
   - Retornar: id, nome, tipo, status, destinatarios_total, enviados, created_at

2. croma_criar_campanha
   - INSERT INTO campanhas (nome, tipo, assunto, conteudo, segmento_alvo)
   - Tipos: email, whatsapp
   - Retornar campanha criada

3. croma_listar_conversas_whatsapp
   - SELECT * FROM agent_conversations ORDER BY ultima_mensagem_em DESC
   - Filtros: status (ativa/pausada/encerrada), lead_id
   - Join com leads para mostrar contato_nome, telefone
   - Retornar: id, lead_nome, telefone, etapa, mensagens_enviadas, mensagens_recebidas, score_engajamento, ultima_mensagem_em

4. croma_detalhe_conversa_whatsapp
   - Buscar conversa por ID + últimas 20 mensagens (agent_messages)
   - Retornar: conversa completa + mensagens com remetente/conteudo/timestamp

5. croma_enviar_whatsapp
   - Invocar Edge Function whatsapp-enviar via fetch
   - Params: telefone, mensagem (texto livre) OU template_name + params
   - Para uso quando eu (Claude) quiser mandar mensagem direta a um lead/cliente

6. croma_listar_contratos
   - SELECT * FROM contratos ORDER BY created_at DESC (se tabela existir)
   - Se não existir, retornar mensagem informando que módulo de contratos não está ativo

7. croma_criar_ordem_producao
   - Já existe mas estava com schema errado (BUG-PROD-01 corrigido)
   - Verificar se está 100% funcional após o fix

8. croma_agendar_instalacao
   - Já existe no registro mas verificar se funciona
   - Params: pedido_id, data_agendada, equipe, observacoes

Após criar, registrar no index.ts:
import { registerComercialTools } from "./tools/comercial.js";
registerComercialTools(server);

Build: cd mcp-server && npm run build
Testar cada ferramenta com um comando simples.
```

---

## T6 — MCP FASE 3B: FERRAMENTAS FINANCEIRO + PRODUÇÃO (10 novas tools)
**Executor: CLI | Prioridade: 🟡 MÉDIA | Tempo: 3-4h**

### Prompt para o CLI

```
Expandir MCP Server com 10 ferramentas de Financeiro e Produção. Hoje o financeiro tem 6 tools
mas faltam operações críticas. Produção tem tools básicas mas falta o dia-a-dia.

CONTEXTO: mesmo padrão de T5.

FINANCEIRO (6 novas tools — adicionar em mcp-server/src/tools/financeiro.ts):

1. croma_dashboard_financeiro
   - Query agregada: total CR aberto, total CR vencido, total CP aberto, total CP vencido
   - Faturamento do mês atual vs mês anterior
   - Top 5 clientes devedores
   - Projeção de caixa 30 dias (CR a vencer - CP a vencer)

2. croma_fluxo_caixa
   - SELECT CR e CP dos próximos 30/60/90 dias agrupados por semana
   - Retornar: semana, entradas_previstas, saidas_previstas, saldo_projetado

3. croma_dre_mensal
   - Receitas (CR pagas no mês) - Custos (CP pagas no mês) = Resultado
   - Agrupar por categoria se possível
   - Parâmetro: mes (YYYY-MM)

4. croma_listar_boletos
   - SELECT * FROM boletos (ou contas_receber WHERE forma_pagamento = 'boleto')
   - Filtros: status, vencendo_ate, cliente_id

5. croma_faturamento_lote
   - Listar pedidos prontos para faturar (status = 'concluido' e sem NF-e)
   - Retornar: pedido_id, numero, cliente, valor_total, concluido_em

6. croma_comissoes
   - SELECT vendedor, SUM(valor_comissao) FROM comissoes GROUP BY vendedor
   - Filtros: periodo (mes), vendedor_id
   - Se tabela não existir, retornar mensagem informativa

PRODUÇÃO (4 novas tools — adicionar em mcp-server/src/tools/pedidos.ts ou novo arquivo producao.ts):

7. croma_dashboard_producao
   - OPs por status (contagem): pendente, em_producao, finalizado
   - OPs atrasadas (prazo < hoje e status != finalizado/cancelado)
   - Carga por setor/máquina
   - Média de dias entre criação e conclusão

8. croma_fila_producao
   - SELECT * FROM vw_fila_producao (view criada na Fase 3 CROMA 4.0)
   - Retornar OPs ordenadas por prioridade e prazo

9. croma_diario_bordo
   - SELECT * FROM producao_diario_bordo (se existir) ORDER BY created_at DESC
   - Filtros: data, operador, setor
   - Se não existir, retornar mensagem informativa

10. croma_expedicao
    - Listar pedidos prontos para expedição (status = 'pronto_expedicao' ou similar)
    - Retornar: pedido_id, numero, cliente, itens, data_prevista_entrega

Após criar, build e testar.
```

---

## T7 — MCP FASE 3C: FERRAMENTAS ADMIN + COMPRAS (10 novas tools)
**Executor: CLI | Prioridade: 🟡 MÉDIA | Tempo: 3-4h**

### Prompt para o CLI

```
Expandir MCP Server com 10 ferramentas de Admin e Compras para cobertura completa do ERP.

ADMIN (6 novas tools — adicionar em mcp-server/src/tools/admin.ts):

1. croma_listar_usuarios
   - SELECT id, nome, email, role, ativo, ultimo_acesso FROM profiles
   - Retornar lista de usuários do sistema

2. croma_listar_maquinas
   - SELECT * FROM maquinas ORDER BY nome
   - Retornar: id, nome, tipo, setor, status, capacidade

3. croma_config_empresa
   - SELECT * FROM empresa_config (ou admin_config)
   - Retornar configurações gerais da empresa (razão social, CNPJ, endereço, etc.)

4. croma_listar_centros_custo
   - SELECT * FROM centros_custo ORDER BY nome
   - Se não existir, retornar mensagem informativa

5. croma_cockpit_executivo
   - SELECT * FROM vw_cockpit_executivo (view criada na Fase 4 CROMA 4.0)
   - Retornar: KPIs executivos, timeline, resumo

6. croma_listar_automacoes
   - SELECT * FROM agent_rules ORDER BY prioridade DESC
   - Retornar: nome, modulo, tipo, ativo, ultima_execucao, total_execucoes

COMPRAS (4 novas tools — criar mcp-server/src/tools/compras.ts):

7. croma_listar_fornecedores
   - SELECT * FROM fornecedores ORDER BY nome
   - Retornar: id, nome, cnpj, telefone, email, categorias, avaliacao

8. croma_cadastrar_fornecedor
   - INSERT INTO fornecedores (nome, cnpj, telefone, email, endereco, categorias)
   - Retornar fornecedor criado

9. croma_listar_pedidos_compra
   - SELECT * FROM pedidos_compra ORDER BY created_at DESC
   - Filtros: status, fornecedor_id
   - Retornar: id, numero, fornecedor_nome, valor_total, status, data_entrega

10. croma_criar_pedido_compra
    - INSERT INTO pedidos_compra (fornecedor_id, itens, valor_total, prazo_entrega)
    - Retornar pedido criado

IMPORTANTE:
- Para tabelas que podem não existir ainda, fazer try/catch e retornar mensagem amigável
- Não criar migrations — apenas as ferramentas MCP que consultam o que já existe
- Se a tabela não existir, a ferramenta deve retornar: "Módulo X ainda não configurado no banco. Tabela Y não encontrada."

Após criar, registrar no index.ts, build e testar.
```

---

## T8 — LIMPEZA EDGE FUNCTIONS OPENROUTER
**Executor: CLI | Prioridade: 🟡 MÉDIA | Tempo: 2-3h**

### Prompt para o CLI

```
Limpar e simplificar as Edge Functions que usam OpenRouter desnecessariamente.

CONTEXTO:
- 47 Edge Functions no total
- 22 usam OpenRouter (18 com gpt-4.1-mini, 4 com Claude via OpenRouter)
- Mapa completo em docs/plano-ia/MAPA-IA-CROMA.md

AÇÕES:

1. IDENTIFICAR FUNÇÕES DORMENTES (não chamadas há >30 dias):
   Verificar logs do Supabase ou inferir pelo código:
   - ai-analisar-foto-instalacao (não integrada)
   - buscar-leads-google (experimental)
   - ai-previsao-estoque (não ativa)
   - ai-preco-dinamico (não ativa)
   - ai-sequenciar-producao (substituída por fn_pcp_sequenciar_op)
   - ai-qualificar-lead (substituída por score no webhook)
   - ai-resumo-cliente (não integrada)
   - telegram-webhook (desativado — Channels substitui)
   - resolve-geo (não integrada)

2. Para cada função dormiente:
   - Mover para pasta supabase/functions/_archived/ (não deletar)
   - Remover do deploy (não aparece mais no Supabase dashboard)
   - Documentar no MAPA-IA-CROMA.md

3. SIMPLIFICAR funções ativas que usam GPT-4.1-mini para tarefas simples:
   - ai-classificar-extrato: classificação simples → pode ser regex/rules ao invés de IA
   - ai-detectar-intencao-orcamento: já é feito no whatsapp-webhook → possível duplicata
   - ai-composicao-produto: verificar se é usado — pode ser determinístico

4. Atualizar MAPA-IA-CROMA.md com:
   - Status de cada função (ativa/arquivada/simplificada)
   - Data da limpeza
   - Economia estimada de custo OpenRouter

NÃO MEXER em funções que estão em produção ativa (whatsapp-webhook, agent-cron-loop,
ai-gerar-orcamento, ai-compor-mensagem, agent-enviar-email, whatsapp-enviar).
```

---

## T9 — CAMPANHA DE EMAIL PARA BASE EXISTENTE
**Executor: COWORK | Prioridade: 🟠 ALTA | Tempo: 1h**

### O que fazer
Usar Gmail MCP para enviar emails personalizados para clientes/leads reais.

**Ações:**
1. Consultar leads e clientes com email válido via MCP
2. Segmentar: quem já comprou vs prospects
3. Redigir email personalizado por segmento:
   - **Clientes antigos**: "Olá [nome], a Croma Print tem novidades! Atualizamos nosso atendimento com IA para orçamentos mais rápidos. Precisa de algo para suas lojas?"
   - **Leads frios**: "Olá [nome], somos a Croma Print — comunicação visual profissional para redes de lojas. Fazemos fachadas, banners, PDV e mais. Quer receber um orçamento personalizado?"
4. Enviar via Gmail MCP (gmail_create_draft primeiro, Junior aprova, depois envia)

### Quem executa
**Cowork** — eu faço direto.

---

## T10 — MATERIAL COMERCIAL (APRESENTAÇÃO)
**Executor: COWORK | Prioridade: 🟠 ALTA | Tempo: 1-2h**

### O que fazer
Criar uma apresentação comercial profissional da Croma Print em PPTX.

**Slides:**
1. Capa: Croma Print — Comunicação Visual Profissional
2. Quem somos: produção própria, SP, 6 funcionários, atendimento nacional
3. O que fazemos: fachadas ACM, banners, PDV, envelopamento, letreiros, sinalização
4. Nossos clientes: Beira Rio, Renner, Paquetá
5. Diferenciais: produção própria, padronização de redes, orçamento rápido por IA
6. Como funciona: WhatsApp → Orçamento em minutos → Aprovação online → Produção → Instalação
7. Contato: WhatsApp, email, site

### Quem executa
**Cowork** — eu crio usando skill pptx.

---

## ORDEM DE EXECUÇÃO RECOMENDADA

### Hoje à noite (paralelo):
- **Cowork**: T1 (prospecção) + T10 (apresentação)
- **CLI**: T2 (landing page)

### Amanhã manhã:
- **CLI**: T3 (templates WhatsApp) + T4 (turbinar agente)
- **Cowork**: T9 (campanha email) usando os leads da T1

### Amanhã tarde:
- **CLI**: T5 (MCP vendas — 8 tools)

### Próximos dias:
- **CLI**: T6 (MCP financeiro+produção) → T7 (MCP admin+compras) → T8 (limpeza Edge Functions)

---

## MAPA DE COBERTURA MCP — ANTES vs DEPOIS

### ANTES (48 ferramentas)
| Domínio | Páginas | Tools | Cobertura |
|---------|---------|-------|-----------|
| CRM/Leads | 3 | 7 | ✅ 100% |
| Propostas | 4 | 5 | ✅ 90% |
| Pedidos | 2 | 3 | ✅ 80% |
| Produção | 9 | 3 | ⚠️ 30% |
| Campo/Instalação | 4 | 7 | ✅ 85% |
| Financeiro | 10 | 6 | ⚠️ 40% |
| Fiscal | 6 | 3 | ⚠️ 50% |
| Qualidade | 3 | 3 | ✅ 100% |
| Estoque | 3 | 3 | ✅ 80% |
| Admin | 18 | 3 | ❌ 15% |
| Comercial | 5 | 0 | ❌ 0% |
| Compras | 4 | 0 | ❌ 0% |
| Contabilidade | 7 | 0 | ❌ 0% |
| BI | 3 | 3 | ✅ 100% |
| Sistema | 2 | 2 | ✅ 100% |

### DEPOIS (48 + 28 = 76 ferramentas)
| Domínio | Tools atuais | + Novas | Total | Cobertura |
|---------|-------------|---------|-------|-----------|
| CRM/Leads | 7 | 0 | 7 | ✅ 100% |
| Propostas | 5 | 0 | 5 | ✅ 100% |
| Pedidos | 3 | 0 | 3 | ✅ 80% |
| Produção | 3 | +4 | 7 | ✅ 75% |
| Campo | 7 | 0 | 7 | ✅ 85% |
| Financeiro | 6 | +6 | 12 | ✅ 85% |
| Fiscal | 3 | 0 | 3 | ⚠️ 50% |
| Qualidade | 3 | 0 | 3 | ✅ 100% |
| Estoque | 3 | 0 | 3 | ✅ 80% |
| Admin | 3 | +6 | 9 | ✅ 55% |
| Comercial | 0 | +8 | 8 | ✅ 80% |
| Compras | 0 | +4 | 4 | ✅ 70% |
| BI | 3 | 0 | 3 | ✅ 100% |
| Sistema | 2 | 0 | 2 | ✅ 100% |

**Contabilidade fica para fase futura** (baixa prioridade — Croma usa contador externo).

---

## MÉTRICAS DE SUCESSO

| Métrica | Atual | Meta 7 dias | Meta 30 dias |
|---------|-------|-------------|--------------|
| Leads no CRM | ~0 reais | 30+ | 100+ |
| Orçamentos enviados | 0 | 5+ | 20+ |
| Pedidos fechados | 0 | 1+ | 5+ |
| Ferramentas MCP | 48 | 56 (T5) | 76 (T5+T6+T7) |
| Edge Functions ativas | 47 | 38 (-9 arquivadas) | 38 |
| Templates WhatsApp aprovados | 0 | 5 | 5 |
| Landing page | não existe | online | online + SEO |

---

> Plano criado por Claude (Cowork) em 2026-04-01. Aguardando aprovação do Junior para iniciar execução.
