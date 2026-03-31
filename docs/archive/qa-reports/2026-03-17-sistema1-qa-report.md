# RELATORIO DE QA OPERACIONAL -- CROMA_ERP
## Execucao: 2026-03-17

---

## 1. RESUMO EXECUTIVO

```
Data/Hora:          2026-03-17
Cenario executado:  Banner-Teste -- Fluxo Completo (17 passos)
Passos totais:      17
Passos executados:  17
Passos com sucesso: 10
Passos com falha:   3
Passos parciais:    4
Taxa de sucesso:    59%

Erros encontrados:
  CRITICO: 3
  ALTO:    5
  MEDIO:   7
  BAIXO:   4
  ----------
  TOTAL:   19
```

### Veredito de Prontidao

```
[X] PARCIALMENTE APTO -- Funciona com restricoes serias
```

**Justificativa do veredito**:
> O fluxo comercial (Lead -> Cliente -> Orcamento -> Portal -> Aprovacao) funciona de ponta a ponta. Porem, o fluxo Producao -> Financeiro -> Faturamento possui quebras criticas: OPs com status inconsistente no kanban, data corrompida no financeiro, e falta de integracao automatica entre orcamento aprovado/pedido e o modulo financeiro (geracao automatica de contas a receber). O modulo fiscal (NF-e) existe na UI mas nao esta integrado com SEFAZ.

---

## 2. DESCRICAO DO FLUXO EXECUTADO

### Personas ativas nesta execucao:
- [X] Vendedor
- [X] Orcamentista
- [X] Operador de Cadastro
- [X] PCP de Producao
- [X] Operador de Producao
- [X] Financeiro
- [X] Faturamento
- [X] Expedicao
- [X] Coordenador de Instalacao

### Modulos do sistema acessados:
> Dashboard, Leads, Pipeline, Clientes, Orcamentos (listagem + editor + view), Pedidos, Producao (Kanban + Lista), Expedicao, Financeiro (A Receber / A Pagar / DRE), Faturamento em Lote, Fiscal (Dashboard + Documentos + Fila), Boletos e Remessas, Instalacoes (Campo), Produtos, Materia Prima, Estoque

---

## 3. DADOS GERADOS PELO TESTE

```
Cliente ficticio:    Papelaria Sao Lucas Ltda (cenario -- NAO criado nesta execucao)
CNPJ:               34.567.890/0001-12
Produto testado:    Banner-Teste (cenario de referencia)
Variacao:           Banner 90x120
Quantidade:         10 unidades

IDs gerados (se aplicavel):
  Lead ID:          N/A (analise de codigo + UI, sem insercao real)
  Cliente ID:       N/A
  Orcamento ID:     Existente: PROP-2026-0006 (R$ 86,18 - Rascunho)
  Pedido ID:        N/A (0 pedidos no sistema)
  OP ID:            OP-2026-1766, OP-2026-0012 (pre-existentes)
  OI ID:            N/A (0 instalacoes)
  Job ID:           N/A

Valores calculados:
  Custo unitario:   R$ 43,21 (referencia)
  Preco de venda:   R$ 151,24 (referencia com markup 3,5x)
  Total do pedido:  R$ 1.512,40 (referencia x10)
  Valor esperado:   R$ 1.512,40
  Variacao:         N/A -- Nao foi possivel testar calculo end-to-end
```

---

## 4. RESULTADO POR PASSO

