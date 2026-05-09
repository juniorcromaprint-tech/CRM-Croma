-- ============================================================================
-- 148 — Pipeline de validação de email (preview sem UPDATE)
-- ============================================================================
-- 1) staging.email_validation_2026_05 — recebe export do Hunter/NeverBounce
-- 2) fn_preview_email_validation_2026_05() — só lê, mostra ações propostas
-- 3) fn_apply_email_validation_2026_05(p_dry_run) — aplica UPDATE só se false
-- 4) vw_calcados_export_validacao — view consolidada para export pro Hunter
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS staging;

CREATE TABLE IF NOT EXISTS staging.email_validation_2026_05 (
  lead_id      uuid PRIMARY KEY,
  email        text NOT NULL,
  status       text NOT NULL CHECK (status IN
    ('valid','invalid','catch_all','accept_all','disposable','risky','unknown','webmail','gibberish')),
  validador    text NOT NULL CHECK (validador IN ('hunter','neverbounce','zerobounce','apollo','manual')),
  raw          jsonb,
  importado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_validation_status ON staging.email_validation_2026_05(status);
CREATE INDEX IF NOT EXISTS idx_email_validation_validador ON staging.email_validation_2026_05(validador);

CREATE OR REPLACE FUNCTION public.fn_preview_email_validation_2026_05()
RETURNS TABLE(status text, total bigint, acao_proposta text)
LANGUAGE sql STABLE
AS $$
  SELECT
    s.status,
    COUNT(*) AS total,
    CASE
      WHEN s.status IN ('invalid','disposable','gibberish') THEN 'BLOQUEAR (NAO INCLUIR)'
      WHEN s.status IN ('risky','unknown')                   THEN 'BLOQUEAR (NAO INCLUIR — conservador)'
      WHEN s.status IN ('catch_all','accept_all')            THEN 'MANTER mas NAO incluir nas campanhas iniciais'
      WHEN s.status = 'webmail'                              THEN 'MANTER, marcar como webmail'
      WHEN s.status = 'valid'                                THEN 'MANTER e elegivel'
      ELSE 'manual'
    END
  FROM staging.email_validation_2026_05 s
  GROUP BY s.status
  ORDER BY 2 DESC;
$$;

CREATE OR REPLACE FUNCTION public.fn_apply_email_validation_2026_05(p_dry_run boolean DEFAULT true)
RETURNS TABLE(acao text, qtd bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, staging
AS $$
DECLARE
  v_bloqueados int;
BEGIN
  IF p_dry_run THEN
    SELECT COUNT(*) INTO v_bloqueados
    FROM staging.email_validation_2026_05 s
    JOIN public.leads l ON l.id = s.lead_id
    WHERE s.status IN ('invalid', 'disposable', 'risky', 'unknown', 'gibberish')
      AND COALESCE(l.observacoes, '') NOT ILIKE '%NAO INCLUIR%';
    acao := 'DRY RUN - leads que SERIAM bloqueados'; qtd := v_bloqueados;
    RETURN NEXT; RETURN;
  END IF;

  WITH upd AS (
    UPDATE public.leads l
    SET observacoes = COALESCE(l.observacoes || E'\n', '') ||
                      '[NAO INCLUIR — ' || s.status || ' via ' || s.validador ||
                      ' em ' || to_char(s.importado_em, 'YYYY-MM-DD') || ']'
    FROM staging.email_validation_2026_05 s
    WHERE l.id = s.lead_id
      AND s.status IN ('invalid', 'disposable', 'risky', 'unknown', 'gibberish')
      AND COALESCE(l.observacoes, '') NOT ILIKE '%NAO INCLUIR%'
    RETURNING l.id
  )
  SELECT 'leads bloqueados', COUNT(*)::bigint FROM upd
  INTO acao, qtd;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_apply_email_validation_2026_05(boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_apply_email_validation_2026_05(boolean) TO service_role;

CREATE OR REPLACE VIEW public.vw_calcados_export_validacao AS
SELECT
  v.id AS lead_id, v.empresa, v.contato_nome,
  v.email_norm, v.cidade, v.estado, v.score, v.classificacao
FROM vw_calcados_para_validacao v
ORDER BY
  CASE v.classificacao
    WHEN 'ok_para_validar' THEN 1
    WHEN 'prefixo_generico' THEN 2
    WHEN 'dominio_alto_risco' THEN 3
    ELSE 4
  END,
  v.score DESC NULLS LAST, v.email_norm;
