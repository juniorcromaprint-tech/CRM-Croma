import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UnidadeInput {
  cliente_id: string;
  nome: string;
  tipo?: string | null;
  cnpj?: string | null;
  endereco_rua?: string | null;
  endereco_numero?: string | null;
  endereco_complemento?: string | null;
  endereco_bairro?: string | null;
  endereco_cidade?: string | null;
  endereco_estado?: string | null;
  endereco_cep?: string | null;
  telefone?: string | null;
  email?: string | null;
  responsavel?: string | null;
  ativo?: boolean;
}

export interface UnidadeUpdate extends Partial<Omit<UnidadeInput, 'cliente_id'>> {
  id: string;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const UNIDADES_KEY = 'unidades';

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * List unidades for a given cliente.
 */
export function useUnidades(clienteId: string | undefined) {
  return useQuery({
    queryKey: [UNIDADES_KEY, clienteId],
    queryFn: async () => {
      if (!clienteId) throw new Error('ID do cliente nao informado');

      const { data, error } = await supabase
        .from('unidades_cliente')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('nome', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!clienteId,
  });
}

/**
 * Create a new unidade.
 */
export function useCreateUnidade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UnidadeInput) => {
      const { data, error } = await supabase
        .from('unidades_cliente')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [UNIDADES_KEY, data.cliente_id] });
      showSuccess('Unidade criada com sucesso');
    },
    onError: (error: Error) => {
      showError(`Erro ao criar unidade: ${error.message}`);
    },
  });
}

/**
 * Update an existing unidade.
 */
export function useUpdateUnidade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UnidadeUpdate) => {
      const { data, error } = await supabase
        .from('unidades_cliente')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [UNIDADES_KEY, data.cliente_id] });
      showSuccess('Unidade atualizada com sucesso');
    },
    onError: (error: Error) => {
      showError(`Erro ao atualizar unidade: ${error.message}`);
    },
  });
}
