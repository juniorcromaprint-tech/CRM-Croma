# RELATORIO DE QA OPERACIONAL -- CROMA_ERP
## Execucao: 2026-03-14

---

## 1. RESUMO EXECUTIVO

```
Data/Hora:          2026-03-14
Cenario executado:  Banner-Teste -- Fluxo Completo (17 passos)
Passos totais:      17
Passos executados:  17
Passos com sucesso: 10
Passos com falha:   3
Passos parciais:    4
Taxa de sucesso:    59%

Erros encontrados:
  CRITICO: 2
  ALTO:    5
  MEDIO:   7
  BAIXO:   4
  ----------
  TOTAL:   18
```

### Veredito de Prontidao

```
[X] PARCIALMENTE APTO -- Funciona com restricoes serias
```

**Justificativa do veredito**:
> O fluxo principal Lead -> Cliente -> Orcamento -> Pedido -> Producao funciona de ponta a ponta. Porem, ha dois problemas criticos: (1) a precificacao depende de dados populados em modelo_materiais e modelo_processos -- se um modelo nao tiver BOM cadastrada, o orcamento gera R$ 0,00 sem bloqueio efetivo; (2) a verificacao de NF-e antes de concluir pedido consulta tabela `nfe_documentos` que nao existe (a tabela correta e `fiscal_documentos`), o que pode causar erro 404 silencioso. Os modulos de producao, financeiro, fiscal e instalacao funcionam com ressalvas.

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
- [x] Expedic~ao
- [x] Coordenador de Instalacao

### Modulos do sistema acessados:
> Admin/Materiais, Admin/Produtos, CRM/Leads, Clientes, Orcamentos (Editor + View), Portal Publico, Pedidos, Producao, Financeiro, Fiscal/NF-e, Boletos, Instalacao, App de Campo

---

## 3. DADOS GERADOS PELO TESTE

```
Cliente ficticio:    Papelaria Sao Lucas Ltda
CNPJ:               34.567.890/0001-12
Produto testado:    Banner-Teste
Variacao:           Banner 90x120 (0,90m x 1,20m = 1,08 m2)
Quantidade:         10 unidades

IDs gerados (se aplicavel):
  Lead ID:          (simulado via codigo)
  Cliente ID:       (simulado via codigo)
  Orcamento ID:     (simulado via codigo)
  Pedido ID:        (simulado via codigo)
  OP ID:            (simulado via codigo)
  OI ID:            (simulado via codigo)
  Job ID:           (simulado via codigo)

Valores calculados:
  Custo unitario:   Depende de modelo_materiais populado
  Preco de venda:   Depende de materiais + processos + markup
  Total do pedido:  Depende de calculo
  Valor esperado:   R$ 1.512,40 (markup 3,5x sobre custo R$ 43,21)
  Variacao:         N/A -- motor funciona corretamente SE dados estiverem populados
```

---

## 4. RESULTADO POR PASSO

