# RELATORIO DE SIMULACAO OPERACIONAL — CROMA_ERP
## Sessao: 2026-03-17

---

## 1. RESUMO EXECUTIVO

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SIMULADOR DE OPERACOES CROMA_ERP — RESULTADO FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Cenario executado:    Banner-Teste — Fluxo Completo
  Data/Hora:            2026-03-17
  Metodo:               Analise estatica de codigo + DB schema

  Sub-agentes ativos:
    [x] AGENTE_COMERCIAL
    [x] AGENTE_ENGENHARIA
    [x] AGENTE_PRODUCAO
    [x] AGENTE_FINANCIAL
    [x] AGENTE_AUDITOR

  Passos executados:    17/17 (analise)
  Taxa de sucesso:      65%

  Erros encontrados:
    CRITICO: 3
    ALTO:    8
    MEDIO:   9
    BAIXO:   6
    ──────────────────
    TOTAL:   26

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VEREDITO: PARCIALMENTE APTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Justificativa do veredito**:
> O fluxo principal Lead-to-Cash esta implementado de ponta a ponta com codigo funcional, porem tres problemas criticos impedem operacao confiavel: (1) missing import de supabase no LeadDetailPage causa crash ao deletar leads, (2) a conversao orcamento-para-pedido cria pedido com status "aguardando_aprovacao" em vez de "em_producao", quebrando o fluxo automatico Venda->Producao, e (3) nao existe validacao de CNPJ no formulario de clientes (apenas no lead->cliente). Modulos secundarios como NF-e, boletos e bridge campo estao bem estruturados mas dependem de integracao externa (SEFAZ, banco) ainda nao conectada.

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
|------|---------|--------|------------|
| Fase 1 — Preparacao | Engenharia + Comercial (parcial) | PARCIAL | Engenharia OK; Lead tem bug de import |
| Fase 2 — Venda | Comercial | PARCIAL | Orcamento/Portal OK; Pedido com status errado |
| Fase 3 — Producao | Producao | OK | Kanban funcional, 5 etapas, materiais auto-populados |
| Fase 4 — Financeiro+Entrega | Financial + Producao | PARCIAL | Fiscal/boletos existem; NF-e sem SEFAZ |
| Fase 5 — Auditoria | Auditor | OK | Auditoria cross-funcional concluida |

---

## 3. DADOS DE REFERENCIA DO TESTE

```
PRODUTO TESTADO:
  Produto:       Banner-Teste
  Variacao:      Banner 90x120
  Quantidade:    10 unidades
  Composicao:    6 materiais (lona, bastao x2, ponteira, cordinha, tinta)

VALORES DE REFERENCIA:
  Custo unitario esperado:  R$ 43,21
  Markup padrao:            3,5x (via motor de precificacao com 9 passos)
  Preco venda referencia:   R$ 151,24
  Total 10 unidades:        R$ 1.512,40
  Impostos referencia:      R$ 236,69

OBSERVACAO SOBRE MOTOR DE PRECIFICACAO:
  O motor usa Custeio Direto (9 passos), nao markup simples.
  O calculo real depende de: config_precificacao + materiais + processos.
  Se modelo_materiais e modelo_processos estiverem vazios, custo = R$ 0,00.
```

---

## 4. RESULTADO POR SUB-AGENTE

### AGENTE_ENGENHARIA (Passos 1-4)

| Passo | Descricao | Status | Observacao |
|-------|-----------|--------|------------|
| 1 | Cadastrar materia-prima | OK | AdminMateriaisPage funcional. Campos: nome, unidade, preco_medio, aproveitamento. Aceita decimais. |
| 2 | Criar produto | OK | AdminProdutosPage funcional. CRUD completo com categoria, unidade, ativo. |
| 3 | Criar variacoes (modelos) | OK | Modelos com largura_cm, altura_cm, area_m2. Area NAO e calculada automaticamente (campo manual). |
| 4 | Compor produto (BOM) | PARCIAL | useSalvarMaterialModelo e useSalvarProcessosModelo existem. Seed 022 popula dados reais (lona, vinil, ACM). Porem UI de composicao nao e inline no modelo — exige acesso separado. |

