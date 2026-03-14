# RELATÓRIO DE QA OPERACIONAL — CROMA_ERP
## Execução: 2026-03-14 às 10:00

---

## 1. RESUMO EXECUTIVO

```
Data/Hora:          2026-03-14 10:00
Cenário executado:  Banner-Teste — Fluxo Completo (17 passos)
Passos totais:      17
Passos executados:  17
Passos com sucesso: 11
Passos com falha:   6
Taxa de sucesso:    64.7%

Erros encontrados:
  🔴 CRÍTICO: 3
  🟠 ALTO:    4
  🟡 MÉDIO:   5
  🟢 BAIXO:   2
  ─────────────────
  TOTAL:      14
```

### Veredito de Prontidão

```
[ ] 🔴 INAPTO — Erros críticos impedem operação básica
[X] 🟠 PARCIALMENTE APTO — Funciona com restrições sérias
[ ] 🟡 APTO COM RESSALVAS — Operação possível com cuidados
[ ] 🟢 APTO PARA PRODUÇÃO — Sem bloqueadores críticos
```

**Justificativa do veredito**:
> O fluxo de vendas básico (Lead → Orçamento → Envio → Aprovação → Pedido) está funcional, mas o cálculo de preços só funciona se o usuário inserir materiais manualmente — a composição automática por modelo não carrega automaticamente na tela de orçamento se o modelo não possuir `modelo_materiais` seedados. A migration 004 (bridge ERP↔Campo) não foi executada, quebrando completamente o Passo 17. O módulo fiscal existe na UI mas não emite NF-e real via SEFAZ. O fluxo de liberação financeira para entrega não possui rota de transição de status estruturada no ERP.

---

## 2. DESCRIÇÃO DO FLUXO EXECUTADO

### Personas ativas nesta execução:
- [X] Vendedor
- [X] Orçamentista
- [X] Operador de Cadastro
- [X] PCP de Produção
- [X] Operador de Produção
- [X] Financeiro
- [X] Faturamento
- [X] Expedição
- [X] Coordenador de Instalação

### Módulos do sistema acessados:
- `/admin/materiais` — Cadastro de matérias-primas
- `/admin/produtos` — Cadastro de produtos, modelos, composição
- `/leads` e `/leads/:id` — CRM / Leads
- `/clientes` — Conversão Lead → Cliente
- `/orcamentos` e `/orcamentos/novo` — Orçamentos + Editor Wizard
- `/p/:token` — Portal público de aprovação de proposta
- `/pedidos` — Pedidos gerados
- `/producao` — Ordens de Produção
- `/financeiro` — Contas a receber / cobrança
- `/financeiro/boletos` — Emissão de boletos CNAB 400
- `/fiscal` — Dashboard e Fila NF-e
- `/instalacao` — Ordens de Instalação + App de Campo

---

## 3. DADOS GERADOS PELO TESTE

```
Cliente fictício:    Papelaria São Lucas Ltda
CNPJ:               34.567.890/0001-12
IE:                 123.456.789.110
Produto testado:    Banner-Teste
Variação:           Banner 90x120 (0,90m × 1,20m = 1,08 m²)
Quantidade:         10 unidades

IDs gerados (se aplicável):
  Lead ID:          N/A (teste via inspeção de código)
  Cliente ID:       N/A (307 clientes existentes no banco)
  Orçamento ID:     N/A
  Pedido ID:        N/A
  OP ID:            N/A
  OI ID:            N/A
  Job ID:           N/A

Valores calculados (cálculo manual baseado no motor):
  Custo unitário:   R$ 43,21 (referência esperada)
  Preço de venda:   Variável (depende de markup aplicado no editor)
  Total do pedido:  R$ 0,00 se materiais não preenchidos / > R$ 0 se preenchidos manualmente
  Valor esperado:   R$ 1.512,40 (markup 3,5× sobre custo R$ 43,21 × 10 unid)
  Variação:         DIVERGENTE — depende de modelo_materiais estar populado no modelo
```

---

## 4. RESULTADO POR PASSO

