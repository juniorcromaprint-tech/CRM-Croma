export type OcorrenciaStatus = 'aberta' | 'em_analise' | 'em_tratativa' | 'resolvida' | 'encerrada';

export type OcorrenciaTipo =
  | 'retrabalho'
  | 'devolucao'
  | 'erro_producao'
  | 'erro_instalacao'
  | 'divergencia_cliente'
  | 'material_defeituoso'
  | 'outro';

export type OcorrenciaPrioridade = 'baixa' | 'media' | 'alta' | 'critica';

export type OcorrenciaCausa =
  | 'material_defeituoso'
  | 'erro_operacional'
  | 'erro_projeto'
  | 'instrucao_incorreta'
  | 'outro';

export interface Ocorrencia {
  id: string;
  numero?: string;
  descricao: string;
  tipo: OcorrenciaTipo;
  status: OcorrenciaStatus;
  prioridade: OcorrenciaPrioridade;
  causa?: OcorrenciaCausa;
  pedido_id?: string;
  fornecedor_id?: string;
  ordem_producao_id?: string;
  responsavel_id?: string;
  custo_mp?: number;
  custo_mo?: number;
  custo_total?: number;
  impacto_prazo_dias?: number;
  created_at: string;
  updated_at?: string;
  tratativas?: Tratativa[];
}

export interface Tratativa {
  id: string;
  ocorrencia_id: string;
  acao_corretiva?: string;
  prazo?: string;
  data_conclusao?: string;
  observacoes?: string;
  usuario_id?: string;
  created_at: string;
}

export interface QualidadeKPIs {
  totalOcorrencias: number;
  abertas: number;
  emTratativa: number;
  encerradas: number;
  mttr?: number;
  taxaResolucao?: number;
}

export type OcorrenciaCreate = Omit<Ocorrencia, 'id' | 'created_at' | 'updated_at' | 'tratativas'>;
export type TratativaCreate = Omit<Tratativa, 'id' | 'created_at'>;
