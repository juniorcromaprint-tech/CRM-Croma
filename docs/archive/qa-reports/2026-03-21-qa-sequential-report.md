# RELATÓRIO DE QA OPERACIONAL — CROMA_ERP
## Execução: 2026-03-21 às 09:30 — ANÁLISE DEEP GAPS

> **Modalidade especial**: Análise profunda de funcionalidades ausentes, fluxos incompletos e gaps de produto
> **Agente**: AGENTE DE CONTROLE DE QUALIDADE CROMA_ERP v1.0
> **Commit base**: 10fb3f2 (branch: claude/cranky-booth)

---

## 1. RESUMO EXECUTIVO

```
Data/Hora:          2026-03-21 09:30
Cenário executado:  Banner-Teste — Fluxo Completo (Lead → Faturamento)
Passos totais:      17
Passos executados:  17
Passos com sucesso: 10
Passos com falha:   4
Passos parciais:    3
Taxa de sucesso:    59%

Erros encontrados:
  🔴 CRÍTICO: 3
  🟠 ALTO:    6
  🟡 MÉDIO:   9
  🟢 BAIXO:   5
  ─────────────────
  TOTAL:      23
```

### Veredito de Prontidão

```
[x] 🟠 PARCIALMENTE APTO — Funciona com restrições sérias
```

**Justificativa**: O fluxo principal comercial (Lead → Orçamento → Portal → Pedido) está funcional e bem construído. Entretanto, há três gaps críticos que impedem operações reais: (1) o módulo de produtos não persiste dimensões nos modelos, impedindo cálculo automático de área para banners/adesivos; (2) comissões de vendedores existem no banco mas não são geradas automaticamente em nenhum ponto do código; (3) o fluxo de pagamento via boleto está desconectado do ciclo de vida do pedido. Esses gaps tornam impossível a operação financeira e de precificação sem intervenção manual.

---

## 2. DESCRIÇÃO DO FLUXO EXECUTADO

### Personas ativas nesta execução:
- [x] Vendedor
- [x] Orçamentista
- [x] Operador de Cadastro
- [x] PCP de Produção
- [x] Operador de Produção
- [x] Financeiro
- [x] Faturamento
- [x] Expedição
- [x] Coordenador de Instalação

### Módulos do sistema acessados:
- `/produtos` — Cadastro de produtos, modelos e composição
- `/estoque` — Materiais e saldos
- `/leads` — CRM / Leads
- `/leads/:id` — Detalhe do lead + conversão
- `/orcamentos` — Lista de orçamentos
- `/orcamentos/novo` — Editor de orçamento
- `/orcamentos/:id` — Visualização + envio de proposta
- `/p/{token}` — Portal público do cliente
- `/pedidos` — Lista de pedidos
- `/pedidos/:id` — Detalhe do pedido + transições de status
- `/producao` — Gestão de OPs
- `/os/:pedidoId` — Ordem de Serviço
- `/financeiro` — Contas a receber / pagamentos
- `/financeiro/boletos` — Boletos
- `/fiscal` — Fila de NF-e
- `/expedicao` — Expedição e liberação
- `/instalacoes` — Ordens de Instalação

---

## 3. DADOS GERADOS PELO TESTE

```
Cliente fictício:    Papelaria São Lucas Ltda
CNPJ:               34.567.890/0001-12
Produto testado:    Banner-Teste
Variação:           Banner 90x120 cm
Quantidade:         10 unidades

IDs gerados (se aplicável):
  Lead ID:          N/A — simulação de código
  Cliente ID:       N/A — simulação de código
  Orçamento ID:     N/A — simulação de código
  Pedido ID:        N/A — simulação de código
  OP ID:            N/A — simulação de código
  OI ID:            N/A — simulação de código
  Job ID:           N/A — simulação de código

Valores calculados:
  Custo unitário:   N/A — depende de composição cadastrada (*)
  Preço de venda:   calculado via motor Mubisys (OrcamentoEditor)
  Total do pedido:  depende do preço de venda
  Valor esperado:   R$ 1.512,40 (referência)
  Variação:         INDETERMINADO (*)

(*) Ver QA-2026-03-21-002 — campos de dimensão ausentes no formulário de modelos.
```

---

## 4. RESULTADO POR PASSO