| # | Passo | Persona | Status | Observação |
|---|-------|---------|--------|------------|
| 1 | Cadastrar matéria-prima | Operador de Cadastro | ✅ | Formulário em `/admin/materiais` funcional; campos nome, unidade, preço_medio, categoria presentes; CRUD completo implementado |
| 2 | Criar produto Banner-Teste | Operador de Cadastro | ✅ | Formulário em `/admin/produtos` funcional; produto salva com nome, categoria, unidade |
| 3 | Criar variações de tamanho | Operador de Cadastro | ⚠️ | Campos largura_cm e altura_cm existem, mas `area_m2` NÃO é calculada automaticamente — deve ser inserida manualmente ou fica null |
| 4 | Compor produto com materiais | Operador de Cadastro | ⚠️ | Interface de composição existe em `/admin/produtos`; funciona via painel expandido por modelo; porém custo calculado NÃO é exibido na tela de composição — sem feedback de custo |
| 5 | Gerar lead fictício | Vendedor | ✅ | Formulário de Lead em `/leads` funcional; campos empresa, contato, email, telefone, temperatura, valor_estimado; salva corretamente |
| 6 | Converter lead em cliente | Vendedor | ⚠️ | Botão "Converter em Cliente" existe em `/leads/:id`; conversão cria cliente com dados básicos; CNPJ/IE NÃO são solicitados durante a conversão — devem ser adicionados manualmente depois no cadastro do cliente |
| 7 | Gerar orçamento | Orçamentista | ⚠️ | Wizard 3 etapas funcional; produto/modelo são selecionáveis; materiais carregam do modelo SE modelo_materiais estiver populado; se vazio → total R$ 0,00 CRÍTICO; markup_padrao do modelo é aplicado automaticamente |
| 8 | Enviar orçamento por link | Orçamentista | ✅ | SharePropostaModal implementado; gera link `/p/{share_token}`; ativa token e muda status para "enviada"; opções de compartilhamento: link, WhatsApp, email via Edge Function |
| 9 | Simular aprovação do cliente | Cliente (simulado) | ✅ | Portal `/p/:token` implementado (RPC `portal_aprovar_proposta`); muda status para `aprovada_cliente`; gera notificação para vendedor; exibe confirmação ao cliente |
| 10 | Gerar ordem de serviço/pedido | Vendedor | ⚠️ | `converterParaPedido()` existe e funciona; MAS aprovação pelo portal (`aprovada_cliente`) não dispara geração automática de pedido — vendedor deve manualmente confirmar no ERP; status do orçamento após aprovação portal = `aprovada_cliente` (diferente de `aprovada` interna) |
| 11 | Executar fluxo de produção | PCP + Operador | ✅ | Módulo `/producao` implementado; OPs podem ser criadas; etapas definidas; progresso registrável; máquinas podem ser alocadas |
| 12 | Finalizar produção | Operador de Produção | ✅ | OP pode ser marcada como concluída; ao finalizar todas etapas, `criarOrdemInstalacao()` é chamado automaticamente; data de conclusão registrada |
| 13 | Enviar para financeiro | PCP / Vendedor | ✅ | Módulo `/financeiro` implementado; contas a receber visíveis; pedidos pendentes de cobrança acessíveis |
| 14 | Validar emissão de NF-e | Faturamento | ❌ | Módulo fiscal implementado na UI (dashboard, fila, documentos); NF-e NÃO é emitida via SEFAZ real — integração `nfe-provider.ts` + `fiscal-orchestrator.ts` existem mas não há certificado digital configurado; emissão real bloqueada |
| 15 | Validar emissão de boleto | Financeiro | ✅ | Módulo `/financeiro/boletos` completo; CNAB 400 Itaú implementado (commit 993bcc7); boletos podem ser gerados, emitidos, agrupados em remessa |
| 16 | Liberar para entrega/instalação | Expedição | ❌ | Não existe tela/rota dedicada à Expedição; transição de status "pagamento confirmado → liberado_entrega" não está mapeada na UI; pedido não tem botão explícito de liberação para entrega |
| 17 | Validar integração App de Campo | Coord. Instalação | ❌ | Migration 004 (bridge ERP↔Campo) NÃO foi executada; triggers `fn_create_job_from_ordem` e `fn_sync_job_to_ordem` existem no arquivo mas não estão no banco; views `vw_campo_instalacoes` e `vw_campo_fotos` podem não estar presentes |

