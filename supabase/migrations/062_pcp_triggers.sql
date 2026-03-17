-- 062_pcp_triggers.sql
-- Triggers de automação do fluxo PCP

-- Trigger 1: etapa concluída → verificar se todas as etapas estão concluídas
-- Se sim: avança OP para em_conferencia
CREATE OR REPLACE FUNCTION fn_etapa_concluida_avanca_op()
RETURNS TRIGGER AS $$
DECLARE
  v_total_etapas INTEGER;
  v_concluidas INTEGER;
  v_op_status TEXT;
BEGIN
  IF NEW.status = 'concluida' AND OLD.status != 'concluida' THEN
    SELECT COUNT(*) INTO v_total_etapas
    FROM producao_etapas
    WHERE ordem_producao_id = NEW.ordem_producao_id
      AND status != 'pulada';

    SELECT COUNT(*) INTO v_concluidas
    FROM producao_etapas
    WHERE ordem_producao_id = NEW.ordem_producao_id
      AND status = 'concluida';

    SELECT status INTO v_op_status
    FROM ordens_producao WHERE id = NEW.ordem_producao_id;

    IF v_concluidas >= v_total_etapas AND v_op_status NOT IN ('em_conferencia', 'liberado', 'finalizado') THEN
      UPDATE ordens_producao
      SET status = 'em_conferencia', updated_at = NOW()
      WHERE id = NEW.ordem_producao_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_etapa_concluida_avanca_op ON producao_etapas;
CREATE TRIGGER tr_etapa_concluida_avanca_op
  AFTER UPDATE ON producao_etapas
  FOR EACH ROW EXECUTE FUNCTION fn_etapa_concluida_avanca_op();

-- Trigger 2: apontamento com fim preenchido → atualiza tempo_real da etapa
-- NOTA: producao_etapas não possui coluna updated_at — removido do UPDATE
CREATE OR REPLACE FUNCTION fn_apontamento_atualiza_etapa()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fim IS NOT NULL AND OLD.fim IS NULL THEN
    NEW.tempo_minutos := EXTRACT(EPOCH FROM (NEW.fim - NEW.inicio)) / 60;

    UPDATE producao_etapas
    SET
      tempo_real_min = COALESCE(tempo_real_min, 0) + NEW.tempo_minutos,
      fim = NEW.fim
    WHERE id = NEW.producao_etapa_id;

    UPDATE ordens_producao
    SET
      tempo_real_min = COALESCE(tempo_real_min, 0) + NEW.tempo_minutos,
      updated_at = NOW()
    WHERE id = NEW.ordem_producao_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_apontamento_atualiza_etapa ON producao_apontamentos;
CREATE TRIGGER tr_apontamento_atualiza_etapa
  BEFORE UPDATE ON producao_apontamentos
  FOR EACH ROW EXECUTE FUNCTION fn_apontamento_atualiza_etapa();

-- Trigger 3: OP muda para em_producao → setar data_inicio se NULL
CREATE OR REPLACE FUNCTION fn_op_inicio_producao()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'em_producao' AND OLD.status = 'em_fila'
     AND NEW.data_inicio IS NULL THEN
    NEW.data_inicio := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_op_inicio_producao ON ordens_producao;
CREATE TRIGGER tr_op_inicio_producao
  BEFORE UPDATE ON ordens_producao
  FOR EACH ROW EXECUTE FUNCTION fn_op_inicio_producao();