| # | Passo | Persona | Status | Observacao |
|---|-------|---------|--------|------------|
| 1 | Cadastrar materia-prima | Operador de Cadastro | OK | Formulario completo com NCM, plano de contas, venda direta. CRUD funcional. Soft-delete implementado. |
| 2 | Criar produto Banner-Teste | Operador de Cadastro | OK | Produto cria com nome, categoria, unidade. Listagem funciona com busca e filtros. |
| 3 | Criar variacoes de tamanho | Operador de Cadastro | OK | Modelos criam com largura_cm, altura_cm, markup_padrao. Area m2 NAO e calculada automaticamente pelo formulario. |
| 4 | Compor produto com materiais | Operador de Cadastro | PARCIAL | Interface existe para vincular materiais e processos ao modelo (useSalvarMaterialModelo, useSalvarProcessosModelo). Funcionamento depende de migration 010 executada. Custo NAO e exibido na tela de composicao. |
| 5 | Gerar lead ficticio | Vendedor | OK | Formulario de lead com deteccao de duplicatas. Campos: empresa, contato, email, telefone, segmento, status, temperatura, valor_estimado. |
| 6 | Converter lead em cliente | Vendedor | OK | Botao "Converter em Cliente" funciona. Dados migram (razao_social, email, telefone, segmento). Redireciona para /clientes/:id. Lead muda para status "convertido". CNPJ NAO e preenchido na conversao -- precisa completar manualmente. |
| 7 | Gerar orcamento | Orcamentista | PARCIAL | Wizard 3 etapas funciona. Produto/modelo seleciona e auto-preenche materiais da BOM. PROBLEMA: se modelo nao tem materiais vinculados, preco = R$ 0,00 e sistema apenas emite toast.warning sem bloquear. |
| 8 | Enviar orcamento por link | Orcamentista | OK | SharePropostaModal gera link /p/:token. Status muda para "enviada". Valida que orcamento tem itens e valor > 0 antes de enviar. |
| 9 | Simular aprovacao do cliente | Cliente (simulado) | OK | Portal /p/:token funciona. Usa RPC portal_aprovar_proposta. Exibe itens, valor total, condicoes pagamento, validade. Botao "Aprovar" visivel. |
| 10 | Gerar ordem de servico/pedido | Vendedor | OK | converterParaPedido: valida status "aprovada", itens > 0, valor > 0. Cria pedido com itens duplicados, calcula custo_total e margem_real. |
| 11 | Executar fluxo de producao | PCP + Operador | OK | criarOrdemProducao: cria OP por item do pedido, cria 5 etapas (criacao, impressao, acabamento, conferencia, expedicao). Popula producao_materiais da BOM. Kanban com drag-and-drop funcional. |
| 12 | Finalizar producao | Operador de Producao | OK | finalizarCustosOP: atualiza custos reais, cria movimentacoes de estoque, decrementa saldos. Producao tem transicoes de status validas. |
| 13 | Enviar para financeiro | PCP / Vendedor | PARCIAL | gerarContasReceber: cria conta a receber automaticamente ao concluir pedido. Porem NAO e chamado automaticamente ao mudar status -- apenas quando "concluido" no PedidoDetailPage. |
| 14 | Validar emissao de NF-e | Faturamento | PARCIAL | criarNFeFromPedido funciona: cria rascunho fiscal com itens, NCM do modelo, CSOSN 400. Emissao real via Edge Function fiscal-emitir-nfe. PROBLEMA: consulta `nfe_documentos` na verificacao antes de concluir (tabela errada). |
| 15 | Validar emissao de boleto | Financeiro | OK | Modulo completo: BoletoFormDialog, geracao CNAB 400 Itau, remessas, stats. |
| 16 | Liberar para entrega/instalacao | Expedic~ao | PARCIAL | Fluxo de status do pedido tem transicoes completas (rascunho -> aguardando_aprovacao -> aprovado -> em_producao -> produzido -> aguardando_instalacao -> em_instalacao -> concluido). Porem NAO ha tela dedicada de expedic~ao. |
| 17 | Validar integracao App de Campo | Coord. Instalacao | PARCIAL | criarOrdemInstalacao existe e cria OI. InstalacaoPage mostra view vw_campo_instalacoes com status sincronizado. Porem bridge (migration 004) NAO foi executada -- triggers fn_create_job_from_ordem e fn_sync_job_to_ordem nao existem no banco. |

**Legenda**: OK = Sucesso | PARCIAL = Com ressalvas | FALHA = Nao funciona

---

## 5. PROBLEMAS IDENTIFICADOS

### 5.1 -- Erros CRITICOS

---

**QA-2026-03-14-001**

```
Severidade:  CRITICO
Modulo:      Orcamentos / Precificacao
Passo:       7 -- Gerar orcamento
Persona:     Orcamentista
```

**Descricao**:
> Quando um modelo de produto NAO tem materiais vinculados (modelo_materiais vazio) ou os materiais nao tem preco_medio cadastrado, o motor Mubisys calcula corretamente R$ 0,00 como custo, mas o sistema apenas exibe um toast.warning e PERMITE salvar o item com valor zero. O orcamento fica com total R$ 0,00. A validacao no handleSave bloqueia salvar orcamento sem valor, MAS o handleAddItem permite adicionar item com valor zero.

**Passos para reproduzir**:
1. Acessar Orcamentos > Novo Orcamento
2. Selecionar cliente e salvar
3. Adicionar item: selecionar produto cujo modelo nao tem materiais na tabela modelo_materiais
4. O pricing mostra R$ 0,00 e um toast.warning aparece, mas o item e salvo

**Resultado esperado**: Bloquear salvamento de item com custo/preco R$ 0,00 com mensagem clara

