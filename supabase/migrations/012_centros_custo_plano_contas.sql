-- =============================================================================
-- Migration 012: Centros de Custo, Plano de Contas e Categorias de Despesa
-- Sistema CRM Croma Print - Empresa de Comunicação Visual
-- =============================================================================
-- Cria as tabelas centros_custo, plano_contas e categorias_despesa,
-- adiciona colunas em modelo_processos, configura RLS e popula com dados
-- completos da estrutura financeira da Croma Print.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABELA: centros_custo
-- Estrutura hierárquica (até 3 níveis) para controle de custos por área
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS centros_custo (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo     VARCHAR(20) UNIQUE NOT NULL,
  nome       VARCHAR(100) NOT NULL,
  parent_id  UUID        REFERENCES centros_custo(id),
  nivel      INTEGER     NOT NULL DEFAULT 1 CHECK (nivel IN (1,2,3)),
  tipo       VARCHAR(20) CHECK (tipo IN ('administrativo','comercial','producao')),
  ativo      BOOLEAN     DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE centros_custo IS
  'Centros de custo hierárquicos (até 3 níveis) para alocação de despesas e receitas por área da empresa.';
COMMENT ON COLUMN centros_custo.codigo IS
  'Código único do centro de custo (ex: PRO-IMP-SOL).';
COMMENT ON COLUMN centros_custo.nivel IS
  '1=raiz (ADM/COM/PRO), 2=departamento, 3=subdepartamento.';
COMMENT ON COLUMN centros_custo.tipo IS
  'Classificação da área: administrativo, comercial ou producao.';

-- -----------------------------------------------------------------------------
-- TABELA: plano_contas
-- Plano de contas contábil/gerencial hierárquico com ligação a categorias de produto
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plano_contas (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo         VARCHAR(20) UNIQUE NOT NULL,
  nome           VARCHAR(150) NOT NULL,
  parent_id      UUID        REFERENCES plano_contas(id),
  tipo           VARCHAR(10) CHECK (tipo IN ('receita','despesa')),
  natureza       VARCHAR(10) CHECK (natureza IN ('analitica','sintetica')) DEFAULT 'analitica',
  categoria_slug VARCHAR(50),  -- liga ao slug de categorias_produto
  ativo          BOOLEAN     DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE plano_contas IS
  'Plano de contas gerencial hierárquico. Receitas refletem as categorias de produto/serviço; despesas cobrem todos os centros de custo.';
COMMENT ON COLUMN plano_contas.natureza IS
  'analitica=conta de lançamento; sintetica=conta de agrupamento (não recebe lançamentos diretos).';
COMMENT ON COLUMN plano_contas.categoria_slug IS
  'Slug que liga a conta analítica à categoria de produto correspondente.';

-- -----------------------------------------------------------------------------
-- TABELA: categorias_despesa
-- Categorias operacionais de despesa com ligação ao plano de contas e ao centro de custo
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias_despesa (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo          VARCHAR(20) UNIQUE NOT NULL,
  nome            VARCHAR(100) NOT NULL,
  parent_id       UUID        REFERENCES categorias_despesa(id),
  plano_conta_id  UUID        REFERENCES plano_contas(id),
  centro_custo_id UUID        REFERENCES centros_custo(id),
  tipo            VARCHAR(10) CHECK (tipo IN ('fixa','variavel','investimento')),
  ativo           BOOLEAN     DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE categorias_despesa IS
  'Categorias operacionais de despesa usadas nos lançamentos financeiros do dia a dia. Linkadas ao plano de contas e ao centro de custo.';
COMMENT ON COLUMN categorias_despesa.tipo IS
  'Classificação financeira: fixa (recorrente), variavel (proporcional à produção) ou investimento.';

-- -----------------------------------------------------------------------------
-- ALTER TABLE: modelo_processos
-- Adiciona centro de custo e tipo de processo para rastreabilidade de produção
-- -----------------------------------------------------------------------------
ALTER TABLE modelo_processos
  ADD COLUMN IF NOT EXISTS centro_custo_id UUID REFERENCES centros_custo(id),
  ADD COLUMN IF NOT EXISTS tipo_processo   VARCHAR(30)
    CHECK (tipo_processo IN (
      'impressao_solvente','impressao_uv','impressao_offset',
      'corte_laser','corte_router','corte_cnc','serralheria',
      'pintura','acabamento','montagem','instalacao','criacao'
    ));

COMMENT ON COLUMN modelo_processos.centro_custo_id IS
  'Centro de custo responsável pela execução deste processo produtivo.';
COMMENT ON COLUMN modelo_processos.tipo_processo IS
  'Tipo de processo para filtros de capacidade e custo padrão.';

-- =============================================================================
-- ÍNDICES
-- =============================================================================

-- centros_custo
CREATE INDEX IF NOT EXISTS idx_centros_custo_parent    ON centros_custo(parent_id);
CREATE INDEX IF NOT EXISTS idx_centros_custo_nivel     ON centros_custo(nivel);
CREATE INDEX IF NOT EXISTS idx_centros_custo_tipo      ON centros_custo(tipo);
CREATE INDEX IF NOT EXISTS idx_centros_custo_ativo     ON centros_custo(ativo);
CREATE INDEX IF NOT EXISTS idx_centros_custo_codigo    ON centros_custo(codigo);

-- plano_contas
CREATE INDEX IF NOT EXISTS idx_plano_contas_parent        ON plano_contas(parent_id);
CREATE INDEX IF NOT EXISTS idx_plano_contas_tipo          ON plano_contas(tipo);
CREATE INDEX IF NOT EXISTS idx_plano_contas_natureza      ON plano_contas(natureza);
CREATE INDEX IF NOT EXISTS idx_plano_contas_categoria     ON plano_contas(categoria_slug);
CREATE INDEX IF NOT EXISTS idx_plano_contas_ativo         ON plano_contas(ativo);
CREATE INDEX IF NOT EXISTS idx_plano_contas_codigo        ON plano_contas(codigo);

-- categorias_despesa
CREATE INDEX IF NOT EXISTS idx_cat_desp_parent        ON categorias_despesa(parent_id);
CREATE INDEX IF NOT EXISTS idx_cat_desp_plano_conta   ON categorias_despesa(plano_conta_id);
CREATE INDEX IF NOT EXISTS idx_cat_desp_centro_custo  ON categorias_despesa(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_cat_desp_tipo          ON categorias_despesa(tipo);
CREATE INDEX IF NOT EXISTS idx_cat_desp_ativo         ON categorias_despesa(ativo);

-- modelo_processos (novas colunas)
CREATE INDEX IF NOT EXISTS idx_modelo_proc_centro_custo  ON modelo_processos(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_modelo_proc_tipo_processo ON modelo_processos(tipo_processo);

-- =============================================================================
-- RLS: Row Level Security
-- =============================================================================

-- centros_custo
ALTER TABLE centros_custo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "centros_custo_select_authenticated" ON centros_custo;
CREATE POLICY "centros_custo_select_authenticated"
  ON centros_custo FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "centros_custo_write_admin_diretor" ON centros_custo;
CREATE POLICY "centros_custo_write_admin_diretor"
  ON centros_custo FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin','diretor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin','diretor')
    )
  );

-- plano_contas
ALTER TABLE plano_contas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plano_contas_select_authenticated" ON plano_contas;
CREATE POLICY "plano_contas_select_authenticated"
  ON plano_contas FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "plano_contas_write_admin_diretor" ON plano_contas;
CREATE POLICY "plano_contas_write_admin_diretor"
  ON plano_contas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin','diretor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin','diretor')
    )
  );

-- categorias_despesa
ALTER TABLE categorias_despesa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categorias_despesa_select_authenticated" ON categorias_despesa;
CREATE POLICY "categorias_despesa_select_authenticated"
  ON categorias_despesa FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "categorias_despesa_write_admin_diretor" ON categorias_despesa;
CREATE POLICY "categorias_despesa_write_admin_diretor"
  ON categorias_despesa FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin','diretor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin','diretor')
    )
  );

