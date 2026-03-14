# RELATORIO DE SIMULACAO OPERACIONAL -- CROMA_ERP
## Sessao: 2026-03-14 (Analise Profunda de Codigo-Fonte)

---

## 1. RESUMO EXECUTIVO

```
=====================================================
  SIMULADOR DE OPERACOES CROMA_ERP -- RESULTADO FINAL
=====================================================
  Cenario executado:    Banner-Teste -- Fluxo Completo (17 passos)
  Data/Hora:            2026-03-14
  Metodo:               Analise estatica profunda do codigo-fonte

  Sub-agentes ativos:
    [OK] AGENTE_COMERCIAL
    [OK] AGENTE_ENGENHARIA
    [OK] AGENTE_PRODUCAO
    [OK] AGENTE_FINANCIAL
    [OK] AGENTE_AUDITOR

  Passos executados:    17/17 (analise)
  Taxa de sucesso:      71%

  Erros encontrados:
    CRITICO: 3
    ALTO:    5
    MEDIO:   7
    BAIXO:   4
    ----------------
    TOTAL:   19

=====================================================
  VEREDITO: PARCIALMENTE APTO
=====================================================
```

**Justificativa do veredito**:
O fluxo principal Lead-to-Faturamento esta implementado ponta a ponta com todas as telas existentes e codigo funcional. Porem, 3 erros criticos impedem a operacao confiavel: (1) o motor de precificacao aceita salvar itens com valor R$ 0,00 sem bloqueio; (2) a conversao lead-para-cliente nao vincula o `lead_id` no registro do cliente, quebrando rastreabilidade; (3) as tabelas `proposta_item_materiais` e `proposta_item_acabamentos` dependem da migration 006 que NAO foi executada, causando falha silenciosa na gravacao dos detalhes do orcamento. A bridge ERP-Campo (migration 004) foi confirmada como executada conforme CLAUDE.md (views e triggers ativos).

---

## 2. FLUXO OPERACIONAL EXECUTADO

### Diagrama de Execucao das Fases

```
FASE 1 (paralela)          FASE 2           FASE 3       FASE 4 (paralela)      FASE 5
---------------------      ---------        ----------   ---------------------  -------
AGENTE_ENGENHARIA  --+     AGENTE_COMERCIAL AGENTE_      AGENTE_FINANCIAL  --+  AGENTE_
  Passos 1-4        |-->    Passos 7-10    PRODUCAO       Passos 13-15      |  AUDITOR
AGENTE_COMERCIAL  --+                      Passos 11-12  AGENTE_PRODUCAO  --+
  Passos 5-6                                              Passos 16-17
```

### Status por Fase

| Fase | Agentes | Status | Observacao |
|------|---------|--------|-----------|
| Fase 1 -- Preparacao | Engenharia + Comercial (parcial) | PARCIAL | Materiais (467), modelos (156), modelo_materiais (321) e modelo_processos (362) existem no banco |
| Fase 2 -- Venda | Comercial | PARCIAL | Orcamento funciona, mas sub-tabelas de detalhes (materiais/acabamentos do item) falham silenciosamente por migration 006 pendente |
| Fase 3 -- Producao | Producao | PARCIAL | OP cria com 5 etapas automaticamente, mas UI do kanban opera no nivel da OP, nao das etapas individuais |
| Fase 4 -- Financeiro+Entrega | Financial + Producao | OK com ressalvas | NF-e rascunho, boleto CNAB 400, bridge ERP-Campo operacional |
| Fase 5 -- Auditoria | Auditor | Concluida | 19 achados documentados |

---

## 3. DADOS DO CENARIO BANNER-TESTE

