# AUDITORIA DE LOGICA DE NEGOCIO — Croma Print ERP/CRM

> **Data**: 2026-03-22
> **Auditor**: Claude Opus 4.6 (Business Logic & QA)
> **Escopo**: Fluxo E2E Lead -> Faturamento, integracao entre modulos, transicoes de status

---

## SCORES

| Dimensao | Nota | Justificativa |
|---|---|---|
| **Logica de Negocio** | **7.5 / 10** | Motor Mubisys solido, conversao orcamento->pedido completa, mas lacunas na cadeia lead->proposta e duplicacao de logica em conclusao |
| **Integracao de Fluxos** | **6.5 / 10** | Handoffs pedido->producao->financeiro funcionam, mas sao orquestrados no frontend (fragil). Instalacao->conclusao tem path duplicado com logica inconsistente |

---

## 1. LEAD MANAGEMENT FLOW

### 1.1 Lead CRUD
**Status**: FUNCIONAL

- `useLeads.ts` implementa CRUD completo com filtros por status, temperatura, vendedor e busca textual.
- 7 status definidos: `novo`, `contatado`, `qualificado`, `proposta_enviada`, `negociando`, `convertido`, `perdido`.
- 3 temperaturas: `frio`, `morno`, `quente`.
- Soft delete implementado corretamente com `excluido_em` + `excluido_por`.
- Validacao de email e telefone brasileiro no save.

### 1.2 Lead -> Cliente Conversion
**Status**: FUNCIONAL COM SALVAGUARDAS

A conversao em `LeadDetailPage.tsx` (linhas 130-202):
1. Valida empresa nao-vazia.
2. Valida CNPJ (opcional, validarCNPJ).
3. Verifica CNPJ duplicado (bloqueio obrigatorio).
4. Verifica razao social duplicada (aviso com confirmacao).
5. Cria cliente via `createCliente.mutateAsync()` com `origem: "lead_convertido"` e `lead_id`.
6. Atualiza lead para status `convertido`.
7. Navega para `/clientes/{id}`.

**Achado positivo**: O `lead_id` e persistido no cliente, mantendo rastreabilidade.

### 1.3 Lead -> Proposta/Orcamento Link
**Status**: CADEIA QUEBRADA (MEDIUM)

| Esperado | Implementado |
|---|---|
| Lead gera oportunidade que referencia proposta | `Oportunidade` tem `lead_id`, `Proposta` tem `oportunidade_id`, mas **nenhuma UI conecta lead diretamente a proposta** |
| Ao converter lead, oferecer criar orcamento | Conversao vai para `/clientes/{id}` sem sugerir criacao de orcamento |

**Detalhes**: A entidade `oportunidades` existe com `lead_id` e a proposta tem `oportunidade_id`, mas:
- A `LeadDetailPage` nao tem botao "Criar Orcamento" nem lista propostas vinculadas.
- O status `proposta_enviada` do lead nao e atualizado automaticamente quando uma proposta e criada para o cliente convertido.
- Nao ha query na LeadDetailPage que busque propostas do cliente convertido para exibir historico.

---

## 2. PRICING ENGINE (MUBISYS)

### 2.1 Motor de Precificacao
**Status**: SOLIDO E BEM DOCUMENTADO

O `pricing-engine.ts` implementa os 9 passos Mubisys fielmente:

1. **Vmp** — Soma (quantidade x preco) dos materiais
2. **T** — Soma tempo produtivo em minutos
3. **P%** — `(custoOperacional - custoProdutivo) * 100 / faturamentoMedio`
4. **Cm** — Custo por minuto: `(custoProdutivo * (1 + encargos)) / qtdFunc / horasMes / 60`
5. **Pv** — `(comissao + impostos + juros) / 100`
6. **Vb** — `(MP + MO + Maquinas + Depreciacao + Usinagem) * (1 + P%/100)`
7. **Vam** — `Vb / (1 - Pv)`
8. **Vm** — `Vam * (markup/100)`
9. **Vv** — `Vam + Vm`

**Achado positivo**: Inclui `calcMarkupReverso`, `calcMargemReal`, `simularDesconto`, `calcBreakEven` — ferramentas analiticas completas.

### 2.2 Integracao com Dados Reais
**Status**: FUNCIONAL

