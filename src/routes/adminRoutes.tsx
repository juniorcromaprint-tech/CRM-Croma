import { Route } from 'react-router-dom';
import AdminUsuariosPage from '@/domains/admin/pages/AdminUsuariosPage';
import AdminAuditoriaPage from '@/domains/admin/pages/AdminAuditoriaPage';
import AdminPrecificacaoPage from '@/domains/admin/pages/AdminPrecificacaoPage';
import AdminConfigPage from '@/domains/admin/pages/AdminConfigPage';
import AdminProdutosPage from '@/domains/admin/pages/AdminProdutosPage';
import AdminSetupPage from '@/domains/admin/pages/AdminSetupPage';
import AdminCentrosCustoPage from '@/domains/admin/pages/AdminCentrosCustoPage';
import AdminPlanoContasPage from '@/domains/admin/pages/AdminPlanoContasPage';
import AdminMateriaisPage from '@/domains/admin/pages/AdminMateriaisPage';
import RelatoriosPage from '@/domains/admin/pages/RelatoriosPage';
import ProgressoPage from '@/domains/admin/pages/ProgressoPage';
import Settings from '@/pages/Settings';
import PermissionGuard from '@/shared/components/PermissionGuard';

export const adminRoutes = (
  <>
    <Route path="admin/usuarios" element={
      <PermissionGuard module="admin" action="ver">
        <AdminUsuariosPage />
      </PermissionGuard>
    } />
    <Route path="admin/precificacao" element={
      <PermissionGuard module="admin" action="ver">
        <AdminPrecificacaoPage />
      </PermissionGuard>
    } />
    <Route path="admin/config" element={
      <PermissionGuard module="admin" action="ver">
        <AdminConfigPage />
      </PermissionGuard>
    } />
    <Route path="admin/produtos" element={
      <PermissionGuard module="admin" action="ver">
        <AdminProdutosPage />
      </PermissionGuard>
    } />
    <Route path="admin/auditoria" element={
      <PermissionGuard module="admin" action="ver">
        <AdminAuditoriaPage />
      </PermissionGuard>
    } />
    <Route path="admin/setup" element={
      <PermissionGuard module="admin" action="ver">
        <AdminSetupPage />
      </PermissionGuard>
    } />
    <Route path="admin/centros-custo" element={
      <PermissionGuard module="admin" action="ver">
        <AdminCentrosCustoPage />
      </PermissionGuard>
    } />
    <Route path="admin/plano-contas" element={
      <PermissionGuard module="admin" action="ver">
        <AdminPlanoContasPage />
      </PermissionGuard>
    } />
    <Route path="admin/materiais" element={
      <PermissionGuard module="admin" action="ver">
        <AdminMateriaisPage />
      </PermissionGuard>
    } />
    <Route path="relatorios" element={<RelatoriosPage />} />
    <Route path="admin/progresso" element={
      <PermissionGuard module="admin" action="ver">
        <ProgressoPage />
      </PermissionGuard>
    } />
    <Route path="settings" element={<Settings />} />
  </>
);
