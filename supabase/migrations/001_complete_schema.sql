-- ============================================================
-- CROMA PRINT ERP/CRM - SCHEMA COMPLETO
-- Migration: 001_complete_schema.sql
-- Data: 2026-03-09
-- Supabase-compatible PostgreSQL
-- ============================================================
-- ORDEM DE EXECUCAO:
--   0. Funcoes utilitarias
--   1. Core Admin (roles, permissions, audit, attachments, notas)
--   2. Comercial (leads, oportunidades, propostas, atividades, tarefas, metas)
--   3. Clientes (clientes, unidades, contatos)
--   4. Produtos e Precificacao (produtos, modelos, materiais de modelo, processos)
--   5. Pedidos (pedidos, itens, historico)
--   6. Producao (ordens, etapas, checklist, retrabalho)
--   7. Estoque e Compras (materiais, saldos, movimentacoes, fornecedores, pedidos compra)
--   8. Financeiro (plano contas, centros custo, contas receber/pagar, parcelas, comissoes)
--   9. Instalacao e Campo (ordens instalacao, equipes, field_tasks, checklists, media, signatures)
--  10. Qualidade (ocorrencias, tratativas)
--  11. Sequences e Triggers de auto-numeracao
--  12. Triggers de updated_at
--  13. RLS Policies
--  14. Indexes
--  15. Seed Data
-- ============================================================

-- ============================================================
-- 0. FUNCOES UTILITARIAS
-- ============================================================

-- Funcao para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ############################################################
-- 1. CORE ADMIN
-- ############################################################

-- ------------------------------------------------------------
-- 1.1 roles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE roles IS 'Papeis/cargos do sistema Croma Print';

-- ------------------------------------------------------------
-- 1.2 permissions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  modulo TEXT NOT NULL,
  acao TEXT NOT NULL,
  descricao TEXT,
  UNIQUE(modulo, acao)
);

COMMENT ON TABLE permissions IS 'Permissoes granulares por modulo e acao';

-- ------------------------------------------------------------
-- 1.3 role_permissions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

COMMENT ON TABLE role_permissions IS 'Vinculo role <-> permission (N:N)';

-- ------------------------------------------------------------
-- 1.4 ALTER profiles (tabela existente do Supabase Auth)
-- ------------------------------------------------------------
DO $$
BEGIN
  -- Adiciona role_id se nao existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role_id UUID REFERENCES roles(id) ON DELETE SET NULL;
  END IF;

  -- Adiciona departamento se nao existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'departamento'
  ) THEN
    ALTER TABLE profiles ADD COLUMN departamento TEXT;
  END IF;

  -- Adiciona ativo se nao existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'ativo'
  ) THEN
    ALTER TABLE profiles ADD COLUMN ativo BOOLEAN DEFAULT TRUE;
  END IF;

  -- Adiciona telefone se nao existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'telefone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN telefone TEXT;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 1.5 audit_logs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  tabela TEXT NOT NULL,
  registro_id UUID,
  acao TEXT NOT NULL CHECK (acao IN ('INSERT', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'APPROVAL')),
  dados_anteriores JSONB,
  dados_novos JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE audit_logs IS 'Log de auditoria de todas as operacoes criticas';

-- ------------------------------------------------------------
-- 1.6 attachments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entidade_tipo TEXT NOT NULL,
  entidade_id UUID NOT NULL,
  nome_arquivo TEXT NOT NULL,
  url TEXT NOT NULL,
  tipo_mime TEXT,
  tamanho_bytes BIGINT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE attachments IS 'Anexos genericos vinculados a qualquer entidade';

-- ------------------------------------------------------------
-- 1.7 notas_internas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notas_internas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entidade_tipo TEXT NOT NULL,
  entidade_id UUID NOT NULL,
  autor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  conteudo TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE notas_internas IS 'Notas internas genericas por entidade';


-- ############################################################
-- 2. COMERCIAL
-- ############################################################

-- ------------------------------------------------------------
-- 2.1 lead_sources
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lead_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  ativo BOOLEAN DEFAULT TRUE
);

COMMENT ON TABLE lead_sources IS 'Origens de leads para rastreamento de canais';

-- ------------------------------------------------------------
-- 2.2 leads
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa TEXT NOT NULL,
  contato_nome TEXT,
  telefone TEXT,
  email TEXT,
  cargo TEXT,
  segmento TEXT,
  origem_id UUID REFERENCES lead_sources(id) ON DELETE SET NULL,
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  status TEXT DEFAULT 'novo' CHECK (status IN ('novo', 'em_contato', 'qualificando', 'qualificado', 'descartado')),
  motivo_descarte TEXT,
  vendedor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE leads IS 'Leads de prospecao comercial';

-- ------------------------------------------------------------
-- 2.3 oportunidades
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oportunidades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  cliente_id UUID, -- FK adicionada apos criacao de clientes
  titulo TEXT NOT NULL,
  descricao TEXT,
  valor_estimado NUMERIC(12,2) DEFAULT 0,
  fase TEXT DEFAULT 'aberta' CHECK (fase IN ('aberta', 'proposta_enviada', 'em_negociacao', 'ganha', 'perdida')),
  probabilidade INTEGER DEFAULT 50 CHECK (probabilidade >= 0 AND probabilidade <= 100),
  data_fechamento_prevista DATE,
  data_fechamento_real DATE,
  motivo_perda TEXT,
  vendedor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE oportunidades IS 'Oportunidades de venda (funil comercial)';

-- ------------------------------------------------------------
-- 2.4 atividades_comerciais
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atividades_comerciais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('ligacao', 'email', 'visita', 'reuniao', 'whatsapp', 'nota')),
  entidade_tipo TEXT NOT NULL,
  entidade_id UUID NOT NULL,
  descricao TEXT,
  data_atividade TIMESTAMPTZ DEFAULT NOW(),
  duracao_minutos INTEGER,
  resultado TEXT,
  proximo_passo TEXT,
  autor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE atividades_comerciais IS 'Registro de atividades comerciais (ligacoes, visitas, etc.)';

-- ------------------------------------------------------------
-- 2.5 tarefas_comerciais
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tarefas_comerciais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('follow_up', 'visita', 'ligacao', 'enviar_proposta', 'outro')),
  titulo TEXT NOT NULL,
  descricao TEXT,
  entidade_tipo TEXT,
  entidade_id UUID,
  responsavel_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  data_prevista DATE,
  data_conclusao TIMESTAMPTZ,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  prioridade TEXT DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE tarefas_comerciais IS 'Tarefas e follow-ups comerciais';

-- ------------------------------------------------------------
-- 2.6 metas_vendas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS metas_vendas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  meta_valor NUMERIC(12,2) DEFAULT 0,
  realizado_valor NUMERIC(12,2) DEFAULT 0,
  meta_quantidade INTEGER DEFAULT 0,
  realizado_quantidade INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE metas_vendas IS 'Metas de vendas por vendedor e periodo';


-- ############################################################
-- 3. CLIENTES
-- ############################################################

-- ------------------------------------------------------------
-- 3.1 clientes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT UNIQUE,
  inscricao_estadual TEXT,
  telefone TEXT,
  email TEXT,
  site TEXT,
  segmento TEXT,
  classificacao TEXT DEFAULT 'C' CHECK (classificacao IN ('A', 'B', 'C', 'D')),
  tipo_cliente TEXT DEFAULT 'cliente_final' CHECK (tipo_cliente IN ('agencia', 'cliente_final', 'revenda')),
  origem TEXT,
  vendedor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sla_dias INTEGER,
  limite_credito NUMERIC(12,2),
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  observacoes TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE clientes IS 'Empresas clientes da Croma Print';

-- Agora adiciona FK de oportunidades -> clientes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'oportunidades_cliente_id_fkey'
      AND table_name = 'oportunidades'
  ) THEN
    ALTER TABLE oportunidades
      ADD CONSTRAINT oportunidades_cliente_id_fkey
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3.2 cliente_unidades
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cliente_unidades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  telefone TEXT,
  contato_local TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE cliente_unidades IS 'Unidades/filiais de cada cliente';

-- ------------------------------------------------------------
-- 3.3 cliente_contatos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cliente_contatos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cargo TEXT,
  departamento TEXT,
  telefone TEXT,
  email TEXT,
  whatsapp TEXT,
  e_decisor BOOLEAN DEFAULT FALSE,
  principal BOOLEAN DEFAULT FALSE,
  observacoes TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE cliente_contatos IS 'Contatos (pessoas) por cliente';


-- ############################################################
-- 4. PRODUTOS E PRECIFICACAO
-- ############################################################

-- ------------------------------------------------------------
-- 4.1 produtos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS produtos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT UNIQUE,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  descricao TEXT,
  unidade_padrao TEXT DEFAULT 'un',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE produtos IS 'Catalogo de produtos da Croma Print';

-- ------------------------------------------------------------
-- 4.2 produto_modelos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS produto_modelos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  largura_cm NUMERIC(10,2),
  altura_cm NUMERIC(10,2),
  area_m2 NUMERIC(10,4),
  markup_padrao NUMERIC(5,2) DEFAULT 40,
  margem_minima NUMERIC(5,2) DEFAULT 20,
  preco_fixo NUMERIC(12,2),
  tempo_producao_min INTEGER,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE produto_modelos IS 'Modelos/variantes de cada produto com dimensoes e precificacao';

