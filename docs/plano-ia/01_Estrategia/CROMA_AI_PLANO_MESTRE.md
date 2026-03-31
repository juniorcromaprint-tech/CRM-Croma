# CROMA AI — PLANO MESTRE DEFINITIVO
## Análise Cruzada: Mega-Prompt ChatGPT × Estado Real do Projeto

**Data:** 25/03/2026  
**Projeto:** CRM-Croma (Supabase ID: `djwjmfgplnqyffdcgdaw`)  
**Repositório:** `C:\Users\Caldera\Claude\CRM-Croma`  
**Autor:** Análise automatizada Claude  

---

## RESUMO EXECUTIVO

O projeto Croma AI ERP está **significativamente avançado**. Das 6 camadas propostas no mega-prompt, 4 estão parcial ou totalmente implementadas. O banco de dados Supabase possui **160+ tabelas** (incluindo views), **30 Edge Functions** ativas, e **98 migrations** aplicadas. O frontend React/TypeScript conta com **17 domínios** organizados (admin, agent, ai, clientes, comercial, compras, contabilidade, dados, estoque, financeiro, fiscal, instalacao, pedidos, portal, producao, qualidade + APP-Campo separado).

### Números-Chave
- **Tabelas no Supabase:** ~140 tabelas + ~18 views
- **Edge Functions deployadas:** 30 funções ativas
- **Migrations aplicadas:** 98
- **Domínios frontend:** 17 módulos organizados
- **App Campo (PWA):** Aplicação separada funcional com mapa, jobs, fotos, checklists
- **Agente IA:** Módulo completo com conversações, qualificação de leads, composição de mensagens

### Legenda de Status
- ✅ JÁ IMPLEMENTADO — Existe no código/Supabase e está funcional
- 🔧 PARCIALMENTE IMPLEMENTADO — Começou mas falta completar
- ❌ NÃO IMPLEMENTADO — Ainda não existe
- 💡 IDEIA NOVA — Não estava no plano original ou agrega valor extra

---

## CAMADA 1 — ORQUESTRAÇÃO (Claude como Operador Central)

### 1.1 Ler Estado do ERP / Entender Contexto
**Status: 🔧 PARCIALMENTE IMPLEMENTADO**

**O que já existe:**
- Edge Function `ai-decidir-acao` — recebe contexto e decide próximo passo
- Edge Function `ai-detectar-problemas` — analisa estado e identifica gargalos
- Edge Function `ai-insights-diarios` — gera insights do dia
- Tabelas `ai_logs`, `ai_alertas`, `alertas_ativos`, `alert_history`, `alert_rules`
- Frontend: `AIDashboardPage.tsx`, `AISidebar.tsx`, `AIKPIBar.tsx`, `AIAlertsBadge.tsx`
- Hooks: `useAISidebar.ts`, `useAlertasAI.ts`, `useAIModels.ts`

**O que falta:**
- Leitura contínua e proativa do estado do ERP (loop cron robusto)
- Compreensão contextual profunda entre módulos (ex: cruzar financeiro + produção)
- Mecanismo de "memória de sessão" para manter contexto entre interações

**Prioridade:** Alta  
**Esforço estimado:** 2-3 sprints

### 1.2 Decidir Próximos Passos
**Status: 🔧 PARCIALMENTE IMPLEMENTADO**

**O que já existe:**
- Edge Function `ai-decidir-acao` — orquestrador de decisões
- Tabela `agent_templates` com templates de decisão seedados
- Migration `078_agent_templates_seed.sql` e `079_agent_templates_negociacao.sql`

**O que falta:**
- Árvore de decisão completa cobrindo TODOS os fluxos (produção→instalação→financeiro)
- Priorização automática de ações com base em urgência/impacto
- Escalonamento inteligente para aprovação humana

**Prioridade:** Alta  
**Esforço estimado:** 2 sprints

### 1.3 Executar Ações
**Status: 🔧 PARCIALMENTE IMPLEMENTADO**

**O que já existe:**
- Sistema de "appliers" em `domains/ai/appliers/` com subpastas: cliente, composicao, orcamento, problemas, producao
- Registry de appliers (`registerAll.ts`, `registry.ts`)
- Componentes de preview e aplicação: `AIActionCard.tsx`, `AIActionPreview.tsx`, `AIApplyBar.tsx`

**O que falta:**
- Appliers para: pedidos, instalação, financeiro, fiscal, compras
- Execução em cadeia (ex: aprovar proposta → gerar pedido → gerar OP → reservar estoque)
- Rollback de ações com falha

**Prioridade:** Alta  
**Esforço estimado:** 3-4 sprints

### 1.4 Monitorar / Alertas / Escalar Exceções
**Status: ✅ JÁ IMPLEMENTADO (base sólida)**

**O que já existe:**
- Tabelas: `alert_rules`, `alert_history`, `alertas_ativos`, `ai_alertas`
- Tabela `notificacoes` + `notifications` (sistema duplo)
- Frontend: `AIAlertsBadge.tsx`, componente `NotificationBadge.tsx`
- Hook: `useNotifications.ts`
- Edge Function `ai-detectar-problemas`
- Migration `098_business_intelligence.sql` com `business_intelligence_config`

