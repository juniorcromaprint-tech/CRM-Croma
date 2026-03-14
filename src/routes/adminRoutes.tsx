import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";
import PermissionGuard from "@/shared/components/PermissionGuard";

const AdminUsuariosPage = lazy(() => import("@/domains/admin/pages/AdminUsuariosPage"));
const AdminAuditoriaPage = lazy(() => import("@/domains/admin/pages/AdminAuditoriaPage"));
const AdminPrecificacaoPage = lazy(() => import("@/domains/admin/pages/AdminPrecificacaoPage"));
const AdminConfigPage = lazy(() => import("@/domains/admin/pages/AdminConfigPage"));
const AdminProdutosPage = lazy(() => import("@/domains/admin/pages/AdminProdutosPage"));
const AdminSetupPage = lazy(() => import("@/domains/admin/pages/AdminSetupPage"));
const AdminCentrosCustoPage = lazy(() => import("@/domains/admin/pages/AdminCentrosCustoPage"));
const AdminPlanoContasPage = lazy(() => import("@/domains/admin/pages/AdminPlanoContasPage"));
const AdminMateriaisPage = lazy(() => import("@/domains/admin/pages/AdminMateriaisPage"));
const RelatoriosPage = lazy(() => import("@/domains/admin/pages/RelatoriosPage"));
const ProgressoPage = lazy(() => import("@/domains/admin/pages/ProgressoPage"));
const Settings = lazy(() => import("@/pages/Settings"));

export const adminRoutes = (
  <>
    <Route path="admin/usuarios" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><AdminUsuariosPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="admin/precificacao" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><AdminPrecificacaoPage /></LazyPage>
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
    <Route path="relatorios" element={<LazyPage><RelatoriosPage /></LazyPage>} />
    <Route path="admin/progresso" element={
      <PermissionGuard module="admin" action="ver">
        <LazyPage><ProgressoPage /></LazyPage>
      </PermissionGuard>
    } />
    <Route path="settings" element={<LazyPage><Settings /></LazyPage>} />
  </>
);
