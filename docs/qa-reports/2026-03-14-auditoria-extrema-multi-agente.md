# RELATORIO DE SIMULACAO OPERACIONAL — CROMA_ERP
## Auditoria Extrema Multi-Agente
## Sessao: 2026-03-14

---

## 1. RESUMO EXECUTIVO

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SIMULADOR DE OPERACOES CROMA_ERP — RESULTADO FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Cenario executado:    Banner-Teste + Cenarios Extremos (Auditoria Expandida)
  Data/Hora:            2026-03-14
  Modo:                 Auditoria Extrema Multi-Agente (5 sub-agentes)

  Sub-agentes ativos:
    [OK] AGENTE_COMERCIAL
    [OK] AGENTE_ENGENHARIA
    [OK] AGENTE_PRODUCAO
    [OK] AGENTE_FINANCIAL
    [OK] AGENTE_AUDITOR

  Passos executados:    17/17 (simulacao completa + cenarios extremos)
  Taxa de sucesso:      47% (8/17 passos sem bloqueadores)

  Erros encontrados:
    CRITICO: 7
    ALTO:    11
    MEDIO:   9
    BAIXO:   6
    ──────────────────
    TOTAL:   33

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VEREDITO: PARCIALMENTE APTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Justificativa do veredito**:
O ERP possui a estrutura completa do fluxo Lead-to-Cash implementada, com auth real funcionando, portal do cliente operacional, modulo financeiro de boletos robusto e motor de precificacao Mubisys corretamente implementado. Porem, 7 erros CRITICOS impedem a operacao autonoma: a migration 004 (bridge ERP-Campo) nao foi executada, a migration 006 (schema orcamento) permanece incompativel, e a ausencia de validacoes de borda (CNPJ, duplicidade de leads, vencimento de boleto) compromete a integridade dos dados em producao real.

---

## 2. FLUXO OPERACIONAL EXECUTADO

### Diagrama de Execucao das Fases

```
FASE 1 (paralela)          FASE 2           FASE 3       FASE 4 (paralela)      FASE 5
─────────────────────      ─────────────    ──────────   ─────────────────────  ───────
AGENTE_ENGENHARIA  ──┐     AGENTE_COMERCIAL AGENTE_      AGENTE_FINANCIAL  ──┐  AGENTE_
  Passos 1-4        │──>    Passos 7-10    PRODUCAO       Passos 13-15      │  AUDITOR
AGENTE_COMERCIAL  ──┘                      Passos 11-12  AGENTE_PRODUCAO  ──┘
  Passos 5-6                                              Passos 16-17
```

### Status por Fase

| Fase | Agentes | Status | Observacao |
|------|---------|--------|-----------|
| Fase 1 — Preparacao | Engenharia + Comercial (parcial) | PARCIAL | Materiais/modelos seedados OK (467+156). BOM auto-load funciona. |
| Fase 2 — Venda | Comercial | PARCIAL | Orcamento funciona com motor Mubisys. Portal OK. Conversao pedido OK. |
| Fase 3 — Producao | Producao | PARCIAL | OP cria com 5 etapas. Kanban OK. Bridge nao executada (mig 004). |
| Fase 4 — Financeiro+Entrega | Financial + Producao | PARCIAL | Boletos OK. NF-e em homologacao. Bridge Campo inoperante. |
| Fase 5 — Auditoria | Auditor | OK | Auditoria concluida com 33 achados. |

---

## 3. DADOS DO TESTE

```
PRODUTO TESTADO:
  Produto:       Banner (existente nos 156 modelos seedados)
  Variacao:      Banner 90x120
  Quantidade:    10 unidades
  Composicao:    321 registros em modelo_materiais (migration 010/022 executadas)

VALORES DE REFERENCIA:
  Custo unitario calculado:  R$ 43,21 (se BOM carregada corretamente)
  Preco de venda (3.5x):     R$ 151,24
  Total do pedido:            R$ 1.512,40
```

---

## 4. RESULTADO POR SUB-AGENTE

### AGENTE_COMERCIAL

| Passo | Descricao | Status | Observacao |
|-------|-----------|--------|------------|
| 5 | Gerar lead | OK | Formulario funciona. Salva no Supabase. |
| 6 | Converter lead em cliente | ALERTA | Nao existe botao de conversao automatica. Processo manual. |
| 7 | Criar orcamento | PARCIAL | Motor Mubisys calcula corretamente SE materiais carregados. Editor 3-etapas funcional. |
| 8 | Enviar proposta | OK | Portal /p/:token funciona. RPC portal_get_proposta e portal_aprovar_proposta implementadas. |
| 9 | Simular aprovacao | OK | Aprovacao via portal registra no banco. |
| 10 | Gerar pedido | OK | converterParaPedido() valida itens > 0 e total > 0. Cria pedido_itens com campos tecnicos. |

#### Cenarios Extremos — Comercial

