import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Factory,
  Clock,
  TrendingUp,
  Cpu,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import KpiCard from '@/shared/components/KpiCard';
import KanbanBoard, { type KanbanColumn } from '@/shared/components/KanbanBoard';
import { SemaforoBadge } from '@/shared/components/SemaforoBadge';
import { formatDate, formatDateTime } from '@/shared/utils/format';
import {
  useOpsAtivas,
  useCapacidadeSetores,
  usePCPKpis,
  useSetores,
  useMoverOpParaSetor,
  useOpsAgendadasMaquina,
  useUtilizacaoMaquinas,
} from '../hooks/usePCP';
import type { PCPOpAtiva, MaquinaOPAgendada } from '../types/pcp.types';

// ─── Card do Kanban de Produção ───────────────────────────────
function OPKanbanCard({ item }: { item: PCPOpAtiva }) {
  const navigate = useNavigate();
  return (
    <div
      className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:border-blue-300 transition-colors cursor-pointer"
      onClick={() => navigate(`/os/op/${item.id}`)}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold text-slate-800 text-sm">{item.numero}</span>
        {item.atrasada && (
          <Badge variant="destructive" className="text-xs">
            +{item.dias_atraso}d
          </Badge>
        )}
      </div>
      <p className="text-xs text-slate-600 truncate mb-1">{item.cliente_nome}</p>
      {item.data_prometida && (
        <p className="text-xs text-slate-400">{formatDate(item.data_prometida)}</p>
      )}
      {item.restricao_financeira && (
        <div className="flex items-center gap-1 mt-1.5 text-xs text-red-600">
          <AlertTriangle size={10} />
          <span>Bloqueio financeiro</span>
        </div>
      )}
    </div>
  );
}

// ─── Status color helper ──────────────────────────────────────
function statusColor(status: string): string {
  switch (status) {
    case 'em_producao': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'em_acabamento': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'em_conferencia': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    case 'em_fila': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'liberado': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    aguardando_programacao: 'Aguardando',
    em_fila: 'Em fila',
    em_producao: 'Em produção',
    em_acabamento: 'Acabamento',
    em_conferencia: 'Conferência',
    liberado: 'Liberado',
    retrabalho: 'Retrabalho',
  };
  return map[status] ?? status;
}

