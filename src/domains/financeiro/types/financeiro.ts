// ============================================================================
// FINANCEIRO — Shared Types, Constants & Helpers
// ============================================================================

export type ContaReceberStatus =
  | "previsto"
  | "faturado"
  | "a_vencer"
  | "vencido"
  | "parcial"
  | "pago"
  | "cancelado";

export type ContaPagarStatus =
  | "a_pagar"
  | "vencido"
  | "parcial"
  | "pago"
  | "cancelado"
  | "pendente_aprovacao"
  | "rejeitado";

export interface ContaReceber {
  id: string;
  pedido_id: string | null;
  cliente_id: string;
  numero_titulo: string | null;
  valor_original: number;
  valor_pago: number;
  saldo: number | null;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento: string | null;
  status: ContaReceberStatus;
  forma_pagamento: string | null;
  observacoes: string | null;
  excluido_em: string | null;
  created_at: string;
  updated_at: string;
  clientes?: { nome_fantasia: string | null; razao_social: string } | null;
  pedidos?: { numero: string | null } | null;
}

export interface ContaPagar {
  id: string;
  pedido_compra_id: string | null;
  fornecedor_id: string | null;
  categoria: string | null;
  numero_titulo: string | null;
  numero_nf: string | null;
  valor_original: number;
  valor_pago: number;
  saldo: number | null;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento: string | null;
  status: ContaPagarStatus;
  forma_pagamento: string | null;
  observacoes: string | null;
  excluido_em: string | null;
  created_at: string;
  updated_at: string;
  requer_aprovacao: boolean | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  motivo_rejeicao: string | null;
  fornecedores?: { nome_fantasia: string | null; razao_social: string } | null;
}

export interface ClienteOption {
  id: string;
  nome_fantasia: string | null;
  razao_social: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const STATUS_RECEBER_CONFIG: Record<
  ContaReceberStatus,
  { label: string; className: string }
> = {
  previsto: {
    label: "Previsto",
    className: "bg-slate-50 text-slate-700 border-slate-200",
  },
  faturado: {
    label: "Faturado",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  a_vencer: {
    label: "A vencer",
    className: "bg-sky-50 text-sky-700 border-sky-200",
  },
  vencido: {
    label: "Vencido",
    className: "bg-red-50 text-red-600 border-red-200",
  },
  parcial: {
    label: "Parcial",
    className: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  pago: {
    label: "Pago",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-slate-50 text-slate-500 border-slate-200",
  },
};

export const STATUS_PAGAR_CONFIG: Record<
  ContaPagarStatus,
  { label: string; className: string }
> = {
  pendente_aprovacao: {
    label: "Aguard. Aprovação",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  rejeitado: {
    label: "Rejeitado",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  a_pagar: {
    label: "A pagar",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  vencido: {
    label: "Vencido",
    className: "bg-red-50 text-red-600 border-red-200",
  },
  parcial: {
    label: "Parcial",
    className: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  pago: {
    label: "Pago",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-slate-50 text-slate-500 border-slate-200",
  },
};

export const CATEGORIAS_PAGAR = [
  { value: "material", label: "Material" },
  { value: "servico", label: "Servico" },
  { value: "aluguel", label: "Aluguel" },
  { value: "energia", label: "Energia" },
  { value: "agua", label: "Agua" },
  { value: "internet", label: "Internet" },
  { value: "salarios", label: "Salarios" },
  { value: "impostos", label: "Impostos" },
  { value: "outro", label: "Outro" },
] as const;

const MESES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const LIMITE_AUTO_APROVACAO = 500;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns today's date as "yyyy-MM-dd" in local timezone (avoids UTC offset bug). */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Validates that a date string is parseable and within a reasonable year range. */
export function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100;
}

export function getClienteName(cr: ContaReceber): string {
  if (cr.clientes?.nome_fantasia) return cr.clientes.nome_fantasia;
  if (cr.clientes?.razao_social) return cr.clientes.razao_social;
  return "Cliente sem nome";
}

export function getFornecedorName(cp: ContaPagar): string {
  if (cp.fornecedores?.nome_fantasia) return cp.fornecedores.nome_fantasia;
  if (cp.fornecedores?.razao_social) return cp.fornecedores.razao_social;
  return cp.categoria || "Sem fornecedor";
}

export function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthLabel(key: string): string {
  const [year, month] = key.split("-");
  return `${MESES_PT[parseInt(month, 10) - 1]} ${year}`;
}

export function getLast6Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }
  return months;
}
