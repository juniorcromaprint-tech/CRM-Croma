// ============================================================================
// STATUS CONSTANTS — Croma Print ERP/CRM
// Fonte única de verdade para todos os status do sistema
// ============================================================================

import type { StatusConfig } from '../types/common.types';

// ---------------------------------------------------------------------------
// COMERCIAL
// ---------------------------------------------------------------------------

export const LEAD_STATUS = {
  NOVO: 'novo',
  EM_CONTATO: 'em_contato',
  QUALIFICANDO: 'qualificando',
  QUALIFICADO: 'qualificado',
  DESCARTADO: 'descartado',
} as const;

export type LeadStatus = (typeof LEAD_STATUS)[keyof typeof LEAD_STATUS];

export const LEAD_STATUS_CONFIG: Record<LeadStatus, StatusConfig> = {
  novo: { label: 'Novo', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: 'Plus' },
  em_contato: { label: 'Em contato', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'Phone' },
  qualificando: { label: 'Qualificando', color: 'bg-purple-50 text-purple-700 border-purple-100', icon: 'Search' },
  qualificado: { label: 'Qualificado', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'CheckCircle' },
  descartado: { label: 'Descartado', color: 'bg-slate-50 text-slate-500 border-slate-100', icon: 'XCircle' },
} as const;

// ---------------------------------------------------------------------------

export const OPORTUNIDADE_FASE = {
  ABERTA: 'aberta',
  PROPOSTA_ENVIADA: 'proposta_enviada',
  EM_NEGOCIACAO: 'em_negociacao',
  GANHA: 'ganha',
  PERDIDA: 'perdida',
} as const;

export type OportunidadeFase = (typeof OPORTUNIDADE_FASE)[keyof typeof OPORTUNIDADE_FASE];

export const OPORTUNIDADE_FASE_CONFIG: Record<OportunidadeFase, StatusConfig> = {
  aberta: { label: 'Aberta', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: 'FolderOpen' },
  proposta_enviada: { label: 'Proposta enviada', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'Send' },
  em_negociacao: { label: 'Em negociação', color: 'bg-purple-50 text-purple-700 border-purple-100', icon: 'MessageSquare' },
  ganha: { label: 'Ganha', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'Trophy' },
  perdida: { label: 'Perdida', color: 'bg-red-50 text-red-700 border-red-100', icon: 'ThumbsDown' },
} as const;

// ---------------------------------------------------------------------------

export const PROPOSTA_STATUS = {
  RASCUNHO: 'rascunho',
  ENVIADA: 'enviada',
  EM_REVISAO: 'em_revisao',
  APROVADA: 'aprovada',
  RECUSADA: 'recusada',
  EXPIRADA: 'expirada',
} as const;

export type PropostaStatus = (typeof PROPOSTA_STATUS)[keyof typeof PROPOSTA_STATUS];

export const PROPOSTA_STATUS_CONFIG: Record<PropostaStatus, StatusConfig> = {
  rascunho: { label: 'Rascunho', color: 'bg-slate-50 text-slate-600 border-slate-100', icon: 'FileEdit' },
  enviada: { label: 'Enviada', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: 'Send' },
  em_revisao: { label: 'Em revisão', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'Eye' },
  aprovada: { label: 'Aprovada', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'CheckCircle2' },
  recusada: { label: 'Recusada', color: 'bg-red-50 text-red-700 border-red-100', icon: 'XCircle' },
  expirada: { label: 'Expirada', color: 'bg-gray-50 text-gray-500 border-gray-100', icon: 'Clock' },
} as const;

// ---------------------------------------------------------------------------
// PEDIDOS
// ---------------------------------------------------------------------------

export const PEDIDO_STATUS = {
  RASCUNHO: 'rascunho',
  AGUARDANDO_APROVACAO: 'aguardando_aprovacao',
  APROVADO: 'aprovado',
  EM_PRODUCAO: 'em_producao',
  PRODUZIDO: 'produzido',
  AGUARDANDO_INSTALACAO: 'aguardando_instalacao',
  EM_INSTALACAO: 'em_instalacao',
  PARCIALMENTE_CONCLUIDO: 'parcialmente_concluido',
  CONCLUIDO: 'concluido',
  CANCELADO: 'cancelado',
} as const;

export type PedidoStatus = (typeof PEDIDO_STATUS)[keyof typeof PEDIDO_STATUS];