**O que falta:**
- Configuração granular de regras de alerta por módulo
- Escalação automática (ex: se produção atrasa 2 dias → alerta gestor → se 5 dias → alerta diretor)
- Dashboard consolidado de alertas com ações rápidas

**Prioridade:** Média  
**Esforço estimado:** 1-2 sprints

---

## CAMADA 2 — CONTEXTO PERSISTENTE

### 2.1 Regras de Negócio
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- `config_precificacao` — regras de precificação
- `regras_precificacao` — regras dinâmicas
- `faixas_quantidade` — faixas de desconto por quantidade
- `config_tributaria` — configuração tributária
- `fiscal_regras_operacao` — regras fiscais por operação
- `routing_rules` — regras de roteamento PCP
- Frontend: `pricing-engine.ts`, `pricing-explainer.ts`, `orcamento-pricing.service.ts`
- Migration `035_pricing_evolution.sql`, `036_pricing_realista.sql`

**O que falta:**
- Documentação formal das regras em formato acessível pela IA
- Regras de negócio para pós-venda e garantias

**Prioridade:** Média  
**Esforço estimado:** 1 sprint

### 2.2 Papéis e Permissões
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- Tabelas: `roles`, `permissions`, `permissoes_perfil`, `profiles`
- RLS habilitado em tabelas críticas (migration `023_habilitar_rls_tabelas_criticas`)
- Helpers RLS (migration `050_rls_helpers.sql`)
- RLS por módulo: `051_rls_catalogo`, `058_rls_estoque`, `063_rls_producao`, `075_rls_fiscal_tables`
- Migration `027_rls_blindagem.sql` — blindagem geral
- Frontend: `PermissionGuard.tsx`, `permissions.ts`
- Fix de role: migration `071_fix_get_user_role.sql`

**O que falta:** Nada crítico. Sistema maduro.  
**Prioridade:** Baixa  
**Esforço estimado:** Manutenção

### 2.3 Estados dos Fluxos
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- `shared/constants/status.ts` — constantes de status para todos os módulos
- `pedido_historico` — trilha de estados do pedido
- Triggers de mudança de estado (migrations 039, 040, 062)
- Views: `v_pcp_ops_ativas`, `v_pcp_apontamentos_hoje`, `v_pcp_capacidade_setor`

**O que falta:** 
- Máquina de estados formal (state machine) que impeça transições inválidas
- Documentação visual dos fluxos

**Prioridade:** Média  
**Esforço estimado:** 1 sprint

### 2.4 Catálogo de Produtos
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- Tabelas: `produtos`, `produto_modelos`, `categorias_produto`, `modelo_materiais`, `modelo_processos`
- `acabamentos`, `materiais`, `servicos`, `ferramentas`, `maquinas`
- Views: `vw_modelos_completos`, `v_produto_custo_completo`
- Migrations: `041_catalogo_categorias`, `049_catalogo_views`, `052_seed_produtos_categorias`
- BOM (Bill of Materials): migrations `042_bom_columns`, `043_regras_10_componentes`, `048_bom_constraints_patch`
- Edge Function `ai-composicao-produto` — composição automática

**O que falta:** Nada crítico.  
**Prioridade:** Baixa

### 2.5 Lógica Operacional / Prioridades por Cliente
**Status: 🔧 PARCIALMENTE IMPLEMENTADO**

**O que já existe:**
- `client_intelligence` — inteligência por cliente
- `clientes` com scoring
- Edge Function `ai-resumo-cliente` — resumo inteligente do cliente
- `metas_vendas` — metas por vendedor
- `sales_benchmarks` — benchmarks de venda

**O que falta:**
- Classificação automática de prioridade por cliente (A/B/C) baseada em recência, valor, frequência
- SLA diferenciado por categoria de cliente

**Prioridade:** Média  
**Esforço estimado:** 1 sprint

### 2.6 Memória Operacional
**Status: 🔧 PARCIALMENTE IMPLEMENTADO**

**O que já existe:**
- `agent_conversations`, `agent_messages` — histórico de conversas do agente
- `ai_logs` — logs de todas as operações IA
- `registros_auditoria` — auditoria geral
- `campo_audit_logs` — auditoria de campo

**O que falta:**
- Memory layer persistente com aprendizado (ex: "Cliente X sempre pede desconto de 10%")
- Padrões recorrentes de problemas e soluções
- Performance histórica de produção por tipo de produto

**Prioridade:** Média  
**Esforço estimado:** 2 sprints

---

## CAMADA 3 — AÇÕES (TOOLS)

### 3.1 Criar Lead
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- Tabela `leads` com schema completo (migration `027_fix_leads_schema`)
- `origens_lead` — origens de lead
- Edge Functions: `buscar-leads-google` (prospecção automática), `enriquecer-cnpj` (enriquecimento)
- Edge Function `ai-qualificar-lead` — qualificação automática
- Frontend: `domains/comercial/` completo, `domains/agent/components/LeadAgentPanel.tsx`
- Webhook WhatsApp para captura: `whatsapp-webhook`

