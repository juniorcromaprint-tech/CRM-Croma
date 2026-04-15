// src/domains/comercial/hooks/usePropostaAttachments.ts
// Query de anexos de proposta + delete mutation (soft-delete via edge)
// v1 (2026-04-14)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

export type PropostaAttachment = {
  id: string;
  proposta_id: string;
  nome_arquivo: string;
  tipo_mime: string;
  tamanho_bytes: number | null;
  onedrive_file_id: string | null;
  onedrive_file_url: string | null;
  preview_url: string | null;
  file_sha256: string | null;
  uploaded_by_type: string | null; // 'vendedor' | 'cliente'
  uploaded_by_name: string | null;
  uploaded_by_user_id: string | null;
  deleted_at: string | null;
  deleted_by_user_id: string | null;
  created_at: string;
};

export function usePropostaAttachments(propostaId: string | undefined) {
  return useQuery<PropostaAttachment[]>({
    queryKey: ['proposta-attachments', propostaId],
    enabled: !!propostaId,
    queryFn: async () => {
      if (!propostaId) return [];
      const { data, error } = await supabase
        .from('proposta_attachments')
        .select('*')
        .eq('proposta_id', propostaId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as PropostaAttachment[];
    },
    staleTime: 30_000,
  });
}

export function useDeletePropostaAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attachmentId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sessao expirada');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(
        `${supabaseUrl}/functions/v1/proposta-attachment-delete`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ attachmentId }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`);
      return json as { success: boolean };
    },
    onSuccess: (_data, attachmentId) => {
      // Invalida a query de attachments de QUALQUER proposta que tinha este anexo
      queryClient.invalidateQueries({ queryKey: ['proposta-attachments'] });
      showSuccess('Arquivo removido com sucesso');
    },
    onError: (err: Error) => {
      showError(err.message ?? 'Falha ao remover arquivo');
    },
  });
}
