/**
 * CROMA PRINT ERP — Fiscal Audit Service
 */

import { supabase } from '@/integrations/supabase/client';
import type { FiscalAuditLog } from '@/domains/fiscal/types/fiscal.types';

export type AcaoFiscal =
  | 'validar_fiscal'
  | 'gerar_rascunho'
  | 'emitir_nfe'
  | 'consultar_nfe'
  | 'cancelar_nfe'
  | 'reprocessar_nfe'
  | 'baixar_xml'
  | 'baixar_pdf'
  | 'trocar_certificado'
  | 'alterar_regra_fiscal'
  | 'configurar_ambiente'
  | 'configurar_serie';

export class FiscalAuditService {
  static async registrar(params: {
    entidade: string;
    entidade_id: string;
    acao: AcaoFiscal;
    resultado: 'sucesso' | 'falha' | 'aviso';
    antes?: Record<string, unknown>;
    depois?: Record<string, unknown>;
    metadados?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await supabase.rpc('fiscal_registrar_auditoria', {
        p_user_id: null, // demo mode
        p_entidade: params.entidade,
        p_entidade_id: params.entidade_id,
        p_acao: params.acao,
        p_resultado: params.resultado,
        p_antes: params.antes ?? null,
        p_depois: params.depois ?? null,
        p_metadados: params.metadados ?? null,
      });
    } catch {
      // Auditoria nunca deve quebrar o fluxo principal
    }
  }

  static async listar(params?: {
    entidade_id?: string;
    acao?: string;
    limit?: number;
  }): Promise<FiscalAuditLog[]> {
    let query = supabase
      .from('fiscal_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(params?.limit ?? 100);

    if (params?.entidade_id) {
      query = query.eq('entidade_id', params.entidade_id);
    }
    if (params?.acao) {
      query = query.eq('acao', params.acao);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as FiscalAuditLog[];
  }
}

export default FiscalAuditService;