-- =============================================================================
-- SEED: centros_custo
-- Inserção hierárquica com variáveis DO $$ para capturar UUIDs dos parents
-- =============================================================================

DO $$
DECLARE
  -- Nível 1 (raiz)
  v_adm UUID;
  v_com UUID;
  v_pro UUID;

  -- Nível 2 - Administrativo
  v_adm_cpr UUID;
  v_adm_fin UUID;
  v_adm_fsc UUID;
  v_adm_rh  UUID;
  v_adm_log UUID;
  v_adm_alm UUID;

  -- Nível 2 - Comercial
  v_com_ven UUID;
  v_com_mkt UUID;
  v_com_orc UUID;
  v_com_cri UUID;
  v_com_art UUID;
  v_com_prj UUID;

  -- Nível 2 - Produção
  v_pro_imp UUID;
  v_pro_cnc UUID;
  v_pro_ser UUID;
  v_pro_mar UUID;
  v_pro_let UUID;
  v_pro_pin UUID;
  v_pro_acb UUID;
  v_pro_emb UUID;
  v_pro_mon UUID;
  v_pro_ins UUID;

BEGIN

  -- ---------------------------------------------------------------------------
  -- Nível 1: Raiz
  -- ---------------------------------------------------------------------------
  INSERT INTO centros_custo (codigo, nome, nivel, tipo)
    VALUES ('ADM', 'Administrativo', 1, 'administrativo')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_adm;
  IF v_adm IS NULL THEN
    SELECT id INTO v_adm FROM centros_custo WHERE codigo = 'ADM';
  END IF;

  INSERT INTO centros_custo (codigo, nome, nivel, tipo)
    VALUES ('COM', 'Comercial', 1, 'comercial')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_com;
  IF v_com IS NULL THEN
    SELECT id INTO v_com FROM centros_custo WHERE codigo = 'COM';
  END IF;

  INSERT INTO centros_custo (codigo, nome, nivel, tipo)
    VALUES ('PRO', 'Produção', 1, 'producao')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_pro;
  IF v_pro IS NULL THEN
    SELECT id INTO v_pro FROM centros_custo WHERE codigo = 'PRO';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Nível 2: Departamentos Administrativos
  -- ---------------------------------------------------------------------------
  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('ADM-CPR', 'Compras',            v_adm, 2, 'administrativo')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_adm_cpr;
  IF v_adm_cpr IS NULL THEN
    SELECT id INTO v_adm_cpr FROM centros_custo WHERE codigo = 'ADM-CPR';
  END IF;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('ADM-FIN', 'Financeiro',          v_adm, 2, 'administrativo')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_adm_fin;
  IF v_adm_fin IS NULL THEN
    SELECT id INTO v_adm_fin FROM centros_custo WHERE codigo = 'ADM-FIN';
  END IF;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('ADM-FSC', 'Fiscal',              v_adm, 2, 'administrativo')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_adm_fsc;
  IF v_adm_fsc IS NULL THEN
    SELECT id INTO v_adm_fsc FROM centros_custo WHERE codigo = 'ADM-FSC';
  END IF;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('ADM-RH',  'Recursos Humanos',    v_adm, 2, 'administrativo')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_adm_rh;
  IF v_adm_rh IS NULL THEN
    SELECT id INTO v_adm_rh FROM centros_custo WHERE codigo = 'ADM-RH';
  END IF;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('ADM-LOG', 'Logística',            v_adm, 2, 'administrativo')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_adm_log;
  IF v_adm_log IS NULL THEN
    SELECT id INTO v_adm_log FROM centros_custo WHERE codigo = 'ADM-LOG';
  END IF;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('ADM-ALM', 'Almoxarifado',         v_adm, 2, 'administrativo')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_adm_alm;
  IF v_adm_alm IS NULL THEN
    SELECT id INTO v_adm_alm FROM centros_custo WHERE codigo = 'ADM-ALM';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Nível 2: Departamentos Comerciais
  -- ---------------------------------------------------------------------------
  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('COM-VEN', 'Vendas',               v_com, 2, 'comercial')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_com_ven;
  IF v_com_ven IS NULL THEN
    SELECT id INTO v_com_ven FROM centros_custo WHERE codigo = 'COM-VEN';
  END IF;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('COM-MKT', 'Marketing',             v_com, 2, 'comercial')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_com_mkt;
  IF v_com_mkt IS NULL THEN
    SELECT id INTO v_com_mkt FROM centros_custo WHERE codigo = 'COM-MKT';
  END IF;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('COM-ORC', 'Orçamentista',          v_com, 2, 'comercial')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_com_orc;
  IF v_com_orc IS NULL THEN
    SELECT id INTO v_com_orc FROM centros_custo WHERE codigo = 'COM-ORC';
  END IF;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('COM-CRI', 'Criação',               v_com, 2, 'comercial')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_com_cri;
  IF v_com_cri IS NULL THEN
    SELECT id INTO v_com_cri FROM centros_custo WHERE codigo = 'COM-CRI';
  END IF;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('COM-ART', 'Arte-final/Pré-impressão', v_com, 2, 'comercial')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_com_art;
  IF v_com_art IS NULL THEN
    SELECT id INTO v_com_art FROM centros_custo WHERE codigo = 'COM-ART';
  END IF;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('COM-PRJ', 'Projetos',              v_com, 2, 'comercial')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_com_prj;
  IF v_com_prj IS NULL THEN
    SELECT id INTO v_com_prj FROM centros_custo WHERE codigo = 'COM-PRJ';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Nível 2: Departamentos de Produção
  -- ---------------------------------------------------------------------------
  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('PRO-IMP', 'Impressão',             v_pro, 2, 'producao')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_pro_imp;
  IF v_pro_imp IS NULL THEN
    SELECT id INTO v_pro_imp FROM centros_custo WHERE codigo = 'PRO-IMP';
  END IF;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('PRO-CNC', 'Cortes CNC',            v_pro, 2, 'producao')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_pro_cnc;
  IF v_pro_cnc IS NULL THEN
    SELECT id INTO v_pro_cnc FROM centros_custo WHERE codigo = 'PRO-CNC';
  END IF;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('PRO-SER', 'Serralheria',           v_pro, 2, 'producao')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_pro_ser;
  IF v_pro_ser IS NULL THEN
    SELECT id INTO v_pro_ser FROM centros_custo WHERE codigo = 'PRO-SER';
  END IF;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('PRO-MAR', 'Marcenaria',            v_pro, 2, 'producao')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_pro_mar;
  IF v_pro_mar IS NULL THEN
    SELECT id INTO v_pro_mar FROM centros_custo WHERE codigo = 'PRO-MAR';
  END IF;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('PRO-LET', 'Letras',                v_pro, 2, 'producao')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_pro_let;
  IF v_pro_let IS NULL THEN
    SELECT id INTO v_pro_let FROM centros_custo WHERE codigo = 'PRO-LET';
  END IF;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('PRO-PIN', 'Pintura',               v_pro, 2, 'producao')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_pro_pin;
  IF v_pro_pin IS NULL THEN
    SELECT id INTO v_pro_pin FROM centros_custo WHERE codigo = 'PRO-PIN';
  END IF;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('PRO-ACB', 'Acabamento',            v_pro, 2, 'producao')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_pro_acb;
  IF v_pro_acb IS NULL THEN
    SELECT id INTO v_pro_acb FROM centros_custo WHERE codigo = 'PRO-ACB';
  END IF;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('PRO-EMB', 'Embalagem',             v_pro, 2, 'producao')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_pro_emb;
  IF v_pro_emb IS NULL THEN
    SELECT id INTO v_pro_emb FROM centros_custo WHERE codigo = 'PRO-EMB';
  END IF;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('PRO-MON', 'Montagem',              v_pro, 2, 'producao')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_pro_mon;
  IF v_pro_mon IS NULL THEN
    SELECT id INTO v_pro_mon FROM centros_custo WHERE codigo = 'PRO-MON';
  END IF;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('PRO-INS', 'Instalação',            v_pro, 2, 'producao')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_pro_ins;
  IF v_pro_ins IS NULL THEN
    SELECT id INTO v_pro_ins FROM centros_custo WHERE codigo = 'PRO-INS';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Nível 3: Sub-departamentos de Impressão (parent=PRO-IMP)
  -- ---------------------------------------------------------------------------
  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('PRO-IMP-SOL', 'Solvente',   v_pro_imp, 3, 'producao')
    ON CONFLICT (codigo) DO NOTHING;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('PRO-IMP-LAT', 'Látex',      v_pro_imp, 3, 'producao')
    ON CONFLICT (codigo) DO NOTHING;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('PRO-IMP-UV',  'UV',         v_pro_imp, 3, 'producao')
    ON CONFLICT (codigo) DO NOTHING;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('PRO-IMP-SUB', 'Sublimação', v_pro_imp, 3, 'producao')
    ON CONFLICT (codigo) DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- Nível 3: Sub-departamentos de Cortes CNC (parent=PRO-CNC)
  -- ---------------------------------------------------------------------------
  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('PRO-CNC-LAS', 'Laser',  v_pro_cnc, 3, 'producao')
    ON CONFLICT (codigo) DO NOTHING;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('PRO-CNC-ROU', 'Router', v_pro_cnc, 3, 'producao')
    ON CONFLICT (codigo) DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- Nível 3: Sub-departamentos de Vendas (parent=COM-VEN)
  -- ---------------------------------------------------------------------------
  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('COM-VEN-BAL', 'Balcão',           v_com_ven, 3, 'comercial')
    ON CONFLICT (codigo) DO NOTHING;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('COM-VEN-EXT', 'Vendas Externas',  v_com_ven, 3, 'comercial')
    ON CONFLICT (codigo) DO NOTHING;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('COM-VEN-REP', 'Representante',    v_com_ven, 3, 'comercial')
    ON CONFLICT (codigo) DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- Nível 3: Sub-departamentos de Financeiro (parent=ADM-FIN)
  -- ---------------------------------------------------------------------------
  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('ADM-FIN-CPG', 'Contas a Pagar',   v_adm_fin, 3, 'administrativo')
    ON CONFLICT (codigo) DO NOTHING;

  INSERT INTO centros_custo (codigo, nome, parent_id, nivel, tipo)
    VALUES ('ADM-FIN-CRC', 'Contas a Receber', v_adm_fin, 3, 'administrativo')
    ON CONFLICT (codigo) DO NOTHING;

