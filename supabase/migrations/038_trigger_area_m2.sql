-- 038_trigger_area_m2.sql
-- Auto-calculate area_m2 from largura_cm and altura_cm

CREATE OR REPLACE FUNCTION fn_calc_area_m2()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.largura_cm IS NOT NULL AND NEW.altura_cm IS NOT NULL THEN
    NEW.area_m2 := (NEW.largura_cm * NEW.altura_cm) / 10000.0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to proposta_itens (quote items)
DROP TRIGGER IF EXISTS trg_calc_area_m2_proposta_itens ON proposta_itens;
CREATE TRIGGER trg_calc_area_m2_proposta_itens
  BEFORE INSERT OR UPDATE OF largura_cm, altura_cm ON proposta_itens
  FOR EACH ROW EXECUTE FUNCTION fn_calc_area_m2();

-- Apply to pedido_itens (order items)
DROP TRIGGER IF EXISTS trg_calc_area_m2_pedido_itens ON pedido_itens;
CREATE TRIGGER trg_calc_area_m2_pedido_itens
  BEFORE INSERT OR UPDATE OF largura_cm, altura_cm ON pedido_itens
  FOR EACH ROW EXECUTE FUNCTION fn_calc_area_m2();

-- Apply to modelo_composicoes if it has these columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modelo_composicoes' AND column_name = 'largura_cm'
  ) THEN
    DROP TRIGGER IF EXISTS trg_calc_area_m2_modelo_composicoes ON modelo_composicoes;
    CREATE TRIGGER trg_calc_area_m2_modelo_composicoes
      BEFORE INSERT OR UPDATE OF largura_cm, altura_cm ON modelo_composicoes
      FOR EACH ROW EXECUTE FUNCTION fn_calc_area_m2();
  END IF;
END $$;
