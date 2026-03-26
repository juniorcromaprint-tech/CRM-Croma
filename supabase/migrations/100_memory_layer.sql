-- supabase/migrations/100_memory_layer.sql
-- Memory Layer da IA — Memória operacional persistente
-- Armazena padrões aprendidos de clientes, produtos e processos

-- ============================================================
-- TABELA: ai_memory
-- Memória persistente com tipagem e confiança
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Tipo de padrão aprendido
  tipo TEXT NOT NULL CHECK (tipo IN (
    'client_pattern',       -- comportamento de cliente (pagamento, prazo, volume)
    'pricing_pattern',      -- padrão de precificação e conversão
    'production_pattern',   -- tempos e padrões de produção
    'error_pattern',        -- padrões de erro/problema recorrentes
    'sales_pattern',        -- padrões de venda e negociação
    'operational_pattern'   -- padrões operacionais gerais
  )),

  -- Referência à entidade (opcional — NULL = padrão geral)
  entity_type TEXT,   -- ex: 'cliente', 'produto', 'processo', 'vendedor'
  entity_id UUID,     -- id da entidade referenciada (NULL = geral)

  -- A memória em si
  chave TEXT NOT NULL,        -- ex: 'comportamento_pagamento', 'tempo_medio_producao'
  descricao TEXT,             -- descrição em linguagem natural da memória
  valor_texto TEXT,           -- valor em formato texto livre
  valor_numerico NUMERIC,     -- valor numérico (médias, contagens, percentuais)
  valor_json JSONB,           -- valor estruturado complexo

  -- Confiança e reforço
  confianca SMALLINT DEFAULT 50 CHECK (confianca BETWEEN 0 AND 100),
  observacoes_count INT DEFAULT 1 CHECK (observacoes_count >= 0),

  -- Fonte do aprendizado
  fonte TEXT NOT NULL CHECK (fonte IN (
    'observacao',       -- observado automaticamente pelo sistema
    'calculo',          -- calculado a partir de dados históricos
    'feedback_humano',  -- inserido ou corrigido por humano
    'ia_inferencia'     -- inferido pela IA a partir de contexto
  )),

  -- Timestamps
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ  -- NULL = nunca expira
);

COMMENT ON TABLE ai_memory IS
  'Memória operacional persistente da IA — padrões aprendidos de clientes, produtos e processos';

COMMENT ON COLUMN ai_memory.confianca IS
  '0-100: quanto o sistema confia nesta memória. < 30 = incerta, 30-70 = moderada, > 70 = alta';

COMMENT ON COLUMN ai_memory.observacoes_count IS
  'Quantas vezes este padrão foi observado — quanto mais, maior a confiança';

COMMENT ON COLUMN ai_memory.expires_at IS
  'NULL = memória permanente. Preencher para padrões sazonais ou temporários';