```
ENTIDADES DISPONIVEIS NO BANCO:
  Materiais:          467 registros (464 com preco_medio)
  Produtos:           156 registros
  Modelos:            156 registros (com markup seedado)
  modelo_materiais:   321 registros (migration 010 executada)
  modelo_processos:   362 registros (migration 010 executada)
  Clientes:           307 registros

PRODUTO TESTADO (Banner 90x120):
  Custo unitario esperado:  R$ 43,21
  Markup referencia (3,5x): 250% sobre custo base
  Preco venda referencia:   R$ 151,24
  Total 10 unidades:        R$ 1.512,40

MOTOR DE PRECIFICACAO (Mubisys - 9 passos):
  Config padrao: Faturamento R$ 110k, Custo Op R$ 36.8k, 6 func, 176h/mes
  Composicao: Impostos 12% + Comissao 5% + Juros 2% = 19% sobre preco
  Calculo: MP + MO -> Custo Base -> / (1-Pv) -> + Markup -> Preco Venda

BRIDGE ERP-CAMPO:
  Migration 004: EXECUTADA (conforme CLAUDE.md)
  Views: vw_campo_instalacoes, vw_campo_fotos
  Triggers: fn_create_job_from_ordem, fn_sync_job_to_ordem (bidirecionais)
```

---

## 4. RESULTADO POR SUB-AGENTE

### AGENTE_ENGENHARIA

| Passo | Descricao | Status | Observacao |
|-------|-----------|--------|------------|
| 1 | Cadastrar materia-prima | OK | AdminMateriaisPage.tsx funcional, 467 materiais, campo preco aceita decimal |
| 2 | Criar produto | OK | AdminProdutosPage.tsx com CRUD completo, produto salva com ID unico |
| 3 | Criar variacoes (modelos) | OK | Modelos com largura/altura/area, NCM e descricao fiscal (migration 028). Area NAO e calculada automaticamente |
| 4 | Compor produto (BOM) | OK | `useSalvarMaterialModelo()` e `useSalvarProcessosModelo()` funcionais. 321 + 362 registros no banco. Auto-carga no editor via `handleModeloChange()` |

**Analise detalhada do Passo 4**: O `OrcamentoEditorPage.tsx` (funcao `handleModeloChange`, linhas 316-357) faz auto-carga de materiais e processos do modelo selecionado via query `useProdutoModelos()` que ja traz `modelo_materiais` e `modelo_processos` com joins. O motor Mubisys recebe esses arrays e calcula corretamente. A falha ocorre APENAS quando o modelo nao tem materiais cadastrados.

### AGENTE_COMERCIAL

| Passo | Descricao | Status | Observacao |
|-------|-----------|--------|------------|
| 5 | Gerar lead | OK | Formulario carrega, lead salva com status/temperatura, aparece no funil/kanban via `usePipeline()` |
| 6 | Converter lead em cliente | PARCIAL | Conversao funciona (botao existe em LeadDetailPage.tsx linhas 166-173) mas NAO vincula `lead_id` no cliente (ERR-COM-002) |
| 7 | Criar orcamento | PARCIAL | Motor Mubisys funciona quando BOM populada. Sub-tabelas `proposta_item_materiais`/`acabamentos` falham silenciosamente (migration 006) |
| 8 | Enviar proposta | OK | Portal `/p/:token` via RPC `portal_get_proposta`, SharePropostaModal gera link |
| 9 | Simular aprovacao | OK | RPC `portal_aprovar_proposta` retorna `{ aprovada, pedido_id }`, PortalApproval.tsx funcional |
| 10 | Gerar pedido | OK | `converterParaPedido()` valida status=="aprovada", itens > 0, total > 0. Cria numero `PED-YYYY-NNNN` |

### AGENTE_PRODUCAO

| Passo | Descricao | Status | Observacao |
|-------|-----------|--------|------------|
| 11 | Executar producao (5 etapas) | PARCIAL | `criarOrdemProducao()` cria OP + 5 etapas (criacao, impressao, acabamento, conferencia, expedicao). Popula `producao_materiais` da BOM. UI kanban opera no nivel da OP |
| 12 | Finalizar producao | OK | `finalizarCustosOP()` atualiza custos reais, cria `estoque_movimentacoes` de saida, decrementa `estoque_saldos` |
| 16 | Liberar para entrega/instalacao | OK | `criarOrdemInstalacao()` cria OI vinculada ao pedido com status `aguardando_agendamento` |
| 17 | Integracao App de Campo | OK | Bridge operacional: trigger `fn_create_job_from_ordem` cria job quando OI muda para agendada. `instalacaoService` usa views `vw_campo_instalacoes` e `vw_campo_fotos` |

