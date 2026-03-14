# RELATORIO DE QA OPERACIONAL -- AUDITORIA EXTREMA -- CROMA_ERP
## Execucao: 2026-03-14

---

## 1. RESUMO EXECUTIVO

```
Data/Hora:          2026-03-14
Cenario executado:  Banner-Teste -- Fluxo Completo + Blocos Expandidos (2,3,5,10)
Passos totais:      17 (cenario padrao) + blocos expandidos
Passos executados:  17
Passos com sucesso: 8
Passos com falha:   5
Passos parciais:    4
Taxa de sucesso:    47%

Erros encontrados:
  CRITICO: 5
  ALTO:    11
  MEDIO:   9
  BAIXO:   6
  ----------
  TOTAL:   31
```

### Veredito de Prontidao

```
[X] PARCIALMENTE APTO -- Funciona com restricoes serias
```

**Justificativa do veredito**:
O fluxo principal Lead-a-Orcamento funciona com ressalvas, mas a precificacao depende de materiais corretamente vinculados aos modelos. Os modulos de producao, financeiro e instalacao funcionam individualmente mas carecem de validacoes de regra de negocio, controle de concorrencia e guards de transicao de status. Pedidos cancelados continuam impactando totais e nao ha lock otimista em nenhum ponto do sistema.

---

## 2. DESCRICAO DO FLUXO EXECUTADO

### Personas ativas nesta execucao:
- [x] Vendedor
- [x] Orcamentista
- [x] Operador de Cadastro
- [x] PCP de Producao
- [x] Operador de Producao
- [x] Financeiro
- [x] Faturamento
- [x] Expedicao
- [x] Coordenador de Instalacao

### Modulos do sistema acessados:
CRM/Leads, Clientes, Orcamentos (editor v3), Pedidos (detalhe), Producao (Kanban), Financeiro (boletos, contas a receber), Fiscal (NF-e), Instalacao, Portal Publico, Admin (materiais, produtos, precificacao)

---

## 3. DADOS GERADOS PELO TESTE

```
Cliente ficticio:    Papelaria Sao Lucas Ltda
CNPJ:               34.567.890/0001-12
Produto testado:    Banner-Teste
Variacao:           Banner 90x120
Quantidade:         10 unidades

Valores calculados:
  Custo unitario:   R$ 43,21 (referencia)
  Markup (3.5x):    aplicado se modelo_materiais populado
  Preco de venda:   R$ 151,24 (referencia)
  Total do pedido:  R$ 1.512,40 (referencia)
```

---

## 4. RESULTADO POR PASSO

| # | Passo | Persona | Status | Observacao |
|---|-------|---------|--------|------------|
| 1 | Cadastrar materia-prima | Operador de Cadastro | OK | Materiais ja existem (467 no banco). Formulario funcional em /admin/materiais |
| 2 | Criar produto Banner-Teste | Operador de Cadastro | OK | Produtos cadastraveis via /admin/produtos. 156 ja existem |
| 3 | Criar variacoes de tamanho | Operador de Cadastro | OK | Modelos com dimensoes (largura_cm, altura_cm) funcionam. area_m2 nao e calculada automaticamente no banco |
| 4 | Compor produto com materiais | Operador de Cadastro | PARCIAL | modelo_materiais: 321 registros. modelo_processos: 362. Composicao funciona, mas nao ha calculo automatico de area integrado |
| 5 | Gerar lead ficticio | Vendedor | OK | Lead CRUD completo e funcional |
| 6 | Converter lead em cliente | Vendedor | PARCIAL | Conversao funciona mas CNPJ nao e validado, dados parciais migram |
| 7 | Gerar orcamento | Orcamentista | PARCIAL | Editor v3 funciona com wizard 3 etapas. Preco calculado se materiais presentes. Validacoes de borda ausentes |
| 8 | Enviar orcamento por link | Orcamentista | OK | Portal /p/:token funciona. SharePropostaModal gera link |
| 9 | Simular aprovacao do cliente | Cliente | OK | portal_aprovar_proposta RPC existe e funciona |
| 10 | Gerar pedido | Vendedor | OK | converterParaPedido valida itens > 0 e total > 0. Pedido criado com itens |
| 11 | Executar fluxo de producao | PCP | FALHA | OP criada via criarOrdemProducao, mas numero gerado com Math.random() causa colisoes potenciais |
| 12 | Finalizar producao | Operador | PARCIAL | Custo real = custo estimado (placeholder). Sem apontamento real |
| 13 | Enviar para financeiro | PCP | FALHA | gerarContasReceber so e chamado no status "concluido", nao integra automaticamente |
| 14 | Validar emissao NF-e | Faturamento | FALHA | criarNFeFromPedido cria rascunho sem itens detalhados, sem impostos calculados |
| 15 | Validar emissao de boleto | Financeiro | OK | Boleto CRUD com transicoes de status validadas (boleto.service.ts) |
| 16 | Liberar para entrega | Expedicao | FALHA | Nao ha modulo de expedicao dedicado. PedidoDetailPage avanca status mas sem validacao de pagamento |
| 17 | Validar integracao App de Campo | Coord. Instalacao | FALHA | Migration 004 NAO executada. Bridge ERP-Campo nao funciona. Views vw_campo_instalacoes usam `as any` |

