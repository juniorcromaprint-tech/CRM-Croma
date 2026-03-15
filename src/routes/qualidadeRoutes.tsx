import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";

const QualidadeDashboardPage = lazy(() => import("@/domains/qualidade/pages/QualidadeDashboardPage"));
const OcorrenciasPage = lazy(() => import("@/domains/qualidade/pages/OcorrenciasPage"));
const OcorrenciaDetailPage = lazy(() => import("@/domains/qualidade/pages/OcorrenciaDetailPage"));

export const qualidadeRoutes = (
  <>
    <Route path="qualidade" element={<LazyPage><QualidadeDashboardPage /></LazyPage>} />
    <Route path="qualidade/ocorrencias" element={<LazyPage><OcorrenciasPage /></LazyPage>} />
    <Route path="qualidade/ocorrencias/:id" element={<LazyPage><OcorrenciaDetailPage /></LazyPage>} />
  </>
);