- `orcamento-pricing.service.ts` serve como ponte entre motor e UI.
- `calcPrecoFromModeloId()` busca BOM (`modelo_materiais`), processos (`modelo_processos`), markup (`produto_modelos`), e config (`config_precificacao`) em paralelo.
- Usa `preco_medio` dos materiais da tabela `materiais` (467 registros seedados).
- Aproveitamento de material: `100 - percentual_desperdicio`, fallback 85%.
- Setup time diluido pela quantidade: `tempo_setup / max(1, qty)`.

### 2.3 Regras de Precificacao
**Status**: FUNCIONAL

- 11 categorias em `regras_precificacao`.
- `sugerirMarkup()` busca regra por categoria, fallback para 'geral', fallback 40%.
- `validarMarkup()` alerta quando abaixo do minimo.
- `validarDesconto()` verifica limite maximo + flag `requer_aprovacao`.

### 2.4 Config Snapshot
**Status**: BOA PRATICA

- Ao criar orcamento, `buildConfigSnapshot()` captura os custos fixos do momento em `config_snapshot`.
- Garante que orcamentos antigos nao sejam afetados por mudancas futuras na config.

### FINDING — MEDIUM: DEFAULT_PRICING_CONFIG como fallback silencioso

Em `buildConfigSnapshot()` (orcamento.service.ts linha 36), se a query falhar, o fallback usa `DEFAULT_PRICING_CONFIG` sem avisar o usuario. Isso pode levar a precos incorretos se a config do banco nao existir.

```
catch {
  // Fallback intencional: config nao disponivel, usar defaults sem bloquear
}
```

---

## 3. QUOTE/PROPOSAL FLOW (ORCAMENTO)

### 3.1 CRUD de Orcamento
**Status**: COMPLETO

- `orcamentoService` em `orcamento.service.ts` implementa:
  - Listagem com filtros (status, cliente, vendedor, busca, datas).
  - Busca por ID com nested select otimizado (2 queries paralelas ao inves de N+1).
  - Criacao com numero atomico via trigger `trg_proposta_numero`.
  - Atualizacao com lock otimista (`updateWithLock`).
  - Soft delete.

### 3.2 Itens com BOM Detalhado
**Status**: COMPLETO

- `adicionarItemDetalhado()` insere item + materiais + acabamentos + processos em sequencia.
- `atualizarItemDetalhado()` faz DELETE + INSERT para sub-registros (replace all).
- `recalcularTotais()` soma itens + servicos e aplica desconto percentual.

### 3.3 Status Orcamento
**Status**: BEM DEFINIDO

6 status: `rascunho`, `enviada`, `em_revisao`, `aprovada`, `recusada`, `expirada`.

**Guard implementado** (linha 340): Impede edicao de orcamentos em status `aprovada`, `recusada`, `expirada` — exceto para mudanca de status propria.

### 3.4 Conversao Orcamento -> Pedido
**Status**: ROBUSTO

`converterParaPedido()` (linha 746):
1. Valida status = `aprovada` (unico status permitido).
2. Valida que tem itens e valor > 0.
3. Anti-duplicacao: verifica se ja existe pedido para este orcamento.
4. Numero atomico via `gerar_numero_pedido` (sequence Postgres).
5. Duplica itens com campos tecnicos (custo_mp, custo_mo, markup).
6. Calcula `custo_total` e `margem_real` do pedido.

**Achado positivo**: Lock otimista + idempotencia + numero atomico = conversao segura.

### 3.5 Portal do Cliente
**Status**: FUNCIONAL

- Rota `/p/:token` em `PortalOrcamentoPage.tsx`.
- `usePortalProposta.ts` para fetch publico.
- Tracking comportamental de visualizacao.

### FINDING — LOW: Duplicacao de orcamento nao copia processos

Em `duplicar()` (linha 652), os processos (`proposta_item_processos`) nao sao copiados porque `adicionarItemDetalhado` recebe `materiais` e `acabamentos` do item original, mas a busca por ID via `buscarPorId()` nao faz join em `proposta_item_processos`. Os processos sao perdidos na copia.

---

## 4. ORDER/PRODUCTION FLOW

### 4.1 Pedido Status Map
**Status**: COMPLETO E BEM GUARDADO

10 status com mapa de transicoes explicito em `PedidoDetailPage.tsx`:

```
rascunho              -> [aguardando_aprovacao]
aguardando_aprovacao  -> [aprovado, cancelado]
aprovado              -> [em_producao, cancelado]
em_producao           -> [produzido, parcialmente_concluido, cancelado]
parcialmente_concluido-> [em_producao, produzido, cancelado]
produzido             -> [aguardando_instalacao, concluido, cancelado]
aguardando_instalacao -> [em_instalacao, cancelado]
em_instalacao         -> [concluido, cancelado]
concluido             -> [faturado]
faturado              -> []
```

Guards implementados:
- **Aprovado -> Em Producao**: Cria OPs automaticamente.
- **Em Producao -> Produzido**: Verifica que TODAS as OPs estao finalizadas.
- **-> Concluido**: Verifica NF-e (dialogo se ausente), gera contas a receber + parcelas + comissao.

### 4.2 Criacao de Ordem de Producao
**Status**: COMPLETO

`criarOrdemProducao()` em `producao.service.ts`:
1. Guard de idempotencia (nao cria OPs duplicadas).
2. Uma OP por item do pedido.
3. 5 etapas padrao: criacao, impressao, acabamento, conferencia, expedicao.
4. Popula `producao_materiais` a partir da BOM (`modelo_materiais`).
5. Reserva materiais no estoque (`reservarMateriais`).

### 4.3 Finalizacao de OP
**Status**: COMPLETO

`finalizarCustosOP()`:
1. Atualiza custos reais = estimados (simplificacao aceita).
2. Baixa materiais consumidos (saida no estoque).
3. Atualiza saldo em `estoque_saldos`.
4. Auto-verifica se todas OPs do pedido estao concluidas -> atualiza pedido para `produzido`.

### 4.4 Producao -> Instalacao
**Status**: FUNCIONAL

- Ao concluir ultima etapa da OP, abre dialogo para designar instalador.
- `criarOrdemInstalacao()` cria OS com ou sem agendamento.
- Numero gerado: `OS-YYYY-NNNN`.

### FINDING — HIGH: Dupla atualizacao de status pedido para "produzido"

Dois caminhos distintos atualizam o pedido para "produzido":

1. **`finalizarCustosOP()`** (producao.service.ts linha 179): `atualizarStatusPedidoSeTodasOpsConcluidas()` — verifica OPs pendentes e atualiza via `.not('status', 'in', '("finalizado","cancelada")')`.

2. **`ProducaoPage.tsx`** (linha 720-724): Ao completar todas as etapas, atualiza diretamente: `await supabase.from("pedidos").update({ status: "produzido" }).eq("id", op.pedido_id)` — **sem verificar se existem outras OPs pendentes**.

**Impacto**: O path 2 pode marcar o pedido como "produzido" mesmo que existam outras OPs nao-finalizadas de outros itens do mesmo pedido. O path 1 tem o guard correto. O path 2 e uma **race condition** com resultado incorreto.

### FINDING — MEDIUM: Status OP "liberado" vs "finalizado" — inconsistencia

- A ProducaoPage.tsx (linha 710) atualiza OP para `status: "liberado"` quando todas etapas concluidas.
- Mas `atualizarStatusPedidoSeTodasOpsConcluidas()` verifica `.not('status', 'in', '("finalizado","cancelada")')`.
- O status "liberado" NAO e "finalizado", entao a verificacao do guard nao considera a OP como concluida.
- Isso significa que `finalizarCustosOP` chama o guard mas ele nunca ativaria porque a OP esta como "liberado", nao "finalizado".
- O path que funciona e o direto da ProducaoPage.

---

## 5. FINANCIAL FLOW

### 5.1 Geracao de Contas a Receber
**Status**: FUNCIONAL

`gerarContasReceber()` em `financeiro-automation.service.ts`:
1. Guard de idempotencia.
2. Busca condicoes de pagamento da proposta vinculada.
3. Calcula vencimento com base na forma de pagamento.
4. Cria registro em `contas_receber`.

### 5.2 Geracao de Parcelas
**Status**: FUNCIONAL

`gerarParcelas()`:
- Suporta 5 formas: `pix`, `boleto_vista`, `boleto_parcelado`, `cartao`, `entrada_parcelas`, `prazo_ddl`.
- Calcula valores e datas corretamente.

### 5.3 Geracao de Comissao
**Status**: FUNCIONAL COM RESSALVAS