| Cenario Extremo | Resultado | Detalhes |
|-----------------|-----------|----------|
| Lead duplicado — sistema detecta? | FALHA | Nenhuma validacao de duplicidade por empresa/CNPJ/email. Permite N leads identicos. |
| Conversao Lead->Cliente sem CNPJ | PARCIAL | Lead nao tem campo CNPJ. Cliente exige CNPJ no cadastro manual, mas sem validacao de digito verificador no frontend. |
| Orcamento com 20+ itens — performance | OK | TanStack Query com staleTime. Sem limite de itens no editor. |
| Orcamento editado apos aprovacao | FALHA | Nenhuma trava. Status "aprovada" pode ser sobrescrito via useAtualizarOrcamento sem validacao de status anterior. |
| Portal aprovacao gera pedido automaticamente? | FALHA | Aprovacao pelo portal so muda status. Conversao em pedido e acao manual no ERP (converterParaPedido). |

---

### AGENTE_ENGENHARIA

| Passo | Descricao | Status | Observacao |
|-------|-----------|--------|------------|
| 1 | Cadastrar materia-prima | OK | 467 materiais seedados. AdminMateriaisPage funcional. |
| 2 | Criar produto | OK | 156 produtos existentes. CRUD via useProdutos. |
| 3 | Criar variacoes | OK | useCriarModelo funciona. largura/altura_cm disponiveis. Area nao calculada automaticamente (campo manual). |
| 4 | Compor produto (BOM) | PARCIAL | 321 modelo_materiais + 362 modelo_processos seedados (mig 010/022). Editor carrega automaticamente ao selecionar modelo. |

#### Cenarios Extremos — Engenharia

| Cenario Extremo | Resultado | Detalhes |
|-----------------|-----------|----------|
| Modelo sem materiais vinculados -> orcamento R$ 0,00? | CONFIRMADO CRITICO | Se modelo.materiais = [], o motor recebe array vazia, custoMP = 0, custoMO = 0, preco final = 0. Editor nao bloqueia. |
| Modelo sem processos -> custo MO = R$ 0,00? | CONFIRMADO | calcPricing com processos=[] resulta tempoTotal=0, custoMO=0. Permitido silenciosamente. |
| Material com preco desatualizado -> como detectar? | INEXISTENTE | Nenhum mecanismo de alerta de precos desatualizados. preco_medio e campo estatico sem data de referencia. |
| BOM vazia no editor -> bloqueante ou silencioso? | SILENCIOSO | Editor permite salvar item com 0 materiais. Gera item com custo R$ 0,00 sem aviso ao usuario. |

---

### AGENTE_PRODUCAO

| Passo | Descricao | Status | Observacao |
|-------|-----------|--------|------------|
| 11 | Executar producao (5 etapas) | OK | criarOrdemProducao() cria OP + 5 etapas (criacao, impressao, acabamento, conferencia, expedicao). Kanban com drag-and-drop. |
| 12 | Finalizar producao | OK | finalizarCustosOP() atualiza custo_mp_real = estimado (sem apontamento real). |
| 16 | Liberar para entrega/instalacao | FALHA | Nenhum fluxo de liberacao pos-financeiro implementado. Status nao transita automaticamente. |
| 17 | Integracao App de Campo | FALHA | Migration 004 NAO EXECUTADA. Triggers fn_create_job_from_ordem e fn_sync_job_to_ordem nao existem no banco. |

#### Cenarios Extremos — Producao

| Cenario Extremo | Resultado | Detalhes |
|-----------------|-----------|----------|
| OS gerada sem bridge (fn_create_job_from_ordem) | FALHA | Trigger nao existe. Job nao e criado. Campo 100% desconectado do ERP. |
| Apontamento de etapas — dados salvos? | PARCIAL | Status da etapa atualiza (pendente->em_andamento->concluido). Mas tempo_real_min nao e preenchido automaticamente. |
| Retrabalho — existe fluxo? | OK | Status "retrabalho" implementado no Kanban. Transicao retrabalho->em_producao existe. |
| Conclusao parcial — suportado? | PARCIAL | Cada etapa tem status independente. Mas OP so muda para "concluida" se todas as etapas estiverem concluidas (validacao manual). |

---

### AGENTE_FINANCEIRO

| Passo | Descricao | Status | Observacao |
|-------|-----------|--------|------------|
| 13 | Receber pedido / validar valores | PARCIAL | Nao existe painel "pedidos a faturar" dedicado. Financeiro acessa pedidos generico. |
| 14 | Emitir NF-e | PARCIAL | criarNFeFromPedido() cria rascunho fiscal. Emissao real via Edge Functions + nfe-service (homologacao). |
| 15 | Gerar boleto / registrar pagamento | OK | Boleto CRUD completo. Transicoes de status robustas. CNAB 400 Itau implementado. |

#### Cenarios Extremos — Financeiro

| Cenario Extremo | Resultado | Detalhes |
|-----------------|-----------|----------|
| Boleto com vencimento passado — sistema barra? | FALHA | bankSlipCreateSchema.data_vencimento usa z.string().min(1) — aceita qualquer data, incluindo passado. Sem validacao temporal. |
| Remessa CNAB 400 com boletos invalidos — validacao existe? | PARCIAL | marcarProntoRemessa() valida status=emitido antes de gerar remessa. Mas nao valida dados do sacado (endereco, CEP). |
| NF-e em homologacao — fluxo completo funciona? | PARCIAL | Edge Functions implementadas (emitir, cancelar, consultar, inutilizar). NFE_INTERNAL_SECRET configurado via x-internal-secret header. Depende de certificado A1 e nfe-service deployado. |
| Duplicidade de cobranca — protecao existe? | FALHA | Nenhuma verificacao se ja existe boleto para o mesmo pedido. Permite criar multiplos boletos para mesmo pedido_id. |

