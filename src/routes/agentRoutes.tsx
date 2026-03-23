import { lazy } from "react";
import { Route } from "react-router-dom";
import LazyPage from "@/shared/components/LazyPage";
import PermissionGuard from "@/shared/components/PermissionGuard";

const AgentDashboardPage = lazy(() => import("@/domains/agent/pages/AgentDashboardPage"));
const AgentConversationPage = lazy(() => import("@/domains/agent/pages/AgentConversationPage"));
const AgentApprovalPage = lazy(() => import("@/domains/agent/pages/AgentApprovalPage"));
const AgentConfigPage = lazy(() => import("@/domains/agent/pages/AgentConfigPage"));

export const agentRoutes = (
  <>
    <Route path="agente" element={<PermissionGuard module="comercial" action="ver"><LazyPage><AgentDashboardPage /></LazyPage></PermissionGuard>} />
    <Route path="agente/conversa/:id" element={<PermissionGuard module="comercial" action="ver"><LazyPage><AgentConversationPage /></LazyPage></PermissionGuard>} />
    <Route path="agente/aprovacao" element={<PermissionGuard module="comercial" action="ver"><LazyPage><AgentApprovalPage /></LazyPage></PermissionGuard>} />
    <Route path="agente/config" element={<PermissionGuard module="comercial" action="ver"><LazyPage><AgentConfigPage /></LazyPage></PermissionGuard>} />
  </>
);
