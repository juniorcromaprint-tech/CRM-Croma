// ─── Financeiro Hooks — Barrel Export ────────────────────────────────────────
// Croma Print ERP/CRM — Módulo Financeiro
// ─────────────────────────────────────────────────────────────────────────────

// Contas a Receber
export {
  useContasReceber,
  useContasReceberStats,
  useBaixaConta,
} from './useContasReceber';

export type {
  ContaReceber,
  ContaReceberCreate,
  ContaReceberUpdate,
  ContaReceberStatus,
} from './useContasReceber';

// Contas a Pagar
export {
  useContasPagar,
  useContasPagarStats,
  useCreateContaPagar,
} from './useContasPagar';

export type {
  ContaPagar,
  ContaPagarCreate,
  ContaPagarStatus,
} from './useContasPagar';
