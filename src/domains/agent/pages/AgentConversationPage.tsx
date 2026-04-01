// ============================================================================
// AGENT CONVERSATION PAGE — Croma Print ERP/CRM
// Standalone page for /agente/conversa/:id — shows full conversation timeline
// ============================================================================

import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  MessageSquare,
  Mail,
  Smartphone,
  Send,
  Inbox,
  UserCog,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  CornerDownRight,
  Bot,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/shared/utils/format';
import { useAgentMessages, useEscalateConversation, useResumeConversation, useSendManualWhatsApp, useDeleteConversation, useDeleteMessage } from '../hooks/useAgentMessages';
import type { AgentConversation, AgentCanal, AgentMessageStatus } from '../types/agent.types';

// ─── Fetch single conversation ───────────────────────────────────────────────

const CONVERSATION_SELECT = `
  id, lead_id, canal, status, etapa, mensagens_enviadas, mensagens_recebidas,
  ultima_mensagem_em, proximo_followup, tentativas, max_tentativas,
  score_engajamento, metadata, created_at, updated_at,
  leads(empresa, contato_nome, contato_email, segmento, temperatura, score)
`.trim();

function useConversationById(id: string | undefined) {
  return useQuery({
    queryKey: ['agent', 'conversations', 'detail', id],
    enabled: !!id,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<AgentConversation | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('agent_conversations')
        .select(CONVERSATION_SELECT)
        .eq('id', id)
        .single();

      if (error) throw new Error(`Erro ao buscar conversa: ${error.message}`);
      return data as AgentConversation;
    },
  });
}

// ─── Badge helpers ───────────────────────────────────────────────────────────

const CANAL_ICON: Record<AgentCanal, typeof Mail> = {
  email: Mail,
  whatsapp: Smartphone,
  interno: MessageSquare,
};

const STATUS_CONFIG: Record<AgentMessageStatus, { label: string; icon: typeof CheckCircle; className: string }> = {
  rascunho:           { label: 'Rascunho',         icon: Clock,           className: 'text-slate-500 bg-slate-100' },
  pendente_aprovacao: { label: 'Pend. Aprovacao',  icon: Clock,           className: 'text-amber-700 bg-amber-100' },
  aprovada:           { label: 'Aprovada',          icon: CheckCircle,     className: 'text-emerald-700 bg-emerald-100' },
  enviada:            { label: 'Enviada',           icon: Send,            className: 'text-blue-700 bg-blue-100' },
  entregue:           { label: 'Entregue',          icon: CheckCircle,     className: 'text-blue-600 bg-blue-50' },
  lida:               { label: 'Lida',              icon: Eye,             className: 'text-indigo-700 bg-indigo-100' },
  respondida:         { label: 'Respondida',        icon: CornerDownRight, className: 'text-purple-700 bg-purple-100' },
  erro:               { label: 'Erro',              icon: AlertCircle,     className: 'text-red-700 bg-red-100' },
};

