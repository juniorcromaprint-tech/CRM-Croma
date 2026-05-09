-- ============================================================================
-- 149 — vw_proxima_campanha_calcados_30 (refinada)
-- ============================================================================
-- Critérios pedidos pelo Junior:
--   - domínio corporativo próprio (sem webmail/ISP)
--   - sem duplicidade por domínio (1 lead/domínio)
--   - prefixo pessoal preferido (genérico só se necessário)
--   - status validado (ou pending) — usa staging.email_validation_2026_05
-- ============================================================================

DROP VIEW IF EXISTS public.vw_proxima_campanha_calcados_30;

CREATE VIEW public.vw_proxima_campanha_calcados_30 AS
WITH base AS (
  SELECT
    v.id AS lead_id, v.empresa, v.contato_nome, v.email_norm AS email,
    v.cidade, v.estado, v.score,
    LOWER(SPLIT_PART(v.email_norm, '@', 2)) AS dominio,
    LOWER(SPLIT_PART(v.email_norm, '@', 1)) AS prefixo,
    CASE
      WHEN LOWER(SPLIT_PART(v.email_norm, '@', 1)) IN
        ('contato','contato2','vendas','venda','pedido','pedidos','financeiro','admin','adm',
         'compras','compras1','comercial','sac','atendimento','marketing','rh','suporte','info',
         'contabil','contabilidade','fiscal','fiscal.nfe','nf','nfe','danfe','boleto','cobranca',
         'recepcao','secretaria','lojas','loja','agendabarueri','cadastro','ecommerce')
      THEN 1 ELSE 0
    END AS prefixo_generico
  FROM vw_calcados_para_validacao v
  WHERE v.classificacao = 'ok_para_validar'
    AND LOWER(SPLIT_PART(v.email_norm, '@', 2)) NOT IN (
      'gmail.com', 'gmail.com.br',
      'hotmail.com', 'hotmail.com.br', 'hotmail.com.ar',
      'outlook.com', 'outlook.com.br',
      'live.com', 'live.com.br',
      'yahoo.com', 'yahoo.com.br',
      'msn.com', 'icloud.com', 'me.com',
      'uol.com.br', 'bol.com.br', 'terra.com.br', 'ig.com.br',
      'globo.com', 'globomail.com', 'superig.com.br',
      'mercadolivre.com', 'mercadolivre.com.br',
      'r7.com', 'oi.com.br', 'pop.com.br', 'zipmail.com.br'
    )
),
com_validacao AS (
  SELECT b.*,
         COALESCE(s.status, 'pending_validation') AS validacao_status
  FROM base b
  LEFT JOIN staging.email_validation_2026_05 s ON s.lead_id = b.lead_id
),
dedup_por_dominio AS (
  SELECT DISTINCT ON (dominio)
    lead_id, empresa, contato_nome, email, cidade, estado, score,
    dominio, prefixo_generico, validacao_status
  FROM com_validacao
  WHERE validacao_status IN ('valid', 'pending_validation')
  ORDER BY dominio, prefixo_generico ASC, score DESC NULLS LAST, email
)
SELECT
  lead_id, empresa, contato_nome, email, cidade, estado, score,
  dominio, prefixo_generico, validacao_status
FROM dedup_por_dominio
ORDER BY prefixo_generico ASC, score DESC NULLS LAST, email
LIMIT 30;

COMMENT ON VIEW public.vw_proxima_campanha_calcados_30 IS
  'Pré-seleção dos 30 leads para campanha de reabilitação. Critérios: domínio corporativo próprio, 1 lead/domínio, prefixo pessoal preferido, validacao_status IN (valid, pending_validation). Aguardando aprovação Junior + validação Hunter.';