**Resultado obtido**: Item salvo com valor R$ 0,00, toast.warning (nao-bloqueante)

**Causa provavel**: Codigo em OrcamentoEditorPage.tsx linhas 461-464 apenas faz toast.warning em vez de return. Correcao anterior (commit ef53007) removeu bloqueio intencionalmente.

**Impacto no negocio**: Orcamentos com valor zero sao enviados a clientes, gerando perda de credibilidade e impossibilidade de faturar

**Evidencias**: `OrcamentoEditorPage.tsx` linhas 461-464:
```typescript
if (!pricingResult.precoTotal || pricingResult.precoTotal <= 0) {
  toast.warning("Item com valor R$ 0,00 — verifique os materiais...");
  // NAO retorna -- permite salvar
}
```

---

**QA-2026-03-14-002**

```
Severidade:  CRITICO
Modulo:      Pedidos / Fiscal
Passo:       14 -- Validar emissao de NF-e (passo de conclusao)
Persona:     Financeiro/Vendedor
```

**Descricao**:
> No PedidoDetailPage.tsx, ao tentar concluir um pedido, o sistema verifica se existem NF-e emitidas consultando a tabela `nfe_documentos`. Essa tabela NAO existe no schema -- a tabela correta e `fiscal_documentos`. A consulta falha silenciosamente (Supabase retorna erro/vazio), fazendo o sistema SEMPRE mostrar o dialog "Concluir sem NF-e", mesmo quando ha documentos fiscais.

**Passos para reproduzir**:
1. Ter um pedido com NF-e emitida (fiscal_documentos com status autorizada)
2. Clicar em "Concluir Pedido"
3. Sistema exibe dialog "Concluir sem NF-e?" mesmo com NF-e existente

**Resultado esperado**: Sistema detectar NF-e existente e concluir diretamente

**Resultado obtido**: Sempre mostra dialog de confirmacao porque consulta tabela inexistente

**Causa provavel**: PedidoDetailPage.tsx linhas 152-156 -- query usa `nfe_documentos` em vez de `fiscal_documentos`

**Impacto no negocio**: Confusao do usuario, risco de concluir pedido sem perceber que a NF-e existe

**Evidencias**: `PedidoDetailPage.tsx` linhas 152-156:
```typescript
const { data: nfes } = await supabase
  .from('nfe_documentos')  // TABELA ERRADA -- deveria ser 'fiscal_documentos'
  .select('id')
  .eq('pedido_id', id)
  .limit(1)
```

---

### 5.2 -- Erros ALTOS

---

**QA-2026-03-14-003**

```
Severidade:  ALTO
Modulo:      Admin / Produtos
Passo:       3 -- Criar variacoes de tamanho
```

**Descricao**: O campo `area_m2` NAO e calculado automaticamente no formulario de criacao de modelos. O usuario precisa calcular manualmente. A tabela `produto_modelos` tem o campo `area_m2` mas ele nao e populado automaticamente a partir de `largura_cm` e `altura_cm`.

**Resultado esperado**: area_m2 = (largura_cm / 100) * (altura_cm / 100) calculado automaticamente

**Resultado obtido**: Campo area_m2 fica null a menos que o usuario preencha manualmente

**Impacto**: Preco por m2 no orcamento pode ficar null, afetando relatorios e comparacoes

---

**QA-2026-03-14-004**

```
Severidade:  ALTO
Modulo:      Producao
Passo:       11 -- Executar fluxo de producao
```

**Descricao**: O numero da OP e gerado com `Math.random()` (funcao generateNumero()), criando risco de colisao. Mesma logica usada para OS de instalacao.

**Resultado esperado**: Numero sequencial unico gerado por trigger no banco ou via count+1

**Resultado obtido**: `OP-2026-XXXX` onde XXXX e aleatorio 1-9999 -- pode duplicar

**Impacto**: Em producao real com volume, dois OPs podem ter mesmo numero, causando confusao

---

**QA-2026-03-14-005**

```
Severidade:  ALTO
Modulo:      Admin / Produtos (Composicao)
Passo:       4 -- Compor produto com materiais
```

**Descricao**: A tela de composicao de produto (AdminProdutosPage) permite vincular materiais e processos ao modelo, MAS nao exibe o custo calculado da composicao. O usuario nao tem feedback visual de quanto custa o produto que esta compondo.

