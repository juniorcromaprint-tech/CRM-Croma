/**
 * CROMA PRINT ERP — NF-e Provider
 *
 * Implementa FiscalProvider para NF-e.
 * Toda comunicação real (assinar, transmitir, SEFAZ) ocorre
 * na Edge Function 'fiscal-emitir-nfe' — o certificado A1
 * NUNCA toca o frontend.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  FiscalProvider,
  FiscalDocumentDraft,
  FiscalEmissaoResult,
  FiscalConsultaResult,
  FiscalCancelamentoResult,
  FiscalConfigValidation,
} from './fiscal-provider';

export class NFeProvider implements FiscalProvider {
  readonly tipoDocumento = 'nfe' as const;
  readonly nomeProvider = 'NFeProvider';

  async validarConfiguracao(): Promise<FiscalConfigValidation> {
    try {
      const { data: certificados, error } = await supabase
        .from('fiscal_certificados')
        .select('id, nome, validade_fim, ativo')
        .eq('ativo', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      const erros: string[] = [];

      if (!certificados || certificados.length === 0) {
        erros.push('Nenhum certificado digital ativo encontrado');
      } else {
        const cert = certificados[0];
        if (cert.validade_fim) {
          const validade = new Date(cert.validade_fim);
          const hoje = new Date();
          const diasRestantes = Math.floor((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
          if (diasRestantes < 0) {
            erros.push(`Certificado '${cert.nome}' expirado`);
          } else if (diasRestantes < 30) {
            erros.push(`Certificado '${cert.nome}' expira em ${diasRestantes} dias`);
          }
        }
      }

      const { data: ambientes } = await supabase
        .from('fiscal_ambientes')
        .select('id')
        .eq('ativo', true);

      if (!ambientes || ambientes.length === 0) {
        erros.push('Nenhum ambiente fiscal configurado');
      }

      const { data: series } = await supabase
        .from('fiscal_series')
        .select('id')
        .eq('ativo', true)
        .eq('tipo_documento', 'nfe');

      if (!series || series.length === 0) {
        erros.push('Nenhuma série NF-e ativa configurada');
      }

      return { valido: erros.length === 0, erros };
    } catch (err) {
      return {
        valido: false,
        erros: ['Erro ao validar configuração fiscal: ' + String(err)],
      };
    }
  }

  async emitirDocumento(draft: FiscalDocumentDraft): Promise<FiscalEmissaoResult> {
    try {
      const response = await supabase.functions.invoke('fiscal-emitir-nfe', {
        body: { documento_id: draft.documento_id },
      });

      if (response.error) {
        return {
          sucesso: false,
          status: 'erro_transmissao',
          mensagem_erro: response.error.message,
        };
      }

      return response.data as FiscalEmissaoResult;
    } catch (err) {
      return {
        sucesso: false,
        status: 'erro_transmissao',
        mensagem_erro: String(err),
      };
    }
  }

  async consultarDocumento(chaveAcesso: string, ambiente: string): Promise<FiscalConsultaResult> {
    try {
      const response = await supabase.functions.invoke('fiscal-consultar-nfe', {
        body: { chave_acesso: chaveAcesso, ambiente },
      });

      if (response.error) {
        return {
          sucesso: false,
          status: 'erro',
          mensagem: response.error.message,
        };
      }

      return response.data as FiscalConsultaResult;
    } catch (err) {
      return {
        sucesso: false,
        status: 'erro',
        mensagem: String(err),
      };
    }
  }

  async cancelarDocumento(
    chaveAcesso: string,
    protocolo: string,
    justificativa: string,
    ambiente: string
  ): Promise<FiscalCancelamentoResult> {
    try {
      const response = await supabase.functions.invoke('fiscal-cancelar-nfe', {
        body: { chave_acesso: chaveAcesso, protocolo, justificativa, ambiente },
      });

      if (response.error) {
        return {
          sucesso: false,
          mensagem: response.error.message,
        };
      }

      return response.data as FiscalCancelamentoResult;
    } catch (err) {
      return {
        sucesso: false,
        mensagem: String(err),
      };
    }
  }

  async baixarXml(documentoId: string): Promise<string | null> {
    const { data } = await supabase
      .from('fiscal_xmls')
      .select('storage_path')
      .eq('fiscal_documento_id', documentoId)
      .eq('tipo_arquivo', 'xml_autorizado')
      .single();

    if (!data?.storage_path) return null;

    const { data: urlData } = await supabase.storage
      .from('fiscal-xmls')
      .createSignedUrl(data.storage_path, 3600);

    return urlData?.signedUrl ?? null;
  }

  async gerarPdf(documentoId: string): Promise<string | null> {
    try {
      const response = await supabase.functions.invoke('fiscal-gerar-danfe', {
        body: { documento_id: documentoId },
      });

      if (response.error) return null;
      return (response.data as { pdf_url?: string })?.pdf_url ?? null;
    } catch {
      return null;
    }
  }
}

// Exporta instância singleton
export const nfeProvider = new NFeProvider();
