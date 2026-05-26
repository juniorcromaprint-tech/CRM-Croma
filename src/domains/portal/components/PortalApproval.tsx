// src/domains/portal/components/PortalApproval.tsx
// FASE 2-F: assinatura touch opcional antes de aprovar proposta no portal /p/:token.
// Canvas signature_pad (react-signature-canvas) captura PNG base64 -> repassa pra
// PortalOrcamentoPage via onApprove(comentario, assinaturaBase64).
// Assinatura eh opcional: cliente pode aprovar sem assinar (botao continua habilitado).
import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, Loader2, ShieldCheck, Clock, Headphones, PenLine, Eraser } from 'lucide-react';

interface Props {
  /**
   * Callback de aprovacao. Recebe comentario opcional e PNG base64 opcional da assinatura.
   * Compativel com chamadas legadas que ignoram o 2o argumento.
   */
  onApprove: (comentario?: string, assinaturaBase64?: string | null) => void;
  isLoading: boolean;
  disabled: boolean;
}

export function PortalApproval({ onApprove, isLoading, disabled }: Props) {
  const [comentario, setComentario] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const sigRef = useRef<SignatureCanvas | null>(null);

  const captureSignature = (): string | null => {
    if (!hasSigned || !sigRef.current) return null;
    // toDataURL retorna 'data:image/png;base64,....'
    // Mesmo com canvas em branco retorna algo; por isso usamos hasSigned como gate.
    try {
      return sigRef.current.toDataURL('image/png');
    } catch {
      return null;
    }
  };

  const handleApproveClick = () => {
    // Evita re-entrada: se ja esta loading, ignora cliques duplicados.
    if (isLoading || disabled) return;
    const assinatura = captureSignature();
    onApprove(comentario || undefined, assinatura);
  };

  const handleClearSignature = () => {
    sigRef.current?.clear();
    setHasSigned(false);
  };

  return (
    <div className="space-y-4">
      {/* Trust signals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-2.5 bg-white rounded-xl border border-slate-200 p-3">
          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={16} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-700">Aprovacao segura</p>
            <p className="text-xs text-slate-400">Dados protegidos</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 bg-white rounded-xl border border-slate-200 p-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Clock size={16} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-700">Processamento rapido</p>
            <p className="text-xs text-slate-400">Confirmacao imediata</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 bg-white rounded-xl border border-slate-200 p-3">
          <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
            <Headphones size={16} className="text-purple-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-700">Suporte dedicado</p>
            <p className="text-xs text-slate-400">Acompanhamento total</p>
          </div>
        </div>
      </div>

      {/* Assinatura digital (opcional) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <PenLine size={14} className="text-slate-500" />
          <label className="text-sm font-medium text-slate-700">
            Assinatura digital <span className="text-slate-400 font-normal">(opcional)</span>
          </label>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500 mb-2">
            Assine no espaco abaixo com o dedo (mobile) ou mouse.
          </p>
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 overflow-hidden touch-none">
            <SignatureCanvas
              ref={sigRef}
              penColor="#1f2937"
              canvasProps={{
                className: 'w-full h-32 cursor-crosshair',
                style: { touchAction: 'none' },
              }}
              onEnd={() => setHasSigned(true)}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <button
              type="button"
              onClick={handleClearSignature}
              disabled={!hasSigned || isLoading}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Eraser size={12} /> Limpar
            </button>
            {hasSigned ? (
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <Check size={12} /> Assinado
              </span>
            ) : (
              <span className="text-xs text-slate-400">Aguardando assinatura</span>
            )}
          </div>
        </div>
      </div>

      {/* Comment toggle */}
      {!showComment ? (
        <button
          onClick={() => setShowComment(true)}
          className="text-sm text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
        >
          + Adicionar comentario ou observacao
        </button>
      ) : (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Comentarios (opcional)</label>
          <Textarea
            placeholder="Tem alguma observacao, ajuste ou duvida? Escreva aqui..."
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            className="rounded-xl border-slate-200 focus:border-blue-400 focus:ring-blue-400"
            rows={3}
          />
        </div>
      )}

      {/* CTA Button */}
      <Button
        onClick={handleApproveClick}
        disabled={disabled || isLoading}
        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl h-14 text-base font-bold shadow-lg shadow-green-600/25 hover:shadow-green-600/40 transition-all duration-200 cursor-pointer"
      >
        {isLoading ? (
          <><Loader2 className="animate-spin mr-2" size={20} /> Processando aprovacao...</>
        ) : (
          <><Check size={20} className="mr-2" /> Aprovar Proposta</>
        )}
      </Button>

      <p className="text-center text-xs text-slate-400">
        Ao aprovar, voce confirma que concorda com os termos e valores apresentados.
        {hasSigned ? ' Sua assinatura digital sera anexada ao pedido.' : ''}
      </p>
    </div>
  );
}
