// ============================================================================
// LEAD AGENT PANEL — Croma Print ERP/CRM
// Painel embeddável na página de detalhe do lead mostrando atividade do agente
// ============================================================================

import {
  Mail,
  MessageCircle,
  MessageSquare,
  Send,
  Inbox,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  CornerDownRight,
  Loader2,
  Bot,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { formatDate } from '@/shared/utils/format';
import { useLeadConversations, useLeadTimeline } from '../hooks/useLeadConversations';
import type { AgentCanal, AgentMessageStatus } from '../types/agent.types';
import type { TimelineMessage } from '../hooks/useLeadConversations';

// ─── Props ────────────────────────────────────────────────────────────────────

interface LeadAgentPanelProps {
  leadId: string;
  onComposeEmail?: () => void;
  onComposeWhatsApp?: () => void;
}

// ─── Icon maps ────────────────────────────────────────────────────────────────

const CANAL_ICON: Record<AgentCanal, typeof Mail> = {
  email: Mail,
  whatsapp: MessageCircle,
  interno: MessageSquare,
};

const CANAL_LABEL: Record<AgentCanal, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  interno: 'Interno',
};

const CANAL_CLASS: Record<AgentCanal, string> = {
  email: 'bg-blue-100 text-blue-700',
  whatsapp: 'bg-green-100 text-green-700',
  interno: 'bg-slate-100 text-slate-600',
};

const STATUS_CONFIG: Record<AgentMessageStatus, { label: string; icon: typeof CheckCircle; className: string }> = {
  rascunho:           { label: 'Rascunho',        icon: Clock,           className: 'text-slate-500 bg-slate-100' },
  pendente_aprovacao: { label: 'Pend. Aprovação',  icon: Clock,           className: 'text-amber-700 bg-amber-100' },
  aprovada:           { label: 'Aprovada',         icon: CheckCircle,     className: 'text-emerald-700 bg-emerald-100' },
  enviada:            { label: 'Enviada',          icon: Send,            className: 'text-blue-700 bg-blue-100' },
  entregue:           { label: 'Entregue',         icon: CheckCircle,     className: 'text-blue-600 bg-blue-50' },
  lida:               { label: 'Lida',             icon: Eye,             className: 'text-indigo-700 bg-indigo-100' },
  respondida:         { label: 'Respondida',       icon: CornerDownRight, className: 'text-purple-700 bg-purple-100' },
  erro:               { label: 'Erro',             icon: AlertCircle,     className: 'text-red-700 bg-red-100' },
};

// ─── Timeline item ────────────────────────────────────────────────────────────

