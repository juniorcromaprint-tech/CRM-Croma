import { z } from "zod";

// ─── Material Schemas ───────────────────────────────────────────────────────

export const materialSchema = z.object({
  id: z.string().uuid().optional(),
  codigo: z.string().optional().nullable(),
  nome: z.string().min(2, "Nome do material é obrigatório"),
  categoria: z.string().optional().nullable(),
  unidade: z.string().default("un"),
  estoque_minimo: z.number().nonnegative().default(0),
  preco_medio: z.number().nonnegative().optional().nullable(),
  localizacao: z.string().optional().nullable(),
  ativo: z.boolean().default(true),
});

export const materialCreateSchema = materialSchema.omit({ id: true });

export type Material = z.infer<typeof materialSchema>;
export type MaterialCreate = z.infer<typeof materialCreateSchema>;

// ─── Movimentação de Estoque ────────────────────────────────────────────────

export const movimentacaoTipoEnum = z.enum([
  "entrada",
  "saida",
  "reserva",
  "liberacao_reserva",
  "ajuste",
  "devolucao",
]);

export const movimentacaoSchema = z.object({
  id: z.string().uuid().optional(),
  material_id: z.string().uuid(),
  tipo: movimentacaoTipoEnum,
  quantidade: z.number().positive("Quantidade deve ser > 0"),
  referencia_tipo: z.string().optional().nullable(),
  referencia_id: z.string().uuid().optional().nullable(),
  motivo: z.string().optional().nullable(),
  usuario_id: z.string().uuid().optional().nullable(),
});

export type Movimentacao = z.infer<typeof movimentacaoSchema>;

// ─── Fornecedor Schemas ─────────────────────────────────────────────────────

export const fornecedorSchema = z.object({
  id: z.string().uuid().optional(),
  razao_social: z.string().min(2, "Razão social é obrigatória"),
  nome_fantasia: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().nullable(),
  contato_nome: z.string().optional().nullable(),
  categorias: z.array(z.string()).default([]),
  lead_time_dias: z.number().int().nonnegative().optional().nullable(),
  condicao_pagamento: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  ativo: z.boolean().default(true),
});

export const fornecedorCreateSchema = fornecedorSchema.omit({ id: true });

export type Fornecedor = z.infer<typeof fornecedorSchema>;
export type FornecedorCreate = z.infer<typeof fornecedorCreateSchema>;

// ─── Pedido de Compra ───────────────────────────────────────────────────────

export const compraStatusEnum = z.enum([
  "rascunho",
  "aprovado",
  "enviado",
  "parcial",
  "recebido",
  "cancelado",
]);

export const pedidoCompraSchema = z.object({
  id: z.string().uuid().optional(),
  numero: z.string().optional().nullable(),
  fornecedor_id: z.string().uuid({ message: "Fornecedor é obrigatório" }),
  status: compraStatusEnum.default("rascunho"),
  valor_total: z.number().nonnegative().default(0),
  previsao_entrega: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  criado_por: z.string().uuid().optional().nullable(),
  aprovado_por: z.string().uuid().optional().nullable(),
  // Soft delete
  excluido_em: z.string().optional().nullable(),
  excluido_por: z.string().uuid().optional().nullable(),
});

export const pedidoCompraCreateSchema = pedidoCompraSchema.omit({ id: true, numero: true, excluido_em: true, excluido_por: true });

export type PedidoCompra = z.infer<typeof pedidoCompraSchema>;
export type PedidoCompraCreate = z.infer<typeof pedidoCompraCreateSchema>;

// ─── Item do Pedido de Compra ───────────────────────────────────────────────

export const pedidoCompraItemSchema = z.object({
  id: z.string().uuid().optional(),
  pedido_compra_id: z.string().uuid(),
  material_id: z.string().uuid({ message: "Material é obrigatório" }),
  quantidade: z.number().positive("Quantidade deve ser > 0"),
  valor_unitario: z.number().nonnegative().optional().nullable(),
  valor_total: z.number().nonnegative().optional().nullable(),
  quantidade_recebida: z.number().nonnegative().default(0),
});

export type PedidoCompraItem = z.infer<typeof pedidoCompraItemSchema>;

// ─── Solicitação de Compra ────────────────────────────────────────────────

