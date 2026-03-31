# xQuads Data Squad - Auditoria de Arquitetura de Dados
## ERP Croma Print do Brasil
**Data**: 2026-03-17 | **Auditor**: Datum (Data Chief) | **Versao**: 1.0
**Supabase**: djwjmfgplnqyffdcgdaw.supabase.co | **Prod**: https://crm-croma.vercel.app/

---

## 1. Inventario de Tabelas e Relacoes

### 1.1 Mapa Completo de Tabelas (70+ tabelas)

```
CORE ADMIN (7)
  profiles ── auth.users
  roles
  permissions
  role_permissions ── roles, permissions
  audit_logs ── profiles
  attachments ── profiles
  notas_internas ── profiles
  admin_config

COMERCIAL (8)
  lead_sources
  leads ── lead_sources, profiles, campanhas
  oportunidades ── leads, clientes, profiles
  atividades_comerciais ── profiles
  tarefas_comerciais ── profiles
  metas_vendas ── profiles
  campanhas
  campanha_destinatarios ── campanhas, clientes, leads

CLIENTES (3)
  clientes ── profiles, leads
  cliente_unidades ── clientes
  cliente_contatos ── clientes

PRODUTOS E PRECIFICACAO (11)
  produtos ── categorias_produto
  produto_modelos ── produtos
  modelo_materiais ── produto_modelos, materiais
  modelo_processos ── produto_modelos
  categorias_produto
  config_precificacao
  regras_precificacao ── profiles
  templates_orcamento ── profiles
  faixas_quantidade ── regras_precificacao
  maquinas
  materiais_historico_preco ── materiais, profiles

PROPOSTAS / ORCAMENTOS (8)
  propostas ── oportunidades, clientes, profiles
  proposta_itens ── propostas, produtos, produto_modelos
  proposta_item_materiais ── proposta_itens, materiais
  proposta_item_acabamentos ── proposta_itens, acabamentos
  proposta_servicos ── propostas, servicos
  proposta_views ── propostas
  proposta_attachments ── propostas
  orcamento_item_maquinas ── proposta_itens, maquinas
  acabamentos
  servicos

PEDIDOS (3)
  pedidos ── propostas, clientes, profiles, fiscal_regras_operacao, fiscal_documentos
  pedido_itens ── pedidos, proposta_itens, produtos, produto_modelos
  pedido_historico ── pedidos, profiles

PRODUCAO (4)
  ordens_producao ── pedido_itens, pedidos, profiles
  producao_etapas ── ordens_producao, profiles
  producao_checklist ── ordens_producao, profiles
  producao_retrabalho ── ordens_producao, profiles

ESTOQUE E COMPRAS (9)
  materiais
  estoque_saldos ── materiais
  estoque_movimentacoes ── materiais, profiles
  fornecedores
  pedidos_compra ── fornecedores, profiles
  pedido_compra_itens ── pedidos_compra, materiais
  historico_precos ── fornecedores, materiais
  inventarios ── profiles
  inventario_itens ── inventarios, materiais

FINANCEIRO (8)
  plano_contas
  centros_custo
  contas_receber ── pedidos, clientes, plano_contas, centros_custo
  parcelas_receber ── contas_receber
  contas_pagar ── pedidos_compra, fornecedores, plano_contas, centros_custo
  parcelas_pagar ── contas_pagar
  comissoes ── profiles, pedidos, contas_receber
  notifications ── auth.users

BANKING (6)
  bank_accounts
  bank_slips ── bank_accounts, contas_receber, pedidos, clientes
  bank_remittances ── bank_accounts, auth.users
  bank_remittance_items ── bank_remittances, bank_slips
  bank_returns ── bank_accounts, auth.users
  bank_return_items ── bank_returns, bank_slips

INSTALACAO E CAMPO (10)
  equipes
  ordens_instalacao ── pedidos, pedido_itens, clientes, cliente_unidades, equipes
  field_tasks ── ordens_instalacao, profiles
  field_checklists ── field_tasks
  field_media ── field_tasks
  field_signatures ── field_tasks
  ferramentas
  checkout_almoxarife ── ferramentas, pedidos, profiles
  diario_bordo ── ferramentas, profiles
  checklists / checklist_itens / checklist_execucoes / checklist_execucao_itens

CAMPO LEGACY (jobs/stores)
  jobs ── stores, profiles, ordens_instalacao, pedidos
  job_photos ── jobs
  job_videos ── jobs
  stores ── clientes, cliente_unidades
  campo_audit_logs
  company_settings

QUALIDADE (2)
  ocorrencias ── pedidos, ordens_producao, ordens_instalacao, profiles, fornecedores
  ocorrencia_tratativas ── ocorrencias, profiles

FISCAL (8)
  fiscal_ambientes
  fiscal_series ── fiscal_ambientes
  fiscal_certificados ── fiscal_ambientes, profiles
  fiscal_regras_operacao ── fiscal_series, fiscal_ambientes
  fiscal_documentos ── pedidos, clientes, fiscal_regras_operacao, fiscal_ambientes, fiscal_series, fiscal_certificados, profiles
  fiscal_documentos_itens ── fiscal_documentos, pedido_itens
  fiscal_eventos ── fiscal_documentos, profiles
  fiscal_xmls ── fiscal_documentos
  fiscal_filas_emissao ── fiscal_documentos
  fiscal_erros_transmissao ── fiscal_documentos
  fiscal_audit_logs ── profiles

AI (2)
  ai_logs ── auth.users
  ai_alertas ── auth.users

DATA OPS (1)
  import_logs ── auth.users
```

