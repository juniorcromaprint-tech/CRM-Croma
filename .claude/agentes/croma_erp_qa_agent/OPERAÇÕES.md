# OPERAÇÕES — AGENTE QA CROMA_ERP

> Detalhamento completo dos 10 módulos operacionais do agente.
> Cada módulo descreve o que executar, o que verificar e o que constitui falha.

---

## MÓDULO 1 — SIMULADOR DE OPERAÇÕES

**Responsabilidade**: Orquestrar a execução completa do agente.

### Protocolo de Execução

```
INÍCIO DA SESSÃO
  → Registrar: data/hora, versão do sistema, commit hash se disponível
  → Inicializar: contador de erros por severidade
  → Carregar: CENÁRIOS_DE_TESTE.md

PARA CADA PASSO DO CENÁRIO:
  → Anunciar persona ativa
  → Anunciar passo em execução (ex: [PASSO 5/17])
  → Executar ação
  → Capturar resultado (sucesso / erro / comportamento inesperado)
  → Registrar no log em tempo real
  → Passar para próximo passo

FIM DA SESSÃO
  → Compilar todos os achados
  → Calcular resumo por severidade
  → Gerar relatório via MÓDULO 10
```

### O que registrar em cada passo
- Ação executada
- Resposta do sistema (tempo de resposta, dados retornados)
- Dados gravados no banco (via Supabase)
- Comparação com comportamento esperado
- Qualquer desvio, mesmo que "pequeno"

---

## MÓDULO 2 — GERAÇÃO DE DADOS

**Responsabilidade**: Produzir dados fictícios realistas para os testes.

### Dados de Cliente Fictício (padrão)

```
Empresa: Papelaria São Lucas Ltda
CNPJ: 34.567.890/0001-12
IE: 123.456.789.110
Nome do contato: Rafael Mendonça
Cargo: Gerente de Marketing
E-mail: rafael@papelariaslucas.com.br
Telefone: (11) 99234-5678
Endereço: Rua das Flores, 892, Sala 3
Bairro: Vila Mariana
Cidade: São Paulo / SP
CEP: 04117-010
```

### Dados do Orçamento Fictício (padrão)

```
Produto: Banner-Teste
Variação: 90x120 cm
Quantidade: 10 unidades
Prazo solicitado: 5 dias úteis
Observação: Arte já aprovada, enviar em até 48h
Forma de pagamento: Boleto 30 dias
```

### Dados de Lead Fictício (padrão)

```
Nome: Rafael Mendonça
Empresa: Papelaria São Lucas
Origem: Site
Interesse: Banners para campanha de Páscoa
Orçamento estimado: R$ 2.000,00
```

### Variações para Testes de Borda

O agente deve também testar com dados-limite:
- Cliente sem IE (Pessoa Física)
- CNPJ inválido (verificar se sistema valida)
- E-mail sem @ (verificar validação)
- Quantidade = 0 (verificar se bloqueia)
- Quantidade = 9.999 (testar limite superior)
- Valor = R$ 0,01 (verificar se permite)
- Data de entrega no passado (verificar bloqueio)

---

## MÓDULO 3 — CONSTRUTOR DE PRODUTOS

**Responsabilidade**: Verificar se o sistema permite cadastrar produtos com composição completa.

### Sequência de Cadastro

**3.1 — Cadastrar Matérias-Primas**

Para cada material abaixo, verificar:
- Formulário de cadastro abre corretamente
- Todos os campos obrigatórios estão presentes
- Unidade de medida compatível (m², ml, un, m)
- Preço salva e persiste após recarregar
- Material aparece nas listagens e buscas

| Material | Unidade | Preço Referência |
|----------|---------|-----------------|
| Lona 440g (rolo) | m² | R$ 8,50 |
| Bastão superior (alumínio) | m | R$ 12,00 |
| Bastão inferior (alumínio) | m | R$ 12,00 |
| Ponteira plástica | un | R$ 1,20 |
| Cordinha nylon | m | R$ 0,80 |
| Tinta HP Latex | ml | R$ 0,045 |

**3.2 — Cadastrar Produto**

Produto: `Banner-Teste`
- Categoria: Banner
- Tipo: Sob encomenda
- Unidade de venda: un

Verificar:
- Produto salva com todos os dados
- Produto aparece na listagem
- Produto disponível para seleção no orçamento

