/**
 * Tipos e interfaces compartilhados do Croma MCP Server
 */

// ─── Formatos de resposta ────────────────────────────────────────────────────

export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}

// ─── Paginação ───────────────────────────────────────────────────────────────

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  [key: string]: unknown; // Necessário para compatibilidade com structuredContent do MCP SDK
  total: number;
  count: number;
  offset: number;
  items: T[];
  has_more: boolean;
  next_offset?: number;
}

// ─── Tipos de domínio ────────────────────────────────────────────────────────

export interface Cliente {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
  segmento?: string;
  classificacao?: string;
  cidade?: string;
  estado?: string;
  ativo: boolean;
  created_at: string;
}

export interface Lead {
  id: string;
  empresa: string;
  contato_nome?: string;
  telefone?: string;
  email?: string;
  status: string;
  score?: number;
  segmento?: string;
  origem_id?: string;
  vendedor_id?: string;
  created_at: string;
}

export interface Proposta {
  id: string;
  numero: string;
  cliente_id: string;
  status: string;
  titulo?: string;
  total?: number;
  subtotal?: number;
  desconto_percentual?: number;
  validade_dias?: number;
  created_at: string;
}

export interface PropostaItem {
  id: string;
  proposta_id: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  largura_cm?: number;
  altura_cm?: number;
}

export interface Pedido {
  id: string;
  numero: string;
  cliente_id: string;
  proposta_id?: string;
  status: string;
  prioridade?: string;
  valor_total?: number;
  data_prometida?: string;
  created_at: string;
}

export interface OrdemProducao {
  id: string;
  numero: string;
  pedido_id: string;
  status: string;
  prioridade?: number;
  prazo_interno?: string;
  tempo_estimado_min?: number;
  responsavel_id?: string;
  created_at: string;
}

export interface ContaReceber {
  id: string;
  pedido_id?: string;
  cliente_id: string;
  numero_titulo?: string;
  valor_original: number;
  valor_pago?: number;
  saldo?: number;
  data_vencimento: string;
  data_pagamento?: string;
  status: string;
  forma_pagamento?: string;
}

export interface ContaPagar {
  id: string;
  fornecedor_id?: string;
  categoria?: string;
  numero_titulo?: string;
  valor_original: number;
  valor_pago?: number;
  saldo?: number;
  data_vencimento: string;
  status: string;
}

export interface Material {
  id: string;
  codigo?: string;
  nome: string;
  categoria?: string;
  unidade?: string;
  preco_medio?: number;
  estoque_minimo?: number;
  ativo: boolean;
}

export interface EstoqueSaldo {
  material_id: string;
  quantidade_disponivel: number;
  quantidade_reservada: number;
}

export interface OrdemInstalacao {
  id: string;
  numero: string;
  pedido_id?: string;
  cliente_id?: string;
  status: string;
  data_agendada?: string;
  endereco_completo?: string;
  equipe_id?: string;
  created_at: string;
}

// ─── Resposta MCP padrão ─────────────────────────────────────────────────────

export interface McpTextContent {
  type: "text";
  text: string;
}

export interface McpToolResult {
  content: McpTextContent[];
  structuredContent?: unknown;
}
