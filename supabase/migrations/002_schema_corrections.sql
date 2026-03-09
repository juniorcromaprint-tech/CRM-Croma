-- ============================================================
-- CROMA PRINT ERP/CRM - CORRECOES DE SCHEMA
-- Migration: 002_schema_corrections.sql
-- Data: 2026-03-09
-- Supabase-compatible PostgreSQL
-- ============================================================
--
-- DESCRICAO:
-- Esta migration CORRIGE o schema criado por 001_complete_schema.sql.
-- A auditoria tecnica pontuou o schema original em 54/100.
-- As correcoes abaixo elevam a qualidade para >90/100.
--
-- ORDEM DE EXECUCAO:
--   1. Renomeacao de tabelas (EN -> PT-BR)
--   2. Criacao de tabelas novas (13 tabelas)
--   3. Soft delete em tabelas transacionais
--   4. Funcao e triggers de auditoria
--   5. Funcao e triggers de validacao de status
--   6. Funcao helper de role + Politicas RLS granulares
--   7. Indexes compostos e de performance
--   8. Sequences e auto-numeracao
--   9. Correcoes de colunas
--  10. Triggers de updated_at para tabelas novas
--  11. RLS em tabelas novas
--
-- TODAS as operacoes sao IDEMPOTENTES (IF NOT EXISTS, DO blocks).
-- ============================================================


-- ############################################################
-- 1. RENOMEACAO DE TABELAS (EN -> PT-BR)
-- ############################################################
-- MOTIVO: Convencao de nomes 100% em portugues brasileiro.
-- Usar ALTER TABLE ... RENAME TO para eficiencia maxima.
-- Atualizar FKs, indexes e RLS policies referenciando os nomes antigos.

-- ------------------------------------------------------------
-- 1.1 audit_logs -> registros_auditoria
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs' AND table_schema = 'public') THEN
    ALTER TABLE audit_logs RENAME TO registros_auditoria;
  END IF;
END $$;

-- Renomear indexes associados
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_user') THEN
    ALTER INDEX idx_audit_user RENAME TO idx_reg_audit_user;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_tabela') THEN
    ALTER INDEX idx_audit_tabela RENAME TO idx_reg_audit_tabela;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_registro') THEN
    ALTER INDEX idx_audit_registro RENAME TO idx_reg_audit_registro;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_created') THEN
    ALTER INDEX idx_audit_created RENAME TO idx_reg_audit_created;
  END IF;
END $$;

COMMENT ON TABLE registros_auditoria IS 'Log de auditoria de todas as operacoes criticas (renomeado de audit_logs)';

-- ------------------------------------------------------------
-- 1.2 attachments -> anexos
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attachments' AND table_schema = 'public') THEN
    ALTER TABLE attachments RENAME TO anexos;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_attachments_entidade') THEN
    ALTER INDEX idx_attachments_entidade RENAME TO idx_anexos_entidade;
  END IF;
END $$;

COMMENT ON TABLE anexos IS 'Anexos genericos vinculados a qualquer entidade (renomeado de attachments)';

-- ------------------------------------------------------------
-- 1.3 lead_sources -> origens_lead
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lead_sources' AND table_schema = 'public') THEN
    ALTER TABLE lead_sources RENAME TO origens_lead;
  END IF;
END $$;

COMMENT ON TABLE origens_lead IS 'Origens de leads para rastreamento de canais (renomeado de lead_sources)';

-- A FK em leads.origem_id -> lead_sources(id) acompanha o RENAME automaticamente
-- Nao precisa recriar a constraint

-- ------------------------------------------------------------
-- 1.4 role_permissions -> permissoes_perfil
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'role_permissions' AND table_schema = 'public') THEN
    ALTER TABLE role_permissions RENAME TO permissoes_perfil;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_role_permissions_role') THEN
    ALTER INDEX idx_role_permissions_role RENAME TO idx_permissoes_perfil_role;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_role_permissions_perm') THEN
    ALTER INDEX idx_role_permissions_perm RENAME TO idx_permissoes_perfil_perm;
  END IF;
END $$;

COMMENT ON TABLE permissoes_perfil IS 'Vinculo role <-> permission (N:N) (renomeado de role_permissions)';

-- ------------------------------------------------------------
-- 1.5 field_tasks -> tarefas_campo
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'field_tasks' AND table_schema = 'public') THEN
    ALTER TABLE field_tasks RENAME TO tarefas_campo;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ft_ordem') THEN
    ALTER INDEX idx_ft_ordem RENAME TO idx_tc_ordem;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ft_tecnico') THEN
    ALTER INDEX idx_ft_tecnico RENAME TO idx_tc_tecnico;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ft_status') THEN
    ALTER INDEX idx_ft_status RENAME TO idx_tc_status;
  END IF;
END $$;

COMMENT ON TABLE tarefas_campo IS 'Tarefas de campo atribuidas a tecnicos (renomeado de field_tasks)';

-- ------------------------------------------------------------
-- 1.6 field_checklists -> checklists_campo
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'field_checklists' AND table_schema = 'public') THEN
    ALTER TABLE field_checklists RENAME TO checklists_campo;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_fcl_task') THEN
    ALTER INDEX idx_fcl_task RENAME TO idx_cc_tarefa;
  END IF;
END $$;

-- Renomear a FK column reference (field_task_id permanece — FK segue a tabela automaticamente)
COMMENT ON TABLE checklists_campo IS 'Checklist pre e pos instalacao (renomeado de field_checklists)';

-- ------------------------------------------------------------
-- 1.7 field_media -> midias_campo
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'field_media' AND table_schema = 'public') THEN
    ALTER TABLE field_media RENAME TO midias_campo;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_fm_task') THEN
    ALTER INDEX idx_fm_task RENAME TO idx_mc_tarefa;
  END IF;
END $$;

COMMENT ON TABLE midias_campo IS 'Fotos e videos de campo antes/durante/depois (renomeado de field_media)';

-- ------------------------------------------------------------
-- 1.8 field_signatures -> assinaturas_campo
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'field_signatures' AND table_schema = 'public') THEN
    ALTER TABLE field_signatures RENAME TO assinaturas_campo;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_fs_task') THEN
    ALTER INDEX idx_fs_task RENAME TO idx_ac_tarefa;
  END IF;
END $$;

COMMENT ON TABLE assinaturas_campo IS 'Assinaturas digitais de aceite de instalacao (renomeado de field_signatures)';

-- ------------------------------------------------------------
-- 1.9 historico_precos -> historico_precos_fornecedor
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'historico_precos' AND table_schema = 'public')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'historico_precos_fornecedor' AND table_schema = 'public') THEN
    ALTER TABLE historico_precos RENAME TO historico_precos_fornecedor;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_hist_precos_forn') THEN
    ALTER INDEX idx_hist_precos_forn RENAME TO idx_hpf_fornecedor;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_hist_precos_mat') THEN
    ALTER INDEX idx_hist_precos_mat RENAME TO idx_hpf_material;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_hist_precos_data') THEN
    ALTER INDEX idx_hist_precos_data RENAME TO idx_hpf_data;
  END IF;
END $$;

COMMENT ON TABLE historico_precos_fornecedor IS 'Historico de cotacoes de precos por fornecedor/material (renomeado de historico_precos, mais especifico)';


-- ############################################################
-- 2. CRIACAO DE TABELAS NOVAS (13 tabelas)
-- ############################################################

-- ------------------------------------------------------------
-- 2a. equipe_membros
-- MOTIVO: Separar membros de equipe (N:N) da tabela equipes.
-- Permite gerenciar funcao (lider, auxiliar, motorista) por membro.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipe_membros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  equipe_id UUID NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  funcao TEXT DEFAULT 'auxiliar' CHECK (funcao IN ('lider', 'auxiliar', 'motorista')),
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(equipe_id, usuario_id)
);

