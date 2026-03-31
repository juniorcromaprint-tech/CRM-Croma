# xQuads Master Orchestrator — Auditoria Estratégica Pós-Sprint 7
> **Data**: 2026-03-21 | **Versão**: 1.0 | **Scope**: Sistema completo pós-Sprint 6 & 7 mergeados
> **Fontes**: 16 domínios analisados, 89 migrations, 30 Edge Functions, 37 testes automatizados coletados

---

## 1. EXECUTIVE SUMMARY

O Croma Print ERP/CRM alcançou um patamar de maturidade operacional genuíno após 7 sprints. O sistema cobre o fluxo `Lead → Orçamento → Pedido → Produção → Instalação → Faturamento` de ponta a ponta, com módulos satélites funcionais: fiscal (NF-e homologação), contábil (DAS, OFX, balancete), Sales Agent (WhatsApp + Email), AI Orçamento (intent → proposta), Portal do Cliente (`/p/:token`), Contratos MRR, Reserva de Estoque, Gantt de Máquinas e Approval Workflow para contas a pagar. Sprints 6 e 7 entregaram as funcionalidades que o relatório anterior (2026-03-21-MASTER-AUDIT-REPORT.md) classificava como críticas: GAP-03 (reserva estoque), GAP-04 (Gantt real), P-01 (contratos manutenção), P-05 (approval contas a pagar), E-04 (webhooks configuráveis). Isso eleva o score de maturidade operacional de ~67% para estimados ~82%.

A transição estratégica que o sistema precisa fazer agora é de "sistema que executa operações" para "sistema que gera inteligência de negócio e receita recorrente de forma autônoma". Três lacunas estruturais bloqueiam esse salto: (1) ausência de comissões funcionais — o trigger que deveria gerar comissões automaticamente não existe no banco, deixando a feature 100% decorativa apesar de estar há múltiplos sprints no sistema; (2) rastreabilidade lead→pedido quebrada — sem `lead_id` em pedidos e sem `proposta_id` em pedidos, é impossível calcular ROI por canal de aquisição ou taxa de conversão do funil de vendas com precisão; (3) NF-e ainda em homologação SEFAZ sem prazo definido para produção, representando risco fiscal real enquanto a empresa fatura.

O próximo sprint mais estratégico não é "adicionar features novas" — é "fechar os buracos que fazem as features existentes não funcionarem". A Croma tem um sistema sofisticado com ~8 módulos que prometem automação mas entregam formulários vazios porque a camada de dados (triggers, views, FKs de rastreabilidade) não foi completada. Resolver isso cria um efeito multiplicador: o mesmo código que já existe passa a produzir valor real.

---

## 2. ANÁLISE POR SQUAD

---

### ADVISORY BOARD — Ray Dalio, Charlie Munger, Naval, Peter Thiel

#### Riscos Sistêmicos

**Risco 1 — Comissões: promessa sem entrega (confiança interna)**
O módulo `ComissoesPage.tsx` afirma "As comissões são geradas automaticamente quando pedidos são pagos". Nenhum trigger existe no banco para fazer isso. Vendedores que consultam a tela veem tabela sempre vazia. Isso corrói confiança do time de vendas no sistema antes mesmo de chegar ao cliente. Impacto: adoção zero do módulo mais importante para motivação da equipe comercial.

**Risco 2 — NF-e em homologação (risco fiscal e regulatório)**
O sistema fiscal está operacional tecnicamente, mas ainda em ambiente de homologação SEFAZ. A empresa provavelmente emite notas por outro sistema em paralelo ou manualmente. Se a Croma está faturando sem NF-e válida, o risco é multa + autuação fiscal. Se está emitindo em duplicidade, o risco é conciliação manual e inconsistência contábil. O prazo zero para migração para produção é o maior risco regulatório do sistema.

**Risco 3 — Dependência crítica em WhatsApp Meta Cloud sem chip definitivo**
O Sales Agent e o AI Orçamento dependem integralmente da Meta Cloud API para WhatsApp. O número de teste ainda não foi substituído pelo chip definitivo (pendência documentada em `project_whatsapp_chip.md` desde 2026-03-20). Risco real: Meta pode suspender números de teste sem aviso. Todas as automações de follow-up, escalação e orçamento por WhatsApp param instantaneamente.

