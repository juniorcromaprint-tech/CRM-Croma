import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2, X, MessageSquare, Minimize2, Maximize2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { brl } from '@/shared/utils/format';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  source?: 'claude' | 'openrouter';
}

/**
 * ChatERP — Interface de chat natural com o ERP
 *
 * Fluxo:
 * 1. Usuário digita em linguagem natural ("pedidos atrasados", "faturamento do mês")
 * 2. Cria ai_request tipo 'chat-erp'
 * 3. Claude processa via MCP (scheduled task) ou fallback Edge Function
 * 4. Resposta aparece no chat via polling de ai_responses
 */
export default function ChatERP() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Olá! Sou o assistente da Croma Print. Pergunte qualquer coisa sobre o sistema: pedidos, clientes, financeiro, produção, estoque...',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  const pollForResponse = useCallback(async (requestId: string, startTime: number): Promise<string | null> => {
    const timeout = 90000; // 90s
    const interval = 2500;

    while (Date.now() - startTime < timeout) {
      const { data: req } = await supabase
        .from('ai_requests')
        .select('status')
        .eq('id', requestId)
        .single();

      if (req?.status === 'completed') {
        const { data: resp } = await supabase
          .from('ai_responses')
          .select('summary, conteudo')
          .eq('request_id', requestId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (resp) {
          return resp.summary || (typeof resp.conteudo === 'string' ? resp.conteudo : JSON.stringify(resp.conteudo));
        }
      }

      if (req?.status === 'error' || req?.status === 'expired') {
        return null;
      }

      await new Promise((r) => setTimeout(r, interval));
    }

    return null;
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Create ai_request
      const { data: aiReq, error: insertErr } = await supabase
        .from('ai_requests')
        .insert({
          tipo: 'chat-erp',
          entity_type: 'geral',
          contexto: { pergunta: text, historico: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })) },
          solicitante_id: user?.id,
        })
        .select()
        .single();

      if (insertErr) throw new Error(insertErr.message);

      // Poll for response
      const resposta = await pollForResponse(aiReq.id, Date.now());

      if (resposta) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: resposta,
            timestamp: new Date(),
            source: 'claude',
          },
        ]);
      } else {
        // Fallback: try quick local query for common patterns
        const fallbackResp = await tryLocalFallback(text);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: fallbackResp || 'Desculpe, não consegui processar sua pergunta no momento. O sistema de IA pode estar temporariamente indisponível. Tente novamente em alguns minutos.',
            timestamp: new Date(),
            source: fallbackResp ? 'openrouter' : undefined,
          },
        ]);
      }
    } catch (err) {
      showError((err as Error).message);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Erro ao processar a pergunta. Tente novamente.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, pollForResponse]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all hover:scale-105"
        title="Chat com o ERP"
      >
        <MessageSquare size={24} />
      </button>
    );
  }

  // Minimized state
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-xl border border-slate-200 w-72">
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer"
          onClick={() => setIsMinimized(false)}
        >
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-blue-600" />
            <span className="font-medium text-sm text-slate-700">Chat ERP</span>
          </div>
          <div className="flex gap-1">
            <button onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }} className="p-1 hover:bg-slate-100 rounded">
              <Maximize2 size={14} className="text-slate-400" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} className="p-1 hover:bg-slate-100 rounded">
              <X size={14} className="text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-xl border border-slate-200 w-96 h-[520px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <Bot size={20} className="text-white" />
          <span className="font-semibold text-white">Assistente Croma</span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setIsMinimized(true)} className="p-1 hover:bg-blue-500 rounded transition-colors">
            <Minimize2 size={16} className="text-white/80" />
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-blue-500 rounded transition-colors">
            <X size={16} className="text-white/80" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot size={14} className="text-blue-600" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.source && (
                <span className="text-[10px] opacity-50 mt-1 block">
                  via {msg.source === 'claude' ? 'Claude' : 'IA'}
                </span>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mt-1">
                <User size={14} className="text-slate-500" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-2 justify-start">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-blue-600" />
            </div>
            <div className="bg-slate-100 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={14} className="animate-spin" />
                Pensando...
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-100">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex: pedidos atrasados, faturamento do mês..."
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl p-2 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-1 text-center">
          Powered by Claude — pergunte em linguagem natural
        </p>
      </div>
    </div>
  );
}

/**
 * Fallback local para consultas simples quando Claude não responde
 */
async function tryLocalFallback(pergunta: string): Promise<string | null> {
  const p = pergunta.toLowerCase();

  try {
    // Pedidos atrasados
    if (p.includes('atras') && (p.includes('pedid') || p.includes('entrega'))) {
      const { data } = await supabase
        .from('pedidos')
        .select('numero, status, cliente_id, clientes(nome)')
        .in('status', ['em_producao', 'confirmado'])
        .order('created_at', { ascending: true })
        .limit(10);
      if (data?.length) {
        return `Encontrei ${data.length} pedidos em andamento:\n${data.map((p: any) => `• ${p.numero} — ${p.clientes?.nome || 'N/A'} (${p.status})`).join('\n')}`;
      }
      return 'Nenhum pedido atrasado encontrado no momento.';
    }

    // Faturamento
    if (p.includes('fatur') || p.includes('receb') || p.includes('receita')) {
      const { data } = await supabase
        .from('contas_receber')
        .select('valor_original, status, data_pagamento')
        .eq('status', 'pago')
        .gte('data_pagamento', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());
      const total = data?.reduce((sum: number, cr: any) => sum + Number(cr.valor_original || 0), 0) || 0;
      return `Faturamento recebido neste mês: ${brl(total)}\n(${data?.length || 0} títulos pagos)`;
    }

    // Leads
    if (p.includes('lead')) {
      const { data, count } = await supabase
        .from('leads')
        .select('nome, empresa, status, created_at', { count: 'exact' })
        .not('status', 'in', '("convertido","perdido","descartado")')
        .order('created_at', { ascending: false })
        .limit(5);
      return `${count || 0} leads ativos no funil.\nÚltimos:\n${data?.map((l: any) => `• ${l.empresa || l.nome} (${l.status})`).join('\n') || 'Nenhum'}`;
    }

    // Clientes
    if (p.includes('client') && (p.includes('quant') || p.includes('total'))) {
      const { count } = await supabase.from('clientes').select('id', { count: 'exact', head: true });
      return `Total de clientes cadastrados: ${count || 0}`;
    }

    // Estoque
    if (p.includes('estoqu') || p.includes('material')) {
      const { data } = await supabase
        .from('materiais')
        .select('nome, estoque_atual, estoque_minimo')
        .not('estoque_atual', 'is', null)
        .not('estoque_minimo', 'is', null)
        .order('estoque_atual', { ascending: true })
        .limit(5);
      if (data?.length) {
        return `Materiais com estoque mais baixo:\n${data.map((m: any) => `• ${m.nome}: ${m.estoque_atual} (mín: ${m.estoque_minimo})`).join('\n')}`;
      }
    }

    // Produção
    if (p.includes('produ') || p.includes(' op ') || p.includes('op ')) {
      const { data, count } = await supabase
        .from('ordens_producao')
        .select('numero, status', { count: 'exact' })
        .in('status', ['pendente', 'em_producao']);
      return `${count || 0} ordens de produção ativas.\n${data?.map((op: any) => `• ${op.numero} (${op.status})`).join('\n') || 'Nenhuma OP ativa'}`;
    }
  } catch {
    return null;
  }

  return null;
}
