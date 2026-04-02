-- 110_trigger_proposta_aprovada_cria_pedido.sql
-- BUG-01 Fix: Quando vendedor aprova proposta internamente no ERP (status → 'aprovada'),
-- criar pedido automaticamente se ainda não existir.
-- A função portal_aprovar_proposta já cobre o fluxo via portal do cliente.
-- Este trigger cobre o fluxo interno (vendedor aprova no ERP).

CREATE OR REPLACE FUNCTION fn_proposta_aprovada_cria_pedido()
RETURNS TRIGGER AS $$
DECLARE
  v_pedido_id  UUID;
  v_numero     TEXT;
  v_ano        INT;
  v_seq        INT;
  v_item       RECORD;
  v_exists     INT;
BEGIN
  -- Só dispara quando status muda PARA 'aprovada'
  IF NEW.status != 'aprovada' OR OLD.status = 'aprovada' THEN
    RETURN NEW;
  END IF;

  -- Idempotente: não cria pedido se já existe um vinculado a esta proposta
  SELECT COUNT(*) INTO v_exists FROM pedidos WHERE proposta_id = NEW.id;
  IF v_exists > 0 THEN
    RETURN NEW;
  END IF;

  -- Gerar número do pedido (formato PED-YYYY-NNNN)
  v_ano := EXTRACT(YEAR FROM NOW())::INT;
  SELECT COALESCE(MAX(
    CASE WHEN numero ~ ('^PED-' || v_ano || '-\d+$')
    THEN SUBSTRING(numero FROM '[0-9]+$')::INT
    ELSE 0 END
  ), 0) + 1
  INTO v_seq
  FROM pedidos;

  v_numero := 'PED-' || v_ano || '-' || LPAD(v_seq::TEXT, 4, '0');
  v_pedido_id := gen_random_uuid();

  -- Criar pedido com status aguardando_aprovacao (aprovação interna da equipe)
  INSERT INTO pedidos (
    id, numero, proposta_id, cliente_id, vendedor_id,
    status, valor_total, created_at, updated_at
  ) VALUES (
    v_pedido_id,
    v_numero,
    NEW.id,
    NEW.cliente_id,
    NEW.vendedor_id,
    'aguardando_aprovacao',
    COALESCE(NEW.total, NEW.subtotal, 0),
    NOW(),
    NOW()
  );

  -- Copiar itens da proposta para o pedido
  FOR v_item IN
    SELECT * FROM proposta_itens WHERE proposta_id = NEW.id ORDER BY ordem
  LOOP
    INSERT INTO pedido_itens (
      id, pedido_id, descricao, quantidade, valor_unitario, valor_total,
      unidade, modelo_id, area_m2, largura_cm, altura_cm,
      custo_mp, custo_mo, custo_fixo, markup_percentual,
      created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_pedido_id,
      v_item.descricao,
      v_item.quantidade,
      v_item.valor_unitario,
      v_item.valor_total,
      COALESCE(v_item.unidade, 'un'),
      v_item.modelo_id,
      v_item.area_m2,
      v_item.largura_cm,
      v_item.altura_cm,
      v_item.custo_mp,
      v_item.custo_mo,
      v_item.custo_fixo,
      v_item.markup_percentual,
      NOW(),
      NOW()
    );
  END LOOP;

  RAISE NOTICE '[110] Pedido % criado automaticamente para proposta %', v_numero, NEW.id;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Não bloqueia a aprovação da proposta se o pedido falhar
  RAISE WARNING '[110] fn_proposta_aprovada_cria_pedido falhou para proposta %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Registrar trigger
DROP TRIGGER IF EXISTS trg_proposta_aprovada_cria_pedido ON propostas;
CREATE TRIGGER trg_proposta_aprovada_cria_pedido
  AFTER UPDATE OF status ON propostas
  FOR EACH ROW
  EXECUTE FUNCTION fn_proposta_aprovada_cria_pedido();

-- ─── Fix retroativo: criar pedido para proposta c4f3e871 que ficou sem pedido ─────
DO $$
DECLARE
  v_proposta RECORD;
  v_pedido_id UUID;
  v_numero TEXT;
  v_ano INT;
  v_seq INT;
  v_item RECORD;
BEGIN
  SELECT * INTO v_proposta FROM propostas WHERE id = 'c4f3e871-d0a3-49de-a796-26193e9f5d04';

  IF NOT FOUND THEN
    RAISE NOTICE '[110-retro] Proposta c4f3e871 não encontrada — skip';
    RETURN;
  END IF;

  -- Verificar se já foi corrigida
  IF EXISTS (SELECT 1 FROM pedidos WHERE proposta_id = v_proposta.id) THEN
    RAISE NOTICE '[110-retro] Proposta c4f3e871 já tem pedido — skip';
    RETURN;
  END IF;

  v_ano := EXTRACT(YEAR FROM NOW())::INT;
  SELECT COALESCE(MAX(
    CASE WHEN numero ~ ('^PED-' || v_ano || '-\d+$')
    THEN SUBSTRING(numero FROM '[0-9]+$')::INT
    ELSE 0 END
  ), 0) + 1
  INTO v_seq
  FROM pedidos;

  v_numero := 'PED-' || v_ano || '-' || LPAD(v_seq::TEXT, 4, '0');
  v_pedido_id := gen_random_uuid();

  INSERT INTO pedidos (
    id, numero, proposta_id, cliente_id, vendedor_id,
    status, valor_total, created_at, updated_at
  ) VALUES (
    v_pedido_id, v_numero, v_proposta.id,
    v_proposta.cliente_id, v_proposta.vendedor_id,
    'aguardando_aprovacao',
    COALESCE(v_proposta.total, v_proposta.subtotal, 0),
    NOW(), NOW()
  );

  FOR v_item IN
    SELECT * FROM proposta_itens WHERE proposta_id = v_proposta.id ORDER BY ordem
  LOOP
    INSERT INTO pedido_itens (
      id, pedido_id, descricao, quantidade, valor_unitario, valor_total,
      unidade, modelo_id, area_m2, largura_cm, altura_cm,
      custo_mp, custo_mo, custo_fixo, markup_percentual,
      created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_pedido_id,
      v_item.descricao, v_item.quantidade, v_item.valor_unitario, v_item.valor_total,
      COALESCE(v_item.unidade, 'un'), v_item.modelo_id,
      v_item.area_m2, v_item.largura_cm, v_item.altura_cm,
      v_item.custo_mp, v_item.custo_mo, v_item.custo_fixo, v_item.markup_percentual,
      NOW(), NOW()
    );
  END LOOP;

  RAISE NOTICE '[110-retro] Pedido % criado para proposta c4f3e871 (R$ %)', v_numero, v_proposta.total;
END $$;
