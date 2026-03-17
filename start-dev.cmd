@echo off
cd /d %~dp0

if not exist .env (
  echo Criando .env com credenciais Supabase...
  (echo VITE_SUPABASE_URL=https://djwjmfgplnqyffdcgdaw.supabase.co) > .env
  (echo VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqd2ptZmdwbG5xeWZmZGNnZGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjU2OTcsImV4cCI6MjA4ODY0MTY5N30.pi2HDGyXhsoZS0sivfUDzn9z3Qao-6hMKrWBxoQ-1uE) >> .env
)

C:\Users\Caldera\Claude\CRM-Croma\node_modules\.bin\vite.cmd --host
