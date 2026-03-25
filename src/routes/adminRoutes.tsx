import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";
import PermissionGuard from "@/shared/components/PermissionGuard";

const EmpresaPage = lazy(() => import("@/domains/admin/pages/EmpresaPage"));
const AdminUsuariosPage = lazy(() => import("@/domains/admin/pages/AdminUsuariosPage"));
const AdminAuditoriaPage = lazy(() => import("@/domains/admin/pages/AdminAuditoriaPage"));
const AdminConfigPage = lazy(() => import("@/domains/admin/pages/AdminConfigPage"));
const AdminProdutosPage = lazy(() => import("@/domains/admin/pages/AdminProdutosPage"));
const AdminSetupPage = lazy(() => import("@/domains/admin/pages/AdminSetupPage"));
const AdminPrecificacaoPage = lazy(() => import("@/domains/admin/pages/AdminPrecificacaoPage"));
const AdminCentrosCustoPage = lazy(() => import("@/domains/admin/pages/AdminCentrosCustoPage"));
const AdminPlanoContasPage = lazy(() => import("@/domains/admin/pages/AdminPlanoContasPage"));
const AdminMateriaisPage = lazy(() => import("@/domains/admin/pages/AdminMateriaisPage"));
const RelatoriosPage = lazy(() => import("@/domains/admin/pages/RelatoriosPage"));
const Settings = lazy(() => import("@/pages/Settings"));
const AdminMaquinasPage = lazy(() => import("@/domains/admin/pages/AdminMaquinasPage"));
const DadosHubPage = lazy(() => import("@/domains/dados/pages/DadosHubPage"));
const ImportHistoricoPage = lazy(() => import("@/domains/dados/pages/ImportHistoricoPage"));
const ImportEntityPage = lazy(() => import("@/domains/dados/pages/ImportEntityPage"));
const CatalogoProdutosPage = lazy(() => import("@/domains/admin/pages/CatalogoProdutosPage"));
const WebhooksPage = lazy(() => import("@/domains/admin/pages/WebhooksPage"));
const AdminAvisosPage = lazy(() => import("@/domains/admin/pages/AdminAvisosPage"));

export const adminRoutes = (
  <>
    <Route path="admin/empresa" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><EmpresaPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/usuarios" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><AdminUsuariosPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/config" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><AdminConfigPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/produtos" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><AdminProdutosPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/auditoria" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><AdminAuditoriaPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/setup" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><AdminSetupPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/centros-custo" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><AdminCentrosCustoPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/plano-contas" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><AdminPlanoContasPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/materiais" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><AdminMateriaisPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/maquinas" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><AdminMaquinasPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/precificacao" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><AdminPrecificacaoPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/dados" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><DadosHubPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/dados/historico" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><ImportHistoricoPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/dados/importar/:entityKey" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><ImportEntityPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/catalogo" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><CatalogoProdutosPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/webhooks" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><WebhooksPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/avisos" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><AdminAvisosPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="relatorios" element={<PermissionGuard module="admin" action="ver"><LazyPage><RelatoriosPage /></LazyPage></PermissionGuard>} />
    <Route path="settings" element={<PermissionGuard module="admin" action="ver"><LazyPage><Settings /></LazyPage></PermissionGuard>} />
  </>
);
