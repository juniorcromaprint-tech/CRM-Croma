/**
 * CROMA PRINT ERP — Certificate Service
 *
 * REGRA DE SEGURANÇA CRÍTICA:
 * - O certificado A1 NUNCA é exposto no frontend
 * - Este serviço apenas gerencia METADADOS do certificado
 * - O arquivo criptografado fica no Supabase Storage
 * - A senha fica em variável de ambiente no backend (Edge Function)
 * - O uso real do certificado ocorre SOMENTE na Edge Function
 */

import { supabase } from '@/integrations/supabase/client';
import type { FiscalCertificado } from '@/domains/fiscal/types/fiscal.types';

export class CertificateService {
  /**
   * Lista certificados (apenas metadados — sem conteúdo do arquivo)
   */
  static async listar(): Promise<FiscalCertificado[]> {
    const { data, error } = await supabase
      .from('fiscal_certificados')
      .select('id, nome, tipo_certificado, thumbprint, cnpj_titular, validade_inicio, validade_fim, ambiente_id, ativo, ultimo_teste_em, ultimo_teste_status, observacoes, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    // NUNCA retorna arquivo_encriptado_url ou senha_secret_ref
    return (data ?? []) as FiscalCertificado[];
  }

  /**
   * Faz upload do arquivo .pfx criptografado para o Storage
   * APENAS o backend (Edge Function) pode descriptografar e usar
   */
  static async uploadCertificado(params: {
    nome: string;
    cnpj_titular: string;
    arquivo: File;
    validade_inicio?: string;
    validade_fim?: string;
    ambiente_id?: string;
    observacoes?: string;
  }): Promise<{ ok: boolean; id?: string; erro?: string }> {
    try {
      // Upload do arquivo para bucket privado
      const fileName = `cert_${Date.now()}_${params.cnpj_titular}.pfx.enc`;
      const storagePath = `certificados/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('fiscal-certificados')
        .upload(storagePath, params.arquivo, {
          contentType: 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Salva apenas os metadados — nunca o conteúdo raw
      const { data, error: dbError } = await supabase
        .from('fiscal_certificados')
        .insert({
          nome: params.nome,
          tipo_certificado: 'a1',
          arquivo_encriptado_url: storagePath,
          cnpj_titular: params.cnpj_titular,
          validade_inicio: params.validade_inicio,
          validade_fim: params.validade_fim,
          ambiente_id: params.ambiente_id,
          observacoes: params.observacoes,
          ativo: true,
        })
        .select('id')
        .single();

      if (dbError) throw dbError;

      return { ok: true, id: data.id };
    } catch (err) {
      return { ok: false, erro: String(err) };
    }
  }

  /**
   * Testa o certificado via Edge Function (backend valida a senha e conexão)
   */
  static async testar(certificadoId: string): Promise<{ ok: boolean; mensagem: string }> {
    try {
      const response = await supabase.functions.invoke('fiscal-testar-certificado', {
        body: { certificado_id: certificadoId },
      });

      const now = new Date().toISOString();
      const resultado = response.error ? 'falha' : 'sucesso';
      const mensagem = response.error
        ? response.error.message
        : (response.data as any)?.mensagem ?? 'Certificado válido';

      // Atualiza o resultado do teste nos metadados
      await supabase
        .from('fiscal_certificados')
        .update({
          ultimo_teste_em: now,
          ultimo_teste_status: resultado,
          updated_at: now,
        })
        .eq('id', certificadoId);

      return { ok: resultado === 'sucesso', mensagem };
    } catch (err) {
      return { ok: false, mensagem: String(err) };
    }
  }

  /**
   * Ativa/desativa certificado
   */
  static async setAtivo(certificadoId: string, ativo: boolean): Promise<void> {
    await supabase
      .from('fiscal_certificados')
      .update({ ativo, updated_at: new Date().toISOString() })
      .eq('id', certificadoId);
  }

  /**
   * Verifica certificados prestes a vencer (avisa com 60+ dias de antecedência)
   */
  static async verificarVencimentos(): Promise<Array<{ id: string; nome: string; diasRestantes: number }>> {
    const { data } = await supabase
      .from('fiscal_certificados')
      .select('id, nome, validade_fim')
      .eq('ativo', true)
      .not('validade_fim', 'is', null);

    const avisos: Array<{ id: string; nome: string; diasRestantes: number }> = [];

    for (const cert of data ?? []) {
      if (!cert.validade_fim) continue;
      const diasRestantes = Math.floor(
        (new Date(cert.validade_fim).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (diasRestantes <= 60) {
        avisos.push({ id: cert.id, nome: cert.nome, diasRestantes });
      }
    }

    return avisos;
  }
}

export default CertificateService;
