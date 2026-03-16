import React from "react";
import { Link } from "react-router-dom";
/** @deprecated Use AISidebar instead */
import ProblemasPanel from '@/domains/ai/components/ProblemasPanel';
import AIButton from '@/domains/ai/components/AIButton';
import AISidebar from '@/domains/ai/components/AISidebar';
import { useAISidebar } from '@/domains/ai/hooks/useAISidebar';
import { useDetectarProblemas } from '@/domains/ai/hooks/useDetectarProblemas';
import { ProgressTracker } from "@/shared/components/ProgressTracker";
import {
  Building2, UserPlus, TrendingUp, FileText, Package, Factory,
  Truck, Wallet, DollarSign, AlertTriangle, Wrench,
  ArrowRight, Plus, Calendar, BarChart3, Target,
  ShoppingCart, CheckCircle2, Clock, Activity, Zap,
} from "lucide-react";
import { brl as formatBRL } from "@/shared/utils/format";
import {
  useDashComercial, useDashPedidos, useDashProducao,
  useDashFinanceiro, useDashInstalacoes, useDashEstoque, useDashQualidade,
} from "../hooks/useDashboardStats";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ──────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                 */
/* ──────────────────────────────────────────────────────────────────────── */

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatDate() {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Hero KPI Card — large, impactful metric                                */
/* ──────────────────────────────────────────────────────────────────────── */

interface HeroKpiProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  gradient: string;
  iconBg: string;
  loading?: boolean;
  alert?: boolean;
  to?: string;
}

