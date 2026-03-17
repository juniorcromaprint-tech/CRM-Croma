-- =============================================
-- 064: parcelas_receber + views financeiras
-- =============================================

-- 1. Tabela parcelas_receber
CREATE TABLE IF NOT EXISTS parcelas_receber (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_receber_id UUID NOT NULL REFERENCES contas_receber(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  valor_pago NUMERIC(12,2) DEFAULT 0,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','parcial','pago','cancelado')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcelas_receber_conta ON parcelas_receber(conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_receber_vencimento ON parcelas_receber(data_vencimento, status);

-- Trigger updated_at
DROP TRIGGER IF EXISTS tr_parcelas_receber_updated ON parcelas_receber;
CREATE TRIGGER tr_parcelas_receber_updated
  BEFORE UPDATE ON parcelas_receber
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE parcelas_receber ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parcelas_receber_select" ON parcelas_receber;
CREATE POLICY "parcelas_receber_select"
  ON parcelas_receber FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "parcelas_receber_insert" ON parcelas_receber;
CREATE POLICY "parcelas_receber_insert"
  ON parcelas_receber FOR INSERT TO authenticated
  WITH CHECK (
    is_admin() OR get_user_role() IN ('financeiro','gerente','comercial')
  );

DROP POLICY IF EXISTS "parcelas_receber_update" ON parcelas_receber;
CREATE POLICY "parcelas_receber_update"
  ON parcelas_receber FOR UPDATE TO authenticated
  USING (
    is_admin() OR get_user_role() IN ('financeiro','gerente')
  );

-- 2. View: Aging de Recebíveis
CREATE OR REPLACE VIEW v_aging_receber AS
WITH cr_abertas AS (
  SELECT
    id,
    cliente_id,
    valor_original,
    valor_pago,
    saldo,
    data_vencimento,
    CURRENT_DATE - data_vencimento AS dias_atraso
  FROM contas_receber
  WHERE status NOT IN ('pago','cancelado')
    AND excluido_em IS NULL
)
SELECT
  cliente_id,
  SUM(CASE WHEN dias_atraso <= 0 THEN saldo ELSE 0 END) AS a_vencer,
  SUM(CASE WHEN dias_atraso BETWEEN 1 AND 30 THEN saldo ELSE 0 END) AS d1_30,
  SUM(CASE WHEN dias_atraso BETWEEN 31 AND 60 THEN saldo ELSE 0 END) AS d31_60,
  SUM(CASE WHEN dias_atraso BETWEEN 61 AND 90 THEN saldo ELSE 0 END) AS d61_90,
  SUM(CASE WHEN dias_atraso > 90 THEN saldo ELSE 0 END) AS d90_mais,
  SUM(saldo) AS total_aberto,
  MAX(dias_atraso) AS maior_atraso
FROM cr_abertas
GROUP BY cliente_id;

-- 3. View: Inadimplentes (>30 dias vencido)
CREATE OR REPLACE VIEW v_inadimplentes AS
SELECT DISTINCT
  c.id AS cliente_id,
  c.nome_fantasia,
  c.razao_social,
  ag.total_aberto,
  ag.maior_atraso,
  ag.d1_30 + ag.d31_60 + ag.d61_90 + ag.d90_mais AS total_vencido
FROM v_aging_receber ag
JOIN clientes c ON c.id = ag.cliente_id
WHERE ag.maior_atraso > 30;

-- 4. View: Fluxo de Caixa Projetado
CREATE OR REPLACE VIEW v_fluxo_caixa_projetado AS
WITH entradas AS (
  SELECT
    data_vencimento AS data,
    SUM(saldo) AS valor,
    'entrada'::text AS tipo
  FROM contas_receber
  WHERE status NOT IN ('pago','cancelado')
    AND excluido_em IS NULL
    AND data_vencimento >= CURRENT_DATE
  GROUP BY data_vencimento
),
saidas AS (
  SELECT
    data_vencimento AS data,
    SUM(saldo) AS valor,
    'saida'::text AS tipo
  FROM contas_pagar
  WHERE status NOT IN ('pago','cancelado')
    AND excluido_em IS NULL
    AND data_vencimento >= CURRENT_DATE
  GROUP BY data_vencimento
)
SELECT * FROM entradas
UNION ALL
SELECT * FROM saidas
ORDER BY data, tipo;

-- 5. Índices para performance das views
CREATE INDEX IF NOT EXISTS idx_cr_vencimento_status
  ON contas_receber(data_vencimento, status)
  WHERE excluido_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_cp_vencimento_status
  ON contas_pagar(data_vencimento, status)
  WHERE excluido_em IS NULL;