---

## 2. Issues Encontradas

### CRITICO

| # | Categoria | Tabela(s) | Descricao |
|---|-----------|-----------|-----------|
| C1 | Soft Delete | ~30 tabelas | **A maioria das tabelas NAO tem excluido_em/excluido_por.** Apenas `propostas` e `jobs` possuem soft delete. Tabelas criticas como `clientes`, `pedidos`, `ordens_producao`, `contas_receber`, `contas_pagar`, `leads`, `fornecedores`, `materiais`, `pedidos_compra`, `comissoes`, `ordens_instalacao` usam apenas flag `ativo` (boolean) ou nenhum mecanismo. Contradiz o padrao documentado no MEMORY.md ("excluido_em + excluido_por em todas as tabelas"). |
| C2 | Integridade Referencial | `estoque_movimentacoes` | `referencia_tipo` e `referencia_id` sao campos polimorficos sem FK real. Nao ha constraint garantindo que `referencia_id` aponta para um registro valido em `pedidos_compra`, `ordens_producao`, etc. Orphan records inevitaveis. |
| C3 | Integridade Referencial | `attachments`, `notas_internas`, `atividades_comerciais` | `entidade_tipo` + `entidade_id` sao campos polimorficos sem FK. Mesma vulnerabilidade de C2 -- nenhuma garantia de integridade referencial. |
| C4 | RLS Permissiva | `clientes`, `pedidos`, `pedido_itens`, `propostas`, `proposta_itens`, `leads`, `contas_receber`, `contas_pagar` | Migration 027 aplica `USING (true) WITH CHECK (true)` -- qualquer usuario autenticado pode ver/editar/deletar TODOS os registros, incluindo dados financeiros sensiveis. A migration 001 faz o mesmo para ~47 tabelas. Isso anula a seguranca por role. |
| C5 | Trigger Inoperante | `ordens_producao` trigger `fn_producao_estoque` | Referencia `NEW.modelo_id` e `NEW.quantidade` mas a tabela `ordens_producao` NAO tem estas colunas. O trigger nao funciona -- estoque NUNCA e atualizado automaticamente por producao. |
| C6 | Trigger Inoperante | `pedidos_compra` trigger `fn_compra_gera_conta_pagar` | Referencia `NEW.data_entrega` e insere em `contas_pagar` com colunas `descricao` e `valor` que NAO existem na tabela (colunas reais: `numero_titulo`, `valor_original`). Trigger falha silenciosamente. |

### ALTO

