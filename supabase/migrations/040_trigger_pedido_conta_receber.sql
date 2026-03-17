-- 040_trigger_pedido_conta_receber.sql
-- When a pedido is approved, auto-create a conta_receber entry

CREATE OR REPLACE FUNCTION fn_pedido_gera_conta_receber()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'aprovado' AND (OLD.status IS DISTINCT FROM 'aprovado') THEN
    INSERT INTO contas_receber (
      numero_titulo, valor_original, saldo, data_vencimento, cliente_id, pedido_id, status
    )
    VALUES (
      'PED-' || NEW.numero,
      NEW.valor_total,
      NEW.valor_total,
      NOW() + INTERVAL '30 days',
      NEW.cliente_id,
      NEW.id,
      'previsto'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pedido_gera_conta_receber ON pedidos;
CREATE TRIGGER trg_pedido_gera_conta_receber
  AFTER UPDATE OF status ON pedidos
  FOR EACH ROW EXECUTE FUNCTION fn_pedido_gera_conta_receber();

-- Also trigger on INSERT when status is already 'aprovado'
DROP TRIGGER IF EXISTS trg_pedido_insert_conta_receber ON pedidos;
CREATE TRIGGER trg_pedido_insert_conta_receber
  AFTER INSERT ON pedidos
  FOR EACH ROW
  WHEN (NEW.status = 'aprovado')
  EXECUTE FUNCTION fn_pedido_gera_conta_receber();
