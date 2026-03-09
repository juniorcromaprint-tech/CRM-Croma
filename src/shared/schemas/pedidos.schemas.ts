import { z } from "zod";

// ─── Pedido Schemas ─────────────────────────────────────────────────────────

export const pedidoStatusEnum = z.enum([
  "rascunho",
  "aguardando_aprovacao",
  "aprovado",
  "em_producao",
  "produzido",
  "aguardando_instalacao",
  "em_instalacao",
  "parcialmente_concluido",
  "concluido",
  "cancelado",
]);

export const pedidoPrioridadeEnum = z.enum(["baixa", "normal", "alta", "urgente"]);

export const pedidoSchema = z.object({
  id: z.string().uuid().optional(),
  numero: z.string().optional().nullable(),
  proposta_id: z.string().uuid().optional().nullable(),
  cliente_id: z.string().uuid({ message: "Cliente é obrigatório" }),
  vendedor_id: z.string().uuid().optional().nullable(),
  status: pedidoStatusEnum.default("rascunho"),
  prioridade: pedidoPrioridadeEnum.default("normal"),
  data_prometida: z.string().optional().nullable(),
  data_conclusao: z.string().optional().nullable(),
  valor_total: z.number().nonnegative().default(0),
  custo_total: z.number().nonnegative().default(0),
  margem_real: z.number().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  aprovado_por: z.string().uuid().optional().nullable(),
  aprovado_em: z.string().optional().nullable(),
  // Soft delete
  excluido_em: z.string().optional().nullable(),
  excluido_por: z.string().uuid().optional().nullable(),
});

export const pedidoCreateSchema = pedidoSchema.omit({ id: true, numero: true, excluido_em: true, excluido_por: true });

export type Pedido = z.infer<typeof pedidoSchema>;
export type PedidoCreate = z.infer<typeof pedidoCreateSchema>;

// ─── Pedido Item Schemas ────────────────────────────────────────────────────

export const pedidoItemStatusEnum = z.enum([
  "pendente",
  "em_producao",
  "produzido",
  "em_instalacao",
  "instalado",
  "cancelado",
]);

export const pedidoItemSchema = z.object({
  id: z.string().uuid().optional(),
  pedido_id: z.string().uuid(),
  proposta_item_id: z.string().uuid().optional().nullable(),
  produto_id: z.string().uuid().optional().nullable(),
  descricao: z.string().min(1, "Descrição do item é obrigatória"),
  especificacao: z.string().optional().nullable(),
  quantidade: z.number().positive("Quantidade deve ser > 0").default(1),
  unidade: z.string().default("un"),
  valor_unitario: z.number().nonnegative().default(0),
  valor_total: z.number().nonnegative().default(0),
  status: pedidoItemStatusEnum.default("pendente"),
  arte_url: z.string().url().optional().nullable(),
  instrucoes: z.string().optional().nullable(),
  // Soft delete
  excluido_em: z.string().optional().nullable(),
  excluido_por: z.string().uuid().optional().nullable(),
});

export const pedidoItemCreateSchema = pedidoItemSchema.omit({ id: true, excluido_em: true, excluido_por: true });

export type PedidoItem = z.infer<typeof pedidoItemSchema>;
export type PedidoItemCreate = z.infer<typeof pedidoItemCreateSchema>;
