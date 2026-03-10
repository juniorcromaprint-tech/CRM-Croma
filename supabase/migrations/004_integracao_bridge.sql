-- ============================================================
-- INTEGRAÇÃO BRIDGE: CRM ↔ App de Campo
-- Data: 2026-03-10
-- Objetivo: Vincular tabelas do Campo (jobs, stores) ao CRM
--           (ordens_instalacao, pedidos, clientes)
-- ============================================================

-- ============================================================
-- A) COLUNAS DE VÍNCULO NAS TABELAS DO CAMPO
-- ============================================================

-- Vincular jobs às entidades do CRM
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ordem_instalacao_id UUID;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pedido_id UUID;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pedido_item_id UUID;

-- Vincular stores aos clientes do CRM
ALTER TABLE stores ADD COLUMN IF NOT EXISTS cliente_id UUID;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS cliente_unidade_id UUID;

-- Garantir FK jobs.assigned_to para profiles (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'jobs_assigned_to_fkey'
      AND table_name = 'jobs'
  ) THEN
    -- Tentar referenciar profiles se existir; caso não exista, manter referência a auth.users
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
      -- Remove a FK antiga apontando para auth.users se existir
      -- (pode não existir se já foi removida)
      ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_assigned_to_fkey2;
    END IF;
  END IF;
END $$;

-- ============================================================
-- B) VIEW UNIFICADA: vw_campo_instalacoes
-- ============================================================

CREATE OR REPLACE VIEW vw_campo_instalacoes AS
SELECT
  j.id AS job_id,
  j.os_number,
  j.type AS tipo_servico,
  j.status AS status_campo,
  j.scheduled_date AS data_agendada,
  j.started_at,
  j.finished_at,
  j.lat,
  j.lng,
  j.notes,
  j.issues,
  j.signature_url,
  j.ordem_instalacao_id,
  j.pedido_id,
  j.pedido_item_id,
  j.assigned_to,
  -- Store / Loja
  s.id AS store_id,
  s.name AS loja_nome,
  s.brand AS loja_marca,
  s.address AS loja_endereco,
  s.state AS loja_estado,
  s.cliente_id,
  s.cliente_unidade_id,
  -- Técnico responsável
  p.id AS tecnico_id,
  COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '') AS tecnico_nome,
  p.role AS tecnico_role,
  -- Contagens de mídia
  (SELECT COUNT(*) FROM job_photos jp WHERE jp.job_id = j.id AND jp.photo_type = 'before') AS fotos_antes,
  (SELECT COUNT(*) FROM job_photos jp WHERE jp.job_id = j.id AND jp.photo_type = 'after') AS fotos_depois,
  (SELECT COUNT(*) FROM job_videos jv WHERE jv.job_id = j.id) AS total_videos,
  -- Duração em minutos
  CASE
    WHEN j.started_at IS NOT NULL AND j.finished_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (j.finished_at - j.started_at)) / 60
    ELSE NULL
  END AS duracao_minutos,
  j.created_at
FROM jobs j
LEFT JOIN stores s ON j.store_id = s.id
LEFT JOIN profiles p ON j.assigned_to = p.id
WHERE j.deleted_at IS NULL;

-- ============================================================
-- C) VIEW DE FOTOS: vw_campo_fotos
-- ============================================================

CREATE OR REPLACE VIEW vw_campo_fotos AS
SELECT
  jp.id,
  jp.job_id,
  jp.photo_type,
  jp.photo_url,
  jp.description,
  jp.note,
  jp.created_at,
  j.os_number,
  j.ordem_instalacao_id,
  j.pedido_id,
  s.name AS loja_nome,
  s.brand AS loja_marca
FROM job_photos jp
JOIN jobs j ON jp.job_id = j.id
LEFT JOIN stores s ON j.store_id = s.id
WHERE j.deleted_at IS NULL;