function HeroKpi({ label, value, subtitle, icon, gradient, iconBg, loading, alert, to }: HeroKpiProps) {
  const content = (
    <div className={`relative overflow-hidden rounded-2xl p-5 ${gradient} group transition-all duration-200 ${to ? "cursor-pointer hover:shadow-lg hover:scale-[1.02]" : ""}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white/80 mb-1">{label}</p>
          {loading ? (
            <div className="h-9 w-24 bg-white/20 rounded-lg animate-pulse" />
          ) : (
            <p className="text-3xl font-bold text-white tabular-nums leading-none tracking-tight">
              {value}
            </p>
          )}
          {subtitle && (
            <p className="text-xs text-white/70 mt-2 leading-relaxed">{subtitle}</p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
      </div>
      {alert && (
        <div className="absolute top-3 right-3 w-2.5 h-2.5 bg-yellow-300 rounded-full animate-pulse" />
      )}
    </div>
  );

  if (to) {
    return <Link to={to}>{content}</Link>;
  }
  return content;
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Metric Pill — compact secondary metric                                 */
/* ──────────────────────────────────────────────────────────────────────── */

interface MetricPillProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
  alert?: boolean;
  to?: string;
}

function MetricPill({ label, value, icon, color = "text-slate-600", alert, to }: MetricPillProps) {
  const content = (
    <div className={`flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all ${to ? "cursor-pointer" : ""}`}>
      <div className="text-slate-400 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 leading-tight">{label}</p>
        <p className={`text-sm font-bold tabular-nums ${color}`}>{value}</p>
      </div>
      {alert && <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse shrink-0" />}
    </div>
  );

  if (to) return <Link to={to}>{content}</Link>;
  return content;
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Status Bar — horizontal status visualization                           */
/* ──────────────────────────────────────────────────────────────────────── */

function StatusBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
        {segments.filter((s) => s.value > 0).map((seg, i) => (
          <div
            key={i}
            className={`${seg.color} transition-all duration-500`}
            style={{ width: `${(seg.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.filter((s) => s.value > 0).map((seg, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${seg.color}`} />
            <span className="text-xs text-slate-500">{seg.label} <span className="font-semibold text-slate-700">{seg.value}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Activity Item                                                           */
/* ──────────────────────────────────────────────────────────────────────── */

function ActivityItem({ title, subtitle, time, type }: { title: string; subtitle: string; time: string; type: string }) {
  const config: Record<string, { bg: string; icon: React.ReactNode }> = {
    lead: { bg: "bg-emerald-50", icon: <UserPlus size={14} className="text-emerald-500" /> },
    pedido: { bg: "bg-blue-50", icon: <Package size={14} className="text-blue-500" /> },
    financeiro: { bg: "bg-green-50", icon: <DollarSign size={14} className="text-green-500" /> },
    producao: { bg: "bg-orange-50", icon: <Factory size={14} className="text-orange-500" /> },
  };

  const c = config[type] || { bg: "bg-slate-50", icon: <Activity size={14} className="text-slate-400" /> };

  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${c.bg}`}>
        {c.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 truncate font-medium">{title}</p>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>
      <span className="text-[11px] text-slate-400 tabular-nums whitespace-nowrap">{time}</span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Quick Action Button                                                    */
/* ──────────────────────────────────────────────────────────────────────── */

function QuickAction({ label, icon, to }: { label: string; icon: React.ReactNode; to: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all"
    >
      {icon}
      {label}
    </Link>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  MAIN DASHBOARD                                                         */
/* ──────────────────────────────────────────────────────────────────────── */

export default function DashboardDiretor() {
  const detectarProblemas = useDetectarProblemas();
  const aiSidebar = useAISidebar({
    entityType: 'geral',
    entityId: 'dashboard',
  });

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
  const pedidoSegments = Object.entries(pedidoBreakdown)
    .sort(([, a], [, b]) => b - a)
    .map(([status, count]) => ({
      label: status.replace(/_/g, " "),
      value: count,
      color: status === "concluido" ? "bg-emerald-500"
        : status === "cancelado" ? "bg-red-400"
        : status.includes("producao") ? "bg-orange-400"
        : status.includes("instalacao") ? "bg-cyan-400"
        : "bg-blue-400",
    }));

  const hasAlerts = (pedidos?.atrasados ?? 0) > 0 || (estoque?.criticos ?? 0) > 0 || (qual?.criticas ?? 0) > 0;

  return (
    <div className="space-y-6 max-w-[1200px]">

      {/* ─── Header: Greeting + Quick Actions ─── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{getGreeting()} 👋</h1>
          <p className="text-sm text-slate-400 mt-0.5 flex items-center gap-1.5">
            <Calendar size={13} />
            {formatDate()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QuickAction label="Novo Lead" icon={<Plus size={15} />} to="/leads" />
          <QuickAction label="Nova Proposta" icon={<FileText size={15} />} to="/orcamentos" />
          <QuickAction label="Novo Pedido" icon={<Package size={15} />} to="/pedidos" />
        </div>
      </div>

      {/* ─── Alert Banner (conditional) ─── */}
      {hasAlerts && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle size={18} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700 flex-1">
            {[
              pedidos?.atrasados ? `${pedidos.atrasados} pedido(s) em atraso` : null,
              estoque?.criticos ? `${estoque.criticos} material(is) com estoque crítico` : null,
              qual?.criticas ? `${qual.criticas} ocorrência(s) crítica(s)` : null,
            ].filter(Boolean).join(" · ")}
          </p>
        </div>
      )}

      {/* ─── Hero KPIs — 4 big cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroKpi
          label="Faturamento Previsto"
          value={fin?.totalReceber ? formatBRL(fin.totalReceber) : "R$ 0"}
          subtitle={fin?.vencidos && fin.vencidos > 0 ? `${formatBRL(fin.vencidos)} em atraso` : "Tudo em dia"}
          icon={<Wallet size={24} className="text-white" />}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
          iconBg="bg-white/20"
          loading={lF}
          alert={fin?.vencidos ? fin.vencidos > 0 : false}
          to="/financeiro"
        />
        <HeroKpi
          label="Pipeline Comercial"
          value={comercial?.pipeline ? formatBRL(comercial.pipeline) : "R$ 0"}
          subtitle={`${comercial?.leadsAtivos ?? 0} leads · ${comercial?.propostasPendentes ?? 0} propostas`}
          icon={<TrendingUp size={24} className="text-white" />}
          gradient="bg-gradient-to-br from-blue-500 to-blue-600"
          iconBg="bg-white/20"
          loading={lC}
          to="/pipeline"
        />
        <HeroKpi
          label="Pedidos Ativos"
          value={pedidos?.ativos ?? 0}
          subtitle={pedidos?.atrasados ? `${pedidos.atrasados} em atraso` : pedidos?.ativos ? "Todos no prazo" : "Nenhum pedido em andamento"}
          icon={<Package size={24} className="text-white" />}
          gradient="bg-gradient-to-br from-indigo-500 to-indigo-600"
          iconBg="bg-white/20"
          loading={lP}
          alert={(pedidos?.atrasados ?? 0) > 0}
          to="/pedidos"
        />
        <HeroKpi
          label="Produção"
          value={producao?.emProducao ?? 0}
          subtitle={`${(producao?.aguardando ?? 0) + (producao?.emFila ?? 0)} na fila · ${producao?.liberadas ?? 0} liberadas`}
          icon={<Factory size={24} className="text-white" />}
          gradient="bg-gradient-to-br from-orange-500 to-orange-600"
          iconBg="bg-white/20"
          loading={lPr}
          alert={(producao?.atrasadas ?? 0) > 0}
          to="/producao"
        />
      </div>

      {/* ─── Secondary Metrics Strip ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricPill label="Clientes" value={comercial?.totalClientes ?? 0} icon={<Building2 size={16} />} to="/clientes" />
        <MetricPill label="Leads" value={comercial?.leadsAtivos ?? 0} icon={<UserPlus size={16} />} color={comercial?.leadsAtivos ? "text-emerald-600" : "text-slate-400"} to="/leads" />
        <MetricPill label="Propostas" value={comercial?.totalPropostas ?? 0} icon={<FileText size={16} />} to="/orcamentos" />
        <MetricPill label="Instalações" value={inst?.agendadasHoje ?? 0} icon={<Truck size={16} />} to="/instalacoes" />
        <MetricPill label="Estoque" value={estoque?.total ?? 0} icon={<ShoppingCart size={16} />} alert={(estoque?.criticos ?? 0) > 0} to="/estoque" />
        <MetricPill label="Ocorrências" value={qual?.abertas ?? 0} icon={<Wrench size={16} />} color={qual?.criticas ? "text-red-600" : "text-slate-600"} alert={(qual?.criticas ?? 0) > 0} to="/ocorrencias" />
      </div>

      {/* ─── ERP Progress Widget ─── */}
      <ProgressTracker compact />

      {/* ─── Main Content: 2 columns ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left column (3/5): Activity + Pedido Status */}
        <div className="lg:col-span-3 space-y-6">

          {/* Pedidos por status */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <BarChart3 size={16} className="text-indigo-500" />
                </div>
                <h2 className="font-semibold text-slate-800">Pedidos por Status</h2>
              </div>
              <Link to="/pedidos" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                Ver todos <ArrowRight size={12} />
              </Link>
            </div>
            {pedidoSegments.length > 0 ? (
              <StatusBar segments={pedidoSegments} />
            ) : (
              <div className="text-center py-8">
                <Package size={32} className="text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Nenhum pedido registrado</p>
                <Link to="/pedidos" className="text-xs text-blue-500 hover:underline mt-1 inline-block">
                  Criar primeiro pedido
                </Link>
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                  <Activity size={16} className="text-slate-500" />
                </div>
                <h2 className="font-semibold text-slate-800">Atividade Recente</h2>
              </div>
            </div>
            <div>
              {recentLeads && recentLeads.length > 0 && recentLeads.map((lead: any) => (
                <ActivityItem
                  key={`lead-${lead.id}`}
                  title={lead.empresa}
                  subtitle={`Lead · ${lead.status?.replace(/_/g, " ")}`}
                  time={timeAgo(lead.created_at)}
                  type="lead"
                />
              ))}
              {recentPedidos && recentPedidos.length > 0 && recentPedidos.map((ped: any) => (
                <ActivityItem
                  key={`ped-${ped.id}`}
                  title={`${ped.numero || "Pedido"} — ${ped.clientes?.nome_fantasia || "Cliente"}`}
                  subtitle={`${ped.status?.replace(/_/g, " ")} · ${formatBRL(Number(ped.valor_total) || 0)}`}
                  time={timeAgo(ped.created_at)}
                  type="pedido"
                />
              ))}
              {(!recentLeads || recentLeads.length === 0) && (!recentPedidos || recentPedidos.length === 0) && (
                <div className="text-center py-8">
                  <Zap size={32} className="text-slate-200 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">Nenhuma atividade recente</p>
                  <p className="text-xs text-slate-300 mt-1">Cadastre leads e pedidos para ver aqui</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column (2/5): Financeiro + Produção + Qualidade */}
        <div className="lg:col-span-2 space-y-6">

          {/* Financeiro Summary */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <DollarSign size={16} className="text-emerald-500" />
                </div>
                <h2 className="font-semibold text-slate-800">Financeiro</h2>
              </div>
              <Link to="/financeiro" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                Detalhes <ArrowRight size={12} />
              </Link>
            </div>
            <div className="space-y-3">
              {[
                { label: "A Receber", value: formatBRL(fin?.totalReceber ?? 0), color: "text-emerald-600", dotColor: "bg-emerald-400" },
                { label: "A Pagar", value: formatBRL(fin?.totalPagar ?? 0), color: "text-rose-600", dotColor: "bg-rose-400" },
                { label: "Saldo Projetado", value: formatBRL(fin?.saldo ?? 0), color: (fin?.saldo ?? 0) >= 0 ? "text-blue-600" : "text-red-600", dotColor: (fin?.saldo ?? 0) >= 0 ? "bg-blue-400" : "bg-red-400" },
                { label: "Inadimplência", value: formatBRL(fin?.vencidos ?? 0), color: (fin?.vencidos ?? 0) > 0 ? "text-red-600" : "text-slate-400", dotColor: (fin?.vencidos ?? 0) > 0 ? "bg-red-400" : "bg-slate-200" },
              ].map(({ label, value, color, dotColor }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                    <span className="text-sm text-slate-500">{label}</span>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Produção Snapshot */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                  <Factory size={16} className="text-orange-500" />
                </div>
                <h2 className="font-semibold text-slate-800">Produção</h2>
              </div>
              <Link to="/producao" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                Painel <ArrowRight size={12} />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Na fila", value: (producao?.aguardando ?? 0) + (producao?.emFila ?? 0), bg: "bg-amber-50", text: "text-amber-600", icon: <Clock size={14} className="text-amber-400" /> },
                { label: "Produzindo", value: producao?.emProducao ?? 0, bg: "bg-orange-50", text: "text-orange-600", icon: <Factory size={14} className="text-orange-400" /> },
                { label: "Liberadas", value: producao?.liberadas ?? 0, bg: "bg-emerald-50", text: "text-emerald-600", icon: <CheckCircle2 size={14} className="text-emerald-400" /> },
                { label: "Atrasadas", value: producao?.atrasadas ?? 0, bg: (producao?.atrasadas ?? 0) > 0 ? "bg-red-50" : "bg-slate-50", text: (producao?.atrasadas ?? 0) > 0 ? "text-red-600" : "text-slate-300", icon: <AlertTriangle size={14} className={(producao?.atrasadas ?? 0) > 0 ? "text-red-400" : "text-slate-300"} /> },
              ].map(({ label, value, bg, text, icon }) => (
                <div key={label} className={`${bg} rounded-xl p-3 flex items-center gap-3`}>
                  {icon}
                  <div>
                    <p className={`text-lg font-bold tabular-nums ${text}`}>{value}</p>
                    <p className="text-[11px] text-slate-400">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Qualidade */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                  <Target size={16} className="text-red-500" />
                </div>
                <h2 className="font-semibold text-slate-800">Qualidade</h2>
              </div>
              <Link to="/ocorrencias" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                Ver <ArrowRight size={12} />
              </Link>
            </div>
            <div className="flex items-center justify-between text-center">
              {[
                { label: "Abertas", value: qual?.abertas ?? 0, color: (qual?.abertas ?? 0) > 0 ? "text-amber-600" : "text-slate-300" },
                { label: "Críticas", value: qual?.criticas ?? 0, color: (qual?.criticas ?? 0) > 0 ? "text-red-600" : "text-slate-300" },
                { label: "Retrabalhos", value: qual?.retrabalhos ?? 0, color: (qual?.retrabalhos ?? 0) > 0 ? "text-orange-600" : "text-slate-300" },
              ].map(({ label, value, color }, i) => (
                <React.Fragment key={label}>
                  {i > 0 && <div className="w-px h-10 bg-slate-100" />}
                  <div className="flex-1">
                    <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{label}</p>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>

        </div>

        {/* AI Alertas Operacionais */}
        <div className="mt-6 flex justify-end">
          <AIButton
            label="Detectar Problemas"
            onClick={(model) => {
              detectarProblemas.mutate({ mode: 'manual', model }, {
                onSuccess: (data) => aiSidebar.open(data),
              });
            }}
            isLoading={detectarProblemas.isPending}
          />
        </div>
      </div>

      <AISidebar
        isOpen={aiSidebar.isOpen}
        response={aiSidebar.response}
        isLoading={detectarProblemas.isPending}
        onClose={aiSidebar.close}
        onApply={aiSidebar.applyActions}
        onReanalyze={() => detectarProblemas.mutate({ mode: 'manual', model: undefined }, {
          onSuccess: (data) => aiSidebar.setResponse(data),
        })}
        isReanalyzing={detectarProblemas.isPending}
        title="Problemas Detectados"
      />
    </div>
  );
}
