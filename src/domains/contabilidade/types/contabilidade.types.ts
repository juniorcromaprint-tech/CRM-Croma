// src/domains/contabilidade/types/contabilidade.types.ts

export interface LancamentoContabil {
  id: string;
  data_lancamento: string;
  data_competencia: string;
  numero_lancamento: number;
  conta_debito_id: string;
  conta_credito_id: string;
  valor: number;
  historico: string;
  origem_tipo: OrigemTipo;
  origem_id: string | null;
  centro_custo_id: string | null;
  conciliado: boolean;
  created_by: string | null;
  created_at: string;
  // joins
  conta_debito?: { codigo: string; nome: string };
  conta_credito?: { codigo: string; nome: string };
  centro_custo?: { codigo: string; nome: string };
}

export type OrigemTipo = 'conta_receber' | 'conta_pagar' | 'extrato' | 'manual' | 'das' | 'pro_labore';

export interface DASApuracao {
  id: string;
  competencia: string;
  receita_bruta_mes: number;
  rbt12: number;
  folha_pagamento_12m: number;
  fator_r: number;
  anexo: 'III' | 'V';
  faixa: number;
  aliquota_nominal: number;
  deducao: number;
  aliquota_efetiva: number;
  valor_das: number;
  data_vencimento: string;
  status: 'calculado' | 'conferido' | 'pago';
  data_pagamento: string | null;
  observacoes: string | null;
  created_at: string;
}

export interface ConfigTributaria {
  id: string;
  regime: string;
  pro_labore_mensal: number;
  inss_pro_labore_percentual: number;
  cnae_principal: string | null;
  anexo_padrao: 'III' | 'V';
  observacoes: string | null;
  updated_at: string;
}

export interface ExtratoImportacao {
  id: string;
  banco: string;
  conta: string | null;
  arquivo_nome: string;
  formato: 'ofx' | 'csv';
  data_inicio: string | null;
  data_fim: string | null;
  total_registros: number;
  total_classificados: number;
  status: 'importado' | 'classificando' | 'classificado' | 'lancado';
  created_at: string;
}

export interface ExtratoItem {
  id: string;
  importacao_id: string;
  data: string;
  descricao_original: string;
  valor: number;
  tipo: 'credito' | 'debito';
  conta_plano_id: string | null;
  centro_custo_id: string | null;
  confianca_ia: number | null;
  classificado_por: 'ia' | 'usuario' | 'regra' | null;
  lancamento_id: string | null;
  conciliado_com_id: string | null;
  conciliado_com_tipo: string | null;
  ignorado: boolean;
  created_at: string;
  // joins
  conta_plano?: { codigo: string; nome: string };
}

export interface RegraClassificacao {
  id: string;
  padrao: string;
  tipo_match: 'contains' | 'starts_with' | 'exact';
  conta_plano_id: string;
  centro_custo_id: string | null;
  vezes_usado: number;
  ativo: boolean;
  created_at: string;
  // joins
  conta_plano?: { codigo: string; nome: string };
}

export interface BalanceteRow {
  conta_id: string;
  codigo: string;
  nome: string;
  tipo: string;
  natureza: string;
  total_debitos: number;
  total_creditos: number;
  saldo: number;
}

export interface RazaoRow {
  id: string;
  data_lancamento: string;
  historico: string;
  debito: number;
  credito: number;
  saldo_acumulado: number;
}

// Tabelas do Simples Nacional
export interface FaixaSimples {
  faixa: number;
  limiteInferior: number;
  limiteSuperior: number;
  aliquota: number;
  deducao: number;
}

export const ANEXO_III: FaixaSimples[] = [
  { faixa: 1, limiteInferior: 0, limiteSuperior: 180000, aliquota: 0.06, deducao: 0 },
  { faixa: 2, limiteInferior: 180000, limiteSuperior: 360000, aliquota: 0.112, deducao: 9360 },
  { faixa: 3, limiteInferior: 360000, limiteSuperior: 720000, aliquota: 0.135, deducao: 17640 },
  { faixa: 4, limiteInferior: 720000, limiteSuperior: 1800000, aliquota: 0.16, deducao: 35640 },
  { faixa: 5, limiteInferior: 1800000, limiteSuperior: 3600000, aliquota: 0.21, deducao: 125640 },
  { faixa: 6, limiteInferior: 3600000, limiteSuperior: 4800000, aliquota: 0.33, deducao: 648000 },
];

export const ANEXO_V: FaixaSimples[] = [
  { faixa: 1, limiteInferior: 0, limiteSuperior: 180000, aliquota: 0.155, deducao: 0 },
  { faixa: 2, limiteInferior: 180000, limiteSuperior: 360000, aliquota: 0.18, deducao: 4500 },
  { faixa: 3, limiteInferior: 360000, limiteSuperior: 720000, aliquota: 0.195, deducao: 9900 },
  { faixa: 4, limiteInferior: 720000, limiteSuperior: 1800000, aliquota: 0.205, deducao: 17100 },
  { faixa: 5, limiteInferior: 1800000, limiteSuperior: 3600000, aliquota: 0.23, deducao: 62100 },
  { faixa: 6, limiteInferior: 3600000, limiteSuperior: 4800000, aliquota: 0.305, deducao: 540000 },
];

export const FATOR_R_THRESHOLD = 0.28;