// ─── Message bubble ──────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onDelete,
}: {
  message: ReturnType<typeof useAgentMessages>['data'] extends (infer U)[] ? U : never;
  onDelete?: (messageId: string) => void;
}) {
  const isSent = message.direcao === 'enviada';
  const CanalIcon = CANAL_ICON[message.canal] ?? Mail;
  const statusCfg = STATUS_CONFIG[message.status] ?? STATUS_CONFIG.enviada;
  const StatusIcon = statusCfg.icon;

  return (
    <div className={`group flex gap-3 ${isSent ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${
        isSent ? 'bg-blue-100' : 'bg-slate-100'
      }`}>
        {isSent ? (
          <CanalIcon size={14} className="text-blue-600" />
        ) : (
          <Inbox size={14} className="text-slate-500" />
        )}
      </div>

      <div className={`flex-1 max-w-[80%] space-y-1 ${isSent ? 'items-end' : 'items-start'} flex flex-col`}>
        {message.assunto && (
          <p className="text-xs font-semibold text-slate-500">{message.assunto}</p>
        )}

        <div className="relative">
          <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
            isSent
              ? 'bg-blue-600 text-white rounded-tr-md'
              : 'bg-slate-100 text-slate-700 rounded-tl-md'
          }`}>
            {message.conteudo}
          </div>
          {onDelete && (
            <button
              onClick={() => onDelete(message.id)}
              className={`absolute top-1 ${isSent ? 'left-1' : 'right-1'} opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full bg-white/90 shadow-sm hover:bg-red-50 text-slate-400 hover:text-red-500`}
              title="Excluir mensagem"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>

        <div className={`flex items-center gap-2 text-xs text-slate-400 ${isSent ? 'flex-row-reverse' : ''}`}>
          <span>{message.enviado_em ? formatDate(message.enviado_em) : formatDate(message.created_at)}</span>
          {message.modelo_ia && (
            <span className="hidden sm:block truncate max-w-[120px]">{message.modelo_ia}</span>
          )}
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium ${statusCfg.className}`}>
            <StatusIcon size={9} />
            {statusCfg.label}
          </span>
        </div>

        {message.erro_mensagem && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle size={11} />
            {message.erro_mensagem}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AgentConversationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: conversation, isLoading: convLoading, error: convError } = useConversationById(id);
  const { data: messages = [], isLoading: msgsLoading } = useAgentMessages(id);
  const escalate = useEscalateConversation();
  const resume = useResumeConversation();
  const sendManual = useSendManualWhatsApp();
  const deleteConversation = useDeleteConversation();
  const deleteMessage = useDeleteMessage();
  const [manualText, setManualText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (convLoading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Carregando conversa...</span>
      </div>
    );
  }

  if (convError || !conversation) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/agente')} className="gap-2 text-slate-500 -ml-2">
          <ArrowLeft size={16} />
          Voltar
        </Button>
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <MessageSquare size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-600">Conversa nao encontrada</h3>
          <p className="text-sm text-slate-400 mt-1">A conversa solicitada nao existe ou foi removida.</p>
        </div>
      </div>
    );
  }

  const lead = conversation.leads;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate('/agente')} className="gap-2 text-slate-500 -ml-2">
        <ArrowLeft size={16} />
        Voltar ao Agente
      </Button>

      {/* Conversation header card */}
      <div className="bg-white rounded-2xl border border-slate-200 px-6 py-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              {lead?.empresa ?? 'Conversa'}
            </h1>
            {lead?.contato_nome && (
              <p className="text-sm text-slate-600 mt-0.5">{lead.contato_nome}</p>
            )}
            {lead?.contato_email && (
              <p className="text-xs text-slate-400">{lead.contato_email}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" className="text-xs">
              {conversation.etapa}
            </Badge>
            <Badge
              variant="secondary"
              className={`text-xs ${
                conversation.status === 'ativa'
                  ? 'bg-blue-100 text-blue-700'
                  : conversation.status === 'escalada'
                  ? 'bg-amber-100 text-amber-700'
                  : conversation.status === 'convertida'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {conversation.status}
            </Badge>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={15} />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir conversa</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todas as mensagens desta conversa serão excluídas permanentemente. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      deleteConversation.mutate(
                        { conversationId: conversation.id },
                        { onSuccess: () => navigate('/agente') }
                      )
                    }
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {deleteConversation.isPending ? (
                      <Loader2 size={14} className="animate-spin mr-2" />
                    ) : (
                      <Trash2 size={14} className="mr-2" />
                    )}
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>{conversation.mensagens_enviadas} enviadas</span>
          <span>{conversation.mensagens_recebidas} recebidas</span>
          <span>Tentativa {conversation.tentativas}/{conversation.max_tentativas}</span>
          <span>Score: {conversation.score_engajamento}/100</span>
        </div>
      </div>

      {/* Messages timeline */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-700 mb-4">Mensagens</h2>

        {msgsLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Carregando mensagens...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-12 text-center">
            <MessageSquare size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-500">Nenhuma mensagem</p>
            <p className="text-xs text-slate-400 mt-1">Esta conversa ainda nao tem mensagens.</p>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto space-y-6 pr-2">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onDelete={(messageId) =>
                  deleteMessage.mutate({ messageId, conversationId: conversation.id })
                }
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Escalated: manual message input */}
      {conversation.status === 'escalada' && (
        <div className="bg-white rounded-2xl border border-amber-200 p-6 space-y-4">
          <div className="flex items-center gap-2 text-amber-700">
            <UserCog size={18} />
            <h2 className="font-semibold">Conversa sob controle humano</h2>
          </div>
          <p className="text-xs text-slate-500">A IA não responde automaticamente. Escreva sua mensagem e envie diretamente pelo WhatsApp.</p>
          <Textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="Escreva sua mensagem para o lead..."
            className="rounded-xl text-sm min-h-[100px] resize-y"
          />
          <div className="flex items-center gap-3">
            <Button
              onClick={() => {
                if (!manualText.trim()) return;
                sendManual.mutate(
                  { conversationId: conversation.id, conteudo: manualText.trim() },
                  { onSuccess: () => setManualText('') }
                );
              }}
              disabled={!manualText.trim() || sendManual.isPending}
              className="bg-green-600 hover:bg-green-700 gap-2"
            >
              {sendManual.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {sendManual.isPending ? 'Enviando...' : 'Enviar via WhatsApp'}
            </Button>
            <Button
              variant="outline"
              onClick={() => resume.mutate({ conversationId: conversation.id })}
              disabled={resume.isPending}
              className="gap-2 text-blue-700 border-blue-200 hover:bg-blue-50"
            >
              {resume.isPending ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />}
              Devolver para IA
            </Button>
          </div>
        </div>
      )}

      {/* Action buttons (non-escalated) */}
      {conversation.status !== 'escalada' && (
        <div className="flex items-center gap-3">
          <Button
            onClick={() => navigate('/agente/aprovacao')}
            className="bg-blue-600 hover:bg-blue-700 gap-2"
          >
            <Send size={16} />
            Ir para Aprovacao
          </Button>
          <Button
            variant="outline"
            onClick={() => escalate.mutate({ conversationId: conversation.id })}
            disabled={escalate.isPending}
            className="gap-2 text-amber-700 border-amber-200 hover:bg-amber-50"
          >
            {escalate.isPending ? <Loader2 size={16} className="animate-spin" /> : <UserCog size={16} />}
            Assumir Conversa
          </Button>
        </div>
      )}
    </div>
  );
}