---

## 5. PROBLEMAS IDENTIFICADOS

### 5.1 -- Erros CRITICOS

---

**AE-001**

```
Severidade:  CRITICO
Modulo:      Producao
Passo:       11 -- Criar OP
Persona:     PCP
```

**Descricao**:
O numero da Ordem de Producao e gerado com `Math.random()` em `generateOpNumero()`. Isso pode gerar numeros duplicados, causando erro de unicidade no banco ou OPs com numeros repetidos.

**Passos para reproduzir**:
1. Criar multiplos pedidos simultaneamente
2. Cada um gera OP via `criarOrdemProducao()`
3. `Math.floor(Math.random() * 9999) + 1` pode colidir

**Resultado esperado**: Numero sequencial unico (como o orcamento usa COUNT + 1)
**Resultado obtido**: Numero aleatorio com probabilidade de colisao

**Causa provavel**: `producao.service.ts` linha 6-9 -- `generateOpNumero()` usa Math.random() ao inves de sequencia atomica

**Impacto no negocio**: Duas OPs podem ter o mesmo numero. Falha ao inserir ou OPs confundidas na operacao.

**Correcao recomendada**: Usar COUNT atomico ou sequencia do banco (como `next_nosso_numero` faz para boletos)
**Prioridade**: Sprint 1

---

**AE-002**

```
Severidade:  CRITICO
Modulo:      Instalacao / App de Campo
Passo:       17 -- Integracao ERP-Campo
Persona:     Coordenador de Instalacao
```

**Descricao**:
A migration 004 (`004_integracao_bridge.sql`) NAO foi executada no banco. As views `vw_campo_instalacoes` e `vw_campo_fotos` podem nao existir. O service `instalacao.service.ts` usa `as any` para forcar tipagem, mascarando o problema. Os triggers `fn_create_job_from_ordem` e `fn_sync_job_to_ordem` nao existem.

**Resultado esperado**: Bridge ERP-Campo bidirecional funcionando
**Resultado obtido**: Servicos referenciam views/triggers inexistentes. `as any` esconde erros de compilacao.

**Causa provavel**: Migration 004 nunca foi executada. `instalacao.service.ts` linhas 74, 89, 105 usam `as any`.

**Impacto no negocio**: Toda a integracao com App de Campo esta inoperante. Ordens de instalacao nao criam jobs automaticamente. Tecnico em campo nao recebe tarefas.

**Correcao recomendada**: Executar migration 004 e remover casts `as any` dos services
**Prioridade**: Sprint 1

---

**AE-003**

```
Severidade:  CRITICO
Modulo:      Instalacao
Passo:       17 -- Criar OI
Persona:     Coordenador de Instalacao
```

**Descricao**:
A funcao `generateOsNumero()` em `instalacao-criacao.service.ts` tambem usa `Math.random()` para gerar o numero da OS, com o mesmo problema de colisao do AE-001.

**Resultado esperado**: Numero sequencial unico
**Resultado obtido**: Numero aleatorio colisionavel

**Causa provavel**: `instalacao-criacao.service.ts` linha 3-6

**Impacto no negocio**: Ordens de Instalacao com numeros duplicados

**Correcao recomendada**: Usar sequencia atomica do banco
**Prioridade**: Sprint 1

---

**AE-004**

```
Severidade:  CRITICO
Modulo:      Pedidos / Fluxo
Passo:       Bloco 3 -- Regras de Negocio
Persona:     Qualquer
```

