# CROMA PRINT — FLUXO DE NEGOCIO

> Fluxo operacional completo: Cliente → Orcamento → Pedido → Producao → Instalacao → Faturamento
> Atualizado: 2026-03-10

---

## Visao Geral do Ciclo

```
  PROSPECAO        VENDA           EXECUCAO          ENTREGA        FINANCEIRO
  ─────────      ─────────      ─────────────      ──────────      ──────────
  Lead           Orcamento      Ordem Producao     Instalacao      Faturamento
    ↓              ↓                ↓                  ↓               ↓
  Qualificacao   Proposta       Fila → Producao    Agendamento     Contas Receber
    ↓              ↓            → Acabamento       → Execucao      → Parcelas
  Oportunidade   Aprovacao      → Conferencia      → Evidencias    → Baixa
    ↓              ↓                ↓                  ↓               ↓
  Cliente        Pedido         Liberacao           Conclusao       DRE
```

---

## 1. Prospecao e Qualificacao

### Entrada de Leads
O lead pode entrar por diferentes canais:
- Prospecao ativa (SDR)
- Site / formulario
- Indicacao de cliente
- Feira / evento
- Redes sociais

### Ciclo do Lead
```
novo → em_contato → qualificando → qualificado → [converte em Cliente + Oportunidade]
                                               → descartado (com motivo obrigatorio)
```

### Qualificacao BANT
Antes de virar oportunidade, o lead precisa ser qualificado:
- **B**udget: Tem orcamento para o projeto?
- **A**uthority: O contato e o decisor?
- **N**eed: A necessidade e real e urgente?
- **T**imeline: Ha prazo definido?

### Scoring Automatico
| Criterio | Pontos |
|----------|--------|
| Rede/franquia (multiplas unidades) | 90 |
| Mais de 10 unidades | 85 |
| Fabricante (PDV para lojistas) | 80 |
| Loja individual grande | 50 |

### Conversao
Lead qualificado → cria registro de **Cliente** + **Oportunidade** automaticamente.

---

## 2. Orcamento e Proposta

### Criacao do Orcamento
O vendedor cria um orcamento selecionando:
1. **Cliente** — empresa e contato
2. **Produto** — do catalogo (Banner, Fachada ACM, Adesivo, etc.)
3. **Modelo** — variacao do produto (60x80cm, 100x120cm, etc.)
4. **Materiais** — auto-carregados do modelo, editaveis
5. **Acabamentos** — ilhos, bastao, laminacao, etc.
6. **Servicos** — criacao de arte, instalacao, frete

### Precificacao Automatica (Mubisys)
O motor de precificacao calcula automaticamente:
- Custo de materia-prima (MP) baseado nos materiais selecionados
- Custo de mao-de-obra (MO) baseado no tempo produtivo
- Rateio de custos fixos
- Markup por categoria
- Impostos, comissao e juros

> Detalhes completos em `PRICING_ENGINE.md`

### Versoes de Proposta
Uma oportunidade pode ter **multiplas versoes** de proposta:
- V1: Proposta inicial
- V2: Revisao apos negociacao (ajuste de preco/escopo)
- V3: Proposta final aprovada

### Status da Proposta
```
rascunho → enviada → em_revisao → aprovada → [gera Pedido]
                                 → recusada (motivo obrigatorio)
                                 → expirada (apos validade, default 10 dias)
```

### Templates de Orcamento
Para agilizar orcamentos recorrentes, o sistema oferece templates pre-configurados:
- "Fachada ACM padrao" — itens + materiais pre-definidos
- "Kit campanha sazonal" — banners + faixas + adesivos
- "Comunicacao interna basica" — sinalizacao + placas

---

## 3. Pedido

### Geracao do Pedido
Quando a proposta e **aprovada**, o sistema gera automaticamente:
1. Registro de **Pedido** (`PED-YYYY-####`)
2. **Itens do pedido** copiados da proposta
3. **Titulos financeiros** (contas a receber)
4. **Reserva de materiais** no estoque
5. **Ordens de producao** por item

### Status do Pedido (10 estados)
```
rascunho → aguardando_aprovacao → aprovado → em_producao → produzido →
aguardando_instalacao → em_instalacao → parcialmente_concluido → concluido → cancelado
```

### Prioridades
| Prioridade | SLA | Custo extra |
|-----------|-----|-------------|
| Baixa | 15 dias | - |
| Normal | 10 dias | - |
| Alta | 5 dias | - |
| Urgente | 24-48h | +25% a +50% (taxa urgencia) |

### Rastreamento por Item
Cada item do pedido tem status independente:
```
pendente → em_producao → produzido → em_instalacao → instalado
```
O pedido so fecha quando TODOS os itens estao concluidos.

