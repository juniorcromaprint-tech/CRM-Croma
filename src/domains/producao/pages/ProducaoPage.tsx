import { useProducaoStats } from "@/domains/producao/hooks/useProducao";
import { useProducaoOrdens } from "@/domains/producao/hooks/useProducaoOrdens";
import KpiCard from "@/shared/components/KpiCard";
import { Button } from "@/components/ui/button";
import {
  Factory,
  Plus,
  Columns3,
  List,
  XCircle,
  ClipboardList,
  Cog,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { PAGE_SIZE } from "../types/producao.types";

import ProducaoStatsBar from "../components/ProducaoStatsBar";
import ProducaoFilters from "../components/ProducaoFilters";
import ProducaoKanbanView from "../components/ProducaoKanbanView";
import ProducaoListView from "../components/ProducaoListView";
import CreateOPDialog from "../components/CreateOPDialog";
import OPDetailDialog from "../components/OPDetailDialog";
import DesignarInstaladorSheet from "../components/DesignarInstaladorSheet";

// ===========================================================================
// SKELETON LOADERS
// ===========================================================================

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm animate-pulse border border-slate-100">
      <div className="space-y-2">
        <div className="h-3 bg-slate-100 rounded w-20" />
        <div className="h-4 bg-slate-100 rounded w-32" />
        <div className="flex gap-2">
          <div className="h-5 bg-slate-100 rounded w-16" />
          <div className="h-5 bg-slate-100 rounded w-12" />
        </div>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-slate-100 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-100 rounded w-32" />
          <div className="h-3 bg-slate-100 rounded w-48" />
          <div className="flex gap-2 mt-1">
            <div className="h-5 bg-slate-100 rounded w-20" />
            <div className="h-5 bg-slate-100 rounded w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================

export default function ProducaoPage() {
  const { data: kpiStats, isLoading: kpiLoading } = useProducaoStats();
  const h = useProducaoOrdens();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            Produção
          </h1>
          <p className="text-slate-500 mt-1">
            {h.ordens.length} ordem{h.ordens.length !== 1 ? "ns" : ""} de produção
            {" \u2022 "}
            {h.stats.emFila} em fila, {h.stats.emProducao} em produção,{" "}
            {h.stats.emConferencia} em conferência
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <button
              onClick={() => h.setViewMode("kanban")}
              className={`px-3 py-2 flex items-center gap-1.5 text-sm font-medium transition-colors ${
                h.viewMode === "kanban"
                  ? "bg-blue-600 text-white"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Columns3 size={16} />
              Kanban
            </button>
            <button
              onClick={() => h.setViewMode("lista")}
              className={`px-3 py-2 flex items-center gap-1.5 text-sm font-medium transition-colors ${
                h.viewMode === "lista"
                  ? "bg-blue-600 text-white"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <List size={16} />
              Lista
            </button>
          </div>

          <Button
            onClick={h.openCreateDialog}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 shadow-sm"
          >
            <Plus size={20} className="mr-2" /> Nova OP
          </Button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total OPs"
          value={kpiStats?.total ?? 0}
          icon={<ClipboardList size={20} />}
          color="blue"
          loading={kpiLoading}
        />
        <KpiCard
          title="Em Produção"
          value={(kpiStats?.byStatus?.em_producao ?? 0) + (kpiStats?.byStatus?.em_acabamento ?? 0)}
          icon={<Cog size={20} />}
          color="orange"
          loading={kpiLoading}
        />
        <KpiCard
          title="Atrasadas (+3 dias)"
          value={kpiStats?.atrasadas ?? 0}
          icon={<AlertTriangle size={20} />}
          color="red"
          loading={kpiLoading}
        />
        <KpiCard
          title="Concluídas Hoje"
          value={kpiStats?.concluidas_hoje ?? 0}
          icon={<CheckCircle size={20} />}
          color="green"
          loading={kpiLoading}
        />
      </div>

      {/* STATS BAR */}
      <ProducaoStatsBar
        isLoading={h.isLoading}
        emFila={h.stats.emFila}
        emProducao={h.stats.emProducao}
        emConferencia={h.stats.emConferencia}
        finalizadasMes={h.stats.finalizadasMes}
      />

      {/* FILTERS */}
      <ProducaoFilters
        viewMode={h.viewMode}
        searchTerm={h.searchTerm}
        onSearchChange={h.setSearchTerm}
        statusFilter={h.statusFilter}
        onStatusFilterChange={h.setStatusFilter}
        prioridadeFilter={h.prioridadeFilter}
        onPrioridadeFilterChange={h.setPrioridadeFilter}
      />

      {/* LOADING / ERROR / EMPTY STATES */}
      {h.isLoading ? (
        h.viewMode === "kanban" ? (
          <div className="grid grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-3">
                <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        )
      ) : h.isError ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <XCircle className="mx-auto h-12 w-12 text-red-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-700">
            Erro ao carregar ordens de produção
          </h3>
          <p className="text-slate-500 mt-1 text-sm">
            Verifique a conexão com o banco de dados.
          </p>
          <Button
            variant="outline"
            className="mt-4 rounded-xl"
            onClick={() =>
              h.queryClient.invalidateQueries({ queryKey: ["producao"] })
            }
          >
            Tentar novamente
          </Button>
        </div>
      ) : h.ordens.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Factory className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-700">
            Nenhuma ordem de produção
          </h3>
          <p className="text-slate-500 mt-1 text-sm">
            Crie a primeira OP para começar a gerenciar a produção.
          </p>
          <Button
            onClick={h.openCreateDialog}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
          >
            <Plus size={18} className="mr-2" /> Criar OP
          </Button>
        </div>
      ) : (
        <>
          {/* KANBAN VIEW */}
          {h.viewMode === "kanban" && (
            <ProducaoKanbanView
              opsByColumn={h.opsByColumn}
              searchTerm={h.searchTerm}
              draggedOPId={h.draggedOPId}
              dragOverColumn={h.dragOverColumn}
              onSelectOP={h.setSelectedOP}
              onDragStart={h.handleDragStart}
              onDragEnd={h.handleDragEnd}
              onDragEnter={h.handleDragEnter}
              onDragLeave={h.handleDragLeave}
              onDragOver={h.handleDragOver}
              onDrop={h.handleDrop}
            />
          )}

          {/* LIST VIEW */}
          {h.viewMode === "lista" && (
            <ProducaoListView
              filtered={h.filtered}
              totalOrdens={h.totalOrdens}
              totalOrdensPages={h.totalOrdensPages}
              page={h.page}
              pageSize={PAGE_SIZE}
              onPageChange={h.setPage}
              onSelectOP={h.setSelectedOP}
            />
          )}
        </>
      )}

      {/* CREATE DIALOG */}
      <CreateOPDialog
        open={h.isCreateOpen}
        onOpenChange={h.setIsCreateOpen}
        pedidoItens={h.pedidoItens}
        maquinas={h.maquinas}
        isPending={h.createMutation.isPending}
        onSubmit={h.handleCreate}
        formPedidoItemId={h.formPedidoItemId}
        setFormPedidoItemId={h.setFormPedidoItemId}
        formPrioridade={h.formPrioridade}
        setFormPrioridade={h.setFormPrioridade}
        formPrazoInterno={h.formPrazoInterno}
        setFormPrazoInterno={h.setFormPrazoInterno}
        formTempoEstimado={h.formTempoEstimado}
        setFormTempoEstimado={h.setFormTempoEstimado}
        formObservacoes={h.formObservacoes}
        setFormObservacoes={h.setFormObservacoes}
        formMaquinaId={h.formMaquinaId}
        setFormMaquinaId={h.setFormMaquinaId}
        formDataInicioPrevista={h.formDataInicioPrevista}
        setFormDataInicioPrevista={h.setFormDataInicioPrevista}
        formDataFimPrevista={h.formDataFimPrevista}
        setFormDataFimPrevista={h.setFormDataFimPrevista}
      />

      {/* DETAIL DIALOG */}
      <OPDetailDialog
        selectedOP={h.selectedOP}
        onClose={() => h.setSelectedOP(null)}
        onUpdateStatus={(params) => h.updateStatusMutation.mutate(params)}
        onUpdateEtapa={(params) => h.updateEtapaMutation.mutate(params)}
        isStatusUpdating={h.updateStatusMutation.isPending}
        isEtapaUpdating={h.updateEtapaMutation.isPending}
      />

      {/* DESIGNAR INSTALADOR SHEET */}
      <DesignarInstaladorSheet
        open={h.designarInstaladorDialog.open}
        opId={h.designarInstaladorDialog.opId}
        onOpenChange={(open) => {
          if (!open) h.setDesignarInstaladorDialog({ open: false, opId: null });
        }}
        instaladores={h.instaladores}
        selectedInstalador={h.selectedInstalador}
        setSelectedInstalador={h.setSelectedInstalador}
        dataAgendada={h.dataAgendada}
        setDataAgendada={h.setDataAgendada}
        horaPrevista={h.horaPrevista}
        setHoraPrevista={h.setHoraPrevista}
        instrucoes={h.instrucoes}
        setInstrucoes={h.setInstrucoes}
        onDesignar={(params) => h.designarMutation.mutate(params)}
        onCriarSemDesignar={(opId) => h.criarSemDesignarMutation.mutate(opId)}
        isDesignarPending={h.designarMutation.isPending}
        isCriarSemDesignarPending={h.criarSemDesignarMutation.isPending}
      />
    </div>
  );
}
