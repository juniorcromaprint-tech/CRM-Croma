-- Migration 134: Funções auxiliares do sistema IA
-- Extraído da produção em 2026-04-24 (código fantasma — existia no banco mas não no repo)
-- Inclui: scores de crédito, detecção de padrões, pagamentos vencidos, SQL readonly

-- ══════════════════════════════════════════════════════════════════
-- fn_detect_overdue_payments — detecta contas vencidas e cria system_events
-- Chamado pelo pg_cron diariamente
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_detect_overdue_payments()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT cr.id, cr.pedido_id, cr.valor_original, cr.cliente_id, cr.data_vencimento,
           (CURRENT_DATE - cr.data_vencimento) AS dias_atraso
    FROM contas_receber cr
    WHERE cr.status IN ('aberto', 'vencido')
      AND cr.data_vencimento < CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM system_events se
        WHERE se.event_type = 'payment_overdue' AND se.entity_id = cr.id
          AND se.created_at::date = CURRENT_DATE
      )
  LOOP
    UPDATE contas_receber SET status = 'vencido', updated_at = now()
    WHERE id = r.id AND status = 'aberto';
    INSERT INTO system_events (event_type, entity_type, entity_id, payload)
    VALUES ('payment_overdue', 'conta_receber', r.id, jsonb_build_object(
      'pedido_id', r.pedido_id, 'valor', r.valor_original, 'cliente_id', r.cliente_id,
      'data_vencimento', r.data_vencimento, 'dias_atraso', r.dias_atraso
    ));
  END LOOP;
END;
$function$;

