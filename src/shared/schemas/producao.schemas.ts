import { z } from "zod";

// ─── Ordem de Produção Schemas ──────────────────────────────────────────────

export const producaoStatusEnum = z.enum([
  "aguardando_programacao",
  "em_fila",
  "em_producao",
  "em_acabamento",
  "em_conferencia",
  "liberado",
  "retrabalho",
  "finalizado",
]);

export const ordemProducaoSchema = z.object({
  id: z.string().uuid().optional(),
  numero: z.string().optional().nullable(),
  pedido_item_id: z.string().uuid(),
  pedido_id: z.string().uuid(),
  status: producaoStatusEnum.default("aguardando_programacao"),
  prioridade: z.number().int().min(0).max(2).default(0), // 0=normal, 1=alta, 2=urgente
  responsavel_id: z.string().uuid().optional().nullable(),
  prazo_interno: z.string().optional().nullable(),
  data_inicio: z.string().optional().nullable(),
  data_conclusao: z.string().optional().nullable(),
  tempo_estimado_min: z.number().int().nonnegative().optional().nullable(),
  tempo_real_min: z.number().int().nonnegative().optional().nullable(),
  custo_mp_estimado: z.number().nonnegative().optional().nullable(),
  custo_mp_real: z.number().nonnegative().optional().nullable(),
  custo_mo_estimado: z.number().nonnegative().optional().nullable(),
  custo_mo_real: z.number().nonnegative().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  // Soft delete
  excluido_em: z.string().optional().nullable(),
  excluido_por: z.string().uuid().optional().nullable(),
});

export const ordemProducaoCreateSchema = ordemProducaoSchema.omit({ id: true, numero: true, excluido_em: true, excluido_por: true });

export type OrdemProducao = z.infer<typeof ordemProducaoSchema>;
export type OrdemProducaoCreate = z.infer<typeof ordemProducaoCreateSchema>;

// ─── Etapa de Produção Schemas ──────────────────────────────────────────────

export const etapaStatusEnum = z.enum(["pendente", "em_andamento", "concluida", "pulada"]);

export const producaoEtapaSchema = z.object({
  id: z.string().uuid().optional(),
  ordem_producao_id: z.string().uuid(),
  nome: z.string().min(1, "Nome da etapa é obrigatório"),
  ordem: z.number().int().default(0),
  status: etapaStatusEnum.default("pendente"),
  responsavel_id: z.string().uuid().optional().nullable(),
  inicio: z.string().optional().nullable(),
  fim: z.string().optional().nullable(),
  tempo_estimado_min: z.number().int().nonnegative().optional().nullable(),
  tempo_real_min: z.number().int().nonnegative().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export type ProducaoEtapa = z.infer<typeof producaoEtapaSchema>;

// ─── Checklist de Qualidade ─────────────────────────────────────────────────

export const producaoChecklistSchema = z.object({
  id: z.string().uuid().optional(),
  ordem_producao_id: z.string().uuid(),
  item: z.string().min(1, "Item do checklist é obrigatório"),
  conferido: z.boolean().default(false),
  conferido_por: z.string().uuid().optional().nullable(),
  conferido_em: z.string().optional().nullable(),
  observacao: z.string().optional().nullable(),
});

export type ProducaoChecklist = z.infer<typeof producaoChecklistSchema>;

// ─── Retrabalho ─────────────────────────────────────────────────────────────

export const retrabalhoCausaEnum = z.enum([
  "material_defeituoso",
  "erro_operacional",
  "erro_projeto",
  "instrucao_incorreta",
  "outro",
]);

export const producaoRetrabalhoSchema = z.object({
  id: z.string().uuid().optional(),
  ordem_producao_id: z.string().uuid(),
  causa: retrabalhoCausaEnum,
  descricao: z.string().min(10, "Descreva o problema em detalhe (mín. 10 caracteres)"),
  custo_adicional_mp: z.number().nonnegative().default(0),
  custo_adicional_mo: z.number().nonnegative().default(0),
  responsavel_id: z.string().uuid().optional().nullable(),
  data_registro: z.string().default(() => new Date().toISOString()),
  data_resolucao: z.string().optional().nullable(),
});

export type ProducaoRetrabalho = z.infer<typeof producaoRetrabalhoSchema>;

// ─── Apontamento de Produção ─────────────────────────────────────────────

export const apontamentoTipoEnum = z.enum(["producao", "setup", "pausa", "retrabalho"]);

export const producaoApontamentoSchema = z.object({
  id: z.string().uuid().optional(),
  producao_etapa_id: z.string().uuid(),
  ordem_producao_id: z.string().uuid(),
  operador_id: z.string().uuid(),
  inicio: z.string(),
  fim: z.string().optional().nullable(),
  tempo_minutos: z.number().int().nonnegative().optional().nullable(),
  tipo: apontamentoTipoEnum.default("producao"),
  observacoes: z.string().optional().nullable(),
});

export type ProducaoApontamento = z.infer<typeof producaoApontamentoSchema>;

// ─── Material de Produção (consumo por OP) ───────────────────────────────

export const producaoMaterialSchema = z.object({
  id: z.string().uuid().optional(),
  ordem_producao_id: z.string().uuid(),
  material_id: z.string().uuid(),
  quantidade_prevista: z.number().nonnegative().default(0),
  quantidade_consumida: z.number().nonnegative().default(0),
  custo_unitario: z.number().nonnegative().optional().nullable(),
  custo_total: z.number().nonnegative().optional().nullable(),
  movimentacao_id: z.string().uuid().optional().nullable(),
});

export type ProducaoMaterial = z.infer<typeof producaoMaterialSchema>;

// ─── Etapas Padrão da Produção (template) ───────────────────────────────────

export const ETAPAS_PRODUCAO_PADRAO = [
  { nome: "Criação/Arte", ordem: 1 },
  { nome: "Aprovação Arte", ordem: 2 },
  { nome: "Impressão", ordem: 3 },
  { nome: "Acabamento", ordem: 4 },
  { nome: "Serralheria", ordem: 5 },
  { nome: "Conferência", ordem: 6 },
  { nome: "Expedição", ordem: 7 },
] as const;

// ─── Checklist de Qualidade Padrão (template) ───────────────────────────────

export const CHECKLIST_QUALIDADE_PADRAO = [
  "Medidas conferidas conforme especificação",
  "Cores conforme arquivo aprovado",
  "Acabamento sem imperfeições visíveis",
  "Material sem danos ou amassados",
  "Corte limpo e preciso",
  "Estrutura firme e bem montada",
  "Iluminação funcionando (se aplicável)",
  "Embalagem adequada para transporte",
] as const;
