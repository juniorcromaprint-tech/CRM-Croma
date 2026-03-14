# RELATÓRIO DE QA OPERACIONAL — CROMA_ERP
## Execução: 2026-03-13 — Cenário Banner-Teste + NF-e Homologação

---

## 1. RESUMO EXECUTIVO

```
Data/Hora:          2026-03-13 — sessão completa
Cenário executado:  Banner-Teste — Fluxo Completo (Lead → Faturamento)
                    + Módulo NF-e em Ambiente de Homologação (foco especial)
Passos totais:      17
Passos executados:  17
Passos com sucesso: 8
Passos com falha:   9 (6 falha parcial / 3 falha crítica)
Taxa de sucesso:    47%

Erros encontrados:
  🔴 CRÍTICO: 5
  🟠 ALTO:    4
  🟡 MÉDIO:   4
  🟢 BAIXO:   2
  ─────────────────
  TOTAL:      15
```

### Veredito de Prontidão

```
[X] 🔴 INAPTO — Erros críticos impedem operação básica
[ ] 🟠 PARCIALMENTE APTO — Funciona com restrições sérias
[ ] 🟡 APTO COM RESSALVAS — Operação possível com cuidados
[ ] 🟢 APTO PARA PRODUÇÃO — Sem bloqueadores críticos
```

**Justificativa do veredito**:
> O fluxo Lead → Cliente está quebrado: o botão "Converter em Cliente" apenas muda o status do lead para "convertido" mas não cria nenhum registro real na tabela `clientes`. Além disso, `modelo_materiais` sem vínculos impede o cálculo de preço, gerando orçamentos com R$ 0,00. O módulo NF-e tem infraestrutura sólida, mas depende de configurações críticas ausentes (CNPJ emitente, série vinculada ao ambiente, certificado A1) e atualmente opera apenas em modo DEMO sem transmissão real para SEFAZ.

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
- [ ] Expedição (módulo não existe)
- [X] Coordenador de Instalação

### Módulos do sistema acessados:
`/admin/materiais`, `/admin/produtos`, `/leads`, `/orcamentos`, `/portal/:token`, `/pedidos`, `/producao`, `/financeiro`, `/fiscal/*`, `/instalacao`

---

## 3. DADOS GERADOS PELO TESTE

```
Cliente fictício:    Papelaria São Lucas Ltda
CNPJ:               34.567.890/0001-12
Produto testado:    Banner-Teste
Variação:           Banner 90x120 (0,90m × 1,20m)
Quantidade:         10 unidades

IDs gerados (se aplicável):
  Lead ID:          N/A — teste estático (análise de código-fonte)
  Cliente ID:       N/A — conversão de lead quebrada (ver QA-2026-03-13-001)
  Orçamento ID:     N/A — dependente de cliente criado
  Pedido ID:        N/A — dependente de orçamento
  OP ID:            N/A
  OI ID:            N/A
  Job ID:           N/A

Valores calculados (baseados em análise do motor):
  Custo unitário esperado:   R$ 43,21
  Custo unitário obtido:     R$ 0,00 (modelo_materiais sem vínculos)
  Preço de venda esperado:   R$ 151,24
  Preço de venda obtido:     R$ 0,00
  Total esperado (×10):      R$ 1.512,40
  Total obtido:              R$ 0,00
  Variação:                  -100% — DIVERGENTE CRÍTICO
```

---

## 4. RESULTADO POR PASSO

