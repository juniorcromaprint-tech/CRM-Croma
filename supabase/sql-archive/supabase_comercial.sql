-- ============================================================
-- MÓDULO COMERCIAL - CROMA PRINT
-- Tabelas: clientes, clientes_contatos, orcamentos, orcamentos_itens
-- Executar no Supabase SQL Editor
-- ============================================================

-- 1. TABELA: clientes
-- ============================================================
CREATE TABLE IF NOT EXISTS clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT,
  telefone TEXT,
  email TEXT,
  site TEXT,
  tipo_cliente TEXT DEFAULT 'cliente_final' CHECK (tipo_cliente IN ('agencia', 'cliente_final', 'revenda')),
  origem TEXT DEFAULT 'prospeccao' CHECK (origem IN ('carteira', 'email', 'indicacao', 'internet', 'prospeccao')),
  tipo_atendimento TEXT DEFAULT 'ativo' CHECK (tipo_atendimento IN ('ativo', 'receptivo')),
  vendedor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  observacoes TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA: clientes_contatos
-- ============================================================
CREATE TABLE IF NOT EXISTS clientes_contatos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cargo TEXT,
  telefone TEXT,
  email TEXT,
  whatsapp TEXT,
  principal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA: orcamentos
-- ============================================================
CREATE TABLE IF NOT EXISTS orcamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT UNIQUE, -- ex: ORC-2026-001, gerado automaticamente
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  vendedor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviado', 'aprovado', 'recusado', 'convertido')),
  validade_dias INTEGER DEFAULT 10,
  subtotal NUMERIC(12,2) DEFAULT 0,
  desconto_percentual NUMERIC(5,2) DEFAULT 0,
  desconto_valor NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  observacoes TEXT,
  condicoes_pagamento TEXT,
  -- Dados do cliente no momento do orçamento (snapshot)
  cliente_nome_snapshot TEXT,
  cliente_cnpj_snapshot TEXT,
  cliente_email_snapshot TEXT,
  cliente_telefone_snapshot TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA: orcamentos_itens
-- ============================================================
CREATE TABLE IF NOT EXISTS orcamentos_itens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id UUID NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  especificacao TEXT, -- ex: "Adesivo Vinil, 130g/m², laminação fosca"
  quantidade NUMERIC(10,3) DEFAULT 1,
  unidade TEXT DEFAULT 'un', -- un, m², m, ml, kit, etc.
  valor_unitario NUMERIC(12,2) DEFAULT 0,
  valor_total NUMERIC(12,2) DEFAULT 0,
  prazo_producao_dias INTEGER,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEQUENCE / FUNÇÃO para gerar número do orçamento
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS orcamento_numero_seq START 1;

CREATE OR REPLACE FUNCTION gerar_numero_orcamento()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero IS NULL THEN
    NEW.numero := 'ORC-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('orcamento_numero_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_gerar_numero_orcamento ON orcamentos;
CREATE TRIGGER trigger_gerar_numero_orcamento
  BEFORE INSERT ON orcamentos
  FOR EACH ROW EXECUTE FUNCTION gerar_numero_orcamento();

-- ============================================================
-- TRIGGER: atualiza updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_clientes_updated_at ON clientes;
CREATE TRIGGER trigger_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_orcamentos_updated_at ON orcamentos;
CREATE TRIGGER trigger_orcamentos_updated_at
  BEFORE UPDATE ON orcamentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes_contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamentos_itens ENABLE ROW LEVEL SECURITY;

-- Políticas: usuários autenticados podem ver/editar tudo
CREATE POLICY "Authenticated users can manage clientes"
  ON clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage clientes_contatos"
  ON clientes_contatos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage orcamentos"
  ON orcamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage orcamentos_itens"
  ON orcamentos_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clientes_razao_social ON clientes(razao_social);
CREATE INDEX IF NOT EXISTS idx_clientes_ativo ON clientes(ativo);
CREATE INDEX IF NOT EXISTS idx_clientes_contatos_cliente ON clientes_contatos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente ON orcamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status ON orcamentos(status);
CREATE INDEX IF NOT EXISTS idx_orcamentos_numero ON orcamentos(numero);
CREATE INDEX IF NOT EXISTS idx_orcamentos_itens_orcamento ON orcamentos_itens(orcamento_id);

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE clientes IS 'Empresas clientes da Croma Print - módulo comercial';
COMMENT ON TABLE clientes_contatos IS 'Contatos (pessoas) por cliente';
COMMENT ON TABLE orcamentos IS 'Orçamentos/propostas comerciais';
COMMENT ON TABLE orcamentos_itens IS 'Itens de cada orçamento';

