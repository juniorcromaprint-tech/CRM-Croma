-- 020_portal_tracking_pagamento.sql
-- Portal do Cliente + Tracking + Condições de Pagamento

-- ═══════════════════════════════════════
-- 1. NOVAS COLUNAS EM propostas
-- ═══════════════════════════════════════

-- Token de compartilhamento
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid() UNIQUE;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS share_token_active BOOLEAN DEFAULT false;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS share_token_expires_at TIMESTAMPTZ;

-- Condições de pagamento estruturadas
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS parcelas_count INTEGER DEFAULT 1;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS entrada_percentual NUMERIC(5,2) DEFAULT 0;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS prazo_dias INTEGER[];

-- Aprovação pelo cliente
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS aprovado_pelo_cliente BOOLEAN DEFAULT false;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS aprovado_pelo_cliente_at TIMESTAMPTZ;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS comentario_cliente TEXT;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS ip_aprovacao INET;

-- OneDrive
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS onedrive_folder_id TEXT;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS onedrive_folder_url TEXT;

-- Adicionar 'aprovada_cliente' ao CHECK constraint de status
ALTER TABLE propostas DROP CONSTRAINT IF EXISTS propostas_status_check;
ALTER TABLE propostas ADD CONSTRAINT propostas_status_check
  CHECK (status IN ('rascunho', 'enviada', 'em_revisao', 'aprovada', 'aprovada_cliente', 'recusada', 'expirada', 'convertida'));

-- Índice parcial para lookups de token ativo
CREATE INDEX IF NOT EXISTS idx_propostas_share_token_active
  ON propostas(share_token) WHERE share_token_active = true;

-- ═══════════════════════════════════════
-- 2. NOVA TABELA: proposta_views
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS proposta_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id UUID NOT NULL REFERENCES propostas(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  page_opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  page_closed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  max_scroll_depth INTEGER DEFAULT 0,
  clicked_items JSONB DEFAULT '[]',
  downloaded_pdf BOOLEAN DEFAULT false,
  geo_city TEXT,
  geo_region TEXT,
  geo_country TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposta_views_proposta ON proposta_views(proposta_id);
CREATE INDEX IF NOT EXISTS idx_proposta_views_session ON proposta_views(session_id);

-- ═══════════════════════════════════════
-- 3. NOVA TABELA: proposta_attachments
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS proposta_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id UUID NOT NULL REFERENCES propostas(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  tipo_mime TEXT,
  tamanho_bytes BIGINT,
  onedrive_file_id TEXT,
  onedrive_file_url TEXT,
  onedrive_download_url TEXT,
  storage_path TEXT,
  storage_url TEXT,
  uploaded_by_type TEXT NOT NULL DEFAULT 'cliente',
  uploaded_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposta_attachments_proposta ON proposta_attachments(proposta_id);

-- ═══════════════════════════════════════
-- 4. NOVA TABELA: notifications
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT,
  entidade_tipo TEXT,
  entidade_id UUID,
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, lida);

-- ═══════════════════════════════════════
-- 5. RLS
-- ═══════════════════════════════════════

-- proposta_views: only authenticated users can read (vendor panel)
-- Writes via SECURITY DEFINER RPCs only
ALTER TABLE proposta_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vendedor lê views" ON proposta_views
  FOR SELECT USING (auth.role() = 'authenticated');

-- proposta_attachments: only authenticated users can read
ALTER TABLE proposta_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vendedor lê attachments" ON proposta_attachments
  FOR SELECT USING (auth.role() = 'authenticated');

-- notifications: user reads own notifications only
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário lê próprias notificações" ON notifications
  FOR SELECT USING (auth.uid() = user_id);
-- No INSERT policy: RPCs SECURITY DEFINER bypass RLS

-- ═══════════════════════════════════════
-- 6. RPCs (SECURITY DEFINER)
-- ═══════════════════════════════════════

-- ① Buscar proposta por token
CREATE OR REPLACE FUNCTION public.portal_get_proposta(p_token UUID)
RETURNS JSON AS $$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'id', p.id, 'numero', p.numero, 'status', p.status,
    'valor_total', p.total, 'desconto_percentual', p.desconto_percentual,
    'forma_pagamento', p.forma_pagamento, 'parcelas_count', p.parcelas_count,
    'prazo_dias', p.prazo_dias, 'entrada_percentual', p.entrada_percentual,
    'validade', p.validade_dias, 'observacoes', p.observacoes,
    'aprovado_pelo_cliente', p.aprovado_pelo_cliente,
    'cliente', json_build_object('nome_fantasia', c.nome_fantasia, 'contato_nome', c.contato_nome),
    'itens', (SELECT json_agg(json_build_object(
      'id', pi.id, 'descricao', pi.descricao, 'especificacao', pi.especificacao,
      'quantidade', pi.quantidade, 'valor_unitario', pi.valor_unitario,
      'valor_total', pi.valor_total
    )) FROM proposta_itens pi WHERE pi.proposta_id = p.id)
  ) INTO result
  FROM propostas p
  LEFT JOIN clientes c ON c.id = p.cliente_id
  WHERE p.share_token = p_token
    AND p.share_token_active = true
    AND (p.share_token_expires_at IS NULL OR p.share_token_expires_at > now());

  IF result IS NULL THEN
    RAISE EXCEPTION 'Proposta não encontrada ou link expirado';
  END IF;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ② Registrar view
