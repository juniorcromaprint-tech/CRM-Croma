'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  data?: any;
}

const SUGGESTIONS = [
  'Quanto faturamos este mês?',
  'OPs atrasadas',
  'Pipeline comercial',
  'Estoque abaixo do mínimo',
];

const WELCOME_MESSAGE = 'Olá! Sou o assistente do ERP Croma. Pergunte qualquer coisa sobre vendas, financeiro, produção ou estoque.';

export function ChatERP() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content: WELCOME_MESSAGE,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setShowSuggestions(false);
    setIsLoading(true);

    try {
      const response = await supabase.functions.invoke('ai-chat-erp', {
        body: { message: text },
      });

      if (response.error) {
        throw response.error;
      }

      const { response: botResponse, intent, data } = response.data;

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: botResponse || 'Desculpe, não consegui processar sua pergunta.',
        timestamp: new Date(),
        data,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error calling ai-chat-erp:', error);
      showError('Erro ao processar sua pergunta. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-40 animate-pulse hover:animate-none"
        aria-label="Abrir chat ERP"
      >
        <MessageSquare size={24} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-full sm:w-96 h-screen sm:h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 max-w-[calc(100vw-24px)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-blue-100 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <Bot size={20} className="text-blue-600" />
          <h2 className="font-semibold text-slate-900">Chat ERP</h2>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Fechar chat"
        >
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs px-4 py-2 rounded-xl ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-slate-50 text-slate-900 rounded-bl-none border border-slate-200'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
              <p
                className={`text-xs mt-1 ${
                  message.role === 'user' ? 'text-blue-100' : 'text-slate-400'
                }`}
              >
                {message.timestamp.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-50 text-slate-900 rounded-xl rounded-bl-none border border-slate-200 px-4 py-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}

        {/* Suggestions */}
        {showSuggestions && messages.length === 1 && (
          <div className="mt-4 space-y-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full text-left px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm transition-colors duration-150"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-200 bg-white rounded-b-2xl flex gap-2">
        <input
          ref={inputRef}
          type="text"
          placeholder="Faça uma pergunta..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:bg-slate-50 disabled:text-slate-400"
        />
        <button
          onClick={() => handleSendMessage(inputValue)}
          disabled={isLoading || !inputValue.trim()}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-150 flex items-center justify-center disabled:bg-slate-300 disabled:cursor-not-allowed"
          aria-label="Enviar mensagem"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

export default ChatERP;