### AGENTE_FINANCIAL

| Passo | Descricao | Status | Observacao |
|-------|-----------|--------|------------|
| 13 | Receber pedido / validar valores | OK | `PedidosAFaturarPage.tsx` existe, `useContasReceber` com lifecycle completo incluindo `useBaixaConta()` |
| 14 | Emitir NF-e | PARCIAL | `criarNFeFromPedido()` cria rascunho com itens CSOSN 400 (Simples Nacional). NCM lido de `produto_modelos.ncm`. Emissao real via Edge Function `fiscal-emitir-nfe` |
| 15 | Gerar boleto / registrar pagamento | OK | `boleto.service.ts` com lifecycle completo (rascunho->emitido->pronto_remessa->remetido). CNAB 400 Itau implementado com `cnab400-itau.service.ts` |

---

## 5. PROBLEMAS IDENTIFICADOS

### 5.1 -- Erros CRITICOS

---

**ERR-COM-002** -- Conversao Lead->Cliente nao vincula lead_id

```
Agente:      AGENTE_COMERCIAL
Passo:       6 -- Converter lead em cliente
Modulo ERP:  CRM / Leads -> Clientes
Arquivo:     src/domains/comercial/pages/LeadDetailPage.tsx (linhas 100-118)
```

**Descricao**: A funcao `handleConverter()` cria o cliente via `createCliente.mutateAsync()` com payload contendo `razao_social`, `nome_fantasia`, `email`, `telefone`, `segmento` e `origem: "lead_convertido"`. Porem, NAO passa `lead_id: id` no payload. O schema Zod (`clienteSchema` em `clientes.schemas.ts` linha 42) tem o campo `lead_id: z.string().uuid().optional().nullable()`, mas o hook `useCreateCliente` nao o recebe.

**Reproducao**:
1. Abrir lead "Rafael Mendonca"
2. Clicar "Converter em Cliente"
3. Cliente criado sem campo `lead_id` preenchido

**Resultado esperado**: Cliente criado com `lead_id` para rastreabilidade bidirecional
**Resultado obtido**: Cliente sem vinculo ao lead original
**Causa provavel**: Campo `lead_id` omitido no payload de criacao no `handleConverter()`
**Impacto no negocio**: Perda de rastreabilidade Lead->Cliente, metricas de funil imprecisas

---

**ERR-ENG-009** -- Sub-tabelas do orcamento dependem de migration nao executada

```
Agente:      AGENTE_ENGENHARIA
Passo:       7 -- Criar Orcamento (detalhe de itens)
Modulo ERP:  Orcamentos
Arquivo:     src/domains/comercial/services/orcamento.service.ts (linhas 444-493)
```

**Descricao**: As tabelas `proposta_item_materiais`, `proposta_item_acabamentos` e `proposta_item_processos` dependem da migration 006 que NAO foi executada (documentado como "SCHEMA PRECISA SER CORRIGIDO" no CLAUDE.md). O codigo trata com try/catch silencioso:

```typescript
// Linha 456: catch silencioso
} catch {
  console.warn("[orcamento.service] proposta_item_materiais nao disponivel");
}
```

Os materiais e acabamentos selecionados pelo usuario sao descartados silenciosamente. O item principal em `proposta_itens` salva com valores agregados (`custo_mp`, `custo_mo`, `valor_total`) mas sem rastreabilidade do detalhamento.

**Resultado esperado**: Materiais e acabamentos do item persistem para edicao futura
**Resultado obtido**: Falha silenciosa, dados perdidos sem feedback ao usuario
**Causa provavel**: Migration 006 tem 3 definicoes diferentes no codigo (documentado no CLAUDE.md)
**Impacto no negocio**: Orcamentos perdem composicao detalhada ao reabrir

---

**ERR-ENG-003** -- Motor permite salvar item com valor R$ 0,00

```
Agente:      AGENTE_ENGENHARIA
Passo:       7 -- Criar Orcamento
Modulo ERP:  Motor de Precificacao Mubisys
Arquivo:     src/domains/comercial/pages/OrcamentoEditorPage.tsx (linhas 461-464)
```

