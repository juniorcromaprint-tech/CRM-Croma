import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";
import PermissionGuard from "@/shared/components/PermissionGuard";

const ClientesPage = lazy(() => import("@/domains/clientes/pages/ClientesPage"));
const ClienteDetailPage = lazy(() => import("@/domains/clientes/pages/ClienteDetailPage"));

export const clientesRoutes = (
  <>
    <Route path="clientes" element={<PermissionGuard module="clientes" action="ver"><LazyPage><ClientesPage /></LazyPage></PermissionGuard>} />
    <Route path="clientes/:id" element={<PermissionGuard module="clientes" action="ver"><LazyPage><ClienteDetailPage /></LazyPage></PermissionGuard>} />
  </>
);