END $$;

-- =============================================================================
-- SEED: plano_contas — RECEITAS
-- Inserção em blocos DO $$ com variáveis para UUIDs dos parents
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Bloco 1: Raiz de Receitas + Comunicação Visual (1, 1.1)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_rec      UUID;  -- 1 Receitas
  v_cv       UUID;  -- 1.1 Comunicação Visual
  v_fachadas UUID;  -- 1.1.1 Fachadas
  v_fl       UUID;  -- 1.1.1.1 Front Light
  v_bl       UUID;  -- 1.1.1.2 Back Light
  v_let      UUID;  -- 1.1.1.3 Letreiros
  v_placas   UUID;  -- 1.1.2 Placas
  v_pvc2     UUID;  -- 1.1.2.1 PVC 2mm
  v_pvc3     UUID;  -- 1.1.2.2 PVC 3mm
  v_ps1      UUID;  -- 1.1.2.3 PS 1mm
  v_acm      UUID;  -- 1.1.2.4 ACM
  v_galv     UUID;  -- 1.1.2.5 Galvanizada
  v_cavalete UUID;  -- 1.1.3 Cavaletes
  v_painel   UUID;  -- 1.1.4 Painéis
  v_idcorp   UUID;  -- 1.1.5 Identificação Corporativa
  v_acrili   UUID;  -- 1.1.6 Materiais em Acrílico
  v_adesivo  UUID;  -- 1.1.7 Adesivos
  v_re       UUID;  -- 1.1.7.6 Recorte Eletrônico
  v_lona     UUID;  -- 1.1.8 Lonas
  v_banner   UUID;  -- 1.1.9 Banners
  v_faixa    UUID;  -- 1.1.10 Faixas
  v_iman     UUID;  -- 1.1.11 Imantados
  v_unif     UUID;  -- 1.1.12 Uniformes
  v_estr     UUID;  -- 1.1.13 Estrutura Metálica
  v_lumi     UUID;  -- 1.1.15 Luminosos