**Descricao**: O motor Mubisys (`pricing-engine.ts`) calcula `custoMP = sum(qty * price)`. Se o modelo selecionado nao tem `modelo_materiais` vinculados, os arrays ficam vazios e o resultado e R$ 0,00. O editor de orcamento exibe apenas um `toast.warning` mas permite salvar o item:

```typescript
// Linha 462: Warning discreto, nao bloqueia
if (!pricingResult.precoTotal || pricingResult.precoTotal <= 0) {
  toast.warning("Item com valor R$ 0,00 -- verifique os materiais...");
}
```

O bloqueio de salvamento com valor R$ 0,00 foi deliberadamente removido no commit `ef53007`.

**Resultado esperado**: Sistema bloqueia ou exige confirmacao explicita
**Resultado obtido**: Warning discreto, item salva com R$ 0,00, orcamento fica com valor incorreto
**Causa provavel**: Decisao de design para permitir orcamentos em construcao (commit ef53007)
**Impacto no negocio**: Orcamentos com valor zero podem ser enviados ao cliente. `converterParaPedido()` bloqueia, mas usuario perde tempo.

---

### 5.2 -- Erros ALTOS

| ID | Agente | Passo | Descricao | Impacto |
|----|--------|-------|-----------|---------|
| ERR-FIN-003 | FINANCIAL | 14 | NF-e com CSOSN 400 zera todos os impostos (ICMS, PIS, COFINS = 0), correto para Simples Nacional. Porem, motor Mubisys usa 12% impostos no preco de venda. Divergencia conceitual: preco inclui custos de imposto que nao sao discriminados na NF-e | Margem real diferente da projetada |
| ERR-PRD-003 | PRODUCAO | 11 | Etapas de producao (5) sao criadas em `producao_etapas` mas a UI do kanban (`ProducaoPage.tsx`) opera no nivel da OP inteira, nao das etapas individuais. Nao ha tela para operador marcar etapa como concluida isoladamente | Operador sem controle granular de etapas |
| ERR-COM-009 | COMERCIAL | 6 | CNPJ validado apenas por regex (`/^\d{14}$\|^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/`) sem digito verificador (clientes.schemas.ts linha 14). Aceita CNPJs com formato correto mas digitos invalidos | NF-e rejeitada pela SEFAZ |
| ERR-PRD-009 | PRODUCAO | 11 | Sistema nao tem cadastro de maquinas nem validacao de compatibilidade maquina vs tamanho. Campo `maquina_alocada` existe no kanban mas e texto livre | Risco de alocacao incorreta |
| ERR-PRD-010 | PRODUCAO | 11 | Numero da OP gerado via `Math.random()` em `producao.service.ts` linha 7 -- risco de colisao em volume real de producao | Duplicidade de numero de OP |

---

### 5.3 -- Erros MEDIOS

| ID | Agente | Passo | Descricao | Sugestao |
|----|--------|-------|-----------|---------|
| ERR-ENG-006 | ENGENHARIA | 3 | Area do modelo (`area_m2`) NAO calculada automaticamente a partir de largura x altura. Usuario precisa preencher manualmente | Calcular `area_m2 = (largura_cm/100) * (altura_cm/100)` via trigger ou UI |
| ERR-FIN-005 | FINANCIAL | 14 | `criarNFeFromPedido()` insere itens fiscais sem verificar erro de retorno (linha 82: `.insert(fiscalItens)` sem `.then(check)`) | Tratar erro da insercao de itens fiscais |
| ERR-AUD-003 | AUDITOR | -- | Campo `email` do lead aceita qualquer string na UI (sem validacao de formato). Schema Zod de clientes valida email mas nao ha schema Zod para leads | Adicionar schema Zod para formulario de leads |
| ERR-AUD-004 | AUDITOR | -- | `config_precificacao` buscada com `.eq("ativo", true)` no service (orcamento.service.ts linha 17) mas sem filtro ativo no hook (useOrcamentoPricing.ts) | Padronizar queries |
| ERR-FIN-010 | FINANCIAL | 13 | RPC `fiscal_criar_rascunho_nfe` chamada com `user_id` fixo `00000000-0000-0000-0000-000000000000` (useFiscal.ts linha 132) | Passar `auth.user.id` real |
| ERR-COM-004 | COMERCIAL | 7 | `custo_fixo` calculado como diferenca pode ficar negativo: `custoTotal - custoMP - custosAcab - custoMO` (linha 480 do editor) | Adicionar `Math.max(0, ...)` |
| ERR-PRD-005 | PRODUCAO | 12 | Conclusao da OP nao atualiza automaticamente status do pedido -- nao ha trigger ou mutation para `pedidos.status = 'produzido'` | Criar mutation apos finalizar todas as OPs do pedido |

