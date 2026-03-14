import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";

const FiscalDashboardPage = lazy(() => import("@/domains/fiscal/pages/FiscalDashboardPage"));
const FiscalDocumentosPage = lazy(() => import("@/domains/fiscal/pages/FiscalDocumentosPage"));
const FiscalFilaPage = lazy(() => import("@/domains/fiscal/pages/FiscalFilaPage"));
const FiscalConfiguracaoPage = lazy(() => import("@/domains/fiscal/pages/FiscalConfiguracaoPage"));
const FiscalCertificadoPage = lazy(() => import("@/domains/fiscal/pages/FiscalCertificadoPage"));
const FiscalAuditoriaPage = lazy(() => import("@/domains/fiscal/pages/FiscalAuditoriaPage"));

export const fiscalRoutes = (
  <>
    <Route path="fiscal" element={<LazyPage><FiscalDashboardPage /></LazyPage>} />
    <Route path="fiscal/documentos" element={<LazyPage><FiscalDocumentosPage /></LazyPage>} />
    <Route path="fiscal/fila" element={<LazyPage><FiscalFilaPage /></LazyPage>} />
    <Route path="fiscal/configuracao" element={<LazyPage><FiscalConfiguracaoPage /></LazyPage>} />
    <Route path="fiscal/certificado" element={<LazyPage><FiscalCertificadoPage /></LazyPage>} />
    <Route path="fiscal/auditoria" element={<LazyPage><FiscalAuditoriaPage /></LazyPage>} />
  </>
);
