-- ============================================================
-- Migration 094: Mubisys Features Sprint
-- Features: Depreciação, União Itens, CNH, Avisos, Usinagem, Comissões ext
-- ============================================================

-- ============================================================
-- 1. DEPRECIAÇÃO DE EQUIPAMENTOS + ÁREA ÚTIL
-- ============================================================
ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS data_compra DATE;
ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS valor_compra NUMERIC(12,2);
ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS vida_util_meses INTEGER DEFAULT 60;
ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS saldo_residual_pct NUMERIC(5,2) DEFAULT 30;
ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS area_util_m NUMERIC(8,2);
ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS depreciacao_mensal NUMERIC(12,4) GENERATED ALWAYS AS (
  CASE
    WHEN valor_compra IS NOT NULL AND vida_util_meses > 0
    THEN (valor_compra * (1 - COALESCE(saldo_residual_pct, 30) / 100)) / vida_util_meses
    ELSE 0
  END
) STORED;

-- ============================================================
-- 2. UNIÃO DE ITENS NO ORÇAMENTO
-- ============================================================
ALTER TABLE proposta_itens ADD COLUMN IF NOT EXISTS grupo_uniao TEXT;
ALTER TABLE proposta_itens ADD COLUMN IF NOT EXISTS nome_exibicao TEXT;
ALTER TABLE proposta_itens ADD COLUMN IF NOT EXISTS item_visivel BOOLEAN DEFAULT true;

-- ============================================================
-- 3. CNH VALIDADE EM PROFILES
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cnh_numero TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cnh_validade DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cnh_categoria TEXT;

-- ============================================================
-- 4. QUADRO DE AVISOS INTERNOS
-- ============================================================
CREATE TABLE IF NOT EXISTS quadro_avisos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT DEFAULT 'aviso' CHECK (tipo IN ('aviso', 'alerta')),
  grupo_destino TEXT[] DEFAULT '{}',
  data_inicio TIMESTAMPTZ DEFAULT now(),
  data_fim TIMESTAMPTZ,
  fixo BOOLEAN DEFAULT false,
  criado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE quadro_avisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quadro_avisos_select" ON quadro_avisos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "quadro_avisos_insert" ON quadro_avisos
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gerente', 'diretor'))
  );

CREATE POLICY "quadro_avisos_update" ON quadro_avisos
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gerente', 'diretor'))
  );

CREATE POLICY "quadro_avisos_delete" ON quadro_avisos
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gerente', 'diretor'))
  );

CREATE INDEX IF NOT EXISTS idx_quadro_avisos_vigencia ON quadro_avisos(data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_quadro_avisos_tipo ON quadro_avisos(tipo);

-- ============================================================
-- 5. USINAGEM CNC GRANULAR
-- ============================================================
CREATE TABLE IF NOT EXISTS usinagem_tempos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maquina_id UUID NOT NULL REFERENCES maquinas(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
  tipo_operacao TEXT NOT NULL CHECK (tipo_operacao IN ('corte', 'vinco', 'rebaixo', 'gravacao')),
  tempo_metro_linear_min NUMERIC(8,2) NOT NULL,
  custo_hora_operacao NUMERIC(12,4),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(maquina_id, material_id, tipo_operacao)
);

ALTER TABLE usinagem_tempos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usinagem_tempos_select" ON usinagem_tempos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "usinagem_tempos_manage" ON usinagem_tempos
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gerente', 'producao'))
  );

CREATE INDEX IF NOT EXISTS idx_usinagem_maquina ON usinagem_tempos(maquina_id);
CREATE INDEX IF NOT EXISTS idx_usinagem_material ON usinagem_tempos(material_id);

-- ============================================================
-- 6. COMISSIONADOS EXTERNO/ABSORVER
-- ============================================================
ALTER TABLE comissoes ADD COLUMN IF NOT EXISTS tipo_comissionado TEXT DEFAULT 'interno'
  CHECK (tipo_comissionado IN ('interno', 'externo'));
ALTER TABLE comissoes ADD COLUMN IF NOT EXISTS absorver_comissao BOOLEAN DEFAULT false;

ALTER TABLE propostas ADD COLUMN IF NOT EXISTS comissionado_externo_id UUID REFERENCES profiles(id);
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS comissao_externa_pct NUMERIC(5,2);
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS absorver_comissao BOOLEAN DEFAULT false;

-- ============================================================
-- 7. RPC: Avisos vigentes para o usuário
-- ============================================================
CREATE OR REPLACE FUNCTION get_avisos_vigentes(p_role TEXT)
RETURNS SETOF quadro_avisos
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT * FROM quadro_avisos
  WHERE (data_inicio IS NULL OR data_inicio <= now())
    AND (data_fim IS NULL OR data_fim >= now())
    AND (grupo_destino = '{}' OR p_role = ANY(grupo_destino))
  ORDER BY
    CASE WHEN tipo = 'alerta' THEN 0 ELSE 1 END,
    created_at DESC;
$$;

-- ============================================================
-- 8. RPC: Calcular depreciação restante de uma máquina
-- ============================================================
CREATE OR REPLACE FUNCTION get_depreciacao_maquina(p_maquina_id UUID)
RETURNS TABLE(
  depreciacao_mensal NUMERIC,
  depreciacao_acumulada NUMERIC,
  valor_residual_atual NUMERIC,
  meses_restantes INTEGER,
  percentual_depreciado NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    m.depreciacao_mensal,
    CASE
      WHEN m.data_compra IS NOT NULL
      THEN LEAST(
        m.depreciacao_mensal * EXTRACT(MONTH FROM age(now(), m.data_compra::timestamp))::INTEGER,
        m.valor_compra * (1 - COALESCE(m.saldo_residual_pct, 30) / 100)
      )
      ELSE 0
    END AS depreciacao_acumulada,
    CASE
      WHEN m.valor_compra IS NOT NULL
      THEN GREATEST(
        m.valor_compra - (m.depreciacao_mensal * EXTRACT(MONTH FROM age(now(), m.data_compra::timestamp))::INTEGER),
        m.valor_compra * COALESCE(m.saldo_residual_pct, 30) / 100
      )
      ELSE 0
    END AS valor_residual_atual,
    CASE
      WHEN m.data_compra IS NOT NULL AND m.vida_util_meses > 0
      THEN GREATEST(
        m.vida_util_meses - EXTRACT(MONTH FROM age(now(), m.data_compra::timestamp))::INTEGER,
        0
      )
      ELSE 0
    END AS meses_restantes,
    CASE
      WHEN m.valor_compra IS NOT NULL AND m.valor_compra > 0
      THEN LEAST(
        (EXTRACT(MONTH FROM age(now(), m.data_compra::timestamp))::INTEGER * 100.0) / m.vida_util_meses,
        100
      )
      ELSE 0
    END AS percentual_depreciado
  FROM maquinas m
  WHERE m.id = p_maquina_id;
$$;
