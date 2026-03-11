import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "@/shared/pages/LoginPage";

// ---- Domain Pages (real) ----
import DashboardPage from "@/domains/comercial/pages/DashboardPage";
import LeadsPage from "@/domains/comercial/pages/LeadsPage";
import PipelinePage from "@/domains/comercial/pages/PipelinePage";
import ClientesPage from "@/domains/clientes/pages/ClientesPage";

// ---- Phase 2 Domain Pages ----
import PedidosPage from "@/domains/pedidos/pages/PedidosPage";
import FinanceiroPage from "@/domains/financeiro/pages/FinanceiroPage";
import ComissoesPage from "@/domains/financeiro/pages/ComissoesPage";
import DrePage from "@/domains/financeiro/pages/DrePage";

// ---- Phase 3 Domain Pages ----
import ProducaoPage from "@/domains/producao/pages/ProducaoPage";
import EstoquePage from "@/domains/estoque/pages/EstoquePage";

// ---- Phase 4-5 Domain Pages ----
import ComprasPage from "@/domains/compras/pages/ComprasPage";
import InstalacaoPage from "@/domains/instalacao/pages/InstalacaoPage";
import OcorrenciasPage from "@/domains/qualidade/pages/OcorrenciasPage";

// ---- Orçamentos Pages ----
import OrcamentosPage from "@/domains/comercial/pages/OrcamentosPage";
import OrcamentoEditorPage from "@/domains/comercial/pages/OrcamentoEditorPage";
import OrcamentoViewPage from "@/domains/comercial/pages/OrcamentoViewPage";
import PropostasPage from "@/domains/comercial/pages/PropostasPage";
import PedidoDetailPage from "@/domains/pedidos/pages/PedidoDetailPage";

// ---- Phase 6 Admin Pages ----
import AdminUsuariosPage from "@/domains/admin/pages/AdminUsuariosPage";
import AdminPrecificacaoPage from "@/domains/admin/pages/AdminPrecificacaoPage";
import AdminConfigPage from "@/domains/admin/pages/AdminConfigPage";
import AdminProdutosPage from "@/domains/admin/pages/AdminProdutosPage";
import AdminSetupPage from "@/domains/admin/pages/AdminSetupPage";
import AdminCentrosCustoPage from "@/domains/admin/pages/AdminCentrosCustoPage";
import AdminPlanoContasPage from "@/domains/admin/pages/AdminPlanoContasPage";

// ---- Fiscal Domain Pages ----
import FiscalDashboardPage from "@/domains/fiscal/pages/FiscalDashboardPage";
import FiscalDocumentosPage from "@/domains/fiscal/pages/FiscalDocumentosPage";
import FiscalFilaPage from "@/domains/fiscal/pages/FiscalFilaPage";
import FiscalConfiguracaoPage from "@/domains/fiscal/pages/FiscalConfiguracaoPage";
import FiscalCertificadoPage from "@/domains/fiscal/pages/FiscalCertificadoPage";
import FiscalAuditoriaPage from "@/domains/fiscal/pages/FiscalAuditoriaPage";

// ---- Fase 1-3 Domain Pages ----
import FaturamentoLotePage from "@/domains/financeiro/pages/FaturamentoLotePage";
import AlmoxarifePage from "@/domains/producao/pages/AlmoxarifePage";
import DiarioBordoPage from "@/domains/producao/pages/DiarioBordoPage";
import TvPage from "@/domains/producao/pages/TvPage";
import RelatoriosPage from "@/domains/admin/pages/RelatoriosPage";
import ConciliacaoPage from "@/domains/financeiro/pages/ConciliacaoPage";
import CalendarioPage from "@/domains/comercial/pages/CalendarioPage";
import CampanhasPage from "@/domains/comercial/pages/CampanhasPage";
import ProgressoPage from "@/domains/admin/pages/ProgressoPage";

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

// Wrapper de autenticação — exige login
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
            {/* ===== LOGIN ===== */}
            <Route path="/login" element={<LoginPage />} />

            {/* ===== TV — fullscreen sem sidebar ===== */}
            <Route path="/tv" element={<TvPage />} />

            {/* Layout com sidebar — todas as rotas dentro */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              {/* ===== PAINEL ===== */}
              <Route index element={<DashboardPage />} />

              {/* ===== COMERCIAL ===== */}
              <Route path="leads" element={<LeadsPage />} />
              <Route path="pipeline" element={<PipelinePage />} />
              <Route path="orcamentos" element={<OrcamentosPage />} />
              <Route path="orcamentos/novo" element={<OrcamentoEditorPage />} />
              <Route path="orcamentos/:id" element={<OrcamentoViewPage />} />
              <Route path="orcamentos/:id/editar" element={<OrcamentoEditorPage />} />
              <Route path="propostas" element={<PropostasPage />} />
              <Route path="calendario" element={<CalendarioPage />} />
              <Route path="campanhas" element={<CampanhasPage />} />

              {/* ===== CLIENTES ===== */}
              <Route path="clientes" element={<ClientesPage />} />
              <Route path="clientes/:id" element={<ClienteDetailPage />} />

              {/* ===== OPERACIONAL ===== */}
              <Route path="pedidos" element={<PedidosPage />} />
              <Route path="pedidos/:id" element={<PedidoDetailPage />} />
              <Route path="producao" element={<ProducaoPage />} />
              <Route path="instalacoes" element={<InstalacaoPage />} />
              <Route path="almoxarife" element={<AlmoxarifePage />} />
              <Route path="producao/diario-bordo" element={<DiarioBordoPage />} />

              {/* ===== SUPRIMENTOS ===== */}
              <Route path="estoque" element={<EstoquePage />} />
              <Route path="compras" element={<ComprasPage />} />
              <Route path="produtos" element={<Produtos />} />

              {/* ===== FINANCEIRO ===== */}
              <Route path="financeiro" element={<FinanceiroPage />} />
              <Route path="dre" element={<DrePage />} />
              <Route path="comissoes" element={<ComissoesPage />} />
              <Route path="financeiro/faturamento" element={<FaturamentoLotePage />} />
              <Route path="financeiro/conciliacao" element={<ConciliacaoPage />} />

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
              <Route path="admin/precificacao" element={<AdminPrecificacaoPage />} />
              <Route path="admin/config" element={<AdminConfigPage />} />
              <Route path="admin/produtos" element={<AdminProdutosPage />} />
              <Route path="admin/auditoria" element={<AdminUsuariosPage />} />
              <Route path="admin/setup" element={<AdminSetupPage />} />
              <Route path="admin/centros-custo" element={<AdminCentrosCustoPage />} />
              <Route path="admin/plano-contas" element={<AdminPlanoContasPage />} />
              <Route path="relatorios" element={<RelatoriosPage />} />
              <Route path="admin/progresso" element={<ProgressoPage />} />

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
