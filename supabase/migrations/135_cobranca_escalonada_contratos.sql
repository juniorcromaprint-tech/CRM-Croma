-- Migration 135: Funções de cobrança escalonada e faturamento de contratos
-- Extraído da produção em 2026-04-24 (código fantasma — existia no banco mas não no repo)
-- fn_cobranca_escalonada: lógica D1→D3→D7→D15→D30 com canais WhatsApp/email/Telegram
-- fn_faturar_contratos_vencidos: gera contas a receber de contratos recorrentes

-- ══════════════════════════════════════════════════════════════════
-- fn_cobranca_escalonada — cobrança automática escalonada por dias de atraso
-- Nível 1 (D1): WhatsApp lembrete suave
-- Nível 2 (D3): WhatsApp lembrete direto
-- Nível 3 (D7): Email formal
-- Nível 4 (D15): Telegram alerta para Junior
-- Nível 5 (D30): Telegram crítico — considerar suspensão
-- Registra em cobranca_automatica + system_events
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_cobranca_escalonada()
 RETURNS TABLE(conta_id uuid, cliente_nome text, dias_atraso integer, nivel integer, canal text, acao text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  r RECORD;
  v_nivel INT;
  v_canal TEXT;
  v_mensagem TEXT;
  v_cliente_nome TEXT;
  v_cliente_telefone TEXT;
  v_cliente_email TEXT;
BEGIN
  FOR r IN
    SELECT cr.id, cr.pedido_id, cr.valor_original, cr.saldo, cr.cliente_id, cr.data_vencimento,
           cr.numero_titulo,
           (CURRENT_DATE - cr.data_vencimento) AS atraso,
           c.nome, c.telefone, c.email
    FROM contas_receber cr
    JOIN clientes c ON c.id = cr.cliente_id
    WHERE cr.status IN ('aberto', 'vencido')
      AND cr.data_vencimento < CURRENT_DATE
      AND cr.excluido_em IS NULL
    ORDER BY (CURRENT_DATE - cr.data_vencimento) DESC
  LOOP
    v_cliente_nome := r.nome;
    v_cliente_telefone := r.telefone;
    v_cliente_email := r.email;

    -- Determine escalation level based on days overdue
    IF r.atraso >= 30 THEN
      v_nivel := 5;
      v_canal := 'telegram_alerta';
      v_mensagem := format('ALERTA CRÍTICO: %s — R$ %s vencido há %s dias (título %s). Considerar suspensão de novos pedidos.',
        v_cliente_nome, r.valor_original, r.atraso, r.numero_titulo);
    ELSIF r.atraso >= 15 THEN
      v_nivel := 4;
      v_canal := 'telegram_alerta';
      v_mensagem := format('ATENÇÃO: %s — R$ %s vencido há %s dias (título %s). Recomendo contato direto.',
        v_cliente_nome, r.valor_original, r.atraso, r.numero_titulo);
    ELSIF r.atraso >= 7 THEN
      v_nivel := 3;
      v_canal := 'email';
      v_mensagem := format('Prezado(a) %s, identificamos que o título %s no valor de R$ %s encontra-se vencido desde %s. Solicitamos a regularização. Croma Print.',
        v_cliente_nome, r.numero_titulo, r.valor_original, r.data_vencimento);
    ELSIF r.atraso >= 3 THEN
      v_nivel := 2;
      v_canal := CASE WHEN v_cliente_telefone IS NOT NULL THEN 'whatsapp' ELSE 'email' END;
      v_mensagem := format('Olá %s, tudo bem? Passando pra lembrar do título %s (R$ %s) que venceu em %s. Qualquer dúvida estamos à disposição! Croma Print',
        v_cliente_nome, r.numero_titulo, r.valor_original, r.data_vencimento);
    ELSIF r.atraso >= 1 THEN
      v_nivel := 1;
      v_canal := CASE WHEN v_cliente_telefone IS NOT NULL THEN 'whatsapp' ELSE 'email' END;
      v_mensagem := format('Olá %s! Tudo bem? Lembramos que o título %s no valor de R$ %s venceu ontem (%s). Pode ter sido um esquecimento, mas caso precise de algo é só chamar! Croma Print',
        v_cliente_nome, r.numero_titulo, r.valor_original, r.data_vencimento);
    ELSE
      CONTINUE;
    END IF;

    -- Check if this level was already sent for this conta today
    IF NOT EXISTS (
      SELECT 1 FROM cobranca_automatica ca
      WHERE ca.conta_receber_id = r.id
        AND ca.nivel = v_nivel
        AND ca.status = 'enviado'
    ) THEN
      -- Register cobranca
      INSERT INTO cobranca_automatica (conta_receber_id, cliente_id, nivel, canal, mensagem, dias_atraso, status)
      VALUES (r.id, r.cliente_id, v_nivel, v_canal, v_mensagem, r.atraso, 'pendente');

      -- Register system event
      INSERT INTO system_events (event_type, entity_type, entity_id, payload)
      VALUES ('cobranca_escalonada', 'conta_receber', r.id, jsonb_build_object(
        'nivel', v_nivel, 'canal', v_canal, 'dias_atraso', r.atraso,
        'cliente_id', r.cliente_id, 'cliente_nome', v_cliente_nome,
        'valor', r.valor_original, 'titulo', r.numero_titulo
      ));

      -- Return row for reporting
      conta_id := r.id;
      cliente_nome := v_cliente_nome;
      dias_atraso := r.atraso;
      nivel := v_nivel;
      canal := v_canal;
      acao := 'cobranca_registrada';
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$function$;

-- ══════════════════════════════════════════════════════════════════
-- fn_faturar_contratos_vencidos — gera contas a receber de contratos recorrentes
-- Verifica contratos ativos cujo proximo_faturamento <= hoje
-- Cria CR com vencimento = proximo_faturamento + 10 dias
-- Avança proximo_faturamento baseado na periodicidade
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_faturar_contratos_vencidos()
 RETURNS TABLE(contrato_id uuid, conta_receber_id uuid, valor numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  rec RECORD;
  nova_cr_id UUID;
  proximo DATE;
  meses_add INT;
BEGIN
  FOR rec IN
    SELECT cs.id, cs.cliente_id, cs.descricao, cs.valor_mensal, cs.periodicidade, cs.proximo_faturamento
    FROM contratos_servico cs
    WHERE cs.status = 'ativo'
      AND cs.excluido_em IS NULL
      AND cs.proximo_faturamento IS NOT NULL
      AND cs.proximo_faturamento <= CURRENT_DATE
  LOOP
    -- Gerar conta a receber
    INSERT INTO contas_receber (
      cliente_id, pedido_id, tipo, descricao,
      valor_original, data_vencimento, status
    ) VALUES (
      rec.cliente_id, NULL, 'servico_recorrente',
      'Contrato: ' || rec.descricao || ' — Ref. ' || to_char(rec.proximo_faturamento, 'MM/YYYY'),
      rec.valor_mensal, rec.proximo_faturamento + 10, 'aberto'
    )
    RETURNING id INTO nova_cr_id;

    -- Calcular próximo faturamento baseado na periodicidade
    meses_add := CASE rec.periodicidade
      WHEN 'mensal' THEN 1
      WHEN 'bimestral' THEN 2
      WHEN 'trimestral' THEN 3
      WHEN 'semestral' THEN 6
      WHEN 'anual' THEN 12
      ELSE 1
    END;

    proximo := rec.proximo_faturamento + (meses_add || ' months')::INTERVAL;

    -- Atualizar contrato com próximo faturamento
    UPDATE contratos_servico
    SET proximo_faturamento = proximo
    WHERE id = rec.id;

    contrato_id := rec.id;
    conta_receber_id := nova_cr_id;
    valor := rec.valor_mensal;
    RETURN NEXT;
  END LOOP;
END;
$function$;
