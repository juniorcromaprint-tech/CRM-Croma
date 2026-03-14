# CENÁRIOS DE TESTE — AGENTE QA CROMA_ERP

> Fluxos detalhados, dados fictícios e critérios de aceitação para cada passo.
> O agente deve executar o **Cenário Padrão** em toda execução e os **Cenários Adicionais** quando relevante.

---

## CENÁRIO PADRÃO — BANNER TESTE (Execução Obrigatória)

### Produto de Referência

```
Nome do produto: Banner-Teste
Categoria: Banner
Tipo: Sob encomenda
Unidade de venda: un

Variações:
  - Banner 60x80  (0,60m × 0,80m = 0,48 m²)
  - Banner 70x100 (0,70m × 1,00m = 0,70 m²)
  - Banner 90x120 (0,90m × 1,20m = 1,08 m²)  ← variação principal dos testes

Composição por unidade (Banner 90x120):
  - Lona 440g:        1,08 m²
  - Bastão superior:  0,92 m
  - Bastão inferior:  0,92 m
  - Ponteira:         4 un
  - Cordinha:         0,50 m
  - Tinta HP Latex:   150 ml (impressão digital)

Processos:
  - Impressão digital (Ampla Targa XT ou HP Latex — 1,60m boca)
  - Acabamento manual (bastões + ponteiras + cordinha)

Máquinas disponíveis:
  - Ampla Targa XT (boca 1,80m) — compatível com Banner 90x120 ✅
  - HP Latex (boca 1,60m) — compatível com Banner 90x120 ✅
```

---

### FLUXO DE 17 PASSOS

---

#### PASSO 1 — Cadastrar Matéria-Prima
**Persona**: Operador de Cadastro
**Módulo ERP**: Estoque / Materiais

**Ações**:
1. Acessar: Estoque → Materiais → Novo Material
2. Cadastrar cada um dos 6 materiais da composição (ver tabela em OPERAÇÕES.md)
3. Para cada material: preencher nome, unidade, preço médio, categoria

**Verificações**:
- [ ] Formulário carrega sem erro
- [ ] Todos os campos obrigatórios estão presentes e nomeados corretamente
- [ ] Material salva e aparece na listagem
- [ ] Preço persiste após recarregar a página
- [ ] Material disponível para seleção na composição de produtos

**Critério de aceitação**: Todos os 6 materiais cadastrados e disponíveis.

**Erros esperados conhecidos**:
- Se `modelo_materiais` estiver vazio (0 registros no banco), o custo nunca será calculado — registrar CRÍTICO.

---

#### PASSO 2 — Criar Produto Banner-Teste
**Persona**: Operador de Cadastro
**Módulo ERP**: Produtos / Catálogo

**Ações**:
1. Acessar: Produtos → Novo Produto
2. Preencher: Nome = "Banner-Teste", Categoria = Banner, Tipo = Sob encomenda
3. Salvar

**Verificações**:
- [ ] Produto salva com ID gerado
- [ ] Produto aparece na listagem de produtos
- [ ] Produto disponível para seleção no orçamento

**Critério de aceitação**: Produto "Banner-Teste" visível e selecionável.

---

#### PASSO 3 — Criar Variações de Tamanho
**Persona**: Operador de Cadastro
**Módulo ERP**: Produtos → Modelos

**Ações**:
1. Dentro do produto Banner-Teste, criar 3 modelos:
   - Banner 60x80 (L: 0,60 / A: 0,80)
   - Banner 70x100 (L: 0,70 / A: 1,00)
   - Banner 90x120 (L: 0,90 / A: 1,20)

**Verificações**:
- [ ] Campo de dimensões (largura/altura) existe e é numérico
- [ ] Área é calculada automaticamente (L × A)
- [ ] Cada modelo salva com suas dimensões corretas
- [ ] Modelos aparecem na seleção do orçamento

**Critério de aceitação**: 3 modelos criados com área calculada corretamente.

---

#### PASSO 4 — Compor o Produto com Matérias-Primas e Processos
**Persona**: Operador de Cadastro / PCP
**Módulo ERP**: Produtos → Composição