**Risco 4 — Contas a pagar: approval workflow existe mas sem regra de valor configurada**
A migration 087 criou os campos (`requer_aprovacao`, `aprovado_por`), mas não há nenhuma regra automática que marque `requer_aprovacao = true` baseada em valor. O approval workflow é um formulário sem lógica. Um pagamento de R$50.000 pode ser processado sem aprovação exatamente como um de R$500.

**Risco 5 — Sem backup de configurações críticas**
Os 156 modelos com markup, as 11 regras de precificação, e os 467 materiais com preço real são a espinha dorsal do motor de orçamento. Uma deleção acidental (soft delete parcialmente implementado) ou corruption pode derrubar toda a precificação. Não há snapshot periódico dessas tabelas, nem export automatizado de configurações críticas.

#### Blind Spots Estratégicos

**Charlie Munger — Inversion**: O que pode destruir o valor gerado? Resposta: um vendedor sênior que decide que "o sistema não funciona" porque as comissões estão vazias, o funil não mostra conversão real, e o orçamento ainda leva 20 minutos. A adoção do sistema pelo time interno é o principal risco que não aparece em nenhum relatório técnico.

**Ray Dalio — Correlação de riscos**: Os riscos 1, 2, e 3 são independentes mas correm em paralelo. Se os três se materializarem no mesmo mês (vendedor abandona sistema + autuação fiscal + WhatsApp suspenso), o dano é não-linear e potencialmente existencial para a operação.

**Naval — Leverage**: Onde está o ponto de alavancagem mais alto? View SQL de funil comercial. Um arquivo `.sql` de ~50 linhas transforma dados que já existem em insights que o diretor não tem. ROI infinito (zero custo marginal por insight gerado).

**Peter Thiel — Secrets**: O que a Croma sabe que outros não sabem? Com 307 clientes e histórico de pedidos, a Croma tem dados sobre quais tipos de clientes compram com maior frequência, quais produtos têm maior margem real, e quais regiões geram maior volume. Hoje esses dados dormem em tabelas Postgres sem nenhuma camada de BI. Essa é a vantagem competitiva que nenhum concorrente pode replicar facilmente.

---

### HORMOZI — Grand Slam Offer, CLOSER Framework

#### O Sistema Suporta Geração de Valor Máximo?

**Avaliação: 6.5/10 — Bom para operação, fraco para vendas**

O sistema executa muito bem a "entrega do produto" (produção, instalação, faturamento). Onde falha é na "venda do produto" — o momento entre o lead ter interesse e assinar o pedido. Nesse trecho crítico:

**O que funciona bem:**
- AI Orçamento via WhatsApp: detecta intenção, gera proposta completa, cliente aprova no portal — isso é Grand Slam para o canal digital
- Portal `/p/:token` com tracking de comportamento: saber que o cliente abriu 3x a proposta mas não aprovou é dado de ouro para follow-up
- Sales Agent com escalação para humano: elimina triagem manual de leads não qualificados

**O que quebra o funil de vendas:**
1. **Sem urgência no portal**: `validade_proposta` existe no banco mas não há countdown visual no portal `/p/:token`. O cliente vê a proposta sem prazo de validade = zero urgência = procrastinação.
2. **Upsell zero**: quando o cliente adiciona "banner 3x1m" no orçamento, o sistema não sugere laminação (+margem), instalação (+receita), ou banner de backup (+recorrência). Cada orçamento é uma oportunidade de upsell perdida sistematicamente.
3. **Social proof ausente**: o portal não mostra "instalado em 47 redes de franquias similares" nem depoimentos por segmento. Para clientes de rede que querem segurança de decisão, isso é decisivo.
4. **Follow-up do humano sem contexto**: quando o agente escala para humano (`AgentApprovalPage`), o vendedor recebe a thread mas não recebe: score de interesse, pontos de dor identificados pela IA, sugestão de approach, melhor horário estimado de contato.

#### Funcionalidades com Maior "Antes/Depois"

| Funcionalidade | Antes | Depois | ROI Estimado |
|---|---|---|---|
| Comissões automáticas reais | Vendedor não confia no sistema | Vendedor tem incentivo mensurado | Adoção +50% |
| Countdown de validade no portal | Cliente procrastina sem pressão | Conversão aumenta com urgência real | +10-15% conversão |
| Brief de IA para humano na escalação | Vendedor começa do zero | Vendedor aborda com contexto preciso | Ciclo de venda -20% |
| Contratos MRR alertas automáticos | Renovação depende de cliente ligar | Sistema alerta 30 dias antes | Churn recorrente -40% |
| Funil analytics operacional | Diretor não sabe % de conversão | Diretor toma decisão baseada em dados | Precificação estratégica |