export const PEDIDO_STATUS_CONFIG: Record<PedidoStatus, StatusConfig> = {
  rascunho: { label: 'Rascunho', color: 'bg-slate-50 text-slate-600 border-slate-100', icon: 'FileEdit' },
  aguardando_aprovacao: { label: 'Aguardando aprovação', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'Clock' },
  aprovado: { label: 'Aprovado', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: 'CheckCircle' },
  em_producao: { label: 'Em produção', color: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: 'Factory' },
  produzido: { label: 'Produzido', color: 'bg-cyan-50 text-cyan-700 border-cyan-100', icon: 'PackageCheck' },
  aguardando_instalacao: { label: 'Aguardando instalação', color: 'bg-orange-50 text-orange-700 border-orange-100', icon: 'Wrench' },
  em_instalacao: { label: 'Em instalação', color: 'bg-violet-50 text-violet-700 border-violet-100', icon: 'HardHat' },
  parcialmente_concluido: { label: 'Parcialmente concluído', color: 'bg-teal-50 text-teal-700 border-teal-100', icon: 'CircleDashed' },
  concluido: { label: 'Concluído', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'CheckCircle2' },
  cancelado: { label: 'Cancelado', color: 'bg-red-50 text-red-700 border-red-100', icon: 'Ban' },
} as const;

// ---------------------------------------------------------------------------

export const PEDIDO_ITEM_STATUS = {
  PENDENTE: 'pendente',
  EM_PRODUCAO: 'em_producao',
  PRODUZIDO: 'produzido',
  INSTALADO: 'instalado',
  CANCELADO: 'cancelado',
} as const;

export type PedidoItemStatus = (typeof PEDIDO_ITEM_STATUS)[keyof typeof PEDIDO_ITEM_STATUS];

export const PEDIDO_ITEM_STATUS_CONFIG: Record<PedidoItemStatus, StatusConfig> = {
  pendente: { label: 'Pendente', color: 'bg-slate-50 text-slate-600 border-slate-100', icon: 'Circle' },
  em_producao: { label: 'Em produção', color: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: 'Factory' },
  produzido: { label: 'Produzido', color: 'bg-cyan-50 text-cyan-700 border-cyan-100', icon: 'PackageCheck' },
  instalado: { label: 'Instalado', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'CheckCircle2' },
  cancelado: { label: 'Cancelado', color: 'bg-red-50 text-red-700 border-red-100', icon: 'Ban' },
} as const;

// ---------------------------------------------------------------------------

export const PEDIDO_PRIORIDADE = {
  BAIXA: 'baixa',
  NORMAL: 'normal',
  ALTA: 'alta',
  URGENTE: 'urgente',
} as const;

export type PedidoPrioridade = (typeof PEDIDO_PRIORIDADE)[keyof typeof PEDIDO_PRIORIDADE];

export const PEDIDO_PRIORIDADE_CONFIG: Record<PedidoPrioridade, StatusConfig> = {
  baixa: { label: 'Baixa', color: 'bg-slate-50 text-slate-600 border-slate-100', icon: 'ArrowDown' },
  normal: { label: 'Normal', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: 'Minus' },
  alta: { label: 'Alta', color: 'bg-orange-50 text-orange-700 border-orange-100', icon: 'ArrowUp' },
  urgente: { label: 'Urgente', color: 'bg-red-50 text-red-700 border-red-100', icon: 'AlertTriangle' },
} as const;

// ---------------------------------------------------------------------------
// PRODUÇÃO
// ---------------------------------------------------------------------------

export const PRODUCAO_STATUS = {
  AGUARDANDO_PROGRAMACAO: 'aguardando_programacao',
  EM_FILA: 'em_fila',
  EM_PRODUCAO: 'em_producao',
  EM_ACABAMENTO: 'em_acabamento',
  EM_CONFERENCIA: 'em_conferencia',
  LIBERADO: 'liberado',
  RETRABALHO: 'retrabalho',
  FINALIZADO: 'finalizado',
} as const;

export type ProducaoStatus = (typeof PRODUCAO_STATUS)[keyof typeof PRODUCAO_STATUS];