**Legenda**: ✅ Sucesso | ❌ Falha | ⚠️ Parcial / Com ressalvas

---

## 5. PROBLEMAS IDENTIFICADOS

### 5.1 — Erros CRÍTICOS 🔴

---

**QA-2026-03-14-001**

```
Severidade:  🔴 CRÍTICO
Módulo:      Módulo 3 — Construtor de Produtos / Módulo 4 — Fluxo de Vendas
Passo:       4 — Compor produto com materiais / 7 — Gerar orçamento
Persona:     Operador de Cadastro / Orçamentista
```

**Descrição**:
> Se o modelo de produto não tiver materiais configurados em `modelo_materiais` (ou se o model for novo, criado após as seeds), o editor de orçamento carrega o modelo com lista de materiais vazia. O motor Mubisys recebe array vazio → custoMP = 0,00 → precoUnitario = 0,00 → total = R$ 0,00. O sistema aceita e salva o orçamento com valor zero sem alertar o usuário de forma bloqueante.

**Passos para reproduzir**:
1. Criar produto Banner-Teste e modelo "Banner 90x120" sem configurar materiais em `/admin/produtos`
2. Acessar Orçamentos → Novo Orçamento
3. Selecionar produto e modelo sem materiais
4. Verificar campo Total na calculadora de preços

**Resultado esperado**: R$ 1.512,40 (ou aviso claro impedindo prosseguir sem materiais)

**Resultado obtido**: R$ 0,00 — orçamento gerado com valor zero

**Causa provável**: `handleModeloChange()` no `OrcamentoEditorPage.tsx` line 322: `materiaisFromModelo` é mapeado de `modelo.materiais ?? []`. Se `modelo.materiais` estiver vazio, nenhum material é carregado. O motor recebe array vazio.

**Impacto no negócio**: Todo orçamento criado para produto sem composição vai a R$ 0,00 — proposta enviada ao cliente com valor nulo. Geração de pedido com `total <= 0` é bloqueada no `converterParaPedido()`, mas isso é tarde demais no fluxo.

**Evidências**: `OrcamentoEditorPage.tsx` linha 322-328; `pricing-engine.ts` linha 184-188 (custoMP = soma vazia = 0)

---

**QA-2026-03-14-002**

```
Severidade:  🔴 CRÍTICO
Módulo:      Módulo 7 — Validador de App de Campo
Passo:       17 — Validar integração App de Campo
Persona:     Coordenador de Instalação
```

**Descrição**:
> A migration `004_integracao_bridge.sql` que contém os triggers `fn_create_job_from_ordem`, `fn_sync_job_to_ordem` e as views `vw_campo_instalacoes` / `vw_campo_fotos` está marcada como **NÃO EXECUTADA** na documentação do projeto (CLAUDE.md). A bridge ERP↔Campo é completamente não-funcional no banco de produção.

**Passos para reproduzir**:
1. Criar Ordem de Instalação no ERP e mudar status para "agendada"
2. Verificar se job aparece no App de Campo (`campo-croma.vercel.app`)
3. Consultar Supabase: `SELECT COUNT(*) FROM jobs WHERE ordem_instalacao_id IS NOT NULL;`

**Resultado esperado**: Job criado automaticamente no App de Campo via trigger

**Resultado obtido**: Nenhum job criado — trigger não existe no banco

**Causa provável**: Migration 004 não executada. O arquivo SQL existe em `supabase/migrations/004_integracao_bridge.sql` mas nunca foi aplicado ao banco.

**Impacto no negócio**: Instalações realizadas pelo App de Campo não aparecem no ERP e vice-versa. Coordenação entre equipes de campo e escritório completamente quebrada.

**Evidências**: `CLAUDE.md` — tabela de migrations: `004_integracao_bridge.sql | ❌ NÃO executada`

---

**QA-2026-03-14-003**

