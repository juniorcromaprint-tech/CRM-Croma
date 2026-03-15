# Módulos Integrados — Compras, Estoque e Qualidade

> **Data**: 2026-03-15 | **Status**: Aprovado | **Abordagem**: C (Expandir Integrado)

---

## Objetivo

Transformar os 3 módulos mínimos (compras, estoque, qualidade) de arquivos monolíticos (~250KB total) em módulos estruturados, funcionais e integrados entre si e com os módulos existentes (produção, financeiro).

## Diagnóstico Atual

| Módulo | Código | Tabelas DB | Dados | Problema |
|--------|--------|-----------|-------|----------|
| Compras | ~92KB monolítico | `fornecedores` (10), `pedidos_compra` (0), `pedido_compra_itens` (0) | Parcial | Fornecedores funcionam, pedidos nunca usados |
| Estoque | ~88KB monolítico | `estoque_saldos` (467), `estoque_movimentacoes` (0) | Parcial | Código possivelmente desconectado do banco |
| Qualidade | ~69KB monolítico | `ocorrencias` (0), `ocorrencia_tratativas` (0) | Vazio | Tabelas existem mas nunca usadas |

**Tabelas faltantes**: `inventarios`, `inventario_itens` — referenciadas no código mas inexistentes.

---

## Seção 1: Banco de Dados e Migrations

### Tabelas existentes (manter)
- `fornecedores` (10 registros)
- `pedidos_compra` / `pedido_compra_itens` (0)
- `estoque_saldos` (467)
- `estoque_movimentacoes` (0)
- `ocorrencias` / `ocorrencia_tratativas` (0)

### Tabelas novas

**Inventário (controle periódico):**
- `inventarios` — id, data_inventario, status (aberto/finalizado), responsavel_id, observacoes, created_at
- `inventario_itens` — id, inventario_id (FK), material_id (FK materiais), quantidade_sistema, quantidade_contada, diferenca, justificativa

### Colunas novas em tabelas existentes

**`ocorrencias` (colunas já existentes a aproveitar):**
- `pedido_id` (FK pedidos) — **já existe** no schema
- `ordem_producao_id` (FK ordens_producao) — **já existe** no schema (usar este nome, não `op_id`)

**`ocorrencias` (coluna nova):**
- `fornecedor_id` (FK fornecedores, opcional) — ocorrência de material com defeito

### Triggers de integração

**Compras → Estoque:**
- Quando `pedidos_compra.status` → 'recebido': gera `estoque_movimentacoes` (tipo='entrada') e atualiza `estoque_saldos`

**Produção → Estoque:**
- Quando OP → 'em_producao': gera `estoque_movimentacoes` (tipo='reserva')
- Quando OP → 'finalizado': cria `liberacao_reserva` (desfaz reserva) + `saida` (consumo definitivo)

### RLS para tabelas novas
- `inventarios` — RLS habilitado, policy `authenticated` para SELECT/INSERT/UPDATE
- `inventario_itens` — RLS habilitado, policy `authenticated` para SELECT/INSERT/UPDATE
- Segue o padrão da migration `027_rls_blindagem.sql`

### Migration: `031_modulos_integrados.sql`

---

## Seção 2: Refatoração dos 3 Módulos

Refatoração dos domínios existentes (as pastas já existem com subfolders e `.gitkeep`). Os arquivos monolíticos atuais serão decompostos.

### Compras (`src/domains/compras/`)

```
pages/
  FornecedoresPage.tsx        — listagem + CRUD fornecedores
  PedidosCompraPage.tsx       — listagem pedidos de compra
  PedidoCompraDetailPage.tsx  — detalhe + recebimento
hooks/
  useFornecedores.ts          — useQuery/useMutation fornecedores
  usePedidosCompra.ts         — useQuery/useMutation pedidos_compra
  useRecebimento.ts           — lógica de recebimento → dispara entrada estoque
components/
  FornecedorForm.tsx          — dialog de cadastro/edição
  PedidoCompraForm.tsx        — formulário com itens
  RecebimentoChecklist.tsx    — conferência item a item
services/
  comprasService.ts           — queries Supabase
```

### Estoque (`src/domains/estoque/`)

```
pages/
  EstoquePage.tsx             — dashboard saldos + alertas mínimo
  MovimentacoesPage.tsx       — histórico de entradas/saídas
  InventarioPage.tsx          — inventário periódico
hooks/
  useEstoqueSaldos.ts         — saldos com alerta de mínimo
  useMovimentacoes.ts         — histórico filtrado
  useInventario.ts            — CRUD inventário + contagem
components/
  SaldoCard.tsx               — card com indicador visual
  AlertaEstoqueMinimo.tsx     — lista materiais abaixo do mínimo
  InventarioForm.tsx          — contagem item a item
services/
  estoqueService.ts           — queries + lógica de movimentação
```

### Qualidade (`src/domains/qualidade/`)

