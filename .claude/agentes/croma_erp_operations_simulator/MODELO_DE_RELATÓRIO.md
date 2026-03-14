# MODELO DE RELATÓRIO — SIMULADOR DE OPERAÇÕES CROMA_ERP

> Template de relatório consolidado gerado pelo AGENTE_AUDITOR e entregue pelo CROMA_MASTER_AGENT.
> Salvar em: `docs/qa-reports/YYYY-MM-DD-HH-MM-operations-sim-report.md`

---

# RELATÓRIO DE SIMULAÇÃO OPERACIONAL — CROMA_ERP
## Sessão: {DATA} às {HORA}

---

## 1. RESUMO EXECUTIVO

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SIMULADOR DE OPERAÇÕES CROMA_ERP — RESULTADO FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Cenário executado:    {ex: Banner-Teste — Fluxo Completo}
  Data/Hora:            {YYYY-MM-DD HH:MM}
  Duração da sessão:    {N} minutos

  Sub-agentes ativos:
    ✅ AGENTE_COMERCIAL
    ✅ AGENTE_ENGENHARIA
    ✅ AGENTE_PRODUCAO
    ✅ AGENTE_FINANCIAL
    ✅ AGENTE_AUDITOR

  Passos executados:    {N}/17
  Taxa de sucesso:      {N}%

  Erros encontrados:
    🔴 CRÍTICO: {N}
    🟠 ALTO:    {N}
    🟡 MÉDIO:   {N}
    🟢 BAIXO:   {N}
    ──────────────────
    TOTAL:      {N}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VEREDITO: {🔴 INAPTO | 🟠 PARCIALMENTE APTO | 🟡 APTO COM RESSALVAS | 🟢 APTO}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Justificativa do veredito**:
> {2-3 frases explicando o fator principal que determinou o veredito}

---

## 2. FLUXO OPERACIONAL EXECUTADO

### Diagrama de Execução das Fases

```
FASE 1 (paralela)          FASE 2           FASE 3       FASE 4 (paralela)      FASE 5
─────────────────────      ─────────────    ──────────   ─────────────────────  ───────
AGENTE_ENGENHARIA  ──┐     AGENTE_COMERCIAL AGENTE_      AGENTE_FINANCIAL  ──┐  AGENTE_
  Passos 1-4        │──►    Passos 7-10    PRODUCAO       Passos 13-15      │  AUDITOR
AGENTE_COMERCIAL  ──┘                      Passos 11-12  AGENTE_PRODUCAO  ──┘
  Passos 5-6                                              Passos 16-17
```

### Status por Fase

| Fase | Agentes | Status | Tempo |
|------|---------|--------|-------|
| Fase 1 — Preparação | Engenharia + Comercial (parcial) | {✅/❌/⚠️} | {N}min |
| Fase 2 — Venda | Comercial | {✅/❌/⚠️} | {N}min |
| Fase 3 — Produção | Produção | {✅/❌/⚠️} | {N}min |
| Fase 4 — Financeiro+Entrega | Financial + Produção | {✅/❌/⚠️} | {N}min |
| Fase 5 — Auditoria | Auditor | {✅/❌/⚠️} | {N}min |

---

## 3. DADOS GERADOS PELO TESTE

```
ENTIDADES CRIADAS:
  Lead:          {nome} ({lead_id})
  Cliente:       {empresa} / CNPJ: {cnpj} ({cliente_id})
  Orçamento:     {orcamento_numero} ({orcamento_id})
  Pedido:        {pedido_numero} ({pedido_id})
  OP:            {op_numero} ({op_id})
  OI:            {oi_numero} ({oi_id})
  Job (campo):   {job_id}
  NF-e:          {nfe_numero} ({nfe_id})
  Cobrança:      {cobranca_id}

PRODUTO TESTADO:
  Produto:       {nome}
  Variação:      {modelo}
  Quantidade:    {N} unidades
  Composição:    {N} materiais cadastrados

VALORES:
  Custo unitário calculado:  R$ {valor} (esperado: R$ 43,21)
  Preço de venda:            R$ {valor} (esperado: R$ 151,24)
  Total do pedido:           R$ {valor} (esperado: R$ 1.512,40)
  Valor cobrado:             R$ {valor}
  Valor NF-e:                R$ {valor}
  Consistência de valores:   {✅ OK | ❌ DIVERGENTE}
```

---

## 4. RESULTADO POR SUB-AGENTE

### AGENTE_COMERCIAL

