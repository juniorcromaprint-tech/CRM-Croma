# Manual do Vendedor — Como Criar e Gerenciar Orçamentos

> Atualizado em: 2026-03-10 | Sistema: CRM Croma Print v3.0

---

## Acesso ao Sistema

| Item | Valor |
|---|---|
| URL do sistema | `crm-croma.vercel.app` |
| Login demo (teste) | `admin@cromaprint.com.br` |
| Senha demo | Solicitar ao administrador |
| Navegador recomendado | Chrome ou Edge (versão recente) |

O sistema é otimizado para uso em desktop (tela larga). Em tablet funciona, mas em celular a experiência é limitada — use o App de Campo para operações em campo.

---

## Navegando pelo Sistema

Após fazer login, você verá o menu lateral esquerdo com as principais seções:

- **Dashboard** — visão geral de leads, orçamentos e metas
- **Leads** — prospectos em contato inicial
- **Pipeline** — funil de vendas (Kanban)
- **Orçamentos** — lista e gestão de orçamentos (esta seção é o foco deste manual)
- **Propostas** — propostas formais enviadas a clientes
- **Clientes** — cadastro completo de clientes

Atalho rápido: pressione `Ctrl+K` (ou `Cmd+K` no Mac) para abrir o menu de busca global.

---

## Fluxo Completo de Criação de Orçamento

### Etapa 1 — Acessar a lista de orçamentos

1. No menu lateral, clique em **Orçamentos**
2. Você verá a lista de todos os orçamentos com filtros por status:
   - Rascunho
   - Enviado
   - Aprovado
   - Pedido
   - Cancelado
3. Use a barra de busca para encontrar orçamentos por número, cliente ou título

---

### Etapa 2 — Criar novo orçamento

1. Clique no botão **Novo Orçamento** (canto superior direito)
2. Preencha os campos obrigatórios:
   - **Título**: Descrição curta do orçamento (ex: "Fachada ACM + Banners Campanha Inverno")
   - **Cliente**: Selecione da lista ou comece a digitar o nome para filtrar
3. Campos opcionais nesta etapa:
   - **Validade**: Quantos dias o orçamento é válido (padrão: 30 dias)
   - **Observações**: Informações adicionais para o cliente
4. Clique em **Salvar** para criar o orçamento

> Importante: é necessário salvar o orçamento antes de adicionar itens. O número do orçamento (ex: ORC-2026-001) é gerado automaticamente neste momento.

---

### Etapa 3 — Adicionar item — Passo 1 (Produto + Modelo)

Após salvar, você verá o editor de orçamento. Clique em **Adicionar Item**.

Um painel de 3 passos será aberto.

No **Passo 1**:
1. **Produto**: Selecione o tipo de produto (ex: "Banner Roll-up", "Fachada ACM", "Adesivo Vitrine")
2. **Modelo**: Após selecionar o produto, selecione o modelo específico (ex: "Roll-up 85×200cm" ou "Fachada ACM Simples")
3. **Quantidade**: Informe a quantidade de peças
4. Clique em **Próximo**

> Dica: o modelo define quais materiais e processos serão usados no cálculo de preço. Se o modelo correto não aparecer na lista, entre em contato com o admin para cadastrá-lo.

---

### Etapa 4 — Adicionar item — Passo 2 (Materiais + Acabamentos)

No **Passo 2**:

**Medidas** (quando aplicável):
- Informe a largura e altura do material em metros ou centímetros (dependendo do produto)
- A área será calculada automaticamente

**Materiais**:
- Os materiais do modelo serão listados (quando corretamente configurados no catálogo)
- Verifique se os materiais estão corretos para este cliente/projeto
- Você pode ajustar a quantidade de consumo se necessário

**Acabamentos** (quando disponível):
- Selecione os acabamentos necessários: ilhós, velcro, moldura, laminação, etc.
- Cada acabamento tem custo adicional já calculado

Clique em **Próximo**.

---

### Etapa 5 — Adicionar item — Passo 3 (Revisão + Alertas)

No **Passo 3**:

**Resumo do item**:
- Preço unitário calculado pelo motor Mubisys
- Preço total (unitário × quantidade)
- Breakdown: custo de MP, mão de obra, custos fixos, margem

**Alertas** (leia com atenção):
- Alerta vermelho: margem abaixo do mínimo aceitável — NÃO envie sem revisão
- Alerta amarelo: markup abaixo do padrão da categoria — verifique antes de aprovar
- Sem alerta: preço dentro dos parâmetros

**Markup**:
- O markup padrão é definido pelo modelo/categoria do produto
- Você pode ajustar manualmente dentro dos limites de sua alçada
- Reduções de markup acima de X% requerem aprovação do gerente

Clique em **Confirmar e Adicionar** para incluir o item no orçamento.

---

### Etapa 6 — Adicionar mais itens

Repita as etapas 3 a 5 para cada produto do orçamento. Um orçamento pode ter quantos itens necessários.

Para remover um item adicionado por engano, clique no ícone de lixeira ao lado do item na lista.

> Nota atual: para editar um item já adicionado, é necessário removê-lo e readicioná-lo com as correções. A edição direta de itens será implementada em versão futura.

---

### Etapa 7 — Adicionar serviços

Além dos produtos físicos, você pode adicionar serviços ao orçamento:

1. Role até a seção **Serviços** no editor
2. Clique em **Adicionar Serviço**
3. Selecione o tipo: Instalação, Arte/Design, Transporte, Outros
4. Informe o valor e descrição
5. Salve o serviço

Exemplos de serviços comuns:
- Instalação de fachada: R$ X (depende da complexidade)
- Criação de arte: R$ X por peça
- Frete para interior: R$ X

---

### Etapa 8 — Desconto e validade

No painel direito do editor, você pode configurar:

