-- Migration 011: Adiciona lock pessimista na RPC de geração de número NF-e
-- Evita duplicidade de numeração em emissões simultâneas
-- Sem FOR UPDATE, duas emissões simultâneas podiam gerar o mesmo número (cStat 204)

CREATE OR REPLACE FUNCTION fiscal_proximo_numero_serie(p_serie_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_proximo integer;
BEGIN
  -- FOR UPDATE: bloqueia a linha até o commit, impedindo concorrência
  SELECT proximo_numero
  INTO v_proximo
  FROM fiscal_series
  WHERE id = p_serie_id
  FOR UPDATE;

  IF v_proximo IS NULL THEN
    RAISE EXCEPTION 'Série fiscal não encontrada: %', p_serie_id;
  END IF;

  -- Incrementa atomicamente
  UPDATE fiscal_series
  SET proximo_numero = proximo_numero + 1,
      updated_at = now()
  WHERE id = p_serie_id;

  RETURN v_proximo;
END;
$$;