#### Como o Sistema Pode Criar Ofertas Irrecusáveis

O modelo de Grand Slam Offer para comunicação visual profissional seria: **"Pedido aprovado hoje → arte em 24h → entrega garantida ou devolvemos o frete"**. O sistema já tem os blocos para isso (aprovação no portal, briefing de produção, expedição), mas falta o SLA automatizado: trigger que calcula prazo baseado na capacidade do Gantt, confirma no portal, e monitora o cumprimento com alerta se der risco de atraso.

---

### DATA SQUAD — Avinash Kaushik, Peter Fader

#### Métricas Capturadas vs. Métricas Necessárias

**O que o sistema captura (bem):**
- Volume de leads, propostas, pedidos por período
- Valor faturado, recebido, a receber
- Status de cada pedido no fluxo operacional
- NPS score (novo — migration 083) com categorização promotores/neutros/detratores
- MRR via contratos de serviço (novo — migration 086)
- Tracking de acesso ao portal do cliente (`tracking_acessos`)
- Estoque disponível vs. reservado (novo — migration 084)

**O que o sistema deveria capturar mas não captura:**

*KPIs Comerciais críticos ausentes:*
- **Taxa de conversão por etapa do funil**: `useFunnelStats()` existe e busca dados, mas a FK `lead_id` em propostas e `proposta_id` em pedidos não existem — o cálculo usa aproximações por cliente, não rastreamento direto lead→proposta→pedido. Os números do FunnelCard são estimativas, não métricas precisas.
- **Ciclo de venda médio**: tempo entre criação do lead e primeiro pedido. Dados existem, agregação não existe.
- **Win/Loss rate por segmento**: propostas têm status `recusada` mas sem `motivo_recusa` estruturado (enum). Campo `motivo_descarte` está em leads mas não em propostas.
- **CLV (Customer Lifetime Value)**: histórico de pedidos por cliente existe em tabelas, mas zero cálculo de CLV em qualquer hook ou view.
- **CAC por canal de aquisição**: `lead_sources` existe mas sem registro de investimento por canal — CAC não é calculável.

*KPIs Operacionais ausentes:*
- **OTIF (On-Time-In-Full)**: `data_prometida` existe em pedidos mas nenhum KPI calcula % de pedidos entregues no prazo prometido
- **Fill Rate por produto**: sem análise de quais produtos mais frequentemente atrasam
- **OEE das máquinas**: `AdminMaquinasPage` existe mas sem downtime tracking nem utilização real vs. planejada

*KPIs Financeiros ausentes:*
- **Margem líquida real por pedido**: custo de produção (materiais + processos) vs. valor faturado — os dados existem mas a agregação não existe em nenhum dashboard
- **DSO (Days Sales Outstanding)**: prazo médio de recebimento calculável mas não calculado
- **Fluxo de caixa projetado**: `FluxoCaixaPage` existe mas baseado em dados históricos, não em projeção baseada em pedidos em carteira

#### Rastreabilidade Lead→Faturamento: Status Real

**Parcialmente quebrada em dois pontos críticos:**

1. `propostas` não tem coluna `lead_id` → quando lead vira proposta, a origem se perde
2. `pedidos` não tem coluna `proposta_id` → quando proposta vira pedido, a rastreabilidade comercial se perde

Resultado: `FunnelCard` mostra números mas baseados em contagens independentes por período, não em rastreamento real da jornada do cliente. O diretor vê "32 leads → 18 propostas → 12 pedidos" mas não pode dizer "destes 12 pedidos, 8 vieram de leads de indicação e 4 de digital" porque o link foi perdido.

#### Dashboards Críticos Faltando

1. **Dashboard de Rentabilidade por Pedido**: margem bruta real (faturado - custo de materiais - processos), ranqueamento dos pedidos mais/menos rentáveis
2. **Dashboard de Retenção**: clientes com 1 pedido vs. recorrentes, cohort por mês de primeiro pedido, taxa de recompra
3. **Análise de Perda de Orçamentos**: motivo de recusa, valor perdido por motivo, por segmento, por vendedor
4. **Dashboard de Capacidade**: Gantt existe mas sem visão de % de ocupação da fábrica nos próximos 30 dias