**Descricao**:
O `PedidoDetailPage.tsx` permite avancar o status do pedido em qualquer direcao sem validacao de pre-condicoes. O mapa `FLOW_ACTIONS` define transicoes lineares, mas o `handleAdvanceStatus` NAO valida se o pedido realmente atende as condicoes para avancar (ex: pedido pode ser marcado "concluido" sem ter NF-e emitida, sem pagamento confirmado, sem producao finalizada).

**Passos para reproduzir**:
1. Abrir pedido em status "em_producao"
2. Clicar "Marcar Produzido" -- funciona sem verificar se OP foi concluida
3. Clicar "Aguardar Instalacao" -- funciona sem NF-e
4. Clicar "Concluir Pedido" -- funciona sem pagamento

**Resultado esperado**: Sistema impede avancos sem pre-condicoes atendidas
**Resultado obtido**: Qualquer status pode ser avancado livremente, pulando etapas obrigatorias

**Causa provavel**: `PedidoDetailPage.tsx` linhas 73-85 -- `handleAdvanceStatus` apenas chama `updatePedido.mutate` sem guards

**Impacto no negocio**: Pedido pode ser dado como concluido sem producao, sem pagamento, sem NF-e. Perda financeira potencial, inconsistencia contabil.

**Correcao recomendada**: Implementar guards de transicao: verificar OP concluida antes de "produzido", NF-e emitida antes de "concluido", pagamento antes de liberar
**Prioridade**: Sprint 1

---

**AE-005**

```
Severidade:  CRITICO
Modulo:      Financeiro / Pedidos
Passo:       Bloco 3 -- Regras de Negocio
Persona:     Financeiro
```

**Descricao**:
`gerarContasReceber()` so e chamada quando pedido avanca para status "concluido" (`PedidoDetailPage.tsx` linha 81). Nao e chamada em nenhum outro momento do fluxo. Se o operador avanca o pedido para "concluido" mas a chamada falha (catch no `.catch()`), a conta a receber nao e criada e o erro e silenciosamente ignorado.

**Passos para reproduzir**:
1. Avancar pedido para "concluido"
2. Se `gerarContasReceber` falhar por qualquer motivo (RLS, tabela, rede)
3. Pedido fica "concluido" sem conta a receber

**Resultado esperado**: Conta a receber sempre criada, ou pedido nao avanca
**Resultado obtido**: Erro silenciado com `.catch()` -- pedido avanca sem conta a receber

**Causa provavel**: `PedidoDetailPage.tsx` linha 81 -- `gerarContasReceber(id).catch(...)` nao reverte o status

**Impacto no negocio**: Pedido concluido sem cobranca. Receita perdida.

**Correcao recomendada**: Executar `gerarContasReceber` ANTES de atualizar status, dentro de uma transacao logica. Reverter status se falhar.
**Prioridade**: Sprint 1

---

### 5.2 -- Erros ALTOS

---

**AE-006**

```
Severidade:  ALTO
Modulo:      Orcamentos
Passo:       Bloco 2 -- Validacao de entrada
```

**Descricao**: O campo `quantidade` no editor de orcamentos aceita qualquer valor numerico incluindo zero e negativos. Nao ha validacao `min` no HTML nem validacao logica antes de salvar. O campo usa `type="number"` mas sem `min="1"`.

**Resultado esperado**: Quantidade minima = 1, negativos bloqueados
**Resultado obtido**: Aceita 0, -1, valores absurdos

**Impacto**: Orcamento com quantidade 0 gera preco total R$ 0,00. Quantidade negativa gera valores negativos.

**Causa provavel**: `OrcamentoEditorPage.tsx` -- campo quantidade sem validacao `min`
**Prioridade**: Sprint 1

---

**AE-007**

```
Severidade:  ALTO
Modulo:      Orcamentos / Desconto
Passo:       Bloco 2 -- Desconto absurdo
```

**Descricao**: Embora o campo de desconto tenha `min={0} max={100}`, o HTML `max` nao impede valores acima de 100 digitados manualmente (copiar/colar, scroll). A validacao `validarDesconto` usa regras do banco mas NAO ha regra cadastrada por padrao -- o fallback e `desconto_maximo = 10`. Desconto acima de 10% e bloqueado no save, mas entre 0-10% um desconto grande pode gerar margem negativa sem alerta claro.