---

## 4. Producao

### Geracao das Ordens de Producao (OP)
Pedido aprovado gera uma OP (`OP-YYYY-####`) para cada item:
- Herda prazo do pedido (pode ter prazo interno menor)
- Vincula materiais necessarios (reserva de estoque)
- Define etapas produtivas baseadas no produto

### Pipeline de Producao
```
aguardando_programacao → em_fila → em_producao → em_acabamento →
em_conferencia → liberado → [expedido]
         ↓
    retrabalho → volta para em_producao (com ocorrencia)
```

### Etapas Padrao (configuraveis por produto)
1. **Criacao/Arte** — Design grafico
2. **Aprovacao de Arte** — Cliente valida o layout
3. **Impressao** — Producao no equipamento
4. **Acabamento** — Acabamentos fisicos (ilhos, corte, laminacao)
5. **Serralheria** — Se aplicavel (estruturas metalicas)
6. **Conferencia** — Checklist de qualidade obrigatorio
7. **Expedicao** — Embalagem para transporte
8. **Liberacao** — Pronto para instalacao

### Apontamentos
Cada etapa registra:
- Operador responsavel
- Hora de inicio e fim
- Tempo real gasto (comparado com estimado)
- Materiais efetivamente consumidos

### Conferencia de Qualidade
Antes de liberar, checklist obrigatorio:
- Dimensoes corretas?
- Cores fieis ao layout?
- Acabamento sem defeitos?
- Quantidade conferida?

Reprovacao na conferencia → status `retrabalho` → gera Ocorrencia de qualidade.

---

## 5. Estoque e Materiais

### Fluxo de Materiais
```
Compra → Entrada (estoque) → Reserva (pedido aprovado) → Baixa (inicio producao)
                                                         → Devolucao (retrabalho)
```

### Tipos de Movimentacao
| Tipo | Quando |
|------|--------|
| `entrada_compra` | Recebimento de compra |
| `entrada_devolucao` | Material devolvido de OP |
| `saida_producao` | Consumo em producao |
| `saida_instalacao` | Material para campo |
| `reserva` | Pedido aprovado |
| `liberacao_reserva` | Pedido cancelado |
| `ajuste_positivo` | Inventario (a mais) |
| `ajuste_negativo` | Inventario (a menos) |

### Alertas Automaticos
- **Estoque critico**: saldo < estoque_minimo → alerta no dashboard
- **Ruptura**: saldo = 0 → gera solicitacao de compra automatica

---

## 6. Instalacao

### Agendamento
Quando todas as OPs de um pedido estao "liberadas":
1. Seleciona equipe disponivel (membros + veiculo)
2. Define data e horario
3. Vincula materiais para transporte
4. Gera ordem de instalacao (`INST-YYYY-####`)

### Status da Instalacao
```
aguardando_agendamento → agendada → equipe_em_deslocamento → em_execucao →
concluida | pendente | reagendada | nao_concluida
```

### Fluxo no App de Campo
1. Tecnico recebe tarefa no app mobile
2. Registra inicio (geolocalizacao)
3. Executa checklist pre-instalacao
4. Tira fotos "antes"
5. Realiza a instalacao
6. Tira fotos "depois"
7. Executa checklist pos-instalacao
8. Coleta assinatura digital do cliente
9. Registra conclusao ou ocorrencia

### Evidencias Obrigatorias
- Fotos antes/durante/depois
- Checklist pre e pos
- Assinatura do cliente
- Observacoes de campo

### Reagendamento
Se nao concluido, registra motivo e reagenda preservando historico.

---

## 7. Faturamento e Financeiro

### Geracao Automatica de Titulos
Pedido aprovado → gera contas a receber:
- Valor total do pedido
- Parcelas conforme condicao de pagamento
- Vencimentos calculados automaticamente

### Status Financeiro
```
previsto → faturado → a_vencer → [vencido] → parcial → pago
                                                       → cancelado
```

### Condicoes de Pagamento
- A vista (100% na aprovacao)
- 30/60 (50% em 30 dias, 50% em 60 dias)
- 30/60/90 (3 parcelas iguais)
- Entrada + parcelas (ex: 40% entrada, 2x30%)

### Inadimplencia
- Titulo vencido > 30 dias → flag automatica no cliente
- Titulo vencido > 60 dias → bloqueio de novos pedidos
- Dashboard financeiro mostra indicadores em tempo real

### Comissoes
- Comissao gerada SOMENTE apos titulo efetivamente pago
- Percentual configuravel por vendedor (default 5%)
- Status: `gerada → aprovada → paga`

