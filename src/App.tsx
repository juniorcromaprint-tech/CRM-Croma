import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

const PortalOrcamentoPage = lazy(() => import('./domains/portal/pages/PortalOrcamentoPage'));
import Layout from "./components/Layout";
import LoginPage from "@/shared/pages/LoginPage";
import TvPage from "@/domains/producao/pages/TvPage";

// Domain route groups
import { comercialRoutes } from "./routes/comercialRoutes";
import { clientesRoutes } from "./routes/clientesRoutes";
import { operacionalRoutes } from "./routes/operacionalRoutes";
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
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/tv" element={<TvPage />} />
            <Route path="/p/:token" element={
              <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}>
                <PortalOrcamentoPage />
              </Suspense>
            } />

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
);

export default App;
