-- Migration 116: Monitoramento de consumiveis (cartuchos, cabecotes, cartucho manutencao)
-- Dados coletados de ConsumableConfigDyn.xml via EWS da HP Latex 365
-- Adicionada em 2026-04-02

-- 1. Tabela principal de consumiveis
CREATE TABLE IF NOT EXISTS impressora_consumiveis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  maquina_id UUID REFERENCES maquinas(id),

  -- Identificacao do consumivel
  tipo TEXT NOT NULL,             -- 'ink', 'printhead', 'maintenance'
  label_code TEXT NOT NULL,       -- cor/posicao: 'M', 'LM', 'C', 'LC', 'Y', 'K', 'OP', etc.
  station TEXT,                   -- slot/estacao na impressora
  content_type TEXT,              -- tipo de conteudo (ex: 'inkDye', 'inkPigment')
  product_number TEXT,            -- part number HP (ex: 'G0Y88A')
  serial_number TEXT,             -- serial do cartucho/cabecote

  -- Estado (CRUCIAL para monitoramento)
  consumable_state TEXT,          -- 'ok', 'refilledColor', 'nonHP', 'expired', 'unknown'
  measured_state TEXT,            -- 'unknown', 'ok', etc.

  -- Nivel e capacidade
  level_pct INTEGER,              -- 0-100, percentual restante
  nivel_confiavel BOOLEAN DEFAULT false, -- true se measured_state != 'unknown'; cartuchos recarregados (refilledColor) nao reportam nivel real
  max_capacity NUMERIC,           -- capacidade maxima (ml, paginas, etc.)
  capacity_unit TEXT,             -- 'milliliters', 'impressions', etc.

  -- Datas
  manufacture_date DATE,          -- data de fabricacao
  installation_date DATE,         -- data de instalacao no equipamento
  expiration_date DATE,           -- data de validade

  -- Fabricante e garantia
  manufacturer TEXT,              -- fabricante (normalmente 'Hewlett-Packard')
  warranty_status TEXT,           -- 'inWarranty', 'outOfWarranty', etc.

  -- Controle
  coletado_em TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Deduplicacao: mesmo consumivel na mesma maquina
  UNIQUE(maquina_id, tipo, label_code)
);

-- 2. Historico de nivel (para graficos de consumo ao longo do tempo)
CREATE TABLE IF NOT EXISTS impressora_consumiveis_historico (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  consumivel_id UUID REFERENCES impressora_consumiveis(id) ON DELETE CASCADE,
  level_pct INTEGER,
  consumable_state TEXT,
  coletado_em TIMESTAMPTZ DEFAULT now()
);

-- 3. Indices
CREATE INDEX IF NOT EXISTS idx_consumiveis_maquina ON impressora_consumiveis(maquina_id);
CREATE INDEX IF NOT EXISTS idx_consumiveis_tipo ON impressora_consumiveis(tipo, label_code);
CREATE INDEX IF NOT EXISTS idx_consumiveis_state ON impressora_consumiveis(consumable_state);
CREATE INDEX IF NOT EXISTS idx_consumiveis_hist_id ON impressora_consumiveis_historico(consumivel_id);
CREATE INDEX IF NOT EXISTS idx_consumiveis_hist_data ON impressora_consumiveis_historico(coletado_em);

-- 4. RLS
ALTER TABLE impressora_consumiveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE impressora_consumiveis_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consumiveis visivel para autenticados"
  ON impressora_consumiveis FOR SELECT TO authenticated USING (true);

CREATE POLICY "Consumiveis insert service"
  ON impressora_consumiveis FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Consumiveis update service"
  ON impressora_consumiveis FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Historico visivel para autenticados"
  ON impressora_consumiveis_historico FOR SELECT TO authenticated USING (true);

CREATE POLICY "Historico insert service"
  ON impressora_consumiveis_historico FOR INSERT TO authenticated WITH CHECK (true);

-- 5. Tabela de recargas (registro manual de quando encheu cada cartucho)
-- Permite calcular: volume_restante = ml_injetado - SUM(consumo_cor desde recarga)
CREATE TABLE IF NOT EXISTS impressora_recargas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  maquina_id UUID REFERENCES maquinas(id),
  label_code TEXT NOT NULL,              -- cor: 'M', 'LM', 'C', 'LC', 'Y', 'K', 'OP'
  ml_injetado NUMERIC NOT NULL DEFAULT 800, -- volume injetado (padrao 800ml por cartucho)
  data_recarga TIMESTAMPTZ NOT NULL DEFAULT now(),
  observacoes TEXT,                      -- ex: "bag 3L lote X", "segundo enchimento"
  created_at TIMESTAMPTZ DEFAULT now(),
  ativo BOOLEAN DEFAULT true             -- false quando o cartucho foi substituido/recarregado novamente
);

