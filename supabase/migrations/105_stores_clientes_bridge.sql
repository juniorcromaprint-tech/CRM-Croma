-- ============================================================
-- Migration 105: Bridge stores (App Campo) ↔ clientes (CRM)
-- ============================================================

-- 1. Adicionar campo origem nas stores pra saber de onde veio
ALTER TABLE stores ADD COLUMN IF NOT EXISTS origem text DEFAULT 'campo';
-- valores: 'campo' (cadastro manual no app), 'crm' (importado do CRM)

-- 2. Criar FK de stores.cliente_id → clientes.id (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stores_cliente_id_fkey'
  ) THEN
    ALTER TABLE stores
      ADD CONSTRAINT stores_cliente_id_fkey
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Índice para busca por cliente_id
CREATE INDEX IF NOT EXISTS idx_stores_cliente_id ON stores(cliente_id) WHERE cliente_id IS NOT NULL;

-- 4. Importar clientes do CRM que ainda não têm store vinculada
-- Cada cliente do CRM vira uma store no App Campo
INSERT INTO stores (name, brand, corporate_name, cnpj, address, neighborhood, state, zip_code, email, phone, cliente_id, origem)
SELECT
  COALESCE(c.nome_fantasia, c.razao_social) as name,
  COALESCE(c.nome_fantasia, c.razao_social) as brand,
  c.razao_social as corporate_name,
  COALESCE(c.cnpj, c.cpf_cnpj) as cnpj,
  CONCAT_WS(', ', c.endereco, c.numero, c.complemento) as address,
  c.bairro as neighborhood,
  c.estado as state,
  c.cep as zip_code,
  c.email as email,
  c.telefone as phone,
  c.id as cliente_id,
  'crm' as origem
FROM clientes c
WHERE c.ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM stores s WHERE s.cliente_id = c.id
  );
