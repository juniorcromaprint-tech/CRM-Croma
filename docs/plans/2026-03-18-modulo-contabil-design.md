# Módulo Contábil — Contabilidade Autônoma (Abordagem B)

> **Data**: 2026-03-18 | **Status**: Aprovado | **Autor**: Claude + Junior
> **Empresa**: Croma Print | **Regime**: Simples Nacional | **Faixa**: 1 (até R$ 180k/ano)

---

## Contexto

A Croma Print paga uma contadora que basicamente só emite a guia do DAS mensal. O objetivo é automatizar 95% do trabalho contábil dentro do ERP, reduzindo o custo da contadora ao mínimo (só assinar obrigações legais).

### O que já existe no ERP
- Plano de Contas hierárquico (3 níveis) — só receita/despesa
- Centros de Custo hierárquicos
- Contas a Receber/Pagar completas com parcelas
- DRE calculado (receita, CME, despesas, EBITDA)
- Fluxo de Caixa projetado (90 dias)
- Boletos + CNAB 400 Itaú + retorno automático
- Comissões vinculadas a pagamento
- Aging e inadimplência
- NF-e em homologação (CSOSN 102 — Simples Nacional)

### Perfil tributário
- Simples Nacional, faturamento até R$ 180k/ano (faixa 1)
- Só pró-labore, sem CLT
- Fator R provavelmente < 28% → Anexo V
- Banco: Itaú (exporta OFX)

---

## Arquitetura

### Novas rotas

```
/contabilidade
├── /dashboard        ← Painel principal (DAS do mês, saúde fiscal, alertas)
├── /lancamentos      ← Lançamentos contábeis (automáticos + manuais)
├── /balancete        ← Balancete de verificação por período
├── /razao            ← Livro razão (extrato por conta do plano)
├── /das              ← Calculadora DAS + histórico de guias
├── /defis            ← Gerador DEFIS anual (dados prontos)
├── /extrato-bancario ← Importador OFX/CSV + classificação IA
└── /alertas          ← Painel tributário (faixa, anexo, Fator R)
```

### Motor Contábil (partida dobrada automática)

Cada evento financeiro gera lançamento contábil automático:

```
Venda paga       → D: Banco (ativo)        C: Receita de vendas
Despesa paga     → D: Despesa (resultado)   C: Banco (ativo)
Comissão gerada  → D: Despesa comercial     C: Comissões a pagar
DAS calculado    → D: Impostos (resultado)  C: Impostos a pagar
Pró-labore       → D: Despesa pessoal       C: Banco (ativo)
```

---

## Banco de Dados

### Nova tabela: `lancamentos_contabeis`

```sql
CREATE TABLE lancamentos_contabeis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_lancamento DATE NOT NULL,
  data_competencia DATE NOT NULL,
  numero_lancamento SERIAL,
  conta_debito_id UUID NOT NULL REFERENCES plano_contas(id),
  conta_credito_id UUID NOT NULL REFERENCES plano_contas(id),
  valor NUMERIC(15,2) NOT NULL CHECK (valor > 0),
  historico TEXT NOT NULL,
  origem_tipo VARCHAR(20) NOT NULL, -- 'conta_receber' | 'conta_pagar' | 'extrato' | 'manual' | 'das'
  origem_id UUID,
  centro_custo_id UUID REFERENCES centros_custo(id),
  conciliado BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Nova tabela: `das_apuracoes`

```sql
CREATE TABLE das_apuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia DATE NOT NULL UNIQUE, -- primeiro dia do mês
  receita_bruta_mes NUMERIC(15,2) NOT NULL,
  rbt12 NUMERIC(15,2) NOT NULL,
  folha_pagamento_12m NUMERIC(15,2) NOT NULL,
  fator_r NUMERIC(5,4) NOT NULL,
  anexo VARCHAR(3) NOT NULL, -- 'III' ou 'V'
  faixa INTEGER NOT NULL CHECK (faixa BETWEEN 1 AND 6),
  aliquota_nominal NUMERIC(5,4) NOT NULL,
  deducao NUMERIC(15,2) NOT NULL DEFAULT 0,
  aliquota_efetiva NUMERIC(5,4) NOT NULL,
  valor_das NUMERIC(15,2) NOT NULL,
  data_vencimento DATE NOT NULL, -- dia 20 do mês seguinte
  status VARCHAR(20) DEFAULT 'calculado', -- 'calculado' | 'conferido' | 'pago'
  data_pagamento DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Novas tabelas: extrato bancário

