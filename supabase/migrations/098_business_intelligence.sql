-- 098_business_intelligence.sql
-- Croma Print — Inteligência Comercial
-- Seed de dados estratégicos: sazonalidade, perfil de clientes, benchmarks e alertas

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. BUSINESS INTELLIGENCE CONFIG
--    Sazonalidade mensal + métricas-alvo globais
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS business_intelligence_config (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  chave          text        NOT NULL UNIQUE,
  valor_numerico numeric(10,4),
  valor_texto    text,
  descricao      text,
  categoria      text        NOT NULL DEFAULT 'geral',
  ativo          boolean     NOT NULL DEFAULT true,
  updated_at     timestamptz DEFAULT now()
);

COMMENT ON TABLE business_intelligence_config IS
  'Configurações globais de inteligência comercial: sazonalidade, metas e limites';

-- Sazonalidade mensal (índice multiplicador sobre ticket/volume esperado)
INSERT INTO business_intelligence_config (chave, valor_numerico, descricao, categoria) VALUES
  ('sazonalidade_jan', 1.35, 'Janeiro — alta temporada (campanhas verão/verão varejo)',  'sazonalidade'),
  ('sazonalidade_fev', 1.25, 'Fevereiro — ainda forte (pós-carnaval)',                    'sazonalidade'),
  ('sazonalidade_mar', 1.10, 'Março — acima da média',                                    'sazonalidade'),
  ('sazonalidade_abr', 0.95, 'Abril — ligeiramente abaixo',                               'sazonalidade'),
  ('sazonalidade_mai', 0.90, 'Maio — baixa moderada',                                     'sazonalidade'),
  ('sazonalidade_jun', 0.85, 'Junho — pior mês do ano (inverno + fim de semestre)',        'sazonalidade'),
  ('sazonalidade_jul', 0.90, 'Julho — início de recuperação',                             'sazonalidade'),
  ('sazonalidade_ago', 0.95, 'Agosto — retomada gradual',                                 'sazonalidade'),
  ('sazonalidade_set', 1.00, 'Setembro — mês-base (índice neutro)',                       'sazonalidade'),
  ('sazonalidade_out', 0.95, 'Outubro — estável',                                         'sazonalidade'),
  ('sazonalidade_nov', 0.80, 'Novembro — queda (antes do pico natalino)',                 'sazonalidade'),
  ('sazonalidade_dez', 0.75, 'Dezembro — menor índice (foco interno + festas)',            'sazonalidade'),

-- Métricas-alvo globais
  ('ticket_medio_geral',         2100.00, 'Ticket médio alvo por proposta (R$)',                     'meta'),
  ('taxa_conversao_meta',           75.0, 'Taxa de conversão proposta→pedido alvo (%)',              'meta'),
  ('limite_concentracao_cliente',   60.0, 'Limite máximo de concentração por cliente (% faturamento)', 'risco')
ON CONFLICT (chave) DO UPDATE
  SET valor_numerico = EXCLUDED.valor_numerico,
      descricao      = EXCLUDED.descricao,
      updated_at     = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CLIENT INTELLIGENCE
