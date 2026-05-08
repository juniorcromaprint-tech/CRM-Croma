import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  MessageSquare,
  Clock,
  TrendingUp,
  CheckCircle,
  Loader2,
  Play,
  Plus,
  ChevronRight,
  Mail,
  Smartphone,
  Trash2,
  Search,
  Flame,
  Snowflake,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import KpiCard from '@/shared/components/KpiCard';
import { formatDate } from '@/shared/utils/format';
import { useAgentConversations, useAgentStats } from '../hooks/useAgentConversations';
import { useRunOrchestrator } from '../hooks/useAgentActions';
import { useDeleteConversation } from '../hooks/useAgentMessages';
import LeadDiscoveryDialog from '../components/LeadDiscoveryDialog';
import WhatsAppStatusCard from '../components/WhatsAppStatusCard';
import type { AgentConversation, AgentCanal, AgentConversationStatus, AgentEtapa } from '../types/agent.types';

// ─── Badge helpers ───────────────────────────────────────────────────────────

const CANAL_CONFIG: Record<AgentCanal, { label: string; className: string; Icon: typeof Mail }> = {
  email:    { label: 'Email',     className: 'bg-blue-100 text-blue-700',     Icon: Mail },
  whatsapp: { label: 'WhatsApp',  className: 'bg-green-100 text-green-700',   Icon: Smartphone },
  interno:  { label: 'Interno',   className: 'bg-slate-100 text-slate-600',   Icon: MessageSquare },
};

const STATUS_CONFIG: Record<AgentConversationStatus, { label: string; className: string }> = {
  ativa:                 { label: 'Ativa',              className: 'bg-blue-100 text-blue-700' },
  pausada:               { label: 'Pausada',            className: 'bg-slate-100 text-slate-600' },
  aguardando_aprovacao:  { label: 'Aguard. Aprovação',  className: 'bg-amber-100 text-amber-700' },
  convertida:            { label: 'Convertida',         className: 'bg-emerald-100 text-emerald-700' },
  encerrada:             { label: 'Encerrada',          className: 'bg-slate-100 text-slate-500' },
  escalada:              { label: 'Escalada',           className: 'bg-orange-100 text-orange-700' },
};

const ETAPA_CONFIG: Record<AgentEtapa, { label: string; className: string }> = {
  abertura:      { label: 'Abertura',    className: 'bg-slate-100 text-slate-600' },
  followup1:     { label: 'Follow-up 1', className: 'bg-blue-100 text-blue-600' },
  followup2:     { label: 'Follow-up 2', className: 'bg-blue-100 text-blue-700' },
  followup3:     { label: 'Follow-up 3', className: 'bg-blue-200 text-blue-800' },
  reengajamento: { label: 'Reengaj.',    className: 'bg-indigo-100 text-indigo-700' },
  proposta:      { label: 'Proposta',    className: 'bg-purple-100 text-purple-700' },
  negociacao:    { label: 'Negociação',  className: 'bg-amber-100 text-amber-700' },
};

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color =
    pct <= 30 ? 'bg-red-400' :
    pct <= 60 ? 'bg-amber-400' :
                'bg-emerald-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-500">{pct}</span>
    </div>
  );
}

// ─── Filtros (Entrega 4) ──────────────────────────────────────────────────────
//
// O time de vendas relatou que conversas ficam perdidas quando há volume.
// Adicionamos 3 dimensões de filtro NÃO-INVASIVAS: status, score (faixa) e busca por texto.
// As escolhas são persistidas em localStorage para que o usuário não perca filtro entre sessões.

type StatusFilter = 'todas' | AgentConversationStatus;
type ScoreFilter  = 'todas' | 'quente' | 'morno' | 'frio';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'todas',                 label: 'Todas' },
  { id: 'ativa',                 label: 'Ativas' },
  { id: 'aguardando_aprovacao',  label: 'Aguard. Aprovação' },
  { id: 'convertida',            label: 'Convertidas' },
  { id: 'escalada',              label: 'Escaladas' },
  { id: 'pausada',               label: 'Pausadas' },
  { id: 'encerrada',             label: 'Encerradas' },
];

