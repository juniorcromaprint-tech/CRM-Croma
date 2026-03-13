import { z } from "zod";

/** Returns today's date as "yyyy-MM-dd" in local timezone (avoids UTC offset bug). */
function localDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Contas a Receber ───────────────────────────────────────────────────────

export const contaReceberStatusEnum = z.enum([
  "previsto",
  "faturado",
  "a_vencer",
  "vencido",
  "parcial",
  "pago",
  "cancelado",
]);

export const contaReceberSchema = z.object({
  id: z.string().uuid().optional(),
  pedido_id: z.string().uuid().optional().nullable(),
  cliente_id: z.string().uuid({ message: "Cliente é obrigatório" }),
  numero_titulo: z.string().optional().nullable(),
  valor_original: z.number().positive("Valor deve ser maior que zero"),
  valor_pago: z.number().nonnegative().default(0),
  saldo: z.number().optional().nullable(),
  data_emissao: z.string().default(() => localDateStr()),
  data_vencimento: z.string({ required_error: "Data de vencimento é obrigatória" }),
  data_pagamento: z.string().optional().nullable(),
  status: contaReceberStatusEnum.default("previsto"),
  forma_pagamento: z.string().optional().nullable(),
  conta_plano_id: z.string().uuid().optional().nullable(),
  centro_custo_id: z.string().uuid().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  // Soft delete
  excluido_em: z.string().optional().nullable(),
  excluido_por: z.string().uuid().optional().nullable(),
});

export const contaReceberCreateSchema = contaReceberSchema.omit({ id: true, excluido_em: true, excluido_por: true });

export type ContaReceber = z.infer<typeof contaReceberSchema>;
export type ContaReceberCreate = z.infer<typeof contaReceberCreateSchema>;

// ─── Parcelas a Receber ─────────────────────────────────────────────────────

export const parcelaReceberStatusEnum = z.enum(["a_vencer", "vencido", "pago", "cancelado"]);

export const parcelaReceberSchema = z.object({
  id: z.string().uuid().optional(),
  conta_receber_id: z.string().uuid(),
  numero_parcela: z.number().int().positive(),
  valor: z.number().positive("Valor da parcela deve ser > 0"),
  data_vencimento: z.string(),
  data_pagamento: z.string().optional().nullable(),
  status: parcelaReceberStatusEnum.default("a_vencer"),
});

export type ParcelaReceber = z.infer<typeof parcelaReceberSchema>;

// ─── Contas a Pagar ─────────────────────────────────────────────────────────

export const contaPagarStatusEnum = z.enum([
  "a_pagar",
  "vencido",
  "parcial",
  "pago",
  "cancelado",
]);

export const contaPagarSchema = z.object({
  id: z.string().uuid().optional(),
  pedido_compra_id: z.string().uuid().optional().nullable(),
  fornecedor_id: z.string().uuid().optional().nullable(),
  categoria: z.string().optional().nullable(),
  numero_titulo: z.string().optional().nullable(),
  numero_nf: z.string().optional().nullable(),
  valor_original: z.number().positive("Valor deve ser maior que zero"),
  valor_pago: z.number().nonnegative().default(0),
  saldo: z.number().optional().nullable(),
  data_emissao: z.string().default(() => localDateStr()),
  data_vencimento: z.string({ required_error: "Data de vencimento é obrigatória" }),
  data_pagamento: z.string().optional().nullable(),
  status: contaPagarStatusEnum.default("a_pagar"),
  forma_pagamento: z.string().optional().nullable(),
  conta_plano_id: z.string().uuid().optional().nullable(),
  centro_custo_id: z.string().uuid().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  // Soft delete
  excluido_em: z.string().optional().nullable(),
  excluido_por: z.string().uuid().optional().nullable(),
});

export const contaPagarCreateSchema = contaPagarSchema.omit({ id: true, excluido_em: true, excluido_por: true });

export type ContaPagar = z.infer<typeof contaPagarSchema>;
export type ContaPagarCreate = z.infer<typeof contaPagarCreateSchema>;

// ─── Comissões ──────────────────────────────────────────────────────────────

export const comissaoStatusEnum = z.enum(["gerada", "aprovada", "paga", "cancelada"]);

export const comissaoSchema = z.object({
  id: z.string().uuid().optional(),
  vendedor_id: z.string().uuid(),
  pedido_id: z.string().uuid(),
  conta_receber_id: z.string().uuid().optional().nullable(),
  percentual: z.number().positive().max(100),
  valor_base: z.number().positive(),
  valor_comissao: z.number().positive(),
  status: comissaoStatusEnum.default("gerada"),
  data_pagamento: z.string().optional().nullable(),
  // Soft delete
  excluido_em: z.string().optional().nullable(),
  excluido_por: z.string().uuid().optional().nullable(),
});

export type Comissao = z.infer<typeof comissaoSchema>;

// ─── Plano de Contas ────────────────────────────────────────────────────────

export const planoContasTipoEnum = z.enum(["receita", "custo", "despesa"]);

export const planoContasSchema = z.object({
  id: z.string().uuid().optional(),
  codigo: z.string().min(1, "Código é obrigatório"),
  nome: z.string().min(2, "Nome da conta é obrigatório"),
  tipo: planoContasTipoEnum,
  grupo: z.string().optional().nullable(),
  ativo: z.boolean().default(true),
});

export type PlanoContas = z.infer<typeof planoContasSchema>;

// ─── Centro de Custo ────────────────────────────────────────────────────────

export const centroCustoSchema = z.object({
  id: z.string().uuid().optional(),
  codigo: z.string().min(1, "Código é obrigatório"),
  nome: z.string().min(2, "Nome do centro de custo é obrigatório"),
  ativo: z.boolean().default(true),
});

export type CentroCusto = z.infer<typeof centroCustoSchema>;

// ─── Lançamento de Caixa (Fluxo de Caixa Real) ────────────────────────────

export const lancamentoCaixaTipoEnum = z.enum(["entrada", "saida"]);

export const lancamentoCaixaSchema = z.object({
  id: z.string().uuid().optional(),
  tipo: lancamentoCaixaTipoEnum,
  categoria: z.string().min(1, "Categoria é obrigatória"),
  descricao: z.string().min(1, "Descrição é obrigatória"),
  valor: z.number().positive("Valor deve ser maior que zero"),
  data_lancamento: z.string().default(() => localDateStr()),
  conta_receber_id: z.string().uuid().optional().nullable(),
  conta_pagar_id: z.string().uuid().optional().nullable(),
  conta_plano_id: z.string().uuid().optional().nullable(),
  centro_custo_id: z.string().uuid().optional().nullable(),
  comprovante_url: z.string().url().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  registrado_por: z.string().uuid().optional().nullable(),
});

export const lancamentoCaixaCreateSchema = lancamentoCaixaSchema.omit({ id: true });

export type LancamentoCaixa = z.infer<typeof lancamentoCaixaSchema>;
export type LancamentoCaixaCreate = z.infer<typeof lancamentoCaixaCreateSchema>;
