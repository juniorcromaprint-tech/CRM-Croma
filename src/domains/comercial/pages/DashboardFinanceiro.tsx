import React from "react";
import { Link } from "react-router-dom";
import { Wallet, DollarSign, AlertTriangle, TrendingUp, ArrowRight, TrendingDown } from "lucide-react";
import KpiCard from "@/shared/components/KpiCard";
import { brl as formatBRL } from "@/shared/utils/format";
import { useDashFinanceiro } from "../hooks/useDashboardStats";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function DashboardFinanceiro() {
  const { data: fin, isLoading } = useDashFinanceiro();

  const { data: contasVencer } = useQuery({
    queryKey: ["dash-fin", "contas-vencer"],
    queryFn: async () => {
      const hoje = new Date().toISOString().split("T")[0];
      const em7dias = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
      const { data } = await supabase
        .from("contas_receber")
        .select("id, numero_titulo, valor_original, data_vencimento, status, clientes(nome_fantasia)")
        .lte("data_vencimento", em7dias)
        .gte("data_vencimento", hoje)
        .not("status", "in", "(pago,cancelado)")
        .order("data_vencimento")
        .limit(5);
      return data ?? [];
    },
  });

  const { data: vencidos } = useQuery({
    queryKey: ["dash-fin", "vencidos"],
    queryFn: async () => {
      const hoje = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("contas_receber")
        .select("id, numero_titulo, valor_original, valor_pago, data_vencimento, clientes(nome_fantasia)")
        .lt("data_vencimento", hoje)
        .not("status", "in", "(pago,cancelado)")
        .order("data_vencimento")
        .limit(5);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Painel Financeiro</h1>
          <p className="text-slate-500 mt-1">Contas a receber, pagar e fluxo de caixa</p>
        </div>
        <Link to="/financeiro" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">
          Financeiro completo <ArrowRight size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="A Receber" value={fin?.totalReceber ? formatBRL(fin.totalReceber) : "—"} icon={<Wallet size={20} />} color="green" loading={isLoading} />
        <KpiCard title="A Pagar" value={fin?.totalPagar ? formatBRL(fin.totalPagar) : "—"} icon={<DollarSign size={20} />} color="rose" loading={isLoading} />
        <KpiCard title="Saldo Projetado" value={fin?.saldo !== undefined ? formatBRL(fin.saldo) : "—"} icon={(fin?.saldo ?? 0) >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />} color={(fin?.saldo ?? 0) >= 0 ? "blue" : "red"} loading={isLoading} />
        <KpiCard title="Inadimplência" value={fin?.vencidos ? formatBRL(fin.vencidos) : "R$ 0"} icon={<AlertTriangle size={20} />} color={fin?.vencidos && fin.vencidos > 0 ? "red" : "slate"} trend={fin?.vencidos && fin.vencidos > 0 ? "down" : undefined} trendValue={fin?.vencidos && fin.vencidos > 0 ? "Atenção" : undefined} loading={isLoading} />
      </div>

      {/* Recebimento + Saldo visual */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "A Receber", value: fin?.totalReceber, cls: "bg-green-50 border-green-100 text-green-700" },
          { label: "A Pagar", value: fin?.totalPagar, cls: "bg-rose-50 border-rose-100 text-rose-700" },
          { label: "Saldo Proj.", value: fin?.saldo, cls: (fin?.saldo ?? 0) >= 0 ? "bg-blue-50 border-blue-100 text-blue-700" : "bg-red-50 border-red-100 text-red-700" },
          { label: "Já Recebido", value: fin?.recebido, cls: "bg-emerald-50 border-emerald-100 text-emerald-700" },
          { label: "Inadimpl.", value: fin?.vencidos, cls: (fin?.vencidos ?? 0) > 0 ? "bg-red-50 border-red-100 text-red-700" : "bg-slate-50 border-slate-100 text-slate-400" },
        ].map(({ label, value, cls }) => (
          <div key={label} className={`text-center p-4 rounded-xl border ${cls}`}>
            <p className="text-xs font-medium mb-1 opacity-80">{label}</p>
            <p className="text-base font-bold tabular-nums">{value !== undefined ? formatBRL(value) : "—"}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* A vencer esta semana */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wallet size={16} className="text-amber-500" />
            <h2 className="font-semibold text-slate-800 text-sm">A vencer (próximos 7 dias)</h2>
          </div>
          {contasVencer && contasVencer.length > 0 ? (
            <div className="space-y-2">
              {contasVencer.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{c.clientes?.nome_fantasia || "—"}</p>
                    <p className="text-xs text-slate-400">{c.data_vencimento}</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-slate-700 ml-3">{formatBRL(Number(c.valor_original) || 0)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-6 text-center">Nenhum vencimento esta semana</p>
          )}
        </div>

        {/* Inadimplentes */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-red-500" />
            <h2 className="font-semibold text-slate-800 text-sm">Títulos vencidos</h2>
          </div>
          {vencidos && vencidos.length > 0 ? (
            <div className="space-y-2">
              {vencidos.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{c.clientes?.nome_fantasia || "—"}</p>
                    <p className="text-xs text-red-400">Venceu em {c.data_vencimento}</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-red-600 ml-3">{formatBRL(Number(c.valor_original) || 0)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-6 text-center">Nenhum título vencido</p>
          )}
        </div>
      </div>
    </div>
  );
}
