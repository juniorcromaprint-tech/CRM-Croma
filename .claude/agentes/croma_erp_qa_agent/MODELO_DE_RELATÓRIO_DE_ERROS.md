# MODELO DE RELATÓRIO DE ERROS — QA CROMA_ERP

> Template para preenchimento pelo Módulo 10 (GERADOR DE RELATÓRIOS) ao final de cada execução.
> Salvar em: `docs/qa-reports/YYYY-MM-DD-HH-MM-qa-report.md`

---

# RELATÓRIO DE QA OPERACIONAL — CROMA_ERP
## Execução: {DATA} às {HORA}

---

## 1. RESUMO EXECUTIVO

```
Data/Hora:          {YYYY-MM-DD HH:MM}
Cenário executado:  {ex: Banner-Teste — Fluxo Completo}
Passos totais:      17
Passos executados:  {N}
Passos com sucesso: {N}
Passos com falha:   {N}
Taxa de sucesso:    {N}%

Erros encontrados:
  🔴 CRÍTICO: {N}
  🟠 ALTO:    {N}
  🟡 MÉDIO:   {N}
  🟢 BAIXO:   {N}
  ─────────────────
  TOTAL:      {N}
```

### Veredito de Prontidão

```
[ ] 🔴 INAPTO — Erros críticos impedem operação básica
[ ] 🟠 PARCIALMENTE APTO — Funciona com restrições sérias
[ ] 🟡 APTO COM RESSALVAS — Operação possível com cuidados
[ ] 🟢 APTO PARA PRODUÇÃO — Sem bloqueadores críticos
```

**Justificativa do veredito**:
> {Descrever em 2-3 frases o principal fator que determinou o veredito}

---

## 2. DESCRIÇÃO DO FLUXO EXECUTADO

### Personas ativas nesta execução:
- [ ] Vendedor
- [ ] Orçamentista
- [ ] Operador de Cadastro
- [ ] PCP de Produção
- [ ] Operador de Produção
- [ ] Financeiro
- [ ] Faturamento
- [ ] Expedição
- [ ] Coordenador de Instalação

### Módulos do sistema acessados:
> {Listar os módulos do ERP que foram acessados durante a execução}

---

## 3. DADOS GERADOS PELO TESTE

```
Cliente fictício:    {Nome da empresa}
CNPJ:               {XX.XXX.XXX/0001-XX}
Produto testado:    {Nome do produto}
Variação:           {Modelo testado}
Quantidade:         {N unidades}

IDs gerados (se aplicável):
  Lead ID:          {uuid ou N/A}
  Cliente ID:       {uuid ou N/A}
  Orçamento ID:     {uuid ou N/A}
  Pedido ID:        {uuid ou N/A}
  OP ID:            {uuid ou N/A}
  OI ID:            {uuid ou N/A}
  Job ID:           {uuid ou N/A}

Valores calculados:
  Custo unitário:   R$ {valor}
  Preço de venda:   R$ {valor}
  Total do pedido:  R$ {valor}
  Valor esperado:   R$ {valor}
  Variação:         {%} {OK / DIVERGENTE}
```

---

## 4. RESULTADO POR PASSO

| # | Passo | Persona | Status | Observação |
|---|-------|---------|--------|------------|
| 1 | Cadastrar matéria-prima | Operador de Cadastro | {✅/❌/⚠️} | {obs} |
| 2 | Criar produto Banner-Teste | Operador de Cadastro | {✅/❌/⚠️} | {obs} |
| 3 | Criar variações de tamanho | Operador de Cadastro | {✅/❌/⚠️} | {obs} |
| 4 | Compor produto com materiais | Operador de Cadastro | {✅/❌/⚠️} | {obs} |
| 5 | Gerar lead fictício | Vendedor | {✅/❌/⚠️} | {obs} |
| 6 | Converter lead em cliente | Vendedor | {✅/❌/⚠️} | {obs} |
| 7 | Gerar orçamento | Orçamentista | {✅/❌/⚠️} | {obs} |
| 8 | Enviar orçamento por link | Orçamentista | {✅/❌/⚠️} | {obs} |
| 9 | Simular aprovação do cliente | Cliente (simulado) | {✅/❌/⚠️} | {obs} |
| 10 | Gerar ordem de serviço/pedido | Vendedor | {✅/❌/⚠️} | {obs} |
| 11 | Executar fluxo de produção | PCP + Operador | {✅/❌/⚠️} | {obs} |
| 12 | Finalizar produção | Operador de Produção | {✅/❌/⚠️} | {obs} |
| 13 | Enviar para financeiro | PCP / Vendedor | {✅/❌/⚠️} | {obs} |
| 14 | Validar emissão de NF-e | Faturamento | {✅/❌/⚠️} | {obs} |
| 15 | Validar emissão de boleto | Financeiro | {✅/❌/⚠️} | {obs} |
| 16 | Liberar para entrega/instalação | Expedição | {✅/❌/⚠️} | {obs} |
| 17 | Validar integração App de Campo | Coord. Instalação | {✅/❌/⚠️} | {obs} |

