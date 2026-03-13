import { Route } from 'react-router-dom';
import FinanceiroPage from '@/domains/financeiro/pages/FinanceiroPage';
import ComissoesPage from '@/domains/financeiro/pages/ComissoesPage';
import DrePage from '@/domains/financeiro/pages/DrePage';
import FaturamentoLotePage from '@/domains/financeiro/pages/FaturamentoLotePage';
import ConciliacaoPage from '@/domains/financeiro/pages/ConciliacaoPage';
import BoletosPage from '@/domains/financeiro/pages/BoletosPage';
import ConfigBancariaPage from '@/domains/financeiro/pages/ConfigBancariaPage';

export const financeiroRoutes = (
  <>
    <Route path="financeiro" element={<FinanceiroPage />} />
    <Route path="dre" element={<DrePage />} />
    <Route path="comissoes" element={<ComissoesPage />} />
    <Route path="financeiro/faturamento" element={<FaturamentoLotePage />} />
    <Route path="financeiro/conciliacao" element={<ConciliacaoPage />} />
    <Route path="financeiro/boletos" element={<BoletosPage />} />
    <Route path="financeiro/config-bancaria" element={<ConfigBancariaPage />} />
  </>
);