CREATE OR REPLACE FUNCTION public.portal_register_view(
  p_token UUID, p_session_id TEXT, p_device_type TEXT,
  p_browser TEXT, p_os TEXT, p_geo_city TEXT,
  p_geo_region TEXT, p_geo_country TEXT
)
RETURNS UUID AS $$
DECLARE v_proposta_id UUID; v_view_id UUID;
BEGIN
  SELECT id INTO v_proposta_id FROM propostas
  WHERE share_token = p_token AND share_token_active = true
    AND (share_token_expires_at IS NULL OR share_token_expires_at > now());
  IF v_proposta_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;
  INSERT INTO proposta_views (proposta_id, session_id, ip_address, device_type, browser, os, geo_city, geo_region, geo_country)
  VALUES (v_proposta_id, p_session_id, inet_client_addr(), p_device_type, p_browser, p_os, p_geo_city, p_geo_region, p_geo_country)
  RETURNING id INTO v_view_id;
  RETURN v_view_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ③ Heartbeat
CREATE OR REPLACE FUNCTION public.portal_heartbeat(
  p_token UUID, p_view_id UUID, p_duration_seconds INTEGER,
  p_max_scroll_depth INTEGER, p_clicked_items JSONB,
  p_downloaded_pdf BOOLEAN
)
RETURNS void AS $$
BEGIN
  UPDATE proposta_views pv SET
    duration_seconds = p_duration_seconds,
    max_scroll_depth = GREATEST(pv.max_scroll_depth, p_max_scroll_depth),
    clicked_items = p_clicked_items,
    downloaded_pdf = COALESCE(pv.downloaded_pdf, false) OR p_downloaded_pdf,
    page_closed_at = now()
  FROM propostas pr
  WHERE pv.id = p_view_id
    AND pv.proposta_id = pr.id
    AND pr.share_token = p_token
    AND pr.share_token_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ④ Aprovar proposta
CREATE OR REPLACE FUNCTION public.portal_aprovar_proposta(
  p_token UUID, p_comentario TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE v_proposta_id UUID;
BEGIN
  SELECT id INTO v_proposta_id FROM propostas
  WHERE share_token = p_token AND share_token_active = true
    AND aprovado_pelo_cliente = false
    AND (share_token_expires_at IS NULL OR share_token_expires_at > now());
  IF v_proposta_id IS NULL THEN
    RAISE EXCEPTION 'Proposta não encontrada, já aprovada, ou link expirado';
  END IF;
  UPDATE propostas SET
    aprovado_pelo_cliente = true,
    aprovado_pelo_cliente_at = now(),
    comentario_cliente = p_comentario,
    ip_aprovacao = inet_client_addr(),
    status = 'aprovada_cliente',
    updated_at = now()
  WHERE id = v_proposta_id;
  INSERT INTO notifications (user_id, tipo, titulo, mensagem, entidade_tipo, entidade_id)
  SELECT p.vendedor_id, 'aprovacao_cliente',
    'Cliente aprovou orçamento ' || p.numero,
    COALESCE(p_comentario, 'Aprovado sem comentários'),
    'proposta', v_proposta_id
  FROM propostas p WHERE p.id = v_proposta_id AND p.vendedor_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ⑤ Registrar attachment
CREATE OR REPLACE FUNCTION public.portal_register_attachment(
  p_token UUID, p_nome_arquivo TEXT, p_tipo_mime TEXT,
  p_tamanho_bytes BIGINT, p_onedrive_file_id TEXT,
  p_onedrive_file_url TEXT, p_uploaded_by_name TEXT
)
RETURNS UUID AS $$
DECLARE v_proposta_id UUID; v_att_id UUID;
BEGIN
  SELECT id INTO v_proposta_id FROM propostas
  WHERE share_token = p_token AND share_token_active = true
    AND (share_token_expires_at IS NULL OR share_token_expires_at > now());
  IF v_proposta_id IS NULL THEN RAISE EXCEPTION 'Token inválido ou expirado'; END IF;
  INSERT INTO proposta_attachments (
    proposta_id, nome_arquivo, tipo_mime, tamanho_bytes,
    onedrive_file_id, onedrive_file_url, uploaded_by_type, uploaded_by_name
  ) VALUES (
    v_proposta_id, p_nome_arquivo, p_tipo_mime, p_tamanho_bytes,
    p_onedrive_file_id, p_onedrive_file_url, 'cliente', p_uploaded_by_name
  ) RETURNING id INTO v_att_id;
  RETURN v_att_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════
-- 7. ENABLE REALTIME
-- ═══════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE proposta_views;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