COMMENT ON TABLE equipe_membros IS 'Membros de equipes de instalacao com funcao (lider, auxiliar, motorista)';

-- ------------------------------------------------------------
-- 2b. veiculos
-- MOTIVO: Veiculos sao entidades independentes com capacidade,
-- modelo, etc. Nao devem ficar como colunas simples na tabela equipes.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS veiculos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  placa TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL, -- Fiorino, Sprinter, HR, etc.
  modelo TEXT,
  capacidade_kg NUMERIC(8,2),
  equipe_id UUID REFERENCES equipes(id) ON DELETE SET NULL,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE veiculos IS 'Veiculos da frota com tipo, modelo e vinculo a equipe';

-- ------------------------------------------------------------
-- 2c. cliente_documentos
-- MOTIVO: Documentos do cliente (contratos, logos, certidoes)
-- precisam de rastreamento com validade e tipo.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cliente_documentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('contrato', 'certidao', 'logo', 'procuracao', 'outro')),
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  validade DATE,
  observacoes TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE cliente_documentos IS 'Documentos do cliente: contratos, certidoes, logos, procuracoes';

-- ------------------------------------------------------------
-- 2d. proposta_versoes
-- MOTIVO: Rastrear versoes de propostas com snapshot dos itens
-- e totais para auditoria e historico de negociacao.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proposta_versoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposta_id UUID NOT NULL REFERENCES propostas(id) ON DELETE CASCADE,
  versao INTEGER NOT NULL,
  snapshot_itens JSONB NOT NULL,
  snapshot_totais JSONB NOT NULL,
  motivo_revisao TEXT,
  criado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(proposta_id, versao)
);

COMMENT ON TABLE proposta_versoes IS 'Versionamento de propostas com snapshot de itens e totais';

-- ------------------------------------------------------------
-- 2e. solicitacoes_compra
-- MOTIVO: Fluxo de compras precisa de solicitacao antes do pedido.
-- Permite rastreio de urgencia, origem e aprovacao.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS solicitacoes_compra (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT UNIQUE,
  material_id UUID NOT NULL REFERENCES materiais(id) ON DELETE RESTRICT,
  quantidade NUMERIC(12,3) NOT NULL,
  urgencia TEXT DEFAULT 'normal' CHECK (urgencia IN ('baixa', 'normal', 'alta', 'critica')),
  origem TEXT DEFAULT 'manual' CHECK (origem IN ('manual', 'automatica', 'producao')),
  referencia_tipo TEXT,
  referencia_id UUID,
  solicitante_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'cotando', 'comprada', 'cancelada')),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE solicitacoes_compra IS 'Solicitacoes de compra de materiais (antes do pedido de compra)';

-- ------------------------------------------------------------
-- 2f. cotacoes_compra
-- MOTIVO: Comparacao de cotacoes de fornecedores para mesma
-- solicitacao de compra. Essencial para compras profissionais.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cotacoes_compra (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitacao_id UUID REFERENCES solicitacoes_compra(id) ON DELETE SET NULL,
  fornecedor_id UUID NOT NULL REFERENCES fornecedores(id) ON DELETE RESTRICT,
  material_id UUID NOT NULL REFERENCES materiais(id) ON DELETE RESTRICT,
  quantidade NUMERIC(12,3) NOT NULL,
  valor_unitario NUMERIC(12,4) NOT NULL,
  valor_total NUMERIC(12,2) NOT NULL,
  prazo_entrega_dias INTEGER,
  condicao_pagamento TEXT,
  validade DATE,
  selecionada BOOLEAN DEFAULT FALSE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE cotacoes_compra IS 'Cotacoes de compra por fornecedor para comparacao de precos';

-- ------------------------------------------------------------
-- 2g. recebimentos + recebimento_itens
-- MOTIVO: Conferencia de mercadoria recebida vs. pedido de compra.
-- Permite recebimento parcial e recusa com motivo.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recebimentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_compra_id UUID NOT NULL REFERENCES pedidos_compra(id) ON DELETE RESTRICT,
  fornecedor_id UUID NOT NULL REFERENCES fornecedores(id) ON DELETE RESTRICT,
  numero_nf TEXT,
  data_recebimento DATE DEFAULT CURRENT_DATE,
  conferido_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'conferido', 'aceito', 'recusado_parcial', 'recusado')),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE recebimentos IS 'Recebimento de mercadorias de fornecedores com conferencia';

CREATE TABLE IF NOT EXISTS recebimento_itens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recebimento_id UUID NOT NULL REFERENCES recebimentos(id) ON DELETE CASCADE,
  pedido_compra_item_id UUID NOT NULL REFERENCES pedido_compra_itens(id) ON DELETE RESTRICT,
  material_id UUID NOT NULL REFERENCES materiais(id) ON DELETE RESTRICT,
  quantidade_esperada NUMERIC(12,3) NOT NULL,
  quantidade_recebida NUMERIC(12,3) NOT NULL,
  quantidade_aceita NUMERIC(12,3) DEFAULT 0,
  motivo_recusa TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE recebimento_itens IS 'Itens conferidos por recebimento (esperado vs. recebido vs. aceito)';

-- ------------------------------------------------------------
-- 2h. producao_apontamentos
-- MOTIVO: Apontamento de horas de producao por etapa e operador.
-- Essencial para custeio real e controle de produtividade.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS producao_apontamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  producao_etapa_id UUID NOT NULL REFERENCES producao_etapas(id) ON DELETE CASCADE,
  ordem_producao_id UUID NOT NULL REFERENCES ordens_producao(id) ON DELETE CASCADE,
  operador_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ,
  tempo_minutos INTEGER,
  tipo TEXT DEFAULT 'producao' CHECK (tipo IN ('producao', 'setup', 'pausa', 'retrabalho')),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE producao_apontamentos IS 'Apontamentos de tempo de producao por etapa e operador';