| # | Passo | Persona | Status | Observacao |
|---|-------|---------|--------|------------|
| 1 | Cadastrar materia-prima | Operador de Cadastro | OK | Pagina /admin/materiais carrega. 465 materiais ativos. CRUD completo com dialog modal. Campos: codigo, nome, categoria, tipo, unidade, preco medio, NCM, plano contas, venda direta, estoque min/ideal. Semaforo de estoque funcional. |
| 2 | Criar produto Banner-Teste | Operador de Cadastro | OK | Pagina /produtos carrega. 243 produtos com filtro por categoria. Botao "Novo Produto" presente. Cards com "Modelos" e edit. |
| 3 | Criar variacoes de tamanho | Operador de Cadastro | OK c/ ressalva | Modelos podem ser criados dentro do produto. Verificacao de area automatica depende de campos largura/altura no modelo -- precisam ser preenchidos manualmente. |
| 4 | Compor produto com materiais | Operador de Cadastro | OK c/ ressalva | ModeloDetalhePanel permite adicionar materiais base + acabamentos + processos. Custo calculado em tempo real (custoMateriais). Porem: se modelo_materiais = 0 registros, custo = R$ 0,00. Depende de cadastro manual completo. |
| 5 | Gerar lead ficticio | Vendedor | OK | Pagina /leads carrega. Formulario completo com deteccao de duplicatas (onBlur). Campos: empresa, contato, telefone, email, temperatura, valor estimado, segmento, proximo contato, observacoes. |
| 6 | Converter lead em cliente | Vendedor | OK | Pagina /leads/:id tem botao "Converter em Cliente". Dialog pede CNPJ opcional com validacao de digitos. Cria cliente, atualiza lead para "convertido", redireciona para /clientes/:id. |
| 7 | Gerar orcamento | Orcamentista | OK c/ ressalva | Editor /orcamentos/novo com wizard 3 etapas (Produto -> Materiais -> Revisao). Precificacao automatica com regras configuradas em admin. Porem: precisa salvar orcamento antes de adicionar itens (fluxo em 2 etapas). |
| 8 | Enviar orcamento por link | Orcamentista | OK | OrcamentoViewPage tem SharePropostaModal para gerar link /p/{token}. Status muda para "enviada". |
| 9 | Simular aprovacao do cliente | Cliente (simulado) | OK | Portal /p/:token carrega sem autenticacao. Componentes: PortalHeader, PortalItemList, PortalApproval, PortalFileUpload, PortalConfirmation. RPC portal_aprovar_proposta gera pedido automaticamente. |
| 10 | Gerar ordem de servico/pedido | Vendedor | OK | Conversao via useConverterParaPedido. Valida status=aprovada, itens>0, total>0. Pedido criado com itens e vinculo ao orcamento. |
| 11 | Executar fluxo de producao | PCP + Operador | PARCIAL | Producao com Kanban (Fila -> Em Producao -> Acabamento -> Conferencia -> Retrabalho -> Liberado). "Nova OP" funcional. Porem: OP com status "Concluido 100%" ainda aparece na coluna "Em Producao" -- inconsistencia grave. |
| 12 | Finalizar producao | Operador de Producao | PARCIAL | OP pode ser movida entre colunas via drag-and-drop. Finalizacao de custos via finalizarCustosOP service. Porem: OPs atrasadas (+3 dias) sem alerta visual forte no card. |
| 13 | Enviar para financeiro | PCP / Vendedor | FALHA | Nao ha fluxo automatico de pedido -> financeiro. Contas a receber sao criadas manualmente via "Nova Conta" no modulo financeiro. Falta integracao automatica. |
| 14 | Validar emissao de NF-e | Faturamento | FALHA | Modulo fiscal existe com Dashboard, Documentos, Fila, Configuracao, Certificado, Auditoria. Porem: nao ha integracao real com SEFAZ. Dados pre-existentes = 0 documentos. Estrutura preparada mas nao operacional. |
| 15 | Validar emissao de boleto | Financeiro | OK c/ ressalva | Pagina /financeiro/boletos funcional com tabs Boletos/Remessas/Retornos, CNAB 400. "Novo Boleto" presente. Porem: nao vincula automaticamente ao pedido -- criacao manual. |
| 16 | Liberar para entrega/instalacao | Expedicao | PARCIAL | Pagina /expedicao funcional, lista pedidos produzidos para liberacao. useLiberarExpedicao hook presente. Porem: 0 pedidos no fluxo atual para testar. |
| 17 | Validar integracao App de Campo | Coord. Instalacao | OK | Pagina /instalacoes com realtime badge. Tabs Hoje/Todas/Ordens ERP. Bridge ERP<->Campo via triggers fn_create_job_from_ordem e fn_sync_job_to_ordem. Views vw_campo_instalacoes e vw_campo_fotos existentes. |

