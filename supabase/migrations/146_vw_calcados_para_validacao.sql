-- ============================================================================
-- 146 — View de leads do segmento Calçados pré-classificados para validação
-- ============================================================================
-- Após o disparo de 2026-05-08 que retornou 14% de bounce, criamos esta view
-- para ajudar na limpeza da base antes do próximo envio.
-- Inclui: dedup por email + classificação automática de risco.
-- ============================================================================

CREATE OR REPLACE VIEW public.vw_calcados_para_validacao AS
WITH dedup AS (
  SELECT DISTINCT ON (LOWER(COALESCE(NULLIF(v.contato_email, ''), v.email)))
    v.id,
    v.empresa,
    v.contato_nome,
    LOWER(COALESCE(NULLIF(v.contato_email, ''), v.email)) AS email_norm,
    v.contato_email AS email_original_contato,
    v.email AS email_original_secundario,
    v.cidade, v.estado, v.segmento, v.sub_segmento,
    v.score, v.valor_estimado, v.created_at,
    CASE
      WHEN LOWER(COALESCE(NULLIF(v.contato_email,''), v.email)) IS NULL                                                THEN 'sem_email'
      WHEN LOWER(COALESCE(NULLIF(v.contato_email,''), v.email)) !~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$' THEN 'formato_invalido'
      WHEN LOWER(SPLIT_PART(COALESCE(NULLIF(v.contato_email,''), v.email), '@', 1)) IN
        ('contato','contato2','vendas','venda','pedido','pedidos','financeiro','admin','adm',
         'compras','comercial','sac','atendimento','marketing','rh','suporte','info',
         'contabilidade','fiscal','nf','nfe','boleto','cobranca','recepcao','secretaria',
         'lojas','loja','ocgsc')                                                                                       THEN 'prefixo_generico'
      WHEN LOWER(SPLIT_PART(COALESCE(NULLIF(v.contato_email,''), v.email), '@', 2)) IN
        ('bol.com.br','terra.com.br','ig.com.br','globo.com','globomail.com')                                          THEN 'dominio_alto_risco'
      WHEN v.contato_email IS NULL OR v.contato_email = ''                                                             THEN 'email_em_campo_errado'
      ELSE 'ok_para_validar'
    END AS classificacao
  FROM vw_leads_disparo v
  WHERE v.segmento = 'Calçados e Moda'
    AND v.bloqueado_disparo = false
    AND v.em_conversa_ativa = false
    AND v.tem_email_valido = true
    AND v.ultima_conversa_em IS NULL
  ORDER BY LOWER(COALESCE(NULLIF(v.contato_email,''), v.email)),
           v.score DESC NULLS LAST,
           v.valor_estimado DESC NULLS LAST
)
SELECT * FROM dedup;

COMMENT ON VIEW public.vw_calcados_para_validacao IS
  'Lista de leads do segmento Calçados e Moda, deduplicados por email, classificados para validação externa antes de novo disparo.';