`gerarComissao()`:
- Guard de idempotencia.
- Busca `percentual_comissao` da proposta, fallback 5%.
- Silencioso em erros (nao bloqueia fluxo principal).

### 5.4 Boleto/CNAB 400
**Status**: IMPLEMENTADO (nao auditado em detalhe nesta sessao)

Servicos presentes: `boleto.service.ts`, `cnab400-itau.service.ts`, `cnab400-retorno.service.ts`, `remessa.service.ts`, `retorno-processor.service.ts`.

### 5.5 Baixa de Pagamento
**Status**: FUNCIONAL

`useBaixaConta()` em `useContasReceber.ts`:
- Calcula novo valor pago, saldo, e status (pago vs parcial).
- Usa timezone Brazil (`America/Sao_Paulo`) para datas.

### FINDING — HIGH: Comissao nao gerada no path de conclusao via Instalacao

Comparando os dois paths de conclusao de pedido:

| Path | Local | gerarContasReceber | gerarParcelas | gerarComissao |
|---|---|---|---|---|
| **PedidoDetailPage** (linha 179-181) | Concluir direto | SIM | SIM | SIM |
| **InstalacaoPage** (linha 756-757) | Concluir via instalacao | SIM | SIM | **NAO** |

**Impacto**: Quando um pedido e concluido via modulo de instalacao (o fluxo normal para pedidos com instalacao), a comissao do vendedor **nunca e gerada**. Isso representa perda financeira sistematica para os vendedores.

### FINDING — MEDIUM: Conclusao via instalacao nao verifica NF-e

O `PedidoDetailPage` verifica se existe NF-e antes de concluir (linhas 244-258), mostrando dialogo de confirmacao se ausente. A `InstalacaoPage` (linhas 747-758) conclui direto sem verificar NF-e, podendo fechar pedidos sem documentacao fiscal.

---

## 6. CROSS-MODULE INTEGRATION POINTS

### 6.1 Mapa de Handoffs

```
Lead ──[converter]──> Cliente
  |                      |
  | (QUEBRADO)           |
  v                      v
Oportunidade ───> Orcamento ──[aprovar+converter]──> Pedido
                                                       |
                                                  [iniciar producao]
                                                       |
                                                       v
                                                    OP(s) + Etapas
                                                       |
                                                  [finalizar etapas]
                                                       |
                                                       v
                                                  OS Instalacao
                                                       |
                                                  [concluir]
                                                       |
                                                       v
                                                Contas Receber + Parcelas + Comissao*
                                                       |
                                                       v
                                                    NF-e + Faturamento
```

### 6.2 Cadeias Verificadas

| Handoff | Status | Observacao |
|---|---|---|
| Lead -> Cliente | OK | `lead_id` persistido, CNPJ validado, dedup verificado |
| Lead -> Oportunidade | PARCIAL | Entidade existe mas UI nao conecta |
| Lead -> Orcamento | QUEBRADO | Nenhum link direto |
| Orcamento -> Pedido | OK | Robusto com guards |
| Pedido -> OP | OK | Idempotente, reserva estoque |
| OP -> Etapas | OK | 5 etapas padrao criadas |
| OP -> Instalacao | OK | Designacao via dialogo |
| Pedido -> Contas Receber | OK | Idempotente |
| Pedido -> Comissao | PARCIAL | Funciona no path direto, falha no path de instalacao |
| Pedido -> NF-e | OK | Verificacao antes de concluir (path direto) |

### 6.3 Orquestracao no Frontend — Risco Arquitetural

Todas as automacoes de handoff sao disparadas por codigo React no frontend:
- `PedidoDetailPage.tsx` chama `criarOrdemProducao()`, `gerarContasReceber()`, `gerarComissao()`.
- `ProducaoPage.tsx` chama `finalizarCustosOP()`, `criarOrdemInstalacao()`.
- `InstalacaoPage.tsx` chama `gerarContasReceber()`.

**Risco**: Se o usuario fechar o navegador apos o UPDATE de status mas antes da execucao dos side-effects, os dados ficam inconsistentes. Idealmente, esses side-effects deveriam ser triggers do banco ou Edge Functions.

---

## 7. STATUS TRANSITION MAP COMPLETO

### 7.1 Lead Status

