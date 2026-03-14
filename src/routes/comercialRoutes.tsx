import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";

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
    <Route index element={<LazyPage><DashboardPage /></LazyPage>} />
    <Route path="leads" element={<LazyPage><LeadsPage /></LazyPage>} />
    <Route path="leads/:id" element={<LazyPage><LeadDetailPage /></LazyPage>} />
    <Route path="pipeline" element={<LazyPage><PipelinePage /></LazyPage>} />
    <Route path="orcamentos" element={<LazyPage><OrcamentosPage /></LazyPage>} />
    <Route path="orcamentos/novo" element={<LazyPage><OrcamentoEditorPage /></LazyPage>} />
    <Route path="orcamentos/:id" element={<LazyPage><OrcamentoViewPage /></LazyPage>} />
    <Route path="orcamentos/:id/editar" element={<LazyPage><OrcamentoEditorPage /></LazyPage>} />
    <Route path="propostas" element={<LazyPage><PropostasPage /></LazyPage>} />
    <Route path="calendario" element={<LazyPage><CalendarioPage /></LazyPage>} />
    <Route path="campanhas" element={<LazyPage><CampanhasPage /></LazyPage>} />
  </>
);
