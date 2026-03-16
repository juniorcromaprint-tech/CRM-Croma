// src/domains/portal/components/PortalApproval.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, Loader2, ShieldCheck, Clock, Headphones } from 'lucide-react';

interface Props {
  onApprove: (comentario?: string) => void;
  isLoading: boolean;
  disabled: boolean;
}

export function PortalApproval({ onApprove, isLoading, disabled }: Props) {
  const [comentario, setComentario] = useState('');
  const [showComment, setShowComment] = useState(false);

  return (
    <div className="space-y-4">
      {/* Trust signals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-2.5 bg-white rounded-xl border border-slate-200 p-3">
          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={16} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-700">Aprovação segura</p>
            <p className="text-[10px] text-slate-400">Dados protegidos</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 bg-white rounded-xl border border-slate-200 p-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Clock size={16} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-700">Processamento rápido</p>
            <p className="text-[10px] text-slate-400">Confirmação imediata</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 bg-white rounded-xl border border-slate-200 p-3">
          <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
            <Headphones size={16} className="text-purple-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-700">Suporte dedicado</p>
            <p className="text-[10px] text-slate-400">Acompanhamento total</p>
          </div>
        </div>
      </div>

      {/* Comment toggle */}
      {!showComment ? (
        <button
          onClick={() => setShowComment(true)}
          className="text-sm text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
        >
          + Adicionar comentário ou observação
        </button>
      ) : (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Comentários (opcional)</label>
          <Textarea
            placeholder="Tem alguma observação, ajuste ou dúvida? Escreva aqui..."
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            className="rounded-xl border-slate-200 focus:border-blue-400 focus:ring-blue-400"
            rows={3}
          />
        </div>
      )}

      {/* CTA Button */}
      <Button
        onClick={() => onApprove(comentario || undefined)}
        disabled={disabled || isLoading}
        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl h-14 text-base font-bold shadow-lg shadow-green-600/25 hover:shadow-green-600/40 transition-all duration-200 cursor-pointer"
      >
        {isLoading ? (
          <><Loader2 className="animate-spin mr-2" size={20} /> Processando aprovação...</>
        ) : (
          <><Check size={20} className="mr-2" /> Aprovar Proposta</>
        )}
      </Button>

      <p className="text-center text-xs text-slate-400">
        Ao aprovar, você confirma que concorda com os termos e valores apresentados.
      </p>
    </div>
  );
}