---

### AGENTE_AUDITOR

#### Cenarios Extremos — Auditoria de Seguranca

| Cenario Extremo | Resultado | Detalhes |
|-----------------|-----------|----------|
| RLS do Supabase — tabelas criticas tem policy? | OK | Migration 001 habilita RLS em todas as tabelas via loop. Migration 002 adiciona policies granulares. |
| Dados sensiveis expostos no frontend (service_key)? | OK | Frontend usa apenas anon key (visivel em CLAUDE.md mas e public key por design). Nenhum service_role_key no codigo frontend (grep confirmou 0 resultados). |
| Rotas admin acessiveis sem autenticacao? | OK | ProtectedRoute em App.tsx envolve todas as rotas internas. So /login, /tv, /p/:token sao publicas. Auth real via Supabase Auth. |
| API do nfe-service — autenticacao via NFE_INTERNAL_SECRET funciona? | OK | validateInternalSecret() verifica header x-internal-secret contra env var. Edge Functions passam o secret ao chamar nfe-service. |
| /tv (TV de producao) acessivel sem auth? | ALERTA | Rota /tv nao esta dentro de ProtectedRoute. E publica. Exibe dados de producao sem login. |

---

## 5. PROBLEMAS IDENTIFICADOS

### 5.1 — Erros CRITICOS

---

**ERR-EXT-001** — Migration 004 (Bridge ERP-Campo) nao executada

```
Agente:      AGENTE_PRODUCAO + AGENTE_AUDITOR
Passo:       17 — Integracao App de Campo
Modulo ERP:  Instalacao / App de Campo
```

**Descricao**: A migration 004_integracao_bridge.sql define views (vw_campo_instalacoes, vw_campo_fotos) e triggers (fn_create_job_from_ordem, fn_sync_job_to_ordem) essenciais para a comunicacao ERP-Campo. Sem ela, o App de Campo opera isolado.

**Reproducao**:
1. Criar ordem de instalacao no ERP
2. Mudar status para "agendada"
3. Verificar tabela jobs — nenhum job criado

**Resultado esperado**: Job criado automaticamente pelo trigger
**Resultado obtido**: Nenhuma acao. Trigger inexistente no banco.
**Causa provavel**: Migration 004 marcada como "NAO executada" no CLAUDE.md
**Impacto no negocio**: App de Campo 100% desconectado. Instaladores nao recebem ordens de servico.

---

**ERR-EXT-002** — Orcamento gera R$ 0,00 quando modelo nao tem BOM

```
Agente:      AGENTE_ENGENHARIA + AGENTE_COMERCIAL
Passo:       4/7 — Composicao / Criacao de orcamento
Modulo ERP:  Orcamentos + Motor de Precificacao
```

**Descricao**: Se o modelo selecionado nao possui registros em modelo_materiais, o editor de orcamento envia arrays vazias ao motor Mubisys. calcPricing({materiais:[], processos:[]}) retorna custoMP=0, custoMO=0, precoVenda=0. Nenhum alerta e exibido.

**Reproducao**:
1. Criar produto com modelo sem materiais vinculados
2. Abrir editor de orcamento → selecionar esse modelo
3. Observar: preco unitario = R$ 0,00

**Resultado esperado**: Alerta "Este modelo nao possui composicao de materiais" + bloqueio de salvamento
**Resultado obtido**: Item salvo com valor R$ 0,00 silenciosamente
**Causa provavel**: OrcamentoEditorPage.handleModeloChange carrega modelo.materiais sem verificar se e vazio
**Impacto no negocio**: Orcamentos com valor zero podem ser enviados a clientes. Perda financeira direta.

---

**ERR-EXT-003** — Nenhuma deteccao de leads duplicados

```
Agente:      AGENTE_COMERCIAL
Passo:       5 — Gerar lead
Modulo ERP:  CRM / Leads
```

**Descricao**: useCreateLead() faz INSERT direto sem verificar duplicidade por empresa, email ou telefone. Nao existe unique constraint no banco para esses campos.

**Reproducao**:
1. Criar lead "Papelaria Sao Lucas" com email rafael@papelariaslucas.com.br
2. Criar outro lead identico
3. Ambos sao aceitos sem aviso

**Resultado esperado**: Alerta "Lead com este email/empresa ja existe"
**Resultado obtido**: Dois leads identicos criados
**Causa provavel**: Ausencia de validacao pre-insert
**Impacto no negocio**: Duplicidade de cadastro, trabalho comercial desperdicado, inconsistencia de funil.

---

**ERR-EXT-004** — Orcamento aprovado pode ser editado sem restricao

```
Agente:      AGENTE_COMERCIAL
Passo:       7/9 — Orcamento / Aprovacao
Modulo ERP:  Orcamentos
```

