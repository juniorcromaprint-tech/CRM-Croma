import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Factory,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import KpiCard from '@/shared/components/KpiCard';
import KanbanBoard, { type KanbanColumn } from '@/shared/components/KanbanBoard';
import GanttTimeline from '@/shared/components/GanttTimeline';
import SemaforoBadge from '@/shared/components/SemaforoBadge';
import { formatDate } from '@/shared/utils/format';
import {
  useOpsAtivas,
  useCapacidadeSetores,
  usePCPKpis,
  useSetores,
  useMoverOpParaSetor,
} from '../hooks/usePCP';
import type { PCPOpAtiva } from '../types/pcp.types';

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

// ─── PCPDashboardPage ─────────────────────────────────────────
export default function PCPDashboardPage() {
  const navigate = useNavigate();

  const { data: kpis, isLoading: kpisLoading } = usePCPKpis();
  const { data: ops = [], isLoading: opsLoading } = useOpsAtivas();
  const { data: setores = [] } = useSetores();
  const { data: capacidade = [] } = useCapacidadeSetores();
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

      {/* Tabs */}
      <Tabs defaultValue="kanban">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="kanban">Kanban por Setor</TabsTrigger>
          <TabsTrigger value="gantt">Gantt Hoje</TabsTrigger>
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

        {/* ── Gantt ──────────────────────────────────────── */}
        <TabsContent value="gantt" className="mt-4">
          <GanttTimeline
            bars={[]}
            recursos={setores.map((s) => ({
              id: s.id,
              nome: s.nome,
              cor: s.cor,
            }))}
          />
          <p className="text-xs text-slate-400 mt-3 text-center">
            Apontamentos do dia aparecerão aqui conforme operadores registram
            atividades
          </p>
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
