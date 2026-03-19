export type AgentCanal = 'email' | 'whatsapp' | 'interno';
export type AgentConversationStatus = 'ativa' | 'pausada' | 'aguardando_aprovacao' | 'convertida' | 'encerrada';
export type AgentEtapa = 'abertura' | 'followup1' | 'followup2' | 'followup3' | 'reengajamento' | 'proposta' | 'negociacao';
export type AgentMessageStatus = 'rascunho' | 'pendente_aprovacao' | 'aprovada' | 'enviada' | 'entregue' | 'lida' | 'respondida' | 'erro';

export interface AgentConversation {
  id: string;
  lead_id: string;
  canal: AgentCanal;
  status: AgentConversationStatus;
  etapa: AgentEtapa;
  mensagens_enviadas: number;
  mensagens_recebidas: number;
  ultima_mensagem_em: string | null;
  proximo_followup: string | null;
  tentativas: number;
  max_tentativas: number;
  score_engajamento: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Joins
  leads?: {
    empresa: string;
    contato_nome: string | null;
    contato_email: string | null;
    segmento: string | null;
    temperatura: string;
    score: number | null;
  };
}

export interface AgentMessage {
  id: string;
  conversation_id: string;
  direcao: 'enviada' | 'recebida';
  canal: AgentCanal;
  conteudo: string;
  assunto: string | null;
  metadata: Record<string, unknown>;
  status: AgentMessageStatus;
  aprovado_por: string | null;
  aprovado_em: string | null;
  enviado_em: string | null;
  lido_em: string | null;
  respondido_em: string | null;
  erro_mensagem: string | null;
  custo_ia: number;
  modelo_ia: string | null;
  created_at: string;
}

export interface AgentTemplate {
  id: string;
  nome: string;
  segmento: string | null;
  canal: AgentCanal;
  etapa: AgentEtapa;
  assunto: string | null;
  conteudo: string;
  variaveis: string[];
  ativo: boolean;
  vezes_usado: number;
  taxa_resposta: number;
  created_at: string;
}

export interface AgentConfig {
  max_contatos_dia: number;
  horario_inicio: string;
  horario_fim: string;
  dias_entre_followup: number;
  max_tentativas: number;
  canais_ativos: AgentCanal[];
  segmentos_ativos: string[];
  tom: string;
  modelo_qualificacao: string;
  modelo_composicao: string;
  email_remetente: string;
  nome_remetente: string;
}

export interface AgentQualification {
  score: number;
  temperatura_sugerida: 'frio' | 'morno' | 'quente';
  segmento_refinado: string;
  potencial_estimado: number;
  produtos_sugeridos: string[];
  proxima_acao: 'email' | 'whatsapp' | 'ligar' | 'aguardar' | 'descartar';
  motivo_acao: string;
  mensagem_sugerida: string;
  riscos: string[];
}

export interface AgentAction {
  conversation_id: string;
  acao: 'enviar_followup' | 'compor_resposta' | 'escalar_humano' | 'encerrada';
  motivo?: string;
  etapa?: AgentEtapa;
  canal?: AgentCanal;
  lead?: { empresa: string; segmento: string | null };
}
