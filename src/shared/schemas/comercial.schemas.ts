import { z } from "zod";

// ─── Lead Schemas ───────────────────────────────────────────────────────────

export const leadStatusEnum = z.enum([
  "novo",
  "em_contato",
  "qualificando",
  "qualificado",
  "descartado",
]);

export const leadSchema = z.object({
  id: z.string().uuid().optional(),
  empresa: z.string().min(2, "Nome da empresa é obrigatório"),
  contato_nome: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().nullable(),
  cargo: z.string().optional().nullable(),
  segmento: z.string().optional().nullable(),
  origem_id: z.string().uuid().optional().nullable(),
  score: z.number().int().min(0).max(100).default(0),
  status: leadStatusEnum.default("novo"),
  motivo_descarte: z.string().optional().nullable(),
  vendedor_id: z.string().uuid().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export const leadCreateSchema = leadSchema.omit({ id: true });
export const leadUpdateSchema = leadSchema.partial().required({ id: true });

export type Lead = z.infer<typeof leadSchema>;
export type LeadCreate = z.infer<typeof leadCreateSchema>;
export type LeadUpdate = z.infer<typeof leadUpdateSchema>;

// ─── Oportunidade Schemas ───────────────────────────────────────────────────

export const oportunidadeFaseEnum = z.enum([
  "aberta",
  "proposta_enviada",
  "em_negociacao",
  "ganha",
  "perdida",
]);

export const oportunidadeSchema = z.object({
  id: z.string().uuid().optional(),
  lead_id: z.string().uuid().optional().nullable(),
  cliente_id: z.string().uuid().optional().nullable(),
  titulo: z.string().min(3, "Título é obrigatório (mín. 3 caracteres)"),
  descricao: z.string().optional().nullable(),
  valor_estimado: z.number().nonnegative("Valor deve ser positivo").optional().nullable(),
  fase: oportunidadeFaseEnum.default("aberta"),
  probabilidade: z.number().int().min(0).max(100).default(50),
  data_fechamento_prevista: z.string().optional().nullable(),
  data_fechamento_real: z.string().optional().nullable(),
  motivo_perda: z.string().optional().nullable(),
  vendedor_id: z.string().uuid().optional().nullable(),
});

export const oportunidadeCreateSchema = oportunidadeSchema.omit({ id: true });

export type Oportunidade = z.infer<typeof oportunidadeSchema>;
export type OportunidadeCreate = z.infer<typeof oportunidadeCreateSchema>;

// ─── Proposta Schemas ───────────────────────────────────────────────────────

export const propostaStatusEnum = z.enum([
  "rascunho",
  "enviada",
  "em_revisao",
  "aprovada",
  "recusada",
  "expirada",
]);

export const propostaSchema = z.object({
  id: z.string().uuid().optional(),
  numero: z.string().optional().nullable(),
  oportunidade_id: z.string().uuid().optional().nullable(),
  cliente_id: z.string().uuid({ message: "Cliente é obrigatório" }),
  vendedor_id: z.string().uuid().optional().nullable(),
  versao: z.number().int().default(1),
  status: propostaStatusEnum.default("rascunho"),
  titulo: z.string().min(3, "Título da proposta é obrigatório"),
  validade_dias: z.number().int().min(1).default(10),
  subtotal: z.number().nonnegative().default(0),
  desconto_percentual: z.number().min(0).max(100).default(0),
  desconto_valor: z.number().nonnegative().default(0),
  total: z.number().nonnegative().default(0),
  condicoes_pagamento: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  aprovado_por: z.string().optional().nullable(),
  aprovado_em: z.string().optional().nullable(),
  // Soft delete
  excluido_em: z.string().optional().nullable(),
  excluido_por: z.string().uuid().optional().nullable(),
});

export const propostaCreateSchema = propostaSchema.omit({ id: true, numero: true, excluido_em: true, excluido_por: true });

export type Proposta = z.infer<typeof propostaSchema>;
export type PropostaCreate = z.infer<typeof propostaCreateSchema>;

// ─── Proposta Versão (Versionamento) ─────────────────────────────────────

export const propostaVersaoSchema = z.object({
  id: z.string().uuid().optional(),
  proposta_id: z.string().uuid(),
  versao: z.number().int().positive(),
  snapshot_itens: z.unknown(), // JSONB — array de itens da versão
  snapshot_totais: z.unknown(), // JSONB — subtotal, desconto, total
  motivo_revisao: z.string().optional().nullable(),
  criado_por: z.string().uuid().optional().nullable(),
});

export type PropostaVersao = z.infer<typeof propostaVersaoSchema>;

// ─── Proposta Item Schemas ──────────────────────────────────────────────────

export const propostaItemSchema = z.object({
  id: z.string().uuid().optional(),
  proposta_id: z.string().uuid(),
  produto_id: z.string().uuid().optional().nullable(),
  descricao: z.string().min(1, "Descrição do item é obrigatória"),
  especificacao: z.string().optional().nullable(),
  quantidade: z.number().positive("Quantidade deve ser maior que zero").default(1),
  unidade: z.string().default("un"),
  largura_cm: z.number().nonnegative().optional().nullable(),
  altura_cm: z.number().nonnegative().optional().nullable(),
  area_m2: z.number().nonnegative().optional().nullable(),
  custo_mp: z.number().nonnegative().optional().nullable(),
  custo_mo: z.number().nonnegative().optional().nullable(),
  custo_fixo: z.number().nonnegative().optional().nullable(),
  markup_percentual: z.number().nonnegative().optional().nullable(),
  valor_unitario: z.number().nonnegative().default(0),
  valor_total: z.number().nonnegative().default(0),
  prazo_producao_dias: z.number().int().nonnegative().optional().nullable(),
  ordem: z.number().int().default(0),
});

export const propostaItemCreateSchema = propostaItemSchema.omit({ id: true });

export type PropostaItem = z.infer<typeof propostaItemSchema>;
export type PropostaItemCreate = z.infer<typeof propostaItemCreateSchema>;

// ─── Atividade Comercial Schemas ────────────────────────────────────────────

export const atividadeTipoEnum = z.enum([
  "ligacao",
  "email",
  "visita",
  "reuniao",
  "whatsapp",
  "nota",
]);

export const atividadeComercialSchema = z.object({
  id: z.string().uuid().optional(),
  tipo: atividadeTipoEnum,
  entidade_tipo: z.string().min(1),
  entidade_id: z.string().uuid(),
  descricao: z.string().min(1, "Descrição da atividade é obrigatória"),
  data_atividade: z.string().default(() => new Date().toISOString()),
  duracao_minutos: z.number().int().nonnegative().optional().nullable(),
  resultado: z.string().optional().nullable(),
  proximo_passo: z.string().optional().nullable(),
  autor_id: z.string().uuid().optional().nullable(),
});

export type AtividadeComercial = z.infer<typeof atividadeComercialSchema>;

// ─── Tarefa Comercial Schemas ───────────────────────────────────────────────

export const tarefaTipoEnum = z.enum([
  "follow_up",
  "visita",
  "ligacao",
  "enviar_proposta",
  "outro",
]);

export const tarefaStatusEnum = z.enum([
  "pendente",
  "em_andamento",
  "concluida",
  "cancelada",
]);

export const tarefaPrioridadeEnum = z.enum([
  "baixa",
  "normal",
  "alta",
  "urgente",
]);

export const tarefaComercialSchema = z.object({
  id: z.string().uuid().optional(),
  tipo: tarefaTipoEnum.default("follow_up"),
  titulo: z.string().min(3, "Título da tarefa é obrigatório"),
  descricao: z.string().optional().nullable(),
  entidade_tipo: z.string().optional().nullable(),
  entidade_id: z.string().uuid().optional().nullable(),
  responsavel_id: z.string().uuid().optional().nullable(),
  data_prevista: z.string({ required_error: "Data prevista é obrigatória" }),
  data_conclusao: z.string().optional().nullable(),
  status: tarefaStatusEnum.default("pendente"),
  prioridade: tarefaPrioridadeEnum.default("normal"),
});

export type TarefaComercial = z.infer<typeof tarefaComercialSchema>;

// ─── Acabamento Schemas ──────────────────────────────────────────────────────

export const acabamentoSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(2, "Nome é obrigatório"),
  descricao: z.string().optional().nullable(),
  custo_unitario: z.number().min(0, "Custo deve ser positivo").default(0),
  unidade: z.string().default("un"),
  ativo: z.boolean().default(true),
  ordem: z.number().int().default(0),
});

