import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

export function useFiscalDocumentos(filters?: { status?: string; pedido_id?: string }) {
  return useQuery({
    queryKey: ['fiscal_documentos', filters],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      let query = supabase
        .from('fiscal_documentos')
        .select(`*, clientes(razao_social, nome_fantasia), pedidos!fiscal_documentos_pedido_id_fkey(numero), fiscal_ambientes(nome, tipo), fiscal_series(serie)`)
        .order('created_at', { ascending: false })
        .limit(200);
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.pedido_id) query = query.eq('pedido_id', filters.pedido_id);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useFiscalDocumento(id: string | null) {
  return useQuery({
    queryKey: ['fiscal_documento', id],
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiscal_documentos')
        .select(`*, fiscal_documentos_itens(*), fiscal_eventos(*), fiscal_xmls(*), clientes(*), pedidos!fiscal_documentos_pedido_id_fkey(numero, status, valor_total), fiscal_ambientes(nome, tipo), fiscal_series(serie), fiscal_certificados(nome, validade_fim)`)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useFiscalAmbientes() {
  return useQuery({
    queryKey: ['fiscal_ambientes'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('fiscal_ambientes').select('id, codigo, nome, tipo, endpoint_base, ativo, empresa_id, empresas(id, razao_social, cnpj, ie, crt), created_at, updated_at').order('tipo');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useFiscalSeries() {
  return useQuery({
    queryKey: ['fiscal_series'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('fiscal_series').select('*, fiscal_ambientes(nome, tipo)').order('serie');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useFiscalCertificados() {
  return useQuery({
    queryKey: ['fiscal_certificados'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiscal_certificados')
        .select('id, nome, tipo_certificado, thumbprint, cnpj_titular, validade_inicio, validade_fim, ambiente_id, ativo, ultimo_teste_em, ultimo_teste_status, observacoes, created_at, updated_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useFiscalRegras() {
  return useQuery({
    queryKey: ['fiscal_regras_operacao'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiscal_regras_operacao')
        .select('*, fiscal_series(serie), fiscal_ambientes(nome, tipo)')
        .order('prioridade_regra', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useFiscalFila() {
  return useQuery({
    queryKey: ['fiscal_filas_emissao'],
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiscal_filas_emissao')
        .select(`*, fiscal_documentos(id, status, valor_total, tipo_documento, clientes(razao_social), pedidos!fiscal_documentos_pedido_id_fkey(numero))`)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15000,
  });
}

export function useFiscalAuditLogs(params?: { entidade_id?: string }) {
  return useQuery({
    queryKey: ['fiscal_audit_logs', params],
    staleTime: 60 * 1000,
    queryFn: async () => {
      let query = supabase.from('fiscal_audit_logs').select('*').order('created_at', { ascending: false }).limit(500);
      if (params?.entidade_id) query = query.eq('entidade_id', params.entidade_id);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useGerarRascunhoFiscal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pedidoId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.rpc('fiscal_criar_rascunho_nfe', {
        p_pedido_id: pedidoId,
        p_user_id: user?.id ?? '00000000-0000-0000-0000-000000000000',
        p_provider: 'nfe_provider',
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fiscal_documentos'] });
      qc.invalidateQueries({ queryKey: ['pedidos'] });
      showSuccess('Rascunho fiscal gerado com sucesso!');
    },
    onError: (err: any) => showError(err.message ?? 'Erro ao gerar rascunho fiscal'),
  });
}

export function useEmitirNFe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (documentoId: string) => {
      const { data, error } = await supabase.functions.invoke('fiscal-emitir-nfe', {
        body: { documento_id: documentoId },
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['fiscal_documentos'] });
      qc.invalidateQueries({ queryKey: ['pedidos'] });
      if (data?.sucesso) {
        showSuccess(`NF-e autorizada! Protocolo: ${data.protocolo ?? '---'}`);
      } else {
        showError('NF-e rejeitada: ' + (data?.mensagem_erro ?? 'Verifique os dados'));
      }
    },
    onError: (err: any) => showError(err.message ?? 'Erro ao emitir NF-e'),
  });
}

// ─── AI Validation before emission ──────────────────────────────────────────

export interface NFeValidationItem {
  campo: string;
  valor_atual: string | null;
  valor_sugerido: string | null;
  motivo: string;
}

export interface NFeValidationResult {
  valido: boolean;
  erros: NFeValidationItem[];
  avisos: NFeValidationItem[];
  sugestoes: NFeValidationItem[];
}

export function useValidarNFe() {
  return useMutation({
    mutationFn: async (params: { pedido_id?: string; documento_id?: string }): Promise<NFeValidationResult> => {
      const { data, error } = await supabase.functions.invoke('ai-validar-nfe', {
        body: params,
      });
      if (error) throw error;
      return data as NFeValidationResult;
    },
    onError: (err: any) => showError(err.message ?? 'Erro na validação'),
  });
}

export function useCancelarNFe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ documentoId, justificativa }: { documentoId: string; justificativa: string }) => {
      const { data, error } = await supabase.functions.invoke('fiscal-cancelar-nfe', {
        body: { documento_id: documentoId, justificativa },
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['fiscal_documentos'] });
      qc.invalidateQueries({ queryKey: ['pedidos'] });
      if (data?.sucesso) {
        showSuccess('NF-e cancelada com sucesso!');
      } else {
        showError('Erro no cancelamento: ' + (data?.mensagem ?? 'Erro desconhecido'));
      }
    },
    onError: (err: any) => showError(err.message ?? 'Erro ao cancelar NF-e'),
  });
}

export function useGerarDanfe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (documentoId: string) => {
      const { data, error } = await supabase.functions.invoke('fiscal-gerar-danfe', {
        body: { documento_id: documentoId },
      });
      if (error) throw error;
      const result = data as { ok: boolean; pdf_url?: string; mensagem?: string };
      if (!result.ok) throw new Error(result.mensagem ?? 'Erro ao gerar DANFE');
      // Download direto via fetch+blob para forcar download real
      if (result.pdf_url) {
        try {
          const resp = await fetch(result.pdf_url);
          const blob = await resp.blob();
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          const ext = result.pdf_url.includes('.pdf') ? 'pdf' : 'html';
          a.download = `danfe_${documentoId}.${ext}`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          URL.revokeObjectURL(a.href);
        } catch { window.open(result.pdf_url, '_blank'); }
      }
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fiscal_documentos'] });
      showSuccess('DANFE gerado com sucesso!');
    },
    onError: (err: any) => showError(err.message ?? 'Erro ao gerar DANFE'),
  });
}

export function useAlternarAmbienteFiscal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ambienteId: string) => {
      // Desativa todos os ambientes
      const { error: e1 } = await supabase
        .from('fiscal_ambientes')
        .update({ ativo: false })
        .neq('id', ambienteId);
      if (e1) throw e1;
      // Ativa o ambiente selecionado
      const { error: e2 } = await supabase
        .from('fiscal_ambientes')
        .update({ ativo: true })
        .eq('id', ambienteId);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fiscal_ambientes'] });
      showSuccess('Ambiente fiscal alterado com sucesso!');
    },
    onError: (err: any) => showError(err.message ?? 'Erro ao alternar ambiente'),
  });
}

export function useValidarPedidoFiscal() {
  return useMutation({
    mutationFn: async (pedidoId: string) => {
      const { data, error } = await supabase.rpc('fiscal_validar_pedido_nfe', { p_pedido_id: pedidoId });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
    onError: (err: any) => showError(err.message ?? 'Erro na validação fiscal'),
  });
}