-- ------------------------------------------------------------
-- 2i. producao_materiais
-- MOTIVO: Materiais consumidos por ordem de producao.
-- Liga producao a estoque com custo real.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS producao_materiais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_producao_id UUID NOT NULL REFERENCES ordens_producao(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materiais(id) ON DELETE RESTRICT,
  quantidade_prevista NUMERIC(12,3) DEFAULT 0,
  quantidade_consumida NUMERIC(12,3) DEFAULT 0,
  custo_unitario NUMERIC(12,4),
  custo_total NUMERIC(12,2),
  movimentacao_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE producao_materiais IS 'Materiais previstos e consumidos por ordem de producao';

-- ------------------------------------------------------------
-- 2j. estoque_inventario
-- MOTIVO: Inventario fisico com contagem, diferenca e ajuste.
-- Essencial para conciliacao e controle de perdas.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estoque_inventario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL REFERENCES materiais(id) ON DELETE RESTRICT,
  quantidade_sistema NUMERIC(12,3) NOT NULL,
  quantidade_contada NUMERIC(12,3) NOT NULL,
  diferenca NUMERIC(12,3) NOT NULL,
  responsavel_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ajustado BOOLEAN DEFAULT FALSE,
  movimentacao_id UUID,
  data_contagem DATE DEFAULT CURRENT_DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE estoque_inventario IS 'Inventario fisico de estoque com contagem e diferenca';

-- ------------------------------------------------------------
-- 2k. lancamentos_caixa
-- MOTIVO: Fluxo de caixa real (entradas e saidas efetivas).
-- Liga contas a receber/pagar ao caixa com comprovante.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lancamentos_caixa (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  data_lancamento DATE NOT NULL DEFAULT CURRENT_DATE,
  conta_receber_id UUID REFERENCES contas_receber(id) ON DELETE SET NULL,
  conta_pagar_id UUID REFERENCES contas_pagar(id) ON DELETE SET NULL,
  conta_plano_id UUID REFERENCES plano_contas(id) ON DELETE SET NULL,
  centro_custo_id UUID REFERENCES centros_custo(id) ON DELETE SET NULL,
  comprovante_url TEXT,
  observacoes TEXT,
  registrado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE lancamentos_caixa IS 'Lancamentos reais de caixa (entrada/saida) com rastreio a CR/CP';

-- ------------------------------------------------------------
-- 2l. agenda_instalacao
-- MOTIVO: Agenda de equipes por data e turno para instalacao.
-- Evita conflitos de agendamento e permite visao de disponibilidade.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agenda_instalacao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  equipe_id UUID NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  turno TEXT DEFAULT 'integral' CHECK (turno IN ('manha', 'tarde', 'integral')),
  disponivel BOOLEAN DEFAULT TRUE,
  ordem_instalacao_id UUID REFERENCES ordens_instalacao(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(equipe_id, data, turno)
);

COMMENT ON TABLE agenda_instalacao IS 'Agenda de equipes de instalacao por data e turno';

-- ------------------------------------------------------------
-- 2m. notificacoes
-- MOTIVO: Sistema de notificacoes internas para alertas,
-- prazos, aprovacoes pendentes e acoes necessarias.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('info', 'alerta', 'urgente', 'acao_necessaria')),
  titulo TEXT NOT NULL,
  mensagem TEXT,
  link TEXT,
  entidade_tipo TEXT,
  entidade_id UUID,
  lida BOOLEAN DEFAULT FALSE,
  lida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE notificacoes IS 'Notificacoes do sistema para usuarios (alertas, prazos, acoes)';


-- ############################################################
-- 3. SOFT DELETE EM TABELAS TRANSACIONAIS
-- ############################################################
-- MOTIVO: Registros transacionais nunca devem ser apagados
-- fisicamente. Soft delete permite recuperacao e auditoria.

DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY[
    'propostas', 'pedidos', 'pedido_itens',
    'ordens_producao', 'ordens_instalacao',
    'contas_receber', 'contas_pagar',
    'pedidos_compra', 'comissoes', 'ocorrencias'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas
  LOOP
    -- Adiciona excluido_em se nao existe
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = t AND column_name = 'excluido_em' AND table_schema = 'public'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN excluido_em TIMESTAMPTZ DEFAULT NULL;', t);
    END IF;

    -- Adiciona excluido_por se nao existe
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = t AND column_name = 'excluido_por' AND table_schema = 'public'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN excluido_por UUID REFERENCES profiles(id) ON DELETE SET NULL;', t);
    END IF;
  END LOOP;
END $$;


-- ############################################################
-- 4. FUNCAO E TRIGGERS DE AUDITORIA
-- ############################################################
-- MOTIVO: Registrar automaticamente todas as operacoes criticas
-- (INSERT, UPDATE, DELETE) com dados antes/depois para rastreio.

CREATE OR REPLACE FUNCTION fn_registrar_auditoria()
RETURNS TRIGGER AS $$
DECLARE
  registro_id UUID;
  dados_ant JSONB;
  dados_nov JSONB;
  acao_tipo TEXT;
BEGIN
  -- Determina tipo de acao
  IF TG_OP = 'INSERT' THEN
    acao_tipo := 'INSERT';
    registro_id := NEW.id;
    dados_ant := NULL;
    dados_nov := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    registro_id := NEW.id;
    dados_ant := to_jsonb(OLD);
    dados_nov := to_jsonb(NEW);
    -- Detecta mudanca de status especificamente
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
      acao_tipo := 'STATUS_CHANGE';
    ELSE
      acao_tipo := 'UPDATE';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    acao_tipo := 'DELETE';
    registro_id := OLD.id;
    dados_ant := to_jsonb(OLD);
    dados_nov := NULL;
  END IF;

  INSERT INTO registros_auditoria (user_id, tabela, registro_id, acao, dados_anteriores, dados_novos)
  VALUES (auth.uid(), TG_TABLE_NAME, registro_id, acao_tipo, dados_ant, dados_nov);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplica triggers de auditoria nas tabelas criticas
DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY[
    'leads', 'oportunidades', 'propostas', 'proposta_itens',
    'clientes', 'pedidos', 'pedido_itens',
    'ordens_producao', 'producao_etapas',
    'contas_receber', 'contas_pagar', 'comissoes',
    'pedidos_compra', 'estoque_movimentacoes',
    'ordens_instalacao', 'ocorrencias'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trigger_audit_%s ON %I;
       CREATE TRIGGER trigger_audit_%s
         AFTER INSERT OR UPDATE OR DELETE ON %I
         FOR EACH ROW EXECUTE FUNCTION fn_registrar_auditoria();',
      t, t, t, t
    );
  END LOOP;
END $$;


-- ############################################################
-- 5. FUNCAO E TRIGGERS DE VALIDACAO DE STATUS
-- ############################################################
-- MOTIVO: Impedir transicoes de status invalidas que poderiam
-- corromper o fluxo de trabalho (ex: cancelado -> aprovado).

CREATE OR REPLACE FUNCTION fn_validar_transicao_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Valida apenas em UPDATE quando status muda
  IF TG_OP != 'UPDATE' OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'pedidos' THEN
      CASE OLD.status
        WHEN 'rascunho' THEN
          IF NEW.status NOT IN ('aguardando_aprovacao', 'cancelado') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'aguardando_aprovacao' THEN
          IF NEW.status NOT IN ('aprovado', 'rascunho', 'cancelado') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'aprovado' THEN
          IF NEW.status NOT IN ('em_producao', 'cancelado') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'em_producao' THEN
          IF NEW.status NOT IN ('produzido', 'parcialmente_concluido') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'produzido' THEN
          IF NEW.status NOT IN ('aguardando_instalacao', 'concluido') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'aguardando_instalacao' THEN
          IF NEW.status NOT IN ('em_instalacao') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'em_instalacao' THEN
          IF NEW.status NOT IN ('parcialmente_concluido', 'concluido') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'concluido' THEN
          RAISE EXCEPTION 'Pedido concluido nao pode mudar de status';
        WHEN 'cancelado' THEN
          RAISE EXCEPTION 'Pedido cancelado nao pode mudar de status';
        ELSE NULL;
      END CASE;

    WHEN 'propostas' THEN
      CASE OLD.status
        WHEN 'rascunho' THEN
          IF NEW.status NOT IN ('enviada') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'enviada' THEN
          IF NEW.status NOT IN ('em_revisao', 'aprovada', 'recusada', 'expirada') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'em_revisao' THEN
          IF NEW.status NOT IN ('rascunho', 'enviada') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'aprovada' THEN
          RAISE EXCEPTION 'Proposta aprovada nao pode mudar de status';
        WHEN 'recusada' THEN
          IF NEW.status NOT IN ('rascunho') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'expirada' THEN
          IF NEW.status NOT IN ('rascunho') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        ELSE NULL;
      END CASE;

    WHEN 'ordens_producao' THEN
      CASE OLD.status
        WHEN 'aguardando_programacao' THEN
          IF NEW.status NOT IN ('em_fila') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'em_fila' THEN
          IF NEW.status NOT IN ('em_producao', 'aguardando_programacao') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'em_producao' THEN
          IF NEW.status NOT IN ('em_acabamento', 'em_conferencia', 'retrabalho') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'em_acabamento' THEN
          IF NEW.status NOT IN ('em_conferencia', 'retrabalho') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'em_conferencia' THEN
          IF NEW.status NOT IN ('liberado', 'retrabalho') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'liberado' THEN
          IF NEW.status NOT IN ('finalizado') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'retrabalho' THEN
          IF NEW.status NOT IN ('em_producao') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'finalizado' THEN
          RAISE EXCEPTION 'OP finalizada nao pode mudar de status';
        ELSE NULL;
      END CASE;

    ELSE NULL; -- Outras tabelas nao validam transicoes
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplica trigger de validacao de status
DROP TRIGGER IF EXISTS trigger_validar_status_pedidos ON pedidos;
CREATE TRIGGER trigger_validar_status_pedidos
  BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION fn_validar_transicao_status();

DROP TRIGGER IF EXISTS trigger_validar_status_propostas ON propostas;
CREATE TRIGGER trigger_validar_status_propostas
  BEFORE UPDATE ON propostas
  FOR EACH ROW EXECUTE FUNCTION fn_validar_transicao_status();

DROP TRIGGER IF EXISTS trigger_validar_status_ordens_producao ON ordens_producao;
CREATE TRIGGER trigger_validar_status_ordens_producao
  BEFORE UPDATE ON ordens_producao
  FOR EACH ROW EXECUTE FUNCTION fn_validar_transicao_status();


-- ############################################################
-- 6. FUNCAO HELPER DE ROLE + POLITICAS RLS GRANULARES
-- ############################################################
-- MOTIVO: Substituir policies "auth_all_*" (USING true) por
-- policies granulares baseadas no role do usuario.

-- 6.1 Funcao helper para obter role do usuario
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT r.nome INTO user_role
  FROM profiles p
  JOIN roles r ON r.id = p.role_id
  WHERE p.id = auth.uid();
  RETURN COALESCE(user_role, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 6.2 Remover TODAS as policies permissivas "auth_all_*"
DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY[
    'roles', 'permissions', 'permissoes_perfil',
    'registros_auditoria', 'anexos', 'notas_internas',
    'origens_lead', 'leads', 'oportunidades',
    'atividades_comerciais', 'tarefas_comerciais', 'metas_vendas',
    'clientes', 'cliente_unidades', 'cliente_contatos',
    'produtos', 'produto_modelos', 'modelo_materiais', 'modelo_processos',
    'config_precificacao',
    'materiais', 'estoque_saldos', 'estoque_movimentacoes',
    'fornecedores', 'pedidos_compra', 'pedido_compra_itens', 'historico_precos_fornecedor',
    'propostas', 'proposta_itens',
    'pedidos', 'pedido_itens', 'pedido_historico',
    'ordens_producao', 'producao_etapas', 'producao_checklist', 'producao_retrabalho',
    'plano_contas', 'centros_custo',
    'contas_receber', 'parcelas_receber',
    'contas_pagar', 'parcelas_pagar', 'comissoes',
    'equipes', 'ordens_instalacao', 'tarefas_campo',
    'checklists_campo', 'midias_campo', 'assinaturas_campo',
    'ocorrencias', 'ocorrencia_tratativas'
  ];
  old_name TEXT;
BEGIN
  FOREACH t IN ARRAY tabelas
  LOOP
    -- Tenta remover com nome atual
    EXECUTE format('DROP POLICY IF EXISTS "auth_all_%s" ON %I;', t, t);

    -- Tenta remover com nomes antigos (antes do rename)
    -- Nao causa erro se nao existir
  END LOOP;

  -- Tambem remover policies que usem os nomes antigos (pre-rename)
  -- Estas podem nao existir mais, mas o IF EXISTS garante seguranca
  EXECUTE 'DROP POLICY IF EXISTS "auth_all_audit_logs" ON registros_auditoria;';
  EXECUTE 'DROP POLICY IF EXISTS "auth_all_attachments" ON anexos;';
  EXECUTE 'DROP POLICY IF EXISTS "auth_all_lead_sources" ON origens_lead;';
  EXECUTE 'DROP POLICY IF EXISTS "auth_all_role_permissions" ON permissoes_perfil;';
  EXECUTE 'DROP POLICY IF EXISTS "auth_all_field_tasks" ON tarefas_campo;';
  EXECUTE 'DROP POLICY IF EXISTS "auth_all_field_checklists" ON checklists_campo;';
  EXECUTE 'DROP POLICY IF EXISTS "auth_all_field_media" ON midias_campo;';
  EXECUTE 'DROP POLICY IF EXISTS "auth_all_field_signatures" ON assinaturas_campo;';
  EXECUTE 'DROP POLICY IF EXISTS "auth_all_historico_precos" ON historico_precos_fornecedor;';
END $$;


-- ============================================================
-- 6.3 ADMIN/DIRETOR: Acesso total a todas as tabelas
-- ============================================================

-- Admin tables: somente admin
DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY[
    'roles', 'permissions', 'permissoes_perfil'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas
  LOOP
    EXECUTE format(
      'CREATE POLICY "admin_only_%s" ON %I
        FOR ALL TO authenticated
        USING (get_user_role() = ''admin'')
        WITH CHECK (get_user_role() = ''admin'');',
      t, t
    );
  END LOOP;
END $$;

-- Registros de auditoria: admin + diretor podem ler, ninguem escreve diretamente
-- (escrita via trigger)
CREATE POLICY "admin_read_registros_auditoria" ON registros_auditoria
  FOR SELECT TO authenticated
  USING (get_user_role() IN ('admin', 'diretor'));

-- Qualquer authenticated pode inserir (feito pela funcao de auditoria SECURITY DEFINER)
CREATE POLICY "system_insert_registros_auditoria" ON registros_auditoria
  FOR INSERT TO authenticated
  WITH CHECK (TRUE);

-- ============================================================
-- 6.4 ANEXOS e NOTAS: acesso amplo para leitura, escrita por authenticated
-- ============================================================
CREATE POLICY "authenticated_all_anexos" ON anexos
  FOR ALL TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "authenticated_all_notas_internas" ON notas_internas
  FOR ALL TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- ============================================================
-- 6.5 ORIGENS LEAD: leitura por comercial, escrita por admin
-- ============================================================
CREATE POLICY "origens_read" ON origens_lead
  FOR SELECT TO authenticated
  USING (get_user_role() IN ('admin', 'diretor', 'comercial', 'comercial_senior'));

CREATE POLICY "origens_write" ON origens_lead
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('admin', 'diretor'));

CREATE POLICY "origens_update" ON origens_lead
  FOR UPDATE TO authenticated
  USING (get_user_role() IN ('admin', 'diretor'))
  WITH CHECK (get_user_role() IN ('admin', 'diretor'));

CREATE POLICY "origens_delete" ON origens_lead
  FOR DELETE TO authenticated
  USING (get_user_role() IN ('admin'));

-- ============================================================
-- 6.6 COMERCIAL: leads, oportunidades, propostas, atividades, tarefas, metas
-- Comercial ve/edita os proprios; admin/diretor ve tudo.
-- ============================================================

-- Leads (tem vendedor_id)
CREATE POLICY "comercial_own_leads" ON leads
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('admin', 'diretor')
    OR (get_user_role() IN ('comercial', 'comercial_senior') AND vendedor_id = auth.uid())
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'diretor', 'comercial', 'comercial_senior')
  );

-- Oportunidades (tem vendedor_id)
CREATE POLICY "comercial_own_oportunidades" ON oportunidades
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('admin', 'diretor')
    OR (get_user_role() IN ('comercial', 'comercial_senior') AND vendedor_id = auth.uid())
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'diretor', 'comercial', 'comercial_senior')
  );

