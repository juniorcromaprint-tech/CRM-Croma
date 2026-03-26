-- Migration 101: SMTP config para envio de email por vendedor
-- Adiciona campos SMTP em profiles e seed de config padrão HostGator
-- 2026-03-26

-- ─── Campos SMTP por vendedor em profiles ──────────────────────────────────
-- Cada vendedor pode ter suas próprias credenciais SMTP.
-- Se não configurado, usa o padrão de admin_config.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_smtp_user     TEXT,
  ADD COLUMN IF NOT EXISTS email_smtp_password TEXT;

COMMENT ON COLUMN profiles.email_smtp_user     IS 'Email SMTP do vendedor (ex: junior@cromaprint.com.br)';
COMMENT ON COLUMN profiles.email_smtp_password IS 'Senha SMTP do vendedor na HostGator';

-- ─── SMTP padrão em admin_config ───────────────────────────────────────────
-- Config compartilhada (fallback quando o vendedor não tem SMTP próprio).
-- Host HostGator da Croma Print.

INSERT INTO admin_config (chave, valor, descricao) VALUES
  ('smtp_host',     'mail.cromaprint.com.br',    'Servidor SMTP HostGator Croma Print'),
  ('smtp_port',     '465',                        'Porta SMTP (465=SSL, 587=TLS)'),
  ('smtp_user',     'junior@cromaprint.com.br',   'Email padrão de envio (Junior)'),
  ('smtp_password', 'nina130718',                 'Senha SMTP padrão — alterar se comprometida')
ON CONFLICT (chave) DO UPDATE
  SET valor      = EXCLUDED.valor,
      descricao  = EXCLUDED.descricao,
      updated_at = now();

-- ─── Seed SMTP do Junior no profile ────────────────────────────────────────
-- Popula o vendedor principal com credenciais SMTP pessoais.

UPDATE profiles
SET
  email_smtp_user     = 'junior@cromaprint.com.br',
  email_smtp_password = 'nina130718'
WHERE email = 'junior.cromaprint@gmail.com'
  AND email_smtp_user IS NULL;
