import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";

// ---- Domain Pages (real) ----
import DashboardPage from "@/domains/comercial/pages/DashboardPage";
import LeadsPage from "@/domains/comercial/pages/LeadsPage";
import PipelinePage from "@/domains/comercial/pages/PipelinePage";
import PropostasPage from "@/domains/comercial/pages/PropostasPage";
import ClientesPage from "@/domains/clientes/pages/ClientesPage";

// ---- Phase 2 Domain Pages ----
import PedidosPage from "@/domains/pedidos/pages/PedidosPage";
import FinanceiroPage from "@/domains/financeiro/pages/FinanceiroPage";
import ComissoesPage from "@/domains/financeiro/pages/ComissoesPage";

// ---- Legacy pages (still usable) ----
import ClienteDetailPage from "@/domains/clientes/pages/ClienteDetailPage";
import Produtos from "./pages/Produtos";
import Settings from "./pages/Settings";

// ---- Placeholder for phases not yet built ----
import PlaceholderPage from "@/shared/components/PlaceholderPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
    },
  },
});

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
            {/* Layout com sidebar — todas as rotas dentro */}
            <Route
              path="/"
              element={
                <DemoRoute>
                  <Layout />
                </DemoRoute>
              }
            >
              {/* ===== PAINEL ===== */}
              <Route index element={<DashboardPage />} />

              {/* ===== COMERCIAL ===== */}
              <Route path="leads" element={<LeadsPage />} />
              <Route path="pipeline" element={<PipelinePage />} />
              <Route path="propostas" element={<PropostasPage />} />

              {/* ===== CLIENTES ===== */}
              <Route path="clientes" element={<ClientesPage />} />
              <Route path="clientes/:id" element={<ClienteDetailPage />} />

              {/* ===== OPERACIONAL ===== */}
              <Route path="pedidos" element={<PedidosPage />} />
              <Route path="producao" element={<PlaceholderPage title="Produção" description="Ordens de produção, etapas e apontamentos" phase="Fase 3" />} />
              <Route path="instalacoes" element={<PlaceholderPage title="Instalações" description="Agendamento e acompanhamento de instalações em campo" phase="Fase 4" />} />

              {/* ===== SUPRIMENTOS ===== */}
              <Route path="estoque" element={<PlaceholderPage title="Estoque" description="Saldos, movimentações e inventário de materiais" phase="Fase 3" />} />
              <Route path="compras" element={<PlaceholderPage title="Compras" description="Solicitações, cotações e pedidos de compra" phase="Fase 5" />} />
              <Route path="produtos" element={<Produtos />} />

              {/* ===== FINANCEIRO ===== */}
              <Route path="financeiro" element={<FinanceiroPage />} />
              <Route path="comissoes" element={<ComissoesPage />} />

              {/* ===== QUALIDADE ===== */}
              <Route path="ocorrencias" element={<PlaceholderPage title="Ocorrências" description="Registro e tratativa de não-conformidades" phase="Fase 5" />} />

              {/* ===== ADMINISTRAÇÃO ===== */}
              <Route path="admin/usuarios" element={<PlaceholderPage title="Usuários" description="Gestão de usuários, perfis e permissões" phase="Fase 6" />} />
              <Route path="admin/config" element={<Settings />} />
              <Route path="admin/auditoria" element={<PlaceholderPage title="Auditoria" description="Logs de auditoria e rastreabilidade de ações" phase="Fase 6" />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
