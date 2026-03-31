@echo off
cd /d "C:\Users\Caldera\Claude\CRM-Croma"

echo ========================================
echo  LIMPANDO LOCKS DO GIT
echo ========================================
del /f /q ".git\HEAD.lock" 2>nul
del /f /q ".git\index.lock" 2>nul
for /r ".git\objects" %%f in (tmp_obj_*) do del /f /q "%%f" 2>nul
echo Locks limpos.

echo.
echo ========================================
echo  STAGING TODOS OS ARQUIVOS
echo ========================================
git add -A
echo Staging completo.

echo.
echo ========================================
echo  STATUS
echo ========================================
git status --short

echo.
echo ========================================
echo  COMMITANDO
echo ========================================
git commit -m "feat: modulo compras, ChatERP, AI bridge, Edge Functions, Telegram, docs, cleanup geral - Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

echo.
echo ========================================
echo  PUSH PARA GITHUB
echo ========================================
git push origin main

echo.
echo ========================================
echo  CONCLUIDO!
echo ========================================
git log --oneline -3
echo.
pause
