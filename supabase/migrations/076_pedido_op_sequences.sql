-- supabase/migrations/076_pedido_op_sequences.sql
-- Numeração atômica para pedidos e OPs via sequences do Postgres

-- Sequence para pedidos (iniciar do último existente)
DO $$
DECLARE
  v_max INT;
BEGIN
  SELECT COALESCE(MAX(
    CASE WHEN numero ~ '^PED-\d{4}-\d+$'
    THEN SUBSTRING(numero FROM 'PED-\d{4}-(\d+)')::INT
    ELSE 0 END
  ), 0) INTO v_max FROM pedidos;

  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS pedido_numero_seq START WITH %s', v_max + 1);
END;
$$;

-- Sequence para OPs
DO $$
DECLARE
  v_max INT;
BEGIN
  SELECT COALESCE(MAX(
    CASE WHEN numero ~ '^OP-\d{4}-\d+$'
    THEN SUBSTRING(numero FROM 'OP-\d{4}-(\d+)')::INT
    ELSE 0 END
  ), 0) INTO v_max FROM ordens_producao;

  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS op_numero_seq START WITH %s', v_max + 1);
END;
$$;

-- RPC para gerar número de pedido atomicamente
CREATE OR REPLACE FUNCTION gerar_numero_pedido()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq INT;
  v_ano INT;
BEGIN
  v_ano := EXTRACT(YEAR FROM NOW())::INT;
  v_seq := nextval('pedido_numero_seq');
  RETURN 'PED-' || v_ano || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;

-- RPC para gerar número de OP atomicamente
CREATE OR REPLACE FUNCTION gerar_numero_op()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq INT;
  v_ano INT;
BEGIN
  v_ano := EXTRACT(YEAR FROM NOW())::INT;
  v_seq := nextval('op_numero_seq');
  RETURN 'OP-' || v_ano || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;
