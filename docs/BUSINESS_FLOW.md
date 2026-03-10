# CROMA PRINT — FLUXO DE NEGÓCIO

> Fluxo operacional completo: Lead → Orçamento → Pedido → Produção → Instalação → Faturamento
> Atualizado: 2026-03-10

**Documentos relacionados**: [ARCHITECTURE](ARCHITECTURE.md) | [PRICING_ENGINE](PRICING_ENGINE.md) | [FIELD_APP](FIELD_APP.md) | [DATABASE_OVERVIEW](DATABASE_OVERVIEW.md)

---

## Índice

- [Visão Geral do Ciclo](#visão-geral-do-ciclo)
- [1. Prospecção e Qualificação](#1-prospecção-e-qualificação)
- [2. Orçamento e Proposta](#2-orçamento-e-proposta)
- [3. Pedido](#3-pedido)
- [4. Produção](#4-produção)
- [5. Estoque e Materiais](#5-estoque-e-materiais)
- [6. Instalação](#6-instalação)
- [7. Faturamento e Financeiro](#7-faturamento-e-financeiro)
- [8. Qualidade e Ocorrências](#8-qualidade-e-ocorrências)
- [9. Compras e Suprimentos](#9-compras-e-suprimentos)
- [10. Diagrama de Integração](#10-diagrama-completo-de-integração)
- [11. Automações](#11-automações-triggers-e-edge-functions)
- [12. SLAs por Etapa](#12-slas-por-etapa)

---

## Visão Geral do Ciclo

```
  PROSPECÇÃO       VENDA           EXECUÇÃO          ENTREGA        FINANCEIRO
  ─────────       ─────────       ─────────────     ──────────     ──────────
  Lead            Orçamento       Ordem Produção    Instalação     Faturamento
    ↓               ↓                 ↓                 ↓              ↓
  Qualificação    Proposta        Fila → Produção   Agendamento    Contas Receber
    ↓               ↓             → Acabamento      → Execução     → Parcelas
  Oportunidade    Aprovação       → Conferência     → Evidências   → Baixa
    ↓               ↓                 ↓                 ↓              ↓
  Cliente         Pedido          Liberação          Conclusão      DRE + NF-e
```

---

## 1. Prospecção e Qualificação

### Entrada de Leads
O lead pode entrar por diferentes canais:
- **Prospecção ativa (SDR)** — Busca ativa de empresas no perfil ICP
- **Site / formulário** — Inbound via landing pages
- **Indicação de cliente** — Referral de clientes ativos
- **Feira / evento** — Contatos de feiras do varejo
- **Redes sociais** — Instagram, LinkedIn, Facebook

### Ciclo do Lead
```
novo → em_contato → qualificando → qualificado → [converte em Cliente + Oportunidade]
                                                → descartado (motivo obrigatório)
```

### Qualificação BANT
Antes de virar oportunidade, o lead precisa ser qualificado:
- **B**udget: Tem orçamento para o projeto?
- **A**uthority: O contato é o decisor?
- **N**eed: A necessidade é real e urgente?
- **T**imeline: Há prazo definido?

### Scoring Automático
| Critério | Pontos | Por quê |
|----------|--------|---------|
| Rede/franquia (múltiplas unidades) | 90 | Volume recorrente + padronização |
| Mais de 10 unidades | 85 | Escala nacional |
| Fabricante (PDV para lojistas) | 80 | Demanda constante de material PDV |
| Loja individual grande | 50 | Fachada + comunicação interna |
| Evento/feira pontual | 30 | Projeto único, sem recorrência |

### Conversão
Lead qualificado → cria registro de **Cliente** + **Oportunidade** automaticamente.
O cliente herda: razão social, CNPJ, contato, segmento, vendedor.

---

## 2. Orçamento e Proposta

### Criação do Orçamento
O vendedor cria um orçamento selecionando:
1. **Cliente** — empresa e contato (dropdown com busca)
2. **Produto** — do catálogo (Banner, Fachada ACM, Adesivo, etc.)
3. **Modelo** — variação com dimensões pré-definidas (60×80cm, 100×120cm, etc.)
4. **Materiais** — auto-carregados do modelo, editáveis pelo vendedor
5. **Acabamentos** — ilhós, bastão, laminação, etc. (seleção com checkbox)
6. **Serviços** — criação de arte, instalação, frete (por proposta)

### Precificação Automática (Mubisys)
O motor de precificação calcula automaticamente em tempo real:
- Custo de matéria-prima (MP) baseado nos materiais selecionados
- Custo de mão-de-obra (MO) baseado no tempo produtivo
- Rateio de custos fixos da empresa
- Markup por categoria do produto
- Impostos, comissão e juros

> Detalhes completos dos 9 passos em [PRICING_ENGINE.md](PRICING_ENGINE.md)

### Versões de Proposta
Uma oportunidade pode ter **múltiplas versões** de proposta:
- V1: Proposta inicial
- V2: Revisão após negociação (ajuste de preço/escopo)
- V3: Proposta final aprovada

Cada versão gera um snapshot JSONB para rastreabilidade.

### Status da Proposta
```
rascunho → enviada → em_revisão → aprovada → [gera Pedido automaticamente]
                                  → recusada (motivo obrigatório)
                                  → expirada (após validade, default 10 dias)
```

### Templates de Orçamento
Para agilizar orçamentos recorrentes, o sistema oferece templates pré-configurados:
- **"Fachada ACM padrão"** — ACM + estrutura + vinílico + instalação
- **"Kit campanha sazonal"** — banners + faixas + adesivos de vitrine
- **"Comunicação interna básica"** — sinalização + placas + ambientação

---

## 3. Pedido

### Geração do Pedido
Quando a proposta é **aprovada**, o sistema gera automaticamente:
1. Registro de **Pedido** (`PED-YYYY-####`)
2. **Itens do pedido** copiados da proposta (com snapshot de preços)
3. **Títulos financeiros** (contas a receber com parcelas)
4. **Reserva de materiais** no estoque
5. **Ordens de produção** (uma OP por item)

### Status do Pedido (10 estados)
```
rascunho → aguardando_aprovação → aprovado → em_produção → produzido →
aguardando_instalação → em_instalação → parcialmente_concluído → concluído
                                                                → cancelado
```

### Prioridades e SLAs
| Prioridade | SLA Produção | SLA Total | Custo Extra |
|-----------|-------------|-----------|-------------|
| Baixa | 10 dias | 15 dias | — |
| Normal | 7 dias | 10 dias | — |
| Alta | 3 dias | 5 dias | — |
| Urgente | 1 dia | 24-48h | +25% a +50% (taxa urgência) |

### Rastreamento por Item
Cada item do pedido tem status independente:
```
pendente → em_produção → produzido → em_instalação → instalado
                                                     → cancelado
```
O pedido só fecha quando **TODOS** os itens estão concluídos ou cancelados.

---

## 4. Produção

### Geração das Ordens de Produção (OP)
Pedido aprovado gera uma OP (`OP-YYYY-####`) para cada item:
- Herda prazo do pedido (pode ter prazo interno menor)
- Vincula materiais necessários (reserva de estoque)
- Define etapas produtivas baseadas no produto/modelo

### Pipeline de Produção
```
aguardando_programação → em_fila → em_produção → em_acabamento →
em_conferência → liberado → [expedido para instalação]
         ↓
    retrabalho → volta para em_produção (com ocorrência automática)
```

### Etapas Padrão (configuráveis por produto)
| # | Etapa | Responsável | Tempo Típico |
|---|-------|-------------|-------------|
| 1 | Criação/Arte | Designer | 30-120 min |
| 2 | Aprovação de Arte | Cliente (externo) | 1-3 dias |
| 3 | Impressão | Operador | 5-60 min |
| 4 | Acabamento | Acabamento | 10-45 min |
| 5 | Serralheria | Serralheiro | 30-120 min (se aplicável) |
| 6 | Conferência | Qualidade | 5-15 min |
| 7 | Expedição | Logística | 10-30 min |
| 8 | Liberação | Supervisor | 5 min |

### Apontamentos
Cada etapa registra:
- Operador responsável
- Hora de início e fim
- Tempo real gasto (comparado com estimado)
- Materiais efetivamente consumidos

### Conferência de Qualidade
Antes de liberar, checklist obrigatório:
- ☐ Dimensões corretas?
- ☐ Cores fiéis ao layout?
- ☐ Acabamento sem defeitos?
- ☐ Quantidade conferida?

Reprovação na conferência → status `retrabalho` → gera **Ocorrência de qualidade** automaticamente.

---

## 5. Estoque e Materiais

### Fluxo de Materiais
```
Compra → Entrada (estoque) → Reserva (pedido aprovado) → Baixa (início produção)
                                                          → Devolução (retrabalho)
```

### Tipos de Movimentação
| Tipo | Quando | Efeito no Saldo |
|------|--------|-----------------|
| `entrada_compra` | Recebimento de compra | +disponível |
| `entrada_devolucao` | Material devolvido de OP | +disponível |
| `saida_producao` | Consumo em produção | -disponível |
| `saida_instalacao` | Material para campo | -disponível |
| `reserva` | Pedido aprovado | -disponível, +reservado |
| `liberacao_reserva` | Pedido cancelado | +disponível, -reservado |
| `ajuste_positivo` | Inventário (a mais) | +disponível |
| `ajuste_negativo` | Inventário (a menos) | -disponível |

### Alertas Automáticos
- 🟡 **Estoque crítico**: saldo < estoque_mínimo → alerta no dashboard de produção
- 🔴 **Ruptura**: saldo = 0 → gera solicitação de compra automática

---

## 6. Instalação

### Agendamento
Quando todas as OPs de um pedido estão "liberadas":
1. Seleciona equipe disponível (membros + veículo)
2. Define data e horário
3. Vincula materiais para transporte
4. Gera ordem de instalação (`INST-YYYY-####`)

### Status da Instalação
```
aguardando_agendamento → agendada → equipe_em_deslocamento → em_execução →
concluída | pendente | reagendada | não_concluída
```

### Fluxo no App de Campo
1. Técnico recebe tarefa no app mobile
2. Registra início (geolocalização automática)
3. Executa checklist pré-instalação
4. Tira fotos "antes" (com watermark automático)
5. Realiza a instalação
6. Tira fotos "depois" (com compressão automática)
7. Executa checklist pós-instalação
8. Coleta assinatura digital do cliente
9. Registra conclusão ou ocorrência

> Detalhes completos do App de Campo em [FIELD_APP.md](FIELD_APP.md)

### Evidências Obrigatórias
- ✅ Fotos antes/durante/depois (mín. 2 por momento)
- ✅ Checklist pré e pós
- ✅ Assinatura do cliente (canvas digital)
- ✅ Observações de campo

### Reagendamento
Se não concluído, registra motivo e reagenda preservando histórico completo.

---

## 7. Faturamento e Financeiro

### Geração Automática de Títulos
Pedido aprovado → gera contas a receber:
- Valor total do pedido
- Parcelas conforme condição de pagamento
- Vencimentos calculados automaticamente

### Status Financeiro
```
previsto → faturado → a_vencer → [vencido] → parcial → pago
                                                        → cancelado
```

### Condições de Pagamento
| Condição | Parcelas | Exemplo (R$ 10.000) |
|----------|---------|---------------------|
| À vista | 1× | R$ 10.000 na aprovação |
| 30/60 | 2× | R$ 5.000 em 30d + R$ 5.000 em 60d |
| 30/60/90 | 3× | 3 × R$ 3.333,33 |
| Entrada + parcelas | 1+2 | R$ 4.000 entrada + 2 × R$ 3.000 |

### Inadimplência
- Título vencido > 30 dias → ⚠️ flag automática no cadastro do cliente
- Título vencido > 60 dias → 🔴 bloqueio de novos pedidos
- Dashboard financeiro mostra indicadores em tempo real

### Comissões
- Comissão gerada **SOMENTE** após título efetivamente pago
- Percentual configurável por vendedor (default 5%)
- Fluxo: `gerada → aprovada → paga → [cancelada]`

### Nota Fiscal (NF-e)
O módulo fiscal permite:
- Emissão de NF-e vinculada ao pedido/título
- Certificado digital A1 configurável
- Fila de emissão com status de transmissão
- Auditoria de documentos fiscais
- Consulta de situação na SEFAZ

### DRE Gerencial
O DRE (Demonstrativo de Resultado do Exercício) é montado automaticamente:
```
(+) Receita Bruta (faturamento)
(-) Impostos sobre venda (12%)
(=) Receita Líquida
(-) Custo dos Produtos Vendidos (MP + MO direta)
(=) Lucro Bruto
(-) Despesas Operacionais
    - Comercial (comissões, marketing)
    - Administrativa (aluguel, salários admin)
    - Logística (frete, combustível)
(=) Lucro Operacional
(-) Despesas Financeiras (juros, taxas)
(=) Lucro Líquido
```

### Margem Real por Pedido
Após conclusão do pedido, o sistema calcula:
```
Margem Real = Preço Venda - (Custo MP real + Tempo Produção real × Cm + Custo Logística)
```
Comparação com margem estimada no orçamento permite **melhoria contínua** do pricing.

---

## 8. Qualidade e Ocorrências

### Tipos de Ocorrência
| Tipo | Origem | Ação Típica | Impacto |
|------|--------|-------------|---------|
| `reclamacao_cliente` | Cliente | Análise + tratativa + ressarcimento | Alto |
| `defeito_producao` | Conferência | Retrabalho na OP | Médio |
| `problema_instalacao` | Campo | Reagendamento | Médio |
| `material_nao_conforme` | Recebimento | Devolução ao fornecedor | Baixo |
| `divergencia_pedido` | Qualquer | Investigação | Variável |
| `atraso_entrega` | Produção/logística | Escalonamento ao gestor | Alto |
| `outro` | Qualquer | Análise caso a caso | Variável |

### Fluxo da Ocorrência
```
aberta → em_análise → em_tratamento → verificação → encerrada
                                                    → reaberta (se não resolvido)
```

### Campos Obrigatórios
- **Causa raiz**: erro_arte, erro_produção, material_ruim, instrução_incorreta, etc.
- **Tratativa**: O que foi feito para resolver
- **Custo**: Material + MO do reprocesso (debita margem do pedido)

### Indicadores de Qualidade
- Total de ocorrências por período
- Custo total de retrabalhos
- Top 5 causas mais frequentes
- Taxa de defeitos por operador/equipamento
- Tempo médio de resolução

---

## 9. Compras e Suprimentos

### Fluxo de Compra
```
Necessidade → Solicitação → Cotação → Pedido Compra → Recebimento → Estoque
           (auto ou manual)  (3 cotações se > R$5.000)              → Contas Pagar
```

### Regras
- **Ruptura de estoque** → gera solicitação automática
- **Compra > R$ 5.000** → exige 3 cotações comparativas
- **Recebimento** → gera entrada no estoque + título a pagar
- **Histórico de preços** → por fornecedor para negociação

---

## 10. Diagrama Completo de Integração

```
[Lead] ──qualificação──→ [Cliente] + [Oportunidade]
                              │
                              ↓
                         [Orçamento/Proposta] ←── [Template]
                              │ aprovação
                              ↓
                          [Pedido] ──────────────→ [Contas Receber] → [NF-e]
                              │                          │
                    ┌─────────┼─────────┐               │
                    ↓         ↓         ↓               ↓
               [OP Item1] [OP Item2] [OP Item3]    [Parcelas]
                    │                                    │
                    ↓                                    ↓
            [Reserva Estoque]                      [Recebimento]
                    │                                    │
                    ↓                                    ↓
              [Produção]                            [Comissão]
                    │                                    │
                    ↓                                    ↓
             [Conferência] ──falhou──→ [Ocorrência]  [DRE]
                    │
                    ↓ OK
              [Instalação]
                    │
              ┌─────┴─────┐
              ↓           ↓
         [App Campo]  [Evidências]
              │         (fotos, assinatura)
              ↓
          [Conclusão]
              │
              ↓
       [Pedido Concluído]
              │
              ↓
       [Margem Real calculada]
```

---

## 11. Automações (Triggers e Edge Functions)

| Trigger | Quando | Ação | Status |
|---------|--------|------|--------|
| `proposta-aprovada` | Proposta status = aprovada | Gera pedido + títulos + OPs | ✅ Código pronto |
| `pedido-aprovado` | Pedido status = aprovado | Reserva materiais + gera OPs | ✅ Código pronto |
| `início-produção` | OP status = em_produção | Converte reserva em baixa efetiva | ✅ Código pronto |
| `conferência-reprovada` | OP status = retrabalho | Gera ocorrência automática | ✅ Código pronto |
| `ops-liberadas` | Todas OPs do pedido liberadas | Habilita agendamento instalação | ⚠️ Precisa migration 004 |
| `instalação-concluída` | Todos itens instalados | Pedido status = concluído | ⚠️ Precisa migration 004 |
| `título-vencido` | Data vencimento < hoje | Flag inadimplência no cliente | ✅ Código pronto |
| `título-pago` | Título status = pago | Gera comissão do vendedor | ✅ Código pronto |
| `estoque-crítico` | Saldo < mínimo | Gera alerta + solicitação compra | ✅ Código pronto |
| `recebimento-compra` | Conferência OK | Entrada estoque + conta a pagar | ✅ Código pronto |

---

## 12. SLAs por Etapa

Tempos médios esperados para cada etapa do ciclo:

| Etapa | SLA Normal | SLA Urgente | Responsável |
|-------|-----------|-------------|-------------|
| Lead → Qualificação | 3-5 dias | 1 dia | Comercial/SDR |
| Orçamento → Envio | 1-2 dias | 4 horas | Comercial |
| Proposta → Aprovação | 5-10 dias | 1-2 dias | Cliente |
| Pedido → Início Produção | 1-2 dias | Imediato | Produção |
| Produção (por item) | 3-7 dias | 1 dia | Produção |
| Conferência | 1 dia | 2 horas | Qualidade |
| Agendamento → Instalação | 2-5 dias | 1 dia | Logística |
| Instalação → Evidências | Mesmo dia | Mesmo dia | Campo |
| Faturamento → NF-e | 1-2 dias | Mesmo dia | Financeiro |
| **Ciclo total** | **15-30 dias** | **3-5 dias** | — |
