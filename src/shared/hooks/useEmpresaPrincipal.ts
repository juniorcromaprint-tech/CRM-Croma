import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EmpresaPrincipal {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  ie: string | null;
  im: string | null;
  telefone: string | null;
  logo_url: string | null;
  logradouro: string | null;
  numero_endereco: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
}

/** Hook React: retorna a empresa principal (primeira ativa). Cache de 5 min. */
export function useEmpresaPrincipal() {
  return useQuery({
    queryKey: ['empresa_principal'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select(
          'id, razao_social, nome_fantasia, cnpj, ie, im, telefone, logo_url, logradouro, numero_endereco, bairro, municipio, uf, cep'
        )
        .eq('ativa', true)
        .order('created_at')
        .limit(1)
        .single();
      if (error) return null;
      return data as EmpresaPrincipal;
    },
  });
}

/** Função async (não-hook): para uso em geração de PDF, funções utilitárias. */
export async function fetchEmpresaPrincipal(): Promise<EmpresaPrincipal | null> {
  const { data, error } = await supabase
    .from('empresas')
    .select(
      'id, razao_social, nome_fantasia, cnpj, ie, im, telefone, logo_url, logradouro, numero_endereco, bairro, municipio, uf, cep'
    )
    .eq('ativa', true)
    .order('created_at')
    .limit(1)
    .single();
  if (error) return null;
  return data as EmpresaPrincipal;
}