---

### C-LEVEL — CEO / COO / CMO / CTO

#### CEO: O Sistema Escala para 10x de Clientes?

**Resposta: Tecnicamente sim, operacionalmente não.**

A stack (Supabase + Vercel + RLS) suporta 10x o volume atual sem mudança de arquitetura. O Supabase aguenta 3.000+ clientes ativos. O problema não é tecnológico — é que o sistema atual é **single-tenant operacionalmente**: sem `filial_id` nas tabelas operacionais, uma segunda unidade da Croma exigiria um segundo projeto Supabase inteiro. A migration 065 criou suporte multi-empresa para NF-e, mas as tabelas operacionais principais (leads, pedidos, clientes, contas_*) não têm discriminador de filial.

Para 10x de clientes (3.000 clientes), o sistema funcionaria. Para 10x de unidades (10 filiais), quebraria.

#### COO: Maiores Gaps Operacionais

**Gap 1 — Comissões sem trigger**: Feature que motivaria o time de vendas a usar o sistema está 100% decorativa. Zero linhas de trigger no banco para gerar comissões. Prioridade máxima para adoção interna.

**Gap 2 — Gantt existe mas sem alocação automática**: `PCPDashboardPage` tem `GanttMaquinas()` funcional e migration 085 adicionou `maquina_id` e datas previstas nas OPs. Porém, a seleção de máquina na criação de OP é manual. O sistema não sugere "melhor máquina disponível" baseado na janela de tempo livre. O Gantt é visual mas não é um ferramenta de planejamento ativo.

**Gap 3 — App de Campo ainda desacoplado do ERP em tempo real**: A bridge ERP↔Campo (migration 004, marcada como pendente no CLAUDE.md) usa views (`vw_campo_instalacoes`) e triggers de sincronização. Tecnicamente funciona, mas o gerente no ERP não vê progresso de instalação em tempo real — vê apenas o estado final quando o técnico conclui o job no app de campo.

**Gap 4 — Arquivo de arte ainda fora do fluxo**: Migration 088 criou o bucket `producao-arquivos`, mas não há campo `arquivo_arte_id` em `proposta_itens` nem UI para o cliente aprovar arte digitalmente antes da produção. O operador no chão de fábrica não tem acesso ao arquivo aprovado dentro do sistema.

#### CMO: Maiores Gaps de Marketing e Crescimento

**Gap 1 — Sem mecanismo de referral**: com 307 clientes, um programa de indicação automatizado (trigger pós-NPS promotor = 4 ou 5 estrelas → WhatsApp "Indique um colega") poderia gerar leads de alta qualidade a custo zero.

**Gap 2 — Campanhas sem tracking**: a Edge Function `enviar-email-campanha` envia via Resend mas sem webhook de tracking de abertura/clique configurado. A Croma envia campanhas para sua base de 307 clientes sem saber quais abriram, quais clicaram, quais desengajaram.

**Gap 3 — PIX parcialmente implementado**: migration 082 e `PortalPixInfo` existem, mas o PIX está disponível apenas quando `forma_pagamento === 'pix'` e `chavePix` está configurada. Não há geração de QR Code dinâmico com valor pré-preenchido — apenas exibe a chave PIX. No Brasil, PIX é >70% dos pagamentos digitais B2B.

#### CTO: Maiores Gaps Técnicos

**Gap 1 — Sem 2FA**: `AdminUsuariosPage` existe, mas não há implementação de MFA/TOTP via `supabase.auth.mfa`. Credenciais comprometidas têm acesso irrestrito a 307 clientes, dados financeiros, e configurações fiscais.

**Gap 2 — Comissões: débito técnico crítico**: Não há trigger em nenhuma das 89 migrations para inserir em `comissoes`. A feature foi construída como UI sem back-end funcional. Impacto de adoção alto, correção baixa (<1 dia).

**Gap 3 — `lead_id` / `proposta_id` faltantes**: Falta adicionar duas colunas FK em tabelas existentes para restaurar rastreabilidade do funil. Custo: 1 migration + 1 dia de UI. Benefício: funil de vendas real, análise de conversão por canal, CLV calculável.

