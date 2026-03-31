import React, { useState, useRef, useEffect } from "react";
import {
  Bot, MessageCircle, UserCog, Send, Loader2, ArrowLeft,
  Phone, Building2, ChevronRight, AlertTriangle, Clock,
  CheckCircle2, XCircle, RotateCcw, Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { showSuccess, showError } from "@/utils/toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Conversation {
  id: string;
  lead_id: string;
  canal: string;
  status: string;
  etapa: string;
  mensagens_enviadas: number;
  mensagens_recebidas: number;
  ultima_mensagem_em: string | null;
  score_engajamento: number;
  created_at: string;
  leads: {
    id: string;
    empresa: string | null;
    contato_nome: string | null;
    contato_telefone: string | null;
    contato_email: string | null;
    status: string;
    temperatura: string | null;
  } | null;
}

interface Message {
  id: string;
  conversation_id: string;
  direcao: string;
  canal: string;
  conteudo: string;
  status: string;
  created_at: string;
  enviado_em: string | null;
  metadata: Record<string, unknown> | null;
}

// ─── Status helpers ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ativa: { label: "Ativa", color: "bg-green-100 text-green-700", icon: <CheckCircle2 size={12} /> },
  escalada: { label: "Escalada", color: "bg-amber-100 text-amber-700", icon: <AlertTriangle size={12} /> },
  pausada: { label: "Pausada", color: "bg-slate-100 text-slate-600", icon: <Clock size={12} /> },
  encerrada: { label: "Encerrada", color: "bg-red-100 text-red-600", icon: <XCircle size={12} /> },
  convertida: { label: "Convertida", color: "bg-blue-100 text-blue-700", icon: <CheckCircle2 size={12} /> },
  aguardando_aprovacao: { label: "Aguardando", color: "bg-purple-100 text-purple-700", icon: <Clock size={12} /> },
};

