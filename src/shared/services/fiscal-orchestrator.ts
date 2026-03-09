/**
 * CROMA PRINT ERP — Fiscal Orchestrator
 *
 * Orquestra o fluxo fiscal: validação → draft → emissão → pós-emissão.
 * Usa FiscalProvider desacoplado. Independente de NF-e ou NFS-e.
 */

import { supabase } from '@/integrations/supabase/client';
import { FiscalProviderRegistry, type FiscalDocumentDraft } from './fiscal-provider';
import { nfeProvider } from './nfe-provider';
import type { ValidacaoFiscalResult } from '@/domains/fiscal/types/fiscal.types';

// Registra o provider NF-e na inicialização
FiscalProviderRegistry.register(nfeProvider);

export class FiscalOrchestrator {
  /**
   * Valida um pedido para emissão fiscal via RPC
   */
  static async validarPedidoParaEmissao(pedidoId: string): Promise<ValidacaoFiscalResult> {
    const erros: string[] = [];
    const avisos: string[] = [];

    try {
      // Chama função SQL que valida cliente + itens + status do pedido
      const { data, error } = await supabase.rpc('fiscal_validar_pedido_nfe', {
        p_pedido_id: pedidoId,
      });

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.ok) {
        erros.push(result?.mensagem ?? 'Pedido inválido para emissão');
      }

      // Verifica regra fiscal
      const { data: pedido } = await supabase
        .from('pedidos')
        .select('fiscal_regra_id, status')
        .eq('id', pedidoId)
        .single();

      if (!pedido?.fiscal_regra_id) {
        erros.push('Pedido sem regra fiscal definida');
      }

      // Verifica certificado ativo
      const { data: certificados } = await supabase
        .from('fiscal_certificados')
        .select('id, validade_fim')
        .eq('ativo', true);

      if (!certificados || certificados.length === 0) {
        erros.push('Nenhum certificado digital ativo');
      } else {
        const cert = certificados[0];
        if (cert.validade_fim) {
          const dias = Math.floor(
            (new Date(cert.validade_fim).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          if (dias < 0) erros.push('Certificado digital expirado');
          else if (dias < 30) avisos.push(`Certificado expira em ${dias} dias`);
        }
      }

      return { ok: erros.length === 0, erros, avisos };
    } catch (err) {
      return { ok: false, erros: [String(err)], avisos };
    }
  }

  /**
   * Gera rascunho fiscal a partir de um pedido via RPC
   */
  static async gerarDraftFiscal(pedidoId: string): Promise<{ ok: boolean; documentoId?: string; erro?: string }> {
    try {
      const { data, error } = await supabase.rpc('fiscal_criar_rascunho_nfe', {
        p_pedido_id: pedidoId,
        p_user_id: '00000000-0000-0000-0000-000000000000', // demo mode
        p_provider: 'nfe_provider',
      });

      if (error) throw error;
      return { ok: true, documentoId: data as string };
    } catch (err) {
      return { ok: false, erro: String(err) };
    }
  }

  /**
   * Emite NF-e via provider
   */
  static async emitir(documentoId: string): Promise<{ ok: boolean; erro?: string }> {
    try {
      const { data: doc, error } = await supabase
        .from('fiscal_documentos')
        .select('*')
        .eq('id', documentoId)
        .single();

      if (error || !doc) throw new Error('Documento fiscal não encontrado');

      const provider = FiscalProviderRegistry.get('nfe');
      if (!provider) throw new Error('Provider NF-e não registrado');

      // Atualiza status para emitindo
      await supabase
        .from('fiscal_documentos')
        .update({ status: 'emitindo', updated_at: new Date().toISOString() })
        .eq('id', documentoId);

      const draft: FiscalDocumentDraft = {
        documento_id: doc.id,
        pedido_id: doc.pedido_id,
        cliente_id: doc.cliente_id,
        tipo_documento: 'nfe',
        ambiente: (doc as any).fiscal_ambientes?.tipo ?? 'homologacao',
        serie: (doc as any).fiscal_series?.serie ?? 1,
        natureza_operacao: doc.natureza_operacao ?? 'Venda de mercadoria',
        cfop: '5102',
        itens: [],
        valor_total: doc.valor_total,
      };

      const result = await provider.emitirDocumento(draft);

      if (result.sucesso) {
        await supabase
          .from('fiscal_documentos')
          .update({
            status: 'autorizado',
            numero: result.numero,
            chave_acesso: result.chave_acesso,
            protocolo: result.protocolo,
            recibo: result.recibo,
            data_autorizacao: result.data_autorizacao,
            retorno_json: result.retorno_raw,
            updated_at: new Date().toISOString(),
          })
          .eq('id', documentoId);

        return { ok: true };
      } else {
        await supabase
          .from('fiscal_documentos')
          .update({
            status: 'rejeitado',
            mensagem_erro: result.mensagem_erro,
            retorno_json: result.retorno_raw,
            updated_at: new Date().toISOString(),
          })
          .eq('id', documentoId);

        // Registra erro de transmissão
        await supabase.from('fiscal_erros_transmissao').insert({
          fiscal_documento_id: documentoId,
          provider: 'nfe_provider',
          etapa: 'emissao',
          codigo_erro: result.codigo_erro,
          mensagem_erro: result.mensagem_erro ?? 'Erro desconhecido',
        });

        return { ok: false, erro: result.mensagem_erro };
      }
    } catch (err) {
      await supabase
        .from('fiscal_documentos')
        .update({
          status: 'erro_transmissao',
          mensagem_erro: String(err),
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentoId);

      return { ok: false, erro: String(err) };
    }
  }

  /**
   * Consulta status da NF-e na SEFAZ
   */
  static async consultar(documentoId: string): Promise<{ ok: boolean; status?: string; erro?: string }> {
    try {
      const { data: doc } = await supabase
        .from('fiscal_documentos')
        .select('chave_acesso, fiscal_ambientes(tipo)')
        .eq('id', documentoId)
        .single();

      if (!doc?.chave_acesso) throw new Error('Chave de acesso não encontrada');

      const provider = FiscalProviderRegistry.get('nfe');
      if (!provider) throw new Error('Provider NF-e não registrado');

      const result = await provider.consultarDocumento(
        doc.chave_acesso,
        (doc.fiscal_ambientes as any)?.tipo ?? 'homologacao'
      );

      // Registra evento de consulta
      await supabase.from('fiscal_eventos').insert({
        fiscal_documento_id: documentoId,
        tipo_evento: 'consulta',
        status: result.sucesso ? 'sucesso' : 'falha',
        mensagem: result.mensagem,
        payload_retorno: result.retorno_raw,
      });

      return { ok: result.sucesso, status: result.status };
    } catch (err) {
      return { ok: false, erro: String(err) };
    }
  }

  /**
   * Cancela NF-e autorizada
   */
  static async cancelar(documentoId: string, justificativa: string): Promise<{ ok: boolean; erro?: string }> {
    try {
      const { data: doc } = await supabase
        .from('fiscal_documentos')
        .select('chave_acesso, protocolo, fiscal_ambientes(tipo)')
        .eq('id', documentoId)
        .single();

      if (!doc?.chave_acesso || !doc?.protocolo) {
        throw new Error('Documento sem chave de acesso ou protocolo');
      }

      const provider = FiscalProviderRegistry.get('nfe');
      if (!provider) throw new Error('Provider NF-e não registrado');

      const result = await provider.cancelarDocumento(
        doc.chave_acesso,
        doc.protocolo,
        justificativa,
        (doc.fiscal_ambientes as any)?.tipo ?? 'homologacao'
      );

      if (result.sucesso) {
        await supabase
          .from('fiscal_documentos')
          .update({
            status: 'cancelado',
            data_cancelamento: result.data_cancelamento ?? new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', documentoId);

        await supabase.from('fiscal_eventos').insert({
          fiscal_documento_id: documentoId,
          tipo_evento: 'cancelamento',
          status: 'sucesso',
          protocolo: result.protocolo,
          justificativa,
          mensagem: result.mensagem,
          payload_retorno: result.retorno_raw,
        });

        return { ok: true };
      } else {
        return { ok: false, erro: result.mensagem };
      }
    } catch (err) {
      return { ok: false, erro: String(err) };
    }
  }

  /**
   * Reprocessa um documento rejeitado ou com erro
   */
  static async reprocessar(documentoId: string): Promise<{ ok: boolean; erro?: string }> {
    await supabase
      .from('fiscal_documentos')
      .update({
        status: 'apto',
        mensagem_erro: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentoId);

    await supabase.from('fiscal_eventos').insert({
      fiscal_documento_id: documentoId,
      tipo_evento: 'reprocessamento',
      status: 'iniciado',
      mensagem: 'Documento reprocessado manualmente',
    });

    return this.emitir(documentoId);
  }
}

export default FiscalOrchestrator;