-- ------------------------------------------------------------
-- 4.3 config_precificacao
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS config_precificacao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  faturamento_medio NUMERIC(12,2) DEFAULT 110000,
  custo_operacional NUMERIC(12,2) DEFAULT 36800,
  custo_produtivo NUMERIC(12,2) DEFAULT 23744,
  qtd_funcionarios INTEGER DEFAULT 6,
  horas_mes INTEGER DEFAULT 176,
  percentual_comissao NUMERIC(5,2) DEFAULT 5,
  percentual_impostos NUMERIC(5,2) DEFAULT 12,
  percentual_juros NUMERIC(5,2) DEFAULT 2,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE config_precificacao IS 'Parametros de custeio direto (Mubisys)';


-- ############################################################
-- 5. ESTOQUE E COMPRAS (antes de Propostas/Pedidos pois sao referenciados)
-- ############################################################

-- ------------------------------------------------------------
-- 5.1 materiais
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS materiais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT UNIQUE,
  nome TEXT NOT NULL,
  categoria TEXT,
  unidade TEXT DEFAULT 'un',
  estoque_minimo NUMERIC(12,3) DEFAULT 0,
  preco_medio NUMERIC(12,4),
  localizacao TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE materiais IS 'Cadastro de materiais/insumos';

-- ------------------------------------------------------------
-- 5.2 modelo_materiais
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS modelo_materiais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  modelo_id UUID NOT NULL REFERENCES produto_modelos(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
  quantidade_por_unidade NUMERIC(12,4) DEFAULT 1,
  unidade TEXT DEFAULT 'un',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE modelo_materiais IS 'Materiais necessarios por modelo de produto';

-- ------------------------------------------------------------
-- 5.3 modelo_processos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS modelo_processos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  modelo_id UUID NOT NULL REFERENCES produto_modelos(id) ON DELETE CASCADE,
  etapa TEXT NOT NULL,
  tempo_por_unidade_min INTEGER DEFAULT 0,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE modelo_processos IS 'Etapas de producao por modelo de produto';

-- ------------------------------------------------------------
-- 5.4 estoque_saldos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estoque_saldos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL UNIQUE REFERENCES materiais(id) ON DELETE CASCADE,
  quantidade_disponivel NUMERIC(12,3) DEFAULT 0,
  quantidade_reservada NUMERIC(12,3) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE estoque_saldos IS 'Saldos em estoque por material';

-- ------------------------------------------------------------
-- 5.5 estoque_movimentacoes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estoque_movimentacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida', 'reserva', 'liberacao_reserva', 'ajuste', 'devolucao')),
  quantidade NUMERIC(12,3) NOT NULL,
  referencia_tipo TEXT,
  referencia_id UUID,
  motivo TEXT,
  usuario_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE estoque_movimentacoes IS 'Historico de movimentacoes de estoque';

-- ------------------------------------------------------------
-- 5.6 fornecedores
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fornecedores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT,
  telefone TEXT,
  email TEXT,
  contato_nome TEXT,
  categorias TEXT[],
  lead_time_dias INTEGER,
  condicao_pagamento TEXT,
  observacoes TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE fornecedores IS 'Cadastro de fornecedores';

-- ------------------------------------------------------------
-- 5.7 pedidos_compra
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedidos_compra (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT UNIQUE,
  fornecedor_id UUID NOT NULL REFERENCES fornecedores(id) ON DELETE RESTRICT,
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'aprovado', 'enviado', 'parcial', 'recebido', 'cancelado')),
  valor_total NUMERIC(12,2) DEFAULT 0,
  previsao_entrega DATE,
  observacoes TEXT,
  criado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  aprovado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE pedidos_compra IS 'Pedidos de compra a fornecedores';

