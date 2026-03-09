// ─── Pedidos Hooks — Barrel Export ───────────────────────────────────────────
// Croma Print ERP/CRM — Módulo de Pedidos
// ─────────────────────────────────────────────────────────────────────────────

export {
  usePedidos,
  usePedido,
  useCreatePedido,
  useUpdatePedido,
  usePedidoStats,
} from './usePedidos';

export type {
  Pedido,
  PedidoCreate,
  PedidoUpdate,
  PedidoFilters,
  PedidoStatus,
  PedidoPrioridade,
} from './usePedidos';

export {
  usePedidoItens,
  useCreatePedidoItem,
  useUpdatePedidoItem,
} from './usePedidoItens';

export type {
  PedidoItem,
  PedidoItemCreate,
  PedidoItemUpdate,
  PedidoItemStatus,
} from './usePedidoItens';
