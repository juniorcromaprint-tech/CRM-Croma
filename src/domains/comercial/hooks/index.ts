// ─── Comercial Hooks — Barrel Export ────────────────────────────────────────
// Croma Print ERP/CRM — Módulo Comercial
// ────────────────────────────────────────────────────────────────────────────

// Leads
export {
  useLeads,
  useLead,
  useCreateLead,
  useUpdateLead,
  useLeadStats,
} from './useLeads';

export type {
  Lead,
  LeadCreate,
  LeadUpdate,
  LeadFilters,
  LeadStatus,
  LeadTemperatura,
  LeadStageStats,
  LeadTemperaturaStats,
  LeadStats,
} from './useLeads';

// Propostas
export {
  usePropostas,
  useProposta,
  useCreateProposta,
  useUpdateProposta,
} from './usePropostas';

export type {
  Proposta,
  PropostaCreate,
  PropostaUpdate,
  PropostaFilters,
  PropostaStatus,
} from './usePropostas';

// Pipeline
export { usePipelineData } from './usePipeline';

export type {
  PipelineStage,
  PipelineData,
} from './usePipeline';

// Oportunidades
export {
  useOportunidades,
  useOportunidade,
  useCreateOportunidade,
  useUpdateOportunidade,
  useOportunidadeStats,
} from './useOportunidades';

export type {
  Oportunidade,
  OportunidadeCreate,
  OportunidadeUpdate,
  OportunidadeFilters,
  OportunidadeFase,
} from './useOportunidades';

// Atividades Comerciais
export {
  useAtividades,
  useAtividadesRecentes,
  useCreateAtividade,
} from './useAtividades';

export type {
  AtividadeComercial,
  AtividadeCreate,
  AtividadeTipo,
} from './useAtividades';

// Tarefas Comerciais
export {
  useTarefas,
  useTarefasPendentes,
  useCreateTarefa,
  useUpdateTarefa,
} from './useTarefas';

export type {
  TarefaComercial,
  TarefaCreate,
  TarefaUpdate,
  TarefaTipo,
  TarefaStatus,
  TarefaPrioridade,
} from './useTarefas';
