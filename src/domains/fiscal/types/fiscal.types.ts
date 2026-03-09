// Tipos completos do módulo fiscal

export type TipoDocumentoFiscal = 'nfe' | 'nfse';
export type AmbienteFiscal = 'homologacao' | 'producao';
export type StatusDocumentoFiscal =
  | 'rascunho' | 'validando' | 'apto' | 'emitindo'
  | 'autorizado' | 'rejeitado' | 'cancelado' | 'denegado'
  | 'inutilizado' | 'erro_transmissao';
export type StatusFilaEmissao =
  | 'pendente' | 'processando' | 'aguardando_retorno' | 'sucesso' | 'falha' | 'cancelado';
export type TipoEventoFiscal =
  | 'validacao' | 'rascunho' | 'emissao' | 'consulta' | 'cancelamento'
  | 'reprocessamento' | 'download_xml' | 'download_pdf' | 'correcao' | 'sincronizacao_status';
export type TipoArquivoFiscal =
  | 'xml_envio' | 'xml_retorno' | 'xml_autorizado' | 'xml_cancelamento' | 'pdf_danfe' | 'json_payload';

export interface FiscalAmbiente {
  id: string;
  codigo: string;
  nome: string;
  tipo: AmbienteFiscal;
  endpoint_base: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface FiscalSerie {
  id: string;
  tipo_documento: TipoDocumentoFiscal;
  serie: number;
  ultimo_numero: number;
  ambiente_id: string;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  fiscal_ambientes?: FiscalAmbiente;
}

export interface FiscalCertificado {
  id: string;
  nome: string;
  tipo_certificado: 'a1';
  arquivo_encriptado_url: string;
  thumbprint: string | null;
  cnpj_titular: string;
  validade_inicio: string | null;
  validade_fim: string | null;
  senha_secret_ref: string | null;
  ambiente_id: string | null;
  ativo: boolean;
  ultimo_teste_em: string | null;
  ultimo_teste_status: string | null;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FiscalRegraOperacao {
  id: string;
  nome: string;
  codigo: string | null;
  tipo_documento: TipoDocumentoFiscal;
  natureza_operacao: string;
  finalidade_nfe: string;
  cfop: string | null;
  ncm_padrao: string | null;
  cst_padrao: string | null;
  csosn_padrao: string | null;
  serie_id: string | null;
  ambiente_id: string | null;
  consumidor_final: boolean | null;
  contribuinte_icms: boolean | null;
  gerar_financeiro_apos_autorizacao: boolean;
  observacoes: string | null;
  ativo: boolean;
  prioridade_regra: number;
  created_at: string;
  updated_at: string;
  fiscal_series?: FiscalSerie;
  fiscal_ambientes?: FiscalAmbiente;
}

export interface FiscalDocumentoItem {
  id: string;
  fiscal_documento_id: string;
  pedido_item_id: string | null;
  item_numero: number;
  codigo_produto: string | null;
  descricao: string;
  ncm: string | null;
  cfop: string;
  cest: string | null;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_bruto: number;
  valor_desconto: number;
  valor_total: number;
  cst_ou_csosn: string | null;
  origem_mercadoria: string | null;
  aliquota_icms: number;
  base_calculo_icms: number;
  valor_icms: number;
  aliquota_pis: number;
  base_calculo_pis: number;
  valor_pis: number;
  aliquota_cofins: number;
  base_calculo_cofins: number;
  valor_cofins: number;
  observacoes: string | null;
}

export interface FiscalDocumento {
  id: string;
  pedido_id: string;
  cliente_id: string;
  tipo_documento: TipoDocumentoFiscal;
  provider: string;
  regra_operacao_id: string | null;
  ambiente_id: string | null;
  serie_id: string | null;
  certificado_id: string | null;
  status: StatusDocumentoFiscal;
  numero: number | null;
  chave_acesso: string | null;
  protocolo: string | null;
  recibo: string | null;
  data_emissao: string | null;
  data_autorizacao: string | null;
  data_cancelamento: string | null;
  valor_total: number;
  valor_produtos: number;
  valor_frete: number;
  valor_desconto: number;
  valor_icms: number;
  valor_pis: number;
  valor_cofins: number;
  natureza_operacao: string | null;
  finalidade_emissao: string | null;
  observacoes: string | null;
  informacoes_fisco: string | null;
  informacoes_contribuinte: string | null;
  payload_json: Record<string, unknown> | null;
  retorno_json: Record<string, unknown> | null;
  xml_url: string | null;
  pdf_url: string | null;
  mensagem_erro: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  // relations
  fiscal_documentos_itens?: FiscalDocumentoItem[];
  fiscal_eventos?: FiscalEvento[];
  fiscal_xmls?: FiscalXml[];
  pedidos?: { numero: string; status: string };
  clientes?: { razao_social: string; nome_fantasia: string | null };
  fiscal_ambientes?: FiscalAmbiente;
  fiscal_series?: FiscalSerie;
}

export interface FiscalEvento {
  id: string;
  fiscal_documento_id: string;
  tipo_evento: TipoEventoFiscal;
  status: string;
  protocolo: string | null;
  justificativa: string | null;
  payload_envio: Record<string, unknown> | null;
  payload_retorno: Record<string, unknown> | null;
  mensagem: string | null;
  created_by: string | null;
  created_at: string;
  profiles?: { nome: string; email: string };
}

export interface FiscalXml {
  id: string;
  fiscal_documento_id: string;
  tipo_arquivo: TipoArquivoFiscal;
  storage_path: string;
  hash_arquivo: string | null;
  tamanho_bytes: number | null;
  created_at: string;
}

export interface FiscalFilaEmissao {
  id: string;
  fiscal_documento_id: string;
  status_fila: StatusFilaEmissao;
  tentativas: number;
  prioridade: number;
  proxima_tentativa_em: string | null;
  ultimo_erro: string | null;
  locked_at: string | null;
  locked_by: string | null;
  created_at: string;
  updated_at: string;
  fiscal_documentos?: FiscalDocumento;
}

export interface FiscalErroTransmissao {
  id: string;
  fiscal_documento_id: string | null;
  provider: string;
  etapa: string | null;
  codigo_erro: string | null;
  mensagem_erro: string;
  payload_resumido: Record<string, unknown> | null;
  stack_resumida: string | null;
  created_at: string;
}

export interface FiscalAuditLog {
  id: string;
  user_id: string | null;
  entidade: string;
  entidade_id: string;
  acao: string;
  resultado: string | null;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  metadados: Record<string, unknown> | null;
  created_at: string;
  profiles?: { nome: string; email: string };
}

// DTO para criação de draft
export interface CriarDraftNFeDTO {
  pedido_id: string;
  regra_operacao_id: string;
  observacoes?: string;
  informacoes_contribuinte?: string;
}

// DTO para emissão
export interface EmitirNFeDTO {
  documento_id: string;
}

// DTO para cancelamento
export interface CancelarNFeDTO {
  documento_id: string;
  justificativa: string;
}

// Resultado de validação
export interface ValidacaoFiscalResult {
  ok: boolean;
  erros: string[];
  avisos: string[];
}

// Status NF-e config
export const STATUS_FISCAL_CONFIG: Record<StatusDocumentoFiscal, {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
}> = {
  rascunho: { label: 'Rascunho', color: 'text-slate-600', bgColor: 'bg-slate-100', icon: '📝' },
  validando: { label: 'Validando', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: '🔍' },
  apto: { label: 'Apto', color: 'text-emerald-600', bgColor: 'bg-emerald-100', icon: '✅' },
  emitindo: { label: 'Emitindo', color: 'text-amber-600', bgColor: 'bg-amber-100', icon: '⏳' },
  autorizado: { label: 'Autorizado', color: 'text-green-700', bgColor: 'bg-green-100', icon: '🟢' },
  rejeitado: { label: 'Rejeitado', color: 'text-red-600', bgColor: 'bg-red-100', icon: '❌' },
  cancelado: { label: 'Cancelado', color: 'text-gray-500', bgColor: 'bg-gray-100', icon: '🚫' },
  denegado: { label: 'Denegado', color: 'text-red-700', bgColor: 'bg-red-200', icon: '🔴' },
  inutilizado: { label: 'Inutilizado', color: 'text-orange-600', bgColor: 'bg-orange-100', icon: '⚠️' },
  erro_transmissao: { label: 'Erro Transmissão', color: 'text-red-500', bgColor: 'bg-red-50', icon: '💥' },
};

export const STATUS_FISCAL_PEDIDO_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
}> = {
  nao_iniciado: { label: 'Não iniciado', color: 'text-slate-500', bgColor: 'bg-slate-100' },
  validando: { label: 'Validando', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  apto: { label: 'Apto', color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  rascunho: { label: 'Rascunho', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  emitindo: { label: 'Emitindo', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  autorizado: { label: 'Autorizado', color: 'text-green-700', bgColor: 'bg-green-100' },
  rejeitado: { label: 'Rejeitado', color: 'text-red-600', bgColor: 'bg-red-100' },
  cancelado: { label: 'Cancelado', color: 'text-gray-500', bgColor: 'bg-gray-100' },
};