| # | Categoria | Tabela(s) | Descricao |
|---|-----------|-----------|-----------|
| A1 | Naming Inconsistente | Banking tables | `bank_accounts`, `bank_slips`, `bank_remittances`, `bank_remittance_items`, `bank_returns`, `bank_return_items` usam ingles. Todas as demais tabelas usam portugues (`contas_receber`, `pedidos`, etc.). Violacao do padrao 100% PT-BR estabelecido em migration 002. |
| A2 | Naming Inconsistente | Campo/Legacy tables | `jobs`, `stores`, `job_photos`, `job_videos`, `company_settings`, `campo_audit_logs`, `field_tasks`, `field_checklists`, `field_media`, `field_signatures` -- todas em ingles. |
| A3 | Naming Inconsistente | AI/Import tables | `ai_logs`, `ai_alertas`, `import_logs` -- mistura ingles/portugues. |
| A4 | TypeScript vs Schema | `compras.types.ts` | `PedidoCompraItem.preco_unitario` e `subtotal` nao existem no schema real (colunas reais: `valor_unitario`, `valor_total`). Queries vao falhar silenciosamente ou retornar undefined. |
| A5 | TypeScript vs Schema | `qualidade.types.ts` | `OcorrenciaTipo` inclui `'material_defeituoso'` e `'outro'` que NAO existem no CHECK constraint da tabela `ocorrencias` (validos: `retrabalho`, `devolucao`, `erro_producao`, `erro_instalacao`, `divergencia_cliente`). `Ocorrencia.numero` e `prioridade` nao existem no schema. |
| A6 | TypeScript vs Schema | `estoque.types.ts` | `EstoqueSaldo.quantidade_disponivel` mapeia para coluna real `quantidade_disponivel` no schema, mas a migration 031 trigger `fn_compra_recebimento_estoque` atualiza `quantidade` (que nao existe -- coluna real e `quantidade_disponivel`). |
| A7 | Campos NULL indevidos | `contas_pagar` | `fornecedor_id` aceita NULL. Uma conta a pagar sem fornecedor perde rastreabilidade fundamental. |
| A8 | Campos NULL indevidos | `contas_receber` | `saldo` aceita NULL e nao tem default. Deveria ser calculated (`valor_original - valor_pago`) ou NOT NULL DEFAULT 0. |
| A9 | Index Faltante | `campanha_destinatarios` | Sem index em `cliente_id` e `lead_id` -- queries de "quais campanhas um cliente recebeu" serao slow scans. |
| A10 | Index Faltante | `checkout_almoxarife` | Sem index em `ferramenta_id`, `pedido_id`, `usuario_id`. Tabela operacional consultada frequentemente. |
| A11 | Index Faltante | `diario_bordo` | Sem index em `ferramenta_id`. |
| A12 | FK Faltante | `checkout_almoxarife` | `pedido_id` referencia `pedidos(id)` mas nao tem `ON DELETE` clause definida. |
| A13 | Duplicate Sequence | `propostas` | `proposta_numero_seq` (migration 001) e `propostas_numero_seq` (migration 017) -- duas sequences concorrentes para o mesmo proposito. Triggers `gerar_numero_auto` e `set_proposta_numero` competem; ultimo trigger criado vence. Potencial de numeros duplicados. |

### MEDIO

| # | Categoria | Tabela(s) | Descricao |
|---|-----------|-----------|-----------|
| M1 | Dados Duplicados | `clientes` | `cnpj` e `cpf_cnpj` sao duas colunas para o mesmo dado. `cnpj` veio da migration 001, `cpf_cnpj` da migration 003b (fiscal). Dado pode estar em uma, outra, ou ambas inconsistentemente. |
| M2 | Dados Duplicados | `clientes` | `inscricao_estadual` aparece na criacao original E na migration fiscal. Mesmo campo, potencialmente com valores divergentes. |
| M3 | Check Constraint | `propostas` | Status check reescrito pela migration 020: agora aceita `em_negociacao` (migration 017 CREATE IF NOT EXISTS) mas a migration 020 lista `em_revisao` e nao `em_negociacao`. Conflito de evolucao. |
| M4 | Soft Delete vs Ativo | Multiplas | Padrao misto: `ativo` (boolean) usado em ~15 tabelas, `excluido_em/excluido_por` em ~2 tabelas, nenhum mecanismo em ~20 tabelas. Sem padronizacao. |
| M5 | Trigger updated_at | `ferramentas`, `campanhas`, `checkout_almoxarife`, `diario_bordo` | Estas tabelas tem coluna `updated_at` mas NAO tem trigger de auto-update. Dados serao stale. |
| M6 | Trigger updated_at | `campanha_destinatarios` | Trigger referencia funcao `update_updated_at_column()` mas a funcao real se chama `update_updated_at()`. Trigger falhara. |
| M7 | RLS Inconsistente | `acabamentos` | Policy `autenticados_ver_acabamentos` so permite ver `ativo = true`. Admin nao consegue ver acabamentos inativos para reativa-los via interface. |
| M8 | RLS Inconsistente | `regras_precificacao` | Migration 007 policy `regras_precificacao_select` permite ver tudo; migration 006 policy so mostra `ativo = true`. Ambas coexistem -- a ultima DROP/CREATE vence, mas e fragil. |
| M9 | Coluna Fantasma | `propostas` | `propostas.total` vs `propostas.valor_total` -- migration 001 define `total`, migration 017 nao; codigo pode referenciar `valor_total` que nao existe. Migration 027 confirma que a coluna e `total`. |
| M10 | Sem updated_at | `checklist_itens`, `checklist_execucao_itens`, `producao_checklist`, `producao_retrabalho`, `parcelas_receber`, `parcelas_pagar`, `comissoes`, `metas_vendas`, `lead_sources`, `equipes` | Tabelas sem `updated_at` -- impossivel saber quando um registro foi modificado. |