| Passo | Descrição | Status | Observação |
|-------|-----------|--------|------------|
| 5 | Gerar lead | {✅/❌/⚠️} | {obs} |
| 6 | Converter lead em cliente | {✅/❌/⚠️} | {obs} |
| 7 | Criar orçamento | {✅/❌/⚠️} | {obs} |
| 8 | Enviar proposta | {✅/❌/⚠️} | {obs} |
| 9 | Simular aprovação | {✅/❌/⚠️} | {obs} |
| 10 | Gerar pedido | {✅/❌/⚠️} | {obs} |

### AGENTE_ENGENHARIA

| Passo | Descrição | Status | Observação |
|-------|-----------|--------|------------|
| 1 | Cadastrar matéria-prima | {✅/❌/⚠️} | {obs} |
| 2 | Criar produto | {✅/❌/⚠️} | {obs} |
| 3 | Criar variações | {✅/❌/⚠️} | {obs} |
| 4 | Compor produto (BOM) | {✅/❌/⚠️} | {obs} |

### AGENTE_PRODUCAO

| Passo | Descrição | Status | Observação |
|-------|-----------|--------|------------|
| 11 | Executar produção (5 etapas) | {✅/❌/⚠️} | {obs} |
| 12 | Finalizar produção | {✅/❌/⚠️} | {obs} |
| 16 | Liberar para entrega/instalação | {✅/❌/⚠️} | {obs} |
| 17 | Integração App de Campo | {✅/❌/⚠️} | {obs} |

### AGENTE_FINANCIAL

| Passo | Descrição | Status | Observação |
|-------|-----------|--------|------------|
| 13 | Receber pedido / validar valores | {✅/❌/⚠️} | {obs} |
| 14 | Emitir NF-e | {✅/❌/⚠️} | {obs} |
| 15 | Gerar boleto / registrar pagamento | {✅/❌/⚠️} | {obs} |

---

## 5. PROBLEMAS IDENTIFICADOS

### 5.1 — Erros CRÍTICOS 🔴

---

**{ID}** — {Título do erro}

```
Agente:      {AGENTE_X}
Passo:       {N} — {descrição do passo}
Módulo ERP:  {módulo afetado}
```

**Descrição**: {Descrição clara do problema}

**Reprodução**:
1. {passo 1}
2. {passo 2}
3. {resultado}

**Resultado esperado**: {o que deveria acontecer}
**Resultado obtido**: {o que aconteceu}
**Causa provável**: {hipótese}
**Impacto no negócio**: {como afeta a operação}

---

*(repetir para cada erro CRÍTICO)*

---

### 5.2 — Erros ALTOS 🟠

| ID | Agente | Passo | Descrição | Impacto |
|----|--------|-------|-----------|---------|
| {ID} | {agente} | {N} | {descrição} | {impacto} |

---

### 5.3 — Erros MÉDIOS 🟡

| ID | Agente | Passo | Descrição | Sugestão |
|----|--------|-------|-----------|---------|
| {ID} | {agente} | {N} | {descrição} | {sugestão} |

---

### 5.4 — Melhorias BAIXAS 🟢

| ID | Local | Sugestão de Melhoria |
|----|-------|---------------------|
| {ID} | {tela/módulo} | {sugestão} |

---

## 6. QUEBRAS DE FLUXO

> Pontos onde o fluxo operacional não conseguiu avançar entre etapas.

| Etapa Origem | Etapa Destino | Motivo da Quebra | Severidade |
|-------------|--------------|-----------------|-----------|
| {etapa} | {etapa} | {motivo} | {severidade} |

**Passos não executados por consequência de quebra**:
- Passo {N}: {razão — bloqueado por erro no passo anterior}

---

## 7. AUDITORIA CROSS-FUNCIONAL (AGENTE_AUDITOR)

### Consistência de Valores

| Documento | Valor Registrado | Consistente? |
|-----------|-----------------|-------------|
| Orçamento | R$ {valor} | {✅/❌} |
| Pedido | R$ {valor} | {✅/❌} |
| Cobrança | R$ {valor} | {✅/❌} |
| NF-e | R$ {valor} | {✅/❌} |

### Integridade Referencial

| Relacionamento | Status | Observação |
|---------------|--------|------------|
| Lead → Cliente | {✅ íntegro / ❌ quebrado} | {obs} |
| Orçamento → Pedido | {✅/❌} | {obs} |
| Pedido → OP | {✅/❌} | {obs} |
| OI → Job (campo) | {✅/❌} | {obs} |

### Status Finais das Entidades

