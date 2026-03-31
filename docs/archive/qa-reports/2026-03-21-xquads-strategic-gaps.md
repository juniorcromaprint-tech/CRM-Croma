# xQuads Strategic Gaps Report — Croma Print ERP/CRM
> **Data**: 2026-03-21 | **Analista**: xQuads Master Orchestrator | **Versão**: 1.0
> **Scope**: Análise profunda do codebase, 16 domínios, 80+ migrations, 30 Edge Functions

---

## EXECUTIVE SUMMARY — Top 10 Gaps Críticos

Após análise completa do código-fonte (src/domains/, supabase/migrations/, supabase/functions/), foram identificados os seguintes gaps estratégicos priorizados por impacto no negócio:

| # | Gap | Impacto | Esforço | Sprint |
|---|-----|---------|---------|--------|
| 1 | **Cotação automática de fornecedores** — compras ainda é manual, sem request-for-quote digital | Alto | Médio | Sprint 5 |
| 2 | **Analytics de funil Lead→Faturamento** — sem taxa de conversão por etapa, ciclo de venda médio, win/loss por segmento | Alto | Médio | Sprint 5 |
| 3 | **Portal do Fornecedor** — fornecedores não têm acesso ao sistema para aceitar POs, enviar NFs, confirmar prazos | Alto | Alto | Sprint 6 |
| 4 | **Contratos de manutenção / serviço recorrente** — sem gestão de contratos pós-venda (manutenção de fachadas, revisitas) | Alto | Médio | Sprint 5 |
| 5 | **NPS / Pesquisa de satisfação pós-instalação** — sem captura sistemática de satisfação do cliente | Alto | Baixo | Sprint 5 |
| 6 | **Rotas otimizadas para instalações** — equipes de campo sem roteirização inteligente (Google Maps / OR-Tools) | Médio | Médio | Sprint 6 |
| 7 | **PIX integrado** — pagamentos via portal do cliente suportam apenas boleto, sem PIX instantâneo | Médio | Baixo | Sprint 5 |
| 8 | **Dashboard executivo com cohorts e tendências** — sem análise de sazonalidade, LTV de cliente, churn de carteira | Médio | Médio | Sprint 6 |
| 9 | **Gestão de garantias** — sem rastreamento de garantias por item instalado, alertas de vencimento | Médio | Baixo | Sprint 5 |
| 10 | **Multi-filial / Multi-empresa real** — tabela `empresas` existe mas sem isolamento operacional real por filial | Alto | Alto | Sprint 7 |

---

## GAPS POR PERSPECTIVA

---

### 🎯 C-LEVEL — COO + CTO Perspective

#### Módulos críticos para operação que ainda faltam

**1. Gestão de Contratos de Manutenção**
O fluxo `Lead → Orçamento → Pedido → Produção → Instalação → Faturamento` termina na instalação. Para uma empresa de comunicação visual com clientes de rede (franquias, varejo), o pós-venda é receita recorrente: manutenção de fachadas, troca de adesivos sazonais, atualização de cardápios. Não existe nenhuma tabela `contratos_manutencao` nem `recorrencias` no banco. Isso significa que essa receita está sendo gerenciada fora do sistema (planilha, agenda), com alto risco de perda.

**2. Compras sem Cotação Formal**
O módulo `compras/` tem `pedidos_compra` mas sem Request for Quote (RFQ). Um gestor cria o pedido de compra já com um fornecedor e preço. Não há fluxo de "cotação múltipla" onde o sistema envia para 3 fornecedores, recebe propostas e o comprador aprova o melhor. Para uma empresa com 467+ materiais e produção própria, a ausência de cotação automatizada representa dinheiro deixado na mesa sistematicamente.

**3. Capacidade de Máquinas x Demanda (MRP Básico)**
O PCP tem Kanban de OPs por setor e semáforo de capacidade, mas não há MRP (Material Requirements Planning): dado os pedidos em carteira, quando devo comprar X metros de lona? O sistema não projeta necessidade de materiais a partir da carteira de pedidos. Resultado: compras reativas ao invés de proativas.

