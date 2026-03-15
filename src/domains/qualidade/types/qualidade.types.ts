// src/domains/qualidade/types/qualidade.types.ts

export interface Ocorrencia {
  id: string;
  titulo: string;
  descricao?: string;
  tipo: string;
  prioridade: 'baixa' | 'media' | 'alta' | 'critica';
  status: 'aberta' | 'em_analise' | 'em_tratamento' | 'resolvida' | 'fechada';
  pedido_id?: string;
  ordem_producao_id?: string;
  fornecedor_id?: string;
  responsavel_id?: string;
  custo_estimado?: number;
  created_at: string;
  resolved_at?: string;
  tratativas?: Tratativa[];
}

export interface Tratativa {
  id: string;
  ocorrencia_id: string;
  descricao: string;
  tipo: 'analise' | 'acao_corretiva' | 'acao_preventiva' | 'verificacao';
  responsavel_id?: string;
  created_at: string;
}

export interface QualidadeKPIs {
  total_ocorrencias: number;
  abertas: number;
  resolvidas_mes: number;
  mttr_horas: number;
  por_tipo: { tipo: string; count: number }[];
  por_prioridade: { prioridade: string; count: number }[];
}
