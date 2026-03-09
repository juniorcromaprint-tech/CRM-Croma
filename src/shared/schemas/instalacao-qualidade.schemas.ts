import { z } from "zod";

// ─── Ordem de Instalação ────────────────────────────────────────────────────

export const instalacaoStatusEnum = z.enum([
  "aguardando_agendamento",
  "agendada",
  "equipe_em_deslocamento",
  "em_execucao",
  "pendente",
  "reagendada",
  "concluida",
  "nao_concluida",
]);

export const ordemInstalacaoSchema = z.object({
  id: z.string().uuid().optional(),
  numero: z.string().optional().nullable(),
  pedido_id: z.string().uuid(),
  pedido_item_id: z.string().uuid().optional().nullable(),
  cliente_id: z.string().uuid(),
  unidade_id: z.string().uuid().optional().nullable(),
  equipe_id: z.string().uuid().optional().nullable(),
  status: instalacaoStatusEnum.default("aguardando_agendamento"),
  data_agendada: z.string().optional().nullable(),
  hora_prevista: z.string().optional().nullable(),
  data_execucao: z.string().optional().nullable(),
  endereco_completo: z.string().optional().nullable(),
  instrucoes: z.string().optional().nullable(),
  materiais_necessarios: z.string().optional().nullable(),
  custo_logistico: z.number().nonnegative().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  motivo_reagendamento: z.string().optional().nullable(),
  // Soft delete
  excluido_em: z.string().optional().nullable(),
  excluido_por: z.string().uuid().optional().nullable(),
});

export const ordemInstalacaoCreateSchema = ordemInstalacaoSchema.omit({ id: true, numero: true, excluido_em: true, excluido_por: true });

export type OrdemInstalacao = z.infer<typeof ordemInstalacaoSchema>;
export type OrdemInstalacaoCreate = z.infer<typeof ordemInstalacaoCreateSchema>;

// ─── Field Task (App de Campo) ──────────────────────────────────────────────

export const fieldTaskStatusEnum = z.enum([
  "atribuida",
  "em_deslocamento",
  "em_execucao",
  "concluida",
  "nao_concluida",
]);