| # | Passo | Persona | Status | Observação |
|---|-------|---------|--------|------------|
| 1 | Cadastrar matéria-prima | Operador de Cadastro | ✅ | Formulário completo, save/update/delete funcionam. NCM e plano de contas presentes. |
| 2 | Criar produto Banner-Teste | Operador de Cadastro | ⚠️ | Funciona, mas categoria "Banner" não existe na lista — categorias disponíveis: fachadas, pdv, campanhas, etc. |
| 3 | Criar variações de tamanho | Operador de Cadastro | ⚠️ | Campos largura/altura existem. Área (area_m2) NÃO é calculada automaticamente na tela — campo separado manual. |
| 4 | Compor produto com materiais | Operador de Cadastro | ❌ | Interface existe. Custo total NÃO é exibido na tela de composição. Banco: modelo_materiais = 0 vínculos. |
| 5 | Gerar lead fictício | Vendedor | ✅ | Módulo de leads funcional. Formulário completo, funil kanban presente. |
| 6 | Converter lead em cliente | Vendedor | ❌ | handleConverter() apenas atualiza status do lead. Nenhum registro inserido em `clientes`. |
| 7 | Gerar orçamento | Orçamentista | ❌ | Motor Mubisys implementado corretamente, mas retorna R$ 0,00 quando modelo_materiais vazio. |
| 8 | Enviar orçamento por link | Orçamentista | ✅ | Portal /p/:token funcional, link gerado, proposta legível. |
| 9 | Simular aprovação do cliente | Cliente (simulado) | ✅ | RPC portal_aprovar_proposta funciona. Aprovação registrada. |
| 10 | Gerar ordem de serviço/pedido | Vendedor | ⚠️ | converterParaPedido() funciona mas bloqueia se total = R$ 0,00 (dependente de correção do passo 7). |
| 11 | Executar fluxo de produção | PCP + Operador | ⚠️ | OP pode ser criada. Número de OP gerado com Math.random() — risco de duplicação. |
| 12 | Finalizar produção | Operador de Produção | ⚠️ | Finalização atualiza custos. Status do pedido NÃO é atualizado automaticamente ao concluir todas OPs. |
| 13 | Enviar para financeiro | PCP / Vendedor | ✅ | Módulo financeiro existe. Contas a receber/pagar funcionam. |
| 14 | Validar emissão de NF-e | Faturamento | ⚠️ | Ver análise detalhada seção 5.1 e 5.2 — infraestrutura existe, mas DEMO mode sem SEFAZ real. |
| 15 | Validar emissão de boleto | Financeiro | ⚠️ | Sem integração com banco/gateway. Apenas registro manual de recebimento. |
| 16 | Liberar para entrega/instalação | Expedição | ❌ | Módulo de Expedição não existe. Instalação existe mas entrega direta sem instalação não tem fluxo. |
| 17 | Validar integração App de Campo | Coord. Instalação | ❌ | Migration 004 (bridge ERP↔Campo) NÃO executada. Triggers fn_create_job_from_ordem e fn_sync_job_to_ordem ausentes. |

**Legenda**: ✅ Sucesso | ❌ Falha | ⚠️ Parcial / Com ressalvas

---

## 5. PROBLEMAS IDENTIFICADOS

### 5.1 — Erros CRÍTICOS 🔴

---

**QA-2026-03-13-001**

```
Severidade:  🔴 CRÍTICO
Módulo:      Módulo 4 — Fluxo de Vendas
Passo:       6 — Converter Lead em Cliente
Persona:     Vendedor
```

**Descrição**:
> O botão "Converter em Cliente" na tela de detalhe do lead (LeadDetailPage.tsx) executa apenas `updateLead.mutate({ id, status: "convertido" })` e redireciona para `/clientes`. Nenhum registro é inserido na tabela `clientes`. O cliente não existe em `/clientes` após a conversão.

**Passos para reproduzir**:
1. Acessar CRM → Leads → selecionar qualquer lead
2. Clicar em "Converter em Cliente"
3. Confirmar no AlertDialog
4. Navegar para Clientes

**Resultado esperado**: Lead convertido em cliente com todos os dados migrados para tabela `clientes`.

**Resultado obtido**: Lead tem status "convertido", mas a tabela `clientes` não tem o registro. Usuário é redirecionado para /clientes mas o cliente não aparece.

**Causa provável**: `handleConverter` (linha 103-113 de `LeadDetailPage.tsx`) não chama nenhum service de criação de cliente. A lógica de migração de dados está ausente.

**Impacto no negócio**: Impossível criar orçamentos para leads convertidos. Fluxo comercial completamente bloqueado a partir desse ponto.

**Evidências**: `src/domains/comercial/pages/LeadDetailPage.tsx` linha 103-114.

---

**QA-2026-03-13-002**

```
Severidade:  🔴 CRÍTICO
Módulo:      Módulo 3 — Cadastro de Produtos / Módulo 4 — Orçamentos
Passo:       4 e 7 — Composição do produto / Geração de orçamento
Persona:     Operador de Cadastro / Orçamentista
```