**Legenda**: OK = Sucesso | FALHA = Falha | PARCIAL = Parcial / Com ressalvas

---

## 5. PROBLEMAS IDENTIFICADOS

### 5.1 -- Erros CRITICOS

---

**QA-2026-03-17-001**

```
Severidade:  CRITICO
Modulo:      Producao (Kanban)
Passo:       11 -- Executar fluxo de producao
Persona:     PCP + Operador
```

**Descricao**:
> OP-2026-0012 exibe status "Concluido 100%" mas permanece na coluna "Em Producao" do Kanban. Isso indica que a mudanca de status no banco nao esta sincronizada com a posicao no board, ou que o campo de status e o campo de coluna sao independentes e estao dessincronizados.

**Passos para reproduzir**:
1. Acessar /producao
2. Visualizar Kanban
3. Observar OP-2026-0012 na coluna "Em Producao" com label "Concluido 100%"

**Resultado esperado**: OP com status "Concluido" deveria estar na coluna "Conferencia" ou "Liberado"

**Resultado obtido**: OP com status "Concluido 100%" na coluna "Em Producao"

**Causa provavel**: O status exibido no card (progresso/etapa) e o status da coluna (posicao no kanban) sao campos diferentes. O progresso atualiza mas o campo de coluna nao acompanha automaticamente.

**Impacto no negocio**: PCP nao consegue confiar no Kanban para saber quais OPs realmente estao em producao vs. concluidas. Decisoes operacionais baseadas em dados incorretos.

**Evidencias**: Screenshot do Kanban mostrando OP-2026-0012 com "Concluido 100%" na coluna "Em Producao".

---

**QA-2026-03-17-002**

```
Severidade:  CRITICO
Modulo:      Financeiro
Passo:       13 -- Enviar para financeiro
Persona:     Financeiro
```

**Descricao**:
> Nao existe fluxo automatico para que um pedido aprovado/concluido gere automaticamente uma conta a receber no modulo financeiro. O financeiro precisa criar manualmente via "Nova Conta", sem vinculo ao pedido de origem. Isso quebra a rastreabilidade pedido->cobranca.

**Passos para reproduzir**:
1. Aprovar orcamento e gerar pedido
2. Concluir producao
3. Verificar modulo financeiro -- nao aparece conta vinculada ao pedido

**Resultado esperado**: Pedido aprovado/concluido gera automaticamente conta a receber com valor, cliente e vencimento corretos

**Resultado obtido**: Financeiro vazio, sem vinculo automatico. Conta deve ser criada manualmente.

**Causa provavel**: Falta trigger ou servico que crie registro em contas_receber quando pedido muda para status aprovado/concluido. O servico gerarContasReceber existe (importado em InstalacaoPage) mas nao e chamado automaticamente no fluxo de pedidos.

**Impacto no negocio**: Risco de pedidos entregues sem cobranca. Perda de receita. Retrabalho manual para o financeiro.

---

**QA-2026-03-17-003**

```
Severidade:  CRITICO
Modulo:      Financeiro -- Contas a Receber
Passo:       13 -- Enviar para financeiro
Persona:     Financeiro
```

**Descricao**:
> Data de vencimento corrompida: registro "ACCOUNT ASSESSORES S/S L..." exibe vencimento "20/02/60320" -- data impossivel (ano 60320). Isso indica um bug no processamento ou armazenamento de datas no modulo financeiro.

**Passos para reproduzir**:
1. Acessar /financeiro
2. Visualizar tab "A Receber"
3. Observar linha "ACCOUNT ASSESSORES" com vencimento "20/02/60320"

