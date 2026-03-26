// src/domains/ai/pages/AIDashboardPage.tsx

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  AlertTriangle,
  CheckCircle,
  Zap,
  Settings,
  Activity,
  DollarSign,
  TrendingUp,
  Users,
  FileText,
  Settings2,
  Camera,
  BarChart2,
  Clock,
  ChevronRight,
  Play,
  XCircle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useAlertasAI, useResolverAlerta, type AIAlerta } from '../hooks/useAlertasAI';
import { useAILogs, type AILog } from '../hooks/useAILogs';
import { useAICommandHub, type AgentStats } from '../hooks/useAICommandHub';
import {
  useRodarInteligenciaComercial,
  useGerarInsightsDiarios,
  useDetectarProblemasQuick,
} from '../hooks/useAIQuickActions';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { showSuccess, showError } from '@/utils/toast';

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtCost(usd: number) {
  return `$${usd.toFixed(4)}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function relTime(iso: string | null) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

function fmtFuncao(name: string) {
  return name
    .replace(/^ai-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const AGENT_ICONS: Record<string, React.ElementType> = {
  Users,
  FileText,
  Settings2,
  Camera,
  DollarSign,
  BarChart2,
};

const SEVERITY_CONFIG = {
  alta: { label: 'Crítico', bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500', icon: 'text-red-500' },
  media: { label: 'Médio', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', icon: 'text-amber-500' },
  baixa: { label: 'Informativo', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-400', icon: 'text-blue-400' },
};

const AGENT_COLORS: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-600',
  violet: 'bg-violet-100 text-violet-600',
  orange: 'bg-orange-100 text-orange-600',
  green: 'bg-green-100 text-green-600',
  emerald: 'bg-emerald-100 text-emerald-600',
  red: 'bg-red-100 text-red-600',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  iconColor,
  loading,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start gap-3">
      <div className={`${iconBg} rounded-xl p-2.5 shrink-0`}>
        <Icon size={18} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 truncate">{label}</p>
        {loading ? (
          <Skeleton className="h-7 w-16 mt-1" />
        ) : (
          <p className="text-2xl font-bold text-slate-800 mt-0.5">{value}</p>
        )}
        {sub && <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function AlertaCard({ alerta, onResolve }: { alerta: AIAlerta; onResolve: (id: string) => void }) {
  const cfg = SEVERITY_CONFIG[alerta.severidade as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.baixa;
  const entityPath: Record<string, string> = {
    proposta: '/orcamentos',
    cliente: '/clientes',
    pedido: '/pedidos',
    geral: '/ia',
  };

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-3.5 flex items-start gap-3`}>
      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cfg.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800 truncate">{alerta.titulo}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cfg.badge}`}>
            {cfg.label}
          </span>
        </div>
        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed line-clamp-2">{alerta.descricao}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-slate-400">{relTime(alerta.created_at)}</span>
          <span className="text-xs text-slate-300">•</span>
          <span className="text-xs text-slate-400 capitalize">{alerta.entity_type}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg"
          onClick={() => onResolve(alerta.id)}
          aria-label="Resolver alerta"
        >
          <CheckCircle size={13} className="mr-1" />
          Resolver
        </Button>
        {alerta.entity_id && (
          <Link to={entityPath[alerta.entity_type] ?? '/ia'}>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg w-full"
              aria-label="Ver entidade"
            >
              <ExternalLink size={12} className="mr-1" />
              Ver
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function LogRow({ log }: { log: AILog }) {
  const isError = log.status !== 'success';
  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
      <td className="py-2.5 px-3">
        <span className="text-sm font-medium text-slate-700">{fmtFuncao(log.function_name)}</span>
      </td>
      <td className="py-2.5 px-3">
        <span className="text-xs text-slate-500">{log.entity_type ?? '—'}</span>
      </td>
      <td className="py-2.5 px-3 hidden md:table-cell">
        <span className="text-xs text-slate-500 truncate max-w-[120px] block">
          {log.model_used.split('/').pop() ?? log.model_used}
        </span>
      </td>
      <td className="py-2.5 px-3 hidden lg:table-cell">
        <span className="text-xs text-slate-500">
          {(log.tokens_input + log.tokens_output).toLocaleString('pt-BR')}
        </span>
      </td>
      <td className="py-2.5 px-3 hidden lg:table-cell">
        <span className="text-xs text-slate-500">{fmtCost(log.cost_usd ?? 0)}</span>
      </td>
      <td className="py-2.5 px-3">
        {isError ? (
          <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            <XCircle size={11} />
            erro
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
            <CheckCircle size={11} />
            ok
          </span>
        )}
      </td>
      <td className="py-2.5 px-3 text-right">
        <span className="text-xs text-slate-400">{relTime(log.created_at)}</span>
      </td>
    </tr>
  );
}

function AgentCard({ stats }: { stats: AgentStats }) {
  const Icon = AGENT_ICONS[stats.agente.icon] ?? Bot;
  const colorClass = AGENT_COLORS[stats.agente.cor] ?? 'bg-slate-100 text-slate-600';
  const taxaOk = stats.total_execucoes > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className={`rounded-xl p-2.5 shrink-0 ${colorClass}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-800 text-sm">Agente {stats.agente.nome}</p>
          <p className="text-xs text-slate-400 leading-relaxed mt-0.5 line-clamp-2">
            {stats.agente.descricao}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-slate-50 rounded-xl py-2">
          <p className="text-base font-bold text-slate-800">{stats.total_execucoes}</p>
          <p className="text-xs text-slate-400">execuções</p>
        </div>
        <div className="bg-slate-50 rounded-xl py-2">
          <p className="text-base font-bold text-slate-800">{fmtCost(stats.custo_acumulado)}</p>
          <p className="text-xs text-slate-400">custo</p>
        </div>
        <div className="bg-slate-50 rounded-xl py-2">
          <p className={`text-base font-bold ${taxaOk ? (stats.taxa_sucesso >= 90 ? 'text-green-600' : 'text-amber-600') : 'text-slate-400'}`}>
            {taxaOk ? `${Math.round(stats.taxa_sucesso)}%` : '—'}
          </p>
          <p className="text-xs text-slate-400">sucesso</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100">
        <Clock size={11} className="text-slate-300 shrink-0" />
        <span className="text-xs text-slate-400">
          Última execução: {relTime(stats.ultima_execucao)}
        </span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AIDashboardPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [expandAlertas, setExpandAlertas] = useState(false);

  const { data: alertas = [], isLoading: loadingAlertas } = useAlertasAI();
  const { data: logs = [], isLoading: loadingLogs } = useAILogs(20);
  const { data: hub, isLoading: loadingHub } = useAICommandHub();
  const resolveAlerta = useResolverAlerta();

  const inteligencia = useRodarInteligenciaComercial();
  const insights = useGerarInsightsDiarios();
  const problemas = useDetectarProblemasQuick();

  const criticos = alertas.filter((a) => a.severidade === 'alta');
  const medios = alertas.filter((a) => a.severidade === 'media');
  const baixos = alertas.filter((a) => a.severidade === 'baixa');

  const alertasVisiveis = expandAlertas ? alertas : alertas.slice(0, 6);

  async function handleResolve(alertaId: string) {
    if (!user) return;
    try {
      await resolveAlerta(alertaId, user.id);
      showSuccess('Alerta resolvido');
      qc.invalidateQueries({ queryKey: ['ai-alertas'] });
    } catch {
      showError('Erro ao resolver alerta');
    }
  }

  // Cost chart data (last 6 months)
  const chartData = (hub?.custo_por_mes ?? []).slice(-6).map((m) => ({
    mes: m.mes.slice(5), // "03"
    custo: parseFloat(m.custo.toFixed(4)),
    execucoes: m.execucoes,
  }));

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 rounded-2xl p-2.5">
            <Bot size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Hub de IA</h1>
            <p className="text-sm text-slate-500">Painel de comando — agentes, alertas e custos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ['ai-alertas'] });
              qc.invalidateQueries({ queryKey: ['ai-logs'] });
              qc.invalidateQueries({ queryKey: ['ai-command-hub'] });
            }}
            aria-label="Atualizar dados"
          >
            <RefreshCw size={13} className="mr-1.5" />
            Atualizar
          </Button>
          <Link to="/agente/config">
            <Button variant="outline" size="sm" className="rounded-xl">
              <Settings size={13} className="mr-1.5" />
              Configurar
            </Button>
          </Link>
        </div>
      </div>

      {/* ── KPI Bar ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Custo total (90d)"
          value={loadingHub ? '...' : fmtCost(hub?.custo_total ?? 0)}
          sub={`${hub?.total_execucoes ?? 0} execuções`}
          icon={DollarSign}
          iconBg="bg-green-100"
          iconColor="text-green-600"
          loading={loadingHub}
        />
        <KpiCard
          label="Taxa de sucesso"
          value={loadingHub ? '...' : `${Math.round(hub?.taxa_sucesso_geral ?? 0)}%`}
          sub="últimos 90 dias"
          icon={TrendingUp}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          loading={loadingHub}
        />
        <KpiCard
          label="Alertas críticos"
          value={criticos.length}
          sub={criticos.length > 0 ? 'Requer atenção' : 'Tudo ok'}
          icon={AlertTriangle}
          iconBg={criticos.length > 0 ? 'bg-red-100' : 'bg-slate-100'}
          iconColor={criticos.length > 0 ? 'text-red-500' : 'text-slate-400'}
          loading={loadingAlertas}
        />
        <KpiCard
          label="Alertas ativos"
          value={alertas.length}
          sub={`${medios.length} médios · ${baixos.length} baixos`}
          icon={Activity}
          iconBg="bg-amber-100"
          iconColor="text-amber-500"
          loading={loadingAlertas}
        />
      </div>

      {/* ── Main grid: Alertas + Ações Rápidas ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alertas ativos */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              <h3 className="font-semibold text-slate-700">Alertas Ativos</h3>
              {alertas.length > 0 && (
                <Badge className="bg-amber-100 text-amber-700 text-xs">{alertas.length}</Badge>
              )}
            </div>
            <Link to="/ia/alertas" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
              Ver todos <ChevronRight size={12} />
            </Link>
          </div>

          {loadingAlertas ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : alertas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle size={36} className="text-green-400 mb-2" />
              <p className="font-semibold text-slate-600 text-sm">Nenhum alerta ativo</p>
              <p className="text-xs text-slate-400 mt-1">Todos os sistemas operando normalmente</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {alertasVisiveis.map((alerta) => (
                  <AlertaCard key={alerta.id} alerta={alerta} onResolve={handleResolve} />
                ))}
              </div>
              {alertas.length > 6 && (
                <button
                  onClick={() => setExpandAlertas((v) => !v)}
                  className="mt-3 text-xs text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  {expandAlertas ? 'Ver menos' : `Ver mais ${alertas.length - 6} alertas`}
                </button>
              )}
            </>
          )}
        </div>

        {/* Ações rápidas + Custo */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={16} className="text-blue-600" />
              <h3 className="font-semibold text-slate-700">Ações Rápidas</h3>
            </div>
            <div className="space-y-2.5">
              <QuickActionButton
                label="Inteligência Comercial"
                description="Analisa leads, oportunidades e pipeline"
                icon={Users}
                iconBg="bg-blue-100"
                iconColor="text-blue-600"
                loading={inteligencia.isPending}
                onClick={() => inteligencia.mutate({})}
              />
              <QuickActionButton
                label="Insights Diários"
                description="Gera resumo executivo do dia"
                icon={BarChart2}
                iconBg="bg-violet-100"
                iconColor="text-violet-600"
                loading={insights.isPending}
                onClick={() => insights.mutate({})}
              />
              <QuickActionButton
                label="Detectar Problemas"
                description="Escaneia todo o sistema por anomalias"
                icon={AlertTriangle}
                iconBg="bg-red-100"
                iconColor="text-red-500"
                loading={problemas.isPending}
                onClick={() => problemas.mutate({})}
              />
            </div>
          </div>

          {/* Cost chart */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign size={16} className="text-green-600" />
              <h3 className="font-semibold text-slate-700">Custo por Mês</h3>
            </div>
            {loadingHub ? (
              <Skeleton className="h-32 rounded-xl" />
            ) : chartData.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Sem dados de custo</p>
            ) : (
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip
                    formatter={(v: number) => [`$${v}`, 'Custo']}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="custo" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Últimas ações da IA ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-slate-500" />
            <h3 className="font-semibold text-slate-700">Últimas Ações da IA</h3>
          </div>
          <span className="text-xs text-slate-400">últimos 20 registros</span>
        </div>

        {loadingLogs ? (
          <div className="p-5 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-9 rounded-lg" />)}
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center">
            <Activity size={36} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Nenhuma ação registrada ainda</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
                  <th className="py-2.5 px-3 font-medium">Função</th>
                  <th className="py-2.5 px-3 font-medium">Entidade</th>
                  <th className="py-2.5 px-3 font-medium hidden md:table-cell">Modelo</th>
                  <th className="py-2.5 px-3 font-medium hidden lg:table-cell">Tokens</th>
                  <th className="py-2.5 px-3 font-medium hidden lg:table-cell">Custo</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-3 font-medium text-right">Quando</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <LogRow key={log.id} log={log} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Status dos Agentes ───────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Bot size={16} className="text-slate-500" />
          <h3 className="font-semibold text-slate-700">Status dos Agentes</h3>
        </div>
        {loadingHub ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {hub?.agentes.map((stats) => (
              <AgentCard key={stats.agente.id} stats={stats} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── QuickActionButton ────────────────────────────────────────────────────────

function QuickActionButton({
  label,
  description,
  icon: Icon,
  iconBg,
  iconColor,
  loading,
  onClick,
}: {
  label: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center gap-3 bg-slate-50 hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl px-3 py-2.5 transition-colors cursor-pointer text-left"
      aria-label={label}
    >
      <div className={`${iconBg} rounded-lg p-2 shrink-0`}>
        {loading ? (
          <RefreshCw size={15} className={`${iconColor} animate-spin`} />
        ) : (
          <Icon size={15} className={iconColor} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">{label}</p>
        <p className="text-xs text-slate-400 truncate">{description}</p>
      </div>
      <Play size={13} className="text-slate-300 shrink-0" />
    </button>
  );
}