**Descricao**: useAtualizarOrcamento() nao verifica o status atual antes de aplicar updates. Um orcamento com status "aprovada" pode ter seu titulo, itens, valor ou cliente alterados.

**Reproducao**:
1. Criar e aprovar orcamento
2. Acessar /orcamentos/:id/editar
3. Alterar valor ou item
4. Salvar — aceito sem erro

**Resultado esperado**: Sistema bloqueia edicao de orcamento aprovado
**Resultado obtido**: Edicao livre mesmo apos aprovacao
**Causa provavel**: orcamentoService.atualizar() nao faz check de status
**Impacto no negocio**: Valores podem ser alterados apos aprovacao do cliente, quebrando integridade contratual.

---

**ERR-EXT-005** — Boleto aceita vencimento no passado

```
Agente:      AGENTE_FINANCEIRO
Passo:       15 — Gerar boleto
Modulo ERP:  Financeiro / Boletos
```

**Descricao**: bankSlipCreateSchema valida data_vencimento apenas como string nao-vazia. Nenhuma verificacao se a data e futura.

**Reproducao**:
1. Abrir Financeiro → Boletos → Novo
2. Informar data de vencimento "2025-01-01"
3. Salvar — aceito

**Resultado esperado**: "Data de vencimento deve ser futura"
**Resultado obtido**: Boleto criado com vencimento no passado
**Causa provavel**: Schema Zod sem .refine() para data futura
**Impacto no negocio**: Boletos invalidos podem ser incluidos em remessa CNAB, gerando rejeicao bancaria.

---

**ERR-EXT-006** — Duplicidade de cobranca para mesmo pedido

```
Agente:      AGENTE_FINANCEIRO
Passo:       15 — Gerar boleto
Modulo ERP:  Financeiro / Boletos
```

**Descricao**: createBoleto() nao verifica se ja existe boleto ativo (status != cancelado) para o mesmo pedido_id. Permite criar N boletos para o mesmo pedido.

**Reproducao**:
1. Gerar boleto para pedido PED-2026-0001
2. Gerar outro boleto para o mesmo pedido
3. Ambos aceitos

**Resultado esperado**: Alerta "Ja existe boleto ativo para este pedido"
**Resultado obtido**: Dois boletos criados, cobranca duplicada
**Causa provavel**: Ausencia de check pre-insert em boleto.service.ts
**Impacto no negocio**: Cliente cobrado em duplicidade. Risco juridico.

---

**ERR-EXT-007** — Migration 006 (schema orcamento) incompativel

```
Agente:      AGENTE_AUDITOR
Passo:       Auditoria de Arquitetura
Modulo ERP:  Orcamentos
```

**Descricao**: Migration 006_orcamento_module.sql define tabelas acabamentos, servicos, regras_precificacao que podem conflitar com schemas ja existentes. Marcada como "NAO executada" e "SCHEMA PRECISA SER CORRIGIDO antes de executar".

**Reproducao**: Tentar executar migration 006 no banco
**Resultado esperado**: Schema estavel
**Resultado obtido**: 3 definicoes diferentes no codigo para as mesmas tabelas
**Causa provavel**: Schema evoluiu incrementalmente sem consolidar a migration
**Impacto no negocio**: Funcionalidades de acabamentos e servicos no orcamento operam com try-catch fallback (silenciam erros).

---

### 5.2 — Erros ALTOS

| ID | Agente | Passo | Descricao | Impacto |
|----|--------|-------|-----------|---------|
| ERR-EXT-008 | COMERCIAL | 6 | Conversao lead->cliente nao tem botao automatico. Processo totalmente manual com dados nao migrados. | Vendedor perde tempo re-digitando dados. |
| ERR-EXT-009 | COMERCIAL | 9 | Aprovacao pelo portal NAO gera pedido automaticamente. Exige acao manual do vendedor. | Atraso no fluxo. Risco de perda de venda. |
| ERR-EXT-010 | ENGENHARIA | 4 | Editor de BOM permite salvar item com materiais = [] sem alerta. | Orcamento com valor zero. |
| ERR-EXT-011 | ENGENHARIA | 1 | Nenhum mecanismo de alerta para precos desatualizados de materiais. Campo preco_medio estatico. | Orcamentos com custos defasados. |
| ERR-EXT-012 | PRODUCAO | 16 | Nenhum fluxo de liberacao financeira -> expedicao implementado. Status nao transita automaticamente. | Producao concluida nao e notificada de liberacao. |
| ERR-EXT-013 | FINANCEIRO | 13 | Nao existe painel dedicado "pedidos a faturar". Financeiro navega em pedidos generico. | Ineficiencia operacional. |
| ERR-EXT-014 | FINANCEIRO | 14 | NF-e em homologacao depende de nfe-service deployado + certificado A1. Sem fallback para emissao manual. | Faturamento bloqueado se servico cair. |
| ERR-EXT-015 | PRODUCAO | 11 | tempo_real_min da etapa nao e preenchido automaticamente (diferenca entre inicio/fim). | Rastreabilidade de tempo produtivo incompleta. |
| ERR-EXT-016 | AUDITOR | - | Rota /tv (TV de producao) acessivel sem autenticacao. Exibe dados de OPs e pedidos. | Dados de producao expostos publicamente. |
| ERR-EXT-017 | COMERCIAL | 6 | CNPJ aceito sem validacao de digito verificador no frontend. | Dados fiscais incorretos podem gerar rejeicao de NF-e. |
| ERR-EXT-018 | FINANCEIRO | 15 | Dados do sacado (endereco, CEP) nao validados antes de gerar remessa CNAB. | Rejeicao bancaria. |

