-- 20260526_propostas_add_referencia_prazo_logistica.sql
-- FASE 1 (portal Croma) — campos do briefing-beira-rio v10 espelhados no
-- card do orçamento (PortalInfoOrcamento) + payload de portal_get_proposta.
-- Idempotente — pode ser aplicada várias vezes.

ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS referencia text;

ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS prazo_entrega_dias integer;

ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS logistica text;

COMMENT ON COLUMN public.propostas.referencia IS
  'Referencia comercial digitada pelo vendedor no briefing (ex.: nome da loja, projeto, OS interna).';
COMMENT ON COLUMN public.propostas.prazo_entrega_dias IS
  'Prazo de entrega em dias uteis prometido no briefing — exibido no card PortalInfoOrcamento.';
COMMENT ON COLUMN public.propostas.logistica IS
  'Tipo de logistica: instalado | frete | retirada (ou NULL quando ainda nao definido).';