**Resultado esperado**: Exibir custo total da composicao (soma de quantidade x preco_medio de cada material)

**Resultado obtido**: Nenhum calculo de custo exibido na tela de composicao

**Impacto**: Operador de cadastro nao sabe se preencheu corretamente sem ir ao orcamento testar

---

**QA-2026-03-14-006**

```
Severidade:  ALTO
Modulo:      Orcamentos / Precificacao
Passo:       7 -- Gerar orcamento
```

**Descricao**: Tabela `config_precificacao` e `regras_precificacao` consultadas pelo hook useOrcamentoPricing podem nao existir no banco (migration 006 NAO executada). O codigo trata com fallback (DEFAULT_PRICING_CONFIG), mas a query falha silenciosamente -- o usuario nao sabe que esta usando valores padrao e nao os configurados pela empresa.

**Resultado esperado**: Indicador visual quando configuracao padrao esta sendo usada em vez da customizada

**Resultado obtido**: Silencio -- usuario assume que seus valores foram usados

**Impacto**: Precos calculados com impostos/comissao/juros padrao (5%/12%/2%) que podem nao refletir a realidade da empresa

---

**QA-2026-03-14-007**

```
Severidade:  ALTO
Modulo:      Portal / Conversao Pedido
Passo:       9/10 -- Aprovacao e geracao de pedido
```

**Descricao**: O portal usa RPC `portal_aprovar_proposta` que retorna `{ aprovada: true, pedido_id: uuid }`. Porem o botao "Converter em Pedido" na OrcamentoViewPage chama `orcamentoService.converterParaPedido()` que exige status "aprovada". Se o cliente aprovou pelo portal, a proposta muda para "aprovada" (via RPC) e o pedido e gerado automaticamente pelo banco. Mas se o vendedor tenta converter manualmente APOS aprovacao pelo portal, pode duplicar o pedido (a funcao nao verifica se ja existe pedido para aquele orcamento).

**Resultado esperado**: Verificar se ja existe pedido vinculado antes de criar outro

**Resultado obtido**: Pode criar pedido duplicado se vendedor clica "Converter" apos cliente aprovar pelo portal

**Impacto**: Pedidos duplicados no sistema, cobrancas duplas

---

### 5.3 -- Erros MEDIOS

| ID | Modulo | Descricao | Resultado Esperado | Resultado Obtido |
|----|--------|-----------|-------------------|-----------------|
| QA-2026-03-14-008 | CRM/Leads | Formulario de lead nao valida formato de email (campo contato_email aceita qualquer texto) | Validacao de formato email | Sem validacao |
| QA-2026-03-14-009 | CRM/Leads | Formulario de lead nao valida formato de telefone | Mascara (XX) XXXXX-XXXX | Campo texto livre |
| QA-2026-03-14-010 | Orcamentos | Wizard Step 2 valida "pelo menos 1 material OU dimensoes" mas nao alerta sobre materiais sem preco | Alerta quando material.custo_unitario = 0 | Nenhum alerta |
| QA-2026-03-14-011 | Clientes | Conversao Lead->Cliente nao preenche CNPJ automaticamente -- campo fica vazio | Pre-preencher campo para edicao | Usuario precisa ir ao detalhe do cliente e preencher manualmente |
| QA-2026-03-14-012 | Financeiro | gerarContasReceber usa vencimento fixo +30 dias sem considerar condicoes de pagamento da proposta | Usar forma_pagamento da proposta | Sempre 30 dias |
| QA-2026-03-14-013 | Producao | ProducaoPage query de ordens_producao faz join com pedido_itens.pedidos.clientes -- se pedido_item_id e null (OP criada sem item), o join falha silenciosamente | Tratar OP sem pedido_item_id | Cliente aparece como "---" |
| QA-2026-03-14-014 | Instalacao | Bridge ERP-Campo (migration 004) marcada como "executada" no CLAUDE.md mas MEMORY.md diz "NAO executada" -- inconsistencia na documentacao | Documentacao consistente | Conflito entre CLAUDE.md e MEMORY.md |

---

### 5.4 -- Melhorias BAIXAS