**Resultado esperado**: Desconto que gere valor negativo deve ser bloqueado
**Resultado obtido**: Desconto de 100% e bloqueado pela regra, mas a validacao depende de regras cadastradas no banco

**Impacto**: Se regras nao existirem no banco, fallback permite ate 10% sem aviso.
**Prioridade**: Sprint 2

---

**AE-008**

```
Severidade:  ALTO
Modulo:      Orcamentos
Passo:       Bloco 2 -- Alteracao apos aprovado
```

**Descricao**: O `orcamentoService.atualizar()` nao verifica o status antes de permitir alteracoes. Um orcamento com status "aprovada" pode ser editado (titulo, cliente, desconto) sem restricao. Nao ha guard que bloqueie edicao de orcamentos aprovados ou convertidos em pedido.

**Resultado esperado**: Orcamento aprovado nao pode ser editado sem gerar nova versao
**Resultado obtido**: Orcamento aprovado pode ter titulo, cliente e desconto alterados livremente

**Causa provavel**: `orcamento.service.ts` linha 352-370 -- `atualizar()` nao valida status

**Impacto**: Alteracao silenciosa de orcamento ja aprovado pelo cliente. Pedido ja gerado ficaria com dados inconsistentes.
**Prioridade**: Sprint 1

---

**AE-009**

```
Severidade:  ALTO
Modulo:      Clientes / Leads
Passo:       6 -- Conversao Lead-Cliente
```

**Descricao**: A conversao de Lead para Cliente em `LeadDetailPage.tsx` (handleConverter) NAO valida CNPJ, NAO valida email, e nao transfere todos os dados relevantes. O `createCliente.mutateAsync` recebe apenas `razao_social`, `nome_fantasia`, `email`, `telefone`, `segmento` e `origem`. Endereco, CNPJ, IE ficam de fora. A conversao nao vincula o lead ao cliente criado (sem FK lead_id no cliente).

**Resultado esperado**: Dados completos migrados, CNPJ validado, vinculo lead-cliente mantido
**Resultado obtido**: Dados parciais, sem validacao, sem vinculo

**Causa provavel**: `LeadDetailPage.tsx` linhas 105-128

**Impacto**: Cliente criado sem CNPJ (necessario para NF-e). Lead e cliente sem vinculo rastreavel.
**Prioridade**: Sprint 1

---

**AE-010**

```
Severidade:  ALTO
Modulo:      Fiscal / NF-e
Passo:       14 -- Emissao NF-e
```

**Descricao**: `criarNFeFromPedido()` cria um documento fiscal com apenas `valor_total` e `valor_produtos`. NAO inclui itens detalhados do pedido (lista de produtos), NAO calcula impostos (ICMS, PIS, COFINS), NAO preenche dados fiscais do cliente (CNPJ, IE, endereco). O documento e apenas um rascunho vazio com o valor total.

**Resultado esperado**: NF-e com itens, impostos calculados, dados fiscais completos
**Resultado obtido**: NF-e rascunho com apenas valor_total e natureza_operacao

**Causa provavel**: `nfe-creation.service.ts` -- servico minimo, sem integracao com pedido_itens

**Impacto**: NF-e nao pode ser emitida na SEFAZ nesse estado. Requer preenchimento manual de todos os campos.
**Prioridade**: Sprint 2

---

**AE-011**

```
Severidade:  ALTO
Modulo:      Producao
Passo:       12 -- Finalizar Producao
```

**Descricao**: `finalizarCustosOP()` define `custo_mp_real = custo_mp_estimado` e `custo_mo_real = custo_mo_estimado`. Nao ha apontamento real de custos. O custo real nunca difere do estimado, tornando a margem_real sempre igual a margem estimada. Alem disso, finalizar OP nao atualiza automaticamente o status do pedido vinculado.

**Resultado esperado**: Apontamento de custo real; status do pedido atualizado ao concluir OP
**Resultado obtido**: Custo real = copia do estimado; pedido fica em "em_producao"

**Causa provavel**: `producao.service.ts` linhas 62-79

**Impacto**: Margem real nunca e calculada com dados reais. Pedido nao reflete conclusao de producao.
**Prioridade**: Sprint 2

---

**AE-012**

```
Severidade:  ALTO
Modulo:      Orcamentos
Passo:       Bloco 3 -- Orcamento reprovado
```