**Ações**:
1. Selecionar modelo "Banner 90x120"
2. Adicionar cada material com quantidade por unidade:
   - Lona 440g: 1,08 m² (ou fórmula: L × A × 1,05)
   - Bastão superior: 0,92 m (ou fórmula: L + 0,02)
   - Bastão inferior: 0,92 m (igual superior)
   - Ponteira: 4 un (fixo)
   - Cordinha: 0,50 m (fixo)
   - Tinta HP Latex: 150 ml (estimativa por m²)
3. Adicionar processos: Impressão digital, Acabamento manual

**Verificações**:
- [ ] Interface de composição existe e permite adicionar materiais
- [ ] Quantidade pode ser digitada em número ou fórmula
- [ ] Após salvar, composição persiste (verificar via Supabase: `modelo_materiais`)
- [ ] Custo total calculado = R$ 43,21 (±5%)
- [ ] Custo exibido na tela de composição

**Critério de aceitação**: Composição salva E custo calculado > R$ 0,00.

**⚠️ Nota crítica**: Este é o passo mais propenso a falhar. O problema conhecido é que `modelo_materiais` tem 0 registros — se a composição não salvar no banco, registrar como CRÍTICO imediatamente.

---

#### PASSO 5 — Gerar Lead Fictício
**Persona**: Vendedor
**Módulo ERP**: CRM / Leads

**Dados do lead**:
```
Nome: Rafael Mendonça
Empresa: Papelaria São Lucas Ltda
Telefone: (11) 99234-5678
E-mail: rafael@papelariaslucas.com.br
Origem: Site
Interesse: Banners para campanha de Páscoa
```

**Ações**:
1. Acessar: CRM → Leads → Novo Lead
2. Preencher dados acima
3. Salvar

**Verificações**:
- [ ] Formulário de lead existe e está acessível
- [ ] Lead salva com status inicial correto
- [ ] Lead aparece no funil/kanban de CRM
- [ ] Data de criação registrada

**Critério de aceitação**: Lead visível no funil com dados corretos.

---

#### PASSO 6 — Converter Lead em Cliente
**Persona**: Vendedor
**Módulo ERP**: CRM → Clientes

**Ações**:
1. Abrir lead "Rafael Mendonça"
2. Clicar em "Converter em Cliente" (ou equivalente)
3. Complementar dados: CNPJ = 34.567.890/0001-12, IE = 123.456.789.110
4. Preencher endereço completo
5. Confirmar conversão

**Verificações**:
- [ ] Botão de conversão existe e funciona
- [ ] Dados do lead migram para o cadastro de cliente
- [ ] Cliente aparece em Clientes com dados completos
- [ ] Lead muda de status para "convertido" (não some)
- [ ] CNPJ validado (dígitos verificadores)

**Critério de aceitação**: Cliente "Papelaria São Lucas" cadastrado com todos os dados do lead + CNPJ.

---

#### PASSO 7 — Gerar Orçamento
**Persona**: Orçamentista
**Módulo ERP**: Orçamentos / Vendas

**Ações**:
1. Novo Orçamento → selecionar cliente "Papelaria São Lucas"
2. Adicionar item: produto "Banner-Teste", modelo "90x120", quantidade 10
3. Verificar preço calculado
4. Adicionar prazo: 5 dias úteis
5. Adicionar observação: "Arte já aprovada"
6. Salvar orçamento

**Verificações**:
- [ ] Cliente pode ser selecionado
- [ ] Produto e modelo aparecem na seleção
- [ ] Preço unitário calculado automaticamente (deve ser > R$ 0,00)
- [ ] Total = preço unitário × 10
- [ ] Markup aplicado (preço venda > custo)
- [ ] Orçamento salva com número sequencial

**Valores esperados**:
```
Custo unitário:   R$ 43,21
Markup (3,5×):    aplicado
Preço venda:      R$ 151,24 (referência)
Total (×10):      R$ 1.512,40 (referência)
```

**⚠️ Problema crítico conhecido**: Se `modelo_materiais` = 0 registros, custo = R$ 0,00 e preço = R$ 0,00. Registrar CRÍTICO.

**Critério de aceitação**: Total do orçamento > R$ 0,00.

---

#### PASSO 8 — Enviar Orçamento por Link (Portal)
**Persona**: Orçamentista
**Módulo ERP**: Orçamentos → Portal

**Ações**:
1. Abrir orçamento criado
2. Clicar em "Enviar / Gerar Link" ou equivalente
3. Copiar link gerado (formato: `/p/{token}`)
4. Abrir link em aba anônima (sem autenticação)

