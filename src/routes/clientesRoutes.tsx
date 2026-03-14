import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";

const ClientesPage = lazy(() => import("@/domains/clientes/pages/ClientesPage"));
const ClienteDetailPage = lazy(() => import("@/domains/clientes/pages/ClienteDetailPage"));

export const clientesRoutes = (
  <>
    <Route path="clientes" element={<LazyPage><ClientesPage /></LazyPage>} />
    <Route path="clientes/:id" element={<LazyPage><ClienteDetailPage /></LazyPage>} />
  </>
);