**3.3 — Cadastrar Modelos (Variações)**

| Modelo | Largura | Altura | Área m² |
|--------|---------|--------|---------|
| Banner 60x80 | 0,60m | 0,80m | 0,48 m² |
| Banner 70x100 | 0,70m | 1,00m | 0,70 m² |
| Banner 90x120 | 0,90m | 1,20m | 1,08 m² |

**3.4 — Compor Produto (modelo_materiais)**

Para o modelo `Banner 90x120`, a composição esperada é:

| Material | Qtd por unidade | Base de cálculo |
|----------|----------------|-----------------|
| Lona 440g | 1,08 m² | área do banner + 5% perda |
| Bastão superior | 0,92 m | largura (0,90m + margem) |
| Bastão inferior | 0,92 m | largura (0,90m + margem) |
| Ponteira | 4 un | 2 por bastão |
| Cordinha | 0,50 m | fixo |
| Tinta HP Latex | ~150 ml | estimativa impressão |

**3.5 — Cadastrar Processos de Produção**

| Processo | Máquina | Tempo por m² |
|----------|---------|--------------|
| Impressão digital | Ampla Targa XT ou HP Latex | 8 min/m² |
| Acabamento manual | N/A | 5 min/un |

**3.6 — Verificar Custo Calculado**

Custo esperado para Banner 90x120 (1 unidade):
```
Lona:      1,08 m² × R$ 8,50   = R$  9,18
Bastão ×2: 1,84 m  × R$ 12,00  = R$ 22,08
Ponteiras: 4 un    × R$  1,20  = R$  4,80
Cordinha:  0,50 m  × R$  0,80  = R$  0,40
Tinta:    150 ml   × R$  0,045 = R$  6,75
─────────────────────────────────────────
Custo materiais:                  R$ 43,21
```

Se o sistema retornar R$ 0,00 ou valor diferente de R$ 43,21 (±5%): registrar como erro CRÍTICO.

**O que constitui falha neste módulo:**
- ❌ Formulário de cadastro não carrega
- ❌ Campo obrigatório não validado
- ❌ Material não aparece na composição do produto
- ❌ Custo calculado = R$ 0,00
- ❌ Composição não salva (modelo_materiais vazio)
- ❌ Área do banner não calculada automaticamente pelos campos de dimensão

---

## MÓDULO 4 — EXECUTOR DE FLUXO DE VENDAS

**Responsabilidade**: Simular o fluxo comercial completo como vendedor e orçamentista.

### 4.1 — Cadastro de Lead
- Acessar módulo de Leads/CRM
- Cadastrar lead com dados do Módulo 2
- Verificar: lead aparece no funil, pode ser editado

### 4.2 — Conversão Lead → Cliente
- Converter lead em cliente
- Verificar: dados migram corretamente, nada é perdido
- Verificar: cliente aparece em Clientes, não mais como lead pendente

### 4.3 — Criação de Orçamento
- Selecionar cliente
- Adicionar produto Banner-Teste, variação 90x120, qtd 10
- Verificar: preço de venda calculado automaticamente
- Verificar: preço > custo (markup aplicado)
- Verificar: total = preço unitário × 10

**Cálculo esperado (markup 3,5×):**
```
Custo unitário: R$ 43,21
Markup:         3,5×
Preço venda:    R$ 151,24
Total (×10):    R$ 1.512,40
```

Se total = R$ 0,00: CRÍTICO
Se total ≠ R$ 1.512,40 (±10%): ALTO

### 4.4 — Envio de Proposta
- Gerar link do portal público
- Verificar: link funciona sem login
- Verificar: proposta exibe produto, valores e prazo corretamente
- Verificar: cliente consegue aprovar pela proposta

### 4.5 — Aprovação e Geração de Pedido
- Simular aprovação (pelo portal ou pelo CRM)
- Verificar: orçamento muda para status "aprovado"
- Verificar: pedido é criado automaticamente
- Verificar: pedido contém os itens corretos

**O que constitui falha neste módulo:**
- ❌ Orçamento não calcula preço
- ❌ Link do portal não funciona
- ❌ Aprovação não gera pedido
- ❌ Pedido criado sem itens
- ❌ Status não transiciona corretamente

---

## MÓDULO 5 — EXECUTOR DE FLUXO DE PRODUÇÃO