```sql
CREATE TABLE extrato_bancario_importacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banco VARCHAR(50) NOT NULL,
  conta VARCHAR(30),
  arquivo_nome VARCHAR(255) NOT NULL,
  formato VARCHAR(10) NOT NULL, -- 'ofx' | 'csv'
  data_inicio DATE,
  data_fim DATE,
  total_registros INTEGER DEFAULT 0,
  total_classificados INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'importado', -- 'importado' | 'classificando' | 'classificado' | 'lancado'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE extrato_bancario_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id UUID NOT NULL REFERENCES extrato_bancario_importacoes(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  descricao_original TEXT NOT NULL,
  valor NUMERIC(15,2) NOT NULL, -- positivo = entrada, negativo = saída
  tipo VARCHAR(10) NOT NULL, -- 'credito' | 'debito'
  conta_plano_id UUID REFERENCES plano_contas(id),
  centro_custo_id UUID REFERENCES centros_custo(id),
  confianca_ia NUMERIC(3,2), -- 0.00 a 1.00
  classificado_por VARCHAR(10), -- 'ia' | 'usuario' | 'regra'
  lancamento_id UUID REFERENCES lancamentos_contabeis(id),
  conciliado_com_id UUID, -- FK para conta_receber ou conta_pagar
  conciliado_com_tipo VARCHAR(20), -- 'conta_receber' | 'conta_pagar'
  ignorado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Nova tabela: regras de classificação

```sql
CREATE TABLE extrato_regras_classificacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  padrao TEXT NOT NULL, -- texto para match (ex: "ENERGISA", "PIX FORNECEDOR X")
  tipo_match VARCHAR(10) DEFAULT 'contains', -- 'contains' | 'starts_with' | 'exact'
  conta_plano_id UUID NOT NULL REFERENCES plano_contas(id),
  centro_custo_id UUID REFERENCES centros_custo(id),
  vezes_usado INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Nova tabela: configuração tributária

```sql
CREATE TABLE config_tributaria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regime VARCHAR(20) NOT NULL DEFAULT 'simples_nacional',
  pro_labore_mensal NUMERIC(15,2) NOT NULL DEFAULT 0,
  inss_pro_labore_percentual NUMERIC(5,2) DEFAULT 11.00,
  cnae_principal VARCHAR(10),
  anexo_padrao VARCHAR(3) DEFAULT 'V',
  observacoes TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Expansão do Plano de Contas

Campo `tipo` do `plano_contas` muda de `receita|despesa` para incluir `ativo|passivo|patrimonio`.

Seed com contas padrão:

```
1. ATIVO
  1.1 Circulante
    1.1.01 Caixa
    1.1.02 Banco Itaú
    1.1.03 Clientes a Receber
  1.2 Não Circulante
    1.2.01 Imobilizado

2. PASSIVO
  2.1 Circulante
    2.1.01 Fornecedores a Pagar
    2.1.02 DAS a Pagar
    2.1.03 Comissões a Pagar
    2.1.04 Pró-labore a Pagar
  2.2 Patrimônio Líquido
    2.2.01 Capital Social
    2.2.02 Lucros Acumulados

3. RECEITA (manter existentes)