BEGIN

  -- 1 Receitas (raiz)
  INSERT INTO plano_contas (codigo, nome, tipo, natureza)
    VALUES ('1', 'Receitas', 'receita', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_rec;
  IF v_rec IS NULL THEN SELECT id INTO v_rec FROM plano_contas WHERE codigo = '1'; END IF;

  -- 1.1 Comunicação Visual
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1', 'Comunicação Visual', v_rec, 'receita', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_cv;
  IF v_cv IS NULL THEN SELECT id INTO v_cv FROM plano_contas WHERE codigo = '1.1'; END IF;

  -- -------------------------------------------------------------------------
  -- 1.1.1 Fachadas
  -- -------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza, categoria_slug)
    VALUES ('1.1.1', 'Fachadas', v_cv, 'receita', 'sintetica', 'fachadas')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_fachadas;
  IF v_fachadas IS NULL THEN SELECT id INTO v_fachadas FROM plano_contas WHERE codigo = '1.1.1'; END IF;

  -- 1.1.1.1 Front Light
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.1.1', 'Front Light', v_fachadas, 'receita', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_fl;
  IF v_fl IS NULL THEN SELECT id INTO v_fl FROM plano_contas WHERE codigo = '1.1.1.1'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.1.1.1', 'Metálico + Lona ID',    v_fl, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.1.1.2', 'Metálico + Lona RE',    v_fl, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.1.1.3', 'Metálico + ACM RE',     v_fl, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- 1.1.1.2 Back Light
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.1.2', 'Back Light', v_fachadas, 'receita', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_bl;
  IF v_bl IS NULL THEN SELECT id INTO v_bl FROM plano_contas WHERE codigo = '1.1.1.2'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.1.2.1', 'Metálico + Lona Back ID',            v_bl, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.1.2.2', 'Metálico + Acrílico',                v_bl, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.1.2.3', 'Metálico + ACM vazado + Acrílico',   v_bl, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- 1.1.1.3 Letreiros
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza, categoria_slug)
    VALUES ('1.1.1.3', 'Letreiros', v_fachadas, 'receita', 'sintetica', 'letreiros')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_let;
  IF v_let IS NULL THEN SELECT id INTO v_let FROM plano_contas WHERE codigo = '1.1.1.3'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.1.3.1', 'Acrílico',       v_let, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.1.3.2', 'Galvanizado',    v_let, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.1.3.3', 'Aço Inox 430',  v_let, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.1.3.4', 'Aço Inox 304',  v_let, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.1.3.5', 'PVC Expandido', v_let, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- 1.1.1.4 Totens
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza, categoria_slug)
    VALUES ('1.1.1.4', 'Totens', v_fachadas, 'receita', 'analitica', 'fachadas')
    ON CONFLICT (codigo) DO NOTHING;

  -- 1.1.1.5 Revestimento de ACM
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.1.5', 'Revestimento de ACM', v_fachadas, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 1.1.2 Placas
  -- -------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza, categoria_slug)
    VALUES ('1.1.2', 'Placas', v_cv, 'receita', 'sintetica', 'placas')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_placas;
  IF v_placas IS NULL THEN SELECT id INTO v_placas FROM plano_contas WHERE codigo = '1.1.2'; END IF;

  -- PVC 2mm
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.2.1', 'PVC 2mm', v_placas, 'receita', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_pvc2;
  IF v_pvc2 IS NULL THEN SELECT id INTO v_pvc2 FROM plano_contas WHERE codigo = '1.1.2.1'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.2.1.1', 'ID (Impressão Digital)', v_pvc2, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.2.1.2', 'IP (Impressão + Película)', v_pvc2, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.2.1.3', 'UV', v_pvc2, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- PVC 3mm
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.2.2', 'PVC 3mm', v_placas, 'receita', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_pvc3;
  IF v_pvc3 IS NULL THEN SELECT id INTO v_pvc3 FROM plano_contas WHERE codigo = '1.1.2.2'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.2.2.1', 'ID', v_pvc3, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.2.2.2', 'IP', v_pvc3, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.2.2.3', 'UV', v_pvc3, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.2.2.4', 'Refletivo GC', v_pvc3, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- PS 1mm
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.2.3', 'PS 1mm', v_placas, 'receita', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_ps1;
  IF v_ps1 IS NULL THEN SELECT id INTO v_ps1 FROM plano_contas WHERE codigo = '1.1.2.3'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.2.3.1', 'ID', v_ps1, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.2.3.2', 'UV', v_ps1, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- ACM
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.2.4', 'ACM', v_placas, 'receita', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_acm;
  IF v_acm IS NULL THEN SELECT id INTO v_acm FROM plano_contas WHERE codigo = '1.1.2.4'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.2.4.1', 'UV', v_acm, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.2.4.2', 'RE (Recorte Eletrônico)', v_acm, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.2.4.3', 'Refletivo GC', v_acm, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.2.4.4', 'Refletivo GTA', v_acm, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- Galvanizada
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.2.5', 'Galvanizada', v_placas, 'receita', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_galv;
  IF v_galv IS NULL THEN SELECT id INTO v_galv FROM plano_contas WHERE codigo = '1.1.2.5'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.2.5.1', 'ID', v_galv, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.2.5.2', 'IP', v_galv, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.2.5.3', 'RE', v_galv, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 1.1.3 Cavaletes
  -- -------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza, categoria_slug)
    VALUES ('1.1.3', 'Cavaletes', v_cv, 'receita', 'sintetica', 'fachadas')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_cavalete;
  IF v_cavalete IS NULL THEN SELECT id INTO v_cavalete FROM plano_contas WHERE codigo = '1.1.3'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.3.1', 'Metálico + Lona ID', v_cavalete, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.3.2', 'Madeira + Lona', v_cavalete, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 1.1.4 Painéis
  -- -------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza, categoria_slug)
    VALUES ('1.1.4', 'Painéis', v_cv, 'receita', 'sintetica', 'displays')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_painel;
  IF v_painel IS NULL THEN SELECT id INTO v_painel FROM plano_contas WHERE codigo = '1.1.4'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.4.1', 'Vidro 6mm + ID', v_painel, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.4.2', 'Vidro 8mm + ID', v_painel, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.4.3', 'Acrílico + UV',  v_painel, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 1.1.5 Identificação Corporativa
  -- -------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza, categoria_slug)
    VALUES ('1.1.5', 'Identificação Corporativa', v_cv, 'receita', 'sintetica', 'displays')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_idcorp;
  IF v_idcorp IS NULL THEN SELECT id INTO v_idcorp FROM plano_contas WHERE codigo = '1.1.5'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.5.1', 'PVC 2mm + UV',           v_idcorp, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.5.2', 'ACM + RE',               v_idcorp, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.5.3', 'Acrílico Personalizado', v_idcorp, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 1.1.6 Materiais em Acrílico
  -- -------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza, categoria_slug)
    VALUES ('1.1.6', 'Materiais em Acrílico', v_cv, 'receita', 'sintetica', 'displays')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_acrili;
  IF v_acrili IS NULL THEN SELECT id INTO v_acrili FROM plano_contas WHERE codigo = '1.1.6'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.6.1', 'Urna',                  v_acrili, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.6.2', 'Painéis Personalizados', v_acrili, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.6.3', 'Troféus/Brindes',        v_acrili, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.6.4', 'Displays',               v_acrili, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 1.1.7 Adesivos
  -- -------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza, categoria_slug)
    VALUES ('1.1.7', 'Adesivos', v_cv, 'receita', 'sintetica', 'adesivos')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_adesivo;
  IF v_adesivo IS NULL THEN SELECT id INTO v_adesivo FROM plano_contas WHERE codigo = '1.1.7'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.7.1', 'ID', v_adesivo, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.7.2', 'IP (com Película)', v_adesivo, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.7.3', 'UV', v_adesivo, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.7.4', 'Perfurado', v_adesivo, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.7.5', 'Jateado', v_adesivo, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- 1.1.7.6 Recorte Eletrônico (sub-sintetica)
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.7.6', 'Recorte Eletrônico', v_adesivo, 'receita', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_re;
  IF v_re IS NULL THEN SELECT id INTO v_re FROM plano_contas WHERE codigo = '1.1.7.6'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.7.6.1', '1 cor + Película',   v_re, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.7.6.2', '2 cores + Película',  v_re, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.7.6.3', '1 cor s/ Película',   v_re, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.7.6.4', '2 cores s/ Película',  v_re, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.7.7', 'Refletivo GC', v_adesivo, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 1.1.8 Lonas
  -- -------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza, categoria_slug)
    VALUES ('1.1.8', 'Lonas', v_cv, 'receita', 'sintetica', 'banners_lonas')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_lona;
  IF v_lona IS NULL THEN SELECT id INTO v_lona FROM plano_contas WHERE codigo = '1.1.8'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.8.1', 'ID (Impressão Digital)', v_lona, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.8.2', 'RE (Resolução Elevada)', v_lona, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 1.1.9 Banners
  -- -------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza, categoria_slug)
    VALUES ('1.1.9', 'Banners', v_cv, 'receita', 'sintetica', 'banners_lonas')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_banner;
  IF v_banner IS NULL THEN SELECT id INTO v_banner FROM plano_contas WHERE codigo = '1.1.9'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.9.1', 'Até 1m²',    v_banner, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.9.2', '1 a 2m²',    v_banner, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.9.3', 'Acima de 2m²', v_banner, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 1.1.10 Faixas
  -- -------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza, categoria_slug)
    VALUES ('1.1.10', 'Faixas', v_cv, 'receita', 'sintetica', 'banners_lonas')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_faixa;
  IF v_faixa IS NULL THEN SELECT id INTO v_faixa FROM plano_contas WHERE codigo = '1.1.10'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.10.1', 'Até 2m²',    v_faixa, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.10.2', 'Acima de 2m²', v_faixa, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 1.1.11 Imantados
  -- -------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza, categoria_slug)
    VALUES ('1.1.11', 'Imantados', v_cv, 'receita', 'sintetica', 'displays')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_iman;
  IF v_iman IS NULL THEN SELECT id INTO v_iman FROM plano_contas WHERE codigo = '1.1.11'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.11.1', 'ID', v_iman, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.11.2', 'IP', v_iman, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.11.3', 'RE + Película', v_iman, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 1.1.12 Uniformes
  -- -------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.12', 'Uniformes', v_cv, 'receita', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_unif;
  IF v_unif IS NULL THEN SELECT id INTO v_unif FROM plano_contas WHERE codigo = '1.1.12'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.12.1', 'Camisa Social', v_unif, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.12.2', 'Polo Piquet',   v_unif, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.12.3', 'Camiseta',      v_unif, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 1.1.13 Estrutura Metálica
  -- -------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza, categoria_slug)
    VALUES ('1.1.13', 'Estrutura Metálica', v_cv, 'receita', 'sintetica', 'estruturas')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_estr;
  IF v_estr IS NULL THEN SELECT id INTO v_estr FROM plano_contas WHERE codigo = '1.1.13'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.13.1', 'Suporte simples',  v_estr, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.13.2', 'Suporte duplo',    v_estr, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.13.3', 'Quadro 20x20mm',  v_estr, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.13.4', 'Quadro 30x30mm',  v_estr, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 1.1.14 Wind Flags/Banners
  -- -------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza, categoria_slug)
    VALUES ('1.1.14', 'Wind Flags/Banners', v_cv, 'receita', 'analitica', 'banners_lonas')
    ON CONFLICT (codigo) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 1.1.15 Luminosos
  -- -------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza, categoria_slug)
    VALUES ('1.1.15', 'Luminosos', v_cv, 'receita', 'sintetica', 'luminosos')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_lumi;
  IF v_lumi IS NULL THEN SELECT id INTO v_lumi FROM plano_contas WHERE codigo = '1.1.15'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.15.1', '1ª Linha (ACM + Acrílico + LED)', v_lumi, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.1.15.2', '2ª Linha (Lona Back + LED)',      v_lumi, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

