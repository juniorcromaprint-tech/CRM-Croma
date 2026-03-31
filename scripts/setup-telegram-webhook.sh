#!/bin/bash
# Setup do webhook do Telegram para o bot da Croma Print
# Uso: bash scripts/setup-telegram-webhook.sh

# Token do bot (do @BotFather)
BOT_TOKEN="8750164337:AAH8Diet4zGJddKHq_F2F1JobUA2djisU8s"

# URL do webhook (Edge Function no Supabase)
WEBHOOK_URL="https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/telegram-webhook"

echo "=== Croma Print Telegram Bot Setup ==="
echo ""
echo "Registrando webhook..."
echo "URL: $WEBHOOK_URL"
echo ""

# Registrar webhook
RESULT=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${WEBHOOK_URL}")
echo "Resultado: $RESULT"
echo ""

# Verificar info do webhook
echo "Verificando..."
INFO=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo")
echo "Info: $INFO"
echo ""

# Info do bot
echo "Info do bot:"
BOT_INFO=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getMe")
echo "$BOT_INFO"
echo ""
echo "=== Setup completo! ==="
echo ""
echo "Próximos passos:"
echo "1. Certifique-se que TELEGRAM_BOT_TOKEN está nas secrets do Supabase"
echo "2. Deploy: supabase functions deploy telegram-webhook"
echo "3. Aplique a migration: 103_telegram_messages.sql"
echo "4. Teste enviando /start no Telegram"
