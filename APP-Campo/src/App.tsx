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
import Stores from "./pages/Stores";
import Settings from "./pages/Settings";
import StoreMap from "./pages/StoreMap";
import StoreDetail from "./pages/StoreDetail";
import Analytics from "./pages/Analytics";
import BillingReport from "./pages/BillingReport";
import Team from "./pages/Team";
import VisitRoute from "./pages/VisitRoute";
import NewJob from "./pages/NewJob";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading } = useAuth();
  
  if (isLoading) return null;
  if (!session) return <Navigate to="/login" />;
  
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
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Index />} />
              <Route path="jobs" element={<Jobs />} />
              <Route path="jobs/:id" element={<JobDetail />} />
              <Route path="clients" element={<Clients />} />
              <Route path="stores" element={<Stores />} />
              <Route path="settings" element={<Settings />} />
              <Route path="map" element={<StoreMap />} />
              <Route path="stores/:id" element={<StoreDetail />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="billing-report" element={<BillingReport />} />
              <Route path="team" element={<Team />} />
              <Route path="roteiro" element={<VisitRoute />} />
              <Route path="new-job" element={<NewJob />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;