END $$;

-- -----------------------------------------------------------------------------
-- Bloco 2: Gráfica, Serviços de Criação, Audiovisual, Cortes, Instalação, Iluminação
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_rec    UUID;
  v_cv     UUID;
  v_graf   UUID;  -- 1.2 Gráfica
  v_cv_cv  UUID;  -- 1.2.1 Cartão de Visitas
  v_panf   UUID;  -- 1.2.2 Panfleto
  v_pasta  UUID;  -- 1.2.3 Pasta
  v_fold   UUID;  -- 1.2.4 Folder
  v_crach  UUID;  -- 1.2.5 Crachá
  v_cria   UUID;  -- 1.3 Criação e Arte-Finalização
  v_cort   UUID;  -- 1.5 Serviços de Corte
  v_inst   UUID;  -- 1.6 Instalação
  v_ilum   UUID;  -- 1.7 Iluminação
BEGIN

  SELECT id INTO v_rec FROM plano_contas WHERE codigo = '1';
  SELECT id INTO v_cv  FROM plano_contas WHERE codigo = '1.1';

  -- -------------------------------------------------------------------------
  -- 1.2 Gráfica
  -- -------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza, categoria_slug)
    VALUES ('1.2', 'Gráfica', v_rec, 'receita', 'sintetica', 'grafica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_graf;
  IF v_graf IS NULL THEN SELECT id INTO v_graf FROM plano_contas WHERE codigo = '1.2'; END IF;

  -- Cartão de Visitas
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.2.1', 'Cartão de Visitas', v_graf, 'receita', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_cv_cv;
  IF v_cv_cv IS NULL THEN SELECT id INTO v_cv_cv FROM plano_contas WHERE codigo = '1.2.1'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.2.1.1', '300g + Laminação + Verniz 4x4', v_cv_cv, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.2.1.2', '300g + Verniz total 4x4',        v_cv_cv, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.2.1.3', 'Premium Hot Stamping',           v_cv_cv, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- Panfleto
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.2.2', 'Panfleto', v_graf, 'receita', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_panf;
  IF v_panf IS NULL THEN SELECT id INTO v_panf FROM plano_contas WHERE codigo = '1.2.2'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.2.2.1', '4x4 (frente e verso)', v_panf, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.2.2.2', '4x1 / 4x0',            v_panf, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- Pasta
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.2.3', 'Pasta', v_graf, 'receita', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_pasta;
  IF v_pasta IS NULL THEN SELECT id INTO v_pasta FROM plano_contas WHERE codigo = '1.2.3'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.2.3.1', 'Verniz Total',    v_pasta, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.2.3.2', 'Laminação Fosca', v_pasta, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- Folder
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.2.4', 'Folder', v_graf, 'receita', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_fold;
  IF v_fold IS NULL THEN SELECT id INTO v_fold FROM plano_contas WHERE codigo = '1.2.4'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.2.4.1', 'A4 Laminação 4x4', v_fold, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.2.4.2', 'A3 Laminação 4x4', v_fold, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- Crachá
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.2.5', 'Crachá', v_graf, 'receita', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_crach;
  IF v_crach IS NULL THEN SELECT id INTO v_crach FROM plano_contas WHERE codigo = '1.2.5'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.2.5.1', 'PS Sublimado', v_crach, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.2.5.2', 'PVC 0,76mm',   v_crach, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- Contas sem filhos diretos
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.2.6', 'Cartela de Etiquetas',    v_graf, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.2.7', 'Cordão/Acessório Crachá', v_graf, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 1.3 Criação e Arte-Finalização
  -- -------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza, categoria_slug)
    VALUES ('1.3', 'Criação e Arte-Finalização', v_rec, 'receita', 'sintetica', 'servicos')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_cria;
  IF v_cria IS NULL THEN SELECT id INTO v_cria FROM plano_contas WHERE codigo = '1.3'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.3.1', 'Impressos/Gráfica',         v_cria, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.3.2', 'Identidade Visual',          v_cria, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.3.3', 'Publicidade/Marketing',      v_cria, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.3.4', 'Sinalização Segurança',      v_cria, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 1.4 Audiovisual
  -- -------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.4', 'Audiovisual', v_rec, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 1.5 Serviços de Corte
  -- -------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza, categoria_slug)
    VALUES ('1.5', 'Serviços de Corte', v_rec, 'receita', 'sintetica', 'servicos')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_cort;
  IF v_cort IS NULL THEN SELECT id INTO v_cort FROM plano_contas WHERE codigo = '1.5'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.5.1', 'Corte Laser',  v_cort, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.5.2', 'Corte Router', v_cort, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.5.3', 'Corte CNC',    v_cort, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 1.6 Instalação
  -- -------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.6', 'Instalação', v_rec, 'receita', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_inst;
  IF v_inst IS NULL THEN SELECT id INTO v_inst FROM plano_contas WHERE codigo = '1.6'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.6.1', 'Fachadas',         v_inst, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.6.2', 'Adesivos',          v_inst, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.6.3', 'Vidros/Acrílicos', v_inst, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 1.7 Iluminação
  -- -------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza, categoria_slug)
    VALUES ('1.7', 'Iluminação', v_rec, 'receita', 'sintetica', 'iluminacao')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_ilum;
  IF v_ilum IS NULL THEN SELECT id INTO v_ilum FROM plano_contas WHERE codigo = '1.7'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.7.1', 'KIT Refletor LED', v_ilum, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('1.7.2', 'Luminária/Plafon', v_ilum, 'receita', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