**Descricao**: Um orcamento com status "recusada" pode ser convertido em pedido via `converterParaPedido()` porque esta funcao NAO verifica o status do orcamento. Ela so valida se tem itens e total > 0, depois FORCE-SETS status para "aprovada".

**Resultado esperado**: Orcamento recusado nao pode virar pedido
**Resultado obtido**: `converterParaPedido` muda status de qualquer estado para "aprovada" e gera pedido

**Causa provavel**: `orcamento.service.ts` linhas 635-716 -- sem validacao de status antes da conversao

**Impacto**: Orcamento rejeitado pelo cliente pode ser convertido em pedido indevidamente.
**Prioridade**: Sprint 1

---

**AE-013**

```
Severidade:  ALTO
Modulo:      Pedidos
Passo:       Bloco 3 -- Pedido cancelado em relatorios
```

**Descricao**: `usePedidoStats()` filtra `excluido_em IS NULL` mas NAO exclui pedidos com status "cancelado" do calculo de `totalValor`. Pedidos cancelados continuam somando no valor total exibido no dashboard.

**Resultado esperado**: Pedidos cancelados excluidos dos totais financeiros
**Resultado obtido**: Valor de pedidos cancelados soma no total

**Causa provavel**: `usePedidos.ts` linhas 190-233 -- `usePedidoStats` nao filtra cancelados no totalValor

**Impacto**: Dashboard exibe receita inflada incluindo pedidos que nunca serao cobrados.
**Prioridade**: Sprint 1

---

**AE-014**

```
Severidade:  ALTO
Modulo:      Financeiro
Passo:       Bloco 3 -- Duplicacao de contas
```

**Descricao**: `gerarContasReceber()` nao verifica se ja existe uma conta a receber para o pedido antes de inserir. Se o pedido for avancado para "concluido" duas vezes (ex: bug, double-click), duas contas a receber serao criadas para o mesmo pedido, duplicando a cobranca.

**Resultado esperado**: Unica conta a receber por pedido (upsert ou check)
**Resultado obtido**: INSERT sem verificacao de duplicidade

**Causa provavel**: `financeiro-automation.service.ts` linhas 7-33

**Impacto**: Cobranca duplicada ao cliente. Receita duplicada no financeiro.
**Prioridade**: Sprint 1

---

**AE-015**

```
Severidade:  ALTO
Modulo:      Producao
Passo:       Bloco 3 -- Duplicacao de OP
```

**Descricao**: `criarOrdemProducao()` nao verifica se ja existem OPs para o pedido. A funcao `iniciarProducao` no `PedidoDetailPage.tsx` chama `criarOrdemProducao` apos atualizar status, mas se chamada multiplas vezes, cria OPs duplicadas. Nao ha constraint UNIQUE em (pedido_id, pedido_item_id) na tabela ordens_producao.

**Resultado esperado**: Uma OP por item de pedido
**Resultado obtido**: OPs duplicadas ao clicar multiplas vezes

**Causa provavel**: `producao.service.ts` sem check de existencia; `PedidoDetailPage.tsx` sem debounce

**Impacto**: Multiplas OPs para o mesmo pedido, confusao na producao.
**Prioridade**: Sprint 1

---

**AE-016**

```
Severidade:  ALTO
Modulo:      Pedidos / Producao
Passo:       Bloco 10 -- Cancelamento em producao
```

**Descricao**: Nao existe funcionalidade de cancelamento de pedido que esteja em producao. O `FLOW_ACTIONS` em `PedidoDetailPage.tsx` nao inclui acao de cancelamento em nenhum status. O tipo `PedidoStatus` inclui "cancelado" mas nao ha UI para acionar esse status. Se um item precisa ser cancelado no meio da producao, nao ha fluxo para isso.

**Resultado esperado**: Botao de cancelar com confirmacao, que cancele OP associada
**Resultado obtido**: Sem funcionalidade de cancelamento

**Causa provavel**: `PedidoDetailPage.tsx` -- FLOW_ACTIONS nao inclui transicao para "cancelado"

**Impacto**: Impossivel cancelar pedido ja em producao. Operacao travada.
**Prioridade**: Sprint 2

---

### 5.3 -- Erros MEDIOS

