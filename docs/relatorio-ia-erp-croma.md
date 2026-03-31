# Relatório Técnico: Integração de IA no ERP-Croma

**Data:** 23/03/2026 | **Para:** Junior (Croma Print) | **Versão:** 1.0

---

## Diagnóstico Atual do ERP-Croma

### Stack Completo
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **State:** TanStack Query v5 + Zod + React Hook Form
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions em Deno)
- **Deploy:** Vercel (crm-croma.vercel.app) + Supabase Cloud
- **IA Atual:** OpenRouter (GPT-4.1-mini padrão, Claude Sonnet 4 para composição de mensagens)

### Módulos do ERP (16 domínios)
| Módulo | Pasta | IA Existente? |
|--------|-------|---------------|
| Comercial | `domains/comercial` | Sim — qualificação de leads, composição de mensagens |
| Clientes | `domains/clientes` | Sim — resumo inteligente de cliente |
| Pedidos | `domains/pedidos` | Parcial — briefing de produção |
| Produção | `domains/producao` | Sim — briefing de produção com IA |
| Estoque | `domains/estoque` | Não |
| Financeiro | `domains/financeiro` | Sim — classificação de extrato bancário |
| Fiscal | `domains/fiscal` | Não |
| Contabilidade | `domains/contabilidade` | Não |
| Compras | `domains/compras` | Não |
| Instalação | `domains/instalacao` | Não |
| Qualidade | `domains/qualidade` | Não |
| Admin | `domains/admin` | Não |
| Portal | `domains/portal` | Não |
| Dados | `domains/dados` | Não |
| AI (core) | `domains/ai` | Sim — sidebar, appliers, KPI bar |
| Agent | `domains/agent` | Sim — agente de vendas completo |

