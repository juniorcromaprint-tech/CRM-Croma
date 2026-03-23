import { useState, useMemo, useCallback, useRef, useEffect, type DragEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ilikeTerm } from "@/shared/utils/searchUtils";
import { criarOrdemInstalacao } from "@/domains/instalacao/services/instalacao-criacao.service";
import { finalizarCustosOP, liberarReserva } from "@/domains/producao/services/producao.service";
import { PRODUCAO_STATUS_CONFIG, type ProducaoStatus } from "@/shared/constants/status";
import { showSuccess, showError } from "@/utils/toast";
import { toast } from "sonner";
import {
  generateNumero,
  getProgressPercent,
} from "../utils/producao.helpers";
import {
  PAGE_SIZE,
  ETAPA_NOMES,
  STATUS_TRANSITIONS,
  KANBAN_COLUMNS,
  KANBAN_DROP_STATUS,
  type OrdemProducaoRow,
  type MaquinaOption,
  type PedidoItemOption,
} from "../types/producao.types";

export function useProducaoOrdens() {
  const queryClient = useQueryClient();

  // --- Core state ---
  const [viewMode, setViewMode] = useState<"kanban" | "lista">("kanban");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [prioridadeFilter, setPrioridadeFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedOP, setSelectedOP] = useState<OrdemProducaoRow | null>(null);
  const [page, setPage] = useState(0);

  // --- Create form ---
  const [formPedidoItemId, setFormPedidoItemId] = useState("");
  const [formPrioridade, setFormPrioridade] = useState("0");
  const [formPrazoInterno, setFormPrazoInterno] = useState("");
  const [formTempoEstimado, setFormTempoEstimado] = useState("");
  const [formObservacoes, setFormObservacoes] = useState("");
  const [formMaquinaId, setFormMaquinaId] = useState("");
  const [formDataInicioPrevista, setFormDataInicioPrevista] = useState("");
  const [formDataFimPrevista, setFormDataFimPrevista] = useState("");

  // --- Drag & drop ---
  const [draggedOPId, setDraggedOPId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const dragCounterRef = useRef<Record<string, number>>({});
  const isDragDropUpdate = useRef(false);

  // --- Designar instalador ---
  const [designarInstaladorDialog, setDesignarInstaladorDialog] = useState<{
    open: boolean;
    opId: string | null;
  }>({ open: false, opId: null });
  const [selectedInstalador, setSelectedInstalador] = useState('');
  const [dataAgendada, setDataAgendada] = useState('');
  const [horaPrevista, setHoraPrevista] = useState('');
  const [instrucoes, setInstrucoes] = useState('');

  useEffect(() => {
    if (designarInstaladorDialog.open) {
      setSelectedInstalador('');
      setDataAgendada('');
      setHoraPrevista('');
      setInstrucoes('');
    }
  }, [designarInstaladorDialog.open]);

  useEffect(() => {
    setPage(0);
  }, [searchTerm, statusFilter, prioridadeFilter]);

  // =========================================================================
  // QUERIES
  // =========================================================================

  const {
    data: ordensResult,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["producao", "ordens", page, statusFilter, prioridadeFilter, searchTerm],
    queryFn: async () => {
      let q = supabase
        .from("ordens_producao")
        .select(
          "*, pedido_itens(descricao, especificacao, quantidade, modelo_id, pedidos(numero, clientes(nome_fantasia, razao_social))), producao_etapas(*)",
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== "all") {
        q = q.eq("status", statusFilter);
      }

      if (prioridadeFilter !== "all") {
        q = q.eq("prioridade", parseInt(prioridadeFilter, 10));
      }

      if (searchTerm.trim()) {
        q = q.or(
          `numero.ilike.${ilikeTerm(searchTerm)},pedido_itens.descricao.ilike.${ilikeTerm(searchTerm)}`
        );
      }

      const { data, error, count } = await q;
      if (error) throw error;
      return { data: (data ?? []) as unknown as OrdemProducaoRow[], total: count ?? 0 };
    },
  });

  const ordens = ordensResult?.data ?? [];
  const totalOrdens = ordensResult?.total ?? 0;
  const totalOrdensPages = Math.ceil(totalOrdens / PAGE_SIZE);

  const { data: pedidoItens = [] } = useQuery({
    queryKey: ["producao", "pedido-itens-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedido_itens")
        .select(
          "id, descricao, especificacao, quantidade, custo_mp, custo_mo, pedido_id, pedidos!inner(numero, clientes(nome_fantasia, razao_social))"
        )
        .not("pedido_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as unknown as PedidoItemOption[];
    },
  });

  const { data: maquinas = [] } = useQuery({
    queryKey: ["producao", "maquinas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maquinas")
        .select("id, nome, tipo, ativo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as MaquinaOption[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: instaladores = [] } = useQuery({
    queryKey: ['instaladores-campo'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('profiles')
        .select('id, first_name, last_name, cnh_validade, cnh_categoria')
        .eq('role', 'instalador')
        .order('first_name');
      return data ?? [];
    },
  });

  // =========================================================================
  // MUTATIONS
  // =========================================================================

  const designarMutation = useMutation({
    mutationFn: async ({ opId, equipeId, dataAgendadaVal, horaPrevistaVal, instrucoesVal }: {
      opId: string;
      equipeId: string;
      dataAgendadaVal: string;
      horaPrevistaVal?: string;
      instrucoesVal?: string;
    }) => {
      await criarOrdemInstalacao(opId, {
        equipeId,
        dataAgendada: dataAgendadaVal,
        horaPrevista: horaPrevistaVal,
        instrucoes: instrucoesVal,
      });
    },
    onSuccess: () => {
      showSuccess('Ordem de instalação criada e instalador designado!');
      setDesignarInstaladorDialog({ open: false, opId: null });
      queryClient.invalidateQueries({ queryKey: ['producao'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-instalacao-erp'] });
    },
    onError: (err: Error) => showError(err.message),
  });

  const criarSemDesignarMutation = useMutation({
    mutationFn: async (opId: string) => {
      await criarOrdemInstalacao(opId);
    },
    onSuccess: () => {
      showSuccess('Ordem de instalação criada — aguardando agendamento');
      setDesignarInstaladorDialog({ open: false, opId: null });
      queryClient.invalidateQueries({ queryKey: ['producao'] });
    },
    onError: (err: Error) => showError(err.message),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const numero = generateNumero();
      const selectedItem = pedidoItens.find((pi) => pi.id === formPedidoItemId);
      const pedidoId = selectedItem?.pedido_id ?? null;

      const { data: opData, error: opError } = await supabase
        .from("ordens_producao")
        .insert({
          numero,
          pedido_item_id: formPedidoItemId || null,
          pedido_id: pedidoId,
          status: "aguardando_programacao" as ProducaoStatus,
          prioridade: parseInt(formPrioridade, 10),
          prazo_interno: formPrazoInterno || null,
          tempo_estimado_min: formTempoEstimado ? parseInt(formTempoEstimado, 10) : null,
          observacoes: formObservacoes || null,
          custo_mp_estimado: Number(selectedItem?.custo_mp) || 0,
          custo_mo_estimado: Number(selectedItem?.custo_mo) || 0,
          maquina_id: formMaquinaId || null,
          data_inicio_prevista: formDataInicioPrevista || null,
          data_fim_prevista: formDataFimPrevista || null,
        })
        .select()
        .single();

      if (opError) throw opError;

      const etapas = ETAPA_NOMES.map((nome, idx) => ({
        ordem_producao_id: opData.id,
        nome,
        ordem: idx,
        status: "pendente",
      }));

      const { error: etapaError } = await supabase
        .from("producao_etapas")
        .insert(etapas);

      if (etapaError) throw etapaError;

      return opData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["producao"] });
      showSuccess("Ordem de produção criada com sucesso!");
      resetCreateForm();
      setIsCreateOpen(false);
    },
    onError: (err: Error) => {
      showError(`Erro ao criar OP: ${err.message}`);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: ProducaoStatus }) => {
      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === "em_producao" || newStatus === "em_fila") {
        updates.data_inicio = updates.data_inicio ?? new Date().toISOString();
      }
      if (newStatus === "finalizado") {
        updates.data_conclusao = new Date().toISOString();
      }

      const { error } = await supabase
        .from("ordens_producao")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      if (newStatus === "cancelada") {
        await liberarReserva(id);
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["producao"] });
      if (!isDragDropUpdate.current) {
        const label = PRODUCAO_STATUS_CONFIG[variables.newStatus]?.label ?? variables.newStatus;
        showSuccess(`Status atualizado para "${label}"`);
      }
      isDragDropUpdate.current = false;
      setSelectedOP(null);
    },
    onError: (err: Error) => {
      isDragDropUpdate.current = false;
      showError(`Erro ao atualizar status: ${err.message}`);
    },
  });

  const updateEtapaMutation = useMutation({
    mutationFn: async ({
      etapaId,
      newStatus,
      opId,
    }: {
      etapaId: string;
      newStatus: string;
      opId?: string;
    }) => {
      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === "em_andamento") {
        updates.inicio = new Date().toISOString();
      }
      if (newStatus === "concluida") {
        updates.fim = new Date().toISOString();
      }

      const { error } = await supabase
        .from("producao_etapas")
        .update(updates)
        .eq("id", etapaId);

      if (error) throw error;

      if (newStatus === "concluida" && opId) {
        const { data: etapas } = await supabase
          .from("producao_etapas")
          .select("status, inicio, fim")
          .eq("ordem_producao_id", opId);

        const tempoReal = (etapas ?? []).reduce((acc, e) => {
          if (e.inicio && e.fim) {
            return acc + Math.round((new Date(e.fim).getTime() - new Date(e.inicio).getTime()) / 60000);
          }
          return acc;
        }, 0);
        if (tempoReal > 0) {
          await supabase
            .from("ordens_producao")
            .update({ tempo_real_min: tempoReal })
            .eq("id", opId);
        }

        const allDone = etapas?.every((e) => e.status === "concluida");
        if (allDone) {
          await supabase
            .from("ordens_producao")
            .update({ status: "finalizado" })
            .eq("id", opId);
          await finalizarCustosOP(opId);
          setDesignarInstaladorDialog({ open: true, opId });
        }
      }
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["producao"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["instalacoes"] });
      if (variables.opId && selectedOP?.id === variables.opId) {
        const { data: freshOP } = await supabase
          .from("ordens_producao")
          .select("*, pedido_itens(descricao, especificacao, quantidade, pedidos(numero, clientes(nome_fantasia, razao_social))), producao_etapas(*)")
          .eq("id", variables.opId)
          .single();
        if (freshOP) setSelectedOP(freshOP as unknown as OrdemProducaoRow);
      }
      showSuccess("Etapa atualizada!");
    },
    onError: (err: Error) => {
      showError(`Erro ao atualizar etapa: ${err.message}`);
    },
  });

  // =========================================================================
  // COMPUTED
  // =========================================================================

  const filtered = ordens;

  const stats = useMemo(() => {
    const emFila = ordens.filter(
      (op) => op.status === "aguardando_programacao" || op.status === "em_fila"
    ).length;
    const emProducao = ordens.filter(
      (op) => op.status === "em_producao" || op.status === "em_acabamento"
    ).length;
    const emConferencia = ordens.filter(
      (op) => op.status === "em_conferencia"
    ).length;

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const finalizadasMes = ordens.filter(
      (op) =>
        op.status === "finalizado" &&
        op.data_conclusao &&
        new Date(op.data_conclusao) >= firstDay
    ).length;

    return { emFila, emProducao, emConferencia, finalizadasMes };
  }, [ordens]);

  const opsByColumn = useMemo(() => {
    const result: Record<string, OrdemProducaoRow[]> = {};
    for (const col of KANBAN_COLUMNS) {
      result[col.key] = filtered.filter((op) => {
        if (!col.statuses.includes(op.status)) return false;
        const progress = getProgressPercent(op.producao_etapas);
        if (progress >= 100 && col.key !== 'liberado' && col.key !== 'retrabalho') return false;
        return true;
      });
    }
    return result;
  }, [filtered]);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  function resetCreateForm() {
    setFormPedidoItemId("");
    setFormPrioridade("0");
    setFormPrazoInterno("");
    setFormTempoEstimado("");
    setFormObservacoes("");
    setFormMaquinaId("");
    setFormDataInicioPrevista("");
    setFormDataFimPrevista("");
  }

  function handleCreate() {
    createMutation.mutate();
  }

  function openCreateDialog() {
    resetCreateForm();
    setIsCreateOpen(true);
  }

  // --- Drag & Drop ---
  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>, opId: string) => {
      e.dataTransfer.setData("text/plain", opId);
      e.dataTransfer.effectAllowed = "move";
      setDraggedOPId(opId);
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDraggedOPId(null);
    setDragOverColumn(null);
    dragCounterRef.current = {};
  }, []);

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>, colKey: string) => {
      e.preventDefault();
      dragCounterRef.current[colKey] = (dragCounterRef.current[colKey] || 0) + 1;
      setDragOverColumn(colKey);
    },
    []
  );

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>, colKey: string) => {
      e.preventDefault();
      dragCounterRef.current[colKey] = (dragCounterRef.current[colKey] || 0) - 1;
      if (dragCounterRef.current[colKey] <= 0) {
        dragCounterRef.current[colKey] = 0;
        setDragOverColumn((prev) => (prev === colKey ? null : prev));
      }
    },
    []
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>, colKey: string) => {
      e.preventDefault();
      setDragOverColumn(null);
      dragCounterRef.current = {};

      const opId = e.dataTransfer.getData("text/plain");
      if (!opId) return;

      const op = ordens.find((o) => o.id === opId);
      if (!op) return;

      const targetStatus = KANBAN_DROP_STATUS[colKey];
      if (!targetStatus) return;
      if (op.status === targetStatus) return;

      const allowed = STATUS_TRANSITIONS[op.status];
      if (!allowed.includes(targetStatus)) {
        const fromLabel = PRODUCAO_STATUS_CONFIG[op.status]?.label ?? op.status;
        const toLabel = PRODUCAO_STATUS_CONFIG[targetStatus]?.label ?? targetStatus;
        showError(
          `Transição inválida: ${fromLabel} -> ${toLabel}. Verifique o fluxo de produção.`
        );
        return;
      }

      const previousStatus = op.status;
      const toLabel = PRODUCAO_STATUS_CONFIG[targetStatus]?.label ?? targetStatus;
      isDragDropUpdate.current = true;
      updateStatusMutation.mutate(
        { id: opId, newStatus: targetStatus },
        {
          onSuccess: () => {
            toast.info(`OP ${op.numero} movida para "${toLabel}"`, {
              action: {
                label: "Desfazer",
                onClick: () => {
                  updateStatusMutation.mutate({ id: opId, newStatus: previousStatus });
                },
              },
              duration: 5000,
            });
          },
        }
      );
    },
    [ordens, updateStatusMutation]
  );

  return {
    // State
    viewMode, setViewMode,
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    prioridadeFilter, setPrioridadeFilter,
    isCreateOpen, setIsCreateOpen,
    selectedOP, setSelectedOP,
    page, setPage,

    // Create form
    formPedidoItemId, setFormPedidoItemId,
    formPrioridade, setFormPrioridade,
    formPrazoInterno, setFormPrazoInterno,
    formTempoEstimado, setFormTempoEstimado,
    formObservacoes, setFormObservacoes,
    formMaquinaId, setFormMaquinaId,
    formDataInicioPrevista, setFormDataInicioPrevista,
    formDataFimPrevista, setFormDataFimPrevista,

    // Designar
    designarInstaladorDialog, setDesignarInstaladorDialog,
    selectedInstalador, setSelectedInstalador,
    dataAgendada, setDataAgendada,
    horaPrevista, setHoraPrevista,
    instrucoes, setInstrucoes,

    // Drag & drop
    draggedOPId, dragOverColumn,

    // Query results
    ordens, filtered, totalOrdens, totalOrdensPages,
    isLoading, isError,
    pedidoItens, maquinas, instaladores,
    stats, opsByColumn,

    // Mutations
    createMutation, updateStatusMutation, updateEtapaMutation,
    designarMutation, criarSemDesignarMutation,

    // Handlers
    handleCreate, openCreateDialog,
    handleDragStart, handleDragEnd, handleDragEnter, handleDragLeave, handleDragOver, handleDrop,

    // Misc
    queryClient,
  };
}