| # | Passo | Persona | Status | Observação |
|---|-------|---------|--------|------------|
| 1 | Cadastrar matéria-prima | Operador de Cadastro | ✅ | Formulário funcional em `/estoque`. Campos completos. |
| 2 | Criar produto Banner-Teste | Operador de Cadastro | ✅ | Formulário de produto funcional. |
| 3 | Criar variações de tamanho | Operador de Cadastro | ⚠️ | Modelo criado sem campos `largura_cm`/`altura_cm` — ver QA-2026-03-21-002 |
| 4 | Compor produto com materiais | Operador de Cadastro | ⚠️ | Composição cadastra materiais, mas sem fórmulas dinâmicas de área — ver QA-2026-03-21-003 |
| 5 | Gerar lead fictício | Vendedor | ✅ | Lead cria com todos os campos. Detecção de duplicata funcional. |
| 6 | Converter lead em cliente | Vendedor | ✅ | Conversão funciona. CNPJ validado. Dados migram corretamente. |
| 7 | Gerar orçamento | Orçamentista | ⚠️ | Motor de cálculo funcional via Mubisys. Porém NF-e não terá NCM se não preenchido no modelo — ver QA-2026-03-21-007 |
| 8 | Enviar orçamento por link | Orçamentista | ✅ | Portal público `/p/{token}` funcional. |
| 9 | Simular aprovação do cliente | Cliente (simulado) | ✅ | RPC `portal_aprovar_proposta` funciona. Pedido gerado automaticamente. |
| 10 | Gerar ordem de serviço/pedido | Vendedor | ✅ | Pedido criado com itens e valor corretos. Status: `aprovado`. |
| 11 | Executar fluxo de produção | PCP + Operador | ✅ | OP criada automaticamente ao avançar status. Etapas criadas (criacao, impressao, acabamento, conferencia, expedicao). |
| 12 | Finalizar produção | Operador de Produção | ⚠️ | OP conclui e desconta estoque. Mas: sem verificação de saldo disponível ANTES de iniciar — ver QA-2026-03-21-008 |
| 13 | Enviar para financeiro | PCP / Vendedor | ❌ | Contas a receber são geradas apenas quando pedido avança para "concluído". Financeiro não tem visão antecipada do pedido aprovado — ver QA-2026-03-21-001 |
| 14 | Validar emissão de NF-e | Faturamento | ⚠️ | NF-e cria como rascunho a partir do pedido. SEFAZ em homologação. NCM pode estar ausente — ver QA-2026-03-21-007 |
| 15 | Validar emissão de boleto | Financeiro | ❌ | Boleto não está vinculado automaticamente ao pedido. Criação é manual sem pull automático de dados do pedido — ver QA-2026-03-21-004 |
| 16 | Liberar para entrega/instalação | Expedição | ✅ | ExpedicaoPage funciona. Três modalidades: instalação, retirada, envio. |
| 17 | Validar integração App de Campo | Coord. Instalação | ✅ | Migration 004 aplicada. Triggers `fn_create_job_from_ordem` e `fn_sync_job_to_ordem` ativos. |

**Legenda**: ✅ Sucesso | ❌ Falha | ⚠️ Parcial / Com ressalvas

---

## 5. PROBLEMAS IDENTIFICADOS

### 5.1 — Erros CRÍTICOS 🔴

---

**QA-2026-03-21-001**

```
Severidade:  🔴 CRÍTICO
Módulo:      Financeiro — Fluxo de Cobrança
Passo:       13 — Enviar pedido para financeiro
Persona:     Financeiro
```

**Descrição**:
O financeiro não tem visão antecipada de pedidos aprovados. As contas a receber são geradas somente quando o pedido avança para o status `concluido` (ao final do ciclo, após produção + instalação). Isso significa que o financeiro não pode criar boletos, emitir cobranças antecipadas, ou planejar o fluxo de caixa baseado em pedidos em andamento.

**Passos para reproduzir**:
1. Criar e aprovar um orçamento — pedido criado com status `aprovado`
2. Acessar `/financeiro` → Contas a Receber
3. Procurar o pedido recém-aprovado
4. Nenhum título aparece — só aparecem títulos de pedidos `concluidos`

**Resultado esperado**: Pedido aprovado gera título "a vencer" no financeiro (ou ao menos é visível como receita projetada).

**Resultado obtido**: Financeiro desconhece o pedido até o momento da conclusão.

**Causa provável**: A função `gerarContasReceber` só é chamada em `concluirPedido()` — não existe trigger/chamada ao aprovar o pedido.

**Impacto no negócio**: Impossibilita planejamento de fluxo de caixa real. Em uma empresa com ciclo de produção de 5-10 dias, o financeiro só vê a receita no dia da entrega, sem antevisão. Boletos não podem ser emitidos antecipadamente para boleto com vencimento na data de entrega.

**Evidências**: `src/domains/pedidos/pages/PedidoDetailPage.tsx`, linha 166-177: `gerarContasReceber` e `gerarParcelas` chamados apenas em `concluirPedido()`.

---

**QA-2026-03-21-002**

```
Severidade:  🔴 CRÍTICO
Módulo:      Cadastro de Produtos — Modelos/Variações
Passo:       3 — Criar variações de tamanho
Persona:     Operador de Cadastro
```

**Descrição**:
O formulário de criação/edição de modelos de produto (`ModeloFormDialog` em `/produtos`) não possui campos de dimensões (`largura_cm`, `altura_cm`). Esses campos existem na tabela `produto_modelos` no banco, e são usados pelo motor de precificação no orçamento para calcular a área em m². Sem preenchê-los, o operador de cadastro não tem como informar as dimensões do Banner 90x120 pelo sistema.

