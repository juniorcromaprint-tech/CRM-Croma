import React from "react";
import { Link } from "react-router-dom";
import { UserPlus, FileText, TrendingUp, Building2, Clock, ArrowRight, Calculator } from "lucide-react";
import KpiCard from "@/shared/components/KpiCard";
import { brl as formatBRL } from "@/shared/utils/format";
import { useDashComercial } from "../hooks/useDashboardStats";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function DashboardComercial() {
  const { data: comercial, isLoading } = useDashComercial();

  const { data: tarefas } = useQuery({
    queryKey: ["dash-comercial", "tarefas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tarefas_comerciais")
        .select("id, titulo, tipo, data_prevista, prioridade, status")
        .eq("status", "pendente")
        .order("data_prevista")
        .limit(5);
      return data ?? [];
    },
  });

  const { data: propostasRecentes } = useQuery({
    queryKey: ["dash-comercial", "propostas-recentes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("propostas")
        .select("id, numero, titulo, status, total, created_at, clientes(nome_fantasia)")
        .is("excluido_em", null)
        .in("status", ["enviada", "em_revisao", "rascunho"])
        .order("updated_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const statusColors: Record<string, string> = {
    rascunho: "bg-slate-100 text-slate-600",
    enviada: "bg-blue-100 text-blue-700",
    em_revisao: "bg-amber-100 text-amber-700",
    aprovada: "bg-emerald-100 text-emerald-700",
    recusada: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Meu Painel Comercial</h1>
          <p className="text-slate-500 mt-1">Pipeline, propostas e tarefas do dia</p>
        </div>
        <div className="flex gap-2">
          <Link to="/leads" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">
            Leads <ArrowRight size={14} />
          </Link>
          <Link to="/orcamentos" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium ml-4">
            Orçamentos <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Clientes" value={comercial?.totalClientes ?? "—"} subtitle={`+${comercial?.novosClientes30d ?? 0} este mês`} icon={<Building2 size={20} />} color="blue" loading={isLoading} />
        <KpiCard title="Leads ativos" value={comercial?.leadsAtivos ?? "—"} icon={<UserPlus size={20} />} color="green" loading={isLoading} />
        <KpiCard title="Pipeline" value={comercial?.pipeline ? formatBRL(comercial.pipeline) : "—"} icon={<TrendingUp size={20} />} color="purple" loading={isLoading} />
        <KpiCard title="Propostas pendentes" value={comercial?.propostasPendentes ?? "—"} subtitle={`${comercial?.propostasAprovadas ?? 0} aprovadas`} icon={<Calculator size={20} />} color="amber" loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Propostas em aberto */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-blue-500" />
              <h2 className="font-semibold text-slate-800 text-sm">Propostas em aberto</h2>
            </div>
            <Link to="/orcamentos" className="text-xs text-blue-600 hover:underline">Ver todas</Link>
          </div>
          <div className="space-y-2">
            {propostasRecentes && propostasRecentes.length > 0 ? (
              propostasRecentes.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{p.titulo || p.numero}</p>
                    <p className="text-xs text-slate-400">{p.clientes?.nome_fantasia || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <span className="text-sm font-semibold tabular-nums text-slate-700">{formatBRL(Number(p.total) || 0)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[p.status] || "bg-slate-100 text-slate-600"}`}>
                      {p.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 py-6 text-center">Nenhuma proposta pendente</p>
            )}
          </div>
        </div>

        {/* Tarefas pendentes */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-amber-500" />
            <h2 className="font-semibold text-slate-800 text-sm">Próximas tarefas</h2>
          </div>
          {tarefas && tarefas.length > 0 ? (
            <div className="space-y-2">
              {tarefas.map((t: any) => (
                <div key={t.id} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${t.prioridade === "urgente" ? "bg-red-500" : t.prioridade === "alta" ? "bg-amber-500" : "bg-blue-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{t.titulo}</p>
                    <p className="text-xs text-slate-400">{t.data_prevista} · {t.tipo?.replace(/_/g, " ")}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">Nenhuma tarefa pendente</p>
          )}
        </div>
      </div>
    </div>
  );
}
