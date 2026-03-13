-- ============================================================================
-- 021 — MÓDULO DE INTEGRAÇÃO BANCÁRIA — BOLETOS + CNAB 400
-- Data: 2026-03-13
-- Tabelas: bank_accounts, bank_slips, bank_remittances, bank_remittance_items,
--          bank_returns, bank_return_items
-- RPC: next_nosso_numero()
-- ============================================================================

-- ═══════════════════════════════════════
-- 1. CONTAS BANCÁRIAS
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS bank_accounts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                    TEXT NOT NULL,                          -- "Itaú Cobrança Principal"
  banco_codigo            TEXT NOT NULL,                          -- "341" para Itaú
  banco_nome              TEXT NOT NULL,                          -- "Banco Itaú S.A."
  agencia                 TEXT NOT NULL,
  agencia_digito          TEXT,
  conta                   TEXT NOT NULL,
  conta_digito            TEXT NOT NULL,
  carteira                TEXT NOT NULL DEFAULT '109',            -- Código da carteira
  convenio                TEXT,                                    -- Número do convênio
  cedente_nome            TEXT NOT NULL,                          -- Razão social no boleto
  cedente_cnpj            TEXT NOT NULL,                          -- CNPJ 14 dígitos
  cedente_endereco        TEXT,
  cedente_cidade          TEXT,
  cedente_estado          TEXT CHECK (cedente_estado IS NULL OR length(cedente_estado) = 2),
  cedente_cep             TEXT,
  nosso_numero_sequencial BIGINT NOT NULL DEFAULT 1,             -- Sequencial auto-incremento
  instrucoes_padrao       TEXT,                                    -- Instruções padrão do boleto
  juros_ao_mes            NUMERIC(5,2) DEFAULT 2.00,             -- Juros mensal %
  multa_percentual        NUMERIC(5,2) DEFAULT 2.00,             -- Multa atraso %
  dias_protesto           INTEGER DEFAULT 0,                      -- Dias para protesto
  ativo                   BOOLEAN DEFAULT true,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_ativo
  ON bank_accounts(ativo) WHERE ativo = true;

-- Trigger updated_at
CREATE TRIGGER trg_bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════
-- 2. BOLETOS (bank_slips)
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS bank_slips (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id       UUID NOT NULL REFERENCES bank_accounts(id),
  conta_receber_id      UUID REFERENCES contas_receber(id) ON DELETE SET NULL,
  pedido_id             UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  cliente_id            UUID NOT NULL REFERENCES clientes(id),
  nosso_numero          TEXT NOT NULL,
  seu_numero            TEXT,                                     -- Referência do pagador
  valor_nominal         NUMERIC(12,2) NOT NULL,
  valor_juros           NUMERIC(12,2) DEFAULT 0,
  valor_multa           NUMERIC(12,2) DEFAULT 0,
  valor_desconto        NUMERIC(12,2) DEFAULT 0,
  valor_pago            NUMERIC(12,2),
  data_emissao          DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento       DATE NOT NULL,
  data_pagamento        DATE,
  data_credito          DATE,
  data_limite_desconto  DATE,
  sacado_nome           TEXT NOT NULL,
  sacado_cpf_cnpj       TEXT NOT NULL,
  sacado_endereco       TEXT,
  sacado_cidade         TEXT,
  sacado_estado         TEXT,
  sacado_cep            TEXT,
  instrucoes            TEXT,
  status                TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN (
    'rascunho', 'emitido', 'pronto_remessa', 'remetido',
    'registrado', 'pago', 'rejeitado', 'cancelado'
  )),
  motivo_rejeicao       TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_slips_status
  ON bank_slips(status);

CREATE INDEX IF NOT EXISTS idx_bank_slips_vencimento
  ON bank_slips(data_vencimento)
  WHERE status NOT IN ('pago', 'cancelado');

CREATE INDEX IF NOT EXISTS idx_bank_slips_conta_receber
  ON bank_slips(conta_receber_id)
  WHERE conta_receber_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_slips_nosso_numero
  ON bank_slips(bank_account_id, nosso_numero);

CREATE INDEX IF NOT EXISTS idx_bank_slips_cliente
  ON bank_slips(cliente_id);

-- Trigger updated_at
CREATE TRIGGER trg_bank_slips_updated_at
  BEFORE UPDATE ON bank_slips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════