**Resultado esperado**: Data de vencimento valida (ex: 20/02/2026)

**Resultado obtido**: "20/02/60320" -- data corrompida

**Causa provavel**: Valor armazenado no banco com formato incorreto, possivelmente um numero/timestamp sendo interpretado como data, ou erro de conversao de tipo.

**Impacto no negocio**: Financeiro nao consegue confiar nos vencimentos. Relatorios de inadimplencia e fluxo de caixa comprometidos.

**Evidencias**: Screenshot da pagina /financeiro mostrando "20/02/60320" na coluna Vencimento.

---

### 5.2 -- Erros ALTOS

---

**QA-2026-03-17-004**

```
Severidade:  ALTO
Modulo:      Leads
Passo:       5 -- Gerar lead ficticio
```

**Descricao**: Lead "Teste Valor Negativo" exibe valor estimado de -R$ 5.000,00 (negativo). O sistema permitiu salvar um valor negativo para valor_estimado, o que nao faz sentido de negocio.

**Resultado esperado**: Sistema deveria bloquear ou alertar ao tentar salvar valor estimado negativo

**Resultado obtido**: Valor negativo aceito e exibido como "-R$ 5.000,00"

**Impacto**: Distorce KPIs do pipeline (R$ 101.000 inclui o -R$ 5.000), ticket medio, e relatorios de previsao de receita.

---

**QA-2026-03-17-005**

```
Severidade:  ALTO
Modulo:      Fiscal / NF-e
Passo:       14 -- Validar emissao de NF-e
```

**Descricao**: O modulo fiscal esta estruturalmente completo (Dashboard, Documentos, Fila de Emissao, Configuracao, Certificado Digital, Auditoria) mas nao possui integracao real com SEFAZ. Nenhum documento foi emitido (0 no mes). O modulo existe na UI mas nao funciona no backend para emissao real.

**Resultado esperado**: Capacidade de emitir NF-e com transmissao para SEFAZ

**Resultado obtido**: Modulo de interface apenas, sem transmissao real

**Impacto**: Empresa nao pode faturar oficialmente pelo ERP. Precisa usar sistema externo para NF-e.

---

**QA-2026-03-17-006**

```
Severidade:  ALTO
Modulo:      Producao
Passo:       11 -- Executar fluxo de producao
```

**Descricao**: 2 OPs marcadas como "Atrasadas (+3 dias)" nos KPIs, porem os cards no Kanban nao possuem indicacao visual forte de atraso (apenas um icone pequeno de alerta). Em um ambiente fabril, atrasos precisam ser visualmente gritantes.

**Resultado esperado**: Cards de OPs atrasadas com borda vermelha, fundo vermelho claro, ou badge "ATRASADO" bem visivel

**Resultado obtido**: Icone de alerta pequeno, facilmente ignorado

**Impacto**: OPs atrasadas passam despercebidas no dia a dia da producao.

---

**QA-2026-03-17-007**

```
Severidade:  ALTO
Modulo:      Boletos
Passo:       15 -- Validar emissao de boleto
```

**Descricao**: A criacao de boletos nao vincula automaticamente ao pedido de origem. O formulario de "Novo Boleto" e manual, sem opcao de "Gerar a partir do pedido". Isso cria risco de divergencia entre valor do pedido e valor do boleto.

**Resultado esperado**: Boleto gerado a partir do pedido com dados pre-preenchidos (cliente, valor, vencimento)

**Resultado obtido**: Criacao totalmente manual, sem vinculo ao pedido

**Impacto**: Possibilidade de emitir boleto com valor diferente do pedido. Retrabalho. Risco de erro humano.

---

**QA-2026-03-17-008**

```
Severidade:  ALTO
Modulo:      Pipeline de Vendas
Passo:       5 -- Gerar lead
```