### BAIXO

| # | Categoria | Tabela(s) | Descricao |
|---|-----------|-----------|-----------|
| B1 | Tipagem | `contas_receber.forma_pagamento` | TEXT sem CHECK constraint -- aceita qualquer valor. Deveria ter enum de formas de pagamento. |
| B2 | Tipagem | `pedido_itens.status` | Nao inclui `em_acabamento` que existe no workflow real. |
| B3 | Naming | `estoque_saldos` | Coluna `quantidade_disponivel` mas `quantidade_reservada` -- padroes OK, mas migration 031 trigger usa `quantidade` (inexistente). |
| B4 | Naming | `estoque_movimentacoes` | `motivo` vs migration 031 trigger que usa `observacao`. Colunas diferentes. |
| B5 | Seed Data | `regras_precificacao` | Migration 006 faz INSERT, migration 007 faz DROP TABLE + CREATE + INSERT. Dados da 006 sao perdidos. Nao e um bug, mas exige execucao sequencial. |
| B6 | Precision | `config_precificacao.percentual_comissao` | NUMERIC(5,2) -- maximo 999.99%. Adequado, mas `faturamento_medio` e NUMERIC(12,2) sem check, poderia aceitar negativos. |
| B7 | Sem Comments | ~15 tabelas novas (017+) | Tabelas criadas a partir da migration 017 nao possuem COMMENT ON TABLE. |

---

## 3. Soft Delete -- Analise Completa

| Tabela | `excluido_em` | `excluido_por` | `ativo` | Mecanismo |
|--------|:---:|:---:|:---:|-----------|
| propostas | SIM | SIM | - | Soft delete OK |
| jobs | SIM (deleted_at) | - | - | Soft delete parcial (sem `por`) |
| clientes | - | - | SIM | Apenas flag ativo |
| leads | - | - | - | NENHUM |
| pedidos | - | - | - | Tem status 'cancelado' |
| ordens_producao | - | - | - | Tem status 'finalizado' |
| ordens_instalacao | - | - | - | Tem status 'nao_concluida' |
| contas_receber | - | - | - | Tem status 'cancelado' |
| contas_pagar | - | - | - | Tem status 'cancelado' |
| fornecedores | - | - | SIM | Apenas flag ativo |
| materiais | - | - | SIM | Apenas flag ativo |
| produtos | - | - | SIM | Apenas flag ativo |
| bank_slips | - | - | - | Tem status 'cancelado' |
| ferramentas | - | - | SIM | Apenas flag ativo |
| campanhas | - | - | - | Tem status 'concluida' |
| Demais (~40 tabelas) | - | - | - | NENHUM |

**Veredicto**: Apenas 2 de 70+ tabelas implementam soft delete conforme o padrao declarado. CRITICO.

---

## 4. RLS -- Row Level Security

### Tabelas COM RLS Habilitado (~55)
Todas as tabelas principais tem RLS habilitado. Porem, a grande maioria usa policies permissivas `USING (true)`.

### Policies Efetivas (por role) -- apenas estas tabelas:
| Tabela | Policy Real |
|--------|------------|
| `job_photos` (storage) | Admin vs Instalador (bem implementado) |
| `job_photos` (table) | Admin vs Instalador |
| `job_videos` (storage + table) | Admin vs Instalador |
| `company_settings` | Admin escrita, todos leitura |
| `campo_audit_logs` | Admin leitura, self insert |
| `acabamentos` | Admin/producao escrita, autenticados leitura |
| `servicos` | Admin/comercial_senior/financeiro escrita |
| `bank_accounts` | Admin/diretor/financeiro escrita |
| `bank_slips` | Admin/diretor/financeiro/comercial escrita |
| `checklists` e derivados | Admin/pcp/producao/instalacao escrita |
| `maquinas` | Admin/gerente escrita |
| `ai_logs` | User reads own only |

