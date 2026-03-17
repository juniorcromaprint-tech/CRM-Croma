export interface ParcelaReceber {
  id: string;
  conta_receber_id: string;
  numero: number;
  valor: number;
  valor_pago: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: 'pendente' | 'parcial' | 'pago' | 'cancelado';
  created_at: string;
}

export interface AgingBucket {
  cliente_id: string;
  a_vencer: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90_mais: number;
  total_aberto: number;
  maior_atraso: number;
}

export interface AgingComCliente extends AgingBucket {
  nome_fantasia: string;
  razao_social: string | null;
}

export interface Inadimplente {
  cliente_id: string;
  nome_fantasia: string;
  razao_social: string | null;
  total_aberto: number;
  maior_atraso: number;
  total_vencido: number;
}

export interface FluxoCaixaDia {
  data: string;
  valor: number;
  tipo: 'entrada' | 'saida';
}

export interface FluxoCaixaAcumulado {
  data: string;
  entradas: number;
  saidas: number;
  saldo_dia: number;
  saldo_acumulado: number;
}

export interface AgingResumo {
  a_vencer: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90_mais: number;
  total: number;
}

export interface DREReal {
  periodo: string;
  receita_bruta: number;
  deducoes: number;
  receita_liquida: number;
  cme: number;
  lucro_bruto: number;
  despesas_comerciais: number;
  despesas_administrativas: number;
  despesas_pessoal: number;
  ebitda: number;
  margem_bruta_pct: number;
  margem_ebitda_pct: number;
}
