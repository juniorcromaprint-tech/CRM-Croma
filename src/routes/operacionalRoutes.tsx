import { Route } from 'react-router-dom';
import PedidosPage from '@/domains/pedidos/pages/PedidosPage';
import PedidoDetailPage from '@/domains/pedidos/pages/PedidoDetailPage';
import ProducaoPage from '@/domains/producao/pages/ProducaoPage';
import InstalacaoPage from '@/domains/instalacao/pages/InstalacaoPage';
import AlmoxarifePage from '@/domains/producao/pages/AlmoxarifePage';
import DiarioBordoPage from '@/domains/producao/pages/DiarioBordoPage';
import EstoquePage from '@/domains/estoque/pages/EstoquePage';
import ComprasPage from '@/domains/compras/pages/ComprasPage';
import Produtos from '@/pages/Produtos';
import OcorrenciasPage from '@/domains/qualidade/pages/OcorrenciasPage';

export const operacionalRoutes = (
  <>
    <Route path="pedidos" element={<PedidosPage />} />
    <Route path="pedidos/:id" element={<PedidoDetailPage />} />
    <Route path="producao" element={<ProducaoPage />} />
    <Route path="instalacoes" element={<InstalacaoPage />} />
    <Route path="almoxarife" element={<AlmoxarifePage />} />
    <Route path="producao/diario-bordo" element={<DiarioBordoPage />} />
    <Route path="estoque" element={<EstoquePage />} />
    <Route path="compras" element={<ComprasPage />} />
    <Route path="produtos" element={<Produtos />} />
    <Route path="ocorrencias" element={<OcorrenciasPage />} />
  </>
);