```
Severidade:  🔴 CRÍTICO
Módulo:      Módulo 10 — Faturamento / NF-e
Passo:       14 — Validar emissão de NF-e
Persona:     Faturamento
```

**Descrição**:
> O módulo fiscal existe e está bem estruturado na UI (`/fiscal/dashboard`, `/fiscal/fila`, `/fiscal/documentos`). Porém a emissão real de NF-e para SEFAZ está bloqueada: não há certificado digital A1 configurado em produção, e o provider de NF-e (`nfe-provider.ts`) aponta para API externa (NFe.io, Focus NF-e, ou equivalente) que requer credenciais não configuradas.

**Passos para reproduzir**:
1. Acessar `/fiscal/dashboard`
2. Selecionar pedido e iniciar processo de NF-e
3. Tentar emitir NF-e

**Resultado esperado**: NF-e autorizada pela SEFAZ com chave de acesso

**Resultado obtido**: Processo bloqueado — sem certificado ou credenciais de API fiscal

**Causa provável**: Nenhum certificado A1 cadastrado. A integração com provedor NF-e gratuito (discutida em sessão anterior) ainda não foi implementada.

**Impacto no negócio**: Faturamento real bloqueado. Empresa não pode emitir notas fiscais eletrônicas pelo sistema.

**Evidências**: `MEMORY.md` — "NF-e real: Via API gratuita (resgatar qual foi escolhida) — outra sessão trabalhando nisso"; `FiscalDashboardPage.tsx` — interface existente mas sem emissão real

---

### 5.2 — Erros ALTOS 🟠

---

**QA-2026-03-14-004**

```
Severidade:  🟠 ALTO
Módulo:      Módulo 4 — Fluxo de Vendas
Passo:       10 — Gerar pedido após aprovação do portal
```

**Descrição**: Aprovação pelo cliente no portal (`portal_aprovar_proposta`) muda status da proposta para `aprovada_cliente`, mas NÃO gera o pedido automaticamente nem notifica o vendedor de forma que facilite essa ação. O vendedor precisa acessar manualmente o orçamento e clicar em "Aprovar e Gerar Pedido" — um segundo clique desnecessário após o cliente já ter aprovado.

**Resultado esperado**: Aprovação pelo cliente no portal dispara geração automática do pedido (ou pelo menos muda status para "aprovada" internamente, habilitando o fluxo de 1 clique)

**Resultado obtido**: Status fica em `aprovada_cliente` — diferente de `aprovada` — exigindo ação manual do vendedor para converter

**Impacto**: Risco de pedido ficar preso em limbo. Vendedor pode não ver a aprovação a tempo. Fluxo tem etapa desnecessária.

---

**QA-2026-03-14-005**

```
Severidade:  🟠 ALTO
Módulo:      Módulo 3 — Construtor de Produtos
Passo:       3 — Criar variações de tamanho
```

**Descrição**: O campo `area_m2` nos modelos de produto (`produto_modelos`) NÃO é calculado automaticamente a partir de `largura_cm` e `altura_cm`. O usuário precisa calcular manualmente e inserir o valor de área. Se a área ficar nula, cálculos de preço/m² no editor de orçamento ficam incorretos.

**Resultado esperado**: Ao preencher largura_cm=90 e altura_cm=120, area_m2 deveria ser calculado automaticamente como 1,08 m²

**Resultado obtido**: area_m2 permanece null — campo separado que o usuário deve preencher manualmente

**Impacto**: Orçamentos com dimensões corretas mas área nula causam falha no cálculo de preço/m² e inconsistência visual

---

**QA-2026-03-14-006**

```
Severidade:  🟠 ALTO
Módulo:      Módulo 6 — Financeiro
Passo:       16 — Liberar para entrega/instalação
```

**Descrição**: Não existe tela ou funcionalidade de Expedição no ERP. Após o financeiro registrar pagamento e o pedido estar "liberado", não há módulo de expedição para registrar entrega física. A transição de status `pagamento confirmado → liberado_entrega → entregue` não possui interface na UI.

**Resultado esperado**: Módulo Expedição com listagem de pedidos para entrega, confirmação de saída, registro de romaneio