4. DESPESA (manter existentes)
```

---

## Motor DAS — Simples Nacional

### Tabelas de alíquotas (hardcoded)

**Anexo III (Fator R >= 28%)**

| Faixa | RBT12 | Alíquota | Dedução |
|---|---|---|---|
| 1 | até 180.000 | 6,00% | 0 |
| 2 | 180.000 ~ 360.000 | 11,20% | 9.360 |
| 3 | 360.000 ~ 720.000 | 13,50% | 17.640 |
| 4 | 720.000 ~ 1.800.000 | 16,00% | 35.640 |
| 5 | 1.800.000 ~ 3.600.000 | 21,00% | 125.640 |
| 6 | 3.600.000 ~ 4.800.000 | 33,00% | 648.000 |

**Anexo V (Fator R < 28%)**

| Faixa | RBT12 | Alíquota | Dedução |
|---|---|---|---|
| 1 | até 180.000 | 15,50% | 0 |
| 2 | 180.000 ~ 360.000 | 18,00% | 4.500 |
| 3 | 360.000 ~ 720.000 | 19,50% | 9.900 |
| 4 | 720.000 ~ 1.800.000 | 20,50% | 17.100 |
| 5 | 1.800.000 ~ 3.600.000 | 23,00% | 62.100 |
| 6 | 3.600.000 ~ 4.800.000 | 30,50% | 540.000 |

### Fórmula

```
Alíquota Efetiva = (RBT12 × Alíquota Nominal - Dedução) / RBT12
Valor DAS = Receita do Mês × Alíquota Efetiva
```

Na faixa 1 (sem dedução): alíquota efetiva = alíquota nominal.

### Fluxo mensal

1. Buscar receita bruta do mês anterior (CR pagos com status 'pago')
2. Calcular RBT12 (soma receitas dos últimos 12 meses)
3. Calcular folha 12m (pró-labore × 12 meses com valor)
4. Fator R = folha_12m / rbt12
5. Determinar Anexo (III se >= 0.28, V se < 0.28)
6. Determinar Faixa pela RBT12
7. Calcular alíquota efetiva e valor DAS
8. Salvar em `das_apuracoes`
9. Gerar lançamento contábil (D: Impostos | C: DAS a Pagar)
10. Exibir no dashboard com vencimento (dia 20 do mês seguinte)

### Alertas

- Mudança de faixa (RBT12 cruzou limite)
- Fator R próximo de 28% (oportunidade de mudar de anexo)
- Simulação: "Se pró-labore subir R$ X, economiza R$ Y/mês"

---

## Importador OFX + Classificação IA

### Fluxo

1. Upload arquivo OFX do Itaú
2. Parser OFX extrai transações (data, descrição, valor, tipo)
3. Motor de classificação (3 camadas):
   - **Regras fixas** (`extrato_regras_classificacao`) — match por texto
   - **Histórico** — descrições já classificadas anteriormente
   - **IA** (OpenRouter) — analisa descrição, sugere conta + score de confiança
4. Tela de revisão com código de cores por confiança
5. Confirmar → gera lançamentos contábeis em lote
6. Conciliar com CR/CP existentes (match por valor + data ±3 dias)

### Aprendizado

Cada correção manual pode virar regra fixa (após 3x a mesma classificação).

---

## Páginas e UI

### Dashboard `/contabilidade`
- Cards: DAS do mês, Fator R, Anexo, próximo vencimento
- Alertas tributários
- Resumo: receitas, despesas, impostos, resultado
- Gráfico 12 meses
- Ações rápidas

### Balancete `/contabilidade/balancete`
- Tabela: código, conta, débitos, créditos, saldo
- Filtro por período (mês/trimestre/ano)
- Validação: total débitos = total créditos
- Export PDF/Excel

### Razão `/contabilidade/razao`
- Select de conta do plano
- Extrato detalhado: data, histórico, débito, crédito, saldo
- Filtro por período
- Saldo anterior + movimentação + saldo final

### DAS `/contabilidade/das`
- Calculadora sob demanda + histórico
- Detalhamento: RBT12, Fator R, anexo, faixa, alíquota
- Status: calculado → conferido → pago
- Simulador: "e se o faturamento fosse X?"

### DEFIS `/contabilidade/defis`
- Agregador anual de dados
- Receitas por mês, total DAS pago, despesas, folha
- Formato pronto para copiar no portal PGDAS-D
- Export PDF

### Extrato Bancário `/contabilidade/extrato-bancario`
- Upload OFX/CSV
- Tabela de itens com classificação (cor por confiança)
- Edição inline da conta/centro de custo
- Botão "Gerar Lançamentos"
- Gestão de regras de classificação

### Configuração Tributária (em `/admin/config`)
- Nova aba "Tributário"
- Pró-labore mensal, INSS%, CNAE, regime, anexo padrão

---

## Prioridades

| # | Funcionalidade | Prioridade | Dependências |
|---|---|---|---|
| 1 | Expansão plano de contas (ativo/passivo/patrimônio) | P0 | Nenhuma |
| 2 | Tabela lancamentos_contabeis + migration | P0 | #1 |
| 3 | Config tributária (pró-labore) | P0 | Nenhuma |
| 4 | Calculadora DAS + tabela das_apuracoes | P0 | #3 |
| 5 | Lançamentos automáticos (triggers CR/CP) | P0 | #1, #2 |
| 6 | Importador OFX Itaú + classificação IA | P1 | #1, #2 |
| 7 | Balancete de verificação | P1 | #2 |
| 8 | Livro Razão | P1 | #2 |
| 9 | Dashboard contábil | P1 | #4, #7 |
| 10 | Gerador DEFIS | P2 | #4 |
| 11 | Alertas tributários (Fator R, faixa) | P2 | #4 |
| 12 | Conciliação extrato × CR/CP | P2 | #6 |