**4. Multi-filial operacionalmente isolada**
A tabela `empresas` existe (migration 065) para NF-e multi-empresa, mas não há segregação real de dados por filial. Se a Croma abrir uma segunda unidade (São Paulo, Curitiba), hoje seria necessário um segundo Supabase project inteiro. Não existe `empresa_id` como coluna discriminadora nas tabelas operacionais principais (leads, pedidos, clientes).

**5. App de Campo desacoplado do ERP**
O `APP-Campo/` tem suas próprias páginas (`Analytics.tsx`, `Clients.tsx`, `Jobs.tsx`), mas a bridge ERP↔Campo (migration `004_integracao_bridge.sql`) ainda está marcada como pendente no CLAUDE.md. Os técnicos de campo usam um app separado que sincroniza via views (`vw_campo_instalacoes`), mas não há feedback em tempo real de progresso de instalação no painel do gerente ERP.

#### Processos ainda manuais (fora do sistema)

Com base na análise do código:
- **Envio de NF-e para clientes**: existe `fiscal-gerar-danfe` e `enviar-email-proposta`, mas não há flow automático de envio da DANFE junto com a fatura ao cliente
- **Controle de garantias por item**: nenhuma tabela `garantias_instaladas` encontrada
- **Avaliação de fornecedores**: não há scoring/rating de fornecedores baseado em histórico de entregas
- **Pesquisa NPS pós-instalação**: zero menção a `nps`, `satisfacao`, ou `pesquisa` nos domínios
- **Gestão de amostras e mockups**: clientes frequentemente pedem amostras antes do pedido grande — não há módulo

#### Integrações externas faltando

O sistema tem: Supabase, Resend, WhatsApp Meta Cloud API, NFeWizard-io, OneDrive, ipinfo.io, OpenRouter.

Faltam:
- **Google Maps / Directions API** para roteirização de instalações (campo)
- **Integração bancária real-time** (Open Banking / Pix webhooks) — tem CNAB 400 mas não Pix instantâneo
- **Marketplace B2B / Cotação eletrônica** com fornecedores
- **Integração com transportadoras** (Jadlog, Correios) para tracking de entregas físicas
- **Assinatura digital de contratos** (DocuSign / ClickSign) — há `assinatura_digital` em field_signatures mas apenas para app de campo, não para contratos comerciais
- **ERP de clientes** (grandes redes como Renner, Hering têm ERP próprio — integração EDI/API para receber pedidos automaticamente)

#### Suporte ao crescimento

O sistema suporta time único de até ~50 usuários. Gaps para escalar:
- Sem `empresa_id` discriminador — não suporta múltiplas filiais
- RLS baseado em `auth.uid()` mas sem hierarquia de tenant
- Sem auditoria granular de performance por filial/regional
- `profiles.role` tem apenas 8 roles fixos — não suporta hierarquias personalizadas (gerente regional, supervisor de área)

---

### 📊 DATA SQUAD — Analytics Perspective (Avinash Kaushik)

#### KPIs de negócio que o sistema não captura hoje

**KPIs Comerciais ausentes:**
- Taxa de conversão por etapa do funil (Lead → Qualificado → Proposta → Pedido): os dados existem nas tabelas mas não há nenhuma view ou relatório calculando isso
- Ciclo de venda médio (dias entre criação do lead e primeiro pedido)
- Win/Loss rate por segmento (varejo, franquia, indústria, calçados)
- Ticket médio por canal de aquisição (quais origens de lead geram pedidos maiores?)
- Lifetime Value (LTV) por cliente — existe histórico de pedidos mas nenhum cálculo de LTV

**KPIs Operacionais ausentes:**
- OEE (Overall Equipment Effectiveness) das máquinas — existe `AdminMaquinasPage` mas sem rastreamento de downtime/utilização
- Tempo médio de ciclo por tipo de produto (do pedido à expedição)
- Taxa de retrabalho por produto/setor — existe `producao_retrabalho` mas sem dashboard
- Fill Rate (% de pedidos entregues no prazo prometido) — `data_prometida` existe mas não há KPI consolidado
- OTIF (On-Time-In-Full) — combinação de prazo e quantidade correto

