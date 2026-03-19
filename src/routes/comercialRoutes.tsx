import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";
import PermissionGuard from "@/shared/components/PermissionGuard";

const DashboardPage = lazy(() => import("@/domains/comercial/pages/DashboardPage"));
const LeadsPage = lazy(() => import("@/domains/comercial/pages/LeadsPage"));
const LeadDetailPage = lazy(() => import("@/domains/comercial/pages/LeadDetailPage"));
const PipelinePage = lazy(() => import("@/domains/comercial/pages/PipelinePage"));
const OrcamentosPage = lazy(() => import("@/domains/comercial/pages/OrcamentosPage"));
const OrcamentoEditorPage = lazy(() => import("@/domains/comercial/pages/OrcamentoEditorPage"));
const OrcamentoViewPage = lazy(() => import("@/domains/comercial/pages/OrcamentoViewPage"));
const PropostasPage = lazy(() => import("@/domains/comercial/pages/PropostasPage"));
const CalendarioPage = lazy(() => import("@/domains/comercial/pages/CalendarioPage"));
const CampanhasPage = lazy(() => import("@/domains/comercial/pages/CampanhasPage"));

export const comercialRoutes = (
  <>
    <Route index element={<PermissionGuard module="comercial" action="ver"><LazyPage><DashboardPage /></LazyPage></PermissionGuard>} />
    <Route path="leads" element={<PermissionGuard module="comercial" action="ver"><LazyPage><LeadsPage /></LazyPage></PermissionGuard>} />
    <Route path="leads/:id" element={<PermissionGuard module="comercial" action="ver"><LazyPage><LeadDetailPage /></LazyPage></PermissionGuard>} />
    <Route path="pipeline" element={<PermissionGuard module="comercial" action="ver"><LazyPage><PipelinePage /></LazyPage></PermissionGuard>} />
    <Route path="orcamentos" element={<PermissionGuard module="comercial" action="ver"><LazyPage><OrcamentosPage /></LazyPage></PermissionGuard>} />
    <Route path="orcamentos/novo" element={<PermissionGuard module="comercial" action="ver"><LazyPage><OrcamentoEditorPage /></LazyPage></PermissionGuard>} />
    <Route path="orcamentos/:id" element={<PermissionGuard module="comercial" action="ver"><LazyPage><OrcamentoViewPage /></LazyPage></PermissionGuard>} />
    <Route path="orcamentos/:id/editar" element={<PermissionGuard module="comercial" action="ver"><LazyPage><OrcamentoEditorPage /></LazyPage></PermissionGuard>} />
    <Route path="propostas" element={<PermissionGuard module="comercial" action="ver"><LazyPage><PropostasPage /></LazyPage></PermissionGuard>} />
    <Route path="calendario" element={<PermissionGuard module="comercial" action="ver"><LazyPage><CalendarioPage /></LazyPage></PermissionGuard>} />
    <Route path="campanhas" element={<PermissionGuard module="comercial" action="ver"><LazyPage><CampanhasPage /></LazyPage></PermissionGuard>} />
  </>
);
