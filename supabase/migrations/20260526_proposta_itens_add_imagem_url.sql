-- 20260526_proposta_itens_add_imagem_url.sql
-- FASE 2-B — Imagem opcional por item + aprovacao parcial (tri-state).
-- Idempotente.

ALTER TABLE public.proposta_itens
  ADD COLUMN IF NOT EXISTS imagem_url text;

ALTER TABLE public.proposta_itens
  ADD COLUMN IF NOT EXISTS aprovado boolean;

COMMENT ON COLUMN public.proposta_itens.imagem_url IS
  'URL publica/signed de uma imagem ilustrativa do item, exibida no portal /p/:token (PortalItemImagem).';
COMMENT ON COLUMN public.proposta_itens.aprovado IS
  'Tri-state de aprovacao por item via portal: NULL=pendente, TRUE=aprovado, FALSE=recusado.';
