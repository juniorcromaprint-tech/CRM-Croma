import { Route } from 'react-router-dom';
import ClientesPage from '@/domains/clientes/pages/ClientesPage';
import ClienteDetailPage from '@/domains/clientes/pages/ClienteDetailPage';

export const clientesRoutes = (
  <>
    <Route path="clientes" element={<ClientesPage />} />
    <Route path="clientes/:id" element={<ClienteDetailPage />} />
  </>
);