**O que falta:** Nada. Módulo maduro.

### 3.2 Atualizar Cliente
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- Tabelas: `clientes`, `cliente_contatos`, `cliente_documentos`, `cliente_unidades`
- Edge Function `ai-resumo-cliente`
- Frontend: `domains/clientes/` completo
- Import/export de clientes via `domains/dados/configs/clientes.config.ts`

### 3.3 Criar Oportunidade
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- Tabela `oportunidades`
- `atividades_comerciais`, `tarefas_comerciais`
- Migration `092_funil_fks` — FKs do funil comercial
- Frontend: `domains/comercial/` com hooks e serviços

### 3.4 Gerar Orçamento
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- Tabelas: `propostas`, `proposta_itens`, `proposta_versoes`, `proposta_item_materiais`, `proposta_item_processos`, `proposta_item_acabamentos`, `proposta_servicos`, `proposta_attachments`, `proposta_views`
- `templates_orcamento`, `orcamento_item_maquinas`
- Edge Functions: `ai-analisar-orcamento`, `ai-gerar-orcamento`, `ai-preco-dinamico`
- Pricing engine completo: `pricing-engine.ts`, `pricing-explainer.ts`
- Migration `078b_ai_orcamento.sql` — tabelas de orçamento IA
- Frontend: versionamento, análise, breakdown de preços (`PricingBreakdown.tsx`)

### 3.5 Converter em Pedido
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- Tabelas: `pedidos`, `pedido_itens`, `pedido_historico`
- Portal de aprovação: `domains/portal/`
- Migration `024_portal_aprovacao_gera_pedido` — conversão automática
- Migration `073_fix_portal_pedido_custeio` — custeio no pedido
- Migration `076_pedido_op_sequences` — sequências automáticas
- Frontend: `domains/pedidos/` completo

### 3.6 Gerar OS / Ordem de Produção
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- Tabelas: `ordens_producao`, `producao_etapas`, `producao_materiais`, `producao_apontamentos`, `producao_checklist`, `producao_retrabalho`
- `setores_producao`, `etapa_templates`, `routing_rules`
- `usinagem_tempos`, `processos_producao`
- Views PCP: `v_pcp_ops_ativas`, `v_pcp_apontamentos_hoje`, `v_pcp_capacidade_setor`
- Edge Functions: `ai-briefing-producao`, `ai-sequenciar-producao`
- Migrations: 059-063 (PCP completo)
- Frontend: `domains/producao/` com componentes, hooks, schemas, utils

### 3.7 Consultar Estoque
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- Tabelas: `estoque_saldos`, `estoque_movimentacoes`, `estoque_reservas`, `estoque_reservas_op`, `estoque_inventario`, `inventarios`, `inventario_itens`, `checkout_almoxarife`
- Views: `v_estoque_saldos`, `v_estoque_semaforo`, `vw_estoque_disponivel`, `v_material_sem_preco`
- Edge Functions: `ai-previsao-estoque`, `ai-sugerir-compra`
- Migrations: 053-058 (estoque completo), 084, 090, 093
- Frontend: `domains/estoque/` completo com semáforo (`SemaforoBadge.tsx`)

### 3.8 Solicitar Compra
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- Tabelas: `solicitacoes_compra`, `pedidos_compra`, `pedido_compra_itens`, `cotacoes_compra`
- `fornecedores`, `historico_precos_fornecedor`, `recebimentos`, `recebimento_itens`
- Frontend: `domains/compras/` completo

### 3.9 Agendar Instalação
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- Tabelas: `agenda_instalacao`, `ordens_instalacao`, `tarefas_campo`
- `equipes`, `equipe_membros`, `veiculos`
- `checklists_campo`, `midias_campo`, `assinaturas_campo`, `diario_bordo`
- Views: `vw_campo_instalacoes`, `vw_campo_fotos`
- Frontend: `domains/instalacao/` completo
- APP-Campo PWA: aplicação separada com mapa (Leaflet), fotos, checklists, equipe

### 3.10 Registrar Fotos/Ocorrências
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- Tabelas: `job_photos`, `job_videos`, `midias_campo`, `ocorrencias`, `ocorrencia_tratativas`
- `anexos` — sistema genérico de anexos
- Storage Supabase configurado (migration `005_storage_security`, `033_proposta_uploads_bucket`, `088_producao_storage`)
- APP-Campo com captura de fotos nativa
- Edge Function `ai-analisar-foto-instalacao`

### 3.11 Emitir NF-e
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- Tabelas: `fiscal_documentos`, `fiscal_documentos_itens`, `fiscal_xmls`, `fiscal_series`, `fiscal_certificados`, `fiscal_ambientes`, `fiscal_eventos`, `fiscal_erros_transmissao`, `fiscal_filas_emissao`, `fiscal_regras_operacao`, `fiscal_audit_logs`
- Edge Functions (6): `fiscal-emitir-nfe`, `fiscal-consultar-nfe`, `fiscal-cancelar-nfe`, `fiscal-gerar-danfe`, `fiscal-sync-status`, `fiscal-testar-certificado`, `fiscal-inutilizar-nfe`, `fiscal-deploy-certificado`
- Multi-empresa: migration `065_multi_empresa_fiscal`
- Frontend: `domains/fiscal/` completo com orquestrador, provider, validação, auditoria