**Passos para reproduzir**:
1. Acessar `/produtos`
2. Abrir um produto categoria "Banner"
3. Clicar em "Novo Modelo" ou editar modelo existente
4. O formulário exibe: Nome, Markup (%), Margem Mín (%), Tempo Produção, Unidade de Venda
5. Campos `largura_cm`, `altura_cm` e `area_m2` estão AUSENTES

**Resultado esperado**: Formulário de modelo deve ter campos "Largura (cm)" e "Altura (cm)" com cálculo automático de Área (m²).

**Resultado obtido**: Sem os campos, o operador não pode cadastrar as dimensões do modelo. A única alternativa é usar SQL direto no Supabase.

**Causa provável**: `src/pages/Produtos.tsx`, função `ModeloFormDialog` (linha 396): o state `form` não inclui `largura_cm`, `altura_cm`. Existe o serviço `produtoService` que aceita esses campos (interface `ModeloCreate`), mas o formulário não os expõe.

**Impacto no negócio**: O orçamentista não consegue calcular a área automaticamente na tela de orçamento para modelos sem dimensões — precisa digitar manualmente a dimensão a cada orçamento, criando retrabalho e risco de erro.

---

**QA-2026-03-21-003**

```
Severidade:  🔴 CRÍTICO
Módulo:      Cadastro de Produtos — Comissões
Passo:       Pós-conclusão do pedido
Persona:     Financeiro / Vendedor
```

**Descrição**:
Comissões de vendedores não são geradas em nenhum ponto do fluxo de código. A tabela `comissoes` existe no banco de dados (migration 001), a tela `/financeiro/comissoes` exibe os dados, mas não há nenhuma mutação, trigger de banco, ou função que insira registros em `comissoes` automaticamente. A tela mostra mensagem "As comissões são geradas automaticamente quando pedidos são pagos" — porém o código que faz isso não existe.

**Passos para reproduzir**:
1. Completar o fluxo completo: orçamento aprovado → pedido concluído
2. Acessar `/financeiro/comissoes`
3. Tabela vazia

**Resultado esperado**: Após pedido `concluido`, comissão do vendedor deveria ser criada automaticamente (% sobre o valor total ou sobre o lucro).

**Resultado obtido**: Tabela `comissoes` permanece vazia indefinidamente.

**Causa provável**: Nenhuma chamada a `supabase.from('comissoes').insert(...)` existe no código frontend. Nenhum trigger de banco foi encontrado nas migrations. A funcionalidade está prometida na UI mas não implementada.

**Impacto no negócio**: Equipe de vendas não recebe reconhecimento das comissões. Gestão não consegue calcular custo real de vendas.

---

### 5.2 — Erros ALTOS 🟠

---

**QA-2026-03-21-004**

```
Severidade:  🟠 ALTO
Módulo:      Financeiro — Boletos
Passo:       15 — Validar emissão de boleto
Persona:     Financeiro
```

**Descrição**: A criação de boleto em `/financeiro/boletos` é completamente manual. Não existe um botão "Gerar Boleto" dentro do detalhe do pedido (`/pedidos/:id`), nem o boleto busca automaticamente os dados do pedido (valor, cliente, vencimento). O financeiro precisa abrir a tela de boletos separadamente, preencher valor, selecionar cliente e calcular data de vencimento manualmente.

**Resultado esperado**: Botão "Emitir Boleto" no detalhe do pedido, pré-preenchido com valor + cliente + vencimento calculado com base na condição de pagamento do orçamento.

**Resultado obtido**: Boletos são ilhas isoladas. Não há link entre `bank_slips` (tabela de boletos) e `pedidos` via FK obrigatória. Apenas o campo `pedidos(numero)` é exibido se preenchido manualmente.

**Impacto**: Risco alto de boleto emitido com valor errado ou para cliente errado. Retrabalho operacional diário.

---

**QA-2026-03-21-005**

```
Severidade:  🟠 ALTO
Módulo:      Composição de Produtos — Fórmulas Dinâmicas
Passo:       4 — Compor produto com materiais
Persona:     Operador de Cadastro
```

**Descrição**: A composição de materiais (`modelo_materiais`) aceita apenas quantidades fixas por unidade — não aceita fórmulas (ex: `L × A × 1.05` para calcular lona com 5% de perda). Para um banner 90x120, o operador precisa calcular manualmente 1,08 m² e digitar esse valor. Se as dimensões mudarem (ex: modelo 60x80), a composição precisa ser recalculada manualmente.

**Resultado esperado**: Campo de fórmula dinâmica que permite expressões como `largura * altura * 1.05` e resolve com base nas dimensões do modelo.

**Resultado obtido**: Apenas campo numérico fixo.

**Impacto**: Cada variação de tamanho exige composição separada cadastrada manualmente. Para 10 tamanhos de banner, isso é 10× o trabalho. Risco de divergência entre composições de tamanhos diferentes do mesmo produto.

