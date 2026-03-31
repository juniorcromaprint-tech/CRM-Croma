@echo off
cd /d C:\Users\Caldera\Claude\CRM-Croma
del /f /q .git\HEAD.lock 2>nul
del /f /q .git\index.lock 2>nul
git add -A
git commit -m "feat: compras ChatERP AI-bridge EdgeFunctions Telegram docs-cleanup"
git push origin main
git log --oneline -3
