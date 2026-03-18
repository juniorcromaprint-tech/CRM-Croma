-- 065 — Multi-empresa fiscal (hibrida)
-- Cria tabela empresas e adiciona empresa_id nas tabelas fiscais.
-- Migra dados da Croma Print dos ambientes existentes.

BEGIN;

-- =========================================================
-- 1. TABELA DE EMPRESAS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT NOT NULL UNIQUE,
  ie TEXT,
  im TEXT,
  crt INTEGER NOT NULL DEFAULT 1 CHECK (crt IN (1, 2, 3)),
  logradouro TEXT,
  numero_endereco TEXT,
  complemento TEXT,
  bairro TEXT,
  municipio TEXT,
  uf CHAR(2),
  cep TEXT,
  codigo_municipio_ibge TEXT,
  telefone TEXT,
  logo_url TEXT,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.empresas IS 'Empresas emitentes de documentos fiscais';

DROP TRIGGER IF EXISTS trg_empresas_updated_at ON public.empresas;
CREATE TRIGGER trg_empresas_updated_at
BEFORE UPDATE ON public.empresas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empresas_select ON public.empresas;
CREATE POLICY empresas_select ON public.empresas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS empresas_all_admin ON public.empresas;
CREATE POLICY empresas_all_admin ON public.empresas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- 2. ADICIONAR empresa_id NAS TABELAS FISCAIS
-- =========================================================
ALTER TABLE public.fiscal_ambientes
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);

ALTER TABLE public.fiscal_certificados
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);

ALTER TABLE public.fiscal_series
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);

ALTER TABLE public.fiscal_documentos
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_fiscal_ambientes_empresa ON public.fiscal_ambientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_certificados_empresa ON public.fiscal_certificados(empresa_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_series_empresa ON public.fiscal_series(empresa_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_documentos_empresa ON public.fiscal_documentos(empresa_id);

-- =========================================================
-- 3. MIGRAR DADOS: criar empresa Croma Print a partir dos ambientes existentes
-- =========================================================
-- Pega o CNPJ do primeiro ambiente que tem cnpj_emitente preenchido
DO $$
DECLARE
  v_empresa_id UUID;
  v_cnpj TEXT;
  v_razao TEXT;
  v_ie TEXT;
  v_im TEXT;
  v_crt INTEGER;
  v_logradouro TEXT;
  v_numero TEXT;
  v_complemento TEXT;
  v_bairro TEXT;
  v_municipio TEXT;
  v_uf TEXT;
  v_cep TEXT;
  v_ibge TEXT;
  v_telefone TEXT;
BEGIN
  -- Busca dados do primeiro ambiente com CNPJ preenchido
  SELECT
    cnpj_emitente, razao_social_emitente, ie_emitente, im_emitente,
    crt, logradouro, numero_endereco, complemento, bairro,
    municipio, uf, cep, codigo_municipio_ibge, telefone_emitente
  INTO
    v_cnpj, v_razao, v_ie, v_im,
    v_crt, v_logradouro, v_numero, v_complemento, v_bairro,
    v_municipio, v_uf, v_cep, v_ibge, v_telefone
  FROM public.fiscal_ambientes
  WHERE cnpj_emitente IS NOT NULL AND cnpj_emitente != ''
  LIMIT 1;

  -- Se encontrou dados, cria a empresa
  IF v_cnpj IS NOT NULL THEN
    INSERT INTO public.empresas (
      razao_social, cnpj, ie, im, crt,
      logradouro, numero_endereco, complemento, bairro,
      municipio, uf, cep, codigo_municipio_ibge, telefone, ativa
    ) VALUES (
      COALESCE(v_razao, 'Empresa Principal'), v_cnpj, v_ie, v_im, COALESCE(v_crt, 1),
      v_logradouro, v_numero, v_complemento, v_bairro,
      v_municipio, v_uf, v_cep, v_ibge, v_telefone, true
    )
    RETURNING id INTO v_empresa_id;

    -- Atualiza todos os registros fiscais existentes
    UPDATE public.fiscal_ambientes SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
    UPDATE public.fiscal_certificados SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
    UPDATE public.fiscal_series SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
    UPDATE public.fiscal_documentos SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;

    RAISE NOTICE 'Empresa criada: % (CNPJ: %) — ID: %', v_razao, v_cnpj, v_empresa_id;
  ELSE
    RAISE NOTICE 'Nenhum ambiente com CNPJ encontrado. Pule a migração de dados.';
  END IF;
END $$;

COMMIT;