-- ============================================================
-- 5. TABELA: funil_vendas (CRM Kanban)
-- ============================================================
CREATE TABLE IF NOT EXISTS funil_vendas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa TEXT NOT NULL,
  contato TEXT,
  telefone TEXT,
  email TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  valor NUMERIC(12,2) DEFAULT 0,
  fase TEXT DEFAULT 'prospecto' CHECK (fase IN (
    'prospecto', 'contato_feito', 'proposta_enviada',
    'negociacao', 'fechado_ganho', 'perdido'
  )),
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  vendedor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  motivo_perda TEXT,
  data_fechamento DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE funil_vendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage funil_vendas"
  ON funil_vendas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_funil_fase ON funil_vendas(fase);
CREATE INDEX IF NOT EXISTS idx_funil_vendedor ON funil_vendas(vendedor_id);

DROP TRIGGER IF EXISTS trigger_funil_updated_at ON funil_vendas;
CREATE TRIGGER trigger_funil_updated_at
  BEFORE UPDATE ON funil_vendas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 6. TABELA: produtos (catálogo de produtos)
-- ============================================================
CREATE TABLE IF NOT EXISTS produtos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN (
    'fachadas', 'pdv', 'comunicacao_interna', 'campanhas', 'envelopamento'
  )),
  unidade TEXT DEFAULT 'un' CHECK (unidade IN ('m²', 'ml', 'm', 'un', 'kg', 'l', 'kit')),
  valor_mp NUMERIC(12,2) DEFAULT 0,         -- custo matéria prima por unidade
  markup NUMERIC(5,2) DEFAULT 40,            -- % markup
  minutos_producao INTEGER DEFAULT 30,       -- tempo de produção em minutos
  margem_minima NUMERIC(5,2) DEFAULT 20,    -- margem mínima para negociação
  preco_venda NUMERIC(12,2) DEFAULT 0,      -- preço calculado (MP + MO + markup)
  observacoes TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage produtos"
  ON produtos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON produtos(ativo);

DROP TRIGGER IF EXISTS trigger_produtos_updated_at ON produtos;
CREATE TRIGGER trigger_produtos_updated_at
  BEFORE UPDATE ON produtos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 7. TABELA: financeiro_lancamentos (lançamentos financeiros)
-- ============================================================
CREATE TABLE IF NOT EXISTS financeiro_lancamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  descricao TEXT NOT NULL,
  categoria TEXT,                            -- ex: "Matéria Prima", "Despesa Fixa", "Imposto"
  valor NUMERIC(12,2) NOT NULL,
  data_lancamento DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE,
  data_pagamento DATE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'vencido', 'cancelado')),
  referencia_id UUID,                        -- ID do orçamento ou OS associado
  referencia_tipo TEXT,                      -- 'orcamento', 'os', 'manual'
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE financeiro_lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage financeiro_lancamentos"
  ON financeiro_lancamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_financeiro_tipo ON financeiro_lancamentos(tipo);
CREATE INDEX IF NOT EXISTS idx_financeiro_status ON financeiro_lancamentos(status);
CREATE INDEX IF NOT EXISTS idx_financeiro_data ON financeiro_lancamentos(data_lancamento);

DROP TRIGGER IF EXISTS trigger_financeiro_updated_at ON financeiro_lancamentos;
CREATE TRIGGER trigger_financeiro_updated_at
  BEFORE UPDATE ON financeiro_lancamentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 8. TABELA: config_precificacao (configurações do custeio direto)
-- ============================================================
CREATE TABLE IF NOT EXISTS config_precificacao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  faturamento_medio NUMERIC(12,2) DEFAULT 110000,  -- média 12 meses
  custo_operacional NUMERIC(12,2) DEFAULT 36800,   -- despesas fixas totais
  custo_produtivo NUMERIC(12,2) DEFAULT 23744,     -- folha produção
  total_folha_producao NUMERIC(12,2) DEFAULT 23744,
  qtd_funcionarios_producao INTEGER DEFAULT 6,
  percentual_comissao NUMERIC(5,2) DEFAULT 5,
  percentual_impostos NUMERIC(5,2) DEFAULT 12,
  percentual_juros NUMERIC(5,2) DEFAULT 2,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir configuração padrão (baseada no PDF Formação de preço Mubisys)
INSERT INTO config_precificacao (
  faturamento_medio, custo_operacional, custo_produtivo,
  total_folha_producao, qtd_funcionarios_producao,
  percentual_comissao, percentual_impostos, percentual_juros
) VALUES (
  110000, 36800, 23744, 23744, 6, 5, 12, 2
) ON CONFLICT DO NOTHING;

ALTER TABLE config_precificacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage config_precificacao"
  ON config_precificacao FOR ALL TO authenticated USING (true) WITH CHECK (true);