export const acabamentoCreateSchema = acabamentoSchema.omit({ id: true });

export type Acabamento = z.infer<typeof acabamentoSchema>;
export type AcabamentoCreate = z.infer<typeof acabamentoCreateSchema>;

// ─── Serviço Schemas ─────────────────────────────────────────────────────────

export const servicoCategoriaEnum = z.enum([
  "criacao",
  "instalacao",
  "montagem",
  "transporte",
  "consultoria",
  "outro",
]);

export const servicoSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(2, "Nome é obrigatório"),
  descricao: z.string().optional().nullable(),
  custo_hora: z.number().min(0).default(0),
  horas_estimadas: z.number().min(0).default(1),
  preco_fixo: z.number().min(0).optional().nullable(),
  categoria: servicoCategoriaEnum.default("outro"),
  ativo: z.boolean().default(true),
});

export const servicoCreateSchema = servicoSchema.omit({ id: true });

export type Servico = z.infer<typeof servicoSchema>;
export type ServicoCreate = z.infer<typeof servicoCreateSchema>;

// ─── Regra de Precificação Schemas ───────────────────────────────────────────

export const regraTipoEnum = z.enum([
  "markup_minimo",
  "markup_padrao",
  "desconto_maximo",
  "preco_m2_minimo",
  "taxa_urgencia",
]);

