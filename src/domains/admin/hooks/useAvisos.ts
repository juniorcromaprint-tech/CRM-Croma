// ============================================================================
// useAvisos — Croma Print ERP/CRM
// CRUD completo da tabela quadro_avisos via TanStack Query
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

export interface Aviso {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: 'aviso' | 'alerta';
  grupo_destino: string[];
  data_inicio: string;
  data_fim: string | null;
  fixo: boolean;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface AvisoInput {
  titulo: string;
  mensagem: string;
  tipo: 'aviso' | 'alerta';
  grupo_destino: string[];
  data_inicio: string;
  data_fim: string | null;
  fixo: boolean;
}

const QUERY_KEY = ['avisos'] as const;

// ── List ──────────────────────────────────────────────────────────────────────

export function useAvisosList() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<Aviso[]> => {
      const { data, error } = await (supabase as any)
        .from('quadro_avisos')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Aviso[];
    },
  });
}

// ── Create ────────────────────────────────────────────────────────────────────

export function useCreateAviso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AvisoInput) => {
      const { data, error } = await (supabase as any)
        .from('quadro_avisos')
        .insert([input])
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Aviso;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ['avisos-vigentes'] });
      showSuccess('Aviso criado com sucesso!');
    },
    onError: (err: Error) => {
      showError(err.message ?? 'Erro ao criar aviso.');
    },
  });
}

// ── Update ────────────────────────────────────────────────────────────────────

export function useUpdateAviso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: AvisoInput }) => {
      const { data, error } = await (supabase as any)
        .from('quadro_avisos')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Aviso;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ['avisos-vigentes'] });
      showSuccess('Aviso atualizado!');
    },
    onError: (err: Error) => {
      showError(err.message ?? 'Erro ao atualizar aviso.');
    },
  });
}

// ── Delete ────────────────────────────────────────────────────────────────────

export function useDeleteAviso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('quadro_avisos')
        .delete()
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ['avisos-vigentes'] });
      showSuccess('Aviso removido.');
    },
    onError: (err: Error) => {
      showError(err.message ?? 'Erro ao remover aviso.');
    },
  });
}