export const PRODUCAO_STATUS_CONFIG: Record<ProducaoStatus, StatusConfig> = {
  aguardando_programacao: { label: 'Aguardando programação', color: 'bg-slate-50 text-slate-600 border-slate-100', icon: 'CalendarClock' },
  em_fila: { label: 'Em fila', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'ListOrdered' },
  em_producao: { label: 'Em produção', color: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: 'Factory' },
  em_acabamento: { label: 'Em acabamento', color: 'bg-purple-50 text-purple-700 border-purple-100', icon: 'Scissors' },
  em_conferencia: { label: 'Em conferência', color: 'bg-cyan-50 text-cyan-700 border-cyan-100', icon: 'ClipboardCheck' },
  liberado: { label: 'Liberado', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'CheckCircle' },
  retrabalho: { label: 'Retrabalho', color: 'bg-red-50 text-red-700 border-red-100', icon: 'RotateCcw' },
  finalizado: { label: 'Finalizado', color: 'bg-green-50 text-green-700 border-green-100', icon: 'CheckCircle2' },
} as const;

// ---------------------------------------------------------------------------

export const PRODUCAO_ETAPA_STATUS = {
  AGUARDANDO: 'aguardando',
  EM_ANDAMENTO: 'em_andamento',
  PAUSADA: 'pausada',
  CONCLUIDA: 'concluida',
  RETRABALHO: 'retrabalho',
} as const;

export type ProducaoEtapaStatus = (typeof PRODUCAO_ETAPA_STATUS)[keyof typeof PRODUCAO_ETAPA_STATUS];

export const PRODUCAO_ETAPA_STATUS_CONFIG: Record<ProducaoEtapaStatus, StatusConfig> = {
  aguardando: { label: 'Aguardando', color: 'bg-slate-50 text-slate-600 border-slate-100', icon: 'Clock' },
  em_andamento: { label: 'Em andamento', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: 'Play' },
  pausada: { label: 'Pausada', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'Pause' },
  concluida: { label: 'Concluída', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'CheckCircle' },
  retrabalho: { label: 'Retrabalho', color: 'bg-red-50 text-red-700 border-red-100', icon: 'RotateCcw' },
} as const;

// ---------------------------------------------------------------------------
// INSTALAÇÃO
// ---------------------------------------------------------------------------

export const INSTALACAO_STATUS = {
  AGUARDANDO_AGENDAMENTO: 'aguardando_agendamento',
  AGENDADA: 'agendada',
  EQUIPE_EM_DESLOCAMENTO: 'equipe_em_deslocamento',
  EM_EXECUCAO: 'em_execucao',
  PENDENTE: 'pendente',
  REAGENDADA: 'reagendada',
  CONCLUIDA: 'concluida',
  NAO_CONCLUIDA: 'nao_concluida',
} as const;

export type InstalacaoStatus = (typeof INSTALACAO_STATUS)[keyof typeof INSTALACAO_STATUS];

export const INSTALACAO_STATUS_CONFIG: Record<InstalacaoStatus, StatusConfig> = {
  aguardando_agendamento: { label: 'Aguardando agendamento', color: 'bg-slate-50 text-slate-600 border-slate-100', icon: 'CalendarClock' },
  agendada: { label: 'Agendada', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: 'CalendarCheck' },
  equipe_em_deslocamento: { label: 'Equipe em deslocamento', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'Truck' },
  em_execucao: { label: 'Em execução', color: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: 'Wrench' },
  pendente: { label: 'Pendente', color: 'bg-orange-50 text-orange-700 border-orange-100', icon: 'AlertCircle' },
  reagendada: { label: 'Reagendada', color: 'bg-purple-50 text-purple-700 border-purple-100', icon: 'CalendarRange' },
  concluida: { label: 'Concluída', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'CheckCircle2' },
  nao_concluida: { label: 'Não concluída', color: 'bg-red-50 text-red-700 border-red-100', icon: 'XCircle' },
} as const;

// ---------------------------------------------------------------------------
// FINANCEIRO
// ---------------------------------------------------------------------------

export const FINANCEIRO_STATUS_RECEBER = {
  PREVISTO: 'previsto',
  FATURADO: 'faturado',
  A_VENCER: 'a_vencer',
  VENCIDO: 'vencido',
  PARCIAL: 'parcial',
  PAGO: 'pago',
  CANCELADO: 'cancelado',
} as const;

export type FinanceiroStatusReceber = (typeof FINANCEIRO_STATUS_RECEBER)[keyof typeof FINANCEIRO_STATUS_RECEBER];