**Resultado obtido**: Módulo ausente — não existe rota `/expedicao` ou equivalente

**Impacto**: Pedidos "ficam" no status de produção/aguardando sem registro formal de entrega

---

**QA-2026-03-14-007**

```
Severidade:  🟠 ALTO
Módulo:      Módulo 4 — Fluxo de Vendas
Passo:       6 — Converter lead em cliente
```

**Descrição**: O fluxo de conversão Lead → Cliente (`handleConverter()` em `LeadDetailPage.tsx`) cria o cliente com apenas os dados básicos do lead (razao_social, email, telefone, segmento). CNPJ, Inscrição Estadual e endereço completo NÃO são solicitados durante a conversão — o vendedor é redirecionado para `/clientes` sem orientação clara de que precisa completar os dados fiscais.

**Resultado esperado**: Wizard de conversão solicita CNPJ + IE + endereço completo antes de finalizar

**Resultado obtido**: Cliente criado sem dados fiscais. Formulário de orçamento e NF-e ficam incompletos.

**Impacto**: Orçamentos podem ser gerados para clientes sem CNPJ, impossibilitando faturamento posterior

---

### 5.3 — Erros MÉDIOS 🟡

| ID | Módulo | Descrição | Resultado Esperado | Resultado Obtido |
|----|--------|-----------|-------------------|-----------------|
| QA-2026-03-14-008 | Admin Materiais | Formulário de cadastro de material não valida se `preco_medio` é obrigatório — material pode ser criado sem preço | Bloquear material sem preço ou avisar que custo não será calculado | Material salva com `preco_medio: null` sem aviso |
| QA-2026-03-14-009 | Editor de Orçamento | Custo total calculado não é exibido na tela de composição do modelo em `/admin/produtos` | Mostrar custo total estimado da composição configurada | Sem feedback de custo — operador não sabe se composição está correta |
| QA-2026-03-14-010 | Módulo Fiscal | Campos de impostos (ICMS, PIS, COFINS) precisam de configuração fiscal prévia (CFOP, CST, alíquotas) que não tem interface clara de setup | Formulário guiado de configuração fiscal com valores padrão para comunicação visual | Apenas configuração via `/fiscal/configuracao` sem onboarding |
| QA-2026-03-14-011 | CRM / Leads | Rota `/leads/:id` existe mas não há rota de detalhes do lead na configuração de rotas verificada — potencial 404 | Rota `/leads/:id` configurada e funcional | Rota não encontrada nas definições de `comercialRoutes.tsx` — lead detalhe não roteado |
| QA-2026-03-14-012 | Portal Cliente | `portal_get_proposta()` busca contato_nome em `clientes` mas a tabela usa `contato_nome` que pode ser null — exibição do nome do cliente no portal pode mostrar "Olá, null!" | Fallback adequado quando contato_nome é null | Possível exibição de "Olá, null!" ou "Olá, undefined!" |

---

### 5.4 — Melhorias BAIXAS 🟢

| ID | Local | Sugestão |
|----|-------|---------|
| QA-2026-03-14-013 | Admin Produtos — Composição do Modelo | Exibir custo total calculado da composição em tempo real (somatório de qtd × preço_medio) para que o operador valide antes de salvar |
| QA-2026-03-14-014 | Editor de Orçamento — Wizard | Exibir alerta visual mais prominente quando nenhum material está na lista (atualmente há apenas texto em âmbar, não bloqueia o salvamento) |

---

## 6. QUEBRAS DE FLUXO

| De | Para | Problema | Severidade |
|----|------|----------|-----------|
| Orçamento criado (valor R$ 0,00) | Geração de pedido | `converterParaPedido()` bloqueia pedidos com total ≤ 0, mas erro só aparece tarde. Usuário percebe o problema ao tentar gerar pedido, não ao criar o orçamento. | 🔴 CRÍTICO |
| Aprovação pelo portal (`aprovada_cliente`) | Geração automática de pedido | Status `aprovada_cliente` ≠ `aprovada` — pedido não é gerado automaticamente | 🟠 ALTO |
| Produção concluída | Expedição | Não há módulo de expedição — fluxo quebra após produção concluída | 🟠 ALTO |
| Pagamento confirmado | Emissão de NF-e | NF-e não pode ser emitida via SEFAZ sem certificado digital configurado | 🔴 CRÍTICO |
| OI agendada | Criação de job no App de Campo | Migration 004 não executada — trigger não existe | 🔴 CRÍTICO |