**KPIs Financeiros ausentes:**
- Margem líquida real por pedido (custo de produção + material + mão de obra vs valor faturado)
- Aging de inadimplência com curva ABC de devedores
- DSO (Days Sales Outstanding) — prazo médio de recebimento
- Fluxo de caixa projetado (o módulo `FluxoCaixaPage` existe mas sem projeção futura baseada em pedidos em carteira)

#### Dashboards e relatórios faltando

O sistema tem 11 relatórios em `RelatoriosPage.tsx` (vendas, orçamentos, produtos, DRE, lucratividade, etc.) mas faltam:

1. **Funil de Vendas Detalhado** — cohort por mês de entrada, quanto converte em cada estágio
2. **Mapa de Calor Geográfico** — clientes/instalações por estado/cidade (dados existem, visualização não)
3. **Análise de Sazonalidade** — faturamento por mês dos últimos 2-3 anos para planning de capacidade
4. **Relatório de Rentabilidade por Vendedor** — receita gerada vs custo de comissões
5. **Dashboard de Retenção de Clientes** — clientes que compraram 1x vs recorrentes, taxa de churn de carteira
6. **Relatório de Desempenho de Fornecedores** — prazo, qualidade, preço ao longo do tempo
7. **Análise de Perda de Orçamentos** — motivo de recusa, concorrente, segmento — campo `motivo_descarte` existe em leads mas não há análise sistemática de propostas perdidas

#### Rastreabilidade do funil Lead→Faturamento

**Parcialmente implementada.** O sistema tem:
- `leads` com `origem_id` (lead_sources)
- `propostas` vinculadas a leads/clientes
- `pedidos` com histórico (`pedido_historico`)
- `contas_receber` vinculadas a pedidos
- `audit_logs` para ações do sistema

**Gaps de rastreabilidade:**
- `leads` → `propostas` não há FK direta (a proposta tem `cliente_id` mas não `lead_id` — o lead converte em cliente e a rastreabilidade se perde)
- Não há `proposta_id` em `pedidos` — quando a proposta vira pedido, a origem da proposta não está linkada
- `lead_sources` é apenas texto livre (nome) sem categorias estruturadas (inbound, outbound, indicação, digital, field, etc.)
- Custo de aquisição por canal (CAC) não é capturável — não há registro de investimento por origem

#### Dados de comportamento do cliente sendo perdidos

- **Portal do cliente** (`/p/:token`) tem `tracking_acessos` mas os dados de comportamento não voltam para o perfil do cliente no CRM (qual proposta ele mais abriu? quanto tempo ficou lendo? acessou de desktop ou mobile?)
- O WhatsApp webhook armazena mensagens mas sem análise de sentiment ou tópicos das respostas
- Não há tracking de abertura/clique de emails (a Edge Function `enviar-email-campanha` usa Resend mas sem webhook de tracking configurado)

---

### 💰 HORMOZI — Offers + Sales Perspective

#### O que falta para o processo de vendas ser mais eficiente

**1. "Orçamento em 5 minutos" ainda não é realidade para o vendedor**
O orçamento editor tem wizard de 3 etapas (Produto → Materiais → Revisão), mas ainda requer conhecimento técnico do vendedor para preencher materiais e acabamentos. O AI Orçamento (`ai-gerar-orcamento`) foi construído para o agente de WhatsApp, mas um vendedor interno fazendo uma call de vendas ainda usa o editor manual. Falta: botão "Gerar via IA" direto na tela de orçamento com input de linguagem natural.

**2. Upsell automático não existe**
Quando um cliente pede "banner 3x1m", o sistema não sugere automaticamente: "Clientes que compraram banner também adicionaram: laminação UV (+R$45), instalação (+R$120), banner de backup (+R$280)". O `OrcamentoPDF.tsx` e o `PricingCalculator.tsx` existem, mas sem engine de recommendation/upsell.