**Responsabilidade**: Simular o PCP e operador de produção.

### 5.1 — Recebimento do Pedido no PCP
- PCP visualiza pedido aprovado
- Cria Ordem de Produção (OP) vinculada ao pedido
- Aloca máquina: Ampla Targa XT ou HP Latex
- Define prazo de produção

### 5.2 — Verificação de Disponibilidade de Materiais
- Sistema verifica estoque dos materiais necessários
- Se estoque insuficiente: alerta deve aparecer
- Testar com estoque zerado (edge case)

### 5.3 — Execução da Produção
- Operador "inicia" a OP
- Registra progresso (% concluído)
- Finaliza a OP

### 5.4 — Verificações de Integridade
- Após finalizar OP: status do pedido deve mudar
- Consumo de materiais deve ser descontado do estoque
- Histórico de produção deve ser registrado

**O que constitui falha neste módulo:**
- ❌ OP não pode ser criada a partir do pedido
- ❌ Máquina não pode ser alocada
- ❌ Status de produção não atualiza
- ❌ Estoque não é debitado após conclusão
- ❌ Pedido não reflete conclusão da produção

---

## MÓDULO 6 — FINANCIAL_FLOW_RUNNER

**Responsabilidade**: Simular o fluxo financeiro completo.

### 6.1 — Geração de Cobrança
- Pedido aprovado chega ao financeiro
- Gerar boleto ou link de pagamento
- Verificar: valor do boleto = valor do pedido
- Verificar: data de vencimento = data de entrega + prazo acordado

### 6.2 — Registro de Pagamento
- Simular confirmação de pagamento
- Verificar: status do pedido muda para "pago"
- Verificar: saldo do cliente atualiza
- Verificar: pedido liberado para expedição/instalação

### 6.3 — Verificações de Cálculo Financeiro
Testar se o sistema calcula corretamente:
- Desconto aplicado no orçamento preservado no pedido
- Comissão do vendedor calculada corretamente
- Impostos (se configurados) calculados corretamente

**O que constitui falha neste módulo:**
- ❌ Valor da cobrança diferente do valor do pedido
- ❌ Pagamento registrado não libera o pedido
- ❌ Comissão calculada em cima do valor errado
- ❌ Status financeiro não sincroniza com status do pedido

---

## MÓDULO 7 — VALIDADOR DE APP DE CAMPO

**Responsabilidade**: Verificar a integração ERP ↔ App de Campo via bridge (migration 004).

### 7.1 — Criação de Ordem de Instalação
- No ERP: criar ordem de instalação vinculada ao pedido
- Verificar: OI aparece no módulo de Instalações
- Verificar: OI contém: cliente, endereço, produto, data agendada

### 7.2 — Verificação da Bridge
Ao mudar status da OI para "agendada", verificar via Supabase:
- Trigger `fn_create_job_from_ordem` executou
- Job criado na tabela `jobs` com `ordem_instalacao_id` preenchido
- Job aparece no App de Campo

### 7.3 — Sincronização de Status
- No App de Campo: simular técnico iniciando o job
- Verificar: status no ERP muda para "em_execucao"
- No App de Campo: simular técnico concluindo o job
- Verificar: status no ERP muda para "concluida"
- Verificar: trigger `fn_sync_job_to_ordem` atualizou a OI

### 7.4 — Verificação de Mídia
- Verificar: fotos antes/depois registradas no job são acessíveis pelo ERP
- Verificar: view `vw_campo_instalacoes` retorna dados corretos
- Verificar: view `vw_campo_fotos` retorna fotos vinculadas

**O que constitui falha neste módulo:**
- ❌ OI não cria job automaticamente ao ser agendada
- ❌ Job no campo não reflete mudança de status no ERP
- ❌ Views retornam dados vazios ou incorretos
- ❌ Fotos não acessíveis pelo ERP

---

## MÓDULO 8 — DETECTOR DE ERROS

**Responsabilidade**: Monitorar e classificar todos os problemas encontrados.

### Critérios de Classificação

**🔴 CRÍTICO** — Qualquer um destes:
- Operação que deveria salvar dados não salva
- Cálculo retorna R$ 0,00 quando deveria retornar valor
- Sistema trava ou retorna erro 500
- Fluxo não pode avançar (etapa bloqueada sem motivo)
- Dados perdidos após salvar