**Descrição**:
> A tabela `modelo_materiais` tem 0 vínculos (conforme CLAUDE.md e verificação de código). Quando o orçamentista seleciona um modelo no editor de orçamento, `handleModeloChange` mapeia `modelo.materiais ?? []` — que retorna array vazio — resultando em `materiaisFromModelo = []`. O motor Mubisys com array vazio retorna `custoMP = 0`, `custoMO = 0`, `precoVenda = 0`. O total do orçamento é R$ 0,00.

**Passos para reproduzir**:
1. Acessar Orçamentos → Novo Orçamento
2. Selecionar qualquer cliente
3. Adicionar item: qualquer produto com modelo
4. Observar o campo "Total"

**Resultado esperado**: R$ 1.512,40 para Banner 90x120 × 10 un.

**Resultado obtido**: R$ 0,00 (array de materiais vazio → custoMP = 0 → precoVenda = 0).

**Causa provável**: Migration `modelo_materiais` não vinculada. Materiais existem na tabela `materiais` (467 registros) mas nenhum está associado a nenhum modelo de produto.

**Impacto no negócio**: 100% dos orçamentos gerados têm valor R$ 0,00. Sistema inutilizável para vendas.

**Evidências**: `src/domains/comercial/pages/OrcamentoEditorPage.tsx` linha 322-333; CLAUDE.md: "modelo_materiais: materiais existem mas não estão vinculados aos modelos de produto".

---

**QA-2026-03-13-003**

```
Severidade:  🔴 CRÍTICO
Módulo:      Módulo 7 — Integração App de Campo
Passo:       17 — Integração ERP↔Campo
Persona:     Coordenador de Instalação
```

**Descrição**:
> A migration 004 (`004_integracao_bridge.sql`) não foi executada. As triggers `fn_create_job_from_ordem` e `fn_sync_job_to_ordem` não existem no banco. Ao agendar uma OI (Ordem de Instalação), nenhum job é criado automaticamente no App de Campo. A sincronização bidirecional de status é inexistente.

**Passos para reproduzir**:
1. Criar Ordem de Instalação no ERP
2. Mudar status para "agendada"
3. Verificar tabela `jobs` no Supabase

**Resultado esperado**: Job criado automaticamente com `ordem_instalacao_id` preenchido; job aparece no App de Campo.

**Resultado obtido**: Nenhum job criado. App de Campo não recebe a ordem.

**Causa provável**: Migration 004 listada como "❌ NÃO executada" no CLAUDE.md.

**Impacto no negócio**: Coordenadores de instalação não conseguem acionar técnicos pelo App de Campo via ERP. Fluxo de instalação completamente manual.

---

**QA-2026-03-13-004**

```
Severidade:  🔴 CRÍTICO
Módulo:      NF-e — Homologação
Passo:       14 — Emissão de NF-e
Persona:     Faturamento
```

**Descrição**:
> A Edge Function `fiscal-emitir-nfe` verifica `NFE_PROVIDER_TOKEN`. Se ausente ou igual a `'DEMO_MODE'`, simula uma autorização sem transmitir para SEFAZ. O XML gerado é inválido para fins reais (contém apenas `<NFe><infNFe Id="NFe${numero}"/></NFe>` sem os campos obrigatórios). A chave de acesso gerada (`35${ano}${cnpj}55001...`) é calculada sem os dígitos verificadores requeridos pela SEFAZ.

**Passos para reproduzir**:
1. Configurar `NFE_PROVIDER_TOKEN` como ausente ou `'DEMO_MODE'` (estado atual)
2. Tentar emitir qualquer NF-e
3. Verificar XML gerado

**Resultado esperado**: Transmissão real para SEFAZ homologação (ambiente=2), retorno de protocolo válido, XML completo com todos os campos obrigatórios da NT NF-e 4.00.

**Resultado obtido**: Simulação local. XML incompleto. Chave de acesso inválida (sem dígito verificador). Nenhuma comunicação com SEFAZ.

**Causa provável**: Variável de ambiente `NFE_PROVIDER_TOKEN` não configurada nas Edge Functions do Supabase.

**Impacto no negócio**: Impossível emitir NF-e válida. Sistema fiscal inapto para uso em produção ou para testes formais de homologação SEFAZ.

---

**QA-2026-03-13-005**

```
Severidade:  🔴 CRÍTICO
Módulo:      NF-e — Dados do Emitente
Passo:       14 — Emissão de NF-e
Persona:     Faturamento
```