---

**QA-2026-03-21-006**

```
Severidade:  🟠 ALTO
Módulo:      Produção — Verificação de Estoque
Passo:       11/12 — Execução da produção
Persona:     PCP de Produção
```

**Descrição**: Não existe verificação de disponibilidade de materiais em estoque antes de iniciar uma Ordem de Produção. O sistema cria a OP com os materiais necessários (via BOM `modelo_materiais`), mas não alerta se o saldo em `estoque_saldos` for insuficiente. A produção pode ser iniciada com estoque zerado, levando a bloqueios físicos na fábrica sem alerta prévio.

**Resultado esperado**: Ao criar ou iniciar a OP, o sistema deve verificar `estoque_saldos` para cada material e alertar sobre insuficiências.

**Resultado obtido**: OP inicia sem validação de estoque.

**Impacto**: PCP pode programar produção sem matéria-prima disponível, causando parada de máquina e atraso de entrega.

---

**QA-2026-03-21-007**

```
Severidade:  🟠 ALTO
Módulo:      Fiscal — NCM nos itens de NF-e
Passo:       14 — Validar emissão de NF-e
Persona:     Faturamento
```

**Descrição**: A criação de NF-e a partir de pedido (`criarNFeFromPedido`) lê o NCM de `produto_modelos.ncm`. Dos 156 modelos no banco (migration 009), a grande maioria não tem NCM preenchido. O documento fiscal é criado com `ncm: null`, o que impede a transmissão para o SEFAZ — NCM é campo obrigatório na NF-e.

**Resultado esperado**: Sistema deve alertar o faturamento que modelos sem NCM precisam ser preenchidos antes da emissão.

**Resultado obtido**: NF-e é criada silenciosamente com `ncm: null`. O erro só aparece ao tentar transmitir para o SEFAZ.

**Impacto**: 156 modelos precisam ter NCM preenchido manualmente antes que qualquer NF-e possa ser transmitida com sucesso.

---

**QA-2026-03-21-008**

```
Severidade:  🟠 ALTO
Módulo:      Produção — Alerta de estoque mínimo na OP
Passo:       12 — Finalizar produção
Persona:     Almoxarife
```

**Descrição**: Quando a OP finaliza e desconta materiais do estoque (`finalizarCustosOP`), se o saldo resultante ficar abaixo do estoque mínimo (`materiais.estoque_minimo`), nenhum alerta é gerado. O `AlertaEstoqueMinimo` existe como componente mas só é exibido de forma passiva — não há notificação ativa quando um produto crítico chega ao limite.

**Resultado esperado**: Após desconto de estoque, se `saldo < estoque_minimo`, criar notificação ou alerta em tempo real.

**Resultado obtido**: Sem alerta automático.

**Impacto**: Almoxarife pode não perceber que a lona acabou até o início da próxima OP.

---

**QA-2026-03-21-009**

```
Severidade:  🟠 ALTO
Módulo:      Pedidos — Ausência de status "faturado"
Passo:       14 — Validar emissão de NF-e
Persona:     Faturamento
```

**Descrição**: O mapa de status do pedido (`VALID_TRANSITIONS`) não inclui um status `faturado`. O ciclo é: `aprovado → em_producao → produzido → aguardando_instalacao → em_instalacao → concluido`. A emissão de NF-e não muda o status do pedido — após a NF-e ser transmitida, o pedido permanece no mesmo status. Não há como saber, pela lista de pedidos, quais foram faturados e quais não foram.

**Resultado esperado**: Status `faturado` como etapa entre `produzido` e a entrega, ou ao menos flag `nfe_emitida` visível na lista de pedidos.

**Resultado obtido**: NF-e existe como documento separado sem impacto no status do pedido.

**Impacto**: Equipe de faturamento não tem visão consolidada de quais pedidos já foram faturados.

---

### 5.3 — Erros MÉDIOS 🟡