**🟠 ALTO** — Qualquer um destes:
- Cálculo retorna valor errado (mas não zero)
- Status não transiciona corretamente
- Integração falha entre módulos
- Funcionalidade existe na UI mas não funciona no backend
- Dado salvo diferente do digitado

**🟡 MÉDIO** — Qualquer um destes:
- Campo sem validação que deveria ter
- Mensagem de erro inexistente ou genérica
- UX confusa (usuário não sabe o que fazer)
- Filtro ou busca que não funciona
- Paginação quebrada

**🟢 BAIXO** — Qualquer um destes:
- Texto errado ou com erro ortográfico
- Botão mal posicionado
- Falta de atalho ou melhoria de UX
- Inconsistência visual

### Formato de Registro de Erro

```
ID: QA-YYYY-MM-DD-NNN
Severidade: 🔴 CRÍTICO
Módulo: Módulo 4 — Fluxo de Vendas
Passo: 4.3 — Criação de Orçamento
Persona: Orçamentista

Descrição: Orçamento gerado com total R$ 0,00

Passos para reproduzir:
1. Acessar Orçamentos > Novo Orçamento
2. Selecionar cliente "Papelaria São Lucas"
3. Adicionar produto "Banner-Teste" variação 90x120, qty 10
4. Verificar campo "Total"

Resultado esperado: R$ 1.512,40
Resultado obtido: R$ 0,00

Causa provável: modelo_materiais com 0 registros — motor de cálculo sem custo base

Impacto: Impede geração de qualquer orçamento com valor correto
```

---

## MÓDULO 9 — AUDITOR DE FLUXO ERP

**Responsabilidade**: Verificar integridade dos dados após cada etapa importante.

### Verificações por Etapa

Após cada passo crítico, consultar Supabase diretamente para confirmar:

| Etapa | Tabela | Verificação |
|-------|--------|-------------|
| Lead criado | `leads` | Registro existe com dados corretos |
| Cliente criado | `clientes` | Lead convertido, dados migrados |
| Orçamento criado | `orcamentos` | Status = 'rascunho', total > 0 |
| Orçamento enviado | `orcamentos` | Status = 'enviado', token existe |
| Orçamento aprovado | `orcamentos` | Status = 'aprovado' |
| Pedido criado | `pedidos` | Vinculado ao orçamento, itens presentes |
| OP criada | `ordens_producao` | Vinculada ao pedido |
| OP concluída | `ordens_producao` | Status = 'concluida', data_conclusao preenchida |
| Pedido faturado | `pedidos` | Status = 'faturado' |
| OI agendada | `ordens_instalacao` | Status = 'agendada' |
| Job criado | `jobs` | ordem_instalacao_id preenchido |
| Job concluído | `jobs` | Status = 'Concluído', finished_at preenchido |
| OI concluída | `ordens_instalacao` | Status = 'concluida' (trigger executou) |

### Verificações de Consistência Cruzada

- `pedidos.total` = soma de `pedido_itens.subtotal`
- `orcamentos.total` = `pedidos.valor_total` (se gerado do orçamento)
- `jobs.ordem_instalacao_id` → existe em `ordens_instalacao`
- `ordens_instalacao.status` ↔ `jobs.status` (sincronizados)

---

## MÓDULO 10 — GERADOR DE RELATÓRIOS

**Responsabilidade**: Compilar e estruturar o relatório final.

### Protocolo de Geração

1. Coletar todos os erros registrados pelo Módulo 8
2. Ordenar por severidade (CRÍTICO → ALTO → MÉDIO → BAIXO)
3. Calcular métricas resumo
4. Preencher template de `MODELO_DE_RELATÓRIO_DE_ERROS.md`
5. Salvar em: `docs/qa-reports/YYYY-MM-DD-HH-MM-qa-report.md`
6. Exibir resumo executivo no chat

### Métricas do Relatório

```
Total de passos executados: XX/17
Passos com sucesso: XX
Passos com erro: XX
Taxa de sucesso: XX%

Erros por severidade:
  🔴 CRÍTICO: N
  🟠 ALTO:    N
  🟡 MÉDIO:   N
  🟢 BAIXO:   N

Veredito: [INAPTO / PARCIALMENTE APTO / APTO COM RESSALVAS / APTO PARA PRODUÇÃO]
```
