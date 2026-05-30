-- DB-006b shadow guard (ciclo autonomo #55, 2026-05-30) — WARN-ONLY, NAO altera preco/fluxo.
-- Loga em system_events quando proposta_itens/pedido_itens e gravado com valor_unitario <= 0
-- PORQUE o produto nao tem fonte de preco (sem produto_modelos ativo com BOM/modelo_materiais
-- nem preco_fixo). Materializa o landmine DB-006 (53 produtos sem modelo) / DB-007 (BOM vazia).
-- Espelha o padrao validado do trg_op_status_transition_shadow (#51): AFTER + BEGIN/EXCEPTION
-- WHEN OTHERS THEN RETURN NEW => jamais aborta o INSERT/UPDATE do item.
-- Aplicada via apply_migration (mesmo nome). Idempotente (CREATE OR REPLACE + DROP TRIGGER IF EXISTS).

CREATE OR REPLACE FUNCTION public.fn_orcamento_item_preco_zero_shadow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tem_fonte_preco boolean;
BEGIN
  -- defensivo: so interessa item com produto vinculado e preco unitario <= 0
  IF NEW.produto_id IS NULL OR COALESCE(NEW.valor_unitario, 0) > 0 THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.produto_modelos pm
    WHERE pm.produto_id = NEW.produto_id
      AND pm.ativo IS TRUE
      AND (
        EXISTS (SELECT 1 FROM public.modelo_materiais mm WHERE mm.modelo_id = pm.id)
        OR (pm.preco_fixo IS NOT NULL AND pm.preco_fixo > 0)
      )
  ) INTO v_tem_fonte_preco;

  IF v_tem_fonte_preco IS NOT TRUE THEN
    INSERT INTO public.system_events (event_type, entity_type, entity_id, payload)
    VALUES (
      'orcamento_item_preco_zero_sem_modelo',
      TG_TABLE_NAME,
      NEW.id,
      jsonb_build_object(
        'motivo', 'valor_unitario<=0 e produto sem produto_modelos ativo com BOM ou preco_fixo (landmine DB-006/DB-007 materializado)',
        'produto_id', NEW.produto_id,
        'valor_unitario', NEW.valor_unitario,
        'item', to_jsonb(NEW),
        'detectado_em', now()
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- warn-only: nunca abortar a gravacao do item
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orcamento_item_preco_zero_shadow ON public.proposta_itens;
CREATE TRIGGER trg_orcamento_item_preco_zero_shadow
AFTER INSERT OR UPDATE OF valor_unitario, produto_id ON public.proposta_itens
FOR EACH ROW
WHEN (COALESCE(NEW.valor_unitario, 0) <= 0 AND NEW.produto_id IS NOT NULL)
EXECUTE FUNCTION public.fn_orcamento_item_preco_zero_shadow();

DROP TRIGGER IF EXISTS trg_orcamento_item_preco_zero_shadow ON public.pedido_itens;
CREATE TRIGGER trg_orcamento_item_preco_zero_shadow
AFTER INSERT OR UPDATE OF valor_unitario, produto_id ON public.pedido_itens
FOR EACH ROW
WHEN (COALESCE(NEW.valor_unitario, 0) <= 0 AND NEW.produto_id IS NOT NULL)
EXECUTE FUNCTION public.fn_orcamento_item_preco_zero_shadow();
