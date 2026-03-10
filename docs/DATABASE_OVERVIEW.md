# CROMA PRINT — MODELO DE BANCO DE DADOS

> Supabase PostgreSQL | 76+ tabelas organizadas por domínio
> Migrations: `supabase/migrations/001-006`
> Atualizado: 2026-03-10

**Documentos relacionados**: [ARCHITECTURE](ARCHITECTURE.md) | [BUSINESS_FLOW](BUSINESS_FLOW.md) | [PRICING_ENGINE](PRICING_ENGINE.md) | [FIELD_APP](FIELD_APP.md)

---

## Índice

- [1. Visão Geral](#1-visão-geral)
- [2. Convenções](#2-convenções)
- [3. Tabelas por Domínio](#3-tabelas-por-domínio)
- [4. Relacionamentos Principais](#4-relacionamentos-principais)
- [5. Segurança (RLS)](#5-segurança-rls)
- [6. Índices](#6-índices)
- [7. Sequences](#7-sequences-auto-numeração)
- [8. Migrations](#8-migrations)
- [9. Dados em Produção](#9-dados-em-produção-seed)

---

## 1. Visão Geral

O banco de dados está organizado em **10 domínios de negócio** + **1 domínio administrativo**:

```
┌───────────────────────────────────────────────────────────────┐
│                    BANCO DE DADOS (76+ tabelas)                │
│                                                                │
│  ADMIN (7)         COMERCIAL (9)        CLIENTES (4)          │
│  profiles           leads                clientes              │
│  roles              oportunidades        cliente_unidades      │
│  permissions        propostas            cliente_contatos      │
│  role_permissions   proposta_itens       cliente_documentos    │
│  registros_audit.   proposta_versões                           │
│  attachments        atividades_comerc.                         │
│  notas_internas     tarefas_comerciais                         │
│                     metas_vendas                               │
│                     comissões                                  │
│                                                                │
│  ORÇAMENTO (7)     PEDIDOS (3)          PRODUÇÃO (7)          │
│  acabamentos        pedidos              ordens_producao       │
│  serviços           pedido_itens         producao_etapas       │
│  prop_item_mats     pedido_historico     producao_checklist    │
│  prop_item_acabam                        producao_retrabalho   │
│  proposta_servicos                       producao_apontamentos │
│  regras_precif.                          producao_materiais    │
│  templates_orcam.                                              │
│                                                                │
│  ESTOQUE (4)       COMPRAS (8)          FINANCEIRO (8)        │
│  materiais          fornecedores         contas_receber        │
│  estoque_saldos     solicitacoes_comp.   parcelas_receber      │
│  estoque_movim.     cotacoes_compra      contas_pagar          │
│  estoque_invent.    pedidos_compra       parcelas_pagar        │
│                     pedido_compra_it.    plano_contas          │
│                     recebimentos         centros_custo         │
│                     recebimento_itens    lancamentos_caixa     │
│                     historico_precos     config_precificacao    │
│                                                                │
│  INSTALAÇÃO (5)    QUALIDADE (3)        CAMPO (4)             │
│  ordens_instal.     ocorrencias          jobs                  │
│  equipes            ocorr_tratativas     checklists_campo      │
│  equipe_membros     ocorr_custos         midias_campo          │
│  agenda_instal.                          assinaturas_campo     │
│  veículos                                                      │
│                                                                │
│  PRODUTOS (4)      FISCAL (11)          NOTIFICAÇÕES (1)      │
│  produtos           fiscal_configuracao  notificacoes          │
│  produto_modelos    fiscal_certificados                        │
│  modelo_materiais   fiscal_documentos                          │
│  modelo_processos   fiscal_itens                               │
│                     fiscal_eventos                              │
│                     fiscal_transmissoes                         │
│                     fiscal_cancelamentos                        │
│                     fiscal_destinatarios                        │
│                     fiscal_transportes                          │
│                     fiscal_pagamentos                           │
│                     fiscal_audit_log                            │
└───────────────────────────────────────────────────────────────┘
```

---

## 2. Convenções

| Convenção | Padrão | Exemplo |
|-----------|--------|---------|
| Nomenclatura tabelas | snake_case PT-BR | `ordens_producao` |
| Nomenclatura colunas | snake_case PT-BR | `data_vencimento` |
| Primary key | UUID gen_random_uuid() | `id UUID PRIMARY KEY` |
| Foreign key | `{entidade}_id` | `cliente_id`, `pedido_id` |
| Timestamps | created_at, updated_at | TIMESTAMPTZ DEFAULT NOW() |
| Soft delete | excluido_em, excluido_por | Em tabelas transacionais |
| Status | TEXT com CHECK constraint | `status TEXT CHECK (...)` |
| Valores monetários | NUMERIC(12,2) | `valor_total NUMERIC(12,2)` |
| Percentuais | NUMERIC(5,2) ou (10,4) | `markup_percentual NUMERIC(5,2)` |
| Exceções aceitas | Termos universais | id, uuid, url, email, status |

---

## 3. Tabelas por Domínio

### 3.1 Administração e Segurança

**`profiles`** — Perfis de usuário (extensão do Supabase Auth)
```sql
id UUID PK (= auth.uid()), first_name TEXT, last_name TEXT, role TEXT,
avatar_url TEXT, ativo BOOLEAN, created_at, updated_at
-- 4 registros: admin (junior), tecnico1, tecnico2, supervisor
```

**`roles`** — Papéis do sistema
```sql
id UUID PK, nome TEXT UNIQUE, descricao TEXT
-- 9 roles: admin, diretor, comercial, comercial_senior, financeiro,
--          producao, compras, logistica, instalador
```

**`permissions`** — Permissões granulares
```sql
id UUID PK, modulo TEXT, acao TEXT, descricao TEXT
-- 11 módulos × 6 ações = 57 permissões definidas
```

**`role_permissions`** — Relação N:N roles × permissions
```sql
role_id UUID FK, permission_id UUID FK
-- 201 vínculos configurados
```

**`registros_auditoria`** — Log de todas as alterações
```sql
id UUID PK, user_id UUID FK, tabela TEXT, registro_id UUID, acao TEXT,
dados_anteriores JSONB, dados_novos JSONB, ip_address TEXT, created_at
-- Trigger automático em 16 tabelas críticas
```

**`attachments`** — Anexos genéricos (qualquer entidade)
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

**`propostas`** — Orçamentos/propostas comerciais
```sql
id, numero TEXT UNIQUE (PROP-YYYY-####), oportunidade_id FK, cliente_id FK,
vendedor_id FK, versao INT, status TEXT CHECK(...), titulo, validade_dias,
subtotal NUMERIC, desconto_percentual, desconto_valor, total NUMERIC,
condicoes_pagamento, aprovado_por, aprovado_em,
cliente_nome_snapshot, cliente_cnpj_snapshot  -- Snapshots para histórico
-- Status: rascunho, enviada, em_revisao, aprovada, recusada, expirada
```

**`proposta_itens`** — Itens da proposta
```sql
id, proposta_id FK, produto_id FK, descricao, especificacao,
quantidade, unidade, largura_cm, altura_cm, area_m2,
custo_mp, custo_mo, custo_fixo, markup_percentual,
valor_unitario, valor_total, prazo_producao_dias, ordem INT
```

**`proposta_versoes`** — Histórico de versões
```sql
id, proposta_id FK, versao INT, dados_snapshot JSONB, criado_por FK
```

**`atividades_comerciais`** — Timeline de interações
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

**`metas_vendas`** — Metas por vendedor/período
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
ativo BOOLEAN, lead_id FK  -- Referência ao lead de origem
-- 307 registros importados do Mubisys
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

### 3.4 Orçamento Avançado

> Detalhes do motor de precificação em [PRICING_ENGINE.md](PRICING_ENGINE.md)

**`acabamentos`** — Tipos de acabamento disponíveis
```sql
id, nome, descricao, custo_unitario NUMERIC, unidade TEXT, ativo, ordem
-- Seed: 10 acabamentos (ilhós, bastão, laminação, cantoneiras, etc.)
```

**`servicos`** — Serviços adicionais
```sql
id, nome, descricao, custo_hora NUMERIC, horas_estimadas,
preco_fixo NUMERIC, categoria TEXT (criacao/instalacao/montagem/transporte)
-- Seed: 8 serviços (criação arte, instalação, frete, etc.)
```

**`proposta_item_materiais`** — Materiais por item de proposta (bridge)
```sql
id, proposta_item_id FK, material_id FK, descricao TEXT (snapshot),
quantidade, unidade, custo_unitario, custo_total
```

**`proposta_item_acabamentos`** — Acabamentos por item
```sql
id, proposta_item_id FK, acabamento_id FK, descricao TEXT,
quantidade, custo_unitario, custo_total
```

**`proposta_servicos`** — Serviços na proposta
```sql
id, proposta_id FK, servico_id FK, descricao, horas, valor_unitario, valor_total
```

**`regras_precificacao`** — Regras configuráveis
```sql
id, nome, categoria TEXT, tipo TEXT (markup_minimo/markup_padrao/desconto_maximo/
preco_m2_minimo/taxa_urgencia), valor NUMERIC, ativo
-- Seed: 7 regras (markup mín 30%, padrão 45%, premium 55%, etc.)
```

**`templates_orcamento`** — Templates reutilizáveis
```sql
id, nome, descricao, categoria, itens JSONB, ativo, criado_por FK
```

---

### 3.5 Produtos e Materiais

**`produtos`** — Catálogo de produtos
```sql
id, nome, descricao, categoria TEXT (fachadas/pdv/comunicacao_interna/
campanhas/envelopamento/grandes_formatos), ativo BOOLEAN
-- 156 produtos no catálogo
```

**`produto_modelos`** — Variações de produto (tamanhos, formatos)
```sql
id, produto_id FK, nome, largura_cm, altura_cm, area_m2,
markup_padrao NUMERIC, margem_minima NUMERIC, preco_fixo NUMERIC,
tempo_producao_min INT, ativo
```

**`modelo_materiais`** — BOM (Bill of Materials) por modelo
```sql
id, modelo_id FK, material_id FK, quantidade_por_unidade NUMERIC, unidade TEXT
-- Conecta modelo → materiais necessários (auto-carregados no orçamento)
```

**`modelo_processos`** — Etapas produtivas por modelo
```sql
id, modelo_id FK, etapa TEXT, tempo_por_unidade_min INT, ordem INT
-- Define tempo de cada etapa (usado no cálculo do Passo 2 do Mubisys)
```

---

### 3.6 Pedidos

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

**`pedido_historico`** — Log de alterações
```sql
id, pedido_id FK, usuario_id FK, tipo_alteracao TEXT,
descricao, dados_anteriores JSONB, dados_novos JSONB
```

---

### 3.7 Produção

**`ordens_producao`** — Ordens de produção
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
status TEXT (pendente/em_andamento/concluída/pulada),
responsavel_id FK, inicio, fim, tempo_estimado_min, tempo_real_min
```

**`producao_checklist`** — Conferência de qualidade
```sql
id, ordem_producao_id FK, item TEXT, conferido BOOLEAN,
conferido_por FK, conferido_em, observacao
```

**`producao_retrabalho`** — Registro de refação
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
id, ordem_producao_id FK, material_id FK, quantidade,
tipo TEXT (reserva/consumo/devolucao)
```

---

### 3.8 Estoque

**`materiais`** — Catálogo de materiais
```sql
id, codigo TEXT UNIQUE, nome, categoria (lona/vinil/acm/tinta/ferragem/ilhos),
unidade (un/m²/m/ml/kg/L/rolo), estoque_minimo, preco_medio NUMERIC,
localizacao, ativo
-- 467 materiais importados do Mubisys
```

**`estoque_saldos`** — Saldo atual por material
```sql
id, material_id FK UNIQUE, quantidade_disponivel, quantidade_reservada
```

**`estoque_movimentacoes`** — Histórico de movimentação
```sql
id, material_id FK, tipo TEXT (8 tipos), quantidade,
referencia_tipo, referencia_id UUID, motivo, usuario_id FK
```

**`estoque_inventario`** — Contagem física
```sql
id, material_id FK, quantidade_sistema, quantidade_contada,
diferenca, responsavel_id FK, data_contagem DATE
```

---

### 3.9 Compras

**`fornecedores`** — Fornecedores de materiais
```sql
id, razao_social, nome_fantasia, cnpj, telefone, email,
contato_nome, categorias TEXT[], lead_time_dias, condicao_pagamento, ativo
```

**`solicitacoes_compra`** — Pedidos internos de compra
```sql
id, numero TEXT UNIQUE (SC-YYYY-####), material_id FK, quantidade, urgencia TEXT,
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

**`recebimentos`** — Conferência de entrega
```sql
id, pedido_compra_id FK, numero_nf TEXT, data_recebimento DATE,
conferido_por FK, status TEXT, observacoes
```

**`recebimento_itens`** — Itens conferidos no recebimento
```sql
id, recebimento_id FK, material_id FK, quantidade_recebida,
quantidade_aprovada, observacao
```

**`historico_precos`** — Evolução de preços por fornecedor
```sql
id, material_id FK, fornecedor_id FK, preco, data_registro DATE
```

---

### 3.10 Financeiro

**`contas_receber`** — Títulos a receber
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

**`contas_pagar`** — Títulos a pagar
```sql
id, pedido_compra_id FK, fornecedor_id FK, categoria, numero_titulo,
numero_nf, valor_original, valor_pago, saldo, data_vencimento,
status TEXT, forma_pagamento, conta_plano_id FK, centro_custo_id FK
```

**`parcelas_pagar`** — Parcelamento a pagar
```sql
id, conta_pagar_id FK, numero_parcela INT, valor, data_vencimento, status
```

**`plano_contas`** — Estrutura contábil
```sql
id, codigo TEXT UNIQUE (1.1.01, 2.1.03), nome, tipo (receita/custo/despesa), grupo
```

**`centros_custo`** — Departamentos para rateio
```sql
id, codigo TEXT UNIQUE, nome (Comercial/Produção/Instalação/Admin)
```

**`lancamentos_caixa`** — Movimentação diária
```sql
id, data DATE, tipo (entrada/saida), valor NUMERIC, descricao,
conta_plano_id FK, centro_custo_id FK, referencia_tipo, referencia_id
```

**`config_precificacao`** — Parâmetros do motor Mubisys
```sql
id, faturamento_medio NUMERIC, custo_operacional NUMERIC,
custo_produtivo NUMERIC, qtd_funcionarios INT, horas_mes INT,
percentual_comissao, percentual_impostos, percentual_juros
-- 1 registro configurado com defaults corretos
```

**`comissoes`** — Comissões de vendedores
```sql
id, vendedor_id FK, pedido_id FK, conta_receber_id FK,
percentual NUMERIC, valor_base, valor_comissao,
status TEXT (gerada/aprovada/paga/cancelada), data_pagamento
```

---

### 3.11 Instalação e Campo

**`ordens_instalacao`** — Agendamento de instalação
```sql
id, numero TEXT UNIQUE (INST-YYYY-####), pedido_id FK, pedido_item_id FK,
cliente_id FK, unidade_id FK, equipe_id FK,
status TEXT (8 estados), data_agendada DATE, hora_prevista TIME,
endereco_completo, instrucoes, materiais_necessarios,
custo_logistico NUMERIC, motivo_reagendamento
```

**`equipes`** — Equipes de instalação
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

**`agenda_instalacao`** — Agenda detalhada
```sql
id, ordem_instalacao_id FK, data DATE, hora_inicio TIME, hora_fim TIME, observacoes
```

> Tabelas de campo detalhadas em [FIELD_APP.md](FIELD_APP.md)

---

### 3.12 Qualidade

**`ocorrencias`** — Registro de não-conformidades
```sql
id, numero TEXT UNIQUE (OC-YYYY-####), tipo TEXT (7 tipos),
origem TEXT, pedido_id FK, ordem_producao_id FK,
descricao, causa TEXT (8 causas), status TEXT (6 estados),
impacto TEXT (baixo/medio/alto/critico), custo_total NUMERIC
```

**`ocorrencia_tratativas`** — Ações corretivas
```sql
id, ocorrencia_id FK, descricao, responsavel_id FK, prazo DATE, status TEXT
```

**`ocorrencia_custos`** — Custos do reprocesso
```sql
id, ocorrencia_id FK, tipo (material/mao_obra/logistica), valor NUMERIC, descricao
```

---

### 3.13 Fiscal (NF-e)

**`fiscal_configuracao`** — Config do emissor fiscal
```sql
id, empresa_cnpj, razao_social, inscricao_estadual, regime_tributario,
certificado_digital_id FK, ambiente TEXT (producao/homologacao), serie_nfe INT
```

**`fiscal_certificados`** — Certificados digitais A1
```sql
id, nome, arquivo_pfx_url TEXT, senha_hash TEXT,
validade DATE, ativo BOOLEAN
```

**`fiscal_documentos`** — Notas fiscais emitidas
```sql
id, numero INT, serie INT, chave_acesso TEXT(44), modelo TEXT(2),
pedido_id FK, cliente_id FK, natureza_operacao TEXT,
valor_total NUMERIC, status TEXT (em_digitacao/autorizada/cancelada/rejeitada),
xml_url TEXT, pdf_url TEXT, protocolo_autorizacao TEXT
```

**`fiscal_itens`** — Itens da NF-e
```sql
id, documento_id FK, numero_item INT, descricao, ncm TEXT(8),
cfop TEXT(4), quantidade, valor_unitario, valor_total,
icms_base, icms_valor, pis_valor, cofins_valor
```

**`fiscal_eventos`** — Eventos do documento (carta correção, etc.)
```sql
id, documento_id FK, tipo TEXT, sequencia INT, descricao, protocolo TEXT
```

**`fiscal_transmissoes`** — Log de transmissões à SEFAZ
```sql
id, documento_id FK, tipo TEXT, xml_envio TEXT, xml_retorno TEXT,
codigo_retorno, mensagem_retorno, protocolo TEXT
```

**+ 5 tabelas auxiliares**: cancelamentos, destinatários, transportes, pagamentos, audit_log

---

## 4. Relacionamentos Principais

```
profiles ──(role)──→ roles ──(N:N)──→ permissions

leads ──(1:1)──→ clientes (conversão)
leads ──(1:N)──→ oportunidades
oportunidades ──(1:N)──→ propostas
propostas ──(1:N)──→ proposta_itens ──(1:N)──→ proposta_item_materiais
                                     ──(1:N)──→ proposta_item_acabamentos
propostas ──(1:N)──→ proposta_servicos
propostas ──(1:1)──→ pedidos (conversão)
pedidos ──(1:N)──→ pedido_itens
pedidos ──(1:N)──→ ordens_producao ──(1:N)──→ producao_etapas
                                    ──(1:N)──→ producao_checklist
pedidos ──(1:N)──→ contas_receber ──(1:N)──→ parcelas_receber
pedidos ──(1:N)──→ ordens_instalacao ──(1:N)──→ jobs (campo)
pedidos ──(1:N)──→ fiscal_documentos ──(1:N)──→ fiscal_itens

clientes ──(1:N)──→ cliente_unidades
clientes ──(1:N)──→ cliente_contatos

produtos ──(1:N)──→ produto_modelos ──(1:N)──→ modelo_materiais
                                     ──(1:N)──→ modelo_processos

materiais ──(1:1)──→ estoque_saldos
materiais ──(1:N)──→ estoque_movimentacoes
fornecedores ──(1:N)──→ pedidos_compra ──(1:N)──→ pedido_compra_itens
```

### Diagrama ER Simplificado (Fluxo Principal)
```
[Produto] → [Modelo] → [Materiais BOM]
                ↓
[Proposta] → [Item] → [Item_Materiais] + [Item_Acabamentos]
     ↓          ↓
[Pedido] → [Pedido_Item] → [OP] → [Etapas] → [Checklist]
     ↓                              ↓
[Conta_Receber]              [Estoque_Mov]
     ↓
[NF-e] → [NF-e_Itens]
```

---

## 5. Segurança (RLS)

### Políticas de Row Level Security

Todas as tabelas têm RLS habilitado. Políticas baseadas em `get_user_role()`:

| Tabela | SELECT | INSERT/UPDATE/DELETE |
|--------|--------|---------------------|
| profiles | Todos autenticados | Próprio perfil ou admin |
| leads | admin, diretor, comercial | admin, comercial |
| propostas | admin, diretor, comercial, financeiro | admin, comercial |
| pedidos | admin, diretor, comercial, financeiro, produção | admin, comercial_senior |
| ordens_producao | admin, diretor, produção | admin, produção |
| contas_receber | admin, diretor, financeiro | admin, financeiro |
| materiais | admin, produção, compras | admin, compras |
| acabamentos | Todos autenticados (ativos) | admin, produção |
| regras_precificacao | Todos autenticados (ativas) | admin, financeiro |
| templates_orcamento | Todos autenticados (ativos) | admin, comercial, comercial_senior |
| jobs (campo) | Instalador (somente próprias) | Instalador (somente próprias) |

### Funções de Segurança
```sql
get_user_role()                -- Retorna role do usuário autenticado
fn_registrar_auditoria()       -- Trigger de auditoria automático
fn_validar_transicao_status()  -- Valida máquina de estados
```

---

## 6. Índices

175+ índices criados para performance:

| Tipo | Quantidade | Exemplo |
|------|-----------|---------|
| PK (UUID) | ~76 | Todas as tabelas |
| FK | ~80 | `idx_pedidos_cliente_id` |
| Status | ~20 | `idx_pedidos_status` |
| Compostos | ~15 | `idx_leads_vendedor_status` |
| Parciais | ~10 | `WHERE excluido_em IS NULL` |
| Trigram (pg_trgm) | ~5 | Busca textual em nomes/razão social |
| Data | ~10 | `idx_contas_receber_vencimento` |
| Únicos | ~10 | `idx_clientes_cnpj`, `idx_pedidos_numero` |

---

## 7. Sequences (Auto-Numeração)

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

| Arquivo | Conteúdo | Linhas | Status |
|---------|---------|--------|--------|
| `001_complete_schema.sql` | 51 tabelas base, 120+ índices, sequences, seed | 1.911 | ✅ Executada |
| `002_schema_corrections.sql` | +14 tabelas, RLS, audit, triggers, índices | 1.874 | ✅ Executada |
| `003_campo_migration.sql` | Tabelas do app de campo | - | ✅ Executada |
| `003_fiscal_module.sql` | Módulo fiscal / NF-e (11 tabelas, RPCs) | - | ✅ Executada |
| `004_integracao_bridge.sql` | Bridge CRM↔Campo: views + triggers bidirecional | - | ❌ Pendente |
| `005_storage_security.sql` | Políticas de storage (buckets) | - | ✅ Executada |
| `006_orcamento_module.sql` | 7 tabelas de orçamento avançado + seed | 209 | ❌ Pendente |

### Ordem de Execução
```
001 → 002 → 003 (ambos) → 004 → 005 → 006
```

> ⚠️ **Migrations 004 e 006 ainda não executadas** no Supabase. O frontend funciona sem elas (queries retornam arrays vazios), mas funcionalidades de bridge e orçamento avançado dependem delas.

---

## 9. Dados em Produção (Seed)

| Tabela | Registros | Origem |
|--------|-----------|--------|
| `clientes` | 307 | Importação Mubisys (Beira Rio, Renner, Paquetá, etc.) |
| `materiais` | 467 | Importação Mubisys (catálogo completo) |
| `produtos` | 156 | Catálogo todas as categorias |
| `profiles` | 4 | admin (junior), técnico1, técnico2, supervisor |
| `roles` | 9 | 9 perfis do sistema |
| `permissions` | 57 | + 201 vínculos role_permissions |
| `config_precificacao` | 1 | Defaults Mubisys corretos |
| `propostas` | 1 | PROP-2026-001 (Beira Rio, em_revisao) |
| `acabamentos` | 10 | Seed da migration 006 (se executada) |
| `servicos` | 8 | Seed da migration 006 (se executada) |
| `regras_precificacao` | 7 | Seed da migration 006 (se executada) |