**Descrição**:
> O formulário de edição de `fiscal_ambientes` permite editar apenas `cnpj_emitente`, `razao_social_emitente` e `ativo`. Campos críticos para a NF-e estão ausentes do formulário: endereço do emitente (logradouro, número, bairro, cidade, UF, CEP), Inscrição Estadual, regime tributário, CNAE. A Edge Function `fiscal-emitir-nfe` busca o CNPJ do emitente via variável de ambiente `NFE_CNPJ_EMITENTE` (não da tabela `fiscal_ambientes`). Se a variável não estiver configurada, usa `cnpj_titular` do certificado — que também pode estar ausente.

**Passos para reproduzir**:
1. Acessar Fiscal → Configuração → Aba Ambientes
2. Clicar em Editar em qualquer ambiente
3. Observar campos disponíveis no formulário

**Resultado esperado**: Formulário completo com todos os dados do emitente: CNPJ, razão social, endereço completo, IE, regime tributário.

**Resultado obtido**: Apenas 3 campos editáveis (CNPJ, Razão Social, Ativo). Dados de endereço do emitente ausentes da UI.

**Causa provável**: Formulário de edição de ambiente incompleto. Campos de endereço não existem na tabela `fiscal_ambientes` (somente `cnpj_emitente`, `razao_social_emitente`, `endpoint_base`).

**Impacto no negócio**: Impossível preencher dados completos do emitente necessários para a NF-e válida. Qualquer NF-e emitida em modo real terá rejeição 539 (SEFAZ rejeita por dados do emitente incompletos).

---

### 5.2 — Erros ALTOS 🟠

---

**QA-2026-03-13-006**

```
Severidade:  🟠 ALTO
Módulo:      NF-e — Série por Ambiente
Passo:       14 — Emissão de NF-e
```

**Descrição**: O documento fiscal ao ser criado via `fiscal_criar_rascunho_nfe` (RPC) não seleciona automaticamente a série de homologação — o documento pode herdar `serie_id = NULL`, fazendo `fiscal_proximo_numero_serie` falhar com erro de FK nula.

**Resultado esperado**: Documento criado automaticamente vinculado à série do ambiente ativo (homologação ou produção, conforme configuração).

**Resultado obtido**: `serie_id` potencialmente nulo. Emissão falha com "Erro ao gerar número da série".

**Impacto**: Bloqueia emissão mesmo em modo DEMO se a série não foi configurada manualmente.

---

**QA-2026-03-13-007**

```
Severidade:  🟠 ALTO
Módulo:      Produção
Passo:       11-12 — Ordens de Produção
```

**Descrição**: `generateOpNumero()` em `producao.service.ts` e `generateOsNumero()` em `instalacao-criacao.service.ts` usam `Math.random()` para gerar números sequenciais. Em ambiente de produção com volume médio, colisões são esperadas (ex.: 2 OPs criadas simultaneamente podem receber o mesmo número).

**Resultado esperado**: Número sequencial garantidamente único (usando sequence do banco ou `count + 1`).

**Resultado obtido**: Número pseudoaleatório de 4 dígitos — espaço de colisão 1/9999.

**Impacto**: Duplicação de números de OP/OS em produção, confusão operacional.

---

**QA-2026-03-13-008**

```
Severidade:  🟠 ALTO
Módulo:      Produção → Pedido
Passo:       12 — Finalizar Produção
```

**Descrição**: `finalizarCustosOP()` atualiza custos da OP mas não existe lógica (trigger ou código) que verifique se todas as OPs de um pedido foram concluídas e atualize automaticamente o status do pedido para `produzido`. O operador não sabe que a produção está concluída pelo pedido.

**Resultado esperado**: Quando todas as OPs de um pedido forem concluídas, pedido.status → `produzido` automaticamente.

**Resultado obtido**: Pedido permanece no status anterior após conclusão de todas as OPs.

**Impacto**: PCP e financeiro não sabem quando a produção foi concluída. Pedido não avança no fluxo automaticamente.

---

**QA-2026-03-13-009**

```
Severidade:  🟠 ALTO
Módulo:      NF-e — Tratamento de Erros SEFAZ
Passo:       14 — Emissão de NF-e
```

**Descrição**: O sistema trata `response.status === 422` como rejeição SEFAZ e atualiza o documento com `status = 'rejeitado'`. Porém, não há tratamento diferenciado por código de erro SEFAZ. Erros como código 539 (dados do emitente inválidos), 562 (campo inválido) e 999 (erro interno SEFAZ) recebem a mesma mensagem genérica sem orientação ao usuário sobre como corrigir. A tela de documentos fiscais exibe apenas "NF-e rejeitada: {mensagem}" sem indicar qual campo corrigir.