-- Índices de busca
CREATE INDEX IF NOT EXISTS idx_ai_memory_tipo        ON ai_memory(tipo);
CREATE INDEX IF NOT EXISTS idx_ai_memory_entity      ON ai_memory(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_memory_chave       ON ai_memory(chave);
CREATE INDEX IF NOT EXISTS idx_ai_memory_confianca   ON ai_memory(confianca);
CREATE INDEX IF NOT EXISTS idx_ai_memory_expires     ON ai_memory(expires_at)
  WHERE expires_at IS NOT NULL;

-- Índices únicos por escopo:
-- Padrões gerais (entity_id IS NULL): único por entity_type + chave
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_memory_geral
  ON ai_memory(entity_type, chave)
  WHERE entity_id IS NULL;

-- Padrões por entidade específica: único por entity_type + entity_id + chave
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_memory_entidade
  ON ai_memory(entity_type, entity_id, chave)
  WHERE entity_id IS NOT NULL;


-- ============================================================
-- TABELA: ai_memory_events
-- Log de aprendizado — rastreia como a memória evolui
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_memory_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  memory_id UUID NOT NULL REFERENCES ai_memory(id) ON DELETE CASCADE,

  evento TEXT NOT NULL CHECK (evento IN (
    'created',      -- memória criada pela primeira vez
    'updated',      -- valor atualizado
    'validated',    -- confirmada por humano como correta
    'invalidated',  -- marcada como incorreta / descartada
    'expired',      -- expirou naturalmente (expires_at atingido)
    'reinforced'    -- reforçada por nova observação (confiança aumentou)
  )),

  valor_anterior JSONB,   -- snapshot do valor antes do evento
  valor_novo     JSONB,   -- snapshot do valor depois do evento
  razao          TEXT,    -- explicação do por quê o evento ocorreu

  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE ai_memory_events IS
  'Log de aprendizado — histórico completo de como a memória da IA evolui ao longo do tempo';

CREATE INDEX IF NOT EXISTS idx_ai_mem_events_memory  ON ai_memory_events(memory_id);
CREATE INDEX IF NOT EXISTS idx_ai_mem_events_evento  ON ai_memory_events(evento);
CREATE INDEX IF NOT EXISTS idx_ai_mem_events_created ON ai_memory_events(created_at);


-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================

CREATE OR REPLACE FUNCTION fn_ai_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_memory_updated_at ON ai_memory;
CREATE TRIGGER trg_ai_memory_updated_at
  BEFORE UPDATE ON ai_memory
  FOR EACH ROW
  EXECUTE FUNCTION fn_ai_memory_updated_at();


-- ============================================================
-- TRIGGER: Log automático de eventos de memória
-- Registra em ai_memory_events toda criação ou mudança de valor
-- ============================================================

CREATE OR REPLACE FUNCTION fn_ai_memory_log_event()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO ai_memory_events (memory_id, evento, valor_novo, razao)
    VALUES (
      NEW.id,
      'created',
      jsonb_build_object(
        'chave',           NEW.chave,
        'valor_texto',     NEW.valor_texto,
        'valor_numerico',  NEW.valor_numerico,
        'confianca',       NEW.confianca
      ),
      'Memória criada via ' || NEW.fonte
    );

  ELSIF TG_OP = 'UPDATE' THEN
    -- Logar se valor mudou
    IF OLD.valor_texto IS DISTINCT FROM NEW.valor_texto
      OR OLD.valor_numerico IS DISTINCT FROM NEW.valor_numerico
      OR OLD.valor_json IS DISTINCT FROM NEW.valor_json
    THEN
      INSERT INTO ai_memory_events (memory_id, evento, valor_anterior, valor_novo, razao)
      VALUES (
        NEW.id,
        'updated',
        jsonb_build_object(
          'valor_texto',    OLD.valor_texto,
          'valor_numerico', OLD.valor_numerico
        ),
        jsonb_build_object(
          'valor_texto',    NEW.valor_texto,
          'valor_numerico', NEW.valor_numerico
        ),
        'Atualizado via ' || NEW.fonte
      );
    END IF;

    -- Logar reforço quando confiança aumentou
    IF NEW.confianca > OLD.confianca OR NEW.observacoes_count > OLD.observacoes_count THEN
      INSERT INTO ai_memory_events (memory_id, evento, valor_anterior, valor_novo, razao)
      VALUES (
        NEW.id,
        'reinforced',
        jsonb_build_object(
          'confianca',          OLD.confianca,
          'observacoes_count',  OLD.observacoes_count
        ),
        jsonb_build_object(
          'confianca',          NEW.confianca,
          'observacoes_count',  NEW.observacoes_count
        ),
        'Reforçado por nova observação (' || NEW.observacoes_count || 'x observado)'
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Não quebrar a operação principal se o log falhar
  RAISE WARNING '[100] fn_ai_memory_log_event — Erro no log: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_memory_log_event ON ai_memory;
CREATE TRIGGER trg_ai_memory_log_event
  AFTER INSERT OR UPDATE ON ai_memory
  FOR EACH ROW
  EXECUTE FUNCTION fn_ai_memory_log_event();


-- ============================================================
-- RLS — Controle de acesso por role
-- ============================================================

ALTER TABLE ai_memory        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_memory_events ENABLE ROW LEVEL SECURITY;

-- ai_memory: leitura para admin, gerente, diretor
DROP POLICY IF EXISTS "ai_memory_select" ON ai_memory;
CREATE POLICY "ai_memory_select" ON ai_memory
  FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) = ANY(ARRAY['admin', 'gerente', 'diretor'])
  );

