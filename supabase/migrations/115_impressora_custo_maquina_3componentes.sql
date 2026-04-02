-- Migration 115: Modelo de custo com 3 componentes (tinta + substrato + máquina consumíveis)
-- custo_maquina_brl = area_m2 × maquinas.custo_m2 (R$2,40/m²)
-- Inclui: depreciação, cabeçotes de impressão, cartucho de manutenção
-- NÃO inclui tinta nem substrato (calculados separadamente)
-- Adicionada em 2026-04-02

-- 1. Adicionar coluna custo_maquina_brl
ALTER TABLE impressora_jobs
  ADD COLUMN IF NOT EXISTS custo_maquina_brl numeric DEFAULT 0;

COMMENT ON COLUMN impressora_jobs.custo_maquina_brl IS
  'Custo de consumíveis da máquina (cabeçotes, cartucho manutenção, depreciação) = area_m2 × maquinas.custo_m2';

-- 2. Adicionar config custo_maquina_m2
INSERT INTO impressora_config (chave, valor, descricao)
VALUES ('custo_maquina_m2', '2.4000', 'Custo/m² de consumíveis da máquina (depreciação + cabeçotes + cartucho manutenção)')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, descricao = EXCLUDED.descricao, updated_at = now();

-- 3. Retroativamente calcular custo_maquina_brl para jobs existentes
-- custo_total agora = tinta + substrato + máquina
UPDATE impressora_jobs
SET custo_maquina_brl = ROUND(area_m2 * 2.40, 2),
    custo_total_brl = ROUND(custo_tinta_brl + custo_substrato_brl + (area_m2 * 2.40), 2)
WHERE custo_maquina_brl = 0 OR custo_maquina_brl IS NULL;

-- 4. Recriar views com 3 componentes
DROP VIEW IF EXISTS vw_custo_real_por_pedido;
CREATE VIEW vw_custo_real_por_pedido AS
SELECT
  p.id AS pedido_id,
  p.numero AS pedido_numero,
  COALESCE(c.nome_fantasia, c.razao_social) AS cliente,
  p.valor_total AS pedido_valor,
  COUNT(j.id) AS jobs_impressora,
  ROUND(SUM(j.area_m2), 2) AS m2_impresso,
  ROUND(SUM(j.custo_tinta_brl), 2) AS custo_tinta_real,
  ROUND(SUM(j.custo_substrato_brl), 2) AS custo_substrato_real,
  ROUND(SUM(j.custo_maquina_brl), 2) AS custo_maquina_real,
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

DROP VIEW IF EXISTS vw_custo_real_por_op;
CREATE VIEW vw_custo_real_por_op AS
SELECT
  op.id AS op_id,
  op.numero AS op_numero,
  op.observacoes,
  p.numero AS pedido_numero,
  COUNT(j.id) AS jobs_impressora,
  ROUND(SUM(j.area_m2), 2) AS m2_impresso,
  ROUND(SUM(j.custo_tinta_brl), 2) AS custo_tinta_real,
  ROUND(SUM(j.custo_substrato_brl), 2) AS custo_substrato_real,
  ROUND(SUM(j.custo_maquina_brl), 2) AS custo_maquina_real,
  ROUND(SUM(j.custo_total_brl), 2) AS custo_impressao_total,
  op.custo_mp_real AS custo_op_registrado
FROM ordens_producao op
JOIN impressora_jobs j ON j.ordem_producao_id = op.id
LEFT JOIN pedidos p ON op.pedido_id = p.id
WHERE j.estado = 'impresso'
GROUP BY op.id, op.numero, op.observacoes, p.numero, op.custo_mp_real;

-- 5. Recriar function atualizar_custo_real_op
DROP FUNCTION IF EXISTS atualizar_custo_real_op(UUID);
CREATE FUNCTION atualizar_custo_real_op(p_op_id UUID)
RETURNS void AS $$
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