| Status | Transicao Para | Guard |
|---|---|---|
| `novo` | Qualquer (sem guard) | Nenhum |
| `contatado` | Qualquer | Nenhum |
| `qualificado` | Qualquer | Nenhum |
| `proposta_enviada` | Qualquer | Nenhum |
| `negociando` | Qualquer | Nenhum |
| `convertido` | N/A (terminal) | Botao escondido |
| `perdido` | N/A (terminal) | Botao escondido |

**FINDING — MEDIUM**: Leads nao tem guard de transicao. Qualquer status pode ir para qualquer outro via edicao. Nao ha `VALID_TRANSITIONS` como nos pedidos.

### 7.2 Orcamento/Proposta Status

| Status | Descricao | Guard |
|---|---|---|
| `rascunho` | Editavel | Padrao ao criar |
| `enviada` | Enviada ao cliente | Nenhum explicito |
| `em_revisao` | Cliente pediu alteracoes | Nenhum explicito |
| `aprovada` | Aprovada | Permite conversao em pedido |
| `recusada` | Recusada | Bloqueia edicao |
| `expirada` | Validade vencida | Bloqueia edicao |

**FINDING — MEDIUM**: Nao ha `VALID_TRANSITIONS` para propostas. O unico guard e o bloqueio de edicao para status terminais. Um orcamento "recusada" pode voltar para "rascunho" via update direto.

### 7.3 Pedido Status

| Status | Transicao Para | Guard |
|---|---|---|
| `rascunho` | `aguardando_aprovacao` | Nenhum |
| `aguardando_aprovacao` | `aprovado`, `cancelado` | Nenhum |
| `aprovado` | `em_producao`, `cancelado` | Cria OPs ao avancar |
| `em_producao` | `produzido`, `parcialmente_concluido`, `cancelado` | Verifica OPs finalizadas |
| `parcialmente_concluido` | `em_producao`, `produzido`, `cancelado` | Nenhum |
| `produzido` | `aguardando_instalacao`, `concluido`, `cancelado` | NF-e verificada para concluir |
| `aguardando_instalacao` | `em_instalacao`, `cancelado` | Nenhum |
| `em_instalacao` | `concluido`, `cancelado` | NF-e + gera financeiro |
| `concluido` | `faturado` | Nenhum |
| `faturado` | (terminal) | — |
| `cancelado` | (terminal) | Requer motivo |

**Status bem guardado**. Melhor implementacao do sistema.

### 7.4 Ordem de Producao Status

| Status | Descricao |
|---|---|
| `aguardando_programacao` | Criada, aguardando inicio |
| `em_fila` | Na fila de producao |
| `em_producao` | Em execucao |
| `em_acabamento` | Na etapa de acabamento |
| `em_conferencia` | Em conferencia final |
| `liberado` | Liberada para expedicao |
| `retrabalho` | Voltou para correcao |
| `finalizado` | Concluida |

**FINDING — HIGH**: Inconsistencia `liberado` vs `finalizado` (detalhado na secao 4).

### 7.5 Ordem de Instalacao Status

| Status | Descricao |
|---|---|
| `aguardando_agendamento` | Criada, sem agenda |
| `agendada` | Agendada com instalador |
| `equipe_em_deslocamento` | Equipe a caminho |
| `em_execucao` | Em andamento |
| `pendente` | Parada por algum motivo |
| `reagendada` | Reagendada |
| `concluida` | Finalizada |
| `nao_concluida` | Finalizada sem conclusao |

---

## 8. FINDINGS POR SEVERIDADE

### CRITICAL (0)

Nenhum finding critico identificado. Os dados persistem corretamente nos caminhos principais.

### HIGH (3)

| # | Finding | Modulo | Impacto |
|---|---|---|---|
| H-01 | **Comissao nao gerada no path de conclusao via Instalacao** | Financeiro/Instalacao | Vendedores perdem comissao em pedidos concluidos via instalacao (fluxo principal para produtos que requerem instalacao) |
| H-02 | **Dupla atualizacao de status pedido para "produzido"** | Producao | ProducaoPage.tsx atualiza sem verificar OPs pendentes de outros itens — pode marcar pedido como produzido prematuramente |
| H-03 | **Inconsistencia status OP "liberado" vs "finalizado"** | Producao | `finalizarCustosOP` define a OP como "liberado" mas o guard verifica "finalizado". Os dois paths se contradizem — o auto-advance via `atualizarStatusPedidoSeTodasOpsConcluidas` nunca funciona corretamente |

