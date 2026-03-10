import React from "react";
import {
  Building2, UserPlus, TrendingUp, FileText, Package, Factory,
  Truck, ShoppingCart, Wallet, DollarSign, AlertTriangle, Wrench,
  Target, Clock, BarChart3, CheckCircle2,
} from "lucide-react";
import KpiCard from "@/shared/components/KpiCard";
import { brl as formatBRL } from "@/shared/utils/format";
import {
  useDashComercial, useDashPedidos, useDashProducao,
  useDashFinanceiro, useDashInstalacoes, useDashEstoque, useDashQualidade,
} from "../hooks/useDashboardStats";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-32 truncate">{label}</span>
      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-700 w-6 text-right tabular-nums">{value}</span>
    </div>
  );
}

function ActivityRow({ title, subtitle, time, type }: { title: string; subtitle: string; time: string; type: string }) {
  const colors: Record<string, string> = {
    lead: "bg-emerald-100 text-emerald-600",
    pedido: "bg-amber-100 text-amber-600",
    financeiro: "bg-green-100 text-green-600",
    producao: "bg-orange-100 text-orange-600",
  };
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${colors[type] || "bg-slate-100 text-slate-600"}`}>
        {type.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">{title}</p>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>
      <span className="text-xs text-slate-400 whitespace-nowrap">{time}</span>
    </div>
  );
}

export default function DashboardDiretor() {
  const { data: comercial, isLoading: lC } = useDashComercial();
  const { data: pedidos, isLoading: lP } = useDashPedidos();
  const { data: producao, isLoading: lPr } = useDashProducao();
  const { data: fin, isLoading: lF } = useDashFinanceiro();
  const { data: inst } = useDashInstalacoes();
  const { data: estoque } = useDashEstoque();
  const { data: qual } = useDashQualidade();

  const { data: recentLeads } = useQuery({
    queryKey: ["dash", "recent-leads"],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("id, empresa, status, created_at").order("created_at", { ascending: false }).limit(5);
      return data || [];
    },
  });

  const { data: recentPedidos } = useQuery({
    queryKey: ["dash", "recent-pedidos"],
    queryFn: async () => {
      const { data } = await supabase.from("pedidos").select("id, numero, status, valor_total, created_at, clientes(nome_fantasia)").is("excluido_em", null).order("created_at", { ascending: false }).limit(5);
      return data || [];
    },
  });

  const pedidoBreakdown = pedidos?.byStatus ?? {};
  const maxStatus = Math.max(...Object.values(pedidoBreakdown), 1);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Painel Executivo</h1>
        <p className="text-slate-500 mt-1">Visão 360° — Croma Print Comunicação Visual</p>
      </div>

      {/* Comercial */}
      <section>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Target size={13} /> Comercial
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Clientes ativos" value={comercial?.totalClientes ?? "—"} subtitle={`+${comercial?.novosClientes30d ?? 0} últimos 30 dias`} icon={<Building2 size={20} />} color="blue" loading={lC} />
          <KpiCard title="Leads em aberto" value={comercial?.leadsAtivos ?? "—"} icon={<UserPlus size={20} />} color="green" loading={lC} />
          <KpiCard title="Pipeline ativo" value={comercial?.pipeline ? formatBRL(comercial.pipeline) : "—"} subtitle="Valor estimado" icon={<TrendingUp size={20} />} color="purple" loading={lC} />
          <KpiCard title="Propostas" value={comercial?.totalPropostas ?? "—"} subtitle={`${comercial?.propostasPendentes ?? 0} pendentes · ${comercial?.propostasAprovadas ?? 0} aprovadas`} icon={<FileText size={20} />} color="amber" loading={lC} />
        </div>
      </section>

      {/* Operacional */}
      <section>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Factory size={13} /> Operacional
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Pedidos ativos" value={pedidos?.ativos ?? "—"}
            subtitle={pedidos?.atrasados ? `${pedidos.atrasados} em atraso ⚠️` : "Todos no prazo ✓"}
            icon={<Package size={20} />} color="indigo"
            trend={pedidos?.atrasados ? "down" : "up"}
            trendValue={pedidos?.atrasados ? `${pedidos.atrasados} atraso` : "OK"}
            loading={lP}
          />
          <KpiCard
            title="Produção ativa" value={producao?.emProducao ?? "—"}
            subtitle={`${producao?.aguardando ?? 0} aguardando · ${producao?.liberadas ?? 0} liberadas`}
            icon={<Factory size={20} />} color="orange"
            trend={producao?.atrasadas ? "down" : undefined}
            trendValue={producao?.atrasadas ? `${producao.atrasadas} atraso` : undefined}
            loading={lPr}
          />
          <KpiCard title="Instalações hoje" value={inst?.agendadasHoje ?? "—"} subtitle={`${inst?.aguardando ?? 0} aguardando · ${inst?.emExecucao ?? 0} em campo`} icon={<Truck size={20} />} color="cyan" />
          <KpiCard
            title="Estoque" value={estoque?.total ?? "—"}
            subtitle={estoque?.criticos ? `${estoque.criticos} materiais em alerta ⚠️` : "Todos OK ✓"}
            icon={<ShoppingCart size={20} />}
            color={estoque?.criticos ? "red" : "teal"}
            trend={estoque?.criticos ? "down" : undefined}
            trendValue={estoque?.criticos ? `${estoque.criticos} críticos` : undefined}
          />
        </div>
      </section>

      {/* Financeiro */}
      <section>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <DollarSign size={13} /> Financeiro
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="A Receber" value={fin?.totalReceber ? formatBRL(fin.totalReceber) : "—"} icon={<Wallet size={20} />} color="green" loading={lF} />
          <KpiCard title="A Pagar" value={fin?.totalPagar ? formatBRL(fin.totalPagar) : "—"} icon={<DollarSign size={20} />} color="rose" loading={lF} />
          <KpiCard title="Saldo Projetado" value={fin?.saldo !== undefined ? formatBRL(fin.saldo) : "—"} icon={<TrendingUp size={20} />} color={(fin?.saldo ?? 0) >= 0 ? "blue" : "red"} loading={lF} />
          <KpiCard title="Inadimplência" value={fin?.vencidos ? formatBRL(fin.vencidos) : "R$ 0"} icon={<AlertTriangle size={20} />} color={fin?.vencidos && fin.vencidos > 0 ? "red" : "slate"} trend={fin?.vencidos && fin.vencidos > 0 ? "down" : undefined} trendValue={fin?.vencidos && fin.vencidos > 0 ? "Vencido" : undefined} loading={lF} />
        </div>
      </section>

      {/* Details row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-indigo-500" />
            <h2 className="font-semibold text-slate-800 text-sm">Pedidos por status</h2>
          </div>
          <div className="space-y-2.5">
            {Object.entries(pedidoBreakdown).length > 0 ? (
              Object.entries(pedidoBreakdown).sort(([,a],[,b]) => b - a).map(([status, count]) => (
                <MiniBar key={status} label={status.replace(/_/g, " ")} value={count} max={maxStatus}
                  color={status === "concluido" ? "bg-emerald-500" : status === "cancelado" ? "bg-red-400" : status.includes("producao") ? "bg-orange-400" : status.includes("instalacao") ? "bg-cyan-400" : "bg-blue-400"}
                />
              ))
            ) : (
              <p className="text-sm text-slate-400 py-6 text-center">Nenhum pedido ainda</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target size={16} className="text-emerald-500" />
            <h2 className="font-semibold text-slate-800 text-sm">Leads recentes</h2>
          </div>
          {recentLeads && recentLeads.length > 0 ? (
            recentLeads.map((lead: any) => (
              <ActivityRow key={lead.id} title={lead.empresa} subtitle={lead.status} time={timeAgo(lead.created_at)} type="lead" />
            ))
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">Nenhum lead cadastrado</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-amber-500" />
            <h2 className="font-semibold text-slate-800 text-sm">Pedidos recentes</h2>
          </div>
          {recentPedidos && recentPedidos.length > 0 ? (
            recentPedidos.map((ped: any) => (
              <ActivityRow key={ped.id}
                title={`${ped.numero || "—"} — ${ped.clientes?.nome_fantasia || "Cliente"}`}
                subtitle={`${ped.status?.replace(/_/g, " ")} · ${formatBRL(Number(ped.valor_total) || 0)}`}
                time={timeAgo(ped.created_at)} type="pedido"
              />
            ))
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">Nenhum pedido</p>
          )}
        </div>
      </div>

      {/* Quality + Producao summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={16} className="text-orange-500" />
            <h2 className="font-semibold text-slate-800 text-sm">Produção</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Aguardando", value: producao?.aguardando ?? 0, cls: "bg-amber-50 text-amber-700" },
              { label: "Em Produção", value: producao?.emProducao ?? 0, cls: "bg-orange-50 text-orange-700" },
              { label: "Liberadas", value: producao?.liberadas ?? 0, cls: "bg-emerald-50 text-emerald-700" },
              { label: "Em Atraso", value: producao?.atrasadas ?? 0, cls: producao?.atrasadas ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-400" },
            ].map(({ label, value, cls }) => (
              <div key={label} className={`p-3 rounded-xl text-center ${cls.split(" ")[0]}`}>
                <p className={`text-xl font-bold tabular-nums ${cls.split(" ")[1]}`}>{value}</p>
                <p className={`text-xs ${cls.split(" ")[1]}`}>{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wrench size={16} className="text-red-500" />
            <h2 className="font-semibold text-slate-800 text-sm">Qualidade & Ocorrências</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Ocorrências abertas", value: qual?.abertas ?? 0, cls: "bg-amber-50 text-amber-700" },
              { label: "Críticas", value: qual?.criticas ?? 0, cls: qual?.criticas ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-400" },
              { label: "Retrabalhos", value: qual?.retrabalhos ?? 0, cls: "bg-orange-50 text-orange-700" },
              { label: "Total histórico", value: qual?.total ?? 0, cls: "bg-slate-50 text-slate-600" },
            ].map(({ label, value, cls }) => (
              <div key={label} className={`p-3 rounded-xl text-center ${cls.split(" ")[0]}`}>
                <p className={`text-xl font-bold tabular-nums ${cls.split(" ")[1]}`}>{value}</p>
                <p className={`text-xs ${cls.split(" ")[1]}`}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