### 3.12 Gerar Boletos / CNAB
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- Tabelas: `bank_accounts`, `bank_slips`, `bank_remittances`, `bank_remittance_items`, `bank_returns`, `bank_return_items`, `retornos_bancarios`
- Migration `021_boletos_banking`, `028_retornos_bancarios`
- Config Pix: migration `082_pix_config`
- Frontend: `domains/financeiro/` completo

### 3.13 Enviar Email / WhatsApp
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- Edge Functions: `whatsapp-enviar`, `whatsapp-webhook`, `agent-enviar-email`, `enviar-email-campanha`, `enviar-email-proposta`, `ai-compor-mensagem`
- Tabelas: `campanhas`, `campanha_destinatarios`
- Templates WhatsApp Pro: migration `080_whatsapp_templates_pro`
- Frontend: `WhatsAppStatusCard.tsx`, `ConversationDetail.tsx`

### 3.14 Gerar Relatórios
**Status: 🔧 PARCIALMENTE IMPLEMENTADO**

**O que já existe:**
- Views financeiras: `v_aging_receber`, `v_balancete`, `v_fluxo_caixa_projetado`, `v_inadimplentes`
- Export CSV/Excel/PDF: `exportCsv.ts`, `exportExcel.ts`, `exportPdf.ts`
- Business Intelligence: migration `098_business_intelligence.sql`, tabelas `business_intelligence_config`, `sales_benchmarks`
- Edge Function `ai-insights-diarios`
- APP-Campo: `Analytics.tsx`, `BillingReport.tsx`

**O que falta:**
- Relatórios parametrizáveis sob demanda
- Dashboard executivo consolidado com todos os KPIs
- Relatórios de performance de produção vs. estimado

**Prioridade:** Média  
**Esforço estimado:** 2 sprints

---

## CAMADA 4 — WORKFLOW ENGINE

### 4.1 Fluxo: LEAD → CLIENTE → OPORTUNIDADE → PROPOSTA
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- Funil completo com FKs (migration `092_funil_fks`)
- Qualificação automática de lead (`ai-qualificar-lead`)
- Prospecção Google (`buscar-leads-google`)
- Enriquecimento CNPJ (`enriquecer-cnpj`)
- Versionamento de propostas (`proposta_versoes`)
- Portal de aprovação do cliente (`domains/portal/`)

### 4.2 Fluxo: PROPOSTA → APROVAÇÃO → PEDIDO
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- Portal de aprovação com tracking (migration `020_portal_tracking_pagamento`)
- Conversão automática proposta→pedido (migration `024_portal_aprovacao_gera_pedido`)
- Custeio no pedido (migration `073_fix_portal_pedido_custeio`)
- Auto-aprovação pelo agente: migration `097_agent_auto_aprovacao`
- Frontend: `OrcamentoApprovalCard.tsx`

### 4.3 Fluxo: PEDIDO → PRODUÇÃO
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- Geração de OP com sequências (migration `076_pedido_op_sequences`)
- Trigger pedido→conta a receber (migration `040_trigger_pedido_conta_receber`)
- Reserva de estoque automática (migrations `054_estoque_reservas`, `084_estoque_reserva`)
- PCP completo com routing, setores, templates (migrations 059-063)

### 4.4 Fluxo: PRODUÇÃO → ENTREGA/INSTALAÇÃO
**Status: 🔧 PARCIALMENTE IMPLEMENTADO**

**O que já existe:**
- Ordens de instalação, agenda, checklists de campo
- APP-Campo completo com PWA
- Apontamentos de produção e etapas

**O que falta:**
- Trigger automático: quando produção finaliza → agendar instalação
- Notificação automática para equipe de campo
- Passagem de bastão formal entre produção e instalação

**Prioridade:** Alta  
**Esforço estimado:** 1 sprint

### 4.5 Fluxo: FINANCEIRO → PÓS-VENDA
**Status: 🔧 PARCIALMENTE IMPLEMENTADO**

**O que já existe:**
- Contas a receber/pagar: `contas_receber`, `contas_pagar`, `parcelas_receber`, `parcelas_pagar`
- Boletos e banking completo
- Conciliação bancária IA: `ai-conciliar-bancario`, `ai-classificar-extrato`
- Extrato bancário: `extrato_bancario_importacoes`, `extrato_bancario_itens`, `extrato_regras_classificacao`
- NPS: `nps_respostas`, Edge Function `ai-enviar-nps`, `ai-analisar-nps`
- Comissões: `comissoes`, migration `091_comissoes_trigger`
- Contabilidade: migration `070_modulo_contabil`, `lancamentos_contabeis`, `plano_contas`, `centros_custo`

**O que falta:**
- Fluxo automatizado de pós-venda (pesquisa NPS → tratativa → fidelização)
- Gestão de garantias/contratos de manutenção
- Cobrança automática de inadimplentes

