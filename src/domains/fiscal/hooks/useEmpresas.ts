import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

export interface Empresa {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  ie: string | null;
  im: string | null;
  crt: number;
  logradouro: string | null;
  numero_endereco: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  codigo_municipio_ibge: string | null;
  telefone: string | null;
  logo_url: string | null;
  ativa: boolean;
  created_at: string;
  updated_at: string;
}

export function useEmpresas() {
  return useQuery({
    queryKey: ['empresas'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .order('razao_social');
      if (error) throw error;
      return (data ?? []) as Empresa[];
    },
  });
}

export function useEmpresasAtivas() {
  return useQuery({
    queryKey: ['empresas', 'ativas'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('id, razao_social, nome_fantasia, cnpj, ativa')
        .eq('ativa', true)
        .order('razao_social');
      if (error) throw error;
      return (data ?? []) as Pick<Empresa, 'id' | 'razao_social' | 'nome_fantasia' | 'cnpj' | 'ativa'>[];
    },
  });
}

export function useSalvarEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (empresa: Partial<Empresa> & { id?: string }) => {
      if (empresa.id) {
        const { id, created_at, updated_at, ...rest } = empresa as any;
        const { error } = await supabase
          .from('empresas')
          .update(rest)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { id, created_at, updated_at, ...rest } = empresa as any;
        const { error } = await supabase.from('empresas').insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['empresas'] });
      showSuccess(vars.id ? 'Empresa atualizada!' : 'Empresa cadastrada!');
    },
    onError: (err: any) => showError(err.message ?? 'Erro ao salvar empresa'),
  });
}

export function useExcluirEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Verificar se tem documentos fiscais vinculados
      const { count } = await supabase
        .from('fiscal_documentos')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', id);
      if (count && count > 0) {
        throw new Error(`Empresa possui ${count} documento(s) fiscal(is). Não é possível excluir.`);
      }
      const { error } = await supabase.from('empresas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empresas'] });
      showSuccess('Empresa excluída!');
    },
    onError: (err: any) => showError(err.message ?? 'Erro ao excluir empresa'),
  });
}

/**
 * Hook utilitário: retorna a empresa que deve ser usada na emissão.
 * - Se 1 empresa ativa → retorna ela automaticamente
 * - Se 0 ou 2+ → retorna null (UI deve perguntar)
 */
export function useEmpresaEmissaoAuto() {
  const { data: empresas } = useEmpresasAtivas();
  if (!empresas || empresas.length !== 1) return null;
  return empresas[0];
}
