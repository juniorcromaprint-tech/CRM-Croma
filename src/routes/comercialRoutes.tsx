import { Route } from 'react-router-dom';
import DashboardPage from '@/domains/comercial/pages/DashboardPage';
import LeadsPage from '@/domains/comercial/pages/LeadsPage';
import LeadDetailPage from '@/domains/comercial/pages/LeadDetailPage';
import PipelinePage from '@/domains/comercial/pages/PipelinePage';
import OrcamentosPage from '@/domains/comercial/pages/OrcamentosPage';
import OrcamentoEditorPage from '@/domains/comercial/pages/OrcamentoEditorPage';
import OrcamentoViewPage from '@/domains/comercial/pages/OrcamentoViewPage';
import PropostasPage from '@/domains/comercial/pages/PropostasPage';
import CalendarioPage from '@/domains/comercial/pages/CalendarioPage';
import CampanhasPage from '@/domains/comercial/pages/CampanhasPage';

export const comercialRoutes = (
  <>
    <Route index element={<DashboardPage />} />
    <Route path="leads" element={<LeadsPage />} />
    <Route path="leads/:id" element={<LeadDetailPage />} />
    <Route path="pipeline" element={<PipelinePage />} />
    <Route path="orcamentos" element={<OrcamentosPage />} />
    <Route path="orcamentos/novo" element={<OrcamentoEditorPage />} />
    <Route path="orcamentos/:id" element={<OrcamentoViewPage />} />
    <Route path="orcamentos/:id/editar" element={<OrcamentoEditorPage />} />
    <Route path="propostas" element={<PropostasPage />} />
    <Route path="calendario" element={<CalendarioPage />} />
    <Route path="campanhas" element={<CampanhasPage />} />
  </>
);
