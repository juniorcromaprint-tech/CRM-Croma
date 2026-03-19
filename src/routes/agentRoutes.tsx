import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";

const AgentDashboardPage = lazy(() => import("@/domains/agent/pages/AgentDashboardPage"));
const AgentApprovalPage = lazy(() => import("@/domains/agent/pages/AgentApprovalPage"));
const AgentConfigPage = lazy(() => import("@/domains/agent/pages/AgentConfigPage"));

export const agentRoutes = (
  <>
    <Route path="agente" element={<LazyPage><AgentDashboardPage /></LazyPage>} />
    <Route path="agente/aprovacao" element={<LazyPage><AgentApprovalPage /></LazyPage>} />
    <Route path="agente/config" element={<LazyPage><AgentConfigPage /></LazyPage>} />
  </>
);
