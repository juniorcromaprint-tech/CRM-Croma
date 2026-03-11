-- ============================================================
-- Migration 013: Checklists de Instalação e Produção
-- Sistema CRM Croma Print
-- ============================================================
-- Cria as tabelas de checklists operacionais para controle de
-- ferramentas, EPIs, consumíveis e verificações nos processos
-- de instalação (signmaker, fachada, vidro, local) e produção
-- (impressão, corte, acabamento).
-- ============================================================

-- ------------------------------------------------------------
-- TABELA: checklists
-- Modelo/template de checklist reutilizável por tipo de operação
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checklists (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        VARCHAR(150) NOT NULL,
  tipo        VARCHAR(50)  NOT NULL CHECK (tipo IN (
    'producao_impressao',
    'producao_corte',
    'producao_acabamento',
    'instalacao_signmaker',
    'instalacao_fachada',
    'instalacao_vidro',
    'local_instalacao'
  )),
  descricao   TEXT,
  versao      INTEGER      DEFAULT 1,
  ativo       BOOLEAN      DEFAULT TRUE,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE checklists IS 'Templates de checklists operacionais para instalação e produção';
COMMENT ON COLUMN checklists.tipo IS 'Tipo de operação: producao_impressao, producao_corte, producao_acabamento, instalacao_signmaker, instalacao_fachada, instalacao_vidro, local_instalacao';
COMMENT ON COLUMN checklists.versao IS 'Versão do checklist — incrementar ao alterar itens';

-- ------------------------------------------------------------
-- TABELA: checklist_itens
-- Itens individuais pertencentes a um checklist template
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checklist_itens (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID        NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  numero_item  INTEGER     NOT NULL,
  descricao    TEXT        NOT NULL,
  obrigatorio  BOOLEAN     DEFAULT TRUE,
  categoria    VARCHAR(20) CHECK (categoria IN (
    'ferramenta',
    'epi',
    'consumivel',
    'documentacao',
    'verificacao'
  )),
  observacao   TEXT,
  ativo        BOOLEAN     DEFAULT TRUE,
  UNIQUE (checklist_id, numero_item)
);

COMMENT ON TABLE checklist_itens IS 'Itens individuais de cada checklist template';
COMMENT ON COLUMN checklist_itens.numero_item IS 'Número de ordem do item dentro do checklist (único por checklist)';
COMMENT ON COLUMN checklist_itens.categoria IS 'Categoria do item: ferramenta, epi, consumivel, documentacao, verificacao';
COMMENT ON COLUMN checklist_itens.obrigatorio IS 'Se TRUE, o item deve ser respondido para concluir a execução';

-- ------------------------------------------------------------
-- TABELA: checklist_execucoes
-- Registro de uma execução real de um checklist (por OS ou produção)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checklist_execucoes (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id          UUID        NOT NULL REFERENCES checklists(id),
  ordem_instalacao_id   UUID        REFERENCES ordens_instalacao(id),
  ordem_producao_id     UUID        REFERENCES ordens_producao(id),
  tipo                  VARCHAR(10) CHECK (tipo IN ('saida', 'retorno', 'producao')),
  status                VARCHAR(25) DEFAULT 'em_andamento' CHECK (status IN (
    'em_andamento',
    'concluido',
    'pendente_assinatura'
  )),
  executado_por         UUID        REFERENCES profiles(id),
  responsavel_pcp       UUID        REFERENCES profiles(id),
  assinatura_url        TEXT,
  observacoes_gerais    TEXT,
  iniciado_em           TIMESTAMPTZ DEFAULT NOW(),
  concluido_em          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE checklist_execucoes IS 'Execuções reais de checklists vinculadas a ordens de instalação ou produção';
COMMENT ON COLUMN checklist_execucoes.tipo IS 'saida = checklist de saída para campo; retorno = checklist de retorno; producao = checklist de produção interna';
COMMENT ON COLUMN checklist_execucoes.status IS 'em_andamento | concluido | pendente_assinatura';
COMMENT ON COLUMN checklist_execucoes.assinatura_url IS 'URL da imagem/PDF da assinatura do responsável';

-- ------------------------------------------------------------
-- TABELA: checklist_execucao_itens
-- Resposta de cada item durante uma execução
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checklist_execucao_itens (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id   UUID        NOT NULL REFERENCES checklist_execucoes(id) ON DELETE CASCADE,
  item_id       UUID        NOT NULL REFERENCES checklist_itens(id),
  status        VARCHAR(20) CHECK (status IN (
    'confere',
    'nao_confere',
    'nao_aplicavel',
    'pendente'
  )),
  observacao    TEXT,
  foto_url      TEXT,
  respondido_em TIMESTAMPTZ
);

COMMENT ON TABLE checklist_execucao_itens IS 'Respostas de cada item em uma execução de checklist';
COMMENT ON COLUMN checklist_execucao_itens.status IS 'confere | nao_confere | nao_aplicavel | pendente';
COMMENT ON COLUMN checklist_execucao_itens.foto_url IS 'URL de foto comprobatória do item verificado';

-- ------------------------------------------------------------
-- ÍNDICES
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_checklist_execucoes_ordem_instalacao
  ON checklist_execucoes(ordem_instalacao_id);

CREATE INDEX IF NOT EXISTS idx_checklist_execucoes_ordem_producao
  ON checklist_execucoes(ordem_producao_id);

CREATE INDEX IF NOT EXISTS idx_checklist_execucoes_checklist
  ON checklist_execucoes(checklist_id);

CREATE INDEX IF NOT EXISTS idx_checklist_execucoes_executado_por
  ON checklist_execucoes(executado_por);

CREATE INDEX IF NOT EXISTS idx_checklist_itens_checklist
  ON checklist_itens(checklist_id);

CREATE INDEX IF NOT EXISTS idx_checklist_execucao_itens_execucao
  ON checklist_execucao_itens(execucao_id);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------

ALTER TABLE checklists              ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_itens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_execucoes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_execucao_itens ENABLE ROW LEVEL SECURITY;

-- checklists: leitura livre para autenticados; escrita para admin/pcp/producao/instalacao
CREATE POLICY "checklists_select_autenticados"
  ON checklists FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "checklists_write_roles"
  ON checklists FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'pcp', 'producao', 'instalacao')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'pcp', 'producao', 'instalacao')
    )
  );

