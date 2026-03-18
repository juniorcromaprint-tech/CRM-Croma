import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";
import PermissionGuard from "@/shared/components/PermissionGuard";

const QualidadeDashboardPage = lazy(() => import("@/domains/qualidade/pages/QualidadeDashboardPage"));
const OcorrenciasPage = lazy(() => import("@/domains/qualidade/pages/OcorrenciasPage"));
const OcorrenciaDetailPage = lazy(() => import("@/domains/qualidade/pages/OcorrenciaDetailPage"));

export const qualidadeRoutes = (
  <>
    <Route path="qualidade" element={<PermissionGuard module="qualidade" action="ver"><LazyPage><QualidadeDashboardPage /></LazyPage></PermissionGuard>} />
    <Route path="qualidade/ocorrencias" element={<PermissionGuard module="qualidade" action="ver"><LazyPage><OcorrenciasPage /></LazyPage></PermissionGuard>} />
    <Route path="qualidade/ocorrencias/:id" element={<PermissionGuard module="qualidade" action="ver"><LazyPage><OcorrenciaDetailPage /></LazyPage></PermissionGuard>} />
  </>
);
