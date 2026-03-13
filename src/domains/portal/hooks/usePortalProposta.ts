// src/domains/portal/hooks/usePortalProposta.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPropostaByToken, aprovarProposta } from '../services/portal.service';
import { showSuccess, showError } from '@/utils/toast';

export function usePortalProposta(token: string) {
  return useQuery({
    queryKey: ['portal-proposta', token],
    queryFn: () => fetchPropostaByToken(token),
    enabled: !!token,
    retry: 1,
    staleTime: 60_000,
  });
}

export function useAprovarProposta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ token, comentario }: { token: string; comentario?: string }) =>
      aprovarProposta(token, comentario),
    onSuccess: (_, { token }) => {
      queryClient.invalidateQueries({ queryKey: ['portal-proposta', token] });
      showSuccess('Orçamento aprovado com sucesso!');
    },
    onError: (err: Error) => {
      showError(err.message || 'Erro ao aprovar orçamento');
    },
  });
}
