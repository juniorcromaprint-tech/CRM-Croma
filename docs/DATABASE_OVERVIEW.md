# CROMA PRINT — MODELO DE BANCO DE DADOS

> Supabase PostgreSQL | 65 tabelas organizadas por dominio
> Migrations: `supabase/migrations/001-006`
> Atualizado: 2026-03-10

---

## 1. Visao Geral

O banco de dados esta organizado em **9 dominios de negocio** + **1 dominio administrativo**:

```
┌─────────────────────────────────────────────────────────────┐
│                    BANCO DE DADOS (65 tabelas)               │
│                                                              │
│  ADMIN (6)        COMERCIAL (9)       CLIENTES (4)          │
│  roles             leads               clientes              │
│  permissions       oportunidades       cliente_unidades      │
│  role_permissions  propostas           cliente_contatos      │
│  registros_audit.  proposta_itens      cliente_documentos    │
│  attachments       proposta_versoes                          │
│  notas_internas    atividades_comerc.                        │
│                    tarefas_comerciais                        │
│                    metas_vendas                              │
│                    comissoes                                 │
│                                                              │
│  ORCAMENTO (7)    PEDIDOS (3)         PRODUCAO (7)          │
│  acabamentos       pedidos             ordens_producao       │
│  servicos          pedido_itens        producao_etapas       │
│  prop_item_mats    pedido_historico    producao_checklist     │
│  prop_item_acabam                      producao_retrabalho   │
│  proposta_servicos                     producao_apontamentos │
│  regras_precif.                        producao_materiais    │
│  templates_orcam.                                            │
│                                                              │
│  ESTOQUE (4)      COMPRAS (7)         FINANCEIRO (8)        │
│  materiais         fornecedores        contas_receber        │
│  estoque_saldos    solicitacoes_comp.  parcelas_receber      │
│  estoque_movim.    cotacoes_compra     contas_pagar          │
│  estoque_invent.   pedidos_compra      parcelas_pagar        │
│                    pedido_compra_it.   plano_contas          │
│                    recebimentos        centros_custo         │
│                    recebimento_itens   lancamentos_caixa     │
│                    historico_precos    config_precificacao    │
│                                                              │
│  INSTALACAO (4)   QUALIDADE (3)       CAMPO (4)             │
│  ordens_instal.    ocorrencias         tarefas_campo         │
│  equipes           ocorr_tratativas    campo_checklists      │
│  equipe_membros    ocorr_custos        campo_midias          │
│  agenda_instal.                        campo_assinaturas     │
│  veiculos                                                    │
│                                                              │
│  PRODUTOS (3)     NOTIFICACOES (1)                          │
│  produtos          notificacoes                              │
│  produto_modelos                                             │
│  modelo_materiais                                            │
│  modelo_processos                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Convencoes

| Convencao | Padrao | Exemplo |
|-----------|--------|---------|
| Nomenclatura tabelas | snake_case PT-BR | `ordens_producao` |
| Nomenclatura colunas | snake_case PT-BR | `data_vencimento` |
| Primary key | UUID gen_random_uuid() | `id UUID PRIMARY KEY` |
| Foreign key | `{entidade}_id` | `cliente_id`, `pedido_id` |
| Timestamps | created_at, updated_at | TIMESTAMPTZ DEFAULT NOW() |
| Soft delete | excluido_em, excluido_por | Em tabelas transacionais |
| Status | TEXT com CHECK constraint | `status TEXT CHECK (...)` |
| Valores monetarios | NUMERIC(12,2) | `valor_total NUMERIC(12,2)` |
| Excecoes aceitas | Termos universais | id, uuid, url, email, status |

---

## 3. Tabelas por Dominio

### 3.1 Administracao e Seguranca

**`roles`** — Perfis de usuario
```sql
id UUID PK, nome TEXT UNIQUE, descricao TEXT
-- Seed: admin, diretor, comercial, comercial_senior, financeiro, producao, compras, logistica, instalador
```

**`permissions`** — Permissoes granulares
```sql
id UUID PK, modulo TEXT, acao TEXT, descricao TEXT
-- 11 modulos × 6 acoes = 66 combinacoes
```

**`role_permissions`** — Relacao N:N roles × permissions
```sql
role_id UUID FK, permission_id UUID FK
```

**`registros_auditoria`** — Log de todas alteracoes
```sql
id UUID PK, user_id UUID FK, tabela TEXT, registro_id UUID, acao TEXT,
dados_anteriores JSONB, dados_novos JSONB, ip_address TEXT, created_at
-- Trigger automatico em 16 tabelas criticas
```

**`attachments`** — Anexos genericos (qualquer entidade)
```sql
id UUID PK, entidade_tipo TEXT, entidade_id UUID,
nome_arquivo TEXT, url TEXT, tipo_mime TEXT, tamanho_bytes BIGINT
```

**`notas_internas`** — Notas em qualquer entidade
```sql
id UUID PK, entidade_tipo TEXT, entidade_id UUID, autor_id UUID FK, conteudo TEXT
```

---

### 3.2 Comercial (CRM)

**`leads`** — Prospects de venda
```sql
id, empresa, contato_nome, telefone, email, cargo, segmento,
origem_id FK(lead_sources), score INT, status TEXT CHECK(...),
motivo_descarte, vendedor_id FK, observacoes
-- Status: novo, em_contato, qualificando, qualificado, descartado
```

**`oportunidades`** — Leads qualificados com potencial
```sql
id, lead_id FK, cliente_id FK, titulo, descricao, valor_estimado NUMERIC,
fase TEXT CHECK(...), probabilidade INT, data_fechamento_prevista,
motivo_perda, vendedor_id FK
-- Fase: aberta, proposta_enviada, em_negociacao, ganha, perdida
```

**`propostas`** — Orcamentos/propostas comerciais
```sql
id, numero TEXT UNIQUE (PROP-YYYY-####), oportunidade_id FK, cliente_id FK,
vendedor_id FK, versao INT, status TEXT CHECK(...), titulo, validade_dias,
subtotal NUMERIC, desconto_percentual, desconto_valor, total NUMERIC,
condicoes_pagamento, aprovado_por, aprovado_em,
cliente_nome_snapshot, cliente_cnpj_snapshot  -- Snapshots para historico
-- Status: rascunho, enviada, em_revisao, aprovada, recusada, expirada
```

**`proposta_itens`** — Itens da proposta
```sql
id, proposta_id FK, produto_id FK, descricao, especificacao,
quantidade, unidade, largura_cm, altura_cm, area_m2,
custo_mp, custo_mo, custo_fixo, markup_percentual,
valor_unitario, valor_total, prazo_producao_dias, ordem INT
```

**`proposta_versoes`** — Historico de versoes
```sql
id, proposta_id FK, versao INT, dados_snapshot JSONB, criado_por FK
```

**`atividades_comerciais`** — Timeline de interacoes
```sql
id, tipo TEXT (ligacao/email/visita/reuniao/whatsapp/nota),
entidade_tipo, entidade_id, descricao, duracao_minutos, resultado,
proximo_passo, autor_id FK
```

**`tarefas_comerciais`** — Follow-ups agendados
```sql
id, tipo TEXT, titulo, entidade_tipo, entidade_id,
responsavel_id FK, data_prevista DATE, status TEXT, prioridade TEXT
```

**`metas_vendas`** — Metas por vendedor/periodo
```sql
id, vendedor_id FK, periodo_inicio DATE, periodo_fim DATE,
meta_valor NUMERIC, realizado_valor NUMERIC
```

---

### 3.3 Clientes

**`clientes`** — Empresas clientes
```sql
id, razao_social, nome_fantasia, cnpj TEXT UNIQUE, inscricao_estadual,
telefone, email, site, segmento, classificacao (A/B/C/D),
tipo_cliente (agencia/cliente_final/revenda), vendedor_id FK,
sla_dias INT, limite_credito NUMERIC, endereco, cidade, estado, cep,
ativo BOOLEAN, lead_id FK  -- Referencia ao lead de origem
```

**`cliente_unidades`** — Filiais/lojas
```sql
id, cliente_id FK, nome, endereco, cidade, estado, cep,
telefone, contato_local, latitude, longitude, ativo
```

**`cliente_contatos`** — Pessoas de contato
```sql
id, cliente_id FK, nome, cargo, departamento, telefone, email,
whatsapp, e_decisor BOOLEAN, principal BOOLEAN, ativo
```

**`cliente_documentos`** — Documentos do cliente
```sql
id, cliente_id FK, tipo TEXT, nome, url TEXT, validade DATE
```

---

### 3.4 Orcamento Avancado

**`acabamentos`** — Tipos de acabamento disponiveis
```sql
id, nome, descricao, custo_unitario NUMERIC, unidade TEXT, ativo, ordem
-- Seed: ilhos, bastao, laminacao, cantoneiras, velcro, etc.
```

**`servicos`** — Servicos adicionais
```sql
id, nome, descricao, custo_hora NUMERIC, horas_estimadas,
preco_fixo NUMERIC, categoria TEXT (criacao/instalacao/montagem/transporte)
-- Seed: criacao de arte, instalacao, frete, montagem
```

**`proposta_item_materiais`** — Materiais por item de proposta
```sql
id, proposta_item_id FK, material_id FK, descricao TEXT (snapshot),
quantidade, unidade, custo_unitario, custo_total
```

**`proposta_item_acabamentos`** — Acabamentos por item
```sql
id, proposta_item_id FK, acabamento_id FK, descricao TEXT,
quantidade, custo_unitario, custo_total
```

**`proposta_servicos`** — Servicos na proposta
```sql
id, proposta_id FK, servico_id FK, descricao, horas, valor_unitario, valor_total
```

**`regras_precificacao`** — Regras configuraveis
```sql
id, nome, categoria TEXT, tipo TEXT (markup_minimo/markup_padrao/desconto_maximo/
preco_m2_minimo/taxa_urgencia), valor NUMERIC, ativo
```

**`templates_orcamento`** — Templates reutilizaveis
```sql
id, nome, descricao, categoria, itens JSONB, ativo, criado_por FK
```

---

### 3.5 Pedidos

**`pedidos`** — Pedidos de venda
```sql
id, numero TEXT UNIQUE (PED-YYYY-####), proposta_id FK, cliente_id FK,
vendedor_id FK, status TEXT CHECK (10 estados), prioridade TEXT,
data_prometida DATE, data_conclusao DATE, valor_total NUMERIC,
custo_total NUMERIC, margem_real NUMERIC(5,2),
aprovado_por FK, aprovado_em, excluido_em, excluido_por
```

**`pedido_itens`** — Itens do pedido
```sql
id, pedido_id FK, proposta_item_id FK, produto_id FK,
descricao, especificacao, quantidade, valor_unitario, valor_total,
status TEXT (pendente/em_producao/produzido/instalado/cancelado),
arte_url, instrucoes
```

**`pedido_historico`** — Log de alteracoes
```sql
id, pedido_id FK, usuario_id FK, tipo_alteracao TEXT,
descricao, dados_anteriores JSONB, dados_novos JSONB
```

---

### 3.6 Producao

**`ordens_producao`** — Ordens de producao
```sql
id, numero TEXT UNIQUE (OP-YYYY-####), pedido_item_id FK, pedido_id FK,
status TEXT CHECK (8 estados), prioridade INT, responsavel_id FK,
prazo_interno DATE, data_inicio, data_conclusao,
tempo_estimado_min, tempo_real_min,
custo_mp_estimado, custo_mp_real, custo_mo_estimado, custo_mo_real,
excluido_em, excluido_por
```

**`producao_etapas`** — Etapas da OP
```sql
id, ordem_producao_id FK, nome TEXT, ordem INT,
status TEXT (pendente/em_andamento/concluida/pulada),
responsavel_id FK, inicio, fim, tempo_estimado_min, tempo_real_min
```

**`producao_checklist`** — Conferencia de qualidade
```sql
id, ordem_producao_id FK, item TEXT, conferido BOOLEAN,
conferido_por FK, conferido_em, observacao
```

**`producao_retrabalho`** — Registro de refacao
```sql
id, ordem_producao_id FK, motivo, descricao,
custo_material NUMERIC, custo_mao_obra NUMERIC, responsavel_id FK
```

**`producao_apontamentos`** — Registro de tempo por etapa
```sql
id, etapa_id FK, operador_id FK, inicio, fim, observacao
```

**`producao_materiais`** — Consumo de material por OP
```sql
id, ordem_producao_id FK, material_id FK, quantidade, tipo TEXT (reserva/consumo/devolucao)
```

---

### 3.7 Estoque

**`materiais`** — Catalogo de materiais
```sql
id, codigo TEXT UNIQUE, nome, categoria (lona/vinil/acm/tinta/ferragem/ilhos),
unidade (un/m²/m/ml/kg/L/rolo), estoque_minimo, preco_medio NUMERIC,
localizacao, ativo
```

**`estoque_saldos`** — Saldo atual por material
```sql
id, material_id FK UNIQUE, quantidade_disponivel, quantidade_reservada
```

**`estoque_movimentacoes`** — Historico de movimentacao
```sql
id, material_id FK, tipo TEXT (8 tipos), quantidade,
referencia_tipo, referencia_id UUID, motivo, usuario_id FK
```

**`estoque_inventario`** — Contagem fisica
```sql
id, material_id FK, quantidade_sistema, quantidade_contada,
diferenca, responsavel_id FK, data_contagem DATE
```

---

### 3.8 Compras

**`fornecedores`** — Fornecedores de materiais
```sql
id, razao_social, nome_fantasia, cnpj, telefone, email,
contato_nome, categorias TEXT[], lead_time_dias, condicao_pagamento, ativo
```

**`solicitacoes_compra`** — Pedidos de compra internos
```sql
id, numero TEXT UNIQUE, material_id FK, quantidade, urgencia TEXT,
origem TEXT (manual/automatica), status TEXT, solicitante_id FK
```

**`cotacoes_compra`** — Comparativo de fornecedores
```sql
id, solicitacao_id FK, fornecedor_id FK, preco_unitario, prazo_dias,
condicoes, selecionada BOOLEAN
```

**`pedidos_compra`** — Ordem de compra ao fornecedor
```sql
id, numero TEXT UNIQUE (PC-YYYY-####), fornecedor_id FK,
status TEXT (rascunho/aprovado/enviado/parcial/recebido/cancelado),
valor_total NUMERIC, previsao_entrega DATE
```

**`pedido_compra_itens`** — Itens do pedido de compra
```sql
id, pedido_compra_id FK, material_id FK, quantidade,
valor_unitario, valor_total, quantidade_recebida
```

**`recebimentos`** — Conferencia de entrega
```sql
id, pedido_compra_id FK, numero_nf TEXT, data_recebimento DATE,
conferido_por FK, status TEXT, observacoes
```

**`historico_precos`** — Evolucao de precos por fornecedor
```sql
id, material_id FK, fornecedor_id FK, preco, data_registro DATE
```

---

### 3.9 Financeiro

**`contas_receber`** — Titulos a receber
```sql
id, pedido_id FK, cliente_id FK, numero_titulo, valor_original NUMERIC,
valor_pago NUMERIC, saldo NUMERIC, data_emissao, data_vencimento,
data_pagamento, status TEXT (7 estados), forma_pagamento,
conta_plano_id FK, centro_custo_id FK
```

**`parcelas_receber`** — Parcelamento
```sql
id, conta_receber_id FK, numero_parcela INT, valor NUMERIC,
data_vencimento DATE, data_pagamento DATE, status TEXT
```

**`contas_pagar`** — Titulos a pagar
```sql
id, pedido_compra_id FK, fornecedor_id FK, categoria, numero_titulo,
numero_nf, valor_original, valor_pago, saldo, data_vencimento,
status TEXT, forma_pagamento, conta_plano_id FK, centro_custo_id FK
```

**`parcelas_pagar`** — Parcelamento a pagar
```sql
id, conta_pagar_id FK, numero_parcela INT, valor, data_vencimento, status
```

**`plano_contas`** — Estrutura contabil
```sql
id, codigo TEXT UNIQUE (1.1.01, 2.1.03), nome, tipo (receita/custo/despesa), grupo
```

**`centros_custo`** — Departamentos para rateio
```sql
id, codigo TEXT UNIQUE, nome (Comercial/Producao/Instalacao/Admin)
```

**`lancamentos_caixa`** — Movimentacao diaria
```sql
id, data DATE, tipo (entrada/saida), valor NUMERIC, descricao,
conta_plano_id FK, centro_custo_id FK, referencia_tipo, referencia_id
```

**`config_precificacao`** — Parametros do motor Mubisys
```sql
id, faturamento_medio NUMERIC, custo_operacional NUMERIC,
custo_produtivo NUMERIC, qtd_funcionarios INT, horas_mes INT,
percentual_comissao, percentual_impostos, percentual_juros
```

**`comissoes`** — Comissoes de vendedores
```sql
id, vendedor_id FK, pedido_id FK, conta_receber_id FK,
percentual NUMERIC, valor_base, valor_comissao,
status TEXT (gerada/aprovada/paga/cancelada), data_pagamento
```

---

### 3.10 Instalacao e Campo

**`ordens_instalacao`** — Agendamento de instalacao
```sql
id, numero TEXT UNIQUE (INST-YYYY-####), pedido_id FK, pedido_item_id FK,
cliente_id FK, unidade_id FK, equipe_id FK,
status TEXT (8 estados), data_agendada DATE, hora_prevista TIME,
endereco_completo, instrucoes, materiais_necessarios,
custo_logistico NUMERIC, motivo_reagendamento
```

**`equipes`** — Equipes de instalacao
```sql
id, nome, veiculo_id FK, regiao TEXT, ativa BOOLEAN
```

**`equipe_membros`** — Membros da equipe
```sql
id, equipe_id FK, usuario_id FK, funcao TEXT (lider/auxiliar), ativo BOOLEAN
```

**`veiculos`** — Frota
```sql
id, placa TEXT UNIQUE, modelo, tipo, capacidade_kg, ativo BOOLEAN
```

**Tabelas de campo**: Ver `FIELD_APP.md`

---

### 3.11 Qualidade

**`ocorrencias`** — Registro de nao-conformidades
```sql
id, numero TEXT UNIQUE (OC-YYYY-####), tipo TEXT (7 tipos),
origem TEXT, pedido_id FK, ordem_producao_id FK,
descricao, causa TEXT (8 causas), status TEXT (6 estados),
impacto TEXT (baixo/medio/alto/critico), custo_total NUMERIC
```

**`ocorrencia_tratativas`** — Acoes corretivas
```sql
id, ocorrencia_id FK, descricao, responsavel_id FK, prazo DATE, status TEXT
```

**`ocorrencia_custos`** — Custos do reprocesso
```sql
id, ocorrencia_id FK, tipo (material/mao_obra/logistica), valor NUMERIC, descricao
```

---

## 4. Relacionamentos Principais

```
leads ──(1:1)──→ clientes (conversao)
leads ──(1:N)──→ oportunidades
oportunidades ──(1:N)──→ propostas
propostas ──(1:N)──→ proposta_itens ──(1:N)──→ proposta_item_materiais
                                     ──(1:N)──→ proposta_item_acabamentos
propostas ──(1:N)──→ proposta_servicos
propostas ──(1:1)──→ pedidos (conversao)
pedidos ──(1:N)──→ pedido_itens
pedidos ──(1:N)──→ ordens_producao
pedidos ──(1:N)──→ contas_receber ──(1:N)──→ parcelas_receber
pedidos ──(1:N)──→ ordens_instalacao ──(1:N)──→ tarefas_campo
ordens_producao ──(1:N)──→ producao_etapas
ordens_producao ──(1:N)──→ producao_checklist
clientes ──(1:N)──→ cliente_unidades
clientes ──(1:N)──→ cliente_contatos
materiais ──(1:1)──→ estoque_saldos
materiais ──(1:N)──→ estoque_movimentacoes
fornecedores ──(1:N)──→ pedidos_compra ──(1:N)──→ pedido_compra_itens
```

---

## 5. Seguranca (RLS)

### Politicas de Row Level Security

Todas as tabelas tem RLS habilitado. Politicas baseadas em `get_user_role()`:

| Tabela | SELECT | INSERT/UPDATE/DELETE |
|--------|--------|---------------------|
| leads | admin, diretor, comercial | admin, comercial |
| propostas | admin, diretor, comercial, financeiro | admin, comercial |
| pedidos | admin, diretor, comercial, financeiro, producao | admin, comercial_senior |
| ordens_producao | admin, diretor, producao | admin, producao |
| contas_receber | admin, diretor, financeiro | admin, financeiro |
| materiais | admin, producao, compras | admin, compras |
| tarefas_campo | instalador (somente proprias) | instalador (somente proprias) |

### Funcoes de Seguranca
```sql
get_user_role()              -- Retorna role do usuario autenticado
fn_registrar_auditoria()     -- Trigger de auditoria automatico
fn_validar_transicao_status() -- Valida maquina de estados
```

---

## 6. Indices

175+ indices criados para performance:

| Tipo | Quantidade | Exemplo |
|------|-----------|---------|
| PK (UUID) | 65 | Todas as tabelas |
| FK | ~80 | `idx_pedidos_cliente_id` |
| Status | ~20 | `idx_pedidos_status` |
| Compostos | ~15 | `idx_leads_vendedor_status` |
| Parciais | ~10 | `WHERE excluido_em IS NULL` |
| Trigram (pg_trgm) | ~5 | Busca textual em nomes |
| Data | ~10 | `idx_contas_receber_vencimento` |

---

## 7. Sequences (Auto-Numeracao)

```sql
proposta_numero_seq    -- PROP-2026-0001, PROP-2026-0002, ...
pedido_numero_seq      -- PED-2026-0001, ...
op_numero_seq          -- OP-2026-0001, ...
instalacao_numero_seq  -- INST-2026-0001, ...
pc_numero_seq          -- PC-2026-0001, ...
sc_numero_seq          -- SC-2026-0001, ...
oc_numero_seq          -- OC-2026-0001, ...
```

Formato: `PREFIXO-YYYY-####` (resetam anualmente)

---

## 8. Migrations

| Arquivo | Conteudo | Linhas |
|---------|---------|--------|
| `001_complete_schema.sql` | 51 tabelas base, 120+ indices, sequences, seed | 1.911 |
| `002_schema_corrections.sql` | 14 tabelas novas, RLS, audit, triggers, indices | 1.874 |
| `003_campo_migration.sql` | Tabelas do app de campo | - |
| `003_fiscal_module.sql` | Modulo fiscal / NF-e | - |
| `004_integracao_bridge.sql` | Camada de integracao campo-CRM | - |
| `005_storage_security.sql` | Politicas de storage (fotos, docs) | - |
| `006_orcamento_module.sql` | 7 tabelas de orcamento avancado + seed | 209 |

### Ordem de Execucao
```
001 → 002 → 003 (ambos) → 004 → 005 → 006
```