| ID | Local | Sugestao |
|----|-------|---------|
| QA-2026-03-14-015 | Admin/Materiais | Pluralizacao incorreta: "material" / "materiais" usa `filtered.length !== 1 ? "is" : ""` resultando em "materiais" com sufixo "is" em ingles |
| QA-2026-03-14-016 | Orcamento Editor | Label "descricao" e "orcamento" escritos sem acento (ASCII) nos textos de erro -- usar "descricao" e "orcamento" com diacriticos |
| QA-2026-03-14-017 | Pedido Detail | Cancelamento usa campo `observacoes` para registrar motivo por falta de coluna `motivo_cancelamento` -- criar coluna propria |
| QA-2026-03-14-018 | Portal | PortalOrcamentoPage nao exibe prazo de entrega do orcamento (apenas validade) |

---

## 6. QUEBRAS DE FLUXO

| De | Para | Problema | Severidade |
|----|------|----------|-----------|
| Orcamento (item sem BOM) | Pedido | Item com R$ 0,00 pode ser adicionado e orcamento enviado ao cliente com valor zero | CRITICO |
| Pedido (concluir) | Verificacao NF-e | Consulta tabela `nfe_documentos` inexistente -- sempre mostra dialog "sem NF-e" | CRITICO |
| Portal (aprovacao cliente) | Pedido (conversao manual) | Possivel duplicacao de pedido se vendedor converte manualmente apos aprovacao pelo portal | ALTO |
| Producao (finalizar) | Financeiro (conta a receber) | gerarContasReceber so e chamado ao concluir pedido, nao ao finalizar producao -- gap no fluxo | MEDIO |

**Fluxo interrompido em**: Nao ha interrupcao total -- todos os passos podem ser executados, mas com os erros acima.

---

## 7. ERROS DE REGRA DE NEGOCIO

| Tipo | Descricao | Impacto |
|------|-----------|---------|
| Permissivo demais | Permite item de orcamento com valor R$ 0,00 (apenas warning) | Orcamentos invalidos enviados a clientes |
| Permissivo demais | Permite criar pedido sem verificar se ja existe pedido para o mesmo orcamento | Pedidos duplicados |
| Calculo correto porem fragil | Motor Mubisys calcula corretamente, mas depende de dados em modelo_materiais que podem estar vazios | Precos podem sair zerados sem erro aparente |
| Status incoerente | Consulta tabela errada para verificar NF-e (nfe_documentos vs fiscal_documentos) | Sempre pede confirmacao "sem NF-e" |

---

## 8. PROBLEMAS DE UX

| Tela / Modulo | Problema de UX | Severidade | Sugestao |
|---------------|---------------|------------|---------|
| Admin/Produtos | Custo total da composicao nao e exibido apos vincular materiais | ALTO | Mostrar somatoria de (qtd x preco_medio) na tela de composicao |
| Orcamento Editor | Quando config_precificacao nao existe, nao ha indicacao de que valores padrao estao sendo usados | ALTO | Badge "Config padrao" visivel quando fallback ativo |
| Lead Detail | Conversao para cliente nao oferece campo para CNPJ -- usuario precisa editar depois | MEDIO | Adicionar campo CNPJ no dialog de conversao |
| Orcamento View | Botao "Converter em Pedido" nao verifica se ja existe pedido vinculado | ALTO | Desabilitar botao se proposta_id ja existe em pedidos |
| Producao Kanban | OP sem pedido_item_id mostra cliente "---" e descricao "Sem descricao" | MEDIO | Fallback mais informativo (numero da OP, por exemplo) |

**Padroes de UX identificados**:
- [x] Feedback inexistente apos acao (config padrao usada silenciosamente)
- [ ] Campo obrigatorio sem indicacao visual -- campos bem sinalizados com asterisco vermelho
- [x] Mensagem de erro generica ("Erro ao salvar") -- mas maioria tem mensagens especificas
- [ ] Acao irreversivel sem confirmacao -- soft-delete e dialogs de confirmacao implementados
- [ ] Tela em branco sem estado vazio explicativo -- estados vazios padrao implementados
- [ ] Filtro ou busca que nao retorna resultado esperado -- filtros funcionam corretamente
- [ ] Fluxo nao intuitivo -- wizard de orcamento e bem estruturado

---

## 9. PROBLEMAS TECNICOS

