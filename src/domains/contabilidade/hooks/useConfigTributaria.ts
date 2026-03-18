import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ConfigTributaria } from '../types/contabilidade.types';
import { showSuccess, showError } from '@/utils/toast';

export function useConfigTributaria() {
  return useQuery({
    queryKey: ['config-tributaria'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('config_tributaria')
        .select('*')
        .limit(1)
        .single();
      if (error) throw error;
      return data as ConfigTributaria;
    },
  });
}

export function useUpdateConfigTributaria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<ConfigTributaria>) => {
      const { data: existing } = await supabase
        .from('config_tributaria')
        .select('id')
        .limit(1)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('config_tributaria')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('config_tributaria')
          .insert(updates);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['config-tributaria'] });
      showSuccess('Configuração tributária atualizada');
    },
    onError: (err: Error) => showError(`Erro: ${err.message}`),
  });
}
