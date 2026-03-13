import { Route } from 'react-router-dom';
import FiscalDashboardPage from '@/domains/fiscal/pages/FiscalDashboardPage';
import FiscalDocumentosPage from '@/domains/fiscal/pages/FiscalDocumentosPage';
import FiscalFilaPage from '@/domains/fiscal/pages/FiscalFilaPage';
import FiscalConfiguracaoPage from '@/domains/fiscal/pages/FiscalConfiguracaoPage';
import FiscalCertificadoPage from '@/domains/fiscal/pages/FiscalCertificadoPage';
import FiscalAuditoriaPage from '@/domains/fiscal/pages/FiscalAuditoriaPage';

export const fiscalRoutes = (
  <>
    <Route path="fiscal" element={<FiscalDashboardPage />} />
    <Route path="fiscal/documentos" element={<FiscalDocumentosPage />} />
    <Route path="fiscal/fila" element={<FiscalFilaPage />} />
    <Route path="fiscal/emissao" element={<FiscalFilaPage />} />
    <Route path="fiscal/configuracao" element={<FiscalConfiguracaoPage />} />
    <Route path="fiscal/certificado" element={<FiscalCertificadoPage />} />
    <Route path="fiscal/auditoria" element={<FiscalAuditoriaPage />} />
  </>
);
