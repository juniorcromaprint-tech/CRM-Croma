// ============================================================================
// TIPOS COMUNS — Croma Print ERP/CRM
// Tipos genéricos reutilizáveis em todos os domínios
// ============================================================================

/** UUID v4 string */
export type UUID = string;

/** Data no formato ISO 8601: "2026-03-09" */
export type ISODate = string;

/** Data e hora no formato ISO 8601: "2026-03-09T14:30:00Z" */
export type ISODateTime = string;

// ---------------------------------------------------------------------------
// PAGINAÇÃO
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// UI COMPONENTS
// ---------------------------------------------------------------------------

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectOptionGroup {
  label: string;
  options: SelectOption[];
}

export interface StatusConfig {
  label: string;
  color: string;
  icon: string;
}

// ---------------------------------------------------------------------------
// TABELA / LISTAGEM
// ---------------------------------------------------------------------------

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  column: string;
  direction: SortDirection;
}

export interface FilterConfig {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in';
  value: unknown;
}

export interface TableState {
  page: number;
  pageSize: number;
  sort: SortConfig;
  filters: FilterConfig[];
  search: string;
}

// ---------------------------------------------------------------------------
// SUPABASE HELPERS
// ---------------------------------------------------------------------------

/** Resultado genérico de uma mutation no Supabase */
export interface MutationResult<T = unknown> {
  data: T | null;
  error: string | null;
}

/** Campos de auditoria padrão do Supabase */
export interface AuditFields {
  created_at: ISODateTime;
  updated_at: ISODateTime;
  created_by?: UUID;
  updated_by?: UUID;
}

// ---------------------------------------------------------------------------
// ENDEREÇO
// ---------------------------------------------------------------------------

export interface Endereco {
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
}

// ---------------------------------------------------------------------------
// CONTATO
// ---------------------------------------------------------------------------

export interface Contato {
  nome: string;
  cargo?: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  principal: boolean;
}

// ---------------------------------------------------------------------------
// ARQUIVO / ANEXO
// ---------------------------------------------------------------------------

export interface Arquivo {
  id: UUID;
  nome: string;
  url: string;
  tipo: string;
  tamanho: number;
  uploaded_at: ISODateTime;
}

// ---------------------------------------------------------------------------
// EVENTO DE HISTÓRICO
// ---------------------------------------------------------------------------

export interface HistoricoEvento {
  id: UUID;
  tipo: string;
  descricao: string;
  usuario: string;
  data: ISODateTime;
  detalhes?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// RESPOSTA DE API GENÉRICA
// ---------------------------------------------------------------------------

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
