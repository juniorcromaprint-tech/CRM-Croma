import { lazy } from "react";
import { Route, Navigate } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";
import PermissionGuard from "@/shared/components/PermissionGuard";

const FornecedoresPage = lazy(() => import("@/domains/compras/pages/FornecedoresPage"));
const PedidosCompraPage = lazy(() => import("@/domains/compras/pages/PedidosCompraPage"));
const PedidoCompraDetailPage = lazy(() => import("@/domains/compras/pages/PedidoCompraDetailPage"));
const CotacoesPage = lazy(() => import("@/domains/compras/pages/CotacoesPage"));
const EstoqueDashboardPage = lazy(() => import("@/domains/estoque/pages/EstoqueDashboardPage"));

export const suprimentosRoutes = (
  <>
    <Route path="compras" element={<Navigate to="/compras/fornecedores" replace />} />
    <Route path="compras/fornecedores" element={<PermissionGuard module="compras" action="ver"><LazyPage><FornecedoresPage /></LazyPage></PermissionGuard>} />
    <Route path="compras/pedidos" element={<PermissionGuard module="compras" action="ver"><LazyPage><PedidosCompraPage /></LazyPage></PermissionGuard>} />
    <Route path="compras/pedidos/:id" element={<PermissionGuard module="compras" action="ver"><LazyPage><PedidoCompraDetailPage /></LazyPage></PermissionGuard>} />
    <Route path="compras/cotacoes" element={<PermissionGuard module="compras" action="ver"><LazyPage><CotacoesPage /></LazyPage></PermissionGuard>} />
    <Route path="estoque" element={<PermissionGuard module="estoque" action="ver"><LazyPage><EstoqueDashboardPage /></LazyPage></PermissionGuard>} />
    <Route path="estoque/movimentacoes" element={<Navigate to="/estoque?tab=movimentacoes" replace />} />
    <Route path="estoque/inventario" element={<Navigate to="/estoque?tab=inventario" replace />} />
  </>
);
