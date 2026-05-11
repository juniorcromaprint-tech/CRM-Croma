// ============================================================================
// AGENT CONVERSATION PAGE — Croma Print ERP/CRM
// Standalone page for /agente/conversa/:id — shows full conversation timeline
// ============================================================================

import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Pencil,
  X,
  Save,
  User,
  Building2,
  Phone,
  MapPin,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Paperclip,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
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
import { showSuccess, showError } from '@/utils/toast';
import { useAgentMessages, useEscalateConversation, useResumeConversation, useSendManualWhatsApp, useDeleteConversation, useDeleteMessage } from '../hooks/useAgentMessages';
import { useUpdateLead } from '@/domains/comercial/hooks/useLeads';
import { useCreateCliente } from '@/domains/clientes/hooks/useClientes';
import { validarCNPJ } from '@/shared/utils/cnpj';
import type { AgentConversation, AgentCanal, AgentMessageStatus } from '../types/agent.types';

// ─── Fetch single conversation ───────────────────────────────────────────────

const CONVERSATION_SELECT = `
  id, lead_id, canal, status, etapa, mensagens_enviadas, mensagens_recebidas,
  ultima_mensagem_em, proximo_followup, tentativas, max_tentativas,
  score_engajamento, metadata, created_at, updated_at,
  leads(id, empresa, contato_nome, contato_email, email, telefone, contato_telefone, whatsapp, cargo, segmento, temperatura, score, cidade, uf, endereco, bairro, cep, cnpj, razao_social, observacoes, status, valor_estimado)
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

// ─── Lead Info Panel ─────────────────────────────────────────────────────────

interface LeadData {
  id: string;
  empresa: string;
  contato_nome: string | null;
  contato_email: string | null;
  email: string | null;
  telefone: string | null;
  contato_telefone: string | null;
  whatsapp: string | null;
  cargo: string | null;
  segmento: string | null;
  temperatura: string;
  score: number | null;
  cidade: string | null;
  uf: string | null;
  endereco: string | null;
  bairro: string | null;
  cep: string | null;
  cnpj: string | null;
  razao_social: string | null;
  observacoes: string | null;
  status: string | null;
  valor_estimado: number | null;
}

function LeadInfoPanel({ lead, conversationId }: { lead: LeadData; conversationId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<LeadData>>({});
  const queryClient = useQueryClient();

  const updateLead = useMutation({
    mutationFn: async (updates: Partial<LeadData>) => {
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', lead.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      showSuccess('Lead atualizado com sucesso');
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['agent', 'conversations', 'detail', conversationId] });
    },
    onError: (err: Error) => {
      showError(`Erro ao salvar: ${err.message}`);
    },
  });

  const startEditing = () => {
    setForm({
      empresa: lead.empresa,
      contato_nome: lead.contato_nome,
      contato_email: lead.contato_email,
      email: lead.email,
      telefone: lead.telefone,
      contato_telefone: lead.contato_telefone,
      whatsapp: lead.whatsapp,
      cargo: lead.cargo,
      cidade: lead.cidade,
      uf: lead.uf,
      endereco: lead.endereco,
      bairro: lead.bairro,
      cep: lead.cep,
      cnpj: lead.cnpj,
      razao_social: lead.razao_social,
      observacoes: lead.observacoes,
    });
    setEditing(true);
    setExpanded(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setForm({});
  };

  const saveChanges = () => {
    const updates: Record<string, unknown> = {};
    const editableKeys = ['empresa', 'contato_nome', 'contato_email', 'email', 'telefone', 'contato_telefone', 'whatsapp', 'cargo', 'cidade', 'uf', 'endereco', 'bairro', 'cep', 'cnpj', 'razao_social', 'observacoes'] as const;
    for (const key of editableKeys) {
      if (form[key] !== undefined && form[key] !== lead[key]) {
        updates[key] = form[key] || null;
      }
    }
    if (Object.keys(updates).length === 0) {
      setEditing(false);
      return;
    }
    updateLead.mutate(updates as Partial<LeadData>);
  };

  const Field = ({ label, value, field, icon: Icon }: { label: string; value: string | null; field?: keyof LeadData; icon?: typeof User }) => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
        {Icon && <Icon size={11} />}
        {label}
      </label>
      {editing && field ? (
        <Input
          value={form[field] as string ?? ''}
          onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
          className="h-8 text-sm rounded-lg"
          placeholder={label}
        />
      ) : (
        <p className="text-sm text-slate-700">{value || <span className="text-slate-300 italic">—</span>}</p>
      )}
    </div>
  );

  const mainPhone = lead.whatsapp || lead.telefone || lead.contato_telefone;
  const mainEmail = lead.contato_email || lead.email;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Compact row — always visible */}
      <div className="px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-3 text-left flex-1 min-w-0"
        >
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <User size={14} className="text-slate-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-700 truncate">{lead.contato_nome || lead.empresa}</p>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              {mainPhone && <span className="flex items-center gap-1"><Phone size={10} />{mainPhone}</span>}
              {mainEmail && <span className="truncate">{mainEmail}</span>}
            </div>
          </div>
          {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {!editing ? (
          <Button variant="ghost" size="sm" onClick={startEditing} className="text-slate-400 hover:text-blue-600 gap-1.5 ml-2">
            <Pencil size={13} />
            Editar
          </Button>
        ) : (
          <div className="flex items-center gap-1 ml-2">
            <Button variant="ghost" size="sm" onClick={cancelEditing} className="text-slate-400 hover:text-red-500 gap-1">
              <X size={13} />
            </Button>
            <Button
              size="sm"
              onClick={saveChanges}
              disabled={updateLead.isPending}
              className="bg-blue-600 hover:bg-blue-700 gap-1.5 text-xs"
            >
              {updateLead.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Salvar
            </Button>
          </div>
        )}
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-6 pb-5 pt-2 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Empresa" value={lead.empresa} field="empresa" icon={Building2} />
            <Field label="Razao Social" value={lead.razao_social} field="razao_social" icon={Building2} />
            <Field label="CNPJ" value={lead.cnpj} field="cnpj" icon={Building2} />
            <Field label="Contato" value={lead.contato_nome} field="contato_nome" icon={User} />
            <Field label="Cargo" value={lead.cargo} field="cargo" icon={Briefcase} />
            <Field label="Telefone" value={lead.telefone} field="telefone" icon={Phone} />
            <Field label="WhatsApp" value={lead.whatsapp} field="whatsapp" icon={Smartphone} />
            <Field label="Tel. Contato" value={lead.contato_telefone} field="contato_telefone" icon={Phone} />
            <Field label="Email" value={lead.email} field="email" icon={Mail} />
            <Field label="Email Contato" value={lead.contato_email} field="contato_email" icon={Mail} />
            <Field label="Endereco" value={lead.endereco} field="endereco" icon={MapPin} />
            <Field label="Bairro" value={lead.bairro} field="bairro" icon={MapPin} />
            <Field label="Cidade" value={lead.cidade} field="cidade" icon={MapPin} />
            <Field label="UF" value={lead.uf} field="uf" icon={MapPin} />
            <Field label="CEP" value={lead.cep} field="cep" icon={MapPin} />
          </div>

          {/* Badges row */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {lead.segmento && <Badge variant="secondary" className="text-xs">{lead.segmento}</Badge>}
            {lead.temperatura && (
              <Badge variant="secondary" className={`text-xs ${
                lead.temperatura === 'quente' ? 'bg-red-100 text-red-700' :
                lead.temperatura === 'morno' ? 'bg-amber-100 text-amber-700' :
                'bg-sky-100 text-sky-700'
              }`}>{lead.temperatura}</Badge>
            )}
            {lead.score != null && <Badge variant="secondary" className="text-xs">Score: {lead.score}</Badge>}
            {lead.status && <Badge variant="outline" className="text-xs">{lead.status}</Badge>}
          </div>

          {/* Observacoes */}
          <div className="mt-4">
            <label className="text-xs font-medium text-slate-400">Observacoes</label>
            {editing ? (
              <Textarea
                value={form.observacoes ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, observacoes: e.target.value }))}
                className="mt-1 text-sm rounded-xl min-h-[60px] resize-y"
                placeholder="Notas sobre o lead..."
              />
            ) : (
              <p className="text-sm text-slate-600 mt-1">{lead.observacoes || <span className="text-slate-300 italic">Sem observacoes</span>}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
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
            {/* Imagem */}
            {message.media_url && message.media_type === 'image' && (
              <img
                src={message.media_url}
                alt="Imagem"
                className="rounded-lg max-w-full max-h-64 object-cover mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(message.media_url!, '_blank')}
              />
            )}
            {/* Audio */}
            {message.media_url && message.media_type === 'audio' && (
              <div className="mb-2">
                <audio controls className="w-full max-w-[260px]">
                  <source src={message.media_url} type={message.media_mime || 'audio/ogg'} />
                  Seu navegador nao suporta audio.
                </audio>
                {message.media_transcription && (
                  <p className={`text-xs italic mt-1.5 leading-snug ${isSent ? 'text-blue-100' : 'text-slate-500'}`}>
                    &ldquo;{message.media_transcription}&rdquo;
                  </p>
                )}
              </div>
            )}
            {/* Video */}
            {message.media_url && message.media_type === 'video' && (
              <video controls className="rounded-lg max-w-full max-h-64 mb-2">
                <source src={message.media_url} type={message.media_mime || 'video/mp4'} />
                Seu navegador nao suporta video.
              </video>
            )}
            {/* Documento */}
            {message.media_url && message.media_type === 'document' && (
              <a
                href={message.media_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-2 ${
                  isSent ? 'bg-blue-500 text-white hover:bg-blue-400' : 'bg-slate-200 text-blue-600 hover:bg-slate-300'
                }`}
              >
                <Paperclip size={14} />
                {message.media_filename || 'Documento'}
              </a>
            )}
            {/* Texto (caption ou conteudo normal). Se houver media, so renderiza
                texto se nao for placeholder; se nao houver media, sempre renderiza */}
            {message.conteudo && (!message.media_type || !['[image]', '[audio]', '[video]', '[document]'].includes(message.conteudo.trim())) && (
              <span>{message.conteudo}</span>
            )}
            {/* Sem conteudo textual e sem media carregada */}
            {!message.media_url && !message.conteudo && (
              <span className="opacity-60 italic">
                {message.media_type ? `[${message.media_type} - erro ao carregar]` : '(sem conteudo)'}
              </span>
            )}
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

