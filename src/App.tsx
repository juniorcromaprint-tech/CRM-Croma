import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy } from "react";
import { Loader2 } from "lucide-react";
import LazyPage from "./shared/components/LazyPage";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import LoginPage from "@/shared/pages/LoginPage";
import TvPage from "@/domains/producao/pages/TvPage";

const PortalOrcamentoPage = lazy(() => import('./domains/portal/pages/PortalOrcamentoPage'));
const NpsPage = lazy(() => import('./domains/portal/pages/NpsPage'));

// Domain route groups
import { comercialRoutes } from "./routes/comercialRoutes";
import { clientesRoutes } from "./routes/clientesRoutes";
import { operacionalRoutes } from "./routes/operacionalRoutes";
import { suprimentosRoutes } from "./routes/suprimentosRoutes";
import { qualidadeRoutes } from "./routes/qualidadeRoutes";
import { financeiroRoutes } from "./routes/financeiroRoutes";
import { fiscalRoutes } from "./routes/fiscalRoutes";
import { contabilidadeRoutes } from "./routes/contabilidadeRoutes";
import { adminRoutes } from "./routes/adminRoutes";
import { agentRoutes } from "./routes/agentRoutes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading, profile, isPendingApproval } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Usuário inativo: redirecionar para login
  if (profile && profile.ativo === false) {
    return <Navigate to="/login" replace />;
  }

  // Usuário aguardando aprovação
  if (isPendingApproval) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md shadow-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mb-4">
            <Loader2 className="h-8 w-8 text-amber-600 animate-spin" />
          </div>
          <h2 className="text-lg font-semibold text-slate-700 mb-2">
            Aguardando Aprovação
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Sua conta foi criada com sucesso. Um administrador revisará sua solicitação em breve.
          </p>
          <p className="text-xs text-slate-400">
            Você receberá uma notificação quando sua conta for ativada.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/tv" element={<ProtectedRoute><TvPage /></ProtectedRoute>} />
            <Route path="/p/:token" element={<LazyPage><PortalOrcamentoPage /></LazyPage>} />
            <Route path="/nps/:token" element={<LazyPage><NpsPage /></LazyPage>} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              {comercialRoutes}
              {clientesRoutes}
              {operacionalRoutes}
              {suprimentosRoutes}
              {qualidadeRoutes}
              {financeiroRoutes}
              {fiscalRoutes}
              {contabilidadeRoutes}
              {adminRoutes}
              {agentRoutes}
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
