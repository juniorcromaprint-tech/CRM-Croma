-- ============================================================================
-- 147 — Pré-seleção dos 30 leads para campanha de reabilitação (calçados)
-- ============================================================================
-- Após disparo de 08/05 com 14% bounce, esta view define a lista controlada
-- de 30 leads para retomar disparo APÓS validação externa em Hunter/NeverBounce.
-- Critério: ok_para_validar + ordenado por tipo_dominio (corporate antes) + score.
-- NÃO disparar antes de validação externa + aprovação do Junior.
-- ============================================================================

CREATE OR REPLACE VIEW public.vw_proxima_campanha_calcados_30 AS
SELECT
  v.id           AS lead_id,
  v.empresa,
  v.contato_nome,
  v.email_norm   AS email,
  v.cidade, v.estado, v.score,
  CASE
    WHEN LOWER(SPLIT_PART(v.email_norm, '@', 2)) IN
      ('gmail.com','hotmail.com','outlook.com','yahoo.com','yahoo.com.br') THEN 'webmail'
    ELSE 'corporate'
  END AS tipo_dominio
FROM vw_calcados_para_validacao v
WHERE v.classificacao = 'ok_para_validar'
ORDER BY
  CASE WHEN LOWER(SPLIT_PART(v.email_norm, '@', 2)) IN
    ('gmail.com','hotmail.com','outlook.com','yahoo.com','yahoo.com.br') THEN 1 ELSE 0 END,
  v.score DESC NULLS LAST,
  v.email_norm
LIMIT 30;

COMMENT ON VIEW public.vw_proxima_campanha_calcados_30 IS
  'Pré-seleção dos 30 leads para a próxima campanha de reabilitação após bounce 14% em 08/05/2026. NÃO disparar antes de validação Hunter/NeverBounce.';