### MEDIUM (5)

| # | Finding | Modulo | Impacto |
|---|---|---|---|
| M-01 | **Lead nao conecta a orcamento** | Comercial | Cadeia Lead->Proposta quebrada — nao ha botao "Criar Orcamento" na LeadDetailPage nem rastreamento de propostas vinculadas |
| M-02 | **Leads sem guard de transicao de status** | Comercial | Qualquer status pode ir para qualquer outro via edicao, sem restricao |
| M-03 | **Propostas sem guard de transicao de status** | Comercial | Sem `VALID_TRANSITIONS` — proposta recusada pode voltar a rascunho via update |
| M-04 | **DEFAULT_PRICING_CONFIG como fallback silencioso** | Precificacao | Se config_precificacao nao existir no banco, orcamentos usam valores padrao sem avisar usuario |
| M-05 | **Conclusao via Instalacao nao verifica NF-e** | Fiscal/Instalacao | Pedidos podem ser concluidos via instalacao sem documentacao fiscal |

### LOW (2)

| # | Finding | Modulo | Impacto |
|---|---|---|---|
| L-01 | **Duplicacao de orcamento nao copia processos** | Comercial | `proposta_item_processos` nao sao copiados no `duplicar()` — processos perdidos |
| L-02 | **Orquestracao no frontend** | Arquitetura | Side-effects (gerar contas, comissao, OPs) disparados no browser — fragil a interrupcoes de rede/sessao |

---

## 9. RECOMENDACOES PRIORITARIAS

### Imediato (proxima sprint)

1. **H-01**: Adicionar `gerarComissao(os.pedido_id)` em `InstalacaoPage.tsx` apos `gerarParcelas()` (1 linha).
2. **H-02**: Remover atualizacao direta em `ProducaoPage.tsx` linha 720-724. Confiar apenas no `atualizarStatusPedidoSeTodasOpsConcluidas()` que ja tem o guard correto.
3. **H-03**: Alinhar status: apos `finalizarCustosOP`, atualizar OP para `"finalizado"` ao inves de `"liberado"`, OU alterar o guard para incluir `"liberado"` na lista de status concluidos.

### Curto prazo

4. **M-01**: Adicionar secao "Propostas vinculadas" na LeadDetailPage + botao "Criar Orcamento" que pre-preenche o cliente convertido.
5. **M-03**: Implementar `VALID_TRANSITIONS` para propostas (similar ao pedido).
6. **M-05**: Adicionar verificacao de NF-e na InstalacaoPage antes de concluir.

### Medio prazo

7. **L-02**: Migrar side-effects criticos (gerarContasReceber, gerarComissao, criarOrdemProducao) para triggers Postgres ou Edge Functions, eliminando dependencia do frontend.
8. **M-04**: Ao detectar que config_precificacao e DEFAULT, exibir banner de alerta no OrcamentoEditorPage.

---

## 10. CHECKLIST DE INTEGRIDADE E2E

| Etapa do Fluxo | Dados Persistidos | Automacao | Status |
|---|---|---|---|
| Lead criado | leads | — | OK |
| Lead -> Cliente | clientes (lead_id) | Status -> convertido | OK |
| Cliente -> Orcamento | propostas (cliente_id) | Config snapshot | OK |
| Item adicionado | proposta_itens + materiais + acabamentos | Pricing engine | OK |
| Orcamento aprovado | propostas.status = aprovada | — | OK |
| Orcamento -> Pedido | pedidos + pedido_itens | Numero atomico, anti-dedup | OK |
| Pedido -> Producao | ordens_producao + etapas + materiais | Reserva estoque | OK |
| Producao finalizada | custos reais, estoque baixado | Auto-advance pedido | PARCIAL (H-02, H-03) |
| Producao -> Instalacao | ordens_instalacao | Designacao instalador | OK |
| Conclusao (direto) | contas_receber + parcelas + comissao | NF-e check | OK |
| Conclusao (instalacao) | contas_receber + parcelas | **Comissao faltando** | FALHA (H-01) |
| NPS | nps_respostas | Fire-and-forget | OK |
| NF-e | fiscal_documentos | Manual via botao | OK |

---

*Fim do relatorio. Gerado em 2026-03-22 por auditoria automatizada de logica de negocio.*