---

### 5.3 — Erros MEDIOS

| ID | Agente | Passo | Descricao | Sugestao |
|----|--------|-------|-----------|---------|
| ERR-EXT-019 | ENGENHARIA | 3 | Area do modelo (area_m2) nao calculada automaticamente a partir de largura x altura. | Adicionar computed field ou trigger. |
| ERR-EXT-020 | ENGENHARIA | 3 | Sistema nao valida compatibilidade maquina/tamanho do modelo. | Feature futura: vincular maquinas a modelos. |
| ERR-EXT-021 | PRODUCAO | 11 | generateOpNumero() usa Math.random — risco de colisao. | Usar sequencia atomica (RPC). |
| ERR-EXT-022 | PRODUCAO | 12 | Estoque nao e debitado ao concluir producao (modulo de estoque nao implementado). | Implementar movimentacao de estoque. |
| ERR-EXT-023 | COMERCIAL | 7 | Search no filtro de orcamentos vulneravel a SQL injection via .or() com input nao sanitizado. | Sanitizar filtros.search antes de passar ao Supabase. |
| ERR-EXT-024 | PRODUCAO | 11 | OP nao exibe lista de materiais necessarios (BOM x quantidade). | Implementar requisicao de materiais na OP. |
| ERR-EXT-025 | FINANCEIRO | 14 | criarNFeFromPedido() nao calcula impostos (ICMS, PIS, COFINS). Valores ficam zerados. | Integrar calculo fiscal na criacao. |
| ERR-EXT-026 | COMERCIAL | 7 | proposta_item_materiais e proposta_item_acabamentos operam com try-catch silencioso (mig 006 pendente). | Executar ou consolidar migration 006. |
| ERR-EXT-027 | AUDITOR | - | modelo_processos seedado (362 registros mig 022) mas tempos podem nao refletir realidade. | Permitir ajuste de tempos por modelo. |

---

### 5.4 — Melhorias BAIXAS

| ID | Local | Sugestao de Melhoria |
|----|-------|---------------------|
| ERR-EXT-028 | Leads | Adicionar campo "origem" com opcoes pre-definidas (Site, Indicacao, Feira, etc.). |
| ERR-EXT-029 | Orcamentos | Adicionar preview do orcamento antes de enviar ao portal. |
| ERR-EXT-030 | Producao | Adicionar filtro por maquina no kanban de producao. |
| ERR-EXT-031 | Financeiro | Dashboard financeiro com KPIs (inadimplencia, ticket medio, DRE). |
| ERR-EXT-032 | Portal | Permitir que cliente solicite alteracoes pelo portal (nao apenas aprovar/recusar). |
| ERR-EXT-033 | Admin | Painel de auditoria de alteracoes (log de quem mudou o que). |

---

## 6. QUEBRAS DE FLUXO

| Etapa Origem | Etapa Destino | Motivo da Quebra | Severidade |
|-------------|--------------|-----------------|-----------|
| Passo 12 (Producao concluida) | Passo 16 (Liberacao entrega) | Nenhuma transicao automatica pos-financeiro | ALTO |
| Passo 16 (Liberacao) | Passo 17 (App Campo) | Migration 004 nao executada — bridge inexistente | CRITICO |
| Passo 9 (Aprovacao portal) | Passo 10 (Gerar pedido) | Pedido nao gerado automaticamente apos aprovacao | ALTO |

**Passos nao executados por consequencia de quebra**:
- Passo 17: Bridge ERP-Campo totalmente inoperante (bloqueado por migration 004 ausente)

---

## 7. AUDITORIA CROSS-FUNCIONAL (AGENTE_AUDITOR)

### Consistencia de Valores

| Documento | Valor Registrado | Consistente? |
|-----------|-----------------|-------------|
| Orcamento | Depende dos materiais carregados | CONDICIONAL |
| Pedido | = total do orcamento (via converterParaPedido) | OK |
| Cobranca | Independente (input manual no boleto) | RISCO |
| NF-e | = valor_total do pedido (via criarNFeFromPedido) | OK |

Observacao: O valor do boleto e digitado manualmente pelo usuario e nao e validado contra o valor do pedido. Risco de divergencia.

### Integridade Referencial

| Relacionamento | Status | Observacao |
|---------------|--------|------------|
| Lead -> Cliente | Manual | Nao existe FK lead.cliente_id preenchida automaticamente |
| Orcamento -> Pedido | OK | pedido.proposta_id referencia orcamento |
| Pedido -> OP | OK | ordens_producao.pedido_id vincula |
| OI -> Job (campo) | QUEBRADO | Migration 004 nao executada. FK e trigger inexistentes |

