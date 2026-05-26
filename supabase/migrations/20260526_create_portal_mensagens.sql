-- 20260526_create_portal_mensagens.sql
-- FASE 2-E — Chat persistido por proposta. RPCs em arquivo separado.
-- Idempotente.

CREATE TABLE IF NOT EXISTS public.portal_mensagens (
  id          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposta_id uuid NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  remetente   text NOT NULL CHECK (remetente IN ('cliente','vendedor','ia')),
  conteudo    text NOT NULL,
  metadata    jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_mensagens_proposta_created_idx
  ON public.portal_mensagens (proposta_id, created_at);

-- RLS: leitura/escrita SOMENTE via RPCs SECURITY DEFINER (portal_listar/inserir_mensagem).
-- Direto pelo PostgREST/anon nao tem acesso.
ALTER TABLE public.portal_mensagens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'portal_mensagens'
      AND policyname = 'portal_mensagens_block_anon'
  ) THEN
    CREATE POLICY portal_mensagens_block_anon
      ON public.portal_mensagens
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END$$;

COMMENT ON TABLE public.portal_mensagens IS
  'Mensagens do chat do portal /p/:token. Inseridas via RPC portal_inserir_mensagem (cliente) ou service_role (vendedor/ia).';
