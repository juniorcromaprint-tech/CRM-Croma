-- =============================================================================
-- Migration 113: Tabela impressora_jobs — dados de produção da HP Latex 365
-- Vincula jobs de impressão aos pedidos do CRM para custeio real
--
-- MODELO DE CUSTEIO: "LM Âncora"
-- A Croma usa tinta paralela (bag 3L a R$1.560,00 → R$0,52/ml).
-- O firmware HP bloqueia telemetria de 6 das 7 cores. Apenas LM (Magenta Claro)
-- mantém cartucho original e reporta ml reais. O consumo total é estimado via
-- proporções históricas relativas ao LM (fator: 21,5316).
-- Fallback: consumo médio histórico de 9,86 ml/m² quando LM não está disponível.
-- =============================================================================

-- Tabela principal: cada linha = 1 job enviado para a impressora
CREATE TABLE IF NOT EXISTS impressora_jobs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Dados do EWS (extraídos automaticamente)
  documento       TEXT NOT NULL,                     -- nome do arquivo impresso
  estado          TEXT NOT NULL DEFAULT 'impresso',  -- impresso, cancelado, cancelado_usuario
  area_m2         NUMERIC(10,4) NOT NULL DEFAULT 0,
  substrato       TEXT,                              -- ex: "Vinil fosco sp media sm790"
  modo_impressao  TEXT,                              -- ex: "600dpi - 12P - Bidi - 60ips - Ink-100 - OE"
  data_impressao  TIMESTAMPTZ NOT NULL,              -- quando foi impresso (do EWS)

  -- Tinta — modelo LM Âncora
  tinta_status    TEXT DEFAULT 'alterada',           -- 'normal' ou 'alterada' (paralela)
  lm_ml_real      NUMERIC(10,3),                     -- ml LM medidos pelo EWS (âncora)
  tinta_total_estimada_ml NUMERIC(10,3) DEFAULT 0,   -- lm_ml_real × 21.5316 ou area × 9.86
  metodo_custeio  TEXT DEFAULT 'LM_ancora',          -- 'LM_ancora' ou 'media_historica'

  -- Custos calculados (tinta paralela a R$0,52/ml)
  custo_tinta_brl      NUMERIC(10,2) DEFAULT 0,
  custo_substrato_brl  NUMERIC(10,2) DEFAULT 0,
  custo_total_brl      NUMERIC(10,2) DEFAULT 0,
  custo_por_m2_tinta   NUMERIC(10,2) DEFAULT 0,     -- custo de tinta / área (KPI de eficiência)

  -- Vínculo com CRM
  cliente_extraido TEXT,                             -- nome extraído do arquivo (fallback)
  cliente_id       UUID REFERENCES clientes(id),     -- vínculo real com cliente
  pedido_id        UUID REFERENCES pedidos(id),      -- vínculo com pedido
  ordem_producao_id UUID REFERENCES ordens_producao(id),

  -- Detalhes de tinta por cor (JSONB para flexibilidade)
  tintas_detalhe  JSONB DEFAULT '{}',               -- {"M": {"ml": null, "status": "alterada"}, "LM": {"ml": 0.68, "status": "normal"}, ...}

  -- Alertas gerados automaticamente
  alertas         TEXT[] DEFAULT '{}',               -- array de alertas (anomalias, cancelamento, etc.)

  -- Metadados de coleta
  printer_ip      TEXT DEFAULT '192.168.0.136',
  coletado_em     TIMESTAMPTZ DEFAULT NOW(),         -- quando o script coletou
  hash_job        TEXT UNIQUE,                       -- hash para deduplicação (documento+data+area)

  -- Audit
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_impressora_jobs_data ON impressora_jobs(data_impressao DESC);
CREATE INDEX IF NOT EXISTS idx_impressora_jobs_pedido ON impressora_jobs(pedido_id) WHERE pedido_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_impressora_jobs_cliente ON impressora_jobs(cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_impressora_jobs_estado ON impressora_jobs(estado);
CREATE INDEX IF NOT EXISTS idx_impressora_jobs_hash ON impressora_jobs(hash_job);
CREATE INDEX IF NOT EXISTS idx_impressora_jobs_cliente_extraido ON impressora_jobs(cliente_extraido);

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION update_impressora_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_impressora_jobs_updated_at
  BEFORE UPDATE ON impressora_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_impressora_jobs_updated_at();

-- RLS
ALTER TABLE impressora_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "impressora_jobs_select_authenticated" ON impressora_jobs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "impressora_jobs_insert_authenticated" ON impressora_jobs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "impressora_jobs_update_authenticated" ON impressora_jobs
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ─── TABELA DE CONFIGURAÇÃO DE CUSTEIO ──────────────────────────────────────
-- Armazena os parâmetros que o script usa para calcular custos.
-- Permite atualizar preços sem alterar código.

CREATE TABLE IF NOT EXISTS impressora_config (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chave           TEXT UNIQUE NOT NULL,
  valor           NUMERIC(12,4) NOT NULL,
  descricao       TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE impressora_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "impressora_config_select_auth" ON impressora_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "impressora_config_all_auth" ON impressora_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed dos parâmetros atuais
INSERT INTO impressora_config (chave, valor, descricao) VALUES
  ('preco_bag_brl', 1560.00, 'Preço do bag de tinta paralela (3 litros)'),
  ('volume_bag_ml', 3000, 'Volume do bag em ml'),
  ('preco_por_ml', 0.52, 'Custo por ml (bag_preco / bag_volume)'),
  ('volume_cartucho_ml', 775, 'Volume do cartucho HP reutilizado'),
  ('fator_total_sobre_lm', 21.5316, 'Fator multiplicador do LM para tinta total'),
  ('consumo_medio_ml_m2', 9.86, 'Consumo médio histórico (fallback se LM indisponível)'),
  ('substrato_sm790_custo_m2', 7.00, 'Custo/m² do Vinil fosco SM790 (ATUALIZAR com fornecedor)'),
  ('substrato_bagum_custo_m2', 4.86, 'Custo/m² do Bagum'),
  ('substrato_ritrama_custo_m2', 8.50, 'Custo/m² do Ritrama Fosco'),
  ('substrato_avery_custo_m2', 6.40, 'Custo/m² do Avery Fosco'),
  ('substrato_pet_custo_m2', 15.00, 'Custo/m² do Filme PET PP')
ON CONFLICT (chave) DO NOTHING;

-- ─── PROPORÇÕES DE TINTA RELATIVAS AO LM ───────────────────────────────────
-- Derivadas do histórico de 9.976 m² / 98.368 ml acumulados na máquina

CREATE TABLE IF NOT EXISTS impressora_proporcoes_tinta (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cor_codigo      TEXT UNIQUE NOT NULL,   -- M, LM, LC, C, OP, Y, K
  cor_nome        TEXT NOT NULL,
  proporcao_lm    NUMERIC(8,4) NOT NULL,  -- fator relativo ao LM
  ml_historico    NUMERIC(12,2),          -- ml acumulado total
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE impressora_proporcoes_tinta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proporcoes_select_auth" ON impressora_proporcoes_tinta
  FOR SELECT TO authenticated USING (true);

INSERT INTO impressora_proporcoes_tinta (cor_codigo, cor_nome, proporcao_lm, ml_historico) VALUES
  ('M',  'Magenta',                5.7447, 26244.83),
  ('LM', 'Magenta Claro',         1.0000,  4568.55),
  ('LC', 'Ciano Claro',           0.8521,  3893.07),
  ('C',  'Ciano',                 3.5775, 16343.98),
  ('OP', 'Otimizador para Látex', 2.3980, 10955.45),
  ('Y',  'Amarelo',               5.3389, 24391.00),
  ('K',  'Preto',                 2.6204, 11971.45)
ON CONFLICT (cor_codigo) DO NOTHING;

-- ─── VIEW: RESUMO DIÁRIO DE PRODUÇÃO ────────────────────────────────────────

CREATE OR REPLACE VIEW vw_impressora_resumo_diario AS
SELECT
  DATE(data_impressao) AS dia,
  COUNT(*) FILTER (WHERE estado = 'impresso') AS jobs_impressos,
  COUNT(*) FILTER (WHERE estado != 'impresso') AS jobs_cancelados,
  COALESCE(SUM(area_m2) FILTER (WHERE estado = 'impresso'), 0) AS m2_impressos,
  COALESCE(SUM(area_m2) FILTER (WHERE estado != 'impresso'), 0) AS m2_cancelados,
  COALESCE(SUM(tinta_total_estimada_ml) FILTER (WHERE estado = 'impresso'), 0) AS tinta_ml,
  COALESCE(SUM(custo_tinta_brl) FILTER (WHERE estado = 'impresso'), 0) AS custo_tinta,
  COALESCE(SUM(custo_substrato_brl) FILTER (WHERE estado = 'impresso'), 0) AS custo_substrato,
  COALESCE(SUM(custo_total_brl) FILTER (WHERE estado = 'impresso'), 0) AS custo_total,
  COUNT(DISTINCT cliente_extraido) AS clientes_distintos,
  COUNT(*) FILTER (WHERE pedido_id IS NOT NULL) AS jobs_vinculados,
  COUNT(*) FILTER (WHERE pedido_id IS NULL AND estado = 'impresso') AS jobs_sem_vinculo
FROM impressora_jobs
GROUP BY DATE(data_impressao)
ORDER BY dia DESC;

-- ─── VIEW: RESUMO POR CLIENTE ───────────────────────────────────────────────

CREATE OR REPLACE VIEW vw_impressora_resumo_cliente AS
SELECT
  COALESCE(cliente_extraido, 'DESCONHECIDO') AS cliente,
  cliente_id,
  COUNT(*) FILTER (WHERE estado = 'impresso') AS jobs_impressos,
  COALESCE(SUM(area_m2) FILTER (WHERE estado = 'impresso'), 0) AS m2_total,
  COALESCE(SUM(custo_total_brl) FILTER (WHERE estado = 'impresso'), 0) AS custo_total,
  MIN(data_impressao) AS primeiro_job,
  MAX(data_impressao) AS ultimo_job
FROM impressora_jobs
GROUP BY cliente_extraido, cliente_id
ORDER BY m2_total DESC;

-- Comentários
COMMENT ON TABLE impressora_jobs IS 'Jobs de impressão coletados do EWS da HP Latex 365 — modelo LM Âncora';
COMMENT ON TABLE impressora_config IS 'Parâmetros de custeio da impressora (preços tinta/substrato, fator LM)';
COMMENT ON TABLE impressora_proporcoes_tinta IS 'Proporções relativas de consumo de cada cor vs LM (âncora)';
COMMENT ON COLUMN impressora_jobs.lm_ml_real IS 'ml de LM (Magenta Claro) medidos pelo EWS — único cartucho original';
COMMENT ON COLUMN impressora_jobs.metodo_custeio IS 'LM_ancora = lm_ml × 21.5316; media_historica = area × 9.86 ml/m²';
COMMENT ON COLUMN impressora_jobs.custo_por_m2_tinta IS 'KPI: custo de tinta por m² — normal: R$1-2/m², anomalia > R$5/m²';
COMMENT ON VIEW vw_impressora_resumo_diario IS 'Resumo diário de produção da impressora para dashboard';
COMMENT ON VIEW vw_impressora_resumo_cliente IS 'Resumo de produção por cliente para análise comercial';
