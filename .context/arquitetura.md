# Arquitetura e Stack

> Arquivo de referência — carregado sob demanda

## Dois Produtos

| Produto | Pasta | URL | Público |
|---|---|---|---|
| **ERP/CRM** | `src/` | `crm-croma.vercel.app` | Equipe interna (Desktop-first) |
| **App de Campo** | `APP-Campo/` | `campo-croma.vercel.app` | Técnicos/instaladores (Mobile PWA) |

Backend compartilhado: Supabase `djwjmfgplnqyffdcgdaw`

## Stack
React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui
TanStack Query v5 + Zod + React Hook Form
Recharts + Sonner | Supabase (Postgres + Auth + Storage + Edge Functions)
Vitest (102 testes) + html2pdf + xlsx | NFeWizard-io + Resend

## Estrutura de Domínios
```
src/domains/{dominio}/
  pages/ hooks/ components/ services/ schemas/
```

## Módulos ERP (16)
Comercial, Clientes, Pedidos, Produção, Estoque, Financeiro, Fiscal, Contabilidade, Compras, Instalação, Qualidade, Admin, Portal, Dados, AI, Agent

## Funcionalidades IA
- 12 Edge Functions via OpenRouter
- AI Sidebar com 20+ appliers
- Agente WhatsApp v14 (CRM integrado, motor Mubisys)
- Motor Mubisys — precificação 9 passos

## Fluxo Principal
Lead → Orçamento → Pedido → Produção → Instalação → Faturamento

## Dev Server Local
Script `start-dev.cmd` na raiz: cd automático, cria .env se não existir, usa vite do node_modules.
Em worktrees: atualizar `.claude/launch.json` para apontar pro start-dev.cmd do worktree.