-- checklist_itens: leitura livre para autenticados; escrita para admin/pcp
CREATE POLICY "checklist_itens_select_autenticados"
  ON checklist_itens FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "checklist_itens_write_roles"
  ON checklist_itens FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'pcp', 'producao', 'instalacao')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'pcp', 'producao', 'instalacao')
    )
  );

-- checklist_execucoes: leitura para autenticados; escrita para producao/instalacao/pcp/admin
CREATE POLICY "checklist_execucoes_select_autenticados"
  ON checklist_execucoes FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "checklist_execucoes_write_roles"
  ON checklist_execucoes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'pcp', 'producao', 'instalacao')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'pcp', 'producao', 'instalacao')
    )
  );

-- checklist_execucao_itens: leitura para autenticados; escrita para producao/instalacao/pcp/admin
CREATE POLICY "checklist_execucao_itens_select_autenticados"
  ON checklist_execucao_itens FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "checklist_execucao_itens_write_roles"
  ON checklist_execucao_itens FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'pcp', 'producao', 'instalacao')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'pcp', 'producao', 'instalacao')
    )
  );

-- ============================================================
-- SEED: Checklists e Itens
-- ============================================================
-- Usa blocos DO $$ com variáveis UUID para cada checklist,
-- garantindo que os itens referenciem corretamente seus pais.
-- ON CONFLICT DO NOTHING evita duplicatas em re-execuções.
-- ============================================================

