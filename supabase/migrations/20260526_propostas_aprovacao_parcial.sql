-- 20260526_propostas_aprovacao_parcial.sql
-- FASE 2-B — Novos status logicos: 'aprovacao_parcial' e 'aprovada_cliente'.
-- Idempotente — apenas amplia o conjunto de status validos do CHECK existente,
-- se houver. Tambem cria index para queries por status.

-- Removemos qualquer CHECK previa em propostas.status para amplia-la.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.propostas'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.propostas DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END$$;

-- Nova CHECK abrangente. Mantemos os status historicos + os novos da FASE 2-B.
ALTER TABLE public.propostas
  ADD CONSTRAINT propostas_status_check
  CHECK (status IN (
    'rascunho','enviada','visualizada','negociacao',
    'aprovacao_parcial','aprovada_cliente',
    'aprovada','recusada','expirada','convertida','cancelada'
  ));

CREATE INDEX IF NOT EXISTS propostas_status_idx ON public.propostas(status);