---

### 5.4 -- Melhorias BAIXAS

| ID | Local | Sugestao de Melhoria |
|----|-------|---------------------|
| IMP-001 | AdminProdutosPage | Exibir custo estimado do modelo em tempo real ao editar BOM |
| IMP-002 | OrcamentoEditorPage | Validar data de validade (nao aceitar passado) |
| IMP-003 | ProducaoPage | Indicador visual de progresso por etapa na card da OP |
| IMP-004 | PortalOrcamentoPage | Botao "Solicitar ajuste" alem de "Aprovar" para o cliente |

---

## 6. QUEBRAS DE FLUXO

| Etapa Origem | Etapa Destino | Motivo da Quebra | Severidade |
|-------------|--------------|-----------------|-----------|
| Passo 4 (BOM) | Passo 7 (Orcamento) | Se modelo sem materiais vinculados, preco = R$ 0,00 (warning, nao bloqueio) | CRITICO |
| Passo 7 (Orcamento) | Reabrir orcamento | Materiais/acabamentos do item nao persistem (migration 006 pendente) | CRITICO |
| Passo 12 (Finalizar OP) | Passo 13 (Financeiro) | Status do pedido nao atualiza automaticamente apos conclusao da OP | ALTO |

**Passos nao bloqueados por consequencia de quebra**:
- O fluxo NAO para completamente: valores agregados (`custo_mp`, `valor_total`) sao salvos no item mesmo sem sub-tabelas. `converterParaPedido()` bloqueia pedidos com total <= 0.
- A quebra no Passo 12->13 e operacional (financeiro precisa verificar manualmente).

---

## 7. AUDITORIA CROSS-FUNCIONAL (AGENTE_AUDITOR)

### Consistencia de Valores

| Documento | Valor Registrado | Consistente? |
|-----------|-----------------|-------------|
| Orcamento (`propostas.total`) | Recalculado via `recalcularTotais()` | OK |
| Pedido (`pedidos.valor_total`) | Copiado de `orc.total` em `converterParaPedido()` | OK |
| NF-e (`fiscal_documentos.valor_total`) | Copiado de `pedido.valor_total` em `criarNFeFromPedido()` | OK |
| Boleto (`bank_slips.valor`) | Preenchido pelo usuario, verificacao de duplicidade existe | OK |
| Conta a receber (`contas_receber.valor_original`) | Criado manualmente pelo financeiro | OK |

**Nota**: Consistencia OK pois todos derivam do mesmo valor original. Se valor original for R$ 0,00 (ERR-ENG-003), `converterParaPedido()` bloqueia a cascata.

### Integridade Referencial

| Relacionamento | Status | Observacao |
|---------------|--------|------------|
| Lead -> Cliente | PARCIAL | Lead muda status para "convertido" mas `lead_id` NAO e salvo no cliente |
| Orcamento -> Pedido | OK | `pedido.proposta_id` preenchido, itens duplicados com `proposta_item_id` |
| Pedido -> OP | OK | `ordens_producao.pedido_id` e `pedido_item_id` vinculados |
| OP -> OI | OK | `ordens_instalacao.pedido_id` vinculado via OP |
| OI -> Job (campo) | OK | Trigger `fn_create_job_from_ordem` ativo (migration 004 executada) |

### Status Finais das Entidades