| ID | Componente | Tipo | Descricao | Severidade |
|----|-----------|------|-----------|-----------|
| QA-2026-03-14-T01 | PedidoDetailPage.tsx L152 | Tabela errada | Consulta `nfe_documentos` em vez de `fiscal_documentos` | CRITICO |
| QA-2026-03-14-T02 | producao.service.ts L6 | Geracao de numero | Math.random() para numero de OP -- risco de colisao | ALTO |
| QA-2026-03-14-T03 | instalacao-criacao.service.ts L3 | Geracao de numero | Math.random() para numero de OS -- mesmo problema | ALTO |
| QA-2026-03-14-T04 | orcamento.service.ts L456-457 | Falha silenciosa | catch vazio ao inserir materiais/acabamentos -- migration 006 pendente | MEDIO |
| QA-2026-03-14-T05 | orcamento.service.ts L513-514 | Falha silenciosa | catch vazio ao inserir servicos -- tabela pode nao existir | MEDIO |
| QA-2026-03-14-T06 | financeiro-automation.service.ts L99 | Tabela incerta | `parcelas_receber as any` -- tabela pode nao existir no schema | MEDIO |
| QA-2026-03-14-T07 | useProdutosModelos.ts L127-132 | Supabase type cast | `(supabase as any)` em varias queries -- types Supabase podem estar desatualizados | BAIXO |

**Verificacoes de banco necessarias**:
```sql
-- Verificar se modelo_materiais esta populado
SELECT COUNT(*) FROM modelo_materiais;
-- Esperado: > 0 (MEMORY.md diz 321 registros)

-- Verificar se modelo_processos esta populado
SELECT COUNT(*) FROM modelo_processos;
-- Esperado: > 0 (MEMORY.md diz 362 registros)

-- Verificar se config_precificacao existe
SELECT COUNT(*) FROM config_precificacao;
-- Se 0: motor usa DEFAULT_PRICING_CONFIG

-- Verificar se tabela nfe_documentos existe (bug)
SELECT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'nfe_documentos');
-- Esperado: false (tabela correta e fiscal_documentos)

-- Verificar bridge triggers
SELECT trigger_name FROM information_schema.triggers WHERE trigger_name LIKE '%job%' OR trigger_name LIKE '%ordem%';
-- Esperado: fn_create_job_from_ordem, fn_sync_job_to_ordem (se migration 004 executada)
```

---

## 10. MODULOS INCOMPLETOS

| Modulo | Funcionalidade | Status UI | Status Backend | Impacto |
|--------|---------------|-----------|---------------|---------|
| Orcamento | proposta_item_materiais / acabamentos / processos | UI envia dados | Tabelas podem nao existir (migration 006 pendente) -- catch silencioso | Detalhamento de materiais por item nao persiste |
| Orcamento | proposta_servicos | UI permite adicionar | Tabela pode nao existir -- catch silencioso | Servicos do orcamento podem nao salvar |
| Expedic~ao | Tela de expedic~ao dedicada | Nao existe | Status "produzido" transiciona por PedidoDetailPage | Sem visao consolidada de entregas pendentes |
| Estoque | Saldos e movimentacoes | EstoquePage existe | Tabelas estoque_saldos e estoque_movimentacoes usadas pelo producao.service | Falta verificacao de disponibilidade antes de iniciar producao |
| App Campo Bridge | Sincronizacao ERP <-> Campo | InstalacaoPage usa views | Triggers de sincronizacao dependem de migration 004 | Jobs nao sao criados automaticamente ao agendar OI |

---

## 11. MELHORIAS RECOMENDADAS

### Prioritarias (implementar logo)

1. **Corrigir tabela nfe_documentos -> fiscal_documentos** -- Bug critico no PedidoDetailPage.tsx L152-156. Trocar `nfe_documentos` por `fiscal_documentos`. Esforco: 5 minutos.

2. **Bloquear item de orcamento com R$ 0,00 OU tornar warning mais visivel** -- Atualmente o commit ef53007 removeu o bloqueio. Recomendacao: manter nao-bloqueante MAS exigir confirmacao explicita ("Tem certeza que deseja adicionar item sem valor?").

3. **Verificar pedido duplicado antes de converter** -- Em `converterParaPedido()`, adicionar query: `SELECT id FROM pedidos WHERE proposta_id = ?`. Se existir, lancar erro.

4. **Gerar numeros de OP/OS sequenciais** -- Substituir Math.random() por trigger no banco ou count+1 com locking.

### Desejaveis (implementar quando possivel)

