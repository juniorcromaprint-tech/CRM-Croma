-- 103_telegram_messages.sql
-- Tabela para persistir histórico de conversas do bot Telegram.
-- Permite continuidade entre invocações da Edge Function.

CREATE TABLE IF NOT EXISTS telegram_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes para performance
CREATE INDEX IF NOT EXISTS idx_telegram_messages_chat ON telegram_messages(chat_id, created_at DESC);

-- Limpeza automática: reter apenas últimas 100 mensagens por chat
-- (pode ser ajustado via cron ou trigger)
COMMENT ON TABLE telegram_messages IS 'Historico de conversas do bot Telegram com Junior';

-- RLS: apenas service_role acessa (Edge Function)
ALTER TABLE telegram_messages ENABLE ROW LEVEL SECURITY;

-- Permitir service_role (usado pela Edge Function)
CREATE POLICY "service_role_full_telegram_messages" ON telegram_messages
  FOR ALL
  USING (true)
  WITH CHECK (true);