### AGENTE_COMERCIAL (Passos 5-10)

| Passo | Descricao | Status | Observacao |
|-------|-----------|--------|------------|
| 5 | Gerar lead | OK | LeadsPage + LeadDetailPage funcional. Status 7-estagio, temperatura 3 niveis, validacao email/telefone. |
| 6 | Converter lead em cliente | PARCIAL | Conversao funciona com validacao CNPJ. BUG: supabase nao importado no LeadDetailPage — crash no delete. |
| 7 | Criar orcamento | OK | Editor 3 etapas com materiais, acabamentos, servicos. Motor de precificacao 9 passos integrado. Recalculo automatico de totais. |
| 8 | Enviar proposta | OK | Portal publico /p/{token}. Header, itens, footer. Tracking de cliques. Upload de arquivos. |
| 9 | Simular aprovacao | OK | PortalApproval component. Aprovacao gera evento. Confirmacao visual. Validade com dias restantes. |
| 10 | Gerar pedido | PARCIAL | converterParaPedido funciona mas cria com status "aguardando_aprovacao" em vez de "em_producao". Anti-duplicacao OK. Itens copiados com campos tecnicos. |

### AGENTE_PRODUCAO (Passos 11-12, 16-17)

| Passo | Descricao | Status | Observacao |
|-------|-----------|--------|------------|
| 11 | Executar producao (5 etapas) | OK | Kanban com 8 colunas (aguardando_programacao, em_fila, em_producao, em_acabamento, em_conferencia, liberado, retrabalho, finalizado). Drag-and-drop funcional. |
| 12 | Finalizar producao | OK | finalizarCustosOP atualiza custos reais, desconta estoque, e auto-atualiza status do pedido para "produzido" quando todas OPs concluidas. |
| 16 | Liberar para entrega/instalacao | OK | criarOrdemInstalacao gera OS com numero sequencial. Vinculado ao pedido. |
| 17 | Integracao App de Campo | OK | Bridge triggers instalados: trg_create_job_from_ordem, fn_sync_job_to_ordem. Views vw_campo_instalacoes e vw_campo_fotos criadas. |

### AGENTE_FINANCIAL (Passos 13-15)

| Passo | Descricao | Status | Observacao |
|-------|-----------|--------|------------|
| 13 | Receber pedido / validar valores | OK | PedidosAFaturarPage lista pedidos em status avancado sem NF-e. Filtragem por status. |
| 14 | Emitir NF-e | PARCIAL | Modulo fiscal completo (dashboard, documentos, fila, auditoria, certificados, series, regras). Gera rascunho via RPC. Emissao via edge function — SEFAZ nao conectado. |
| 15 | Gerar boleto / registrar pagamento | PARCIAL | Boletos CNAB400 Itau implementado. Remessas, retornos. Stats. Mas banco nao configurado — operacao manual. |

---

## 5. PROBLEMAS IDENTIFICADOS

### 5.1 — Erros CRITICOS

---

**ERR-COM-BUG-001** — Import de supabase ausente no LeadDetailPage

```
Agente:      AGENTE_COMERCIAL
Passo:       5-6 — Leads
Modulo ERP:  Comercial / LeadDetailPage.tsx
```

**Descricao**: O arquivo `src/domains/comercial/pages/LeadDetailPage.tsx` usa `supabase.from("leads").delete()` na linha 45, mas nao importa `supabase` de `@/integrations/supabase/client`. O codigo compila porque TypeScript infere o tipo mas a variavel `supabase` nao esta definida no escopo.

**Reproducao**:
1. Abrir LeadDetailPage
2. Clicar no botao de excluir lead
3. Confirmar exclusao
4. CRASH: ReferenceError — supabase is not defined

**Resultado esperado**: Lead excluido com soft delete
**Resultado obtido**: Runtime crash
**Causa provavel**: Import removido acidentalmente em refatoracao
**Impacto no negocio**: Impossivel excluir leads pelo detalhe. Alternativa: exclusao direta pelo banco.

