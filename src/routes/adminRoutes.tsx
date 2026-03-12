import { Route } from 'react-router-dom';
import AdminUsuariosPage from '@/domains/admin/pages/AdminUsuariosPage';
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

export const adminRoutes = (
  <>
    <Route path="admin/usuarios" element={<AdminUsuariosPage />} />
    <Route path="admin/precificacao" element={<AdminPrecificacaoPage />} />
    <Route path="admin/config" element={<AdminConfigPage />} />
    <Route path="admin/produtos" element={<AdminProdutosPage />} />
    <Route path="admin/auditoria" element={<AdminUsuariosPage />} />
    <Route path="admin/setup" element={<AdminSetupPage />} />
    <Route path="admin/centros-custo" element={<AdminCentrosCustoPage />} />
    <Route path="admin/plano-contas" element={<AdminPlanoContasPage />} />
    <Route path="admin/materiais" element={<AdminMateriaisPage />} />
    <Route path="relatorios" element={<RelatoriosPage />} />
    <Route path="admin/progresso" element={<ProgressoPage />} />
    <Route path="settings" element={<Settings />} />
  </>
);
