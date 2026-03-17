import { Toaster } from "@/components/ui/toaster";
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

// Domain route groups
import { comercialRoutes } from "./routes/comercialRoutes";
import { clientesRoutes } from "./routes/clientesRoutes";
import { operacionalRoutes } from "./routes/operacionalRoutes";
import { suprimentosRoutes } from "./routes/suprimentosRoutes";
import { qualidadeRoutes } from "./routes/qualidadeRoutes";
import { financeiroRoutes } from "./routes/financeiroRoutes";
import { fiscalRoutes } from "./routes/fiscalRoutes";
import { adminRoutes } from "./routes/adminRoutes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading } = useAuth();

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

  return <>{children}</>;
};

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/tv" element={<ProtectedRoute><TvPage /></ProtectedRoute>} />
            <Route path="/p/:token" element={<LazyPage><PortalOrcamentoPage /></LazyPage>} />

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
              {adminRoutes}
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
