import React, { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAlertasEstoque } from "@/domains/admin/hooks/useAlertasEstoque";
import { showWarning } from "@/utils/toast";

// Role-specific dashboards (lazy import for code splitting)
const DashboardDiretor = React.lazy(() => import("./DashboardDiretor"));
const DashboardComercial = React.lazy(() => import("./DashboardComercial"));
const DashboardFinanceiro = React.lazy(() => import("./DashboardFinanceiro"));
const DashboardProducao = React.lazy(() => import("./DashboardProducao"));

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 w-64 bg-slate-200 rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-32 bg-slate-100 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-64 bg-slate-100 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const role = profile?.role ?? "admin";

  // Alerta de estoque mínimo na primeira carga do dashboard
  const { data: alertasEstoque = [] } = useAlertasEstoque();
  const alertadoRef = useRef(false);
  useEffect(() => {
    if (alertadoRef.current) return;
    if (alertasEstoque.length === 0) return;
    alertadoRef.current = true;
    showWarning(
      `${alertasEstoque.length} ${alertasEstoque.length === 1 ? 'material abaixo' : 'materiais abaixo'} do estoque mínimo — verificar em Estoque`,
      { duration: 6000 },
    );
  }, [alertasEstoque]);

  return (
    <React.Suspense fallback={<DashboardSkeleton />}>
      {role === "financeiro" ? (
        <DashboardFinanceiro />
      ) : role === "producao" ? (
        <DashboardProducao />
      ) : role === "comercial" ? (
        <DashboardComercial />
      ) : (
        // Admin, diretor, comercial_senior, logistica e outros → visão completa
        <DashboardDiretor />
      )}
    </React.Suspense>
  );
}