export const FINANCEIRO_STATUS_RECEBER_CONFIG: Record<FinanceiroStatusReceber, StatusConfig> = {
  previsto: { label: 'Previsto', color: 'bg-slate-50 text-slate-600 border-slate-100', icon: 'Calendar' },
  faturado: { label: 'Faturado', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: 'FileText' },
  a_vencer: { label: 'A vencer', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'Clock' },
  vencido: { label: 'Vencido', color: 'bg-red-50 text-red-700 border-red-100', icon: 'AlertTriangle' },
  parcial: { label: 'Parcial', color: 'bg-orange-50 text-orange-700 border-orange-100', icon: 'CircleDashed' },
  pago: { label: 'Pago', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'CheckCircle2' },
  cancelado: { label: 'Cancelado', color: 'bg-gray-50 text-gray-500 border-gray-100', icon: 'Ban' },
} as const;

// ---------------------------------------------------------------------------

export const FINANCEIRO_STATUS_PAGAR = {
  A_PAGAR: 'a_pagar',
  VENCIDO: 'vencido',
  PARCIAL: 'parcial',
  PAGO: 'pago',
  CANCELADO: 'cancelado',
} as const;

export type FinanceiroStatusPagar = (typeof FINANCEIRO_STATUS_PAGAR)[keyof typeof FINANCEIRO_STATUS_PAGAR];

export const FINANCEIRO_STATUS_PAGAR_CONFIG: Record<FinanceiroStatusPagar, StatusConfig> = {
  a_pagar: { label: 'A pagar', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'Clock' },
  vencido: { label: 'Vencido', color: 'bg-red-50 text-red-700 border-red-100', icon: 'AlertTriangle' },
  parcial: { label: 'Parcial', color: 'bg-orange-50 text-orange-700 border-orange-100', icon: 'CircleDashed' },
  pago: { label: 'Pago', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'CheckCircle2' },
  cancelado: { label: 'Cancelado', color: 'bg-gray-50 text-gray-500 border-gray-100', icon: 'Ban' },
} as const;

// ---------------------------------------------------------------------------

export const COMISSAO_STATUS = {
  GERADA: 'gerada',
  APROVADA: 'aprovada',
  PAGA: 'paga',
  CANCELADA: 'cancelada',
} as const;

export type ComissaoStatus = (typeof COMISSAO_STATUS)[keyof typeof COMISSAO_STATUS];

export const COMISSAO_STATUS_CONFIG: Record<ComissaoStatus, StatusConfig> = {
  gerada: { label: 'Gerada', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: 'FileText' },
  aprovada: { label: 'Aprovada', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'CheckCircle' },
  paga: { label: 'Paga', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'BadgeDollarSign' },
  cancelada: { label: 'Cancelada', color: 'bg-gray-50 text-gray-500 border-gray-100', icon: 'Ban' },
} as const;

// ---------------------------------------------------------------------------
// COMPRAS / ESTOQUE
// ---------------------------------------------------------------------------

export const COMPRA_STATUS = {
  SOLICITADA: 'solicitada',
  COTANDO: 'cotando',
  APROVADA: 'aprovada',
  PEDIDO_ENVIADO: 'pedido_enviado',
  PARCIALMENTE_RECEBIDA: 'parcialmente_recebida',
  RECEBIDA: 'recebida',
  CANCELADA: 'cancelada',
} as const;

export type CompraStatus = (typeof COMPRA_STATUS)[keyof typeof COMPRA_STATUS];

export const COMPRA_STATUS_CONFIG: Record<CompraStatus, StatusConfig> = {
  solicitada: { label: 'Solicitada', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: 'FileText' },
  cotando: { label: 'Cotando', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'Search' },
  aprovada: { label: 'Aprovada', color: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: 'CheckCircle' },
  pedido_enviado: { label: 'Pedido enviado', color: 'bg-purple-50 text-purple-700 border-purple-100', icon: 'Send' },
  parcialmente_recebida: { label: 'Parcialmente recebida', color: 'bg-orange-50 text-orange-700 border-orange-100', icon: 'PackageOpen' },
  recebida: { label: 'Recebida', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'PackageCheck' },
  cancelada: { label: 'Cancelada', color: 'bg-gray-50 text-gray-500 border-gray-100', icon: 'Ban' },
} as const;

// ---------------------------------------------------------------------------

export const ESTOQUE_MOVIMENTO_TIPO = {
  ENTRADA_COMPRA: 'entrada_compra',
  ENTRADA_DEVOLUCAO: 'entrada_devolucao',
  ENTRADA_AJUSTE: 'entrada_ajuste',
  SAIDA_PRODUCAO: 'saida_producao',
  SAIDA_VENDA: 'saida_venda',
  SAIDA_PERDA: 'saida_perda',
  SAIDA_AJUSTE: 'saida_ajuste',
  TRANSFERENCIA: 'transferencia',
} as const;