-- ai_memory: escrita para admin e gerente (IA usa service_role que bypassa RLS)
DROP POLICY IF EXISTS "ai_memory_insert" ON ai_memory;
CREATE POLICY "ai_memory_insert" ON ai_memory
  FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) = ANY(ARRAY['admin', 'gerente'])
  );

DROP POLICY IF EXISTS "ai_memory_update" ON ai_memory;
CREATE POLICY "ai_memory_update" ON ai_memory
  FOR UPDATE TO authenticated
  USING (
    get_user_role(auth.uid()) = ANY(ARRAY['admin', 'gerente'])
  );

DROP POLICY IF EXISTS "ai_memory_delete" ON ai_memory;
CREATE POLICY "ai_memory_delete" ON ai_memory
  FOR DELETE TO authenticated
  USING (
    get_user_role(auth.uid()) = 'admin'
  );

-- ai_memory_events: somente leitura para admin, gerente, diretor
DROP POLICY IF EXISTS "ai_memory_events_select" ON ai_memory_events;
CREATE POLICY "ai_memory_events_select" ON ai_memory_events
  FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) = ANY(ARRAY['admin', 'gerente', 'diretor'])
  );


-- ============================================================
-- RPC: upsert_ai_memory
-- Cria ou atualiza uma memória, incrementando observações_count
-- Usada pelas Edge Functions para registrar aprendizados
-- ============================================================