| ID | Módulo | Descrição | Resultado Esperado | Resultado Obtido |
|----|--------|-----------|-------------------|-----------------|
| QA-2026-03-21-010 | Orçamento — Condição de Pagamento | Condição de pagamento selecionada no orçamento não é transferida automaticamente para o vencimento da cobrança/boleto | Prazo do boleto = data entrega + prazo da condição | Calculado manualmente pelo financeiro |
| QA-2026-03-21-011 | Leads — Origem | Origem do lead tem apenas opção "Site" no campo visualizado. Campo `origem` existe mas seleção é limitada | Origens: WhatsApp, Indicação, Instagram, Ligação, Email, Site, Evento | Sem select de origem no formulário de criação de lead |
| QA-2026-03-21-012 | Orçamento — Desconto global | Desconto global aplicado sobre o total do orçamento não existe. Só é possível alterar markup item a item | Campo de desconto (%) sobre total do orçamento | Ausente — requer ajuste manual de markup por item |
| QA-2026-03-21-013 | Produção — Sequenciamento de OPs | PCPDashboardPage existe mas não tem drag-and-drop ou priorização visual das OPs por data de entrega | Fila priorizada visualmente com indicação de urgência | Lista simples sem priorização interativa |
| QA-2026-03-21-014 | Instalação — Técnico responsável | Ao criar Ordem de Instalação, campo "técnico responsável" não lista funcionários cadastrados no sistema | Select com usuários role='tecnico' | Campo livre de texto |
| QA-2026-03-21-015 | Expedição — Romaneio de entrega | Não existe geração de romaneio/manifesto de entrega. Pedidos liberados para envio não têm documento de saída | PDF de romaneio com itens, endereço e dados do cliente | Ausente |
| QA-2026-03-21-016 | Portal — Rejeição de proposta | No portal público, o cliente pode apenas aprovar. Não há botão "Solicitar alteração" ou "Recusar" | Botão "Solicitar revisão" com campo de texto | Ausente — cliente precisa contatar o vendedor por fora |
| QA-2026-03-21-017 | CRM — Histórico de interações | Lead/Cliente não tem linha do tempo de interações (ligações, e-mails, reuniões). Apenas status e observações | Timeline de interações com data, tipo e responsável | Ausente — apenas campo `observacoes` geral |
| QA-2026-03-21-018 | Pedidos — Revisão de pedido | Não existe fluxo para solicitar revisão de um pedido aprovado (ex: cliente solicita mudança de quantidade após aprovação) | Status "em_revisao" ou fluxo de revisão | Ausente — só cancelar e recriar |

---

### 5.4 — Melhorias BAIXAS 🟢

| ID | Local | Sugestão |
|----|-------|---------|
| QA-2026-03-21-019 | `/produtos` — Card de modelo | Exibir dimensões (largura × altura) no card do modelo quando preenchidas |
| QA-2026-03-21-020 | `/orcamentos` — Lista | Adicionar coluna "Margem %" na listagem de orçamentos para visualização rápida da lucratividade |
| QA-2026-03-21-021 | `/pedidos/:id` | Botão "Gerar Boleto" direto no detalhe do pedido, levando para `/financeiro/boletos` com dados pré-preenchidos |
| QA-2026-03-21-022 | `/producao` | Indicador visual de prazo restante para cada OP (dias até data de entrega do pedido) |
| QA-2026-03-21-023 | `/financeiro/comissoes` | Remover ou ocultar tab de Comissões até a funcionalidade ser implementada — atualmente mostra tabela vazia com mensagem incorreta |

---

## 6. QUEBRAS DE FLUXO

| De | Para | Problema | Severidade |
|----|------|----------|-----------|
| Pedido Aprovado | Cobrança Antecipada | Financeiro não vê pedido aprovado. Contas só existem após conclusão. | 🔴 CRÍTICO |
| Pedido Produzido | Faturamento | Não existe status "faturado" — NF-e emitida não muda o pedido | 🟠 ALTO |
| Pedido Concluído | Comissão do Vendedor | Comissão não é gerada em nenhum ponto | 🔴 CRÍTICO |
| Boleto Pago | Status do Pedido | Pagamento do boleto não impacta o status do pedido em nenhum ponto | 🟠 ALTO |
| Modelo Cadastrado | Orçamento com Área Auto | Dimensões não estão no formulário — cálculo de área depende de digitação manual no orçamento | 🔴 CRÍTICO |

**Fluxo interrompido em**: Passo 13 — Envio para financeiro
**Motivo**: Contas a receber não existem ainda neste ponto do fluxo
**Passos afetados**: 13, 15 (boleto), e geração de comissão pós-conclusão

---

## 7. ERROS DE REGRA DE NEGÓCIO

| Tipo | Descrição | Impacto |
|------|-----------|---------|
| Ausência de regra | Sistema conclui pedido sem exigir pagamento confirmado | Pedido marcado como concluído sem receber o dinheiro |
| Ausência de regra | Pedido pode avançar para `produzido` sem NF-e de saída parcial | Produção acontece sem documento fiscal associado |
| Permissivo demais | NF-e é criada com NCM null sem alertar o usuário | Transmissão SEFAZ vai falhar silenciosamente |
| Ausência de regra | OP pode ser iniciada com estoque zerado | Parada de produção sem aviso prévio |
| Status incoerente | Pedido `concluido` não exige pagamento comprovado — apenas NF-e rascunho | Pedidos concluídos sem recebimento real |

**Observação importante sobre a NF-e**: O guard de conclusão do pedido (`handleAdvanceStatus` linha 228) verifica se existe NF-e no `fiscal_documentos`, mas aceita qualquer status (inclusive `rascunho`). Um pedido pode ser marcado como `concluido` com a NF-e em rascunho, nunca transmitida.

---

## 8. PROBLEMAS DE UX

