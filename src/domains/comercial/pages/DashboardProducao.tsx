import React from "react";
import { Link } from "react-router-dom";
import { Factory, Clock, AlertTriangle, CheckCircle2, Wrench, ArrowRight } from "lucide-react";
import KpiCard from "@/shared/components/KpiCard";
import { useDashProducao, useDashQualidade, useDashEstoque } from "../hooks/useDashboardStats";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function DashboardProducao() {
  const { data: prod, isLoading } = useDashProducao();
  const { data: qual } = useDashQualidade();
  const { data: estoque } = useDashEstoque();

  const { data: opsEmAndamento } = useQuery({
    queryKey: ["dash-prod", "ops-andamento"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ordens_producao")
        .select("id, numero, status, prazo_interno, pedidos(numero, clientes(nome_fantasia))")
        .in("status", ["em_producao", "em_acabamento", "em_fila", "em_conferencia"])
        .is("excluido_em", null)
        .order("prazo_interno")
        .limit(8);
      return data ?? [];
    },
  });

  const { data: opsAtrasadas } = useQuery({
    queryKey: ["dash-prod", "ops-atrasadas"],
    queryFn: async () => {
      const hoje = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("ordens_producao")
        .select("id, numero, status, prazo_interno, pedidos(numero, clientes(nome_fantasia))")
        .lt("prazo_interno", hoje)
        .not("status", "in", "(liberado,finalizado)")
        .is("excluido_em", null)
        .order("prazo_interno")
        .limit(5);
      return data ?? [];
    },
  });

  const statusBadge: Record<string, string> = {
    em_fila: "bg-amber-100 text-amber-700",
    em_producao: "bg-orange-100 text-orange-700",
    em_acabamento: "bg-purple-100 text-purple-700",
    em_conferencia: "bg-blue-100 text-blue-700",
    retrabalho: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Painel de Produção</h1>
          <p className="text-slate-500 mt-1">Ordens de produção, fila e qualidade</p>
        </div>
        <Link to="/producao" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">
          Produção completa <ArrowRight size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Aguardando" value={prod?.aguardando ?? "—"} icon={<Clock size={20} />} color="amber" loading={isLoading} />
        <KpiCard title="Em Produção" value={prod?.emProducao ?? "—"} icon={<Factory size={20} />} color="orange" loading={isLoading} />
        <KpiCard title="Em Conferência" value={prod?.emConferencia ?? "—"} icon={<CheckCircle2 size={20} />} color="blue" loading={isLoading} />
        <KpiCard
          title="Em Atraso" value={prod?.atrasadas ?? "—"}
          icon={<AlertTriangle size={20} />}
          color={prod?.atrasadas ? "red" : "slate"}
          trend={prod?.atrasadas ? "down" : undefined}
          trendValue={prod?.atrasadas ? `${prod.atrasadas} OPs` : undefined}
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KpiCard title="Liberadas" value={prod?.liberadas ?? "—"} icon={<CheckCircle2 size={20} />} color="green" />
        <KpiCard title="Retrabalho" value={prod?.retrabalho ?? "—"} icon={<Wrench size={20} />} color={prod?.retrabalho ? "red" : "slate"} />
        <KpiCard title="Estoque crítico" value={estoque?.criticos ?? "—"} icon={<AlertTriangle size={20} />} color={estoque?.criticos ? "red" : "green"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* OPs em andamento */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Factory size={16} className="text-orange-500" />
            <h2 className="font-semibold text-slate-800 text-sm">OPs em andamento</h2>
          </div>
          {opsEmAndamento && opsEmAndamento.length > 0 ? (
            <div className="space-y-2">
              {opsEmAndamento.map((op: any) => (
                <div key={op.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{op.numero || "OP"} — {op.pedidos?.clientes?.nome_fantasia || "—"}</p>
                    <p className="text-xs text-slate-400">Prazo: {op.prazo_interno || "—"}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-3 shrink-0 ${statusBadge[op.status] || "bg-slate-100 text-slate-600"}`}>
                    {op.status.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-6 text-center">Nenhuma OP em andamento</p>
          )}
        </div>

        {/* OPs atrasadas */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-red-500" />
            <h2 className="font-semibold text-slate-800 text-sm">OPs em atraso</h2>
          </div>
          {opsAtrasadas && opsAtrasadas.length > 0 ? (
            <div className="space-y-2">
              {opsAtrasadas.map((op: any) => (
                <div key={op.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{op.numero} — {op.pedidos?.clientes?.nome_fantasia || "—"}</p>
                    <p className="text-xs text-red-400">Prazo: {op.prazo_interno}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-3 shrink-0 ${statusBadge[op.status] || "bg-red-100 text-red-600"}`}>
                    {op.status.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">Nenhuma OP atrasada</p>
          )}
        </div>
      </div>
    </div>
  );
}
