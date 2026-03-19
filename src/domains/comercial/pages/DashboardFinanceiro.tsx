import React from "react";
import { Link } from "react-router-dom";
import {
  Wallet, DollarSign, AlertTriangle, TrendingUp, ArrowRight,
  TrendingDown, Calendar, BarChart3, CheckCircle2, Clock,
} from "lucide-react";
import { brl } from "@/shared/utils/format";
import { useDashFinanceiro } from "../hooks/useDashboardStats";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ──────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                 */
/* ──────────────────────────────────────────────────────────────────────── */

function formatDate() {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Main                                                                   */
/* ──────────────────────────────────────────────────────────────────────── */

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

  const saldo = fin?.saldo ?? 0;
  const isPositive = saldo >= 0;

  return (
    <div className="space-y-6 max-w-[1200px]">

      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Painel Financeiro 💰</h1>
          <p className="text-sm text-slate-400 mt-0.5 flex items-center gap-1.5">
            <Calendar size={13} />
            {formatDate()}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/financeiro" className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all">
            <BarChart3 size={15} /> Financeiro completo
          </Link>
          <Link to="/dre" className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all">
            <TrendingUp size={15} /> DRE
          </Link>
        </div>
      </div>

      {/* ─── Hero: Saldo Projetado ─── */}
      <div className={`relative overflow-hidden rounded-2xl p-6 ${isPositive ? "bg-gradient-to-br from-emerald-500 to-emerald-600" : "bg-gradient-to-br from-red-500 to-red-600"}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">Saldo Projetado</p>
            {isLoading ? (
              <div className="h-10 w-40 bg-white/20 rounded-lg animate-pulse mt-1" />
            ) : (
              <p className="text-4xl font-bold text-white tabular-nums mt-1">{brl(saldo)}</p>
            )}
            <p className="text-sm text-white/70 mt-2">
              Receber {brl(fin?.totalReceber ?? 0)} − Pagar {brl(fin?.totalPagar ?? 0)}
            </p>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center">
            {isPositive ? <TrendingUp size={32} className="text-white" /> : <TrendingDown size={32} className="text-white" />}
          </div>
        </div>
      </div>

      {/* ─── Summary Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "A Receber", value: brl(fin?.totalReceber ?? 0), icon: <Wallet size={18} />, bg: "bg-emerald-50", text: "text-emerald-600", iconColor: "text-emerald-400" },
          { label: "A Pagar", value: brl(fin?.totalPagar ?? 0), icon: <DollarSign size={18} />, bg: "bg-rose-50", text: "text-rose-600", iconColor: "text-rose-400" },
          { label: "Recebido", value: brl(fin?.recebido ?? 0), icon: <CheckCircle2 size={18} />, bg: "bg-blue-50", text: "text-blue-600", iconColor: "text-blue-400" },
          { label: "Inadimplência", value: brl(fin?.vencidos ?? 0), icon: <AlertTriangle size={18} />, bg: (fin?.vencidos ?? 0) > 0 ? "bg-red-50" : "bg-slate-50", text: (fin?.vencidos ?? 0) > 0 ? "text-red-600" : "text-slate-400", iconColor: (fin?.vencidos ?? 0) > 0 ? "text-red-400" : "text-slate-300" },
        ].map(({ label, value, icon, bg, text, iconColor }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-sm transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
                <span className={iconColor}>{icon}</span>
              </div>
              <span className="text-sm text-slate-500 font-medium">{label}</span>
            </div>
            <p className={`text-xl font-bold tabular-nums ${text}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ─── Tables ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* A vencer */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Clock size={16} className="text-amber-500" />
              </div>
              <h2 className="font-semibold text-slate-800">A vencer (7 dias)</h2>
            </div>
          </div>
          {contasVencer && contasVencer.length > 0 ? (
            <div className="space-y-1">
              {contasVencer.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{c.clientes?.nome_fantasia || "—"}</p>
                    <p className="text-xs text-slate-400">{c.data_vencimento}</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-amber-600 ml-3">{brl(Number(c.valor_original) || 0)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle2 size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Sem vencimentos esta semana</p>
            </div>
          )}
        </div>

        {/* Inadimplentes */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <AlertTriangle size={16} className="text-red-500" />
              </div>
              <h2 className="font-semibold text-slate-800">Títulos vencidos</h2>
            </div>
          </div>
          {vencidos && vencidos.length > 0 ? (
            <div className="space-y-1">
              {vencidos.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{c.clientes?.nome_fantasia || "—"}</p>
                    <p className="text-xs text-red-400">Venceu em {c.data_vencimento}</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-red-600 ml-3">{brl(Number(c.valor_original) || 0)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle2 size={32} className="text-emerald-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Nenhum título vencido</p>
              <p className="text-xs text-emerald-400 mt-1">Tudo em dia!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