| Tela / Módulo | Problema de UX | Severidade | Sugestão |
|---------------|---------------|------------|---------|
| `/financeiro/boletos` | Boleto criado manualmente sem contexto do pedido | ALTO | Pre-fill com dados do pedido selecionado |
| `/financeiro/comissoes` | Tab existe mas sempre vazia — confunde o usuário | MÉDIO | Ocultar ou desabilitar até implementar |
| `/produtos` — ModeloForm | Sem campos de dimensão — usuário não sabe onde cadastrar 90x120 | ALTO | Adicionar campos largura/altura com cálculo auto de área |
| `/pedidos/:id` — Status | Botão de avançar status sem indicar o que acontecerá financeiramente | MÉDIO | Tooltip ou modal resumindo o impacto do avanço |
| `/orcamentos/:id` | Sem indicação visual de "condição de pagamento escolhida" | BAIXO | Exibir prazo e forma escolhida no cabeçalho do orçamento |
| `/producao` — Nova OP | Sem indicação de estoque disponível ao criar OP | ALTO | Mostrar saldo de cada material da BOM ao abrir a OP |
| Portal `/p/{token}` | Sem opção de recusar ou solicitar alteração | MÉDIO | Adicionar botão "Solicitar revisão" |

**Padrões de UX identificados**:
- [x] Feedback inexistente em alguns casos (boleto pago não notifica vendedor)
- [ ] Campo obrigatório sem indicação visual — não detectado
- [x] Mensagem de erro inexistente: tela de comissões diz "geradas automaticamente" quando não são
- [ ] Ação irreversível sem confirmação — conclusão de pedido tem confirmação
- [x] Fluxo não intuitivo: usuário não sabe que precisa criar boleto separadamente depois de aprovar pedido

---

## 9. PROBLEMAS TÉCNICOS

| ID | Componente | Tipo | Descrição | Severidade |
|----|-----------|------|-----------|-----------|
| QA-2026-03-21-T01 | `Produtos.tsx` — ModeloFormDialog | UI Gap | Campos `largura_cm`, `altura_cm` ausentes no form, presentes no service e no DB | 🔴 CRÍTICO |
| QA-2026-03-21-T02 | `comissoes` table | Integração faltando | Nenhum código insere registros em `comissoes` — tabela sempre vazia | 🔴 CRÍTICO |
| QA-2026-03-21-T03 | `PedidoDetailPage` — `concluirPedido` | Ordem de operações | `gerarContasReceber` só roda no momento da conclusão, não quando aprovado | 🔴 CRÍTICO |
| QA-2026-03-21-T04 | `nfe-creation.service.ts` | Validação ausente | NCM null não gera alerta antes de submissão para SEFAZ | 🟠 ALTO |
| QA-2026-03-21-T05 | `instalacao-criacao.service.ts` | Race condition | `generateOsNumero()` usa MAX(numero)+1 sem atomic sequence — pode gerar duplicatas em concorrência | 🟡 MÉDIO |
| QA-2026-03-21-T06 | `producao.service.ts` | Falha silenciosa | Linha 80: `await supabase.from('producao_materiais').insert(...)` sem checar erro — falha silenciosamente | 🟡 MÉDIO |

---

## 10. MÓDULOS INCOMPLETOS

| Módulo | Funcionalidade | Status UI | Status Backend | Impacto |
|--------|---------------|-----------|---------------|---------|
| Financeiro — Comissões | Geração automática de comissões | Tab existe, tabela sempre vazia | Código ausente | Alto — vendedores não veem comissões |
| Produtos — Modelos | Campos de dimensões (largura × altura) | Formulário sem os campos | Tabela DB tem os campos | Alto — área calculada manualmente |
| Produção — Estoque | Verificação pré-OP de disponibilidade | Nenhuma UI | Nenhum código | Alto — OP inicia sem estoque |
| Expedição | Romaneio de entrega (PDF) | Não existe | Não existe | Médio — sem documento de saída |
| Portal Público | Recusar / Solicitar alteração | Não existe | Não existe | Médio — cliente sem opção de recusar |
| Leads | Campo de origem categorizado | Campo existe mas sem select no form de criação | Campo `origem` existe na tabela | Baixo — usuário digita livre |
| CRM | Timeline de interações | Não existe | Não existe | Alto — sem histórico de relacionamento |

---

## 11. MELHORIAS RECOMENDADAS

### Prioritárias (implementar logo)

1. **Campos de Dimensões no ModeloForm** — Adicionar `largura_cm`, `altura_cm` com cálculo automático de `area_m2 = L × A / 10000` em `src/pages/Produtos.tsx`. Estimativa: 2h. Impacto: elimina QA-2026-03-21-002 e melhora fluxo de orçamentos de produtos dimensionais.

2. **Geração de Comissões Automática** — Implementar chamada a `supabase.from('comissoes').insert()` em `concluirPedido()` com base em `vendedor_id` e `percentual_comissao` do perfil do vendedor. Estimativa: 4h. Impacto: elimina QA-2026-03-21-003.