| Entidade | Status Final | Esperado | OK? |
|----------|-------------|---------|-----|
| Lead | {status} | convertido | {✅/❌} |
| Orçamento | {status} | aprovado | {✅/❌} |
| Pedido | {status} | faturado | {✅/❌} |
| OP | {status} | concluida | {✅/❌} |
| OI | {status} | concluida | {✅/❌} |
| Job | {status} | Concluído | {✅/❌} |

---

## 8. ERROS DE REGRA DE NEGÓCIO

| Regra | Testada? | Sistema Bloqueia? | Comportamento Observado |
|-------|----------|-----------------|------------------------|
| Pedido sem orçamento aprovado | {sim/não} | {sim/não} | {obs} |
| Faturar sem produção concluída | {sim/não} | {sim/não} | {obs} |
| Orçamento com valor zero | {sim/não} | {sim/não} | {obs} |
| CNPJ inválido | {sim/não} | {sim/não} | {obs} |

---

## 9. PROBLEMAS DE UX

| Módulo | Problema | Severidade | Sugestão |
|--------|----------|-----------|---------|
| {módulo} | {problema} | {MÉDIO/BAIXO} | {sugestão} |

**Padrões de UX problemáticos identificados**:
- {listar padrões encontrados}

---

## 10. MÓDULOS INCOMPLETOS

| Módulo | UI | Backend | Status | Impacto |
|--------|----|---------|--------|---------|
| BOM / Composição | {✅/❌} | {✅/❌} | {status} | {impacto} |
| Motor de precificação | {✅/❌} | {✅/❌} | {status} | {impacto} |
| Portal de aprovação | {✅/❌} | {✅/❌} | {status} | {impacto} |
| Etapas de produção | {✅/❌} | {✅/❌} | {status} | {impacto} |
| NF-e / Fiscal | {✅/❌} | {✅/❌} | {status} | {impacto} |
| Bridge App de Campo | {✅/❌} | {✅/❌} | {status} | {impacto} |

---

## 11. MELHORIAS RECOMENDADAS

### Prioritárias — implementar antes do próximo deploy

1. **{título}** — {descrição e justificativa}
2. **{título}** — {descrição}

### Desejáveis — implementar nas próximas sprints

1. **{título}** — {descrição}
2. **{título}** — {descrição}

---

## 12. PLANO DE CORREÇÃO PRIORITÁRIO

| # | Erro | Módulo | Esforço | Impacto se não corrigir |
|---|------|--------|---------|------------------------|
| 1 | {erro mais crítico} | {módulo} | P/M/G | {impacto} |
| 2 | {próximo} | {módulo} | P/M/G | {impacto} |
| 3 | {próximo} | {módulo} | P/M/G | {impacto} |
| 4 | {próximo} | {módulo} | P/M/G | {impacto} |
| 5 | {próximo} | {módulo} | P/M/G | {impacto} |

**Legenda esforço**: P = Pequeno (<2h) | M = Médio (2h-1dia) | G = Grande (>1dia)

---

## 13. AVALIAÇÃO DE PRONTIDÃO DO ERP — STATUS POR MÓDULO

| Módulo | Status | Bloqueadores Críticos |
|--------|--------|----------------------|
| Cadastro de Produtos (BOM) | {✅ Operacional / ⚠️ Parcial / ❌ Inoperante} | {se houver} |
| CRM / Leads | {status} | {bloqueadores} |
| Orçamentos + Portal | {status} | {bloqueadores} |
| Pedidos | {status} | {bloqueadores} |
| Produção (PCP + Chão) | {status} | {bloqueadores} |
| Financeiro | {status} | {bloqueadores} |
| Faturamento (NF-e) | {status} | {bloqueadores} |
| Expedição | {status} | {bloqueadores} |
| Instalação + App Campo | {status} | {bloqueadores} |

---

## VEREDITO FINAL

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {🔴 INAPTO / 🟠 PARCIALMENTE APTO / 🟡 APTO COM RESSALVAS / 🟢 APTO}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  {Texto explicativo do veredito em 3-5 frases.
   O que funciona, o que não funciona, o que deve ser feito antes
   de liberar o sistema para uso operacional real.}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Emitido por:  CROMA_MASTER_AGENT + AGENTE_AUDITOR
  Data:         {YYYY-MM-DD HH:MM}
  Próxima exec: {após próximo deploy / em {N} dias}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

*Relatório gerado pelo Sistema Multi-Agente — Simulador de Operações CROMA_ERP*
*Para re-executar: invocar AGENTE_PRINCIPAL.md com o cenário desejado*
