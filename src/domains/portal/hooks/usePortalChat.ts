// src/domains/portal/hooks/usePortalChat.ts
// FASE 2-E — React Query wrapper para chat persistido do portal.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listarMensagens,
  inserirMensagem,
  type PortalMensagem,
} from '../services/portal.service';

const STALE_TIME_MS = 5_000;
const POLL_INTERVAL_MS = 10_000;

export interface UsePortalChatResult {
  messages: PortalMensagem[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  sendMessage: (args: { conteudo: string; metadata?: Record<string, unknown> }) => void;
  sendMessageAsync: (args: {
    conteudo: string;
    metadata?: Record<string, unknown>;
  }) => Promise<string>;
  isSending: boolean;
  refetch: () => void;
}

/**
 * Hook do chat do portal. Faz polling a cada 10s (V1 — sem realtime).
 * Persiste mensagens via RPC portal_inserir_mensagem (somente remetente='cliente'
 * pelo front-end; vendedor/ia precisam de service_role).
 */
export function usePortalChat(token: string): UsePortalChatResult {
  const qc = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: ['portal-mensagens', token],
    queryFn: () => listarMensagens(token),
    enabled: !!token,
    staleTime: STALE_TIME_MS,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const sendMutation = useMutation({
    mutationFn: ({
      conteudo,
      metadata,
    }: {
      conteudo: string;
      metadata?: Record<string, unknown>;
    }) => inserirMensagem(token, conteudo, metadata ?? {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal-mensagens', token] });
    },
  });

  return {
    messages: messagesQuery.data ?? [],
    isLoading: messagesQuery.isLoading,
    isFetching: messagesQuery.isFetching,
    isError: messagesQuery.isError,
    error: (messagesQuery.error as Error) ?? null,
    sendMessage: sendMutation.mutate,
    sendMessageAsync: sendMutation.mutateAsync,
    isSending: sendMutation.isPending,
    refetch: () => {
      void messagesQuery.refetch();
    },
  };
}