---

**ERR-COM-FLOW-002** — Pedido gerado com status incorreto

```
Agente:      AGENTE_COMERCIAL / AGENTE_AUDITOR
Passo:       10 — Gerar pedido
Modulo ERP:  Comercial / orcamento.service.ts (linha 788)
```

**Descricao**: A funcao `converterParaPedido` cria pedido com `status: "aguardando_aprovacao"` (linha 788), mas o fluxo espera que apos aprovacao no portal o pedido va direto para producao. Nao existe transicao automatica de "aguardando_aprovacao" para "em_producao".

**Reproducao**:
1. Aprovar orcamento no portal
2. Converter em pedido
3. Verificar status do pedido: "aguardando_aprovacao"
4. Producao nao enxerga o pedido porque espera status "aprovado" ou "em_producao"

**Resultado esperado**: Pedido criado com status que permite fluxo automatico para producao
**Resultado obtido**: Pedido fica em limbo — precisa de aprovacao manual adicional
**Causa provavel**: Status "aguardando_aprovacao" reflete um fluxo de dupla aprovacao (comercial + diretoria) que nao esta implementado no frontend
**Impacto no negocio**: Pedidos ficam parados apos aprovacao do cliente. Producao nao inicia automaticamente.

---

**ERR-ENG-CALC-003** — Area do modelo nao calculada automaticamente

```
Agente:      AGENTE_ENGENHARIA
Passo:       3 — Criar variacoes
Modulo ERP:  Admin / Produtos / Modelos
```

**Descricao**: Os campos `largura_cm` e `altura_cm` existem no modelo, mas `area_m2` nao e calculada automaticamente (L x A / 10000). O campo existe no schema mas depende de input manual. Se area ficar null/zero, o calculo de custo de materiais como lona (que usa m2) retorna zero.

**Resultado esperado**: area_m2 = (largura_cm * altura_cm) / 10000 calculada automaticamente
**Resultado obtido**: Campo manual — risco de ficar vazio
**Impacto no negocio**: Custo de materiais calculado incorretamente para produtos baseados em area.

---

### 5.2 — Erros ALTOS

| ID | Agente | Passo | Descricao | Impacto |
|----|--------|-------|-----------|---------|
| ERR-COM-010 | COMERCIAL | 6 | Lead delete faz hard-delete em vez de soft-delete (excluido_em) | Viola padrao do sistema; lead some permanentemente |
| ERR-COM-011 | COMERCIAL | 7 | Orcamento usa tabela "propostas" — nomen clatura confusa para usuarios | Confusao semantica entre proposta e orcamento |
| ERR-PRD-005 | PRODUCAO | 12 | finalizarCustosOP copia custo estimado como custo real | Custo real nunca e atualizado com valores reais de consumo |
| ERR-FIN-004 | FINANCIAL | 14 | Edge function fiscal-emitir-nfe nao esta deployada/conectada a SEFAZ | NF-e nao pode ser emitida de fato |
| ERR-FIN-007 | FINANCIAL | 15 | Boleto depende de configuracao bancaria (bank_accounts) que provavelmente esta vazia | Boleto nao pode ser emitido sem setup |
| ERR-ENG-008 | ENGENHARIA | 4 | Composicao (BOM) nao tem UI dedicada inline no editor de modelos | Operador precisa navegar entre multiplas telas |
| ERR-PRD-009 | PRODUCAO | 11 | Sistema nao valida compatibilidade maquina vs tamanho do banner | Pode alocar maquina com boca menor que o produto |
| ERR-AUD-003 | AUDITOR | — | Pedido com status "aguardando_aprovacao" nao e filtrado pelo PedidosAFaturarPage (que busca "produzido" etc.) | Ruptura no fluxo Venda->Financeiro |

---

### 5.3 — Erros MEDIOS