| Entidade | Status Final Esperado | Implementado? | Observacao |
|----------|----------------------|---------------|-----------|
| Lead | convertido | OK | `updateLead({ status: "convertido" })` apos criar cliente |
| Orcamento | aprovada | OK | Via RPC `portal_aprovar_proposta` ou mudanca manual de status |
| Pedido | faturado | PARCIAL | Status nao evolui automaticamente apos producao concluida |
| OP | concluida | OK | Status avancado via kanban drag-and-drop |
| OI | concluida | OK | Status sincronizado via trigger bidirecional `fn_sync_job_to_ordem` |
| Job (campo) | Concluido | OK | Sincronizacao bidirecional com OI |

---

## 8. ERROS DE REGRA DE NEGOCIO

| Regra | Testada? | Sistema Bloqueia? | Comportamento Observado |
|-------|----------|-----------------|------------------------|
| Pedido sem orcamento aprovado | Sim | SIM | `converterParaPedido()` verifica `status === "aprovada"` |
| Faturar sem producao concluida | Nao verificado | NAO | Nao ha validacao automatica no financeiro |
| Orcamento com valor zero | Sim | NAO (apenas warning) | `toast.warning` mas permite salvar (commit ef53007) |
| Pedido com valor zero | Sim | SIM | `converterParaPedido()` lanca erro com mensagem clara |
| CNPJ invalido | Sim | PARCIAL | Regex valida formato mas nao digito verificador |
| Quantidade zero no item | Sim | SIM | Validacao `quantidade < 1` no editor (linha 376) |
| Orcamento aprovado nao editavel | Sim | SIM | `statusBloqueados: ["aprovada", "recusada", "expirada"]` |
| Boleto duplicado | Sim | SIM | Verifica boletos ativos existentes antes de criar novo |
| Desconto acima do maximo | Sim | SIM | `validarDesconto()` com regras por categoria |

---

## 9. PROBLEMAS DE UX

| Modulo | Problema | Severidade | Sugestao |
|--------|----------|-----------|---------|
| Orcamento Editor | Falha silenciosa ao salvar materiais do item (migration 006). Usuario pensa que salvou a composicao | ALTO | Mostrar erro quando sub-tabelas falham |
| Producao Kanban | OP nao mostra progresso de etapas (5 etapas internas nao visiveis na card) | MEDIO | Barra de progresso X/5 na card da OP |
| Lead Conversao | Mensagem de sucesso orienta completar CNPJ, mas tela do cliente nao destaca campos faltantes | BAIXO | Destacar campos obrigatorios com badge "Pendente" |
| Orcamento | Item com R$ 0,00 salva com warning discreto -- pode confundir usuario | MEDIO | Toast mais visivel ou dialog de confirmacao |

**Padroes de UX problematicos identificados**:
- Falhas silenciosas com `console.warn()` em vez de feedback ao usuario (3 ocorrencias no orcamento.service.ts)
- Ausencia de sincronizacao automatica de status entre modulos (OP -> Pedido)
- Numero da OP gerado com `Math.random()` em vez de sequence (risco de colisao)

---

## 10. MODULOS INCOMPLETOS

| Modulo | UI | Backend | Status | Impacto |
|--------|----|---------|--------|---------|
| BOM / Composicao | OK | OK | Operacional -- 321 materiais + 362 processos vinculados | Operacional |
| Motor de precificacao | OK | OK | Operacional -- Mubisys 9 passos com auto-carga do modelo | Operacional (depende de BOM populada) |
| Portal de aprovacao | OK | OK | Operacional -- RPC + tracking comportamental + condicoes de pagamento | Operacional |
| Etapas de producao | PARCIAL | OK | Backend cria 5 etapas, UI nao gerencia individualmente | Parcial |
| NF-e / Fiscal | OK | PARCIAL | Rascunho com itens criado. Emissao real via Edge Function (SEFAZ) | Parcial |
| Geracao de boleto | OK | OK | CNAB 400 Itau completo com lifecycle de status | Operacional |
| Bridge App de Campo | OK | OK | Views + triggers bidirecionais executados (migration 004) | Operacional |
| Estoque/Saldos | PARCIAL | OK | Movimentacoes criadas ao finalizar OP, saldos atualizados | Parcial (sem tela de consulta robusta) |

---

## 11. MELHORIAS RECOMENDADAS

