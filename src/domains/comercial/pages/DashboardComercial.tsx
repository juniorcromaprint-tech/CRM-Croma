import React from "react";
import { Link } from "react-router-dom";
import {
  UserPlus, FileText, TrendingUp, Building2, Clock, ArrowRight,
  Calculator, Plus, Target, Phone, Calendar, Zap,
} from "lucide-react";
import { brl } from "@/shared/utils/format";
import { useDashComercial, useFunnelStats } from "../hooks/useDashboardStats";
import FunnelCard from "../components/FunnelCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ──────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                 */
/* ──────────────────────────────────────────────────────────────────────── */

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function formatDate() {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  KPI Ring — circular progress indicator                                 */
/* ──────────────────────────────────────────────────────────────────────── */

function KpiRing({ label, value, subtitle, color, icon }: {
  label: string;
  value: string | number;
  subtitle?: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-sm transition-all">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <span className="text-sm text-slate-500 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-800 tabular-nums">{value}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Status Colors                                                          */
/* ──────────────────────────────────────────────────────────────────────── */

const statusColors: Record<string, string> = {
  rascunho: "bg-slate-100 text-slate-600",
  enviada: "bg-blue-100 text-blue-700",
  em_revisao: "bg-amber-100 text-amber-700",
  aprovada: "bg-emerald-100 text-emerald-700",
  recusada: "bg-red-100 text-red-700",
};

const prioridadeColors: Record<string, string> = {
  urgente: "bg-red-500",
  alta: "bg-amber-500",
  normal: "bg-blue-500",
  baixa: "bg-slate-300",
};

/* ──────────────────────────────────────────────────────────────────────── */
/*  MAIN                                                                   */
/* ──────────────────────────────────────────────────────────────────────── */

export default function DashboardComercial() {
  const { data: comercial, isLoading } = useDashComercial();
  const { data: funil } = useFunnelStats();

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

  return (
    <div className="space-y-6 max-w-[1200px]">

      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{getGreeting()}, Comercial 🎯</h1>
          <p className="text-sm text-slate-400 mt-0.5 flex items-center gap-1.5">
            <Calendar size={13} />
            {formatDate()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/leads" className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus size={15} /> Novo Lead
          </Link>
          <Link to="/orcamentos" className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all">
            <FileText size={15} /> Nova Proposta
          </Link>
        </div>
      </div>

      {/* ─── KPIs ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiRing
          label="Clientes ativos"
          value={isLoading ? "—" : (comercial?.totalClientes ?? 0)}
          subtitle={`+${comercial?.novosClientes30d ?? 0} este mês`}
          color="bg-blue-50 text-blue-500"
          icon={<Building2 size={20} />}
        />
        <KpiRing
          label="Leads ativos"
          value={isLoading ? "—" : (comercial?.leadsAtivos ?? 0)}
          color="bg-emerald-50 text-emerald-500"
          icon={<UserPlus size={20} />}
        />
        <KpiRing
          label="Pipeline"
          value={isLoading ? "—" : (comercial?.pipeline ? brl(comercial.pipeline) : "R$ 0")}
          subtitle="Valor total estimado"
          color="bg-purple-50 text-purple-500"
          icon={<TrendingUp size={20} />}
        />
        <KpiRing
          label="Propostas pendentes"
          value={isLoading ? "—" : (comercial?.propostasPendentes ?? 0)}
          subtitle={`${comercial?.propostasAprovadas ?? 0} aprovadas`}
          color="bg-amber-50 text-amber-500"
          icon={<Calculator size={20} />}
        />
      </div>

      {/* ─── Funil de Conversão ─── */}
      {funil && <FunnelCard data={funil} />}

      {/* ─── Content: Propostas + Tarefas ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Propostas */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <FileText size={16} className="text-blue-500" />
              </div>
              <h2 className="font-semibold text-slate-800">Propostas em aberto</h2>
            </div>
            <Link to="/orcamentos" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              Ver todas <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-1">
            {propostasRecentes && propostasRecentes.length > 0 ? (
              propostasRecentes.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{p.titulo || p.numero}</p>
                    <p className="text-xs text-slate-400">{p.clientes?.nome_fantasia || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <span className="text-sm font-bold tabular-nums text-slate-700">{brl(Number(p.total) || 0)}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusColors[p.status] || "bg-slate-100 text-slate-600"}`}>
                      {p.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <FileText size={32} className="text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Nenhuma proposta pendente</p>
                <Link to="/orcamentos" className="text-xs text-blue-500 hover:underline mt-1 inline-block">
                  Criar proposta
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Tarefas */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Clock size={16} className="text-amber-500" />
              </div>
              <h2 className="font-semibold text-slate-800">Tarefas do dia</h2>
            </div>
          </div>
          {tarefas && tarefas.length > 0 ? (
            <div className="space-y-1">
              {tarefas.map((t: any) => (
                <div key={t.id} className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${prioridadeColors[t.prioridade] || "bg-blue-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{t.titulo}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      {t.tipo === "ligacao" ? <Phone size={10} /> : t.tipo === "visita" ? <Target size={10} /> : <Clock size={10} />}
                      {t.data_prevista} · {t.tipo?.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Zap size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Nenhuma tarefa pendente</p>
              <p className="text-xs text-slate-300 mt-1">Suas tarefas aparecerão aqui</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
