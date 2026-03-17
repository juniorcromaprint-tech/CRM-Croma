-- 060_pcp_routing_rules.sql
-- Regras de roteamento automático de OPs para setores

CREATE TABLE IF NOT EXISTS routing_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria_id UUID REFERENCES categorias_produto(id) ON DELETE SET NULL,
  condicao_campo TEXT,
  condicao_operador TEXT,
  condicao_valor TEXT,
  setor_destino_id UUID NOT NULL REFERENCES setores_producao(id) ON DELETE CASCADE,
  prioridade INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE routing_rules IS 'Regras de roteamento automático de OPs para setores de produção';

-- Adicionar colunas em ordens_producao
ALTER TABLE ordens_producao
  ADD COLUMN IF NOT EXISTS restricao_financeira BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS setor_atual_id UUID REFERENCES setores_producao(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_routing_rules_categoria ON routing_rules(categoria_id);
CREATE INDEX IF NOT EXISTS idx_routing_rules_setor ON routing_rules(setor_destino_id);
CREATE INDEX IF NOT EXISTS idx_op_setor_atual ON ordens_producao(setor_atual_id);