**Prioridade:** Média  
**Esforço estimado:** 2 sprints

### 4.6 Validações e Auditoria
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- `registros_auditoria` — auditoria geral
- `fiscal_audit_logs` — auditoria fiscal
- `campo_audit_logs` — auditoria de campo
- `pedido_historico` — histórico completo
- Soft delete em tabelas críticas (migration `037_soft_delete_critical_tables`)
- Optimistic lock (migration `030_optimistic_lock`)
- Constraints e defaults (migration `025_constraints_defaults_funcoes_atomicas`)

---

## CAMADA 5 — GUARDRAILS (SEGURANÇA)

### 5.1 Nenhuma Ação Crítica sem Validação
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- RLS blindagem (migration `027_rls_blindagem`)
- RLS por módulo: catálogo, estoque, produção, fiscal
- Helpers RLS centralizados (migration `050_rls_helpers`)
- `PermissionGuard.tsx` no frontend
- Constraints no banco (migration `025_constraints_defaults`)
- Sprint 9 blindagem crítica (migration `095_sprint9_blindagem_critica`)

### 5.2 Logs Completos e Trilha de Auditoria
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- 4 tabelas de auditoria: `registros_auditoria`, `fiscal_audit_logs`, `campo_audit_logs`, `ai_logs`
- `pedido_historico` para rastreamento
- Triggers de auditoria em operações críticas

### 5.3 Rollback
**Status: 🔧 PARCIALMENTE IMPLEMENTADO**

**O que já existe:**
- Soft delete implementado (não perde dados)
- Versionamento de propostas (pode voltar à versão anterior)
- Optimistic lock previne conflitos

**O que falta:**
- Mecanismo formal de rollback para operações em cadeia
- "Desfazer" para ações do agente IA

**Prioridade:** Média  
**Esforço estimado:** 2 sprints

### 5.4 Restrições Financeiras/Fiscais
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- Série fiscal com lock (migration `011_fix_serie_lock`)
- Inutilização de NF-e (`fiscal-inutilizar-nfe`)
- Config tributária completa
- Aprovação de contas: migration `087_aprovacao_contas`

### 5.5 Limites de Preço / Aprovação Humana
**Status: 🔧 PARCIALMENTE IMPLEMENTADO**

**O que já existe:**
- Regras de precificação com faixas
- Portal de aprovação para propostas
- Auto-aprovação do agente com limites (migration `097_agent_auto_aprovacao`)

**O que falta:**
- Limites configuráveis de desconto máximo por perfil
- Aprovação em cascata (vendedor → gerente → diretor) baseada em valor

**Prioridade:** Alta  
**Esforço estimado:** 1 sprint

---

## CAMADA 6 — MEMORY LAYER

### 6.1 Histórico de Clientes e Preferências
**Status: 🔧 PARCIALMENTE IMPLEMENTADO**

**O que já existe:**
- `client_intelligence` — dados de inteligência por cliente
- `ai-resumo-cliente` — resumo gerado por IA
- Histórico de propostas, pedidos, ocorrências associados ao cliente

**O que falta:**
- Perfil comportamental do cliente (preferências de comunicação, horários, canais)
- Histórico de negociações e concessões
- Score de relacionamento atualizado automaticamente

**Prioridade:** Média  
**Esforço estimado:** 1 sprint

### 6.2 Erros Recorrentes / Padrões de Operação
**Status: ❌ NÃO IMPLEMENTADO**

**O que já existe:** `ai_logs` registra erros, mas não há análise de padrões.

**O que falta:**
- Sistema de detecção de padrões em erros (ex: "material X sempre atrasa do fornecedor Y")
- Sugestões proativas baseadas em erros passados
- Base de conhecimento de soluções

**Prioridade:** Média  
**Esforço estimado:** 2 sprints

### 6.3 Comportamento de Pagamento
**Status: 🔧 PARCIALMENTE IMPLEMENTADO**

**O que já existe:**
- Views: `v_aging_receber`, `v_inadimplentes`
- Parcelas e boletos com tracking de pagamento

**O que falta:**
- Score de crédito interno automatizado
- Predição de inadimplência
- Ajuste automático de condições de pagamento baseado em histórico

**Prioridade:** Média  
**Esforço estimado:** 1 sprint

### 6.4 Performance de Produção
**Status: 🔧 PARCIALMENTE IMPLEMENTADO**

**O que já existe:**
- `producao_apontamentos` — tempos reais
- `usinagem_tempos` — tempos padrão
- Views PCP com capacidade

**O que falta:**
- Comparação estimado vs. realizado por produto/setor
- Curva de aprendizado por tipo de produto
- Previsão de prazo baseada em dados históricos

**Prioridade:** Média  
**Esforço estimado:** 2 sprints

---

## 7 SUBAGENTES OBRIGATÓRIOS

