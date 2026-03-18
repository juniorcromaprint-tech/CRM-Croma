import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";

const ContabilidadeDashboardPage = lazy(() => import("@/domains/contabilidade/pages/ContabilidadeDashboardPage"));
const LancamentosPage = lazy(() => import("@/domains/contabilidade/pages/LancamentosPage"));
const BalancetePage = lazy(() => import("@/domains/contabilidade/pages/BalancetePage"));
const RazaoPage = lazy(() => import("@/domains/contabilidade/pages/RazaoPage"));
const DASPage = lazy(() => import("@/domains/contabilidade/pages/DASPage"));
const DEFISPage = lazy(() => import("@/domains/contabilidade/pages/DEFISPage"));
const ExtratoBancarioPage = lazy(() => import("@/domains/contabilidade/pages/ExtratoBancarioPage"));

export const contabilidadeRoutes = (
  <>
    <Route path="contabilidade" element={<LazyPage><ContabilidadeDashboardPage /></LazyPage>} />
    <Route path="contabilidade/lancamentos" element={<LazyPage><LancamentosPage /></LazyPage>} />
    <Route path="contabilidade/balancete" element={<LazyPage><BalancetePage /></LazyPage>} />
    <Route path="contabilidade/razao" element={<LazyPage><RazaoPage /></LazyPage>} />
    <Route path="contabilidade/das" element={<LazyPage><DASPage /></LazyPage>} />
    <Route path="contabilidade/defis" element={<LazyPage><DEFISPage /></LazyPage>} />
    <Route path="contabilidade/extrato-bancario" element={<LazyPage><ExtratoBancarioPage /></LazyPage>} />
  </>
);
