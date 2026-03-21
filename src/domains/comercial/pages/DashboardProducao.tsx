import React from "react";
import { Link } from "react-router-dom";
import {
  Factory, Clock, AlertTriangle, CheckCircle2, Wrench,
  ArrowRight, Calendar, Zap, ShoppingCart,
} from "lucide-react";
import { useDashProducao, useDashQualidade, useDashEstoque } from "../hooks/useDashboardStats";
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
/*  Status Badge                                                           */
/* ──────────────────────────────────────────────────────────────────────── */

const statusBadge: Record<string, string> = {
  em_fila: "bg-amber-100 text-amber-700",
  em_producao: "bg-orange-100 text-orange-700",
  em_acabamento: "bg-purple-100 text-purple-700",
  em_conferencia: "bg-blue-100 text-blue-700",
  retrabalho: "bg-red-100 text-red-700",
  aguardando_programacao: "bg-slate-100 text-slate-600",
};

/* ──────────────────────────────────────────────────────────────────────── */
/*  Pipeline Step                                                          */
/* ──────────────────────────────────────────────────────────────────────── */

function PipelineStep({ label, value, color, isAlert }: {
  label: string;
  value: number;
  color: string;
  isAlert?: boolean;
}) {
  return (
    <div className="relative flex-1 min-w-[100px] bg-white rounded-2xl border border-slate-100 p-4 text-center hover:shadow-sm transition-all">
      {isAlert && value > 0 && (
        <div className="absolute top-2 right-2 w-2 h-2 bg-red-400 rounded-full animate-pulse" />
      )}
      <p className={`text-3xl font-bold tabular-nums ${value > 0 ? color : "text-slate-200"}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  MAIN                                                                   */
/* ──────────────────────────────────────────────────────────────────────── */

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

  const totalAtivas = (prod?.aguardando ?? 0) + (prod?.emFila ?? 0) + (prod?.emProducao ?? 0) + (prod?.emConferencia ?? 0);

  return (
    <div className="space-y-6 max-w-[1200px]">

      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Painel de Produção 🏭</h1>
          <p className="text-sm text-slate-400 mt-0.5 flex items-center gap-1.5">
            <Calendar size={13} />
            {formatDate()}
          </p>
        </div>
        <Link to="/producao" className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all">
          <Factory size={15} /> Produção completa <ArrowRight size={14} />
        </Link>
      </div>

      {/* ─── Alert Banner ─── */}
      {(prod?.atrasadas ?? 0) > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={18} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700 flex-1 font-medium">
            {prod?.atrasadas} ordem(ns) de produção em atraso!
          </p>
          <Link to="/producao" className="text-xs text-red-600 hover:underline font-medium shrink-0">
            Ver detalhes →
          </Link>
        </div>
      )}

      {/* ─── Production Pipeline ─── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
            <Factory size={16} className="text-orange-500" />
          </div>
          <h2 className="font-semibold text-slate-800">Pipeline de Produção</h2>
          <span className="ml-auto text-sm text-slate-400">{totalAtivas} OPs ativas</span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          <PipelineStep label="Aguardando" value={prod?.aguardando ?? 0} color="text-amber-600" />
          <div className="flex items-center text-slate-200 shrink-0"><ArrowRight size={20} /></div>
          <PipelineStep label="Em Produção" value={prod?.emProducao ?? 0} color="text-orange-600" />
          <div className="flex items-center text-slate-200 shrink-0"><ArrowRight size={20} /></div>
          <PipelineStep label="Conferência" value={prod?.emConferencia ?? 0} color="text-blue-600" />
          <div className="flex items-center text-slate-200 shrink-0"><ArrowRight size={20} /></div>
          <PipelineStep label="Liberadas" value={prod?.liberadas ?? 0} color="text-emerald-600" />
        </div>
      </div>

      {/* ─── Secondary KPIs ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Retrabalho", value: prod?.retrabalho ?? 0, icon: <Wrench size={18} />, bg: (prod?.retrabalho ?? 0) > 0 ? "bg-red-50" : "bg-slate-50", text: (prod?.retrabalho ?? 0) > 0 ? "text-red-600" : "text-slate-300", iconColor: (prod?.retrabalho ?? 0) > 0 ? "text-red-400" : "text-slate-300" },
          { label: "Estoque crítico", value: estoque?.criticos ?? 0, icon: <ShoppingCart size={18} />, bg: (estoque?.criticos ?? 0) > 0 ? "bg-amber-50" : "bg-slate-50", text: (estoque?.criticos ?? 0) > 0 ? "text-amber-600" : "text-slate-300", iconColor: (estoque?.criticos ?? 0) > 0 ? "text-amber-400" : "text-slate-300" },
          { label: "Ocorrências", value: qual?.abertas ?? 0, icon: <AlertTriangle size={18} />, bg: (qual?.abertas ?? 0) > 0 ? "bg-amber-50" : "bg-slate-50", text: (qual?.abertas ?? 0) > 0 ? "text-amber-600" : "text-slate-300", iconColor: (qual?.abertas ?? 0) > 0 ? "text-amber-400" : "text-slate-300" },
          { label: "Em atraso", value: prod?.atrasadas ?? 0, icon: <Clock size={18} />, bg: (prod?.atrasadas ?? 0) > 0 ? "bg-red-50" : "bg-emerald-50", text: (prod?.atrasadas ?? 0) > 0 ? "text-red-600" : "text-emerald-600", iconColor: (prod?.atrasadas ?? 0) > 0 ? "text-red-400" : "text-emerald-400" },
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

        {/* OPs em andamento */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                <Factory size={16} className="text-orange-500" />
              </div>
              <h2 className="font-semibold text-slate-800">OPs em andamento</h2>
            </div>
            <Link to="/producao" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              Ver todas <ArrowRight size={12} />
            </Link>
          </div>
          {opsEmAndamento && opsEmAndamento.length > 0 ? (
            <div className="space-y-1">
              {opsEmAndamento.map((op: any) => (
                <div key={op.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{op.numero || "OP"} — {op.pedidos?.clientes?.nome_fantasia || "—"}</p>
                    <p className="text-xs text-slate-400">Prazo: {op.prazo_interno || "—"}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ml-3 shrink-0 ${statusBadge[op.status] || "bg-slate-100 text-slate-600"}`}>
                    {op.status.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Zap size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Nenhuma OP em andamento</p>
            </div>
          )}
        </div>

        {/* OPs atrasadas */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <AlertTriangle size={16} className="text-red-500" />
              </div>
              <h2 className="font-semibold text-slate-800">OPs em atraso</h2>
            </div>
          </div>
          {opsAtrasadas && opsAtrasadas.length > 0 ? (
            <div className="space-y-1">
              {opsAtrasadas.map((op: any) => (
                <div key={op.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{op.numero} — {op.pedidos?.clientes?.nome_fantasia || "—"}</p>
                    <p className="text-xs text-red-400">Prazo: {op.prazo_interno}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ml-3 shrink-0 ${statusBadge[op.status] || "bg-red-100 text-red-600"}`}>
                    {op.status.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle2 size={32} className="text-emerald-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Nenhuma OP atrasada</p>
              <p className="text-xs text-emerald-400 mt-1">Tudo no prazo!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