### 7.1 Agente Comercial
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- Migration `077_sales_agent.sql` — agente de vendas completo
- Edge Functions: `ai-qualificar-lead`, `buscar-leads-google`, `enriquecer-cnpj`, `ai-compor-mensagem`, `whatsapp-enviar`, `whatsapp-webhook`
- Frontend: `domains/agent/` completo com dashboard, configuração, conversas, aprovação
- Templates de negociação seedados (migration `079_agent_templates_negociacao`)
- Lead discovery: `LeadDiscoveryDialog.tsx`, `leadDiscoveryService.ts`

### 7.2 Agente Orçamentista
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- Edge Functions: `ai-analisar-orcamento`, `ai-gerar-orcamento`, `ai-preco-dinamico`, `ai-composicao-produto`
- Pricing engine completo no backend e frontend
- Appliers: `domains/ai/appliers/orcamento/`, `domains/ai/appliers/composicao/`
- Migration `078b_ai_orcamento` — tabelas de orçamento IA

### 7.3 Agente PCP
**Status: 🔧 PARCIALMENTE IMPLEMENTADO**

**O que já existe:**
- Edge Functions: `ai-briefing-producao`, `ai-sequenciar-producao`
- Views PCP completas
- Routing rules e setores

**O que falta:**
- Sequenciamento automático de OPs baseado em prioridade/prazo/capacidade
- Replanning automático quando há imprevistos
- Integração com estoque para verificação de materiais antes de programar

**Prioridade:** Alta  
**Esforço estimado:** 2 sprints

### 7.4 Agente Produção
**Status: 🔧 PARCIALMENTE IMPLEMENTADO**

**O que já existe:**
- Apontamentos, checklists, retrabalho
- Appliers de produção no módulo IA

**O que falta:**
- Monitoramento em tempo real do chão de fábrica
- Alertas de desvio de tempo/qualidade
- Sugestões de otimização em tempo real

**Prioridade:** Média  
**Esforço estimado:** 2 sprints

### 7.5 Agente Campo
**Status: ✅ JÁ IMPLEMENTADO**

**O que já existe:**
- APP-Campo PWA completa e separada
- Agenda de instalação, checklists, fotos, vídeos, assinaturas
- Diário de bordo, mídias, geolocalização (`resolve-geo`)
- Edge Function `ai-analisar-foto-instalacao`

### 7.6 Agente Financeiro
**Status: 🔧 PARCIALMENTE IMPLEMENTADO**

**O que já existe:**
- Edge Functions: `ai-conciliar-bancario`, `ai-classificar-extrato`
- Módulo financeiro completo (contas, parcelas, boletos, banking)
- Contabilidade (plano de contas, lançamentos, centros de custo, DAS)
- Views: aging, inadimplência, fluxo de caixa projetado, balancete

**O que falta:**
- Conciliação automática sem intervenção humana
- Previsão de fluxo de caixa com IA
- Alertas proativos de risco financeiro

**Prioridade:** Alta  
**Esforço estimado:** 2 sprints

### 7.7 Agente Executivo
**Status: 🔧 PARCIALMENTE IMPLEMENTADO**

**O que já existe:**
- Migration `098_business_intelligence.sql` — tabelas de BI
- Edge Function `ai-insights-diarios`
- `business_intelligence_config`
- `sales_benchmarks`

**O que falta:**
- Dashboard executivo consolidado
- Relatórios sob demanda em linguagem natural
- Comparativos período a período
- Projeções e tendências

**Prioridade:** Alta  
**Esforço estimado:** 3 sprints

---

## ERP CORE — MODELAGEM DE DADOS

| Entidade do Prompt | Tabela(s) no Supabase | Status |
|---|---|---|
| leads | `leads`, `origens_lead` | ✅ |
| clientes | `clientes`, `cliente_contatos`, `cliente_documentos`, `cliente_unidades` | ✅ |
| contatos | `cliente_contatos` | ✅ |
| oportunidades | `oportunidades`, `atividades_comerciais`, `tarefas_comerciais` | ✅ |
| propostas (versionamento) | `propostas`, `proposta_versoes`, `proposta_itens`, `proposta_item_*`, `proposta_servicos`, `proposta_attachments`, `proposta_views` | ✅ |
| pedidos | `pedidos`, `pedido_itens`, `pedido_historico` | ✅ |
| produção / etapas / OS | `ordens_producao`, `producao_etapas`, `producao_materiais`, `producao_apontamentos`, `producao_checklist`, `producao_retrabalho` | ✅ |
| instalação | `ordens_instalacao`, `agenda_instalacao`, `tarefas_campo`, `checklists_campo`, `midias_campo`, `assinaturas_campo`, `diario_bordo` | ✅ |
| financeiro / títulos / boletos | `contas_receber`, `contas_pagar`, `parcelas_receber`, `parcelas_pagar`, `bank_slips`, `bank_accounts`, `bank_remittances`, `bank_returns` | ✅ |
| NF-e | `fiscal_documentos`, `fiscal_documentos_itens`, `fiscal_xmls`, `fiscal_series`, `fiscal_certificados`, `fiscal_ambientes`, etc. | ✅ |
| estoque | `estoque_saldos`, `estoque_movimentacoes`, `estoque_reservas`, `estoque_reservas_op`, `estoque_inventario` | ✅ |
| compras / fornecedores | `pedidos_compra`, `pedido_compra_itens`, `cotacoes_compra`, `fornecedores`, `solicitacoes_compra`, `recebimentos` | ✅ |
| auditoria | `registros_auditoria`, `fiscal_audit_logs`, `campo_audit_logs`, `ai_logs` | ✅ |
| relatórios | Views: `v_aging_receber`, `v_balancete`, `v_fluxo_caixa_projetado`, `v_inadimplentes`, views PCP, views estoque | ✅ |