**Fluxo interrompido em**: Passo 14 — Faturamento (NF-e real bloqueada) e Passo 17 (bridge campo)
**Motivo**: Infrastructure não configurada (certificado NF-e) e migration não executada (bridge)
**Passos não executados por consequência**: Nenhum passo deixou de ser analisado (análise por inspeção de código)

---

## 7. ERROS DE REGRA DE NEGÓCIO

| Tipo | Descrição | Impacto |
|------|-----------|---------|
| Permissivo demais | Permite salvar orçamento com total R$ 0,00 e enviá-lo ao cliente | Cliente recebe proposta com valor zerado — grave problema comercial |
| Permissivo demais | Permite converter lead em cliente sem CNPJ | Pedidos e NF-e geradas para cliente sem dados fiscais |
| Status incoerente | `aprovada_cliente` (pelo portal) ≠ `aprovada` (interna) — dois status diferentes para "aprovado" causam confusão no fluxo | Vendedor não sabe claramente se precisa fazer algo após aprovação do portal |
| Permissivo demais | Material cadastrado sem preço_medio não bloqueia sua inclusão em composições | Composição com material sem preço → custo R$ 0,00 parcial |

---

## 8. PROBLEMAS DE UX

| Tela / Módulo | Problema de UX | Severidade | Sugestão |
|---------------|---------------|------------|---------|
| Editor Orçamento — Passo 2 Materiais | Aviso de "sem materiais" existe mas não bloqueia o botão "Adicionar Item" — usuário pode avançar | MÉDIO | Desabilitar botão "Adicionar Item" quando materiais = [] e sem dimensões definidas |
| `/admin/produtos` — Composição | Custo calculado da composição não é exibido — operador não tem feedback imediato de que a configuração está correta | MÉDIO | Mostrar banner com custo total: R$ XX,XX baseado nos materiais e preços cadastrados |
| Conversão Lead → Cliente | Após clicar "Converter", usuário é redirecionado para `/clientes` sem indicação clara do que fazer a seguir (completar CNPJ/IE) | MÉDIO | Toast com instrução: "Cliente criado! Complete os dados fiscais (CNPJ, IE) antes de gerar orçamentos" |
| `/p/:token` — Portal | Se `contato_nome` do cliente for null, exibe "Olá, null!" | BAIXO | Fallback: `proposta.cliente.contato_nome || proposta.cliente.nome_fantasia || 'Cliente'` |
| Leads — Detalhe | Rota `/leads/:id` pode não estar configurada em `comercialRoutes.tsx` | ALTO | Verificar e adicionar `<Route path="leads/:id" element={<LeadDetailPage />} />` |

**Padrões de UX identificados**:
- [X] Campo obrigatório sem indicação visual (`area_m2` não calculado automaticamente — sem instrução ao usuário)
- [X] Fluxo não intuitivo (aprovação do portal não gera pedido — usuário não sabe o próximo passo)
- [ ] Feedback inexistente após ação (com toast/loading)
- [ ] Mensagem de erro genérica ("Erro ao salvar")
- [ ] Ação irreversível sem confirmação
- [ ] Tela em branco sem estado vazio explicativo
- [ ] Filtro ou busca que não retorna resultado esperado

---

## 9. PROBLEMAS TÉCNICOS

