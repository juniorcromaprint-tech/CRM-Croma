// src/domains/producao/types/pcp.types.ts

export interface SetorProducao {
  id: string;
  nome: string;
  codigo: string;
  cor: string;
  ordem: number;
  ativo: boolean;
  capacidade_diaria_min: number;
  created_at: string;
}

export interface EtapaTemplate {
  id: string;
  categoria_id: string | null;
  setor_id: string;
  nome: string;
  ordem: number;
  tempo_estimado_min: number;
  obrigatoria: boolean;
}

export interface RoutingRule {
  id: string;
  nome: string;
  categoria_id: string | null;
  condicao_campo: string | null;
  condicao_operador: string | null;
  condicao_valor: string | null;
  setor_destino_id: string;
  prioridade: number;
  ativo: boolean;
}

export interface Apontamento {
  id: string;
  producao_etapa_id: string;
  ordem_producao_id: string;
  operador_id: string;
  inicio: string;
  fim: string | null;
  tempo_minutos: number | null;
  tipo: 'producao' | 'setup' | 'pausa' | 'retrabalho';
  observacoes: string | null;
  created_at: string;
}

export interface PCPOpAtiva {
  id: string;
  numero: string;
  status: string;
  prioridade: number;
  prazo_interno: string | null;
  data_inicio: string | null;
  data_conclusao: string | null;
  tempo_estimado_min: number;
  tempo_real_min: number;
  restricao_financeira: boolean;
  setor_atual_id: string | null;
  setor_atual_nome: string | null;
  setor_cor: string | null;
  pedido_id: string;
  pedido_numero: string;
  data_prometida: string | null;
  cliente_id: string;
  cliente_nome: string;
  atrasada: boolean;
  dias_atraso: number;
  created_at: string;
  updated_at: string;
}

export interface PCPCapacidadeSetor {
  setor_id: string;
  setor_nome: string;
  cor: string;
  capacidade_diaria_min: number;
  ops_ativas: number;
  min_total_estimado: number;
  utilizacao_pct: number;
}

export interface PCPKpis {
  total_ops_ativas: number;
  ops_atrasadas: number;
  ops_em_producao: number;
  concluidas_hoje: number;
  capacidade_media_pct: number;
}

export interface GanttBar {
  id: string;
  op_numero: string;
  operador_nome: string;
  etapa_nome: string;
  setor_nome: string;
  cor: string;
  inicio: Date;
  fim: Date | null;
  tipo: string;
}

export interface MaquinaOPAgendada {
  op_id: string;
  op_numero: string;
  pedido_numero: string;
  cliente_nome: string;
  status: string;
  data_inicio_prevista: string;
  data_fim_prevista: string | null;
  maquina_id: string;
  maquina_nome: string;
  maquina_tipo: string;
  atrasada: boolean;
}

export interface MaquinaUtilizacao {
  id: string;
  nome: string;
  tipo: string;
  ops_hoje: number;
}

export interface EtapaComOp {
  etapa_id: string;
  etapa_nome: string;
  etapa_status: string;
  etapa_ordem: number;
  op_id: string;
  op_numero: string;
  pedido_numero: string;
  cliente_nome: string;
  data_prometida: string | null;
  atrasada: boolean;
  tempo_estimado_min: number;
}
