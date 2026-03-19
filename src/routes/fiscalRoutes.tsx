import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";
import PermissionGuard from "@/shared/components/PermissionGuard";

const FiscalDashboardPage = lazy(() => import("@/domains/fiscal/pages/FiscalDashboardPage"));
const FiscalDocumentosPage = lazy(() => import("@/domains/fiscal/pages/FiscalDocumentosPage"));
const FiscalFilaPage = lazy(() => import("@/domains/fiscal/pages/FiscalFilaPage"));
const FiscalConfiguracaoPage = lazy(() => import("@/domains/fiscal/pages/FiscalConfiguracaoPage"));
const FiscalCertificadoPage = lazy(() => import("@/domains/fiscal/pages/FiscalCertificadoPage"));
const FiscalAuditoriaPage = lazy(() => import("@/domains/fiscal/pages/FiscalAuditoriaPage"));

export const fiscalRoutes = (
  <>
    <Route path="fiscal" element={<PermissionGuard module="fiscal" action="ver"><LazyPage><FiscalDashboardPage /></LazyPage></PermissionGuard>} />
    <Route path="fiscal/documentos" element={<PermissionGuard module="fiscal" action="ver"><LazyPage><FiscalDocumentosPage /></LazyPage></PermissionGuard>} />
    <Route path="fiscal/fila" element={<PermissionGuard module="fiscal" action="ver"><LazyPage><FiscalFilaPage /></LazyPage></PermissionGuard>} />
    <Route path="fiscal/configuracao" element={<PermissionGuard module="fiscal" action="ver"><LazyPage><FiscalConfiguracaoPage /></LazyPage></PermissionGuard>} />
    <Route path="fiscal/certificado" element={<PermissionGuard module="fiscal" action="ver"><LazyPage><FiscalCertificadoPage /></LazyPage></PermissionGuard>} />
    <Route path="fiscal/auditoria" element={<PermissionGuard module="fiscal" action="ver"><LazyPage><FiscalAuditoriaPage /></LazyPage></PermissionGuard>} />
  </>
);