// v2 (2026-05-11): export nomeado pra reuso no split-view do dashboard.
// Default export continua sendo a página standalone via useParams.
//
// Props:
// - id: UUID da conversa (obrigatório)
// - embedded: quando true, esconde header "Voltar ao Agente" e ações de página
//   completa (Ir para Aprovação), usado no split view do dashboard.
// - onAfterDelete: callback após deletar a conversa (em standalone, navega pra
//   /agente; em embedded, fecha o painel direito).
export function AgentConversationView({
  id,
  embedded = false,
  onAfterDelete,
}: {
  id: string;
  embedded?: boolean;
  onAfterDelete?: () => void;
}) {
  const navigate = useNavigate();
  const { data: conversation, isLoading: convLoading, error: convError } = useConversationById(id);
  const { data: messages = [], isLoading: msgsLoading } = useAgentMessages(id);
  const escalate = useEscalateConversation();
  const resume = useResumeConversation();
  const sendManual = useSendManualWhatsApp();
  const deleteConversation = useDeleteConversation();
  const deleteMessage = useDeleteMessage();
  const updateLead = useUpdateLead();
  const createCliente = useCreateCliente();
  const [manualText, setManualText] = useState('');
  const [convertOpen, setConvertOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Converter lead em cliente direto da conversa (sem sair pra LeadDetailPage).
  // Validacoes: empresa obrigatoria, CNPJ valido se preenchido, sem duplicata por CNPJ.
  const handleConverterLead = async () => {
    const lead = (conversation as any)?.leads;
    if (!lead?.id) return;
    if (!lead.empresa?.trim()) {
      showError('Lead precisa ter nome da empresa para ser convertido.');
      return;
    }
    const cnpjLimpo = (lead.cnpj || '').replace(/\D/g, '') || null;
    if (cnpjLimpo && !validarCNPJ(cnpjLimpo)) {
      showError('CNPJ do lead inválido. Edite no detalhe do lead antes de converter.');
      return;
    }
    setConverting(true);
    try {
      // Bloqueio por CNPJ duplicado
      if (cnpjLimpo) {
        const { data: existingByCnpj } = await supabase
          .from('clientes')
          .select('id, razao_social')
          .eq('cnpj', cnpjLimpo)
          .is('excluido_em', null)
          .maybeSingle();
        if (existingByCnpj) {
          showError(`Já existe cliente com este CNPJ: ${existingByCnpj.razao_social}`);
          setConverting(false);
          return;
        }
      }
      // Bloqueio por razão social igual
      const { data: existingByName } = await supabase
        .from('clientes')
        .select('id, razao_social')
        .ilike('razao_social', lead.empresa.trim())
        .is('excluido_em', null)
        .maybeSingle();
      if (existingByName) {
        showError(`Já existe cliente com razão social parecida: ${existingByName.razao_social}. Edite no detalhe do lead antes de converter.`);
        setConverting(false);
        return;
      }

      const novoCliente = await createCliente.mutateAsync({
        razao_social: lead.empresa,
        nome_fantasia: lead.empresa,
        email: lead.contato_email ?? null,
        telefone: lead.contato_telefone ?? null,
        segmento: lead.segmento ?? null,
        origem: 'lead_convertido',
        lead_id: lead.id,
        cnpj: cnpjLimpo,
      });
      await updateLead.mutateAsync({ id: lead.id, status: 'convertido' });
      setConvertOpen(false);
      showSuccess('Lead convertido! Indo pro cliente para criar orçamento...');
      navigate(`/clientes/${novoCliente.id}`);
    } catch (err: any) {
      showError(err?.message || 'Erro ao converter lead em cliente.');
    } finally {
      setConverting(false);
    }
  };

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
        {!embedded && (
          <Button variant="ghost" onClick={() => navigate('/agente')} className="gap-2 text-slate-500 -ml-2">
            <ArrowLeft size={16} />
            Voltar
          </Button>
        )}
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
      {/* Back button — escondido em modo embedded (já tem lista lateral pra navegar) */}
      {!embedded && (
        <Button variant="ghost" onClick={() => navigate('/agente')} className="gap-2 text-slate-500 -ml-2">
          <ArrowLeft size={16} />
          Voltar ao Agente
        </Button>
      )}

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
            {/* Botao Converter em cliente — so quando lead ainda nao foi convertido nem perdido */}
            {lead && lead.status !== 'convertido' && lead.status !== 'perdido' && (
              <AlertDialog open={convertOpen} onOpenChange={setConvertOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <UserPlus size={14} />
                    Converter
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Converter em cliente?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-2 text-sm text-slate-600">
                        <p>
                          <strong>{lead.empresa}</strong> será criado como cliente e marcado como convertido. Você será levado pra tela do cliente pra criar o orçamento.
                        </p>
                        <div className="rounded-lg bg-slate-50 p-3 text-xs space-y-1">
                          <div><span className="text-slate-500">Empresa:</span> <strong>{lead.empresa}</strong></div>
                          {lead.cnpj && <div><span className="text-slate-500">CNPJ:</span> {lead.cnpj}</div>}
                          {lead.contato_nome && <div><span className="text-slate-500">Contato:</span> {lead.contato_nome}</div>}
                          {lead.contato_email && <div><span className="text-slate-500">Email:</span> {lead.contato_email}</div>}
                          {lead.contato_telefone && <div><span className="text-slate-500">Telefone:</span> {lead.contato_telefone}</div>}
                          {(lead.cidade || lead.uf) && <div><span className="text-slate-500">Cidade:</span> {[lead.cidade, lead.uf].filter(Boolean).join('/')}</div>}
                        </div>
                        {!lead.cnpj && (
                          <p className="text-amber-700 text-xs">⚠ Sem CNPJ — você pode completar na tela do cliente depois.</p>
                        )}
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={converting}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={converting}
                      onClick={(e) => {
                        e.preventDefault();
                        handleConverterLead();
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {converting ? (
                        <>
                          <Loader2 className="animate-spin mr-2 h-4 w-4" />
                          Convertendo...
                        </>
                      ) : (
                        <>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Converter e ir pro cliente
                        </>
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
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
                        { onSuccess: () => {
                          if (onAfterDelete) onAfterDelete();
                          else navigate('/agente');
                        } }
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

      {/* Lead info panel */}
      {lead && (
        <LeadInfoPanel lead={lead as unknown as LeadData} conversationId={conversation.id} />
      )}

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

// Wrapper default — usado pela rota /agente/conversa/:id como página standalone.
export default function AgentConversationPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return <AgentConversationView id={id} />;
}