**3. Propostas sem urgência visual**
O portal `/p/:token` mostra a proposta mas sem elementos de urgência: contador de validade visível, "X outros clientes visualizaram esta proposta esta semana", ou "Preço válido por 7 dias". O campo `validade_proposta` pode existir no banco mas não há UX de countdown no portal.

**4. Follow-up humano sem contexto da IA**
O Sales Agent (agente/conversa/:id) qualifica leads via IA, mas quando o agente escala para humano, o vendedor humano recebe apenas a thread de mensagens. Não recebe: score de engajamento da IA, resumo dos pontos de dor identificados, sugestão de próxima ação, melhor horário para ligar (baseado no histórico de resposta do lead).

**5. Sem mecanismo de indicação / referral**
Clientes satisfeitos (instalação concluída, avaliação positiva) não recebem nenhum estímulo automático para indicar outros clientes. Um simples "Indique um amigo" com código de desconto poderia ser uma Edge Function acionada 7 dias após instalação concluída.

**6. O ticket médio não é aumentado sistematicamente**
Não há regras de bundle/pacote: "Compre fachada + totens + adesivos de vitrine por R$X (20% de desconto vs separado)". O motor de precificação calcula por item individualmente. Não há desconto por volume automático que incentive o cliente a aumentar o pedido.

**7. Propostas sem Social Proof**
O portal do cliente não mostra portfólio de projetos similares, depoimentos de clientes do mesmo segmento, ou "Este modelo foi instalado em 47 lojas da rede X".

#### Onde o fluxo de orçamento tem fricção desnecessária

1. **Conversão de Orçamento → Proposta → Pedido**: são 3 entidades separadas (propostas, pedidos, ordens_producao) com 3 telas diferentes. O cliente aprova no portal → o vendedor precisa manualmente criar o pedido. Deveria ser automático com revisão.
2. **Aprovação de proposta gera pedido** (migration 024 existe!) mas a UI não apresenta isso claramente — o fluxo ainda parece manual para o usuário.
3. **Assinatura digital** de contratos não existe — clientes de grande porte (redes de lojas) exigem contrato assinado antes de liberar o pedido.

#### Automações de follow-up faltando

O Sales Agent tem templates de followup1, followup2, followup3, reengajamento, mas:
- Sem trigger pós-orçamento: "Sua proposta foi visualizada mas não aprovada há 48h → enviar follow-up automático"
- Sem trigger pós-instalação: "Instalação concluída há 7 dias → pedir avaliação + NPS"
- Sem trigger de aniversário do cliente: "Cliente completou 1 ano conosco → oferta especial"
- Sem trigger de reativação: "Cliente sem pedido há 90 dias → campanha de reengajamento"
- Sem trigger de alerta de estoque baixo para clientes recorrentes: "Seu contrato de adesivos sazonais vence em 30 dias — renove agora"

---

### 🏛️ ADVISORY BOARD — Ray Dalio + Charlie Munger Perspective

#### Riscos sistêmicos que o sistema não mitiga hoje

**Risco 1 — Concentração de dados críticos sem backup de processo**
Todo o pricing está em `regras_precificacao` e `modelo_materiais`. Se um administrador deletar ou corromper essas tabelas (soft delete existe mas é recente — migration 037), os 156 modelos com markup podem ser perdidos. Não há snapshot automático periódico de configurações críticas, nem versioning de regras de precificação.

**Risco 2 — Dependência de WhatsApp Meta Cloud API sem fallback**
O canal principal do Sales Agent é WhatsApp via Meta Cloud API. Se a Meta suspender o número (isso acontece frequentemente com números novos, especialmente os "de teste" mencionados no MEMORY.md), todas as conversas ativas param. Não há fallback para SMS ou segunda linha. O chip definitivo mencionado no MEMORY.md ainda não foi adquirido.