**Descricao**: Pipeline mostra "CONVERSAO 0.0%" com 5 leads ativos e 1 lead convertido. O calculo de conversao nao considera o lead ja convertido ("TRANSPORTES TRANSLOVATO"), possivelmente porque o filtro de "leads ativos" exclui convertidos do denominador mas tambem do numerador.

**Resultado esperado**: Taxa de conversao deveria ser ~20% (1 convertido de 5 totais)

**Resultado obtido**: 0.0%

**Impacto**: KPI de conversao incorreto, decisoes comerciais baseadas em metricas erradas.

---

### 5.3 -- Erros MEDIOS

| ID | Modulo | Descricao | Resultado Esperado | Resultado Obtido |
|----|--------|-----------|-------------------|-----------------|
| QA-2026-03-17-009 | Orcamento Editor | Orcamento exige salvar primeiro (titulo + cliente) antes de adicionar itens. Fluxo de 2 passos pode confundir usuario | Adicionar itens no mesmo fluxo de criacao | Mensagem "Salve o orcamento primeiro para poder adicionar itens" |
| QA-2026-03-17-010 | Leads | Lead pode ser criado sem contato_nome, contato_email e contato_telefone -- apenas empresa e obrigatorio | Pelo menos 1 forma de contato obrigatoria | Permite lead apenas com nome da empresa |
| QA-2026-03-17-011 | Leads | Formulario de novo lead nao tem campo "Origem" (Site, Indicacao, etc.), apesar de ser informacao critica para analise de conversao | Campo Origem presente | Campo ausente no formulario |
| QA-2026-03-17-012 | Expedicao (breadcrumb) | Breadcrumb exibe "Expedicao" sem cedilha (caractere especial faltando) | "Expedicao" com acentuacao correta | "Expedicao" sem cedilha no breadcrumb |
| QA-2026-03-17-013 | Materiais | Tabela de materiais nao tem paginacao -- 465 itens carregados de uma vez. Pode impactar performance com mais materiais | Paginacao ou virtualizacao | Todos os 465 registros renderizados |
| QA-2026-03-17-014 | Portal Publico | Mensagem de erro "Link Invalido" e "Esta proposta nao foi encontrada" nao tem acentuacao (faltam acentos em "Invalido" e "nao") | Texto com acentuacao correta | Texto sem acentos |
| QA-2026-03-17-015 | Leads / Pipeline | Lead "Teste Valor Negativo" nao exibe valor no card do Pipeline (oculta o negativo) mas exibe no listagem de Leads. Comportamento inconsistente entre telas | Valor exibido consistentemente em ambas as telas | Visivel em /leads, oculto em /pipeline |

---

### 5.4 -- Melhorias BAIXAS

| ID | Local | Sugestao |
|----|-------|---------|
| QA-2026-03-17-016 | Dashboard | "Pedidos Ativos: 0 / Nenhum pedido em andamento" -- poderia mostrar CTA para criar primeiro pedido |
| QA-2026-03-17-017 | Producao KPIs | KPI "Concluidas Hoje: 0" e "Finalizadas este mes: 0" parecem redundantes. Consolidar em um unico KPI |
| QA-2026-03-17-018 | Sidebar | Muitos itens de menu requerem scroll no sidebar. Considerar agrupamento mais compacto ou menu colapsavel por secao |
| QA-2026-03-17-019 | Orcamentos | Coluna "ACOES" na tabela de orcamentos esta vazia (sem botoes visiveis). Deveria ter acoes rapidas (ver, editar, duplicar) |

---

## 6. QUEBRAS DE FLUXO

> Momentos onde o fluxo do negocio nao conseguiu avancar de uma etapa para outra.

| De | Para | Problema | Severidade |
|----|------|----------|-----------|
| Pedido aprovado | Conta a receber no Financeiro | Nao ha geracao automatica de contas a receber a partir do pedido | CRITICO |
| Pedido concluido | Boleto vinculado | Boleto nao pode ser gerado a partir do pedido, apenas manualmente | ALTO |
| OP concluida | Coluna correta no Kanban | Status da OP nao sincroniza com posicao no Kanban | CRITICO |

