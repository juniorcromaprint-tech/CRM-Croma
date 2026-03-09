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
  Package,
  Factory,
  Truck,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Wallet,
  ShoppingCart,
  Wrench,
} from "lucide-react";
import { brl as formatBRL, formatDate } from "@/shared/utils/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/* ───────── KPI Card ───────── */
interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color: string;
  onClick?: () => void;
}

function KPICard({ title, value, subtitle, icon, trend, trendValue, color, onClick }: KPICardProps) {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
        {trend && trendValue && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              trend === "up"
                ? "bg-emerald-50 text-emerald-600"
                : trend === "down"
                ? "bg-red-50 text-red-600"
                : "bg-slate-50 text-slate-500"
            }`}
          >
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

/* ───────── Mini bar chart ───────── */
function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-28 truncate">{label}</span>
      <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-700 w-8 text-right">{value}</span>
    </div>
  );
}

/* ───────── Activity Item ───────── */
function ActivityItem({
  title,
  subtitle,
  time,
  type,
}: {
  title: string;
  subtitle: string;
  time: string;
  type: string;
}) {
  const colors: Record<string, string> = {
    lead: "bg-emerald-100 text-emerald-600",
    proposta: "bg-blue-100 text-blue-600",
    cliente: "bg-purple-100 text-purple-600",
    pedido: "bg-amber-100 text-amber-600",
    producao: "bg-orange-100 text-orange-600",
    financeiro: "bg-green-100 text-green-600",
    instalacao: "bg-cyan-100 text-cyan-600",
  };
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${
          colors[type] || "bg-slate-100 text-slate-600"
        }`}
      >
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