END $$;

-- =============================================================================
-- SEED: plano_contas — DESPESAS
-- =============================================================================

DO $$
DECLARE
  v_desp  UUID;  -- 2 Despesas
  v_rh    UUID;  -- 2.1 Pessoal/RH
  v_ban   UUID;  -- 2.2 Bancárias
  v_ti    UUID;  -- 2.3 Comunicação/TI
  v_mkt   UUID;  -- 2.4 Marketing
  v_imp   UUID;  -- 2.5 Impostos
  v_imovel UUID; -- 2.6 Imóvel
  v_maq   UUID;  -- 2.7 Máquinas
  v_veic  UUID;  -- 2.8 Veículos
  v_terc  UUID;  -- 2.9 Terceiros
  v_mp    UUID;  -- 2.10 Matéria-Prima
  v_adm   UUID;  -- 2.11 Administrativo
  v_inv   UUID;  -- 2.12 Investimentos
BEGIN

  -- 2 Despesas (raiz)
  INSERT INTO plano_contas (codigo, nome, tipo, natureza)
    VALUES ('2', 'Despesas', 'despesa', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_desp;
  IF v_desp IS NULL THEN SELECT id INTO v_desp FROM plano_contas WHERE codigo = '2'; END IF;

  -- ---------------------------------------------------------------------------
  -- 2.1 Pessoal/RH
  -- ---------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.1', 'Pessoal/RH', v_desp, 'despesa', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_rh;
  IF v_rh IS NULL THEN SELECT id INTO v_rh FROM plano_contas WHERE codigo = '2.1'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.1.1',  'Salários',           v_rh, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.1.2',  '13º Salário',        v_rh, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.1.3',  'Férias + 1/3',       v_rh, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.1.4',  'FGTS',               v_rh, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.1.5',  'INSS Patronal',      v_rh, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.1.6',  'Vale Transporte',    v_rh, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.1.7',  'Vale Alimentação',   v_rh, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.1.8',  'Plano de Saúde',     v_rh, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.1.9',  'EPI/Uniformes',      v_rh, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.1.10', 'Pró-labore',         v_rh, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.1.11', 'Comissões de Vendas', v_rh, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.1.12', 'Rescisões',           v_rh, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- 2.2 Despesas Bancárias
  -- ---------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.2', 'Despesas Bancárias', v_desp, 'despesa', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_ban;
  IF v_ban IS NULL THEN SELECT id INTO v_ban FROM plano_contas WHERE codigo = '2.2'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.2.1', 'Tarifas Bancárias',    v_ban, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.2.2', 'Juros/Multa de Atrasos', v_ban, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.2.3', 'IOF',                  v_ban, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.2.4', 'Taxas de Cartão',      v_ban, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- 2.3 Comunicação/TI
  -- ---------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.3', 'Comunicação/TI', v_desp, 'despesa', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_ti;
  IF v_ti IS NULL THEN SELECT id INTO v_ti FROM plano_contas WHERE codigo = '2.3'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.3.1', 'Telefone/Internet', v_ti, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.3.2', 'Software/SaaS',     v_ti, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.3.3', 'Manutenção TI',     v_ti, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- 2.4 Marketing
  -- ---------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.4', 'Marketing', v_desp, 'despesa', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_mkt;
  IF v_mkt IS NULL THEN SELECT id INTO v_mkt FROM plano_contas WHERE codigo = '2.4'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.4.1', 'Redes Sociais/Ads', v_mkt, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.4.2', 'Site/Domínio',      v_mkt, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.4.3', 'Material Gráfico',  v_mkt, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- 2.5 Impostos
  -- ---------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.5', 'Impostos', v_desp, 'despesa', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_imp;
  IF v_imp IS NULL THEN SELECT id INTO v_imp FROM plano_contas WHERE codigo = '2.5'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.5.1', 'Simples Nacional', v_imp, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.5.2', 'IRPJ/CSLL',        v_imp, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.5.3', 'Parcelamentos',    v_imp, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- 2.6 Imóvel/Instalações
  -- ---------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.6', 'Imóvel/Instalações', v_desp, 'despesa', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_imovel;
  IF v_imovel IS NULL THEN SELECT id INTO v_imovel FROM plano_contas WHERE codigo = '2.6'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.6.1', 'Aluguel',          v_imovel, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.6.2', 'Energia Elétrica', v_imovel, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.6.3', 'Água',             v_imovel, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.6.4', 'IPTU/Condomínio',  v_imovel, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.6.5', 'Manutenção',       v_imovel, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.6.6', 'Seguro Imóvel',    v_imovel, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- 2.7 Máquinas e Equipamentos
  -- ---------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.7', 'Máquinas e Equipamentos', v_desp, 'despesa', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_maq;
  IF v_maq IS NULL THEN SELECT id INTO v_maq FROM plano_contas WHERE codigo = '2.7'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.7.1', 'Aquisição/Depreciação',  v_maq, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.7.2', 'Manutenção/Conserto',    v_maq, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.7.3', 'Leasing/Financiamento',  v_maq, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- 2.8 Veículos e Logística
  -- ---------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.8', 'Veículos e Logística', v_desp, 'despesa', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_veic;
  IF v_veic IS NULL THEN SELECT id INTO v_veic FROM plano_contas WHERE codigo = '2.8'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.8.1', 'Combustível',         v_veic, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.8.2', 'Manutenção Veicular', v_veic, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.8.3', 'IPVA/Seguro',         v_veic, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.8.4', 'Rastreador',          v_veic, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.8.5', 'Fretes/Carretos',     v_veic, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- 2.9 Terceiros/Serviços
  -- ---------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.9', 'Terceiros/Serviços', v_desp, 'despesa', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_terc;
  IF v_terc IS NULL THEN SELECT id INTO v_terc FROM plano_contas WHERE codigo = '2.9'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.9.1', 'Contabilidade',           v_terc, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.9.2', 'Advocacia/Jurídico',       v_terc, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.9.3', 'Consultoria',              v_terc, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.9.4', 'Terceirização Produção',   v_terc, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- 2.10 Matéria-Prima/Insumos
  -- ---------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.10', 'Matéria-Prima/Insumos', v_desp, 'despesa', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_mp;
  IF v_mp IS NULL THEN SELECT id INTO v_mp FROM plano_contas WHERE codigo = '2.10'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.10.1', 'Vinils/Adesivos',           v_mp, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.10.2', 'Substratos (ACM/PVC/Acrílico)', v_mp, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.10.3', 'Lonas/Banners',             v_mp, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.10.4', 'Tintas/Solventes',          v_mp, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.10.5', 'Ferragens/Estruturas',      v_mp, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.10.6', 'LED/Iluminação',            v_mp, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- 2.11 Administrativo
  -- ---------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.11', 'Administrativo', v_desp, 'despesa', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_adm;
  IF v_adm IS NULL THEN SELECT id INTO v_adm FROM plano_contas WHERE codigo = '2.11'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.11.1', 'Material de Escritório', v_adm, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.11.2', 'Material de Limpeza',    v_adm, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.11.3', 'Despesas Gerais',        v_adm, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- 2.12 Investimentos
  -- ---------------------------------------------------------------------------
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.12', 'Investimentos', v_desp, 'despesa', 'sintetica')
    ON CONFLICT (codigo) DO NOTHING
    RETURNING id INTO v_inv;
  IF v_inv IS NULL THEN SELECT id INTO v_inv FROM plano_contas WHERE codigo = '2.12'; END IF;

  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.12.1', 'Treinamentos',           v_inv, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.12.2', 'Pesquisa e Desenvolvimento', v_inv, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;
  INSERT INTO plano_contas (codigo, nome, parent_id, tipo, natureza)
    VALUES ('2.12.3', 'Reserva de Capital',     v_inv, 'despesa', 'analitica')
    ON CONFLICT (codigo) DO NOTHING;

END $$;

-- =============================================================================
-- SEED: categorias_despesa
-- Liga cada categoria ao seu plano de conta e, onde aplicável, ao centro de custo
-- =============================================================================

DO $$
DECLARE
  -- IDs de contas do plano (buscados por código)
  v_pc_salario   UUID;
  v_pc_comissao  UUID;
  v_pc_aluguel   UUID;
  v_pc_energia   UUID;
  v_pc_simples   UUID;
  v_pc_vinil     UUID;
  v_pc_substr    UUID;
  v_pc_lona      UUID;
  v_pc_manut_eq  UUID;
  v_pc_contabil  UUID;
  v_pc_softw     UUID;
  v_pc_frete     UUID;
  v_pc_tercprod  UUID;

  -- IDs de centros de custo (buscados por código)
  v_cc_rh        UUID;
  v_cc_ven       UUID;
  v_cc_fin       UUID;
  v_cc_pro       UUID;
  v_cc_adm       UUID;
  v_cc_log       UUID;
  v_cc_imp       UUID;
  v_cc_fsc       UUID;
BEGIN

  -- Resolve IDs do plano de contas
  SELECT id INTO v_pc_salario  FROM plano_contas WHERE codigo = '2.1.1';
  SELECT id INTO v_pc_comissao FROM plano_contas WHERE codigo = '2.1.11';
  SELECT id INTO v_pc_aluguel  FROM plano_contas WHERE codigo = '2.6.1';
  SELECT id INTO v_pc_energia  FROM plano_contas WHERE codigo = '2.6.2';
  SELECT id INTO v_pc_simples  FROM plano_contas WHERE codigo = '2.5.1';
  SELECT id INTO v_pc_vinil    FROM plano_contas WHERE codigo = '2.10.1';
  SELECT id INTO v_pc_substr   FROM plano_contas WHERE codigo = '2.10.2';
  SELECT id INTO v_pc_lona     FROM plano_contas WHERE codigo = '2.10.3';
  SELECT id INTO v_pc_manut_eq FROM plano_contas WHERE codigo = '2.7.2';
  SELECT id INTO v_pc_contabil FROM plano_contas WHERE codigo = '2.9.1';
  SELECT id INTO v_pc_softw    FROM plano_contas WHERE codigo = '2.3.2';
  SELECT id INTO v_pc_frete    FROM plano_contas WHERE codigo = '2.8.5';
  SELECT id INTO v_pc_tercprod FROM plano_contas WHERE codigo = '2.9.4';

  -- Resolve IDs dos centros de custo
  SELECT id INTO v_cc_rh  FROM centros_custo WHERE codigo = 'ADM-RH';
  SELECT id INTO v_cc_ven FROM centros_custo WHERE codigo = 'COM-VEN';
  SELECT id INTO v_cc_fin FROM centros_custo WHERE codigo = 'ADM-FIN';
  SELECT id INTO v_cc_pro FROM centros_custo WHERE codigo = 'PRO';
  SELECT id INTO v_cc_adm FROM centros_custo WHERE codigo = 'ADM';
  SELECT id INTO v_cc_log FROM centros_custo WHERE codigo = 'ADM-LOG';
  SELECT id INTO v_cc_imp FROM centros_custo WHERE codigo = 'PRO-IMP';
  SELECT id INTO v_cc_fsc FROM centros_custo WHERE codigo = 'ADM-FSC';

  -- -------------------------------------------------------------------------
  -- Inserções das categorias operacionais de despesa
  -- -------------------------------------------------------------------------
  INSERT INTO categorias_despesa (codigo, nome, plano_conta_id, centro_custo_id, tipo)
    VALUES ('SALARIO',  'Salários',                    v_pc_salario,   v_cc_rh,  'fixa')
    ON CONFLICT (codigo) DO NOTHING;

  INSERT INTO categorias_despesa (codigo, nome, plano_conta_id, centro_custo_id, tipo)
    VALUES ('COMISSAO', 'Comissões',                   v_pc_comissao,  v_cc_ven, 'variavel')
    ON CONFLICT (codigo) DO NOTHING;

  INSERT INTO categorias_despesa (codigo, nome, plano_conta_id, centro_custo_id, tipo)
    VALUES ('ALUGUEL',  'Aluguel',                     v_pc_aluguel,   v_cc_adm, 'fixa')
    ON CONFLICT (codigo) DO NOTHING;

  INSERT INTO categorias_despesa (codigo, nome, plano_conta_id, centro_custo_id, tipo)
    VALUES ('ENERGIA',  'Energia Elétrica',             v_pc_energia,   v_cc_adm, 'fixa')
    ON CONFLICT (codigo) DO NOTHING;

  INSERT INTO categorias_despesa (codigo, nome, plano_conta_id, centro_custo_id, tipo)
    VALUES ('SIMPLES',  'Simples Nacional',             v_pc_simples,   v_cc_fsc, 'variavel')
    ON CONFLICT (codigo) DO NOTHING;

  INSERT INTO categorias_despesa (codigo, nome, plano_conta_id, centro_custo_id, tipo)
    VALUES ('MP-VINIL', 'Vinil/Adesivos',               v_pc_vinil,     v_cc_imp, 'variavel')
    ON CONFLICT (codigo) DO NOTHING;

  INSERT INTO categorias_despesa (codigo, nome, plano_conta_id, centro_custo_id, tipo)
    VALUES ('MP-SUBSTR','Substratos',                   v_pc_substr,    v_cc_pro, 'variavel')
    ON CONFLICT (codigo) DO NOTHING;

  INSERT INTO categorias_despesa (codigo, nome, plano_conta_id, centro_custo_id, tipo)
    VALUES ('MP-LONA',  'Lonas',                        v_pc_lona,      v_cc_imp, 'variavel')
    ON CONFLICT (codigo) DO NOTHING;

  INSERT INTO categorias_despesa (codigo, nome, plano_conta_id, centro_custo_id, tipo)
    VALUES ('MANUT-EQ', 'Manutenção Equipamentos',      v_pc_manut_eq,  v_cc_pro, 'variavel')
    ON CONFLICT (codigo) DO NOTHING;

  INSERT INTO categorias_despesa (codigo, nome, plano_conta_id, centro_custo_id, tipo)
    VALUES ('CONTABIL', 'Contabilidade',                v_pc_contabil,  v_cc_adm, 'fixa')
    ON CONFLICT (codigo) DO NOTHING;

  INSERT INTO categorias_despesa (codigo, nome, plano_conta_id, centro_custo_id, tipo)
    VALUES ('SOFTW',    'Software/SaaS',                v_pc_softw,     v_cc_adm, 'fixa')
    ON CONFLICT (codigo) DO NOTHING;

  INSERT INTO categorias_despesa (codigo, nome, plano_conta_id, centro_custo_id, tipo)
    VALUES ('FRETE',    'Fretes/Carretos',               v_pc_frete,     v_cc_log, 'variavel')
    ON CONFLICT (codigo) DO NOTHING;

  INSERT INTO categorias_despesa (codigo, nome, plano_conta_id, centro_custo_id, tipo)
    VALUES ('TERCPROD', 'Terceirização Produção',        v_pc_tercprod,  v_cc_pro, 'variavel')
    ON CONFLICT (codigo) DO NOTHING;

END $$;