**Conclusão:** A modelagem de dados está **100% coberta**. Todas as entidades do mega-prompt possuem tabelas correspondentes no Supabase.

---

## INTEGRAÇÕES

| Integração | Status | Edge Functions | Observação |
|---|---|---|---|
| WhatsApp | ✅ | `whatsapp-enviar`, `whatsapp-webhook` | Envio e recebimento funcionais |
| Email | ✅ | `agent-enviar-email`, `enviar-email-campanha`, `enviar-email-proposta` | 3 funções diferentes por contexto |
| NF-e (SEFAZ) | ✅ | 8 funções fiscais | Emissão, consulta, cancelamento, inutilização, DANFE, certificado |
| Boletos CNAB Itaú | ✅ | Banking tables completas | Remessa e retorno |
| Google Maps | ✅ | `resolve-geo` | Geolocalização de endereços |
| OneDrive | ✅ | `onedrive-criar-pasta`, `onedrive-upload-proposta` | Upload de propostas |
| Google Search (Leads) | ✅ | `buscar-leads-google` | Prospecção automática |
| CNPJ (ReceitaWS) | ✅ | `enriquecer-cnpj` | Enriquecimento cadastral |
| Assinatura Digital | ❌ | — | Não implementado |
| Armazenamento (Storage) | ✅ | Supabase Storage | Buckets configurados |

---

## EVENTOS DO SISTEMA

| Evento do Prompt | Implementado? | Como |
|---|---|---|
| lead_created | ✅ | Trigger + webhook WhatsApp |
| proposal_sent | ✅ | Portal de aprovação + tracking |
| proposal_approved | ✅ | Portal → gera pedido automático |
| order_created | ✅ | Trigger → conta a receber |
| production_started | 🔧 | OP criada, mas sem evento formal de "início" |
| production_completed | 🔧 | Apontamentos existem, falta trigger de conclusão |
| installation_scheduled | ✅ | Agenda de instalação |
| installation_completed | 🔧 | Checklists e assinatura existem, falta trigger formal |
| invoice_issued | ✅ | Emissão NF-e + audit log |
| payment_received | 🔧 | Baixa manual, falta automação via retorno bancário |
| payment_overdue | 🔧 | View v_inadimplentes existe, falta alerta automático |

---

## CLAUDE OPERATOR CONSOLE

**Status: 🔧 PARCIALMENTE IMPLEMENTADO**

**O que já existe:**
- `domains/ai/pages/AIDashboardPage.tsx` — painel IA
- `AISidebar.tsx` — sidebar com sugestões
- `AIActionCard.tsx`, `AIActionPreview.tsx`, `AIApplyBar.tsx` — cards de ação
- `AIStatusBadge.tsx`, `AIKPIBar.tsx` — indicadores
- `domains/agent/pages/AgentDashboardPage.tsx` — dashboard do agente
- `AgentConfigPage.tsx`, `AgentConversationPage.tsx`, `AgentApprovalPage.tsx`

**O que falta:**
- Visão unificada "cockpit" com TODOS os módulos
- Chat natural com o ERP ("Me mostra os pedidos atrasados")
- Execução de tarefas diretamente do console
- Prioridades automáticas do dia

**Prioridade:** Alta  
**Esforço estimado:** 3-4 sprints

---

## PLANO DE IMPLEMENTAÇÃO — FASES vs. ESTADO ATUAL

### Fase 1: Comercial + Orçamento
**Status: ✅ CONCLUÍDA**

Tudo implementado: leads, clientes, oportunidades, propostas, versionamento, pricing engine, portal de aprovação, prospecção Google, qualificação IA, WhatsApp.

### Fase 2: Pedido + OS + Produção
**Status: ✅ CONCLUÍDA**

Tudo implementado: pedidos, OP, etapas de produção, PCP, apontamentos, routing, checklists, estoque, reservas.

### Fase 3: Instalação/Campo
**Status: ✅ CONCLUÍDA**

APP-Campo PWA funcional: agenda, mapa, fotos, checklists, assinatura, diário de bordo, geolocalização.

### Fase 4: Financeiro
**Status: 🔧 90% CONCLUÍDA**

Contas a receber/pagar, parcelas, boletos, banking, contabilidade, DAS, comissões — tudo implementado. Faltam: automação de cobrança, conciliação totalmente automática, previsão IA de fluxo de caixa.

### Fase 5: Inteligência Executiva
**Status: 🔧 40% CONCLUÍDA**

BI tables criadas (migration 098), insights diários, sales benchmarks. Faltam: dashboard executivo, relatórios em linguagem natural, projeções, comparativos.

---