const SCORE_FILTERS: { id: ScoreFilter; label: string; icon?: JSX.Element; cls: string }[] = [
  { id: 'todas',  label: 'Todos scores',                                              cls: 'border-slate-200 text-slate-600' },
  { id: 'quente', label: 'Quente (>70)',  icon: <Flame size={11} />,                  cls: 'border-red-200 text-red-700 bg-red-50' },
  { id: 'morno',  label: 'Morno (30-70)',                                             cls: 'border-amber-200 text-amber-700 bg-amber-50' },
  { id: 'frio',   label: 'Frio (<30)',    icon: <Snowflake size={11} />,              cls: 'border-blue-200 text-blue-700 bg-blue-50' },
];

const FILTER_STORAGE_KEY = 'agent-dashboard-filters-v1';

interface PersistedFilters {
  status: StatusFilter;
  score: ScoreFilter;
  search: string;
}

function loadFilters(): PersistedFilters {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return { status: 'todas', score: 'todas', search: '' };
    const parsed = JSON.parse(raw) as Partial<PersistedFilters>;
    return {
      status: (parsed.status ?? 'todas') as StatusFilter,
      score:  (parsed.score  ?? 'todas') as ScoreFilter,
      search: parsed.search ?? '',
    };
  } catch {
    return { status: 'todas', score: 'todas', search: '' };
  }
}

function saveFilters(f: PersistedFilters) {
  try { localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(f)); } catch { /* noop */ }
}