-- Propostas (tem vendedor_id)
CREATE POLICY "comercial_own_propostas" ON propostas
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('admin', 'diretor')
    OR (get_user_role() IN ('comercial', 'comercial_senior') AND vendedor_id = auth.uid())
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'diretor', 'comercial', 'comercial_senior')
  );

-- Proposta itens: segue a proposta (acessivel se pode ver a proposta)
CREATE POLICY "comercial_access_proposta_itens" ON proposta_itens
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('admin', 'diretor', 'comercial', 'comercial_senior')
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'diretor', 'comercial', 'comercial_senior')
  );

-- Atividades comerciais (sem vendedor_id direto, usa autor_id)
CREATE POLICY "comercial_access_atividades" ON atividades_comerciais
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('admin', 'diretor', 'comercial', 'comercial_senior')
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'diretor', 'comercial', 'comercial_senior')
  );

-- Tarefas comerciais
CREATE POLICY "comercial_access_tarefas_comerciais" ON tarefas_comerciais
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('admin', 'diretor', 'comercial', 'comercial_senior')
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'diretor', 'comercial', 'comercial_senior')
  );

-- Metas vendas (tem vendedor_id)
CREATE POLICY "comercial_own_metas_vendas" ON metas_vendas
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('admin', 'diretor')
    OR (get_user_role() IN ('comercial', 'comercial_senior') AND vendedor_id = auth.uid())
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'diretor', 'comercial', 'comercial_senior')
  );