**Legenda**: ✅ Sucesso | ❌ Falha | ⚠️ Parcial / Com ressalvas

---

## 5. PROBLEMAS IDENTIFICADOS

### 5.1 — Erros CRÍTICOS 🔴

---

**QA-{DATA}-001**

```
Severidade:  🔴 CRÍTICO
Módulo:      {Nome do módulo}
Passo:       {N — Descrição do passo}
Persona:     {Persona ativa}
```

**Descrição**:
> {Descrição clara do problema em 1-3 frases}

**Passos para reproduzir**:
1. {Passo 1}
2. {Passo 2}
3. {Passo 3}

**Resultado esperado**: {O que deveria acontecer}

**Resultado obtido**: {O que aconteceu de fato}

**Causa provável**: {Hipótese técnica — ex: "modelo_materiais com 0 registros"}

**Impacto no negócio**: {Como isso afeta a operação real}

**Evidências**: {Valor retornado / mensagem de erro / screenshot se disponível}

---

*(repetir bloco acima para cada erro CRÍTICO)*

---

### 5.2 — Erros ALTOS 🟠

---

**QA-{DATA}-00N**

```
Severidade:  🟠 ALTO
Módulo:      {Nome do módulo}
Passo:       {N — Descrição do passo}
```

**Descrição**: {Descrição}

**Resultado esperado**: {esperado}

**Resultado obtido**: {obtido}

**Impacto**: {Descrição do impacto}

---

*(repetir para cada erro ALTO)*

---

### 5.3 — Erros MÉDIOS 🟡

| ID | Módulo | Descrição | Resultado Esperado | Resultado Obtido |
|----|--------|-----------|-------------------|-----------------|
| QA-{DATA}-00N | {módulo} | {descrição} | {esperado} | {obtido} |

---

### 5.4 — Melhorias BAIXAS 🟢

| ID | Local | Sugestão |
|----|-------|---------|
| QA-{DATA}-00N | {tela/módulo} | {sugestão de melhoria} |

---

## 6. QUEBRAS DE FLUXO

> Momentos onde o fluxo do negócio não conseguiu avançar de uma etapa para outra.

| De | Para | Problema | Severidade |
|----|------|----------|-----------|
| {Etapa A} | {Etapa B} | {Descrição da quebra} | {CRÍTICO/ALTO} |
| {Etapa A} | {Etapa B} | {Descrição da quebra} | {CRÍTICO/ALTO} |

**Fluxo interrompido em**: Passo {N} — {descrição}
**Motivo**: {motivo}
**Passos não executados por consequência**: {N, N+1, N+2...}

---

## 7. ERROS DE REGRA DE NEGÓCIO

> Situações onde o sistema permite algo que não deveria, ou proíbe algo que deveria funcionar.

| Tipo | Descrição | Impacto |
|------|-----------|---------|
| Permissivo demais | {ex: Permite quantidade 0 no orçamento} | {Impacto} |
| Restritivo demais | {ex: Não permite orçamento sem IE quando cliente é PF} | {Impacto} |
| Cálculo incorreto | {ex: Total ≠ soma dos itens} | {Impacto} |
| Status incoerente | {ex: Pedido "entregue" sem NF-e emitida} | {Impacto} |

---

## 8. PROBLEMAS DE UX

> Situações onde o usuário real teria dificuldade de usar o sistema.

| Tela / Módulo | Problema de UX | Severidade | Sugestão |
|---------------|---------------|------------|---------|
| {tela} | {descrição do problema} | {MÉDIO/BAIXO} | {sugestão} |

**Padrões de UX identificados**:
- [ ] Feedback inexistente após ação (sem toast/loading)
- [ ] Campo obrigatório sem indicação visual
- [ ] Mensagem de erro genérica ("Erro ao salvar")
- [ ] Ação irreversível sem confirmação
- [ ] Tela em branco sem estado vazio explicativo
- [ ] Filtro ou busca que não retorna resultado esperado
- [ ] Fluxo não intuitivo (usuário não sabe o próximo passo)

