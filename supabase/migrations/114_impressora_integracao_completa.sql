-- Migration 114: Integração completa impressora HP Latex 365 ↔ CRM
-- Adicionada em 2026-04-02

-- 1. Campos adicionais na tabela impressora_jobs
ALTER TABLE impressora_jobs
  ADD COLUMN IF NOT EXISTS maquina_id uuid REFERENCES maquinas(id),
  ADD COLUMN IF NOT EXISTS substrato_material_id uuid REFERENCES materiais(id),
  ADD COLUMN IF NOT EXISTS metros_lineares numeric;

-- 2. Tabela de mapeamento substrato EWS → catálogo materiais
CREATE TABLE IF NOT EXISTS impressora_substrato_map (
  nome_ews text PRIMARY KEY,
  material_id uuid REFERENCES materiais(id),
  custo_m2_override numeric,
  largura_mm integer,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Seed de substratos do EWS (dados coletados do Usage da impressora)
INSERT INTO impressora_substrato_map (nome_ews, largura_mm, material_id) VALUES
  ('Vinil fosco SP Media SM790', 1060, '1453b2b8-cbd1-453c-ad0d-e16a8c74d27f'),
  ('Filme PET PP SY Sol', 1060, NULL),
  ('Bagum', 1060, NULL),
  ('Ritrama Fosco', 1060, NULL),
  ('Avery Fosco', 1060, NULL),
  ('Banner', 1060, NULL),
  ('Adesivo Perfurado', 1060, NULL),
  ('Tecido', 1060, NULL),
  ('Vinil Transparente', 1060, NULL),
  ('Lona', 1060, NULL),
  ('Papel Fotografico', 1060, NULL),
  ('Papel Sulfite', 1060, NULL),
  ('Adesivo Jateado', 1060, NULL),
  ('Vinil Brilho', 1060, NULL),
  ('Adesivo Premium', 1060, NULL),
  ('Vinil Recorte', 1060, NULL),
  ('Papel Couche', 1060, NULL),
  ('Canvas', 1060, NULL),
  ('Backlight', 1060, NULL),
  ('Blackout', 1060, NULL),
  ('Frontlight', 1060, NULL),
  ('Microperfurado', 1060, NULL)
ON CONFLICT (nome_ews) DO NOTHING;

-- 3. View: custo real por pedido
CREATE OR REPLACE VIEW vw_custo_real_por_pedido AS
SELECT
  p.id AS pedido_id,
  p.numero AS pedido_numero,
  COALESCE(c.nome_fantasia, c.razao_social) AS cliente,
  p.valor_total AS pedido_valor,
  COUNT(j.id) AS jobs_impressora,
  ROUND(SUM(j.area_m2), 2) AS m2_impresso,
  ROUND(SUM(j.custo_tinta_brl), 2) AS custo_tinta_real,
  ROUND(SUM(j.custo_substrato_brl), 2) AS custo_substrato_real,
  ROUND(SUM(j.custo_total_brl), 2) AS custo_impressao_total,
  CASE WHEN p.valor_total > 0
    THEN ROUND((1 - SUM(j.custo_total_brl) / p.valor_total) * 100, 1)
    ELSE 0
  END AS margem_impressao_pct
FROM pedidos p
JOIN impressora_jobs j ON j.pedido_id = p.id
LEFT JOIN clientes c ON p.cliente_id = c.id
WHERE j.estado = 'impresso'
GROUP BY p.id, p.numero, c.nome_fantasia, c.razao_social, p.valor_total;

-- 4. View: custo real por OP
CREATE OR REPLACE VIEW vw_custo_real_por_op AS
SELECT
  op.id AS op_id,
  op.numero AS op_numero,
  op.observacoes,
  p.numero AS pedido_numero,
  COUNT(j.id) AS jobs_impressora,
  ROUND(SUM(j.area_m2), 2) AS m2_impresso,
  ROUND(SUM(j.custo_tinta_brl), 2) AS custo_tinta_real,
  ROUND(SUM(j.custo_substrato_brl), 2) AS custo_substrato_real,
  ROUND(SUM(j.custo_total_brl), 2) AS custo_impressao_total,
  op.custo_mp_real AS custo_op_registrado
FROM ordens_producao op
JOIN impressora_jobs j ON j.ordem_producao_id = op.id
LEFT JOIN pedidos p ON op.pedido_id = p.id
WHERE j.estado = 'impresso'
GROUP BY op.id, op.numero, op.observacoes, p.numero, op.custo_mp_real;

-- 5. Function: atualizar custo real da OP quando job vinculado
CREATE OR REPLACE FUNCTION atualizar_custo_real_op(p_op_id UUID)
RETURNS numeric AS $$
DECLARE
  v_custo numeric;
BEGIN
  SELECT COALESCE(SUM(custo_total_brl), 0)
  INTO v_custo
  FROM impressora_jobs
  WHERE ordem_producao_id = p_op_id
    AND estado = 'impresso';

  UPDATE ordens_producao
  SET custo_mp_real = v_custo
  WHERE id = p_op_id;

  RETURN v_custo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger: auto-atualizar custo da OP ao vincular job
CREATE OR REPLACE FUNCTION trg_job_vinculado_atualiza_custo()
RETURNS trigger AS $$
BEGIN
  IF NEW.ordem_producao_id IS NOT NULL AND
     (OLD.ordem_producao_id IS DISTINCT FROM NEW.ordem_producao_id) THEN
    PERFORM atualizar_custo_real_op(NEW.ordem_producao_id);
  END IF;
  IF OLD.ordem_producao_id IS NOT NULL AND
     OLD.ordem_producao_id IS DISTINCT FROM NEW.ordem_producao_id THEN
    PERFORM atualizar_custo_real_op(OLD.ordem_producao_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_job_vinculado ON impressora_jobs;
CREATE TRIGGER trg_job_vinculado
  AFTER UPDATE OF ordem_producao_id ON impressora_jobs
  FOR EACH ROW EXECUTE FUNCTION trg_job_vinculado_atualiza_custo();

-- RLS
ALTER TABLE impressora_substrato_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read impressora_substrato_map" ON impressora_substrato_map
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write impressora_substrato_map" ON impressora_substrato_map
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
