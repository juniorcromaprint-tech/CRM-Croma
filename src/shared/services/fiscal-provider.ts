/**
 * CROMA PRINT ERP — Fiscal Provider Interface
 *
 * Interface genérica para providers fiscais.
 * MVP implementa NF-e. NFS-e pode ser adicionado futuramente
 * sem retrabalho estrutural.
 */

export interface FiscalDocumentDraft {
  documento_id: string;
  pedido_id: string;
  cliente_id: string;
  tipo_documento: 'nfe' | 'nfse';
  ambiente: 'homologacao' | 'producao';
  serie: number;
  natureza_operacao: string;
  cfop: string;
  itens: FiscalItemDraft[];
  valor_total: number;
  observacoes?: string;
  informacoes_contribuinte?: string;
  informacoes_fisco?: string;
}

export interface FiscalItemDraft {
  item_numero: number;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  cst_ou_csosn?: string;
}

export interface FiscalEmissaoResult {
  sucesso: boolean;
  status: string;
  numero?: number;
  chave_acesso?: string;
  protocolo?: string;
  recibo?: string;
  data_autorizacao?: string;
  xml_autorizado?: string;
  mensagem_erro?: string;
  codigo_erro?: string;
  retorno_raw?: Record<string, unknown>;
}

export interface FiscalConsultaResult {
  sucesso: boolean;
  status: string;
  chave_acesso?: string;
  protocolo?: string;
  data_autorizacao?: string;
  mensagem?: string;
  retorno_raw?: Record<string, unknown>;
}

export interface FiscalCancelamentoResult {
  sucesso: boolean;
  protocolo?: string;
  data_cancelamento?: string;
  mensagem?: string;
  xml_cancelamento?: string;
  retorno_raw?: Record<string, unknown>;
}

export interface FiscalConfigValidation {
  valido: boolean;
  erros: string[];
}

/**
 * Interface base que todos os providers fiscais devem implementar.
 * Permite trocar NF-e por NFS-e sem alterar o FiscalOrchestrator.
 */
export interface FiscalProvider {
  readonly tipoDocumento: 'nfe' | 'nfse';
  readonly nomeProvider: string;

  /** Valida se o provider está configurado e pronto para uso */
  validarConfiguracao(): Promise<FiscalConfigValidation>;

  /** Emite o documento fiscal */
  emitirDocumento(draft: FiscalDocumentDraft): Promise<FiscalEmissaoResult>;

  /** Consulta o status de um documento já emitido */
  consultarDocumento(chaveAcesso: string, ambiente: string): Promise<FiscalConsultaResult>;

  /** Cancela um documento autorizado */
  cancelarDocumento(
    chaveAcesso: string,
    protocolo: string,
    justificativa: string,
    ambiente: string
  ): Promise<FiscalCancelamentoResult>;

  /** Retorna a URL do XML autorizado (ou null se não disponível) */
  baixarXml(documentoId: string): Promise<string | null>;

  /** Retorna a URL do PDF/DANFE (ou null se não disponível) */
  gerarPdf(documentoId: string): Promise<string | null>;
}

/**
 * Registry de providers — permite registrar múltiplos providers
 * e selecionar por tipo de documento.
 */
export class FiscalProviderRegistry {
  private static providers = new Map<string, FiscalProvider>();

  static register(provider: FiscalProvider): void {
    this.providers.set(provider.tipoDocumento, provider);
  }

  static get(tipoDocumento: 'nfe' | 'nfse'): FiscalProvider | null {
    return this.providers.get(tipoDocumento) ?? null;
  }

  static getAll(): FiscalProvider[] {
    return Array.from(this.providers.values());
  }
}