**Risco 3 — NF-e em homologação — risco fiscal real**
O módulo fiscal está em "homologação SEFAZ" com "banner amarelo". Se a empresa estiver faturando em produção sem NF-e válida, há risco de autuação fiscal. O CLAUDE.md menciona isso mas sem prazo de migração para produção.

**Risco 4 — Sem controle de acesso por IP / dispositivo**
`AuthContext` tem RLS e roles, mas não há 2FA, nem restrição por IP, nem detecção de sessão anômala. Um credencial comprometida tem acesso irrestrito a 307 clientes, pedidos e dados financeiros.

**Risco 5 — Contas a pagar sem approval workflow**
`contas_pagar` pode ser criada por qualquer usuário com role `financeiro`. Não há fluxo de aprovação (abaixo de R$X, aprovação automática; acima de R$X, precisa de diretor). Risco de fraude interna.

#### Blind spots estratégicos no produto atual

**1. A Croma não tem vantagem de dados sobre seus clientes**
Com 307 clientes e anos de pedidos, a Croma poderia ter um modelo preditivo de "qual cliente vai precisar renovar?" ou "qual segmento está crescendo?". Hoje os dados existem no banco mas não há nenhuma camada de BI/analytics que converta isso em vantagem competitiva.

**2. O produto resolve "fazer", não "vender mais para quem já comprou"**
Toda a sofisticação do sistema está no fluxo operacional (produção, fiscal, PCP). O módulo comercial é relativamente simples (leads + pipeline + orçamento). Para uma empresa B2B com clientes recorrentes (redes de lojas compram toda temporada), o CRM pós-venda é mais valioso que o CRM pré-venda.

**3. Sem API pública / webhooks para integração com clientes enterprise**
Clientes como redes de franquias com ERPs próprios (SAP, TOTVS, Omie) não podem integrar com o sistema da Croma. Não há API REST documentada nem webhooks configuráveis. Isso limita o mercado enterprise que a Croma pode atender.

**4. O App de Campo não é vendável como produto standalone**
O `APP-Campo/` é sofisticado (PWA, analytics, store map, billing report), mas acoplado ao backend do ERP. Poderia ser um produto SaaS separado para outras empresas de comunicação visual que precisam gerenciar técnicos em campo.

#### O que concorrentes têm que este sistema não tem

**Bling, Omie, Conta Azul:**
- Marketplace de integrações (Mercado Livre, Shopify, WooCommerce)
- Cobrança recorrente / assinatura nativa
- Integração bancária Open Banking (saldo em tempo real, conciliação automática via API)
- App mobile nativo para gestão (não só para campo)
- Relatórios configuráveis pelo usuário (sem precisar de dev)
- Painel de BI embutido com Looker-like capabilities

**Específico do segmento (concorrentes de gestão para gráficas/visual):**
- Printers Plan, Print Smith, Printlogic: templates de orçamento por tipo de produto com tabelas de preço por m² configuráveis
- Gestão de cor (perfis ICC, aprovação de cor por cliente)
- Pré-flighting de arquivos (verificar se o arquivo do cliente está correto antes de imprimir)
- Gestão de aprovação de arte (cliente aprova o arte digital antes de produzir)

#### Funcionalidades de maior impacto com menor esforço

Em ordem decrescente de ROI (alto impacto, baixo esforço):

1. **NPS pós-instalação automático** — trigger no change de status para "instalado", Edge Function envia link de avaliação. 1-2 dias de trabalho. Gera dados valiosos e identifica promotores para pedir indicações.

2. **PIX no portal do cliente** — adicionar geração de QR Code PIX (API do Banco Central é pública) nas condições de pagamento do portal `/p/:token`. Accelera o recebimento.

3. **Conversão automática Proposta→Pedido** — migration 024 existe, mas a UI ainda exige ação manual. Conectar o webhook de aprovação do portal para criar pedido automaticamente. 1 dia de trabalho, elimina etapa manual.

4. **Analytics de funil com um único SQL** — criar uma view `vw_funil_comercial` que une leads + propostas + pedidos + recebimentos com timestamps, calcula tempo por etapa e taxa de conversão. 1 dia de trabalho, transforma o dashboard do diretor.