--    Perfil estratégico dos principais clientes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_intelligence (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_cliente         text        NOT NULL,
  segmento             text,
  volume_total_reais   numeric(12,2),
  ticket_medio_reais   numeric(10,2),
  total_orcamentos     int         DEFAULT 0,
  frequencia           text        CHECK (frequencia IN ('recorrente', 'esporadico', 'pontual')),
  nivel_risco          text        NOT NULL DEFAULT 'baixo'
                                   CHECK (nivel_risco IN ('baixo', 'medio', 'alto', 'critico')),
  percentual_faturamento numeric(5,2), -- % aproximado do faturamento total
  notas_estrategicas   text,
  alerta_ativo         boolean     NOT NULL DEFAULT false,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

COMMENT ON TABLE client_intelligence IS
  'Perfil de inteligência estratégica dos clientes-chave da Croma Print';
COMMENT ON COLUMN client_intelligence.nivel_risco IS
  'Risco de concentração: critico = dependência perigosa, alto = acima do limite';

-- Seed dos clientes principais (dados reais da Croma)
INSERT INTO client_intelligence
  (nome_cliente, segmento, volume_total_reais, ticket_medio_reais, total_orcamentos,
   frequencia, nivel_risco, percentual_faturamento, notas_estrategicas, alerta_ativo)
VALUES
  (
    'Beira Rio',
    'calçados',
    NULL,              -- volume varia: 67-88% do faturamento — calculado dinamicamente
    2707.00,
    NULL,
    'recorrente',
    'critico',
    77.5,             -- média entre 67% e 88%
    'DEPENDÊNCIA CRÍTICA: representa entre 67-88% do faturamento. Principal risco de concentração. '
    'Redes de lojas de calçados. Prioridade máxima na retenção. Urgente diversificar base.',
    true
  ),
  (
    'Pontal',
    'calçados',
    146000.00,
    NULL,
    NULL,
    'esporadico',
    'baixo',
    NULL,
    'Volume histórico R$146k. Ticket médio alto. Pedidos esporádicos — potencial de fidelização.',
    false
  ),
  (
    'Lojas Paulistanas',
    'calçados',
    102000.00,
    NULL,
    50,
    'recorrente',
    'baixo',
    NULL,
    'R$102k histórico, 50 orçamentos. Recorrente — boa base de relacionamento.',
    false
  ),
  (
    'Poupa Farma',
    'farmácia',
    110000.00,
    NULL,
    29,
    'recorrente',
    'baixo',
    NULL,
    'R$110k histórico, 29 orçamentos. Segmento farmácia — diversificação setorial valiosa.',
    false
  ),
  (
    'Pampili',
    'calçados',
    65000.00,
    NULL,
    55,
    'recorrente',
    'baixo',
    NULL,
    'R$65k histórico, 55 orçamentos. Alta frequência — cliente fiel de menor ticket.',
    false
  )
ON CONFLICT DO NOTHING;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_client_intelligence_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_intelligence_updated_at ON client_intelligence;
CREATE TRIGGER trg_client_intelligence_updated_at
  BEFORE UPDATE ON client_intelligence
  FOR EACH ROW EXECUTE FUNCTION update_client_intelligence_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SALES BENCHMARKS
--    Métricas históricas anuais para comparação de desempenho
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_benchmarks (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ano                   int         NOT NULL UNIQUE,
  total_orcamentos      int         NOT NULL,
  taxa_conversao_pct    numeric(5,2) NOT NULL,
  valor_aprovado_reais  numeric(14,2) NOT NULL,
  ticket_medio_reais    numeric(10,2) NOT NULL,
  obs                   text,
  created_at            timestamptz DEFAULT now()
);

COMMENT ON TABLE sales_benchmarks IS
  'Benchmarks históricos anuais de vendas da Croma Print (2022–presente)';

INSERT INTO sales_benchmarks
  (ano, total_orcamentos, taxa_conversao_pct, valor_aprovado_reais, ticket_medio_reais, obs)
VALUES
  (2022, 332, 70.5, 426000.00, 1822.00, 'Primeiro ano completo pós-pandemia. Taxa conversão ainda se recuperando.'),
  (2023, 314, 77.1, 459000.00, 1897.00, 'Melhora consistente em conversão e ticket. Crescimento saudável.'),
  (2024, 300, 80.3, 488000.00, 2025.00, 'Melhor taxa de conversão histórica. Ticket médio acima de R$2k pela primeira vez.'),
  (2025, 189, 61.9, 291000.00, 2489.00,
   'Ano parcial ou queda de volume: menos orçamentos mas ticket mais alto. '
   'Conversão caiu significativamente — investigar causas (mudança de equipe? concorrência? concentração BR?).')
ON CONFLICT (ano) DO UPDATE
  SET total_orcamentos     = EXCLUDED.total_orcamentos,
      taxa_conversao_pct   = EXCLUDED.taxa_conversao_pct,
      valor_aprovado_reais = EXCLUDED.valor_aprovado_reais,
      ticket_medio_reais   = EXCLUDED.ticket_medio_reais,
      obs                  = EXCLUDED.obs;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ALERT RULES
--    Regras para disparo de alertas comerciais automáticos
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_rules (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo           text        NOT NULL UNIQUE,
  nome             text        NOT NULL,
  descricao        text        NOT NULL,
  tipo             text        NOT NULL
                               CHECK (tipo IN ('orcamento', 'cliente', 'financeiro', 'volume', 'conversao')),
  severidade       text        NOT NULL DEFAULT 'media'
                               CHECK (severidade IN ('baixa', 'media', 'alta', 'critica')),
  threshold_valor  numeric(10,2),
  threshold_unidade text,      -- 'dias', 'pct', 'reais'
  ativo            boolean     NOT NULL DEFAULT true,
  canal_notificacao text[]     DEFAULT ARRAY['sistema'],
  created_at       timestamptz DEFAULT now()
);

COMMENT ON TABLE alert_rules IS
  'Regras de disparo de alertas comerciais e operacionais da Croma Print';

INSERT INTO alert_rules
  (codigo, nome, descricao, tipo, severidade, threshold_valor, threshold_unidade, canal_notificacao)
VALUES
  (
    'ORC_PARADO_3D',
    'Orçamento parado sem resposta',
    'Orçamento enviado há mais de 3 dias sem aprovação, rejeição ou follow-up registrado. '
    'Acionar contato imediato com o cliente.',
    'orcamento',
    'alta',
    3,
    'dias',
    ARRAY['sistema', 'dashboard']
  ),
  (
    'CLI_INATIVO_60D',
    'Cliente inativo há 60+ dias',
    'Cliente sem nenhum pedido ou orçamento aprovado nos últimos 60 dias. '
    'Risco de perda de relacionamento — acionar campanha de reativação.',
    'cliente',
    'media',
    60,
    'dias',
    ARRAY['sistema', 'dashboard']
  ),
  (
    'CONCENTRACAO_CLIENTE_60PCT',
    'Concentração crítica de faturamento',
    'Um único cliente ultrapassou 60% do faturamento do período. '
    'Risco estratégico alto — Beira Rio atualmente em 67-88%. Diversificar urgente.',
    'financeiro',
    'critica',
    60,
    'pct',
    ARRAY['sistema', 'dashboard', 'email']
  ),
  (
    'QUEDA_VOLUME_20PCT',
    'Queda de volume vs. ano anterior',
    'Volume de orçamentos gerados no período caiu mais de 20% comparado ao mesmo período '
    'do ano anterior. Sinal de alerta para prospecção ativa.',
    'volume',
    'alta',
    20,
    'pct',
    ARRAY['sistema', 'dashboard']
  ),
  (
    'CONVERSAO_ABAIXO_65PCT',
    'Taxa de conversão abaixo de 65%',
    'Taxa de conversão proposta→pedido caiu abaixo de 65% no mês corrente. '
    'Meta é 75%. Investigar causas: preço, concorrência, follow-up inadequado.',
    'conversao',
    'alta',
    65,
    'pct',
    ARRAY['sistema', 'dashboard']
  )
ON CONFLICT (codigo) DO UPDATE
  SET nome              = EXCLUDED.nome,
      descricao         = EXCLUDED.descricao,
      severidade        = EXCLUDED.severidade,
      threshold_valor   = EXCLUDED.threshold_valor,
      threshold_unidade = EXCLUDED.threshold_unidade,
      canal_notificacao = EXCLUDED.canal_notificacao;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ALERT HISTORY
--    Log de todos os alertas disparados pelo sistema
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_history (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id         uuid        REFERENCES alert_rules(id) ON DELETE SET NULL,
  rule_codigo     text        NOT NULL,
  severidade      text        NOT NULL,
  titulo          text        NOT NULL,
  descricao       text,
  entity_type     text,       -- 'orcamento', 'cliente', 'pedido', etc.
  entity_id       uuid,
  entity_label    text,       -- nome legível (ex: "Beira Rio", "ORC-2025-0042")
  valor_detectado numeric(10,2),
  threshold_valor numeric(10,2),
  disparado_em    timestamptz NOT NULL DEFAULT now(),
  resolvido       boolean     NOT NULL DEFAULT false,
  resolvido_por   uuid        REFERENCES auth.users(id),
  resolvido_em    timestamptz,
  resolucao_nota  text,
  -- Previne spam: mesmo alerta + mesma entidade não repete em < 24h
  dedup_key       text        GENERATED ALWAYS AS (
    rule_codigo || '::' || COALESCE(entity_type, 'global') || '::' || COALESCE(entity_id::text, 'n/a')
  ) STORED
);

COMMENT ON TABLE alert_history IS
  'Log histórico de alertas comerciais disparados — auditoria e rastreabilidade';
COMMENT ON COLUMN alert_history.dedup_key IS
  'Chave de deduplicação: rule + entity. Use para filtrar alertas recentes duplicados.';

CREATE INDEX IF NOT EXISTS idx_alert_history_active
  ON alert_history (resolvido, disparado_em DESC)
  WHERE NOT resolvido;

CREATE INDEX IF NOT EXISTS idx_alert_history_rule
  ON alert_history (rule_codigo, disparado_em DESC);

CREATE INDEX IF NOT EXISTS idx_alert_history_entity
  ON alert_history (entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RLS — Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE business_intelligence_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_intelligence          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_benchmarks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history                ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem ler tudo (dados internos)
CREATE POLICY "autenticado_le_bi_config" ON business_intelligence_config
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "autenticado_le_client_intel" ON client_intelligence
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "autenticado_le_benchmarks" ON sales_benchmarks
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "autenticado_le_alert_rules" ON alert_rules
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "autenticado_le_alert_history" ON alert_history
  FOR SELECT USING (auth.role() = 'authenticated');

-- Apenas service_role pode escrever (via edge functions / cron)
CREATE POLICY "service_role_bi_config" ON business_intelligence_config
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_client_intel" ON client_intelligence
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_benchmarks" ON sales_benchmarks
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_alert_rules" ON alert_rules
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_alert_history_write" ON alert_history
  FOR INSERT WITH CHECK (true);

-- Usuário pode resolver alertas (marcar como resolvido)
CREATE POLICY "autenticado_resolve_alert" ON alert_history
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (resolvido = true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. HELPER: função para disparar alerta de forma idempotente
--    Evita duplicatas dentro de uma janela de tempo
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION disparar_alerta(
  p_rule_codigo     text,
  p_titulo          text,
  p_descricao       text       DEFAULT NULL,
  p_entity_type     text       DEFAULT NULL,
  p_entity_id       uuid       DEFAULT NULL,
  p_entity_label    text       DEFAULT NULL,
  p_valor_detectado numeric    DEFAULT NULL,
  p_janela_horas    int        DEFAULT 24
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rule     alert_rules%ROWTYPE;
  v_existing uuid;
  v_new_id   uuid;
BEGIN
  -- Busca a regra
  SELECT * INTO v_rule FROM alert_rules WHERE codigo = p_rule_codigo AND ativo = true;
  IF NOT FOUND THEN
    RETURN NULL; -- Regra desativada ou inexistente — silencioso
  END IF;

  -- Verifica duplicata recente (dentro da janela)
  SELECT id INTO v_existing
  FROM alert_history
  WHERE rule_codigo  = p_rule_codigo
    AND COALESCE(entity_type, 'global') = COALESCE(p_entity_type, 'global')
    AND COALESCE(entity_id::text, 'n/a') = COALESCE(p_entity_id::text, 'n/a')
    AND NOT resolvido
    AND disparado_em > now() - (p_janela_horas || ' hours')::interval
  LIMIT 1;

  IF FOUND THEN
    RETURN v_existing; -- Já existe alerta ativo recente — retorna o existente
  END IF;

  -- Insere novo alerta
  INSERT INTO alert_history
    (rule_id, rule_codigo, severidade, titulo, descricao,
     entity_type, entity_id, entity_label,
     valor_detectado, threshold_valor)
  VALUES
    (v_rule.id, p_rule_codigo, v_rule.severidade, p_titulo, p_descricao,
     p_entity_type, p_entity_id, p_entity_label,
     p_valor_detectado, v_rule.threshold_valor)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

COMMENT ON FUNCTION disparar_alerta IS
  'Dispara um alerta comercial de forma idempotente. '
  'Evita duplicatas dentro de p_janela_horas (padrão 24h). '
  'Uso: SELECT disparar_alerta(''ORC_PARADO_3D'', ''Orçamento parado'', null, ''orcamento'', $id, ''ORC-123'', 3)';

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. VIEW: alertas_ativos
--    Painel de alertas pendentes para o dashboard
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW alertas_ativos AS
SELECT
  ah.id,
  ah.rule_codigo,
  ar.nome             AS regra_nome,
  ah.severidade,
  ah.titulo,
  ah.descricao,
  ah.entity_type,
  ah.entity_id,
  ah.entity_label,
  ah.valor_detectado,
  ah.threshold_valor,
  ah.disparado_em,
  EXTRACT(EPOCH FROM (now() - ah.disparado_em)) / 3600 AS horas_em_aberto
FROM alert_history ah
LEFT JOIN alert_rules ar ON ar.codigo = ah.rule_codigo
WHERE NOT ah.resolvido
ORDER BY
  CASE ah.severidade
    WHEN 'critica' THEN 1
    WHEN 'alta'    THEN 2
    WHEN 'media'   THEN 3
    WHEN 'baixa'   THEN 4
    ELSE 5
  END,
  ah.disparado_em DESC;

COMMENT ON VIEW alertas_ativos IS
  'View para o painel de alertas: todos os alertas não resolvidos, ordenados por severidade';
