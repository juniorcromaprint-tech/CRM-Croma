import { useState } from 'react';
import {
  Mail, MessageCircle, CheckCheck, Send, Edit2, Clock, Loader2,
  CheckCircle2, XCircle, AlertCircle, Bot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import {
  usePendingMessages,
  useApproveMessage,
  useRejectMessage,
  useSendApprovedMessage,
  useSendApprovedWhatsApp,
} from '../hooks/useAgentMessages';

// ─── Types ────────────────────────────────────────────────────────────────────

type PendingRow = {
  id: string;
  conversation_id: string;
  canal: string;
  conteudo: string;
  assunto: string | null;
  custo_ia: number;
  modelo_ia: string | null;
  created_at: string;
  status: string;
  agent_conversations: {
    id: string;
    canal: string;
    etapa: string;
    leads: {
      empresa: string;
      contato_nome: string | null;
      segmento: string | null;
      temperatura: string;
      score: number | null;
    } | null;
  } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ETAPA_LABEL: Record<string, string> = {
  abertura: 'Abertura',
  followup1: 'Follow-up 1',
  followup2: 'Follow-up 2',
  followup3: 'Follow-up 3',
  reengajamento: 'Reengajamento',
  proposta: 'Proposta',
  negociacao: 'Negociação',
};

const TEMP_COLOR: Record<string, string> = {
  quente: 'bg-red-100 text-red-700',
  morno: 'bg-orange-100 text-orange-700',
  frio: 'bg-blue-100 text-blue-700',
};

const CANAL_CONFIG: Record<string, { label: string; iconClass: string; badgeClass: string; Icon: typeof Mail }> = {
  email:    { label: 'Email',     iconClass: 'bg-blue-50 text-blue-600',   badgeClass: 'bg-blue-100 text-blue-700',   Icon: Mail },
  whatsapp: { label: 'WhatsApp',  iconClass: 'bg-green-50 text-green-600', badgeClass: 'bg-green-100 text-green-700', Icon: MessageCircle },
  interno:  { label: 'Interno',   iconClass: 'bg-slate-50 text-slate-500', badgeClass: 'bg-slate-100 text-slate-600', Icon: Mail },
};

function formatCost(cost: number): string {
  if (!cost) return '$0.000';
  return `$${cost.toFixed(4)}`;
}

// ─── Sub-component: MessageCard ───────────────────────────────────────────────

interface MessageCardProps {
  msg: PendingRow;
  isEditing: boolean;
  editContent: string;
  onEditToggle: () => void;
  onEditChange: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onSaveAndApprove: () => void;
  onSend: () => void;
  isApprovePending: boolean;
  isRejectPending: boolean;
  isSavePending: boolean;
  isSendPending: boolean;
}

function MessageCard({
  msg,
  isEditing,
  editContent,
  onEditToggle,
  onEditChange,
  onApprove,
  onReject,
  onSaveAndApprove,
  onSend,
  isApprovePending,
  isRejectPending,
  isSavePending,
  isSendPending,
}: MessageCardProps) {
  const conv = msg.agent_conversations;
  const lead = conv?.leads;
  const etapa = conv?.etapa ?? 'abertura';
  const canalKey = conv?.canal ?? msg.canal ?? 'email';
  const canalCfg = CANAL_CONFIG[canalKey] ?? CANAL_CONFIG.email;
  const CanalIcon = canalCfg.Icon;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`p-2 rounded-xl shrink-0 ${canalCfg.iconClass}`}>
            <CanalIcon size={16} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 truncate">
              {lead?.empresa ?? 'Lead desconhecido'}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {lead?.segmento && (
                <span className="text-xs text-slate-500">{lead.segmento}</span>
              )}
              {lead?.temperatura && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    TEMP_COLOR[lead.temperatura] ?? 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {lead.temperatura}
                </span>
              )}
              {lead?.score != null && (
                <span className="text-xs text-slate-500">score {lead.score}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0 text-right">
          {/* Canal badge */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${canalCfg.badgeClass}`}>
            <CanalIcon size={11} />
            {canalCfg.label}
          </span>
          <Badge variant="outline" className="text-xs">
            {ETAPA_LABEL[etapa] ?? etapa}
          </Badge>
          {msg.modelo_ia && (
            <span className="text-xs text-slate-400">{msg.modelo_ia}</span>
          )}
          <span className="text-xs text-slate-400">{formatCost(msg.custo_ia)}</span>
        </div>
      </div>

      <Separator />

      {/* Body */}
      <div className="p-4 space-y-2">
        {msg.assunto && (
          <p className="text-sm font-medium text-slate-700">
            Assunto: {msg.assunto}
          </p>
        )}

        {isEditing ? (
          <Textarea
            value={editContent}
            onChange={(e) => onEditChange(e.target.value)}
            rows={10}
            className="text-sm font-mono rounded-xl resize-none"
          />
        ) : (
          <div className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto bg-slate-50 rounded-xl p-3 border border-slate-100">
            {msg.conteudo}
          </div>
        )}
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex items-center gap-2 p-3 bg-slate-50">
        {isEditing ? (
          <>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 rounded-xl"
              onClick={onSaveAndApprove}
              disabled={isSavePending}
            >
              {isSavePending ? (
                <Loader2 size={14} className="mr-1.5 animate-spin" />
              ) : (
                <CheckCircle2 size={14} className="mr-1.5" />
              )}
              Salvar e Aprovar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-xl"
              onClick={onEditToggle}
              disabled={isSavePending}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 rounded-xl"
              onClick={onApprove}
              disabled={isApprovePending || isRejectPending || isSendPending}
            >
              {isApprovePending ? (
                <Loader2 size={14} className="mr-1.5 animate-spin" />
              ) : (
                <CheckCircle2 size={14} className="mr-1.5" />
              )}
              Aprovar
            </Button>
            <Button
              size="sm"
              className={`rounded-xl ${
                canalKey === 'whatsapp'
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
              onClick={onSend}
              disabled={isSendPending || isApprovePending || isRejectPending}
            >
              {isSendPending ? (
                <Loader2 size={14} className="mr-1.5 animate-spin" />
              ) : (
                <Send size={14} className="mr-1.5" />
              )}
              Enviar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={onEditToggle}
            >
              <Edit2 size={14} className="mr-1.5" />
              Editar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl"
              onClick={onReject}
              disabled={isRejectPending || isApprovePending || isSendPending}
            >
              {isRejectPending ? (
                <Loader2 size={14} className="mr-1.5 animate-spin" />
              ) : (
                <XCircle size={14} className="mr-1.5" />
              )}
              Rejeitar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgentApprovalPage() {
  const { data: pending = [], isLoading } = usePendingMessages();
  const approveMessage = useApproveMessage();
  const rejectMessage = useRejectMessage();
  const sendEmail = useSendApprovedMessage();
  const sendWhatsApp = useSendApprovedWhatsApp();

  // Editing state: msgId → draft content
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Bulk actions state
  const [bulkApproving, setBulkApproving] = useState(false);
  const [sendingAllProgress, setSendingAllProgress] = useState<{
    active: boolean;
    done: number;
    total: number;
  }>({ active: false, done: 0, total: 0 });

  // Cast to typed rows
  const messages = pending as unknown as PendingRow[];

  // Stats: just count pending (all rows here are pending_aprovacao)
  const pendingCount = messages.length;

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Detecta canal da mensagem a partir do join com agent_conversations */
  function detectCanal(msg: PendingRow): string {
    return msg.agent_conversations?.canal ?? msg.canal ?? 'email';
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleEditToggle(msg: PendingRow) {
    if (editingId === msg.id) {
      setEditingId(null);
      setEditContent('');
    } else {
      setEditingId(msg.id);
      setEditContent(msg.conteudo);
    }
  }

  function handleApprove(msg: PendingRow) {
    approveMessage.mutate({
      messageId: msg.id,
      conversationId: msg.conversation_id,
    });
  }

  function handleReject(msg: PendingRow) {
    rejectMessage.mutate({
      messageId: msg.id,
      conversationId: msg.conversation_id,
    });
  }

  async function handleSend(msg: PendingRow) {
    const canal = detectCanal(msg);
    setSendingId(msg.id);
    try {
      const sender = canal === 'whatsapp' ? sendWhatsApp : sendEmail;
      await sender.mutateAsync({
        messageId: msg.id,
        conversationId: msg.conversation_id,
      });
    } catch {
      // error handled in mutation onError
    } finally {
      setSendingId(null);
    }
  }

  async function handleSaveAndApprove(msg: PendingRow) {
    if (!editContent.trim()) {
      showError('O conteúdo não pode estar vazio');
      return;
    }

    setSavingId(msg.id);
    try {
      // 1. Save edited content
      const { error: updateError } = await supabase
        .from('agent_messages')
        .update({ conteudo: editContent })
        .eq('id', msg.id);

      if (updateError) throw new Error(updateError.message);

      // 2. Approve
      await approveMessage.mutateAsync({
        messageId: msg.id,
        conversationId: msg.conversation_id,
      });

      setEditingId(null);
      setEditContent('');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao salvar mensagem');
    } finally {
      setSavingId(null);
    }
  }

  async function handleApproveAll() {
    if (messages.length === 0) return;
    setBulkApproving(true);
    let successCount = 0;

    for (const msg of messages) {
      try {
        await approveMessage.mutateAsync({
          messageId: msg.id,
          conversationId: msg.conversation_id,
        });
        successCount++;
      } catch {
        // continue with next
      }
    }

    setBulkApproving(false);
    if (successCount > 0) {
      showSuccess(`${successCount} mensagem(ns) aprovada(s)`);
    }
  }

  async function handleSendAllApproved() {
    // Re-query approved messages including canal via conversation join
    const { data: approved, error } = await supabase
      .from('agent_messages')
      .select('id, conversation_id, agent_conversations(canal)')
      .eq('status', 'aprovada');

    if (error) {
      showError('Erro ao buscar mensagens aprovadas');
      return;
    }

    if (!approved || approved.length === 0) {
      showError('Nenhuma mensagem aprovada para enviar');
      return;
    }

    setSendingAllProgress({ active: true, done: 0, total: approved.length });

    for (let i = 0; i < approved.length; i++) {
      const msg = approved[i] as { id: string; conversation_id: string; agent_conversations: { canal: string } | null };
      const canal = msg.agent_conversations?.canal ?? 'email';
      const sender = canal === 'whatsapp' ? sendWhatsApp : sendEmail;
      try {
        await sender.mutateAsync({
          messageId: msg.id,
          conversationId: msg.conversation_id,
        });
      } catch {
        // continue
      }
      setSendingAllProgress({ active: true, done: i + 1, total: approved.length });
    }

    setSendingAllProgress({ active: false, done: 0, total: 0 });
    showSuccess('Envio em lote concluído');
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Fila de Aprovação</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Mensagens do agente aguardando revisão
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Approve All */}
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={handleApproveAll}
            disabled={bulkApproving || messages.length === 0 || isLoading}
          >
            {bulkApproving ? (
              <Loader2 size={15} className="mr-2 animate-spin" />
            ) : (
              <CheckCheck size={15} className="mr-2" />
            )}
            Aprovar Todas
          </Button>

          {/* Send All Approved */}
          <Button
            className="bg-blue-600 hover:bg-blue-700 rounded-xl"
            onClick={handleSendAllApproved}
            disabled={sendingAllProgress.active}
          >
            {sendingAllProgress.active ? (
              <>
                <Loader2 size={15} className="mr-2 animate-spin" />
                Enviando {sendingAllProgress.done}/{sendingAllProgress.total}
              </>
            ) : (
              <>
                <Send size={15} className="mr-2" />
                Enviar Todas Aprovadas
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 bg-white rounded-2xl border border-slate-200 px-5 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Clock size={15} className="text-amber-500" />
          <span className="font-semibold text-slate-700">{pendingCount}</span>
          <span className="text-slate-500">pendentes</span>
        </div>
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-2 text-sm">
          <AlertCircle size={15} className="text-blue-500" />
          <span className="text-slate-500">Aprovação manual ativa</span>
        </div>
        {sendingAllProgress.active && (
          <>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <Loader2 size={14} className="animate-spin" />
              Enviando {sendingAllProgress.done} de {sendingAllProgress.total}...
            </div>
          </>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-slate-400" />
        </div>
      ) : messages.length === 0 ? (
        // Empty state
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Bot size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-600">Nenhuma mensagem pendente</h3>
          <p className="text-sm text-slate-400 mt-1">
            O agente ainda não compôs novas mensagens.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((msg) => (
            <MessageCard
              key={msg.id}
              msg={msg}
              isEditing={editingId === msg.id}
              editContent={editContent}
              onEditToggle={() => handleEditToggle(msg)}
              onEditChange={setEditContent}
              onApprove={() => handleApprove(msg)}
              onReject={() => handleReject(msg)}
              onSaveAndApprove={() => handleSaveAndApprove(msg)}
              onSend={() => handleSend(msg)}
              isApprovePending={
                approveMessage.isPending && approveMessage.variables?.messageId === msg.id
              }
              isRejectPending={
                rejectMessage.isPending && rejectMessage.variables?.messageId === msg.id
              }
              isSavePending={savingId === msg.id}
              isSendPending={sendingId === msg.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