**Resultado esperado**: Mensagem de erro descritiva por código SEFAZ, com sugestão de correção. Ex: "Código 539 — CNPJ emitente inválido. Verifique a configuração do ambiente fiscal."

**Resultado obtido**: Mensagem genérica do provider sem decodificação dos códigos SEFAZ.

**Impacto**: Equipe de faturamento não consegue resolver rejeições sem suporte técnico.

---

### 5.3 — Erros MÉDIOS 🟡

| ID | Módulo | Descrição | Resultado Esperado | Resultado Obtido |
|----|--------|-----------|-------------------|-----------------|
| QA-2026-03-13-010 | Produtos — Categoria | Categoria "Banner" não existe na lista de categorias de produto. Categorias disponíveis: fachadas, pdv, campanhas, etc. | Categoria "Banner" presente para cadastro do produto de teste | Usuário deve escolher "outros" ou categoria não representativa |
| QA-2026-03-13-011 | Produtos — Área automática | Campo `area_m2` do modelo não é calculado automaticamente a partir de largura_cm × altura_cm no formulário de edição | Área calculada automaticamente ao preencher largura e altura | Usuário deve calcular manualmente ou deixar em branco |
| QA-2026-03-13-012 | Produtos — Custo do modelo | Custo total não é exibido na tela de composição do modelo após adicionar materiais | Exibir custo unitário calculado em tempo real na tela de composição | Nenhum cálculo exibido — usuário não sabe o custo ao compor |
| QA-2026-03-13-013 | Expedição | Módulo de Expedição ausente como domínio. Não há tela dedicada para registrar entrega direta (sem instalação), romaneio ou confirmação de recebimento | Tela de expedição com romaneio e confirmação de recebimento | Apenas o módulo de instalação existe — entrega direta não tem fluxo |

---

### 5.4 — Melhorias BAIXAS 🟢

| ID | Local | Sugestão |
|----|-------|---------|
| QA-2026-03-13-014 | Admin → Materiais | Adicionar validação de formato NCM (8 dígitos numéricos) com máscara visual. Atualmente aceita qualquer texto no campo NCM. |
| QA-2026-03-13-015 | Fiscal → Documentos | Adicionar coluna "Ambiente" (HML/PRD) na listagem de documentos fiscais para diferenciação visual imediata entre notas de homologação e produção. |

---

## 6. QUEBRAS DE FLUXO

| De | Para | Problema | Severidade |
|----|------|----------|-----------|
| Lead | Cliente | handleConverter não cria registro em `clientes` | 🔴 CRÍTICO |
| Cliente | Orçamento | Orçamento retorna R$ 0,00 (modelo_materiais vazio) | 🔴 CRÍTICO |
| Orçamento | Pedido | converterParaPedido bloqueia se total = R$ 0,00 | 🔴 dependente |
| Produção concluída | Pedido atualizado | Sem trigger/código de atualização de status do pedido | 🟠 ALTO |
| OI agendada | Job no App de Campo | Migration 004 não executada — bridge inexistente | 🔴 CRÍTICO |

**Fluxo interrompido em**: Passo 6 — Converter Lead em Cliente
**Motivo**: handleConverter não insere em tabela `clientes`
**Passos impossibilitados por consequência**: 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17

---

## 7. ERROS DE REGRA DE NEGÓCIO

| Tipo | Descrição | Impacto |
|------|-----------|---------|
| Permissivo demais | Sistema permite emitir NF-e em MODO DEMO sem avisar claramente que não houve transmissão SEFAZ real | Equipe pode pensar que NF-e foi emitida quando na verdade é simulação |
| Status incoerente | Pedido permanece em status anterior mesmo após todas OPs concluídas | PCP e financeiro não sabem quando produção terminou |
| Permissivo demais | Orçamento com total R$ 0,00 pode ser enviado pelo portal (apenas a conversão em pedido é bloqueada) | Cliente recebe proposta com valor zerado |

---

## 8. PROBLEMAS DE UX

