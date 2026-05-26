-- 20260526_propostas_assinatura_cliente.sql
-- FASE 2-F — Assinatura digital touch capturada no portal.
-- URL aponta pra Storage (bucket proposta-assinaturas) via Edge portal-upload-assinatura.
-- Idempotente.

ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS assinatura_cliente_url text;

ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS assinatura_cliente_at timestamptz;

COMMENT ON COLUMN public.propostas.assinatura_cliente_url IS
  'URL (signed, TTL ~1 ano) do PNG da assinatura digital capturada no canvas signature_pad do portal.';
COMMENT ON COLUMN public.propostas.assinatura_cliente_at IS
  'Timestamp do momento em que a assinatura foi gravada (set pela RPC portal_aprovar_proposta v2).';
