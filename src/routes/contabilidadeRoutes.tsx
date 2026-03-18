import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";
import PermissionGuard from "@/shared/components/PermissionGuard";

const ContabilidadeDashboardPage = lazy(() => import("@/domains/contabilidade/pages/ContabilidadeDashboardPage"));
const LancamentosPage = lazy(() => import("@/domains/contabilidade/pages/LancamentosPage"));
const BalancetePage = lazy(() => import("@/domains/contabilidade/pages/BalancetePage"));
const RazaoPage = lazy(() => import("@/domains/contabilidade/pages/RazaoPage"));
const DASPage = lazy(() => import("@/domains/contabilidade/pages/DASPage"));
const DEFISPage = lazy(() => import("@/domains/contabilidade/pages/DEFISPage"));
const ExtratoBancarioPage = lazy(() => import("@/domains/contabilidade/pages/ExtratoBancarioPage"));

export const contabilidadeRoutes = (
  <>
    <Route path="contabilidade" element={<PermissionGuard module="financeiro" action="ver"><LazyPage><ContabilidadeDashboardPage /></LazyPage></PermissionGuard>} />
    <Route path="contabilidade/lancamentos" element={<PermissionGuard module="financeiro" action="ver"><LazyPage><LancamentosPage /></LazyPage></PermissionGuard>} />
    <Route path="contabilidade/balancete" element={<PermissionGuard module="financeiro" action="ver"><LazyPage><BalancetePage /></LazyPage></PermissionGuard>} />
    <Route path="contabilidade/razao" element={<PermissionGuard module="financeiro" action="ver"><LazyPage><RazaoPage /></LazyPage></PermissionGuard>} />
    <Route path="contabilidade/das" element={<PermissionGuard module="financeiro" action="ver"><LazyPage><DASPage /></LazyPage></PermissionGuard>} />
    <Route path="contabilidade/defis" element={<PermissionGuard module="financeiro" action="ver"><LazyPage><DEFISPage /></LazyPage></PermissionGuard>} />
    <Route path="contabilidade/extrato-bancario" element={<PermissionGuard module="financeiro" action="ver"><LazyPage><ExtratoBancarioPage /></LazyPage></PermissionGuard>} />
  </>
);