5. **Alerta de renovação de contrato/manutenção** — criar tabela `contratos_servico` simples (cliente, tipo, vencimento), trigger automático de WhatsApp 30 dias antes. Gera receita recorrente capturada.

---

## MATRIZ DE PRIORIDADE — Impacto × Esforço

```
ALTO IMPACTO
    │
    │  [QUICK WINS]              [GRANDES APOSTAS]
    │  NPS automático            Multi-filial
    │  PIX portal                Portal Fornecedor
    │  Funil analytics view      Integração EDI/API enterprise
    │  Proposta→Pedido auto      App Campo real-time bridge
    │  Alertas manutenção        MRP / projeção materiais
    │
    │─────────────────────────────────────────────────
    │
    │  [FILL-INS]                [PROJETOS QUESTIONÁVEIS]
    │  Garantias por item        Assinatura digital full
    │  Upsell sugestões          API pública documentada
    │  Social proof portal       BI configurável pelo usuário
    │  Templates urgência        App mobile nativo gestão
    │
BAIXO IMPACTO
    ├────────────────────────────────────────────────
  BAIXO ESFORÇO               ALTO ESFORÇO
```

### Classificação detalhada

| Funcionalidade | Impacto (1-10) | Esforço (P/M/G) | Prioridade |
|---|---|---|---|
| View SQL funil comercial | 9 | P | CRÍTICO |
| NPS pós-instalação (Edge Function) | 8 | P | CRÍTICO |
| PIX no portal cliente | 8 | P | CRÍTICO |
| Proposta→Pedido automático (UI fix) | 9 | P | CRÍTICO |
| Contratos de manutenção (schema + UI básica) | 9 | M | ALTA |
| Alertas de renovação WhatsApp | 8 | M | ALTA |
| Cotação multi-fornecedor | 8 | M | ALTA |
| Follow-up contextual pós-escalonamento | 7 | M | ALTA |
| Upsell sugestões no orçamento | 7 | M | ALTA |
| Relatório de perda de orçamentos | 7 | P | ALTA |
| Avaliação de fornecedores | 6 | M | MÉDIA |
| 2FA / segurança de acesso | 8 | M | ALTA (segurança) |
| Approval workflow contas a pagar | 7 | M | ALTA (compliance) |
| Portal fornecedor | 8 | G | MÉDIA (timing) |
| MRP projeção de materiais | 8 | G | MÉDIA (timing) |
| Multi-filial real | 9 | G | BAIXA (timing) |
| API pública / EDI | 7 | G | BAIXA (timing) |

---

## ROADMAP SUGERIDO — Próximos 3 Sprints

---

### Sprint 5 — "Receita Capturada" (2 semanas)
**Tema**: Capturar receita que hoje faz falta + eliminar fricções no fluxo de vendas

**Justificativa estratégica**: Cada sprint até aqui foi sobre construir o sistema. Este sprint é sobre transformar o sistema construído em vantagem competitiva real de curto prazo. Os itens são pequenos mas o impacto é imediato e mensurável.

#### Tasks (estimativa: 10-12 dias de dev)

**Task S5-01** — View de Funil Comercial (2 dias)
- Criar `vw_funil_comercial` no Supabase com taxa de conversão por etapa
- Adicionar cards "Funil de Vendas" no DashboardDiretor
- KPIs: leads criados / propostas enviadas / pedidos aprovados / faturado — por mês
- Tempo médio por etapa (dias)

**Task S5-02** — NPS Pós-Instalação Automático (1 dia)
- Edge Function `enviar-nps-instalacao`: trigger quando `ordens_instalacao.status = 'concluida'`
- WhatsApp template com link único `/avaliacao/:token`
- Página pública de avaliação (1-5 estrelas + comentário)
- Tabela `avaliacoes_instalacao` + KPI no dashboard