**Gap 4 — Approval workflow sem lógica automática**: migration 087 adicionou os campos. `AdminConfigPage` tem a regra de valor. Mas não há trigger que, ao inserir conta a pagar acima do valor configurado, marque `requer_aprovacao = true` automaticamente. O aprovador precisa manualmente marcar — o que derrota o propósito do workflow.

**Gap 5 — Webhooks configuráveis: tabela existe, dispatch não**: migration 089 criou `webhook_configs` e `WebhooksPage.tsx` existe em `/admin/webhooks`. Mas não há Edge Function `dispatch-webhook` que efetivamente faça POST para as URLs configuradas quando eventos acontecem. É infraestrutura sem consumidor.

---

## 3. TOP 5 OPORTUNIDADES ESTRATÉGICAS (priorizadas por ROI)

### #1 — COMISSÕES AUTOMÁTICAS REAIS
**ROI: Altíssimo (adoção interna × motivação × retenção de vendedores)**

Criar trigger no Supabase: quando `contas_receber.status = 'recebido'` e o pedido vinculado tem `vendedor_id`, inserir em `comissoes` (valor = faturado × % comissão do vendedor). O módulo existe completo na UI — só falta o trigger de 20 linhas de SQL.

Impacto direto: vendedores passam a confiar no sistema. Adoção do CRM pelo time comercial aumenta. O módulo que mais afeta comportamento humano no sistema passa a funcionar.

**Esforço**: 4 horas | **Impacto**: 10/10

---

### #2 — FUNIL COMERCIAL COM RASTREABILIDADE REAL
**ROI: Alto (decisões estratégicas baseadas em dados reais)**

Duas ações em sequência:
1. Migration: adicionar `lead_id uuid REFERENCES leads(id)` em `propostas`, e `proposta_id uuid REFERENCES propostas(id)` em `pedidos`
2. Atualizar `orcamento.service.ts` para propagar `lead_id` ao criar proposta, e `proposta_id` ao criar pedido
3. Reescrever `useFunnelStats()` para usar rastreamento real ao invés de contagens aproximadas por período

Impacto: o `FunnelCard` no `DashboardDiretor` passa a mostrar dados precisos. Win rate real, ciclo de venda médio, ROI por canal de aquisição — tudo isso se torna calculável.

**Esforço**: 1 dia | **Impacto**: 9/10

---

### #3 — APPROVAL WORKFLOW: LÓGICA AUTOMÁTICA
**ROI: Alto (compliance financeiro + segurança contra fraude interna)**

A infra existe (migration 087, `AdminConfigPage`, `FinanceiroPage`). Falta:
1. Trigger SQL: `BEFORE INSERT OR UPDATE ON contas_pagar` → se `valor > config_aprovacao_minimo`, setar `requer_aprovacao = true, status = 'pendente_aprovacao'`
2. Notificação WhatsApp para aprovador (Edge Function `whatsapp-enviar` já existe)
3. `AdminConfigPage`: campo "Valor mínimo para aprovação de despesas" já existe — conectar ao trigger

Impacto: zero despesas acima do limite sem aprovação do diretor. Redução de risco de fraude interna.

**Esforço**: 6 horas | **Impacto**: 8/10

---

### #4 — NF-e MIGRAÇÃO PARA PRODUÇÃO SEFAZ
**ROI: Crítico (compliance legal + receita fiscal oficial)**

O módulo NF-e está completo tecnicamente: Edge Functions (`fiscal-emitir-nfe`, `fiscal-gerar-danfe`, `fiscal-consultar-nfe`), certificado digital, ambientes configuráveis, migration 003_fiscal. O único bloqueador é a configuração do ambiente de produção no `FiscalConfiguracaoPage`.

Ações:
1. Seed dos 156 modelos com NCM correto (migration 081 já existe como seed de NCM — verificar se aplicada)
2. Configurar `fiscal_ambientes` com endpoint de produção SEFAZ
3. Desabilitar banner amarelo de homologação
4. Teste de emissão real com DANFE válida

**Esforço**: 1-2 dias (configuração + seed + testes) | **Impacto**: 9/10 (risco regulatório eliminado)

---

### #5 — DISPATCH DE WEBHOOKS: INFRA COMPLETA
**ROI: Médio-Alto (habilita integrações enterprise sem dev adicional)**