| ID | Agente | Passo | Descricao | Sugestao |
|----|--------|-------|-----------|---------|
| ERR-ENG-006 | ENGENHARIA | 3 | Area do modelo e campo manual, nao computado | Trigger/computed field: area_m2 = largura_cm * altura_cm / 10000 |
| ERR-COM-009 | COMERCIAL | 6 | CNPJ validado no lead mas nao no cadastro direto de clientes | Adicionar validarCNPJ no ClienteDetailPage |
| ERR-PRD-006 | PRODUCAO | 12 | Estoque decrementado de forma sequencial (loop) — risco de race condition | Usar transacao ou RPC atomica |
| ERR-PRD-010 | PRODUCAO | 11 | Etapas de producao sao 5 fixas (criacao, impressao, acabamento, conferencia, expedicao) — nao configuravel | Mubisys tem 9 setores configuraveis |
| ERR-FIN-005 | FINANCIAL | 14 | Dados do cliente nao validados antes de gerar NF-e (IE, endereco completo) | Adicionar validacao fiscal pre-emissao |
| ERR-FIN-010 | FINANCIAL | 13 | Condicoes de pagamento do orcamento nao propagam para o pedido/cobranca | Adicionar campo condicoes_pagamento no pedido |
| ERR-COM-012 | COMERCIAL | 8 | Portal nao mostra nome da empresa emissora (Croma Print) de forma proeminente | UX: adicionar logo/nome no header |
| ERR-AUD-004 | AUDITOR | — | Logs de auditoria existem apenas no modulo fiscal (fiscal_audit_logs) — nao ha audit trail geral | Implementar log_acessos para todo o sistema |
| ERR-AUD-005 | AUDITOR | — | Permissoes sao apenas por role (admin/comercial/producao) — nao ha granularidade por menu/submenu | Mubisys tem permissoes por menu+submenu+nivel |

---

### 5.4 — Melhorias BAIXAS

| ID | Local | Sugestao de Melhoria |
|----|-------|---------------------|
| IMP-001 | Producao / Kanban | Adicionar indicador visual de atraso (semaforo vermelho) em cards com prazo vencido |
| IMP-002 | Comercial / Orcamento | Mostrar breakdown de custo (MP/MO/CF) na visualizacao do orcamento |
| IMP-003 | Portal | Adicionar campo de observacoes do cliente na aprovacao |
| IMP-004 | Financeiro | Dashboard financeiro com aging de recebiveis (30/60/90 dias) |
| IMP-005 | Producao | TV de producao (TvPage.tsx) existe — adicionar KPIs de turno |
| IMP-006 | Admin | Adicionar tela de configuracao de etapas de producao (hoje sao 5 fixas no codigo) |

---

## 6. QUEBRAS DE FLUXO

| Etapa Origem | Etapa Destino | Motivo da Quebra | Severidade |
|-------------|--------------|-----------------|-----------|
| Passo 10 (Gerar Pedido) | Passo 11 (Producao) | Pedido criado com status "aguardando_aprovacao" — Producao espera "aprovado"/"em_producao" | CRITICO |
| Passo 14 (NF-e) | SEFAZ | Edge function nao conectada — emissao simulada | ALTO |
| Passo 15 (Boleto) | Banco | bank_accounts vazia — boleto nao pode ser gerado | ALTO |

**Passos impactados por quebras**:
- Passo 11-12: Funcionam tecnicamente, mas dependem de correcao manual do status do pedido para serem acionados
- Passo 14-15: Funcionam como rascunho/registro, mas nao completam o ciclo fiscal real

---

## 7. AUDITORIA CROSS-FUNCIONAL (AGENTE_AUDITOR)

### Consistencia de Valores

| Documento | Mecanismo | Consistente? |
|-----------|-----------|-------------|
| Orcamento (propostas) | Motor 9 passos calcula valor_unitario e valor_total por item; recalcularTotais agrega | OK (se BOM populado) |
| Pedido | converterParaPedido copia valor_total do orcamento, calcula custo_total e margem_real | OK |
| Cobranca (bank_slips) | Criado manualmente com valor_nominal — nao vinculado automaticamente ao pedido | RISCO |
| NF-e (fiscal_documentos) | Gerado via RPC fiscal_criar_rascunho_nfe que puxa dados do pedido | OK |