---

## 9. PROBLEMAS TÉCNICOS

> Erros técnicos identificados (APIs, banco, integração).

| ID | Componente | Tipo | Descrição | Severidade |
|----|-----------|------|-----------|-----------|
| QA-{DATA}-00N | {tabela/API/trigger} | {tipo} | {descrição} | {severidade} |

**Verificações de banco realizadas**:
```sql
-- Exemplo: verificar se modelo_materiais foi populado
SELECT COUNT(*) FROM modelo_materiais;
-- Resultado: {N} registros

-- Verificar triggers instalados
SELECT trigger_name FROM pg_trigger WHERE tgname LIKE '%ordem%';
-- Resultado: {lista}
```

---

## 10. MÓDULOS INCOMPLETOS

> Funcionalidades que existem na UI mas não funcionam completamente no backend.

| Módulo | Funcionalidade | Status UI | Status Backend | Impacto |
|--------|---------------|-----------|---------------|---------|
| {módulo} | {funcionalidade} | {existe} | {não funciona} | {impacto} |

---

## 11. MELHORIAS RECOMENDADAS

> Não são bugs — são oportunidades de melhoria identificadas durante o uso simulado.

### Prioritárias (implementar logo)

1. **{Título}** — {descrição e justificativa de prioridade}
2. **{Título}** — {descrição}

### Desejáveis (implementar quando possível)

1. **{Título}** — {descrição}
2. **{Título}** — {descrição}

---

## 12. PLANO DE CORREÇÃO PRIORITÁRIO

> Ordem sugerida de correção baseada no impacto no negócio.

| Prioridade | ID | Problema | Esforço estimado | Responsável sugerido |
|-----------|-----|----------|-----------------|---------------------|
| 1 | QA-{DATA}-001 | {descrição} | {P/M/G} | {dev/área} |
| 2 | QA-{DATA}-002 | {descrição} | {P/M/G} | {dev/área} |
| 3 | QA-{DATA}-003 | {descrição} | {P/M/G} | {dev/área} |

**Legenda esforço**: P = Pequeno (<2h) | M = Médio (2h-1d) | G = Grande (>1d)

---

## 13. VEREDITO FINAL SOBRE PRONTIDÃO DO ERP

### Status por Módulo

| Módulo | Status | Bloqueadores |
|--------|--------|-------------|
| Cadastro de produtos | {✅ Operacional / ⚠️ Parcial / ❌ Inoperante} | {se houver} |
| CRM / Leads | {status} | {bloqueadores} |
| Orçamentos | {status} | {bloqueadores} |
| Portal de aprovação | {status} | {bloqueadores} |
| Pedidos | {status} | {bloqueadores} |
| Produção | {status} | {bloqueadores} |
| Financeiro | {status} | {bloqueadores} |
| Faturamento (NF-e) | {status} | {bloqueadores} |
| Expedição | {status} | {bloqueadores} |
| Instalação / App Campo | {status} | {bloqueadores} |
| Estoque | {status} | {bloqueadores} |

### Conclusão

```
O ERP da Croma Print está:

[ ] 🔴 INAPTO para uso operacional
    → Erros críticos impedem o fluxo básico de vendas e produção.
    → Recomendação: NÃO colocar em uso real até resolver bloqueadores.

[ ] 🟠 PARCIALMENTE APTO
    → Partes do sistema funcionam, mas há falhas sérias em módulos-chave.
    → Recomendação: Usar com cautela apenas nos módulos estáveis.
       Resolver erros ALTOS antes de expansão de uso.

[ ] 🟡 APTO COM RESSALVAS
    → Fluxo principal funciona. Há problemas que não bloqueiam, mas atrapalham.
    → Recomendação: Pode ser usado pelos times internos com treinamento.
       Programar sprint de correções nas próximas 2 semanas.

[ ] 🟢 APTO PARA PRODUÇÃO
    → Nenhum bloqueador crítico identificado. Sistema representa fielmente
       o fluxo da empresa.
    → Recomendação: Liberar para uso pleno. Monitorar erros médios/baixos.
```

**Assinado por**: AGENTE DE CONTROLE DE QUALIDADE CROMA_ERP
**Data**: {YYYY-MM-DD HH:MM}
**Próxima execução recomendada**: {após próximo deploy / em {N} dias}

---

*Este relatório foi gerado automaticamente pelo Agente QA Operacional da Croma Print.*
*Para re-executar o agente: invocar AGENTE.md com o cenário desejado.*
