/**
 * CROMA PRINT ERP — Fiscal Validation Service
 */

import { supabase } from '@/integrations/supabase/client';
import type { ValidacaoFiscalResult } from '@/domains/fiscal/types/fiscal.types';

export class FiscalValidationService {
  /**
   * Valida pedido completo para emissão de NF-e
   */
  static async validarPedido(pedidoId: string): Promise<ValidacaoFiscalResult> {
    const erros: string[] = [];
    const avisos: string[] = [];

    try {
      // 1. Valida via função SQL (cliente + itens + status)
      const { data: sqlResult, error: sqlError } = await supabase.rpc(
        'fiscal_validar_pedido_nfe',
        { p_pedido_id: pedidoId }
      );
      if (sqlError) throw sqlError;

      const sqlRow = Array.isArray(sqlResult) ? sqlResult[0] : sqlResult;
      if (!sqlRow?.ok) {
        erros.push(sqlRow?.mensagem ?? 'Pedido inválido');
        return { ok: false, erros, avisos };
      }

      // 2. Verifica regra fiscal
      const { data: pedido } = await supabase
        .from('pedidos')
        .select('fiscal_regra_id, valor_total, status')
        .eq('id', pedidoId)
        .single();

      if (!pedido?.fiscal_regra_id) {
        erros.push('Pedido sem regra fiscal definida. Configure a regra fiscal antes de emitir.');
      }

      // 3. Verifica série ativa
      const { data: series } = await supabase
        .from('fiscal_series')
        .select('id')
        .eq('ativo', true)
        .eq('tipo_documento', 'nfe');

      if (!series || series.length === 0) {
        erros.push('Nenhuma série NF-e ativa. Configure as séries fiscais.');
      }

      // 4. Verifica certificado
      const { data: certs } = await supabase
        .from('fiscal_certificados')
        .select('id, validade_fim, nome')
        .eq('ativo', true);

      if (!certs || certs.length === 0) {
        erros.push('Nenhum certificado digital ativo. Faça o upload do certificado A1.');
      } else {
        const cert = certs[0];
        if (cert.validade_fim) {
          const dias = Math.floor(
            (new Date(cert.validade_fim).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          if (dias < 0) {
            erros.push(`Certificado '${cert.nome}' está expirado`);
          } else if (dias < 30) {
            avisos.push(`Certificado '${cert.nome}' expira em ${dias} dias`);
          }
        }
      }

      // 5. Valor positivo
      if (pedido && (pedido.valor_total ?? 0) <= 0) {
        erros.push('Pedido sem valor total. Verifique os itens do pedido.');
      }

      return { ok: erros.length === 0, erros, avisos };
    } catch (err) {
      return {
        ok: false,
        erros: ['Erro interno na validação: ' + String(err)],
        avisos,
      };
    }
  }

  /**
   * Valida se um documento pode ser cancelado
   */
  static async validarCancelamento(documentoId: string): Promise<ValidacaoFiscalResult> {
    const erros: string[] = [];

    const { data: doc } = await supabase
      .from('fiscal_documentos')
      .select('status, data_autorizacao, tipo_documento')
      .eq('id', documentoId)
      .single();

    if (!doc) {
      return { ok: false, erros: ['Documento não encontrado'], avisos: [] };
    }

    if (doc.status !== 'autorizado') {
      erros.push(`Somente documentos autorizados podem ser cancelados. Status atual: ${doc.status}`);
    }

    if (doc.data_autorizacao) {
      const horasDecorridas = (Date.now() - new Date(doc.data_autorizacao).getTime()) / (1000 * 60 * 60);
      if (horasDecorridas > 24 * 7) {
        // Prazo máximo de 7 dias para cancelamento em SP (varia por estado)
        erros.push('Prazo máximo para cancelamento pode ter expirado. Consulte seu contador.');
      } else if (horasDecorridas > 24 * 3) {
        return {
          ok: erros.length === 0,
          erros,
          avisos: ['Atenção: já se passaram mais de 72h desde a autorização. Verifique o prazo do seu estado.'],
        };
      }
    }

    return { ok: erros.length === 0, erros, avisos: [] };
  }
}

export default FiscalValidationService;