| ID | Modulo | Descricao | Resultado Esperado | Resultado Obtido |
|----|--------|-----------|-------------------|-----------------|
| AE-017 | Leads | Campos contato_email e contato_telefone sem validacao de formato | Email valido (regex), telefone formatado | Qualquer texto aceito |
| AE-018 | Leads | Valor estimado aceita negativos (input type="number" sem min) | Apenas valores >= 0 | Aceita -1000 |
| AE-019 | Orcamentos | area_m2 no modelo nao e calculada automaticamente pelo banco (largura_cm x altura_cm / 10000) | Area calculada por trigger/computed | Calculada apenas no frontend |
| AE-020 | Orcamentos | Ao editar orcamento existente, itens ja adicionados nao exibem seus materiais/acabamentos | Itens carregados com materiais | Itens carregam mas sub-recursos dependem de migration 006 |
| AE-021 | Producao | ProducaoPage Kanban com drag-and-drop nao valida transicoes de status permitidas | Apenas transicoes validas | Qualquer coluna aceita drop |
| AE-022 | Financeiro | gerarParcelas() insere em tabela `parcelas_receber` com `as any`, indicando tabela pode nao existir | Tabela existente com tipagem | Cast `as any` mascara ausencia |
| AE-023 | Portal | Portal nao exibe data de validade do orcamento ao cliente | Cliente ve validade | Validade nao exibida |
| AE-024 | Clientes | Soft delete (ativo=false) mas cliente inativo ainda aparece nos selects de orcamento | Apenas clientes ativos nos selects | Todos aparecem (query de clientes para combo nao filtra ativo) |
| AE-025 | Orcamentos | Desconto aplicado no orcamento nao e preservado explicitamente no pedido; recalcularTotais aplica desconto mas pedido.valor_total = orcamento.total (ja com desconto) | Desconto rastreavel no pedido | Desconto implicit no total, sem campo dedicado no pedido |

---

### 5.4 -- Melhorias BAIXAS

| ID | Local | Sugestao |
|----|-------|---------|
| AE-026 | LeadDetailPage | Adicionar campo "proximo_contato" no formulario de edicao (campo existe no banco mas nao no form) |
| AE-027 | OrcamentoEditorPage | Adicionar indicador visual de quantos itens ja foram adicionados ao orcamento |
| AE-028 | PedidoDetailPage | Mostrar lista de itens do pedido (atualmente so mostra dados basicos e tab de arquivos) |
| AE-029 | ProducaoPage | Adicionar filtro por maquina alocada |
| AE-030 | FinanceiroPage | Adicionar KPI de "valor em atraso" (parcelas vencidas nao pagas) |
| AE-031 | Geral | Padronizar toasts: alguns modulos usam showSuccess/showError, outros nao tem feedback apos acoes |

---

## 6. QUEBRAS DE FLUXO

| De | Para | Problema | Severidade |
|----|------|----------|-----------|
| Producao concluida | Pedido atualizado | OP concluida nao atualiza status do pedido automaticamente | ALTO |
| Pedido concluido | Conta a receber | Erro em gerarContasReceber e silenciado, pedido avanca sem cobranca | CRITICO |
| Orcamento aprovado | Pedido | Orcamento "recusada" pode ser convertido em pedido | ALTO |
| Pedido em producao | Cancelamento | Nao existe acao de cancelamento | ALTO |
| OI agendada | Job no App de Campo | Migration 004 nao executada, trigger inexistente | CRITICO |

---

## 7. ERROS DE REGRA DE NEGOCIO

| Tipo | Descricao | Impacto |
|------|-----------|---------|
| Permissivo demais | Pedido pode avancar qualquer status sem pre-condicoes (AE-004) | Pedido concluido sem NF-e, sem pagamento |
| Permissivo demais | Orcamento recusado pode virar pedido (AE-012) | Pedido gerado de proposta rejeitada pelo cliente |
| Permissivo demais | Quantidade 0 ou negativa aceita no orcamento (AE-006) | Orcamento com valores errados |
| Permissivo demais | Materiais podem ser editados em orcamento aprovado (AE-008) | Orcamento inconsistente com proposta aceita |
| Calculo incorreto | Pedidos cancelados somam no total do dashboard (AE-013) | Receita inflada |
| Ausente | Sem validacao de CNPJ no cadastro de clientes (AE-009) | NF-e impossivel de emitir |
| Ausente | Sem controle de concorrencia em nenhum modulo (Bloco 5) | Sobrescrita silenciosa |
| Ausente | Sem entrega parcial ou pedido recorrente (Bloco 10) | Operacoes reais nao suportadas |
| Ausente | Sem retrabalho por falha de producao (Bloco 10) | OP concluida nao pode ser reaberta |

