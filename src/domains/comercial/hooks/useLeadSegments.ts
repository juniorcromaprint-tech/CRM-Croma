// src/domains/comercial/hooks/useLeadSegments.ts
// Hook para criar, listar e carregar segmentos salvos de leads.
// UX #8 (2026-05-11): permite salvar a cesta atual como "segmento" e
// re-carregar depois (ex: follow-up WhatsApp nos mesmos leads do email).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

export interface LeadSegment {
  id: string;
  nome: string;
  descricao: string | null;
  lead_ids: string[];
  total_leads: number;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

export function useLeadSegments() {
  return useQuery({
    queryKey: ['lead-segments'],
    queryFn: async (): Promise<LeadSegment[]> => {
      const { data, error } = await supabase
        .from('lead_segments')
        .select('*')
        .order('criado_em', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as LeadSegment[];
    },
    staleTime: 30_000,
  });
}

export function useCreateLeadSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { nome: string; descricao?: string; lead_ids: string[] }) => {
      if (!input.nome.trim()) throw new Error('Dê um nome ao segmento');
      if (!input.lead_ids.length) throw new Error('Selecione pelo menos 1 lead');

      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('lead_segments')
        .insert({
          nome: input.nome.trim(),
          descricao: input.descricao?.trim() || null,
          lead_ids: input.lead_ids,
          criado_por: user?.id ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Falha ao salvar segmento — verifique suas permissões.');
      return data as LeadSegment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-segments'] });
      showSuccess('Segmento salvo!');
    },
    onError: (err: any) => showError(err.message || 'Erro ao salvar segmento'),
  });
}

export function useDeleteLeadSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lead_segments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-segments'] });
      showSuccess('Segmento excluído');
    },
    onError: (err: any) => showError(err.message || 'Erro ao excluir segmento'),
  });
}
