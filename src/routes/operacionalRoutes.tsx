import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";
import PermissionGuard from "@/shared/components/PermissionGuard";

const PedidosPage = lazy(() => import("@/domains/pedidos/pages/PedidosPage"));
const PedidoDetailPage = lazy(() => import("@/domains/pedidos/pages/PedidoDetailPage"));
const ProducaoPage = lazy(() => import("@/domains/producao/pages/ProducaoPage"));
const InstalacaoPage = lazy(() => import("@/domains/instalacao/pages/InstalacaoPage"));
const InstalacaoDetailPage = lazy(() => import("@/domains/instalacao/pages/InstalacaoDetailPage"));
const AlmoxarifePage = lazy(() => import("@/domains/producao/pages/AlmoxarifePage"));
const DiarioBordoPage = lazy(() => import("@/domains/producao/pages/DiarioBordoPage"));
const Produtos = lazy(() => import("@/pages/Produtos"));
const ExpedicaoPage = lazy(() => import("@/domains/producao/pages/ExpedicaoPage"));
const OrdemServicoPage = lazy(() => import("@/domains/producao/pages/OrdemServicoPage"));
const OrdemServicoOPPage = lazy(() => import("@/domains/producao/pages/OrdemServicoOPPage"));
const PCPDashboardPage = lazy(() => import('@/domains/producao/pages/PCPDashboardPage'));
const SectorQueuePage = lazy(() => import('@/domains/producao/pages/SectorQueuePage'));

export const operacionalRoutes = (
  <>
    <Route path="pedidos" element={<PermissionGuard module="pedidos" action="ver"><LazyPage><PedidosPage /></LazyPage></PermissionGuard>} />
    <Route path="pedidos/:id" element={<PermissionGuard module="pedidos" action="ver"><LazyPage><PedidoDetailPage /></LazyPage></PermissionGuard>} />
    <Route path="os/:pedidoId" element={<PermissionGuard module="pedidos" action="ver"><LazyPage><OrdemServicoPage /></LazyPage></PermissionGuard>} />
    <Route path="os/op/:opId" element={<PermissionGuard module="pedidos" action="ver"><LazyPage><OrdemServicoOPPage /></LazyPage></PermissionGuard>} />
    <Route path="producao" element={<PermissionGuard module="producao" action="ver"><LazyPage><ProducaoPage /></LazyPage></PermissionGuard>} />
    <Route path="expedicao" element={<PermissionGuard module="producao" action="ver"><LazyPage><ExpedicaoPage /></LazyPage></PermissionGuard>} />
    <Route path="instalacoes" element={<PermissionGuard module="instalacao" action="ver"><LazyPage><InstalacaoPage /></LazyPage></PermissionGuard>} />
    <Route path="instalacoes/:jobId" element={<PermissionGuard module="instalacao" action="ver"><LazyPage><InstalacaoDetailPage /></LazyPage></PermissionGuard>} />
    <Route path="almoxarife" element={<PermissionGuard module="producao" action="ver"><LazyPage><AlmoxarifePage /></LazyPage></PermissionGuard>} />
    <Route path="producao/diario-bordo" element={<PermissionGuard module="producao" action="ver"><LazyPage><DiarioBordoPage /></LazyPage></PermissionGuard>} />
    <Route path="producao/pcp" element={<PermissionGuard module="producao" action="ver"><LazyPage><PCPDashboardPage /></LazyPage></PermissionGuard>} />
    <Route path="producao/setor/:sectorId" element={<PermissionGuard module="producao" action="ver"><LazyPage><SectorQueuePage /></LazyPage></PermissionGuard>} />
    <Route path="produtos" element={<PermissionGuard module="producao" action="ver"><LazyPage><Produtos /></LazyPage></PermissionGuard>} />
  </>
);