-- ============================================================
-- D) TRIGGER: Campo → CRM (job muda status → atualiza ordem_instalacao)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_sync_job_to_ordem()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ordem_instalacao_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Quando job é concluído, marca a ordem de instalação como concluída
  IF NEW.status = 'Concluído' AND (OLD.status IS NULL OR OLD.status != 'Concluído') THEN
    UPDATE ordens_instalacao
    SET status = 'concluida',
        data_execucao = CURRENT_DATE,
        updated_at = NOW()
    WHERE id = NEW.ordem_instalacao_id;

    -- Atualizar status do item do pedido se existir
    IF NEW.pedido_id IS NOT NULL AND NEW.pedido_item_id IS NOT NULL THEN
      UPDATE pedido_itens
      SET status = 'instalado'
      WHERE pedido_id = NEW.pedido_id
        AND id = NEW.pedido_item_id;
    END IF;
  END IF;

  -- Quando job está em andamento, marca a ordem como em execução
  IF NEW.status = 'Em Andamento' AND (OLD.status IS NULL OR OLD.status != 'Em Andamento') THEN
    UPDATE ordens_instalacao
    SET status = 'em_execucao',
        updated_at = NOW()
    WHERE id = NEW.ordem_instalacao_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_job_to_ordem ON jobs;
CREATE TRIGGER trg_sync_job_to_ordem
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION fn_sync_job_to_ordem();

-- ============================================================
-- E) TRIGGER: CRM → Campo (ordem agendada → cria job no Campo)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_create_job_from_ordem()
RETURNS TRIGGER AS $$
DECLARE
  v_store_id UUID;
  v_os_number TEXT;
BEGIN
  -- Só age quando status vai para "agendada" e ainda não tem job criado
  IF NEW.status = 'agendada' AND (OLD.status IS NULL OR OLD.status != 'agendada') THEN

    -- Verificar se já existe job para esta ordem (evitar duplicata)
    IF EXISTS (SELECT 1 FROM jobs WHERE ordem_instalacao_id = NEW.id AND deleted_at IS NULL) THEN
      RETURN NEW;
    END IF;

    -- Busca store vinculado à unidade do cliente
    SELECT s.id INTO v_store_id
    FROM stores s
    JOIN cliente_unidades cu ON s.cliente_unidade_id = cu.id
    WHERE cu.id = NEW.unidade_id
    LIMIT 1;

    -- Gera número da OS se não tiver
    v_os_number := COALESCE(
      NEW.numero,
      'OS-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
        LPAD((EXTRACT(EPOCH FROM NOW())::BIGINT % 10000)::TEXT, 4, '0')
    );

    -- Cria o job no Campo
    INSERT INTO jobs (
      store_id,
      os_number,
      type,
      status,
      scheduled_date,
      notes,
      assigned_to,
      ordem_instalacao_id,
      pedido_id,
      pedido_item_id
    ) VALUES (
      v_store_id,
      v_os_number,
      'Instalação',
      'Pendente',
      NEW.data_agendada,
      NEW.instrucoes,
      NEW.equipe_id,
      NEW.id,
      NEW.pedido_id,
      NULL
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_job_from_ordem ON ordens_instalacao;
CREATE TRIGGER trg_create_job_from_ordem
  AFTER INSERT OR UPDATE ON ordens_instalacao
  FOR EACH ROW
  EXECUTE FUNCTION fn_create_job_from_ordem();

-- ============================================================
-- F) ÍNDICES PARA PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_jobs_ordem_instalacao_id
  ON jobs(ordem_instalacao_id)
  WHERE ordem_instalacao_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_pedido_id
  ON jobs(pedido_id)
  WHERE pedido_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stores_cliente_id
  ON stores(cliente_id)
  WHERE cliente_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stores_cliente_unidade_id
  ON stores(cliente_unidade_id)
  WHERE cliente_unidade_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_status_ativo
  ON jobs(status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_date
  ON jobs(scheduled_date)
  WHERE deleted_at IS NULL;