-- 3. REMESSAS (bank_remittances)
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS bank_remittances (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id     UUID NOT NULL REFERENCES bank_accounts(id),
  numero_sequencial   INTEGER NOT NULL,
  arquivo_nome        TEXT NOT NULL,
  total_registros     INTEGER NOT NULL DEFAULT 0,
  valor_total         NUMERIC(14,2) NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'gerado' CHECK (status IN (
    'gerado', 'baixado', 'enviado', 'processado', 'erro'
  )),
  conteudo_arquivo    TEXT,                                       -- Conteúdo CNAB 400 para auditoria
  erro_descricao      TEXT,
  gerado_por          UUID REFERENCES auth.users(id),
  gerado_em           TIMESTAMPTZ DEFAULT now(),
  enviado_em          TIMESTAMPTZ,
  processado_em       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_remittances_seq
  ON bank_remittances(bank_account_id, numero_sequencial);

CREATE INDEX IF NOT EXISTS idx_bank_remittances_status
  ON bank_remittances(status);

CREATE TRIGGER trg_bank_remittances_updated_at
  BEFORE UPDATE ON bank_remittances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════
-- 4. ITENS DE REMESSA (bank_remittance_items)
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS bank_remittance_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remittance_id   UUID NOT NULL REFERENCES bank_remittances(id) ON DELETE CASCADE,
  bank_slip_id    UUID NOT NULL REFERENCES bank_slips(id) ON DELETE RESTRICT,
  linha_numero    INTEGER NOT NULL,
  conteudo_linha  TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_remittance_items_remittance
  ON bank_remittance_items(remittance_id);

-- ═══════════════════════════════════════
-- 5. RETORNOS (bank_returns) — schema preparado
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS bank_returns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id   UUID NOT NULL REFERENCES bank_accounts(id),
  arquivo_nome      TEXT NOT NULL,
  total_registros   INTEGER DEFAULT 0,
  total_processados INTEGER DEFAULT 0,
  total_erros       INTEGER DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'importado' CHECK (status IN (
    'importado', 'processando', 'processado', 'erro'
  )),
  importado_por     UUID REFERENCES auth.users(id),
  importado_em      TIMESTAMPTZ DEFAULT now(),
  processado_em     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_returns_status
  ON bank_returns(status);

-- ═══════════════════════════════════════
-- 6. ITENS DE RETORNO (bank_return_items)
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS bank_return_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id             UUID NOT NULL REFERENCES bank_returns(id) ON DELETE CASCADE,
  bank_slip_id          UUID REFERENCES bank_slips(id) ON DELETE SET NULL,
  nosso_numero          TEXT NOT NULL,
  ocorrencia_codigo     TEXT NOT NULL,
  ocorrencia_descricao  TEXT,
  valor_pago            NUMERIC(12,2),
  data_pagamento        DATE,
  data_credito          DATE,
  valor_juros           NUMERIC(12,2),
  valor_tarifa          NUMERIC(12,2),
  linha_numero          INTEGER,
  conteudo_linha        TEXT,
  processado            BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_return_items_return
  ON bank_return_items(return_id);

CREATE INDEX IF NOT EXISTS idx_bank_return_items_nosso_numero
  ON bank_return_items(nosso_numero);

-- ═══════════════════════════════════════
-- 7. RPC: next_nosso_numero
-- ═══════════════════════════════════════

CREATE OR REPLACE FUNCTION next_nosso_numero(p_bank_account_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seq BIGINT;
BEGIN
  UPDATE bank_accounts
  SET nosso_numero_sequencial = nosso_numero_sequencial + 1,
      updated_at = now()
  WHERE id = p_bank_account_id
  RETURNING nosso_numero_sequencial INTO v_seq;

  IF v_seq IS NULL THEN
    RAISE EXCEPTION 'Conta bancária não encontrada: %', p_bank_account_id;
  END IF;

  RETURN lpad(v_seq::TEXT, 8, '0');
END;
$$;

-- ═══════════════════════════════════════
-- 8. RLS — Row Level Security
-- ═══════════════════════════════════════

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_remittances ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_remittance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_return_items ENABLE ROW LEVEL SECURITY;

-- bank_accounts: leitura para autenticados, escrita para admin/financeiro
CREATE POLICY "bank_accounts_select" ON bank_accounts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "bank_accounts_modify" ON bank_accounts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'diretor', 'financeiro')
    )
  );

-- bank_slips: leitura para autenticados, escrita para comercial+financeiro+admin
CREATE POLICY "bank_slips_select" ON bank_slips
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "bank_slips_modify" ON bank_slips
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'diretor', 'financeiro', 'comercial', 'comercial_senior')
    )
  );

-- bank_remittances: leitura para autenticados, escrita para financeiro+admin
CREATE POLICY "bank_remittances_select" ON bank_remittances
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "bank_remittances_modify" ON bank_remittances
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'diretor', 'financeiro')
    )
  );

-- bank_remittance_items: leitura para autenticados
CREATE POLICY "bank_remittance_items_select" ON bank_remittance_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "bank_remittance_items_modify" ON bank_remittance_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'diretor', 'financeiro')
    )
  );

-- bank_returns: leitura + importação para financeiro+admin
CREATE POLICY "bank_returns_select" ON bank_returns
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "bank_returns_modify" ON bank_returns
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'diretor', 'financeiro')
    )
  );

-- bank_return_items: leitura para autenticados
CREATE POLICY "bank_return_items_select" ON bank_return_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "bank_return_items_modify" ON bank_return_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'diretor', 'financeiro')
    )
  );

-- ═══════════════════════════════════════
-- 9. COMENTÁRIOS
-- ═══════════════════════════════════════

COMMENT ON TABLE bank_accounts IS 'Cadastro de contas bancárias/carteiras para cobrança via boleto. Migration 021.';
COMMENT ON TABLE bank_slips IS 'Boletos bancários com lifecycle completo (rascunho→pago). Migration 021.';
COMMENT ON TABLE bank_remittances IS 'Lotes de remessa CNAB 400 gerados para envio ao banco. Migration 021.';
COMMENT ON TABLE bank_remittance_items IS 'Itens (boletos) incluídos em cada lote de remessa. Migration 021.';
COMMENT ON TABLE bank_returns IS 'Arquivos de retorno bancário importados. Migration 021.';
COMMENT ON TABLE bank_return_items IS 'Eventos individuais de retorno (pagamento, rejeição, etc.). Migration 021.';
COMMENT ON FUNCTION next_nosso_numero IS 'Gera próximo nosso_numero atomicamente para uma conta bancária. Migration 021.';