### Tabelas com RLS `USING (true)` -- TODOS autenticados podem tudo:
`clientes`, `pedidos`, `pedido_itens`, `propostas`, `proposta_itens`, `leads`, `contas_receber`, `contas_pagar`, `fornecedores`, `materiais`, `ordens_producao`, `ordens_instalacao`, `comissoes`, `parcelas_receber`, `parcelas_pagar`, `equipes`, `inventarios`, `inventario_itens`, + ~25 outras.

**Veredicto**: Seguranca efetiva apenas em storage e poucas tabelas operacionais. Dados financeiros e comerciais totalmente expostos a qualquer usuario autenticado. CRITICO.

---

## 5. Indexes -- Analise

### Bem cobertos:
- Todas as FKs principais em `pedidos`, `propostas`, `proposta_itens`, `pedido_itens`, `ordens_producao`, `contas_receber`, `contas_pagar`, `comissoes`
- Indexes de status em tabelas transacionais
- Indexes compostos em `atividades_comerciais`, `tarefas_comerciais`
- Fiscal module: indexes completos em todas as tabelas

### Faltando:
| Tabela | Coluna(s) sem Index | Impacto |
|--------|-------------------|---------|
| `checkout_almoxarife` | `ferramenta_id`, `pedido_id`, `usuario_id` | Queries lentas de checkout aberto |
| `diario_bordo` | `ferramenta_id`, `realizado_por` | Historico por equipamento lento |
| `campanha_destinatarios` | `cliente_id`, `lead_id` | Join com clientes lento |
| `ferramentas` | `categoria` | Filtro por tipo lento |
| `notifications` | `entidade_tipo, entidade_id` | Lookup de notificacoes por entidade |
| `proposta_attachments` | `uploaded_by_type` | Filtro de uploads do cliente |

---

## 6. Tipagem TypeScript vs Schema Real -- Divergencias

| Arquivo TS | Campo TS | Campo Real (SQL) | Tipo |
|------------|----------|-----------------|------|
| `compras.types.ts` | `PedidoCompraItem.preco_unitario` | `valor_unitario` | Nome errado |
| `compras.types.ts` | `PedidoCompraItem.subtotal` | `valor_total` | Nome errado |
| `qualidade.types.ts` | `Ocorrencia.numero` | NAO EXISTE | Campo fantasma |
| `qualidade.types.ts` | `Ocorrencia.prioridade` | NAO EXISTE | Campo fantasma |
| `qualidade.types.ts` | `OcorrenciaTipo` includes `material_defeituoso`, `outro` | CHECK nao inclui estes | Enum errado |
| `qualidade.types.ts` | `Tratativa.usuario_id` | `responsavel_id` | Nome errado |
| `estoque.types.ts` | `InventarioItem.observacoes` | `justificativa` | Nome errado |
| `ordem-servico.ts` | `OSCliente.contato_nome` | NAO EXISTE em `clientes` | Campo fantasma |

---

## 7. Fluxo de Dados entre Modulos -- Inconsistencias

### 7.1 Proposta -> Pedido
- Proposta usa `total`; pedido usa `valor_total`. Conversao requer mapeamento manual.
- `proposta_itens` tem `custo_mp`, `custo_mo`, `custo_fixo`, `markup_percentual`. `pedido_itens` recebeu estes na migration 007. OK.

### 7.2 Pedido -> Producao
- `ordens_producao` tem `pedido_item_id` FK. OK.
- MAS: trigger `fn_producao_estoque` tenta usar `NEW.modelo_id` que NAO EXISTE em `ordens_producao`. **Estoque nunca atualiza via producao.**

### 7.3 Pedido -> Financeiro
- `contas_receber.pedido_id` FK. OK.
- `bank_slips.pedido_id` FK. OK.
- `bank_slips.conta_receber_id` FK. OK.
- MAS: Nao ha trigger automatico pedido aprovado -> conta a receber. E manual.

### 7.4 Compras -> Estoque
- Trigger `fn_compra_recebimento_estoque` existe mas referencia `estoque_saldos.quantidade` (coluna real: `quantidade_disponivel`). **Trigger falha.**

### 7.5 Compras -> Financeiro
- Trigger `fn_compra_gera_conta_pagar` referencia colunas inexistentes. **Trigger falha.**