**Verificações**:
- [ ] Botão de envio/link existe
- [ ] Link é gerado com token único
- [ ] Link abre sem necessidade de login
- [ ] Portal exibe: cliente, produto, quantidade, valor, prazo
- [ ] Portal exibe: dados da Croma Print (nome, contato)
- [ ] Botão "Aprovar" ou "Aceitar Proposta" está visível

**Critério de aceitação**: Link funcionando, proposta legível, botão de aprovação visível.

---

#### PASSO 9 — Simular Aprovação do Cliente
**Persona**: Cliente (simulado)
**Módulo**: Portal Público (`/p/{token}`)

**Ações**:
1. No portal público, clicar em "Aprovar Proposta"
2. Preencher nome e e-mail do cliente (se solicitado)
3. Confirmar aprovação

**Verificações**:
- [ ] Aprovação é registrada no banco
- [ ] Status do orçamento muda para "aprovado" no ERP
- [ ] Notificação gerada para o vendedor/equipe
- [ ] Portal exibe mensagem de confirmação ao cliente

**Critério de aceitação**: Orçamento com status "aprovado" e pedido gerado (ou pronto para gerar).

---

#### PASSO 10 — Gerar Ordem de Serviço / Pedido
**Persona**: Vendedor / Orçamentista
**Módulo ERP**: Pedidos

**Ações**:
1. A partir do orçamento aprovado, confirmar geração do pedido
2. Verificar dados do pedido gerado

**Verificações**:
- [ ] Pedido existe com número sequencial
- [ ] Pedido vinculado ao orçamento (FK)
- [ ] Pedido contém os itens corretos (Banner 90x120 × 10)
- [ ] Valor do pedido = valor do orçamento
- [ ] Status do pedido: "em_producao" ou equivalente

**Critério de aceitação**: Pedido criado com itens e valor corretos.

---

#### PASSO 11 — Executar Fluxo de Produção
**Persona**: PCP + Operador de Produção
**Módulo ERP**: Produção / OPs

**Ações**:
1. PCP: criar OP a partir do pedido
2. PCP: alocar máquina (Ampla Targa XT)
3. PCP: definir prazo de produção
4. Operador: iniciar OP (status: "em_producao")
5. Operador: registrar progresso

**Verificações**:
- [ ] OP pode ser criada a partir do pedido
- [ ] Máquina pode ser selecionada (Targa XT ou HP Latex)
- [ ] OP mostra os materiais necessários (da composição)
- [ ] Status da OP transiciona: pendente → em_producao

**Critério de aceitação**: OP criada, máquina alocada, produção iniciada.

---

#### PASSO 12 — Finalizar Produção
**Persona**: Operador de Produção
**Módulo ERP**: Produção

**Ações**:
1. Marcar OP como concluída
2. Registrar: data/hora de conclusão, operador responsável

**Verificações**:
- [ ] OP muda para status "concluida"
- [ ] Data de conclusão registrada
- [ ] Estoque de materiais descontado (se módulo de estoque ativo)
- [ ] Pedido muda de status (para "producao_concluida" ou equivalente)
- [ ] PCP visualiza conclusão na listagem de OPs

**Critério de aceitação**: OP concluída e pedido atualizado.

---

#### PASSO 13 — Enviar Pedido para Financeiro
**Persona**: PCP / Vendedor
**Módulo ERP**: Financeiro

**Ações**:
1. Liberar pedido para financeiro
2. Financeiro: visualizar pedidos pendentes de cobrança

**Verificações**:
- [ ] Pedido aparece no módulo financeiro
- [ ] Valor a cobrar = valor do pedido
- [ ] Dados do cliente corretos (para gerar boleto/NF)

**Critério de aceitação**: Pedido visível no financeiro com valor correto.

---

#### PASSO 14 — Validar Emissão de Nota Fiscal
**Persona**: Faturamento
**Módulo ERP**: Fiscal / NF-e

**Ações**:
1. Selecionar pedido para faturamento
2. Iniciar processo de NF-e
3. Verificar dados pré-preenchidos (CNPJ cliente, produtos, valores)
4. Verificar cálculo de impostos

**Verificações**:
- [ ] Módulo de NF-e existe e é acessível
- [ ] Dados do cliente puxados corretamente
- [ ] Produtos e valores corretos
- [ ] Impostos calculados (ICMS, PIS, COFINS)
- [ ] NF-e pode ser emitida (ou ao menos criada no sistema)