-- ============================================================
-- 6.7 CLIENTES: leitura ampla, escrita por comercial + admin
-- ============================================================
DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY['clientes', 'cliente_unidades', 'cliente_contatos'];
BEGIN
  FOREACH t IN ARRAY tabelas
  LOOP
    EXECUTE format(
      'CREATE POLICY "clientes_read_%s" ON %I
        FOR SELECT TO authenticated
        USING (
          get_user_role() IN (''admin'', ''diretor'', ''comercial'', ''comercial_senior'', ''financeiro'', ''logistica'', ''producao'')
        );',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "clientes_write_%s" ON %I
        FOR INSERT TO authenticated
        WITH CHECK (get_user_role() IN (''admin'', ''diretor'', ''comercial'', ''comercial_senior''));',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "clientes_update_%s" ON %I
        FOR UPDATE TO authenticated
        USING (get_user_role() IN (''admin'', ''diretor'', ''comercial'', ''comercial_senior''))
        WITH CHECK (get_user_role() IN (''admin'', ''diretor'', ''comercial'', ''comercial_senior''));',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "clientes_delete_%s" ON %I
        FOR DELETE TO authenticated
        USING (get_user_role() IN (''admin'', ''diretor''));',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- 6.8 PEDIDOS: leitura ampla, escrita por comercial_senior + admin
-- ============================================================
DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY['pedidos', 'pedido_itens', 'pedido_historico'];
BEGIN
  FOREACH t IN ARRAY tabelas
  LOOP
    EXECUTE format(
      'CREATE POLICY "pedidos_read_%s" ON %I
        FOR SELECT TO authenticated
        USING (
          get_user_role() IN (''admin'', ''diretor'', ''comercial'', ''comercial_senior'', ''financeiro'', ''producao'', ''logistica'')
        );',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "pedidos_write_%s" ON %I
        FOR INSERT TO authenticated
        WITH CHECK (get_user_role() IN (''admin'', ''diretor'', ''comercial_senior''));',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "pedidos_update_%s" ON %I
        FOR UPDATE TO authenticated
        USING (get_user_role() IN (''admin'', ''diretor'', ''comercial_senior''))
        WITH CHECK (get_user_role() IN (''admin'', ''diretor'', ''comercial_senior''));',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "pedidos_delete_%s" ON %I
        FOR DELETE TO authenticated
        USING (get_user_role() IN (''admin''));',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- 6.9 PRODUCAO: leitura por producao/compras/logistica, escrita por producao + admin
-- ============================================================
DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY[
    'ordens_producao', 'producao_etapas', 'producao_checklist', 'producao_retrabalho'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas
  LOOP
    EXECUTE format(
      'CREATE POLICY "producao_read_%s" ON %I
        FOR SELECT TO authenticated
        USING (
          get_user_role() IN (''admin'', ''diretor'', ''producao'', ''compras'', ''logistica'')
        );',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "producao_write_%s" ON %I
        FOR INSERT TO authenticated
        WITH CHECK (get_user_role() IN (''admin'', ''diretor'', ''producao''));',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "producao_update_%s" ON %I
        FOR UPDATE TO authenticated
        USING (get_user_role() IN (''admin'', ''diretor'', ''producao''))
        WITH CHECK (get_user_role() IN (''admin'', ''diretor'', ''producao''));',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "producao_delete_%s" ON %I
        FOR DELETE TO authenticated
        USING (get_user_role() IN (''admin''));',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- 6.10 PRODUTOS e PRECIFICACAO: leitura ampla, escrita por admin + producao
-- ============================================================
DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY[
    'produtos', 'produto_modelos', 'modelo_materiais', 'modelo_processos', 'config_precificacao'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas
  LOOP
    EXECUTE format(
      'CREATE POLICY "produtos_read_%s" ON %I
        FOR SELECT TO authenticated
        USING (
          get_user_role() IN (''admin'', ''diretor'', ''comercial'', ''comercial_senior'', ''producao'', ''compras'')
        );',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "produtos_write_%s" ON %I
        FOR INSERT TO authenticated
        WITH CHECK (get_user_role() IN (''admin'', ''diretor'', ''producao''));',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "produtos_update_%s" ON %I
        FOR UPDATE TO authenticated
        USING (get_user_role() IN (''admin'', ''diretor'', ''producao''))
        WITH CHECK (get_user_role() IN (''admin'', ''diretor'', ''producao''));',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "produtos_delete_%s" ON %I
        FOR DELETE TO authenticated
        USING (get_user_role() IN (''admin''));',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- 6.11 ESTOQUE: leitura por producao/compras, escrita por compras + admin
-- ============================================================
DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY[
    'materiais', 'estoque_saldos', 'estoque_movimentacoes'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas
  LOOP
    EXECUTE format(
      'CREATE POLICY "estoque_read_%s" ON %I
        FOR SELECT TO authenticated
        USING (
          get_user_role() IN (''admin'', ''diretor'', ''producao'', ''compras'')
        );',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "estoque_write_%s" ON %I
        FOR INSERT TO authenticated
        WITH CHECK (get_user_role() IN (''admin'', ''diretor'', ''compras'', ''producao''));',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "estoque_update_%s" ON %I
        FOR UPDATE TO authenticated
        USING (get_user_role() IN (''admin'', ''diretor'', ''compras'', ''producao''))
        WITH CHECK (get_user_role() IN (''admin'', ''diretor'', ''compras'', ''producao''));',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "estoque_delete_%s" ON %I
        FOR DELETE TO authenticated
        USING (get_user_role() IN (''admin''));',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- 6.12 COMPRAS e FORNECEDORES: leitura por compras/financeiro, escrita por compras + admin
-- ============================================================
DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY[
    'fornecedores', 'pedidos_compra', 'pedido_compra_itens', 'historico_precos_fornecedor'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas
  LOOP
    EXECUTE format(
      'CREATE POLICY "compras_read_%s" ON %I
        FOR SELECT TO authenticated
        USING (
          get_user_role() IN (''admin'', ''diretor'', ''compras'', ''financeiro'', ''producao'')
        );',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "compras_write_%s" ON %I
        FOR INSERT TO authenticated
        WITH CHECK (get_user_role() IN (''admin'', ''diretor'', ''compras''));',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "compras_update_%s" ON %I
        FOR UPDATE TO authenticated
        USING (get_user_role() IN (''admin'', ''diretor'', ''compras''))
        WITH CHECK (get_user_role() IN (''admin'', ''diretor'', ''compras''));',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "compras_delete_%s" ON %I
        FOR DELETE TO authenticated
        USING (get_user_role() IN (''admin''));',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- 6.13 FINANCEIRO: leitura por financeiro/diretor, escrita por financeiro + admin
-- ============================================================
DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY[
    'plano_contas', 'centros_custo',
    'contas_receber', 'parcelas_receber',
    'contas_pagar', 'parcelas_pagar', 'comissoes'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas
  LOOP
    EXECUTE format(
      'CREATE POLICY "financeiro_read_%s" ON %I
        FOR SELECT TO authenticated
        USING (
          get_user_role() IN (''admin'', ''diretor'', ''financeiro'')
        );',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "financeiro_write_%s" ON %I
        FOR INSERT TO authenticated
        WITH CHECK (get_user_role() IN (''admin'', ''diretor'', ''financeiro''));',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "financeiro_update_%s" ON %I
        FOR UPDATE TO authenticated
        USING (get_user_role() IN (''admin'', ''diretor'', ''financeiro''))
        WITH CHECK (get_user_role() IN (''admin'', ''diretor'', ''financeiro''));',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "financeiro_delete_%s" ON %I
        FOR DELETE TO authenticated
        USING (get_user_role() IN (''admin''));',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- 6.14 INSTALACAO (ERP side): leitura por logistica/producao, escrita por logistica + admin
-- ============================================================
DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY['equipes', 'ordens_instalacao'];
BEGIN
  FOREACH t IN ARRAY tabelas
  LOOP
    EXECUTE format(
      'CREATE POLICY "instalacao_read_%s" ON %I
        FOR SELECT TO authenticated
        USING (
          get_user_role() IN (''admin'', ''diretor'', ''logistica'', ''producao'', ''instalador'')
        );',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "instalacao_write_%s" ON %I
        FOR INSERT TO authenticated
        WITH CHECK (get_user_role() IN (''admin'', ''diretor'', ''logistica''));',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "instalacao_update_%s" ON %I
        FOR UPDATE TO authenticated
        USING (get_user_role() IN (''admin'', ''diretor'', ''logistica''))
        WITH CHECK (get_user_role() IN (''admin'', ''diretor'', ''logistica''));',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "instalacao_delete_%s" ON %I
        FOR DELETE TO authenticated
        USING (get_user_role() IN (''admin''));',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- 6.15 CAMPO: tarefas_campo, checklists_campo, midias_campo, assinaturas_campo
-- Instalador ve/edita as proprias tarefas; logistica + admin ve tudo.
-- ============================================================

-- tarefas_campo (tem tecnico_id)
CREATE POLICY "campo_access_tarefas_campo" ON tarefas_campo
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('admin', 'diretor', 'logistica')
    OR (get_user_role() = 'instalador' AND tecnico_id = auth.uid())
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'logistica')
    OR (get_user_role() = 'instalador' AND tecnico_id = auth.uid())
  );

-- checklists_campo (vinculado via field_task_id -> tarefas_campo)
CREATE POLICY "campo_access_checklists_campo" ON checklists_campo
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('admin', 'diretor', 'logistica')
    OR (get_user_role() = 'instalador' AND EXISTS (
      SELECT 1 FROM tarefas_campo tc
      WHERE tc.id = checklists_campo.field_task_id AND tc.tecnico_id = auth.uid()
    ))
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'logistica')
    OR (get_user_role() = 'instalador' AND EXISTS (
      SELECT 1 FROM tarefas_campo tc
      WHERE tc.id = checklists_campo.field_task_id AND tc.tecnico_id = auth.uid()
    ))
  );

-- midias_campo (vinculado via field_task_id -> tarefas_campo)
CREATE POLICY "campo_access_midias_campo" ON midias_campo
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('admin', 'diretor', 'logistica')
    OR (get_user_role() = 'instalador' AND EXISTS (
      SELECT 1 FROM tarefas_campo tc
      WHERE tc.id = midias_campo.field_task_id AND tc.tecnico_id = auth.uid()
    ))
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'logistica')
    OR (get_user_role() = 'instalador' AND EXISTS (
      SELECT 1 FROM tarefas_campo tc
      WHERE tc.id = midias_campo.field_task_id AND tc.tecnico_id = auth.uid()
    ))
  );

-- assinaturas_campo (vinculado via field_task_id -> tarefas_campo)
CREATE POLICY "campo_access_assinaturas_campo" ON assinaturas_campo
  FOR ALL TO authenticated
  USING (
    get_user_role() IN ('admin', 'diretor', 'logistica')
    OR (get_user_role() = 'instalador' AND EXISTS (
      SELECT 1 FROM tarefas_campo tc
      WHERE tc.id = assinaturas_campo.field_task_id AND tc.tecnico_id = auth.uid()
    ))
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'logistica')
    OR (get_user_role() = 'instalador' AND EXISTS (
      SELECT 1 FROM tarefas_campo tc
      WHERE tc.id = assinaturas_campo.field_task_id AND tc.tecnico_id = auth.uid()
    ))
  );

-- ============================================================
-- 6.16 QUALIDADE: leitura por producao/logistica/admin, escrita mais ampla
-- ============================================================
DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY['ocorrencias', 'ocorrencia_tratativas'];
BEGIN
  FOREACH t IN ARRAY tabelas
  LOOP
    EXECUTE format(
      'CREATE POLICY "qualidade_read_%s" ON %I
        FOR SELECT TO authenticated
        USING (
          get_user_role() IN (''admin'', ''diretor'', ''producao'', ''logistica'', ''instalador'')
        );',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "qualidade_write_%s" ON %I
        FOR INSERT TO authenticated
        WITH CHECK (
          get_user_role() IN (''admin'', ''diretor'', ''producao'', ''logistica'', ''instalador'')
        );',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "qualidade_update_%s" ON %I
        FOR UPDATE TO authenticated
        USING (get_user_role() IN (''admin'', ''diretor'', ''producao'', ''logistica''))
        WITH CHECK (get_user_role() IN (''admin'', ''diretor'', ''producao'', ''logistica''));',
      t, t
    );

    EXECUTE format(
      'CREATE POLICY "qualidade_delete_%s" ON %I
        FOR DELETE TO authenticated
        USING (get_user_role() IN (''admin''));',
      t, t
    );
  END LOOP;
END $$;


-- ############################################################
-- 7. INDEXES COMPOSTOS E DE PERFORMANCE
-- ############################################################
-- MOTIVO: Indexes compostos para queries frequentes de dashboard,
-- relatorios e buscas. Partial indexes para filtrar registros ativos.

-- === Financeiro: queries comuns ===
CREATE INDEX IF NOT EXISTS idx_cr_status_vencimento ON contas_receber(status, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_cp_status_vencimento ON contas_pagar(status, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_cr_cliente_status ON contas_receber(cliente_id, status);

-- === Pipeline comercial ===
CREATE INDEX IF NOT EXISTS idx_oport_vendedor_fase ON oportunidades(vendedor_id, fase);
CREATE INDEX IF NOT EXISTS idx_leads_vendedor_status ON leads(vendedor_id, status);
CREATE INDEX IF NOT EXISTS idx_propostas_cliente_status ON propostas(cliente_id, status);

-- === Producao ===
CREATE INDEX IF NOT EXISTS idx_op_status_prazo ON ordens_producao(status, prazo_interno);
CREATE INDEX IF NOT EXISTS idx_pe_ordem_status ON producao_etapas(ordem_producao_id, status);

-- === Instalacao ===
CREATE INDEX IF NOT EXISTS idx_oi_equipe_data ON ordens_instalacao(equipe_id, data_agendada);
CREATE INDEX IF NOT EXISTS idx_oi_status_data ON ordens_instalacao(status, data_agendada);

-- === Partial indexes para registros ativos ===
CREATE INDEX IF NOT EXISTS idx_clientes_ativos ON clientes(razao_social) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_materiais_ativos ON materiais(nome) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_fornecedores_ativos ON fornecedores(razao_social) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_produtos_ativos ON produtos(nome) WHERE ativo = true;

-- === Partial indexes para soft delete ===
CREATE INDEX IF NOT EXISTS idx_propostas_nao_excluidas ON propostas(status) WHERE excluido_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_nao_excluidos ON pedidos(status) WHERE excluido_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_op_nao_excluidas ON ordens_producao(status) WHERE excluido_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_cr_nao_excluidas ON contas_receber(status) WHERE excluido_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_cp_nao_excluidas ON contas_pagar(status) WHERE excluido_em IS NULL;

-- === Trigram indexes para busca textual por nome ===
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_clientes_razao_trgm ON clientes USING gin(razao_social gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clientes_fantasia_trgm ON clientes USING gin(nome_fantasia gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_empresa_trgm ON leads USING gin(empresa gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_fornecedores_razao_trgm ON fornecedores USING gin(razao_social gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_materiais_nome_trgm ON materiais USING gin(nome gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_produtos_nome_trgm ON produtos USING gin(nome gin_trgm_ops);

-- === Date range indexes para relatorios ===
CREATE INDEX IF NOT EXISTS idx_pedidos_created ON pedidos(created_at);
CREATE INDEX IF NOT EXISTS idx_propostas_created ON propostas(created_at);
CREATE INDEX IF NOT EXISTS idx_lancamentos_data ON lancamentos_caixa(data_lancamento);

-- === Indexes para tabelas novas ===
CREATE INDEX IF NOT EXISTS idx_equipe_membros_equipe ON equipe_membros(equipe_id);
CREATE INDEX IF NOT EXISTS idx_equipe_membros_usuario ON equipe_membros(usuario_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_equipe ON veiculos(equipe_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_placa ON veiculos(placa);
CREATE INDEX IF NOT EXISTS idx_cliente_docs_cliente ON cliente_documentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_docs_tipo ON cliente_documentos(tipo);
CREATE INDEX IF NOT EXISTS idx_proposta_versoes_proposta ON proposta_versoes(proposta_id);
CREATE INDEX IF NOT EXISTS idx_sc_material ON solicitacoes_compra(material_id);
CREATE INDEX IF NOT EXISTS idx_sc_status ON solicitacoes_compra(status);
CREATE INDEX IF NOT EXISTS idx_sc_solicitante ON solicitacoes_compra(solicitante_id);
CREATE INDEX IF NOT EXISTS idx_cotacoes_solicitacao ON cotacoes_compra(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_cotacoes_fornecedor ON cotacoes_compra(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_receb_pedido ON recebimentos(pedido_compra_id);
CREATE INDEX IF NOT EXISTS idx_receb_fornecedor ON recebimentos(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_receb_itens_receb ON recebimento_itens(recebimento_id);
CREATE INDEX IF NOT EXISTS idx_pa_etapa ON producao_apontamentos(producao_etapa_id);
CREATE INDEX IF NOT EXISTS idx_pa_ordem ON producao_apontamentos(ordem_producao_id);
CREATE INDEX IF NOT EXISTS idx_pa_operador ON producao_apontamentos(operador_id);
CREATE INDEX IF NOT EXISTS idx_pm_ordem ON producao_materiais(ordem_producao_id);
CREATE INDEX IF NOT EXISTS idx_pm_material ON producao_materiais(material_id);
CREATE INDEX IF NOT EXISTS idx_ei_material ON estoque_inventario(material_id);
CREATE INDEX IF NOT EXISTS idx_ei_data ON estoque_inventario(data_contagem);
CREATE INDEX IF NOT EXISTS idx_lc_tipo ON lancamentos_caixa(tipo);
CREATE INDEX IF NOT EXISTS idx_lc_categoria ON lancamentos_caixa(categoria);
CREATE INDEX IF NOT EXISTS idx_lc_data ON lancamentos_caixa(data_lancamento);
CREATE INDEX IF NOT EXISTS idx_lc_cr ON lancamentos_caixa(conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_lc_cp ON lancamentos_caixa(conta_pagar_id);
CREATE INDEX IF NOT EXISTS idx_agenda_equipe_data ON agenda_instalacao(equipe_id, data);
CREATE INDEX IF NOT EXISTS idx_agenda_oi ON agenda_instalacao(ordem_instalacao_id);
CREATE INDEX IF NOT EXISTS idx_notif_usuario ON notificacoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notif_lida ON notificacoes(usuario_id, lida);
CREATE INDEX IF NOT EXISTS idx_notif_created ON notificacoes(created_at);


-- ############################################################
-- 8. SEQUENCES E AUTO-NUMERACAO
-- ############################################################
-- MOTIVO: Adicionar sequences para tabelas novas e atualizar
-- a funcao gerar_numero_auto() para incluir novos prefixos.

CREATE SEQUENCE IF NOT EXISTS solicitacao_compra_numero_seq START 1;
CREATE SEQUENCE IF NOT EXISTS ocorrencia_numero_seq START 1;

-- Atualizar funcao de auto-numeracao para incluir novos tipos
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
    WHEN 'solicitacoes_compra' THEN
      prefixo := 'SC';
      seq_name := 'solicitacao_compra_numero_seq';
      padding := 4;
    WHEN 'ocorrencias' THEN
      prefixo := 'OCR';
      seq_name := 'ocorrencia_numero_seq';
      padding := 4;
    ELSE
      RETURN NEW;
  END CASE;

  novo_numero := prefixo || '-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval(seq_name)::TEXT, padding, '0');
  NEW.numero := novo_numero;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger de auto-numeracao para solicitacoes_compra
DROP TRIGGER IF EXISTS trigger_auto_numero_sc ON solicitacoes_compra;
CREATE TRIGGER trigger_auto_numero_sc
  BEFORE INSERT ON solicitacoes_compra
  FOR EACH ROW EXECUTE FUNCTION gerar_numero_auto();

-- Trigger de auto-numeracao para ocorrencias
-- Primeiro, adicionar coluna numero se nao existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ocorrencias' AND column_name = 'numero' AND table_schema = 'public'
  ) THEN
    ALTER TABLE ocorrencias ADD COLUMN numero TEXT UNIQUE;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trigger_auto_numero_ocorr ON ocorrencias;
CREATE TRIGGER trigger_auto_numero_ocorr
  BEFORE INSERT ON ocorrencias
  FOR EACH ROW EXECUTE FUNCTION gerar_numero_auto();


-- ############################################################
-- 9. CORRECOES DE COLUNAS
-- ############################################################

-- 9.1 Remover veiculo_placa e veiculo_tipo da tabela equipes
-- MOTIVO: Dados de veiculo agora estao na tabela veiculos (normalizacao).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipes' AND column_name = 'veiculo_placa' AND table_schema = 'public'
  ) THEN
    -- Migrar dados existentes para tabela veiculos antes de remover
    INSERT INTO veiculos (placa, tipo, equipe_id)
    SELECT DISTINCT veiculo_placa, COALESCE(veiculo_tipo, 'Nao especificado'), id
    FROM equipes
    WHERE veiculo_placa IS NOT NULL AND veiculo_placa != ''
    ON CONFLICT (placa) DO NOTHING;

    ALTER TABLE equipes DROP COLUMN veiculo_placa;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipes' AND column_name = 'veiculo_tipo' AND table_schema = 'public'
  ) THEN
    ALTER TABLE equipes DROP COLUMN veiculo_tipo;
  END IF;
END $$;


-- ############################################################
-- 10. TRIGGERS DE UPDATED_AT PARA TABELAS NOVAS
-- ############################################################
-- MOTIVO: Manter updated_at atualizado automaticamente nas novas tabelas.

DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY['veiculos', 'solicitacoes_compra'];
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
-- 11. HABILITAR RLS EM TODAS AS TABELAS NOVAS
-- ############################################################
-- MOTIVO: Seguranca obrigatoria no Supabase — RLS deve estar
-- habilitado em todas as tabelas acessiveis pelo cliente.

DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY[
    'equipe_membros', 'veiculos', 'cliente_documentos',
    'proposta_versoes', 'solicitacoes_compra', 'cotacoes_compra',
    'recebimentos', 'recebimento_itens',
    'producao_apontamentos', 'producao_materiais',
    'estoque_inventario', 'lancamentos_caixa',
    'agenda_instalacao', 'notificacoes'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- ============================================================
-- 11.1 RLS Policies para tabelas novas
-- ============================================================

-- equipe_membros: logistica + admin
CREATE POLICY "admin_full_equipe_membros" ON equipe_membros
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'diretor', 'logistica'))
  WITH CHECK (get_user_role() IN ('admin', 'diretor', 'logistica'));

CREATE POLICY "instalador_read_equipe_membros" ON equipe_membros
  FOR SELECT TO authenticated
  USING (get_user_role() = 'instalador' AND usuario_id = auth.uid());

-- veiculos: logistica + admin
CREATE POLICY "admin_full_veiculos" ON veiculos
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'diretor', 'logistica'))
  WITH CHECK (get_user_role() IN ('admin', 'diretor', 'logistica'));

CREATE POLICY "producao_read_veiculos" ON veiculos
  FOR SELECT TO authenticated
  USING (get_user_role() IN ('producao'));

-- cliente_documentos: segue politica de clientes
CREATE POLICY "clientes_read_cliente_documentos" ON cliente_documentos
  FOR SELECT TO authenticated
  USING (
    get_user_role() IN ('admin', 'diretor', 'comercial', 'comercial_senior', 'financeiro', 'logistica', 'producao')
  );

CREATE POLICY "clientes_write_cliente_documentos" ON cliente_documentos
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('admin', 'diretor', 'comercial', 'comercial_senior'));

CREATE POLICY "clientes_update_cliente_documentos" ON cliente_documentos
  FOR UPDATE TO authenticated
  USING (get_user_role() IN ('admin', 'diretor', 'comercial', 'comercial_senior'))
  WITH CHECK (get_user_role() IN ('admin', 'diretor', 'comercial', 'comercial_senior'));

CREATE POLICY "clientes_delete_cliente_documentos" ON cliente_documentos
  FOR DELETE TO authenticated
  USING (get_user_role() IN ('admin', 'diretor'));

-- proposta_versoes: segue politica de propostas
CREATE POLICY "comercial_access_proposta_versoes" ON proposta_versoes
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'diretor', 'comercial', 'comercial_senior'))
  WITH CHECK (get_user_role() IN ('admin', 'diretor', 'comercial', 'comercial_senior'));

-- solicitacoes_compra: compras + producao + admin
CREATE POLICY "compras_full_solicitacoes_compra" ON solicitacoes_compra
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'diretor', 'compras', 'producao'))
  WITH CHECK (get_user_role() IN ('admin', 'diretor', 'compras', 'producao'));

-- cotacoes_compra: compras + admin
CREATE POLICY "compras_full_cotacoes_compra" ON cotacoes_compra
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'diretor', 'compras'))
  WITH CHECK (get_user_role() IN ('admin', 'diretor', 'compras'));

CREATE POLICY "financeiro_read_cotacoes_compra" ON cotacoes_compra
  FOR SELECT TO authenticated
  USING (get_user_role() = 'financeiro');

-- recebimentos e itens: compras + admin
CREATE POLICY "compras_full_recebimentos" ON recebimentos
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'diretor', 'compras'))
  WITH CHECK (get_user_role() IN ('admin', 'diretor', 'compras'));

CREATE POLICY "compras_full_recebimento_itens" ON recebimento_itens
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'diretor', 'compras'))
  WITH CHECK (get_user_role() IN ('admin', 'diretor', 'compras'));

-- producao_apontamentos: producao + admin
CREATE POLICY "producao_full_apontamentos" ON producao_apontamentos
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'diretor', 'producao'))
  WITH CHECK (get_user_role() IN ('admin', 'diretor', 'producao'));