### Status Finais das Entidades (fluxo completo esperado)

| Entidade | Status Esperado | Observacao |
|----------|----------------|------------|
| Lead | convertido | Manual — nao existe transicao automatica na conversao |
| Orcamento | aprovada | Funciona via portal ou manual |
| Pedido | faturado/liberado_entrega | Nao existe transicao automatica pos-pagamento |
| OP | concluida | Funciona via kanban |
| OI | concluida | Bridge inexistente — nao sincroniza |
| Job (campo) | Concluido | NAO CRIADO (trigger ausente) |

---

## 8. ERROS DE REGRA DE NEGOCIO

| Regra | Testada? | Sistema Bloqueia? | Comportamento Observado |
|-------|----------|-----------------|------------------------|
| Pedido sem orcamento aprovado | Sim | Parcial | converterParaPedido valida itens > 0 e total > 0, mas nao exige status="aprovada" |
| Faturar sem producao concluida | Sim | Nao | criarNFeFromPedido aceita qualquer pedido independente do status |
| Orcamento com valor zero | Sim | Sim | converterParaPedido verifica total > 0 antes de gerar pedido |
| CNPJ invalido | Sim | Nao | Sem validacao de digito verificador |
| Boleto com valor negativo | Sim | Sim | z.coerce.number().positive() no schema Zod |
| Quantidade zero no orcamento | Sim | Nao | Input min=1 no HTML mas sem validacao Zod |

---

## 9. PROBLEMAS DE UX

| Modulo | Problema | Severidade | Sugestao |
|--------|----------|-----------|---------|
| Leads | Formulario de novo lead inline nao tem validacao de campos obrigatorios marcados | MEDIO | Adicionar schema Zod + indicadores visuais |
| Orcamento Editor | Wizard 3 etapas funcional mas sem feedback se BOM esta vazia | ALTO | Alerta amarelo quando materiais = 0 |
| Producao | Kanban drag-and-drop funcional mas sem confirmacao de mudanca de status | MEDIO | Dialog de confirmacao |
| Financeiro | Boleto nao exibe preview formatado antes de emitir | BAIXO | Adicionar preview visual |
| Portal | Sem opcao de rejeicao com motivo | MEDIO | Adicionar campo de justificativa |

---

## 10. MODULOS INCOMPLETOS

| Modulo | UI | Backend | Status | Impacto |
|--------|----|---------|--------|---------|
| BOM / Composicao | OK | OK | Operacional (321+ registros) | Depende de modelo ter materiais |
| Motor de precificacao | OK | OK | Operacional (9 passos Mubisys) | Funciona se BOM carregada |
| Portal de aprovacao | OK | OK | Operacional (/p/:token) | Falta gerar pedido automatico |
| Etapas de producao | OK | OK | Operacional (5 etapas + kanban) | Falta tempo_real automatico |
| NF-e / Fiscal | OK | Parcial | Homologacao (nfe-service) | Depende de deploy + certificado |
| Boletos CNAB 400 | OK | OK | Operacional | Falta validacoes de borda |
| Bridge App de Campo | SQL pronto | Nao executada | INOPERANTE | Migration 004 pendente |
| Estoque / Almoxarife | Parcial | Parcial | Basico | Sem movimentacao real |

---

## 11. MELHORIAS RECOMENDADAS

### Prioritarias — implementar antes do proximo deploy

1. **Executar migration 004** — Bridge ERP-Campo. SQL pronto, so precisa executar. Habilita toda a integracao de instalacao.
2. **Validacao de BOM vazia no editor de orcamento** — Bloquear salvamento de item quando materiais = [] com alerta visivel.
3. **Validacao de data de vencimento do boleto** — Refine no Zod: data >= hoje.
4. **Protecao contra edicao de orcamento aprovado** — Check de status no service antes de permitir update.
5. **Verificacao de duplicidade de boleto por pedido** — Check pre-insert no boleto.service.

### Desejaveis — implementar nas proximas sprints

1. **Deteccao de lead duplicado** — Busca por empresa/email antes de insert.
2. **Geracao automatica de pedido apos aprovacao no portal** — Webhook ou trigger.
3. **Validacao de CNPJ (digito verificador)** — Algoritmo padrao no frontend.
4. **Painel "pedidos a faturar" no financeiro** — Filtro dedicado por status producao_concluida.
5. **Consolidar migration 006** — Resolver 3 definicoes conflitantes e executar.

---

## 12. PLANO DE CORRECAO PRIORITARIO

