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

// ---- Phase 3 Domain Pages ----
import ProducaoPage from "@/domains/producao/pages/ProducaoPage";
import EstoquePage from "@/domains/estoque/pages/EstoquePage";

// ---- Phase 4-5 Domain Pages ----
import ComprasPage from "@/domains/compras/pages/ComprasPage";
import InstalacaoPage from "@/domains/instalacao/pages/InstalacaoPage";
import OcorrenciasPage from "@/domains/qualidade/pages/OcorrenciasPage";

// ---- Phase 6 Admin Pages ----
import AdminUsuariosPage from "@/domains/admin/pages/AdminUsuariosPage";

// ---- Fiscal Domain Pages ----
import FiscalDashboardPage from "@/domains/fiscal/pages/FiscalDashboardPage";
import FiscalDocumentosPage from "@/domains/fiscal/pages/FiscalDocumentosPage";
import FiscalFilaPage from "@/domains/fiscal/pages/FiscalFilaPage";
import FiscalConfiguracaoPage from "@/domains/fiscal/pages/FiscalConfiguracaoPage";
import FiscalCertificadoPage from "@/domains/fiscal/pages/FiscalCertificadoPage";
import FiscalAuditoriaPage from "@/domains/fiscal/pages/FiscalAuditoriaPage";

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
              <Route path="producao" element={<ProducaoPage />} />
              <Route path="instalacoes" element={<InstalacaoPage />} />

              {/* ===== SUPRIMENTOS ===== */}
              <Route path="estoque" element={<EstoquePage />} />
              <Route path="compras" element={<ComprasPage />} />
              <Route path="produtos" element={<Produtos />} />

              {/* ===== FINANCEIRO ===== */}
              <Route path="financeiro" element={<FinanceiroPage />} />
              <Route path="dre" element={<PlaceholderPage />} />
              <Route path="comissoes" element={<ComissoesPage />} />

              {/* ===== QUALIDADE ===== */}
              <Route path="ocorrencias" element={<OcorrenciasPage />} />

              {/* ===== FISCAL ===== */}
              <Route path="fiscal" element={<FiscalDashboardPage />} />
              <Route path="fiscal/documentos" element={<FiscalDocumentosPage />} />
              <Route path="fiscal/fila" element={<FiscalFilaPage />} />
              <Route path="fiscal/configuracao" element={<FiscalConfiguracaoPage />} />
              <Route path="fiscal/certificado" element={<FiscalCertificadoPage />} />
              <Route path="fiscal/auditoria" element={<FiscalAuditoriaPage />} />

              {/* ===== ADMINISTRAÇÃO ===== */}
              <Route path="admin/usuarios" element={<AdminUsuariosPage />} />
              <Route path="admin/config" element={<Settings />} />
              <Route path="admin/auditoria" element={<AdminUsuariosPage />} />

              {/* ===== SETTINGS ===== */}
              <Route path="settings" element={<Settings />} />
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