export const fieldTaskSchema = z.object({
  id: z.string().uuid().optional(),
  ordem_instalacao_id: z.string().uuid(),
  tecnico_id: z.string().uuid(),
  status: fieldTaskStatusEnum.default("atribuida"),
  inicio: z.string().optional().nullable(),
  fim: z.string().optional().nullable(),
  latitude_inicio: z.number().optional().nullable(),
  longitude_inicio: z.number().optional().nullable(),
  latitude_fim: z.number().optional().nullable(),
  longitude_fim: z.number().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export type FieldTask = z.infer<typeof fieldTaskSchema>;

// ─── Checklist de Campo ─────────────────────────────────────────────────────

export const fieldChecklistTipoEnum = z.enum(["pre", "pos"]);

export const fieldChecklistSchema = z.object({
  id: z.string().uuid().optional(),
  field_task_id: z.string().uuid(),
  tipo: fieldChecklistTipoEnum.default("pre"),
  item: z.string().min(1, "Item do checklist é obrigatório"),
  marcado: z.boolean().default(false),
  observacao: z.string().optional().nullable(),
  marcado_em: z.string().optional().nullable(),
});

export type FieldChecklist = z.infer<typeof fieldChecklistSchema>;

// ─── Mídia de Campo ─────────────────────────────────────────────────────────

export const fieldMediaTipoEnum = z.enum(["foto", "video"]);
export const fieldMediaMomentoEnum = z.enum(["antes", "durante", "depois"]);

export const fieldMediaSchema = z.object({
  id: z.string().uuid().optional(),
  field_task_id: z.string().uuid(),
  tipo: fieldMediaTipoEnum.default("foto"),
  momento: fieldMediaMomentoEnum,
  url: z.string().url("URL da mídia é obrigatória"),
  descricao: z.string().optional().nullable(),
});

export type FieldMedia = z.infer<typeof fieldMediaSchema>;

// ─── Assinatura Digital ─────────────────────────────────────────────────────

export const fieldSignatureSchema = z.object({
  id: z.string().uuid().optional(),
  field_task_id: z.string().uuid(),
  assinante_nome: z.string().min(2, "Nome do assinante é obrigatório"),
  assinante_cargo: z.string().optional().nullable(),
  imagem_url: z.string().url("URL da assinatura é obrigatória"),
});

export type FieldSignature = z.infer<typeof fieldSignatureSchema>;

// ─── Ocorrências / Qualidade ────────────────────────────────────────────────

export const ocorrenciaTipoEnum = z.enum([
  "retrabalho",
  "devolucao",
  "erro_producao",
  "erro_instalacao",
  "divergencia_cliente",
]);

export const ocorrenciaCausaEnum = z.enum([
  "material_defeituoso",
  "erro_operacional",
  "erro_projeto",
  "instrucao_incorreta",
  "outro",
]);

export const ocorrenciaStatusEnum = z.enum([
  "aberta",
  "em_analise",
  "em_tratativa",
  "resolvida",
  "encerrada",
]);

export const ocorrenciaSchema = z.object({
  id: z.string().uuid().optional(),
  tipo: ocorrenciaTipoEnum,
  pedido_id: z.string().uuid().optional().nullable(),
  ordem_producao_id: z.string().uuid().optional().nullable(),
  ordem_instalacao_id: z.string().uuid().optional().nullable(),
  descricao: z.string().min(10, "Descreva a ocorrência em detalhe (mín. 10 caracteres)"),
  causa: ocorrenciaCausaEnum.optional().nullable(),
  status: ocorrenciaStatusEnum.default("aberta"),
  responsavel_id: z.string().uuid().optional().nullable(),
  custo_mp: z.number().nonnegative().default(0),
  custo_mo: z.number().nonnegative().default(0),
  custo_total: z.number().nonnegative().default(0),
  impacto_prazo_dias: z.number().int().nonnegative().default(0),
  numero: z.string().optional().nullable(),
  // Soft delete
  excluido_em: z.string().optional().nullable(),
  excluido_por: z.string().uuid().optional().nullable(),
});

export const ocorrenciaCreateSchema = ocorrenciaSchema.omit({ id: true, numero: true, excluido_em: true, excluido_por: true });

export type Ocorrencia = z.infer<typeof ocorrenciaSchema>;
export type OcorrenciaCreate = z.infer<typeof ocorrenciaCreateSchema>;

// ─── Tratativa de Ocorrência ────────────────────────────────────────────────

export const ocorrenciaTratativaSchema = z.object({
  id: z.string().uuid().optional(),
  ocorrencia_id: z.string().uuid(),
  acao_corretiva: z.string().min(5, "Descreva a ação corretiva"),
  responsavel_id: z.string().uuid().optional().nullable(),
  prazo: z.string().optional().nullable(),
  data_conclusao: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export type OcorrenciaTratativa = z.infer<typeof ocorrenciaTratativaSchema>;

// ─── Checklists Padrão de Instalação (templates) ────────────────────────────

export const CHECKLIST_PRE_INSTALACAO = [
  "EPIs em uso (capacete, luvas, óculos)",
  "Ferramentas necessárias presentes",
  "Materiais conferidos com a OS",
  "Local de instalação verificado",
  "Autorização do responsável do local",
  "Fotos do estado atual (antes) registradas",
] as const;

export const CHECKLIST_POS_INSTALACAO = [
  "Instalação conforme especificação",
  "Alinhamento e nível verificados",
  "Limpeza do local realizada",
  "Teste de iluminação (se aplicável)",
  "Fotos do resultado final registradas",
  "Assinatura do cliente coletada",
  "Resíduos e embalagens recolhidos",
] as const;

// ─── Membro de Equipe ────────────────────────────────────────────────────

export const equipeFuncaoEnum = z.enum(["lider", "auxiliar", "motorista"]);

export const equipeMembroSchema = z.object({
  id: z.string().uuid().optional(),
  equipe_id: z.string().uuid(),
  usuario_id: z.string().uuid(),
  funcao: equipeFuncaoEnum.default("auxiliar"),
  ativo: z.boolean().default(true),
});

export type EquipeMembro = z.infer<typeof equipeMembroSchema>;

// ─── Veículo ─────────────────────────────────────────────────────────────

export const veiculoSchema = z.object({
  id: z.string().uuid().optional(),
  placa: z.string().min(7, "Placa é obrigatória"),
  tipo: z.string().min(1, "Tipo do veículo é obrigatório"),
  modelo: z.string().optional().nullable(),
  capacidade_kg: z.number().nonnegative().optional().nullable(),
  equipe_id: z.string().uuid().optional().nullable(),
  ativo: z.boolean().default(true),
});

export const veiculoCreateSchema = veiculoSchema.omit({ id: true });

export type Veiculo = z.infer<typeof veiculoSchema>;
export type VeiculoCreate = z.infer<typeof veiculoCreateSchema>;

// ─── Agenda de Instalação ────────────────────────────────────────────────

export const agendaTurnoEnum = z.enum(["manha", "tarde", "integral"]);

export const agendaInstalacaoSchema = z.object({
  id: z.string().uuid().optional(),
  equipe_id: z.string().uuid(),
  data: z.string(),
  turno: agendaTurnoEnum.default("integral"),
  disponivel: z.boolean().default(true),
  ordem_instalacao_id: z.string().uuid().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export type AgendaInstalacao = z.infer<typeof agendaInstalacaoSchema>;

// ─── Notificação do Sistema ──────────────────────────────────────────────

export const notificacaoTipoEnum = z.enum(["info", "alerta", "urgente", "acao_necessaria"]);

export const notificacaoSchema = z.object({
  id: z.string().uuid().optional(),
  usuario_id: z.string().uuid(),
  tipo: notificacaoTipoEnum,
  titulo: z.string().min(1, "Título é obrigatório"),
  mensagem: z.string().optional().nullable(),
  link: z.string().optional().nullable(),
  entidade_tipo: z.string().optional().nullable(),
  entidade_id: z.string().uuid().optional().nullable(),
  lida: z.boolean().default(false),
  lida_em: z.string().optional().nullable(),
});

export type Notificacao = z.infer<typeof notificacaoSchema>;