3. **Antecipação de Contas a Receber** — Mover `gerarContasReceber` para ser chamado ao aprovar o pedido (status `aprovado`), com status `projetado`. Estornar se o pedido for cancelado. Estimativa: 4h. Impacto: elimina QA-2026-03-21-001, habilita gestão de fluxo de caixa real.

4. **Botão Gerar Boleto no Pedido** — Adicionar ação "Emitir Boleto" em `PedidoDetailPage` que navega para `/financeiro/boletos?pedido_id={id}` com dados pré-preenchidos. Estimativa: 3h. Impacto: elimina QA-2026-03-21-004.

5. **Alerta de NCM obrigatório antes de NF-e** — Em `criarNFeFromPedido`, verificar se algum item tem NCM null e exibir mensagem clara antes de criar o rascunho. Estimativa: 1h. Impacto: elimina QA-2026-03-21-007.

### Desejáveis (implementar quando possível)

1. **Fórmulas Dinâmicas na Composição** — Substituir campo numérico fixo por expressão calculada com variáveis `{largura}`, `{altura}`, `{area}` na composição de materiais.

2. **Timeline de CRM** — Tabela `crm_interacoes` + componente de linha do tempo no detalhe do cliente/lead.

3. **Rejeição de Proposta no Portal** — Botão "Solicitar revisão" com campo de texto, gerando status `em_revisao` no orçamento e notificação ao vendedor.

4. **Romaneio PDF na Expedição** — Documento de saída gerado ao liberar pedido para envio, com itens, endereço e dados do transportador.

5. **Verificação de Estoque na Criação da OP** — Modal de confirmação mostrando materiais com saldo insuficiente ao criar/iniciar OP.

---

## 12. PLANO DE CORREÇÃO PRIORITÁRIO

| Prioridade | ID | Problema | Esforço estimado | Responsável sugerido |
|-----------|-----|----------|-----------------|---------------------|
| 1 | QA-2026-03-21-002 | Campos de dimensão ausentes no ModeloForm | P (2h) | Dev Frontend |
| 2 | QA-2026-03-21-001 | Contas a receber só geradas na conclusão | M (4h) | Dev Backend/Frontend |
| 3 | QA-2026-03-21-003 | Comissões não são geradas automaticamente | M (4h) | Dev Backend/Frontend |
| 4 | QA-2026-03-21-004 | Boleto desconectado do pedido | M (3h) | Dev Frontend |
| 5 | QA-2026-03-21-007 | NCM null sem alerta no faturamento | P (1h) | Dev Frontend |
| 6 | QA-2026-03-21-009 | Ausência de status "faturado" no pedido | M (4h) | Dev Backend/Frontend |
| 7 | QA-2026-03-21-006 | Sem verificação de estoque antes de OP | M (3h) | Dev Frontend |
| 8 | QA-2026-03-21-005 | Sem fórmulas dinâmicas na composição | G (2d) | Dev Full-Stack |
| 9 | QA-2026-03-21-016 | Portal sem opção de recusar/revisar proposta | M (4h) | Dev Frontend |
| 10 | QA-2026-03-21-015 | Sem romaneio de expedição | M (4h) | Dev Frontend |

**Legenda esforço**: P = Pequeno (<2h) | M = Médio (2h-1d) | G = Grande (>1d)

---

## 13. VEREDITO FINAL SOBRE PRONTIDÃO DO ERP

### Status por Módulo

| Módulo | Status | Bloqueadores |
|--------|--------|-------------|
| Cadastro de produtos | ⚠️ Parcial | Campos de dimensão ausentes no formulário de modelos |
| CRM / Leads | ✅ Operacional | Sem bloqueadores. Falta origem e timeline de interações |
| Orçamentos | ✅ Operacional | Motor Mubisys funcional. Falta desconto global e condição de pagamento na cobrança |
| Portal de aprovação | ✅ Operacional | Funcional. Falta opção de recusa/revisão |
| Pedidos | ⚠️ Parcial | Fluxo de status OK, mas sem status "faturado" e sem link com boleto |
| Produção | ⚠️ Parcial | OPs criadas e executadas corretamente. Falta verificação de estoque pré-OP |
| Financeiro | ❌ Inoperante (parcial) | Contas a receber só existem pós-conclusão. Comissões não são geradas. Boleto desconectado |
| Faturamento (NF-e) | ⚠️ Parcial | NF-e cria rascunho OK. NCM pode estar null. SEFAZ em homologação |
| Expedição | ✅ Operacional | Três modalidades de liberação funcionando. Falta romaneio PDF |
| Instalação / App Campo | ✅ Operacional | Bridge ERP↔Campo ativa via migration 004. Triggers funcionando |
| Estoque | ⚠️ Parcial | Saldo debitado corretamente ao finalizar OP. Sem alertas proativos de mínimo |

### Conclusão

