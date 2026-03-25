@echo off
cd /d "%~dp0APP-Campo"
call pnpm install
call pnpm dev --port 8084