-- ══════════════════════════════════════════════════════════════════
-- fn_recalcular_todos_scores — recalcula score de crédito de todos clientes ativos
-- Depende de fn_calcular_score_credito (deve existir previamente)
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_recalcular_todos_scores()
 RETURNS TABLE(clientes_atualizados integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cliente RECORD; v_score RECORD; v_count INT := 0;
BEGIN
  FOR v_cliente IN SELECT id FROM clientes WHERE ativo = true
  LOOP
    SELECT * INTO v_score FROM fn_calcular_score_credito(v_cliente.id);
    UPDATE clientes SET
      score_credito = v_score.score_total, score_nivel = v_score.nivel,
      limite_credito_sugerido = v_score.limite_sugerido, score_atualizado_em = NOW()
    WHERE id = v_cliente.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN QUERY SELECT v_count;
END;
$function$;

-- ══════════════════════════════════════════════════════════════════
-- fn_detectar_padroes_memoria — detecta padrões de negócio e grava em ai_memory
-- 4 detectores: prazo pagamento, taxa conversão, dia produtivo, ticket médio
-- Chamado pelo pg_cron (nightly cycle)
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_detectar_padroes_memoria()
 RETURNS TABLE(patterns_updated integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_count INT := 0;
  v_rows INT;
BEGIN
  -- 4.3.1 Prazo médio pagamento por cliente
  INSERT INTO ai_memory (chave, tipo, entity_type, entity_id, descricao, valor_numerico, confianca, fonte, observacoes_count)
  SELECT 'prazo_pagamento_medio', 'client_pattern', 'cliente', cr.cliente_id,
    format('Cliente paga em média %s dias', ROUND(AVG((cr.data_pagamento - cr.data_emissao)::numeric))),
    ROUND(AVG((cr.data_pagamento - cr.data_emissao)::numeric)),
    LEAST(95, 30 + COUNT(*) * 10)::int, 'analise_automatica', COUNT(*)::int
  FROM contas_receber cr WHERE cr.data_pagamento IS NOT NULL AND cr.excluido_em IS NULL
  GROUP BY cr.cliente_id HAVING COUNT(*) >= 2
  ON CONFLICT (chave, entity_type, COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'))
  DO UPDATE SET valor_numerico = EXCLUDED.valor_numerico, confianca = EXCLUDED.confianca,
    observacoes_count = EXCLUDED.observacoes_count, descricao = EXCLUDED.descricao, updated_at = NOW();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  -- 4.3.2 Taxa de conversão geral
  INSERT INTO ai_memory (chave, tipo, entity_type, descricao, valor_numerico, confianca, fonte, observacoes_count)
  SELECT 'taxa_conversao_geral', 'pricing_pattern', 'sistema',
    format('Taxa de conversão geral: %s%%', ROUND(
      COUNT(*) FILTER (WHERE status = 'aprovada')::numeric / NULLIF(COUNT(*), 0) * 100
    )),
    ROUND(COUNT(*) FILTER (WHERE status = 'aprovada')::numeric / NULLIF(COUNT(*), 0) * 100, 1),
    LEAST(95, 30 + COUNT(*) * 2)::int, 'analise_automatica', COUNT(*)::int
  FROM propostas WHERE excluido_em IS NULL AND status IN ('aprovada','rejeitada','expirada','enviada')
  HAVING COUNT(*) >= 3
  ON CONFLICT (chave, entity_type, COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'))
  DO UPDATE SET valor_numerico = EXCLUDED.valor_numerico, confianca = EXCLUDED.confianca,
    observacoes_count = EXCLUDED.observacoes_count, descricao = EXCLUDED.descricao, updated_at = NOW();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  -- 4.3.4 Dia da semana mais produtivo
  INSERT INTO ai_memory (chave, tipo, entity_type, descricao, valor_numerico, confianca, fonte, observacoes_count)
  SELECT 'dia_mais_produtivo', 'operational_pattern', 'sistema',
    format('Dia mais produtivo: %s',
      CASE EXTRACT(DOW FROM data_conclusao)
        WHEN 0 THEN 'Domingo' WHEN 1 THEN 'Segunda' WHEN 2 THEN 'Terça'
        WHEN 3 THEN 'Quarta' WHEN 4 THEN 'Quinta' WHEN 5 THEN 'Sexta' ELSE 'Sábado' END),
    EXTRACT(DOW FROM data_conclusao)::numeric,
    LEAST(90, 30 + COUNT(*) * 5)::int, 'analise_automatica', COUNT(*)::int
  FROM ordens_producao WHERE data_conclusao IS NOT NULL
  GROUP BY EXTRACT(DOW FROM data_conclusao)
  ORDER BY COUNT(*) DESC LIMIT 1
  ON CONFLICT (chave, entity_type, COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'))
  DO UPDATE SET valor_numerico = EXCLUDED.valor_numerico, confianca = EXCLUDED.confianca,
    observacoes_count = EXCLUDED.observacoes_count, descricao = EXCLUDED.descricao, updated_at = NOW();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  -- 4.3.5 Ticket médio real
  INSERT INTO ai_memory (chave, tipo, entity_type, descricao, valor_numerico, confianca, fonte, observacoes_count)
  SELECT 'ticket_medio_real', 'pricing_pattern', 'sistema',
    format('Ticket médio real: R$ %s', ROUND(AVG(valor_total), 2)),
    ROUND(AVG(valor_total), 2),
    LEAST(95, 30 + COUNT(*) * 5)::int, 'analise_automatica', COUNT(*)::int
  FROM pedidos WHERE status NOT IN ('cancelado') AND valor_total > 0
  HAVING COUNT(*) >= 2
  ON CONFLICT (chave, entity_type, COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'))
  DO UPDATE SET valor_numerico = EXCLUDED.valor_numerico, confianca = EXCLUDED.confianca,
    observacoes_count = EXCLUDED.observacoes_count, descricao = EXCLUDED.descricao, updated_at = NOW();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  -- Cleanup
  DELETE FROM ai_memory WHERE confianca < 30 AND updated_at < now() - interval '90 days';
  DELETE FROM ai_memory WHERE expires_at IS NOT NULL AND expires_at < now();

  RETURN QUERY SELECT v_count;
END;
$function$;

-- ══════════════════════════════════════════════════════════════════
-- execute_sql_readonly — executa SELECT/WITH com proteções de segurança
-- Usado pelo agent-cron-loop para avaliar regras dinâmicas
-- SECURITY DEFINER: roda com permissões do owner (service_role)
-- Proteções: bloqueia DML, força LIMIT 100 se não especificado
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.execute_sql_readonly(query_text text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result JSONB;
  v_clean TEXT;
BEGIN
  -- Sanitizar: remover comments
  v_clean := regexp_replace(query_text, '--.*$', '', 'gm');
  v_clean := regexp_replace(v_clean, '/\*.*?\*/', '', 'g');
  v_clean := TRIM(v_clean);

  -- Validar: apenas SELECT / WITH
  IF NOT (UPPER(v_clean) ~ '^(SELECT|WITH)') THEN
    RAISE EXCEPTION 'Apenas consultas SELECT são permitidas';
  END IF;

  -- Bloquear palavras perigosas
  IF UPPER(v_clean) ~ '\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|COPY)\b' THEN
    RAISE EXCEPTION 'Operação de escrita não permitida em consulta readonly';
  END IF;

  -- Forçar LIMIT se não especificado
  IF NOT (UPPER(v_clean) ~ 'LIMIT\s+\d+') THEN
    v_clean := v_clean || ' LIMIT 100';
  END IF;

  -- Executar e retornar como JSONB array
  EXECUTE format('SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (%s) t', v_clean)
  INTO v_result;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$function$;