export type EstoqueMovimentoTipo = (typeof ESTOQUE_MOVIMENTO_TIPO)[keyof typeof ESTOQUE_MOVIMENTO_TIPO];

export const ESTOQUE_MOVIMENTO_TIPO_CONFIG: Record<EstoqueMovimentoTipo, StatusConfig> = {
  entrada_compra: { label: 'Entrada (Compra)', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'ArrowDownToLine' },
  entrada_devolucao: { label: 'Entrada (Devolução)', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: 'CornerDownLeft' },
  entrada_ajuste: { label: 'Entrada (Ajuste)', color: 'bg-teal-50 text-teal-700 border-teal-100', icon: 'PlusCircle' },
  saida_producao: { label: 'Saída (Produção)', color: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: 'Factory' },
  saida_venda: { label: 'Saída (Venda)', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'ShoppingCart' },
  saida_perda: { label: 'Saída (Perda)', color: 'bg-red-50 text-red-700 border-red-100', icon: 'Trash2' },
  saida_ajuste: { label: 'Saída (Ajuste)', color: 'bg-orange-50 text-orange-700 border-orange-100', icon: 'MinusCircle' },
  transferencia: { label: 'Transferência', color: 'bg-purple-50 text-purple-700 border-purple-100', icon: 'ArrowLeftRight' },
} as const;

// ---------------------------------------------------------------------------
// QUALIDADE
// ---------------------------------------------------------------------------

export const OCORRENCIA_TIPO = {
  RECLAMACAO_CLIENTE: 'reclamacao_cliente',
  DEFEITO_PRODUCAO: 'defeito_producao',
  PROBLEMA_INSTALACAO: 'problema_instalacao',
  AVARIA_TRANSPORTE: 'avaria_transporte',
  MATERIAL_DEFEITUOSO: 'material_defeituoso',
  RETRABALHO: 'retrabalho',
  OUTRO: 'outro',
} as const;

export type OcorrenciaTipo = (typeof OCORRENCIA_TIPO)[keyof typeof OCORRENCIA_TIPO];

export const OCORRENCIA_TIPO_CONFIG: Record<OcorrenciaTipo, StatusConfig> = {
  reclamacao_cliente: { label: 'Reclamação do cliente', color: 'bg-red-50 text-red-700 border-red-100', icon: 'MessageSquareWarning' },
  defeito_producao: { label: 'Defeito de produção', color: 'bg-orange-50 text-orange-700 border-orange-100', icon: 'Factory' },
  problema_instalacao: { label: 'Problema na instalação', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'Wrench' },
  avaria_transporte: { label: 'Avaria no transporte', color: 'bg-purple-50 text-purple-700 border-purple-100', icon: 'Truck' },
  material_defeituoso: { label: 'Material defeituoso', color: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: 'PackageX' },
  retrabalho: { label: 'Retrabalho', color: 'bg-cyan-50 text-cyan-700 border-cyan-100', icon: 'RotateCcw' },
  outro: { label: 'Outro', color: 'bg-slate-50 text-slate-600 border-slate-100', icon: 'HelpCircle' },
} as const;

// ---------------------------------------------------------------------------

export const OCORRENCIA_STATUS = {
  ABERTA: 'aberta',
  EM_ANALISE: 'em_analise',
  EM_CORRECAO: 'em_correcao',
  AGUARDANDO_CLIENTE: 'aguardando_cliente',
  RESOLVIDA: 'resolvida',
  ENCERRADA: 'encerrada',
} as const;

export type OcorrenciaStatus = (typeof OCORRENCIA_STATUS)[keyof typeof OCORRENCIA_STATUS];

export const OCORRENCIA_STATUS_CONFIG: Record<OcorrenciaStatus, StatusConfig> = {
  aberta: { label: 'Aberta', color: 'bg-red-50 text-red-700 border-red-100', icon: 'AlertCircle' },
  em_analise: { label: 'Em análise', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'Search' },
  em_correcao: { label: 'Em correção', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: 'Wrench' },
  aguardando_cliente: { label: 'Aguardando cliente', color: 'bg-purple-50 text-purple-700 border-purple-100', icon: 'UserCheck' },
  resolvida: { label: 'Resolvida', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'CheckCircle2' },
  encerrada: { label: 'Encerrada', color: 'bg-slate-50 text-slate-500 border-slate-100', icon: 'Lock' },
} as const;

// ---------------------------------------------------------------------------