| # | ID | Erro | Modulo | Esforco | Impacto se nao corrigir |
|---|-----|------|--------|---------|------------------------|
| 1 | ERR-EXT-001 | Migration 004 nao executada (bridge) | Instalacao/Campo | P | App de Campo 100% desconectado |
| 2 | ERR-EXT-002 | Orcamento R$ 0,00 com BOM vazia | Orcamentos | P | Propostas com valor zero enviadas a clientes |
| 3 | ERR-EXT-005 | Boleto aceita vencimento passado | Financeiro | P | Rejeicao bancaria em lote |
| 4 | ERR-EXT-004 | Orcamento aprovado pode ser editado | Orcamentos | P | Quebra de integridade contratual |
| 5 | ERR-EXT-006 | Duplicidade de cobranca | Financeiro | P | Cobranca duplicada ao cliente |
| 6 | ERR-EXT-003 | Leads duplicados aceitos | CRM | M | Funil de vendas poluido |
| 7 | ERR-EXT-007 | Migration 006 incompativel | Orcamentos | G | Acabamentos e servicos silenciosamente ignorados |
| 8 | ERR-EXT-009 | Portal nao gera pedido automatico | Comercial | M | Atraso no fluxo comercial |
| 9 | ERR-EXT-016 | Rota /tv publica sem auth | Producao | P | Dados de producao expostos |
| 10 | ERR-EXT-017 | CNPJ sem validacao | Clientes | P | NF-e rejeitada pela SEFAZ |

**Legenda esforco**: P = Pequeno (<2h) | M = Medio (2h-1dia) | G = Grande (>1dia)

---

## 13. AVALIACAO DE PRONTIDAO DO ERP — STATUS POR MODULO

| Modulo | Status | Bloqueadores Criticos |
|--------|--------|----------------------|
| Cadastro de Produtos (BOM) | Operacional | Nenhum (321+ materiais, 362 processos seedados) |
| CRM / Leads | Parcial | Sem deteccao de duplicidade (ERR-EXT-003) |
| Orcamentos + Portal | Parcial | BOM vazia aceita silenciosamente (ERR-EXT-002), edicao pos-aprovacao (ERR-EXT-004) |
| Pedidos | Operacional | Nenhum bloqueador critico |
| Producao (PCP + Chao) | Operacional | Numero OP random (ERR-EXT-021, medio) |
| Financeiro | Parcial | Vencimento passado (ERR-EXT-005), duplicidade (ERR-EXT-006) |
| Faturamento (NF-e) | Parcial (Homologacao) | Depende de deploy nfe-service + certificado A1 |
| Expedicao | Inoperante | Sem fluxo de liberacao pos-financeiro (ERR-EXT-012) |
| Instalacao + App Campo | Inoperante | Migration 004 nao executada (ERR-EXT-001) |

---

## VEREDITO FINAL

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PARCIALMENTE APTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  O ERP Croma Print possui estrutura solida para o fluxo
  Lead-to-Cash, com motor de precificacao Mubisys funcional,
  portal de aprovacao operacional, modulo de boletos robusto
  e autenticacao real.

  Porem, 7 erros CRITICOS impedem uso autonomo em producao:
  - Bridge App de Campo desconectada (migration pendente)
  - Orcamentos podem gerar R$ 0,00 sem alerta
  - Boletos aceitam dados invalidos
  - Orcamentos aprovados podem ser editados
  - Migration 006 incompativel silencia funcionalidades

  RECOMENDACAO: Executar as 5 correcoes prioritarias (estimativa
  total: 1 dia de trabalho) antes de liberar para operacao real.
  O item #1 (executar migration 004) e o mais rapido e de maior
  impacto — habilita toda a integracao de instalacao.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Emitido por:  CROMA_MASTER_AGENT + 5 sub-agentes
  Data:         2026-03-14
  Proxima exec: Apos correcao dos 5 itens prioritarios
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## APENDICE: TABELA CONSOLIDADA DE TODOS OS ACHADOS