export const solicitacaoUrgenciaEnum = z.enum(["baixa", "normal", "alta", "critica"]);
export const solicitacaoOrigemEnum = z.enum(["manual", "automatica", "producao"]);
export const solicitacaoStatusEnum = z.enum(["pendente", "aprovada", "cotando", "comprada", "cancelada"]);

export const solicitacaoCompraSchema = z.object({
  id: z.string().uuid().optional(),
  numero: z.string().optional().nullable(),
  material_id: z.string().uuid({ message: "Material é obrigatório" }),
  quantidade: z.number().positive("Quantidade deve ser > 0"),
  urgencia: solicitacaoUrgenciaEnum.default("normal"),
  origem: solicitacaoOrigemEnum.default("manual"),
  referencia_tipo: z.string().optional().nullable(),
  referencia_id: z.string().uuid().optional().nullable(),
  solicitante_id: z.string().uuid().optional().nullable(),
  status: solicitacaoStatusEnum.default("pendente"),
  observacoes: z.string().optional().nullable(),
});

export const solicitacaoCompraCreateSchema = solicitacaoCompraSchema.omit({ id: true, numero: true });

export type SolicitacaoCompra = z.infer<typeof solicitacaoCompraSchema>;
export type SolicitacaoCompraCreate = z.infer<typeof solicitacaoCompraCreateSchema>;

// ─── Cotação de Compra ────────────────────────────────────────────────────

export const cotacaoCompraSchema = z.object({
  id: z.string().uuid().optional(),
  solicitacao_id: z.string().uuid().optional().nullable(),
  fornecedor_id: z.string().uuid({ message: "Fornecedor é obrigatório" }),
  material_id: z.string().uuid({ message: "Material é obrigatório" }),
  quantidade: z.number().positive("Quantidade deve ser > 0"),
  valor_unitario: z.number().nonnegative(),
  valor_total: z.number().nonnegative(),
  prazo_entrega_dias: z.number().int().nonnegative().optional().nullable(),
  condicao_pagamento: z.string().optional().nullable(),
  validade: z.string().optional().nullable(),
  selecionada: z.boolean().default(false),
  observacoes: z.string().optional().nullable(),
});

export type CotacaoCompra = z.infer<typeof cotacaoCompraSchema>;

// ─── Recebimento de Mercadoria ────────────────────────────────────────────

export const recebimentoStatusEnum = z.enum(["pendente", "conferido", "aceito", "recusado_parcial", "recusado"]);

export const recebimentoSchema = z.object({
  id: z.string().uuid().optional(),
  pedido_compra_id: z.string().uuid(),
  fornecedor_id: z.string().uuid(),
  numero_nf: z.string().optional().nullable(),
  data_recebimento: z.string().default(() => new Date().toISOString().split("T")[0]),
  conferido_por: z.string().uuid().optional().nullable(),
  status: recebimentoStatusEnum.default("pendente"),
  observacoes: z.string().optional().nullable(),
});

export type Recebimento = z.infer<typeof recebimentoSchema>;

export const recebimentoItemSchema = z.object({
  id: z.string().uuid().optional(),
  recebimento_id: z.string().uuid(),
  pedido_compra_item_id: z.string().uuid(),
  material_id: z.string().uuid(),
  quantidade_esperada: z.number().nonnegative(),
  quantidade_recebida: z.number().nonnegative(),
  quantidade_aceita: z.number().nonnegative().default(0),
  motivo_recusa: z.string().optional().nullable(),
});

export type RecebimentoItem = z.infer<typeof recebimentoItemSchema>;

// ─── Inventário de Estoque ────────────────────────────────────────────────

export const estoqueInventarioSchema = z.object({
  id: z.string().uuid().optional(),
  material_id: z.string().uuid(),
  quantidade_sistema: z.number().nonnegative(),
  quantidade_contada: z.number().nonnegative(),
  diferenca: z.number(),
  responsavel_id: z.string().uuid().optional().nullable(),
  ajustado: z.boolean().default(false),
  movimentacao_id: z.string().uuid().optional().nullable(),
  data_contagem: z.string().default(() => new Date().toISOString().split("T")[0]),
  observacoes: z.string().optional().nullable(),
});

export type EstoqueInventario = z.infer<typeof estoqueInventarioSchema>;
