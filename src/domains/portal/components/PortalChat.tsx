// src/domains/portal/components/PortalChat.tsx
// FASE 2-E — Chat persistido via portal_mensagens (RPC).
// Substitui o state local por React Query (usePortalChat).
// Interface PUBLICA mantida: { shareToken: string } — PortalOrcamentoPage NAO muda.
import { useState, useRef, useEffect, useMemo } from 'react';
import { MessageCircle, X, Send, Loader2, Bot, User, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { usePortalChat } from '../hooks/usePortalChat';
import type { PortalMensagem } from '../services/portal.service';

/** Mensagem temporaria da IA, exibida em memoria enquanto a Edge nao persistir. */
interface MensagemTemporariaIA {
  id: string;
  remetente: 'ia';
  conteudo: string;
  created_at: string;
  __local: true;
}

type MensagemRender =
  | (PortalMensagem & { __local?: false })
  | MensagemTemporariaIA;

function formatHora(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function PortalChat({ shareToken }: { shareToken: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [iaLoading, setIaLoading] = useState(false);
  /** Respostas da IA — guardadas em memoria ate a Edge persistir (TODO V2). */
  const [iaLocalMessages, setIaLocalMessages] = useState<MensagemTemporariaIA[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    messages: persistedMessages,
    isLoading,
    isError,
    sendMessageAsync,
    isSending,
  } = usePortalChat(shareToken);

  // Mescla mensagens persistidas + respostas IA locais em ordem cronologica.
  const allMessages = useMemo<MensagemRender[]>(() => {
    const merged: MensagemRender[] = [
      ...persistedMessages,
      ...iaLocalMessages,
    ];
    merged.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return merged;
  }, [persistedMessages, iaLocalMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length, iaLoading]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || iaLoading || isSending) return;

    setInput('');
    setIaLoading(true);

    try {
      // 1) Persiste a mensagem do cliente (RPC portal_inserir_mensagem).
      //    onSuccess do hook ja invalida a query, entao a mensagem do cliente
      //    aparecera no proximo refetch (ou no resultado do mutate).
      await sendMessageAsync({ conteudo: text });

      // 2) Chama Edge ai-chat-portal pra resposta IA (stateless por ora).
      //    Historico enviado: ultimas 8 trocas no formato user/assistant.
      const historico = allMessages.slice(-8).map((m) => ({
        role: m.remetente === 'cliente' ? 'user' : 'assistant',
        content: m.conteudo,
      }));

      const { data, error } = await supabase.functions.invoke('ai-chat-portal', {
        body: {
          share_token: shareToken,
          mensagem: text,
          historico,
        },
      });

      if (error) throw error;

      const resposta = data?.resposta ?? 'Desculpe, nao consegui processar sua pergunta.';

      // 3) Renderiza resposta IA em memoria (Edge nao persiste — TODO V2).
      setIaLocalMessages((prev) => [
        ...prev,
        {
          id: `ia-local-${Date.now()}`,
          remetente: 'ia',
          conteudo: resposta,
          created_at: new Date().toISOString(),
          __local: true,
        },
      ]);
    } catch {
      setIaLocalMessages((prev) => [
        ...prev,
        {
          id: `ia-error-${Date.now()}`,
          remetente: 'ia',
          conteudo:
            'Desculpe, ocorreu um erro. Tente novamente ou entre em contato pelo WhatsApp.',
          created_at: new Date().toISOString(),
          __local: true,
        },
      ]);
    } finally {
      setIaLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const disabled = iaLoading || isSending;
  const showEmptyState = !isLoading && allMessages.length === 0;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          aria-label="Abrir chat"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Chat drawer */}
      {open && (
        <div
          className="fixed bottom-0 right-0 z-50 w-full sm:w-96 sm:bottom-6 sm:right-6 flex flex-col bg-white sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          style={{ height: 'min(560px, calc(100vh - 48px))' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white shrink-0">
            <div className="flex items-center gap-2">
              <Bot size={20} />
              <div>
                <p className="font-semibold text-sm">Croma Print</p>
                <p className="text-xs text-blue-100">Assistente do seu pedido</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-blue-500 transition-colors"
              aria-label="Fechar chat"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50">
            {/* Loading inicial (primeiro fetch) */}
            {isLoading && (
              <div className="flex justify-center py-4">
                <Loader2 size={20} className="animate-spin text-slate-400" />
              </div>
            )}

            {/* Error fetch */}
            {isError && !isLoading && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
                Nao foi possivel carregar o historico. Tentando novamente...
              </div>
            )}

            {/* Welcome / empty state */}
            {showEmptyState && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={14} className="text-blue-600" />
                </div>
                <div className="bg-white rounded-xl rounded-tl-sm px-3 py-2 shadow-sm border border-slate-100 max-w-[85%]">
                  <p className="text-sm text-slate-700">
                    Ola! Sou o assistente da Croma Print. Posso ajudar com duvidas
                    sobre sua proposta, status do pedido, prazos e formas de pagamento.
                    Como posso ajudar?
                  </p>
                </div>
              </div>
            )}

            {allMessages.map((msg) => {
              const isCliente = msg.remetente === 'cliente';
              const isIA = msg.remetente === 'ia';
              const isVendedor = msg.remetente === 'vendedor';

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${isCliente ? 'justify-end' : ''}`}
                  title={formatHora(msg.created_at)}
                >
                  {/* Avatar esquerda (vendedor / ia) */}
                  {!isCliente && (
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        isIA ? 'bg-purple-100' : 'bg-slate-200'
                      }`}
                    >
                      {isIA ? (
                        <Sparkles size={14} className="text-purple-600" />
                      ) : (
                        <Bot size={14} className="text-slate-600" />
                      )}
                    </div>
                  )}

                  <div
                    className={`rounded-xl px-3 py-2 max-w-[85%] shadow-sm text-sm ${
                      isCliente
                        ? 'bg-blue-600 text-white rounded-tr-sm'
                        : isIA
                          ? 'bg-purple-50 text-slate-800 rounded-tl-sm border border-purple-100'
                          : 'bg-white text-slate-700 rounded-tl-sm border border-slate-100'
                    }`}
                  >
                    {isVendedor && (
                      <p className="text-[10px] font-semibold text-slate-500 mb-0.5">
                        Vendedor
                      </p>
                    )}
                    {isIA && (
                      <p className="text-[10px] font-semibold text-purple-600 mb-0.5">
                        Assistente IA
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{msg.conteudo}</p>
                    <p
                      className={`text-[10px] mt-1 ${
                        isCliente ? 'text-blue-100' : 'text-slate-400'
                      }`}
                    >
                      {formatHora(msg.created_at)}
                    </p>
                  </div>

                  {/* Avatar direita (cliente) */}
                  {isCliente && (
                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                      <User size={14} className="text-slate-500" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading IA (gerando resposta) */}
            {iaLoading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                  <Sparkles size={14} className="text-purple-600" />
                </div>
                <div className="bg-white rounded-xl rounded-tl-sm px-3 py-2 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <div
                      className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <div
                      className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua pergunta..."
                disabled={disabled}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              />
              <Button
                onClick={() => void handleSend()}
                disabled={!input.trim() || disabled}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 rounded-xl h-9 w-9 p-0"
              >
                {disabled ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-slate-300 text-center mt-1.5">
              Assistente IA - respostas sobre seu pedido
            </p>
          </div>
        </div>
      )}
    </>
  );
}