**Task S5-03** — PIX no Portal do Cliente (1 dia)
- Adicionar geração de QR Code PIX estático no `PortalOrcamentoPage`
- Suporte a PIX chave (CNPJ da empresa) + valor + descrição
- Botão "Pagar via PIX" nas condições de pagamento

**Task S5-04** — Proposta→Pedido Automático (1 dia)
- A migration 024 existe mas a UI não está conectada
- Quando portal recebe aprovação do cliente → criar pedido automaticamente com status `aguardando_producao`
- Notificação no ERP: "Nova aprovação recebida — pedido #XXX criado"

**Task S5-05** — Contratos de Manutenção — Schema + UI Básica (3 dias)
- Migration: tabela `contratos_servico` (cliente_id, tipo, valor_mensal, vencimento, status)
- Page `/contratos` com lista + criar/editar
- Edge Function `alertar-contratos-vencendo`: rodar semanalmente, WhatsApp 30 dias antes do vencimento
- Card no dashboard: "X contratos vencem nos próximos 30 dias"

**Task S5-06** — Relatório de Perda de Orçamentos (1 dia)
- Adicionar campo `motivo_recusa` em propostas (enum: preço, prazo, concorrente, cliente_sumiu, outro)
- Tela de análise: pizza por motivo, tabela detalhada, exportação Excel

**Task S5-07** — 2FA por Email (1 dia)
- Supabase Auth já suporta TOTP/MFA via `supabase.auth.mfa`
- Ativar para roles: admin, diretor, financeiro
- UI na página de Settings para ativar/desativar

**Meta de sucesso do Sprint 5**:
- ≥ 1 contrato de manutenção cadastrado por semana
- Taxa de aprovação de proposta via portal aumenta (medida pela view do funil)
- ≥ 10 NPS coletados no primeiro mês

---

### Sprint 6 — "Operação Eficiente" (2 semanas)
**Tema**: Reduzir trabalho manual, aumentar margem, melhorar experiência de compra

**Justificativa**: Com o Sprint 5 gerando dados de funil e NPS, este sprint usa esses dados para otimizar pontos de fricção identificados.

#### Tasks (estimativa: 10-12 dias de dev)

**Task S6-01** — Cotação Multi-Fornecedor (3 dias)
- Tabela `cotacoes_compra` com FK para `pedidos_compra`
- Tela: a partir de um pedido de compra, enviar cotação por email para múltiplos fornecedores
- Edge Function `enviar-cotacao-fornecedor` via Resend
- Portal simplificado para fornecedor responder preço + prazo
- Comparativo automático de cotações, aprovação do melhor preço

**Task S6-02** — Upsell Inteligente no Orçamento (2 dias)
- Criar tabela `regras_upsell` (produto_origem, produto_sugestao, desconto_bundle, ativo)
- No `OrcamentoEditorPage`, após adicionar item, mostrar sugestões: "Clientes que compraram X também adicionaram Y"
- Baseado em dados reais de `proposta_itens` (co-ocorrência de produtos)

**Task S6-03** — Approval Workflow para Contas a Pagar (2 dias)
- Campo `requer_aprovacao` e `aprovado_por` em `contas_pagar`
- Regra configurável: acima de R$ X → requer aprovação do diretor
- Notificação WhatsApp para aprovador
- Página `/financeiro/aprovacoes-pendentes`

**Task S6-04** — Follow-up Contextual pós-escalonamento (1 dia)
- Quando agente escala para humano (`agent_conversations.status = 'aguardando_aprovacao'`)
- Gerar "brief de vendas" via IA: resumo da conversa, pontos de dor, sugestão de abordagem
- Exibir no `AgentConversationPage` ao lado da thread

**Task S6-05** — Dashboard de Retenção de Clientes (2 dias)
- View `vw_retencao_clientes`: clientes com 1 pedido, 2-5 pedidos, 6+ pedidos
- Métricas: clientes novos vs recorrentes (últimos 12 meses), taxa de recompra por segmento
- Alerta: clientes recorrentes sem pedido nos últimos 90 dias