function FilterBar({
  statusFilter, onStatus,
  scoreFilter,  onScore,
  search,       onSearch,
  countsByStatus,
  totalAfterFilter,
  totalBeforeFilter,
  onClear,
}: {
  statusFilter: StatusFilter;
  onStatus: (s: StatusFilter) => void;
  scoreFilter: ScoreFilter;
  onScore: (s: ScoreFilter) => void;
  search: string;
  onSearch: (s: string) => void;
  countsByStatus: Record<StatusFilter, number>;
  totalAfterFilter: number;
  totalBeforeFilter: number;
  onClear: () => void;
}) {
  const algumFiltroAtivo = statusFilter !== 'todas' || scoreFilter !== 'todas' || search.trim() !== '';

  return (
    <div className="border-b border-slate-100 bg-slate-50/30 px-5 py-3 space-y-3">
      {/* Linha 1: status + contagem */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => {
            const count = countsByStatus[f.id] ?? 0;
            const active = statusFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => onStatus(f.id)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  active
                    ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium'
                    : 'border-slate-200 text-slate-600 hover:bg-white'
                }`}
              >
                {f.label}
                {count > 0 && (
                  <span className={`ml-1.5 text-[10px] tabular-nums ${active ? 'text-blue-500' : 'text-slate-400'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {algumFiltroAtivo && (
          <button
            onClick={onClear}
            className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
          >
            <X size={11} /> Limpar filtros
          </button>
        )}
      </div>

      {/* Linha 2: score + busca */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {SCORE_FILTERS.map((f) => {
            const active = scoreFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => onScore(f.id)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors inline-flex items-center gap-1 ${
                  active
                    ? f.cls + ' font-medium'
                    : 'border-slate-200 text-slate-500 hover:bg-white'
                }`}
              >
                {f.icon}
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Buscar empresa ou contato..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 bg-white"
          />
        </div>
      </div>

      {/* Resultado da filtragem */}
      {algumFiltroAtivo && (
        <div className="text-[11px] text-slate-500">
          Mostrando <strong className="text-slate-700">{totalAfterFilter}</strong>
          {' de '}
          <strong className="text-slate-700">{totalBeforeFilter}</strong>
          {' '}{totalBeforeFilter === 1 ? 'conversa' : 'conversas'}
        </div>
      )}
    </div>
  );
}

// ─── Conversation row ─────────────────────────────────────────────────────────

function ConversationRow({ conv, onClick, onDelete }: { conv: AgentConversation; onClick: () => void; onDelete: () => void }) {
  const canalCfg  = CANAL_CONFIG[conv.canal]  ?? CANAL_CONFIG.interno;
  const statusCfg = STATUS_CONFIG[conv.status] ?? STATUS_CONFIG.encerrada;
  const etapaCfg  = ETAPA_CONFIG[conv.etapa]  ?? ETAPA_CONFIG.abertura;
  const CanalIcon = canalCfg.Icon;

  return (
    <div
      className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer group border-b border-slate-100 last:border-0"
      onClick={onClick}
    >
      {/* Empresa */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800 truncate">
          {conv.leads?.empresa ?? '—'}
        </p>
        {conv.leads?.contato_nome && (
          <p className="text-xs text-slate-400 truncate mt-0.5">{conv.leads.contato_nome}</p>
        )}
      </div>

      {/* Canal */}
      <div className="w-28 hidden sm:block">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${canalCfg.className}`}>
          <CanalIcon size={11} />
          {canalCfg.label}
        </span>
      </div>

      {/* Etapa */}
      <div className="w-28 hidden md:block">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${etapaCfg.className}`}>
          {etapaCfg.label}
        </span>
      </div>

      {/* Status */}
      <div className="w-36 hidden lg:block">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.className}`}>
          {statusCfg.label}
        </span>
      </div>

      {/* Score */}
      <div className="w-24 hidden xl:block">
        <ScoreBar score={conv.score_engajamento} />
      </div>

      {/* Último contato */}
      <div className="w-28 text-right hidden lg:block">
        <span className="text-xs text-slate-400">
          {conv.ultima_mensagem_em ? formatDate(conv.ultima_mensagem_em) : '—'}
        </span>
      </div>

      {/* Excluir */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 shrink-0"
        title="Excluir conversa"
      >
        <Trash2 size={14} />
      </button>

      {/* Ação */}
      <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AgentDashboardPage() {
  const navigate = useNavigate();
  const [showNovaProspeccao, setShowNovaProspeccao] = useState(false);

  const { data: stats, isLoading: statsLoading } = useAgentStats();

  // Filtros (status enviado pro backend, score+search aplicados client-side)
  const initial = loadFilters();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initial.status);
  const [scoreFilter,  setScoreFilter]  = useState<ScoreFilter>(initial.score);
  const [search,       setSearch]       = useState<string>(initial.search);

  useEffect(() => { saveFilters({ status: statusFilter, score: scoreFilter, search }); },
    [statusFilter, scoreFilter, search]);

  // Quando status === 'todas' não passa filtro pro hook (backend retorna tudo).
  const { data: conversationsAll = [], isLoading: convsLoading } = useAgentConversations(
    statusFilter === 'todas' ? undefined : { status: statusFilter }
  );
  // Para a contagem por status (pills), precisamos da lista TOTAL sem filtro de status.
  // Reaproveita o cache do react-query — se 'todas' está sendo usado, é a mesma query.
  const { data: conversationsForCounts = [] } = useAgentConversations();

  // Contagens por status (sempre da lista total)
  const countsByStatus = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      todas: conversationsForCounts.length,
      ativa: 0, aguardando_aprovacao: 0, convertida: 0,
      escalada: 0, pausada: 0, encerrada: 0,
    };
    for (const conv of conversationsForCounts) {
      if (conv.status in c) c[conv.status as StatusFilter]++;
    }
    return c;
  }, [conversationsForCounts]);

  // Aplicar filtros client-side: score + busca (status já vem filtrado do hook)
  const conversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversationsAll.filter((conv) => {
      // score
      const s = conv.score_engajamento ?? 0;
      if (scoreFilter === 'quente' && s <= 70) return false;
      if (scoreFilter === 'morno'  && (s < 30 || s > 70)) return false;
      if (scoreFilter === 'frio'   && s >= 30) return false;
      // busca
      if (q) {
        const empresa = (conv.leads?.empresa ?? '').toLowerCase();
        const contato = (conv.leads?.contato_nome ?? '').toLowerCase();
        if (!empresa.includes(q) && !contato.includes(q)) return false;
      }
      return true;
    });
  }, [conversationsAll, scoreFilter, search]);

  const handleClearFilters = () => {
    setStatusFilter('todas');
    setScoreFilter('todas');
    setSearch('');
  };

  const runOrchestrator = useRunOrchestrator();
  const deleteConversation = useDeleteConversation();

  const handleOrquestrador = () => {
    runOrchestrator.mutate();
  };

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Agente de Vendas</h1>
          <p className="text-slate-500 mt-1">Agente autônomo de prospecção</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleOrquestrador}
            disabled={runOrchestrator.isPending}
            className="gap-2"
          >
            {runOrchestrator.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Play size={16} />
            )}
            {runOrchestrator.isPending ? 'Executando...' : 'Executar Orquestrador'}
          </Button>
          <Button
            onClick={() => setShowNovaProspeccao(true)}
            className="bg-blue-600 hover:bg-blue-700 gap-2"
          >
            <Plus size={16} />
            Nova Prospecção
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Conversas Ativas"
          value={stats?.ativas ?? 0}
          icon={<MessageSquare size={22} />}
          color="blue"
          loading={statsLoading}
        />
        <KpiCard
          title="Fila de Aprovação"
          value={stats?.mensagensPendentes ?? 0}
          icon={<Clock size={22} />}
          color="amber"
          loading={statsLoading}
          onClick={() => navigate('/agente/aprovacao')}
          subtitle="Mensagens aguardando revisão"
        />
        <KpiCard
          title="Taxa de Resposta"
          value={`${stats?.taxaResposta ?? 0}%`}
          icon={<TrendingUp size={22} />}
          color="green"
          loading={statsLoading}
        />
        <KpiCard
          title="Convertidas"
          value={stats?.convertidas ?? 0}
          icon={<CheckCircle size={22} />}
          color="green"
          loading={statsLoading}
        />
      </div>

      {/* ── WhatsApp Status ──────────────────────────────────────────────── */}
      <WhatsAppStatusCard />

      {/* ── Conversations table ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Table header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700">Conversas</h2>
          {!convsLoading && conversations.length > 0 && (
            <span className="text-sm text-slate-400">{conversations.length} conversa{conversations.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {/* Filtros (Entrega 4) */}
        {!convsLoading && conversationsForCounts.length > 0 && (
          <FilterBar
            statusFilter={statusFilter}
            onStatus={setStatusFilter}
            scoreFilter={scoreFilter}
            onScore={setScoreFilter}
            search={search}
            onSearch={setSearch}
            countsByStatus={countsByStatus}
            totalAfterFilter={conversations.length}
            totalBeforeFilter={conversationsForCounts.length}
            onClear={handleClearFilters}
          />
        )}

        {/* Column headers */}
        {!convsLoading && conversations.length > 0 && (
          <div className="flex items-center gap-4 px-5 py-2 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-400 uppercase tracking-wide">
            <div className="flex-1">Empresa</div>
            <div className="w-28 hidden sm:block">Canal</div>
            <div className="w-28 hidden md:block">Etapa</div>
            <div className="w-36 hidden lg:block">Status</div>
            <div className="w-24 hidden xl:block">Score</div>
            <div className="w-28 text-right hidden lg:block">Último contato</div>
            <div className="w-4" />
          </div>
        )}

        {/* Rows */}
        {convsLoading ? (
          <div className="divide-y divide-slate-100">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-100 rounded w-1/3" />
                  <div className="h-3 bg-slate-100 rounded w-1/4" />
                </div>
                <div className="w-16 h-5 bg-slate-100 rounded-full hidden sm:block" />
                <div className="w-20 h-5 bg-slate-100 rounded-full hidden md:block" />
                <div className="w-24 h-5 bg-slate-100 rounded-full hidden lg:block" />
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          conversationsForCounts.length > 0 ? (
            <div className="p-10 text-center">
              <Search size={32} className="mx-auto text-slate-300 mb-2" />
              <h3 className="font-semibold text-slate-600">Nenhuma conversa bate com esses filtros</h3>
              <p className="text-sm text-slate-400 mt-1">Tente afrouxar a busca ou limpar os filtros.</p>
              <button
                onClick={handleClearFilters}
                className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
              >
                <X size={11} /> Limpar filtros
              </button>
            </div>
          ) : (
            <div className="p-12 text-center">
              <Bot size={40} className="mx-auto text-slate-300 mb-3" />
              <h3 className="font-semibold text-slate-600">Nenhuma conversa ativa</h3>
              <p className="text-sm text-slate-400 mt-1">
                Clique em &quot;Nova Prospecção&quot; para começar.
              </p>
            </div>
          )
        ) : (
          <div>
            {conversations.map((conv) => (
              <ConversationRow
                key={conv.id}
                conv={conv}
                onClick={() => navigate(`/agente/conversa/${conv.id}`)}
                onDelete={() => {
                  if (window.confirm(`Excluir conversa com ${conv.leads?.empresa ?? 'este lead'}?`)) {
                    deleteConversation.mutate({ conversationId: conv.id });
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Nova Prospecção Dialog ───────────────────────────────────────── */}
      <LeadDiscoveryDialog
        open={showNovaProspeccao}
        onOpenChange={setShowNovaProspeccao}
      />
    </div>
  );
}