// ─── Gantt de Máquinas ────────────────────────────────────────
function GanttMaquinas({ ops }: { ops: MaquinaOPAgendada[] }) {
  if (ops.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <Cpu size={40} className="mx-auto text-slate-300 mb-3" />
        <h3 className="font-semibold text-slate-600">Nenhuma OP agendada em máquina</h3>
        <p className="text-sm text-slate-400 mt-1">
          Crie OPs com máquina e data de início prevista para visualizar aqui.
        </p>
      </div>
    );
  }

  // Agrupar por máquina
  const maquinaMap = new Map<string, { nome: string; tipo: string; ops: MaquinaOPAgendada[] }>();
  for (const op of ops) {
    if (!maquinaMap.has(op.maquina_id)) {
      maquinaMap.set(op.maquina_id, { nome: op.maquina_nome, tipo: op.maquina_tipo, ops: [] });
    }
    maquinaMap.get(op.maquina_id)!.ops.push(op);
  }

  return (
    <div className="space-y-3">
      {Array.from(maquinaMap.entries()).map(([maqId, maq]) => (
        <div key={maqId} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {/* Cabeçalho da máquina */}
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
            <Cpu size={16} className="text-slate-500" />
            <span className="font-semibold text-slate-700 text-sm">{maq.nome}</span>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {maq.tipo}
            </span>
            <span className="ml-auto text-xs text-slate-400">{maq.ops.length} OP(s)</span>
          </div>

          {/* Linhas de OPs */}
          <div className="divide-y divide-slate-50">
            {maq.ops.map((op) => (
              <div
                key={op.op_id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                {/* Status dot */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  op.status === 'em_producao' ? 'bg-amber-500' :
                  op.status === 'em_fila' ? 'bg-blue-500' :
                  op.atrasada ? 'bg-red-500' : 'bg-slate-300'
                }`} />

                {/* OP info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800 text-sm">{op.op_numero}</span>
                    <span className="text-xs text-slate-500 truncate">{op.cliente_nome}</span>
                    {op.atrasada && (
                      <Badge variant="destructive" className="text-xs py-0 h-4">Atrasada</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Pedido {op.pedido_numero}</p>
                </div>

                {/* Status badge */}
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor(op.status)}`}>
                  {statusLabel(op.status)}
                </span>

                {/* Período */}
                <div className="text-right flex-shrink-0 hidden sm:block">
                  <p className="text-xs font-medium text-slate-700">
                    {formatDateTime(op.data_inicio_prevista)}
                  </p>
                  {op.data_fim_prevista && (
                    <p className="text-xs text-slate-400">
                      até {formatDateTime(op.data_fim_prevista)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── PCPDashboardPage ─────────────────────────────────────────
export default function PCPDashboardPage() {
  const navigate = useNavigate();

  const { data: kpis, isLoading: kpisLoading } = usePCPKpis();
  const { data: ops = [], isLoading: opsLoading } = useOpsAtivas();
  const { data: setores = [] } = useSetores();
  const { data: capacidade = [] } = useCapacidadeSetores();
  const { data: opsAgendadas = [], isLoading: ganttLoading } = useOpsAgendadasMaquina();
  const { data: utilizacaoMaquinas = [] } = useUtilizacaoMaquinas();
  const moverOp = useMoverOpParaSetor();

  // ─── Colunas do Kanban por setor ──────────────────────────
  const kanbanColumns: KanbanColumn<PCPOpAtiva>[] = setores.map((setor) => ({
    id: setor.id,
    title: setor.nome,
    color: setor.cor,
    items: ops.filter((op) => op.setor_atual_id === setor.id),
  }));

  // Coluna "Sem Setor" para OPs sem setor atribuído
  const semSetorItems = ops.filter((op) => !op.setor_atual_id);
  if (semSetorItems.length > 0) {
    kanbanColumns.unshift({
      id: 'sem-setor',
      title: 'Sem Setor',
      color: '#94A3B8',
      items: semSetorItems,
    });
  }

  const handleDrop = (opId: string, _from: string, toColId: string) => {
    moverOp.mutate({
      opId,
      setorId: toColId === 'sem-setor' ? null : toColId,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            PCP — Planejamento e Controle
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Produção em tempo real</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => navigate('/producao')}
        >
          <Factory size={14} />
          Kanban Geral
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="OPs Ativas"
          value={kpisLoading ? '...' : String(kpis?.total_ops_ativas ?? 0)}
          icon={<Factory size={20} />}
          color="blue"
          loading={kpisLoading}
        />
        <KpiCard
          title="Atrasadas"
          value={kpisLoading ? '...' : String(kpis?.ops_atrasadas ?? 0)}
          icon={<AlertTriangle size={20} />}
          color="red"
          loading={kpisLoading}
        />
        <KpiCard
          title="Em Produção"
          value={kpisLoading ? '...' : String(kpis?.ops_em_producao ?? 0)}
          icon={<Clock size={20} />}
          color="amber"
          loading={kpisLoading}
        />
        <KpiCard
          title="Capacidade Média"
          value={kpisLoading ? '...' : `${kpis?.capacidade_media_pct ?? 0}%`}
          icon={<TrendingUp size={20} />}
          color="green"
          loading={kpisLoading}
        />
      </div>

      {/* Card — Utilização de Máquinas */}
      {utilizacaoMaquinas.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Cpu size={18} className="text-blue-600" />
            <h2 className="font-semibold text-slate-800 text-sm">Utilização de Máquinas — Hoje</h2>
            <span className="ml-auto text-xs text-slate-400">
              {utilizacaoMaquinas.filter((m) => m.ops_hoje > 0).length} /{' '}
              {utilizacaoMaquinas.length} ocupadas
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {utilizacaoMaquinas.map((m) => (
              <div
                key={m.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium ${
                  m.ops_hoje > 0
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                {m.ops_hoje > 0 ? (
                  <CheckCircle2 size={13} className="text-amber-500" />
                ) : (
                  <Circle size={13} className="text-slate-300" />
                )}
                <span>{m.nome}</span>
                {m.ops_hoje > 0 && (
                  <span className="bg-amber-200 text-amber-900 rounded-full px-1.5 py-0 leading-tight">
                    {m.ops_hoje}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="kanban">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="kanban">Kanban por Setor</TabsTrigger>
          <TabsTrigger value="maquinas">Máquinas</TabsTrigger>
          <TabsTrigger value="capacidade">Capacidade</TabsTrigger>
        </TabsList>

        {/* ── Kanban ─────────────────────────────────────── */}
        <TabsContent value="kanban" className="mt-4 space-y-4">
          <KanbanBoard<PCPOpAtiva>
            columns={kanbanColumns}
            renderCard={(op) => <OPKanbanCard item={op} />}
            onDrop={handleDrop}
            isLoading={opsLoading}
            emptyLabel="Nenhuma OP"
          />
          {/* Links rápidos para fila por setor */}
          <div className="flex flex-wrap gap-2 pt-2">
            {setores.map((s) => (
              <Button
                key={s.id}
                variant="outline"
                size="sm"
                className="gap-2 text-xs"
                onClick={() => navigate(`/producao/setor/${s.id}`)}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: s.cor }}
                />
                Fila: {s.nome}
              </Button>
            ))}
          </div>
        </TabsContent>

        {/* ── Máquinas ───────────────────────────────────── */}
        <TabsContent value="maquinas" className="mt-4">
          {ganttLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-40 mb-3" />
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-100 rounded w-full" />
                    <div className="h-3 bg-slate-100 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <GanttMaquinas ops={opsAgendadas} />
          )}
        </TabsContent>

        {/* ── Capacidade ─────────────────────────────────── */}
        <TabsContent value="capacidade" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {capacidade.map((cap) => {
              const pct = Number(cap.utilizacao_pct);
              const semaforoStatus =
                pct > 90 ? 'vermelho' : pct > 70 ? 'amarelo' : 'verde';

              return (
                <div
                  key={cap.setor_id}
                  className="bg-white rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: cap.cor }}
                      />
                      <span className="font-semibold text-slate-700 text-sm">
                        {cap.setor_nome}
                      </span>
                    </div>
                    <SemaforoBadge status={semaforoStatus} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Utilização</span>
                      <span className="font-medium">{pct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          backgroundColor:
                            pct > 90
                              ? '#EF4444'
                              : pct > 70
                              ? '#F59E0B'
                              : '#10B981',
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-400">
                      {cap.ops_ativas} OPs · {cap.min_total_estimado}min /{' '}
                      {cap.capacidade_diaria_min}min diários
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3 text-xs"
                    onClick={() => navigate(`/producao/setor/${cap.setor_id}`)}
                  >
                    Ver fila do setor
                  </Button>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