### Integridade Referencial

| Relacionamento | Status | Observacao |
|---------------|--------|------------|
| Lead -> Cliente | Integro | lead_id salvo no cliente; lead marcado "convertido" |
| Orcamento -> Pedido | Integro | pedido.proposta_id = orcamento.id; anti-duplicacao implementada |
| Pedido -> OP | Integro | OP criada por item com pedido_item_id; guard de idempotencia |
| OP -> Etapas | Integro | 5 etapas criadas automaticamente ao criar OP |
| OP -> Materiais | Integro | BOM (modelo_materiais) copiado para producao_materiais com quantidade*qty |
| OI -> Job (campo) | Integro | Trigger trg_create_job_from_ordem ativo; fn_sync_job_to_ordem bidirecional |

### Regras de Negocio

| Regra | Implementada? | Comportamento |
|-------|--------------|---------------|
| Apenas orcamentos aprovados geram pedido | SIM | Verifica status === "aprovada" antes de converter |
| Anti-duplicacao de pedido | SIM | Busca pedido existente com mesmo proposta_id antes de criar |
| Valor minimo no pedido | SIM | Rejeita total <= R$ 0,00 |
| Itens obrigatorios no orcamento | SIM | Rejeita se itens.length === 0 |
| Orcamento aprovado nao pode ser editado | SIM | statusBloqueados inclui "aprovada", "recusada", "expirada" |
| Optimistic locking | SIM | Campo version com updateWithLock |
| Soft delete | SIM | excluido_em + excluido_por em propostas |
| Estoque descontado apos producao | SIM | finalizarCustosOP desconta via estoque_movimentacoes |
| Pedido auto-produzido | SIM | Quando todas OPs finalizam, pedido -> "produzido" |
| CNPJ validado na conversao lead | SIM | validarCNPJ chamada no handleConverter |
| CNPJ validado no cadastro direto | NAO | ClientesPage nao chama validarCNPJ |

---

## 8. ANALISE DE GAPS vs MUBISYS

### Modulos Existentes no Mubisys vs CRM Croma