/* ───────── Status Pill ───────── */
function StatusPill({ status, count }: { status: string; count: number }) {
  const c: Record<string, string> = {
    rascunho: "bg-slate-100 text-slate-600",
    aguardando_aprovacao: "bg-amber-100 text-amber-700",
    aprovado: "bg-blue-100 text-blue-700",
    em_producao: "bg-orange-100 text-orange-700",
    produzido: "bg-cyan-100 text-cyan-700",
    aguardando_instalacao: "bg-purple-100 text-purple-700",
    em_instalacao: "bg-indigo-100 text-indigo-700",
    concluido: "bg-emerald-100 text-emerald-700",
    cancelado: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${c[status] || "bg-slate-100 text-slate-600"}`}>
      {status.replace(/_/g, " ")} <span className="font-bold">{count}</span>
    </span>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN DASHBOARD
   ═══════════════════════════════════════════════════ */
export default function DashboardPage() {
  /* ---- COMERCIAL ---- */
  const { data: clienteCount } = useQuery({
    queryKey: ["dash", "clientes"],
    queryFn: async () => {
      const { count } = await supabase.from("clientes").select("*", { count: "exact", head: true }).eq("ativo", true);
      return count || 0;
    },
  });

  const { data: leadStats } = useQuery({
    queryKey: ["dash", "leads"],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("status, temperatura, valor_estimado");
      const active = data?.filter((l) => !["convertido", "perdido", "descartado"].includes(l.status)) || [];
      const quentes = active.filter((l) => l.temperatura === "quente").length;
      const pipeline = active.reduce((s, l) => s + (Number(l.valor_estimado) || 0), 0);
      return { total: active.length, quentes, pipeline };
    },
  });

  const { data: propostaStats } = useQuery({
    queryKey: ["dash", "propostas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("propostas")
        .select("status, total")
        .is("excluido_em", null);
      const all = data || [];
      const pendentes = all.filter((p) => ["enviada", "em_revisao", "rascunho"].includes(p.status)).length;
      const aprovadas = all.filter((p) => p.status === "aprovada").length;
      const valorTotal = all.reduce((s, p) => s + (Number(p.total) || 0), 0);
      return { total: all.length, pendentes, aprovadas, valorTotal };
    },
  });

  /* ---- PEDIDOS ---- */
  const { data: pedidoStats } = useQuery({
    queryKey: ["dash", "pedidos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("status, valor_total, data_prometida")
        .is("excluido_em", null);
      const all = data || [];
      const byStatus: Record<string, number> = {};
      let valorTotal = 0;
      let atrasados = 0;
      const now = new Date().toISOString().split("T")[0];
      for (const p of all) {
        byStatus[p.status] = (byStatus[p.status] || 0) + 1;
        valorTotal += Number(p.valor_total) || 0;
        if (p.data_prometida && p.data_prometida < now && !["concluido", "cancelado"].includes(p.status)) {
          atrasados++;
        }
      }
      return { total: all.length, byStatus, valorTotal, atrasados };
    },
  });

  /* ---- PRODUÇÃO ---- */
  const { data: producaoStats } = useQuery({
    queryKey: ["dash", "producao"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ordens_producao")
        .select("status, prazo_interno")
        .is("excluido_em", null);
      const all = data || [];
      const now = new Date().toISOString().split("T")[0];
      const emProducao = all.filter((o) => ["em_producao", "em_acabamento", "em_fila"].includes(o.status)).length;
      const aguardando = all.filter((o) => o.status === "aguardando_programacao").length;
      const liberadas = all.filter((o) => o.status === "liberado").length;
      const atrasadas = all.filter(
        (o) => o.prazo_interno && o.prazo_interno < now && !["liberado", "finalizado"].includes(o.status)
      ).length;
      return { total: all.length, emProducao, aguardando, liberadas, atrasadas };
    },
  });

  /* ---- FINANCEIRO ---- */
  const { data: finStats } = useQuery({
    queryKey: ["dash", "financeiro"],
    queryFn: async () => {
      const { data: cr } = await supabase.from("contas_receber").select("valor_original, valor_pago, status, data_vencimento");
      const { data: cp } = await supabase.from("contas_pagar").select("valor_original, valor_pago, status, data_vencimento");
      const receber = cr || [];
      const pagar = cp || [];
      const now = new Date().toISOString().split("T")[0];

      const totalReceber = receber.filter((r) => !["pago", "cancelado"].includes(r.status)).reduce((s, r) => s + (Number(r.valor_original) || 0) - (Number(r.valor_pago) || 0), 0);
      const totalPagar = pagar.filter((r) => !["pago", "cancelado"].includes(r.status)).reduce((s, r) => s + (Number(r.valor_original) || 0) - (Number(r.valor_pago) || 0), 0);
      const vencidos = receber.filter((r) => r.data_vencimento < now && !["pago", "cancelado"].includes(r.status)).reduce((s, r) => s + (Number(r.valor_original) || 0) - (Number(r.valor_pago) || 0), 0);
      const recebido = receber.reduce((s, r) => s + (Number(r.valor_pago) || 0), 0);

      return { totalReceber, totalPagar, vencidos, recebido, saldo: totalReceber - totalPagar };
    },
  });

  /* ---- ESTOQUE ---- */
  const { data: estoqueStats } = useQuery({
    queryKey: ["dash", "estoque"],
    queryFn: async () => {
      const { data: saldos } = await supabase
        .from("estoque_saldos")
        .select("quantidade_disponivel, quantidade_reservada, materiais(nome, estoque_minimo)")
        ;
      const all = saldos || [];
      const criticos = all.filter((s: any) => {
        const min = Number(s.materiais?.estoque_minimo) || 0;
        const disp = Number(s.quantidade_disponivel) || 0;
        return min > 0 && disp < min;
      }).length;
      return { total: all.length, criticos };
    },
  });

  /* ---- INSTALAÇÕES ---- */
  const { data: instStats } = useQuery({
    queryKey: ["dash", "instalacoes"],
    queryFn: async () => {
      const { data } = await supabase.from("ordens_instalacao").select("status, data_agendada");
      const all = data || [];
      const hoje = new Date().toISOString().split("T")[0];
      const agendadasHoje = all.filter((o) => o.data_agendada === hoje && o.status === "agendada").length;
      const aguardando = all.filter((o) => o.status === "aguardando_agendamento").length;
      const emExecucao = all.filter((o) => o.status === "em_execucao").length;
      const concluidas = all.filter((o) => o.status === "concluida").length;
      return { total: all.length, agendadasHoje, aguardando, emExecucao, concluidas };
    },
  });

  /* ---- QUALIDADE ---- */
  const { data: qualStats } = useQuery({
    queryKey: ["dash", "qualidade"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ocorrencias")
        .select("status, severidade, custo_total, tipo")
        .is("excluido_em", null);
      const all = data || [];
      const abertas = all.filter((o) => ["aberta", "em_analise", "em_tratativa"].includes(o.status)).length;
      const criticas = all.filter((o) => o.severidade === "critica" && o.status !== "encerrada").length;
      const custoTotal = all.reduce((s, o) => s + (Number(o.custo_total) || 0), 0);
      const retrabalhos = all.filter((o) => o.tipo === "retrabalho").length;
      return { total: all.length, abertas, criticas, custoTotal, retrabalhos };
    },
  });

  /* ---- RECENT ACTIVITIES ---- */
  const { data: recentLeads } = useQuery({
    queryKey: ["dash", "recent-leads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, empresa, status, temperatura, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const { data: recentPedidos } = useQuery({
    queryKey: ["dash", "recent-pedidos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("id, numero, status, valor_total, created_at, clientes(nome_fantasia)")
        .is("excluido_em", null)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  /* ---- helpers ---- */
  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  /* Pedido status breakdown */
  const pedidoBreakdown = pedidoStats?.byStatus || {};
  const maxPedidoStatus = Math.max(...Object.values(pedidoBreakdown), 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Painel Executivo</h1>
        <p className="text-slate-500 mt-1">Visão 360° — Croma Print Comunicação Visual</p>
      </div>

      {/* ═══ SEÇÃO 1: KPIs COMERCIAIS ═══ */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Target size={14} /> Comercial
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Clientes ativos"
            value={clienteCount ?? "—"}
            icon={<Building2 size={20} className="text-white" />}
            color="bg-blue-500"
          />
          <KPICard
            title="Leads em aberto"
            value={leadStats?.total ?? "—"}
            subtitle={`${leadStats?.quentes ?? 0} quentes`}
            icon={<UserPlus size={20} className="text-white" />}
            color="bg-emerald-500"
          />
          <KPICard
            title="Pipeline ativo"
            value={leadStats?.pipeline ? formatBRL(leadStats.pipeline) : "—"}
            subtitle="Valor estimado dos leads"
            icon={<TrendingUp size={20} className="text-white" />}
            color="bg-purple-500"
          />
          <KPICard
            title="Propostas"
            value={propostaStats?.total ?? "—"}
            subtitle={`${propostaStats?.pendentes ?? 0} pendentes · ${propostaStats?.aprovadas ?? 0} aprovadas`}
            icon={<FileText size={20} className="text-white" />}
            color="bg-amber-500"
          />
        </div>
      </div>

      {/* ═══ SEÇÃO 2: KPIs OPERACIONAIS ═══ */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Factory size={14} /> Operacional
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Pedidos ativos"
            value={pedidoStats ? pedidoStats.total - (pedidoBreakdown["concluido"] || 0) - (pedidoBreakdown["cancelado"] || 0) : "—"}
            subtitle={pedidoStats?.atrasados ? `${pedidoStats.atrasados} em atraso ⚠️` : "Todos no prazo ✓"}
            icon={<Package size={20} className="text-white" />}
            color="bg-indigo-500"
            trend={pedidoStats?.atrasados ? "down" : "up"}
            trendValue={pedidoStats?.atrasados ? `${pedidoStats.atrasados} atraso` : "OK"}
          />
          <KPICard
            title="Produção ativa"
            value={producaoStats?.emProducao ?? "—"}
            subtitle={`${producaoStats?.aguardando ?? 0} aguardando · ${producaoStats?.liberadas ?? 0} liberadas`}
            icon={<Factory size={20} className="text-white" />}
            color="bg-orange-500"
            trend={producaoStats?.atrasadas ? "down" : undefined}
            trendValue={producaoStats?.atrasadas ? `${producaoStats.atrasadas} atraso` : undefined}
          />
          <KPICard
            title="Instalações"
            value={instStats?.agendadasHoje ?? "—"}
            subtitle={`${instStats?.aguardando ?? 0} aguardando · ${instStats?.emExecucao ?? 0} em campo`}
            icon={<Truck size={20} className="text-white" />}
            color="bg-cyan-500"
          />
          <KPICard
            title="Estoque"
            value={estoqueStats?.total ?? "—"}
            subtitle={estoqueStats?.criticos ? `${estoqueStats.criticos} materiais em alerta ⚠️` : "Todos OK ✓"}
            icon={<ShoppingCart size={20} className="text-white" />}
            color={estoqueStats?.criticos ? "bg-red-500" : "bg-teal-500"}
            trend={estoqueStats?.criticos ? "down" : undefined}
            trendValue={estoqueStats?.criticos ? `${estoqueStats.criticos} baixo` : undefined}
          />
        </div>
      </div>

      {/* ═══ SEÇÃO 3: KPIs FINANCEIROS ═══ */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <DollarSign size={14} /> Financeiro
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Contas a receber"
            value={finStats?.totalReceber ? formatBRL(finStats.totalReceber) : "—"}
            icon={<Wallet size={20} className="text-white" />}
            color="bg-green-500"
          />
          <KPICard
            title="Contas a pagar"
            value={finStats?.totalPagar ? formatBRL(finStats.totalPagar) : "—"}
            icon={<DollarSign size={20} className="text-white" />}
            color="bg-rose-500"
          />
          <KPICard
            title="Inadimplência"
            value={finStats?.vencidos ? formatBRL(finStats.vencidos) : "R$ 0"}
            icon={<AlertTriangle size={20} className="text-white" />}
            color={finStats?.vencidos && finStats.vencidos > 0 ? "bg-red-500" : "bg-slate-400"}
            trend={finStats?.vencidos && finStats.vencidos > 0 ? "down" : undefined}
            trendValue={finStats?.vencidos && finStats.vencidos > 0 ? "Vencido" : undefined}
          />
          <KPICard
            title="Qualidade"
            value={qualStats?.abertas ?? 0}
            subtitle={`${qualStats?.criticas ?? 0} críticas · ${qualStats?.retrabalhos ?? 0} retrabalhos`}
            icon={<Wrench size={20} className="text-white" />}
            color={qualStats?.criticas ? "bg-red-500" : "bg-slate-500"}
          />
        </div>
      </div>

      {/* ═══ SEÇÃO 4: DETALHES ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pedidos por status */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-indigo-500" />
            <h2 className="font-semibold text-slate-800">Pedidos por status</h2>
          </div>
          <div className="space-y-2.5">
            {Object.entries(pedidoBreakdown).length > 0 ? (
              Object.entries(pedidoBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => (
                  <MiniBar
                    key={status}
                    label={status.replace(/_/g, " ")}
                    value={count}
                    max={maxPedidoStatus}
                    color={
                      status === "concluido"
                        ? "bg-emerald-500"
                        : status === "cancelado"
                        ? "bg-red-400"
                        : status.includes("producao")
                        ? "bg-orange-400"
                        : status.includes("instalacao")
                        ? "bg-cyan-400"
                        : "bg-blue-400"
                    }
                  />
                ))
            ) : (
              <p className="text-sm text-slate-400 py-4 text-center">Nenhum pedido ainda</p>
            )}
          </div>
        </div>

        {/* Leads recentes */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target size={18} className="text-emerald-500" />
            <h2 className="font-semibold text-slate-800">Leads recentes</h2>
          </div>
          {recentLeads && recentLeads.length > 0 ? (
            <div>
              {recentLeads.map((lead) => (
                <ActivityItem
                  key={lead.id}
                  title={lead.empresa}
                  subtitle={`${lead.status} · ${lead.temperatura || "—"}`}
                  time={timeAgo(lead.created_at)}
                  type="lead"
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">Nenhum lead cadastrado</p>
          )}
        </div>

        {/* Pedidos recentes */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-amber-500" />
            <h2 className="font-semibold text-slate-800">Pedidos recentes</h2>
          </div>
          {recentPedidos && recentPedidos.length > 0 ? (
            <div>
              {recentPedidos.map((ped: any) => (
                <ActivityItem
                  key={ped.id}
                  title={`${ped.numero || "—"} — ${ped.clientes?.nome_fantasia || "Cliente"}`}
                  subtitle={`${ped.status?.replace(/_/g, " ")} · ${formatBRL(Number(ped.valor_total) || 0)}`}
                  time={timeAgo(ped.created_at)}
                  type="pedido"
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">Nenhum pedido cadastrado</p>
          )}
        </div>
      </div>

      {/* ═══ SEÇÃO 5: RESUMO FINANCEIRO ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <DollarSign size={18} className="text-green-500" />
          <h2 className="font-semibold text-slate-800">Resumo Financeiro</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <p className="text-xs text-green-600 font-medium mb-1">A Receber</p>
            <p className="text-lg font-bold text-green-700">{finStats?.totalReceber ? formatBRL(finStats.totalReceber) : "R$ 0"}</p>
          </div>
          <div className="text-center p-4 bg-rose-50 rounded-xl">
            <p className="text-xs text-rose-600 font-medium mb-1">A Pagar</p>
            <p className="text-lg font-bold text-rose-700">{finStats?.totalPagar ? formatBRL(finStats.totalPagar) : "R$ 0"}</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-xl">
            <p className="text-xs text-blue-600 font-medium mb-1">Saldo Projetado</p>
            <p className={`text-lg font-bold ${(finStats?.saldo || 0) >= 0 ? "text-blue-700" : "text-red-700"}`}>
              {finStats?.saldo !== undefined ? formatBRL(finStats.saldo) : "R$ 0"}
            </p>
          </div>
          <div className="text-center p-4 bg-amber-50 rounded-xl">
            <p className="text-xs text-amber-600 font-medium mb-1">Recebido</p>
            <p className="text-lg font-bold text-amber-700">{finStats?.recebido ? formatBRL(finStats.recebido) : "R$ 0"}</p>
          </div>
          <div className={`text-center p-4 rounded-xl ${finStats?.vencidos && finStats.vencidos > 0 ? "bg-red-50" : "bg-slate-50"}`}>
            <p className={`text-xs font-medium mb-1 ${finStats?.vencidos && finStats.vencidos > 0 ? "text-red-600" : "text-slate-500"}`}>Inadimplente</p>
            <p className={`text-lg font-bold ${finStats?.vencidos && finStats.vencidos > 0 ? "text-red-700" : "text-slate-400"}`}>
              {finStats?.vencidos ? formatBRL(finStats.vencidos) : "R$ 0"}
            </p>
          </div>
        </div>
      </div>

      {/* ═══ QUALIDADE + INSTALAÇÕES RESUMO ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={18} className="text-emerald-500" />
            <h2 className="font-semibold text-slate-800">Produção</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-amber-50 rounded-xl text-center">
              <p className="text-xl font-bold text-amber-700">{producaoStats?.aguardando ?? 0}</p>
              <p className="text-xs text-amber-600">Aguardando</p>
            </div>
            <div className="p-3 bg-orange-50 rounded-xl text-center">
              <p className="text-xl font-bold text-orange-700">{producaoStats?.emProducao ?? 0}</p>
              <p className="text-xs text-orange-600">Em Produção</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl text-center">
              <p className="text-xl font-bold text-emerald-700">{producaoStats?.liberadas ?? 0}</p>
              <p className="text-xs text-emerald-600">Liberadas</p>
            </div>
            <div className={`p-3 rounded-xl text-center ${producaoStats?.atrasadas ? "bg-red-50" : "bg-slate-50"}`}>
              <p className={`text-xl font-bold ${producaoStats?.atrasadas ? "text-red-700" : "text-slate-400"}`}>
                {producaoStats?.atrasadas ?? 0}
              </p>
              <p className={`text-xs ${producaoStats?.atrasadas ? "text-red-600" : "text-slate-400"}`}>Em Atraso</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Truck size={18} className="text-cyan-500" />
            <h2 className="font-semibold text-slate-800">Instalações</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-blue-50 rounded-xl text-center">
              <p className="text-xl font-bold text-blue-700">{instStats?.agendadasHoje ?? 0}</p>
              <p className="text-xs text-blue-600">Agendadas hoje</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl text-center">
              <p className="text-xl font-bold text-amber-700">{instStats?.aguardando ?? 0}</p>
              <p className="text-xs text-amber-600">Aguardando</p>
            </div>
            <div className="p-3 bg-cyan-50 rounded-xl text-center">
              <p className="text-xl font-bold text-cyan-700">{instStats?.emExecucao ?? 0}</p>
              <p className="text-xs text-cyan-600">Em Campo</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl text-center">
              <p className="text-xl font-bold text-emerald-700">{instStats?.concluidas ?? 0}</p>
              <p className="text-xs text-emerald-600">Concluídas</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