export const OCORRENCIA_CAUSA = {
  ERRO_ARTE: 'erro_arte',
  ERRO_PRODUCAO: 'erro_producao',
  ERRO_INSTALACAO: 'erro_instalacao',
  MATERIAL_RUIM: 'material_ruim',
  TRANSPORTE: 'transporte',
  BRIEFING_INCOMPLETO: 'briefing_incompleto',
  PRAZO: 'prazo',
  OUTRO: 'outro',
} as const;

export type OcorrenciaCausa = (typeof OCORRENCIA_CAUSA)[keyof typeof OCORRENCIA_CAUSA];

export const OCORRENCIA_CAUSA_CONFIG: Record<OcorrenciaCausa, StatusConfig> = {
  erro_arte: { label: 'Erro na arte', color: 'bg-pink-50 text-pink-700 border-pink-100', icon: 'Palette' },
  erro_producao: { label: 'Erro de produção', color: 'bg-orange-50 text-orange-700 border-orange-100', icon: 'Factory' },
  erro_instalacao: { label: 'Erro de instalação', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'Wrench' },
  material_ruim: { label: 'Material inadequado', color: 'bg-red-50 text-red-700 border-red-100', icon: 'PackageX' },
  transporte: { label: 'Transporte', color: 'bg-purple-50 text-purple-700 border-purple-100', icon: 'Truck' },
  briefing_incompleto: { label: 'Briefing incompleto', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: 'FileQuestion' },
  prazo: { label: 'Prazo', color: 'bg-cyan-50 text-cyan-700 border-cyan-100', icon: 'Clock' },
  outro: { label: 'Outro', color: 'bg-slate-50 text-slate-600 border-slate-100', icon: 'HelpCircle' },
} as const;

// ---------------------------------------------------------------------------
// TAREFAS
// ---------------------------------------------------------------------------

export const TAREFA_STATUS = {
  PENDENTE: 'pendente',
  EM_ANDAMENTO: 'em_andamento',
  AGUARDANDO: 'aguardando',
  CONCLUIDA: 'concluida',
  CANCELADA: 'cancelada',
} as const;

export type TarefaStatus = (typeof TAREFA_STATUS)[keyof typeof TAREFA_STATUS];

export const TAREFA_STATUS_CONFIG: Record<TarefaStatus, StatusConfig> = {
  pendente: { label: 'Pendente', color: 'bg-slate-50 text-slate-600 border-slate-100', icon: 'Circle' },
  em_andamento: { label: 'Em andamento', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: 'Play' },
  aguardando: { label: 'Aguardando', color: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'Clock' },
  concluida: { label: 'Concluída', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'CheckCircle2' },
  cancelada: { label: 'Cancelada', color: 'bg-gray-50 text-gray-500 border-gray-100', icon: 'Ban' },
} as const;

// ---------------------------------------------------------------------------

export const TAREFA_PRIORIDADE = {
  BAIXA: 'baixa',
  NORMAL: 'normal',
  ALTA: 'alta',
  URGENTE: 'urgente',
} as const;

export type TarefaPrioridade = (typeof TAREFA_PRIORIDADE)[keyof typeof TAREFA_PRIORIDADE];

export const TAREFA_PRIORIDADE_CONFIG: Record<TarefaPrioridade, StatusConfig> = {
  baixa: { label: 'Baixa', color: 'bg-slate-50 text-slate-600 border-slate-100', icon: 'ArrowDown' },
  normal: { label: 'Normal', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: 'Minus' },
  alta: { label: 'Alta', color: 'bg-orange-50 text-orange-700 border-orange-100', icon: 'ArrowUp' },
  urgente: { label: 'Urgente', color: 'bg-red-50 text-red-700 border-red-100', icon: 'AlertTriangle' },
} as const;

// ---------------------------------------------------------------------------
// HELPER: Buscar config de qualquer status
// ---------------------------------------------------------------------------

/**
 * Retorna a configuração (label, color, icon) de um status.
 * Útil para renderizar badges de forma genérica.
 *
 * @example
 * const cfg = getStatusConfig(LEAD_STATUS_CONFIG, 'novo');
 * // { label: 'Novo', color: 'bg-blue-50 ...', icon: 'Plus' }
 */
export function getStatusConfig<T extends string>(
  configMap: Record<T, StatusConfig>,
  status: T,
): StatusConfig {
  return (
    configMap[status] ?? {
      label: String(status),
      color: 'bg-slate-50 text-slate-600 border-slate-100',
      icon: 'HelpCircle',
    }
  );
}