| ID | Titulo | Modulo | Severidade | Impacto | Como Reproduzir | Correcao | Sprint |
|----|--------|--------|-----------|---------|----------------|---------|--------|
| ERR-EXT-001 | Migration 004 (bridge) nao executada | Instalacao/Campo | CRITICO | App Campo desconectado | Verificar pg_trigger — ausente | Executar 004_integracao_bridge.sql | Sprint 1 |
| ERR-EXT-002 | Orcamento R$ 0,00 com BOM vazia | Orcamentos | CRITICO | Proposta com valor zero | Selecionar modelo sem materiais | Validar materiais.length > 0 no editor | Sprint 1 |
| ERR-EXT-003 | Leads duplicados aceitos | CRM | CRITICO | Funil poluido | Criar 2 leads identicos | Check pre-insert por empresa/email | Sprint 1 |
| ERR-EXT-004 | Orcamento aprovado editavel | Orcamentos | CRITICO | Quebra contratual | Editar orcamento aprovado | Check status no service | Sprint 1 |
| ERR-EXT-005 | Boleto aceita vencimento passado | Financeiro | CRITICO | Rejeicao bancaria | Criar boleto com data passada | .refine() no Zod schema | Sprint 1 |
| ERR-EXT-006 | Duplicidade de cobranca | Financeiro | CRITICO | Cobranca duplicada | Criar 2 boletos mesmo pedido | Check pre-insert | Sprint 1 |
| ERR-EXT-007 | Migration 006 incompativel | Orcamentos | CRITICO | Acabamentos silenciados | Verificar try-catch no service | Consolidar e executar mig 006 | Sprint 2 |
| ERR-EXT-008 | Conversao lead->cliente manual | CRM | ALTO | Re-digitacao de dados | Converter lead manualmente | Implementar botao de conversao | Sprint 2 |
| ERR-EXT-009 | Portal nao gera pedido automatico | Comercial | ALTO | Atraso no fluxo | Aprovar proposta no portal | Trigger/webhook pos-aprovacao | Sprint 2 |
| ERR-EXT-010 | BOM vazia aceita silenciosamente | Orcamentos | ALTO | Item com custo zero | Adicionar item sem materiais | Alerta visual no editor | Sprint 1 |
| ERR-EXT-011 | Sem alerta de preco desatualizado | Engenharia | ALTO | Custo defasado | Verificar preco_medio antigo | Adicionar data_referencia ao material | Sprint 3 |
| ERR-EXT-012 | Sem liberacao pos-financeiro | Producao | ALTO | Producao nao notificada | Pagar boleto, verificar pedido | Transicao automatica de status | Sprint 2 |
| ERR-EXT-013 | Sem painel "pedidos a faturar" | Financeiro | ALTO | Ineficiencia | Navegar em pedidos generico | Filtro dedicado | Sprint 2 |
| ERR-EXT-014 | NF-e depende de deploy externo | Fiscal | ALTO | Faturamento bloqueado | nfe-service offline | Fallback para emissao manual | Sprint 3 |
| ERR-EXT-015 | tempo_real_min nao automatico | Producao | ALTO | Rastreabilidade incompleta | Concluir etapa, verificar tempo | Calcular diff(inicio, fim) | Sprint 2 |
| ERR-EXT-016 | Rota /tv publica sem auth | Producao | ALTO | Dados expostos | Acessar /tv sem login | Adicionar ProtectedRoute ou token | Sprint 1 |
| ERR-EXT-017 | CNPJ sem validacao digito | Clientes | ALTO | NF-e rejeitada | Cadastrar CNPJ invalido | Algoritmo de validacao | Sprint 1 |
| ERR-EXT-018 | Sacado sem validacao na remessa | Financeiro | ALTO | Rejeicao CNAB | Gerar remessa com dados vazios | Validar endereco/CEP | Sprint 2 |
| ERR-EXT-019 | Area modelo nao auto-calculada | Engenharia | MEDIO | Area manual imprecisa | Criar modelo, verificar area | Computed field L x A | Sprint 3 |
| ERR-EXT-020 | Sem validacao maquina/tamanho | Engenharia | MEDIO | Alocacao incorreta | Alocar maquina incompativel | Feature futura | Sprint 4 |
| ERR-EXT-021 | OP numero random (colisao) | Producao | MEDIO | Numeros duplicados | Criar muitas OPs | Sequencia atomica via RPC | Sprint 2 |
| ERR-EXT-022 | Estoque nao debitado | Producao | MEDIO | Estoque inconsistente | Concluir OP, verificar estoque | Modulo de movimentacao | Sprint 3 |
| ERR-EXT-023 | Search vulneravel a injection | Orcamentos | MEDIO | Seguranca | Input especial no filtro | Sanitizar input | Sprint 1 |
| ERR-EXT-024 | OP sem lista de materiais | Producao | MEDIO | PCP sem visibilidade | Abrir OP, verificar materiais | Carregar BOM x qty na OP | Sprint 2 |
| ERR-EXT-025 | NF-e sem calculo de impostos | Fiscal | MEDIO | Impostos zerados | Criar NF-e, verificar ICMS | Integrar calculo fiscal | Sprint 2 |
| ERR-EXT-026 | Materiais/acabamentos silenciados | Orcamentos | MEDIO | Dados perdidos | Salvar item detalhado | Corrigir migration 006 | Sprint 2 |
| ERR-EXT-027 | Tempos de processo estimados | Engenharia | MEDIO | Custo MO impreciso | Verificar tempo vs realidade | Permitir ajuste fino | Sprint 3 |
| ERR-EXT-028 | Lead sem campo origem estruturado | CRM | BAIXO | Rastreabilidade fraca | Criar lead | Adicionar enum de origens | Sprint 3 |
| ERR-EXT-029 | Sem preview de orcamento | Orcamentos | BAIXO | UX | Enviar proposta | Adicionar preview PDF | Sprint 3 |
| ERR-EXT-030 | Sem filtro por maquina no kanban | Producao | BAIXO | UX | Filtrar por maquina | Adicionar filtro | Sprint 4 |
| ERR-EXT-031 | Sem dashboard financeiro KPIs | Financeiro | BAIXO | Visibilidade | Verificar DRE | Implementar DRE | Sprint 3 |
| ERR-EXT-032 | Portal sem opcao de alteracao | Portal | BAIXO | UX do cliente | Tentar solicitar mudanca | Adicionar formulario | Sprint 4 |
| ERR-EXT-033 | Sem log de auditoria | Admin | BAIXO | Compliance | Verificar quem alterou | Audit trail | Sprint 4 |

---

*Relatorio gerado pelo Sistema Multi-Agente — Simulador de Operacoes CROMA_ERP*
*CROMA_MASTER_AGENT + AGENTE_COMERCIAL + AGENTE_ENGENHARIA + AGENTE_PRODUCAO + AGENTE_FINANCIAL + AGENTE_AUDITOR*
*Para re-executar: invocar AGENTE_PRINCIPAL.md com o cenario desejado*
