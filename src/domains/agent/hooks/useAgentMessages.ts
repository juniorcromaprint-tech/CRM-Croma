import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import type { AgentMessage } from '../types/agent.types';

// ─── Query Keys ─────────────────────────────────────────────────────────────

const AGENT_KEY = ['agent'] as const;
const MESSAGES_KEY = [...AGENT_KEY, 'messages'] as const;

function messagesQueryKey(conversationId?: string) {
  return conversationId
    ? [...MESSAGES_KEY, 'list', conversationId]
    : [...MESSAGES_KEY, 'list'];
}

const PENDING_MESSAGES_KEY = [...MESSAGES_KEY, 'pending'] as const;

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Lista mensagens de uma conversa, em ordem cronológica.
 * Habilitado apenas quando conversationId está presente.
 */
export function useAgentMessages(conversationId?: string) {
  return useQuery({
    queryKey: messagesQueryKey(conversationId),
    staleTime: 30 * 1000,
    enabled: !!conversationId,
    queryFn: async (): Promise<AgentMessage[]> => {
      const { data, error } = await supabase
        .from('agent_messages')
        .select(
          'id, conversation_id, direcao, canal, conteudo, assunto, metadata, status, ' +
          'aprovado_por, aprovado_em, enviado_em, lido_em, respondido_em, erro_mensagem, ' +
          'custo_ia, modelo_ia, created_at'
        )
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Erro ao buscar mensagens: ${error.message}`);
      }

      return (data ?? []) as AgentMessage[];
    },
  });
}

/**
 * Lista todas as mensagens pendentes de aprovação humana,
 * com join em conversa e lead para contexto de exibição.
 */
export function usePendingMessages() {
  return useQuery({
    queryKey: PENDING_MESSAGES_KEY,
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_messages')
        .select(
          'id, conversation_id, direcao, canal, conteudo, assunto, metadata, status, ' +
          'aprovado_por, aprovado_em, enviado_em, lido_em, respondido_em, erro_mensagem, ' +
          'custo_ia, modelo_ia, created_at, ' +
          'agent_conversations(id, canal, etapa, leads(empresa, contato_nome, contato_email, segmento, temperatura, score))'
        )
        .eq('status', 'pendente_aprovacao')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar mensagens pendentes: ${error.message}`);
      }

      return data ?? [];
    },
  });
}

/**
 * Aprova uma mensagem: status → 'aprovada', registra aprovador e timestamp.
 */