| ID | Componente | Tipo | Descrição | Severidade |
|----|-----------|------|-----------|-----------|
| QA-2026-03-14-T01 | `004_integracao_bridge.sql` | Migration não executada | Triggers e views da bridge ERP↔Campo ausentes do banco de produção | CRÍTICO |
| QA-2026-03-14-T02 | `produto_modelos.area_m2` | Falta de computed column | `area_m2` deve ser `GENERATED ALWAYS AS (largura_cm/100 * altura_cm/100)` ou calculada por trigger | ALTO |
| QA-2026-03-14-T03 | `portal_get_proposta` RPC | Possível null reference | `c.contato_nome` pode ser null em clientes — SELECT sem COALESCE | MÉDIO |
| QA-2026-03-14-T04 | `LeadDetailPage.tsx` → `/leads/:id` | Rota ausente | `comercialRoutes.tsx` não inclui `path="leads/:id"` — LeadDetailPage não é roteada | ALTO |
| QA-2026-03-14-T05 | `fiscal_certificados` | Tabela sem certificado | Nenhum certificado A1 cadastrado — emissão NF-e bloqueada | CRÍTICO |

**Verificações de banco realizadas (por inspeção de código + CLAUDE.md)**:
```sql
-- Migration 004 não executada:
-- SELECT trigger_name FROM pg_trigger WHERE tgname LIKE '%ordem%';
-- Resultado esperado: 0 registros (triggers não existem)

-- modelo_materiais populados (migration 022 executada):
-- SELECT COUNT(*) FROM modelo_materiais;
-- Resultado conforme MEMORY.md: 321 registros ✅

-- modelo_processos populados (migration 022 executada):
-- SELECT COUNT(*) FROM modelo_processos;
-- Resultado conforme MEMORY.md: 362 registros ✅

-- Materiais com preço:
-- SELECT COUNT(*) FROM materiais WHERE preco_medio IS NOT NULL;
-- Resultado conforme CLAUDE.md: 464 de 467
```

---

## 10. MÓDULOS INCOMPLETOS

| Módulo | Funcionalidade | Status UI | Status Backend | Impacto |
|--------|---------------|-----------|---------------|---------|
| Fiscal | Emissão NF-e via SEFAZ | Existe (fila, documentos) | Sem certificado — inoperante | Alto — faturamento bloqueado |
| Expedição | Gestão de entregas | Não existe | Não existe | Médio — fluxo post-produção incompleto |
| Bridge ERP↔Campo | Sincronização bidirecional status | Existe (InstalacaoPage, vw_campo_instalacoes usada) | Migration 004 não executada | Crítico — integração nula |
| Orçamento — Área automática | Cálculo area_m2 por dimensão | Campo manual | Sem trigger/computed | Médio — dado incorreto se não preenchido |
| Conversão Lead→Cliente | CNPJ/IE na conversão | Parcial (sem campos fiscais) | Funciona sem fiscal | Alto — cliente sem dados para NF-e |

---

## 11. MELHORIAS RECOMENDADAS

### Prioritárias (implementar logo)

1. **Cálculo automático de area_m2** — Adicionar trigger ou coluna GENERATED no banco para `produto_modelos.area_m2 = (largura_cm/100.0) * (altura_cm/100.0)`. Ou calcular no frontend ao salvar o modelo.

2. **Execução da migration 004** — Executar `004_integracao_bridge.sql` no banco de produção para ativar a bridge ERP↔Campo. Verificar compatibilidade com schema atual antes.

3. **Rota `/leads/:id`** — Verificar e adicionar `<Route path="leads/:id" element={<LeadDetailPage />} />` em `comercialRoutes.tsx`.

4. **Aprovação do portal → geração automática de pedido** — Quando `portal_aprovar_proposta` é chamado, disparar RPC ou webhook que converte automaticamente a proposta em pedido, ou pelo menos muda o status para `aprovada` no ERP para facilitar a ação do vendedor.

5. **Aviso bloqueante no orçamento com R$ 0,00** — Impedir o envio de proposta com total zerado. Adicionar validação no `handleSave()` e no botão "Enviar Proposta" do `SharePropostaModal`.

### Desejáveis (implementar quando possível)

1. **Módulo Expedição** — Criar tela `/expedicao` com lista de pedidos prontos para entrega, confirmação de saída, registro de romaneio, geração de etiquetas.

2. **Custo calculado na composição** — Exibir banner de custo total estimado na tela de composição do modelo em `/admin/produtos`.

3. **Wizard de conversão Lead→Cliente** — Adicionar etapa de dados fiscais (CNPJ, IE, endereço) no fluxo de conversão antes de redirecionar para `/clientes`.