### 7.6 NF-e -> Pedido
- Trigger `fiscal_sincronizar_status_pedido` funciona corretamente.
- Funcao `fiscal_criar_rascunho_nfe` funciona corretamente.

---

## 8. Gaps vs Mubisys

### Tabelas/Funcionalidades que existem no Mubisys e FALTAM no CRM Croma:

| # | Feature Mubisys | Status Croma | Prioridade |
|---|----------------|-------------|------------|
| G1 | **Estoque fracionado** (mapa visual de retalhos de bobinas, margens Sup/Inf/Esq/Dir) | NAO EXISTE | ALTA |
| G2 | **Chat interno (MubiChat)** -- tickets Meus/Espera/Todos | NAO EXISTE | MEDIA |
| G3 | **Permissoes granulares por menu/submenu** (3 grupos x 2 niveis) | Tabelas `roles`/`permissions` existem mas RLS e permissivo (true) | ALTA |
| G4 | **Log de acesso completo** (usuario, tela, acao com valores R$ old->new, data, IP, "Automacao MubiSys") | `audit_logs` existe mas sem trigger automatico global. `fiscal_audit_logs` tem trigger. | ALTA |
| G5 | **Funil de vendas visual (Kanban)** | `oportunidades` com `fase` existe, mas sem view Kanban | MEDIA |
| G6 | **Semaforo estoque** (verde/amarelo/vermelho baseado em minimo/ideal) | `estoque_minimo` existe em `materiais` mas sem `estoque_ideal` | BAIXA |
| G7 | **Condicao pagamento impacta precificacao (TF)** | `condicoes_pagamento` e TEXT livre, sem calculo TF | MEDIA |
| G8 | **10 componentes de preco** (MP, CF, MO, TF, CI, CE, TB, TR, DT, ML) | Apenas MP, MO, CF (custo_fixo). Faltam 7 componentes | ALTA |
| G9 | **Acabamento altera dimensoes** ("Alteracao de producao" +15cm para dobras) | Acabamento nao tem campos de alteracao dimensional | MEDIA |
| G10 | **Acabamento tem BOM com desperdicio** (ex: 6 grampos -> 6.9 com 15% desp.) | `proposta_item_acabamentos` nao tem campo de desperdicio | MEDIA |
| G11 | **Equipamento com tipos** (plotters m2/h R$/m2 vs CNC R$/hora) | `maquinas` existe mas sem `velocidade_m2h` ou unidade de custo diferenciada | MEDIA |
| G12 | **MubiDrive** (file manager 5GB, Ano/Mes/OS/Arquivos) | OneDrive integration parcial, sem estrutura de folders por OS automatica | BAIXA |
| G13 | **Dual numbering** (Orcamento n sequencial vs ID PK compartilhado com OS) | `propostas.numero` e sequencial, `pedidos.numero` separado. Nao ha ID compartilhado | BAIXA |
| G14 | **Bloqueio financeiro em producao** (OS com inadimplencia NAO vai para producao) | Nenhum trigger/check implementado | ALTA |
| G15 | **NF vinculada a OS** ("Buscar dados de O.S.") | `fiscal_documentos.pedido_id` existe, mas nao puxa itens da OS automaticamente | MEDIA |
| G16 | **Faturamento em lote** (OS concluidas/entregues por checkbox) | Feature flag existe, implementacao no frontend, sem tabela de lote | BAIXA |
| G17 | **Conciliacao bancaria** (comparacao banco vs sistema por dia) | Tabelas de retorno bancario existem, sem view de conciliacao | MEDIA |
| G18 | **3 canais de observacao por OS** (Cliente, Producao, Financeiro) | `observacoes` e campo unico TEXT em pedidos/propostas | MEDIA |
| G19 | **9 setores de producao** com auto-routing | `producao_etapas` e generico, sem setores pre-definidos nem routing rules | ALTA |
| G20 | **Meta vendedor alimenta funil** (campo Meta no Usuario -> Meta mensal no Funil) | `metas_vendas` existe separada de `profiles`, sem vinculo automatico | BAIXA |

---

## 9. Score de Maturidade de Dados por Dominio (0-10)