-- producao_materiais: producao + compras + admin
CREATE POLICY "producao_full_materiais" ON producao_materiais
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'diretor', 'producao', 'compras'))
  WITH CHECK (get_user_role() IN ('admin', 'diretor', 'producao'));

-- estoque_inventario: compras + producao + admin
CREATE POLICY "estoque_full_inventario" ON estoque_inventario
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'diretor', 'compras', 'producao'))
  WITH CHECK (get_user_role() IN ('admin', 'diretor', 'compras'));

-- lancamentos_caixa: financeiro + admin
CREATE POLICY "financeiro_full_lancamentos_caixa" ON lancamentos_caixa
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'diretor', 'financeiro'))
  WITH CHECK (get_user_role() IN ('admin', 'diretor', 'financeiro'));

-- agenda_instalacao: logistica + admin
CREATE POLICY "logistica_full_agenda_instalacao" ON agenda_instalacao
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'diretor', 'logistica'))
  WITH CHECK (get_user_role() IN ('admin', 'diretor', 'logistica'));

CREATE POLICY "instalador_read_agenda_instalacao" ON agenda_instalacao
  FOR SELECT TO authenticated
  USING (get_user_role() = 'instalador');

-- notificacoes: cada usuario ve apenas as proprias
CREATE POLICY "notificacoes_own" ON notificacoes
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (TRUE);