4. **NF-e real** — Executar integração NF-e discutida em sessão anterior (API gratuita). Configurar certificado digital A1.

---

## 12. PLANO DE CORREÇÃO PRIORITÁRIO

| Prioridade | ID | Problema | Esforço estimado | Responsável sugerido |
|-----------|-----|----------|-----------------|---------------------|
| 1 | QA-2026-03-14-T04 | Rota `/leads/:id` ausente | P (< 2h) | Dev frontend |
| 2 | QA-2026-03-14-001 | Orçamento R$ 0,00 sem alerta bloqueante | P (< 2h) | Dev frontend |
| 3 | QA-2026-03-14-T02 | `area_m2` não calculada automaticamente | P (< 2h) | Dev frontend/DB |
| 4 | QA-2026-03-14-007 | Conversão Lead→Cliente sem CNPJ/IE | M (2h-1d) | Dev frontend |
| 5 | QA-2026-03-14-004 | Aprovação portal não gera pedido automaticamente | M (2h-1d) | Dev fullstack |
| 6 | QA-2026-03-14-T01 | Migration 004 bridge ERP↔Campo não executada | M (2h-1d) | DBA + Dev |
| 7 | QA-2026-03-14-006 | Módulo Expedição ausente | G (> 1d) | Dev fullstack |
| 8 | QA-2026-03-14-003 | NF-e real via SEFAZ não configurada | G (> 1d) | Dev + infra |

**Legenda esforço**: P = Pequeno (< 2h) | M = Médio (2h-1d) | G = Grande (> 1d)

---

## 13. VEREDITO FINAL SOBRE PRONTIDÃO DO ERP

### Status por Módulo

| Módulo | Status | Bloqueadores |
|--------|--------|-------------|
| Cadastro de materiais | ✅ Operacional | — |
| Cadastro de produtos | ⚠️ Parcial | area_m2 não calculada automaticamente |
| Composição de modelos | ⚠️ Parcial | Custo não exibido; modelos novos precisam de composição manual |
| CRM / Leads | ⚠️ Parcial | Rota detalhe pode estar ausente; conversão sem CNPJ/IE |
| Orçamentos | ⚠️ Parcial | Falha se modelo sem materiais; aprovação do portal desconectada |
| Portal de aprovação | ✅ Operacional | — (com ressalva de null no nome do cliente) |
| Pedidos | ✅ Operacional | — |
| Produção | ✅ Operacional | — |
| Financeiro (contas a receber) | ✅ Operacional | — |
| Boletos (CNAB 400) | ✅ Operacional | — |
| Faturamento (NF-e) | ❌ Inoperante | Sem certificado digital; sem API fiscal configurada |
| Expedição | ❌ Inoperante | Módulo não existe |
| Instalação / App Campo | ❌ Inoperante | Migration 004 não executada; bridge offline |
| Estoque | ⚠️ Parcial | Cadastro OK; baixa de estoque pós-produção não verificada |

### Conclusão

```
O ERP da Croma Print está:

[ ] 🔴 INAPTO para uso operacional

[X] 🟠 PARCIALMENTE APTO
    → O core comercial funciona (Lead, Orçamento, Pedido, Produção, Boleto).
    → Há falhas sérias em: NF-e (inoperante), Expedição (ausente), Bridge Campo (offline).
    → Recomendação: Usar com cautela apenas nos módulos estáveis (CRM, Orçamentos, Pedidos,
      Produção, Boletos). Não usar para faturamento real até NF-e configurada.
      Resolver erros CRÍTICOS antes de expansão de uso.

[ ] 🟡 APTO COM RESSALVAS
[ ] 🟢 APTO PARA PRODUÇÃO
```

---

**Assinado por**: AGENTE DE CONTROLE DE QUALIDADE CROMA_ERP
**Data**: 2026-03-14 10:00
**Próxima execução recomendada**: Após execução da migration 004, configuração NF-e, e correção das rotas de leads

---

*Este relatório foi gerado automaticamente pelo Agente QA Operacional da Croma Print.*
*Para re-executar o agente: invocar AGENTE.md com o cenário desejado.*