| Dominio | Score | Justificativa |
|---------|:-----:|---------------|
| **Fiscal (NF-e)** | 8.5 | Schema mais completo e bem estruturado. FKs corretas, indexes completos, triggers funcionais, RLS com SECURITY DEFINER RPCs. Falta apenas RLS granular nas tabelas fiscais (usam permissive do 001). |
| **Banking/Boletos** | 7.5 | Schema robusto, tipos bem definidos, lifecycle completo. Naming em ingles (-1), RLS adequada por role. TypeScript alinhado com schema. |
| **Produtos/Precificacao** | 7.0 | Hierarquia Produto->Modelo->Materiais bem modelada. Regras de precificacao evoluiram (3 migrations). Faltam componentes Mubisys (G8). |
| **Propostas/Orcamentos** | 6.5 | Schema funcional com custeio detalhado. Portal do cliente sofisticado. Soft delete presente. Problemas: conflito de sequences (A13), coluna `total` vs `valor_total` (M9). |
| **Pedidos** | 6.0 | Schema solido com historico. Optimistic locking (version). Falta soft delete, 3 canais de observacao, bloqueio financeiro. |
| **Instalacao/Campo** | 6.0 | Dois sistemas coexistem (legacy jobs + CRM ordens_instalacao) com bridge triggers. Checklists detalhados. Naming misto EN/PT. |
| **Clientes** | 5.5 | Estrutura boa (unidades, contatos). Dados duplicados cnpj/cpf_cnpj (M1). RLS permissiva. Sem soft delete real. |
| **Producao** | 5.0 | Schema basico funcional. Trigger de estoque INOPERANTE (C5). Sem setores pre-definidos (G19). Sem routing automatico. |
| **Estoque/Compras** | 4.5 | Materiais e saldos OK. Triggers de integracao INOPERANTES (C5, C6, A6). Sem estoque fracionado (G1). TypeScript desalinhado (A4). |
| **Financeiro** | 4.5 | Contas receber/pagar funcionais. Saldo nullable (A8). RLS permissiva em dados sensiveis (C4). Sem automacao pedido->CR. |
| **Comercial** | 4.0 | Leads, oportunidades existem. Sem soft delete. Funil visual ausente (G5). Campanhas basicas. |
| **Qualidade** | 3.5 | Schema minimo. TypeScript com campos fantasma (A5). Sem numero sequencial. Tratativas basicas. |
| **Core/Admin** | 3.0 | Roles e permissions existem mas nao sao usadas (RLS permissiva). Audit logs sem trigger global. |

**Score Geral Ponderado: 5.3/10**

---

## 10. Plano de Acao Priorizado

### Sprint 1 -- CRITICOS (Semana 1)

| # | Acao | Tabelas Afetadas | Esforco |
|---|------|-----------------|---------|
| 1 | **Corrigir trigger `fn_producao_estoque`**: adicionar `modelo_id` a `ordens_producao` OU refazer trigger para buscar modelo via `pedido_item_id -> pedido_itens.modelo_id` | `ordens_producao` | 2h |
| 2 | **Corrigir trigger `fn_compra_gera_conta_pagar`**: alinhar nomes de colunas com schema real de `contas_pagar` | `contas_pagar` | 1h |
| 3 | **Corrigir trigger `fn_compra_recebimento_estoque`**: `quantidade` -> `quantidade_disponivel` | `estoque_saldos` | 30min |
| 4 | **Implementar soft delete padronizado**: adicionar `excluido_em TIMESTAMPTZ` + `excluido_por UUID REFERENCES profiles(id)` nas 10 tabelas transacionais mais criticas (clientes, pedidos, pedido_itens, ordens_producao, ordens_instalacao, contas_receber, contas_pagar, fornecedores, leads, materiais) | 10 tabelas | 3h |
| 5 | **RLS granular minima**: substituir `USING (true)` por policies baseadas em role para `contas_receber`, `contas_pagar`, `comissoes` (financeiro/admin) e `config_precificacao` (admin) | 4 tabelas | 4h |

### Sprint 2 -- ALTOS (Semana 2)

| # | Acao | Tabelas Afetadas | Esforco |
|---|------|-----------------|---------|
| 6 | **Corrigir TypeScript types**: `compras.types.ts` (`preco_unitario`->`valor_unitario`, `subtotal`->`valor_total`), `qualidade.types.ts` (remover `numero`, `prioridade`, alinhar `tipo` enum), `estoque.types.ts` (`observacoes`->`justificativa`) | 3 arquivos | 2h |
| 7 | **Unificar cnpj/cpf_cnpj**: migration para copiar dados de `cnpj` para `cpf_cnpj` onde `cpf_cnpj IS NULL`, depois deprecar `cnpj` ou manter como computed | `clientes` | 2h |
| 8 | **Indexes faltantes**: `checkout_almoxarife(ferramenta_id, pedido_id, usuario_id)`, `diario_bordo(ferramenta_id)`, `campanha_destinatarios(cliente_id, lead_id)`, `notifications(entidade_tipo, entidade_id)` | 4 tabelas | 1h |
| 9 | **Triggers updated_at**: adicionar para `ferramentas`, `campanhas`, `checkout_almoxarife`, `diario_bordo`. Corrigir nome da funcao em `campanha_destinatarios` | 5 tabelas | 1h |
| 10 | **Resolver conflito de sequences**: remover `propostas_numero_seq` e trigger `set_proposta_numero` (migration 017), manter apenas `gerar_numero_auto` (migration 001) | `propostas` | 1h |