**Critério de aceitação**: NF-e com dados corretos, pronta para emissão.

**Nota**: Se o módulo fiscal não estiver integrado com SEFAZ, verificar ao menos se os dados estão estruturados corretamente.

---

#### PASSO 15 — Validar Emissão de Boleto
**Persona**: Financeiro
**Módulo ERP**: Financeiro / Cobrança

**Ações**:
1. Gerar boleto/cobrança para o pedido
2. Verificar: valor, vencimento, dados do sacado

**Verificações**:
- [ ] Módulo de cobrança existe
- [ ] Boleto gerado com valor correto
- [ ] Dados do cliente corretos no boleto
- [ ] Vencimento calculado corretamente

**Critério de aceitação**: Cobrança gerada com valor e dados corretos.

---

#### PASSO 16 — Liberar para Entrega ou Instalação
**Persona**: Financeiro / Expedição
**Módulo ERP**: Expedição / Instalação

**Ações**:
1. Após pagamento simulado: liberar pedido para entrega
2. Verificar status do pedido: "liberado_entrega" ou equivalente
3. Expedição: registrar entrega ou encaminhar para instalação

**Verificações**:
- [ ] Pedido pode ser liberado após pagamento
- [ ] Status do pedido atualiza
- [ ] Expedição visualiza pedido liberado
- [ ] Pode-se registrar: entrega direta OU encaminhar para instalação

**Critério de aceitação**: Pedido liberado e roteado para entrega ou instalação.

---

#### PASSO 17 — Validar Integração com App de Campo (se houver instalação)
**Persona**: Coordenador de Instalação
**Módulo ERP**: Instalações + App de Campo

**Ações**:
1. Criar Ordem de Instalação (OI) vinculada ao pedido
2. Preencher: data agendada, técnico responsável, endereço
3. Mudar status da OI para "agendada"
4. Verificar criação automática do job no App de Campo (trigger `fn_create_job_from_ordem`)
5. Simular técnico iniciando job → verificar status "em_execucao" no ERP
6. Simular técnico concluindo job → verificar status "concluida" no ERP
7. Verificar view `vw_campo_instalacoes` com dados completos

**Verificações**:
- [ ] OI criada e vinculada ao pedido
- [ ] Job criado automaticamente ao agendar OI
- [ ] Sincronização bidirecional de status funciona
- [ ] View `vw_campo_instalacoes` retorna dados não-vazios
- [ ] Photos/assinaturas contabilizadas na view

**Critério de aceitação**: Bridge ERP↔Campo funcionando em ambas as direções.

---

## CENÁRIOS ADICIONAIS

### Cenário A — Produto Fora do Padrão de Máquina
Criar Banner de 2,00m de largura → Verificar se o sistema alerta que nenhuma máquina comporta (Targa: 1,80m, HP: 1,60m).

**Verificação**: Sistema deve alertar incompatibilidade de máquina.

---

### Cenário B — Orçamento com Desconto
Aplicar 15% de desconto no orçamento → Verificar se o total reflete o desconto, se a comissão é calculada sobre o valor com ou sem desconto.

---

### Cenário C — Cliente com Pedido em Aberto
Tentar gerar novo orçamento para cliente com pagamento pendente → Verificar se sistema alerta ou bloqueia.

---

### Cenário D — Múltiplos Produtos no Orçamento
Adicionar 3 produtos diferentes ao mesmo orçamento → Verificar se o total é a soma correta de todos os itens.

---

### Cenário E — Cancelamento de Pedido em Produção
Cancelar pedido que já está em produção → Verificar o que acontece com a OP em andamento.

---

## DADOS FICTÍCIOS EXTRAS (para variação nos testes)

### Cliente 2
```
Empresa: Calçados Vêneto SA
CNPJ: 12.345.678/0001-90
Contato: Juliana Ferreira
E-mail: juliana@calcadosvêneto.com.br
Cidade: Novo Hamburgo / RS
```

### Cliente 3
```
Empresa: Supermercados Bom Dia Ltda
CNPJ: 98.765.432/0001-11
Contato: Carlos Andrade
E-mail: carlos@bomdiasuper.com.br
Cidade: Belo Horizonte / MG
```