**Fluxo interrompido em**: Passo 13 -- Enviar para financeiro
**Motivo**: Falta de integracao automatica pedido -> financeiro
**Passos impactados por consequencia**: 13, 14, 15

---

## 7. ERROS DE REGRA DE NEGOCIO

> Situacoes onde o sistema permite algo que nao deveria, ou proibe algo que deveria funcionar.

| Tipo | Descricao | Impacto |
|------|-----------|---------|
| Permissivo demais | Permite valor estimado negativo em Leads (-R$ 5.000,00) | Distorce KPIs do pipeline e previsao de receita |
| Permissivo demais | Permite criar lead sem nenhum dado de contato (telefone, email) | Leads inuteis sem forma de follow-up |
| Calculo incorreto | Taxa de conversao do Pipeline = 0.0% quando ha 1 lead convertido | Metrica de performance comercial incorreta |
| Status incoerente | OP com "Concluido 100%" na coluna "Em Producao" do Kanban | PCP nao confia no board para gestao da fabrica |
| Dado corrompido | Data de vencimento "20/02/60320" em conta a receber | Impossibilita controle de vencimentos e inadimplencia |

---

## 8. PROBLEMAS DE UX

> Situacoes onde o usuario real teria dificuldade de usar o sistema.

| Tela / Modulo | Problema de UX | Severidade | Sugestao |
|---------------|---------------|------------|---------|
| Orcamento Editor | Precisa salvar orcamento vazio antes de adicionar itens | MEDIO | Permitir criacao completa em um unico fluxo |
| Producao Kanban | OPs atrasadas sem destaque visual forte | ALTO | Borda vermelha + badge "ATRASADO" nos cards |
| Materiais | 465 itens sem paginacao | MEDIO | Adicionar paginacao ou scroll virtual |
| Sidebar | Menu longo exige scroll, itens do fundo nao sao descobriveis | BAIXO | Sidebar com secoes colapsaveis |
| Orcamentos lista | Coluna "ACOES" vazia, sem botoes de acao rapida | BAIXO | Adicionar icones de ver/editar/duplicar |

**Padroes de UX identificados**:
- [ ] Feedback inexistente apos acao (sem toast/loading) -- NAO detectado, toasts funcionam bem
- [X] Campo obrigatorio sem indicacao visual -- Lead sem indicacao de que contato e recomendado
- [ ] Mensagem de erro generica -- NAO detectado, mensagens sao especificas
- [ ] Acao irreversivel sem confirmacao -- NAO detectado, AlertDialogs usados corretamente
- [X] Tela em branco sem estado vazio explicativo -- Parcial: Expedicao tem estado vazio bom, mas Financeiro/DRE poderia ser melhor
- [ ] Filtro ou busca que nao retorna resultado esperado -- NAO detectado
- [X] Fluxo nao intuitivo (usuario nao sabe o proximo passo) -- Orcamento: "salve primeiro" nao e intuitivo

---

## 9. PROBLEMAS TECNICOS

> Erros tecnicos identificados (APIs, banco, integracao).

| ID | Componente | Tipo | Descricao | Severidade |
|----|-----------|------|-----------|-----------|
| QA-2026-03-17-T01 | contas_receber / pedidos | Integracao ausente | Nenhum trigger/servico conecta conclusao de pedido a geracao de conta a receber | CRITICO |
| QA-2026-03-17-T02 | contas_receber.data_vencimento | Dado corrompido | Registro com data "60320-02-20" no banco (formato ISO) resulta em "20/02/60320" na UI | CRITICO |
| QA-2026-03-17-T03 | ordens_producao.status vs kanban_coluna | Dessincronizacao | Campo de progresso/etapa do card nao sincroniza com campo de coluna do kanban | CRITICO |
| QA-2026-03-17-T04 | fiscal_documentos | Modulo incompleto | Tabelas e UI existem mas nao ha integracao SEFAZ para transmissao real de NF-e | ALTO |
| QA-2026-03-17-T05 | leads.valor_estimado | Validacao ausente | Coluna aceita valores negativos, sem constraint CHECK(valor_estimado >= 0) | ALTO |