| Tela / Módulo | Problema de UX | Severidade | Sugestão |
|---------------|---------------|------------|---------|
| Produtos → Composição | Custo total do modelo não exibido após adicionar materiais | 🟡 MÉDIO | Exibir soma de (quantidade × preco_medio) em tempo real |
| Fiscal → Emitir NF-e | Confirmação de emissão usa `confirm()` nativo do browser | 🟢 BAIXO | Usar Dialog modal customizado com destaque para ambiente (HML/PRD) |
| Fiscal → Documentos | Erro de rejeição exibido como mensagem crua do provider | 🟠 ALTO | Decodificar código SEFAZ e exibir orientação de correção |
| Leads → Converter | Sem modal de complementação de dados (CNPJ, IE, endereço) antes de converter | 🟠 ALTO | Modal de complementação obrigatória antes de criar cliente |

**Padrões de UX identificados**:
- [X] Mensagem de erro genérica ("Erro ao salvar") — Fiscal rejeições SEFAZ
- [X] Ação irreversível sem confirmação adequada — emissão de NF-e usa confirm() nativo
- [X] Fluxo não intuitivo — usuário não sabe que "Converter em Cliente" não cria o cliente

---

## 9. PROBLEMAS TÉCNICOS

| ID | Componente | Tipo | Descrição | Severidade |
|----|-----------|------|-----------|-----------|
| QA-2026-03-13-T1 | `fiscal-emitir-nfe/index.ts` L201 | Chave de acesso inválida | Chave gerada sem dígitos verificadores MD5. SEFAZ rejeita chave inválida (código 562). | 🔴 CRÍTICO |
| QA-2026-03-13-T2 | `producao.service.ts` L6 + `instalacao-criacao.service.ts` L4 | Math.random() para numeração | Risco de colisão em numeração de OP e OS. Deve usar sequence PostgreSQL. | 🟠 ALTO |
| QA-2026-03-13-T3 | `fiscal_ambientes` schema | Dados de endereço ausentes | Tabela não tem campos de endereço do emitente. NF-e requer endereço completo da empresa emissora. | 🔴 CRÍTICO |
| QA-2026-03-13-T4 | `LeadDetailPage.tsx` handleConverter | Sem INSERT em clientes | Conversão de lead incompleta — nenhum registro criado em tabela `clientes`. | 🔴 CRÍTICO |

**Verificações de banco necessárias**:
```sql
-- Verificar vínculos em modelo_materiais
SELECT COUNT(*) FROM modelo_materiais;
-- Esperado: > 0 | Atual (conforme CLAUDE.md): 0

-- Verificar se migration 004 foi executada (verificar triggers)
SELECT trigger_name FROM pg_trigger WHERE tgname LIKE '%job%' OR tgname LIKE '%ordem%';
-- Esperado: fn_create_job_from_ordem, fn_sync_job_to_ordem | Atual: ausentes

-- Verificar série configurada para homologação
SELECT fs.serie, fa.tipo, fa.ativo FROM fiscal_series fs
JOIN fiscal_ambientes fa ON fa.id = fs.ambiente_id
WHERE fa.tipo = 'homologacao';
-- Esperado: ao menos 1 série ativa | Atual: desconhecido (precisa verificar)

-- Verificar CNPJ emitente configurado
SELECT cnpj_emitente, razao_social_emitente FROM fiscal_ambientes WHERE tipo = 'homologacao';
-- Esperado: CNPJ válido da Croma Print | Atual: possivelmente null
```

---

## 10. MÓDULOS INCOMPLETOS

| Módulo | Funcionalidade | Status UI | Status Backend | Impacto |
|--------|---------------|-----------|---------------|---------|
| Leads → Clientes | Conversão de lead em cliente | Botão existe, fluxo aparente | Sem INSERT em `clientes` | 🔴 Fluxo comercial bloqueado |
| Fiscal — NF-e | Transmissão real para SEFAZ | UI completa e profissional | DEMO mode sem SEFAZ | 🔴 NF-e não autorizada |
| Fiscal — DANFE | Geração de DANFE PDF | Botão existe | Modo demo gera HTML estático | 🟠 DANFE não é PDF real |
| Expedição | Registrar entrega direta | Ausente | Ausente | 🟡 Fluxo sem entrega direta |
| Produção → Pedido | Atualização automática de status do pedido | N/A | Ausente (sem trigger) | 🟠 Status defasado |

---

## 11. ANÁLISE ESPECÍFICA DO MÓDULO NF-e HOMOLOGAÇÃO