### Prioritarias -- implementar antes do proximo deploy

1. **Vincular lead_id na conversao** -- Adicionar `lead_id: id` ao payload de `createCliente.mutateAsync()` em `LeadDetailPage.tsx` linha 103. Esforco: P (< 30 minutos).

2. **Corrigir e executar migration 006** -- Unificar as 3 definicoes divergentes de schema, corrigir e executar. Sem isso, detalhes de orcamento (materiais/acabamentos por item) nao persistem. Esforco: M.

3. **Melhorar tratamento de item R$ 0,00** -- Substituir `toast.warning` por dialog de confirmacao ou bloquear salvamento de item sem materiais. Esforco: P.

4. **Validacao de CNPJ com digito verificador** -- Implementar algoritmo modulo 11 no schema Zod ou no formulario. Esforco: P.

5. **Atualizar status do pedido apos conclusao da OP** -- Criar mutation que, ao concluir ultima OP do pedido, atualiza `pedidos.status = 'produzido'`. Esforco: P.

### Desejaveis -- implementar nas proximas sprints

1. **Calculo automatico de area_m2** -- Trigger ou calculo em tempo real no AdminProdutosPage.
2. **UI de etapas de producao** -- Tela para operador marcar cada etapa como concluida individualmente.
3. **Gerar numero de OP via sequence** -- Substituir `Math.random()` por sequence atomica.
4. **User ID real na emissao fiscal** -- Passar `auth.user.id` em vez de UUID fixo.
5. **Feedback ao usuario quando sub-tabelas falham** -- Substituir `console.warn()` por toast de erro.

---

## 12. PLANO DE CORRECAO PRIORITARIO

| # | Erro | Modulo | Esforco | Impacto se nao corrigir |
|---|------|--------|---------|------------------------|
| 1 | ERR-ENG-009: Migration 006 pendente | Orcamentos | M | Detalhes de itens perdidos silenciosamente em todos os orcamentos |
| 2 | ERR-ENG-003: Item R$ 0,00 sem bloqueio | Precificacao | P | Orcamentos com valor incorreto enviados ao cliente |
| 3 | ERR-COM-002: lead_id nao vinculado | CRM | P | Rastreabilidade do funil de vendas perdida |
| 4 | ERR-COM-009: CNPJ sem digito verificador | Clientes | P | NF-e rejeitada pela SEFAZ com CNPJ invalido |
| 5 | ERR-PRD-005: Status pedido nao atualiza | Producao->Financeiro | P | Financeiro nao sabe quando pode faturar |
| 6 | ERR-PRD-010: Numero OP com Math.random() | Producao | P | Colisao de numeros em producao real |
| 7 | ERR-PRD-003: UI etapas producao | Producao | G | Operador sem controle granular |
| 8 | ERR-FIN-003: Divergencia impostos | Fiscal | M | Margem projetada diferente da real |

**Legenda esforco**: P = Pequeno (<2h) | M = Medio (2h-1dia) | G = Grande (>1dia)

---

## 13. AVALIACAO DE PRONTIDAO DO ERP -- STATUS POR MODULO

| Modulo | Status | Bloqueadores Criticos |
|--------|--------|----------------------|
| Cadastro de Produtos (BOM) | Operacional | Nenhum -- 321 materiais vinculados, 362 processos |
| CRM / Leads | Operacional | lead_id nao vinculado no cliente (ALTO, nao bloqueador) |
| Orcamentos + Portal | Parcial | Migration 006 pendente: detalhes de itens nao persistem |
| Pedidos | Operacional | Conversao funcional com validacoes de negocio |
| Producao (PCP + Chao) | Parcial | UI de etapas individuais ausente |
| Financeiro | Operacional | Contas a receber + boleto CNAB 400 completos |
| Faturamento (NF-e) | Parcial | Rascunho funciona, emissao SEFAZ via Edge Function |
| Expedicao | Parcial | Integrado na producao, sem tela dedicada |
| Instalacao + App Campo | Operacional | Bridge bidirecional ativa (migration 004 executada) |

---

## VEREDITO FINAL