## PLANO DE AÇÃO PRIORIZADO — O QUE FAZER AGORA

### SPRINT IMEDIATO (Próximas 2 semanas)

1. **Triggers de Eventos Formais** — Criar triggers para: production_completed, installation_completed, payment_received, payment_overdue
   - Esforço: 3-5 dias
   - Impacto: Habilita toda a automação em cadeia

2. **Transição Produção→Instalação** — Automatizar passagem de bastão quando OP finaliza
   - Esforço: 2-3 dias
   - Impacto: Elimina gargalo manual entre módulos

3. **Limites de Desconto/Aprovação em Cascata** — Configurar aprovação baseada em valor
   - Esforço: 2-3 dias
   - Impacto: Segurança financeira

### SPRINT 2 (Semanas 3-4)

4. **Dashboard Executivo Consolidado** — Cockpit com KPIs de todos os módulos
   - Esforço: 5-7 dias
   - Impacto: Visão gerencial completa

5. **Cobrança Automática de Inadimplentes** — Alert + email/WhatsApp automático
   - Esforço: 3-5 dias
   - Impacto: Recuperação de receita

6. **Memory Layer — Padrões e Aprendizado** — Sistema de detecção de padrões
   - Esforço: 5-7 dias
   - Impacto: IA cada vez mais inteligente

### SPRINT 3 (Semanas 5-6)

7. **Agente PCP Completo** — Sequenciamento automático com replanning
   - Esforço: 7-10 dias
   - Impacto: Otimização de produção

8. **Agente Financeiro Autônomo** — Conciliação, previsão, alertas de risco
   - Esforço: 5-7 dias
   - Impacto: Saúde financeira proativa

### SPRINT 4 (Semanas 7-8)

9. **Claude Operator Console — Chat Natural** — Interface conversacional com o ERP
   - Esforço: 7-10 dias
   - Impacto: Experiência transformadora

10. **Relatórios em Linguagem Natural** — "Me mostra faturamento do mês"
    - Esforço: 5-7 dias
    - Impacto: Acessibilidade da informação

### SPRINT 5+ (Após semana 8)

11. **Assinatura Digital** — Integração DocuSign ou similar
12. **Score de Crédito Interno** — Predição de inadimplência
13. **Curva de Aprendizado Produção** — Previsão de prazos por histórico
14. **Máquina de Estados Formal** — State machine impedindo transições inválidas

---

## RISCOS E MITIGAÇÃO

| Risco | Probabilidade | Mitigação Atual | Ação Necessária |
|---|---|---|---|
| Perda de dados em operações em cadeia | Baixa | Soft delete, auditoria | Implementar rollback formal |
| IA tomar decisão errada | Média | Appliers com preview, aprovação humana | Expandir guardrails para todos os módulos |
| Sobrecarga de Edge Functions | Média | 30 funções ativas | Monitorar uso, implementar rate limiting |
| Falha de integração SEFAZ | Baixa | Fila de emissão, retry | Já mitigado |
| Segurança de dados | Baixa | RLS em todas as tabelas, blindagem | Já mitigado |

---

## 12 ENTREGÁVEIS — STATUS

| # | Entregável | Status |
|---|---|---|
| 1 | Arquitetura geral | ✅ Implementada (17 domínios, 160+ tabelas, 30 Edge Functions) |
| 2 | Diagrama textual | ❌ Falta documentar formalmente |
| 3 | Organograma dos agentes | 🔧 Agentes existem em código, falta doc formal |
| 4 | Fluxos ponta a ponta | 🔧 Implementados, faltam triggers de transição em 3 pontos |
| 5 | Modelagem de dados | ✅ 100% coberta |
| 6 | Definição de eventos | 🔧 7/11 eventos implementados |
| 7 | Guardrails | ✅ RLS, auditoria, soft delete, permissions |
| 8 | Plano de implementação | ✅ Fases 1-3 concluídas, 4 em 90%, 5 em 40% |
| 9 | Backlog técnico priorizado | ✅ Este documento |
| 10 | Estrutura de logs e auditoria | ✅ 4 tabelas de auditoria + ai_logs |
| 11 | Claude Operator Console | 🔧 Parcial (AI Dashboard + Sidebar + Agent pages) |
| 12 | Decisões técnicas obrigatórias | ✅ Stack definida (React/TS, Supabase, Edge Functions, OpenRouter) |

---

## DECISÕES TÉCNICAS CONSOLIDADAS

- **Frontend:** React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **IA Provider:** OpenRouter (configurável por modelo)
- **App Campo:** PWA separada (React + Leaflet + câmera nativa)
- **Fiscal:** Edge Functions dedicadas (8 funções) com certificado A1
- **Banking:** Modelo CNAB 400 com remessa/retorno
- **Deploy:** Vercel (frontend) + Supabase Cloud (backend)
- **CI:** GitHub Actions (`.github/workflows/ci.yml`)
- **Testes:** Vitest com suíte de testes por domínio

---

*Documento gerado em 25/03/2026. Este é o plano mestre definitivo que consolida o estado real do projeto com a visão arquitetural do mega-prompt.*