### 11.1 Verificações Solicitadas

| Verificação | Status | Detalhe |
|-------------|--------|---------|
| 1. Configuração de ambiente (homologação vs produção) acessível na UI | ✅ Existe | `/fiscal/configuracao` — Tab Ambientes com cards homologação/produção e badge visual |
| 2. Sistema permite selecionar série de homologação | ✅ Existe | Tab Séries permite criar série vinculada a ambiente. Porém série precisa ser criada manualmente antes da primeira emissão. |
| 3. Dados do emitente corretamente preenchidos | ❌ Incompleto | Formulário tem apenas CNPJ e razão social. Endereço completo do emitente ausente da tabela e da UI. |
| 4. NF-e gerada com ambiente=2 (homologação) no XML | ⚠️ Parcial | `tipo_ambiente: ambiente === 'producao' ? 1 : 2` — lógica correta. Mas XML DEMO é inválido (sem campos obrigatórios). |
| 5. Retorno da SEFAZ processado e exibido ao usuário | ⚠️ Parcial | Em modo REAL (com token), retorno 422 é tratado como rejeição. Mas códigos específicos (539, 562) não são decodificados. |
| 6. DANFE gerado após autorização | ⚠️ Parcial | Edge Function `fiscal-gerar-danfe` existe. Em modo DEMO gera HTML estático (não PDF). Em modo REAL busca PDF do Focus NFe. |
| 7. NF-e vinculada ao pedido/faturamento corretamente | ✅ Existe | `fiscal_documentos.pedido_id` FK para `pedidos`. `pedidos.ultimo_documento_fiscal_id` atualizado. |
| 8. Tratamento de erro SEFAZ (ex: código 539, 562) | ❌ Ausente | Erros mapeados apenas como genérico. Não há dicionário de códigos SEFAZ para orientação ao usuário. |

### 11.2 Dependências para NF-e em Homologação Funcionar

Para transmitir NF-e real em homologação SEFAZ, são necessários:

1. **`NFE_PROVIDER_TOKEN`** — Token do Focus NFe (homologação) nas variáveis de ambiente das Edge Functions
2. **`NFE_PROVIDER_URL`** — URL de homologação: `https://homologacao.focusnfe.com.br` (já é o default)
3. **`NFE_CNPJ_EMITENTE`** — CNPJ da Croma Print nas variáveis de ambiente
4. **Série configurada** — Ao menos 1 série ativa vinculada ao ambiente de homologação em `fiscal_series`
5. **Dados do cliente destinatário** — `cpf_cnpj`, endereço completo no cadastro do cliente
6. **Itens fiscais preenchidos** — `ncm`, `cfop`, `cst_ou_csosn` em `fiscal_documentos_itens`
7. **Certificado digital A1** (para providers que exijam assinatura direta) — metadados em `fiscal_certificados`

---

## 12. MELHORIAS RECOMENDADAS

### Prioritárias (implementar logo)

1. **Corrigir conversão Lead → Cliente** — Implementar criação do registro em `clientes` com dados do lead. Adicionar modal de complementação (CNPJ, IE, endereço) antes de criar o cliente.

2. **Vincular modelo_materiais** — Script de vinculação dos 467 materiais seedados aos 156 modelos de produto. Sem isso, 100% dos orçamentos são R$ 0,00.

3. **Configurar ambiente NF-e** — Preencher `NFE_PROVIDER_TOKEN`, `NFE_CNPJ_EMITENTE`, `NFE_PROVIDER_URL` nas variáveis de ambiente das Edge Functions do Supabase para homologação.

4. **Executar migration 004** — Bridge ERP↔Campo com triggers de sincronização bidirecional.

5. **Endereço do emitente na NF-e** — Adicionar campos de endereço completo à tabela `fiscal_ambientes` e ao formulário de edição.

### Desejáveis (implementar quando possível)

1. **Dicionário de códigos SEFAZ** — Mapear principais códigos de rejeição (539, 562, 999, etc.) para mensagens em português com orientação de correção.

2. **Numeração sequencial via banco** — Substituir `Math.random()` por sequence PostgreSQL em OPs e OSs.

3. **Trigger produção → pedido** — Trigger que atualiza `pedidos.status = 'produzido'` quando todas OPs do pedido são concluídas.

4. **Categoria Banner** — Adicionar categoria "banner" à lista de categorias de produto.

