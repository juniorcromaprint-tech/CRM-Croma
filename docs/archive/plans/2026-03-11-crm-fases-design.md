# Design: CRM Croma — Fases 1-2-3 + OneDrive + Progress Tracker
**Data:** 2026-03-11
**Status:** Aprovado para implementação

---

## Progresso Atual do ERP

| Módulo | % |
|---|---|
| Dashboard, Leads, Pipeline, Orçamentos, Clientes | 100% |
| Pedidos, Produção, Instalações, Estoque, Compras | 100% |
| Produtos, Financeiro, DRE, Comissões, Fiscal | 100% |
| Qualidade, Admin | 100% |
| OneDrive, Propostas, Faturamento em Lote | 0–15% |
| Almoxarife, Diário de Bordo, TV, Relatórios, etc. | 0% |
| **TOTAL ERP** | **~58%** |

---

## Fase 1 — Core Business (→ 72%)

### 1. OneDrive Integration
- **Estrutura de pastas:** `Croma/Clientes/{Nome Cliente}/{PED-2026-XXXX}/`
- **Como funciona:** ao criar Pedido → Supabase Edge Function chama Composio API (conta OneDrive já conectada) → cria pasta automaticamente
- **DB:** colunas `onedrive_folder_id` e `onedrive_folder_url` na tabela `pedidos`
- **UI:** aba "📁 Arquivos" no detalhe do Pedido com lista de arquivos + upload + botão "Abrir no OneDrive"

### 2. Propostas (completar)
- Hook e tabela `propostas` já existem no Supabase
- Criar página `/propostas` com listagem, criação e visualização
- Vincular ao funil: Oportunidade → Proposta → Orçamento

### 3. Faturamento em Lote
- Página `/financeiro/faturamento`
- Lista de OSes concluídas/entregues com checkbox
- Ação em lote: gerar nota fiscal / lançamento financeiro para as selecionadas

---

## Fase 2 — Operacional (→ 83%)

### 4. Almoxarife
- Novas tabelas: `ferramentas`, `veiculos`, `checkout_almoxarife`
- Checkout: quem retirou, quando devolveu, vinculado a qual OS
- Página `/almoxarife` com estoque de ferramentas + histórico

### 5. Diário de Bordo
- Nova tabela: `diario_bordo` (vinculada a equipamentos)
- Registro de manutenção preventiva/corretiva
- Página `/producao/diario-bordo`

### 6. Acompanhamento TV
- Rota `/tv` sem sidebar/layout
- Auto-rotativo a cada 20s pelos 9 setores de produção
- Exibe: OSes em andamento, cliente, status por setor

---

## Fase 3 — Gestão (→ 100%)

### 7. Relatórios (11 tipos)
- Vendas, Orçamentos, Vendas por Produto, Previsto×Realizado
- DRE, Plano de Contas, Lucratividade, Posição Faturamento
- Curva ABC Clientes, Curva ABC Produtos, Fiscal
- Página `/relatorios` com filtros + export CSV/PDF

### 8. Conciliação Bancária
- Import de extrato .OFX/.CSV
- Comparação banco vs ERP lado a lado
- Página `/financeiro/conciliacao`

### 9. Calendário Integrado
- Hub: vencimentos financeiros + OSes por setor + tarefas comerciais
- Views: mês / semana / dia
- Página `/calendario`

### 10. Campanhas Comerciais
- Campanhas com origem → leads gerados → % conversão
- Página `/campanhas`

---

## Progress Tracker

Widget no Dashboard + página `/admin/progresso`:

```
ERP Croma  ████████████░░░░░░░░  58%

Fase 1     ░░░░░░░░░░░░░░░░░░░░   0%  OneDrive · Propostas · Faturamento
Fase 2     ░░░░░░░░░░░░░░░░░░░░   0%  Almoxarife · Diário · TV
Fase 3     ░░░░░░░░░░░░░░░░░░░░   0%  Relatórios · Conciliação · Calendário · Campanhas
```

- Calculado dinamicamente via feature flags em `admin_config`
- Atualizado automaticamente conforme features são habilitadas

---

## Stack Técnico

| Componente | Tecnologia |
|---|---|
| Frontend | React 19 + Vite + shadcn/ui + TanStack Query |
| Backend | Supabase (Postgres + Edge Functions) |
| OneDrive | Composio API → ONE_DRIVE tools (conta já conectada) |
| Auth | Supabase Auth + perfis (admin/comercial/producao) |