---

## 8. PROBLEMAS DE UX

| Tela / Modulo | Problema de UX | Severidade | Sugestao |
|---------------|---------------|------------|---------|
| PedidoDetailPage | Nao mostra itens do pedido, apenas dados basicos | MEDIO | Adicionar tab "Itens" com lista de produtos |
| OrcamentoEditorPage | Wizard 3 etapas mas sem navegacao para voltar e editar itens ja adicionados | MEDIO | Permitir edicao de itens existentes |
| LeadDetailPage | Botao "Converter" nao explica quais dados serao transferidos | BAIXO | Mostrar preview dos dados |
| ProducaoPage | Kanban drag-and-drop sem confirmacao visual de drop | MEDIO | Adicionar animacao de confirmacao |
| FinanceiroPage | Contas a receber sem link direto ao pedido/cliente | BAIXO | Adicionar links de navegacao |

**Padroes de UX identificados**:
- [x] Campo obrigatorio sem indicacao visual (quantidade no orcamento)
- [x] Acao irreversivel sem confirmacao (avancar status do pedido nao tem dialog de confirmacao)
- [x] Fluxo nao intuitivo (usuario nao sabe o proximo passo apos criar orcamento)

---

## 9. PROBLEMAS TECNICOS

| ID | Componente | Tipo | Descricao | Severidade |
|----|-----------|------|-----------|-----------|
| AE-T01 | producao.service.ts | Geracao de numero | Math.random() para OP e OS causa colisoes | CRITICO |
| AE-T02 | instalacao.service.ts | Tipagem | `as any` em queries de views potencialmente inexistentes | ALTO |
| AE-T03 | orcamento.service.ts | Tabelas opcionais | try/catch silencioso para proposta_item_materiais, proposta_item_acabamentos, proposta_item_processos (migration 006 pendente) | ALTO |
| AE-T04 | financeiro-automation | Tabela | parcelas_receber com `as any` -- tabela pode nao existir | MEDIO |
| AE-T05 | Concorrencia | Arquitetura | Zero lock otimista/pessimista em todo o sistema. Nenhum updated_at check antes de update. Dois usuarios podem editar o mesmo orcamento e ultimo a salvar sobrescreve | ALTO |

---

## 10. MODULOS INCOMPLETOS

| Modulo | Funcionalidade | Status UI | Status Backend | Impacto |
|--------|---------------|-----------|---------------|---------|
| Expedicao | Liberacao para entrega | Nao existe pagina dedicada | Status no pedido via botao | Sem controle de expedicao real |
| Producao | Apontamento de custos reais | UI nao permite apontar custos | custo_real = custo_estimado | Margem nunca calculada corretamente |
| Fiscal | NF-e completa | UI existe (/fiscal/documentos) | Cria apenas rascunho vazio | NF-e nao pode ser emitida sem completar manualmente |
| Estoque | Consumo de materiais pela producao | EstoquePage existe | Producao nao debita estoque ao concluir OP | Estoque nunca e descontado |
| Instalacao | Bridge ERP-Campo | InstalacaoPage existe | Migration 004 nao executada | Bridge completamente inoperante |
| Comissoes | Calculo de comissao | ComissoesPage existe | Sem calculo automatico vinculado a venda | Comissao nao e calculada |

---

## 11. MELHORIAS RECOMENDADAS

### Prioritarias (implementar logo)

1. **Guards de transicao de status nos pedidos** -- Impedir avancos sem pre-condicoes (OP concluida, NF-e, pagamento)
2. **Geracao atomica de numeros para OP e OS** -- Substituir Math.random() por sequencia do banco
3. **Validacao de CNPJ e email** -- Adicionar validacao no cadastro de clientes e na conversao de lead
4. **Idempotencia em gerarContasReceber e criarOrdemProducao** -- Check de existencia antes de inserir
5. **Bloquear edicao de orcamento aprovado** -- Guard no atualizar() verificando status

### Desejaveis (implementar quando possivel)

