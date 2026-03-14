-- 023 — Campos fiscais completos em fiscal_ambientes
-- Necessários para emissão NF-e válida (NT 2019.001 / NF-e 4.0)

ALTER TABLE public.fiscal_ambientes
  ADD COLUMN IF NOT EXISTS cnpj_emitente        text,
  ADD COLUMN IF NOT EXISTS razao_social_emitente text,
  ADD COLUMN IF NOT EXISTS ie_emitente           text,
  ADD COLUMN IF NOT EXISTS im_emitente           text,
  ADD COLUMN IF NOT EXISTS crt                   integer DEFAULT 1
    CHECK (crt IN (1,2,3)),
  ADD COLUMN IF NOT EXISTS logradouro            text,
  ADD COLUMN IF NOT EXISTS numero_endereco       text,
  ADD COLUMN IF NOT EXISTS complemento           text,
  ADD COLUMN IF NOT EXISTS bairro                text,
  ADD COLUMN IF NOT EXISTS municipio             text,
  ADD COLUMN IF NOT EXISTS uf                    char(2),
  ADD COLUMN IF NOT EXISTS cep                   text,
  ADD COLUMN IF NOT EXISTS codigo_municipio_ibge text,
  ADD COLUMN IF NOT EXISTS telefone_emitente     text;

COMMENT ON COLUMN public.fiscal_ambientes.cnpj_emitente IS 'CNPJ da empresa emitente (sem mascara)';
COMMENT ON COLUMN public.fiscal_ambientes.crt IS '1=Simples Nacional, 2=Simples Exc.Sublimite, 3=Regime Normal';
COMMENT ON COLUMN public.fiscal_ambientes.codigo_municipio_ibge IS 'Código IBGE 7 dígitos do município emitente';