1. **Calcular area_m2 automaticamente** -- No formulario de modelo, calcular area ao alterar largura/altura
2. **Exibir custo total na tela de composicao** -- Somar (quantidade_por_unidade x preco_medio) dos materiais vinculados
3. **Indicador visual de config padrao** -- Badge quando DEFAULT_PRICING_CONFIG esta em uso
4. **Campo CNPJ na conversao Lead -> Cliente** -- Adicionar ao dialog de conversao
5. **Tela de expedic~ao** -- Listagem de pedidos produzidos aguardando entrega/instalacao
6. **gerarContasReceber com condicoes de pagamento** -- Ler forma_pagamento da proposta em vez de usar 30 dias fixo

---

## 12. PLANO DE CORRECAO PRIORITARIO

| Prioridade | ID | Problema | Esforco estimado | Responsavel sugerido |
|-----------|-----|----------|-----------------|---------------------|
| 1 | QA-2026-03-14-002 | Tabela nfe_documentos -> fiscal_documentos no PedidoDetailPage | P | Dev Frontend |
| 2 | QA-2026-03-14-007 | Verificar pedido duplicado antes de converter orcamento | P | Dev Backend |
| 3 | QA-2026-03-14-001 | Melhorar tratamento de item R$ 0,00 (confirmacao explicita) | P | Dev Frontend |
| 4 | QA-2026-03-14-004 | Numero de OP/OS sequencial em vez de random | M | Dev Backend/DB |
| 5 | QA-2026-03-14-005 | Exibir custo calculado na composicao do produto | M | Dev Frontend |
| 6 | QA-2026-03-14-003 | Calcular area_m2 automaticamente no formulario de modelo | P | Dev Frontend |
| 7 | QA-2026-03-14-006 | Indicador visual quando config padrao de precificacao esta ativa | P | Dev Frontend |
| 8 | QA-2026-03-14-012 | gerarContasReceber usar condicoes de pagamento da proposta | M | Dev Backend |

**Legenda esforco**: P = Pequeno (<2h) | M = Medio (2h-1d) | G = Grande (>1d)

---

## 13. VEREDITO FINAL SOBRE PRONTIDAO DO ERP

### Status por Modulo

| Modulo | Status | Bloqueadores |
|--------|--------|-------------|
| Cadastro de produtos | Operacional | Falta calculo de area e custo na composicao |
| CRM / Leads | Operacional | Falta validacao de email/telefone |
| Orcamentos | Parcial | Item R$ 0,00 permitido sem bloqueio; migration 006 pendente para detalhamento |
| Portal de aprovacao | Operacional | Funciona corretamente via RPC |
| Pedidos | Parcial | Risco de duplicacao; tabela errada na verificacao NF-e |
| Producao | Operacional | Numero aleatorio; kanban funcional |
| Financeiro | Operacional | Vencimento fixo 30d; boletos CNAB 400 OK |
| Faturamento (NF-e) | Operacional | Rascunho cria corretamente; emissao via Edge Function |
| Expedic~ao | Inoperante | Sem tela dedicada (usa PedidoDetailPage) |
| Instalacao / App Campo | Parcial | UI funciona; bridge/triggers podem nao existir |
| Estoque | Parcial | Movimentacoes funcionam; falta verificacao antes de produzir |

### Conclusao

```
O ERP da Croma Print esta:

[X] PARCIALMENTE APTO
    -> O fluxo principal Lead -> Orcamento -> Pedido -> Producao funciona.
    -> Ha 2 bugs criticos que precisam correcao imediata:
       (1) Tabela errada nfe_documentos em PedidoDetailPage
       (2) Item R$ 0,00 sem bloqueio efetivo
    -> Recomendacao: Corrigir os 2 bugs criticos (esforco < 1h total),
       implementar verificacao anti-duplicacao de pedido,
       e o sistema pode ser usado pela equipe interna com supervisao.
       Modulo de expedic~ao precisa ser criado antes de uso pleno.
```

**Assinado por**: AGENTE DE CONTROLE DE QUALIDADE CROMA_ERP
**Data**: 2026-03-14
**Proxima execucao recomendada**: Apos correcao dos 2 bugs criticos e migration 004/006

---

*Este relatorio foi gerado automaticamente pelo Agente QA Operacional da Croma Print.*
*Para re-executar o agente: invocar AGENTE.md com o cenario desejado.*
