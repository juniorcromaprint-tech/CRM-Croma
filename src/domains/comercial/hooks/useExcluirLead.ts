// src/domains/comercial/hooks/useExcluirLead.ts
// Hook de soft-delete de leads (UPDATE excluido_em + excluido_por).
// O filtro `excluido_em IS NULL` ja esta presente em vw_leads_disparo,
// entao leads excluidos somem da listagem automaticamente.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

export interface ExcluirLeadParams {
  leadId: string;
}

export function useExcluirLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId }: ExcluirLeadParams) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      // Soft delete — RLS controla quem pode UPDATE leads
      const { data, error } = await supabase
        .from('leads')
        .update({
          excluido_em: new Date().toISOString(),
          excluido_por: userId,
        })
        .eq('id', leadId)
        .is('excluido_em', null) // nao re-excluir
        .select('id')
        .single();

      if (error) throw error;
      if (!data) throw new Error('Lead nao encontrado ou ja excluido');
      return data;
    },

    onSuccess: () => {
      showSuccess('Lead excluido');
      // Invalida todas as queries que dependem da lista de leads
      queryClient.invalidateQueries({ queryKey: ['leads-disparo'] });
      queryClient.invalidateQueries({ queryKey: ['leads-disparo-counts-by-sub'] });
      queryClient.invalidateQueries({ queryKey: ['leads-disparo-counts-by-segmento'] });
      queryClient.invalidateQueries({ queryKey: ['campanha-status'] });
    },

    onError: (e: any) => {
      showError('Falha ao excluir: ' + (e.message || 'Erro desconhecido'));
    },
  });
}

// Versao em lote — exclui varios leads numa unica chamada
export function useExcluirLeadsEmLote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leadIds: string[]) => {
      if (leadIds.length === 0) return { count: 0 };

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      const { data, error } = await supabase
        .from('leads')
        .update({
          excluido_em: new Date().toISOString(),
          excluido_por: userId,
        })
        .in('id', leadIds)
        .is('excluido_em', null)
        .select('id');

      if (error) throw error;
      return { count: data?.length ?? 0 };
    },

    onSuccess: (result) => {
      showSuccess(
        result.count === 1
          ? '1 lead excluido'
          : `${result.count} leads excluidos`
      );
      queryClient.invalidateQueries({ queryKey: ['leads-disparo'] });
      queryClient.invalidateQueries({ queryKey: ['leads-disparo-counts-by-sub'] });
      queryClient.invalidateQueries({ queryKey: ['leads-disparo-counts-by-segmento'] });
      queryClient.invalidateQueries({ queryKey: ['campanha-status'] });
    },

    onError: (e: any) => {
      showError('Falha ao excluir em lote: ' + (e.message || 'Erro desconhecido'));
    },
  });
}