1. **Lock otimista** -- Adicionar campo `version` e verificar antes de updates
2. **Executar migration 004** -- Ativar bridge ERP-Campo
3. **Completar NF-e creation** -- Incluir itens, impostos, dados fiscais
4. **Funcionalidade de cancelamento** -- Adicionar botao e fluxo de cancelamento em pedidos
5. **Entrega parcial** -- Suporte a entregas parciais e retrabalho

---

## 12. PLANO DE CORRECAO PRIORITARIO

| Prioridade | ID | Problema | Esforco | Sprint |
|-----------|-----|----------|---------|--------|
| 1 | AE-004 | Guards de transicao de status do pedido | M | Sprint 1 |
| 2 | AE-005 | gerarContasReceber transacional (nao silenciar erro) | P | Sprint 1 |
| 3 | AE-001/003 | Geracao atomica de numeros OP e OS | P | Sprint 1 |
| 4 | AE-012 | Bloquear conversao de orcamento recusado | P | Sprint 1 |
| 5 | AE-008 | Guard de edicao de orcamento aprovado | P | Sprint 1 |
| 6 | AE-014/015 | Idempotencia (check duplicidade antes de inserir) | M | Sprint 1 |
| 7 | AE-009 | Validacao CNPJ e dados na conversao lead-cliente | M | Sprint 1 |
| 8 | AE-013 | Excluir cancelados do totalValor no dashboard | P | Sprint 1 |
| 9 | AE-006 | Validacao quantidade min=1 no orcamento | P | Sprint 1 |
| 10 | AE-002 | Executar migration 004 (bridge ERP-Campo) | G | Sprint 2 |
| 11 | AE-010 | NF-e com itens e impostos | G | Sprint 2 |
| 12 | AE-011 | Apontamento real de custos na producao | G | Sprint 2 |
| 13 | AE-016 | Funcionalidade de cancelamento de pedido | M | Sprint 2 |
| 14 | AE-T05 | Lock otimista (concorrencia) | G | Sprint 3 |
| 15 | AE-020 | Executar migration 006 (materiais/acabamentos detalhados) | G | Sprint 3 |

**Legenda esforco**: P = Pequeno (<2h) | M = Medio (2h-1d) | G = Grande (>1d)

---

## 13. VEREDITO FINAL SOBRE PRONTIDAO DO ERP

### Status por Modulo

| Modulo | Status | Bloqueadores |
|--------|--------|-------------|
| Cadastro de produtos | OK Operacional | -- |
| CRM / Leads | OK Operacional | Sem validacao de email/telefone |
| Clientes | OK Operacional | Sem validacao CNPJ |
| Orcamentos | Parcial | Itens dependem de modelo_materiais populado; edicao pos-aprovacao permitida |
| Portal de aprovacao | OK Operacional | -- |
| Pedidos | Parcial | Sem guards de transicao; cancelamento ausente |
| Producao | Parcial | Numeros colisiveis; custo real = estimado; nao atualiza pedido |
| Financeiro | Parcial | Contas duplicaveis; parcelas_receber com `as any` |
| Faturamento (NF-e) | Inoperante | Rascunho sem itens/impostos; precisa completar manualmente |
| Expedicao | Inoperante | Nao existe modulo dedicado |
| Instalacao / App Campo | Inoperante | Migration 004 nao executada |
| Estoque | Parcial | Modulo existe mas producao nao consome estoque |
| Comissoes | Inoperante | Pagina existe mas sem calculo automatico |

### Conclusao

```
O ERP da Croma Print esta:

[X] PARCIALMENTE APTO
    - Partes do sistema funcionam, mas ha falhas serias em modulos-chave.
    - Recomendacao: Usar com cautela apenas nos modulos estaveis
      (Leads, Clientes, Orcamentos, Portal).
      Resolver erros CRITICOS (AE-001 a AE-005) antes de expansao de uso.
      NAO usar modulos de Producao, Fiscal ou Instalacao em operacao real
      ate que os guards de transicao e a migration 004 sejam implementados.
```

**Assinado por**: AGENTE DE CONTROLE DE QUALIDADE CROMA_ERP
**Data**: 2026-03-14
**Proxima execucao recomendada**: Apos correcao dos 5 erros CRITICOS (Sprint 1)

---

*Este relatorio foi gerado automaticamente pelo Agente QA Operacional da Croma Print.*
*Para re-executar o agente: invocar AGENTE.md com o cenario desejado.*
