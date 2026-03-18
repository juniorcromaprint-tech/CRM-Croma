import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";
import PermissionGuard from "@/shared/components/PermissionGuard";

const FinanceiroPage = lazy(() => import("@/domains/financeiro/pages/FinanceiroPage"));
const ComissoesPage = lazy(() => import("@/domains/financeiro/pages/ComissoesPage"));
const DrePage = lazy(() => import("@/domains/financeiro/pages/DrePage"));
const FaturamentoLotePage = lazy(() => import("@/domains/financeiro/pages/FaturamentoLotePage"));
const PedidosAFaturarPage = lazy(() => import("@/domains/financeiro/pages/PedidosAFaturarPage"));
const ConciliacaoPage = lazy(() => import("@/domains/financeiro/pages/ConciliacaoPage"));
const BoletosPage = lazy(() => import("@/domains/financeiro/pages/BoletosPage"));
const ConfigBancariaPage = lazy(() => import("@/domains/financeiro/pages/ConfigBancariaPage"));
const FluxoCaixaPage = lazy(() => import("@/domains/financeiro/pages/FluxoCaixaPage"));
const RetornoUploadPage = lazy(() => import("@/domains/financeiro/pages/RetornoUploadPage"));

export const financeiroRoutes = (
  <>
    <Route path="financeiro" element={<PermissionGuard module="financeiro" action="ver"><LazyPage><FinanceiroPage /></LazyPage></PermissionGuard>} />
    <Route path="dre" element={<PermissionGuard module="financeiro" action="ver"><LazyPage><DrePage /></LazyPage></PermissionGuard>} />
    <Route path="comissoes" element={<PermissionGuard module="financeiro" action="ver"><LazyPage><ComissoesPage /></LazyPage></PermissionGuard>} />
    <Route path="financeiro/faturamento" element={<PermissionGuard module="financeiro" action="ver"><LazyPage><FaturamentoLotePage /></LazyPage></PermissionGuard>} />
    <Route path="financeiro/pedidos-a-faturar" element={<PermissionGuard module="financeiro" action="ver"><LazyPage><PedidosAFaturarPage /></LazyPage></PermissionGuard>} />
    <Route path="financeiro/conciliacao" element={<PermissionGuard module="financeiro" action="ver"><LazyPage><ConciliacaoPage /></LazyPage></PermissionGuard>} />
    <Route path="financeiro/boletos" element={<PermissionGuard module="financeiro" action="ver"><LazyPage><BoletosPage /></LazyPage></PermissionGuard>} />
    <Route path="financeiro/config-bancaria" element={<PermissionGuard module="financeiro" action="ver"><LazyPage><ConfigBancariaPage /></LazyPage></PermissionGuard>} />
    <Route path="financeiro/fluxo-caixa" element={<PermissionGuard module="financeiro" action="ver"><LazyPage><FluxoCaixaPage /></LazyPage></PermissionGuard>} />
    <Route path="financeiro/retornos" element={<PermissionGuard module="financeiro" action="ver"><LazyPage><RetornoUploadPage /></LazyPage></PermissionGuard>} />
  </>
);