### Edge Functions de IA Existentes (12 funções)
1. **ai-analisar-orcamento** — Analisa orçamentos e sugere ações (margem, materiais, preços)
2. **ai-resumo-cliente** — Gera perfil inteligente do cliente com histórico
3. **ai-briefing-producao** — Cria briefing técnico para produção
4. **ai-detectar-problemas** — Monitora orçamentos vencidos, pedidos parados, sem faturamento
5. **ai-composicao-produto** — Sugere composição de produto a partir de descrição
6. **ai-qualificar-lead** — Scoring de leads com score 0-100 e próxima ação
7. **ai-compor-mensagem** — Gera mensagens de vendas (email/WhatsApp) com detecção de intent
8. **ai-gerar-orcamento** — Gera orçamento completo a partir de conversa (extração → match → cálculo → persistência)
9. **ai-classificar-extrato** — Classifica transações bancárias no plano de contas
10. **ai-decidir-acao** — Orquestrador batch do agente de vendas (regras determinísticas)
11. **ai-shared/** — Biblioteca compartilhada (OpenRouter provider, prompt builder, pricing engine, logger, types)
12. **agent-enviar-email** — Envio de emails via Resend

### Infraestrutura de IA Existente
- **OpenRouter** como gateway (suporta GPT-4.1-mini, Claude Sonnet 4, Gemini, Mistral)
- **AI Sidebar** — componente React com ações aplicáveis (20+ appliers registrados)
- **AI Appliers** — sistema de "apply" que executa sugestões da IA diretamente no banco
- **ai_logs** — tabela de auditoria com custo por chamada, tokens, duração
- **ai_alertas** — tabela de alertas operacionais
- **Rate limiting** — 30 chamadas/hora por usuário
- **RBAC** — controle de acesso por função de IA por role (comercial, gerente, admin, producao)
- **Pricing Engine** — motor de precificação Mubisys portado para Deno (9 passos de cálculo)

---

## PERGUNTA 1: Como Integrar o Plano Estratégico de IA ao ERP Existente?

### Mapa de Oportunidades por Módulo

#### TIER 1 — Alto Impacto + Fácil (já tem base)

**1. Comercial — Agente de Vendas Autônomo (EXPANDIR)**
- Já existe: qualificação de leads, composição de mensagens, geração de orçamentos
- Falta: envio automático via WhatsApp Business API, webhook de recebimento de mensagens, loop autônomo real
- Impacto: Conversão de leads 24/7 sem intervenção humana

**2. Orçamentos — IA Preditiva de Preços (EXPANDIR)**
- Já existe: ai-analisar-orcamento com sugestões de margem
- Falta: aprendizado com orçamentos aprovados vs recusados, preço dinâmico por segmento/volume, detecção de outliers de preço
- Impacto: Aumento de margem de 5-15% em orçamentos

**3. Produção — Planejamento Inteligente (EXPANDIR)**
- Já existe: briefing de produção
- Falta: sequenciamento automático de ordens, previsão de prazo com base em histórico, detecção de gargalos
- Impacto: Redução de 20-30% no lead time de produção

#### TIER 2 — Alto Impacto + Médio Esforço

**4. Estoque — Previsão de Demanda + Reposição Automática**
- Não existe nada de IA
- Oportunidade: prever consumo de materiais com base em pedidos em carteira + sazonalidade, alertas de estoque mínimo inteligente
- Impacto: Redução de 15-25% em capital parado em estoque

**5. Financeiro — Conciliação Bancária Inteligente (EXPANDIR)**
- Já existe: classificação de extrato
- Falta: conciliação automática OFX → contas_receber, previsão de fluxo de caixa, detecção de anomalias (duplicidade de pagamento, cobranças esquecidas)
- Impacto: Economia de 10+ horas/mês de trabalho manual

**6. Qualidade — NPS Automatizado + Análise de Sentimento**
- Tabela nps já existe (migration 083)
- Falta: envio automático de pesquisa pós-instalação, análise de sentimento das respostas, detecção de clientes em risco de churn
- Impacto: Retenção de clientes + upsell para insatisfeitos

#### TIER 3 — Médio Impacto + Funcionalidade Nova

**7. Fiscal — Validação Inteligente de NF-e**
- Já tem módulo fiscal completo (emissão, consulta, cancelamento SEFAZ)
- Falta: validação pré-emissão (CFOP correto, NCM validado, alíquotas), sugestão de correção antes de rejeição
- Impacto: Redução de 80% nas rejeições de NF-e

**8. Compras — Cotação Inteligente**
- Não existe IA
- Oportunidade: sugerir fornecedores com base em histórico, previsão de preço de matéria-prima, geração automática de pedido de compra
- Impacto: Redução de 10-15% no custo de materiais

**9. Instalação — Roteirização + Checklist Inteligente**
- Já tem App de Campo (PWA separado)
- Falta: otimização de rotas para equipes de instalação, checklist adaptativo por tipo de produto, detecção automática de problemas via foto
- Impacto: Redução de 20% nos custos de deslocamento

**10. Portal do Cliente — Chat com IA**
- Portal já existe com tracking e pagamento
- Falta: chatbot no portal para perguntas sobre pedido, geração de 2ª via de boleto, solicitação de novas cotações
- Impacto: Redução de 50% nas ligações de suporte

---

## PERGUNTA 2: Lista de Prompts Prontos para o Claude Code

Ordenados por prioridade de impacto. Copie e cole cada um na outra aba do Claude Code.

---

### PROMPT 1 — WhatsApp Business API Integration (Agente de Vendas)
```
No ERP-Croma (C:\Users\Caldera\Claude\CRM-Croma), crie a integração com WhatsApp Business Cloud API para o agente de vendas. Faça:

1. Crie a edge function `supabase/functions/whatsapp-webhook/index.ts` (já existe o arquivo, refatore) para receber webhooks do Meta (verificação GET + processamento POST). Quando receber mensagem:
   - Salvar em agent_messages com direcao='recebida'
   - Atualizar agent_conversations.mensagens_recebidas
   - Chamar ai-compor-mensagem para gerar resposta automática

2. Refatore `supabase/functions/whatsapp-enviar/index.ts` para usar a Cloud API oficial do Meta (graph.facebook.com/v21.0/{phone_number_id}/messages). Use WHATSAPP_TOKEN e WHATSAPP_PHONE_ID como env vars no Supabase.

3. No frontend, em `src/domains/agent/pages/AgentDashboardPage.tsx`, adicione um botão "Ativar WhatsApp" que mostra status da conexão e últimas mensagens do canal whatsapp.

4. Adicione variáveis de ambiente necessárias no .env.example: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_VERIFY_TOKEN.

Siga os padrões existentes em ai-shared/ai-helpers.ts para CORS e auth. A edge function whatsapp-webhook deve aceitar requisições sem auth (é um webhook público do Meta). Use o service role key internamente.
```

---

### PROMPT 2 — Loop Autônomo do Agente de Vendas (Cron Job)
```
No ERP-Croma (C:\Users\Caldera\Claude\CRM-Croma), crie o loop autônomo do agente de vendas. Atualmente ai-decidir-acao precisa ser chamado manualmente. Faça:

1. Crie `supabase/functions/agent-cron-loop/index.ts` — uma edge function que:
   - Busca conversas ativas com proximo_followup <= now()
   - Para cada uma, chama ai-decidir-acao (regras determinísticas)
   - Se acao='enviar_followup' ou 'compor_resposta', chama ai-compor-mensagem
   - Se mensagem aprovada automaticamente (score_engajamento < 50), chama whatsapp-enviar ou agent-enviar-email
   - Loga tudo em ai_logs
   - Use service role key (sem auth de usuário — é cron)

2. Configure no Supabase Dashboard > Edge Functions > Schedules: rodar a cada 30 minutos, das 8h às 18h (horário de Brasília).

3. Adicione uma coluna `auto_aprovacao` BOOLEAN DEFAULT false na tabela agent_conversations (migration nova em supabase/migrations/097_agent_auto_aprovacao.sql).

4. No AgentConfigPage.tsx, adicione toggle para "Auto-aprovação de mensagens para leads frios (score < 50)".

Use os padrões de ai-helpers.ts. Respeite o rate limit de max_contatos_dia da admin_config.agent_config.
```

---

### PROMPT 3 — Previsão de Demanda de Estoque com IA
```
No ERP-Croma (C:\Users\Caldera\Claude\CRM-Croma), crie previsão de demanda de materiais. Faça:

1. Crie a edge function `supabase/functions/ai-previsao-estoque/index.ts`:
   - Recebe: periodo_dias (default 30)
   - Busca: pedidos dos últimos 90 dias com pedido_itens + proposta_item_materiais
   - Busca: propostas em aberto (probabilidade de conversão por status)
   - Busca: saldos atuais de estoque (estoque_saldos view)
   - Envia para IA: histórico de consumo + pipeline de vendas + sazonalidade
   - Retorna: lista de materiais com previsão de consumo, risco de ruptura, sugestão de compra
   - Formato de resposta: { materiais: [{ material_id, nome, consumo_previsto, saldo_atual, dias_cobertura, sugestao_compra, urgencia }] }

2. Registre em ai-types.ts: nova function 'previsao-estoque' com acesso ['gerente', 'admin', 'compras']

3. Crie o hook `src/domains/estoque/hooks/usePrevisaoDemanda.ts` usando useMutation para chamar a edge function.

4. Crie o componente `src/domains/estoque/components/PrevisaoDemandaPanel.tsx` com cards mostrando materiais por urgência (crítico/atenção/ok) com botão "Gerar Pedido de Compra".

5. Adicione o painel na página de estoque existente.

Siga os padrões de ai-analisar-orcamento para estrutura da edge function.
```

---

### PROMPT 4 — Conciliação Bancária Automática com IA
```
No ERP-Croma (C:\Users\Caldera\Claude\CRM-Croma), crie conciliação bancária automática. Faça:

1. Crie `supabase/functions/ai-conciliar-bancario/index.ts`:
   - Recebe: array de transações do extrato OFX (já parseadas no frontend)
   - Busca: contas_receber pendentes + contas_pagar pendentes
   - Para cada transação, usa IA para fazer match com conta financeira (créditos → contas_receber, débitos → contas_pagar)
   - Retorna: matches sugeridos com score de confiança
   - Auto-concilia se confiança > 0.9 (valor exato + nome similar)

2. Crie o componente `src/domains/financeiro/components/ConciliacaoBancaria.tsx`:
   - Upload de arquivo OFX
   - Parser OFX no frontend (use regex simples para STMTTRN)
   - Mostra tabela com transações à esquerda e match sugerido à direita
   - Botões "Aprovar" (concilia) e "Rejeitar" (busca outro match)
   - Botão "Conciliar Todos" para aprovados com confiança > 0.9

3. Crie nova rota em financeiroRoutes.tsx: '/financeiro/conciliacao'

4. Adicione link no menu financeiro.

Use o padrão de AIActionCard para mostrar os matches com severidade por confiança.
```

---

### PROMPT 5 — Chat IA no Portal do Cliente
```
No ERP-Croma (C:\Users\Caldera\Claude\CRM-Croma), crie um chat com IA no portal do cliente. Faça:

1. Crie `supabase/functions/ai-chat-portal/index.ts`:
   - Auth: usa share_token da proposta (não precisa de login)
   - Recebe: { share_token, mensagem, historico[] }
   - Busca contexto: proposta com itens, pedido se existir, status de produção, tracking
   - System prompt: assistente da Croma que responde dúvidas sobre o pedido do cliente
   - Só responde sobre o pedido específico deste token
   - Pode: informar status, prazo, detalhes dos itens, forma de pagamento
   - Não pode: alterar pedido, dar descontos, revelar margens
   - Retorna: { resposta, tipo: 'info'|'acao_necessaria' }

2. Crie `src/domains/portal/components/PortalChat.tsx`:
   - Botão flutuante no canto inferior direito (ícone MessageCircle)
   - Chat widget que abre como drawer
   - Campo de texto + histórico de mensagens
   - Visual clean seguindo design system do portal

3. Integre na página do portal existente (onde o cliente vê sua proposta/pedido).

4. Não precisa de auth convencional — use o share_token como identificação.

Não use localStorage (não funciona). Use useState para o histórico.
```

---

### PROMPT 6 — Dashboard Inteligente com IA (Insights Diários)
```
No ERP-Croma (C:\Users\Caldera\Claude\CRM-Croma), crie um dashboard de insights diários gerados por IA. Faça:

1. Crie `supabase/functions/ai-insights-diarios/index.ts`:
   - Busca: KPIs do dia (novos leads, orçamentos enviados, pedidos concluídos, faturamento, contas vencidas)
   - Busca: comparação com dia anterior, semana anterior, mês anterior
   - Busca: alertas ativos não resolvidos (ai_alertas)
   - Envia para IA e retorna: { resumo_executivo, metricas_chave, alertas_priorizados, acoes_recomendadas[] }

2. Crie `src/shared/components/InsightsDiarios.tsx`:
   - Card com resumo em linguagem natural (ex: "Hoje foi um bom dia: 3 novos orçamentos totalizando R$ 45.000, mas há 2 pedidos parados que precisam de atenção")
   - Badges de alertas clicáveis
   - Botão "Ver Detalhes" que expande ações recomendadas

3. Integre na página principal do ERP (dashboard home).

4. Cache o resultado por 1 hora no frontend (staleTime do TanStack Query).

Use o padrão de ai-detectar-problemas para a estrutura.
```

---

### PROMPT 7 — NPS Automatizado com Análise de Sentimento
```
No ERP-Croma (C:\Users\Caldera\Claude\CRM-Croma), crie o sistema de NPS automatizado. A tabela nps já existe (migration 083). Faça:

1. Crie `supabase/functions/ai-enviar-nps/index.ts`:
   - Busca pedidos com status 'instalado' ou 'entregue' nos últimos 7 dias que ainda não têm NPS
   - Para cada um, envia email via Resend com link único para pesquisa NPS
   - Link aponta para: /p/nps/{token}

2. Crie `supabase/functions/ai-analisar-nps/index.ts`:
   - Recebe: nps_id após cliente responder
   - Usa IA para analisar o comentário: sentimento (positivo/neutro/negativo), temas mencionados, risco de churn
   - Se NPS < 7 e sentimento negativo → cria tarefa automática para gerente
   - Se NPS >= 9 → cria oportunidade de upsell/indicação
   - Salva análise no campo metadata da tabela nps

3. Crie a página pública `src/domains/portal/pages/NPSPage.tsx`:
   - Design limpo com escala 0-10 (botões coloridos)
   - Campo de comentário opcional
   - Agradecimento após envio

4. Crie `src/domains/qualidade/components/NPSDashboard.tsx`:
   - NPS score geral + evolução mensal (Recharts)
   - Top comentários positivos e negativos
   - Filtro por período e segmento

Adicione rota pública para /p/nps/:token e rota autenticada para /qualidade/nps.
```

---

### PROMPT 8 — IA para Validação Pré-Emissão de NF-e
```
No ERP-Croma (C:\Users\Caldera\Claude\CRM-Croma), crie validação inteligente de NF-e antes da emissão. Faça:

1. Crie `supabase/functions/ai-validar-nfe/index.ts`:
   - Recebe: pedido_id
   - Busca: dados do pedido, itens, cliente (CNPJ, IE, endereço), configuração fiscal
   - Verifica com IA: CFOP correto para operação, NCM compatível com produto, alíquotas de ICMS/IPI/PIS/COFINS por UF, dados obrigatórios preenchidos
   - Retorna: { valido: boolean, erros: [], avisos: [], sugestoes: [] }
   - Cada erro/aviso com: campo, valor_atual, valor_sugerido, motivo

2. No fluxo de emissão fiscal existente (src/domains/fiscal/), adicione um passo de "Validação IA" antes de chamar fiscal-emitir-nfe. Mostre resultado como AIActionCard.

3. Se houver erros críticos, bloqueie a emissão até correção.

Use o padrão de AIActionableResponse para os resultados.
```

---

### PROMPT 9 — Detecção de Problemas via Foto (App de Campo)
```
No ERP-Croma (C:\Users\Caldera\Claude\CRM-Croma), crie análise de fotos de instalação via IA no App de Campo. Faça:

1. Crie `supabase/functions/ai-analisar-foto-instalacao/index.ts`:
   - Recebe: foto em base64 + job_id
   - Usa Claude Sonnet 4 via OpenRouter com vision (envia imagem)
   - Analisa: qualidade da instalação, alinhamento, acabamento, possíveis defeitos
   - Retorna: { aprovado: boolean, score_qualidade: 0-100, observacoes: [], problemas_detectados: [] }

2. No App de Campo (APP-Campo/), quando o técnico tira foto de conclusão:
   - Mostra loading "Analisando qualidade..."
   - Se score < 70, mostra alerta com problemas detectados
   - Técnico pode refazer ou justificar

3. Salve resultado da análise na tabela campo_fotos ou metadata do job.

Para enviar imagem via OpenRouter com vision, use o formato de mensagem com content array: [{ type: "text", text: "..." }, { type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } }].
```

---

### PROMPT 10 — Preço Dinâmico por Segmento/Volume
```
No ERP-Croma (C:\Users\Caldera\Claude\CRM-Croma), crie precificação dinâmica inteligente. Faça:

1. Crie `supabase/functions/ai-preco-dinamico/index.ts`:
   - Recebe: proposta_id
   - Busca: histórico de propostas aprovadas vs recusadas nos últimos 6 meses, segmentado por: segmento do cliente, volume (m²), categoria de produto
   - Treina um modelo simplificado: qual faixa de markup tem maior taxa de conversão por segmento
   - Retorna: { markup_sugerido, faixa_competitiva: { min, max }, taxa_conversao_estimada, benchmarks: [] }

2. Integre no componente de edição de orçamento existente. Quando o usuário está definindo preço, mostre uma badge discreta: "IA sugere markup de X% para este segmento (taxa de conversão de Y%)".

3. Crie uma migration nova com tabela `ai_pricing_history` que acumula: proposta_id, segmento, categoria, markup_aplicado, resultado (aprovada/recusada/expirada).

4. Adicione trigger que popula ai_pricing_history quando proposta muda de status.

Não use ML pesado — use análise estatística simples (média, mediana, quartis) nos dados históricos + IA para interpretar e sugerir.
```

---

### PROMPT 11 — Sequenciamento de Produção com IA
```
No ERP-Croma (C:\Users\Caldera\Claude\CRM-Croma), crie sequenciamento inteligente de ordens de produção. Faça:

1. Crie `supabase/functions/ai-sequenciar-producao/index.ts`:
   - Busca: todos pedidos em status 'em_producao' ou 'confirmado' com seus itens e processos
   - Busca: capacidade produtiva (config admin: máquinas, funcionários, horas/dia)
   - Considera: prazo prometido, prioridade, setup compartilhado (mesmo material = agrupar), gargalos
   - Retorna: sequência otimizada com: ordem, pedido_id, item_id, máquina, data_inicio_estimada, data_fim_estimada

2. Crie `src/domains/producao/components/SequenciamentoPanel.tsx`:
   - Timeline visual (tipo Gantt simplificado) usando divs com Tailwind
   - Drag and drop para reordenar (já tem @dnd-kit no projeto)
   - Cores por status: no prazo (verde), apertado (amarelo), atrasado (vermelho)

3. Crie rota /producao/sequenciamento e link no menu.

Use o padrão de ai-briefing-producao para a edge function.
```

---

### PROMPT 12 — Cotação Inteligente de Compras
```
No ERP-Croma (C:\Users\Caldera\Claude\CRM-Croma), crie sugestão inteligente de compras. Faça:

1. Crie `supabase/functions/ai-sugerir-compra/index.ts`:
   - Recebe: lista de materiais necessários (ou usa output do ai-previsao-estoque)
   - Busca: histórico de preços dos materiais (tabela materiais.preco_medio + compras anteriores se existirem)
   - IA analisa: melhor momento para comprar, quantidade econômica, sugestão de fornecedores do histórico
   - Retorna: { itens: [{ material_id, quantidade_sugerida, preco_estimado, fornecedor_sugerido, economia_estimada }] }

2. Crie `src/domains/compras/components/SugestaoCompraPanel.tsx` com tabela de sugestões e botão "Gerar Pedido de Compra".

3. Integre com o painel de previsão de demanda (Prompt 3) — botão "Comprar" na previsão leva direto para sugestão de compra.
```

---

### PROMPT 13 — Chatbot Interno no ERP (Assistente Croma)
```
No ERP-Croma (C:\Users\Caldera\Claude\CRM-Croma), crie um assistente IA interno acessível de qualquer página do ERP. Faça:

1. Crie `supabase/functions/ai-assistente-interno/index.ts`:
   - Recebe: { mensagem, contexto_pagina, historico[] }
   - System prompt: "Você é o assistente interno do ERP Croma. Ajude os funcionários com dúvidas sobre o sistema, dados e processos."
   - Tem acesso a: dados do usuário logado, últimos pedidos, orçamentos, clientes
   - Pode: buscar informações, explicar processos, gerar relatórios rápidos
   - Não pode: alterar dados, deletar registros

2. Crie `src/shared/components/AssistenteCroma.tsx`:
   - Botão flutuante com ícone Bot (lucide) no canto inferior direito
   - Chat drawer com histórico da sessão
   - Envio de mensagens com Ctrl+Enter
   - Suporte a código/tabelas na resposta (markdown rendering)

3. Adicione no Layout.tsx para aparecer em todas as páginas autenticadas.

4. Contexto automático: passa a URL atual e dados da página como contexto.

Use useState para histórico (sem localStorage). Use streaming se OpenRouter suportar, senão polling simples.
```

---

### PROMPT 14 — Relatórios Gerenciais com IA
```
No ERP-Croma (C:\Users\Caldera\Claude\CRM-Croma), crie geração de relatórios gerenciais por IA. Faça:

1. Crie `supabase/functions/ai-relatorio-gerencial/index.ts`:
   - Recebe: { tipo: 'semanal'|'mensal'|'trimestral', periodo }
   - Busca automaticamente todos KPIs relevantes: faturamento, ticket médio, novos clientes, taxa de conversão de orçamentos, tempo médio de produção, inadimplência
   - IA gera: resumo executivo em texto, análise de tendências, alertas de oportunidades e riscos, comparativo com período anterior
   - Retorna: { relatorio_html, kpis: {}, tendencias: [], recomendacoes: [] }

2. Crie `src/domains/dados/pages/RelatorioGerencialPage.tsx`:
   - Seletor de período
   - Botão "Gerar Relatório"
   - Visualização renderizada do HTML
   - Botões "Exportar PDF" (usa html2pdf.js que já está instalado) e "Enviar por Email"

3. Adicione rota /dados/relatorio-gerencial.

Reutilize o hook usePrevisaoDemanda como modelo para o hook do relatório.
```

---

### PROMPT 15 — Monitoramento Proativo com Cron (Detectar Problemas Automático)
```
No ERP-Croma (C:\Users\Caldera\Claude\CRM-Croma), ative o monitoramento proativo. A edge function ai-detectar-problemas já tem mode='cron'. Faça:

1. Crie `supabase/functions/cron-detectar-problemas/index.ts`:
   - Wrapper que chama ai-detectar-problemas com modo='cron' via service role
   - Rodas a cada 6 horas (configure no Supabase Dashboard)
   - Após criar alertas, verifica se há alertas críticos novos
   - Se sim, envia notificação por email (Resend) para gerentes

2. Crie `src/domains/ai/components/AlertasWidget.tsx`:
   - Widget compacto para o dashboard mostrando alertas ativos
   - Badge com contagem de alertas por severidade
   - Click abre lista com ações rápidas (resolver, encaminhar, ignorar)

3. Crie hook `src/domains/ai/hooks/useAlertasAtivos.ts`:
   - useQuery que busca ai_alertas WHERE resolvido=false
   - Refetch a cada 5 minutos
   - Retorna agrupado por severidade

4. Integre o AlertasWidget no componente NotificationBadge.tsx existente no header.

Siga o padrão de useNotifications.ts para o hook.
```

---

### PROMPT 17 — Roteirização de Instalação
```
No ERP-Croma (C:\Users\Caldera\Claude\CRM-Croma), crie roteirização inteligente para equipes de instalação. Faça:

1. Crie `supabase/functions/ai-roteirizar-instalacao/index.ts`:
   - Busca: pedidos com status 'producao_concluida' ou 'em_instalacao' com endereços dos clientes
   - Busca: equipes de instalação disponíveis
   - IA otimiza: agrupa por região, minimiza deslocamento, considera janelas de horário
   - Retorna: { rotas: [{ equipe, sequencia: [{ pedido_id, endereco, horario_sugerido, duracao_estimada }] }] }

2. Crie `src/domains/instalacao/components/RoteirizacaoPanel.tsx`:
   - Mapa com marcadores (já tem leaflet como dependência de types)
   - Lista de rotas por equipe com drag and drop para ajustar
   - Botão "Confirmar Roteiro" que cria os jobs no App de Campo

3. Adicione rota /instalacao/roteirizacao.

Use a edge function resolve-geo que já existe para geocodificar endereços.
```

---

### PROMPT 18 — Análise de Churn e Reativação
```
No ERP-Croma (C:\Users\Caldera\Claude\CRM-Croma), crie detecção de churn e reativação automática. Faça:

1. Crie `supabase/functions/ai-detectar-churn/index.ts`:
   - Busca clientes ativos que não fazem pedido há mais de 90 dias (ou que diminuíram frequência)
   - Para cada um: calcula ticket médio histórico, frequência de compra, último contato, NPS se existir
   - IA classifica: risco de churn (alto/médio/baixo), motivo provável, estratégia de reativação
   - Retorna: { clientes_risco: [{ cliente_id, risco, motivo, acao_sugerida, mensagem_reativacao }] }

2. Crie `src/domains/clientes/components/ChurnPanel.tsx`:
   - Lista de clientes em risco, ordenados por valor (ticket médio × frequência)
   - Botão "Enviar Reativação" que cria conversa no agente de vendas com a mensagem sugerida
   - Integração com o agente: cria agent_conversation com etapa='reengajamento'

3. Adicione como tab na página de clientes.

Siga o padrão de ai-qualificar-lead para a edge function.
```

---

### PROMPT 19 — Sugestão de Design por IA (Briefing Visual)
```
No ERP-Croma (C:\Users\Caldera\Claude\CRM-Croma), crie sugestão de design para briefings de comunicação visual. Faça:

1. Crie `supabase/functions/ai-sugestao-design/index.ts`:
   - Recebe: { briefing_texto, segmento_cliente, tipo_produto, local_aplicacao }
   - Usa Claude Sonnet 4 via OpenRouter
   - Retorna: { sugestoes: [{ conceito, cores_sugeridas: [hex], tipografia, dimensoes_ideais, referencia_visual, materiais_recomendados }] }
   - Inclui 2-3 opções de conceito criativo

2. Crie `src/domains/comercial/components/SugestaoDesignPanel.tsx`:
   - Form com campos: descrição do briefing, segmento, tipo de produto
   - Mostra cards com cada sugestão: paleta de cores (swatches visuais), tipografia, conceito
   - Botão "Usar no Orçamento" que preenche campos do orçamento

3. Integre na página de novo orçamento, como tab ou painel lateral.

Foco em texto/conceito, não em geração de imagem (isso é futuro).
```

---

### PROMPT 20 — Painel de Custos de IA (Admin)
```
No ERP-Croma (C:\Users\Caldera\Claude\CRM-Croma), crie um painel administrativo de custos e uso de IA. Faça:

1. Crie `src/domains/admin/pages/AICustoPage.tsx`:
   - Busca dados de ai_logs com agregações: custo total por dia/semana/mês, tokens por função, modelo mais usado, custo médio por chamada
   - Gráfico de custo diário (Recharts AreaChart)
   - Tabela de custos por edge function
   - Top 10 usuários por consumo
   - Comparativo de custo: OpenRouter vs Anthropic Direct (se ambos estiverem configurados)

2. Crie `src/domains/admin/hooks/useAICustos.ts`:
   - useQuery com RPC ou query direta na ai_logs
   - Agregações: SUM(cost_usd), COUNT(*), AVG(duration_ms) GROUP BY function_name, date

3. Adicione rota /admin/ia-custos e link no menu admin.

4. Mostre badge no header admin: "IA: $X.XX hoje"

Use o design system existente (cards rounded-2xl, cores blue-600).
```

---

## PERGUNTA 3: Claude como Orquestrador no ERP — Viabilidade Técnica

### Diferença Fundamental: Cowork vs API do Claude

| Aspecto | Cowork (esta janela) | API do Claude no ERP |
|---------|---------------------|---------------------|
| Onde roda | VM separada no seu computador | Supabase Edge Functions (cloud) |
| Acesso ao ERP | Lê arquivos locais do código-fonte | Acessa banco Supabase diretamente |
| Uso ideal | Desenvolvimento, gerar código, criar arquivos | Runtime do produto, decisões em tempo real |
| Latência | Segundos (interativo) | 200-2000ms (API call) |
| Custo | Incluído no plano Claude | Pay-per-token (API) |
| Pode embedar no ERP? | Não — é ferramenta de dev | Sim — via edge functions |
| Dados do usuário | Não tem acesso ao banco de produção | Tem acesso total via service role |

**Resumo:** O Cowork é sua ferramenta de desenvolvimento. A API do Claude é o que roda dentro do ERP em produção. São complementares, não substitutos.

### Arquitetura Recomendada: Claude como "Cérebro" do ERP

```
┌─────────────────────────────────────────────────────────┐
│                    ERP-Croma (React)                      │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐          │
│  │Comerc│ │Produc│ │Financ│ │Estoq │ │Portal│          │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘          │
│     │        │        │        │        │                │
│     └────────┴────────┴────────┴────────┘                │
│                       │                                   │
│              supabase.functions.invoke()                  │
└───────────────────────┬──────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│              Supabase Edge Functions (Deno)               │
│                                                           │
│  ┌─────────────────────────────────────────────┐         │
│  │           ai-router.ts (NOVO)                │         │
│  │  ┌───────────────┐  ┌────────────────────┐  │         │
│  │  │anthropic-direct│  │openrouter-fallback │  │         │
│  │  └───────────────┘  └────────────────────┘  │         │
│  └─────────────────────────────────────────────┘         │
│                                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ai-analis │ │ai-compor │ │ai-decidir│ │ai-previsao│   │
│  │orcamento │ │mensagem  │ │acao      │ │estoque   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                           │
│  ┌──────────────────────────────────────────────┐        │
│  │     CRON JOBS (Orquestrador Autônomo)         │        │
│  │  • agent-cron-loop (a cada 30min)             │        │
│  │  • cron-detectar-problemas (a cada 6h)        │        │
│  │  • cron-previsao-estoque (diário 6h)          │        │
│  │  • cron-nps (diário 10h)                      │        │
│  │  • cron-churn (semanal seg 8h)                │        │
│  └──────────────────────────────────────────────┘        │
│                                                           │
│  ┌──────────────────────────────────────────────┐        │
│  │     WEBHOOKS (Eventos Externos)               │        │
│  │  • whatsapp-webhook (Meta)                    │        │
│  │  • webhook-pagamento (PIX/boleto)             │        │
│  │  • webhook-email-reply (Resend inbound)       │        │
│  └──────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │  Supabase Postgres │
              │  + Auth + Storage  │
              └──────────────────┘
```

### Como Criar o "Modo Orquestrador"

O "modo orquestrador" é quando o Claude toma decisões e age automaticamente, sem intervenção humana. Você já tem metade disso funcionando com o `ai-decidir-acao`. Para completar:

**Camada 1 — Cron Jobs (já possível hoje)**
- Supabase suporta cron scheduling nativo para edge functions
- `ai-detectar-problemas` já funciona em modo cron
- Expandir para: previsão de estoque, NPS, churn, relatórios

**Camada 2 — Event-Driven (reativo)**
- Database triggers do Postgres (já tem vários: `fn_auto_gerar_contas_receber`, `fn_gerar_comissao_auto`)
- Criar novos triggers que chamam edge functions quando dados mudam
- Exemplo: quando pedido muda para 'em_producao' → trigger chama `ai-briefing-producao` automaticamente

**Camada 3 — Webhooks (comunicação externa)**
- WhatsApp webhook já tem estrutura
- Adicionar: webhook de email reply (Resend), webhook de pagamento (PIX)
- Cada webhook alimenta o ciclo de decisão do agente

**Camada 4 — Feedback Loop (aprendizado)**
- Tabela ai_pricing_history para registrar o que deu certo/errado
- Quando usuário aplica ou rejeita sugestão da IA → registrar
- Próximas sugestões levam em conta o histórico

### Limitações Reais

1. **Supabase Edge Functions** têm timeout de 60 segundos (pode aumentar no plano Pro). Para tarefas longas, quebrar em etapas.
2. **Custo de API**: ~$0.003-0.015 por chamada (GPT-4.1-mini). Para Claude Sonnet 4 direto: ~$0.02-0.10 por chamada. Monitorar com o painel de custos (Prompt 20).
3. **Realtime**: Supabase Realtime pode notificar o frontend quando cron jobs criam alertas. Já existe infraestrutura para isso no Supabase.
4. **Não use websocket direto para IA**: o padrão request-response das edge functions é mais eficiente e confiável. Para "tempo real", use Supabase Realtime subscriptions nas tabelas de alertas.

### Ordem de Implementação Recomendada

| Fase | Prompts | Semanas | Impacto |
|------|---------|---------|---------|
| 1. Agente autônomo | 1, 2, 15 | 2 | Vendas 24/7 |
| 2. Inteligência financeira | 4, 6, 20 | 2 | Economia de tempo + controle |
| 3. Estoque + Compras | 3, 12 | 1 | Redução de custos |
| 4. Produção inteligente | 11, 8 | 2 | Eficiência operacional |
| 5. Experiência do cliente | 5, 7, 18 | 2 | Retenção + upsell |
| 6. Infraestrutura IA | 16, 13, 14 | 2 | Autonomia e escalabilidade |
| 7. Inovação | 9, 10, 17, 19 | 3 | Diferencial competitivo |

**Total estimado: 14 semanas** para implementar todas as 20 funcionalidades com o Claude Code.

---

*Relatório gerado por análise direta do código-fonte do ERP-Croma em C:\Users\Caldera\Claude\CRM-Croma*
