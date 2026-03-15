import { lazy } from "react";
import { Route, Navigate } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";

const FornecedoresPage = lazy(() => import("@/domains/compras/pages/FornecedoresPage"));
const PedidosCompraPage = lazy(() => import("@/domains/compras/pages/PedidosCompraPage"));
const PedidoCompraDetailPage = lazy(() => import("@/domains/compras/pages/PedidoCompraDetailPage"));
const EstoqueDashboardPage = lazy(() => import("@/domains/estoque/pages/EstoqueDashboardPage"));
const MovimentacoesPage = lazy(() => import("@/domains/estoque/pages/MovimentacoesPage"));
const InventarioPage = lazy(() => import("@/domains/estoque/pages/InventarioPage"));

export const suprimentosRoutes = (
  <>
    <Route path="compras" element={<Navigate to="/compras/fornecedores" replace />} />
    <Route path="compras/fornecedores" element={<LazyPage><FornecedoresPage /></LazyPage>} />
    <Route path="compras/pedidos" element={<LazyPage><PedidosCompraPage /></LazyPage>} />
    <Route path="compras/pedidos/:id" element={<LazyPage><PedidoCompraDetailPage /></LazyPage>} />
    <Route path="estoque" element={<LazyPage><EstoqueDashboardPage /></LazyPage>} />
    <Route path="estoque/movimentacoes" element={<LazyPage><MovimentacoesPage /></LazyPage>} />
    <Route path="estoque/inventario" element={<LazyPage><InventarioPage /></LazyPage>} />
  </>
);