-- ------------------------------------------------------------
-- CHECKLIST 1: Instalação SignMaker (Adesivos/Vinis) — 30 itens
-- Ferramentas, consumíveis, EPIs e documentação para instalação
-- de adesivos, vinis e comunicação visual em geral.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_checklist_id UUID;
BEGIN
  INSERT INTO checklists (id, nome, tipo, descricao, versao, ativo)
  VALUES (
    gen_random_uuid(),
    'Instalação SignMaker (Adesivos/Vinis)',
    'instalacao_signmaker',
    'Verificação de ferramentas para instalação de adesivos, vinis e comunicação em geral',
    1,
    TRUE
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_checklist_id;

  -- Se já existia e RETURNING não retornou nada, busca pelo nome+tipo
  IF v_checklist_id IS NULL THEN
    SELECT id INTO v_checklist_id
    FROM checklists
    WHERE nome = 'Instalação SignMaker (Adesivos/Vinis)'
      AND tipo = 'instalacao_signmaker'
    LIMIT 1;
  END IF;

  -- Ferramentas (itens 1-17)
  INSERT INTO checklist_itens (checklist_id, numero_item, descricao, obrigatorio, categoria) VALUES
    (v_checklist_id,  1, 'Soprador',                                                                                   TRUE, 'ferramenta'),
    (v_checklist_id,  2, 'Extensão',                                                                                   TRUE, 'ferramenta'),
    (v_checklist_id,  3, 'Trena',                                                                                      TRUE, 'ferramenta'),
    (v_checklist_id,  4, 'Régua',                                                                                      TRUE, 'ferramenta'),
    (v_checklist_id,  5, 'Raspador ratinho c/ lâminas',                                                                TRUE, 'ferramenta'),
    (v_checklist_id,  6, 'Jogo de Chave Fenda',                                                                        TRUE, 'ferramenta'),
    (v_checklist_id,  7, 'Jogo de Chave Philips',                                                                      TRUE, 'ferramenta'),
    (v_checklist_id,  8, 'Alicate',                                                                                    TRUE, 'ferramenta'),
    (v_checklist_id,  9, 'Jogo de Chave Allen',                                                                        TRUE, 'ferramenta'),
    (v_checklist_id, 10, 'Jogo de Chave Torx Macho',                                                                   TRUE, 'ferramenta'),
    (v_checklist_id, 11, 'Andaime (conforme altura local)',                                                             TRUE, 'ferramenta'),
    (v_checklist_id, 12, 'Escada (conforme altura local)',                                                              TRUE, 'ferramenta'),
    (v_checklist_id, 13, 'Espátula para acabamento',                                                                   TRUE, 'ferramenta'),
    (v_checklist_id, 14, 'Espátula de Feltro',                                                                         TRUE, 'ferramenta'),
    (v_checklist_id, 15, 'Estilete para corte + Cx. lâmina larga e estreita',                                          TRUE, 'ferramenta'),
    (v_checklist_id, 16, 'Estilete para acabamento',                                                                   TRUE, 'ferramenta'),
    (v_checklist_id, 17, 'Tesoura',                                                                                    TRUE, 'ferramenta')
  ON CONFLICT (checklist_id, numero_item) DO NOTHING;

  -- Consumíveis (itens 18-27)
  INSERT INTO checklist_itens (checklist_id, numero_item, descricao, obrigatorio, categoria) VALUES
    (v_checklist_id, 18, 'Saco de Lixo',                                                                               TRUE, 'consumivel'),
    (v_checklist_id, 19, 'Removedor p/ limpeza',                                                                       TRUE, 'consumivel'),
    (v_checklist_id, 20, '1 Galão Álcool 5L + Álcool Isopropílico',                                                    TRUE, 'consumivel'),
    (v_checklist_id, 21, 'Fita Crepe',                                                                                 TRUE, 'consumivel'),
    (v_checklist_id, 22, 'Borrifador c/ água e sabão',                                                                 TRUE, 'consumivel'),
    (v_checklist_id, 23, 'Detergente (caso precise repor borrifador)',                                                  TRUE, 'consumivel'),
    (v_checklist_id, 24, 'Fita Dupla Face',                                                                            TRUE, 'consumivel'),
    (v_checklist_id, 25, 'Primer',                                                                                     TRUE, 'consumivel'),
    (v_checklist_id, 26, 'Estopa',                                                                                     TRUE, 'consumivel'),
    (v_checklist_id, 27, 'Thinner e Querosene',                                                                        TRUE, 'consumivel')
  ON CONFLICT (checklist_id, numero_item) DO NOTHING;

  -- EPIs (itens 28-29)
  INSERT INTO checklist_itens (checklist_id, numero_item, descricao, obrigatorio, categoria) VALUES
    (v_checklist_id, 28, 'EPI Solo: Colete, Bota, Calça e Protetor Auricular',                                         TRUE, 'epi'),
    (v_checklist_id, 29, 'EPI Altura: Capacete, Óculos, Luva, Colete, Bota, Calça, Protetor Auricular, Cinta, Talabarte, Corda e Oito', TRUE, 'epi')
  ON CONFLICT (checklist_id, numero_item) DO NOTHING;

  -- Documentação (item 30)
  INSERT INTO checklist_itens (checklist_id, numero_item, descricao, obrigatorio, categoria) VALUES
    (v_checklist_id, 30, 'Imãs de fixação + Caneta p/ marcação',                                                       TRUE, 'documentacao')
  ON CONFLICT (checklist_id, numero_item) DO NOTHING;

END;
$$;

-- ------------------------------------------------------------
-- CHECKLIST 2: Instalação Fachadas — 56 itens
-- Ferramentas e equipamentos para instalação de fachadas,
-- totens e estruturas metálicas.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_checklist_id UUID;
BEGIN
  INSERT INTO checklists (id, nome, tipo, descricao, versao, ativo)
  VALUES (
    gen_random_uuid(),
    'Instalação Fachadas',
    'instalacao_fachada',
    'Verificação de ferramentas e equipamentos para instalação de fachadas, totens e estruturas metálicas',
    1,
    TRUE
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_checklist_id;

  IF v_checklist_id IS NULL THEN
    SELECT id INTO v_checklist_id
    FROM checklists
    WHERE nome = 'Instalação Fachadas'
      AND tipo = 'instalacao_fachada'
    LIMIT 1;
  END IF;

  -- Ferramentas (itens 1-39)
  INSERT INTO checklist_itens (checklist_id, numero_item, descricao, obrigatorio, categoria) VALUES
    (v_checklist_id,  1, 'Celular Carregado',                                                                          TRUE, 'ferramenta'),
    (v_checklist_id,  2, 'Rebitadeira (sempre com reserva)',                                                           TRUE, 'ferramenta'),
    (v_checklist_id,  3, 'Furadeira Impacto',                                                                          TRUE, 'ferramenta'),
    (v_checklist_id,  4, 'Furadeira + Mandril',                                                                        TRUE, 'ferramenta'),
    (v_checklist_id,  5, 'Parafusadeira + Carregador',                                                                 TRUE, 'ferramenta'),
    (v_checklist_id,  6, 'Tupia + Refiladeira',                                                                        TRUE, 'ferramenta'),
    (v_checklist_id,  7, 'Lixadeira',                                                                                  TRUE, 'ferramenta'),
    (v_checklist_id,  8, 'Extensão Elétrica 20m e 30m',                                                                TRUE, 'ferramenta'),
    (v_checklist_id,  9, 'Jogo de Chaves Philips',                                                                     TRUE, 'ferramenta'),
    (v_checklist_id, 10, 'Jogo de Chave Fenda',                                                                        TRUE, 'ferramenta'),
    (v_checklist_id, 11, 'Jogo de Chave Catraca 8/10/11/12/13/14',                                                     TRUE, 'ferramenta'),
    (v_checklist_id, 12, 'Jogo de Chave Boca 8 ao 19',                                                                 TRUE, 'ferramenta'),
    (v_checklist_id, 13, 'Jogo de Chave Pito L 8/11/12/13/15',                                                         TRUE, 'ferramenta'),
    (v_checklist_id, 14, 'Alicate',                                                                                    TRUE, 'ferramenta'),
    (v_checklist_id, 15, 'Alicate Pressão',                                                                            TRUE, 'ferramenta'),
    (v_checklist_id, 16, 'Alicate de Corte',                                                                           TRUE, 'ferramenta'),
    (v_checklist_id, 17, 'Alicate de Bico',                                                                            TRUE, 'ferramenta'),
    (v_checklist_id, 18, 'Nível',                                                                                      TRUE, 'ferramenta'),
    (v_checklist_id, 19, 'Nível Laser',                                                                                TRUE, 'ferramenta'),
    (v_checklist_id, 20, 'Prumo',                                                                                      TRUE, 'ferramenta'),
    (v_checklist_id, 21, 'Martelo + Martelo Borracha',                                                                 TRUE, 'ferramenta'),
    (v_checklist_id, 22, 'Marreta',                                                                                    TRUE, 'ferramenta'),
    (v_checklist_id, 23, 'Aplicador de PU',                                                                            TRUE, 'ferramenta'),
    (v_checklist_id, 24, 'Talhadeira',                                                                                 TRUE, 'ferramenta'),
    (v_checklist_id, 25, 'Arco de Serra + Serra Reserva',                                                              TRUE, 'ferramenta'),
    (v_checklist_id, 26, 'Linha de Pedreiro',                                                                          TRUE, 'ferramenta'),
    (v_checklist_id, 27, 'Andaimes (conforme altura) + Travas, Rodas e Passarela',                                     TRUE, 'ferramenta'),
    (v_checklist_id, 28, 'Escada (conforme altura local)',                                                              TRUE, 'ferramenta'),
    (v_checklist_id, 29, 'Mangueira de Nível',                                                                         TRUE, 'ferramenta'),
    (v_checklist_id, 30, 'Mesa para Corte ACM Móvel',                                                                  TRUE, 'ferramenta'),
    (v_checklist_id, 31, 'Máquina de Solda + Eletrodos',                                                               TRUE, 'ferramenta'),
    (v_checklist_id, 32, 'Sargentos',                                                                                  TRUE, 'ferramenta'),
    (v_checklist_id, 33, 'Régua de Alumínio',                                                                          TRUE, 'ferramenta'),
    (v_checklist_id, 34, 'Lima',                                                                                       TRUE, 'ferramenta'),
    (v_checklist_id, 35, 'Pincel (Retoque e Largo)',                                                                   TRUE, 'ferramenta'),
    (v_checklist_id, 36, 'Cavadeira',                                                                                  TRUE, 'ferramenta'),
    (v_checklist_id, 37, 'Enxada',                                                                                     TRUE, 'ferramenta'),
    (v_checklist_id, 38, 'Cavadeira de Boca',                                                                          TRUE, 'ferramenta'),
    (v_checklist_id, 39, 'Trena',                                                                                      TRUE, 'ferramenta')
  ON CONFLICT (checklist_id, numero_item) DO NOTHING;

  -- Consumíveis (itens 40-53)
  INSERT INTO checklist_itens (checklist_id, numero_item, descricao, obrigatorio, categoria) VALUES
    (v_checklist_id, 40, 'PU (Cores do Projeto)',                                                                      TRUE, 'consumivel'),
    (v_checklist_id, 41, 'Fita Crepe',                                                                                 TRUE, 'consumivel'),
    (v_checklist_id, 42, 'Fita Isolante',                                                                              TRUE, 'consumivel'),
    (v_checklist_id, 43, 'Corda para Içamento de Cargas',                                                              TRUE, 'consumivel'),
    (v_checklist_id, 44, 'Corda Para Trava Quedas (somente c/ altura)',                                                TRUE, 'consumivel'),
    (v_checklist_id, 45, 'Disco de Corte / Disco de Desbaste',                                                         TRUE, 'consumivel'),
    (v_checklist_id, 46, 'Disco para Lixadeira',                                                                       TRUE, 'consumivel'),
    (v_checklist_id, 47, 'WD-40 Desengripante',                                                                        TRUE, 'consumivel'),
    (v_checklist_id, 48, 'Jogo de Brocas Vídea',                                                                       TRUE, 'consumivel'),
    (v_checklist_id, 49, 'Jogo de Brocas Aço Rápido',                                                                  TRUE, 'consumivel'),
    (v_checklist_id, 50, 'Parafusos Sextavados/Francês/Philips + Buchas nº 6/8/10',                                    TRUE, 'consumivel'),
    (v_checklist_id, 51, 'Parafusos Brocantes',                                                                        TRUE, 'consumivel'),
    (v_checklist_id, 52, 'Rebite 310 (+ modelo maior)',                                                                TRUE, 'consumivel'),
    (v_checklist_id, 53, 'Tinta para Retoque',                                                                         TRUE, 'consumivel')
  ON CONFLICT (checklist_id, numero_item) DO NOTHING;

  -- EPIs (itens 54-55)
  INSERT INTO checklist_itens (checklist_id, numero_item, descricao, obrigatorio, categoria) VALUES
    (v_checklist_id, 54, 'EPI Solo: Colete, Bota, Calça e Protetor Auricular',                                         TRUE, 'epi'),
    (v_checklist_id, 55, 'EPI Altura: Capacete, Óculos, Luva, Colete, Bota, Calça, Protetor Auricular, Cinta, Talabarte, Corda e Oito', TRUE, 'epi')
  ON CONFLICT (checklist_id, numero_item) DO NOTHING;

  -- Verificação (item 56)
  INSERT INTO checklist_itens (checklist_id, numero_item, descricao, obrigatorio, categoria) VALUES
    (v_checklist_id, 56, 'Verificar ferrugens nas ferramentas + Lubrificar se necessário',                             TRUE, 'verificacao')
  ON CONFLICT (checklist_id, numero_item) DO NOTHING;

END;
$$;

-- ------------------------------------------------------------
-- CHECKLIST 3: Instalação Vidros/Acrílicos — 22 itens
-- Ferramentas, consumíveis e EPIs para instalação de vidros,
-- acrílicos e displays.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_checklist_id UUID;
BEGIN
  INSERT INTO checklists (id, nome, tipo, descricao, versao, ativo)
  VALUES (
    gen_random_uuid(),
    'Instalação Vidros/Acrílicos',
    'instalacao_vidro',
    'Verificação de ferramentas para instalação de vidros, acrílicos e displays',
    1,
    TRUE
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_checklist_id;

  IF v_checklist_id IS NULL THEN
    SELECT id INTO v_checklist_id
    FROM checklists
    WHERE nome = 'Instalação Vidros/Acrílicos'
      AND tipo = 'instalacao_vidro'
    LIMIT 1;
  END IF;

  -- Ferramentas (itens 1-11)
  INSERT INTO checklist_itens (checklist_id, numero_item, descricao, obrigatorio, categoria) VALUES
    (v_checklist_id,  1, 'Celular Carregado',                                                                          TRUE, 'ferramenta'),
    (v_checklist_id,  2, 'Furadeira Normal + Mandril',                                                                 TRUE, 'ferramenta'),
    (v_checklist_id,  3, 'Nível Laser',                                                                                TRUE, 'ferramenta'),
    (v_checklist_id,  4, 'Gabarito do Vidro p/ Furar a Parede',                                                        TRUE, 'ferramenta'),
    (v_checklist_id,  5, 'Chave Philips e de Fenda',                                                                   TRUE, 'ferramenta'),
    (v_checklist_id,  6, 'Extensão Elétrica 20m e 30m',                                                                TRUE, 'ferramenta'),
    (v_checklist_id,  7, 'Escada (sem andaime)',                                                                       TRUE, 'ferramenta'),
    (v_checklist_id,  8, 'Parafusadeira + Carregador',                                                                 TRUE, 'ferramenta'),
    (v_checklist_id,  9, 'Rebitadeira + Rebite',                                                                       TRUE, 'ferramenta'),
    (v_checklist_id, 10, 'Espátulas',                                                                                  TRUE, 'ferramenta'),
    (v_checklist_id, 11, 'Martelo + Martelo Borracha',                                                                 TRUE, 'ferramenta')
  ON CONFLICT (checklist_id, numero_item) DO NOTHING;

  -- Consumíveis (itens 12-20)
  INSERT INTO checklist_itens (checklist_id, numero_item, descricao, obrigatorio, categoria) VALUES
    (v_checklist_id, 12, 'Jogo de Brocas de Vídea e de Aço',                                                          TRUE, 'consumivel'),
    (v_checklist_id, 13, 'Kit de Parafusos e Buchas',                                                                  TRUE, 'consumivel'),
    (v_checklist_id, 14, 'Prolongadores / Espaçadores',                                                                TRUE, 'consumivel'),
    (v_checklist_id, 15, 'Bucha Parede / Drywall 8mm',                                                                 TRUE, 'consumivel'),
    (v_checklist_id, 16, 'Galão de Álcool 5L',                                                                         TRUE, 'consumivel'),
    (v_checklist_id, 17, 'Estopa / Pano Limpeza',                                                                      TRUE, 'consumivel'),
    (v_checklist_id, 18, 'Fita Crepe',                                                                                 TRUE, 'consumivel'),
    (v_checklist_id, 19, 'Estilete / Lâmina + Soprador',                                                               TRUE, 'consumivel'),
    (v_checklist_id, 20, 'Sacolas para resíduos',                                                                      TRUE, 'consumivel')
  ON CONFLICT (checklist_id, numero_item) DO NOTHING;

  -- EPIs (itens 21-22)
  INSERT INTO checklist_itens (checklist_id, numero_item, descricao, obrigatorio, categoria) VALUES
    (v_checklist_id, 21, 'EPI Solo: Colete, Bota, Calça e Protetor Auricular',                                         TRUE, 'epi'),
    (v_checklist_id, 22, 'EPI Altura: Capacete, Óculos, Luva, Colete, Bota, Calça, Protetor Auricular, Cinta, Talabarte, Corda e Oito', TRUE, 'epi')
  ON CONFLICT (checklist_id, numero_item) DO NOTHING;

END;
$$;

-- ------------------------------------------------------------
-- CHECKLIST 4: Local de Instalação — 8 itens (NR-18)
-- Verificação do local conforme NR-18 - Portaria SIT 157/2006.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_checklist_id UUID;
BEGIN
  INSERT INTO checklists (id, nome, tipo, descricao, versao, ativo)
  VALUES (
    gen_random_uuid(),
    'Local de Instalação (NR-18)',
    'local_instalacao',
    'Verificação do local de instalação conforme NR-18 - Portaria SIT 157/2006',
    1,
    TRUE
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_checklist_id;

  IF v_checklist_id IS NULL THEN
    SELECT id INTO v_checklist_id
    FROM checklists
    WHERE nome = 'Local de Instalação (NR-18)'
      AND tipo = 'local_instalacao'
    LIMIT 1;
  END IF;

  -- EPIs (itens 1-4)
  INSERT INTO checklist_itens (checklist_id, numero_item, descricao, obrigatorio, categoria) VALUES
    (v_checklist_id, 1, 'EPIs completos de todos os colaboradores',                                                     TRUE, 'epi'),
    (v_checklist_id, 2, 'Camiseta identificada (cada colaborador)',                                                     TRUE, 'epi'),
    (v_checklist_id, 3, 'Crachá (cada colaborador)',                                                                    TRUE, 'epi'),
    (v_checklist_id, 4, 'Capacete Identificado (cada colaborador)',                                                     TRUE, 'epi')
  ON CONFLICT (checklist_id, numero_item) DO NOTHING;

  -- Ferramentas de isolamento (itens 5-7)
  INSERT INTO checklist_itens (checklist_id, numero_item, descricao, obrigatorio, categoria) VALUES
    (v_checklist_id, 5, 'Cones (número necessário para isolar a área)',                                                 TRUE, 'ferramenta'),
    (v_checklist_id, 6, 'Fita Zebrada',                                                                                TRUE, 'ferramenta'),
    (v_checklist_id, 7, 'Cavalete de Obras',                                                                           TRUE, 'ferramenta')
  ON CONFLICT (checklist_id, numero_item) DO NOTHING;

  -- Documentação/Marketing (item 8)
  INSERT INTO checklist_itens (checklist_id, numero_item, descricao, obrigatorio, categoria) VALUES
    (v_checklist_id, 8, 'Cavalete Comercial com Folders e Cartões de Visita da Croma',                                 TRUE, 'documentacao')
  ON CONFLICT (checklist_id, numero_item) DO NOTHING;

END;
$$;

-- ------------------------------------------------------------
-- CHECKLIST 5: Produção — Impressão — 10 itens
-- Verificações operacionais para o processo de impressão.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_checklist_id UUID;
BEGIN
  INSERT INTO checklists (id, nome, tipo, descricao, versao, ativo)
  VALUES (
    gen_random_uuid(),
    'Produção - Impressão',
    'producao_impressao',
    'Verificações operacionais para o processo de impressão digital',
    1,
    TRUE
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_checklist_id;

  IF v_checklist_id IS NULL THEN
    SELECT id INTO v_checklist_id
    FROM checklists
    WHERE nome = 'Produção - Impressão'
      AND tipo = 'producao_impressao'
    LIMIT 1;
  END IF;

  INSERT INTO checklist_itens (checklist_id, numero_item, descricao, obrigatorio, categoria) VALUES
    (v_checklist_id,  1, 'Verificar mídia na impressora',                                                               TRUE, 'ferramenta'),
    (v_checklist_id,  2, 'Calibrar cabeças de impressão',                                                               TRUE, 'verificacao'),
    (v_checklist_id,  3, 'Definir perfil ICC correto para o substrato',                                                 TRUE, 'verificacao'),
    (v_checklist_id,  4, 'Imprimir teste de cor (antes do job real)',                                                   TRUE, 'verificacao'),
    (v_checklist_id,  5, 'Verificar tensão da mídia',                                                                   TRUE, 'verificacao'),
    (v_checklist_id,  6, 'Confirmar dimensões do arquivo com a OS',                                                     TRUE, 'documentacao'),
    (v_checklist_id,  7, 'Conferir resolução mínima do arquivo (720dpi)',                                               TRUE, 'verificacao'),
    (v_checklist_id,  8, 'Iniciar impressão e monitorar primeiros 30cm',                                                TRUE, 'verificacao'),
    (v_checklist_id,  9, 'Verificar desbotamento e alinhamento',                                                        TRUE, 'verificacao'),
    (v_checklist_id, 10, 'Registrar metragem impressa na OS',                                                           TRUE, 'documentacao')
  ON CONFLICT (checklist_id, numero_item) DO NOTHING;

END;
$$;

-- ------------------------------------------------------------
-- CHECKLIST 6: Produção — Corte e Acabamento — 8 itens
-- Verificações operacionais para corte e acabamento de peças.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_checklist_id UUID;
BEGIN
  INSERT INTO checklists (id, nome, tipo, descricao, versao, ativo)
  VALUES (
    gen_random_uuid(),
    'Produção - Corte e Acabamento',
    'producao_acabamento',
    'Verificações operacionais para corte e acabamento de peças impressas',
    1,
    TRUE
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_checklist_id;

  IF v_checklist_id IS NULL THEN
    SELECT id INTO v_checklist_id
    FROM checklists
    WHERE nome = 'Produção - Corte e Acabamento'
      AND tipo = 'producao_acabamento'
    LIMIT 1;
  END IF;

  INSERT INTO checklist_itens (checklist_id, numero_item, descricao, obrigatorio, categoria) VALUES
    (v_checklist_id, 1, 'Verificar medidas finais na OS antes de cortar',                                               TRUE, 'documentacao'),
    (v_checklist_id, 2, 'Calibrar equipamento de corte (laser/router)',                                                 TRUE, 'ferramenta'),
    (v_checklist_id, 3, 'Fazer corte teste em sobra de material',                                                       TRUE, 'verificacao'),
    (v_checklist_id, 4, 'Executar corte no material final',                                                             TRUE, 'verificacao'),
    (v_checklist_id, 5, 'Verificar rebarbas e acabamentos',                                                             TRUE, 'verificacao'),
    (v_checklist_id, 6, 'Aplicar acabamento conforme especificação (ilhós, bastão, laminação)',                         TRUE, 'verificacao'),
    (v_checklist_id, 7, 'Conferir qualidade final com OS',                                                              TRUE, 'documentacao'),
    (v_checklist_id, 8, 'Embalar e identificar com etiqueta da OS',                                                     TRUE, 'verificacao')
  ON CONFLICT (checklist_id, numero_item) DO NOTHING;

END;
$$;