-- ------------------------------------------------------------
-- 5.8 pedido_compra_itens
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedido_compra_itens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_compra_id UUID NOT NULL REFERENCES pedidos_compra(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materiais(id) ON DELETE RESTRICT,
  quantidade NUMERIC(12,3) NOT NULL,
  valor_unitario NUMERIC(12,4) DEFAULT 0,
  valor_total NUMERIC(12,2) DEFAULT 0,
  quantidade_recebida NUMERIC(12,3) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE pedido_compra_itens IS 'Itens de pedidos de compra';

-- ------------------------------------------------------------
-- 5.9 historico_precos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS historico_precos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materiais(id) ON DELETE CASCADE,
  preco NUMERIC(12,4) NOT NULL,
  data_cotacao DATE DEFAULT CURRENT_DATE,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE historico_precos IS 'Historico de cotacoes de precos por fornecedor/material';


-- ############################################################
-- 6. COMERCIAL — PROPOSTAS (depende de clientes e produtos)
-- ############################################################

-- ------------------------------------------------------------
-- 6.1 propostas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS propostas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT UNIQUE,
  oportunidade_id UUID REFERENCES oportunidades(id) ON DELETE SET NULL,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  vendedor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  versao INTEGER DEFAULT 1,
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviada', 'em_revisao', 'aprovada', 'recusada', 'expirada')),
  titulo TEXT,
  validade_dias INTEGER DEFAULT 10,
  subtotal NUMERIC(12,2) DEFAULT 0,
  desconto_percentual NUMERIC(5,2) DEFAULT 0,
  desconto_valor NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  condicoes_pagamento TEXT,
  observacoes TEXT,
  aprovado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  aprovado_em TIMESTAMPTZ,
  cliente_nome_snapshot TEXT,
  cliente_cnpj_snapshot TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE propostas IS 'Propostas comerciais formais';

-- ------------------------------------------------------------
-- 6.2 proposta_itens
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proposta_itens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposta_id UUID NOT NULL REFERENCES propostas(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES produtos(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  especificacao TEXT,
  quantidade NUMERIC(10,3) DEFAULT 1,
  unidade TEXT DEFAULT 'un',
  largura_cm NUMERIC(10,2),
  altura_cm NUMERIC(10,2),
  area_m2 NUMERIC(10,4),
  custo_mp NUMERIC(12,2) DEFAULT 0,
  custo_mo NUMERIC(12,2) DEFAULT 0,
  custo_fixo NUMERIC(12,2) DEFAULT 0,
  markup_percentual NUMERIC(5,2) DEFAULT 40,
  valor_unitario NUMERIC(12,2) DEFAULT 0,
  valor_total NUMERIC(12,2) DEFAULT 0,
  prazo_producao_dias INTEGER,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE proposta_itens IS 'Itens detalhados de cada proposta com custeio';


-- ############################################################
-- 7. PEDIDOS
-- ############################################################

-- ------------------------------------------------------------
-- 7.1 pedidos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedidos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT UNIQUE,
  proposta_id UUID REFERENCES propostas(id) ON DELETE SET NULL,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  vendedor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'rascunho' CHECK (status IN (
    'rascunho', 'aguardando_aprovacao', 'aprovado', 'em_producao',
    'produzido', 'aguardando_instalacao', 'em_instalacao',
    'parcialmente_concluido', 'concluido', 'cancelado'
  )),
  prioridade TEXT DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  data_prometida DATE,
  data_conclusao TIMESTAMPTZ,
  valor_total NUMERIC(12,2) DEFAULT 0,
  custo_total NUMERIC(12,2) DEFAULT 0,
  margem_real NUMERIC(5,2),
  observacoes TEXT,
  aprovado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  aprovado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE pedidos IS 'Pedidos de venda confirmados';

-- ------------------------------------------------------------
-- 7.2 pedido_itens
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedido_itens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  proposta_item_id UUID REFERENCES proposta_itens(id) ON DELETE SET NULL,
  produto_id UUID REFERENCES produtos(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  especificacao TEXT,
  quantidade NUMERIC(10,3) DEFAULT 1,
  unidade TEXT DEFAULT 'un',
  valor_unitario NUMERIC(12,2) DEFAULT 0,
  valor_total NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_producao', 'produzido', 'em_instalacao', 'instalado', 'cancelado')),
  arte_url TEXT,
  instrucoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE pedido_itens IS 'Itens de cada pedido de venda';

-- ------------------------------------------------------------
-- 7.3 pedido_historico
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedido_historico (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  tipo_evento TEXT NOT NULL CHECK (tipo_evento IN ('status_change', 'edicao', 'aprovacao', 'cancelamento', 'nota')),
  descricao TEXT,
  dados_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE pedido_historico IS 'Historico de eventos por pedido';


-- ############################################################
-- 8. PRODUCAO
-- ############################################################

-- ------------------------------------------------------------
-- 8.1 ordens_producao
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ordens_producao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT UNIQUE,
  pedido_item_id UUID REFERENCES pedido_itens(id) ON DELETE SET NULL,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'aguardando_programacao' CHECK (status IN (
    'aguardando_programacao', 'em_fila', 'em_producao', 'em_acabamento',
    'em_conferencia', 'liberado', 'retrabalho', 'finalizado'
  )),
  prioridade INTEGER DEFAULT 0,
  responsavel_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  prazo_interno DATE,
  data_inicio TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  tempo_estimado_min INTEGER DEFAULT 0,
  tempo_real_min INTEGER DEFAULT 0,
  custo_mp_estimado NUMERIC(12,2) DEFAULT 0,
  custo_mp_real NUMERIC(12,2) DEFAULT 0,
  custo_mo_estimado NUMERIC(12,2) DEFAULT 0,
  custo_mo_real NUMERIC(12,2) DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE ordens_producao IS 'Ordens de producao vinculadas a pedidos';

-- ------------------------------------------------------------
-- 8.2 producao_etapas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS producao_etapas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_producao_id UUID NOT NULL REFERENCES ordens_producao(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'pulada')),
  responsavel_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  inicio TIMESTAMPTZ,
  fim TIMESTAMPTZ,
  tempo_estimado_min INTEGER DEFAULT 0,
  tempo_real_min INTEGER DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE producao_etapas IS 'Etapas individuais de cada ordem de producao';

-- ------------------------------------------------------------
-- 8.3 producao_checklist
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS producao_checklist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_producao_id UUID NOT NULL REFERENCES ordens_producao(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  conferido BOOLEAN DEFAULT FALSE,
  conferido_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  conferido_em TIMESTAMPTZ,
  observacao TEXT
);

COMMENT ON TABLE producao_checklist IS 'Checklist de qualidade por ordem de producao';

-- ------------------------------------------------------------
-- 8.4 producao_retrabalho
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS producao_retrabalho (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_producao_id UUID NOT NULL REFERENCES ordens_producao(id) ON DELETE CASCADE,
  causa TEXT NOT NULL CHECK (causa IN ('material_defeituoso', 'erro_operacional', 'erro_projeto', 'instrucao_incorreta', 'outro')),
  descricao TEXT,
  custo_adicional_mp NUMERIC(12,2) DEFAULT 0,
  custo_adicional_mo NUMERIC(12,2) DEFAULT 0,
  responsavel_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  data_registro TIMESTAMPTZ DEFAULT NOW(),
  data_resolucao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE producao_retrabalho IS 'Registro de retrabalhos e suas causas';


-- ############################################################
-- 9. FINANCEIRO
-- ############################################################

-- ------------------------------------------------------------
-- 9.1 plano_contas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plano_contas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'custo', 'despesa')),
  grupo TEXT,
  ativo BOOLEAN DEFAULT TRUE
);

COMMENT ON TABLE plano_contas IS 'Plano de contas simplificado';

-- ------------------------------------------------------------
-- 9.2 centros_custo
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS centros_custo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT TRUE
);

COMMENT ON TABLE centros_custo IS 'Centros de custo para rateio';

-- ------------------------------------------------------------
-- 9.3 contas_receber
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contas_receber (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  numero_titulo TEXT,
  valor_original NUMERIC(12,2) NOT NULL,
  valor_pago NUMERIC(12,2) DEFAULT 0,
  saldo NUMERIC(12,2),
  data_emissao DATE DEFAULT CURRENT_DATE,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT DEFAULT 'previsto' CHECK (status IN ('previsto', 'faturado', 'a_vencer', 'vencido', 'parcial', 'pago', 'cancelado')),
  forma_pagamento TEXT,
  conta_plano_id UUID REFERENCES plano_contas(id) ON DELETE SET NULL,
  centro_custo_id UUID REFERENCES centros_custo(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE contas_receber IS 'Contas a receber de clientes';

-- ------------------------------------------------------------
-- 9.4 parcelas_receber
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parcelas_receber (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_receber_id UUID NOT NULL REFERENCES contas_receber(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT DEFAULT 'a_vencer' CHECK (status IN ('a_vencer', 'vencido', 'pago', 'cancelado')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE parcelas_receber IS 'Parcelas individuais de contas a receber';

-- ------------------------------------------------------------
-- 9.5 contas_pagar
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contas_pagar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_compra_id UUID REFERENCES pedidos_compra(id) ON DELETE SET NULL,
  fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL,
  categoria TEXT,
  numero_titulo TEXT,
  numero_nf TEXT,
  valor_original NUMERIC(12,2) NOT NULL,
  valor_pago NUMERIC(12,2) DEFAULT 0,
  saldo NUMERIC(12,2),
  data_emissao DATE DEFAULT CURRENT_DATE,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT DEFAULT 'a_pagar' CHECK (status IN ('a_pagar', 'vencido', 'parcial', 'pago', 'cancelado')),
  forma_pagamento TEXT,
  conta_plano_id UUID REFERENCES plano_contas(id) ON DELETE SET NULL,
  centro_custo_id UUID REFERENCES centros_custo(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE contas_pagar IS 'Contas a pagar a fornecedores';

-- ------------------------------------------------------------
-- 9.6 parcelas_pagar
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parcelas_pagar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_pagar_id UUID NOT NULL REFERENCES contas_pagar(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT DEFAULT 'a_vencer' CHECK (status IN ('a_vencer', 'vencido', 'pago', 'cancelado')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE parcelas_pagar IS 'Parcelas individuais de contas a pagar';

-- ------------------------------------------------------------
-- 9.7 comissoes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comissoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  conta_receber_id UUID REFERENCES contas_receber(id) ON DELETE SET NULL,
  percentual NUMERIC(5,2) NOT NULL,
  valor_base NUMERIC(12,2) NOT NULL,
  valor_comissao NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'gerada' CHECK (status IN ('gerada', 'aprovada', 'paga', 'cancelada')),
  data_pagamento DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE comissoes IS 'Comissoes de vendedores por pedido';


-- ############################################################
-- 10. INSTALACAO E CAMPO
-- ############################################################

-- ------------------------------------------------------------
-- 10.1 equipes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  regiao TEXT,
  veiculo_placa TEXT,
  veiculo_tipo TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE equipes IS 'Equipes de instalacao/campo';

-- ------------------------------------------------------------
-- 10.2 ordens_instalacao
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ordens_instalacao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT UNIQUE,
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE RESTRICT,
  pedido_item_id UUID REFERENCES pedido_itens(id) ON DELETE SET NULL,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  unidade_id UUID REFERENCES cliente_unidades(id) ON DELETE SET NULL,
  equipe_id UUID REFERENCES equipes(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'aguardando_agendamento' CHECK (status IN (
    'aguardando_agendamento', 'agendada', 'equipe_em_deslocamento',
    'em_execucao', 'pendente', 'reagendada', 'concluida', 'nao_concluida'
  )),
  data_agendada DATE,
  hora_prevista TIME,
  data_execucao TIMESTAMPTZ,
  endereco_completo TEXT,
  instrucoes TEXT,
  materiais_necessarios TEXT,
  custo_logistico NUMERIC(12,2) DEFAULT 0,
  observacoes TEXT,
  motivo_reagendamento TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE ordens_instalacao IS 'Ordens de instalacao em campo';

-- ------------------------------------------------------------
-- 10.3 field_tasks
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS field_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_instalacao_id UUID NOT NULL REFERENCES ordens_instalacao(id) ON DELETE CASCADE,
  tecnico_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  status TEXT DEFAULT 'atribuida' CHECK (status IN ('atribuida', 'em_deslocamento', 'em_execucao', 'concluida', 'nao_concluida')),
  inicio TIMESTAMPTZ,
  fim TIMESTAMPTZ,
  latitude_inicio NUMERIC(10,7),
  longitude_inicio NUMERIC(10,7),
  latitude_fim NUMERIC(10,7),
  longitude_fim NUMERIC(10,7),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE field_tasks IS 'Tarefas de campo atribuidas a tecnicos';

-- ------------------------------------------------------------
-- 10.4 field_checklists
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS field_checklists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  field_task_id UUID NOT NULL REFERENCES field_tasks(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('pre', 'pos')),
  item TEXT NOT NULL,
  marcado BOOLEAN DEFAULT FALSE,
  observacao TEXT,
  marcado_em TIMESTAMPTZ
);

COMMENT ON TABLE field_checklists IS 'Checklist pre e pos instalacao';

-- ------------------------------------------------------------
-- 10.5 field_media
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS field_media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  field_task_id UUID NOT NULL REFERENCES field_tasks(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('foto', 'video')),
  momento TEXT NOT NULL CHECK (momento IN ('antes', 'durante', 'depois')),
  url TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE field_media IS 'Fotos e videos de campo (antes/durante/depois)';

-- ------------------------------------------------------------
-- 10.6 field_signatures
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS field_signatures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  field_task_id UUID REFERENCES field_tasks(id) ON DELETE CASCADE,
  assinante_nome TEXT NOT NULL,
  assinante_cargo TEXT,
  imagem_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE field_signatures IS 'Assinaturas digitais de aceite de instalacao';


-- ############################################################
-- 11. QUALIDADE
-- ############################################################

-- ------------------------------------------------------------
-- 11.1 ocorrencias
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ocorrencias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('retrabalho', 'devolucao', 'erro_producao', 'erro_instalacao', 'divergencia_cliente')),
  pedido_id UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  ordem_producao_id UUID REFERENCES ordens_producao(id) ON DELETE SET NULL,
  ordem_instalacao_id UUID REFERENCES ordens_instalacao(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  causa TEXT CHECK (causa IN ('material_defeituoso', 'erro_operacional', 'erro_projeto', 'instrucao_incorreta', 'outro')),
  status TEXT DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_analise', 'em_tratativa', 'resolvida', 'encerrada')),
  responsavel_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  custo_mp NUMERIC(12,2) DEFAULT 0,
  custo_mo NUMERIC(12,2) DEFAULT 0,
  custo_total NUMERIC(12,2) DEFAULT 0,
  impacto_prazo_dias INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE ocorrencias IS 'Ocorrencias de qualidade (retrabalho, devolucao, erros)';

-- ------------------------------------------------------------
-- 11.2 ocorrencia_tratativas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ocorrencia_tratativas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ocorrencia_id UUID NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
  acao_corretiva TEXT,
  responsavel_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  prazo DATE,
  data_conclusao TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE ocorrencia_tratativas IS 'Tratativas e acoes corretivas por ocorrencia';


-- ############################################################
-- 12. SEQUENCES E TRIGGERS DE AUTO-NUMERACAO
-- ############################################################

-- Sequencias
CREATE SEQUENCE IF NOT EXISTS proposta_numero_seq START 1;
CREATE SEQUENCE IF NOT EXISTS pedido_numero_seq START 1;
CREATE SEQUENCE IF NOT EXISTS op_numero_seq START 1;
CREATE SEQUENCE IF NOT EXISTS oi_numero_seq START 1;
CREATE SEQUENCE IF NOT EXISTS pc_numero_seq START 1;

-- Funcao generica de auto-numeracao
CREATE OR REPLACE FUNCTION gerar_numero_auto()
RETURNS TRIGGER AS $$
DECLARE
  prefixo TEXT;
  seq_name TEXT;
  padding INT;
  novo_numero TEXT;
BEGIN
  IF NEW.numero IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Determina prefixo e sequencia com base na tabela
  CASE TG_TABLE_NAME
    WHEN 'propostas' THEN
      prefixo := 'PROP';
      seq_name := 'proposta_numero_seq';
      padding := 3;
    WHEN 'pedidos' THEN
      prefixo := 'PED';
      seq_name := 'pedido_numero_seq';
      padding := 4;
    WHEN 'ordens_producao' THEN
      prefixo := 'OP';
      seq_name := 'op_numero_seq';
      padding := 4;
    WHEN 'ordens_instalacao' THEN
      prefixo := 'INST';
      seq_name := 'oi_numero_seq';
      padding := 4;
    WHEN 'pedidos_compra' THEN
      prefixo := 'PC';
      seq_name := 'pc_numero_seq';
      padding := 4;
    ELSE
      RETURN NEW;
  END CASE;

  novo_numero := prefixo || '-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval(seq_name)::TEXT, padding, '0');
  NEW.numero := novo_numero;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers de auto-numeracao
DROP TRIGGER IF EXISTS trigger_auto_numero_propostas ON propostas;
CREATE TRIGGER trigger_auto_numero_propostas
  BEFORE INSERT ON propostas
  FOR EACH ROW EXECUTE FUNCTION gerar_numero_auto();

DROP TRIGGER IF EXISTS trigger_auto_numero_pedidos ON pedidos;
CREATE TRIGGER trigger_auto_numero_pedidos
  BEFORE INSERT ON pedidos
  FOR EACH ROW EXECUTE FUNCTION gerar_numero_auto();

DROP TRIGGER IF EXISTS trigger_auto_numero_op ON ordens_producao;
CREATE TRIGGER trigger_auto_numero_op
  BEFORE INSERT ON ordens_producao
  FOR EACH ROW EXECUTE FUNCTION gerar_numero_auto();

DROP TRIGGER IF EXISTS trigger_auto_numero_oi ON ordens_instalacao;
CREATE TRIGGER trigger_auto_numero_oi
  BEFORE INSERT ON ordens_instalacao
  FOR EACH ROW EXECUTE FUNCTION gerar_numero_auto();

DROP TRIGGER IF EXISTS trigger_auto_numero_pc ON pedidos_compra;
CREATE TRIGGER trigger_auto_numero_pc
  BEFORE INSERT ON pedidos_compra
  FOR EACH ROW EXECUTE FUNCTION gerar_numero_auto();


-- ############################################################
-- 13. TRIGGERS DE UPDATED_AT
-- ############################################################

-- Lista de tabelas com updated_at
DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY[
    'leads', 'oportunidades', 'clientes', 'produtos', 'materiais',
    'fornecedores', 'propostas', 'pedidos', 'ordens_producao',
    'pedidos_compra', 'contas_receber', 'contas_pagar',
    'ordens_instalacao', 'ocorrencias', 'estoque_saldos',
    'config_precificacao'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trigger_%s_updated_at ON %I;
       CREATE TRIGGER trigger_%s_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
      t, t, t, t
    );
  END LOOP;
END $$;


-- ############################################################
-- 14. RLS POLICIES
-- ############################################################

-- Habilita RLS em todas as tabelas do modulo comercial/ERP
DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY[
    'roles', 'permissions', 'role_permissions',
    'audit_logs', 'attachments', 'notas_internas',
    'lead_sources', 'leads', 'oportunidades',
    'atividades_comerciais', 'tarefas_comerciais', 'metas_vendas',
    'clientes', 'cliente_unidades', 'cliente_contatos',
    'produtos', 'produto_modelos', 'modelo_materiais', 'modelo_processos',
    'config_precificacao',
    'materiais', 'estoque_saldos', 'estoque_movimentacoes',
    'fornecedores', 'pedidos_compra', 'pedido_compra_itens', 'historico_precos',
    'propostas', 'proposta_itens',
    'pedidos', 'pedido_itens', 'pedido_historico',
    'ordens_producao', 'producao_etapas', 'producao_checklist', 'producao_retrabalho',
    'plano_contas', 'centros_custo',
    'contas_receber', 'parcelas_receber',
    'contas_pagar', 'parcelas_pagar', 'comissoes',
    'equipes', 'ordens_instalacao', 'field_tasks',
    'field_checklists', 'field_media', 'field_signatures',
    'ocorrencias', 'ocorrencia_tratativas'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas
  LOOP
    -- Habilita RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);

    -- Remove policy anterior se existir
    EXECUTE format(
      'DROP POLICY IF EXISTS "auth_all_%s" ON %I;', t, t
    );

    -- Cria policy permissiva para authenticated (sera refinada por role depois)
    EXECUTE format(
      'CREATE POLICY "auth_all_%s" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true);',
      t, t
    );
  END LOOP;
END $$;


-- ############################################################
-- 15. INDEXES
-- ############################################################

-- === Foreign Keys ===
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_perm ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role_id);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_tabela ON audit_logs(tabela);
CREATE INDEX IF NOT EXISTS idx_audit_registro ON audit_logs(registro_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_attachments_entidade ON attachments(entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_notas_entidade ON notas_internas(entidade_tipo, entidade_id);

CREATE INDEX IF NOT EXISTS idx_leads_origem ON leads(origem_id);
CREATE INDEX IF NOT EXISTS idx_leads_vendedor ON leads(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);

CREATE INDEX IF NOT EXISTS idx_oportunidades_lead ON oportunidades(lead_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_cliente ON oportunidades(cliente_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_vendedor ON oportunidades(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_fase ON oportunidades(fase);

CREATE INDEX IF NOT EXISTS idx_atividades_entidade ON atividades_comerciais(entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_atividades_autor ON atividades_comerciais(autor_id);
CREATE INDEX IF NOT EXISTS idx_atividades_data ON atividades_comerciais(data_atividade);

CREATE INDEX IF NOT EXISTS idx_tarefas_responsavel ON tarefas_comerciais(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_status ON tarefas_comerciais(status);
CREATE INDEX IF NOT EXISTS idx_tarefas_data_prevista ON tarefas_comerciais(data_prevista);
CREATE INDEX IF NOT EXISTS idx_tarefas_entidade ON tarefas_comerciais(entidade_tipo, entidade_id);

CREATE INDEX IF NOT EXISTS idx_metas_vendedor ON metas_vendas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_metas_periodo ON metas_vendas(periodo_inicio, periodo_fim);

CREATE INDEX IF NOT EXISTS idx_clientes_cnpj ON clientes(cnpj);
CREATE INDEX IF NOT EXISTS idx_clientes_razao_social ON clientes(razao_social);
CREATE INDEX IF NOT EXISTS idx_clientes_vendedor ON clientes(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_clientes_ativo ON clientes(ativo);
CREATE INDEX IF NOT EXISTS idx_clientes_classificacao ON clientes(classificacao);
CREATE INDEX IF NOT EXISTS idx_clientes_lead ON clientes(lead_id);

CREATE INDEX IF NOT EXISTS idx_unidades_cliente ON cliente_unidades(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contatos_cliente ON cliente_contatos(cliente_id);

CREATE INDEX IF NOT EXISTS idx_produtos_codigo ON produtos(codigo);
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON produtos(ativo);

CREATE INDEX IF NOT EXISTS idx_modelos_produto ON produto_modelos(produto_id);
CREATE INDEX IF NOT EXISTS idx_modelo_mat_modelo ON modelo_materiais(modelo_id);
CREATE INDEX IF NOT EXISTS idx_modelo_mat_material ON modelo_materiais(material_id);
CREATE INDEX IF NOT EXISTS idx_modelo_proc_modelo ON modelo_processos(modelo_id);

CREATE INDEX IF NOT EXISTS idx_materiais_codigo ON materiais(codigo);
CREATE INDEX IF NOT EXISTS idx_materiais_categoria ON materiais(categoria);
CREATE INDEX IF NOT EXISTS idx_estoque_saldos_material ON estoque_saldos(material_id);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_material ON estoque_movimentacoes(material_id);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_tipo ON estoque_movimentacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_created ON estoque_movimentacoes(created_at);

CREATE INDEX IF NOT EXISTS idx_fornecedores_cnpj ON fornecedores(cnpj);

CREATE INDEX IF NOT EXISTS idx_pc_fornecedor ON pedidos_compra(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_pc_status ON pedidos_compra(status);
CREATE INDEX IF NOT EXISTS idx_pc_numero ON pedidos_compra(numero);
CREATE INDEX IF NOT EXISTS idx_pci_pedido ON pedido_compra_itens(pedido_compra_id);
CREATE INDEX IF NOT EXISTS idx_pci_material ON pedido_compra_itens(material_id);

CREATE INDEX IF NOT EXISTS idx_hist_precos_forn ON historico_precos(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_hist_precos_mat ON historico_precos(material_id);
CREATE INDEX IF NOT EXISTS idx_hist_precos_data ON historico_precos(data_cotacao);

CREATE INDEX IF NOT EXISTS idx_propostas_numero ON propostas(numero);
CREATE INDEX IF NOT EXISTS idx_propostas_cliente ON propostas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_propostas_oportunidade ON propostas(oportunidade_id);
CREATE INDEX IF NOT EXISTS idx_propostas_vendedor ON propostas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_propostas_status ON propostas(status);
CREATE INDEX IF NOT EXISTS idx_proposta_itens_proposta ON proposta_itens(proposta_id);
CREATE INDEX IF NOT EXISTS idx_proposta_itens_produto ON proposta_itens(produto_id);

CREATE INDEX IF NOT EXISTS idx_pedidos_numero ON pedidos(numero);
CREATE INDEX IF NOT EXISTS idx_pedidos_proposta ON pedidos(proposta_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_vendedor ON pedidos(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_data_prometida ON pedidos(data_prometida);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido ON pedido_itens(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_status ON pedido_itens(status);
CREATE INDEX IF NOT EXISTS idx_pedido_hist_pedido ON pedido_historico(pedido_id);

CREATE INDEX IF NOT EXISTS idx_op_numero ON ordens_producao(numero);
CREATE INDEX IF NOT EXISTS idx_op_pedido ON ordens_producao(pedido_id);
CREATE INDEX IF NOT EXISTS idx_op_pedido_item ON ordens_producao(pedido_item_id);
CREATE INDEX IF NOT EXISTS idx_op_status ON ordens_producao(status);
CREATE INDEX IF NOT EXISTS idx_op_responsavel ON ordens_producao(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_op_prazo ON ordens_producao(prazo_interno);
CREATE INDEX IF NOT EXISTS idx_pe_ordem ON producao_etapas(ordem_producao_id);
CREATE INDEX IF NOT EXISTS idx_pcl_ordem ON producao_checklist(ordem_producao_id);
CREATE INDEX IF NOT EXISTS idx_pr_ordem ON producao_retrabalho(ordem_producao_id);

CREATE INDEX IF NOT EXISTS idx_cr_pedido ON contas_receber(pedido_id);
CREATE INDEX IF NOT EXISTS idx_cr_cliente ON contas_receber(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cr_status ON contas_receber(status);
CREATE INDEX IF NOT EXISTS idx_cr_vencimento ON contas_receber(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_cr_plano ON contas_receber(conta_plano_id);
CREATE INDEX IF NOT EXISTS idx_parc_rec_conta ON parcelas_receber(conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_parc_rec_status ON parcelas_receber(status);
CREATE INDEX IF NOT EXISTS idx_parc_rec_venc ON parcelas_receber(data_vencimento);

CREATE INDEX IF NOT EXISTS idx_cp_fornecedor ON contas_pagar(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_cp_pc ON contas_pagar(pedido_compra_id);
CREATE INDEX IF NOT EXISTS idx_cp_status ON contas_pagar(status);
CREATE INDEX IF NOT EXISTS idx_cp_vencimento ON contas_pagar(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_cp_plano ON contas_pagar(conta_plano_id);
CREATE INDEX IF NOT EXISTS idx_parc_pag_conta ON parcelas_pagar(conta_pagar_id);
CREATE INDEX IF NOT EXISTS idx_parc_pag_status ON parcelas_pagar(status);
CREATE INDEX IF NOT EXISTS idx_parc_pag_venc ON parcelas_pagar(data_vencimento);

CREATE INDEX IF NOT EXISTS idx_comissoes_vendedor ON comissoes(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_pedido ON comissoes(pedido_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_status ON comissoes(status);

CREATE INDEX IF NOT EXISTS idx_equipes_ativo ON equipes(ativo);
CREATE INDEX IF NOT EXISTS idx_oi_numero ON ordens_instalacao(numero);
CREATE INDEX IF NOT EXISTS idx_oi_pedido ON ordens_instalacao(pedido_id);
CREATE INDEX IF NOT EXISTS idx_oi_cliente ON ordens_instalacao(cliente_id);
CREATE INDEX IF NOT EXISTS idx_oi_unidade ON ordens_instalacao(unidade_id);
CREATE INDEX IF NOT EXISTS idx_oi_equipe ON ordens_instalacao(equipe_id);
CREATE INDEX IF NOT EXISTS idx_oi_status ON ordens_instalacao(status);
CREATE INDEX IF NOT EXISTS idx_oi_data_agendada ON ordens_instalacao(data_agendada);

CREATE INDEX IF NOT EXISTS idx_ft_ordem ON field_tasks(ordem_instalacao_id);
CREATE INDEX IF NOT EXISTS idx_ft_tecnico ON field_tasks(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_ft_status ON field_tasks(status);
CREATE INDEX IF NOT EXISTS idx_fcl_task ON field_checklists(field_task_id);
CREATE INDEX IF NOT EXISTS idx_fm_task ON field_media(field_task_id);
CREATE INDEX IF NOT EXISTS idx_fs_task ON field_signatures(field_task_id);

CREATE INDEX IF NOT EXISTS idx_ocorr_pedido ON ocorrencias(pedido_id);
CREATE INDEX IF NOT EXISTS idx_ocorr_op ON ocorrencias(ordem_producao_id);
CREATE INDEX IF NOT EXISTS idx_ocorr_oi ON ocorrencias(ordem_instalacao_id);
CREATE INDEX IF NOT EXISTS idx_ocorr_status ON ocorrencias(status);
CREATE INDEX IF NOT EXISTS idx_ocorr_tipo ON ocorrencias(tipo);
CREATE INDEX IF NOT EXISTS idx_ocorr_trat_ocorr ON ocorrencia_tratativas(ocorrencia_id);


-- ############################################################
-- 16. SEED DATA
-- ############################################################

-- ============================================================
-- 16.1 Lead Sources
-- ============================================================
INSERT INTO lead_sources (nome) VALUES
  ('Google'),
  ('Indicacao'),
  ('Feira'),
  ('LinkedIn'),
  ('Prospeccao'),
  ('Site'),
  ('WhatsApp'),
  ('Telefone')
ON CONFLICT (nome) DO NOTHING;

-- ============================================================
-- 16.2 Roles
-- ============================================================
INSERT INTO roles (nome, descricao) VALUES
  ('admin', 'Administrador do sistema com acesso total'),
  ('diretor', 'Diretor com visao gerencial completa'),
  ('comercial', 'Vendedor com acesso ao modulo comercial'),
  ('comercial_senior', 'Vendedor senior com permissoes de aprovacao'),
  ('financeiro', 'Acesso ao modulo financeiro'),
  ('producao', 'Acesso ao modulo de producao'),
  ('compras', 'Acesso ao modulo de compras e estoque'),
  ('logistica', 'Acesso ao modulo de instalacao e campo'),
  ('instalador', 'Tecnico de campo com acesso mobile')
ON CONFLICT (nome) DO NOTHING;

-- ============================================================
-- 16.3 Permissions
-- ============================================================
INSERT INTO permissions (modulo, acao, descricao) VALUES
  -- Comercial
  ('comercial', 'ver', 'Visualizar modulo comercial'),
  ('comercial', 'criar', 'Criar leads, oportunidades e propostas'),
  ('comercial', 'editar', 'Editar registros comerciais'),
  ('comercial', 'excluir', 'Excluir registros comerciais'),
  ('comercial', 'aprovar', 'Aprovar propostas e descontos'),
  ('comercial', 'exportar', 'Exportar dados comerciais'),
  -- Clientes
  ('clientes', 'ver', 'Visualizar clientes'),
  ('clientes', 'criar', 'Cadastrar novos clientes'),
  ('clientes', 'editar', 'Editar dados de clientes'),
  ('clientes', 'excluir', 'Excluir clientes'),
  ('clientes', 'exportar', 'Exportar lista de clientes'),
  -- Pedidos
  ('pedidos', 'ver', 'Visualizar pedidos'),
  ('pedidos', 'criar', 'Criar novos pedidos'),
  ('pedidos', 'editar', 'Editar pedidos'),
  ('pedidos', 'excluir', 'Cancelar pedidos'),
  ('pedidos', 'aprovar', 'Aprovar pedidos para producao'),
  ('pedidos', 'exportar', 'Exportar pedidos'),
  -- Producao
  ('producao', 'ver', 'Visualizar ordens de producao'),
  ('producao', 'criar', 'Criar ordens de producao'),
  ('producao', 'editar', 'Atualizar status e dados de producao'),
  ('producao', 'excluir', 'Cancelar ordens de producao'),
  ('producao', 'aprovar', 'Liberar producao finalizada'),
  ('producao', 'exportar', 'Exportar dados de producao'),
  -- Estoque
  ('estoque', 'ver', 'Visualizar estoque e materiais'),
  ('estoque', 'criar', 'Registrar movimentacoes de estoque'),
  ('estoque', 'editar', 'Editar cadastro de materiais'),
  ('estoque', 'excluir', 'Remover materiais'),
  ('estoque', 'exportar', 'Exportar dados de estoque'),
  -- Compras
  ('compras', 'ver', 'Visualizar pedidos de compra'),
  ('compras', 'criar', 'Criar pedidos de compra'),
  ('compras', 'editar', 'Editar pedidos de compra'),
  ('compras', 'excluir', 'Cancelar pedidos de compra'),
  ('compras', 'aprovar', 'Aprovar pedidos de compra'),
  ('compras', 'exportar', 'Exportar dados de compras'),
  -- Financeiro
  ('financeiro', 'ver', 'Visualizar modulo financeiro'),
  ('financeiro', 'criar', 'Criar lancamentos financeiros'),
  ('financeiro', 'editar', 'Editar lancamentos financeiros'),
  ('financeiro', 'excluir', 'Excluir lancamentos financeiros'),
  ('financeiro', 'aprovar', 'Aprovar pagamentos e comissoes'),
  ('financeiro', 'exportar', 'Exportar dados financeiros'),
  -- Instalacao
  ('instalacao', 'ver', 'Visualizar ordens de instalacao'),
  ('instalacao', 'criar', 'Criar ordens de instalacao'),
  ('instalacao', 'editar', 'Atualizar instalacoes'),
  ('instalacao', 'excluir', 'Cancelar instalacoes'),
  ('instalacao', 'aprovar', 'Aprovar conclusao de instalacao'),
  ('instalacao', 'exportar', 'Exportar dados de instalacao'),
  -- Qualidade
  ('qualidade', 'ver', 'Visualizar ocorrencias de qualidade'),
  ('qualidade', 'criar', 'Registrar ocorrencias'),
  ('qualidade', 'editar', 'Editar e tratar ocorrencias'),
  ('qualidade', 'excluir', 'Encerrar ocorrencias'),
  ('qualidade', 'exportar', 'Exportar dados de qualidade'),
  -- Admin
  ('admin', 'ver', 'Visualizar configuracoes do sistema'),
  ('admin', 'criar', 'Criar usuarios e permissoes'),
  ('admin', 'editar', 'Editar configuracoes'),
  ('admin', 'excluir', 'Remover usuarios e dados'),
  ('admin', 'aprovar', 'Aprovar alteracoes de sistema'),
  ('admin', 'exportar', 'Exportar dados do sistema')
ON CONFLICT (modulo, acao) DO NOTHING;

-- ============================================================
-- 16.4 Role Permissions (admin gets everything)
-- ============================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.nome = 'admin'
ON CONFLICT DO NOTHING;

-- Diretor gets everything except admin module
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.nome = 'diretor' AND p.modulo != 'admin'
ON CONFLICT DO NOTHING;

-- Comercial: comercial + clientes + pedidos (ver)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.nome = 'comercial'
  AND (
    p.modulo IN ('comercial', 'clientes')
    OR (p.modulo = 'pedidos' AND p.acao IN ('ver', 'criar', 'exportar'))
  )
ON CONFLICT DO NOTHING;

-- Comercial Senior: comercial + clientes + pedidos (tudo) + financeiro (ver)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.nome = 'comercial_senior'
  AND (
    p.modulo IN ('comercial', 'clientes', 'pedidos')
    OR (p.modulo = 'financeiro' AND p.acao IN ('ver', 'exportar'))
  )
ON CONFLICT DO NOTHING;

-- Financeiro: financeiro + pedidos (ver) + clientes (ver) + compras (ver)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.nome = 'financeiro'
  AND (
    p.modulo = 'financeiro'
    OR (p.modulo IN ('pedidos', 'clientes', 'compras') AND p.acao IN ('ver', 'exportar'))
  )
ON CONFLICT DO NOTHING;

-- Producao: producao + estoque + pedidos (ver) + qualidade
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.nome = 'producao'
  AND (
    p.modulo IN ('producao', 'estoque', 'qualidade')
    OR (p.modulo = 'pedidos' AND p.acao IN ('ver', 'exportar'))
  )
ON CONFLICT DO NOTHING;

-- Compras: compras + estoque + financeiro (ver)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.nome = 'compras'
  AND (
    p.modulo IN ('compras', 'estoque')
    OR (p.modulo = 'financeiro' AND p.acao IN ('ver', 'exportar'))
  )
ON CONFLICT DO NOTHING;

-- Logistica: instalacao + pedidos (ver) + qualidade
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.nome = 'logistica'
  AND (
    p.modulo IN ('instalacao', 'qualidade')
    OR (p.modulo = 'pedidos' AND p.acao IN ('ver', 'exportar'))
  )
ON CONFLICT DO NOTHING;

-- Instalador: instalacao (ver, editar) + qualidade (ver, criar)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.nome = 'instalador'
  AND (
    (p.modulo = 'instalacao' AND p.acao IN ('ver', 'editar'))
    OR (p.modulo = 'qualidade' AND p.acao IN ('ver', 'criar'))
  )
ON CONFLICT DO NOTHING;


-- ============================================================
-- 16.5 Clientes Demo
-- ============================================================
INSERT INTO clientes (razao_social, nome_fantasia, cnpj, telefone, email, segmento, classificacao, tipo_cliente, origem, cidade, estado, ativo) VALUES
  ('Beira Rio S.A.', 'Beira Rio', '94.894.806/0001-08', '(51) 3584-2200', 'comercial@beirario.com.br', 'Fabricante de Calcados', 'A', 'cliente_final', 'Prospeccao', 'Novo Hamburgo', 'RS', TRUE),
  ('Lojas Renner S.A.', 'Renner', '92.754.738/0001-62', '(51) 2121-7000', 'compras@renner.com.br', 'Rede de Lojas', 'A', 'cliente_final', 'Indicacao', 'Porto Alegre', 'RS', TRUE),
  ('Paqueta Calcados S.A.', 'Paqueta', '87.936.244/0001-00', '(51) 3064-5000', 'marketing@paqueta.com.br', 'Rede de Calcados', 'A', 'cliente_final', 'Prospeccao', 'Sapiranga', 'RS', TRUE),
  ('Cia Zaffari Comercio e Industria', 'Farmacias Sao Joao', '93.209.765/0001-17', '(51) 3218-9800', 'marketing@saojoao.com.br', 'Rede de Farmacias', 'B', 'cliente_final', 'Indicacao', 'Porto Alegre', 'RS', TRUE),
  ('BIG Hipermercados S.A.', 'BIG', '91.794.533/0001-80', '(51) 3026-8000', 'visual@big.com.br', 'Rede de Supermercados', 'A', 'cliente_final', 'Feira', 'Porto Alegre', 'RS', TRUE),
  ('Kreatif Comunicacao Visual Ltda', 'Kreatif', '12.345.678/0001-90', '(51) 3333-4444', 'contato@kreatif.com.br', 'Agencia', 'B', 'agencia', 'Google', 'Porto Alegre', 'RS', TRUE),
  ('Visual Print Servicos Graficos', 'Visual Print', '98.765.432/0001-10', '(51) 3555-6666', 'orcamentos@visualprint.com.br', 'Grafica/Revenda', 'C', 'revenda', 'Site', 'Canoas', 'RS', TRUE)
ON CONFLICT (cnpj) DO NOTHING;

-- ============================================================
-- 16.6 Contatos Demo (3 por cliente principal)
-- ============================================================

-- Beira Rio
INSERT INTO cliente_contatos (cliente_id, nome, cargo, departamento, telefone, email, whatsapp, e_decisor, principal)
SELECT c.id, vals.nome, vals.cargo, vals.departamento, vals.telefone, vals.email, vals.whatsapp, vals.e_decisor, vals.principal
FROM clientes c
CROSS JOIN (VALUES
  ('Marcelo Fonseca', 'Gerente de Marketing', 'Marketing', '(51) 3584-2201', 'marcelo.fonseca@beirario.com.br', '51998001001', TRUE, TRUE),
  ('Juliana Moraes', 'Coordenadora de Compras', 'Compras', '(51) 3584-2215', 'juliana.moraes@beirario.com.br', '51998001002', FALSE, FALSE),
  ('Roberto Almeida', 'Analista de Trade Marketing', 'Marketing', '(51) 3584-2220', 'roberto.almeida@beirario.com.br', '51998001003', FALSE, FALSE)
) AS vals(nome, cargo, departamento, telefone, email, whatsapp, e_decisor, principal)
WHERE c.cnpj = '94.894.806/0001-08';

-- Renner
INSERT INTO cliente_contatos (cliente_id, nome, cargo, departamento, telefone, email, whatsapp, e_decisor, principal)
SELECT c.id, vals.nome, vals.cargo, vals.departamento, vals.telefone, vals.email, vals.whatsapp, vals.e_decisor, vals.principal
FROM clientes c
CROSS JOIN (VALUES
  ('Fernanda Lima', 'Diretora de Visual Merchandising', 'VM', '(51) 2121-7010', 'fernanda.lima@renner.com.br', '51999002001', TRUE, TRUE),
  ('Carlos Netto', 'Comprador Senior', 'Compras', '(51) 2121-7025', 'carlos.netto@renner.com.br', '51999002002', TRUE, FALSE),
  ('Amanda Souza', 'Analista de Projetos', 'Projetos', '(51) 2121-7030', 'amanda.souza@renner.com.br', '51999002003', FALSE, FALSE)
) AS vals(nome, cargo, departamento, telefone, email, whatsapp, e_decisor, principal)
WHERE c.cnpj = '92.754.738/0001-62';

-- Paqueta
INSERT INTO cliente_contatos (cliente_id, nome, cargo, departamento, telefone, email, whatsapp, e_decisor, principal)
SELECT c.id, vals.nome, vals.cargo, vals.departamento, vals.telefone, vals.email, vals.whatsapp, vals.e_decisor, vals.principal
FROM clientes c
CROSS JOIN (VALUES
  ('Eduardo Bastos', 'Gerente de Expansao', 'Expansao', '(51) 3064-5010', 'eduardo.bastos@paqueta.com.br', '51997003001', TRUE, TRUE),
  ('Mariana Keller', 'Coordenadora de Marketing', 'Marketing', '(51) 3064-5020', 'mariana.keller@paqueta.com.br', '51997003002', FALSE, FALSE),
  ('Thiago Oliveira', 'Arquiteto de Lojas', 'Projetos', '(51) 3064-5025', 'thiago.oliveira@paqueta.com.br', '51997003003', FALSE, FALSE)
) AS vals(nome, cargo, departamento, telefone, email, whatsapp, e_decisor, principal)
WHERE c.cnpj = '87.936.244/0001-00';

-- BIG
INSERT INTO cliente_contatos (cliente_id, nome, cargo, departamento, telefone, email, whatsapp, e_decisor, principal)
SELECT c.id, vals.nome, vals.cargo, vals.departamento, vals.telefone, vals.email, vals.whatsapp, vals.e_decisor, vals.principal
FROM clientes c
CROSS JOIN (VALUES
  ('Patricia Gonçalves', 'Gerente de Comunicacao Visual', 'Marketing', '(51) 3026-8010', 'patricia.goncalves@big.com.br', '51996004001', TRUE, TRUE),
  ('Luciano Weber', 'Supervisor de Lojas', 'Operacoes', '(51) 3026-8020', 'luciano.weber@big.com.br', '51996004002', FALSE, FALSE),
  ('Renata Campos', 'Analista de Compras', 'Compras', '(51) 3026-8030', 'renata.campos@big.com.br', '51996004003', FALSE, FALSE)
) AS vals(nome, cargo, departamento, telefone, email, whatsapp, e_decisor, principal)
WHERE c.cnpj = '91.794.533/0001-80';

-- Farmacias Sao Joao
INSERT INTO cliente_contatos (cliente_id, nome, cargo, departamento, telefone, email, whatsapp, e_decisor, principal)
SELECT c.id, vals.nome, vals.cargo, vals.departamento, vals.telefone, vals.email, vals.whatsapp, vals.e_decisor, vals.principal
FROM clientes c
CROSS JOIN (VALUES
  ('Marcos Vieira', 'Gerente de Marketing', 'Marketing', '(51) 3218-9810', 'marcos.vieira@saojoao.com.br', '51995005001', TRUE, TRUE),
  ('Carolina Dias', 'Assistente de Compras', 'Compras', '(51) 3218-9820', 'carolina.dias@saojoao.com.br', '51995005002', FALSE, FALSE),
  ('Rafael Medeiros', 'Coordenador de Expansao', 'Expansao', '(51) 3218-9830', 'rafael.medeiros@saojoao.com.br', '51995005003', TRUE, FALSE)
) AS vals(nome, cargo, departamento, telefone, email, whatsapp, e_decisor, principal)
WHERE c.cnpj = '93.209.765/0001-17';

-- Kreatif
INSERT INTO cliente_contatos (cliente_id, nome, cargo, departamento, telefone, email, whatsapp, e_decisor, principal)
SELECT c.id, vals.nome, vals.cargo, vals.departamento, vals.telefone, vals.email, vals.whatsapp, vals.e_decisor, vals.principal
FROM clientes c
CROSS JOIN (VALUES
  ('Bruno Ferreira', 'Diretor de Criacao', 'Criacao', '(51) 3333-4445', 'bruno@kreatif.com.br', '51994006001', TRUE, TRUE),
  ('Camila Rocha', 'Gerente de Projetos', 'Projetos', '(51) 3333-4446', 'camila@kreatif.com.br', '51994006002', FALSE, FALSE),
  ('Diego Pinto', 'Produtor Grafico', 'Producao', '(51) 3333-4447', 'diego@kreatif.com.br', '51994006003', FALSE, FALSE)
) AS vals(nome, cargo, departamento, telefone, email, whatsapp, e_decisor, principal)
WHERE c.cnpj = '12.345.678/0001-90';

-- Visual Print
INSERT INTO cliente_contatos (cliente_id, nome, cargo, departamento, telefone, email, whatsapp, e_decisor, principal)
SELECT c.id, vals.nome, vals.cargo, vals.departamento, vals.telefone, vals.email, vals.whatsapp, vals.e_decisor, vals.principal
FROM clientes c
CROSS JOIN (VALUES
  ('Sergio Motta', 'Proprietario', 'Diretoria', '(51) 3555-6667', 'sergio@visualprint.com.br', '51993007001', TRUE, TRUE),
  ('Aline Barros', 'Atendimento', 'Comercial', '(51) 3555-6668', 'aline@visualprint.com.br', '51993007002', FALSE, FALSE),
  ('Pedro Henrique', 'Designer', 'Criacao', '(51) 3555-6669', 'pedro@visualprint.com.br', '51993007003', FALSE, FALSE)
) AS vals(nome, cargo, departamento, telefone, email, whatsapp, e_decisor, principal)
WHERE c.cnpj = '98.765.432/0001-10';


-- ============================================================
-- 16.7 Produtos e Modelos Demo
-- ============================================================

-- Produto 1: Fachada ACM
INSERT INTO produtos (codigo, nome, categoria, descricao, unidade_padrao) VALUES
  ('FAC-ACM-001', 'Fachada em ACM', 'fachadas', 'Fachada em aluminio composto (ACM) com estrutura metalica', 'm2')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO produto_modelos (produto_id, nome, largura_cm, altura_cm, area_m2, markup_padrao, margem_minima, tempo_producao_min)
SELECT p.id, vals.nome, vals.largura, vals.altura, vals.area, vals.markup, vals.margem, vals.tempo
FROM produtos p
CROSS JOIN (VALUES
  ('ACM Padrao 3x1m', 300.00, 100.00, 3.0000, 45.00, 25.00, 480),
  ('ACM Grande 6x2m', 600.00, 200.00, 12.0000, 40.00, 22.00, 960)
) AS vals(nome, largura, altura, area, markup, margem, tempo)
WHERE p.codigo = 'FAC-ACM-001';

-- Produto 2: Banner Lona
INSERT INTO produtos (codigo, nome, categoria, descricao, unidade_padrao) VALUES
  ('BAN-LON-001', 'Banner em Lona', 'campanhas', 'Banner impresso em lona 440g com acabamento em ilhos', 'm2')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO produto_modelos (produto_id, nome, largura_cm, altura_cm, area_m2, markup_padrao, margem_minima, tempo_producao_min)
SELECT p.id, vals.nome, vals.largura, vals.altura, vals.area, vals.markup, vals.margem, vals.tempo
FROM produtos p
CROSS JOIN (VALUES
  ('Banner 1x0.7m', 100.00, 70.00, 0.7000, 50.00, 25.00, 30),
  ('Banner 3x1.2m', 300.00, 120.00, 3.6000, 45.00, 20.00, 60)
) AS vals(nome, largura, altura, area, markup, margem, tempo)
WHERE p.codigo = 'BAN-LON-001';

-- Produto 3: Adesivo de Vitrine
INSERT INTO produtos (codigo, nome, categoria, descricao, unidade_padrao) VALUES
  ('ADE-VIT-001', 'Adesivo de Vitrine', 'pdv', 'Adesivo vinil impresso para vitrines com laminacao', 'm2')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO produto_modelos (produto_id, nome, largura_cm, altura_cm, area_m2, markup_padrao, margem_minima, tempo_producao_min)
SELECT p.id, vals.nome, vals.largura, vals.altura, vals.area, vals.markup, vals.margem, vals.tempo
FROM produtos p
CROSS JOIN (VALUES
  ('Vitrine Padrao 2x1.5m', 200.00, 150.00, 3.0000, 50.00, 25.00, 120),
  ('Vitrine Grande 4x2.5m', 400.00, 250.00, 10.0000, 42.00, 20.00, 240)
) AS vals(nome, largura, altura, area, markup, margem, tempo)
WHERE p.codigo = 'ADE-VIT-001';

-- Produto 4: Letra Caixa
INSERT INTO produtos (codigo, nome, categoria, descricao, unidade_padrao) VALUES
  ('LET-CX-001', 'Letra Caixa', 'fachadas', 'Letras em alto-relevo em ACM, acrilico ou PVC', 'un')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO produto_modelos (produto_id, nome, largura_cm, altura_cm, area_m2, markup_padrao, margem_minima, preco_fixo, tempo_producao_min)
SELECT p.id, vals.nome, vals.largura, vals.altura, vals.area, vals.markup, vals.margem, vals.preco, vals.tempo
FROM produtos p
CROSS JOIN (VALUES
  ('Letra ACM 30cm', 30.00, 30.00, 0.0900, 55.00, 30.00, 180.00, 90),
  ('Letra Acrilico LED 50cm', 50.00, 50.00, 0.2500, 60.00, 35.00, 350.00, 150)
) AS vals(nome, largura, altura, area, markup, margem, preco, tempo)
WHERE p.codigo = 'LET-CX-001';

-- Produto 5: Totem de Sinalizacao
INSERT INTO produtos (codigo, nome, categoria, descricao, unidade_padrao) VALUES
  ('TOT-SIN-001', 'Totem de Sinalizacao', 'comunicacao_interna', 'Totem de sinalizacao em ACM ou PVC com impressao digital', 'un')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO produto_modelos (produto_id, nome, largura_cm, altura_cm, area_m2, markup_padrao, margem_minima, preco_fixo, tempo_producao_min)
SELECT p.id, vals.nome, vals.largura, vals.altura, vals.area, vals.markup, vals.margem, vals.preco, vals.tempo
FROM produtos p
CROSS JOIN (VALUES
  ('Totem Interno 40x180cm', 40.00, 180.00, 0.7200, 45.00, 20.00, 850.00, 300),
  ('Totem Externo 60x250cm', 60.00, 250.00, 1.5000, 50.00, 25.00, 1500.00, 480)
) AS vals(nome, largura, altura, area, markup, margem, preco, tempo)
WHERE p.codigo = 'TOT-SIN-001';


-- ============================================================
-- 16.8 Materiais Demo
-- ============================================================
INSERT INTO materiais (codigo, nome, categoria, unidade, estoque_minimo, preco_medio) VALUES
  ('MAT-LONA-440', 'Lona Front 440g/m2', 'Impressao', 'm2', 50.000, 12.5000),
  ('MAT-ACM-3MM', 'Chapa ACM 3mm Branco', 'Chapas', 'm2', 20.000, 95.0000),
  ('MAT-VIN-ADH', 'Vinil Adesivo Branco Brilho', 'Impressao', 'm2', 30.000, 18.5000),
  ('MAT-TINTA-SOL', 'Tinta Solvente CMYK (kit)', 'Tinta', 'l', 5.000, 280.0000),
  ('MAT-ILHOS', 'Ilhos Niquelados 10mm', 'Acabamento', 'un', 500.000, 0.1500),
  ('MAT-METALON', 'Metalon 30x30 Galvanizado', 'Estrutura', 'm', 100.000, 22.0000),
  ('MAT-LED-MOD', 'Modulo LED 12V Branco Frio', 'Iluminacao', 'un', 100.000, 3.5000),
  ('MAT-PVC-3MM', 'Chapa PVC Expandido 3mm', 'Chapas', 'm2', 15.000, 45.0000),
  ('MAT-ACR-3MM', 'Chapa Acrilico Cristal 3mm', 'Chapas', 'm2', 10.000, 120.0000),
  ('MAT-FERRAGEM', 'Kit Ferragem Fixacao (parafusos, buchas, cantoneiras)', 'Fixacao', 'kit', 20.000, 35.0000)
ON CONFLICT (codigo) DO NOTHING;

-- Saldos iniciais de estoque
INSERT INTO estoque_saldos (material_id, quantidade_disponivel, quantidade_reservada)
SELECT m.id, vals.disponivel, 0
FROM materiais m
INNER JOIN (VALUES
  ('MAT-LONA-440', 120.000),
  ('MAT-ACM-3MM', 45.000),
  ('MAT-VIN-ADH', 80.000),
  ('MAT-TINTA-SOL', 12.000),
  ('MAT-ILHOS', 2000.000),
  ('MAT-METALON', 200.000),
  ('MAT-LED-MOD', 350.000),
  ('MAT-PVC-3MM', 30.000),
  ('MAT-ACR-3MM', 18.000),
  ('MAT-FERRAGEM', 40.000)
) AS vals(codigo, disponivel) ON m.codigo = vals.codigo
ON CONFLICT (material_id) DO NOTHING;


-- ============================================================
-- 16.9 Fornecedores Demo
-- ============================================================
INSERT INTO fornecedores (razao_social, nome_fantasia, cnpj, telefone, email, contato_nome, categorias, lead_time_dias, condicao_pagamento) VALUES
  ('Flexmídia Industria de Lonas Ltda', 'Flexmidia', '11.222.333/0001-01', '(51) 3500-1000', 'vendas@flexmidia.com.br', 'Ricardo Souza', ARRAY['Impressao', 'Acabamento'], 3, '30/60 dias'),
  ('Acrilex Chapas e Acrilicos S.A.', 'Acrilex', '22.333.444/0001-02', '(11) 4500-2000', 'comercial@acrilex.com.br', 'Ana Paula', ARRAY['Chapas', 'Iluminacao'], 7, '28 dias'),
  ('Metalfer Estruturas Metalicas Ltda', 'Metalfer', '33.444.555/0001-03', '(51) 3600-3000', 'orcamento@metalfer.com.br', 'Joao Carlos', ARRAY['Estrutura', 'Fixacao'], 5, 'A vista / 30 dias'),
  ('Signart Suprimentos para Comunicacao Visual', 'Signart', '44.555.666/0001-04', '(41) 3700-4000', 'sac@signart.com.br', 'Fernanda Costa', ARRAY['Impressao', 'Tinta', 'Acabamento'], 2, '30 dias'),
  ('LED Master Iluminacao Ltda', 'LED Master', '55.666.777/0001-05', '(11) 4800-5000', 'vendas@ledmaster.com.br', 'Paulo Henrique', ARRAY['Iluminacao'], 10, '30/60/90 dias')
ON CONFLICT DO NOTHING;


-- ============================================================
-- 16.10 Config Precificacao (defaults Mubisys)
-- ============================================================
INSERT INTO config_precificacao (
  faturamento_medio, custo_operacional, custo_produtivo,
  qtd_funcionarios, horas_mes,
  percentual_comissao, percentual_impostos, percentual_juros
) VALUES (
  110000.00, 36800.00, 23744.00,
  6, 176,
  5.00, 12.00, 2.00
);


-- ============================================================
-- 16.11 Plano de Contas
-- ============================================================
INSERT INTO plano_contas (codigo, nome, tipo, grupo) VALUES
  -- Receitas
  ('1.1.01', 'Vendas de Produtos', 'receita', 'Receita Operacional'),
  ('1.1.02', 'Servicos de Instalacao', 'receita', 'Receita Operacional'),
  ('1.1.03', 'Servicos de Projeto', 'receita', 'Receita Operacional'),
  ('1.2.01', 'Receitas Financeiras', 'receita', 'Receita Nao-Operacional'),
  -- Custos
  ('2.1.01', 'Materia-Prima', 'custo', 'Custo de Producao'),
  ('2.1.02', 'Mao-de-Obra Direta', 'custo', 'Custo de Producao'),
  ('2.1.03', 'Energia e Utilidades (Producao)', 'custo', 'Custo de Producao'),
  ('2.1.04', 'Manutencao de Equipamentos', 'custo', 'Custo de Producao'),
  ('2.2.01', 'Frete e Logistica', 'custo', 'Custo de Instalacao'),
  ('2.2.02', 'Mao-de-Obra Instalacao', 'custo', 'Custo de Instalacao'),
  -- Despesas
  ('3.1.01', 'Salarios e Encargos (Adm)', 'despesa', 'Despesas Administrativas'),
  ('3.1.02', 'Aluguel e Condominio', 'despesa', 'Despesas Administrativas'),
  ('3.1.03', 'Agua, Luz, Telefone', 'despesa', 'Despesas Administrativas'),
  ('3.1.04', 'Material de Escritorio', 'despesa', 'Despesas Administrativas'),
  ('3.1.05', 'Contabilidade e Juridico', 'despesa', 'Despesas Administrativas'),
  ('3.2.01', 'Comissoes de Vendas', 'despesa', 'Despesas Comerciais'),
  ('3.2.02', 'Marketing e Publicidade', 'despesa', 'Despesas Comerciais'),
  ('3.2.03', 'Viagens e Representacao', 'despesa', 'Despesas Comerciais'),
  ('3.3.01', 'Impostos sobre Vendas', 'despesa', 'Despesas Tributarias'),
  ('3.3.02', 'Taxas e Contribuicoes', 'despesa', 'Despesas Tributarias'),
  ('3.4.01', 'Juros e Encargos Financeiros', 'despesa', 'Despesas Financeiras'),
  ('3.4.02', 'Tarifas Bancarias', 'despesa', 'Despesas Financeiras')
ON CONFLICT (codigo) DO NOTHING;


-- ============================================================
-- 16.12 Centros de Custo
-- ============================================================
INSERT INTO centros_custo (codigo, nome) VALUES
  ('CC-COM', 'Comercial'),
  ('CC-PRD', 'Producao'),
  ('CC-INS', 'Instalacao'),
  ('CC-ADM', 'Administrativo'),
  ('CC-CPR', 'Compras')
ON CONFLICT (codigo) DO NOTHING;


-- ============================================================
-- 16.13 Equipes de Instalacao Demo
-- ============================================================
INSERT INTO equipes (nome, regiao, veiculo_placa, veiculo_tipo, ativo) VALUES
  ('Equipe Alpha', 'Porto Alegre e Regiao Metropolitana', 'IYZ-3B45', 'Fiorino', TRUE),
  ('Equipe Beta', 'Serra Gaucha', 'JKL-4C56', 'Sprinter', TRUE),
  ('Equipe Gamma', 'Litoral e Vale dos Sinos', 'MNO-5D67', 'HR Hyundai', TRUE);


-- ============================================================
-- FIM DO SCHEMA
-- ============================================================
-- Para executar: Copie e cole no Supabase SQL Editor
-- ou execute via CLI: supabase db push
-- ============================================================