**Desconto global**:
- Percentual de desconto sobre o total do orçamento
- Atenção: desconto reduz a margem. Verifique os alertas após aplicar.

**Validade**:
- Data até quando o orçamento é válido
- Após essa data, os preços podem sofrer reajuste

**Condições de pagamento**:
- Campo livre para descrever: "50% na aprovação, 50% na entrega" ou "30/60 dias"

---

### Etapa 9 — Salvar e enviar para o cliente

1. Clique em **Salvar Orçamento** para gravar todas as alterações
2. Para visualizar como o cliente vai ver: clique em **Visualizar Proposta**
3. Para imprimir ou salvar como PDF: na tela de visualização, clique em **Imprimir** ou use `Ctrl+P`
4. Para marcar como enviado: mude o status para **Enviado** no campo de status

---

## Como Interpretar os Alertas do ResumoVendedor

O painel de resumo exibe alertas para te ajudar a não vender abaixo do custo:

| Alerta | Significado | O que fazer |
|---|---|---|
| Margem abaixo do mínimo | Preço não cobre todos os custos + lucro mínimo | Aumentar markup ou reduzir escopo |
| Markup abaixo do padrão da categoria | Você está vendendo com margem menor que o habitual | Verificar se há justificativa (volume alto, cliente estratégico) |
| Material sem preço cadastrado | Custo do material não está no banco | Solicitar ao admin que atualize o preço do material |
| Preço R$ 0,00 | Modelo sem materiais vinculados | Solicitar ao admin que configure o modelo |

> Se os alertas aparecerem mas o preço estiver zerado (R$ 0,00), o problema é na configuração do catálogo — entre em contato com o admin. Não envie orçamentos com preço zero.

---

## Como Usar Templates de Orçamento

Templates são orçamentos pré-configurados para situações recorrentes (ex: "Kit Abertura de Loja", "Campanha Black Friday Padrão").

1. Na lista de orçamentos, clique em **Templates**
2. Selecione o template desejado
3. Clique em **Usar este template**
4. Um novo orçamento será criado com todos os itens do template
5. Ajuste as quantidades, medidas e cliente conforme necessário

> Se não houver templates disponíveis, solicite ao admin que crie os mais usados. Templates economizam bastante tempo em orçamentos recorrentes.

---

## Como Converter Orçamento Aprovado em Pedido

Quando o cliente aprova o orçamento:

1. Abra o orçamento aprovado
2. Mude o status para **Aprovado** (se ainda estiver como Enviado)
3. Clique no botão **Converter em Pedido**
4. Confirme os dados do pedido (prazo de entrega, responsável de produção)
5. Clique em **Confirmar Pedido**

O sistema criará automaticamente um Pedido vinculado ao orçamento. A equipe de Produção receberá a notificação.

---

## Duplicar um Orçamento Existente

Muito útil para clientes que fazem pedidos recorrentes similares:

1. Na lista de orçamentos, encontre o orçamento que deseja duplicar
2. Clique nos três pontos (...) ao lado do orçamento
3. Selecione **Duplicar**
4. O sistema cria uma cópia com status "Rascunho" e data atual
5. Ajuste o que for necessário (cliente, quantidades, preços)

---

## Boas Práticas

### Antes de enviar o orçamento

- Sempre verifique se não há alertas vermelhos no resumo
- Confira as dimensões (uma fachada medida errada pode gerar retrabalho caro)
- Documente as especificações técnicas nas observações do item (ex: "cor pantone X", "arquivo em PDF a 300 dpi")
- Revise as condições de pagamento — deixe claro prazo de entrega e forma de pagamento
- Verifique a validade do orçamento (orçamentos de materiais importados podem ter validade menor)

### Markup mínimo

Nunca reduza o markup abaixo do mínimo definido pela categoria. Se o cliente pedir desconto:
1. Avalie se é possível reduzir escopo (menos itens, acabamento mais simples)
2. Consulte o gerente antes de dar desconto acima de 10%
3. Justifique no campo de observações qualquer desconto excepcional

### Documentar especificações

Quanto mais detalhe no orçamento, menos retrabalho:
- Informe o arquivo de arte (existe ou precisa criar?)
- Especifique o local de instalação (altura da parede, acesso, andaimes necessários?)
- Registre o contato técnico do cliente (quem vai receber a instalação?)

### Verificar alertas antes de enviar

Um orçamento com alerta vermelho enviado para o cliente pode gerar prejuízo. Regra simples:
- Alerta vermelho = não enviar sem aprovação do gerente
- Alerta amarelo = OK enviar, mas registre a justificativa

---

## Atalhos de Teclado

| Atalho | Ação |
|---|---|
| `Ctrl+K` | Abrir busca global (CommandPalette) |
| `Ctrl+P` | Imprimir / salvar PDF (na tela de visualização) |
| `Esc` | Fechar painéis e modais |

---

## Perguntas Frequentes

**Por que o preço aparece R$ 0,00?**
O catálogo de materiais precisa estar configurado. Entre em contato com o admin.

**Posso criar um orçamento sem selecionar cliente?**
Não — o cliente é obrigatório para criar o orçamento. Se for prospect sem cadastro, cadastre primeiro em **Clientes > Novo Cliente**.

**O cliente pediu uma versão revisada do orçamento — o que fazer?**
Duplique o orçamento original, faça as alterações e envie a nova versão. O original fica como histórico.

**Como saber se o cliente abriu o orçamento?**
O sistema ainda não tem rastreamento de abertura de e-mail/link. Controle isso manualmente no campo de status e observações.

**Posso adicionar uma foto ou arquivo ao orçamento?**
Por enquanto, o orçamento suporta texto e tabela de itens. Para enviar arquivos, use e-mail junto com o PDF do orçamento.