**Task S6-06** — Roteirização básica para instalações (2 dias)
- Integrar Google Maps Directions API no `InstalacaoPage`
- Botão "Otimizar rota do dia" para o técnico: dado as instalações do dia, ordenar por menor distância
- Link para abrir no Google Maps com rota completa

**Meta de sucesso do Sprint 6**:
- Primeira cotação multi-fornecedor gera economia mensurável
- 5% de aumento no ticket médio via upsell
- Zero contas pagas sem aprovação acima do limite configurado

---

### Sprint 7 — "Escala" (2-3 semanas)
**Tema**: Preparar o sistema para crescimento: novas filiais, clientes enterprise, produto de dados

**Justificativa**: Com Sprints 5 e 6 resolvendo as fricções operacionais, Sprint 7 abre novos mercados e modelos de receita.

#### Tasks (estimativa: 12-15 dias de dev)

**Task S7-01** — Multi-filial operacional (4 dias)
- Adicionar `filial_id` nas tabelas operacionais principais (leads, pedidos, clientes, contas_*)
- RLS policy incluindo filial_id
- UI de seleção de filial no header
- Relatórios com filtro por filial e consolidado

**Task S7-02** — Portal de Fornecedores (3 dias)
- Rota pública `/fornecedor/:token` para fornecedores responderem cotações
- Login simples (email + código) para fornecedores cadastrados
- Visualização de POs abertas, upload de NF contra o PO
- Histórico de pedidos do fornecedor

**Task S7-03** — MRP Básico — Projeção de Materiais (3 dias)
- View `vw_necessidade_materiais`: dados os pedidos em carteira, calcular m² de cada material necessário
- Comparar com estoque atual → gerar sugestão de compra automática
- Integração com módulo de compras: "Criar PO sugerido" com um clique

**Task S7-04** — Aprovação de Arte (2 dias)
- Campo `arquivo_arte_aprovado` e `aprovacao_arte_em` em `proposta_itens`
- Upload de arquivo de arte no portal `/p/:token`
- Cliente aprova digitalmente com assinatura eletrônica simples (checkbox + timestamp)
- Produção só começa após arte aprovada

**Task S7-05** — API Webhook configurável (3 dias)
- Tabela `webhooks_config` (evento, url, secret, ativo)
- Eventos: pedido_criado, proposta_aprovada, instalacao_concluida, nfe_emitida
- Edge Function `dispatch-webhook` com retry logic e log de entregas
- UI em `/admin/config` para configurar webhooks

**Meta de sucesso do Sprint 7**:
- Segunda filial cadastrada e operando em paralelo
- Primeiro fornecedor usando o portal para enviar NF
- Primeiro cliente enterprise integrado via webhook

---

## CONCLUSÃO ESTRATÉGICA

O sistema Croma Print ERP/CRM é tecnicamente maduro e cobre bem o fluxo operacional. A diferença entre um "sistema que funciona" e um "sistema que gera vantagem competitiva" está em três áreas:

**1. Dados que geram decisões**: O sistema coleta dados mas não os transforma em insights acionáveis. A view de funil comercial, o dashboard de retenção, e a análise de perda de orçamentos são transformações simples nos dados que já existem — mas que hoje a gestão não tem.

**2. Receita recorrente capturada**: A Croma provavelmente tem dezenas de clientes que precisam de manutenção, adesivos sazonais, atualizações de cardápio — e está deixando essa receita escapar por falta de um módulo de contratos. Este é o gap de maior ROI no curto prazo.

**3. Experiência de compra sem fricção**: Do lead qualificado pelo agente de IA até o pagamento via PIX, ainda existem 3-4 etapas manuais que podem ser automatizadas. Cada eliminação de fricção é conversão que estava sendo perdida.

O Sprint 5 está pronto para execução imediata com alto retorno e baixo risco.

---

*Relatório gerado por xQuads Master Orchestrator em 2026-03-21*
*Baseado em análise de: 16 domínios, 80 migrations, 30 Edge Functions, ~150 componentes React*