export const regraPrecificacaoSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(2, "Nome da regra é obrigatório"),
  categoria: z.string().optional().nullable(),
  tipo: regraTipoEnum,
  valor: z.number().min(0, "Valor deve ser positivo"),
  ativo: z.boolean().default(true),
  criado_por: z.string().uuid().optional().nullable(),
});

export const regraPrecificacaoCreateSchema = regraPrecificacaoSchema.omit({ id: true });

export type RegraPrecificacao = z.infer<typeof regraPrecificacaoSchema>;
export type RegraPrecificacaoCreate = z.infer<typeof regraPrecificacaoCreateSchema>;

// ─── Template de Orçamento Schemas ───────────────────────────────────────────

export const templateItemSchema = z.object({
  produto_id: z.string().uuid().optional().nullable(),
  descricao: z.string().min(1),
  quantidade: z.number().positive().default(1),
  largura_cm: z.number().positive().optional().nullable(),
  altura_cm: z.number().positive().optional().nullable(),
  acabamentos: z.array(z.string().uuid()).default([]),
});

export const templateOrcamentoSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(2, "Nome do template é obrigatório"),
  descricao: z.string().optional().nullable(),
  categoria: z.string().optional().nullable(),
  itens: z.array(templateItemSchema).default([]),
  ativo: z.boolean().default(true),
  criado_por: z.string().uuid().optional().nullable(),
});

export const templateOrcamentoCreateSchema = templateOrcamentoSchema.omit({ id: true });

export type TemplateItem = z.infer<typeof templateItemSchema>;
export type TemplateOrcamento = z.infer<typeof templateOrcamentoSchema>;
export type TemplateOrcamentoCreate = z.infer<typeof templateOrcamentoCreateSchema>;
