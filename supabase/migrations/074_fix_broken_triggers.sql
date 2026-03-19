-- supabase/migrations/074_fix_broken_triggers.sql
-- Fix: triggers de produção/estoque com referências quebradas

-- 1. fn_producao_debita_estoque: modelo_composicoes → modelo_materiais, observacao → motivo
CREATE OR REPLACE FUNCTION fn_producao_debita_estoque()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Só executa quando OP muda para 'finalizado'
  IF NEW.status = 'finalizado' AND (OLD.status IS DISTINCT FROM 'finalizado') THEN
    INSERT INTO estoque_movimentacoes (
      material_id, tipo, quantidade, motivo, referencia_tipo, referencia_id, created_at
    )
    SELECT
      mm.material_id,
      'saida',
      mm.quantidade * pi.quantidade,
      'Baixa automática - OP ' || NEW.numero,
      'ordem_producao',
      NEW.id,
      NOW()
    FROM pedido_itens pi
    JOIN modelo_materiais mm ON mm.modelo_id = pi.modelo_id
    WHERE pi.pedido_id = NEW.pedido_id;

    -- Atualizar saldos
    UPDATE estoque_saldos es SET
      quantidade_disponivel = es.quantidade_disponivel - sub.qtd_total,
      updated_at = NOW()
    FROM (
      SELECT
        mm.material_id,
        SUM(mm.quantidade * pi.quantidade) as qtd_total
      FROM pedido_itens pi
      JOIN modelo_materiais mm ON mm.modelo_id = pi.modelo_id
      WHERE pi.pedido_id = NEW.pedido_id
      GROUP BY mm.material_id
    ) sub
    WHERE es.material_id = sub.material_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Recriar trigger (drop + create para garantir)
DROP TRIGGER IF EXISTS trg_producao_debita_estoque ON ordens_producao;
CREATE TRIGGER trg_producao_debita_estoque
  AFTER UPDATE OF status ON ordens_producao
  FOR EACH ROW
  WHEN (NEW.status = 'finalizado')
  EXECUTE FUNCTION fn_producao_debita_estoque();

-- 2. fn_producao_estoque: remover referências a NEW.modelo_id e NEW.quantidade
CREATE OR REPLACE FUNCTION fn_producao_estoque()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Reservar materiais quando OP entra em produção
  IF NEW.status = 'em_producao' AND (OLD.status IS DISTINCT FROM 'em_producao') THEN
    INSERT INTO estoque_movimentacoes (
      material_id, tipo, quantidade, motivo, referencia_tipo, referencia_id, created_at
    )
    SELECT
      mm.material_id,
      'reserva',
      mm.quantidade * pi.quantidade,
      'Reserva - OP ' || NEW.numero,
      'ordem_producao',
      NEW.id,
      NOW()
    FROM pedido_itens pi
    JOIN modelo_materiais mm ON mm.modelo_id = pi.modelo_id
    WHERE pi.pedido_id = NEW.pedido_id
      AND pi.id = NEW.pedido_item_id;

    -- Atualizar quantidade_reservada nos saldos
    UPDATE estoque_saldos es SET
      quantidade_reservada = COALESCE(es.quantidade_reservada, 0) + sub.qtd_total,
      updated_at = NOW()
    FROM (
      SELECT
        mm.material_id,
        SUM(mm.quantidade * pi.quantidade) as qtd_total
      FROM pedido_itens pi
      JOIN modelo_materiais mm ON mm.modelo_id = pi.modelo_id
      WHERE pi.pedido_id = NEW.pedido_id
        AND pi.id = NEW.pedido_item_id
      GROUP BY mm.material_id
    ) sub
    WHERE es.material_id = sub.material_id;
  END IF;

  -- Liberar reserva quando OP finaliza
  IF NEW.status = 'finalizado' AND (OLD.status IS DISTINCT FROM 'finalizado') THEN
    UPDATE estoque_saldos es SET
      quantidade_reservada = GREATEST(0, COALESCE(es.quantidade_reservada, 0) - sub.qtd_total),
      updated_at = NOW()
    FROM (
      SELECT
        mm.material_id,
        SUM(mm.quantidade * pi.quantidade) as qtd_total
      FROM pedido_itens pi
      JOIN modelo_materiais mm ON mm.modelo_id = pi.modelo_id
      WHERE pi.pedido_id = NEW.pedido_id
        AND pi.id = NEW.pedido_item_id
      GROUP BY mm.material_id
    ) sub
    WHERE es.material_id = sub.material_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Recriar trigger
DROP TRIGGER IF EXISTS trg_producao_estoque ON ordens_producao;
CREATE TRIGGER trg_producao_estoque
  AFTER UPDATE OF status ON ordens_producao
  FOR EACH ROW
  EXECUTE FUNCTION fn_producao_estoque();

-- 3. Fix fn_compra_recebimento_estoque: garantir uso de 'motivo' (não 'observacao')
CREATE OR REPLACE FUNCTION fn_compra_recebimento_estoque()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'recebido' AND (OLD.status IS DISTINCT FROM 'recebido') THEN
    INSERT INTO estoque_movimentacoes (
      material_id, tipo, quantidade, motivo, referencia_tipo, referencia_id, created_at
    )
    SELECT
      pci.material_id,
      'entrada',
      pci.quantidade_recebida,
      'Recebimento pedido compra ' || NEW.numero,
      'pedido_compra',
      NEW.id,
      NOW()
    FROM pedidos_compra_itens pci
    WHERE pci.pedido_compra_id = NEW.id
      AND pci.quantidade_recebida > 0;

    -- Atualizar ou criar saldos
    INSERT INTO estoque_saldos (material_id, quantidade_disponivel, updated_at)
    SELECT
      pci.material_id,
      pci.quantidade_recebida,
      NOW()
    FROM pedidos_compra_itens pci
    WHERE pci.pedido_compra_id = NEW.id
      AND pci.quantidade_recebida > 0
    ON CONFLICT (material_id)
    DO UPDATE SET
      quantidade_disponivel = estoque_saldos.quantidade_disponivel + EXCLUDED.quantidade_disponivel,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;