const ETAPA_LABELS: Record<string, string> = {
  abertura: "Abertura",
  followup1: "Follow-up 1",
  followup2: "Follow-up 2",
  followup3: "Follow-up 3",
  reengajamento: "Reengajamento",
  proposta: "Proposta",
  negociacao: "Negociação",
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ─── Conversation List View ──────────────────────────────────────────────────

function ConversationList({
  onSelect,
}: {
  onSelect: (conv: Conversation) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todas");

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["campo-agent-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_conversations")
        .select(
          `id, lead_id, canal, status, etapa, mensagens_enviadas, mensagens_recebidas,
           ultima_mensagem_em, score_engajamento, created_at,
           leads (id, empresa, contato_nome, contato_telefone, contato_email, status, temperatura)`
        )
        .in("status", ["ativa", "escalada", "aguardando_aprovacao", "pausada"])
        .order("ultima_mensagem_em", { ascending: false, nullsFirst: false })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as Conversation[];
    },
    refetchInterval: 30000,
  });

  const filtered = (conversations ?? []).filter((c) => {
    const matchStatus = statusFilter === "todas" || c.status === statusFilter;
    const matchSearch =
      !search ||
      c.leads?.contato_nome?.toLowerCase().includes(search.toLowerCase()) ||
      c.leads?.empresa?.toLowerCase().includes(search.toLowerCase()) ||
      c.leads?.contato_telefone?.includes(search);
    return matchStatus && matchSearch;
  });

  const escaladas = (conversations ?? []).filter((c) => c.status === "escalada").length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Bot size={24} className="text-blue-600" /> Agente de Vendas
        </h1>
        <p className="text-slate-500 text-sm mt-1">Conversas do agente IA com leads via WhatsApp</p>
      </div>

      {escaladas > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-amber-600 shrink-0" />
          <div>
            <p className="font-bold text-amber-800 text-sm">
              {escaladas} conversa{escaladas > 1 ? "s" : ""} escalada{escaladas > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-amber-600">Requer resposta manual — lead aguardando atendimento humano</p>
          </div>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar lead..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl bg-white"
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: "todas", label: "Todas" },
          { key: "escalada", label: `Escaladas${escaladas > 0 ? ` (${escaladas})` : ""}` },
          { key: "ativa", label: "Ativas" },
          { key: "aguardando_aprovacao", label: "Aguardando" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              statusFilter === f.key
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-blue-600" size={24} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <MessageCircle size={36} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-600">Nenhuma conversa</h3>
          <p className="text-sm text-slate-400 mt-1">
            {statusFilter !== "todas" ? "Nenhuma conversa com este filtro." : "O agente ainda não iniciou conversas."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((conv) => {
            const st = STATUS_CONFIG[conv.status] ?? STATUS_CONFIG.ativa;
            return (
              <Card
                key={conv.id}
                className={`border-none shadow-sm rounded-2xl bg-white cursor-pointer hover:shadow-md transition-shadow ${
                  conv.status === "escalada" ? "ring-2 ring-amber-300" : ""
                }`}
                onClick={() => onSelect(conv)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${st.color}`}>
                          {st.icon} {st.label}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {ETAPA_LABELS[conv.etapa] ?? conv.etapa}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-800 truncate">
                        {conv.leads?.contato_nome || conv.leads?.empresa || "Lead sem nome"}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        {conv.leads?.contato_telefone && (
                          <span className="flex items-center gap-1">
                            <Phone size={11} /> {conv.leads.contato_telefone}
                          </span>
                        )}
                        {conv.leads?.empresa && (
                          <span className="flex items-center gap-1 truncate">
                            <Building2 size={11} /> {conv.leads.empresa}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                      <span className="text-[10px] text-slate-400">{timeAgo(conv.ultima_mensagem_em)}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400">
                          ↑{conv.mensagens_enviadas} ↓{conv.mensagens_recebidas}
                        </span>
                      </div>
                      <ChevronRight size={16} className="text-slate-300" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Conversation Detail View ────────────────────────────────────────────────

function ConversationDetail({
  conversation,
  onBack,
}: {
  conversation: Conversation;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [manualText, setManualText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ["campo-agent-messages", conversation.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_messages")
        .select("id, conversation_id, direcao, canal, conteudo, status, created_at, enviado_em, metadata")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as Message[];
    },
    refetchInterval: 15000,
  });

  // Fetch fresh conversation status
  const { data: freshConv } = useQuery({
    queryKey: ["campo-agent-conv-detail", conversation.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_conversations")
        .select(
          `id, status, etapa, mensagens_enviadas, mensagens_recebidas, ultima_mensagem_em,
           leads (id, empresa, contato_nome, contato_telefone, contato_email, status)`
        )
        .eq("id", conversation.id)
        .single();
      if (error) throw error;
      return data as Conversation;
    },
    refetchInterval: 10000,
  });

  const currentStatus = freshConv?.status ?? conversation.status;
  const lead = freshConv?.leads ?? conversation.leads;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Escalate mutation
  const escalate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("agent_conversations")
        .update({ status: "escalada" })
        .eq("id", conversation.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campo-agent-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["campo-agent-conv-detail", conversation.id] });
      showSuccess("Conversa escalada para atendimento humano");
    },
    onError: () => showError("Erro ao escalar conversa"),
  });

  // Resume (return to AI) mutation
  const resume = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("agent_conversations")
        .update({ status: "ativa" })
        .eq("id", conversation.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campo-agent-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["campo-agent-conv-detail", conversation.id] });
      showSuccess("Conversa devolvida para o agente IA");
    },
    onError: () => showError("Erro ao devolver conversa"),
  });

  // Send manual WhatsApp message
  const sendManual = useMutation({
    mutationFn: async (conteudo: string) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // 1. Create message as aprovada
      const { data: msg, error: insertErr } = await supabase
        .from("agent_messages")
        .insert({
          conversation_id: conversation.id,
          direcao: "enviada",
          canal: "whatsapp",
          conteudo,
          status: "aprovada",
          aprovado_por: session?.user?.id ?? null,
          aprovado_em: new Date().toISOString(),
          metadata: { manual: true, sent_by: session?.user?.id, sent_from: "campo_app" },
        })
        .select("id")
        .single();

      if (insertErr || !msg) throw new Error(insertErr?.message ?? "Erro ao criar mensagem");

      // 2. Send via whatsapp-enviar Edge Function
      const res = await supabase.functions.invoke("whatsapp-enviar", {
        body: { message_id: msg.id },
      });

      if (res.error) throw new Error(res.error.message);

      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campo-agent-messages", conversation.id] });
      queryClient.invalidateQueries({ queryKey: ["campo-agent-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["campo-agent-conv-detail", conversation.id] });
      setManualText("");
      showSuccess("Mensagem enviada via WhatsApp");
    },
    onError: (err: Error) => {
      showError(`Erro ao enviar: ${err.message}`);
    },
  });

  const st = STATUS_CONFIG[currentStatus] ?? STATUS_CONFIG.ativa;

  return (
    <div className="flex flex-col h-full -m-4 md:-m-8">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="text-slate-500 hover:text-slate-800 p-1">
          <ArrowLeft size={22} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-slate-800 truncate text-base">
            {lead?.contato_nome || lead?.empresa || "Lead"}
          </h2>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${st.color}`}>
              {st.icon} {st.label}
            </span>
            {lead?.contato_telefone && (
              <span className="text-[10px] text-slate-400">{lead.contato_telefone}</span>
            )}
          </div>
        </div>
        {/* Quick action buttons */}
        {currentStatus !== "escalada" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => escalate.mutate()}
            disabled={escalate.isPending}
            className="text-amber-700 border-amber-200 hover:bg-amber-50 text-xs gap-1 shrink-0"
          >
            {escalate.isPending ? <Loader2 size={14} className="animate-spin" /> : <UserCog size={14} />}
            Escalar
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => resume.mutate()}
            disabled={resume.isPending}
            className="text-blue-700 border-blue-200 hover:bg-blue-50 text-xs gap-1 shrink-0"
          >
            {resume.isPending ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            IA
          </Button>
        )}
      </div>

      {/* Escalation banner */}
      {currentStatus === "escalada" && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-600" />
          <span className="text-xs font-semibold text-amber-700">
            Conversa sob controle humano — IA pausada
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {loadingMessages ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-blue-600" size={24} />
          </div>
        ) : !messages?.length ? (
          <div className="text-center py-12 text-slate-400 text-sm">Nenhuma mensagem ainda</div>
        ) : (
          messages.map((msg) => {
            const isSent = msg.direcao === "enviada";
            const isManual = msg.metadata?.manual === true;
            const isError = msg.status === "erro";
            return (
              <div
                key={msg.id}
                className={`flex ${isSent ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${
                    isSent
                      ? isError
                        ? "bg-red-100 text-red-800 rounded-br-md"
                        : isManual
                        ? "bg-blue-600 text-white rounded-br-md"
                        : "bg-green-600 text-white rounded-br-md"
                      : "bg-white text-slate-800 border border-slate-200 rounded-bl-md"
                  }`}
                >
                  {isSent && (
                    <div className={`text-[9px] font-bold mb-1 ${isError ? "text-red-600" : "opacity-70"}`}>
                      {isManual ? "👤 Humano" : "🤖 Agente IA"}
                      {isError && " ⚠️ Erro no envio"}
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.conteudo}</p>
                  <div className={`text-[9px] mt-1 ${isSent ? "opacity-60 text-right" : "text-slate-400"}`}>
                    {new Date(msg.enviado_em || msg.created_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area (only for escalated conversations) */}
      {currentStatus === "escalada" && (
        <div className="bg-white border-t border-slate-200 p-3 flex items-end gap-2 sticky bottom-0">
          <textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="Escreva sua mensagem..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32"
            style={{ minHeight: "42px" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 128) + "px";
            }}
          />
          <Button
            onClick={() => {
              if (!manualText.trim()) return;
              sendManual.mutate(manualText.trim());
            }}
            disabled={!manualText.trim() || sendManual.isPending}
            size="icon"
            className="bg-green-600 hover:bg-green-700 rounded-xl h-[42px] w-[42px] shrink-0"
          >
            {sendManual.isPending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </Button>
        </div>
      )}

      {/* Info bar for non-escalated */}
      {currentStatus !== "escalada" && (
        <div className="bg-slate-100 border-t border-slate-200 px-4 py-3 text-center">
          <p className="text-xs text-slate-500">
            <Bot size={12} className="inline mr-1" />
            Agente IA ativo — escale para responder manualmente
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AgentePage() {
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);

  if (selectedConv) {
    return (
      <ConversationDetail
        conversation={selectedConv}
        onBack={() => setSelectedConv(null)}
      />
    );
  }

  return <ConversationList onSelect={setSelectedConv} />;
}
