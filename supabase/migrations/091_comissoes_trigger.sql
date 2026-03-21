-- Migration 091 — Trigger automático de comissões
-- Gera comissão de 5% quando pedido muda para 'faturado'
-- Adaptado para estrutura real: comissoes.vendedor_id, valor_base, valor_comissao

CREATE OR REPLACE FUNCTION fn_gerar_comissao_auto()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_valor_comissao numeric;
  v_valor_base     numeric;
  v_vendedor_id    uuid;
BEGIN
  -- Só age quando status muda para 'faturado'
  IF NEW.status <> 'faturado' OR OLD.status = 'faturado' THEN
    RETURN NEW;
  END IF;

  -- Idempotência: não duplicar comissão
  IF EXISTS (
    SELECT 1 FROM comissoes WHERE pedido_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  v_valor_base     := COALESCE(NEW.valor_total, 0);
  v_valor_comissao := v_valor_base * 0.05;
  v_vendedor_id    := NEW.vendedor_id;

  IF v_vendedor_id IS NULL OR v_valor_comissao <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO comissoes (pedido_id, vendedor_id, valor_base, valor_comissao, percentual, status, created_at)
  VALUES (NEW.id, v_vendedor_id, v_valor_base, v_valor_comissao, 5.0, 'pendente', now())
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloquear o update do pedido por erro na comissão
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comissao_auto ON pedidos;
CREATE TRIGGER trg_comissao_auto
  AFTER UPDATE OF status ON pedidos
  FOR EACH ROW EXECUTE FUNCTION fn_gerar_comissao_auto();