CREATE OR REPLACE FUNCTION upsert_ai_memory(
  p_tipo           TEXT,
  p_entity_type    TEXT,
  p_entity_id      UUID,
  p_chave          TEXT,
  p_descricao      TEXT,
  p_valor_texto    TEXT  DEFAULT NULL,
  p_valor_numerico NUMERIC DEFAULT NULL,
  p_valor_json     JSONB DEFAULT NULL,
  p_fonte          TEXT DEFAULT 'ia_inferencia',
  p_confianca_delta INT DEFAULT 5   -- quanto incrementar a confiança
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_id UUID;
  v_new_confianca INT;
BEGIN
  -- Buscar se memória já existe
  IF p_entity_id IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM ai_memory
    WHERE entity_type = p_entity_type
      AND entity_id = p_entity_id
      AND chave = p_chave;
  ELSE
    SELECT id INTO v_existing_id
    FROM ai_memory
    WHERE entity_type = p_entity_type
      AND entity_id IS NULL
      AND chave = p_chave;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    -- Atualizar existente: incrementar confiança e observações
    UPDATE ai_memory
    SET
      valor_texto       = COALESCE(p_valor_texto, valor_texto),
      valor_numerico    = COALESCE(p_valor_numerico, valor_numerico),
      valor_json        = COALESCE(p_valor_json, valor_json),
      descricao         = COALESCE(p_descricao, descricao),
      confianca         = LEAST(100, confianca + p_confianca_delta),
      observacoes_count = observacoes_count + 1,
      fonte             = p_fonte,
      updated_at        = NOW()
    WHERE id = v_existing_id;

    RETURN v_existing_id;
  ELSE
    -- Criar nova memória
    INSERT INTO ai_memory (
      tipo, entity_type, entity_id, chave, descricao,
      valor_texto, valor_numerico, valor_json,
      fonte, confianca, observacoes_count
    ) VALUES (
      p_tipo, p_entity_type, p_entity_id, p_chave, p_descricao,
      p_valor_texto, p_valor_numerico, p_valor_json,
      p_fonte, 50, 1
    )
    RETURNING id INTO v_existing_id;

    RETURN v_existing_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION upsert_ai_memory IS
  'Cria ou atualiza uma memória da IA, incrementando confiança a cada nova observação';


-- ============================================================
-- RPC: get_ai_memories_for_entity
-- Retorna memórias relevantes para uma entidade específica
-- + memórias gerais do mesmo tipo
-- ============================================================

CREATE OR REPLACE FUNCTION get_ai_memories_for_entity(
  p_entity_type TEXT,
  p_entity_id   UUID,
  p_tipo        TEXT DEFAULT NULL,
  p_min_confianca INT DEFAULT 30
)
RETURNS TABLE (
  id              UUID,
  tipo            TEXT,
  chave           TEXT,
  descricao       TEXT,
  valor_texto     TEXT,
  valor_numerico  NUMERIC,
  valor_json      JSONB,
  confianca       SMALLINT,
  observacoes_count INT,
  fonte           TEXT,
  is_geral        BOOLEAN,
  updated_at      TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    id, tipo, chave, descricao, valor_texto, valor_numerico, valor_json,
    confianca, observacoes_count, fonte,
    (entity_id IS NULL) AS is_geral,
    updated_at
  FROM ai_memory
  WHERE
    (entity_type = p_entity_type)
    AND (entity_id = p_entity_id OR entity_id IS NULL)
    AND (p_tipo IS NULL OR tipo = p_tipo)
    AND confianca >= p_min_confianca
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY
    (entity_id IS NOT NULL) DESC,  -- memórias específicas primeiro
    confianca DESC,
    updated_at DESC;
$$;

COMMENT ON FUNCTION get_ai_memories_for_entity IS
  'Retorna memórias relevantes para uma entidade + memórias gerais do mesmo tipo';


-- ============================================================
-- SEEDS: Memórias iniciais de exemplo
-- (baixa confiança — serão reforçadas por observações reais)
-- ============================================================

-- Padrão de precificação
INSERT INTO ai_memory (tipo, entity_type, chave, descricao, valor_texto, confianca, fonte)
SELECT
  'pricing_pattern',
  'geral',
  'ticket_medio_conversao',
  'Taxa de conversão varia com valor do ticket',
  'Propostas acima de R$ 5.000 têm ~30% de conversão. Abaixo de R$ 5.000: ~60%.',
  40,
  'ia_inferencia'
WHERE NOT EXISTS (
  SELECT 1 FROM ai_memory
  WHERE entity_type = 'geral' AND entity_id IS NULL AND chave = 'ticket_medio_conversao'
);

-- Padrão de produção
INSERT INTO ai_memory (tipo, entity_type, chave, descricao, valor_texto, valor_numerico, confianca, fonte)
SELECT
  'production_pattern',
  'geral',
  'tempo_impressao_banner_por_m2',
  'Tempo médio de impressão de banner por m²',
  'Blockout fosco: ~2h/m². Lona com bastão: ~1.5h/m². Adesivo: ~1h/m².',
  2.0,  -- horas por m² (média ponderada)
  50,
  'observacao'
WHERE NOT EXISTS (
  SELECT 1 FROM ai_memory
  WHERE entity_type = 'geral' AND entity_id IS NULL AND chave = 'tempo_impressao_banner_por_m2'
);

-- Padrão operacional
INSERT INTO ai_memory (tipo, entity_type, chave, descricao, valor_texto, confianca, fonte)
SELECT
  'operational_pattern',
  'geral',
  'prazo_entrega_por_tipo',
  'Prazo médio de entrega por tipo de produto',
  'Banner/adesivo: 3-5 dias úteis. Fachada ACM: 10-15 dias úteis. Totem: 7-10 dias úteis.',
  60,
  'observacao'
WHERE NOT EXISTS (
  SELECT 1 FROM ai_memory
  WHERE entity_type = 'geral' AND entity_id IS NULL AND chave = 'prazo_entrega_por_tipo'
);

-- Padrão de pagamento geral
INSERT INTO ai_memory (tipo, entity_type, chave, descricao, valor_texto, valor_numerico, confianca, fonte)
SELECT
  'client_pattern',
  'geral',
  'prazo_medio_pagamento',
  'Prazo médio de pagamento dos clientes',
  'Clientes de varejo: média 30-45 dias. Redes de franquias: 45-60 dias.',
  35.0,  -- dias
  45,
  'ia_inferencia'
WHERE NOT EXISTS (
  SELECT 1 FROM ai_memory
  WHERE entity_type = 'geral' AND entity_id IS NULL AND chave = 'prazo_medio_pagamento'
);

RAISE NOTICE '[100] Memory Layer instalada com sucesso — ai_memory + ai_memory_events + 2 RPCs';
