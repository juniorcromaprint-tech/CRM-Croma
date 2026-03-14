-- 027_rls_blindagem.sql
-- Sprint 1 Blindagem: RLS on 8 critical tables, FK indexes, NOT NULL constraints, clean R$0 propostas

-- ============================================================
-- TASK 1: Enable RLS on 8 critical tables
-- ============================================================

-- 1. clientes
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage clientes" ON clientes;
CREATE POLICY "Authenticated users can manage clientes"
  ON clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. propostas
ALTER TABLE propostas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage propostas" ON propostas;
CREATE POLICY "Authenticated users can manage propostas"
  ON propostas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. proposta_itens
ALTER TABLE proposta_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage proposta_itens" ON proposta_itens;
CREATE POLICY "Authenticated users can manage proposta_itens"
  ON proposta_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. pedidos
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage pedidos" ON pedidos;
CREATE POLICY "Authenticated users can manage pedidos"
  ON pedidos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. pedido_itens
ALTER TABLE pedido_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage pedido_itens" ON pedido_itens;
CREATE POLICY "Authenticated users can manage pedido_itens"
  ON pedido_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. leads
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage leads" ON leads;
CREATE POLICY "Authenticated users can manage leads"
  ON leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. contas_receber
ALTER TABLE contas_receber ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage contas_receber" ON contas_receber;
CREATE POLICY "Authenticated users can manage contas_receber"
  ON contas_receber FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. contas_pagar
ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage contas_pagar" ON contas_pagar;
CREATE POLICY "Authenticated users can manage contas_pagar"
  ON contas_pagar FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- TASK 2: Indexes on high-traffic Foreign Keys
-- Note: contas_pagar uses pedido_compra_id (not pedido_id)
--       instalacoes table does not exist in this schema
--       leads has no cliente_id column
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_id ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_proposta_id ON pedidos(proposta_id);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido_id ON pedido_itens(pedido_id);
CREATE INDEX IF NOT EXISTS idx_proposta_itens_proposta_id ON proposta_itens(proposta_id);
CREATE INDEX IF NOT EXISTS idx_propostas_cliente_id ON propostas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordens_producao_pedido_id ON ordens_producao(pedido_id);
CREATE INDEX IF NOT EXISTS idx_ordens_producao_pedido_item_id ON ordens_producao(pedido_item_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_pedido_id ON contas_receber(pedido_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_cliente_id ON contas_receber(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_pedido_compra_id ON contas_pagar(pedido_compra_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_documentos_pedido_id ON fiscal_documentos(pedido_id);

-- ============================================================
-- TASK 3: NOT NULL constraints on critical fields
-- Note: propostas uses column 'total' not 'valor_total'
-- ============================================================

-- pedidos.status
UPDATE pedidos SET status = 'novo' WHERE status IS NULL;
ALTER TABLE pedidos ALTER COLUMN status SET DEFAULT 'novo';
ALTER TABLE pedidos ALTER COLUMN status SET NOT NULL;
-- pedidos.valor_total
UPDATE pedidos SET valor_total = 0 WHERE valor_total IS NULL;
ALTER TABLE pedidos ALTER COLUMN valor_total SET DEFAULT 0;
ALTER TABLE pedidos ALTER COLUMN valor_total SET NOT NULL;

-- propostas.status
UPDATE propostas SET status = 'rascunho' WHERE status IS NULL;
ALTER TABLE propostas ALTER COLUMN status SET DEFAULT 'rascunho';
ALTER TABLE propostas ALTER COLUMN status SET NOT NULL;
-- propostas.total
UPDATE propostas SET total = 0 WHERE total IS NULL;
ALTER TABLE propostas ALTER COLUMN total SET DEFAULT 0;
ALTER TABLE propostas ALTER COLUMN total SET NOT NULL;

-- pedido_itens.quantidade
UPDATE pedido_itens SET quantidade = 1 WHERE quantidade IS NULL;
ALTER TABLE pedido_itens ALTER COLUMN quantidade SET DEFAULT 1;
ALTER TABLE pedido_itens ALTER COLUMN quantidade SET NOT NULL;

-- proposta_itens.quantidade
UPDATE proposta_itens SET quantidade = 1 WHERE quantidade IS NULL;
ALTER TABLE proposta_itens ALTER COLUMN quantidade SET DEFAULT 1;
ALTER TABLE proposta_itens ALTER COLUMN quantidade SET NOT NULL;

-- ordens_producao.status
UPDATE ordens_producao SET status = 'pendente' WHERE status IS NULL;
ALTER TABLE ordens_producao ALTER COLUMN status SET DEFAULT 'pendente';
ALTER TABLE ordens_producao ALTER COLUMN status SET NOT NULL;

-- ============================================================
-- TASK 4: Clean corrupted R$0 propostas
-- Disable status-transition trigger to allow data cleanup,
-- then re-enable it immediately after.
-- ============================================================
ALTER TABLE propostas DISABLE TRIGGER trigger_validar_status_propostas;

UPDATE propostas
SET status = 'rascunho'
WHERE total = 0 AND status NOT IN ('rascunho', 'cancelado');

ALTER TABLE propostas ENABLE TRIGGER trigger_validar_status_propostas;
