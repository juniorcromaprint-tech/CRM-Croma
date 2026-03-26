import React from "react";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Bar, Line, Legend,
} from "recharts";
import {
  DollarSign, TrendingUp, Target, Factory, Wrench,
  AlertCircle, AlertTriangle, ArrowRight, Crown, Trophy,
  RefreshCw, Package,
} from "lucide-react";
import { brl } from "@/shared/utils/format";
import {
  useFaturamentoMes,
  useTaxaConversaoMes,
  useEvolucaoMensal,
  useTopClientes,
} from "../hooks/useDashboardExecutivo";
import {
  useDashProducao,
  useDashInstalacoes,
  useDashFinanceiro,
  useFunnelStats,
} from "../hooks/useDashboardStats";
import { useAlertasAI } from "@/domains/ai/hooks/useAlertasAI";
import FunnelCard from "../components/FunnelCard";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

function mesAtual() {
  return new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  KPI Card                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

interface KpiCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string; // bg-* class
  iconColor: string; // text-* class
  loading?: boolean;
  alert?: boolean;
  to?: string;
}

function KpiCard({ label, value, subtitle, icon, color, iconColor, loading, alert, to }: KpiCardProps) {
  const inner = (
    <div
      className={`bg-white rounded-2xl border ${alert ? "border-red-200 shadow-red-50" : "border-slate-100"} p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow ${to ? "cursor-pointer" : ""}`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
        {loading ? (
          <div className="h-7 w-28 bg-slate-100 rounded-lg animate-pulse" />
        ) : (
          <p className={`text-2xl font-bold ${alert ? "text-red-600" : "text-slate-800"} leading-tight`}>
            {value}
          </p>
        )}
        {subtitle && !loading && (
          <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
        )}
      </div>
      {to && <ArrowRight size={16} className="text-slate-300 mt-1 flex-shrink-0" />}
    </div>
  );

  return to ? <Link to={to} className="block">{inner}</Link> : inner;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Alerta Card                                                                */
/* ─────────────────────────────────────────────────────────────────────────── */

function severidadeConfig(sev: string) {
  if (sev === "alta") return { color: "text-red-600 bg-red-50 border-red-100", icon: <AlertCircle size={14} /> };
  if (sev === "media") return { color: "text-amber-600 bg-amber-50 border-amber-100", icon: <AlertTriangle size={14} /> };
  return { color: "text-blue-600 bg-blue-50 border-blue-100", icon: <AlertCircle size={14} /> };
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Custom Tooltip para o gráfico                                              */
/* ─────────────────────────────────────────────────────────────────────────── */

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-semibold text-slate-800">
            {p.name === "Faturamento (R$ mil)" ? `R$ ${p.value}k` : p.name === "Conversão (%)" ? `${p.value}%` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Dashboard Executivo                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

export default function DashboardExecutivoPage() {
  const { data: fat, isLoading: loadFat } = useFaturamentoMes();
  const { data: conv, isLoading: loadConv } = useTaxaConversaoMes();
  const { data: prod } = useDashProducao();
  const { data: inst } = useDashInstalacoes();
  const { data: fin } = useDashFinanceiro();
  const { data: evolucao, isLoading: loadEvolucao } = useEvolucaoMensal();
  const { data: topClientes, isLoading: loadTop } = useTopClientes();
  const { data: alertas = [] } = useAlertasAI();
  const { data: funil } = useFunnelStats();

  // Alertas críticos — máx. 5
  const alertasCriticos = alertas
    .sort((a, b) => {
      const order = { alta: 0, media: 1, baixa: 2 };
      return (order[a.severidade] ?? 2) - (order[b.severidade] ?? 2);
    })
    .slice(0, 5);

  // Ticket médio
  const ticketMedio = fat?.ticketMedio ?? 0;

  // Instalações pendentes
  const instalacoesPendentes = (inst?.aguardando ?? 0) + (inst?.agendadasHoje ?? 0);

  return (
    <div className="space-y-6">
      {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center">
            <Crown size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Dashboard Executivo</h1>
            <p className="text-sm text-slate-400 capitalize">Visão 360° · {mesAtual()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <RefreshCw size={12} />
          <span>Atualiza a cada 5 min</span>
        </div>
      </div>

      {/* ── KPIs principais ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="xl:col-span-2">
          <KpiCard
            label="Faturamento do Mês"
            value={brl(fat?.faturamento ?? 0)}
            subtitle={`${fat?.pedidosFaturados ?? 0} pedidos faturados`}
            icon={<DollarSign size={22} />}
            color="bg-blue-50"
            iconColor="text-blue-600"
            loading={loadFat}
            to="/dre"
          />
        </div>
        <div className="xl:col-span-2">
          <KpiCard
            label="Taxa de Conversão"
            value={`${conv?.taxa ?? 0}%`}
            subtitle={`${conv?.aprovadas ?? 0} de ${conv?.totalPropostas ?? 0} propostas`}
            icon={<TrendingUp size={22} />}
            color="bg-emerald-50"
            iconColor="text-emerald-600"
            loading={loadConv}
          />
        </div>
        <div className="xl:col-span-2">
          <KpiCard
            label="Ticket Médio"
            value={brl(ticketMedio)}
            subtitle="pedidos faturados no mês"
            icon={<Target size={22} />}
            color="bg-indigo-50"
            iconColor="text-indigo-600"
            loading={loadFat}
          />
        </div>
        <KpiCard
          label="Em Produção"
          value={prod?.emProducao ?? 0}
          subtitle={prod?.atrasadas ? `${prod.atrasadas} atrasadas` : "ordens ativas"}
          icon={<Factory size={22} />}
          color={prod?.atrasadas ? "bg-amber-50" : "bg-slate-50"}
          iconColor={prod?.atrasadas ? "text-amber-600" : "text-slate-600"}
          alert={Boolean(prod?.atrasadas && prod.atrasadas > 0)}
          to="/producao"
        />
        <KpiCard
          label="Instalações Pendentes"
          value={instalacoesPendentes}
          subtitle={inst?.agendadasHoje ? `${inst.agendadasHoje} hoje` : "aguardando agendamento"}
          icon={<Wrench size={22} />}
          color="bg-purple-50"
          iconColor="text-purple-600"
          to="/instalacoes"
        />
        <KpiCard
          label="A Receber Vencido"
          value={brl(fin?.vencidos ?? 0)}
          subtitle="inadimplência acumulada"
          icon={<AlertCircle size={22} />}
          color={fin?.vencidos ? "bg-red-50" : "bg-slate-50"}
          iconColor={fin?.vencidos ? "text-red-600" : "text-slate-400"}
          alert={Boolean(fin?.vencidos && fin.vencidos > 0)}
          to="/financeiro"
        />
      </div>

      {/* ── Gráfico + Alertas ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de evolução mensal */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-slate-700 text-sm">Evolução Mensal</h2>
            <span className="text-xs text-slate-400">Últimos 6 meses</span>
          </div>
          {loadEvolucao ? (
            <div className="h-52 bg-slate-50 rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={evolucao} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}k`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 100]}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={(value) => <span className="text-slate-500">{value}</span>}
                />
                <Bar
                  yAxisId="left"
                  dataKey="faturamentoK"
                  name="Faturamento (R$ mil)"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="conversao"
                  name="Conversão (%)"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#10b981" }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Alertas ativos */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-700 text-sm">Alertas Ativos</h2>
            <span className="text-xs font-medium text-red-500 bg-red-50 rounded-full px-2 py-0.5">
              {alertas.length}
            </span>
          </div>

          {alertasCriticos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
                <Package size={18} className="text-emerald-500" />
              </div>
              <p className="text-sm font-medium text-slate-600">Tudo certo!</p>
              <p className="text-xs text-slate-400 mt-1">Nenhum alerta ativo</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alertasCriticos.map((a) => {
                const cfg = severidadeConfig(a.severidade);
                return (
                  <div
                    key={a.id}
                    className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${cfg.color}`}
                  >
                    <span className="flex-shrink-0 mt-0.5">{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold leading-tight">{a.titulo}</p>
                      <p className="text-opacity-80 mt-0.5 line-clamp-2">{a.descricao}</p>
                    </div>
                    <span className="flex-shrink-0 text-opacity-60 ml-1">{timeAgo(a.created_at)}</span>
                  </div>
                );
              })}
              {alertas.length > 5 && (
                <p className="text-xs text-slate-400 text-center pt-1">
                  +{alertas.length - 5} alertas adicionais
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Funil + Top Clientes ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline comercial — funil */}
        {funil ? (
          <FunnelCard data={funil} />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="h-40 bg-slate-50 rounded-xl animate-pulse" />
          </div>
        )}

        {/* Top 5 clientes */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-amber-500" />
              <h2 className="font-semibold text-slate-700 text-sm">Top 5 Clientes</h2>
            </div>
            <span className="text-xs text-slate-400">Últimos 6 meses · faturado</span>
          </div>

          {loadTop ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-slate-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : topClientes && topClientes.length > 0 ? (
            <div className="space-y-2">
              {topClientes.map((c, idx) => {
                const barWidth = topClientes[0].total > 0
                  ? Math.round((c.total / topClientes[0].total) * 100)
                  : 0;
                const rankColors = ["bg-amber-400", "bg-slate-300", "bg-orange-400", "bg-slate-200", "bg-slate-200"];
                return (
                  <div key={c.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${rankColors[idx]}`}
                        >
                          {idx + 1}
                        </span>
                        <span className="text-xs font-medium text-slate-700 truncate max-w-[160px]" title={c.nome}>
                          {c.nome}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-slate-400">{c.pedidos} ped.</span>
                        <span className="text-xs font-bold text-slate-800 tabular-nums">{brl(c.total)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <p className="text-sm font-medium text-slate-500">Sem dados faturados</p>
              <p className="text-xs text-slate-400 mt-1">Fature pedidos para visualizar</p>
            </div>
          )}

          {topClientes && topClientes.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <Link to="/clientes" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                Ver todos os clientes <ArrowRight size={12} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Gráfico de Área — Pedidos por mês ────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-slate-700 text-sm">Volume de Pedidos</h2>
          <span className="text-xs text-slate-400">Últimos 6 meses</span>
        </div>
        {loadEvolucao ? (
          <div className="h-40 bg-slate-50 rounded-xl animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={evolucao} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPedidos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e2e8f0" }}
                formatter={(v: number) => [v, "Pedidos"]}
              />
              <Area
                type="monotone"
                dataKey="numeroPedidos"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#gradPedidos)"
                dot={{ r: 3, fill: "#6366f1" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