### DRE Gerencial
O DRE (Demonstrativo de Resultado do Exercicio) e montado automaticamente:
```
(+) Receita Bruta (faturamento)
(-) Impostos sobre venda
(=) Receita Liquida
(-) Custo dos Produtos Vendidos (MP + MO direta)
(=) Lucro Bruto
(-) Despesas Operacionais
    - Comercial (comissoes, marketing)
    - Administrativa (aluguel, salarios admin)
    - Logistica (frete, combustivel)
(=) Lucro Operacional
(-) Despesas Financeiras (juros, taxas)
(=) Lucro Liquido
```

### Margem Real por Pedido
Apos conclusao do pedido, o sistema calcula:
```
Margem Real = Preco Venda - (Custo MP real + Tempo Producao real x Cm + Custo Logistica)
```
Comparacao com margem estimada no orcamento permite melhoria continua.

---

## 8. Qualidade e Ocorrencias

### Tipos de Ocorrencia
| Tipo | Origem | Acao |
|------|--------|------|
| `reclamacao_cliente` | Cliente | Analise + tratativa |
| `defeito_producao` | Conferencia | Retrabalho |
| `problema_instalacao` | Campo | Reagendamento |
| `material_nao_conforme` | Recebimento | Devolucao fornecedor |
| `divergencia_pedido` | Qualquer | Investigacao |
| `atraso_entrega` | Producao/logistica | Escalonamento |
| `outro` | Qualquer | Analise |

### Fluxo da Ocorrencia
```
aberta → em_analise → em_tratamento → verificacao → encerrada
                                                   → reaberta
```

### Campos Obrigatorios
- **Causa raiz**: erro_arte, erro_producao, material_ruim, instrucao_incorreta, etc.
- **Tratativa**: O que foi feito para resolver
- **Custo**: Material + MO do reprocesso (debita margem do pedido)

### Indicadores de Qualidade
- Total de ocorrencias por periodo
- Custo total de retrabalhos
- Top 5 causas mais frequentes
- Taxa de defeitos por operador/equipamento

---

## 9. Compras e Suprimentos

### Fluxo de Compra
```
Necessidade → Solicitacao → Cotacao → Pedido Compra → Recebimento → Estoque
           (auto ou manual)  (3 cotacoes se > R$5000)              → Contas Pagar
```

### Regras
- Ruptura de estoque gera solicitacao automatica
- Compra acima de R$ 5.000 exige 3 cotacoes comparativas
- Recebimento gera entrada no estoque + titulo a pagar
- Historico de precos por fornecedor para negociacao

---

## 10. Diagrama Completo de Integracao

```
[Lead] ──qualificacao──→ [Cliente] + [Oportunidade]
                              │
                              ↓
                         [Orcamento/Proposta]
                              │ aprovacao
                              ↓
                          [Pedido] ──────────────→ [Contas Receber]
                              │                          │
                    ┌─────────┼─────────┐               │
                    ↓         ↓         ↓               ↓
               [OP Item1] [OP Item2] [OP Item3]    [Parcelas]
                    │                                    │
                    ↓                                    ↓
            [Reserva Estoque]                      [Recebimento]
                    │                                    │
                    ↓                                    ↓
              [Producao]                            [Comissao]
                    │                                    │
                    ↓                                    ↓
             [Conferencia]                           [DRE]
                    │
                    ↓
              [Instalacao]
                    │
              ┌─────┴─────┐
              ↓           ↓
         [App Campo]  [Evidencias]
              │
              ↓
          [Conclusao]
              │
              ↓
         [Faturamento]
```

---

## 11. Automacoes (Triggers e Edge Functions)

| Trigger | Quando | Acao |
|---------|--------|------|
| `proposta-aprovada` | Proposta status = aprovada | Gera pedido + titulos + OPs |
| `pedido-aprovado` | Pedido status = aprovado | Reserva materiais + gera OPs |
| `inicio-producao` | OP status = em_producao | Converte reserva em baixa efetiva |
| `conferencia-reprovada` | OP status = retrabalho | Gera ocorrencia automatica |
| `ops-liberadas` | Todas OPs do pedido liberadas | Habilita agendamento instalacao |
| `instalacao-concluida` | Todos itens instalados | Pedido status = concluido |
| `titulo-vencido` | Data vencimento < hoje | Flag inadimplencia no cliente |
| `titulo-pago` | Titulo status = pago | Gera comissao do vendedor |
| `estoque-critico` | Saldo < minimo | Gera alerta + solicitacao compra |
| `recebimento-compra` | Conferencia OK | Entrada estoque + conta a pagar |
