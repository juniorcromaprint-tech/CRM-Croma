# Manual do Financeiro — Relatórios e Análise de Rentabilidade

> Atualizado em: 2026-03-10 | Sistema: CRM Croma Print v3.0

---

## Acesso ao Dashboard Financeiro

1. Faça login no sistema em `tender-archimedes.vercel.app`
2. O sistema detecta automaticamente seu perfil (role: `financeiro`) e exibe o dashboard correspondente
3. O menu lateral mostra as seções disponíveis para o perfil financeiro

**Seções relevantes para o financeiro:**
- **Dashboard Financeiro** — visão geral de caixa, inadimplência e margens
- **Financeiro** — contas a pagar, contas a receber, fluxo de caixa
- **DRE** — Demonstrativo de Resultado do Exercício
- **Comissões** — cálculo e acompanhamento de comissões de vendas
- **Admin > Precificação** — configuração dos parâmetros de custo (acesso admin)

---

## Entendendo os KPIs do Dashboard Financeiro

### Ticket Médio

**O que é**: Valor médio dos pedidos fechados no período.

**Como é calculado**:
```
Ticket Médio = Faturamento Total do Período / Quantidade de Pedidos
```

**O que fazer com essa informação**:
- Ticket médio baixo pode indicar muitos pequenos orçamentos sendo aprovados em detrimento de contratos maiores
- Compare o ticket médio do mês com o histórico para identificar tendências

---

### Margem Bruta

**O que é**: Percentual do faturamento que sobra após descontar os custos diretos de produção.

**Como é calculado**:
```
Margem Bruta = ((Faturamento - Custo Direto) / Faturamento) × 100
```

Onde custo direto = matéria prima + mão de obra direta.

**Referência da Croma Print**: Margem bruta saudável está entre 35% e 55% dependendo da categoria de produto.

---

### Faturamento Mensal

**O que é**: Total de pedidos faturados (entregues e confirmados) no mês corrente.

**Atenção**: O sistema diferencia:
- **Orçamentos aprovados** — ainda não faturados (não entram no DRE)
- **Pedidos em produção** — a faturar
- **Pedidos entregues** — faturados (entram no DRE)

---

### Inadimplência

**O que é**: Valor de contas a receber com vencimento passado e não pagas.

**O que fazer**: Acesse **Financeiro > Contas a Receber** e filtre por status "Vencido" para ver a lista detalhada.

---

## Como Interpretar a DRE do Sistema

A DRE (Demonstrativo de Resultado do Exercício) está em **Financeiro > DRE**.

**Estrutura da DRE no sistema:**

```
(+) Receita Bruta de Vendas
(-) Impostos sobre vendas (padrão: 12%)
(-) Devoluções e cancelamentos
(=) Receita Líquida

(-) Custo dos Produtos Vendidos (CPV)
    - Custo de Matéria Prima (custo_mp)
    - Custo de Mão de Obra Direta (custo_mo)
(=) Lucro Bruto

(-) Despesas Operacionais
    - Comissões de vendas
    - Despesas administrativas
    - Custos fixos (aluguel, energia, etc.)
(=) EBITDA (resultado operacional)

(-) Depreciação e amortização
(-) Resultado financeiro (juros)
(=) Resultado Líquido do Período
```

**Limitação atual**: A DRE usa percentuais estimados para algumas categorias de despesa (não dados reais por lançamento). Para análise precisa, exporte os dados do Supabase e cruze com sua planilha de gestão até que a categorização por lançamento seja implementada.

---

## Rastreamento de Custos por Pedido

Cada pedido no sistema armazena os seguintes campos de custo:

| Campo | Descrição | Fonte |
|---|---|---|
| `custo_mp` | Custo de matéria prima | Calculado pelo motor Mubisys ao criar o orçamento |
| `custo_mo` | Custo de mão de obra direta | Calculado pelo motor (tempo × custo/minuto) |
| `custo_fixo` | Custo fixo rateado no item | Calculado pelo motor (P% sobre custo direto) |
| `preco_venda` | Preço pelo qual foi vendido | Do orçamento aprovado |
| `margem_bruta` | Percentual de margem real | Calculado automaticamente |

