import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";
import Clients from "./pages/Clients";
import Settings from "./pages/Settings";
import StoreMap from "./pages/StoreMap";
import Analytics from "./pages/Analytics";
import BillingReport from "./pages/BillingReport";
import Team from "./pages/Team";
import ClientesList from "./pages/ClientesList";
import ClienteDetail from "./pages/ClienteDetail";
import OrcamentosList from "./pages/OrcamentosList";
import OrcamentoDetail from "./pages/OrcamentoDetail";
import FunilVendas from "./pages/FunilVendas";
import Produtos from "./pages/Produtos";
import Financeiro from "./pages/Financeiro";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading } = useAuth();

  if (isLoading) return null;
  if (!session) return <Navigate to="/login" />;

  return <>{children}</>;
};

// Wrapper que permite acesso sem login (para protótipo/demo)
const DemoRoute = ({ children }: { children: React.ReactNode }) => {
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
            <Route path="/login" element={<Login />} />
            {/* Módulo Comercial — acessível sem login (protótipo demo) */}
            <Route
              path="/"
              element={
                <DemoRoute>
                  <Layout />
                </DemoRoute>
              }
            >
              <Route index element={<Index />} />
              <Route path="jobs" element={<Jobs />} />
              <Route path="jobs/:id" element={<JobDetail />} />
              <Route path="clients" element={<Clients />} />
              <Route path="settings" element={<Settings />} />
              <Route path="map" element={<StoreMap />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="billing-report" element={<BillingReport />} />
              <Route path="team" element={<Team />} />
              {/* Módulo Comercial */}
              <Route path="clientes" element={<ClientesList />} />
              <Route path="clientes/:id" element={<ClienteDetail />} />
              <Route path="orcamentos" element={<OrcamentosList />} />
              <Route path="orcamentos/:id" element={<OrcamentoDetail />} />
              <Route path="funil-vendas" element={<FunilVendas />} />
              <Route path="produtos" element={<Produtos />} />
              <Route path="financeiro" element={<Financeiro />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;