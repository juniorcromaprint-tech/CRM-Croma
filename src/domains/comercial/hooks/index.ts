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
