-- 070_modulo_contabil.sql
-- Módulo Contábil: lançamentos, DAS, extrato bancário, config tributária

-- 1. Expandir plano_contas para incluir ativo/passivo/patrimonio
ALTER TABLE plano_contas DROP CONSTRAINT IF EXISTS plano_contas_tipo_check;
ALTER TABLE plano_contas ADD CONSTRAINT plano_contas_tipo_check
  CHECK (tipo IN ('ativo', 'passivo', 'receita', 'despesa', 'patrimonio'));

-- 2. Tabela de lançamentos contábeis (partida dobrada)
CREATE TABLE IF NOT EXISTS lancamentos_contabeis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_lancamento DATE NOT NULL,
  data_competencia DATE NOT NULL,
  numero_lancamento SERIAL,
  conta_debito_id UUID NOT NULL REFERENCES plano_contas(id),
  conta_credito_id UUID NOT NULL REFERENCES plano_contas(id),
  valor NUMERIC(15,2) NOT NULL CHECK (valor > 0),
  historico TEXT NOT NULL,
  origem_tipo VARCHAR(20) NOT NULL CHECK (origem_tipo IN ('conta_receber', 'conta_pagar', 'extrato', 'manual', 'das', 'pro_labore')),
  origem_id UUID,
  centro_custo_id UUID REFERENCES centros_custo(id),
  conciliado BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lancamentos_data ON lancamentos_contabeis(data_lancamento);
CREATE INDEX IF NOT EXISTS idx_lancamentos_competencia ON lancamentos_contabeis(data_competencia);
CREATE INDEX IF NOT EXISTS idx_lancamentos_debito ON lancamentos_contabeis(conta_debito_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_credito ON lancamentos_contabeis(conta_credito_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_origem ON lancamentos_contabeis(origem_tipo, origem_id);

-- RLS
ALTER TABLE lancamentos_contabeis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lancamentos_select_authenticated" ON lancamentos_contabeis
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "lancamentos_insert_financeiro" ON lancamentos_contabeis
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'diretor', 'financeiro')
    )
    OR
    (SELECT is_admin())
  );

CREATE POLICY "lancamentos_update_financeiro" ON lancamentos_contabeis
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'diretor', 'financeiro')
    )
    OR
    (SELECT is_admin())
  );

-- 3. Tabela de apurações DAS
CREATE TABLE IF NOT EXISTS das_apuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia DATE NOT NULL UNIQUE,
  receita_bruta_mes NUMERIC(15,2) NOT NULL DEFAULT 0,
  rbt12 NUMERIC(15,2) NOT NULL DEFAULT 0,
  folha_pagamento_12m NUMERIC(15,2) NOT NULL DEFAULT 0,
  fator_r NUMERIC(5,4) NOT NULL DEFAULT 0,
  anexo VARCHAR(3) NOT NULL CHECK (anexo IN ('III', 'V')),
  faixa INTEGER NOT NULL CHECK (faixa BETWEEN 1 AND 6),
  aliquota_nominal NUMERIC(5,4) NOT NULL,
  deducao NUMERIC(15,2) NOT NULL DEFAULT 0,
  aliquota_efetiva NUMERIC(5,4) NOT NULL,
  valor_das NUMERIC(15,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'calculado' CHECK (status IN ('calculado', 'conferido', 'pago')),
  data_pagamento DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE das_apuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "das_select_authenticated" ON das_apuracoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "das_write_financeiro" ON das_apuracoes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'diretor', 'financeiro')
    )
    OR (SELECT is_admin())
  );

-- 4. Tabelas de extrato bancário
CREATE TABLE IF NOT EXISTS extrato_bancario_importacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banco VARCHAR(50) NOT NULL,
  conta VARCHAR(30),
  arquivo_nome VARCHAR(255) NOT NULL,
  formato VARCHAR(10) NOT NULL CHECK (formato IN ('ofx', 'csv')),
  data_inicio DATE,
  data_fim DATE,
  total_registros INTEGER DEFAULT 0,
  total_classificados INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'importado' CHECK (status IN ('importado', 'classificando', 'classificado', 'lancado')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS extrato_bancario_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id UUID NOT NULL REFERENCES extrato_bancario_importacoes(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  descricao_original TEXT NOT NULL,
  valor NUMERIC(15,2) NOT NULL,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('credito', 'debito')),
  conta_plano_id UUID REFERENCES plano_contas(id),
  centro_custo_id UUID REFERENCES centros_custo(id),
  confianca_ia NUMERIC(3,2),
  classificado_por VARCHAR(10) CHECK (classificado_por IN ('ia', 'usuario', 'regra')),
  lancamento_id UUID REFERENCES lancamentos_contabeis(id),
  conciliado_com_id UUID,
  conciliado_com_tipo VARCHAR(20),
  ignorado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extrato_itens_importacao ON extrato_bancario_itens(importacao_id);
CREATE INDEX IF NOT EXISTS idx_extrato_itens_data ON extrato_bancario_itens(data);

ALTER TABLE extrato_bancario_importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE extrato_bancario_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "extrato_imp_select" ON extrato_bancario_importacoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "extrato_imp_write" ON extrato_bancario_importacoes
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'diretor', 'financeiro'))
    OR (SELECT is_admin())
  );

CREATE POLICY "extrato_itens_select" ON extrato_bancario_itens
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "extrato_itens_write" ON extrato_bancario_itens
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'diretor', 'financeiro'))
    OR (SELECT is_admin())
  );