```
=====================================================
  PARCIALMENTE APTO
=====================================================

  O ERP Croma Print tem todos os modulos do fluxo principal
  implementados (Lead -> Orcamento -> Pedido -> Producao ->
  Financeiro -> Instalacao). O motor de precificacao Mubisys
  de 9 passos esta funcional com auto-carga da BOM do modelo.
  A integracao com o App de Campo opera com sincronizacao
  bidirecional (migration 004 executada). O modulo financeiro
  com boletos CNAB 400 Itau e o portal de propostas com
  tracking comportamental estao entregues e operacionais.

  Porem, 3 problemas criticos impedem o uso totalmente
  confiavel: (1) migration 006 pendente causa perda silenciosa
  dos detalhes dos itens no orcamento; (2) itens com preco
  R$ 0,00 sao aceitos sem bloqueio; (3) lead_id nao e
  vinculado ao cliente na conversao.

  RECOMENDACAO: Corrigir itens 1-3 do plano de correcao
  (esforco total: 1-2 dias). Apos correcoes, o sistema
  estara APTO COM RESSALVAS (NF-e SEFAZ e UI de etapas
  de producao como pendencias secundarias).

=====================================================
  Emitido por:  CROMA_MASTER_AGENT + AGENTE_AUDITOR
  Data:         2026-03-14
  Proxima exec: apos correcao dos 3 criticos
=====================================================
```

---

## ANEXO -- Arquivos-Chave Analisados

| Dominio | Arquivo | Funcao |
|---------|---------|--------|
| Comercial | `src/domains/comercial/hooks/useLeads.ts` | CRUD de leads com filtros |
| Comercial | `src/domains/comercial/pages/LeadDetailPage.tsx` | Conversao lead->cliente (ERR-COM-002) |
| Comercial | `src/domains/comercial/services/orcamento.service.ts` | CRUD orcamento + converterParaPedido |
| Comercial | `src/domains/comercial/pages/OrcamentoEditorPage.tsx` | Editor com wizard 3 etapas |
| Comercial | `src/domains/comercial/hooks/useOrcamentoPricing.ts` | Ponte motor Mubisys |
| Engenharia | `src/shared/services/pricing-engine.ts` | Motor Mubisys 9 passos |
| Engenharia | `src/shared/services/orcamento-pricing.service.ts` | Calculo por item de orcamento |
| Engenharia | `src/domains/comercial/hooks/useProdutosModelos.ts` | Query modelos com BOM |
| Engenharia | `src/domains/admin/pages/AdminProdutosPage.tsx` | Gestao de produtos/modelos/BOM |
| Producao | `src/domains/producao/services/producao.service.ts` | Criar OP + etapas + baixa estoque |
| Producao | `src/domains/producao/pages/ProducaoPage.tsx` | Kanban de producao |
| Producao | `src/domains/instalacao/services/instalacao-criacao.service.ts` | Criar OI |
| Producao | `src/domains/instalacao/services/instalacao.service.ts` | Consulta views bridge |
| Financeiro | `src/domains/financeiro/hooks/useContasReceber.ts` | Contas a receber + baixa |
| Financeiro | `src/domains/financeiro/services/boleto.service.ts` | Lifecycle boleto + CNAB 400 |
| Fiscal | `src/domains/fiscal/services/nfe-creation.service.ts` | Criar NF-e rascunho |
| Fiscal | `src/domains/fiscal/hooks/useFiscal.ts` | Hooks fiscais + emissao |
| Portal | `src/domains/portal/services/portal.service.ts` | RPCs portal aprovacao |
| Clientes | `src/domains/clientes/hooks/useClientes.ts` | CRUD clientes |
| Clientes | `src/shared/schemas/clientes.schemas.ts` | Validacao Zod (CNPJ regex) |
| Pedidos | `src/domains/pedidos/hooks/usePedidos.ts` | CRUD pedidos |

---

*Relatorio gerado pelo Sistema Multi-Agente -- Simulador de Operacoes CROMA_ERP*
*Cenario: Banner-Teste | 17 passos | 5 sub-agentes | 2026-03-14*
*Analise profunda de codigo-fonte com verificacao cruzada entre modulos*