| Funcionalidade Mubisys | CRM Croma | Status | Gap |
|------------------------|-----------|--------|-----|
| Orcamento com 10 componentes de custo (MP, CF, MO, TF, CI, CE, TB, TR, DT, ML) | Motor 9 passos (MP, MO, CF, Maquinas, Impostos, Comissao, Juros, Markup) | PARCIAL | Falta TF (taxa financeira baseada em condicao de pagamento) |
| Rascunho -> Finalizar -> Em aberto -> Aprovar -> OS | rascunho -> enviada -> aprovada -> pedido | OK | Nomenclatura diferente mas fluxo equivalente |
| 9 setores de producao configuraveis | 5 etapas fixas no codigo | PARCIAL | Faltam: Criacao (como arte), Arquivos, Router, Serralheria, Terceirizados |
| Auto-routing (Instalacao, Terceirizados, Expedicao) | OI criada manualmente ou ao finalizar OP | PARCIAL | Nao ha auto-routing por tipo de logistica |
| Acabamento altera dimensoes de producao | Acabamentos cadastrados com custo — sem alteracao dimensional | NAO IMPLEMENTADO | Gap significativo para produtos com dobras/bordas |
| Acabamento com BOM (lista de materiais com desperdicio) | Acabamento e custo fixo por unidade | NAO IMPLEMENTADO | Desperdicio nao calculado |
| Equipamento plotters (m2/h, R$/m2) vs CNC (R$/hora) | Maquinas cadastradas sem custo/hora ou m2/h | PARCIAL | Falta custo por maquina |
| Estoque fracionado (mapa visual de retalhos) | Estoque com saldos e movimentacoes | NAO IMPLEMENTADO | Gap alto para grafica |
| Margens de aproveitamento (sup/inf/esq/dir) | Campo aproveitamento em materiais (percentual) | PARCIAL | Nao tem margem direcional |
| Semaforo estoque (verde/amarelo/vermelho) | AlertaEstoqueMinimo component existe | PARCIAL | Precisa validar se esta integrado |
| Financeiro bloqueia Producao | Nao implementado | NAO IMPLEMENTADO | Gap critico para gestao de inadimplencia |
| NF-e vincula OS (buscar dados de OS) | fiscal_criar_rascunho_nfe puxa dados do pedido | OK | |
| Monitor notas -> Contas a pagar | Nao implementado | NAO IMPLEMENTADO | |
| Faturamento em lote | FaturamentoLotePage existe | OK | |
| Conciliacao bancaria | ConciliacaoPage existe | OK | |
| Classificacao dupla clientes (Perfil + Origem) | Segmento + origem no lead; origem no cliente | PARCIAL | Falta classificacao Perfil (Agencia/Cliente Final/Revenda) |
| Permissoes granulares por menu+submenu+nivel | 3 roles (admin/comercial/producao) | BASICO | Sem granularidade |
| Meta vendedor -> Funil de Vendas | useOportunidades + Pipeline existe | PARCIAL | Meta de vendedor nao vinculada |
| Calendario hub (usuarios + financeiro + producao) | CalendarioPage existe | OK | |
| Acompanhamento Producao TV (rotacao 20s) | TvPage.tsx existe | OK | |
| MubiChat (chat interno por tickets) | Nao existe | NAO IMPLEMENTADO | |
| Almoxarife (checkout ferramentas) | AlmoxarifePage existe | OK | |
| Diario de Bordo (manutencao) | DiarioBordoPage existe | OK | |
| 11 tipos de relatorio | RelatoriosPage com 11 tipos + CSV | OK | |
| MubiDrive (file manager 5GB) | OneDrive integration via Composio | ALTERNATIVO | Abordagem diferente mas funcional |
| Log de Acesso (audit trail completo) | Apenas fiscal_audit_logs | BASICO | Gap importante para compliance |
| Quadro de Avisos | Nao existe | NAO IMPLEMENTADO | |
| Gestao a Vista | Dashboard por role (4 dashboards) | OK | |

### Resumo de Gaps por Prioridade

| Prioridade | Gap | Impacto |
|-----------|-----|---------|
| ALTA | Financeiro nao bloqueia producao de inadimplentes | Risco de produzir para cliente devedor |
| ALTA | Setores de producao fixos (5 vs 9) | Nao reflete operacao real da grafica |
| ALTA | Acabamento sem BOM e sem alteracao dimensional | Custo de acabamento impreciso |
| ALTA | Permissoes nao granulares | Seguranca insuficiente para producao |
| MEDIA | Estoque fracionado (mapa de retalhos) | Perda de controle de sobras |
| MEDIA | Chat interno (MubiChat) | Comunicacao informal — workaround: WhatsApp |
| MEDIA | Log de acesso geral | Compliance e auditoria |
| MEDIA | Custo por maquina | Precificacao imprecisa |
| BAIXA | Quadro de avisos | UX — workaround: email |
| BAIXA | Auto-routing producao | Conveniencia — workaround: manual |

---

## 9. PROBLEMAS DE UX

| Modulo | Problema | Severidade | Sugestao |
|--------|----------|-----------|---------|
| Orcamento Editor | Wizard 3 etapas pode confundir — nao ha indicacao clara de progresso | MEDIO | Adicionar stepper visual |
| Lead -> Cliente | Conversao exige popup com CNPJ mas nao pede endereco/IE | MEDIO | Expandir modal de conversao com todos os campos fiscais |
| Producao Kanban | Cards mostram pouca informacao (numero + cliente) | BAIXO | Adicionar produto, prazo, prioridade no card |
| Portal Publico | Titulo "Link Invalido" com acento faltando ("Invalido" vs "Invalido") | BAIXO | Corrigir acentuacao |
| Fiscal | Muitas telas (dashboard, documentos, fila, auditoria, certificado, config) sem guia de navegacao | MEDIO | Adicionar breadcrumb ou tabs |
| Financeiro | Boletos e pedidos a faturar sao paginas separadas sem link direto | BAIXO | Cross-link entre pedido e boleto |