### Sprint 3 -- MEDIOS (Semana 3-4)

| # | Acao | Tabelas Afetadas | Esforco |
|---|------|-----------------|---------|
| 11 | **Padronizar naming EN -> PT**: renomear tabelas banking para `contas_bancarias`, `boletos`, `remessas`, `remessa_itens`, `retornos`, `retorno_itens` com views de compatibilidade | 6 tabelas | 4h |
| 12 | **Implementar bloqueio financeiro** (G14): trigger que impede `ordens_producao.status = 'em_producao'` se cliente tem `contas_receber` vencidas | 2 tabelas | 3h |
| 13 | **Adicionar campos Mubisys faltantes**: `estoque_ideal` em `materiais`, `aproveitamento_percentual` em `proposta_itens`, `3 canais de observacao` em `pedidos` (obs_cliente, obs_producao, obs_financeiro) | 3 tabelas | 2h |
| 14 | **Audit log global**: criar trigger generico que insere em `audit_logs` para operacoes de INSERT/UPDATE/DELETE em tabelas criticas | ~15 tabelas | 4h |
| 15 | **Saldo calculado**: adicionar trigger ou generated column para `contas_receber.saldo` = `valor_original - valor_pago` | `contas_receber` | 1h |

### Sprint 4 -- Gaps Mubisys (Semana 5-6)

| # | Acao | Esforco |
|---|------|---------|
| 16 | Modelar estoque fracionado (G1): tabela `estoque_retalhos` com dimensoes, mapa visual | 8h |
| 17 | Implementar 10 componentes de preco (G8): adicionar campos TF, CI, CE, TB, TR, DT, ML em `proposta_itens` e `config_precificacao` | 4h |
| 18 | Setores de producao pre-definidos (G19) com routing rules | 6h |
| 19 | Permissoes granulares efetivas (G3): RLS baseada em `role_permissions` | 8h |
| 20 | Chat interno MubiChat (G2) | 12h |

---

## 11. Resumo Executivo

### Pontos Fortes
- Schema fiscal (NF-e) e o mais maduro e bem arquitetado do projeto
- Banking/Boletos com CNAB 400 bem estruturado
- Hierarquia de produtos (Produto -> Modelo -> Materiais -> Processos) alinhada ao Mubisys
- Portal do cliente com tracking de views, compartilhamento por token, e aprovacao
- Optimistic locking em tabelas transacionais (version column)
- Checklists operacionais detalhados com seed data real
- 460+ materiais com precos do Mubisys importados

### Riscos Principais
1. **3 triggers de integracao entre modulos estao INOPERANTES** (producao-estoque, compras-estoque, compras-financeiro) -- dados inconsistentes silenciosamente
2. **RLS permissiva** em ~47 tabelas -- qualquer usuario autenticado acessa tudo
3. **Soft delete nao implementado** conforme padrao declarado -- exclusoes fisicas nao-rastreaveiss
4. **TypeScript desalinhado do schema** em 3 dominios -- bugs silenciosos em runtime
5. **20 gaps funcionais vs Mubisys** -- precificacao, estoque fracionado e permissoes sao os mais criticos

### Metrica de Saude
```
Tabelas totais:        ~75
Com RLS habilitado:    ~55 (73%) -- mas ~47 sao permissivas
Com soft delete real:  2 (2.7%)
Com indexes em FKs:    ~50 (67%)
Triggers funcionais:   ~12 de ~15 (80%)
TS alinhado ao schema: ~65%
Score geral:           5.3/10
```

---

*Relatorio gerado por Datum -- xQuads Data Squad*
*Metodologia: Analise estatica de 36 migrations SQL + 7 arquivos de tipos TypeScript + 14 arquivos de servicos*
