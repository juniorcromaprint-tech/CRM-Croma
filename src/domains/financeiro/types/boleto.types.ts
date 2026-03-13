// ─── Boleto / Banking Types ─────────────────────────────────────────────────
// Croma Print ERP — Módulo de Integração Bancária
// ─────────────────────────────────────────────────────────────────────────────

// ─── Enums ───────────────────────────────────────────────────────────────────

export type BankCode = '341' | '237' | '001' | '033';

export const BANK_NAMES: Record<BankCode, string> = {
  '341': 'Banco Itaú S.A.',
  '237': 'Banco Bradesco S.A.',
  '001': 'Banco do Brasil S.A.',
  '033': 'Banco Santander S.A.',
};

export type BoletoStatus =
  | 'rascunho'
  | 'emitido'
  | 'pronto_remessa'
  | 'remetido'
  | 'registrado'
  | 'pago'
  | 'rejeitado'
  | 'cancelado';

export type RemessaStatus = 'gerado' | 'baixado' | 'enviado' | 'processado' | 'erro';

export type RetornoStatus = 'importado' | 'processando' | 'processado' | 'erro';

// ─── Row Types ───────────────────────────────────────────────────────────────

export interface BankAccount {
  id: string;
  nome: string;
  banco_codigo: string;
  banco_nome: string;
  agencia: string;
  agencia_digito: string | null;
  conta: string;
  conta_digito: string;
  carteira: string;
  convenio: string | null;
  cedente_nome: string;
  cedente_cnpj: string;
  cedente_endereco: string | null;
  cedente_cidade: string | null;
  cedente_estado: string | null;
  cedente_cep: string | null;
  nosso_numero_sequencial: number;
  instrucoes_padrao: string | null;
  juros_ao_mes: number;
  multa_percentual: number;
  dias_protesto: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface BankSlip {
  id: string;
  bank_account_id: string;
  conta_receber_id: string | null;
  pedido_id: string | null;
  cliente_id: string;
  nosso_numero: string;
  seu_numero: string | null;
  valor_nominal: number;
  valor_juros: number;
  valor_multa: number;
  valor_desconto: number;
  valor_pago: number | null;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento: string | null;
  data_credito: string | null;
  data_limite_desconto: string | null;
  sacado_nome: string;
  sacado_cpf_cnpj: string;
  sacado_endereco: string | null;
  sacado_cidade: string | null;
  sacado_estado: string | null;
  sacado_cep: string | null;
  instrucoes: string | null;
  status: BoletoStatus;
  motivo_rejeicao: string | null;
  created_at: string;
  updated_at: string;
  // joins
  clientes?: { nome_fantasia: string | null; razao_social: string } | null;
  bank_accounts?: BankAccount | null;
  contas_receber?: { id: string; numero_titulo: string | null; valor_original: number } | null;
  pedidos?: { numero: string | null } | null;
}

export interface BankRemittance {
  id: string;
  bank_account_id: string;
  numero_sequencial: number;
  arquivo_nome: string;
  total_registros: number;
  valor_total: number;
  status: RemessaStatus;
  conteudo_arquivo: string | null;
  erro_descricao: string | null;
  gerado_por: string | null;
  gerado_em: string;
  enviado_em: string | null;
  processado_em: string | null;
  created_at: string;
  updated_at: string;
  // joins
  bank_accounts?: { nome: string; banco_nome: string } | null;
}

export interface BankRemittanceItem {
  id: string;
  remittance_id: string;
  bank_slip_id: string;
  linha_numero: number;
  conteudo_linha: string | null;
  created_at: string;
}

export interface BankReturn {
  id: string;
  bank_account_id: string;
  arquivo_nome: string;
  total_registros: number;
  total_processados: number;
  total_erros: number;
  status: RetornoStatus;
  importado_por: string | null;
  importado_em: string;
  processado_em: string | null;
  created_at: string;
}

export interface BankReturnItem {
  id: string;
  return_id: string;
  bank_slip_id: string | null;
  nosso_numero: string;
  ocorrencia_codigo: string;
  ocorrencia_descricao: string | null;
  valor_pago: number | null;
  data_pagamento: string | null;
  data_credito: string | null;
  valor_juros: number | null;
  valor_tarifa: number | null;
  linha_numero: number | null;
  conteudo_linha: string | null;
  processado: boolean;
  created_at: string;
}

// ─── Create / Update DTOs ────────────────────────────────────────────────────

export interface BankAccountCreate {
  nome: string;
  banco_codigo: string;
  banco_nome: string;
  agencia: string;
  agencia_digito?: string | null;
  conta: string;
  conta_digito: string;
  carteira?: string;
  convenio?: string | null;
  cedente_nome: string;
  cedente_cnpj: string;
  cedente_endereco?: string | null;
  cedente_cidade?: string | null;
  cedente_estado?: string | null;
  cedente_cep?: string | null;
  instrucoes_padrao?: string | null;
  juros_ao_mes?: number;
  multa_percentual?: number;
  dias_protesto?: number;
}

export interface BankSlipCreate {
  bank_account_id: string;
  conta_receber_id?: string | null;
  pedido_id?: string | null;
  cliente_id: string;
  valor_nominal: number;
  data_vencimento: string;
  sacado_nome: string;
  sacado_cpf_cnpj: string;
  sacado_endereco?: string | null;
  sacado_cidade?: string | null;
  sacado_estado?: string | null;
  sacado_cep?: string | null;
  seu_numero?: string | null;
  valor_desconto?: number;
  data_limite_desconto?: string | null;
  instrucoes?: string | null;
}

export interface BankSlipUpdate extends Partial<BankSlipCreate> {
  id: string;
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface BoletoFilters {
  status?: BoletoStatus;
  cliente_id?: string;
  bank_account_id?: string;
  data_vencimento_de?: string;
  data_vencimento_ate?: string;
}

// ─── CNAB helper type ────────────────────────────────────────────────────────

export interface BankSlipWithClient extends BankSlip {
  clientes: { nome_fantasia: string | null; razao_social: string };
}