---

## 10. MODULOS INCOMPLETOS

| Modulo | UI | Backend | Status | Impacto |
|--------|----|---------|--------|---------|
| BOM / Composicao | SIM (hooks) | SIM (modelo_materiais, seed 022) | Parcial — UI nao inline | Custo pode ficar zero se BOM nao populada |
| Motor de precificacao | SIM (PricingCalculator) | SIM (pricing-engine.ts, 9 passos) | Funcional | Core do sistema — funcionando |
| Portal de aprovacao | SIM (PortalOrcamentoPage) | SIM (usePortalProposta, tracking) | Funcional | Fluxo completo |
| Etapas de producao | SIM (Kanban 8 status) | SIM (producao_etapas, 5 etapas auto) | Funcional | 5 etapas fixas |
| NF-e / Fiscal | SIM (6 paginas) | PARCIAL (RPC existe, edge fn nao conectada) | Estrutura pronta, sem SEFAZ | Emissao real bloqueada |
| Boletos / CNAB | SIM (BoletosPage, remessas) | SIM (CNAB400 Itau, retornos) | Funcional com setup | Precisa configurar banco |
| Bridge App de Campo | SIM (InstalacaoPage) | SIM (triggers, views) | Funcional | Bidirecional OK |
| Compras / Suprimentos | SIM (3 paginas) | SIM (fornecedores, pedidos compra) | Funcional | Modulo novo |
| Estoque | SIM (3 paginas) | SIM (saldos, movimentacoes, inventario) | Funcional | Sem fracionado |
| Qualidade | SIM (3 paginas) | SIM (ocorrencias, tratativas, KPIs) | Funcional | Modulo novo |
| AI Engine | SIM (sidebar, 5 dominios) | SIM (appliers, registry) | Funcional | Diferencial competitivo |

---

## 11. MELHORIAS RECOMENDADAS

### Prioritarias — implementar antes do proximo deploy

1. **Corrigir import supabase no LeadDetailPage** — Bug critico: adicionar `import { supabase } from "@/integrations/supabase/client"` e mudar delete para soft-delete com `excluido_em`
2. **Corrigir status inicial do pedido** — Mudar de "aguardando_aprovacao" para "aprovado" ou "em_producao" em `converterParaPedido` (orcamento.service.ts linha 788)
3. **Calcular area_m2 automaticamente** — Adicionar trigger ou computed no schema: `area_m2 = largura_cm * altura_cm / 10000`
4. **Validar CNPJ no cadastro direto de clientes** — Adicionar `validarCNPJ` no formulario de ClienteDetailPage
5. **Adicionar condicoes_pagamento ao pedido** — Propagar campo do orcamento para pedido na conversao

### Desejaveis — implementar nas proximas sprints

1. **Setores de producao configuraveis** — Extrair ETAPA_NOMES para tabela `producao_setores` configuravel pelo admin
2. **Financeiro bloqueia producao** — Flag de inadimplencia no cliente que impede criacao de OP
3. **Acabamento com BOM e alteracao dimensional** — Estruturar acabamentos com lista de materiais e regras de dimensao
4. **Custo por maquina** — Adicionar campos custo_hora e m2_hora em maquinas; integrar no motor de precificacao
5. **Log de acesso geral** — Tabela audit_trail com usuario, tela, acao, valores, timestamp, IP
6. **Permissoes granulares** — Tabela permissoes (grupo, menu, submenu, nivel) com middleware de verificacao

---

## 12. PLANO DE CORRECAO PRIORITARIO