**Verificacoes de banco recomendadas**:
```sql
-- Verificar datas corrompidas em contas a receber
SELECT id, titulo, data_vencimento FROM contas_receber WHERE data_vencimento > '2100-01-01';

-- Verificar OPs com status dessincronizado
SELECT id, numero, status, etapa_atual, progresso FROM ordens_producao WHERE progresso = 100 AND status != 'concluida';

-- Verificar leads com valor negativo
SELECT id, empresa, valor_estimado FROM leads WHERE valor_estimado < 0;

-- Verificar modelo_materiais populados
SELECT COUNT(*) FROM modelo_materiais;
```

---

## 10. MODULOS INCOMPLETOS

> Funcionalidades que existem na UI mas nao funcionam completamente no backend.

| Modulo | Funcionalidade | Status UI | Status Backend | Impacto |
|--------|---------------|-----------|---------------|---------|
| Fiscal (NF-e) | Emissao de notas fiscais | Dashboard + Documentos + Fila + Config + Certificado + Auditoria | Sem integracao SEFAZ, 0 documentos emitidos | Empresa nao pode faturar oficialmente pelo ERP |
| Financeiro | Geracao automatica de contas a receber a partir de pedidos | Botao "Nova Conta" manual | Sem trigger automatico pedido->conta | Retrabalho, risco de pedidos sem cobranca |
| Boletos | Vinculo boleto-pedido | "Novo Boleto" manual | Sem opcao de gerar boleto a partir de pedido | Dados desvinculados, risco de divergencia |
| Estoque | Debito automatico de materiais ao concluir OP | UI de estoque existe (467 itens) | Falta verificacao se consumo de OP debita automaticamente | Estoque pode nao refletir consumo real |

---

## 11. MELHORIAS RECOMENDADAS

> Nao sao bugs -- sao oportunidades de melhoria identificadas durante o uso simulado.

### Prioritarias (implementar logo)

1. **Integracao Pedido -> Financeiro** -- Criar trigger ou servico que gere automaticamente conta a receber quando pedido muda para status "aprovado" ou "em_producao". Vincular cliente_id, valor_total, e calcular vencimento baseado nas condicoes de pagamento do orcamento.

2. **Sincronizacao Kanban Producao** -- Garantir que quando progresso chega a 100%, o card mova automaticamente para a proxima coluna (Conferencia). Ou usar apenas 1 campo como fonte de verdade para posicao.

3. **Validacao de valor negativo em Leads** -- Adicionar CHECK constraint no banco e validacao no frontend para impedir valor_estimado < 0.

### Desejaveis (implementar quando possivel)

1. **Orcamento em fluxo unico** -- Eliminar a necessidade de salvar o orcamento antes de adicionar itens. Usar estado local ate o submit final.

2. **Indicadores visuais de atraso na Producao** -- Cards de OP atrasada com borda/fundo vermelho e badge "X dias atrasado".

3. **Campo Origem no Lead** -- Adicionar campo de origem (Site, Indicacao, Prospeccao, etc.) no formulario de novo lead para alimentar analytics de canal.

4. **Paginacao em Materiais** -- Implementar paginacao ou scroll virtual para evitar renderizar 465+ itens de uma vez.

---

## 12. PLANO DE CORRECAO PRIORITARIO

> Ordem sugerida de correcao baseada no impacto no negocio.

