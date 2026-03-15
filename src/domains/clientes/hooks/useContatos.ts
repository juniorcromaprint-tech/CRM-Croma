import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContatoInput {
  cliente_id: string;
  unidade_id?: string | null;
  nome: string;
  cargo?: string | null;
  email?: string | null;
  telefone?: string | null;
  celular?: string | null;
  decisor?: boolean;
  ativo?: boolean;
}

export interface ContatoUpdate extends Partial<Omit<ContatoInput, 'cliente_id'>> {
  id: string;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const CONTATOS_KEY = 'contatos';

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * List contatos for a given cliente.
 */
export function useContatos(clienteId: string | undefined) {
  return useQuery({
    queryKey: [CONTATOS_KEY, clienteId],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      if (!clienteId) throw new Error('ID do cliente nao informado');

      const { data, error } = await supabase
        .from('contatos')
        .select('*, cliente_unidades(nome)')
        .eq('cliente_id', clienteId)
        .order('nome', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!clienteId,
  });
}

/**
 * Create a new contato.
 */
export function useCreateContato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ContatoInput) => {
      const { data, error } = await supabase
        .from('contatos')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [CONTATOS_KEY, data.cliente_id] });
      showSuccess('Contato criado com sucesso');
    },
    onError: (error: Error) => {
      showError(`Erro ao criar contato: ${error.message}`);
    },
  });
}

/**
 * Update an existing contato.
 */
export function useUpdateContato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: ContatoUpdate) => {
      const { data, error } = await supabase
        .from('contatos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [CONTATOS_KEY, data.cliente_id] });
      showSuccess('Contato atualizado com sucesso');
    },
    onError: (error: Error) => {
      showError(`Erro ao atualizar contato: ${error.message}`);
    },
  });
}
