-- lead_quente_sem_orcamento: filtro de recencia 7d. Aplicado via MCP 2026-05-29 (sessao monitor, autorizada Junior).
-- PROBLEMA: regra reativada no ciclo #38 disparava ~100 alertas Telegram/dia (cap) sobre backlog VELHO
--   (319 leads score>=70 sem orcamento, TODOS atualizados ha 7-30 dias -> ruido, nao sinal).
-- FIX: so alerta leads atualizados nos ultimos 7 dias (sinal pra lead quente NOVO preservado; flood de velhos eliminado).
--   Validado: sem filtro=319, com 7d=0, com 30d=319.
-- Threshold 7d ajustavel (trocar o interval). Idempotente (jsonb_set sobre a chave filtro).
UPDATE agent_rules
SET condicao = jsonb_set(condicao, '{filtro}',
  to_jsonb('NOT EXISTS (SELECT 1 FROM propostas WHERE cliente_id IN (SELECT id FROM clientes WHERE lead_id = leads.id)) AND leads.updated_at >= now() - interval ''7 days'''::text))
WHERE id = '5a8e37f9-3a3d-40d9-866a-2bf5a942a1b4';