**Como acessar**: Em **Pedidos**, abra qualquer pedido e vá na aba "Financeiro" ou "Custos".

**Atenção**: Se o orçamento foi criado com preço zerado (problema do `modelo_materiais` vazio), os campos de custo do pedido também estarão zerados. Nesse caso, os dados de custo precisarão ser inseridos manualmente ou o problema do catálogo precisa ser corrigido.

---

## Comissões — Como São Calculadas

### Regra padrão

```
Comissão = Preço de Venda do Pedido × Percentual de Comissão do Vendedor
```

O percentual padrão de comissão está configurado em `/admin/precificacao` (padrão Croma Print: 5%).

### Visualização de comissões

1. Acesse **Financeiro > Comissões**
2. Filtre por período e por vendedor
3. A lista mostra: pedido, cliente, valor, vendedor, percentual, valor da comissão, status (paga/pendente)

### Verificar comissões pendentes

- Status "Pendente" = comissão calculada mas ainda não paga ao vendedor
- Status "Pago" = comissão já processada
- Para marcar como paga: selecione a comissão e clique em "Marcar como Paga"

### Ajuste de comissão por vendedor

Cada vendedor pode ter um percentual diferente do padrão. Isso é configurado em **Admin > Usuários**, no perfil de cada usuário (campo `percentual_comissao`).

---

## Configuração do Custo Operacional

Os parâmetros de custo que alimentam o motor de precificação são configurados em `/admin/precificacao`.

**Quem deve configurar**: O financeiro ou o sócio/diretor — não o vendedor.

**Parâmetros a configurar** (idealmente todo mês ou trimestre):

| Parâmetro | O que é | Como obter |
|---|---|---|
| Faturamento médio mensal | Média dos últimos 12 meses | Histórico de vendas |
| Custo operacional total | Todos os custos fixos e variáveis | Planilha de custos da empresa |
| Custo produtivo (folha) | Folha de pagamento da produção | Folha de pagamento |
| Quantidade de funcionários | Funcionários diretos de produção | RH |
| Horas trabalhadas/mês | Padrão: 176h (22 dias × 8h) | Ajustar se houver horas extras |

**Frequência de atualização recomendada**: Mensalmente ou após qualquer mudança significativa nos custos (reajuste salarial, novo aluguel, etc.).

**Impacto**: Qualquer alteração nos parâmetros afeta o preço calculado de todos os novos orçamentos. Orçamentos já enviados não são recalculados automaticamente.

---

## Regras de Markup por Categoria

O sistema suporta regras de markup diferentes por categoria de produto (ex: fachadas têm markup maior que banners simples por causa da instalação).

**Onde configurar**: `/admin/precificacao` > aba "Regras por Categoria"

**Estrutura de uma regra:**

| Campo | Exemplo | Descrição |
|---|---|---|
| Categoria | "Fachadas ACM" | Grupo de produtos |
| Markup mínimo | 35% | Piso — alerta vermelho abaixo disso |
| Markup padrão | 45% | Aplicado automaticamente ao criar item |
| Markup máximo | 80% | Teto para referência (sem bloqueio) |

**Impacto nos alertas**: O orçamento mostra alerta amarelo quando o markup do item está entre mínimo e padrão, e alerta vermelho quando está abaixo do mínimo.

**Limitação atual**: A tabela `regras_precificacao` requer a migration 006 executada no banco. Enquanto não for executada, o markup padrão de 40% é aplicado para todos os produtos.

---

## Exportação de Dados

O sistema ainda não tem exportação nativa em CSV/Excel para todos os módulos. As opções disponíveis são:

### Opção 1 — Exportação via Supabase (recomendado para análise completa)