export function useApproveMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      messageId,
      conversationId,
    }: {
      messageId: string;
      conversationId: string;
    }) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { data, error } = await supabase
        .from('agent_messages')
        .update({
          status: 'aprovada',
          aprovado_por: session?.user?.id ?? null,
          aprovado_em: new Date().toISOString(),
        })
        .eq('id', messageId)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao aprovar mensagem: ${error.message}`);
      }

      return { data, conversationId };
    },
    onSuccess: ({ conversationId }) => {
      queryClient.invalidateQueries({ queryKey: MESSAGES_KEY });
      queryClient.invalidateQueries({ queryKey: messagesQueryKey(conversationId) });
      showSuccess('Mensagem aprovada');
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}

/**
 * Rejeita uma mensagem: status → 'rascunho' (volta para composição).
 */
export function useRejectMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      messageId,
      conversationId,
    }: {
      messageId: string;
      conversationId: string;
    }) => {
      const { error } = await supabase
        .from('agent_messages')
        .update({ status: 'rascunho' })
        .eq('id', messageId);

      if (error) {
        throw new Error(`Erro ao rejeitar mensagem: ${error.message}`);
      }

      return { conversationId };
    },
    onSuccess: ({ conversationId }) => {
      queryClient.invalidateQueries({ queryKey: MESSAGES_KEY });
      queryClient.invalidateQueries({ queryKey: messagesQueryKey(conversationId) });
      showSuccess('Mensagem devolvida para revisão');
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}

/**
 * Envia uma mensagem já aprovada via Edge Function `agent-enviar-email`.
 * Invalida queries de mensagens e conversas.
 */
export function useSendApprovedMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      messageId,
      conversationId,
    }: {
      messageId: string;
      conversationId: string;
    }) => {
      const res = await supabase.functions.invoke('agent-enviar-email', {
        body: { message_id: messageId, conversation_id: conversationId },
      });

      if (res.error) throw new Error(res.error.message);

      return { data: res.data, conversationId };
    },
    onSuccess: ({ conversationId }) => {
      queryClient.invalidateQueries({ queryKey: MESSAGES_KEY });
      queryClient.invalidateQueries({ queryKey: messagesQueryKey(conversationId) });
      queryClient.invalidateQueries({ queryKey: ['agent', 'conversations'] });
      showSuccess('Mensagem enviada com sucesso');
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}

/**
 * Envia uma mensagem WhatsApp já aprovada via Edge Function `whatsapp-enviar`.
 * Mesmo padrão que useSendApprovedMessage, mas usa a Edge Function de WhatsApp.
 * Invalida queries de mensagens e conversas.
 */
export function useSendApprovedWhatsApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      messageId,
      conversationId,
    }: {
      messageId: string;
      conversationId: string;
    }) => {
      const res = await supabase.functions.invoke('whatsapp-enviar', {
        body: { message_id: messageId, conversation_id: conversationId },
      });

      if (res.error) throw new Error(res.error.message);

      return { data: res.data, conversationId };
    },
    onSuccess: ({ conversationId }) => {
      queryClient.invalidateQueries({ queryKey: MESSAGES_KEY });
      queryClient.invalidateQueries({ queryKey: messagesQueryKey(conversationId) });
      queryClient.invalidateQueries({ queryKey: ['agent', 'conversations'] });
      showSuccess('WhatsApp enviado com sucesso');
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}

/**
 * Escala uma conversa para atendimento humano.
 * Muda status da conversa para 'escalada' e a IA para de responder automaticamente.
 */
export function useEscalateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId }: { conversationId: string }) => {
      const { error } = await supabase
        .from('agent_conversations')
        .update({ status: 'escalada' })
        .eq('id', conversationId);

      if (error) throw new Error(`Erro ao escalar conversa: ${error.message}`);

      return { conversationId };
    },
    onSuccess: ({ conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['agent', 'conversations'] });
      queryClient.invalidateQueries({ queryKey: messagesQueryKey(conversationId) });
      showSuccess('Conversa escalada para atendimento humano');
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}

/**
 * Retorna uma conversa escalada para a IA (status → ativa novamente).
 */
export function useResumeConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId }: { conversationId: string }) => {
      const { error } = await supabase
        .from('agent_conversations')
        .update({ status: 'ativa' })
        .eq('id', conversationId);

      if (error) throw new Error(`Erro ao retomar conversa: ${error.message}`);

      return { conversationId };
    },
    onSuccess: ({ conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['agent', 'conversations'] });
      queryClient.invalidateQueries({ queryKey: messagesQueryKey(conversationId) });
      showSuccess('Conversa devolvida para o agente IA');
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}

/**
 * Envia mensagem manual de um humano numa conversa escalada.
 * Cria a mensagem como aprovada, depois chama whatsapp-enviar.
 */
export function useSendManualWhatsApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      conteudo,
    }: {
      conversationId: string;
      conteudo: string;
    }) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // 1. Create message as aprovada (skip approval queue)
      const { data: msg, error: insertErr } = await supabase
        .from('agent_messages')
        .insert({
          conversation_id: conversationId,
          direcao: 'enviada',
          canal: 'whatsapp',
          conteudo,
          status: 'aprovada',
          aprovado_por: session?.user?.id ?? null,
          aprovado_em: new Date().toISOString(),
          metadata: { manual: true, sent_by: session?.user?.id },
        })
        .select('id')
        .single();

      if (insertErr || !msg) throw new Error(`Erro ao criar mensagem: ${insertErr?.message}`);

      // 2. Send via whatsapp-enviar Edge Function
      const res = await supabase.functions.invoke('whatsapp-enviar', {
        body: { message_id: msg.id },
      });

      if (res.error) throw new Error(res.error.message);

      return { conversationId };
    },
    onSuccess: ({ conversationId }) => {
      queryClient.invalidateQueries({ queryKey: MESSAGES_KEY });
      queryClient.invalidateQueries({ queryKey: messagesQueryKey(conversationId) });
      queryClient.invalidateQueries({ queryKey: ['agent', 'conversations'] });
      showSuccess('Mensagem manual enviada via WhatsApp');
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}
