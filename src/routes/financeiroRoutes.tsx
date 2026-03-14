import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";

const FinanceiroPage = lazy(() => import("@/domains/financeiro/pages/FinanceiroPage"));
const ComissoesPage = lazy(() => import("@/domains/financeiro/pages/ComissoesPage"));
const DrePage = lazy(() => import("@/domains/financeiro/pages/DrePage"));
const FaturamentoLotePage = lazy(() => import("@/domains/financeiro/pages/FaturamentoLotePage"));
const PedidosAFaturarPage = lazy(() => import("@/domains/financeiro/pages/PedidosAFaturarPage"));
const ConciliacaoPage = lazy(() => import("@/domains/financeiro/pages/ConciliacaoPage"));
const BoletosPage = lazy(() => import("@/domains/financeiro/pages/BoletosPage"));
const ConfigBancariaPage = lazy(() => import("@/domains/financeiro/pages/ConfigBancariaPage"));

export const financeiroRoutes = (
  <>
    <Route path="financeiro" element={<LazyPage><FinanceiroPage /></LazyPage>} />
    <Route path="dre" element={<LazyPage><DrePage /></LazyPage>} />
    <Route path="comissoes" element={<LazyPage><ComissoesPage /></LazyPage>} />
    <Route path="financeiro/faturamento" element={<LazyPage><FaturamentoLotePage /></LazyPage>} />
    <Route path="financeiro/pedidos-a-faturar" element={<LazyPage><PedidosAFaturarPage /></LazyPage>} />
    <Route path="financeiro/conciliacao" element={<LazyPage><ConciliacaoPage /></LazyPage>} />
    <Route path="financeiro/boletos" element={<LazyPage><BoletosPage /></LazyPage>} />
    <Route path="financeiro/config-bancaria" element={<LazyPage><ConfigBancariaPage /></LazyPage>} />
  </>
);