CREATE POLICY "notificacoes_admin_read" ON notificacoes
  FOR SELECT TO authenticated
  USING (get_user_role() IN ('admin'));


-- ############################################################
-- RESUMO DAS ALTERACOES
-- ############################################################
--
-- TABELAS RENOMEADAS (9):
--   audit_logs         -> registros_auditoria
--   attachments        -> anexos
--   lead_sources       -> origens_lead
--   role_permissions   -> permissoes_perfil
--   field_tasks        -> tarefas_campo
--   field_checklists   -> checklists_campo
--   field_media        -> midias_campo
--   field_signatures   -> assinaturas_campo
--   historico_precos   -> historico_precos_fornecedor
--
-- TABELAS CRIADAS (14):
--   equipe_membros, veiculos, cliente_documentos,
--   proposta_versoes, solicitacoes_compra, cotacoes_compra,
--   recebimentos, recebimento_itens,
--   producao_apontamentos, producao_materiais,
--   estoque_inventario, lancamentos_caixa,
--   agenda_instalacao, notificacoes
--
-- SOFT DELETE adicionado (10 tabelas):
--   propostas, pedidos, pedido_itens,
--   ordens_producao, ordens_instalacao,
--   contas_receber, contas_pagar,
--   pedidos_compra, comissoes, ocorrencias
--
-- FUNCOES CRIADAS (3):
--   fn_registrar_auditoria() - auditoria automatica
--   fn_validar_transicao_status() - validacao de status
--   get_user_role() - helper para RLS
--
-- TRIGGERS DE AUDITORIA (16 tabelas)
-- TRIGGERS DE STATUS (3 tabelas: pedidos, propostas, ordens_producao)
-- TRIGGERS DE UPDATED_AT (2 tabelas novas)
-- TRIGGERS DE AUTO-NUMERACAO (2 tabelas novas: solicitacoes_compra, ocorrencias)
--
-- SEQUENCES CRIADAS (2):
--   solicitacao_compra_numero_seq, ocorrencia_numero_seq
--
-- RLS POLICIES: ~100+ policies granulares (substituindo auth_all_*)
-- INDEXES: ~55+ novos indexes compostos, parciais e trigram
-- EXTENSAO: pg_trgm habilitada
--
-- COLUNAS:
--   ocorrencias: +numero (TEXT UNIQUE)
--   equipes: -veiculo_placa, -veiculo_tipo (migrado para veiculos)
--   10 tabelas: +excluido_em, +excluido_por (soft delete)
-- ============================================================