CREATE INDEX IF NOT EXISTS idx_recargas_maquina_cor ON impressora_recargas(maquina_id, label_code, ativo);
CREATE INDEX IF NOT EXISTS idx_recargas_data ON impressora_recargas(data_recarga);

ALTER TABLE impressora_recargas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recargas visivel para autenticados"
  ON impressora_recargas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Recargas insert service"
  ON impressora_recargas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Recargas update service"
  ON impressora_recargas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE impressora_recargas IS 'Registro de recargas de cartuchos HP Latex — permite estimar ml restante por cor';
COMMENT ON COLUMN impressora_recargas.ml_injetado IS 'Volume injetado no cartucho. Padrao 800ml (cartucho HP 775ml + margem). Tinta HP original de bag 3L.';
COMMENT ON COLUMN impressora_recargas.ativo IS 'false quando cartucho foi recarregado novamente (recarga anterior encerrada)';

-- 5b. View de nivel estimado por cor (volume restante = injetado - consumido desde recarga)
-- Consumo por cor derivado do modelo LM Ancora: lm_ml_real × proporcao_cor
CREATE OR REPLACE VIEW vw_nivel_cartuchos AS
WITH recarga_ativa AS (
  SELECT
    r.id AS recarga_id,
    r.maquina_id,
    r.label_code,
    r.ml_injetado,
    r.data_recarga
  FROM impressora_recargas r
  WHERE r.ativo = true
),
proporcoes AS (
  -- Proporcoes fixas do modelo LM Ancora (derivadas de 9.976 m2 / 98.368 ml)
  SELECT unnest(ARRAY['M','LM','LC','C','OP','Y','K']) AS cor,
         unnest(ARRAY[5.7447, 1.0000, 0.8521, 3.5775, 2.3980, 5.3389, 2.6204]) AS fator
),
fator_total AS (
  SELECT SUM(fator) AS total FROM proporcoes  -- 21.5316
),
consumo_por_cor AS (
  SELECT
    ra.recarga_id,
    ra.maquina_id,
    ra.label_code,
    ra.ml_injetado,
    ra.data_recarga,
    COALESCE(SUM(
      CASE
        WHEN j.lm_ml_real IS NOT NULL AND j.lm_ml_real > 0
          THEN j.lm_ml_real * p.fator
        ELSE j.area_m2 * 9.86 * (p.fator / ft.total)
      END
    ), 0) AS ml_consumido,
    COUNT(j.id) AS jobs_desde_recarga
  FROM recarga_ativa ra
  CROSS JOIN proporcoes p
  CROSS JOIN fator_total ft
  LEFT JOIN impressora_jobs j
    ON j.maquina_id = ra.maquina_id
    AND j.data_impressao >= ra.data_recarga
    AND j.estado = 'impresso'
  WHERE p.cor = ra.label_code
  GROUP BY ra.recarga_id, ra.maquina_id, ra.label_code, ra.ml_injetado, ra.data_recarga
)
SELECT
  maquina_id,
  label_code AS cor,
  ml_injetado,
  ROUND(ml_consumido, 1) AS ml_consumido,
  ROUND(GREATEST(ml_injetado - ml_consumido, 0), 1) AS ml_restante,
  ROUND(GREATEST((ml_injetado - ml_consumido) / NULLIF(ml_injetado, 0) * 100, 0), 0) AS pct_restante,
  jobs_desde_recarga,
  data_recarga,
  recarga_id
FROM consumo_por_cor;

COMMENT ON VIEW vw_nivel_cartuchos IS 'Nivel estimado de tinta por cor — baseado em volume injetado menos consumo calculado pelo modelo LM Ancora';

-- 6. Trigger updated_at
CREATE TRIGGER trg_consumiveis_updated_at
  BEFORE UPDATE ON impressora_consumiveis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 6. Comentarios
COMMENT ON TABLE impressora_consumiveis IS 'Estado atual dos consumiveis da impressora (cartuchos, cabecotes, manutencao)';
COMMENT ON TABLE impressora_consumiveis_historico IS 'Historico de nivel dos consumiveis para graficos de consumo';
COMMENT ON COLUMN impressora_consumiveis.consumable_state IS 'ok=HP original, refilledColor=HP recarregado, nonHP=nao-HP, expired=vencido';
COMMENT ON COLUMN impressora_consumiveis.nivel_confiavel IS 'false para cartuchos recarregados (refilledColor) — HP nao mede nivel real quando detecta recarga. Nivel real estimado pelo modelo LM Ancora no custeio.';
