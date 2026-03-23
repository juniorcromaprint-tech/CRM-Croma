import type { ProducaoStatus } from "@/shared/constants/status";

// ===========================================================================
// TYPES
// ===========================================================================

export interface EtapaRow {
  id: string;
  ordem_producao_id: string;
  nome: string;
  ordem: number;
  status: string;
  responsavel_id: string | null;
  inicio: string | null;
  fim: string | null;
  tempo_estimado_min: number | null;
  tempo_real_min: number | null;
  observacoes: string | null;
  created_at: string;
}

export interface PedidoItemJoin {
  descricao: string | null;
  especificacao: string | null;
  quantidade: number | null;
  modelo_id: string | null;
  pedidos: {
    numero: string;
    clientes: {
      nome_fantasia: string | null;
      razao_social: string;
    } | null;
  } | null;
}

export interface OrdemProducaoRow {
  id: string;
  numero: string;
  pedido_item_id: string | null;
  pedido_id: string | null;
  status: ProducaoStatus;
  prioridade: number;
  responsavel_id: string | null;
  prazo_interno: string | null;
  data_inicio: string | null;
  data_conclusao: string | null;
  tempo_estimado_min: number | null;
  tempo_real_min: number | null;
  custo_mp_estimado: number | null;
  custo_mp_real: number | null;
  custo_mo_estimado: number | null;
  custo_mo_real: number | null;
  observacoes: string | null;
  maquina_id: string | null;
  data_inicio_prevista: string | null;
  data_fim_prevista: string | null;
  created_at: string;
  updated_at: string;
  pedido_itens: PedidoItemJoin | null;
  producao_etapas: EtapaRow[];
}

export interface MaquinaOption {
  id: string;
  nome: string;
  tipo: string;
  ativo: boolean;
}

export interface PedidoItemOption {
  id: string;
  descricao: string | null;
  especificacao: string | null;
  quantidade: number | null;
  custo_mp: number | null;
  custo_mo: number | null;
  pedido_id: string;
  pedidos: {
    numero: string;
    clientes: {
      nome_fantasia: string | null;
      razao_social: string;
    } | null;
  } | null;
}

export interface KanbanColumn {
  key: string;
  label: string;
  statuses: ProducaoStatus[];
  color: string;
  dotColor: string;
  bgActive: string;
}

// ===========================================================================
// CONSTANTS
// ===========================================================================

export const PRIORIDADE_CONFIG: Record<number, { label: string; color: string; dotColor: string }> = {
  0: { label: "Normal", color: "bg-slate-50 text-slate-600 border-slate-200", dotColor: "bg-slate-400" },
  1: { label: "Alta", color: "bg-amber-50 text-amber-700 border-amber-200", dotColor: "bg-amber-500" },
  2: { label: "Urgente", color: "bg-red-50 text-red-700 border-red-200", dotColor: "bg-red-500" },
};

export const STATUS_BADGE_COLORS: Record<ProducaoStatus, string> = {
  aguardando_programacao: "bg-slate-100 text-slate-700 border-slate-200",
  em_fila: "bg-blue-50 text-blue-700 border-blue-200",
  em_producao: "bg-amber-50 text-amber-700 border-amber-200",
  em_acabamento: "bg-purple-50 text-purple-700 border-purple-200",
  em_conferencia: "bg-cyan-50 text-cyan-700 border-cyan-200",
  liberado: "bg-green-50 text-green-700 border-green-200",
  retrabalho: "bg-red-50 text-red-700 border-red-200",
  finalizado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelada: "bg-slate-100 text-slate-500 border-slate-200",
};

export const STATUS_TRANSITIONS: Record<ProducaoStatus, ProducaoStatus[]> = {
  aguardando_programacao: ["em_fila", "cancelada"],
  em_fila: ["em_producao", "aguardando_programacao", "cancelada"],
  em_producao: ["em_acabamento", "retrabalho", "cancelada"],
  em_acabamento: ["em_conferencia", "retrabalho", "cancelada"],
  em_conferencia: ["liberado", "retrabalho", "cancelada"],
  liberado: ["finalizado", "cancelada"],
  retrabalho: ["em_producao", "cancelada"],
  finalizado: [],
  cancelada: [],
};

export const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    key: "fila",
    label: "Fila",
    statuses: ["aguardando_programacao", "em_fila"],
    color: "bg-blue-50 border-blue-200",
    dotColor: "bg-blue-500",
    bgActive: "ring-blue-400 bg-blue-50/50",
  },
  {
    key: "producao",
    label: "Em Produção",
    statuses: ["em_producao"],
    color: "bg-amber-50 border-amber-200",
    dotColor: "bg-amber-500",
    bgActive: "ring-amber-400 bg-amber-50/50",
  },
  {
    key: "acabamento",
    label: "Acabamento",
    statuses: ["em_acabamento"],
    color: "bg-purple-50 border-purple-200",
    dotColor: "bg-purple-500",
    bgActive: "ring-purple-400 bg-purple-50/50",
  },
  {
    key: "conferencia",
    label: "Conferência",
    statuses: ["em_conferencia"],
    color: "bg-cyan-50 border-cyan-200",
    dotColor: "bg-cyan-500",
    bgActive: "ring-cyan-400 bg-cyan-50/50",
  },
  {
    key: "retrabalho",
    label: "Retrabalho",
    statuses: ["retrabalho"],
    color: "bg-red-50 border-red-200",
    dotColor: "bg-red-500",
    bgActive: "ring-red-400 bg-red-50/50",
  },
  {
    key: "liberado",
    label: "Liberado",
    statuses: ["liberado"],
    color: "bg-green-50 border-green-200",
    dotColor: "bg-green-500",
    bgActive: "ring-green-400 bg-green-50/50",
  },
];

export const KANBAN_DROP_STATUS: Record<string, ProducaoStatus> = {
  fila: "em_fila",
  producao: "em_producao",
  acabamento: "em_acabamento",
  conferencia: "em_conferencia",
  retrabalho: "retrabalho",
  liberado: "liberado",
};

export const ETAPA_NOMES = ["criacao", "impressao", "acabamento", "conferencia", "expedicao"] as const;

export const ETAPA_LABELS: Record<string, string> = {
  criacao: "Criação",
  impressao: "Impressão",
  acabamento: "Acabamento",
  serralheria: "Serralheria",
  conferencia: "Conferência",
  expedicao: "Expedição",
};

export const PAGE_SIZE = 20;