Migration 089 criou `webhook_configs` e `WebhooksPage.tsx` existe. Falta a Edge Function `dispatch-webhook`:
1. Criar `supabase/functions/dispatch-webhook/index.ts` que recebe `(evento, payload)` e faz POST para todas as `webhook_configs` ativas para esse evento
2. Adicionar call em pontos estratégicos: `pedido.criado`, `proposta.aprovada`, `instalacao.concluida`, `nfe.emitida`
3. Tabela `webhook_logs` para auditoria de entregas e retry

Impacto: a Croma pode integrar com ERPs de clientes enterprise (SAP, TOTVS, Omie) sem código customizado por integração.

**Esforço**: 1 dia | **Impacto**: 7/10

---

## 4. TOP 5 RISCOS (priorizados por impacto)

### RISCO #1 — NF-e em Homologação: Risco Fiscal Ativo
**Impacto**: CRÍTICO | **Probabilidade**: Alta (enquanto nada mudar)

O sistema está em produção mas emitindo NF-e em ambiente de homologação (ou não emitindo). Risco de autuação fiscal, multas, e inconsistência contábil entre o ERP e o SEFAZ. Toda a receita faturada no período sem NF-e válida representa passivo fiscal.

**Mitigação imediata**: definir data de migração para produção (recomendado: próximos 14 dias) e executar as ações da oportunidade #4.

---

### RISCO #2 — Chip WhatsApp de Teste: Risco de Interrupção Total das Automações
**Impacto**: ALTO | **Probabilidade**: Média (Meta suspende números de teste sem aviso)

Sales Agent, AI Orçamento por WhatsApp, alertas de contratos MRR, notificações de aprovação — tudo depende do mesmo número de teste. Suspensão = zero automações de negócio funcionando. Não há fallback para email, SMS ou segundo número.

**Mitigação imediata**: adquirir chip definitivo (ação do usuário, já documentada como pendente). Configurar email como fallback em todas as Edge Functions que enviam WhatsApp.

---

### RISCO #3 — Adoção Interna Frágil: Comissões e Funil Vazios
**Impacto**: ALTO | **Probabilidade**: Alta (já acontecendo)

Vendedores consultam `ComissoesPage` e veem tabela vazia. O `DashboardDiretor` mostra métricas de funil baseadas em aproximações. Se o sistema não entrega o que promete para os usuários internos mais críticos (vendedores e diretores), o risco é regressão para planilhas — desfazendo meses de desenvolvimento.

**Mitigação**: sprint focado em "fechar o que está pela metade" — comissões e funil são as duas features de maior impacto na adoção interna.

---

### RISCO #4 — Approval Workflow Decorativo: Risco de Fraude Financeira
**Impacto**: ALTO | **Probabilidade**: Alta (sem trigger automático, qualquer despesa passa sem aprovação)

A UI de approval existe, os campos no banco existem, mas sem o trigger automático que marca `requer_aprovacao = true` por valor, o fluxo de aprovação é opt-in manual. Qualquer usuário financeiro pode criar e pagar uma conta de qualquer valor sem aprovação.

