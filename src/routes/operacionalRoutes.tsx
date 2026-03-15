import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";

const PedidosPage = lazy(() => import("@/domains/pedidos/pages/PedidosPage"));
const PedidoDetailPage = lazy(() => import("@/domains/pedidos/pages/PedidoDetailPage"));
const ProducaoPage = lazy(() => import("@/domains/producao/pages/ProducaoPage"));
const InstalacaoPage = lazy(() => import("@/domains/instalacao/pages/InstalacaoPage"));
const AlmoxarifePage = lazy(() => import("@/domains/producao/pages/AlmoxarifePage"));
const DiarioBordoPage = lazy(() => import("@/domains/producao/pages/DiarioBordoPage"));
const EstoquePage = lazy(() => import("@/domains/estoque/pages/EstoquePage"));
const ComprasPage = lazy(() => import("@/domains/compras/pages/ComprasPage"));
const Produtos = lazy(() => import("@/pages/Produtos"));
const OcorrenciasPage = lazy(() => import("@/domains/qualidade/pages/OcorrenciasPage"));
const ExpedicaoPage = lazy(() => import("@/domains/producao/pages/ExpedicaoPage"));
const OrdemServicoPage = lazy(() => import("@/domains/producao/pages/OrdemServicoPage"));
const OrdemServicoOPPage = lazy(() => import("@/domains/producao/pages/OrdemServicoOPPage"));

export const operacionalRoutes = (
  <>
    <Route path="pedidos" element={<LazyPage><PedidosPage /></LazyPage>} />
    <Route path="pedidos/:id" element={<LazyPage><PedidoDetailPage /></LazyPage>} />
    <Route path="os/:pedidoId" element={<LazyPage><OrdemServicoPage /></LazyPage>} />
    <Route path="os/op/:opId" element={<LazyPage><OrdemServicoOPPage /></LazyPage>} />
    <Route path="producao" element={<LazyPage><ProducaoPage /></LazyPage>} />
    <Route path="expedicao" element={<LazyPage><ExpedicaoPage /></LazyPage>} />
    <Route path="instalacoes" element={<LazyPage><InstalacaoPage /></LazyPage>} />
    <Route path="almoxarife" element={<LazyPage><AlmoxarifePage /></LazyPage>} />
    <Route path="producao/diario-bordo" element={<LazyPage><DiarioBordoPage /></LazyPage>} />
    <Route path="estoque" element={<LazyPage><EstoquePage /></LazyPage>} />
    <Route path="compras" element={<LazyPage><ComprasPage /></LazyPage>} />
    <Route path="produtos" element={<LazyPage><Produtos /></LazyPage>} />
    <Route path="ocorrencias" element={<LazyPage><OcorrenciasPage /></LazyPage>} />
  </>
);