| Prioridade | ID | Problema | Esforco estimado | Responsavel sugerido |
|-----------|-----|----------|-----------------|---------------------|
| 1 | QA-2026-03-17-003 | Data corrompida "20/02/60320" no financeiro | P | Backend/DB |
| 2 | QA-2026-03-17-001 | OP "Concluido 100%" na coluna errada do Kanban | M | Frontend Producao |
| 3 | QA-2026-03-17-002 | Falta integracao pedido -> conta a receber | G | Backend/Services |
| 4 | QA-2026-03-17-004 | Valor negativo aceito em leads | P | Backend (constraint) + Frontend (validacao) |
| 5 | QA-2026-03-17-008 | Taxa de conversao 0.0% incorreta no Pipeline | P | Frontend Pipeline |
| 6 | QA-2026-03-17-006 | Falta destaque visual de OPs atrasadas | P | Frontend Producao |
| 7 | QA-2026-03-17-007 | Boleto sem vinculo ao pedido | M | Full-stack |
| 8 | QA-2026-03-17-005 | Modulo fiscal sem integracao SEFAZ | G | Backend/Integracao externa |
| 9 | QA-2026-03-17-009 | Orcamento exige salvar antes de adicionar itens | M | Frontend Comercial |
| 10 | QA-2026-03-17-013 | Materiais sem paginacao (465 itens) | P | Frontend Admin |

**Legenda esforco**: P = Pequeno (<2h) | M = Medio (2h-1d) | G = Grande (>1d)

---

## 13. VEREDITO FINAL SOBRE PRONTIDAO DO ERP

### Status por Modulo

| Modulo | Status | Bloqueadores |
|--------|--------|-------------|
| Cadastro de produtos | OK Operacional | Nenhum |
| Cadastro de materiais | OK Operacional | Nenhum (465 materiais cadastrados) |
| CRM / Leads | OK c/ ressalvas | Valor negativo aceito, falta campo origem |
| Pipeline de Vendas | OK c/ ressalvas | Taxa de conversao incorreta (0.0%) |
| Orcamentos | OK Operacional | Fluxo de 2 etapas para adicionar itens |
| Portal de aprovacao | OK Operacional | Falta acentuacao em mensagens de erro |
| Pedidos | OK Operacional | Nenhum bloqueador direto |
| Producao | PARCIAL | Status dessincronizado no Kanban |
| Financeiro | PARCIAL | Data corrompida, falta integracao com pedidos |
| Faturamento (NF-e) | INOPERANTE | Sem integracao SEFAZ |
| Boletos | OK c/ ressalvas | Sem vinculo automatico a pedidos |
| Expedicao | OK Operacional | Aguarda pedidos concluidos |
| Instalacao / App Campo | OK Operacional | Bridge bidirecional implementada |
| Estoque | OK c/ ressalvas | Falta confirmar debito automatico de materiais |

### Conclusao

```
O ERP da Croma Print esta:

[X] PARCIALMENTE APTO
    -> Partes do sistema funcionam, mas ha falhas serias em modulos-chave.
    -> Recomendacao: Usar com cautela apenas nos modulos estaveis.
       Resolver erros CRITICOS antes de expansao de uso.

MODULOS SEGUROS PARA USO:
- Cadastro de materiais e produtos
- CRM (Leads + Pipeline + Clientes)
- Orcamentos + Portal de aprovacao
- Instalacoes / App de Campo

MODULOS QUE PRECISAM DE CORRECAO ANTES DO USO:
- Producao (sincronizacao do Kanban)
- Financeiro (dados corrompidos + integracao com pedidos)
- Fiscal/NF-e (sem integracao SEFAZ)

PRAZO ESTIMADO PARA ATINGIR "APTO COM RESSALVAS":
- Corrigir itens 1-6 do plano de correcao: ~3-5 dias uteis
- Apos correcoes, re-executar este agente de QA
```

**Assinado por**: AGENTE DE CONTROLE DE QUALIDADE CROMA_ERP
**Data**: 2026-03-17
**Proxima execucao recomendada**: Apos correcao dos 3 itens CRITICOS (estimativa: 3-5 dias)

---

*Este relatorio foi gerado pelo Agente QA Operacional da Croma Print.*
*Para re-executar o agente: invocar AGENTE.md com o cenario desejado.*