-- 5. Regras de classificação automática
CREATE TABLE IF NOT EXISTS extrato_regras_classificacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  padrao TEXT NOT NULL,
  tipo_match VARCHAR(15) DEFAULT 'contains' CHECK (tipo_match IN ('contains', 'starts_with', 'exact')),
  conta_plano_id UUID NOT NULL REFERENCES plano_contas(id),
  centro_custo_id UUID REFERENCES centros_custo(id),
  vezes_usado INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE extrato_regras_classificacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "regras_class_select" ON extrato_regras_classificacao
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "regras_class_write" ON extrato_regras_classificacao
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'diretor', 'financeiro'))
    OR (SELECT is_admin())
  );

-- 6. Configuração tributária
CREATE TABLE IF NOT EXISTS config_tributaria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regime VARCHAR(20) NOT NULL DEFAULT 'simples_nacional',
  pro_labore_mensal NUMERIC(15,2) NOT NULL DEFAULT 0,
  inss_pro_labore_percentual NUMERIC(5,2) DEFAULT 11.00,
  cnae_principal VARCHAR(10),
  anexo_padrao VARCHAR(3) DEFAULT 'V',
  observacoes TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE config_tributaria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_trib_select" ON config_tributaria
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "config_trib_write" ON config_tributaria
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'diretor'))
    OR (SELECT is_admin())
  );

-- Seed config tributária padrão
INSERT INTO config_tributaria (regime, pro_labore_mensal, anexo_padrao)
VALUES ('simples_nacional', 0, 'V')
ON CONFLICT DO NOTHING;

-- 7. Seed plano de contas — contas de ativo/passivo/patrimônio
-- Ativo
INSERT INTO plano_contas (codigo, nome, tipo, natureza) VALUES
('1', 'ATIVO', 'ativo', 'sintetica')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
SELECT '1.1', 'Ativo Circulante', id, 'ativo', 'sintetica'
FROM plano_contas WHERE codigo = '1'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
SELECT '1.1.01', 'Caixa', id, 'ativo', 'analitica'
FROM plano_contas WHERE codigo = '1.1'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
SELECT '1.1.02', 'Banco Itaú', id, 'ativo', 'analitica'
FROM plano_contas WHERE codigo = '1.1'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
SELECT '1.1.03', 'Clientes a Receber', id, 'ativo', 'analitica'
FROM plano_contas WHERE codigo = '1.1'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
SELECT '1.2', 'Ativo Não Circulante', id, 'ativo', 'sintetica'
FROM plano_contas WHERE codigo = '1'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
SELECT '1.2.01', 'Imobilizado', id, 'ativo', 'analitica'
FROM plano_contas WHERE codigo = '1.2'
ON CONFLICT (codigo) DO NOTHING;

-- Passivo
INSERT INTO plano_contas (codigo, nome, tipo, natureza) VALUES
('2', 'PASSIVO', 'passivo', 'sintetica')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
SELECT '2.1', 'Passivo Circulante', id, 'passivo', 'sintetica'
FROM plano_contas WHERE codigo = '2'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
SELECT '2.1.01', 'Fornecedores a Pagar', id, 'passivo', 'analitica'
FROM plano_contas WHERE codigo = '2.1'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
SELECT '2.1.02', 'DAS a Pagar', id, 'passivo', 'analitica'
FROM plano_contas WHERE codigo = '2.1'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
SELECT '2.1.03', 'Comissões a Pagar', id, 'passivo', 'analitica'
FROM plano_contas WHERE codigo = '2.1'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
SELECT '2.1.04', 'Pró-labore a Pagar', id, 'passivo', 'analitica'
FROM plano_contas WHERE codigo = '2.1'
ON CONFLICT (codigo) DO NOTHING;

-- Patrimônio Líquido
INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
SELECT '2.2', 'Patrimônio Líquido', id, 'patrimonio', 'sintetica'
FROM plano_contas WHERE codigo = '2'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
SELECT '2.2.01', 'Capital Social', id, 'patrimonio', 'analitica'
FROM plano_contas WHERE codigo = '2.2'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
SELECT '2.2.02', 'Lucros Acumulados', id, 'patrimonio', 'analitica'
FROM plano_contas WHERE codigo = '2.2'
ON CONFLICT (codigo) DO NOTHING;

-- 8. View para balancete
CREATE OR REPLACE VIEW v_balancete AS
SELECT
  pc.id AS conta_id,
  pc.codigo,
  pc.nome,
  pc.tipo,
  pc.natureza,
  lc.data_competencia,
  COALESCE(SUM(CASE WHEN lc.conta_debito_id = pc.id THEN lc.valor ELSE 0 END), 0) AS total_debitos,
  COALESCE(SUM(CASE WHEN lc.conta_credito_id = pc.id THEN lc.valor ELSE 0 END), 0) AS total_creditos,
  COALESCE(SUM(CASE WHEN lc.conta_debito_id = pc.id THEN lc.valor ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN lc.conta_credito_id = pc.id THEN lc.valor ELSE 0 END), 0) AS saldo
FROM plano_contas pc
LEFT JOIN lancamentos_contabeis lc
  ON lc.conta_debito_id = pc.id OR lc.conta_credito_id = pc.id
WHERE pc.natureza = 'analitica'
GROUP BY pc.id, pc.codigo, pc.nome, pc.tipo, pc.natureza, lc.data_competencia;
