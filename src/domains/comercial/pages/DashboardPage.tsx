import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2,
  UserPlus,
  FileText,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Target,
} from "lucide-react";
import { brl as formatBRL } from "@/shared/utils/format";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color: string;
}

function KPICard({ title, value, subtitle, icon, trend, trendValue, color }: KPICardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
        {trend && trendValue && (
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
            trend === "up" ? "bg-emerald-50 text-emerald-600" :
            trend === "down" ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-500"
          }`}>
            {trend === "up" ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trendValue}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-sm text-slate-500 mt-1">{title}</div>
      {subtitle && <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>}
    </div>
  );
}

function RecentActivityItem({ title, subtitle, time, type }: { title: string; subtitle: string; time: string; type: string }) {
  const colors: Record<string, string> = {
    lead: "bg-emerald-100 text-emerald-600",
    proposta: "bg-blue-100 text-blue-600",
    cliente: "bg-purple-100 text-purple-600",
    pedido: "bg-amber-100 text-amber-600",
  };

  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${colors[type] || "bg-slate-100 text-slate-600"}`}>
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

export default function DashboardPage() {
  // KPIs do banco
  const { data: clienteCount } = useQuery({
    queryKey: ["dashboard", "clientes-count"],
    queryFn: async () => {
      const { count } = await supabase.from("clientes").select("*", { count: "exact", head: true }).eq("ativo", true);
      return count || 0;
    },
  });

  const { data: leadCount } = useQuery({
    queryKey: ["dashboard", "leads-count"],
    queryFn: async () => {
      const { count } = await supabase.from("leads").select("*", { count: "exact", head: true }).not("status", "in", '("convertido","perdido")');
      return count || 0;
    },
  });

  const { data: propostaStats } = useQuery({
    queryKey: ["dashboard", "propostas-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("propostas")
        .select("status, valor_final")
        .is("excluido_em", null);

      const total = data?.length || 0;
      const valorTotal = data?.reduce((sum, p) => sum + (Number(p.valor_final) || 0), 0) || 0;
      const aprovadas = data?.filter(p => p.status === "aprovada").length || 0;
      const pendentes = data?.filter(p => ["enviada", "em_analise"].includes(p.status)).length || 0;

      return { total, valorTotal, aprovadas, pendentes };
    },
  });

  const { data: recentLeads } = useQuery({
    queryKey: ["dashboard", "recent-leads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, empresa, status, temperatura, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const { data: recentPropostas } = useQuery({
    queryKey: ["dashboard", "recent-propostas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("propostas")
        .select("id, numero, status, valor_final, created_at, clientes(nome_fantasia)")
        .is("excluido_em", null)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1">Visão geral do CRM Croma Print</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Clientes ativos"
          value={clienteCount ?? "—"}
          icon={<Building2 size={22} className="text-white" />}
          color="bg-blue-500"
          trend="up"
          trendValue="Rede ativa"
        />
        <KPICard
          title="Leads em aberto"
          value={leadCount ?? "—"}
          icon={<UserPlus size={22} className="text-white" />}
          color="bg-emerald-500"
          subtitle="Excluindo convertidos/perdidos"
        />
        <KPICard
          title="Propostas pendentes"
          value={propostaStats?.pendentes ?? "—"}
          subtitle={`${propostaStats?.total ?? 0} total`}
          icon={<FileText size={22} className="text-white" />}
          color="bg-amber-500"
        />
        <KPICard
          title="Valor em propostas"
          value={propostaStats?.valorTotal ? formatBRL(propostaStats.valorTotal) : "—"}
          subtitle={`${propostaStats?.aprovadas ?? 0} aprovadas`}
          icon={<TrendingUp size={22} className="text-white" />}
          color="bg-purple-500"
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target size={18} className="text-emerald-500" />
            <h2 className="font-semibold text-slate-800">Leads recentes</h2>
          </div>
          {recentLeads && recentLeads.length > 0 ? (
            <div>
              {recentLeads.map((lead) => (
                <RecentActivityItem
                  key={lead.id}
                  title={lead.empresa}
                  subtitle={`${lead.status} · ${lead.temperatura}`}
                  time={timeAgo(lead.created_at)}
                  type="lead"
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">Nenhum lead cadastrado ainda</p>
          )}
        </div>

        {/* Recent Propostas */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-blue-500" />
            <h2 className="font-semibold text-slate-800">Propostas recentes</h2>
          </div>
          {recentPropostas && recentPropostas.length > 0 ? (
            <div>
              {recentPropostas.map((prop: any) => (
                <RecentActivityItem
                  key={prop.id}
                  title={`${prop.numero} — ${prop.clientes?.nome_fantasia || "Cliente"}`}
                  subtitle={`${prop.status} · ${formatBRL(Number(prop.valor_final) || 0)}`}
                  time={timeAgo(prop.created_at)}
                  type="proposta"
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">Nenhuma proposta cadastrada ainda</p>
          )}
        </div>
      </div>
    </div>
  );
}
