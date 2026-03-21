// ============================================================================
// CONVERSATION DETAIL — Croma Print ERP/CRM
// Sheet com timeline completa de uma conversa do agente
// ============================================================================

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Mail,
  Smartphone,
  MessageSquare,
  Send,
  Inbox,
  UserCog,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  CornerDownRight,
  Bot,
} from 'lucide-react';
import { formatDate } from '@/shared/utils/format';
import { useAgentMessages, useEscalateConversation, useResumeConversation, useSendManualWhatsApp } from '../hooks/useAgentMessages';
import type { AgentConversation, AgentCanal, AgentMessageStatus } from '../types/agent.types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ConversationDetailProps {
  conversation: AgentConversation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComposeMessage?: (conversation: AgentConversation) => void;
  onEscalate?: (conversation: AgentConversation) => void;
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

const CANAL_ICON: Record<AgentCanal, typeof Mail> = {
  email: Mail,
  whatsapp: Smartphone,
  interno: MessageSquare,
};

const STATUS_CONFIG: Record<AgentMessageStatus, { label: string; icon: typeof CheckCircle; className: string }> = {
  rascunho:           { label: 'Rascunho',         icon: Clock,        className: 'text-slate-500 bg-slate-100' },
  pendente_aprovacao: { label: 'Pend. Aprovação',   icon: Clock,        className: 'text-amber-700 bg-amber-100' },
  aprovada:           { label: 'Aprovada',          icon: CheckCircle,  className: 'text-emerald-700 bg-emerald-100' },
  enviada:            { label: 'Enviada',           icon: Send,         className: 'text-blue-700 bg-blue-100' },
  entregue:           { label: 'Entregue',          icon: CheckCircle,  className: 'text-blue-600 bg-blue-50' },
  lida:               { label: 'Lida',              icon: Eye,          className: 'text-indigo-700 bg-indigo-100' },
  respondida:         { label: 'Respondida',        icon: CornerDownRight, className: 'text-purple-700 bg-purple-100' },
  erro:               { label: 'Erro',              icon: AlertCircle,  className: 'text-red-700 bg-red-100' },
};

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ReturnType<typeof useAgentMessages>['data'] extends (infer U)[] ? U : never }) {
  const isSent = message.direcao === 'enviada';
  const CanalIcon = CANAL_ICON[message.canal] ?? Mail;
  const statusCfg = STATUS_CONFIG[message.status] ?? STATUS_CONFIG.enviada;
  const StatusIcon = statusCfg.icon;

  return (
    <div className={`flex gap-3 ${isSent ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${
        isSent ? 'bg-blue-100' : 'bg-slate-100'
      }`}>
        {isSent ? (
          <CanalIcon size={14} className="text-blue-600" />
        ) : (
          <Inbox size={14} className="text-slate-500" />
        )}
      </div>

      {/* Bubble */}
      <div className={`flex-1 max-w-[85%] space-y-1 ${isSent ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Assunto */}
        {message.assunto && (
          <p className="text-xs font-semibold text-slate-500">{message.assunto}</p>
        )}

        {/* Content */}
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isSent
            ? 'bg-blue-600 text-white rounded-tr-md'
            : 'bg-slate-100 text-slate-700 rounded-tl-md'
        }`}>
          {message.conteudo}
        </div>

        {/* Meta */}
        <div className={`flex items-center gap-2 text-xs text-slate-400 ${isSent ? 'flex-row-reverse' : ''}`}>
          <span>{message.enviado_em ? formatDate(message.enviado_em) : formatDate(message.created_at)}</span>
          {message.modelo_ia && (
            <span className="hidden sm:block truncate max-w-[120px]">{message.modelo_ia}</span>
          )}
          {/* Status badge */}
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium ${statusCfg.className}`}>
            <StatusIcon size={9} />
            {statusCfg.label}
          </span>
        </div>

        {/* Error */}
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ConversationDetail({
  conversation,
  open,
  onOpenChange,
  onComposeMessage,
}: ConversationDetailProps) {
  const { data: messages = [], isLoading } = useAgentMessages(conversation?.id);
  const escalate = useEscalateConversation();
  const resume = useResumeConversation();
  const sendManual = useSendManualWhatsApp();
  const [manualText, setManualText] = useState('');

  const lead = conversation?.leads;
  const isEscalated = conversation?.status === 'escalada';

  function handleEscalate() {
    if (!conversation) return;
    escalate.mutate({ conversationId: conversation.id });
  }

  function handleResume() {
    if (!conversation) return;
    resume.mutate({ conversationId: conversation.id });
  }

  function handleSendManual() {
    if (!conversation || !manualText.trim()) return;
    sendManual.mutate(
      { conversationId: conversation.id, conteudo: manualText.trim() },
      { onSuccess: () => setManualText('') }
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-slate-100 space-y-3">
          <SheetTitle className="text-left">
            <span className="text-lg font-bold text-slate-800 truncate block">
              {lead?.empresa ?? 'Conversa'}
            </span>
          </SheetTitle>

          {/* Lead info */}
          {lead && (
            <div className="space-y-1">
              {lead.contato_nome && (
                <p className="text-sm text-slate-600">{lead.contato_nome}</p>
              )}
              {lead.contato_email && (
                <p className="text-xs text-slate-400">{lead.contato_email}</p>
              )}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {lead.segmento && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-slate-100">
                    {lead.segmento}
                  </Badge>
                )}
                {lead.temperatura && (
                  <Badge
                    variant="secondary"
                    className={`text-xs px-1.5 py-0 ${
                      lead.temperatura === 'quente'
                        ? 'bg-red-100 text-red-700'
                        : lead.temperatura === 'morno'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {lead.temperatura}
                  </Badge>
                )}
                {lead.score !== null && lead.score !== undefined && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-purple-50 text-purple-700">
                    Score {lead.score}/100
                  </Badge>
                )}
                {conversation && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-blue-50 text-blue-700">
                    {conversation.etapa}
                  </Badge>
                )}
                {isEscalated && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-amber-100 text-amber-700">
                    Escalada — Humano
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Stats */}
          {conversation && (
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span>{conversation.mensagens_enviadas} enviadas</span>
              <span>{conversation.mensagens_recebidas} recebidas</span>
              <span>Tentativa {conversation.tentativas}/{conversation.max_tentativas}</span>
            </div>
          )}
        </SheetHeader>

        {/* Escalated banner */}
        {isEscalated && (
          <div className="mx-5 mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 flex items-center gap-2">
            <UserCog size={14} className="shrink-0" />
            <span>Conversa sob controle humano. A IA não responde automaticamente. Escreva sua mensagem abaixo.</span>
          </div>
        )}

        {/* Messages timeline */}
        <ScrollArea className="flex-1 px-5 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Carregando mensagens...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <MessageSquare size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">Nenhuma mensagem</p>
              <p className="text-xs mt-1">Esta conversa ainda não tem mensagens.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Manual message input (escalated conversations) */}
        {conversation && isEscalated && (
          <>
            <Separator />
            <div className="px-5 py-3 space-y-2">
              <Textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Escreva sua mensagem para o lead..."
                className="rounded-xl text-sm min-h-[80px] resize-none"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSendManual}
                  disabled={!manualText.trim() || sendManual.isPending}
                  className="h-9 bg-green-600 hover:bg-green-700 text-white gap-1.5 flex-1"
                >
                  {sendManual.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  {sendManual.isPending ? 'Enviando...' : 'Enviar via WhatsApp'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResume}
                  disabled={resume.isPending}
                  className="h-9 gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50"
                >
                  {resume.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Bot size={14} />
                  )}
                  Devolver para IA
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Action buttons (non-escalated conversations) */}
        {conversation && !isEscalated && (
          <>
            <Separator />
            <div className="px-5 py-4 flex items-center gap-3 flex-wrap">
              <Button
                size="sm"
                onClick={() => onComposeMessage?.(conversation)}
                className="h-9 bg-blue-600 hover:bg-blue-700 text-white gap-1.5 flex-1"
              >
                <Send size={14} />
                Compor Nova Mensagem
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleEscalate}
                disabled={escalate.isPending}
                className="h-9 gap-1.5 text-amber-700 border-amber-200 hover:bg-amber-50 flex-1"
              >
                {escalate.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <UserCog size={14} />
                )}
                Escalar para Humano
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
