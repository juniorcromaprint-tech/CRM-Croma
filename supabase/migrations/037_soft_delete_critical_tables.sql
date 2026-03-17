-- 037_soft_delete_critical_tables.sql
-- Add soft delete columns to the 10 most critical transactional tables

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'leads', 'pedidos', 'pedido_itens', 'ordens_producao',
    'contas_pagar', 'contas_receber', 'pedidos_compra', 'pedido_compra_itens',
    'estoque_movimentacoes', 'fiscal_documentos'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS excluido_em TIMESTAMPTZ DEFAULT NULL', tbl
    );
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS excluido_por UUID DEFAULT NULL REFERENCES profiles(id)', tbl
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%s_excluido ON %I (excluido_em) WHERE excluido_em IS NULL', tbl, tbl
    );
  END LOOP;
END $$;