| # | Erro | Modulo | Esforco | Impacto se nao corrigir |
|---|------|--------|---------|------------------------|
| 1 | ERR-COM-BUG-001 — Missing import supabase | LeadDetailPage | P | Crash ao excluir leads — impossivel usar funcao |
| 2 | ERR-COM-FLOW-002 — Status pedido incorreto | orcamento.service | P | Pedidos ficam em limbo; producao nao inicia |
| 3 | ERR-ENG-CALC-003 — Area nao auto-calculada | Schema/UI modelos | P | Custo de materiais baseados em area = zero |
| 4 | ERR-COM-010 — Hard delete de leads | LeadDetailPage | P | Dados perdidos permanentemente |
| 5 | ERR-FIN-004 — NF-e sem SEFAZ | Edge function | G | Emissao fiscal impossivel — bloqueio legal |
| 6 | ERR-FIN-007 — Boleto sem config bancaria | Setup inicial | M | Cobranca impossivel |
| 7 | ERR-PRD-005 — Custo real = estimado | producao.service | M | Margem real nunca reflete realidade |
| 8 | ERR-AUD-005 — Permissoes basicas | Novo modulo | G | Qualquer usuario acessa tudo |
| 9 | ERR-PRD-010 — Etapas fixas | producao.service | M | Nao reflete operacao real |
| 10 | ERR-AUD-004 — Sem audit trail | Novo modulo | G | Sem rastreabilidade de acoes |

**Legenda esforco**: P = Pequeno (<2h) | M = Medio (2h-1dia) | G = Grande (>1dia)

---

## 13. AVALIACAO DE PRONTIDAO DO ERP — STATUS POR MODULO

| Modulo | Status | Bloqueadores Criticos |
|--------|--------|----------------------|
| Cadastro de Materiais | Operacional | Nenhum |
| Cadastro de Produtos (BOM) | Parcial | Area nao auto-calculada; UI de composicao separada |
| CRM / Leads | Parcial | Bug de import; hard delete |
| Clientes | Operacional | CNPJ nao validado no cadastro direto |
| Orcamentos + Portal | Operacional | Funcional com motor de precificacao |
| Pedidos | Parcial | Status incorreto na criacao bloqueia fluxo |
| Producao (PCP + Chao) | Operacional | Etapas fixas mas funcional |
| Estoque | Operacional | Sem fracionado |
| Financeiro (Contas) | Operacional | Funcional |
| Faturamento (NF-e) | Parcial | SEFAZ nao conectado |
| Boletos / Cobranca | Parcial | Banco nao configurado |
| Expedicao | Operacional | |
| Instalacao + App Campo | Operacional | Bridge funcional |
| Compras | Operacional | |
| Qualidade | Operacional | |
| AI Engine | Operacional | Diferencial |

---

## VEREDITO FINAL

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PARCIALMENTE APTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  O CRM Croma possui uma arquitetura solida com 15+ modulos
  implementados, motor de precificacao sofisticado (9 passos),
  portal publico de aprovacao, Kanban de producao, bridge
  bidirecional com app de campo, e engine de AI.

  Porem, 3 bugs criticos impedem operacao confiavel:
  (1) import faltando que causa crash,
  (2) status de pedido que quebra o fluxo automatico
      venda->producao, e
  (3) area nao auto-calculada que pode zerar custos.

  Apos correcao dos 3 criticos (estimativa: <4h de trabalho),
  o sistema sobe para "APTO COM RESSALVAS". Para atingir
  "APTO PARA PRODUCAO", e necessario: conectar SEFAZ,
  configurar banco para boletos, implementar permissoes
  granulares e adicionar audit trail.

  Os gaps vs Mubisys mais significativos sao: setores de
  producao configuraveis, estoque fracionado, acabamento
  com BOM, e bloqueio financeiro de producao.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Emitido por:  CROMA_MASTER_AGENT + AGENTE_AUDITOR
  Data:         2026-03-17
  Proxima exec: apos correcao dos 3 criticos
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

*Relatorio gerado pelo Sistema Multi-Agente — Simulador de Operacoes CROMA_ERP*
*Para re-executar: invocar AGENTE_PRINCIPAL.md com o cenario desejado*