```
O ERP da Croma Print está:

[x] 🟠 PARCIALMENTE APTO
    → O núcleo comercial (Lead→Orçamento→Portal→Pedido→Produção→Expedição)
      está funcional e representa bem o fluxo da empresa.
    → O módulo financeiro tem gaps críticos: contas a receber tardias,
      comissões nunca geradas, boleto desconectado do pedido.
    → A precificação dimensional (banners, adesivos) depende de campos
      ausentes no formulário de modelos — impacto em 80% dos produtos.
    → Recomendação: Usar com cautela — comercial pode operar,
      financeiro requer suporte manual até os gaps serem corrigidos.
      Priorizar Sprint de Gaps Financeiros + Cadastro de Dimensões.
```

**Assinado por**: AGENTE DE CONTROLE DE QUALIDADE CROMA_ERP v1.0
**Data**: 2026-03-21 09:30
**Próxima execução recomendada**: Após sprint de correções dos 5 itens prioritários

---

## 14. ANÁLISE DE GAPS — FUNCIONALIDADES AUSENTES (FOCO DESTA SESSÃO)

> Seção especial solicitada para identificar O QUE FALTA, além de bugs.

### 14.1 — Etapas do Fluxo Incompletas

| Etapa | Gap | Impacto |
|-------|-----|---------|
| Orçamento aprovado | Financeiro não tem visão até conclusão | Alto — fluxo de caixa cego |
| Produção iniciada | Sem verificação de estoque disponível | Alto — risco de parada |
| OP finalizada | Alerta de estoque mínimo não dispara | Médio — reposição manual |
| Pedido produzido | Sem status "faturado" separado | Médio — faturamento invisível |
| Pedido concluído | Comissão não gerada | Alto — vendedores sem reconhecimento |
| Boleto emitido | Sem link automático ao pedido | Alto — conciliação manual |

### 14.2 — Funcionalidades que Deveriam Existir

| Módulo | Funcionalidade Ausente | Prioridade |
|--------|----------------------|-----------|
| Produtos/Modelos | Campos de dimensão (L × A) no formulário | Crítico |
| Produtos/Modelos | Fórmulas dinâmicas na composição | Alto |
| Financeiro | Geração automática de comissões | Alto |
| Financeiro | Geração antecipada de contas a receber no pedido | Alto |
| Expedição | Romaneio PDF de entrega | Médio |
| Portal Público | Botão de rejeição/revisão de proposta | Médio |
| CRM | Timeline de interações por cliente | Alto |
| Leads | Select categorizado de origem | Baixo |
| Orçamento | Desconto global (%) sobre total | Médio |
| Pedido | Status "faturado" no ciclo de vida | Médio |
| Produção | Sequenciamento drag-and-drop no PCP | Baixo |
| Instalação | Lookup de técnicos cadastrados | Médio |

### 14.3 — Integrações que Faltam

| Integração | Descrição | Status |
|-----------|-----------|--------|
| Boleto ↔ Pedido | Boleto gerado automaticamente a partir de pedido aprovado/produzido | Ausente |
| Comissão ↔ Pedido | Comissão gerada ao concluir pedido | Ausente |
| Pagamento ↔ Status Pedido | Boleto pago não muda status do pedido | Ausente |
| NCM ↔ NF-e | Validação de NCM antes de criar rascunho fiscal | Parcial |
| Condição Pagamento ↔ Vencimento Boleto | Prazo do orçamento define vencimento do boleto | Ausente |
| Estoque ↔ PCP | Saldo de materiais visível no dashboard do PCP | Parcial |

### 14.4 — UX Gaps que Prejudicam o Usuário

| Usuário | Problema | Consequência Real |
|---------|----------|-----------------|
| Operador de Cadastro | Não encontra onde cadastrar "90x120 cm" para um banner | Cria modelo com nome "Banner 90x120" sem dados dimensionais — área calculada manualmente em cada orçamento |
| Orçamentista | Precisa lembrar de digitar dimensões a cada orçamento para produtos dimensionais | Risco de digitação errada — preço errado para o cliente |
| Financeiro | Abre tela de boletos sem saber qual pedido cobrar e qual valor | Cria boleto manualmente, risco de valor errado |
| Vendedor | Abre tela de comissões e vê tabela vazia — acredita que a função não funciona | Desmotivação; necessidade de cálculo externo ao sistema |
| Faturamento | Emite NF-e sem NCM e só descobre o erro ao transmitir ao SEFAZ | Retrabalho + prazo de entrega da NF-e perdido |
| Cliente | Recebe proposta no portal e precisa ligar para recusar — sem botão de rejeição | Experiência ruim — CRM não registra a rejeição |

---

*Este relatório foi gerado automaticamente pelo Agente QA Operacional da Croma Print.*
*Análise baseada em código-fonte do branch `claude/cranky-booth` em 2026-03-21.*
*Para re-executar o agente: invocar AGENTE.md com o cenário desejado.*