```
pages/
  OcorrenciasPage.tsx         — listagem + filtros
  OcorrenciaDetailPage.tsx    — detalhe + tratativas
  QualidadeDashboardPage.tsx  — indicadores (MTTR, reincidência, por tipo)
hooks/
  useOcorrencias.ts           — CRUD ocorrências
  useTratativas.ts            — tratativas vinculadas
  useQualidadeKPIs.ts         — métricas agregadas
components/
  OcorrenciaForm.tsx          — cadastro vinculado a pedido/OP/fornecedor
  TratativaTimeline.tsx       — histórico visual de tratativas
  QualidadeCharts.tsx         — gráficos Recharts
services/
  qualidadeService.ts         — queries + agregações
```

---

## Seção 3: Integrações entre Módulos

### Fluxo Integrado

```
Compra → Recebimento → Estoque (entrada)
                            ↓
Pedido → OP → Produção → Estoque (reserva → saída)
                            ↓
         Qualidade ← qualquer etapa (ocorrência vinculada)
```

### Integração 1: Compras → Estoque
- Ao marcar pedido de compra como "recebido", cada item gera `estoque_movimentacoes` tipo='entrada'
- `estoque_saldos` atualizado automaticamente (trigger no banco)
- UI: botão "Confirmar Recebimento" no detalhe do pedido de compra com checklist item a item

### Integração 2: Produção → Estoque
- Quando OP entra em produção, reserva materiais (`modelo_materiais` já tem os vínculos)
- Quando OP é finalizada, cria `liberacao_reserva` + `saida` definitiva
- UI: badge no EstoquePage mostrando "X unidades reservadas" ao lado do saldo disponível
- Alerta se material insuficiente para iniciar OP

### Integração 3: Qualidade ← Tudo
- Ocorrência pode ser aberta de qualquer lugar: pedido, OP, recebimento de compra, material com defeito
- Botão "Abrir Ocorrência" nas páginas de Pedido, Produção e Recebimento
- Dashboard de qualidade com: MTTR (tempo médio de resolução), taxa de reincidência, ocorrências por tipo/origem, custo de não-qualidade

### Alertas e Notificações
- Estoque abaixo do mínimo → notificação no sidebar (usa `useNotifications` existente)
- Ocorrência aberta → notifica responsável
- Pedido de compra com entrega atrasada → alerta

---

## Seção 4: Rotas e Navegação

### Novas rotas

```
/compras/fornecedores         — listagem fornecedores
/compras/pedidos              — listagem pedidos de compra
/compras/pedidos/:id          — detalhe + recebimento

/estoque                      — dashboard saldos + alertas
/estoque/movimentacoes        — histórico entradas/saídas
/estoque/inventario           — inventário periódico

/qualidade                    — dashboard KPIs
/qualidade/ocorrencias        — listagem ocorrências
/qualidade/ocorrencias/:id    — detalhe + tratativas
```

### Navegação lateral (sidebar)

```
📦 Suprimentos
   ├─ Fornecedores
   ├─ Pedidos de Compra
   └─ Estoque
🔍 Qualidade
   ├─ Dashboard
   └─ Ocorrências
```

### Migração de rotas

**Estado atual:** Rotas de compras, estoque e qualidade estão em `operacionalRoutes.tsx`. Grupos "SUPRIMENTOS" e "QUALIDADE" já existem em `navigation.ts` com rotas flat (`/compras`, `/estoque`, `/ocorrencias`).

**Mudanças:**
1. Criar `src/routes/suprimentosRoutes.tsx` — agrupa compras + estoque com sub-rotas
2. Criar `src/routes/qualidadeRoutes.tsx` — qualidade com sub-rotas
3. Remover as rotas de compras/estoque/qualidade de `operacionalRoutes.tsx`
4. Atualizar `navigation.ts` — expandir grupos com sub-itens (Fornecedores, Pedidos de Compra, etc.)
5. Redirects: `/compras` → `/compras/fornecedores`, `/ocorrencias` → `/qualidade/ocorrencias` (manter URLs antigas funcionando)

---

## Decisões Técnicas

| Decisão | Escolha | Razão |
|---------|---------|-------|
| Triggers vs Application-level | Triggers no banco para integrações críticas (estoque) | Garante consistência mesmo se frontend falhar |
| Estoque mínimo | Coluna `estoque_minimo` em `materiais` — **já existe** (default 0) | Aproveitar coluna existente |
| Inventário | Tabelas próprias | Precisa de histórico e auditoria |
| Ocorrências vinculadas | FKs opcionais em `ocorrencias` | Flexível — pode abrir ocorrência sem vínculo |
| Reserva de estoque | Tipo 'reserva' em `estoque_movimentacoes` | Visibilidade do que está comprometido sem baixar saldo |

---

### Integração 4: Compras → Financeiro
- Ao aprovar pedido de compra, gera entrada em `contas_pagar` vinculada ao fornecedor
- Usa `fornecedor_id` e `pedido_compra_id` (FKs já existentes em `contas_pagar`)
- UI: link no detalhe do pedido de compra para a conta a pagar gerada

---

## Fora de Escopo

- Integração com fornecedores externos (EDI, XML)
- Cotação automática com múltiplos fornecedores
- Rastreabilidade de lote/série
- Código de barras/QR code no inventário