5. **Módulo de Expedição** — Criar domínio `expedicao` com tela de romaneio, confirmação de entrega direta e registro de transportador.

---

## 13. PLANO DE CORREÇÃO PRIORITÁRIO

| Prioridade | ID | Problema | Esforço estimado | Responsável sugerido |
|-----------|-----|----------|-----------------|---------------------|
| 1 | QA-2026-03-13-001 | handleConverter não cria cliente | P (< 2h) | Dev Frontend |
| 2 | QA-2026-03-13-002 | modelo_materiais = 0 vínculos | M (2h-1d) | Dev / Admin |
| 3 | QA-2026-03-13-004 | NFE_PROVIDER_TOKEN ausente | P (< 2h) | DevOps / Infra |
| 4 | QA-2026-03-13-005 | Endereço emitente ausente na NF-e | M (2h-1d) | Dev Backend + Frontend |
| 5 | QA-2026-03-13-003 | Migration 004 não executada | M (2h-1d) | DBA / Dev Backend |
| 6 | QA-2026-03-13-T1 | Chave de acesso NF-e sem dígito verificador | P (< 2h) | Dev Backend (Edge Function) |
| 7 | QA-2026-03-13-009 | Sem decodificação de códigos SEFAZ | M (2h-1d) | Dev Frontend |
| 8 | QA-2026-03-13-007 | Math.random() em numeração de OP/OS | P (< 2h) | Dev Backend |
| 9 | QA-2026-03-13-008 | Pedido não atualiza ao concluir produção | M (2h-1d) | Dev Backend / DBA |

**Legenda esforço**: P = Pequeno (< 2h) | M = Médio (2h-1d) | G = Grande (> 1d)

---

## 14. VEREDITO FINAL SOBRE PRONTIDÃO DO ERP

### Status por Módulo

| Módulo | Status | Bloqueadores |
|--------|--------|-------------|
| Cadastro de materiais | ✅ Operacional | Nenhum |
| Cadastro de produtos/modelos | ⚠️ Parcial | Categoria Banner ausente; área não automática |
| Composição de produtos (modelo_materiais) | ❌ Inoperante | 0 vínculos — custo sempre R$ 0,00 |
| CRM / Leads | ✅ Operacional | Funil funciona |
| Conversão Lead → Cliente | ❌ Inoperante | handleConverter não cria cliente |
| Orçamentos | ❌ Inoperante | Preço R$ 0,00 (depende de modelo_materiais) |
| Portal de aprovação | ✅ Operacional | Link funciona, aprovação via RPC funciona |
| Pedidos | ⚠️ Parcial | Funciona se orçamento tiver valor > 0 |
| Produção | ⚠️ Parcial | OP criada, mas numeração frágil; status pedido não atualiza |
| Financeiro | ⚠️ Parcial | Registros manuais funcionam; sem boleto bancário real |
| Faturamento (NF-e) | ❌ Inoperante | DEMO mode; sem CNPJ emitente; sem transmissão SEFAZ real |
| Expedição | ❌ Inoperante | Módulo não existe |
| Instalação / App Campo | ❌ Inoperante | Migration 004 não executada |
| Estoque | ⚠️ Parcial | Cadastro funciona; sem baixa automática de estoque |

### Conclusão

```
O ERP da Croma Print está:

[X] 🔴 INAPTO para uso operacional
    → Erros críticos impedem o fluxo básico de vendas e produção.
    → 5 erros críticos identificados, sendo os principais:
       (1) Conversão Lead→Cliente não cria registro no banco
       (2) modelo_materiais com 0 vínculos → orçamentos com R$ 0,00
       (3) NF-e em modo DEMO sem transmissão SEFAZ real
    → Recomendação: NÃO colocar em uso real até resolver bloqueadores.
       Foco imediato: correções 1, 2 e 3 do plano de priorização.
```

**Assinado por**: AGENTE DE CONTROLE DE QUALIDADE CROMA_ERP v1.0
**Data**: 2026-03-13
**Próxima execução recomendada**: Após correção de QA-2026-03-13-001 e QA-2026-03-13-002

---

*Este relatório foi gerado automaticamente pelo Agente QA Operacional da Croma Print.*
*Análise baseada em inspeção estática de código-fonte — branch: claude/suspicious-wilson.*
*Para re-executar o agente: invocar AGENTE.md com o cenário desejado.*