1. Acesse `supabase.com/dashboard/project/djwjmfgplnqyffdcgdaw`
2. Vá em **Table Editor**
3. Selecione a tabela desejada (ex: `pedidos`, `propostas`, `contas_receber`)
4. Clique em **Export** no canto superior
5. Escolha CSV ou JSON

Tabelas mais úteis para o financeiro:

| Tabela | Conteúdo |
|---|---|
| `pedidos` | Todos os pedidos com valores, custos e status |
| `propostas` | Orçamentos com preços e status |
| `contas_receber` | Recebíveis por cliente e vencimento |
| `contas_pagar` | Obrigações por fornecedor e vencimento |
| `comissoes` | Comissões calculadas por vendedor/pedido |
| `lancamentos_financeiros` | Lançamentos individuais de caixa |

### Opção 2 — Exportar relatório de pedidos (interface do sistema)

Em **Pedidos**, use os filtros de data e status, depois clique no ícone de download (se disponível na sua versão).

---

## Alertas de Rentabilidade no Orçamento

Quando um vendedor cria um orçamento, o sistema exibe alertas baseados nos parâmetros de precificação configurados. Como financeiro, você pode ver esses alertas nos orçamentos em qualquer status.

| Alerta | Cor | Significado | Ação recomendada |
|---|---|---|---|
| Margem abaixo do mínimo | Vermelho | Preço cobre custos mas não gera lucro suficiente | Revisar antes de aprovação |
| Markup abaixo do padrão | Amarelo | Vendedor deu desconto acima do limite da categoria | Verificar justificativa |
| Material sem preço | Laranja | Custo de material não cadastrado — custo real pode ser maior | Atualizar preço do material no catálogo |
| Preço R$ 0,00 | Cinza | Problema técnico — modelo sem materiais vinculados | Corrigir no catálogo de produtos |

**Regra prática**: Qualquer pedido aprovado com alerta vermelho deve ter uma justificativa documentada no campo de observações.

---

## Conciliação Financeira Mensal

Checklist recomendado para fechamento mensal:

1. Exportar todos os pedidos entregues no mês via Supabase
2. Cruzar com notas fiscais emitidas (módulo Fiscal)
3. Verificar contas a receber vencidas e acionar cobrança
4. Exportar comissões do mês e processar pagamento
5. Atualizar parâmetros de custo se houver mudanças significativas
6. Verificar se há orçamentos aprovados há mais de 30 dias sem virar pedido (possível perda de negócio)

---

## Limitações Atuais do Módulo Financeiro

| Limitação | Impacto | Previsão |
|---|---|---|
| DRE usa estimativas, não categorias reais | Análise de despesas aproximada | Futuras versões |
| Sem integração bancária automática | Conciliação manual necessária | Não previsto |
| Exportação manual via Supabase | Pouco prático para uso diário | Próxima versão |
| `regras_precificacao` não existe no banco ainda | Markup padrão fixo para todos os produtos | Requer execução da migration 006 |
| Sem dashboard de inadimplência detalhado | Análise de risco limitada | Futuras versões |

---

## Perguntas Frequentes

**O DRE bate com o faturamento real?**
Parcialmente. O DRE consolida os pedidos registrados no sistema. Se houver pedidos faturados fora do sistema, o DRE estará incompleto. Recomenda-se que todos os pedidos passem pelo sistema.

**Como identificar quais pedidos têm margem negativa?**
Na lista de Pedidos, filtre por "Margem < 0%" (se o filtro estiver disponível) ou exporte para CSV e calcule na planilha.

**As comissões são calculadas sobre o valor bruto ou líquido?**
Pelo motor atual, sobre o valor de venda (preço_venda do pedido), antes de descontos de impostos. Verifique se isso está alinhado com a política de comissões da Croma Print.

**Posso ver o histórico de alterações nos parâmetros de custo?**
A tabela `audit_logs` do Supabase registra todas as alterações. Acesse via `supabase.com/dashboard/project/djwjmfgplnqyffdcgdaw/table-editor` na tabela `audit_logs`, filtrando por tabela `config_precificacao`.