**Mitigação**: trigger SQL + notificação WhatsApp ao aprovador (oportunidade #3, estimativa 6 horas).

---

### RISCO #5 — Concentração de Dados de Precificação Sem Versionamento
**Impacto**: MÉDIO | **Probabilidade**: Baixa (soft delete existe, mas parcial)

Os 467 materiais com preço, 156 modelos com markup, e 11 regras de precificação são a base de todo o motor de orçamento. Soft delete existe (migration 037) mas não há versioning histórico de regras de precificação nem export automático periódico. Uma mudança incorreta em `regras_precificacao` pode afetar todos os orçamentos futuros sem histórico de rollback.

**Mitigação**: tabela `regras_precificacao_historico` com triggers de auditoria + export automático semanal via Edge Function para OneDrive.

---

## 5. RECOMENDAÇÃO DO PRÓXIMO SPRINT

### Sprint 8 — "Fechar o Que Existe" (estimativa: 6-8 dias)
**Tema**: Completar funcionalidades existentes que estão pela metade e eliminam confiança no sistema

**Justificativa estratégica**: os 7 sprints anteriores construíram a estrutura. Sprint 8 é o sprint que faz a estrutura funcionar. Cada item abaixo é uma funcionalidade que já existe na UI mas não tem back-end funcional, ou tem back-end mas sem a lógica que a ativa automaticamente. O custo de desenvolvimento é mínimo (triggers SQL, 1-2 Edge Functions). O impacto é máximo porque ativa features que o time já conhece mas não usa.

**Princípio orientador**: nenhuma feature nova. Apenas completar o que está 80% pronto.

---

#### TASK S8-01 — Trigger de Comissões (4 horas)
```sql
CREATE OR REPLACE FUNCTION gerar_comissao_pedido()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando CR marcada como recebida, gerar comissão se pedido tem vendedor
  IF NEW.status = 'recebido' AND OLD.status != 'recebido' THEN
    INSERT INTO comissoes (pedido_id, vendedor_id, valor_pedido, valor_comissao, status)
    SELECT p.id, p.vendedor_id,
           NEW.valor,
           NEW.valor * (v.comissao_percentual / 100),
           'pendente'
    FROM pedidos p
    JOIN profiles v ON v.id = p.vendedor_id
    WHERE p.id = NEW.pedido_id
    AND p.vendedor_id IS NOT NULL
    ON CONFLICT (pedido_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

#### TASK S8-02 — FKs de Rastreabilidade do Funil (1 dia)
- Migration: `ALTER TABLE propostas ADD COLUMN lead_id uuid REFERENCES leads(id)`
- Migration: `ALTER TABLE pedidos ADD COLUMN proposta_id uuid REFERENCES propostas(id)`
- Update `orcamento.service.ts`: propagar `lead_id` do contexto comercial ao criar proposta
- Update `useFunnelStats()`: reescrever com JOINs reais ao invés de contagens separadas
- Resultado esperado: FunnelCard passa de estimativas para métricas precisas

---

#### TASK S8-03 — Trigger de Approval Automático (6 horas)
- Trigger SQL: ao INSERT/UPDATE em `contas_pagar`, verificar `valor >= config_valor_minimo_aprovacao`
- Se sim: `requer_aprovacao = true`, `status = 'pendente_aprovacao'`
- Edge Function: notificar aprovador via WhatsApp com link direto para aprovação
- UI `AdminConfigPage`: campo "Limite de aprovação automática" (já existe — conectar ao trigger)

---

#### TASK S8-04 — NF-e para Produção SEFAZ (1-2 dias)
- Verificar se migration 081 (seed NCM) foi aplicada no banco de produção
- Preencher NCM nos 156 modelos que ainda não têm
- `FiscalConfiguracaoPage`: configurar ambiente de produção SEFAZ
- Remover/condicionar banner amarelo de homologação
- Teste end-to-end: emitir NF-e de teste real, verificar retorno SEFAZ
- Adicionar campo `ncm` como obrigatório no formulário de modelos

---

#### TASK S8-05 — Edge Function dispatch-webhook (1 dia)
- `supabase/functions/dispatch-webhook/index.ts`: recebe `(evento, payload)`, busca `webhook_configs` ativas para o evento, faz POST com HMAC-SHA256 no header `X-Webhook-Signature`
- Tabela `webhook_logs (id, webhook_config_id, evento, status_code, tentativas, created_at)`
- Hooks nos pontos estratégicos: `pedido.criado`, `proposta.aprovada`, `nfe.emitida`, `instalacao.concluida`
- Retry automático com backoff exponencial em caso de falha (3 tentativas)

---

#### TASK S8-06 — QR Code PIX Dinâmico no Portal (4 horas)
- Substituir `PortalPixInfo` (exibe apenas chave) por geração de QR Code PIX dinâmico com EMVCo payload
- Biblioteca `pix-payload` (npm) ou implementação manual do padrão EMVCo do Banco Central
- Preencher automaticamente: chave, valor do orçamento, txid, descrição "Proposta #XXXX"
- Exibir QR Code + código copia-e-cola no portal do cliente

---

#### TASK S8-07 — Countdown de Validade no Portal do Cliente (3 horas)
- Buscar `validade_proposta` da proposta no `PortalOrcamentoPage`
- Componente `PropostaCountdown`: exibir dias/horas restantes, cor vermelho quando < 48h
- Banner no topo do portal: "Esta proposta expira em X dias"
- Aumentar urgência de aprovação sem mudança no modelo de negócio

---

#### Meta de Sucesso do Sprint 8:
- Comissões: primeiros registros reais gerados automaticamente no banco
- Funil: FunnelCard mostra taxas de conversão baseadas em rastreabilidade real
- Approval: zero contas pagas acima do limite sem aprovação do diretor
- NF-e: primeira nota fiscal emitida em ambiente de produção SEFAZ
- Portal: conversão de propostas aumenta com countdown e QR Code PIX
- Webhooks: primeiro evento disparado para URL externa configurada

---

## 6. SCORE DE MATURIDADE DO SISTEMA

| Dimensão | Score | Justificativa |
|---|---|---|
| **Fluxo Operacional Core** (Lead→Faturamento) | **8.5/10** | Fluxo completo e funcional. Comissões e proposta→pedido auto ainda incompletos |
| **Módulo Fiscal** | **6.5/10** | Tecnicamente pronto, ainda em homologação. NF-e não está em produção real |
| **Analytics e BI** | **4.5/10** | Dados existem, insights não. Funil com rastreabilidade quebrada, zero CLV, zero OTIF |
| **Sales Automation (AI+WhatsApp)** | **7.5/10** | AI Orçamento, Sales Agent, e escalação funcionam. Chip de teste é risco operacional |
| **Módulo Contábil** | **8.0/10** | DAS, OFX, balancete, razão, DEFIS operacionais. Bem construído |
| **Segurança e Compliance** | **6.0/10** | RLS sólido, sem 2FA, approval workflow decorativo, sem 2º fator de autenticação |
| **UX / Adoção Interna** | **6.5/10** | Design consistente, mas comissões e funil vazios corroem confiança do time |
| **Escalabilidade Técnica** | **7.0/10** | Stack escala bem. Sem multi-filial real em tabelas operacionais bloqueia expansão |
| **Integração Externa** | **5.5/10** | Webhooks existem mas sem dispatch. Email sem tracking. PIX sem QR dinâmico |
| **Testes e Qualidade** | **7.5/10** | 37+ testes automatizados. Cobertura boa em financeiro e dados. PCP e agente com lacunas |
| **Receita Recorrente (MRR)** | **6.0/10** | Contratos MRR implementados (migration 086). Alertas automáticos dependem de trigger pendente |
| **App de Campo** | **6.5/10** | Bridge ERP↔Campo funcional via views. Tempo real de progresso não chega ao gerente ERP |

**Score Médio Geral: 6.75/10** (vs. ~5.5/10 no relatório de 2026-03-17)

**Progressão por sprint**:
- Sprint 1-4: 4.5/10 → Segurança, fluxo, performance, features avançadas
- Sprint 5: 5.5/10 → Conectar módulos, corrigir bugs críticos
- Sprint 6-7: 6.75/10 → Operação eficiente, escala, MRR, webhooks
- Sprint 8 projetado: **7.8/10** → Fechar o que existe, compliance, confiança interna

---

## CONCLUSÃO ESTRATÉGICA

O Croma Print ERP completou sua fase de "construção" e entrou na fase de "maturação". A diferença entre 6.75 e 8.0 de maturidade não está em construir novos módulos — está em fazer os módulos existentes funcionarem completamente. Os gaps que permanecem abertos (comissões, funil, approval automático, NF-e produção, dispatch de webhooks) são todos gaps de **última milha**: a estrutura existe, a UI existe, o banco existe — falta a conexão final entre eles.

O sprint mais estratégico é o Sprint 8 — "Fechar o Que Existe" — porque tem o maior ROI por hora de desenvolvimento de toda a história do projeto. Cada task é uma funcionalidade que o time já conhece e aguarda, custando 4-16 horas cada, com impacto direto em confiança interna, compliance fiscal, e conversão de vendas.

Após o Sprint 8, o sistema estará pronto para o salto estratégico seguinte: transformar os dados acumulados (307 clientes, anos de pedidos, NPS, comportamento no portal) em vantagem competitiva real através de analytics avançados, modelos preditivos de churn, e automações de upsell/referral que nenhum concorrente do segmento de comunicação visual no Brasil oferece hoje.

---

*Relatório gerado por xQuads Master Orchestrator em 2026-03-21*
*Baseado em análise de: 16 domínios, 89 migrations, 30 Edge Functions, relatórios históricos 2026-03-17 a 2026-03-21*
*Squads ativos: Advisory Board (Dalio/Munger/Naval/Thiel) + Hormozi + Data Squad (Kaushik/Fader) + C-Level (CEO/COO/CMO/CTO)*