function TimelineItem({ msg }: { msg: TimelineMessage }) {
  const isSent = msg.direcao === 'enviada';
  const CanalIcon = CANAL_ICON[msg.conversa_canal] ?? Mail;
  const statusCfg = STATUS_CONFIG[msg.status] ?? STATUS_CONFIG.enviada;
  const StatusIcon = statusCfg.icon;
  const DirIcon = isSent ? ArrowUpRight : ArrowDownLeft;

  return (
    <div className={`flex gap-3 ${isSent ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar com canal */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
        isSent ? 'bg-blue-100' : 'bg-slate-100'
      }`}>
        {isSent ? (
          <CanalIcon size={14} className="text-blue-600" />
        ) : (
          <Inbox size={14} className="text-slate-500" />
        )}
      </div>

      {/* Conteúdo */}
      <div className={`flex-1 min-w-0 max-w-[85%] space-y-1 flex flex-col ${isSent ? 'items-end' : 'items-start'}`}>
        {/* Canal + etapa header */}
        <div className={`flex items-center gap-1.5 ${isSent ? 'flex-row-reverse' : ''}`}>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${CANAL_CLASS[msg.conversa_canal]}`}>
            <CanalIcon size={9} />
            {CANAL_LABEL[msg.conversa_canal]}
          </span>
          <span className="flex items-center gap-0.5 text-xs text-slate-400">
            <DirIcon size={10} />
            {isSent ? 'Agente' : 'Lead'}
          </span>
        </div>

        {/* Assunto */}
        {msg.assunto && (
          <p className="text-xs font-semibold text-slate-500 truncate max-w-full">{msg.assunto}</p>
        )}

        {/* Bubble */}
        <div className={`rounded-2xl px-3 py-2.5 text-sm leading-relaxed ${
          isSent
            ? 'bg-blue-600 text-white rounded-tr-md'
            : 'bg-slate-100 text-slate-700 rounded-tl-md'
        }`}>
          <p className="whitespace-pre-wrap break-words">{msg.conteudo}</p>
        </div>

        {/* Meta */}
        <div className={`flex items-center gap-2 text-xs text-slate-400 ${isSent ? 'flex-row-reverse' : ''}`}>
          <span>{msg.enviado_em ? formatDate(msg.enviado_em) : formatDate(msg.created_at)}</span>
          {/* Status badge */}
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium ${statusCfg.className}`}>
            <StatusIcon size={9} />
            {statusCfg.label}
          </span>
        </div>

        {/* Erro */}
        {msg.erro_mensagem && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle size={11} />
            {msg.erro_mensagem}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Stats row ────────────────────────────────────────────────────────────────

interface StatsRowProps {
  totalEnviadas: number;
  totalRecebidas: number;
  engagementScore: number;
}

function StatsRow({ totalEnviadas, totalRecebidas, engagementScore }: StatsRowProps) {
  const taxaResposta = totalEnviadas > 0 ? Math.round((totalRecebidas / totalEnviadas) * 100) : 0;
  const scoreColor =
    engagementScore <= 30 ? 'text-red-500' :
    engagementScore <= 60 ? 'text-amber-500' :
    'text-emerald-500';

  return (
    <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500">
      <span className="flex items-center gap-1">
        <ArrowUpRight size={12} className="text-blue-400" />
        {totalEnviadas} enviadas
      </span>
      <span className="flex items-center gap-1">
        <ArrowDownLeft size={12} className="text-slate-400" />
        {totalRecebidas} recebidas
      </span>
      <span className="flex items-center gap-1">
        <TrendingUp size={12} className="text-slate-400" />
        {taxaResposta}% resposta
      </span>
      {engagementScore > 0 && (
        <span className={`flex items-center gap-1 font-medium ${scoreColor}`}>
          Score {engagementScore}
        </span>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LeadAgentPanel({ leadId, onComposeEmail, onComposeWhatsApp }: LeadAgentPanelProps) {
  const { data: groups = [], isLoading: groupsLoading } = useLeadConversations(leadId);
  const { data: timeline = [], isLoading: timelineLoading } = useLeadTimeline(leadId);

  const isLoading = groupsLoading || timelineLoading;

  // Stats agregadas de todos os grupos
  const totalEnviadas = groups.reduce((sum, g) => sum + g.totalEnviadas, 0);
  const totalRecebidas = groups.reduce((sum, g) => sum + g.totalRecebidas, 0);
  const engagementScore = groups.length > 0
    ? Math.round(
        groups.reduce((sum, g) =>
          sum + g.conversations.reduce((s, c) => s + (c.score_engajamento ?? 0), 0), 0
        ) / groups.reduce((sum, g) => sum + g.conversations.length, 0)
      )
    : 0;

  // Canais com conversas ativas
  const canaisAtivos = groups.map((g) => g.canal);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-blue-600" />
          <h3 className="font-semibold text-slate-700 text-sm">Atividade do Agente</h3>
          {/* Canal icons */}
          <div className="flex items-center gap-1 ml-1">
            {canaisAtivos.includes('email') && (
              <span className="p-1 bg-blue-50 rounded-lg" title="Email">
                <Mail size={12} className="text-blue-600" />
              </span>
            )}
            {canaisAtivos.includes('whatsapp') && (
              <span className="p-1 bg-green-50 rounded-lg" title="WhatsApp">
                <MessageCircle size={12} className="text-green-600" />
              </span>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs gap-1.5 rounded-xl"
            onClick={onComposeEmail}
          >
            <Mail size={12} />
            Email
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs gap-1.5 rounded-xl text-green-700 border-green-200 hover:bg-green-50"
            onClick={onComposeWhatsApp}
          >
            <MessageCircle size={12} />
            WhatsApp
          </Button>
        </div>
      </div>

      {/* Stats */}
      {!isLoading && timeline.length > 0 && (
        <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50">
          <StatsRow
            totalEnviadas={totalEnviadas}
            totalRecebidas={totalRecebidas}
            engagementScore={engagementScore}
          />
        </div>
      )}

      {/* Canal badges */}
      {!isLoading && groups.length > 0 && (
        <div className="flex items-center gap-2 px-5 py-2 border-b border-slate-100 overflow-x-auto">
          {groups.map((group) => {
            const Icon = CANAL_ICON[group.canal];
            return (
              <Badge
                key={group.canal}
                variant="secondary"
                className={`shrink-0 text-xs gap-1 ${CANAL_CLASS[group.canal]}`}
              >
                <Icon size={10} />
                {CANAL_LABEL[group.canal]}
                <span className="ml-1 opacity-70">
                  {group.totalEnviadas + group.totalRecebidas} msgs
                </span>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Timeline */}
      <ScrollArea className="h-72">
        <div className="px-5 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Carregando atividade...</span>
            </div>
          ) : timeline.length === 0 ? (
            <div className="py-10 text-center">
              <Bot size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">Nenhuma atividade ainda</p>
              <p className="text-xs text-slate-400 mt-1">
                Inicie uma conversa via Email ou WhatsApp.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {timeline.map((msg, idx) => (
                <div key={msg.id}>
                  {/* Separador de data entre dias diferentes */}
                  {idx === 0 || !isSameDay(timeline[idx - 1].created_at, msg.created_at) ? (
                    <div className="flex items-center gap-3 mb-4">
                      <Separator className="flex-1" />
                      <span className="text-xs text-slate-400 font-medium shrink-0">
                        {formatDayLabel(msg.created_at)}
                      </span>
                      <Separator className="flex-1" />
                    </div>
                  ) : null}
                  <TimelineItem msg={msg} />
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function isSameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDayDate(date, today)) return 'Hoje';
  if (isSameDayDate(date, yesterday)) return 'Ontem';

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isSameDayDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
